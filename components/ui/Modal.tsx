"use client";

export function Modal({
  open,
  onClose,
  children,
  width = "max-w-2xl",
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-ink/40 p-6 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      <div className={`relative z-50 my-4 w-full ${width} rounded-lg border-hair bg-card shadow-xl`}>
        {children}
      </div>
    </div>
  );
}
