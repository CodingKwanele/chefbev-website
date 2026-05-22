import nodemailer from "nodemailer";

function getEmailConfig() {
  const host = process.env.EMAIL_HOST;
  const port = Number(process.env.EMAIL_PORT || 587);
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  const to = process.env.BEV_ORDER_TO || process.env.EMAIL_USER;

  if (!host || !user || !pass || !to) {
    throw new Error("Email is not configured in environment variables.");
  }

  return { host, port, user, pass, to };
}

function createTransporter({ host, port, user, pass }) {
  const secure = port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    requireTLS: !secure,
    tls: {
      servername: host,
      minVersion: "TLSv1.2",
    },
  });
}

export async function sendOrderEmail({ order, form }) {
  const config = getEmailConfig();
  const transporter = createTransporter(config);

  const formattedDate = new Date(order.eventDate).toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const subject = `New Cake Order - ${order.occasion} (${order._id})`;

  const text = [
    "New order received",
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

  const info = await transporter.sendMail({
    from: `"Chef Bev Website" <${config.user}>`,
    to: config.to,
    replyTo: form?.email || undefined,
    subject,
    text,
  });

  console.log("Order email sent:", {
    to: config.to,
    orderId: String(order._id),
    messageId: info.messageId,
  });
}

export async function sendContactEmail({ contact }) {
  const config = getEmailConfig();
  const transporter = createTransporter(config);
  const subject = `New Contact Inquiry - ${contact.subject} (${contact._id})`;

  const text = [
    "New contact inquiry received",
    "",
    `Inquiry Reference: ${contact._id}`,
    "",
    "Customer Details",
    `Name: ${contact.name}`,
    `Email: ${contact.email}`,
    contact.phone ? `Phone: ${contact.phone}` : null,
    "",
    "Inquiry",
    `Subject: ${contact.subject}`,
    "",
    contact.message,
  ]
    .filter(Boolean)
    .join("\n");

  const info = await transporter.sendMail({
    from: `"Chef Bev Website" <${config.user}>`,
    to: config.to,
    replyTo: contact.email,
    subject,
    text,
  });

  console.log("Contact email sent:", {
    to: config.to,
    contactId: String(contact._id),
    messageId: info.messageId,
  });
}
