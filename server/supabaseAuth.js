const ACCESS_COOKIE = "polyvo_access";
const REFRESH_COOKIE = "polyvo_refresh";
function config() {
  const url = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase is not configured");
  return { url, key };
}
function cookies(req) {
  return Object.fromEntries(String(req.headers.cookie || "").split(";").map(part => {
    const i = part.indexOf("=");
    if (i < 0) return ["", ""];
    let value = part.slice(i + 1).trim();
    try { value = decodeURIComponent(value); } catch (_) {}
    return [part.slice(0, i).trim(), value];
  }).filter(([k]) => k));
}
function setCookies(res, access, refresh, expiresIn) {
  const secure = process.env.NODE_ENV === "production" || (String(res.req && res.req.headers["x-forwarded-proto"] || "").split(",")[0] === "https");
  const common = "; Path=/; HttpOnly; SameSite=Lax" + (secure ? "; Secure" : "");
  const headers = [
    ACCESS_COOKIE + "=" + encodeURIComponent(access) + common + "; Max-Age=" + Math.max(60, Number(expiresIn || 3600)),
    REFRESH_COOKIE + "=" + encodeURIComponent(refresh) + common + "; Max-Age=2592000"
  ];
  res.setHeader("Set-Cookie", headers);
}
function clearCookies(res) {
  const common = "; Path=/; HttpOnly; SameSite=Lax" + (process.env.NODE_ENV === "production" ? "; Secure" : "");
  res.setHeader("Set-Cookie", [ACCESS_COOKIE + "=; Max-Age=0" + common, REFRESH_COOKIE + "=; Max-Age=0" + common]);
}
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.host; } catch (_) { return false; }
}
async function authFetch(path, options) {
  const c = config();
  return fetch(c.url + "/auth/v1/" + path, Object.assign({
    headers: { apikey: c.key, "Content-Type": "application/json" }
  }, options || {}));
}
function sanitizedUser(user) {
  if (!user || !user.id) return null;
  return { id: user.id, email: user.email || "", name: (user.user_metadata && (user.user_metadata.display_name || user.user_metadata.name)) || "" };
}
async function getSession(req, res) {
  const jar = cookies(req);
  if (!jar[ACCESS_COOKIE] && !jar[REFRESH_COOKIE]) return null;
  let access = jar[ACCESS_COOKIE], refresh = jar[REFRESH_COOKIE], expiresIn = 3600;
  let response = access ? await authFetch("user", { headers: { apikey: config().key, Authorization: "Bearer " + access } }) : null;
  if (!response || response.status === 401) {
    if (!refresh) return null;
    const renewed = await authFetch("token?grant_type=refresh_token", { method: "POST", body: JSON.stringify({ refresh_token: refresh }) });
    if (!renewed.ok) { clearCookies(res); return null; }
    const session = await renewed.json();
    access = session.access_token; refresh = session.refresh_token; expiresIn = session.expires_in;
    setCookies(res, access, refresh, expiresIn);
    response = await authFetch("user", { headers: { apikey: config().key, Authorization: "Bearer " + access } });
  }
  if (!response || !response.ok) return null;
  return { user: sanitizedUser(await response.json()), accessToken: access, refreshToken: refresh };
}
module.exports = { ACCESS_COOKIE, REFRESH_COOKIE, config, cookies, setCookies, clearCookies, sameOrigin, authFetch, sanitizedUser, getSession };
