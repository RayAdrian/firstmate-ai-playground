# Handoff: parser

## Done

- `src/parse.mjs`: `parseCommit` and `parseCommits` per SPEC.md Part A.
- Touched only `src/parse.mjs`.

## Test output

```
node --test tests/parse.test.mjs
ℹ tests 6
ℹ pass 6
ℹ fail 0
```

## Notes

- `wip: x` parses as type `wip`. Folding unknown types into `other` is the grouper's job (Part B).
