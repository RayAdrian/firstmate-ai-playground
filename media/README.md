# Lesson media sources (PRD section 15)

Sources live here. Output is committed to `public/media/lessons/<lesson-slug>/` and is never hand-edited. The app never depends on these toolchains at runtime.

## Remotion animations (`media/remotion/`)

Prerequisites: Node 22.18 or newer (the render script runs as TypeScript directly), `ffmpeg` with libx264 on your PATH (`brew install ffmpeg`). Remotion downloads its own headless Chrome on first render. Remotion has its own `package.json` and lockfile, so none of it is in the app's dependencies.

```bash
npm --prefix media/remotion ci          # once
npm run media:render                    # render every item
npm run media:render -- parallel-worktrees   # or just one
npm --prefix media/remotion run studio  # live preview
npm --prefix media/remotion run typecheck
```

Each item is a folder `media/remotion/src/<id>/`:

| File | Role |
|---|---|
| `steps.json` | The source of truth: lesson slug, title, size (1280x720), fps, duration, poster time, the **steps** (`id`, `start_s`, `end_s`, `text`) and the labels the composition draws (file names, gate names, SHAs, terminal lines). |
| `<Name>.tsx` | The composition. It reads everything from `steps.json`; the headline is each step's `text`. |
| `transcript.txt` | Hand-written description of what is on screen, one paragraph per step, starting with `m:ss <step text>`. Copied through to the output. |

A wording change means editing `steps.json` (and the matching transcript line), then `npm run media:render`. The `.vtt` has one cue per step with the exact same `text` string the video draws, so captions and on-screen text cannot drift (`tests/unit/v1/` checks it).

`media:render` writes `<id>.mp4` (H.264, yuv420p, 1280x720, 30 fps, no audio, faststart, CRF 24), `<id>.webp` (poster at `poster_s`), `<id>.vtt`, `<id>.txt` and `<id>.media.json` (schema: `src/lib/contracts/media.ts`). It fails if the MP4 exceeds 4 MB or the poster 60 KB. `source_hash` is the sha256 hex of the raw bytes of `steps.json`; `tool_versions` are copied from the lesson's frontmatter; `made_on` is today's date.

Design rules for frames: tokens from `docs/design/tokens.css` (copied into `src/theme.ts`), Satoshi loaded from `public/fonts` (nothing is copied), ink and accent only, accent-2 is for borders and bars, never text. Keep the top 150px for the headline and the bottom 110px free for the native caption track. Keep key text at 28px or larger in the 1280x720 frame so it stays readable at 360px wide.

Adding an item: create `src/<id>/` with the three files, register the composition in `src/Root.tsx`, run `media:render -- <id>`.

Gotchas: Remotion's bundler needs TypeScript 5.x (`typescript.sys`), so `media/remotion` pins 5.9 and not the native 7.x. `zod` is pinned to the version Remotion expects.
