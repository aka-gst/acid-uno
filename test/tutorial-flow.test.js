"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const Tour = require("../src/tutorial-flow.js");


function play(flow, cardId) {

  return Tour.act(flow, {
    type: "play",
    seat: 0,
    cardId
  });
}


test("тур: ход по цвету действительно убирает карту", () => {

  const flow = Tour.create();

  const wrong =
    play(flow, 2);

  assert.equal(wrong.error, "СЕЙЧАС НУЖНА КРАСНАЯ 3");
  assert.equal(wrong.flow.step, "match-color");
  assert.equal(wrong.flow.state, flow.state);

  const result =
    play(flow, 1);

  assert.equal(result.error, undefined);
  assert.equal(result.flow.step, "stack-penalty");
  assert.equal(result.flow.state.seats[0].hand.length, 3);
  assert.equal(
    result.flow.state.discard.at(-1).id,
    5
  );
  assert.equal(result.flow.state.drawPenalty, 2);
});


test("тур: ответ своей +2 реально увеличивает кластер", () => {

  let flow = Tour.create();

  flow = play(flow, 1).flow;

  const result =
    play(flow, 2);

  assert.equal(result.error, undefined);
  assert.equal(result.flow.step, "call-uno");
  assert.equal(result.flow.state.drawPenalty, 0);
  assert.equal(result.flow.state.seats[0].hand.length, 2);
  assert.equal(result.flow.state.activeSeat, 0);

  assert.equal(
    result.events.filter(
      event => event.type === "penalty"
    )[0].cards.length,
    4
  );
});


test("тур: UNO засчитывается при двух картах, а следующая карта оставляет одну", () => {

  let flow = Tour.create();

  flow = play(flow, 1).flow;
  flow = play(flow, 2).flow;

  const called = Tour.act(flow, {
    type: "uno",
    seat: 0
  });

  assert.equal(called.error, undefined);
  assert.equal(called.flow.step, "play-to-one");
  assert.equal(called.flow.state.seats[0].unoCalled, true);

  const oneLeft =
    play(called.flow, 3);

  assert.equal(oneLeft.error, undefined);
  assert.equal(oneLeft.flow.step, "finish");
  assert.equal(oneLeft.flow.state.seats[0].hand.length, 1);
  assert.equal(oneLeft.flow.state.seats[0].unoCalled, true);
});


test("тур: последняя карта заканчивает настоящую партию", () => {

  let flow = Tour.create();

  flow = play(flow, 1).flow;
  flow = play(flow, 2).flow;
  flow = Tour.act(flow, { type: "uno", seat: 0 }).flow;
  flow = play(flow, 3).flow;

  const result =
    play(flow, 4);

  assert.equal(result.error, undefined);
  assert.equal(result.flow.step, "done");
  assert.equal(result.flow.state.over, true);
  assert.equal(result.flow.state.winner, 0);
});


test("тур можно открыть повторно: он начинает чистую детерминированную партию", () => {

  let flow = Tour.create();

  flow = play(flow, 1).flow;
  flow = play(flow, 2).flow;
  flow = Tour.act(flow, { type: "uno", seat: 0 }).flow;
  flow = play(flow, 3).flow;
  flow = play(flow, 4).flow;

  const again = Tour.create();

  assert.equal(flow.step, "done");
  assert.equal(again.step, "match-color");
  assert.equal(again.state.over, false);
  assert.equal(again.state.seats[0].hand.length, 4);
  assert.equal(again.state.discard.at(-1).id, 100);
});
