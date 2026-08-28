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
    size: 0
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


  function api(path, body) {

    return fetch(path, {
      method: "POST",

      headers: {
        "content-type": "application/json"
      },

      body: JSON.stringify(body || {})
    })
      .then(response => response.json());
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

    const box = $$("roomPlayers");

    box.innerHTML =
      Array.from(
        { length: payload.size },
        (ignored, index) => {

          const player =
            payload.players.find(
              p => p.seat === index
            );

          const mine =
            player && player.seat === state.seat;

          return `
            <div class="roomSeat${player ? " taken" : ""}${mine ? " mine" : ""}">
              <span>${
                player
                  ? (mine ? "ТЫ" : player.name)
                  : "ЖДЁМ"
              }</span>
              <b>${index + 1}</b>
            </div>
          `;
        }
      ).join("");


    const missing =
      payload.size - payload.players.length;

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
      }
    });
  }


  async function createRoom(seats, clockOff) {

    const answer =
      await api("/api/rooms", {
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
        `/api/rooms/${encodeURIComponent(id)}/join`,
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

        await createRoom(
          Number(chosen?.dataset.seats) ||
            AcidRules.MIN_SEATS,
          clockOff
        );
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
