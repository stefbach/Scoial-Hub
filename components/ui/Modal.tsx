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
    /* Scrim: full-screen translucent overlay with blur — never an opaque grey box.
       Clicking the scrim (but not the panel) closes the modal. */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Panel: stops click propagation so clicking inside never closes the modal */}
      <div
        className={`relative w-full ${width} max-h-[90vh] overflow-y-auto rounded-2xl bg-card shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
