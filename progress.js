/* Shared progress-event helpers for browser and Node tests. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PolyvoProgress = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const VERSION = 3;
  const ALPHA = 0.35;
  const validItemId = id => /^[A-Za-z0-9._-]{1,128}$/.test(String(id));
  function safeProfile(profile) {
    const p = profile && typeof profile === "object" ? profile : {};
    return { name: String(p.name || "").slice(0, 80), placementScore: p.placementScore === null || p.placementScore === undefined || p.placementScore === "" ? null : (Number.isFinite(Number(p.placementScore)) ? Math.max(0, Math.min(1, Number(p.placementScore))) : null), placementAt: typeof p.placementAt === "string" ? p.placementAt : null, createdAt: typeof p.createdAt === "string" ? p.createdAt : null };
  }
  function mergeProfile(current, incoming) {
    const merged = safeProfile(current), source = incoming && typeof incoming === "object" ? incoming : {};
    for (const key of ["name", "placementScore", "placementAt", "createdAt"]) if (Object.prototype.hasOwnProperty.call(source, key)) merged[key] = source[key];
    return safeProfile(merged);
  }
  function emptyDb() {
    return { version: VERSION, profile: { name: "", placementScore: null, placementAt: null }, states: {}, sessions: [], events: [], pendingEvents: [] };
  }
  function makeId(prefix) {
    let id;
    try { id = crypto.randomUUID(); }
    catch (_) { id = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2); }
    return (prefix ? prefix + ":" : "") + id;
  }
  function cleanLegacy(db) {
    const source = db && typeof db === "object" ? db : {};
    return {
      version: Number(source.version || 1),
      profile: Object.assign({ name: "", placementScore: null, placementAt: null }, source.profile || {}),
      states: source.states && typeof source.states === "object" ? source.states : {},
      sessions: Array.isArray(source.sessions) ? source.sessions : []
    };
  }
  function normalizeEvent(e) {
    if (!e || typeof e !== "object") return null;
    const eventId = String(e.eventId || e.event_id || "");
    const type = String(e.type || e.event_type || "");
    const createdAt = e.createdAt || e.created_at || (e.payload && e.payload.createdAt);
    if (!eventId || !["migration", "answer", "session", "profile"].includes(type) || !createdAt || !e.payload || typeof e.payload !== "object") return null;
    return { eventId, type, createdAt: new Date(createdAt).toISOString(), payload: e.payload };
  }
  function mergeEvents(remote, local) {
    const map = new Map();
    (Array.isArray(remote) ? remote : []).forEach(e => { const n = normalizeEvent(e); if (n) map.set(n.eventId, n); });
    (Array.isArray(local) ? local : []).forEach(e => { const n = normalizeEvent(e); if (n && !map.has(n.eventId)) map.set(n.eventId, n); });
    return [...map.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.eventId.localeCompare(b.eventId));
  }
  function migrationEvents(legacy, clientId, createdAt, maxBytes) {
    const db = cleanLegacy(legacy), limit = maxBytes || 30000, stamp = createdAt || new Date().toISOString();
    const chunks = [];
    let current = { sourceVersion: db.version, profile: null, states: {}, sessions: [] };
    const flush = () => {
      if (current.profile || Object.keys(current.states).length || current.sessions.length) chunks.push(current);
      current = { sourceVersion: db.version, profile: null, states: {}, sessions: [] };
    };
    current.profile = db.profile;
    for (const [id, value] of Object.entries(db.states)) {
      current.states[id] = value;
      if (JSON.stringify(current).length > limit && Object.keys(current.states).length > 1) {
        delete current.states[id]; flush(); current.states[id] = value;
      }
    }
    for (const session of db.sessions) {
      current.sessions.push(session);
      if (JSON.stringify(current).length > limit && current.sessions.length > 1) {
        current.sessions.pop(); flush(); current.sessions.push(session);
      }
    }
    flush();
    return chunks.map((payload, index) => ({
      eventId: "migration:" + String(clientId || "unknown") + ":" + index,
      type: "migration",
      createdAt: stamp,
      payload
    }));
  }
  function migrationEvent(legacy, clientId, createdAt) {
    return migrationEvents(legacy, clientId, createdAt, Number.MAX_SAFE_INTEGER)[0] || {
      eventId: "migration:" + String(clientId || "unknown") + ":0",
      type: "migration", createdAt: createdAt || new Date().toISOString(),
      payload: { sourceVersion: 1, profile: { name: "", placementScore: null, placementAt: null }, states: {}, sessions: [] }
    };
  }
  function updateItemState(old, correct, at) {
    const s = Object.assign({ attempts: 0, correct: 0, mastery: 0, streak: 0, intervalDays: 0 }, old || {});
    s.attempts = Number(s.attempts || 0) + 1;
    s.correct = Number(s.correct || 0) + (correct ? 1 : 0);
    s.mastery = Math.max(0, Math.min(1, Number(s.mastery || 0) + ALPHA * ((correct ? 1 : 0) - Number(s.mastery || 0))));
    s.streak = correct ? Number(s.streak || 0) + 1 : 0;
    s.intervalDays = correct ? (Number(s.intervalDays || 0) ? Math.min(45, Number(s.intervalDays) * 2) : 1) : 0;
    const next = new Date(at);
    if (correct) next.setDate(next.getDate() + s.intervalDays);
    else next.setHours(next.getHours() + 8);
    s.lastSeenAt = new Date(at).toISOString();
    s.lastResult = !!correct;
    s.nextReviewAt = next.toISOString();
    return s;
  }
  function rebuild(events) {
    const all = mergeEvents([], events);
    const db = emptyDb();
    const migrations = all.filter(e => e.type === "migration");
    for (const e of migrations) {
      const p = e.payload;
      if (p.profile) db.profile = mergeProfile(db.profile, p.profile);
      for (const [id, candidate] of Object.entries(p.states || {})) {
        if (!validItemId(id) || !candidate || typeof candidate !== "object") continue;
        const current = db.states[id];
        if (!current || String(candidate.lastSeenAt || "") >= String(current.lastSeenAt || "")) Object.defineProperty(db.states, id, { value: Object.assign({}, candidate), writable: true, enumerable: true, configurable: true });
      }
      for (const session of (p.sessions || [])) db.sessions.push(session);
    }
    const sessionKeys = new Set();
    db.sessions = db.sessions.filter(s => {
      const key = [s.date, s.at, s.total, s.correct, s.minutes].join("|");
      if (sessionKeys.has(key)) return false;
      sessionKeys.add(key); return true;
    });
    for (const e of all) {
      const p = e.payload;
      if (e.type === "answer" && validItemId(p.itemId)) Object.defineProperty(db.states, p.itemId, { value: updateItemState(db.states[p.itemId], !!p.correct, e.createdAt), writable: true, enumerable: true, configurable: true });
      else if (e.type === "session" && p.session) {
        const s = p.session, key = [s.date, s.at, s.total, s.correct, s.minutes].join("|");
        if (!sessionKeys.has(key)) { db.sessions.push(s); sessionKeys.add(key); }
      } else if (e.type === "profile" && p.profile) db.profile = mergeProfile(db.profile, p.profile);
    }
    db.sessions.sort((a, b) => String(a.at || a.date || "").localeCompare(String(b.at || b.date || "")));
    db.events = all;
    return db;
  }
  function normalizeDb(raw, clientId) {
    let source = raw && typeof raw === "object" ? raw : emptyDb();
    let events = Array.isArray(source.events) ? source.events : [];
    let pending = Array.isArray(source.pendingEvents) ? source.pendingEvents : [];
    if (Number(source.version || 1) < VERSION) {
      const hasLegacyData = Object.keys(source.states || {}).length || (source.sessions || []).length || (source.profile && (source.profile.name || source.profile.placementScore !== null));
      if (hasLegacyData) {
        const imports = migrationEvents(source, clientId);
        const known = new Set(events.map(e => e.eventId));
        const missing = imports.filter(event => !known.has(event.eventId));
        events = events.concat(missing); pending = pending.concat(missing);
      }
    }
    const rebuilt = rebuild(events);
    if (!events.length) {
      const clean = cleanLegacy(source);
      rebuilt.profile = clean.profile; rebuilt.states = clean.states; rebuilt.sessions = clean.sessions;
    }
    rebuilt.pendingEvents = mergeEvents([], pending);
    return rebuilt;
  }
  function addEvent(db, type, payload, eventId, createdAt) {
    const e = normalizeEvent({ eventId: eventId || makeId(type), type, createdAt: createdAt || new Date().toISOString(), payload });
    const events = mergeEvents(db.events, [e]);
    const next = rebuild(events);
    next.pendingEvents = mergeEvents(db.pendingEvents, [e]);
    return next;
  }
  return { VERSION, emptyDb, makeId, normalizeEvent, mergeEvents, migrationEvent, migrationEvents, rebuild, normalizeDb, addEvent };
});
