"use strict";

/* =========================================================
   ACID UNO v7 — GAME ENGINE
   Touch drag / smooth play / mobile first
   ========================================================= */

/*
  Правила игры целиком живут в src/rules.js.
  Здесь остаётся состояние партии и отрисовка.
*/
const COLORS = AcidRules.COLORS;

/*
  The small set of values most often tuned while polishing the UI.
  Keep visual breakpoints in style.css; keep behaviour thresholds here.
*/
const ACID_UI = Object.freeze({
  crowdedHandAt: 14
});

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
   DRAG STATE
   ========================================================= */

let drag = null;

const DRAG_THRESHOLD = 7;


/* =========================================================
   HELPERS
   ========================================================= */

const $ = id =>
  document.getElementById(id);

const sleep = ms =>
  new Promise(resolve =>
    setTimeout(resolve, ms)
  );

function random(max) {
  return Math.floor(
    Math.random() * max
  );
}

function shuffle(array) {
  return AcidRules.shuffle(
    array,
    random
  );
}


/*
  Снимок стола для чистых функций правил.
*/
function tableView() {
  return {
    top: topCard(),
    currentColor,
    drawPenalty,
    penaltyType
  };
}

function topCard() {
  return (
    discard[
      discard.length - 1
    ] || null
  );
}

function makeCard(
  color,
  value
) {
  return {
    id: nextCardId++,
    color,
    value
  };
}

function cardLabel(value) {
  switch (value) {
    case "skip":
      return "⊘";

    case "reverse":
      return "↻";

    case "wild":
      return "★";

    default:
      return value;
  }
}

function setBusy(value) {
  actionBusy = value;

  $("game")
    ?.classList
    .toggle(
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

  nextCardId = 1;

  deck =
    AcidRules.createDeck(
      makeCard
    );

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

  const top =
    discard.pop();

  deck =
    discard.slice();

  discard = [top];

  shuffle(deck);

  AcidFX.status(
    "КОЛОДА ПЕРЕМЕШАНА"
  );

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

  for (
    let i = 0;
    i < amount;
    i++
  ) {
    const card =
      takeRaw();

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
  return AcidRules.normalPlayable(
    card,
    tableView()
  );
}

function canDefendPenalty(card) {
  return AcidRules.canDefendPenalty(
    card,
    tableView()
  );
}

function canPlay(card) {
  return AcidRules.canPlay(
    card,
    tableView()
  );
}


/* =========================================================
   INTERCEPT
   ========================================================= */

function sameCard(a, b) {
  return AcidRules.sameCard(a, b);
}

function canIntercept(card) {
  return AcidRules.canIntercept(
    card,
    topCard()
  );
}


/* =========================================================
   APPLY CARD
   ========================================================= */

function applyCardState(
  card,
  chosenColor
) {
  discard.push(card);

  const next =
    AcidRules.applyCard(
      tableView(),
      card,

      chosenColor ||
      COLORS[
        random(COLORS.length)
      ]
    );

  currentColor =
    next.currentColor;

  drawPenalty =
    next.drawPenalty;

  penaltyType =
    next.penaltyType;
}


/* =========================================================
   START
   ========================================================= */

function startGame() {

  cancelDrag(true);

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

  player.push(
    ...takeMany(7)
  );

  bot.push(
    ...takeMany(7)
  );


  /*
    Стартуем с обычной
    числовой карты.
  */

  let first =
    takeRaw();

  while (
    first &&
    (
      first.color === "wild" ||
      [
        "skip",
        "reverse",
        "+2"
      ].includes(
        first.value
      )
    )
  ) {
    const position =
      random(
        deck.length + 1
      );

    deck.splice(
      position,
      0,
      first
    );

    first =
      takeRaw();
  }

  if (!first) {
    first =
      makeCard(
        "red",
        "0"
      );
  }

  discard.push(first);

  currentColor =
    first.color;

  $("colorPicker")
    ?.classList
    .add("hidden");

  $("endScreen")
    ?.classList
    .add("hidden");

  render();

  AcidFX.status(
    "ПЕРЕТАЩИ КАРТУ В ЦЕНТР"
  );

  AcidFX.turn(
    "player"
  );
}


/* =========================================================
   CARD HTML
   ========================================================= */

function cardFaceHTML(card) {
  const label = cardLabel(card.value);

  return `
    <span class="cardCorner cardCornerTop" aria-hidden="true">${label}</span>
    <div class="value">${label}</div>
    <span class="cardCorner cardCornerBottom" aria-hidden="true">${label}</span>
  `;
}

function cardHTML(card) {
  return `
    <div class="card ${card.color}">
      ${cardFaceHTML(card)}
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
  const card =
    topCard();

  if (!card) {
    $("discard").innerHTML =
      "";

    return;
  }

  $("discard").innerHTML =
    cardHTML(card);
}

function renderBot() {
  $("botCount").textContent =
    `${bot.length} КАРТ`;

  const area =
    $("botCards");

  area.innerHTML = "";

  const visible =
    Math.min(
      bot.length,
      20
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
      "botCard";

    const normalized =
      visible <= 1
        ? 0
        : (
            i /
            (visible - 1)
          ) * 2 - 1;

    el.style.transform = `
      rotate(
        ${normalized * 10}deg
      )
      translateY(
        ${
          normalized *
          normalized *
          5
        }px
      )
    `;

    area.appendChild(el);
  }
}


/* =========================================================
   FAN
   ========================================================= */

function getFanLayout(count) {

  const screenWidth =
    Math.max(
      280,
      window.innerWidth
    );

  const desktop =
    screenWidth >= 900 &&
    window.innerHeight >= 620;

  const phoneLandscape =
    window.innerWidth > window.innerHeight &&
    window.innerHeight <= 600;

  let scale = desktop ? 1.08 : 1;

  if (count <= 7) {
    scale = desktop ? 1.08 : 1;
  } else if (count <= 10) {
    scale = desktop ? 1 : .93;
  } else if (count <= 14) {
    scale = desktop ? .91 : .84;
  } else if (count <= 18) {
    scale = desktop ? .82 : .75;
  } else if (count <= 24) {
    scale = desktop ? .72 : .65;
  } else if (count <= 32) {
    scale = desktop ? .63 : .56;
  } else if (count <= 42) {
    scale = desktop ? .54 : .48;
  } else {
    scale = desktop ? .47 : .42;
  }

  if (phoneLandscape) {
    scale *= .78;
  }

  const rootStyle =
    getComputedStyle(document.documentElement);

  const baseCardWidth =
    parseFloat(rootStyle.getPropertyValue("--card-w")) || 84;

  const baseCardHeight =
    parseFloat(rootStyle.getPropertyValue("--card-h")) || 126;

  const cardWidth =
    baseCardWidth * scale;

  const cardHeight =
    baseCardHeight * scale;

  let angle =
    Math.min(
      29,
      8 + count * 1.45
    );

  if (count > 18) {
    angle = 25;
  }

  /*
    Крайние карты веера повёрнуты на ±angle,
    поэтому в экран должен помещаться габарит
    ПОВЁРНУТОЙ карты, а не cardWidth / 2.

    Точка вращения задана в v9.1.css:
    #hand .handCard { transform-origin: 50% 100% },
    то есть низ карты по центру. Значит наружу
    карта выступает на

      (cardWidth / 2) * cos(angle) +
      cardHeight * sin(angle)

    (высота берётся целиком, а не пополам, —
    пивот на нижней кромке, а не в центре).
  */

  const angleRad =
    angle * Math.PI / 180;

  const rotatedHalfWidth =
    cardWidth / 2 * Math.cos(angleRad) +
    cardHeight * Math.sin(angleRad);

  const maxHalf =
    screenWidth / 2 -
    rotatedHalfWidth -
    7;

  let desiredHalf;

  if (count <= 3) {
    desiredHalf = desktop ? 110 : 75;
  } else if (count <= 5) {
    desiredHalf = desktop ? 175 : 110;
  } else if (count <= 7) {
    desiredHalf = desktop ? 245 : 145;
  } else if (count <= 10 && desktop) {
    desiredHalf = Math.min(
      screenWidth * .29,
      520
    );
  } else if (count <= 14 && desktop) {
    desiredHalf = Math.min(
      screenWidth * .33,
      590
    );
  } else {
    desiredHalf =
      desktop
        ? Math.min(
            screenWidth * .4,
            720
          )
        : screenWidth * .46;
  }

  if (phoneLandscape) {
    desiredHalf =
      screenWidth * .31;
  }

  const halfFan =
    Math.max(
      0,
      Math.min(
        maxHalf,
        desiredHalf
      )
    );

  return {
    scale,
    halfFan,
    angle
  };
}

function fanPosition(
  index,
  count
) {
  const phoneLandscape =
    window.innerWidth > window.innerHeight &&
    window.innerHeight <= 600;

  if (count <= 1) {
    return {
      x: 0,
      y: -28,
      rot: 0,
      scale: 1
    };
  }

  const layout =
    getFanLayout(count);

  const t =
    index /
    (count - 1);

  const n =
    t * 2 - 1;

  const x =
    n *
    layout.halfFan;

  const curve =
    n * n;

  const y =
    phoneLandscape
      ? -12 + curve * 24
      : -40 + curve * 47;

  const rot =
    n *
    layout.angle;

  return {
    x,
    y,
    rot,
    scale:
      layout.scale
  };
}


/* =========================================================
   HAND
   ========================================================= */

function renderHand() {

  /*
    Во время drag DOM руки
    не перестраиваем.
  */

  if (drag) {
    return;
  }

  const hand =
    $("hand");

  hand.classList.toggle(
    "is-crowded",
    player.length >= ACID_UI.crowdedHandAt
  );

  hand.innerHTML = "";

  player.forEach(
    (card, index) => {

      const el =
        document.createElement(
          "div"
        );

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
        el.classList.add(
          "playable"
        );
      }

      el.innerHTML =
        cardFaceHTML(card);

      const pos =
        fanPosition(
          index,
          player.length
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
        String(index + 1);

      el.dataset.cardId =
        String(card.id);

      /*
        POINTER EVENTS работают
        и с пальцем, и с мышью.
      */

      el.addEventListener(
        "pointerdown",
        event =>
          beginDrag(
            event,
            card.id
          )
      );

      hand.appendChild(el);
    }
  );
}


/* =========================================================
   UI
   ========================================================= */

function renderPenalty() {
  const el =
    $("penalty");

  if (drawPenalty <= 0) {
    el.classList.add(
      "hidden"
    );

    return;
  }

  el.textContent =
    `ШТРАФ +${drawPenalty}`;

  el.classList.remove(
    "hidden"
  );
}

function renderColor() {

  const colors = {
    red: "#ff3158",
    yellow: "#ffe83d",
    green: "#48ff77",
    blue: "#32a8ff"
  };

  const dot =
    $("currentColorDot");

  dot.style.background =
    colors[currentColor];

  dot.style.color =
    colors[currentColor];

  const table =
    document.querySelector(
      ".tableInner"
    );

  if (!table) {
    return;
  }

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


/* =========================================================
   PLAYER CARD HELPERS
   ========================================================= */

function playerCardElement(
  cardId
) {
  return document.querySelector(
    `.handCard[data-card-id="${cardId}"]`
  );
}

function playerIndex(cardId) {
  return player.findIndex(
    card =>
      card.id === cardId
  );
}


/* =========================================================
   DROP GEOMETRY
   ========================================================= */

function pointInsideRect(
  x,
  y,
  rect
) {
  return (
    x >= rect.left &&
    x <= rect.right &&
    y >= rect.top &&
    y <= rect.bottom
  );
}

function cardCenterInsideDropZone(
  rect
) {
  const center =
    $("center")
      ?.getBoundingClientRect();

  if (!center) {
    return false;
  }

  const x =
    rect.left +
    rect.width / 2;

  const y =
    rect.top +
    rect.height / 2;

  /*
    Чуть расширяем реальную
    область попадания.

    На телефоне не нужно
    пиксель-перфект попадание.
  */

  const padding = 18;

  const hitRect = {
    left:
      center.left -
      padding,

    right:
      center.right +
      padding,

    top:
      center.top -
      padding,

    bottom:
      center.bottom +
      padding
  };

  return pointInsideRect(
    x,
    y,
    hitRect
  );
}


/* =========================================================
   DRAG START
   ========================================================= */

function beginDrag(
  event,
  cardId
) {
  if (
    unavailable() ||
    drag
  ) {
    return;
  }

  const index =
    playerIndex(cardId);

  if (index === -1) {
    return;
  }

  const card =
    player[index];

  /*
    В свой ход можно тащить
    любую карту.

    Если она не подходит —
    центр покажет красный цвет
    и карта вернётся.

    В чужой ход разрешаем
    трогать только карту,
    способную сделать Перехват.
  */

  if (
    turn !== "player" &&
    !canIntercept(card)
  ) {
    return;
  }

  const element =
    playerCardElement(
      cardId
    );

  if (!element) {
    return;
  }

  event.preventDefault();

  try {
    element.setPointerCapture(
      event.pointerId
    );
  } catch (_) {}


  const rect =
    element
      .getBoundingClientRect();

  drag = {
    pointerId:
      event.pointerId,

    cardId,

    card,

    element,

    index,

    startX:
      event.clientX,

    startY:
      event.clientY,

    x:
      event.clientX,

    y:
      event.clientY,

    originalRect: {
      left:
        rect.left,

      top:
        rect.top,

      width:
        rect.width,

      height:
        rect.height
    },

    offsetX:
      event.clientX -
      rect.left,

    offsetY:
      event.clientY -
      rect.top,

    started:
      false,

    inside:
      false,

    valid:
      false
  };


  window.addEventListener(
    "pointermove",
    onDragMove,
    {
      passive: false
    }
  );

  window.addEventListener(
    "pointerup",
    endDrag,
    {
      passive: false
    }
  );

  window.addEventListener(
    "pointercancel",
    endDrag,
    {
      passive: false
    }
  );
}


/* =========================================================
   ACTIVATE DRAG
   ========================================================= */

function activateDrag() {
  if (
    !drag ||
    drag.started
  ) {
    return;
  }

  drag.started = true;

  const el =
    drag.element;

  /*
    Фиксируем реальный размер
    карты перед переводом
    в position: fixed.
  */

  el.style.width =
    `${drag.originalRect.width}px`;

  el.style.height =
    `${drag.originalRect.height}px`;

  el.classList.add(
    "dragging"
  );

  /*
    Карта слегка выше пальца,
    чтобы палец не закрывал её.
  */

  updateDraggedCard(
    drag.x,
    drag.y
  );

  AcidFX.dragZone(
    true,
    false,
    true
  );
}


/* =========================================================
   MOVE DRAGGED CARD
   ========================================================= */

function updateDraggedCard(
  clientX,
  clientY
) {
  if (!drag) {
    return;
  }

  const el =
    drag.element;

  /*
    Не держим карту ровно
    под центром пальца.

    Сохраняем точку,
    за которую её взяли,
    но поднимаем вверх.
  */

  const fingerLift = 34;

  const left =
    clientX -
    drag.offsetX;

  const top =
    clientY -
    drag.offsetY -
    fingerLift;

  /*
    Небольшой естественный
    наклон в зависимости
    от горизонтального движения.
  */

  const dx =
    clientX -
    drag.x;

  const rotation =
    Math.max(
      -8,
      Math.min(
        8,
        dx * .45
      )
    );

  drag.x =
    clientX;

  drag.y =
    clientY;

  el.style.transform = `
    translate3d(
      ${left}px,
      ${top}px,
      0
    )
    rotate(${rotation}deg)
    scale(1.06)
  `;


  const rect = {
    left,
    top,

    right:
      left +
      drag.originalRect.width,

    bottom:
      top +
      drag.originalRect.height,

    width:
      drag.originalRect.width,

    height:
      drag.originalRect.height
  };

  const inside =
    cardCenterInsideDropZone(
      rect
    );

  let valid = false;

  if (turn === "player") {
    valid =
      canPlay(
        drag.card
      );
  } else {
    valid =
      canIntercept(
        drag.card
      );
  }

  drag.inside =
    inside;

  drag.valid =
    valid;

  el.classList.toggle(
    "drag-valid",
    inside && valid
  );

  el.classList.toggle(
    "drag-invalid",
    inside && !valid
  );

  AcidFX.dragZone(
    true,
    inside,
    valid
  );
}


/* =========================================================
   POINTER MOVE
   ========================================================= */

function onDragMove(event) {
  if (
    !drag ||
    event.pointerId !==
      drag.pointerId
  ) {
    return;
  }

  event.preventDefault();

  const distance =
    Math.hypot(
      event.clientX -
        drag.startX,

      event.clientY -
        drag.startY
    );

  if (
    !drag.started &&
    distance >=
      DRAG_THRESHOLD
  ) {
    activateDrag();
  }

  if (!drag.started) {
    return;
  }

  updateDraggedCard(
    event.clientX,
    event.clientY
  );
}


/* =========================================================
   END DRAG
   ========================================================= */

async function endDrag(event) {
  if (
    !drag ||
    event.pointerId !==
      drag.pointerId
  ) {
    return;
  }

  event.preventDefault();

  const state = drag;

  removeDragListeners();


  /*
    Если человек просто
    коснулся карты и отпустил —
    ничего не играем.

    В v7 ход делается именно
    перетаскиванием.
  */

  if (!state.started) {
    drag = null;

    AcidFX.dragZone(
      false
    );

    return;
  }


  /*
    Последняя позиция карты
    непосредственно перед
    отпусканием.
  */

  const currentRect =
    state.element
      .getBoundingClientRect();

  const releasedRect = {
    left:
      currentRect.left,

    top:
      currentRect.top,

    width:
      currentRect.width,

    height:
      currentRect.height
  };


  /*
    Успешный drop.
  */

  if (
    state.inside &&
    state.valid
  ) {
    drag = null;

    AcidFX.dragZone(
      false
    );

    /*
      Оригинальная карта
      исчезает.

      AcidFX создаст flyingCard
      ровно на этом месте.
    */

    state.element.style.opacity =
      "0";

    state.element.classList.remove(
      "dragging",
      "drag-valid",
      "drag-invalid"
    );

    await commitDraggedCard(
      state.cardId,
      releasedRect
    );

    return;
  }


  /*
    Карта отпущена вне центра
    или туда её класть нельзя.
  */

  await returnDraggedCard(
    state
  );
}


/* =========================================================
   REMOVE POINTER LISTENERS
   ========================================================= */

function removeDragListeners() {
  window.removeEventListener(
    "pointermove",
    onDragMove
  );

  window.removeEventListener(
    "pointerup",
    endDrag
  );

  window.removeEventListener(
    "pointercancel",
    endDrag
  );
}


/* =========================================================
   RETURN CARD TO FAN
   ========================================================= */

async function returnDraggedCard(
  state
) {
  if (!state) {
    return;
  }

  AcidFX.dragZone(
    false
  );

  const el =
    state.element;

  const invalid =
    state.inside &&
    !state.valid;

  el.classList.remove(
    "drag-valid",
    "drag-invalid"
  );

  el.classList.add(
    "returning"
  );


  /*
    Пока карта fixed,
    возвращаем её в исходную
    экранную позицию.
  */

  const current =
    el.getBoundingClientRect();

  const x =
    state.originalRect.left -
    current.left;

  const y =
    state.originalRect.top -
    current.top;

  el.style.transform = `
    translate3d(
      ${x}px,
      ${y}px,
      0
    )
    rotate(0deg)
    scale(1)
  `;

  if (invalid) {
    AcidFX.status(
      drawPenalty > 0
        ? `ШТРАФ +${drawPenalty}: ОТБЕЙ ИЛИ ЗАБЕРИ`
        : "ЭТА КАРТА НЕ ПОДХОДИТ"
    );
  }

  await sleep(560);

  el.classList.remove(
    "dragging",
    "returning"
  );

  if (invalid) {
    el.classList.add(
      "invalid-return"
    );
  }

  /*
    Самый надёжный способ
    вернуть веер:
    перестроить его уже после
    окончания fixed-анимации.
  */

  drag = null;

  renderHand();

  if (invalid) {
    await sleep(150);
  }
}


/* =========================================================
   CANCEL DRAG
   ========================================================= */

function cancelDrag(
  immediate = false
) {
  if (!drag) {
    return;
  }

  removeDragListeners();

  AcidFX.dragZone(
    false
  );

  const el =
    drag.element;

  drag = null;

  if (immediate) {
    renderHand();

    return;
  }

  if (el) {
    el.classList.remove(
      "dragging",
      "drag-valid",
      "drag-invalid"
    );
  }

  renderHand();
}


/* =========================================================
   COMMIT DRAGGED CARD
   ========================================================= */

async function commitDraggedCard(
  cardId,
  releasedRect
) {
  if (unavailable()) {
    renderHand();
    return;
  }

  const index =
    playerIndex(
      cardId
    );

  if (index === -1) {
    renderHand();
    return;
  }

  const card =
    player[index];


  /*
    Перехват во время хода бота.
  */

  const intercept =
    turn !== "player";


  /*
    Wild должен выбрать цвет.

    Карту пока возвращаем
    визуально в руку,
    потому что overlay должен
    появиться до окончательного хода.
  */

  if (
    card.color === "wild"
  ) {
    pendingWild = {
      cardId,
      intercept,
      releasedRect
    };

    renderHand();

    $("colorPicker")
      .classList
      .remove("hidden");

    return;
  }


  if (intercept) {
    setBusy(true);

    await AcidFX.intercept(
      "player"
    );

    turn = "player";

    setBusy(false);
  }

  await playerPlay(
    cardId,
    null,
    intercept,
    releasedRect
  );
}


/* =========================================================
   PLAYER PLAY
   ========================================================= */

async function playerPlay(
  cardId,
  chosenColor,
  intercept,
  releasedRect = null
) {
  if (unavailable()) {
    return;
  }

  const index =
    playerIndex(cardId);

  if (index === -1) {
    return;
  }

  const card =
    player[index];

  setBusy(true);


  /*
    Сначала движение карты.

    Если она была перетащена,
    продолжаем движение именно
    из точки отпускания.
  */

  if (releasedRect) {
    await AcidFX.finishPlayerDrop(
      card,
      releasedRect
    );
  } else {
    const source =
      playerCardElement(
        cardId
      );

    await AcidFX.playPlayerCard(
      card,
      source
    );
  }


  /*
    Теперь меняем игру.
  */

  const freshIndex =
    playerIndex(cardId);

  if (freshIndex === -1) {
    setBusy(false);
    return;
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

  await animateCardEffect(
    card,
    chosenColor
  );


  if (
    player.length === 0
  ) {
    finish(true);

    return;
  }


  /*
    Skip / Reverse:
    в игре 1 на 1
    игрок ходит ещё раз.
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

    await AcidFX.turn(
      "player"
    );

    setBusy(false);

    render();

    return;
  }


  turn = "bot";

  render();

  AcidFX.status(
    drawPenalty > 0
      ? `БОТ: ШТРАФ +${drawPenalty}`
      : intercept
        ? "ПЕРЕХВАТ — БОТ ОТВЕЧАЕТ"
        : "ХОД БОТА"
  );

  await AcidFX.turn(
    "bot"
  );

  setBusy(false);

  /*
    Даём глазу закончить
    предыдущий ход.
  */

  await sleep(520);

  botTurn();
}


/* =========================================================
   EFFECT
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

  if (
    card.color === "wild"
  ) {
    await AcidFX.wild(
      chosenColor ||
      currentColor
    );
  }
}


/* =========================================================
   COLOR PICKER
   ========================================================= */

async function chooseColor(
  color
) {
  if (!pendingWild) {
    return;
  }

  const data =
    pendingWild;

  pendingWild = null;

  $("colorPicker")
    .classList
    .add("hidden");


  if (data.intercept) {
    setBusy(true);

    await AcidFX.intercept(
      "player"
    );

    turn = "player";

    setBusy(false);
  }


  await playerPlay(
    data.cardId,
    color,
    data.intercept,
    data.releasedRect
  );
}


/* =========================================================
   PLAYER DRAW
   ========================================================= */

async function playerDraw() {

  if (
    unavailable() ||
    turn !== "player" ||
    drag
  ) {
    return;
  }

  setBusy(true);


  /*
    Штраф.
  */

  if (drawPenalty > 0) {

    const amount =
      drawPenalty;

    const cards =
      takeMany(amount);

    AcidFX.status(
      `ЗАБИРАЕШЬ +${cards.length}`
    );

    await AcidFX.penalty(
      amount
    );

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

    AcidFX.status(
      "ХОД БОТА"
    );

    await AcidFX.turn(
      "bot"
    );

    setBusy(false);

    await sleep(520);

    botTurn();

    return;
  }


  /*
    Добровольный добор.

    Если уже есть допустимая карта,
    можно взять одну и продолжить ход.
  */

  const alreadyPlayable =
    player.some(
      normalPlayable
    );

  if (alreadyPlayable) {

    const card =
      takeRaw();

    if (card) {

      AcidFX.status(
        "БЕРЁШЬ КАРТУ"
      );

      await AcidFX.drawCard(
        card,
        "player"
      );

      player.push(card);

      render();

      await sleep(220);

      AcidFX.status(
        "ТВОЙ ХОД"
      );
    }

    setBusy(false);

    return;
  }


  /*
    Ходить нечем:
    берём до первой подходящей.
  */

  AcidFX.status(
    "ИЩЕМ ПОДХОДЯЩУЮ..."
  );

  let amount = 0;
  let found = false;

  while (
    !found &&
    amount < 150
  ) {
    const card =
      takeRaw();

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

    if (
      normalPlayable(card)
    ) {
      found = true;
    }

    await sleep(125);
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
  return AcidRules.playableIndexes(
    bot,
    tableView()
  );
}

function botInterceptIndex() {
  return AcidRules.interceptIndex(
    bot,
    topCard()
  );
}

function bestBotColor(
  excludingIndex = -1
) {
  return AcidRules.bestColor(
    bot,
    excludingIndex
  );
}

function botChoose(indexes) {
  return AcidRules.chooseCard(
    bot,
    indexes
  );
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

  AcidFX.status(
    "БОТ ДУМАЕТ..."
  );

  /*
    Намеренная пауза.
  */

  await sleep(
    820 +
    random(550)
  );


  /*
    BOT INTERCEPT
  */

  const interceptIndex =
    botInterceptIndex();

  if (
    interceptIndex !== -1 &&
    Math.random() < .82
  ) {
    await AcidFX.intercept(
      "bot"
    );

    await sleep(260);

    await botPlay(
      interceptIndex,
      true
    );

    setBusy(false);

    return;
  }


  /*
    PENALTY
  */

  if (drawPenalty > 0) {

    const defense =
      botPlayableIndexes();

    if (
      defense.length > 0
    ) {
      AcidFX.status(
        "БОТ ОТБИВАЕТСЯ..."
      );

      await sleep(520);

      const chosen =
        botChoose(
          defense
        );

      await botPlay(
        chosen,
        false
      );

      setBusy(false);

      return;
    }


    const amount =
      drawPenalty;

    const cards =
      takeMany(amount);

    AcidFX.status(
      `БОТ ЗАБИРАЕТ +${cards.length}`
    );

    await AcidFX.penalty(
      amount
    );

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

    await sleep(350);

    turn = "player";

    AcidFX.status(
      "ТВОЙ ХОД"
    );

    await AcidFX.turn(
      "player"
    );

    setBusy(false);

    return;
  }


  /*
    NORMAL PLAY
  */

  let playable =
    botPlayableIndexes();


  /*
    DRAW UNTIL PLAYABLE
  */

  if (
    playable.length === 0
  ) {

    AcidFX.status(
      "БОТ ДОБИРАЕТ..."
    );

    await sleep(420);

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

      if (
        normalPlayable(card)
      ) {
        found =
          bot.length - 1;
      }

      await sleep(160);
    }

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

    turn = "player";

    AcidFX.status(
      "ТВОЙ ХОД"
    );

    await AcidFX.turn(
      "player"
    );

    setBusy(false);

    return;
  }


  AcidFX.status(
    "БОТ ВЫБИРАЕТ КАРТУ..."
  );

  await sleep(520);

  const chosen =
    botChoose(
      playable
    );

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
  const card =
    bot[index];

  if (!card) {
    return;
  }

  let chosenColor =
    null;

  if (
    card.color === "wild"
  ) {
    chosenColor =
      bestBotColor(index);
  }


  AcidFX.status(
    intercept
      ? "БОТ ПЕРЕХВАТЫВАЕТ"
      : "БОТ ХОДИТ"
  );

  await sleep(320);


  /*
    Сначала видим движение.
  */

  await AcidFX.playBotCard(
    card
  );


  /*
    Только после приземления
    меняем игровое состояние.
  */

  bot.splice(
    index,
    1
  );

  applyCardState(
    card,
    chosenColor
  );

  render();

  await animateCardEffect(
    card,
    chosenColor
  );


  if (
    bot.length === 0
  ) {
    finish(false);
    return;
  }


  /*
    SKIP / REVERSE
  */

  if (
    card.value === "skip" ||
    card.value === "reverse"
  ) {

    turn = "bot";

    AcidFX.status(
      card.value === "skip"
        ? "ТВОЙ ХОД ПРОПУЩЕН"
        : "БОТ ХОДИТ ЕЩЁ"
    );

    await AcidFX.turn(
      "bot"
    );

    await sleep(720);

    setBusy(false);

    botTurn();

    return;
  }


  turn = "player";

  render();

  if (
    drawPenalty > 0
  ) {
    AcidFX.status(
      `ШТРАФ +${drawPenalty} — ОТБЕЙ ИЛИ ЗАБЕРИ`
    );
  } else if (intercept) {
    AcidFX.status(
      "БОТ ПЕРЕХВАТИЛ — ТВОЙ ХОД"
    );
  } else {
    AcidFX.status(
      "ТВОЙ ХОД"
    );
  }

  await AcidFX.turn(
    "player"
  );
}


/* =========================================================
   END GAME
   ========================================================= */

async function finish(
  playerWon
) {
  gameOver = true;
  actionBusy = false;

  cancelDrag(true);

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
  .querySelectorAll(
    ".pick"
  )
  .forEach(
    button => {

      button.addEventListener(
        "click",
        () =>
          chooseColor(
            button.dataset.color
          )
      );
    }
  );


/* =========================================================
   PREVENT iOS GESTURES
   ========================================================= */

document.addEventListener(
  "touchmove",
  event => {

    if (drag) {
      event.preventDefault();
    }
  },
  {
    passive: false
  }
);


/* =========================================================
   RESIZE
   ========================================================= */

let resizeTimer =
  null;

window.addEventListener(
  "resize",
  () => {

    if (drag) {
      cancelDrag(true);
    }

    clearTimeout(
      resizeTimer
    );

    resizeTimer =
      setTimeout(
        renderHand,
        120
      );
  }
);

window.addEventListener(
  "orientationchange",
  () => {

    if (drag) {
      cancelDrag(true);
    }

    setTimeout(
      render,
      300
    );
  }
);


/* =========================================================
   START
   ========================================================= */

startGame();
