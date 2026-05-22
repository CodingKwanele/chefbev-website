import crypto from "crypto";
import path from "path";
import { getFirestore, getStorageBucket, isFirebaseConfigured } from "./firebase.js";

export const categories = [
  { key: "all", label: "All" },
  { key: "wedding", label: "Wedding" },
  { key: "birthday", label: "Birthday" },
  { key: "corporate", label: "Corporate" },
  { key: "other", label: "Other" },
];

export const fallbackGalleryItems = [];

function cleanText(value, fallback = "") {
  return String(value || fallback).trim().substring(0, 120);
}

function isSupportedImage(file) {
  const signatures = [
    { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
    { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
    { mime: "image/webp", asciiAt8: "WEBP" },
  ];

  return signatures.some((signature) => {
    if (file.mimetype !== signature.mime) return false;

    if (signature.bytes) {
      return signature.bytes.every((byte, index) => file.buffer[index] === byte);
    }

    return file.buffer.toString("ascii", 8, 12) === signature.asciiAt8;
  });
}

function safeFileName(originalName = "cake-image") {
  const parsed = path.parse(originalName);
  const name = parsed.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const ext = parsed.ext.toLowerCase() || ".jpg";
  return `${Date.now()}-${name || "cake"}${ext}`;
}

function publicStorageUrl(bucketName, filePath, token) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(filePath)}?alt=media&token=${token}`;
}

function isMissingBucketError(err) {
  return /bucket.*does not exist|specified bucket does not exist/i.test(err?.message || "");
}

export async function getGalleryItems({ useFallback = true } = {}) {
  if (!isFirebaseConfigured()) {
    return useFallback ? fallbackGalleryItems : [];
  }

  const snapshot = await getFirestore()
    .collection("galleryItems")
    .orderBy("createdAt", "desc")
    .get();

  const items = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      title: data.title,
      tag: data.tag,
      category: data.category,
      src: data.imageUrl,
      storagePath: data.storagePath,
    };
  });

  return items;
}

export async function addGalleryItem({ file, title, tag, category }) {
  if (!file) {
    throw new Error("Please choose an image to upload.");
  }

  if (!isSupportedImage(file)) {
    throw new Error("Only JPG, PNG, and WebP images can be uploaded.");
  }

  const bucket = getStorageBucket();
  const storagePath = `gallery/${safeFileName(file.originalname)}`;
  const token = crypto.randomUUID();
  const storageFile = bucket.file(storagePath);

  try {
    await storageFile.save(file.buffer, {
      resumable: false,
      contentType: file.mimetype,
      metadata: {
        metadata: {
          firebaseStorageDownloadTokens: token,
        },
      },
    });
  } catch (err) {
    if (isMissingBucketError(err)) {
      throw new Error(
        "Firebase Storage bucket was not found. Check FIREBASE_STORAGE_BUCKET in Vercel and use the exact bucket name from Firebase Console > Storage."
      );
    }

    throw err;
  }

  const item = {
    title: cleanText(title, "Cake style"),
    tag: cleanText(tag, "Custom"),
    category: categories.some((entry) => entry.key === category && entry.key !== "all")
      ? category
      : "other",
    imageUrl: publicStorageUrl(bucket.name, storagePath, token),
    storagePath,
    createdAt: new Date(),
  };

  await getFirestore().collection("galleryItems").add(item);
  return item;
}

export async function deleteGalleryItem(id) {
  const docRef = getFirestore().collection("galleryItems").doc(id);
  const doc = await docRef.get();

  if (!doc.exists) {
    throw new Error("That gallery item no longer exists.");
  }

  const data = doc.data();

  if (data.storagePath) {
    await getStorageBucket().file(data.storagePath).delete({ ignoreNotFound: true });
  }

  await docRef.delete();
}
