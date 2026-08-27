"use strict";

/* =========================================================
   ACID UNO v8.2
   Gameplay / UNO / bot / fast draw / special FX
   ========================================================= */

(() => {

  const wait82 = ms =>
    new Promise(resolve => setTimeout(resolve, ms));

  const rand82 = (min, max) =>
    min + Math.random() * (max - min);


  /* =======================================================
     DOM
     ======================================================= */

  function ensureUI82() {

    /* ROBOT FINGER — REMOVE COMPLETELY */

    document
      .querySelectorAll(
        "#robotFinger,.robotFinger"
      )
      .forEach(el => el.remove());


    /* UNO BUTTON */

    if (!$("unoButton")) {

      const button =
        document.createElement(
          "button"
        );

      button.id =
        "unoButton";

      button.type =
        "button";

      button.textContent =
        "UNO!";

      document.body.appendChild(
        button
      );
    }


    /* SPECIAL FX */

    if (!$("v82Burst")) {

      const burst =
        document.createElement(
          "div"
        );

      burst.id =
        "v82Burst";

      document.body.appendChild(
        burst
      );
    }
  }


  ensureUI82();


  /* =======================================================
     DISABLE v8.1 MAGNET LOOP

     v8.1 менял element.style.scale каждый frame.
     Убираем это изменение принудительно.

     Геометрией карты занимается только v8.
     ======================================================= */

  function killOldMagnet82() {

    const card =
      document.querySelector(
        "#animationLayer .handCard.dragging"
      );

    if (card) {

      if (
        card.style.scale &&
        card.style.scale !== "1"
      ) {
        card.style.scale =
          "1";
      }
    }

    requestAnimationFrame(
      killOldMagnet82
    );
  }

  killOldMagnet82();


  /* =======================================================
     SPECIAL BURSTS
     ======================================================= */

  let burstTimer82 =
    null;


  function burst82(
    text,
    mode = ""
  ) {

    const el =
      $("v82Burst");

    if (!el) return;


    clearTimeout(
      burstTimer82
    );


    el.className = "";

    void el.offsetWidth;


    el.textContent =
      text;


    if (mode) {
      el.classList.add(mode);
    }

    el.classList.add(
      "show"
    );


    burstTimer82 =
      setTimeout(
        () => {
          el.className = "";
        },
        650
      );
  }


  /* =======================================================
     UNO STATE
     ======================================================= */

  let playerUnoArmed82 =
    false;

  let playerUnoCalled82 =
    false;

  let playerUnoVulnerable82 =
    false;

  let playerUnoCatchTimer82 =
    null;


  let botUnoCalled82 =
    false;

  let botUnoVulnerable82 =
    false;

  let botUnoTimer82 =
    null;

  let botCatchTimer82 =
    null;


  const unoButton82 =
    $("unoButton");


  /* =======================================================
     UNO BUTTON
     ======================================================= */

  function showUnoButton82() {

    if (!unoButton82) {
      return;
    }

    unoButton82.classList.add(
      "show"
    );

    unoButton82.classList.remove(
      "called"
    );
  }


  function hideUnoButton82() {

    if (!unoButton82) {
      return;
    }

    unoButton82.classList.remove(
      "show",
      "called"
    );
  }


  function resetPlayerUno82() {

    playerUnoArmed82 =
      false;

    playerUnoCalled82 =
      false;

    playerUnoVulnerable82 =
      false;

    clearTimeout(
      playerUnoCatchTimer82
    );

    hideUnoButton82();
  }


  unoButton82
    ?.addEventListener(
      "click",
      event => {

        event.preventDefault();
        event.stopPropagation();


        if (
          gameOver ||
          player.length !== 2 ||
          turn !== "player"
        ) {
          return;
        }


        playerUnoArmed82 =
          true;

        playerUnoCalled82 =
          true;


        unoButton82.classList.add(
          "called"
        );


        burst82(
          "UNO!",
          "acid"
        );


        AcidFX.status(
          "UNO!"
        );


        setTimeout(
          hideUnoButton82,
          420
        );
      }
    );


  /* =======================================================
     PLAYER UNO UI

     Кнопка появляется, когда у игрока
     две карты и сейчас его ход.
     ======================================================= */

  function syncUnoButton82() {

    if (
      gameOver ||
      turn !== "player" ||
      player.length !== 2
    ) {

      if (
        !playerUnoVulnerable82
      ) {
        hideUnoButton82();
      }

      return;
    }


    if (
      !playerUnoCalled82
    ) {
      showUnoButton82();
    }
  }


  /* =======================================================
     PLAYER MISSED UNO

     После того как осталось 1 карта,
     бот получает короткое человеческое
     окно реакции.

     Средняя реакция +30%.
     Используем примерно 440–700ms.
     ======================================================= */

  function exposePlayerUno82() {

    playerUnoVulnerable82 =
      true;


    clearTimeout(
      playerUnoCatchTimer82
    );


    const reaction =
      rand82(
        440,
        700
      );


    playerUnoCatchTimer82 =
      setTimeout(
        async () => {

          if (
            gameOver ||
            !playerUnoVulnerable82 ||
            player.length !== 1
          ) {
            return;
          }


          playerUnoVulnerable82 =
            false;


          burst82(
            "НЕ СКАЗАЛ UNO! +2",
            "danger"
          );


          $("playerArea")
            ?.classList
            .add(
              "caught"
            );


          await wait82(120);


          const cards =
            takeMany(2);


          for (
            const card of cards
          ) {

            player.push(card);

            render();

            /*
              Не ждём длинную анимацию.
            */

            AcidFX
              .drawCard(
                card,
                "player"
              )
              .catch(() => {});


            await wait82(75);
          }


          $("playerArea")
            ?.classList
            .remove(
              "caught"
            );


          resetPlayerUno82();


          render();


          AcidFX.status(
            "БОТ ПОЙМАЛ ТЕБЯ — +2"
          );
        },
        reaction
      );
  }


  /* =======================================================
     BOT UNO
     ======================================================= */

  function clearBotUno82() {

    botUnoCalled82 =
      false;

    botUnoVulnerable82 =
      false;


    clearTimeout(
      botUnoTimer82
    );

    clearTimeout(
      botCatchTimer82
    );


    $("bot")
      ?.classList
      .remove(
        "catchable"
      );
  }


  function botPrepareUno82() {

    clearBotUno82();


    /*
      Бот не нажимает UNO мгновенно.

      Средняя человеческая реакция
      +30%, со случайным разбросом.
    */

    const reaction =
      rand82(
        440,
        700
      );


    botUnoVulnerable82 =
      true;


    $("bot")
      ?.classList
      .add(
        "catchable"
      );


    botUnoTimer82 =
      setTimeout(
        () => {

          if (
            gameOver ||
            !botUnoVulnerable82 ||
            bot.length !== 1
          ) {
            return;
          }


          botUnoCalled82 =
            true;

          botUnoVulnerable82 =
            false;


          $("bot")
            ?.classList
            .remove(
              "catchable"
            );


          burst82(
            "БОТ: UNO!",
            "acid"
          );


          AcidFX.status(
            "БОТ: UNO!"
          );
        },
        reaction
      );


    /*
      Если игрок не поймал бота,
      после его UNO окно закрывается.
    */

    botCatchTimer82 =
      setTimeout(
        () => {

          botUnoVulnerable82 =
            false;

          $("bot")
            ?.classList
            .remove(
              "catchable"
            );
        },
        900
      );
  }


  /* =======================================================
     TAP BOT TO CATCH
     ======================================================= */

  $("bot")
    ?.addEventListener(
      "click",
      async () => {

        if (
          gameOver ||
          !botUnoVulnerable82 ||
          botUnoCalled82 ||
          bot.length !== 1
        ) {
          return;
        }


        clearBotUno82();


        burst82(
          "ПОЙМАЛ! +2",
          "danger"
        );


        AcidFX.status(
          "БОТ НЕ СКАЗАЛ UNO — +2"
        );


        const cards =
          takeMany(2);


        for (
          const card of cards
        ) {

          bot.push(card);

          render();

          /*
            Визуально не раскрываем карту.
          */

          await animateBotBack82();

          await wait82(55);
        }


        render();
      }
    );


  /* =======================================================
     BOT FACE-DOWN DRAW
     ======================================================= */

  async function animateBotBack82() {

    const deck =
      $("deck");

    const target =
      $("botCards");

    const layer =
      $("animationLayer");


    if (
      !deck ||
      !target ||
      !layer
    ) {
      return;
    }


    const a =
      deck.getBoundingClientRect();

    const b =
      target.getBoundingClientRect();


    const el =
      document.createElement(
        "div"
      );


    el.className =
      "botCard";


    Object.assign(
      el.style,
      {
        position:
          "fixed",

        left:
          `${a.left}px`,

        top:
          `${a.top}px`,

        width:
          `${a.width}px`,

        height:
          `${a.height}px`,

        margin:
          "0",

        zIndex:
          "10000",

        pointerEvents:
          "none",

        transformOrigin:
          "50% 50%",

        transition:
          "none"
      }
    );


    layer.appendChild(
      el
    );


    await new Promise(
      resolve =>
        requestAnimationFrame(
          () =>
            requestAnimationFrame(
              resolve
            )
        )
    );


    const dx =
      (
        b.left +
        b.width / 2
      ) -
      (
        a.left +
        a.width / 2
      );


    const dy =
      (
        b.top +
        b.height / 2
      ) -
      (
        a.top +
        a.height / 2
      );


    el.style.transition =
      "transform 260ms cubic-bezier(.2,.8,.2,1), opacity 80ms ease";


    el.style.transform =
      `translate3d(${dx}px,${dy}px,0) scale(.48) rotate(8deg)`;


    await wait82(245);


    el.style.opacity =
      "0";


    await wait82(60);


    el.remove();
  }


  /* =======================================================
     SPECIAL CARD EFFECT OVERRIDE
     ======================================================= */

  animateCardEffect =
    async function (
      card,
      chosenColor
    ) {

      if (!card) {
        return;
      }


      switch (
        card.value
      ) {

        case "+2":

          burst82(
            "+2",
            "danger"
          );

          AcidFX
            .penalty(
              drawPenalty
            )
            .catch(() => {});

          await wait82(220);

          break;


        case "+4":

          burst82(
            "+4",
            "danger"
          );

          AcidFX
            .penalty(
              drawPenalty
            )
            .catch(() => {});

          await wait82(240);

          break;


        case "skip":

          burst82(
            "ПРОПУСК",
            "acid"
          );

          AcidFX
            .special(
              "skip"
            )
            .catch(() => {});

          await wait82(210);

          break;


        case "reverse":

          burst82(
            "РЕВЕРС",
            "acid"
          );

          AcidFX
            .special(
              "reverse"
            )
            .catch(() => {});

          await wait82(210);

          break;
      }


      if (
        card.color ===
        "wild"
      ) {

        burst82(
          (
            chosenColor ||
            currentColor ||
            "WILD"
          ).toUpperCase(),
          "acid"
        );


        AcidFX
          .wild(
            chosenColor ||
            currentColor
          )
          .catch(() => {});


        await wait82(220);
      }
    };


  /* =======================================================
     FAST PLAYER DRAW

     Один тап = одна карта.

     Ход НЕ заканчивается.

     Следующий тап разрешается почти сразу,
     а декоративная анимация может ещё лететь.
     ======================================================= */

  let drawTapLock82 =
    false;


  playerDraw =
    async function () {

      if (
        gameOver ||
        turn !== "player" ||
        drag ||
        drawTapLock82
      ) {
        return;
      }


      /*
        PENALTY остаётся отдельным правилом:
        забираем весь накопленный штраф.
      */

      if (
        drawPenalty > 0
      ) {

        drawTapLock82 =
          true;


        const amount =
          drawPenalty;


        const cards =
          takeMany(
            amount
          );


        drawPenalty =
          0;

        penaltyType =
          null;


        burst82(
          `+${cards.length}`,
          "danger"
        );


        for (
          const card of cards
        ) {

          player.push(
            card
          );

          render();


          AcidFX
            .drawCard(
              card,
              "player"
            )
            .catch(() => {});


          await wait82(75);
        }


        /*
          Принял штраф:
          ход закончен.
        */

        turn =
          "bot";


        render();


        AcidFX.status(
          "ХОД БОТА"
        );


        drawTapLock82 =
          false;


        setTimeout(
          () => {

            if (
              !gameOver &&
              turn === "bot"
            ) {
              botTurn();
            }
          },
          140
        );


        return;
      }


      /* NORMAL VOLUNTARY DRAW */

      const card =
        takeRaw();


      if (!card) {
        return;
      }


      drawTapLock82 =
        true;


      /*
        Состояние обновляем сразу.
      */

      player.push(
        card
      );


      turn =
        "player";


      render();


      AcidFX.status(
        "ТВОЙ ХОД"
      );


      /*
        Анимацию НЕ await.
      */

      AcidFX
        .drawCard(
          card,
          "player"
        )
        .catch(() => {});


      /*
        Через 100ms уже можно
        нажать колоду снова.
      */

      setTimeout(
        () => {

          drawTapLock82 =
            false;

        },
        100
      );
    };


  /* =======================================================
     REBIND DECK

     Удаляем старые click listeners,
     созданные game.js / v8.1.
     ======================================================= */

  function rebindDeck82() {

    const oldDeck =
      $("deck");


    if (!oldDeck) {
      return;
    }


    const deck =
      oldDeck.cloneNode(
        true
      );


    oldDeck
      .parentNode
      .replaceChild(
        deck,
        oldDeck
      );


    deck.addEventListener(
      "click",
      event => {

        event.preventDefault();

        playerDraw();
      }
    );
  }


  rebindDeck82();


  /* =======================================================
     BOT TURN

     Быстрый обычный ход.
     Перехват остаётся отдельной
     человеческой реакцией.
     ======================================================= */

  botTurn =
    async function () {

      if (
        gameOver ||
        turn !== "bot"
      ) {
        return;
      }


      /*
        Не используем длинный unavailable(),
        потому что часть визуальных FX
        теперь работает параллельно.
      */

      /* INTERCEPT */

      const interceptIndex =
        botInterceptIndex();


      if (
        interceptIndex !== -1 &&
        Math.random() < .82
      ) {

        AcidFX.status(
          "ПЕРЕХВАТ?"
        );


        await wait82(
          rand82(
            340,
            510
          )
        );


        if (
          gameOver ||
          turn !== "bot"
        ) {
          return;
        }


        const fresh =
          botInterceptIndex();


        if (
          fresh !== -1
        ) {

          burst82(
            "ПЕРЕХВАТ!",
            "acid"
          );


          await botPlay(
            fresh,
            true
          );


          return;
        }
      }


      /* NORMAL THINK */

      AcidFX.status(
        "БОТ ДУМАЕТ..."
      );


      await wait82(
        rand82(
          55,
          125
        )
      );


      if (
        gameOver ||
        turn !== "bot"
      ) {
        return;
      }


      /* PENALTY */

      if (
        drawPenalty > 0
      ) {

        const defense =
          botPlayableIndexes();


        if (
          defense.length > 0
        ) {

          await wait82(
            rand82(
              50,
              100
            )
          );


          await botPlay(
            botChoose(
              defense
            ),
            false
          );


          return;
        }


        /*
          Бот принимает штраф.

          КЛЮЧЕВО:
          после этого он НЕ продолжает
          искать подходящую карту.
        */

        const amount =
          drawPenalty;


        const cards =
          takeMany(
            amount
          );


        drawPenalty =
          0;

        penaltyType =
          null;


        burst82(
          `БОТ +${cards.length}`,
          "danger"
        );


        for (
          const card of cards
        ) {

          await animateBotBack82();


          bot.push(
            card
          );


          render();


          await wait82(35);
        }


        /*
          СРАЗУ твой ход.
        */

        turn =
          "player";


        render();


        AcidFX.status(
          "ТВОЙ ХОД"
        );


        syncUnoButton82();


        return;
      }


      /* NORMAL PLAY */

      let playable =
        botPlayableIndexes();


      /*
        У бота оставляем старое правило:
        если нечем ходить —
        он добирает до первой подходящей.
      */

      if (
        playable.length === 0
      ) {

        AcidFX.status(
          "БОТ ДОБИРАЕТ..."
        );


        let found =
          -1;

        let safety =
          0;


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


          await animateBotBack82();


          bot.push(
            card
          );


          render();


          if (
            normalPlayable(
              card
            )
          ) {

            found =
              bot.length - 1;
          }


          await wait82(30);
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

        turn =
          "player";


        render();


        AcidFX.status(
          "ТВОЙ ХОД"
        );


        syncUnoButton82();

        return;
      }


      await wait82(
        rand82(
          45,
          90
        )
      );


      if (
        gameOver ||
        turn !== "bot"
      ) {
        return;
      }


      await botPlay(
        botChoose(
          playable
        ),
        false
      );
    };


  /* =======================================================
     BOT PLAY

     Убираем старые длинные sleep.
     ======================================================= */

  botPlay =
    async function (
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
        card.color ===
        "wild"
      ) {

        chosenColor =
          bestBotColor(
            index
          );
      }


      /*
        Если сейчас у бота 2 карты,
        после этого хода останется одна:
        запускаем UNO reaction.
      */

      const willHaveOne =
        bot.length === 2;


      AcidFX.status(
        intercept
          ? "БОТ: ПЕРЕХВАТ"
          : "БОТ ХОДИТ"
      );


      /*
        Оставляем сам полёт,
        но не добавляем ещё 300–500ms
        искусственного ожидания.
      */

      await AcidFX.playBotCard(
        card
      );


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

        clearBotUno82();

        finish(false);

        return;
      }


      if (
        willHaveOne &&
        bot.length === 1
      ) {

        botPrepareUno82();
      }


      /*
        SKIP / REVERSE:
        бот ходит ещё раз.
      */

      if (
        card.value === "skip" ||
        card.value === "reverse"
      ) {

        turn =
          "bot";


        AcidFX.status(
          card.value === "skip"
            ? "ПРОПУСК!"
            : "БОТ ЕЩЁ РАЗ"
        );


        setTimeout(
          () => {

            if (
              !gameOver &&
              turn === "bot"
            ) {
              botTurn();
            }
          },
          120
        );


        return;
      }


      turn =
        "player";


      render();


      if (
        drawPenalty > 0
      ) {

        AcidFX.status(
          `ШТРАФ +${drawPenalty}`
        );

      } else {

        AcidFX.status(
          "ТВОЙ ХОД"
        );
      }


      syncUnoButton82();
    };


  /* =======================================================
     PLAYER PLAY WRAPPER FOR UNO

     Сохраняем v8 playerPlay.
     ======================================================= */

  const playerPlayBefore82 =
    playerPlay;


  playerPlay =
    async function (
      cardId,
      chosenColor,
      intercept,
      releasedRect
    ) {

      const beforeCount =
        player.length;


      /*
        Если игрок собирается перейти
        с 2 карт на 1 — кнопка уже должна
        быть доступна.
      */

      if (
        beforeCount === 2 &&
        !playerUnoCalled82
      ) {

        playerUnoArmed82 =
          true;
      }


      await playerPlayBefore82(
        cardId,
        chosenColor,
        intercept,
        releasedRect
      );


      /*
        Победа могла уже произойти.
      */

      if (gameOver) {
        return;
      }


      if (
        beforeCount === 2 &&
        player.length === 1
      ) {

        hideUnoButton82();


        if (
          playerUnoCalled82
        ) {

          playerUnoVulnerable82 =
            false;


          burst82(
            "UNO!",
            "acid"
          );

        } else {

          exposePlayerUno82();
        }
      }


      /*
        После любого другого изменения
        синхронизируем кнопку.
      */

      if (
        player.length !== 1
      ) {

        playerUnoVulnerable82 =
          false;
      }


      syncUnoButton82();
    };


  /* =======================================================
     FLIP-LIKE HAND TRANSITIONS

     v8 всё ещё перестраивает DOM.
     Поэтому сохраняем геометрию по cardId
     перед render и анимируем новые элементы
     из старых экранных координат.

     Это убирает эффект:
     "за один кадр пришли в финальное состояние".
     ======================================================= */

  let previousHandRects82 =
    new Map();


  function captureHand82() {

    const map =
      new Map();


    document
      .querySelectorAll(
        "#hand .handCard[data-card-id]"
      )
      .forEach(
        el => {

          const id =
            el.dataset.cardId;


          const r =
            el.getBoundingClientRect();


          map.set(
            id,
            {
              x:
                r.left +
                r.width / 2,

              y:
                r.top +
                r.height / 2
            }
          );
        }
      );


    return map;
  }


  function animateHand82(
    oldRects
  ) {

    requestAnimationFrame(
      () => {

        document
          .querySelectorAll(
            "#hand .handCard[data-card-id]"
          )
          .forEach(
            el => {

              const old =
                oldRects.get(
                  el.dataset.cardId
                );


              if (!old) {
                return;
              }


              const r =
                el.getBoundingClientRect();


              const nowX =
                r.left +
                r.width / 2;


              const nowY =
                r.top +
                r.height / 2;


              const dx =
                old.x -
                nowX;


              const dy =
                old.y -
                nowY;


              if (
                Math.abs(dx) < 1 &&
                Math.abs(dy) < 1
              ) {
                return;
              }


              el.animate(
                [
                  {
                    translate:
                      `${dx}px ${dy}px`
                  },
                  {
                    translate:
                      "0px 0px"
                  }
                ],
                {
                  duration:
                    220,

                  easing:
                    "cubic-bezier(.2,.8,.2,1)"
                }
              );
            }
          );
      }
    );
  }


  const renderBefore82 =
    render;


  render =
    function () {

      const oldRects =
        captureHand82();


      renderBefore82();


      animateHand82(
        oldRects
      );


      syncUnoButton82();
    };


  /* =======================================================
     RETURNING CARD Z-ORDER

     Пока drag активен, placeholder уже содержит
     правильный z-index из веера.

     При возврате следим, чтобы flying card
     не оказывалась поверх всей руки.
     ======================================================= */

  const zObserver82 =
    new MutationObserver(
      () => {

        const dragged =
          document.querySelector(
            "#animationLayer .handCard.dragging"
          );


        if (!dragged) {
          return;
        }


        /*
          При активном drag она сверху — правильно.
          Как только начинается return animation,
          снижаем слой относительно глобальных FX.
        */

        if (
          dragged.classList.contains(
            "returning"
          )
        ) {

          dragged.style.zIndex =
            "20";
        }
      }
    );


  zObserver82.observe(
    document.body,
    {
      subtree: true,
      attributes: true,
      attributeFilter: [
        "class"
      ]
    }
  );


  /* =======================================================
     START GAME RESET
     ======================================================= */

  const startGameBefore82 =
    startGame;


  startGame =
    function () {

      resetPlayerUno82();

      clearBotUno82();


      startGameBefore82();


      ensureUI82();


      syncUnoButton82();
    };


  /* =======================================================
     INITIAL
     ======================================================= */

  syncUnoButton82();


  console.log(
    "ACID UNO v8.2 loaded"
  );

})();