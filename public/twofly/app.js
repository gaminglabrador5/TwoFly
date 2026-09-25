/* TwoFly — simple MSFS mission generator */
(function () {
  window.__twoflyReady = true;
  const VERSION = "1.9.69";
  let sessionFlights = 0;
  let sessionHard = 0;
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  let audioCtx = null;
  let masterGain = null;
  function soundEnabled() {
    return !(state && state.profile && state.profile.soundOn === false);
  }
  function ensureAudio() {
    if (!soundEnabled()) return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!audioCtx) {
      audioCtx = new AC();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 0.55;
      masterGain.connect(audioCtx.destination);
    }
    if (audioCtx.state === "suspended") audioCtx.resume().catch(function () {});
    return audioCtx;
  }
  function envGain(ctx, peak, dur, delay) {
    const g = ctx.createGain();
    const t = ctx.currentTime + (delay || 0);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(masterGain || ctx.destination);
    return { g: g, t: t };
  }
  function tone(freq, dur, type, peak, delay, slide) {
    const ctx = ensureAudio();
    if (!ctx) return;
    const eg = envGain(ctx, peak || 0.16, dur, delay);
    const o = ctx.createOscillator();
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq, eg.t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, eg.t + dur);
    o.connect(eg.g);
    o.start(eg.t);
    o.stop(eg.t + dur + 0.03);
  }
  function noise(dur, peak, freq, delay) {
    const ctx = ensureAudio();
    if (!ctx) return;
    const n = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = freq || 1800;
    f.Q.value = 0.9;
    const eg = envGain(ctx, peak || 0.18, dur, delay);
    src.connect(f);
    f.connect(eg.g);
    src.start(eg.t);
  }
  let lastUiSound = 0;
  function sfx(kind) {
    if (!soundEnabled()) return;
    if (kind === "tab" || kind === "select") kind = "click";
    if (kind === "click") {
      const now = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
      if (now - lastUiSound < 45) return;
      lastUiSound = now;
    }
    ensureAudio();
    switch (kind) {
      case "click":
        noise(0.018, 0.16, 3200, 0);
        tone(2100, 0.028, "square", 0.045, 0);
        break;
      case "tab":
        sfx("click");
        break;
      case "issue":
        tone(1568, 0.045, "triangle", 0.14, 0);
        tone(1865, 0.05, "triangle", 0.12, 0.07);
        tone(2093, 0.09, "sine", 0.16, 0.14);
        noise(0.08, 0.08, 1400, 0.16);
        break;
      case "select":
        sfx("click");
        break;
      case "accept":
        tone(880, 0.09, "sine", 0.18, 0);
        tone(1320, 0.14, "sine", 0.16, 0.08);
        break;
      case "complete":
        tone(523.25, 0.16, "sine", 0.2, 0);
        tone(659.25, 0.18, "sine", 0.18, 0.09);
        tone(783.99, 0.28, "sine", 0.22, 0.18);
        tone(1046.5, 0.22, "triangle", 0.08, 0.28);
        break;
      case "abort":
        noise(0.08, 0.16, 400, 0);
        tone(220, 0.18, "triangle", 0.16, 0, 110);
        break;
      case "money":
        tone(1318, 0.08, "sine", 0.14, 0);
        tone(1760, 0.14, "sine", 0.16, 0.06);
        break;
      case "stamp":
        noise(0.09, 0.28, 900, 0);
        tone(140, 0.12, "square", 0.08, 0);
        break;
      case "ach":
        tone(784, 0.12, "sine", 0.16, 0);
        tone(988, 0.14, "sine", 0.16, 0.1);
        tone(1319, 0.28, "sine", 0.2, 0.2);
        break;
      case "error":
        tone(180, 0.16, "sawtooth", 0.1, 0);
        noise(0.1, 0.1, 500, 0);
        break;
      default:
        sfx("click");
    }
  }

  const AIRCRAFT = (window.TWOFY_AIRCRAFT || []).filter((a) => a && a.id);

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
    { id: "official", label: "OFFICIAL", emoji: "" },
    { id: "courier", label: "COURIER", emoji: "" },
    { id: "rotation", label: "ROTATION", emoji: "" },
    { id: "bush", label: "FIELD RESUPPLY", emoji: "" },
    { id: "medevac", label: "MEDEVAC", emoji: "" },
    { id: "ferry", label: "REPOSITION", emoji: "" },
  ];

  const HOPS = {
    brief: [15, 30],
    short: [25, 100],
    medium: [150, 300],
    long: [500, 1000],
    xl: [1000, 20000],
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
    depPaved: false,
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
    pendingAccept: null,
    pendingRide: null,
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
          if (cityHitsAirport(ap, ct)) cities.add(ct.id);
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
    const airline = m && m.mode ? m.mode === "airline" : state.mode === "airline";
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
    {
      n: 1, name: "STUDENT PILOT", xp: 0,
      unlock: ["piston", "bush", "vintage", "airship"],
      types: ["cargo", "pax", "ferry"],
      hopMax: 180,
      slots: 1,
      jobs: ["Basic piston aircraft", "Local passenger hops", "Light cargo", "Repositioning"],
      note: "Short visual legs and the aircraft that forgive a student.",
      award: { money: 0, xp: 0 },
    },
    {
      n: 2, name: "PRIVATE PILOT", xp: 4000,
      unlock: ["helo", "evtol"],
      types: ["cargo", "pax", "ferry", "bush"],
      hopMax: 320,
      slots: 2,
      jobs: ["Rotorcraft", "Field resupply", "Remote strips", "Longer passenger work"],
      note: "People and cargo go farther, including unpaved fields and helicopters.",
      award: { money: 2500, xp: 500 },
    },
    {
      n: 3, name: "INSTRUMENT RATING", xp: 10000,
      unlock: [],
      types: ["cargo", "pax", "ferry", "bush", "express"],
      hopMax: 520,
      slots: 4,
      jobs: ["Express cargo", "IFR taskings", "Weather-sensitive deliveries", "Longer routes"],
      note: "Instrument Flight Rules let you fly by reference to the gauges when the weather is down.",
      award: { money: 15000, xp: 400 },
      rating: true,
    },
    {
      n: 4, name: "COMMERCIAL PILOT", xp: 22000,
      unlock: ["turboprop"],
      types: ["cargo", "pax", "ferry", "bush", "express", "vip", "medevac", "official", "courier", "rotation"],
      hopMax: 900,
      slots: 6,
      jobs: ["Turboprops", "VIP passengers", "Official flights", "Medevac", "Higher-value cargo"],
      note: "Turboprops and paid passenger work. The flying is the job now.",
      award: { money: 25000, xp: 600 },
    },
    {
      n: 5, name: "ATP", xp: 50000,
      unlock: ["jet", "airliner"],
      types: ["cargo", "pax", "ferry", "bush", "express", "vip", "medevac", "official", "courier", "rotation"],
      hopMax: 99999,
      slots: 10,
      jobs: ["Jets and airliners", "Long-distance express", "High-value passenger work"],
      note: "Airline Transport Pilot. Jets, long legs, and the work that pays like it.",
      award: { money: 60000, xp: 1000 },
    },
  ];

  const PILOT_MARKS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16"];

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
      serviceOn: true,
      clock12: false,
      interestOn: true,
      lastInterestAt: Date.now(),
      soundOn: true,
      hudScale: 100,
      simWatch: false,
      reviewsOn: true,
      repSum: 0,
      repN: 0,
      reviews: [],
      hangar: ["c172g"],
      leases: {},
      lastLeaseAt: Date.now(),
      showAirline: true,
      hours: {},
      sinceService: {},
      tails: {},
      currency: "USD",
      units: "us",
      sim: "both",
      tempUnit: "C",
      home: "",
      debt: 0,
      certN: 1,
      stats: emptyStats(),
    };
  }

  function emptyStats() {
    return {
      aborts: 0,
      services: {},
      boughtAt: {},
      sold: 0,
      cashBuys: 0,
      pediaOpens: {},
      repaid: 0,
      borrowed: 0,
      lastDay: "",
      clean: 0,
      recentDests: [],
    };
  }

  function pilotStats() {
    if (!state.profile.stats || typeof state.profile.stats !== "object") state.profile.stats = emptyStats();
    const s = state.profile.stats;
    s.services = s.services && typeof s.services === "object" ? s.services : {};
    s.boughtAt = s.boughtAt && typeof s.boughtAt === "object" ? s.boughtAt : {};
    s.pediaOpens = s.pediaOpens && typeof s.pediaOpens === "object" ? s.pediaOpens : {};
    return s;
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
        units: raw.units === "us" || raw.units === "eu" ? raw.units : (raw.units === "imperial" ? "us" : raw.units === "metric" ? "eu" : "us"),
        sim: raw.sim === "20" || raw.sim === "24" ? raw.sim : "both",
        tempUnit: raw.tempUnit === "F" ? "F" : "C",
        home: typeof raw.home === "string" ? raw.home : "",
        debt: Number.isFinite(raw.debt) ? Math.max(0, raw.debt) : (raw.loan && Number.isFinite(raw.loan.remaining) ? Math.max(0, raw.loan.remaining) : 0),
        stats: raw.stats && typeof raw.stats === "object" ? { ...emptyStats(), ...raw.stats } : emptyStats(),
        serviceOn: raw.serviceOn !== false,
        clock12: raw.clock12 === true,
        interestOn: raw.interestOn !== false,
        lastInterestAt: Number(raw.lastInterestAt) > 0 ? Number(raw.lastInterestAt) : Date.now(),
        soundOn: raw.soundOn !== false,
        hudScale: clampHud(raw.hudScale),
        simWatch: raw.simWatch === true,
        reviewsOn: raw.reviewsOn !== false,
        repSum: Number.isFinite(raw.repSum) ? raw.repSum : 0,
        repN: Number.isFinite(raw.repN) ? raw.repN : 0,
        reviews: Array.isArray(raw.reviews) ? raw.reviews.slice(0, 5) : [],
        leases: raw.leases && typeof raw.leases === "object" ? raw.leases : {},
        lastLeaseAt: Number(raw.lastLeaseAt) > 0 ? Number(raw.lastLeaseAt) : Date.now(),
        certN: Number.isFinite(raw.certN) ? Math.max(1, Number(raw.certN)) : 0,
      };
      out.certN = grandfatherCert(out.xp, out.certN);
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

  function licenseNFromXp(xp) {
    let n = 1;
    LICENSES.forEach((L) => {
      if ((xp || 0) >= L.xp) n = L.n;
    });
    return n;
  }

  function grandfatherCert(xp, saved) {
    const old = xp >= 18000 ? 5 : xp >= 7000 ? 4 : xp >= 4500 ? 3 : xp >= 2000 ? 2 : 1;
    const now = licenseNFromXp(xp);
    const held = Number(saved) > 0 ? Number(saved) : old;
    return Math.max(1, held, now);
  }

  function licenseFor(xp) {
    const x = xp == null ? ((state.profile && state.profile.xp) || 0) : xp;
    const held = Math.max(licenseNFromXp(x), Number(state.profile && state.profile.certN) || 0, 1);
    const cur = LICENSES.find((L) => L.n === held) || LICENSES[0];
    const next = LICENSES.find((L) => L.n === held + 1) || null;
    return { ...cur, next };
  }

  function hasIfr() {
    return licenseFor().n >= 3;
  }

  function wxCatOf(ap) {
    return (wxSnap(ap) || {}).cat || "";
  }

  function isImc(cat) {
    return cat === "IFR" || cat === "LIFR";
  }

  function missionImc(m) {
    if (!m) return false;
    return isImc(wxCatOf(m.dep)) || isImc(wxCatOf(m.dest));
  }

  function ifrIllegal(m) {
    if (!isCareer(m)) return false;
    if (!state.profile || !state.profile.locksOn) return false;
    if (hasIfr()) return false;
    return missionImc(m);
  }

  function ifrFine(m) {
    if (!m) return { money: 800, xp: 50 };
    const pay = m.money || 0;
    const xp0 = m.xp || xpFor(m);
    const money = Math.max(800, Math.min(8000, Math.round((pay * 0.4) / 5) * 5));
    const xp = Math.max(50, Math.round(xp0 * 0.5));
    return { money, xp };
  }

  const IFR_FEE = 12000;
  const IFR_Q = [
    { q: "IFR stands for which set of rules?", a: ["Instrument Flight Rules", "International Flight Rules", "In-flight Restriction"], i: 0 },
    { q: "A report is IFR when which is true?", a: ["Ceiling below 1,000 ft or visibility below 3 SM", "Ceiling below 3,000 ft or visibility 5 SM or less", "Ceiling below 500 ft or visibility below 1 SM"], i: 0 },
    { q: "In IMC you fly primarily by:", a: ["Outside visual references", "The aircraft instruments", "Ground landmarks only"], i: 1 },
    { q: "You fly the missed approach when:", a: ["The runway environment is not in sight at the missed-approach point", "ATC is busy", "Fuel is below half"], i: 0 },
    { q: "Entering IMC without an instrument rating is:", a: ["A training shortcut", "An illegal IFR operation", "Allowed below 1,000 ft AGL"], i: 1 },
    { q: "Decision altitude is the height at which you must:", a: ["Have the runway environment in sight or go missed", "Begin the descent", "Level at pattern altitude"], i: 0 },
    { q: "Eastbound IFR cruise (0–179°) is flown at:", a: ["Odd thousands (FL190, FL210…)", "Even thousands", "Any convenient altitude"], i: 0 },
    { q: "Lost communications in IFR, the route to fly is:", a: ["Assigned, vectored, expected, then filed", "Direct to home field", "Descend immediately"], i: 0 },
  ];

  function ifrFee() {
    return state.profile && state.profile.moneyOn === false ? 0 : IFR_FEE;
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

  function isCareer(m) {
    if (m) return m.mode === "airline";
    return state.mode === "airline";
  }

  function modeTag(m) {
    return isCareer(m) ? "CAREER" : "FREE";
  }

  function careerTypeSet() {
    if (!isCareer() || !state.profile.locksOn) return null;
    const lic = licenseFor(state.profile.xp);
    return new Set(lic.types || TYPES.map((t) => t.id));
  }

  const ACH_PAY = {
    first: [800, 80],
    five: [1200, 100],
    twentyfive: [4000, 250],
    hundred: [12000, 800],
    hours10: [1500, 120],
    hours50: [5000, 400],
    hours100: [10000, 700],
    busy: [600, 60],
    session: [800, 80],
    butter10: [1500, 150],
    pro25: [4000, 300],
    clean10: [2000, 180],
    heavyA: [2500, 200],
    rough3: [400, 40],
    around: [700, 70],
    early: [500, 50],
    night: [500, 50],
    weekend: [1500, 150],
    streak: [2500, 250],
    home: [400, 40],
    fromhome: [3500, 300],
    pay: [600, 50],
    living: [5000, 400],
    bank: [2500, 200],
    fleet5: [3000, 250],
    hangar10: [6000, 400],
    debtfree: [1500, 100],
    cash: [800, 60],
    dealer: [400, 40],
    fleet100: [4000, 350],
    cats: [1500, 150],
    makers: [1500, 150],
    jack: [5000, 400],
    variety: [2500, 250],
    faithful: [4000, 400],
    fresh: [500, 50],
    mechanic: [800, 80],
    pc1: [400, 40],
    pc10: [2000, 180],
    pc25: [4500, 350],
    fields10: [1200, 120],
    fields25: [3500, 300],
    fields50: [8000, 600],
    lm1: [500, 50],
    lm10: [2000, 200],
    lm25: [5000, 400],
    album: [8000, 600],
    whole: [20000, 1200],
    vfr: [200, 20],
    mvfr: [600, 80],
    ifr: [2500, 250],
    lifr: [3500, 350],
    wxset: [4000, 400],
    wx10: [2500, 250],
    cross: [800, 80],
    fo: [1000, 100],
    rev10: [2500, 200],
    rev50: [8000, 600],
    alhome: [3500, 300],
    routes: [4000, 350],
    alfleet: [2500, 200],
    bush10: [2000, 200],
    med5: [3000, 300],
    soft: [500, 50],
    high: [600, 60],
    short: [800, 80],
    vintage: [600, 60],
    long: [2000, 200],
    far: [2500, 250],
    abort1: [50, 0],
    clean10: [2000, 200],
    legend: [2500, 250],
    empty: [400, 40],
    lied: [800, 80],
    scenic: [600, 60],
    abort3: [100, 0],
    pedia10: [300, 40],
    queen: [200, 20],
    know: [800, 80],
    verylong: [5000, 500],
  };
  const CERT_ACH = { priv: 2, inst: 3, comm: 4, atp: 5 };

  let splashQueue = [];

  function inHangar(id) {
    return state.profile.hangar.includes(id);
  }

  function ownsAirframe(id) {
    return !!(id && inHangar(id) && !isLeased(id));
  }

  function careerWear(m) {
    if (!m || (m.mode || state.mode) !== "airline") return false;
    const id = m.ac || (state.ac && state.ac.id);
    return !!(id && inHangar(id));
  }

  function serviceBlocks(id) {
    return state.mode === "airline" && inHangar(id) && needsService(id);
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
  const WEAR_DROP = 75;
  const USED_RATIO = 0.7;
  function hangarCap() {
    const lic = licenseFor(state.profile && state.profile.xp);
    return (lic && lic.slots) || 1;
  }

  function hangarFullMsg() {
    const lic = licenseFor(state.profile && state.profile.xp);
    const cap = hangarCap();
    const next = LICENSES.find((l) => l.n === (lic && lic.n) + 1);
    if (!next) return `HANGAR AT CAPACITY (${cap}).`;
    return `HANGAR AT CAPACITY (${cap}). ${next.name} RAISES IT TO ${next.slots}.`;
  }

  function sinceService(id) {
    return (state.profile.sinceService && state.profile.sinceService[id]) || 0;
  }

  function airframeHours(id) {
    return (state.profile.hours && state.profile.hours[id]) || 0;
  }

  function healthPct(id) {
    if (!state.profile || state.profile.serviceOn === false) return 100;
    const pct = 100 - (sinceService(id) / SERVICE_HRS) * WEAR_DROP;
    return Math.max(0, Math.round(pct * 10) / 10);
  }

  function healthColor(pct) {
    const t = Math.max(0, Math.min(1, pct / 100));
    const r = Math.round(196 + (46 - 196) * t);
    const g = Math.round(74 + (140 - 74) * t);
    const b = Math.round(58 + (72 - 58) * t);
    return `rgb(${r},${g},${b})`;
  }

  function healthHtml(id) {
    const pct = healthPct(id);
    return `<span class="health" style="color:${healthColor(pct)}">${Math.round(pct)}%</span>`;
  }

  function grounded(id) {
    return !!(state.profile && state.profile.serviceOn && healthPct(id) <= 0);
  }

  function needsService(id) {
    return grounded(id);
  }

  function repairCost(ac) {
    if (!ac) return 0;
    const missing = Math.max(0, 100 - healthPct(ac.id));
    if (missing <= 0) return 0;
    return Math.max(50, Math.round((listPrice(ac) * 0.02 * (missing / WEAR_DROP)) / 50) * 50);
  }

  function sellPrice(ac) {
    if (!ac) return 0;
    const sound = listPrice(ac) * USED_RATIO;
    const pct = healthPct(ac.id) / 100;
    const scrap = sound * 0.1;
    return Math.round(scrap + (sound - scrap) * pct);
  }

  function creditLimit() {
    const n = licenseFor(state.profile.xp).n;
    return [80000, 280000, 550000, 1400000, 8500000][n - 1] || 80000;
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
    if (amt > creditLeft()) return "EXCEEDS AVAILABLE CREDIT.";
    const principal = debtPrincipal();
    state.profile.debt = (state.profile.debt || 0) + amt;
    state.profile.debtPrincipal = principal + amt;
    state.profile.money += amt;
    if (!state.profile.lastInterestAt) state.profile.lastInterestAt = Date.now();
    const st = pilotStats();
    st.borrowed = (st.borrowed || 0) + amt;
    saveProfile();
    return "";
  }

  function loanRepay(amt) {
    amt = Math.round(parseMoneyIn(amt) || Number(amt) || 0);
    if (amt <= 0) return "ENTER AMOUNT.";
    amt = Math.min(amt, state.profile.debt || 0, state.profile.money);
    if (amt <= 0) return "NOTHING TO REPAY.";
    const principal = debtPrincipal();
    const interestOwed = Math.max(0, (state.profile.debt || 0) - principal);
    const fromPrincipal = Math.max(0, amt - interestOwed);
    state.profile.debt -= amt;
    state.profile.debtPrincipal = Math.max(0, principal - fromPrincipal);
    state.profile.money -= amt;
    if (state.profile.debt === 0) {
      state.profile.debtPrincipal = 0;
      state.profile.lastInterestAt = Date.now();
      pilotStats().repaid = (pilotStats().repaid || 0) + 1;
    }
    saveProfile();
    return "";
  }

  const INTEREST_APR = 0.08;
  const INTEREST_CAP = 0.25;

  function debtPrincipal() {
    const p = state.profile;
    if (!p) return 0;
    if (p.debtPrincipal == null || !Number.isFinite(Number(p.debtPrincipal))) p.debtPrincipal = p.debt || 0;
    p.debtPrincipal = Math.max(0, Math.min(Number(p.debtPrincipal) || 0, p.debt || 0));
    return p.debtPrincipal;
  }

  function accrueInterest() {
    const p = state.profile;
    if (!p) return 0;
    const now = Date.now();
    if (!p.interestOn) {
      p.lastInterestAt = now;
      return 0;
    }
    const last = Number(p.lastInterestAt) || now;
    if (!p.lastInterestAt) {
      p.lastInterestAt = now;
      return 0;
    }
    let days = Math.floor((now - last) / 86400000);
    if (days < 1) return 0;
    p.lastInterestAt = last + days * 86400000;
    const principal = debtPrincipal();
    if (principal <= 0) {
      saveProfile();
      return 0;
    }
    const unpaid = Math.max(0, (p.debt || 0) - principal);
    const room = Math.max(0, Math.round(principal * INTEREST_CAP) - unpaid);
    const raw = Math.round(principal * INTEREST_APR * days / 365);
    const charge = Math.max(0, Math.min(raw, room));
    if (charge > 0) p.debt = (p.debt || 0) + charge;
    saveProfile();
    return charge;
  }

  function accrueLease() {
    const p = state.profile;
    if (!p) return [];
    p.leases = p.leases && typeof p.leases === "object" ? p.leases : {};
    const now = Date.now();
    if (!p.moneyOn) {
      p.lastLeaseAt = now;
      return [];
    }
    const last = Number(p.lastLeaseAt) || now;
    let days = Math.floor((now - last) / 86400000);
    if (days < 1) return [];
    days = Math.min(days, 7);
    p.lastLeaseAt = last + days * 86400000;
    const ids = Object.keys(p.leases || {});
    const notes = [];
    ids.forEach((id) => {
      if (!inHangar(id)) {
        delete p.leases[id];
        return;
      }
      const ac = AIRCRAFT.find((a) => a.id === id);
      if (!ac) {
        delete p.leases[id];
        return;
      }
      const due = leaseRate(ac) * days;
      if (p.money >= due) {
        p.money -= due;
        p.leases[id].last = now;
        p.leases[id].paid = (p.leases[id].paid || 0) + due;
        if (p.leases[id].paid >= listPrice(ac)) {
          delete p.leases[id];
          notes.push({ id, name: ac.name, due, kept: true, owned: true });
        } else {
          notes.push({ id, name: ac.name, due, kept: true });
        }
      } else {
        notes.push({ id, name: ac.name, due, kept: false });
        p.hangar = p.hangar.filter((x) => x !== id);
        delete p.leases[id];
        if (state.ac && state.ac.id === id) {
          const next = AIRCRAFT.find((a) => a.id === p.hangar[0]) || AIRCRAFT[0];
          state.ac = next;
          try { localStorage.setItem("twofly-ac", state.ac.id); } catch (e) {}
        }
      }
    });
    if (notes.length) saveProfile();
    return notes;
  }

  function settleDesk() {
    const interest = accrueInterest();
    const leases = accrueLease();
    if (interest || (leases && leases.length)) {
      renderHangar();
      renderPilotChip();
    }
    const gone = (leases || []).filter((n) => !n.kept);
    const owned = (leases || []).filter((n) => n.owned);
    if (gone.length || owned.length) {
      const note = $("#hangar-err");
      if (note) {
        note.hidden = false;
        const bits = [];
        if (owned.length) bits.push(owned.map((n) => n.name.toUpperCase() + " IS YOURS.").join(" "));
        if (gone.length) bits.push(gone.map((n) => n.name.toUpperCase() + " RETURNED — LEASE UNPAID.").join(" "));
        note.textContent = bits.join(" ");
      }
    }
  }

  function repairAircraft(id) {
    const ac = AIRCRAFT.find((a) => a.id === id);
    if (!ac || !inHangar(id)) return "NOT IN HANGAR.";
    if (healthPct(id) >= 100) return "AIRFRAME ALREADY AT 100%.";
    const cost = repairCost(ac);
    if (state.profile.moneyOn && state.profile.money < cost) return "INSUFFICIENT FUNDS.";
    if (state.profile.moneyOn) state.profile.money -= cost;
    state.profile.sinceService = state.profile.sinceService || {};
    state.profile.sinceService[id] = 0;
    const st = pilotStats();
    st.services[id] = (st.services[id] || 0) + 1;
    saveProfile();
    return "";
  }

  function liveTail() {
    return String((simSnap && simSnap.atcId) || "").trim().toUpperCase();
  }

  function liveCall() {
    const c = String((simSnap && simSnap.callsign) || "").trim().toUpperCase();
    const t = liveTail();
    if (!c || c === t) return "";
    return c;
  }

  function sortieTail() {
    if (!simSnap || !simSnap.connected) return "";
    return liveTail() || "TAIL UNKNOWN";
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

  function leaseRate(ac) {
    const price = listPrice(ac);
    return Math.max(80, Math.round((price * 0.002) / 10) * 10);
  }

  function isLeased(id) {
    const leases = (state.profile && state.profile.leases) || {};
    return !!leases[id];
  }

  function leasePaid(id) {
    const row = state.profile && state.profile.leases && state.profile.leases[id];
    return Math.max(0, Math.round((row && row.paid) || 0));
  }

  function leaseBuyout(id) {
    const ac = AIRCRAFT.find((a) => a.id === id);
    if (!ac) return 0;
    return Math.max(0, listPrice(ac) - leasePaid(id));
  }

  const CURRENCIES = [
    { id: "USD", name: "US DOLLAR", sym: "$", rate: 1 },
    { id: "EUR", name: "EURO", sym: "€", rate: 0.92 },
    { id: "JPY", name: "YEN", sym: "¥", rate: 148 },
    { id: "GBP", name: "POUND STERLING", sym: "£", rate: 0.79 },
    { id: "CNY", name: "YUAN", sym: "¥", rate: 7.2 },
    { id: "AUD", name: "AUSTRALIAN DOLLAR", sym: "A$", rate: 1.52 },
    { id: "CAD", name: "CANADIAN DOLLAR", sym: "C$", rate: 1.37 },
    { id: "CHF", name: "SWISS FRANC", sym: "CHF ", rate: 0.88 },
    { id: "HKD", name: "HONG KONG DOLLAR", sym: "HK$", rate: 7.8 },
    { id: "SGD", name: "SINGAPORE DOLLAR", sym: "S$", rate: 1.34 },
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
    if (state.profile.hangar.length >= hangarCap()) return hangarFullMsg();
    if (!airlineEligible(ac)) return "NOT AUTHORIZED FOR PASSENGER OR CARGO SERVICE.";
    if (state.profile.locksOn && !classUnlocked(ac.cls)) return "CERTIFICATE DOES NOT AUTHORIZE THIS CLASS.";
    const price = listPrice(ac);
    if (!state.profile.moneyOn) {
      state.profile.hangar.push(id);
      pilotStats().boughtAt[id] = new Date().toISOString();
      saveProfile();
      return "";
    }
    if (state.profile.money < price) return "INSUFFICIENT FUNDS.";
    state.profile.money -= price;
    state.profile.hangar.push(id);
    const st = pilotStats();
    st.boughtAt[id] = new Date().toISOString();
    st.cashBuys = (st.cashBuys || 0) + 1;
    saveProfile();
    return "";
  }

  function leaseAircraft(id) {
    const ac = AIRCRAFT.find((a) => a.id === id);
    if (!ac) return "AIRCRAFT NOT ON FILE.";
    if (inHangar(id)) return "ALREADY IN HANGAR.";
    if (state.profile.hangar.length >= hangarCap()) return hangarFullMsg();
    if (!airlineEligible(ac)) return "NOT AUTHORIZED FOR PASSENGER OR CARGO SERVICE.";
    if (state.profile.locksOn && !classUnlocked(ac.cls)) return "CERTIFICATE DOES NOT AUTHORIZE THIS CLASS.";
    const day = leaseRate(ac);
    if (state.profile.moneyOn && state.profile.money < day) return "INSUFFICIENT FUNDS FOR THE FIRST DAY.";
    if (state.profile.moneyOn) state.profile.money -= day;
    state.profile.hangar.push(id);
    state.profile.leases = state.profile.leases || {};
    state.profile.leases[id] = { since: Date.now(), last: Date.now(), paid: state.profile.moneyOn ? day : 0 };
    if (!state.profile.lastLeaseAt) state.profile.lastLeaseAt = Date.now();
    pilotStats().boughtAt[id] = new Date().toISOString();
    saveProfile();
    return "";
  }

  function returnLease(id) {
    if (!inHangar(id) || !isLeased(id)) return "NOT A LEASED AIRFRAME.";
    state.profile.hangar = state.profile.hangar.filter((x) => x !== id);
    delete state.profile.leases[id];
    if (state.ac && state.ac.id === id) {
      const next = AIRCRAFT.find((a) => a.id === state.profile.hangar[0]) || AIRCRAFT[0];
      state.ac = next;
      localStorage.setItem("twofly-ac", state.ac.id);
    }
    saveProfile();
    return "";
  }

  function buyOutLease(id) {
    if (!inHangar(id) || !isLeased(id)) return "NOT A LEASED AIRFRAME.";
    const remain = leaseBuyout(id);
    if (state.profile.moneyOn && state.profile.money < remain) return "INSUFFICIENT FUNDS TO BUY OUT.";
    if (state.profile.moneyOn && remain) state.profile.money -= remain;
    delete state.profile.leases[id];
    const st = pilotStats();
    st.cashBuys = (st.cashBuys || 0) + 1;
    saveProfile();
    return "";
  }

  function sellAircraft(id) {
    if (!inHangar(id)) return "NOT IN HANGAR.";
    if (isLeased(id)) return "LEASED AIRFRAMES ARE RETURNED, NOT SOLD.";
    const ac = AIRCRAFT.find((a) => a.id === id);
    const price = ac ? sellPrice(ac) : 0;
    const proceeds = price;
    if (state.profile.moneyOn) state.profile.money += Math.max(0, proceeds);
    state.profile.hangar = state.profile.hangar.filter((x) => x !== id);
    pilotStats().sold = (pilotStats().sold || 0) + 1;
    if (state.ac && state.ac.id === id) {
      const next = AIRCRAFT.find((a) => a.id === state.profile.hangar[0]) || AIRCRAFT[0];
      state.ac = next;
      localStorage.setItem("twofly-ac", state.ac.id);
    }
    saveProfile();
    return "";
  }

  function markSrc(id) {
    return "pilots/" + id + ".jpg?v=" + VERSION;
  }

  function ingestPhotoFallback(file, paint) {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      paint(img, img.naturalWidth || img.width, img.naturalHeight || img.height);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
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
    return `${a.id} — ${a.n}${city}`;
  }

  function shortApt(a) {
    return `${a.id}${a.c ? " · " + a.c : ""}`;
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function hopRange(ac, hopKey) {
    let lo, hi;
    if (hopKey !== "auto" && HOPS[hopKey]) {
      [lo, hi] = HOPS[hopKey];
      hi = Math.min(hi, ac.range * 0.82);
    } else {
      lo = 12;
      hi = Math.min(ac.range * 0.85, 1600);
      if (ac.cls === "helo" || ac.cls === "evtol") hi = Math.min(hi, 180);
    }
    if (isCareer() && state.profile.locksOn) {
      const cap = licenseFor(state.profile.xp).hopMax;
      if (cap) hi = Math.min(hi, cap);
    }
    return [lo, Math.max(lo + 5, hi)];
  }

  function canMedevac(ac) {
    if (!ac || ac.cls === "balloon" || ac.cls === "glider") return false;
    if ((ac.pax || 0) < 1) return false;
    if (ac.cls === "jet" || ac.cls === "airliner") return false;
    if (ac.cls === "turboprop") return (ac.pax || 0) <= 19 && (ac.payload || 0) < 8000;
    return ac.cls === "piston" || ac.cls === "bush" || ac.cls === "vintage" || ac.cls === "helo" || ac.cls === "evtol";
  }

  function planeTypes(ac) {
    if (!ac || ac.cls === "balloon" || ac.cls === "glider") return ["ferry"];
    const seats = (ac.pax || 0) > 0;
    const heavy = ac.cls === "jet" || ac.cls === "airliner";
    const pool = ["cargo", "express", "ferry", "courier"];
    if (seats) pool.push("pax", "vip", "official", "rotation");
    if (canMedevac(ac)) pool.push("medevac");
    if (!heavy && (ac.cls !== "turboprop" || (ac.pax || 0) <= 19)) pool.push("bush");
    return pool;
  }

  function allowedTypes(ac, pref) {
    let pool = planeTypes(ac);
    const cap = careerTypeSet();
    if (cap) pool = pool.filter((t) => cap.has(t));
    if (!pool.length) pool = ["ferry"];
    if (pref !== "any" && pool.includes(pref)) return [pref];
    if (pref !== "any") return allowedTypes(ac, "any");
    return pool.length ? pool : ["ferry"];
  }

  function dealTypes(ac, pref, n) {
    let pool = allowedTypes(ac, pref);
    let locked = pref;
    if (pref !== "any" && !(pool.length === 1 && pool[0] === pref)) {
      locked = "any";
      pool = allowedTypes(ac, "any");
    }
    if (militaryName(state.dep)) {
      const mil = pool.filter(militaryJob);
      pool = mil.length ? mil : allowedTypes(ac, "any").filter(militaryJob);
      if (!pool.length) pool = contractTypes(ac);
      if (!pool.length) pool = ["ferry"];
      if (!militaryJob(locked)) locked = "any";
    }
    if (!pool.length) return Array.from({ length: n }, () => "ferry");
    if (locked !== "any" || pool.length === 1) {
      return Array.from({ length: n }, () => pool[0]);
    }
    const out = [];
    let deck = [];
    while (out.length < n) {
      if (!deck.length) deck = shuffle(pool);
      out.push(deck.pop());
    }
    return out;
  }

  function payloadFor(type, ac) {
    if (type === "ferry") return { kind: "empty", text: "NIL PAYLOAD — REPOSITION", lbs: 0, pax: 0 };
    if (type === "courier") {
      const item = pick(["SEALED DISPATCH", "DIPLOMATIC BAG", "ORDERS"]);
      return { kind: "cargo", pax: 0, lbs: 30, item, text: item };
    }
    if (type === "official") {
      const max = Math.max(1, Math.min(ac.pax || 1, 4));
      const n = Math.random() < 0.62 ? 1 : 1 + Math.floor(Math.random() * max);
      const lbs = Math.min(ac.payload || 400, n * 190);
      return { kind: "pax", pax: n, lbs, item: "OFFICIAL", text: n === 1 ? `1 OFFICIAL / ${lbs} LB` : `${n} OFFICIALS / ${lbs} LB` };
    }
    if (type === "rotation") {
      const max = Math.max(1, ac.pax || 1);
      const n = Math.max(1, Math.min(max, 2 + Math.floor(Math.random() * max)));
      const lbs = Math.min(ac.payload || 400, n * 200);
      return { kind: "pax", pax: n, lbs, text: `${n} DUTY PAX / ${lbs} LB` };
    }
    if (type === "medevac") {
      const lbs = Math.min(ac.payload, 420 + Math.floor(Math.random() * 80));
      return { kind: "pax", pax: 1, lbs, item: "MEDICAL TEAM", text: `1 PATIENT / ${lbs} LB MEDICAL` };
    }
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
    const item = pick(CARGO);
    return { kind: "cargo", pax: 0, lbs, item, text: `${lbs} LB ${item}` };
  }

  function wxBits(ap) {
    const id = ap && (ap.id || ap);
    const hit = id && wxCache.get(id);
    const obs = hit && hit.obs;
    const d = obs && (obs.dec || obs);
    if (!d) return { cat: "", windKt: 0, gustKt: 0, wx: "" };
    return {
      cat: d.cat || "",
      windKt: d.windKt || 0,
      gustKt: d.gustKt || 0,
      wx: d.wx || "",
    };
  }

  function cargoPhrase(pay) {
    const raw = String((pay && pay.item) || "GENERAL CARGO").toLowerCase();
    return raw;
  }

  function militaryName(a) {
    const n = String((a && a.n) || "").toLowerCase();
    return /air force|\bafb\b|\braf\b|\bnas\b|air base|airbase|\bmilitary\b|army air|naval air|marine corps|\baaf\b|fliegerhorst|luftwaffe/.test(n);
  }

  function militaryJob(type) {
    return type === "official" || type === "courier" || type === "rotation" || type === "cargo" || type === "medevac";
  }

  function contractTypes(ac) {
    return ["official", "courier", "rotation"].filter((t) => {
      const got = allowedTypes(ac, t);
      return got.length === 1 && got[0] === t;
    });
  }

  function isRotor(ac) {
    return !!(ac && (ac.cls === "helo" || ac.cls === "evtol"));
  }

  function isAmphib(ac) {
    const n = ((ac && (ac.name || "") + " " + (ac.id || "")) || "").toLowerCase();
    return /goose|albatross|seastar|seaplane|floatplane|amphib/.test(n);
  }

  function listedRunway(a) {
    const rw = (a && a.rw) || 0;
    if (rw > 0) return rw;
    const k = fieldKind(a);
    if (k === "helipad" || k === "seaplane") return 0;
    return 1500;
  }

  function runwayTooShort(a, ac, frac) {
    if (!ac || isRotor(ac) || !(ac.minRwy > 0)) return false;
    const len = listedRunway(a);
    if (!(len > 0)) return false;
    return len < ac.minRwy * (frac || 1);
  }

  function fieldKind(a) {
    if (!a) return "field";
    const n = String(a.n || "").toLowerCase();
    if (a.t === "H" || /heliport|helipad/.test(n)) return "helipad";
    if (a.t === "W" || /seaplane|water aerodrome/.test(n)) return "seaplane";
    if (/air force|\bafb\b|\braf \b|\bnas \b|air base|airbase|military/.test(n)) return "military";
    if (/international|sunport/.test(n) || (a.t === "L" && (a.rw || 0) >= 8000)) return "international";
    if (/regional/.test(n) || (a.t === "M" && a.pv && (a.rw || 0) >= 5500)) return "regional";
    if (/municipal|\bmuni\b/.test(n) || a.t === "M" || (a.t === "S" && a.pv && (a.rw || 0) >= 4000)) return "municipal";
    if (!a.pv || (a.rw || 0) < 2500 || a.t === "S") return "strip";
    return "municipal";
  }

  function isMountainField(a) {
    if (!a) return false;
    const id = String(a.id || "").toUpperCase();
    if (["LOWI", "LSZS", "LFLJ", "VQPR", "VNLK", "KASE", "KTEX", "KAVX", "LPMA", "TNCM"].includes(id)) return true;
    const el = a.el || 0;
    const rw = a.rw || 0;
    const k = fieldKind(a);
    if (k === "helipad" || k === "international") return false;
    if (k === "strip" && el >= 4000) return true;
    if (el >= 8000 && rw && rw < 9000) return true;
    if (el >= 6000 && rw && rw < 6000) return true;
    return false;
  }

  function fieldKindLabel(kind) {
    return ({
      helipad: "HELIPAD",
      seaplane: "SEAPLANE BASE",
      military: "MILITARY FIELD",
      international: "INTERNATIONAL",
      regional: "REGIONAL",
      municipal: "MUNICIPAL",
      strip: "BUSH STRIP",
      field: "AIRFIELD",
    })[kind] || "AIRFIELD";
  }

  function careRank(a) {
    const k = fieldKind(a);
    if (k === "helipad") return 5;
    if (k === "international") return 4;
    if (k === "regional") return 3;
    if (k === "municipal") return 1;
    return 0;
  }

  function medevacRange(ac) {
    const hi = Math.min(ac.range * 0.9, isRotor(ac) ? 220 : 520);
    return [35, Math.max(hi, 90)];
  }

  function careLocale(dep, a) {
    return {
      rg: !!(dep && a && dep.rg && a.rg && dep.rg === a.rg),
      cc: !!(dep && a && dep.cc && a.cc && dep.cc === a.cc),
    };
  }

  function destFit(type, a, ac, dist) {
    const k = fieldKind(a);
    if (type === "rotation") {
      if (!militaryName(a)) return -999;
      if (k === "helipad" && !isRotor(ac)) return -999;
      return 84;
    }
    if (type === "official" || type === "courier") {
      if (k === "helipad" && !isRotor(ac)) return -999;
      if (militaryName(a)) return type === "official" ? 90 : 78;
      if (k === "international") return 80;
      if (k === "regional") return 66;
      if (k === "municipal") return 52;
      if (k === "strip") return 24;
      if (k === "helipad") return 70;
      return 40;
    }
    if (militaryName(a) && !militaryJob(type)) return -999;
    const rotor = isRotor(ac);
    const d = dist || 0;
    const loc = careLocale(state.dep, a);
    const near = Math.max(0, 36 - d / 8);
    if (k === "helipad") {
      if (!rotor) return -999;
      if (type === "medevac") {
        const fromPad = fieldKind(state.dep) === "helipad";
        if (fromPad && d < 20) return 28;
        return 160 + (loc.rg ? 80 : loc.cc ? 28 : 0) + near;
      }
      return 32;
    }
    if (type === "bush") {
      if (k === "strip") return 95;
      if (k === "municipal") return 45;
      if (k === "regional") return 20;
      if (k === "international") return 4;
      return 25;
    }
    if (type === "medevac") {
      const from = careRank(state.dep);
      const to = careRank(a);
      if (k === "strip") return -1;
      if (militaryName(a) && k !== "helipad") return 120;
      if (to < from && k !== "helipad") return 4;
      if (k === "international") return 130 + (loc.rg ? 90 : loc.cc ? 35 : 0) + near;
      if (k === "regional") return 48 + (loc.rg ? 45 : loc.cc ? 12 : 0) + near * 0.5;
      if (k === "municipal") return d < 40 ? 2 : 8;
      return 2;
    }
    if (type === "vip") {
      if (k === "international") return 80;
      if (k === "regional") return 65;
      if (k === "municipal") return 40;
      return 22;
    }
    if (k === "international") return 58;
    if (k === "regional") return 62;
    if (k === "municipal") return 50;
    if (k === "strip") return 22;
    return 35;
  }

  function pickDest(cands, type, ac) {
    let list = cands || [];
    if (type === "medevac") {
      const care = list.filter((c) => {
        const k = fieldKind(c.a);
        return k === "helipad" || k === "international" || k === "regional" || militaryName(c.a);
      });
      if (care.length) list = care;
    }
    const scored = list.map((c) => ({ ...c, fit: destFit(type, c.a, ac, c.d) })).filter((c) => c.fit > 10);
    if (!scored.length) return null;
    scored.sort((a, b) => b.fit - a.fit);
    const best = scored[0].fit;
    const slack = type === "medevac" ? 18 : 35;
    const cap = type === "medevac" ? 3 : 8;
    const pool = scored.filter((c) => c.fit >= best - slack);
    return pool[Math.floor(Math.random() * Math.min(pool.length, cap))] || scored[0];
  }

  function placeName(dest) {
    if (!dest) return dest && dest.id ? dest.id : "the field";
    if (fieldKind(dest) === "helipad") {
      const n = String(dest.n || "").replace(/\s+helipad$/i, "");
      return n || dest.c || dest.id || "the pad";
    }
    return dest.c || dest.n || dest.id || "the field";
  }

  function isNightHop(m) {
    if (!m || !m.depTime) return false;
    const h = hourInTz(m.depTime, m.dep);
    return h >= 20 || h < 6;
  }

  function whyLine(type, place, pay, dest) {
    const n = (pay && pay.pax) || 0;
    const item = cargoPhrase(pay);
    if (type === "medevac") {
      return pick([
        `There's a patient who needs a higher level of care in ${place}.`,
        `Air ambulance to ${place}. They're transferring to a hospital there.`,
        `You've got a medevac going to ${place}.`,
        `A patient needs to be transferred to ${place}.`,
        `Medical transfer to ${place}. Time matters.`,
        `There's a patient waiting for transport to ${place}.`,
        `You've got a medical transfer on the board. Destination: ${place}.`,
        `A patient needs care in ${place}. You're taking them there.`,
        `Medical transport to ${place}. Get them there safely and keep the approach steady.`,
        `Someone needs a hospital in ${place}. You've got the flight.`,
      ]);
    }
    if (type === "official") {
      if (n <= 1) return pick([
        `A general is expected in ${place}. Keep the ride quiet.`,
        `There's a minister on the board for ${place}. The arrival should look planned.`,
        `A head of state needs to be in ${place}. No surprises.`,
        `You've got an ambassador going to ${place}. Treat it like the airplane is being watched.`,
        `One official passenger for ${place}. They're not up here for the view.`,
        `A flag officer is going to ${place}. Make the approach look routine.`,
        `There's a president on this one. Destination ${place}. Smooth, and on time.`,
        `Priority passenger with a title, headed to ${place}.`,
      ]);
      return pick([
        `${n} officials are going to ${place}. This is not a sightseeing hop.`,
        `A delegation of ${n} is booked for ${place}. Keep the cabin settled.`,
        `You've got ${n} people from an official party. Their destination is ${place}.`,
        `${n} passengers, and one of them outranks the weather. ${place}.`,
        `An official party of ${n} is going to ${place}. Nothing about this one is casual.`,
      ]);
    }
    if (type === "courier") {
      return pick([
        `A sealed dispatch needs to be in ${place}. It does not leave your sight.`,
        `There's a pouch for ${place}. Someone will meet you on the ramp.`,
        `Orders are going to ${place}. Don't set them down.`,
        `You've got a diplomatic bag for ${place}. It rides up front with you.`,
        `A courier run to ${place}. The cargo is paper, and it still matters.`,
        `There's a case for ${place}. You hand it to a person, not a warehouse.`,
        `${place} is waiting on a sealed bag. You're the courier.`,
      ]);
    }
    if (type === "rotation") {
      const crew = n > 1 ? n : "";
      return pick([
        `A duty change is going to ${place}. They're not on holiday.`,
        crew ? `${crew} personnel are rotating through ${place}.` : `Personnel are rotating through ${place}.`,
        `You've got a crew change for ${place}. Get them there and let them sleep.`,
        crew ? `Relief crew for ${place}. ${crew} people, and they've already had a long week.` : `Relief crew for ${place}. They've already had a long week.`,
        `There's a rotation into ${place}. The next watch is waiting on them.`,
        crew ? `${crew} people are due at ${place}. No speeches, just the flight.` : `People are due at ${place}. No speeches, just the flight.`,
      ]);
    }
    if (type === "pax") {
      if (n <= 1) return pick([
        `Someone needs a ride to ${place}.`,
        `One passenger is waiting for a flight to ${place}.`,
        `You've got a passenger going to ${place}.`,
        `One passenger, one destination: ${place}.`,
        `There's a passenger waiting on the ramp for ${place}.`,
        `One passenger needs to get over to ${place}.`,
        `You've got one person booked for ${place}. Try not to make them regret choosing air travel.`,
        `One passenger is ready to go to ${place}. The airplane is waiting on you.`,
        `There's one passenger on the board for ${place}. Nice and simple.`,
        `You've got a single passenger heading to ${place}. Easy money, if you behave yourself.`,
      ]);
      return pick([
        `${n} passengers are heading to ${place} and need a ride over.`,
        `There are ${n} passengers waiting for a flight to ${place}.`,
        `You've got a flight going to ${place} with ${n} passengers.`,
        `${n} passengers are booked for ${place}.`,
        `You've got ${n} people waiting to head over to ${place}.`,
        `A group of ${n} passengers is ready for the trip to ${place}.`,
        `${n} passengers are waiting on the ramp. Their destination is ${place}.`,
        `You've got ${n} passengers and one job: get them to ${place}.`,
        `${n} people are counting on you to get them to ${place} without making the trip interesting.`,
        `${n} passengers are headed to ${place}. Smooth flight, happy passengers.`,
      ]);
    }
    if (type === "vip") {
      if (n <= 1) return pick([
        `Priority passenger heading to ${place}. They'd like a smooth ride.`,
        `One passenger needs a ride to ${place}. Nothing fancy, just treat it like a charter.`,
        `You've got a priority passenger going to ${place}. Keep things comfortable.`,
        `One priority passenger is booked for ${place}. They'd prefer not to spend all afternoon bouncing around.`,
        `Priority passenger for ${place}. Give them the nice flight.`,
        `One passenger is heading to ${place} on priority service. Keep the ride smooth.`,
        `You've got one priority passenger aboard. Destination: ${place}. Make a good impression.`,
        `Priority passenger going to ${place}. No pressure. Just don't give them a story to tell afterward.`,
      ]);
      return pick([
        `${n} passengers are heading to ${place} and need a ride over.`,
        `Priority flight to ${place} with ${n} passengers.`,
        `You've got ${n} priority passengers headed to ${place}.`,
        `${n} passengers are booked on a priority flight to ${place}.`,
        `Priority passengers are waiting for ${place}. There are ${n} of them.`,
        `${n} priority passengers are ready to go. Their destination is ${place}.`,
        `You've got ${n} passengers aboard and a priority destination: ${place}.`,
        `Priority trip to ${place} with ${n} passengers. Keep it smooth.`,
      ]);
    }
    if (type === "express") {
      return pick([
        `A delivery of ${item} needs to get to ${place} today.`,
        `There's a shipment of ${item} headed to ${place}. Time matters on this one.`,
        `${item.charAt(0).toUpperCase() + item.slice(1)} headed to ${place}. Don't linger on the ramp.`,
        `This shipment of ${item} needs to reach ${place} sooner rather than later.`,
        `You've got an express load of ${item} for ${place}.`,
        `${item.charAt(0).toUpperCase() + item.slice(1)} needs to be in ${place} today. The clock is running.`,
        `There's no sightseeing requirement on this one. ${item} needs to get to ${place}.`,
        `This one's moving on the fast track. ${item} is headed to ${place}.`,
        `The shipment is ready, the destination is ${place}, and somebody is waiting on it.`,
        `You've got ${item} going to ${place}. Try not to let the day get away from you.`,
      ]);
    }
    if (type === "bush") {
      return pick([
        `A few boxes of ${item} are headed out to ${place}.`,
        `There's a shipment of ${item} headed to ${place}.`,
        `${place} is waiting on a delivery of ${item}.`,
        `Supplies are going into ${place}. You're carrying ${item}.`,
        `A field crew is waiting on ${item} in ${place}.`,
        `You've got a resupply run to ${place}. ${item} is going along for the ride.`,
        `There's a remote outpost waiting on ${item}. Destination: ${place}.`,
        `The folks at ${place} are running low. You've got ${item} for them.`,
        `Time for a supply run. ${item} is headed to ${place}.`,
        `Someone out there needs supplies, and apparently you're the delivery service today.`,
      ]);
    }
    if (type === "ferry") {
      return pick([
        `The aircraft needs to be moved over to ${place}.`,
        `The aircraft is needed in ${place}, so you're taking it over there empty.`,
        `You're taking this one empty to ${place}.`,
        `This aircraft needs to be in ${place} for its next job.`,
        `No passengers, no cargo. Just move the aircraft to ${place}.`,
        `You've got an empty reposition to ${place}.`,
        `The airplane needs to be somewhere else. That somewhere is ${place}.`,
        `This one's a simple ferry. Destination: ${place}.`,
        `Nothing to pick up, nothing to drop off. Just get the aircraft to ${place}.`,
        `The next job is waiting in ${place}. Your job is getting the airplane there.`,
      ]);
    }
    return pick([
      `There's a shipment of ${item} headed to ${place}.`,
      `A delivery of ${item} is ready to go to ${place}.`,
      `A few boxes of ${item} are headed out to ${place}.`,
      `You've got a load of ${item} going to ${place}.`,
      `${item.charAt(0).toUpperCase() + item.slice(1)} needs a ride to ${place}.`,
      `There's some ${item} waiting on the ramp for ${place}.`,
      `The folks in ${place} are waiting on a shipment of ${item}.`,
      `We've got ${item} going out to ${place}. Nothing unusual, just get it there.`,
      `This load of ${item} has a destination: ${place}.`,
      `There's a delivery waiting for ${place}. You're taking ${item}.`,
      `The ramp crew has a shipment of ${item} ready for ${place}.`,
      `You've got boxes, you've got an airplane, and you've got a destination: ${place}. The boxes contain ${item}.`,
      `Someone in ${place} is expecting ${item}. You're their ride.`,
    ]);
  }

  function wxTalk(dest) {
    const w = wxBits(dest);
    if (!w.cat) return "";
    const place = placeName(dest);
    const windy = (w.gustKt || 0) >= 22 || (w.windKt || 0) >= 18;
    const wx = String(w.wx || "").toUpperCase();
    const precip = /TS/.test(wx) ? "storms" : /SN|GR/.test(wx) ? "snow" : /RA|DZ|SH/.test(wx) ? "rain" : /FG/.test(wx) ? "fog" : /BR/.test(wx) ? "mist" : /HZ|FU/.test(wx) ? "haze" : "";
    if (w.cat === "LIFR") {
      return pick([
        "It's pretty socked in at the destination. Give yourself extra room on the approach.",
        "The weather at the other end is poor. Don't count on seeing the field until late.",
        `It's not exactly postcard weather at ${place}. Plan the instrument approach carefully.`,
        "The destination is buried in low conditions. Instruments are your friend today.",
        "Visibility is down and the ceiling isn't helping. Be ready for an instrument arrival.",
        `${place} is having one of those days. Don't expect to see the runway from very far out.`,
        "The field is socked in. Trust the instruments and fly the approach you planned.",
      ]);
    }
    if (w.cat === "IFR") {
      return pick([
        "Visibility isn't great around the destination. You'll want instruments on the way in.",
        "It's IFR at the destination, so plan the arrival rather than looking for the field.",
        "Conditions are below VFR at the other end. Plan accordingly.",
        "The destination is sitting in the clouds. Time to let the instruments do their job.",
        `Not much of a view waiting for you at ${place}. Fly the approach and let the runway come to you.`,
        "The weather has closed the curtains at the other end. Expect an instrument arrival.",
      ]);
    }
    if (precip === "storms") return pick([
      "There are thunderstorms in the area. Give them a wide berth.",
      "Cells are moving through the area. Don't go sightseeing through them.",
      "There's some serious weather around the destination. Keep your distance from the cells.",
      "Thunderstorms are active along the route. Pick your way around them.",
      `The sky is putting on a show near ${place}. Admire it from a safe distance.`,
      "There's weather building around the destination. Leave yourself some options.",
      "A few cells have decided to make your flight more interesting. Give them room.",
    ]);
    if (precip === "snow") return pick([
      "There's snow at the destination, so watch the runway.",
      `Snow is falling around ${place}. Take a little extra care on arrival.`,
      "The destination is getting a winter makeover. Keep the runway in mind.",
      "There's snow around the field. Your landing roll may have opinions about this.",
      `Winter has arrived at ${place}. Plan the arrival accordingly.`,
    ]);
    if (precip === "fog") return pick([
      "There's fog around the destination. Leave yourself some extra time inbound.",
      "The destination is sitting in fog. Visibility may not improve until late.",
      "There's a blanket of fog around the field. Don't expect to see much on the way in.",
      `Fog is hanging around ${place}. Keep the approach tidy.`,
      "The runway is somewhere under that fog. Fortunately, that's what approaches are for.",
    ]);
    if (windy) {
      return (w.gustKt || 0) > (w.windKt || 0) + 3
        ? pick([
          "There's a bit of wind along the route, gusty on the way in, so the approach may take a little more work.",
          "It's gusty at the destination. Keep some extra speed in your pocket for the arrival.",
          "The wind is getting lively at the other end. Be ready for a little work on final.",
          `It's breezy enough at ${place} to keep things interesting.`,
          "The destination has some attitude today. Watch the gusts on arrival.",
        ])
        : pick([
          "There's a bit of wind at the destination, so the approach may take a little more work than usual.",
          "The wind is up at the other end. Nothing dramatic, but keep it in mind.",
          `There's a steady wind at ${place}. Pick your runway carefully and settle in.`,
          "It's blowing at the destination. Not necessarily a problem, just something to respect.",
          "The wind is having its say at the other end today.",
        ]);
    }
    if (w.cat === "MVFR") {
      return pick([
        "It's a little murky at the destination. Nothing unusual, just keep an eye on it.",
        "Conditions are a little unsettled at the other end, so keep an eye on them.",
        `It's marginal at ${place}. Should be manageable, but don't get complacent.`,
        "The weather is sitting in that annoying middle ground. Keep an eye on conditions.",
        "It's not quite beautiful weather at the other end, but it's nothing to panic about.",
      ]);
    }
    if (precip === "rain") {
      return pick([
        "There's a little rain at the destination. Shouldn't be a problem.",
        "It's wet at the other end. Nothing dramatic.",
        `A bit of rain is moving through ${place}. Expect a wet arrival.`,
        "The destination is getting some rain. Nothing the airplane hasn't seen before.",
        "Bring your windshield wipers. It's wet at the other end.",
      ]);
    }
    if (precip === "haze" || precip === "mist") return pick([
      "It's a bit hazy at the destination, but you should still see the field.",
      `There's some haze around ${place}. Visibility should still be reasonable.`,
      "A little mist is hanging around the field. Keep an eye on visibility.",
      "The destination is a little hazy today. Nothing unusual, just don't expect perfect visibility.",
    ]);
    if (w.cat === "VFR" && Math.random() < 0.62) {
      return pick([
        "The weather is behaving itself for once.",
        "Weather looks good, so it should be an easy trip.",
        "The forecast looks good, although things can change once you're up there.",
        "Clear skies and a destination that isn't trying to hide from you. Enjoy it.",
        "Conditions look good at the other end.",
        "Nothing dramatic in the weather today. Just point the airplane and enjoy the view.",
        "The weather decided to cooperate. Take the win.",
      ]);
    }
    return "";
  }

  function fieldTalk(type, dest, dist, m) {
    if (!dest) return "";
    const kind = fieldKind(dest);
    const place = placeName(dest);
    if (kind === "helipad") return pick([
      "You're landing on a pad, not a runway.",
      "No runway waiting for you on this one. You're going into a pad.",
      "This one ends on a helipad. Plan accordingly.",
      `You're going into a pad at ${place}. Keep the landing area in mind.`,
    ]);
    if (kind === "strip" || !dest.pv) {
      return pick([
        "It's a short strip. Make sure you're set up before you get there.",
        "The destination is a little more remote than usual. Take your time with the approach.",
        "Short runway ahead. Have your landing plan sorted before you arrive.",
        "It's not exactly an airport with miles of pavement. Set yourself up early.",
        "The runway is short and probably isn't interested in giving you a second chance.",
      ]);
    }
    if (isMountainField(dest)) {
      return pick([
        "The destination is tucked into the mountains, so the approach deserves a little attention.",
        "You're heading into the mountains. Keep an eye on the terrain on arrival.",
        `There's plenty of terrain around ${place}. Don't leave the planning until final.`,
        "It's a mountain field. Beautiful scenery, less room for mistakes.",
        "The destination is tucked away in the mountains. Pick your approach carefully.",
        "Mountains on the horizon, runway somewhere in the middle. Plan ahead.",
      ]);
    }
    if (isNightHop(m)) {
      return pick([
        "It's a late one. The route is straightforward, but you'll be making most of it after dark.",
        "You'll be making most of this one after dark.",
        "This one's going to be a night flight. Make sure you're ready for the arrival.",
        "The sun won't be joining you for this one.",
        "You're heading out after dark. Time to see how good those runway lights really are.",
        `It's a nighttime run to ${place}. The world looks a little different from up there.`,
      ]);
    }
    if (type === "medevac" && Math.random() < 0.55) return pick([
      "Time matters, but so does a stable approach.",
      "There's a patient onboard. Get there promptly, but keep the arrival under control.",
      "The destination is important, but don't let the clock rush the approach.",
      "Get them there quickly and safely. Smooth hands on the controls.",
    ]);
    if (dist && dist < 80 && Math.random() < 0.7) return pick([
      "It's a short flight, so this one should be fairly straightforward.",
      `It's a quick hop over to ${place}.`,
      "Not much time in the air on this one.",
      "Short trip. You'll be there before you know it.",
      "This one's barely a trip by aviation standards. You're going to be there quickly.",
      `Quick hop to ${place}. Don't blink or you'll miss it.`,
    ]);
    if (dist && dist > 350 && Math.random() < 0.7) return pick([
      "It's a longer trip than most of the jobs on the board.",
      "This one's going to take a while. Settle in and enjoy the flight.",
      "You've got some distance to cover on this one.",
      "It's a long haul compared with most of the jobs on the board.",
      "This one will give the autopilot something to do.",
      `You've got a fair bit of sky between here and ${place}.`,
      "This isn't a quick hop. Pack a little patience.",
      "Long one today. Plenty of time to enjoy the scenery.",
    ]);
    return "";
  }

  function closeTalk(type) {
    if (Math.random() > 0.38) return "";
    if (type === "official") return pick([
      "Make the arrival look routine.",
      "They're on a schedule. So are you.",
      "Smooth, quiet, and on the numbers.",
      "Get them there. No stories afterward.",
    ]);
    if (type === "pax" || type === "vip") {
      return pick([
        "Get them there comfortably.",
        "Keep the arrival smooth.",
        "Give them a good flight.",
        "Get them there safely and comfortably.",
        "Make it a flight they'll remember for the right reasons.",
        "Smooth trip, happy passengers.",
        "Get them there in one piece and preferably smiling.",
      ]);
    }
    if (type === "courier") return pick([
      "Hand it to the person waiting.",
      "The bag gets there unopened.",
      "Don't leave it on the wing.",
      "Someone is waiting for that case. Don't be late with it.",
    ]);
    if (type === "rotation") return pick([
      "Get them there. The next watch is theirs.",
      "They're expected. Don't make them later.",
      "Drop the crew and you're done.",
    ]);
    if (type === "ferry") return pick([
      "Just get it there and you're done.",
      "Get the aircraft where it needs to be.",
      "Nothing fancy. Just deliver the aircraft.",
      "Drop it off and you're finished.",
      "No passengers, no cargo, no drama. Just get it there.",
      "Park it at the other end and call it a day.",
    ]);
    if (type === "express") return pick([
      "Get it there on time.",
      "Don't let this one sit around.",
      "The sooner it gets there, the better.",
      "Someone's waiting on that shipment.",
      "Time is the whole point of this one.",
      "Get moving. The clock isn't getting any slower.",
    ]);
    if (type === "medevac") return pick([
      "Keep it stable and get them in.",
      "Get them there safely.",
      "Smooth and steady on the arrival.",
      "Get them where they need to be.",
      "The priority is a safe arrival.",
      "Take care of the approach and get them on the ground.",
    ]);
    if (type === "bush") return pick([
      "Take your time with the approach.",
      "Get the supplies in safely.",
      "It's a remote field. Make the arrival a good one.",
      "Someone's waiting on that delivery.",
      "Get the supplies down and you're done.",
      "Make the field, make the delivery, head home.",
    ]);
    return pick([
      "Get it there in one piece.",
      "Deliver the load and you're done.",
      "Keep the cargo safe and get it to the other end.",
      "Get the boxes where they need to go.",
      "No heroics required. Just deliver the cargo.",
      "Keep the shiny side up and the cargo inside.",
      "Get it there. That's what they're paying you for.",
    ]);
  }

  function briefing(type, dep, dest, pay, dist, m) {
    const place = placeName(dest);
    const why = whyLine(type, place, pay, dest);
    const wx = wxTalk(dest);
    if (Math.random() < 0.18) return wx ? `${why} ${wx}` : why;
    const field = fieldTalk(type, dest, dist, m);
    const close = closeTalk(type);
    const parts = [why];
    if (wx) parts.push(wx);
    if (field && parts.length < 3) parts.push(field);
    if (close && parts.length < 3) parts.push(close);
    return parts.filter(Boolean).join(" ");
  }

  function refreshBriefs(list) {
    (list || []).forEach((m) => {
      if (!m) return;
      m.brief = briefing(m.type, m.dep, m.dest, m.pay, m.dist, m);
    });
  }

  function payout(type, dist, pay, ac) {
    const base = { cargo: 4.4, pax: 5.8, express: 6.8, vip: 8.4, official: 8.8, courier: 7.2, rotation: 6.2, bush: 6.2, medevac: 7.8, ferry: 2.6 }[type] || 5;
    const classMult = { piston: 1, bush: 1.1, vintage: 1.05, turboprop: 1.45, jet: 2.3, airliner: 3.5, helo: 1.65, evtol: 1.5 }[ac.cls] || 1;
    const load = pay.lbs * 0.12 + pay.pax * 110;
    return Math.round((520 + dist * base + load) * classMult / 5) * 5;
  }

  function constraints(ac, dest, type) {
    const bits = [];
    if (!dest) return bits;
    if (dest.rw) bits.push(`DEST RWY ${fmtField(dest.rw)}`);
    bits.push(dest.pv ? "PAVED" : "UNPAVED / UNKNOWN");
    if (dest.lt) bits.push("LIGHTING LISTED");
    if (dest.el && dest.el > 5000) bits.push(`ELEV ${fmtField(dest.el)}`);
    bits.push(fieldKindLabel(fieldKind(dest)));
    if (militaryName(dest) && fieldKind(dest) !== "military") bits.push("MILITARY FIELD");
    if (ac.minRwy && dest.rw && dest.rw < ac.minRwy + 400) bits.push("MARGINAL LANDING DISTANCE");
    if (type === "vip" || type === "official") bits.push("STABILIZED APPROACH");
    if (type === "official") bits.push("OFFICIAL PARTY");
    if (type === "courier") bits.push("SEALED DISPATCH");
    if (type === "rotation") bits.push("DUTY CHANGE");
    if (type === "express") bits.push("TIME CRITICAL");
    if (type === "express" && isCareer() && hasIfr()) bits.push("INSTRUMENT REQUIRED");
    if (isCareer() && !hasIfr() && state.profile.locksOn) bits.push("NO INSTRUMENT RATING");
    if (type === "medevac") bits.push("PATIENT TRANSFER");
    LANDMARKS.forEach((lm) => {
      if (haversineNm(dest, lm) <= 20) bits.push(`LANDMARK ${lm.n} ${Math.round(haversineNm(dest, lm))} NM`);
    });
    return bits;
  }

  function cruiseAlt(ac, dist, dep, dest) {
    const elev = Math.max(dep.el || 0, dest.el || 0);
    if (ac.cls === "helo" || ac.cls === "evtol") return Math.min(4500 + elev, 9000);
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
    if (serviceBlocks(ac.id)) return [];
    const [minNm, maxNm] = hopRange(ac, state.hop);
    const n = state.issueN === 1 || state.issueN === 3 ? state.issueN : 5;
    const types = dealTypes(ac, state.type, n);
    const needPaved = state.hard || (ac.paved && state.hop !== "bush" && ac.cls !== "bush" && !isRotor(ac));
    const rotor = isRotor(ac);
    const pads = [];
    const keep = (a, d) => {
      if (fieldKind(a) === "helipad") {
        if (rotor) pads.push({ a, d });
        return;
      }
      candidates.push({ a, d });
    };

    const candidates = [];
    for (const a of airports) {
      if (a.id === dep.id) continue;
      if (needPaved && !a.pv) continue;
      if (fieldKind(a) === "seaplane" && !isAmphib(ac)) continue;
      if (runwayTooShort(a, ac, 1)) continue;
      if (ac.cls === "airliner" && a.t === "S") continue;
      const d = haversineNm(dep, a);
      if (d < minNm || d > maxNm) continue;
      if (d > ac.range * 0.85) continue;
      keep(a, d);
    }

    if (types.includes("medevac")) {
      const [mLo, mHi] = medevacRange(ac);
      for (const a of airports) {
        if (a.id === dep.id) continue;
        const k = fieldKind(a);
        if (k === "helipad" && !rotor) continue;
        if (state.hard && !a.pv && k !== "helipad") continue;
        if (k !== "helipad" && k !== "international" && k !== "regional" && !militaryName(a)) continue;
        const d = haversineNm(dep, a);
        if (d < mLo || d > mHi) continue;
        if (d > ac.range * 0.9) continue;
        if (k === "helipad") keep(a, d);
        else if (!candidates.some((c) => c.a.id === a.id)) candidates.push({ a, d });
      }
    }

    const recent = new Set((pilotStats().recentDests || []).slice(0, 16));
    const fresh = candidates.filter((c) => !recent.has(c.a.id));
    if (fresh.length >= Math.max(n, 3)) {
      candidates.length = 0;
      candidates.push(...fresh);
    }

    if (candidates.length < 3) {
      for (const a of airports) {
        if (a.id === dep.id) continue;
        if (state.hard && !a.pv && fieldKind(a) !== "helipad") continue;
        if (fieldKind(a) === "seaplane" && !isAmphib(ac)) continue;
        if (runwayTooShort(a, ac, 0.85)) continue;
        const d = haversineNm(dep, a);
        if (d < Math.max(12, minNm * 0.5) || d > Math.max(maxNm * 1.3, 80)) continue;
        if (d > ac.range * 0.9) continue;
        keep(a, d);
      }
    }

    if (rotor && pads.length) {
      const want = types.includes("medevac") ? 6 : 2;
      for (let i = 0; i < want && pads.length; i++) {
        const j = Math.floor(Math.random() * pads.length);
        const p = pads[j];
        pads.splice(j, 1);
        if (p && !candidates.some((c) => c.a.id === p.a.id)) candidates.push(p);
      }
    }

    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    const allMed = types.length && types.every((t) => t === "medevac");
    const briefNm = Math.max(18, ac.cruise * 0.35);
    const midNm = Math.max(briefNm + 10, ac.cruise * 0.7);
    const brief = candidates.filter((c) => c.d <= briefNm);
    const mid = candidates.filter((c) => c.d > briefNm && c.d <= midNm);
    const rest = candidates.filter((c) => c.d > midNm);
    const ordered = [];
    const take = (arr, count) => {
      for (const c of arr) {
        if (ordered.length >= count) break;
        if (!ordered.includes(c)) ordered.push(c);
      }
    };
    if (allMed) {
      take(candidates.filter((c) => {
        const k = fieldKind(c.a);
        return k === "helipad" || k === "international" || k === "regional" || militaryName(c.a);
      }), 24);
    } else {
      take(brief, n >= 5 ? 2 : n >= 3 ? 1 : 1);
      take(mid, n >= 5 ? 2 : n >= 3 ? 1 : 0);
      take(rest, n >= 5 ? 1 : n >= 3 ? 1 : 0);
      take(candidates, Math.max(n, types.includes("medevac") ? 24 : n));
      if (types.includes("medevac")) take(candidates.filter((c) => {
        const k = fieldKind(c.a);
        return k === "helipad" || k === "international" || k === "regional" || militaryName(c.a);
      }), 24);
    }
    candidates.length = 0;
    candidates.push(...ordered);

    const used = new Set();
    const out = [];
    let remaining = candidates.slice();
    while (out.length < n && remaining.length) {
      const type = types[out.length] || pick(types);
      const c = pickDest(remaining, type, ac);
      if (!c) {
        if ((type === "official" || type === "courier" || type === "rotation") && types.length > 1) {
          types.splice(out.length, 1);
          continue;
        }
        break;
      }
      remaining = remaining.filter((x) => x.a.id !== c.a.id);
      if (used.has(c.a.id)) continue;
      used.add(c.a.id);
      const dist = Math.round(c.d);
      const hdg = heading(dep, c.a);
      const pay = payloadFor(type, ac);
      const eteMin = Math.max(12, Math.round((dist / ac.cruise) * 60 + 12));
      const alt = cruiseAlt(ac, dist, dep, c.a);
      const money = payout(type, dist, pay, ac);
      const xp = xpFor({ type, dist, pay });
      const delayMin = 10 + Math.floor(Math.random() * 11);
      const depMs = Date.now() + delayMin * 60000;
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
        brief: briefing(type, dep, c.a, pay, dist, { depTime: new Date(depMs).toISOString() }),
        ac: ac.id,
        acName: ac.name,
        acTail: sortieTail(),
        depTime: new Date(depMs).toISOString(),
        arrTime: new Date(depMs + eteMin * 60000).toISOString(),
      });
    }
    return out;
  }

  function missionText(m) {
    if (!m || !m.dest) return "";
    const t = TYPES.find((x) => x.id === m.type);
    return [
      `TWOFLY DISPATCH`,
      `${(t && t.label) || m.type}  ·  ${icaoOf(m.dep)} ${fieldCaption(m.dep)} → ${icaoOf(m.dest)} ${fieldCaption(m.dest)}  ·  ${fmtNm(m.dist)}  ·  hdg ${String(m.hdg).padStart(3, "0")}°`,
      `Aircraft: ${m.acName}${m.acTail ? "  " + m.acTail : ""}`,
      `Payload: ${payLabel(m.pay)}`,
      `Suggested: ${fmtAlt(m.alt)} · ETE ~${fmtEte(m.eteMin)} · DEP ${fmtFieldTime(m.depTime, m.dep)} · ARR ${fmtFieldTime(m.arrTime, m.dest)}`,
      `Dest: ${m.dest.n || ""}${m.dest.c ? " / " + m.dest.c : ""} (${fieldKind(m.dest)}, rwy ${m.dest.rw ? fmtField(m.dest.rw) : "?"})`,
      `Quote: $${Number(m.money || 0).toLocaleString()}  ·  XP: ${m.xp || xpFor(m)}`,
      ``,
      m.brief || "",
      ``,
      `Notes: ${(m.constraints || []).join(" · ")}`,
    ].join("\n");
  }

  function fmtEte(min) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m} min`;
  }

  function padHdg(h) {
    const n = ((Math.round(Number(h) || 0) % 360) + 360) % 360;
    return String(n).padStart(3, "0");
  }

  function reciprocal(h) {
    return (Math.round(Number(h) || 0) + 180) % 360;
  }

  function hdgBits(h) {
    return `hdg ${padHdg(h)}° · rec ${padHdg(reciprocal(h))}°`;
  }

  function fmtQnhBoth(d) {
    if (!d) return "—";
    let hpa = d.qnhHpa;
    let inhg = d.qnhInHg;
    if (hpa == null && inhg != null) hpa = inhg * 33.86389;
    if (inhg == null && hpa != null) inhg = hpa / 33.86389;
    if (hpa == null) return d.qnh || "—";
    return `${Math.round(hpa)} hPa · ${inhg.toFixed(2)} inHg`;
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
    const distXp = m.dist * 1.35;
    const loadXp = (m.pay?.pax || 0) * 10 + Math.round((m.pay?.lbs || 0) / 30);
    const mult = { cargo: 1, pax: 1.08, express: 1.18, vip: 1.25, official: 1.3, courier: 1.2, rotation: 1.12, bush: 1.15, medevac: 1.35, ferry: 0.7 }[m.type] || 1;
    let xp = Math.round((distXp + loadXp) * mult);
    return Math.max(12, xp);
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

  function useEU() {
    return !!(state.profile && state.profile.units === "eu");
  }

  function fmtAlt(ft) {
    const n = Number(ft);
    if (!Number.isFinite(n)) return "";
    return Math.round(n).toLocaleString() + " FT";
  }

  function fmtField(ft) {
    const n = Number(ft);
    if (!Number.isFinite(n) || n <= 0) return "";
    if (useEU()) return Math.round(n * 0.3048).toLocaleString() + " M";
    return Math.round(n).toLocaleString() + " FT";
  }

  function fmtNm(nm) {
    return Math.round(Number(nm) || 0).toLocaleString() + " NM";
  }

  function fmtMass(lb) {
    const n = Number(lb) || 0;
    if (useEU()) return Math.round(n * 0.453592).toLocaleString() + " KG";
    return Math.round(n).toLocaleString() + " LB";
  }

  function fmtKt(kt) {
    return Math.round(Number(kt) || 0).toLocaleString() + " KT";
  }

  function fmtQnh(d) {
    if (!d) return "—";
    let hpa = d.qnhHpa;
    let inhg = d.qnhInHg;
    if (hpa == null && inhg != null) hpa = inhg * 33.86389;
    if (inhg == null && hpa != null) inhg = hpa / 33.86389;
    if (hpa == null && inhg == null) return d.qnh || "—";
    if (useEU()) return Math.round(hpa) + " hPa";
    return Number(inhg).toFixed(2) + " inHg";
  }

  function fmtVis(d) {
    if (!d) return "—";
    const sm = d.visSm != null ? d.visSm : (d.visM != null ? (d.visM >= 9999 ? 10 : d.visM / 1609.344) : null);
    if (useEU()) {
      if (d.visM != null) return d.visM >= 9999 ? "9999 M" : Math.round(d.visM).toLocaleString() + " M";
      if (sm == null) return d.vis || "—";
      if (sm >= 10) return "9999 M";
      return Math.round(sm * 1609.344).toLocaleString() + " M";
    }
    if (sm == null) return d.vis || "—";
    if (sm >= 10) return "10+ SM";
    const shown = Math.round(sm * 10) / 10;
    return shown + " SM";
  }

  function payLabel(pay) {
    if (!pay) return "";
    if (pay.kind === "empty") return "NIL PAYLOAD — REPOSITION";
    if (pay.item === "MEDICAL TEAM" || /PATIENT/.test(pay.text || "")) return `1 PATIENT / ${fmtMass(pay.lbs)} MEDICAL`;
    if (pay.kind === "pax") return `${pay.pax} PAX / ${fmtMass(pay.lbs)}`;
    if (pay.kind === "cargo") return `${fmtMass(pay.lbs)} ${pay.item || ""}`.trim();
    return pay.text || "";
  }

  function typeLabel(a) {
    if (!a) return "";
    let n = String(a.name || "");
    const m = String(a.maker || "").trim();
    if (m && n.toLowerCase().startsWith(m.toLowerCase())) n = n.slice(m.length).replace(/^[\s\-–—]+/, "");
    return n || a.name || "";
  }

  function fmtTempNum(c) {
    if (c == null || Number.isNaN(c)) return null;
    return Math.round(c);
  }

  function fmtTempPair(t, dp) {
    const a = fmtTempNum(t);
    if (a == null) return "—";
    const b = fmtTempNum(dp);
    return b == null ? `${a} °C` : `${a} / ${b} °C`;
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
      out.windKt = parseInt(wind[2], 10) || 0;
      out.gustKt = wind[4] ? parseInt(wind[4], 10) : out.windKt;
    }
    let visSm = null;
    const visP = raw.match(/\b(\d{1,2})(?:\s+(\d\/\d))?SM\b/) || raw.match(/\b(\d\/\d)SM\b/);
    if (/\bP6SM\b/.test(raw) || /\b10SM\b/.test(raw)) {
      visSm = 10;
      out.vis = "10+ SM";
    } else if (visP) {
      visSm = visP[2] ? parseInt(visP[1], 10) + 0.5 : visP[1].includes("/") ? 0.5 : parseInt(visP[1], 10);
      out.vis = (visP[0] || visP[1] + "SM").replace("SM", " SM");
    } else {
      const visM = raw.match(/\b(?:KT|MPS)\s+(\d{4})(?:[NSEW]{1,2})?\b/);
      if (visM) {
        const meters = parseInt(visM[1], 10);
        out.visM = meters;
        visSm = meters >= 9999 ? 10 : meters / 1609.344;
      }
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
    const body = String(raw).split(/\bRMK\b/)[0];
    const rmk = String(raw).split(/\bRMK\b/)[1] || "";
    const slash = body.match(/\s(M?\d{2})\/(M?\d{2})(?:\s|$)/);
    const tg = rmk.match(/\bT([01])(\d{3})([01])(\d{3})\b/);
    if (slash) {
      out.tempC = parseMetarTemp(slash[1]);
      out.dewC = parseMetarTemp(slash[2]);
    }
    if (tg) {
      const t = (tg[1] === "1" ? -1 : 1) * (parseInt(tg[2], 10) / 10);
      const d = (tg[3] === "1" ? -1 : 1) * (parseInt(tg[4], 10) / 10);
      if (out.tempC == null || Math.abs(t - out.tempC) <= 1.6) {
        out.tempC = t;
        out.dewC = d;
      }
    }
    const a = raw.match(/\bA(\d{4})\b/);
    const q = raw.match(/\bQ(\d{4})\b/);
    if (a) {
      out.qnhInHg = parseInt(a[1], 10) / 100;
      out.qnhHpa = out.qnhInHg * 33.86389;
      out.qnh = out.qnhInHg.toFixed(2) + " inHg";
    } else if (q) {
      out.qnhHpa = parseInt(q[1], 10);
      out.qnhInHg = out.qnhHpa / 33.86389;
      out.qnh = q[1] + " hPa";
    }
    out.cat = flightCat(visSm, ceiling);
    out.visSm = visSm;
    out.ceiling = ceiling;
    out.vrb = !!(wind && wind[1] === "VRB");
    out.windDir = wind && wind[1] !== "VRB" ? parseInt(wind[1], 10) : null;
    out.calm = /\b00000KT\b/.test(raw);
    return out;
  }

  let wxOfflineFlag = false;

  function compassWord(deg) {
    if (deg == null || Number.isNaN(deg)) return "";
    const names = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];
    return names[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
  }

  function wxWeatherWords(code) {
    const raw = String(code || "").trim();
    if (!raw || raw === "NIL") return "";
    const bits = {
      RA: "rain", "-RA": "light rain", "+RA": "heavy rain",
      SN: "snow", "-SN": "light snow", "+SN": "heavy snow",
      DZ: "drizzle", SHRA: "rain showers", TSRA: "thunderstorms", TS: "thunderstorms",
      FG: "fog", BR: "mist", HZ: "haze", FU: "smoke",
      FZFG: "freezing fog", FZRA: "freezing rain",
      GR: "hail", PL: "ice pellets",
    };
    return raw.split(/\s+/).map((p) => bits[p] || p.replace(/^\+/, "heavy ").replace(/^-/, "light ").toLowerCase()).join(", ");
  }

  function skyWords(sky) {
    const s = String(sky || "—");
    if (s === "—" || s === "NIL") return "";
    if (/CAVOK|CLR|SKC|NSC/.test(s)) return "The sky is clear.";
    const layers = [...s.matchAll(/\b(FEW|SCT|BKN|OVC|VV)(\d{3})\b/g)];
    if (!layers.length) return s === "FEW" || s === "SCT" || s === "BKN" || s === "OVC" ? `Clouds are ${s.toLowerCase()}.` : "";
    const name = { FEW: "a few clouds", SCT: "scattered clouds", BKN: "a broken ceiling", OVC: "overcast", VV: "vertical visibility" };
    return layers.map((m) => {
      const ft = parseInt(m[2], 10) * 100;
      const n = name[m[1]] || m[1];
      return `${n.charAt(0).toUpperCase() + n.slice(1)} at ${ft.toLocaleString()} ft.`;
    }).join(" ");
  }

  function visPlain(d) {
    const vis = d && d.visSm;
    if ((vis == null) && !(d && d.visM != null)) return "";
    if (useEU()) {
      const m = d.visM != null ? d.visM : Math.round(vis * 1609.344);
      if (m >= 9999 || vis >= 10) return "10 km or more";
      if (m >= 1000) {
        const km = Math.round(m / 100) / 10;
        return `about ${km} km`;
      }
      return `about ${Math.round(m).toLocaleString()} m`;
    }
    if (vis >= 10) return "more than 10 miles";
    if (vis < 1) return "under 1 mile";
    const shown = Math.round(vis * 10) / 10;
    return shown === 1 ? "about 1 mile" : `about ${shown} miles`;
  }

  function catExplain(d) {
    if (!d || !d.cat || d.cat === "—") return "";
    const c = d.ceiling;
    const vis = d.visSm;
    const ceil = c == null ? "no ceiling" : `a ceiling of ${c.toLocaleString()} ft`;
    const visW = visPlain(d);
    const saw = [ceil, visW ? `visibility ${visW}` : ""].filter(Boolean).join(" and ");
    const here = saw ? ` This report has ${saw}.` : "";
    if (d.cat === "LIFR") {
      return `This is LIFR, low instrument flight rules. The ceiling is under 500 ft, or visibility is under 1 mile. You should not expect to see the field until you are very close.${here}`;
    }
    if (d.cat === "IFR") {
      return `This is IFR, instrument flight rules. The ceiling is under 1,000 ft, or visibility is under 3 miles. Plan to fly the arrival on instruments.${here}`;
    }
    if (d.cat === "MVFR") {
      return `This is MVFR, marginal visual flight rules. The ceiling is under 3,000 ft, or visibility is 5 miles or less. You can still fly by looking outside, but the weather is tight.${here}`;
    }
    if (d.cat === "VFR") {
      return `This is VFR, visual flight rules. The ceiling is at least 3,000 ft, or there is no ceiling, and visibility is more than 5 miles. You can fly by looking outside.${here}`;
    }
    return "";
  }

  function explainWx(obs) {
    if (!obs || !obs.dec) return "";
    const d = obs.dec;
    const parts = [];
    if (obs.nm) parts.push(`No METAR on file here. This reading is from ${obs.id}, ${fmtNm(obs.nm)} away.`);
    else if (obs.source === "metar") parts.push("This is the issued METAR. The simulator's sky can disagree.");
    if (d.calm || d.wind === "CALM") parts.push("Wind is calm.");
    else if (d.vrb) parts.push(`Wind is variable at ${d.windKt || "—"} knots.`);
    else if (d.windDir != null) {
      const from = compassWord(d.windDir);
      const g = d.gustKt && d.gustKt > (d.windKt || 0) + 3 ? `, gusting ${d.gustKt}` : "";
      parts.push(`Wind is from the ${from} at ${d.windKt} knots${g}.`);
    }
    if (d.visSm != null || d.visM != null) {
      const vis = fmtVis(d);
      if (useEU()) parts.push(d.visM >= 9999 || d.visSm >= 10 ? "Visibility is 10 km or more." : `Visibility is about ${vis}.`);
      else parts.push(d.visSm >= 10 ? "Visibility is more than 10 miles." : `Visibility is about ${vis.replace(" SM", " miles")}.`);
    } else if (d.vis && d.vis !== "—") parts.push(`Visibility ${d.vis}.`);
    const sky = skyWords(d.sky);
    if (sky) parts.push(sky);
    const wx = wxWeatherWords(d.wx);
    if (wx) parts.push("Weather: " + wx + ".");
    if (d.tempC != null) {
      const t = fmtTempNum(d.tempC);
      const dp = fmtTempNum(d.dewC);
      parts.push(dp == null ? `Temperature ${t} °C.` : `Temperature ${t} °C, dewpoint ${dp} °C.`);
    }
    if (d.qnhHpa != null || d.qnhInHg != null || (d.qnh && d.qnh !== "—")) {
      const q = fmtQnh(d);
      parts.push(useEU()
        ? `QNH ${q}. Set that on the altimeter.`
        : `Altimeter ${q}. Set that so field elevation reads correctly.`);
    }
    const cat = catExplain(d);
    if (cat) parts.push(cat);
    return parts.join(" ");
  }

  function whyAircraft(ac, dest, type, dist) {
    if (!ac) return "";
    const name = ac.name || "This aircraft";
    const k = fieldKind(dest);
    const el = (dest && dest.el) || 0;
    const rw = (dest && dest.rw) || 0;
    if (type === "medevac" && isRotor(ac) && k === "helipad") {
      return `The ${name} is good for a hospital pad. It can land there instead of using a field and transferring by ground.`;
    }
    if (type === "medevac" && !isRotor(ac)) {
      return `The ${name} is good for the nearest large field. The patient usually finishes the last miles on the ground.`;
    }
    if (k === "helipad" && isRotor(ac)) {
      return `The ${name} is good for this pad. There is no runway.`;
    }
    if (k === "strip" && (ac.cls === "bush" || ac.cls === "piston" || isRotor(ac))) {
      return `The ${name} is good for a short strip that a heavier aircraft would have to skip.`;
    }
    if (ac.cls === "jet" && (dist || 0) > 180) {
      return `The ${name} is good for this distance. It covers it without turning the day into a fuel stop.`;
    }
    if (ac.cls === "turboprop" && (k === "regional" || k === "municipal")) {
      return `The ${name} is good for mixed regional fields. Faster than a piston, and still usable on a shorter runway.`;
    }
    if (el >= 7000) {
      return `High elevation cuts performance. The ${name} will want more runway here than it does at sea level.`;
    }
    if (ac.minRwy && rw && rw < ac.minRwy + 1200 && rw >= (ac.minRwy || 0)) {
      return `The destination runway is on the short side for the ${name}. Plan the landing.`;
    }
    return "";
  }

  function hopNote(m, ac) {
    if (!m || !m.dest) return "";
    if (m.type === "express" && isCareer(m) && licenseFor(state.profile.xp).n >= 3) {
      return "Express is filed IFR. Stay on the gauges if the weather comes down.";
    }
    const el = m.dest.el || 0;
    if (el >= 7000) {
      return `Destination is ${el.toLocaleString()} ft. Thinner air — longer takeoff, faster true airspeed on approach.`;
    }
    return "";
  }

  function jobLearnHtml(m) {
    const ac = (m.ac && AIRCRAFT.find((a) => a.id === m.ac)) || state.ac;
    const why = whyAircraft(ac, m.dest, m.type, m.dist);
    let note = hopNote(m, ac);
    if (why && note && /pad/i.test(why) && /pad/i.test(note)) note = "";
    return `${why ? `<p class="learn why">${esc(why)}</p>` : ""}${note ? `<p class="learn note">${esc(note)}</p>` : ""}`;
  }

  function weatherOffline() {
    return (typeof navigator !== "undefined" && navigator.onLine === false) || wxOfflineFlag;
  }

  function metarIssuedAt(raw) {
    const m = String(raw || "").match(/\b(\d{2})(\d{2})(\d{2})Z\b/);
    if (!m) return null;
    const now = new Date();
    let y = now.getUTCFullYear();
    let mo = now.getUTCMonth();
    const day = parseInt(m[1], 10);
    const hh = parseInt(m[2], 10);
    const mm = parseInt(m[3], 10);
    if ([day, hh, mm].some((n) => Number.isNaN(n)) || hh > 23 || mm > 59 || day < 1 || day > 31) return null;
    let t = Date.UTC(y, mo, day, hh, mm, 0);
    const nowMs = now.getTime();
    if (t - nowMs > 15 * 86400000) {
      mo -= 1;
      if (mo < 0) { mo = 11; y -= 1; }
      t = Date.UTC(y, mo, day, hh, mm, 0);
    } else if (nowMs - t > 15 * 86400000) {
      mo += 1;
      if (mo > 11) { mo = 0; y += 1; }
      t = Date.UTC(y, mo, day, hh, mm, 0);
    }
    return t;
  }

  function metarAgeMin(raw) {
    const t = metarIssuedAt(raw);
    if (t == null) return 9999;
    return (Date.now() - t) / 60000;
  }

  function metarFresh(raw) {
    const age = metarAgeMin(raw);
    return age >= -15 && age <= 150;
  }

  function metarZ(raw) {
    const m = String(raw || "").match(/\b\d{2}(\d{4})Z\b/);
    return m ? m[1] + "Z" : "";
  }

  function metarReports(text) {
    const raw = String(text || "").replace(/\r/g, "\n").trim();
    if (!raw) return [];
    const chunks = raw.split(/(?=(?:^|\n)\s*(?:METAR|SPECI)\s+)/i);
    const out = [];
    chunks.forEach((chunk) => {
      String(chunk).split(/\n+/).forEach((line) => {
        const s = line.trim().replace(/^(?:METAR|SPECI)\s+/, "");
        if (/^[A-Z0-9]{4}\s+\d{6}Z\b/.test(s)) out.push(s);
      });
    });
    if (!out.length) {
      const s = raw.replace(/^(?:METAR|SPECI)\s+/, "").trim();
      if (/^[A-Z0-9]{4}\s+\d{6}Z\b/.test(s.split(/\n/)[0] || "")) out.push(s.split(/\n/)[0].trim());
    }
    return out;
  }

  function pickNewestMetar(text, maxAgeMin) {
    const cap = maxAgeMin == null ? 90 : maxAgeMin;
    let best = "";
    let bestAge = 99999;
    metarReports(text).forEach((line) => {
      const age = metarAgeMin(line);
      if (age < -15 || age > cap) return;
      if (age < bestAge) {
        bestAge = age;
        best = line;
      }
    });
    return best;
  }

  function pickFreshMetar(text) {
    return pickNewestMetar(text, 90);
  }

  async function fetchMetarLine(id, maxAgeMin, fresh) {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      wxOfflineFlag = true;
      return "";
    }
    const uid = String(id || "").toUpperCase();
    if (!/^[A-Z0-9]{3,4}$/.test(uid)) return "";
    const cap = maxAgeMin == null ? 24 * 60 : maxAgeMin;
    const urls = [
      "https://metar.vatsim.net/" + encodeURIComponent(uid),
      "https://aviationweather.gov/api/data/metar?ids=" + encodeURIComponent(uid) + "&format=raw&hours=24",
      "/__twofly/metar?id=" + encodeURIComponent(uid) + (fresh ? "&fresh=1" : ""),
    ];
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const jobs = urls.map(async (url) => {
      const r = await fetch(url, { cache: "no-store", signal: ctrl.signal });
      if (!r.ok) throw new Error("bad");
      const t = (await r.text()).trim();
      if (!t || t.toUpperCase().includes("NO METAR") || t.length < 10) throw new Error("empty");
      const line = pickNewestMetar(t, cap);
      if (!line) throw new Error("stale");
      return line;
    });
    try {
      const line = await Promise.any(jobs);
      clearTimeout(timer);
      ctrl.abort();
      wxOfflineFlag = false;
      return line;
    } catch {
      clearTimeout(timer);
      return "";
    }
  }

  function nearbyStations(ap) {
    return airports
      .filter((x) => x.id && x.id.length === 4 && x.id !== ap.id && x.lat != null)
      .map((x) => ({ ap: x, d: haversineNm(ap, x) }))
      .filter((x) => x.d <= 20)
      .sort((a, b) => a.d - b.d)
      .slice(0, 2);
  }

  async function observationFor(ap, fresh) {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      wxOfflineFlag = true;
      const e = new Error("offline");
      e.offline = true;
      throw e;
    }
    const own = await fetchMetarLine(ap.id, 24 * 60, fresh);
    if (own) return { source: "metar", id: ap.id, nm: 0, raw: own, dec: decodeMetar(own) };
    const near = nearbyStations(ap);
    const texts = await Promise.all(
      near.map((n) => fetchMetarLine(n.ap.id, 90, fresh).then((t) => ({ id: n.ap.id, nm: n.d, t })))
    );
    const hit = texts.filter((x) => x.t).sort((a, b) => a.nm - b.nm)[0];
    if (hit) return { source: "metar", id: hit.id, nm: Math.round(hit.nm), raw: hit.t, dec: decodeMetar(hit.t) };
    const e = new Error("nometar");
    e.offline = weatherOffline();
    throw e;
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
      box.innerHTML = `<p class="muted">${offline ? "WEATHER SYSTEM OFFLINE." : "NO METAR DATA AVAILABLE."}</p>
        <button type="button" class="ghost tiny" data-wx-refresh="${isArr ? "arr" : "dep"}">REFRESH</button>`;
      return;
    }
    if (!obs || !obs.dec || obs.source === "model") {
      renderWxBody(ap, null, true, slot);
      return;
    }
    const d = obs.dec;
    const from = obs.nm
      ? `METAR ${obs.id} ${metarZ(obs.raw)} · ${fmtNm(obs.nm)}`
      : `METAR ${obs.id} ${metarZ(obs.raw)}`.trim();
    if (meta) meta.textContent = ap.id + (ap.n ? " · " + ap.n : "");
    box.innerHTML = `
      <p class="wx-from">${from}</p>
      <div class="wx-grid">
        <div><span>WIND</span><b>${d.wind}</b></div>
        <div><span>VIS</span><b>${fmtVis(d)}</b></div>
        <div><span>SKY</span><b>${d.sky}</b></div>
        <div><span>WX</span><b>${d.wx}</b></div>
        <div><span>TEMP</span><b>${fmtTempNum(d.tempC) == null ? "—" : fmtTempNum(d.tempC) + " °C"}</b></div>
        <div><span>DEWPOINT</span><b>${fmtTempNum(d.dewC) == null ? "—" : fmtTempNum(d.dewC) + " °C"}</b></div>
        <div><span>${useEU() ? "QNH" : "ALTIMETER"}</span><b>${fmtQnh(d)}</b></div>
        <div><span>CATEGORY</span><b class="wx-cat cat-${d.cat}">${d.cat}</b></div>
      </div>
      ${obs.raw ? `<pre class="wx-raw">${obs.raw}</pre>` : ""}
      <p class="wx-plain" hidden>${esc(explainWx(obs))}</p>
      <div class="wx-acts">
        ${explainWx(obs) ? `<button type="button" class="ghost tiny" data-wx-plain="${isArr ? "arr" : "dep"}">EXPLAIN THIS</button>` : ""}
        <button type="button" class="ghost tiny" data-wx-refresh="${isArr ? "arr" : "dep"}">REFRESH</button>
      </div>`;
  }

  const wxGen = { dep: 0, arr: 0 };

  function loadWxStore() {
    try {
      const raw = JSON.parse(localStorage.getItem("twofly-wx") || "{}");
      Object.keys(raw).forEach((id) => {
        const row = raw[id];
        if (row && row.obs && row.obs.raw) wxCache.set(id, row);
      });
    } catch {}
  }

  function saveWxStore() {
    const rows = [...wxCache.entries()]
      .filter(([, v]) => v && v.obs && v.obs.raw)
      .sort((a, b) => (b[1].at || 0) - (a[1].at || 0))
      .slice(0, 80);
    const obj = {};
    rows.forEach(([id, v]) => { obj[id] = v; });
    try { localStorage.setItem("twofly-wx", JSON.stringify(obj)); } catch {}
  }

  async function loadWx(ap, force, slot) {
    slot = slot || "dep";
    const gen = ++wxGen[slot];
    if (!ap) {
      renderWxBody(null, null, false, slot);
      return;
    }
    const key = ap.id;
    const hit = wxCache.get(key);
    if (!force && hit && hit.obs) {
      renderWxBody(ap, hit.obs, false, slot);
      return;
    }
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      wxOfflineFlag = true;
      if (hit && hit.obs) renderWxBody(ap, hit.obs, false, slot);
      else renderWxBody(ap, null, { offline: true }, slot);
      return;
    }
    if (!hit) {
      const box = $(slot === "arr" ? "#wx-arr-body" : "#wx-body");
      if (box) box.innerHTML = `<p class="muted">RETRIEVING OBSERVATION.</p>`;
    }
    try {
      const obs = await observationFor(ap, !!force);
      if (wxGen[slot] !== gen) return;
      wxCache.set(key, { at: Date.now(), obs });
      saveWxStore();
      renderWxBody(ap, obs, false, slot);
    } catch (e) {
      if (wxGen[slot] !== gen) return;
      if (hit && hit.obs) renderWxBody(ap, hit.obs, false, slot);
      else renderWxBody(ap, null, e && e.offline ? e : true, slot);
    }
  }

  function destWxBits(dest) {
    if (!dest) return "";
    const hit = wxCache.get(dest.id);
    if (!hit || !hit.obs || !hit.obs.dec) return "";
    const d = hit.obs.dec;
    return `<span class="wx-cat cat-${d.cat}">${d.cat}</span><span>${d.wind}</span><span>${d.vis}</span>`;
  }

  function ttsBits(acId) {
    if (!acId || !state.profile.serviceOn) return "";
    const left = Math.max(0, SERVICE_HRS - sinceService(acId));
    const dead = healthPct(acId) <= 0;
    return `<span>TTS ${left.toFixed(1)} HR</span>${healthHtml(acId)}${dead ? `<span class="svc-due">GROUNDED</span>` : ""}`;
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
        if (hit && hit.obs) return;
        try {
          const obs = await observationFor(ap);
          wxCache.set(ap.id, { at: Date.now(), obs });
        } catch {}
      })
    );
    refreshBriefs(list);
    if (state.active) refreshBriefs([state.active]);
    renderMissions();
    if (state.active && state.active.dest) loadWx(state.active.dest, false, "arr");
    else if (list[0] && list[0].dest) loadWx(list[0].dest, false, "arr");
  }

  function setAirports(list) {
    const pads = Array.isArray(window.TWOFY_HELIPADS) ? window.TWOFY_HELIPADS : [];
    const seen = new Set((list || []).map((a) => a && a.id).filter(Boolean));
    const extra = pads.filter((p) => p && p.id && !seen.has(p.id));
    airports = (list || []).filter((a) => a && a.id).concat(extra);
    byId = new Map(airports.map((a) => [a.id, a]));
    const saved = (() => { try { return localStorage.getItem("twofly-dep"); } catch (e) { return ""; } })();
    if (!state.dep || !byId.get(state.dep.id)) {
      state.dep = (saved && byId.get(saved)) || byId.get("KSKX") || airports[0] || null;
    } else {
      state.dep = byId.get(state.dep.id) || state.dep;
    }
    if (state.dep && fieldKind(state.dep) === "helipad" && !isRotor(state.ac)) {
      state.dep = byId.get("KSKX") || airports.find((x) => x && fieldKind(x) !== "helipad") || null;
    }
    const n = $("#field-count");
    if (n) n.textContent = "";
    try { renderDep(); } catch (e) {}
    try { renderHome(); } catch (e) {}
    try {
      const flown = (state.log || []).filter((m) => m.flown && !m.crashed);
      if (flown.length) mergeUnlocks(unlocksFromFlown(flown));
      renderBook();
    } catch (e) {}
  }

  function loadAirports() {
    const n = $("#field-count");
    if (n && !airports.length) n.textContent = "";
    return fetch("airports.json?v=" + VERSION, { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (data) {
        if (Array.isArray(data) && data.length) setAirports(data);
        else if (n) n.textContent = "";
      })
      .catch(function () {
        if (n && !airports.length) n.textContent = "";
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
          if (cityHitsAirport(ap, ct)) cities.add(ct.id);
        });
        PORTS.forEach((pt) => {
          if (airportHitsPort(ap, pt)) ports.add(pt.id);
        });
      });
    });
    return { flown, stamps, types, makers, states, countries, marks, cities, ports };
  }

  function portKeys(pt) {
    return new Set(
      [pt.id, pt.icao, pt.iata, ...(pt.aliases || [])]
        .filter(Boolean)
        .map((s) => String(s).toUpperCase())
    );
  }

  function airportHitsPort(ap, pt) {
    if (!ap || !pt) return false;
    const keys = portKeys(pt);
    const id = String(ap.id || ap.icao || "").toUpperCase();
    const iata = String(ap.iata || "").toUpperCase();
    if (id && keys.has(id)) return true;
    if (iata && keys.has(iata)) return true;
    if (pt.lat != null && ap.lat != null && haversineNm(ap, pt) <= 3) return true;
    return false;
  }

  function cityHitsAirport(ap, ct) {
    if (!ap || !ct) return false;
    if (ap.lat != null && ct.lat != null && haversineNm(ap, ct) <= 35) return true;
    const city = String(ap.c || "").trim().toLowerCase();
    const name = String(ct.n || "").trim().toLowerCase();
    return !!(city && name && (city === name || city.startsWith(name + " ") || name.startsWith(city + " ")));
  }

  function localDayKey(iso) {
    const d = iso ? new Date(iso) : new Date();
    if (Number.isNaN(d.getTime())) return "";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function localHour(iso) {
    const d = iso ? new Date(iso) : new Date();
    return Number.isNaN(d.getTime()) ? -1 : d.getHours();
  }

  function isWeekend(iso) {
    const d = iso ? new Date(iso) : new Date();
    const n = d.getDay();
    return n === 0 || n === 6;
  }

  function dayDiff(a, b) {
    const da = new Date(a + "T12:00:00");
    const db = new Date(b + "T12:00:00");
    return Math.round((db - da) / 86400000);
  }

  function consecutiveDays(flown) {
    const days = [...new Set(flown.map((m) => localDayKey(m.flownAt)).filter(Boolean))].sort();
    let best = 0, run = 0, prev = "";
    days.forEach((d) => {
      if (prev && dayDiff(prev, d) === 1) run += 1;
      else run = 1;
      if (run > best) best = run;
      prev = d;
    });
    return best;
  }

  function acClassBucket(cls) {
    if (cls === "helo" || cls === "evtol") return "rotor";
    if (cls === "turboprop") return "turboprop";
    if (cls === "jet" || cls === "airliner") return "jet";
    if (cls === "piston" || cls === "bush" || cls === "vintage" || cls === "airship") return "piston";
    return "";
  }

  function wxSnap(ap) {
    const id = icaoOf(ap);
    if (!id) return { cat: "", windKt: 0, gustKt: 0 };
    const hit = wxCache.get(id);
    const d = hit && hit.obs && hit.obs.dec;
    if (!d) return { cat: "", windKt: 0, gustKt: 0 };
    return { cat: d.cat || "", windKt: d.windKt || 0, gustKt: d.gustKt || 0 };
  }

  function badges() {
    const { flown, types, makers } = flownStats();
    const marks = new Set(state.collection.marks || []);
    const stamps = new Set(state.collection.stamps || []);
    const cities = new Set(state.collection.cities || []);
    const ports = new Set(state.collection.ports || []);
    const today = localDayKey();
    const todayFlights = flown.filter((m) => localDayKey(m.flownAt) === today);
    const hours = flown.reduce((s, m) => s + (m.hours || 0), 0);
    const earned = flown.reduce((s, m) => s + (m.money || 0), 0);
    const airline = flown.filter((m) => m.mode === "airline");
    const home = homeField();
    const homeId = home ? home.id : "";
    const fromHome = flown.filter((m) => icaoOf(m.dep) === homeId).length;
    const toHome = flown.filter((m) => icaoOf(m.dest) === homeId).length;
    const visits = {};
    flown.forEach((m) => {
      [icaoOf(m.dep), icaoOf(m.dest)].forEach((id) => {
        if (id && id !== "—") visits[id] = (visits[id] || 0) + 1;
      });
    });
    const maxVisit = Object.values(visits).reduce((a, b) => Math.max(a, b), 0);
    const acIds = new Set(flown.map((m) => m.ac).filter(Boolean));
    const buckets = new Set(flown.map((m) => acClassBucket((AIRCRAFT.find((a) => a.id === m.ac) || {}).cls)));
    buckets.delete("");
    const maxAirHrs = Math.max(0, ...Object.values(state.profile.hours || {}));
    const cats = new Set(flown.map((m) => m.wxCat || m.arrCat).filter((c) => c && c !== "—"));
    const mvfrPlus = flown.filter((m) => ["MVFR", "IFR", "LIFR"].includes(m.wxCat || m.arrCat)).length;
    const windy = flown.some((m) => (m.windKt || 0) >= 20);
    const bushN = flown.filter((m) => m.type === "bush").length;
    const medN = flown.filter((m) => m.type === "medevac").length;
    const vintageN = flown.filter((m) => {
      const ac = AIRCRAFT.find((a) => a.id === m.ac);
      return ac && ac.cls === "vintage";
    }).length;
    const shortStrip = flown.some((m) => m.dest && m.dest.rw && m.dest.rw > 0 && m.dest.rw < 2500);
    const farHome = home && flown.some((m) => m.dest && haversineNm(home, m.dest) >= 500);
    const weekendN = flown.filter((m) => m.flownAt && isWeekend(m.flownAt)).length;
    const early = flown.some((m) => { const h = localHour(m.flownAt); return h >= 0 && h < 7; });
    const late = flown.some((m) => localHour(m.flownAt) >= 22);
    const streak = consecutiveDays(flown);
    const st = pilotStats();
    const maxSvc = Math.max(0, ...Object.values(st.services || { 0: 0 }));
    const lic = licenseFor(state.profile.xp);
    const postcards = cities.size + ports.size;
    const collectables = marks.size + cities.size + ports.size;
    const needAll = LANDMARKS.length + CITIES.length + PORTS.length;
    const albumDone = (CITIES.length && cities.size >= CITIES.length) || (PORTS.length && ports.size >= PORTS.length) || (LANDMARKS.length && marks.size >= LANDMARKS.length);
    const airlineDest = new Set(airline.map((m) => icaoOf(m.dest)).filter((x) => x && x !== "—"));
    const airlineAc = new Set(airline.map((m) => m.ac).filter(Boolean));
    const airlineFromHome = airline.filter((m) => icaoOf(m.dep) === homeId).length;
    const scenic = marks.size >= 1;
    const lied = flown.some((m) => m.depCat === "VFR" && (m.arrCat === "IFR" || m.arrCat === "LIFR"));
    const pediaMax = Math.max(0, ...Object.values(st.pediaOpens || { 0: 0 }));
    const hangarQueen = Object.entries(st.boughtAt || {}).some(([id, iso]) => {
      if (!inHangar(id)) return false;
      if ((state.profile.hours && state.profile.hours[id]) > 0) return false;
      const t = new Date(iso).getTime();
      return Number.isFinite(t) && Date.now() - t >= 24 * 3600 * 1000;
    });
    const fresh = flown.some((m) => {
      const bought = st.boughtAt && st.boughtAt[m.ac];
      if (!bought || !m.flownAt) return false;
      return new Date(m.flownAt).getTime() >= new Date(bought).getTime();
    }) && Object.keys(st.boughtAt || {}).length > 0;
    const unpaved = flown.filter((m) => m.dest && !m.dest.pv).length;
    const high = flown.filter((m) => (m.dest && m.dest.el || 0) >= 5000).length;
    const longLeg = flown.filter((m) => (m.dist || 0) >= 300).length;
    const veryLong = flown.some((m) => (m.dist || 0) >= 800);
    const butter = flown.filter((m) => m.landing === "BUTTER").length;
    const aPlus = flown.filter((m) => m.grade === "A" || m.grade === "S").length;
    let cleanRun = 0;
    for (const leg of flown) {
      if (leg.crashed || (leg.ops != null && leg.ops < 15)) break;
      if (leg.grade) cleanRun += 1;
    }
    const heavyA = flown.some((m) => {
      if (m.grade !== "A" && m.grade !== "S") return false;
      const ship = AIRCRAFT.find((a) => a.id === m.ac);
      return ship && (ship.cls === "jet" || ship.cls === "airliner");
    });
    const goArounds = flown.filter((m) => m.goAround && !m.crashed).length;

    const row = (id, cat, label, info, cur, max, hidden) => {
      const n = Number(cur) || 0;
      const m = max == null ? 1 : max;
      const have = n >= m;
      return { id, cat, label, info, cur: Math.min(n, m), max: m, have, hidden: !!hidden };
    };

    const list = [
      row("first", "PILOT", "FIRST SORTIE", "Complete and log one accepted tasking.", flown.length, 1),
      row("five", "PILOT", "GETTING OFF THE GROUND", "Complete five taskings.", flown.length, 5),
      row("twentyfive", "PILOT", "REGULAR FLYER", "Complete twenty-five taskings.", flown.length, 25),
      row("hundred", "PILOT", "SEASONED PILOT", "Complete one hundred taskings.", flown.length, 100),
      row("hours10", "PILOT", "CLOCKING HOURS", "Log ten flight hours.", hours, 10),
      row("hours50", "PILOT", "BUILDING TIME", "Log fifty flight hours.", hours, 50),
      row("hours100", "PILOT", "EXPERIENCED PILOT", "Log one hundred flight hours.", hours, 100),
      row("busy", "PILOT", "THREE THIS DATE", "Log three completed sorties on the same calendar date.", todayFlights.length, 3),
      row("session", "PILOT", "JUST ONE MORE", "Complete five taskings in this session.", sessionFlights, 5),
      row("butter10", "PILOT", "GREASED IT", "Log ten butter landings.", butter, 10),
      row("pro25", "PILOT", "PROFESSIONAL", "Complete twenty-five sorties rated A or S.", aPlus, 25),
      row("clean10", "PILOT", "CLEAN RECORD", "Ten rated sorties in a row with no crash and no operations deduction.", cleanRun, 10),
      row("heavyA", "PILOT", "HEAVY METAL", "Finish a jet or airliner sortie at A or S.", heavyA ? 1 : 0, 1),
      row("rough3", "PILOT", "ROUGH DAY", "Three hard, rough, or critical landings in this session.", sessionHard, 3),
      row("around", "PILOT", "GO AROUND", "Go around, then land and complete the sortie.", goArounds, 1),
      row("early", "PILOT", "EARLY BIRD", "Complete a tasking before 07:00 local.", early ? 1 : 0, 1),
      row("night", "PILOT", "NIGHT OWL", "Complete a tasking at or after 22:00 local.", late ? 1 : 0, 1),
      row("weekend", "PILOT", "WEEKEND WARRIOR", "Complete ten taskings on a Saturday or Sunday.", weekendN, 10),
      row("streak", "PILOT", "SEVEN IN A ROW", "Complete taskings on seven consecutive local days.", streak, 7),
      row("home", "PILOT", "HOME AGAIN", "Complete a tasking that lands at your home field.", toHome, 1),
      row("fromhome", "PILOT", "NO PLACE LIKE HOME", "Complete twenty-five taskings from your home field.", fromHome, 25),

      row("priv", "CERTIFICATE", "PRIVATE PILOT", "Earn the Private Pilot certificate.", lic.n >= 2 ? 1 : 0, 1),
      row("inst", "CERTIFICATE", "INSTRUMENT RATING", "Earn the Instrument Rating.", lic.n >= 3 ? 1 : 0, 1),
      row("comm", "CERTIFICATE", "COMMERCIAL PILOT", "Earn the Commercial Pilot certificate.", lic.n >= 4 ? 1 : 0, 1),
      row("atp", "CERTIFICATE", "AIRLINE TRANSPORT PILOT", "Earn ATP.", lic.n >= 5 ? 1 : 0, 1),

      row("pay", "CAREER", "FIRST PAYCHECK", "Earn $10,000 from completed taskings.", earned, 10000),
      row("living", "CAREER", "MAKING A LIVING", "Earn $100,000 from completed taskings.", earned, 100000),
      row("bank", "CAREER", "SIX FIGURES", "Hold $100,000 on the pilot file.", state.profile.money || 0, 100000),
      row("fleet5", "CAREER", "FLEET OWNER", "Own five aircraft in the hangar.", (state.profile.hangar || []).length, 5),
      row("hangar10", "CAREER", "FULL HANGAR", "Own 10 aircraft.", (state.profile.hangar || []).length, 10),
      row("debtfree", "CAREER", "DEBT FREE", "Repay a loan down to zero.", st.repaid || 0, 1),
      row("cash", "CAREER", "NO BANK NEEDED", "Buy an aircraft with cash on the file.", st.cashBuys || 0, 1),
      row("dealer", "CAREER", "USED AIRCRAFT DEALER", "Sell an aircraft from the hangar.", st.sold || 0, 1),
      row("fleet100", "CAREER", "KEEP THE FLEET FLYING", "Accumulate 100 hours across owned airframes.", hours, 100),

      row("cats", "AIRFRAME", "FIVE CATEGORIES", "Log at least one sortie in five task categories.", types.size, 5),
      row("makers", "AIRFRAME", "FIVE MANUFACTURERS", "Complete sorties in aircraft from five manufacturers.", makers.size, 5),
      row("jack", "AIRFRAME", "JACK OF ALL TRADES", "Fly piston, rotor, turboprop, and jet.", buckets.size, 4),
      row("variety", "AIRFRAME", "VARIETY", "Complete flights in ten different types.", acIds.size, 10),
      row("faithful", "AIRFRAME", "OLD FAITHFUL", "Put 100 hours on one airframe.", maxAirHrs, 100),
      row("fresh", "AIRFRAME", "FRESH OUT OF THE HANGAR", "Complete a tasking in an aircraft you bought.", fresh ? 1 : 0, 1),
      row("mechanic", "AIRFRAME", "MECHANIC’S FAVORITE", "Service the same airframe three times.", maxSvc, 3),

      row("pc1", "EXPLORATION", "POSTCARD COLLECTOR", "Unlock your first postcard.", postcards, 1),
      row("pc10", "EXPLORATION", "WISH YOU WERE HERE", "Unlock ten postcards.", postcards, 10),
      row("pc25", "EXPLORATION", "TRAVELING PILOT", "Unlock twenty-five postcards.", postcards, 25),
      row("fields10", "EXPLORATION", "LOCAL EXPLORER", "Visit ten different airfields.", stamps.size, 10),
      row("fields25", "EXPLORATION", "AIRPORT HOPPER", "Visit twenty-five different airfields.", stamps.size, 25),
      row("fields50", "EXPLORATION", "WORLD TRAVELER", "Visit fifty different airfields.", stamps.size, 50),
      row("lm1", "EXPLORATION", "LANDMARK HUNTER", "Discover your first landmark.", marks.size, 1),
      row("lm10", "EXPLORATION", "SIGHTSEER", "Discover ten landmarks.", marks.size, 10),
      row("lm25", "EXPLORATION", "TOURIST WITH WINGS", "Discover twenty-five landmarks.", marks.size, 25),
      row("album", "EXPLORATION", "COLLECTOR", "Complete one postcard or landmark album.", albumDone ? 1 : 0, 1),
      row("whole", "EXPLORATION", "THE WHOLE ALBUM", "Complete every currently available collectable.", collectables, needAll),

      row("vfr", "WEATHER", "CLEAR SKIES", "Complete a flight in VFR.", cats.has("VFR") ? 1 : 0, 1),
      row("mvfr", "WEATHER", "GETTING CLOUDY", "Complete a flight in MVFR.", cats.has("MVFR") ? 1 : 0, 1),
      row("ifr", "WEATHER", "INSTRUMENT RATED", "Complete a flight in IFR.", cats.has("IFR") ? 1 : 0, 1),
      row("lifr", "WEATHER", "INTO THE SOUP", "Complete a flight in LIFR.", cats.has("LIFR") ? 1 : 0, 1),
      row("wxset", "WEATHER", "WEATHER WATCHER", "Complete flights in VFR, MVFR, IFR, and LIFR.", cats.size, 4),
      row("wx10", "WEATHER", "WEATHER DOESN’T CARE", "Complete ten flights in MVFR or worse.", mvfrPlus, 10),
      row("cross", "WEATHER", "CROSSWIND", "Complete a flight with reported wind of 20 knots or more.", windy ? 1 : 0, 1),

      row("fo", "CAREER", "FIRST OFFICER", "Complete your first Career Mode tasking.", airline.length, 1),
      row("rev10", "CAREER", "REVENUE SERVICE", "Complete ten career flights.", airline.length, 10),
      row("rev50", "CAREER", "SCHEDULED SERVICE", "Complete fifty career flights.", airline.length, 50),
      row("alhome", "CAREER", "HOME BASE", "Complete twenty-five career flights from your home field.", airlineFromHome, 25),
      row("routes", "CAREER", "ROUTE NETWORK", "Fly to twenty-five different destinations in Career Mode.", airlineDest.size, 25),
      row("alfleet", "CAREER", "FLEET IN SERVICE", "Complete career taskings in five different aircraft.", airlineAc.size, 5),

      row("bush10", "BUSH", "BUSH PILOT", "Complete ten field-resupply taskings.", bushN, 10),
      row("med5", "MEDEVAC", "AIR AMBULANCE", "Complete five medevac taskings.", medN, 5),
      row("soft", "BUSH", "UNPAVED DEST", "Complete a tasking to an unpaved destination.", unpaved, 1),
      row("high", "BUSH", "HIGH ELEVATION", "Land at a destination 5,000 feet MSL or higher.", high, 1),
      row("short", "BUSH", "NO RUNWAY REQUIRED", "Complete a tasking to a strip under 2,500 feet.", shortStrip ? 1 : 0, 1),
      row("vintage", "BUSH", "VINTAGE WINGS", "Complete a tasking in a vintage aircraft.", vintageN, 1),
      row("long", "BUSH", "300 NM LEG", "Complete one tasking of 300 nautical miles or more.", longLeg, 1),
      row("far", "BUSH", "LONG WAY HOME", "Complete a tasking more than 500 NM from your home field.", farHome ? 1 : 0, 1),

      row("abort1", "TWOFY", "ABORT MISSION", "Abort a tasking. It happens.", st.aborts || 0, 1),
      row("clean10", "TWOFY", "PAPERWORK COMPLETE", "Complete ten taskings in a row without aborting.", st.clean || 0, 10),
      row("legend", "TWOFY", "LOCAL LEGEND", "Use the same airfield twenty-five times.", maxVisit, 25),
      row("empty", "TWOFY", "EMPTY LEGS", "Finish a sortie with less than five hours to service.", flown.some((m) => m.ttfLeft != null && m.ttfLeft < 5) ? 1 : 0, 1),

      row("lied", "HIDDEN", "THE FORECAST LIED", "Depart VFR and arrive IFR or LIFR.", lied ? 1 : 0, 1, true),
      row("scenic", "HIDDEN", "THE SCENIC ROUTE", "Complete a flight that unlocks a landmark.", scenic ? 1 : 0, 1, true),
      row("abort3", "HIDDEN", "FREQUENT MISTAKE", "Abort three taskings.", st.aborts || 0, 3, true),
      row("pedia10", "HIDDEN", "JUST CHECKING", "Open the same encyclopedia page ten times.", pediaMax, 10, true),
      row("queen", "HIDDEN", "HANGAR QUEEN", "Own an aircraft for a day without flying it.", hangarQueen ? 1 : 0, 1, true),
      row("know", "HIDDEN", "I KNOW THIS AIRPORT", "Visit the same airfield ten times.", maxVisit, 10, true),
      row("verylong", "HIDDEN", "ARE WE THERE YET?", "Complete a tasking of 800 NM or more.", veryLong ? 1 : 0, 1, true),
    ];

    const have = list.filter((b) => b.have).length;
    return { list, title: rankFor(totalXp()).name, have, total: list.length };
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
    } else if (kind === "lease") {
      const ac = AIRCRAFT.find((a) => a.id === state.pendingLease);
      const name = ac ? ac.name : "AIRCRAFT";
      const day = ac ? leaseRate(ac) : 0;
      if (title) title.textContent = "LEASE " + name.toUpperCase();
      if (copy) copy.textContent = ac
        ? `${name} leases for ${moneyFmt(day)} a day. Daily payments count toward the list price. Buy it out whenever you want for whatever is left. Returning it is free — you just forfeit what you have already paid. The first day is due when you confirm.`
        : "LEASE THIS AIRFRAME.";
      if (yes) yes.textContent = "LEASE";
    } else if (kind === "buyout") {
      const ac = AIRCRAFT.find((a) => a.id === state.pendingBuyout);
      const name = ac ? ac.name : "AIRCRAFT";
      const remain = state.pendingBuyout ? leaseBuyout(state.pendingBuyout) : 0;
      const paid = state.pendingBuyout ? leasePaid(state.pendingBuyout) : 0;
      if (title) title.textContent = "BUY OUT " + name.toUpperCase();
      if (copy) copy.textContent = remain
        ? `You have already paid ${moneyFmt(paid)} on this lease. Pay the remaining ${moneyFmt(remain)} and the airframe is yours.`
        : `Lease payments have covered the list price. Confirm to take ownership.`;
      if (yes) yes.textContent = remain ? "PAY " + moneyFmt(remain) : "OWN";
    } else if (kind === "ifr-accept") {
      const m = state.pendingAccept;
      const fine = ifrFine(m);
      const where = isImc(wxCatOf(m && m.dest)) ? "Destination" : "Departure";
      const cat = isImc(wxCatOf(m && m.dest)) ? wxCatOf(m.dest) : wxCatOf(m && m.dep);
      if (title) title.textContent = "IFR WITHOUT RATING";
      if (copy) copy.textContent = `${where} is ${cat}. You do not hold an Instrument Rating. You can still accept. Completing this sortie posts Illegal IFR Operation −${fine.xp} XP and Safety violation −${moneyFmt(fine.money)}. The rating removes those penalties. A checkride is on the Career page.`;
      if (yes) yes.textContent = "ACCEPT ANYWAY";
    } else if (kind === "ifr-complete") {
      const m = state.active;
      const fine = ifrFine(m);
      if (title) title.textContent = "IFR WITHOUT RATING";
      if (copy) copy.textContent = `This sortie is IFR or LIFR and you do not hold an Instrument Rating. Completing posts Illegal IFR Operation −${fine.xp} XP and Safety violation −${moneyFmt(fine.money)}.`;
      if (yes) yes.textContent = "COMPLETE ANYWAY";
    } else if (kind === "ifr-check") {
      const fee = ifrFee();
      if (title) title.textContent = "INSTRUMENT CHECKRIDE";
      if (copy) copy.textContent = fee
        ? `Written checkride. Four of five to pass. The fee of ${moneyFmt(fee)} is charged only if you pass. Pass grants the Instrument Rating now. Private certificate required.`
        : `Written checkride. Four of five to pass. Money is off, so there is no fee. Pass grants the Instrument Rating now.`;
      if (yes) yes.textContent = "BEGIN";
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
    if (acId && serviceBlocks(acId)) return;
    if (ifrIllegal(m) && !m.ifrAck) {
      state.pendingAccept = m;
      openConfirm("ifr-accept");
      return;
    }
    setActive({ ...m, acceptedAt: new Date().toISOString(), mode: m.mode || state.mode });
    setMissions((state.missions || []).filter((x) => x.id !== m.id));
    sfx("accept");
    simResetWatch();
    renderActive();
    renderMissions();
    if (m.dest) loadWx(m.dest, false, "arr");
  }

  function abortMission() {
    const st = pilotStats();
    st.aborts = (st.aborts || 0) + 1;
    st.clean = 0;
    saveProfile();
    sfx("abort");
    simResetWatch();
    setActive(null);
    renderActive();
    renderMissions();
    renderRank();
    if (state.missions[0] && state.missions[0].dest) loadWx(state.missions[0].dest, false, "arr");
    else loadWx(null, false, "arr");
  }

  function yn(v) {
    return v ? "yes" : "no";
  }

  function writeSortieReport(m, info) {
    const s = simSnap || {};
    const L = simLatch || {};
    const dep = icaoOf(m && m.dep) || "DEP";
    const dest = icaoOf(m && m.dest) || "DEST";
    const ac = AIRCRAFT.find((a) => a.id === (m && m.ac)) || state.ac || {};
    const crashed = !!(info && info.crashed);
    const why = s.crashWhy || L.crashWhy || "";
    const fpm = (s.hasFpm || L.hasFpm) ? (s.hasFpm ? s.touchFpm : L.touchFpm) : null;
    const lines = [
      "TWOFLY SORTIE REPORT",
      "Recorded " + new Date().toISOString(),
      "",
      "SORTIE",
      "Mode: " + ((m && m.mode) === "airline" ? "Career" : "Free Flight"),
      "Aircraft: " + (ac.name || m.ac || ""),
      "Route: " + dep + " to " + dest,
      "Counted as a crash: " + yn(crashed),
      "Airframe wear applied: " + yn(careerWear(m)),
      "",
      "SIMCONNECT",
      "Connected: " + yn(s.connected),
      "On ground: " + (s.onGround == null ? "unknown" : yn(s.onGround)),
      "Airborne: " + yn(s.airborne),
      "Landing logged: " + yn(s.landed || L.landAt),
      "Landing time: " + (s.landAt || L.landAt || "none"),
      "Crash flag: " + yn(s.crashed || L.crashed),
      "Crash reason: " + (why || "none"),
      "Touchdown rate: " + (fpm == null ? "not recorded" : fpm + " fpm"),
      "Touchdown speed: " + ((s.hasFpm || L.hasFpm) ? ((s.touchIas || L.touchIas || 0) + " kt") : "not recorded"),
      "Touchdown G: " + ((s.hasFpm || L.hasFpm) ? String(s.touchG || L.touchG || 0) : "not recorded"),
      "Lowest vertical speed while airborne: " + ((s.minVs || L.minVs || 0) + " fpm"),
      "Highest G while airborne: " + String(s.peakG || L.peakG || s.maxG || L.maxG || 0),
      "Bank at last sample: " + ((s.bank || 0) + " deg"),
      "Max bank: " + ((s.maxBank || L.maxBank || 0) + " deg"),
      "Overbank past 70: " + yn(s.overbank || L.overbank),
      "Go-around: " + yn(s.goAround || L.goAround),
      "Bounce: " + yn(s.bounce || L.bounce),
      "Max indicated speed: " + ((s.maxIas || L.maxIas || 0) + " kt"),
      "Landing position: " + ((s.hasPos || L.hasPos) ? ((s.landLat || L.landLat) + ", " + (s.landLon || L.landLon)) : "none"),
      "Tail: " + (s.atcId || "none"),
      "Callsign: " + (s.callsign || "none"),
      "Sim error: " + (s.err || "none"),
      "",
      "A crash is only the simulator crash event, a touchdown of 2200 fpm or steeper, or 5 G combined with a hard touchdown.",
      "A descent, a turn, or a wing-low landing is not a crash.",
      "Wear and flight hours apply only in Career, and only to an aircraft you own.",
    ];
    const stamp = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
    const name = stamp + "-" + dep + "-" + dest + ".txt";
    fetch("/__twofly/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, text: lines.join("\r\n") + "\r\n" }),
    }).catch(() => {});
  }

  function reviewVoice(m) {
    const t = m && m.type;
    if (t === "cargo" || t === "express" || t === "courier") return "cargo";
    if (t === "medevac") return "med";
    if (t === "official" || t === "rotation") return "official";
    if (t === "bush") return m.payload && m.payload.kind === "pax" ? "pax" : "cargo";
    if (t === "pax" || t === "vip") return "pax";
    return "";
  }

  function starGlyph(n) {
    const s = Math.max(1, Math.min(5, Math.round(Number(n) || 0)));
    return "★★★★★".slice(0, s) + "☆☆☆☆☆".slice(0, 5 - s);
  }

  function nearLandmark(ap) {
    if (!ap || !Number.isFinite(ap.lat) || !Number.isFinite(ap.lon)) return "";
    let best = "";
    let bestD = 18;
    LANDMARKS.forEach((lm) => {
      if (!Number.isFinite(lm.lat) || !Number.isFinite(lm.lon)) return;
      const d = haversineNm(ap, lm);
      if (d < bestD) {
        bestD = d;
        best = lm.n || "";
      }
    });
    return best;
  }

  function customerReview(m, info) {
    if (!state.profile || state.profile.reviewsOn === false) return null;
    if (!m || info.crashed) return null;
    const voice = reviewVoice(m);
    if (!voice) return null;
    const dest = asField(m.dest);
    const place = (dest && (dest.c || dest.n || dest.id)) || "the field";
    const pilot = (state.profile.name || "").trim() || "the pilot";
    const showCo = state.profile.showAirline !== false;
    const company = showCo ? (state.profile.airline || "").trim() : "";
    let mode = "pilot";
    if (company) mode = ["pilot", "company", "both", "none"][Math.floor(Math.random() * 4)];
    else if (Math.random() < 0.45) mode = "none";
    const w = wxBits(m.dest);
    const wx = String(w.wx || "").toUpperCase();
    const cat = w.cat || "";
    const windy = (w.gustKt || 0) >= 22 || (w.windKt || 0) >= 18;
    const storm = /TS/.test(wx);
    const snow = /\b(SN|SG|PL)\b/.test(wx);
    const rain = /\b(RA|DZ|SH)\b/.test(wx);
    const fog = /\b(FG|BR)\b/.test(wx);
    const imc = cat === "MVFR" || cat === "IFR" || cat === "LIFR";
    const land = info.score && info.score.landing && info.score.landing.word;
    const late = !!info.penalty;
    const early = !!info.bonus;
    const timed = !!(m.arrTime && (late || early || isTimed(m)));
    let diverted = false;
    if (info.simLand && simSnap && simSnap.hasPos) {
      const hit = landingPlace(Number(simSnap.landLat), Number(simSnap.landLon), m.dest);
      diverted = !!(hit && !hit.match);
    }
    const scenic = nearLandmark(dest);
    const unrated = !info.score;
    let stars = 5;
    if (!unrated && land === "FIRM") stars = 4;
    else if (!unrated && land === "HARD") stars = 3;
    else if (!unrated && land === "ROUGH") stars = 2;
    else if (!unrated && land === "CRITICAL") stars = 1;
    else if (!unrated && !land) stars = 4;
    if (late) stars -= 1;
    if (diverted) stars = Math.min(stars, 3);
    if (info.score && info.score.goAround) stars = Math.min(stars, 4);
    stars = Math.max(1, Math.min(5, stars));
    const rough = land === "HARD" || land === "ROUGH" || land === "CRITICAL";
    const firm = land === "FIRM";
    const gentle = land === "BUTTER" || land === "SMOOTH";
    const say = (lines) => {
      const ok = lines.filter((line) => {
        if (mode === "none" && (line.includes("{pilot}") || line.includes("{company}"))) return false;
        if (line.includes("{company}") && (mode !== "company" && mode !== "both")) return false;
        if (line.includes("{landmark}") && !scenic) return false;
        return true;
      });
      if (!ok.length) return "";
      const line = pick(ok);
      let who = pilot;
      if (mode === "company") who = company;
      else if (mode === "both") who = `${pilot} of ${company}`;
      return line
        .replaceAll("{pilot}", who)
        .replaceAll("{company}", company)
        .replaceAll("{place}", place)
        .replaceAll("{landmark}", scenic || place);
    };
    const paxGood = [
      "Really enjoyed the flight into {place}. {pilot} did a great job.",
      "Good flight with {pilot}. Nice and easy all the way into {place}.",
      "I had a good trip with {pilot}. We got into {place} without any trouble.",
      "That was a nice flight into {place}.",
      "I enjoyed the trip. {place} was a great place to arrive.",
      "Smooth flight and a good arrival into {place}.",
      "No complaints from me. Good flight into {place}.",
      "{pilot} gave us a really nice flight into {place}.",
      "Everything went pretty smoothly. I enjoyed the trip.",
      "A good trip overall. I'd happily do that flight again.",
      "Nice flight. The arrival into {place} was especially good.",
      "Nothing to complain about. We got there safely and had a good flight.",
      "A comfortable trip into {place}. I'd fly with {pilot} again.",
      "Good flight, good arrival, good trip. Can't ask for much more.",
      "I enjoyed this one. {pilot} handled the flight well.",
    ];
    const paxRough = [
      "The flight was good until we got close to {place}. The landing was a bit rough.",
      "Everything was fine until the arrival. That one got my attention.",
      "Good flight overall, although the landing into {place} was pretty rough.",
      "The trip was enjoyable. The arrival was definitely the rough part.",
      "We made it into {place}, but I felt that landing.",
      "A good flight with a rough ending.",
      "The flight itself was fine. The landing could have been smoother.",
      "Not a bad trip, although the arrival into {place} was a little hard.",
      "Everything went well until the wheels touched down.",
      "I'd call it a good flight. The landing was just a bit memorable.",
      "The arrival was rough, but otherwise I had no real complaints.",
      "A little rough getting into {place}, but we got there safely.",
    ];
    const officialLines = [
      "{pilot} handled the flight professionally. We reached {place} without any issues.",
      "The trip to {place} was handled properly from start to finish.",
      "Everything went as expected. {place} was reached safely.",
      "A straightforward flight into {place}. No issues worth reporting.",
      "{pilot} got the job done. We arrived at {place} safely.",
      "The flight was handled well and completed as tasked.",
      "No problems with the flight. We reached {place} safely.",
      "A solid flight into {place}. Everything went according to plan.",
      "The task was completed successfully. Good work by {pilot}.",
      "Nothing complicated about it. We got the job done and reached {place}.",
    ];
    const medGood = [
      "The patient reached {place} safely. That's what mattered.",
      "{pilot} got the patient into {place} safely.",
      "The patient is down at {place}. Mission completed.",
      "We made it to {place} safely with the patient.",
      "The patient arrived safely at {place}. Thank you, {pilot}.",
      "{pilot} got us into {place} when we needed to get there.",
      "The patient was delivered safely. Good work getting into {place}.",
      "We reached {place} safely. That's all we could ask for.",
    ];
    const medRough = [
      "The arrival was firm, but the patient made it to {place} safely.",
      "It wasn't the smoothest arrival, but we got the patient where they needed to be.",
      "The landing was a little rough, but the patient reached {place} safely.",
    ];
    const cargoGood = [
      "The shipment arrived at {place} in good order.",
      "Load delivered to {place}. No complaints.",
      "The shipment reached {place} exactly as expected.",
      "Freight is on the ground at {place}. Job done.",
      "The load made it to {place} safely.",
      "Everything arrived in good shape.",
      "The shipment got where it needed to go. That's what counts.",
    ];
    const cargoTime = ["The freight made it to {place} safely and on time."];
    const cargoRough = [
      "The freight made {place}. The arrival was a little rough, though.",
      "The load reached {place}, although the landing wasn't exactly gentle.",
      "{place} got the shipment. The landing was definitely the weak point.",
      "The freight made it in safely, even if the arrival was a little rough.",
      "Not the smoothest delivery into {place}, but the freight got there.",
      "The shipment arrived safely. Could have done without that landing, though.",
    ];
    const cargoStrip = ["The strip at {place} gave the aircraft a workout, but the load arrived."];
    const wrongLines = [
      "We didn't actually make it to {place}.",
      "We ended up somewhere other than {place}.",
      "That wasn't {place}.",
      "We never reached {place}.",
      "The flight didn't finish at {place} as planned.",
    ];
    const lateLines = [
      "We were a little late getting into {place}.",
      "We made it to {place}, but not quite on time.",
      "We arrived at {place} later than expected.",
      "The flight ran late, but we eventually made it.",
      "We missed the original arrival time into {place}.",
    ];
    const earlyLines = [
      "We actually got into {place} a little early.",
      "We made it into {place} ahead of schedule.",
      "The freight arrived early.",
      "The load was on the ground ahead of schedule.",
    ];
    const onTimeLines = [
      "We arrived right on time.",
      "We made the scheduled window into {place}.",
      "Everything was on time for this trip.",
      "We got into {place} exactly when expected.",
    ];
    const gentleLines = [
      "That was a really nice landing.",
      "Very smooth landing.",
      "Couldn't complain about that arrival.",
      "That was about as smooth as you could ask for.",
      "Nice, gentle touchdown.",
      "The landing was smooth enough to barely notice.",
    ];
    const firmLines = [
      "The landing was a little firm.",
      "That touchdown had some weight behind it.",
      "Definitely felt the landing.",
      "A bit of a firm arrival, but nothing serious.",
      "The touchdown wasn't exactly soft.",
    ];
    const hardLines = [
      "That was a rough landing.",
      "The landing was definitely the rough part.",
      "We felt that touchdown.",
      "That was one of the harder landings I've experienced.",
      "The arrival was pretty rough.",
      "I wouldn't call that a gentle landing.",
      "The landing could have gone a lot better.",
    ];
    const bounceLines = [
      "We bounced a little on landing.",
      "There was a bit of a bounce on touchdown.",
      "That landing had a little extra bounce to it.",
      "We definitely bounced when we touched down.",
      "The first touchdown wasn't exactly the final one.",
    ];
    const aroundLines = [
      "We went around once before getting in.",
      "There was a go-around, but we made it in on the next attempt.",
      "We had to try the approach twice.",
      "The first approach didn't work out, but we landed safely afterward.",
      "There was a go-around on the way in.",
      "We took another shot at the landing and got in the second time.",
    ];
    const stormLines = [
      "There were storms around {place} on the way in.",
      "The weather around {place} made the arrival interesting.",
      "We had some stormy weather coming into {place}.",
      "The storms made for a pretty interesting approach.",
      "Not exactly perfect weather around {place}, but we made it in.",
    ];
    const snowLines = [
      "Snow made the arrival into {place} a little more interesting.",
      "There was quite a bit of snow around {place}.",
      "The snow definitely added something to that arrival.",
      "Not the easiest conditions with all that snow around {place}.",
      "Snow on the way into {place}, but we made it in safely.",
    ];
    const rainLines = [
      "We had rain on the way into {place}.",
      "It was raining when we got into {place}.",
      "A wet arrival into {place}, but nothing too bad.",
      "The rain made for a pretty gloomy approach.",
      "We came into {place} with rain all around us.",
    ];
    const fogLines = [
      "{place} was pretty hard to see until we got close.",
      "Visibility wasn't great on the way in.",
      "The field was hard to pick out until the last part of the approach.",
      "It wasn't exactly easy to see the runway coming into {place}.",
      "The weather had the field pretty well hidden.",
    ];
    const clearLines = [
      "The weather couldn't have been much better.",
      "Beautiful weather all the way into {place}.",
      "Clear skies made for a great arrival.",
      "Couldn't ask for better conditions.",
      "It was a beautiful day for the flight.",
    ];
    const windLines = [
      "It was pretty windy coming into {place}.",
      "The wind made the arrival interesting.",
      "There was quite a bit of wind around {place}.",
      "Definitely a windy approach.",
      "The wind was no joke on the way in.",
    ];
    const viewLines = [
      "The views approaching {place} were worth the trip.",
      "That was a beautiful way to arrive at {place}.",
      "I really enjoyed seeing {place} from the air.",
      "The view of {landmark} was probably my favorite part.",
      "Seeing {landmark} on the way in was pretty cool.",
      "The approach gave us a great view of {landmark}.",
      "I didn't mind the view on the way into {place}.",
      "{place} looked great from the air.",
      "That was a pretty memorable approach into {place}.",
      "The scenery around {place} was fantastic.",
    ];
    const closeGood = [
      "I'd happily do this trip again.",
      "I'd fly with {pilot} again.",
      "I'd book this flight again.",
      "I'd have no problem flying with {pilot} again.",
      "I'd definitely use {company} again.",
      "I'd do this trip again.",
      "No real complaints from me.",
      "Can't complain about that.",
      "I'd call that a good trip.",
      "Happy with the flight overall.",
      "I'd be happy to take this flight again.",
      "Nothing I'd really change about the trip.",
    ];
    const closeMid = [
      "Overall, it was a decent trip.",
      "Not perfect, but not bad either.",
      "A little rough around the edges, but we got there.",
      "Could have been smoother, but it got the job done.",
      "Not my smoothest flight, but it worked out.",
      "I'll take it.",
      "All things considered, it was fine.",
    ];
    const closeBad = [
      "I might think twice before booking this one again.",
      "I wouldn't be rushing to do this trip again.",
      "Hopefully the next flight goes a little better.",
      "Not the kind of arrival I'd want every time.",
      "I'd probably give it another try, but I'd hope for a smoother flight.",
      "The trip could have gone better.",
      "I'm not sure I'd book this one again.",
    ];
    const offPax = [
      "Really enjoyed the flight into {place}. {pilot} did a great job.",
      "Had a really nice flight with {pilot}. {place} was a great way to end it.",
      "Good trip with {pilot}. Everything went smoothly into {place}.",
      "That was a nice flight into {place}. I enjoyed it.",
      "I really enjoyed the trip to {place}.",
      "No complaints here. It was a good flight into {place}.",
      "{pilot} did a great job getting us into {place}.",
      "That was a good trip. I'd happily do it again.",
      "Everything went smoothly and we got there safely. Can't ask for much more.",
      "Really nice flight into {place}. I'd happily fly with {pilot} again.",
      "I enjoyed this one. {pilot} handled the flight really well.",
      "Good flight, good arrival. I have no complaints.",
      "That was an easy, enjoyable trip into {place}.",
      "I had a good time on this flight. {place} looked great from the air.",
      "A really pleasant trip. I'd have no problem flying with {pilot} again.",
      "Everything went well on the way into {place}. I enjoyed the flight.",
      "Nothing much to complain about. Good flight all around.",
      "Nice trip into {place}. I'd definitely take this flight again.",
    ];
    const offOfficial = [
      "{pilot} handled the flight well. We reached {place} without any problems.",
      "Everything went smoothly on the way to {place}.",
      "The trip to {place} went just as expected.",
      "A straightforward flight into {place}. No issues to report.",
      "{pilot} got the job done and got us safely into {place}.",
      "Everything was handled properly and the flight was completed successfully.",
      "No problems with the flight. We made it to {place} safely.",
      "Solid flight into {place}. Everything went according to plan.",
      "The job was completed without any issues. Good work by {pilot}.",
      "Nothing complicated about this one. We got the job done.",
      "Everything went well. {place} was reached safely.",
      "A good, straightforward flight. No complaints from me.",
      "{pilot} handled things well and got us where we needed to be.",
      "The flight went smoothly from our end. Good work.",
      "No issues worth mentioning. The task was completed successfully.",
    ];
    const offMed = [
      "The patient reached {place} safely. That's what matters.",
      "{pilot} got the patient safely into {place}.",
      "The patient is at {place} safely. Mission accomplished.",
      "We made it to {place} with the patient safely.",
      "The patient arrived safely at {place}. Thank you, {pilot}.",
      "{pilot} got us into {place} when we needed to be there.",
      "The patient was delivered safely. That's the important part.",
      "We reached {place} safely. Couldn't ask for more than that.",
      "The patient made it to {place} safely. Good work.",
      "We got the patient where they needed to be.",
      "The patient arrived safely. The flight did what it needed to do.",
      "{pilot} got the job done and got the patient safely to {place}.",
      "Safe arrival at {place}. That's all that mattered on this one.",
      "The patient is safely at {place}. Good flight.",
    ];
    const offCargo = [
      "The shipment made it to {place} in good shape.",
      "Load delivered to {place}. No problems.",
      "The shipment reached {place} just fine.",
      "The freight is on the ground at {place}. Job done.",
      "The load made it to {place} safely.",
      "Everything arrived in good shape.",
      "The shipment got where it needed to go. That's what counts.",
      "The freight made it to {place} safely.",
      "Load's on the ground and everything looks good.",
      "The shipment arrived without any trouble.",
      "Everything made it to {place} in one piece.",
      "The freight got there safely. Can't complain about that.",
      "The load was delivered to {place} without any issues.",
      "Shipment delivered. Everything looks good from here.",
    ];
    const offCargoTime = [
      "The freight made it to {place} right on schedule.",
      "The load arrived at {place} on time.",
      "The shipment was on the ground right when it needed to be.",
      "The freight made its delivery window with time to spare.",
      "Right on schedule. The load is at {place}.",
      "The shipment arrived when it was supposed to.",
    ];
    const offLate = [
      "We were a little late getting into {place}.",
      "We made it to {place}, just a little later than planned.",
      "We arrived at {place} later than expected.",
      "The flight ran a bit late, but we made it.",
      "We got there eventually, although we were running late.",
      "A little behind schedule getting into {place}.",
      "We didn't quite make the original arrival time.",
      "We were running late by the time we got into {place}.",
      "Not exactly on time, but we made it to {place}.",
    ];
    const offEarly = [
      "We actually made it into {place} a little early.",
      "We got into {place} ahead of schedule.",
      "We beat the schedule by a little.",
      "We made it in earlier than expected.",
      "We got there with some time to spare.",
      "Made it to {place} early. Can't complain about that.",
    ];
    const offEarlyCargo = [
      "The freight arrived a little early.",
      "The load was on the ground ahead of schedule.",
      "The shipment was delivered ahead of schedule.",
      "We got there with some time to spare.",
    ];
    const offOnTime = [
      "We arrived right on time.",
      "We made it into {place} right when we were supposed to.",
      "Everything was right on schedule.",
      "We got into {place} exactly when expected.",
      "Made the arrival window without a problem.",
      "Right on time into {place}.",
      "We made it there when we needed to.",
      "Couldn't have timed the arrival much better.",
      "Everything stayed right on schedule.",
    ];
    const offStorm = [
      "There were some pretty nasty storms around {place}.",
      "We had some stormy weather coming into {place}.",
      "The storms made the arrival a little interesting.",
      "There was some rough weather around {place}, but we made it in.",
      "Definitely some weather to deal with around {place}.",
      "The storms were pretty hard to miss on the way in.",
      "Not the nicest weather coming into {place}.",
      "We ran into some storms near {place}.",
      "The weather around {place} wasn't exactly cooperating.",
    ];
    const offSnow = [
      "There was quite a bit of snow around {place}.",
      "The snow made the arrival into {place} interesting.",
      "Not the easiest conditions with all that snow around {place}.",
      "We had snow on the way into {place}, but made it in safely.",
      "Snow all around {place}. Definitely a different kind of arrival.",
      "There was plenty of snow waiting for us at {place}.",
      "The weather around {place} was pretty wintry.",
      "Snow made things a little more interesting on the way in.",
    ];
    const offRain = [
      "We had rain on the way into {place}.",
      "It was raining when we got into {place}.",
      "The rain made for a pretty gloomy arrival.",
      "We came into {place} with rain all around us.",
      "Quite a bit of rain around {place} on the way in.",
      "A wet arrival into {place}, but we made it.",
      "The rain followed us right into {place}.",
      "Definitely a rainy way to arrive at {place}.",
    ];
    const offFog = [
      "{place} was pretty hard to see until we got close.",
      "Visibility wasn't great on the way in.",
      "It took a while before we could really see the field.",
      "The field was hard to pick out until we got close.",
      "The runway wasn't exactly easy to find coming into {place}.",
      "It was pretty hard to see {place} through the weather.",
      "The weather had the field almost completely hidden.",
      "We didn't get a good look at {place} until fairly late.",
      "Visibility made the approach into {place} a little tricky.",
    ];
    const offClear = [
      "The weather couldn't have been much better.",
      "Beautiful weather all the way into {place}.",
      "Couldn't ask for better conditions.",
      "It was a beautiful day for the flight.",
      "Clear skies made for a really nice flight.",
      "Perfect weather for a trip into {place}.",
      "The weather was beautiful from start to finish.",
      "Couldn't have picked a better day to fly.",
      "Clear skies and a great view all the way in.",
    ];
    const offWind = [
      "It was pretty windy coming into {place}.",
      "There was quite a bit of wind around {place}.",
      "Definitely a windy approach.",
      "The wind was no joke on the way in.",
      "We had some strong wind coming into {place}.",
      "The wind made the arrival a little more interesting.",
      "Quite a bit of wind around {place} today.",
      "It was a pretty windy arrival.",
      "The wind definitely made itself known on the way in.",
    ];
    const offView = [
      "The views coming into {place} were worth the trip.",
      "That was a beautiful way to arrive at {place}.",
      "I really enjoyed seeing {place} from the air.",
      "The view of {landmark} was probably my favorite part.",
      "Seeing {landmark} on the way in was pretty cool.",
      "We got a great view of {landmark} from the air.",
      "The approach gave us a really nice view of {landmark}.",
      "{place} looked pretty amazing from the air.",
      "That was a memorable way to arrive at {place}.",
      "The scenery around {place} was fantastic.",
      "I wasn't expecting such a good view of {landmark}.",
      "The view on the way into {place} was one of the best parts.",
      "Definitely enjoyed the scenery around {place}.",
      "That approach was worth it for the view alone.",
    ];
    const offCloseGood = [
      "I'd happily do this trip again.",
      "I'd fly with {pilot} again.",
      "I'd book this flight again.",
      "I'd have no problem flying with {pilot} again.",
      "I'd definitely use {company} again.",
      "I'd do this trip again.",
      "No real complaints from me.",
      "Can't complain about that.",
      "I'd call that a good trip.",
      "Happy with the flight overall.",
      "I'd be happy to take this flight again.",
      "Nothing I'd really change about the trip.",
      "I'd be glad to fly this route again.",
      "I'd have no problem doing this one again.",
      "I'd happily book with {company} again.",
      "Overall, a really good trip.",
      "That's a flight I'd take again.",
    ];
    const offCloseMid = [
      "Overall, it was a decent trip.",
      "Not perfect, but not bad either.",
      "I'll take it.",
      "All things considered, it was fine.",
      "Could have been better, but it got the job done.",
      "Not the smoothest trip, but nothing terrible.",
      "A little rough around the edges, but we made it.",
      "It wasn't perfect, but I can't complain too much.",
      "Could have gone a little better.",
      "Not my favorite flight, but it worked out.",
      "I'll give it a pass.",
      "It was fine once we got there.",
      "Not exactly memorable, but it got us there.",
    ];
    let opening = "";
    const notes = [];
    if (unrated) {
      if (voice === "cargo") opening = say(offCargo);
      else if (voice === "med") opening = say(offMed);
      else if (voice === "official") opening = say(offOfficial);
      else opening = say(offPax);
      if (late) notes.push(say(offLate));
      else if (early && timed) notes.push(say(voice === "cargo" ? offEarlyCargo : offEarly));
      else if (timed) notes.push(say(voice === "cargo" ? offCargoTime : offOnTime));
      if (storm) notes.push(say(offStorm));
      else if (snow) notes.push(say(offSnow));
      else if (rain) notes.push(say(offRain));
      else if (fog || imc) notes.push(say(offFog));
      else if (cat === "VFR") notes.push(say(offClear));
      if (windy) notes.push(say(offWind));
      if (scenic && Math.random() < 0.35) notes.push(say(offView));
    } else if (diverted) opening = say(wrongLines);
    else if (voice === "cargo") {
      if (rough) opening = say(m.type === "bush" ? cargoRough.concat(cargoStrip) : cargoRough);
      else opening = say((!late && timed) ? cargoGood.concat(cargoTime) : cargoGood);
    } else if (voice === "med") opening = say(rough || firm ? medRough : medGood);
    else if (voice === "official") opening = say(officialLines);
    else opening = say(rough ? paxRough : paxGood);
    if (!unrated) {
      if (!diverted && late) notes.push(say(lateLines));
      else if (!diverted && early && timed) notes.push(say(voice === "cargo" ? earlyLines.slice(2) : earlyLines.slice(0, 2)));
      else if (!diverted && timed) notes.push(say(onTimeLines));
      const landingTold = (rough && (voice === "pax" || voice === "cargo")) || (voice === "med" && (rough || firm));
      if (!landingTold && !diverted && gentle && stars >= 4) notes.push(say(gentleLines));
      else if (!landingTold && !diverted && firm) notes.push(say(firmLines));
      else if (!landingTold && !diverted && rough) notes.push(say(hardLines));
      if (simSnap && simSnap.bounce) notes.push(say(bounceLines));
      if (info.score && info.score.goAround) notes.push(say(aroundLines));
      if (storm) notes.push(say(stormLines));
      else if (snow) notes.push(say(snowLines));
      else if (rain) notes.push(say(rainLines));
      else if (fog) notes.push(say(fogLines));
      else if (imc) notes.push(say(fogLines));
      else if (cat === "VFR" && stars >= 4 && !rough) notes.push(say(clearLines));
      if (windy) notes.push(say(windLines));
      if (scenic && stars >= 4 && !rough && !diverted && Math.random() < 0.35) notes.push(say(viewLines));
    }
    const picked = shuffle(notes.filter(Boolean)).slice(0, 2);
    const closerPool = unrated
      ? (stars >= 5 ? offCloseGood : offCloseGood.concat(offCloseMid))
      : (stars >= 5 ? closeGood : stars === 4 ? closeGood.concat(closeMid) : stars === 3 ? closeMid : closeBad);
    const closer = say(closerPool);
    const used = [];
    const bits = [];
    const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
    const overlaps = (a, b) => {
      if (!a || !b) return false;
      if (a === b) return true;
      const [short, long] = a.length < b.length ? [a, b] : [b, a];
      if (short.length >= 24 && long.includes(short)) return true;
      const ha = a.split(" ").slice(0, 6).join(" ");
      const hb = b.split(" ").slice(0, 6).join(" ");
      if (ha.length > 18 && ha === hb) return true;
      if (/\bagain\b/.test(a) && /\bagain\b/.test(b)) return true;
      if (/complain/.test(a) && /complain/.test(b)) return true;
      return false;
    };
    const add = (line) => {
      String(line || "").split(/(?<=[.!?])\s+/).forEach((part) => {
        const text = part.trim();
        const key = norm(text);
        if (!key) return;
        if (used.some((u) => overlaps(u, key))) return;
        used.push(key);
        bits.push(text);
      });
    };
    add(opening);
    picked.forEach(add);
    add(closer);
    return { stars, text: bits.join(" "), place };
  }

  function fileReview(review) {
    if (!review) return;
    const p = state.profile;
    p.repSum = (Number(p.repSum) || 0) + review.stars;
    p.repN = (Number(p.repN) || 0) + 1;
    const list = Array.isArray(p.reviews) ? p.reviews.slice() : [];
    list.unshift({ stars: review.stars, text: review.text, at: new Date().toISOString() });
    p.reviews = list.slice(0, 5);
    saveProfile();
  }

  function completeMission() {
    if (!state.active) return;
    const m = state.active;
    let beforeHave = [];
    try { beforeHave = badges().list.filter((b) => b.have).map((b) => b.id); } catch (e) {}
    const before = {
      marks: new Set(state.collection.marks || []),
      cities: new Set(state.collection.cities || []),
      ports: new Set(state.collection.ports || []),
    };
    const now = scoreNow();
    const beforeN = licenseFor(state.profile.xp).n;
    const crashed = !!(state.profile.simWatch && simSnap && simSnap.crashed);
    let penalty = latePenalty(m, now);
    let bonus = penalty ? 0 : earlyBonus(m, now);
    let ifrMoney = 0;
    let ifrXp = 0;
    if (!crashed && ifrIllegal(m)) {
      const fine = ifrFine(m);
      ifrMoney = state.profile.moneyOn === false ? 0 : fine.money;
      ifrXp = fine.xp;
    }
    if (crashed) {
      bonus = 0;
      penalty = m.money || 0;
      ifrMoney = 0;
      ifrXp = 0;
    }
    const score = simLive() || (simSnap && simSnap.landed)
      ? sortieScore(m, now, {
          crashed,
          overbank: !!(simSnap && simSnap.overbank),
          simLand: !!(simSnap && simSnap.landed),
          hasFpm: !!(simSnap && simSnap.hasFpm),
          touchFpm: simSnap && simSnap.touchFpm,
          hasPos: !!(simSnap && simSnap.hasPos),
          landLat: simSnap && simSnap.landLat,
          landLon: simSnap && simSnap.landLon,
        })
      : null;
    try {
      markFlown(m, bonus, penalty, {
        crashed,
        overbank: !!(simSnap && simSnap.overbank),
        simLand: !!(simSnap && simSnap.landed),
        score,
        ifrMoney,
        ifrXp,
      });
    } catch (err) {
      console.error(err);
    }
    const destId = icaoOf(m.dest);
    if (destId && destId !== "----") {
      const st = pilotStats();
      const list = Array.isArray(st.recentDests) ? st.recentDests.slice() : [];
      list.unshift(destId);
      st.recentDests = [...new Set(list)].slice(0, 16);
      saveProfile();
    }
    setActive(null);
    renderActive();
    renderMissions();
    loadWx(null, false, "arr");
    const afterMarks = new Set(state.collection.marks || []);
    const afterPorts = new Set(state.collection.ports || []);
    const afterCities = new Set(state.collection.cities || []);
    const unlocked = [];
    afterMarks.forEach((id) => { if (!before.marks.has(id)) unlocked.push({ kind: "lm", id, name: (LANDMARKS.find((x) => x.id === id) || {}).n || id }); });
    afterCities.forEach((id) => { if (!before.cities.has(id)) unlocked.push({ kind: "cy", id, name: (CITIES.find((x) => x.id === id) || {}).n || id }); });
    afterPorts.forEach((id) => { if (!before.ports.has(id)) unlocked.push({ kind: "ap", id, name: (PORTS.find((x) => x.id === id) || {}).n || id }); });
    let newAch = [];
    try {
      const afterHave = badges().list.filter((b) => b.have);
      newAch = afterHave.filter((b) => !beforeHave.includes(b.id));
      if (!crashed && newAch.length) {
        const stAch = pilotStats();
        stAch.achAt = stAch.achAt && typeof stAch.achAt === "object" ? stAch.achAt : {};
        const t0 = Date.now();
        newAch.forEach((b, i) => { stAch.achAt[b.id] = t0 + i + 1; });
      }
    } catch (e) {}
    const afterN = licenseFor(state.profile.xp).n;
    const achPay = grantAchPay(newAch, crashed);
    const afterPayN = licenseFor(state.profile.xp).n;
    const certs = grantLicenseAwards(beforeN, Math.max(afterN, afterPayN), crashed);
    splashQueue = [];
    if (!crashed && certs.length) certs.forEach((L) => splashQueue.push({ kind: "cert", lic: L }));
    const review = customerReview(m, {
      crashed,
      penalty,
      bonus,
      score,
      simLand: !!(simSnap && simSnap.landed),
    });
    if (review) fileReview(review);
    showDebrief({
      m,
      bonus,
      penalty,
      ifrMoney,
      ifrXp,
      unlocked: crashed ? [] : unlocked,
      newAch: crashed ? [] : newAch,
      achPay,
      crashed,
      overbank: !!(simSnap && simSnap.overbank),
      simLand: !!(simSnap && simSnap.landed),
      score,
      review,
    });
    writeSortieReport(m, { crashed, score });
  }

  let simSnap = { connected: false };
  let simLatch = { crashed: false, crashWhy: "", overbank: false, landAt: "", hasFpm: false, touchFpm: 0, touchIas: 0, touchG: 0, bounce: false, goAround: false, maxG: 0, maxIas: 0, minVs: 0, peakG: 0, maxBank: 0, hasPos: false, landLat: 0, landLon: 0 };
  let simEpoch = -1;
  let simEpochFloor = -1;

  function noteSimLatch() {
    if (simSnap.crashed) simLatch.crashed = true;
    if (simSnap.crashWhy) simLatch.crashWhy = simSnap.crashWhy;
    if (simSnap.overbank) simLatch.overbank = true;
    if (simSnap.landAt) simLatch.landAt = simSnap.landAt;
    if (simSnap.hasFpm) {
      simLatch.hasFpm = true;
      simLatch.touchFpm = simSnap.touchFpm;
      simLatch.touchIas = simSnap.touchIas || 0;
      simLatch.touchG = simSnap.touchG || 0;
    }
    if (simSnap.bounce) simLatch.bounce = true;
    if (simSnap.goAround) simLatch.goAround = true;
    if ((simSnap.maxG || 0) > simLatch.maxG) simLatch.maxG = simSnap.maxG;
    if ((simSnap.maxIas || 0) > simLatch.maxIas) simLatch.maxIas = simSnap.maxIas;
    if (typeof simSnap.minVs === "number" && simSnap.minVs < (simLatch.minVs || 0)) simLatch.minVs = simSnap.minVs;
    if ((simSnap.peakG || 0) > (simLatch.peakG || 0)) simLatch.peakG = simSnap.peakG;
    if ((simSnap.maxBank || 0) > (simLatch.maxBank || 0)) simLatch.maxBank = simSnap.maxBank;
    if (simSnap.hasPos) {
      simLatch.hasPos = true;
      simLatch.landLat = simSnap.landLat;
      simLatch.landLon = simSnap.landLon;
    }
  }

  function scoreNow() {
    if (state.profile && state.profile.simWatch && simSnap && simSnap.landAt) {
      const t = Date.parse(simSnap.landAt);
      if (Number.isFinite(t)) return t;
    }
    return Date.now();
  }

  async function pollSim() {
    try {
      const r = await fetch("/__twofly/sim", { cache: "no-store" });
      if (!r.ok) {
        simSnap = { ...simSnap, connected: false };
        return;
      }
      const next = await r.json();
      if (typeof next.epoch === "number") {
        if (next.epoch <= simEpochFloor) return;
        simEpoch = next.epoch;
      }
      if (simLatch.crashed) next.crashed = true;
      if (!next.crashWhy && simLatch.crashWhy) next.crashWhy = simLatch.crashWhy;
      if (simLatch.overbank) next.overbank = true;
      if (!next.landAt && simLatch.landAt) next.landAt = simLatch.landAt;
      if (simLatch.hasFpm && !next.hasFpm) {
        next.hasFpm = true;
        next.touchFpm = simLatch.touchFpm;
        next.touchIas = simLatch.touchIas;
        next.touchG = simLatch.touchG;
      }
      if (simLatch.bounce) next.bounce = true;
      if (simLatch.goAround) next.goAround = true;
      if ((simLatch.maxG || 0) > (next.maxG || 0)) next.maxG = simLatch.maxG;
      if ((simLatch.maxIas || 0) > (next.maxIas || 0)) next.maxIas = simLatch.maxIas;
      if ((simLatch.minVs || 0) < (next.minVs || 0)) next.minVs = simLatch.minVs;
      if ((simLatch.peakG || 0) > (next.peakG || 0)) next.peakG = simLatch.peakG;
      if ((simLatch.maxBank || 0) > (next.maxBank || 0)) next.maxBank = simLatch.maxBank;
      if (simLatch.hasPos && !next.hasPos) {
        next.hasPos = true;
        next.landLat = simLatch.landLat;
        next.landLon = simLatch.landLon;
      }
      simSnap = next;
      noteSimLatch();
    } catch (e) {
      simSnap = { ...simSnap, connected: false };
    }
  }

  function simResetWatch() {
    if (simEpoch >= 0) simEpochFloor = simEpoch;
    simLatch = { crashed: false, crashWhy: "", overbank: false, landAt: "", hasFpm: false, touchFpm: 0, touchIas: 0, touchG: 0, bounce: false, goAround: false, maxG: 0, maxIas: 0, minVs: 0, peakG: 0, maxBank: 0, hasPos: false, landLat: 0, landLon: 0 };
    simSnap = { connected: !!simSnap.connected, atcId: simSnap.atcId || "" };
    fetch("/__twofly/sim", { method: "POST", cache: "no-store" }).catch(function () {});
  }

  function simLiveBits() {
    if (!simSnap.connected) return { off: true };
    return {
      bank: Math.round(simSnap.bank || 0),
      air: !!simSnap.airborne,
      ground: simSnap.onGround !== false && !simSnap.airborne,
    };
  }

  function simStatusLine() {
    if (!simSnap.connected) return `<p class="muted">SIM OFFLINE</p>`;
    if (simSnap.err) return `<p class="muted">SIM ONLINE · FLIGHT NOT STARTED</p>`;
    return `<p class="muted">SIM LIVE · ${simSnap.airborne ? "AIRBORNE" : "ON GROUND"}</p>`;
  }

  function paintSimLine() {
    const el = $("#sim-line");
    if (!el) return;
    el.hidden = false;
    el.classList.toggle("off", !simSnap.connected);
    if (!simSnap.connected) {
      el.textContent = "SIM OFFLINE";
      return;
    }
    if (simSnap.err) {
      el.innerHTML = `<span class="sim-live"><i></i> SIM ONLINE · FLIGHT NOT STARTED</span>`;
      return;
    }
    el.innerHTML = `<span class="sim-live"><i></i> SIM LIVE · ${simSnap.airborne ? "AIRBORNE" : "ON GROUND"}</span>`;
  }

  function isTimed(m) {
    return m && (m.type === "express" || m.type === "vip" || m.type === "official" || m.type === "courier" || m.type === "medevac");
  }

  function latePenalty(m, now) {
    if (!m || (m.mode || state.mode) !== "airline") return 0;
    if (!isTimed(m) || !m.arrTime) return 0;
    const arr = new Date(m.arrTime).getTime();
    if (!Number.isFinite(arr)) return 0;
    const lateMin = (now - arr) / 60000;
    const grace = 15;
    if (lateMin <= grace) return 0;
    const over = lateMin - grace;
    const cap = m.type === "express" ? 0.5 : 0.35;
    const frac = Math.min(cap, 0.1 + over * 0.01);
    return Math.max(0, Math.round((m.money || 0) * frac / 5) * 5);
  }

  function earlyBonus(m, now) {
    if (!m || !m.arrTime) return 0;
    const arr = new Date(m.arrTime).getTime();
    if (!Number.isFinite(arr)) return 0;
    const earlyMin = (arr - now) / 60000;
    if (earlyMin < 5) return 0;
    const fromTime = Math.round(earlyMin * 15);
    const cap = Math.round((m.money || 0) * 0.15);
    return Math.max(0, Math.min(fromTime, cap || fromTime));
  }

  function simLive() {
    return !!(state.profile && state.profile.simWatch && simSnap && simSnap.connected);
  }

  function landBands(cls) {
    if (cls === "jet" || cls === "airliner") return [180, 360, 550, 800, 1100];
    if (cls === "turboprop") return [160, 320, 520, 750, 1000];
    if (cls === "helo" || cls === "evtol") return [80, 180, 350, 550, 800];
    return [150, 300, 500, 700, 1000];
  }

  function landingCall(down, cls) {
    const bands = landBands(cls);
    const words = ["BUTTER", "SMOOTH", "FIRM", "HARD", "ROUGH", "CRITICAL"];
    const pts = [30, 27, 22, 14, 8, 3];
    let i = bands.findIndex((n) => down <= n);
    if (i < 0) i = 5;
    return { down, word: words[i], pts: pts[i] };
  }

  function fieldRadiusNm(ap) {
    if (!ap) return 1.5;
    if (fieldKind(ap) === "helipad") return 0.8;
    const rw = ap.rw || 0;
    const half = rw > 0 ? rw / 6076 / 2 : 0;
    return Math.min(4, Math.max(1.5, half + 1.2));
  }

  function landingPlace(lat, lon, dest) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    if (Math.abs(lat) < 0.01 && Math.abs(lon) < 0.01) return null;
    const here = { lat, lon };
    const destAp = airportOf(dest);
    if (destAp && Number.isFinite(destAp.lat) && Number.isFinite(destAp.lon)) {
      const d = haversineNm(here, destAp);
      if (d <= fieldRadiusNm(destAp)) return { ap: destAp, d, match: true };
    }
    let best = null;
    let bestD = 8;
    for (let i = 0; i < airports.length; i++) {
      const a = airports[i];
      if (!Number.isFinite(a.lat) || !Number.isFinite(a.lon)) continue;
      const d = haversineNm(here, a);
      if (d < bestD) {
        bestD = d;
        best = a;
      }
    }
    return { ap: best, d: best ? bestD : null, match: !!(best && destAp && best.id === destAp.id) };
  }

  function letterFor(pts) {
    if (pts >= 95) return { letter: "S", title: "EXCEPTIONAL SORTIE" };
    if (pts >= 90) return { letter: "A", title: "EXCELLENT SORTIE" };
    if (pts >= 80) return { letter: "B", title: "GOOD SORTIE" };
    if (pts >= 70) return { letter: "C", title: "ACCEPTABLE SORTIE" };
    if (pts >= 60) return { letter: "D", title: "POOR SORTIE" };
    return { letter: "F", title: "FAILED SORTIE" };
  }

  function sortieScore(m, now, flags) {
    flags = flags || {};
    if (!(simLive() || flags.simLand)) return null;
    const crashed = !!flags.crashed;
    const ac = AIRCRAFT.find((a) => a.id === (m && m.ac)) || state.ac || {};
    const notes = [];
    if (crashed) {
      const fail = letterFor(0);
      return {
        pts: 0,
        letter: "F",
        title: fail.title,
        tone: "rough",
        grade: "F",
        landing: null,
        goAround: false,
        ops: 0,
        cats: [
          { k: "MISSION", have: 0, max: 25 },
          { k: "LANDING", have: 0, max: 30 },
          { k: "HANDLING", have: 0, max: 20 },
          { k: "OPERATIONS", have: 0, max: 15 },
          { k: "EFFICIENCY", have: 0, max: 10 },
        ],
        notes: ["Crash logged" + (simSnap && simSnap.crashWhy ? " (" + simSnap.crashWhy + ")" : "") + ". The sortie is a fail. Pay and collectables did not post."],
        watch: true,
      };
    }
    let mission = 15;
    if (!flags.simLand) {
      const err = simSnap && simSnap.err;
      const stuck = !!(simSnap && simSnap.connected && !(simSnap.maxIas > 30) && !simSnap.airborne);
      if (err) {
        notes.push("The sim was online, but the flight had not started, so no landing was logged.");
      } else if (stuck) {
        notes.push("The sim stayed connected, but speed and height never moved, so the landing was not logged. That is a Sim Watch miss, not an early Complete.");
      } else {
        notes.push("Complete was pressed before the sim logged a landing.");
      }
    } else if (flags.hasPos || (simSnap && simSnap.hasPos)) {
      const lat = Number(flags.landLat != null ? flags.landLat : simSnap.landLat);
      const lon = Number(flags.landLon != null ? flags.landLon : simSnap.landLon);
      const place = landingPlace(lat, lon, m && m.dest);
      const planned = airportOf(m && m.dest);
      const planId = planned && planned.id ? planned.id : "the planned field";
      if (place && place.match) {
        mission = 25;
        notes.push(`Landed at ${place.ap.id}.`);
      } else if (place && place.ap) {
        mission = 12;
        notes.push(`Landed at ${place.ap.id}, not ${planId}. The sortie still counts.`);
      } else {
        mission = 12;
        notes.push(`The landing was not at ${planId}. The sortie still counts.`);
      }
    } else {
      mission = 20;
      notes.push("Landing logged. Position was not recorded, so the field was not checked.");
    }
    let landing = null;
    let landPts = flags.simLand ? 18 : 8;
    if (flags.simLand && flags.hasFpm) {
      const down = Math.max(0, Math.round(-Math.min(0, Number(flags.touchFpm) || 0)));
      landing = landingCall(down, ac.cls);
      landPts = landing.pts;
      if (flags.bounce || (simSnap && simSnap.bounce)) {
        landPts = Math.max(0, landPts - 4);
        notes.push("Bounce after touchdown.");
      }
      const speed = Number(flags.touchIas || (simSnap && simSnap.touchIas) || 0);
      notes.push(`Touchdown ${down} ft/min${speed ? ", " + Math.round(speed) + " knots" : ""}. ${landing.word.charAt(0) + landing.word.slice(1).toLowerCase()} for the ${ac.name || "aircraft"}.`);
    } else if (flags.simLand) {
      notes.push("Landing rate was not recorded.");
    }
    if (flags.goAround || (simSnap && simSnap.goAround)) {
      notes.push("Go-around, then a landing. That did not cost points.");
    }
    let handling = 20;
    if (flags.overbank) {
      handling -= 8;
      notes.push("Bank went past 70°.");
    }
    const maxG = Number(flags.maxG || (simSnap && simSnap.maxG) || 0);
    if (maxG >= 2.5) {
      handling -= 4;
      notes.push(`Peak load ${maxG.toFixed(1)} G.`);
    }
    const maxIas = Number(flags.maxIas || (simSnap && simSnap.maxIas) || 0);
    const cruise = ac.cruise || 0;
    const fast = cruise && maxIas > (ac.cls === "jet" || ac.cls === "airliner" ? cruise + 40 : cruise * 1.3);
    if (fast) {
      handling -= 4;
      notes.push(`Speed reached ${Math.round(maxIas)} knots.`);
    }
    handling = Math.max(0, handling);
    let ops = 15;
    if (m && ifrIllegal(m)) {
      ops -= 5;
      notes.push("IFR weather without an Instrument Rating.");
    }
    let eff = 10;
    const planned = m && m.eteMin ? m.eteMin : 0;
    const started = m && m.acceptedAt ? Date.parse(m.acceptedAt) : NaN;
    if (planned > 0 && Number.isFinite(started)) {
      const actual = Math.max(1, (now - started) / 60000);
      if (actual > planned * 2.2) eff = 4;
      else if (actual > planned * 1.5) eff = 7;
      notes.push(`Planned ${Math.round(planned)} min. ${Math.round(actual)} min to the landing.`);
    }
    const pts = Math.max(0, Math.min(100, mission + landPts + handling + ops + eff));
    const mark = letterFor(pts);
    const hard = landing && ["HARD", "ROUGH", "CRITICAL"].includes(landing.word);
    if (hard) sessionHard += 1;
    return {
      pts,
      letter: mark.letter,
      title: mark.title,
      tone: mark.letter === "S" || mark.letter === "A" ? "clean" : mark.letter === "D" || mark.letter === "F" ? "rough" : "good",
      grade: mark.letter,
      landing,
      goAround: !!(flags.goAround || (simSnap && simSnap.goAround)),
      ops,
      cats: [
        { k: "MISSION", have: mission, max: 25 },
        { k: "LANDING", have: landPts, max: 30 },
        { k: "HANDLING", have: handling, max: 20 },
        { k: "OPERATIONS", have: ops, max: 15 },
        { k: "EFFICIENCY", have: eff, max: 10 },
      ],
      notes,
      watch: true,
    };
  }

  function grantAchPay(newAch, crashed) {
    if (crashed || !newAch || !newAch.length) return [];
    const out = [];
    newAch.forEach((b) => {
      if (CERT_ACH[b.id]) return;
      const pay = ACH_PAY[b.id] || [250, 40];
      const [money, xp] = pay;
      state.profile.money += money;
      state.profile.xp += xp;
      out.push({ id: b.id, label: b.label, money, xp });
    });
    if (out.length) {
      saveProfile();
      renderPilotChip();
      renderLog();
    }
    return out;
  }

  function grantLicenseAwards(fromN, toN, crashed) {
    if (crashed || toN <= fromN) return [];
    const earned = [];
    LICENSES.forEach((L) => {
      if (L.n > fromN && L.n <= toN) {
        const money = (L.award && L.award.money) || 0;
        const xp = (L.award && L.award.xp) || 0;
        state.profile.money += money;
        state.profile.xp += xp;
        earned.push(L);
      }
    });
    if (earned.length) {
      state.profile.certN = Math.max(Number(state.profile.certN) || 1, toN);
      saveProfile();
      renderPilotChip();
      renderLog();
      renderHangar();
      renderAircraft();
      fillJobTypes();
    }
    return earned;
  }

  function showNextSplash() {
    const box = $("#debrief");
    const body = $("#debrief-body");
    const kick = box && box.querySelector(".pedia-kicker");
    const go = $("#debrief-go");
    if (!box || !body) return false;
    const item = splashQueue.shift();
    if (!item) return false;
    if (item.kind === "cert") {
      const L = item.lic;
      if (kick) kick.textContent = L.rating ? "RATING EARNED" : "CERTIFICATE EARNED";
      if (go) go.textContent = splashQueue.length ? "CONTINUE" : "VIEW LOGBOOK";
      const pay = L.award && (L.award.money || L.award.xp)
        ? `<div class="wx-grid debrief-grid"><div><span>PAY</span><b>${moneyFmt(L.award.money || 0)}</b></div><div><span>XP</span><b>+${L.award.xp || 0}</b></div></div>`
        : "";
      body.innerHTML = `
        <h2>${esc(L.name)}</h2>
        <p class="muted">${esc(L.note || "")}</p>
        <p class="pedia-kicker">NOW AVAILABLE</p>
        <ul class="debrief-list">${(L.jobs || []).map((j) => `<li>${esc(j)}</li>`).join("")}</ul>
        ${pay}
      `;
      box.hidden = false;
      sfx("ach");
      return true;
    }
    return false;
  }

  function showDebrief(info) {
    const box = $("#debrief");
    const body = $("#debrief-body");
    if (!box || !body) return;
    const m = info.m || {};
    const pay = m.money || 0;
    const xp = m.xp || xpFor(m);
    const bonus = info.bonus || 0;
    const penalty = info.penalty || 0;
    const ifrMoney = info.ifrMoney || 0;
    const ifrXp = info.ifrXp || 0;
    const net = Math.max(0, pay + bonus - penalty - ifrMoney);
    const arr = m.arrTime ? new Date(m.arrTime).getTime() : 0;
    const scoredAt = info.score && info.simLand ? (simSnap.landAt ? Date.parse(simSnap.landAt) : Date.now()) : Date.now();
    const timing = (info.score && info.score.time) || (!arr ? "" : (scoredAt < arr - 5 * 60000 ? "EARLY" : scoredAt <= arr + 15 * 60000 ? "ON TIME" : "LATE"));
    const score = info.score;
    const unlocks = (info.unlocked || []).map((u) => {
      const kind = u.kind === "lm" ? "LANDMARK" : u.kind === "cy" ? "CITY POSTCARD" : "AIRPORT POSTCARD";
      return `<li><b>${kind}</b> ${esc(u.name || u.id)}</li>`;
    }).join("");
    const ach = (info.newAch || []).filter((b) => !b.hidden || b.have).map((b) => {
      const pay = (info.achPay || []).find((p) => p.id === b.id);
      const extra = pay ? ` · ${moneyFmt(pay.money)} · +${pay.xp} XP` : "";
      return `<li><b>${esc(b.label)}</b> ${esc(b.info)}${extra}</li>`;
    }).join("");
    body.innerHTML = `
      <h2>${esc(icaoOf(m.dep))} → ${esc(icaoOf(m.dest))}</h2>
      <p class="muted">${esc(fieldCaption(m.dep))} → ${esc(fieldCaption(m.dest))}${timing ? " · " + timing : ""}</p>
      ${info.review ? `<div class="review-card">
        <p class="pedia-kicker">CUSTOMER REVIEW</p>
        <p class="review-stars">${starGlyph(info.review.stars)} <span>${Number(info.review.stars).toFixed(1)}</span></p>
        <p class="review-line">${esc(info.review.text)}</p>
      </div>` : (info.crashed && state.profile && state.profile.reviewsOn !== false && reviewVoice(m) ? `<p class="muted">No customer review. The flight did not finish.</p>` : "")}
      ${score ? `<div class="score-card score-${score.tone || "good"}">
        <div class="score-letter">${esc(score.letter || score.grade || "")}</div>
        <div>
          <div class="score-grade">${esc(score.title || score.grade || "")}</div>
          <div class="score-cats">
            ${(score.cats || []).map((c) => `<div class="score-cat"><span>${esc(c.k)}</span><b>${c.have} / ${c.max}</b></div>`).join("")}
            <div class="score-cat score-total"><span>TOTAL</span><b>${score.pts} / 100</b></div>
          </div>
        </div>
        ${(score.notes || []).length ? `<ul class="score-notes">${score.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}
      </div>` : `<p class="muted">No sim connection. Sortie logged without a rating.</p>`}
      <div class="wx-grid debrief-grid">
        <div><span>PAY</span><b>${moneyFmt(net)}</b></div>
        ${bonus ? `<div><span>EARLY BONUS</span><b>${moneyFmt(bonus)}</b></div>` : ""}
        ${penalty ? `<div><span>LATE PENALTY</span><b>−${moneyFmt(penalty)}</b></div>` : ""}
        ${ifrMoney ? `<div><span>SAFETY VIOLATION</span><b>−${moneyFmt(ifrMoney)}</b></div>` : ""}
        <div><span>XP</span><b>${info.crashed ? "0" : `+${Math.max(0, xp - ifrXp)}`}</b></div>
        ${ifrXp && !info.crashed ? `<div><span>ILLEGAL IFR</span><b>−${ifrXp} XP</b></div>` : ""}
      </div>
      ${info.crashed ? `<p class="muted">Crash logged${simSnap && simSnap.crashWhy ? " (" + esc(simSnap.crashWhy) + ")" : ""}. Pay and collectables did not post. A normal descent is not a crash.</p>` : ""}
      ${info.overbank && !info.crashed ? `<p class="muted">Steep bank logged. The sortie still counts.</p>` : ""}
      ${info.simLand && !info.crashed ? `<p class="muted">Arrival time taken from the sim landing, not the Complete click.</p>` : ""}
      ${info.ifrXp && !info.crashed ? `<p class="muted">Illegal IFR operation. An Instrument Rating would have cleared the penalty.</p>` : ""}
      ${unlocks ? `<p class="pedia-kicker">COLLECTABLES</p><ul class="debrief-list">${unlocks}</ul>` : ""}
      ${ach ? `<p class="pedia-kicker">ACHIEVEMENTS</p><ul class="debrief-list">${ach}</ul>` : ""}
      ${penalty ? `<p class="muted">Career timed tasking. On-block was missed; pay is docked.</p>` : ""}
    `;
    box.hidden = false;
    sfx("complete");
    if (info.unlocked && info.unlocked.length) setTimeout(() => sfx("stamp"), 280);
    if (info.newAch && info.newAch.length) setTimeout(() => sfx("ach"), 520);
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
    sfx(held ? "stamp" : "click");
    if (!held) {
      body.innerHTML = `
        <p class="pedia-kicker">ENCYCLOPEDIA</p>
        <h2>${title}</h2>
        <p class="muted">${kind === "cy" ? "POSTCARD NOT UNLOCKED." : kind === "ap" ? "AIRPORT NOT UNLOCKED." : "STAMP NOT UNLOCKED."}</p>`;
      return;
    }
    const page = await fetchPedia(kind, id);
    const st = pilotStats();
    const key = kind + ":" + id;
    st.pediaOpens[key] = (st.pediaOpens[key] || 0) + 1;
    saveProfile();
    const art = stampSrc(kind, id);
    body.innerHTML = `
      <p class="pedia-kicker">ENCYCLOPEDIA</p>
      <h2>${page.title}</h2>
      <figure class="pedia-plate${kind === "cy" || kind === "ap" ? " card" : ""}">
        <img src="${art}" alt="${page.title}" onerror="if(!this.dataset.fb){this.dataset.fb=1;this.src=this.src.replace(/\\.jpg$/i,'.png')}else{this.parentNode.style.display='none'}" />
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
    if (kind === "ap") {
      const pt = PORTS.find((x) => x.id === id || x.icao === id);
      file = (pt && (pt.icao || pt.id)) || id;
    }
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
    const tailNow = simSnap.connected ? sortieTail() : (m.acTail || "");
    box.innerHTML = `
      <label>ACTIVE SORTIE</label>
      <article class="job on">
        <header>
          <span class="tag tag-${m.type}">${t ? t.label : m.type}</span>
          <span class="pay">${payText(m, true)}</span>
        </header>
        <div class="route">
          <div><b>${icaoOf(m.dep)}</b><span>${fieldCaption(m.dep)}</span></div>
          <div class="arrow" aria-hidden="true">✈</div>
          <div><b>${icaoJump(m.dest)}</b><span>${fieldCaption(m.dest)}</span></div>
        </div>
        <div class="stats">
          <span>${fmtNm(m.dist)}</span>
          <span>${hdgBits(m.hdg)}</span>
          <span>ETE ${fmtEte(m.eteMin)}</span>
          <span>DEP ${fmtFieldTime(m.depTime, m.dep)}</span>
          <span>ARR ${fmtFieldTime(m.arrTime, m.dest)}</span>
          <span>${m.acName}${tailNow ? " · " + esc(tailNow) : ""}${simSnap.connected && liveCall() ? " · " + esc(liveCall()) : ""}</span>
          <span>${payLabel(m.pay)}</span>
          ${destWxBits(m.dest)}
          ${ifrIllegal(m) ? `<span class="svc-due">ILLEGAL IFR</span>` : ""}
        </div>
        <p class="brief">${esc(m.brief)}</p>
        ${jobLearnHtml(m)}
        ${simStatusLine()}
        <footer class="job-foot">
          <button class="primary tiny" id="complete-msn" title="Complete whenever the flight is done. You do not have to wait for the scheduled arrival.">COMPLETE</button>
          <button class="ghost" id="abort-msn">ABORT</button>
        </footer>
      </article>`;
    $("#complete-msn").addEventListener("click", async () => {
      if (state.profile && state.profile.simWatch) await pollSim();
      if (ifrIllegal(m)) openConfirm("ifr-complete");
      else completeMission();
    });
    $("#abort-msn").addEventListener("click", () => openConfirm("abort"));
    if (m.dest) loadWx(m.dest, false, "arr");
  }

  function markFlown(m, bonus, penalty, opts) {
    const now = new Date();
    const depWx = wxSnap(m.dep);
    const arrWx = wxSnap(m.dest);
    const acId = m.ac || (state.ac && state.ac.id);
    if (simSnap.connected) m.acTail = sortieTail();
    const crashed = !!(opts && opts.crashed);
    const ttfLeft = acId ? Math.max(0, SERVICE_HRS - sinceService(acId) - Math.round((m.eteMin / 60) * 10) / 10) : 99;
    const pay = crashed ? 0 : Math.max(0, (m.money || 0) + (bonus || 0) - (penalty || 0) - ((opts && opts.ifrMoney) || 0));
    const xp = crashed ? 0 : Math.max(0, ((m.xp || xpFor(m)) - ((opts && opts.ifrXp) || 0)));
    const entry = {
      ...m,
      flown: true,
      flownAt: now.toISOString(),
      hours: Math.round((m.eteMin / 60) * 10) / 10,
      xp,
      money: pay,
      bonus: bonus || 0,
      penalty: penalty || 0,
      crashed,
      wxCat: arrWx.cat || depWx.cat || "",
      depCat: depWx.cat || "",
      arrCat: arrWx.cat || "",
      windKt: Math.max(arrWx.windKt || 0, depWx.windKt || 0, arrWx.gustKt || 0, depWx.gustKt || 0),
      ttfLeft,
      acId,
      score: opts && opts.score ? opts.score.pts : null,
      grade: opts && opts.score ? opts.score.letter || "" : "",
      landing: opts && opts.score && opts.score.landing ? opts.score.landing.word : "",
      goAround: !!(opts && opts.score && opts.score.goAround),
      ops: opts && opts.score ? opts.score.ops : null,
    };
    const i = state.log.findIndex((x) => x.id === m.id);
    if (i >= 0) state.log[i] = { ...state.log[i], ...entry };
    else state.log.unshift(entry);
    state.profile.xp += entry.xp;
    state.profile.money += entry.money;
    if (acId && careerWear(m)) {
      state.profile.hours = state.profile.hours || {};
      state.profile.sinceService = state.profile.sinceService || {};
      state.profile.hours[acId] = Math.round(((state.profile.hours[acId] || 0) + entry.hours) * 10) / 10;
      state.profile.sinceService[acId] = Math.round(((state.profile.sinceService[acId] || 0) + entry.hours) * 10) / 10;
      if (crashed) state.profile.sinceService[acId] = SERVICE_HRS * (100 / WEAR_DROP);
    }
    const st = pilotStats();
    if (crashed) st.clean = 0;
    else st.clean = (st.clean || 0) + 1;
    sessionFlights += 1;
    saveProfile();
    saveLog();
    if (!crashed) mergeUnlocks(unlocksFromFlown([entry]));
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
    if (state.dep && fieldKind(state.dep) === "helipad" && !isRotor(ac)) {
      const near = airports.find((x) => x && x.id !== state.dep.id && fieldKind(x) !== "helipad" && x.cc === state.dep.cc);
      if (near) selectDep(near);
    }
    sfx("select");
    fillTypeSelect();
    syncMakerSelect();
    renderAcMeta();
    syncFav();
  }
  window.__twoflyPick = pickAircraft;

  function simOk(a) {
    const sim = (state.profile && state.profile.sim) || "both";
    if (!a || sim === "both" || !a.sim) return true;
    return a.sim === sim;
  }

  function filteredAircraft() {
    const q = state.acQuery.trim().toLowerCase();
    return AIRCRAFT.filter((a) => {
      if (!simOk(a)) return false;
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
        if (state.mode === "airline" && state.profile.locksOn && !classUnlocked(a.cls)) extra.push("LOCKED");
        else if (serviceBlocks(a.id)) extra.push("GROUNDED");
        return `<option value="${esc(a.id)}"${state.ac && state.ac.id === a.id ? " selected" : ""}>${esc(typeLabel(a))}${extra.length ? " · " + extra.join(" · ") : ""}</option>`;
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
    const tail = sortieTail();
    const call = liveCall();
    el.innerHTML = `
      <div class="ac-ident"><span>${esc(a.maker)}</span><b>${esc(typeLabel(a))}</b></div>
      <p class="ac-nums">${fmtKt(a.cruise)} · ${fmtNm(a.range)} · ${fmtMass(a.payload)} · ${a.pax} pax${a.minRwy ? " · " + fmtField(a.minRwy) : ""}</p>
      ${tail ? `<p class="ac-nums">${esc(tail)}${call ? " · " + esc(call) : ""}</p>` : ""}
      ${a.note ? `<p class="ac-nums">${esc(a.note)}</p>` : ""}
      ${state.mode === "airline" && inHangar(a.id) && state.profile.serviceOn
        ? `<p class="ac-nums">${airframeHours(a.id).toFixed(1)} hr · TTS ${Math.max(0, SERVICE_HRS - sinceService(a.id)).toFixed(1)} hr · ${healthHtml(a.id)}${healthPct(a.id) <= 0 ? " · GROUNDED" : ""}</p>`
        : state.mode === "airline" && inHangar(a.id)
          ? `<p class="ac-nums">${airframeHours(a.id).toFixed(1)} hr</p>`
          : ""}
    `;
    paintSimLine();
  }

  function renderDep() {
    const a = state.dep;
    const card = $("#dep-card");
    if (!card) return;
    if (!a) {
      card.innerHTML = `<div class="muted">ENTER ICAO.</div>`;
      return;
    }
    const facts = [
      a.rw ? fmtField(a.rw) : "",
      a.pv ? "PAVED" : "UNPAVED",
      a.el != null ? fmtField(a.el) : "",
    ].filter(Boolean).join(" · ");
    card.innerHTML = `
      <div class="icao">${a.id}</div>
      <div class="name">${a.n || ""}</div>
      <div class="sub">${[a.c, COUNTRIES[a.cc] || a.cc].filter(Boolean).join(" · ")}</div>
      <div class="dep-facts"><span class="tag">${fieldKind(a)}</span><span>${facts}</span></div>
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
            <div class="arrow" aria-hidden="true">✈</div>
            <div><b>${icaoJump(m.dest)}</b><span>${fieldCaption(m.dest)}</span></div>
          </div>
          <div class="stats">
            <span>${fmtNm(m.dist)}</span>
            <span>${hdgBits(m.hdg)}</span>
            <span>ETE ${fmtEte(m.eteMin)}</span>
            <span>DEP ${fmtFieldTime(m.depTime, m.dep)}</span>
            <span>ARR ${fmtFieldTime(m.arrTime, m.dest)}</span>
            ${(m.mode === "airline" && isTimed(m)) ? "<span>ON-BLOCK</span>" : ""}
            <span>${fmtAlt(m.alt)}</span>
            <span>${payLabel(m.pay)}</span>
            ${m.acTail ? `<span>${m.acTail}</span>` : ""}
            ${destWxBits(m.dest)}
            ${ifrIllegal(m) ? `<span class="svc-due">ILLEGAL IFR</span>` : ""}
          </div>
          <p class="brief">${esc(m.brief)}</p>
          ${jobLearnHtml(m)}
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
    const curXp = p.xp || 0;
    const floor = lic.xp || 0;
    const ceil = lic.next ? lic.next.xp : curXp;
    const pct = lic.next ? Math.max(0, Math.min(100, ((curXp - floor) / Math.max(1, ceil - floor)) * 100)) : 100;
    el.innerHTML = `
      ${iconHtml(p, "chip-face")}
      <div class="chip-meta">
        ${p.showAirline && p.airline ? `<span class="chip-line">${esc(p.airline)}</span>` : ""}
        <b>${esc(p.name || "PILOT")}</b>
        <span class="chip-rank">${esc(lic.name)}</span>
        <span class="chip-xp">${lic.next ? `${curXp.toLocaleString()} / ${ceil.toLocaleString()} XP` : `${curXp.toLocaleString()} XP`}</span>
        <div class="xp-track"><div id="xp-bar" style="width:${pct}%"></div></div>
        ${lic.next ? `<span class="chip-next">→ ${esc(lic.next.name)}</span>` : ""}
        <div class="chip-cash">${moneyFmt(p.money)}</div>
      </div>
    `;
  }

  function fillJobTypes() {
    const typeEl = $("#type");
    if (!typeEl) return;
    const cap = careerTypeSet();
    const plane = new Set(planeTypes(state.ac));
    const opts = TYPES.filter((t) => plane.has(t.id) && (!cap || cap.has(t.id)));
    const cur = state.type || "any";
    typeEl.innerHTML =
      `<option value="any">ANY AUTHORIZED CATEGORY</option>` +
      opts.map((t) => `<option value="${t.id}">${t.label}</option>`).join("");
    if (cur !== "any" && !opts.some((t) => t.id === cur)) {
      state.type = "any";
      typeEl.value = "any";
    } else {
      typeEl.value = cur;
    }
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
      if (blurbLong) blurbLong.textContent = "CAREER MODE is a hangar-only progression game. Certificates unlock aircraft classes and mission types when certificate locks are on. Completing a tasking adds pay and XP. Maintenance and home field apply here.";
    } else {
      if (blurbLong) blurbLong.textContent = "FREE FLIGHT lets you take civilian taskings from any airfield. Every aircraft type in your files is eligible. Completing a sortie adds the payment to your pilot file. Rank restrictions and hangar ownership do not apply.";
    }
    renderHome();
    fillJobTypes();
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
      ? `CURRENT BASE ${home.id} · ${home.n}. USED BY THE HOME BUTTON IN CAREER MODE.`
      : "USED BY THE HOME BUTTON IN CAREER MODE.";
    const homeIn = $("#home-input");
    if (homeIn && document.activeElement !== homeIn) homeIn.value = home ? home.id : "";
  }

  function renderHangar() {
    const fleet = $("#fleet-list");
    const market = $("#market-list");
    const loanEl = $("#loan-panel");
    const p = state.profile;
    if (loanEl) {
      {
        const debt = p.debt || 0;
        const left = creditLeft();
        loanEl.innerHTML = `
        <label>CREDIT</label>
        <div class="wx-grid">
          <div><span>LOAN AVAILABLE</span><b>${moneyFmt(left)}</b></div>
          <div><span>DEBT</span><b>${moneyFmt(debt)}</b></div>
          ${p.interestOn ? `<div><span>INTEREST</span><b>8% / YEAR</b></div>` : `<div><span>INTEREST</span><b>OFF</b></div>`}
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
            sfx("error");
            return;
          }
          sfx("money");
          renderHangar();
          renderPilotChip();
          renderAirline();
        };
        $("#loan-out")?.addEventListener("click", () => go(loanWithdraw));
        $("#loan-pay")?.addEventListener("click", () => go(loanRepay));
      }
    }
    const fleetLab = $("#fleet-label");
    if (fleetLab) fleetLab.textContent = `FLEET ${p.hangar.length}/${hangarCap()}`;
    if (fleet) {
      const rows = p.hangar.map((id) => AIRCRAFT.find((a) => a.id === id)).filter(Boolean);
      fleet.innerHTML = rows.map((a) => {
        const pct = healthPct(a.id);
        const hrs = airframeHours(a.id);
        const since = sinceService(a.id);
        const left = Math.max(0, SERVICE_HRS - since);
        const leased = isLeased(a.id);
        const dead = p.serviceOn && pct <= 0;
        const rate = leased ? leaseRate(a) : 0;
        const remain = leased ? leaseBuyout(a.id) : 0;
        const paid = leased ? leasePaid(a.id) : 0;
        const wearLine = p.serviceOn
          ? ` · ${hrs.toFixed(1)} HR · TTS ${left.toFixed(1)} HR · ${healthHtml(a.id)}${dead ? " · GROUNDED" : ""}`
          : ` · ${hrs.toFixed(1)} HR`;
        return `
        <div class="fleet-row">
          <div>
            <b>${a.name}</b>
            <span class="muted">${a.maker}${wearLine}${leased ? ` · LEASED ${moneyFmt(rate)} / DAY · PAID ${moneyFmt(paid)} · BUYOUT ${moneyFmt(remain)}` : ""}</span>
          </div>
          <div class="fleet-act">
            <button type="button" class="tiny" data-fly="${a.id}">SELECT</button>
            ${p.serviceOn && pct < 100 ? `<button type="button" class="tiny" data-repair="${a.id}">SERVICE ${moneyFmt(repairCost(a))}</button>` : ""}
            ${leased
              ? `<button type="button" class="tiny" data-buyout="${a.id}">${remain ? "BUY OUT " + moneyFmt(remain) : "OWN"}</button>
                 <button type="button" class="ghost tiny" data-return="${a.id}">RETURN</button>`
              : `<button type="button" class="ghost tiny" data-sell="${a.id}">SELL ${moneyFmt(sellPrice(a))}</button>`}
          </div>
        </div>`;
      }).join("") || `<p class="muted">HANGAR EMPTY.</p>`;
    }
    if (market) {
      const q = (state.mktQuery || "").trim().toLowerCase();
      const filt = state.mktFilter || "all";
      const list = AIRCRAFT.filter((a) => {
        if (!simOk(a)) return false;
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
        const full = p.hangar.length >= hangarCap();
        const priceHtml = free
          ? `<span class="price-ok">FREE</span>`
          : `<span class="${afford ? "price-ok" : "price-no"}">${moneyFmt(price)}</span>`;
        const lockHtml = locked ? ` · <span class="lock-rank">CERT LOCK</span>` : "";
        return `<div class="fleet-row">
          <div>
            <b>${a.name}</b>
            <span class="muted">${a.maker} · ${a.cls} · ${a.pax || 0} PAX · ${priceHtml}${lockHtml}</span>
          </div>
          <div class="fleet-act">
            <button type="button" class="tiny" data-buy="${a.id}" ${locked || full ? "disabled" : ""}>${free ? "ADD" : "BUY"}</button>
            ${free ? "" : `<button type="button" class="ghost tiny" data-lease="${a.id}" ${locked || full ? "disabled" : ""}>LEASE ${moneyFmt(leaseRate(a))}/DAY</button>`}
          </div>
        </div>`;
      }).join("") || `<p class="muted">NO MATCHING LISTINGS.</p>`;
    }
  }

  function clampHud(n) {
    const v = Math.round(Number(n) || 100);
    const snapped = Math.round(v / 10) * 10;
    return Math.min(300, Math.max(100, snapped));
  }

  function applyHudScale() {
    const n = clampHud(state.profile && state.profile.hudScale);
    const z = String(n / 100);
    document.documentElement.style.zoom = z;
    document.documentElement.style.setProperty("--hud-z", z);
    const hudVal = $("#hud-scale-val");
    if (hudVal) hudVal.textContent = n + "%";
  }

  function renderSettings() {
    const money = $("#set-money");
    const locks = $("#set-locks");
    const svc = $("#set-service");
    const interest = $("#set-interest");
    const sound = $("#set-sound");
    const clock = $("#set-clock");
    const ccyEl = $("#set-ccy");
    const tempEl = $("#set-units");
    const simEl = $("#set-sim");
    if (money) money.checked = !!state.profile.moneyOn;
    if (locks) locks.checked = !!state.profile.locksOn;
    if (svc) svc.checked = state.profile.serviceOn !== false;
    if (interest) interest.checked = state.profile.interestOn !== false;
    if (sound) sound.checked = state.profile.soundOn !== false;
    const watch = $("#set-simwatch");
    if (watch) watch.checked = !!state.profile.simWatch;
    const reviews = $("#set-reviews");
    if (reviews) reviews.checked = state.profile.reviewsOn !== false;
    const hud = $("#set-hud");
    const hudVal = $("#hud-scale-val");
    const scale = clampHud(state.profile.hudScale);
    if (hud) hud.value = String(scale);
    if (hudVal) hudVal.textContent = scale + "%";
    if (clock) clock.value = state.profile.clock12 ? "12" : "24";
    if (simEl) simEl.value = state.profile.sim === "20" || state.profile.sim === "24" ? state.profile.sim : "both";
    if (ccyEl) {
      if (!ccyEl.options.length) {
        ccyEl.innerHTML = CURRENCIES.map(
          (c) => `<option value="${c.id}">${c.id} — ${c.name}</option>`
        ).join("");
      }
      ccyEl.value = ccy().id;
    }
    if (tempEl) tempEl.value = useEU() ? "eu" : "us";
    renderHome();
  }

  function renderRank() {
    const { title, list, have, total } = badges();
    const rank = $("#rankline");
    if (rank) rank.textContent = title;
    const count = $("#ach-count");
    if (count) count.textContent = `${have} / ${total}`;
    const book = $("#badges-book");
    if (book) {
      const cats = [];
      list.forEach((b) => {
        if (!cats.includes(b.cat)) cats.push(b.cat);
      });
      book.innerHTML = cats.map((cat) => {
        const rows = list.filter((b) => b.cat === cat);
        return `<div class="ach-cat">
          <h4>${cat === "HIDDEN" ? "UNLOGGED" : cat}</h4>
          ${rows.map((b) => {
            const locked = b.hidden && !b.have;
            const name = locked ? "????" : b.label;
            const info = locked ? "Hidden. Keep flying." : b.info;
            const prog = locked ? "" : `<em>${b.max <= 1 && b.have ? "DONE" : b.cur + " / " + b.max}</em>`;
            return `<div class="ach-row${b.have ? " have" : ""}${locked ? " hid" : ""}">
              <div><b>${name}</b><span>${info}</span></div>
              ${prog}
            </div>`;
          }).join("")}
        </div>`;
      }).join("");
    }
  }

  function gmtEtc(lon) {
    let h = Math.round((Number(lon) || 0) / 15);
    if (h > 14) h = 14;
    if (h < -12) h = -12;
    if (h === 0) return "UTC";
    return "Etc/GMT" + (h > 0 ? "-" : "+") + Math.abs(h);
  }

  function tzOf(ap) {
    if (!ap) return undefined;
    const cc = String(ap.cc || "").toUpperCase();
    const rg = String(ap.rg || "").toUpperCase();
    const lon = Number(ap.lon);
    const US = {
      AK: lon < -169 ? "America/Adak" : "America/Anchorage",
      AL: "America/Chicago", AR: "America/Chicago", AZ: "America/Phoenix",
      CA: "America/Los_Angeles", CO: "America/Denver", CT: "America/New_York",
      DC: "America/New_York", DE: "America/New_York",
      FL: lon < -85.5 ? "America/Chicago" : "America/New_York",
      GA: "America/New_York", HI: "Pacific/Honolulu", IA: "America/Chicago",
      ID: lon < -114.5 ? "America/Los_Angeles" : "America/Boise",
      IL: "America/Chicago",
      IN: lon < -87 ? "America/Chicago" : "America/Indiana/Indianapolis",
      KS: lon < -101.5 ? "America/Denver" : "America/Chicago",
      KY: lon < -85.5 ? "America/Chicago" : "America/New_York",
      LA: "America/Chicago", MA: "America/New_York", MD: "America/New_York",
      ME: "America/New_York", MI: "America/Detroit", MN: "America/Chicago",
      MO: "America/Chicago", MS: "America/Chicago", MT: "America/Denver",
      NC: "America/New_York",
      ND: lon < -101 ? "America/Denver" : "America/Chicago",
      NE: lon < -101 ? "America/Denver" : "America/Chicago",
      NH: "America/New_York", NJ: "America/New_York", NM: "America/Denver",
      NV: "America/Los_Angeles", NY: "America/New_York", OH: "America/New_York",
      OK: "America/Chicago",
      OR: lon > -117.5 ? "America/Boise" : "America/Los_Angeles",
      PA: "America/New_York", RI: "America/New_York", SC: "America/New_York",
      SD: lon < -100.5 ? "America/Denver" : "America/Chicago",
      TN: lon < -86.5 ? "America/Chicago" : "America/New_York",
      TX: lon < -104.5 ? "America/Denver" : "America/Chicago",
      UT: "America/Denver", VA: "America/New_York", VT: "America/New_York",
      WA: "America/Los_Angeles", WI: "America/Chicago", WV: "America/New_York",
      WY: "America/Denver", PR: "America/Puerto_Rico", VI: "America/St_Thomas",
      GU: "Pacific/Guam", AS: "Pacific/Pago_Pago", MP: "Pacific/Saipan",
    };
    if (cc === "US") return US[rg] || gmtEtc(lon);
    if (cc === "CA") {
      const CA = {
        AB: "America/Edmonton", BC: "America/Vancouver", MB: "America/Winnipeg",
        NB: "America/Moncton", NL: "America/St_Johns", NS: "America/Halifax",
        NT: "America/Yellowknife", NU: "America/Iqaluit",
        ON: lon < -90 ? "America/Winnipeg" : "America/Toronto",
        PE: "America/Halifax", QC: "America/Toronto", SK: "America/Regina",
        YT: "America/Whitehorse",
      };
      return CA[rg] || "America/Toronto";
    }
    if (cc === "AU") {
      const AU = {
        NSW: "Australia/Sydney", VIC: "Australia/Melbourne", QLD: "Australia/Brisbane",
        SA: "Australia/Adelaide", WA: "Australia/Perth", TAS: "Australia/Hobart",
        NT: "Australia/Darwin", ACT: "Australia/Sydney",
      };
      return AU[rg] || (lon < 129 ? "Australia/Perth" : lon < 138 ? "Australia/Adelaide" : "Australia/Sydney");
    }
    if (cc === "ID") {
      if (lon < 109) return "Asia/Jakarta";
      if (lon < 125) return "Asia/Makassar";
      return "Asia/Jayapura";
    }
    if (cc === "MX") {
      if (lon < -107) return "America/Tijuana";
      if (lon < -102) return "America/Mazatlan";
      return "America/Mexico_City";
    }
    if (cc === "BR") {
      if (lon > -35) return "America/Noronha";
      if (lon < -67) return "America/Rio_Branco";
      if (lon < -54) return "America/Manaus";
      return "America/Sao_Paulo";
    }
    if (cc === "RU") return gmtEtc(lon);
    if (cc === "ES" && lon < -10) return "Atlantic/Canary";
    if (cc === "PT" && lon < -15) return "Atlantic/Azores";
    if (cc === "NZ" && lon < -170) return "Pacific/Chatham";
    const CC = {
      AD:"Europe/Andorra", AE:"Asia/Dubai", AF:"Asia/Kabul", AL:"Europe/Tirane",
      AM:"Asia/Yerevan", AO:"Africa/Luanda", AR:"America/Argentina/Buenos_Aires",
      AT:"Europe/Vienna", AZ:"Asia/Baku", BA:"Europe/Sarajevo", BD:"Asia/Dhaka",
      BE:"Europe/Brussels", BG:"Europe/Sofia", BH:"Asia/Bahrain", BO:"America/La_Paz",
      BY:"Europe/Minsk", BZ:"America/Belize", CH:"Europe/Zurich", CL:"America/Santiago",
      CN:"Asia/Shanghai", CO:"America/Bogota", CR:"America/Costa_Rica", CU:"America/Havana",
      CY:"Asia/Nicosia", CZ:"Europe/Prague", DE:"Europe/Berlin", DK:"Europe/Copenhagen",
      DO:"America/Santo_Domingo", DZ:"Africa/Algiers", EC:"America/Guayaquil",
      EE:"Europe/Tallinn", EG:"Africa/Cairo", ET:"Africa/Addis_Ababa", FI:"Europe/Helsinki",
      FJ:"Pacific/Fiji", FR:"Europe/Paris", GB:"Europe/London", GE:"Asia/Tbilisi",
      GH:"Africa/Accra", GR:"Europe/Athens", GT:"America/Guatemala", HK:"Asia/Hong_Kong",
      HN:"America/Tegucigalpa", HR:"Europe/Zagreb", HU:"Europe/Budapest", IE:"Europe/Dublin",
      IL:"Asia/Jerusalem", IN:"Asia/Kolkata", IQ:"Asia/Baghdad", IR:"Asia/Tehran",
      IS:"Atlantic/Reykjavik", IT:"Europe/Rome", JO:"Asia/Amman", JP:"Asia/Tokyo",
      KE:"Africa/Nairobi", KG:"Asia/Bishkek", KH:"Asia/Phnom_Penh", KR:"Asia/Seoul",
      KW:"Asia/Kuwait", KZ:"Asia/Almaty", LA:"Asia/Vientiane", LB:"Asia/Beirut",
      LK:"Asia/Colombo", LT:"Europe/Vilnius", LU:"Europe/Luxembourg", LV:"Europe/Riga",
      MA:"Africa/Casablanca", MC:"Europe/Monaco", MD:"Europe/Chisinau", ME:"Europe/Podgorica",
      MK:"Europe/Skopje", MM:"Asia/Yangon", MN:"Asia/Ulaanbaatar", MO:"Asia/Macau",
      MT:"Europe/Malta", MY:"Asia/Kuala_Lumpur", MZ:"Africa/Maputo", NA:"Africa/Windhoek",
      NG:"Africa/Lagos", NI:"America/Managua", NL:"Europe/Amsterdam", NO:"Europe/Oslo",
      NP:"Asia/Kathmandu", NZ:"Pacific/Auckland", OM:"Asia/Muscat", PA:"America/Panama",
      PE:"America/Lima", PH:"Asia/Manila", PK:"Asia/Karachi", PL:"Europe/Warsaw",
      PR:"America/Puerto_Rico", PT:"Europe/Lisbon", PY:"America/Asuncion", QA:"Asia/Qatar",
      RO:"Europe/Bucharest", RS:"Europe/Belgrade", SA:"Asia/Riyadh", SE:"Europe/Stockholm",
      SG:"Asia/Singapore", SI:"Europe/Ljubljana", SK:"Europe/Bratislava", SV:"America/El_Salvador",
      TH:"Asia/Bangkok", TN:"Africa/Tunis", TR:"Europe/Istanbul", TW:"Asia/Taipei",
      UA:"Europe/Kyiv", UY:"America/Montevideo", UZ:"Asia/Tashkent", VE:"America/Caracas",
      VN:"Asia/Ho_Chi_Minh", ZA:"Africa/Johannesburg", ZW:"Africa/Harare",
      AT:"Europe/Vienna", ES:"Europe/Madrid",
    };
    if (CC[cc]) return CC[cc];
    return gmtEtc(lon);
  }

  function hourInTz(iso, ap) {
    const d = iso instanceof Date ? iso : new Date(iso);
    if (Number.isNaN(d.getTime())) return -1;
    const tz = tzOf(ap);
    if (!tz) return d.getHours();
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: tz, hour: "numeric", hourCycle: "h23", hour12: false,
      }).formatToParts(d);
      let h = parseInt((parts.find((p) => p.type === "hour") || {}).value, 10);
      if (h === 24) h = 0;
      return Number.isFinite(h) ? h : d.getHours();
    } catch (e) {
      return d.getHours();
    }
  }

  function tzShort(iso, ap) {
    const tz = tzOf(ap);
    if (!tz) return "LCL";
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        timeZoneName: "short",
        hour: "numeric",
      }).formatToParts(iso instanceof Date ? iso : new Date(iso));
      const n = ((parts.find((p) => p.type === "timeZoneName") || {}).value || "LCL")
        .replace("GMT", "UTC")
        .replace(" ", "");
      return n || "LCL";
    } catch (e) {
      return "LCL";
    }
  }

  function fmtTimeOf(iso, ap) {
    if (!iso) return "—";
    const d = iso instanceof Date ? iso : new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    const clock12 = !!(state.profile && state.profile.clock12);
    const tz = tzOf(ap);
    try {
      const opts = { hour: "numeric", minute: "2-digit", hour12: clock12 };
      if (tz) opts.timeZone = tz;
      if (!clock12) opts.hourCycle = "h23";
      const parts = new Intl.DateTimeFormat("en-US", opts).formatToParts(d);
      const hour = (parts.find((p) => p.type === "hour") || {}).value;
      const min = (parts.find((p) => p.type === "minute") || {}).value;
      if (!hour || !min) throw new Error("time");
      if (clock12) {
        const per = ((parts.find((p) => p.type === "dayPeriod") || {}).value || "").toUpperCase().replace(/\./g, "");
        const h = String(parseInt(hour, 10) || 12);
        const ampm = per === "AM" || per === "PM" ? per : (parseInt(hour, 10) < 12 ? "AM" : "PM");
        return `${h}:${min}${ampm}`;
      }
      let h24 = parseInt(hour, 10);
      if (h24 === 24) h24 = 0;
      return `${String(h24).padStart(2, "0")}:${min}`;
    } catch (e) {
      const mm = String(d.getMinutes()).padStart(2, "0");
      if (clock12) {
        const h = d.getHours();
        return `${h % 12 || 12}:${mm}${h < 12 ? "AM" : "PM"}`;
      }
      return `${String(d.getHours()).padStart(2, "0")}:${mm}`;
    }
  }

  function fmtFieldTime(iso, ap) {
    const t = fmtTimeOf(iso, ap);
    if (!ap || t === "—") return t;
    return `${t} ${tzShort(iso, ap)}`;
  }

  function fmtClock(d) {
    if (!d || Number.isNaN(d.getTime())) return "";
    const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
    return `${d.getDate()} ${months[d.getMonth()]} ${String(d.getFullYear()).slice(2)} · ${fmtTimeOf(d)}`;
  }

  function tickClock() {
    const el = $("#desk-clock");
    if (el) el.textContent = fmtClock(new Date());
    pollSim().then(() => {
      paintSimLine();
      if (!(state.profile && state.profile.simWatch)) return;
      if (!state.active) return;
      const k = [simSnap.connected, simSnap.airborne, simSnap.landed, simSnap.crashed, simSnap.overbank, simSnap.atcId || "", simSnap.callsign || ""].join("|");
      if (k === tickClock.lastSim) return;
      tickClock.lastSim = k;
      renderActive();
    });
  }

  function fmtDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return fmtClock(d);
  }

  function ifrRideHtml(lic) {
    if (hasIfr()) return `<p class="log-note">Instrument Rating held. IFR weather does not post a penalty.</p>`;
    if (!lic || lic.n < 2) return `<p class="log-note">Private Pilot required before Instrument IFR checkride.</p>`;
    const fee = ifrFee();
    const broke = fee && (state.profile.money || 0) < fee;
    return `
      <p class="pedia-kicker">INSTRUMENT CHECKRIDE</p>
      <p class="muted">Four of five on a written. Pass grants the Instrument Rating now. ${fee ? "Fee " + moneyFmt(fee) + " on a pass." : "No fee. Money is off."}</p>
      <button type="button" class="primary tiny" id="ifr-check" ${broke ? "disabled" : ""}>${broke ? "NEED " + moneyFmt(fee) : "SIT CHECKRIDE"}</button>
    `;
  }

  function startCheckride() {
    const fee = ifrFee();
    if (hasIfr()) return;
    if (licenseFor().n < 2) return;
    if (fee && (state.profile.money || 0) < fee) return;
    state.pendingRide = { qs: shuffle(IFR_Q.slice()).slice(0, 5), i: 0, score: 0 };
    paintCheckride();
  }

  function paintCheckride() {
    const box = $("#checkride");
    const body = $("#checkride-body");
    const go = $("#checkride-go");
    const no = $("#checkride-no");
    const ride = state.pendingRide;
    if (!box || !body || !ride) return;
    const kick = box.querySelector(".pedia-kicker");
    if (ride.done) {
      if (kick) kick.textContent = ride.pass ? "RATING EARNED" : "NOT A PASS";
      if (go) go.hidden = true;
      if (no) no.textContent = "CLOSE";
      body.innerHTML = ride.pass
        ? `<h2>INSTRUMENT RATING</h2><p>Four of five. The rating is on the pilot file.${ride.fee ? " Fee " + moneyFmt(ride.fee) + " posted." : ""}</p>`
        : `<h2>${ride.score} OF 5</h2><p>Not a pass. No fee charged. Sit it again when you want.</p>`;
      box.hidden = false;
      return;
    }
    const q = ride.qs[ride.i];
    if (kick) kick.textContent = `QUESTION ${ride.i + 1} OF 5`;
    if (go) go.hidden = true;
    if (no) no.textContent = "CANCEL";
    body.innerHTML = `
      <h2>${esc(q.q)}</h2>
      <div class="ride-answers">
        ${q.a.map((t, i) => `<button type="button" class="ghost ride-ans" data-i="${i}">${esc(t)}</button>`).join("")}
      </div>
    `;
    box.hidden = false;
  }

  function answerCheckride(i) {
    const ride = state.pendingRide;
    if (!ride || ride.done) return;
    const q = ride.qs[ride.i];
    if (Number(i) === q.i) ride.score += 1;
    ride.i += 1;
    if (ride.i >= ride.qs.length) {
      finishCheckride();
      return;
    }
    paintCheckride();
  }

  function finishCheckride() {
    const ride = state.pendingRide;
    if (!ride) return;
    ride.done = true;
    ride.pass = ride.score >= 4;
    ride.fee = 0;
    if (ride.pass) {
      const fee = ifrFee();
      if (fee && (state.profile.money || 0) < fee) {
        ride.pass = false;
        ride.broke = true;
      } else {
        if (fee) {
          state.profile.money -= fee;
          ride.fee = fee;
        }
        const before = licenseFor().n;
        state.profile.certN = Math.max(Number(state.profile.certN) || 1, 3);
        saveProfile();
        renderPilotChip();
        renderLog();
        renderHangar();
        renderAircraft();
        fillJobTypes();
        if (before < 3) {
          const L = LICENSES.find((x) => x.n === 3);
          splashQueue.push({ kind: "cert", lic: { ...L, award: { money: 0, xp: 0 } } });
        }
      }
    }
    paintCheckride();
    if (ride.pass) sfx("ach");
    else sfx("error");
  }

  function closeCheckride() {
    const ride = state.pendingRide;
    const box = $("#checkride");
    if (box) box.hidden = true;
    state.pendingRide = null;
    if (ride && ride.pass) {
      if (!showNextSplash()) renderCareerFile();
    } else {
      renderCareerFile();
    }
  }

  function renderCareerFile() {
    const el = $("#career-file");
    if (!el) return;
    const p = state.profile;
    const lic = licenseFor(p.xp);
    const { flown } = flownStats();
    const hours = flown.reduce((s, m) => s + (m.hours || 0), 0);
    const nm = flown.reduce((s, m) => s + (m.dist || 0), 0);
    const career = flown.filter((m) => m.mode === "airline");
    const acIds = new Set(flown.map((m) => m.ac).filter(Boolean));
    const fields = new Set(state.collection.stamps || []);
    const marks = new Set(state.collection.marks || []);
    const lo = lic.xp;
    const hi = lic.next ? lic.next.xp : lo;
    const pct = lic.next ? Math.min(100, Math.round(((p.xp - lo) / Math.max(1, hi - lo)) * 100)) : 100;
    const nextTxt = lic.next
      ? `${p.xp} / ${lic.next.xp} XP → ${lic.next.name}`
      : `${p.xp} XP · GRADE CEILING`;
    const ticks = LICENSES.map((L) => {
      const now = lic.n === L.n;
      const on = lic.n > L.n;
      const label = L.name.replace(" PILOT", "").replace(" RATING", " IFR");
      return `<span class="${now ? "now" : on ? "have" : ""}">${esc(label)}</span>`;
    }).join("");
    const { list } = badges();
    const st = pilotStats();
    st.achAt = st.achAt && typeof st.achAt === "object" ? st.achAt : {};
    let stamped = false;
    const now = Date.now();
    list.forEach((b, i) => {
      if (!b.have || b.hidden || st.achAt[b.id]) return;
      st.achAt[b.id] = now - (list.length - i);
      stamped = true;
    });
    if (stamped) saveProfile();
    const earned = list.filter((b) => b.have && !b.hidden);
    const recent = earned
      .sort((a, b) => (st.achAt[b.id] || 0) - (st.achAt[a.id] || 0));
    const milesOpen = !!state.milesOpen;
    const reviews = Array.isArray(p.reviews) ? p.reviews.slice(0, 3) : [];
    const rep = p.repN ? ((p.repSum || 0) / p.repN).toFixed(2) : "";
    el.innerHTML = `
      <section class="log-card log-career">
        <h2 class="log-rank">${esc(lic.name)}</h2>
        <p class="log-nextxp">${esc(nextTxt)}</p>
        <div class="xp-track wide"><div style="width:${pct}%"></div></div>
        <div class="career-ratings">${ticks}</div>
        ${ifrRideHtml(lic)}
      </section>
      <section class="log-card">
        <h3>CAREER STATISTICS</h3>
        <div class="log-stats">
          <div><b>${flown.length}</b><span>SORTIES</span></div>
          <div><b>${career.length}</b><span>CAREER</span></div>
          <div><b>${hours.toFixed(1)}</b><span>HOURS</span></div>
          <div><b>${fmtNm(nm)}</b><span>DISTANCE</span></div>
          <div><b>${fields.size}</b><span>AIRFIELDS</span></div>
          <div><b>${acIds.size}</b><span>AIRCRAFT</span></div>
          <div><b>${marks.size}</b><span>LANDMARKS</span></div>
        </div>
      </section>
      <section class="log-card log-rep">
        <h3>REPUTATION</h3>
        ${rep ? `<p class="log-rep-score">${rep} ★</p>
          <p class="log-rep-count">${p.repN} customer review${p.repN === 1 ? "" : "s"}</p>
          ${reviews.map((r) => `<div class="log-quote"><p class="review-stars">${starGlyph(r.stars)}</p><p>${esc(r.text || "")}</p></div>`).join("")}`
          : `<p class="log-note">No customer reviews yet.</p>`}
      </section>
      <section class="log-card log-mile-card">
        <button type="button" class="log-miles-toggle" id="log-miles">
          <span>MILESTONES · ${earned.length} COMPLETED</span>
          <span aria-hidden="true">${milesOpen ? "▲" : "▼"}</span>
        </button>
        ${milesOpen ? `<div class="log-miles">${recent.length ? recent.map((b) => `<div class="log-mile"><b><span class="log-tick">✓</span> ${esc(b.label)}</b><span>${esc(b.info)}</span></div>`).join("") : `<p class="log-note">No milestones yet.</p>`}</div>` : ""}
      </section>
    `;
  }

  function renderLog() {
    const { flown } = flownStats();
    const xp = flown.reduce((s, m) => s + (m.xp || 0), 0);
    const rk = rankFor(state.profile.xp || xp);
    const stats = $("#pilot-stats");
    if (stats) stats.innerHTML = "";
    const bar = $("#xp-bar");
    if (bar) {
      const lo = rk.xp;
      const hi = rk.next ? rk.next.xp : lo;
      const pct = rk.next ? Math.min(100, Math.round((((state.profile.xp || xp) - lo) / Math.max(1, hi - lo)) * 100)) : 100;
      bar.style.width = pct + "%";
    }
      renderRank();
    renderCareerFile();
    const root = $("#log");
    if (!root) return;
    if (!state.log.length) {
      root.innerHTML = `<div class="empty tiny">NO SORTIES ON FILE.</div>`;
      return;
    }
    root.innerHTML = state.log
      .map((m) => {
        const mode = modeTag(m);
        const pay = m.mode === "airline"
          ? `${m.xp || xpFor(m)} XP · ${moneyFmt(m.money || 0)}`
          : moneyFmt(m.money || 0);
        const when = fmtDate(m.flownAt || m.acceptedAt);
        const kind = TYPES.find((t) => t.id === m.type)?.label || m.type;
        const grade = m.grade ? `${m.grade}${m.score != null ? " " + m.score : ""}` : "";
        return `
        <article class="sortie">
          <div class="sortie-top">
            <div>
              <b>${esc(icaoOf(m.dep))} → ${esc(icaoOf(m.dest))}</b>
              <span>${esc(fieldCaption(m.dep))} → ${esc(fieldCaption(m.dest))}</span>
            </div>
            <button class="ghost tiny copy-log" data-id="${m.id}">COPY</button>
          </div>
          <p class="sortie-meta">${mode}${when ? " · " + when : ""}${grade ? " · " + grade : ""} · ${kind} · ${fmtNm(m.dist)}</p>
          <p class="sortie-ship">${esc(m.acName || "")}${m.flown ? " · FLOWN" : ""}${pay ? " · " + pay : ""}</p>
        </article>`;
      })
      .join("");
  }

  function pctLabel(n, d) {
    if (!d) return "0 / 0";
    return n + " / " + d;
  }

  function renderBook() {
    const stamps = new Set(state.collection.stamps || []);
    const marks = new Set(state.collection.marks || []);
    const cities = new Set(state.collection.cities || []);
    const ports = new Set(state.collection.ports || []);
    const have = marks.size + cities.size + ports.size;
    const need = LANDMARKS.length + CITIES.length + PORTS.length;
    const overall = $("#book-progress");
    if (overall) overall.textContent = need ? `${Math.round((have / need) * 100)}%` : "0%";
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
    const rotor = isRotor(state.ac);
    const hits = [];
    for (const a of airports) {
      if (!a || !a.id) continue;
      if (!rotor && fieldKind(a) === "helipad") continue;
      if (a.id.startsWith(q) || (a.iata && a.iata.startsWith(q))) hits.push(a);
      if (hits.length >= 12) return hits;
    }
    if (q.length >= 3) {
      for (const a of airports) {
        if (hits.includes(a)) continue;
        if (!rotor && fieldKind(a) === "helipad") continue;
        if ((a.n && a.n.toUpperCase().includes(q)) || (a.c && a.c.toUpperCase().includes(q))) {
          hits.push(a);
        }
        if (hits.length >= 12) break;
      }
    }
    return hits;
  }

  function bind() {
    document.addEventListener("pointerdown", () => ensureAudio(), { once: true });
    document.addEventListener("click", (e) => {
      const hit = e.target && e.target.closest && e.target.closest(
        "button, a, label, select, summary, .post, .job, .icon-pick, .file-btn, input[type=checkbox], input[type=radio], input[type=file], input[type=button]"
      );
      if (hit) sfx("click");
    }, true);
    $("#ac-search")?.addEventListener("input", (e) => {
      state.acQuery = e.target.value;
      renderAircraft();
      renderAcMeta();
    });
    $("#ac-filters")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-filter]");
      if (!btn) return;
      state.acFilter = btn.dataset.filter;
      sfx("click");
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
      fillJobTypes();
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
      fillJobTypes();
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
      const plain = e.target.closest("[data-wx-plain]");
      if (plain) {
        const slot = plain.dataset.wxPlain;
        const box = $(slot === "arr" ? "#wx-arr-body" : "#wx-body");
        const p = box && box.querySelector(".wx-plain");
        if (p) {
          const on = p.hidden;
          p.hidden = !on;
          plain.textContent = on ? "HIDE" : "EXPLAIN THIS";
        }
        return;
      }
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
    $("#dep-random")?.addEventListener("click", () => randomDep());
    $("#dep-paved")?.addEventListener("change", (e) => {
      state.depPaved = !!e.target.checked;
      try { localStorage.setItem("twofly-dep-paved", state.depPaved ? "1" : "0"); } catch (err) {}
      persistStore();
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
      if (state.ac && serviceBlocks(state.ac.id)) {
        setMissions([]);
        renderMissions();
        $("#missions").innerHTML = `<div class="empty">AIRFRAME AT 0% HEALTH. SERVICE IT IN THE HANGAR.</div>`;
        sfx("error");
        return;
      }
      const list = generate();
      list.forEach((m) => { m.mode = state.mode; });
      setMissions(list);
      renderMissions();
      sfx(list.length ? "issue" : "error");
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
      sfx("click");
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
    document.addEventListener("click", (e) => {
      const h = e.target.closest("h3.album-h[data-fold]");
      if (!h || !h.closest("#view-book, #view-help")) return;
      const id = h.dataset.fold;
      h.classList.toggle("folded");
      const body = document.querySelector(`[data-fold-body="${id}"]`);
      if (body) body.classList.toggle("folded");
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
    $("#career-file")?.addEventListener("click", (e) => {
      if (!e.target.closest("#log-miles")) return;
      state.milesOpen = !state.milesOpen;
      renderCareerFile();
    });
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
    $("#welcome-go")?.addEventListener("click", () => { sfx("accept"); dismissWelcome(); });
    $("#debrief-go")?.addEventListener("click", () => {
      sfx("click");
      const go = $("#debrief-go");
      const wantLog = !!(go && /LOGBOOK/.test(go.textContent));
      if (showNextSplash()) return;
      const box = $("#debrief");
      if (box) box.hidden = true;
      if (go) go.textContent = "CONTINUE";
      const kick = box && box.querySelector(".pedia-kicker");
      if (kick) kick.textContent = "SORTIE COMPLETE";
      if (wantLog) {
        const btn = document.querySelector('#tabs button[data-tab="log"]');
        if (btn) btn.click();
      }
    });
    $("#confirm-no").addEventListener("click", () => {
      state.pendingClear = "";
      state.pendingLease = "";
      state.pendingBuyout = "";
      state.pendingAccept = null;
      $("#confirm").hidden = true;
      sfx("click");
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
      } else if (kind === "ifr-accept") {
        const m = state.pendingAccept;
        state.pendingAccept = null;
        if (m) acceptMission({ ...m, ifrAck: true });
      } else if (kind === "ifr-complete") {
        if (state.active) state.active.ifrAck = true;
        completeMission();
      } else if (kind === "ifr-check") {
        startCheckride();
      } else if (kind === "log") {
        state.log = [];
        saveLog();
        renderLog();
      } else if (kind === "all") {
        resetAllProgress();
      } else if (kind === "lease") {
        const id = state.pendingLease;
        state.pendingLease = "";
        const err = leaseAircraft(id);
        const note = $("#hangar-err");
        if (err) {
          sfx("error");
          if (note) { note.hidden = false; note.textContent = err; }
        } else {
          sfx("money");
          if (note) { note.hidden = true; note.textContent = ""; }
          renderHangar();
          renderPilotChip();
          renderAircraft();
          renderAirline();
        }
      } else if (kind === "buyout") {
        const id = state.pendingBuyout;
        state.pendingBuyout = "";
        const err = buyOutLease(id);
        const note = $("#hangar-err");
        if (err) {
          sfx("error");
          if (note) { note.hidden = false; note.textContent = err; }
        } else {
          sfx("money");
          if (note) { note.hidden = true; note.textContent = ""; }
          renderHangar();
          renderPilotChip();
          renderAircraft();
          renderAirline();
        }
      }
    });
    $("#confirm").addEventListener("click", (e) => {
      if (e.target.id === "confirm") {
        state.pendingClear = "";
        state.pendingLease = "";
        state.pendingBuyout = "";
        state.pendingAccept = null;
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
    $("#career-file")?.addEventListener("click", (e) => {
      if (e.target && e.target.id === "ifr-check") {
        openConfirm("ifr-check");
      }
    });
    $("#checkride-no")?.addEventListener("click", () => closeCheckride());
    $("#checkride-body")?.addEventListener("click", (e) => {
      const btn = e.target.closest(".ride-ans");
      if (!btn) return;
      answerCheckride(btn.dataset.i);
    });
    $("#checkride")?.addEventListener("click", (e) => {
      if (e.target.id === "checkride") closeCheckride();
    });
    $("#tabs").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-tab]");
      if (!btn) return;
      sfx("tab");
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
      const helpv = $("#view-help");
      if (hang) hang.hidden = tab !== "hangar";
      if (setv) setv.hidden = tab !== "set";
      if (logv) logv.hidden = tab !== "log";
      if (helpv) helpv.hidden = tab !== "help";
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
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      const confirm = $("#confirm");
      const ride = $("#checkride");
      const debrief = $("#debrief");
      const pedia = $("#pedia");
      const welcome = $("#welcome");
      if (confirm && !confirm.hidden) { $("#confirm-no")?.click(); return; }
      if (ride && !ride.hidden) { closeCheckride(); return; }
      if (pedia && !pedia.hidden) { pedia.hidden = true; return; }
      if (welcome && !welcome.hidden) { dismissWelcome(); return; }
      if (debrief && !debrief.hidden) { $("#debrief-go")?.click(); }
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
      e.target.value = "";
      if (!file) return;
      const paint = (src, w, h) => {
        const SIZE = 320;
        const c = document.createElement("canvas");
        c.width = SIZE;
        c.height = SIZE;
        const ctx = c.getContext("2d");
        ctx.imageSmoothingEnabled = true;
        if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = "high";
        const s = Math.min(w, h) || 1;
        const sx = (w - s) / 2;
        const sy = (h - s) / 2;
        ctx.drawImage(src, sx, sy, s, s, 0, 0, SIZE, SIZE);
        state.profile.icon = "custom";
        state.profile.iconData = c.toDataURL("image/jpeg", 0.92);
        saveProfile();
        renderAirline();
        renderPilotChip();
      };
      if (window.createImageBitmap) {
        createImageBitmap(file, { imageOrientation: "from-image" }).then((bmp) => {
          paint(bmp, bmp.width, bmp.height);
          if (bmp.close) bmp.close();
        }).catch(() => ingestPhotoFallback(file, paint));
      } else {
        ingestPhotoFallback(file, paint);
      }
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
    $("#set-service")?.addEventListener("change", (e) => {
      state.profile.serviceOn = e.target.checked;
      saveProfile();
      renderHangar();
      renderAircraft();
      renderMissions();
      renderActive();
      renderAirline();
    });
    $("#set-interest")?.addEventListener("change", (e) => {
      state.profile.interestOn = e.target.checked;
      state.profile.lastInterestAt = Date.now();
      saveProfile();
      renderHangar();
    });
    $("#set-sound")?.addEventListener("change", (e) => {
      state.profile.soundOn = e.target.checked;
      saveProfile();
      if (e.target.checked) sfx("complete");
    });
    $("#set-simwatch")?.addEventListener("change", (e) => {
      state.profile.simWatch = e.target.checked;
      saveProfile();
      pollSim().then(() => { if (state.active) renderActive(); });
    });
    $("#set-reviews")?.addEventListener("change", (e) => {
      state.profile.reviewsOn = e.target.checked;
      saveProfile();
      renderCareerFile();
    });
    const hudIn = $("#set-hud");
    const setHud = (raw) => {
      const n = clampHud(raw);
      state.profile.hudScale = n;
      if (hudIn) hudIn.value = String(n);
      applyHudScale();
      saveProfile();
    };
    hudIn?.addEventListener("input", (e) => setHud(e.target.value));
    hudIn?.addEventListener("change", (e) => setHud(e.target.value));
    $("#set-clock")?.addEventListener("change", (e) => {
      state.profile.clock12 = e.target.value === "12";
      saveProfile();
      tickClock();
      renderMissions();
      renderActive();
      renderLog();
    });
    $("#set-sim")?.addEventListener("change", (e) => {
      const v = e.target.value;
      state.profile.sim = v === "20" || v === "24" ? v : "both";
      saveProfile();
      if (state.ac && !simOk(state.ac)) state.ac = null;
      renderAircraft();
      renderHangar();
      renderAcMeta();
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
    $("#set-units")?.addEventListener("change", (e) => {
      state.profile.units = e.target.value === "eu" ? "eu" : "us";
      saveProfile();
      renderDep();
      renderAcMeta();
      renderMissions();
      renderActive();
      renderLog();
      renderHangar();
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
    });
    $("#mkt-search")?.addEventListener("input", (e) => {
      state.mktQuery = e.target.value;
      renderHangar();
    });
    $("#view-hangar")?.addEventListener("click", (e) => {
      const fly = e.target.closest("[data-fly]");
      const sell = e.target.closest("[data-sell]");
      const buy = e.target.closest("[data-buy]");
      const lease = e.target.closest("[data-lease]");
      const ret = e.target.closest("[data-return]");
      const buyout = e.target.closest("[data-buyout]");
      const repair = e.target.closest("[data-repair]");
      let err = "";
      let refresh = true;
      if (fly) {
        const ac = AIRCRAFT.find((a) => a.id === fly.dataset.fly);
        if (ac && canSelectAc(ac)) {
          state.ac = ac;
          localStorage.setItem("twofly-ac", ac.id);
          sfx("select");
        }
      } else if (sell) {
        err = sellAircraft(sell.dataset.sell);
        if (!err) {
          sfx("money");
          const row = sell.closest(".fleet-row");
          if (row) row.remove();
        }
      } else if (buy) {
        err = buyAircraft(buy.dataset.buy);
        if (!err) sfx("money");
      } else if (lease) {
        state.pendingLease = lease.dataset.lease;
        openConfirm("lease");
        return;
      } else if (ret) {
        err = returnLease(ret.dataset.return);
        if (!err) {
          sfx("select");
          const row = ret.closest(".fleet-row");
          if (row) row.remove();
        }
      } else if (buyout) {
        state.pendingBuyout = buyout.dataset.buyout;
        openConfirm("buyout");
        return;
      } else if (repair) {
        err = repairAircraft(repair.dataset.repair);
        if (!err) sfx("select");
      } else {
        refresh = false;
      }
      if (!refresh) return;
      if (err) {
        sfx("error");
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
        const lab = $("#fleet-label");
        if (lab && state.profile) lab.textContent = `FLEET ${state.profile.hangar.length}/${hangarCap()}`;
      }
      setTimeout(() => {
        renderHangar();
        renderPilotChip();
        renderAircraft();
        renderAirline();
      }, 0);
    });
  }

  function syncDepPaved() {
    let on = false;
    try { on = localStorage.getItem("twofly-dep-paved") === "1"; } catch (e) {}
    state.depPaved = on;
    const box = $("#dep-paved");
    if (box) box.checked = on;
  }

  function randomDep() {
    const ac = state.ac;
    if (!ac || !airports.length) return;
    const rotor = isRotor(ac);
    const amphib = isAmphib(ac);
    const needPaved = !!(state.depPaved || (ac.paved && ac.cls !== "bush" && !rotor));
    const ok = (a, paved) => {
      if (!a || !a.id) return false;
      const k = fieldKind(a);
      if (k === "helipad" && !rotor) return false;
      if (k === "seaplane" && !amphib) return false;
      if (ac.cls === "airliner" && a.t === "S") return false;
      if (runwayTooShort(a, ac, 1)) return false;
      if (paved && !a.pv) return false;
      return true;
    };
    const sample = (paved) => {
      let count = 0;
      let chosen = null;
      for (const a of airports) {
        if (!ok(a, paved)) continue;
        count++;
        if (Math.random() < 1 / count) chosen = a;
      }
      return chosen;
    };
    const pick = state.depPaved ? sample(true) : (sample(needPaved) || sample(false));
    if (pick) selectDep(pick);
    const box = $("#suggest");
    if (box) box.hidden = true;
  }

  function selectDep(a) {
    if (!a) return;
    if (fieldKind(a) === "helipad" && !isRotor(state.ac)) return;
    state.dep = a;
    localStorage.setItem("twofly-dep", a.id);
    persistStore();
    sfx("select");
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
    if (typeEl) fillJobTypes();
    stampBuild();

    const run = (fn) => { try { fn(); } catch (e) { console.error(e); } };
    run(renderAircraft);
    run(renderAcMeta);
    run(renderDep);
    run(loadWxStore);
    run(() => loadWx(state.dep));
    run(() => {
      if (state.active && state.active.dest) loadWx(state.active.dest, false, "arr");
      else loadWx(null, false, "arr");
    });
    run(() => {
      refreshBriefs(state.missions);
      if (state.active) refreshBriefs([state.active]);
    });
    run(renderMissions);
    run(renderActive);
    run(renderLog);
    run(renderBook);
    run(renderPilotChip);
    run(renderAirline);
    run(renderHangar);
    run(renderSettings);
    run(applyHudScale);
    run(bind);
    run(syncDepPaved);
    run(tickClock);
    run(() => {
      settleDesk();
    });
    run(persistStore);
    run(maybeWelcome);

    window.addEventListener("pagehide", flushStore);
    window.addEventListener("beforeunload", flushStore);

    setInterval(tickClock, 1000);
    setInterval(function () {
      settleDesk();
    }, 60000);
    setInterval(function () {
      fetch("/__twofly/ping", { cache: "no-store" }).catch(function () {});
    }, 2000);
    fetch("/__twofly/ping", { cache: "no-store" }).catch(function () {});
  }

  const STORE_KEYS = [
    "twofly-pilot-file", "twofly-log", "twofly-pedia", "twofly-active",
    "twofly-active-free", "twofly-active-airline", "twofly-collection",
    "twofly-owned", "twofly-ac", "twofly-dep", "twofly-dep-paved", "twofly-pilot",
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
    syncDepPaved();
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
      try { reloadFromStorage(); syncDepPaved(); } catch (e) {}
      try { renderPilotChip(); renderLog(); renderBook(); renderHangar(); renderAirline(); renderAircraft(); renderDep(); } catch (e) {}
    });
  }

  boot();
})();
