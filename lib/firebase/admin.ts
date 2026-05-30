import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

function getFirebaseAdminConfig() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Firebase admin credentials are missing.");
  }

  return {
    projectId,
    clientEmail,
    privateKey,
  };
}

export function getFirebaseAdminApp() {
  if (getApps().length > 0) {
    return getApp();
  }

  return initializeApp({
    credential: cert(getFirebaseAdminConfig()),
  });
}

export function getFirebaseAdminAuth() {
  return getAuth(getFirebaseAdminApp());
}
