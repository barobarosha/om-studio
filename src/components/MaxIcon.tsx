// Иконка мессенджера MAX в стилистике lucide (тонкий контур, без заливки)
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
      {/* речевой пузырь в форме буквы-завитка, характерной для MAX */}
      <path d="M19 19.5c-1.7 1.6-4.1 2.5-6.6 2.5C7 22 3 17.97 3 12.5 3 7.5 6.8 3.5 12 3.5S21 7.5 21 12.5c0 2.6-1.2 5-3.2 6.6" />
      <path d="M3.5 21.5c1-2 2-3.6 3.5-4.6" />
      <circle cx="12" cy="12.5" r="0.5" fill="currentColor" />
    </svg>
  );
}
