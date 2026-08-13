import { Link } from "react-router";
import { ymGoal } from "@/lib/ym";
import { YM_EVENTS } from "@/lib/config";
import { BadgeCheck } from "lucide-react";

export interface CardProduct {
  id: number;
  name: string;
  slug: string;
  price: string | null;
  oldPrice?: string | null;
  priceUnit: string | null;
  availabilityStatus: string;
  size?: string | null;
  brandName?: string | null;
  image?: string | null;
}

export const AVAILABILITY_LABEL: Record<string, { label: string; cls: string }> = {
  in_stock: { label: "В наличии", cls: "text-emerald-700" },
  low_stock: { label: "Заканчивается", cls: "text-amber-700" },
  out_of_stock: { label: "Под заказ", cls: "text-muted-foreground" },
  preorder: { label: "Предзаказ", cls: "text-amber-700" },
  unknown: { label: "Уточняйте наличие", cls: "text-muted-foreground" },
};

export function formatPrice(p?: string | null): string | null {
  if (!p) return null;
  const n = Number(p);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n) + " ₽";
}

/** Площадь одной штуки в м² по размеру вида "60x120" (см) */
function pieceAreaM2(size?: string | null): number | null {
  if (!size) return null;
  const m = size.match(/(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const a = (parseFloat(m[1]) / 100) * (parseFloat(m[2]) / 100);
  return a > 0.0005 && a < 10 ? a : null;
}

/** Для штучных товаров — ориентировочная цена за м² (отраслевой стандарт) */
export function pricePerM2(p: { price: string | null; priceUnit: string | null; size?: string | null }): string | null {
  if (!p.price || p.priceUnit !== "шт") return null;
  const area = pieceAreaM2(p.size);
  if (!area) return null;
  const perM2 = Number(p.price) / area;
  if (!Number.isFinite(perM2) || perM2 <= 0) return null;
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(perM2) + " ₽/м²";
}

export function StockBadge({ small }: { small?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-emerald-700 ${small ? "text-[11px]" : "text-xs"} font-medium`}
      title="Товар участвует в складской программе: физически на складе, точный метраж уточняйте у менеджера"
    >
      <BadgeCheck size={small ? 13 : 14} /> Складская программа
    </span>
  );
}

export function ProductCard({ p }: { p: CardProduct }) {
  const av = AVAILABILITY_LABEL[p.availabilityStatus] ?? AVAILABILITY_LABEL.unknown;
  const price = formatPrice(p.price);
  const perM2 = pricePerM2(p);
  const inStock = p.availabilityStatus === "in_stock" || p.availabilityStatus === "low_stock";
  return (
    <Link
      to={`/product/${p.slug}`}
      onClick={() => ymGoal(YM_EVENTS.productView, { id: p.id })}
      className="group bg-card border border-border rounded-lg overflow-hidden flex flex-col hover:shadow-lg hover:-translate-y-0.5 hover:border-[#c4b99a] transition-all duration-300"
      data-ym="product-card"
    >
      <div className="relative aspect-square bg-[hsl(40,10%,94%)] overflow-hidden">
        {p.image ? (
          <img
            src={p.image}
            alt={p.name}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-[1.06] transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs px-4 text-center">
            фото уточняйте у менеджера
          </div>
        )}
        {inStock && (
          <span className="absolute top-2 left-2 bg-white/95 backdrop-blur px-2 py-1 rounded text-[11px] font-medium text-emerald-700 flex items-center gap-1 shadow-sm">
            <BadgeCheck size={12} /> Складская программа
          </span>
        )}
      </div>
      <div className="p-3 flex flex-col gap-1 flex-1">
        {p.brandName && <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{p.brandName}</div>}
        <div className="text-sm font-medium leading-snug line-clamp-2 flex-1">{p.name}</div>
        {p.size && <div className="text-xs text-muted-foreground">{p.size} см</div>}
        <div className="mt-1">
          {price ? (
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="font-bold text-[15px]">{price}</span>
              <span className="text-xs text-muted-foreground">/{p.priceUnit ?? "м²"}</span>
              {perM2 && <span className="text-[11px] text-muted-foreground">≈ {perM2}</span>}
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">Цена по запросу</span>
          )}
        </div>
        <div className={`text-xs font-medium ${av.cls}`}>{av.label}</div>
      </div>
    </Link>
  );
}
