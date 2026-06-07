# Paths BGM Notes for Claude

These tracks are for the Paths visual novel / English-learning reader. The important part is not only character emotion, but also choice severity.

## New Common Tracks

### 24 - Common - Irreversible

File: `assets/bgm/paths/24_common_despair_irreversible.mp3`

Use for collapse / despair / irreversible consequence after a major wrong branch. Slow, heavy, cello-and-low-piano feeling. This is the aftermath, not the warning.

### 25 - Common - Alarm Despair Countdown

File: `assets/bgm/paths/25_common_alarm_despair_countdown.mp3`

Use for alarm-like despair when a bad consequence is approaching. The motif is slow `mid-low-mid`, then fast `mid-high-high`. This is stronger than ordinary social tension, but not yet the highest-stakes life-or-death level.

### 26 - Common - Mortal Alarm

File: `assets/bgm/paths/26_common_mortal_alarm_survival.mp3`

Use for big survival choices: life-or-death, obvious severe failure consequences, danger countdown, escape/fatal accident branches. This should not be used for normal social strategy or minor embarrassment. It is sampled strings: cello, contrabass, high violin warning accents.

### 27 - Common - Rivalry Climax

File: `assets/bgm/paths/27_common_rivalry_climax_strings_piano.mp3`

Use for plot climax / multi-love-interest rivalry / confrontation / relationship explosion. Violin-led, piano-driven, with low percussive impact. This is not a wrong-choice cue; it is a dramatic story peak.

## Male Lead Choice Tracks

These are for the choice UI before entering a male lead's personal branch. They should play while the player is deciding, not after the correct answer has already opened the romantic follow-up.

### 28 - Shiro - Choice Static

File: `assets/bgm/paths/28_shiro_choice_brittle_static.mp3`

Use for Shiro-specific choices. Brittle, sharp, violent affection under the surface. If the player chooses correctly and enters Shiro's follow-up scene, switch to Shiro's heart track.

### 29 - Hosea - Clean Pressure

File: `assets/bgm/paths/29_hosea_choice_clean_pressure.mp3`

Use for Hosea-specific choices. Clean campus romance pressure: bright, nervous, heart-forward. If the player chooses correctly and enters Hosea's follow-up scene, switch to Hosea's heart track.

### 30 - Jael - Velvet Contract

File: `assets/bgm/paths/30_jael_choice_velvet_contract.mp3`

Use for Jael-specific choices. Adult romance pressure: polite danger, bargain, attraction, and control in the same room. If the player chooses correctly and enters Jael's follow-up scene, switch to Jael's heart track.

## Choice Severity Map

- Small survival / social strategy before choosing: `02_daily_tension_before_reply`
- Shiro male-lead choice before romantic follow-up: `28_shiro_choice_brittle_static`
- Hosea male-lead choice before romantic follow-up: `29_hosea_choice_clean_pressure`
- Jael male-lead choice before romantic follow-up: `30_jael_choice_velvet_contract`
- Wrong choice, social or relationship loss: `13_choice_loss_sweet_knife`
- Correct choice / continue: `14_choice_continue_clean_angle`
- Irreversible bad aftermath: `24_common_despair_irreversible`
- Alarm-like serious consequence approaching: `25_common_alarm_despair_countdown`
- Big survival / mortal danger choice: `26_common_mortal_alarm_survival`
- Plot climax / rivalry / confrontation: `27_common_rivalry_climax_strings_piano`

## Person / Emotion Tags

- Common main theme: `00_glass_bloom_main_theme_long`
- Common daily happy: `01_daily_happy_sunlit_messages`
- Shiro daily / heart / sad / sweet: `03`, `04`, `05`, `15`
- Hosea daily / heart / sad / sweet: `06`, `07`, `08`, `22`
- Jael daily / heart / sad / sweet / dark-danger: `21`, `10`, `11`, `23`, `09`
- Kye upper / bloom: `12`, `18`
- Sealyra monologue / effort / shining entrance / Luv Poem performance: `17`, `16`, `20`, `19`
