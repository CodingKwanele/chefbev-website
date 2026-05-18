import admin from "firebase-admin";

let app;

function getPrivateKey() {
  return process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
}

export function isFirebaseConfigured() {
  return Boolean(
    process.env.FIREBASE_STORAGE_BUCKET &&
      ((process.env.FIREBASE_PROJECT_ID &&
        process.env.FIREBASE_CLIENT_EMAIL &&
        process.env.FIREBASE_PRIVATE_KEY) ||
        process.env.GOOGLE_APPLICATION_CREDENTIALS)
  );
}

export function getFirebaseApp() {
  if (app) return app;

  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured. Add Firebase credentials to .env.");
  }

  const credential = process.env.GOOGLE_APPLICATION_CREDENTIALS
    ? admin.credential.applicationDefault()
    : admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: getPrivateKey(),
      });

  app = admin.initializeApp({
    credential,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });

  return app;
}

export function getFirestore() {
  getFirebaseApp();
  return admin.firestore();
}

export function getStorageBucket() {
  getFirebaseApp();
  return admin.storage().bucket();
}
