"use strict";

/* =========================================================
   ACID UNO — MATCH
   ---------------------------------------------------------
   Партия как чистый редьюсер:

     apply(state, action) -> { state, events, error }

   Ни DOM, ни таймеров, ни Math.random: случайность живёт
   в самом состоянии отдельным числом, поэтому одна и та же
   последовательность действий всегда даёт одну и ту же
   партию. Это и есть условие, при котором сервер и клиент
   могут говорить об одном состоянии.

   Правила берутся из src/rules.js. Здесь только их
   применение к состоянию и порядок хода.
   ========================================================= */

(function (root, factory) {

  const rules =
    typeof module === "object" && module.exports
      ? require("./rules.js")
      : root.AcidRules;

  const api = factory(rules);

  if (
    typeof module === "object" &&
    module.exports
  ) {
    module.exports = api;
  }

  root.AcidMatch = api;

})(
  typeof globalThis !== "undefined"
    ? globalThis
    : this,

  function (R) {


/* =========================================================
   СЛУЧАЙНОСТЬ

   mulberry32: всё состояние генератора — одно 32-битное
   число, которое едет внутри состояния партии.
   ========================================================= */

function nextRandom(seed) {

  let a = (seed + 0x6D2B79F5) >>> 0;

  let t = Math.imul(
    a ^ (a >>> 15),
    1 | a
  );

  t = (t + Math.imul(
    t ^ (t >>> 7),
    61 | t
  )) ^ t;

  return {
    seed: a,

    value:
      ((t ^ (t >>> 14)) >>> 0) / 4294967296
  };
}


/*
  Перемешивание, которое возвращает и новый seed:
  без этого две подряд идущие тасовки дали бы одно и то же.
*/
function shuffled(cards, seed) {

  const array = cards.slice();

  let current = seed;

  for (
    let i = array.length - 1;
    i > 0;
    i--
  ) {
    const roll = nextRandom(current);

    current = roll.seed;

    const j =
      Math.floor(roll.value * (i + 1));

    const tmp = array[i];

    array[i] = array[j];
    array[j] = tmp;
  }

  return {
    cards: array,
    seed: current
  };
}


/* =========================================================
   СОЗДАНИЕ
   ========================================================= */

const HAND_SIZE = 7;


function create(options) {

  const settings = options || {};

  const seatCount =
    Math.min(
      R.MAX_SEATS,
      Math.max(
        R.MIN_SEATS,
        settings.seats || R.MIN_SEATS
      )
    );

  const humans =
    Math.min(
      seatCount,
      Math.max(1, settings.humans || 1)
    );

  /*
    За столом в комнате живые сидят не подряд: кто-то занял
    третье место, остальные добрали ботами. Поэтому состав
    можно задать списком, а humans остаётся коротким путём
    для одиночной игры.
  */
  const kinds =
    Array.from(
      { length: seatCount },
      (ignored, index) =>
        settings.kinds?.[index] ||
        (index < humans ? "human" : "bot")
    );


  let nextCardId = 1;

  const deal =
    shuffled(
      R.createDeck(
        (color, value) => ({
          id: nextCardId++,
          color,
          value
        })
      ),
      (settings.seed ?? 1) >>> 0
    );

  let deck = deal.cards;

  let seed = deal.seed;


  const seats =
    Array.from(
      { length: seatCount },
      (ignored, index) => ({
        index,

        kind: kinds[index],

        hand:
          deck.splice(
            deck.length - HAND_SIZE,
            HAND_SIZE
          ),

        unoCalled: false,
        unoVulnerable: false
      })
    );

  seats.forEach(
    seat => R.sortHand(seat.hand)
  );


  /*
    Первой на стол ложится обычная числовая карта: партия
    не должна начинаться со штрафа или смены цвета.
  */
  let first = deck.pop();

  while (
    first &&
    (
      first.color === "wild" ||
      R.ACTION_VALUES.includes(first.value)
    )
  ) {
    const roll = nextRandom(seed);

    seed = roll.seed;

    deck.splice(
      Math.floor(roll.value * (deck.length + 1)),
      0,
      first
    );

    first = deck.pop();
  }


  return {
    seats,
    deck,
    discard: [first],

    currentColor: first.color,

    drawPenalty: 0,
    penaltyType: null,

    activeSeat: 0,
    direction: 1,

    over: false,
    winner: null,
    draw: false,
    points: null,

    seed,
    turns: 0
  };
}


/* =========================================================
   КОПИЯ ПОД ЗАПИСЬ

   Карты неизменяемы, поэтому копируем только контейнеры.
   ========================================================= */

function draft(state) {

  return {
    ...state,

    seats:
      state.seats.map(
        seat => ({
          ...seat,
          hand: seat.hand.slice()
        })
      ),

    deck: state.deck.slice(),
    discard: state.discard.slice()
  };
}


/* =========================================================
   ВЗГЛЯД НА СТОЛ ДЛЯ ПРАВИЛ
   ========================================================= */

function tableView(state) {

  return {
    top: state.discard[state.discard.length - 1],
    currentColor: state.currentColor,
    drawPenalty: state.drawPenalty,
    penaltyType: state.penaltyType
  };
}


/* =========================================================
   КОЛОДА

   Кончилась — сброс, кроме верхней карты, тасуется заново.
   ========================================================= */

function takeOne(state) {

  if (state.deck.length === 0) {

    if (state.discard.length <= 1) {
      return null;
    }

    const top = state.discard.pop();

    const reshuffled =
      shuffled(state.discard, state.seed);

    state.deck = reshuffled.cards;
    state.seed = reshuffled.seed;
    state.discard = [top];
  }

  return state.deck.pop() || null;
}


function takeMany(state, amount) {

  const cards = [];

  for (let i = 0; i < amount; i++) {

    const card = takeOne(state);

    if (!card) {
      break;
    }

    cards.push(card);
  }

  return cards;
}


function give(state, seat, cards) {

  const hand =
    state.seats[seat].hand;

  hand.push(...cards);

  R.sortHand(hand);

  /*
    Рука выросла — прошлое объявление UNO больше не действует.
  */
  state.seats[seat].unoCalled = false;
  state.seats[seat].unoVulnerable = false;
}


/* =========================================================
   ПЕРЕДАЧА ХОДА
   ========================================================= */

function handOver(state, card, events) {

  const next =
    R.turnAfterCard(
      card || { value: "0" },
      {
        seat: state.activeSeat,
        seats: state.seats.length,
        direction: state.direction
      }
    );

  state.direction = next.direction;
  state.activeSeat = next.seat;

  events.push({
    type: "turn",
    seat: next.seat,
    direction: next.direction,
    again: next.again
  });
}


/* =========================================================
   ЗАВЕРШЕНИЕ
   ========================================================= */

function points(state) {

  return state.seats.map(
    seat => R.handPoints(seat.hand)
  );
}


function finishWith(state, winner, events) {

  state.over = true;
  state.winner = winner;
  state.draw = false;
  state.points = points(state);

  events.push({
    type: "over",
    winner,
    draw: false,
    points: state.points
  });
}


/* =========================================================
   ДЕЙСТВИЯ
   ========================================================= */

function fail(state, message) {
  return {
    state,
    events: [],
    error: message
  };
}


function actPlay(state, action) {

  const seat =
    state.seats[action.seat];

  if (!seat) {
    return fail(state, "нет такого места");
  }


  const index =
    seat.hand.findIndex(
      card => card.id === action.cardId
    );

  if (index === -1) {
    return fail(state, "карты нет в руке");
  }


  const card = seat.hand[index];

  const view = tableView(state);


  /*
    Перехват: карта, полностью совпадающая с верхней,
    кладётся вне очереди и забирает ход себе.
  */
  const intercept =
    action.seat !== state.activeSeat;

  if (intercept) {

    if (state.drawPenalty > 0) {
      return fail(state, "во время штрафа перехвата нет");
    }

    if (!R.canIntercept(card, view.top)) {
      return fail(state, "не твой ход");
    }
  }

  if (
    !intercept &&
    !R.canPlay(card, view)
  ) {
    return fail(state, "так ходить нельзя");
  }


  const next = draft(state);

  const events = [];


  if (intercept) {
    next.activeSeat = action.seat;
  }

  next.seats[action.seat].hand.splice(index, 1);

  next.discard.push(card);

  const applied =
    R.applyCard(
      tableView(next),
      card,

      card.color === "wild"
        ? action.color
        : null
    );

  next.currentColor = applied.currentColor;
  next.drawPenalty = applied.drawPenalty;
  next.penaltyType = applied.penaltyType;

  next.turns++;

  events.push({
    type: "played",
    seat: action.seat,
    card,
    color: next.currentColor,
    intercept
  });


  const hand =
    next.seats[action.seat].hand;

  if (hand.length === 0) {

    finishWith(next, action.seat, events);

    return { state: next, events };
  }


  /*
    Осталась одна карта — объявление либо засчитывается,
    либо место становится уязвимым для поимки.
  */
  if (hand.length === 1) {

    next.seats[action.seat].unoVulnerable =
      !next.seats[action.seat].unoCalled;

    if (next.seats[action.seat].unoVulnerable) {

      events.push({
        type: "exposed",
        seat: action.seat
      });
    }

  } else {

    next.seats[action.seat].unoCalled = false;
    next.seats[action.seat].unoVulnerable = false;
  }


  handOver(next, card, events);

  return { state: next, events };
}


function actDraw(state, action) {

  if (action.seat !== state.activeSeat) {
    return fail(state, "не твой ход");
  }


  const next = draft(state);

  const events = [];


  /*
    Штраф забирается целиком, и на этом ход заканчивается.
  */
  if (next.drawPenalty > 0) {

    const cards =
      takeMany(next, next.drawPenalty);

    give(next, action.seat, cards);

    events.push({
      type: "penalty",
      seat: action.seat,
      cards
    });

    next.drawPenalty = 0;
    next.penaltyType = null;

    next.turns++;

    handOver(next, null, events);

    return { state: next, events };
  }


  /*
    Добровольный добор — ровно одна карта, ход остаётся.
  */
  const card = takeOne(next);

  if (!card) {
    return fail(state, "карт больше нет");
  }

  give(next, action.seat, [card]);

  next.turns++;

  events.push({
    type: "drew",
    seat: action.seat,
    cards: [card]
  });

  return { state: next, events };
}


function actUno(state, action) {

  const seat =
    state.seats[action.seat];

  if (!seat) {
    return fail(state, "нет такого места");
  }

  if (action.seat !== state.activeSeat) {
    return fail(state, "не твой ход");
  }

  if (seat.hand.length !== R.UNO_HAND_SIZE) {
    return fail(state, "UNO объявляют на двух картах");
  }


  const next = draft(state);

  next.seats[action.seat].unoCalled = true;
  next.seats[action.seat].unoVulnerable = false;

  return {
    state: next,

    events: [{
      type: "uno",
      seat: action.seat
    }]
  };
}


function actCatch(state, action) {

  const target =
    state.seats[action.target];

  if (!target) {
    return fail(state, "нет такого места");
  }

  if (action.target === action.seat) {
    return fail(state, "себя не ловят");
  }

  if (
    !target.unoVulnerable ||
    target.hand.length !== 1
  ) {
    return fail(state, "ловить некого");
  }


  const next = draft(state);

  const cards = takeMany(next, 2);

  give(next, action.target, cards);

  return {
    state: next,

    events: [{
      type: "caught",
      seat: action.seat,
      target: action.target,
      cards
    }]
  };
}


/*
  Ходить нечем и брать неоткуда: колода пуста, а сброс —
  это одна верхняя карта. Ход просто уходит дальше.
*/
function actPass(state, action) {

  if (action.seat !== state.activeSeat) {
    return fail(state, "не твой ход");
  }

  if (
    legalMoves(state, action.seat).length > 0
  ) {
    return fail(state, "есть чем ходить");
  }

  if (
    state.deck.length > 0 ||
    state.discard.length > 1
  ) {
    return fail(state, "сначала возьми карту");
  }


  const next = draft(state);

  const events = [];

  next.turns++;

  handOver(next, null, events);

  return { state: next, events };
}


/*
  Окно поимки закрылось: место успело сказать UNO само.
  Кто и когда его закрывает — дело транспорта, не правил.
*/
function actCloseUno(state, action) {

  const target =
    state.seats[action.target];

  if (
    !target ||
    !target.unoVulnerable
  ) {
    return fail(state, "окно уже закрыто");
  }

  const next = draft(state);

  next.seats[action.target].unoVulnerable = false;
  next.seats[action.target].unoCalled = true;

  return {
    state: next,

    events: [{
      type: "uno",
      seat: action.target
    }]
  };
}


/*
  Гонг. Кластер, висящий на столе, сначала уходит тому, кто
  обязан был его забрать: иначе +4 на последней секунде
  выигрывал бы партию бесплатно.
*/
function actTimeout(state) {

  const next = draft(state);

  const events = [];


  if (next.drawPenalty > 0) {

    const cards =
      takeMany(next, next.drawPenalty);

    give(next, next.activeSeat, cards);

    events.push({
      type: "penalty",
      seat: next.activeSeat,
      cards
    });

    next.drawPenalty = 0;
    next.penaltyType = null;
  }


  const hands = {};

  next.seats.forEach(seat => {
    hands[seat.index] = seat.hand;
  });

  const outcome =
    R.timeoutResult(hands);

  next.over = true;
  next.points = points(next);
  next.draw = outcome.draw;

  next.winner =
    outcome.winner === null
      ? null
      : Number(outcome.winner);

  events.push({
    type: "over",
    reason: "time",
    winner: next.winner,
    draw: next.draw,
    leaders: outcome.leaders.map(Number),
    points: next.points
  });

  return { state: next, events };
}


const HANDLERS = {
  play: actPlay,
  draw: actDraw,
  pass: actPass,
  uno: actUno,
  catch: actCatch,
  closeUno: actCloseUno,
  timeout: actTimeout
};


function apply(state, action) {

  if (!action || !HANDLERS[action.type]) {
    return fail(state, "неизвестное действие");
  }

  if (
    state.over &&
    action.type !== "timeout"
  ) {
    return fail(state, "партия закончена");
  }

  return HANDLERS[action.type](state, action);
}


/* =========================================================
   ЧТО ВИДИТ ОДИН ИГРОК

   Чужие руки не отправляются никуда: наружу уходит только
   количество карт. Иначе мультиплеер раздаёт чужие карты
   всем, кто откроет вкладку разработчика.
   ========================================================= */

function view(state, seat) {

  return {
    seat,

    seats:
      state.seats.map(one => ({
        index: one.index,
        kind: one.kind,

        count: one.hand.length,

        hand:
          one.index === seat
            ? one.hand
            : null,

        unoCalled: one.unoCalled,
        unoVulnerable: one.unoVulnerable
      })),

    deckCount: state.deck.length,

    top: state.discard[state.discard.length - 1],

    currentColor: state.currentColor,
    drawPenalty: state.drawPenalty,
    penaltyType: state.penaltyType,

    activeSeat: state.activeSeat,
    direction: state.direction,

    over: state.over,
    winner: state.winner,
    draw: state.draw,
    points: state.points,

    turns: state.turns
  };
}


/* =========================================================
   ЧЕМ МОЖНО ХОДИТЬ
   ========================================================= */

function legalMoves(state, seat) {

  const one = state.seats[seat];

  if (!one || state.over) {
    return [];
  }

  const table = tableView(state);


  if (seat !== state.activeSeat) {

    /* вне очереди — только перехват */
    if (state.drawPenalty > 0) {
      return [];
    }

    return one.hand.filter(
      card => R.canIntercept(card, table.top)
    );
  }


  return one.hand.filter(
    card => R.canPlay(card, table)
  );
}


return {
  create,
  apply,
  view,
  legalMoves,
  tableView,
  HAND_SIZE
};


  }
);
