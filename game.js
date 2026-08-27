var COLORS = [
  "red",
  "yellow",
  "green",
  "blue"
];

var deck = [];
var player = [];
var bot = [];
var discard = [];

var turn = "player";
var currentColor = null;
var pendingWild = null;
var gameOver = false;


/* HELPERS */

function $(id) {
  return document.getElementById(id);
}

function random(max) {
  return Math.floor(Math.random() * max);
}

function shuffle(array) {

  for (
    var i = array.length - 1;
    i > 0;
    i--
  ) {

    var j =
      random(i + 1);

    var temp =
      array[i];

    array[i] =
      array[j];

    array[j] =
      temp;
  }

  return array;
}


/* DECK */

function makeDeck() {

  deck = [];

  for (
    var c = 0;
    c < COLORS.length;
    c++
  ) {

    var color =
      COLORS[c];

    deck.push({
      color: color,
      value: "0"
    });


    for (
      var n = 1;
      n <= 9;
      n++
    ) {

      deck.push({
        color: color,
        value: String(n)
      });

      deck.push({
        color: color,
        value: String(n)
      });

    }


    for (
      var x = 0;
      x < 2;
      x++
    ) {

      deck.push({
        color: color,
        value: "skip"
      });

      deck.push({
        color: color,
        value: "+2"
      });

    }

  }


  for (
    var w = 0;
    w < 4;
    w++
  ) {

    deck.push({
      color: "wild",
      value: "wild"
    });

  }


  shuffle(deck);
}


/* RECYCLE */

function recycle() {

  if (
    deck.length > 0
  ) {
    return;
  }


  if (
    discard.length <= 1
  ) {
    return;
  }


  var top =
    discard.pop();


  deck =
    discard.slice();


  discard = [
    top
  ];


  shuffle(deck);
}


function drawRaw() {

  recycle();

  return deck.pop();
}


/* START */

function startGame() {

  gameOver = false;

  turn = "player";

  currentColor = null;

  pendingWild = null;

  player = [];

  bot = [];

  discard = [];


  makeDeck();


  for (
    var i = 0;
    i < 7;
    i++
  ) {

    player.push(
      drawRaw()
    );

    bot.push(
      drawRaw()
    );

  }


  var first =
    drawRaw();


  while (
    first.color === "wild"
  ) {

    deck.splice(
      random(
        deck.length + 1
      ),
      0,
      first
    );

    first =
      drawRaw();

  }


  discard.push(
    first
  );


  currentColor =
    first.color;


  $("endScreen")
    .classList
    .add("hidden");


  $("colorPicker")
    .classList
    .add("hidden");


  status(
    "Твой ход"
  );


  render();
}


/* LABEL */

function label(value) {

  if (
    value === "skip"
  ) {
    return "⊘";
  }

  if (
    value === "wild"
  ) {
    return "★";
  }

  return value;
}


/* RULE */

function canPlay(card) {

  var top =
    discard[
      discard.length - 1
    ];


  if (
    card.color === "wild"
  ) {
    return true;
  }


  if (
    card.color === currentColor
  ) {
    return true;
  }


  if (
    card.value === top.value
  ) {
    return true;
  }


  return false;
}


/* CARD HTML */

function cardHTML(card) {

  return (
    '<div class="card ' +
    card.color +
    '">' +

    '<div class="value">' +
    label(card.value) +
    '</div>' +

    '</div>'
  );
}


/* RENDER */

function render() {

  renderDiscard();

  renderHand();

  renderBot();

  $("deckCount").innerHTML =
    deck.length + " карт";
}


function renderDiscard() {

  var card =
    discard[
      discard.length - 1
    ];


  $("discard").innerHTML =
    cardHTML(card);
}


function renderHand() {

  var hand =
    $("hand");


  hand.innerHTML =
    "";


  for (
    var i = 0;
    i < player.length;
    i++
  ) {

    var card =
      player[i];


    var el =
      document.createElement(
        "div"
      );


    el.className =
      "handCard " +
      card.color;


    if (
      turn === "player" &&
      canPlay(card)
    ) {

      el.className +=
        " playable";
    }


    el.innerHTML =
      '<div class="value">' +
      label(card.value) +
      '</div>';


    el.setAttribute(
      "data-index",
      i
    );


    el.onclick =
      function() {

        var index =
          parseInt(
            this.getAttribute(
              "data-index"
            ),
            10
          );


        playerPlay(
          index
        );
      };


    hand.appendChild(
      el
    );
  }
}


function renderBot() {

  $("botCount").innerHTML =
    bot.length + " карт";


  var area =
    $("botCards");


  area.innerHTML =
    "";


  var visible =
    bot.length;


  if (
    visible > 14
  ) {
    visible = 14;
  }


  for (
    var i = 0;
    i < visible;
    i++
  ) {

    var el =
      document.createElement(
        "div"
      );


    el.className =
      "botCard";


    area.appendChild(
      el
    );
  }
}


/* STATUS */

function status(text) {

  $("status").innerHTML =
    text;
}


/* PLAYER */

function playerPlay(index) {

  if (
    gameOver ||
    turn !== "player"
  ) {
    return;
  }


  var card =
    player[index];


  if (
    !canPlay(card)
  ) {

    status(
      "Эту карту нельзя положить"
    );

    return;
  }


  if (
    card.color === "wild"
  ) {

    pendingWild =
      index;


    $("colorPicker")
      .classList
      .remove("hidden");


    return;
  }


  finishPlayerCard(
    index,
    null
  );
}


/* COLOR */

function chooseColor(color) {

  if (
    pendingWild === null
  ) {
    return;
  }


  var index =
    pendingWild;


  pendingWild =
    null;


  $("colorPicker")
    .classList
    .add("hidden");


  finishPlayerCard(
    index,
    color
  );
}


/* FINISH PLAYER PLAY */

function finishPlayerCard(
  index,
  wildColor
) {

  var card =
    player.splice(
      index,
      1
    )[0];


  discard.push(
    card
  );


  if (
    card.color === "wild"
  ) {

    currentColor =
      wildColor;

  } else {

    currentColor =
      card.color;
  }


  render();


  if (
    player.length === 0
  ) {

    finish(true);

    return;
  }


  /* +2 */

  if (
    card.value === "+2"
  ) {

    bot.push(
      drawRaw()
    );

    bot.push(
      drawRaw()
    );

    render();
  }


  /* SKIP */

  if (
    card.value === "skip"
  ) {

    turn =
      "player";


    status(
      "Бот пропускает ход — ходи ещё"
    );


    render();

    return;
  }


  turn =
    "bot";


  status(
    "Бот думает..."
  );


  render();


  setTimeout(
    botTurn,
    550
  );
}


/* PLAYER DRAW */

function playerDraw() {

  if (
    gameOver ||
    turn !== "player"
  ) {
    return;
  }


  /*
    Если подходящая карта
    уже есть — всё равно
    разрешаем взять карту.
  */

  var hasPlayable =
    false;


  for (
    var i = 0;
    i < player.length;
    i++
  ) {

    if (
      canPlay(
        player[i]
      )
    ) {

      hasPlayable =
        true;

      break;
    }
  }


  if (
    hasPlayable
  ) {

    player.push(
      drawRaw()
    );


    status(
      "Ты взял карту"
    );


    render();

    return;
  }


  /*
    Если биться нечем —
    берём до тех пор,
    пока не найдём
    подходящую.
  */

  var found =
    false;


  while (
    !found
  ) {

    var card =
      drawRaw();


    player.push(
      card
    );


    if (
      canPlay(card)
    ) {

      found =
        true;
    }
  }


  status(
    "Нашлась подходящая карта"
  );


  render();
}


/* BOT */

function botTurn() {

  if (
    gameOver
  ) {
    return;
  }


  var playable =
    [];


  for (
    var i = 0;
    i < bot.length;
    i++
  ) {

    if (
      canPlay(
        bot[i]
      )
    ) {

      playable.push(i);
    }
  }


  /*
    Боту нечем ходить:
    добирает до подходящей.
  */

  if (
    playable.length === 0
  ) {

    var found =
      -1;


    while (
      found === -1
    ) {

      var card =
        drawRaw();


      bot.push(
        card
      );


      if (
        canPlay(card)
      ) {

        found =
          bot.length - 1;
      }
    }


    playable.push(
      found
    );
  }


  /*
    Бот выбирает
    одну из подходящих.
  */

  var index =
    playable[
      random(
        playable.length
      )
    ];


  var card =
    bot.splice(
      index,
      1
    )[0];


  discard.push(
    card
  );


  if (
    card.color === "wild"
  ) {

    currentColor =
      bestBotColor();

  } else {

    currentColor =
      card.color;
  }


  render();


  if (
    bot.length === 0
  ) {

    finish(false);

    return;
  }


  /* BOT +2 */

  if (
    card.value === "+2"
  ) {

    player.push(
      drawRaw()
    );

    player.push(
      drawRaw()
    );

    render();
  }


  /* BOT SKIP */

  if (
    card.value === "skip"
  ) {

    status(
      "Бот пропустил твой ход"
    );


    setTimeout(
      function() {

        status(
          "Бот ходит ещё раз..."
        );

        botTurn();

      },
      550
    );


    return;
  }


  turn =
    "player";


  status(
    "Твой ход"
  );


  render();
}


/* BOT COLOR */

function bestBotColor() {

  var count = {
    red: 0,
    yellow: 0,
    green: 0,
    blue: 0
  };


  for (
    var i = 0;
    i < bot.length;
    i++
  ) {

    var color =
      bot[i].color;


    if (
      count[color] !== undefined
    ) {

      count[color]++;
    }
  }


  var best =
    "red";


  for (
    var c = 0;
    c < COLORS.length;
    c++
  ) {

    var color =
      COLORS[c];


    if (
      count[color] >
      count[best]
    ) {

      best =
        color;
    }
  }


  return best;
}


/* END */

function finish(playerWon) {

  gameOver =
    true;


  if (
    playerWon
  ) {

    $("endText").innerHTML =
      "ТЫ ВЫИГРАЛ";

  } else {

    $("endText").innerHTML =
      "БОТ ВЫИГРАЛ";
  }


  $("endScreen")
    .classList
    .remove("hidden");
}


/* EVENTS */

$("deck").onclick =
  playerDraw;


$("restart").onclick =
  startGame;


$("again").onclick =
  startGame;


var colorButtons =
  document.querySelectorAll(
    ".pick"
  );


for (
  var i = 0;
  i < colorButtons.length;
  i++
) {

  colorButtons[i].onclick =
    function() {

      chooseColor(
        this.getAttribute(
          "data-color"
        )
      );
    };
}


/* GO */

startGame();
