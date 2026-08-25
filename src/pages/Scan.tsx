import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { X, Upload, Camera, MapPin, ImagePlus, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { normalizeImage, isValidImageDataUrl, fileToJpegDataUrl } from "@/lib/imageUtils";
import {
  extractExifGpsFromDataUrl,
  extractExifGpsFromFile,
  readFileAsDataUrl,
  resolveScanCoords,
  type ExifGps,
} from "@/lib/exifGps";
import { prefersSystemCameraCapture } from "@/lib/iosCapture";
import { saveLastScanPhoto } from "@/lib/lastScanPhotoStore";
import { Button } from "@/components/ui/button";
import CaptureGate from "@/components/CaptureGate";
import {
  LOCATION_CAMERA_ASK,
  isValidGeoPosition,
  startShootGeolocation,
  type GeoPosition,
} from "@/lib/requestGeolocation";

type CameraState = "loading" | "active" | "system" | "denied" | "unavailable";
type ShootPhase = "idle" | "flash" | "gps" | "compressing" | "gps_denied";
type PagePhase = "gate" | "camera";

const isDev = import.meta.env.DEV;
function devLog(...args: unknown[]) { if (isDev) console.log("[SCAN]", ...args); }

const Scan = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [pagePhase, setPagePhase] = useState<PagePhase>("gate");
  const [cameraState, setCameraState] = useState<CameraState>("loading");
  const [shootPhase, setShootPhase] = useState<ShootPhase>("idle");
  const [freezeFrame, setFreezeFrame] = useState<string | null>(null);
  const [showTips, setShowTips] = useState(true);
  const [manualAddress, setManualAddress] = useState<string>("");
  const [gatePosition, setGatePosition] = useState<GeoPosition | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingShootGeoRef = useRef<Promise<GeoPosition> | null>(null);
  const lastExifRef = useRef<ExifGps | null>(null);

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  // Start camera only when moving past gate.
  // iOS: skip getUserMedia — canvas capture drops EXIF GPS. System camera keeps it.
  useEffect(() => {
    if (pagePhase !== "camera") return;
    let cancelled = false;

    const start = async () => {
      try {
        if (prefersSystemCameraCapture()) {
          setCameraState("system");
          return;
        }
        if (!navigator.mediaDevices?.getUserMedia) {
          setCameraState("unavailable");
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraState("active");
        // Auto-hide tips after 4s
        setTimeout(() => setShowTips(false), 4000);
      } catch (err: unknown) {
        if (!cancelled) {
          const name = err instanceof DOMException ? err.name : "";
          setCameraState(name === "NotAllowedError" || name === "PermissionDeniedError" ? "denied" : "unavailable");
        }
      }
    };

    start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [pagePhase]);

  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.85);
  }, []);

  const persistAndNavigate = useCallback(
    async (payload: { photo: string; lat: number; lng: number; manualAddress?: string }) => {
      // Never open /result without a real JPEG — an empty report is worse than staying here.
      if (!isValidImageDataUrl(payload.photo)) {
        toast({
          title: "Foto non disponibile",
          description: "Lo scatto non è stato salvato correttamente. Riprova.",
          variant: "destructive",
        });
        setShootPhase("idle");
        return;
      }
      try {
        await saveLastScanPhoto(payload);
      } catch {
        /* IDB failure must not block the shot — router state still carries it. */
      }
      // replace: camera must not sit under the report — Android/header back goes Home, not an empty shutter.
      navigate("/result", { replace: true, state: payload });
    },
    [navigate, toast],
  );


  const navigateWithTypedAddress = useCallback(
    (photo: string, address: string) => {
      void persistAndNavigate({ photo, lat: 0, lng: 0, manualAddress: address });
    },
    [persistAndNavigate],
  );

  const processAndNavigate = useCallback(
    async (
      rawPhoto: string,
      gpsPromise: Promise<GeoPosition> | null,
      address: string,
      exifPos?: ExifGps | null,
    ) => {
      setShootPhase("compressing");
      let photo: string;
      try {
        photo = await normalizeImage(rawPhoto);
        devLog("image normalized successfully");
      } catch {
        // Already a valid JPEG data URL (iOS conversion path): ship it uncompressed
        // rather than losing the shot.
        if (isValidImageDataUrl(rawPhoto)) {
          photo = rawPhoto;
          devLog("normalize failed, using converted JPEG as-is");
        } else {
          toast({ title: "Immagine non elaborabile", description: "Riprova con una foto più semplice o più vicina.", variant: "destructive" });
          setShootPhase("idle");
          return;
        }
      }


      if (!isValidImageDataUrl(photo)) {
        toast({ title: "Immagine non valida", description: "Riprova con un'altra foto.", variant: "destructive" });
        setShootPhase("idle");
        return;
      }

      const trimmedAddr = address.trim();

      // If user provided manual address, skip GPS and rely on backend geocoding.
      if (trimmedAddr.length >= 3) {
        devLog("manual address provided, skipping GPS:", trimmedAddr);
        navigateWithTypedAddress(photo, trimmedAddr);
        return;
      }

      const exif = exifPos ?? extractExifGpsFromDataUrl(rawPhoto);
      lastExifRef.current = exif;

      setShootPhase("gps");
      devLog("gps acquisition started");

      let geo: GeoPosition | null = null;
      if (gpsPromise) {
        try {
          const pos = await gpsPromise;
          geo = isValidGeoPosition(pos) ? pos : null;
        } catch (err) {
          const message = err instanceof Error ? err.message : "unavailable";
          devLog("gps denied:", message);
        }
      }

      const resolved = resolveScanCoords(geo, exif);
      if (!resolved) {
        devLog("no valid geo or EXIF coords");
        setShootPhase("gps_denied");
        return;
      }
      if (geo && resolved.lat === geo.lat && resolved.lng === geo.lng) {
        devLog(`gps granted: ${resolved.lat}, ${resolved.lng}`);
      } else {
        devLog(`exif gps used: ${resolved.lat}, ${resolved.lng}`);
      }
      void persistAndNavigate({ photo, lat: resolved.lat, lng: resolved.lng });
    },
    [persistAndNavigate, navigateWithTypedAddress, toast]
  );

  const retryGps = useCallback(() => {
    if (!freezeFrame) return;
    // Riprova is a fresh user gesture — start GPS in this tick. EXIF stays as fallback.
    const gpsPromise = startShootGeolocation({ skipForAddress: false, gatePosition: null });
    processAndNavigate(freezeFrame, gpsPromise, "", lastExifRef.current ?? extractExifGpsFromDataUrl(freezeFrame));
  }, [freezeFrame, processAndNavigate]);

  const proceedWithTypedAddress = useCallback(() => {
    const trimmed = manualAddress.trim();
    if (!freezeFrame || trimmed.length < 3) return;
    processAndNavigate(freezeFrame, null, trimmed);
  }, [freezeFrame, manualAddress, processAndNavigate]);

  const handleShoot = useCallback(() => {
    const trimmedAddr = manualAddress.trim();
    // Same tick as the shutter tap, before setTimeout/await — iOS 18 keeps the gesture.
    const gpsPromise = startShootGeolocation({
      skipForAddress: trimmedAddr.length >= 3,
      gatePosition,
    });

    if (prefersSystemCameraCapture()) {
      pendingShootGeoRef.current = gpsPromise;
      fileInputRef.current?.click();
      return;
    }

    const rawPhoto = captureFrame();
    if (!rawPhoto) return;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setFreezeFrame(rawPhoto);
    setShootPhase("flash");
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => {
      // Live getUserMedia canvas has no EXIF — Android uses device GPS.
      processAndNavigate(rawPhoto, gpsPromise, trimmedAddr, null);
    }, 150);
  }, [captureFrame, processAndNavigate, manualAddress, gatePosition]);

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target;
      const file = input.files?.[0];
      input.value = "";
      if (!file) return;

      void (async () => {
        // Read EXIF from the original File before canvas conversion strips it.
        const exif = await extractExifGpsFromFile(file);
        lastExifRef.current = exif;
        let rawPhoto: string;
        try {
          // iPhone system camera can return HEIC/HEIF: always decode to real JPEG first.
          rawPhoto = await fileToJpegDataUrl(file);
        } catch {
          try {
            rawPhoto = await readFileAsDataUrl(file);
          } catch {
            rawPhoto = "";
          }
        }
        if (!isValidImageDataUrl(rawPhoto)) {
          toast({
            title: "Foto non leggibile",
            description: "Il formato della foto non è supportato. Riprova con un nuovo scatto.",
            variant: "destructive",
          });
          setShootPhase("idle");
          return;
        }
        const trimmedAddr = manualAddress.trim();
        const gpsPromise = pendingShootGeoRef.current
          ?? startShootGeolocation({
            skipForAddress: trimmedAddr.length >= 3,
            gatePosition,
          });
        pendingShootGeoRef.current = null;
        setFreezeFrame(rawPhoto);
        processAndNavigate(rawPhoto, gpsPromise, trimmedAddr, exif);
      })();

    },
    [processAndNavigate, manualAddress, gatePosition, toast]
  );

  // Show capture gate first
  if (pagePhase === "gate") {
    return (
      <CaptureGate
        onContinue={({ position }) => {
          if (isValidGeoPosition(position)) setGatePosition(position);
          setPagePhase("camera");
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black">
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        playsInline
        muted
        autoPlay
      />

      {/* Flash overlay */}
      {shootPhase === "flash" && (
        <div className="absolute inset-0 z-50 animate-camera-flash bg-white" />
      )}

      {/* Compressing overlay */}
      {shootPhase === "compressing" && freezeFrame && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center">
          <img src={freezeFrame} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative z-10 flex flex-col items-center gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            <p className="text-base font-semibold text-white">Ottimizzazione immagine…</p>
          </div>
        </div>
      )}

      {/* GPS waiting overlay */}
      {shootPhase === "gps" && freezeFrame && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center">
          <img src={freezeFrame} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative z-10 flex flex-col items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20 backdrop-blur">
              <MapPin className="h-8 w-8 text-primary animate-pulse" />
            </div>
            <p className="text-base font-semibold text-white">Acquisizione posizione…</p>
            <p className="text-sm text-white/50">Attendere qualche istante</p>
          </div>
        </div>
      )}

      {/* GPS denied overlay */}
      {shootPhase === "gps_denied" && freezeFrame && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center">
          <img src={freezeFrame} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative z-10 flex flex-col items-center gap-5 px-8 max-w-sm text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/20 backdrop-blur">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <p className="text-base font-semibold text-white">Posizione non disponibile</p>
            <p className="text-sm text-white/70 leading-relaxed">
              GPS e foto senza coordinate. Puoi riprovare oppure inserire l'indirizzo dell'immobile.
            </p>
            <div className="flex flex-col gap-3 w-full">
              <Button onClick={retryGps} className="w-full min-h-[48px]" size="lg">
                <MapPin className="h-4 w-4 mr-2" />
                Riprova posizione
              </Button>
              <input
                id="scan-denied-address"
                type="text"
                value={manualAddress}
                onChange={(e) => setManualAddress(e.target.value)}
                placeholder="es. Via Roma 15, Padova"
                autoComplete="street-address"
                style={{ backgroundColor: "#ffffff", color: "#1a1a1a", caretColor: "#1a1a1a" }}
                className="w-full h-11 rounded-lg px-3 text-[16px] outline-none focus:ring-2 focus:ring-primary"
              />
              <Button
                type="button"
                variant="outline"
                onClick={proceedWithTypedAddress}
                disabled={manualAddress.trim().length < 3}
                className="w-full min-h-[48px] bg-white/10 border-white/20 text-white hover:bg-white/20"
                size="lg"
              >
                Continua con l'indirizzo
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShootPhase("idle");
                  setFreezeFrame(null);
                  navigate("/scan");
                }}
                className="w-full min-h-[48px] bg-white/10 border-white/20 text-white hover:bg-white/20"
                size="lg"
              >
                Torna alla scansione
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Overlay UI */}
      <div className="absolute inset-0 flex flex-col">
        {/* Header */}
        <header className="z-10 flex items-center justify-between px-5 pt-safe pb-2">
          <span className="text-base font-bold text-white/90 drop-shadow">Sottra</span>
          <button onClick={() => { streamRef.current?.getTracks().forEach((t) => t.stop()); navigate("/app"); }} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm">
            <X className="h-5 w-5 text-white" />
          </button>
        </header>

        {/* Prominent manual address input — visible BEFORE shooting */}
        {shootPhase === "idle" && (
          <div className="z-10 px-4 pb-2">
            <div className="rounded-2xl bg-black/55 backdrop-blur-md border border-white/15 p-3 shadow-lg">
              <label htmlFor="scan-manual-address" className="block text-[13px] font-semibold text-white mb-1.5">
                📍 Dove si trova l'immobile?
              </label>
              <input
                id="scan-manual-address"
                type="text"
                value={manualAddress}
                onChange={(e) => setManualAddress(e.target.value)}
                placeholder="es. Via Roma 15, Padova"
                autoComplete="street-address"
                style={{ backgroundColor: "#ffffff", color: "#1a1a1a", caretColor: "#1a1a1a" }}
                className="w-full h-11 rounded-lg px-3 text-[16px] outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => { if (manualAddress.trim()) fileInputRef.current?.click(); }}
                className="mt-2 w-full h-10 rounded-lg bg-primary text-white text-[15px] font-semibold active:opacity-80"
              >
                📍 Scansiona questo indirizzo
              </button>
              <p className="text-[11px] text-white/70 mt-1">
                {isValidGeoPosition(gatePosition)
                  ? "Posizione acquisita. Lo scatto userà le coordinate e l'indirizzo automatico. Puoi comunque scrivere un indirizzo se vuoi."
                  : LOCATION_CAMERA_ASK}
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-1 flex-col items-center justify-center">
          {(cameraState === "active" || cameraState === "system") && shootPhase === "idle" && (
            <>
              <Viewfinder />
              <p className="mt-6 text-sm font-medium text-white/70 drop-shadow">
                {cameraState === "system" ? "Scatta con la fotocamera iPhone" : "Inquadra un edificio"}
              </p>
              {cameraState === "system" && (
                <p className="mt-2 max-w-xs text-center text-xs text-white/55 leading-relaxed">
                  La fotocamera di sistema può includere le coordinate nella foto.
                </p>
              )}

              {/* Non-invasive shooting tips */}
              {showTips && cameraState === "active" && (
                <div className="mt-4 flex flex-wrap justify-center gap-2 px-6 animate-in fade-in duration-500">
                  {["Facciata intera", "Frontalmente", "Civico visibile"].map((tip) => (
                    <span key={tip} className="rounded-full bg-white/10 backdrop-blur-sm px-3 py-1.5 text-xs text-white/60">
                      {tip}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}

          {cameraState === "loading" && (
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              <p className="text-sm text-white/60">Attivazione fotocamera…</p>
            </div>
          )}

          {cameraState === "denied" && (
            <div className="mx-6 flex max-w-xs flex-col items-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur">
                <Camera className="h-8 w-8 text-white/60" />
              </div>
              <p className="text-base font-semibold text-white">Fotocamera non autorizzata</p>
              <p className="text-sm text-white/50">
                Vai nelle impostazioni del browser e consenti l'accesso alla fotocamera per Sottra, poi ricarica la pagina.
              </p>
              <UploadFallback onChange={handleFileUpload} />
            </div>
          )}

          {cameraState === "unavailable" && (
            <div className="mx-6 flex max-w-xs flex-col items-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur">
                <Upload className="h-8 w-8 text-white/60" />
              </div>
              <p className="text-base font-semibold text-white">Fotocamera non disponibile</p>
              <p className="text-sm text-white/50">Carica una foto dell'edificio dal tuo dispositivo.</p>
              <UploadFallback onChange={handleFileUpload} />
            </div>
          )}
        </div>

        {/* Bottom controls */}
        {(cameraState === "active" || cameraState === "system") && shootPhase === "idle" && (
          <div className="z-10 flex items-center justify-center gap-8 pb-safe pt-4 px-6" style={{ paddingBottom: 'max(var(--safe-bottom), 24px)' }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm transition-colors active:bg-white/20"
              aria-label="Carica foto dalla galleria"
            >
              <ImagePlus className="h-5 w-5 text-white/80" />
            </button>

            <button
              onClick={handleShoot}
              className="group flex h-[72px] w-[72px] items-center justify-center rounded-full border-[3px] border-white/90 bg-transparent transition-transform active:scale-90"
              aria-label="Scatta foto"
            >
              <div className="h-[58px] w-[58px] rounded-full bg-white transition-colors group-active:bg-white/70" />
            </button>

            <div className="h-11 w-11" />
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        data-testid="scan-capture-input"
        className="hidden"
        onChange={handleFileUpload}
      />
    </div>
  );
};

/* ---- Viewfinder ---- */
const Viewfinder = () => (
  <div className="relative h-64 w-64 sm:h-72 sm:w-72">
    <Corner className="left-0 top-0" rotate={0} />
    <Corner className="right-0 top-0" rotate={90} />
    <Corner className="bottom-0 right-0" rotate={180} />
    <Corner className="bottom-0 left-0" rotate={270} />
    <div className="absolute inset-4 animate-pulse rounded-lg border border-white/10" />
  </div>
);

const Corner = ({ className, rotate }: { className: string; rotate: number }) => (
  <svg
    className={`absolute h-8 w-8 text-white/80 ${className}`}
    style={{ transform: `rotate(${rotate}deg)` }}
    viewBox="0 0 32 32"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
  >
    <path d="M2 12 L2 2 L12 2" />
  </svg>
);

/* ---- Upload fallback button ---- */
const UploadFallback = ({ onChange }: { onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) => (
  <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
    <Upload className="h-4 w-4" />
    Carica foto
    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onChange} />
  </label>
);

export default Scan;
