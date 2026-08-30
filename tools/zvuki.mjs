/* =========================================================
   СИНТЕЗ ЗВУКОВ ACID UNO

   Считает волну числами и пишет WAV. Дальше ffmpeg жмёт в
   opus — тем же способом, что и покупной набор.

   Строение взято из разбора реф-видео (UNO Mobile), палитра —
   наша. Что именно взято и что нет, расписано в docs/sound.md.

   Запуск:  node tools/zvuki.mjs assets/sfx-new
   ========================================================= */

import { writeFileSync, mkdirSync } from "node:fs";

const RATE = 48000;


/* =========================================================
   ПРИМИТИВЫ
   ========================================================= */

const buf = ms =>
  new Float32Array(Math.round((ms / 1000) * RATE));


/* Быстрый шум с фиксированным зерном: один и тот же файл
   при каждом запуске, иначе нечего сравнивать. */
let seed = 20260830;

function rnd() {

  seed = (seed * 1664525 + 1013904223) >>> 0;

  return seed / 4294967296 * 2 - 1;
}


/* Розовый шум мягче белого: у белого весь верх сразу, и на
   десятом повторе он режет. */
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


/*
  Полосовой фильтр с плавающей частотой. Именно он делает
  «замах»: полоса едет снизу вверх или сверху вниз, и шум
  из глухого становится звонким.
*/
function band(sig, from, to, q, curve = 1) {

  const n = sig.length;

  const out = new Float32Array(n);

  let z1 = 0, z2 = 0;

  for (let i = 0; i < n; i++) {

    const t = Math.pow(i / n, curve);

    const f = from + (to - from) * t;

    const w = 2 * Math.PI * f / RATE;

    const alpha = Math.sin(w) / (2 * q);

    const b0 = alpha;
    const b2 = -alpha;
    const a0 = 1 + alpha;
    const a1 = -2 * Math.cos(w);
    const a2 = 1 - alpha;

    const v = (b0 / a0) * sig[i] + z1;

    z1 = z2 - (a1 / a0) * v;

    z2 = (b2 / a0) * sig[i] - (a2 / a0) * v;

    out[i] = v;
  }

  return out;
}


function lowpass(sig, f) {

  const a = Math.exp(-2 * Math.PI * f / RATE);

  const out = new Float32Array(sig.length);

  let y = 0;

  for (let i = 0; i < sig.length; i++) {

    y = (1 - a) * sig[i] + a * y;

    out[i] = y;
  }

  return out;
}


/* Огибающая: подъём, спад, форма спада. */
function env(n, attackMs, curve = 2.2) {

  const out = new Float32Array(n);

  const a = Math.max(1, (attackMs / 1000) * RATE);

  for (let i = 0; i < n; i++) {

    const up = i < a ? i / a : 1;

    const down = Math.pow(1 - i / n, curve);

    out[i] = up * down;
  }

  return out;
}


/*
  Тональное тело. Не синус, а стопка гармоник: у синуса нет
  «мяса», и на фоне шумового замаха он звучит писком.
*/
function tone(n, f0, f1, harmonics, attackMs, curve) {

  const out = new Float32Array(n);

  const e = env(n, attackMs, curve);

  let phase = new Array(harmonics.length).fill(0);

  for (let i = 0; i < n; i++) {

    const t = i / n;

    const f = f0 + (f1 - f0) * t;

    let s = 0;

    harmonics.forEach((gain, k) => {

      const mult = k + 1;

      phase[k] += 2 * Math.PI * f * mult / RATE;

      s += Math.sin(phase[k]) * gain;
    });

    out[i] = s * e[i];
  }

  return out;
}


function mix(length, ...parts) {

  const out = buf(length);

  for (const [sig, gain, atMs] of parts) {

    const off = Math.round(((atMs || 0) / 1000) * RATE);

    for (let i = 0; i < sig.length; i++) {

      const j = i + off;

      if (j >= 0 && j < out.length) {
        out[j] += sig[i] * gain;
      }
    }
  }

  return out;
}


/* Нормализация с запасом: мастер игры и так поднимает. */
function norm(sig, peak = 0.82) {

  let max = 0;

  for (const v of sig) {
    max = Math.max(max, Math.abs(v));
  }

  if (!max) {
    return sig;
  }

  const k = peak / max;

  for (let i = 0; i < sig.length; i++) {
    sig[i] *= k;
  }

  /* Микрофейд по краям: щелчок среза слышно сильнее звука. */
  const f = Math.round(0.004 * RATE);

  for (let i = 0; i < f && i < sig.length; i++) {

    sig[i] *= i / f;

    sig[sig.length - 1 - i] *= i / f;
  }

  return sig;
}


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


/* =========================================================
   ЗВУКИ

   Правило, выведенное из рефа: событие звучит в два хода —
   шумовой замах, потом тональное тело. Но применяем это
   только к событиям, которые случаются редко.

   Карта и добор остаются короткими: они звучат по десять раз
   за партию, и замах на них через пять минут выест уши.
   ========================================================= */

const sounds = {

  /* --- то, что звучит каждый ход: коротко и сухо --- */

  card() {

    /* бумага + глухой удар стола + едва слышный цифровой тик */
    const n = Math.round(0.14 * RATE);

    const paper =
      band(pink(n), 2600, 900, 0.7).map((v, i) =>
        v * env(n, 1, 3.4)[i]
      );

    const thud =
      tone(Math.round(0.09 * RATE), 150, 92, [1, 0.35], 1, 3.2);

    const tick =
      tone(Math.round(0.02 * RATE), 2400, 1900, [1], 0.4, 2);

    return norm(
      mix(140,
        [Float32Array.from(paper), 0.85, 0],
        [thud, 0.55, 4],
        [tick, 0.10, 6]
      )
    );
  },


  draw() {

    /* карта съезжает с колоды: шорох снизу вверх */
    const n = Math.round(0.16 * RATE);

    const slide =
      band(pink(n), 700, 3200, 0.8, 0.7).map((v, i) =>
        v * env(n, 8, 2.0)[i]
      );

    const tick =
      tone(Math.round(0.022 * RATE), 1800, 2600, [1, 0.3], 0.5, 2.4);

    return norm(
      mix(165,
        [Float32Array.from(slide), 0.9, 0],
        [tick, 0.16, 128]
      )
    );
  },


  /* --- события: замах и тело, как в рефе --- */

  skip() {

    /*
      Реф: 0–0.30 шум, провал, 0.38–0.62 тональный удар с
      гармониками, короткий хвост. 640 мс.

      Наше: тот же скелет, но тело — падающая малая секунда
      вместо мультяшного «бонк». Отказ, а не шутка.
      */
    const wn = Math.round(0.30 * RATE);

    /*
      Шум сверху срезаем: без этого замах шипит, а шипение —
      первое, что надоедает.
    */
    const whoosh =
      lowpass(
        Float32Array.from(
          band(pink(wn), 500, 2600, 0.9, 0.8).map((v, i) =>
            v * env(wn, 30, 1.6)[i]
          )
        ),
        9000
      );

    /*
      Гармоник больше, чем кажется нужным: в рефе тело
      расчерчено полосами до трёх килогерц, и без них стопка
      звучит пустой.
    */
    const body =
      tone(
        Math.round(0.24 * RATE),
        233, 208,
        [1, 0.55, 0.35, 0.2, 0.12, 0.07],
        8, 2.6
      );

    const bn = Math.round(0.18 * RATE);

    const meat =
      band(pink(bn), 900, 2400, 1.4).map((v, i) =>
        v * env(bn, 10, 2.4)[i]
      );

    /*
      Удар с атакой в четыре миллисекунды, а не в один: на
      одной вертикаль во весь спектр слышна как щелчок.
    */
    const hit =
      tone(Math.round(0.10 * RATE), 120, 80, [1, 0.4], 4, 3);

    const tn = Math.round(0.09 * RATE);

    const tail =
      band(pink(tn), 4000, 8000, 1.1).map((v, i) =>
        v * env(tn, 3, 2.4)[i]
      );

    return norm(
      mix(640,
        [Float32Array.from(whoosh), 0.62, 0],
        [hit, 0.7, 355],
        [body, 0.8, 360],
        [Float32Array.from(meat), 0.22, 362],
        [Float32Array.from(tail), 0.3, 600]
      )
    );
  },


  reverse() {

    /*
      Реф: низкий, 388 Гц, 700 мс, сорок процентов энергии
      внизу — вихрь. Наше: полоса едет вниз и обратно вверх,
      тело поднимается. Слышно смену направления.
    */
    const an = Math.round(0.26 * RATE);

    const down =
      band(pink(an), 2400, 420, 0.8).map((v, i) =>
        v * env(an, 20, 1.3)[i]
      );

    const bn = Math.round(0.30 * RATE);

    const up =
      band(pink(bn), 420, 3000, 0.8, 0.75).map((v, i) =>
        v * env(bn, 40, 1.5)[i]
      );

    const body =
      tone(Math.round(0.30 * RATE), 165, 262, [1, 0.5, 0.24, 0.1], 25, 2.2);

    return norm(
      mix(700,
        [Float32Array.from(down), 0.6, 0],
        [Float32Array.from(up), 0.55, 250],
        [body, 0.75, 330]
      )
    );
  },


  wild() {

    /*
      Реф: шум, потом снизу вырастает гармонический стек —
      это на экране распускается выбор цвета. 900 мс.

      Наше: четыре тона по числу мастей, входят по очереди и
      остаются стоять аккордом. Смысл слышен: выбери один из
      четырёх.
    */
    const wn = Math.round(0.34 * RATE);

    /*
      Замах у чёрной карты самый яркий из всех: в рефе центр
      тяжести под пять килогерц — на экране в этот момент
      распускается выбор цвета, и звук должен «открываться».
    */
    const whoosh =
      band(pink(wn), 900, 6400, 0.6, 0.9).map((v, i) =>
        v * env(wn, 25, 1.8)[i]
      );

    const an = Math.round(0.5 * RATE);

    const air =
      band(pink(an), 5000, 9000, 1.0, 1.5).map((v, i) =>
        v * env(an, 90, 1.5)[i]
      );

    const notes = [220, 277.18, 329.63, 415.30];

    const parts = notes.map((f, k) => [
      tone(Math.round((0.42 - k * 0.03) * RATE), f, f, [1, 0.4, 0.16], 40, 1.7),
      0.34,
      300 + k * 70
    ]);

    return norm(
      mix(900,
        [Float32Array.from(whoosh), 0.5, 0],
        [Float32Array.from(air), 0.16, 280],
        ...parts
      )
    );
  },


  strike() {

    /* штраф прилетел: удар, а не взрыв — по правилам сеттинга */
    const n = Math.round(0.13 * RATE);

    const crack =
      band(pink(n), 3000, 700, 1.0).map((v, i) =>
        v * env(n, 1, 3.0)[i]
      );

    const thump =
      tone(Math.round(0.20 * RATE), 96, 58, [1, 0.5, 0.2], 1, 2.8);

    const metal =
      tone(Math.round(0.30 * RATE), 622, 587, [1, 0.6, 0.35, 0.2], 3, 2.4);

    return norm(
      mix(460,
        [Float32Array.from(crack), 0.7, 0],
        [thump, 0.9, 0],
        [metal, 0.42, 10]
      )
    );
  },


  penalty() {

    /* несколько карт легли в стопку — россыпь, не одна карта */
    const one = k => {

      const n = Math.round(0.11 * RATE);

      return Float32Array.from(
        band(pink(n), 2400 - k * 200, 800, 0.7).map((v, i) =>
          v * env(n, 1, 3.2)[i]
        )
      );
    };

    return norm(
      mix(560,
        [one(0), 0.8, 0],
        [one(1), 0.7, 95],
        [one(2), 0.75, 205],
        [one(3), 0.6, 330],
        [tone(Math.round(0.18 * RATE), 110, 78, [1, 0.4], 2, 2.6), 0.5, 300]
      )
    );
  },


  uno() {

    /*
      Реф: короткий яркий сигнал, 290 мс. Наше: две ноты
      вверх, тепло, без фанфары — объявление, а не победа.
    */
    const a =
      tone(
        Math.round(0.16 * RATE),
        587.33, 587.33,
        [1, 0.45, 0.2, 0.1, 0.05],
        6, 2.2
      );

    const b =
      tone(Math.round(0.26 * RATE), 880, 880, [1, 0.5, 0.22, 0.1], 6, 2.0);

    const sn = Math.round(0.07 * RATE);

    const spark =
      band(pink(sn), 6000, 9000, 1.2).map((v, i) =>
        v * env(sn, 2, 2.6)[i]
      );

    return norm(
      mix(400,
        [a, 0.7, 0],
        [b, 0.8, 130],
        [Float32Array.from(spark), 0.22, 125]
      )
    );
  },


  win() {

    /* короткое восходящее трезвучие, без барабанов и хора */
    const notes = [261.63, 329.63, 392, 523.25];

    const parts = notes.map((f, k) => [
      tone(Math.round((0.9 - k * 0.12) * RATE), f, f, [1, 0.45, 0.2, 0.09], 12, 1.9),
      0.42,
      k * 150
    ]);

    const sn = Math.round(0.5 * RATE);

    const air =
      band(pink(sn), 3000, 8000, 0.9, 1.4).map((v, i) =>
        v * env(sn, 120, 1.6)[i]
      );

    return norm(
      mix(1600,
        ...parts,
        [Float32Array.from(air), 0.14, 60]
      )
    );
  },


  lose() {

    /* то же, но вниз и глуше: расстроились, а не умерли */
    const notes = [392, 349.23, 293.66, 246.94];

    const parts = notes.map((f, k) => [
      tone(Math.round((0.8 - k * 0.1) * RATE), f, f, [1, 0.4, 0.15], 16, 2.0),
      0.4,
      k * 160
    ]);

    return norm(
      mix(1400,
        ...parts,
        [tone(Math.round(0.6 * RATE), 98, 82, [1, 0.3], 60, 2.2), 0.3, 320]
      )
    );
  }
};


/* =========================================================
   ЗАПУСК
   ========================================================= */

const dir = process.argv[2] || "assets/sfx-new";

mkdirSync(dir, { recursive: true });

for (const [name, make] of Object.entries(sounds)) {

  const sig = make();

  writeFileSync(`${dir}/sfx-${name}.wav`, wav(sig));

  console.log(
    `sfx-${name}\t${Math.round((sig.length / RATE) * 1000)} мс`
  );
}
