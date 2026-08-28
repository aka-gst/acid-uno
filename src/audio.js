"use strict";

/* =========================================================
   ACID UNO — SOUND
   ---------------------------------------------------------
   Звук синтезируется на WebAudio: ни одного файла, ничего
   не грузится по сети, всё звучит офлайн и в тон неоновой
   картинке.

   Публичный API:

     AcidSound.play("card")
     AcidSound.toggle()      -> boolean (включён ли звук)
     AcidSound.enabled()

   Ключи: card, draw, uno, reverse, penalty, win, lose.
   ========================================================= */

const AcidSound = (() => {

  const STORAGE_KEY =
    "acid-uno-sound";


  let ctx = null;

  let master = null;

  /*
    Три состояния, а не два: музыка мешает чаще, чем звуки
    ходов, и выключать её отдельно — обычное желание.

      full  звуки и музыка
      sfx   только звуки
      off   тишина
  */
  const MODES = ["full", "sfx", "off"];

  let on = "full";


  try {
    const saved =
      window.localStorage.getItem(STORAGE_KEY);

    if (MODES.includes(saved)) {
      on = saved;

    } else if (saved === "off") {
      on = "off";
    }

  } catch (error) {
    on = "full";
  }


  /* состояние музыкального цикла */
  const music = {
    timer: null,
    step: 0,
    gain: null
  };


  /*
    iOS не даёт запустить звук до первого касания,
    поэтому контекст создаётся лениво.
  */
  function ensure() {

    if (ctx) {
      return ctx;
    }

    const Ctor =
      window.AudioContext ||
      window.webkitAudioContext;

    if (!Ctor) {
      return null;
    }

    ctx = new Ctor();

    master = ctx.createGain();

    master.gain.value = .5;

    master.connect(ctx.destination);

    return ctx;
  }


  let unlocked = false;


  /*
    iOS не считает контекст рабочим, пока через него хоть раз
    что-то не проиграли внутри жеста пользователя — одного
    resume() мало. Поэтому первым делом пропускаем пустой
    буфер длиной в один сэмпл.

    Слушатели не одноразовые: система усыпляет контекст при
    сворачивании вкладки, и после возврата его надо будить
    снова.
  */
  function unlock() {

    const audio = ensure();

    if (!audio) {
      return;
    }

    if (audio.state === "suspended") {
      audio.resume();
    }

    if (!unlocked) {

      try {
        const buffer =
          audio.createBuffer(1, 1, 22050);

        const source =
          audio.createBufferSource();

        source.buffer = buffer;

        source.connect(audio.destination);

        source.start(0);

        unlocked = true;

      } catch (error) {
        /* попробуем на следующем касании */
      }
    }

    if (
      on === "full" &&
      !music.timer
    ) {
      startMusic();
    }
  }


  /*
    Наружу — чтобы можно было понять, почему тихо: контекст
    не создан, усыплён системой или выключен самим игроком.
  */
  function state() {

    return {
      mode: on,
      unlocked,
      context: ctx ? ctx.state : "нет",
      music: Boolean(music.timer)
    };
  }


  /*
    Один голос: осциллятор + огибающая.
  */
  function voice(spec) {

    const audio = ensure();

    if (!audio) {
      return;
    }

    const at =
      audio.currentTime +
      (spec.delay || 0);

    const osc =
      audio.createOscillator();

    const gain =
      audio.createGain();

    osc.type =
      spec.type || "triangle";

    osc.frequency
      .setValueAtTime(spec.from, at);

    if (
      spec.to &&
      spec.to !== spec.from
    ) {
      osc.frequency
        .exponentialRampToValueAtTime(
          Math.max(spec.to, 1),
          at + spec.length
        );
    }

    const peak =
      spec.gain || .22;

    gain.gain
      .setValueAtTime(.0001, at);

    gain.gain
      .exponentialRampToValueAtTime(
        peak,
        at + Math.min(.02, spec.length * .3)
      );

    gain.gain
      .exponentialRampToValueAtTime(
        .0001,
        at + spec.length
      );

    osc.connect(gain);

    gain.connect(spec.bus || master);

    osc.start(at);

    osc.stop(at + spec.length + .02);
  }


  /*
    Короткий шумовой слой — «шелест» карты.
  */
  function noise(spec) {

    const audio = ensure();

    if (!audio) {
      return;
    }

    const length =
      spec.length || .12;

    const frames =
      Math.floor(audio.sampleRate * length);

    const buffer =
      audio.createBuffer(
        1,
        frames,
        audio.sampleRate
      );

    const data =
      buffer.getChannelData(0);

    for (let i = 0; i < frames; i++) {

      const fade =
        1 - i / frames;

      data[i] =
        (Math.random() * 2 - 1) *
        fade * fade;
    }

    const source =
      audio.createBufferSource();

    source.buffer = buffer;

    const filter =
      audio.createBiquadFilter();

    filter.type = "bandpass";

    filter.frequency.value =
      spec.frequency || 2400;

    filter.Q.value = 1.1;

    const gain =
      audio.createGain();

    gain.gain.value =
      spec.gain || .16;

    source.connect(filter);

    filter.connect(gain);

    gain.connect(master);

    source.start(
      audio.currentTime + (spec.delay || 0)
    );
  }


  /* =======================================================
     БАНК
     ======================================================= */

  const BANK = {

    /* карта легла на стол */
    card() {
      noise({
        length: .11,
        frequency: 2600,
        gain: .17
      });

      voice({
        type: "triangle",
        from: 520,
        to: 190,
        length: .13,
        gain: .17
      });
    },

    /* взял карту из колоды */
    draw() {
      noise({
        length: .09,
        frequency: 1500,
        gain: .12
      });

      voice({
        type: "sine",
        from: 240,
        to: 400,
        length: .1,
        gain: .1
      });
    },

    /* объявил UNO */
    uno() {
      voice({
        type: "square",
        from: 660,
        to: 660,
        length: .1,
        gain: .13
      });

      voice({
        type: "square",
        from: 880,
        to: 880,
        length: .1,
        gain: .13,
        delay: .09
      });

      voice({
        type: "sawtooth",
        from: 1320,
        to: 1760,
        length: .22,
        gain: .12,
        delay: .18
      });
    },

    /* разворот / смена направления */
    reverse() {
      voice({
        type: "sawtooth",
        from: 300,
        to: 900,
        length: .16,
        gain: .12
      });

      voice({
        type: "sawtooth",
        from: 900,
        to: 300,
        length: .18,
        gain: .12,
        delay: .15
      });
    },

    /* прилетел штраф */
    penalty() {
      voice({
        type: "square",
        from: 190,
        to: 90,
        length: .26,
        gain: .2
      });

      noise({
        length: .18,
        frequency: 700,
        gain: .13,
        delay: .04
      });
    },

    /* победа */
    win() {
      [0, 1, 2, 3].forEach(i =>
        voice({
          type: "triangle",
          from: [523, 659, 784, 1047][i],
          to: [523, 659, 784, 1047][i],
          length: .3,
          gain: .17,
          delay: i * .11
        })
      );
    },

    /* поражение */
    lose() {
      [0, 1, 2].forEach(i =>
        voice({
          type: "sawtooth",
          from: [392, 311, 233][i],
          to: [392, 311, 233][i],
          length: .34,
          gain: .15,
          delay: i * .14
        })
      );
    }
  };


  /* =======================================================
     МУЗЫКА

     Ни одного файла: короткий круг из четырёх аккордов,
     который собирается теми же осцилляторами. Играет тихо
     и без ударных — это фон для настольной игры, а не трек.
     ======================================================= */

  /* ля-минорный круг: Am - F - C - G */
  const CHORDS = [
    [220.00, 261.63, 329.63],
    [174.61, 220.00, 261.63],
    [130.81, 196.00, 261.63],
    [196.00, 246.94, 293.66]
  ];

  const STEP_MS = 3200;


  function musicStep() {

    const audio = ensure();

    if (
      !audio ||
      on !== "full"
    ) {
      return;
    }

    const chord =
      CHORDS[music.step % CHORDS.length];

    music.step++;

    chord.forEach((frequency, index) =>
      voice({
        type: "triangle",
        from: frequency,
        to: frequency,
        length: STEP_MS / 1000 * 1.15,
        gain: .028,
        delay: index * .05,
        bus: music.gain
      })
    );

    /* басовая нота на октаву ниже держит круг */
    voice({
      type: "sine",
      from: chord[0] / 2,
      to: chord[0] / 2,
      length: STEP_MS / 1000 * 1.1,
      gain: .05,
      bus: music.gain
    });
  }


  function startMusic() {

    const audio = ensure();

    if (
      !audio ||
      on !== "full" ||
      music.timer
    ) {
      return;
    }

    if (!music.gain) {
      music.gain = audio.createGain();
      music.gain.gain.value = 1;
      music.gain.connect(master);
    }

    musicStep();

    music.timer =
      setInterval(musicStep, STEP_MS);
  }


  function stopMusic() {

    clearInterval(music.timer);

    music.timer = null;
  }


  /* =======================================================
     ПУБЛИЧНОЕ
     ======================================================= */

  function play(name) {

    if (
      on === "off" ||
      !BANK[name]
    ) {
      return;
    }

    try {
      unlock();

      BANK[name]();

    } catch (error) {
      /* звук — не повод ронять партию */
    }
  }


  function enabled() {
    return on !== "off";
  }


  function mode() {
    return on;
  }


  function set(value) {

    on =
      MODES.includes(value)
        ? value
        : "off";

    try {
      window.localStorage
        .setItem(STORAGE_KEY, on);

    } catch (error) {
      /* приватный режим — просто не запоминаем */
    }

    if (on === "full") {
      unlock();
      startMusic();

    } else {
      stopMusic();
    }

    return on;
  }


  /*
    Кнопка одна, поэтому режимы идут по кругу.
  */
  function cycle() {

    return set(
      MODES[
        (MODES.indexOf(on) + 1) % MODES.length
      ]
    );
  }


  function toggle() {
    return cycle();
  }


  /*
    Первое касание разблокирует звук на мобильных.
  */
  ["pointerdown", "touchend", "keydown"].forEach(type =>
    window.addEventListener(
      type,
      unlock,
      { passive: true }
    )
  );


  document.addEventListener(
    "visibilitychange",
    () => {

      if (document.hidden) {

        stopMusic();

      } else {

        unlock();
      }
    }
  );


  return {
    play,
    toggle,
    cycle,
    set,
    mode,
    enabled,
    unlock,
    state,
    startMusic,
    stopMusic
  };

})();
