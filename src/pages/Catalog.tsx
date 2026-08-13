import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { trpc } from "@/providers/trpc";
import { ProductCard } from "@/components/ProductCard";
import { ymGoal } from "@/lib/ym";
import { YM_EVENTS } from "@/lib/config";
import { SlidersHorizontal, X } from "lucide-react";

const CATEGORY_TITLES: Record<string, { title: string; desc: string }> = {
  keramogranit: { title: "Керамогранит", desc: "Керамический гранит от европейских и российских фабрик — в наличии на складе и под заказ." },
  plitka: { title: "Керамическая плитка", desc: "Настенная и напольная керамическая плитка, мозаика и декоры." },
};

type Multi = "brands" | "countries" | "colors" | "surfaces" | "sizes";

function useFiltersFromUrl() {
  const [params, setParams] = useSearchParams();
  const { category } = useParams();
  const getList = (k: string) => (params.get(k) ? params.get(k)!.split(",").filter(Boolean) : []);
  const filters = {
    category,
    brands: getList("brand"),
    countries: getList("country"),
    colors: getList("color"),
    surfaces: getList("surface"),
    sizes: getList("size"),
    inStockOnly: params.get("stock") === "1",
    onSale: params.get("sale") === "1",
    priceMin: params.get("pmin") ? Number(params.get("pmin")) : undefined,
    priceMax: params.get("pmax") ? Number(params.get("pmax")) : undefined,
    search: params.get("q") ?? undefined,
    sort: (params.get("sort") as any) ?? "popular",
    page: params.get("page") ? Number(params.get("page")) : 1,
  };
  const setFilter = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === "") next.delete(k);
      else next.set(k, v);
    }
    if (!("page" in patch)) next.delete("page");
    setParams(next, { preventScrollReset: true });
  };
  return { filters, setFilter };
}

export default function CatalogPage({ forceCategory, forceSale, forceSearch }: { forceCategory?: string; forceSale?: boolean; forceSearch?: boolean }) {
  const { filters, setFilter } = useFiltersFromUrl();
  const [mobileFilters, setMobileFilters] = useState(false);
  const category = forceCategory ?? filters.category;
  const search = forceSearch ? filters.search : undefined;

  const apiInput = useMemo(
    () => ({
      category,
      brandIds: filters.brands.map(Number).filter(Boolean),
      countries: filters.countries.length ? filters.countries : undefined,
      colors: filters.colors.length ? filters.colors : undefined,
      surfaces: filters.surfaces.length ? filters.surfaces : undefined,
      sizes: filters.sizes.length ? filters.sizes : undefined,
      inStockOnly: filters.inStockOnly || undefined,
      onSale: forceSale || filters.onSale || undefined,
      search,
      sort: filters.sort,
      page: filters.page,
      perPage: 24,
    }),
    [JSON.stringify(filters), category, forceSale, search],
  );

  const list = trpc.catalog.list.useQuery(apiInput, { keepPreviousData: true } as any);
  const facets = trpc.catalog.facets.useQuery(apiInput, { keepPreviousData: true } as any);

  const toggleMulti = (key: Multi, urlKey: string, value: string) => {
    const cur = filters[key] as string[];
    const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
    setFilter({ [urlKey]: next.join(",") || undefined });
    ymGoal(YM_EVENTS.filterApply, { [urlKey]: value });
  };

  const title = forceSale
    ? "Распродажа"
    : search
      ? `Поиск: «${search}»`
      : category && CATEGORY_TITLES[category]
        ? CATEGORY_TITLES[category].title
        : "Каталог";

  const facetGroups: { key: Multi; urlKey: string; label: string; items: { value: string; cnt: number }[] }[] = [
    { key: "countries", urlKey: "country", label: "Страна", items: (facets.data?.countries ?? []) as any },
    { key: "colors", urlKey: "color", label: "Цвет", items: (facets.data?.colors ?? []) as any },
    { key: "surfaces", urlKey: "surface", label: "Поверхность", items: (facets.data?.surfaces ?? []) as any },
    { key: "sizes", urlKey: "size", label: "Размер, см", items: (facets.data?.sizes ?? []) as any },
  ];

  const filtersBody = (
    <div className="space-y-5">
      <div>
        <div className="text-sm font-semibold mb-2">Бренд</div>
        <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
          {(facets.data?.brands ?? []).map((b) => (
            <label key={b.id} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={filters.brands.includes(String(b.id))}
                onChange={() => toggleMulti("brands", "brand", String(b.id))}
                className="accent-[hsl(var(--primary))]"
              />
              <span className="flex-1 truncate">{b.name}</span>
              <span className="text-xs text-muted-foreground">{b.cnt}</span>
            </label>
          ))}
        </div>
      </div>
      {facetGroups.map(
        (g) =>
          g.items.length > 0 && (
            <div key={g.urlKey}>
              <div className="text-sm font-semibold mb-2">{g.label}</div>
              <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
                {g.items.map((it) => (
                  <label key={it.value} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(filters[g.key] as string[]).includes(it.value)}
                      onChange={() => toggleMulti(g.key, g.urlKey, it.value)}
                      className="accent-[hsl(var(--primary))]"
                    />
                    <span className="flex-1 truncate">{it.value}</span>
                    <span className="text-xs text-muted-foreground">{it.cnt}</span>
                  </label>
                ))}
              </div>
            </div>
          ),
      )}
      {facets.data && facets.data.priceMax > 0 && (
        <div>
          <div className="text-sm font-semibold mb-2">Цена, ₽</div>
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="numeric"
              placeholder={String(Math.floor(facets.data.priceMin))}
              defaultValue={filters.priceMin ?? ""}
              onBlur={(e) => setFilter({ pmin: e.target.value || undefined })}
              className="w-1/2 h-9 rounded-md border border-input px-2 text-sm bg-white"
            />
            <input
              type="number"
              inputMode="numeric"
              placeholder={String(Math.ceil(facets.data.priceMax))}
              defaultValue={filters.priceMax ?? ""}
              onBlur={(e) => setFilter({ pmax: e.target.value || undefined })}
              className="w-1/2 h-9 rounded-md border border-input px-2 text-sm bg-white"
            />
          </div>
        </div>
      )}
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={!!filters.inStockOnly}
          onChange={(e) => setFilter({ stock: e.target.checked ? "1" : undefined })}
          className="accent-[hsl(var(--primary))]"
        />
        Только в наличии
      </label>
      <button
        onClick={() => setFilter({ brand: undefined, country: undefined, color: undefined, surface: undefined, size: undefined, pmin: undefined, pmax: undefined, stock: undefined })}
        className="text-xs text-muted-foreground underline"
      >
        Сбросить все фильтры
      </button>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h1 className="font-display text-3xl font-semibold mb-1">{title}</h1>
      {category && CATEGORY_TITLES[category] && (
        <p className="text-muted-foreground text-sm mb-4 max-w-2xl">{CATEGORY_TITLES[category].desc}</p>
      )}

      <div className="flex gap-8">
        <aside className="hidden lg:block w-60 shrink-0">{filtersBody}</aside>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <button
              onClick={() => setMobileFilters(true)}
              className="lg:hidden h-9 px-3 rounded-md border border-border bg-white text-sm flex items-center gap-2"
              data-ym="filters-open"
            >
              <SlidersHorizontal size={15} /> Фильтры
            </button>
            <span className="text-sm text-muted-foreground">
              {list.data ? `Найдено: ${list.data.total.toLocaleString("ru-RU")}` : "Загрузка…"}
            </span>
            <select
              value={filters.sort}
              onChange={(e) => setFilter({ sort: e.target.value === "popular" ? undefined : e.target.value })}
              className="ml-auto h-9 rounded-md border border-input bg-white px-2 text-sm"
              data-ym="sort-select"
            >
              <option value="popular">Популярные</option>
              <option value="price_asc">Цена: по возрастанию</option>
              <option value="price_desc">Цена: по убыванию</option>
              <option value="stock">По остатку</option>
              <option value="newest">Новинки</option>
            </select>
          </div>

          {list.isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-[3/4] rounded-lg bg-accent animate-pulse" />
              ))}
            </div>
          ) : list.data && list.data.items.length ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {list.data.items.map((p) => (
                  <ProductCard key={p.id} p={p as any} />
                ))}
              </div>
              {list.data.pages > 1 && (
                <div className="flex justify-center gap-2 mt-8 flex-wrap">
                  {Array.from({ length: list.data.pages })
                    .slice(0, 15)
                    .map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setFilter({ page: String(i + 1) })}
                        className={`h-9 w-9 rounded-md text-sm border ${filters.page === i + 1 ? "bg-primary text-primary-foreground border-primary" : "bg-white border-border"}`}
                      >
                        {i + 1}
                      </button>
                    ))}
                </div>
              )}
            </>
          ) : (
            <div className="py-16 text-center text-muted-foreground">
              <p className="text-lg mb-2">Ничего не найдено</p>
              <p className="text-sm">Попробуйте изменить фильтры или запрос — или позвоните нам, подберём вручную.</p>
            </div>
          )}
        </div>
      </div>

      {/* Мобильная панель фильтров */}
      {mobileFilters && (
        <div className="fixed inset-0 z-50 bg-black/50 lg:hidden" onClick={() => setMobileFilters(false)}>
          <div className="absolute right-0 top-0 bottom-0 w-[85%] max-w-sm bg-background p-5 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold">Фильтры</span>
              <button onClick={() => setMobileFilters(false)} aria-label="Закрыть">
                <X size={20} />
              </button>
            </div>
            {filtersBody}
            <button
              onClick={() => setMobileFilters(false)}
              className="mt-6 w-full h-11 rounded-md bg-primary text-primary-foreground font-semibold text-sm"
            >
              Применить{list.data ? ` (${list.data.total.toLocaleString("ru-RU")})` : ""}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
