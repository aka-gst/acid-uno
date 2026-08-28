"use strict";

/* =========================================================
   ACID UNO — КОМНАТА ПО ССЫЛКЕ
   ---------------------------------------------------------
   Создаёт комнату, показывает ссылку и ждёт остальных.
   Партию считает сервер: клиент только шлёт действия и
   рисует то, что приехало обратно.
   ========================================================= */

(() => {

  const $$ = id =>
    document.getElementById(id);


  const state = {
    room: null,
    token: null,
    seat: 0,
    size: 0,

    /* имена мест приходят из лобби: за столом сидят и боты */
    names: []
  };


  /*
    Место закреплено за токеном, а не за вкладкой. Держим его
    в sessionStorage, иначе перезагрузка страницы выглядела бы
    для сервера как новый игрок — и упиралась бы в «комната
    заполнена».
  */
  function remember(room, token, seat) {

    try {
      window.sessionStorage.setItem(
        "acid-room-" + room,
        JSON.stringify({ token, seat })
      );

    } catch (error) {
      /* приватный режим — переподключиться не выйдет */
    }
  }


  function recall(room) {

    try {
      return JSON.parse(
        window.sessionStorage.getItem("acid-room-" + room)
      );

    } catch (error) {
      return null;
    }
  }


  function forget(room) {

    try {
      window.sessionStorage.removeItem("acid-room-" + room);

    } catch (error) {
      /* нечего забывать */
    }
  }


  /*
    Игра раздаётся и как чистая статика — тогда сервера комнат
    рядом нет вовсе. В этом случае запрос не падает молча
    и не роняет лобби: возвращаем внятную причину.
  */
  async function api(path, body) {

    try {

      const response =
        await fetch(path, {
          method: "POST",

          headers: {
            "content-type": "application/json"
          },

          body: JSON.stringify(body || {})
        });

      if (
        !response.ok &&
        response.status >= 500
      ) {
        return { error: "сервер комнат не отвечает" };
      }

      return await response.json();

    } catch (error) {

      return {
        error: "игра открыта без сервера комнат"
      };
    }
  }


  function roomLink() {

    const url = new URL(location.href);

    url.search = "";

    url.searchParams.set("room", state.room);

    return url.toString();
  }


  function showPanel(on) {

    $$("lobbyMain")
      ?.classList
      .toggle("hidden", on);

    $$("roomPanel")
      ?.classList
      .toggle("hidden", !on);

    $$("lobby")
      ?.classList
      .toggle("hidden", false);
  }


  function paintLobbyList(payload) {

    state.size = payload.size;

    $$("roomCode").textContent =
      payload.room;

    state.names =
      payload.seats.map(
        seat => seat.name
      );


    $$("roomPlayers").innerHTML =
      payload.seats
        .map(seat => {

          const mine =
            seat.seat === state.seat &&
            seat.kind === "human";

          const label =
            !seat.kind
              ? "ЖДЁМ"
              : mine
                ? "ТЫ"
                : seat.name;

          return `
            <div class="roomSeat${
              seat.kind ? " taken" : ""
            }${mine ? " mine" : ""}${
              seat.kind === "bot" ? " bot" : ""
            }">
              <span>${label}</span>
              <b>${seat.seat + 1}</b>
            </div>
          `;
        })
        .join("");


    $$("roomBotAdd").disabled = !payload.canAddBot;
    $$("roomBotRemove").disabled = !payload.canRemoveBot;

    $$("roomStart").disabled = !payload.canStart;

    $$("roomStart").classList.toggle(
      "hidden",
      payload.started
    );

    $$("roomTools")
      ?.classList
      .toggle("hidden", payload.started);


    const missing =
      payload.size - payload.taken;

    $$("roomNote").textContent =
      payload.started
        ? "ПАРТИЯ ИДЁТ"
        : missing > 0
          ? `ЖДЁМ ЕЩЁ ${missing} · ССЫЛКА ВЫШЕ`
          : "НАЧИНАЕМ";


    if (payload.started) {

      showPanel(false);

      $$("lobby")?.classList.add("hidden");

      AcidClock.syncFrom(payload);
    }
  }


  function connect() {

    AcidStore.attach({
      room: state.room,
      token: state.token,
      seat: state.seat,

      onLobby: paintLobbyList,

      onDrop() {

        $$("roomNote").textContent =
          "СВЯЗЬ ПОТЕРЯНА · ПЕРЕПОДКЛЮЧАЕМСЯ";

        /*
          За столом лобби уже скрыто, и молчание выглядит как
          зависшая игра. Комната живёт в памяти процесса:
          после перезапуска сервера её действительно нет,
          и об этом лучше сказать, чем молча ждать.
        */
        if (
          $$("lobby")?.classList.contains("hidden")
        ) {

          AcidFX.status(
            "СВЯЗЬ С КОМНАТОЙ ПОТЕРЯНА"
          );
        }
      }
    });
  }


  async function createRoom(seats, clockOff) {

    const answer =
      await api("api/rooms", {
        seats,
        clockOff,
        name: "ХОЗЯИН"
      });

    if (answer.error) {
      return answer;
    }

    state.room = answer.room;
    state.token = answer.token;
    state.seat = answer.seat;

    remember(
      answer.room,
      answer.token,
      answer.seat
    );

    history.replaceState(
      null,
      "",
      roomLink()
    );

    showPanel(true);

    connect();

    return answer;
  }


  async function joinRoom(id) {

    /*
      Уже сидели за этим столом — возвращаемся на своё место.
    */
    const known =
      recall(String(id).toUpperCase());

    if (known?.token) {

      state.room = String(id).toUpperCase();
      state.token = known.token;
      state.seat = known.seat;

      showPanel(true);

      connect();

      return known;
    }


    const answer =
      await api(
        `api/rooms/${encodeURIComponent(id)}/join`,
        { name: "ГОСТЬ" }
      );

    if (answer.error) {

      showPanel(true);

      $$("roomCode").textContent = id;

      $$("roomNote").textContent =
        answer.error.toUpperCase();

      return answer;
    }

    state.room = answer.room;
    state.token = answer.token;
    state.seat = answer.seat;

    remember(
      answer.room,
      answer.token,
      answer.seat
    );

    showPanel(true);

    connect();

    return answer;
  }


  /* =======================================================
     КНОПКИ
     ======================================================= */

  $$("lobbyOnline")
    ?.addEventListener(
      "click",
      async () => {

        const chosen =
          document.querySelector(".seatPick.chosen");

        const clockOff =
          $$("clockToggle")
            ?.classList
            .contains("on");

        AcidSound.play("card");

        const answer =
          await createRoom(
            Number(chosen?.dataset.seats) ||
              AcidRules.MIN_SEATS,
            clockOff
          );

        if (answer?.error) {

          $$("lobbyNote").textContent =
            answer.error.toUpperCase() +
            " · ИГРАЙ С БОТАМИ";
        }
      }
    );


  async function lobbyCommand(what) {

    if (!state.token) {
      return;
    }

    const answer =
      await api(
        `api/rooms/${encodeURIComponent(state.room)}` +
        `/lobby?token=${encodeURIComponent(state.token)}`,
        { do: what }
      );

    if (answer.error) {

      $$("roomNote").textContent =
        answer.error.toUpperCase();
    }

    return answer;
  }


  $$("roomBotAdd")
    ?.addEventListener(
      "click",
      () => {

        AcidSound.play("draw");

        lobbyCommand("addBot");
      }
    );


  $$("roomBotRemove")
    ?.addEventListener(
      "click",
      () => {

        AcidSound.play("card");

        lobbyCommand("removeBot");
      }
    );


  $$("roomStart")
    ?.addEventListener(
      "click",
      () => {

        AcidSound.play("card");

        lobbyCommand("start");
      }
    );


  $$("roomCopy")
    ?.addEventListener(
      "click",
      async () => {

        const link = roomLink();

        try {
          await navigator.clipboard.writeText(link);

          $$("roomCopy").textContent = "СКОПИРОВАНО";

        } catch (error) {

          /*
            Буфер обмена бывает закрыт — показываем ссылку,
            чтобы её можно было выделить руками.
          */
          $$("roomCopy").textContent = link;
        }

        setTimeout(
          () => {
            $$("roomCopy").textContent =
              "СКОПИРОВАТЬ ССЫЛКУ";
          },
          2500
        );
      }
    );


  $$("roomLeave")
    ?.addEventListener(
      "click",
      () => {

        if (state.room) {
          forget(state.room);
        }

        location.href =
          location.pathname;
      }
    );


  /* =======================================================
     ССЫЛКА В АДРЕСЕ
     ======================================================= */

  const invited =
    new URL(location.href)
      .searchParams
      .get("room");

  if (invited) {

    $$("rules")
      ?.classList
      .add("hidden");

    joinRoom(invited);
  }


  window.AcidRoom = {
    state,
    createRoom,
    joinRoom,
    link: roomLink
  };

})();
