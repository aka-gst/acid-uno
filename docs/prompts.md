# ACID UNO — что просить у генератора картинок

Файл для Codex. Русские заголовки объясняют, зачем картинка
и куда ложится; сами промты по-английски — модели так
понятнее, и первый набор именно так и получился удачным.

## Как это попадёт в игру

Складывать в `assets/` рядом с уже лежащими файлами. Имена
строго по порядку, без пропусков: загрузчик идёт по номерам
и **останавливается на первом промахе**, поэтому `arena-7`
без `arena-6` не увидят обе.

| что | имя файла | размер | формат |
|---|---|---|---|
| фон стола | `arena-N.webp` | 1672×941 | webp |
| портрет соперника | `bot-N.webp` | 512×512 | webp |
| рубашка карты | `card-back-N.webp` | 512×768 | webp |
| текстура материала | `skin-<имя>.webp` | 512×512, бесшовная | webp |

Ничего в коде править не надо: `src/assets.js` перебирает
до 16 фонов, 24 портретов и 12 рубашек. Если файлов нет,
игра рисует всё сама — набор её только украшает.

**webp — не придирка.** Прошлый набор в нём весил 830 КБ
вместо полутора мегабайт в png при том же качестве.

## Палитра — общая для всего

Это не пожелание, а буквальные цвета игры. Всё, что
генерируется, должно жить в них:

```
розовый   #ff2d78     жёлтый    #f5d020
зелёный   #a6f42a     голубой   #22d3ee
фиолетовый#b55dff     фон       #08050f … #1a0b2e
```

Зелёный `#a6f42a` — главный цвет игры, им подсвечивается
всё важное. Фиолетовый держит фон и стол, поэтому мастью не
бывает.

Общее для **всех** промтов ниже:

```
neon cyberpunk, acid green #a6f42a, hot pink #ff2d78,
cyan #22d3ee, violet #b55dff on near-black #08050f.
No text, no letters, no numbers, no logos, no watermark.
No people looking at camera unless asked. No UI elements.
```

Текст просить нельзя ни в каком виде: буквы приходят
кривыми, а на карте рядом с настоящим номиналом это выглядит
браком.

---

## 1. Фоны стола — самое нужное

Сейчас их четыре, и все вертикальные по композиции: свет,
трубы и вывески в верхней трети. В альбомной ориентации
телефон режет кадр в узкую полосу — и от картинки остаётся
пустой пол.

**Нужно восемь новых, `arena-5` … `arena-12`.** Из них
первые четыре — «широкие», специально под альбом.

Жёсткое требование ко всем: **центральная треть кадра —
пустая и тёмная**. Там лежит стол с картами, и любая деталь
под ним превращается в грязь.

### arena-5 … arena-8 — широкие, под альбом

```
Wide cyberpunk environment, 16:9, shot dead-on at eye level.
All visual interest lives in a horizontal band across the
UPPER QUARTER and along the LEFT and RIGHT EDGES.
The entire centre of the frame is empty, dark, unlit floor —
no props, no lights, no detail there.
Neon: acid green, hot pink, cyan, violet on near-black.
Wet reflective floor, volumetric haze, deep perspective.
No text, no people, no UI.
```

Сюжеты по одному на кадр:

1. **Мост над трассой.** Empty neon overpass at night, traffic light trails far below on both sides, tall signage pylons at the left and right edges.
2. **Заброшенный вокзал.** Derelict transit hall, platform edges glowing left and right, departure boards dead and dark, empty floor between them.
3. **Оранжерея.** Overgrown neon greenhouse, bioluminescent plants climbing the left and right walls, bare wet floor in the middle.
4. **Ангар с дронами.** Drone hangar, docking racks along both side walls, service lights overhead, empty landing pad in the centre.

### arena-9 … arena-12 — обычные, под портрет

Тот же список требований, но интерес можно держать и в
верхней трети — под портрет она видна.

5. **Крыша под дождём.** Rooftop in heavy rain, city skyline of neon towers on the horizon, puddles, empty rooftop floor in front.
6. **Подземный переход.** Underground crossing, tiled walls with cracked neon strips, vanishing point deep ahead.
7. **Рынок ночью.** Night market street seen head-on, stall canopies and glowing signs high above on both sides, empty wet pavement below.
8. **Серверный зал.** Server hall, racks receding left and right, status lights, cold haze, empty aisle in the centre.

---

## 2. Портреты соперников — сейчас их не хватает

Имён в игре двадцать четыре, портретов восемь. Шестнадцать
соперников садятся за стол с чужим лицом.

Портрет теперь привязан к **имени**, а не к месту: `bot-N` —
это лицо N-го имени из списка (`assets/README.md`). Ржавый
Кларенс ржавый за любым столом.

**Нужно `bot-9` … `bot-24`** — по одному на имя, ровно в
этом порядке.

**И три замены.** Первые восемь портретов рисовались по
списку, который разошёлся с настоящим порядком имён на трёх
позициях. Проще перерисовать три файла, чем держать в голове
исключение:

| файл | было нарисовано для | нужно для |
|---|---|---|
| `bot-6` | Скрипучий Тим | **Бархатная Нина** — dark velvet skin with a soft matte sheen, heavy lidded eyes, deep violet rim light |
| `bot-7` | Стеклянный Юджин | **Скрипучий Тим** — gaunt face of dry cracked leather over a metal frame, exposed hinge at the jaw, amber rim light |
| `bot-8` | Колючая Дафна | **Сонная Роза** — eyes closed, serene, tiny sleep-mode LEDs on the temples, dim cyan rim light |

Старые «Юджин» и «Дафна» никуда не денутся — они снова
понадобятся под номерами 15 и 10, и их можно просто
переложить, если файлы сохранились.

Общая рамка:

```
Square portrait bust, 512x512, head and shoulders, centred,
looking slightly off-camera. Cyberpunk character on a plain
dark background #08050f with a soft neon rim light.
Painterly, not photographic. No text, no logos.
```

Имя — это характер, не подпись. По одному промту на файл:

| файл | имя | промт |
|---|---|---|
| `bot-9` | МЕДНЫЙ ФЕЛИКС | weathered copper prosthetic face, green patina in the seams, warm amber rim light |
| `bot-10` | КОЛЮЧАЯ ДАФНА | shaved head with fine metal spines along the scalp, sharp cheekbones, hot pink rim light |
| `bot-11` | ГУЛКИЙ АРЧИ | oversized resonator helmet, mouth grille, low hum implied, cyan rim light |
| `bot-12` | МЯТНАЯ СТЕЛЛА | pale mint-green synthetic skin, frost on the collar, acid green rim light |
| `bot-13` | РЖАВЫЙ КЛАРЕНС | rust-eaten steel jaw, flaking paint, one dim orange eye, dull amber rim light |
| `bot-14` | ВАТНАЯ ПОЛЛИ | soft padded suit collar swallowing the neck, muffled blank face, pale violet rim light |
| `bot-15` | СТЕКЛЯННЫЙ ЮДЖИН | transparent glass skull with glowing circuitry inside, cyan rim light |
| `bot-16` | ПЕРЕЧНАЯ ИРМА | freckled dark skin, sharp red-pepper eye implants, hot pink rim light |
| `bot-17` | ТИХИЙ МОРТИМЕР | long face half-hidden by a high collar, no mouth at all, deep violet rim light |
| `bot-18` | СЛЮДЯНАЯ БЕТТИ | mica-flake skin catching light in scales, iridescent, cool cyan rim light |
| `bot-19` | БУМАЖНЫЙ ГАРОЛЬД | face built from folded paper planes, creased, warm white rim light |
| `bot-20` | КЛЮКВЕННАЯ АГНЕС | deep crimson braids, cranberry-red goggles, hot pink rim light |
| `bot-21` | ДРЕБЕЗЖАЩИЙ СЭМ | loose vibrating metal plates over the face, motion blur at the edges, acid green rim light |
| `bot-22` | СЛИВОЧНАЯ ВИВЬЕН | cream-white porcelain face, hairline cracks, soft gold rim light |
| `bot-23` | ЖЕСТЯНОЙ ЛУКАС | crude tin-can head, riveted seams, single square eye slot, cyan rim light |
| `bot-24` | ПАСМУРНАЯ ОДЕТТА | grey overcast palette, hood up, rain on the shoulders, dim violet rim light |

Портреты обрезаются в круг и показываются размером до
92 точек, но на ретине это 184 — мелкие детали лица видно.

---

## 3. Рубашки карт

Сейчас четыре, вылетает случайная на партию. **Нужно ещё
шесть, `card-back-5` … `card-back-10`** — чтобы за вечер
стол не повторялся.

```
Playing card back, 512x768, portrait, symmetrical along both
axes, centred emblem, thin neon border inset ~6% from the
edge. Dark #08050f base. No text, no numbers.
```

1. Мандала из печатных дорожек (circuit-trace mandala), зелёная.
2. Змея, кусающая свой хвост, из оптоволокна — розовая.
3. Взрыв частиц, застывший в кристалл, — голубой.
4. Готическое окно-роза из неоновых трубок — фиолетовое.
5. Отпечаток пальца, разложенный в топографию, — зелёно-голубой.
6. Пара крыльев мотылька в разрезе — розово-фиолетовая.

---

## 4. Текстуры материалов — новое, этого ещё нет

Карта каждую партию «сделана» из одного из пяти материалов.
Сейчас все пять нарисованы кодом, и это видно: градиенты
чистые, а материал — нет.

**Нужны пять бесшовных текстур, `skin-film`, `skin-glass`,
`skin-pcb`, `skin-tube`, `skin-crt`.**

```
Seamless tileable texture, 512x512, flat top-down, no
perspective, no lighting hotspots, no vignette. Must tile
without visible seams. Dark, low contrast — this goes UNDER
a bright neon number and must not fight it.
```

| файл | что это |
|---|---|
| `skin-film` | holographic foil, fine diagonal rainbow interference |
| `skin-glass` | frosted glass, condensation micro-droplets |
| `skin-pcb` | printed circuit board traces and vias, very fine |
| `skin-tube` | brushed metal with faint neon tube reflections |
| `skin-crt` | CRT scanlines with phosphor bloom and slight noise |

Низкий контраст — не вкусовщина: поверх лежит номинал, и на
пёстрой подложке его уже приходилось спасать тёмным ореолом.

**Одна оговорка:** фоны, портреты и рубашки подхватываются
сами, а текстуры пока нет — под них нужно дописать примерно
двадцать строк в CSS, по одной подкладке на материал. Скажи,
когда файлы будут, — допишу и покажу до заливки.

---

## 5. Иконка для экрана «Домой»

Игра теперь запускается с домашнего экрана на весь экран,
без Safari, — и иконка стала лицом приложения.

**Нужен `icon-1024.png`, 1024×1024, PNG без прозрачности.**

```
App icon, 1024x1024, flat vector, bold and readable at 60px.
A single acid-green #a6f42a card silhouette at a slight tilt
on a deep violet-to-black radial background, thin neon rim.
No text, no letters. Safe margin 10% on all sides.
```

Буквы «UNO» на иконке не нужны — это чужой товарный знак, да
и в мелком размере они всё равно не читаются.

---

## Порядок важности

Если делать не всё сразу, то так:

1. **Широкие фоны `arena-5…8`** — альбом сейчас самое
   слабое место.
2. **Портреты `bot-9…24`** — шестнадцать соперников без лица.
3. **Текстуры материалов** — заметно поднимут сами карты.
4. Рубашки и иконка — приятно, но терпит.
