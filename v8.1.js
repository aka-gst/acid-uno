"use strict";

/* =========================================================
   ACID UNO v8.1
   ---------------------------------------------------------
   • Player voluntary draw = exactly ONE card
   • Voluntary draw NEVER ends player's turn
   • Penalty draw still takes the whole penalty and ends turn
   • Bot draw cards stay FACE DOWN
   • Valid dragged card magnetically shrinks/snaps toward discard
   • Leaving drop zone restores normal drag size
   ========================================================= */

(() => {

  const sleep81 = ms =>
    new Promise(resolve => setTimeout(resolve, ms));

  const clamp81 = (v, min, max) =>
    Math.max(min, Math.min(max, v));


  /* =======================================================
     1. PLAYER DRAW RULES
     ======================================================= */

  playerDraw = async function () {

    /*
      v8 использует dragV8 внутри своего closure,
      поэтому напрямую его здесь не читаем.

      actionBusy / AcidFX lock достаточно,
      чтобы не запускать параллельное действие.
    */

    if (
      gameOver ||
      actionBusy ||
      AcidFX.isLocked() ||
      turn !== "player"
    ) {
      return;
    }


    setBusy(true);


    /* =====================================================
       PENALTY

       Это единственный случай, когда нажатие
       колоды забирает сразу несколько карт
       и после этого заканчивает ход игрока.
       ===================================================== */

    if (drawPenalty > 0) {

      const amount =
        drawPenalty;

      const cards =
        takeMany(amount);


      AcidFX.status(
        `ЗАБИРАЕШЬ +${cards.length}`
      );


      await AcidFX.penalty(
        amount
      );


      /*
        Штрафные карты показываем
        по одной, чтобы было понятно,
        сколько именно прилетело.
      */

      for (
        let i = 0;
        i < cards.length;
        i++
      ) {

        const card =
          cards[i];


        await AcidFX.drawCard(
          card,
          "player"
        );


        player.push(card);

        render();


        await sleep81(70);
      }


      drawPenalty = 0;
      penaltyType = null;


      render();


      /*
        Принял штраф -> ход окончен.
      */

      turn = "bot";


      AcidFX.status(
        "ХОД БОТА"
      );


      await AcidFX.turn(
        "bot"
      );


      setBusy(false);


      await sleep81(180);


      /*
        Проверяем очередь ещё раз.
        Это защищает от случайного запуска
        бота после изменения состояния.
      */

      if (
        !gameOver &&
        turn === "bot"
      ) {
        botTurn();
      }


      return;
    }


    /* =====================================================
       VOLUNTARY DRAW

       ВСЕГДА ровно одна карта.

       Неважно:
       • есть ли уже подходящая карта;
       • подходит ли только что взятая;
       • сколько раз игрок уже добирал.

       После этого игрок всё ещё ходит.
       ===================================================== */

    const card =
      takeRaw();


    if (!card) {

      AcidFX.status(
        "В КОЛОДЕ НЕТ КАРТ"
      );

      setBusy(false);

      return;
    }


    AcidFX.status(
      "БЕРЁШЬ КАРТУ"
    );


    await AcidFX.drawCard(
      card,
      "player"
    );


    player.push(card);


    /*
      Явно фиксируем очередь.

      Даже если где-то остался старый
      отложенный botTurn(), тот проверит
      turn !== "bot" и завершится.
    */

    turn = "player";


    render();


    await sleep81(100);


    AcidFX.status(
      player.some(canPlay)
        ? "ТВОЙ ХОД — МОЖНО СЫГРАТЬ ИЛИ ВЗЯТЬ ЕЩЁ"
        : "ТВОЙ ХОД — МОЖНО ВЗЯТЬ ЕЩЁ"
    );


    await AcidFX.turn(
      "player"
    );


    setBusy(false);
  };


  /* =======================================================
     2. REBIND DECK CLICK

     Старый game.js уже повесил listener
     с предыдущей playerDraw.

     В JS замена переменной playerDraw
     НЕ заменяет уже зарегистрированный
     function reference.

     Поэтому клонируем #deck:
     это удаляет старые listeners.
     Затем ставим новый.
     ======================================================= */

  function rebindDeck81() {

    const oldDeck =
      $("deck");


    if (!oldDeck) {
      return;
    }


    const newDeck =
      oldDeck.cloneNode(true);


    oldDeck.parentNode.replaceChild(
      newDeck,
      oldDeck
    );


    newDeck.addEventListener(
      "click",
      event => {

        event.preventDefault();

        playerDraw();
      }
    );
  }


  rebindDeck81();


  /* =======================================================
     3. BOT FACE-DOWN DRAW
     ======================================================= */

  function createBotBack81() {

    const el =
      document.createElement(
        "div"
      );


    /*
      Используем botCard, то есть ту же
      рубашку, которую уже видим
      в руке противника.
    */

    el.className =
      "botCard flyingBotBack81";


    el.style.position =
      "fixed";

    el.style.margin =
      "0";

    el.style.pointerEvents =
      "none";

    el.style.zIndex =
      "9000";

    el.style.transformOrigin =
      "50% 50%";

    el.style.willChange =
      "transform, opacity";


    return el;
  }


  async function botDrawFaceDown81() {

    const deckEl =
      $("deck");

    const botArea =
      $("botCards");

    const layer =
      $("animationLayer");


    if (
      !deckEl ||
      !botArea ||
      !layer
    ) {
      return;
    }


    const from =
      deckEl.getBoundingClientRect();

    const to =
      botArea.getBoundingClientRect();


    const el =
      createBotBack81();


    layer.appendChild(el);


    /*
      Стартовый размер примерно совпадает
      с верхней картой колоды.
    */

    el.style.left =
      `${from.left}px`;

    el.style.top =
      `${from.top}px`;

    el.style.width =
      `${from.width}px`;

    el.style.height =
      `${from.height}px`;

    el.style.opacity =
      "1";

    el.style.transform =
      "translate3d(0,0,0) rotate(-3deg) scale(1)";


    await new Promise(resolve =>
      requestAnimationFrame(() =>
        requestAnimationFrame(resolve)
      )
    );


    const fromX =
      from.left +
      from.width / 2;

    const fromY =
      from.top +
      from.height / 2;


    const toX =
      to.left +
      to.width / 2;

    const toY =
      to.top +
      to.height / 2;


    const dx =
      toX - fromX;

    const dy =
      toY - fromY;


    /*
      Карта у бота визуально меньше.
    */

    const targetWidth =
      Math.min(
        40,
        Math.max(
          30,
          to.width /
          Math.max(bot.length, 5)
        )
      );


    const scale =
      targetWidth /
      Math.max(from.width, 1);


    el.style.transition = `
      transform
        .42s
        cubic-bezier(.18,.72,.2,1),
      opacity
        .16s ease
    `;


    el.style.transform = `
      translate3d(
        ${dx}px,
        ${dy}px,
        0
      )
      rotate(7deg)
      scale(${scale})
    `;


    await sleep81(390);


    el.style.opacity =
      "0";


    await sleep81(100);


    el.remove();
  }


  /* =======================================================
     4. OVERRIDE BOT TURN

     Здесь сохраняем быстрые тайминги v8,
     но заменяем раскрытый AcidFX.drawCard()
     на botDrawFaceDown81().
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
       INTERCEPT

       Оставляем реакцию v8:
       340–510 ms.
       ===================================================== */

    const interceptIndex =
      botInterceptIndex();


    if (
      interceptIndex !== -1 &&
      Math.random() < .82
    ) {

      AcidFX.status(
        "БОТ ЗАМЕТИЛ ПЕРЕХВАТ..."
      );


      await sleep81(
        340 +
        Math.random() * 170
      );


      /*
        Ситуация могла измениться
        во время реакции.
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


        await sleep81(70);


        await botPlay(
          freshIndex,
          true
        );


        setBusy(false);

        return;
      }
    }


    /* =====================================================
       NORMAL THINK
       ===================================================== */

    AcidFX.status(
      "БОТ ДУМАЕТ..."
    );


    await sleep81(
      120 +
      Math.random() * 140
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


        await sleep81(
          90 +
          Math.random() * 90
        );


        await botPlay(
          botChoose(defense),
          false
        );


        setBusy(false);

        return;
      }


      /*
        Бот принимает штраф.
      */

      const amount =
        drawPenalty;


      const cards =
        takeMany(amount);


      AcidFX.status(
        `БОТ ЗАБИРАЕТ +${cards.length}`
      );


      await AcidFX.penalty(
        amount
      );


      /*
        Ключевое изменение:
        настоящие значения карт
        НЕ передаются визуальной анимации.
      */

      for (
        let i = 0;
        i < cards.length;
        i++
      ) {

        await botDrawFaceDown81();


        bot.push(
          cards[i]
        );


        render();


        await sleep81(55);
      }


      drawPenalty = 0;
      penaltyType = null;


      render();


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
       BOT DRAW UNTIL PLAYABLE

       Бот по нашим правилам продолжает
       искать карту до первой подходящей.

       Но игрок видит только рубашки.
       ===================================================== */

    if (
      playable.length === 0
    ) {

      AcidFX.status(
        "БОТ ДОБИРАЕТ..."
      );


      await sleep81(80);


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


        /*
          Сначала видим рубашку.
        */

        await botDrawFaceDown81();


        /*
          Только после прилёта настоящая
          карта добавляется во внутреннюю
          руку бота.
        */

        bot.push(card);


        render();


        if (
          normalPlayable(card)
        ) {

          found =
            bot.length - 1;
        }


        await sleep81(55);
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
       NO CARD
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
       CHOOSE CARD
       ===================================================== */

    await sleep81(
      70 +
      Math.random() * 80
    );


    /*
      Проверяем очередь ещё раз.
    */

    if (
      gameOver ||
      turn !== "bot"
    ) {

      setBusy(false);

      return;
    }


    await botPlay(
      botChoose(playable),
      false
    );


    setBusy(false);
  };


  /* =======================================================
     5. MAGNETIC DROP ZONE

     v8 держит dragV8 внутри closure,
     поэтому напрямую изменить его
     positionDraggedCardV8 нельзя.

     Вместо этого наблюдаем за реальной
     перетаскиваемой картой и применяем
     дополнительную визуальную геометрию
     через CSS variables + Web Animations.

     Важно: не вмешиваемся в hit-test v8.
     ======================================================= */

  let magnetFrame81 =
    null;

  let magnetCard81 =
    null;

  let magnetInside81 =
    false;


  function getDraggedCard81() {

    return document.querySelector(
      "#animationLayer .handCard.dragging"
    );
  }


  function getDiscardCard81() {

    return document.querySelector(
      "#discard .card"
    ) || $("discard");
  }


  function centers81(rect) {

    return {
      x:
        rect.left +
        rect.width / 2,

      y:
        rect.top +
        rect.height / 2
    };
  }


  function isDropZoneActive81() {

    const center =
      $("center");


    if (!center) {
      return false;
    }


    /*
      v8 уже выставляет эти классы
      на основании своей игровой логики.
    */

    return center.classList.contains(
      "drop-hover"
    );
  }


  function clearMagnet81(
    card
  ) {

    if (!card) {
      return;
    }


    card.style.removeProperty(
      "--magnet-scale"
    );


    card.style.filter =
      "";


    magnetInside81 =
      false;
  }


  function magnetLoop81() {

    const card =
      getDraggedCard81();


    /*
      Drag закончился.
    */

    if (!card) {

      if (magnetCard81) {
        clearMagnet81(
          magnetCard81
        );
      }


      magnetCard81 =
        null;


      magnetFrame81 =
        requestAnimationFrame(
          magnetLoop81
        );


      return;
    }


    magnetCard81 =
      card;


    const validInside =
      isDropZoneActive81();


    if (validInside) {

      const cardRect =
        card.getBoundingClientRect();

      const target =
        getDiscardCard81();


      if (target) {

        const targetRect =
          target.getBoundingClientRect();


        /*
          Вычисляем реальное отношение
          размера карты сброса к dragged card.
        */

        const scaleX =
          targetRect.width /
          Math.max(
            cardRect.width,
            1
          );


        const scaleY =
          targetRect.height /
          Math.max(
            cardRect.height,
            1
          );


        const targetScale =
          clamp81(
            Math.min(
              scaleX,
              scaleY
            ),
            .55,
            1
          );


        /*
          Здесь не заменяем transform,
          которым управляет v8.

          CSS scale() через отдельное свойство
          было бы идеально, но для старых iOS
          надёжнее использовать element.style.scale.
        */

        card.style.transition =
          magnetInside81
            ? "scale .10s ease-out, filter .12s ease"
            : "scale .19s cubic-bezier(.18,.8,.2,1), filter .15s ease";


        card.style.scale =
          String(
            targetScale
          );


        card.style.filter = `
          brightness(1.12)
          drop-shadow(
            0 0 13px
            rgba(183,255,36,.55)
          )
        `;


        magnetInside81 =
          true;
      }

    } else if (
      magnetInside81
    ) {

      /*
        Палец вышел из зоны:
        возвращаем исходный размер.
      */

      card.style.transition =
        "scale .16s cubic-bezier(.2,.75,.22,1), filter .12s ease";


      card.style.scale =
        "1";


      card.style.filter =
        "";


      magnetInside81 =
        false;
    }


    magnetFrame81 =
      requestAnimationFrame(
        magnetLoop81
      );
  }


  magnetLoop81();


  /* =======================================================
     6. EXTRA CSS
     ======================================================= */

  const style81 =
    document.createElement(
      "style"
    );


  style81.textContent = `

    /*
      Чтобы независимое CSS scale
      работало поверх transform v8.
    */

    #animationLayer .handCard.dragging {
      transform-origin: 50% 50%;
      will-change:
        transform,
        scale,
        filter;
    }


    /*
      Карта-призрак остаётся в веере,
      пока настоящая карта под пальцем.
      Делаем её почти невидимой.
    */

    .drag-placeholder {
      opacity: .12 !important;
      filter:
        saturate(.5)
        brightness(.6);
      pointer-events: none !important;
    }


    /*
      Дополнительный магнитный glow.
    */

    #center.drop-hover {
      filter:
        brightness(1.08)
        saturate(1.12);
    }


    /*
      Рубашка, летящая к боту.
    */

    .flyingBotBack81 {
      backface-visibility: hidden;
      -webkit-backface-visibility: hidden;
    }

  `;


  document.head.appendChild(
    style81
  );


  /* =======================================================
     7. STATUS
     ======================================================= */

  console.log(
    "ACID UNO v8.1 loaded"
  );


  AcidFX.status(
    turn === "player"
      ? "ТВОЙ ХОД"
      : "ХОД БОТА"
  );

})();