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

## Unsigned Social Scene Tracks

Use these when several people are present, the scene is mainly social/class/status strategy, or a male lead is present but the camera has not narrowed into his personal/romantic scene. Do not use Shiro/Hosea/Jael solo cues just because they are in the room. These tracks are a progression of scene energy, not a moral judgment about whether the scene is good or bad.

### 31 - Social - Plain Idle

File: `assets/bgm/paths/31_social_plain_idle.mp3`

Use for plain/idle daily air: solo transition, quiet walking, ordinary breathing room, no obvious conflict yet. New version removes harp single-note clutter; piano/low strings only.

### 32 - Social - Workday Roommate

File: `assets/bgm/paths/32_social_workday_roommate.mp3`

Use for roommate/coworker/workday environments: dorm, office, daily task motion, people around but not yet a social battlefield.

### 33 - Social - Campus Group Bright

File: `assets/bgm/paths/33_social_campus_group_bright.mp3`

Use for campus group activity: orientation, society fair, group walking, bright public student energy, social movement.

### 34 - Social - Story Progression

File: `assets/bgm/paths/34_social_story_progression.mp3`

Use when the scene starts moving forward: planning, preparing, investigation, a relationship/goal advancing. More direction than daily life, but not alarm or danger.

## Strongly Differentiated Unsigned Social Tracks

These are not daily/roommate cues. Use them when the scene type changes clearly. The point is contrast across a chapter: slow vs fast, strings vs piano, formal vs pressure vs public vs power.

### 35 - Social - Formal Strings Salon

File: `assets/bgm/paths/35_social_formal_strings_salon.mp3`

Use for formal social rooms: salons, banquets, polite upper-class conversation, everyone watching without open conflict. Slow strings/cello.

### 36 - Social - Glass Pressure Piano

File: `assets/bgm/paths/36_social_glass_pressure_piano.mp3`

Use for social pressure: Thea-style sweetness with a knife, meetings, being judged, reading the room before a social answer. Fast piano, sharp and clean.

### 37 - Social - Public Bright Strings

File: `assets/bgm/paths/37_social_public_bright_strings.mp3`

Use for public busy scenes: society fair, orientation hall, crowd movement, bright campus public energy. Fast strings and harp.

### 38 - Social - Strategy Piano Motion

File: `assets/bgm/paths/38_social_strategy_piano_motion.mp3`

Use for action/planning: preparing, investigating, moving toward a target, information starting to connect. Medium-fast piano.

### 39 - Social - Power Cello Slow

File: `assets/bgm/paths/39_social_power_cello_slow.mp3`

Use for power pressure: sponsors, institutions, interviews, superiors, class difference pressing down. Slow cello/low strings, heavy but not sad monologue.

### 40 - Social - Dinner Velvet Waltz

File: `assets/bgm/paths/40_social_dinner_velvet_waltz.mp3`

Use for dinner/banquet scenes: formal dinner, charity gala, wine glasses, dresses, polite observation. Slow waltz feel with strings/cello/piano; more social and flowing than power pressure.

### 41 - Social - Bar Neon Afterhours

File: `assets/bgm/paths/41_social_bar_neon_afterhours.mp3`

Use for bar/nightlife scenes: neon, counter talk, tipsy adult social testing, after-hours atmosphere. Faster, darker, with groove; not banquet, not danger alarm.

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
- Plain idle / calm transition: `31_social_plain_idle`
- Roommate / coworker / workday environment: `32_social_workday_roommate`
- Campus group activity / fair / orientation: `33_social_campus_group_bright`
- Story progression / plan moving forward: `34_social_story_progression`

## Person / Emotion Tags

- Common main theme: `00_glass_bloom_main_theme_long`
- Common daily happy: `01_daily_happy_sunlit_messages`
- Shiro daily / heart / sad / sweet: `03`, `04`, `05`, `15`
- Hosea daily / heart / sad / sweet: `06`, `07`, `08`, `22`
- Jael daily / heart / sad / sweet / dark-danger: `21`, `10`, `11`, `23`, `09`
- Kye upper / bloom: `12`, `18`
- Sealyra monologue / effort / shining entrance / Luv Poem performance: `17`, `16`, `20`, `19`
