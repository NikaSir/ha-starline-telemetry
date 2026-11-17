const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const bundle = fs.readFileSync("custom_components/starline_telemetry/frontend/starline-app.js", "utf8");
const action = bundle.match(/this\.\$\("\.title-button"\)\.addEventListener\("click", \(\) => ([^;]+)\);/)[1];

for (const stale of ["/dashboard-actions/home", "/dashboard-house-v13/home", "/dashboard-infrastructure/overview"]) {
  const destinations = [];
  const events = [];
  const window = {
    location: { origin: "https://ha.local", pathname: "/starline", search: "?return_to=" + stale, hash: "" },
    history: { pushState(_state, _title, route) { destinations.push(route); } },
    dispatchEvent(event) { events.push(event.type); },
  };
  const context = vm.createContext({
    window, URL, Event, document: { referrer: "https://ha.local" + stale },
    sessionStorage: { getItem: () => stale },
  });
  vm.runInContext(bundle.slice(0, bundle.indexOf("class ZoomController")), context);
  vm.runInContext(action, context);
  assert.deepEqual(destinations, ["/home/overview"], "ambient route must not override StarLine's parent");
  assert.deepEqual(events, ["location-changed"]);
}
console.log("Title parent behavior: 3 conflicting-origin cases passed");
