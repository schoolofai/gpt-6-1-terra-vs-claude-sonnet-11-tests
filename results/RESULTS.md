# Results — GPT-6.1 Terra vs Claude Sonnet 5.5, 11 tests (run 1 Nov 2026, morning GMT, box)
Harness: tests/harness.py — the same minimal agent loop for both models via OpenRouter Chat Completions: 4 tools (list_files, read_file, write_file, run_shell in a fresh folder), same system prompt, same task prompt verbatim (tests/prompts), reasoning effort "medium", max_tokens 32,000 per turn, max 30 turns, one run per model per task, no nudges, no retries. Models: openai/gpt-6.1-terra ($1/$5) and anthropic/claude-sonnet-5.5 ($2/$10) — both match official list prices.
Cost = OpenRouter's billed usage.cost per request (tests/cost_ledger.jsonl). Time = wall clock incl. tool execution; both queues ran in parallel. Grading: tests/grade_all.py (hidden tests / Playwright checks), results.json.
Total test spend: $1.1778 of the $3 cap (incl. two T8 runs used to check the harness, which also count as the T8 runs).

| # | Test | Terra | Sonnet 5.5 |
|---|---|---|---|
| 1 | R1 spinning hexagon physics | PASS · $0.041 · 77 s | PASS · $0.042 · 21 s |
| 2 | R4 landing page (Tailwind) | PASS · $0.055 · 99 s | PASS · $0.077 · 34 s |
| 3 | R7 tool use (weather + docs → plan) | PASS 5/5 · $0.011 · 18 s | PASS 5/5 · $0.026 · 12 s |
| 4 | T8 rate limiter, 11 hidden tests | PASS 11/11 · $0.021 · 44 s | PASS 11/11 · $0.034 · 14 s |
| 5 | T9 SQL, 3 queries vs reference | PASS 3/3 · $0.018 · 32 s | PASS 3/3 · $0.031 · 12 s |
| 6 | R6 ShopLite bug hunt (3 bugs, hidden grader) | PASS · $0.039 · 75 s | PASS · $0.031 · 14 s |
| 7 | T10 bookings + London DST, 13 hidden tests | PASS 13/13 · $0.020 · 37 s | PASS 13/13 · $0.027 · 12 s |
| 8 | T11 semver range matcher, 32 hidden cases | PASS 32/32 · $0.065 · 119 s* | PASS 32/32 · $0.076 · 30 s |
| 9 | R9 3D windmill from 2 photos (three.js) | PASS · $0.052 · 92 s | PASS · $0.056 · 26 s |
| 10 | R10 dungeon game (Playwright smoke, 5 checks) | PASS 5/5 · $0.051 · 98 s | PASS 5/5 · $0.083 · 29 s |
| 11 | R11 ledgerly planted bugs (10 hidden + 9 regression) | PASS 10/10, 0 regressions · $0.080 · 110 s | FAIL 9/10, 0 regressions · $0.244 · 30 s |
| | **Total** | **11/11 · $0.452 · 13.3 min · 61,753 output tokens** | **10/11 · $0.725 · 3.9 min · 35,285 output tokens** |

Ratios: Sonnet cost 1.60× Terra (Terra 38% cheaper per suite, not 50%: Terra wrote 75% more output tokens). Terra took 3.4× longer wall-clock on this route (OpenRouter, medium effort).
Notes
- R11 Sonnet: missed B8 — removed the duplicate stock release but left the silent Math.max(0,…) clamp in inventory.release that hid it (same miss as Sol and Opus 5.5 in the 27 Oct video).
- R4 grader fix: Terra's page has 3 newsletter tiers (Free / $9 / $19) but never uses the word "pricing"; the first grader looked for that word. Corrected to "word 'pricing' OR ≥3 prices"; both pass. Sonnet's page invented stats ("85K subscribers", "120+ tools") — copy would need checking.
- T9: sqlite3 CLI is not installed on the box; both models noticed and checked their queries with Python's sqlite3. Grader runs the .sql files through Python sqlite3.
- *T11 Terra: it found npm's own bundled copy of the semver package on the box and used it as a reference to compare answers and read its range code. Its semver.js imports nothing (rule kept), but this is an advantage Sonnet did not take. Say so on screen.
- R9: both made real WebGL windmills that animate with no console errors; likeness judged by eye (both: green tower, white cap, 4 lattice sails, balcony, red door). Terra added a title card and scenery.
- Limits: one run each; medium effort; a minimal harness (not Codex or Claude Code); tasks are small (≤1.1k lines).
