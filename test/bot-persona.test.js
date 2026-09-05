"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const R = require("../src/rules.js");
const B = require("../src/bot.js");
const M = require("../src/match.js");


const hand = [
  { id: 1, color: "red", value: "9" },
  { id: 2, color: "wild", value: "+4" },
  { id: 3, color: "red", value: "+2" }
];


test("осторожный и рискованный бот по-разному ходят из одной законной руки", () => {

  const moves = [0, 1, 2];

  const cautious =
    B.chooseIndex(hand, moves, "cautious", () => 0);

  const risky =
    B.chooseIndex(hand, moves, "risky", () => 0);

  const view = {
    top: { id: 10, color: "red", value: "5" },
    currentColor: "red",
    drawPenalty: 0,
    penaltyType: null
  };

  assert.equal(cautious, 0, "осторожный сохраняет +4 и +2");
  assert.equal(risky, 1, "рискованный сразу давит +4");
  assert.equal(R.canPlay(hand[cautious], view), true);
  assert.equal(R.canPlay(hand[risky], view), true);
});


test("реакция осторожного бота бывает только на первый реальный +4", () => {

  const seen = new Set();

  const plusFour = {
    type: "played",
    seat: 0,
    card: { id: 44, color: "wild", value: "+4" }
  };

  assert.deepEqual(
    B.reactionFor(plusFour, 1, "cautious", () => 0, seen),
    { seat: 1, kind: "cautious-plus4", message: "НЕ РИСКУЙ." }
  );

  assert.equal(
    B.reactionFor(plusFour, 1, "cautious", () => 0, seen),
    null,
    "одна сыгранная карта не вызывает вторую реплику"
  );

  assert.equal(
    B.reactionFor(
      { type: "played", seat: 0, card: { id: 45, color: "red", value: "9" } },
      1,
      "cautious",
      () => 0,
      new Set()
    ),
    null,
    "обычная карта не притворяется поводом для реакции"
  );
});


test("решение бота использует назначенный профиль, а не номер места", () => {

  const base = M.create({ seats: 2, seed: 5 });

  const state = {
    ...base,
    activeSeat: 0,
    discard: [{ id: 10, color: "red", value: "5" }],
    currentColor: "red",
    seats: base.seats.map((seat, index) => ({
      ...seat,
      hand: index === 0 ? hand.slice() : seat.hand.slice()
    }))
  };

  assert.equal(
    B.decide(state, 0, () => 0, "cautious").cardId,
    1
  );

  assert.equal(
    B.decide(state, 0, () => 0, "risky").cardId,
    2
  );
});
