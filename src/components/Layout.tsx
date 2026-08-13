import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router";
import { SITE, YM_EVENTS } from "@/lib/config";
import { ymGoal, ymHit } from "@/lib/ym";
import { captureUtm } from "@/lib/utm";
import { LeadModal } from "./LeadModal";
import type { LeadType } from "./LeadModal";
import { Phone, Search, Menu, X, MessageCircle, Send } from "lucide-react";
import { Cursor } from "./Cursor";
import { MaxIcon } from "./MaxIcon";

export function Layout({ children }: { children: ReactNode }) {
  const [lead, setLead] = useState<LeadType | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    captureUtm();
  }, []);

  useEffect(() => {
    ymHit();
    setMenuOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname, location.search]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQ.trim()) return;
    ymGoal(YM_EVENTS.search, { q: searchQ.trim() });
    navigate(`/search?q=${encodeURIComponent(searchQ.trim())}`);
    setSearchQ("");
  };

  const nav = [
    { to: "/catalog/keramogranit", label: "Керамогранит" },
    { to: "/catalog/plitka", label: "Плитка" },
    { to: "/brands", label: "Бренды" },
    { to: "/catalog?stock=1", label: "В наличии" },
    { to: "/delivery", label: "Доставка" },
    { to: "/contacts", label: "Контакты" },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Cursor />
      <header className="sticky top-0 z-40 bg-[hsl(var(--background))]/95 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-4 h-16">
          <button className="lg:hidden p-2" onClick={() => setMenuOpen(!menuOpen)} aria-label="Меню">
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <img src="/logo.png" alt="ОМ Студия" className="h-9 w-auto object-contain" />
            <span className="hidden sm:flex flex-col leading-tight">
              <span className="text-[10px] text-muted-foreground uppercase tracking-[0.2em]">керамогранит · плитка</span>
            </span>
          </Link>
          <nav className="hidden lg:flex items-center gap-5 ml-6 text-sm">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  `hover:text-primary transition-colors ${isActive ? "text-primary font-semibold" : "text-foreground/80"}`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <form onSubmit={submitSearch} className="hidden md:flex flex-1 max-w-xs ml-auto relative">
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Поиск: бренд, коллекция, артикул"
              className="w-full h-9 rounded-md border border-input bg-white px-3 pr-9 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              data-ym="search-input"
            />
            <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label="Найти">
              <Search size={16} />
            </button>
          </form>
          <a
            href={SITE.phoneHref}
            onClick={() => ymGoal(YM_EVENTS.clickPhone)}
            className="hidden md:flex items-center gap-2 text-sm font-semibold whitespace-nowrap"
            data-ym="phone-link"
          >
            <Phone size={16} className="text-primary" />
            {SITE.phone}
          </a>
          <button
            onClick={() => setLead("callback")}
            className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity whitespace-nowrap"
            data-ym="cta-callback-header"
          >
            Заказать звонок
          </button>
        </div>
        {menuOpen && (
          <nav className="lg:hidden border-t border-border bg-background px-4 py-3 flex flex-col gap-1">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} className="py-2.5 border-b border-border/50 text-[15px]">
                {n.label}
              </NavLink>
            ))}
            <form onSubmit={submitSearch} className="flex mt-2 relative">
              <input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Поиск по каталогу"
                className="w-full h-10 rounded-md border border-input bg-white px-3 pr-10 text-sm"
              />
              <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label="Найти">
                <Search size={18} />
              </button>
            </form>
            <a href={SITE.phoneHref} onClick={() => ymGoal(YM_EVENTS.clickPhone)} className="py-3 font-semibold flex items-center gap-2">
              <Phone size={16} className="text-primary" /> {SITE.phone}
            </a>
          </nav>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border bg-[hsl(28,10%,90%)] mt-16">
        <div className="max-w-7xl mx-auto px-4 py-10 grid gap-8 md:grid-cols-4 text-sm">
          <div>
            <img src="/logo.png" alt="ОМ Студия" className="h-7 w-auto object-contain mb-3" />
            <p className="text-muted-foreground leading-relaxed">
              Керамогранит и керамическая плитка от европейских фабрик. Складская программа, собственная доставка и производство изделий из керамогранита.
            </p>
          </div>
          <div>
            <div className="font-semibold mb-2">Каталог</div>
            <ul className="space-y-1.5 text-foreground/80">
              <li><Link to="/catalog/keramogranit">Керамогранит</Link></li>
              <li><Link to="/catalog/plitka">Керамическая плитка</Link></li>
              <li><Link to="/brands">Бренды</Link></li>
              <li><Link to="/collections">Коллекции</Link></li>
            </ul>
          </div>
          <div>
            <div className="font-semibold mb-2">Покупателям</div>
            <ul className="space-y-1.5 text-foreground/80">
              <li><Link to="/delivery">Доставка и подъём</Link></li>
              <li><Link to="/contacts">Контакты и шоурум</Link></li>
              <li><Link to="/privacy">Политика конфиденциальности</Link></li>
              <li><a href={SITE.baseSite} target="_blank" rel="noreferrer">Основной сайт om-studio.pro</a></li>
            </ul>
          </div>
          <div>
            <div className="font-semibold mb-2">Связаться</div>
            <a href={SITE.phoneHref} onClick={() => ymGoal(YM_EVENTS.clickPhone)} className="block font-semibold text-base mb-1">
              {SITE.phone}
            </a>
            <a href={`mailto:${SITE.email}`} className="block text-foreground/80 mb-3">{SITE.email}</a>
            <div className="flex gap-2">
              <a href={SITE.messengers.telegram} target="_blank" rel="noreferrer" onClick={() => ymGoal(YM_EVENTS.clickTelegram)}
                 className="h-9 w-9 rounded-full bg-white border border-border flex items-center justify-center hover:border-primary" aria-label="Telegram" data-ym="messenger-telegram">
                <Send size={15} />
              </a>
              <a href={SITE.messengers.whatsapp} target="_blank" rel="noreferrer" onClick={() => ymGoal(YM_EVENTS.clickWhatsapp)}
                 className="h-9 w-9 rounded-full bg-white border border-border flex items-center justify-center hover:border-primary" aria-label="WhatsApp" data-ym="messenger-whatsapp">
                <MessageCircle size={15} />
              </a>
              <a href={SITE.messengers.max} target="_blank" rel="noreferrer" onClick={() => ymGoal(YM_EVENTS.clickMax)}
                 className="h-9 w-9 rounded-full bg-white border border-border flex items-center justify-center hover:border-primary" aria-label="MAX" data-ym="messenger-max">
                <MaxIcon size={15} />
              </a>
            </div>
            <p className="text-muted-foreground mt-3 text-xs leading-relaxed">{SITE.showroom.address}</p>
          </div>
        </div>
        <div className="border-t border-border/60 py-4 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} ОМ Студия · Керамогранит и плитка
        </div>
      </footer>

      {/* Плавающая кнопка звонка на мобильных */}
      <a
        href={SITE.phoneHref}
        onClick={() => ymGoal(YM_EVENTS.clickPhone)}
        className="md:hidden fixed bottom-4 right-4 z-40 h-13 w-13 p-3.5 rounded-full bg-primary text-primary-foreground shadow-lg"
        aria-label="Позвонить"
        data-ym="phone-fab"
      >
        <Phone size={22} />
      </a>

      {lead && <LeadModal type={lead} onClose={() => setLead(null)} />}
    </div>
  );
}
