"use strict";

/*
  Запуск:
  ACID_UNO_E2E=1 NODE_PATH=/path/to/puppeteer/node_modules \
  PUPPETEER_EXECUTABLE_PATH=/path/to/chrome \
    node --test test/home-exit.e2e.test.js

  Это именно браузерные проверки: они кликают настоящую ссылку
  #homeLink в загруженной игре, а не проверяют текст исходника.
*/

const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const http = require("node:http");
const path = require("node:path");
const test = require("node:test");

const enabled = process.env.ACID_UNO_E2E === "1";

let puppeteer;

if (enabled) {
  puppeteer = require("puppeteer");
}

const PORT = 4184;
const ORIGIN = `http://127.0.0.1:${PORT}/`;

let server;
let browser;


function waitForServer() {

  return new Promise((resolve, reject) => {

    const until = Date.now() + 5000;

    const probe = () => {

      const request = http.get(ORIGIN, response => {

        response.resume();

        if (response.statusCode === 200) {
          resolve();
          return;
        }

        reject(new Error(`Локальная игра ответила ${response.statusCode}`));
      });

      request.on("error", error => {

        if (Date.now() >= until) {
          reject(error);
          return;
        }

        setTimeout(probe, 50);
      });
    };

    probe();
  });
}


function nextDialog(page) {

  return Promise.race([
    once(page, "dialog").then(([dialog]) => dialog),
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("Подтверждение выхода не появилось")),
        1000
      )
    )
  ]);
}


async function newGamePage() {

  const page = await browser.newPage();

  await page.goto(ORIGIN, {
    waitUntil: "domcontentloaded",
    timeout: 5000
  });

  await page.waitForSelector("#lobby", { timeout: 5000 });

  const tutorialVisible = await page.$eval(
    "#tutorial",
    element => !element.classList.contains("hidden")
  );

  if (tutorialVisible) {
    await page.evaluate(() =>
      localStorage.setItem("acid-uno-rules-seen", "1")
    );

    await page.reload({
      waitUntil: "domcontentloaded",
      timeout: 5000
    });
  }

  const rulesVisible = await page.$eval(
    "#rules",
    element => !element.classList.contains("hidden")
  );

  if (rulesVisible) {
    await page.click("#rulesClose");
  }

  /*
    Локальная игра живёт в /, поэтому её ../ не меняет адрес.
    Меняем только место назначения этой же ссылки: обработчик и
    браузерный click остаются настоящими, но уход становится наблюдаем.
  */
  await page.$eval(
    "#homeLink",
    link => link.setAttribute("href", "/outside/")
  );

  return page;
}


async function startMatch(page) {

  await page.click("#lobbyStart");

  await page.waitForFunction(
    () => document.getElementById("lobby").classList.contains("hidden")
  );
}


function clickHomeLink(page) {

  return page.$eval(
    "#homeLink",
    link => link.click()
  );
}


test.before(async () => {

  if (!enabled) {
    return;
  }

  server = spawn(process.execPath, ["server/server.js"], {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, PORT: String(PORT) },
    stdio: "ignore"
  });

  await waitForServer();

  browser = await puppeteer.launch({ headless: true });
});


test.after(async () => {

  if (!enabled) {
    return;
  }

  await browser?.close();

  if (
    server &&
    server.exitCode === null &&
    server.signalCode === null
  ) {
    const stopped = once(server, "exit");

    server.kill();
    await stopped;
  }
});


test(
  "первый заход проходит учебную партию и как играть запускает её снова",
  { skip: !enabled },
  async () => {

    const context = await browser.createBrowserContext();

    const page = await context.newPage();

    await page.goto(ORIGIN, {
      waitUntil: "domcontentloaded",
      timeout: 5000
    });

    await page.waitForFunction(
      () => !document
        .getElementById("tutorial")
        .classList.contains("hidden")
    );

    await page.click('[data-card-id="2"]');

    assert.match(
      await page.$eval(
        "#tutorialStatus",
        element => element.textContent
      ),
      /красная 3/i
    );

    assert.equal(
      await page.$$eval(
        "#tutorialHand [data-card-id]",
        cards => cards.length
      ),
      4
    );

    await page.click('[data-card-id="1"]');

    assert.match(
      await page.$eval(
        "#tutorialHint",
        element => element.textContent
      ),
      /синюю \+2/i
    );

    await page.click('[data-card-id="2"]');

    assert.match(
      await page.$eval(
        "#tutorialHint",
        element => element.textContent
      ),
      /нажми UNO/i
    );

    await page.click("#tutorialUno");
    await page.click('[data-card-id="3"]');

    assert.equal(
      await page.$$eval(
        "#tutorialHand [data-card-id]",
        cards => cards.length
      ),
      1
    );

    await page.click('[data-card-id="4"]');

    await page.waitForSelector("#tutorialFinish:not(.hidden)");

    await page.click("#tutorialFinish");

    assert.equal(
      await page.$eval(
        "#tutorial",
        element => element.classList.contains("hidden")
      ),
      true
    );

    await page.click("#rulesOpen");

    await page.waitForFunction(
      () => !document
        .getElementById("tutorial")
        .classList.contains("hidden")
    );

    assert.equal(
      await page.$$eval(
        "#tutorialHand [data-card-id]",
        cards => cards.length
      ),
      4
    );

    await context.close();
  }
);


test(
  "первый экран обучения помещает карту и UNO в мобильное окно",
  { skip: !enabled },
  async () => {

    const context = await browser.createBrowserContext();

    const page = await context.newPage();

    await page.setViewport({
      width: 390,
      height: 844,
      isMobile: true,
      hasTouch: true
    });

    await page.goto(ORIGIN, {
      waitUntil: "domcontentloaded",
      timeout: 5000
    });

    await page.evaluate(() =>
      localStorage.removeItem("acid-uno-rules-seen")
    );

    await page.reload({
      waitUntil: "domcontentloaded",
      timeout: 5000
    });

    await page.waitForSelector("#tutorial:not(.hidden)");

    const layout = await page.evaluate(() => {

      const visible = selector => {
        const rect = document.querySelector(selector).getBoundingClientRect();

        return rect.top >= 0 && rect.bottom <= window.innerHeight;
      };

      return {
        card: visible('[data-card-id="1"]'),
        uno: visible("#tutorialUno"),
        finish: visible("#tutorialReference")
      };
    });

    assert.deepEqual(layout, {
      card: true,
      uno: true,
      finish: true
    });

    await context.close();
  }
);


test(
  "НА ГЛАВНУЮ без начатой партии уводит без вопроса",
  { skip: !enabled },
  async () => {

    const page = await newGamePage();
    let dialogs = 0;

    page.on("dialog", async dialog => {
      dialogs += 1;
      await dialog.dismiss();
    });

    await Promise.all([
      page.waitForNavigation({
        waitUntil: "domcontentloaded",
        timeout: 5000
      }),
      clickHomeLink(page)
    ]);

    assert.equal(dialogs, 0);
    assert.equal(page.url(), ORIGIN + "outside/");

    await page.close();
  }
);


test(
  "НА ГЛАВНУЮ из партии по отмене сохраняет игру",
  { skip: !enabled },
  async () => {

    const page = await newGamePage();

    await startMatch(page);

    const dialog = nextDialog(page);

    const click = clickHomeLink(page);

    const confirmation = await dialog;

    assert.match(confirmation.message(), /прогресс.*не сохраниться/i);

    await confirmation.dismiss();
    await click;

    assert.equal(
      await page.$eval(
        "#lobby",
        element => element.classList.contains("hidden")
      ),
      true
    );
    assert.equal(page.url(), ORIGIN);

    await page.close();
  }
);


test(
  "НА ГЛАВНУЮ из партии по согласию уводит",
  { skip: !enabled },
  async () => {

    const page = await newGamePage();

    await startMatch(page);

    const dialog = nextDialog(page);
    const navigation = page.waitForNavigation({
      waitUntil: "domcontentloaded",
      timeout: 5000
    });

    const click = clickHomeLink(page);

    const confirmation = await dialog;

    assert.match(confirmation.message(), /прогресс.*не сохраниться/i);

    await confirmation.accept();
    await click;
    await navigation;

    assert.equal(page.url(), ORIGIN + "outside/");
    assert.equal(await page.$("#lobby"), null);

    await page.close();
  }
);


test(
  "начала партии уходят в локальный сборщик только с test-префиксом",
  { skip: !enabled },
  async () => {

    const context = await browser.createBrowserContext();
    const page = await context.newPage();

    await page.evaluateOnNewDocument(() => {
      window.__analyticsEvents = [];
      window.umami = {
        track(name, data) {
          window.__analyticsEvents.push({ name, data });
        }
      };
    });

    await page.goto(ORIGIN, {
      waitUntil: "domcontentloaded",
      timeout: 5000
    });

    await page.waitForSelector("#lobby", { timeout: 5000 });

    await page.evaluate(() =>
      localStorage.setItem("acid-uno-rules-seen", "1")
    );

    await page.reload({
      waitUntil: "domcontentloaded",
      timeout: 5000
    });

    if (await page.$eval("#rules", element => !element.classList.contains("hidden"))) {
      await page.click("#rulesClose");
    }

    await page.click("#lobbyStart");

    await page.waitForFunction(
      () => document.getElementById("lobby").classList.contains("hidden")
    );

    await page.$eval("#again", button => button.click());

    assert.deepEqual(
      await page.evaluate(() => window.__analyticsEvents),
      [{
        name: "test-acid-uno-party-start",
        data: { source: "lobby", attempt: 1 }
      }, {
        name: "test-acid-uno-party-start",
        data: { source: "replay", attempt: 2 }
      }]
    );

    await context.close();
  }
);
