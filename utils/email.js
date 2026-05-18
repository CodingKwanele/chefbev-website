import nodemailer from "nodemailer";

/**
 * Sends a new order email to Bev.
 * - Uses Gmail SMTP (supports 465 SSL or 587 STARTTLS)
 * - Verifies SMTP connection before sending (helps debugging)
 */
export async function sendOrderEmail({ order, form }) {
  const host = process.env.EMAIL_HOST;
  const port = Number(process.env.EMAIL_PORT || 465);
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  const to = process.env.BEV_ORDER_TO;

  if (!host || !user || !pass || !to) {
    throw new Error(
      "Email missing config: EMAIL_HOST/EMAIL_USER/EMAIL_PASS/BEV_ORDER_TO"
    );
  }

  const is465 = port === 465;

    console.log("EMAIL_USER:", user);
    console.log("EMAIL_PASS length:", (pass || "").replace(/\s/g, "").length);
    console.log("EMAIL_PASS has spaces:", /\s/.test(pass || ""));
    console.log("EMAIL_PORT:", port);


  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: is465, // 465 = SSL, 587 = STARTTLS
    auth: { user, pass },

    // Hardening (helps ECONNRESET / TLS negotiation issues)
    requireTLS: !is465, // for 587
    tls: {
      servername: host,
      minVersion: "TLSv1.2",
    },
  });

  // Verify SMTP connection (TEMPORARY - keep while testing)
  await transporter.verify();
  console.log("✓ SMTP verified");

  const formattedDate = new Date(order.eventDate).toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const subject = `New Cake Order — ${order.occasion} (${order._id})`;

  const text = [
    "New order received ✅",
    "",
    `Order Reference: ${order._id}`,
    "",
    "Customer Details",
    `Name: ${order.customerName}`,
    `Phone: ${order.phone}`,
    order.email ? `Email: ${order.email}` : null,
    "",
    "Order Details",
    `Occasion: ${order.occasion}`,
    `Date: ${formattedDate}`,
    `Size: ${order.size}`,
    `Flavour: ${order.flavour}`,
    order.budget ? `Budget: R${order.budget}` : null,
    `Collection: ${order.fulfilment}`,
    order.inspirationUrl ? `Inspiration: ${order.inspirationUrl}` : null,
    "",
    "Additional Notes",
    order.notes,
  ]
    .filter(Boolean)
    .join("\n");

  await transporter.sendMail({
    from: `"Chef Bev Website" <${user}>`,
    to,
    replyTo: form?.email || undefined,
    subject,
    text,
  });

  console.log("✓ Order email sent:", { to, orderId: String(order._id) });
}
