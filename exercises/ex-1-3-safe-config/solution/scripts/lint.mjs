// A tiny stand-in for a linter: fails if any source file contains console.log.
import { readdirSync, readFileSync } from "node:fs";

const problems = [];
for (const file of readdirSync("src")) {
  const text = readFileSync(`src/${file}`, "utf8");
  if (text.includes("console.log")) problems.push(`src/${file}: remove console.log`);
}
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log("lint: OK");
