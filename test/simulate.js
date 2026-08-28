"use strict";

/* =========================================================
   ACID UNO — HEADLESS SIM
   ---------------------------------------------------------
   Партия бот-против-бота целиком на src/rules.js.
   Ни DOM, ни таймеров — только правила.

   Запуск:
     node test/simulate.js [партий] [сек_на_ход]
   ========================================================= */

const R = require("../src/rules.js");


/* Детерминированный ГПСЧ, чтобы прогон повторялся. */
function mulberry32(seed) {

  let a = seed >>> 0;

  return function () {
    a = (a + 0x6D2B79F5) >>> 0;

    let t = Math.imul(
      a ^ (a >>> 15),
      1 | a
    );

    t = (t + Math.imul(
      t ^ (t >>> 7),
      61 | t
    )) ^ t;

    return (
      (t ^ (t >>> 14)) >>> 0
    ) / 4294967296;
  };
}


/* =========================================================
   МОДЕЛЬ ВРЕМЕНИ

   Взято из реального кода: ход бота — короткая пауза плюс
   анимация выкладки; штрафной добор идёт по карте.
   ========================================================= */

/*
  Секунды сняты с реального кода:

    бот      wait91(85) + AcidFX.playBotCard(1210) + эффект(180)
    человек  snapToDiscard91(205) + эффект(180) + время на решение
    добор    addPlayerCardAnimated91(310) / botDrawBack91(~250)

  Место 0 — человек, место 1 — бот.
*/
const TIMING = {
  play: [2.40, 1.35],
  drawOne: [0.90, 0.28],
  penaltyCard: [0.36, 0.28],
  colorPick: [1.10, 0.10]
};


/* =========================================================
   СОСТОЯНИЕ
   ========================================================= */

function createGame(rng) {

  let nextId = 1;

  const roll =
    max => Math.floor(rng() * max);


  const deck =
    R.shuffle(
      R.createDeck(
        (color, value) => ({
          id: nextId++,
          color,
          value
        })
      ),
      roll
    );


  const hands = [[], []];

  for (let i = 0; i < 7; i++) {
    hands[0].push(deck.pop());
    hands[1].push(deck.pop());
  }


  let first = deck.pop();

  while (
    first &&
    (
      first.color === "wild" ||
      R.ACTION_VALUES.includes(first.value)
    )
  ) {
    deck.splice(
      roll(deck.length + 1),
      0,
      first
    );

    first = deck.pop();
  }


  return {
    deck,
    discard: [first],
    hands,
    currentColor: first.color,
    drawPenalty: 0,
    penaltyType: null,
    seat: 0,
    clock: 0,
    turns: 0,
    roll,

    /* журнал для разбора баланса */
    lastPenaltyEaten: [0, 0],
    biggestStack: 0
  };
}


/*
  Во что обойдётся висящий кластер тому, кто его берёт.
  Считаем по верхушке колоды — это ровно те карты,
  которые он и получит.
*/
function expectedPenaltyPoints(g) {

  if (g.drawPenalty <= 0) {
    return 0;
  }

  const slice =
    g.deck.slice(
      Math.max(
        0,
        g.deck.length - g.drawPenalty
      )
    );

  return R.handPoints(slice);
}


function view(g) {
  return {
    top: g.discard[g.discard.length - 1],
    currentColor: g.currentColor,
    drawPenalty: g.drawPenalty,
    penaltyType: g.penaltyType
  };
}


function take(g) {

  if (g.deck.length === 0) {

    if (g.discard.length <= 1) {
      return null;
    }

    const top = g.discard.pop();

    g.deck = R.shuffle(
      g.discard.slice(),
      g.roll
    );

    g.discard = [top];
  }

  return g.deck.pop() || null;
}


function play(g, index) {

  const hand = g.hands[g.seat];

  const card = hand[index];


  let chosenColor = null;

  if (card.color === "wild") {

    chosenColor =
      R.bestColor(hand, index);

    g.clock += TIMING.colorPick[g.seat];
  }


  hand.splice(index, 1);

  g.discard.push(card);


  const next =
    R.applyCard(
      view(g),
      card,
      chosenColor
    );


  g.currentColor = next.currentColor;
  g.drawPenalty = next.drawPenalty;
  g.penaltyType = next.penaltyType;

  g.biggestStack =
    Math.max(
      g.biggestStack,
      g.drawPenalty
    );

  g.clock += TIMING.play[g.seat];

  return card;
}


/* =========================================================
   ОДИН ХОД
   ========================================================= */

function step(g) {

  const hand = g.hands[g.seat];


  /* --- штраф на столе --- */

  if (g.drawPenalty > 0) {

    const defense =
      R.playableIndexes(hand, view(g));


    if (defense.length > 0) {

      const card =
        play(
          g,
          R.chooseCard(hand, defense, g.roll)
        );

      g.turns++;

      if (hand.length === 0) {
        return { over: true, winner: g.seat };
      }

      /* пропуск/разворот в игре на двоих оставляют ход */
      if (
        card.value === "skip" ||
        card.value === "reverse"
      ) {
        return { over: false };
      }

      g.seat = 1 - g.seat;

      return { over: false };
    }


    const amount = g.drawPenalty;

    for (let i = 0; i < amount; i++) {

      const card = take(g);

      if (!card) {
        break;
      }

      hand.push(card);
    }

    g.lastPenaltyEaten[g.seat] += amount;

    g.clock +=
      amount * TIMING.penaltyCard[g.seat];

    g.drawPenalty = 0;
    g.penaltyType = null;

    g.turns++;

    g.seat = 1 - g.seat;

    return { over: false };
  }


  /* --- обычный ход --- */

  let playable =
    R.playableIndexes(hand, view(g));


  if (playable.length === 0) {

    let safety = 0;

    while (
      playable.length === 0 &&
      safety < 150
    ) {
      safety++;

      const card = take(g);

      if (!card) {
        break;
      }

      hand.push(card);

      g.clock += TIMING.drawOne[g.seat];

      if (
        R.normalPlayable(card, view(g))
      ) {
        playable = [hand.length - 1];
      }
    }
  }


  if (playable.length === 0) {

    g.turns++;

    g.seat = 1 - g.seat;

    return { over: false };
  }


  const card =
    play(
      g,
      R.chooseCard(hand, playable, g.roll)
    );

  g.turns++;


  if (hand.length === 0) {
    return { over: true, winner: g.seat };
  }


  if (
    card.value === "skip" ||
    card.value === "reverse"
  ) {
    return { over: false };
  }


  g.seat = 1 - g.seat;

  return { over: false };
}


/* =========================================================
   ПАРТИЯ
   ========================================================= */

function playGame(seed, limitSeconds) {

  const g = createGame(mulberry32(seed));

  const snapshots = [];

  let result = { over: false };

  let guard = 0;


  while (
    !result.over &&
    guard < 4000
  ) {
    guard++;

    /* снимок ровно в момент отсечки */
    if (
      limitSeconds &&
      g.clock <= limitSeconds
    ) {
      snapshots.push({
        clock: g.clock,
        points: [
          R.handPoints(g.hands[0]),
          R.handPoints(g.hands[1])
        ],
        sizes: [
          g.hands[0].length,
          g.hands[1].length
        ],
        pendingPenalty: g.drawPenalty,
        seat: g.seat,
        penaltyPoints:
          expectedPenaltyPoints(g)
      });
    }

    result = step(g);
  }


  const atLimit =
    limitSeconds
      ? snapshots[snapshots.length - 1]
      : null;


  return {
    winner: result.winner ?? null,
    turns: g.turns,
    seconds: g.clock,
    biggestStack: g.biggestStack,
    penaltyEaten: g.lastPenaltyEaten,
    finalPoints: [
      R.handPoints(g.hands[0]),
      R.handPoints(g.hands[1])
    ],
    atLimit
  };
}


/* =========================================================
   ПРОГОН
   ========================================================= */

function percentile(values, p) {

  const sorted =
    values.slice().sort((a, b) => a - b);

  return sorted[
    Math.min(
      sorted.length - 1,
      Math.floor(sorted.length * p)
    )
  ];
}


function pct(part, whole) {
  return (
    part / Math.max(whole, 1) * 100
  ).toFixed(1) + "%";
}


function run(games, limitSeconds) {

  const seconds = [];
  const turns = [];

  let timedOut = 0;
  let stackGames = 0;

  /* A — считаем руки как есть */
  const raw = {
    draws: 0,
    agrees: 0,
    decided: 0,
    gaps: []
  };

  /* B — сначала гасим висящий кластер, потом считаем */
  const settled = {
    draws: 0,
    agrees: 0,
    decided: 0,
    gaps: []
  };

  let pendingStack = 0;
  let variantsDisagree = 0;


  for (let seed = 1; seed <= games; seed++) {

    const r = playGame(seed, limitSeconds);

    seconds.push(r.seconds);
    turns.push(r.turns);

    if (r.biggestStack >= 4) {
      stackGames++;
    }

    if (r.seconds <= limitSeconds) {
      continue;
    }

    timedOut++;

    const snap = r.atLimit;

    const rawPoints =
      snap.points.slice();

    const settledPoints =
      snap.points.slice();


    /*
      Вариант B: кто должен был забрать штраф — забирает.
      Среднее очко карты в колоде ≈ 7.6, но для оценки
      достаточно точного номинала уже вытянутых карт,
      поэтому берём реальную стоимость из снимка.
    */
    if (snap.pendingPenalty > 0) {

      pendingStack++;

      settledPoints[snap.seat] +=
        snap.penaltyPoints;
    }


    tally(raw, rawPoints, r.winner);
    tally(settled, settledPoints, r.winner);

    if (
      leader(rawPoints) !== leader(settledPoints)
    ) {
      variantsDisagree++;
    }
  }


  console.log(
    `\nПАРТИЙ ${games}   ЛИМИТ ${limitSeconds}s   ` +
    `выкладка ${TIMING.play[0]}s / ${TIMING.play[1]}s`
  );

  console.log(
    `  длительность, с:  медиана ${percentile(seconds, .5).toFixed(0)}` +
    `   p75 ${percentile(seconds, .75).toFixed(0)}` +
    `   p90 ${percentile(seconds, .9).toFixed(0)}` +
    `   p99 ${percentile(seconds, .99).toFixed(0)}`
  );

  console.log(
    `  ходов:            медиана ${percentile(turns, .5)}` +
    `   p90 ${percentile(turns, .9)}`
  );

  console.log(
    `  партий с кластером +4 и больше: ${stackGames} (${pct(stackGames, games)})`
  );

  console.log(
    `  не уложились в лимит: ${timedOut} (${pct(timedOut, games)})`
  );

  if (timedOut === 0) {
    return;
  }

  console.log(
    `  из них с живым кластером на столе: ${pendingStack} ` +
    `(${pct(pendingStack, timedOut)})`
  );

  report("A. руки как есть          ", raw, timedOut);
  report("B. кластер сначала гасим  ", settled, timedOut);

  console.log(
    `  варианты дают разного победителя: ${variantsDisagree} ` +
    `(${pct(variantsDisagree, timedOut)})`
  );
}


function leader(points) {

  if (points[0] === points[1]) {
    return null;
  }

  return points[0] < points[1] ? 0 : 1;
}


function tally(bucket, points, realWinner) {

  const who = leader(points);

  if (who === null) {
    bucket.draws++;
    return;
  }

  bucket.decided++;

  bucket.gaps.push(
    Math.abs(points[0] - points[1])
  );

  if (who === realWinner) {
    bucket.agrees++;
  }
}


function report(label, bucket, timedOut) {

  console.log(
    `  ${label} ничьих ${bucket.draws} (${pct(bucket.draws, timedOut)})` +
    `   совпало с реальным победителем ${pct(bucket.agrees, bucket.decided)}` +
    `   разрыв: медиана ${percentile(bucket.gaps, .5)}, p10 ${percentile(bucket.gaps, .1)}`
  );
}


if (require.main === module) {

  const games =
    Number(process.argv[2] || 2000);

  const limit =
    Number(process.argv[3] || 180);

  if (process.argv[4]) {
    TIMING.play[0] = Number(process.argv[4]);
  }

  if (process.argv[5]) {
    TIMING.play[1] = Number(process.argv[5]);
  }

  run(games, limit);
}


module.exports = {
  playGame,
  createGame,
  step,
  TIMING
};
