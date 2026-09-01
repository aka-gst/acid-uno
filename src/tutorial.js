"use strict";

/* =========================================================
   ACID UNO — ПРАВИЛА / ОБУЧЕНИЕ
   ---------------------------------------------------------
   Экран правил. Карты в нём настоящие: рисуются тем же
   cardHTML(), что и карты в руке, поэтому объяснение всегда
   совпадает с тем, что игрок видит на столе.

   Открывается из лобби и один раз сам — при первом запуске.
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
    Правила — один экран и шесть строк.

    Раньше здесь было семь разделов и тридцать строк: цель,
    ход, кластер, пропуск с разворотом, перехват, UNO и
    выбор соперников. Всё верно и всё бесполезно — такое не
    читают. Человек, который первый раз видит UNO, хочет
    знать ровно одно: что делать со своей картой.

    Остальное он узнает в игре: спецкарта объясняется одной
    строкой в тот момент, когда впервые ложится на стол
    (src/coach.js, LESSONS). Правило, прочитанное до того,
    как его увидел, не остаётся — на этом и держались все
    прошлые версии этого экрана.
  */
  const SECTIONS = [

    {
      title: "ЦЕЛЬ",

      cards: [],

      text: [
        "Сбросить все свои карты первым."
      ]
    },

    {
      title: "ХОД",

      cards: [
        { card: card("red", "7"), note: "НА СТОЛЕ" },
        { card: card("red", "3"), note: "ТОТ ЖЕ ЦВЕТ" },
        { card: card("blue", "7"), note: "ТО ЖЕ ЧИСЛО" }
      ],

      text: [
        "Клади карту того же цвета или того же числа.",

        "Нечем — жми колоду."
      ]
    },

    {
      title: "ОСОБЫЕ КАРТЫ",

      cards: [
        { card: card("green", "skip"), note: "ПРОПУСК" },
        { card: card("yellow", "reverse"), note: "РАЗВОРОТ" },
        { card: card("red", "+2"), note: "+2 СОСЕДУ" },
        { card: card("wild", "+4"), note: "+4 И ЦВЕТ" },
        { card: card("wild", "wild"), note: "ЛЮБОЙ ЦВЕТ" }
      ],

      text: [
        "Про каждую игра напомнит сама, когда она выпадет."
      ]
    },

    {
      title: "UNO",

      cards: [],

      text: [
        "Осталась одна карта — жми UNO."
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


  function open() {

    screen.classList.remove("hidden");

    screen.querySelector(".rulesBody")
      .scrollTop = 0;

    requestAnimationFrame(paintScroll);
  }


  function close() {

    screen.classList.add("hidden");

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


  document
    .getElementById("rulesOpen")
    ?.addEventListener(
      "click",
      () => {

        AcidSound.play("draw");

        open();
      }
    );


  /*
    Первый запуск — показываем правила поверх лобби.
  */
  let seen = false;

  try {
    seen =
      window.localStorage
        .getItem(SEEN_KEY) === "1";

  } catch (error) {
    seen = false;
  }


  /*
    Первый заход правилами больше НЕ открывается.

    Замер с чистого профиля: окно правил занимало 766 точек
    при экране 844 — восемьдесят четыре процента высоты, — а
    за ним человек попадал в лобби, где по умолчанию стоял
    режим «ИГРА». То есть новый человек читал стену текста и
    садился играть без единой подсказки: интерактивное
    обучение до него не доезжало вовсе.

    Указание владельца прямое: подсказка приходит в момент
    нужды, а не списком на старте. Теперь так и есть — первый
    заход открывается обучением (умолчание уровня в
    features.js), а этот экран остаётся по ссылке «как
    играть» для тех, кто хочет прочитать.
  */
  if (!seen) {

    try {

      localStorage.setItem(SEEN_KEY, "1");

    } catch (error) {
      /* приватный режим — покажем ещё раз, не беда */
    }
  }


  window.AcidRulesScreen = {
    open,
    close
  };

})();
