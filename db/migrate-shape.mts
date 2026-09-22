import { getDb } from "../api/queries/connection";
import { sql } from "drizzle-orm";
const db = getDb();
const updShape = `
  UPDATE products SET shape = CASE
    WHEN LOWER(name) REGEXP 'hexagon|гексагон|шестигранн|esagon' THEN 'Шестигранник'
    WHEN size REGEXP '^[0-9]+([.,][0-9]+)?x[0-9]+([.,][0-9]+)?$' THEN
      IF(ABS(CAST(SUBSTRING_INDEX(REPLACE(size,',','.'),'x',1) AS DECIMAL(10,2)) - CAST(SUBSTRING_INDEX(REPLACE(size,',','.'),'x',-1) AS DECIMAL(10,2))) < 0.01, 'Квадрат', 'Прямоугольник')
    ELSE NULL END`;
const r: any = await db.execute(sql.raw(updShape));
console.log("shape backfilled, affected:", r[0].affectedRows);
const check: any = await db.execute(sql`SELECT design, count(*) c FROM products WHERE design IS NOT NULL GROUP BY design ORDER BY c DESC`);
console.log(check[0]);
const check2: any = await db.execute(sql`SELECT shape, count(*) c FROM products WHERE shape IS NOT NULL GROUP BY shape ORDER BY c DESC`);
console.log(check2[0]);
process.exit(0);
