"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

export function CopyButton({ text, children, className = "", label = "Copy code" }: {
  text: string;
  children?: ReactNode;
  className?: string;
  label?: string;
}) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const request = useRef(0);
  const maskId = useId();
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    setStatus("idle");
    return () => {
      clearTimeout(timer.current);
      request.current++;
    };
  }, [text]);

  async function copy() {
    const currentRequest = ++request.current;
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(text);
      if (currentRequest !== request.current) return;
      setStatus("copied");
    } catch {
      if (currentRequest !== request.current) return;
      setStatus("error");
    }
    timer.current = setTimeout(() => setStatus("idle"), 1800);
  }

  const message = status === "copied" ? "Copied" : status === "error" ? "Could not copy. Select and copy the code." : label;
  const copied = status === "copied";
  const dimensions = { width: copied ? 14.5 : 10.5, height: copied ? 14.5 : 10.5, rx: copied ? 7.25 : 2 };
  const front = { ...dimensions, x: 4.75, y: copied ? 4.75 : 8.75 };
  const back = { ...dimensions, x: copied ? 4.75 : 8.75, y: 4.75 };
  const transition = { duration: reducedMotion ? 0 : 0.18, ease: [0.2, 0.8, 0.2, 1] as const };

  return (
    <button type="button" className={`docs-copy ${className}`} onClick={copy} aria-label={message} title={message}>
      {children}
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <motion.rect initial={false} animate={front} transition={transition} />
        <g mask={`url(#${maskId})`}>
          <motion.rect initial={false} animate={back} transition={transition} />
        </g>
        <motion.path initial={false} animate={{ opacity: copied ? 1 : 0, pathLength: copied ? 1 : 0 }} transition={{ opacity: { duration: 0.12 }, pathLength: { duration: copied && !reducedMotion ? 0.12 : 0, delay: copied || reducedMotion ? 0 : 0.12 } }} d="M9.25 12.25 11 14.25 15 10" />
        <mask id={maskId} maskUnits="userSpaceOnUse">
          <rect width="24" height="24" fill="white" stroke="none" />
          <motion.rect initial={false} animate={front} transition={transition} fill="black" stroke="black" />
        </mask>
      </svg>
      <span className="docs-sr-only" role="status">{status === "idle" ? "" : message}</span>
    </button>
  );
}
