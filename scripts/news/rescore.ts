// npm run news:rescore: score pending items only (PRD I-5.5). Equivalent to `news:run -- --rescore`.
import { main } from "./run";

main(["--rescore", ...process.argv.slice(2)]).then(
  (code) => process.exit(code),
  () => process.exit(1),
);
