// Массовый поиск фото для ВСЕХ товаров без картинок.
// Запуск из папки проекта:  npx tsx db/find-photos-all.mts
// Идёт партиями по 30 товаров, между партиями пауза, чтобы Яндекс не показал капчу.
// Скрипт можно прервать (Ctrl+C) и запустить снова — обработанные товары пропускаются.
import { readFileSync } from "fs";
try {
  for (const l of readFileSync(".env", "utf8").split("\n")) {
    const m = l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*(?:\s+#.*)?$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL не найден. Убедитесь, что файл .env лежит в корне проекта.");
  process.exit(1);
}

const { findMissingPhotos } = await import("../api/importers/photos");

const BATCH = 30;
const PAUSE_MS = 5000;
let round = 0;
let totalSaved = 0;
let emptyRounds = 0;

while (true) {
  round++;
  const r = await findMissingPhotos(BATCH);
  totalSaved += r.saved;
  console.log(
    `Партия ${round}: проверено ${r.scanned}, найдено ${r.found}, сохранено фото ${r.saved}, не удалось ${r.failed}` +
      (r.errors.length ? ` | ошибки: ${r.errors.join("; ")}` : ""),
  );
  if (r.scanned === 0) {
    console.log("Товаров без фото больше нет. Готово!");
    break;
  }
  // Если партия совсем ничего не нашла несколько раз подряд — вероятно, капча. Делаем большую паузу.
  emptyRounds = r.found === 0 ? emptyRounds + 1 : 0;
  if (emptyRounds >= 3) {
    console.log("Яндекс временно ограничил запросы. Пауза 10 минут, потом продолжим…");
    emptyRounds = 0;
    await new Promise((r2) => setTimeout(r2, 10 * 60_000));
  } else {
    await new Promise((r2) => setTimeout(r2, PAUSE_MS));
  }
}
console.log(`Всего сохранено изображений: ${totalSaved}`);
process.exit(0);
