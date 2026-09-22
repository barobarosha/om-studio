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
