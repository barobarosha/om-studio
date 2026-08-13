import { useEffect, useState } from "react";
import { Link } from "react-router";
import { trpc } from "@/providers/trpc";
import { ProductCard } from "@/components/ProductCard";
import { LeadModal } from "@/components/LeadModal";
import type { LeadType } from "@/components/LeadModal";
import { SITE } from "@/lib/config";
import { Truck, Layers, Scissors, Warehouse, ImageIcon, Handshake, Package, MapPin, ArrowRight } from "lucide-react";

const ADVANTAGES = [
  { icon: Warehouse, n: "01", title: "Складская программа", text: "Тысячи наименований физически на складах в Москве и СПб. Значок «Складская программа» на карточке — товар можно забрать сразу, метраж уточнит менеджер." },
  { icon: Scissors, n: "02", title: "Собственное производство", text: "Резка керамогранита и изготовление изделий: столешницы, фартуки, мойки, облицовка кухонь." },
  { icon: Truck, n: "03", title: "Доставка и подъём", text: "Организуем доставку на объект и подъём на этаж. Условия рассчитываются под ваш заказ." },
  { icon: ImageIcon, n: "04", title: "Подбор по визуализации", text: "Пришлите рендер или фото интерьера — подберём материалы под ваш дизайн-проект." },
  { icon: Layers, n: "05", title: "Образцы в шоуруме", text: "В шоуруме в Artplay можно посмотреть и потрогать образцы материалов перед покупкой." },
  { icon: Handshake, n: "06", title: "Программа для дизайнеров", text: "Партнёрские условия для архитекторов и дизайнеров интерьеров." },
  { icon: Package, n: "07", title: "Комплектация объекта", text: "Соберём полный пакет материалов: плитка, керамогранит, паркет и сопутствующее." },
  { icon: MapPin, n: "08", title: "Шоурум в Artplay", text: SITE.showroom.address },
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
              {stats.data
                ? `${stats.data.total.toLocaleString("ru-RU")} наименований от ${stats.data.brands} фабрик. Остатки и цены обновляются каждый час из выгрузок поставщиков.`
                : "Каталог пополняется из выгрузок поставщиков автоматически."}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/catalog" className="h-13 px-8 py-4 bg-[#c4b99a] text-black font-semibold text-sm tracking-wide hover:bg-white transition-colors flex items-center gap-2" data-ym="cta-catalog-hero">
                Перейти в каталог <ArrowRight size={16} />
              </Link>
              <button onClick={() => setLead("availability")} className="h-13 px-8 py-4 border border-white/50 text-white font-semibold text-sm tracking-wide hover:bg-white hover:text-black transition-colors" data-ym="cta-availability-hero">
                Узнать наличие
              </button>
            </div>
          </div>
          <div className="absolute bottom-8 left-4 right-4 flex items-end justify-between">
            <div className="flex gap-8 text-sm">
              <div><div className="font-display text-2xl font-semibold">{stats.data?.inStock.toLocaleString("ru-RU") ?? "—"}</div><div className="text-white/60 text-xs">на складе</div></div>
              <div><div className="font-display text-2xl font-semibold">{stats.data?.brands ?? "—"}</div><div className="text-white/60 text-xs">брендов</div></div>
              <div><div className="font-display text-2xl font-semibold">{stats.data?.collections.toLocaleString("ru-RU") ?? "—"}</div><div className="text-white/60 text-xs">коллекций</div></div>
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { to: "/catalog/keramogranit", t: "Керамогранит", d: "полы, стены, фасады, изделия" },
            { to: "/catalog/plitka", t: "Керамическая плитка", d: "ванные, кухни, декоры" },
            { to: "/catalog?stock=1", t: "В наличии", d: "складская программа, сразу к отгрузке" },
            { to: "/brands", t: "Бренды", d: "70 фабрик Италии, Испании, Португалии" },
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
          <Link to="/catalog?stock=1" className="text-sm border-b border-[#c4b99a] pb-0.5 hover:text-[#a3966f] transition-colors whitespace-nowrap">Весь склад →</Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(inStock.data?.items ?? []).map((p) => (
            <ProductCard key={p.id} p={p as any} />
          ))}
        </div>
      </section>

      {/* Преимущества */}
      <section className="bg-[#f6f3ee]">
        <div className="max-w-7xl mx-auto px-4 py-16">
          <div className="text-[#a3966f] uppercase tracking-[0.25em] text-[11px] mb-2">Сервис</div>
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
              <div>{SITE.showroom.address}</div>
              <div>{SITE.showroom.hours}</div>
              <a href={SITE.phoneHref} className="block font-semibold text-lg pt-1 text-[#a3966f]">{SITE.phone}</a>
            </div>
            <button onClick={() => setLead("callback")} className="h-12 px-8 bg-black text-white font-semibold text-sm hover:bg-[#c4b99a] hover:text-black transition-colors" data-ym="cta-visit-showroom">
              Запланировать визит
            </button>
          </div>
          <div className="overflow-hidden rounded-xl border border-border shadow-sm">
            <iframe
              title="Шоурум на карте"
              src="https://yandex.ru/map-widget/v1/?text=%D0%9D%D0%B8%D0%B6%D0%BD%D1%8F%D1%8F%20%D0%A1%D1%8B%D1%80%D0%BE%D0%BC%D1%8F%D1%82%D0%BD%D0%B8%D1%87%D0%B5%D1%81%D0%BA%D0%B0%D1%8F%2010%20Artplay&z=16"
              className="w-full h-72 lg:h-96"
              loading="lazy"
            />
          </div>
        </div>
      </section>

      {lead && <LeadModal type={lead} onClose={() => setLead(null)} />}
    </div>
  );
}
