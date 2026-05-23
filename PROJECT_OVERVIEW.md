# Chef Bev Website Overview

## Use Case

Chef Bev Luxury Cakes is a small-business website for showcasing custom cake designs and capturing customer order requests.

The website helps customers:

- Browse cake design examples in the public gallery.
- Start an order from a gallery style.
- Submit cake order details such as occasion, date, size, flavour, style, budget, notes, and contact details.
- Continue the conversation on WhatsApp after submitting an order.
- Send general contact inquiries.

The website helps the business owner:

- Receive structured order information in Firestore.
- Receive order and contact notifications by email.
- Receive customer details through WhatsApp as an additional reliability channel.
- Keep gallery images simple and low-cost by storing them in the codebase instead of using paid file uploads.
- Protect owner-only pages behind a password login.

The order workflow is designed so the order is saved first, then notifications are sent. This means the order record still exists even if an email provider delays or filters a message.

## Core User Flows

### Customer Order Flow

1. Customer opens `/orders` or clicks **Order this style** from the gallery.
2. Customer submits the order form.
3. The server validates and saves the order to Firestore.
4. The server sends an email notification with retry handling.
5. The customer sees an order confirmation page.
6. WhatsApp opens with the order summary and reference number.

### Contact Flow

1. Customer opens `/contact`.
2. Customer submits a contact message.
3. The server validates and saves the inquiry to Firestore.
4. The server sends an email notification with retry handling.
5. The customer is redirected to WhatsApp with the inquiry summary.

### Gallery Flow

Gallery images are managed in code:

1. Add optimized image files to `public/img/gallery`.
2. Add metadata entries in `utils/galleryStore.js`.
3. Commit and deploy.

This avoids Firebase Storage costs and keeps the gallery predictable.

## Tech Stack

### Runtime and Backend

- **Node.js**: JavaScript runtime for the server.
- **Express 5**: Web server and route handling.
- **EJS**: Server-rendered HTML templates.
- **express-ejs-layouts**: Shared page layout support.

### Frontend

- **HTML/CSS/JavaScript**: Traditional server-rendered website.
- **CSS in `public/css/styles.css`**: Custom responsive styling.
- **Client JavaScript in `public/js`**: Gallery interactions and WhatsApp handoff behavior.

### Data Storage

- **Firebase Admin SDK**: Server-side access to Firebase.
- **Cloud Firestore**: Stores orders and contact inquiries.
- **Code-managed gallery images**: Gallery files live in `public/img/gallery`; Firebase Storage is not required.

### Notifications

- **Nodemailer**: Sends order and contact emails through the configured SMTP provider.
- **WhatsApp deep links**: Opens a WhatsApp conversation with the customer/order summary.
- **Notification audit fields**: Firestore documents store email notification status, attempts, message ID, and errors.

### Security

- **Helmet**: HTTP security headers.
- **CSRF tokens**: Protects form submissions.
- **Trusted-origin checks**: Blocks unexpected cross-site unsafe requests where possible.
- **Honeypot field**: Basic bot/spam trap.
- **Input validation**: Sanitizes and validates order/contact fields before saving.
- **Owner authentication**: Password-protected owner area using signed HTTP-only cookies.
- **Rate limiting**: Uses Upstash Redis when configured, with in-memory fallback for local development.

### Deployment

- **Vercel**: Hosts the Express app as a serverless Node function.
- **GitHub**: Source control and deployment integration.
- **Environment variables**: Secrets are configured in Vercel and are not committed to Git.

## Important Environment Variables

The production app expects secrets and service credentials to be configured in Vercel, not committed to the repository.

Key variables include:

- `PUBLIC_URL`
- `BEV_WHATSAPP`
- `OWNER_PASSWORD`
- `OWNER_SESSION_SECRET`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `EMAIL_HOST`
- `EMAIL_PORT`
- `EMAIL_USER`
- `EMAIL_PASS`
- `BEV_ORDER_TO`
- `INSTAGRAM_URL`
- `TIKTOK_URL`

See `DEPLOYMENT.md` for deployment and verification steps.
