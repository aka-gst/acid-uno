"use strict";

/* ==========================================
   ACID UNO
========================================== */

const COLORS = ["red", "yellow", "green", "blue"];

let deck = [];
let player = [];
let bot = [];
let discard = [];

let turn = "player";
let currentColor = null;

let pendingWildIndex = null;
let pendingWildMode = null;

let drawPenalty = 0;
let penaltyType = null;

let gameOver = false;
let busy = false;


/* ==========================================
   HELPERS
========================================== */

function $(id) {
  return document.getElementById(id);
}

function random(max) {
  return Math.floor(Math.random() * max);
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = random(i + 1);

    [array[i], array[j]] =
      [array[j], array[i]];
  }

  return array;
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function topCard() {
  return discard[discard.length - 1];
}


/* ==========================================
   CARD IDs
========================================== */

let nextCardId = 1;

function makeCard(color, value) {
  return {
    id: nextCardId++,
    color,
    value
  };
}


/* ==========================================
   DECK
========================================== */

function makeDeck() {
  deck = [];
  nextCardId = 1;

  COLORS.forEach(color => {

    deck.push(
      makeCard(color, "0")
    );

    for (let n = 1; n <= 9; n++) {
      deck.push(
        makeCard(color, String(n))
      );

      deck.push(
        makeCard(color, String(n))
      );
    }

    for (let i = 0; i < 2; i++) {
      deck.push(
        makeCard(color, "skip")
      );

      deck.push(
        makeCard(color, "reverse")
      );

      deck.push(
        makeCard(color, "+2")
      );
    }
  });

  for (let i = 0; i < 4; i++) {
    deck.push(
      makeCard("wild", "wild")
    );

    deck.push(
      makeCard("wild", "+4")
    );
  }

  shuffle(deck);
}


/* ==========================================
   RECYCLE DECK
========================================== */

function recycleDeck() {
  if (deck.length > 0) return true;

  if (discard.length <= 1) {
    return false;
  }

  const top = discard.pop();

  deck = discard.slice();
  discard = [top];

  shuffle(deck);

  status("СБРОС ПЕРЕМЕШАН");

  return true;
}


function drawRaw() {
  if (!recycleDeck()) {
    return null;
  }

  return deck.pop() || null;
}


function drawCards(hand, amount) {
  let drawn = 0;

  for (let i = 0; i < amount; i++) {
    const card = drawRaw();

    if (!card) break;

    hand.push(card);
    drawn++;
  }

  return drawn;
}


/* ==========================================
   LABELS
========================================== */

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


/* ==========================================
   CARD RULES
========================================== */

function normalPlayable(card) {
  const top = topCard();

  if (!top) return true;

  if (card.color === "wild") {
    return true;
  }

  if (card.color === currentColor) {
    return true;
  }

  if (card.value === top.value) {
    return true;
  }

  return false;
}


function canDefendPenalty(card) {
  if (drawPenalty <= 0) {
    return false;
  }

  /*
    +2 можно отбить:
    +2 или +4

    +4 можно отбить:
    только +4
  */

  if (penaltyType === "+2") {
    return (
      card.value === "+2" ||
      card.value === "+4"
    );
  }

  if (penaltyType === "+4") {
    return card.value === "+4";
  }

  return false;
}


function canPlay(card) {
  if (drawPenalty > 0) {
    return canDefendPenalty(card);
  }

  return normalPlayable(card);
}


/* ==========================================
   INTERCEPT
========================================== */

/*
  Перехват:
  если в руке есть ТОЧНО такая же карта,
  как лежащая сверху — её можно кинуть
  независимо от очереди.

  Wild сравниваются по value.
*/

function sameForIntercept(a, b) {
  if (!a || !b) return false;

  if (a.color === "wild" || b.color === "wild") {
    return (
      a.color === b.color &&
      a.value === b.value
    );
  }

  return (
    a.color === b.color &&
    a.value === b.value
  );
}


function canIntercept(card) {
  const top = topCard();

  if (!top) return false;

  return sameForIntercept(card, top);
}


function flashIntercept(text = "ПЕРЕХВАТ") {
  const flash = $("interceptFlash");

  flash.innerHTML =
    "<span>✋</span>" + text;

  flash.classList.remove("hidden");

  setTimeout(() => {
    flash.classList.add("hidden");
  }, 650);
}


/* ==========================================
   START GAME
========================================== */

function startGame() {
  gameOver = false;
  busy = false;

  turn = "player";

  currentColor = null;

  pendingWildIndex = null;
  pendingWildMode = null;

  drawPenalty = 0;
  penaltyType = null;

  player = [];
  bot = [];
  discard = [];

  makeDeck();

  drawCards(player, 7);
  drawCards(bot, 7);

  let first = drawRaw();

  /*
    Стартуем с обычной числовой карты,
    чтобы спецэффект не срабатывал
    до первого хода.
  */

  while (
    first &&
    (
      first.color === "wild" ||
      ["skip", "reverse", "+2"].includes(first.value)
    )
  ) {
    deck.splice(
      random(deck.length + 1),
      0,
      first
    );

    first = drawRaw();
  }

  if (!first) {
    first = makeCard("red", "0");
  }

  discard.push(first);
  currentColor = first.color;

  $("endScreen").classList.add("hidden");
  $("colorPicker").classList.add("hidden");

  status("ТВОЙ ХОД");

  render();
}


/* ==========================================
   HTML CARD
========================================== */

function cardHTML(card) {
  return `
    <div class="card ${card.color}">
      <div class="value">
        ${label(card.value)}
      </div>
    </div>
  `;
}


/* ==========================================
   RENDER
========================================== */

function render() {
  renderDiscard();
  renderBot();
  renderHand();
  renderPenalty();
  renderCurrentColor();

  $("deckCount").textContent =
    `${deck.length} карт`;

  $("playerCount").textContent =
    `${player.length} карт`;
}


function renderDiscard() {
  const card = topCard();

  if (!card) return;

  $("discard").innerHTML =
    cardHTML(card);
}


/* ==========================================
   BOT HAND
========================================== */

function renderBot() {
  $("botCount").textContent =
    `${bot.length} карт`;

  const area = $("botCards");

  area.innerHTML = "";

  /*
    Не рисуем сотню рубашек.
    После 18 карт плотность уже
    просто показывает большую руку.
  */

  const visible =
    Math.min(bot.length, 18);

  for (let i = 0; i < visible; i++) {
    const card =
      document.createElement("div");

    card.className = "botCard";

    area.appendChild(card);
  }
}


/* ==========================================
   FAN MATH
========================================== */

function getFanLayout(count) {
  const width =
    Math.max(
      280,
      window.innerWidth
    );

  /*
    Базовый размер карты — 78px.

    Чем больше карт, тем меньше scale.
  */

  let scale = 1;

  if (count <= 7) {
    scale = 1;
  } else if (count <= 10) {
    scale = .94;
  } else if (count <= 14) {
    scale = .86;
  } else if (count <= 18) {
    scale = .76;
  } else if (count <= 24) {
    scale = .66;
  } else if (count <= 32) {
    scale = .57;
  } else {
    scale = .49;
  }

  /*
    Доступная ширина веера.
  */

  const usableWidth =
    width - 30;

  /*
    Максимальный горизонтальный размах.
  */

  let fanWidth =
    Math.min(
      usableWidth,
      390
    );

  /*
    Для маленькой руки делаем
    более компактный веер.
  */

  if (count <= 7) {
    fanWidth =
      Math.min(
        usableWidth,
        300
      );
  }

  if (count <= 4) {
    fanWidth =
      Math.min(
        usableWidth,
        210
      );
  }

  /*
    Карты должны оставаться
    внутри экрана с учётом scale.
  */

  const halfCard =
    (78 * scale) / 2;

  const maxCenter =
    Math.max(
      0,
      width / 2 -
      halfCard -
      8
    );

  const halfFan =
    Math.min(
      fanWidth / 2,
      maxCenter
    );

  /*
    Угол веера.

    При большом количестве карт
    не увеличиваем его бесконечно.
  */

  let maxAngle =
    Math.min(
      28,
      5 + count * 1.7
    );

  if (count > 18) {
    maxAngle = 24;
  }

  return {
    scale,
    halfFan,
    maxAngle
  };
}


function fanPosition(index, count) {
  if (count <= 1) {
    return {
      x: 0,
      y: -10,
      rot: 0,
      scale: 1
    };
  }

  const layout =
    getFanLayout(count);

  const t =
    index / (count - 1);

  /*
    -1 слева
     0 центр
    +1 справа
  */

  const normalized =
    t * 2 - 1;

  const x =
    normalized *
    layout.halfFan;

  const rot =
    normalized *
    layout.maxAngle;

  /*
    Парабола.

    Центр выше,
    края ниже.
  */

  const curve =
    normalized * normalized;

  const y =
    -28 +
    curve * 34;

  return {
    x,
    y,
    rot,
    scale: layout.scale
  };
}


/* ==========================================
   PLAYER HAND
========================================== */

function renderHand() {
  const hand = $("hand");

  hand.innerHTML = "";

  const count = player.length;

  player.forEach((card, index) => {
    const el =
      document.createElement("div");

    el.className =
      `handCard ${card.color}`;

    /*
      Подсветка:

      в свой ход — обычные доступные карты.

      не в свой ход — только карта,
      которой можно сделать Перехват.
    */

    const playable =
      (
        turn === "player" &&
        canPlay(card)
      ) ||
      (
        turn !== "player" &&
        canIntercept(card)
      );

    if (playable) {
      el.classList.add("playable");
    }

    el.innerHTML = `
      <div class="value">
        ${label(card.value)}
      </div>
    `;

    const pos =
      fanPosition(index, count);

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

    /*
      Правая карта должна быть выше
      предыдущей при перекрытии.
    */

    el.style.zIndex =
      String(index + 1);

    el.dataset.index =
      String(index);

    el.addEventListener(
      "click",
      () => {
        handlePlayerCard(index);
      }
    );

    hand.appendChild(el);
  });
}


/* ==========================================
   CURRENT COLOR
========================================== */

function renderCurrentColor() {
  const dot =
    $("currentColorDot");

  const colors = {
    red: "#f13e50",
    yellow: "#f3d33e",
    green: "#36d16f",
    blue: "#3d86ff"
  };

  dot.style.background =
    colors[currentColor] ||
    "#ffffff";

  dot.style.color =
    colors[currentColor] ||
    "#ffffff";
}


/* ==========================================
   PENALTY UI
========================================== */

function renderPenalty() {
  const el =
    $("penalty");

  if (drawPenalty <= 0) {
    el.classList.add("hidden");
    el.textContent = "";
    return;
  }

  el.classList.remove("hidden");

  el.textContent =
    `ШТРАФ +${drawPenalty}`;
}


/* ==========================================
   STATUS
========================================== */

function status(text) {
  $("status").textContent = text;
}


/* ==========================================
   PLAYER CARD CLICK
========================================== */

function handlePlayerCard(index) {
  if (gameOver || busy) {
    return;
  }

  const card =
    player[index];

  if (!card) return;

  /*
    Чужой ход:
    разрешён только Перехват.
  */

  if (turn !== "player") {
    if (canIntercept(card)) {
      playerIntercept(index);
    }

    return;
  }

  /*
    В свой ход тоже можно сделать
    обычный ход этой же картой.
  */

  if (!canPlay(card)) {
    status(
      drawPenalty > 0
        ? "ОТБЕЙ ШТРАФ ИЛИ ЗАБЕРИ КАРТЫ"
        : "ЭТУ КАРТУ НЕЛЬЗЯ ПОЛОЖИТЬ"
    );

    return;
  }

  /*
    Wild требует выбора цвета.
  */

  if (card.color === "wild") {
    pendingWildIndex = index;
    pendingWildMode = "normal";

    $("colorPicker")
      .classList
      .remove("hidden");

    return;
  }

  playerPlay(index, null, false);
}


/* ==========================================
   PLAYER INTERCEPT
========================================== */

function playerIntercept(index) {
  const card =
    player[index];

  if (!canIntercept(card)) {
    return;
  }

  /*
    Wild-перехват тоже требует цвет.
  */

  if (card.color === "wild") {
    pendingWildIndex = index;
    pendingWildMode = "intercept";

    $("colorPicker")
      .classList
      .remove("hidden");

    return;
  }

  flashIntercept("ПЕРЕХВАТ!");

  /*
    После Перехвата ход становится
    ходом игрока, который перехватил.
  */

  turn = "player";

  playerPlay(
    index,
    null,
    true
  );
}


/* ==========================================
   COLOR PICKER
========================================== */

function chooseColor(color) {
  if (pendingWildIndex === null) {
    return;
  }

  const index =
    pendingWildIndex;

  const mode =
    pendingWildMode;

  pendingWildIndex = null;
  pendingWildMode = null;

  $("colorPicker")
    .classList
    .add("hidden");

  if (mode === "intercept") {
    flashIntercept("ПЕРЕХВАТ!");
    turn = "player";
  }

  playerPlay(
    index,
    color,
    mode === "intercept"
  );
}


/* ==========================================
   APPLY CARD
========================================== */

function placeCard(card, chosenColor) {
  discard.push(card);

  if (card.color === "wild") {
    currentColor =
      chosenColor || COLORS[random(4)];
  } else {
    currentColor =
      card.color;
  }
}


function applyPenaltyCard(card) {
  if (card.value === "+2") {
    drawPenalty += 2;

    /*
      Если штраф начался +2,
      он остаётся типом +2.

      +4 поверх +2 переводит
      цепочку в +4.
    */

    if (!penaltyType) {
      penaltyType = "+2";
    }

    return;
  }

  if (card.value === "+4") {
    drawPenalty += 4;
    penaltyType = "+4";
  }
}


/* ==========================================
   PLAYER PLAY
========================================== */

async function playerPlay(
  index,
  chosenColor,
  wasIntercept
) {
  if (gameOver) return;

  const card =
    player.splice(index, 1)[0];

  if (!card) return;

  placeCard(
    card,
    chosenColor
  );

  applyPenaltyCard(card);

  render();

  if (player.length === 0) {
    finish(true);
    return;
  }

  /*
    Skip и Reverse в дуэли:
    соперник пропускает,
    игрок ходит снова.
  */

  if (
    card.value === "skip" ||
    card.value === "reverse"
  ) {
    turn = "player";

    status(
      card.value === "skip"
        ? "БОТ ПРОПУСКАЕТ — ХОДИ ЕЩЁ"
        : "РАЗВОРОТ — ХОДИ ЕЩЁ"
    );

    render();
    return;
  }

  /*
    Перехват передаёт очередь
    перехватившему игроку.
    После самой карты начинается
    обычная последовательность:
    следующий — бот.

    Но у бота будет короткое окно,
    в которое он сам может
    контр-перехватить.
  */

  turn = "bot";

  status(
    drawPenalty > 0
      ? `БОТ: ШТРАФ +${drawPenalty}`
      : "БОТ ДУМАЕТ..."
  );

  render();

  busy = true;

  await wait(
    wasIntercept ? 380 : 520
  );

  busy = false;

  botTurn();
}


/* ==========================================
   PLAYER DRAW
========================================== */

async function playerDraw() {
  if (
    gameOver ||
    busy ||
    turn !== "player"
  ) {
    return;
  }

  /*
    Если висит штраф —
    нажатие колоды означает:
    забрать весь штраф.
  */

  if (drawPenalty > 0) {
    busy = true;

    const amount =
      drawPenalty;

    drawCards(
      player,
      amount
    );

    drawPenalty = 0;
    penaltyType = null;

    status(
      `ТЫ ВЗЯЛ ${amount} КАРТ`
    );

    render();

    await wait(450);

    turn = "bot";
    busy = false;

    status("БОТ ДУМАЕТ...");

    render();

    setTimeout(
      botTurn,
      450
    );

    return;
  }

  /*
    Добровольный добор разрешён.
    Если подходящая уже есть —
    берём ровно одну.
  */

  const alreadyPlayable =
    player.some(card =>
      normalPlayable(card)
    );

  if (alreadyPlayable) {
    const card =
      drawRaw();

    if (card) {
      player.push(card);
    }

    status("ТЫ ВЗЯЛ КАРТУ");

    render();

    return;
  }

  /*
    Если ходить нечем —
    добираем до первой
    подходящей карты.
  */

  busy = true;

  let amount = 0;
  let found = false;

  while (!found) {
    const card =
      drawRaw();

    if (!card) break;

    player.push(card);
    amount++;

    if (normalPlayable(card)) {
      found = true;
    }

    /*
      Защита от теоретической
      бесконечной петли.
  */
    if (amount > 150) {
      break;
    }
  }

  busy = false;

  status(
    amount === 1
      ? "НАШЛАСЬ ПОДХОДЯЩАЯ КАРТА"
      : `ДОБРАНО ${amount} КАРТ`
  );

  render();
}


/* ==========================================
   BOT AI
========================================== */

function botPlayableIndexes() {
  const indexes = [];

  bot.forEach((card, index) => {
    if (canPlay(card)) {
      indexes.push(index);
    }
  });

  return indexes;
}


function botInterceptIndex() {
  const top =
    topCard();

  for (let i = 0; i < bot.length; i++) {
    if (
      sameForIntercept(
        bot[i],
        top
      )
    ) {
      return i;
    }
  }

  return -1;
}


function bestBotColor() {
  const counts = {
    red: 0,
    yellow: 0,
    green: 0,
    blue: 0
  };

  bot.forEach(card => {
    if (
      Object.prototype.hasOwnProperty.call(
        counts,
        card.color
      )
    ) {
      counts[card.color]++;
    }
  });

  let best = COLORS[0];

  COLORS.forEach(color => {
    if (
      counts[color] >
      counts[best]
    ) {
      best = color;
    }
  });

  return best;
}


function botChooseCard(indexes) {
  /*
    Простая стратегия:
    сначала штрафные,
    потом skip/reverse,
    затем обычные,
    Wild старается сохранить.
  */

  const priorities = {
    "+4": 6,
    "+2": 5,
    "skip": 4,
    "reverse": 4,
    "wild": 1
  };

  let bestIndex =
    indexes[0];

  let bestScore = -Infinity;

  indexes.forEach(index => {
    const card =
      bot[index];

    let score =
      priorities[card.value] || 2;

    /*
      Wild экономим.
  */
    if (card.color === "wild") {
      score -= 1.2;
    }

    /*
      Если у бота мало карт —
      становится агрессивнее.
  */
    if (
      bot.length <= 3 &&
      (
        card.value === "+2" ||
        card.value === "+4" ||
        card.value === "skip" ||
        card.value === "reverse"
      )
    ) {
      score += 2;
    }

    score += Math.random() * .5;

    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestIndex;
}


/* ==========================================
   BOT TURN
========================================== */

async function botTurn() {
  if (
    gameOver ||
    turn !== "bot"
  ) {
    return;
  }

  busy = true;

  /*
    Контр-перехват.

    Если после твоего хода
    у бота есть точно такая же карта,
    иногда он мгновенно кидает её.

    Вероятность высокая,
    но не 100%, чтобы бот
    не выглядел машиной с нулевой
    реакцией.
  */

  const intercept =
    botInterceptIndex();

  if (
    intercept !== -1 &&
    Math.random() < .82
  ) {
    await wait(220);

    flashIntercept(
      "БОТ: ПЕРЕХВАТ!"
    );

    await wait(250);

    await botPlayCard(
      intercept,
      true
    );

    busy = false;

    return;
  }

  /*
    Штраф.
  */

  if (drawPenalty > 0) {
    const defenses =
      botPlayableIndexes();

    if (defenses.length === 0) {
      const amount =
        drawPenalty;

      drawCards(
        bot,
        amount
      );

      drawPenalty = 0;
      penaltyType = null;

      status(
        `БОТ ВЗЯЛ ${amount} КАРТ`
      );

      render();

      await wait(600);

      turn = "player";
      busy = false;

      status("ТВОЙ ХОД");

      render();

      return;
    }

    const chosen =
      botChooseCard(defenses);

    await botPlayCard(
      chosen,
      false
    );

    busy = false;

    return;
  }

  /*
    Обычный ход.
  */

  let playable =
    botPlayableIndexes();

  /*
    Если ходить нечем —
    бот тоже добирает до
    подходящей карты.
  */

  if (playable.length === 0) {
    status(
      "БОТ ДОБИРАЕТ..."
    );

    render();

    await wait(350);

    let foundIndex = -1;
    let safety = 0;

    while (
      foundIndex === -1 &&
      safety < 150
    ) {
      safety++;

      const card =
        drawRaw();

      if (!card) break;

      bot.push(card);

      if (normalPlayable(card)) {
        foundIndex =
          bot.length - 1;
      }
    }

    render();

    if (foundIndex !== -1) {
      playable = [foundIndex];
    }
  }

  if (playable.length === 0) {
    turn = "player";
    busy = false;

    status("ТВОЙ ХОД");

    render();
    return;
  }

  const chosen =
    botChooseCard(playable);

  await wait(260);

  await botPlayCard(
    chosen,
    false
  );

  busy = false;
}


/* ==========================================
   BOT PLAY CARD
========================================== */

async function botPlayCard(
  index,
  wasIntercept
) {
  const card =
    bot.splice(index, 1)[0];

  if (!card) return;

  let chosenColor = null;

  if (card.color === "wild") {
    chosenColor =
      bestBotColor();
  }

  placeCard(
    card,
    chosenColor
  );

  applyPenaltyCard(card);

  render();

  if (bot.length === 0) {
    finish(false);
    return;
  }

  /*
    В дуэли Skip / Reverse
    дают боту ещё один ход.
  */

  if (
    card.value === "skip" ||
    card.value === "reverse"
  ) {
    status(
      card.value === "skip"
        ? "БОТ ПРОПУСТИЛ ТВОЙ ХОД"
        : "БОТ РАЗВЕРНУЛ ХОД"
    );

    render();

    await wait(550);

    turn = "bot";

    status("БОТ ХОДИТ ЕЩЁ...");

    render();

    await wait(350);

    /*
      busy уже true,
      поэтому вызываем напрямую.
  */
    const previousBusy = busy;
    busy = false;

    botTurn();

    busy = previousBusy;

    return;
  }

  /*
    После бота ход игрока.
  */

  turn = "player";

  if (drawPenalty > 0) {
    status(
      `ШТРАФ +${drawPenalty} — ОТБЕЙ ИЛИ ЗАБЕРИ`
    );
  } else if (wasIntercept) {
    status(
      "БОТ ПЕРЕХВАТИЛ — ТВОЙ ХОД"
    );
  } else {
    status("ТВОЙ ХОД");
  }

  render();
}


/* ==========================================
   END
========================================== */

function finish(playerWon) {
  gameOver = true;
  busy = false;

  $("endText").textContent =
    playerWon
      ? "ТЫ ВЫИГРАЛ"
      : "БОТ ВЫИГРАЛ";

  $("endScreen")
    .classList
    .remove("hidden");
}


/* ==========================================
   EVENTS
========================================== */

$("deck")
  .addEventListener(
    "click",
    playerDraw
  );


$("restart")
  .addEventListener(
    "click",
    startGame
  );


$("again")
  .addEventListener(
    "click",
    startGame
  );


document
  .querySelectorAll(".pick")
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        chooseColor(
          button.dataset.color
        );

      }
    );

  });


/* ==========================================
   RESIZE
========================================== */

let resizeTimer = null;

window.addEventListener(
  "resize",
  () => {

    clearTimeout(
      resizeTimer
    );

    resizeTimer =
      setTimeout(
        renderHand,
        80
      );

  }
);


/* ==========================================
   ORIENTATION
========================================== */

window.addEventListener(
  "orientationchange",
  () => {

    setTimeout(
      () => {
        render();
      },
      250
    );

  }
);


/* ==========================================
   START
========================================== */

startGame();