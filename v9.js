"use strict";

/* =========================================================
   ACID UNO v9
   Clean gameplay/drag layer.
   DO NOT load v8.js / v8.1.js / v8.2.js with this file.
   ========================================================= */

(() => {

  const V9 = {
    drag: null,
    drawLock: false,
    botRunning: false,

    playerUnoCalled: false,
    playerUnoVulnerable: false,
    playerUnoTimer: null,

    botUnoCalled: false,
    botUnoVulnerable: false,
    botUnoTimer: null,
    botCatchTimer: null
  };

  const wait9 = ms =>
    new Promise(resolve => setTimeout(resolve, ms));

  const randomBetween9 = (min, max) =>
    min + Math.random() * (max - min);


  /* =======================================================
     UI
     ======================================================= */

  function ensureV9UI() {

    document
      .querySelectorAll("#robotFinger,.robotFinger")
      .forEach(el => el.remove());

    if (!$("unoButton")) {
      const button = document.createElement("button");

      button.id = "unoButton";
      button.type = "button";
      button.textContent = "UNO!";

      document.body.appendChild(button);
    }

    if (!$("v9Burst")) {
      const burst = document.createElement("div");

      burst.id = "v9Burst";

      document.body.appendChild(burst);
    }
  }

  ensureV9UI();


  /* =======================================================
     BIG TEXT FX
     ======================================================= */

  let burstTimer9 = null;

  function burst9(text, type = "") {

    const el = $("v9Burst");

    if (!el) return;

    clearTimeout(burstTimer9);

    el.className = "";

    void el.offsetWidth;

    el.textContent = text;

    if (type) {
      el.classList.add(type);
    }

    el.classList.add("show");

    burstTimer9 = setTimeout(() => {
      el.className = "";
    }, 650);
  }


  /* =======================================================
     GEOMETRY
     ======================================================= */

  function rectCenter9(rect) {
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  }

  function discardTarget9() {

    const card =
      document.querySelector("#discard .card");

    const fallback =
      $("discard");

    const el = card || fallback;

    return el
      ? el.getBoundingClientRect()
      : null;
  }

  function centerHitRect9() {

    const center = $("center");

    if (!center) return null;

    const r = center.getBoundingClientRect();

    const padX = Math.max(18, r.width * .12);
    const padY = Math.max(18, r.height * .10);

    return {
      left: r.left - padX,
      right: r.right + padX,
      top: r.top - padY,
      bottom: r.bottom + padY
    };
  }

  function inside9(x, y, r) {
    return !!r &&
      x >= r.left &&
      x <= r.right &&
      y >= r.top &&
      y <= r.bottom;
  }


  /* =======================================================
     CARD PLAYABILITY HIGHLIGHT
     ======================================================= */

  function updatePlayableGlow9() {

    document
      .querySelectorAll("#hand .handCard")
      .forEach(el => {

        const id = Number(el.dataset.cardId);

        const card =
          player.find(c => c.id === id);

        if (!card) return;

        const playable =
          (
            turn === "player" &&
            canPlay(card)
          ) ||
          (
            turn === "bot" &&
            canIntercept(card)
          );

        el.classList.toggle(
          "v9-playable",
          playable
        );

        el.classList.toggle(
          "v9-unplayable",
          !playable
        );
      });
  }


  /* =======================================================
     SAME CARD VISUAL SIZE FOR BOT

     Bot remains face-down, but its physical cards use
     exactly the same base aspect ratio as player cards.
     ======================================================= */

  renderBot = function () {

    $("botCount").textContent =
      `${bot.length} КАРТ`;

    const area = $("botCards");

    if (!area) return;

    area.innerHTML = "";

    const visible =
      Math.min(bot.length, 24);

    const layout =
      getFanLayout(
        Math.max(visible, 1)
      );

    for (
      let i = 0;
      i < visible;
      i++
    ) {

      const el =
        document.createElement("div");

      el.className =
        "botCard v9-bot-card";

      const pos =
        fanPosition(
          i,
          visible
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
        String(i + 1);

      area.appendChild(el);
    }
  };


  /* =======================================================
     RENDER WRAPPER
     ======================================================= */

  const baseRender9 = render;

  render = function () {

    baseRender9();

    updatePlayableGlow9();

    syncUno9();
  };


  /* =======================================================
     FAST TURN INDICATOR

     Do not await AcidFX.turn's old ~550 ms animation.
     ======================================================= */

  function visualTurn9(side) {

    const playerGlow =
      $("playerTurnGlow");

    const botGlow =
      $("botTurnGlow");

    const botAvatar =
      document.querySelector(".botAvatar");

    const botCards =
      $("botCards");

    const playerTurn =
      side === "player";

    playerGlow?.classList.toggle(
      "active",
      playerTurn
    );

    botGlow?.classList.toggle(
      "active",
      !playerTurn
    );

    botAvatar?.classList.toggle(
      "thinking",
      !playerTurn
    );

    botCards?.classList.toggle(
      "bot-active",
      !playerTurn
    );
  }


  /* =======================================================
     HAND FLIP ANIMATION
     ======================================================= */

  function captureHand9() {

    const result = new Map();

    document
      .querySelectorAll(
        "#hand .handCard[data-card-id]"
      )
      .forEach(el => {

        const r =
          el.getBoundingClientRect();

        result.set(
          el.dataset.cardId,
          {
            x: r.left + r.width / 2,
            y: r.top + r.height / 2
          }
        );
      });

    return result;
  }

  function animateHandFrom9(oldPositions) {

    requestAnimationFrame(() => {

      document
        .querySelectorAll(
          "#hand .handCard[data-card-id]"
        )
        .forEach(el => {

          const old =
            oldPositions.get(
              el.dataset.cardId
            );

          if (!old) return;

          const r =
            el.getBoundingClientRect();

          const x =
            r.left + r.width / 2;

          const y =
            r.top + r.height / 2;

          const dx =
            old.x - x;

          const dy =
            old.y - y;

          if (
            Math.abs(dx) < 1 &&
            Math.abs(dy) < 1
          ) {
            return;
          }

          el.animate(
            [
              {
                translate:
                  `${dx}px ${dy}px`
              },
              {
                translate:
                  "0px 0px"
              }
            ],
            {
              duration: 230,
              easing:
                "cubic-bezier(.2,.82,.2,1)"
            }
          );
        });
    });
  }

  function renderAnimated9() {

    const old =
      captureHand9();

    render();

    animateHandFrom9(old);
  }


  /* =======================================================
     DRAG

     v9 owns the drag completely.
     ======================================================= */

  function removeV9DragListeners() {

    window.removeEventListener(
      "pointermove",
      moveDrag9
    );

    window.removeEventListener(
      "pointerup",
      endDrag9
    );

    window.removeEventListener(
      "pointercancel",
      endDrag9
    );
  }

  function beginV9Drag(event, cardId) {

    if (
      gameOver ||
      actionBusy ||
      V9.drag
    ) {
      return;
    }

    const index =
      playerIndex(cardId);

    if (index === -1) return;

    const card =
      player[index];

    if (
      turn !== "player" &&
      !canIntercept(card)
    ) {
      return;
    }

    const source =
      playerCardElement(cardId);

    if (!source) return;

    event.preventDefault();

    const rect =
      source.getBoundingClientRect();

    V9.drag = {
      pointerId: event.pointerId,
      cardId,
      card,
      index,
      source,

      startX: event.clientX,
      startY: event.clientY,

      pointerX: event.clientX,
      pointerY: event.clientY,

      offsetX:
        event.clientX - rect.left,

      offsetY:
        event.clientY - rect.top,

      originalRect: {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height
      },

      started: false,
      inside: false,
      valid: false,

      currentLeft: rect.left,
      currentTop: rect.top,

      magnetScale: 1
    };

    window.addEventListener(
      "pointermove",
      moveDrag9,
      { passive: false }
    );

    window.addEventListener(
      "pointerup",
      endDrag9,
      { passive: false }
    );

    window.addEventListener(
      "pointercancel",
      endDrag9,
      { passive: false }
    );
  }

  function activateV9Drag() {

    const d = V9.drag;

    if (!d || d.started) return;

    d.started = true;
    document
        .documentElement
        .classList
        .add("v91-action");

    const el = d.source;

    /*
      Move the actual card to animationLayer.

      This prevents it from being clipped by the hand
      and gives v9 one coordinate system.
    */

    const placeholder =
      document.createElement("div");

    placeholder.className =
      "handCard v9-placeholder";

    placeholder.style.width =
      `${d.originalRect.width}px`;

    placeholder.style.height =
      `${d.originalRect.height}px`;

    placeholder.style.setProperty(
      "--x",
      el.style.getPropertyValue("--x")
    );

    placeholder.style.setProperty(
      "--y",
      el.style.getPropertyValue("--y")
    );

    placeholder.style.setProperty(
      "--rot",
      el.style.getPropertyValue("--rot")
    );

    placeholder.style.setProperty(
      "--scale",
      el.style.getPropertyValue("--scale")
    );

    placeholder.style.zIndex =
      el.style.zIndex;

    d.placeholder =
      placeholder;

    el.parentNode.insertBefore(
      placeholder,
      el
    );

    $("animationLayer")
      ?.appendChild(el);

    el.classList.add(
      "v9-dragging"
    );

    el.style.width =
      `${d.originalRect.width}px`;

    el.style.height =
      `${d.originalRect.height}px`;

    el.style.left =
      "0px";

    el.style.top =
      "0px";

    el.style.zIndex =
      "10000";

    positionDrag9(
      d.pointerX,
      d.pointerY,
      true
    );

    AcidFX.dragZone(
      true,
      false,
      true
    );
  }

  function positionDrag9(
    clientX,
    clientY,
    immediate = false
  ) {

    const d = V9.drag;

    if (!d) return;

    const fingerLift = 34;

    const left =
      clientX -
      d.offsetX;

    const top =
      clientY -
      d.offsetY -
      fingerLift;

    d.pointerX = clientX;
    d.pointerY = clientY;

    d.currentLeft = left;
    d.currentTop = top;

    const cardCenterX =
      left +
      d.originalRect.width / 2;

    const cardCenterY =
      top +
      d.originalRect.height / 2;

    const inside =
      inside9(
        cardCenterX,
        cardCenterY,
        centerHitRect9()
      );

    const valid =
      turn === "player"
        ? canPlay(d.card)
        : canIntercept(d.card);

    d.inside = inside;
    d.valid = valid;

    /*
      MAGNET SCALE

      Calculate from immutable originalRect.
      Never calculate from an already scaled rect.
      This removes the v8.1 feedback loop.
    */

    let scale = 1.045;

    if (inside && valid) {

      const target =
        discardTarget9();

      if (target) {

        const sx =
          target.width /
          d.originalRect.width;

        const sy =
          target.height /
          d.originalRect.height;

        scale =
          Math.min(sx, sy);
      }
    }

    d.magnetScale = scale;

    const el = d.source;

    el.classList.toggle(
      "v9-drag-valid",
      inside && valid
    );

    el.classList.toggle(
      "v9-drag-invalid",
      inside && !valid
    );

    el.style.transition =
      immediate
        ? "none"
        : "transform 90ms cubic-bezier(.2,.8,.2,1)";

    el.style.transform = `
      translate3d(
        ${left}px,
        ${top}px,
        0
      )
      rotate(0deg)
      scale(${scale})
    `;

    AcidFX.dragZone(
      true,
      inside,
      valid
    );
  }

  function moveDrag9(event) {

    const d = V9.drag;

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
        event.clientX - d.startX,
        event.clientY - d.startY
      );

    if (
      !d.started &&
      distance >= 7
    ) {
      activateV9Drag();
    }

    if (!d.started) return;

    positionDrag9(
      event.clientX,
      event.clientY
    );
  }


  /* =======================================================
     SMOOTH RETURN

     220ms, not old 560ms.
     Shrinks back to actual fan card size while moving.
     ======================================================= */

  async function returnDrag9(d) {

    AcidFX.dragZone(false);

    const el = d.source;

    el.classList.remove(
      "v9-drag-valid",
      "v9-drag-invalid"
    );

    const target =
      d.placeholder
        ?.getBoundingClientRect();

    if (!target) {

      V9.drag = null;

      el.remove();

      render();

      return;
    }

    /*
      Put the flying card BELOW cards that should overlap it.

      Its z-index is the original hand index, rather than
      global 10000.
    */

    el.style.zIndex =
      String(d.index + 1);

    const targetScale =
      target.width /
      d.originalRect.width;

    const dx =
      target.left;

    const dy =
      target.top;

    el.style.transition =
      "transform 220ms cubic-bezier(.18,.82,.2,1), opacity 100ms ease";

    el.style.transform = `
      translate3d(
        ${dx}px,
        ${dy}px,
        0
      )
      rotate(0deg)
      scale(${targetScale})
    `;

    await wait9(215);

    V9.drag = null;

    el.remove();

    d.placeholder?.remove();

    render();

    if (
      d.inside &&
      !d.valid
    ) {

      AcidFX.status(
        drawPenalty > 0
          ? `ШТРАФ +${drawPenalty}: ОТБЕЙ ИЛИ ЗАБЕРИ`
          : "ЭТА КАРТА НЕ ПОДХОДИТ"
      );
    }
  }


  /* =======================================================
     SMOOTH SNAP TO DISCARD

     One element. No teleport.
     Simultaneous move + scale.
     ======================================================= */

  async function snapToDiscard9(d) {

  const el = d.source;
  const target = discardTarget9();

  if (!target) {
    await returnDrag9(d);
    return false;
  }

  /*
    Берём РЕАЛЬНУЮ экранную позицию карты
    после последнего движения пальца.
  */

  const current =
    el.getBoundingClientRect();

  /*
    Критически важно:
    переносим fixed-элемент в его текущие
    screen coordinates и обнуляем старый transform.

    Благодаря этому первый кадр анимации
    больше не прыгает в (0,0).
  */

  el.getAnimations()
    .forEach(animation => animation.cancel());

  el.style.transition = "none";

  el.style.left =
    `${current.left}px`;

  el.style.top =
    `${current.top}px`;

  el.style.width =
    `${current.width}px`;

  el.style.height =
    `${current.height}px`;

  el.style.transform =
    "translate3d(0,0,0) rotate(0deg) scale(1)";

  /*
    Следующий frame — браузер фиксирует
    новую стартовую геометрию.
  */

  await new Promise(resolve =>
    requestAnimationFrame(() =>
      requestAnimationFrame(resolve)
    )
  );

  const currentCenter =
    rectCenter9(current);

  const targetCenter =
    rectCenter9(target);

  const dx =
    targetCenter.x -
    currentCenter.x;

  const dy =
    targetCenter.y -
    currentCenter.y;

  const scale =
    Math.min(
      target.width / current.width,
      target.height / current.height
    );

  el.classList.remove(
    "v9-drag-valid",
    "v9-drag-invalid",
    "v9-playable",
    "playable"
  );

  document
    .documentElement
    .classList
    .add("v91-action");

  const animation =
    el.animate(
      [
        {
          transform:
            "translate3d(0,0,0) rotate(0deg) scale(1)"
        },
        {
          transform: `
            translate3d(
              ${dx}px,
              ${dy}px,
              0
            )
            rotate(3deg)
            scale(${scale})
          `
        }
      ],
      {
        duration: 205,
        easing:
          "cubic-bezier(.18,.82,.2,1)",
        fill: "forwards"
      }
    );

  await animation.finished
    .catch(() => {});

  return true;
}

  /* =======================================================
     END DRAG
     ======================================================= */

  async function endDrag9(event) {

    const d = V9.drag;

    if (
      !d ||
      event.pointerId !==
        d.pointerId
    ) {
      return;
    }

    event.preventDefault();

    removeV9DragListeners();

    if (!d.started) {

      V9.drag = null;

      AcidFX.dragZone(false);

      return;
    }

    if (
      !d.inside ||
      !d.valid
    ) {

      await returnDrag9(d);

      return;
    }

    AcidFX.dragZone(false);

    /*
      Keep placeholder while card lands.
      The fan therefore doesn't jump before impact.
    */

    const intercept =
      turn !== "player";

    const card =
      d.card;

    /*
      WILD: choose color before final commit.
      Return it smoothly for now.
    */

    if (
      card.color === "wild"
    ) {

      const releasedRect =
        d.source.getBoundingClientRect();

      V9.drag = null;

      d.source.remove();
      d.placeholder?.remove();

      render();

      pendingWild = {
        cardId: card.id,
        intercept,
        releasedRect
      };

      $("colorPicker")
        ?.classList
        .remove("hidden");

      return;
    }

    setBusy(true);

    const landed =
      await snapToDiscard9(d);

    if (!landed) {
      setBusy(false);
      return;
    }

    const oldPositions =
      captureHand9();

    const freshIndex =
      playerIndex(card.id);

    if (freshIndex === -1) {

      setBusy(false);

      V9.drag = null;

      d.source.remove();
      d.placeholder?.remove();

      render();

      return;
    }

    if (intercept) {

      burst9(
        "ПЕРЕХВАТ!",
        "acid"
      );

      turn = "player";
    }

    player.splice(
      freshIndex,
      1
    );

    applyCardState(
      card,
      null
    );

    V9.drag = null;

    d.source.remove();
    d.placeholder?.remove();

    render();

    animateHandFrom9(
      oldPositions
    );

    await specialEffect9(card);

    if (
      player.length === 0
    ) {

      setBusy(false);

      finish(true);

      return;
    }

    handlePlayerUnoAfterPlay9();

    if (
      card.value === "skip" ||
      card.value === "reverse"
    ) {

      turn = "player";

      visualTurn9("player");

      AcidFX.status(
        card.value === "skip"
          ? "БОТ ПРОПУСКАЕТ — ТВОЙ ХОД"
          : "РАЗВОРОТ — ТВОЙ ХОД"
      );

      setBusy(false);

      render();

      return;
    }

    turn = "bot";

    visualTurn9("bot");

    AcidFX.status(
      drawPenalty > 0
        ? `БОТ: ШТРАФ +${drawPenalty}`
        : "ХОД БОТА"
    );

    setBusy(false);

    render();

    setTimeout(() => {
      if (
        !gameOver &&
        turn === "bot"
      ) {
        botTurn();
      }
    }, 90);
  }


  /* =======================================================
     REBIND HAND

     Base renderHand creates old beginDrag listeners.
     Clone nodes to strip those listeners and bind v9.
     ======================================================= */

  function bindV9Hand() {

    document
      .querySelectorAll(
        "#hand .handCard[data-card-id]"
      )
      .forEach(old => {

        if (
          old.dataset.v9Bound === "1"
        ) {
          return;
        }

        const fresh =
          old.cloneNode(true);

        fresh.dataset.v9Bound =
          "1";

        old.replaceWith(fresh);

        fresh.addEventListener(
          "pointerdown",
          event =>
            beginV9Drag(
              event,
              Number(
                fresh.dataset.cardId
              )
            )
        );
      });

    updatePlayableGlow9();
  }

  const originalRenderHand9 =
    renderHand;

  renderHand = function () {

    originalRenderHand9();

    bindV9Hand();
  };


  /* =======================================================
     SPECIAL CARD EFFECTS
     ======================================================= */

  async function specialEffect9(card) {

    if (!card) return;

    if (card.value === "+2") {

      burst9("+2", "danger");

      await wait9(190);

    } else if (
      card.value === "+4"
    ) {

      burst9("+4", "danger");

      await wait9(210);

    } else if (
      card.value === "skip"
    ) {

      burst9(
        "ПРОПУСК",
        "acid"
      );

      await wait9(180);

    } else if (
      card.value === "reverse"
    ) {

      burst9(
        "РЕВЕРС",
        "acid"
      );

      await wait9(180);

    } else if (
      card.color === "wild"
    ) {

      burst9(
        "WILD",
        "acid"
      );

      await wait9(180);
    }
  }


  /* =======================================================
     PLAYER DRAW

     One tap = one voluntary card.
     Does not end turn.

     Penalty = whole penalty and ends turn.
     ======================================================= */

  playerDraw = async function () {

    if (
      gameOver ||
      turn !== "player" ||
      V9.drawLock ||
      V9.drag
    ) {
      return;
    }

    if (
      drawPenalty > 0
    ) {

      V9.drawLock = true;

      const amount =
        drawPenalty;

      const cards =
        takeMany(amount);

      drawPenalty = 0;
      penaltyType = null;

      burst9(
        `+${cards.length}`,
        "danger"
      );

      for (
        const card of cards
      ) {

        const old =
          captureHand9();

        player.push(card);

        render();

        animateHandFrom9(old);

        /*
          Decorative flight does not block
          the whole game.
        */

        AcidFX
          .drawCard(card, "player")
          .catch(() => {});

        await wait9(65);
      }

      turn = "bot";

      visualTurn9("bot");

      AcidFX.status(
        "ХОД БОТА"
      );

      V9.drawLock = false;

      render();

      setTimeout(() => {

        if (
          !gameOver &&
          turn === "bot"
        ) {
          botTurn();
        }

      }, 100);

      return;
    }

    const card =
      takeRaw();

    if (!card) return;

    V9.drawLock = true;

    const old =
      captureHand9();

    player.push(card);

    turn = "player";

    render();

    animateHandFrom9(old);

    AcidFX
      .drawCard(card, "player")
      .catch(() => {});

    AcidFX.status(
      canPlay(card)
        ? "МОЖЕШЬ СЫГРАТЬ ИЛИ ВЗЯТЬ ЕЩЁ"
        : "МОЖЕШЬ ВЗЯТЬ ЕЩЁ"
    );

    /*
      User can tap again quickly.
    */

    setTimeout(() => {
      V9.drawLock = false;
    }, 95);
  };


  /* =======================================================
     DECK REBIND
     ======================================================= */

  function bindDeck9() {

    const old =
      $("deck");

    if (!old) return;

    const fresh =
      old.cloneNode(true);

    old.replaceWith(fresh);

    fresh.addEventListener(
      "click",
      event => {

        event.preventDefault();

        playerDraw();
      }
    );
  }


  /* =======================================================
     BOT FACE-DOWN DRAW
     ======================================================= */

  async function botDrawBack9() {

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
      document.createElement("div");

    el.className =
      "botCard v9-bot-card v9-bot-flying";

    Object.assign(
      el.style,
      {
        position: "fixed",
        left: `${from.left}px`,
        top: `${from.top}px`,
        width: `${from.width}px`,
        height: `${from.height}px`,
        margin: "0",
        zIndex: "10000",
        pointerEvents: "none"
      }
    );

    layer.appendChild(el);

    await new Promise(resolve =>
      requestAnimationFrame(() =>
        requestAnimationFrame(resolve)
      )
    );

    const fromCenter =
      rectCenter9(from);

    const toCenter =
      rectCenter9(to);

    const dx =
      toCenter.x -
      fromCenter.x;

    const dy =
      toCenter.y -
      fromCenter.y;

    /*
      Same card proportions as player.
      Only destination scale changes to fit bot fan.
    */

    const targetWidth =
      Math.min(
        from.width,
        84 *
          getFanLayout(
            Math.max(bot.length + 1, 1)
          ).scale
      );

    const scale =
      targetWidth /
      from.width;

    el.style.transition =
      "transform 230ms cubic-bezier(.2,.82,.2,1),opacity 80ms ease";

    el.style.transform = `
      translate3d(
        ${dx}px,
        ${dy}px,
        0
      )
      rotate(4deg)
      scale(${scale})
    `;

    await wait9(220);

    el.style.opacity = "0";

    await wait9(60);

    el.remove();
  }


  /* =======================================================
     BOT PLAY

     Bot's played card may reveal its face only when played.
     ======================================================= */

  botPlay = async function (
    index,
    intercept
  ) {

    const card =
      bot[index];

    if (!card) return;

    const willHaveOne =
      bot.length === 2;

    let chosenColor = null;

    if (
      card.color === "wild"
    ) {
      chosenColor =
        bestBotColor(index);
    }

    AcidFX.status(
      intercept
        ? "БОТ: ПЕРЕХВАТ"
        : "БОТ ХОДИТ"
    );

    /*
      Keep existing play animation for now,
      but bot thinking delays are removed below.
    */

    await AcidFX.playBotCard(card);

    bot.splice(index, 1);

    applyCardState(
      card,
      chosenColor
    );

    render();

    await specialEffect9(card);

    if (
      bot.length === 0
    ) {

      clearBotUno9();

      finish(false);

      return;
    }

    if (
      willHaveOne &&
      bot.length === 1
    ) {
      prepareBotUno9();
    }

    if (
      card.value === "skip" ||
      card.value === "reverse"
    ) {

      turn = "bot";

      visualTurn9("bot");

      AcidFX.status(
        "БОТ ХОДИТ ЕЩЁ РАЗ"
      );

      setTimeout(() => {

        if (
          !gameOver &&
          turn === "bot"
        ) {
          botTurn();
        }

      }, 90);

      return;
    }

    turn = "player";

    visualTurn9("player");

    AcidFX.status(
      drawPenalty > 0
        ? `ШТРАФ +${drawPenalty}`
        : "ТВОЙ ХОД"
    );

    render();
  };


  /* =======================================================
     BOT TURN
     ======================================================= */

  botTurn = async function () {

    if (
      gameOver ||
      turn !== "bot" ||
      V9.botRunning
    ) {
      return;
    }

    V9.botRunning = true;

    /*
      INTERCEPT:
      keep human-like delay.
    */

    const interceptIndex =
      botInterceptIndex();

    if (
      interceptIndex !== -1 &&
      Math.random() < .82
    ) {

      AcidFX.status(
        "БОТ ЗАМЕТИЛ ПЕРЕХВАТ..."
      );

      await wait9(
        randomBetween9(
          340,
          510
        )
      );

      if (
        !gameOver &&
        turn === "bot"
      ) {

        const fresh =
          botInterceptIndex();

        if (
          fresh !== -1
        ) {

          burst9(
            "ПЕРЕХВАТ!",
            "acid"
          );

          V9.botRunning = false;

          await botPlay(
            fresh,
            true
          );

          return;
        }
      }
    }

    /*
      Normal decision is fast.
    */

    AcidFX.status(
      "БОТ ДУМАЕТ..."
    );

    await wait9(
      randomBetween9(
        55,
        120
      )
    );

    if (
      gameOver ||
      turn !== "bot"
    ) {

      V9.botRunning = false;

      return;
    }

    /*
      PENALTY
    */

    if (
      drawPenalty > 0
    ) {

      const defense =
        botPlayableIndexes();

      if (
        defense.length > 0
      ) {

        const choice =
          botChoose(defense);

        V9.botRunning = false;

        await botPlay(
          choice,
          false
        );

        return;
      }

      /*
        Accept penalty and STOP.
        Do not continue drawing for a playable card.
      */

      const amount =
        drawPenalty;

      const cards =
        takeMany(amount);

      drawPenalty = 0;
      penaltyType = null;

      burst9(
        `БОТ +${cards.length}`,
        "danger"
      );

      for (
        const card of cards
      ) {

        await botDrawBack9();

        bot.push(card);

        render();

        await wait9(30);
      }

      turn = "player";

      visualTurn9("player");

      AcidFX.status(
        "ТВОЙ ХОД"
      );

      V9.botRunning = false;

      render();

      return;
    }

    /*
      NORMAL BOT PLAY
    */

    let playable =
      botPlayableIndexes();

    if (
      playable.length === 0
    ) {

      AcidFX.status(
        "БОТ ДОБИРАЕТ..."
      );

      let found = -1;

      let safety = 0;

      while (
        found === -1 &&
        safety < 150
      ) {

        safety++;

        const card =
          takeRaw();

        if (!card) break;

        await botDrawBack9();

        bot.push(card);

        render();

        if (
          normalPlayable(card)
        ) {
          found =
            bot.length - 1;
        }

        await wait9(25);
      }

      if (
        found !== -1
      ) {
        playable = [found];
      }
    }

    if (
      playable.length === 0
    ) {

      turn = "player";

      visualTurn9("player");

      AcidFX.status(
        "ТВОЙ ХОД"
      );

      V9.botRunning = false;

      render();

      return;
    }

    const choice =
      botChoose(playable);

    V9.botRunning = false;

    await botPlay(
      choice,
      false
    );
  };


  /* =======================================================
     UNO — PLAYER
     ======================================================= */

  const unoButton9 =
    $("unoButton");

  function syncUno9() {

    if (!unoButton9) return;

    const show =
      !gameOver &&
      turn === "player" &&
      player.length === 2 &&
      !V9.playerUnoCalled;

    unoButton9.classList.toggle(
      "show",
      show
    );
  }

  function resetPlayerUno9() {

    clearTimeout(
      V9.playerUnoTimer
    );

    V9.playerUnoCalled = false;
    V9.playerUnoVulnerable = false;

    unoButton9
      ?.classList
      .remove(
        "show",
        "called"
      );
  }

  unoButton9
    ?.addEventListener(
      "click",
      event => {

        event.preventDefault();
        event.stopPropagation();

        if (
          gameOver ||
          turn !== "player" ||
          player.length !== 2
        ) {
          return;
        }

        V9.playerUnoCalled = true;

        unoButton9.classList.add(
          "called"
        );

        burst9(
          "UNO!",
          "acid"
        );

        AcidFX.status(
          "UNO!"
        );
      }
    );

  function handlePlayerUnoAfterPlay9() {

    if (
      player.length !== 1
    ) {

      resetPlayerUno9();

      return;
    }

    unoButton9
      ?.classList
      .remove("show");

    if (
      V9.playerUnoCalled
    ) {

      V9.playerUnoVulnerable =
        false;

      return;
    }

    /*
      Bot catches missed UNO after
      medium human reaction +30%.
    */

    V9.playerUnoVulnerable =
      true;

    clearTimeout(
      V9.playerUnoTimer
    );

    V9.playerUnoTimer =
      setTimeout(
        async () => {

          if (
            gameOver ||
            !V9.playerUnoVulnerable ||
            player.length !== 1
          ) {
            return;
          }

          V9.playerUnoVulnerable =
            false;

          burst9(
            "НЕ СКАЗАЛ UNO! +2",
            "danger"
          );

          const cards =
            takeMany(2);

          for (
            const card of cards
          ) {

            const old =
              captureHand9();

            player.push(card);

            render();

            animateHandFrom9(old);

            AcidFX
              .drawCard(
                card,
                "player"
              )
              .catch(() => {});

            await wait9(65);
          }

          resetPlayerUno9();

          render();

        },
        randomBetween9(
          440,
          700
        )
      );
  }


  /* =======================================================
     UNO — BOT
     ======================================================= */

  function clearBotUno9() {

    clearTimeout(
      V9.botUnoTimer
    );

    clearTimeout(
      V9.botCatchTimer
    );

    V9.botUnoCalled = false;
    V9.botUnoVulnerable = false;

    $("bot")
      ?.classList
      .remove("catchable");
  }

  function prepareBotUno9() {

    clearBotUno9();

    V9.botUnoVulnerable = true;

    $("bot")
      ?.classList
      .add("catchable");

    /*
      Bot reaction: average human +30%.
    */

    V9.botUnoTimer =
      setTimeout(
        () => {

          if (
            gameOver ||
            !V9.botUnoVulnerable ||
            bot.length !== 1
          ) {
            return;
          }

          V9.botUnoCalled = true;
          V9.botUnoVulnerable = false;

          $("bot")
            ?.classList
            .remove("catchable");

          burst9(
            "БОТ: UNO!",
            "acid"
          );

          AcidFX.status(
            "БОТ: UNO!"
          );

        },
        randomBetween9(
          440,
          700
        )
      );

    /*
      Catch window doesn't stay forever.
    */

    V9.botCatchTimer =
      setTimeout(
        () => {

          V9.botUnoVulnerable =
            false;

          $("bot")
            ?.classList
            .remove("catchable");

        },
        900
      );
  }

  $("bot")
    ?.addEventListener(
      "click",
      async () => {

        if (
          gameOver ||
          !V9.botUnoVulnerable ||
          V9.botUnoCalled ||
          bot.length !== 1
        ) {
          return;
        }

        clearBotUno9();

        burst9(
          "ПОЙМАЛ! +2",
          "danger"
        );

        AcidFX.status(
          "БОТ НЕ СКАЗАЛ UNO — +2"
        );

        const cards =
          takeMany(2);

        for (
          const card of cards
        ) {

          await botDrawBack9();

          bot.push(card);

          render();

          await wait9(30);
        }
      }
    );


  /* =======================================================
     WILD COLOR PICKER

     Base game still owns color picker callbacks.
     We only make sure v9 refreshes afterward.
     ======================================================= */

  document
    .querySelectorAll(
      "#colorPicker [data-color]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          setTimeout(() => {
            render();
          }, 0);

        }
      );
    });


  /* =======================================================
     START GAME WRAPPER
     ======================================================= */

  const originalStartGame9 =
    startGame;

  startGame = function () {

    removeV9DragListeners();

    V9.drag = null;
    V9.drawLock = false;
    V9.botRunning = false;

    resetPlayerUno9();
    clearBotUno9();

    originalStartGame9();

    bindDeck9();
    bindV9Hand();

    visualTurn9("player");

    render();
  };


  /* =======================================================
     INITIAL BINDING
     ======================================================= */

  bindDeck9();
  bindV9Hand();

  visualTurn9(turn);

  render();

  console.log(
    "ACID UNO v9 loaded"
  );

})();