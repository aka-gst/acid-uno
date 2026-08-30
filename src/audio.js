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
    Шина панорамы. Каждый звук идёт через свой панорамник:
    карта, положенная соперником слева, звучит слева. На
    телефоне с двумя динамиками и в наушниках это половина
    ощущения стола.
  */
  let panBus = null;


  /*
    Разброс для часто повторяющихся звуков. Один и тот же
    щелчок десять раз за партию превращается в шум, который
    перестаёшь слышать, а потом начинаешь замечать как
    раздражитель. Небольшая гуляющая высота и длительность
    снимают это полностью — ухо слышит «то же самое», но не
    «то же самое в записи».
  */
  function vary(value, spread) {
    return value * (1 + (Math.random() * 2 - 1) * spread);
  }

  /*
    Три состояния, а не два: музыка мешает чаще, чем звуки
    ходов, и выключать её отдельно — обычное желание.

      full  звуки и музыка
      sfx   только звуки
      off   тишина
  */
  const MODES = ["full", "sfx", "off"];

  /*
    На боевом сайте игра начинается со звуком — так задумано.
    А локальный предпросмотр запускается заново десятки раз
    за ночь, каждый на своём порту, и localStorage там всегда
    чистый: музыка стартовала бы снова и снова. Поэтому на
    localhost умолчание — тишина, а сохранённый выбор, если
    он есть, всё равно перебивает её ниже.
  */
  const local =
    /^(localhost|127\.0\.0\.1|\[::1\])$/.test(
      window.location.hostname);

  /*
    Заводское — «sfx»: звуки событий играют, музыка молчит.

    Звук события это обратная связь: без него не понять,
    засчитался ли ход. Музыка — фон, и человек, которому она
    мешает, узнаёт об этом уже раздражённым. Хозяин так и
    сказал: «музыка тут застревая, выключи её». Кому нужна —
    включит той же кнопкой, она на экране.
  */
  let on = local ? "off" : "sfx";


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


  /* =======================================================
     ЗАПИСАННЫЙ ЗВУК

     Синтез остаётся запасным вариантом. Есть файл — играем
     файл, нет — играем осциллятором, как раньше. Так же
     устроены картинки, и по той же причине: набор можно
     класть по частям и слышать разницу сразу.

     Грузим на первом касании, вместе с созданием контекста:
     раньше декодировать некуда, а без касания браузер всё
     равно не даст звучать.
     ======================================================= */

  const SFX = [
    "card",
    "draw",
    "skip",
    "reverse",
    "wild",
    "strike",
    "penalty",
    "uno",
    "win",
    "lose"
  ];


  const MUSIC = [
    "music-loop",
    "music-loop-2",
    "music-loop-3"
  ];


  const buffers = {};

  let musicBuffer = null;

  let loading = false;


  async function decode(url) {

    const audio = ensure();

    if (!audio) {
      return null;
    }

    try {

      const answer =
        await fetch(url);

      if (!answer.ok) {
        return null;
      }

      return await audio.decodeAudioData(
        await answer.arrayBuffer()
      );

    } catch (error) {

      /* нет файла или не тот формат — останемся на синтезе */
      return null;
    }
  }


  async function loadSamples() {

    if (loading) {
      return;
    }

    loading = true;


    await Promise.all(
      SFX.map(async name => {

        const buffer =
          await decode(`assets/sfx/sfx-${name}.webm`);

        if (buffer) {
          buffers[name] = buffer;
        }
      })
    );


    /*
      Петля выбирается жребием на загрузку — как фон и
      рубашка. Грузим только одну: три по мегабайту в память
      незачем.
    */
    const pick =
      MUSIC[
        Math.floor(Math.random() * MUSIC.length)
      ];

    musicBuffer =
      await decode(`assets/music/${pick}.webm`);


    /*
      Пока петля декодировалась, могла уже играть
      синтезированная — её и заменяем. Без этой замены
      записанная музыка не включилась бы до конца партии:
      startMusic видит работающий таймер и выходит.
    */
    if (
      on === "full" &&
      musicBuffer &&
      !music.source
    ) {

      stopMusic();

      startMusic();
    }
  }


  /*
    Проиграть записанный звук. Высота слегка гуляет у тех,
    что звучат каждый ход, — по той же причине, по которой
    гуляет синтез: одинаковая запись утомляет быстрее самого
    звука.
  */
  function playSample(name, pan) {

    const audio = ensure();

    const buffer = buffers[name];

    if (!audio || !buffer) {
      return false;
    }

    const source =
      audio.createBufferSource();

    source.buffer = buffer;

    source.playbackRate.value =
      name === "card" || name === "draw"
        ? vary(1, .09)
        : 1;

    const gain =
      audio.createGain();

    gain.gain.value = 1;

    source.connect(gain);

    gain.connect(panned(pan));

    source.start();

    return true;
  }


  /* состояние музыкального цикла */
  const music = {
    timer: null,
    step: 0,
    gain: null,

    /* источник записанной петли, если она есть */
    source: null
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

    /*
      Было .5, и на ноутбуке игру приходилось слушать, а не
      слышать: фон терялся в комнате целиком.
    */
    master.gain.value = .85;

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

    loadSamples();


    if (
      on === "full" &&
      !music.timer &&
      !music.source
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
      music: Boolean(music.timer || music.source),

      /* что играет: запись или синтез */
      samples: Object.keys(buffers).length,
      recorded: Boolean(music.source)
    };
  }


  /*
    Узел панорамы под конкретный звук. Ноль — по центру,
    минус единица — слева. Если браузер панорамник не умеет,
    отдаём мастер как есть: звук просто останется по центру.
  */
  /*
    Панорама текущего звука. Держим её здесь, а не тащим
    через каждый спек: у одного звука бывает три-четыре
    голоса, и все они звучат из одного места на столе.
  */
  let currentPan = 0;


  function panned(pan) {

    const audio = ensure();

    const value =
      pan === undefined ? currentPan : pan;

    if (
      !audio ||
      !audio.createStereoPanner ||
      !value
    ) {
      return master;
    }

    const node =
      audio.createStereoPanner();

    node.pan.value =
      Math.max(-1, Math.min(1, value));

    node.connect(master);

    return node;
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

    gain.connect(
      spec.bus || panned(spec.pan)
    );

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

    /*
      Шум тоже умеет идти на свою шину: щелчок в музыке
      должен приглушаться вместе с ней, а не жить сам по
      себе.
    */
    gain.connect(
      spec.bus || panned(spec.pan)
    );

    source.start(
      audio.currentTime + (spec.delay || 0)
    );
  }


  /* =======================================================
     БАНК
     ======================================================= */

  const BANK = {

    /*
      Карта легла на стол. Самый частый звук в игре, поэтому
      он единственный, который заметно гуляет: высота, длина
      и яркость щелчка каждый раз чуть другие. Ухо слышит
      «то же самое», но не «то же самое в записи».
    */
    card({ pan } = {}) {
      noise({
        length: vary(.11, .25),
        frequency: vary(2600, .22),
        gain: .17,
        pan
      });

      voice({
        type: "triangle",
        from: vary(520, .12),
        to: vary(190, .12),
        length: vary(.13, .2),
        gain: .17,
        pan
      });
    },

    /* взял карту из колоды */
    draw({ pan } = {}) {
      noise({
        length: vary(.09, .25),
        frequency: vary(1500, .2),
        gain: .12,
        pan
      });

      voice({
        type: "sine",
        from: vary(240, .12),
        to: vary(400, .12),
        length: vary(.1, .2),
        gain: .1,
        pan
      });
    },

    /* объявил UNO */
    uno({ pan } = {}) {
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
    reverse({ pan } = {}) {
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

    /* карта пропуска: резкая отсечка */
    skip({ pan } = {}) {
      voice({
        type: "square",
        from: 880,
        to: 220,
        length: .18,
        gain: .18
      });

      noise({
        length: .14,
        frequency: 1200,
        gain: .15,
        delay: .02
      });

      voice({
        type: "triangle",
        from: 170,
        to: 120,
        length: .22,
        gain: .13,
        delay: .12
      });
    },

    /*
      Положили +2 или +4. Звук идёт вверх — стопка растёт;
      забирают её вниз, звуком penalty.
    */
    strike({ pan } = {}) {
      voice({
        type: "sawtooth",
        from: 180,
        to: 520,
        length: .2,
        gain: .16
      });

      voice({
        type: "square",
        from: 360,
        to: 1040,
        length: .22,
        gain: .12,
        delay: .06
      });

      noise({
        length: .16,
        frequency: 900,
        gain: .12,
        delay: .06
      });
    },

    /* чёрная карта: сейчас сменится цвет */
    wild({ pan } = {}) {
      [0, 1, 2, 3].forEach(i =>
        voice({
          type: "triangle",
          from: [330, 415, 494, 622][i],
          to: [660, 830, 988, 1244][i],
          length: .26,
          gain: .1,
          delay: i * .05
        })
      );

      noise({
        length: .2,
        frequency: 3000,
        gain: .09,
        delay: .04
      });
    },

    /* прилетел штраф */
    penalty({ pan } = {}) {
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

    /*
      Победа. В мобильном UNO финал — единственное место, где
      звук держится секундами и заметно громче игровых: сначала
      разбег по аккорду, потом выдержанное трезвучие.
    */
    win() {
      [0, 1, 2, 3, 4].forEach(i =>
        voice({
          type: "triangle",
          from: [523, 659, 784, 1047, 1319][i],
          to: [523, 659, 784, 1047, 1319][i],
          length: .26,
          gain: .17,
          delay: i * .1
        })
      );

      [523, 784, 1047].forEach((hz, i) =>
        voice({
          type: "triangle",
          from: hz,
          to: hz,
          length: .9,
          gain: .13,
          delay: .5 + i * .02
        })
      );

      noise({
        length: .5,
        frequency: 4200,
        gain: .08,
        delay: .5
      });
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

     Ни одного файла: круг из четырёх аккордов, собранный
     теми же осцилляторами.

     Раньше это был один аккорд раз в три секунды на
     громкости в две сотых — технически музыка играла, а на
     слух её просто не было. Теперь у круга есть пульс:
     бас на сильных долях, тихий щелчок между ними и лид,
     который ведёт мелодию поверх аккорда. Всё равно фон, но
     фон, который слышно.
     ======================================================= */

  /* ля-минорный круг: Am - F - C - G */
  const CHORDS = [
    [220.00, 261.63, 329.63],
    [174.61, 220.00, 261.63],
    [130.81, 196.00, 261.63],
    [196.00, 246.94, 293.66]
  ];


  /*
    Мелодия поверх круга — по ноте на долю, своя на каждый
    аккорд. Ноль означает паузу: без пауз мотив превращается
    в бесконечную гамму и начинает надоедать к третьему
    кругу.
  */
  const LEAD = [
    [659.25, 0, 587.33, 0, 523.25, 0, 587.33, 0],
    [523.25, 0, 0, 440.00, 523.25, 0, 0, 0],
    [523.25, 0, 587.33, 0, 659.25, 0, 0, 0],
    [587.33, 0, 493.88, 0, 0, 587.33, 0, 0]
  ];


  const STEP_MS = 3200;

  const BEATS = 8;

  const BEAT = STEP_MS / 1000 / BEATS;


  function musicStep() {

    const audio = ensure();

    if (
      !audio ||
      on !== "full"
    ) {
      return;
    }

    const index =
      music.step % CHORDS.length;

    const chord =
      CHORDS[index];

    const lead =
      LEAD[index];

    music.step++;


    /* подушка: аккорд тянется весь такт */
    chord.forEach((frequency, i) =>
      voice({
        type: "triangle",
        from: frequency,
        to: frequency,
        length: STEP_MS / 1000 * 1.1,
        gain: .085,
        delay: i * .05,
        bus: music.gain
      })
    );


    for (let beat = 0; beat < BEATS; beat++) {

      const at = beat * BEAT;


      /* бас на первой и пятой доле */
      if (
        beat === 0 ||
        beat === 4
      ) {

        voice({
          type: "sine",
          from: chord[0] / 2,
          to: chord[0] / 2,
          length: BEAT * 1.6,
          gain: beat === 0 ? .2 : .14,
          delay: at,
          bus: music.gain
        });
      }


      /* щелчок между долями — держит темп */
      if (beat % 2 === 1) {

        noise({
          length: .045,
          gain: .022,
          frequency: 6400,
          delay: at,
          bus: music.gain
        });
      }


      const note =
        lead[beat];

      if (note) {

        voice({
          type: "triangle",
          from: note,
          to: note,
          length: BEAT * 1.35,
          gain: .045,
          delay: at,
          bus: music.gain
        });
      }
    }
  }


  function startMusic() {

    const audio = ensure();

    if (
      !audio ||
      on !== "full" ||
      music.timer ||
      music.source
    ) {
      return;
    }


    /*
      Записанная петля вместо синтезированной, если она
      загрузилась. Зацикливаем средствами самого источника:
      он склеивает конец с началом сэмплово, без щелчка,
      которого не избежать при перезапуске по таймеру.
    */
    if (musicBuffer) {

      if (!music.gain) {
        music.gain = audio.createGain();
        music.gain.gain.value = 1;
        music.gain.connect(master);
      }

      const source =
        audio.createBufferSource();

      source.buffer = musicBuffer;

      source.loop = true;

      source.connect(music.gain);

      source.start();

      music.source = source;

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

    try {

      music.source?.stop();

    } catch (error) {

      /* уже остановлен — не беда */
    }

    music.source = null;
  }


  /* =======================================================
     ПУБЛИЧНОЕ
     ======================================================= */

  /*
    play("card", { pan: -0.6 }) — звук слева.

    Панораму передаёт тот, кто знает, где на экране это
    случилось: карта соперника слева звучит слева. Не передал
    — играет по центру, как раньше.
  */
  function play(name, options) {

    if (
      on === "off" ||
      !BANK[name]
    ) {
      return;
    }

    try {
      unlock();

      currentPan =
        Number(options?.pan) || 0;

      /*
        Файл главнее синтеза. Нет файла — играем как раньше.
      */
      if (!playSample(name, currentPan)) {

        BANK[name](options || {});
      }

      currentPan = 0;

    } catch (error) {

      currentPan = 0;
      /* звук — не повод ронять партию */
    }
  }


  /*
    Экранный X в панораму. Края экрана — не крайние значения:
    полностью развести звук по каналам значит потерять его в
    одном ухе.
  */
  function panFromScreen(x) {

    const width =
      window.innerWidth || 1;

    return Math.max(
      -0.75,
      Math.min(0.75, (x / width - 0.5) * 1.6)
    );
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
    Вкладка ушла из виду — музыка замолкает.

    Без этого она играет из невидимой вкладки, а система на
    телефоне может усыпить контекст на полуслове и вернуть
    его с середины буфера: снаружи это и слышно как
    «застревает». Возвращаемся — заводим заново, с начала.
  */
  document.addEventListener(
    "visibilitychange",
    () => {

      if (document.hidden) {

        stopMusic();

        return;
      }

      if (on === "full" && unlocked) {

        stopMusic();

        startMusic();
      }
    }
  );


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
    panFromScreen,
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
