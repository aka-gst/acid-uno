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
     AcidCoach.notify(kind)    игрок сходил ("play") или
                               взял из колоды ("draw")
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

        /*
          Через ту же проверку, что и первый показ. Кнопка
          живёт под строкой наставника прямо во время партии,
          и нажимают её чаще всего в чужой ход — а первый шаг
          просит нажать колоду, чего в чужой ход игра не даст.
          Раньше отсюда звали tour() напрямую, и обучение
          вставало на первом же экране.
        */
        whenTableReady(tour);
      }
    }
  );


  /*
    Нажал колоду, а карта не пришла — значит, игра отклонила
    добор молча: не твой ход или ещё идёт анимация. Молчание
    здесь — худшее, что можно сделать: человек решает, что
    сломалась игра или он сам.
  */
  let deckWatch = null;

  document.addEventListener(
    "click",
    event => {

      if (
        waiting !== "draw" ||
        !event.target?.closest?.("#deck")
      ) {
        return;
      }

      clearTimeout(deckWatch);

      deckWatch =
        setTimeout(
          () => {

            if (waiting !== "draw") {
              return;
            }

            const ask = $("coachAsk");

            if (!ask) {
              return;
            }

            ask.textContent =
              turn === "player"
                ? "СЕКУНДУ — ИГРА ЕЩЁ ДОКЛАДЫВАЕТ КАРТЫ. ЖМИ ЕЩЁ РАЗ"
                : "СЕЙЧАС ХОДИТ СОПЕРНИК. ДОЖДИСЬ СВОЕГО ХОДА И ЖМИ";
          },
          900
        );
    },
    true
  );


  /*
    Пока карту тащат, объяснение уходит почти в прозрачность:
    на телефоне оно стоит ровно над столом и закрывает то
    место, куда её и надо донести.
  */
  document.addEventListener(
    "pointerdown",
    event => {

      if (!event.target?.closest?.(".handCard")) {
        return;
      }

      $("coachTour")
        ?.classList
        .add("is-dragging");
    },
    true
  );


  ["pointerup", "pointercancel"].forEach(type =>
    document.addEventListener(
      type,
      () =>
        $("coachTour")
          ?.classList
          .remove("is-dragging"),
      true
    )
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
      colorAcc: AcidRules.colorWordAcc(currentColor),
      value: AcidRules.valueWord(top.value),
      match: AcidRules.matchPhrase(top.value)
    };
  }


  /*
    Правило хода словами — и как можно короче.

    Раньше здесь было предложение на пятнадцать слов: «на
    столе зелёная · 3, подойдёт любая зелёная, любая 3 или
    чёрная». Его никто не дочитывал. Правило UNO помещается
    в четыре слова, и в них же помещается вся игра.
  */
  function ruleLine() {

    const table =
      tableWords();

    if (!table) {
      return "";
    }


    if (drawPenalty > 0) {

      return `ШТРАФ +${drawPenalty}. НАКРОЙ +2 ИЛИ +4 — ЛИБО БЕРИ`;
    }


    /* после чёрной карты номинал на столе ни при чём */
    if (table.named) {

      return `КЛАДИ ${table.colorAcc}`;
    }


    return `КЛАДИ ${table.colorAcc} ИЛИ ЛЮБУЮ ${table.value}`;
  }


  /* =======================================================
     УРОК В МОМЕНТ СОБЫТИЯ

     Люди играют в UNO годами и не помнят правил — потому
     что правила читают до игры, отдельным текстом, когда
     ещё не на чем их применить. Про «+4» читают раньше, чем
     впервые видят «+4», и оно не остаётся.

     Поэтому спецкарта объясняется один раз — ровно тогда,
     когда впервые легла на стол. Одной строкой. Дальше
     молчим: правило либо запомнилось, либо ему всё равно
     нужна не подсказка, а вторая партия.
     ======================================================= */

  const LESSONS = {
    skip: "ПРОПУСК: следующий остаётся без хода",
    reverse: "РАЗВОРОТ: круг пошёл в другую сторону",
    "+2": "+2: следующий берёт две карты",
    "+4": "+4: берёт четыре, и цвет выбираешь ты",
    wild: "ЧЁРНАЯ: кладётся на любую, цвет называешь сам"
  };


  const SEEN_KEY =
    "acid-uno-lessons";


  function seenLessons() {

    try {

      const raw =
        window.localStorage.getItem(SEEN_KEY);

      const list =
        raw ? JSON.parse(raw) : [];

      return Array.isArray(list) ? list : [];

    } catch (error) {

      return [];
    }
  }


  /*
    Показываем урок про карту, если он ещё не показывался.
    Возвращает true, если сказали — тогда обычная реплика про
    ход не перебивает урок.
  */
  function lesson(card) {

    if (
      typeof calmMode === "undefined" ||
      !calmMode ||
      !card
    ) {
      return false;
    }

    const text =
      LESSONS[card.value];

    if (!text) {
      return false;
    }

    const seen =
      seenLessons();

    if (seen.includes(card.value)) {
      return false;
    }

    seen.push(card.value);

    try {

      window.localStorage.setItem(
        SEEN_KEY,
        JSON.stringify(seen)
      );

    } catch (error) {

      /* приватный режим — покажем ещё раз, не беда */
    }

    say(text, 3400);

    return true;
  }


  /* =======================================================
     ОБНОВЛЕНИЕ
     ======================================================= */

  function update() {

    /*
      Соперник мог и не походить: после «+4» он забирает
      карты и пропускает ход. Шаг, который ждёт его карту,
      закрываем по возвращению хода — иначе обучение висит
      на нём до скончания века.
    */
    if (
      waiting === "bot" &&
      turn === "player"
    ) {
      notify("bot");
    }


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
        `ХОДИТ ${seatName(activeSeat)}`
      );

      return;
    }


    const canMove =
      player.some(card => canPlay(card));


    if (!canMove) {

      paint("НЕЧЕМ ХОДИТЬ — ЖМИ КОЛОДУ");

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
      `НЕ ПОДХОДИТ. ${ruleLine()}`
    );
  }


  /* =======================================================
     ЭКСКУРСИЯ ПО СТОЛУ

     Четыре шага с прожектором. Показывается один раз при
     первом учебном столе и открывается заново из правил.
     ======================================================= */

  /*
    Шаги. Почти каждый требует действия: у такого шага нет
    кнопки «дальше», он закрывается тем, что человек сам
    сделает нужное.

    И у каждого есть «готово» — короткая пауза после
    действия, когда затемнение уходит и видно результат.
    Без неё карта прилетала в затемнённую руку: человек
    нажимал колоду и был уверен, что ничего не произошло.
  */
  const STEPS = [
    {
      target: "deck",
      text: "ЭТО КОЛОДА — ОТСЮДА БЕРУТ КАРТЫ.",
      ждём: "draw",
      просьба: "НАЖМИ КОЛОДУ",
      готово: "ВОТ ОНА, В ТВОЕЙ РУКЕ",
      светНаГотово: "hand"
    },
    {
      target: "hand",
      text: "ГОРЯЩИЕ КАРТЫ ПОДХОДЯТ.",
      ждём: "play",
      просьба: "ПЕРЕТАЩИ ЛЮБУЮ ГОРЯЩУЮ КАРТУ В ЦЕНТР",
      готово: "ЛЕГЛА! ТЕПЕРЬ ИГРАЮТ ЕЮ",
      светНаГотово: "discard",
      /* горящих может и не оказаться — тогда просим добрать */
      запасная: {
        просьба: "ГОРЯЩИХ НЕТ — ЖМИ КОЛОДУ",
        ждём: "draw",
        target: "deck",
        готово: "ЗАГОРЕЛАСЬ — КЛАДИ ЕЁ",
        светНаГотово: "hand"
      }
    },
    {
      /*
        Светим на стол, а не на соперника: значок соперника
        занимает всю верхнюю дугу, и затемнение вокруг него
        не затемняет ничего. А смотреть надо туда, куда
        ляжет его карта.
      */
      target: "discard",
      text: "ТЕПЕРЬ ХОДИТ СОПЕРНИК.",
      ждём: "bot",
      просьба: "ЖДЁМ СОПЕРНИКА",
      готово: "ТЕПЕРЬ СНОВА ТЫ",
      светНаГотово: "discard"
    },
    {
      target: "hand",
      text: "ХОДИ ЕЩЁ РАЗ.",
      ждём: "любое",
      просьба: "ПОЛОЖИ КАРТУ ИЛИ НАЖМИ КОЛОДУ",
      готово: "ВОТ И ВСЁ",
      светНаГотово: "hand"
    },
    {
      target: "hand",
      text: "КТО ПЕРВЫМ БЕЗ КАРТ — ТОТ И ВЫИГРАЛ.",
      конец: true
    }
  ];


  let tourStep = 0;

  /* какого действия ждёт шаг: "play", "draw", "bot", "любое" */
  let waiting = null;


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
      Затемнения нет вовсе. Оно закрывало собой ровно то, на
      что показывало: то руку, то стол, то место второго
      действия. Куда смотреть, говорит кольцо, и этого
      достаточно.
    */
    layer.innerHTML =
      '<div class="coachSpot" id="coachSpot"></div>' +
      '<div class="coachCard">' +
      '<div class="coachStep" id="coachStep"></div>' +
      '<div class="coachText" id="coachText"></div>' +
      '<div class="coachAsk" id="coachAsk"></div>' +
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


  /*
    Игра сообщает сюда, что человек сделал. Шаг, который
    этого ждал, закрывается сам — без всякой кнопки.
  */
  function notify(kind) {

    const layer =
      $("coachTour");


    if (
      !waiting ||
      !layer ||
      layer.classList.contains("hidden")
    ) {
      return;
    }


    if (
      waiting !== kind &&
      !(
        waiting === "любое" &&
        (kind === "play" || kind === "draw")
      )
    ) {
      return;
    }


    waiting = null;


    const step =
      currentStep || STEPS[tourStep];


    /*
      Показ результата. Затемнение уходит совсем, прожектор
      переезжает туда, где результат видно, и человек своими
      глазами видит, что его действие сработало.
    */
    layer.classList.add("is-done");

    layer.classList.remove("is-acting");


    if (step.светНаГотово) {

      placeSpot(
        $(step.светНаГотово)
      );
    }


    const ask =
      $("coachAsk");

    if (ask) {

      ask.textContent =
        step.готово || "ГОТОВО";

      ask.classList.remove("hidden");

      ask.classList.add("done");
    }


    setTimeout(
      () => {

        layer.classList.remove("is-done");

        ask?.classList.remove("done");

        showStep(tourStep + 1);
      },
      1900
    );
  }


  /*
    Поставить прожектор и шторки вокруг элемента.
  */
  function placeSpot(target) {

    const spot =
      $("coachSpot");

    if (!target || !spot) {
      return;
    }


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



    /*
      Объяснение ставим по ту сторону подсвеченного места,
      где больше свободного экрана.
    */
    const card =
      $("coachTour")
        ?.querySelector(".coachCard");

    card
      ?.classList
      .toggle(
        "below",
        box.top < window.innerHeight / 2
      );


    /*
      Подсвечена рука — значит, карту сейчас понесут в
      центр. Объяснение уводим под самую шапку, иначе оно
      встанет ровно на пути.
    */
    card
      ?.classList
      .toggle(
        "aside",
        target.id === "hand"
      );


    /*
      В альбоме места вниз нет, зато вдоволь вбок: карточку
      уводим на ту половину экрана, где подсвеченного места
      нет.
    */
    card
      ?.classList
      .toggle(
        "right",
        box.left + box.width / 2 < window.innerWidth / 2
      );
  }


  /* шаг с уже подставленным запасным сценарием */
  let currentStep = null;


  function showStep(index) {

    const layer =
      tourLayer();


    if (index >= STEPS.length) {

      closeTour();

      return;
    }


    tourStep = index;

    let step =
      STEPS[index];


    /*
      Шаг просит сыграть, а играть нечем — берём запасной
      сценарий, иначе обучение упрётся в невыполнимое.
    */
    if (
      step.ждём === "play" &&
      step.запасная &&
      !player.some(card => canPlay(card))
    ) {

      step = {
        ...step,
        ...step.запасная
      };
    }


    /*
      Ход соперника мог уже пройти, пока читали прошлый шаг.
      Ждать его второй раз незачем — обучение бы зависло.
    */
    if (
      step.ждём === "bot" &&
      turn === "player"
    ) {

      step = {
        ...step,
        ждём: "любое",
        просьба: "ПОЛОЖИ КАРТУ ИЛИ НАЖМИ КОЛОДУ",
        target: "hand"
      };
    }


    currentStep = step;

    waiting =
      step.ждём || null;


    placeSpot(
      $(step.target)
    );


    layer.classList.toggle(
      "is-acting",
      Boolean(waiting)
    );


    /*
      Шаг ждёт нажатия на колоду — тогда само кольцо и
      становится кнопкой. Оно лежит ровно поверх колоды, и
      промахнуться мимо него нельзя: что бы ни случилось с
      настоящей кнопкой под ним, нажатие дойдёт.

      На телефоне это оказалось единственным надёжным
      способом: тап по колоде почему-то доходил не всегда, а
      обучение вставало на первом же шаге.
    */
    const spotButton =
      waiting === "draw";

    layer.classList.toggle(
      "is-tappable",
      spotButton
    );

    const ring = $("coachSpot");

    if (ring) {

      ring.onclick =
        spotButton
          ? () => $(step.target)?.click()
          : null;
    }

    layer.classList.remove("is-done");


    $("coachStep").textContent =
      `${index + 1} ИЗ ${STEPS.length}`;

    $("coachText").textContent =
      step.text;


    const ask =
      $("coachAsk");

    ask.textContent =
      step.просьба || "";

    ask.classList.remove("done");

    ask.classList.toggle(
      "hidden",
      !step.просьба
    );


    /*
      У шага с действием кнопки нет: он закроется сам, когда
      человек сделает то, о чём просят.
    */
    const next =
      $("coachNext");

    next.classList.toggle(
      "hidden",
      Boolean(waiting)
    );

    next.textContent =
      step.конец
        ? "ИГРАЕМ"
        : "ДАЛЬШЕ";


    layer.classList.remove("hidden");
  }


  function closeTour() {

    waiting = null;

    currentStep = null;

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


    /*
      Раньше здесь стояла проверка «уже видел» — и обучение
      показывалось один раз за всю жизнь браузера. Дальше его
      надо было звать кнопкой, а кнопку человек не ищет: он
      садится и играет.

      Режим называется обучением — значит обучением и
      открывается, каждый раз. Пропустить можно на первом же
      шаге, ссылка «пропустить» там есть.
    */
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

    /*
      Ждём и своего хода тоже. Первый шаг просит нажать
      колоду, а добор в чужой ход игра молча отклоняет —
      человек жмёт, ничего не происходит, и обучение
      кончается на первом же экране.
    */
    const ready =
      lobby?.classList.contains("hidden") &&
      target &&
      target.getBoundingClientRect().width > 4 &&
      turn === "player" &&
      !gameOver;


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


  /*
    Чего экскурсия ждёт прямо сейчас. Спрашивает v9.1.js:
    когда на экране написано «нажми колоду», отказ в доборе
    нельзя оставлять молчаливым.
  */
  function waitingFor() {
    return waiting;
  }


  return {
    update,
    say,
    refuse,
    lesson,
    notify,
    tour,
    tourIfNew,
    waitingFor
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
