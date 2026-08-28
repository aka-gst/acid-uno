"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const R = require("../src/rules.js");
const M = require("../src/match.js");


/* Кладём место в известное состояние, минуя раздачу. */
function stage(state, patch) {

  const next = {
    ...state,
    seats: state.seats.map(s => ({ ...s, hand: s.hand.slice() })),
    deck: state.deck.slice(),
    discard: state.discard.slice()
  };

  Object.assign(next, patch);

  return next;
}


const card = (color, value, id) => ({
  id: id ?? 900 + Math.abs(
    (color + value).split("").reduce((a, c) => a + c.charCodeAt(0), 0)
  ),
  color,
  value
});


function table(seats, top, hands) {

  const state = M.create({ seats, seed: 7 });

  return stage(state, {
    discard: [top],
    currentColor: top.color === "wild" ? "red" : top.color,
    activeSeat: 0,
    direction: 1,

    seats: state.seats.map((seat, i) => ({
      ...seat,
      hand: (hands[i] || []).slice()
    }))
  });
}


/* =========================================================
   РАЗДАЧА
   ========================================================= */

test("раздача: по семь карт каждому и обычная карта на столе", () => {

  for (let seats = 2; seats <= 7; seats++) {

    const state = M.create({ seats, seed: seats });

    assert.equal(state.seats.length, seats);

    state.seats.forEach(seat =>
      assert.equal(seat.hand.length, 7)
    );

    const top = state.discard[0];

    assert.notEqual(top.color, "wild");
    assert.ok(!R.ACTION_VALUES.includes(top.value));

    assert.equal(
      state.deck.length + seats * 7 + 1,
      108
    );
  }
});


test("одинаковый seed даёт одинаковую партию", () => {

  const a = M.create({ seats: 5, seed: 12345 });
  const b = M.create({ seats: 5, seed: 12345 });
  const c = M.create({ seats: 5, seed: 12346 });

  const ids = s =>
    s.seats.map(x => x.hand.map(y => y.id).join(",")).join("|");

  assert.equal(ids(a), ids(b));
  assert.notEqual(ids(a), ids(c));
});


test("место 0 живое, лишние живые зажимаются числом мест", () => {

  assert.equal(
    M.create({ seats: 4, humans: 9 })
      .seats.filter(s => s.kind === "human").length,
    4
  );

  assert.equal(
    M.create({ seats: 4 })
      .seats.filter(s => s.kind === "human").length,
    1
  );
});


/* =========================================================
   ХОД
   ========================================================= */

test("нельзя ходить не своей картой и не в свой ход", () => {

  const state =
    table(3, card("red", "5"), [
      [card("red", "3", 1)],
      [card("red", "4", 2)],
      []
    ]);

  assert.match(
    M.apply(state, { type: "play", seat: 0, cardId: 999 }).error,
    /карты нет/
  );

  assert.match(
    M.apply(state, { type: "play", seat: 1, cardId: 2 }).error,
    /не твой ход/
  );
});


test("ход уходит соседу, а пропуск перешагивает через него", () => {

  const state =
    table(4, card("red", "5"), [
      [card("red", "3", 1), card("red", "skip", 2)],
      [], [], []
    ]);

  assert.equal(
    M.apply(state, { type: "play", seat: 0, cardId: 1 })
      .state.activeSeat,
    1
  );

  assert.equal(
    M.apply(state, { type: "play", seat: 0, cardId: 2 })
      .state.activeSeat,
    2
  );
});


test("разворот на четверых меняет направление", () => {

  const state =
    table(4, card("red", "5"), [
      [card("red", "reverse", 1), card("red", "9", 2)],
      [], [], []
    ]);

  const after =
    M.apply(state, { type: "play", seat: 0, cardId: 1 }).state;

  assert.equal(after.direction, -1);
  assert.equal(after.activeSeat, 3);
});


test("Wild ставит выбранный цвет", () => {

  const state =
    table(3, card("red", "5"), [
      [card("wild", "wild", 1), card("blue", "2", 2)],
      [], []
    ]);

  const after =
    M.apply(state, {
      type: "play",
      seat: 0,
      cardId: 1,
      color: "green"
    }).state;

  assert.equal(after.currentColor, "green");
});


/* =========================================================
   КЛАСТЕР
   ========================================================= */

test("кластер копится и заставляет крыть только +4 после +4", () => {

  let state =
    table(3, card("red", "5"), [
      [card("red", "+2", 1), card("red", "0", 9)],
      [card("wild", "+4", 2), card("blue", "+2", 3)],
      [card("green", "9", 4)]
    ]);

  state = M.apply(state, { type: "play", seat: 0, cardId: 1 }).state;

  assert.equal(state.drawPenalty, 2);
  assert.equal(state.penaltyType, "+2");

  /* место 1 кроет +4 */
  state = M.apply(state, {
    type: "play", seat: 1, cardId: 2, color: "green"
  }).state;

  assert.equal(state.drawPenalty, 6);
  assert.equal(state.penaltyType, "+4");
  assert.equal(state.activeSeat, 2);

  /* дальше только +4 — девяткой не отбиться */
  assert.match(
    M.apply(state, { type: "play", seat: 2, cardId: 4 }).error,
    /так ходить нельзя/
  );
});


test("штраф забирается целиком и заканчивает ход", () => {

  let state =
    table(3, card("red", "+2"), [
      [], [card("green", "9", 4)], []
    ]);

  state = stage(state, {
    activeSeat: 1,
    drawPenalty: 6,
    penaltyType: "+4"
  });

  const before = state.deck.length;

  const result =
    M.apply(state, { type: "draw", seat: 1 });

  assert.equal(result.state.seats[1].hand.length, 7);
  assert.equal(result.state.deck.length, before - 6);
  assert.equal(result.state.drawPenalty, 0);
  assert.equal(result.state.penaltyType, null);
  assert.equal(result.state.activeSeat, 2);

  assert.equal(
    result.events.find(e => e.type === "penalty").cards.length,
    6
  );
});


test("добровольный добор — одна карта, ход остаётся", () => {

  const state =
    table(3, card("red", "5"), [
      [card("blue", "9", 1)], [], []
    ]);

  const result =
    M.apply(state, { type: "draw", seat: 0 });

  assert.equal(result.state.seats[0].hand.length, 2);
  assert.equal(result.state.activeSeat, 0);
});


/* =========================================================
   ПЕРЕХВАТ
   ========================================================= */

test("перехват точным совпадением забирает ход", () => {

  const state =
    table(4, card("green", "7"), [
      [], [], [card("green", "7", 5), card("red", "1", 6)], []
    ]);

  const result =
    M.apply(state, { type: "play", seat: 2, cardId: 5 });

  assert.equal(result.error, undefined);
  assert.equal(result.state.activeSeat, 3);

  assert.equal(
    result.events.find(e => e.type === "played").intercept,
    true
  );
});


test("перехватить можно только точным совпадением", () => {

  const state =
    table(4, card("green", "7"), [
      [], [], [card("green", "8", 7)], []
    ]);

  assert.match(
    M.apply(state, { type: "play", seat: 2, cardId: 7 }).error,
    /не твой ход/
  );
});


test("во время штрафа перехвата нет", () => {

  const state = stage(
    table(4, card("green", "+2"), [
      [], [], [card("green", "+2", 8)], []
    ]),
    { drawPenalty: 2, penaltyType: "+2", activeSeat: 0 }
  );

  assert.match(
    M.apply(state, { type: "play", seat: 2, cardId: 8 }).error,
    /перехвата нет/
  );
});


/* =========================================================
   UNO
   ========================================================= */

test("объявление на двух картах спасает от поимки", () => {

  let state =
    table(3, card("red", "5"), [
      [card("red", "3", 1), card("red", "4", 2)],
      [], []
    ]);

  state = M.apply(state, { type: "uno", seat: 0 }).state;

  assert.equal(state.seats[0].unoCalled, true);

  state = M.apply(state, { type: "play", seat: 0, cardId: 1 }).state;

  assert.equal(state.seats[0].hand.length, 1);
  assert.equal(state.seats[0].unoVulnerable, false);

  assert.match(
    M.apply(state, { type: "catch", seat: 1, target: 0 }).error,
    /ловить некого/
  );
});


test("промолчал — ловят и дают +2", () => {

  let state =
    table(3, card("red", "5"), [
      [card("red", "3", 1), card("red", "4", 2)],
      [], []
    ]);

  state = M.apply(state, { type: "play", seat: 0, cardId: 1 }).state;

  assert.equal(state.seats[0].unoVulnerable, true);

  const result =
    M.apply(state, { type: "catch", seat: 1, target: 0 });

  assert.equal(result.state.seats[0].hand.length, 3);
  assert.equal(result.state.seats[0].unoVulnerable, false);
});


test("рост руки снимает прошлое объявление", () => {

  let state =
    table(3, card("red", "5"), [
      [card("red", "3", 1), card("red", "4", 2)],
      [], []
    ]);

  state = M.apply(state, { type: "uno", seat: 0 }).state;
  state = M.apply(state, { type: "play", seat: 0, cardId: 1 }).state;

  /* вернулись к месту 0 и добрали */
  state = stage(state, { activeSeat: 0 });
  state = M.apply(state, { type: "draw", seat: 0 }).state;

  assert.equal(state.seats[0].unoCalled, false);
  assert.equal(state.seats[0].unoVulnerable, false);
});


test("UNO объявляют только на двух картах и в свой ход", () => {

  const state =
    table(3, card("red", "5"), [
      [card("red", "3", 1), card("red", "4", 2), card("red", "6", 3)],
      [card("red", "7", 4), card("red", "8", 5)],
      []
    ]);

  assert.match(
    M.apply(state, { type: "uno", seat: 0 }).error,
    /на двух картах/
  );

  assert.match(
    M.apply(state, { type: "uno", seat: 1 }).error,
    /не твой ход/
  );
});


/* =========================================================
   КОНЕЦ ПАРТИИ
   ========================================================= */

test("последняя карта заканчивает партию", () => {

  const state =
    table(3, card("red", "5"), [
      [card("red", "3", 1)], [], []
    ]);

  const result =
    M.apply(state, { type: "play", seat: 0, cardId: 1 });

  assert.equal(result.state.over, true);
  assert.equal(result.state.winner, 0);

  assert.equal(
    result.events.find(e => e.type === "over").winner,
    0
  );

  /* после конца ходить нельзя */
  assert.match(
    M.apply(result.state, { type: "draw", seat: 1 }).error,
    /партия закончена/
  );
});


test("по гонгу выигрывает меньшая сумма", () => {

  const state =
    table(3, card("red", "5"), [
      [card("wild", "+4", 1)],
      [card("red", "3", 2)],
      [card("red", "9", 3)]
    ]);

  const result = M.apply(state, { type: "timeout" });

  assert.equal(result.state.over, true);
  assert.equal(result.state.winner, 1);
  assert.deepEqual(result.state.points, [40, 3, 9]);
});


test("висящий кластер сначала уходит тому, кто обязан его забрать", () => {

  const state = stage(
    table(3, card("red", "+2"), [
      [card("red", "1", 1)],
      [card("red", "2", 2)],
      [card("red", "3", 3)]
    ]),
    { activeSeat: 1, drawPenalty: 4, penaltyType: "+2" }
  );

  const result = M.apply(state, { type: "timeout" });

  assert.equal(result.state.seats[1].hand.length, 5);

  /*
    Без гашения выиграло бы место 1 с двумя очками —
    именно этим и был бы бесплатный +4 на последней секунде.
  */
  assert.notEqual(result.state.winner, 1);
});


/* =========================================================
   ЧТО ВИДИТ ИГРОК
   ========================================================= */

test("чужие руки наружу не уходят", () => {

  const state = M.create({ seats: 4, seed: 3 });

  const seen = M.view(state, 2);

  seen.seats.forEach(seat => {

    if (seat.index === 2) {
      assert.equal(seat.hand.length, 7);

    } else {
      assert.equal(seat.hand, null);
      assert.equal(seat.count, 7);
    }
  });

  assert.equal(
    JSON.stringify(seen).includes('"deck"'),
    false
  );
});


/* =========================================================
   ЦЕЛОСТНОСТЬ
   ========================================================= */

test("карты не появляются и не исчезают за всю партию", () => {

  const SIM = require("./simulate.js");

  for (const seed of [1, 2, 3, 17, 99]) {

    let state = M.create({ seats: 5, seed });

    let guard = 0;

    const roll = () => 0.5;

    while (!state.over && guard < 6000) {
      guard++;

      const result =
        M.apply(
          state,
          SIM.decide(state, state.activeSeat, roll)
        );

      if (result.error) {
        break;
      }

      state = result.state;

      const total =
        state.deck.length +
        state.discard.length +
        state.seats.reduce((n, s) => n + s.hand.length, 0);

      assert.equal(
        total,
        108,
        `seed ${seed}: карт стало ${total}`
      );
    }

    assert.equal(state.over, true, `seed ${seed}: партия не кончилась`);
  }
});
