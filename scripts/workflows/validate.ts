// `npm run workflows:validate [-- <file>...]` (PRD §16.7 WF-1). No database or env file needed. See run-validate.ts.
import path from "node:path";
import { runValidate } from "./run-validate";

function main(): number {
  const contentDir = path.resolve(process.cwd(), process.env.CONTENT_DIR ?? "content");
  const now = process.env.FM_NOW ? new Date(process.env.FM_NOW) : new Date();
  if (Number.isNaN(now.getTime())) throw new Error("FM_NOW is not a valid ISO timestamp.");
  const r = runValidate(process.argv.slice(2).filter((a) => a !== "--"), { contentDir, now });
  for (const l of r.stdout) console.log(l);
  for (const l of r.stderr) console.error(l);
  return r.exitCode;
}

try {
  process.exit(main());
} catch (err: unknown) {
  console.error(`workflows:validate: ${err instanceof Error ? err.message : "unexpected error"}`);
  process.exit(1);
}
