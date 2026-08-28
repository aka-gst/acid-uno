"use strict";

/* =========================================================
   ACID UNO — TRANSPORT
   ---------------------------------------------------------
   Куда уходит действие: в локальный редьюсер или на сервер
   комнаты.

   Оба транспорта отвечают одинаково —

     { state, events, error }

   — поэтому подмена одного другим ничего не меняет ни в
   отрисовке, ни во взаимодействии.
   ========================================================= */

const AcidTransport = (() => {


  /* =======================================================
     ЛОКАЛЬНО

     Партия считается прямо здесь. Соперники — боты, их ход
     запускает v9.1.js.
     ======================================================= */

  function local() {

    return {

      mode: "local",

      seat: 0,

      create(options) {
        return AcidMatch.create(options);
      },

      async send(action, state) {
        return AcidMatch.apply(state, action);
      },

      close() {}
    };
  }


  /* =======================================================
     КОМНАТА

     Состояние считает сервер. Клиент шлёт действие и ждёт,
     пока то же состояние приедет обратно потоком, — своей
     копии правды у него нет.
     ======================================================= */

  function remote(options) {

    const settings = options || {};

    /*
      Путь относительный: на сайте игра живёт в подкаталоге,
      и абсолютный /api ушёл бы мимо неё в корень домена.
    */
    const base =
      `api/rooms/${encodeURIComponent(settings.room)}`;


    let source = null;

    let closed = false;


    const transport = {

      mode: "remote",

      room: settings.room,

      seat: settings.seat,

      token: settings.token,

      onState: settings.onState || (() => {}),

      onLobby: settings.onLobby || (() => {}),

      onDrop: settings.onDrop || (() => {}),


      create() {

        /*
          Раздаёт сервер: клиент получит состояние потоком.
        */
        return null;
      },


      async send(action) {

        try {

          const response =
            await fetch(
              `${base}/actions?token=${encodeURIComponent(transport.token)}`,
              {
                method: "POST",

                headers: {
                  "content-type": "application/json"
                },

                body: JSON.stringify(action)
              }
            );

          const data =
            await response.json();

          if (data.error) {
            return {
              state: null,
              events: [],
              error: data.error
            };
          }

          /*
            Настоящий ответ придёт потоком: сервер разошлёт
            новое состояние всем, включая отправителя.
          */
          return {
            state: null,
            events: [],
            pending: true
          };

        } catch (error) {

          return {
            state: null,
            events: [],
            error: "нет связи с комнатой"
          };
        }
      },


      open() {

        source =
          new EventSource(
            `${base}/events?token=${encodeURIComponent(transport.token)}`
          );

        source.addEventListener(
          "lobby",
          message =>
            transport.onLobby(
              JSON.parse(message.data)
            )
        );

        source.addEventListener(
          "state",
          message => {

            const payload =
              JSON.parse(message.data);

            transport.onState(
              payload.state,
              payload.events || []
            );
          }
        );

        source.addEventListener(
          "error",
          () => {

            if (closed) {
              return;
            }

            transport.onDrop();
          }
        );

        return transport;
      },


      close() {

        closed = true;

        source?.close();

        source = null;
      }
    };


    return transport;
  }


  return {
    local,
    remote
  };

})();
