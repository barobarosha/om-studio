import { useState } from "react";
import { Link } from "react-router";
import { SITE, YM_EVENTS } from "@/lib/config";
import { ymGoal } from "@/lib/ym";
import { LeadModal } from "@/components/LeadModal";
import type { LeadType } from "@/components/LeadModal";
import { MaxIcon } from "@/components/MaxIcon";
import { Square, Layers, CircleDot, PanelTop, TrendingUp, CookingPot, Send, MessageCircle, ArrowRight } from "lucide-react";

const PRODUCTS = [
  { icon: Square, title: "Столешницы", text: "Кухонные и ванные столешницы из керамогранита — стойкие к царапинам, температуре и пятнам." },
  { icon: PanelTop, title: "Фартуки", text: "Кухонные фартуки в цвет столешницы или контрастным акцентом, включая крупноформатные слэбы без швов." },
  { icon: CircleDot, title: "Раковины и мойки", text: "Интегрированные и накладные раковины, облицовка моек керамогранитом." },
  { icon: Layers, title: "Подоконники", text: "Подоконники из керамогранита любой длины, с подрезкой и обработкой кромки." },
  { icon: TrendingUp, title: "Ступени и лестницы", text: "Облицовка ступеней, подступенки, капиносы — для дома и коммерческих объектов." },
  { icon: CookingPot, title: "Облицовка кухонь", text: "Фасады, острова и панели из керамогранита — единый материал для всей кухни." },
];

const STEPS = [
  "Присылаете эскиз, чертёж или фото с размерами",
  "Подбираем керамогранит из каталога — в наличии или под заказ",
  "Считаем стоимость материала и работ, согласовываем сроки",
  "Производим раскрой, кромку и монтажные отверстия на собственном производстве",
  "Доставляем готовое изделие на объект с подъёмом на этаж",
];

export default function IzdeliyaPage() {
  const [lead, setLead] = useState<LeadType | null>(null);
  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="text-[#a3966f] uppercase tracking-[0.25em] text-[11px] mb-2">Собственное производство</div>
      <h1 className="font-display text-3xl lg:text-4xl font-semibold mb-4">Изделия из керамогранита</h1>
      <p className="text-foreground/70 leading-relaxed max-w-2xl mb-10">
        ОМ Студия не только поставляет керамогранит, но и изготавливает из него изделия на собственном производстве:
        раскрой, подрезка, обработка кромки, отверстия под смесители и варочные панели.
      </p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-14">
        {PRODUCTS.map((f) => (
          <div key={f.title} className="group bg-white rounded-xl border border-border p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_32px_-16px_rgba(120,100,60,.35)] hover:border-[#c4b99a]/60">
            <div className="w-10 h-10 rounded-full bg-[#f6f3ee] group-hover:bg-[#c4b99a] flex items-center justify-center mb-3 transition-colors duration-300">
              <f.icon size={18} strokeWidth={1.5} className="text-[#a3966f] group-hover:text-white transition-colors duration-300" />
            </div>
            <div className="font-semibold text-sm mb-1.5">{f.title}</div>
            <div className="text-sm text-muted-foreground leading-relaxed">{f.text}</div>
          </div>
        ))}
      </div>

      <div className="border border-border grid lg:grid-cols-2 mb-14">
        <div className="p-8 lg:p-10">
          <div className="text-[#a3966f] uppercase tracking-[0.25em] text-[11px] mb-2">Как заказать</div>
          <h2 className="font-display text-2xl font-semibold mb-3">От эскиза до готового изделия</h2>
          <p className="text-foreground/70 leading-relaxed text-sm">
            Работаем по чертежам дизайнера, замерам объекта или простому фото с размерами. Проконсультируем по материалу,
            толщине и обработке кромки.
          </p>
        </div>
        <ul className="border-t lg:border-t-0 lg:border-l border-border divide-y divide-border text-sm">
          {STEPS.map((s, i) => (
            <li key={i} className="flex gap-4 px-8 py-4 items-center hover:bg-accent/60 transition-colors">
              <span className="font-display text-xl text-[#a3966f]">{String(i + 1).padStart(2, "0")}</span>
              <span className="text-foreground/80">{s}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* CTA */}
      <div className="relative overflow-hidden rounded-2xl bg-[#f6f3ee] border border-[#c4b99a]/40 p-8 lg:p-12">
        <div className="absolute -right-20 -top-20 w-72 h-72 rounded-full bg-[#c4b99a]/25 blur-3xl" />
        <div className="absolute -left-10 -bottom-16 w-56 h-56 rounded-full bg-[#c4b99a]/15 blur-2xl" />
        <div className="relative">
          <h2 className="font-display text-2xl lg:text-3xl font-semibold mb-3">Рассчитаем ваше изделие</h2>
          <p className="text-foreground/70 leading-relaxed mb-8 max-w-xl">
            Пришлите эскиз или фото с размерами — менеджер подберёт материал, посчитает стоимость и сроки изготовления.
          </p>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => setLead("project")} className="h-12 px-7 bg-black text-white font-semibold text-sm hover:bg-[#c4b99a] hover:text-black transition-colors" data-ym="cta-izdeliya">
              Отправить эскиз на расчёт
            </button>
            <a href={SITE.phoneHref} onClick={() => ymGoal(YM_EVENTS.clickPhone)}
               className="h-12 px-7 border border-foreground/30 font-semibold text-sm flex items-center hover:bg-black hover:text-white hover:border-black transition-colors" data-ym="phone-izdeliya">
              {SITE.phone}
            </a>
          </div>
          <div className="flex flex-wrap gap-3 mt-3">
            <a href={SITE.messengers.telegram} target="_blank" rel="noreferrer" onClick={() => ymGoal(YM_EVENTS.clickTelegram)}
               className="h-12 px-6 bg-white border border-border text-sm font-medium flex items-center gap-2 hover:border-[#a3966f] hover:text-[#a3966f] transition-colors" data-ym="telegram-izdeliya">
              <Send size={16} /> Написать в Telegram
            </a>
            <a href={SITE.messengers.whatsapp} target="_blank" rel="noreferrer" onClick={() => ymGoal(YM_EVENTS.clickWhatsapp)}
               className="h-12 px-6 bg-white border border-border text-sm font-medium flex items-center gap-2 hover:border-[#a3966f] hover:text-[#a3966f] transition-colors" data-ym="whatsapp-izdeliya">
              <MessageCircle size={16} /> Написать в WhatsApp
            </a>
            <a href={SITE.messengers.max} target="_blank" rel="noreferrer" onClick={() => ymGoal(YM_EVENTS.clickMax)}
               className="h-12 px-6 bg-white border border-border text-sm font-medium flex items-center gap-2 hover:border-[#a3966f] hover:text-[#a3966f] transition-colors" data-ym="max-izdeliya">
              <MaxIcon size={16} /> Написать в MAX
            </a>
          </div>
          <div className="mt-8">
            <Link to="/catalog/keramogranit" className="inline-flex items-center gap-2 text-sm border-b border-[#c4b99a] pb-0.5 hover:text-[#a3966f] transition-colors">
              Выбрать керамогранит в каталоге <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>

      {lead && <LeadModal type={lead} onClose={() => setLead(null)} />}
    </div>
  );
}
