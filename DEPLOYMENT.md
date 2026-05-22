# Deployment

## Vercel

This app is configured for Vercel with `vercel.json`. Vercel should install dependencies with `npm install` and serve `server.js` through `@vercel/node`.

## Required Environment Variables

Add these in the Vercel project settings for Production, Preview, and Development as needed:

```txt
PUBLIC_URL=https://your-production-domain
BEV_WHATSAPP=27000000000

OWNER_PASSWORD=replace-with-a-strong-owner-password
OWNER_SESSION_SECRET=replace-with-at-least-32-random-characters

FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_STORAGE_BUCKET=

EMAIL_HOST=
EMAIL_PORT=587
EMAIL_USER=
EMAIL_PASS=
BEV_ORDER_TO=

INSTAGRAM_URL=
TIKTOK_URL=
```

`PUBLIC_URL` must match the deployed site origin, for example `https://chefbev-website.vercel.app` or the custom domain. This is used by the trusted-origin protection for form submissions.

Keep `.env` and Firebase service-account JSON files out of Git.

## After Deploying

1. Open `/health` and confirm it returns `{"status":"OK"}`.
2. Open `/orders`, submit a test order, and confirm Firebase stores it.
3. Confirm the order email arrives.
4. Confirm the success page opens WhatsApp with the order reference.
5. Open `/owner/login`, sign in, upload a gallery photo under 4 MB, and confirm it appears on `/gallery`.

Gallery uploads go through a Vercel Function, so keep owner-uploaded images under 4 MB. Larger uploads should be resized or compressed before upload.
