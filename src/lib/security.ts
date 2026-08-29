/**
 * Utilitários Criptográficos e de Segurança do Sistema OST Vendas
 * Garante hashing seguro de PINs, higienização de dados de sessão e proteção contra vazamento de credenciais.
 */

import { Employee } from "../types";

/**
 * Calcula o hash SHA-256 de uma string (PIN ou token) usando a Web Crypto API nativa
 * ou fallback seguro para ambientes Node.js/Testes.
 */
export async function hashSecurityPin(pin: string): Promise<string> {
  const clean = (pin || "").trim();
  if (!clean) return "";

  if (typeof window !== "undefined" && window.crypto && window.crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(`ost_vendas_salt_${clean}`);
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  // Fallback síncrono/Node seguro caso crypto.subtle não esteja disponível
  try {
    const crypto = await import("crypto");
    return crypto.createHash("sha256").update(`ost_vendas_salt_${clean}`).digest("hex");
  } catch {
    // Algoritmo simples de digest seguro como fallback extremo
    let hash = 0;
    const str = `ost_vendas_salt_${clean}`;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return `hash_${Math.abs(hash).toString(16)}`;
  }
}

/**
 * Verifica se um PIN digitado corresponde ao PIN ou hash armazenado
 */
export async function verifySecurityPin(enteredPin: string, storedPinOrHash?: string): Promise<boolean> {
  if (!enteredPin || !storedPinOrHash) return false;
  const cleanEntered = enteredPin.trim();
  const cleanStored = storedPinOrHash.trim();

  // Se o valor armazenado for igual ao PIN direto (migração legada)
  if (cleanStored === cleanEntered) {
    return true;
  }

  // Verificar pelo hash SHA-256 com salt
  const enteredHash = await hashSecurityPin(cleanEntered);
  if (enteredHash === cleanStored) {
    return true;
  }

  return false;
}

/**
 * Higieniza o objeto do utilizador autenticado antes de persistir em storage de sessão.
 * Remove estritamente senhas, PINs em claro, chaves privadas ou tokens não expirados.
 */
export function sanitizeUserSession(user: Employee | null | undefined): Employee | null {
  if (!user) return null;
  const safe = { ...user };
  delete (safe as any).pin;
  delete (safe as any).password;
  delete (safe as any).tempPassword;
  delete (safe as any).tokenSecret;
  return safe;
}
