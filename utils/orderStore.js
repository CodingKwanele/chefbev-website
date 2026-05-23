import { getFirestore, isFirebaseConfigured } from "./firebase.js";
import {
  assertMin,
  assertOneOf,
  assertValidUrl,
  cleanText,
  isEmail,
  isPhone,
  optionalText,
  removeUndefined,
} from "./validation.js";

const occasions = ["Birthday", "Wedding", "Graduation", "Baby Shower", "Corporate", "Other"];
export const orderStatuses = [
  "Needs Reply",
  "Discussing",
  "Quote Sent",
  "Confirmed",
  "Paid",
  "Baking Soon",
  "Collected",
  "Cancelled",
];
const budgets = ["", "R500–R800", "R800–R1200", "R1200–R2000", "R2000+"];

function parseFutureDate(value) {
  const eventDate = new Date(value);
  if (Number.isNaN(eventDate.getTime())) {
    throw new Error("Event date is required");
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const compare = new Date(eventDate);
  compare.setHours(0, 0, 0, 0);

  if (compare < today) {
    throw new Error("Event date must be today or in the future");
  }

  return eventDate;
}

export async function createOrder(form) {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured. Orders cannot be saved yet.");
  }

  const order = removeUndefined({
    customerName: cleanText(form.customerName, 80),
    phone: cleanText(form.phone, 30),
    email: optionalText(form.email, 120)?.toLowerCase(),
    occasion: cleanText(form.occasion, 40),
    eventDate: parseFutureDate(form.eventDate),
    style: optionalText(form.style, 80),
    size: cleanText(form.size, 40),
    flavour: cleanText(form.flavour, 60),
    budget: cleanText(form.budget, 40),
    fulfilment: "Pickup",
    notes: cleanText(form.notes, 1200),
    inspirationUrl: optionalText(form.inspirationUrl, 300),
    status: "Needs Reply",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  assertMin(order.customerName, 2, "Name must be at least 2 characters");
  if (!isPhone(order.phone)) throw new Error("Phone number is not valid");
  if (order.email && !isEmail(order.email)) throw new Error("Email address is not valid");
  assertOneOf(order.occasion, occasions, `${order.occasion} is not a valid occasion type`);
  assertMin(order.size, 2, "Size description must be at least 2 characters");
  assertMin(order.flavour, 2, "Flavour must be at least 2 characters");
  assertOneOf(order.budget, budgets, `${order.budget} is not a valid budget range`);
  assertMin(order.notes, 10, "Please provide at least 10 characters of design notes");
  assertValidUrl(order.inspirationUrl, "Inspiration link");

  const doc = await getFirestore().collection("orders").add(order);

  return {
    ...order,
    _id: doc.id,
    id: doc.id,
  };
}

export async function updateOrderNotification(id, notification) {
  if (!isFirebaseConfigured() || !id) return;

  await getFirestore().collection("orders").doc(id).update({
    emailNotification: removeUndefined({
      status: notification.status,
      messageId: notification.messageId,
      attempts: notification.attempts,
      error: notification.error,
      updatedAt: new Date(),
    }),
    updatedAt: new Date(),
  });
}

function serializeDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  return value;
}

function serializeOrder(doc) {
  const data = doc.data();

  return {
    id: doc.id,
    _id: doc.id,
    ...data,
    createdAt: serializeDate(data.createdAt),
    updatedAt: serializeDate(data.updatedAt),
    eventDate: serializeDate(data.eventDate),
    completedAt: serializeDate(data.completedAt),
    emailNotification: data.emailNotification
      ? {
          ...data.emailNotification,
          updatedAt: serializeDate(data.emailNotification.updatedAt),
        }
      : null,
  };
}

export async function getOwnerOrders({ limit = 40 } = {}) {
  if (!isFirebaseConfigured()) return [];

  const snapshot = await getFirestore()
    .collection("orders")
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();

  return snapshot.docs.map(serializeOrder);
}

export async function updateOrderOwnerFields(id, form = {}) {
  if (!isFirebaseConfigured() || !id) return;

  const status = cleanText(form.status, 40);
  const hasInternalNotes = Object.prototype.hasOwnProperty.call(form, "internalNotes");
  const internalNotes = hasInternalNotes ? optionalText(form.internalNotes, 1200) || "" : undefined;

  if (!orderStatuses.includes(status)) {
    throw new Error("Invalid order status.");
  }

  await getFirestore().collection("orders").doc(id).update(
    removeUndefined({
      status,
      ...(hasInternalNotes ? { internalNotes } : {}),
      completedAt: status === "Collected" ? new Date() : undefined,
      updatedAt: new Date(),
    })
  );
}
