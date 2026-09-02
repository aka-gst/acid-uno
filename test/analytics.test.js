"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const Analytics = require("../src/analytics.js");


function storage(initial = {}) {

  const values = new Map(Object.entries(initial));

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },

    setItem(key, value) {
      values.set(key, String(value));
    }
  };
}


function meter() {

  const events = [];

  return {
    events,

    track(name, data) {
      events.push({ name, data });
    }
  };
}


test("старт из лобби записывает только обезличенную попытку", () => {

  const umami = meter();

  const analytics = Analytics.create({
    hostname: "aka-gst.ru",
    storage: storage(),
    meter: () => umami
  });

  analytics.partyStarted("lobby");

  assert.deepEqual(umami.events, [{
    name: "acid-uno-party-start",
    data: {
      source: "lobby",
      attempt: 1
    }
  }]);
});


test("следующая партия отмечена replay и увеличивает номер попытки", () => {

  const saved = storage();
  const firstMeter = meter();

  const first = Analytics.create({
    hostname: "aka-gst.ru",
    storage: saved,
    meter: () => firstMeter
  });

  first.partyStarted("lobby");
  first.partyStarted("replay");

  assert.deepEqual(firstMeter.events, [{
    name: "acid-uno-party-start",
    data: { source: "lobby", attempt: 1 }
  }, {
    name: "acid-uno-party-start",
    data: { source: "replay", attempt: 2 }
  }]);

});


test("локальный прогон не может назвать событие боевым", () => {

  const umami = meter();

  const analytics = Analytics.create({
    hostname: "127.0.0.1",
    storage: storage(),
    meter: () => umami
  });

  analytics.partyStarted("lobby");

  assert.equal(
    umami.events[0].name,
    "test-acid-uno-party-start"
  );
});


test("счётчик может отсутствовать и не ломает старт", () => {

  const analytics = Analytics.create({
    hostname: "aka-gst.ru",
    storage: storage(),
    meter: () => null
  });

  assert.doesNotThrow(() => {
    analytics.partyStarted("lobby");
  });
});
