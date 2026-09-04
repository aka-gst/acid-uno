(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.AcidAnalytics = api.create({
    hostname: root.location?.hostname,
    storage: root.localStorage,
    meter: () => root.umami
  });
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const STARTS_KEY = "acid-uno-party-starts";
  const LIVE_HOST = "aka-gst.ru";


  function safeStarts(storage) {
    try {
      const starts = Number.parseInt(storage?.getItem(STARTS_KEY), 10);
      return Number.isSafeInteger(starts) && starts > 0 ? starts : 0;
    } catch {
      return 0;
    }
  }


  function create(options = {}) {
    const isLive = options.hostname === LIVE_HOST;
    const name = event => `${isLive ? "" : "test-"}${event}`;

    function track(event, data) {
      try {
        const meter = options.meter?.();

        if (typeof meter?.track !== "function") {
          return false;
        }

        meter.track(name(event), data);
        return true;
      } catch {
        return false;
      }
    }

    function partyStarted(source) {
      const safeSource = source === "replay" ? "replay" : "lobby";
      const attempt = safeStarts(options.storage) + 1;

      try {
        options.storage?.setItem(STARTS_KEY, String(attempt));
      } catch {}

      return track("acid-uno-party-start", {
        source: safeSource,
        attempt
      });
    }

    return {
      partyStarted
    };
  }


  return {
    STARTS_KEY,
    create
  };
});
