import { App, cert, getApps, initializeApp } from "firebase-admin/app";
import { Auth, getAuth } from "firebase-admin/auth";
import { Firestore, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

type AdminBucket = ReturnType<ReturnType<typeof getStorage>["bucket"]>;

let app: App | null = null;
let db: Firestore | null = null;
let bucket: AdminBucket | null = null;

export function isFirebaseServerConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
  );
}

function getFirebaseAdminApp(): App {
  if (!isFirebaseServerConfigured()) {
    throw new Error("Firebase Admin is not configured.");
  }

  if (!app) {
    const projectId = process.env.FIREBASE_PROJECT_ID as string;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL as string;
    const privateKey = (process.env.FIREBASE_PRIVATE_KEY as string)
      .replace(/^"+|"+$/g, "")
      .replace(/\\n/g, "\n");

    app = getApps()[0] ??
      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey
        }),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
      });
  }

  return app;
}

export function getAdminDb(): Firestore {
  if (!db) {
    db = getFirestore(getFirebaseAdminApp());
    db.settings({ ignoreUndefinedProperties: true });
  }
  return db;
}

export function getAdminAuth(): Auth {
  return getAuth(getFirebaseAdminApp());
}

export function getAdminStorageBucket(): AdminBucket {
  if (!bucket) {
    const appInstance = getFirebaseAdminApp();
    const configuredBucket = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    bucket = configuredBucket
      ? getStorage(appInstance).bucket(configuredBucket)
      : getStorage(appInstance).bucket();
  }
  return bucket;
}

export function getFirebaseProjectId(): string {
  if (!process.env.FIREBASE_PROJECT_ID) {
    throw new Error("Firebase project id is not configured.");
  }
  return process.env.FIREBASE_PROJECT_ID;
}

export async function getFirebaseAccessToken(): Promise<string> {
  const credential = getFirebaseAdminApp().options.credential;
  if (!credential || typeof credential.getAccessToken !== "function") {
    throw new Error("Firebase credential is not configured.");
  }

  const token = await credential.getAccessToken();
  if (!token?.access_token) {
    throw new Error("Failed to acquire Firebase access token.");
  }

  return token.access_token;
}
