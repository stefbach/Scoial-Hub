"use client";

import { useEffect, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import { format } from "date-fns";
import "react-day-picker/style.css";

export function DatePicker({
  value,
  onChange,
}: {
  value: Date;
  onChange: (d: Date) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full rounded-md border-hair border-hair bg-card px-3 py-2 text-left text-sm text-ink hover:bg-canvas focus:outline-none"
      >
        {format(value, "EEE, d MMM yyyy")}
      </button>
      {open && (
        /* z-[9999] pour sortir de tout stacking context parent (modales, etc.)
           overflow-y-auto + max-h pour rester entièrement visible dans le viewport */
        <div className="absolute z-[9999] mt-1 max-h-[min(360px,80vh)] overflow-y-auto rounded-md border border-hair bg-card p-2 shadow-xl">
          <DayPicker
            mode="single"
            selected={value}
            onSelect={(d) => {
              if (d) {
                onChange(d);
                setOpen(false);
              }
            }}
            defaultMonth={value}
            className="[--rdp-accent-color:theme(colors.page)] [--rdp-accent-background-color:theme(colors.ai.textbg)]"
            styles={{ caption: { fontSize: "0.8rem" }, day: { fontSize: "0.8rem" } }}
          />
        </div>
      )}
    </div>
  );
}

export function TimePicker({
  value,
  onChange,
}: {
  value: string; // "HH:mm"
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [h, m] = value.split(":");

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  const minutes = ["00", "15", "30", "45"];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full rounded-md border-hair border-hair bg-card px-3 py-2 text-left text-sm text-ink hover:bg-canvas focus:outline-none"
      >
        {value}
      </button>
      {open && (
        <div className="absolute z-[9999] mt-1 flex gap-1 rounded-md border border-hair bg-card p-2 shadow-xl">
          <div className="h-40 w-14 overflow-y-auto">
            {hours.map((hr) => (
              <button
                key={hr}
                type="button"
                onClick={() => onChange(`${hr}:${m}`)}
                className={`block w-full rounded px-2 py-1 text-center text-xs ${
                  hr === h ? "bg-ai-textbg font-medium text-ai-text" : "text-ink hover:bg-canvas"
                }`}
              >
                {hr}
              </button>
            ))}
          </div>
          <div className="h-40 w-14 overflow-y-auto">
            {minutes.map((mn) => (
              <button
                key={mn}
                type="button"
                onClick={() => {
                  onChange(`${h}:${mn}`);
                  setOpen(false);
                }}
                className={`block w-full rounded px-2 py-1 text-center text-xs ${
                  mn === m ? "bg-ai-textbg font-medium text-ai-text" : "text-ink hover:bg-canvas"
                }`}
              >
                {mn}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
