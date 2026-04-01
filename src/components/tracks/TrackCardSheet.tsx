"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useExpandedCard } from "@/store/expandedCard";
import ExpandedCardContent from "./ExpandedCardContent";

/**
 * Mobile full-screen bottom sheet for the expanded track/beat card detail.
 * Render one instance anywhere inside a page that has cards.
 * Only visible on mobile (< 768px) and only when expandedData is set.
 * Swipe-down or tap the backdrop to dismiss.
 */
export function TrackCardSheet() {
  const { expandedData, close } = useExpandedCard();

  // Lock body scroll while sheet is open
  useEffect(() => {
    if (!expandedData) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [!!expandedData]);

  // Close on Escape key
  useEffect(() => {
    if (!expandedData) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [!!expandedData, close]);

  // Only render on client + mobile
  if (typeof window === "undefined") return null;
  if (window.innerWidth >= 768) return null;

  return createPortal(
    <AnimatePresence>
      {expandedData && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-[998]"
            style={{ backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={close}
          />

          {/* Sheet */}
          <motion.div
            key="sheet"
            className="fixed bottom-0 left-0 right-0 z-[999] rounded-t-2xl overflow-hidden"
            style={{
              backgroundColor: "#0f0f0f",
              maxHeight: "92dvh",
              overflowY: "auto",
            }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 32 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.3 }}
            onDragEnd={(_e, info) => {
              // Swipe-down to close: velocity > 400 or dragged > 100px down
              if (info.velocity.y > 400 || info.offset.y > 100) close();
            }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.2)" }} />
            </div>

            <ExpandedCardContent data={expandedData} onClose={close} />
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
