"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const R = require("../src/rules.js");


const PLAYER_TURN = handSize => ({
  active: true,
  handSize
});


/* =========================================================
   РЕГРЕССИЯ

   «Второй раз, когда у меня две карты, кнопка UNO не
   появилась, и бот меня на этом не поймал.»

   Причина: после удачного объявления рука уменьшалась
   до одной карты, обработчик выходил по раннему return,
   и called оставался поднятым до конца партии.
   ========================================================= */

test("объявление UNO снимается, когда рука снова выросла", () => {

  const uno = new R.UnoCall();

  // Первый заход: две карты, кнопка на месте.
  assert.equal(
    uno.shouldShowButton(PLAYER_TURN(2)),
    true
  );

  assert.equal(uno.call(PLAYER_TURN(2)), true);

  assert.equal(
    uno.shouldShowButton(PLAYER_TURN(2)),
    false,
    "после нажатия кнопка прячется"
  );

  // Выложили карту — осталась одна, объявление засчитано.
  assert.equal(uno.afterPlay(1), "safe");
  assert.equal(uno.vulnerable, false);

  // Взяли карту: рука выросла до двух.
  assert.equal(
    uno.handGrew(2),
    true,
    "рост руки обнуляет прошлое объявление"
  );

  // Второй заход: кнопка обязана вернуться.
  assert.equal(
    uno.shouldShowButton(PLAYER_TURN(2)),
    true,
    "кнопка UNO должна появиться во второй раз"
  );

  // И если промолчать — бот обязан поймать.
  assert.equal(uno.afterPlay(1), "exposed");
  assert.equal(uno.catchable(1), true);
});


test("рост руки после промаха тоже снимает уязвимость", () => {

  const uno = new R.UnoCall();

  assert.equal(uno.afterPlay(1), "exposed");
  assert.equal(uno.catchable(1), true);

  // Поймали и выдали +2 — рука выросла.
  assert.equal(uno.handGrew(3), true);
  assert.equal(uno.catchable(1), false);
  assert.equal(uno.vulnerable, false);
});


test("handGrew не трогает чистое состояние", () => {

  const uno = new R.UnoCall();

  assert.equal(uno.handGrew(7), false);
  assert.equal(uno.called, false);
  assert.equal(uno.vulnerable, false);
});


test("UNO нельзя объявить не в свой ход и не на двух картах", () => {

  const uno = new R.UnoCall();

  assert.equal(
    uno.call({ active: false, handSize: 2 }),
    false
  );

  assert.equal(uno.call(PLAYER_TURN(3)), false);
  assert.equal(uno.call(PLAYER_TURN(1)), false);
  assert.equal(uno.called, false);
});


test("кнопка не показывается вне хода игрока", () => {

  const uno = new R.UnoCall();

  assert.equal(
    uno.shouldShowButton({ active: false, handSize: 2 }),
    false
  );
});


test("выкладка не до одной карты полностью очищает состояние", () => {

  const uno = new R.UnoCall();

  uno.call(PLAYER_TURN(2));

  assert.equal(uno.afterPlay(4), "clear");
  assert.equal(uno.called, false);
  assert.equal(uno.vulnerable, false);
});
