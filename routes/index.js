// routes/index.js
import { Router } from "express";
import multer from "multer";
import { sendOrderEmail } from "../utils/email.js";
import { createContact } from "../utils/contactStore.js";
import {
  addGalleryItem,
  categories,
  deleteGalleryItem,
  fallbackGalleryItems,
  getGalleryItems,
} from "../utils/galleryStore.js";
import { createOrder } from "../utils/orderStore.js";
import { isFirebaseConfigured } from "../utils/firebase.js";
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
const ownerWriteLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, keyPrefix: "owner-write" });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (allowed.has(file.mimetype)) return cb(null, true);
    return cb(new Error("Only JPG, PNG, and WebP images can be uploaded."));
  },
});

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

// Home
router.get("/", async (req, res) => {
  let featuredItems = [];

  try {
    featuredItems = (await getGalleryItems({ useFallback: false })).slice(0, 3);
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
  return res.redirect("/owner/gallery");
});

router.post("/owner/logout", requireTrustedOrigin, requireOwner, requireCsrf, (req, res) => {
  clearOwnerCookie(res);
  res.redirect("/owner/login");
});

// Owner gallery manager
router.get("/owner/gallery", requireOwner, async (req, res) => {
  let items = [];
  let error = null;

  try {
    items = await getGalleryItems({ useFallback: false });
  } catch (err) {
    console.error("Owner gallery load error:", err.message);
    error = err.message;
  }

  res.render("owner-gallery", {
    title: "Gallery Manager",
    active: "owner",
    items,
    categories,
    firebaseReady: isFirebaseConfigured(),
    success: req.query.success || null,
    error,
  });
});

router.post("/owner/gallery", requireTrustedOrigin, requireOwner, ownerWriteLimit, upload.single("image"), requireCsrf, rejectHoneypot, async (req, res) => {
  try {
    await addGalleryItem({
      file: req.file,
      title: req.body.title,
      tag: req.body.tag,
      category: req.body.category,
    });

    res.redirect("/owner/gallery?success=Photo%20added");
  } catch (err) {
    console.error("Gallery upload error:", err.message);

    let items = [];
    try {
      items = await getGalleryItems({ useFallback: false });
    } catch {
      items = [];
    }

    res.status(400).render("owner-gallery", {
      title: "Gallery Manager",
      active: "owner",
      items,
      categories,
      firebaseReady: isFirebaseConfigured(),
      success: null,
      error: err.message || "Could not upload the photo.",
    });
  }
});

router.post("/owner/gallery/:id/delete", requireTrustedOrigin, requireOwner, ownerWriteLimit, requireCsrf, async (req, res) => {
  try {
    await deleteGalleryItem(req.params.id);
    res.redirect("/owner/gallery?success=Photo%20deleted");
  } catch (err) {
    console.error("Gallery delete error:", err.message);
    res.redirect("/owner/gallery");
  }
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
    success: success === "true",
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

    // Send email notification (non-blocking)
    sendOrderEmail({ order, form: req.body }).catch((err) => {
      console.error("Email send failed (non-blocking):", err.message);
    });

    // Redirect to WhatsApp
    const bevPhone = cleanWhatsAppNumber(process.env.BEV_WHATSAPP);
    const whatsappMessage = `New order from ${order.customerName}. Order ID: ${order._id}`;
    const whatsappUrl = `https://wa.me/${bevPhone}?text=${encodeURIComponent(whatsappMessage)}`;
    
    res.redirect(whatsappUrl);
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

    // Redirect to WhatsApp
    const bevPhone = cleanWhatsAppNumber(process.env.BEV_WHATSAPP);
    const whatsappMessage = `New contact inquiry from ${contact.name}. Inquiry ID: ${contact._id}`;
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
