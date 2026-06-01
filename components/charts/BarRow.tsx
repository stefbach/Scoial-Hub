export function BarRow({
  label,
  value,
  max,
  color,
  caption,
  muted = false,
  onClick,
  title,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  caption: string;
  muted?: boolean;
  onClick?: () => void;
  title?: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const content = (
    <>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className={muted ? "text-muted" : "text-ink"}>{label}</span>
        <span className={muted ? "text-muted" : "text-ink"}>{caption}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-hair">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title}
        className="mb-3 block w-full cursor-pointer rounded-md p-1 text-left transition-colors hover:bg-canvas"
      >
        {content}
      </button>
    );
  }

  return <div className="mb-3">{content}</div>;
}
