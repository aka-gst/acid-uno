"use strict";

/* =========================================================
   ACID UNO — HEADLESS SIM
   ---------------------------------------------------------
   Партия на 2–7 мест целиком на редьюсере src/match.js.
   Симулятор ничего не знает о правилах: он только выбирает
   действие и складывает время.

   Запуск:
     node test/simulate.js [партий] [мест] [живых] [лимит_с]

   Лимит по умолчанию берётся из AcidRules.matchLimitFor();
   чтобы измерить чистую длительность, передай 999999.
   ========================================================= */

const R = require("../src/rules.js");
const M = require("../src/match.js");
const B = require("../src/bot.js");


/* =========================================================
   МОДЕЛЬ ВРЕМЕНИ

   Секунды сняты с реального кода:

     бот      wait91(85) + AcidFX.playBotCard(1210) + эффект(180)
     человек  snapToDiscard91(205) + эффект(180) + время на решение
     добор    addPlayerCardAnimated91(310) / botDrawBack91(~250)

   Живыми считаются первые humans мест.
   ========================================================= */

const TIMING = {
  play: [2.40, 1.35],
  drawOne: [0.90, 0.28],
  penaltyCard: [0.36, 0.28],
  colorPick: [1.10, 0.10]
};


/* =========================================================
   ПОЛИТИКА

   Та же, что у бота в игре и в комнате: src/bot.js.
   Разница между живым игроком и ботом здесь только
   во времени на ход.
   ========================================================= */

const decide = B.decide;


/* =========================================================
   СТОИМОСТЬ ХОДА ПО СОБЫТИЯМ
   ========================================================= */

function secondsFor(events, humans) {

  const pace = (key, seat) =>
    TIMING[key][seat < humans ? 0 : 1];


  let seconds = 0;

  events.forEach(event => {

    if (event.type === "played") {

      seconds += pace("play", event.seat);

      if (event.card.color === "wild") {
        seconds += pace("colorPick", event.seat);
      }
    }

    if (event.type === "drew") {
      seconds += pace("drawOne", event.seat);
    }

    if (event.type === "penalty") {
      seconds +=
        event.cards.length *
        pace("penaltyCard", event.seat);
    }
  });

  return seconds;
}


/* =========================================================
   ПАРТИЯ
   ========================================================= */

function mulberry32(seed) {

  let a = seed >>> 0;

  return function () {
    a = (a + 0x6D2B79F5) >>> 0;

    let t = Math.imul(a ^ (a >>> 15), 1 | a);

    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}


function playGame(seed, seats, limitSeconds, humans) {

  const live =
    Math.min(seats, Math.max(1, humans || 1));

  const roll = mulberry32(seed ^ 0x9E3779B9);

  let state =
    M.create({ seats, humans: live, seed });

  let clock = 0;

  let atLimit = null;

  let biggestStack = 0;

  let guard = 0;


  while (
    !state.over &&
    guard < 8000
  ) {
    guard++;

    if (clock <= limitSeconds) {

      atLimit = {
        clock,
        points: state.seats.map(s => R.handPoints(s.hand)),
        pendingPenalty: state.drawPenalty,
        seat: state.activeSeat
      };
    }

    const result =
      M.apply(
        state,
        decide(state, state.activeSeat, roll)
      );

    if (result.error) {
      break;
    }

    state = result.state;

    clock += secondsFor(result.events, live);

    biggestStack =
      Math.max(biggestStack, state.drawPenalty);
  }


  return {
    winner: state.winner,
    turns: state.turns,
    seconds: clock,
    biggestStack,
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


function run(games, seats, limitSeconds, humans) {

  const seconds = [];
  const turns = [];

  let timedOut = 0;
  let stackGames = 0;
  let pendingStack = 0;
  let draws = 0;
  let agrees = 0;
  let decided = 0;

  const gaps = [];


  for (let seed = 1; seed <= games; seed++) {

    const r =
      playGame(seed, seats, limitSeconds, humans);

    seconds.push(r.seconds);
    turns.push(r.turns);

    if (r.biggestStack >= 4) {
      stackGames++;
    }

    if (r.seconds <= limitSeconds) {
      continue;
    }

    timedOut++;

    if (r.atLimit.pendingPenalty > 0) {
      pendingStack++;
    }

    const who = leader(r.atLimit.points);

    if (who === null) {
      draws++;

    } else {
      decided++;

      const sorted =
        r.atLimit.points.slice().sort((a, b) => a - b);

      gaps.push(sorted[1] - sorted[0]);

      if (who === r.winner) {
        agrees++;
      }
    }
  }


  console.log(
    `\nМЕСТ ${seats}   ЖИВЫХ ${humans || 1}` +
    `   ПАРТИЙ ${games}   ЛИМИТ ${limitSeconds}s`
  );

  console.log(
    `  длительность, с:  медиана ${percentile(seconds, .5).toFixed(0)}` +
    `   p75 ${percentile(seconds, .75).toFixed(0)}` +
    `   p84 ${percentile(seconds, .84).toFixed(0)}` +
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
    return;
  }

  console.log(
    `    живой кластер на столе: ${pendingStack} (${pct(pendingStack, timedOut)})` +
    `   ничьих ${draws} (${pct(draws, timedOut)})`
  );

  console.log(
    `    совпало с реальным победителем ${pct(agrees, decided)}` +
    `   отрыв лидера: медиана ${percentile(gaps, .5)}, p10 ${percentile(gaps, .1)}`
  );
}


if (require.main === module) {

  const games =
    Number(process.argv[2] || 2000);

  const seats =
    Number(process.argv[3] || 2);

  const humans =
    Number(process.argv[4] || 1);

  const limit =
    Number(
      process.argv[5] ||
      R.matchLimitFor(seats, humans)
    );

  run(games, seats, limit, humans);
}


module.exports = {
  playGame,
  decide,
  TIMING
};
