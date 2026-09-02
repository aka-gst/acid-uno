"use strict";

/* =========================================================
   ACID UNO — ИНТЕРАКТИВНЫЙ ТУР
   ---------------------------------------------------------
   Небольшая детерминированная партия для первого захода.
   Здесь нет собственной логики UNO: каждый ход, штраф, UNO
   и победа проходят через тот же AcidMatch.apply(), что и
   обычная партия и серверная комната.
   ========================================================= */

(function (root, factory) {

  const match =
    typeof module === "object" && module.exports
      ? require("./match.js")
      : root.AcidMatch;

  const api = factory(match);

  if (
    typeof module === "object" && module.exports
  ) {
    module.exports = api;
  }

  root.AcidTutorialFlow = api;

})(
  typeof globalThis !== "undefined"
    ? globalThis
    : this,

  function (Match) {


const STEPS = {
  "match-color": {
    title: "ХОД ПО ЦВЕТУ",
    hint: "ПОЛОЖИ КРАСНУЮ 3",
    wrong: "КРАСНАЯ 3"
  },

  "stack-penalty": {
    title: "ОТВЕТЬ НА +2",
    hint: "КЛАДИ СВОЮ СИНЮЮ +2",
    wrong: "СИНЯЯ +2"
  },

  "call-uno": {
    title: "СКАЖИ UNO",
    hint: "ОСТАЛОСЬ ДВЕ КАРТЫ — НАЖМИ UNO"
  },

  "play-to-one": {
    title: "ОДНА КАРТА",
    hint: "СЫГРАЙ СИНЮЮ 7",
    wrong: "СИНЯЯ 7"
  },

  finish: {
    title: "ПОБЕДА",
    hint: "ПОЛОЖИ ПОСЛЕДНЮЮ СИНЮЮ 9",
    wrong: "СИНЯЯ 9"
  },

  done: {
    title: "ТУР ПРОЙДЕН",
    hint: "ТЕПЕРЬ МОЖНО ИГРАТЬ"
  }
};


function card(id, color, value) {

  return { id, color, value };
}


/*
  Сценарий намеренно задан картами, а не seed: тогда тест и
  подсказка называют одну и ту же карту. Но сами последствия
  вычисляет настоящий редьюсер Match.apply().
*/
function scenario() {

  return {
    seats: [
      {
        index: 0,
        kind: "human",
        hand: [
          card(1, "red", "3"),
          card(2, "blue", "+2"),
          card(3, "blue", "7"),
          card(4, "blue", "9")
        ],
        unoCalled: false,
        unoVulnerable: false
      },
      {
        index: 1,
        kind: "bot",
        hand: [
          card(5, "red", "+2"),
          card(6, "blue", "1")
        ],
        unoCalled: false,
        unoVulnerable: false
      }
    ],

    /* четыре карты забирает бот после ответного +2 */
    deck: [
      card(10, "yellow", "0"),
      card(11, "green", "1"),
      card(12, "red", "8"),
      card(13, "blue", "4")
    ],

    discard: [
      card(100, "red", "5")
    ],

    currentColor: "red",
    drawPenalty: 0,
    penaltyType: null,
    activeSeat: 0,
    direction: 1,
    over: false,
    winner: null,
    draw: false,
    points: null,
    seed: 1,
    turns: 0
  };
}


function create() {

  return {
    state: scenario(),
    step: "match-color"
  };
}


function help(flow) {

  return STEPS[flow.step] || STEPS.done;
}


function rejected(flow, message) {

  return {
    flow,
    events: [],
    error: message
  };
}


function apply(state, action) {

  return Match.apply(state, action);
}


function play(state, seat, cardId) {

  return apply(state, {
    type: "play",
    seat,
    cardId
  });
}


function advance(flow, action, nextStep, automatic) {

  const result =
    apply(flow.state, action);

  if (result.error) {
    return rejected(flow, result.error);
  }

  let state = result.state;
  let events = result.events.slice();

  if (automatic) {
    const bot = automatic(state);

    if (bot.error) {
      return rejected(flow, bot.error);
    }

    state = bot.state;
    events = events.concat(bot.events);
  }

  return {
    flow: {
      state,
      step: nextStep
    },
    events
  };
}


function wrongCard(flow) {

  return rejected(
    flow,
    `СЕЙЧАС НУЖНА ${help(flow).wrong}`
  );
}


function act(flow, action) {

  if (!flow || !flow.state || !STEPS[flow.step]) {
    throw new Error("неверное состояние учебного тура");
  }

  switch (flow.step) {

    case "match-color":
      if (action?.type !== "play" || action.cardId !== 1) {
        return wrongCard(flow);
      }

      return advance(
        flow,
        action,
        "stack-penalty",
        state => play(state, 1, 5)
      );

    case "stack-penalty":
      if (action?.type !== "play" || action.cardId !== 2) {
        return wrongCard(flow);
      }

      return advance(
        flow,
        action,
        "call-uno",
        state => apply(state, {
          type: "draw",
          seat: 1
        })
      );

    case "call-uno":
      if (action?.type !== "uno" || action.seat !== 0) {
        return rejected(flow, "СЕЙЧАС НУЖНО СКАЗАТЬ UNO");
      }

      return advance(
        flow,
        action,
        "play-to-one"
      );

    case "play-to-one":
      if (action?.type !== "play" || action.cardId !== 3) {
        return wrongCard(flow);
      }

      return advance(
        flow,
        action,
        "finish",
        state => play(state, 1, 6)
      );

    case "finish":
      if (action?.type !== "play" || action.cardId !== 4) {
        return wrongCard(flow);
      }

      return advance(
        flow,
        action,
        "done"
      );

    default:
      return rejected(flow, "ТУР УЖЕ ПРОЙДЕН");
  }
}


return {
  STEPS,
  create,
  help,
  act
};

});
