"use strict";

/* =========================================================
   ACID UNO — БОТ
   ---------------------------------------------------------
   Одна политика на всех: по ней ходит соперник в одиночной
   игре, бот за столом в комнате и бот в симуляторе баланса.
   Если бы их было три, замеры длительности партии перестали
   бы относиться к настоящей игре.

   Модуль чистый: выбирает действие по состоянию и ничего
   не меняет.
   ========================================================= */

(function (root, factory) {

  const deps =
    typeof module === "object" && module.exports
      ? {
          rules: require("./rules.js"),
          match: require("./match.js")
        }
      : {
          rules: root.AcidRules,
          match: root.AcidMatch
        };

  const api = factory(deps.rules, deps.match);

  if (
    typeof module === "object" &&
    module.exports
  ) {
    module.exports = api;
  }

  root.AcidBot = api;

})(
  typeof globalThis !== "undefined"
    ? globalThis
    : this,

  function (R, M) {


/*
  Что бот сделает на своём ходу.

  roll — источник случайности [0, 1): в симуляторе он
  детерминированный, в игре обычный Math.random.
*/
function decide(state, seat, roll, persona) {

  const moves =
    M.legalMoves(state, seat);


  if (moves.length > 0) {

    const hand =
      state.seats[seat].hand;

    const indexes =
      moves.map(
        card =>
          hand.findIndex(one => one.id === card.id)
      );

    const chosen =
      hand[
        chooseIndex(
          hand,
          indexes,
          persona || PERSONAS.balanced,
          roll
        )
      ];

    return {
      type: "play",
      seat,
      cardId: chosen.id,

      color:
        chosen.color === "wild"
          ? R.bestColor(
              hand,
              hand.indexOf(chosen)
            )
          : null
    };
  }


  /*
    Ходить нечем: штраф забираем целиком, иначе тянем
    по одной, пока не найдётся подходящая.
  */
  if (
    state.deck.length > 0 ||
    state.discard.length > 1 ||
    state.drawPenalty > 0
  ) {
    return { type: "draw", seat };
  }

  return { type: "pass", seat };
}


/*
  Характер задаёт не имя, а выбор в равной законной ситуации.
  Balanced оставляет прежнюю политику — это важно для старых
  симуляций длительности и комнат. Осторожный бережёт штрафы,
  рискованный тратит их, пока на столе есть возможность.
*/
const PERSONAS = Object.freeze({
  balanced: "balanced",
  cautious: "cautious",
  risky: "risky"
});


function personaForSeat(seat) {

  if (seat <= 0) {
    return PERSONAS.balanced;
  }

  return seat % 2 === 1
    ? PERSONAS.cautious
    : PERSONAS.risky;
}


function chooseIndex(hand, indexes, persona, noise) {

  const style =
    persona || PERSONAS.balanced;

  if (style === PERSONAS.balanced) {
    return R.chooseCard(hand, indexes, noise);
  }

  const jitter = noise || (() => Math.random());

  let best = indexes[0];
  let score = -Infinity;

  indexes.forEach(index => {

    const card = hand[index];

    let current;

    if (style === PERSONAS.cautious) {
      current =
        card.value === "+4"
          ? -20
          : card.value === "+2"
            ? -12
            : R.cardPoints(card);
    } else {
      current = {
        "+4": 100,
        "+2": 90,
        skip: 75,
        reverse: 75,
        wild: 50
      }[card.value] || R.cardPoints(card);
    }

    current += jitter() * .01;

    if (current > score) {
      score = current;
      best = index;
    }
  });

  return best;
}


const REACTION_CHANCE = .22;


/*
  Реакция — редкий ответ на состоявшийся ход, не генератор
  реплик. Ключ карты не даёт одному событию прозвучать дважды.
*/
function reactionFor(event, targetSeat, persona, roll, seen) {

  if (
    !event ||
    event.type !== "played" ||
    event.card?.value !== "+4" ||
    persona !== PERSONAS.cautious ||
    targetSeat === event.seat
  ) {
    return null;
  }

  const key =
    `${event.seat}:${event.card.id}`;

  const memory = seen || new Set();

  if (memory.has(key)) {
    return null;
  }

  memory.add(key);

  if ((roll || Math.random)() >= REACTION_CHANCE) {
    return null;
  }

  return {
    seat: targetSeat,
    kind: "cautious-plus4",
    message: "НЕ РИСКУЙ."
  };
}


/*
  Бот объявляет UNO не мгновенно: человеку нужно окно,
  чтобы успеть его поймать.
*/
const UNO_DELAY_MS = [440, 700];


function unoDelay(roll) {

  const value =
    (roll || Math.random)();

  return (
    UNO_DELAY_MS[0] +
    value * (UNO_DELAY_MS[1] - UNO_DELAY_MS[0])
  );
}


/*
  Пауза перед ходом, чтобы за столом было видно, кто думает.
*/
const TURN_DELAY_MS = [620, 1150];


function turnDelay(roll) {

  const value =
    (roll || Math.random)();

  return (
    TURN_DELAY_MS[0] +
    value * (TURN_DELAY_MS[1] - TURN_DELAY_MS[0])
  );
}


return {
  decide,
  chooseIndex,
  personaForSeat,
  reactionFor,
  unoDelay,
  turnDelay,
  PERSONAS,
  REACTION_CHANCE,
  UNO_DELAY_MS,
  TURN_DELAY_MS
};


  }
);
