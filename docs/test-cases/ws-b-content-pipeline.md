# WS-B: Content pipeline test cases

Scope: `npm run seed` (validation, idempotent upsert, archive semantics), `npm run db:reset:test` fixtures and variants, `npm run exercises:verify`, `npm run content:stale`, and the §6 RLS contract (anon key read-only).
Owned paths: `scripts/seed/`, `scripts/exercises/`, `supabase/seed/`, `tests/fixtures/`. Tests go in `tests/unit/b/` (Vitest; the integration cases need `supabase start`) and `tests/e2e/b/`. The browser-facing E2E for S-3.1 is in [ws-m2-integration.md](ws-m2-integration.md). Rendering of seeded markdown is in [ws-c-curriculum-lesson.md](ws-c-curriculum-lesson.md).
Contract: [README.md](README.md) (case format, fixtures, AC IDs, AMB-nn). These cases are aligned with the frozen M0 contracts: `lessonFrontmatterSchema`, `levelsFileSchema` (`src/lib/contracts/lesson.ts`), `exerciseJsonSchema` / `checklistItemSchema` (`exercise.ts`), the row schemas (`rows.ts`), and migration `supabase/migrations/20260930000000_init.sql`. They also follow the implementer decisions in the README: the `CHECKLIST.md` item syntax, free lesson file names, and levels defined in `content/levels.yaml`.

**Baseline on `main` (b0b47d1).** `scripts/seed/index.ts`, `scripts/seed/reset-test.ts`, `scripts/seed/stale.ts` and `scripts/exercises/verify.ts` are M0 stubs that only print a message. Every case below is RED until WS-B replaces them. A run against the stubs must FAIL, never pass vacuously. In particular, a "nothing was written" assertion must also check that the command exited non-zero with the named error.

**Shared helpers for this file.** These are proposed. They belong in `tests/support/`, which is M0-owned and frozen (AMB-26). Until an M0 PR lands, keep private copies in `tests/unit/b/_support/`.

| Helper | What |
|---|---|
| `contentSandbox(fixtureName)` | Copies `tests/fixtures/content/<fixtureName>/` (a mini `content/` + `exercises/` tree) into a temp dir and returns its path. The seed is pointed at it with `CONTENT_DIR` and `EXERCISES_DIR` (AMB-B1, README §4 hook 6). |
| `runSeed(dir)` | Spawns `npm run seed` with the sandbox env; resolves `{ code, stdout, stderr }`. |
| `dumpTables()` | Service-role read of `levels`, `lessons`, `exercises`, `news_sources` with **every column**, ordered by `slug`, serialised to stable JSON. Used for byte-identical comparisons. |
| `anonClient()` / `serviceClient()` | Supabase clients from `SUPABASE_URL` plus `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` (the names in `.env.example` and CI). `serviceClient()` wraps `getServiceClient()` from `src/lib/db/service.ts`, which tests and scripts may import. |
| `content-valid` | Sandbox fixture: `content/levels.yaml` with 2 levels, 4 lesson files, 2 exercises, mirroring the `fx-base` curriculum (README §3.1) as repo files. Content files require one exercise per lesson (`exercise` is required in frontmatter), so `content-valid` also has `ex-fx-perm` (for `l1-permissions`) and `ex-fx-mem` (for `l2-memory`), both `"verify": "manual"`. It is a superset of `fx-base`'s 2 exercises (AMB-25). |

All integration cases start from `supabase start` plus `npm run db:reset:test -- --variant=fx-no-content`, unless stated otherwise, so the seed writes into empty content tables.

---

## Suite B1: Content structure and happy-path seed

### TC-B-01: Seed loads a valid content tree
- **ACs:** S-1.1, S-1.2
- **Level:** integration
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-no-content`; `contentSandbox('content-valid')`.
- **Steps:**
  1. `runSeed(dir)`.
  2. `dumpTables()`.
- **Expected:**
  - Exit code 0.
  - `levels` has 2 rows (`l1`, `l2`), whose `number`, `slug`, `title` and `summary` equal the entries in `content/levels.yaml` (`levelsFileSchema`). `sort` equals `number` (AMB-B26).
  - `lessons` has 4 rows. Their `slug`, `sort`, `title`, `objective`, `est_minutes`, `tool_versions`, `last_verified_on` and `differences` equal the frontmatter values. `level_id` is the `levels.id` whose `number` equals frontmatter `level`.
  - `concept_md`, `claude_md` and `codex_md` equal the text under `## Concept`, `## Claude Code` and `## Codex CLI` (headings excluded, trimmed).
  - `exercises` has 4 rows, each linked to the lesson whose frontmatter `exercise` names it.
  - Every `archived_at` is null.
  - Every `id` matches the UUID v4 regex and comes from `gen_random_uuid()`: the seed never sends an `id`.

### TC-B-02: Lesson file name is free; folder vs frontmatter level mismatch
- **ACs:** S-1.1, S-2.1
- **Level:** integration
- **Priority:** P0
- **Category:** Edge
- **Preconditions / fixtures:** `content-valid` sandbox. (a) Rename `content/lessons/l1/l1-first-session.md` to `content/lessons/l1/01 intro.md`, keeping frontmatter `slug: l1-first-session`. (b) Separately, move `l1-permissions.md` into `content/lessons/l2/`, keeping frontmatter `level: 1`.
- **Steps:**
  1. (a) `runSeed(dir)`; `dumpTables()`.
  2. (b) `dumpTables()` (before); `runSeed(dir)`; `dumpTables()` (after).
- **Expected:**
  - (a): exit 0. The lesson row has slug `l1-first-session`: the slug comes from frontmatter, never from the file name (implementer decision). A second seed after renaming the file back produces no diff (TC-B-26 rule).
  - (b), mismatch treated as an error (AMB-B2): exit non-zero; stderr contains the path `content/lessons/l2/l1-permissions.md`, the field `level` and a reason saying the folder and frontmatter disagree; the before and after dumps are byte-identical.
  - If AMB-B2 is decided as "frontmatter wins", (b) instead asserts exit 0 and `level_id` = level 1.

### TC-B-03: Body sections are parsed by exact headings
- **ACs:** S-1.1
- **Level:** unit
- **Priority:** P0
- **Category:** Edge
- **Preconditions / fixtures:** Pure parser `parseLesson(markdown)` from `scripts/seed/`. Inputs built inline.
- **Steps:**
  1. Parse a body whose sections appear in the order `## Codex CLI`, `## Concept`, `## Claude Code`.
  2. Parse a body where `## Claude Code` contains a nested `### Claude Code tips` subheading and a fenced block containing the line `## Codex CLI`.
  3. Parse a body with a `## Notes` section between `## Concept` and `## Claude Code`.
- **Expected:**
  1. Sections are mapped by heading text, not position.
  2. The `###` subheading stays inside `claude_md`. The `## Codex CLI` line inside the fenced block does not start a section.
  3. Validation fails with reason "unknown section 'Notes'". If AMB-B3 decides the text is appended to the preceding section instead, the test pins that. Either way the text is never silently dropped.

### TC-B-04: Exercise definition comes from exercise.json plus CHECKLIST.md
- **ACs:** S-1.2, E-4.1
- **Level:** integration
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `content-valid` sandbox.
  - `exercises/ex-fx-auto/exercise.json` = `{"slug":"ex-fx-auto","verify":"npm test","required_tool_features":[],"title":"Fixture auto","goal":"Make the test green.","starter_prompts":{"claude":"Claude prompt fx","codex":"Codex prompt fx"},"solution_notes":["n1","n2","n3"]}`.
  - Its `CHECKLIST.md`:
    ```
    - [ ] c1: Test is green
    - [ ] {#c2} No test files edited
    - [ ] c3: Diff reviewed
    ```
  - `ex-fx-manual/exercise.json` has `"verify": "manual"`.
- **Steps:**
  1. `runSeed(dir)`.
  2. Read the `exercises` rows `ex-fx-auto` and `ex-fx-manual`.
- **Expected:**
  - `ex-fx-auto.checklist` = `[{id:"c1",text:"Test is green"},{id:"c2",text:"No test files edited"},{id:"c3",text:"Diff reviewed"}]`, in file order. Both item syntaxes are accepted in one file.
  - `verify_cmd` = `npm test`: the row column is derived from `exercise.json` `verify`.
  - `repo_path` = `exercises/ex-fx-auto/starter`.
  - `setup_cmd` = `cp -r exercises/ex-fx-auto/starter ~/fm-ex/ex-fx-auto && cd ~/fm-ex/ex-fx-auto && npm i`. That is the PRD E-1 template, used when `exercise.json` has no `setup_cmd`. When `setup_cmd` is present, it is stored verbatim.
  - `starter_prompts` = `{claude:"Claude prompt fx", codex:"Codex prompt fx"}`; `solution_notes` = `["n1","n2","n3"]`.
  - `ex-fx-manual.verify_cmd` is null, because `"manual"` maps to null.

### TC-B-05: Raw HTML in markdown is stored verbatim
- **ACs:** S-1.1, L-7.1
- **Level:** integration
- **Priority:** P0
- **Category:** Security
- **Preconditions / fixtures:** `content-valid` sandbox where the concept of `l2-memory`'s file contains `<script>window.__xss=1</script>` and `<img src=x onerror="window.__xss=2">`.
- **Steps:**
  1. `runSeed(dir)`.
  2. Read `lessons.concept_md` for `l2-memory`.
- **Expected:** The column contains both strings byte for byte. The seed neither strips nor escapes them; safe rendering is WS-C's job (the TC-C cases for L-7.1). This keeps the XSS fixture meaningful.

### TC-B-06: Unicode, BOM and CRLF content is normalised identically
- **ACs:** S-1.1, S-2.2
- **Level:** integration
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:** Two sandboxes with the same lesson `l1-first-session`. Sandbox A has LF endings and no BOM. Sandbox B has a UTF-8 BOM and CRLF endings. The title is `Café — 初めての session ✓`.
- **Steps:**
  1. Seed A into `fx-no-content`; record the lesson row.
  2. Reset to `fx-no-content`, seed B; record the row.
- **Expected:**
  - Both seeds exit 0.
  - `title` equals `Café — 初めての session ✓` exactly (NFC).
  - `concept_md`, `claude_md`, `codex_md` and `content_hash` are identical between A and B: line endings are normalised to LF and the BOM is removed before hashing. A BOM must not stop gray-matter from finding the frontmatter.

---

## Suite B2: Validation and all-or-nothing

### TC-B-07: One invalid lesson among valid files writes nothing
- **ACs:** S-2.1
- **Level:** integration
- **Priority:** P0
- **Category:** Error
- **Preconditions / fixtures:** Tables are already seeded from `content-valid`, so they are not empty. The new sandbox is `content-valid` with the `l2-memory` title changed to `Memory v2` **and** `est_minutes: "twenty"` in the frontmatter of `l1-permissions`.
- **Steps:**
  1. `dumpTables()` (before).
  2. `runSeed(dir)`.
  3. `dumpTables()` (after).
- **Expected:**
  - Exit code non-zero.
  - stderr names the `l1-permissions` file path (relative to the content root), the field `est_minutes`, and the zod reason (for example "expected number").
  - The `Memory v2` title change is **not** applied: the before and after dumps are byte-identical, including `updated_at`. The whole seed is one transaction.

### TC-B-08: Multiple invalid files are all reported
- **ACs:** S-2.1
- **Level:** integration
- **Priority:** P1
- **Category:** Error
- **Preconditions / fixtures:** `content-valid` with 3 faults:
  - `l1-first-session` has no `objective`.
  - `ex-fx-manual/exercise.json` has `"verify": 42`.
  - The level 2 entry in `content/levels.yaml` has no `title`.
- **Steps:**
  1. `runSeed(dir)`.
- **Expected:**
  - Exit non-zero.
  - stderr lists all 3 faults before exiting, each with its file path, field (`objective`, `verify`, `levels[1].title`) and reason. Validation runs over every file before any write.
  - Nothing is written.
  - If the team chooses fail-fast (AMB-B5), this case asserts the first fault only.

### TC-B-09: differences count boundaries
- **ACs:** S-2.1
- **Level:** unit
- **Priority:** P0
- **Category:** Boundary
- **Preconditions / fixtures:** `lessonFrontmatterSchema` (`differences: z.array(z.string().min(1)).min(1).max(5)`), run through the seed validator.
- **Steps:**
  1. Validate frontmatter with `differences` of length 0, 1, 5 and 6.
  2. Validate `differences: ["", "ok"]` and `differences: "not an array"`.
- **Expected:**
  - Lengths 1 and 5 pass. Lengths 0 and 6 fail on field `differences`.
  - The empty-string bullet fails on `differences[0]`.
  - The non-array fails.
  - The DB check `cardinality(differences) between 1 and 5` is only a backstop. The seed must reject these cases before any SQL runs, with the file path in the message.

### TC-B-10: est_minutes boundaries
- **ACs:** S-2.1
- **Level:** unit
- **Priority:** P0
- **Category:** Boundary
- **Preconditions / fixtures:** `lessonFrontmatterSchema` (`est_minutes: z.number().int().positive()`).
- **Steps:**
  1. Validate `est_minutes` = 1, 0, -5, 12.5, `"20"` and missing.
- **Expected:**
  - 1 passes.
  - 0, -5, 12.5, `"20"` and missing all fail on field `est_minutes`. Note that 0 is rejected by the contract even though the DB check (`est_minutes >= 0`) would accept it. The seed must reject it before writing.
- **Notes:** Resolves AMB-B6.

### TC-B-11: last_verified_on date validation
- **ACs:** S-2.1
- **Level:** unit
- **Priority:** P0
- **Category:** Boundary
- **Preconditions / fixtures:** `lessonFrontmatterSchema` (`last_verified_on` is a `YYYY-MM-DD` **string**, checked by regex only). Frontmatter is parsed with gray-matter (js-yaml). `FM_NOW=2026-09-30T13:00:00+08:00`.
- **Steps:**
  1. Validate `last_verified_on` = `"2026-09-30"` (quoted), `2026-09-30` (unquoted YAML), `"2026-02-30"`, `"30/09/2026"`, `"2026-10-01"` and missing.
  2. Seed a lesson with the unquoted value, run with `TZ=America/Los_Angeles`, and read the row.
- **Expected:**
  - Quoted `"2026-09-30"` passes.
  - Unquoted `2026-09-30`: js-yaml turns it into a JS `Date`, which the string schema rejects. The seed must normalise `Date` values to `YYYY-MM-DD` before validation, using the UTC date part. The stored value must be `2026-09-30`, not `2026-09-29`, under any process TZ (AMB-B22).
  - `"2026-02-30"` passes the contract regex but is not a real date. The seed must reject it with path, field and reason ("invalid calendar date") rather than let the Postgres `date` cast abort the transaction with a raw SQL error (AMB-B21).
  - `"30/09/2026"` fails on `last_verified_on`.
  - `"2026-10-01"` (in the future relative to `FM_NOW`) passes, because the contract has no future check (AMB-B7).
  - Missing fails.

### TC-B-12: tool_versions shape
- **ACs:** S-2.1
- **Level:** unit
- **Priority:** P0
- **Category:** Negative
- **Preconditions / fixtures:** `toolVersionsSchema` (`claude_code` and `codex_cli`: `z.string().min(1)`).
- **Steps:**
  1. Validate `tool_versions` = `{claude_code: "2.1.0", codex_cli: "0.40.0"}`, `{claude_code: "2.1.0"}`, `{claude_code: "2.1.0", codex_cli: "latest"}`, `{claude_code: 2.1, codex_cli: "0.40.0"}`, `{claude_code: "", codex_cli: "0.40.0"}` and `{claude_code: "2.1.0", codex_cli: "0.40.0", cursor: "1"}`.
- **Expected:**
  - The first passes.
  - Missing `codex_cli` fails on `tool_versions.codex_cli`.
  - `"latest"` **passes**: the contract has no semver check. `content:stale` must then treat it as unknown, not as "behind" (TC-B-46).
  - Numeric `2.1` fails, because it must be a string. Unquoted YAML floats lose the difference between `2.10` and `2.1`, so authors must quote versions.
  - The empty string fails.
  - The extra key `cursor` is stripped (zod's default non-strict object), not stored.

### TC-B-13: Duplicate slug across files
- **ACs:** S-2.1, S-2.2
- **Level:** integration
- **Priority:** P0
- **Category:** Negative
- **Preconditions / fixtures:** `content-valid` plus `content/lessons/l2/copy.md` with frontmatter `slug: l1-first-session`. File names are free, so the only identity is the slug.
- **Steps:**
  1. `runSeed(dir)`.
- **Expected:**
  - Non-zero exit.
  - stderr names both file paths, the field `slug` and the reason "duplicate slug".
  - Nothing is written. Without this check, upsert-by-slug would let the later file silently overwrite the earlier one.

### TC-B-14: Duplicate sort within a level
- **ACs:** S-2.1
- **Level:** integration
- **Priority:** P1
- **Category:** Negative
- **Preconditions / fixtures:** `content-valid` with `sort: 1` in the frontmatter of `l1-permissions`, the same value as `l1-first-session`. The DB has no unique constraint on `(level_id, sort)`.
- **Steps:**
  1. `runSeed(dir)`.
- **Expected:**
  - Non-zero exit, naming both files and the field `sort`.
  - Nothing is written. Otherwise the C-1.1 order and L-6.1 previous/next become non-deterministic.
- **Notes:** See AMB-B8.

### TC-B-15: Exercise references must resolve
- **ACs:** S-2.1, S-1.2
- **Level:** integration
- **Priority:** P0
- **Category:** Negative
- **Preconditions / fixtures:** Four sandboxes:
  - (a) lesson frontmatter `exercise: ex-does-not-exist`;
  - (b) two lessons naming the same exercise `ex-fx-auto`;
  - (c) `exercise.json` `slug` differs from its folder name;
  - (d) lesson frontmatter with no `exercise` key.
- **Steps:**
  1. `runSeed` on each.
- **Expected:** Each exits non-zero with the path, field and reason. Nothing is written.
  - (a): field `exercise`, reason "unknown exercise".
  - (b): field `exercise`, reason "exercise already linked to l1-first-session" (`exercises.lesson_id` is unique).
  - (c): field `slug`, reason "slug does not match folder".
  - (d): field `exercise` is required by `lessonFrontmatterSchema`.

### TC-B-16: exercise.json schema
- **ACs:** S-2.1, E-4.1
- **Level:** unit
- **Priority:** P0
- **Category:** Boundary
- **Preconditions / fixtures:** `exerciseJsonSchema`.
- **Steps:**
  1. Validate each of these:
     - (a) `{slug:"ex-a", verify:"npm test", required_tool_features:["hooks"]}`
     - (b) `{slug:"ex-a", verify:"manual", required_tool_features:[]}`
     - (c) `verify: ""`
     - (d) `verify: "MANUAL"`
     - (e) `required_tool_features` missing
     - (f) `solution_notes` of length 1, 2, 5 and 6
     - (g) `starter_prompts: {claude:"x"}` (no `codex`)
     - (h) the unknown extra key `requiredKeys: ["OPENAI_API_KEY"]`
     - (i) the legacy key `verify_cmd: "npm test"` with no `verify`
- **Expected:**
  - (a) and (b) pass. `"manual"` maps to `verify_cmd` null in the row.
  - (c) fails (`min(1)`).
  - (d) **passes the schema as a command string**. The seed must then either reject it or treat it as a command, which fails at verify time. Pin the choice (AMB-B9); the contract literal is lowercase `"manual"`.
  - (e) fails.
  - (f): 2 and 5 pass; 1 and 6 fail.
  - (g) fails, because both prompts are required when `starter_prompts` is present.
  - (h) is **stripped, not rejected** (non-strict zod object). The paid-key guard therefore cannot rely on the schema; TC-B-43 greps instead.
  - (i) fails on the missing `verify`. The old field name must not be silently accepted.

### TC-B-17: CHECKLIST.md item syntax
- **ACs:** S-2.1, S-1.2, E-2.2
- **Level:** unit
- **Priority:** P0
- **Category:** Boundary
- **Preconditions / fixtures:** Checklist parser `parseChecklist(md)`. Output items are validated with `checklistItemSchema` (`id` and `text` non-empty). Inputs built inline.
- **Steps:**
  1. `- [ ] c1: Test is green` and `- [ ] {#c1} Test is green`, each alone.
  2. Mixed forms in one file: `- [ ] c1: A` / `- [ ] {#c2} B`.
  3. Missing id: `- [ ] Test is green`.
  4. Duplicate ids: `c1`, `c2`, `c1`, and duplicates across the two forms (`- [ ] c1: A` / `- [ ] {#c1} B`).
  5. A checked source item: `- [x] c1: A`.
  6. Indentation: `  - [ ] c2: B` (2 spaces, nested under `c1`) and a top-level item indented by 1 space.
  7. Ids with punctuation: `c-1`, `c_1`, `c.1`, and `c:1` in both forms (`- [ ] c:1: text` and `- [ ] {#c:1} text`).
  8. Empty text: `- [ ] c1:` and `- [ ] {#c1}`.
  9. Non-item lines (a `# Checklist` heading, prose, blank lines) mixed with items.
  10. A file with no items.
- **Expected:**
  1. Both give `{id:"c1", text:"Test is green"}`.
  2. Both items, in file order.
  3. Fails, naming the line number and "missing item id". Ids are never generated from text, because that would break E-2.2 when the text is reworded.
  4. Fails, naming the duplicate `c1` and both line numbers.
  5. Accepted as `{id:"c1", text:"A"}`. The `[x]` is ignored, because content never pre-checks a learner's state.
  6. The nested item is rejected with "nested checklist items are not supported" (AMB-B4). A 1-space-indented top-level item is accepted.
  7. `c-1` and `c_1` pass. `c.1` and `c:1` follow AMB-B4, which assumes `^[a-z0-9_-]+$`, so both fail. The colon form `c:1: text` is ambiguous to parse, which is why colons in ids are rejected.
  8. Both fail (`text` is `min(1)`).
  9. Non-item lines are ignored; only items count.
  10. Fails, because a checklist needs at least one item.

### TC-B-18: Rewording an item keeps its id
- **ACs:** E-2.2, S-2.2
- **Level:** integration
- **Priority:** P0
- **Category:** Edge
- **Preconditions / fixtures:** `content-valid` seeded.
- **Steps:**
  1. Change line `- [ ] {#c2} No test files edited` to `- [ ] c2: No test files were edited` (new text **and** the other syntax). Re-seed.
  2. Remove item `c3`. Re-seed.
- **Expected:**
  - After step 1: `checklist` = `[{c1,…},{c2,"No test files were edited"},{c3,…}]`, and the exercise `id` is unchanged. Switching syntax does not change identity.
  - After step 2: `checklist` has only `c1` and `c2`.
  - The UI side (state kept, count drops) belongs to WS-C and WS-D.

### TC-B-19: YAML frontmatter is parsed safely
- **ACs:** S-2.1
- **Level:** unit
- **Priority:** P0
- **Category:** Security
- **Preconditions / fixtures:** The seed's frontmatter parser (gray-matter with the js-yaml safe schema), and the `content/levels.yaml` parser (`yaml` package).
- **Steps:**
  1. Parse frontmatter containing `title: !!js/function "function(){ globalThis.pwned = 1 }"`.
  2. Parse frontmatter that uses an anchor and alias (`objective: &o "x"` / `title: *o`).
  3. Parse a billion-laughs alias bomb (9 nested levels) as frontmatter and as `levels.yaml`.
  4. Parse `__proto__: { polluted: true }`.
  5. Parse frontmatter that uses gray-matter's JS engine delimiter `---js` followed by `globalThis.pwned = 2`.
- **Expected:**
  1. Fails validation with an unknown tag, and `globalThis.pwned` is undefined.
  2. Either passes with both values equal to `x` or is rejected (AMB-B10), but never throws uncaught.
  3. Fails fast within 1s (alias count limit).
  4. Does not set `({}).polluted`.
  5. Rejected or treated as YAML. `globalThis.pwned` stays undefined: the seed must not enable gray-matter's `js`/`javascript` engines.

### TC-B-20: Frontmatter and levels slug format
- **ACs:** S-2.1
- **Level:** unit
- **Priority:** P1
- **Category:** Boundary
- **Preconditions / fixtures:** `lessonFrontmatterSchema` and `levelContentSchema` (slug regex `^[a-z0-9]+(?:-[a-z0-9]+)*$`).
- **Steps:**
  1. Validate lesson slugs `l2-context-files`, `L2-Context`, `l2 context`, `l2/../x`, `l2--x`, `-l2`, `` (empty) and a 300-char valid-pattern slug.
  2. Validate the same set as a `levels.yaml` slug and as an `exercise` reference.
- **Expected:**
  - Only `l2-context-files` and the 300-char slug pass.
  - Slugs flow into the URL `/lessons/<slug>` and into filesystem paths. The contract regex rejects `/`, `..`, uppercase, spaces, double hyphens and a leading hyphen.
  - The contract has no maximum length, so the 300-char slug passes (AMB-B11: the length limit is still open).

---

## Suite B3: Tool sections (S-4)

### TC-B-21: Both tool sections present
- **ACs:** S-4.1
- **Level:** integration
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `content-valid`.
- **Steps:**
  1. `runSeed(dir)`; read `l1-first-session`.
- **Expected:** `claude_md` and `codex_md` are non-empty. `claude_no_equivalent = false` and `codex_no_equivalent = false` (the frontmatter defaults). `claude_workaround_md` and `codex_workaround_md` are null.

### TC-B-22: Missing Codex section without the flag fails the seed
- **ACs:** S-4.1, S-2.1
- **Level:** integration
- **Priority:** P0
- **Category:** Error
- **Preconditions / fixtures:** `content-valid` with the `## Codex CLI` section deleted from the `l2-context-files` file. The frontmatter keeps the default `codex_no_equivalent: false`.
- **Steps:**
  1. `dumpTables()`; `runSeed(dir)`; `dumpTables()`.
- **Expected:**
  - Non-zero exit, naming the `l2-context-files` file path and the reason "missing ## Codex CLI section and codex_no_equivalent is not set".
  - The dumps are identical.
  - Repeat with `## Claude Code` removed: same result, naming Claude Code and `claude_no_equivalent`.

### TC-B-23: Empty tool section (heading only) is treated as missing
- **ACs:** S-4.1, L-3.2
- **Level:** integration
- **Priority:** P0
- **Category:** Boundary
- **Preconditions / fixtures:** The `l2-context-files` file with `## Codex CLI` followed only by whitespace, and `codex_no_equivalent: false`.
- **Steps:**
  1. `runSeed(dir)`.
- **Expected:** Non-zero exit, with the same reason as TC-B-22. This guards L-3.2 "never shows an empty panel". The DB check `lessons_codex_body` would accept an empty string, so only the seed can catch this.

### TC-B-24: No-equivalent flag stores the section as the workaround
- **ACs:** S-4.1, L-3.2
- **Level:** integration
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `content-valid`. The `l1-permissions` frontmatter has `codex_no_equivalent: true`, and its `## Codex CLI` section body is `Use a sandbox profile.`.
- **Steps:**
  1. `runSeed(dir)`; read `l1-permissions`.
  2. Change the section to whitespace only (flag still true); re-seed.
  3. With the service role, insert a lesson row directly with `codex_no_equivalent=true`, `codex_md=null` and `codex_workaround_md=null`.
- **Expected:**
  1. `codex_no_equivalent = true`. `codex_md` is null. `codex_workaround_md` = `Use a sandbox profile.`. `claude_md` is non-empty and `claude_workaround_md` is null. WS-C renders this under the Notice "No native equivalent in Codex CLI (as of v0.40.0)" and the h4 "Closest workaround" (DESIGN §4.4).
  2. Non-zero exit with the path and the reason "codex_no_equivalent requires a workaround in the ## Codex CLI section". Nothing is written.
  3. Postgres rejects the insert with SQLSTATE `23514`, naming constraint `lessons_codex_workaround` (the DB backstop).
- **Notes:** AMB-B12 is resolved by the M0 columns.

### TC-B-25: Flag interplay: both tools flagged, and a flag without a section
- **ACs:** S-4.1, S-2.1
- **Level:** integration
- **Priority:** P1
- **Category:** Negative
- **Preconditions / fixtures:** Two sandboxes: (a) `claude_no_equivalent: true` **and** `codex_no_equivalent: true` on one lesson, both sections holding workaround text; (b) `codex_no_equivalent: true` and no `## Codex CLI` heading at all.
- **Steps:**
  1. `runSeed` on each.
- **Expected:**
  - (a): non-zero exit, reason "a lesson must have a native section for at least one tool" (AMB-B23).
  - (b): non-zero exit, same reason as TC-B-24 step 2 (no workaround).
  - Nothing is written in either case.

---

## Suite B4: Idempotency and archive semantics

### TC-B-26: Second seed produces no diff
- **ACs:** S-2.2
- **Level:** integration
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `fx-no-content`; `content-valid`.
- **Steps:**
  1. `runSeed(dir)`; `dumpTables()` → D1.
  2. Wait 1.1s, so any `now()` would differ. `runSeed(dir)`; `dumpTables()` → D2.
- **Expected:**
  - D1 and D2 are byte-identical, including `id`, `updated_at`, `content_hash` and `archived_at`.
  - Seed stdout for run 2 reports `0 inserted, 0 updated, 0 archived` (or equivalent counts).
  - This proves the upsert only touches rows whose `content_hash` changed. The column default `updated_at default now()` means any unconditional upsert would fail this case.

### TC-B-27: Changing one field updates exactly one row
- **ACs:** S-2.2, S-3.1
- **Level:** integration
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `content-valid` seeded (D1).
- **Steps:**
  1. Change the `l2-context-files` title to `Project instructions (edited)`; `runSeed(dir)`; dump → D2.
- **Expected:**
  - Only the `l2-context-files` row differs: `title` is new, `content_hash` has changed, `updated_at` is later than before, and `id` is unchanged.
  - Every other row is identical to D1.
- **Notes:** The browser half of S-3.1 is in M2.

### TC-B-28: Removed lesson is archived, not deleted
- **ACs:** S-2.3, C-1.3
- **Level:** integration
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `content-valid` seeded; record the ids of `l2-memory` and `ex-fx-mem`.
- **Steps:**
  1. Delete the `l2-memory` lesson file and `exercises/ex-fx-mem/` together (the lesson's exercise must go with it, see TC-B-15a); `runSeed(dir)`.
  2. Query `lessons` for slug `l2-memory` and `exercises` for `ex-fx-mem` with the service role.
- **Expected:**
  - Both rows still exist with the same `id`, and `archived_at` is non-null.
  - Row counts are unchanged. No DELETE is issued: row counts per table never decrease across any seed run.
  - The FKs are `on delete restrict`, so a hard delete would fail anyway once exercises exist.

### TC-B-29: Re-adding content clears archived_at and keeps the id
- **ACs:** S-2.3, C-1.3
- **Level:** integration
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** State after TC-B-28.
- **Steps:**
  1. Restore the lesson file under a **different** file name (`memory.md`) and restore `exercises/ex-fx-mem/`; `runSeed(dir)`.
- **Expected:**
  - `archived_at` is null on both rows, and the `id` equals the recorded id, so anything keyed to the lesson id stays valid. Matching is by frontmatter slug, never by file name.
  - A third seed produces no diff (TC-B-26 rule).

### TC-B-30: Removed exercise and removed level are archived
- **ACs:** S-2.3
- **Level:** integration
- **Priority:** P0
- **Category:** Edge
- **Preconditions / fixtures:** `content-valid` seeded.
- **Steps:**
  1. Delete `exercises/ex-fx-manual/` **only**, and keep the `l2-context-files` lesson, which still says `exercise: ex-fx-manual`. Seed.
  2. Delete `exercises/ex-fx-manual/` together with the `l2-context-files` lesson file. Seed.
  3. Remove level 2 from `content/levels.yaml` and delete every level-2 lesson file and its exercises. Seed.
  4. Remove level 2 from `levels.yaml` but keep its lesson files. Seed.
- **Expected:**
  1. Fails: the lesson points to an unknown exercise (TC-B-15a). Nothing is written. An exercise cannot be archived while its lesson is live, because `exercise` is required.
  2. Both the lesson and the exercise are archived.
  3. Level `l2`, its lessons and their exercises are all archived. `levels.archived_at` is set.
  4. Fails with the path of each orphaned lesson file, field `level`, and reason "level 2 is not defined in content/levels.yaml". Nothing is written.
- **Notes:** See AMB-B13 for cascade rules when level 2 is later restored.

### TC-B-31: Slug rename archives the old row and inserts a new one
- **ACs:** S-2.2, S-2.3
- **Level:** integration
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:** `content-valid` seeded.
- **Steps:**
  1. Change the frontmatter `slug` of `l2-memory` to `l2-memory-mgmt`. The file name is irrelevant. Seed.
- **Expected:**
  - The `l2-memory` row is archived and keeps its old id.
  - There is a new `l2-memory-mgmt` row with a new id.
  - Its exercise `ex-fx-mem` is re-linked to the new lesson id. `exercises.lesson_id` is unique and the old lesson is archived, so this must be an update of `lesson_id`, not a second row.
  - Progress keyed on the old slug is kept but not rendered (P-4.1).
- **Notes:** AMB-B14: there is no redirect, so old URLs show "Lesson not found" (S9-05).

---

## Suite B5: Test fixtures (S-5)

### TC-B-32: db:reset:test loads fx-base exactly
- **ACs:** S-5.1, C-1.3
- **Level:** integration
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** Local Supabase running with arbitrary prior data, for example after `npm run seed` on real content plus 5 extra news items. The 11 baseline `news_sources` rows from the migration are present.
- **Steps:**
  1. `npm run db:reset:test`.
  2. Count rows per table with the service role.
- **Expected:** Exit 0, and the prior data is gone. Row counts:
  - `levels`: 2.
  - `lessons`: 5 (4 active, plus `l2-retired` with `archived_at` set). Rows are inserted directly, not through the frontmatter validator (AMB-25).
  - `exercises`: 2.
  - `news_sources`: exactly the 4 fixture sources `fx-openai`, `fx-simon`, `fx-hn` and `fx-anthropic` (type `html`). The 11 migration baseline sources are removed (AMB-B24).
  - `ingest_runs`: 4 (`run-0928` success, `run-0929` partial, `run-0930` success, `run-0930-fail` failed).
  - `news_items`: 30, with `scoring_status` counts scored 24, pending 3, failed 2 and skipped 1 (README §3.1).

  Every property named in README §3.1 holds:
  - `l1-permissions` has `codex_no_equivalent=true`, `codex_md` null and `codex_workaround_md` = "Use a sandbox profile.".
  - `n03` and `n04` tie at 85, with `n03.published_at > n04.published_at`.
  - `n12` = 60, `n13` = 59, and `n05` has zero tags.
  - `n19`'s injection strings are stored verbatim.
  - Every row passes its `rows.ts` schema.

### TC-B-33: db:reset:test is deterministic
- **ACs:** S-5.1
- **Level:** integration
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** none.
- **Steps:**
  1. `npm run db:reset:test`. Dump all tables with every column except `id` and the FK uuid columns, ordered by slug or alias → R1.
  2. Repeat → R2.
- **Expected:**
  - R1 equals R2 byte for byte, including all timestamps. Fixture timestamps are literals anchored to 2026-09-30 Manila, never `now()`: set `first_seen_at`, `updated_at` and `started_at` explicitly, because their column defaults are `now()`.
  - UUIDs are DB-generated, so tests key fixture rows by slug, or by the alias lookup exported from `tests/fixtures/news.ts` (AMB-B15). They never hard-code a uuid.

### TC-B-34: Fixture variants load their documented contents
- **ACs:** S-5.1, S9-02, S9-12, S9-13
- **Level:** integration
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** README §3.2 variants.
- **Steps:**
  1. For each variant `fx-no-content`, `fx-no-news`, `fx-news-lowbar` and `fx-news-archive-60`: run `npm run db:reset:test -- --variant=<v>`; count rows.
  2. Run with `--variant=does-not-exist`.
- **Expected:**
  - `fx-no-content`: `levels`, `lessons`, `exercises`, `news_items` and `ingest_runs` all 0.
  - `fx-no-news`: the curriculum as in `fx-base`; `news_items` 0 and `ingest_runs` 0.
  - `fx-news-lowbar`: 1 success run finished 2026-09-30 08:03 Manila, and 5 items scored 59, 50, 40, 20 and 0 on `digest_date` 2026-09-30.
  - `fx-news-archive-60`: 90 news items, 60 of them dated 2026-09-01 to 2026-09-27.
  - Unknown variant: non-zero exit listing the valid variant names; the DB is unchanged.

### TC-B-35: db:reset:test refuses a non-local database
- **ACs:** S-5.1
- **Level:** integration
- **Priority:** P0
- **Category:** Security
- **Preconditions / fixtures:** `SUPABASE_URL=https://example.supabase.co`.
- **Steps:**
  1. `npm run db:reset:test`.
- **Expected:** Exits non-zero before any network write, with a message saying the reset only runs against a local Supabase (`127.0.0.1` or `localhost`). A destructive reset must never be pointable at a hosted project.

---

## Suite B6: Exercise repo validity (E-4)

### TC-B-36: Every exercise directory has the required files
- **ACs:** E-4.1
- **Level:** unit
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** The real repo `exercises/` tree. This runs in CI against committed content.
- **Steps:**
  1. For each `exercises/*/` directory, check for `README.md`, `CHECKLIST.md`, `starter/`, `solution/` and `exercise.json`.
  2. Validate each `exercise.json` with `exerciseJsonSchema`, and each `CHECKLIST.md` with the parser from TC-B-17.
- **Expected:**
  - Everything is present and valid. On failure the test prints the slug and the missing path.
  - Once M3 is complete there are exactly 18 directories, whose slugs match the PRD §7 table (`ex-1-1-failing-test` … `ex-5-4-capstone`).
  - Before M3, the 18-count assertion is skipped with a logged reason, not passed silently (AMB-B17).

### TC-B-37: exercises:verify passes when starters fail and solutions pass
- **ACs:** E-4.2
- **Level:** integration
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** A sandbox `exercises/` with `ex-fx-auto` (`"verify": "npm test"`; the starter test fails and the solution passes) and `ex-fx-manual` (`"verify": "manual"`). `EXERCISES_DIR` points at it.
- **Steps:**
  1. `npm run exercises:verify`.
- **Expected:**
  - Exit 0.
  - Output lists `ex-fx-auto: starter FAIL (expected), solution PASS` and `ex-fx-manual: manual (skipped)`.
  - Verify runs in a temp copy of each directory, so `starter/` and `solution/` in the repo are unmodified afterwards (`git status --porcelain exercises/` is empty).
  - Against the M0 stub (prints "stub, no exercises yet" and exits 0), this case must FAIL, because the expected per-exercise lines are missing.

### TC-B-38: A starter that already passes fails the run
- **ACs:** E-4.2
- **Level:** integration
- **Priority:** P0
- **Category:** Negative
- **Preconditions / fixtures:** A sandbox where `ex-fx-auto/starter` is a copy of `solution`.
- **Steps:**
  1. `npm run exercises:verify`.
- **Expected:**
  - Exit non-zero.
  - The output names `ex-fx-auto` and says the starter exited 0 but must fail.
  - Other exercises are still checked and reported; the run does not stop at the first failure.

### TC-B-39: A failing solution fails the run
- **ACs:** E-4.2
- **Level:** integration
- **Priority:** P0
- **Category:** Negative
- **Preconditions / fixtures:** A sandbox where `ex-fx-auto/solution` has a broken test.
- **Steps:**
  1. `npm run exercises:verify`.
- **Expected:** Exit non-zero, naming the `ex-fx-auto` solution and showing the last 20 lines of the verify command's output.

### TC-B-40: Verify command that hangs is timed out
- **ACs:** E-4.2
- **Level:** integration
- **Priority:** P1
- **Category:** Error
- **Preconditions / fixtures:** A sandbox exercise whose `verify` is `node -e "setInterval(()=>{},1000)"`. The per-exercise timeout is overridable (`EXERCISES_VERIFY_TIMEOUT_MS=2000`, AMB-B16).
- **Steps:**
  1. `npm run exercises:verify`.
- **Expected:**
  - The exercise is reported as "timed out", and the run exits non-zero within the timeout plus 5s.
  - A timed-out starter counts as a harness failure, not as "starter fails as expected".

### TC-B-41: exercises:verify runs in CI
- **ACs:** E-4.2, G-1
- **Level:** unit
- **Priority:** P0
- **Category:** Happy
- **Preconditions / fixtures:** `.github/workflows/ci.yml`.
- **Steps:**
  1. Parse the workflow files and look for a job step that runs `npm run exercises:verify` on `pull_request`.
- **Expected:** Such a step exists and does not have `continue-on-error: true`.
- **Notes:** **RED on `main` at b0b47d1.** `ci.yml` runs typecheck, lint, test, build, seed, `db:reset:test` and e2e, but not `exercises:verify`. `.github/` is M0-owned, so the step needs an M0 PR (AMB-B25).

### TC-B-42: At least 12 of 18 exercises are automated
- **ACs:** E-4.3
- **Level:** unit
- **Priority:** P0
- **Category:** Boundary
- **Preconditions / fixtures:** The real `exercises/*/exercise.json` files.
- **Steps:**
  1. Count the exercises whose `verify !== "manual"`.
- **Expected:**
  - The count is ≥ 12 once 18 exercises exist.
  - Unit-test the counter with synthetic sets: 11/18 fails, 12/18 passes, 18/18 passes.
  - Before M3 (fewer than 18 exercises), the check reports progress and does not fail (AMB-B17).

### TC-B-43: No exercise requires a paid API key
- **ACs:** E-4.4
- **Level:** unit
- **Priority:** P0
- **Category:** Security
- **Preconditions / fixtures:** The real `exercises/` tree.
- **Steps:**
  1. Grep `starter/`, `solution/`, `README.md` and `exercise.json` for `process.env.[A-Z_]*API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, and `.env` templates with `*_KEY=`.
  2. Run each automated `verify` with an environment that has no `*_API_KEY` variables set.
- **Expected:**
  - Step 1 finds no matches. An allowlist file may list reviewed false positives, each with a reason. The grep is needed because `exerciseJsonSchema` strips unknown keys rather than rejecting them (TC-B-16h).
  - Step 2: every solution still passes, which proves no key is needed for verification.

### TC-B-44: Exercise setup installs in under 60s on a warm cache
- **ACs:** E-4.4
- **Level:** integration
- **Priority:** P1
- **Category:** Perf
- **Preconditions / fixtures:** A nightly job, not merge-gating (AMB-18). It runs after a priming `npm i` in each starter. The test title carries `@nightly` so the default runs exclude it (AMB-27).
- **Steps:**
  1. For each exercise, copy `starter/` to a temp dir and time `npm i --prefer-offline`.
- **Expected:**
  - Every install finishes in under 60s. The report lists each duration.
  - A miss is reported, not merge-blocking.
  - A manual confirmation on the stakeholder Mac is recorded in the M3 PR.

---

## Suite B7: content:stale (S-6)

### TC-B-45: 60 vs 61 days boundary
- **ACs:** S-6.1, C-5.2
- **Level:** integration
- **Priority:** P1
- **Category:** Boundary
- **Preconditions / fixtures:**
  - `fx-base`: `l2-context-files` was verified 2026-08-01 (60 days before), `l1-permissions` 2026-07-31 (61 days).
  - `FM_NOW=2026-09-30T13:00:00+08:00`.
  - The release data is up to date (the TC-B-46 fixture, with no newer versions).
- **Steps:**
  1. `npm run content:stale`.
  2. Repeat with `FM_NOW=2026-09-30T23:59:00+08:00`, and with `FM_NOW=2026-09-30T00:30:00+08:00` (which is 2026-09-29T16:30Z).
- **Expected:**
  - All three runs list `l1-permissions` (61 days) and not `l2-context-files` (60 days). Day counts use the Asia/Manila calendar date, not UTC.
  - Exit code 0: the command reports, it does not fail (unless AMB-B18 decides otherwise).
  - Against the M0 stub (prints "stub, nothing checked yet"), this case must FAIL.

### TC-B-46: tool_versions behind the latest release
- **ACs:** S-6.1
- **Level:** unit
- **Priority:** P1
- **Category:** Boundary
- **Preconditions / fixtures:** A pure function `isBehind(lessonVersion, latestSeen)`. The latest seen versions are read from `news_items` of the `claude-code-releases` and `codex-cli-releases` sources (migration baseline slugs, WS-E), or from an injected map.
- **Steps:**
  1. Compare these pairs: `2.1.0` vs `2.1.0`; `2.1.0` vs `2.1.1`; `2.1.9` vs `2.1.10`; `2.1.0` vs `2.2.0-beta.1`; `v2.1.0` vs `2.1.0`; `rust-v0.40.0` (Codex tag style) vs `0.41.0`; `latest` vs `2.1.0`.
- **Expected:**
  - Equal → not behind.
  - `2.1.1` → behind.
  - `2.1.10` → behind (numeric compare, not string).
  - A newer prerelease is ignored, so not behind (unless AMB-B19 decides otherwise).
  - The `v` and `rust-v` tag prefixes are stripped before comparing.
  - `latest`, which the contract accepts (TC-B-12), is reported as "unknown version", never as behind or current.
  - The output names the lesson slug, the tool and both versions.

### TC-B-47: No release data available
- **ACs:** S-6.1
- **Level:** integration
- **Priority:** P1
- **Category:** Error
- **Preconditions / fixtures:** `fx-no-news` (no release items).
- **Steps:**
  1. `npm run content:stale`.
- **Expected:**
  - Exit 0.
  - The date-based check still lists `l1-permissions`.
  - A line states that the version check was skipped because the DB holds no Claude Code or Codex release data.
  - No crash and no false "behind" results.

---

## Suite B8: RLS (anon read-only, §6)

### TC-B-48: Anon key can read content and news tables
- **ACs:** S-5.1, N-1.1
- **Level:** integration
- **Priority:** P0
- **Category:** Security
- **Preconditions / fixtures:** `fx-base`; `anonClient()`.
- **Steps:**
  1. `select *` from `levels`, `lessons`, `exercises`, `news_sources`, `news_items` and `ingest_runs` with the anon key.
- **Expected:**
  - Each returns the fixture rows. The migration's `<table>_read` policies are `for select … using (true)`.
  - **Archived rows are also returned** (for example `l2-retired`), because RLS does not filter them. Hiding archived content is the app queries' job (WS-C cases for C-1.3 and S9-05), and this case pins that it cannot be delegated to RLS.

### TC-B-49: Anon key cannot write any table
- **ACs:** S-2.1, S-5.1
- **Level:** integration
- **Priority:** P0
- **Category:** Security
- **Preconditions / fixtures:** `fx-base`; `anonClient()`. Also build a client with an `authenticated` JWT, which is granted the same rights as anon.
- **Steps:**
  1. For each of the 6 tables, attempt:
     - an `insert` of a minimal valid row;
     - an `update` of one fixture row (for example `lessons.title`, `news_items.score = 100`);
     - a `delete` of one row;
     - an `upsert`.
  2. Call `rpc('news_items_set_digest_date')`. It is the only function in the migration, a trigger function.
  3. Query `pg_tables` / `pg_class` (service role) for every table in `public`.
  4. Take a `dumpTables()` plus a news/runs dump before and after.
- **Expected:**
  1. Every write fails with Postgres `42501` ("permission denied for table <name>"). The migration revokes all privileges and grants only SELECT, so writes fail on privileges, not merely on RLS affecting 0 rows. `authenticated` behaves the same.
  2. Errors; no data changes.
  3. `relrowsecurity = true` for every table, so a table added later without RLS makes this case fail.
  4. The before and after dumps are identical.

### TC-B-50: Seed writes only with the service-role key
- **ACs:** S-2.1
- **Level:** integration
- **Priority:** P0
- **Category:** Security
- **Preconditions / fixtures:** An environment where `SUPABASE_SERVICE_ROLE_KEY` is unset and only `SUPABASE_URL` and `SUPABASE_ANON_KEY` are available.
- **Steps:**
  1. `runSeed(dir)`.
  2. Run a successful seed with the key set, and grep stdout and stderr for the key value.
- **Expected:**
  1. Non-zero exit before any write, with stderr containing `SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env.example).`, the message thrown by `getServiceClient()`. The seed must not fall back to the anon key.
  2. The key value never appears in the output.

### TC-B-51: digest_date trigger derives the Manila date
- **ACs:** S-5.1
- **Level:** integration
- **Priority:** P0
- **Category:** Boundary
- **Preconditions / fixtures:** `fx-base`; service role. Uses the migration trigger `news_items_digest_date`, which fixtures and the pipeline rely on.
- **Steps:**
  1. Insert news items with no `digest_date` and `first_seen_at` = `2026-09-29T15:59:59Z`, `2026-09-29T16:00:00Z` and `2026-12-31T16:00:00Z`.
  2. Insert one item with an explicit `digest_date = 2026-09-01` and `first_seen_at = 2026-09-30T00:00:00Z`.
  3. Repeat step 1 with the DB session `timezone` set to `America/New_York`.
- **Expected:**
  1. `digest_date` = `2026-09-29`, `2026-09-30` and `2027-01-01` respectively.
  2. The explicit `2026-09-01` is kept: the trigger only fills nulls.
  3. The same results as step 1. The trigger uses `at time zone 'Asia/Manila'` and does not depend on the session TZ.
- **Notes:** Fixture loaders in `tests/fixtures/` must set `digest_date` explicitly (README §3.1), so this trigger is exercised only here and in the WS-E cases.

### TC-B-52: levels.yaml boundaries
- **ACs:** S-1.1, S-2.1
- **Level:** integration
- **Priority:** P0
- **Category:** Boundary
- **Preconditions / fixtures:** `levelsFileSchema` (`levels`: 1–5 entries; `number` an int 1–5; kebab `slug`; non-empty `title` and `summary`); the `content-valid` sandbox.
- **Steps:** Seed with each of these `content/levels.yaml` variants:
  1. `levels: []` (0 levels).
  2. 6 levels (numbers 1–6).
  3. 5 levels numbered 1–5 (no lessons for 3–5).
  4. Two entries with `number: 2`.
  5. Two entries with slug `l1`.
  6. A lesson with `level: 3` while `levels.yaml` defines only 1 and 2.
  7. `summary: ""`.
  8. The file missing entirely.
  9. The top-level key misspelled `level:`.
- **Expected:**
  1. Fails on `levels` (`min(1)`).
  2. Fails, on the `levels` length (`max(5)`) and on `levels[5].number` (`max(5)`); the DB check `number between 1 and 5` is only a backstop.
  3. Passes. Levels with no lessons are stored, and C-1 rendering of an empty level belongs to WS-C.
  4. Fails with "duplicate level number 2", naming the file.
  5. Fails with "duplicate level slug".
  6. Fails with the lesson path, field `level`, and reason "level 3 is not defined in content/levels.yaml".
  7. Fails on `levels[0].summary`.
  8. Fails, naming `content/levels.yaml` as missing.
  9. Fails, naming the missing `levels` key.

  Every failure writes nothing (before and after dumps identical).

### TC-B-53: Exercise display fields derived when absent from exercise.json
- **ACs:** S-1.2, E-4.1
- **Level:** integration
- **Priority:** P1
- **Category:** Edge
- **Preconditions / fixtures:** A `content-valid` variant where `ex-fx-manual/exercise.json` is only `{"slug":"ex-fx-manual","verify":"manual","required_tool_features":[]}`. `README.md` starts with `# Fixture manual` followed by the paragraph `Write the context files.` The contract says display fields may be derived from `README.md` and `CHECKLIST.md`.
- **Steps:**
  1. `runSeed(dir)`; read the `ex-fx-manual` row.
  2. Remove the h1 from `README.md`; re-seed.
- **Expected:**
  1. `title` = `Fixture manual` (the first h1), `goal` = `Write the context files.` (the first paragraph), and `setup_cmd` is the PRD E-1 template (TC-B-04). When `starter_prompts` is missing, the seed fails, naming the file, because E-1.2 requires a starting prompt per tool. `solution_notes` missing also fails, because E-3.2 requires 2–5 notes.
  2. Fails, naming `README.md` and "no title": `exercises.title` is `not null` and has no default.
- **Notes:** The derivation rules are AMB-B27.

---

## Coverage

| AC | Test cases |
|---|---|
| S-1.1 | TC-B-01, TC-B-02, TC-B-03, TC-B-05, TC-B-06, TC-B-52 |
| S-1.2 | TC-B-01, TC-B-04, TC-B-15, TC-B-17, TC-B-53 |
| S-2.1 | TC-B-02, TC-B-07, TC-B-08, TC-B-09, TC-B-10, TC-B-11, TC-B-12, TC-B-13, TC-B-14, TC-B-15, TC-B-16, TC-B-17, TC-B-19, TC-B-20, TC-B-22, TC-B-25, TC-B-49, TC-B-50, TC-B-52 |
| S-2.2 | TC-B-06, TC-B-13, TC-B-18, TC-B-26, TC-B-27, TC-B-31 |
| S-2.3 | TC-B-28, TC-B-29, TC-B-30, TC-B-31 |
| S-3.1 (seed side) | TC-B-27 |
| S-4.1 | TC-B-21, TC-B-22, TC-B-23, TC-B-24, TC-B-25 |
| S-5.1 | TC-B-32, TC-B-33, TC-B-34, TC-B-35, TC-B-48, TC-B-49, TC-B-51 |
| S-6.1 | TC-B-45, TC-B-46, TC-B-47 |
| E-4.1 | TC-B-04, TC-B-16, TC-B-36, TC-B-53 |
| E-4.2 | TC-B-37, TC-B-38, TC-B-39, TC-B-40, TC-B-41 |
| E-4.3 | TC-B-42 |
| E-4.4 | TC-B-43, TC-B-44 |
| C-1.3 (seed side) | TC-B-28, TC-B-29, TC-B-32 |
| C-5.2 (seed side) | TC-B-45 |
| E-2.2 (seed side) | TC-B-17, TC-B-18 |
| L-3.2 (seed side) | TC-B-23, TC-B-24 |
| L-7.1 (seed side) | TC-B-05 |
| N-1.1 (RLS read) | TC-B-48 |
| S9-02, S9-12, S9-13 (fixture variants) | TC-B-34 |
| G-1 (CI wiring) | TC-B-41 |

Not covered here: I-1.1, the sync of `news_sources` from `content/news/sources.yaml`, is tested in [ws-e-news-pipeline.md](ws-e-news-pipeline.md). The migration inserts 11 baseline sources, but which command keeps the table in sync with `sources.yaml` is still AMB-B20.

## Ambiguities raised in this file

| ID | Ambiguity | Assumed here |
|---|---|---|
| AMB-B1 | The seed has no documented way to point at a test content tree. | `CONTENT_DIR` and `EXERCISES_DIR` env overrides (defaults `content/` and `exercises/`); README §4 hook 6. |
| AMB-B2 | The file name is free (implementer decision), but PRD S-1.1 still puts lessons under `content/lessons/<level>/`. Which wins when the folder and frontmatter `level` disagree? | Mismatch is a validation error (TC-B-02b). |
| AMB-B3 | Unknown `## ` sections in a lesson body (for example `## Notes`). | Validation error; the text is never silently dropped. |
| AMB-B4 | Partly resolved by the implementer decision: `- [ ] c1: text` or `- [ ] {#c1} text`. Still open: the id character set, nested items, and `[x]` in source. | Ids match `^[a-z0-9_-]+$` (so no `:` or `.`) and are unique per exercise; nested items rejected; `[x]` accepted and ignored. |
| AMB-B5 | Report every invalid file, or fail fast? | Report all, then exit. |
| AMB-B6 | Is `est_minutes: 0` valid? | Resolved: `lessonFrontmatterSchema` (`positive()`). 0 is invalid. |
| AMB-B7 | Is a future `last_verified_on` valid? | The contract has no future check, so it is accepted. Raise with M0 if it should be rejected. |
| AMB-B8 | Is a duplicate `sort` within a level an error? (There is no DB constraint.) | Yes. |
| AMB-B9 | Is `"verify": "MANUAL"` a manual exercise or a shell command? The contract literal is lowercase `"manual"`. | The seed rejects case variants of `manual` with a hint. |
| AMB-B10 | Are YAML anchors and aliases allowed in frontmatter? | Allowed, with an alias-count limit; custom tags and JS engines are rejected. |
| AMB-B11 | Partly resolved: the slug regex comes from the contract. Still open: a maximum length. | No maximum (contract); the URL length is the practical limit. |
| AMB-B12 | Where the no-equivalent workaround is stored. | Resolved: M0 migration and `rows.ts` (`claude_workaround_md` / `codex_workaround_md`, DB check constraints). Marker = frontmatter `<tool>_no_equivalent: true`; the tool section body becomes the workaround. |
| AMB-B13 | Does archiving a level cascade to its lessons and exercises, and what does restoring it do? | Archiving cascades. Restoring the level un-archives only the lessons and exercises whose files exist. |
| AMB-B14 | Slug renames: there is no redirect from the old URL. | The old URL shows "Lesson not found"; progress is kept but hidden (P-4.1). |
| AMB-B15 | Fixture uuids are DB-generated, so tests cannot hard-code them. | `tests/fixtures/news.ts` exports alias → canonical_url; tests look ids up at runtime. |
| AMB-B16 | `exercises:verify` has no timeout in the PRD. | Default 5 min per command, overridable by `EXERCISES_VERIFY_TIMEOUT_MS`. |
| AMB-B17 | How E-4.3's ≥ 12 check behaves before all 18 exercises exist. | Enforced only when 18 exist (M3); it warns before that. |
| AMB-B18 | Should `content:stale` exit non-zero when stale lessons exist, so it can serve as a CI gate? | Exit 0 with a report; an optional `--strict` flag. |
| AMB-B19 | Does a newer **prerelease** make a lesson "behind"? | No; stable releases only. |
| AMB-B20 | The migration seeds 11 baseline `news_sources` rows, but PRD I-1.1 says the sources come from `content/news/sources.yaml`. Which command (WS-B's `seed` or WS-E's `news:run`) syncs the table with the YAML, and do rows missing from the YAML get disabled? | Tested in WS-E; ownership open. |
| AMB-B21 | The `last_verified_on` regex accepts impossible dates (`2026-02-30`), which the Postgres `date` cast then rejects with a raw SQL error. | The seed adds a calendar check and reports path, field and reason. |
| AMB-B22 | gray-matter/js-yaml turns an unquoted `2026-09-30` into a JS `Date`, which the string schema rejects. A naive `toISOString()` of a local-time date shifts the day. | The seed normalises `Date` values to the UTC date part before validation. |
| AMB-B23 | The contract allows both `*_no_equivalent` flags to be true on one lesson. | Rejected: a lesson must have a native section for at least one tool. |
| AMB-B24 | Does `db:reset:test` keep the 11 migration baseline `news_sources` rows next to the 4 `fx-*` sources? | No. The reset leaves exactly the 4 fixture sources, so source filters and counts are deterministic. |
| AMB-B25 | TC-B-41 needs an `exercises:verify` step in `.github/workflows/ci.yml`, which is M0-owned and frozen. | An M0 PR adds the step; until then TC-B-41 is RED. |
| AMB-B26 | `levelContentSchema` has no `sort`, but the `levels` table has a `sort` column. | `sort` = `number`. |
| AMB-B27 | Which `exercise.json` display fields may be derived, and from where? (The contract comment says "from README.md / CHECKLIST.md".) | `title` from the README h1 and `goal` from the first paragraph; `setup_cmd` from the PRD template. `starter_prompts` and `solution_notes` must be present in `exercise.json`. |

Global ambiguities that apply here: AMB-01 (fixture shape vs C-1.1/C-2.1, archived lesson), AMB-02 (variants), AMB-18 (install timing), AMB-25 (fixture lessons without exercises), AMB-26 (helpers in frozen `tests/support/`), AMB-27 (`@nightly` exclusion).
