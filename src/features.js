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

  function renderScore(points, playerWon) {

    const box = $$("endScore");

    if (!box) {
      return;
    }

    box.innerHTML = `
      <div class="endScoreRow${playerWon ? "" : " lost"}">
        <span>ТЫ</span>
        <b>${points.player}</b>
      </div>

      <div class="endScoreRow${playerWon ? " lost" : ""}">
        <span>ACID BOT</span>
        <b>${points.bot}</b>
      </div>
    `;

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

      const cards =
        takeMany(drawPenalty);

      const hand =
        turn === "player"
          ? player
          : bot;

      hand.push(...cards);

      if (turn === "player") {
        AcidRules.sortHand(player);
      }

      drawPenalty = 0;
      penaltyType = null;
    }


    const points = {
      player:
        AcidRules.handPoints(player),

      bot:
        AcidRules.handPoints(bot)
    };


    const outcome =
      AcidRules.timeoutResult({
        player,
        bot
      });


    render();

    AcidFX.status("ВРЕМЯ ВЫШЛО");

    await AcidFX.flash(
      outcome.winner === "player"
        ? "green"
        : "purple"
    );

    AcidSound.play(
      outcome.winner === "player"
        ? "win"
        : "lose"
    );

    $$("endText").textContent =
      outcome.draw
        ? "ВРЕМЯ ВЫШЛО — НИЧЬЯ"
        : outcome.winner === "player"
          ? "ВРЕМЯ ВЫШЛО — ТЫ ВЫИГРАЛ"
          : "ВРЕМЯ ВЫШЛО — БОТ ВЫИГРАЛ";

    renderScore(
      points,
      outcome.winner === "player"
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
     СТАРТ
     ======================================================= */

  startClock();

  render();


  /*
    Ручка для отладки и будущего режима на 2–7 игроков:
    живой стол сможет выключить часы единогласно.
  */
  window.AcidMatch = {
    clock,
    startClock,
    stopClock,

    disableClock() {
      clock.disable();

      paintClock(clock.advance(0));
    }
  };

})();
