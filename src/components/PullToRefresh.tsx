import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  REFRESH_INDICATOR_PX,
  usePullToRefresh,
} from "@/hooks/usePullToRefresh";

export interface PullToRefreshProps {
  onRefresh: () => void | Promise<void>;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Shared pull-to-refresh scroller for standalone PWA / iOS Safari,
 * where native PTR does not fire. Rubber-band is disabled only on this
 * container so inner pages can still scroll normally.
 */
export default function PullToRefresh({
  onRefresh,
  disabled = false,
  className,
  children,
}: PullToRefreshProps) {
  const { containerRef, pullDistance, refreshing, pulling, indicatorVisible } =
    usePullToRefresh({ onRefresh, disabled });

  const offset = refreshing ? REFRESH_INDICATOR_PX : pullDistance;

  return (
    <div
      ref={containerRef}
      data-testid="pull-to-refresh"
      className={cn(
        "relative min-h-0 flex-1 overflow-y-auto overscroll-y-none",
        className,
      )}
    >
      <div
        className="flex items-center justify-center overflow-hidden"
        style={{
          height: offset,
          transition: pulling ? undefined : "height 160ms ease-out",
        }}
        aria-hidden={!indicatorVisible}
      >
        {indicatorVisible && (
          <div
            role="status"
            aria-label="Aggiornamento in corso"
            data-testid="pull-to-refresh-spinner"
            className="h-7 w-7 animate-spin rounded-full border-2 border-muted border-t-primary"
          />
        )}
      </div>
      {children}
    </div>
  );
}
