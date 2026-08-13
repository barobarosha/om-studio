// UTM-контекст: сохраняем параметры первого визита и отдаём вместе с лидом.

const KEY = "om_utm_first";
const KEY_LAST = "om_utm_last";
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "yclid"];

export function captureUtm() {
  try {
    const params = new URLSearchParams(window.location.search);
    const found: Record<string, string> = {};
    for (const k of UTM_KEYS) {
      const v = params.get(k);
      if (v) found[k] = v;
    }
    if (Object.keys(found).length) {
      localStorage.setItem(KEY_LAST, JSON.stringify(found));
      if (!localStorage.getItem(KEY)) localStorage.setItem(KEY, JSON.stringify(found));
    }
  } catch {
    /* ignore */
  }
}

export function getUtm(): Record<string, string> {
  try {
    const last = localStorage.getItem(KEY_LAST);
    const first = localStorage.getItem(KEY);
    return { ...(first ? JSON.parse(first) : {}), ...(last ? JSON.parse(last) : {}) };
  } catch {
    return {};
  }
}
