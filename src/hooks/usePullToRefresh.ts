import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

/** Visual pull (px) required to fire onRefresh. */
export const PULL_THRESHOLD_PX = 64;
/** Cap on the rubber-band visual travel. */
export const PULL_MAX_PX = 96;
/** Applied to raw finger travel so the sheet doesn't jump. */
export const PULL_RESISTANCE = 0.42;
/** Spinner row height while a refresh is in flight. */
export const REFRESH_INDICATOR_PX = 56;

export interface UsePullToRefreshOptions {
  onRefresh: () => void | Promise<void>;
  disabled?: boolean;
  threshold?: number;
}

export interface UsePullToRefreshResult {
  containerRef: RefObject<HTMLDivElement>;
  pullDistance: number;
  refreshing: boolean;
  pulling: boolean;
  indicatorVisible: boolean;
}

function resistedPull(rawDy: number): number {
  if (rawDy <= 0) return 0;
  return Math.min(rawDy * PULL_RESISTANCE, PULL_MAX_PX);
}

/**
 * Touch pull-to-refresh for a scroll container.
 * Fires only when the container is scrolled to the top.
 * Blocks a second trigger while a refresh is already running.
 */
export function usePullToRefresh({
  onRefresh,
  disabled = false,
  threshold = PULL_THRESHOLD_PX,
}: UsePullToRefreshOptions): UsePullToRefreshResult {
  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number | null>(null);
  const pullDistanceRef = useRef(0);
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const setDistance = useCallback((next: number) => {
    pullDistanceRef.current = next;
    setPullDistance(next);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let cancelled = false;

    const atTop = () => (el.scrollTop ?? 0) <= 0;

    const abortGesture = () => {
      startYRef.current = null;
      if (!refreshingRef.current) setDistance(0);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (disabled || refreshingRef.current) return;
      if (!atTop()) {
        startYRef.current = null;
        return;
      }
      startYRef.current = e.touches[0]?.clientY ?? null;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (disabled || refreshingRef.current || startYRef.current == null) return;
      if (!atTop()) {
        abortGesture();
        return;
      }
      const y = e.touches[0]?.clientY;
      if (y == null) return;
      const dy = y - startYRef.current;
      if (dy <= 0) {
        setDistance(0);
        return;
      }
      // Own the gesture only when pulling down from the top — leave normal scroll alone.
      if (e.cancelable) e.preventDefault();
      setDistance(resistedPull(dy));
    };

    const onTouchEnd = () => {
      if (startYRef.current == null) return;
      startYRef.current = null;

      if (disabled || refreshingRef.current) {
        setDistance(0);
        return;
      }

      const shouldRefresh = pullDistanceRef.current >= threshold;
      if (!shouldRefresh) {
        setDistance(0);
        return;
      }

      refreshingRef.current = true;
      setRefreshing(true);
      setDistance(REFRESH_INDICATOR_PX);

      void Promise.resolve()
        .then(() => onRefreshRef.current())
        .catch(() => {
          // Screen-level refresh failures stay on the existing data (zero-mock: no invented fallback).
        })
        .finally(() => {
          refreshingRef.current = false;
          if (cancelled) return;
          setRefreshing(false);
          setDistance(0);
        });
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);

    return () => {
      cancelled = true;
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [disabled, setDistance, threshold]);

  const pulling = pullDistance > 0 && !refreshing;
  const indicatorVisible = refreshing || pullDistance > 8;

  return {
    containerRef,
    pullDistance,
    refreshing,
    pulling,
    indicatorVisible,
  };
}
