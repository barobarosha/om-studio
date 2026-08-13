// CLI: npx tsx db/import-cli.ts [supplierCode|all]
import { runAllImports, runImport, dedupe } from "../api/importers/run";
import { SOURCES, SourceCode } from "../api/importers/sources";

const arg = process.argv[2] ?? "all";

async function main() {
  if (arg === "all") {
    const res = await runAllImports();
    console.log(JSON.stringify(res, null, 2));
  } else if (arg in SOURCES) {
    const res = await runImport(arg as SourceCode);
    console.log(JSON.stringify(res, null, 2));
    console.log("dedupe:", await dedupe());
  } else {
    console.error("Unknown supplier:", arg, "Available:", Object.keys(SOURCES).join(", "));
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
