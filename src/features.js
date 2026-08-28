"use strict";

/* =========================================================
   ACID UNO — FEATURE LAYER

   Слой поверх game.js и v9.1.js. Ничего не переписывает,
   а оборачивает уже существующие глобальные функции:

     render           -> аура активного цвета, счётчик кластера
     applyCardState   -> звук выкладки, разворота, штрафа
     takeRaw          -> звук добора
     startGame        -> перезапуск часов партии
     finish           -> звук итога

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


  /*
    UNO! — вешаем отдельным слушателем, чтобы не лезть
    внутрь обработчика v9.1.
  */
  $$("unoButton")
    ?.addEventListener(
      "click",
      () => {

        if (
          !gameOver &&
          turn === "player" &&
          player.length === 2
        ) {
          AcidSound.play("uno");
        }
      }
    );


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
     ======================================================= */

  const baseApplyCardState = applyCardState;

  applyCardState = function (card, chosenColor) {

    const before = drawPenalty;

    baseApplyCardState(card, chosenColor);

    if (card.value === "reverse") {
      AcidSound.play("reverse");

    } else {
      AcidSound.play("card");
    }

    if (drawPenalty > before) {
      AcidSound.play("penalty");
    }
  };


  /*
    Добор звучит один раз на серию: при штрафе +6 не нужно
    шесть одинаковых щелчков подряд.
  */
  let lastDrawSound = 0;

  const baseTakeRaw = takeRaw;

  takeRaw = function () {

    const card = baseTakeRaw();

    const now = performance.now();

    if (
      card &&
      now - lastDrawSound > 110
    ) {
      lastDrawSound = now;

      AcidSound.play("draw");
    }

    return card;
  };


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

    if (snapshot.expired) {
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

    gameOver = true;

    stopClock();


    /*
      Кластер, висящий на столе в момент гонга, сначала
      уходит тому, кто обязан был его забрать. Иначе можно
      было бы бросить +4 на последней секунде и выиграть
      по очкам, ничего не заплатив.
    */
    if (drawPenalty > 0) {

      seats[activeSeat].hand.push(
        ...takeMany(drawPenalty)
      );

      if (activeSeat === 0) {
        AcidRules.sortHand(player);
      }

      drawPenalty = 0;
      penaltyType = null;
    }


    const hands = {};

    seats.forEach(seat => {
      hands[seat.index] = seat.hand;
    });


    const outcome =
      AcidRules.timeoutResult(hands);


    const leaders =
      outcome.leaders.map(Number);


    const points =
      seats.map(
        seat =>
          AcidRules.handPoints(seat.hand)
      );


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
