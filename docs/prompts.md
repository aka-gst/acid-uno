# Промты для картинок ACID UNO

Промты на английском намеренно: генераторы понимают его
заметно лучше, а нам нужна точность по композиции и палитре.
Русские пояснения — что это и куда встанет.

## Палитра (вставлять в промт как есть)

    background #06030d, violet #8b3dff, magenta #ff2bd6,
    cyan #20eaff, acid green #b7ff24, pink #ff2d78,
    yellow #f5d020, blue #22d3ee

---

## 1. Фон арены

Куда встанет: на весь экран под столом, поверх него ляжет
сетка, кольца и свечение карт. **Середина кадра обязана
остаться тёмной и пустой** — там лежат колода и сброс, и любая
деталь в центре будет спорить с картами.

Формат: 2560×1440, JPG или WebP. Нужно 3–4 варианта.

```
Top-down three-quarter view of an abandoned cyberpunk hangar
floor used as a card arena. Wet polished concrete with faint
circular markings. Along the left and right edges: thick
industrial pipes, cable trays, riveted metal panels, a few
small amber emergency lamps. Volumetric haze, cold cyan light
from above, warm orange bounce light from below.
The centre third of the frame is empty, dark and unlit —
no objects there.
Colour palette: background #06030d, violet #8b3dff, magenta
#ff2bd6, cyan #20eaff, acid green #b7ff24.
Cinematic, high contrast, deep blacks, film grain.
No text, no letters, no logos, no cards, no people, no UI.
2560x1440, wide shot.
```

Варианты той же сцены — менять только это:

- `derelict subway maintenance hall` вместо ангара
- `rain-soaked rooftop at night, neon signs reflected in
  puddles` — тогда убрать трубы и лампы
- `endless dark plane with a glowing horizon line and violet
  perspective grid, 80s retrowave` — под уже сделанную сетку

---

## 2. Портреты соперников

Куда встанут: в плашку игрока вместо осциллограммы, размер на
экране примерно 60×60. Значит: **крупная голова, минимум
мелких деталей**, иначе в игре превратится в кашу.

Формат: 1024×1024 квадрат, PNG. Нужно 8 штук — по числу
характеров. Фон однотонный тёмный, вырезать не нужно.

Общая часть промта (одинаковая у всех восьми — от неё
зависит, будут ли они смотреться одной серией):

```
Square portrait bust of a stylised cyberpunk android head,
front view, centred, filling most of the frame.
Flat dark background #06030d, no scenery.
Thin neon rim light, glowing eyes, minimal geometric shapes,
almost a logo — readable at 60 pixels.
Colour palette: violet #8b3dff, magenta #ff2bd6, cyan
#20eaff, acid green #b7ff24.
No text, no letters, no watermark, no shoulders below chest.
1024x1024.
```

И к ней по одной строке характера — под наши имена ботов:

1. **Мелодичный Джо** — `smooth chrome face, headphone
   discs over the ears, calm expression, cyan glow`
2. **Вафельная Элли** — `honeycomb lattice faceplate, soft
   rounded skull, warm yellow glow`
3. **Хмурый Барнаби** — `heavy brow plate, single wide
   visor, magenta glow, grim`
4. **Ленивая Марго** — `half-closed shutter eyes, tilted
   head, drooping antenna, violet glow`
5. **Пыльный Освальд** — `scratched matte plating, dust in
   the seams, respirator mouth, acid green glow`
6. **Скрипучий Тим** — `exposed servo jaw, mismatched eye
   sizes, loose wires, orange glow`
7. **Стеклянный Юджин** — `transparent glass skull with
   glowing circuitry inside, cyan and violet`
8. **Колючая Дафна** — `angular spiked crest, narrow slit
   eyes, sharp cheekbones, magenta glow`

---

## 3. Что прислать и как

Клади файлы как есть, я разложу сам. Нужны:

- `arena-1.jpg` … `arena-4.jpg` — фоны
- `bot-1.png` … `bot-8.png` — портреты в том же порядке, что
  выше

Если генератор выдаёт с текстом или подписью — перегенери:
любые буквы в кадре читаются как ошибка, дорисовать я их не
смогу.
