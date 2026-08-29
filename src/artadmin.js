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
      '<button class="artClose" id="artClose" type="button">' +
      "ГОТОВО</button>" +
      "</div>";

    document.body.appendChild(el);

    $("artClose")
      .addEventListener("click", close);

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

          if (!items.length) {
            return "";
          }

          const cells =
            items
              .map(([name, url]) => {

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
                  slider +
                  "</div>"
                );
              })
              .join("");

          return (
            `<div class="artSection artShape-${section.shape}">` +
            `<div class="artSectionHead">${section.title}` +
            `<em>${section.hint}</em></div>` +
            `<div class="artGrid">${cells}</div>` +
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
  function onBodyClick(event) {

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
