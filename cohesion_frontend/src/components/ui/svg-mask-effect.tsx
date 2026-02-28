"use client";
import { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export const MaskContainer = ({
  children,
  revealText,
  size = 10,
  revealSize = 500,
  className,
  overlayContent,
}: {
  children?: string | React.ReactNode;
  revealText?: string | React.ReactNode;
  size?: number;
  revealSize?: number;
  className?: string;
  overlayContent?: React.ReactNode;
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: -999, y: -999 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setMousePosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };

    // Use window-level listener so it works immediately on navigation
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  const maskSize = isHovered ? revealSize : size;

  return (
    <div
      ref={containerRef}
      className={cn("relative h-screen", className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Base visible layer */}
      <div className="absolute inset-0 h-full w-full">
        {revealText}
      </div>

      {/* Mask reveal layer - follows cursor */}
      <motion.div
        className="absolute inset-0 h-full w-full bg-[#111116] [mask-image:url(/mask.svg)] [mask-repeat:no-repeat] [mask-size:40px]"
        animate={{
          maskPosition: `${mousePosition.x - maskSize / 2}px ${
            mousePosition.y - maskSize / 2
          }px`,
          maskSize: `${maskSize}px`,
        }}
        transition={{
          maskSize: { duration: 0.3, ease: "easeInOut" },
          maskPosition: { duration: 0, ease: "linear" },
        }}
        style={{ pointerEvents: "none" }}
      >
        <div className="absolute inset-0 h-full w-full bg-[#111116]" />
        <div className="relative h-full w-full">
          {children}
        </div>
      </motion.div>

      {/* Overlay content (e.g. sign-in card) - always on top and clickable */}
      {overlayContent && (
        <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
          {overlayContent}
        </div>
      )}
    </div>
  );
};
