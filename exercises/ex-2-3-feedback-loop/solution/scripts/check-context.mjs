// Checks that the repo's context file tells the agent how to verify its own work.
import { existsSync, readFileSync } from "node:fs";

const fail = (msg) => {
  console.error(`context: ${msg}`);
  process.exit(1);
};

if (!existsSync("AGENTS.md")) fail("AGENTS.md is missing (write your verification loop there)");
const text = readFileSync("AGENTS.md", "utf8");

for (const cmd of ["npm run typecheck", "npm run lint", "npm test"]) {
  if (!text.includes(cmd)) fail(`AGENTS.md does not mention \`${cmd}\``);
}
if (!/^#+\s.*done/im.test(text)) fail('AGENTS.md needs a "Done" / "Definition of done" heading');
if (!/never|do not|don't/i.test(text)) fail("AGENTS.md should say what the agent must not do (for example, not weaken checks)");

if (existsSync("CLAUDE.md") && !/^@AGENTS\.md\s*$/m.test(readFileSync("CLAUDE.md", "utf8"))) {
  fail("CLAUDE.md exists but does not import AGENTS.md with a line `@AGENTS.md`");
}
console.log("context: ok");
