# Handoff: renderer

## Done

- `src/render.mjs`: `renderMarkdown` per SPEC.md Part C.
- Touched only `src/render.mjs`.

## Test output

```
node --test tests/render.test.mjs
ℹ tests 4
ℹ pass 4
ℹ fail 0
```

## Notes

- An unknown group type would render under "Other" rather than throw.
