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
  crowdedHandAt: 14,

  /*
    Доля ширины карты, которая должна остаться видимой,
    чтобы номинал в середине читался. Ниже — включаются
    угловые индексы.
  */
  crowdedOverlap: 0.75
});

let deck = [];
let discard = [];

/*
  Стол — кольцо из 2..7 мест. Место 0 всегда живое.
  seats[i] = { index, kind, hand, uno }
*/
let seats = [];

let tableSize = 2;

let activeSeat = 0;

let direction = 1;

/*
  player и bot — это не копии, а ссылки на руки из seats.
  player всегда указывает на руку места 0, bot — на руку
  того соперника, который ходит прямо сейчас.

  turn остаётся строкой из двух значений: на неё завязана
  вся отрисовка и весь ход партии. "player" — ходит место 0,
  "bot" — ходит любой соперник; кто именно, знает activeSeat.
*/
let player = [];
let bot = [];

let turn = "player";

/*
  Ход, добор и вся анимация живут в v9.1.js. Здесь только
  объявления, чтобы ему было куда присвоить: и game.js,
  и v9.1.js работают в strict mode.
*/
let playerDraw;
let playerPlay;
let botTurn;
let botPlay;
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

/* =========================================================
   МЕСТА
   ========================================================= */

/*
  Имя места. Соперники нумеруются с единицы, чтобы
  «БОТ 3» на экране совпадал с третьим значком сверху.
*/
function seatName(index) {

  if (index === AcidStore.mySeat()) {
    return "ТЫ";
  }

  if (AcidStore.online()) {

    return (
      window.AcidRoom
        ?.state
        .names[index] ||
      `ИГРОК ${index + 1}`
    );
  }

  return seats.length > 2
    ? `БОТ ${index}`
    : "ACID BOT";
}

function seatCount() {
  return seats.length;
}

function humanSeats() {
  return seats.filter(
    seat => seat.kind === "human"
  );
}

function activeSeatObject() {
  return seats[activeSeat] || seats[0];
}


/*
  Передать ход после выложенной карты.
  card = null — ход просто уходит соседу.
*/


function topCard() {
  return (
    discard[
      discard.length - 1
    ] || null
  );
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



/* =========================================================
   DRAW / RECYCLE
   ========================================================= */





/* =========================================================
   RULES
   ========================================================= */



function canPlay(card) {
  return AcidRules.canPlay(
    card,
    tableView()
  );
}


/* =========================================================
   INTERCEPT
   ========================================================= */


function canIntercept(card) {
  return AcidRules.canIntercept(
    card,
    topCard()
  );
}


/* =========================================================
   APPLY CARD
   ========================================================= */



/* =========================================================
   START
   ========================================================= */

function startGame() {

  cancelDrag(true);

  /*
    Раздача целиком в редьюсере: колода, тасовка и первая
    карта на столе живут в src/match.js.
  */
  AcidStore.reset({
    seats: tableSize,
    humans: 1
  });

  pendingWild = null;

  actionBusy = false;

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

/*
  Подпись под номиналом. В классической колоде она скрыта,
  в кислотной это половина лица карты: спецкарты там зовутся
  своими именами, а не «пропуск» и «разворот».
*/
function cardWord(value) {
  switch (value) {
    case "skip":
      return "BLOCK";

    case "reverse":
      return "REVOLT";

    case "wild":
      return "ACID WILD";

    case "+2":
      return "ДОЗА";

    case "+4":
      return "ВЫБРОС";

    default:
      return "ACID UNO";
  }
}

function cardFaceHTML(card) {
  const label = cardLabel(card.value);

  return `
    <span class="cardCorner cardCornerTop" aria-hidden="true">${label}</span>
    <div class="value">${label}</div>
    <span class="cardWord" aria-hidden="true">${cardWord(card.value)}</span>
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

  /*
    Углы включаются не по числу карт, а по тому, видно ли
    вообще номинал. Порог в 14 карт был снят с десктопа: на
    телефоне середина карты закрыта соседкой уже на шести,
    и рука превращалась в цветные полоски без чисел.
  */
  const crowding =
    getFanLayout(player.length);

  const visibleStep =
    player.length > 1
      ? crowding.halfFan * 2 / (player.length - 1)
      : Infinity;

  const crowdedCardWidth =
    (parseFloat(
      getComputedStyle(document.documentElement)
        .getPropertyValue("--card-w")
    ) || 84) * crowding.scale;

  hand.classList.toggle(
    "is-crowded",
    player.length >= ACID_UI.crowdedHandAt ||
    visibleStep < crowdedCardWidth * ACID_UI.crowdedOverlap
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
        Слушатели вешает bindV91Hand() в v9.1.js.
      */

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

  /*
    Цвет берётся из токена, а не из копии значения: палитра
    живёт в одном месте, иначе перекраска забывает точку.
  */
  const shade =
    getComputedStyle(document.documentElement)
      .getPropertyValue(`--${currentColor}`)
      .trim();

  const dot =
    $("currentColorDot");

  dot.style.background = shade;

  dot.style.color = shade;

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




/* =========================================================
   DRAG START
   ========================================================= */



/* =========================================================
   ACTIVATE DRAG
   ========================================================= */



/* =========================================================
   MOVE DRAGGED CARD
   ========================================================= */



/* =========================================================
   POINTER MOVE
   ========================================================= */



/* =========================================================
   END DRAG
   ========================================================= */



/* =========================================================
   REMOVE POINTER LISTENERS
   ========================================================= */



/* =========================================================
   RETURN CARD TO FAN
   ========================================================= */



/* =========================================================
   CANCEL DRAG
   ========================================================= */

function cancelDrag(
  immediate = false
) {
  if (!drag) {
    return;
  }

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



/* =========================================================
   PLAYER PLAY
   ========================================================= */



/* =========================================================
   EFFECT
   ========================================================= */



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



/* =========================================================
   BOT PLAY
   ========================================================= */



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
      : `${seatName(activeSeat)} ВЫИГРАЛ`;

  $("endScreen")
    .classList
    .remove("hidden");
}


/* =========================================================
   EVENTS
   ========================================================= */

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
