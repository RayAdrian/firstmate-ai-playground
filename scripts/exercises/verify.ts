// `npm run exercises:verify [-- <slug>...]`: run each automated exercise's verify command against starter/ (must fail)
// and solution/ (must pass), in throwaway copies (PRD E-4). EXERCISES_DIR and EXERCISES_VERIFY_TIMEOUT_MS override defaults.
import path from "node:path";
import { DEFAULT_TIMEOUT_MS, automationCoverage, verifyExercises } from "./lib";
import { readFileSync, existsSync, readdirSync } from "node:fs";

function collectVerifies(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const f of readdirSync(dir).sort()) {
    const p = path.join(dir, f, "exercise.json");
    if (!existsSync(p)) continue;
    try {
      const v = (JSON.parse(readFileSync(p, "utf8")) as { verify?: unknown }).verify;
      if (typeof v === "string") out.push(v);
    } catch {
      // reported by verifyExercises
    }
  }
  return out;
}

async function main(): Promise<number> {
  const exercisesDir = path.resolve(process.cwd(), process.env.EXERCISES_DIR ?? "exercises");
  const timeoutMs = Number(process.env.EXERCISES_VERIFY_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error("EXERCISES_VERIFY_TIMEOUT_MS must be a positive number.");
  const only = process.argv.slice(2).filter((a) => !a.startsWith("-"));

  const report = await verifyExercises({ exercisesDir, timeoutMs, only: only.length > 0 ? only : undefined });
  for (const line of report.lines) console.log(line);
  if (report.results.length === 0) console.log("exercises:verify: no exercises found.");

  let ok = report.ok;
  if (only.length === 0) {
    const coverage = automationCoverage(collectVerifies(exercisesDir));
    console.log(`exercises:verify: ${coverage.message}`);
    if (!coverage.ok) ok = false;
  }
  console.log(ok ? "exercises:verify: OK" : "exercises:verify: FAILED");
  return ok ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error(`exercises:verify: ${err instanceof Error ? err.message : "unexpected error"}`);
    process.exit(1);
  },
);
