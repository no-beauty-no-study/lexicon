# Portable Lexicon Export

Canonical generator:

```bash
node tools/rebuild-portable-lexicon.js
```

Default output:

```text
data/lexicon-portable/
```

The local Sealyra game uses the same generator through:

```text
/Users/nishenglan/Documents/sealyra/whispers-game/tools/rebuild-lexicon-from-main.js
```

To export from this repo directly into the game:

```bash
LEXICON_EXPORT_OUT="/Users/nishenglan/Documents/sealyra/whispers-game/data/lexicon" node tools/rebuild-portable-lexicon.js
```

Do not hand-edit the generated JSON. Put card/cut/family repair rules in:

```text
tools/rebuild-portable-lexicon.js
```
