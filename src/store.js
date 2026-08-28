"use strict";

/* =========================================================
   ACID UNO — STORE
   ---------------------------------------------------------
   Единственное место, где меняется состояние партии.

   Состояние живёт в редьюсере src/match.js — локально или на
   сервере комнаты, смотря какой подключён транспорт. Наружу
   оно проецируется в те же глобальные переменные game.js,
   что и раньше: отрисовка и анимации читают их как читали,
   но больше не меняют.

   В комнате чужие руки клиенту не приходят вовсе — вместо
   карт в проекции лежат заглушки, чтобы код, считающий
   hand.length, работал без изменений.
   ========================================================= */

const AcidStore = (() => {

  const HIDDEN_CARD =
    Object.freeze({
      id: 0,
      color: "wild",
      value: "wild",
      hidden: true
    });


  let state = null;

  let transport = AcidTransport.local();

  const listeners = [];


  function randomSeed() {
    return (
      Math.random() * 0xFFFFFFFF
    ) >>> 0;
  }


  function mySeat() {
    return transport.seat || 0;
  }


  function online() {
    return transport.mode === "remote";
  }


  /*
    Разворачивает то, что видит игрок, в форму, которую ждёт
    отрисовка: у чужих мест рука нужного размера из заглушек.
  */
  function seatsForRender(source) {

    return source.seats.map(seat => ({
      index: seat.index,
      kind: seat.kind,

      hand:
        seat.hand ||
        new Array(seat.count).fill(HIDDEN_CARD),

      unoCalled: seat.unoCalled,
      unoVulnerable: seat.unoVulnerable
    }));
  }


  /*
    Локально боты живут в этом же процессе, и их руки нужны
    целиком: иначе ходить будет нечем. В комнате сервер
    присылает уже урезанный взгляд.
  */
  function localView(source) {

    return {
      seats: source.seats,

      deckCount: source.deck.length,

      top:
        source.discard[
          source.discard.length - 1
        ],

      currentColor: source.currentColor,
      drawPenalty: source.drawPenalty,
      penaltyType: source.penaltyType,

      activeSeat: source.activeSeat,
      direction: source.direction,

      over: source.over,
      winner: source.winner,
      draw: source.draw,
      points: source.points
    };
  }


  /*
    Проекция состояния в переменные game.js.

    Это единственное место во всём проекте, где им
    присваивается значение.
  */
  function project() {

    const seen =
      online()
        ? state
        : localView(state);


    seats = seatsForRender(seen);

    deck =
      new Array(seen.deckCount)
        .fill(HIDDEN_CARD);

    discard = [seen.top];

    currentColor = seen.currentColor;
    drawPenalty = seen.drawPenalty;
    penaltyType = seen.penaltyType;

    activeSeat = seen.activeSeat;
    direction = seen.direction;

    player = seats[mySeat()].hand;

    /*
      bot всегда смотрит на руку того соперника, который
      ходит: на этом держится весь код хода бота.
    */
    bot =
      seats[
        seen.activeSeat === mySeat()
          ? (mySeat() + 1) % seats.length
          : seen.activeSeat
      ].hand;

    turn =
      seen.activeSeat === mySeat()
        ? "player"
        : "bot";

    gameOver = seen.over;
  }


  function announce(events) {

    listeners.forEach(
      listener =>
        listener(events, state)
    );
  }


  /* =======================================================
     ЛОКАЛЬНАЯ ПАРТИЯ
     ======================================================= */

  function reset(options) {

    const settings = options || {};

    transport.close();

    transport = AcidTransport.local();

    state =
      transport.create({
        seats: settings.seats,
        humans: settings.humans,

        seed:
          settings.seed ?? randomSeed()
      });

    project();

    return state;
  }


  /* =======================================================
     КОМНАТА

     Состояние приходит с сервера готовым, считать его
     заново клиент не пытается.
     ======================================================= */

  function attach(options) {

    transport.close();

    transport =
      AcidTransport.remote({
        ...options,

        onState(next, events) {

          state = next;

          project();

          announce(events);
        }
      });

    transport.open();

    return transport;
  }


  /* =======================================================
     ДЕЙСТВИЕ

     Отклонённое действие не меняет ничего: и редьюсер,
     и сервер возвращают прежнее состояние с текстом ошибки.
     ======================================================= */

  async function dispatch(action) {

    if (!state && !online()) {
      return {
        events: [],
        error: "партия не начата"
      };
    }


    const result =
      await transport.send(action, state);


    if (result.error) {
      return result;
    }


    /*
      В комнате правду присылает сервер отдельным потоком,
      поэтому здесь применять нечего.
    */
    if (result.pending) {
      return {
        events: [],
        pending: true
      };
    }


    state = result.state;

    project();

    announce(result.events);

    return result;
  }


  function subscribe(listener) {

    listeners.push(listener);

    return () => {

      const index =
        listeners.indexOf(listener);

      if (index !== -1) {
        listeners.splice(index, 1);
      }
    };
  }


  function current() {
    return state;
  }


  function legalMoves(seat) {

    if (!state) {
      return [];
    }

    /*
      В комнате чужих рук у клиента нет, поэтому спросить
      можно только про своё место.
    */
    if (
      online() &&
      seat !== mySeat()
    ) {
      return [];
    }

    return online()
      ? movesFromView(seat)
      : AcidMatch.legalMoves(state, seat);
  }


  /*
    В комнате состояние — это уже взгляд одного игрока,
    поэтому ходимость считаем по проекции.
  */
  function movesFromView(seat) {

    const hand =
      seats[seat]?.hand || [];

    const table = {
      top: discard[discard.length - 1],
      currentColor,
      drawPenalty,
      penaltyType
    };

    if (seat !== activeSeat) {

      if (drawPenalty > 0) {
        return [];
      }

      return hand.filter(
        card =>
          AcidRules.canIntercept(card, table.top)
      );
    }

    return hand.filter(
      card => AcidRules.canPlay(card, table)
    );
  }


  function seatOf(index) {
    return seats[index] || null;
  }


  return {
    reset,
    attach,
    dispatch,
    subscribe,
    current,
    legalMoves,
    seatOf,
    mySeat,
    online
  };

})();
