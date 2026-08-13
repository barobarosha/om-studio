import { useState } from "react";
import { SITE, YM_EVENTS } from "@/lib/config";
import { ymGoal } from "@/lib/ym";
import { LeadModal } from "@/components/LeadModal";
import type { LeadType } from "@/components/LeadModal";
import { Truck, ArrowUp, MapPin, Scissors, PackageCheck, Send, MessageCircle } from "lucide-react";
import { MaxIcon } from "@/components/MaxIcon";

const DELIVERY_FEATURES = [
  { icon: Truck, title: "Доставка на объект", text: "Со складов в Москве и Санкт-Петербурге, в удобную дату" },
  { icon: ArrowUp, title: "Подъём на этаж", text: "Занос в квартиру и разгрузка — по согласованию" },
  { icon: MapPin, title: "Вся Россия", text: "Отправка в регионы через транспортные компании" },
  { icon: Scissors, title: "Резка перед отгрузкой", text: "Изделия, подрезка и кромка на собственном производстве" },
  { icon: PackageCheck, title: "Резерв на складе", text: "Забронируем товар на время согласования проекта" },
];

export function DeliveryPage() {
  const [lead, setLead] = useState<LeadType | null>(null);
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="text-[#a3966f] uppercase tracking-[0.25em] text-[11px] mb-2">Сервис</div>
      <h1 className="font-display text-3xl lg:text-4xl font-semibold mb-4">Доставка и подъём</h1>
      <p className="text-foreground/70 leading-relaxed max-w-2xl mb-10">
        ОМ Студия организует доставку керамогранита и плитки по Москве, Московской области и в регионы. Стоимость рассчитывает менеджер — она зависит от объёма, адреса и этажа.
      </p>

      <h2 className="font-display text-xl font-semibold mb-5">Что мы делаем</h2>
      <div className="flex flex-wrap gap-4 mb-12">
        {DELIVERY_FEATURES.map((f) => (
          <div key={f.title} className="group bg-white rounded-xl border border-border p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_32px_-16px_rgba(120,100,60,.35)] hover:border-[#c4b99a]/60 flex-1 min-w-[240px]">
            <div className="w-10 h-10 rounded-full bg-[#f6f3ee] group-hover:bg-[#c4b99a] flex items-center justify-center mb-3 transition-colors duration-300">
              <f.icon size={18} strokeWidth={1.5} className="text-[#a3966f] group-hover:text-white transition-colors duration-300" />
            </div>
            <div className="font-semibold text-sm mb-1.5">{f.title}</div>
            <div className="text-sm text-muted-foreground leading-relaxed">{f.text}</div>
          </div>
        ))}
      </div>

      {/* CTA-блок */}
      <div className="relative overflow-hidden rounded-2xl bg-[#f6f3ee] border border-[#c4b99a]/40 p-8 lg:p-12">
        <div className="absolute -right-20 -top-20 w-72 h-72 rounded-full bg-[#c4b99a]/25 blur-3xl" />
        <div className="absolute -left-10 -bottom-16 w-56 h-56 rounded-full bg-[#c4b99a]/15 blur-2xl" />
        <div className="relative">
          <h2 className="font-display text-2xl lg:text-3xl font-semibold mb-3">Рассчитаем доставку за 15 минут</h2>
          <p className="text-foreground/70 leading-relaxed mb-8 max-w-xl">
            Позвоните или напишите в удобный мессенджер — менеджер проверит наличие, забронирует товар и предложит дату отгрузки с подъёмом.
          </p>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => setLead("consultation")} className="h-12 px-7 bg-black text-white font-semibold text-sm hover:bg-[#c4b99a] hover:text-black transition-colors" data-ym="cta-delivery">
              Рассчитать доставку
            </button>
            <a href={SITE.phoneHref} onClick={() => ymGoal(YM_EVENTS.clickPhone)}
               className="h-12 px-7 border border-foreground/30 font-semibold text-sm flex items-center hover:bg-black hover:text-white hover:border-black transition-colors" data-ym="phone-delivery">
              {SITE.phone}
            </a>
          </div>
          <div className="flex flex-wrap gap-3 mt-3">
            <a href={SITE.messengers.telegram} target="_blank" rel="noreferrer" onClick={() => ymGoal(YM_EVENTS.clickTelegram)}
               className="h-12 px-6 bg-white border border-border text-sm font-medium flex items-center gap-2 hover:border-[#a3966f] hover:text-[#a3966f] transition-colors" data-ym="telegram-delivery">
              <Send size={16} /> Написать в Telegram
            </a>
            <a href={SITE.messengers.whatsapp} target="_blank" rel="noreferrer" onClick={() => ymGoal(YM_EVENTS.clickWhatsapp)}
               className="h-12 px-6 bg-white border border-border text-sm font-medium flex items-center gap-2 hover:border-[#a3966f] hover:text-[#a3966f] transition-colors" data-ym="whatsapp-delivery">
              <MessageCircle size={16} /> Написать в WhatsApp
            </a>
            <a href={SITE.messengers.max} target="_blank" rel="noreferrer" onClick={() => ymGoal(YM_EVENTS.clickMax)}
               className="h-12 px-6 bg-white border border-border text-sm font-medium flex items-center gap-2 hover:border-[#a3966f] hover:text-[#a3966f] transition-colors" data-ym="max-delivery">
              <MaxIcon size={16} /> Написать в MAX
            </a>
          </div>
        </div>
      </div>
      {lead && <LeadModal type={lead} onClose={() => setLead(null)} />}
    </div>
  );
}

export function ContactsPage() {
  const [lead, setLead] = useState<LeadType | null>(null);
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="font-display text-3xl font-semibold mb-6">Контакты</h1>
      <div className="grid sm:grid-cols-2 gap-px bg-border border border-border mb-8">
        <div className="bg-card p-6">
          <div className="font-semibold mb-2">Связь</div>
          <a href={SITE.phoneHref} className="block text-xl font-bold mb-1">{SITE.phone}</a>
          <a href={`mailto:${SITE.email}`} className="block text-sm text-foreground/80 mb-4">{SITE.email}</a>
          <div className="flex flex-wrap gap-2">
            <a href={SITE.messengers.telegram} target="_blank" rel="noreferrer" className="h-10 px-4 border border-border text-sm font-medium flex items-center gap-2 hover:bg-black hover:text-white transition-colors"><Send size={14} /> Telegram</a>
            <a href={SITE.messengers.whatsapp} target="_blank" rel="noreferrer" className="h-10 px-4 border border-border text-sm font-medium flex items-center gap-2 hover:bg-black hover:text-white transition-colors"><MessageCircle size={14} /> WhatsApp</a>
            <a href={SITE.messengers.max} target="_blank" rel="noreferrer" className="h-10 px-4 border border-border text-sm font-medium flex items-center gap-2 hover:bg-black hover:text-white transition-colors"><MaxIcon size={14} /> MAX</a>
          </div>
        </div>
        <div className="bg-card p-6">
          <div className="font-semibold mb-2">Шоурум</div>
          <p className="text-sm text-foreground/80 mb-1">{SITE.showroom.address}</p>
          <p className="text-sm text-foreground/80">{SITE.showroom.hours}</p>
        </div>
      </div>
      <div className="overflow-hidden border border-border mb-8">
        <iframe
          title="Карта"
          src="https://yandex.ru/map-widget/v1/?text=%D0%9D%D0%B8%D0%B6%D0%BD%D1%8F%D1%8F%20%D0%A1%D1%8B%D1%80%D0%BE%D0%BC%D1%8F%D1%82%D0%BD%D0%B8%D1%87%D0%B5%D1%81%D0%BA%D0%B0%D1%8F%2010%20Artplay&z=16"
          className="w-full h-72"
          loading="lazy"
        />
      </div>
      <button onClick={() => setLead("callback")} className="h-12 px-8 bg-black text-white font-semibold text-sm hover:bg-[#c4b99a] hover:text-black transition-colors" data-ym="cta-contacts">
        Заказать обратный звонок
      </button>
      {lead && <LeadModal type={lead} onClose={() => setLead(null)} />}
    </div>
  );
}
