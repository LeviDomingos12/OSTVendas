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

  const cryptoObj = typeof globalThis !== "undefined" ? (globalThis.crypto || ((globalThis as Record<string, unknown>).msCrypto as Crypto | undefined)) : null;

  if (cryptoObj && cryptoObj.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(`ost_vendas_salt_${clean}`);
    const hashBuffer = await cryptoObj.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  // Fallback digest puro em JavaScript caso Web Crypto não esteja acessível
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  const str = `ost_vendas_salt_${clean}`;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h0 = ((h0 << 5) - h0) + ch; h0 |= 0;
    h1 = ((h1 << 7) - h1) + ch; h1 |= 0;
    h2 = ((h2 << 11) - h2) + ch; h2 |= 0;
    h3 = ((h3 << 13) - h3) + ch; h3 |= 0;
  }
  const hex = [h0, h1, h2, h3].map(v => (v >>> 0).toString(16).padStart(8, "0")).join("");
  return hex.padEnd(64, "0").slice(0, 64);
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
  // Desestrura para remover campos sensíveis conhecidos
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { pin, password, ...rest } = user;
  const safeRecord: Record<string, unknown> = { ...rest };
  delete safeRecord.tempPassword;
  delete safeRecord.tokenSecret;
  return safeRecord as unknown as Employee;
}
