// Конфигурация сайта: контакты, Метрика, мессенджеры.
// ID счётчика Яндекс Метрики заменяется здесь, без правки компонентов.

export const SITE = {
  name: "ОМ Студия",
  catalogName: "Керамогранит и плитка — ОМ Студия",
  domain: "plitka.om-studio.pro",
  baseSite: "https://om-studio.pro",
  phone: "+7 (499) 995-26-17",
  phoneHref: "tel:+74999952617",
  email: "omstudio@srpremium.ru",
  showroom: {
    name: "Шоурум ОМ Студия в Artplay",
    address: "Москва, Нижняя Сыромятническая ул., 10, стр. 3, вход 3В, 2 этаж (центр дизайна Artplay)",
    // по дням недели — выводится построчно
    hoursLines: [
      { days: "Пн–Чт", time: "10:00–20:00" },
      { days: "Пт", time: "10:00–18:00" },
      { days: "Сб", time: "11:30–18:00" },
      { days: "Вс", time: "выходной" },
    ],
    hours: "Пн–Чт: 10:00–20:00 · Пт: 10:00–18:00 · Сб: 11:30–18:00 · Вс — выходной",
  },
  messengers: {
    telegram: "https://t.me/omstudio_pro",
    whatsapp: "https://wa.me/74999952617",
    max: "https://max.ru/u/omstudio",
  },
  // ID счётчика Яндекс Метрики — подставляется при запуске
  ymId: (import.meta as any).env?.VITE_YM_ID ?? "",
};

// Имена событий Метрики (согласованы с ТЗ)
export const YM_EVENTS = {
  leadCallback: "lead_callback",
  leadAvailability: "lead_availability",
  leadConsultation: "lead_consultation",
  leadProject: "lead_project",
  clickPhone: "click_phone",
  clickTelegram: "click_telegram",
  clickWhatsapp: "click_whatsapp",
  clickMax: "click_max",
  search: "search",
  filterApply: "filter_apply",
  productView: "product_view",
  formOpen: "form_open",
} as const;
