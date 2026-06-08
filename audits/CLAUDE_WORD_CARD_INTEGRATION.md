# Claude word card integration note

Use these files as the first clean content handoff for the lexicon word-card layer.

## Main files

- `audits/word_owl_toefl_old_merged.md`
  - Final draft card warehouse.
  - One word card per block.
  - Big-card sources include reading entrances, kin words, TOEFL words, and family heads/members.
  - Format:
    - `word [IPA]`
    - `cut:`
    - slash cut line
    - Chinese cut meaning line
    - meaning lines with Chinese + English gloss
    - optional `example/example_zh`
    - `phrase`

- `audits/small_card_demotions.md`
  - Words intentionally demoted out of big cards.
  - Proper nouns, places, animals, highly specialized terms, and simple non-learning entries should stay small-card-only.

- `audits/word_owl_toefl_summary.md`
  - Current generation stats.

- `audits/family_member_card_audit.md`
  - Family member lightweight-card audit.
  - Current state has no `meaning_missing` and no `phrase_missing`.

- `audits/family_self_fallback.md`
  - Big cards whose old family map had no reliable members yet.
  - Treat each listed word as a temporary head-only family, not as a small card and not as an owl-only orphan.

- `audits/english_gloss_missing_audit.md`
  - English gloss audit.
  - Current state is clean.

## Integration rules

- Big cards should come from `word_owl_toefl_old_merged.md`.
- Small-card-only words should come from `small_card_demotions.md`.
- Every big card should have a family relation. If a word appears in `family_self_fallback.md`, use `head = word` and `family = [word]` until richer members are added.
- Family heads may show examples.
- Family members can be lighter: meaning + one accurate phrase is enough.
- Do not show demoted proper nouns, places, animals, or specialist terms as expandable big cards.
- Do not regenerate fake fallback examples.

## Current clean checks

- English meaning gloss missing: 0
- Bad cut placeholders: 0
- Family member phrase missing: 0
- Owl-only big cards: 0
- Temporary head-only family fallback: 2309
- Self-gloss suspect: 0
- Demoted small-card-only words: 414

## Generator

The generator is `tools/generate_word_owl_toefl_draft.py`.
Use it only if content sources change. Otherwise consume the generated Markdown files directly.
