"use strict";

/* =========================================================
   ACID UNO v8
   iPhone drag engine + faster bot + reaction intercept
   ========================================================= */

(() => {

  const sleepV8 = ms =>
    new Promise(resolve => setTimeout(resolve, ms));

  const clampV8 = (v, min, max) =>
    Math.max(min, Math.min(max, v));


  /* =======================================================
     SETTINGS
     ======================================================= */

  const V8 = {
    dragThreshold: 6,
    fingerLift: 38,

    botThinkMin: 120,
    botThinkMax: 260,

    botChooseMin: 70,
    botChooseMax: 150,

    botDefendMin: 90,
    botDefendMax: 180,

    botDrawPause: 55,

    /*
      Перехват специально медленнее.

      Центр ~425 мс.
      Разброс нужен, чтобы бот
      не выглядел таймером.
    */

    interceptMin: 340,
    interceptMax: 510,

    /*
      Вероятность того, что бот вообще
      попытается сделать Перехват,
      если у него есть дубль.
    */

    interceptChance: 0.82
  };


  function randomBetween(min, max) {
    return (
      min +
      Math.random() *
      (max - min)
    );
  }


  /* =======================================================
     SAVE ORIGINAL FUNCTIONS
     ======================================================= */

  const originalRenderHand =
    renderHand;

  const originalBotPlay =
    botPlay;


  /* =======================================================
     V8 DRAG STATE
     ======================================================= */

  let dragV8 = null;


  /* =======================================================
     HAND RENDER
     ======================================================= */

  renderHand = function () {

    if (dragV8) {
      return;
    }

    const hand = $("hand");

    hand.innerHTML = "";

    player.forEach(
      (card, index) => {

        const el =
          document.createElement(
            "div"
          );

        el.className =
          `handCard ${card.color}`;

        const playable =
          (
            turn === "player" &&
            canPlay(card)
          ) ||
          (
            turn === "bot" &&
            canIntercept(card)
          );

        if (playable) {
          el.classList.add(
            "playable"
          );
        }

        el.innerHTML = `
          <div class="value">
            ${cardLabel(card.value)}
          </div>
        `;

        const pos =
          fanPosition(
            index,
            player.length
          );

        el.style.setProperty(
          "--x",
          `${pos.x}px`
        );

        el.style.setProperty(
          "--y",
          `${pos.y}px`
        );

        el.style.setProperty(
          "--rot",
          `${pos.rot}deg`
        );

        el.style.setProperty(
          "--scale",
          pos.scale
        );

        el.style.zIndex =
          String(index + 1);

        el.dataset.cardId =
          String(card.id);

        el.style.touchAction =
          "none";

        el.addEventListener(
          "pointerdown",
          event =>
            beginDragV8(
              event,
              card.id
            )
        );

        hand.appendChild(el);
      }
    );
  };


  /* =======================================================
     FIND CARD
     ======================================================= */

  function getCardElementV8(
    cardId
  ) {
    return document.querySelector(
      `.handCard[data-card-id="${cardId}"]`
    );
  }


  /* =======================================================
     DRAG START
     ======================================================= */

  function beginDragV8(
    event,
    cardId
  ) {

    if (
      gameOver ||
      actionBusy ||
      AcidFX.isLocked() ||
      dragV8
    ) {
      return;
    }

    const index =
      playerIndex(cardId);

    if (index < 0) {
      return;
    }

    const card =
      player[index];

    /*
      Во время хода бота трогать
      разрешаем только потенциальный
      Перехват.
    */

    if (
      turn !== "player" &&
      !canIntercept(card)
    ) {
      return;
    }

    const el =
      getCardElementV8(
        cardId
      );

    if (!el) {
      return;
    }

    event.preventDefault();

    const rect =
      el.getBoundingClientRect();

    dragV8 = {
      pointerId:
        event.pointerId,

      cardId,
      card,
      index,
      element: el,

      startX:
        event.clientX,

      startY:
        event.clientY,

      lastX:
        event.clientX,

      lastY:
        event.clientY,

      grabX:
        event.clientX -
        rect.left,

      grabY:
        event.clientY -
        rect.top,

      originalRect: {
        left:
          rect.left,
        top:
          rect.top,
        width:
          rect.width,
        height:
          rect.height
      },

      started: false,
      inside: false,
      valid: false,

      originalParent:
        el.parentNode,

      originalNextSibling:
        el.nextSibling
    };


    window.addEventListener(
      "pointermove",
      moveDragV8,
      {
        passive: false
      }
    );

    window.addEventListener(
      "pointerup",
      endDragV8,
      {
        passive: false
      }
    );

    window.addEventListener(
      "pointercancel",
      cancelPointerV8,
      {
        passive: false
      }
    );
  }


  /* =======================================================
     ACTIVATE DRAG

     Ключевое отличие v8:

     карта реально переносится из #hand
     в #animationLayer.

     Теперь она живёт в viewport-системе,
     а не внутри трансформированного веера.
     ======================================================= */

  function activateDragV8() {

    if (
      !dragV8 ||
      dragV8.started
    ) {
      return;
    }

    const d =
      dragV8;

    const el =
      d.element;

    d.started = true;


    /*
      Сохраняем место в руке,
      чтобы веер визуально
      не схлопнулся.
    */

    const placeholder =
      document.createElement(
        "div"
      );

    placeholder.className =
      el.className +
      " drag-placeholder";

    placeholder.innerHTML =
      el.innerHTML;

    placeholder.style.cssText =
      el.style.cssText;

    placeholder.removeAttribute(
      "data-card-id"
    );

    d.placeholder =
      placeholder;

    d.originalParent.insertBefore(
      placeholder,
      el
    );


    /*
      Переносим настоящую карту
      на глобальный слой.
    */

    $("animationLayer")
      .appendChild(el);


    /*
      Полностью сбрасываем fan CSS.
    */

    el.classList.add(
      "dragging"
    );

    el.style.position =
      "fixed";

    el.style.left =
      "0px";

    el.style.top =
      "0px";

    el.style.bottom =
      "auto";

    el.style.margin =
      "0";

    el.style.width =
      `${d.originalRect.width}px`;

    el.style.height =
      `${d.originalRect.height}px`;

    el.style.zIndex =
      "10000";

    el.style.pointerEvents =
      "none";

    el.style.transformOrigin =
      "50% 50%";

    el.style.transition =
      "none";


    /*
      DOM уже перенесён.
      Теперь можно захватывать pointer.
    */

    try {
      el.setPointerCapture(
        d.pointerId
      );
    } catch (_) {}


    AcidFX.dragZone(
      true,
      false,
      true
    );


    positionDraggedCardV8(
      d.lastX,
      d.lastY,
      true
    );
  }


  /* =======================================================
     POSITION CARD
     ======================================================= */

  function positionDraggedCardV8(
    clientX,
    clientY,
    first = false
  ) {

    const d =
      dragV8;

    if (
      !d ||
      !d.started
    ) {
      return;
    }

    const el =
      d.element;


    /*
      Точка карты, которую схватил
      пользователь, остаётся у пальца.

      Карта только чуть поднята вверх,
      чтобы палец её не закрывал.
    */

    const left =
      clientX -
      d.grabX;

    const top =
      clientY -
      d.grabY -
      V8.fingerLift;


    /*
      Наклон зависит от скорости
      горизонтального движения.
    */

    const velocityX =
      first
        ? 0
        : clientX -
          d.lastX;

    const rotation =
      clampV8(
        velocityX * 0.55,
        -9,
        9
      );


    d.lastX =
      clientX;

    d.lastY =
      clientY;


    /*
      ВАЖНО:
      animationLayer находится в viewport,
      поэтому координаты напрямую совпадают
      с clientX/clientY.
    */

    el.style.transform = `
      translate3d(
        ${left}px,
        ${top}px,
        0
      )
      rotate(${rotation}deg)
      scale(1.07)
    `;


    /*
      Для hit-test используем те же
      viewport coordinates.
    */

    const rect = {
      left,
      top,

      width:
        d.originalRect.width,

      height:
        d.originalRect.height,

      right:
        left +
        d.originalRect.width,

      bottom:
        top +
        d.originalRect.height
    };


    const inside =
      cardCenterInsideDropZone(
        rect
      );


    const valid =
      turn === "player"
        ? canPlay(d.card)
        : canIntercept(d.card);


    d.inside =
      inside;

    d.valid =
      valid;


    el.classList.toggle(
      "drag-valid",
      inside && valid
    );

    el.classList.toggle(
      "drag-invalid",
      inside && !valid
    );


    AcidFX.dragZone(
      true,
      inside,
      valid
    );
  }


  /* =======================================================
     POINTER MOVE
     ======================================================= */

  function moveDragV8(
    event
  ) {

    const d =
      dragV8;

    if (
      !d ||
      event.pointerId !==
        d.pointerId
    ) {
      return;
    }

    event.preventDefault();


    const distance =
      Math.hypot(
        event.clientX -
          d.startX,

        event.clientY -
          d.startY
      );


    d.lastX =
      event.clientX;

    d.lastY =
      event.clientY;


    if (
      !d.started &&
      distance >=
        V8.dragThreshold
    ) {
      activateDragV8();
    }


    if (!d.started) {
      return;
    }


    positionDraggedCardV8(
      event.clientX,
      event.clientY
    );
  }


  /* =======================================================
     REMOVE LISTENERS
     ======================================================= */

  function removeDragListenersV8() {

    window.removeEventListener(
      "pointermove",
      moveDragV8
    );

    window.removeEventListener(
      "pointerup",
      endDragV8
    );

    window.removeEventListener(
      "pointercancel",
      cancelPointerV8
    );
  }


  /* =======================================================
     SIMPLE TAP
     ======================================================= */

  function cleanupTapV8() {

    removeDragListenersV8();

    AcidFX.dragZone(false);

    dragV8 = null;
  }


  /* =======================================================
     END DRAG
     ======================================================= */

  async function endDragV8(
    event
  ) {

    const d =
      dragV8;

    if (
      !d ||
      event.pointerId !==
        d.pointerId
    ) {
      return;
    }

    event.preventDefault();

    removeDragListenersV8();


    if (!d.started) {
      cleanupTapV8();
      return;
    }


    /*
      Реальная текущая геометрия
      карты на animationLayer.
    */

    const rect =
      d.element
        .getBoundingClientRect();

    const releaseRect = {
      left:
        rect.left,

      top:
        rect.top,

      width:
        rect.width,

      height:
        rect.height
    };


    /*
      SUCCESS
    */

    if (
      d.inside &&
      d.valid
    ) {

      AcidFX.dragZone(false);


      /*
        Удаляем placeholder.
      */

      d.placeholder?.remove();


      /*
        Исходный drag element
        больше не нужен:
        finishPlayerDrop создаст
        свою flyingCard.
      */

      d.element.remove();

      const cardId =
        d.cardId;

      const card =
        d.card;

      const intercept =
        turn !== "player";


      dragV8 = null;


      /*
        WILD
      */

      if (
        card.color === "wild"
      ) {

        pendingWild = {
          cardId,
          intercept,
          releasedRect:
            releaseRect
        };

        renderHand();

        $("colorPicker")
          .classList
          .remove("hidden");

        return;
      }


      /*
        PLAYER INTERCEPT
      */

      if (intercept) {

        setBusy(true);

        await AcidFX.intercept(
          "player"
        );

        turn = "player";

        setBusy(false);
      }


      await playerPlay(
        cardId,
        null,
        intercept,
        releaseRect
      );

      return;
    }


    /*
      FAILED DROP
    */

    await returnCardV8(d);
  }


  /* =======================================================
     RETURN CARD
     ======================================================= */

  async function returnCardV8(
    d
  ) {

    AcidFX.dragZone(false);


    const el =
      d.element;


    el.classList.remove(
      "drag-valid",
      "drag-invalid"
    );


    const invalid =
      d.inside &&
      !d.valid;


    if (invalid) {

      AcidFX.status(
        drawPenalty > 0
          ? `ШТРАФ +${drawPenalty}: ОТБЕЙ ИЛИ ЗАБЕРИ`
          : "ЭТА КАРТА НЕ ПОДХОДИТ"
      );
    }


    /*
      На animationLayer координаты
      исходного места тоже viewport,
      поэтому возврат простой.
    */

    el.style.transition = `
      transform
      .42s
      cubic-bezier(.18,.86,.24,1.05),
      filter .28s ease
    `;


    el.style.transform = `
      translate3d(
        ${d.originalRect.left}px,
        ${d.originalRect.top}px,
        0
      )
      rotate(0deg)
      scale(1)
    `;


    await sleepV8(430);


    el.remove();

    d.placeholder?.remove();

    dragV8 = null;


    renderHand();
  }


  /* =======================================================
     POINTER CANCEL
     ======================================================= */

  async function cancelPointerV8(
    event
  ) {

    const d =
      dragV8;

    if (!d) {
      return;
    }

    if (
      event.pointerId !==
      d.pointerId
    ) {
      return;
    }

    removeDragListenersV8();


    if (!d.started) {
      cleanupTapV8();
      return;
    }


    await returnCardV8(d);
  }


  /* =======================================================
     REPLACE OLD DRAG API

     Старые обработчики уже не будут
     создаваться, потому что renderHand
     заменён выше.
     ======================================================= */

  beginDrag =
    beginDragV8;


  /* =======================================================
     BOT TIMING
     ======================================================= */

  botTurn = async function () {

    if (
      gameOver ||
      turn !== "bot" ||
      unavailable()
    ) {
      return;
    }


    setBusy(true);


    /* =====================================================
       BOT INTERCEPT

       Проверяем ДО обычного think delay.

       Поэтому Перехват ощущается
       реакцией, а не частью хода.
       ===================================================== */

    const interceptIndex =
      botInterceptIndex();


    if (
      interceptIndex !== -1 &&
      Math.random() <
        V8.interceptChance
    ) {

      AcidFX.status(
        "БОТ ЗАМЕТИЛ ПЕРЕХВАТ..."
      );


      const reaction =
        randomBetween(
          V8.interceptMin,
          V8.interceptMax
        );


      await sleepV8(
        reaction
      );


      /*
        За время реакции ситуация
        могла измениться.

        Например, игрок сам сделал
        Перехват.
      */

      if (
        gameOver ||
        turn !== "bot"
      ) {
        setBusy(false);
        return;
      }


      const freshIndex =
        botInterceptIndex();


      if (
        freshIndex !== -1
      ) {

        await AcidFX.intercept(
          "bot"
        );


        await sleepV8(70);


        await botPlay(
          freshIndex,
          true
        );


        setBusy(false);

        return;
      }
    }


    /* =====================================================
       NORMAL THINKING

       Теперь быстро.
       ===================================================== */

    AcidFX.status(
      "БОТ ДУМАЕТ..."
    );


    await sleepV8(
      randomBetween(
        V8.botThinkMin,
        V8.botThinkMax
      )
    );


    /* =====================================================
       PENALTY
       ===================================================== */

    if (
      drawPenalty > 0
    ) {

      const defense =
        botPlayableIndexes();


      if (
        defense.length > 0
      ) {

        AcidFX.status(
          "БОТ ОТБИВАЕТСЯ"
        );


        await sleepV8(
          randomBetween(
            V8.botDefendMin,
            V8.botDefendMax
          )
        );


        const chosen =
          botChoose(
            defense
          );


        await botPlay(
          chosen,
          false
        );


        setBusy(false);

        return;
      }


      /*
        Забирает штраф.
      */

      const amount =
        drawPenalty;


      const cards =
        takeMany(
          amount
        );


      AcidFX.status(
        `БОТ ЗАБИРАЕТ +${cards.length}`
      );


      await AcidFX.penalty(
        amount
      );


      await AcidFX.drawSequence(
        cards,
        "bot",

        async card => {

          bot.push(card);

          render();
        }
      );


      drawPenalty = 0;
      penaltyType = null;


      render();


      await sleepV8(100);


      turn =
        "player";


      AcidFX.status(
        "ТВОЙ ХОД"
      );


      await AcidFX.turn(
        "player"
      );


      setBusy(false);

      return;
    }


    /* =====================================================
       NORMAL PLAY
       ===================================================== */

    let playable =
      botPlayableIndexes();


    /* =====================================================
       DRAW UNTIL PLAYABLE
       ===================================================== */

    if (
      playable.length === 0
    ) {

      AcidFX.status(
        "БОТ ДОБИРАЕТ..."
      );


      await sleepV8(80);


      let found =
        -1;

      let safety =
        0;


      while (
        found === -1 &&
        safety < 150
      ) {

        safety++;


        const card =
          takeRaw();


        if (!card) {
          break;
        }


        await AcidFX.drawCard(
          card,
          "bot"
        );


        bot.push(card);


        render();


        if (
          normalPlayable(
            card
          )
        ) {

          found =
            bot.length - 1;
        }


        await sleepV8(
          V8.botDrawPause
        );
      }


      if (
        found !== -1
      ) {

        playable = [
          found
        ];
      }
    }


    /* =====================================================
       NOTHING FOUND
       ===================================================== */

    if (
      playable.length === 0
    ) {

      turn =
        "player";


      AcidFX.status(
        "ТВОЙ ХОД"
      );


      await AcidFX.turn(
        "player"
      );


      setBusy(false);

      return;
    }


    /* =====================================================
       CHOOSE
       ===================================================== */

    await sleepV8(
      randomBetween(
        V8.botChooseMin,
        V8.botChooseMax
      )
    );


    const chosen =
      botChoose(
        playable
      );


    await botPlay(
      chosen,
      false
    );


    setBusy(false);
  };


  /* =======================================================
     FASTER BOT PLAY
     ======================================================= */

  botPlay = async function (
    index,
    intercept
  ) {

    const card =
      bot[index];


    if (!card) {
      return;
    }


    let chosenColor =
      null;


    if (
      card.color === "wild"
    ) {

      chosenColor =
        bestBotColor(
          index
        );
    }


    AcidFX.status(
      intercept
        ? "БОТ ПЕРЕХВАТЫВАЕТ"
        : "БОТ ХОДИТ"
    );


    /*
      Обычный ход почти сразу.
      Перехват уже получил свою
      реакционную задержку выше.
    */

    await sleepV8(
      intercept
        ? 65
        : 55
    );


    await AcidFX.playBotCard(
      card
    );


    bot.splice(
      index,
      1
    );


    applyCardState(
      card,
      chosenColor
    );


    render();


    await animateCardEffect(
      card,
      chosenColor
    );


    if (
      bot.length === 0
    ) {

      finish(false);

      return;
    }


    /* =====================================================
       SKIP / REVERSE
       ===================================================== */

    if (
      card.value === "skip" ||
      card.value === "reverse"
    ) {

      turn =
        "bot";


      AcidFX.status(
        card.value === "skip"
          ? "ТВОЙ ХОД ПРОПУЩЕН"
          : "БОТ ХОДИТ ЕЩЁ"
      );


      await AcidFX.turn(
        "bot"
      );


      /*
        Было 720 мс.
      */

      await sleepV8(180);


      setBusy(false);


      botTurn();

      return;
    }


    /* =====================================================
       PLAYER TURN
       ===================================================== */

    turn =
      "player";


    render();


    if (
      drawPenalty > 0
    ) {

      AcidFX.status(
        `ШТРАФ +${drawPenalty} — ОТБЕЙ ИЛИ ЗАБЕРИ`
      );

    } else if (
      intercept
    ) {

      AcidFX.status(
        "БОТ ПЕРЕХВАТИЛ — ТВОЙ ХОД"
      );

    } else {

      AcidFX.status(
        "ТВОЙ ХОД"
      );
    }


    await AcidFX.turn(
      "player"
    );
  };


  /* =======================================================
     CANCEL OLD DRAG ON RESTART
     ======================================================= */

  const oldStartGame =
    startGame;


  startGame = function () {

    if (dragV8) {

      removeDragListenersV8();

      dragV8.element?.remove();

      dragV8.placeholder?.remove();

      dragV8 = null;

      AcidFX.dragZone(
        false
      );
    }


    oldStartGame();


    /*
      oldStartGame вызвал старый render,
      но renderHand уже заменён v8.
    */
  };


  /* =======================================================
     RESIZE
     ======================================================= */

  window.addEventListener(
    "resize",
    () => {

      if (!dragV8) {
        return;
      }


      removeDragListenersV8();


      dragV8.element?.remove();

      dragV8.placeholder?.remove();


      dragV8 = null;


      AcidFX.dragZone(
        false
      );


      renderHand();
    }
  );


  /* =======================================================
     INITIAL RE-RENDER

     game.js уже успел вызвать startGame()
     до загрузки этого файла.

     Поэтому перестраиваем руку один раз,
     чтобы она получила v8 listeners.
     ======================================================= */

  renderHand();


  console.log(
    "ACID UNO v8 loaded"
  );

})();