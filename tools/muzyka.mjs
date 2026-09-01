/* =========================================================
   БОЕВАЯ ПЕТЛЯ ACID UNO — СИНТЕЗ ЧИСЛАМИ

   Второй путь к музыке: без модели и без сети, одной
   арифметикой. Первый путь — нейросетевой, идёт через
   ACE-Step на ПК; владелец просил сделать по варианту тем и
   другим, чтобы было что сравнить.

   Спокойная петля остаётся меню и сюжету. Эта — для боя:
   «музыку подинамичнее для игры».

   Запуск:  node tools/muzyka.mjs /куда/положить
   ========================================================= */

import { writeFileSync, mkdirSync } from "node:fs";

const RATE = 48000;


/* =========================================================
   РАЗМЕР ПЕТЛИ

   Длина считается от доли, а не наоборот: только так конец
   попадает ровно в начало. 112 ударов в минуту — быстрее
   спокойной петли, но не гонка: человек за столом думает над
   ходом, а не бежит.

   Шестнадцать тактов при четырёх долях — это 34.3 секунды.
   Меньше нельзя: восемь тактов на третьем круге уже узнаются
   и начинают надоедать.
   ========================================================= */

const BPM = 112;

const BEAT = 60 / BPM;

const BAR = BEAT * 4;

const BARS = 16;

const LEN = Math.round(BAR * BARS * RATE);


/* =========================================================
   ПРИМИТИВЫ

   Те же, что в tools/zvuki.mjs. Намеренно скопированы, а не
   вынесены в общий файл: этот скрипт должен запускаться сам
   по себе, без соседей, и переживать любую перестановку в
   репозитории.
   ========================================================= */

let seed = 20260901;

function rnd() {

  seed = (seed * 1664525 + 1013904223) >>> 0;

  return seed / 4294967296 * 2 - 1;
}


function pink(n) {

  const out = new Float32Array(n);

  let b0 = 0, b1 = 0, b2 = 0;

  for (let i = 0; i < n; i++) {

    const w = rnd();

    b0 = 0.99765 * b0 + w * 0.0990460;
    b1 = 0.96300 * b1 + w * 0.2965164;
    b2 = 0.57000 * b2 + w * 1.0526913;

    out[i] = (b0 + b1 + b2 + w * 0.1848) * 0.22;
  }

  return out;
}


function band(sig, from, to, q, curve = 1) {

  const n = sig.length;

  const out = new Float32Array(n);

  let z1 = 0, z2 = 0;

  for (let i = 0; i < n; i++) {

    const t = Math.pow(i / n, curve);

    const f = from + (to - from) * t;

    const w = 2 * Math.PI * f / RATE;

    const alpha = Math.sin(w) / (2 * q);

    const a0 = 1 + alpha;

    const v = (alpha / a0) * sig[i] + z1;

    z1 = z2 + (2 * Math.cos(w) / a0) * v;

    z2 = (-alpha / a0) * sig[i] - ((1 - alpha) / a0) * v;

    out[i] = v;
  }

  return out;
}


function env(n, attackMs, curve = 2.2) {

  const out = new Float32Array(n);

  const a = Math.max(1, (attackMs / 1000) * RATE);

  for (let i = 0; i < n; i++) {

    const up = i < a ? i / a : 1;

    out[i] = up * Math.pow(1 - i / n, curve);
  }

  return out;
}


function tone(n, f0, f1, harmonics, attackMs, curve) {

  const out = new Float32Array(n);

  const e = env(n, attackMs, curve);

  const phase = new Array(harmonics.length).fill(0);

  for (let i = 0; i < n; i++) {

    const f = f0 + (f1 - f0) * (i / n);

    let s = 0;

    harmonics.forEach((gain, k) => {

      phase[k] += 2 * Math.PI * f * (k + 1) / RATE;

      s += Math.sin(phase[k]) * gain;
    });

    out[i] = s * e[i];
  }

  return out;
}


/*
  Укладка с заворотом.

  Хвост, не поместившийся в конец, продолжается с начала. Это
  и делает петлю бесшовной: у последней ноты есть затухание,
  и оно звучит поверх первого такта, как если бы петля шла
  дальше. Без заворота на стыке слышен обрыв — тот самый шов,
  который узнаётся с первого круга.
*/
function place(out, sig, atSec, gain) {

  const off = Math.round(atSec * RATE);

  for (let i = 0; i < sig.length; i++) {

    out[(off + i) % out.length] += sig[i] * gain;
  }
}


/* =========================================================
   ГАРМОНИЯ

   Четыре аккорда по четыре такта, минор. Ноты названы
   числами, а не буквами: так видно, что бас и переборы берут
   одни и те же ступени и не разъезжаются.

   Ля минор: Am — F — C — G. Ход банальный намеренно: петля
   не должна обращать на себя внимание, её задача — держать
   темп, пока человек думает.
   ========================================================= */

const CHORDS = [
  { bass: 55.00, notes: [220.00, 261.63, 329.63] },
  { bass: 43.65, notes: [174.61, 220.00, 261.63] },
  { bass: 65.41, notes: [196.00, 261.63, 329.63] },
  { bass: 49.00, notes: [196.00, 246.94, 293.66] }
];


const track = new Float32Array(LEN);


for (let bar = 0; bar < BARS; bar++) {

  const t0 = bar * BAR;

  const chord = CHORDS[Math.floor(bar / 4) % CHORDS.length];


  /* --- пульс: удар на первую и третью долю --- */
  for (const beat of [0, 2]) {

    const n = Math.round(0.16 * RATE);

    place(
      track,
      tone(n, 62, 44, [1, 0.3], 2, 2.6),
      t0 + beat * BEAT,
      0.55
    );
  }


  /* --- бас: держит ступень аккорда весь такт --- */
  place(
    track,
    tone(
      Math.round(BAR * 0.92 * RATE),
      chord.bass, chord.bass,
      [1, 0.42, 0.16, 0.06],
      14, 1.15
    ),
    t0,
    0.30
  );


  /*
    --- шляпа: восьмые между долями ---

    Тише всего в наборе: она задаёт движение, а не звучит.
    Чуть громче на слабых долях — иначе рисунок стоит на
    месте.
  */
  for (let e = 1; e < 8; e += 2) {

    const n = Math.round(0.035 * RATE);

    const hat =
      band(pink(n), 6000, 9500, 1.1).map((v, i) =>
        v * env(n, 1, 3.2)[i]
      );

    place(
      track,
      Float32Array.from(hat),
      t0 + e * BEAT / 2,
      e === 3 || e === 7 ? 0.16 : 0.10
    );
  }


  /*
    --- перебор: синкопы по ступеням аккорда ---

    Рисунок сдвигается каждые четыре такта, чтобы шестнадцать
    тактов не были четырьмя одинаковыми.
  */
  const pattern =
    [[0.5, 0], [1.5, 1], [2.25, 2], [3.5, 1]];

  const shift = Math.floor(bar / 4) % 2 ? 0.25 : 0;

  for (const [beat, step] of pattern) {

    const n = Math.round(0.34 * RATE);

    const f = chord.notes[step];

    place(
      track,
      tone(n, f, f, [1, 0.34, 0.12, 0.05], 5, 2.4),
      t0 + (beat + shift) * BEAT,
      0.13
    );
  }
}


/*
  --- подложка: аккорд целиком, очень тихо ---

  Кладётся отдельным проходом на всю длину: она и склеивает
  такты в одно, чтобы петля не рассыпалась на кирпичи.
*/
for (let bar = 0; bar < BARS; bar += 4) {

  const chord = CHORDS[Math.floor(bar / 4) % CHORDS.length];

  for (const f of chord.notes) {

    place(
      track,
      tone(
        Math.round(BAR * 4.2 * RATE),
        f / 2, f / 2,
        [1, 0.3, 0.1],
        900, 0.5
      ),
      bar * BAR,
      0.055
    );
  }
}


/* =========================================================
   СВЕДЕНИЕ

   Тихо намеренно: громкость ставит игра, а перекомпрессиро-
   ванный мастер обратно не вытянуть. Пик 0.44 — это запас в
   семь децибел до потолка.
   ========================================================= */

let peak = 0;

for (const v of track) {
  peak = Math.max(peak, Math.abs(v));
}

const k = 0.44 / (peak || 1);

for (let i = 0; i < track.length; i++) {
  track[i] *= k;
}


/* =========================================================
   ЗАПИСЬ

   Фейдов по краям здесь нет и быть не должно: петля идёт по
   кругу, и любой фейд стал бы провалом на стыке. Ровный стык
   обеспечен заворотом хвостов.
   ========================================================= */

function wav(sig) {

  const head = Buffer.alloc(44);

  const bytes = sig.length * 2;

  head.write("RIFF", 0);
  head.writeUInt32LE(36 + bytes, 4);
  head.write("WAVEfmt ", 8);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(1, 22);
  head.writeUInt32LE(RATE, 24);
  head.writeUInt32LE(RATE * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write("data", 36);
  head.writeUInt32LE(bytes, 40);

  const body = Buffer.alloc(bytes);

  for (let i = 0; i < sig.length; i++) {

    const v = Math.max(-1, Math.min(1, sig[i]));

    body.writeInt16LE(Math.round(v * 32767), i * 2);
  }

  return Buffer.concat([head, body]);
}


const dir = process.argv[2] || "assets/music";

mkdirSync(dir, { recursive: true });

writeFileSync(`${dir}/music-battle.wav`, wav(track));


/* =========================================================
   ПРОВЕРКА СТЫКА

   Первая моя проверка сравнивала последние двадцать
   миллисекунд с первыми попарно и выдала 0.511 — «шов
   огромный». Это неверная мера: конец петли и её начало —
   разные места музыки, они и не должны совпадать сэмпл в
   сэмпл. Так меряют не шов, а несходство двух отрывков.

   Щелчок на стыке рождает не несходство, а РАЗРЫВ: скачок
   между последним сэмплом и первым. Его и меряем — вместе с
   громкостью по обе стороны стыка, чтобы поймать провал,
   если бы петля затухала к концу.
   ========================================================= */

const step =
  Math.abs(track[0] - track[track.length - 1]);

const rms = (from, count) => {

  let sum = 0;

  for (let i = 0; i < count; i++) {

    const v = track[(from + i + track.length) % track.length];

    sum += v * v;
  }

  return Math.sqrt(sum / count);
};

const win = Math.round(0.05 * RATE);

/*
  И вторая поправка к самому себе.

  Сначала я сравнивал громкость перед стыком с громкостью
  после и получил отношение 0.10 — «на стыке провал в десять
  раз». Это снова неверная мера: перед стыком стоит конец
  такта, самое тихое его место, а сразу после — доля с ударом,
  самое громкое. Такое отношение даст ЛЮБАЯ правильная петля.

  Сравнивать надо с таким же местом внутри петли: конец
  восьмого такта против конца шестнадцатого. Если они близки,
  стык ничем не отличается от обычной смены такта, а это и
  значит «шва нет».
*/
const предСтыком = rms(track.length - win, win);

const предВосьмым = rms(Math.round(BAR * 8 * RATE) - win, win);

const послеСтыка = rms(0, win);

console.log(
  `music-battle  ${(LEN / RATE).toFixed(1)} с  ${BPM} уд/мин  ` +
  `${BARS} тактов\n` +
  `  разрыв на стыке ${step.toFixed(4)} ` +
  `(щелчок слышен примерно от 0.05)\n` +
  `  конец петли ${предСтыком.toFixed(3)} против ` +
  `конца восьмого такта ${предВосьмым.toFixed(3)} — ` +
  `отношение ${(предСтыком / (предВосьмым || 1)).toFixed(2)} ` +
  `(единица значит, что стык не отличается от обычной смены такта)\n` +
  `  после стыка ${послеСтыка.toFixed(3)} — это доля с ударом, ` +
  `она и должна быть громче`
);
