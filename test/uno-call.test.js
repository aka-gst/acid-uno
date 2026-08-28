"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const M = require("../src/match.js");


/* Ставим руку места 0 в нужное состояние, минуя раздачу. */
function withHand(state, cards) {

  return {
    ...state,

    activeSeat: 0,
    direction: 1,

    discard: [{ id: 500, color: "red", value: "7" }],
    currentColor: "red",

    deck: state.deck.slice(),

    seats: state.seats.map(
      (seat, index) => ({
        ...seat,

        hand:
          index === 0
            ? cards.slice()
            : seat.hand.slice()
      })
    )
  };
}


const RED = (value, id) => ({
  id,
  color: "red",
  value
});


/* =========================================================
   РЕГРЕССИЯ

   «Второй раз, когда у меня две карты, кнопка UNO не
   появилась, и бот меня на этом не поймал.»

   Объявление жило отдельным флагом интерфейса и после
   удачного «UNO!» оставалось поднятым до конца партии.
   Теперь оно живёт в состоянии партии, и любой рост руки
   его снимает.
   ========================================================= */

test("объявление UNO снимается, когда рука снова выросла", () => {

  let state =
    withHand(
      M.create({ seats: 2, seed: 1 }),

      /* пропуск оставляет ход себе — удобно для сценария */
      [RED("skip", 1), RED("3", 2)]
    );


  /* первый заход: две карты, объявляем */
  assert.equal(
    M.apply(state, { type: "uno", seat: 0 }).error,
    undefined
  );

  state = M.apply(state, { type: "uno", seat: 0 }).state;

  assert.equal(state.seats[0].unoCalled, true);


  /* выкладываем — осталась одна, объявление засчитано */
  state = M.apply(state, {
    type: "play",
    seat: 0,
    cardId: 1
  }).state;

  assert.equal(state.seats[0].hand.length, 1);
  assert.equal(state.seats[0].unoVulnerable, false);


  /* берём карту: рука выросла до двух */
  state = M.apply(state, { type: "draw", seat: 0 }).state;

  assert.equal(state.seats[0].hand.length, 2);

  assert.equal(
    state.seats[0].unoCalled,
    false,
    "рост руки обязан снять прошлое объявление"
  );


  /* второй заход: объявить можно снова */
  assert.equal(
    M.apply(state, { type: "uno", seat: 0 }).error,
    undefined,
    "UNO должно объявляться во второй раз"
  );


  /* а если промолчать — ловят */
  const played =
    M.apply(state, {
      type: "play",
      seat: 0,
      cardId: state.seats[0].hand[0].id
    }).state;

  assert.equal(played.seats[0].hand.length, 1);
  assert.equal(played.seats[0].unoVulnerable, true);

  const caught =
    M.apply(played, {
      type: "catch",
      seat: 1,
      target: 0
    });

  assert.equal(caught.error, undefined);
  assert.equal(caught.state.seats[0].hand.length, 3);
});


test("рост руки после промаха тоже снимает уязвимость", () => {

  let state =
    withHand(
      M.create({ seats: 2, seed: 2 }),
      [RED("skip", 1), RED("3", 2)]
    );

  state = M.apply(state, {
    type: "play",
    seat: 0,
    cardId: 1
  }).state;

  assert.equal(state.seats[0].unoVulnerable, true);

  /* поймали и выдали +2 */
  state = M.apply(state, {
    type: "catch",
    seat: 1,
    target: 0
  }).state;

  assert.equal(state.seats[0].unoVulnerable, false);

  assert.match(
    M.apply(state, { type: "catch", seat: 1, target: 0 }).error,
    /ловить некого/,
    "дважды за одно молчание не ловят"
  );
});


test("добор снимает объявление, даже если рука не менялась иначе", () => {

  let state =
    withHand(
      M.create({ seats: 2, seed: 3 }),
      [RED("skip", 1), RED("3", 2)]
    );

  state = M.apply(state, { type: "uno", seat: 0 }).state;

  assert.equal(state.seats[0].unoCalled, true);

  state = M.apply(state, { type: "draw", seat: 0 }).state;

  assert.equal(
    state.seats[0].unoCalled,
    false,
    "взял карту — объявление больше не действует"
  );

  assert.equal(state.seats[0].hand.length, 3);
});
