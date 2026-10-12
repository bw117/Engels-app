const { config, sameOrigin, getSession } = require("../server/supabaseAuth");
const ALLOWED_TYPES = new Set(["migration", "answer", "session", "profile"]);
const MAX_BATCH = 50;
const MAX_EVENT_BYTES = 75000;
function reply(res, status, body) { res.status(status).json(body); }
function validEvent(event) {
  if (!event || typeof event !== "object") return false;
  const id = String(event.eventId || "");
  if (!/^[A-Za-z0-9:_-]{1,128}$/.test(id) || !ALLOWED_TYPES.has(event.type)) return false;
  if (!event.payload || typeof event.payload !== "object" || Array.isArray(event.payload)) return false;
  if (!Number.isFinite(Date.parse(event.createdAt))) return false;
  return Buffer.byteLength(JSON.stringify(event)) <= MAX_EVENT_BYTES;
}
function rowsForUser(events, userId) {
  return events.map(event => ({
    user_id: userId,
    event_id: event.eventId,
    event_type: event.type,
    payload: Object.assign({}, event.payload, { createdAt: event.createdAt })
  }));
}
async function dbRequest(url, key, accessToken, options) {
  return fetch(url, Object.assign({
    headers: { apikey: key, Authorization: "Bearer " + accessToken, "Content-Type": "application/json" }
  }, options || {}));
}
async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!["GET", "POST"].includes(req.method)) { res.setHeader("Allow", "GET, POST"); return reply(res, 405, { error: "Method not allowed" }); }
  if (req.method === "POST" && !sameOrigin(req)) return reply(res, 403, { error: "Ongeldige herkomst." });
  try {
    const session = await getSession(req, res);
    if (!session || !session.user) return reply(res, 401, { error: "Log in om voortgang te synchroniseren." });
    const { url, key } = config();
    if (req.method === "GET") {
      const offset = Math.max(0, Math.min(1000000, Number(req.query && req.query.offset) || 0));
      const end = offset + 499;
      const response = await dbRequest(url + "/rest/v1/progress_events?select=event_id,event_type,payload,created_at&order=created_at.asc,event_id.asc", key, session.accessToken, {
        headers: { apikey: key, Authorization: "Bearer " + session.accessToken, Range: offset + "-" + end }
      });
      if (!response.ok) return reply(res, 502, { error: "Voortgang ophalen is niet gelukt." });
      const rows = await response.json();
      return reply(res, 200, {
        events: rows.map(row => ({ eventId: row.event_id, type: row.event_type, payload: row.payload, createdAt: row.payload.createdAt || row.created_at })),
        nextOffset: rows.length === 500 ? end + 1 : null
      });
    }
    const events = req.body && req.body.events;
    if (!Array.isArray(events) || !events.length || events.length > MAX_BATCH || !events.every(validEvent)) return reply(res, 400, { error: "Ongeldige synchronisatiegegevens." });
    const rows = rowsForUser(events, session.user.id);
    const response = await dbRequest(url + "/rest/v1/progress_events?on_conflict=user_id,event_id", key, session.accessToken, {
      method: "POST",
      headers: { apikey: key, Authorization: "Bearer " + session.accessToken, "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify(rows)
    });
    if (!response.ok) return reply(res, 502, { error: "Voortgang opslaan is niet gelukt." });
    return reply(res, 200, { accepted: events.map(event => event.eventId) });
  } catch (error) {
    const message = error && error.message === "Supabase is not configured" ? "Centrale opslag is nog niet ingesteld." : "De accountdienst is tijdelijk niet bereikbaar.";
    return reply(res, 503, { error: message });
  }
}
module.exports = handler;
module.exports.validEvent = validEvent;
module.exports.rowsForUser = rowsForUser;
