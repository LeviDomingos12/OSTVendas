export const checkPasswordStrength = (password: string) => {
  if (!password) return { score: 0, label: "Sem senha", color: "bg-slate-300", isValidAdmin: false };

  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  else if (/[a-zA-Z]/.test(password)) score += 0.5;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;

  let label = "Fraca";
  let color = "bg-rose-500";

  if (score >= 3.5) {
    label = "Muito Forte";
    color = "bg-emerald-500";
  } else if (score >= 2.5) {
    label = "Forte";
    color = "bg-green-500";
  } else if (score >= 1.5) {
    label = "Média";
    color = "bg-amber-500";
  } else {
    label = "Fraca";
    color = "bg-rose-500";
  }

  // Admin requirement: minimum 8 characters with at least letters and numbers
  const isValidAdmin = password.length >= 8 && /[a-zA-Z]/.test(password) && /[0-9]/.test(password);

  return { score, label, color, isValidAdmin };
};

export const getBase64ImageFromUrl = async (imageUrl: string): Promise<string> => {
  try {
    const res = await fetch(imageUrl);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.error("Error loading logo for PDF:", err);
    return "";
  }
};

export const generateSuggestedUsername = (fullName: string, phoneContact: string = ""): string => {
  const nameParts = fullName.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, " ").split(/\s+/).filter(Boolean);
  let letters = "";
  if (nameParts.length === 0) {
    letters = "user";
  } else if (nameParts.length === 1) {
    const namePart = nameParts[0];
    letters = namePart.padEnd(4, "x").slice(0, 4);
  } else {
    const firstName = nameParts[0];
    const lastName = nameParts[nameParts.length - 1];
    
    let firstPart = firstName.slice(0, 2);
    let lastPart = lastName.slice(0, 2);
    
    if (firstPart.length < 2) {
      lastPart = lastName.slice(0, 4 - firstPart.length);
    }
    if (lastPart.length < 2) {
      firstPart = firstName.slice(0, 4 - lastPart.length);
    }
    
    let combined = firstPart + lastPart;
    if (combined.length < 4) {
      for (let i = 1; i < nameParts.length - 1 && combined.length < 4; i++) {
        combined += nameParts[i].slice(0, 4 - combined.length);
      }
    }
    if (combined.length < 4) {
      combined = combined.padEnd(4, "x");
    }
    letters = combined.slice(0, 4);
  }

  const digits = phoneContact.replace(/\D/g, "");
  let numbers = "";
  if (digits.length < 3) {
    numbers = digits.padEnd(3, "0").slice(0, 3);
  } else {
    numbers = digits.slice(-3);
  }

  return `${letters}${numbers}`;
};

export const translateDatabaseMessage = (details: string | undefined | null): string => {
  const dStr = details || "";
  if (dStr.toLowerCase().includes("permission-denied") || dStr.toLowerCase().includes("permissions") || dStr.toLowerCase().includes("insufficient")) {
    return "Acesso negado ao recurso solicitado (permissões insuficientes de base de dados).";
  }
  if (dStr.toLowerCase().includes("unavailable") || dStr.toLowerCase().includes("network")) {
    return "Banco de dados indisponível temporariamente. Tentando recuperar conexão.";
  }
  return dStr;
};

export const isDatabaseError = (details: string | undefined | null): boolean => {
  const dStr = details || "";
  const lower = dStr.toLowerCase();
  return lower.includes("permission") || lower.includes("insufficient") || lower.includes("database error") || lower.includes("sql error");
};
