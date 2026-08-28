"use strict";

/* =========================================================
   ACID UNO — HEADLESS SIM
   ---------------------------------------------------------
   Партия на 2–7 мест целиком на src/rules.js.
   Ни DOM, ни таймеров — только правила.

   Запуск:
     node test/simulate.js [партий] [мест] [лимит_с] [сек_человек] [сек_бот]

   Лимит по умолчанию берётся из AcidRules.matchLimitFor().
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

   Секунды сняты с реального кода:

     бот      wait91(85) + AcidFX.playBotCard(1210) + эффект(180)
     человек  snapToDiscard91(205) + эффект(180) + время на решение
     добор    addPlayerCardAnimated91(310) / botDrawBack91(~250)

   Место 0 — человек, остальные — боты.
   ========================================================= */

const TIMING = {
  play: [2.40, 1.35],
  drawOne: [0.90, 0.28],
  penaltyCard: [0.36, 0.28],
  colorPick: [1.10, 0.10]
};


const pace = (key, seat) =>
  TIMING[key][seat === 0 ? 0 : 1];


/* =========================================================
   СОСТОЯНИЕ
   ========================================================= */

function createGame(rng, seats) {

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


  const hands =
    Array.from(
      { length: seats },
      () => []
    );

  for (let i = 0; i < 7; i++) {
    hands.forEach(hand => hand.push(deck.pop()));
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
    seats,
    currentColor: first.color,
    drawPenalty: 0,
    penaltyType: null,
    seat: 0,
    direction: 1,
    clock: 0,
    turns: 0,
    roll,
    biggestStack: 0
  };
}


function view(g) {
  return {
    top: g.discard[g.discard.length - 1],
    currentColor: g.currentColor,
    drawPenalty: g.drawPenalty,
    penaltyType: g.penaltyType
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

    g.clock += pace("colorPick", g.seat);
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
    Math.max(g.biggestStack, g.drawPenalty);

  g.clock += pace("play", g.seat);

  return card;
}


function passTurn(g, card) {

  const next =
    R.turnAfterCard(
      card || { value: "0" },
      {
        seat: g.seat,
        seats: g.seats,
        direction: g.direction
      }
    );

  g.direction = next.direction;
  g.seat = next.seat;
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

      passTurn(g, card);

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

    g.clock +=
      amount * pace("penaltyCard", g.seat);

    g.drawPenalty = 0;
    g.penaltyType = null;

    g.turns++;

    /* принять штраф — значит закончить ход */
    passTurn(g, null);

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

      g.clock += pace("drawOne", g.seat);

      if (
        R.normalPlayable(card, view(g))
      ) {
        playable = [hand.length - 1];
      }
    }
  }


  if (playable.length === 0) {

    g.turns++;

    passTurn(g, null);

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


  passTurn(g, card);

  return { over: false };
}


/* =========================================================
   ПАРТИЯ
   ========================================================= */

function playGame(seed, seats, limitSeconds) {

  const g =
    createGame(mulberry32(seed), seats);

  let atLimit = null;

  let result = { over: false };

  let guard = 0;


  while (
    !result.over &&
    guard < 8000
  ) {
    guard++;

    /* снимок последнего состояния до отсечки */
    if (g.clock <= limitSeconds) {

      atLimit = {
        clock: g.clock,
        points: g.hands.map(R.handPoints),
        sizes: g.hands.map(h => h.length),
        pendingPenalty: g.drawPenalty,
        penaltyPoints: expectedPenaltyPoints(g),
        seat: g.seat
      };
    }

    result = step(g);
  }


  return {
    winner: result.winner ?? null,
    turns: g.turns,
    seconds: g.clock,
    biggestStack: g.biggestStack,
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


function leader(points) {

  const lowest = Math.min(...points);

  const leaders =
    points
      .map((value, seat) => ({ value, seat }))
      .filter(entry => entry.value === lowest);

  return leaders.length === 1
    ? leaders[0].seat
    : null;
}


function run(games, seats, limitSeconds) {

  const seconds = [];
  const turns = [];

  let timedOut = 0;
  let stackGames = 0;
  let pendingStack = 0;

  let draws = 0;
  let agrees = 0;
  let decided = 0;
  let variantsDisagree = 0;

  const gaps = [];


  for (let seed = 1; seed <= games; seed++) {

    const r = playGame(seed, seats, limitSeconds);

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

    const raw = snap.points.slice();

    const settled = snap.points.slice();

    if (snap.pendingPenalty > 0) {

      pendingStack++;

      settled[snap.seat] += snap.penaltyPoints;
    }

    const who = leader(settled);

    if (who === null) {
      draws++;

    } else {
      decided++;

      const sorted =
        settled.slice().sort((a, b) => a - b);

      gaps.push(sorted[1] - sorted[0]);

      if (who === r.winner) {
        agrees++;
      }
    }

    if (leader(raw) !== who) {
      variantsDisagree++;
    }
  }


  console.log(
    `\nМЕСТ ${seats}   ПАРТИЙ ${games}   ЛИМИТ ${limitSeconds}s`
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
    `  доиграно по очкам: ${timedOut} (${pct(timedOut, games)})`
  );

  if (timedOut === 0) {
    return { timedOut: 0, games };
  }

  console.log(
    `    живой кластер на столе: ${pendingStack} (${pct(pendingStack, timedOut)})` +
    `   гашение меняет победителя: ${variantsDisagree} (${pct(variantsDisagree, timedOut)})`
  );

  console.log(
    `    ничьих ${draws} (${pct(draws, timedOut)})` +
    `   совпало с реальным победителем ${pct(agrees, decided)}` +
    `   отрыв лидера: медиана ${percentile(gaps, .5)}, p10 ${percentile(gaps, .1)}`
  );

  return { timedOut, games };
}


if (require.main === module) {

  const games =
    Number(process.argv[2] || 2000);

  const seats =
    Number(process.argv[3] || 2);

  const limit =
    Number(
      process.argv[4] ||
      R.matchLimitFor(seats)
    );

  if (process.argv[5]) {
    TIMING.play[0] = Number(process.argv[5]);
  }

  if (process.argv[6]) {
    TIMING.play[1] = Number(process.argv[6]);
  }

  run(games, seats, limit);
}


module.exports = {
  playGame,
  createGame,
  step,
  run,
  TIMING
};
