"use strict";

/* =========================================================
   ACID UNO — КОМНАТЫ
   ---------------------------------------------------------
   Комната держит стол и одну партию. Правду считает
   src/match.js — тот же модуль, что и у клиента, поэтому
   расхождению взяться неоткуда. Боты ходят политикой из
   src/bot.js — той же, что в одиночной игре.

   Клиенту уходит только его собственный взгляд на стол:
   чужие руки не покидают сервер.
   ========================================================= */

const crypto = require("node:crypto");

const M = require("../src/match.js");
const R = require("../src/rules.js");
const B = require("../src/bot.js");


/* Комнату называем так, чтобы её можно было продиктовать. */
const ROOM_ALPHABET = "ACDEFGHJKLMNPQRTUVWXY34789";

const ROOM_ID_LENGTH = 4;

/* Пустая комната живёт пять минут, потом убирается. */
const ROOM_TTL_MS = 5 * 60 * 1000;


const BOT_FACES = [
  "БОТ 1", "БОТ 2", "БОТ 3",
  "БОТ 4", "БОТ 5", "БОТ 6"
];


const rooms = new Map();


function roomId() {

  let id;

  do {
    id =
      Array.from(
        { length: ROOM_ID_LENGTH },
        () =>
          ROOM_ALPHABET[
            crypto.randomInt(ROOM_ALPHABET.length)
          ]
      ).join("");

  } while (rooms.has(id));

  return id;
}


function token() {
  return crypto.randomBytes(18).toString("hex");
}


/* =========================================================
   СТОЛ

   seats[i] — либо null, либо место:
     { kind: "human", token, name, streams }
     { kind: "bot",   name }
   ========================================================= */

function create(options) {

  const settings = options || {};

  const size =
    Math.min(
      R.MAX_SEATS,
      Math.max(
        R.MIN_SEATS,
        Number(settings.seats) || R.MIN_SEATS
      )
    );

  const id = roomId();

  const room = {
    id,
    size,

    seats: new Array(size).fill(null),

    state: null,

    clockOff: Boolean(settings.clockOff),

    startedAt: null,

    touchedAt: Date.now(),

    /* таймеры ходов ботов, чтобы гасить их при перезапуске */
    botTimer: null,
    unoTimer: null
  };

  rooms.set(id, room);

  return room;
}


function get(id) {
  return rooms.get(String(id || "").toUpperCase()) || null;
}


function seatByToken(room, key) {

  if (!key) {
    return -1;
  }

  return room.seats.findIndex(
    seat =>
      seat &&
      seat.kind === "human" &&
      seat.token === key
  );
}


function freeSeat(room) {
  return room.seats.findIndex(seat => !seat);
}


function occupied(room) {
  return room.seats.filter(Boolean).length;
}


function join(room, name) {

  if (room.state) {
    return { error: "партия уже идёт" };
  }

  const seat = freeSeat(room);

  if (seat === -1) {
    return { error: "комната заполнена" };
  }

  const key = token();

  room.seats[seat] = {
    kind: "human",
    token: key,

    name:
      String(name || "").slice(0, 24) ||
      `ИГРОК ${seat + 1}`,

    streams: new Set()
  };

  room.touchedAt = Date.now();

  return { token: key, seat };
}


/* =========================================================
   ЛОББИ
   ========================================================= */

function lobbyPayload(room) {

  return {
    room: room.id,
    size: room.size,

    seats:
      room.seats.map((seat, index) => ({
        seat: index,

        kind: seat?.kind || null,

        name: seat?.name || null,

        online:
          seat?.kind === "bot" ||
          Boolean(seat?.streams?.size)
      })),

    taken: occupied(room),

    started: Boolean(room.state),

    /* начать раньше можно, когда есть с кем играть */
    canStart:
      !room.state &&
      occupied(room) >= R.MIN_SEATS,

    canAddBot:
      !room.state &&
      freeSeat(room) !== -1,

    canRemoveBot:
      !room.state &&
      room.seats.some(s => s?.kind === "bot"),

    limit:
      room.clockOff
        ? null
        : R.matchLimitFor(
            room.size,
            room.seats.filter(
              s => s?.kind === "human"
            ).length || 1
          ),

    /*
      Часы идут на сервере: клиенту нужно только знать,
      сколько уже прошло, чтобы нарисовать то же число.
    */
    elapsed:
      room.startedAt
        ? (Date.now() - room.startedAt) / 1000
        : 0
  };
}


function send(stream, event, payload) {

  try {
    stream.write(
      `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`
    );

  } catch (error) {
    /* оборванное соединение уберётся по close */
  }
}


function eachStream(room, action) {

  room.seats.forEach(seat => {

    if (seat?.kind !== "human") {
      return;
    }

    seat.streams.forEach(
      stream => action(stream, seat)
    );
  });
}


function broadcastLobby(room) {

  const payload = lobbyPayload(room);

  eachStream(room, stream =>
    send(stream, "lobby", payload)
  );
}


function broadcastState(room, events) {

  if (!room.state) {
    return;
  }

  eachStream(room, (stream, seat) =>
    send(stream, "state", {
      state:
        M.view(
          room.state,
          room.seats.indexOf(seat)
        ),

      events
    })
  );
}


/* =========================================================
   БОТЫ
   ========================================================= */

function addBot(room) {

  if (room.state) {
    return { error: "партия уже идёт" };
  }

  const seat = freeSeat(room);

  if (seat === -1) {
    return { error: "свободных мест нет" };
  }

  const used =
    room.seats.filter(s => s?.kind === "bot").length;

  room.seats[seat] = {
    kind: "bot",

    name:
      BOT_FACES[used % BOT_FACES.length]
  };

  room.touchedAt = Date.now();

  broadcastLobby(room);

  if (occupied(room) === room.size) {
    start(room);
  }

  return { ok: true };
}


function removeBot(room) {

  if (room.state) {
    return { error: "партия уже идёт" };
  }

  for (
    let i = room.seats.length - 1;
    i >= 0;
    i--
  ) {

    if (room.seats[i]?.kind === "bot") {

      room.seats[i] = null;

      room.touchedAt = Date.now();

      broadcastLobby(room);

      return { ok: true };
    }
  }

  return { error: "ботов за столом нет" };
}


function clearBotTimers(room) {

  clearTimeout(room.botTimer);
  clearTimeout(room.unoTimer);

  room.botTimer = null;
  room.unoTimer = null;
}


/*
  Ход бота. Сервер ждёт немного, чтобы за столом было видно,
  кто сейчас думает, и чтобы человек успевал ловить UNO.
*/
function scheduleBot(room) {

  clearTimeout(room.botTimer);

  if (
    !room.state ||
    room.state.over
  ) {
    return;
  }

  const seat =
    room.seats[room.state.activeSeat];

  if (seat?.kind !== "bot") {
    return;
  }

  room.botTimer =
    setTimeout(
      () => {

        if (
          !room.state ||
          room.state.over
        ) {
          return;
        }

        const action =
          B.decide(
            room.state,
            room.state.activeSeat
          );

        const result =
          M.apply(room.state, action);

        if (result.error) {
          return;
        }

        room.state = result.state;

        broadcastState(room, result.events);

        scheduleBotUno(room, result.events);

        scheduleBot(room);
      },
      B.turnDelay()
    );
}


/*
  Бот объявляет UNO не мгновенно: у соседей есть окно,
  чтобы поймать его на молчании.
*/
function scheduleBotUno(room, events) {

  const exposed =
    events.find(
      event => event.type === "exposed"
    );

  if (!exposed) {
    return;
  }

  if (
    room.seats[exposed.seat]?.kind !== "bot"
  ) {
    return;
  }

  clearTimeout(room.unoTimer);

  room.unoTimer =
    setTimeout(
      () => {

        if (!room.state) {
          return;
        }

        const result =
          M.apply(room.state, {
            type: "closeUno",
            target: exposed.seat
          });

        if (result.error) {
          return;
        }

        room.state = result.state;

        broadcastState(room, result.events);
      },
      B.unoDelay()
    );
}


/* =========================================================
   СТАРТ
   ========================================================= */

function start(room) {

  if (room.state) {
    return { error: "партия уже идёт" };
  }

  const players =
    room.seats.filter(Boolean);

  if (players.length < R.MIN_SEATS) {
    return { error: "нужно хотя бы двое" };
  }


  /*
    Начали раньше — пустые места просто убираем, стол
    сжимается до тех, кто пришёл.
  */
  room.seats = players;

  room.size = players.length;

  clearBotTimers(room);

  room.state =
    M.create({
      seats: room.size,

      kinds:
        room.seats.map(seat => seat.kind),

      seed: crypto.randomInt(0xFFFFFFFF)
    });

  room.startedAt = Date.now();

  room.touchedAt = Date.now();

  broadcastLobby(room);

  broadcastState(room, [{ type: "dealt" }]);

  scheduleBot(room);

  return { ok: true };
}


/* =========================================================
   ПОТОК
   ========================================================= */

function attach(room, key, stream) {

  const index = seatByToken(room, key);

  if (index === -1) {
    return false;
  }

  const seat = room.seats[index];

  seat.streams.add(stream);

  room.touchedAt = Date.now();

  send(stream, "lobby", lobbyPayload(room));

  if (room.state) {

    send(stream, "state", {
      state: M.view(room.state, index),
      events: []
    });
  }

  broadcastLobby(room);

  if (
    !room.state &&
    occupied(room) === room.size
  ) {
    start(room);
  }

  return true;
}


function detach(room, key, stream) {

  const index = seatByToken(room, key);

  if (index === -1) {
    return;
  }

  room.seats[index].streams.delete(stream);

  broadcastLobby(room);
}


/* =========================================================
   ДЕЙСТВИЕ

   Место берётся из токена, а не из тела запроса: клиент не
   должен уметь ходить за соседа.
   ========================================================= */

function act(room, key, action) {

  const index = seatByToken(room, key);

  if (index === -1) {
    return { error: "не за этим столом" };
  }

  if (!room.state) {
    return { error: "партия ещё не началась" };
  }

  if (
    !action ||
    typeof action.type !== "string"
  ) {
    return { error: "неизвестное действие" };
  }


  if (action.type === "restart") {

    clearBotTimers(room);

    room.state = null;

    return start(room);
  }


  const safe = {
    ...action,
    seat: index
  };

  if (
    action.type === "catch" ||
    action.type === "closeUno"
  ) {
    safe.target = Number(action.target);
  }


  const result =
    M.apply(room.state, safe);

  if (result.error) {
    return { error: result.error };
  }

  room.state = result.state;

  room.touchedAt = Date.now();

  broadcastState(room, result.events);

  scheduleBotUno(room, result.events);

  scheduleBot(room);

  return { ok: true };
}


/* =========================================================
   ЛОББИ-КОМАНДЫ
   ========================================================= */

function lobbyAction(room, key, what) {

  if (seatByToken(room, key) === -1) {
    return { error: "не за этим столом" };
  }

  if (what === "addBot") {
    return addBot(room);
  }

  if (what === "removeBot") {
    return removeBot(room);
  }

  if (what === "start") {
    return start(room);
  }

  return { error: "неизвестная команда" };
}


/* =========================================================
   ЧАСЫ И УБОРКА
   ========================================================= */

function tick() {

  const now = Date.now();

  rooms.forEach((room, id) => {

    if (
      room.state &&
      !room.state.over &&
      !room.clockOff
    ) {

      const limit =
        R.matchLimitFor(
          room.size,
          room.seats.filter(
            s => s?.kind === "human"
          ).length || 1
        );

      const left =
        limit * 1000 - (now - room.startedAt);

      if (left <= 0) {

        clearBotTimers(room);

        const result =
          M.apply(room.state, { type: "timeout" });

        room.state = result.state;

        broadcastState(room, result.events);

      } else if (
        left <= R.MATCH_WARN_SECONDS * 1000
      ) {

        /* последняя минута — обновляем таймер у всех */
        broadcastLobby(room);
      }
    }


    const empty =
      room.seats.every(
        seat =>
          !seat ||
          seat.kind === "bot" ||
          seat.streams.size === 0
      );

    if (
      empty &&
      now - room.touchedAt > ROOM_TTL_MS
    ) {

      clearBotTimers(room);

      rooms.delete(id);
    }
  });
}


module.exports = {
  create,
  get,
  join,
  attach,
  detach,
  act,
  lobbyAction,
  start,
  addBot,
  removeBot,
  tick,
  lobbyPayload,
  ROOM_TTL_MS,
  rooms
};
