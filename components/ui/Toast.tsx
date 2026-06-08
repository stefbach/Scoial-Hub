"use client";

import { useEffect } from "react";

export function Toast({
  message,
  onDismiss,
  durationMs = 4000,
}: {
  message: string;
  onDismiss: () => void;
  durationMs?: number;
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(t);
  }, [onDismiss, durationMs]);

  return (
    <div className="fixed bottom-6 left-1/2 z-50 w-[min(22rem,calc(100vw-1.5rem))] -translate-x-1/2 px-2">
      <div role="status" aria-live="polite" className="rounded-md border-hair bg-ink px-4 py-2 text-center text-sm text-white shadow-lg">
        {message}
      </div>
    </div>
  );
}
