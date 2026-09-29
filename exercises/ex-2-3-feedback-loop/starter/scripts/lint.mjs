// House lint rules, dependency-free so the exercise installs fast.
// Real projects would use ESLint or Biome; the lesson is identical.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const rules = [
  { id: "no-console", re: /\bconsole\.\w+\(/, msg: "use the logger, not console" },
  { id: "no-var", re: /\bvar\s/, msg: "use const or let" },
  { id: "eqeqeq", re: /[^=!<>]==(?!=)|!=(?!=)/, msg: "use === and !==" },
  { id: "no-explicit-any", re: /\{any\b|<any>|\bas any\b/, msg: "no explicit any (in JSDoc types too)" },
];

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)],
  );

let problems = 0;
for (const file of walk("src").filter((f) => f.endsWith(".js"))) {
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, i) => {
      for (const rule of rules) {
        if (rule.re.test(line)) {
          console.error(`${file}:${i + 1}  ${rule.id}  ${rule.msg}`);
          problems++;
        }
      }
    });
}
if (problems > 0) {
  console.error(`\n${problems} lint problem(s)`);
  process.exit(1);
}
console.log("lint: clean");
