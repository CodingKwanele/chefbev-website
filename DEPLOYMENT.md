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

Gallery images are stored in the codebase under `public/img/gallery` and listed in `utils/galleryStore.js`. Firebase Storage is not required for gallery photos.

## After Deploying

1. Open `/health` and confirm it returns `{"status":"OK"}`.
2. Open `/orders`, submit a test order, and confirm Firebase stores it.
3. Confirm the order email arrives.
4. Confirm the success page opens WhatsApp with the order reference.
5. Open `/gallery` and confirm the code-managed gallery images load.

## Notification Reliability

Order and contact emails are retried up to three times before being marked failed. Each Firestore `orders` or `contacts` document gets an `emailNotification` object with `status`, `messageId`, `attempts`, and any failure `error`.

WhatsApp messages include the customer details and request summary, so Bev still receives actionable information even if an email provider delays or filters a message.
