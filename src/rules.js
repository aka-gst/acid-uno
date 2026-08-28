"use strict";

/* =========================================================
   ACID UNO — RULES
   ---------------------------------------------------------
   Единственный модуль с правилами игры.

   Здесь НЕТ DOM, таймеров, анимаций и глобального состояния
   партии. Только чистые функции и маленькие машины состояний,
   поэтому модуль одинаково работает в браузере и в Node
   (headless-тесты и симуляция балансa).

   Отрисовка живёт в game.js / v9.1.js и обращается сюда.
   ========================================================= */

(function (root, factory) {

  const api = factory();

  if (
    typeof module === "object" &&
    module.exports
  ) {
    module.exports = api;
  }

  root.AcidRules = api;

})(
  typeof globalThis !== "undefined"
    ? globalThis
    : this,

  function () {


/* =========================================================
   БАЗОВЫЕ КОНСТАНТЫ
   ========================================================= */

const COLORS = [
  "red",
  "yellow",
  "green",
  "blue"
];


const ACTION_VALUES = [
  "skip",
  "reverse",
  "+2"
];


const WILD_VALUES = [
  "wild",
  "+4"
];


/*
  Порядок номиналов внутри одного цвета.
  Числа идут по возрастанию, следом спецкарты.
*/
const VALUE_ORDER = {
  "0": 0,
  "1": 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "skip": 10,
  "reverse": 11,
  "+2": 12,
  "wild": 13,
  "+4": 14
};


/*
  Чёрные карты стоят отдельной группой слева,
  дальше цвета в порядке COLORS.
*/
const COLOR_ORDER = {
  wild: 0,
  red: 1,
  yellow: 2,
  green: 3,
  blue: 4
};


/* =========================================================
   ОЧКИ

   Числовые карты — по номиналу.
   +2 / разворот / пропуск / смена цвета — по 20.
   +4 — 40.
   ========================================================= */

function cardPoints(card) {

  if (!card) {
    return 0;
  }

  if (card.value === "+4") {
    return 40;
  }

  /*
    Только чистые цифры идут по номиналу.
    Проверка обязана быть строгой: Number("+2") === 2,
    и штрафная карта тихо подешевела бы до двух очков.
  */
  if (
    /^[0-9]$/.test(card.value)
  ) {
    return Number(card.value);
  }

  return 20;
}


function handPoints(hand) {

  return (hand || []).reduce(
    (sum, card) =>
      sum + cardPoints(card),
    0
  );
}


/* =========================================================
   КОЛОДА

   108 карт классического UNO.
   makeCard передаётся снаружи, чтобы модуль не владел
   счётчиком id.
   ========================================================= */

function createDeck(makeCard) {

  const cards = [];


  COLORS.forEach(color => {

    cards.push(
      makeCard(color, "0")
    );

    for (
      let number = 1;
      number <= 9;
      number++
    ) {
      cards.push(
        makeCard(
          color,
          String(number)
        )
      );

      cards.push(
        makeCard(
          color,
          String(number)
        )
      );
    }

    for (
      let i = 0;
      i < 2;
      i++
    ) {
      ACTION_VALUES.forEach(
        value =>
          cards.push(
            makeCard(color, value)
          )
      );
    }
  });


  for (
    let i = 0;
    i < 4;
    i++
  ) {
    WILD_VALUES.forEach(
      value =>
        cards.push(
          makeCard("wild", value)
        )
    );
  }


  return cards;
}


/*
  Фишер–Йетс. random(max) -> целое [0, max).
*/
function shuffle(array, random) {

  const roll =
    random ||
    (max =>
      Math.floor(
        Math.random() * max
      ));


  for (
    let i = array.length - 1;
    i > 0;
    i--
  ) {
    const j = roll(i + 1);

    const tmp = array[i];

    array[i] = array[j];
    array[j] = tmp;
  }

  return array;
}


/* =========================================================
   ХОДИМОСТЬ

   view — снимок стола:
     { top, currentColor, drawPenalty, penaltyType }
   ========================================================= */

function normalPlayable(card, view) {

  const top =
    view.top;

  if (!top) {
    return true;
  }

  if (card.color === "wild") {
    return true;
  }

  return (
    card.color === view.currentColor ||
    card.value === top.value
  );
}


/*
  ACID UNO — кластер штрафов:

    +2 кроется   +2 или +4
    +4 кроется   только +4
*/
function canDefendPenalty(card, view) {

  if (
    !view.drawPenalty ||
    view.drawPenalty <= 0
  ) {
    return false;
  }

  if (
    view.penaltyType === "+2"
  ) {
    return (
      card.value === "+2" ||
      card.value === "+4"
    );
  }

  if (
    view.penaltyType === "+4"
  ) {
    return card.value === "+4";
  }

  return false;
}


function canPlay(card, view) {

  if (
    view.drawPenalty > 0
  ) {
    return canDefendPenalty(card, view);
  }

  return normalPlayable(card, view);
}


/* =========================================================
   ПЕРЕХВАТ
   ========================================================= */

function sameCard(a, b) {

  if (!a || !b) {
    return false;
  }

  return (
    a.color === b.color &&
    a.value === b.value
  );
}


function canIntercept(card, top) {
  return sameCard(card, top);
}


/* =========================================================
   ЭФФЕКТ КАРТЫ

   Возвращает новое состояние стола, ничего не мутируя.
   ========================================================= */

function applyCard(view, card, chosenColor) {

  let currentColor;

  if (card.color === "wild") {

    currentColor =
      chosenColor ||
      view.currentColor;

  } else {

    currentColor = card.color;
  }


  let drawPenalty =
    view.drawPenalty || 0;

  let penaltyType =
    view.penaltyType || null;


  if (card.value === "+2") {

    drawPenalty += 2;

    if (!penaltyType) {
      penaltyType = "+2";
    }
  }


  if (card.value === "+4") {

    drawPenalty += 4;

    penaltyType = "+4";
  }


  return {
    top: card,
    currentColor,
    drawPenalty,
    penaltyType
  };
}


/* =========================================================
   СОРТИРОВКА РУКИ

   Чёрные карты отдельной группой слева,
   дальше цвета, внутри цвета — по возрастанию номинала.
   ========================================================= */

function compareCards(a, b) {

  const colorA =
    COLOR_ORDER[a.color] ?? 99;

  const colorB =
    COLOR_ORDER[b.color] ?? 99;


  if (colorA !== colorB) {
    return colorA - colorB;
  }


  const valueA =
    VALUE_ORDER[a.value] ?? 99;

  const valueB =
    VALUE_ORDER[b.value] ?? 99;


  if (valueA !== valueB) {
    return valueA - valueB;
  }


  /*
    Одинаковые карты держим в стабильном порядке
    по id, иначе рука дёргается на каждой перерисовке.
  */
  return (a.id || 0) - (b.id || 0);
}


/*
  Сортирует массив на месте и возвращает его же —
  ссылка на руку в game.js остаётся той самой.
*/
function sortHand(hand) {
  return hand.sort(compareCards);
}


/* =========================================================
   UNO — МАШИНА СОСТОЯНИЙ

   Одна кнопка, два флага:

     called      — игрок успел объявить UNO
     vulnerable  — не объявил, и его можно поймать

   Главное правило: любой рост руки обнуляет объявление.
   Без этого после удачного «UNO!» флаг called оставался
   поднятым навсегда — кнопка больше не показывалась,
   и бот больше не ловил.
   ========================================================= */

const UNO_HAND_SIZE = 2;


class UnoCall {

  constructor() {
    this.called = false;
    this.vulnerable = false;
  }


  reset() {
    this.called = false;
    this.vulnerable = false;

    return this;
  }


  /*
    Объявлять UNO можно, только когда в руке ровно две карты
    и сейчас твой ход.
  */
  canCall(state) {

    return Boolean(
      state.active &&
      state.handSize === UNO_HAND_SIZE
    );
  }


  call(state) {

    if (!this.canCall(state)) {
      return false;
    }

    this.called = true;
    this.vulnerable = false;

    return true;
  }


  shouldShowButton(state) {

    return (
      this.canCall(state) &&
      !this.called
    );
  }


  /*
    Вызывается после того, как игрок выложил карту.

      "clear"     — в руке не одна карта, объявление снято
      "safe"      — осталась одна карта, UNO объявлен
      "exposed"   — осталась одна карта, UNO не объявлен
  */
  afterPlay(handSize) {

    if (handSize !== 1) {

      this.reset();

      return "clear";
    }


    if (this.called) {

      this.vulnerable = false;

      return "safe";
    }


    this.vulnerable = true;

    return "exposed";
  }


  /*
    Рука выросла (добор, штраф, поимка).
    Прошлое объявление больше не действует.

    Возвращает true, если состояние действительно сбросилось.
  */
  handGrew(handSize) {

    if (
      handSize <= UNO_HAND_SIZE - 1
    ) {
      return false;
    }

    if (
      !this.called &&
      !this.vulnerable
    ) {
      return false;
    }

    this.reset();

    return true;
  }


  /*
    Поймали: штраф выдаём один раз.
  */
  catchable(handSize) {

    return (
      this.vulnerable &&
      handSize === 1
    );
  }
}


/* =========================================================
   МЕСТА И НАПРАВЛЕНИЕ ХОДА

   Стол — это кольцо мест от 2 до 7. Направление хода
   1 (по часовой) или -1.
   ========================================================= */

const MIN_SEATS = 2;

const MAX_SEATS = 7;


function nextSeat(seat, seats, direction, step) {

  const shift =
    direction * (step === undefined ? 1 : step);

  return (
    (seat + shift) % seats + seats
  ) % seats;
}


/*
  Куда уходит ход после выложенной карты.

  На двоих разворот работает как пропуск — это и есть
  классическое правило, и именно так игра ведёт себя
  сейчас. На троих и больше разворот меняет направление.
*/
function turnAfterCard(card, state) {

  let direction = state.direction;

  let step = 1;


  if (card.value === "reverse") {

    if (state.seats === 2) {
      step = 2;

    } else {
      direction = -direction;
    }
  }


  if (card.value === "skip") {
    step = 2;
  }


  return {
    direction,

    seat:
      nextSeat(
        state.seat,
        state.seats,
        direction,
        step
      ),

    /* ход остался у того же игрока */
    again:
      nextSeat(
        state.seat,
        state.seats,
        direction,
        step
      ) === state.seat
  };
}


/* =========================================================
   ВЫБОР КАРТЫ БОТОМ
   ========================================================= */

function playableIndexes(hand, view) {

  const result = [];

  hand.forEach((card, index) => {

    if (canPlay(card, view)) {
      result.push(index);
    }
  });

  return result;
}


function interceptIndex(hand, top) {

  return hand.findIndex(
    card => sameCard(card, top)
  );
}


function bestColor(hand, excludingIndex) {

  const counts = {
    red: 0,
    yellow: 0,
    green: 0,
    blue: 0
  };


  hand.forEach((card, index) => {

    if (
      index !== excludingIndex &&
      COLORS.includes(card.color)
    ) {
      counts[card.color]++;
    }
  });


  return COLORS.reduce(
    (best, color) =>
      counts[color] > counts[best]
        ? color
        : best,
    "red"
  );
}


const BOT_PRIORITY = {
  "+4": 8,
  "+2": 7,
  "skip": 6,
  "reverse": 6,
  "wild": 2
};


function chooseCard(hand, indexes, noise) {

  const jitter =
    noise ||
    (() => Math.random());


  let best = indexes[0];

  let score = -Infinity;


  indexes.forEach(index => {

    const card = hand[index];

    let current =
      BOT_PRIORITY[card.value] || 3;


    if (card.color === "wild") {
      current -= 1;
    }


    if (
      hand.length <= 3 &&
      (
        ACTION_VALUES.includes(card.value) ||
        card.value === "+4"
      )
    ) {
      current += 3;
    }


    current += jitter() * .6;


    if (current > score) {
      score = current;
      best = index;
    }
  });


  return best;
}


/* =========================================================
   ЧАСЫ ПАРТИИ

   Партия ограничена по времени. Часы ничего не знают ни про
   DOM, ни про setInterval: снаружи в них просто досыпают
   прошедшие секунды.
   ========================================================= */

const MATCH_LIMIT_SECONDS = 230;   /* стол на двоих, один живой */

const MATCH_WARN_SECONDS = 60;


/*
  Лимит партии считается из физики стола, а не берётся из
  таблицы:

    лимит = сколько ходов обычно нужно, чтобы партия кончилась
            × сколько в среднем стоит один ход за этим столом

  Второй множитель и есть зависимость от числа живых игроков:
  доля живых мест за столом — это доля ходов, которые кто-то
  обдумывает руками, а не разыгрывает мгновенно.

  Числа сняты с test/simulate.js, который играет партии на том
  же редьюсере src/match.js и той же политикой бота, что и
  живая игра. Подгонка по сетке 2..7 мест × 1..7 живых,
  худшая ошибка на ней — 0.9%.

  Пересчитать после правок в скорости анимаций или в выборе
  карты ботом:

    node test/simulate.js 3000 <мест> <живых> 999999
*/

const TURNS_TO_FINISH = {
  2: 87,
  3: 135,
  4: 154,
  5: 162,
  6: 180,
  7: 209
};


const SECONDS_PER_TURN = {
  bot: 1.80,
  human: 3.49
};


/* показываем ровные значения: 4:00, а не 3:59 */
const LIMIT_STEP_SECONDS = 5;


function seatsInRange(seats) {

  return Math.min(
    MAX_SEATS,
    Math.max(MIN_SEATS, seats || MIN_SEATS)
  );
}


function matchLimitFor(seats, humans) {

  const total =
    seatsInRange(seats);

  const live =
    Math.min(
      total,
      Math.max(1, humans || 1)
    );


  const secondsPerTurn =
    SECONDS_PER_TURN.bot +

    (
      SECONDS_PER_TURN.human -
      SECONDS_PER_TURN.bot
    ) *
    live / total;


  const limit =
    TURNS_TO_FINISH[total] *
    secondsPerTurn;


  return (
    Math.round(limit / LIMIT_STEP_SECONDS) *
    LIMIT_STEP_SECONDS
  );
}


function formatClock(seconds) {

  const total =
    Math.max(0, Math.ceil(seconds));

  const minutes =
    Math.floor(total / 60);

  const rest =
    total % 60;

  return (
    minutes +
    ":" +
    String(rest).padStart(2, "0")
  );
}


class MatchClock {

  constructor(options) {

    const settings = options || {};

    this.limit =
      settings.limitSeconds ??
      MATCH_LIMIT_SECONDS;

    this.warn =
      settings.warnSeconds ??
      MATCH_WARN_SECONDS;

    this.elapsed = 0;
    this.running = false;
    this.expired = false;
  }


  start() {

    this.elapsed = 0;
    this.running = true;
    this.expired = false;

    return this;
  }


  stop() {

    this.running = false;

    return this;
  }


  /*
    Часы можно выключить целиком — в живой игре так делают
    единогласным решением стола.
  */
  disable() {

    this.limit = Infinity;

    return this;
  }


  get disabled() {
    return !Number.isFinite(this.limit);
  }


  remaining() {

    return Math.max(
      0,
      this.limit - this.elapsed
    );
  }


  /*
    Досыпать delta секунд.
    Возвращает снимок для отрисовки.
  */
  advance(delta) {

    if (
      this.running &&
      !this.disabled
    ) {
      this.elapsed += Math.max(0, delta || 0);
    }

    const left = this.remaining();

    const justExpired =
      this.running &&
      !this.disabled &&
      !this.expired &&
      left <= 0;

    if (justExpired) {
      this.expired = true;
      this.running = false;
    }

    return {
      remaining: left,

      label: formatClock(left),

      /* таймер показывается только за минуту до конца */
      visible:
        !this.disabled &&
        this.running &&
        left <= this.warn,

      urgent:
        !this.disabled &&
        left <= 10,

      expired: justExpired
    };
  }
}


/* =========================================================
   ИТОГ ПО ВРЕМЕНИ

   Партия не закончилась за отведённое время —
   выигрывает тот, у кого меньше сумма карт.
   ========================================================= */

function scoreboard(hands) {

  return hands.map(hand => ({
    hand,
    points: handPoints(hand)
  }));
}


/*
  hands: { [seat]: card[] }
  Возвращает { winner, points, draw }.
*/
function timeoutResult(hands) {

  const seats =
    Object.keys(hands);


  const points = {};

  seats.forEach(seat => {
    points[seat] = handPoints(hands[seat]);
  });


  const lowest =
    Math.min(
      ...seats.map(seat => points[seat])
    );


  const leaders =
    seats.filter(
      seat => points[seat] === lowest
    );


  return {
    winner:
      leaders.length === 1
        ? leaders[0]
        : null,

    draw: leaders.length > 1,

    leaders,

    points
  };
}


/* =========================================================
   ЭКСПОРТ
   ========================================================= */

return {

  COLORS,
  ACTION_VALUES,
  WILD_VALUES,
  VALUE_ORDER,
  COLOR_ORDER,
  UNO_HAND_SIZE,

  cardPoints,
  handPoints,

  createDeck,
  shuffle,

  normalPlayable,
  canDefendPenalty,
  canPlay,

  sameCard,
  canIntercept,

  applyCard,

  compareCards,
  sortHand,

  UnoCall,

  playableIndexes,
  interceptIndex,
  bestColor,
  chooseCard,
  BOT_PRIORITY,

  scoreboard,
  timeoutResult,

  MIN_SEATS,
  MAX_SEATS,
  nextSeat,
  turnAfterCard,

  MATCH_LIMIT_SECONDS,
  MATCH_WARN_SECONDS,
  TURNS_TO_FINISH,
  SECONDS_PER_TURN,
  matchLimitFor,
  formatClock,
  MatchClock

};


  }
);
