"use strict";

/* =========================================================
   ACID UNO — АДМИН-МЕНЮ КАРТИНОК
   ---------------------------------------------------------
   Что из набора участвует в жребии, а что лежит без дела.
   Фоны, рубашки и материалы карты — превью настоящие, те же
   файлы, что игра берёт на стол.

   Меню не для игрока: открывается долгим нажатием на
   логотип или адресом со #art в конце. Выбор хранится в
   localStorage и живёт только в этом браузере — это
   настройка хозяина, а не правило игры.

   Сам фильтр живёт в src/assets.js; здесь только экран.
   ========================================================= */

(() => {

  const $ = id =>
    document.getElementById(id);


  const HOLD_MS = 650;


  const SECTIONS = [
    {
      key: "arena",
      title: "ФОНЫ",
      hint: "жребий на каждую партию",
      shape: "wide"
    },
    {
      key: "back",
      title: "РУБАШКИ",
      hint: "жребий на каждую партию",
      shape: "card"
    },
    {
      key: "my",
      title: "СВОИ РУБАШКИ",
      hint: "картинка остаётся на этом устройстве",
      shape: "card"
    },
    {
      key: "skin",
      title: "МАТЕРИАЛ КАРТЫ",
      hint: "жребий на каждую партию",
      shape: "square"
    }
  ];


  /*
    Материалы лежат словарём имя → файл, остальное списками.
    Приводим к одному виду: [имя, адрес].
  */
  function itemsOf(key) {

    const found =
      window.AcidAssets?.found;

    if (!found) {
      return [];
    }

    if (key === "skin") {

      return Object
        .entries(found.skin || {})
        .map(([name, url]) => [name.toUpperCase(), url]);
    }


    /*
      Свои — пары {id, url}: имени у картинки с телефона нет,
      и придумывать ей его незачем.
    */
    if (key === "my") {

      return (found.my || []).map(one => ["", one.url, one.id]);
    }

    return (found[key] || []).map(url => [
      url.split("/").pop().replace(/\.\w+$/, ""),
      url
    ]);
  }


  function layer() {

    let el = $("artAdmin");

    if (el) {
      return el;
    }

    el = document.createElement("div");

    el.id = "artAdmin";

    el.className = "artAdmin hidden";

    el.innerHTML =
      '<div class="artWindow">' +
      '<div class="artHead">' +
      '<div class="artTitle">КАРТИНКИ</div>' +
      '<div class="artHint">' +
      "что участвует в жребии. выключенное не выпадет никогда" +
      "</div>" +
      "</div>" +
      '<div class="artBody" id="artBody"></div>' +
      '<input class="artFile" id="artFile" type="file" ' +
      'accept="image/*">' +
      '<button class="artClose" id="artClose" type="button">' +
      "ГОТОВО</button>" +
      "</div>";

    document.body.appendChild(el);

    $("artClose")
      .addEventListener("click", close);


    $("artFile")
      .addEventListener("change", onFile);

    /*
      Клик мимо окна тоже закрывает: меню служебное, держать
      человека в нём незачем.
    */
    el.addEventListener("click", event => {

      if (event.target === el) {
        close();
      }
    });

    return el;
  }


  function paint() {

    const body = $("artBody");

    if (!body) {
      return;
    }

    body.innerHTML =
      SECTIONS
        .map(section => {

          const items = itemsOf(section.key);

          /*
            Пустой раздел своих рубашек всё равно показываем:
            иначе про возможность поставить свою картинку
            никто не узнает — кнопки-то нет.
          */
          if (!items.length && section.key !== "my") {
            return "";
          }


          const cells =
            items
              .map(([name, url, id]) => {

                const off =
                  window.AcidAssets.isOff(url);

                const dim =
                  window.AcidAssets.dimOf(url);

                /*
                  Ползунок только у фонов: рубашка и материал
                  лежат на карте, и затемнять их нечем — они
                  и так тёмные.
                */
                const slider =
                  section.key === "arena"
                    ? '<label class="artDim">' +
                      `<input type="range" min="0" max="85" step="5" ` +
                      `value="${dim}" data-dim="${url}">` +
                      `<span class="artDimValue">${dim}%</span>` +
                      "</label>"
                    : "";

                /*
                  Свою рубашку можно и убрать совсем: чужие
                  файлы из assets/ не удалить, а эту клал сам.
                */
                const drop =
                  id
                    ? '<button class="artDrop" type="button" ' +
                      `data-drop="${id}" aria-label="Убрать">✕</button>`
                    : "";

                return (
                  '<div class="artItem">' +
                  `<button class="artCell${off ? " off" : ""}" ` +
                  `type="button" data-url="${url}">` +
                  '<span class="artThumb" style="' +
                  `background-image:linear-gradient(rgba(0,0,0,${dim / 100}),` +
                  `rgba(0,0,0,${dim / 100})),url('${url}')">` +
                  "</span>" +
                  `<span class="artName">${name}</span>` +
                  "</button>" +
                  drop +
                  slider +
                  "</div>"
                );
              })
              .join("");


          /*
            Плитка «плюс» стоит последней: сперва то, что уже
            есть, потом место для новой.
          */
          const add =
            section.key === "my"
              ? '<div class="artItem">' +
                '<button class="artCell artAdd" type="button" id="artAdd">' +
                '<span class="artThumb artPlus">+</span>' +
                '<span class="artName">ДОБАВИТЬ</span>' +
                "</button>" +
                "</div>"
              : "";

          return (
            `<div class="artSection artShape-${section.shape}">` +
            `<div class="artSectionHead">${section.title}` +
            `<em>${section.hint}</em></div>` +
            `<div class="artGrid">${cells}${add}</div>` +
            (section.key === "my"
              ? `<div class="artNote" id="artNote">${NOTE}</div>`
              : "") +
            "</div>"
          );
        })
        .join("");
  }


  /*
    Один обработчик на весь экран: ячейки перерисовываются
    целиком, и вешать слушателя на каждую пришлось бы заново
    после каждого нажатия.
  */
  /* =======================================================
     СВОЯ КАРТИНКА

     Файл никуда не отправляется: он перерисовывается в
     маленький webp прямо здесь и ложится в память браузера
     (src/mybacks.js). Из этого следует всё остальное — и то,
     что модерация не нужна, и то, что чужую геометку из EXIF
     мы не храним: перерисовка её срезает.
     ======================================================= */

  async function onFile(event) {

    const file =
      event.target.files?.[0];

    event.target.value = "";

    if (!file) {
      return;
    }

    say("ГОТОВЛЮ…");

    try {

      const made =
        await window.AcidMyBacks.add(file);

      window.AcidAssets.noteMine(made);

      paint();

      say("ГОТОВО — ЭТА КАРТИНКА ТЕПЕРЬ В ЖРЕБИИ");

      window.AcidSound?.play("wild");

    } catch (error) {

      say(
        (error?.message || "не вышло").toUpperCase() +
        " · НУЖНА КАРТИНКА С ЭТОГО УСТРОЙСТВА"
      );
    }
  }


  const NOTE =
    "картинку никто, кроме тебя, не увидит: " +
    "она не уходит ни на сервер, ни сопернику";


  let noteTimer = null;


  /*
    Строка под своими рубашками — обещание, а не место для
    сообщений. Сообщение показываем на несколько секунд и
    возвращаем обещание на место: оно должно быть видно
    всегда, а не только пока никто ничего не нажимал.
  */
  function say(text) {

    const note = $("artNote");

    if (!note) {
      return;
    }

    note.textContent = text;

    clearTimeout(noteTimer);

    noteTimer =
      setTimeout(
        () => {

          const back = $("artNote");

          if (back) {
            back.textContent = NOTE;
          }
        },
        3500
      );
  }


  async function dropMine(id) {

    await window.AcidMyBacks.remove(id);

    window.AcidAssets.found.my =
      window.AcidMyBacks.list();

    paint();

    say("УБРАЛ");
  }


  function onBodyClick(event) {

    /*
      Плитка «плюс» ничего не выключает — она открывает
      выбор файла.
    */
    if (event.target?.closest?.("#artAdd")) {

      $("artFile")?.click();

      return;
    }


    const drop =
      event.target?.closest?.(".artDrop");

    if (drop) {

      dropMine(drop.dataset.drop);

      return;
    }


    const cell =
      event.target?.closest?.(".artCell");

    if (
      !cell ||
      event.target?.closest?.(".artDim")
    ) {
      return;
    }

    const url =
      cell.dataset.url;

    const off =
      !window.AcidAssets.isOff(url);

    window.AcidAssets.toggleOff(url, off);

    cell.classList.toggle("off", off);

    window.AcidSound?.play("card");
  }


  /*
    Ползунок затемнения. Меняем сразу и на превью, и в
    памяти: смысл в том, чтобы видеть результат, не закрывая
    окна.
  */
  function onBodyInput(event) {

    const slider =
      event.target;

    if (!slider?.dataset?.dim) {
      return;
    }

    const url =
      slider.dataset.dim;

    const value =
      window.AcidAssets.setDim(url, slider.value);

    const item =
      slider.closest(".artItem");

    const thumb =
      item?.querySelector(".artThumb");

    if (thumb) {

      thumb.style.backgroundImage =
        `linear-gradient(rgba(0,0,0,${value / 100}),` +
        `rgba(0,0,0,${value / 100})),url('${url}')`;
    }

    const label =
      item?.querySelector(".artDimValue");

    if (label) {
      label.textContent = `${value}%`;
    }
  }


  function open() {

    const el = layer();

    paint();

    $("artBody")
      .removeEventListener("click", onBodyClick);

    $("artBody")
      .addEventListener("click", onBodyClick);

    $("artBody")
      .removeEventListener("input", onBodyInput);

    $("artBody")
      .addEventListener("input", onBodyInput);

    el.classList.remove("hidden");
  }


  function close() {

    $("artAdmin")
      ?.classList
      .add("hidden");


    /*
      Выбор применяем сразу, не дожидаясь новой партии:
      иначе непонятно, подействовало ли вообще.
    */
    window.AcidAssets?.dressArena();

    window.AcidAssets?.dressBacks();
  }


  /* =======================================================
     КАК ОТКРЫТЬ

     Долгое нажатие на логотип — жест, который не сделаешь
     случайно, и его не видно тому, кто про него не знает.
     Плюс адрес со #art для тех случаев, когда удобнее
     ссылкой.
     ======================================================= */

  const logo =
    document.querySelector(".logo") ||
    document.querySelector("#topbarLead");


  let holdTimer = null;


  function armHold() {

    clearTimeout(holdTimer);

    holdTimer =
      setTimeout(open, HOLD_MS);
  }


  function cancelHold() {

    clearTimeout(holdTimer);

    holdTimer = null;
  }


  if (logo) {

    ["pointerdown"].forEach(type =>
      logo.addEventListener(type, armHold)
    );

    ["pointerup", "pointercancel", "pointerleave"].forEach(type =>
      logo.addEventListener(type, cancelHold)
    );

    /*
      Долгое нажатие на телефоне иначе вызывает системное
      меню с «скопировать» поверх нашего.
    */
    logo.addEventListener(
      "contextmenu",
      event => event.preventDefault()
    );
  }


  function checkHash() {

    if (location.hash === "#art") {
      open();
    }
  }


  window.addEventListener("hashchange", checkHash);


  /*
    Ждём, пока загрузчик найдёт файлы: до этого показывать
    нечего.
  */
  setTimeout(checkHash, 1200);


  globalThis.AcidArtAdmin = { open, close };

})();
