// `npm run workflows:scan [-- <path>...]` (PRD §16.7 WF-11). See run-scan.ts.
import path from "node:path";
import { runScan } from "./run-scan";

async function main(): Promise<number> {
  const contentDir = path.resolve(process.cwd(), process.env.CONTENT_DIR ?? "content");
  const r = await runScan(process.argv.slice(2).filter((a) => a !== "--"), { contentDir });
  for (const l of r.stdout) console.log(l);
  for (const l of r.stderr) console.error(l);
  return r.exitCode;
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error(`workflows:scan: ${err instanceof Error ? err.message : "unexpected error"}`);
    process.exit(1);
  },
);
