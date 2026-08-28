"use strict";

/* =========================================================
   ACID UNO — FEATURE LAYER

   Слой поверх game.js и v9.1.js. Ничего не переписывает,
   а оборачивает уже существующие глобальные функции:

     render           -> аура активного цвета, счётчик кластера
     startGame        -> перезапуск часов партии
     finish           -> звук итога

   Звук берётся не из обёрток, а из событий редьюсера:
   AcidStore.subscribe() отдаёт всё, что случилось за ход.

   Плюс часы партии: три минуты, за минуту до конца
   таймер выходит на экран, по истечении выигрывает тот,
   у кого меньше сумма карт.

   Правила счёта и сами часы живут в src/rules.js.
   ========================================================= */

(() => {

  const $$ = id =>
    document.getElementById(id);


  /* =======================================================
     ЗВУК
     ======================================================= */

  const soundButton =
    $$("sound");


  function syncSoundButton() {

    if (!soundButton) {
      return;
    }

    const on =
      AcidSound.enabled();

    soundButton.textContent =
      on ? "🔊" : "🔇";

    soundButton.classList.toggle(
      "muted",
      !on
    );

    soundButton.setAttribute(
      "aria-pressed",
      String(on)
    );
  }


  soundButton
    ?.addEventListener(
      "click",
      event => {

        event.preventDefault();
        event.stopPropagation();

        AcidSound.toggle();

        syncSoundButton();

        if (AcidSound.enabled()) {
          AcidSound.play("card");
        }
      }
    );


  syncSoundButton();


  /* =======================================================
     АУРА АКТИВНОГО ЦВЕТА + СЧЁТЧИК КЛАСТЕРА
     ======================================================= */

  let shownColor = null;

  let shownStack = 0;

  let auraTimer = null;


  function paintAura() {

    const pile =
      $$("discard");

    if (!pile) {
      return;
    }

    pile.dataset.color =
      currentColor;

    if (
      shownColor === currentColor
    ) {
      return;
    }

    shownColor = currentColor;

    pile.classList.remove("aura-shift");

    /* перезапуск анимации */
    void pile.offsetWidth;

    pile.classList.add("aura-shift");

    clearTimeout(auraTimer);

    auraTimer =
      setTimeout(
        () =>
          pile.classList.remove("aura-shift"),
        560
      );
  }


  function paintStack() {

    const hud =
      $$("stackHUD");

    const value =
      $$("stackHUDValue");

    if (!hud || !value) {
      return;
    }


    if (drawPenalty <= 0) {

      hud.classList.add("hidden");

      hud.classList.remove("bump", "mine");

      shownStack = 0;

      return;
    }


    const mine =
      turn === "player";

    value.textContent =
      "+" + drawPenalty;

    hud.querySelector(".stackHUDLabel")
      .textContent =
        mine
          ? "ВОЗЬМЁШЬ"
          : "БОТ ВОЗЬМЁТ";

    hud.classList.toggle("mine", mine);

    hud.classList.remove("hidden");


    if (drawPenalty > shownStack) {

      hud.classList.remove("bump");

      void hud.offsetWidth;

      hud.classList.add("bump");
    }

    shownStack = drawPenalty;
  }


  const baseRender = render;

  render = function () {

    baseRender();

    paintAura();

    paintStack();
  };


  /* =======================================================
     ЗВУК ИГРОВЫХ СОБЫТИЙ

     Один источник правды: что случилось за ход, знает
     редьюсер, а не обёртки над функциями отрисовки.
     ======================================================= */

  let lastDrawSound = 0;


  AcidStore.subscribe(events => {

    let penalty = false;

    events.forEach(event => {

      if (event.type === "played") {

        AcidSound.play(
          event.card.value === "reverse"
            ? "reverse"
            : "card"
        );
      }

      if (event.type === "drew") {

        const now = performance.now();

        /*
          Серия доборов звучит один раз: при штрафе +6
          не нужно шесть одинаковых щелчков подряд.
        */
        if (now - lastDrawSound > 110) {

          lastDrawSound = now;

          AcidSound.play("draw");
        }
      }

      if (
        event.type === "penalty" ||
        event.type === "caught"
      ) {
        penalty = true;
      }

      if (event.type === "uno") {
        AcidSound.play("uno");
      }
    });

    if (penalty) {
      AcidSound.play("penalty");
    }
  });


  /* =======================================================
     ЧАСЫ ПАРТИИ
     ======================================================= */

  const clock =
    new AcidRules.MatchClock({
      limitSeconds:
        AcidRules.MATCH_LIMIT_SECONDS,

      warnSeconds:
        AcidRules.MATCH_WARN_SECONDS
    });


  /*
    Часы выключаются единогласным решением живых игроков.
    Пока живой игрок один, единогласие — это его галочка
    в лобби; с приходом мультиплеера здесь появится
    настоящее голосование.
  */
  let clockOff = false;


  let lastTick = 0;

  let tickTimer = null;


  function paintClock(snapshot) {

    const el = $$("matchClock");

    if (!el) {
      return;
    }

    el.classList.toggle(
      "hidden",
      !snapshot.visible
    );

    el.classList.toggle(
      "urgent",
      snapshot.visible && snapshot.urgent
    );

    if (snapshot.visible) {
      el.textContent = snapshot.label;
    }
  }


  function tick() {

    const now = performance.now();

    const delta =
      (now - lastTick) / 1000;

    lastTick = now;

    const snapshot =
      clock.advance(delta);

    paintClock(snapshot);

    /*
      В комнате гонг бьёт сервер: у каждого клиента свои
      часы, и договориться им не о чем.
    */
    if (
      snapshot.expired &&
      !AcidStore.online()
    ) {
      finishByTime();
    }
  }


  function startClock() {

    clock.limit =
      clockOff
        ? Infinity
        : AcidRules.matchLimitFor(
            seatCount(),
            humanSeats().length
          );

    clock.start();

    lastTick = performance.now();

    paintClock(clock.advance(0));

    clearInterval(tickTimer);

    tickTimer =
      setInterval(tick, 250);
  }


  function stopClock() {

    clock.stop();

    clearInterval(tickTimer);

    tickTimer = null;

    paintClock(clock.advance(0));
  }


  /* =======================================================
     ИТОГ ПО ОЧКАМ
     ======================================================= */

  function renderScore(points, leaders) {

    const box = $$("endScore");

    if (!box) {
      return;
    }

    box.innerHTML =
      points
        .map((value, index) => `
          <div class="endScoreRow${
            leaders.includes(index)
              ? ""
              : " lost"
          }">
            <span>${seatName(index)}</span>
            <b>${value}</b>
          </div>
        `)
        .join("");

    box.classList.remove("hidden");
  }


  async function finishByTime() {

    if (gameOver) {
      return;
    }

    stopClock();


    /*
      Кластер, висящий на столе в момент гонга, сначала
      уходит тому, кто обязан был его забрать. Иначе можно
      было бы бросить +4 на последней секунде и выиграть
      по очкам, ничего не заплатив.
    */
    /*
      Гонг — такое же действие партии, как выкладка карты.
      Висящий кластер редьюсер сам отдаёт тому, кто обязан
      был его забрать.
    */
    const result =
      await AcidStore.dispatch({
        type: "timeout"
      });

    if (result.error) {
      return;
    }


    const outcome =
      result.events.find(
        event => event.type === "over"
      );


    const leaders =
      outcome.leaders;


    const points =
      outcome.points;


    const playerWon =
      leaders.includes(0);


    render();

    AcidFX.status("ВРЕМЯ ВЫШЛО");

    await AcidFX.flash(
      playerWon
        ? "green"
        : "purple"
    );

    AcidSound.play(
      playerWon
        ? "win"
        : "lose"
    );

    $$("endText").textContent =
      outcome.draw && playerWon
        ? "ВРЕМЯ ВЫШЛО — НИЧЬЯ"
        : playerWon
          ? "ВРЕМЯ ВЫШЛО — ТЫ ВЫИГРАЛ"
          : `ВРЕМЯ ВЫШЛО — ${seatName(leaders[0])} ВЫИГРАЛ`;

    renderScore(
      points,
      leaders
    );

    $$("endScreen")
      ?.classList
      .remove("hidden");
  }


  /* =======================================================
     ПЕРЕХВАТ START / FINISH
     ======================================================= */

  const baseStartGame = startGame;

  startGame = function () {

    baseStartGame();

    $$("endScore")
      ?.classList
      .add("hidden");

    startClock();

    render();
  };


  const baseFinish = finish;

  finish = async function (playerWon) {

    stopClock();

    AcidSound.play(
      playerWon ? "win" : "lose"
    );

    $$("endScore")
      ?.classList
      .add("hidden");

    return baseFinish(playerWon);
  };


  /* =======================================================
     ЛОББИ

     Размер стола и часы выбираются до раздачи.
     ======================================================= */

  const lobby =
    $$("lobby");


  let chosenSeats =
    AcidRules.MIN_SEATS;


  /*
    Живых игроков пока всегда один. Значение уже участвует
    в расчёте лимита, поэтому мультиплееру останется только
    его выставить.
  */
  let chosenHumans = 1;


  function paintLobby() {

    document
      .querySelectorAll(".seatPick")
      .forEach(button =>
        button.classList.toggle(
          "chosen",
          Number(button.dataset.seats) ===
            chosenSeats
        )
      );


    const toggle =
      $$("clockToggle");

    toggle
      ?.classList
      .toggle("on", clockOff);

    toggle
      ?.setAttribute(
        "aria-pressed",
        String(clockOff)
      );


    const note =
      $$("lobbyNote");

    if (note) {

      note.textContent =
        clockOff
          ? "БЕЗ ЧАСОВ — ДО ПОСЛЕДНЕЙ КАРТЫ"
          : `ТАЙМЕР ${
              AcidRules.formatClock(
                AcidRules.matchLimitFor(
                  chosenSeats,
                  chosenHumans
                )
              )
            } · ПОТОМ СЧИТАЕМ ОЧКИ`;
    }
  }


  function openLobby() {

    chosenSeats =
      Math.max(
        AcidRules.MIN_SEATS,
        seatCount() || AcidRules.MIN_SEATS
      );

    stopClock();

    paintLobby();

    lobby?.classList.remove("hidden");
  }


  function closeLobby() {
    lobby?.classList.add("hidden");
  }


  document
    .querySelectorAll(".seatPick")
    .forEach(button =>
      button.addEventListener(
        "click",
        () => {

          chosenSeats =
            Number(button.dataset.seats);

          AcidSound.play("card");

          paintLobby();
        }
      )
    );


  $$("clockToggle")
    ?.addEventListener(
      "click",
      () => {

        clockOff = !clockOff;

        AcidSound.play("draw");

        paintLobby();
      }
    );


  $$("lobbyStart")
    ?.addEventListener(
      "click",
      () => {

        tableSize = chosenSeats;

        closeLobby();

        $$("endScreen")
          ?.classList
          .add("hidden");

        startGame();
      }
    );


  $$("tableButton")
    ?.addEventListener(
      "click",
      openLobby
    );


  /* =======================================================
     СТАРТ
     ======================================================= */

  openLobby();


  /*
    Ручка для отладки. Имя AcidMatch занято редьюсером
    партии в src/match.js.
  */
  window.AcidClock = {
    clock,
    startClock,
    stopClock,

    /*
      Подогнать часы под серверные: в комнате время
      считает сервер, клиент только рисует.
    */
    syncFrom(payload) {

      if (!payload || payload.limit === null) {

        clock.disable();

        paintClock(clock.advance(0));

        return;
      }

      clock.limit = payload.limit;
      clock.elapsed = payload.elapsed || 0;
      clock.running = true;
      clock.expired = false;

      lastTick = performance.now();

      clearInterval(tickTimer);

      tickTimer = setInterval(tick, 250);

      paintClock(clock.advance(0));
    },

    disableClock() {

      clockOff = true;

      clock.disable();

      paintClock(clock.advance(0));
    },

    enableClock() {

      clockOff = false;

      startClock();
    },

    get off() {
      return clockOff;
    },

    set off(value) {
      clockOff = Boolean(value);
    }
  };

})();
