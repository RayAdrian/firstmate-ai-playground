# Handoff: grouper

## Done

- `src/group.mjs`: `groupByType` per SPEC.md Part B.
- Touched only `src/group.mjs`.

## Test output

```
node --test tests/group.test.mjs
ℹ tests 6
ℹ pass 6
ℹ fail 0
```

## Notes

- Builds new arrays and never mutates input, so frozen fixtures are safe.
