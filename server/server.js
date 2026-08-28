"use strict";

/* =========================================================
   ACID UNO — СЕРВЕР
   ---------------------------------------------------------
   Один процесс отдаёт и статику, и комнаты, поэтому всё
   живёт на одном домене и не нужен ни CORS, ни второй хост.

   Зависимостей нет. Обмен идёт обычным HTTP: действия
   уходят POST-ом, состояние возвращается потоком SSE.
   Для карточной игры этого хватает с запасом, а кода
   и способов ошибиться заметно меньше, чем в вебсокете.

   Запуск:
     node server/server.js
     PORT=8080 node server/server.js
   ========================================================= */

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const rooms = require("./rooms.js");


const ROOT =
  path.resolve(__dirname, "..");

const PORT =
  Number(process.env.PORT) || 4173;

const HOST =
  process.env.HOST || "0.0.0.0";


const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2"
};


/* Наружу отдаём только эти файлы и папки. */
const PUBLIC = new Set([
  "index.html",
  "style.css",
  "effects.css",
  "v9.1.css",
  "features.css",
  "animations.js",
  "game.js",
  "v9.1.js",
  "src"
]);


function json(response, code, payload) {

  const body =
    JSON.stringify(payload);

  response.writeHead(code, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store"
  });

  response.end(body);
}


function readBody(request) {

  return new Promise(resolve => {

    let raw = "";

    request.on("data", chunk => {

      raw += chunk;

      /* тело действия не бывает большим */
      if (raw.length > 8192) {
        request.destroy();
      }
    });

    request.on("end", () => {

      try {
        resolve(raw ? JSON.parse(raw) : {});

      } catch (error) {
        resolve(null);
      }
    });

    request.on("error", () => resolve(null));
  });
}


/* =========================================================
   СТАТИКА
   ========================================================= */

function serveStatic(request, response, pathname) {

  const relative =
    pathname === "/"
      ? "index.html"
      : decodeURIComponent(pathname).replace(/^\/+/, "");

  const target =
    path.resolve(ROOT, relative);

  /*
    Ни выйти за корень, ни прочитать то, чего нет в списке.
  */
  const inside =
    target === ROOT ||
    target.startsWith(ROOT + path.sep);

  const top =
    relative.split("/")[0];

  if (
    !inside ||
    !PUBLIC.has(top)
  ) {

    response.writeHead(404);
    response.end("нет такой страницы");

    return;
  }


  fs.readFile(target, (error, data) => {

    if (error) {

      response.writeHead(404);
      response.end("нет такого файла");

      return;
    }

    response.writeHead(200, {
      "content-type":
        TYPES[path.extname(target)] ||
        "application/octet-stream",

      "cache-control": "no-cache"
    });

    response.end(data);
  });
}


/* =========================================================
   КОМНАТЫ
   ========================================================= */

function openStream(request, response, room, token) {

  response.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    "connection": "keep-alive",

    /*
      nginx по умолчанию буферизует ответ и поток встанет.
    */
    "x-accel-buffering": "no"
  });

  response.write(": ok\n\n");

  if (!rooms.attach(room, token, response)) {

    response.end();

    return;
  }

  /* держим соединение живым через прокси */
  const beat =
    setInterval(
      () => response.write(": beat\n\n"),
      25000
    );

  const drop = () => {

    clearInterval(beat);

    rooms.detach(room, token, response);
  };

  request.on("close", drop);
  request.on("error", drop);
}


async function serveApi(request, response, url) {

  const parts =
    url.pathname
      .replace(/^\/api\/rooms\/?/, "")
      .split("/")
      .filter(Boolean);


  /* POST /api/rooms — создать */
  if (
    parts.length === 0 &&
    request.method === "POST"
  ) {

    const body =
      await readBody(request);

    if (!body) {
      return json(response, 400, { error: "неверный запрос" });
    }

    const room =
      rooms.create({
        seats: body.seats,
        clockOff: body.clockOff
      });

    const seat =
      rooms.join(room, body.name);

    return json(response, 200, {
      room: room.id,
      ...seat
    });
  }


  const room =
    rooms.get(parts[0]);

  if (!room) {
    return json(response, 404, { error: "комната не найдена" });
  }


  /* POST /api/rooms/:id/join */
  if (
    parts[1] === "join" &&
    request.method === "POST"
  ) {

    const body =
      await readBody(request);

    const seat =
      rooms.join(room, body?.name);

    if (seat.error) {
      return json(response, 409, seat);
    }

    return json(response, 200, {
      room: room.id,
      ...seat
    });
  }


  const token =
    url.searchParams.get("token") || "";


  /* GET /api/rooms/:id/events */
  if (
    parts[1] === "events" &&
    request.method === "GET"
  ) {
    return openStream(request, response, room, token);
  }


  /* POST /api/rooms/:id/actions */
  if (
    parts[1] === "actions" &&
    request.method === "POST"
  ) {

    const body =
      await readBody(request);

    if (!body) {
      return json(response, 400, { error: "неверный запрос" });
    }

    const result =
      rooms.act(room, token, body);

    return json(
      response,
      result.error ? 409 : 200,
      result
    );
  }


  /* GET /api/rooms/:id */
  if (
    parts.length === 1 &&
    request.method === "GET"
  ) {
    return json(response, 200, rooms.lobbyPayload(room));
  }


  return json(response, 404, { error: "нет такого метода" });
}


/* =========================================================
   СЕРВЕР
   ========================================================= */

const server =
  http.createServer((request, response) => {

    const url =
      new URL(
        request.url,
        `http://${request.headers.host || "localhost"}`
      );

    if (
      url.pathname.startsWith("/api/rooms")
    ) {

      serveApi(request, response, url)
        .catch(() =>
          json(response, 500, { error: "сервер споткнулся" })
        );

      return;
    }

    if (
      request.method !== "GET" &&
      request.method !== "HEAD"
    ) {

      response.writeHead(405);
      response.end();

      return;
    }

    serveStatic(request, response, url.pathname);
  });


setInterval(rooms.tick, 1000).unref();


server.listen(PORT, HOST, () => {
  console.log(
    `ACID UNO: http://${HOST}:${PORT}`
  );
});
