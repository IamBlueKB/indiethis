"use client";

/**
 * DesignPositioner — drag/resize a design image on a product template.
 *
 * Canvas aspect ratio is fixed at 6:7 (portrait product image).
 * All positions are stored as fractions of the canvas dimensions:
 *   x, w → fraction of canvas WIDTH  (maps to CSS left/width %)
 *   y, h → fraction of canvas HEIGHT (maps to CSS top/height %)
 *
 * Outputs Printful-compatible position coordinates on every change.
 */

import { useRef, useState, useCallback, useEffect } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Canvas width/height ratio (portrait product image). */
const CANVAS_AR = 6 / 7;

/**
 * Print area bounds as fractions of the canvas dimensions.
 * These represent the printable zone on a standard apparel image.
 * x, w → fraction of canvas WIDTH; y, h → fraction of canvas HEIGHT.
 */
const PRINT_AREA = { x: 0.18, y: 0.10, w: 0.64, h: 0.55 };

/**
 * Printful's standard print area pixel size for apparel.
 * Used to convert canvas fractions → Printful API coordinates.
 */
const PRINTFUL_W = 1800;
const PRINTFUL_H = 2400;

// ─── Types ────────────────────────────────────────────────────────────────────

export type PrintPosition = {
  area_width:  number;
  area_height: number;
  width:       number;
  height:      number;
  top:         number;
  left:        number;
};

type DesignState = {
  x: number; // left edge as fraction of canvas WIDTH
  y: number; // top  edge as fraction of canvas HEIGHT
  w: number; // width      as fraction of canvas WIDTH
};

type DragState = {
  type:       "move" | "resize";
  startX:     number;  // clientX at drag start
  startY:     number;  // clientY at drag start
  initDesign: DesignState;
  canvasW:    number;  // canvas rendered width  at drag start
  canvasH:    number;  // canvas rendered height at drag start
};

// ─── Component ────────────────────────────────────────────────────────────────

type Props = {
  productImage: string;
  designUrl:    string;
  onChange?:    (pos: PrintPosition) => void;
};

export default function DesignPositioner({ productImage, designUrl, onChange }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef   = useRef<DragState | null>(null);

  const [design,  setDesign ] = useState<DesignState | null>(null);
  const [imageAR, setImageAR] = useState(1); // natural width / height of design image

  // ── Initialize design position when image loads ──────────────────────────
  useEffect(() => {
    if (!designUrl) { setDesign(null); return; }
    const img = new Image();
    img.onload = () => {
      const ar = img.naturalWidth / img.naturalHeight || 1;
      setImageAR(ar);
      // Center design at 70% of print-area width
      const initW = PRINT_AREA.w * 0.70;
      const initH = initW * CANVAS_AR / ar; // fraction of canvas HEIGHT
      setDesign({
        x: PRINT_AREA.x + (PRINT_AREA.w - initW) / 2,
        y: PRINT_AREA.y + (PRINT_AREA.h - initH) / 2,
        w: initW,
      });
    };
    img.src = designUrl;
  }, [designUrl]);

  // Design height as fraction of canvas HEIGHT
  const designH = design ? design.w * CANVAS_AR / imageAR : 0;

  // ── Emit Printful coordinates whenever design moves/resizes ─────────────
  useEffect(() => {
    if (!design || !onChange) return;
    const h = design.w * CANVAS_AR / imageAR;
    onChange({
      area_width:  PRINTFUL_W,
      area_height: PRINTFUL_H,
      width:  Math.round((design.w / PRINT_AREA.w) * PRINTFUL_W),
      height: Math.round((h / PRINT_AREA.h)        * PRINTFUL_H),
      left:   Math.round(((design.x - PRINT_AREA.x) / PRINT_AREA.w) * PRINTFUL_W),
      top:    Math.round(((design.y - PRINT_AREA.y) / PRINT_AREA.h) * PRINTFUL_H),
    });
  }, [design, imageAR, onChange]);

  // ── Pointer drag handlers ─────────────────────────────────────────────────
  const startDrag = useCallback((
    e: React.PointerEvent,
    type: "move" | "resize",
  ) => {
    if (!design || !canvasRef.current) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = canvasRef.current.getBoundingClientRect();
    const state: DragState = {
      type,
      startX:     e.clientX,
      startY:     e.clientY,
      initDesign: { ...design },
      canvasW:    rect.width,
      canvasH:    rect.height,
    };
    dragRef.current = state;

    function onMove(ev: PointerEvent) {
      const d = dragRef.current;
      if (!d) return;
      const dx = (ev.clientX - d.startX) / d.canvasW;
      const dy = (ev.clientY - d.startY) / d.canvasH;

      if (d.type === "move") {
        setDesign({ ...d.initDesign, x: d.initDesign.x + dx, y: d.initDesign.y + dy });
      } else {
        // Resize: horizontal drag, aspect ratio locked
        const rawW = d.initDesign.w + (ev.clientX - d.startX) / d.canvasW;
        setDesign({ ...d.initDesign, w: Math.max(0.08, rawW) });
      }
    }

    function onUp() {
      dragRef.current = null;
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup",   onUp);
    }

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup",   onUp);
  }, [design]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      ref={canvasRef}
      className="relative w-full rounded-2xl overflow-hidden select-none touch-none"
      style={{ aspectRatio: "6/7", backgroundColor: "#f0ede8" }}
    >
      {/* Product background */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={productImage}
        alt="Product preview"
        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
        draggable={false}
      />

      {/* Print area indicator */}
      <div
        className="absolute pointer-events-none rounded"
        style={{
          left:            `${PRINT_AREA.x * 100}%`,
          top:             `${PRINT_AREA.y * 100}%`,
          width:           `${PRINT_AREA.w * 100}%`,
          height:          `${PRINT_AREA.h * 100}%`,
          border:          "1px dashed rgba(212,168,67,0.55)",
          backgroundColor: "rgba(212,168,67,0.04)",
        }}
      />
      <div
        className="absolute pointer-events-none text-[9px] font-semibold px-1 py-0.5 rounded"
        style={{
          left:            `${PRINT_AREA.x * 100}%`,
          top:             `calc(${PRINT_AREA.y * 100}% - 15px)`,
          backgroundColor: "rgba(212,168,67,0.15)",
          color:           "#D4A843",
        }}
      >
        Print area
      </div>

      {/* Design overlay */}
      {design && (
        <div
          className="absolute cursor-grab active:cursor-grabbing"
          style={{
            left:          `${design.x * 100}%`,
            top:           `${design.y * 100}%`,
            width:         `${design.w * 100}%`,
            height:        `${designH  * 100}%`,
            outline:       "1.5px dashed rgba(212,168,67,0.9)",
            outlineOffset: 2,
          }}
          onPointerDown={(e) => startDrag(e, "move")}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={designUrl}
            alt="Your design"
            className="w-full h-full object-contain pointer-events-none"
            draggable={false}
          />

          {/* Resize handle — bottom-right corner */}
          <div
            className="absolute bottom-0 right-0 w-4 h-4 rounded-full cursor-se-resize z-10"
            style={{
              backgroundColor: "#D4A843",
              transform:       "translate(50%, 50%)",
              border:          "2px solid white",
              boxShadow:       "0 1px 4px rgba(0,0,0,0.4)",
            }}
            onPointerDown={(e) => startDrag(e, "resize")}
          />
        </div>
      )}

      {/* Instructions overlay — shown when no design yet */}
      {!design && !designUrl && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-xs text-muted-foreground opacity-60">Upload a design to position it</p>
        </div>
      )}
    </div>
  );
}
