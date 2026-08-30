/* =========================================================
   КАРТИНКИ

   Фоны арены, портреты соперников и рубашки лежат в assets/.
   Их может не быть — игра тогда рисует прежний вариант кодом,
   поэтому файлы можно класть по одному.

   Проверка идёт загрузкой, а не запросом: 404 у статики
   отдаётся страницей, и по коду ответа картинку от неё не
   отличить.
   ========================================================= */

(function (root, make) {

  const api = make();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.AcidAssets = api;
  }

})(typeof globalThis === "undefined" ? this : globalThis, function () {

  /*
    Потолок перебора, а не обещание. Проверка идёт по
    порядку и останавливается на первом промахе, так что
    лишние числа ничего не стоят — зато новый набор можно
    просто положить в assets/ и он подхватится сам, без
    правки кода.

    Портретов двадцать четыре — по числу имён в BOT_NAMES.
  */
  const COUNTS = {
    arena: 16,
    bot: 24,
    back: 12
  };


  /*
    Имена и расширения — как в наборе, который отдаёт
    генератор: webp легче jpg и png при том же качестве, а
    рубашка там называется card-back.
  */
  const EXT = "webp";


  const PREFIX = {
    arena: "arena",
    bot: "bot",
    back: "card-back"
  };


  /*
    Текстуры материалов лежат не по номерам, а по именам —
    материал у карты не случайный номер, а конкретный
    «плёнка» или «печатная плата».
  */
  const SKINS = [
    "film",
    "glass",
    "pcb",
    "tube",
    "crt"
  ];


  /* что реально нашлось */
  const found = {
    arena: [],
    bot: [],
    back: [],
    skin: {},

    /*
      Свои рубашки — картинки с устройства хозяина. Живут в
      IndexedDB (src/mybacks.js), сюда попадают уже готовыми
      парами {id, url}. На сервер не уходят никогда: адрес у
      них blob:, он существует только в этой вкладке.
    */
    my: []
  };


  /* =======================================================
     КЛЮЧ НАСТРОЙКИ

     Выключенное и затемнение хранятся по адресу файла. У
     своих рубашек адрес blob: — он новый в каждой вкладке,
     и настройка по нему не пережила бы перезагрузку.
     Поэтому для них ключом служит их собственный id.
     ======================================================= */

  const keys = new Map();


  function keyFor(url) {
    return keys.get(url) || url;
  }


  /* =======================================================
     ОТКЛЮЧЁННОЕ ВРУЧНУЮ

     Что именно из найденного участвует в жребии, решает
     хозяин игры через админ-меню (src/artadmin.js). Здесь
     только хранение и фильтр: сам список — плоский набор
     имён файлов, которые в жребий не берутся.
     ======================================================= */

  const OFF_KEY =
    "acid-uno-art-off";


  function offList() {

    try {

      const raw =
        window.localStorage.getItem(OFF_KEY);

      const list =
        raw ? JSON.parse(raw) : [];

      return Array.isArray(list) ? list : [];

    } catch (error) {

      return [];
    }
  }


  function setOff(list) {

    try {

      window.localStorage.setItem(
        OFF_KEY,
        JSON.stringify(list)
      );

    } catch (error) {

      /* приватный режим — не запомним, и ладно */
    }
  }


  function isOff(url) {
    return offList().includes(keyFor(url));
  }


  function toggleOff(url, off) {

    const key = keyFor(url);

    const list =
      offList().filter(one => one !== key);

    if (off) {
      list.push(key);
    }

    setOff(list);

    return list;
  }


  /*
    Что реально участвует в жребии. Если выключили всё —
    возвращаем полный набор: пустой стол без фона и без
    рубашки выглядел бы поломкой, а не выбором.
  */
  function pool(list) {

    const on =
      list.filter(url => !isOff(url));

    return on.length ? on : list;
  }


  /* =======================================================
     ЗАТЕМНЕНИЕ ФОНА

     Рисованные арены пёстрые — они и должны быть такими сами
     по себе, но под столом с картами пестрота мешает. Каждой
     можно задать свою степень затемнения: ноль — как
     нарисовано, восемьдесят — почти чёрный силуэт.

     Хранится рядом с выключенными: это такая же настройка
     хозяина, привязанная к файлу.
     ======================================================= */

  const DIM_KEY =
    "acid-uno-art-dim";


  function dimMap() {

    try {

      const raw =
        window.localStorage.getItem(DIM_KEY);

      const map =
        raw ? JSON.parse(raw) : {};

      return map && typeof map === "object" ? map : {};

    } catch (error) {

      return {};
    }
  }


  function dimOf(url) {

    const value =
      Number(dimMap()[keyFor(url)]);

    return Number.isFinite(value)
      ? Math.min(85, Math.max(0, value))
      : 0;
  }


  function setDim(url, value) {

    const map = dimMap();

    const key = keyFor(url);

    map[key] = Math.min(85, Math.max(0, Number(value) || 0));

    try {

      window.localStorage.setItem(
        DIM_KEY,
        JSON.stringify(map)
      );

    } catch (error) {

      /* приватный режим — не запомним */
    }

    return map[key];
  }


  function probe(url) {

    return new Promise(resolve => {

      const image = new Image();

      image.onload = () => resolve(true);
      image.onerror = () => resolve(false);

      image.src = url;
    });
  }


  async function scan(kind) {

    const list = [];

    for (let i = 1; i <= COUNTS[kind]; i += 1) {

      const url = `assets/${PREFIX[kind]}-${i}.${EXT}`;

      /* eslint-disable no-await-in-loop */
      if (!await probe(url)) {

        /*
          Файлы нумеруются подряд, поэтому первый промах
          означает конец набора. Иначе пустая папка стоила бы
          шестнадцати неудачных запросов на каждой загрузке.
        */
        break;
      }

      list.push(url);
    }

    found[kind] = list;

    return list;
  }


  async function scanSkins() {

    await Promise.all(
      SKINS.map(async name => {

        const url = `assets/skin-${name}.${EXT}`;

        if (await probe(url)) {
          found.skin[name] = url;
        }
      })
    );

    return found.skin;
  }


  /*
    Материал карты. Текстуру кладём переменной, а сам факт её
    наличия — атрибутом: без него подложка на карте остаётся
    пустой и невидимой, и карта выглядит ровно как раньше.
  */
  function dressSkin(name) {

    const url = found.skin[name];

    const root = document.documentElement;

    if (!url) {

      delete root.dataset.skinArt;

      return;
    }

    root.style.setProperty(
      "--skin-texture",
      `url("${url}")`
    );

    root.dataset.skinArt = "1";
  }


  /*
    Фон выбирается жребием на партию — как и материал карты.
    Сетка под ним остаётся, но приглушается: поверх рисованной
    арены она выглядела бы разметкой на фотографии.
  */
  function dressArena() {

    if (!found.arena.length) {
      return;
    }

    const list =
      pool(found.arena);

    const url =
      list[
        Math.floor(Math.random() * list.length)
      ];

    const arena = document.getElementById("arena");

    if (!arena) {
      return;
    }

    /*
      Затемнение — слоем поверх картинки, а не фильтром: фильтр
      на весь экран стоит дорого, а лишний прямоугольник в
      background не стоит ничего.
    */
    const dim =
      dimOf(url) / 100;

    arena.style.backgroundImage =
      dim > 0
        ? `linear-gradient(rgba(0,0,0,${dim}), rgba(0,0,0,${dim})), url("${url}")`
        : `url("${url}")`;

    arena.dataset.art = "1";
  }


  /*
    Портрет ложится в ту же плашку, где живёт осциллограмма.
    Если портрета нет — волна остаётся, и стол не рассыпается.
  */
  function dressFace(element, seatIndex) {

    if (!found.bot.length || !element) {
      return;
    }

    const url =
      found.bot[seatIndex % found.bot.length];

    element.style.backgroundImage = `url("${url}")`;

    element.dataset.art = "1";
  }


  /*
    Все рубашки, что участвуют в жребии: набор из assets/ и
    свои картинки хозяина — на равных правах.
  */
  function allBacks() {

    return found.back.concat(
      found.my.map(one => one.url)
    );
  }


  function dressBacks() {

    const every = allBacks();

    if (!every.length) {
      return;
    }

    const list =
      pool(every);

    const url =
      list[
        Math.floor(Math.random() * list.length)
      ];

    document.documentElement.style.setProperty(
      "--card-back",
      `url("${url}")`
    );

    document.documentElement.dataset.backArt = "1";
  }


  /*
    Забрать свои рубашки из памяти браузера и завести им
    ключи настроек. Отдельной функцией, потому что зовётся
    ещё и после добавления новой картинки.
  */
  async function loadMine() {

    if (!globalThis.AcidMyBacks) {
      return [];
    }

    found.my =
      await globalThis.AcidMyBacks.load();

    found.my.forEach(one =>
      keys.set(one.url, one.id)
    );

    return found.my;
  }


  function noteMine(one) {

    keys.set(one.url, one.id);

    found.my = globalThis.AcidMyBacks.list();
  }


  async function boot() {

    await Promise.all([
      scan("arena"),
      scan("bot"),
      scan("back"),
      scanSkins(),
      loadMine()
    ]);

    dressArena();

    dressBacks();

    return found;
  }


  return {
    COUNTS,
    SKINS,
    found,
    scan,
    boot,
    dressArena,
    dressBacks,
    allBacks,
    loadMine,
    noteMine,
    dressFace,
    dressSkin,

    /* для админ-меню */
    offList,
    isOff,
    toggleOff,
    pool,
    dimOf,
    setDim
  };

});
