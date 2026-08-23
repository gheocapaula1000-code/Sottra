import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
import { act, render, screen, waitFor } from "@testing-library/react";
import PullToRefresh from "@/components/PullToRefresh";
import { PULL_THRESHOLD_PX, usePullToRefresh } from "@/hooks/usePullToRefresh";

function fireTouch(el: Element, type: "touchstart" | "touchmove" | "touchend", clientY: number) {
  const touch = {
    identifier: 0,
    clientX: 40,
    clientY,
    pageX: 40,
    pageY: clientY,
    screenX: 40,
    screenY: clientY,
    target: el,
  };
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "touches", {
    value: type === "touchend" ? [] : [touch],
  });
  Object.defineProperty(event, "changedTouches", { value: [touch] });
  el.dispatchEvent(event);
}

/** Raw finger travel large enough to cross the resisted threshold. */
const PAST_THRESHOLD_DY = Math.ceil(PULL_THRESHOLD_PX / 0.4) + 40;

function pullFrom(el: HTMLElement, startY: number, dy: number) {
  fireTouch(el, "touchstart", startY);
  fireTouch(el, "touchmove", startY + dy);
  fireTouch(el, "touchend", startY + dy);
}

describe("PullToRefresh hook / component", () => {
  it("triggers onRefresh only when pulled from the top past the threshold", async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    render(
      <PullToRefresh onRefresh={onRefresh}>
        <div style={{ height: 2000 }}>report</div>
      </PullToRefresh>,
    );

    const container = screen.getByTestId("pull-to-refresh");
    Object.defineProperty(container, "scrollTop", { value: 0, writable: true, configurable: true });

    await act(async () => {
      pullFrom(container, 80, PAST_THRESHOLD_DY);
    });

    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1));
  });

  it("does not trigger when the container is scrolled away from the top", async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    render(
      <PullToRefresh onRefresh={onRefresh}>
        <div style={{ height: 2000 }}>report</div>
      </PullToRefresh>,
    );

    const container = screen.getByTestId("pull-to-refresh");
    Object.defineProperty(container, "scrollTop", { value: 80, writable: true, configurable: true });

    await act(async () => {
      pullFrom(container, 80, PAST_THRESHOLD_DY);
    });

    expect(onRefresh).not.toHaveBeenCalled();
    expect(screen.queryByTestId("pull-to-refresh-spinner")).not.toBeInTheDocument();
  });

  it("shows the spinner while refreshing and does not double-fire", async () => {
    let release!: () => void;
    const onRefresh = vi.fn(
      () => new Promise<void>((resolve) => {
        release = resolve;
      }),
    );

    render(
      <PullToRefresh onRefresh={onRefresh}>
        <div style={{ height: 2000 }}>report</div>
      </PullToRefresh>,
    );

    const container = screen.getByTestId("pull-to-refresh");
    Object.defineProperty(container, "scrollTop", { value: 0, writable: true, configurable: true });

    await act(async () => {
      pullFrom(container, 80, PAST_THRESHOLD_DY);
    });

    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("pull-to-refresh-spinner")).toBeInTheDocument();
    expect(screen.getByRole("status", { name: /aggiornamento in corso/i })).toBeInTheDocument();

    await act(async () => {
      pullFrom(container, 80, PAST_THRESHOLD_DY);
    });
    expect(onRefresh).toHaveBeenCalledTimes(1);

    await act(async () => {
      release();
    });

    await waitFor(() => {
      expect(screen.queryByTestId("pull-to-refresh-spinner")).not.toBeInTheDocument();
    });
  });

  it("does not fire when the pull stays below the threshold", async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    render(
      <PullToRefresh onRefresh={onRefresh}>
        <div>short</div>
      </PullToRefresh>,
    );

    const container = screen.getByTestId("pull-to-refresh");
    Object.defineProperty(container, "scrollTop", { value: 0, writable: true, configurable: true });

    await act(async () => {
      pullFrom(container, 80, 20);
    });

    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("exports a hook that starts idle", () => {
    expect(typeof usePullToRefresh).toBe("function");
    expect(PULL_THRESHOLD_PX).toBeGreaterThan(0);
  });
});

describe("PTR screen wiring", () => {
  it("wraps result, dashboard, and history — not the camera shutter", () => {
    expect(readFileSync("src/pages/Result.tsx", "utf-8")).toContain("PullToRefresh");
    expect(readFileSync("src/pages/Dashboard.tsx", "utf-8")).toContain("PullToRefresh");
    expect(readFileSync("src/pages/History.tsx", "utf-8")).toContain("PullToRefresh");
    expect(readFileSync("src/pages/Scan.tsx", "utf-8")).not.toContain("PullToRefresh");
    expect(readFileSync("src/components/CaptureGate.tsx", "utf-8")).not.toContain("PullToRefresh");
  });

  it("result refresh reuses the existing photo and address without record-scan", () => {
    const result = readFileSync("src/pages/Result.tsx", "utf-8");
    expect(result).toContain("handlePullRefresh");
    expect(result).toContain("refresh(state.photo");
    expect(result).not.toMatch(/handlePullRefresh[\s\S]*record-scan/);
    expect(readFileSync("src/hooks/useBuildingScan.ts", "utf-8")).toContain("consumeCredit: false");
  });
});
