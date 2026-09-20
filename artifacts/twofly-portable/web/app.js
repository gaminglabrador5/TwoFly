/* TwoFly — simple MSFS mission generator */
(function () {
  const VERSION = "1.5.0";
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  const AIRCRAFT = window.TWOFY_AIRCRAFT || [];

  const US_STATES = [
    ["AL","Alabama"],["AK","Alaska"],["AZ","Arizona"],["AR","Arkansas"],
    ["CA","California"],["CO","Colorado"],["CT","Connecticut"],["DE","Delaware"],
    ["DC","District of Columbia"],["FL","Florida"],["GA","Georgia"],["HI","Hawaii"],
    ["ID","Idaho"],["IL","Illinois"],["IN","Indiana"],["IA","Iowa"],
    ["KS","Kansas"],["KY","Kentucky"],["LA","Louisiana"],["ME","Maine"],
    ["MD","Maryland"],["MA","Massachusetts"],["MI","Michigan"],["MN","Minnesota"],
    ["MS","Mississippi"],["MO","Missouri"],["MT","Montana"],["NE","Nebraska"],
    ["NV","Nevada"],["NH","New Hampshire"],["NJ","New Jersey"],["NM","New Mexico"],
    ["NY","New York"],["NC","North Carolina"],["ND","North Dakota"],["OH","Ohio"],
    ["OK","Oklahoma"],["OR","Oregon"],["PA","Pennsylvania"],["RI","Rhode Island"],
    ["SC","South Carolina"],["SD","South Dakota"],["TN","Tennessee"],["TX","Texas"],
    ["UT","Utah"],["VT","Vermont"],["VA","Virginia"],["WA","Washington"],
    ["WV","West Virginia"],["WI","Wisconsin"],["WY","Wyoming"],
  ];

  const TYPES = [
    { id: "cargo", label: "CARGO", emoji: "" },
    { id: "pax", label: "PAX", emoji: "" },
    { id: "express", label: "EXPRESS", emoji: "" },
    { id: "vip", label: "PRIORITY PAX", emoji: "" },
    { id: "bush", label: "FIELD RESUPPLY", emoji: "" },
    { id: "ferry", label: "REPOSITION", emoji: "" },
  ];

  const HOPS = {
    brief: [18, 55],
    bush: [15, 90],
    short: [70, 220],
    medium: [180, 520],
    long: [450, 1600],
    auto: null,
  };

  const CARGO = [
    "GENERAL CARGO", "SPARE PARTS", "MEDICAL STORES", "SURVEY EQUIPMENT",
    "PROVISIONS", "FUEL DRUMS", "AVIONICS REPLACEMENT", "MAIL SACKS",
    "CONSTRUCTION MATERIAL", "COMMUNICATIONS GEAR",
  ];

  const LANDMARKS = window.TWOFY_LANDMARKS || [];
  const CITIES = window.TWOFY_CITIES || [];
  const PORTS = window.TWOFY_PORTS || [];
  const COUNTRIES = window.TWOFY_COUNTRIES || {
    US: "United States", CA: "Canada", MX: "Mexico", GB: "United Kingdom",
    DE: "Germany", FR: "France", ES: "Spain", IT: "Italy", NL: "Netherlands",
    BE: "Belgium", CH: "Switzerland", AT: "Austria", IE: "Ireland", PT: "Portugal",
    SE: "Sweden", NO: "Norway", DK: "Denmark", FI: "Finland", PL: "Poland",
    CZ: "Czechia", ID: "Indonesia", AU: "Australia", NZ: "New Zealand",
    BR: "Brazil", AR: "Argentina", CL: "Chile", CO: "Colombia", PE: "Peru",
    JP: "Japan", KR: "South Korea", CN: "China", IN: "India", AE: "UAE",
    ZA: "South Africa", KE: "Kenya", EG: "Egypt", TR: "Turkey", GR: "Greece",
    IS: "Iceland", RU: "Russia", PH: "Philippines", TH: "Thailand", VN: "Vietnam",
    MY: "Malaysia", SG: "Singapore", HK: "Hong Kong", TW: "Taiwan",
  };

  let airports = Array.isArray(window.AIRPORTS) ? window.AIRPORTS : [];
  let byId = new Map(airports.filter((a) => a && a.id).map((a) => [a.id, a]));

  const state = {
    dep: byId.get("KSKX") || airports[0],
    ac: AIRCRAFT.find((a) => a.id === "c172g") || AIRCRAFT[0],
    hop: "auto",
    type: "any",
    wantState: "",
    wantCountry: "",
    wantLandmark: "",
    hard: false,
    acFilter: "all",
    acQuery: "",
    acMaker: "",
    owned: loadOwned(),
    missionsBy: { free: [], airline: [] },
    activeBy: { free: null, airline: null },
    missions: [],
    active: null,
    log: loadLog(),
    pedia: loadPedia(),
    collection: null,
    profile: loadProfile(),
    mktQuery: "",
    mktFilter: "all",
    issueN: 5,
    mode: "free",
    pendingClear: "",
  };
  state.collection = emptyCollection();
  useBoard("free");

  function loadLog() {
    try {
      const rows = JSON.parse(localStorage.getItem("twofly-log") || "[]");
      return Array.isArray(rows) ? rows.map(healMission).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  function saveLog() {
    localStorage.setItem("twofly-log", JSON.stringify(state.log.slice(0, 250)));
    localStorage.setItem("twofly-pilot", JSON.stringify(pilotFile()));
    persistStore();
  }

  function pilotFile() {
    const { flown } = flownStats();
    const xp = flown.reduce((s, m) => s + (m.xp || 0), 0);
    const rank = rankFor(xp);
    return {
      v: 1,
      saved: new Date().toISOString(),
      xp,
      rank: rank.name,
      flights: flown.length,
      log: state.log,
      owned: [...state.owned],
    };
  }
  function loadPedia() {
    try {
      const raw = JSON.parse(localStorage.getItem("twofly-pedia") || "{}");
      if (raw && raw["lm:ellis"] && !raw["lm:wtc"]) {
        raw["lm:wtc"] = raw["lm:ellis"];
        delete raw["lm:ellis"];
      }
      if (raw && raw["lm:totempole"] && !raw["lm:monvalley"]) {
        raw["lm:monvalley"] = raw["lm:totempole"];
        delete raw["lm:totempole"];
      }
      return raw && typeof raw === "object" ? raw : {};
    }
    catch { return {}; }
  }
  function savePedia() {
    localStorage.setItem("twofly-pedia", JSON.stringify(state.pedia));
    persistStore();
  }
  function loadActive(mode) {
    const k = mode === "airline" ? "airline" : "free";
    try {
      const keyed = localStorage.getItem("twofly-active-" + k);
      if (keyed) return healMission(JSON.parse(keyed));
      if (k === "free") return healMission(JSON.parse(localStorage.getItem("twofly-active") || "null"));
      return null;
    } catch {
      return null;
    }
  }
  function saveActive() {
    const k = state.mode === "airline" ? "airline" : "free";
    if (state.active) localStorage.setItem("twofly-active-" + k, JSON.stringify(state.active));
    else localStorage.removeItem("twofly-active-" + k);
    persistStore();
  }
  function useBoard(mode) {
    const k = mode === "airline" ? "airline" : "free";
    state.mode = k;
    if (!state.missionsBy[k]) state.missionsBy[k] = [];
    state.missions = state.missionsBy[k];
    state.active = state.activeBy[k] || null;
    document.body.classList.toggle("mode-airline", k === "airline");
  }
  function setMissions(list) {
    const k = state.mode === "airline" ? "airline" : "free";
    state.missionsBy[k] = list;
    state.missions = list;
  }
  function setActive(m) {
    const k = state.mode === "airline" ? "airline" : "free";
    state.activeBy[k] = m || null;
    state.active = m || null;
    saveActive();
  }
  function emptyCollection() {
    return { stamps: [], states: [], countries: [], marks: [], cities: [], ports: [] };
  }
  function loadCollection() {
    try {
      const raw = JSON.parse(localStorage.getItem("twofly-collection") || "null");
      if (raw && typeof raw === "object") {
        return {
          stamps: raw.stamps || [],
          states: raw.states || [],
          countries: raw.countries || [],
          marks: (raw.marks || []).map((id) => (id === "ellis" ? "wtc" : id === "totempole" ? "monvalley" : id)),
          cities: raw.cities || [],
          ports: raw.ports || [],
        };
      }
    } catch {}
    const seeded = unlocksFromFlown((loadLog() || []).filter((m) => m.flown));
    const col = {
      stamps: [...seeded.stamps],
      states: [...seeded.states],
      countries: [...seeded.countries],
      marks: [...seeded.marks],
      cities: [...seeded.cities],
      ports: [...seeded.ports],
    };
    try { localStorage.setItem("twofly-collection", JSON.stringify(col)); } catch {}
    return col;
  }
  function saveCollection() {
    localStorage.setItem("twofly-collection", JSON.stringify(state.collection));
    persistStore();
  }
  function unlocksFromFlown(flown) {
    const stamps = new Set();
    const states = new Set();
    const countries = new Set();
    const marks = new Set();
    const cities = new Set();
    const ports = new Set();
    (flown || []).forEach((m) => {
      if (m.dep && m.dep.id) stamps.add(m.dep.id);
      if (m.dest && m.dest.id) stamps.add(m.dest.id);
      [m.dep, m.dest].forEach((p) => {
        const ap = airportOf(p);
        if (!ap) return;
        LANDMARKS.forEach((lm) => {
          if (haversineNm(ap, lm) <= 20) marks.add(lm.id);
        });
        CITIES.forEach((ct) => {
          if (haversineNm(ap, ct) <= 30) cities.add(ct.id);
        });
        PORTS.forEach((pt) => {
          if (airportHitsPort(ap, pt)) ports.add(pt.id);
        });
      });
    });
    return { stamps, states, countries, marks, cities, ports };
  }
  function mergeUnlocks(src) {
    ["stamps", "states", "countries", "marks", "cities", "ports"].forEach((k) => {
      const set = new Set(state.collection[k] || []);
      const add = src[k];
      if (add && typeof add.forEach === "function") add.forEach((id) => set.add(id));
      state.collection[k] = [...set];
    });
    saveCollection();
  }
  function fieldCaption(a) {
    if (!a) return "";
    if (typeof a === "string") {
      const hit = byId.get(a);
      return hit ? (hit.n || hit.c || a) : a;
    }
    return a.n || a.c || a.id || "";
  }

  function asField(x) {
    if (!x) return null;
    if (typeof x === "string") return byId.get(x) || { id: x, n: x };
    if (typeof x === "object" && x.id) return byId.get(x.id) || x;
    return null;
  }

  function icaoOf(x) {
    const f = asField(x);
    return (f && f.id) ? f.id : "----";
  }

  function healMission(m) {
    if (!m || typeof m !== "object") return null;
    if (m.dep) m.dep = asField(m.dep) || m.dep;
    if (m.dest) m.dest = asField(m.dest) || m.dest;
    return m;
  }

  function payText(m, active) {
    const airline = (m && m.mode === "airline") || state.mode === "airline";
    if (airline) return `${m.xp || xpFor(m)}xp ${moneyFmt(m.money)}`;
    if (active) return "IN PROGRESS";
    return moneyFmt(m.money);
  }
  function loadOwned() {
    try { return new Set(JSON.parse(localStorage.getItem("twofly-owned") || "[]")); }
    catch { return new Set(); }
  }
  function saveOwned() {
    localStorage.setItem("twofly-owned", JSON.stringify([...state.owned]));
    persistStore();
  }

  const LICENSES = [
    { n: 1, name: "STUDENT PILOT", xp: 0, unlock: ["piston", "bush", "vintage", "airship"] },
    { n: 2, name: "PRIVATE PILOT", xp: 2000, unlock: ["helo", "evtol"] },
    { n: 3, name: "COMMERCIAL PILOT", xp: 7000, unlock: ["turboprop"] },
    { n: 4, name: "ATP", xp: 18000, unlock: ["jet", "airliner"] },
  ];

  const PILOT_MARKS = ["1", "2", "3", "4", "5", "6", "7", "8"];

  function defaultProfile() {
    const logXp = (loadLog() || []).filter((m) => m.flown).reduce((s, m) => s + (m.xp || 0), 0);
    return {
      v: 2,
      name: "PILOT",
      airline: "TWOFLY AIR",
      icon: "1",
      iconData: "",
      xp: logXp,
      money: 85000,
      moneyOn: true,
      locksOn: true,
      hangar: ["c172g"],
      showAirline: true,
      hours: {},
      sinceService: {},
      tails: {},
      currency: "USD",
      tempUnit: "C",
      home: "",
      debt: 0,
    };
  }

  function loadProfile() {
    try {
      const raw = JSON.parse(localStorage.getItem("twofly-pilot-file") || "null");
      if (!raw || typeof raw !== "object") return defaultProfile();
      const d = defaultProfile();
      const hangar = Array.isArray(raw.hangar) ? raw.hangar.filter((id) => AIRCRAFT.some((a) => a.id === id)) : d.hangar;
      const sav = Number.isFinite(raw.savings) ? Math.max(0, raw.savings) : 0;
      const money = (Number.isFinite(raw.money) ? raw.money : d.money) + sav;
      const out = {
        ...d,
        ...raw,
        hangar: hangar.length ? hangar : d.hangar,
        money,
        xp: Number.isFinite(raw.xp) ? raw.xp : d.xp,
        showAirline: raw.showAirline !== false,
        hours: raw.hours && typeof raw.hours === "object" ? raw.hours : {},
        sinceService: raw.sinceService && typeof raw.sinceService === "object" ? raw.sinceService : {},
        tails: raw.tails && typeof raw.tails === "object" ? raw.tails : {},
        currency: typeof raw.currency === "string" ? raw.currency : "USD",
        tempUnit: raw.tempUnit === "F" ? "F" : "C",
        home: typeof raw.home === "string" ? raw.home : "",
        debt: Number.isFinite(raw.debt) ? Math.max(0, raw.debt) : (raw.loan && Number.isFinite(raw.loan.remaining) ? Math.max(0, raw.loan.remaining) : 0),
      };
      delete out.savings;
      delete out.loan;
      return out;
    } catch {
      return defaultProfile();
    }
  }

  function saveProfile() {
    localStorage.setItem("twofly-pilot-file", JSON.stringify(state.profile));
    persistStore();
  }

  function licenseFor(xp) {
    let cur = LICENSES[0];
    let next = LICENSES[1] || null;
    for (let i = 0; i < LICENSES.length; i++) {
      if (xp >= LICENSES[i].xp) {
        cur = LICENSES[i];
        next = LICENSES[i + 1] || null;
      }
    }
    return { ...cur, next };
  }

  function unlockedClasses() {
    if (!state.profile.locksOn) return new Set(AIRCRAFT.map((a) => a.cls));
    const lic = licenseFor(state.profile.xp);
    const set = new Set();
    LICENSES.forEach((L) => {
      if (L.n <= lic.n) L.unlock.forEach((c) => set.add(c));
    });
    return set;
  }

  function classUnlocked(cls) {
    return unlockedClasses().has(cls);
  }

  function inHangar(id) {
    return state.profile.hangar.includes(id);
  }

  function airlineEligible(ac) {
    if (!ac) return false;
    const n = (ac.name || "").toLowerCase();
    if (n.includes("glider") || n.includes("sailplane")) return false;
    if ((ac.pax || 0) >= 1) return true;
    if ((ac.pax || 0) === 0 && (ac.payload || 0) >= 4000) return true;
    return false;
  }

  const SERVICE_HRS = 40;
  const HANGAR_CAP = 10;

  function sinceService(id) {
    return (state.profile.sinceService && state.profile.sinceService[id]) || 0;
  }

  function airframeHours(id) {
    return (state.profile.hours && state.profile.hours[id]) || 0;
  }

  function needsService(id) {
    return sinceService(id) >= SERVICE_HRS;
  }

  function repairCost(ac) {
    return Math.max(750, Math.round((listPrice(ac) * 0.02) / 50) * 50);
  }

  function creditLimit() {
    const n = licenseFor(state.profile.xp).n;
    return [80000, 280000, 1400000, 8500000][n - 1] || 80000;
  }

  function creditLeft() {
    return Math.max(0, creditLimit() - (state.profile.debt || 0));
  }

  function parseMoneyIn(raw) {
    const n = Number(String(raw || "").replace(/[^\d.-]/g, ""));
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.round(n / (ccy().rate || 1));
  }

  function loanWithdraw(amt) {
    amt = Math.round(parseMoneyIn(amt) || Number(amt) || 0);
    if (amt <= 0) return "ENTER AMOUNT.";
    if (!state.profile.moneyOn) return "MONEY AWARDS ARE OFF.";
    if (amt > creditLeft()) return "EXCEEDS AVAILABLE CREDIT.";
    state.profile.debt = (state.profile.debt || 0) + amt;
    state.profile.money += amt;
    saveProfile();
    return "";
  }

  function loanRepay(amt) {
    amt = Math.round(parseMoneyIn(amt) || Number(amt) || 0);
    if (amt <= 0) return "ENTER AMOUNT.";
    if (!state.profile.moneyOn) return "MONEY AWARDS ARE OFF.";
    amt = Math.min(amt, state.profile.debt || 0, state.profile.money);
    if (amt <= 0) return "NOTHING TO REPAY.";
    state.profile.debt -= amt;
    state.profile.money -= amt;
    saveProfile();
    return "";
  }

  function repairAircraft(id) {
    const ac = AIRCRAFT.find((a) => a.id === id);
    if (!ac || !inHangar(id)) return "NOT IN HANGAR.";
    if (!needsService(id)) return "SERVICE NOT DUE.";
    const cost = repairCost(ac);
    if (state.profile.moneyOn && state.profile.money < cost) return "INSUFFICIENT FUNDS.";
    if (state.profile.moneyOn) state.profile.money -= cost;
    state.profile.sinceService = state.profile.sinceService || {};
    state.profile.sinceService[id] = 0;
    saveProfile();
    return "";
  }

  function tailOf(id) {
    const t = state.profile.tails && state.profile.tails[id];
    return t ? String(t) : "";
  }

  function setTail(id, v) {
    state.profile.tails = state.profile.tails || {};
    const t = String(v || "").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 10);
    if (t) state.profile.tails[id] = t;
    else delete state.profile.tails[id];
    saveProfile();
  }

  function canSelectAc(ac) {
    if (!ac) return false;
    if (state.mode !== "airline") return true;
    if (!airlineEligible(ac)) return false;
    if (state.profile.locksOn && !classUnlocked(ac.cls)) return false;
    if (!inHangar(ac.id)) return false;
    return true;
  }

  function listPrice(ac) {
    const base = {
      piston: 75000, bush: 55000, vintage: 40000, helo: 240000, evtol: 190000,
      turboprop: 520000, jet: 1400000, airliner: 6500000, airship: 160000,
    }[ac.cls] || 90000;
    return Math.round((base + ac.cruise * 700 + ac.range * 35 + (ac.pax || 0) * 6000 + (ac.payload || 0) * 1.4) / 1000) * 1000;
  }

  const CURRENCIES = [
    { id: "USD", name: "US DOLLAR", sym: "$", rate: 1 },
    { id: "EUR", name: "EURO", sym: "€", rate: 0.92 },
    { id: "GBP", name: "POUND STERLING", sym: "£", rate: 0.79 },
    { id: "CAD", name: "CANADIAN DOLLAR", sym: "C$", rate: 1.37 },
    { id: "AUD", name: "AUSTRALIAN DOLLAR", sym: "A$", rate: 1.52 },
    { id: "NZD", name: "NEW ZEALAND DOLLAR", sym: "NZ$", rate: 1.66 },
    { id: "JPY", name: "YEN", sym: "¥", rate: 148 },
    { id: "CNY", name: "YUAN", sym: "¥", rate: 7.2 },
    { id: "KRW", name: "WON", sym: "₩", rate: 1350 },
    { id: "INR", name: "RUPEE", sym: "₹", rate: 83 },
    { id: "IDR", name: "RUPIAH", sym: "Rp", rate: 15800 },
    { id: "THB", name: "BAHT", sym: "฿", rate: 36 },
    { id: "MYR", name: "RINGGIT", sym: "RM", rate: 4.7 },
    { id: "PHP", name: "PESO", sym: "₱", rate: 56 },
    { id: "VND", name: "DONG", sym: "₫", rate: 25000 },
    { id: "SGD", name: "SINGAPORE DOLLAR", sym: "S$", rate: 1.34 },
    { id: "HKD", name: "HONG KONG DOLLAR", sym: "HK$", rate: 7.8 },
    { id: "TWD", name: "NEW TAIWAN DOLLAR", sym: "NT$", rate: 32 },
    { id: "MXN", name: "MEXICAN PESO", sym: "MX$", rate: 17 },
    { id: "BRL", name: "REAL", sym: "R$", rate: 5.1 },
    { id: "CHF", name: "SWISS FRANC", sym: "CHF ", rate: 0.88 },
    { id: "SEK", name: "KRONA", sym: "kr ", rate: 10.5 },
    { id: "NOK", name: "KRONE", sym: "kr ", rate: 10.7 },
    { id: "DKK", name: "KRONE", sym: "kr ", rate: 6.9 },
    { id: "PLN", name: "ZLOTY", sym: "zł ", rate: 4.0 },
    { id: "CZK", name: "KORUNA", sym: "Kč ", rate: 23 },
    { id: "TRY", name: "LIRA", sym: "₺", rate: 32 },
    { id: "ZAR", name: "RAND", sym: "R", rate: 18.5 },
    { id: "AED", name: "DIRHAM", sym: "AED ", rate: 3.67 },
    { id: "RUB", name: "RUBLE", sym: "₽", rate: 92 },
  ];

  function ccy() {
    const id = state.profile && state.profile.currency;
    return CURRENCIES.find((c) => c.id === id) || CURRENCIES[0];
  }

  function moneyFmt(n) {
    const c = ccy();
    const v = Math.round((Number(n) || 0) * c.rate);
    return c.sym + v.toLocaleString();
  }

  function buyAircraft(id) {
    const ac = AIRCRAFT.find((a) => a.id === id);
    if (!ac) return "AIRCRAFT NOT ON FILE.";
    if (inHangar(id)) return "ALREADY IN HANGAR.";
    if (state.profile.hangar.length >= HANGAR_CAP) return "HANGAR AT CAPACITY (10).";
    if (!airlineEligible(ac)) return "NOT AUTHORIZED FOR PASSENGER OR CARGO SERVICE.";
    if (state.profile.locksOn && !classUnlocked(ac.cls)) return "RANK DOES NOT AUTHORIZE THIS CLASS.";
    const price = listPrice(ac);
    if (!state.profile.moneyOn) {
      state.profile.hangar.push(id);
      saveProfile();
      return "";
    }
    if (state.profile.money < price) return "INSUFFICIENT FUNDS.";
    state.profile.money -= price;
    state.profile.hangar.push(id);
    saveProfile();
    return "";
  }

  function sellAircraft(id) {
    if (!inHangar(id)) return "NOT IN HANGAR.";
    const ac = AIRCRAFT.find((a) => a.id === id);
    const price = ac ? listPrice(ac) : 0;
    const proceeds = Math.round(price * 0.7);
    if (state.profile.moneyOn) state.profile.money += Math.max(0, proceeds);
    state.profile.hangar = state.profile.hangar.filter((x) => x !== id);
    if (state.ac && state.ac.id === id) {
      const next = AIRCRAFT.find((a) => a.id === state.profile.hangar[0]) || AIRCRAFT[0];
      state.ac = next;
      localStorage.setItem("twofly-ac", state.ac.id);
    }
    saveProfile();
    return "";
  }

  function markSrc(id) {
    return "pilots/" + id + ".jpg";
  }

  function iconHtml(profile, cls) {
    const c = cls || "chip-face";
    if (profile.icon === "custom" && profile.iconData) {
      return `<img class="${c}" alt="" src="${profile.iconData}" />`;
    }
    const id = PILOT_MARKS.includes(String(profile.icon)) ? String(profile.icon) : "1";
    return `<img class="${c}" alt="" src="${markSrc(id)}" data-mark="${id}" onerror="window.__twoflyMarkErr(this)" />`;
  }

  window.__twoflyMarkErr = function (img) {
    const id = img.getAttribute("data-mark") || "";
    const src = img.getAttribute("src") || "";
    if (src.includes(".jpg") && !src.includes(".jpeg")) {
      img.src = "pilots/" + id + ".png";
      return;
    }
    if (src.includes(".png")) {
      img.src = "pilots/" + id + ".webp";
      return;
    }
    const span = document.createElement("span");
    span.className = img.className;
    span.textContent = id;
    img.replaceWith(span);
  };

  function haversineNm(a, b) {
    const R = 3440.065;
    const p1 = (a.lat * Math.PI) / 180;
    const p2 = (b.lat * Math.PI) / 180;
    const dp = p2 - p1;
    const dl = ((b.lon - a.lon) * Math.PI) / 180;
    const s =
      Math.sin(dp / 2) ** 2 +
      Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  }

  function heading(a, b) {
    const p1 = (a.lat * Math.PI) / 180;
    const p2 = (b.lat * Math.PI) / 180;
    const dl = ((b.lon - a.lon) * Math.PI) / 180;
    const y = Math.sin(dl) * Math.cos(p2);
    const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
    return (Math.round((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
  }

  function fmtApt(a) {
    if (!a) return "—";
    const city = a.c ? `, ${a.c}` : "";
    return `${a.id}${a.iata ? " / " + a.iata : ""} — ${a.n}${city}`;
  }

  function shortApt(a) {
    return `${a.id}${a.c ? " · " + a.c : ""}`;
  }

  function typeLabel(t) {
    return (a.t === "L" && "Large") || "";
  }
  function fieldKind(a) {
    return { L: "LARGE", M: "MEDIUM", S: "SMALL", W: "WATER", H: "HELIPORT" }[a.t] || a.t;
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function hopRange(ac, hopKey) {
    if (hopKey !== "auto" && HOPS[hopKey]) {
      const [lo, hi] = HOPS[hopKey];
      return [lo, Math.min(hi, ac.range * 0.82)];
    }
    if (ac.cls === "helo" || ac.cls === "evtol") return [8, Math.min(80, ac.range * 0.6)];
    if (ac.cls === "balloon" || ac.cls === "glider") return [5, Math.min(35, ac.range * 0.6)];
    if (ac.cls === "airship") return [12, Math.min(90, ac.range * 0.5)];
    if (ac.cls === "bush" || ac.cls === "vintage") return [15, Math.min(80, ac.range * 0.55)];
    if (ac.cls === "piston") return [18, Math.min(110, ac.range * 0.55)];
    if (ac.cls === "turboprop") return [25, Math.min(180, ac.range * 0.5)];
    if (ac.cls === "jet") return [40, Math.min(280, ac.range * 0.45)];
    return [50, Math.min(350, ac.range * 0.4)];
  }

  function allowedTypes(ac, pref) {
    let pool = TYPES.map((t) => t.id);
    if (ac.cls === "balloon" || ac.cls === "glider") pool = ["ferry"];
    else if (ac.pax === 0) pool = ["cargo", "express", "bush", "ferry"];
    else if (ac.cls === "jet") pool = ["pax", "vip", "cargo", "express", "ferry"];
    else if (ac.cls === "bush" || ac.cls === "vintage") pool = ["bush", "cargo", "pax", "express", "ferry"];
    else if (ac.cls === "helo" || ac.cls === "evtol") pool = ["pax", "cargo", "express", "vip", "ferry"];
    else if (ac.cls === "turboprop" && ac.pax >= 8) pool = ["cargo", "pax", "express", "vip", "ferry"];
    if (pref !== "any" && pool.includes(pref)) return [pref];
    if (pref !== "any") return pool;
    return pool;
  }

  function payloadFor(type, ac) {
    if (type === "ferry") return { kind: "empty", text: "NIL PAYLOAD — REPOSITION", lbs: 0, pax: 0 };
    if (type === "pax" || type === "vip") {
      const max = Math.max(1, ac.pax);
      const n = 1 + Math.floor(Math.random() * max);
      const lbs = n * 190 + Math.floor(Math.random() * 80);
      return { kind: "pax", pax: n, lbs: Math.min(lbs, ac.payload), text: `${n} PAX / ${Math.min(lbs, ac.payload)} LB` };
    }
    const lbs = Math.max(
      40,
      Math.round((0.25 + Math.random() * 0.6) * ac.payload / 10) * 10
    );
    return { kind: "cargo", pax: 0, lbs, text: `${lbs} LB CARGO` };
  }

  function briefing(type, dep, dest, pay, dist) {
    const destName = dest.c || dest.n;
    const co = state.profile.showAirline && state.profile.airline ? state.profile.airline.toUpperCase() + ". " : "";
    const head = `${co}TASKING ${dep.id}–${dest.id}. DIST ${dist} NM. DEST ${destName}.`;
    switch (type) {
      case "cargo":
        return `${head} LOAD ${pay.lbs} LB ${pick(CARGO)}. DELIVER TO RAMP.`;
      case "pax":
        return `${head} EMBARK ${pay.pax} PAX. TRANSPORT TO DESTINATION.`;
      case "express":
        return `${head} PRIORITY CONSIGNMENT ${pay.lbs} LB. ON-BLOCK TIME IS BINDING.`;
      case "vip":
        return `${head} PRIORITY PERSONNEL ${pay.pax} PAX. STABILIZED APPROACH REQUIRED.`;
      case "bush":
        return `${head} FIELD RESUPPLY ${pay.lbs} LB. SURFACE: ${dest.pv ? "PAVED" : "UNPAVED"}.`;
      case "ferry":
        return `${head} NIL PAYLOAD. REPOSITION AIRCRAFT. FUEL FOR LEG PLUS RESERVE.`;
      default:
        return `${head}`;
    }
  }

  function payout(type, dist, pay, ac) {
    const base = { cargo: 1.8, pax: 2.4, express: 2.8, vip: 3.6, bush: 2.6, ferry: 1.1 }[type] || 2;
    const classMult = { piston: 1, bush: 1.1, turboprop: 1.4, jet: 2.2, airliner: 3.4, helo: 1.6 }[ac.cls] || 1;
    const load = pay.lbs * 0.09 + pay.pax * 85;
    return Math.round((280 + dist * base + load) * classMult / 5) * 5;
  }

  function constraints(ac, dest, type) {
    const bits = [];
    if (dest.rw) bits.push(`DEST RWY ${dest.rw.toLocaleString()} FT`);
    bits.push(dest.pv ? "PAVED" : "UNPAVED / UNKNOWN");
    if (dest.lt) bits.push("LIGHTING LISTED");
    if (dest.el && dest.el > 5000) bits.push(`ELEV ${dest.el.toLocaleString()} FT`);
    if (ac.minRwy && dest.rw && dest.rw < ac.minRwy + 400) bits.push("MARGINAL LANDING DISTANCE");
    if (type === "vip") bits.push("STABILIZED APPROACH");
    if (type === "express") bits.push("TIME CRITICAL");
    LANDMARKS.forEach((lm) => {
      if (haversineNm(dest, lm) <= 20) bits.push(`LANDMARK ${lm.n} ${Math.round(haversineNm(dest, lm))} NM`);
    });
    return bits;
  }

  function cruiseAlt(ac, dist, dep, dest) {
    const elev = Math.max(dep.el || 0, dest.el || 0);
    if (ac.cls === "helo") return Math.min(4500 + elev, 9000);
    if (ac.cls === "bush" || ac.cls === "piston") {
      const cap = ac.cruise > 160 ? 12500 : 9500;
      return Math.min(Math.max(4500, elev + 2500 + Math.round(dist / 40) * 500), cap);
    }
    if (ac.cls === "turboprop") return Math.min(Math.max(10000, elev + 4000), 25000);
    if (ac.cls === "jet" || ac.cls === "airliner") return dist > 400 ? 37000 : 28000;
    return 8500;
  }

  function generate() {
    const dep = state.dep;
    const ac = state.ac;
    if (!dep || !ac) return [];
    if (needsService(ac.id)) return [];
    const [minNm, maxNm] = hopRange(ac, state.hop);
    const types = allowedTypes(ac, state.type);
    const needPaved = state.hard || (ac.paved && state.hop !== "bush" && ac.cls !== "bush" && ac.cls !== "helo");
    const helo = ac.cls === "helo";
    const n = state.issueN === 1 || state.issueN === 3 ? state.issueN : 5;

    const candidates = [];
    for (const a of airports) {
      if (a.id === dep.id) continue;
      if (needPaved && !a.pv) continue;
      if (!helo && a.t === "H") continue;
      if (!helo && ac.minRwy && a.rw && a.rw < ac.minRwy) continue;
      if (ac.cls === "airliner" && a.t === "S") continue;
      const d = haversineNm(dep, a);
      if (d < minNm || d > maxNm) continue;
      if (d > ac.range * 0.85) continue;
      candidates.push({ a, d });
    }

    if (candidates.length < 3) {
      // relax paved / min distance a little
      for (const a of airports) {
        if (a.id === dep.id) continue;
        if (!helo && ac.minRwy && a.rw && a.rw < ac.minRwy * 0.85) continue;
        const d = haversineNm(dep, a);
        if (d < Math.max(12, minNm * 0.5) || d > Math.max(maxNm * 1.3, 80)) continue;
        if (d > ac.range * 0.9) continue;
        candidates.push({ a, d });
      }
    }

    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    const briefNm = Math.max(18, ac.cruise * 0.35);
    const midNm = Math.max(briefNm + 10, ac.cruise * 0.7);
    const brief = candidates.filter((c) => c.d <= briefNm);
    const mid = candidates.filter((c) => c.d > briefNm && c.d <= midNm);
    const rest = candidates.filter((c) => c.d > midNm);
    const ordered = [];
    const take = (arr, n) => {
      for (const c of arr) {
        if (ordered.length >= n) break;
        if (!ordered.includes(c)) ordered.push(c);
      }
    };
    take(brief, n >= 5 ? 2 : n >= 3 ? 1 : 1);
    take(mid, n >= 5 ? 2 : n >= 3 ? 1 : 0);
    take(rest, n >= 5 ? 1 : n >= 3 ? 1 : 0);
    take(candidates, n);
    candidates.length = 0;
    candidates.push(...ordered);

    const used = new Set();
    const out = [];
    for (const c of candidates) {
      if (out.length >= n) break;
      if (used.has(c.a.id)) continue;
      used.add(c.a.id);
      const type = pick(types);
      const dist = Math.round(c.d);
      const hdg = heading(dep, c.a);
      const pay = payloadFor(type, ac);
      const eteMin = Math.max(12, Math.round((dist / ac.cruise) * 60 + 12));
      const alt = cruiseAlt(ac, dist, dep, c.a);
      const money = payout(type, dist, pay, ac);
      const xp = xpFor({ type, dist, pay });
      out.push({
        id: `${Date.now().toString(36)}-${c.a.id}-${out.length}`,
        type,
        dep,
        dest: c.a,
        dist,
        hdg,
        pay,
        eteMin,
        alt,
        money,
        xp,
        mode: state.mode,
        constraints: constraints(ac, c.a, type),
        brief: briefing(type, dep, c.a, pay, dist),
        ac: ac.id,
        acName: ac.name,
        acTail: tailOf(ac.id),
      });
    }
    return out;
  }

  function missionText(m) {
    const t = TYPES.find((x) => x.id === m.type);
    return [
      `TWOFLY DISPATCH`,
      `${(t && t.label) || m.type}  ·  ${icaoOf(m.dep)} ${fieldCaption(m.dep)} → ${icaoOf(m.dest)} ${fieldCaption(m.dest)}  ·  ${m.dist} nm  ·  hdg ${String(m.hdg).padStart(3, "0")}°`,
      `Aircraft: ${m.acName}${m.acTail ? "  " + m.acTail : ""}`,
      `Payload: ${m.pay.text}`,
      `Suggested: ${m.alt.toLocaleString()} ft · ETE ~${fmtEte(m.eteMin)}`,
      `Dest: ${m.dest.n}${m.dest.c ? " / " + m.dest.c : ""} (${fieldKind(m.dest)}, rwy ${m.dest.rw || "?"} ft)`,
      `Quote: $${m.money.toLocaleString()}  ·  XP: ${m.xp || xpFor(m)}`,
      ``,
      m.brief,
      ``,
      `Notes: ${m.constraints.join(" · ")}`,
    ].join("\n");
  }

  function fmtEte(min) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m} min`;
  }

  const RANKS = LICENSES.map((L) => ({ xp: L.xp, name: L.name, n: L.n }));

  function rankFor(xp) {
    const lic = licenseFor(xp);
    return { ...lic, xp, next: lic.next ? { name: lic.next.name, xp: lic.next.xp } : null };
  }

  function titleFor() {
    return rankFor(state.profile.xp).name;
  }

  function totalXp() {
    return state.profile.xp || 0;
  }

  function xpFor(m) {
    const distXp = m.dist * 2;
    const loadXp = (m.pay?.pax || 0) * 12 + Math.round((m.pay?.lbs || 0) / 25);
    const mult = { cargo: 1, pax: 1.1, express: 1.25, vip: 1.35, bush: 1.2, ferry: 0.7 }[m.type] || 1;
    let xp = Math.round((distXp + loadXp) * mult);
    return Math.max(8, xp);
  }

  function dayKey(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function hopOf(dist) {
    if (dist < 90) return "bush";
    if (dist < 220) return "short";
    if (dist < 520) return "medium";
    return "long";
  }

  const wxCache = new Map();

  function parseMetarTemp(t) {
    if (!t) return null;
    if (t[0] === "M") return -parseInt(t.slice(1), 10);
    return parseInt(t, 10);
  }

  function useF() {
    return state.profile && state.profile.tempUnit === "F";
  }

  function fmtTempNum(c) {
    if (c == null || Number.isNaN(c)) return null;
    return useF() ? Math.round((c * 9) / 5 + 32) : Math.round(c);
  }

  function fmtTempPair(t, dp) {
    const a = fmtTempNum(t);
    if (a == null) return "—";
    const u = useF() ? "°F" : "°C";
    const b = fmtTempNum(dp);
    return b == null ? `${a} ${u}` : `${a} / ${b} ${u}`;
  }

  function flightCat(visSm, ceilingFt) {
    const vis = visSm == null ? 99 : visSm;
    const c = ceilingFt == null ? 99999 : ceilingFt;
    if (c < 500 || vis < 1) return "LIFR";
    if (c < 1000 || vis < 3) return "IFR";
    if (c < 3000 || vis <= 5) return "MVFR";
    return "VFR";
  }

  function decodeMetar(raw) {
    const out = { wind: "—", vis: "—", sky: "—", wx: "NIL", temp: "—", qnh: "—", cat: "—" };
    if (!raw) return out;
    const wind = raw.match(/\b(\d{3}|VRB)(\d{2,3})(G(\d{2,3}))?KT\b/);
    if (/\b00000KT\b/.test(raw)) out.wind = "CALM";
    else if (wind) {
      const dir = wind[1];
      out.wind = wind[4] ? `${dir}/${wind[2]}G${wind[4]} KT` : `${dir}/${wind[2]} KT`;
    }
    let visSm = null;
    const visP = raw.match(/\b(\d{1,2})(?:\s+(\d\/\d))?SM\b/) || raw.match(/\b(\d\/\d)SM\b/);
    if (/\bP6SM\b/.test(raw) || /\b10SM\b/.test(raw)) {
      visSm = 10;
      out.vis = "10+ SM";
    } else if (visP) {
      visSm = visP[2] ? parseInt(visP[1], 10) + 0.5 : visP[1].includes("/") ? 0.5 : parseInt(visP[1], 10);
      out.vis = (visP[0] || visP[1] + "SM").replace("SM", " SM");
    }
    const layers = [...raw.matchAll(/\b(FEW|SCT|BKN|OVC|VV)(\d{3})\b/g)];
    if (/\b(CLR|SKC|CAVOK|NSC)\b/.test(raw)) out.sky = (raw.match(/\b(CLR|SKC|CAVOK|NSC)\b/) || [])[1];
    else if (layers.length) out.sky = layers.map((m) => m[0]).join(" ");
    let ceiling = null;
    layers.forEach((m) => {
      if (m[1] === "BKN" || m[1] === "OVC" || m[1] === "VV") {
        const ft = parseInt(m[2], 10) * 100;
        if (ceiling == null || ft < ceiling) ceiling = ft;
      }
    });
    const wxg = [...raw.matchAll(/\s([+-]?(?:VC)?(?:MI|PR|BC|DR|BL|SH|TS|FZ)?(?:DZ|RA|SN|SG|IC|PL|GR|GS|UP|BR|FG|FU|VA|DU|SA|HZ|PO|SQ|FC|SS|DS)+)\b/g)];
    if (wxg.length) out.wx = wxg.map((m) => m[1]).join(" ");
    const td = raw.match(/\b(M?\d{2})\/(M?\d{2})\b/);
    if (td) {
      out.tempC = parseMetarTemp(td[1]);
      out.dewC = parseMetarTemp(td[2]);
    }
    const a = raw.match(/\bA(\d{4})\b/);
    const q = raw.match(/\bQ(\d{4})\b/);
    if (a) out.qnh = (parseInt(a[1], 10) / 100).toFixed(2) + " inHg";
    else if (q) out.qnh = q[1] + " hPa";
    out.cat = flightCat(visSm, ceiling);
    return out;
  }

  let wxOfflineFlag = false;

  function weatherOffline() {
    return (typeof navigator !== "undefined" && navigator.onLine === false) || wxOfflineFlag;
  }

  async function fetchMetarLine(id) {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      wxOfflineFlag = true;
      return "";
    }
    try {
      const r = await fetch("https://metar.vatsim.net/" + encodeURIComponent(id), { cache: "no-store" });
      wxOfflineFlag = false;
      if (!r.ok) return "";
      const t = (await r.text()).trim();
      if (!t || t.toUpperCase().includes("NO METAR") || t.length < 10) return "";
      if (!/[A-Z0-9]{4}\s+\d{6}Z/.test(t) && !/^METAR\s/.test(t)) return "";
      return t.replace(/^METAR\s+/, "");
    } catch {
      wxOfflineFlag = true;
      return "";
    }
  }

  function nearbyStations(ap) {
    return airports
      .filter((x) => x.id && x.id.length === 4 && x.id !== ap.id && x.lat != null)
      .map((x) => ({ ap: x, d: haversineNm(ap, x) }))
      .filter((x) => x.d <= 60)
      .sort((a, b) => a.d - b.d)
      .slice(0, 8);
  }

  async function modelObs(ap) {
    const url =
      "https://api.open-meteo.com/v1/forecast?latitude=" +
      ap.lat +
      "&longitude=" +
      ap.lon +
      "&current=temperature_2m,relative_humidity_2m,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility,weather_code" +
      "&wind_speed_unit=kn&temperature_unit=celsius&pressure_unit=hpa";
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error("model");
    const j = await r.json();
    const c = j.current || {};
    const visSm = c.visibility != null ? Math.round((c.visibility / 1609.34) * 10) / 10 : null;
    const cover = c.cloud_cover;
    let sky = "—";
    if (cover != null) {
      if (cover < 10) sky = "CLR";
      else if (cover < 25) sky = "FEW";
      else if (cover < 50) sky = "SCT";
      else if (cover < 90) sky = "BKN";
      else sky = "OVC";
    }
    const dir = c.wind_direction_10m != null ? String(Math.round(c.wind_direction_10m / 10) * 10).padStart(3, "0") : "VRB";
    const spd = c.wind_speed_10m != null ? String(Math.round(c.wind_speed_10m)).padStart(2, "0") : "00";
    const gst = c.wind_gusts_10m != null && c.wind_gusts_10m >= (c.wind_speed_10m || 0) + 5 ? "G" + String(Math.round(c.wind_gusts_10m)).padStart(2, "0") : "";
    return {
      source: "model",
      id: ap.id,
      nm: 0,
      raw: "",
      dec: {
        wind: `${dir}/${spd}${gst} KT`,
        vis: visSm != null ? visSm + " SM" : "—",
        sky,
        wx: weatherCodeText(c.weather_code),
        tempC: c.temperature_2m != null ? Math.round(c.temperature_2m) : null,
        dewC: null,
        qnh: c.pressure_msl != null ? Math.round(c.pressure_msl) + " hPa" : "—",
        cat: flightCat(visSm, cover >= 90 ? 2000 : cover >= 50 ? 4000 : 99999),
      },
    };
  }

  function weatherCodeText(code) {
    const map = {
      0: "NIL",
      1: "FAIR",
      2: "PARTLY CLOUDY",
      3: "OVERCAST",
      45: "FG",
      48: "FZFG",
      51: "-DZ",
      61: "-RA",
      63: "RA",
      65: "+RA",
      71: "-SN",
      73: "SN",
      75: "+SN",
      80: "-SHRA",
      81: "SHRA",
      95: "TSRA",
    };
    return map[code] || "NIL";
  }

  async function observationFor(ap) {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      wxOfflineFlag = true;
      const e = new Error("offline");
      e.offline = true;
      throw e;
    }
    const own = await fetchMetarLine(ap.id);
    if (own) return { source: "metar", id: ap.id, nm: 0, raw: own, dec: decodeMetar(own) };
    const near = nearbyStations(ap);
    const texts = await Promise.all(
      near.map((n) => fetchMetarLine(n.ap.id).then((t) => ({ id: n.ap.id, nm: n.d, t })))
    );
    const hit = texts.find((x) => x.t);
    if (hit) return { source: "metar", id: hit.id, nm: Math.round(hit.nm), raw: hit.t, dec: decodeMetar(hit.t) };
    if (weatherOffline()) {
      const e = new Error("offline");
      e.offline = true;
      throw e;
    }
    return modelObs(ap);
  }

  function renderWxBody(ap, obs, err, slot) {
    const isArr = slot === "arr";
    const box = $(isArr ? "#wx-arr-body" : "#wx-body");
    const meta = $(isArr ? "#wx-arr-meta" : "#wx-meta");
    if (!box) return;
    if (!ap) {
      if (meta) meta.textContent = isArr ? "NO DESTINATION" : "SELECT AIRFIELD";
      box.innerHTML = `<p class="muted">${isArr ? "ISSUE OR SELECT A TASKING." : "NO AIRFIELD SELECTED."}</p>`;
      return;
    }
    if (err) {
      if (meta) meta.textContent = ap.id;
      const offline = err === true ? weatherOffline() : !!(err && err.offline) || weatherOffline();
      box.innerHTML = `<p class="muted">${offline ? "WEATHER SYSTEM OFFLINE." : "NO OBSERVATION ON FILE."}</p>
        <button type="button" class="ghost tiny" data-wx-refresh="${isArr ? "arr" : "dep"}">REFRESH</button>`;
      return;
    }
    const d = obs.dec;
    const from =
      obs.source === "model"
        ? "AREA MODEL. NO METAR ON FILE."
        : obs.nm
          ? `OBS FROM ${obs.id} · ${obs.nm} NM`
          : `OBS ${obs.id}`;
    if (meta) meta.textContent = ap.id + (ap.n ? " · " + ap.n : "");
    box.innerHTML = `
      <p class="wx-from">${from}</p>
      <div class="wx-grid">
        <div><span>WIND</span><b>${d.wind}</b></div>
        <div><span>VIS</span><b>${d.vis}</b></div>
        <div><span>SKY</span><b>${d.sky}</b></div>
        <div><span>WX</span><b>${d.wx}</b></div>
        <div><span>TEMP / DP</span><b>${fmtTempPair(d.tempC, d.dewC)}</b></div>
        <div><span>QNH</span><b>${d.qnh}</b></div>
        <div><span>CATEGORY</span><b class="wx-cat cat-${d.cat}">${d.cat}</b></div>
      </div>
      ${obs.raw ? `<pre class="wx-raw">${obs.raw}</pre>` : ""}
      <button type="button" class="ghost tiny" data-wx-refresh="${isArr ? "arr" : "dep"}">REFRESH</button>`;
  }

  async function loadWx(ap, force, slot) {
    slot = slot || "dep";
    const box = $(slot === "arr" ? "#wx-arr-body" : "#wx-body");
    if (!ap) {
      renderWxBody(null, null, false, slot);
      return;
    }
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      wxOfflineFlag = true;
      renderWxBody(ap, null, { offline: true }, slot);
      return;
    }
    if (box) box.innerHTML = `<p class="muted">RETRIEVING OBSERVATION.</p>`;
    const key = ap.id;
    const hit = wxCache.get(key);
    if (!force && hit && Date.now() - hit.at < 5 * 60 * 1000) {
      renderWxBody(ap, hit.obs, false, slot);
      return;
    }
    try {
      const obs = await observationFor(ap);
      wxCache.set(key, { at: Date.now(), obs });
      renderWxBody(ap, obs, false, slot);
    } catch (e) {
      renderWxBody(ap, null, e && e.offline ? e : true, slot);
    }
  }

  function destWxBits(dest) {
    if (!dest) return "";
    const hit = wxCache.get(dest.id);
    if (!hit || !hit.obs || !hit.obs.dec) return "";
    const d = hit.obs.dec;
    return `<span class="wx-cat cat-${d.cat}">${d.cat}</span><span>${d.wind}</span><span>${d.vis}</span>`;
  }

  function ttfBits(acId) {
    if (!acId) return "";
    if (needsService(acId)) return `<span class="svc-due">SERVICE DUE</span>`;
    const left = Math.max(0, SERVICE_HRS - sinceService(acId));
    return `<span>TTF ${left.toFixed(1)} HR</span>`;
  }

  function icaoJump(ap) {
    if (!ap || !ap.id) return "";
    return `<button type="button" class="icao-jump" data-icao="${ap.id}">${ap.id}</button>`;
  }

  async function fillDestWx(missions) {
    const list = missions || [];
    const uniq = [];
    const seen = new Set();
    list.forEach((m) => {
      if (m.dest && m.dest.id && !seen.has(m.dest.id)) {
        seen.add(m.dest.id);
        uniq.push(m.dest);
      }
    });
    await Promise.all(
      uniq.map(async (ap) => {
        const hit = wxCache.get(ap.id);
        if (hit && Date.now() - hit.at < 5 * 60 * 1000) return;
        try {
          const obs = await observationFor(ap);
          wxCache.set(ap.id, { at: Date.now(), obs });
        } catch {}
      })
    );
    renderMissions();
    if (state.active && state.active.dest) loadWx(state.active.dest, false, "arr");
    else if (list[0] && list[0].dest) loadWx(list[0].dest, false, "arr");
  }

  function setAirports(list) {
    airports = (list || []).filter((a) => a && a.id);
    byId = new Map(airports.map((a) => [a.id, a]));
    const saved = (() => { try { return localStorage.getItem("twofly-dep"); } catch (e) { return ""; } })();
    if (!state.dep || !byId.get(state.dep.id)) {
      state.dep = (saved && byId.get(saved)) || byId.get("KSKX") || airports[0] || null;
    } else {
      state.dep = byId.get(state.dep.id) || state.dep;
    }
    const n = $("#field-count");
    if (n) n.textContent = airports.length.toLocaleString() + " AIRFIELDS ON FILE";
    try { renderDep(); } catch (e) {}
    try { renderHome(); } catch (e) {}
  }

  function loadAirports() {
    const n = $("#field-count");
    if (n && !airports.length) n.textContent = "LOADING AIRFIELDS…";
    return fetch("airports.json?v=" + VERSION, { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (data) {
        if (Array.isArray(data) && data.length) setAirports(data);
        else if (n) n.textContent = "0 AIRFIELDS ON FILE";
      })
      .catch(function () {
        if (n && !airports.length) n.textContent = "AIRFIELDS FAILED TO LOAD";
      });
  }

  function airportOf(a) {
    if (!a) return null;
    if (typeof a === "string") return byId.get(a) || null;
    return byId.get(a.id) || a;
  }

  function usStateOf(a) {
    const ap = airportOf(a);
    if (!ap || ap.cc !== "US") return null;
    const rg = (ap.rg || "").toUpperCase();
    if (US_STATES.some(([c]) => c === rg)) return rg;
    return null;
  }

  function flownStats() {
    const flown = state.log.filter((m) => m.flown);
    const stamps = new Set();
    const types = new Set();
    const makers = new Set();
    const states = new Set();
    const countries = new Set();
    const marks = new Set();
    const cities = new Set();
    const ports = new Set();
    flown.forEach((m) => {
      if (m.dep?.id) stamps.add(m.dep.id);
      if (m.dest?.id) stamps.add(m.dest.id);
      if (m.type) types.add(m.type);
      const ac = AIRCRAFT.find((a) => a.id === m.ac);
      if (ac) makers.add(ac.maker);
      [m.dep, m.dest].forEach((p) => {
        const ap = airportOf(p);
        if (!ap) return;
        const st = usStateOf(ap);
        if (st) states.add(st);
        if (ap.cc) countries.add(ap.cc);
        LANDMARKS.forEach((lm) => {
          if (haversineNm(ap, lm) <= 20) marks.add(lm.id);
        });
        CITIES.forEach((ct) => {
          if (haversineNm(ap, ct) <= 30) cities.add(ct.id);
        });
        PORTS.forEach((pt) => {
          if (airportHitsPort(ap, pt)) ports.add(pt.id);
        });
      });
    });
    return { flown, stamps, types, makers, states, countries, marks, cities, ports };
  }

  function portKeys(pt) {
    return new Set([pt.id, pt.icao, ...(pt.aliases || [])].filter(Boolean).map((s) => String(s).toUpperCase()));
  }

  function airportHitsPort(ap, pt) {
    if (!ap || !pt) return false;
    const keys = portKeys(pt);
    return keys.has(String(ap.id || "").toUpperCase()) || keys.has(String(ap.icao || "").toUpperCase());
  }

  function badges() {
    const { flown, types, makers } = flownStats();
    const marks = new Set(state.collection.marks || []);
    const stamps = new Set(state.collection.stamps || []);
    const cities = new Set(state.collection.cities || []);
    const ports = new Set(state.collection.ports || []);
    const today = dayKey();
    const todayFlights = flown.filter((m) => m.flownAt && m.flownAt.slice(0, 10) === today);
    const list = [
      { id: "first", have: flown.length >= 1, label: "FIRST SORTIE", info: "Complete and log one accepted tasking." },
      { id: "five", have: flown.length >= 5, label: "5 SORTIES", info: "Log five completed taskings." },
      { id: "twenty", have: flown.length >= 20, label: "20 SORTIES", info: "Log twenty completed taskings." },
      { id: "fields10", have: stamps.size >= 10, label: "10 AIRFIELDS", info: "Depart or arrive at ten distinct airfields." },
      { id: "fields25", have: stamps.size >= 25, label: "25 AIRFIELDS", info: "Depart or arrive at twenty-five distinct airfields." },
      { id: "long", have: flown.some((m) => m.dist >= 300), label: "300 NM LEG", info: "Complete one tasking of 300 nautical miles or more." },
      { id: "high", have: flown.some((m) => (m.dest?.el || 0) >= 5000), label: "HIGH ELEVATION", info: "Land at a destination 5,000 feet MSL or higher." },
      { id: "soft", have: flown.some((m) => m.dest && !m.dest.pv), label: "UNPAVED DEST", info: "Complete a tasking to an unpaved destination." },
      { id: "types", have: types.size >= 5, label: "FIVE CATEGORIES", info: "Log at least one sortie in five different task categories." },
      { id: "multi", have: makers.size >= 5, label: "FIVE MANUFACTURERS", info: "Complete sorties in aircraft from five manufacturers." },
      { id: "busy", have: todayFlights.length >= 3, label: "THREE THIS DATE", info: "Log three completed sorties on the same calendar date." },
      { id: "lm5", have: marks.size >= 5, label: "5 LANDMARKS", info: "Complete a sortie within 20 NM of five landmarks." },
      { id: "lm25", have: marks.size >= 25, label: "25 LANDMARKS", info: "Complete sorties within 20 NM of twenty-five landmarks." },
      { id: "city5", have: cities.size >= 5, label: "5 CITIES", info: "Complete a sortie within 30 NM of five listed cities." },
      { id: "city20", have: cities.size >= CITIES.length, label: `${CITIES.length} CITIES`, info: `Complete sorties within 30 NM of all ${CITIES.length} listed cities.` },
      { id: "ap5", have: ports.size >= 5, label: "5 AIRPORTS", info: "Complete a sortie at five listed airports." },
      { id: "apall", have: ports.size >= PORTS.length && PORTS.length > 0, label: "AIRPORT SET", info: "Complete a sortie at every listed airport postcard field." },
    ];
    return { list, title: rankFor(totalXp()).name };
  }

  function openConfirm(kind) {
    state.pendingClear = kind;
    const title = $("#confirm-title");
    const copy = $("#confirm-copy");
    const yes = $("#confirm-yes");
    if (kind === "book") {
      if (title) title.textContent = "CLEAR COLLECTABLES";
      if (copy) copy.textContent = "THIS ERASES POSTMARKS, POSTCARDS, AIRFIELD MARKS, AND ENCYCLOPEDIA PAGES ON THIS INSTALLATION. THE SORTIE LOG IS NOT AFFECTED.";
      if (yes) yes.textContent = "CLEAR";
    } else if (kind === "complete") {
      if (title) title.textContent = "COMPLETE SORTIE";
      if (copy) copy.textContent = "MARK THIS TASKING COMPLETE. PAY AND COLLECTABLES WILL POST TO THE PILOT FILE.";
      if (yes) yes.textContent = "COMPLETE";
    } else if (kind === "abort") {
      if (title) title.textContent = "ABORT SORTIE";
      if (copy) copy.textContent = "RELEASE THIS TASKING. PAY AND COLLECTABLES WILL NOT POST.";
      if (yes) yes.textContent = "ABORT";
    } else if (kind === "all") {
      if (title) title.textContent = "CLEAR ALL PROGRESS";
      if (copy) copy.textContent = "THIS PERMANENTLY ERASES THE PILOT FILE, HANGAR, MONEY, XP, CERTIFICATES, SORTIE LOG, COLLECTABLES, AND ACTIVE TASKINGS ON THIS INSTALLATION. EXPORT A BACKUP FIRST IF YOU WANT TO KEEP THEM. THIS CANNOT BE UNDONE.";
      if (yes) yes.textContent = "CLEAR ALL";
    } else {
      if (title) title.textContent = "CLEAR SORTIE LOG";
      if (copy) copy.textContent = "THIS ERASES THE SORTIE LOG ON THIS INSTALLATION. COLLECTABLES ARE NOT AFFECTED. THE ACTIVE SORTIE IS NOT CLEARED.";
      if (yes) yes.textContent = "CLEAR";
    }
    $("#confirm").hidden = false;
  }

  function acceptMission(m) {
    if (state.active) return;
    const acId = m.ac || (state.ac && state.ac.id);
    if (acId && needsService(acId)) return;
    setActive({ ...m, acceptedAt: new Date().toISOString(), mode: m.mode || state.mode });
    renderActive();
    renderMissions();
    if (m.dest) loadWx(m.dest, false, "arr");
  }

  function abortMission() {
    setActive(null);
    renderActive();
    renderMissions();
    if (state.missions[0] && state.missions[0].dest) loadWx(state.missions[0].dest, false, "arr");
    else loadWx(null, false, "arr");
  }

  function completeMission() {
    if (!state.active) return;
    const m = state.active;
    const before = {
      marks: new Set(state.collection.marks || []),
      cities: new Set(state.collection.cities || []),
      ports: new Set(state.collection.ports || []),
    };
    markFlown(m);
    setActive(null);
    renderActive();
    renderMissions();
    loadWx(null, false, "arr");
    const afterMarks = new Set(state.collection.marks || []);
    const afterPorts = new Set(state.collection.ports || []);
    const afterCities = new Set(state.collection.cities || []);
    const newLm = [...afterMarks].find((id) => !before.marks.has(id));
    const newAp = [...afterPorts].find((id) => !before.ports.has(id));
    const newCy = [...afterCities].find((id) => !before.cities.has(id));
    if (newLm) openPedia("lm", newLm);
    else if (newAp) openPedia("ap", newAp);
    else if (newCy) openPedia("cy", newCy);
  }

  function wikiTitle(kind, id) {
    if (kind === "st") {
      const row = US_STATES.find(([c]) => c === id);
      return row ? row[1] : id;
    }
    if (kind === "cc") return COUNTRIES[id] || id;
    if (kind === "cy") {
      const ct = CITIES.find((x) => x.id === id);
      return ct ? ct.n : id;
    }
    if (kind === "ap") {
      const pt = PORTS.find((x) => x.id === id);
      return pt ? (pt.n + " · " + (pt.icao || id)) : id;
    }
    if (kind === "lm") {
      const lm = LANDMARKS.find((x) => x.id === id);
      const map = {
        liberty: "Statue of Liberty",
        empire: "Empire State Building",
        golden: "Golden Gate Bridge",
        grandcyn: "Grand Canyon",
        delicate: "Delicate Arch",
        yosemite: "El Capitan",
        yellowstone: "Old Faithful",
        whitehouse: "White House",
        washmon: "Washington Monument",
        eiffel: "Eiffel Tower",
        bigben: "Big Ben",
        colosseum: "Colosseum",
        sagrada: "Sagrada Família",
        giza: "Great Pyramid of Giza",
        taj: "Taj Mahal",
        gwall: "Great Wall of China",
        fuji: "Mount Fuji",
        opera: "Sydney Opera House",
        redeemer: "Christ the Redeemer",
        machu: "Machu Picchu",
        burj: "Burj Khalifa",
        "ha-long": "Ha Long Bay",
        everest: "Mount Everest",
        niagara: "Niagara Falls",
        matterhorn: "Matterhorn",
        uluru: "Uluru",
      };
      return map[id] || (lm ? lm.n : id);
    }
    return id;
  }

  function fetchPedia(kind, id) {
    const key = kind + ":" + id;
    const book = window.TWOFY_PEDIA || {};
    const entry = book[key] || {};
    const title = entry.title || wikiTitle(kind, id);
    const extract = entry.extract || "";
    const page = {
      key, kind, id, title, extract,
      fact: entry.fact || "",
      founded: entry.founded || "",
      pop: kind === "cc" ? (entry.pop || "") : "",
      lang: kind === "cc" ? (entry.lang || "") : "",
      gov: kind === "cc" ? (entry.gov || "") : "",
      capital: (kind === "cc" || kind === "st") ? (entry.capital || "") : "",
      image: "",
    };
    state.pedia[key] = page;
    savePedia();
    return Promise.resolve(page);
  }

  function heldStamp(kind, id) {
    const c = state.collection || emptyCollection();
    if (kind === "st") return (c.states || []).includes(id);
    if (kind === "cc") return (c.countries || []).includes(id);
    if (kind === "lm") return (c.marks || []).includes(id);
    if (kind === "cy") return (c.cities || []).includes(id);
    if (kind === "ap") return (c.ports || []).includes(id);
    return false;
  }

  function prefetchPediaFor(m) {
    const pts = [m.dep, m.dest];
    pts.forEach((p) => {
      const ap = airportOf(p);
      if (!ap) return;
      LANDMARKS.forEach((lm) => {
        if (haversineNm(ap, lm) <= 20) fetchPedia("lm", lm.id);
      });
      CITIES.forEach((ct) => {
        if (haversineNm(ap, ct) <= 30) fetchPedia("cy", ct.id);
      });
      PORTS.forEach((pt) => {
        if (airportHitsPort(ap, pt)) fetchPedia("ap", pt.id);
      });
    });
  }

  async function openPedia(kind, id) {
    const box = $("#pedia");
    const body = $("#pedia-body");
    if (!box || !body) return;
    const held = heldStamp(kind, id);
    const title = wikiTitle(kind, id);
    box.hidden = false;
    if (!held) {
      body.innerHTML = `
        <p class="pedia-kicker">ENCYCLOPEDIA</p>
        <h2>${title}</h2>
        <p class="muted">${kind === "cy" ? "POSTCARD NOT UNLOCKED." : kind === "ap" ? "AIRPORT NOT UNLOCKED." : "STAMP NOT UNLOCKED."}</p>`;
      return;
    }
    const page = await fetchPedia(kind, id);
    const art = stampSrc(kind, id);
    body.innerHTML = `
      <p class="pedia-kicker">ENCYCLOPEDIA</p>
      <h2>${page.title}</h2>
      <figure class="pedia-plate${kind === "cy" || kind === "ap" ? " card" : ""}">
        <img src="${art}" alt="${page.title}" onerror="this.parentNode.style.display='none'" />
      </figure>
      ${kind === "cc" && page.capital ? `<p class="pedia-meta"><b>CAPITAL</b> ${page.capital}</p>` : ""}
      ${kind === "cc" && page.pop ? `<p class="pedia-meta"><b>POPULATION</b> ${page.pop}</p>` : ""}
      ${kind === "cc" && page.lang ? `<p class="pedia-meta"><b>LANGUAGE</b> ${page.lang}</p>` : ""}
      ${kind === "cc" && page.gov ? `<p class="pedia-meta"><b>GOVERNMENT</b> ${page.gov}</p>` : ""}
      ${page.founded ? `<p class="pedia-meta"><b>FOUNDED / BUILT</b> ${page.founded}</p>` : ""}
      <p class="pedia-extract">${page.extract || ""}</p>
      ${page.fact ? `<p class="pedia-fact"><b>FACT</b> ${page.fact}</p>` : ""}`;
  }

  function stampSrc(kind, id) {
    const folder = kind === "st" ? "states" : kind === "cc" ? "countries" : kind === "cy" ? "cities" : kind === "ap" ? "airports" : "landmarks";
    let file = String(id || "");
    if (kind === "st" || kind === "cc" || kind === "ap") file = file.toUpperCase();
    return `stamps/${folder}/${file}.jpg`;
  }

  function stampButton(kind, attr, id, code, name, on, card) {
    const art = on
      ? `<img class="post-art" src="${stampSrc(kind, id)}" alt="" onerror="this.onerror=null;this.src=this.src.replace(/\\.jpg$/i,'.png')" />`
      : "";
    return `<button type="button" class="post${on ? " on" : ""}${card ? " postcard" : ""}" title="${name}" data-${attr}="${id}">
      ${art}
      <span class="post-code">${code}</span>
      <span class="post-name">${name}</span>
    </button>`;
  }

  function renderActive() {
    const box = $("#active");
    if (!box) return;
    const m = state.active;
    if (!m) {
      box.innerHTML = `<label>ACTIVE SORTIE</label><div class="empty tiny">NO TASKING ACCEPTED.</div>`;
      return;
    }
    const t = TYPES.find((x) => x.id === m.type);
    box.innerHTML = `
      <label>ACTIVE SORTIE</label>
      <article class="job on">
        <header>
          <span class="tag tag-${m.type}">${t ? t.label : m.type}</span>
          <span class="pay">${payText(m, true)}</span>
        </header>
        <div class="route">
          <div><b>${icaoOf(m.dep)}</b><span>${fieldCaption(m.dep)}</span></div>
          <div class="arrow">→</div>
          <div><b>${icaoJump(m.dest)}</b><span>${fieldCaption(m.dest)}</span></div>
        </div>
        <div class="stats">
          <span>${m.dist} nm</span>
          <span>hdg ${String(m.hdg).padStart(3, "0")}°</span>
          <span>ETE ${fmtEte(m.eteMin)}</span>
          <span>${m.acName}${m.acTail ? " · " + m.acTail : ""}</span>
          <span>${m.pay.text}</span>
          ${ttfBits(m.ac)}
          ${destWxBits(m.dest)}
        </div>
        <p class="brief">${m.brief}</p>
        <footer class="job-foot">
          <button class="primary tiny" id="complete-msn">COMPLETE</button>
          <button class="ghost" id="abort-msn">ABORT</button>
        </footer>
      </article>`;
    $("#complete-msn").addEventListener("click", () => openConfirm("complete"));
    $("#abort-msn").addEventListener("click", () => openConfirm("abort"));
    if (m.dest) loadWx(m.dest, false, "arr");
  }

  function markFlown(m) {
    const entry = {
      ...m,
      flown: true,
      flownAt: new Date().toISOString(),
      hours: Math.round((m.eteMin / 60) * 10) / 10,
      xp: m.xp || xpFor(m),
      money: m.money || 0,
    };
    const i = state.log.findIndex((x) => x.id === m.id);
    if (i >= 0) state.log[i] = { ...state.log[i], ...entry };
    else state.log.unshift(entry);
    state.profile.xp += entry.xp;
    if (state.profile.moneyOn) state.profile.money += entry.money;
    const acId = m.ac || (state.ac && state.ac.id);
    if (acId) {
      state.profile.hours = state.profile.hours || {};
      state.profile.sinceService = state.profile.sinceService || {};
      state.profile.hours[acId] = Math.round(((state.profile.hours[acId] || 0) + entry.hours) * 10) / 10;
      state.profile.sinceService[acId] = Math.round(((state.profile.sinceService[acId] || 0) + entry.hours) * 10) / 10;
    }
    saveProfile();
    saveLog();
    mergeUnlocks(unlocksFromFlown([entry]));
    renderLog();
    renderBook();
    renderRank();
    renderPilotChip();
    renderAirline();
    renderHangar();
    renderAircraft();
    renderAcMeta();
  }

  function pickAircraft(id) {
    const ac = AIRCRAFT.find((a) => a.id === id);
    if (!ac) return;
    if (state.mode === "airline" && !canSelectAc(ac)) return;
    state.ac = ac;
    state.acMaker = ac.maker;
    try { localStorage.setItem("twofly-ac", ac.id); } catch {}
    fillTypeSelect();
    syncMakerSelect();
    renderAcMeta();
    syncFav();
  }
  window.__twoflyPick = pickAircraft;

  function filteredAircraft() {
    const q = state.acQuery.trim().toLowerCase();
    return AIRCRAFT.filter((a) => {
      if (state.mode === "airline") {
        if (!inHangar(a.id)) return false;
        if (!airlineEligible(a)) return false;
      } else if (state.acFilter === "hangar" && !inHangar(a.id)) return false;
      if (state.acFilter === "owned" && !state.owned.has(a.id)) return false;
      if (state.acFilter === "jet" && a.cls !== "jet" && a.cls !== "airliner") return false;
      if (state.acFilter === "helo" && a.cls !== "helo" && a.cls !== "evtol") return false;
      if (["piston", "turboprop"].includes(state.acFilter) && a.cls !== state.acFilter && !(state.acFilter === "piston" && (a.cls === "bush" || a.cls === "vintage"))) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.maker.toLowerCase().includes(q) ||
        a.cls.toLowerCase().includes(q) ||
        (a.note && a.note.toLowerCase().includes(q))
      );
    }).sort((a, b) => a.maker.localeCompare(b.maker) || a.name.localeCompare(b.name));
  }

  function uniqueMakers(list) {
    const makers = [];
    (list || filteredAircraft()).forEach((a) => {
      if (!makers.includes(a.maker)) makers.push(a.maker);
    });
    return makers;
  }

  function syncFav() {
    const fav = $("#ac-fav");
    if (fav) fav.classList.toggle("mine", !!(state.ac && state.owned.has(state.ac.id)));
  }

  function syncMakerSelect() {
    const el = $("#ac-maker");
    if (!el) return;
    const makers = uniqueMakers();
    const key = makers.join("\n");
    if (el.getAttribute("data-key") !== key) {
      el.setAttribute("data-key", key);
      el.innerHTML = makers
        .map((m, i) => `<option value="${i}">${esc(m)}</option>`)
        .join("");
    }
    let idx = makers.indexOf(state.acMaker);
    if (idx < 0 && state.ac) idx = makers.indexOf(state.ac.maker);
    if (idx < 0) idx = 0;
    if (makers[idx]) state.acMaker = makers[idx];
    if (el.options.length) el.selectedIndex = idx;
  }

  function fillTypeSelect() {
    const sel = $("#ac-select");
    if (!sel) return;
    const types = filteredAircraft().filter((a) => a.maker === state.acMaker);
    if (!types.length) {
      sel.innerHTML = `<option value="">${state.mode === "airline" ? "NO AIRCRAFT IN HANGAR" : "NO MATCH"}</option>`;
      return;
    }
    if (!state.ac || !types.some((a) => a.id === state.ac.id)) {
      state.ac = types[0];
      try { localStorage.setItem("twofly-ac", state.ac.id); } catch {}
    }
    sel.innerHTML = types
      .map((a) => {
        const extra = [];
        const tail = tailOf(a.id);
        if (tail) extra.push(tail);
        extra.push(a.cruise + " kt");
        if (state.mode === "airline" && state.profile.locksOn && !classUnlocked(a.cls)) extra.push("LOCKED");
        else if (state.mode === "airline" && needsService(a.id)) extra.push("SERVICE DUE");
        return `<option value="${esc(a.id)}"${state.ac && state.ac.id === a.id ? " selected" : ""}>${esc(a.name)}${extra.length ? " · " + extra.join(" · ") : ""}</option>`;
      })
      .join("");
    syncFav();
  }

  function renderAircraft() {
    const list = filteredAircraft();
    const makerEl = $("#ac-maker");
    const sel = $("#ac-select");
    if (!makerEl || !sel) return;
    if (!list.length) {
      makerEl.innerHTML = "";
      makerEl.removeAttribute("data-key");
      sel.innerHTML = `<option value="">${state.mode === "airline" ? "NO AIRCRAFT IN HANGAR" : "NO MATCH"}</option>`;
      syncFav();
      return;
    }
    if (state.ac && list.some((a) => a.id === state.ac.id)) state.acMaker = state.ac.maker;
    syncMakerSelect();
    fillTypeSelect();
  }

  function renderAcMeta() {
    const a = state.ac;
    const el = $("#ac-meta");
    if (!el) return;
    if (!a) {
      el.innerHTML = "";
      return;
    }
    $("#ac-meta").innerHTML = `
      <span>${a.maker}</span>
      <span>${a.cls}</span>
      <span>${a.cruise} kt</span>
      <span>${a.range} nm</span>
      <span>${a.payload.toLocaleString()} lb useful</span>
      <span>${a.pax} pax</span>
      <span>${a.minRwy ? a.minRwy.toLocaleString() + " ft min" : "short-field ok"}</span>
      ${tailOf(a.id) ? `<span>${tailOf(a.id)}</span>` : ""}
      ${a.note ? `<span>${a.note}</span>` : ""}
      ${needsService(a.id) ? `<span class="svc-due">SERVICE DUE</span>` : `<span>${airframeHours(a.id).toFixed(1)} hr</span>`}
    `;
  }

  function renderDep() {
    const a = state.dep;
    const card = $("#dep-card");
    if (!card) return;
    if (!a) {
      card.innerHTML = `<div class="muted">ENTER ICAO.</div>`;
      return;
    }
    card.innerHTML = `
      <div class="icao">${a.id}${a.iata ? `<small>${a.iata}</small>` : ""}</div>
      <div class="name">${a.n || ""}</div>
      <div class="sub">${[a.c, COUNTRIES[a.cc] || a.cc].filter(Boolean).join(" · ")}</div>
      <div class="chips">
        <span>${fieldKind(a)}</span>
        <span>${a.rw ? a.rw.toLocaleString() + " ft" : "rwy n/a"}</span>
        <span>${a.pv ? "paved" : "unpaved / unknown"}</span>
        ${a.el != null ? `<span>${a.el.toLocaleString()} ft elev</span>` : ""}
      </div>
    `;
    const inp = $("#dep-input");
    if (inp) inp.value = a.id;
  }

  function renderMissions() {
    const root = $("#missions");
    if (!state.missions.length) {
      root.innerHTML = "";
      return;
    }
    root.innerHTML = state.missions
      .map((m) => {
        const t = TYPES.find((x) => x.id === m.type);
        return `
        <article class="job" data-id="${m.id}">
          <header>
            <span class="tag tag-${m.type}">${t ? t.emoji + " " + t.label : m.type}</span>
            <span class="pay">${payText(m, false)}</span>
          </header>
          <div class="route">
            <div><b>${icaoOf(m.dep)}</b><span>${fieldCaption(m.dep)}</span></div>
            <div class="arrow">→</div>
            <div><b>${icaoJump(m.dest)}</b><span>${fieldCaption(m.dest)}</span></div>
          </div>
          <div class="stats">
            <span>${m.dist} nm</span>
            <span>hdg ${String(m.hdg).padStart(3, "0")}°</span>
            <span>ETE ${fmtEte(m.eteMin)}</span>
            <span>${m.alt.toLocaleString()} ft</span>
            <span>${m.pay.text}</span>
            ${m.acTail ? `<span>${m.acTail}</span>` : ""}
            ${ttfBits(m.ac)}
            ${destWxBits(m.dest)}
          </div>
          <p class="brief">${m.brief}</p>
          <div class="notes">${m.constraints.map((c) => `<span>${c}</span>`).join("")}</div>
          <footer class="job-foot">
            <button class="primary tiny accept" ${state.active ? "disabled" : ""}>ACCEPT TASKING</button>
          </footer>
        </article>`;
      })
      .join("");
  }

  function renderPilotChip() {
    const el = $("#pilot-chip");
    if (!el) return;
    const p = state.profile;
    const lic = licenseFor(p.xp);
    el.innerHTML = `
      ${iconHtml(p, "chip-face")}
      <div class="chip-meta">
        <b>${p.name || "PILOT"}</b>
        ${p.showAirline && p.airline ? `<span class="chip-line">${p.airline}</span>` : ""}
        <span>RANK ${lic.n} · ${lic.name}</span>
        <span>${lic.next ? `${p.xp} / ${lic.next.xp} → ${lic.next.name}` : `${p.xp} XP`}</span>
        ${p.moneyOn ? `<div class="chip-cash">${moneyFmt(p.money)}</div>` : ""}
      </div>
    `;
  }

  function renderAirline() {
    const name = $("#pilot-name");
    const line = $("#airline-name");
    const picks = $("#icon-picks");
    const p = state.profile;
    if (name && document.activeElement !== name) name.value = p.name;
    if (line && document.activeElement !== line) line.value = p.airline;
    const show = $("#show-airline");
    if (show) show.checked = p.showAirline !== false;
    if (picks) {
      picks.innerHTML = PILOT_MARKS.map((id) =>
        `<button type="button" class="icon-pick${p.icon === id ? " on" : ""}" data-icon="${id}">
          <img alt="" src="${markSrc(id)}" data-mark="${id}" onerror="window.__twoflyMarkErr(this)" />
        </button>`
      ).join("") + (p.icon === "custom" && p.iconData
        ? `<button type="button" class="icon-pick on custom" data-icon="custom"><img alt="" src="${p.iconData}" /></button>`
        : "");
    }
    const blurbLong = $("#desk-blurb-long");
    if (state.mode === "airline") {
      if (blurbLong) blurbLong.textContent = "AIRLINE MODE generates revenue taskings using only aircraft currently in your hangar. Completing a tasking adds both pay and XP to your pilot file. Rank restrictions and maintenance apply when enabled. Use HOME to set your airline base, and purchase aircraft types from the HANGAR tab.";
    } else {
      if (blurbLong) blurbLong.textContent = "FREE FLIGHT lets you take civilian taskings from any airfield. Every aircraft type in your files is eligible. Completing a sortie adds the payment to your pilot file. Rank restrictions and hangar ownership do not apply.";
    }
    renderHome();
  }

  function homeField() {
    const id = state.profile && state.profile.home;
    return (id && byId.get(id)) || null;
  }

  function renderHome() {
    const home = homeField();
    const meta = $("#home-meta");
    const go = $("#go-home");
    if (meta) meta.textContent = home ? `BASE ${home.id} · ${home.n}` : "NO HOME FIELD SET";
    if (go) go.disabled = !home;
    const setMeta = $("#home-set-meta");
    if (setMeta) setMeta.textContent = home
      ? `CURRENT BASE ${home.id} · ${home.n}. USED BY THE HOME BUTTON IN AIRLINE MODE.`
      : "USED BY THE HOME BUTTON IN AIRLINE MODE.";
    const homeIn = $("#home-input");
    if (homeIn && document.activeElement !== homeIn) homeIn.value = home ? home.id : "";
  }

  function renderHangar() {
    const fleet = $("#fleet-list");
    const market = $("#market-list");
    const loanEl = $("#loan-panel");
    const p = state.profile;
    if (loanEl) {
      if (!p.moneyOn) {
        loanEl.innerHTML = `<label>CREDIT</label><p class="muted">MONEY AWARDS ARE OFF.</p>`;
      } else {
        const debt = p.debt || 0;
        const left = creditLeft();
        loanEl.innerHTML = `
        <label>CREDIT</label>
        <div class="wx-grid">
          <div><span>LOAN AVAILABLE</span><b>${moneyFmt(left)}</b></div>
          <div><span>DEBT</span><b>${moneyFmt(debt)}</b></div>
        </div>
        <div class="row">
          <div>
            <label for="loan-amt">AMOUNT (${ccy().id})</label>
            <input id="loan-amt" type="text" inputmode="numeric" placeholder="0" autocomplete="off" />
          </div>
        </div>
        <div class="loan-acts">
          <button type="button" class="tiny" id="loan-out">WITHDRAW</button>
          <button type="button" class="tiny" id="loan-pay">REPAY</button>
        </div>
        <p class="err" id="loan-err" hidden></p>
        `;
        const amtEl = $("#loan-amt");
        const errEl = $("#loan-err");
        const go = (fn) => {
          const msg = fn(amtEl && amtEl.value);
          if (msg) {
            errEl.hidden = false;
            errEl.textContent = msg;
            return;
          }
          renderHangar();
          renderPilotChip();
          renderAirline();
        };
        $("#loan-out")?.addEventListener("click", () => go(loanWithdraw));
        $("#loan-pay")?.addEventListener("click", () => go(loanRepay));
      }
    }
    const fleetLab = $("#fleet-label");
    if (fleetLab) fleetLab.textContent = `FLEET ${p.hangar.length}/${HANGAR_CAP}`;
    if (fleet) {
      const rows = p.hangar.map((id) => AIRCRAFT.find((a) => a.id === id)).filter(Boolean);
      fleet.innerHTML = rows.map((a) => {
        const due = needsService(a.id);
        const hrs = airframeHours(a.id);
        const wear = sinceService(a.id);
        return `
        <div class="fleet-row">
          <div>
            <b>${a.name}</b>
            <span class="muted">${a.maker} · ${hrs.toFixed(1)} HR · TTF ${Math.max(0, SERVICE_HRS - wear).toFixed(1)} HR${due ? " · SERVICE DUE" : ""}</span>
            <label class="tail-lab">TAIL
              <input class="tail-in" data-tail="${a.id}" type="text" maxlength="10" value="${tailOf(a.id)}" placeholder="N-NUMBER" autocomplete="off" spellcheck="false" />
            </label>
          </div>
          <div class="fleet-act">
            <button type="button" class="tiny" data-fly="${a.id}">SELECT</button>
            ${due ? `<button type="button" class="tiny" data-repair="${a.id}">REPAIR ${moneyFmt(repairCost(a))}</button>` : ""}
            <button type="button" class="ghost tiny" data-sell="${a.id}">SELL ${moneyFmt(Math.round(listPrice(a) * 0.7))}</button>
          </div>
        </div>`;
      }).join("") || `<p class="muted">HANGAR EMPTY.</p>`;
    }
    if (market) {
      const q = (state.mktQuery || "").trim().toLowerCase();
      const filt = state.mktFilter || "all";
      const list = AIRCRAFT.filter((a) => {
        if (inHangar(a.id) || !airlineEligible(a)) return false;
        if (filt === "jet" && a.cls !== "jet" && a.cls !== "airliner") return false;
        if (filt === "helo" && a.cls !== "helo" && a.cls !== "evtol") return false;
        if (filt === "piston" && a.cls !== "piston" && a.cls !== "bush" && a.cls !== "vintage") return false;
        if (filt === "turboprop" && a.cls !== "turboprop") return false;
        if (!q) return true;
        return a.name.toLowerCase().includes(q) || a.maker.toLowerCase().includes(q) || a.cls.toLowerCase().includes(q);
      }).slice(0, 60);
      market.innerHTML = list.map((a) => {
        const price = listPrice(a);
        const locked = p.locksOn && !classUnlocked(a.cls);
        const free = !p.moneyOn;
        const afford = free || p.money >= price;
        const full = p.hangar.length >= HANGAR_CAP;
        const priceHtml = free
          ? `<span class="price-ok">FREE</span>`
          : `<span class="${afford ? "price-ok" : "price-no"}">${moneyFmt(price)}</span>`;
        const lockHtml = locked ? ` · <span class="lock-rank">RANK LOCK</span>` : "";
        return `<div class="fleet-row">
          <div>
            <b>${a.name}</b>
            <span class="muted">${a.maker} · ${a.cls} · ${a.pax || 0} PAX · ${priceHtml}${lockHtml}</span>
          </div>
          <div class="fleet-act">
            <button type="button" class="tiny" data-buy="${a.id}" ${locked || full ? "disabled" : ""}>${free ? "ADD" : "BUY"}</button>
          </div>
        </div>`;
      }).join("") || `<p class="muted">NO MATCHING LISTINGS.</p>`;
    }
  }

  function renderSettings() {
    const money = $("#set-money");
    const locks = $("#set-locks");
    const ccyEl = $("#set-ccy");
    const tempEl = $("#set-temp");
    if (money) money.checked = !!state.profile.moneyOn;
    if (locks) locks.checked = !!state.profile.locksOn;
    if (ccyEl) {
      if (!ccyEl.options.length) {
        ccyEl.innerHTML = CURRENCIES.map(
          (c) => `<option value="${c.id}">${c.id} — ${c.name}</option>`
        ).join("");
      }
      ccyEl.value = ccy().id;
    }
    if (tempEl) tempEl.value = useF() ? "F" : "C";
    renderHome();
  }

  function renderRank() {
    const { title, list } = badges();
    const rank = $("#rankline");
    if (rank) rank.textContent = title;
    const badgesEl = $("#badges");
    if (badgesEl) {
      badgesEl.innerHTML = list
        .map((b) => `<span class="badge${b.have ? " have" : ""}">${b.label}<i class="tip">${b.info}</i></span>`)
        .join("");
    }
    const book = $("#badges-book");
    if (book) {
      book.innerHTML = list
        .map((b) => `<span class="badge${b.have ? " have" : ""}">${b.label}<i class="tip">${b.info}</i></span>`)
        .join("");
    }
  }

  function fmtDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
    return `${d.getDate()} ${months[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
  }

  function renderLog() {
    const { flown } = flownStats();
    const hours = flown.reduce((s, m) => s + (m.hours || 0), 0);
    const nm = flown.reduce((s, m) => s + (m.dist || 0), 0);
    const xp = flown.reduce((s, m) => s + (m.xp || 0), 0);
    const rk = rankFor(state.profile.xp || xp);
    const nextTxt = rk.next
      ? `${state.profile.xp || xp} / ${rk.next.xp} xp → ${rk.next.name}`
      : `${state.profile.xp || xp} XP · GRADE CEILING`;
    const stats = $("#pilot-stats");
    if (stats) stats.innerHTML = `
      <span>${rk.name}</span>
      <span>${nextTxt}</span>
      <span>${flown.length} flown</span>
      <span>${hours.toFixed(1)} hr</span>
      <span>${nm.toLocaleString()} nm</span>
    `;
    const bar = $("#xp-bar");
    if (bar) {
      const lo = rk.xp;
      const hi = rk.next ? rk.next.xp : lo;
      const pct = rk.next ? Math.min(100, Math.round((((state.profile.xp || xp) - lo) / Math.max(1, hi - lo)) * 100)) : 100;
      bar.style.width = pct + "%";
    }
    renderRank();
    const root = $("#log");
    if (!root) return;
    if (!state.log.length) {
      root.innerHTML = `<div class="empty tiny">NO SORTIES ON FILE.</div>`;
      return;
    }
    root.innerHTML = state.log
      .map((m) => {
        const mode = m.mode === "airline" ? "AIRLINE" : "FREE";
        const pay = m.mode === "airline"
          ? `${m.xp || xpFor(m)}xp ${moneyFmt(m.money || 0)}`
          : moneyFmt(m.money || 0);
        const when = fmtDate(m.flownAt || m.acceptedAt);
        return `
        <div class="log-row">
          <div>
            <b>${icaoOf(m.dep)} → ${icaoOf(m.dest)}</b>
            <span>${fieldCaption(m.dep)} → ${fieldCaption(m.dest)}</span>
            <span>${mode}${when ? " · " + when : ""} · ${TYPES.find((t) => t.id === m.type)?.label || m.type} · ${m.dist} nm · ${m.acName}${m.flown ? " · flown" : ""} · ${pay}</span>
          </div>
          <button class="ghost tiny copy-log" data-id="${m.id}">copy</button>
        </div>`;
      })
      .join("");
  }

  function pctLabel(n, d, extra) {
    if (!d) return extra ? `0 / 0 ${extra}` : "0 / 0";
    const pct = Math.round((n / d) * 100);
    return extra ? `${n} / ${d} ${extra} · ${pct}%` : `${n} / ${d} · ${pct}%`;
  }

  function renderBook() {
    const stamps = new Set(state.collection.stamps || []);
    const marks = new Set(state.collection.marks || []);
    const cities = new Set(state.collection.cities || []);
    const ports = new Set(state.collection.ports || []);
    const have = marks.size + cities.size + ports.size;
    const need = LANDMARKS.length + CITIES.length + PORTS.length;
    const overall = $("#book-progress");
    if (overall) overall.textContent = `PROGRESS ${pctLabel(have, need)}`;
    const lmal = $("#landmark-album");
    const lmN = $("#landmark-count");
    if (lmN) lmN.textContent = pctLabel(marks.size, LANDMARKS.length);
    if (lmal) {
      lmal.innerHTML = LANDMARKS.map((lm) =>
        stampButton("lm", "lm", lm.id, lm.cc, lm.n, marks.has(lm.id), false)
      ).join("");
    }
    const cyal = $("#city-album");
    const cyN = $("#city-count");
    if (cyN) cyN.textContent = pctLabel(cities.size, CITIES.length);
    if (cyal) {
      cyal.innerHTML = CITIES.map((ct) =>
        stampButton("cy", "cy", ct.id, ct.cc, ct.n, cities.has(ct.id), true)
      ).join("");
    }
    const apal = $("#airport-album");
    const apN = $("#airport-count");
    if (apN) apN.textContent = pctLabel(ports.size, PORTS.length);
    if (apal) {
      apal.innerHTML = PORTS.map((pt) =>
        stampButton("ap", "ap", pt.id, pt.icao || pt.id, pt.n, ports.has(pt.id), true)
      ).join("");
    }
    const stampBar = $("#stamps");
    if (stampBar) {
      stampBar.innerHTML = [...stamps]
        .sort()
        .map((id) => `<span class="stamp">${id}</span>`)
        .join("") || `<span class="muted">NO AIRFIELDS LOGGED.</span>`;
    }
    renderRank();
  }

  function searchAirports(q) {
    q = (q || "").trim().toUpperCase();
    if (q.length < 2) return [];
    const hits = [];
    for (const a of airports) {
      if (!a || !a.id) continue;
      if (a.id.startsWith(q) || (a.iata && a.iata.startsWith(q))) hits.push(a);
      if (hits.length >= 12) return hits;
    }
    if (q.length >= 3) {
      for (const a of airports) {
        if (hits.includes(a)) continue;
        if ((a.n && a.n.toUpperCase().includes(q)) || (a.c && a.c.toUpperCase().includes(q))) {
          hits.push(a);
        }
        if (hits.length >= 12) break;
      }
    }
    return hits;
  }

  function bind() {
    $("#ac-search")?.addEventListener("input", (e) => {
      state.acQuery = e.target.value;
      renderAircraft();
      renderAcMeta();
    });
    $("#ac-filters")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-filter]");
      if (!btn) return;
      state.acFilter = btn.dataset.filter;
      $$("#ac-filters [data-filter]").forEach((b) => b.classList.toggle("on", b === btn));
      renderAircraft();
      renderAcMeta();
    });
    $("#ac-maker")?.addEventListener("change", (e) => {
      const makers = uniqueMakers();
      const i = e.target.selectedIndex;
      state.acMaker = makers[i] || "";
      const types = filteredAircraft().filter((a) => a.maker === state.acMaker);
      if (types[0]) {
        state.ac = types[0];
        try { localStorage.setItem("twofly-ac", state.ac.id); } catch {}
      }
      fillTypeSelect();
      renderAcMeta();
    });
    $("#ac-select")?.addEventListener("change", (e) => {
      const ac = AIRCRAFT.find((a) => a.id === e.target.value);
      if (!ac) return;
      if (state.mode === "airline" && !canSelectAc(ac)) return;
      state.ac = ac;
      state.acMaker = ac.maker;
      try { localStorage.setItem("twofly-ac", ac.id); } catch {}
      renderAcMeta();
      syncFav();
    });
    $("#ac-fav")?.addEventListener("click", () => {
      if (!state.ac) return;
      const id = state.ac.id;
      if (state.owned.has(id)) state.owned.delete(id);
      else state.owned.add(id);
      saveOwned();
      renderAircraft();
    });
    $("#view-desk")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-wx-refresh]");
      if (!btn) return;
      const slot = btn.dataset.wxRefresh;
      if (slot === "arr") loadWx(state.active && state.active.dest, true, "arr");
      else loadWx(state.dep, true, "dep");
    });
    $("#hop")?.addEventListener("change", (e) => (state.hop = e.target.value));
    $("#type")?.addEventListener("change", (e) => (state.type = e.target.value));
    $("#hard")?.addEventListener("change", (e) => (state.hard = e.target.checked));

    const box = $("#suggest");
    const input = $("#dep-input");
    if (input && box) {
    input.addEventListener("input", () => {
      const hits = searchAirports(input.value);
      if (!hits.length) {
        box.hidden = true;
        return;
      }
      box.hidden = false;
      box.innerHTML = hits
        .map(
          (a) =>
            `<button type="button" data-id="${a.id}"><b>${a.id}</b> <span>${a.n}${a.c ? " · " + a.c : ""}</span></button>`
        )
        .join("");
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const hits = searchAirports(input.value);
        if (hits[0]) selectDep(hits[0]);
        box.hidden = true;
      }
    });
    box.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-id]");
      if (!btn) return;
      selectDep(byId.get(btn.dataset.id));
      box.hidden = true;
    });
    } // input && box
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".dep-search")) {
        const sg = $("#suggest");
        if (sg) sg.hidden = true;
        const hs = $("#home-suggest");
        if (hs) hs.hidden = true;
      }
    });
    $("#go-home")?.addEventListener("click", () => {
      const home = homeField();
      if (home) selectDep(home);
    });
    $("#set-home")?.addEventListener("click", () => {
      if (!state.dep) return;
      state.profile.home = state.dep.id;
      saveProfile();
      renderHome();
    });
    const homeBox = $("#home-suggest");
    const homeIn = $("#home-input");
    if (homeIn && homeBox) {
      const pickHome = (a) => {
        if (!a) return;
        state.profile.home = a.id;
        saveProfile();
        homeBox.hidden = true;
        renderHome();
      };
      homeIn.addEventListener("input", () => {
        const hits = searchAirports(homeIn.value);
        if (!hits.length) {
          homeBox.hidden = true;
          return;
        }
        homeBox.hidden = false;
        homeBox.innerHTML = hits
          .map(
            (a) =>
              `<button type="button" data-id="${a.id}"><b>${a.id}</b> <span>${a.n}${a.c ? " · " + a.c : ""}</span></button>`
          )
          .join("");
      });
      homeIn.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          const hits = searchAirports(homeIn.value);
          if (hits[0]) pickHome(hits[0]);
        }
      });
      homeBox.addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-id]");
        if (!btn) return;
        pickHome(byId.get(btn.dataset.id));
      });
    }

    const runGen = () => {
      if (state.ac && needsService(state.ac.id)) {
        setMissions([]);
        renderMissions();
        $("#missions").innerHTML = `<div class="empty">SERVICE DUE ON THIS AIRCRAFT. REPAIR IN HANGAR.</div>`;
        return;
      }
      const list = generate();
      list.forEach((m) => { m.mode = state.mode; });
      setMissions(list);
      renderMissions();
      fillDestWx(state.missions);
      if (!state.missions.length) {
        $("#missions").innerHTML = `<div class="empty">NO VALID TASKING FOR THIS COMBINATION. ADJUST LEG LENGTH, SURFACE CONSTRAINT, OR AIRFIELD.</div>`;
      }
    };
    $("#go").addEventListener("click", runGen);
    $("#issue-n")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-n]");
      if (!btn) return;
      state.issueN = Number(btn.dataset.n) || 5;
      const n = state.issueN;
      const go = $("#go");
      if (go) go.textContent = n === 1 ? "ISSUE 1 TASKING" : `ISSUE ${n} TASKINGS`;
      $$("#issue-n [data-n]").forEach((b) => b.classList.toggle("on", Number(b.dataset.n) === n));
    });

    $("#missions").addEventListener("click", (e) => {
      const jump = e.target.closest(".icao-jump");
      if (jump) {
        const a = byId.get(jump.dataset.icao);
        if (a) selectDep(a);
        return;
      }
      const job = e.target.closest(".job");
      if (!job) return;
      const m = state.missions.find((x) => x.id === job.dataset.id);
      if (!m) return;
      if (m.dest) loadWx(m.dest, false, "arr");
      if (e.target.closest(".accept")) {
        if (state.active) return;
        acceptMission(m);
      }
    });
    $("#active")?.addEventListener("click", (e) => {
      const jump = e.target.closest(".icao-jump");
      if (!jump) return;
      const a = byId.get(jump.dataset.icao);
      if (a) selectDep(a);
    });
    document.addEventListener("click", (e) => {
      const more = e.target.closest(".blurb-more");
      if (!more) return;
      const wrap = more.closest(".tab-blurb");
      const long = wrap && wrap.querySelector(".blurb-long");
      if (!long) return;
      const open = long.hidden;
      long.hidden = !open;
      more.setAttribute("aria-expanded", open ? "true" : "false");
    });
    $("#view-book")?.addEventListener("click", (e) => {
      const h = e.target.closest("h3.album-h[data-fold]");
      if (!h) return;
      const id = h.dataset.fold;
      h.classList.toggle("folded");
      const body = document.querySelector(`[data-fold-body="${id}"]`);
      if (body) body.classList.toggle("folded");
    });
    $("#ach-toggle")?.addEventListener("click", () => {
      const box = $("#badges-book");
      if (!box) return;
      box.hidden = !box.hidden;
      $("#ach-toggle").classList.toggle("on", !box.hidden);
    });
    $("#mkt-filters")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-mkt]");
      if (!btn) return;
      state.mktFilter = btn.dataset.mkt;
      $$("#mkt-filters [data-mkt]").forEach((b) => b.classList.toggle("on", b === btn));
      renderHangar();
    });

    $("#log").addEventListener("click", (e) => {
      const btn = e.target.closest(".copy-log");
      if (!btn) return;
      const m = state.log.find((x) => x.id === btn.dataset.id);
      if (m) navigator.clipboard.writeText(missionText(m)).catch(() => {});
    });

    $("#clear-log").addEventListener("click", () => openConfirm("log"));
    $("#clear-book")?.addEventListener("click", () => openConfirm("book"));
    $("#clear-all")?.addEventListener("click", () => openConfirm("all"));
    $("#backup-export")?.addEventListener("click", exportBackup);
    $("#backup-import")?.addEventListener("change", (e) => {
      const f = e.target.files && e.target.files[0];
      e.target.value = "";
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        try { importBackup(JSON.parse(String(reader.result || ""))); }
        catch { setBackupMsg("BACKUP FILE IS NOT VALID JSON."); }
      };
      reader.readAsText(f);
    });
    $("#welcome-go")?.addEventListener("click", dismissWelcome);
    $("#confirm-no").addEventListener("click", () => {
      state.pendingClear = "";
      $("#confirm").hidden = true;
    });
    $("#confirm-yes").addEventListener("click", () => {
      const kind = state.pendingClear;
      state.pendingClear = "";
      $("#confirm").hidden = true;
      if (kind === "book") {
        state.collection = emptyCollection();
        state.pedia = {};
        saveCollection();
        savePedia();
        renderBook();
        renderRank();
      } else if (kind === "complete") {
        completeMission();
      } else if (kind === "abort") {
        abortMission();
      } else if (kind === "log") {
        state.log = [];
        saveLog();
        renderLog();
      } else if (kind === "all") {
        resetAllProgress();
      }
    });
    $("#confirm").addEventListener("click", (e) => {
      if (e.target.id === "confirm") {
        state.pendingClear = "";
        $("#confirm").hidden = true;
      }
    });
    const pediaClick = (root, kind, attr) => {
      if (!root) return;
      root.addEventListener("click", (e) => {
        const btn = e.target.closest("button.post");
        if (!btn) return;
        openPedia(kind, btn.dataset[attr]);
      });
    };
    pediaClick($("#landmark-album"), "lm", "lm");
    pediaClick($("#city-album"), "cy", "cy");
    pediaClick($("#airport-album"), "ap", "ap");
    $("#tabs").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-tab]");
      if (!btn) return;
      const tab = btn.dataset.tab;
      if (tab === "desk" || tab === "line") {
        useBoard(tab === "line" ? "airline" : "free");
        renderMissions();
        renderActive();
      }
      document.body.classList.toggle("mode-airline", state.mode === "airline");
      $$("#tabs button").forEach((b) => b.classList.toggle("on", b === btn));
      const deskOn = tab === "desk" || tab === "line";
      $("#view-desk").hidden = !deskOn;
      $("#view-book").hidden = tab !== "book";
      const hang = $("#view-hangar");
      const setv = $("#view-set");
      const logv = $("#view-log");
      if (hang) hang.hidden = tab !== "hangar";
      if (setv) setv.hidden = tab !== "set";
      if (logv) logv.hidden = tab !== "log";
      if (tab === "line") {
        state.acQuery = "";
        const acs = $("#ac-search");
        if (acs) acs.value = "";
        if (!canSelectAc(state.ac)) {
          const first = AIRCRAFT.find((a) => canSelectAc(a));
          if (first) {
            state.ac = first;
            localStorage.setItem("twofly-ac", first.id);
          }
        }
        renderAirline();
        renderAircraft();
        renderAcMeta();
      }
      if (tab === "desk") {
        if (state.acFilter === "hangar") {
          state.acFilter = "all";
          $$("#ac-filters [data-filter]").forEach((b) => b.classList.toggle("on", b.dataset.filter === "all"));
        }
        renderAirline();
        renderAircraft();
        renderAcMeta();
      }
      if (tab === "hangar") renderHangar();
      if (tab === "set") {
        renderSettings();
        renderAirline();
      }
      if (tab === "log") renderLog();
      if (tab === "book") renderBook();
    });
    $("#pedia-close").addEventListener("click", () => ($("#pedia").hidden = true));
    $("#pedia").addEventListener("click", (e) => {
      if (e.target.id === "pedia") $("#pedia").hidden = true;
    });

    const nameIn = $("#pilot-name");
    const lineIn = $("#airline-name");
    nameIn?.addEventListener("input", () => {
      state.profile.name = nameIn.value.slice(0, 32);
      saveProfile();
      renderPilotChip();
    });
    lineIn?.addEventListener("input", () => {
      state.profile.airline = lineIn.value.slice(0, 32);
      saveProfile();
      renderPilotChip();
      renderAirline();
    });
    $("#show-airline")?.addEventListener("change", (e) => {
      state.profile.showAirline = e.target.checked;
      saveProfile();
      renderPilotChip();
      renderAirline();
    });
    $("#icon-picks")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-icon]");
      if (!btn) return;
      state.profile.icon = btn.dataset.icon;
      saveProfile();
      renderAirline();
      renderPilotChip();
    });
    $("#icon-file")?.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = 96;
        c.height = 96;
        const ctx = c.getContext("2d");
        const s = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 96, 96);
        state.profile.icon = "custom";
        state.profile.iconData = c.toDataURL("image/jpeg", 0.72);
        saveProfile();
        renderAirline();
        renderPilotChip();
        URL.revokeObjectURL(url);
      };
      img.src = url;
    });
    $("#set-money")?.addEventListener("change", (e) => {
      state.profile.moneyOn = e.target.checked;
      saveProfile();
      renderPilotChip();
      renderAircraft();
      renderHangar();
    });
    $("#set-locks")?.addEventListener("change", (e) => {
      state.profile.locksOn = e.target.checked;
      saveProfile();
      renderAircraft();
      renderHangar();
      renderAirline();
    });
    $("#set-ccy")?.addEventListener("change", (e) => {
      state.profile.currency = e.target.value;
      saveProfile();
      renderPilotChip();
      renderAirline();
      renderHangar();
      renderMissions();
      renderActive();
      renderLog();
    });
    $("#set-temp")?.addEventListener("change", (e) => {
      state.profile.tempUnit = e.target.value === "F" ? "F" : "C";
      saveProfile();
      if (state.dep) loadWx(state.dep, false, "dep");
      if (state.active && state.active.dest) loadWx(state.active.dest, false, "arr");
      else if (state.missions[0] && state.missions[0].dest) loadWx(state.missions[0].dest, false, "arr");
    });
    window.addEventListener("offline", () => {
      wxOfflineFlag = true;
      if (state.dep) loadWx(state.dep, true, "dep");
      if (state.active && state.active.dest) loadWx(state.active.dest, true, "arr");
    });
    window.addEventListener("online", () => {
      wxOfflineFlag = false;
      wxCache.clear();
      if (state.dep) loadWx(state.dep, true, "dep");
      if (state.active && state.active.dest) loadWx(state.active.dest, true, "arr");
    });
    $("#mkt-search")?.addEventListener("input", (e) => {
      state.mktQuery = e.target.value;
      renderHangar();
    });
    $("#view-hangar")?.addEventListener("change", (e) => {
      const inp = e.target.closest("[data-tail]");
      if (!inp) return;
      setTail(inp.dataset.tail, inp.value);
      inp.value = tailOf(inp.dataset.tail);
      renderAircraft();
      renderAcMeta();
    });
    $("#view-hangar")?.addEventListener("click", (e) => {
      const fly = e.target.closest("[data-fly]");
      const sell = e.target.closest("[data-sell]");
      const buy = e.target.closest("[data-buy]");
      const repair = e.target.closest("[data-repair]");
      let err = "";
      if (fly) {
        const ac = AIRCRAFT.find((a) => a.id === fly.dataset.fly);
        if (ac && canSelectAc(ac)) {
          state.ac = ac;
          localStorage.setItem("twofly-ac", ac.id);
          renderAircraft();
          renderAcMeta();
        }
      } else if (sell) {
        err = sellAircraft(sell.dataset.sell);
      } else if (buy) {
        err = buyAircraft(buy.dataset.buy);
      } else if (repair) {
        err = repairAircraft(repair.dataset.repair);
      } else return;
      if (err) {
        const note = $("#hangar-err");
        if (note) {
          note.hidden = false;
          note.textContent = err;
        }
      } else {
        const note = $("#hangar-err");
        if (note) {
          note.hidden = true;
          note.textContent = "";
        }
      }
      renderHangar();
      renderPilotChip();
      renderAircraft();
      renderAirline();
    });
  }

  function selectDep(a) {
    if (!a) return;
    state.dep = a;
    localStorage.setItem("twofly-dep", a.id);
    persistStore();
    renderDep();
    loadWx(a);
  }

  function init() {
    const savedAc = localStorage.getItem("twofly-ac");
    if (savedAc) state.ac = AIRCRAFT.find((a) => a.id === savedAc) || state.ac;
    if (!canSelectAc(state.ac)) {
      const first = AIRCRAFT.find((a) => canSelectAc(a));
      if (first) state.ac = first;
    }
    const savedDep = localStorage.getItem("twofly-dep");
    if (savedDep && byId.get(savedDep)) state.dep = byId.get(savedDep);
    state.log.forEach((m) => {
      if (m.flown && !m.xp) m.xp = xpFor(m);
    });

    const typeEl = $("#type");
    if (typeEl) {
      typeEl.innerHTML =
        `<option value="any">ANY AUTHORIZED CATEGORY</option>` +
        TYPES.map((t) => `<option value="${t.id}">${t.label}</option>`).join("");
    }
    stampBuild();

    const run = (fn) => { try { fn(); } catch (e) { console.error(e); } };
    run(renderAircraft);
    run(renderAcMeta);
    run(renderDep);
    run(() => loadWx(state.dep));
    run(() => {
      if (state.active && state.active.dest) loadWx(state.active.dest, false, "arr");
      else loadWx(null, false, "arr");
    });
    run(renderMissions);
    run(renderActive);
    run(renderLog);
    run(renderBook);
    run(renderPilotChip);
    run(renderAirline);
    run(() => {
      const n = $("#field-count");
      if (n) n.textContent = `${airports.length.toLocaleString()} AIRFIELDS ON FILE`;
    });
    run(renderHangar);
    run(renderSettings);
    run(bind);
    run(persistStore);
    run(maybeWelcome);

    window.addEventListener("pagehide", flushStore);
    window.addEventListener("beforeunload", flushStore);

    setInterval(function () {
      fetch("/__twofly/ping", { cache: "no-store" }).catch(function () {});
    }, 2000);
    fetch("/__twofly/ping", { cache: "no-store" }).catch(function () {});
  }

  const STORE_KEYS = [
    "twofly-pilot-file", "twofly-log", "twofly-pedia", "twofly-active",
    "twofly-active-free", "twofly-active-airline", "twofly-collection",
    "twofly-owned", "twofly-ac", "twofly-dep", "twofly-pilot",
    "twofly-seen-welcome",
  ];

  let persistT = 0;
  function setBackupMsg(t) {
    const el = $("#backup-msg");
    if (el) el.textContent = t || "";
  }

  function exportBackup() {
    const pack = {
      v: 1,
      app: "TwoFly",
      version: VERSION,
      at: new Date().toISOString(),
      store: collectStore(),
    };
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    const day = new Date().toISOString().slice(0, 10);
    a.href = URL.createObjectURL(blob);
    a.download = "TwoFly-backup-" + day + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    setBackupMsg("BACKUP SAVED AS TwoFly-backup-" + day + ".json");
  }

  function importBackup(pack) {
    const store = pack && (pack.store || pack);
    if (!store || typeof store !== "object" || Array.isArray(store)) {
      setBackupMsg("BACKUP FILE IS NOT A TWOFLY PILOT FILE.");
      return;
    }
    const keys = Object.keys(store).filter((k) => k.indexOf("twofly-") === 0);
    if (!keys.length) {
      setBackupMsg("BACKUP FILE HAS NO PILOT DATA.");
      return;
    }
    keys.forEach((k) => {
      if (store[k] == null) localStorage.removeItem(k);
      else localStorage.setItem(k, String(store[k]));
    });
    flushStore();
    reloadFromStorage();
    renderPilotChip();
    renderHangar();
    renderLog();
    renderBook();
    renderAircraft();
    renderAcMeta();
    renderAirline();
    renderMissions();
    renderActive();
    renderSettings();
    renderRank();
    setBackupMsg("BACKUP RESTORED.");
  }

  function dismissWelcome() {
    try { localStorage.setItem("twofly-seen-welcome", "1"); } catch {}
    persistStore();
    const el = $("#welcome");
    if (el) el.hidden = true;
  }

  function maybeWelcome() {
    const el = $("#welcome");
    if (!el) return;
    try {
      if (localStorage.getItem("twofly-seen-welcome")) return;
    } catch {}
    if ((state.profile && state.profile.xp > 0) || (state.log && state.log.length)) {
      dismissWelcome();
      return;
    }
    el.hidden = false;
  }

  function stampBuild() {
    const about = $(".about-ver");
    const paint = (exe, build) => {
      const line = exe ? `EXE ${exe} · ${build || ""}`.trim() : `JS v${VERSION}`;
      if (about) about.textContent = line;
      document.title = exe ? `TwoFly ${exe}` : `TwoFly v${VERSION}`;
    };
    fetch("/__twofly/version", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d || !d.version) return;
        paint(d.version, d.build);
      })
      .catch(() => {});
  }

  function persistStore() {
    clearTimeout(persistT);
    persistT = setTimeout(flushStore, 250);
  }

  function collectStore() {
    const data = {};
    STORE_KEYS.forEach((k) => {
      const v = localStorage.getItem(k);
      if (v != null) data[k] = v;
    });
    return data;
  }

  function flushStore() {
    clearTimeout(persistT);
    const body = JSON.stringify(collectStore());
    fetch("/__twofly/store", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(function () {});
  }

  function reloadFromStorage() {
    state.log = loadLog();
    state.pedia = loadPedia();
    state.collection = loadCollection();
    state.activeBy.free = loadActive("free");
    state.activeBy.airline = loadActive("airline");
    useBoard(state.mode);
    state.owned = loadOwned();
    state.profile = loadProfile();
  }

  function resetAllProgress() {
    STORE_KEYS.forEach((k) => localStorage.removeItem(k));
    state.profile = defaultProfile();
    state.log = [];
    state.collection = emptyCollection();
    state.pedia = {};
    state.owned = new Set();
    state.missionsBy = { free: [], airline: [] };
    state.activeBy = { free: null, airline: null };
    useBoard(state.mode);
    saveProfile();
    saveLog();
    saveCollection();
    savePedia();
    saveOwned();
    saveActive();
    renderPilotChip();
    renderHangar();
    renderLog();
    renderBook();
    renderAircraft();
    renderAcMeta();
    renderAirline();
    renderMissions();
    renderActive();
    renderSettings();
    renderRank();
  }

  function hydrateStore() {
    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const to = setTimeout(function () { if (ctrl) try { ctrl.abort(); } catch (e) {} }, 800);
    return fetch("/__twofly/store", { cache: "no-store", signal: ctrl && ctrl.signal })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (data) {
        if (!data || typeof data !== "object") return;
        Object.keys(data).forEach(function (k) {
          if (k.indexOf("twofly-") === 0 && typeof data[k] === "string") {
            try { localStorage.setItem(k, data[k]); } catch (e) {}
          }
        });
      })
      .catch(function () {})
      .then(function () { clearTimeout(to); });
  }

  function boot() {
    try { stampBuild(); } catch (e) {}
    try { init(); } catch (err) {
      var el = document.getElementById("pilot-chip");
      if (el) el.textContent = "DESK ERROR. " + (err && err.message ? err.message : String(err));
      try { bind(); } catch (e2) {}
    }
    loadAirports();
    hydrateStore().then(function () {
      try { reloadFromStorage(); } catch (e) {}
      try { renderPilotChip(); renderLog(); renderBook(); renderHangar(); renderAirline(); renderAircraft(); renderDep(); } catch (e) {}
    });
  }

  boot();
})();
