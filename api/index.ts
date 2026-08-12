import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { initializeApp as initializeAdminApp, getApps as getAdminApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

dotenv.config();

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Serverless handler for Vercel
const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
let firebaseDb: any = null;

let firebaseConfig: any = {};
if (fs.existsSync(firebaseConfigPath)) {
  try {
    firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));
  } catch (e) {
    console.warn("[VERCEL SERVERLESS] Unable to parse firebase-applet-config.json:", e);
  }
}

const targetProjectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId;
const targetDatabaseId = process.env.FIREBASE_DATABASE_ID || process.env.VITE_FIREBASE_DATABASE_ID || firebaseConfig.firestoreDatabaseId || "ostvendas-clean-db";

if (targetProjectId) {
  try {
    if (getAdminApps().length === 0) {
      const adminOptions: any = { projectId: targetProjectId };
      if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
        adminOptions.credential = cert({
          projectId: targetProjectId,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
        });
      }
      initializeAdminApp(adminOptions);
    }
    firebaseDb = getFirestore(targetDatabaseId);
    console.log(`[VERCEL SERVERLESS] Firestore initialized for ${targetProjectId} / ${targetDatabaseId}`);
  } catch (err) {
    console.error("[VERCEL SERVERLESS] Firebase Admin init error:", err);
  }
}

function sanitizeForFirestore(data: any): any {
  if (data === null || data === undefined) return null;
  if (Array.isArray(data)) return data.map(item => sanitizeForFirestore(item));
  if (typeof data === "object") {
    const cleanObj: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) cleanObj[key] = sanitizeForFirestore(value);
    }
    return cleanObj;
  }
  return data;
}

app.get("/api/db/load", async (req, res) => {
  try {
    if (!firebaseDb) {
      return res.json({ success: false, message: "Firebase DB connection not initialized on Vercel" });
    }
    const tables = ["products", "customers", "transactions", "cashflow", "employees", "auditlogs"];
    const result: any = {};
    let hasData = false;

    for (const t of tables) {
      const snapshot = await firebaseDb.collection(t).get();
      if (!snapshot.empty) {
        hasData = true;
        result[t] = snapshot.docs.map((doc: any) => ({ ...doc.data(), id: doc.id }));
      } else {
        result[t] = [];
      }
    }

    const settingsSnap = await firebaseDb.collection("settings").doc("config").get();
    if (settingsSnap.exists) {
      hasData = true;
      result["settings"] = settingsSnap.data();
    } else {
      result["settings"] = null;
    }

    res.json({ success: true, hasData, data: result, source: "firebase" });
  } catch (err: any) {
    console.error("[VERCEL SERVERLESS] Error loading database:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/db/save", async (req, res) => {
  try {
    const { table, data } = req.body;
    if (!table || data === undefined) {
      return res.status(400).json({ error: "Parâmetros table e data são obrigatórios." });
    }

    if (firebaseDb) {
      if (table === "settings") {
        await firebaseDb.collection("settings").doc("config").set(sanitizeForFirestore(data));
      } else if (Array.isArray(data)) {
        const collectionRef = firebaseDb.collection(table);
        const snapshot = await collectionRef.get();
        const newDataIds = new Set(data.map((item: any) => String(item.id)));
        
        for (const docSnap of snapshot.docs) {
          if (!newDataIds.has(String(docSnap.id))) {
            await docSnap.ref.delete();
          }
        }

        const batchSize = 400;
        for (let i = 0; i < data.length; i += batchSize) {
          const chunk = data.slice(i, i + batchSize);
          const batch = firebaseDb.batch();
          for (const item of chunk) {
            const docId = item.id || `doc-${Date.now()}-${Math.random()}`;
            const docRef = collectionRef.doc(String(docId));
            batch.set(docRef, sanitizeForFirestore(item));
          }
          await batch.commit();
        }
      }
    }

    res.json({ success: true, message: `Tabela ${table} sincronizada com sucesso no Vercel.` });
  } catch (err: any) {
    console.error(`[VERCEL SERVERLESS] Error saving table ${req.body?.table}:`, err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", environment: "vercel-serverless", firebaseConnected: !!firebaseDb });
});

export default app;
