import { isAuthenticated, json, originIsSame } from "../_lib/auth.js";

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/avif",
  "video/mp4", "video/webm", "video/quicktime"
]);

export async function onRequest({ request, env }) {
  if (!env.MEDIA_BUCKET) return json({ error: "Media storage अभी configure नहीं हुआ है।" }, 503);

  if (request.method === "GET") {
    const result = await env.MEDIA_BUCKET.list({ prefix: "uploads/", limit: 500 });
    const items = result.objects
      .filter((object) => object.key && object.key.startsWith("uploads/"))
      .map((object) => ({
        key: object.key.slice("uploads/".length),
        title: object.customMetadata?.title || "",
        type: object.httpMetadata?.contentType || "application/octet-stream",
        size: object.size,
        uploadedAt: object.uploaded
      }))
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
    return json({ items });
  }

  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, { Allow: "GET, POST" });
  if (!originIsSame(request)) return json({ error: "अनुरोध अस्वीकार किया गया।" }, 403);
  if (!(await isAuthenticated(request, env))) return json({ error: "कृपया Admin Login करें।" }, 401);

  let form;
  try { form = await request.formData(); } catch { return json({ error: "फाइल पढ़ी नहीं जा सकी।" }, 400); }
  const file = form.get("file");
  const title = String(form.get("title") || "").trim().slice(0, 120);
  if (!file || typeof file.arrayBuffer !== "function") return json({ error: "पहले फोटो या वीडियो चुनें।" }, 400);
  if (file.size < 1 || file.size > MAX_FILE_BYTES) return json({ error: "फाइल 1 byte से बड़ी और अधिकतम 50 MB की होनी चाहिए।" }, 413);
  if (!ALLOWED_TYPES.has(file.type)) return json({ error: "यह फाइल प्रकार स्वीकार नहीं है। JPG, PNG, WEBP, GIF, AVIF, MP4, WEBM या MOV चुनें।" }, 415);

  const extByType = {
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif",
    "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov"
  };
  const key = crypto.randomUUID() + "." + extByType[file.type];
  await env.MEDIA_BUCKET.put("uploads/" + key, file.stream(), {
    httpMetadata: { contentType: file.type, cacheControl: "public, max-age=3600" },
    customMetadata: { title, originalName: String(file.name || "upload").slice(0, 180) }
  });
  return json({ ok: true, item: { key, title, type: file.type, size: file.size, uploadedAt: new Date().toISOString() } }, 201);
}