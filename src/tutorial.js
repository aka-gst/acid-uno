"use strict";

/* =========================================================
   ACID UNO — ПРАВИЛА / ОБУЧЕНИЕ
   ---------------------------------------------------------
   Первый заход — маленькая настоящая партия: последствия
   считает src/tutorial-flow.js через тот же rules-engine.
   Полный текст правил остаётся справочником второго уровня.
   ========================================================= */

(() => {

  const SEEN_KEY =
    "acid-uno-rules-seen";


  const card = (color, value) => ({
    id: 0,
    color,
    value
  });


  /*
    Разделы читаются сверху вниз как короткий курс:
    цель -> как ходить -> чем игра отличается от обычного UNO.
  */
  const SECTIONS = [

    {
      title: "ЦЕЛЬ",

      cards: [],

      text: [
        "Скинуть все карты первым.",

        "Если время вышло раньше — выигрывает тот, " +
        "у кого меньше сумма карт на руках."
      ]
    },

    {
      title: "КАК ХОДИТЬ",

      cards: [
        { card: card("red", "7"), note: "НА СТОЛЕ" },
        { card: card("red", "3"), note: "ЦВЕТ" },
        { card: card("blue", "7"), note: "НОМИНАЛ" },
        { card: card("wild", "wild"), note: "ВСЕГДА" }
      ],

      text: [
        "Клади карту того же цвета или того же номинала. " +
        "Чёрную можно всегда — цвет выбираешь сам.",

        "Карта кладётся перетаскиванием в центр. " +
        "Нечем ходить — жми колоду."
      ]
    },

    {
      title: "КЛАСТЕР +2 / +4",

      cards: [
        { card: card("red", "+2"), note: "+2" },
        { card: card("blue", "+2"), note: "СТАЛО +4" },
        { card: card("wild", "+4"), note: "СТАЛО +8" }
      ],

      text: [
        "+2 кроется картой +2 или +4. " +
        "+4 кроется только картой +4.",

        "Штраф копится, пока кто-то не заберёт всё разом — " +
        "и на этом его ход заканчивается."
      ]
    },

    {
      title: "ПРОПУСК И РАЗВОРОТ",

      cards: [
        { card: card("green", "skip"), note: "ПРОПУСК" },
        { card: card("yellow", "reverse"), note: "РАЗВОРОТ" }
      ],

      text: [
        "На двоих обе оставляют ход тебе.",

        "От трёх мест пропуск перешагивает соседа, " +
        "а разворот меняет направление круга."
      ]
    },

    {
      title: "ПЕРЕХВАТ",

      cards: [
        { card: card("green", "7"), note: "НА СТОЛЕ" },
        { card: card("green", "7"), note: "У ТЕБЯ" }
      ],

      text: [
        "Если у тебя ровно такая же карта, как верхняя — " +
        "и цвет, и номинал — клади её вне очереди.",

        "Ход переходит к тебе."
      ]
    },

    {
      title: "UNO",

      cards: [],

      text: [
        "Осталось две карты — жми UNO до того, " +
        "как выложишь предпоследнюю.",

        "Не успел — поймают и дадут +2. " +
        "Соперника ловишь сам: жми по нему, пока он мигает."
      ]
    },

    {
      title: "С КЕМ ИГРАТЬ",

      cards: [],

      text: [
        "«ИГРАТЬ С БОТАМИ» — стол собирается сразу, " +
        "соперников выбираешь числом сверху.",

        "«ПОЗВАТЬ ДРУГА ПО ССЫЛКЕ» — получишь код комнаты " +
        "и ссылку. Кто откроет её, сядет за твой стол. " +
        "Пустые места можно добить ботами или начать раньше.",

        "Вернуться к выбору стола — значок 👥 сверху."
      ]
    },

    {
      title: "ОЧКИ",

      cards: [],

      text: [
        "Числа — по номиналу.",

        "+2, разворот, пропуск и смена цвета — по 20.",

        "+4 — 40."
      ]
    }

  ];


  function cardsHTML(entries) {

    if (!entries.length) {
      return "";
    }

    return `
      <div class="rulesCards">
        ${entries
          .map(entry => `
            <div class="rulesCard">
              ${cardHTML(entry.card)}
              <span class="rulesNote">${entry.note}</span>
            </div>
          `)
          .join("")}
      </div>
    `;
  }


  function build() {

    const screen =
      document.createElement("div");

    screen.id = "rules";

    screen.className = "overlay hidden";


    screen.innerHTML = `
      <div class="window rulesWindow">

        <div class="windowEyebrow">
          ACID UNO
        </div>

        <h2>ПРАВИЛА</h2>

        <div class="rulesScroller">

        <div class="rulesBody">
          ${SECTIONS
            .map(section => `
              <section class="rulesSection">

                <h3>${section.title}</h3>

                ${cardsHTML(section.cards)}

                ${section.text
                  .map(line => `<p>${line}</p>`)
                  .join("")}

              </section>
            `)
            .join("")}
        </div>

        <div class="rulesRail" aria-hidden="true">
          <i class="rulesThumb"></i>
        </div>

        <div class="rulesFade" aria-hidden="true"></div>

        </div>

        <button id="rulesClose">
          ПОНЯТНО
        </button>

      </div>
    `;


    document.body.appendChild(screen);

    return screen;
  }


  const screen = build();


  function buildTour() {

    const tour =
      document.createElement("div");

    tour.id = "tutorial";

    tour.className = "overlay hidden";

    tour.innerHTML = `
      <div class="window rulesWindow tourWindow">

        <div class="windowEyebrow">ACID UNO</div>

        <h2 id="tutorialTitle">УЧЕБНЫЙ ТУР</h2>

        <p id="tutorialHint" class="tutorialHint"></p>

        <div class="tutorialTable">
          <div class="tutorialRow">
            <span>НА СТОЛЕ</span>
            <div id="tutorialTop" class="tutorialTop"></div>
          </div>

          <div id="tutorialPenalty" class="tutorialPenalty"></div>
        </div>

        <div class="tutorialHandTitle">ТВОЯ РУКА</div>

        <div id="tutorialHand" class="tutorialHand"></div>

        <p id="tutorialStatus" class="tutorialStatus" aria-live="polite"></p>

        <div class="tutorialActions">
          <button id="tutorialUno" type="button">UNO</button>
          <button id="tutorialReference" type="button">ПРАВИЛА ЦЕЛИКОМ</button>
        </div>

        <button id="tutorialFinish" class="hidden" type="button">
          ИГРАТЬ ПО-НАСТОЯЩЕМУ
        </button>

      </div>
    `;

    document.body.appendChild(tour);

    return tour;
  }


  const tourScreen = buildTour();

  let flow = null;

  let referenceReturnsToTour = false;


  /*
    Полосу прокрутки macOS показывает только во время самой
    прокрутки — её ширина ноль, и правила выглядят так, будто
    обрываются на середине. Рисуем свою: она видна всегда и
    сразу говорит, сколько текста осталось.
  */
  const body =
    screen.querySelector(".rulesBody");

  const rail =
    screen.querySelector(".rulesRail");

  const thumb =
    screen.querySelector(".rulesThumb");

  const fade =
    screen.querySelector(".rulesFade");


  function paintScroll() {

    if (!body || !thumb) {
      return;
    }

    const visible =
      body.clientHeight;

    const total =
      body.scrollHeight;

    if (total <= visible + 1) {

      rail.style.opacity = "0";
      fade.style.opacity = "0";

      return;
    }

    rail.style.opacity = "1";

    const share =
      visible / total;

    thumb.style.height =
      `${Math.max(share * 100, 12)}%`;

    thumb.style.top =
      `${(body.scrollTop / total) * 100}%`;

    /*
      Затемнение у нижней кромки гаснет, когда докрутили.
    */
    const left =
      total - visible - body.scrollTop;

    fade.style.opacity =
      String(Math.min(left / 40, 1));
  }


  body?.addEventListener(
    "scroll",
    paintScroll,
    { passive: true }
  );

  window.addEventListener(
    "resize",
    paintScroll
  );


  function renderTour() {

    if (!flow) {
      return;
    }

    const state = flow.state;

    const step =
      AcidTutorialFlow.help(flow);

    const top =
      state.discard.at(-1);

    tourScreen
      .querySelector("#tutorialTitle")
      .textContent = step.title;

    tourScreen
      .querySelector("#tutorialHint")
      .textContent = step.hint;

    tourScreen
      .querySelector("#tutorialTop")
      .innerHTML = cardHTML(top);

    tourScreen
      .querySelector("#tutorialPenalty")
      .textContent = state.drawPenalty > 0
        ? `КЛАСТЕР: +${state.drawPenalty}`
        : "";

    const hand =
      tourScreen.querySelector("#tutorialHand");

    hand.innerHTML =
      state.seats[0].hand
        .map(one => `
          <button
            class="tutorialCard"
            type="button"
            data-card-id="${one.id}"
            aria-label="Сыграть ${one.color} ${one.value}"
          >
            ${cardHTML(one)}
          </button>
        `)
        .join("");

    const done = flow.step === "done";

    tourScreen
      .querySelector("#tutorialUno")
      .classList.toggle("hidden", done);

    tourScreen
      .querySelector("#tutorialReference")
      .classList.toggle("hidden", done);

    tourScreen
      .querySelector("#tutorialFinish")
      .classList.toggle("hidden", !done);

    if (done) {
      hand.innerHTML = "";

      tourScreen
        .querySelector("#tutorialStatus")
        .textContent = "ТЫ ВЫИГРАЛ. ТЕПЕРЬ — ЗА НАСТОЯЩИЙ СТОЛ.";
    }
  }


  function reportTour(result) {

    const status =
      tourScreen.querySelector("#tutorialStatus");

    if (result.error) {
      status.textContent = result.error;

      AcidSound.play("error");

      return;
    }

    flow = result.flow;

    status.textContent = "";

    AcidSound.play(
      flow.step === "done"
        ? "win"
        : "card"
    );

    renderTour();
  }


  function openTour() {

    flow = AcidTutorialFlow.create();

    screen.classList.add("hidden");

    tourScreen.classList.remove("hidden");

    renderTour();
  }


  function closeTour() {

    tourScreen.classList.add("hidden");

    try {
      window.localStorage.setItem(SEEN_KEY, "1");

    } catch (error) {
      /* приватный режим — просто спросим ещё раз */
    }
  }


  function open() {

    screen.classList.remove("hidden");

    screen.querySelector(".rulesBody")
      .scrollTop = 0;

    requestAnimationFrame(paintScroll);
  }


  function close() {

    screen.classList.add("hidden");

    if (referenceReturnsToTour) {
      referenceReturnsToTour = false;

      tourScreen.classList.remove("hidden");

      renderTour();

      return;
    }

    try {
      window.localStorage
        .setItem(SEEN_KEY, "1");

    } catch (error) {
      /* приватный режим — просто спросим ещё раз */
    }
  }


  screen
    .querySelector("#rulesClose")
    .addEventListener(
      "click",
      () => {

        AcidSound.play("card");

        close();
      }
    );


  tourScreen
    .querySelector("#tutorialHand")
    .addEventListener(
      "click",
      event => {

        const card =
          event.target.closest("[data-card-id]");

        if (!card || !flow) {
          return;
        }

        reportTour(
          AcidTutorialFlow.act(flow, {
            type: "play",
            seat: 0,
            cardId: Number(card.dataset.cardId)
          })
        );
      }
    );


  tourScreen
    .querySelector("#tutorialUno")
    .addEventListener(
      "click",
      () => {

        if (!flow) {
          return;
        }

        reportTour(
          AcidTutorialFlow.act(flow, {
            type: "uno",
            seat: 0
          })
        );
      }
    );


  tourScreen
    .querySelector("#tutorialReference")
    .addEventListener(
      "click",
      () => {

        referenceReturnsToTour = true;

        tourScreen.classList.add("hidden");

        open();
      }
    );


  tourScreen
    .querySelector("#tutorialFinish")
    .addEventListener(
      "click",
      closeTour
    );


  document
    .getElementById("rulesOpen")
    ?.addEventListener(
      "click",
      () => {

        AcidSound.play("draw");

        openTour();
      }
    );


  /* Первый запуск — не справочник, а маленькая партия. */
  let seen = false;

  try {
    seen =
      window.localStorage
        .getItem(SEEN_KEY) === "1";

  } catch (error) {
    seen = false;
  }


  if (!seen) {
    openTour();
  }


  window.AcidRulesScreen = {
    open,
    close,
    openTour
  };

})();
