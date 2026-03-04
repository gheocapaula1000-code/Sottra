import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { X, Upload, Camera, MapPin, ImagePlus } from "lucide-react";

type CameraState = "loading" | "active" | "denied" | "unavailable";
type ShootPhase = "idle" | "flash" | "gps";

const Scan = () => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraState, setCameraState] = useState<CameraState>("loading");
  const [shootPhase, setShootPhase] = useState<ShootPhase>("idle");
  const [freezeFrame, setFreezeFrame] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
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
  }, []);

  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.85);
  }, []);

  const navigateWithGps = useCallback(
    (photo: string) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => navigate("/result", { state: { photo, lat: pos.coords.latitude, lng: pos.coords.longitude } }),
          () => navigate("/result", { state: { photo, lat: null, lng: null, gpsError: true } }),
          { enableHighAccuracy: true, timeout: 8000 }
        );
      } else {
        navigate("/result", { state: { photo, lat: null, lng: null, gpsError: true } });
      }
    },
    [navigate]
  );

  const handleShoot = useCallback(() => {
    const photo = captureFrame();
    if (!photo) return;

    // Stop stream
    streamRef.current?.getTracks().forEach((t) => t.stop());

    // Flash phase
    setFreezeFrame(photo);
    setShootPhase("flash");

    setTimeout(() => {
      // GPS phase
      setShootPhase("gps");
      navigateWithGps(photo);
    }, 150);
  }, [captureFrame, navigateWithGps]);

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const photo = reader.result as string;
        setFreezeFrame(photo);
        setShootPhase("gps");
        navigateWithGps(photo);
      };
      reader.readAsDataURL(file);
    },
    [navigateWithGps]
  );

  return (
    <div className="fixed inset-0 bg-black">
      {/* Video feed */}
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

      {/* Overlay UI */}
      <div className="absolute inset-0 flex flex-col">
        {/* Header */}
        <header className="z-10 flex items-center justify-between px-5 pt-[env(safe-area-inset-top,12px)] pb-2">
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
          <div className="z-10 flex items-center justify-center gap-8 pb-[max(env(safe-area-inset-bottom,24px),24px)] pt-4 px-6">
            {/* Gallery button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm transition-colors active:bg-white/20"
              aria-label="Carica foto dalla galleria"
            >
              <ImagePlus className="h-5 w-5 text-white/80" />
            </button>

            {/* Shutter */}
            <button
              onClick={handleShoot}
              className="group flex h-[72px] w-[72px] items-center justify-center rounded-full border-[3px] border-white/90 bg-transparent transition-transform active:scale-90"
              aria-label="Scatta foto"
            >
              <div className="h-[58px] w-[58px] rounded-full bg-white transition-colors group-active:bg-white/70" />
            </button>

            {/* Spacer for symmetry */}
            <div className="h-11 w-11" />
          </div>
        )}
      </div>

      {/* Hidden file input for gallery */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
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
