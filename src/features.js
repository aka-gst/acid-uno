"use strict";

/* =========================================================
   ACID UNO — FEATURE LAYER

   Слой поверх game.js и v9.1.js. Ничего не переписывает,
   а оборачивает уже существующие глобальные функции:

     render           -> аура активного цвета, счётчик кластера
     startGame        -> перезапуск часов партии
     finish           -> звук итога

   Звук берётся не из обёрток, а из событий редьюсера:
   AcidStore.subscribe() отдаёт всё, что случилось за ход.

   Плюс часы партии: три минуты, за минуту до конца
   таймер выходит на экран, по истечении выигрывает тот,
   у кого меньше сумма карт.

   Правила счёта и сами часы живут в src/rules.js.
   ========================================================= */

(() => {

  const $$ = id =>
    document.getElementById(id);


  /* =======================================================
     ЗВУК
     ======================================================= */

  const soundButton =
    $$("sound");


  const SOUND_FACE = {
    full: { icon: "🔊", tip: "ЗВУК И МУЗЫКА" },
    sfx: { icon: "🔉", tip: "ТОЛЬКО ЗВУКИ" },
    off: { icon: "🔇", tip: "ТИХО" }
  };


  function syncSoundButton() {

    if (!soundButton) {
      return;
    }

    const mode =
      AcidSound.mode();

    const face =
      SOUND_FACE[mode] || SOUND_FACE.off;

    soundButton.textContent = face.icon;

    soundButton.dataset.tip = face.tip;

    soundButton.classList.toggle(
      "muted",
      mode === "off"
    );

    soundButton.setAttribute(
      "aria-label",
      face.tip
    );

    soundButton.setAttribute(
      "aria-pressed",
      String(mode !== "off")
    );
  }


  soundButton
    ?.addEventListener(
      "click",
      event => {

        event.preventDefault();
        event.stopPropagation();

        AcidSound.cycle();

        syncSoundButton();

        if (AcidSound.enabled()) {
          AcidSound.play("card");
        }
      }
    );


  syncSoundButton();


  /* =======================================================
     АУРА АКТИВНОГО ЦВЕТА + СЧЁТЧИК КЛАСТЕРА
     ======================================================= */

  let shownColor = null;

  let shownStack = 0;

  let auraTimer = null;


  function paintAura() {

    const pile =
      $$("discard");

    if (!pile) {
      return;
    }

    pile.dataset.color =
      currentColor;

    if (
      shownColor === currentColor
    ) {
      return;
    }

    shownColor = currentColor;

    pile.classList.remove("aura-shift");

    /* перезапуск анимации */
    void pile.offsetWidth;

    pile.classList.add("aura-shift");

    clearTimeout(auraTimer);

    auraTimer =
      setTimeout(
        () =>
          pile.classList.remove("aura-shift"),
        560
      );
  }


  function paintStack() {

    const hud =
      $$("stackHUD");

    const value =
      $$("stackHUDValue");

    if (!hud || !value) {
      return;
    }


    /*
      Штраф виден и по самой карте на столе: цифру наверху
      легко пропустить, а карта, которая только что прилетела,
      лежит ровно там, куда игрок и смотрит.
    */
    const pile =
      document.querySelector(".discardPile");

    pile
      ?.classList
      .toggle("is-penalty", drawPenalty > 0);


    if (drawPenalty <= 0) {

      hud.classList.add("hidden");

      hud.classList.remove("bump", "mine");

      shownStack = 0;

      return;
    }


    const mine =
      turn === "player";

    value.textContent =
      "+" + drawPenalty;

    /*
      Слово «штраф» здесь обязательно: одно «возьмёшь» рядом
      с числом читается как подсказка, а не как то, что тебе
      сейчас прилетит.
    */
    hud.querySelector(".stackHUDLabel")
      .textContent =
        mine
          ? "ШТРАФ · ВОЗЬМЁШЬ"
          : "ШТРАФ · ВОЗЬМЁТ СОПЕРНИК";

    hud.classList.toggle("mine", mine);

    hud.classList.remove("hidden");


    if (drawPenalty > shownStack) {

      hud.classList.remove("bump");

      void hud.offsetWidth;

      hud.classList.add("bump");
    }

    shownStack = drawPenalty;
  }


  /*
    Колода должна выглядеть на своё количество: одна карта
    на восемьдесят оставшихся не говорит ничего.
  */
  function paintDeck() {

    const el = $$("deck");

    if (!el) {
      return;
    }

    const left = deck.length;

    el.dataset.thick =
      String(
        left === 0 ? 0 :
        left < 12 ? 1 :
        left < 30 ? 2 :
        left < 55 ? 3 :
        left < 80 ? 4 : 5
      );


    /*
      Сброс растёт ровно настолько, насколько тает колода,
      поэтому его толщина считается по своей стопке.
    */
    const pile =
      document.querySelector(".discardPile");

    if (pile) {

      const played = discard.length;

      pile.dataset.thick =
        String(
          played < 2 ? 0 :
          played < 6 ? 1 :
          played < 14 ? 2 :
          played < 28 ? 3 :
          played < 50 ? 4 : 5
        );
    }
  }


  const baseRender = render;

  render = function () {

    baseRender();

    paintAura();

    paintStack();

    paintDeck();
  };


  /* =======================================================
     ЗВУК ИГРОВЫХ СОБЫТИЙ

     Один источник правды: что случилось за ход, знает
     редьюсер, а не обёртки над функциями отрисовки.
     ======================================================= */

  let lastDrawSound = 0;


  /*
    Названия мастей для объявления цвета. Берём по тому, как
    масть выглядит после перекраски, а не по внутреннему
    имени: игрок видит розовую карту, а не «red».
  */
  const COLOR_WORDS = {
    red: "РОЗОВЫЙ",
    yellow: "ЖЁЛТЫЙ",
    green: "ЗЕЛЁНЫЙ",
    blue: "ГОЛУБОЙ"
  };


  let colorFlashTimer = null;


  /*
    После чёрной карты цвет меняется на выбранный, и по одной
    точке сбоку это не прочитать. Объявляем словом в центре
    стола — так это сделано в мобильном UNO, и там понятно
    с одного взгляда.
  */
  function flashColor(color) {

    const el = $$("colorFlash");

    if (!el || !COLOR_WORDS[color]) {
      return;
    }

    el.textContent = COLOR_WORDS[color];

    el.style.setProperty("--flash", `var(--${color})`);

    el.classList.remove("show");

    void el.offsetWidth;

    el.classList.add("show");

    clearTimeout(colorFlashTimer);

    colorFlashTimer =
      setTimeout(
        () => el.classList.remove("show"),
        1700
      );
  }


  /*
    Знак сыгранной спецкарты разворачивается на весь стол. Так
    сделано в мобильном UNO, и не ради красоты: ход соперника
    длится доли секунды, и по одной маленькой карте в центре
    не успеваешь понять, что именно случилось.

    У цифр знака нет — на них стол не мигает, иначе вспышка
    перестанет что-либо значить.
  */
  const FLASH_VALUES = [
    "skip", "reverse", "+2", "+4", "wild"
  ];


  /*
    Волна по кольцам арены цветом сыгранной карты. Называет
    масть быстрее, чем это делает сама карта: волну видно
    боковым зрением, а карту надо разглядеть.
  */
  function pulseRing(color) {

    const el = $$("ringPulse");

    if (!el) {
      return;
    }

    el.style.setProperty(
      "--wave",
      `var(--${color === "wild" ? "purple" : color})`
    );

    el.classList.remove("go");

    /* перезапуск: подряд идущие ходы иначе мигают один раз */
    void el.offsetWidth;

    el.classList.add("go");
  }


  /*
    Короткий эффект на столе. Класс снимается по окончании
    анимации, иначе второй такой же ход её не перезапустит.
  */
  function tableFx(name, ms) {

    const table =
      document.querySelector(".tableInner");

    if (!table) {
      return;
    }

    table.classList.remove(name);

    void table.offsetWidth;

    table.classList.add(name);

    window.setTimeout(
      () => table.classList.remove(name),
      ms
    );
  }


  function flashCard(card) {

    const el = $$("cardFlash");

    if (
      !el ||
      !card ||
      !FLASH_VALUES.includes(card.value)
    ) {
      return;
    }

    el.dataset.v = card.value;

    el.style.setProperty(
      "--suit",
      `var(--${card.color === "wild" ? "magenta" : card.color})`
    );

    el.classList.remove("show");

    /* перезапуск анимации: без этого подряд идущие спецкарты мигают один раз */
    void el.offsetWidth;

    el.classList.add("show");
  }


  /*
    Карта действия обязана звучать крупнее цифры. В мобильном
    UNO разрыв между ними примерно в пятнадцать децибел и
    вдвое-втрое большая длина: одинаковый щелчок на «5» и на
    «+4» съедает единственную подсказку, что случилось что-то
    важное — а на телефоне игрок часто слышит раньше, чем
    успевает разглядеть эффект.
  */
  function cueFor(card) {

    if (card.value === "reverse") {
      return "reverse";
    }

    if (card.value === "skip") {
      return "skip";
    }

    if (
      card.value === "+2" ||
      card.value === "+4"
    ) {
      return "strike";
    }

    if (card.color === "wild") {
      return "wild";
    }

    return "card";
  }


  AcidStore.subscribe(events => {

    let penalty = false;

    let drawn = 0;

    events.forEach(event => {

      if (event.type === "played") {

        AcidSound.play(
          cueFor(event.card)
        );

        flashCard(event.card);

        pulseRing(
          event.card.color === "wild"
            ? (event.color || "wild")
            : event.card.color
        );

        /*
          Помехи — только на спецкартах: если стол рвёт на
          каждой цифре, это перестаёт что-либо значить.
        */
        if (
          FLASH_VALUES.includes(event.card.value)
        ) {
          tableFx("glitch", 560);
        }

        if (event.card.color === "wild") {
          flashColor(event.color);
        }
      }

      if (event.type === "drew") {

        drawn += 1;

        const now = performance.now();

        /*
          Серия доборов звучит один раз: при штрафе +6
          не нужно шесть одинаковых щелчков подряд.
        */
        if (now - lastDrawSound > 110) {

          lastDrawSound = now;

          AcidSound.play("draw");
        }
      }

      if (
        event.type === "penalty" ||
        event.type === "caught"
      ) {
        penalty = true;
      }

      if (event.type === "uno") {
        AcidSound.play("uno");
      }
    });

    if (penalty) {

      AcidSound.play("penalty");

      /*
        Стол вздрагивает только на крупном штрафе: на «+2»
        тряска превращается в тик, который идёт всю партию.
      */
      if (drawn >= 4) {
        tableFx("jolt", 380);
      }
    }
  });


  /* =======================================================
     ЧАСЫ ПАРТИИ
     ======================================================= */

  const clock =
    new AcidRules.MatchClock({
      limitSeconds:
        AcidRules.MATCH_LIMIT_SECONDS,

      warnSeconds:
        AcidRules.MATCH_WARN_SECONDS
    });


  /*
    Часы выключаются единогласным решением живых игроков.
    Пока живой игрок один, единогласие — это его галочка
    в лобби; с приходом мультиплеера здесь появится
    настоящее голосование.
  */
  let clockOff = false;


  /*
    Простой уровень часы выключает. Выставить флажок надо
    и при возвращении в игру, а не только по нажатию: иначе
    сохранённый уровень поднимался бы с включёнными часами.
    Само значение восстанавливается ниже, вместе с уровнем.
  */


  let lastTick = 0;

  let tickTimer = null;


  function paintClock(snapshot) {

    const el = $$("matchClock");

    if (!el) {
      return;
    }

    el.classList.toggle(
      "hidden",
      !snapshot.visible
    );

    el.classList.toggle(
      "urgent",
      snapshot.visible && snapshot.urgent
    );

    if (snapshot.visible) {
      el.textContent = snapshot.label;
    }
  }


  function tick() {

    const now = performance.now();

    const delta =
      (now - lastTick) / 1000;

    lastTick = now;

    const snapshot =
      clock.advance(delta);

    paintClock(snapshot);

    /*
      В комнате гонг бьёт сервер: у каждого клиента свои
      часы, и договориться им не о чем.
    */
    if (
      snapshot.expired &&
      !AcidStore.online()
    ) {
      finishByTime();
    }
  }


  function startClock() {

    clock.limit =
      clockOff
        ? Infinity
        : AcidRules.matchLimitFor(
            seatCount(),
            humanSeats().length
          );

    clock.start();

    lastTick = performance.now();

    paintClock(clock.advance(0));

    clearInterval(tickTimer);

    tickTimer =
      setInterval(tick, 250);
  }


  function stopClock() {

    clock.stop();

    clearInterval(tickTimer);

    tickTimer = null;

    paintClock(clock.advance(0));
  }


  /* =======================================================
     ИТОГ ПО ОЧКАМ
     ======================================================= */

  function renderScore(points, leaders) {

    const box = $$("endScore");

    if (!box) {
      return;
    }

    box.innerHTML =
      points
        .map((value, index) => `
          <div class="endScoreRow${
            leaders.includes(index)
              ? ""
              : " lost"
          }">
            <span>${seatName(index)}</span>
            <b>${value}</b>
          </div>
        `)
        .join("");

    box.classList.remove("hidden");
  }


  async function finishByTime() {

    if (gameOver) {
      return;
    }

    stopClock();


    /*
      Кластер, висящий на столе в момент гонга, сначала
      уходит тому, кто обязан был его забрать. Иначе можно
      было бы бросить +4 на последней секунде и выиграть
      по очкам, ничего не заплатив.
    */
    /*
      Гонг — такое же действие партии, как выкладка карты.
      Висящий кластер редьюсер сам отдаёт тому, кто обязан
      был его забрать.
    */
    const result =
      await AcidStore.dispatch({
        type: "timeout"
      });

    if (result.error) {
      return;
    }


    const outcome =
      result.events.find(
        event => event.type === "over"
      );


    const leaders =
      outcome.leaders;


    const points =
      outcome.points;


    const playerWon =
      leaders.includes(0);


    render();

    AcidFX.status("ВРЕМЯ ВЫШЛО");

    await AcidFX.flash(
      playerWon
        ? "green"
        : "purple"
    );

    AcidSound.play(
      playerWon
        ? "win"
        : "lose"
    );

    $$("endText").textContent =
      outcome.draw && playerWon
        ? "ВРЕМЯ ВЫШЛО — НИЧЬЯ"
        : playerWon
          ? "ВРЕМЯ ВЫШЛО — ТЫ ВЫИГРАЛ"
          : `ВРЕМЯ ВЫШЛО — ${seatName(leaders[0])} ВЫИГРАЛ`;

    renderScore(
      points,
      leaders
    );

    $$("endScreen")
      ?.classList
      .remove("hidden");
  }


  /* =======================================================
     ПЕРЕХВАТ START / FINISH
     ======================================================= */

  const baseStartGame = startGame;

  startGame = function () {

    baseStartGame();

    $$("endScore")
      ?.classList
      .add("hidden");

    startClock();

    armBack();

    /* новый стол — новый материал карты, фон и рубашка */
    rollSkin();

    window.AcidAssets?.dressArena();

    window.AcidAssets?.dressBacks();

    render();
  };


  const baseFinish = finish;

  finish = async function (playerWon) {

    stopClock();

    AcidSound.play(
      playerWon ? "win" : "lose"
    );

    $$("endScore")
      ?.classList
      .add("hidden");

    return baseFinish(playerWon);
  };


  /* =======================================================
     МАТЕРИАЛ КАРТЫ

     Колода одна, но из чего она сделана — решает жребий на
     каждую партию: плёнка, стекло, плата, трубка, кинескоп.
     Выбор из меню убран намеренно: настройка, которую жмут
     один раз и забывают, не стоит места на стартовом экране,
     а случайный материал делает каждый стол непохожим на
     прошлый, ничего не меняя в правилах.
     ======================================================= */

  const SKINS = [
    "film",
    "glass",
    "pcb",
    "tube",
    "crt"
  ];


  let lastSkin = null;


  function rollSkin() {

    let skin = lastSkin;

    /* два одинаковых стола подряд смазывают весь смысл жребия */
    while (skin === lastSkin && SKINS.length > 1) {
      skin =
        SKINS[
          Math.floor(Math.random() * SKINS.length)
        ];
    }

    lastSkin = skin;

    document.documentElement.dataset.skin = skin;

    window.AcidAssets?.dressSkin(skin);
  }


  document.documentElement.dataset.deck = "acid";

  rollSkin();


  /*
    Рисованные картинки главнее нарисованных кодом: если в
    assets/ что-то лежит, оно и становится лицом игры, а пять
    материалов остаются запасным вариантом. Проверка идёт
    молча — файлов может не быть вовсе.
  */
  window.AcidAssets
    ?.boot()
    .then(() => {

      /*
        Материал разыгран до того, как нашлись картинки, —
        текстуру для него надеваем задним числом.
      */
      window.AcidAssets.dressSkin(
        document.documentElement.dataset.skin
      );

      render();
    });


  /* =======================================================
     ЛОББИ

     Размер стола и часы выбираются до раздачи.
     ======================================================= */

  const lobby =
    $$("lobby");


  let chosenSeats =
    AcidRules.MIN_SEATS;


  /*
    Уровень запоминается между заходами: тот, кому нужен
    простой стол, не должен выбирать его каждый раз заново.
  */
  const LEVEL_KEY =
    "acid-uno-level";


  let chosenCalm =
    (() => {

      try {

        return (
          localStorage.getItem(LEVEL_KEY) === "calm"
        );

      } catch (error) {

        return false;
      }
    })();


  if (chosenCalm) {
    clockOff = true;
  }


  /*
    Живых игроков пока всегда один. Значение уже участвует
    в расчёте лимита, поэтому мультиплееру останется только
    его выставить.
  */
  let chosenHumans = 1;


  function paintLobby() {

    /*
      Возвращаться некуда, если партия кончилась: там ждёт
      экран итога, и кнопка увела бы в пустой стол.
    */
    $$("lobbyResume")
      ?.classList
      .toggle("hidden", gameOver);


    document
      .querySelectorAll(".levelPick")
      .forEach(button =>
        button.classList.toggle(
          "chosen",
          (button.dataset.level === "calm") ===
            chosenCalm
        )
      );


    /*
      На простом столе часы выключены и переключать их
      нечем: обратный отсчёт — ровно то, что мешает
      разбираться в правилах без спешки.
    */
    document
      .querySelector(".lobbySetup")
      ?.classList
      .toggle("calm", chosenCalm);


    document
      .querySelectorAll(".seatPick")
      .forEach(button =>
        button.classList.toggle(
          "chosen",
          Number(button.dataset.seats) ===
            chosenSeats
        )
      );


    const toggle =
      $$("clockToggle");

    toggle
      ?.classList
      .toggle("on", clockOff);

    toggle
      ?.setAttribute(
        "aria-pressed",
        String(clockOff)
      );


    /*
      Строку про длину таймера убрали из меню: она объясняла
      то, что и так понятно из флажка, и была лишней в и без
      того плотном экране.
    */
  }


  /*
    Часы шли, когда открывали меню? Тогда при возврате их
    надо не запустить заново, а продолжить: иначе взгляд
    в меню дарил бы игроку полную партию времени.
  */
  let clockWasRunning = false;


  function openLobby() {

    chosenSeats =
      Math.max(
        AcidRules.MIN_SEATS,
        seatCount() || AcidRules.MIN_SEATS
      );

    clockWasRunning =
      clock.running;

    stopClock();

    paintLobby();

    lobby?.classList.remove("hidden");
  }


  /*
    Вернуться в партию. «Стол и игроки» открывает то же
    меню, что и «новая игра», и случайное касание уводило
    из партии совсем — доиграть было уже нельзя.
  */
  function resumeGame() {

    closeLobby();

    if (clockWasRunning) {

      clock.resume();

      lastTick = performance.now();

      paintClock(clock.advance(0));

      clearInterval(tickTimer);

      tickTimer =
        setInterval(tick, 250);
    }
  }


  $$("lobbyResume")
    ?.addEventListener(
      "click",
      resumeGame
    );


  function closeLobby() {
    lobby?.classList.add("hidden");
  }


  document
    .querySelectorAll(".seatPick")
    .forEach(button =>
      button.addEventListener(
        "click",
        () => {

          chosenSeats =
            Number(button.dataset.seats);

          AcidSound.play("card");

          paintLobby();
        }
      )
    );


  $$("clockToggle")
    ?.addEventListener(
      "click",
      () => {

        if (chosenCalm) {

          return;
        }

        clockOff = !clockOff;

        AcidSound.play("draw");

        paintLobby();
      }
    );


  document
    .querySelectorAll(".levelPick")
    .forEach(button =>
      button.addEventListener(
        "click",
        () => {

          chosenCalm =
            button.dataset.level === "calm";


          try {

            localStorage.setItem(
              LEVEL_KEY,
              chosenCalm ? "calm" : "normal"
            );

          } catch (error) {

            /* приватный режим — играем без памяти */
          }


          /*
            Простой стол — это стол на двоих: следить за
            шестью соперниками в первой партии невозможно.
            Число мест всё равно остаётся под рукой, если
            захочется позвать больше.
          */
          if (chosenCalm) {

            chosenSeats =
              AcidRules.MIN_SEATS;

            clockOff = true;
          }


          AcidSound.play("card");

          paintLobby();
        }
      )
    );


  $$("lobbyStart")
    ?.addEventListener(
      "click",
      () => {

        tableSize = chosenSeats;

        calmMode = chosenCalm;

        closeLobby();

        $$("endScreen")
          ?.classList
          .add("hidden");

        startGame();
      }
    );


  /* =======================================================
     ДВЕРИ СТАРТОВОГО МЕНЮ

     Настройки стола общие для обоих режимов, поэтому блок
     настроек один и переезжает внутрь выбранной двери.
     Две копии держать нельзя — обработчики ищут кнопки по
     идентификаторам, а те обязаны быть единственными.
     ======================================================= */

  function pickDoor(which) {

    const setup =
      document.querySelector(".lobbySetup");

    document
      .querySelectorAll(".door")
      .forEach(door => {

        const on =
          door.dataset.door === which;

        door.classList.toggle("chosen", on);

        if (on && setup) {

          door
            .querySelector(".doorSlot")
            ?.appendChild(setup);
        }
      });

    paintLobby();
  }


  document
    .querySelectorAll(".door")
    .forEach(door =>

      door.addEventListener(
        "click",
        event => {

          if (
            door.classList.contains("chosen")
          ) {
            return;
          }

          /*
            Перехват на погружении: нажатие на действие внутри
            закрытой двери сначала открывает её, а не запускает
            игру. Иначе на большом экране, где видны обе двери,
            можно случайно начать не тот режим.
          */
          event.stopPropagation();

          event.preventDefault();

          pickDoor(door.dataset.door);
        },
        true
      )
    );


  /* =======================================================
     КНОПКА «НАЗАД»

     Кнопки выхода из живой партии мы закрыли, но остаётся
     кнопка браузера — и она уносит из партии молча. Лишняя
     запись в истории ловит нажатие: подтвердил — выходим,
     отказался — запись возвращается на место, и партия
     продолжается.
     ======================================================= */

  let backArmed = false;


  function armBack() {

    if (backArmed) {
      return;
    }

    backArmed = true;

    try {
      history.pushState({ acidMatch: 1 }, "");

    } catch (error) {
      /* история недоступна — молча остаёмся без защиты */
      backArmed = false;
    }
  }


  window.addEventListener(
    "popstate",
    () => {

      if (
        !backArmed ||
        gameOver ||
        !$$("lobby")?.classList.contains("hidden")
      ) {
        return;
      }

      /* запись возвращается сразу: иначе второе «назад» уже уводит */
      try {
        history.pushState({ acidMatch: 1 }, "");
      } catch (error) {
        /* нечего возвращать */
      }

      const leave =
        window.confirm(
          "Выйти из партии? Она на этом закончится."
        );

      if (!leave) {
        return;
      }

      backArmed = false;

      if (AcidStore.online()) {

        window.AcidRoom?.leave?.();

        location.replace(location.pathname);

        return;
      }

      openLobby();
    }
  );


  $$("tableButton")
    ?.addEventListener(
      "click",
      openLobby
    );


  /*
    «Заново» и «на главную» посреди партии — необратимо, и
    оба стоят в шапке рядом с безобидными кнопками. Просто
    спрашиваем.

    Экран итога не в счёт: там партии уже нет.
  */
  function confirmLeave(event, question) {

    if (gameOver) {
      return;
    }

    if (!window.confirm(question)) {

      event.preventDefault();

      event.stopPropagation();
    }
  }


  $$("restart")
    ?.addEventListener(
      "click",
      event =>
        confirmLeave(
          event,
          "Начать партию заново? Эта закончится."
        ),
      true
    );


  $$("homeLink")
    ?.addEventListener(
      "click",
      event =>
        confirmLeave(
          event,
          "Выйти на главную? Партия закончится."
        ),
      true
    );


  /*
    Из партии с живым игроком выйти нельзя. Случайное касание
    «сменить стол» или «заново» бросало комнату: игра уходила
    в меню, соперник оставался ждать, а вернуться было некуда.

    Перехват висит на документе и на погружении: обработчики
    самих кнопок навешаны раньше в game.js, и на самой кнопке
    порядок решает не фаза, а очередь регистрации — успеть
    можно только выше по дереву.
  */
  document.addEventListener(
    "click",
    event => {

      const exit =
        event.target
          ?.closest?.("#restart, #tableButton");

      if (
        !exit ||
        !AcidStore.online() ||
        gameOver
      ) {
        return;
      }

      event.stopPropagation();

      event.preventDefault();

      AcidFX.status(
        "ПАРТИЯ ИДЁТ — ИЗ НЕЁ НЕ ВЫЙТИ"
      );
    },
    true
  );


  /* =======================================================
     СТАРТ
     ======================================================= */

  openLobby();


  /*
    Ручка для отладки. Имя AcidMatch занято редьюсером
    партии в src/match.js.
  */
  window.AcidClock = {
    clock,
    startClock,
    stopClock,

    /*
      Подогнать часы под серверные: в комнате время
      считает сервер, клиент только рисует.
    */
    syncFrom(payload) {

      if (!payload || payload.limit === null) {

        clock.disable();

        paintClock(clock.advance(0));

        return;
      }

      clock.limit = payload.limit;
      clock.elapsed = payload.elapsed || 0;
      clock.running = true;
      clock.expired = false;

      lastTick = performance.now();

      clearInterval(tickTimer);

      tickTimer = setInterval(tick, 250);

      paintClock(clock.advance(0));
    },

    disableClock() {

      clockOff = true;

      clock.disable();

      paintClock(clock.advance(0));
    },

    enableClock() {

      clockOff = false;

      startClock();
    },

    get off() {
      return clockOff;
    },

    set off(value) {
      clockOff = Boolean(value);
    }
  };

})();
