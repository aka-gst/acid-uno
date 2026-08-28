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
function decide(state, seat, roll) {

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
        R.chooseCard(hand, indexes, roll)
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
  unoDelay,
  turnDelay,
  UNO_DELAY_MS,
  TURN_DELAY_MS
};


  }
);
