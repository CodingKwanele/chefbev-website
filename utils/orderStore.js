import { getFirestore, isFirebaseConfigured } from "./firebase.js";
import {
  assertMin,
  assertOneOf,
  assertValidUrl,
  cleanText,
  isEmail,
  isPhone,
  optionalText,
} from "./validation.js";

const occasions = ["Birthday", "Wedding", "Graduation", "Baby Shower", "Corporate", "Other"];
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

  const order = {
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
    status: "New",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

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
