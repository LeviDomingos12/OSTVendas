import { AuditLog, UserRole } from "../types";

type LogCallback = (action: string, module: string, details: string) => void;

let logCallback: LogCallback | null = null;
const pendingLogs: { action: string; module: string; details: string }[] = [];

export function setLogCallback(callback: LogCallback) {
  logCallback = callback;
  if (pendingLogs.length > 0) {
    console.log(`[LOGGER] Descarregando ${pendingLogs.length} erros pendentes...`);
    const logsToFlush = [...pendingLogs];
    pendingLogs.length = 0;
    logsToFlush.forEach(log => {
      callback(log.action, log.module, log.details);
    });
  }
}

export function logErrorToSystem(action: string, details: string) {
  if (logCallback) {
    logCallback(action, "Erros do Sistema", details);
  } else {
    pendingLogs.push({ action, module: "Erros do Sistema", details });
  }
}

export function initErrorCapturing() {
  if (typeof window === "undefined") return;

  const handleGlobalError = (event: ErrorEvent) => {
    const error = event.error;
    const message = error?.message || event.message || "Erro desconhecido";
    const stack = error?.stack ? error.stack.split("\n").slice(0, 3).join(" | ") : "";
    const file = event.filename ? ` em ${event.filename.split("/").pop()}:${event.lineno}:${event.colno}` : "";
    
    logErrorToSystem("ERRO_SILENCIOSO", `${message}${file} | Stack: ${stack}`);
  };

  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error && reason.stack ? reason.stack.split("\n").slice(0, 3).join(" | ") : "";
    
    logErrorToSystem("PROMESSA_REJEITADA", `Rejeição de promessa: ${message} | Stack: ${stack}`);
  };

  // Safe Monkey-Patch console.error to intercept and log silent errors
  const originalConsoleError = console.error;
  let isReporting = false;

  console.error = (...args: any[]) => {
    originalConsoleError.apply(console, args);

    if (isReporting) return;
    isReporting = true;
    try {
      const message = args
        .map(arg => {
          if (arg instanceof Error) return `${arg.message} | Stack: ${arg.stack?.split("\n").slice(0, 2).join(" | ")}`;
          if (typeof arg === "object") {
            try { return JSON.stringify(arg); } catch { return String(arg); }
          }
          return String(arg);
        })
        .join(" ");

      // Ignore standard benign warnings or websockets, but log actual functional errors
      if (
        message &&
        !message.includes("websocket") && 
        !message.includes("HMR") &&
        !message.includes("Vite") &&
        !message.includes("color-scheme") &&
        !message.includes("Google Maps") &&
        !message.includes("react-dom")
      ) {
        logErrorToSystem("CONSOLA_ERRO", message.substring(0, 250));
      }
    } catch (e) {
      // Avoid breaking anything
    } finally {
      isReporting = false;
    }
  };

  // Monkey-Patch window.fetch to automatically log any failed API or network calls under "Erros do Sistema"
  const originalFetch = window.fetch;
  let fetchPatched = false;

  try {
    const wrappedFetch = async function(...args: any[]) {
      try {
        const response = await originalFetch.apply(window, args as any);
        if (!response.ok) {
          const url = typeof args[0] === 'string' ? args[0] : args[0] instanceof URL ? args[0].href : (args[0] as any)?.url || 'Desconhecido';
          // Avoid logging ipify/external telemetry errors unless they actually matter
          if (!url.includes("ipify.org")) {
            logErrorToSystem(
              "FALHA_API",
              `API respondeu com status ${response.status} (${response.statusText}) ao acessar a rota: ${url}`
            );
          }
        }
        return response;
      } catch (error: any) {
        const url = typeof args[0] === 'string' ? args[0] : args[0] instanceof URL ? args[0].href : (args[0] as any)?.url || 'Desconhecido';
        if (!url.includes("ipify.org")) {
          logErrorToSystem(
            "FALHA_REDE",
            `Falha de conexão com a rede ao acessar ${url}. Erro: ${error.message || error}`
          );
        }
        throw error;
      }
    };

    Object.defineProperty(window, "fetch", {
      value: wrappedFetch,
      configurable: true,
      writable: true,
      enumerable: true
    });
    fetchPatched = true;
  } catch (err) {
    console.warn("[LOGGER] Não foi possível interceptar window.fetch por restrições do navegador:", err);
  }

  window.addEventListener("error", handleGlobalError);
  window.addEventListener("unhandledrejection", handleUnhandledRejection);

  console.log("[LOGGER] Captura de erros em tempo real inicializada com sucesso!");
  
  return () => {
    window.removeEventListener("error", handleGlobalError);
    window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    console.error = originalConsoleError;
    if (fetchPatched) {
      try {
        Object.defineProperty(window, "fetch", {
          value: originalFetch,
          configurable: true,
          writable: true,
          enumerable: true
        });
      } catch (e) {
        // Ignored
      }
    }
  };
}
