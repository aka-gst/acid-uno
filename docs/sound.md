# ACID UNO — что просить у генератора звука

Codex звук не делает — он про картинки и текст. Нужны
другие инструменты: **музыка — Suno или Udio**, **звуки —
ElevenLabs Sound Effects** (там генерация коротких эффектов
по описанию). Промты ниже по-английски, они так понятнее.

## Куда это ляжет

Сейчас весь звук синтезируется кодом на WebAudio: ни одного
файла, ничего не грузится. Поэтому он и звучит как
осциллятор — потому что он и есть осциллятор.

Готовые файлы кладутся в `assets/sfx/` и `assets/music/`.
Загрузчик под них я допишу, когда файлы будут: он такой же,
как для картинок — есть файл, берём его; нет — играем
синтезом, как сейчас.

| что | имя файла | длина | формат |
|---|---|---|---|
| эффект | `sfx-<имя>.webm` | см. таблицу | webm/opus, моно |
| музыка | `music-loop.webm` | 60–90 с, бесшовная петля | webm/opus, стерео |

Opus вместо mp3: короткий щелчок в нём весит килобайты, и
петля на полторы минуты укладывается в мегабайт.

## Про сеттинг — и про меру

Игра неоново-киберпанковая: тёмный мокрый бетон, вывески,
осциллографы. Звук должен быть **оттуда**, но игра при этом
карточная и спокойная — человек сидит и думает над ходом.

Поэтому мера такая:

- **никаких выстрелов, взрывов, сирен и рычащих басов** —
  это стол, а не перестрелка;
- **никакого «эпика»** — оркестра, хоров, нарастаний;
- **ничего металлического и резкого на каждый ход**: карту
  кладут по десять раз за партию, и любой яркий звук на
  десятый раз становится раздражителем;
- киберпанк здесь — это **фактура**, а не сюжет: лёгкая
  цифровая окраска, шелест, короткий электрический призвук.

Короче: звук должен быть слышен и приятен на сотом
повторении. Если эффект хочется показать друзьям — он,
скорее всего, слишком яркий.

Общая приписка ко всем промтам эффектов:

```
Short UI sound for a calm neon-cyberpunk card game.
Clean, dry, close-mic, mono. No music, no melody, no
reverb tail longer than 200 ms. No sirens, no explosions,
no aggressive bass. Subtle digital texture, not sci-fi
cliche. Must stay pleasant after a hundred repeats.
```

---

## 1. Эффекты — по одному промту на файл

| файл | когда играет | длина | промт |
|---|---|---|---|
| `sfx-card` | карта легла на стол | 120 мс | soft paper card landing on a smooth surface, tiny digital click layered under it, dry |
| `sfx-draw` | взял карту из колоды | 140 мс | card sliding off a deck, light paper friction, faint electric tick at the end |
| `sfx-skip` | пропуск хода | 260 мс | short descending two-tone blip, like a door refusing to open, no harshness |
| `sfx-reverse` | разворот круга | 300 мс | quick upward-then-downward sweep, soft, like a switch flipping direction |
| `sfx-wild` | чёрная карта, выбран цвет | 380 мс | brief shimmering chord, four soft tones fanning out, glassy |
| `sfx-strike` | прилетел штраф +2 / +4 | 420 мс | muted impact with a short digital crackle, felt rather than loud |
| `sfx-penalty` | забрал штраф себе | 500 мс | several cards landing in a small pile, soft paper flurry |
| `sfx-uno` | объявлено UNO | 500 мс | bright confident two-note rise, warm, celebratory but small |
| `sfx-win` | ты выиграл | 1.6 с | short warm arpeggio resolving upward, hopeful, no fanfare, no drums |
| `sfx-lose` | ты проиграл | 1.4 с | short descending phrase, soft and rounded, disappointed but not grim |

Длины важны: всё, что играет каждый ход, должно кончаться
раньше, чем игрок сделает следующий. Полсекунды на карту —
уже перебор.

---

## 2. Музыка — одна петля

Сейчас музыка синтезируется: круг из четырёх аккордов, бас
на сильных долях и тихий щелчок между ними. Живая петля
нужна вместо него.

```
Downtempo ambient loop for a neon-noir card game, 60-90
seconds, seamless loop, 70-76 BPM. Warm analog pads, soft
sub bass on the downbeats, sparse muted plucks. Minor key,
calm and patient. No drums beyond a soft pulse, no vocals,
no risers, no drops, no melody that draws attention.
It must sit under conversation and stay listenable for an
hour. Mix quiet, plenty of headroom.
```

Три требования, которые важнее жанра:

1. **Бесшовно.** Петля идёт часами; шов слышно с первого
   круга.
2. **Без мелодии, которую можно напеть.** Такая петля
   надоедает за десять минут, а игра идёт дольше.
3. **Тихо сведена.** Громкость мы поставим сами, но
   вытянуть перекомпрессированный мастер обратно нельзя.

Если получится хорошо — пригодятся ещё две петли, чтобы
менялись между партиями, как меняются фон и рубашка:

- `music-loop-2` — то же самое, но холоднее: стеклянные
  тоны, меньше баса;
- `music-loop-3` — то же самое, но теплее: ленточное
  насыщение, лёгкий шум винила.

---

## 3. Чего не просить

- Голоса, объявляющего «UNO». В игре четыре языка бы
  понадобилось, а на пятый раз он бесит.
- Звука на наведение и на каждое касание интерфейса. Их
  слышно только тогда, когда они мешают.
- Отдельной музыки для меню. Меню видят пять секунд.

---

## Порядок важности

1. **`sfx-card` и `sfx-draw`** — они звучат чаще всего
   вместе взятого остального.
2. **Петля** — она определяет, приятно ли сидеть в игре.
3. Спецкарты.
4. Победа и поражение — звучат раз в партию.
