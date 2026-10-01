import { useEffect, useRef, useSyncExternalStore } from "react";
import { getAmbientArtwork, subscribeAmbientArtwork } from "../lib/ambientArtwork";

// The glow is painted from a tiny, pre-blurred copy of the artwork. Stretching
// a 64x36 image across the screen gives a soft wash of its colours, and the TV
// only has to fade between two still images, which costs almost nothing. (A
// live CSS blur over the whole screen would be too heavy for the TV.)
const AMBIENT_WIDTH = 64;
const AMBIENT_HEIGHT = 36;
const OVERSCAN = 6;

function paintAmbientCanvas(canvas: HTMLCanvasElement, image: HTMLImageElement): boolean {
  let context: CanvasRenderingContext2D | null = null;
  try {
    context = canvas.getContext("2d");
  } catch {
    return false;
  }
  if (!context) return false;
  try {
    context.clearRect(0, 0, AMBIENT_WIDTH, AMBIENT_HEIGHT);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    if ("filter" in context) context.filter = "blur(3px) saturate(1.35)";
    // Draw slightly larger than the canvas so the blur never pulls in empty edges.
    context.drawImage(image, -OVERSCAN, -OVERSCAN, AMBIENT_WIDTH + OVERSCAN * 2, AMBIENT_HEIGHT + OVERSCAN * 2);
    if ("filter" in context) context.filter = "none";
    return true;
  } catch {
    return false;
  }
}

/**
 * The soft colour glow behind Next Up. It takes on the colours of the title
 * you have settled on and slowly fades to the next one.
 */
export function AmbientBackdrop({ active }: { active: boolean }) {
  const artwork = useSyncExternalStore(subscribeAmbientArtwork, getAmbientArtwork, () => null);
  const firstCanvasRef = useRef<HTMLCanvasElement>(null);
  const secondCanvasRef = useRef<HTMLCanvasElement>(null);
  const frontIndexRef = useRef<0 | 1>(0);
  const requestTokenRef = useRef(0);

  useEffect(() => {
    const token = ++requestTokenRef.current;
    const canvases = [firstCanvasRef.current, secondCanvasRef.current] as const;
    if (!active || !artwork || typeof Image === "undefined") {
      canvases.forEach(canvas => canvas?.setAttribute("data-ambient-visible", "false"));
      return;
    }

    const image = new Image();
    image.decoding = "async";
    image.referrerPolicy = "no-referrer";
    image.onload = () => {
      if (token !== requestTokenRef.current) return;
      const backIndex: 0 | 1 = frontIndexRef.current === 0 ? 1 : 0;
      const backCanvas = canvases[backIndex];
      if (!backCanvas || !paintAmbientCanvas(backCanvas, image)) return;
      backCanvas.setAttribute("data-ambient-visible", "true");
      canvases[frontIndexRef.current]?.setAttribute("data-ambient-visible", "false");
      frontIndexRef.current = backIndex;
    };
    image.src = artwork;

    return () => {
      image.onload = null;
    };
  }, [active, artwork]);

  return (
    <div data-tv-ambient="true" data-ambient-active={active ? "true" : "false"} aria-hidden="true">
      <canvas ref={firstCanvasRef} width={AMBIENT_WIDTH} height={AMBIENT_HEIGHT} data-ambient-visible="false" />
      <canvas ref={secondCanvasRef} width={AMBIENT_WIDTH} height={AMBIENT_HEIGHT} data-ambient-visible="false" />
      <div data-tv-ambient-shade="true" />
    </div>
  );
}

