import { getFirestore, isFirebaseConfigured } from "./firebase.js";
import { assertMin, cleanText, isEmail, isPhone, optionalText } from "./validation.js";

export async function createContact(form) {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured. Contact messages cannot be saved yet.");
  }

  const contact = {
    name: cleanText(form.name, 80),
    email: cleanText(form.email, 120).toLowerCase(),
    phone: optionalText(form.phone, 30),
    subject: cleanText(form.subject, 100),
    message: cleanText(form.message, 1000),
    status: "New",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  assertMin(contact.name, 2, "Name must be at least 2 characters");
  if (!isEmail(contact.email)) throw new Error(`${contact.email} is not a valid email address`);
  if (contact.phone && !isPhone(contact.phone)) {
    throw new Error(`${contact.phone} is not a valid phone number`);
  }
  assertMin(contact.subject, 3, "Subject must be at least 3 characters");
  assertMin(contact.message, 10, "Message must be at least 10 characters");

  const doc = await getFirestore().collection("contacts").add(contact);

  return {
    ...contact,
    _id: doc.id,
    id: doc.id,
  };
}
