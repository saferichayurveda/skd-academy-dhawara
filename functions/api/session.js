import { createSession, isAuthenticated, json, originIsSame, safePasswordMatch, sessionCookie, COOKIE_NAME } from "../_lib/auth.js";

export async function onRequest({ request, env }) {
  if (request.method === "GET") {
    return json({ authenticated: await isAuthenticated(request, env) });
  }

  if (request.method === "DELETE") {
    if (!originIsSame(request)) return json({ error: "अनुरोध अस्वीकार किया गया।" }, 403);
    return json({ ok: true }, 200, { "Set-Cookie": sessionCookie("", 0) });
  }

  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, { Allow: "GET, POST, DELETE" });
  if (!originIsSame(request)) return json({ error: "अनुरोध अस्वीकार किया गया।" }, 403);
  const missingSecrets = [];
  if (!env.ADMIN_PASSWORD) missingSecrets.push("ADMIN_PASSWORD");
  if (!env.SESSION_SECRET) missingSecrets.push("SESSION_SECRET");
  if (missingSecrets.length) {
    return json({
      error: "Cloudflare Production environment में ये Secret उपलब्ध नहीं हैं: " + missingSecrets.join(", ") + ". Settings → Variables and secrets में इन्हें Production के लिए सेट करके नया deployment करें।"
    }, 503);
  }

  let body;
  try { body = await request.json(); } catch { return json({ error: "सही अनुरोध भेजें।" }, 400); }
  const password = typeof body.password === "string" ? body.password : "";
  if (!password || !safePasswordMatch(password, env.ADMIN_PASSWORD)) {
    return json({ error: "पासवर्ड सही नहीं है।" }, 401);
  }

  const token = await createSession(env.SESSION_SECRET);
  return json({ ok: true }, 200, { "Set-Cookie": sessionCookie(token) });
}