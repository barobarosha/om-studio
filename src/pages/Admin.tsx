import { useState } from "react";
import { trpc } from "@/providers/trpc";

export function AdminPage() {
  const auth = trpc.admin.check.useQuery();
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const login = trpc.admin.login.useMutation({
    onSuccess: () => auth.refetch(),
    onError: (e) => setLoginError(e.message),
  });

  if (auth.isLoading) return <div className="max-w-md mx-auto px-4 py-24 text-muted-foreground">Проверка доступа…</div>;

  if (!auth.data?.ok) {
    return (
      <div className="max-w-sm mx-auto px-4 py-24">
        <h1 className="font-display text-2xl font-semibold mb-2">Вход для администратора</h1>
        <p className="text-sm text-muted-foreground mb-6">Раздел доступен только сотрудникам ОМ Студия.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setLoginError("");
            login.mutate({ password });
          }}
          className="space-y-3"
        >
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Пароль"
            autoFocus
            className="w-full h-11 rounded-md border border-input px-3 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {loginError && <div className="text-sm text-destructive">{loginError}</div>}
          <button disabled={login.isPending} className="w-full h-11 rounded-md bg-black text-white text-sm font-semibold hover:bg-[#c4b99a] hover:text-black transition-colors">
            Войти
          </button>
        </form>
      </div>
    );
  }

  return <AdminDashboard />;
}

function AdminDashboard() {
  const runs = trpc.admin.importRuns.useQuery(undefined, { refetchInterval: 30000 });
  const sources = trpc.admin.sources.list.useQuery();
  const runImport = trpc.admin.runImport.useMutation({ onSuccess: () => runs.refetch() });
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [format, setFormat] = useState<"yml" | "csv" | "xlsx">("yml");
  const [msg, setMsg] = useState("");
  const addSource = trpc.admin.sources.add.useMutation({
    onSuccess: (r) => {
      setMsg(`Источник добавлен и загружен: обработано ${(r.stats as any).totalRows ?? 0} строк`);
      setName(""); setUrl("");
      sources.refetch(); runs.refetch();
    },
    onError: (e) => setMsg(`Ошибка загрузки: ${e.message}. Проверьте ссылку и формат — источник не сохранён.`),
  });
  const removeSource = trpc.admin.sources.remove.useMutation({ onSuccess: () => sources.refetch() });

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="font-display text-3xl font-semibold mb-2">Управление каталогом</h1>
      <p className="text-sm text-muted-foreground mb-8">Выгрузки поставщиков обновляются автоматически раз в час.</p>

      <AdminLeads rows={leadsList.data ?? []} loading={leadsList.isLoading} />
      <NotifySettings />

      {/* Добавление нового поставщика без разработчика */}
      <div className="border border-border bg-card p-6 mb-10">
        <h2 className="font-display text-xl font-semibold mb-1">Добавить поставщика</h2>
        <p className="text-sm text-muted-foreground mb-5">
          Вставьте ссылку на выгрузку — система сама распознает колонки (наименование, бренд, цена, остаток, фото) и загрузит товары. Дальше источник обновляется автоматически каждый час вместе с остальными.
        </p>
        <div className="grid sm:grid-cols-[1fr_2fr_160px_auto] gap-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название поставщика"
            className="h-11 rounded-md border border-input px-3 text-sm bg-white" />
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… (ссылка на выгрузку)"
            className="h-11 rounded-md border border-input px-3 text-sm bg-white" />
          <select value={format} onChange={(e) => setFormat(e.target.value as any)} className="h-11 rounded-md border border-input px-2 text-sm bg-white">
            <option value="yml">YML / XML (Яндекс.Маркет)</option>
            <option value="csv">CSV-таблица</option>
            <option value="xlsx">Excel (XLSX)</option>
          </select>
          <button
            disabled={!name || !url || addSource.isPending}
            onClick={() => { setMsg(""); addSource.mutate({ name, url, format }); }}
            className="h-11 px-6 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
          >
            {addSource.isPending ? "Загружаем…" : "Добавить"}
          </button>
        </div>
        {msg && <p className="text-sm mt-3">{msg}</p>}

        {(sources.data?.length ?? 0) > 0 && (
          <div className="mt-6 border-t border-border pt-4">
            <div className="text-sm font-semibold mb-2">Подключённые вами источники</div>
            {sources.data!.map((s) => (
              <div key={s.id} className="flex items-center gap-3 text-sm py-1.5">
                <span className="font-medium">{s.name}</span>
                <span className="text-muted-foreground text-xs truncate max-w-md">{s.url}</span>
                <span className="text-xs uppercase text-muted-foreground">{s.format}</span>
                <button onClick={() => removeSource.mutate({ id: s.id })} className="ml-auto text-xs text-destructive underline">Удалить</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl font-semibold">Журнал импортов</h2>
        <button onClick={() => runImport.mutate()} disabled={runImport.isPending}
          className="h-10 px-5 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60">
          {runImport.isPending ? "Импорт выполняется…" : "Запустить импорт сейчас"}
        </button>
      </div>
      <div className="overflow-x-auto border border-border rounded-lg bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="p-3">Поставщик</th><th className="p-3">Старт</th><th className="p-3">Статус</th>
              <th className="p-3">Строк</th><th className="p-3">Создано</th><th className="p-3">Обновлено</th>
              <th className="p-3">Архив</th><th className="p-3">Ошибки</th>
            </tr>
          </thead>
          <tbody>
            {(runs.data ?? []).map((r: any) => (
              <tr key={r.id} className="border-b border-border/50">
                <td className="p-3 font-medium">{r.supplier}</td>
                <td className="p-3 whitespace-nowrap">{r.startedAt ? new Date(r.startedAt).toLocaleString("ru-RU") : ""}</td>
                <td className="p-3">
                  <span className={r.status === "ok" ? "text-emerald-700" : r.status === "error" ? "text-destructive" : "text-amber-700"}>
                    {r.status === "ok" ? "успешно" : r.status === "error" ? "ошибка" : "в работе"}
                  </span>
                </td>
                <td className="p-3">{r.totalRows}</td>
                <td className="p-3">{r.created}</td>
                <td className="p-3">{r.updated}</td>
                <td className="p-3">{r.deactivated}</td>
                <td className="p-3 text-xs max-w-56 truncate" title={r.errors ?? ""}>{r.errors ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const FORM_TYPES = [
  { id: "availability", label: "Узнать наличие" },
  { id: "callback", label: "Обратный звонок" },
  { id: "consultation", label: "Консультация" },
  { id: "project", label: "Проект на подбор" },
];

const CHANNELS = [
  { id: "telegram", label: "Telegram", placeholder: "chat_id, напр. 123456789" },
  { id: "max", label: "MAX", placeholder: "chat_id диалога с ботом в MAX" },
  { id: "email", label: "E-mail", placeholder: "manager@om-studio.pro" },
];

const SETTING_FIELDS: { key: string; label: string; placeholder: string; secret?: boolean }[] = [
  { key: "telegram_bot_token", label: "Токен Telegram-бота", placeholder: "123456:ABC-…" },
  { key: "max_bot_token", label: "Токен бота MAX", placeholder: "токен из кабинета MAX" },
  { key: "mail_from", label: "Отправитель e-mail", placeholder: "site@om-studio.pro" },
  { key: "smtp_host", label: "SMTP-сервер", placeholder: "smtp.yandex.ru" },
  { key: "smtp_port", label: "SMTP-порт", placeholder: "465" },
  { key: "smtp_user", label: "SMTP-логин", placeholder: "site@om-studio.pro" },
  { key: "smtp_pass", label: "SMTP-пароль", placeholder: "••••••", secret: true },
];

function AdminLeads({ rows, loading }: { rows: any[]; loading: boolean }) {
  const typeLabel = (t: string) => FORM_TYPES.find((f) => f.id === t)?.label ?? t;
  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl font-semibold">Заявки с сайта</h2>
        <span className="text-xs text-muted-foreground">обновление каждые 30 сек</span>
      </div>
      {loading ? (
        <div className="text-sm text-muted-foreground border border-border rounded-lg bg-card p-6">Загружаем…</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-muted-foreground border border-border rounded-lg bg-card p-6">Заявок пока нет.</div>
      ) : (
        <div className="overflow-x-auto border border-border rounded-lg bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="p-3">Дата</th>
                <th className="p-3">Форма</th>
                <th className="p-3">Имя</th>
                <th className="p-3">Телефон</th>
                <th className="p-3">Товар</th>
                <th className="p-3">Комментарий</th>
                <th className="p-3">Файл</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id} className="border-b border-border/50 align-top">
                  <td className="p-3 whitespace-nowrap">{l.createdAt ? new Date(l.createdAt).toLocaleString("ru-RU") : ""}</td>
                  <td className="p-3 whitespace-nowrap">{typeLabel(l.formType)}</td>
                  <td className="p-3 font-medium">{l.name}</td>
                  <td className="p-3 whitespace-nowrap">
                    <a href={`tel:${l.phone.replace(/[^+\d]/g, "")}`} className="underline">{l.phone}</a>
                  </td>
                  <td className="p-3 max-w-56">
                    <span className="block truncate" title={l.productName ?? ""}>{l.productName ?? "—"}</span>
                  </td>
                  <td className="p-3 max-w-64">
                    <span className="block truncate" title={l.comment ?? ""}>{l.comment ?? "—"}</span>
                  </td>
                  <td className="p-3">{l.fileName ? <span title={l.fileName}>есть</span> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function NotifySettings() {
  const notify = trpc.admin.notify.list.useQuery();
  const addMut = trpc.admin.notify.add.useMutation({ onSuccess: () => notify.refetch() });
  const removeMut = trpc.admin.notify.remove.useMutation({ onSuccess: () => notify.refetch() });
  const setMut = trpc.admin.notify.setSetting.useMutation({ onSuccess: () => notify.refetch() });
  const [drafts, setDrafts] = useState<Record<string, { channel: string; target: string }>>({});
  const [vals, setVals] = useState<Record<string, string>>({});
  const targets = notify.data?.targets ?? [];
  const settings = notify.data?.settings ?? {};
  const draft = (formType: string) => drafts[formType] ?? { channel: "telegram", target: "" };

  return (
    <section className="border border-border bg-card p-6 mb-10">
      <h2 className="font-display text-xl font-semibold mb-1">Уведомления о заявках</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Для каждой формы укажите, куда дублировать новые заявки: Telegram, MAX или e-mail. Заявки в любом случае сохраняются в таблице выше.
      </p>

      <div className="text-sm font-semibold mb-2">Токены и почта</div>
      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        {SETTING_FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="text-xs text-muted-foreground">{f.label}</span>
            <div className="flex gap-2 mt-1">
              <input
                type={f.secret ? "password" : "text"}
                value={vals[f.key] ?? settings[f.key] ?? ""}
                onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="flex-1 h-10 rounded-md border border-input px-3 text-sm bg-white"
              />
              <button
                onClick={() => setMut.mutate({ key: f.key, value: vals[f.key] ?? settings[f.key] ?? "" })}
                disabled={setMut.isPending}
                className="h-10 px-4 rounded-md border border-border text-sm hover:border-primary disabled:opacity-50"
              >
                {setMut.isPending ? "…" : "Сохранить"}
              </button>
            </div>
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
        Как узнать chat_id: <b>Telegram</b> — напишите боту @userinfobot или откройте вашего бота и посмотрите id через метод getUpdates.
        <b> MAX</b> — откройте вашего бота в MAX и нажмите «Начать» (бот не может писать первым без этого), затем выполните
        GET https://platform-api.max.ru/updates с заголовком Authorization: токен — в ответе будет chat_id диалога.
      </p>

      {FORM_TYPES.map((ft) => {
        const list = targets.filter((t) => t.formType === ft.id);
        const d = draft(ft.id);
        return (
          <div key={ft.id} className="border-t border-border py-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-medium text-sm w-full sm:w-44">{ft.label}</span>
              <select
                value={d.channel}
                onChange={(e) => setDrafts((v) => ({ ...v, [ft.id]: { ...d, channel: e.target.value } }))}
                className="h-10 rounded-md border border-input px-2 text-sm bg-white"
              >
                {CHANNELS.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
              <input
                value={d.target}
                onChange={(e) => setDrafts((v) => ({ ...v, [ft.id]: { ...d, target: e.target.value } }))}
                placeholder={CHANNELS.find((c) => c.id === d.channel)?.placeholder}
                className="flex-1 min-w-48 h-10 rounded-md border border-input px-3 text-sm bg-white"
              />
              <button
                disabled={!d.target.trim() || addMut.isPending}
                onClick={() => {
                  addMut.mutate({ formType: ft.id, channel: d.channel, target: d.target.trim() });
                  setDrafts((v) => ({ ...v, [ft.id]: { ...d, target: "" } }));
                }}
                className="h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
              >
                Добавить
              </button>
            </div>
            {list.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {list.map((t) => (
                  <span key={t.id} className="inline-flex items-center gap-2 text-xs border border-border rounded-full px-3 py-1 bg-white">
                    {CHANNELS.find((c) => c.id === t.channel)?.label}: {t.target}
                    <button onClick={() => removeMut.mutate({ id: t.id })} className="text-destructive font-bold" aria-label="Удалить">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}