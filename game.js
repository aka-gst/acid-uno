"use strict";

/* =========================================================
   ACID UNO v6 — GAME ENGINE
   ========================================================= */

const COLORS = ["red", "yellow", "green", "blue"];

let deck = [];
let player = [];
let bot = [];
let discard = [];

let turn = "player";
let currentColor = "red";

let drawPenalty = 0;
let penaltyType = null;

let pendingWild = null;

let gameOver = false;
let actionBusy = false;
let nextCardId = 1;


/* =========================================================
   HELPERS
   ========================================================= */

const $ = id => document.getElementById(id);

const sleep = ms =>
  new Promise(resolve => setTimeout(resolve, ms));

function random(max) {
  return Math.floor(Math.random() * max);
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [array[i], array[j]] = [array[j], array[i]];
  }

  return array;
}

function topCard() {
  return discard[discard.length - 1] || null;
}

function makeCard(color, value) {
  return {
    id: nextCardId++,
    color,
    value
  };
}

function cardLabel(value) {
  switch (value) {
    case "skip": return "⊘";
    case "reverse": return "↻";
    case "wild": return "★";
    default: return value;
  }
}

function setBusy(value) {
  actionBusy = value;

  $("game")?.classList.toggle(
    "animating",
    value
  );
}

function unavailable() {
  return (
    gameOver ||
    actionBusy ||
    AcidFX.isLocked()
  );
}


/* =========================================================
   DECK
   ========================================================= */

function createDeck() {
  deck = [];
  nextCardId = 1;

  COLORS.forEach(color => {
    deck.push(makeCard(color, "0"));

    for (let number = 1; number <= 9; number++) {
      deck.push(makeCard(color, String(number)));
      deck.push(makeCard(color, String(number)));
    }

    for (let i = 0; i < 2; i++) {
      deck.push(makeCard(color, "skip"));
      deck.push(makeCard(color, "reverse"));
      deck.push(makeCard(color, "+2"));
    }
  });

  for (let i = 0; i < 4; i++) {
    deck.push(makeCard("wild", "wild"));
    deck.push(makeCard("wild", "+4"));
  }

  shuffle(deck);
}


/* =========================================================
   DRAW / RECYCLE
   ========================================================= */

function recycleDeck() {
  if (deck.length > 0) {
    return true;
  }

  if (discard.length <= 1) {
    return false;
  }

  const top = discard.pop();

  deck = discard.slice();
  discard = [top];

  shuffle(deck);

  AcidFX.status("КОЛОДА ПЕРЕМЕШАНА");

  return true;
}

function takeRaw() {
  if (!recycleDeck()) {
    return null;
  }

  return deck.pop() || null;
}

function takeMany(amount) {
  const cards = [];

  for (let i = 0; i < amount; i++) {
    const card = takeRaw();

    if (!card) {
      break;
    }

    cards.push(card);
  }

  return cards;
}


/* =========================================================
   RULES
   ========================================================= */

function normalPlayable(card) {
  const top = topCard();

  if (!top) {
    return true;
  }

  if (card.color === "wild") {
    return true;
  }

  return (
    card.color === currentColor ||
    card.value === top.value
  );
}

function canDefendPenalty(card) {
  if (drawPenalty <= 0) {
    return false;
  }

  /*
    Наше правило:

    +2 -> +2 или +4
    +4 -> только +4
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


/* =========================================================
   INTERCEPT

   Перехват = абсолютно такая же карта.
   ========================================================= */

function sameCard(a, b) {
  if (!a || !b) {
    return false;
  }

  return (
    a.color === b.color &&
    a.value === b.value
  );
}

function canIntercept(card) {
  return sameCard(card, topCard());
}


/* =========================================================
   CARD EFFECTS
   ========================================================= */

function applyCardState(card, chosenColor) {
  discard.push(card);

  if (card.color === "wild") {
    currentColor =
      chosenColor || COLORS[random(COLORS.length)];
  } else {
    currentColor = card.color;
  }

  if (card.value === "+2") {
    drawPenalty += 2;

    if (!penaltyType) {
      penaltyType = "+2";
    }
  }

  if (card.value === "+4") {
    drawPenalty += 4;
    penaltyType = "+4";
  }
}


/* =========================================================
   INITIAL GAME
   ========================================================= */

function startGame() {
  deck = [];
  player = [];
  bot = [];
  discard = [];

  turn = "player";
  currentColor = "red";

  drawPenalty = 0;
  penaltyType = null;

  pendingWild = null;

  gameOver = false;
  actionBusy = false;

  createDeck();

  player.push(...takeMany(7));
  bot.push(...takeMany(7));

  /*
    Первая карта только обычная числовая.
  */

  let first = takeRaw();

  while (
    first &&
    (
      first.color === "wild" ||
      ["skip", "reverse", "+2"].includes(first.value)
    )
  ) {
    const position = random(deck.length + 1);

    deck.splice(position, 0, first);

    first = takeRaw();
  }

  if (!first) {
    first = makeCard("red", "0");
  }

  discard.push(first);
  currentColor = first.color;

  $("colorPicker")?.classList.add("hidden");
  $("endScreen")?.classList.add("hidden");

  render();

  AcidFX.status("ТВОЙ ХОД");
  AcidFX.turn("player");
}


/* =========================================================
   RENDER CARD
   ========================================================= */

function cardHTML(card) {
  return `
    <div class="card ${card.color}">
      <div class="value">${cardLabel(card.value)}</div>
    </div>
  `;
}


/* =========================================================
   RENDER
   ========================================================= */

function render() {
  renderDiscard();
  renderBot();
  renderHand();
  renderPenalty();
  renderColor();

  $("deckCount").textContent =
    `${deck.length} КАРТ`;

  $("playerCount").textContent =
    `${player.length} КАРТ`;
}

function renderDiscard() {
  const card = topCard();

  if (!card) {
    $("discard").innerHTML = "";
    return;
  }

  $("discard").innerHTML = cardHTML(card);
}

function renderBot() {
  $("botCount").textContent =
    `${bot.length} КАРТ`;

  const area = $("botCards");

  area.innerHTML = "";

  const visible = Math.min(bot.length, 20);

  for (let i = 0; i < visible; i++) {
    const el = document.createElement("div");

    el.className = "botCard";

    /*
      Небольшой веер бота.
  */

    const normalized =
      visible <= 1
        ? 0
        : (i / (visible - 1)) * 2 - 1;

    el.style.transform =
      `rotate(${normalized * 10}deg)
       translateY(${normalized * normalized * 5}px)`;

    area.appendChild(el);
  }
}


/* =========================================================
   FAN
   ========================================================= */

function getFanLayout(count) {
  const screenWidth =
    Math.max(280, window.innerWidth);

  let scale = 1;

  if (count <= 7) scale = 1;
  else if (count <= 10) scale = .93;
  else if (count <= 14) scale = .84;
  else if (count <= 18) scale = .75;
  else if (count <= 24) scale = .65;
  else if (count <= 32) scale = .56;
  else if (count <= 42) scale = .48;
  else scale = .42;

  const cardWidth = 82 * scale;

  /*
    Центр крайней карты не должен
    выходить за экран.
  */

  const maxHalf =
    screenWidth / 2 -
    cardWidth / 2 -
    7;

  let desiredHalf;

  if (count <= 3) {
    desiredHalf = 75;
  } else if (count <= 5) {
    desiredHalf = 110;
  } else if (count <= 7) {
    desiredHalf = 145;
  } else {
    desiredHalf = screenWidth * .46;
  }

  const halfFan =
    Math.max(
      0,
      Math.min(maxHalf, desiredHalf)
    );

  let angle = Math.min(
    29,
    8 + count * 1.45
  );

  if (count > 18) {
    angle = 25;
  }

  return {
    scale,
    halfFan,
    angle
  };
}

function fanPosition(index, count) {
  if (count <= 1) {
    return {
      x: 0,
      y: -28,
      rot: 0,
      scale: 1
    };
  }

  const layout = getFanLayout(count);

  const t = index / (count - 1);
  const n = t * 2 - 1;

  /*
    x — ширина веера
    y — дуга
    rot — поворот карты
  */

  const x = n * layout.halfFan;

  const curve = n * n;

  const y =
    -40 +
    curve * 47;

  const rot =
    n * layout.angle;

  return {
    x,
    y,
    rot,
    scale: layout.scale
  };
}


/* =========================================================
   PLAYER HAND
   ========================================================= */

function renderHand() {
  const hand = $("hand");

  hand.innerHTML = "";

  player.forEach((card, index) => {
    const el = document.createElement("div");

    el.className =
      `handCard ${card.color}`;

    const playable =
      (
        turn === "player" &&
        canPlay(card)
      ) ||
      (
        turn === "bot" &&
        canIntercept(card)
      );

    if (playable) {
      el.classList.add("playable");
    }

    el.innerHTML = `
      <div class="value">
        ${cardLabel(card.value)}
      </div>
    `;

    const pos =
      fanPosition(index, player.length);

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
      String(index + 1);

    el.dataset.cardId =
      String(card.id);

    el.addEventListener(
      "click",
      () => handlePlayerCard(card.id)
    );

    hand.appendChild(el);
  });
}


/* =========================================================
   UI
   ========================================================= */

function renderPenalty() {
  const el = $("penalty");

  if (drawPenalty <= 0) {
    el.classList.add("hidden");
    return;
  }

  el.textContent =
    `ШТРАФ +${drawPenalty}`;

  el.classList.remove("hidden");
}

function renderColor() {
  const colors = {
    red: "#ff3e54",
    yellow: "#ffd83d",
    green: "#38df73",
    blue: "#3989ff"
  };

  const dot = $("currentColorDot");

  dot.style.background =
    colors[currentColor];

  dot.style.color =
    colors[currentColor];

  const table =
    document.querySelector(".tableInner");

  if (table) {
    table.classList.remove(
      "color-red",
      "color-yellow",
      "color-green",
      "color-blue"
    );

    table.classList.add(
      `color-${currentColor}`
    );
  }
}


/* =========================================================
   FIND PLAYER CARD ELEMENT
   ========================================================= */

function playerCardElement(cardId) {
  return document.querySelector(
    `.handCard[data-card-id="${cardId}"]`
  );
}

function playerIndex(cardId) {
  return player.findIndex(
    card => card.id === cardId
  );
}


/* =========================================================
   PLAYER CLICK
   ========================================================= */

async function handlePlayerCard(cardId) {
  if (unavailable()) {
    return;
  }

  const index = playerIndex(cardId);

  if (index === -1) {
    return;
  }

  const card = player[index];

  /*
    Чужой ход — только Перехват.
  */

  if (turn !== "player") {
    if (!canIntercept(card)) {
      return;
    }

    await beginPlayerIntercept(cardId);

    return;
  }

  if (!canPlay(card)) {
    AcidFX.status(
      drawPenalty > 0
        ? `ШТРАФ +${drawPenalty}: ОТБЕЙ ИЛИ ЗАБЕРИ`
        : "ЭТУ КАРТУ НЕЛЬЗЯ ПОЛОЖИТЬ"
    );

    return;
  }

  /*
    Wild сначала выбираем цвет.
  */

  if (card.color === "wild") {
    pendingWild = {
      cardId,
      intercept: false
    };

    $("colorPicker")
      .classList
      .remove("hidden");

    return;
  }

  await playerPlay(cardId, null, false);
}


/* =========================================================
   PLAYER PLAY
   ========================================================= */

async function playerPlay(
  cardId,
  chosenColor,
  intercept
) {
  if (unavailable()) {
    return;
  }

  const index = playerIndex(cardId);

  if (index === -1) {
    return;
  }

  const card = player[index];

  const source =
    playerCardElement(cardId);

  setBusy(true);

  /*
    1. Сначала видим физический ход.
  */

  await AcidFX.playPlayerCard(
    card,
    source
  );

  /*
    2. Только теперь меняем состояние.
  */

  player.splice(index, 1);

  applyCardState(
    card,
    chosenColor
  );

  render();

  /*
    3. Эффект карты.
  */

  await animateCardEffect(
    card,
    chosenColor
  );

  if (player.length === 0) {
    finish(true);
    return;
  }

  /*
    Skip / Reverse в дуэли:
    игрок ходит снова.
  */

  if (
    card.value === "skip" ||
    card.value === "reverse"
  ) {
    turn = "player";

    AcidFX.status(
      card.value === "skip"
        ? "БОТ ПРОПУСКАЕТ — ТВОЙ ХОД"
        : "РАЗВОРОТ — ТВОЙ ХОД"
    );

    await AcidFX.turn("player");

    setBusy(false);

    render();

    return;
  }

  /*
    Теперь ход бота.
  */

  turn = "bot";

  render();

  AcidFX.status(
    drawPenalty > 0
      ? `БОТ: ШТРАФ +${drawPenalty}`
      : intercept
        ? "ПЕРЕХВАТ — БОТ ОТВЕЧАЕТ"
        : "ХОД БОТА"
  );

  await AcidFX.turn("bot");

  setBusy(false);

  await sleep(280);

  botTurn();
}


/* =========================================================
   CARD EFFECT ANIMATION
   ========================================================= */

async function animateCardEffect(
  card,
  chosenColor
) {
  if (
    card.value === "+2" ||
    card.value === "+4"
  ) {
    await AcidFX.penalty(
      drawPenalty
    );
  }

  if (
    card.value === "skip" ||
    card.value === "reverse"
  ) {
    await AcidFX.special(
      card.value
    );
  }

  if (card.color === "wild") {
    await AcidFX.wild(
      chosenColor || currentColor
    );
  }
}


/* =========================================================
   PLAYER INTERCEPT
   ========================================================= */

async function beginPlayerIntercept(cardId) {
  const index = playerIndex(cardId);

  if (index === -1) {
    return;
  }

  const card = player[index];

  if (!canIntercept(card)) {
    return;
  }

  if (card.color === "wild") {
    pendingWild = {
      cardId,
      intercept: true
    };

    $("colorPicker")
      .classList
      .remove("hidden");

    return;
  }

  setBusy(true);

  await AcidFX.intercept("player");

  setBusy(false);

  turn = "player";

  await playerPlay(
    cardId,
    null,
    true
  );
}


/* =========================================================
   COLOR PICKER
   ========================================================= */

async function chooseColor(color) {
  if (!pendingWild) {
    return;
  }

  const data = pendingWild;

  pendingWild = null;

  $("colorPicker")
    .classList
    .add("hidden");

  if (data.intercept) {
    setBusy(true);

    await AcidFX.intercept("player");

    setBusy(false);

    turn = "player";
  }

  await playerPlay(
    data.cardId,
    color,
    data.intercept
  );
}


/* =========================================================
   PLAYER DRAW
   ========================================================= */

async function playerDraw() {
  if (
    unavailable() ||
    turn !== "player"
  ) {
    return;
  }

  setBusy(true);

  /*
    Если висит штраф —
    забираем весь штраф.
  */

  if (drawPenalty > 0) {
    const amount = drawPenalty;

    const cards =
      takeMany(amount);

    AcidFX.status(
      `ЗАБИРАЕШЬ +${cards.length}`
    );

    await AcidFX.penalty(amount);

    /*
      Карты добавляются визуально
      одна за другой.
  */

    await AcidFX.drawSequence(
      cards,
      "player",
      async card => {
        player.push(card);
        render();
      }
    );

    drawPenalty = 0;
    penaltyType = null;

    render();

    turn = "bot";

    AcidFX.status("ХОД БОТА");

    await AcidFX.turn("bot");

    setBusy(false);

    await sleep(300);

    botTurn();

    return;
  }

  /*
    Добровольный добор:
    если ходить уже можно,
    берём одну карту и ход остаётся наш.
  */

  const alreadyPlayable =
    player.some(normalPlayable);

  if (alreadyPlayable) {
    const card = takeRaw();

    if (card) {
      AcidFX.status("БЕРЁШЬ КАРТУ");

      await AcidFX.drawCard(
        card,
        "player"
      );

      player.push(card);

      render();

      AcidFX.status("ТВОЙ ХОД");
    }

    setBusy(false);

    return;
  }

  /*
    Ходить нечем:
    добираем до первой подходящей.
  */

  AcidFX.status(
    "ИЩЕМ ПОДХОДЯЩУЮ КАРТУ..."
  );

  let amount = 0;
  let found = false;

  while (!found && amount < 150) {
    const card = takeRaw();

    if (!card) {
      break;
    }

    amount++;

    await AcidFX.drawCard(
      card,
      "player"
    );

    player.push(card);

    render();

    if (normalPlayable(card)) {
      found = true;
    }

    await sleep(55);
  }

  AcidFX.status(
    found
      ? amount === 1
        ? "НАШЛАСЬ ПОДХОДЯЩАЯ"
        : `ДОБРАНО ${amount} КАРТ`
      : "КАРТ БОЛЬШЕ НЕТ"
  );

  setBusy(false);
}


/* =========================================================
   BOT HELPERS
   ========================================================= */

function botPlayableIndexes() {
  const result = [];

  bot.forEach((card, index) => {
    if (canPlay(card)) {
      result.push(index);
    }
  });

  return result;
}

function botInterceptIndex() {
  const top = topCard();

  return bot.findIndex(
    card => sameCard(card, top)
  );
}

function bestBotColor(
  excludingIndex = -1
) {
  const counts = {
    red: 0,
    yellow: 0,
    green: 0,
    blue: 0
  };

  bot.forEach((card, index) => {
    if (
      index !== excludingIndex &&
      COLORS.includes(card.color)
    ) {
      counts[card.color]++;
    }
  });

  return COLORS.reduce(
    (best, color) =>
      counts[color] > counts[best]
        ? color
        : best,
    "red"
  );
}

function botChoose(indexes) {
  const priorities = {
    "+4": 8,
    "+2": 7,
    "skip": 6,
    "reverse": 6,
    "wild": 2
  };

  let best = indexes[0];
  let score = -Infinity;

  indexes.forEach(index => {
    const card = bot[index];

    let current =
      priorities[card.value] || 3;

    if (card.color === "wild") {
      current -= 1;
    }

    /*
      При двух-трёх картах бот
      активнее использует спецкарты.
  */

    if (
      bot.length <= 3 &&
      ["+2", "+4", "skip", "reverse"]
        .includes(card.value)
    ) {
      current += 3;
    }

    current += Math.random() * .6;

    if (current > score) {
      score = current;
      best = index;
    }
  });

  return best;
}


/* =========================================================
   BOT TURN
   ========================================================= */

async function botTurn() {
  if (
    gameOver ||
    turn !== "bot" ||
    unavailable()
  ) {
    return;
  }

  setBusy(true);

  AcidFX.status("БОТ ДУМАЕТ...");

  await sleep(
    500 + random(400)
  );

  /*
    Перехват бота.
    Делаем не всегда мгновенно,
    чтобы реакция выглядела человеческой.
  */

  const interceptIndex =
    botInterceptIndex();

  if (
    interceptIndex !== -1 &&
    Math.random() < .82
  ) {
    await AcidFX.intercept("bot");

    await botPlay(
      interceptIndex,
      true
    );

    setBusy(false);

    return;
  }

  /*
    Штраф.
  */

  if (drawPenalty > 0) {
    const defense =
      botPlayableIndexes();

    if (defense.length > 0) {
      const chosen =
        botChoose(defense);

      await botPlay(
        chosen,
        false
      );

      setBusy(false);

      return;
    }

    /*
      Не отбился — получает штраф.
  */

    const amount =
      drawPenalty;

    const cards =
      takeMany(amount);

    AcidFX.status(
      `БОТ ЗАБИРАЕТ +${cards.length}`
    );

    await AcidFX.penalty(amount);

    await AcidFX.drawSequence(
      cards,
      "bot",
      async card => {
        bot.push(card);
        render();
      }
    );

    drawPenalty = 0;
    penaltyType = null;

    render();

    turn = "player";

    AcidFX.status("ТВОЙ ХОД");

    await AcidFX.turn("player");

    setBusy(false);

    return;
  }

  /*
    Обычные доступные карты.
  */

  let playable =
    botPlayableIndexes();

  /*
    Если нет — добор до подходящей.
  */

  if (playable.length === 0) {
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

      if (!card) {
        break;
      }

      await AcidFX.drawCard(
        card,
        "bot"
      );

      bot.push(card);

      render();

      if (normalPlayable(card)) {
        found = bot.length - 1;
      }

      await sleep(55);
    }

    if (found !== -1) {
      playable = [found];
    }
  }

  /*
    Вообще ничего не нашлось.
  */

  if (playable.length === 0) {
    turn = "player";

    AcidFX.status("ТВОЙ ХОД");

    await AcidFX.turn("player");

    setBusy(false);

    return;
  }

  const chosen =
    botChoose(playable);

  await sleep(250);

  await botPlay(
    chosen,
    false
  );

  setBusy(false);
}


/* =========================================================
   BOT PLAY
   ========================================================= */

async function botPlay(
  index,
  intercept
) {
  const card = bot[index];

  if (!card) {
    return;
  }

  let chosenColor = null;

  if (card.color === "wild") {
    chosenColor =
      bestBotColor(index);
  }

  /*
    Сначала показываем карту,
    которая вылетает из руки бота.
  */

  await AcidFX.playBotCard(card);

  /*
    Затем удаляем её из руки.
  */

  bot.splice(index, 1);

  applyCardState(
    card,
    chosenColor
  );

  render();

  await animateCardEffect(
    card,
    chosenColor
  );

  if (bot.length === 0) {
    finish(false);
    return;
  }

  /*
    Skip / Reverse:
    бот получает ещё один ход.
  */

  if (
    card.value === "skip" ||
    card.value === "reverse"
  ) {
    turn = "bot";

    AcidFX.status(
      card.value === "skip"
        ? "ТВОЙ ХОД ПРОПУЩЕН"
        : "РАЗВОРОТ — БОТ ХОДИТ ЕЩЁ"
    );

    await AcidFX.turn("bot");

    await sleep(450);

    /*
      Освобождаем локальную блокировку
      перед новым botTurn.
  */

    setBusy(false);

    botTurn();

    return;
  }

  /*
    Обычная передача хода.
  */

  turn = "player";

  render();

  if (drawPenalty > 0) {
    AcidFX.status(
      `ШТРАФ +${drawPenalty} — ОТБЕЙ ИЛИ ЗАБЕРИ`
    );
  } else if (intercept) {
    AcidFX.status(
      "БОТ ПЕРЕХВАТИЛ — ТВОЙ ХОД"
    );
  } else {
    AcidFX.status("ТВОЙ ХОД");
  }

  await AcidFX.turn("player");
}


/* =========================================================
   END GAME
   ========================================================= */

async function finish(playerWon) {
  gameOver = true;
  actionBusy = false;

  await AcidFX.flash(
    playerWon
      ? "green"
      : "purple"
  );

  $("endText").textContent =
    playerWon
      ? "ТЫ ВЫИГРАЛ"
      : "БОТ ВЫИГРАЛ";

  $("endScreen")
    .classList
    .remove("hidden");
}


/* =========================================================
   EVENTS
   ========================================================= */

$("deck").addEventListener(
  "click",
  playerDraw
);

$("restart").addEventListener(
  "click",
  startGame
);

$("again").addEventListener(
  "click",
  startGame
);

document
  .querySelectorAll(".pick")
  .forEach(button => {
    button.addEventListener(
      "click",
      () => chooseColor(
        button.dataset.color
      )
    );
  });


/* =========================================================
   RESIZE
   ========================================================= */

let resizeTimer = null;

window.addEventListener(
  "resize",
  () => {
    clearTimeout(resizeTimer);

    resizeTimer =
      setTimeout(
        renderHand,
        100
      );
  }
);

window.addEventListener(
  "orientationchange",
  () => {
    setTimeout(
      render,
      250
    );
  }
);


/* =========================================================
   START
   ========================================================= */

startGame();