"use strict";

/* =========================================================
   ACID UNO — НАСТАВНИК
   ---------------------------------------------------------
   Только для учебного уровня.

   Подсветить подходящую карту мало: человек видит, что
   какие-то карты горят, но не понимает, почему горят
   именно эти. Наставник каждый ход говорит правило на
   живых значениях — «на столе ГОЛУБОЙ · 6, подойдёт любая
   голубая, любая 6 или чёрная» — и называет вслух всё, что
   делает соперник.

   Модуль ничего не решает и ни на что не влияет: он только
   читает состояние партии и пишет текст. Убери его — игра
   пойдёт как шла.

   Публичное:

     AcidCoach.update()        пересобрать объяснение
     AcidCoach.refuse(card)    сказать, почему карта не легла
     AcidCoach.say(text, ms)   временная реплика
     AcidCoach.tour()          показать экскурсию по столу
     AcidCoach.tourIfNew()     показать её один раз
   ========================================================= */

const AcidCoach = (() => {

  const $ = id =>
    document.getElementById(id);


  const TOUR_KEY =
    "acid-uno-tour-seen";


  /* =======================================================
     ПАНЕЛЬ
     ======================================================= */

  function panel() {
    return $("coach");
  }


  let holdTimer = null;


  function paint(text) {

    const el = panel();

    const line = $("coachLine");

    if (!el || !line) {
      return;
    }

    line.textContent = text || "";

    el.classList.toggle(
      "hidden",
      !text
    );
  }


  /*
    Кнопка «?» рядом со строкой — второй заход по столу для
    тех, кому первого не хватило.
  */
  document.addEventListener(
    "click",
    event => {

      if (
        event.target?.id === "coachAgain"
      ) {
        tour();
      }
    }
  );


  /* =======================================================
     ИЗ ЧЕГО СКЛАДЫВАЕТСЯ ОБЪЯСНЕНИЕ
     ======================================================= */

  /*
    Что сейчас лежит на столе. Цвет берём не с карты, а из
    партии: после чёрной карты цвет называет игрок, и карта
    на столе перестаёт его показывать.
  */
  function tableWords() {

    const top =
      discard[discard.length - 1];

    if (!top) {
      return null;
    }

    const named =
      top.color === "wild" ||
      top.color !== currentColor;

    return {
      top,
      named,
      color: AcidRules.colorWord(currentColor),
      colorF: AcidRules.colorWordF(currentColor),
      value: AcidRules.valueWord(top.value),
      match: AcidRules.matchPhrase(top.value)
    };
  }


  /*
    Правило хода словами. Ради него всё и затевалось.
  */
  function ruleLine() {

    const table =
      tableWords();

    if (!table) {
      return "";
    }


    if (drawPenalty > 0) {

      return (
        `НА ТЕБЕ ШТРАФ +${drawPenalty}. ` +
        "НАКРЫТЬ МОЖНО ТОЛЬКО +2 ИЛИ +4, " +
        "ИНАЧЕ ЗАБИРАЕШЬ КАРТЫ СЕБЕ"
      );
    }


    /*
      Цвет назвали чёрной картой: номинал на столе больше
      ни при чём, и говорить про него — сбивать с толку.
    */
    if (table.named) {

      return (
        `ЦВЕТ НАЗВАЛИ: ${table.color}. ` +
        `ПОДОЙДЁТ ЛЮБАЯ ${table.colorF} ИЛИ ЧЁРНАЯ`
      );
    }


    return (
      `НА СТОЛЕ ${table.colorF} · ${table.value}. ` +
      `ПОДОЙДЁТ ЛЮБАЯ ${table.colorF}, ` +
      `${table.match} ИЛИ ЧЁРНАЯ`
    );
  }


  /* =======================================================
     ОБНОВЛЕНИЕ
     ======================================================= */

  function update() {

    if (holdTimer) {
      return;
    }


    if (
      typeof calmMode === "undefined" ||
      !calmMode ||
      gameOver
    ) {

      paint("");

      return;
    }


    if (turn !== "player") {

      paint(
        `ХОДИТ ${seatName(activeSeat)} — ПОДОЖДИ`
      );

      return;
    }


    const canMove =
      player.some(card => canPlay(card));


    if (!canMove) {

      paint(
        ruleLine() +
        ". ТАКОЙ У ТЕБЯ НЕТ — ЖМИ КОЛОДУ, ВОЗЬМЁШЬ ОДНУ"
      );

      return;
    }


    paint(
      ruleLine()
    );
  }


  /*
    Временная реплика: сказать и через паузу вернуться к
    обычному объяснению.
  */
  function say(text, ms) {

    if (
      typeof calmMode === "undefined" ||
      !calmMode
    ) {
      return;
    }

    clearTimeout(holdTimer);

    paint(text);

    holdTimer =
      setTimeout(
        () => {

          holdTimer = null;

          update();
        },
        ms || 2600
      );
  }


  /*
    Карта не легла. Молчаливый отказ — худшее, что можно
    сделать с новичком: он решает, что сломалось.
  */
  function refuse(card) {

    if (
      typeof calmMode === "undefined" ||
      !calmMode ||
      !card
    ) {
      return;
    }

    say(
      `${AcidRules.cardLabel(card)} НЕ ПОДХОДИТ. ` +
      ruleLine()
    );
  }


  /* =======================================================
     ЭКСКУРСИЯ ПО СТОЛУ

     Четыре шага с прожектором. Показывается один раз при
     первом учебном столе и открывается заново из правил.
     ======================================================= */

  const STEPS = [
    {
      target: "discard",
      text:
        "ЭТО СТОЛ. СЮДА КЛАДЁШЬ КАРТУ — " +
        "ПЕРЕТАСКИВАЙ ЕЁ ПАЛЬЦЕМ ИЛИ МЫШЬЮ"
    },
    {
      target: "deck",
      text:
        "ЭТО КОЛОДА. ЖМЁШЬ ЕЁ, КОГДА ХОДИТЬ НЕЧЕМ, — " +
        "БЕРЁШЬ ОДНУ КАРТУ"
    },
    {
      target: "currentColor",
      text:
        "ЗДЕСЬ НАПИСАН ЦВЕТ, КОТОРЫМ СЕЙЧАС ИГРАЮТ"
    },
    {
      target: "hand",
      text:
        "ЭТО ТВОИ КАРТЫ. КОТОРЫЕ ПРИПОДНЯЛИСЬ И ГОРЯТ — " +
        "ТЕМИ МОЖНО ХОДИТЬ"
    }
  ];


  let tourStep = 0;


  function tourLayer() {

    let layer =
      $("coachTour");


    if (layer) {
      return layer;
    }


    layer = document.createElement("div");

    layer.id = "coachTour";

    layer.className = "coachTour hidden";

    /*
      Затемнение — четыре шторки вокруг подсвеченного места,
      а не одна огромная тень. Тень со спредом в 9999 точек
      Chrome прорисовывает не всегда: у неё выходит текстура
      в двадцать тысяч точек по стороне, и часть экрана
      остаётся незатемнённой — выглядит так, будто подсвечен
      совсем не тот угол.
    */
    layer.innerHTML =
      '<div class="coachShade" id="shadeTop"></div>' +
      '<div class="coachShade" id="shadeBottom"></div>' +
      '<div class="coachShade" id="shadeLeft"></div>' +
      '<div class="coachShade" id="shadeRight"></div>' +
      '<div class="coachSpot" id="coachSpot"></div>' +
      '<div class="coachCard">' +
      '<div class="coachStep" id="coachStep"></div>' +
      '<div class="coachText" id="coachText"></div>' +
      '<button class="coachNext" id="coachNext" type="button">' +
      "ДАЛЬШЕ</button>" +
      '<button class="coachSkip" id="coachSkip" type="button">' +
      "пропустить</button>" +
      "</div>";

    document.body.appendChild(layer);


    $("coachNext")
      .addEventListener("click", () => showStep(tourStep + 1));

    $("coachSkip")
      .addEventListener("click", closeTour);


    return layer;
  }


  function showStep(index) {

    const layer =
      tourLayer();


    if (index >= STEPS.length) {

      closeTour();

      return;
    }


    tourStep = index;

    const step =
      STEPS[index];

    const target =
      $(step.target);


    /*
      Прожектор — не вырез, а элемент с огромной тенью
      вокруг: всё, кроме него, уходит в темноту. Так не
      нужен ни канвас, ни маска.
    */
    const spot =
      $("coachSpot");

    if (target && spot) {

      const box =
        target.getBoundingClientRect();

      const pad = 14;

      const left = box.left - pad;
      const top = box.top - pad;
      const width = box.width + pad * 2;
      const height = box.height + pad * 2;

      spot.style.left = `${left}px`;
      spot.style.top = `${top}px`;
      spot.style.width = `${width}px`;
      spot.style.height = `${height}px`;


      const shade = (id, css) =>
        Object.assign($(id).style, css);

      shade("shadeTop", {
        left: "0px",
        top: "0px",
        width: "100%",
        height: `${Math.max(0, top)}px`
      });

      shade("shadeBottom", {
        left: "0px",
        top: `${top + height}px`,
        width: "100%",
        height: `${Math.max(0, window.innerHeight - top - height)}px`
      });

      shade("shadeLeft", {
        left: "0px",
        top: `${Math.max(0, top)}px`,
        width: `${Math.max(0, left)}px`,
        height: `${height}px`
      });

      shade("shadeRight", {
        left: `${left + width}px`,
        top: `${Math.max(0, top)}px`,
        width: `${Math.max(0, window.innerWidth - left - width)}px`,
        height: `${height}px`
      });


      /*
        Объяснение ставим по ту сторону подсвеченного места,
        где больше свободного экрана.
      */
      const card =
        layer.querySelector(".coachCard");

      card.classList.toggle(
        "below",
        box.top < window.innerHeight / 2
      );
    }


    $("coachStep").textContent =
      `${index + 1} ИЗ ${STEPS.length}`;

    $("coachText").textContent =
      step.text;

    $("coachNext").textContent =
      index === STEPS.length - 1
        ? "ПОНЯТНО"
        : "ДАЛЬШЕ";


    layer.classList.remove("hidden");
  }


  function closeTour() {

    $("coachTour")
      ?.classList
      .add("hidden");


    try {

      localStorage.setItem(TOUR_KEY, "1");

    } catch (error) {

      /* приватный режим — покажем ещё раз, не беда */
    }


    update();
  }


  function tour() {

    showStep(0);
  }


  function tourIfNew() {

    if (
      typeof calmMode === "undefined" ||
      !calmMode
    ) {
      return;
    }


    let seen = false;

    try {

      seen =
        localStorage.getItem(TOUR_KEY) === "1";

    } catch (error) {

      seen = false;
    }


    if (seen) {
      return;
    }


    whenTableReady(tour);
  }


  /*
    Экскурсию нельзя показывать поверх меню: подсвечивать
    стол, закрытый окном выбора, — это ровно то, из-за чего
    человек и решает, что игра сломана. Ждём, пока меню
    уйдёт и раздача доедет до экрана.
  */
  function whenTableReady(run, tries) {

    const lobby =
      $("lobby");

    const target =
      $("discard");

    const ready =
      lobby?.classList.contains("hidden") &&
      target &&
      target.getBoundingClientRect().width > 4;


    if (ready) {

      setTimeout(run, 450);

      return;
    }


    if ((tries || 0) > 120) {
      return;
    }


    setTimeout(
      () => whenTableReady(run, (tries || 0) + 1),
      500
    );
  }


  window.addEventListener(
    "resize",
    () => {

      const layer = $("coachTour");

      if (
        layer &&
        !layer.classList.contains("hidden")
      ) {
        showStep(tourStep);
      }
    }
  );


  return {
    update,
    say,
    refuse,
    tour,
    tourIfNew
  };

})();


/*
  v9.1.js грузится раньше и обращается к наставнику через
  window: до этой строки его там нет, и обращение молча
  проходит мимо — ровно то, что нужно.
*/
globalThis.AcidCoach = AcidCoach;


/*
  Первая партия раздаётся ещё до загрузки этого файла,
  поэтому и объяснение, и экскурсию для неё запускаем
  отсюда — v9.1.js в тот момент наставника ещё не видит.
*/
setTimeout(
  () => {

    AcidCoach.update();

    AcidCoach.tourIfNew();
  },
  0
);
