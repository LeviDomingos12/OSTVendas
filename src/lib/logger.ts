type LogCallback = (action: string, module: string, details: string) => void;

let logCallback: LogCallback | null = null;
const pendingLogs: { action: string; module: string; details: string }[] = [];
let isLogging = false;
let lastLogTimestamp = 0;
const MAX_PENDING_LOGS = 20;

export function setLogCallback(callback: LogCallback) {
  logCallback = callback;
  if (pendingLogs.length > 0 && !isLogging) {
    isLogging = true;
    try {
      const logsToFlush = [...pendingLogs];
      pendingLogs.length = 0;
      setTimeout(() => {
        logsToFlush.forEach(log => {
          try {
            callback(log.action, log.module, log.details);
          } catch {
            // Prevent error escalation
          }
        });
      }, 0);
    } finally {
      isLogging = false;
    }
  }
}

export function logErrorToSystem(action: string, details: string) {
  // Throttle error logging to at most 1 per 2 seconds to avoid CPU/RAM saturation
  const now = Date.now();
  if (now - lastLogTimestamp < 2000) return;
  lastLogTimestamp = now;

  if (isLogging) return;
  isLogging = true;
  try {
    if (logCallback) {
      setTimeout(() => {
        try {
          if (logCallback) logCallback(action, "Erros do Sistema", details);
        } catch {}
      }, 0);
    } else {
      if (pendingLogs.length < MAX_PENDING_LOGS) {
        pendingLogs.push({ action, module: "Erros do Sistema", details });
      }
    }
  } catch {
    // Suppress errors within logger itself
  } finally {
    isLogging = false;
  }
}

export function initErrorCapturing() {
  if (typeof window === "undefined") return () => {};

  const handleGlobalError = (event: ErrorEvent) => {
    if (!event || !event.message) return;
    const message = event.message || "Erro desconhecido";
    // Ignorar avisos benignos do Vite/HMR e de redimensionamento
    if (message.includes("websocket") || message.includes("ResizeObserver") || message.includes("Script error")) return;
    logErrorToSystem("ERRO_FATAL", message.substring(0, 180));
  };

  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    if (!event || !event.reason) return;
    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : String(reason);
    if (message.includes("AbortError") || message.includes("Failed to fetch") || message.includes("NetworkError")) return;
    logErrorToSystem("PROMESSA_REJEITADA", message.substring(0, 180));
  };

  window.addEventListener("error", handleGlobalError);
  window.addEventListener("unhandledrejection", handleUnhandledRejection);

  return () => {
    window.removeEventListener("error", handleGlobalError);
    window.removeEventListener("unhandledrejection", handleUnhandledRejection);
  };
}
