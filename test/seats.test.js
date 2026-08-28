"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const R = require("../src/rules.js");


const at = (seat, seats, direction) => ({
  seat,
  seats,
  direction
});

const after = (value, state) =>
  R.turnAfterCard({ value }, state);


/* =========================================================
   КОЛЬЦО МЕСТ
   ========================================================= */

test("ход идёт по кругу в обе стороны", () => {

  assert.equal(R.nextSeat(0, 4, 1), 1);
  assert.equal(R.nextSeat(3, 4, 1), 0);
  assert.equal(R.nextSeat(0, 4, -1), 3);
  assert.equal(R.nextSeat(2, 4, 1, 2), 0);
  assert.equal(R.nextSeat(1, 5, -1, 2), 4);
});


/* =========================================================
   НА ДВОИХ

   Пропуск и разворот оставляют ход тому же игроку —
   так игра ведёт себя сейчас, и это классическое правило.
   ========================================================= */

test("на двоих пропуск оставляет ход", () => {

  const result = after("skip", at(0, 2, 1));

  assert.equal(result.seat, 0);
  assert.equal(result.again, true);
  assert.equal(result.direction, 1);
});


test("на двоих разворот работает как пропуск", () => {

  const result = after("reverse", at(1, 2, 1));

  assert.equal(result.seat, 1);
  assert.equal(result.again, true);

  /* направление не трогаем: на кольце из двух оно ничего не значит */
  assert.equal(result.direction, 1);
});


test("на двоих обычная карта передаёт ход", () => {

  assert.equal(after("7", at(0, 2, 1)).seat, 1);
  assert.equal(after("7", at(1, 2, 1)).seat, 0);
});


/* =========================================================
   НА ТРОИХ И БОЛЬШЕ
   ========================================================= */

test("разворот меняет направление и передаёт ход назад", () => {

  const result = after("reverse", at(0, 4, 1));

  assert.equal(result.direction, -1);
  assert.equal(result.seat, 3);
  assert.equal(result.again, false);
});


test("два разворота подряд возвращают исходное направление", () => {

  const first = after("reverse", at(0, 5, 1));

  const second =
    after("reverse", at(first.seat, 5, first.direction));

  assert.equal(second.direction, 1);
  assert.equal(second.seat, 0);
});


test("пропуск перешагивает через соседа", () => {

  assert.equal(after("skip", at(0, 4, 1)).seat, 2);
  assert.equal(after("skip", at(0, 4, -1)).seat, 2);
  assert.equal(after("skip", at(1, 3, 1)).seat, 0);
});


test("штрафные карты просто передают ход соседу", () => {

  assert.equal(after("+2", at(0, 4, 1)).seat, 1);
  assert.equal(after("+4", at(2, 4, -1)).seat, 1);
});


/* =========================================================
   ЛИМИТ ПАРТИИ
   ========================================================= */

test("лимит растёт вместе со столом и не выходит за края", () => {

  for (
    let seats = R.MIN_SEATS;
    seats < R.MAX_SEATS;
    seats++
  ) {
    assert.ok(
      R.matchLimitFor(seats + 1) >=
      R.matchLimitFor(seats),
      `лимит на ${seats + 1} мест не должен быть меньше`
    );
  }

  /* всё, что вне 2..7, зажимается в границы */
  assert.equal(R.matchLimitFor(1), R.matchLimitFor(2));
  assert.equal(R.matchLimitFor(99), R.matchLimitFor(7));
  assert.equal(R.matchLimitFor(undefined), R.matchLimitFor(2));
});


/* =========================================================
   ЛИМИТ ОТ ЧИСЛА ЖИВЫХ ИГРОКОВ

   Лимит считается как «ходов до конца × средняя цена хода».
   Живое место обдумывает ход руками, бот разыгрывает его
   мгновенно, поэтому доля живых мест двигает вторую часть.
   ========================================================= */

test("базовый стол — двое, один живой", () => {

  assert.equal(
    R.matchLimitFor(2, 1),
    R.MATCH_LIMIT_SECONDS
  );
});


test("каждый живой игрок добавляет времени", () => {

  for (
    let seats = R.MIN_SEATS;
    seats <= R.MAX_SEATS;
    seats++
  ) {
    for (
      let humans = 1;
      humans < seats;
      humans++
    ) {
      assert.ok(
        R.matchLimitFor(seats, humans + 1) >
        R.matchLimitFor(seats, humans),
        `${seats} мест: ${humans + 1} живых должно быть дольше, чем ${humans}`
      );
    }
  }
});


test("живых не может быть больше, чем мест", () => {

  assert.equal(
    R.matchLimitFor(3, 99),
    R.matchLimitFor(3, 3)
  );

  assert.equal(
    R.matchLimitFor(4, 0),
    R.matchLimitFor(4, 1)
  );
});


test("полностью живой стол дороже полностью ботовского", () => {

  /* один живой среди шести ботов против семи живых */
  assert.ok(
    R.matchLimitFor(7, 7) >
    R.matchLimitFor(7, 1) * 1.5
  );
});


test("лимит кратен пяти секундам — на экране ровные значения", () => {

  for (let seats = 2; seats <= 7; seats++) {
    for (let humans = 1; humans <= seats; humans++) {
      assert.equal(
        R.matchLimitFor(seats, humans) % 5,
        0
      );
    }
  }
});
