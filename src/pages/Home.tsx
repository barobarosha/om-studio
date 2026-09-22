import { useEffect, useState } from "react";
import { Link } from "react-router";
import { trpc } from "@/providers/trpc";
import { ProductCard } from "@/components/ProductCard";
import { LeadModal } from "@/components/LeadModal";
import type { LeadType } from "@/components/LeadModal";
import { SITE } from "@/lib/config";
import { Truck, Scissors, Warehouse, ImageIcon, Handshake, Car, ArrowRight, MapPin } from "lucide-react";

const ADVANTAGES = [
  { icon: Warehouse, n: "01", title: "Складская программа", text: "Более 12 тыс. популярных позиций от европейских производителей в наличии на складе в Москве." },
  { icon: Scissors, n: "02", title: "Собственное производство", text: "Резка керамогранита и изготовление изделий: столешницы, фартуки, раковины, облицовка кухонь." },
  { icon: Truck, n: "03", title: "Доставка и подъём", text: "Организуем доставку на объект и подъём на этаж. Условия рассчитываются под ваш заказ." },
  { icon: ImageIcon, n: "04", title: "Подбор по визуализации", text: "Пришлите рендер или фото интерьера — подберём материалы под ваш дизайн-проект." },
  { icon: Handshake, n: "05", title: "Программа для дизайнеров", text: "Партнёрские условия для архитекторов и дизайнеров интерьеров." },
  { icon: Car, n: "06", title: "Выезд с образцами на объект", text: "Привозим образцы на примерку бесплатно по вашему запросу." },
];

export default function Home() {
  const [lead, setLead] = useState<LeadType | null>(null);
  const stats = trpc.catalog.stats.useQuery();
  const inStock = trpc.catalog.list.useQuery({ inStockOnly: true, sort: "stock", perPage: 8 });
  const brands = trpc.brands.list.useQuery();
  const hero = trpc.catalog.heroImages.useQuery();
  const [slide, setSlide] = useState(0);
  const slides = hero.data ?? [];

  useEffect(() => {
    if (slides.length < 2) return;
    const t = setInterval(() => setSlide((s) => (s + 1) % slides.length), 4500);
    return () => clearInterval(t);
  }, [slides.length]);

  return (
    <div>
      {/* Первый экран: полноширинная карусель интерьерных фото */}
      <section className="relative h-[82vh] min-h-[540px] overflow-hidden bg-black text-white">
        {slides.map((s, i) => (
          <div
            key={s.url + i}
            className={`absolute inset-0 transition-opacity duration-[1200ms] ${i === slide ? "opacity-100" : "opacity-0"}`}
          >
            <img
              src={s.url}
              alt={s.name}
              className={`w-full h-full object-cover ${i === slide ? "hero-zoom" : ""}`}
              loading={i === 0 ? "eager" : "lazy"}
            />
          </div>
        ))}
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
        <div className="relative h-full max-w-7xl mx-auto px-4 flex flex-col justify-center">
          <div className="max-w-2xl">
            <div className="text-[#c4b99a] uppercase tracking-[0.3em] text-xs mb-5">ОМ Студия · Artplay, Москва</div>
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-semibold leading-[1.08] mb-6">
              Керамогранит и&nbsp;плитка от&nbsp;европейских фабрик
            </h1>
            <p className="text-white/75 text-base lg:text-lg leading-relaxed mb-8 max-w-xl">
              Более 12 тыс. позиций в наличии на складе в Москве.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/catalog" className="h-13 px-8 py-4 bg-[#c4b99a] text-black font-semibold text-sm tracking-wide hover:bg-white transition-colors flex items-center gap-2" data-ym="cta-catalog-hero">
                Перейти в каталог <ArrowRight size={16} />
              </Link>
            </div>
          </div>
          <div className="absolute bottom-8 left-4 right-4 flex items-end justify-between">
            <div className="flex gap-8 text-sm">
              <div><div className="font-display text-2xl font-semibold">15 лет</div><div className="text-white/60 text-xs">на рынке</div></div>
              <div><div className="font-display text-2xl font-semibold">12 000+</div><div className="text-white/60 text-xs">позиций в наличии</div></div>
              <div><div className="font-display text-2xl font-semibold">10 000+</div><div className="text-white/60 text-xs">реализованных проектов</div></div>
            </div>
            <div className="hidden md:flex gap-1.5">
              {slides.slice(0, 8).map((_, i) => (
                <button key={i} onClick={() => setSlide(i)} aria-label={`Слайд ${i + 1}`}
                  className={`h-[3px] rounded-full transition-all duration-500 ${i === slide ? "w-8 bg-[#c4b99a]" : "w-3 bg-white/40"}`} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Быстрые категории */}
      <section className="max-w-7xl mx-auto px-4 -mt-0 py-12">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { to: "/catalog/plitka", t: "Настенная плитка", d: "Керамическая плитка и декоры для отделки стен" },
            { to: "/catalog/keramogranit", t: "Керамогранит", d: "Напольная и настенная плитка из керамогранита" },
            { to: "/catalog/keramogranit?large=1", t: "Крупноформатный керамогранит", d: "Широкоформатные плиты от 120×120 и более" },
            { to: "/catalog?mosaic=1", t: "Мозаика", d: "Декоративные изделия для полов и стен" },
            { to: "/izdeliya", t: "Изделия из керамогранита", d: "Собственное производство столешниц, раковин, кухонных островов, подоконников из керамогранита" },
          ].map((c) => (
            <Link key={c.to} to={c.to} className="group relative bg-card border border-border p-6 overflow-hidden hover:border-[#c4b99a] transition-colors">
              <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#c4b99a] scale-y-0 group-hover:scale-y-100 origin-top transition-transform duration-300" />
              <div className="font-display text-lg font-semibold mb-1 group-hover:translate-x-1 transition-transform duration-300">{c.t}</div>
              <div className="text-xs text-muted-foreground group-hover:translate-x-1 transition-transform duration-300 delay-75">{c.d}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* В наличии */}
      <section className="max-w-7xl mx-auto px-4 pb-14">
        <div className="flex items-end justify-between mb-6">
          <div>
            <div className="text-[#a3966f] uppercase tracking-[0.25em] text-[11px] mb-2">Складская программа</div>
            <h2 className="font-display text-2xl lg:text-3xl font-semibold">Сейчас на складе</h2>
          </div>
          <Link to="/catalog?stock=1" className="text-sm border-b border-[#c4b99a] pb-0.5 hover:text-[#a3966f] transition-colors whitespace-nowrap">Перейти →</Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(inStock.data?.items ?? []).map((p) => (
            <ProductCard key={p.id} p={p as any} />
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link to="/catalog?stock=1" className="inline-flex items-center gap-2 h-12 px-10 bg-black text-white font-semibold text-sm hover:bg-[#c4b99a] hover:text-black transition-colors" data-ym="cta-catalog-stock">
            Перейти в каталог <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      {/* Преимущества */}
      <section className="bg-[#f6f3ee]">
        <div className="max-w-7xl mx-auto px-4 py-16">
          <div className="text-[#a3966f] uppercase tracking-[0.25em] text-[11px] mb-2">О нас</div>
          <h2 className="font-display text-2xl lg:text-4xl font-semibold mb-10">Почему ОМ Студия</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {ADVANTAGES.map((a) => (
              <div key={a.title} className="group relative bg-white rounded-xl border border-transparent p-7 overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_40px_-18px_rgba(120,100,60,.35)] hover:border-[#c4b99a]/60">
                <div className="absolute right-4 top-3 font-display text-5xl font-semibold text-[#c4b99a]/15 group-hover:text-[#c4b99a]/40 transition-colors duration-500 select-none">{a.n}</div>
                <div className="w-11 h-11 rounded-full bg-[#f6f3ee] group-hover:bg-[#c4b99a] flex items-center justify-center mb-4 transition-colors duration-300">
                  <a.icon size={20} strokeWidth={1.5} className="text-[#a3966f] group-hover:text-white transition-colors duration-300" />
                </div>
                <div className="font-semibold text-[15px] mb-2">{a.title}</div>
                <div className="text-sm text-foreground/60 leading-relaxed group-hover:text-foreground/85 transition-colors duration-300">{a.text}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Подбор по визуализации */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <div className="border border-border grid lg:grid-cols-2">
          <div className="p-8 lg:p-12">
            <div className="text-[#a3966f] uppercase tracking-[0.25em] text-[11px] mb-2">Для дизайн-проектов</div>
            <h2 className="font-display text-2xl lg:text-3xl font-semibold mb-3">Подбор по визуализации</h2>
            <p className="text-foreground/70 leading-relaxed mb-7">
              Пришлите изображение интерьера или дизайн-проект — менеджер подберёт керамогранит и плитку под задачу, проверит наличие и сроки.
            </p>
            <button onClick={() => setLead("project")} className="h-12 px-8 bg-black text-white font-semibold text-sm hover:bg-[#c4b99a] hover:text-black transition-colors" data-ym="cta-project">
              Отправить проект на подбор
            </button>
          </div>
          <ul className="border-t lg:border-t-0 lg:border-l border-border divide-y divide-border text-sm">
            {[
              "Загружаете рендер, фото или план",
              `Подбираем материалы из ${stats.data ? stats.data.total.toLocaleString("ru-RU") : ""} позиций каталога`,
              "Проверяем наличие и предлагаем варианты с ценами",
              "Организуем образцы, доставку и подъём",
            ].map((s, i) => (
              <li key={i} className="flex gap-4 px-8 py-5 items-center group hover:bg-accent/60 transition-colors">
                <span className="font-display text-xl text-[#a3966f]">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-foreground/80">{s}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Бренды */}
      <section className="max-w-7xl mx-auto px-4 pb-16">
        <div className="flex items-end justify-between mb-6">
          <h2 className="font-display text-2xl lg:text-3xl font-semibold">Бренды</h2>
          <Link to="/brands" className="text-sm border-b border-[#c4b99a] pb-0.5 hover:text-[#a3966f] transition-colors whitespace-nowrap">Все бренды →</Link>
        </div>
        <div className="flex flex-wrap gap-2">
          {(brands.data ?? []).slice(0, 40).map((b) => (
            <Link key={b.id} to={`/brands/${b.slug}`} className="px-4 py-2 border border-border text-sm hover:bg-black hover:text-[#c4b99a] hover:border-black transition-colors">
              {b.name}
            </Link>
          ))}
        </div>
      </section>

      {/* Шоурум */}
      <section className="bg-[#f6f3ee] border-t border-border">
        <div className="max-w-7xl mx-auto px-4 py-16 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="text-[#a3966f] uppercase tracking-[0.25em] text-[11px] mb-2">Шоурум</div>
            <h2 className="font-display text-2xl lg:text-4xl font-semibold mb-4">ОМ Студия в Artplay</h2>
            <p className="text-foreground/70 leading-relaxed mb-6">
              Приезжайте посмотреть материалы вживую: в шоуруме представлены образцы коллекций, менеджеры помогут с расчётом и комплектацией.
            </p>
            <div className="space-y-1.5 text-sm text-foreground/80 mb-7">
              <div>Москва, Нижняя Сыромятническая, 10, стр. 3</div>
              <div className="font-medium text-[#a3966f]">Вход 3В · 2 этаж</div>
              <dl className="space-y-1 pt-1">
                {SITE.showroom.hoursLines.map((h) => (
                  <div key={h.days} className="flex gap-3">
                    <dt className="w-14 shrink-0 text-muted-foreground">{h.days}</dt>
                    <dd>{h.time}</dd>
                  </div>
                ))}
              </dl>
              <a href={SITE.phoneHref} className="block font-semibold text-lg pt-1 text-[#a3966f]">{SITE.phone}</a>
            </div>
            <button onClick={() => setLead("callback")} className="h-12 px-8 bg-black text-white font-semibold text-sm hover:bg-[#c4b99a] hover:text-black transition-colors" data-ym="cta-visit-showroom">
              Запланировать визит
            </button>
          </div>
          {/* КАРТА */}
          <div>
            <div className="relative overflow-hidden rounded-xl border border-border shadow-sm" style={{ height: "384px" }}>
              <iframe
                title="ОМ Студия — Нижняя Сыромятническая, 10, стр. 3, вход 3В, 2 этаж"
                src="https://yandex.ru/map-widget/v1/?ll=37.669297%2C55.752050&z=17&pt=37.669297%2C55.752050%2Cpm2rdm"
                className="absolute inset-0 w-full h-full"
                frameBorder="0"
                allowFullScreen
                loading="lazy"
              />
              {/* Подпись на карте */}
              <div className="absolute z-10 pointer-events-none" style={{ left: "50%", top: "50%", transform: "translate(22px, -58px)" }}>
                <div className="relative bg-white px-4 py-2.5 rounded-xl shadow-[0_4px_18px_rgba(0,0,0,0.22)] border border-[#e8e4da]">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-[#a3966f] mb-0.5">Шоурум</div>
                  <div className="text-sm font-semibold text-[#222] whitespace-nowrap">Вход 3В</div>
                  <div className="text-xs text-[#a3966f] font-medium whitespace-nowrap">2 этаж</div>
                  <div className="absolute left-[-6px] bottom-[12px] w-3 h-3 bg-white border-l border-b border-[#e8e4da]" style={{ transform: "rotate(45deg)" }} />
                </div>
              </div>
            </div>
            <a
              href="https://yandex.ru/maps/?rtext=~55.752050%2C37.669297&rtt=auto"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 w-full h-12 bg-black text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#c4b99a] hover:text-black transition-colors rounded-xl"
            >
              <MapPin size={17} strokeWidth={1.7} />
              Построить маршрут в Яндекс Картах
            </a>
          </div>
        </div>
      </section>

      {lead && <LeadModal type={lead} onClose={() => setLead(null)} />}
    </div>
  );
}
