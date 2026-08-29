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
    botPending: false,

    actionDepth: 0,

    playerUnoTimer: null,

    botUnoCalled: false,
    botUnoVulnerable: false,
    botUnoTimer: null,
    botCatchTimer: null,
    botUnoSeat: -1

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

    clearHint91();

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

      armHint91();
    }
  }


  /* =======================================================
     ПОДСКАЗКА

     Только для спокойного стола. Каждый свой ход игрок
     видит, чем можно сходить, а если нечем — что жать
     колоду. Это не автоход: карту всё равно кладёт человек.
     ======================================================= */

  function clearHint91() {

    $("hand")
      ?.classList
      .remove("is-hint");

    $("deck")
      ?.classList
      .remove("is-hint");
  }


  /*
    Партия может кончиться посреди раздумья — тогда гасит
    подсказку game.js через эту ссылку.
  */
  clearHint = clearHint91;


  /*
    Подсказка включается сразу, а не через паузу: тому, кто
    не знает правил, нечего ждать пять секунд — он и через
    пять не поймёт, чего от него хотят. Каждый свой ход он
    видит, какими картами можно сходить, а если нельзя
    ни одной — что жать колоду.
  */
  function armHint91() {

    clearHint91();


    window.AcidCoach?.update();


    if (
      !calmMode ||
      gameOver ||
      turn !== "player"
    ) {

      return;
    }


    if (
      player.some(card => canPlay(card))
    ) {

      $("hand")
        ?.classList
        .add("is-hint");

      return;
    }


    $("deck")
      ?.classList
      .add("is-hint");
  }


  function clearAction91() {

    V91.actionDepth = 0;

    document
      .documentElement
      .classList
      .remove("v91-action");
  }


  /* =======================================================
     ОЖИДАНИЕ КАДРА И АНИМАЦИИ

     В свёрнутой вкладке requestAnimationFrame не срабатывает,
     а Web Animations не проигрываются и finished не резолвится.
     Ход, который их ждёт, повисает навсегда: игрок свернул
     игру посреди хода — вернулся к намертво залипшему столу.

     Поэтому оба ожидания ограничены по времени. Анимация в
     фоне не покажется всё равно, но партия доедет до конца.
     ======================================================= */

  function nextFrame91(fallback = 140) {

    return new Promise(resolve => {

      let done = false;

      const finish = () => {

        if (done) {
          return;
        }

        done = true;

        resolve();
      };

      requestAnimationFrame(
        () =>
          requestAnimationFrame(finish)
      );

      setTimeout(finish, fallback);
    });
  }


  function settled91(animation, ms) {

    return Promise.race([

      animation.finished.catch(() => {}),

      new Promise(
        resolve => setTimeout(resolve, ms)
      )
    ]);
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


  /*
    Надпись про штраф. Ник в ней не нужен: игрок и так видит,
    кто ходил, а вот сколько карт прилетело — главное. Фраза
    каждый раз своя, иначе за партию она превращается в шум,
    который перестаёшь читать.
  */
  const PENALTY_WORDS = [
    "ЛОВИ",
    "ПРИЛЕТЕЛО",
    "НА РУКИ",
    "РАЗБИРАЙ",
    "УГОЩАЙСЯ",
    "ДЕРЖИ",
    "В КАРМАН",
    "ПОДАРОЧЕК",
    "НЕ ЗЕВАЙ",
    "ЗАБИРАЙ"
  ];


  let lastPenaltyWord91 = -1;


  /*
    «2 КАРТ» в счётчике под колодой глаз не режет, а во
    фразе — режет. Считаем по-русски.
  */
  function cardsWord91(count) {

    const tens =
      count % 100;

    const ones =
      count % 10;


    if (
      tens >= 11 &&
      tens <= 14
    ) {
      return "КАРТ";
    }

    if (ones === 1) {
      return "КАРТУ";
    }

    if (
      ones >= 2 &&
      ones <= 4
    ) {
      return "КАРТЫ";
    }

    return "КАРТ";
  }


  /*
    mine — карты забирает живой игрок.

    На спокойном столе шутки убраны: «УГОЩАЙСЯ +4» смешно
    тому, кто уже понял, что произошло, а тому, кто
    разбирается, надо сказать прямым текстом, кто и сколько
    карт сейчас взял.
  */
  function penaltyWord91(count, mine) {

    if (calmMode) {

      return mine
        ? `БЕРЁШЬ ${count} ${cardsWord91(count)}`
        : `СОПЕРНИК БЕРЁТ ${count} ${cardsWord91(count)}`;
    }


    let i = lastPenaltyWord91;

    /* две одинаковые подряд читаются как зависшая надпись */
    while (
      i === lastPenaltyWord91 &&
      PENALTY_WORDS.length > 1
    ) {
      i =
        Math.floor(
          Math.random() * PENALTY_WORDS.length
        );
    }

    lastPenaltyWord91 = i;

    return `${PENALTY_WORDS[i]} +${count}`;
  }


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

        /*
          Полторы секунды вместо шестисот пятидесяти: прежней
          вспышки не хватало, чтобы дочитать фразу до конца.
        */
        1500
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


  /* =======================================================
     СОПЕРНИКИ

     На двоих играет привычная секция #bot с большим веером.
     От трёх мест веер заменяется рядом компактных значков:
     шесть вееров на телефон не помещаются, а число карт
     читать надо у всех сразу.
     ======================================================= */

  function multiSeat91() {
    return seatCount() > 2;
  }


  /*
    Рука места по индексу — не обязательно бота: в комнате
    напротив сидит живой человек.
  */
  function seatOf91(index) {
    return seats[index]?.hand || [];
  }


  /*
    Углы посадки соперников на дуге вокруг стола: 180 —
    слева, 270 — сверху, 360 — справа. Ты всегда снизу,
    поэтому места раскладываются по верхней половине круга,
    как в макете v1.0.
  */
  const SEAT_ANGLES = {
    1: [270],
    2: [206, 334],
    3: [200, 270, 340],
    4: [196, 240, 300, 344],
    5: [193, 231, 270, 309, 347],
    6: [191, 223, 255, 285, 317, 349]
  };


  /*
    Альбом — другая посадка. По высоте там триста точек, и
    дуга сверху вырождается в тесную полоску: соперники
    налезают друг на друга и на стол.

    Зато по ширине места вдоволь, поэтому места разъезжаются
    по краям — левому, верхнему и правому, как в UNO Mobile.
    Углы 180 и 360 — это ровно левый и правый край, без
    подъёма вверх.
  */
  const SEAT_ANGLES_WIDE = {
    1: [270],
    2: [180, 360],
    3: [180, 270, 360],
    4: [180, 234, 306, 360],
    5: [180, 216, 270, 324, 360],
    6: [180, 209, 243, 297, 331, 360]
  };


  function wideSeating91() {

    return (
      window.innerWidth > window.innerHeight &&
      window.innerHeight <= 560
    );
  }


  function seatSpot91(index, total) {

    const table =
      wideSeating91()
        ? SEAT_ANGLES_WIDE
        : SEAT_ANGLES;

    const angles =
      table[total] || table[1];

    const radians =
      angles[index] * Math.PI / 180;

    /*
      Радиусы и центр дуги задаются в CSS: в альбоме стол
      шире и ниже, в портрете выше и уже.
    */
    return {
      x: Math.cos(radians),
      y: Math.sin(radians)
    };
  }


  /*
    Лицо соперника — маленький экран с осциллограммой. У
    каждого своя форма волны, и различать их можно не читая
    имя: синус, пила, импульс, шум, кардиограмма.

    Эмодзи тут были плохи вдвойне — на каждой платформе
    рисуются по-своему и выглядят вставкой из другой оперы.
  */
  const OPPONENT_FACES = 5;


  const WAVE_FORMS = [

    /* синус */
    x => Math.sin(x * 0.32),

    /* пила */
    x => ((x * 0.11) % 2) - 1,

    /* импульс */
    x =>
      (Math.sin(x * 0.19) > 0 ? 0.72 : -0.72) +
      Math.sin(x * 1.7) * 0.08,

    /* шум */
    x =>
      Math.sin(x * 0.9) * 0.4 +
      Math.sin(x * 2.7) * 0.3 +
      Math.sin(x * 0.31) * 0.35,

    /* кардиограмма */
    x => {

      const p = x % 46;

      return p < 4
        ? p / 4 * 1.1
        : p < 9
          ? 1.1 - (p - 4) / 5 * 1.7
          : p < 13
            ? -0.6 + (p - 9) / 4 * 0.6
            : Math.sin(x * 0.5) * 0.08;
    }
  ];


  /*
    Точки считаются один раз на форму: пересчитывать их на
    каждой перерисовке стола незачем, волна не меняется.
  */
  const WAVE_POINTS =
    WAVE_FORMS.map(shape => {

      const points = [];

      for (let x = 0; x <= 60; x += 1) {
        points.push(
          `${x},${(14 - shape(x * 2.4) * 9).toFixed(1)}`
        );
      }

      return points.join(" ");
    });


  /* сколько рубашек показываем в веере соперника */
  const FAN_MAX = 8;


  function opponentMarkup91(seat, index, total) {

    const spot =
      seatSpot91(index, total);

    const face =
      (seat.index - 1 + OPPONENT_FACES) %
      OPPONENT_FACES;

    /*
      Портрет вынесен из плашки и стоит отдельно, слева от
      веера: там он может быть крупным, а раньше был зажат
      между именем и числом внутри узкой плашки. Имя и число
      ушли под карты — туда, где их и ищут глазами.

      В альбоме соперники сидят по бокам стола, и портрет там
      встаёт сверху: сбоку ему просто некуда — см. CSS.
    */
    return `
      <button
        class="opponent"
        type="button"
        data-seat="${seat.index}"
        style="--sx:${spot.x.toFixed(3)};--sy:${spot.y.toFixed(3)}"
        aria-label="${seatName(seat.index)}"
      >
        <span
          class="opponentFace"
          data-face="${face}"
        ><svg viewBox="0 0 60 28" preserveAspectRatio="none"><polyline
          points="${WAVE_POINTS[face]}"
        /></svg></span>

        <span class="opponentSide">

          <span class="opponentFan"></span>

          <span class="opponentPlate">
            <span class="opponentName">${seatName(seat.index)}</span>
            <span class="opponentCount">0</span>
          </span>

        </span>
      </button>
    `;
  }


  /*
    Веер рубашек: за столом количество карт читают глазами
    по толщине веера, а не по цифре. Цифра остаётся рядом,
    потому что после десятка карт веер перестаёт расти.
  */
  function paintFan91(element, count) {

    const visible =
      Math.min(count, FAN_MAX);

    if (
      element.childElementCount !== visible
    ) {

      element.innerHTML =
        Array.from(
          { length: visible },
          (ignored, i) =>
            `<i class="opponentBack" style="--i:${i}"></i>`
        ).join("");
    }

    element.style.setProperty(
      "--fan",
      String(Math.max(visible, 1))
    );
  }


  function renderOpponents91() {

    const row =
      $("opponents");

    const solo =
      $("bot");


    if (!row) {
      return;
    }


    /*
      Секция #bot из старой раскладки больше не нужна:
      теперь по дуге сидят все соперники, включая
      единственного.
    */
    solo?.classList.add("hidden");

    row.classList.remove("hidden");


    const me =
      AcidStore.mySeat();

    const others =
      seats.filter(
        seat => seat.index !== me
      );


    row.dataset.count =
      String(others.length);


    /*
      Значки пересобираются только когда меняется состав
      стола: иначе анимация «поймал UNO» сбрасывалась бы
      на каждой перерисовке.

      Состав — это кто сидит и как его зовут, а не сколько
      их. По одному числу за столом на двоих ничего никогда
      не менялось: до входа в комнату клиент считает себя
      нулевым местом и рисует соперником первое, а когда
      комната выдаёт место и имена, соперник по-прежнему
      один — и живой человек навсегда остаётся подписан
      «ACID BOT» на чужом месте.
    */
    const lineup =
      others
        .map(
          seat =>
            `${seat.index}:${seatName(seat.index)}`
        )
        .join(",");


    if (
      row.dataset.lineup !== lineup ||
      row.childElementCount !== others.length
    ) {

      row.dataset.lineup = lineup;

      row.innerHTML =
        others
          .map(
            (seat, index) =>
              opponentMarkup91(
                seat,
                index,
                others.length
              )
          )
          .join("");
    }


    others.forEach((seat, index) => {

      const el =
        row.querySelector(
          `.opponent[data-seat="${seat.index}"]`
        );

      if (!el) {
        return;
      }

      el.querySelector(".opponentCount")
        .textContent =
          String(seat.hand.length);

      paintFan91(
        el.querySelector(".opponentFan"),
        seat.hand.length
      );


      /*
        Портрет ложится в ту же плашку, где живёт волна. Нет
        картинки — волна остаётся, стол не рассыпается.
      */
      window.AcidAssets?.dressFace(
        el.querySelector(".opponentFace"),
        seatFaceIndex(seat.index)
      );


      /*
        Посадку переписываем на каждой отрисовке. Список
        мест от поворота телефона не меняется, значок не
        пересобирается — а посадка в альбоме и в портрете
        разная, и без этого соперники остались бы сидеть
        по-старому до конца партии.
      */
      const spot =
        seatSpot91(
          index,
          others.length
        );

      el.style.setProperty("--sx", spot.x.toFixed(3));
      el.style.setProperty("--sy", spot.y.toFixed(3));

      el.classList.toggle(
        "is-active",
        seat.index === activeSeat &&
        !gameOver
      );

      el.classList.toggle(
        "is-low",
        seat.hand.length === 1
      );

      /*
        Одна карта у соперника — событие, а не оттенок цифры.
        В мобильном UNO над таким игроком висит метка, и её
        видно через весь стол.
      */
      el.dataset.uno =
        seat.hand.length === 1 ? "1" : "0";
    });
  }


  renderBot =
    function () {

      renderOpponents91();


      /*
        Веер соперника теперь рисуется в его значке,
        секция #bot не используется.
      */
      return;


      const countEl =
        $("botCount");


      const other =
        (AcidStore.mySeat() + 1) % seatCount();


      const nameEl =
        document.querySelector(
          ".botInfo strong"
        );

      if (nameEl) {

        nameEl.textContent =
          AcidStore.online()
            ? seatName(other)
            : "ACID BOT";
      }


      if (countEl) {

        countEl.textContent =
          `${seatOf91(other).length} КАРТ`;
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

    renderOpponents91();


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


    /*
      Своё место подсвечивается через саму руку: прежний
      #playerTurnGlow лежит в #playerArea нулевой ширины и
      показаться не мог.
    */
    $("hand")
      ?.classList
      .toggle(
        "is-turn",
        playerTurn && !gameOver
      );


    /*
      Своё имя за столом обязано загораться так же, как имя
      соперника: иначе на своём ходу подсвечен никто.
    */
    document
      .querySelector(".playerHUD")
      ?.classList
      .toggle(
        "is-turn",
        playerTurn && !gameOver
      );


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

  /*
    Направление хода имеет смысл только от трёх мест:
    на двоих разворот работает как пропуск.
  */
  function renderDirection91() {

    const el =
      $("direction");

    if (!el) {
      return;
    }

    /*
      Кольцо показываем всегда, а не только за столом от
      трёх мест. На двоих направление и правда ничего не
      значит — ход просто возвращается, — но кольцо носит и
      второе сообщение: оно окрашено в текущий цвет стола.
      Без него понять, каким цветом сейчас играют, можно
      было только по надписи сбоку.

      Стрелки на двоих гасятся (класс solo), остаётся ровное
      цветное кольцо вокруг стопок.
    */
    el.classList.remove("hidden");

    el.classList.toggle(
      "solo",
      !multiSeat91()
    );

    /*
      Стрелки лежат в разметке — трогать содержимое нельзя,
      иначе они сотрутся. Отсюда задаётся только цвет и
      сторона вращения.
    */
    el.style.setProperty(
      "--turn",
      `var(--${currentColor})`
    );

    el.classList.toggle(
      "reversed",
      direction === -1
    );
  }


  const baseRender91 =
    render;


  render =
    function () {

      baseRender91();

      bindV91Hand();

      updatePlayableGlow91();

      renderDirection91();

      syncUno91();
    };


  /* =======================================================
     НОВЫЕ КАРТЫ В РУКУ

     Карты уже в состоянии — здесь только показать, как они
     туда прилетели:

       1) рука приоткрывается
       2) render перестраивает веер
       3) старые карты уезжают на новые места
       4) новые летят из колоды в свои слоты
     ======================================================= */

  /*
    След летящей карты: короткая полоса от места вылета к
    месту приземления, гаснущая за полсекунды. Настоящий шлейф
    из копий кадра браузер не потянет, а полоса по вектору
    полёта читается так же и стоит один элемент.
  */
  function trail91(from, to, color, delay) {

    const x1 = from.left + from.width / 2;
    const y1 = from.top + from.height / 2;
    const x2 = to.left + to.width / 2;
    const y2 = to.top + to.height / 2;

    const dx = x2 - x1;
    const dy = y2 - y1;

    const len = Math.hypot(dx, dy);

    /* совсем короткий перелёт следа не оставляет */
    if (len < 40) {
      return;
    }

    window.setTimeout(
      () => {

        const bar =
          document.createElement("div");

        bar.className = "cardTrail";

        bar.style.left = `${x1}px`;
        bar.style.top = `${y1}px`;
        bar.style.width = `${len}px`;

        bar.style.transform =
          `rotate(${Math.atan2(dy, dx)}rad)`;

        bar.style.setProperty(
          "--trail",
          `var(--${color || "purple"})`
        );

        document.body.appendChild(bar);

        window.setTimeout(
          () => bar.remove(),
          560
        );
      },
      delay || 0
    );
  }


  function flyFromDeck91(card, delay) {

    const target =
      playerCardElement(card.id);

    const deckEl =
      $("deck");

    if (!target || !deckEl) {
      return;
    }


    const deckRect =
      deckEl.getBoundingClientRect();

    const targetRect =
      target.getBoundingClientRect();

    const deckCenter =
      rectCenter91(deckRect);

    const targetCenter =
      rectCenter91(targetRect);


    const dx =
      deckCenter.x - targetCenter.x;

    const dy =
      deckCenter.y - targetCenter.y;

    const scale =
      Math.min(
        deckRect.width /
          Math.max(targetRect.width, 1),

        deckRect.height /
          Math.max(targetRect.height, 1)
      );


    trail91(
      deckRect,
      targetRect,
      card.color === "wild" ? "purple" : card.color,
      delay
    );


    target.classList.remove(
      "v9-playable",
      "playable"
    );


    target.animate(
      [
        {
          translate: `${dx}px ${dy}px`,
          scale: String(scale),
          rotate: "-7deg",
          opacity: .94
        },
        {
          translate: "0px 0px",
          scale: "1",
          rotate: "0deg",
          opacity: 1
        }
      ],
      {
        duration: 285,

        /*
          Штрафные карты вылетают не разом, а очередью:
          fill backwards держит карту у колоды до её очереди.
        */
        delay,

        fill: "backwards",

        easing: "cubic-bezier(.18,.82,.2,1)"
      }
    );
  }


  async function animateIncoming91(cards) {

    const hand =
      $("hand");

    if (
      !hand ||
      !cards.length
    ) {

      render();

      return;
    }


    beginAction91();


    hand.classList.add(
      "v91-receiving"
    );


    await wait91(70);


    /*
      Снимок берём с ещё не перестроенного DOM.
    */
    const before =
      captureHand91();


    render();


    animateHandFrom91(
      before,
      260
    );


    /*
      Пауза между картами должна читаться глазом: при штрафе
      +6 шесть карт, вылетающих почти одновременно, выглядят
      как одна вспышка, и непонятно, сколько же ты взял.

      Но постоянный шаг наказывает за большой штраф дважды:
      двенадцать карт по 145 мс — это почти две секунды, за
      которые уже нечего разглядывать. Поэтому вся раздача
      укладывается в общий бюджет, а шаг сжимается под него.
      До шести карт включительно ничего не меняется.
    */
    const STEP =
      Math.max(
        45,
        Math.min(
          145,
          Math.round(
            760 / Math.max(1, cards.length - 1)
          )
        )
      );

    cards.forEach(
      (card, index) =>
        flyFromDeck91(
          card,
          index * STEP
        )
    );


    await wait91(
      235 + (cards.length - 1) * STEP
    );


    hand.classList.remove(
      "v91-receiving"
    );


    endAction91();
  }


  /*
    Карты, прилетевшие игроку в этом действии.
  */
  function drawnCards91(events, seat) {

    return events
      .filter(
        event =>
          (
            event.type === "drew" ||
            event.type === "penalty" ||
            event.type === "caught"
          ) &&
          (
            event.seat === seat ||
            event.target === seat
          )
      )
      .flatMap(
        event => event.cards
      );
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


    await nextFrame91();


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


    await settled91(animation, 285);


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

      window.AcidCoach?.refuse(d.card);

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


    await nextFrame91();


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


    await settled91(animation, 285);


    return true;
  }


  /* =======================================================
     SPECIAL EFFECT
     ======================================================= */

  /*
    Спокойный стол называет вещи своими именами. «ПРОПУСК»
    понятен тому, кто уже играл; тому, кто разбирается,
    нужно сказать, чей теперь ход и сколько карт брать.

    mine — карту положил живой игрок: «+2 соперникy» и
    «+2 тебе» это разные новости, а карта одна и та же.
  */
  function calmWord91(card, mine) {

    const pair =
      seatCount() === 2;


    if (card.value === "+2") {

      return mine
        ? "+2 СОПЕРНИКУ"
        : "+2 ТЕБЕ · ВОЗЬМЁШЬ ДВЕ";
    }


    if (card.value === "+4") {

      return mine
        ? "+4 СОПЕРНИКУ · ЦВЕТ ТВОЙ"
        : "+4 ТЕБЕ · ВОЗЬМЁШЬ ЧЕТЫРЕ";
    }


    if (
      card.value === "skip" ||
      card.value === "reverse"
    ) {

      const word =
        card.value === "skip"
          ? "ПРОПУСК"
          : "РАЗВОРОТ";


      /*
        На двоих обе карты означают одно: ход возвращается
        тому, кто их положил.
      */
      if (pair) {

        return mine
          ? `${word} · ХОДИШЬ СНОВА`
          : `${word} · СОПЕРНИК ХОДИТ СНОВА`;
      }


      return card.value === "skip"
        ? "ПРОПУСК · СОСЕД ОСТАЁТСЯ БЕЗ ХОДА"
        : "РАЗВОРОТ · КРУГ ПОШЁЛ ОБРАТНО";
    }


    /*
      Про чёрную карту молчим. Цвет и так объявляет вспышка
      посреди стола, а два сообщения об одном и том же
      ложились друг на друга и становились нечитаемым
      месивом поверх колоды. К тому же «выбираешь цвет»
      появлялось уже после того, как цвет выбран.
    */
    if (card.color === "wild") {

      return null;
    }


    return null;
  }


  async function specialEffect91(card, mine) {

    if (!card) {
      return;
    }


    if (calmMode) {

      const word =
        calmWord91(card, Boolean(mine));


      if (word) {

        burst91(
          word,

          card.value === "+2" || card.value === "+4"
            ? "danger"
            : "acid"
        );


        await wait91(230);
      }

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
     ПЕРЕДАЧА ХОДА

     Одно место на всю игру, где ход уходит дальше по кругу.
     На столе из семи мест подряд может сходить до шести
     ботов, поэтому следующего соперника запускаем сами.
     ======================================================= */

  /*
    Пропуск и разворот на двоих возвращают ход тому же
    игроку, на большом столе — уводят дальше по кругу.
    Что именно случилось, знает событие хода из редьюсера.
  */
  function specialTurnStatus91(card, events) {

    if (
      card.value !== "skip" &&
      card.value !== "reverse"
    ) {

      return null;
    }

    const moved =
      events.find(
        event => event.type === "turn"
      );

    if (moved?.again) {

      return card.value === "skip"
        ? "ПРОПУСК — ХОДИШЬ СНОВА"
        : "РАЗВОРОТ — ХОДИШЬ СНОВА";
    }

    return card.value === "skip"
      ? "ПРОПУСК"
      : "РАЗВОРОТ";
  }


  /*
    Ход уже передан редьюсером — здесь только показать это
    и запустить следующего соперника: на столе из семи мест
    подряд может сходить до шести ботов.
  */
  function announceTurn91(options) {

    const settings = options || {};

    visualTurn91(turn);

    AcidFX.status(
      settings.status || turnStatus91()
    );

    render();

    armHint91();

    /*
      В комнате за соседними местами живые люди: ждём их
      ходов потоком, а не запускаем ИИ.
    */
    if (
      turn !== "bot" ||
      AcidStore.online()
    ) {
      return;
    }

    setTimeout(
      () => {

        if (
          !gameOver &&
          turn === "bot"
        ) {

          botTurn();
        }

      },
      settings.delay ?? 90
    );
  }


  /*
    На спокойном столе строка под столом не сообщает
    положение дел, а говорит, что сделать. «ТВОЙ ХОД» —
    бесполезная новость тому, кто не знает, чем ходить
    можно, а чем нельзя.
  */
  function calmStatus91() {

    if (turn !== "player") {

      return null;
    }


    const canMove =
      player.some(card => canPlay(card));


    if (drawPenalty > 0) {

      return canMove
        ? `ШТРАФ +${drawPenalty} · НАКРОЙ ИЛИ БЕРИ`
        : `ШТРАФ +${drawPenalty} · ЖМИ КОЛОДУ`;
    }


    return canMove
      ? "ТЯНИ ГОРЯЩУЮ КАРТУ В ЦЕНТР"
      : "НЕЧЕМ ХОДИТЬ · ЖМИ КОЛОДУ";
  }


  function turnStatus91() {

    if (calmMode) {

      const calm =
        calmStatus91();


      if (calm) {
        return calm;
      }
    }


    if (turn === "player") {

      return drawPenalty > 0
        ? `ШТРАФ +${drawPenalty}`
        : "ТВОЙ ХОД";
    }

    return drawPenalty > 0
      ? `${seatName(activeSeat)}: ШТРАФ +${drawPenalty}`
      : seatCount() > 2 || AcidStore.online()
        ? `ХОДИТ ${seatName(activeSeat)}`
        : "ХОД БОТА";
  }


  /*
    Отказ хода обязан называть причину. В одиночной игре
    ошибка бывает только правилом, а в комнате к ним
    добавляется сеть — и «нет связи с комнатой» выглядело
    на экране либо ничем, либо чужим текстом про колоду.
    Игрок в этот момент не отличает обрыв от запрета.
  */
  function reportError91(error) {

    AcidFX.status(
      String(error).toUpperCase()
    );
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


    /*
      Состояние меняется только после того, как карта
      физически доехала до сброса.
    */
    const result =
      await AcidStore.dispatch({
        type: "play",
        seat: AcidStore.mySeat(),
        cardId: card.id,
        color: chosenColor
      });


    V91.drag =
      null;


    d.source.remove();


    d.placeholder
      ?.remove();


    if (result.error) {

      render();

      /* причина ставится последней: render трогает тот же экран */
      reportError91(result.error);


      return false;
    }


    /*
      В комнате карта уедет в сброс по событию с сервера.
    */
    if (result.pending) {

      endAction91();


      return true;
    }


    if (intercept) {

      burst91(
        "ПЕРЕХВАТ!",
        "acid"
      );
    }


    render();


    animateHandFrom91(
      oldHand,
      250
    );


    window.AcidCoach?.notify("play");


    await specialEffect91(
      card,
      true
    );


    if (
      finishedByEvents91(result.events)
    ) {

      return true;
    }


    watchPlayerUno91();


    announceTurn91({
      status:
        specialTurnStatus91(
          card,
          result.events
        ),

      delay: 85
    });


    endAction91();


    return true;
  }


  /*
    Партия кончилась внутри редьюсера — остаётся показать это.
  */
  function finishedByEvents91(events) {

    const over =
      events.find(
        event => event.type === "over"
      );

    if (!over) {
      return false;
    }

    endAction91();

    finish(
      over.winner === AcidStore.mySeat()
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


      const penalty =
        drawPenalty > 0;


      const result =
        await AcidStore.dispatch({
          type: "draw",
          seat: AcidStore.mySeat()
        });


      if (result.error) {

        reportError91(result.error);


        return;
      }


      if (result.pending) {
        return;
      }


      const cards =
        drawnCards91(
          result.events,
          AcidStore.mySeat()
        );


      if (penalty) {

        burst91(
          penaltyWord91(cards.length, true),
          "danger"
        );
      }


      await animateIncoming91(cards);


      /*
        Штраф забирают целиком, и на этом ход заканчивается.
        Добровольный добор ход не отдаёт.
      */
      if (penalty) {

        announceTurn91();


        return;
      }


      const card =
        cards[cards.length - 1];


      render();


      AcidFX.status(
        canPlay(card)
          ? "МОЖЕШЬ СЫГРАТЬ ИЛИ ВЗЯТЬ ЕЩЁ"
          : "МОЖЕШЬ ВЗЯТЬ ЕЩЁ"
      );


      /*
        Взятая карта — лучший момент для урока: правило
        проверяется прямо на ней, и сразу видно, чем
        кончилось.
      */
      window.AcidCoach?.notify("draw");

      window.AcidCoach?.say(
        canPlay(card)
          ? `В РУКУ: ${AcidRules.cardLabel(card)} — ЭТА ПОДХОДИТ, ` +
            "МОЖЕШЬ СРАЗУ ЕЁ ПОЛОЖИТЬ"
          : `В РУКУ: ${AcidRules.cardLabel(card)} — ЭТА НЕ ПОДХОДИТ, ` +
            "ЖМИ КОЛОДУ ЕЩЁ РАЗ",
        3200
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

  async function botDrawBack91(seat) {

    const deckEl =
      $("deck");


    const botArea =
      opponentElement91(
        seat ?? activeSeat
      ) ||
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


    /* рубашка масти не показывает — след идёт фиолетовым */
    trail91(from, to, "purple", 0);


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


    await nextFrame91();


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


    /*
      Во что карта должна превратиться, долетев. Раньше
      размер считался тут заново — 84 на свой коэффициент, —
      и после того как размеры веера переехали в CSS, летящая
      карта приземлялась не того размера, что лежащие рядом.

      Теперь спрашиваем у настоящей рубашки в веере. Её нет
      (совсем пустая рука) — считаем по-старому.
    */
    const backEl =
      document.querySelector(".opponentBack");

    const targetWidth =
      backEl?.offsetWidth ||
      84 *
        getBotFanLayout91(
          Math.max(bot.length + 1, 1)
        ).scale;


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
          ? `${seatName(activeSeat)}: ПЕРЕХВАТ`
          : `ХОДИТ ${seatName(activeSeat)}`
      );


      /*
        Existing animation can stay for bot card play.
        Its delay is no longer preceded by 800ms think time.
      */

      const seat =
        activeSeat;


      await AcidFX.playBotCard(
        card
      );


      const result =
        await AcidStore.dispatch({
          type: "play",
          seat,
          cardId: card.id,
          color: chosenColor
        });


      if (result.error) {

        endAction91();


        return;
      }


      render();


      /*
        На учебном столе каждый чужой ход называется вслух:
        карты соперника лежат рубашкой вверх, и без слов
        непонятно даже то, что он вообще сходил.

        Без глагола: имена ботов и мужские, и женские, а
        «Джо положила» — ровно та мелочь, по которой видно,
        что текст писали не для людей.
      */
      window.AcidCoach?.notify("bot");

      window.AcidCoach?.say(
        chosenColor
          ? `ХОД ${seatName(seat)}: ЧЁРНАЯ, ` +
            `ЦВЕТ ТЕПЕРЬ ${AcidRules.colorWord(chosenColor)}`
          : `ХОД ${seatName(seat)}: ${AcidRules.cardLabel(card)}`
      );


      await specialEffect91(
        card,
        false
      );


      if (
        finishedByEvents91(result.events)
      ) {

        clearBotUno91();


        return;
      }


      if (
        willHaveOne &&
        AcidStore.seatOf(seat).hand.length === 1
      ) {

        prepareBotUno91(seat);
      }


      announceTurn91({
        status:
          specialTurnStatus91(
            card,
            result.events
          ),

        delay: 85
      });


      endAction91();
    };


  /* =======================================================
     BOT TURN
     ======================================================= */

  botTurn =
    async function () {

      if (
        gameOver ||
        turn !== "bot"
      ) {

        return;
      }


      /*
        Ход бота держит флаг до самого конца, включая полёт
        карты. Раньше флаг снимался ПЕРЕД botPlay, и на время
        анимации защита была открыта: второй запуск успевал
        влезть, и за столом из нескольких ботов две цепочки
        шли внахлёст — карты ложились одна за другой уже в
        чужой ход.

        Пришедший в это время запуск не теряется, а ждёт
        своей очереди: иначе цепочка ходов просто обрывалась
        бы посреди круга.
      */
      if (V91.botRunning) {

        V91.botPending = true;

        return;
      }


      V91.botRunning = true;


      try {

        await runBotTurn91();

      } finally {

        V91.botRunning = false;

        if (V91.botPending) {

          V91.botPending = false;

          setTimeout(
            () => {

              if (
                !gameOver &&
                turn === "bot"
              ) {

                botTurn();
              }

            },
            40
          );
        }
      }
    };


  async function runBotTurn91() {




      /*
        INTERCEPT = human-like reaction
      */

      const interceptIndex =
        botInterceptIndex();


      /*
        Перехват — правило не для первой партии: карта
        соперника улетает вне очереди, и новичок теряет нить
        того, чей сейчас ход. На спокойном столе его нет.
      */
      if (
        interceptIndex !== -1 &&
        !calmMode &&
        Math.random() < .82
      ) {

        AcidFX.status(
          `${seatName(activeSeat)} ЗАМЕТИЛ ПЕРЕХВАТ...`
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
        `${seatName(activeSeat)} ДУМАЕТ...`
      );


      await wait91(
        calmMode
          ? randomBetween91(700, 1100)
          : randomBetween91(55, 115)
      );


      if (
        gameOver ||
        turn !== "bot"
      ) {

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


        /*
          На спокойном столе бот штраф не перекрывает, а
          забирает: кластер «+2 накрыли +4, стало +6» —
          первое, на чём новичок теряет нить. Та же
          поблажка живёт в src/bot.js для комнаты.
        */
        if (
          defense.length > 0 &&
          !calmMode
        ) {

          const choice =
            botChoose(
              defense
            );


          await botPlay(
            choice,
            false
          );


          return;
        }


        const seat =
          activeSeat;


        const result =
          await AcidStore.dispatch({
            type: "draw",
            seat
          });


        if (result.error) {

          announceTurn91();


          return;
        }


        const cards =
          drawnCards91(result.events, seat);


        burst91(
          penaltyWord91(cards.length, false),
          "danger"
        );


        beginAction91();


        for (
          let i = 0;
          i < cards.length;
          i++
        ) {

          await botDrawBack91(seat);


          await wait91(25);
        }


        render();


        /*
          Принять штраф — значит закончить ход.
        */

        endAction91();


        announceTurn91();


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
          `${seatName(activeSeat)} ДОБИРАЕТ...`
        );


        window.AcidCoach?.say(
          `У ${seatName(activeSeat)} НЕЧЕМ ХОДИТЬ — ` +
          "БЕРЁТ ИЗ КОЛОДЫ"
        );


        const seat =
          activeSeat;


        let safety = 0;


        beginAction91();


        /*
          Тянем по одной, пока не найдётся подходящая.
          Добровольный добор ход не отдаёт, поэтому редьюсер
          оставляет место за тем же соперником.
        */
        while (
          playable.length === 0 &&
          safety < 150
        ) {

          safety++;


          const result =
            await AcidStore.dispatch({
              type: "draw",
              seat
            });


          if (result.error) {

            break;
          }


          await botDrawBack91(seat);


          render();


          playable =
            botPlayableIndexes();


          await wait91(22);
        }


        endAction91();
      }


      if (
        playable.length === 0
      ) {

        /*
          Ходить нечем и брать неоткуда.
        */
        await AcidStore.dispatch({
          type: "pass",
          seat: activeSeat
        });


        announceTurn91();


        return;
      }


      const choice =
        botChoose(
          playable
        );


      await botPlay(
        choice,
        false
      );
    }


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

          trail91(
            releasedRect,
            target,
            card.color === "wild" ? "magenta" : card.color,
            0
          );


          const flying =
            document.createElement(
              "div"
            );


          flying.className =
            `flyingCard ${card.color}`;


          flying.innerHTML =
            cardFaceHTML(card);


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


          await nextFrame91();


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


      const result =
        await AcidStore.dispatch({
          type: "play",
          seat: AcidStore.mySeat(),
          cardId,
          color: chosenColor
        });


      if (result.error) {

        endAction91();

        render();

        reportError91(result.error);

        return;
      }


      if (result.pending) {

        endAction91();

        return;
      }


      if (intercept) {

        burst91(
          "ПЕРЕХВАТ!",
          "acid"
        );
      }


      render();


      animateHandFrom91(
        oldHand
      );


      window.AcidCoach?.notify("play");


      await specialEffect91(
        card,
        true
      );


      if (
        finishedByEvents91(result.events)
      ) {

        return;
      }


      watchPlayerUno91();


      announceTurn91({
        status:
          specialTurnStatus91(
            card,
            result.events
          ),

        delay: 85
      });


      endAction91();
    };


  /* =======================================================
     UNO PLAYER
     ======================================================= */

  const unoButton91 =
    $("unoButton");


  /*
    Объявление живёт в состоянии партии (seats[0].unoCalled),
    а не в отдельном флаге интерфейса. Любой рост руки снимает
    его прямо в редьюсере — из-за отсутствия этого сброса
    кнопка когда-то переставала появляться после первого же
    удачного «UNO!».
  */
  function syncUno91() {

    if (!unoButton91) {
      return;
    }


    const seat =
      AcidStore.seatOf(
        AcidStore.mySeat()
      );

    if (!seat) {
      return;
    }


    unoButton91.classList.toggle(
      "show",

      !gameOver &&
      turn === "player" &&
      seat.hand.length === AcidRules.UNO_HAND_SIZE &&
      !seat.unoCalled
    );


    unoButton91.classList.toggle(
      "called",
      Boolean(seat.unoCalled)
    );
  }


  function resetPlayerUno91() {

    clearTimeout(
      V91.playerUnoTimer
    );


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
      async event => {

        event.preventDefault();

        event.stopPropagation();


        const result =
          await AcidStore.dispatch({
            type: "uno",
            seat: AcidStore.mySeat()
          });


        if (result.error) {
          return;
        }


        syncUno91();


        burst91(
          "UNO!",
          "acid"
        );


        AcidFX.status(
          "UNO!"
        );
      }
    );


  /*
    Осталась одна карта и объявления не было — соперник ловит
    через полсекунды, как живой человек.
  */
  function watchPlayerUno91() {

    clearTimeout(
      V91.playerUnoTimer
    );


    syncUno91();


    /*
      В комнате ловят живые соперники, а не таймер.
    */
    if (
      AcidStore.online() ||
      !AcidStore.seatOf(AcidStore.mySeat())?.unoVulnerable
    ) {

      return;
    }


    /*
      На спокойном столе за забытое UNO не наказывают: окно
      просто закрывается само, и об этом говорят вслух.
      Кнопка при этом остаётся живой и её видно — иначе
      правило так и не выучится.
    */
    if (calmMode) {

      V91.playerUnoTimer =
        setTimeout(
          async () => {

            if (gameOver) {
              return;
            }


            const result =
              await AcidStore.dispatch({
                type: "closeUno",
                target: AcidStore.mySeat()
              });


            if (result.error) {
              return;
            }


            burst91(
              "UNO! СКАЗАЛИ ЗА ТЕБЯ",
              "acid"
            );


            render();

          },
          2600
        );


      return;
    }


    V91.playerUnoTimer =
      setTimeout(
        async () => {

          if (gameOver) {
            return;
          }


          const me =
            AcidStore.mySeat();

          const catcher =
            (me + 1) % seats.length;


          const result =
            await AcidStore.dispatch({
              type: "catch",
              seat: catcher,
              target: me
            });


          if (result.error) {
            return;
          }


          burst91(
            "НЕ СКАЗАЛ UNO! +2",
            "danger"
          );


          await animateIncoming91(
            drawnCards91(
              result.events,
              AcidStore.mySeat()
            )
          );


          render();

        },
        randomBetween91(440, 700)
      );
  }


  /* =======================================================
     UNO СОПЕРНИКА

     Ловить можно любого соперника: уязвимым становится тот,
     кто только что скинулся до одной карты, и только он.
     ======================================================= */

  function opponentElement91(seat) {

    return document.querySelector(
      `.opponent[data-seat="${seat}"]`
    );
  }


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


    document
      .querySelectorAll(
        ".catchable"
      )
      .forEach(
        el =>
          el.classList.remove("catchable")
      );


    V91.botUnoSeat =
      -1;
  }


  function prepareBotUno91(target) {

    const seat =
      target ?? activeSeat;


    clearBotUno91();


    /*
      В комнате никто не объявляет UNO за игрока: окно
      закрывает он сам или его ловят.
    */
    if (AcidStore.online()) {

      V91.botUnoSeat = seat;

      V91.botUnoVulnerable = true;

      opponentElement91(seat)
        ?.classList
        .add("catchable");

      return;
    }


    V91.botUnoSeat =
      seat;


    V91.botUnoVulnerable =
      true;


    opponentElement91(seat)
      ?.classList
      .add("catchable");


    V91.botUnoTimer =
      setTimeout(
        async () => {

          if (gameOver) {
            return;
          }


          const result =
            await AcidStore.dispatch({
              type: "closeUno",
              target: seat
            });


          if (result.error) {
            return;
          }


          V91.botUnoCalled =
            true;


          V91.botUnoVulnerable =
            false;


          opponentElement91(seat)
            ?.classList
            .remove("catchable");


          burst91(
            `${seatName(seat)}: UNO!`,
            "acid"
          );


          AcidFX.status(
            `${seatName(seat)}: UNO!`
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


          opponentElement91(seat)
            ?.classList
            .remove("catchable");

        },
        900
      );
  }


  async function catchBotUno91(seat) {

    if (
      gameOver ||
      V91.botUnoSeat !== seat
    ) {

      return;
    }


    const result =
      await AcidStore.dispatch({
        type: "catch",
        seat: AcidStore.mySeat(),
        target: seat
      });


    if (
      result.error ||
      result.pending
    ) {

      clearBotUno91();


      return;
    }


    clearBotUno91();


    burst91(
      "ПОЙМАЛ! +2",
      "danger"
    );


    AcidFX.status(
      `${seatName(seat)} НЕ СКАЗАЛ UNO — +2`
    );


    beginAction91();


    const cards =
      drawnCards91(result.events, seat);


    for (
      let i = 0;
      i < cards.length;
      i++
    ) {

      await botDrawBack91(seat);


      await wait91(25);
    }


    render();


    endAction91();
  }


  $("bot")
    ?.addEventListener(
      "click",
      () =>
        catchBotUno91(
          V91.botUnoSeat
        )
    );


  $("opponents")
    ?.addEventListener(
      "click",
      event => {

        const pod =
          event.target.closest?.(
            ".opponent"
          );

        if (!pod) {
          return;
        }

        catchBotUno91(
          Number(pod.dataset.seat)
        );
      }
    );


  /* =======================================================
     КОМНАТА

     Клиент ничего не проигрывает наперёд: всё, что видно на
     экране, приезжает событиями от сервера и показывается
     строго по очереди.
     ======================================================= */

  let remoteQueue91 =
    Promise.resolve();


  AcidStore.subscribe(events => {

    if (
      !AcidStore.online() ||
      !events.length
    ) {

      return;
    }

    remoteQueue91 =
      remoteQueue91
        .then(() => playRemote91(events))
        .catch(() => {});
  });


  async function playRemote91(events) {

    const me =
      AcidStore.mySeat();


    beginAction91();


    for (const event of events) {

      if (event.type === "played") {

        if (event.seat !== me) {

          const pod =
            opponentElement91(event.seat);

          pod?.classList.add("is-flying");

          await AcidFX.playBotCard(event.card);

          pod?.classList.remove("is-flying");
        }

        render();

        await specialEffect91(
          event.card,
          event.seat === AcidStore.mySeat()
        );
      }


      if (
        event.type === "drew" ||
        event.type === "penalty" ||
        event.type === "caught"
      ) {

        const seat =
          event.target ?? event.seat;

        if (seat === me) {

          await animateIncoming91(event.cards);

        } else {

          for (
            let i = 0;
            i < event.cards.length;
            i++
          ) {

            await botDrawBack91(seat);

            await wait91(25);
          }

          render();
        }
      }


      if (event.type === "uno") {

        burst91(
          event.seat === me
            ? "UNO!"
            : `${seatName(event.seat)}: UNO!`,
          "acid"
        );
      }


      if (event.type === "caught") {

        burst91(
          "ПОЙМАЛ! +2",
          "danger"
        );
      }


      if (event.type === "exposed") {

        if (event.seat !== me) {

          opponentElement91(event.seat)
            ?.classList
            .add("catchable");

          V91.botUnoSeat = event.seat;
        }
      }


      if (event.type === "over") {

        endAction91();

        finish(event.winner === me);

        return;
      }


      if (event.type === "turn") {

        clearBotUno91();

        announceTurn91();
      }
    }


    render();

    watchPlayerUno91();

    endAction91();
  }


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


      V91.botPending =
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


      armHint91();


      if (calmMode) {

        AcidFX.status(
          turnStatus91()
        );

        window.AcidCoach?.tourIfNew();
      }
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

      /*
        Поворот телефона Safari отрабатывает в несколько
        заходов: сначала меняются размеры окна, потом
        убираются и возвращаются его собственные панели.
        Одной перерисовки мало — веер в руке остаётся
        разложенным по прежней ширине и вылезает за края.
      */
      [60, 200, 500].forEach(delay =>
        setTimeout(relayout91, delay)
      );
    }
  );


  /*
    На айфоне панели Safari появляются и прячутся сами, и
    высота окна меняется без всякого resize. Ловим это
    отдельно — иначе рука уезжает под панель вкладок.
  */
  window.visualViewport
    ?.addEventListener(
      "resize",
      () => {

        clearTimeout(relayout91.viewportTimer);

        relayout91.viewportTimer =
          setTimeout(relayout91, 120);
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


  /*
    Первая партия раздаётся в game.js ещё до того, как этот
    файл её обернёт, — поэтому подсказку для неё включаем
    здесь вручную. Иначе спокойный стол начинался молча и
    оживал только со второй партии.
  */
  armHint91();


  if (calmMode) {

    AcidFX.status(
      turnStatus91()
    );

    window.AcidCoach?.tourIfNew();
  }


  console.log(
    "ACID UNO v9.1 loaded"
  );

})();
