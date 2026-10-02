# Checklist

- [ ] {#c1} `npm test` passes and I did not edit anything under `tests/`.
- [ ] {#c2} The stop condition kills a hung agent at `MAX_SECONDS` and the run ends with a FAIL verdict instead of waiting forever.
- [ ] {#c3} The script runs `TEST_CMD` itself after the agent and records its exit code. I can say why the agent's "all tests pass" is not evidence.
- [ ] {#c4} A run that changed nothing, changed a protected path, or whose agent exited non-zero is a visible FAIL with its own exit code.
- [ ] {#c5} Every run leaves `run.log`, `agent.log`, `tests.log`, `diff.stat`, `diff.patch` and a `verdict` in `RUN_DIR`, written before the run is judged.
- [ ] {#c6} The merge is gone: the work waits on an `agent/<run>` branch and the branch I started on does not move.
- [ ] {#c7} I ran the script for real on a scratch repo with `claude -p` or `codex exec`, then reviewed the branch the way I would in the morning.
- [ ] {#c8} I can explain why `--permission-mode dontAsk` with an allowlist suits an unattended Claude Code run, and why `--dangerously-skip-permissions` needs a sandbox first.
- [ ] {#c9} I can name one thing this script still cannot catch (for example a change that passes the tests but is wrong) and who covers it.
