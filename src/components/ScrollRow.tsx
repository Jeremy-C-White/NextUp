import { useEffect, useRef, useState } from "react";
import type { ReactNode, PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { glideScrollBy, stopGlide } from "../lib/smoothScroll";

/**
 * A horizontal row of cards (Discover and Library). Remembers its scroll
 * position, supports mouse drag and arrow buttons, and glides when scrolled.
 */
export function ScrollRow({ children, storageKey }: { children: ReactNode; storageKey?: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ down: false, moved: false, startX: 0, startLeft: 0 });
  const arrowsRef = useRef({ left: false, right: false });
  const scrollFrameRef = useRef<number | null>(null);
  const persistTimerRef = useRef<number | null>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateArrows = () => {
    const el = trackRef.current;
    if (!el) return;
    const left = el.scrollLeft > 4;
    const right = el.scrollLeft < el.scrollWidth - el.clientWidth - 4;
    if (left !== arrowsRef.current.left) setCanLeft(left);
    if (right !== arrowsRef.current.right) setCanRight(right);
    arrowsRef.current = { left, right };
  };

  const scheduleArrowUpdate = () => {
    if (scrollFrameRef.current !== null) return;
    scrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      updateArrows();
    });
  };

  useEffect(() => {
    if (storageKey) {
      try {
        const savedPosition = Number(localStorage.getItem(`nextup_row_scroll:${storageKey}`));
        if (Number.isFinite(savedPosition) && savedPosition > 0 && trackRef.current) {
          trackRef.current.scrollLeft = savedPosition;
        }
      } catch {
        // The row remains usable when private storage is unavailable.
      }
    }
    updateArrows();
    const el = trackRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(scheduleArrowUpdate);
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (scrollFrameRef.current !== null) window.cancelAnimationFrame(scrollFrameRef.current);
      if (persistTimerRef.current !== null) window.clearTimeout(persistTimerRef.current);
      if (storageKey && trackRef.current) {
        try {
          localStorage.setItem(`nextup_row_scroll:${storageKey}`, String(Math.round(trackRef.current.scrollLeft)));
        } catch {
          // Scroll restoration is optional polish.
        }
      }
    };
  }, [storageKey]);

  const handleScroll = () => {
    scheduleArrowUpdate();
    if (!storageKey || !trackRef.current) return;
    if (persistTimerRef.current !== null) window.clearTimeout(persistTimerRef.current);
    persistTimerRef.current = window.setTimeout(() => {
      persistTimerRef.current = null;
      if (!trackRef.current) return;
      try {
        localStorage.setItem(`nextup_row_scroll:${storageKey}`, String(Math.round(trackRef.current.scrollLeft)));
      } catch {
        // Scroll restoration is optional polish.
      }
    }, 180);
  };

  const scrollByDir = (dir: number) => {
    const el = trackRef.current;
    if (!el) return;
    glideScrollBy(el, dir * el.clientWidth * 0.8, 0, "glide");
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    // Mouse drag-to-scroll only; touch already scrolls natively
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const el = trackRef.current;
    if (!el) return;
    stopGlide(el);
    dragRef.current = { down: true, moved: false, startX: e.clientX, startLeft: el.scrollLeft };
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    const d = dragRef.current;
    const el = trackRef.current;
    if (!d.down || !el) return;
    const dx = e.clientX - d.startX;
    if (Math.abs(dx) > 5) d.moved = true;
    if (d.moved) el.scrollLeft = d.startLeft - dx;
  };

  const endDrag = () => {
    // Keep `moved` true briefly so the click-capture below can swallow the click
    dragRef.current.down = false;
    setTimeout(() => { dragRef.current.moved = false; }, 0);
  };

  const onClickCapture = (e: ReactMouseEvent) => {
    if (dragRef.current.moved) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return (
    <div
      className="relative group/row"
      data-tv-edge-rail-shell="true"
      data-tv-rail-has-next={canRight ? "true" : "false"}
    >
      <div
        ref={trackRef}
        onScroll={handleScroll}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onClickCapture={onClickCapture}
        data-tv-row="true"
        data-tv-edge-rail-track="true"
        className="flex gap-4 overflow-x-auto pb-4 scrollbar-none snap-x snap-proximity cursor-grab active:cursor-grabbing select-none"
      >
        {children}
      </div>
      {canLeft && (
        <button
          type="button"
          aria-label="Scroll left"
          data-tv-ignore="true"
          tabIndex={-1}
          onClick={() => scrollByDir(-1)}
          className="hidden md:flex items-center justify-center absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-30 w-10 h-10 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 transition-opacity"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}
      {canRight && (
        <button
          type="button"
          aria-label="Scroll right"
          data-tv-ignore="true"
          tabIndex={-1}
          onClick={() => scrollByDir(1)}
          className="hidden md:flex items-center justify-center absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-30 w-10 h-10 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 transition-opacity"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
