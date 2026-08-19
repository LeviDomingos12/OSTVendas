import React, { useState, useEffect, useMemo } from "react";
import { 
  RefreshCw, 
  Cloud, 
  CloudOff, 
  Wifi, 
  WifiOff, 
  Database, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Layers, 
  ArrowUpRight,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Package,
  ShoppingCart,
  Users,
  Wallet,
  FileSpreadsheet,
  Settings
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { measureSupabaseLatency, LatencyResult } from "../../services/supabaseService";

export interface ManualSyncWidgetProps {
  pendingSyncQueue?: Record<string, any>;
  isManualSyncing?: boolean;
  isOnline?: boolean;
  onManualSync?: () => Promise<void> | void;
  theme?: string;
  onShowToast?: (message: string, type: "success" | "error" | "info" | "warning", title?: string) => void;
}

export const ManualSyncWidget: React.FC<ManualSyncWidgetProps> = ({
  pendingSyncQueue = {},
  isManualSyncing = false,
  isOnline = navigator.onLine,
  onManualSync,
  theme = "light",
  onShowToast
}) => {
  const [wasOffline, setWasOffline] = useState<boolean>(!navigator.onLine);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => {
    return localStorage.getItem("pos_last_sync_timestamp") || null;
  });
  const [latencyInfo, setLatencyInfo] = useState<LatencyResult | null>(null);
  const [isCheckingLatency, setIsCheckingLatency] = useState<boolean>(false);

  // Monitor online / offline transitions
  useEffect(() => {
    const handleOnline = () => {
      setWasOffline(true);
      checkNetworkLatency();
    };
    const handleOffline = () => {
      setWasOffline(true);
      setLatencyInfo(null);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial latency check if online
    if (navigator.onLine) {
      checkNetworkLatency();
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Check latency function
  const checkNetworkLatency = async () => {
    if (!navigator.onLine) return;
    setIsCheckingLatency(true);
    try {
      const res = await measureSupabaseLatency();
      setLatencyInfo(res);
    } catch {
      // Non-blocking fallback
    } finally {
      setIsCheckingLatency(false);
    }
  };

  // Calculate detailed pending items breakdown
  const queueStats = useMemo(() => {
    let totalItems = 0;
    const breakdown: { key: string; label: string; count: number; icon: any; color: string }[] = [];

    const keys = Object.keys(pendingSyncQueue);
    for (const key of keys) {
      const val = pendingSyncQueue[key];
      let count = 0;
      if (Array.isArray(val)) {
        count = val.length;
      } else if (val && typeof val === "object") {
        count = Object.keys(val).length || 1;
      } else if (val) {
        count = 1;
      }

      totalItems += count;

      let label = key;
      let icon = Layers;
      let color = "text-indigo-500 bg-indigo-500/10 border-indigo-500/20";

      if (key === "products") {
        label = "Produtos";
        icon = Package;
        color = "text-amber-500 bg-amber-500/10 border-amber-500/20";
      } else if (key === "transactions") {
        label = "Vendas / Faturas";
        icon = ShoppingCart;
        color = "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
      } else if (key === "customers") {
        label = "Clientes";
        icon = Users;
        color = "text-blue-500 bg-blue-500/10 border-blue-500/20";
      } else if (key === "cashflow") {
        label = "Fluxo de Caixa";
        icon = Wallet;
        color = "text-purple-500 bg-purple-500/10 border-purple-500/20";
      } else if (key === "auditlogs") {
        label = "Auditoria";
        icon = FileSpreadsheet;
        color = "text-slate-500 bg-slate-500/10 border-slate-500/20";
      } else if (key === "settings") {
        label = "Definições";
        icon = Settings;
        color = "text-cyan-500 bg-cyan-500/10 border-cyan-500/20";
      }

      breakdown.push({ key, label, count, icon, color });
    }

    return { totalItems, breakdown };
  }, [pendingSyncQueue]);

  // Handle Trigger Manual Sync
  const handleForceSync = async () => {
    if (!isOnline) {
      if (onShowToast) {
        onShowToast("Não é possível sincronizar enquanto estiver offline.", "warning", "Sem Conexão");
      }
      return;
    }

    if (onManualSync) {
      try {
        await onManualSync();
        const nowStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        setLastSyncTime(nowStr);
        localStorage.setItem("pos_last_sync_timestamp", nowStr);
        setWasOffline(false);
        checkNetworkLatency();
      } catch (err: any) {
        console.error("Erro ao sincronizar manualmente:", err);
      }
    }
  };

  const isDark = theme === "night";
  const hasPendingItems = queueStats.totalItems > 0;
  const isOnlineAfterOffline = isOnline && wasOffline && hasPendingItems;

  return (
    <div 
      id="manual-sync-dashboard-widget"
      className={`rounded-3xl border transition-all duration-300 p-5 relative overflow-hidden ${
        isDark 
          ? "bg-slate-900/90 border-slate-800 text-slate-100 shadow-xl shadow-black/20" 
          : "bg-white border-slate-200/80 text-slate-800 shadow-sm"
      } ${
        isOnlineAfterOffline
          ? isDark 
            ? "ring-2 ring-emerald-500/30 border-emerald-500/40" 
            : "ring-2 ring-emerald-500/20 border-emerald-300"
          : hasPendingItems
            ? isDark
              ? "border-amber-500/40"
              : "border-amber-300"
            : ""
      }`}
    >
      {/* Background ambient glow */}
      <div 
        className={`absolute -top-12 -right-12 w-40 h-40 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
          !isOnline 
            ? "bg-rose-500/10" 
            : isOnlineAfterOffline 
              ? "bg-emerald-500/20" 
              : hasPendingItems 
                ? "bg-amber-500/15" 
                : "bg-indigo-500/10"
        }`} 
      />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
        
        {/* Left column: Status & Queue Indicators */}
        <div className="flex items-start gap-4">
          <div 
            className={`p-3.5 rounded-2xl shrink-0 transition-all duration-300 flex items-center justify-center ${
              !isOnline
                ? isDark ? "bg-rose-500/20 text-rose-400" : "bg-rose-100 text-rose-600"
                : isOnlineAfterOffline
                  ? isDark ? "bg-emerald-500/20 text-emerald-400 animate-pulse" : "bg-emerald-100 text-emerald-600 animate-pulse"
                  : hasPendingItems
                    ? isDark ? "bg-amber-500/20 text-amber-400" : "bg-amber-100 text-amber-600"
                    : isDark ? "bg-indigo-500/20 text-indigo-400" : "bg-indigo-50 text-indigo-600"
            }`}
          >
            {!isOnline ? (
              <CloudOff className="w-6 h-6" />
            ) : isManualSyncing ? (
              <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
            ) : isOnlineAfterOffline ? (
              <Cloud className="w-6 h-6 text-emerald-500" />
            ) : hasPendingItems ? (
              <Database className="w-6 h-6 text-amber-500" />
            ) : (
              <ShieldCheck className="w-6 h-6 text-indigo-500" />
            )}
          </div>

          <div className="space-y-1.5 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-extrabold text-base tracking-tight flex items-center gap-2">
                Sincronização em Nuvem
              </h3>

              {/* Status Badges */}
              <div className="flex flex-wrap items-center gap-1.5">
                {/* Online / Offline status badge */}
                <span 
                  id="sync-status-connectivity-badge"
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider ${
                    isOnline
                      ? isDark 
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" 
                        : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : isDark
                        ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                        : "bg-rose-50 text-rose-700 border border-rose-200"
                  }`}
                >
                  {isOnline ? (
                    <>
                      <Wifi className="w-3 h-3 text-emerald-500" />
                      <span>Online</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-3 h-3 text-rose-500" />
                      <span>Offline</span>
                    </>
                  )}
                </span>

                {/* Online-after-offline highlight badge */}
                {isOnlineAfterOffline && (
                  <span 
                    id="sync-status-reconnected-badge"
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      isDark 
                        ? "bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 animate-bounce" 
                        : "bg-emerald-500 text-white shadow-sm shadow-emerald-500/20 animate-bounce"
                    }`}
                  >
                    <ArrowUpRight className="w-3 h-3" />
                    <span>Ligação Restabelecida</span>
                  </span>
                )}

                {/* Latency ping indicator */}
                {isOnline && latencyInfo && (
                  <span 
                    id="sync-status-latency-indicator"
                    title={`Ping: ${latencyInfo.latencyMs}ms`}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      latencyInfo.status === "optimal"
                        ? isDark ? "text-emerald-400 bg-emerald-500/10" : "text-emerald-700 bg-emerald-50"
                        : latencyInfo.status === "good"
                          ? isDark ? "text-blue-400 bg-blue-500/10" : "text-blue-700 bg-blue-50"
                          : isDark ? "text-amber-400 bg-amber-500/10" : "text-amber-700 bg-amber-50"
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />
                    <span>{latencyInfo.latencyMs}ms</span>
                  </span>
                )}
              </div>
            </div>

            {/* Description / Summary message */}
            <p className={`text-xs leading-relaxed max-w-xl ${isDark ? "text-slate-400" : "text-slate-600"}`}>
              {!isOnline ? (
                "A sua aplicação está a operar em modo offline seguro. Todas as vendas e registos são guardados localmente."
              ) : isOnlineAfterOffline ? (
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  Ligação recuperada com sucesso! O sistema está pronto para sincronizar as alterações retidas.
                </span>
              ) : hasPendingItems ? (
                `Existem ${queueStats.totalItems} registo(s) na fila de sincronização à espera de consolidação no servidor.`
              ) : (
                "Todos os dados locais estão totalmente sincronizados e seguros na nuvem."
              )}
            </p>
          </div>
        </div>

        {/* Right column: Action Controls and Queue Count Indicator */}
        <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3 w-full lg:w-auto pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800">
          
          {/* Pending Queue Count Pill */}
          <div 
            id="sync-queue-count-pill"
            className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl border text-xs font-bold transition-all ${
              hasPendingItems
                ? isDark 
                  ? "bg-amber-500/15 border-amber-500/30 text-amber-300" 
                  : "bg-amber-50 border-amber-200 text-amber-800"
                : isDark 
                  ? "bg-slate-800/80 border-slate-700 text-slate-300" 
                  : "bg-slate-50 border-slate-200 text-slate-700"
            }`}
          >
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Fila Pendente:</span>
            <span className={`px-2 py-0.5 rounded-full font-black text-xs ${
              hasPendingItems
                ? "bg-amber-500 text-white shadow-sm shadow-amber-500/20"
                : isDark ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-600"
            }`}>
              {queueStats.totalItems}
            </span>

            {hasPendingItems && (
              <button
                type="button"
                id="toggle-sync-queue-details-btn"
                onClick={() => setIsExpanded(!isExpanded)}
                className="ml-1 p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition text-slate-600 dark:text-slate-300 cursor-pointer"
                title={isExpanded ? "Ocultar detalhes da fila" : "Ver detalhes da fila"}
              >
                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>

          {/* Force Manual Sync Button */}
          <button
            type="button"
            id="force-manual-sync-btn"
            onClick={handleForceSync}
            disabled={isManualSyncing || !isOnline}
            className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all duration-200 shadow-sm cursor-pointer ${
              !isOnline
                ? "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed border border-transparent"
                : isManualSyncing
                  ? "bg-amber-500 text-white cursor-wait shadow-lg shadow-amber-500/20"
                  : isOnlineAfterOffline
                    ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md shadow-emerald-500/25 hover:scale-[1.02] active:scale-[0.98]"
                    : hasPendingItems
                      ? "bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-md shadow-orange-500/20 hover:scale-[1.02] active:scale-[0.98]"
                      : isDark
                        ? "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${isManualSyncing ? "animate-spin" : ""}`} />
            <span>
              {!isOnline 
                ? "Sem Ligação" 
                : isManualSyncing 
                  ? "Sincronizando..." 
                  : isOnlineAfterOffline
                    ? "Forçar Sincronização Agora"
                    : hasPendingItems
                      ? "Sincronizar Pendentes"
                      : "Forçar Sincronização"}
            </span>
          </button>
        </div>
      </div>

      {/* Last Sync Timestamp & Real-time Indicator Footer */}
      <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-[11px]">
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>
            Última sincronização:{" "}
            <strong className="font-semibold text-slate-700 dark:text-slate-300">
              {lastSyncTime ? `${lastSyncTime}` : "Automática em tempo real"}
            </strong>
          </span>
        </div>

        {hasPendingItems && !isExpanded && (
          <button
            type="button"
            id="view-pending-sync-items-btn"
            onClick={() => setIsExpanded(true)}
            className="text-amber-600 dark:text-amber-400 hover:underline font-bold flex items-center gap-1 cursor-pointer"
          >
            <span>Ver {queueStats.totalItems} alteração(ões) pendente(s)</span>
            <ChevronDown className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Expandable Breakdown Drawer */}
      <AnimatePresence>
        {isExpanded && hasPendingItems && (
          <motion.div
            initial={{ height: 0, opacity: 0, marginTop: 0 }}
            animate={{ height: "auto", opacity: 1, marginTop: 14 }}
            exit={{ height: 0, opacity: 0, marginTop: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className={`p-4 rounded-2xl border ${
              isDark ? "bg-slate-800/60 border-slate-750" : "bg-slate-50/80 border-slate-200"
            }`}>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-xs flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-amber-500" />
                  <span>Distribuição de Dados na Fila Offline</span>
                </h4>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  Serão sincronizados atomicamente
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
                {queueStats.breakdown.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.key}
                      id={`sync-queue-item-${item.key}`}
                      className={`p-2.5 rounded-xl border flex flex-col justify-between transition-all ${
                        isDark ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200/80 shadow-xs"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className={`p-1.5 rounded-lg border ${item.color}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-black px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-500">
                          {item.count}
                        </span>
                      </div>
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate">
                        {item.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ManualSyncWidget;
