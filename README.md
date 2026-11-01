# GPT-6.1 Terra vs Claude Sonnet 5.5: 11 coding tests

Video: [VIDEO LINK, added after upload]

This repo has everything behind the ProAI Clips video **"$1 Model vs Claude: GPT-6.1 Terra Passed 11 of 11 Coding Tests"**: the prompts, hidden tests, agent harness, model outputs and the full OpenRouter cost log.

Both models ran in the same small agent loop through OpenRouter. They had 4 tools (list files, read file, write file, run shell in a fresh folder), the same system prompt and the same task prompt, word for word. Settings were reasoning effort "medium", max 32,000 output tokens per turn and max 30 turns. Each model got one run per test, with no nudges and no retries. All runs were on 1 Nov 2026. Cost is what OpenRouter actually billed (`usage.cost`) at list price: Terra $1/$5 and Sonnet 5.5 $2/$10 per 1M input/output tokens.

## Results

| # | Test | GPT-6.1 Terra | Claude Sonnet 5.5 |
|---|---|---|---|
| 1 | R1 hexagon physics | PASS · $0.041 · 77 s | PASS · $0.042 · 21 s |
| 2 | R4 landing page | PASS · $0.055 · 99 s | PASS · $0.077 · 34 s |
| 3 | R7 tool use | PASS 5/5 · $0.011 · 18 s | PASS 5/5 · $0.026 · 12 s |
| 4 | T8 token-bucket rate limiter (11 hidden tests) | 11/11 · $0.021 · 44 s | 11/11 · $0.034 · 14 s |
| 5 | T9 SQLite queries (3, vs reference) | 3/3 · $0.018 · 32 s | 3/3 · $0.031 · 12 s |
| 6 | R6 ShopLite checkout bugs | PASS · $0.039 · 75 s | PASS · $0.031 · 14 s |
| 7 | T10 bookings merge, Europe/London DST (13 hidden) | 13/13 · $0.020 · 37 s | 13/13 · $0.027 · 12 s |
| 8 | T11 npm-semver `satisfies()` (32 hidden) | 32/32 · $0.065 · 119 s* | 32/32 · $0.076 · 30 s |
| 9 | R9 three.js windmill from 2 photos | PASS · $0.052 · 92 s | PASS · $0.056 · 26 s |
| 10 | R10 dungeon game (5 robot checks) | 5/5 · $0.051 · 98 s | 5/5 · $0.083 · 29 s |
| 11 | R11 ledgerly planted bugs (10 hidden + 9 regression) | 10/10, 0 regressions · $0.080 · 110 s | **9/10** (missed B8) · $0.244 · 30 s |
| | **Total** | **11/11 · $0.45 · 13.3 min · 61,753 output tokens** | **10/11 · $0.73 · 3.9 min · 35,285 output tokens** |

\*Terra used npm's bundled copy of semver on the machine to check its answers. Its own `semver.js` imports nothing.

Total spend, including two T8 harness checks: **$1.18** (`results/cost_ledger.jsonl`). The full notes are in `results/RESULTS.md`.

## Quick start

```bash
export OPENROUTER_API_KEY=...            # your own key
python3 harness.py openai/gpt-6.1-terra terra T8
python3 harness.py anthropic/claude-sonnet-5.5 sonnet T8
python3 grade_all.py                     # writes results.json from runs/
# or every test: bash runall.sh <model> <label>
```

You need Python 3.11+ and Node 20+. R4, R9 and R10 also need Playwright with Chromium (`npx playwright install chromium`).

Before you run anything:
- The harness lets the model run shell commands in `runs/<test>/<label>/work`. Use a throwaway machine or a container.
- It stops at $0.40 per run and $2.85 in total (`CAP_RUN`, `CAP_TOTAL` at the top of `harness.py`).

## What's here

- `prompts/`: the exact task prompts.
- `assets/`: the starting files for each test (ShopLite repo, ledgerly buggy repo, tool stubs, R9 reference photos, T9 `shop.db`, ...).
- `graders/hidden/`: hidden tests the models never saw (T8, T9 reference SQL + expected rows, T10, T11).
- `graders/`: the R6 checker and the R10 game-robot source.
- `harness.py`, `grade_all.py`, `runall.sh`: the agent loop and the grader.
- `runs/`: what each model wrote (its `work/` folder and `meta.json`). Screenshots are left out to keep the repo small.
- `results/`: `results.json`, `RESULTS.md` and the per-request cost log.

## Notes

- Each model got one run per test, so treat the numbers as anecdotal.
- These are small projects (up to about 1,000 lines). The loop is simple; it is not Codex or Claude Code.
- Raw conversation logs are not published, because they echo the test machine's environment.
- Changed after the runs: the published `harness.py` passes the shell tool only `PATH`, `LANG` and `HOME`. The original removed any variable containing KEY, TOKEN or SECRET. That is safer for you to run, and it doesn't change the tasks.

Links: https://linktr.ee/proaicontent · https://x.com/proaicontent · https://proaiclips.substack.com

MIT License.
