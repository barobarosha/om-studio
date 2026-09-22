// Иконка мессенджера MAX в стилистике lucide: речевой пузырь с «хвостиком» (тонкий контур, без заливки)
export function MaxIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* круглый пузырь с хвостиком вниз влево */}
      <path d="M12 3.5c4.97 0 9 3.58 9 8s-4.03 8-9 8c-.86 0-1.7-.1-2.48-.3L5 20.9l1.1-2.9C4.1 16.6 3 14.16 3 11.5c0-4.42 4.03-8 9-8Z" />
      {/* две точки-«глаза», отсылка к знаку MAX */}
      <circle cx="9" cy="11.5" r="0.4" fill="currentColor" />
      <circle cx="15" cy="11.5" r="0.4" fill="currentColor" />
    </svg>
  );
}
