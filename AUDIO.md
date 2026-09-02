# ACID UNO — задание на звук

Задание самодостаточное. Промты по-английски — так генераторы точнее понимают
жанровые термины; пояснения и правила по-русски. У музыки два вида промта:
**строка стиля** для Suno и **развёрнутое описание** для ElevenLabs Music или
Stable Audio. Брать один из двух.

## Что за игра

Мобильная UNO с физичным перетаскиванием карт и неоново-киберпанковым
интерфейсом. Играют по ссылке: комната на четырёх букв, боты добираются на
пустые места.

Это **не экшен**. Ход длится столько, сколько человек думает, партия идёт
двадцать минут, и половину этого времени игрок ждёт чужого хода. Отсюда всё
остальное задание.

## Три вещи, которые определяют здесь звук

1. **Игра ждёт.** Музыка играет двадцать минут подряд, и её главное качество —
   не яркость, а способность не надоесть. Существующий встроенный цикл
   построен на круге **ля-минор — фа — до — соль** со сменой аккорда раз в
   3,2 секунды, то есть примерно 75 ударов в минуту. Файл должен занять это
   место, а не спорить с ним.
2. **Звук — единственная обратная связь на чужой ход.** Игрок держит телефон,
   смотрит в сторону, и по звуку понимает, что кто-то сходил, кого-то
   оштрафовали и что теперь его очередь. Поэтому звуки событий важнее музыки.
3. **Это телефон.** Ниже 200 Гц динамик не воспроизводит; вес всего звука
   вместе — не больше пары мегабайт.

В игре есть три режима звука: `full`, `sfx`, `off`. Многие играют в `sfx` —
музыка должна быть съёмной, а звуки самодостаточными.

## Правила выдачи

- **Музыка:** MP3, 96–128 kbps, 60–120 секунд, бесшовная петля по такту,
  около 75 BPM, без вокала.
- **Звуки:** WAV 44.1 кГц на генерации, в игру кладём MP3 или OGG. Короткие,
  без хвоста тишины, пик −3 дБ.
- **Никакого низа ниже 200 Гц.**
- **Карте нужно 3–4 варианта:** за партию карта ложится сотню раз.
- **Права:** файлы уезжают на публичный сайт.

---

# Музыка

## 1. `music/table.mp3` — за столом

Играет всю партию. Требование одно и главное: **не надоесть за двадцать минут**.
Пустые такты здесь важнее полных.

Строка стиля для Suno:

```
downtempo synthwave, 75 BPM, A minor, Am F C G progression, warm analog pads,
sparse rhodes, soft brushed drums, no vocals, loopable, hypnotic, unobtrusive
```

Развёрнутое описание:

```
A calm downtempo synthwave loop for a neon card game that people play on their
phones for twenty minutes at a time. 75 BPM, A minor, following an
Am – F – C – G progression with one chord roughly every 3.2 seconds. Warm
analog pads, a sparse electric-piano figure, and very soft brushed drums that
drop out entirely for several bars at a time. Hypnotic and unobtrusive — it
must survive being heard fifty times without becoming irritating, so nothing
should be catchy or foregrounded. Keep the low end above 200 Hz for phone
speakers. No vocals, no build-up. Seamless loop, 90 seconds.
```

## 2. `music/lobby.mp3` — лобби и ожидание игроков

Игрок создал комнату и ждёт, пока подтянутся люди. Ожидание должно ощущаться
коротким.

```
neon synthwave lobby loop, 90 BPM, A minor, arpeggiated bass, warm pads,
light hats, no vocals, loopable, anticipation, unobtrusive
```

## 3. `music/win.mp3` и `music/lose.mp3`

По 3 секунды, один раз, без петли.

Победа:

```
short neon victory sting, 3 seconds, bright rising synth arpeggio resolving to
a major chord with a warm shimmer. Celebratory but brief and not loud. No
vocals.
```

Поражение:

```
short neon defeat sting, 3 seconds, descending detuned synth line settling on
a minor chord. Wry rather than crushing — this is a card game. No vocals.
```

---

# Звуки

Сейчас всё синтезируется в `src/audio.js` — там есть словарь `BANK` с готовыми
именами: `card`, `draw`, `uno`, `reverse`, `skip`, `wild`, `penalty`, `strike`,
`resume`, `win`, `lose`. Файлы заменяют их имя в имя.

**Общее для всех:** это стол, а не бой. Ни один звук не должен пугать — самое
резкое событие здесь стоит игроку двух лишних карт.

## Карты

`sfx/card-1..4.wav` — карта легла на стол.

```
Playing card landing flat on a table, 0.12 seconds. A crisp paper slap with a
faint neon synth blip layered underneath. Clean, dry, satisfying, no reverb.
Nothing below 200 Hz. Mono.
```

`sfx/draw.wav` — взял карту из колоды.

```
Card being drawn from a deck, 0.12 seconds. A short paper slide with a soft
rising synth blip. Quieter and softer than playing a card. Mono.
```

`sfx/shuffle.wav`

```
Deck of cards being shuffled, 0.8 seconds. A quick riffle of paper edges with
a faint electronic sparkle over it. Dry, close. Mono.
```

`sfx/deal.wav`

```
Cards being dealt out quickly, 0.6 seconds. Four or five paper slaps in fast
succession, each slightly different. Dry, close. Mono.
```

## Особые карты — три разных характера

Их задача — быть различимыми на слух, не глядя на экран: игрок должен по звуку
понять, что именно прилетело.

`sfx/reverse.wav` — разворот, смена направления.

```
Direction reversal cue for a card game, 0.35 seconds. A synth tone sweeping up
and then immediately back down, like something turning around. Playful, warm,
clean. Mono.
```

`sfx/skip.wav` — пропуск хода, резкая отсечка.

```
Turn-skip cue, 0.2 seconds. A short synth tone cut off abruptly mid-note, with
a small mechanical click at the cut. Must read as an interruption. Mono.
```

`sfx/wild.wav` — чёрная карта, сейчас сменится цвет.

```
Wild card cue, 0.6 seconds. A shimmering synth sweep cycling through several
pitches, as if scanning colours, ending unresolved. Iridescent and open-ended.
Mono.
```

## Штрафы и UNO

`sfx/uno.wav` — игрок объявил UNO. Лучший момент партии, и звук должен быть
чуть-чуть наглым.

```
Triumphant call-out cue for a card game, 0.5 seconds. Two bright ascending
synth stabs with a warm shimmer tail. Cocky and celebratory but short. Mono.
```

`sfx/penalty.wav` — прилетел штраф.

```
Penalty cue, 0.5 seconds. A descending buzzing synth tone with a dull thud at
the end. Clearly bad news, but light — nobody should flinch. Mono.
```

`sfx/strike.wav` — поймали того, кто не сказал UNO.

```
"Caught you" cue, 0.4 seconds. A sharp double synth stab, bright and
accusatory, with a short tail. Playful, not harsh. Mono.
```

## Очередь и комната

`sfx/your-turn.wav` — самый нужный звук в игре: телефон в кармане, партия идёт,
и это единственное, что вернёт игрока к экрану.

```
"Your turn" notification cue, 0.5 seconds. Two soft ascending synth tones with
a warm shimmer — friendly, unmistakable, and pleasant enough to hear a hundred
times. Must cut through a phone speaker at low volume without being sharp.
Mono.
```

`sfx/player-join.wav`

```
Player joining a room, 0.4 seconds. A short rising synth blip with a soft
shimmer. Welcoming, quiet. Mono.
```

`sfx/player-leave.wav`

```
Player leaving a room, 0.4 seconds. A short descending synth blip fading out.
Neutral, quiet. Mono.
```

`sfx/ui-tap.wav`

```
UI tap for a neon interface, 0.05 seconds. A single soft synth click. Very
quiet. Mono.
```

---

# Что делать с готовыми файлами

1. Музыку положить в `music/`, звуки — в `assets/sfx/`.
2. `src/audio.js` сейчас синтезирует всё сам, и словарь `BANK` уже разложен по
   тем же именам, что и файлы выше. Заменять можно по одному, игровой код не
   трогая. **Три режима звука (`full`, `sfx`, `off`) должны продолжать
   работать**: в режиме `sfx` музыка не грузится вовсе, а не грузится и молчит —
   это мобильный трафик.
3. Начинать стоит с двух файлов: `card` и `your-turn`. Первый звучит сотню раз
   за партию, второй возвращает игрока в игру — вместе они дают почти всё
   ощущение звука в этой игре.
