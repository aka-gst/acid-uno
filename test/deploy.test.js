"use strict";

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "..");
const SCRIPT = path.join(ROOT, "deploy", "acid-deploy.mjs");


function tempTree() {

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "acid-deploy-"));

  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.mkdirSync(path.join(root, "server"), { recursive: true });
  fs.writeFileSync(path.join(root, "index.html"), "local static\n");
  fs.writeFileSync(path.join(root, "src", "match.js"), "local app\n");
  fs.writeFileSync(path.join(root, "server", "server.js"), "room server\n");

  return root;
}


function write(root, name, body) {

  const file = path.join(root, name);

  fs.writeFileSync(file, body);

  return file;
}


function run(args, root) {

  try {
    return {
      code: 0,
      output: execFileSync(
        process.execPath,
        [SCRIPT, ...args],
        {
          cwd: ROOT,
          encoding: "utf8",
          env: {
            ...process.env,
            ACID_DEPLOY_NO_NETWORK: "1"
          }
        }
      )
    };

  } catch (error) {
    return {
      code: error.status ?? 1,
      output: String(error.stdout || "") + String(error.stderr || "")
    };
  }
}


test("dry-run печатает itemize и не требует сети", () => {

  const root = tempTree();
  const statics = write(root, "static.list", "index.html\nsrc/match.js\n");
  const app = write(root, "app.list", "server/server.js\nsrc/match.js\n");

  const result = run(
    [
      "--dry-run",
      "--source", root,
      "--static-list", statics,
      "--app-list", app
    ],
    root
  );

  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /DRY RUN/);
  assert.match(result.output, /itemize.*index\.html/i);
  assert.match(result.output, /network: disabled/i);
});


test("пустой белый список останавливает deploy", () => {

  const root = tempTree();
  const empty = write(root, "empty.list", "");
  const app = write(root, "app.list", "server/server.js\n");

  const result = run(
    [
      "--dry-run",
      "--source", root,
      "--static-list", empty,
      "--app-list", app
    ],
    root
  );

  assert.notEqual(result.code, 0);
  assert.match(result.output, /static manifest is empty/i);
});


test("manifest с путём за разрешённым корнем останавливает deploy", () => {

  const root = tempTree();
  const statics = write(root, "static.list", "../secret.txt\n");
  const app = write(root, "app.list", "server/server.js\n");

  const result = run(
    [
      "--dry-run",
      "--source", root,
      "--static-list", statics,
      "--app-list", app
    ],
    root
  );

  assert.notEqual(result.code, 0);
  assert.match(result.output, /outside source root/i);
});


test("stale-plan удаляет только путь из предыдущего manifest", () => {

  const root = tempTree();
  const previous = write(
    root,
    "previous.manifest",
    "keep.js deadbeef\nold.js deadbeef\n"
  );
  const current = write(root, "current.manifest", "keep.js deadbeef\n");

  const result = run(
    ["--stale-plan", "--previous", previous, "--current", current],
    root
  );

  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /^old\.js$/m);
  assert.doesNotMatch(result.output, /keep\.js/);
  assert.doesNotMatch(result.output, /untracked/);
});


test("verify-manifests падает на различающемся server hash", () => {

  const root = tempTree();
  const local = write(root, "local.manifest", "index.html aaa\n");
  const server = write(root, "server.manifest", "index.html bbb\n");
  const curl = write(root, "curl.manifest", "index.html aaa\n");

  const result = run(
    [
      "--verify-manifests",
      "--local", local,
      "--server", server,
      "--curl", curl
    ],
    root
  );

  assert.notEqual(result.code, 0);
  assert.match(result.output, /hash mismatch.*index\.html/i);
});


test("verify-manifests падает на пустом curl manifest", () => {

  const root = tempTree();
  const local = write(root, "local.manifest", "index.html aaa\n");
  const server = write(root, "server.manifest", "index.html aaa\n");
  const curl = write(root, "curl.manifest", "");

  const result = run(
    [
      "--verify-manifests",
      "--local", local,
      "--server", server,
      "--curl", curl
    ],
    root
  );

  assert.notEqual(result.code, 0);
  assert.match(result.output, /curl manifest is empty/i);
});


test("stale-plan отвергает путь за корнем даже из старого manifest", () => {

  const root = tempTree();
  const previous = write(root, "previous.manifest", "../other deadbeef\n");
  const current = write(root, "current.manifest", "keep.js deadbeef\n");

  const result = run(
    ["--stale-plan", "--previous", previous, "--current", current],
    root
  );

  assert.notEqual(result.code, 0);
  assert.match(result.output, /outside source root/i);
});


test("--go не начинает сетевую выкладку в no-network среде", () => {

  const root = tempTree();
  const statics = write(root, "static.list", "index.html\n");
  const app = write(root, "app.list", "server/server.js\n");

  const result = run(
    [
      "--go",
      "--source", root,
      "--static-list", statics,
      "--app-list", app
    ],
    root
  );

  assert.notEqual(result.code, 0);
  assert.match(result.output, /network is disabled/i);
});
