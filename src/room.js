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
    Место закреплено за токеном, а не за вкладкой, иначе
    перезагрузка выглядела бы для сервера как новый игрок и
    упиралась бы в «комната заполнена».

    Хранится в localStorage, а не в sessionStorage: тот умирает
    вместе со вкладкой, и закрытый браузер означал бы навсегда
    потерянную партию — а из партии нельзя выйти даже нарочно.
    Рядом лежит указатель на текущий стол: по нему игра сама
    садится обратно, когда в адресе уже нет ссылки-приглашения.
  */
  const SEAT_KEY = "acid-room-";

  const ACTIVE_KEY = "acid-room-active";


  function remember(room, token, seat) {

    try {
      window.localStorage.setItem(
        SEAT_KEY + room,
        JSON.stringify({ token, seat })
      );

      window.localStorage.setItem(ACTIVE_KEY, room);

    } catch (error) {
      /* приватный режим — переподключиться не выйдет */
    }
  }


  function recall(room) {

    try {
      return JSON.parse(
        window.localStorage.getItem(SEAT_KEY + room)
      );

    } catch (error) {
      return null;
    }
  }


  function forget(room) {

    try {
      window.localStorage.removeItem(SEAT_KEY + room);

      if (
        window.localStorage.getItem(ACTIVE_KEY) === room
      ) {
        window.localStorage.removeItem(ACTIVE_KEY);
      }

    } catch (error) {
      /* нечего забывать */
    }
  }


  function activeRoom() {

    try {
      return window.localStorage.getItem(ACTIVE_KEY);

    } catch (error) {
      return null;
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

    const wasNamed =
      state.names.join("\u0001");

    state.names =
      payload.seats.map(
        seat => seat.name
      );


    /*
      Имена приходят только с лобби, а стол уже нарисован —
      при возврате в начатую партию соперник иначе навсегда
      остаётся подписан «ACID BOT». Перерисовываем ровно
      когда имена и правда сменились.
    */
    if (
      state.names.join("\u0001") !== wasNamed &&
      typeof render === "function"
    ) {
      render();
    }


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


  /*
    Комната ответила хоть чем-то — лобби или состоянием. Нужно,
    чтобы отличить «сели обратно за живой стол» от «стола давно
    нет»: во втором случае сервер молча закрывает поток.
  */
  let heard = false;


  AcidStore.subscribe(
    () => {

      heard = true;

      /*
        Партия доиграна — держать за собой место больше незачем.
        Иначе следующий запуск молча усадил бы за законченный
        стол, откуда ещё и не выйти.
      */
      if (gameOver && state.room) {
        forget(state.room);
      }
    }
  );



  /* =======================================================
     БЫСТРЫЙ ЧАТ

     Только за живым столом и только готовыми фразами: с
     ботами говорить не с кем, а свободный ввод открыл бы
     дверь всему остальному. Наружу уходит номер фразы,
     текст берётся из правил — теми же строками на сервере.
     ======================================================= */

  let chatSheet = null;


  function buildChat() {

    if (chatSheet) {
      return;
    }

    const open =
      document.createElement("button");

    open.id = "chatOpen";
    open.type = "button";
    open.setAttribute("aria-label", "Сказать фразу");
    open.textContent = "💬";

    chatSheet =
      document.createElement("div");

    chatSheet.id = "chatSheet";
    chatSheet.className = "hidden";

    chatSheet.innerHTML =
      AcidRules.CHAT_PHRASES
        .map(
          (phrase, index) =>
            `<button type="button" data-phrase="${index}">${phrase}</button>`
        )
        .join("");

    open.addEventListener(
      "click",
      () =>
        chatSheet.classList.toggle("hidden")
    );

    chatSheet.addEventListener(
      "click",
      event => {

        const button =
          event.target.closest("button[data-phrase]");

        if (!button) {
          return;
        }

        chatSheet.classList.add("hidden");

        lobbyCommand2(
          "chat",
          { phrase: Number(button.dataset.phrase) }
        );
      }
    );

    document.body.append(open, chatSheet);
  }


  /*
    Реплика висит у того, кто её сказал: подпись без источника
    за столом на семерых ничего не значит.
  */
  function showChat(payload) {

    const mine =
      payload.seat === state.seat;

    /*
      Своя реплика вешается на руку, а не на playerArea: тот
      нулевой ширины, и пузырь по центру уезжает к левому краю.
    */
    const host =
      mine
        ? $$("hand")
        : document.querySelector(
            `.opponent[data-seat="${payload.seat}"]`
          );

    if (!host) {
      return;
    }

    host
      .querySelector(".chatBubble")
      ?.remove();

    const bubble =
      document.createElement("span");

    bubble.className = "chatBubble";

    bubble.textContent = payload.phrase;

    host.appendChild(bubble);

    window.setTimeout(
      () => bubble.remove(),
      3200
    );
  }


  /* та же команда лобби, но с телом */
  async function lobbyCommand2(what, extra) {

    if (!state.token) {
      return;
    }

    await api(
      `api/rooms/${encodeURIComponent(state.room)}` +
      `/lobby?token=${encodeURIComponent(state.token)}`,
      Object.assign({ do: what }, extra || {})
    );
  }


  function connect() {

    AcidStore.attach({
      room: state.room,
      token: state.token,
      seat: state.seat,

      onLobby(payload) {

        heard = true;

        paintLobbyList(payload);
      },

      onChat: showChat,

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

    buildChat();

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

      /* указатель мог остаться от прошлого стола */
      remember(state.room, state.token, state.seat);

      showPanel(true);

      buildChat();

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

    buildChat();

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

  } else {

    /*
      Ссылки в адресе нет, но за столом мы уже сидели —
      возвращаемся туда молча. Так партия переживает и
      закрытую вкладку, и закрытый браузер.

      Комната живёт в памяти сервера и когда-нибудь исчезает.
      Тогда поток закрывается сразу и не приходит ни лобби,
      ни состояния: через несколько секунд отпускаем место и
      уходим в меню, а не сидим за пустым столом.
    */
    const kept = activeRoom();

    if (kept) {

      $$("rules")
        ?.classList
        .add("hidden");

      joinRoom(kept);

      window.setTimeout(
        () => {

          if (heard) {
            return;
          }

          forget(kept);

          location.replace(location.pathname);
        },
        6000
      );
    }
  }


  window.AcidRoom = {
    state,
    createRoom,
    joinRoom,
    link: roomLink
  };

})();
