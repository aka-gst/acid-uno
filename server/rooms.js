"use strict";

/* =========================================================
   ACID UNO — КОМНАТЫ
   ---------------------------------------------------------
   Комната держит одну партию и людей за столом. Правду
   считает src/match.js — тот же модуль, что и у клиента,
   поэтому расхождению взяться неоткуда.

   Клиенту уходит только его собственный взгляд на стол:
   чужие руки не покидают сервер.
   ========================================================= */

const crypto = require("node:crypto");

const M = require("../src/match.js");
const R = require("../src/rules.js");


/* Комнату называем так, чтобы её можно было продиктовать. */
const ROOM_ALPHABET = "ACDEFGHJKLMNPQRTUVWXY34789";

const ROOM_ID_LENGTH = 4;

/* Пустая комната живёт полчаса, потом убирается. */
const ROOM_TTL_MS = 30 * 60 * 1000;


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


function create(options) {

  const settings = options || {};

  const size =
    Math.min(
      R.MAX_SEATS,
      Math.max(R.MIN_SEATS, Number(settings.seats) || R.MIN_SEATS)
    );

  const id = roomId();

  const room = {
    id,
    size,

    /* token -> { seat, name, streams: Set } */
    players: new Map(),

    state: null,

    clockOff: Boolean(settings.clockOff),

    startedAt: null,

    touchedAt: Date.now()
  };

  rooms.set(id, room);

  return room;
}


function get(id) {
  return rooms.get(String(id || "").toUpperCase()) || null;
}


function playerBy(room, key) {
  return room.players.get(key) || null;
}


function takenSeats(room) {

  return new Set(
    [...room.players.values()].map(p => p.seat)
  );
}


function join(room, name) {

  if (room.state) {
    return { error: "партия уже идёт" };
  }

  const taken = takenSeats(room);

  let seat = -1;

  for (let i = 0; i < room.size; i++) {

    if (!taken.has(i)) {
      seat = i;
      break;
    }
  }

  if (seat === -1) {
    return { error: "комната заполнена" };
  }

  const key = token();

  room.players.set(key, {
    seat,

    name:
      String(name || "").slice(0, 24) ||
      `ИГРОК ${seat + 1}`,

    streams: new Set()
  });

  room.touchedAt = Date.now();

  return { token: key, seat };
}


function lobbyPayload(room) {

  const people =
    [...room.players.values()]
      .sort((a, b) => a.seat - b.seat)
      .map(p => ({
        seat: p.seat,
        name: p.name,
        online: p.streams.size > 0
      }));

  return {
    room: room.id,
    size: room.size,
    players: people,
    started: Boolean(room.state),

    limit:
      room.clockOff
        ? null
        : R.matchLimitFor(room.size, room.size),

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


function broadcastLobby(room) {

  const payload = lobbyPayload(room);

  room.players.forEach(player =>
    player.streams.forEach(stream =>
      send(stream, "lobby", payload)
    )
  );
}


function broadcastState(room, events) {

  if (!room.state) {
    return;
  }

  room.players.forEach(player =>
    player.streams.forEach(stream =>
      send(stream, "state", {
        state: M.view(room.state, player.seat),
        events
      })
    )
  );
}


function everyoneHere(room) {
  return room.players.size >= room.size;
}


function start(room) {

  if (room.state) {
    return;
  }

  room.state =
    M.create({
      seats: room.size,
      humans: room.size,
      seed: crypto.randomInt(0xFFFFFFFF)
    });

  room.startedAt = Date.now();

  room.touchedAt = Date.now();

  broadcastLobby(room);

  broadcastState(room, [{ type: "dealt" }]);
}


function attach(room, key, stream) {

  const player = playerBy(room, key);

  if (!player) {
    return false;
  }

  player.streams.add(stream);

  room.touchedAt = Date.now();

  send(stream, "lobby", lobbyPayload(room));

  if (room.state) {

    send(stream, "state", {
      state: M.view(room.state, player.seat),
      events: []
    });
  }

  broadcastLobby(room);

  if (
    !room.state &&
    everyoneHere(room)
  ) {
    start(room);
  }

  return true;
}


function detach(room, key, stream) {

  const player = playerBy(room, key);

  if (!player) {
    return;
  }

  player.streams.delete(stream);

  broadcastLobby(room);
}


/* =========================================================
   ДЕЙСТВИЕ

   Место берётся из токена, а не из тела запроса: клиент не
   должен уметь ходить за соседа.
   ========================================================= */

function act(room, key, action) {

  const player = playerBy(room, key);

  if (!player) {
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

    room.state = null;

    start(room);

    return { ok: true };
  }


  const safe = {
    ...action,
    seat: player.seat
  };

  /* поимку и закрытие окна адресуют другому месту */
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

  return { ok: true };
}


/*
  Часы идут на сервере: иначе у каждого свои три минуты.
*/
function tick() {

  const now = Date.now();

  rooms.forEach((room, id) => {

    if (
      room.state &&
      !room.state.over &&
      !room.clockOff
    ) {

      const limit =
        R.matchLimitFor(room.size, room.size);

      if (
        now - room.startedAt >= limit * 1000
      ) {

        const result =
          M.apply(room.state, { type: "timeout" });

        room.state = result.state;

        broadcastState(room, result.events);

      } else if (
        limit * 1000 - (now - room.startedAt) <=
        R.MATCH_WARN_SECONDS * 1000
      ) {

        /* последняя минута — обновляем таймер у всех */
        broadcastLobby(room);
      }
    }

    const idle =
      [...room.players.values()]
        .every(p => p.streams.size === 0);

    if (
      idle &&
      now - room.touchedAt > ROOM_TTL_MS
    ) {
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
  start,
  tick,
  lobbyPayload,
  rooms
};
