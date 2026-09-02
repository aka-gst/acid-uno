#!/usr/bin/env node

/*
  Безопасная выкладка ACID UNO. По умолчанию показывает план; --go
  разрешает сеть. Caddy здесь намеренно не упоминается.
*/

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const here = path.dirname(new URL(import.meta.url).pathname);
const defaults = {
  source: path.resolve(here, ".."),
  staticList: path.join(here, "static-files.txt"),
  appList: path.join(here, "room-app-files.txt"),
  host: process.env.ACID_DEPLOY_HOST || "bonita",
  staticRoot: process.env.ACID_DEPLOY_STATIC_ROOT ||
    "/opt/zakriva/caddy/site/acid",
  appRoot: process.env.ACID_DEPLOY_APP_ROOT ||
    "/opt/zakriva/apps/acid-uno",
  stateRoot: process.env.ACID_DEPLOY_STATE_ROOT ||
    "/opt/zakriva/state/acid-uno",
  backupRoot: process.env.ACID_DEPLOY_BACKUP_ROOT ||
    "/opt/zakriva/backups/acid-uno",
  baseUrl: process.env.ACID_DEPLOY_BASE_URL || "https://aka-gst.ru/acid"
};


function fail(message) {

  throw new Error(message);
}


function hashFile(file) {

  const data = fs.readFileSync(file);

  if (data.length === 0) {
    fail(`empty file: ${file}`);
  }

  return crypto.createHash("sha256").update(data).digest("hex");
}


function safePath(entry) {

  const value = String(entry || "").trim().replaceAll("\\", "/");

  if (
    !value ||
    path.posix.isAbsolute(value) ||
    value === "." ||
    value.split("/").includes("..")
  ) {
    fail(`path outside source root: ${entry}`);
  }

  return value;
}


function readList(file, label) {

  const entries = fs.readFileSync(file, "utf8")
    .split(/\r?\n/)
    .map(line => line.replace(/#.*/, "").trim())
    .filter(Boolean)
    .map(safePath);

  if (entries.length === 0) {
    fail(`${label} manifest is empty`);
  }

  return [...new Set(entries)].sort();
}


function manifestFromList(root, entries) {

  const files = [];

  const add = relative => {

    const target = path.resolve(root, relative);

    if (!(target === root || target.startsWith(root + path.sep))) {
      fail(`path outside source root: ${relative}`);
    }

    const stat = fs.lstatSync(target);

    if (stat.isSymbolicLink()) {
      fail(`symbolic link is not deployable: ${relative}`);
    }

    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(target).sort()) {
        add(path.posix.join(relative, name));
      }
      return;
    }

    if (!stat.isFile()) {
      fail(`not a regular file: ${relative}`);
    }

    files.push({ path: relative, hash: hashFile(target) });
  };

  entries.forEach(add);

  if (files.length === 0) {
    fail("manifest expanded to zero files");
  }

  return files.sort((a, b) => a.path.localeCompare(b.path));
}


function encodeManifest(manifest) {

  return manifest.map(entry => `${entry.path} ${entry.hash}`).join("\n") + "\n";
}


function decodeManifest(text, label) {

  const rows = String(text || "").trim().split(/\r?\n/).filter(Boolean);
  const map = new Map();

  for (const row of rows) {
    const match = row.match(/^(\S+)\s+([a-f0-9]{3,})$/i);

    if (!match) {
      fail(`invalid ${label} manifest row: ${row}`);
    }

    const item = safePath(match[1]);

    if (map.has(item)) {
      fail(`duplicate ${label} manifest path: ${item}`);
    }

    map.set(item, match[2]);
  }

  if (map.size === 0) {
    fail(`${label} manifest is empty`);
  }

  return map;
}


function stalePaths(previous, current) {

  const before = decodeManifest(previous, "previous");
  const now = decodeManifest(current, "current");

  return [...before.keys()].filter(item => !now.has(item)).sort();
}


function verifyManifests(localText, serverText, curlText) {

  const local = decodeManifest(localText, "local");
  const server = decodeManifest(serverText, "server");
  const curl = decodeManifest(curlText, "curl");

  for (const [file, hash] of local) {
    if (!server.has(file) || !curl.has(file)) {
      fail(`hash mismatch: ${file} is missing from server or curl`);
    }

    if (server.get(file) !== hash || curl.get(file) !== hash) {
      fail(`hash mismatch: ${file}`);
    }
  }

  for (const file of [...server.keys(), ...curl.keys()]) {
    if (!local.has(file)) {
      fail(`hash mismatch: unexpected ${file}`);
    }
  }
}


function shellQuote(value) {

  return "'" + String(value).replaceAll("'", "'\"'\"'") + "'";
}


function command(program, args, options = {}) {

  const result = spawnSync(program, args, {
    encoding: "utf8",
    input: options.input,
    stdio: options.stdio || "pipe"
  });

  if (result.error) {
    fail(`${program} did not start: ${result.error.message}`);
  }

  if (result.status !== 0) {
    fail(`${program} failed: ${(result.stderr || result.stdout || "").trim()}`);
  }

  return result.stdout || "";
}


function remote(host, script, input) {

  return command(
    "ssh",
    ["-o", "ConnectTimeout=15", "-o", "BatchMode=yes", host, script],
    { input }
  );
}


function remoteManifest(host, root, files, label) {

  const script = [
    "set -eu",
    `cd ${shellQuote(root)}`,
    "while IFS= read -r file; do",
    "  case \"$file\" in ''|/*|../*|*'/../'*|.|*/..) exit 2 ;; esac",
    "  [ -s \"$file\" ] || { echo \"empty or missing $file\" >&2; exit 3; }",
    "  printf '%s ' \"$file\"",
    "  sha256sum \"$file\" | awk '{print $1}'",
    "done"
  ].join("\n");

  const text = remote(
    host,
    script,
    files.map(item => item.path).join("\n") + "\n"
  );

  return decodeManifest(text, label);
}


function remoteOptional(host, file) {

  return remote(
    host,
    `if [ -f ${shellQuote(file)} ]; then cat ${shellQuote(file)}; fi`
  );
}


function staleFromOptional(previousText, currentText, label) {

  if (!String(previousText || "").trim()) {
    return [];
  }

  return stalePaths(previousText, currentText).map(safePath);
}


function withFile(prefix, contents, fn) {

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const file = path.join(directory, "files.txt");

  fs.writeFileSync(file, contents);

  try {
    return fn(file);

  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}


function rsyncFiles(host, source, destination, manifest, dryRun) {

  return withFile(
    "acid-rsync-",
    manifest.map(item => item.path).join("\n") + "\n",
    file => command(
      "rsync",
      [
        "-az",
        "--delay-updates",
        "--itemize-changes",
        ...(dryRun ? ["--dry-run"] : []),
        `--files-from=${file}`,
        `${source}/`,
        `${host}:${destination}/`
      ]
    )
  );
}


function removeStale(host, root, files) {

  if (files.length === 0) {
    return;
  }

  const removals = files
    .map(file => `rm -f -- ${shellQuote(path.posix.join(root, safePath(file)))}`)
    .join("\n");

  remote(host, `set -eu\n${removals}`);
}


function writeRemote(host, destination, contents) {

  remote(host, `mkdir -p ${shellQuote(path.posix.dirname(destination))}`);

  withFile(
    "acid-manifest-",
    contents,
    file => command(
      "scp",
      ["-q", file, `${host}:${destination}`]
    )
  );
}


function curlManifest(baseUrl, manifest) {

  const rows = [];

  for (const item of manifest) {
    const temporary = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), "acid-curl-")),
      "body"
    );

    try {
      command(
        "curl",
        [
          "--fail",
          "--silent",
          "--show-error",
          "--retry", "3",
          "--retry-all-errors",
          "--max-time", "25",
          "--output", temporary,
          `${baseUrl}/${item.path}?deploy-check=${Date.now()}`
        ]
      );

      rows.push({ path: item.path, hash: hashFile(temporary) });

    } finally {
      fs.rmSync(path.dirname(temporary), { recursive: true, force: true });
    }
  }

  return rows;
}


function verifyHealth(baseUrl) {

  const body = command(
    "curl",
    [
      "--fail",
      "--silent",
      "--show-error",
      "--retry", "3",
      "--retry-all-errors",
      "--max-time", "25",
      `${baseUrl}/api/health?deploy-check=${Date.now()}`
    ]
  );

  if (!body.trim()) {
    fail("empty health response");
  }

  let payload;

  try {
    payload = JSON.parse(body);

  } catch {
    fail("health response is not JSON");
  }

  if (payload.ok !== true) {
    fail("health response is not ok");
  }
}


function deploy(options, staticManifest, appManifest) {

  if (process.env.ACID_DEPLOY_NO_NETWORK === "1") {
    fail("network is disabled; refusing --go");
  }

  if (
    options.staticList !== defaults.staticList ||
    options.appList !== defaults.appList
  ) {
    fail("--go requires the fixed static and room-app manifests");
  }

  const staticText = encodeManifest(staticManifest);
  const appText = encodeManifest(appManifest);
  const previousStatic = remoteOptional(
    options.host,
    path.posix.join(options.stateRoot, "static.manifest")
  );
  const previousApp = remoteOptional(
    options.host,
    path.posix.join(options.stateRoot, "room-app.manifest")
  );
  const beforeApp = remoteManifest(
    options.host,
    options.appRoot,
    appManifest,
    "server room-app"
  );
  const appChanged = encodeManifest(
    [...beforeApp].map(([file, hash]) => ({ path: file, hash }))
      .sort((left, right) => left.path.localeCompare(right.path))
  ) !== appText;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backup = path.posix.join(options.backupRoot, stamp);

  console.log(`backup: ${backup}`);
  remote(
    options.host,
    [
      "set -eu",
      `mkdir -p ${shellQuote(path.posix.join(backup, "static"))}`,
      `mkdir -p ${shellQuote(path.posix.join(backup, "room-app"))}`,
      `cp -a ${shellQuote(options.staticRoot)}/. ${shellQuote(path.posix.join(backup, "static"))}/`,
      `cp -a ${shellQuote(options.appRoot)}/. ${shellQuote(path.posix.join(backup, "room-app"))}/`
    ].join("\n")
  );

  console.log("== static itemize ==");
  process.stdout.write(rsyncFiles(
    options.host,
    options.source,
    options.staticRoot,
    staticManifest,
    true
  ));
  console.log("== room-app itemize ==");
  process.stdout.write(rsyncFiles(
    options.host,
    options.source,
    options.appRoot,
    appManifest,
    true
  ));

  process.stdout.write(rsyncFiles(
    options.host,
    options.source,
    options.staticRoot,
    staticManifest,
    false
  ));

  if (appChanged) {
    process.stdout.write(rsyncFiles(
      options.host,
      options.source,
      options.appRoot,
      appManifest,
      false
    ));
  } else {
    console.log("room-app unchanged; container untouched");
  }

  removeStale(
    options.host,
    options.staticRoot,
    staleFromOptional(previousStatic, staticText, "static")
  );
  removeStale(
    options.host,
    options.appRoot,
    staleFromOptional(previousApp, appText, "room-app")
  );

  if (appChanged) {
    remote(
      options.host,
      `docker compose -f ${shellQuote(path.posix.join(options.appRoot, "docker-compose.yml"))} up -d --force-recreate acid-uno`
    );
  }

  const staticServer = remoteManifest(
    options.host,
    options.staticRoot,
    staticManifest,
    "server static"
  );
  const appServer = remoteManifest(
    options.host,
    options.appRoot,
    appManifest,
    "server room-app"
  );
  const staticCurl = curlManifest(options.baseUrl, staticManifest);

  verifyManifests(
    staticText,
    encodeManifest([...staticServer].map(([file, hash]) => ({ path: file, hash }))),
    encodeManifest(staticCurl)
  );
  verifyManifests(
    appText,
    encodeManifest([...appServer].map(([file, hash]) => ({ path: file, hash }))),
    appText
  );
  verifyHealth(options.baseUrl);

  writeRemote(
    options.host,
    path.posix.join(options.stateRoot, "static.manifest"),
    staticText
  );
  writeRemote(
    options.host,
    path.posix.join(options.stateRoot, "room-app.manifest"),
    appText
  );
  console.log("live verify: static local == server == curl; room-app hashes and health match");
}


function parseArgs(raw) {

  const options = { ...defaults, dryRun: false, go: false };

  for (let index = 0; index < raw.length; index += 1) {
    const argument = raw[index];
    const next = () => {
      index += 1;
      if (!raw[index]) fail(`missing value after ${argument}`);
      return raw[index];
    };

    if (argument === "--dry-run") options.dryRun = true;
    else if (argument === "--go") options.go = true;
    else if (argument === "--source") options.source = path.resolve(next());
    else if (argument === "--static-list") options.staticList = path.resolve(next());
    else if (argument === "--app-list") options.appList = path.resolve(next());
    else if (argument === "--stale-plan") options.stalePlan = true;
    else if (argument === "--previous") options.previous = path.resolve(next());
    else if (argument === "--current") options.current = path.resolve(next());
    else if (argument === "--verify-manifests") options.verify = true;
    else if (argument === "--local") options.local = path.resolve(next());
    else if (argument === "--server") options.server = path.resolve(next());
    else if (argument === "--curl") options.curl = path.resolve(next());
    else fail(`unknown argument: ${argument}`);
  }

  return options;
}


function main(options) {

  if (options.stalePlan) {
    const stale = stalePaths(
      fs.readFileSync(options.previous, "utf8"),
      fs.readFileSync(options.current, "utf8")
    );

    process.stdout.write(stale.join("\n") + (stale.length ? "\n" : ""));
    return;
  }

  if (options.verify) {
    verifyManifests(
      fs.readFileSync(options.local, "utf8"),
      fs.readFileSync(options.server, "utf8"),
      fs.readFileSync(options.curl, "utf8")
    );
    console.log("manifests match");
    return;
  }

  const staticEntries = readList(options.staticList, "static");
  const appEntries = readList(options.appList, "room-app");
  const staticManifest = manifestFromList(options.source, staticEntries);
  const appManifest = manifestFromList(options.source, appEntries);

  if (options.go) {
    deploy(options, staticManifest, appManifest);
    return;
  }

  console.log("DRY RUN");
  console.log("network: disabled");

  for (const item of staticManifest) {
    console.log(`itemize static ${item.path}`);
  }

  for (const item of appManifest) {
    console.log(`itemize room-app ${item.path}`);
  }
}


try {
  main(parseArgs(process.argv.slice(2)));

} catch (error) {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
}
