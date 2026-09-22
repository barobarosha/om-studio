import { useEffect, useState } from "react";
import { trpc } from "@/providers/trpc";
import { ymGoal } from "@/lib/ym";
import { YM_EVENTS } from "@/lib/config";
import { getUtm } from "@/lib/utm";
import { X } from "lucide-react";

export type LeadType = "availability" | "callback" | "consultation" | "project";

export interface LeadContext {
  productId?: number;
  productName?: string;
  pageUrl?: string;
}

const TITLES: Record<LeadType, string> = {
  availability: "Узнать наличие",
  callback: "Заказать обратный звонок",
  consultation: "Получить консультацию",
  project: "Отправить проект на подбор",
};

const GOALS: Record<LeadType, string> = {
  availability: YM_EVENTS.leadAvailability,
  callback: YM_EVENTS.leadCallback,
  consultation: YM_EVENTS.leadConsultation,
  project: YM_EVENTS.leadProject,
};

export function LeadModal({ type, product, onClose }: { type: LeadType; product?: LeadContext; onClose: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [comment, setComment] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [website, setWebsite] = useState(""); // honeypot
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const mutation = trpc.leads.create.useMutation();

  useEffect(() => {
    ymGoal(YM_EVENTS.formOpen, { form: type });
  }, [type]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    let fileDataBase64: string | undefined;
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError("Файл больше 10 МБ — уменьшите или отправьте без файла.");
        return;
      }
      fileDataBase64 = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(",")[1]);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
    }
    try {
      await mutation.mutateAsync({
        formType: type,
        productId: product?.productId,
        productName: product?.productName,
        name,
        phone,
        email: email || undefined,
        comment: comment || undefined,
        pageUrl: product?.pageUrl ?? window.location.href,
        fileName: file?.name,
        fileDataBase64,
        utm: getUtm(),
        website,
      });
      ymGoal(GOALS[type], { product_id: product?.productId });
      setDone(true);
    } catch (err) {
      setError((err as Error).message || "Не удалось отправить. Попробуйте ещё раз или позвоните нам.");
      // данные в полях не очищаем — пользователь не теряет введённое
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between mb-4">
          <h3 className="font-display text-xl font-semibold">{TITLES[type]}</h3>
          <button onClick={onClose} aria-label="Закрыть" className="p-1 text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        {done ? (
          <div className="py-6 text-center">
            <div className="text-4xl mb-3">✓</div>
            <p className="font-semibold mb-1">Заявка отправлена</p>
            <p className="text-sm text-muted-foreground">Менеджер свяжется с вами в ближайшее рабочее время.</p>
            <button onClick={onClose} className="mt-5 h-10 px-6 rounded-md bg-primary text-primary-foreground text-sm font-semibold">
              Закрыть
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            {product?.productName && (
              <div className="text-xs bg-accent rounded-md px-3 py-2 text-accent-foreground">
                Товар: {product.productName}
              </div>
            )}
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ваше имя"
              className="w-full h-11 rounded-md border border-input px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              data-ym="lead-name"
            />
            <input
              required
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Телефон"
              className="w-full h-11 rounded-md border border-input px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              data-ym="lead-phone"
            />
            {type === "project" && (
              <>
                <input
                  type="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="E-mail или мессенджер (необязательно)"
                  className="w-full h-11 rounded-md border border-input px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <label className="block border border-dashed border-input rounded-md px-3 py-3 text-sm text-muted-foreground cursor-pointer hover:border-primary">
                  {file ? `Файл: ${file.name}` : "Прикрепить изображение или дизайн-проект (до 10 МБ)"}
                  <input
                    type="file"
                    accept="image/*,.pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              </>
            )}
            {(type === "consultation" || type === "project" || type === "availability") && (
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={type === "project" ? "Опишите задачу: помещение, формат, пожелания" : "Комментарий (необязательно)"}
                rows={3}
                className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            )}
            {/* honeypot: скрытое поле против спама */}
            <input
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              className="absolute opacity-0 h-0 w-0 pointer-events-none"
              aria-hidden="true"
              placeholder="website"
            />
            {error && <div className="text-sm text-destructive">{error}</div>}
            <button
              disabled={mutation.isPending}
              className="w-full h-11 rounded-md bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 disabled:opacity-60"
              data-ym={`lead-submit-${type}`}
            >
              {mutation.isPending ? "Отправляем…" : "Отправить"}
            </button>
            <p className="text-[11px] leading-snug text-muted-foreground">
              Нажимая «Отправить», вы соглашаетесь с{" "}
              <a href="/privacy" target="_blank" className="underline">
                политикой обработки персональных данных
              </a>
              .
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
