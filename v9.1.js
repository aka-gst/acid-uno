"use strict";

/* =========================================================
   ACID UNO v9.1
   ---------------------------------------------------------
   CLEAN OVERRIDE FOR game.js

   IMPORTANT:
   Load:
     animations.js
     game.js
     v9.1.js

   DO NOT load:
     v8.js
     v8.1.js
     v8.2.js
     v9.js
   ========================================================= */

(() => {

  /* =======================================================
     STATE
     ======================================================= */

  const V91 = {

    drag: null,

    lastDrawAt: 0,

    botRunning: false,

    actionDepth: 0,

    playerUnoCalled: false,
    playerUnoVulnerable: false,
    playerUnoTimer: null,

    botUnoCalled: false,
    botUnoVulnerable: false,
    botUnoTimer: null,
    botCatchTimer: null

  };


  const wait91 = ms =>
    new Promise(resolve =>
      setTimeout(resolve, ms)
    );


  const randomBetween91 = (
    min,
    max
  ) =>
    min +
    Math.random() *
    (max - min);


  /* =======================================================
     ACTION / GLOW LOCK
     ======================================================= */

  function beginAction91() {

    V91.actionDepth++;

    document
      .documentElement
      .classList
      .add("v91-action");
  }


  function endAction91() {

    V91.actionDepth =
      Math.max(
        0,
        V91.actionDepth - 1
      );


    if (
      V91.actionDepth === 0
    ) {

      document
        .documentElement
        .classList
        .remove("v91-action");


      updatePlayableGlow91();
    }
  }


  function clearAction91() {

    V91.actionDepth = 0;

    document
      .documentElement
      .classList
      .remove("v91-action");
  }


  /* =======================================================
     UI
     ======================================================= */

  function ensureUI91() {

    document
      .querySelectorAll(
        "#robotFinger,.robotFinger"
      )
      .forEach(
        el => el.remove()
      );


    if (!$("unoButton")) {

      const button =
        document.createElement(
          "button"
        );


      button.id =
        "unoButton";

      button.type =
        "button";

      button.textContent =
        "UNO!";


      document.body.appendChild(
        button
      );
    }


    if (!$("v9Burst")) {

      const burst =
        document.createElement(
          "div"
        );


      burst.id =
        "v9Burst";


      document.body.appendChild(
        burst
      );
    }
  }


  ensureUI91();


  /* =======================================================
     BIG FX
     ======================================================= */

  let burstTimer91 =
    null;


  function burst91(
    text,
    type = ""
  ) {

    const el =
      $("v9Burst");


    if (!el) {
      return;
    }


    clearTimeout(
      burstTimer91
    );


    el.className = "";


    void el.offsetWidth;


    el.textContent =
      text;


    if (type) {

      el.classList.add(
        type
      );
    }


    el.classList.add(
      "show"
    );


    burstTimer91 =
      setTimeout(
        () => {

          el.className = "";

        },
        650
      );
  }


  /* =======================================================
     GEOMETRY
     ======================================================= */

  function rectCenter91(rect) {

    return {

      x:
        rect.left +
        rect.width / 2,

      y:
        rect.top +
        rect.height / 2

    };
  }


  function discardTarget91() {

    const card =
      document.querySelector(
        "#discard .card"
      );


    const fallback =
      $("discard");


    const el =
      card || fallback;


    return el
      ? el.getBoundingClientRect()
      : null;
  }


  function dropRect91() {

    const center =
      $("center");


    if (!center) {
      return null;
    }


    const r =
      center.getBoundingClientRect();


    const padX =
      Math.max(
        18,
        r.width * .12
      );


    const padY =
      Math.max(
        18,
        r.height * .1
      );


    return {

      left:
        r.left - padX,

      right:
        r.right + padX,

      top:
        r.top - padY,

      bottom:
        r.bottom + padY

    };
  }


  function pointInside91(
    x,
    y,
    rect
  ) {

    return (
      !!rect &&
      x >= rect.left &&
      x <= rect.right &&
      y >= rect.top &&
      y <= rect.bottom
    );
  }


  /* =======================================================
     PLAYABLE GLOW
     ======================================================= */

  function updatePlayableGlow91() {

    const blocked =
      V91.actionDepth > 0 ||
      !!V91.drag ||
      actionBusy ||
      gameOver;


    document
      .querySelectorAll(
        "#hand .handCard[data-card-id]"
      )
      .forEach(
        el => {

          const id =
            Number(
              el.dataset.cardId
            );


          const card =
            player.find(
              c =>
                c.id === id
            );


          if (!card) {
            return;
          }


          let playable =
            false;


          if (!blocked) {

            if (
              turn === "player"
            ) {

              playable =
                canPlay(card);

            } else {

              playable =
                canIntercept(card);
            }
          }


          el.classList.toggle(
            "v9-playable",
            playable
          );


          el.classList.toggle(
            "v9-unplayable",
            !playable
          );


          /*
            game.js тоже ставит playable.
            Во время action убираем и его.
          */

          if (blocked) {

            el.classList.remove(
              "playable"
            );
          }
        }
      );
  }


  /* =======================================================
     BOT FAN

     Base card remains 84x126,
     exactly like player card geometry.

     Difference = back side only.
     ======================================================= */

  function getBotFanLayout91(
    count
  ) {

    const desktop =
      window.innerWidth >= 900 &&
      window.innerHeight >= 620;

    const phoneLandscape =
      window.innerWidth > window.innerHeight &&
      window.innerHeight <= 600;

    let scale = desktop ? .76 : .74;

    if (desktop && count > 5) {
      scale = .72;
    }

    if (count > 7) {
      scale = desktop ? .68 : .66;
    }

    if (count > 10) {
      scale = desktop ? .62 : .57;
    }

    if (count > 14) {
      scale = desktop ? .56 : .49;
    }

    if (count > 20) {
      scale = desktop ? .49 : .42;
    }

    if (phoneLandscape) {
      scale *= .82;
    }

    const rootStyle =
      getComputedStyle(
        document.documentElement
      );

    const cardWidth =
      (parseFloat(
        rootStyle.getPropertyValue(
          "--card-w"
        )
      ) || 84) * scale;

    const maxWidth = desktop ? 520 : 330;

    const available =
      Math.min(
        window.innerWidth *
          (phoneLandscape ? .38 : .8),
        maxWidth
      );

    const naturalStep =
      cardWidth * .56;

    const fittedStep =
      count <= 1
        ? 0
        : Math.max(
            cardWidth * .28,
            (available - cardWidth) /
              (count - 1)
          );

    const step =
      Math.min(
        naturalStep,
        fittedStep
      );


    return {

      scale,

      halfFan:
        step *
        Math.max(0, count - 1) /
        2,

      angle:
        Math.min(
          desktop ? 19 : 22,
          6 + count * 1.15
        )

    };
  }


  function botFanPosition91(
    index,
    count
  ) {

    if (
      count <= 1
    ) {

      return {

        x: 0,
        y: 0,
        rot: 0,
        scale: .72

      };
    }


    const layout =
      getBotFanLayout91(
        count
      );


    const t =
      index /
      (count - 1);


    const n =
      t * 2 - 1;


    return {

      x:
        n *
        layout.halfFan,

      y:
        n *
        n *
        (window.innerWidth >= 900 ? 18 : 12),

      rot:
        n *
        layout.angle,

      scale:
        layout.scale

    };
  }


  renderBot =
    function () {

      const countEl =
        $("botCount");


      if (countEl) {

        countEl.textContent =
          `${bot.length} КАРТ`;
      }


      const area =
        $("botCards");


      if (!area) {
        return;
      }


      area.innerHTML = "";


      const visible =
        Math.min(
          bot.length,
          24
        );


      for (
        let i = 0;
        i < visible;
        i++
      ) {

        const el =
          document.createElement(
            "div"
          );


        el.className =
          "botCard v9-bot-card";


        const pos =
          botFanPosition91(
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


        area.appendChild(
          el
        );
      }
    };


  /* =======================================================
     TURN UI
     ======================================================= */

  function visualTurn91(side) {

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


    const playerTurn =
      side === "player";


    playerGlow
      ?.classList
      .toggle(
        "active",
        playerTurn
      );


    botGlow
      ?.classList
      .toggle(
        "active",
        !playerTurn
      );


    botAvatar
      ?.classList
      .toggle(
        "thinking",
        !playerTurn
      );


    botCards
      ?.classList
      .toggle(
        "bot-active",
        !playerTurn
      );
  }


  /* =======================================================
     HAND FLIP
     ======================================================= */

  function captureHand91() {

    const map =
      new Map();


    document
      .querySelectorAll(
        "#hand .handCard[data-card-id]"
      )
      .forEach(
        el => {

          const r =
            el.getBoundingClientRect();


          map.set(
            el.dataset.cardId,
            {

              x:
                r.left +
                r.width / 2,

              y:
                r.top +
                r.height / 2,

              width:
                r.width,

              height:
                r.height

            }
          );
        }
      );


    return map;
  }


  function animateHandFrom91(
    oldPositions,
    duration = 245
  ) {

    requestAnimationFrame(
      () => {

        document
          .querySelectorAll(
            "#hand .handCard[data-card-id]"
          )
          .forEach(
            el => {

              const old =
                oldPositions.get(
                  el.dataset.cardId
                );


              if (!old) {
                return;
              }


              const now =
                el.getBoundingClientRect();


              const nowX =
                now.left +
                now.width / 2;


              const nowY =
                now.top +
                now.height / 2;


              const dx =
                old.x -
                nowX;


              const dy =
                old.y -
                nowY;


              const sx =
                old.width /
                Math.max(
                  now.width,
                  1
                );


              const sy =
                old.height /
                Math.max(
                  now.height,
                  1
                );


              if (
                Math.abs(dx) < .5 &&
                Math.abs(dy) < .5 &&
                Math.abs(sx - 1) < .01 &&
                Math.abs(sy - 1) < .01
              ) {
                return;
              }


              el.animate(
                [
                  {

                    translate:
                      `${dx}px ${dy}px`,

                    scale:
                      `${sx} ${sy}`

                  },
                  {

                    translate:
                      "0px 0px",

                    scale:
                      "1 1"

                  }
                ],
                {

                  duration,

                  easing:
                    "cubic-bezier(.18,.82,.2,1)",

                  fill:
                    "none"

                }
              );
            }
          );
      }
    );
  }


  /* =======================================================
     RENDER WRAPPER
     ======================================================= */

  const baseRender91 =
    render;


  render =
    function () {

      baseRender91();

      bindV91Hand();

      updatePlayableGlow91();

      syncUno91();
    };


  /* =======================================================
     NEW CARD INTO PLAYER HAND

     1) hand opens slightly
     2) state changes
     3) old cards animate to new slots
     4) new card flies from deck to its final slot
     ======================================================= */

  async function addPlayerCardAnimated91(
    card
  ) {

    const hand =
      $("hand");


    if (!hand) {

      player.push(card);

      render();

      return;
    }


    beginAction91();


    hand.classList.add(
      "v91-receiving"
    );


    await wait91(75);


    const before =
      captureHand91();


    /*
      Add card before flight so
      the fan reserves the destination slot.
    */

    player.push(card);


    render();


    animateHandFrom91(
      before,
      260
    );


    const target =
      playerCardElement(
        card.id
      );


    const deckEl =
      $("deck");


    if (
      target &&
      deckEl
    ) {

      const deckRect =
        deckEl.getBoundingClientRect();


      const targetRect =
        target.getBoundingClientRect();


      const deckCenter =
        rectCenter91(
          deckRect
        );


      const targetCenter =
        rectCenter91(
          targetRect
        );


      const dx =
        deckCenter.x -
        targetCenter.x;


      const dy =
        deckCenter.y -
        targetCenter.y;


      const scale =
        Math.min(
          deckRect.width /
            Math.max(
              targetRect.width,
              1
            ),

          deckRect.height /
            Math.max(
              targetRect.height,
              1
            )
        );


      target.classList.remove(
        "v9-playable",
        "playable"
      );


      target.animate(
        [
          {

            translate:
              `${dx}px ${dy}px`,

            scale:
              String(scale),

            rotate:
              "-7deg",

            opacity:
              .94

          },
          {

            translate:
              "0px 0px",

            scale:
              "1",

            rotate:
              "0deg",

            opacity:
              1

          }
        ],
        {

          duration:
            285,

          easing:
            "cubic-bezier(.18,.82,.2,1)",

          fill:
            "none"

        }
      );
    }


    await wait91(235);


    hand.classList.remove(
      "v91-receiving"
    );


    endAction91();
  }


  /* =======================================================
     DRAG BINDING
     ======================================================= */

  function removeDragListeners91() {

    window.removeEventListener(
      "pointermove",
      moveDrag91
    );


    window.removeEventListener(
      "pointerup",
      endDrag91
    );


    window.removeEventListener(
      "pointercancel",
      endDrag91
    );
  }


  function beginDrag91(
    event,
    cardId
  ) {

    if (
      gameOver ||
      actionBusy ||
      V91.drag
    ) {
      return;
    }


    const index =
      playerIndex(
        cardId
      );


    if (
      index === -1
    ) {
      return;
    }


    const card =
      player[index];


    if (
      turn !== "player" &&
      !canIntercept(card)
    ) {
      return;
    }


    const source =
      playerCardElement(
        cardId
      );


    if (!source) {
      return;
    }


    event.preventDefault();


    const rect =
      source.getBoundingClientRect();


    V91.drag = {

      pointerId:
        event.pointerId,

      cardId,

      card,

      index,

      source,

      placeholder:
        null,

      started:
        false,

      inside:
        false,

      valid:
        false,

      startX:
        event.clientX,

      startY:
        event.clientY,

      pointerX:
        event.clientX,

      pointerY:
        event.clientY,

      offsetX:
        event.clientX -
        rect.left,

      offsetY:
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

      }

    };


    window.addEventListener(
      "pointermove",
      moveDrag91,
      {
        passive: false
      }
    );


    window.addEventListener(
      "pointerup",
      endDrag91,
      {
        passive: false
      }
    );


    window.addEventListener(
      "pointercancel",
      endDrag91,
      {
        passive: false
      }
    );
  }


  function activateDrag91() {

    const d =
      V91.drag;


    if (
      !d ||
      d.started
    ) {
      return;
    }


    d.started =
      true;


    beginAction91();


    const el =
      d.source;


    const placeholder =
      document.createElement(
        "div"
      );


    placeholder.className =
      "handCard v91-placeholder";


    placeholder.dataset.cardId =
      `placeholder-${d.cardId}`;


    placeholder.style.width =
      `${d.originalRect.width}px`;


    placeholder.style.height =
      `${d.originalRect.height}px`;


    placeholder.style.setProperty(
      "--x",
      el.style.getPropertyValue(
        "--x"
      )
    );


    placeholder.style.setProperty(
      "--y",
      el.style.getPropertyValue(
        "--y"
      )
    );


    placeholder.style.setProperty(
      "--rot",
      el.style.getPropertyValue(
        "--rot"
      )
    );


    placeholder.style.setProperty(
      "--scale",
      el.style.getPropertyValue(
        "--scale"
      )
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


    el.classList.remove(
      "playable",
      "v9-playable",
      "v9-unplayable"
    );


    el.classList.add(
      "v91-dragging"
    );


    /*
      IMPORTANT:
      After moving the element into animationLayer,
      make its fixed coordinates equal to the exact
      previous screen rect.

      This prevents the first-frame jump.
    */

    el.style.position =
      "fixed";


    el.style.left =
      `${d.originalRect.left}px`;


    el.style.top =
      `${d.originalRect.top}px`;


    el.style.width =
      `${d.originalRect.width}px`;


    el.style.height =
      `${d.originalRect.height}px`;


    el.style.margin =
      "0";


    el.style.zIndex =
      "10000";


    el.style.transform =
      "translate3d(0,0,0) rotate(0deg) scale(1)";


    positionDrag91(
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


  function positionDrag91(
    clientX,
    clientY,
    immediate = false
  ) {

    const d =
      V91.drag;


    if (!d) {
      return;
    }


    const fingerLift =
      34;


    const desiredLeft =
      clientX -
      d.offsetX;


    const desiredTop =
      clientY -
      d.offsetY -
      fingerLift;


    d.pointerX =
      clientX;


    d.pointerY =
      clientY;


    /*
      Since fixed element already starts at originalRect,
      transform is delta from that position.
    */

    const dx =
      desiredLeft -
      d.originalRect.left;


    const dy =
      desiredTop -
      d.originalRect.top;


    const cardCenterX =
      desiredLeft +
      d.originalRect.width / 2;


    const cardCenterY =
      desiredTop +
      d.originalRect.height / 2;


    const inside =
      pointInside91(
        cardCenterX,
        cardCenterY,
        dropRect91()
      );


    const valid =
      turn === "player"
        ? canPlay(d.card)
        : canIntercept(d.card);


    d.inside =
      inside;


    d.valid =
      valid;


    /*
      Stable target scaling.

      Uses immutable originalRect.
      Never reads already-scaled dragged size.
    */

    let scale =
      1.045;


    if (
      inside &&
      valid
    ) {

      const target =
        discardTarget91();


      if (target) {

        scale =
          Math.min(
            target.width /
              d.originalRect.width,

            target.height /
              d.originalRect.height
          );
      }
    }


    const el =
      d.source;


    el.classList.toggle(
      "v91-drag-valid",
      inside &&
      valid
    );


    el.classList.toggle(
      "v91-drag-invalid",
      inside &&
      !valid
    );


    el.style.transition =
      immediate
        ? "none"
        : "transform 90ms cubic-bezier(.2,.8,.2,1)";


    el.style.transform = `
      translate3d(
        ${dx}px,
        ${dy}px,
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


  function moveDrag91(event) {

    const d =
      V91.drag;


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


    if (
      !d.started &&
      distance >= 7
    ) {

      activateDrag91();
    }


    if (!d.started) {
      return;
    }


    positionDrag91(
      event.clientX,
      event.clientY
    );
  }


  /* =======================================================
     RETURN DRAG

     No long 560ms wait.
     Card goes straight to its placeholder.

     Z-index is set before the animation,
     so it immediately sits under the cards
     that should overlap it.
     ======================================================= */

  async function returnDrag91(d) {

    AcidFX.dragZone(
      false
    );


    const el =
      d.source;


    el.classList.remove(
      "v91-drag-valid",
      "v91-drag-invalid"
    );


    const target =
      d.placeholder
        ?.getBoundingClientRect();


    if (!target) {

      V91.drag =
        null;


      el.remove();


      render();


      endAction91();

      return;
    }


    const current =
      el.getBoundingClientRect();


    el.getAnimations()
      .forEach(
        animation =>
          animation.cancel()
      );


    /*
      Rebase fixed element onto the exact current rect.
    */

    el.style.transition =
      "none";


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
      Correct stacking BEFORE movement.
    */

    el.style.zIndex =
      String(
        d.index + 1
      );


    await new Promise(
      resolve =>
        requestAnimationFrame(
          () =>
            requestAnimationFrame(
              resolve
            )
        )
    );


    const currentCenter =
      rectCenter91(
        current
      );


    const targetCenter =
      rectCenter91(
        target
      );


    const dx =
      targetCenter.x -
      currentCenter.x;


    const dy =
      targetCenter.y -
      currentCenter.y;


    const scale =
      Math.min(
        target.width /
          Math.max(
            current.width,
            1
          ),

        target.height /
          Math.max(
            current.height,
            1
          )
      );


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
              rotate(0deg)
              scale(${scale})
            `

          }
        ],
        {

          duration:
            205,

          easing:
            "cubic-bezier(.18,.82,.2,1)",

          fill:
            "forwards"

        }
      );


    await animation.finished
      .catch(
        () => {}
      );


    const invalid =
      d.inside &&
      !d.valid;


    V91.drag =
      null;


    el.remove();


    d.placeholder
      ?.remove();


    render();


    endAction91();


    if (invalid) {

      AcidFX.status(
        drawPenalty > 0
          ? `ШТРАФ +${drawPenalty}: ОТБЕЙ ИЛИ ЗАБЕРИ`
          : "ЭТА КАРТА НЕ ПОДХОДИТ"
      );
    }
  }


  /* =======================================================
     SNAP TO DISCARD

     FIX:
     No transform reset to screen (0,0).

     Element is first rebased to its actual current rect,
     then animated to discard.
     ======================================================= */

  async function snapToDiscard91(d) {

    const el =
      d.source;


    const target =
      discardTarget91();


    if (!target) {

      await returnDrag91(d);

      return false;
    }


    const current =
      el.getBoundingClientRect();


    el.getAnimations()
      .forEach(
        animation =>
          animation.cancel()
      );


    el.style.transition =
      "none";


    /*
      Critical:
      current screen coordinates become new fixed origin.
    */

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


    el.classList.remove(
      "v91-drag-valid",
      "v91-drag-invalid",
      "v9-playable",
      "playable"
    );


    await new Promise(
      resolve =>
        requestAnimationFrame(
          () =>
            requestAnimationFrame(
              resolve
            )
        )
    );


    const currentCenter =
      rectCenter91(
        current
      );


    const targetCenter =
      rectCenter91(
        target
      );


    const dx =
      targetCenter.x -
      currentCenter.x;


    const dy =
      targetCenter.y -
      currentCenter.y;


    const scale =
      Math.min(
        target.width /
          Math.max(
            current.width,
            1
          ),

        target.height /
          Math.max(
            current.height,
            1
          )
      );


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

          duration:
            205,

          easing:
            "cubic-bezier(.18,.82,.2,1)",

          fill:
            "forwards"

        }
      );


    await animation.finished
      .catch(
        () => {}
      );


    return true;
  }


  /* =======================================================
     SPECIAL EFFECT
     ======================================================= */

  async function specialEffect91(card) {

    if (!card) {
      return;
    }


    if (
      card.value === "+2"
    ) {

      burst91(
        "+2",
        "danger"
      );


      await wait91(
        180
      );

      return;
    }


    if (
      card.value === "+4"
    ) {

      burst91(
        "+4",
        "danger"
      );


      await wait91(
        190
      );

      return;
    }


    if (
      card.value === "skip"
    ) {

      burst91(
        "ПРОПУСК",
        "acid"
      );


      await wait91(
        170
      );

      return;
    }


    if (
      card.value === "reverse"
    ) {

      burst91(
        "РЕВЕРС",
        "acid"
      );


      await wait91(
        170
      );

      return;
    }


    if (
      card.color === "wild"
    ) {

      burst91(
        "WILD",
        "acid"
      );


      await wait91(
        170
      );
    }
  }


  /* =======================================================
     PLAYER FINISH PLAY
     ======================================================= */

  async function finishPlayerCard91(
    d,
    chosenColor = null,
    intercept = false
  ) {

    const card =
      d.card;


    const landed =
      await snapToDiscard91(
        d
      );


    if (!landed) {

      return false;
    }


    const oldHand =
      captureHand91();


    const freshIndex =
      playerIndex(
        card.id
      );


    if (
      freshIndex === -1
    ) {

      V91.drag =
        null;


      d.source.remove();


      d.placeholder
        ?.remove();


      render();


      return false;
    }


    if (intercept) {

      burst91(
        "ПЕРЕХВАТ!",
        "acid"
      );


      turn =
        "player";
    }


    /*
      Actual gameplay state changes only AFTER
      the physical card reaches discard.
    */

    player.splice(
      freshIndex,
      1
    );


    applyCardState(
      card,
      chosenColor
    );


    V91.drag =
      null;


    d.source.remove();


    d.placeholder
      ?.remove();


    render();


    animateHandFrom91(
      oldHand,
      250
    );


    await specialEffect91(
      card
    );


    if (
      player.length === 0
    ) {

      endAction91();

      finish(true);

      return true;
    }


    handlePlayerUnoAfterPlay91();


    if (
      card.value === "skip" ||
      card.value === "reverse"
    ) {

      turn =
        "player";


      visualTurn91(
        "player"
      );


      AcidFX.status(
        card.value === "skip"
          ? "БОТ ПРОПУСКАЕТ — ТВОЙ ХОД"
          : "РАЗВОРОТ — ТВОЙ ХОД"
      );


      render();


      endAction91();


      return true;
    }


    turn =
      "bot";


    visualTurn91(
      "bot"
    );


    AcidFX.status(
      drawPenalty > 0
        ? `БОТ: ШТРАФ +${drawPenalty}`
        : intercept
          ? "ПЕРЕХВАТ — БОТ ОТВЕЧАЕТ"
          : "ХОД БОТА"
    );


    render();


    endAction91();


    setTimeout(
      () => {

        if (
          !gameOver &&
          turn === "bot"
        ) {

          botTurn();
        }

      },
      85
    );


    return true;
  }


  /* =======================================================
     END DRAG
     ======================================================= */

  async function endDrag91(event) {

    const d =
      V91.drag;


    if (
      !d ||
      event.pointerId !==
        d.pointerId
    ) {
      return;
    }


    event.preventDefault();


    removeDragListeners91();


    if (!d.started) {

      V91.drag =
        null;


      AcidFX.dragZone(
        false
      );


      return;
    }


    if (
      !d.inside ||
      !d.valid
    ) {

      await returnDrag91(
        d
      );


      return;
    }


    AcidFX.dragZone(
      false
    );


    const intercept =
      turn !== "player";


    /*
      WILD:
      keep gameplay state untouched until color selection.

      We remove floating card and return visual hand,
      then color picker will call playerPlay override below.
    */

    if (
      d.card.color === "wild"
    ) {

      const releasedRect =
        d.source
          .getBoundingClientRect();


      V91.drag =
        null;


      d.source.remove();


      d.placeholder
        ?.remove();


      render();


      endAction91();


      pendingWild = {

        cardId:
          d.card.id,

        intercept,

        releasedRect

      };


      $("colorPicker")
        ?.classList
        .remove(
          "hidden"
        );


      return;
    }


    await finishPlayerCard91(
      d,
      null,
      intercept
    );
  }


  /* =======================================================
     HAND REBIND

     Cloning removes old game.js pointerdown listener.
     ======================================================= */

  function bindV91Hand() {

    document
      .querySelectorAll(
        "#hand .handCard[data-card-id]"
      )
      .forEach(
        old => {

          if (
            old.dataset.v91Bound === "1"
          ) {

            return;
          }


          const fresh =
            old.cloneNode(
              true
            );


          fresh.dataset.v91Bound =
            "1";


          old.replaceWith(
            fresh
          );


          fresh.addEventListener(
            "pointerdown",
            event => {

              beginDrag91(
                event,
                Number(
                  fresh.dataset.cardId
                )
              );
            }
          );
        }
      );
  }


  /*
    game.js renderHand still creates old listeners.

    Override and clone immediately after it.
  */

  const baseRenderHand91 =
    renderHand;


  renderHand =
    function () {

      /*
        During our drag, do NOT let game.js rebuild hand.
      */

      if (
        V91.drag
      ) {

        return;
      }


      baseRenderHand91();


      bindV91Hand();


      updatePlayableGlow91();
    };


  /* =======================================================
     PLAYER DRAW

     One physical tap = one voluntary card.

     Penalty draw is the only multi-card operation.
     ======================================================= */

  playerDraw =
    async function () {

      const now =
        performance.now();


      if (
        gameOver ||
        turn !== "player" ||
        V91.drag ||
        now -
          V91.lastDrawAt <
          210
      ) {

        return;
      }


      V91.lastDrawAt =
        now;


      /*
        PENALTY
      */

      if (
        drawPenalty > 0
      ) {

        const amount =
          drawPenalty;


        const cards =
          takeMany(
            amount
          );


        drawPenalty =
          0;


        penaltyType =
          null;


        burst91(
          `+${cards.length}`,
          "danger"
        );


        for (
          const card of cards
        ) {

          await addPlayerCardAnimated91(
            card
          );


          await wait91(
            45
          );
        }


        turn =
          "bot";


        visualTurn91(
          "bot"
        );


        AcidFX.status(
          "ХОД БОТА"
        );


        render();


        setTimeout(
          () => {

            if (
              !gameOver &&
              turn === "bot"
            ) {

              botTurn();
            }

          },
          90
        );


        return;
      }


      /*
        VOLUNTARY DRAW

        ALWAYS exactly one card.
      */

      const card =
        takeRaw();


      if (!card) {

        AcidFX.status(
          "КАРТ БОЛЬШЕ НЕТ"
        );


        return;
      }


      await addPlayerCardAnimated91(
        card
      );


      turn =
        "player";


      render();


      AcidFX.status(
        canPlay(card)
          ? "МОЖЕШЬ СЫГРАТЬ ИЛИ ВЗЯТЬ ЕЩЁ"
          : "МОЖЕШЬ ВЗЯТЬ ЕЩЁ"
      );


      updatePlayableGlow91();
    };


  /* =======================================================
     DECK REBIND

     Removes old game.js click handler.
     ======================================================= */

  function bindDeck91() {

    const old =
      $("deck");


    if (!old) {
      return;
    }


    const fresh =
      old.cloneNode(
        true
      );


    old.replaceWith(
      fresh
    );


    fresh.addEventListener(
      "click",
      event => {

        event.preventDefault();

        event.stopPropagation();


        playerDraw();
      }
    );
  }


  /* =======================================================
     BOT BACK DRAW
     ======================================================= */

  async function botDrawBack91() {

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
      document.createElement(
        "div"
      );


    el.className =
      "v9-bot-card v91-bot-flying";


    Object.assign(
      el.style,
      {

        position:
          "fixed",

        left:
          `${from.left}px`,

        top:
          `${from.top}px`,

        width:
          `${from.width}px`,

        height:
          `${from.height}px`,

        margin:
          "0",

        zIndex:
          "10000",

        pointerEvents:
          "none"

      }
    );


    layer.appendChild(
      el
    );


    await new Promise(
      resolve =>
        requestAnimationFrame(
          () =>
            requestAnimationFrame(
              resolve
            )
        )
    );


    const a =
      rectCenter91(
        from
      );


    const b =
      rectCenter91(
        to
      );


    const dx =
      b.x - a.x;


    const dy =
      b.y - a.y;


    const layout =
      getBotFanLayout91(
        Math.max(
          bot.length + 1,
          1
        )
      );


    const targetWidth =
      84 *
      layout.scale;


    const scale =
      targetWidth /
      Math.max(
        from.width,
        1
      );


    el.style.transition =
      "transform 225ms cubic-bezier(.18,.82,.2,1), opacity 70ms ease";


    el.style.transform = `
      translate3d(
        ${dx}px,
        ${dy}px,
        0
      )
      rotate(5deg)
      scale(${scale})
    `;


    await wait91(
      215
    );


    el.style.opacity =
      "0";


    await wait91(
      55
    );


    el.remove();
  }


  /* =======================================================
     BOT PLAY
     ======================================================= */

  botPlay =
    async function (
      index,
      intercept
    ) {

      const card =
        bot[index];


      if (!card) {

        return;
      }


      beginAction91();


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


      const willHaveOne =
        bot.length === 2;


      AcidFX.status(
        intercept
          ? "БОТ: ПЕРЕХВАТ"
          : "БОТ ХОДИТ"
      );


      /*
        Existing animation can stay for bot card play.
        Its delay is no longer preceded by 800ms think time.
      */

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


      await specialEffect91(
        card
      );


      if (
        bot.length === 0
      ) {

        clearBotUno91();

        endAction91();

        finish(false);

        return;
      }


      if (
        willHaveOne &&
        bot.length === 1
      ) {

        prepareBotUno91();
      }


      if (
        card.value === "skip" ||
        card.value === "reverse"
      ) {

        turn =
          "bot";


        visualTurn91(
          "bot"
        );


        AcidFX.status(
          "БОТ ХОДИТ ЕЩЁ РАЗ"
        );


        render();


        endAction91();


        setTimeout(
          () => {

            if (
              !gameOver &&
              turn === "bot"
            ) {

              botTurn();
            }

          },
          85
        );


        return;
      }


      turn =
        "player";


      visualTurn91(
        "player"
      );


      AcidFX.status(
        drawPenalty > 0
          ? `ШТРАФ +${drawPenalty}`
          : "ТВОЙ ХОД"
      );


      render();


      endAction91();
    };


  /* =======================================================
     BOT TURN
     ======================================================= */

  botTurn =
    async function () {

      if (
        gameOver ||
        turn !== "bot" ||
        V91.botRunning
      ) {

        return;
      }


      V91.botRunning =
        true;


      /*
        INTERCEPT = human-like reaction
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


        await wait91(
          randomBetween91(
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

            burst91(
              "ПЕРЕХВАТ!",
              "acid"
            );


            V91.botRunning =
              false;


            await botPlay(
              fresh,
              true
            );


            return;
          }
        }
      }


      /*
        NORMAL DECISION
      */

      AcidFX.status(
        "БОТ ДУМАЕТ..."
      );


      await wait91(
        randomBetween91(
          55,
          115
        )
      );


      if (
        gameOver ||
        turn !== "bot"
      ) {

        V91.botRunning =
          false;


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
            botChoose(
              defense
            );


          V91.botRunning =
            false;


          await botPlay(
            choice,
            false
          );


          return;
        }


        const amount =
          drawPenalty;


        const cards =
          takeMany(
            amount
          );


        drawPenalty =
          0;


        penaltyType =
          null;


        burst91(
          `БОТ +${cards.length}`,
          "danger"
        );


        beginAction91();


        for (
          const card of cards
        ) {

          await botDrawBack91();


          bot.push(
            card
          );


          render();


          await wait91(
            25
          );
        }


        /*
          IMPORTANT:
          accepting penalty ENDS bot turn.
      */

        turn =
          "player";


        visualTurn91(
          "player"
        );


        AcidFX.status(
          "ТВОЙ ХОД"
        );


        V91.botRunning =
          false;


        render();


        endAction91();


        return;
      }


      /*
        NORMAL PLAY
      */

      let playable =
        botPlayableIndexes();


      if (
        playable.length === 0
      ) {

        AcidFX.status(
          "БОТ ДОБИРАЕТ..."
        );


        let found =
          -1;


        let safety =
          0;


        beginAction91();


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


          await botDrawBack91();


          bot.push(
            card
          );


          render();


          if (
            normalPlayable(
              card
            )
          ) {

            found =
              bot.length - 1;
          }


          await wait91(
            22
          );
        }


        endAction91();


        if (
          found !== -1
        ) {

          playable = [
            found
          ];
        }
      }


      if (
        playable.length === 0
      ) {

        turn =
          "player";


        visualTurn91(
          "player"
        );


        AcidFX.status(
          "ТВОЙ ХОД"
        );


        V91.botRunning =
          false;


        render();


        return;
      }


      const choice =
        botChoose(
          playable
        );


      V91.botRunning =
        false;


      await botPlay(
        choice,
        false
      );
    };


  /* =======================================================
     PLAYER WILD PLAY

     game.js chooseColor eventually calls playerPlay().
     Override playerPlay so Wild also follows v9.1 logic.
     ======================================================= */

  playerPlay =
    async function (
      cardId,
      chosenColor,
      intercept,
      releasedRect = null
    ) {

      if (
        gameOver
      ) {

        return;
      }


      const index =
        playerIndex(
          cardId
        );


      if (
        index === -1
      ) {

        return;
      }


      const card =
        player[index];


      beginAction91();


      /*
        Wild selected after drag.

        We need a visual flight from saved release point.
      */

      if (
        releasedRect
      ) {

        const target =
          discardTarget91();


        if (
          target
        ) {

          const flying =
            document.createElement(
              "div"
            );


          flying.className =
            `flyingCard ${card.color}`;


          flying.innerHTML = `
            <div class="value">
              ${cardLabel(card.value)}
            </div>
          `;


          $("animationLayer")
            ?.appendChild(
              flying
            );


          Object.assign(
            flying.style,
            {

              position:
                "fixed",

              left:
                `${releasedRect.left}px`,

              top:
                `${releasedRect.top}px`,

              width:
                `${releasedRect.width}px`,

              height:
                `${releasedRect.height}px`

            }
          );


          await new Promise(
            resolve =>
              requestAnimationFrame(
                () =>
                  requestAnimationFrame(
                    resolve
                  )
              )
          );


          const from =
            rectCenter91(
              releasedRect
            );


          const to =
            rectCenter91(
              target
            );


          const dx =
            to.x -
            from.x;


          const dy =
            to.y -
            from.y;


          const scale =
            Math.min(
              target.width /
                releasedRect.width,

              target.height /
                releasedRect.height
            );


          flying.style.transition =
            "transform 205ms cubic-bezier(.18,.82,.2,1), opacity 80ms ease";


          flying.style.transform = `
            translate3d(
              ${dx}px,
              ${dy}px,
              0
            )
            rotate(3deg)
            scale(${scale})
          `;


          await wait91(
            200
          );


          flying.remove();
        }
      }


      const oldHand =
        captureHand91();


      const freshIndex =
        playerIndex(
          cardId
        );


      if (
        freshIndex === -1
      ) {

        endAction91();

        return;
      }


      if (intercept) {

        turn =
          "player";


        burst91(
          "ПЕРЕХВАТ!",
          "acid"
        );
      }


      player.splice(
        freshIndex,
        1
      );


      applyCardState(
        card,
        chosenColor
      );


      render();


      animateHandFrom91(
        oldHand
      );


      await specialEffect91(
        card
      );


      if (
        player.length === 0
      ) {

        endAction91();

        finish(true);

        return;
      }


      handlePlayerUnoAfterPlay91();


      if (
        card.value === "skip" ||
        card.value === "reverse"
      ) {

        turn =
          "player";


        visualTurn91(
          "player"
        );


        AcidFX.status(
          card.value === "skip"
            ? "БОТ ПРОПУСКАЕТ — ТВОЙ ХОД"
            : "РАЗВОРОТ — ТВОЙ ХОД"
        );


        render();


        endAction91();


        return;
      }


      turn =
        "bot";


      visualTurn91(
        "bot"
      );


      AcidFX.status(
        drawPenalty > 0
          ? `БОТ: ШТРАФ +${drawPenalty}`
          : "ХОД БОТА"
      );


      render();


      endAction91();


      setTimeout(
        () => {

          if (
            !gameOver &&
            turn === "bot"
          ) {

            botTurn();
          }

        },
        85
      );
    };


  /* =======================================================
     UNO PLAYER
     ======================================================= */

  const unoButton91 =
    $("unoButton");


  function syncUno91() {

    if (!unoButton91) {
      return;
    }


    const shouldShow =
      !gameOver &&
      turn === "player" &&
      player.length === 2 &&
      !V91.playerUnoCalled;


    unoButton91.classList.toggle(
      "show",
      shouldShow
    );
  }


  function resetPlayerUno91() {

    clearTimeout(
      V91.playerUnoTimer
    );


    V91.playerUnoCalled =
      false;


    V91.playerUnoVulnerable =
      false;


    unoButton91
      ?.classList
      .remove(
        "show",
        "called"
      );
  }


  unoButton91
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


        V91.playerUnoCalled =
          true;


        unoButton91.classList.add(
          "called"
        );


        burst91(
          "UNO!",
          "acid"
        );


        AcidFX.status(
          "UNO!"
        );
      }
    );


  function handlePlayerUnoAfterPlay91() {

    if (
      player.length !== 1
    ) {

      resetPlayerUno91();

      return;
    }


    unoButton91
      ?.classList
      .remove(
        "show"
      );


    if (
      V91.playerUnoCalled
    ) {

      V91.playerUnoVulnerable =
        false;


      return;
    }


    V91.playerUnoVulnerable =
      true;


    clearTimeout(
      V91.playerUnoTimer
    );


    V91.playerUnoTimer =
      setTimeout(
        async () => {

          if (
            gameOver ||
            !V91.playerUnoVulnerable ||
            player.length !== 1
          ) {

            return;
          }


          V91.playerUnoVulnerable =
            false;


          burst91(
            "НЕ СКАЗАЛ UNO! +2",
            "danger"
          );


          const cards =
            takeMany(2);


          for (
            const card of cards
          ) {

            await addPlayerCardAnimated91(
              card
            );


            await wait91(
              45
            );
          }


          resetPlayerUno91();


          render();

        },
        randomBetween91(
          440,
          700
        )
      );
  }


  /* =======================================================
     UNO BOT
     ======================================================= */

  function clearBotUno91() {

    clearTimeout(
      V91.botUnoTimer
    );


    clearTimeout(
      V91.botCatchTimer
    );


    V91.botUnoCalled =
      false;


    V91.botUnoVulnerable =
      false;


    $("bot")
      ?.classList
      .remove(
        "catchable"
      );
  }


  function prepareBotUno91() {

    clearBotUno91();


    V91.botUnoVulnerable =
      true;


    $("bot")
      ?.classList
      .add(
        "catchable"
      );


    V91.botUnoTimer =
      setTimeout(
        () => {

          if (
            gameOver ||
            !V91.botUnoVulnerable ||
            bot.length !== 1
          ) {

            return;
          }


          V91.botUnoCalled =
            true;


          V91.botUnoVulnerable =
            false;


          $("bot")
            ?.classList
            .remove(
              "catchable"
            );


          burst91(
            "БОТ: UNO!",
            "acid"
          );


          AcidFX.status(
            "БОТ: UNO!"
          );

        },
        randomBetween91(
          440,
          700
        )
      );


    V91.botCatchTimer =
      setTimeout(
        () => {

          V91.botUnoVulnerable =
            false;


          $("bot")
            ?.classList
            .remove(
              "catchable"
            );

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
          !V91.botUnoVulnerable ||
          V91.botUnoCalled ||
          bot.length !== 1
        ) {

          return;
        }


        clearBotUno91();


        burst91(
          "ПОЙМАЛ! +2",
          "danger"
        );


        AcidFX.status(
          "БОТ НЕ СКАЗАЛ UNO — +2"
        );


        const cards =
          takeMany(2);


        beginAction91();


        for (
          const card of cards
        ) {

          await botDrawBack91();


          bot.push(
            card
          );


          render();


          await wait91(
            25
          );
        }


        endAction91();
      }
    );


  /* =======================================================
     START GAME
     ======================================================= */

  const baseStartGame91 =
    startGame;


  startGame =
    function () {

      removeDragListeners91();


      V91.drag =
        null;


      V91.lastDrawAt =
        0;


      V91.botRunning =
        false;


      clearAction91();


      resetPlayerUno91();


      clearBotUno91();


      baseStartGame91();


      /*
        Clone deck AFTER game.js startGame rendered it.
      */

      bindDeck91();


      bindV91Hand();


      visualTurn91(
        "player"
      );


      render();
    };


  /* =======================================================
     RESIZE / ROTATE
     ======================================================= */

  function relayout91() {

    /*
      During active drag we don't rebuild the hand.
    */

    if (
      V91.drag
    ) {

      return;
    }


    render();
  }


  window.addEventListener(
    "resize",
    () => {

      clearTimeout(
        relayout91.timer
      );


      relayout91.timer =
        setTimeout(
          relayout91,
          90
        );
    }
  );


  window.addEventListener(
    "orientationchange",
    () => {

      setTimeout(
        relayout91,
        180
      );
    }
  );


  /* =======================================================
     INITIAL BIND
     ======================================================= */

  bindDeck91();


  bindV91Hand();


  visualTurn91(
    turn
  );


  render();


  console.log(
    "ACID UNO v9.1 loaded"
  );

})();
