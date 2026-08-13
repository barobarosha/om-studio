import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { trpc } from "@/providers/trpc";
import { ProductCard, formatPrice, pricePerM2, AVAILABILITY_LABEL, StockBadge } from "@/components/ProductCard";
import { LeadModal } from "@/components/LeadModal";
import type { LeadContext, LeadType } from "@/components/LeadModal";
import { ymGoal } from "@/lib/ym";
import { SITE, YM_EVENTS } from "@/lib/config";
import { Phone, Send, MessageCircle, ChevronRight } from "lucide-react";

export default function ProductPage() {
  const { slug } = useParams();
  const { data: p, isLoading } = trpc.catalog.product.useQuery({ slug: slug ?? "" }, { enabled: !!slug });
  const [lead, setLead] = useState<LeadType | null>(null);
  const [imgIdx, setImgIdx] = useState(0);

  useEffect(() => {
    if (p) {
      document.title = `${p.name} — купить в ОМ Студия`;
      ymGoal(YM_EVENTS.productView, { id: p.id, name: p.name });
    }
  }, [p?.id]);

  if (isLoading)
    return (
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="grid md:grid-cols-2 gap-10">
          <div className="aspect-square bg-accent rounded-xl animate-pulse" />
          <div className="space-y-3">
            <div className="h-8 bg-accent rounded animate-pulse" />
            <div className="h-5 bg-accent rounded w-1/2 animate-pulse" />
            <div className="h-24 bg-accent rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  if (!p)
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 text-center">
        <h1 className="font-display text-2xl mb-3">Товар не найден</h1>
        <p className="text-muted-foreground mb-6">Возможно, он снят с производства или обновляется выгрузка.</p>
        <Link to="/catalog" className="text-primary underline">Перейти в каталог</Link>
      </div>
    );

  const av = AVAILABILITY_LABEL[p.availabilityStatus] ?? AVAILABILITY_LABEL.unknown;
  const price = formatPrice(p.price);
  const leadCtx: LeadContext = { productId: p.id, productName: `${p.name}${p.sku ? ` (арт. ${p.sku})` : ""}`, pageUrl: window.location.href };
  const chars: [string, string | null | undefined][] = [
    ["Бренд", p.brandName],
    ["Коллекция", p.collectionName],
    ["Страна", p.country],
    ["Размер, см", p.size],
    ["Поверхность", p.surface],
    ["Цвет", p.color],
    ["Толщина", p.thickness],
    ["Артикул", p.sku ?? p.externalId],
    ["Тип", p.category === "keramogranit" ? "Керамогранит" : "Керамическая плитка"],
    ...Object.entries((p.attrs as Record<string, string> | null) ?? {}),
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <nav className="text-xs text-muted-foreground mb-5 flex items-center gap-1 flex-wrap">
        <Link to="/">Главная</Link> <ChevronRight size={12} />
        <Link to="/catalog">Каталог</Link> <ChevronRight size={12} />
        <Link to={`/catalog/${p.category}`}>{p.category === "keramogranit" ? "Керамогранит" : "Плитка"}</Link>
        {p.brandSlug && (
          <>
            <ChevronRight size={12} /> <Link to={`/brands/${p.brandSlug}`}>{p.brandName}</Link>
          </>
        )}
        <ChevronRight size={12} /> <span className="text-foreground">{p.name}</span>
      </nav>

      <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
        <div>
          <div className="aspect-square bg-[hsl(30,10%,93%)] rounded-xl overflow-hidden mb-3">
            {p.images.length ? (
              <img src={p.images[imgIdx]} alt={p.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                Фото уточняйте у менеджера
              </div>
            )}
          </div>
          {p.images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {p.images.map((u, i) => (
                <button
                  key={i}
                  onClick={() => setImgIdx(i)}
                  className={`shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 ${i === imgIdx ? "border-primary" : "border-transparent"}`}
                >
                  <img src={u} alt="" loading="lazy" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-semibold leading-tight mb-2">{p.name}</h1>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mb-4">
            {p.brandName && p.brandSlug && (
              <Link to={`/brands/${p.brandSlug}`} className="underline hover:text-primary">{p.brandName}</Link>
            )}
            {p.collectionName && <span>Коллекция {p.collectionName}</span>}
            {p.size && <span>{p.size} см</span>}
          </div>

          <div className="bg-card border border-border rounded-xl p-5 mb-5">
            <div className="flex items-baseline gap-3 mb-1">
              {price ? (
                <>
                  <span className="text-3xl font-bold">{price}</span>
                  <span className="text-muted-foreground">за {p.priceUnit ?? "м²"}</span>
                {pricePerM2(p) && <span className="text-sm text-muted-foreground">≈ {pricePerM2(p)}</span>}
                </>
              ) : (
                <span className="text-xl font-semibold">Цена по запросу</span>
              )}
            </div>
            {(p.availabilityStatus === "in_stock" || p.availabilityStatus === "low_stock") && (
              <div className="mb-1.5"><StockBadge /></div>
            )}
            <div className={`text-sm font-medium mb-1 ${av.cls}`}>
              {av.label}
              {p.stockQty && Number(p.stockQty) > 0 && p.availabilityStatus !== "out_of_stock" && (
                <span className="text-muted-foreground font-normal"> · {Number(p.stockQty).toLocaleString("ru-RU", { maximumFractionDigits: 2 })} {p.priceUnit ?? "м²"}</span>
              )}
            </div>
            {(p.stockMsk || p.stockSpb) && (
              <div className="text-xs text-muted-foreground mb-4">
                {p.stockMsk && Number(p.stockMsk) > 0 && <span className="mr-3">Москва: {Number(p.stockMsk).toLocaleString("ru-RU", { maximumFractionDigits: 1 })}</span>}
                {p.stockSpb && Number(p.stockSpb) > 0 && <span>СПб: {Number(p.stockSpb).toLocaleString("ru-RU", { maximumFractionDigits: 1 })}</span>}
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => setLead("availability")}
                className="flex-1 h-12 rounded-md bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90"
                data-ym="cta-availability-product"
              >
                Узнать наличие
              </button>
              <button
                onClick={() => setLead("consultation")}
                className="flex-1 h-12 rounded-md border border-primary text-primary font-semibold text-sm hover:bg-primary/5"
                data-ym="cta-consultation-product"
              >
                Получить консультацию
              </button>
            </div>
            <div className="flex gap-2 mt-3">
              <a href={SITE.phoneHref} onClick={() => ymGoal(YM_EVENTS.clickPhone)}
                 className="flex-1 h-11 rounded-md border border-border bg-white flex items-center justify-center gap-2 text-sm font-semibold" data-ym="phone-product">
                <Phone size={15} className="text-primary" /> {SITE.phone}
              </a>
              <a href={SITE.messengers.telegram} target="_blank" rel="noreferrer" onClick={() => ymGoal(YM_EVENTS.clickTelegram)}
                 className="h-11 w-11 rounded-md border border-border bg-white flex items-center justify-center" aria-label="Telegram" data-ym="telegram-product">
                <Send size={16} />
              </a>
              <a href={SITE.messengers.whatsapp} target="_blank" rel="noreferrer" onClick={() => ymGoal(YM_EVENTS.clickWhatsapp)}
                 className="h-11 w-11 rounded-md border border-border bg-white flex items-center justify-center" aria-label="WhatsApp" data-ym="whatsapp-product">
                <MessageCircle size={16} />
              </a>
            </div>
          </div>

          <h2 className="font-semibold mb-2">Характеристики</h2>
          <dl className="text-sm divide-y divide-border border-y border-border mb-6">
            {chars.filter(([, v]) => v).map(([k, v]) => (
              <div key={k} className="flex py-2">
                <dt className="w-40 shrink-0 text-muted-foreground">{k}</dt>
                <dd className="flex-1">{v}</dd>
              </div>
            ))}
          </dl>

          {p.description && (
            <>
              <h2 className="font-semibold mb-2">Описание</h2>
              <p className="text-sm leading-relaxed text-foreground/85 whitespace-pre-line mb-6">{p.description}</p>
            </>
          )}
          <p className="text-xs text-muted-foreground">
            Данные о цене и остатках обновляются автоматически из выгрузки поставщика ({p.supplierName ?? "склад"}).
          </p>
        </div>
      </div>

      {p.similar.length > 0 && (
        <section className="mt-14">
          <h2 className="font-display text-xl font-semibold mb-4">{p.collectionName ? "Из этой коллекции" : "Похожие товары"}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {p.similar.map((s) => (
              <ProductCard key={s.id} p={s as any} />
            ))}
          </div>
        </section>
      )}

      {lead && <LeadModal type={lead} product={leadCtx} onClose={() => setLead(null)} />}
    </div>
  );
}
