const { config, cookies, setCookies, clearCookies, sameOrigin, authFetch, sanitizedUser, getSession, ACCESS_COOKIE } = require("../server/supabaseAuth");
function reply(res, status, body) { res.status(status).json(body); }
function providerError(status) {
  if (status === 429) return "Te veel pogingen. Probeer het straks opnieuw.";
  if (status === 400 || status === 401) return "Controleer je e-mailadres en wachtwoord.";
  if (status === 422) return "Dit e-mailadres is al geregistreerd of de invoer is ongeldig.";
  return "Inloggen is tijdelijk niet gelukt. Probeer het later opnieuw.";
}
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!["GET", "POST"].includes(req.method)) { res.setHeader("Allow", "GET, POST"); return reply(res, 405, { error: "Method not allowed" }); }
  if (req.method === "POST" && !sameOrigin(req)) return reply(res, 403, { error: "Ongeldige herkomst." });
  try {
    const action = req.method === "GET" ? "session" : String((req.body || {}).action || "");
    if (action === "session" && req.method === "GET") {
      const session = await getSession(req, res);
      return reply(res, 200, { user: session ? session.user : null });
    }
    if (action === "logout") {
      const jar = cookies(req), access = jar[ACCESS_COOKIE];
      if (access) await authFetch("logout", { method: "POST", headers: { apikey: config().key, Authorization: "Bearer " + access } }).catch(() => {});
      clearCookies(res);
      return reply(res, 200, { ok: true });
    }
    const body = req.body || {};
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) return reply(res, 400, { error: "Vul een geldig e-mailadres en een wachtwoord van minimaal 8 tekens in." });
    let response;
    if (action === "signup") {
      const name = String(body.name || "").trim().slice(0, 80);
      response = await authFetch("signup", { method: "POST", body: JSON.stringify({ email, password, data: { display_name: name } }) });
      if (!response.ok) return reply(res, response.status === 429 ? 429 : 400, { error: providerError(response.status) });
      const result = await response.json();
      if (!result.access_token || !result.refresh_token) return reply(res, 200, { ok: true, confirmationRequired: true });
      setCookies(res, result.access_token, result.refresh_token, result.expires_in);
      return reply(res, 201, { ok: true, user: sanitizedUser(result.user) });
    }
    if (action === "login") {
      response = await authFetch("token?grant_type=password", { method: "POST", body: JSON.stringify({ email, password }) });
      if (!response.ok) return reply(res, response.status === 429 ? 429 : 401, { error: providerError(response.status) });
      const result = await response.json();
      setCookies(res, result.access_token, result.refresh_token, result.expires_in);
      return reply(res, 200, { ok: true, user: sanitizedUser(result.user) });
    }
    return reply(res, 400, { error: "Onbekende actie." });
  } catch (error) {
    const message = error && error.message === "Supabase is not configured"
      ? "Centrale opslag is nog niet ingesteld. Je kunt intussen lokaal oefenen."
      : "De accountdienst is tijdelijk niet bereikbaar.";
    return reply(res, 503, { error: message });
  }
};
