"use strict";

/* =========================================================
   ACID UNO — STORE
   ---------------------------------------------------------
   Единственное место, где меняется состояние партии.

   Состояние живёт в редьюсере src/match.js. Наружу оно
   проецируется в те же глобальные переменные game.js, что и
   раньше — отрисовка и анимации читают их как читали, но
   больше не меняют. Любое изменение идёт через dispatch().

   Когда появится мультиплеер, project() будет собирать
   проекцию из AcidMatch.view(state, мойСтул), а не из
   полного состояния: чужие руки клиенту не нужны.
   ========================================================= */

const AcidStore = (() => {

  let state = null;

  const listeners = [];


  function randomSeed() {
    return (
      Math.random() * 0xFFFFFFFF
    ) >>> 0;
  }


  /*
    Проекция состояния в переменные game.js.

    Это единственное место во всём проекте, где им
    присваивается значение.
  */
  function project() {

    seats = state.seats;
    deck = state.deck;
    discard = state.discard;

    currentColor = state.currentColor;
    drawPenalty = state.drawPenalty;
    penaltyType = state.penaltyType;

    activeSeat = state.activeSeat;
    direction = state.direction;

    player = state.seats[0].hand;

    /*
      bot всегда смотрит на руку того соперника, который
      ходит: на этом держится весь код хода бота.
    */
    bot =
      state.seats[
        state.activeSeat === 0
          ? Math.min(1, state.seats.length - 1)
          : state.activeSeat
      ].hand;

    turn =
      state.activeSeat === 0
        ? "player"
        : "bot";

    gameOver = state.over;
  }


  function reset(options) {

    const settings = options || {};

    state =
      AcidMatch.create({
        seats: settings.seats,
        humans: settings.humans,

        seed:
          settings.seed ?? randomSeed()
      });

    project();

    return state;
  }


  /*
    Отклонённое действие не меняет ничего: редьюсер возвращает
    прежнее состояние и текст ошибки.
  */
  function dispatch(action) {

    if (!state) {
      return {
        events: [],
        error: "партия не начата"
      };
    }

    const result =
      AcidMatch.apply(state, action);

    if (result.error) {
      return result;
    }

    state = result.state;

    project();

    listeners.forEach(
      listener =>
        listener(result.events, state)
    );

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

    return state
      ? AcidMatch.legalMoves(state, seat)
      : [];
  }


  function seatOf(index) {
    return state?.seats[index] || null;
  }


  return {
    reset,
    dispatch,
    subscribe,
    current,
    legalMoves,
    seatOf
  };

})();
