// Обёртка над Яндекс Метрикой: цели не падают, если счётчик не подключён.
import { SITE } from "./config";

export function ymGoal(goal: string, params?: Record<string, unknown>) {
  try {
    const w = window as any;
    if (SITE.ymId && typeof w.ym === "function") {
      w.ym(Number(SITE.ymId), "reachGoal", goal, params);
    }
  } catch {
    /* ignore */
  }
}

export function ymHit(url?: string) {
  try {
    const w = window as any;
    if (SITE.ymId && typeof w.ym === "function") {
      w.ym(Number(SITE.ymId), "hit", url ?? window.location.href);
    }
  } catch {
    /* ignore */
  }
}
