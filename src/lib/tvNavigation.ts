import { isWebOSTV } from "./webos";

const FOCUSABLE_SELECTOR = [
  "button:not([disabled]):not([data-tv-ignore])",
  "a[href]:not([data-tv-ignore])",
  "input:not([disabled]):not([data-tv-ignore])",
  "select:not([disabled]):not([data-tv-ignore])",
  "textarea:not([disabled]):not([data-tv-ignore])",
  "video[controls]:not([data-tv-ignore])",
  "[tabindex]:not([tabindex='-1']):not([data-tv-ignore])"
].join(",");

type Direction = "left" | "up" | "right" | "down";

const DIRECTION_KEYS: Record<number, Direction> = {
  37: "left",
  38: "up",
  39: "right",
  40: "down"
};

const EDGE_PADDING = 48;
const REPEAT_THROTTLE_MS = 45;
const DOM_DELTA_LINE = 1;
const DOM_DELTA_PAGE = 2;

export function wheelDeltaPixels(delta: number, deltaMode: number, pageSize: number): number {
  const multiplier = deltaMode === DOM_DELTA_LINE
    ? 40
    : deltaMode === DOM_DELTA_PAGE
      ? Math.max(1, pageSize)
      : 1;
  return delta * multiplier;
}

export function horizontalWheelDelta(
  deltaX: number,
  deltaY: number,
  deltaMode: number,
  pageSize: number
): number {
  const rawDelta = Math.abs(deltaY) >= Math.abs(deltaX) ? deltaY : deltaX;
  return wheelDeltaPixels(rawDelta, deltaMode, pageSize);
}

interface ClosestElementTarget {
  closest(selector: string): Element | null;
}

export function shouldDeferWheelToSyncedCarousel(target: ClosestElementTarget): boolean {
  return target.closest("[data-tv-synced-wheel-carousel]") !== null;
}

export function shouldDelegateHorizontalNavigation(direction: string | undefined, hasHandler: boolean): boolean {
  return hasHandler && (direction === "left" || direction === "right");
}

function isVisible(element: HTMLElement): boolean {
  if (!element.isConnected || element.hidden || element.closest("[aria-hidden='true']")) return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

export function shouldRetainNativeDirectionalInput(
  direction: string | undefined,
  tagName: string,
  inputType = "",
  contentEditable = false
): boolean {
  if (!direction) return false;

  const tag = tagName.toLowerCase();
  if (tag === "textarea" || tag === "select" || contentEditable) return true;
  if (tag !== "input" || inputType.toLowerCase() === "hidden") return false;

  // Single-line fields and sliders need Left/Right for caret movement or
  // seeking. Up/Down must remain available to leave the control on a TV.
  return direction === "left" || direction === "right";
}

function shouldUseNativeDirectionalNavigation(element: Element | null, direction: Direction): boolean {
  if (!(element instanceof HTMLElement)) return false;
  return shouldRetainNativeDirectionalInput(
    direction,
    element.tagName,
    element instanceof HTMLInputElement ? element.type : "",
    element.isContentEditable
  );
}

function activeScope(): ParentNode {
  const dialogs = Array.from(document.querySelectorAll<HTMLElement>(
    "[role='dialog'][aria-modal='true'], [role='alertdialog'][aria-modal='true']"
  ))
    .filter(isVisible);
  return dialogs.at(-1) || document;
}

function potentialElements(scope: ParentNode): HTMLElement[] {
  return Array.from(scope.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    element => !element.hidden && !element.closest("[aria-hidden='true']")
  );
}

function visibleElements(scope: ParentNode): HTMLElement[] {
  return potentialElements(scope).filter(isVisible);
}

function nearbyVisibleElements(scope: ParentNode, active: HTMLElement, radius = 18): HTMLElement[] {
  const elements = potentialElements(scope);
  const index = elements.indexOf(active);
  if (index < 0) return elements.slice(0, radius).filter(isVisible);
  return elements
    .slice(Math.max(0, index - radius), Math.min(elements.length, index + radius + 1))
    .filter(isVisible);
}

function center(rect: DOMRect) {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function directionalScore(current: DOMRect, candidate: DOMRect, direction: Direction) {
  const from = center(current);
  const to = center(candidate);
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  const inDirection =
    (direction === "left" && dx < -2) ||
    (direction === "right" && dx > 2) ||
    (direction === "up" && dy < -2) ||
    (direction === "down" && dy > 2);

  if (!inDirection) return Number.POSITIVE_INFINITY;

  const primary = direction === "left" || direction === "right" ? Math.abs(dx) : Math.abs(dy);
  const secondary = direction === "left" || direction === "right" ? Math.abs(dy) : Math.abs(dx);
  const alignmentPenalty = secondary > primary ? secondary * 2.5 : secondary * 0.65;

  const overlapsAxis = direction === "left" || direction === "right"
    ? candidate.bottom >= current.top && candidate.top <= current.bottom
    : candidate.right >= current.left && candidate.left <= current.right;

  return primary + alignmentPenalty - (overlapsAxis ? 120 : 0);
}

function canScroll(element: HTMLElement): boolean {
  return element.scrollWidth > element.clientWidth + 2 || element.scrollHeight > element.clientHeight + 2;
}

function isKnownScrollContainer(element: HTMLElement): boolean {
  return element.hasAttribute("data-tv-row") ||
    element.hasAttribute("data-tv-scroll") ||
    element.classList.contains("overflow-y-auto") ||
    element.classList.contains("overflow-x-auto");
}

function verticalScrollContainer(target: Element): HTMLElement | null {
  let element: HTMLElement | null = target instanceof HTMLElement ? target : target.parentElement;
  while (element && element !== document.body && element !== document.documentElement) {
    const overflowY = window.getComputedStyle(element).overflowY;
    const acceptsVerticalScroll = element.hasAttribute("data-tv-scroll") || overflowY === "auto" || overflowY === "scroll";
    if (acceptsVerticalScroll && element.scrollHeight > element.clientHeight + 2) return element;
    element = element.parentElement;
  }
  return null;
}

function revealElement(element: HTMLElement) {
  let ancestor = element.parentElement;

  while (ancestor && ancestor !== document.body && ancestor !== document.documentElement) {
    if (isKnownScrollContainer(ancestor) && canScroll(ancestor)) {
      const itemRect = element.getBoundingClientRect();
      const containerRect = ancestor.getBoundingClientRect();
      let left = 0;
      let top = 0;

      if (itemRect.left < containerRect.left + EDGE_PADDING) {
        left = itemRect.left - containerRect.left - EDGE_PADDING;
      } else if (itemRect.right > containerRect.right - EDGE_PADDING) {
        left = itemRect.right - containerRect.right + EDGE_PADDING;
      }

      if (itemRect.top < containerRect.top + EDGE_PADDING) {
        top = itemRect.top - containerRect.top - EDGE_PADDING;
      } else if (itemRect.bottom > containerRect.bottom - EDGE_PADDING) {
        top = itemRect.bottom - containerRect.bottom + EDGE_PADDING;
      }

      if (left !== 0 || top !== 0) {
        ancestor.scrollBy({ left, top, behavior: "auto" });
      }
    }
    ancestor = ancestor.parentElement;
  }

  const rect = element.getBoundingClientRect();
  const viewportTop = 116;
  const viewportBottom = window.innerHeight - 132;
  let top = 0;

  if (rect.top < viewportTop) {
    top = rect.top - viewportTop;
  } else if (rect.bottom > viewportBottom) {
    top = rect.bottom - viewportBottom;
  }

  if (top !== 0) {
    window.scrollBy({ top, behavior: "auto" });
  }
}

function focusElement(element: HTMLElement) {
  element.focus({ preventScroll: true });
  revealElement(element);
}

function bestCandidate(active: HTMLElement, candidates: HTMLElement[], direction: Direction): HTMLElement | null {
  const currentRect = active.getBoundingClientRect();
  let next: HTMLElement | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    if (candidate === active) continue;
    const score = directionalScore(currentRect, candidate.getBoundingClientRect(), direction);
    if (score < bestScore) {
      bestScore = score;
      next = candidate;
    }
  }

  return next;
}

function globalElements(scope: ParentNode): HTMLElement[] {
  return potentialElements(scope)
    .filter(element => !element.closest("[data-tv-section], [data-tv-grid]"))
    .filter(isVisible);
}

function nearestZone(active: HTMLElement, scope: ParentNode, direction: Direction): HTMLElement | null {
  const currentRect = active.getBoundingClientRect();
  let best: HTMLElement | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const zone of Array.from(scope.querySelectorAll<HTMLElement>("[data-tv-section], [data-tv-grid]"))) {
    const score = directionalScore(currentRect, zone.getBoundingClientRect(), direction);
    if (score < bestScore) {
      bestScore = score;
      best = zone;
    }
  }

  return best;
}

function adjacentSection(active: HTMLElement, scope: ParentNode, direction: Direction): HTMLElement | null {
  const current = active.closest<HTMLElement>("[data-tv-section]");
  if (!current || (direction !== "up" && direction !== "down")) return null;

  const sections = Array.from(scope.querySelectorAll<HTMLElement>("[data-tv-section]"));
  const index = sections.indexOf(current);
  if (index < 0) return null;
  return sections[index + (direction === "down" ? 1 : -1)] || null;
}

function gridTarget(active: HTMLElement, direction: Direction): HTMLElement | null | undefined {
  const grid = active.closest<HTMLElement>("[data-tv-grid]");
  if (!grid) return undefined;

  const items = potentialElements(grid).filter(element => element.closest("[data-tv-grid]") === grid);
  const index = items.indexOf(active);
  if (index < 0) return undefined;

  const columns = Math.max(1, window.getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length);
  const column = index % columns;
  let targetIndex = -1;

  if (direction === "left" && column > 0) targetIndex = index - 1;
  if (direction === "right" && column < columns - 1) targetIndex = index + 1;
  if (direction === "up") targetIndex = index - columns;
  if (direction === "down") targetIndex = index + columns;

  const target = items[targetIndex];
  return target && isVisible(target) ? target : null;
}

function firstFocusable(scope: ParentNode): HTMLElement | null {
  const preferred = scope.querySelector<HTMLElement>("[data-tv-default-focus]");
  if (preferred && isVisible(preferred)) return preferred;

  if (scope !== document) return potentialElements(scope).find(isVisible) || null;

  const global = globalElements(scope)[0];
  if (global) return global;

  const firstZone = scope.querySelector<HTMLElement>("[data-tv-section], [data-tv-grid]");
  return firstZone ? visibleElements(firstZone)[0] || null : null;
}

function explicitTarget(active: HTMLElement, scope: ParentNode, direction: Direction): HTMLElement | null | undefined {
  const selector = active.getAttribute(`data-tv-${direction}`);
  if (!selector) return undefined;
  if (selector === "none") return null;

  try {
    const target = scope.querySelector<HTMLElement>(selector);
    return target && isVisible(target) ? target : null;
  } catch {
    return null;
  }
}

function moveFocus(direction: Direction) {
  const scope = activeScope();
  const active = document.activeElement instanceof HTMLElement && isVisible(document.activeElement)
    ? document.activeElement
    : null;

  if (!active || !scope.contains(active)) {
    const first = firstFocusable(scope);
    if (!first) return false;
    focusElement(first);
    return true;
  }

  const declaredTarget = explicitTarget(active, scope, direction);
  if (declaredTarget !== undefined) {
    if (!declaredTarget) return false;
    focusElement(declaredTarget);
    return true;
  }

  const activeGrid = active.closest<HTMLElement>("[data-tv-grid]");
  if (activeGrid) {
    const target = gridTarget(active, direction);
    if (target) {
      focusElement(target);
      return true;
    }
    if (direction === "left" || direction === "right") return false;
  }

  const activeRow = active.closest<HTMLElement>("[data-tv-row]");
  if (activeRow && (direction === "left" || direction === "right")) {
    const target = bestCandidate(active, visibleElements(activeRow), direction);
    if (!target) return false;
    focusElement(target);
    return true;
  }

  // A fixed bottom navigation bar can be geometrically closer than content
  // immediately below an off-screen section. Always enter the adjacent visual
  // section first so Down from the hero lands in Your Queue, not in the nav.
  const adjacent = adjacentSection(active, scope, direction);
  if (adjacent) {
    const target = bestCandidate(active, visibleElements(adjacent), direction) || firstFocusable(adjacent);
    if (target) {
      focusElement(target);
      return true;
    }
  }

  let candidates: HTMLElement[];
  if (scope !== document) {
    candidates = nearbyVisibleElements(scope, active);
  } else {
    const targetZone = nearestZone(active, scope, direction);
    candidates = [
      ...globalElements(scope),
      ...(targetZone ? visibleElements(targetZone) : [])
    ];
  }

  const next = bestCandidate(active, candidates, direction);
  if (!next) return false;
  focusElement(next);
  return true;
}

export function installTvNavigation(): () => void {
  if (typeof window === "undefined") return () => undefined;

  const emulateTv = new URLSearchParams(window.location.search).get("tv") === "1";
  if (!isWebOSTV() && !emulateTv) return () => undefined;

  document.documentElement.classList.add("tv-mode");

  let lastMoveAt = 0;
  let lastDirection: Direction | null = null;
  let focusFrame: number | null = null;

  const ensureFocusInActiveScope = () => {
    if (focusFrame !== null) window.cancelAnimationFrame(focusFrame);
    focusFrame = window.requestAnimationFrame(() => {
      focusFrame = null;
      const scope = activeScope();
      const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (active && scope.contains(active) && isVisible(active)) return;

      const first = firstFocusable(scope);
      if (first) focusElement(first);
    });
  };

  const onPointer = () => document.documentElement.classList.remove("tv-remote-active");
  const onPointerDown = (event: MouseEvent) => {
    onPointer();
    if (!(event.target instanceof Element)) return;
    const focusable = event.target.closest<HTMLElement>(FOCUSABLE_SELECTOR);
    if (focusable && isVisible(focusable)) focusElement(focusable);
  };
  const onWheel = (event: WheelEvent) => {
    onPointer();
    if (!(event.target instanceof Element)) return;
    if (shouldDeferWheelToSyncedCarousel(event.target)) return;

    const row = event.target.closest<HTMLElement>("[data-tv-row]");
    if (row && row.scrollWidth > row.clientWidth + 2) {
      const left = horizontalWheelDelta(event.deltaX, event.deltaY, event.deltaMode, row.clientWidth);
      const maximumLeft = Math.max(0, row.scrollWidth - row.clientWidth);
      const canMove = Number.isFinite(left) && left !== 0 && (
        left < 0 ? row.scrollLeft > 0 : row.scrollLeft < maximumLeft - 1
      );

      if (canMove) {
        row.scrollBy({ left, behavior: "auto" });
        event.preventDefault();
        event.stopPropagation();
        return;
      }
    }

    const top = wheelDeltaPixels(event.deltaY, event.deltaMode, window.innerHeight);
    if (!Number.isFinite(top) || top === 0) return;

    const container = verticalScrollContainer(event.target);
    if (container) {
      const maximumTop = Math.max(0, container.scrollHeight - container.clientHeight);
      const canMove = top < 0 ? container.scrollTop > 0 : container.scrollTop < maximumTop - 1;
      if (canMove) {
        container.scrollBy({ top, behavior: "auto" });
        event.preventDefault();
        event.stopPropagation();
        return;
      }
    }

    const page = document.scrollingElement;
    if (!page) return;
    const maximumPageTop = Math.max(0, page.scrollHeight - page.clientHeight);
    const canMovePage = top < 0 ? page.scrollTop > 0 : page.scrollTop < maximumPageTop - 1;
    if (!canMovePage) return;

    window.scrollBy({ top, behavior: "auto" });
    event.preventDefault();
    event.stopPropagation();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    document.documentElement.classList.add("tv-remote-active");
    const direction = DIRECTION_KEYS[event.keyCode || event.which];
    if (
      !direction
      || event.altKey
      || event.ctrlKey
      || event.metaKey
      || shouldUseNativeDirectionalNavigation(document.activeElement, direction)
    ) return;

    const activeElement = document.activeElement;
    const hasHorizontalHandler = activeElement instanceof HTMLElement && activeElement.hasAttribute("data-tv-horizontal-handler");
    if (shouldDelegateHorizontalNavigation(direction, hasHorizontalHandler)) return;

    const now = performance.now();
    if (direction === lastDirection && now - lastMoveAt < REPEAT_THROTTLE_MS) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    lastMoveAt = now;
    lastDirection = direction;

    moveFocus(direction);
    event.preventDefault();
    event.stopPropagation();
  };

  window.addEventListener("mousemove", onPointer, { passive: true });
  window.addEventListener("mousedown", onPointerDown, true);
  window.addEventListener("wheel", onWheel, { passive: false, capture: true });
  window.addEventListener("keydown", onKeyDown, true);

  const focusObserver = typeof MutationObserver !== "undefined"
    ? new MutationObserver(ensureFocusInActiveScope)
    : null;
  focusObserver?.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-hidden", "aria-modal", "hidden", "role"]
    });

  window.setTimeout(() => {
    ensureFocusInActiveScope();
  }, 250);

  return () => {
    window.removeEventListener("mousemove", onPointer);
    window.removeEventListener("mousedown", onPointerDown, true);
    window.removeEventListener("wheel", onWheel, true);
    window.removeEventListener("keydown", onKeyDown, true);
    focusObserver?.disconnect();
    if (focusFrame !== null) window.cancelAnimationFrame(focusFrame);
    document.documentElement.classList.remove("tv-mode", "tv-remote-active");
  };
}
