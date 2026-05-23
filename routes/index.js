// routes/index.js
import { Router } from "express";
import { sendContactEmail, sendOrderEmail } from "../utils/email.js";
import {
  contactStatuses,
  createContact,
  getOwnerContacts,
  updateContactNotification,
  updateContactOwnerFields,
} from "../utils/contactStore.js";
import {
  categories,
  fallbackGalleryItems,
  getGalleryItems,
} from "../utils/galleryStore.js";
import {
  createOrder,
  getOwnerOrders,
  orderStatuses,
  updateOrderNotification,
  updateOrderOwnerFields,
} from "../utils/orderStore.js";
import {
  clearOwnerCookie,
  isOwnerConfigured,
  requireOwner,
  setOwnerCookie,
} from "../utils/ownerAuth.js";
import {
  rateLimit,
  rejectHoneypot,
  requireCsrf,
  requireTrustedOrigin,
  safeExternalUrl,
  timingSafeEqualText,
} from "../utils/security.js";

const router = Router();
const ownerLoginLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 8, keyPrefix: "owner-login" });
const formSubmitLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, keyPrefix: "form-submit" });
const ownerWriteLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 40, keyPrefix: "owner-write" });

function cleanWhatsAppNumber(value) {
  return String(value || "").replace(/[^\d]/g, "");
}

function cleanPrefillImage(value) {
  const raw = String(value || "").trim().substring(0, 300);
  if (raw.startsWith("/img/")) return raw;

  return (
    safeExternalUrl(raw, ["firebasestorage.googleapis.com", "storage.googleapis.com"]) || ""
  );
}

function formatDateForMessage(value) {
  return new Date(value).toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

async function markOrderEmail(orderId, notification) {
  try {
    await updateOrderNotification(orderId, notification);
  } catch (err) {
    console.error("Order email status update failed:", {
      orderId: String(orderId),
      message: err.message,
    });
  }
}

async function markContactEmail(contactId, notification) {
  try {
    await updateContactNotification(contactId, notification);
  } catch (err) {
    console.error("Contact email status update failed:", {
      contactId: String(contactId),
      message: err.message,
    });
  }
}

function buildOrderWhatsAppMessage(order) {
  return [
    "Hi Chef Bev, I just submitted an order request.",
    `Reference: ${order._id}`,
    `Name: ${order.customerName}`,
    `Phone: ${order.phone}`,
    order.email ? `Email: ${order.email}` : null,
    `Occasion: ${order.occasion}`,
    `Date: ${formatDateForMessage(order.eventDate)}`,
    `Size: ${order.size}`,
    `Flavour: ${order.flavour}`,
    order.style ? `Style: ${order.style}` : null,
    order.budget ? `Budget: ${order.budget}` : null,
    `Notes: ${order.notes}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildContactWhatsAppMessage(contact) {
  return [
    "Hi Chef Bev, I just sent a website inquiry.",
    `Reference: ${contact._id}`,
    `Name: ${contact.name}`,
    `Email: ${contact.email}`,
    contact.phone ? `Phone: ${contact.phone}` : null,
    `Subject: ${contact.subject}`,
    `Message: ${contact.message}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function ownerWhatsAppUrl(phone, message) {
  const cleanedPhone = cleanWhatsAppNumber(phone);
  if (!cleanedPhone) return "";
  return `https://wa.me/${cleanedPhone}?text=${encodeURIComponent(message)}`;
}

function normalizedOrderStatus(status) {
  const legacy = {
    New: "Needs Reply",
    Contacted: "Discussing",
    Quoted: "Quote Sent",
    Completed: "Collected",
  };

  return legacy[status] || status || "Needs Reply";
}

function normalizedContactStatus(status) {
  const legacy = {
    New: "Needs Reply",
    Contacted: "Replied",
  };

  return legacy[status] || status || "Needs Reply";
}

function isOrderAttentionStatus(status) {
  return ["Needs Reply", "Discussing", "Quote Sent"].includes(normalizedOrderStatus(status));
}

function isContactAttentionStatus(status) {
  return normalizedContactStatus(status) === "Needs Reply";
}

function isUpcomingOrder(order) {
  if (!order.eventDate) return false;

  const status = normalizedOrderStatus(order.status);
  if (["Collected", "Cancelled"].includes(status)) return false;

  const eventDate = new Date(order.eventDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  eventDate.setHours(0, 0, 0, 0);
  const sevenDays = 7 * 24 * 60 * 60 * 1000;

  return eventDate >= now && eventDate.getTime() - now.getTime() <= sevenDays;
}

function dateKey(value) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function shortWeekday(value) {
  return new Date(value).toLocaleDateString("en-ZA", {
    weekday: "short",
    day: "numeric",
  });
}

function orderDeskStats(orders, contacts) {
  const needsReplyOrders = orders.filter((order) => isOrderAttentionStatus(order.status));
  const needsReplyContacts = contacts.filter((contact) => isContactAttentionStatus(contact.status));

  return {
    needsReply: needsReplyOrders.length + needsReplyContacts.length,
    upcomingOrders: orders.filter(isUpcomingOrder).length,
    confirmedOrders: orders.filter((order) =>
      ["Confirmed", "Paid", "Baking Soon"].includes(normalizedOrderStatus(order.status))
    ).length,
    failedNotifications: [...orders, ...contacts].filter(
      (item) => item.emailNotification?.status === "failed"
    ).length,
  };
}

function orderDeskInsights(orders, contacts) {
  const statusCounts = orderStatuses.map((status) => ({
    label: status,
    value: orders.filter((order) => normalizedOrderStatus(order.status) === status).length,
  }));
  const maxStatus = Math.max(1, ...statusCounts.map((item) => item.value));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcomingDays = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(today);
    day.setDate(today.getDate() + index);
    const key = dateKey(day);
    const value = orders.filter((order) => dateKey(order.eventDate) === key).length;

    return {
      key,
      label: index === 0 ? "Today" : shortWeekday(day),
      value,
    };
  });
  const maxUpcoming = Math.max(1, ...upcomingDays.map((item) => item.value));

  const emailHealth = [
    {
      label: "Sent",
      value: [...orders, ...contacts].filter((item) => item.emailNotification?.status === "sent")
        .length,
      filter: "sent",
    },
    {
      label: "Failed",
      value: [...orders, ...contacts].filter((item) => item.emailNotification?.status === "failed")
        .length,
      filter: "failed",
    },
    {
      label: "Pending",
      value: [...orders, ...contacts].filter((item) => !item.emailNotification?.status).length,
      filter: "pending",
    },
  ];
  const maxEmail = Math.max(1, ...emailHealth.map((item) => item.value));

  return {
    statusCounts,
    maxStatus,
    upcomingDays,
    maxUpcoming,
    emailHealth,
    maxEmail,
  };
}

function orderDeskSections(orders, contacts) {
  return {
    needsReplyOrders: orders.filter((order) => isOrderAttentionStatus(order.status)),
    needsReplyContacts: contacts.filter((contact) => isContactAttentionStatus(contact.status)),
    upcomingOrders: orders.filter(isUpcomingOrder),
    recentContacts: contacts.slice(0, 8),
  };
}

// Home
router.get("/", async (req, res) => {
  let featuredItems = [];

  try {
    featuredItems = (await getGalleryItems()).slice(0, 3);
  } catch (err) {
    console.error("Featured gallery load error:", err.message);
  }

  res.render("home", {
    title: "Chef Bev Luxury Cakes",
    active: "home",
    featuredItems,
  });
});

// Gallery
router.get("/gallery", async (req, res) => {
  const cat = (req.query.cat || "all").toLowerCase();
  const defaultCategory = categories.some((c) => c.key === cat) ? cat : "all";
  let items = [];

  try {
    items = await getGalleryItems();
  } catch (err) {
    console.error("Gallery load error:", err.message);
    items = fallbackGalleryItems;
  }

  res.render("gallery", {
    title: "Gallery",
    active: "gallery",
    items,
    categories,
    defaultCategory,
  });
});

// Owner login
router.get("/owner/login", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.render("owner-login", {
    title: "Owner Login",
    active: "owner",
    configured: isOwnerConfigured(),
    error: req.query.error === "true" ? "Incorrect password. Please try again." : null,
  });
});

router.post("/owner/login", requireTrustedOrigin, ownerLoginLimit, requireCsrf, rejectHoneypot, async (req, res) => {
  if (!isOwnerConfigured()) {
    return res.status(503).render("owner-login", {
      title: "Owner Login",
      active: "owner",
      configured: false,
      error: "Set OWNER_PASSWORD in .env before logging in.",
    });
  }

  if (!timingSafeEqualText(req.body.password, process.env.OWNER_PASSWORD)) {
    await new Promise((resolve) => setTimeout(resolve, 600));
    return res.redirect("/owner/login?error=true");
  }

  setOwnerCookie(res);
  return res.redirect("/owner/order-desk");
});

router.post("/owner/logout", requireTrustedOrigin, requireOwner, requireCsrf, (req, res) => {
  clearOwnerCookie(res);
  res.redirect("/owner/login");
});

router.get("/owner/dashboard", requireOwner, (req, res) => {
  res.redirect("/owner/order-desk");
});

router.get("/owner/order-desk", requireOwner, async (req, res) => {
  let orders = [];
  let contacts = [];
  let error = null;

  try {
    [orders, contacts] = await Promise.all([getOwnerOrders(), getOwnerContacts()]);
  } catch (err) {
    console.error("Owner order desk load error:", err.message);
    error = err.message;
  }

  const sections = orderDeskSections(orders, contacts);

  res.render("owner-order-desk", {
    title: "Order Desk",
    active: "owner",
    orders,
    contacts,
    stats: orderDeskStats(orders, contacts),
    sections,
    insights: orderDeskInsights(orders, contacts),
    orderStatuses,
    contactStatuses,
    normalizedOrderStatus,
    normalizedContactStatus,
    isUpcomingOrder,
    orderWhatsAppUrl: (order) =>
      ownerWhatsAppUrl(
        order.phone,
        `Hi ${order.customerName}, this is Chef Bev about your cake order ${order._id}.`
      ),
    contactWhatsAppUrl: (contact) =>
      ownerWhatsAppUrl(
        contact.phone,
        `Hi ${contact.name}, this is Chef Bev replying to your website inquiry ${contact._id}.`
      ),
    success: req.query.success || null,
    error,
  });
});

router.post("/owner/orders/:id", requireTrustedOrigin, requireOwner, ownerWriteLimit, requireCsrf, async (req, res) => {
  try {
    await updateOrderOwnerFields(req.params.id, req.body);
    res.redirect("/owner/order-desk?success=Order%20updated");
  } catch (err) {
    console.error("Owner order update error:", err.message);
    res.redirect("/owner/order-desk");
  }
});

router.post("/owner/contacts/:id", requireTrustedOrigin, requireOwner, ownerWriteLimit, requireCsrf, async (req, res) => {
  try {
    await updateContactOwnerFields(req.params.id, req.body);
    res.redirect("/owner/order-desk?success=Contact%20updated");
  } catch (err) {
    console.error("Owner contact update error:", err.message);
    res.redirect("/owner/order-desk");
  }
});

// Owner gallery reference
router.get("/owner/gallery", requireOwner, async (req, res) => {
  const items = await getGalleryItems();

  res.render("owner-gallery", {
    title: "Gallery Reference",
    active: "owner",
    items,
    categories,
    success: req.query.success || null,
    error: null,
  });
});

// Orders page (GET)
router.get("/orders", (req, res) => {
  const { style, img, success } = req.query;

  res.render("orders", {
    title: "Place an Order",
    active: "orders",
    prefill: { 
      style: (style || "").substring(0, 100),
      img: cleanPrefillImage(img),
    },
    formData: null,
    success: success === "true" ? {} : null,
    error: null,
  });
});

// Orders submit (POST)
router.post("/orders", requireTrustedOrigin, formSubmitLimit, requireCsrf, rejectHoneypot, async (req, res) => {
  try {
    const order = await createOrder({
      customerName: req.body.customerName,
      phone: req.body.phone,
      email: req.body.email || undefined,
      occasion: req.body.occasion,
      eventDate: req.body.eventDate,
      style: req.body.style || undefined,
      size: req.body.size,
      flavour: req.body.flavour,
      budget: req.body.budget || "",
      fulfilment: "Pickup",
      area: undefined,
      notes: req.body.notes,
      inspirationUrl: req.body.inspirationUrl || undefined,
    });

    try {
      const emailResult = await sendOrderEmail({ order, form: req.body });
      await markOrderEmail(order._id, {
        status: "sent",
        messageId: emailResult.messageId,
        attempts: emailResult.attempts,
      });
    } catch (err) {
      console.error("Order email send failed:", {
        orderId: String(order._id),
        message: err.message,
        code: err.code,
        response: err.response,
      });
      await markOrderEmail(order._id, {
        status: "failed",
        attempts: 3,
        error: err.message,
      });
    }

    const bevPhone = cleanWhatsAppNumber(process.env.BEV_WHATSAPP);
    const whatsappMessage = buildOrderWhatsAppMessage(order);
    const whatsappUrl = `https://wa.me/${bevPhone}?text=${encodeURIComponent(whatsappMessage)}`;

    res.status(201).render("orders", {
      title: "Order Received",
      active: "orders",
      formData: null,
      prefill: { style: "", img: "" },
      success: {
        orderId: order._id,
        customerName: order.customerName,
        whatsappUrl,
      },
      error: null,
    });
  } catch (err) {
    console.error("Order submission error:", err);

    let errorMessage = "Failed to submit order. Please check your inputs.";
    
    errorMessage = err.message || errorMessage;

    res.status(400).render("orders", {
      title: "Place an Order",
      active: "orders",
      formData: req.body,
      prefill: { style: "", img: "" },
      success: false,
      error: errorMessage,
    });
  }
});

// Contact page (GET)
router.get("/contact", (req, res) => {
  const { success } = req.query;

  res.render("contact", {
    title: "Contact Us",
    active: "contact",
    formData: null,
    success: success === "true",
    error: null,
  });
});

// Contact submit (POST)
router.post("/contact", requireTrustedOrigin, formSubmitLimit, requireCsrf, rejectHoneypot, async (req, res) => {
  try {
    const contact = await createContact({
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone || undefined,
      subject: req.body.subject,
      message: req.body.message,
    });

    try {
      const emailResult = await sendContactEmail({ contact });
      await markContactEmail(contact._id, {
        status: "sent",
        messageId: emailResult.messageId,
        attempts: emailResult.attempts,
      });
    } catch (err) {
      console.error("Contact email send failed:", {
        contactId: String(contact._id),
        message: err.message,
        code: err.code,
        response: err.response,
      });
      await markContactEmail(contact._id, {
        status: "failed",
        attempts: 3,
        error: err.message,
      });
    }

    const bevPhone = cleanWhatsAppNumber(process.env.BEV_WHATSAPP);
    const whatsappMessage = buildContactWhatsAppMessage(contact);
    const whatsappUrl = `https://wa.me/${bevPhone}?text=${encodeURIComponent(whatsappMessage)}`;

    res.redirect(whatsappUrl);
  } catch (err) {
    console.error("Contact submission error:", err);

    let errorMessage = "Failed to submit your inquiry. Please check your inputs.";
    
    errorMessage = err.message || errorMessage;

    res.status(400).render("contact", {
      title: "Contact Us",
      active: "contact",
      formData: req.body,
      success: false,
      error: errorMessage,
    });
  }
});

export default router;
