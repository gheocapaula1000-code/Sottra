import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { WifiOff } from "lucide-react";

export default function OfflineBanner() {
  const online = useOnlineStatus();

  if (online) return null;

  return (
    <div
      role="alert"
      className="fixed top-0 inset-x-0 z-[9999] flex items-center justify-center gap-2 bg-destructive px-4 py-2 pt-safe text-sm font-medium text-destructive-foreground"
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>Sei offline — verifica la connessione</span>
    </div>
  );
}
