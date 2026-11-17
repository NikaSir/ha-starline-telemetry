"""Browser checks for the production bundle using test Home Assistant data."""

from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1] / "custom_components/starline_telemetry/frontend"
SETUP = """() => {
  customElements.define('ha-icon', class extends HTMLElement {});
  document.head.insertAdjacentHTML('beforeend', `<style>
    body { margin: 0; font-family: system-ui; }
    #host { position: absolute; inset: 0 0 0 auto; width: var(--host-width, 100%); }
    #host.dark { --primary-background-color:#121212; --primary-text-color:#e1e1e1;
      --secondary-text-color:#a0a0a0; --divider-color:#363636; --card-background-color:#1c1c1c; }
    #host.light { --primary-background-color:#f4f5f6; --primary-text-color:#202124;
      --secondary-text-color:#52575c; --divider-color:#dfe3e8; --card-background-color:#fff; }
  </style>`);
  window.states = {};
  window.requestCount = 0;
  window.refreshMode = 'success';
  const roleValues = {
    fuel: ['25', '%'], battery: ['12.3', 'V'], ignition: ['off', null],
    door: ['off', null], hood: ['off', null], trunk: ['off', null],
    armed: ['off', null], engine_temperature: ['47', '°C'],
  };
  const vehicles = ['130', '683'].map((id) => {
    const entities = {};
    for (const [key, [raw, unit]] of Object.entries(roleValues)) {
      const entity = `${unit ? 'sensor' : 'binary_sensor'}.car_${id}_${key}`;
      entities[key] = entity;
      const value = id === '683' && key === 'fuel' ? '57' : raw;
      states[entity] = {state:value, attributes:{unit_of_measurement:unit},
        last_reported:new Date(Date.now() - 60000).toISOString()};
    }
    return {name:`Murano ${id}`, device_id:id, entities,
      fuel_calibration:{status:'ready', unit:'%', entity_id:entities.fuel, factor:1.76,
       consumption:{litres_per_100_km:id === '130' ? 24.5 : 18.5, from_at:'2026-10-24T15:00:00+00:00',
       to_at:'2026-11-12T15:00:00+00:00', litres:30, distance_km:123,
       start:{km:100, reported_at:'2026-10-24T15:00:00+00:00'},
       end:{km:223, reported_at:'2026-11-12T15:00:00+00:00'}}}};
  });
  window.payload = {source:{primary:'core_starline'}, panel:{}, vehicles};
  const callWS = async (message) => {
    if (message.type === 'starline_telemetry/panel/report_times') return {reports:{}};
    if (message.type === 'starline_telemetry/panel/history') return {events:[]};
    if (message.type !== 'starline_telemetry/panel/bootstrap') throw new Error(message.type);
    if (message.force) {
      requestCount++;
      if (refreshMode === 'slow') await new Promise(resolve => window.finishRefresh = resolve);
      if (refreshMode === 'reject') throw new Error('expected loss');
    }
    return {...payload, refresh_ok:message.force && refreshMode !== 'false'};
  };
  window.applyHass = (darkMode, connected=true) => {
     host.className = darkMode ? 'dark' : 'light';
     panel.hass = {themes:{darkMode}, connected, states, callWS, callApi:async () => []};
  };
}"""


MOUNT = """() => {
  window.host = document.body.appendChild(document.createElement('div'));
  host.id = 'host';
  window.panel = document.createElement('starline-app-panel');
  panel.panel = {config:{entry_id:'test', integration_version:'0.7.0-beta008'}};
  window.root = panel.shadowRoot;
  const style = document.createElement('style');
  style.textContent = 'ha-icon{display:inline-block;width:var(--mdc-icon-size,24px);height:var(--mdc-icon-size,24px);background:currentColor;border-radius:20%;mask:radial-gradient(circle, #000 38%, transparent 42%)}';
  root.append(style);
  applyHass(true);
  host.append(panel);
}"""


GEOMETRY = """() => {
  const rect = (node) => node.getBoundingClientRect();
  const get = (selector, context=root) => context.querySelector(selector);
  const title = rect(get('.title-button'));
  const label = get('#starline-versions');
  const range = document.createRange(); range.selectNodeContents(label);
  const text = range.getBoundingClientRect();
  const frame = rect(host);
  const header = rect(get('.app-header'));
  const bottom = rect(get('.bottom-nav'));
  const info = [...root.querySelectorAll('.summary-card')].map(card => {
    const engine = get('.metrics-secondary button:first-of-type strong', card);
    const engineText = document.createRange(); engineText.selectNodeContents(engine);
    const reading = get('.fuel-consumption .metric-reading', card);
    const value = get('.consumption-value', card);
    const unit = get('.consumption-unit', card);
    const heading = get('.identity-heading strong', card);
    const icons = rect(get('.vehicle-indicators', card));
    const name = rect(heading);
    return {
      top:rect(card).top, bottom:rect(card).bottom, engine:engine.textContent,
      engineLines:engineText.getClientRects().length,
      engineClipped:engine.parentElement.scrollWidth > engine.parentElement.clientWidth + 1,
      fuelInline:Math.abs(rect(value).bottom - rect(unit).bottom) < 5,
      fuelFits:reading.scrollWidth <= reading.clientWidth + 1,
      iconsInline:icons.left >= name.right - 1 && Math.abs((name.top + name.bottom - icons.top - icons.bottom) / 2) <= 1,
      headingBox:[name.x, name.y, name.width, name.height], iconBox:[icons.x, icons.y, icons.width, icons.height],
      title:heading.textContent,
    };
  });
  return {width:frame.width, center:Math.abs((frame.left + frame.right - title.left - title.right) / 2),
    versions:label.textContent, versionsFit:text.left >= title.left + 1 && text.right <= title.right - 1,
    titleHeight:title.height, headerHeight:header.height, bottomHeight:bottom.height,
    viewportBottom:rect(get('.viewport')).bottom, info,
    tabsFit:[...root.querySelectorAll('.bottom-nav small')].every(node => node.scrollWidth <= node.clientWidth + 1)};
}"""


def run(browser):
    page = browser.new_page(viewport={"width": 430, "height": 932})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    def asset(route):
        path = ROOT / "assets" / route.request.url.split("/assets/")[1].split("?")[0]
        route.fulfill(path=path)

    page.route("http://starline.test/starline_telemetry_static/assets/*", asset)
    page.route("http://starline.test/starline", lambda route: route.fulfill(body="<!doctype html><html></html>"))
    page.goto("http://starline.test/starline")
    page.evaluate(SETUP)
    page.add_script_tag(path=str(ROOT / "starline-app.js"))
    page.evaluate(MOUNT)
    page.wait_for_function("root.querySelector('.metrics-secondary button:first-of-type strong')?.textContent === 'Выключено'")
    for width, height in [(430, 932), (932, 430), (768, 1024), (1024, 768), (1440, 900), (320, 740)]:
        page.set_viewport_size({"width": width, "height": height})
        for sidebar in ([0, 256] if width >= 768 else [0]):
            for dark in (False, True):
                page.evaluate("([width,dark]) => { host.style.setProperty('--host-width', width+'px'); applyHass(dark); }", [width - sidebar, dark])
                result = page.evaluate(GEOMETRY)
                print(f"{width}x{height} sidebar={sidebar} dark={dark}", flush=True)
                assert result["center"] <= 2 and result["versionsFit"], result
                assert (result["titleHeight"], result["headerHeight"], result["bottomHeight"]) == (52, 60, 64)
                assert all(x["engineLines"] == 1 and not x["engineClipped"] and x["fuelFits"] for x in result["info"]), result
                if width >= 430:
                    assert result["tabsFit"], result
                if width == 430:
                    assert all(x["fuelInline"] and x["iconsInline"] for x in result["info"]), result
                    assert result["info"][-1]["bottom"] <= result["viewportBottom"], result
                expected = "rgb(255, 255, 255)" if dark else "rgb(0, 0, 0)"
                assert page.locator(".refresh").evaluate("e => getComputedStyle(e).color") == expected

    page.set_viewport_size({"width": 430, "height": 932})
    page.evaluate("host.style.setProperty('--host-width','430px'); host.style.top='59px'; host.style.bottom='34px'; applyHass(true)")
    safe_area = page.evaluate(GEOMETRY)
    assert safe_area["info"][-1]["bottom"] <= safe_area["viewportBottom"], safe_area
    page.clock.install()
    icon = page.locator(".refresh ha-icon")
    button = page.locator(".refresh")
    indicators = page.locator('.vehicle-indicators ha-icon')
    assert [indicators.nth(i).get_attribute('icon') for i in range(4)] == [
        'mdi:cloud', 'mdi:check-circle-outline', 'mdi:cloud', 'mdi:check-circle-outline']
    page.evaluate('''() => {
      window.originalIcons = [...root.querySelectorAll('.vehicle-indicators ha-icon')];
      states['sensor.car_683_battery'].last_reported = new Date(Date.now()-31*60000).toISOString();
      applyHass(true);
    }''')
    page.clock.run_for(60)
    assert indicators.nth(3).get_attribute('icon') == 'mdi:clock-alert-outline'
    assert indicators.nth(2).get_attribute('icon') == 'mdi:cloud'
    assert indicators.nth(1).get_attribute('icon') == 'mdi:check-circle-outline'
    page.evaluate("states['sensor.car_683_battery'].state='unavailable'; applyHass(true, false)")
    page.clock.run_for(60)
    assert indicators.nth(2).get_attribute('icon') == 'mdi:cloud-off-outline'
    assert indicators.nth(3).get_attribute('icon') == 'mdi:clock-question-outline'
    page.evaluate('''() => {
      states['sensor.car_683_battery'].state='12.6';
      states['sensor.car_683_battery'].last_reported=new Date().toISOString();
      applyHass(true);
    }''')
    page.clock.run_for(60)
    assert indicators.nth(3).get_attribute('icon') == 'mdi:check-circle-outline'
    assert page.evaluate("originalIcons.every((node,i) => root.querySelectorAll('.vehicle-indicators ha-icon')[i] === node)")

    page.evaluate('''() => {
      window.header = root.querySelector('.app-header');
      window.viewport = root.querySelector('.viewport');
      window.reportTime = root.querySelector('.connection-time').textContent;
      viewport.querySelectorAll('details').forEach(d => d.open = true);
      viewport.scrollTop = 50;
      window.scrollBefore = viewport.scrollTop;
      root.querySelector('.refresh').click();
      panel._refresh();
    }''')
    assert button.is_disabled() and button.get_attribute('aria-busy') == 'true'
    assert page.evaluate("requestCount") == 1
    assert icon.evaluate("e => getComputedStyle(e).animationDuration") == '0.9s'
    page.clock.run_for(910)
    assert icon.get_attribute('icon') == 'mdi:check'
    assert page.evaluate("viewport.scrollTop === scrollBefore && scrollBefore > 0")
    assert page.evaluate("root.querySelector('.connection-time').textContent === reportTime")
    page.clock.run_for(1410)
    assert icon.get_attribute('icon') == 'mdi:refresh'
    assert page.evaluate("header === root.querySelector('.app-header') && viewport === root.querySelector('.viewport')")

    page.emulate_media(reduced_motion='reduce')
    page.evaluate("refreshMode='slow'; root.querySelector('.refresh').click()")
    assert icon.evaluate("e => getComputedStyle(e).animationName") == 'none'
    page.clock.run_for(2000)
    assert button.is_disabled()
    page.evaluate("finishRefresh()")
    page.clock.run_for(20)
    assert icon.get_attribute('icon') == 'mdi:check'
    page.evaluate("refreshMode='false'; root.querySelector('.refresh').click()")
    page.clock.run_for(910)
    assert icon.get_attribute('icon') == 'mdi:alert-circle-outline'
    assert page.locator('.refresh-feedback').is_visible()
    assert page.locator('.refresh-feedback').inner_text() == 'Не удалось обновить данные'
    page.clock.run_for(500)
    assert icon.get_attribute('icon') == 'mdi:alert-circle-outline'
    page.clock.run_for(910)
    assert icon.get_attribute('icon') == 'mdi:refresh'
    page.evaluate("refreshMode='slow'; root.querySelector('.refresh').click(); panel.remove(); finishRefresh()")
    page.clock.run_for(2500)
    assert page.evaluate("root.querySelector('.refresh').getAttribute('data-refresh-state')") == 'idle'
    assert not errors, errors
    print('Chromium: layout, both themes, independent status changes, scroll preservation, refresh states and cleanup passed')


with sync_playwright() as playwright:
    browser = playwright.chromium.launch()
    run(browser)
    browser.close()
