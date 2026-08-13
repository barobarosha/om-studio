// Кастомный курсор: тёмная точка + бронзовое кольцо, виден на любом фоне.
import { useEffect, useRef } from "react";

export function Cursor() {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const move = (e: MouseEvent) => {
      if (dot.current) dot.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      if (ring.current) {
        ring.current.animate(
          { transform: `translate(${e.clientX}px, ${e.clientY}px)` },
          { duration: 350, fill: "forwards", easing: "cubic-bezier(.22,1,.36,1)" },
        );
      }
      const t = e.target as HTMLElement;
      const interactive = t.closest("a,button,label,input,select,textarea");
      ring.current?.classList.toggle("cursor-ring--active", !!interactive);
    };
    window.addEventListener("mousemove", move, { passive: true });
    return () => window.removeEventListener("mousemove", move);
  }, []);
  return (
    <div className="hidden lg:block pointer-events-none fixed inset-0 z-[100]">
      {/* точка с белой обводкой — видна и на тёмном, и на светлом фоне */}
      <div ref={dot} className="absolute -left-[4px] -top-[4px] w-2 h-2 rounded-full bg-[#1a1a1a] ring-1 ring-white/80" />
      <div ref={ring} className="cursor-ring absolute -left-[17px] -top-[17px] w-9 h-9 rounded-full border-2 border-[#a3966f] transition-all duration-200" />
    </div>
  );
}
