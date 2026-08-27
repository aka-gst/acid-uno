"use strict";

/* =========================================================
   ACID UNO v7 — ANIMATION ENGINE
   Smooth motion / iPhone / drag compatible
   ========================================================= */

const AcidFX = (() => {

  const $ = id => document.getElementById(id);

  const sleep = ms =>
    new Promise(resolve => setTimeout(resolve, ms));

  let locked = false;

  function isLocked() {
    return locked;
  }

  function setLocked(value) {
    locked = value;
  }


  /* =======================================================
     GEOMETRY
     ======================================================= */

  function rectCenter(rect) {
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  }

  function discardRect() {
    const el = $("discard");

    if (!el) return null;

    return el.getBoundingClientRect();
  }

  function deckRect() {
    const el = $("deck");

    if (!el) return null;

    return el.getBoundingClientRect();
  }

  function botRect() {
    const el = $("botCards");

    if (!el) return null;

    return el.getBoundingClientRect();
  }

  function handRect() {
    const el = $("hand");

    if (!el) return null;

    return el.getBoundingClientRect();
  }


  /* =======================================================
     CARD HTML
     ======================================================= */

  function label(value) {
    switch (value) {
      case "skip":
        return "⊘";

      case "reverse":
        return "↻";

      case "wild":
        return "★";

      default:
        return value;
    }
  }

  function createFlyingCard(card) {
    const el = document.createElement("div");

    el.className =
      `flyingCard ${card.color}`;

    el.innerHTML = `
      <div class="value">
        ${label(card.value)}
      </div>
    `;

    $("animationLayer")
      .appendChild(el);

    return el;
  }


  /* =======================================================
     PLACE ELEMENT FROM RECT
     ======================================================= */

  function placeFromRect(
    element,
    rect,
    scale = 1,
    rotation = 0
  ) {
    element.style.left =
      `${rect.left}px`;

    element.style.top =
      `${rect.top}px`;

    element.style.width =
      `${rect.width}px`;

    element.style.height =
      `${rect.height}px`;

    element.style.transform =
      `translate3d(0,0,0)
       rotate(${rotation}deg)
       scale(${scale})`;
  }


  /* =======================================================
     TARGET TRANSFORM
     ======================================================= */

  function transformToRect(
    sourceRect,
    targetRect,
    rotation = 0,
    scale = 1
  ) {
    const source =
      rectCenter(sourceRect);

    const target =
      rectCenter(targetRect);

    const x =
      target.x - source.x;

    const y =
      target.y - source.y;

    return `
      translate3d(
        ${x}px,
        ${y}px,
        0
      )
      rotate(${rotation}deg)
      scale(${scale})
    `;
  }


  /* =======================================================
     STATUS
     ======================================================= */

  function status(text) {
    const el = $("status");

    if (!el) return;

    el.textContent = text;

    el.animate(
      [
        {
          opacity: .55,
          transform: "scale(.97)"
        },
        {
          opacity: 1,
          transform: "scale(1)"
        }
      ],
      {
        duration: 430,
        easing:
          "cubic-bezier(.16,.8,.22,1)"
      }
    );
  }


  /* =======================================================
     TURN
     ======================================================= */

  async function turn(side) {
    const playerGlow =
      $("playerTurnGlow");

    const botGlow =
      $("botTurnGlow");

    const botAvatar =
      document.querySelector(
        ".botAvatar"
      );

    const botCards =
      $("botCards");

    if (side === "player") {
      botGlow?.classList.remove(
        "active"
      );

      botAvatar?.classList.remove(
        "thinking"
      );

      botCards?.classList.remove(
        "bot-active"
      );

      await sleep(170);

      playerGlow?.classList.add(
        "active"
      );
    } else {
      playerGlow?.classList.remove(
        "active"
      );

      await sleep(170);

      botGlow?.classList.add(
        "active"
      );

      botAvatar?.classList.add(
        "thinking"
      );

      botCards?.classList.add(
        "bot-active"
      );
    }

    await sleep(380);
  }


  /* =======================================================
     TABLE IMPACT
     ======================================================= */

  function tableImpact() {
    const table =
      document.querySelector(
        ".tableInner"
      );

    if (!table) return;

    table.classList.remove(
      "card-impact"
    );

    void table.offsetWidth;

    table.classList.add(
      "card-impact"
    );

    setTimeout(
      () =>
        table.classList.remove(
          "card-impact"
        ),
      760
    );
  }


  /* =======================================================
     IMPACT RING
     ======================================================= */

  function impact() {
    const ring =
      $("impactRing");

    const discard =
      discardRect();

    if (!ring || !discard) return;

    const center =
      rectCenter(discard);

    ring.style.left =
      `${center.x}px`;

    ring.style.top =
      `${center.y}px`;

    ring.classList.remove(
      "hidden",
      "active"
    );

    void ring.offsetWidth;

    ring.classList.add(
      "active"
    );

    setTimeout(() => {
      ring.classList.remove(
        "active"
      );

      ring.classList.add(
        "hidden"
      );
    }, 950);
  }


  /* =======================================================
     FLASH
     ======================================================= */

  async function flash(color) {
    const el =
      $("screenFlash");

    if (!el) return;

    const className =
      `flash-${color}`;

    el.classList.remove(
      "flash-green",
      "flash-purple",
      "flash-red",
      "flash-cyan"
    );

    void el.offsetWidth;

    el.classList.add(
      className
    );

    await sleep(720);

    el.classList.remove(
      className
    );
  }


  /* =======================================================
     BANNER
     ======================================================= */

  async function banner(
    text,
    icon = "✦"
  ) {
    const root =
      $("actionBanner");

    const textEl =
      $("actionBannerText");

    const iconEl =
      $("actionBannerIcon");

    if (
      !root ||
      !textEl ||
      !iconEl
    ) {
      return;
    }

    textEl.textContent =
      text;

    iconEl.textContent =
      icon;

    root.classList.remove(
      "hidden",
      "show"
    );

    void root.offsetWidth;

    root.classList.add(
      "show"
    );

    await sleep(1080);

    root.classList.remove(
      "show"
    );

    root.classList.add(
      "hidden"
    );
  }


  /* =======================================================
     PLAYER CARD

     Используется для обычного хода,
     если карта уже отпущена игроком.

     В v7 drag-система сможет передать
     сюда реальную стартовую геометрию.
     ======================================================= */

  async function playPlayerCard(
    card,
    sourceElement,
    sourceRectOverride = null
  ) {
    if (!card) return;

    setLocked(true);

    const target =
      discardRect();

    if (!target) {
      setLocked(false);
      return;
    }

    let source = sourceRectOverride;

    if (
      !source &&
      sourceElement
    ) {
      source =
        sourceElement
          .getBoundingClientRect();
    }

    if (!source) {
      source = {
        left:
          window.innerWidth / 2 -
          42,

        top:
          window.innerHeight -
          150,

        width: 84,
        height: 126
      };
    }

    const flying =
      createFlyingCard(card);

    flying.classList.add(
      "player-flight"
    );

    placeFromRect(
      flying,
      source
    );

    if (sourceElement) {
      sourceElement.style.opacity =
        "0";
    }

    /*
      Один frame для фиксации
      начальной позиции.
    */

    await new Promise(resolve =>
      requestAnimationFrame(() =>
        requestAnimationFrame(
          resolve
        )
      )
    );

    const targetRotation =
      2 + Math.random() * 5;

    flying.style.transform =
      transformToRect(
        source,
        target,
        targetRotation,
        1
      );

    /*
      Не мгновенное исчезновение.
      Карта физически доезжает.
    */

    await sleep(610);

    tableImpact();
    impact();

    await sleep(130);

    flying.style.opacity =
      "0";

    await sleep(180);

    flying.remove();

    setLocked(false);
  }


  /* =======================================================
     PLAYER DROP FINISH

     Главный метод для drag-and-drop.

     Карта уже находится под пальцем.
     После отпускания она лишь плавно
     доводится до discard.
     ======================================================= */

  async function finishPlayerDrop(
    card,
    startRect
  ) {
    if (!card || !startRect) {
      return;
    }

    setLocked(true);

    const target =
      discardRect();

    if (!target) {
      setLocked(false);
      return;
    }

    const flying =
      createFlyingCard(card);

    flying.classList.add(
      "player-flight"
    );

    placeFromRect(
      flying,
      startRect
    );

    await new Promise(resolve =>
      requestAnimationFrame(() =>
        requestAnimationFrame(
          resolve
        )
      )
    );

    flying.style.transform =
      transformToRect(
        startRect,
        target,
        3,
        1
      );

    /*
      Последняя часть пути короче,
      поэтому чуть быстрее полного
      полёта из руки.
    */

    await sleep(520);

    tableImpact();
    impact();

    flying.classList.add(
      "landing"
    );

    await sleep(190);

    flying.style.opacity =
      "0";

    await sleep(190);

    flying.remove();

    setLocked(false);
  }


  /* =======================================================
     BOT CARD
     ======================================================= */

  async function playBotCard(card) {
    if (!card) return;

    setLocked(true);

    const bot =
      botRect();

    const target =
      discardRect();

    if (!bot || !target) {
      setLocked(false);
      return;
    }

    const source = {
      left:
        bot.left +
        bot.width / 2 -
        18,

      top:
        bot.top + 3,

      width: 36,
      height: 54
    };

    const flying =
      createFlyingCard(card);

    flying.classList.add(
      "bot-flight"
    );

    /*
      Сначала карта выглядит как
      маленькая карта из руки бота.
    */

    placeFromRect(
      flying,
      source,
      1,
      -4
    );

    await sleep(180);

    await new Promise(resolve =>
      requestAnimationFrame(() =>
        requestAnimationFrame(
          resolve
        )
      )
    );

    /*
      По пути карта увеличивается
      до нормального размера.
    */

    const sourceCenter =
      rectCenter(source);

    const targetCenter =
      rectCenter(target);

    const x =
      targetCenter.x -
      sourceCenter.x;

    const y =
      targetCenter.y -
      sourceCenter.y;

    const scale =
      target.width /
      source.width;

    flying.style.transform = `
      translate3d(
        ${x}px,
        ${y}px,
        0
      )
      rotate(4deg)
      scale(${scale})
    `;

    await sleep(690);

    tableImpact();
    impact();

    await sleep(150);

    flying.style.opacity =
      "0";

    await sleep(190);

    flying.remove();

    setLocked(false);
  }


  /* =======================================================
     DRAW CARD
     ======================================================= */

  async function drawCard(
    card,
    receiver
  ) {
    if (!card) return;

    const deck =
      deckRect();

    if (!deck) return;

    const flying =
      createFlyingCard(card);

    flying.classList.add(
      "draw-flight"
    );

    placeFromRect(
      flying,
      deck,
      1,
      -4
    );

    await sleep(90);

    await new Promise(resolve =>
      requestAnimationFrame(() =>
        requestAnimationFrame(
          resolve
        )
      )
    );

    let target;

    if (receiver === "player") {
      const hand =
        handRect();

      if (!hand) {
        flying.remove();
        return;
      }

      target = {
        left:
          hand.left +
          hand.width / 2 -
          35,

        top:
          hand.bottom - 75,

        width: 70,
        height: 105
      };
    } else {
      const bot =
        botRect();

      if (!bot) {
        flying.remove();
        return;
      }

      target = {
        left:
          bot.left +
          bot.width / 2 -
          18,

        top:
          bot.top + 5,

        width: 36,
        height: 54
      };
    }

    const sourceCenter =
      rectCenter(deck);

    const targetCenter =
      rectCenter(target);

    const x =
      targetCenter.x -
      sourceCenter.x;

    const y =
      targetCenter.y -
      sourceCenter.y;

    const scale =
      target.width /
      deck.width;

    flying.style.transform = `
      translate3d(
        ${x}px,
        ${y}px,
        0
      )
      rotate(
        ${receiver === "player"
          ? 7
          : -6}deg
      )
      scale(${scale})
    `;

    await sleep(610);

    flying.style.opacity =
      "0";

    await sleep(150);

    flying.remove();
  }


  /* =======================================================
     DRAW SEQUENCE
     ======================================================= */

  async function drawSequence(
    cards,
    receiver,
    onCard
  ) {
    setLocked(true);

    for (
      let i = 0;
      i < cards.length;
      i++
    ) {
      const card =
        cards[i];

      await drawCard(
        card,
        receiver
      );

      if (onCard) {
        await onCard(card);
      }

      /*
        Пауза между картами —
        теперь видно каждую отдельно.
      */

      await sleep(115);
    }

    setLocked(false);
  }


  /* =======================================================
     PENALTY
     ======================================================= */

  async function penalty(amount) {
    const el =
      $("penalty");

    if (el) {
      el.classList.remove(
        "penalty-hit"
      );

      void el.offsetWidth;

      el.classList.add(
        "penalty-hit"
      );
    }

    await Promise.all([
      banner(
        `+${amount}`,
        "⚡"
      ),

      flash("red")
    ]);

    await sleep(120);
  }


  /* =======================================================
     SPECIAL
     ======================================================= */

  async function special(type) {
    const game =
      $("game");

    game?.classList.remove(
      "special-effect"
    );

    void game?.offsetWidth;

    game?.classList.add(
      "special-effect"
    );

    if (type === "skip") {
      await banner(
        "ПРОПУСК",
        "⊘"
      );
    } else {
      await banner(
        "РАЗВОРОТ",
        "↻"
      );
    }

    game?.classList.remove(
      "special-effect"
    );
  }


  /* =======================================================
     WILD
     ======================================================= */

  async function wild(color) {
    const game =
      $("game");

    game?.classList.remove(
      "wild-burst"
    );

    void game?.offsetWidth;

    game?.classList.add(
      "wild-burst"
    );

    const names = {
      red: "КРАСНЫЙ",
      yellow: "ЖЁЛТЫЙ",
      green: "ЗЕЛЁНЫЙ",
      blue: "СИНИЙ"
    };

    await banner(
      names[color] || "WILD",
      "★"
    );

    await sleep(100);

    game?.classList.remove(
      "wild-burst"
    );
  }


  /* =======================================================
     ROBOT FINGER
     ======================================================= */

  async function robotFingerAtDiscard() {
    const finger =
      $("robotFinger");

    const target =
      discardRect();

    if (!finger || !target) {
      return;
    }

    const center =
      rectCenter(target);

    finger.style.left =
      `${center.x + 8}px`;

    finger.style.top =
      `${center.y - 55}px`;

    finger.classList.remove(
      "hidden",
      "robot-enter",
      "robot-tap",
      "robot-leave"
    );

    void finger.offsetWidth;

    finger.classList.add(
      "robot-enter"
    );

    await sleep(820);

    finger.classList.add(
      "robot-tap"
    );

    await sleep(480);

    finger.classList.remove(
      "robot-tap"
    );

    finger.classList.add(
      "robot-leave"
    );

    await sleep(650);

    finger.classList.add(
      "hidden"
    );

    finger.classList.remove(
      "robot-enter",
      "robot-leave"
    );
  }


  /* =======================================================
     INTERCEPT
     ======================================================= */

  async function intercept(side) {
    setLocked(true);

    if (side === "bot") {
      /*
        Сначала появляется рука,
        потом надпись.
      */

      await robotFingerAtDiscard();

      await banner(
        "ПЕРЕХВАТ",
        "✋"
      );
    } else {
      await Promise.all([
        banner(
          "ПЕРЕХВАТ",
          "⚡"
        ),

        flash("cyan")
      ]);
    }

    setLocked(false);
  }


  /* =======================================================
     DRAG FEEDBACK
     ======================================================= */

  function dragZone(
    active,
    inside = false,
    valid = true
  ) {
    const center =
      $("center");

    if (!center) return;

    center.classList.remove(
      "drop-ready",
      "drop-hover",
      "drop-invalid"
    );

    if (!active) {
      return;
    }

    center.classList.add(
      "drop-ready"
    );

    if (!inside) {
      return;
    }

    center.classList.add(
      valid
        ? "drop-hover"
        : "drop-invalid"
    );
  }


  /* =======================================================
     REJECT FEEDBACK
     ======================================================= */

  async function reject() {
    await flash("red");

    status(
      "ЭТУ КАРТУ НЕЛЬЗЯ ПОЛОЖИТЬ"
    );
  }


  /* =======================================================
     PUBLIC API
     ======================================================= */

  return {
    isLocked,

    status,
    turn,

    playPlayerCard,
    finishPlayerDrop,

    playBotCard,

    drawCard,
    drawSequence,

    penalty,
    special,
    wild,

    intercept,

    flash,

    dragZone,
    reject
  };

})();