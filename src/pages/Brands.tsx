import { Link, useParams } from "react-router";
import { trpc } from "@/providers/trpc";
import { ProductCard } from "@/components/ProductCard";

export function BrandsPage() {
  const { data, isLoading } = trpc.brands.list.useQuery();
  const grouped = (data ?? []).reduce<Record<string, typeof data>>((acc, b) => {
    const letter = (b.name[0] ?? "#").toUpperCase();
    (acc[letter] ??= []).push(b);
    return acc;
  }, {});
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="font-display text-3xl font-semibold mb-6">Бренды</h1>
      {isLoading ? (
        <div className="text-muted-foreground">Загрузка…</div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([letter, items]) => (
            <div key={letter}>
              <div className="font-display text-xl font-semibold text-primary mb-3">{letter}</div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {(items ?? []).map((b) => (
                  <Link key={b.id} to={`/brands/${b.slug}`} className="flex items-center justify-between border border-border bg-card rounded-lg px-4 py-3 hover:border-primary/50 transition-colors">
                    <span className="font-medium text-sm">{b.name}</span>
                    <span className="text-xs text-muted-foreground">{b.cnt} шт.</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function BrandPage() {
  const { slug } = useParams();
  const brand = trpc.brands.bySlug.useQuery({ slug: slug ?? "" }, { enabled: !!slug });
  const collections = trpc.brands.collections.useQuery({ brandId: brand.data?.id }, { enabled: !!brand.data });
  const products = trpc.catalog.list.useQuery({ brandIds: brand.data ? [brand.data.id] : undefined, perPage: 24 }, { enabled: !!brand.data });

  if (brand.data === null)
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <h1 className="font-display text-2xl mb-3">Бренд не найден</h1>
        <Link to="/brands" className="text-primary underline">Все бренды</Link>
      </div>
    );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="font-display text-3xl font-semibold mb-1">{brand.data?.name ?? "…"}</h1>
      {brand.data?.country && <p className="text-muted-foreground text-sm mb-6">{brand.data.country}</p>}
      {(collections.data?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-2 mb-8">
          {collections.data!.slice(0, 30).map((c) => (
            <Link key={c.id} to={`/catalog?brand=${brand.data!.id}&q=${encodeURIComponent(c.name)}`} className="px-3 py-1.5 rounded-full border border-border bg-card text-xs hover:border-primary">
              {c.name} · {c.cnt}
            </Link>
          ))}
        </div>
      )}
      <h2 className="font-semibold mb-4">Товары бренда{products.data ? ` · ${products.data.total.toLocaleString("ru-RU")}` : ""}</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(products.data?.items ?? []).map((p) => (
          <ProductCard key={p.id} p={p as any} />
        ))}
      </div>
      {products.data && products.data.total > 24 && (
        <div className="mt-6 text-center">
          <Link to={`/catalog?brand=${brand.data!.id}`} className="inline-block h-11 px-8 leading-[2.75rem] rounded-md bg-primary text-primary-foreground text-sm font-semibold">
            Все {products.data.total.toLocaleString("ru-RU")} товаров бренда
          </Link>
        </div>
      )}
    </div>
  );
}

export function CollectionsPage() {
  const { data, isLoading } = trpc.brands.collections.useQuery({});
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="font-display text-3xl font-semibold mb-6">Коллекции</h1>
      {isLoading ? (
        <div className="text-muted-foreground">Загрузка…</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {(data ?? []).map((c) => (
            <Link key={c.id} to={`/catalog?q=${encodeURIComponent(c.name)}`} className="border border-border bg-card rounded-lg px-4 py-3 hover:border-primary/50 transition-colors">
              <div className="font-medium text-sm">{c.name}</div>
              <div className="text-xs text-muted-foreground">{c.brandName ?? ""} · {c.cnt} шт.</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
