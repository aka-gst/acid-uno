"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const R = require("../src/rules.js");


let seq = 1;

const card = (color, value) => ({
  id: seq++,
  color,
  value
});


/* =========================================================
   КОЛОДА
   ========================================================= */

test("в колоде 108 карт классического расклада", () => {

  let id = 1;

  const deck =
    R.createDeck((color, value) => ({
      id: id++,
      color,
      value
    }));

  assert.equal(deck.length, 108);

  const count = value =>
    deck.filter(c => c.value === value).length;

  assert.equal(count("0"), 4);
  assert.equal(count("7"), 8);
  assert.equal(count("+2"), 8);
  assert.equal(count("skip"), 8);
  assert.equal(count("reverse"), 8);
  assert.equal(count("wild"), 4);
  assert.equal(count("+4"), 4);
});


/* =========================================================
   ОЧКИ

   Числовые — по номиналу; +2 / разворот / пропуск /
   смена цвета — по 20; +4 — 40.
   ========================================================= */

test("очки карт", () => {

  assert.equal(R.cardPoints(card("red", "0")), 0);
  assert.equal(R.cardPoints(card("red", "7")), 7);
  assert.equal(R.cardPoints(card("red", "9")), 9);

  assert.equal(R.cardPoints(card("red", "+2")), 20);
  assert.equal(R.cardPoints(card("blue", "skip")), 20);
  assert.equal(R.cardPoints(card("green", "reverse")), 20);
  assert.equal(R.cardPoints(card("wild", "wild")), 20);

  assert.equal(R.cardPoints(card("wild", "+4")), 40);
});


test("сумма руки", () => {

  assert.equal(
    R.handPoints([
      card("red", "9"),
      card("blue", "+2"),
      card("wild", "+4")
    ]),
    69
  );

  assert.equal(R.handPoints([]), 0);
});


/* =========================================================
   СОРТИРОВКА

   Чёрные слева отдельной группой, дальше цвета,
   внутри цвета — по возрастанию номинала.
   ========================================================= */

test("рука сортируется по цвету и номиналу", () => {

  const hand = [
    card("blue", "3"),
    card("red", "skip"),
    card("wild", "+4"),
    card("red", "2"),
    card("green", "0"),
    card("wild", "wild"),
    card("red", "+2"),
    card("yellow", "9"),
    card("red", "9")
  ];

  const sorted =
    R.sortHand(hand).map(
      c => c.color + ":" + c.value
    );

  assert.deepEqual(sorted, [
    "wild:wild",
    "wild:+4",
    "red:2",
    "red:9",
    "red:skip",
    "red:+2",
    "yellow:9",
    "green:0",
    "blue:3"
  ]);
});


test("сортировка идёт на месте — ссылка на руку не меняется", () => {

  const hand = [
    card("blue", "3"),
    card("red", "1")
  ];

  assert.equal(R.sortHand(hand), hand);
});


test("одинаковые карты держатся в стабильном порядке", () => {

  const a = { id: 10, color: "red", value: "5" };
  const b = { id: 4, color: "red", value: "5" };

  assert.deepEqual(
    R.sortHand([a, b]).map(c => c.id),
    [4, 10]
  );
});


/* =========================================================
   ХОДИМОСТЬ И КЛАСТЕР +2 / +4
   ========================================================= */

test("обычный ход: совпадение по цвету, номиналу или чёрная", () => {

  const view = {
    top: card("red", "5"),
    currentColor: "red",
    drawPenalty: 0,
    penaltyType: null
  };

  assert.equal(R.canPlay(card("red", "9"), view), true);
  assert.equal(R.canPlay(card("blue", "5"), view), true);
  assert.equal(R.canPlay(card("wild", "wild"), view), true);
  assert.equal(R.canPlay(card("blue", "9"), view), false);
});


test("после Wild ходят выбранным цветом, а не цветом карты", () => {

  const view = {
    top: card("wild", "wild"),
    currentColor: "green",
    drawPenalty: 0,
    penaltyType: null
  };

  assert.equal(R.canPlay(card("green", "3"), view), true);
  assert.equal(R.canPlay(card("red", "3"), view), false);
});


test("кластер: +2 кроется +2 или +4, +4 — только +4", () => {

  const onTwo = {
    top: card("red", "+2"),
    currentColor: "red",
    drawPenalty: 2,
    penaltyType: "+2"
  };

  assert.equal(R.canPlay(card("blue", "+2"), onTwo), true);
  assert.equal(R.canPlay(card("wild", "+4"), onTwo), true);
  assert.equal(R.canPlay(card("red", "9"), onTwo), false);
  assert.equal(R.canPlay(card("wild", "wild"), onTwo), false);


  const onFour = {
    top: card("wild", "+4"),
    currentColor: "red",
    drawPenalty: 4,
    penaltyType: "+4"
  };

  assert.equal(R.canPlay(card("wild", "+4"), onFour), true);
  assert.equal(R.canPlay(card("red", "+2"), onFour), false);
});


test("кластер копится и после +4 больше не сбрасывается на +2", () => {

  let view = {
    top: card("red", "5"),
    currentColor: "red",
    drawPenalty: 0,
    penaltyType: null
  };

  view = R.applyCard(view, card("red", "+2"));

  assert.equal(view.drawPenalty, 2);
  assert.equal(view.penaltyType, "+2");

  view = R.applyCard(view, card("blue", "+2"));

  assert.equal(view.drawPenalty, 4);
  assert.equal(view.penaltyType, "+2");

  view = R.applyCard(view, card("wild", "+4"), "green");

  assert.equal(view.drawPenalty, 8);
  assert.equal(view.penaltyType, "+4");
  assert.equal(view.currentColor, "green");

  /* дальше кроется только +4 */
  assert.equal(R.canPlay(card("red", "+2"), view), false);
  assert.equal(R.canPlay(card("wild", "+4"), view), true);
});


test("перехват — только полное совпадение цвета и номинала", () => {

  const top = card("green", "7");

  assert.equal(R.canIntercept(card("green", "7"), top), true);
  assert.equal(R.canIntercept(card("green", "8"), top), false);
  assert.equal(R.canIntercept(card("blue", "7"), top), false);
});


/* =========================================================
   ЧАСЫ ПАРТИИ
   ========================================================= */

test("формат таймера", () => {

  assert.equal(R.formatClock(180), "3:00");
  assert.equal(R.formatClock(61), "1:01");
  assert.equal(R.formatClock(60), "1:00");
  assert.equal(R.formatClock(9), "0:09");
  assert.equal(R.formatClock(0), "0:00");
  assert.equal(R.formatClock(-5), "0:00");
});


test("таймер выходит на экран ровно за минуту до конца", () => {

  const clock =
    new R.MatchClock({ limitSeconds: 180 })
      .start();

  assert.equal(clock.advance(119).visible, false);
  assert.equal(clock.advance(1).visible, true);
  assert.equal(clock.advance(0).label, "1:00");
});


test("часы срабатывают один раз и останавливаются", () => {

  const clock =
    new R.MatchClock({ limitSeconds: 180 })
      .start();

  assert.equal(clock.advance(179).expired, false);
  assert.equal(clock.advance(2).expired, true);
  assert.equal(clock.advance(5).expired, false);
  assert.equal(clock.running, false);
});


test("часы можно выключить — стол так решил", () => {

  const clock =
    new R.MatchClock({ limitSeconds: 180 })
      .start();

  clock.disable();

  const snapshot = clock.advance(9999);

  assert.equal(snapshot.expired, false);
  assert.equal(snapshot.visible, false);
  assert.equal(clock.disabled, true);
});


/* =========================================================
   ИТОГ ПО ВРЕМЕНИ
   ========================================================= */

test("по гонгу выигрывает тот, у кого меньше сумма", () => {

  const result =
    R.timeoutResult({
      player: [card("red", "9"), card("blue", "1")],
      bot: [card("wild", "+4")]
    });

  assert.equal(result.winner, "player");
  assert.equal(result.draw, false);
  assert.deepEqual(result.points, { player: 10, bot: 40 });
});


test("равные суммы — ничья", () => {

  const result =
    R.timeoutResult({
      player: [card("red", "5"), card("red", "5")],
      bot: [card("blue", "3"), card("blue", "7")]
    });

  assert.equal(result.winner, null);
  assert.equal(result.draw, true);
  assert.deepEqual(result.leaders, ["player", "bot"]);
});


test("пустая рука по гонгу — ноль очков и победа", () => {

  const result =
    R.timeoutResult({
      player: [],
      bot: [card("red", "1")]
    });

  assert.equal(result.winner, "player");
  assert.equal(result.points.player, 0);
});


/* =========================================================
   ПРОСТОЙ УРОВЕНЬ
   ========================================================= */

test("на простом столе бот кладёт обычную карту, а не +4", () => {

  const hand = [
    card("wild", "+4"),
    card("red", "5"),
    card("red", "skip")
  ];

  const indexes = [0, 1, 2];

  /*
    Шум выключен: выбор должен держаться на раскладе,
    а не на удаче броска.
  */
  const still = () => 0;

  assert.equal(
    R.chooseCard(hand, indexes, still, true),
    1
  );

  assert.equal(
    R.chooseCard(hand, indexes, still, false),
    0
  );
});


test("простой бот всё же ходит спецкартой, если другой нет", () => {

  const hand = [
    card("red", "+2"),
    card("wild", "+4")
  ];

  assert.equal(
    R.chooseCard(hand, [0, 1], () => 0, true),
    0
  );
});


test("к концу партии простой бот не начинает бить", () => {

  const hand = [
    card("red", "+2"),
    card("blue", "3")
  ];

  assert.equal(
    R.chooseCard(hand, [0, 1], () => 0, true),
    1
  );
});


/* =========================================================
   КАРТА СЛОВАМИ
   ========================================================= */

test("карта называется в женском роде — она согласуется с «карта»", () => {

  assert.equal(R.cardLabel(card("blue", "9")), "СИНЯЯ · 9");
  assert.equal(R.cardLabel(card("yellow", "skip")), "ЖЁЛТАЯ · ПРОПУСК");
  assert.equal(R.cardLabel(card("wild", "+4")), "ЧЁРНАЯ · +4");
});


test("цвет отдельно живёт в мужском роде — он согласуется с «цвет»", () => {

  assert.equal(R.colorWord("blue"), "СИНИЙ");
  assert.equal(R.colorWordF("blue"), "СИНЯЯ");
  assert.equal(R.colorWordAcc("blue"), "СИНЮЮ");
});


test("совпадение по номиналу согласовано по роду номинала", () => {

  assert.equal(R.matchPhrase("9"), "ЛЮБАЯ 9");
  assert.equal(R.matchPhrase("skip"), "ЛЮБОЙ ПРОПУСК");
  assert.equal(R.matchPhrase("reverse"), "ЛЮБОЙ РАЗВОРОТ");
  assert.equal(R.matchPhrase("+2"), "ЛЮБАЯ +2");
});


test("подсказка в игре строится в винительном падеже", () => {

  /*
    «КЛАДИ ЗЕЛЁНУЮ» — не «зелёная» и не «зелёной». Подсказка
    написана как приказ, и падеж у неё свой.
  */
  assert.equal(R.colorWordAcc("green"), "ЗЕЛЁНУЮ");
  assert.equal(R.colorWordAcc("red"), "КРАСНУЮ");
  assert.equal(R.colorWordAcc("yellow"), "ЖЁЛТУЮ");
  assert.equal(R.colorWordAcc("wild"), "ЧЁРНУЮ");
});
