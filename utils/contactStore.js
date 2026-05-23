import { getFirestore, isFirebaseConfigured } from "./firebase.js";
import { assertMin, cleanText, isEmail, isPhone, optionalText, removeUndefined } from "./validation.js";

export const contactStatuses = ["Needs Reply", "Replied", "Resolved", "Archived"];

export async function createContact(form) {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured. Contact messages cannot be saved yet.");
  }

  const contact = removeUndefined({
    name: cleanText(form.name, 80),
    email: cleanText(form.email, 120).toLowerCase(),
    phone: optionalText(form.phone, 30),
    subject: cleanText(form.subject, 100),
    message: cleanText(form.message, 1000),
    status: "Needs Reply",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

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

export async function updateContactNotification(id, notification) {
  if (!isFirebaseConfigured() || !id) return;

  await getFirestore().collection("contacts").doc(id).update({
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

function serializeContact(doc) {
  const data = doc.data();

  return {
    id: doc.id,
    _id: doc.id,
    ...data,
    createdAt: serializeDate(data.createdAt),
    updatedAt: serializeDate(data.updatedAt),
    emailNotification: data.emailNotification
      ? {
          ...data.emailNotification,
          updatedAt: serializeDate(data.emailNotification.updatedAt),
        }
      : null,
  };
}

export async function getOwnerContacts({ limit = 30 } = {}) {
  if (!isFirebaseConfigured()) return [];

  const snapshot = await getFirestore()
    .collection("contacts")
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();

  return snapshot.docs.map(serializeContact);
}

export async function updateContactOwnerFields(id, form = {}) {
  if (!isFirebaseConfigured() || !id) return;

  const status = cleanText(form.status, 40);
  const hasInternalNotes = Object.prototype.hasOwnProperty.call(form, "internalNotes");
  const internalNotes = hasInternalNotes ? optionalText(form.internalNotes, 1200) || "" : undefined;

  if (!contactStatuses.includes(status)) {
    throw new Error("Invalid contact status.");
  }

  await getFirestore()
    .collection("contacts")
    .doc(id)
    .update({
      status,
      ...(hasInternalNotes ? { internalNotes } : {}),
      updatedAt: new Date(),
    });
}
