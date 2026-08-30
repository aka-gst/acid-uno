"use strict";

/* =========================================================
   СВОИ РУБАШКИ

   Картинка с телефона становится рубашкой карт.

   ---------------------------------------------------------
   ПОЧЕМУ ЭТО УСТРОЕНО ИМЕННО ТАК

   Главное решение здесь не техническое, а юридическое, и
   принято оно один раз: картинка **не покидает устройство**.
   Никакой отправки на сервер, никакой передачи сопернику,
   никакой ссылки. Она лежит в IndexedDB этого браузера и
   видна только тому, кто её выбрал.

   Из этого следует всё остальное:

   - нет распространения — нет и ответственности за него.
     Нельзя разместить запрещённое там, где нет читателя, и
     нельзя нарушить чужое авторское право, показав картинку
     самому себе: это то же, что поставить её на обои;
   - не нужна ни модерация, ни жалобы, ни блокировки, ни
     возрастные ограничения, ни хранение — то есть не нужно
     то, чего мы всё равно не потянем и что пришлось бы
     делать раньше, чем появится второй живой игрок;
   - шутка остаётся шуткой: смешную картинку ставят себе, а
     не «выкладывают».

   Если однажды захочется показывать рубашку сопернику — это
   отдельное решение с отдельной ценой, и принимать его надо
   заранее, а не «заодно». Здесь нарочно нет ни одной строки,
   которая бы это приблизила.

   ---------------------------------------------------------
   ЧТО ЕЩЁ ДЕЛАЕТ ЭТОТ ФАЙЛ

   Картинка не сохраняется как есть. Она перерисовывается
   через canvas в маленький webp — и это не только про
   размер:

   - перерисовка **срезает EXIF**, а в нём у снимка с телефона
     лежат координаты места съёмки. Хранить чужую геометку в
     игре незачем;
   - память браузера не резиновая: пять фотографий по четыре
     мегабайта её переполнят, и тогда отвалится не только
     рубашка, а весь сохранённый прогресс.
   ========================================================= */

(() => {

  const DB = "acid-uno";

  const STORE = "backs";


  /*
    Рубашка видна размером в пару сантиметров, поэтому
    шестьсот точек по ширине — с запасом даже для экрана
    телефона. Пропорция карточная, 2:3.
  */
  const W = 600;

  const H = 900;


  /* больше десятка своих рубашек — это уже не шутка, а архив */
  const LIMIT = 12;


  let db = null;

  const urls = new Map();

  let mine = [];


  function open() {

    if (db) {
      return Promise.resolve(db);
    }

    return new Promise((resolve, reject) => {

      let request;

      try {

        request = indexedDB.open(DB, 1);

      } catch (error) {

        reject(error);

        return;
      }

      request.onupgradeneeded = () => {

        const base = request.result;

        if (!base.objectStoreNames.contains(STORE)) {

          base.createObjectStore(STORE, { keyPath: "id" });
        }
      };

      request.onsuccess = () => {

        db = request.result;

        resolve(db);
      };

      request.onerror = () =>
        reject(request.error);
    });
  }


  function tx(mode, run) {

    return open().then(base =>

      new Promise((resolve, reject) => {

        const store =
          base
            .transaction(STORE, mode)
            .objectStore(STORE);

        const request = run(store);

        request.onsuccess = () =>
          resolve(request.result);

        request.onerror = () =>
          reject(request.error);
      })
    );
  }


  /* =======================================================
     ПРИЁМ КАРТИНКИ

     Через <img>, а не через createImageBitmap: айфон отдаёт
     снимки в HEIC, и его умеет разобрать именно картинка в
     разметке, а не декодер битмапов.
     ======================================================= */

  function draw(file) {

    return new Promise((resolve, reject) => {

      const url = URL.createObjectURL(file);

      const image = new Image();

      image.onload = () => {

        URL.revokeObjectURL(url);

        const canvas =
          document.createElement("canvas");

        canvas.width = W;

        canvas.height = H;

        const paint =
          canvas.getContext("2d");


        /*
          Вписываем по короткой стороне и режем лишнее по
          центру: карта вертикальная, а снимки чаще
          горизонтальные, и «сжать» их — значит показать
          человека в кривом зеркале.
        */
        const scale =
          Math.max(
            W / image.width,
            H / image.height
          );

        const width = image.width * scale;

        const height = image.height * scale;

        paint.drawImage(
          image,
          (W - width) / 2,
          (H - height) / 2,
          width,
          height
        );


        /*
          webp легче, но Safari научился его записывать не
          сразу — если не вышло, кладём jpeg.
        */
        canvas.toBlob(
          blob => {

            if (blob) {

              resolve(blob);

              return;
            }

            canvas.toBlob(
              second =>
                second
                  ? resolve(second)
                  : reject(new Error("не вышло сохранить")),
              "image/jpeg",
              0.86
            );
          },
          "image/webp",
          0.86
        );
      };

      image.onerror = () => {

        URL.revokeObjectURL(url);

        reject(new Error("не открылась"));
      };

      image.src = url;
    });
  }


  async function add(file) {

    if (!file || !/^image\//.test(file.type || "")) {

      throw new Error("это не картинка");
    }


    if (mine.length >= LIMIT) {

      throw new Error(`больше ${LIMIT} не поместится`);
    }


    const blob = await draw(file);

    const id =
      `my-${Date.now().toString(36)}-` +
      Math.floor(Math.random() * 1e6).toString(36);

    await tx(
      "readwrite",
      store => store.put({ id, blob })
    );

    const url = URL.createObjectURL(blob);

    urls.set(id, url);

    mine = mine.concat([{ id, url }]);

    return { id, url };
  }


  async function remove(id) {

    await tx(
      "readwrite",
      store => store.delete(id)
    );

    const url = urls.get(id);

    if (url) {

      URL.revokeObjectURL(url);

      urls.delete(id);
    }

    mine = mine.filter(item => item.id !== id);

    return mine;
  }


  async function load() {

    let rows = [];

    try {

      rows =
        await tx(
          "readonly",
          store => store.getAll()
        ) || [];

    } catch (error) {

      /*
        Приватный режим и выключенное хранилище — обычное
        дело. Своих рубашек тогда просто нет, а игра идёт.
      */
      rows = [];
    }

    mine =
      rows.map(row => {

        const url =
          urls.get(row.id) ||
          URL.createObjectURL(row.blob);

        urls.set(row.id, url);

        return { id: row.id, url };
      });

    return mine;
  }


  function list() {
    return mine;
  }


  globalThis.AcidMyBacks = {
    LIMIT,
    add,
    remove,
    load,
    list
  };

})();
