"use strict";

/* =========================================================
   ACID UNO v6 — ANIMATION ENGINE
   ========================================================= */

const AcidFX = (() => {

  const $ = id => document.getElementById(id);

  const sleep = ms =>
    new Promise(resolve => setTimeout(resolve, ms));


  /* =======================================================
     STATE
     ======================================================= */

  let queue = Promise.resolve();
  let locked = false;


  /* =======================================================
     QUEUE

     Все визуальные действия идут строго по очереди.
     ======================================================= */

  function enqueue(task) {

    queue = queue
      .catch(() => {})
      .then(async () => {

        locked = true;

        const game = $("game");

        if (game) {
          game.classList.add("animating");
        }

        try {
          await task();
        }

        catch (error) {
          console.error(
            "ACID FX:",
            error
          );
        }

        finally {

          locked = false;

          if (game) {
            game.classList.remove("animating");
          }

        }

      });

    return queue;
  }


  function isLocked() {
    return locked;
  }


  /* =======================================================
     RECT HELPERS
     ======================================================= */

  function rectOf(target) {

    if (!target) {
      return null;
    }

    if (typeof target === "string") {
      target =
        document.querySelector(target);
    }

    if (!target) {
      return null;
    }

    return target.getBoundingClientRect();
  }


  function centerOf(rect) {

    return {
      x:
        rect.left +
        rect.width / 2,

      y:
        rect.top +
        rect.height / 2
    };

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

      case "+2":
        return "+2";

      case "+4":
        return "+4";

      default:
        return value;

    }

  }


  function createFlyingCard(
    card,
    faceDown = false
  ) {

    const el =
      document.createElement("div");

    el.className =
      "flyingCard";

    if (faceDown) {

      el.classList.add(
        "flyingCardBack"
      );

      el.innerHTML = `
        <div class="fxCardBack">
          <span>ACID</span>
          <b>UNO</b>
        </div>
      `;

    }

    else {

      el.classList.add(
        card.color
      );

      el.innerHTML = `
        <div class="value">
          ${label(card.value)}
        </div>
      `;

    }

    return el;
  }


  /* =======================================================
     BASIC FLY

     Использует Web Animations API.
     На современных Safari работает без библиотек.
     ======================================================= */

  async function flyElement(
    element,
    fromRect,
    toRect,
    options = {}
  ) {

    const layer =
      $("animationLayer");

    if (
      !layer ||
      !element ||
      !fromRect ||
      !toRect
    ) {
      return;
    }

    const duration =
      options.duration || 430;

    const start =
      centerOf(fromRect);

    const end =
      centerOf(toRect);

    const width =
      options.width ||
      fromRect.width ||
      82;

    const height =
      options.height ||
      fromRect.height ||
      122;

    element.style.width =
      `${width}px`;

    element.style.height =
      `${height}px`;

    element.style.left =
      `${start.x - width / 2}px`;

    element.style.top =
      `${start.y - height / 2}px`;

    layer.appendChild(element);

    /*
      Движение задаём transform,
      чтобы Safari не дёргал layout.
    */

    const dx =
      end.x - start.x;

    const dy =
      end.y - start.y;

    const lift =
      options.lift ?? 45;

    const startRotation =
      options.startRotation || 0;

    const endRotation =
      options.endRotation ??
      (
        -7 +
        Math.random() * 14
      );

    const startScale =
      options.startScale || 1;

    const endScale =
      options.endScale || 1;

    const frames = [

      {
        transform:
          `translate3d(0,0,0)
           rotate(${startRotation}deg)
           scale(${startScale})`,

        opacity: 1
      },

      {
        transform:
          `translate3d(
            ${dx * .48}px,
            ${dy * .48 - lift}px,
            0
          )
          rotate(${
            startRotation +
            (endRotation - startRotation) * .45
          }deg)
          scale(${
            Math.max(
              startScale,
              endScale
            ) * 1.08
          })`,

        opacity: 1,

        offset: .48
      },

      {
        transform:
          `translate3d(
            ${dx}px,
            ${dy}px,
            0
          )
          rotate(${endRotation}deg)
          scale(${endScale})`,

        opacity: 1
      }

    ];

    const animation =
      element.animate(
        frames,
        {
          duration,
          easing:
            "cubic-bezier(.22,.75,.22,1)",
          fill: "forwards"
        }
      );

    await animation.finished
      .catch(() => {});

    element.remove();
  }


  /* =======================================================
     CARD FROM PLAYER → DISCARD
     ======================================================= */

  function playPlayerCard(
    card,
    sourceElement
  ) {

    return enqueue(async () => {

      const source =
        rectOf(sourceElement);

      const discard =
        rectOf("#discard");

      if (!source || !discard) {
        return;
      }

      if (sourceElement) {
        sourceElement.classList.add(
          "card-selected"
        );
      }

      await sleep(90);

      const flying =
        createFlyingCard(card);

      flying.classList.add(
        "fly-active"
      );

      if (sourceElement) {
        sourceElement.style.opacity =
          "0";
      }

      const hand =
        $("hand");

      hand?.classList.add(
        "player-throw"
      );

      await flyElement(
        flying,
        source,
        discard,
        {
          duration: 440,
          lift: 65,
          endRotation:
            -5 + Math.random() * 10
        }
      );

      hand?.classList.remove(
        "player-throw"
      );

      await landing();

    });

  }


  /* =======================================================
     BOT → DISCARD

     Сначала летит рубашка,
     затем в середине переворачивается.
     ======================================================= */

  function playBotCard(card) {

    return enqueue(async () => {

      const botCards =
        $("botCards");

      const discard =
        rectOf("#discard");

      if (
        !botCards ||
        !discard
      ) {
        return;
      }

      const botRect =
        botCards.getBoundingClientRect();

      /*
        Стартуем из центра видимой
        руки бота.
      */

      const startRect = {
        left:
          botRect.left +
          botRect.width / 2 -
          18,

        top:
          botRect.top +
          botRect.height / 2 -
          26,

        width: 36,
        height: 52
      };

      const flying =
        createFlyingCard(
          card,
          true
        );

      flying.classList.add(
        "fly-active"
      );

      flying.style.overflow =
        "visible";

      const layer =
        $("animationLayer");

      if (!layer) return;

      const start =
        centerOf(startRect);

      const end =
        centerOf(discard);

      const width = 82;
      const height = 122;

      flying.style.width =
        `${width}px`;

      flying.style.height =
        `${height}px`;

      flying.style.left =
        `${start.x - width / 2}px`;

      flying.style.top =
        `${start.y - height / 2}px`;

      layer.appendChild(flying);

      botCards.classList.add(
        "bot-throw"
      );

      const dx =
        end.x - start.x;

      const dy =
        end.y - start.y;

      /*
        Первая половина:
        рубашка летит к центру.
      */

      const first =
        flying.animate(
          [
            {
              transform:
                "translate3d(0,0,0) rotateY(0deg) rotate(-5deg) scale(.72)"
            },

            {
              transform:
                `translate3d(
                  ${dx * .5}px,
                  ${dy * .5 - 58}px,
                  0
                )
                rotateY(90deg)
                rotate(5deg)
                scale(1.08)`
            }
          ],
          {
            duration: 250,
            easing: "ease-in",
            fill: "forwards"
          }
        );

      await first.finished
        .catch(() => {});

      /*
        В момент, когда карта ребром,
        меняем рубашку на лицо.
      */

      flying.className =
        `flyingCard fly-active ${card.color}`;

      flying.innerHTML = `
        <div class="value">
          ${label(card.value)}
        </div>
      `;

      const second =
        flying.animate(
          [
            {
              transform:
                `translate3d(
                  ${dx * .5}px,
                  ${dy * .5 - 58}px,
                  0
                )
                rotateY(90deg)
                rotate(5deg)
                scale(1.08)`
            },

            {
              transform:
                `translate3d(
                  ${dx}px,
                  ${dy}px,
                  0
                )
                rotateY(0deg)
                rotate(-3deg)
                scale(1)`
            }
          ],
          {
            duration: 260,
            easing:
              "cubic-bezier(.2,.8,.2,1)",
            fill: "forwards"
          }
        );

      await second.finished
        .catch(() => {});

      flying.remove();

      botCards.classList.remove(
        "bot-throw"
      );

      await landing();

    });

  }


  /* =======================================================
     DRAW ONE CARD

     deck → player
     deck → bot
     ======================================================= */

  function drawCard(
    card,
    target = "player"
  ) {

    return enqueue(async () => {

      const deck =
        $("deck");

      if (!deck) return;

      const from =
        deck.getBoundingClientRect();

      let to;

      if (target === "player") {

        const hand =
          $("hand");

        if (!hand) return;

        const rect =
          hand.getBoundingClientRect();

        to = {
          left:
            rect.left +
            rect.width / 2 -
            35,

          top:
            rect.bottom - 80,

          width: 70,
          height: 105
        };

      }

      else {

        const cards =
          $("botCards");

        if (!cards) return;

        const rect =
          cards.getBoundingClientRect();

        to = {
          left:
            rect.left +
            rect.width / 2 -
            18,

          top:
            rect.top + 10,

          width: 36,
          height: 52
        };

      }

      deck.classList.add(
        "deck-pulse"
      );

      await sleep(80);

      const flying =
        createFlyingCard(
          card,
          target === "bot"
        );

      await flyElement(
        flying,
        from,
        to,
        {
          duration:
            target === "player"
              ? 360
              : 330,

          lift: 38,

          startScale: .85,

          endScale:
            target === "player"
              ? .86
              : .48,

          endRotation:
            target === "player"
              ? 8
              : -6
        }
      );

      deck.classList.remove(
        "deck-pulse"
      );

      const destination =
        target === "player"
          ? $("hand")
          : $("botCards");

      destination?.classList.add(
        "draw-arrival"
      );

      await sleep(180);

      destination?.classList.remove(
        "draw-arrival"
      );

    });

  }


  /* =======================================================
     MULTIPLE DRAW

     Callback выполняется после прилёта
     каждой карты. Так game.js сможет
     добавлять её в руку постепенно.
     ======================================================= */

  async function drawSequence(
    cards,
    target,
    onEach
  ) {

    for (
      let i = 0;
      i < cards.length;
      i++
    ) {

      const card =
        cards[i];

      await drawCard(
        card,
        target
      );

      if (onEach) {
        await onEach(
          card,
          i
        );
      }

      /*
        Небольшая пауза,
        чтобы +8 не выглядел как
        один мгновенный комок.
      */

      await sleep(65);

    }

  }


  /* =======================================================
     DISCARD LANDING
     ======================================================= */

  async function landing() {

    const discard =
      $("discard");

    if (!discard) return;

    discard.classList.remove(
      "card-landed"
    );

    void discard.offsetWidth;

    discard.classList.add(
      "card-landed"
    );

    await sleep(300);

    discard.classList.remove(
      "card-landed"
    );

  }


  /* =======================================================
     FLASH
     ======================================================= */

  async function flash(type = "white") {

    const el =
      $("screenFlash");

    if (!el) return;

    const classes = [
      "flash-white",
      "flash-red",
      "flash-green",
      "flash-purple",
      "flash-blue",
      "flash-yellow"
    ];

    el.classList.remove(
      ...classes
    );

    void el.offsetWidth;

    const className =
      `flash-${type}`;

    el.classList.add(
      className
    );

    await sleep(420);

    el.classList.remove(
      className
    );

  }


  /* =======================================================
     SHAKE
     ======================================================= */

  async function shake(
    strength = "soft"
  ) {

    const game =
      $("game");

    if (!game) return;

    const className =
      strength === "hard"
        ? "shake-hard"
        : "shake-soft";

    game.classList.remove(
      className
    );

    void game.offsetWidth;

    game.classList.add(
      className
    );

    await sleep(
      strength === "hard"
        ? 430
        : 290
    );

    game.classList.remove(
      className
    );

  }


  /* =======================================================
     IMPACT
     ======================================================= */

  async function impact() {

    const ring =
      $("impactRing");

    if (!ring) return;

    ring.classList.remove(
      "hidden",
      "impact"
    );

    void ring.offsetWidth;

    ring.classList.add(
      "impact"
    );

    await sleep(540);

    ring.classList.remove(
      "impact"
    );

    ring.classList.add(
      "hidden"
    );

  }


  /* =======================================================
     ACTION BANNER
     ======================================================= */

  async function banner(
    text,
    icon,
    type = ""
  ) {

    const banner =
      $("actionBanner");

    const textEl =
      $("actionBannerText");

    const iconEl =
      $("actionBannerIcon");

    if (
      !banner ||
      !textEl ||
      !iconEl
    ) {
      return;
    }

    banner.className =
      "actionBanner";

    if (type) {
      banner.classList.add(
        `${type}-banner`
      );
    }

    textEl.textContent =
      text;

    iconEl.textContent =
      icon;

    banner.classList.remove(
      "hidden"
    );

    void banner.offsetWidth;

    banner.classList.add(
      "banner-show"
    );

    await sleep(730);

    banner.classList.remove(
      "banner-show"
    );

    banner.classList.add(
      "hidden"
    );

  }


  /* =======================================================
     PENALTY
     ======================================================= */

  function penalty(amount) {

    return enqueue(async () => {

      const isBig =
        amount >= 4;

      /*
        Banner + flash first.
      */

      await Promise.all([
        banner(
          `+${amount}`,
          "⚠",
          "penalty"
        ),

        flash(
          isBig
            ? "red"
            : "purple"
        ),

        shake(
          isBig
            ? "hard"
            : "soft"
        ),

        impact()
      ]);

      await sleep(80);

    });

  }


  /* =======================================================
     SPECIAL CARD
     ======================================================= */

  function special(type) {

    return enqueue(async () => {

      if (type === "skip") {

        await Promise.all([
          banner(
            "ПРОПУСК",
            "⊘",
            "special"
          ),

          flash("purple")
        ]);

        return;
      }


      if (type === "reverse") {

        await Promise.all([
          banner(
            "РАЗВОРОТ",
            "↻",
            "special"
          ),

          flash("purple")
        ]);

      }

    });

  }


  /* =======================================================
     WILD
     ======================================================= */

  function wild(color) {

    return enqueue(async () => {

      const game =
        $("game");

      const table =
        document.querySelector(
          ".tableInner"
        );

      if (!game) return;

      const wildClass =
        `wild-${color}`;

      game.classList.remove(
        "wild-red",
        "wild-yellow",
        "wild-green",
        "wild-blue"
      );

      game.classList.add(
        wildClass
      );

      if (table) {

        table.classList.remove(
          "color-red",
          "color-yellow",
          "color-green",
          "color-blue"
        );

        table.classList.add(
          `color-${color}`
        );

      }

      await Promise.all([
        flash(color),
        shake("soft")
      ]);

      await sleep(350);

      game.classList.remove(
        wildClass
      );

    });

  }


  /* =======================================================
     ROBOT FINGER
     ======================================================= */

  async function robotFinger() {

    const finger =
      $("robotFinger");

    if (!finger) return;

    finger.classList.remove(
      "hidden",
      "robot-enter",
      "robot-tap"
    );

    void finger.offsetWidth;

    finger.classList.add(
      "robot-enter"
    );

    await sleep(270);

    finger.classList.add(
      "robot-tap"
    );

    await sleep(260);

    finger.classList.remove(
      "robot-tap"
    );

    await sleep(280);

    finger.classList.remove(
      "robot-enter"
    );

    finger.classList.add(
      "hidden"
    );

  }


  /* =======================================================
     INTERCEPT
     ======================================================= */

  function intercept(
    who = "player"
  ) {

    return enqueue(async () => {

      if (who === "bot") {

        await Promise.all([
          robotFinger(),

          banner(
            "ПЕРЕХВАТ",
            "✋",
            "intercept"
          ),

          flash("green"),

          shake("hard")
        ]);

      }

      else {

        await Promise.all([
          banner(
            "ПЕРЕХВАТ",
            "✋",
            "intercept"
          ),

          flash("green"),

          shake("soft")
        ]);

      }

    });

  }


  /* =======================================================
     TURN
     ======================================================= */

  function turn(who) {

    return enqueue(async () => {

      const player =
        $("playerTurnGlow");

      const bot =
        $("botTurnGlow");

      if (!player || !bot) {
        return;
      }

      player.classList.remove(
        "active",
        "turn-pulse"
      );

      bot.classList.remove(
        "active",
        "turn-pulse"
      );

      const target =
        who === "player"
          ? player
          : bot;

      target.classList.add(
        "active"
      );

      void target.offsetWidth;

      target.classList.add(
        "turn-pulse"
      );

      await sleep(500);

      target.classList.remove(
        "turn-pulse"
      );

    });

  }


  /* =======================================================
     STATUS
     ======================================================= */

  function status(text) {

    const el =
      $("status");

    if (!el) return;

    el.textContent =
      text;

    el.classList.remove(
      "status-change"
    );

    void el.offsetWidth;

    el.classList.add(
      "status-change"
    );

    setTimeout(
      () => {
        el.classList.remove(
          "status-change"
        );
      },
      370
    );

  }


  /* =======================================================
     PUBLIC API
     ======================================================= */

  return {

    sleep,

    isLocked,

    playPlayerCard,

    playBotCard,

    drawCard,

    drawSequence,

    penalty,

    special,

    wild,

    intercept,

    turn,

    status,

    flash:
      type =>
        enqueue(
          () => flash(type)
        ),

    shake:
      strength =>
        enqueue(
          () => shake(strength)
        )

  };

})();


/*
  Делаем API явно доступным game.js.
*/

window.AcidFX = AcidFX;