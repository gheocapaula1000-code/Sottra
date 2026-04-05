import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { X, Upload, Camera, MapPin, ImagePlus, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { normalizeImage, isValidImageDataUrl } from "@/lib/imageUtils";
import { Button } from "@/components/ui/button";
import CaptureGate from "@/components/CaptureGate";

type CameraState = "loading" | "active" | "denied" | "unavailable";
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Start camera only when moving past gate
  useEffect(() => {
    if (pagePhase !== "camera") return;
    let cancelled = false;

    const start = async () => {
      try {
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

  const processAndNavigate = useCallback(
    async (rawPhoto: string) => {
      setShootPhase("compressing");
      let photo: string;
      try {
        photo = await normalizeImage(rawPhoto);
        devLog("image normalized successfully");
      } catch {
        toast({ title: "Immagine non elaborabile", description: "Riprova con una foto più semplice o più vicina.", variant: "destructive" });
        setShootPhase("idle");
        return;
      }

      if (!isValidImageDataUrl(photo)) {
        toast({ title: "Immagine non valida", description: "Riprova con un'altra foto.", variant: "destructive" });
        setShootPhase("idle");
        return;
      }

      setShootPhase("gps");
      devLog("gps acquisition started");

      if (!navigator.geolocation) {
        devLog("gps unavailable");
        setShootPhase("gps_denied");
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude: lat, longitude: lng } = pos.coords;
          devLog(`gps granted: ${lat}, ${lng}`);
          if (lat === 0 && lng === 0) {
            devLog("gps returned 0,0 — treating as denied");
            setShootPhase("gps_denied");
            return;
          }
          navigate("/result", { state: { photo, lat, lng } });
        },
        (err) => {
          devLog("gps denied:", err.message);
          setShootPhase("gps_denied");
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    },
    [navigate, toast]
  );

  const retryGps = useCallback(() => {
    if (!freezeFrame) return;
    processAndNavigate(freezeFrame);
  }, [freezeFrame, processAndNavigate]);

  const handleShoot = useCallback(() => {
    const rawPhoto = captureFrame();
    if (!rawPhoto) return;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setFreezeFrame(rawPhoto);
    setShootPhase("flash");
    setTimeout(() => {
      processAndNavigate(rawPhoto);
    }, 150);
  }, [captureFrame, processAndNavigate]);

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const rawPhoto = reader.result as string;
        setFreezeFrame(rawPhoto);
        processAndNavigate(rawPhoto);
      };
      reader.readAsDataURL(file);
    },
    [processAndNavigate]
  );

  // Show capture gate first
  if (pagePhase === "gate") {
    return <CaptureGate onContinue={() => setPagePhase("camera")} />;
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
              Per analizzare correttamente l'edificio serve la posizione del dispositivo. Consenti la geolocalizzazione e riprova.
            </p>
            <div className="flex flex-col gap-3 w-full">
              <Button onClick={retryGps} className="w-full min-h-[48px]" size="lg">
                <MapPin className="h-4 w-4 mr-2" />
                Riprova posizione
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
          <button onClick={() => { streamRef.current?.getTracks().forEach((t) => t.stop()); navigate("/"); }} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm">
            <X className="h-5 w-5 text-white" />
          </button>
        </header>

        {/* Center: viewfinder or fallback */}
        <div className="flex flex-1 flex-col items-center justify-center">
          {cameraState === "active" && shootPhase === "idle" && (
            <>
              <Viewfinder />
              <p className="mt-6 text-sm font-medium text-white/70 drop-shadow">Inquadra un edificio</p>

              {/* Non-invasive shooting tips */}
              {showTips && (
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
        {cameraState === "active" && shootPhase === "idle" && (
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
