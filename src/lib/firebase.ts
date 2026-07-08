import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { getFirestore, doc, getDocFromServer, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, collection, getDocs, onSnapshot, disableNetwork } from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and Auth with the custom database ID from configuration
const firestoreDatabaseId = (firebaseConfig as any).firestoreDatabaseId;
if (firestoreDatabaseId) {
  console.log(`[FIREBASE] Inicializando Firestore com Database ID: ${firestoreDatabaseId}`);
} else {
  console.warn("[FIREBASE] AVISO: firestoreDatabaseId não encontrado no firebase-applet-config.json. Usando base padrão.");
}

export const db = firestoreDatabaseId ? getFirestore(app, firestoreDatabaseId) : getFirestore(app);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://mail.google.com/');
provider.addScope('https://www.googleapis.com/auth/gmail.send');
provider.addScope('https://www.googleapis.com/auth/drive');
provider.addScope('https://www.googleapis.com/auth/drive.activity');
provider.addScope('https://www.googleapis.com/auth/drive.activity.readonly');
provider.addScope('https://www.googleapis.com/auth/drive.appdata');
provider.addScope('https://www.googleapis.com/auth/drive.apps.readonly');
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.addScope('https://www.googleapis.com/auth/drive.install');
provider.addScope('https://www.googleapis.com/auth/drive.meet.readonly');
provider.addScope('https://www.googleapis.com/auth/drive.metadata');
provider.addScope('https://www.googleapis.com/auth/drive.metadata.readonly');
provider.addScope('https://www.googleapis.com/auth/drive.photos.readonly');
provider.addScope('https://www.googleapis.com/auth/drive.readonly');
provider.addScope('https://www.googleapis.com/auth/drive.scripts');

// Flag to indicate if we are in the middle of a sign-in flow.
let isSigningIn = false;
// Cache the access token in memory.
let cachedAccessToken: string | null = null;

// Initialize auth state listener. Call this on app load.
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (!cachedAccessToken) {
        cachedAccessToken = localStorage.getItem("google_access_token");
      }
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      localStorage.removeItem("google_access_token");
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Must be called from a button click or user interaction
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    localStorage.setItem("google_access_token", cachedAccessToken);
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  if (!cachedAccessToken) {
    cachedAccessToken = localStorage.getItem("google_access_token");
  }
  return cachedAccessToken;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  localStorage.removeItem("google_access_token");
};

// Recursive helper to sanitize objects by removing 'undefined' values before sending to Firestore
export function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return null as any;
  }
  if (Array.isArray(data)) {
    return data.map(item => sanitizeForFirestore(item)) as any;
  }
  if (typeof data === "object") {
    const cleanObj: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        cleanObj[key] = sanitizeForFirestore(value);
      }
    }
    return cleanObj;
  }
  return data;
}

// Verification is triggered on boot
export async function testConnection() {
  try {
    const testDoc = doc(db, "test", "connection");
    await getDocFromServer(testDoc);
    console.log("Firebase connection verified successfully in the browser!");
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.error("Please check your Firebase configuration.");
    } else {
      console.warn("Firebase transient connection check:", error);
    }
    return false;
  }
}

// Global firestore error helper following instructions
export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

let isQuotaCircuitBroken = false;

// Initialize from localStorage if present to remember across reloads
if (typeof window !== "undefined") {
  try {
    const lastDbId = localStorage.getItem("last_firestore_db_id");
    if (lastDbId !== firestoreDatabaseId) {
      localStorage.removeItem("firestore_quota_circuit_broken_until");
      isQuotaCircuitBroken = false;
      if (firestoreDatabaseId) {
        localStorage.setItem("last_firestore_db_id", firestoreDatabaseId);
      } else {
        localStorage.removeItem("last_firestore_db_id");
      }
    } else {
      const brokenUntil = localStorage.getItem("firestore_quota_circuit_broken_until");
      if (brokenUntil && Number(brokenUntil) > Date.now()) {
        isQuotaCircuitBroken = true;
        disableNetwork(db).then(() => {
          console.log("[QUOTA] Firestore network disabled on initialization due to active circuit breaker.");
        }).catch((e) => {
          console.warn("Could not disable Firestore network on initialization:", e);
        });
      }
    }
  } catch (e) {
    // Ignore localStorage errors
  }
}

export function breakCircuit() {
  isQuotaCircuitBroken = true;
  if (typeof window !== "undefined") {
    try {
      // Break circuit for 2 hours
      localStorage.setItem("firestore_quota_circuit_broken_until", String(Date.now() + 2 * 60 * 60 * 1000));
    } catch (e) {}
  }

  // Disable network to stop the background GrpcConnection Write streams and retry loops
  try {
    disableNetwork(db).then(() => {
      console.log("[QUOTA] Firestore network disabled successfully to prevent continuous background exhausted errors.");
    }).catch((e) => {
      console.warn("Could not disable Firestore network:", e);
    });
  } catch (err) {
    console.warn("Error invoking disableNetwork:", err);
  }
}

export function isCircuitBroken(): boolean {
  if (isQuotaCircuitBroken) {
    return true;
  }
  if (typeof window !== "undefined") {
    try {
      const brokenUntil = localStorage.getItem("firestore_quota_circuit_broken_until");
      if (brokenUntil && Number(brokenUntil) > Date.now()) {
        isQuotaCircuitBroken = true;
        return true;
      } else if (brokenUntil) {
        // Expired
        localStorage.removeItem("firestore_quota_circuit_broken_until");
        isQuotaCircuitBroken = false;
      }
    } catch (e) {}
  }
  return false;
}

export function checkAndNotifyQuota(error: unknown): boolean {
  const errorMsg = error instanceof Error ? error.message : String(error);
  const isQuota = errorMsg.toLowerCase().includes("quota") || 
                  errorMsg.toLowerCase().includes("exhausted") || 
                  errorMsg.toLowerCase().includes("resource-exhausted") || 
                  errorMsg.toLowerCase().includes("limit");
  
  if (isQuota) {
    breakCircuit();
    if (typeof window !== "undefined") {
      console.warn("[QUOTA DETECTED] Firestore quota limit exceeded. Dispatching event...");
      window.dispatchEvent(new CustomEvent("firestore-quota-exceeded", { 
        detail: { error: errorMsg } 
      }));
    }
  }
  return isQuota;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errorMsg = error instanceof Error ? error.message : String(error);
  checkAndNotifyQuota(error);

  const errInfo: FirestoreErrorInfo = {
    error: errorMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// ----------------------------------------------------
// AUTHENTICATION & FIRESTORE SYNCHRONIZATION HELPERS
// ----------------------------------------------------

export interface UsuarioDoc {
  uid: string;
  nomeCompleto: string;
  email: string;
  empresa: string;
  perfil: string;
  cargo: string;
  estado: "Ativo" | "Inativo";
  fotoPerfil: string;
  telefone: string;
  ultimoLogin: any;
  dataCriacao: any;
  username?: string;
  pin?: string;
  pinCreatedAt?: string;
  pinChanged?: boolean;
}

// Map Firestore doc to native Employee type
export function mapUsuarioToEmployee(usuario: UsuarioDoc): any {
  return {
    id: usuario.uid,
    name: usuario.nomeCompleto,
    role: usuario.perfil, // E.g. "Administrador", "Gerente", "Supervisor", "Caixa", etc.
    contact: usuario.telefone || "",
    salary: 22000,
    admissionDate: usuario.dataCriacao ? (typeof usuario.dataCriacao === "string" ? usuario.dataCriacao.split('T')[0] : new Date().toISOString().split('T')[0]) : new Date().toISOString().split('T')[0],
    status: usuario.estado === "Ativo" ? "ACTIVE" : "INACTIVE",
    email: usuario.email || "",
    username: usuario.username || "",
    pin: usuario.pin || "",
    pinCreatedAt: usuario.pinCreatedAt || "",
    pinChanged: usuario.pinChanged !== undefined ? usuario.pinChanged : true
  };
}

// Fetch all registered users from Firestore to synchronize with local staff list
export const getUsuariosFromFirestore = async (): Promise<any[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, "usuarios"));
    const list: any[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data() as UsuarioDoc;
      if (data && data.uid) {
        list.push(mapUsuarioToEmployee(data));
      }
    });
    return list;
  } catch (error) {
    console.error("Error getting users from Firestore:", error);
    return [];
  }
};

// Standard Sign-up
export const signUpWithEmail = async (
  email: string,
  password: string,
  nomeCompleto: string,
  empresa: string,
  perfil: string = "Caixa"
): Promise<any> => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    const userProfile: UsuarioDoc = {
      uid: user.uid,
      nomeCompleto,
      email,
      empresa,
      perfil,
      cargo: perfil,
      estado: "Ativo",
      fotoPerfil: "",
      telefone: "",
      ultimoLogin: new Date().toISOString(), // Use local ISO string to avoid serverTimestamp quota write errors if possible
      dataCriacao: new Date().toISOString()
    };

    // Save profile to Firestore usuarios collection
    if (!isCircuitBroken()) {
      try {
        await setDoc(doc(db, "usuarios", user.uid), sanitizeForFirestore(userProfile));
      } catch (fsErr: any) {
        console.warn("Could not save profile to Firestore (probably quota exceeded):", fsErr);
        checkAndNotifyQuota(fsErr);
      }
    }
    
    // Log user creation
    if (!isCircuitBroken()) {
      try {
        const logId = `log-register-${Date.now()}`;
        await setDoc(doc(db, "logs", logId), sanitizeForFirestore({
          id: logId,
          userId: user.uid,
          userName: nomeCompleto,
          action: "Cadastro efetuado",
          module: "AUTENTICAÇÃO",
          details: `Utilizador ${nomeCompleto} registou-se no ERP.`,
          timestamp: new Date().toISOString()
        }));
      } catch (logErr: any) {
        console.warn("Failed to write initial security log:", logErr);
        checkAndNotifyQuota(logErr);
      }
    }

    return mapUsuarioToEmployee(userProfile);
  } catch (error: any) {
    const isOperationNotAllowed = error?.code === "auth/operation-not-allowed" || 
                                  error?.message?.includes("operation-not-allowed") ||
                                  error?.message?.includes("auth/operation-not-allowed");

    if (isOperationNotAllowed) {
      console.warn("[AUTH FALLBACK] Email/Password provider is disabled in Firebase Console. Falling back to local/simulated account creation.");
      
      // 1. Fetch current employees list from local DB store via API
      let employees: any[] = [];
      try {
        const dbResponse = await fetch("/api/db/load");
        const dbJson = await dbResponse.json();
        if (dbJson.success && dbJson.data && dbJson.data.employees) {
          employees = dbJson.data.employees;
        }
      } catch (e) {
        console.warn("Could not load employees for fallback:", e);
      }

      // 2. Check if email already in use
      const exists = employees.some(emp => emp.email?.toLowerCase() === email.toLowerCase());
      if (exists) {
        throw new Error("Este endereço de e-mail já está associado a outra conta.");
      }

      // 3. Create simulated employee object
      const simId = `emp-sim-${Date.now()}`;
      
      // Generate a username based on full name
      const cleanName = nomeCompleto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const parts = cleanName.split(/\s+/).filter(Boolean);
      let proposedUsername = parts[0] || "user";
      if (parts.length > 1) {
        proposedUsername = parts[0][0] + parts[parts.length - 1];
      }
      // Ensure unique username
      let finalUsername = proposedUsername;
      let counter = 1;
      while (employees.some(emp => emp.username === finalUsername)) {
        finalUsername = proposedUsername + counter;
        counter++;
      }

      // Generate initial 6-digit PIN
      const initialPinNum = Math.floor(100000 + Math.random() * 900000);
      const formattedPin = String(initialPinNum);

      const newEmployee = {
        id: simId,
        name: nomeCompleto,
        role: perfil,
        contact: "",
        salary: 22000,
        admissionDate: new Date().toISOString().split('T')[0],
        status: "ACTIVE" as const,
        pin: formattedPin,
        email: email,
        username: finalUsername,
        pinCreatedAt: new Date().toISOString(),
        pinChanged: false, // Force them to change PIN upon first login
        password: password // Store the password for local/simulated email logins
      };

      // 4. Save the updated employees list to the server/local database file
      const updatedEmployees = [...employees, newEmployee];
      try {
        await fetch("/api/db/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            table: "employees",
            data: updatedEmployees
          })
        });
      } catch (saveErr) {
        console.error("Failed to save updated employees list in fallback:", saveErr);
      }

      // 5. Optionally also save user to Firestore "usuarios" collection if firestore is working but only auth provider is disabled!
      const userProfile: UsuarioDoc = {
        uid: simId,
        nomeCompleto,
        email,
        empresa,
        perfil,
        cargo: perfil,
        estado: "Ativo",
        fotoPerfil: "",
        telefone: "",
        ultimoLogin: new Date().toISOString(),
        dataCriacao: new Date().toISOString(),
        username: finalUsername,
        pin: formattedPin,
        pinCreatedAt: new Date().toISOString(),
        pinChanged: false
      };

      if (!isCircuitBroken()) {
        try {
          await setDoc(doc(db, "usuarios", simId), sanitizeForFirestore(userProfile));
        } catch (fsErr) {
          console.warn("Could not save fallback profile to Firestore (probably quota exceeded or network issue):", fsErr);
        }
      }

      return newEmployee;
    }

    console.error("Sign up error:", error);
    checkAndNotifyQuota(error);
    throw error;
  }
};

// Standard Sign-in
export const signInWithEmail = async (email: string, password: string): Promise<any> => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Retrieve Firestore profile with try/catch fallback
    let profile: UsuarioDoc;
    try {
      const userDocRef = doc(db, "usuarios", user.uid);
      const docSnap = await getDoc(userDocRef);

      if (docSnap.exists()) {
        profile = docSnap.data() as UsuarioDoc;
      } else {
        throw new Error("Perfil de utilizador não encontrado no Firestore.");
      }
    } catch (getErr: any) {
      console.warn("Could not retrieve user profile from Firestore (using local fallback profile):", getErr);
      checkAndNotifyQuota(getErr);
      profile = {
        uid: user.uid,
        nomeCompleto: user.displayName || email.split("@")[0] || "Operador",
        email: user.email || email,
        empresa: "OST Comércio Geral",
        perfil: "Caixa",
        cargo: "Operador",
        estado: "Ativo",
        fotoPerfil: "",
        telefone: "",
        ultimoLogin: new Date().toISOString(),
        dataCriacao: new Date().toISOString()
      };
    }

    if (profile.estado === "Inativo") {
      await auth.signOut();
      throw new Error("Utilizador desativado. Contacte o Administrador.");
    }

    // Update ultimoLogin timestamp
    if (!isCircuitBroken()) {
      try {
        const userDocRef = doc(db, "usuarios", user.uid);
        await updateDoc(userDocRef, {
          ultimoLogin: new Date().toISOString()
        });
      } catch (updateErr: any) {
        console.warn("Could not update last login timestamp on Firestore:", updateErr);
        checkAndNotifyQuota(updateErr);
      }
    }

    // Log login success
    if (!isCircuitBroken()) {
      try {
        const logId = `log-login-${Date.now()}`;
        await setDoc(doc(db, "logs", logId), sanitizeForFirestore({
          id: logId,
          userId: user.uid,
          userName: profile.nomeCompleto,
          action: "Login efetuado",
          module: "AUTENTICAÇÃO",
          details: `Login de ${profile.nomeCompleto} via E-mail efetuado com sucesso.`,
          timestamp: new Date().toISOString()
        }));
      } catch (logErr: any) {
        console.warn("Failed to write login audit log:", logErr);
        checkAndNotifyQuota(logErr);
      }
    }

    return { employee: mapUsuarioToEmployee(profile), branch: profile.empresa };
  } catch (error: any) {
    const isOperationNotAllowed = error?.code === "auth/operation-not-allowed" || 
                                  error?.message?.includes("operation-not-allowed") ||
                                  error?.message?.includes("auth/operation-not-allowed");

    if (isOperationNotAllowed || error?.code === "auth/user-not-found" || error?.message?.includes("user-not-found")) {
      console.warn("[AUTH FALLBACK] Falling back to checking local/simulated account list.");

      // 1. Fetch current employees list from local DB store via API
      let employees: any[] = [];
      try {
        const dbResponse = await fetch("/api/db/load");
        const dbJson = await dbResponse.json();
        if (dbJson.success && dbJson.data && dbJson.data.employees) {
          employees = dbJson.data.employees;
        }
      } catch (e) {
        console.warn("Could not load employees for fallback sign-in:", e);
      }

      // 2. Find employee matching email & password
      const matchedEmployee = employees.find(
        emp => emp.email?.toLowerCase() === email.toLowerCase() && emp.password === password
      );

      if (matchedEmployee) {
        if (matchedEmployee.status === "INACTIVE" || matchedEmployee.status === "SUSPENDED") {
          throw new Error("Utilizador desativado. Contacte o Administrador.");
        }
        if (matchedEmployee.status === "BLOCKED") {
          throw new Error("A sua conta está BLOQUEADA por tempo expirado do PIN temporário ou suspensão de segurança.");
        }

        return { employee: matchedEmployee, branch: "OST Comércio Geral" };
      }
    }

    console.error("Sign in error:", error);
    checkAndNotifyQuota(error);
    // Log login failure
    if (!isCircuitBroken()) {
      try {
        const logId = `log-fail-${Date.now()}`;
        await setDoc(doc(db, "logs", logId), sanitizeForFirestore({
          id: logId,
          action: "Falha de Login",
          module: "AUTENTICAÇÃO",
          details: `Tentativa falhada de login para ${email}: ${error instanceof Error ? error.message : String(error)}`,
          timestamp: new Date().toISOString()
        }));
      } catch (logErr: any) {
        console.warn("Failed to log login failure:", logErr);
        checkAndNotifyQuota(logErr);
      }
    }
    throw error;
  }
};

// Password recovery
export const recoverPassword = async (email: string): Promise<void> => {
  try {
    await sendPasswordResetEmail(auth, email);
    
    // Log password recovery trigger
    if (!isCircuitBroken()) {
      try {
        const logId = `log-recovery-${Date.now()}`;
        await setDoc(doc(db, "logs", logId), sanitizeForFirestore({
          id: logId,
          action: "Recuperação de Senha",
          module: "AUTENTICAÇÃO",
          details: `Solicitado link de recuperação para o e-mail: ${email}`,
          timestamp: new Date().toISOString()
        }));
      } catch (logErr: any) {
        console.warn("Failed to log password recovery request:", logErr);
        checkAndNotifyQuota(logErr);
      }
    }
  } catch (error) {
    console.error("Password recovery error:", error);
    checkAndNotifyQuota(error);
    throw error;
  }
};

// Google sign-in and profile synchronization
export const googleSignInAndSync = async (defaultBranch: string = "OST Comércio Geral", employeesList: any[] = []): Promise<any> => {
  try {
    const signInResult = await googleSignIn();
    if (!signInResult) return null;

    const { user } = signInResult;
    const googleEmail = user.email?.toLowerCase().trim();
    if (!googleEmail) {
      await auth.signOut();
      throw new Error("Não foi possível obter o endereço de e-mail da sua conta Google.");
    }

    // 1. Validate e-mail exists in Firestore "usuarios" collection
    let existingProfileInFirestore: UsuarioDoc | null = null;
    let existingDocId: string | null = null;
    try {
      const querySnapshot = await getDocs(collection(db, "usuarios"));
      querySnapshot.forEach((docSnap) => {
        const d = docSnap.data() as UsuarioDoc;
        if (d.email && d.email.toLowerCase().trim() === googleEmail) {
          existingProfileInFirestore = d;
          existingDocId = docSnap.id;
        }
      });
    } catch (e) {
      console.warn("Erro ao ler coleção 'usuarios' do Firestore para validar e-mail:", e);
    }

    const matchedEmp = employeesList.find(emp => emp.email?.toLowerCase().trim() === googleEmail);

    // If email is not found in either Firestore or the local/mock employees list, deny access!
    if (!existingProfileInFirestore && !matchedEmp) {
      await auth.signOut();
      throw new Error(`O e-mail do Google (${user.email}) não está cadastrado ou autorizado no sistema. Por favor, solicite o seu cadastro ao Administrador.`);
    }

    let profile: UsuarioDoc;
    const userDocRef = doc(db, "usuarios", user.uid);

    if (existingProfileInFirestore) {
      const currentProfile = existingProfileInFirestore as UsuarioDoc;
      if (currentProfile.estado === "Inativo") {
        await auth.signOut();
        throw new Error("Utilizador desativado. Contacte o Administrador.");
      }

      // Prepare updated profile
      profile = {
        ...currentProfile,
        uid: user.uid, // Ensure bound to Google user UID
        fotoPerfil: user.photoURL || currentProfile.fotoPerfil || "",
        ultimoLogin: new Date().toISOString()
      };

      // Enrich missing credentials if matched employee has them
      if (matchedEmp && (!profile.username || !profile.pin)) {
        profile.username = profile.username || matchedEmp.username || "";
        profile.pin = profile.pin || matchedEmp.pin || "";
        profile.pinCreatedAt = profile.pinCreatedAt || matchedEmp.pinCreatedAt || "";
        profile.pinChanged = profile.pinChanged !== undefined ? profile.pinChanged : (matchedEmp.pinChanged !== undefined ? matchedEmp.pinChanged : true);
      }

      // Write updated document matching the Google UID
      if (!isCircuitBroken()) {
        try {
          await setDoc(userDocRef, sanitizeForFirestore(profile));
          // If the old document was stored under a different ID/UID, clean it up
          if (existingDocId && existingDocId !== user.uid) {
            await deleteDoc(doc(db, "usuarios", existingDocId));
          }
        } catch (setErr) {
          console.warn("Falha ao atualizar UID do Google em Firestore:", setErr);
        }
      }
    } else if (matchedEmp) {
      // Create a brand new Firestore document for an existing authorized employee
      profile = {
        uid: user.uid,
        nomeCompleto: matchedEmp.name,
        email: matchedEmp.email || user.email || "",
        empresa: defaultBranch,
        perfil: matchedEmp.role,
        cargo: matchedEmp.role,
        estado: matchedEmp.status === "ACTIVE" ? "Ativo" : "Inativo",
        fotoPerfil: user.photoURL || "",
        telefone: matchedEmp.contact || "",
        ultimoLogin: new Date().toISOString(),
        dataCriacao: matchedEmp.admissionDate ? new Date(matchedEmp.admissionDate).toISOString() : new Date().toISOString(),
        username: matchedEmp.username || "",
        pin: matchedEmp.pin || "",
        pinCreatedAt: matchedEmp.pinCreatedAt || "",
        pinChanged: matchedEmp.pinChanged !== undefined ? matchedEmp.pinChanged : true
      };

      if (profile.estado === "Inativo") {
        await auth.signOut();
        throw new Error("Utilizador desativado. Contacte o Administrador.");
      }

      if (!isCircuitBroken()) {
        try {
          await setDoc(userDocRef, sanitizeForFirestore(profile));
        } catch (setErr) {
          console.warn("Falha ao criar perfil inicial via Google em Firestore:", setErr);
        }
      }
    } else {
      await auth.signOut();
      throw new Error("Erro de integridade de dados ao validar utilizador.");
    }

    // Log login success
    if (!isCircuitBroken()) {
      try {
        const logId = `log-glogin-${Date.now()}`;
        await setDoc(doc(db, "logs", logId), sanitizeForFirestore({
          id: logId,
          userId: user.uid,
          userName: profile.nomeCompleto,
          action: "Login com Google",
          module: "AUTENTICAÇÃO",
          details: `Login de ${profile.nomeCompleto} com Google efetuado com sucesso após validação de e-mail no Firestore.`,
          timestamp: new Date().toISOString()
        }));
      } catch (logErr: any) {
        console.warn("Failed to write Google login audit log:", logErr);
        checkAndNotifyQuota(logErr);
      }
    }

    return { employee: mapUsuarioToEmployee(profile), branch: profile.empresa };
  } catch (error) {
    console.error("Google Sign-In & Sync Error:", error);
    checkAndNotifyQuota(error);
    throw error;
  }
};

// --- PRODUCTS (PRODUTOS) FIRESTORE CRUD ACTIONS ---

// Fetch all products from Firestore
export const getProdutosFromFirestore = async (): Promise<any[]> => {
  const path = "produtos";
  try {
    const querySnapshot = await getDocs(collection(db, path));
    const list: any[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      list.push({ ...data, id: docSnap.id });
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return [];
  }
};

// Add product to Firestore
export const addProdutoToFirestore = async (product: any): Promise<void> => {
  const path = `produtos/${product.id}`;
  if (isCircuitBroken()) {
    throw new Error("RESOURCE_EXHAUSTED: Firestore write cota excedida (circuito interrompido).");
  }
  try {
    await setDoc(doc(db, "produtos", product.id), sanitizeForFirestore(product));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

// Update product in Firestore
export const updateProdutoInFirestore = async (productId: string, updatedFields: any): Promise<void> => {
  const path = `produtos/${productId}`;
  if (isCircuitBroken()) {
    throw new Error("RESOURCE_EXHAUSTED: Firestore write cota excedida (circuito interrompido).");
  }
  try {
    await updateDoc(doc(db, "produtos", productId), sanitizeForFirestore(updatedFields));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

// Delete product from Firestore
export const deleteProdutoFromFirestore = async (productId: string): Promise<void> => {
  const path = `produtos/${productId}`;
  if (isCircuitBroken()) {
    throw new Error("RESOURCE_EXHAUSTED: Firestore write cota excedida (circuito interrompido).");
  }
  try {
    await deleteDoc(doc(db, "produtos", productId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

// --- TRANSACTIONS (TRANSACOES) FIRESTORE CRUD ACTIONS ---

// Fetch all transactions from Firestore
export const getTransacoesFromFirestore = async (): Promise<any[]> => {
  const path = "transacoes";
  try {
    const querySnapshot = await getDocs(collection(db, path));
    const list: any[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      list.push({ ...data, id: docSnap.id });
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return [];
  }
};

// Add transaction to Firestore
export const addTransacaoToFirestore = async (transaction: any): Promise<void> => {
  const path = `transacoes/${transaction.id}`;
  if (isCircuitBroken()) {
    throw new Error("RESOURCE_EXHAUSTED: Firestore write cota excedida (circuito interrompido).");
  }
  try {
    await setDoc(doc(db, "transacoes", transaction.id), sanitizeForFirestore(transaction));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

// --- REAL-TIME PRODUCTS & STOCK LISTENER SUBSCRIPTION ---

export const subscribeToProdutos = (
  onUpdate: (products: any[]) => void,
  onError: (error: any) => void
) => {
  const path = "produtos";
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ ...docSnap.data(), id: docSnap.id });
      });
      onUpdate(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (e: any) {
        onError(e);
      }
    }
  );
};

// --- GOOGLE CLOUD SQL RELATIONAL DATABASE INTERFACING LOGIC ---

/**
 * Checks the availability and active connection status of the Google Cloud SQL database.
 */
export const checkCloudSqlStatus = async (): Promise<{
  success: boolean;
  available: boolean;
  connected: boolean;
  message: string;
  error?: string;
}> => {
  try {
    const response = await fetch("/api/sql/status");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (err: any) {
    console.error("Error checking Google Cloud SQL status:", err);
    return {
      success: false,
      available: false,
      connected: false,
      message: "Connection failed to backend Cloud SQL route handler.",
      error: err.message
    };
  }
};

/**
 * Syncs Firestore/Local JSON application state into structured Google Cloud SQL relational tables.
 */
export const syncToCloudSql = async (): Promise<{
  success: boolean;
  message: string;
  stats?: any;
  error?: string;
}> => {
  try {
    const response = await fetch("/api/sql/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (err: any) {
    console.error("Failed to trigger Cloud SQL structured synchronization:", err);
    return {
      success: false,
      message: "Relational synchronization request failed.",
      error: err.message
    };
  }
};

/**
 * Fetches all products stored in structured Google Cloud SQL relational tables.
 */
export const getProductsFromCloudSQL = async (): Promise<any[]> => {
  try {
    const response = await fetch("/api/sql/products");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    return result.success ? result.data : [];
  } catch (err: any) {
    console.error("Failed to query products from Cloud SQL:", err);
    return [];
  }
};

/**
 * Saves a product into Google Cloud SQL using the relational upsert logic.
 */
export const addProductToCloudSQL = async (product: any): Promise<boolean> => {
  try {
    const response = await fetch("/api/sql/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(product)
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    return !!result.success;
  } catch (err: any) {
    console.error("Failed to save product in structured Cloud SQL:", err);
    return false;
  }
};

/**
 * Deletes a product from the Google Cloud SQL relational table.
 */
export const deleteProductFromCloudSQL = async (productId: string): Promise<boolean> => {
  try {
    const response = await fetch(`/api/sql/products/${productId}`, {
      method: "DELETE"
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    return !!result.success;
  } catch (err: any) {
    console.error("Failed to delete product from structured Cloud SQL:", err);
    return false;
  }
};

/**
 * Fetches all customers from Google Cloud SQL.
 */
export const getCustomersFromCloudSQL = async (): Promise<any[]> => {
  try {
    const response = await fetch("/api/sql/customers");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    return result.success ? result.data : [];
  } catch (err: any) {
    console.error("Failed to query customers from Cloud SQL:", err);
    return [];
  }
};

/**
 * Saves a customer into Google Cloud SQL using relational upsert.
 */
export const addCustomerToCloudSQL = async (customer: any): Promise<boolean> => {
  try {
    const response = await fetch("/api/sql/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(customer)
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    return !!result.success;
  } catch (err: any) {
    console.error("Failed to save customer in Cloud SQL:", err);
    return false;
  }
};

/**
 * Fetches all transactions from Google Cloud SQL relational tables.
 */
export const getTransactionsFromCloudSQL = async (): Promise<any[]> => {
  try {
    const response = await fetch("/api/sql/transactions");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    return result.success ? result.data : [];
  } catch (err: any) {
    console.error("Failed to query transactions from Cloud SQL:", err);
    return [];
  }
};

/**
 * Saves a transaction in Google Cloud SQL with relational data safety.
 */
export const addTransactionToCloudSQL = async (transaction: any): Promise<boolean> => {
  try {
    const response = await fetch("/api/sql/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(transaction)
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    return !!result.success;
  } catch (err: any) {
    console.error("Failed to save transaction in structured Cloud SQL:", err);
    return false;
  }
};

/**
 * Fetches security and audit logs from Google Cloud SQL relational tables.
 */
export const getAuditLogsFromCloudSQL = async (): Promise<any[]> => {
  try {
    const response = await fetch("/api/sql/auditlogs");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    return result.success ? result.data : [];
  } catch (err: any) {
    console.error("Failed to query audit logs from Cloud SQL:", err);
    return [];
  }
};

/**
 * Saves a security audit log into Google Cloud SQL relational audit trail.
 */
export const addAuditLogToCloudSQL = async (log: any): Promise<boolean> => {
  try {
    const response = await fetch("/api/sql/auditlogs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(log)
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    return !!result.success;
  } catch (err: any) {
    console.error("Failed to save audit log in Cloud SQL:", err);
    return false;
  }
};

/**
 * Fetches security, login, and error logs from Firestore "logs" collection.
 */
export const getLogsFromFirestore = async (): Promise<any[]> => {
  const path = "logs";
  try {
    const querySnapshot = await getDocs(collection(db, path));
    const list: any[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      list.push({ ...data, id: docSnap.id });
    });
    // Sort by timestamp descending
    list.sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeB - timeA;
    });
    return list;
  } catch (error) {
    console.error("Failed to fetch logs from Firestore:", error);
    return [];
  }
};


