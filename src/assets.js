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


  /* что реально нашлось */
  const found = {
    arena: [],
    bot: [],
    back: []
  };


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


  /*
    Фон выбирается жребием на партию — как и материал карты.
    Сетка под ним остаётся, но приглушается: поверх рисованной
    арены она выглядела бы разметкой на фотографии.
  */
  function dressArena() {

    if (!found.arena.length) {
      return;
    }

    const url =
      found.arena[
        Math.floor(Math.random() * found.arena.length)
      ];

    const arena = document.getElementById("arena");

    if (!arena) {
      return;
    }

    arena.style.backgroundImage = `url("${url}")`;

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


  function dressBacks() {

    if (!found.back.length) {
      return;
    }

    const url =
      found.back[
        Math.floor(Math.random() * found.back.length)
      ];

    document.documentElement.style.setProperty(
      "--card-back",
      `url("${url}")`
    );

    document.documentElement.dataset.backArt = "1";
  }


  async function boot() {

    await Promise.all([
      scan("arena"),
      scan("bot"),
      scan("back")
    ]);

    dressArena();

    dressBacks();

    return found;
  }


  return {
    COUNTS,
    found,
    scan,
    boot,
    dressArena,
    dressBacks,
    dressFace
  };

});
