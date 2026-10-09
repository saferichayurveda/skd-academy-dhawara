# School media gallery setup

The static site uses Cloudflare Pages Functions for the authenticated media API and Cloudflare R2 for storage. Do not put passwords or secrets in GitHub.

## One-time Cloudflare setup

1. In Cloudflare Dashboard, open **R2 Object Storage** and create a private bucket named `skd-academy-media`.
2. Open **Workers & Pages → skd-academy-dhawara → Settings → Bindings** (the exact menu label can vary).
3. Add an **R2 bucket binding** with variable name exactly `MEDIA_BUCKET`, selecting `skd-academy-media`. Apply it to the **Production** environment.
4. Open the Pages project **Settings → Variables and Secrets**. Add these Production secrets:
   - `ADMIN_PASSWORD`: choose a unique password of at least 16 characters. Do not send it in chat or put it in source code.
   - `SESSION_SECRET`: a different random secret of at least 32 characters. Generate it with a trusted password manager.
5. Save the settings and trigger a new production deployment (or push a small commit) so Pages Functions receive the binding and secrets.

## Use

- Public gallery: the homepage section **फोटो एवं वीडियो गैलरी**.
- Private management page: `/admin.html`.
- Open `/admin.html`, sign in with the value stored as `ADMIN_PASSWORD`, and select photos/videos from the phone gallery.
- Supported formats: JPG, PNG, WEBP, GIF, AVIF, MP4, WEBM and MOV. Each file is limited to 50 MB.
- Admin session expires after 8 hours. The cookie is HttpOnly, Secure and SameSite=Strict.
- Only the upload and delete endpoints require the signed admin session. Viewing published gallery media is public by design.

## Important

Keep the R2 bucket private. Do not create a public R2 bucket; media is served through the Pages Function. If possible, add Cloudflare rate limiting for `/api/session` to further protect the login endpoint.