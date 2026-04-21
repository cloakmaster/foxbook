# core-isolation fixtures

Permanent test fixtures for `scripts/check-core-isolation.mjs`. These files are NOT compiled into the product — they exist purely to prove the checker behaves correctly.

- `negative/` — each file deliberately violates the rule. The checker MUST report at least one violation for each file. If a negative fixture stops failing, the rule has drifted and the script is lying to us.
- `positive/` — each file demonstrates a legal pattern. The checker MUST report zero violations. If a positive fixture starts failing, the rule has become too aggressive.

Files here are excluded from TS and Python builds by path (`__fixtures__` is gitignored-style excluded in tsconfigs, biome, ruff).

If you're editing these to match a rule change, write an ADR first.
