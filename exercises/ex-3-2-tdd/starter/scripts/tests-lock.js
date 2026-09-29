// Records or checks a SHA-256 of everything under tests/.
//   node scripts/tests-lock.js --write   record the hash in tests.lock (do this once the tests are committed)
//   node scripts/tests-lock.js --check   exit 1 if any test file was added, removed or changed since
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const testsDir = join(root, "tests");
const lockFile = join(root, "tests.lock");

function listFiles(dir) {
  return readdirSync(dir)
    .flatMap((name) => {
      const p = join(dir, name);
      return statSync(p).isDirectory() ? listFiles(p) : [p];
    })
    .sort();
}

export function hashTests() {
  const hash = createHash("sha256");
  for (const file of listFiles(testsDir)) {
    hash.update(relative(root, file).split("\\").join("/") + "\0");
    hash.update(readFileSync(file));
    hash.update("\0");
  }
  return hash.digest("hex");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2];
  if (mode === "--write") {
    writeFileSync(lockFile, hashTests() + "\n");
    console.log("tests.lock written. Commit it together with the tests.");
  } else if (mode === "--check") {
    if (!existsSync(lockFile)) {
      console.error("tests.lock is missing. Write the tests, then run: npm run lock-tests");
      process.exit(1);
    }
    const expected = readFileSync(lockFile, "utf8").trim();
    if (hashTests() !== expected) {
      console.error("The files under tests/ changed since tests.lock was written. The tests are the contract: revert the change.");
      process.exit(1);
    }
    console.log("tests unchanged since tests.lock");
  } else {
    console.error("usage: node scripts/tests-lock.js --write | --check");
    process.exit(2);
  }
}
