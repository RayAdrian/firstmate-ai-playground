# Checklist

- [ ] {#c1} `npm test` passes and I did not edit anything under `tests/`.
- [ ] {#c2} The claude call uses `-p`, `--output-format json` and `--json-schema`, and I read the answer from `structured_output`.
- [ ] {#c3} The claude call disables all tools, and I can say why a classification job doesn't need any.
- [ ] {#c4} The codex call uses `exec` with `--output-schema <file>` and `-o <file>`, and runs ephemeral and read-only.
- [ ] {#c5} Commit text is sent on stdin, never in the command arguments, and the instructions say it is untrusted data.
- [ ] {#c6} The model's output is validated against the schema and checked against the commit list before it is used.
- [ ] {#c7} On any failure the CLI exits 1 with an empty stdout and a clear message on stderr.
- [ ] {#c8} I ran both tools for real on the fixture and the "ignore previous instructions" commit did not change the other classifications.
- [ ] {#c9} I can explain how the two tools differ: schema as a string versus a file, JSON envelope versus a final-message file, and their default permissions.
