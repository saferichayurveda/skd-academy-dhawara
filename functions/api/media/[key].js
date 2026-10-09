import { isAuthenticated, json, originIsSame } from "../../_lib/auth.js";

export async function onRequest({ request, env, params }) {
  if (!env.MEDIA_BUCKET) return json({ error: "Media storage अभी configure नहीं हुआ है।" }, 503);
  const key = String(params.key || "");
  if (!/^[0-9a-f-]{36}\.(jpg|png|webp|gif|avif|mp4|webm|mov)$/i.test(key)) return json({ error: "फाइल नहीं मिली।" }, 404);
  const storageKey = "uploads/" + key;

  if (request.method === "DELETE") {
    if (!originIsSame(request)) return json({ error: "अनुरोध अस्वीकार किया गया।" }, 403);
    if (!(await isAuthenticated(request, env))) return json({ error: "कृपया Admin Login करें।" }, 401);
    await env.MEDIA_BUCKET.delete(storageKey);
    return json({ ok: true });
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return json({ error: "Method not allowed" }, 405, { Allow: "GET, HEAD, DELETE" });
  }

  const head = await env.MEDIA_BUCKET.head(storageKey);
  if (!head) return json({ error: "फाइल नहीं मिली।" }, 404);

  const headers = new Headers();
  head.writeHttpMetadata(headers);
  headers.set("Cache-Control", "public, max-age=3600");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Disposition", "inline");
  headers.set("ETag", head.httpEtag);

  if (request.method === "HEAD") return new Response(null, { headers });

  const rangeHeader = request.headers.get("Range");
  if (rangeHeader) {
    const match = rangeHeader.match(/^bytes=(\d*)-(\d*)$/);
    if (!match) return new Response(null, { status: 416, headers: { "Content-Range": "bytes */" + head.size } });
    let start = match[1] ? Number(match[1]) : Math.max(0, head.size - Number(match[2] || 0));
    let end = match[2] && match[1] ? Number(match[2]) : head.size - 1;
    if (start < 0 || start >= head.size || end < start) {
      return new Response(null, { status: 416, headers: { "Content-Range": "bytes */" + head.size } });
    }
    end = Math.min(end, head.size - 1);
    const length = end - start + 1;
    const object = await env.MEDIA_BUCKET.get(storageKey, { range: { offset: start, length } });
    headers.set("Content-Range", "bytes " + start + "-" + end + "/" + head.size);
    headers.set("Content-Length", String(length));
    return new Response(object.body, { status: 206, headers });
  }

  const object = await env.MEDIA_BUCKET.get(storageKey);
  headers.set("Content-Length", String(head.size));
  return new Response(object.body, { headers });
}