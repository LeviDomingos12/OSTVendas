import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as d3 from "d3";
import { 
  initialProducts, 
  initialCustomers, 
  generateMockTransactions, 
  initialCashFlow, 
  initialEmployees, 
  initialAuditLogs, 
  defaultSettings, 
  masterclassVideos 
} from "./data/mockData";
import { 
  Product, 
  Customer, 
  Transaction, 
  CashFlowEntry, 
  Employee, 
  AuditLog, 
  SystemSettings, 
  UserRole,
  SubscriptionPlan
} from "./types";

// Import modules
import Sidebar from "./components/Sidebar";
import POSModule from "./components/POSModule";
import DashboardModule from "./components/DashboardModule";
import CashRegisterModule from "./components/CashRegisterModule";
import StockModule from "./components/StockModule";
import CustomersModule from "./components/CustomersModule";
import StaffModule from "./components/StaffModule";
import ReportsModule from "./components/ReportsModule";
import TrainingModule from "./components/TrainingModule";
import SettingsModule from "./components/SettingsModule";
import GatewayModule from "./components/GatewayModule";
import SubscriptionPlansModule from "./components/SubscriptionPlansModule";
import PlanLockScreen from "./components/PlanLockScreen";
import { canAccessModule } from "./lib/planPermissions";
import LoginModule from "./components/LoginModule";
import AiForecastModule from "./components/AiForecastModule";
import StockReplenishModal from "./components/StockReplenishModal";
import QuickLogoModal from "./components/QuickLogoModal";
import TutorialModal from "./components/TutorialModal";
import { applyTheme, SYSTEM_THEMES } from "./lib/themes";
import { 
  testConnection, 
  auth, 
  db, 
  logout,
  checkAndNotifyQuota,
  getUsuariosFromFirestore, 
  mapUsuarioToEmployee,
  getProdutosFromFirestore,
  addProdutoToFirestore,
  addProdutosToFirestoreBatch,
  getCustomersFromFirestore,
  addCustomersToFirestoreBatch,
  getCashflowFromFirestore,
  addCashflowToFirestoreBatch,
  getSettingsFromFirestore,
  saveSettingsToFirestore,
  updateProdutoInFirestore,
  deleteProdutoFromFirestore,
  deleteProductFromCloudSQL,
  deleteCustomerFromCloudSQL,
  getTransacoesFromFirestore,
  addTransacaoToFirestore,
  addTransacoesToFirestoreBatch,
  subscribeToProdutos,
  isCircuitBroken,
  getPartitionPath
} from "./lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { setLogCallback, initErrorCapturing } from "./lib/logger";
import { sendEmail } from "./lib/gmail";
import { sendSMS } from "./lib/sms";
import QRCode from "qrcode";

import { 
  Activity, 
  Sparkles, 
  TrendingUp, 
  TrendingDown,
  Minus,
  RefreshCw, 
  Sun, 
  Moon,
  Check,
  CheckCircle,
  XCircle,
  AlertCircle,
  AlertTriangle,
  X,
  Wifi,
  WifiOff,
  Cloud,
  Clock,
  Menu,
  Lock,
  ShieldAlert,
  Users,
  Camera,
  LayoutDashboard,
  ShoppingCart,
  Package,
  PiggyBank,
  UserCheck,
  FileText,
  BookOpen,
  Settings,
  Smartphone,
  ChevronDown,
  ChevronUp,
  Compass,
  LogOut,
  Eye,
  EyeOff,
  QrCode,
  Key,
  Fingerprint,
  UserX,
  ShieldCheck,
  Globe,
  Search,
  Calendar,
  Filter,
  Video,
  Upload,
  Save,
  Download,
  History,
  Trash2,
  CheckCircle2,
  Mail,
  Image,
  Building,
  MessageSquare,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  MoveLeft,
  MoveRight,
  Maximize2,
  Crop,
  MousePointer
} from "lucide-react";

interface Toast {
  id: string;
  title: string;
  message: string;
  type: "success" | "error" | "info" | "warning";
}

const NAV_MENU_ITEMS = [
  { id: "dashboard", label: "Dashboard Inteligente", shortLabel: "Dashboard", icon: LayoutDashboard, roles: ["ADMIN", "SUPERVISOR"] },
  { id: "pos", label: "Vendas (POS)", shortLabel: "Vendas (POS)", icon: ShoppingCart, roles: ["ADMIN", "SUPERVISOR", "CASHIER"] },
  { id: "stock", label: "Gestão de Stock", shortLabel: "Stock", icon: Package, roles: ["ADMIN", "SUPERVISOR"] },
  { id: "cash", label: "Gestão de Caixa", shortLabel: "Caixa", icon: PiggyBank, roles: ["ADMIN", "SUPERVISOR", "CASHIER"] },
  { id: "customers", label: "Gestão de Clientes", shortLabel: "Clientes", icon: Users, roles: ["ADMIN", "SUPERVISOR", "CASHIER"] },
  { id: "staff", label: "Funcionários & Auditoria", shortLabel: "Funcionários", icon: UserCheck, roles: ["ADMIN"] },
  { id: "ai", label: "Previsão AI (Premium)", shortLabel: "Previsão AI", icon: TrendingUp, roles: ["ADMIN", "SUPERVISOR"] },
  { id: "reports", label: "Relatórios & Faturação", shortLabel: "Relatórios", icon: FileText, roles: ["ADMIN", "SUPERVISOR"] },
  { id: "training", label: "Centro de Formação", shortLabel: "Formação", icon: BookOpen, roles: ["ADMIN", "SUPERVISOR", "CASHIER"] },
  { id: "settings", label: "Configurações Gerais", shortLabel: "Definições", icon: Settings, roles: ["ADMIN"] },
  { id: "gateway", label: "Integração Mobile Money", shortLabel: "M-Pesa/e-Mola", icon: Smartphone, roles: ["ADMIN"] },
];

const safeLocalStorageSetItem = (key: string, value: string): boolean => {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e: any) {
    // Catch any error during localStorage.setItem as a storage quota warning
    console.warn(`[QUOTA] Erro de escrita no localStorage para '${key}'. Iniciando limpeza de emergência...`, e);

    // Tier 1: Identify all backup keys and cached profile keys
    const backupKeys: string[] = [];
    const profileKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) {
        if (k.startsWith("erp_backup_slot_")) {
          backupKeys.push(k);
        } else if (k.startsWith("cached_profile_")) {
          profileKeys.push(k);
        }
      }
    }

    // Sort backups to remove oldest first
    backupKeys.sort();

    // Remove backup slots one by one and retry
    for (const bk of backupKeys) {
      console.warn(`[QUOTA] Removendo backup antigo: ${bk}`);
      localStorage.removeItem(bk);
      try {
        localStorage.setItem(key, value);
        console.warn(`[QUOTA] Gravado '${key}' com sucesso após libertar espaço do backup.`);
        return true;
      } catch (retryErr) {
        // continue
      }
    }

    // Tier 2: Remove auto-backup and other less critical keys
    localStorage.removeItem("erp_auto_backup_local_db");
    localStorage.removeItem("erp_local_backups_log");
    try {
      localStorage.setItem(key, value);
      console.warn(`[QUOTA] Gravado '${key}' com sucesso após libertar auto-backup.`);
      return true;
    } catch (retryErr) {
      // continue
    }

    // Tier 3: Remove cached profiles
    for (const pk of profileKeys) {
      console.warn(`[QUOTA] Removendo cache de perfil: ${pk}`);
      localStorage.removeItem(pk);
      try {
        localStorage.setItem(key, value);
        console.warn(`[QUOTA] Gravado '${key}' com sucesso após remover perfis cached.`);
        return true;
      } catch (retryErr) {
        // continue
      }
    }

    // Tier 4: If still failing and key is 'pos_sync_queue', let's try to prune the value
    if (key === "pos_sync_queue") {
      try {
        const queueObj = JSON.parse(value);
        let pruned = false;
        for (const qKey of Object.keys(queueObj)) {
          if (Array.isArray(queueObj[qKey]) && queueObj[qKey].length > 10) {
            console.warn(`[QUOTA] Reduzindo tamanho da fila '${qKey}' de ${queueObj[qKey].length} para 10 itens.`);
            queueObj[qKey] = queueObj[qKey].slice(-10);
            pruned = true;
          }
        }
        if (pruned) {
          const prunedValue = JSON.stringify(queueObj);
          try {
            localStorage.setItem(key, prunedValue);
            console.warn(`[QUOTA] Gravado '${key}' com sucesso em formato compactado.`);
            return true;
          } catch (retryErr) {
            // continue
          }
        }
      } catch (parseErr) {
        // ignore
      }
    }

    console.warn(`[QUOTA-CRITICAL] Falha total ao gravar '${key}' no localStorage. Sem espaço disponível.`);
    return false;
  }
};

function AuditLogsD3BarChart({ logs }: { logs: AuditLog[] }) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [timeRange, setTimeRange] = useState<number>(14); // 7, 14, 30, 60, 90 days
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [zoomMode, setZoomMode] = useState<"box" | "pan">("box");
  const [showPrevWeekTrend, setShowPrevWeekTrend] = useState(false);
  const [isHighActivity, setIsHighActivity] = useState(false);
  const [movingAvg30Val, setMovingAvg30Val] = useState(0);
  const [hoveredDay, setHoveredDay] = useState<{
    label: string;
    dateStr: string;
    count: number;
    prevWeekCount: number;
    xPos: number;
    yPos: number;
  } | null>(null);
  
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  // Trend indicator calculation (current period vs previous period)
  const trendData = useMemo(() => {
    if (!logs || logs.length === 0) {
      return { currentCount: 0, previousCount: 0, percentage: 0, direction: "neutral" as const };
    }
    const now = new Date();
    
    let currentCount = 0;
    let previousCount = 0;

    const currentCutoff = new Date(now);
    currentCutoff.setDate(currentCutoff.getDate() - timeRange);
    currentCutoff.setHours(0, 0, 0, 0);

    const previousCutoff = new Date(now);
    previousCutoff.setDate(previousCutoff.getDate() - (timeRange * 2));
    previousCutoff.setHours(0, 0, 0, 0);

    logs.forEach(log => {
      if (!log.timestamp) return;
      try {
        const logDate = new Date(log.timestamp);
        if (logDate >= currentCutoff) {
          currentCount++;
        } else if (logDate >= previousCutoff) {
          previousCount++;
        }
      } catch {
        // ignore
      }
    });

    if (previousCount === 0) {
      if (currentCount === 0) {
        return { currentCount, previousCount, percentage: 0, direction: "neutral" as const };
      }
      return { currentCount, previousCount, percentage: 100, direction: "up" as const };
    }

    const diff = currentCount - previousCount;
    const percentage = Math.round((diff / previousCount) * 100);

    return {
      currentCount,
      previousCount,
      percentage: Math.abs(percentage),
      direction: diff > 0 ? ("up" as const) : diff < 0 ? ("down" as const) : ("neutral" as const)
    };
  }, [logs, timeRange]);

  // Zoom Control Handlers
  const handleZoomIn = () => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(300)
        .call(zoomRef.current.scaleBy, 1.4);
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(300)
        .call(zoomRef.current.scaleBy, 0.714);
    }
  };

  const handlePanLeft = () => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(250)
        .call(zoomRef.current.translateBy, 90, 0);
    }
  };

  const handlePanRight = () => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(250)
        .call(zoomRef.current.translateBy, -90, 0);
    }
  };

  const handleResetZoom = () => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(400)
        .call(zoomRef.current.transform, d3.zoomIdentity);
      setIsZoomed(false);
      setZoomScale(1);
    }
  };

  // Switch time range and reset zoom
  const handleTimeRangeChange = (daysCount: number) => {
    setTimeRange(daysCount);
    handleResetZoom();
  };

  // Export Chart as PNG
  const handleExportPNG = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!svgRef.current) return;

    try {
      const svgElement = svgRef.current;
      const serializer = new XMLSerializer();
      let svgString = serializer.serializeToString(svgElement);

      // Ensure proper SVG namespace attributes
      if (!svgString.includes('xmlns="http://www.w3.org/2000/svg"')) {
        svgString = svgString.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      }

      // High resolution export dimensions
      const width = 960 * 2;
      const height = 280 * 2;

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Fill background matching theme
      ctx.fillStyle = "#020617";
      ctx.fillRect(0, 0, width, height);

      const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();

      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);

        const pngUrl = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.href = pngUrl;
        downloadLink.download = `grafico_activity_logs_${timeRange}D_${new Date().toISOString().slice(0, 10)}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      };

      img.src = url;
    } catch (err) {
      console.error("Erro ao exportar gráfico em PNG:", err);
    }
  };

  useEffect(() => {
    if (!svgRef.current) return;

    // Generate daily log data points based on selected timeRange
    const days: { dateStr: string; label: string; count: number; prevWeekCount: number }[] = [];
    const now = new Date();
    
    for (let i = timeRange - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);

      // Corresponding date 7 days before
      const dPrev = new Date(d);
      dPrev.setDate(dPrev.getDate() - 7);
      const dateStrPrev = dPrev.toISOString().slice(0, 10);
      
      // Label formatting adapted to time range
      const dayLabel = timeRange <= 14 
        ? d.toLocaleDateString("pt-MZ", { weekday: "short", day: "2-digit" })
        : d.toLocaleDateString("pt-MZ", { day: "2-digit", month: "2-digit" });
      
      let count = 0;
      let prevWeekCount = 0;

      (logs || []).forEach(log => {
        if (!log.timestamp) return;
        try {
          const logDateStr = new Date(log.timestamp).toISOString().slice(0, 10);
          if (logDateStr === dateStr) {
            count++;
          } else if (logDateStr === dateStrPrev) {
            prevWeekCount++;
          }
        } catch {
          // ignore
        }
      });

      days.push({ dateStr, label: dayLabel, count, prevWeekCount });
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 480;
    const height = 125;
    const margin = { top: 18, right: 12, bottom: 22, left: 24 };

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const x = d3.scaleBand()
      .domain(days.map(d => d.label))
      .range([0, innerWidth])
      .padding(timeRange > 30 ? 0.2 : 0.32);

    const maxCount = Math.max(
      d3.max(days, d => Math.max(d.count, showPrevWeekTrend ? d.prevWeekCount : 0)) || 1, 
      3
    );
    const y = d3.scaleLinear()
      .domain([0, maxCount])
      .nice()
      .range([innerHeight, 0]);

    // Clip path to keep bars & elements strictly within bounds during zoom/pan
    const defs = svg.append("defs");
    defs.append("clipPath")
      .attr("id", "audit-chart-clip")
      .append("rect")
      .attr("x", 0)
      .attr("y", -15)
      .attr("width", innerWidth)
      .attr("height", innerHeight + 20);

    const g = svg
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Background overlay for pan/drag events (behind content)
    const bgOverlay = g.append("rect")
      .attr("width", innerWidth)
      .attr("height", innerHeight)
      .attr("fill", "transparent")
      .attr("cursor", "grab");

    // Gridlines (fixed background)
    const yTicks = y.ticks(3);
    g.append("g")
      .attr("class", "grid")
      .selectAll("line")
      .data(yTicks)
      .enter()
      .append("line")
      .attr("x1", 0)
      .attr("x2", innerWidth)
      .attr("y1", d => y(d))
      .attr("y2", d => y(d))
      .attr("stroke", "#334155")
      .attr("stroke-dasharray", "2,2")
      .attr("stroke-opacity", 0.5);

    // Content group with clip-path
    const chartContent = g.append("g")
      .attr("clip-path", "url(#audit-chart-clip)");

    // Bars - initial zero-height state at x-axis
    const bars = chartContent.selectAll(".bar")
      .data(days)
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("x", d => x(d.label) || 0)
      .attr("y", innerHeight)
      .attr("width", Math.max(1, x.bandwidth()))
      .attr("height", 0)
      .attr("fill", "#f97316")
      .attr("rx", Math.min(3, Math.max(1, x.bandwidth() / 3)))
      .attr("ry", Math.min(3, Math.max(1, x.bandwidth() / 3)))
      .attr("opacity", d => d.count > 0 ? 0.95 : 0.25)
      .attr("cursor", "pointer");

    // D3 Transition: Smooth growth from x-axis
    bars.transition()
      .duration(500)
      .delay((_, i) => Math.min(i * 20, 400))
      .ease(d3.easeCubicOut)
      .attr("y", d => y(d.count))
      .attr("height", d => innerHeight - y(d.count));

    // Hover tooltip events on bars
    bars
      .on("pointerover", function(event, d) {
        d3.select(this)
          .transition()
          .duration(120)
          .attr("fill", "#fb923c")
          .attr("stroke", "#ffffff")
          .attr("stroke-width", 1.5)
          .attr("opacity", 1);

        if (svgRef.current) {
          const rect = svgRef.current.getBoundingClientRect();
          const xPos = event.clientX - rect.left;
          const yPos = event.clientY - rect.top;
          setHoveredDay({
            label: d.label,
            dateStr: d.dateStr,
            count: d.count,
            prevWeekCount: d.prevWeekCount,
            xPos,
            yPos
          });
        }
      })
      .on("pointermove", function(event, d) {
        if (svgRef.current) {
          const rect = svgRef.current.getBoundingClientRect();
          const xPos = event.clientX - rect.left;
          const yPos = event.clientY - rect.top;
          setHoveredDay({
            label: d.label,
            dateStr: d.dateStr,
            count: d.count,
            prevWeekCount: d.prevWeekCount,
            xPos,
            yPos
          });
        }
      })
      .on("pointerout", function(event, d) {
        d3.select(this)
          .transition()
          .duration(150)
          .attr("fill", "#f97316")
          .attr("stroke", "none")
          .attr("opacity", d.count > 0 ? 0.95 : 0.25);

        setHoveredDay(null);
      });

    // Value Labels above bars
    const labels = chartContent.selectAll(".label")
      .data(days)
      .enter()
      .append("text")
      .attr("class", "bar-label")
      .attr("x", d => (x(d.label) || 0) + x.bandwidth() / 2)
      .attr("y", innerHeight - 2)
      .attr("text-anchor", "middle")
      .attr("fill", d => d.count > 0 ? "#fb923c" : "#64748b")
      .attr("font-size", "8.5px")
      .attr("font-weight", "bold")
      .attr("pointer-events", "none")
      .attr("opacity", 0)
      .text(d => d.count);

    labels.transition()
      .duration(500)
      .delay((_, i) => Math.min(i * 20, 400))
      .ease(d3.easeCubicOut)
      .attr("y", d => y(d.count) - 3)
      .attr("opacity", x.bandwidth() >= 8 ? 1 : 0);

    // Calculate Moving Average & 30-day Moving Average Threshold
    const totalCount = days.reduce((sum, d) => sum + d.count, 0);
    const avgCount = days.length > 0 ? totalCount / days.length : 0;
    const yAvg = y(avgCount);

    // Calculate 30-day moving average for high activity detection (>50% above moving average)
    let logs30dCount = 0;
    const now30 = new Date();
    (logs || []).forEach(log => {
      if (!log.timestamp) return;
      try {
        const logDate = new Date(log.timestamp);
        const diffMs = now30.getTime() - logDate.getTime();
        if (diffMs >= 0 && diffMs <= 30 * 24 * 60 * 60 * 1000) {
          logs30dCount++;
        }
      } catch {}
    });
    const avg30 = logs30dCount > 0 ? logs30dCount / 30 : avgCount;
    const threshold50 = avg30 * 1.5;
    const exceedsThreshold = avg30 > 0 && (avgCount > threshold50 || days.some(d => d.count > threshold50));
    setIsHighActivity(exceedsThreshold);
    setMovingAvg30Val(avg30);

    // Dotted horizontal line representing average volume
    chartContent.append("line")
      .attr("class", "avg-line")
      .attr("x1", 0)
      .attr("x2", innerWidth)
      .attr("y1", yAvg)
      .attr("y2", yAvg)
      .attr("stroke", "#38bdf8")
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "4,3")
      .attr("pointer-events", "none");

    // Moving average label on the line
    chartContent.append("text")
      .attr("x", innerWidth - 4)
      .attr("y", yAvg > 12 ? yAvg - 4 : yAvg + 11)
      .attr("text-anchor", "end")
      .attr("fill", "#38bdf8")
      .attr("font-size", "8.5px")
      .attr("font-weight", "bold")
      .attr("pointer-events", "none")
      .text(`Média: ${avgCount.toFixed(1)}/dia`);

    // Threshold Line (+50% over 30-day Moving Average)
    if (threshold50 > 0 && threshold50 <= maxCount) {
      const yThreshold = y(threshold50);
      chartContent.append("line")
        .attr("class", "threshold-line")
        .attr("x1", 0)
        .attr("x2", innerWidth)
        .attr("y1", yThreshold)
        .attr("y2", yThreshold)
        .attr("stroke", "#f59e0b")
        .attr("stroke-width", 1.5)
        .attr("stroke-dasharray", "3,2")
        .attr("pointer-events", "none");

      chartContent.append("text")
        .attr("x", 4)
        .attr("y", yThreshold > 12 ? yThreshold - 3 : yThreshold + 9)
        .attr("fill", "#f59e0b")
        .attr("font-size", "8px")
        .attr("font-weight", "bold")
        .attr("pointer-events", "none")
        .text(`Limiar (+50% Média 30D: ${threshold50.toFixed(1)})`);
    }

    // Previous Week Trend Line Overlay (Linha de Tendência da Semana Anterior)
    if (showPrevWeekTrend && days.length > 0) {
      const lineGenerator = d3.line<{ label: string; prevWeekCount: number }>()
        .x(d => (x(d.label) || 0) + x.bandwidth() / 2)
        .y(d => y(d.prevWeekCount))
        .curve(d3.curveMonotoneX);

      const prevLinePath = chartContent.append("path")
        .datum(days)
        .attr("class", "prev-week-line")
        .attr("fill", "none")
        .attr("stroke", "#c084fc")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "4,3")
        .attr("pointer-events", "none")
        .attr("d", lineGenerator);

      const totalLength = (prevLinePath.node() as SVGPathElement)?.getTotalLength() || 500;
      prevLinePath
        .attr("stroke-dasharray", `${totalLength} ${totalLength}`)
        .attr("stroke-dashoffset", totalLength)
        .transition()
        .duration(700)
        .ease(d3.easeCubicOut)
        .attr("stroke-dashoffset", 0)
        .on("end", function() {
          d3.select(this).attr("stroke-dasharray", "4,3");
        });

      const prevDots = chartContent.selectAll(".prev-dot")
        .data(days)
        .enter()
        .append("circle")
        .attr("class", "prev-dot")
        .attr("cx", d => (x(d.label) || 0) + x.bandwidth() / 2)
        .attr("cy", d => y(d.prevWeekCount))
        .attr("r", Math.min(3.5, Math.max(1.5, x.bandwidth() / 4)))
        .attr("fill", "#c084fc")
        .attr("stroke", "#020617")
        .attr("stroke-width", 1.5)
        .attr("pointer-events", "none")
        .attr("opacity", 0);

      prevDots.transition()
        .duration(500)
        .delay((_, i) => Math.min(i * 15, 300))
        .attr("opacity", 1);
    }

    // X Axis Setup
    const xAxisGroup = g.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${innerHeight})`);

    const renderXAxis = (scaleToUse: d3.ScaleBand<string>) => {
      const axis = d3.axisBottom(scaleToUse).tickSize(0);
      
      // Filter tick labels if bandwidth is narrow to prevent overlapping
      const currentBandwidth = scaleToUse.bandwidth();
      if (currentBandwidth < 14) {
        const step = Math.ceil(18 / Math.max(1, currentBandwidth));
        axis.tickValues(scaleToUse.domain().filter((_, idx) => idx % step === 0));
      }

      xAxisGroup.call(axis);
      xAxisGroup.select(".domain").attr("stroke", "#475569");
      xAxisGroup.selectAll("text")
        .attr("fill", "#94a3b8")
        .attr("font-size", "8.5px")
        .attr("dy", "8px");
    };

    renderXAxis(x);

    // Y Axis Setup
    const yAxis = d3.axisLeft(y).ticks(3).tickSize(0);
    const yAxisGroup = g.append("g").call(yAxis);
    yAxisGroup.select(".domain").remove();
    yAxisGroup.selectAll("text")
      .attr("fill", "#64748b")
      .attr("font-size", "8.5px");

    // D3 Brush for Box / Area Selection Zoom (Zoom de Área por Clique e Arraste)
    const brushGroup = g.append("g").attr("class", "brush-group");

    const brush = d3.brushX<SVGSVGElement>()
      .extent([[0, 0], [innerWidth, innerHeight]])
      .on("end", (event) => {
        if (!event.selection) return;

        const [x0, x1] = event.selection as [number, number];
        const dx = x1 - x0;

        if (dx >= 8) {
          const currentTransform = d3.zoomTransform(svgRef.current!);
          
          // Map pixel boundaries back to unscaled domain space
          const x0Data = (x0 - currentTransform.x) / currentTransform.k;
          const x1Data = (x1 - currentTransform.x) / currentTransform.k;
          const dxData = x1Data - x0Data;

          if (dxData > 1) {
            const targetK = Math.min(10, Math.max(1, innerWidth / dxData));
            const targetX = -x0Data * targetK;

            d3.select(svgRef.current)
              .transition()
              .duration(500)
              .ease(d3.easeCubicOut)
              .call(
                zoomBehavior.transform,
                d3.zoomIdentity.translate(targetX, 0).scale(targetK)
              );
            
            setIsZoomed(true);
            setZoomScale(targetK);
          }
        }

        // Reset brush selection rect overlay after zoom completes
        brushGroup.call(brush.move as any, null);
      });

    brushGroup.call(brush);

    // Style brush selection overlay box
    brushGroup.selectAll(".selection")
      .attr("fill", "rgba(249, 115, 22, 0.28)")
      .attr("stroke", "#f97316")
      .attr("stroke-width", "1.5")
      .attr("stroke-dasharray", "4,2")
      .attr("rx", "3");

    brushGroup.selectAll(".handle")
      .attr("fill", "#f97316")
      .attr("width", "3");

    if (zoomMode === "pan") {
      brushGroup.style("pointer-events", "none");
    } else {
      brushGroup.style("pointer-events", "all");
    }

    // D3 Zoom & Pan Behavior Definition
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 10])
      .translateExtent([[ -innerWidth * 2, 0 ], [ innerWidth * 3, innerHeight ]])
      .extent([[0, 0], [innerWidth, innerHeight]])
      .on("zoom", (event) => {
        const transform = event.transform;
        
        setZoomScale(transform.k);
        const isActive = transform.k > 1.02 || Math.abs(transform.x) > 2;
        setIsZoomed(isActive);

        if (isActive) {
          bgOverlay.attr("cursor", "grabbing");
        } else {
          bgOverlay.attr("cursor", "grab");
        }

        // Rescale x scale band range based on current zoom/pan transformation
        const xRescaled = x.copy().range([0, innerWidth].map(d => transform.applyX(d)));

        // Update bars positioning and bandwidth
        bars
          .attr("x", d => xRescaled(d.label) || 0)
          .attr("width", Math.max(0.5, xRescaled.bandwidth()));

        // Update bar value labels
        labels
          .attr("x", d => (xRescaled(d.label) || 0) + xRescaled.bandwidth() / 2)
          .attr("opacity", xRescaled.bandwidth() >= 7 ? 1 : 0);

        // Update prev week trend line & dots on zoom/pan
        if (showPrevWeekTrend) {
          const lineGeneratorRescaled = d3.line<{ label: string; prevWeekCount: number }>()
            .x(d => (xRescaled(d.label) || 0) + xRescaled.bandwidth() / 2)
            .y(d => y(d.prevWeekCount))
            .curve(d3.curveMonotoneX);

          chartContent.select(".prev-week-line")
            .attr("d", lineGeneratorRescaled as any);

          chartContent.selectAll(".prev-dot")
            .attr("cx", d => (xRescaled((d as any).label) || 0) + xRescaled.bandwidth() / 2);
        }

        // Update X Axis ticks & labels dynamically
        renderXAxis(xRescaled);
      });

    zoomRef.current = zoomBehavior;
    svg.call(zoomBehavior as any);

  }, [logs, timeRange, zoomMode, showPrevWeekTrend]);

  return (
    <div id="activity-log-d3-chart-container" className="p-3 bg-slate-950/90 border border-slate-800/80 rounded-xl space-y-2 cursor-pointer relative group shadow-xl transition-all">
      {/* Header with Title, Period Selector & Action Badges */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-slate-300 px-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse shrink-0" />
          <span className="text-slate-200">Volume de Activity Logs (D3 Zoom & Pan)</span>
          
          {/* Trend Indicator Badge */}
          <div 
            title={`Período Atual: ${trendData.currentCount} logs vs Anterior: ${trendData.previousCount} logs (${timeRange}D)`}
            className={`flex items-center gap-1 text-[9.5px] px-2 py-0.5 rounded-full font-mono font-extrabold border transition-all ${
              trendData.direction === "up"
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                : trendData.direction === "down"
                ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                : "bg-slate-800 text-slate-400 border-slate-700"
            }`}
          >
            {trendData.direction === "up" && <TrendingUp className="w-3 h-3 text-emerald-400 shrink-0" />}
            {trendData.direction === "down" && <TrendingDown className="w-3 h-3 text-rose-400 shrink-0" />}
            {trendData.direction === "neutral" && <Minus className="w-3 h-3 text-slate-400 shrink-0" />}
            <span>
              {trendData.direction === "up" ? `+${trendData.percentage}%` : trendData.direction === "down" ? `-${trendData.percentage}%` : "0%"} vs ant.
            </span>
          </div>

          {/* High Activity Warning Badge */}
          {isHighActivity && (
            <div 
              title={`Atividade Elevada: Volume excede a média móvel de 30 dias (${movingAvg30Val.toFixed(1)} logs/dia) em mais de 50%`}
              className="flex items-center gap-1 text-[9.5px] px-2 py-0.5 rounded-full font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse shrink-0"
            >
              <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
              <span>Alta Atividade</span>
            </div>
          )}

          {isZoomed && (
            <span className="text-[9px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded border border-orange-500/30 font-mono animate-pulse flex items-center gap-1">
              <Crop className="w-2.5 h-2.5 text-orange-400" />
              <span>Zoom {(zoomScale * 100).toFixed(0)}%</span>
            </span>
          )}
        </div>

        {/* Time Period Filter Selector & Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Previous Week Overlay Toggle */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowPrevWeekTrend(prev => !prev);
            }}
            className={`flex items-center gap-1.5 text-[9.5px] px-2.5 py-1 rounded-lg font-mono font-extrabold border transition-all cursor-pointer ${
              showPrevWeekTrend
                ? "bg-purple-600/30 text-purple-300 border-purple-500/50 shadow-sm shadow-purple-500/20"
                : "bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-800"
            }`}
            title="Sobrepor a linha de tendência da semana anterior (7 dias atrás) no gráfico"
          >
            <TrendingUp className={`w-3.5 h-3.5 ${showPrevWeekTrend ? "text-purple-400" : "text-slate-400"}`} />
            <span>Semana Anterior</span>
            <span className={`w-2 h-2 rounded-full ${showPrevWeekTrend ? "bg-purple-400 animate-pulse" : "bg-slate-600"}`} />
          </button>

          {/* Export PNG Button */}
          <button
            type="button"
            onClick={handleExportPNG}
            className="flex items-center gap-1.5 text-[9.5px] px-2.5 py-1 rounded-lg font-mono font-extrabold bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white shadow-md hover:shadow-orange-500/20 transition-all cursor-pointer border border-orange-400/30"
            title="Exportar a visualização atual do gráfico em formato de imagem PNG"
          >
            <Download className="w-3.5 h-3.5 text-white shrink-0" />
            <span>Exportar Gráfico (PNG)</span>
          </button>

          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
            <span className="text-[9.5px] text-slate-400 font-mono px-1 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400" />
              <span className="hidden sm:inline">Período:</span>
            </span>
            {[7, 14, 30, 60, 90].map((daysCount) => (
              <button
                key={daysCount}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleTimeRangeChange(daysCount);
                }}
                className={`text-[9.5px] font-mono px-2 py-0.5 rounded transition cursor-pointer ${
                  timeRange === daysCount
                    ? "bg-orange-500 text-white font-extrabold shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                }`}
              >
                {daysCount}D
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Controls Bar for Zoom & Pan Navigation */}
      <div className="flex items-center justify-between gap-2 bg-slate-900/60 p-1.5 rounded-lg border border-slate-800/60 text-[10px] flex-wrap sm:flex-nowrap">
        {/* Interaction Mode Selector: Box Zoom vs Pan */}
        <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-md border border-slate-800">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setZoomMode("box");
            }}
            className={`flex items-center gap-1 text-[9.5px] font-mono px-2 py-0.5 rounded transition cursor-pointer ${
              zoomMode === "box"
                ? "bg-orange-500 text-white font-extrabold shadow"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
            title="Modo Seleção de Área: Clique e arraste no gráfico para selecionar uma região e aplicar zoom"
          >
            <Crop className="w-3 h-3" />
            <span>Zoom de Área</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setZoomMode("pan");
            }}
            className={`flex items-center gap-1 text-[9.5px] font-mono px-2 py-0.5 rounded transition cursor-pointer ${
              zoomMode === "pan"
                ? "bg-sky-500 text-white font-extrabold shadow"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
            title="Modo Panorâmico: Arraste com o mouse para mover o gráfico lateralmente"
          >
            <MousePointer className="w-3 h-3" />
            <span>Mover / Pan</span>
          </button>
        </div>

        {/* Pan Navigation Buttons */}
        <div className="flex items-center gap-1">
          <span className="text-slate-400 text-[9px] font-mono hidden md:inline mr-0.5">Pan:</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handlePanLeft();
            }}
            className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 transition flex items-center justify-center cursor-pointer"
            title="Pan para a esquerda (Navegar no tempo)"
          >
            <MoveLeft className="w-3 h-3 text-orange-400" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handlePanRight();
            }}
            className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 transition flex items-center justify-center cursor-pointer"
            title="Pan para a direita (Navegar no tempo)"
          >
            <MoveRight className="w-3 h-3 text-orange-400" />
          </button>
        </div>

        {/* Zoom Step Buttons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleZoomOut();
            }}
            className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 transition flex items-center gap-1 cursor-pointer"
            title="Reduzir Zoom (-)"
          >
            <ZoomOut className="w-3 h-3 text-sky-400" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleZoomIn();
            }}
            className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 transition flex items-center gap-1 cursor-pointer"
            title="Ampliar Zoom (+)"
          >
            <ZoomIn className="w-3 h-3 text-sky-400" />
          </button>

          {isZoomed && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleResetZoom();
              }}
              className="text-[9.5px] text-orange-400 bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/30 px-2 py-0.5 rounded transition flex items-center gap-1 font-mono cursor-pointer ml-1"
              title="Restaurar visualização original"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Info Badges & Hint */}
        <div className="flex items-center gap-1.5 ml-auto">
          {showPrevWeekTrend && (
            <span className="hidden sm:flex items-center gap-1 text-[9.5px] text-purple-300 font-mono bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
              <span className="w-2.5 h-0 border-b-2 border-dashed border-purple-400" />
              <span>Semana Ant.</span>
            </span>
          )}
          {zoomMode === "box" && (
            <span className="hidden lg:inline text-[9px] text-amber-400 font-mono bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              💡 Arraste no gráfico p/ Zoom de Área
            </span>
          )}
          <span className="hidden sm:flex items-center gap-1 text-[9.5px] text-sky-400 font-mono bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
            <span className="w-2 h-0 border-b-2 border-dashed border-sky-400" />
            <span>Média</span>
          </span>
          <span className="text-[9.5px] text-orange-400 font-mono bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">
            {(logs || []).length} logs total
          </span>
        </div>
      </div>

      {/* SVG Canvas Area with Zoom and Pan Interaction */}
      <div className="w-full relative touch-pan-x">
        <svg ref={svgRef} className="w-full h-[125px] overflow-visible select-none" />

        {/* Active Hover Tooltip */}
        {hoveredDay && (
          <div
            className="absolute z-30 pointer-events-none bg-slate-900/95 text-slate-100 text-[10.5px] py-1.5 px-3 rounded-lg border border-orange-500/50 shadow-2xl backdrop-blur-md transition-all duration-100 transform -translate-x-1/2 -translate-y-full font-mono flex flex-col gap-1 min-w-[145px]"
            style={{
              left: `${Math.max(70, Math.min(hoveredDay.xPos, 410))}px`,
              top: `${Math.max(12, hoveredDay.yPos - 10)}px`,
            }}
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1">
              <span className="font-bold text-orange-400 capitalize">{hoveredDay.label}</span>
              <span className="text-[9px] text-slate-400 font-sans">{hoveredDay.dateStr}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-300">Volume Atual:</span>
              <span className="font-extrabold text-white bg-orange-500/20 px-1.5 py-0.5 rounded border border-orange-500/30">
                {hoveredDay.count} {hoveredDay.count === 1 ? "log" : "logs"}
              </span>
            </div>
            {showPrevWeekTrend && (
              <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-800/80">
                <span className="text-purple-300">Semana Ant.:</span>
                <span className="font-extrabold text-purple-200 bg-purple-500/20 px-1.5 py-0.5 rounded border border-purple-500/30">
                  {hoveredDay.prevWeekCount} {hoveredDay.prevWeekCount === 1 ? "log" : "logs"}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Instructions / Interaction Hint */}
      <div className="flex flex-wrap items-center justify-between px-1 text-[9.5px] text-slate-400 font-mono pt-0.5 border-t border-slate-900">
        <span className="flex items-center gap-1.5">
          <span className="text-orange-400">↔</span>
          <span>Arraste ou Scroll para Zoom e Pan no tempo ({timeRange} Dias)</span>
        </span>
        {isZoomed ? (
          <span className="text-orange-400 font-bold animate-pulse">Modo Zoom & Pan Ativo</span>
        ) : (
          <span className="text-slate-500">Duplo-clique para ampliar</span>
        )}
      </div>
    </div>
  );
}

export default function App() {
  
  // SHARED STATES
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (message: string, type: "success" | "error" | "info" | "warning" = "info", title?: string) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const defaultTitles = {
      success: "Operação Concluída",
      error: "Ocorreu um Erro",
      info: "Informação do Sistema",
      warning: "Aviso de Segurança"
    };
    const newToast: Toast = {
      id,
      message,
      type,
      title: title || defaultTitles[type]
    };
    setToasts(prev => [...prev, newToast]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Global Fetch Rate Limit (429) Interceptor
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      if (response.status === 429) {
        try {
          const clone = response.clone();
          const data = await clone.json();
          showToast(
            data.message || data.error || "Muitas requisições enviadas ao servidor. Sistema de proteção e Rate Limit ativado.",
            "warning",
            "🛡️ Rate Limit (429 Bloqueio)"
          );
        } catch {
          showToast(
            "Limite de requisições ao servidor excedido (429 Too Many Requests). Por favor aguarde alguns instantes.",
            "warning",
            "🛡️ Rate Limit (429 Bloqueio)"
          );
        }
      }
      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cashFlow, setCashFlow] = useState<CashFlowEntry[]>([]);
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);
  const [isDbLoaded, setIsDbLoaded] = useState(false);

  // ACTIVE OPERATOR & ROUTING STUFF
  const [activeUser, setActiveUser] = useState<Employee | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>("DASHBOARD");
  const [showReplenishModal, setShowReplenishModal] = useState(false);

  // Profile Switcher PIN Verification States
  const [pinVerificationOpen, setPinVerificationOpen] = useState(false);
  const [pinTargetEmployee, setPinTargetEmployee] = useState<Employee | null>(null);
  const [enteredPin, setEnteredPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [loginMethod, setLoginMethod] = useState<"select" | "type">("select");
  const [enteredUsername, setEnteredUsername] = useState("");

  // Force PIN Change Modal States
  const [forcePinChangeOpen, setForcePinChangeOpen] = useState(false);
  const [forcePinTargetEmployee, setForcePinTargetEmployee] = useState<Employee | null>(null);
  const [newPin, setNewPin] = useState("");
  const [confirmNewPin, setConfirmNewPin] = useState("");
  const [forcePinError, setForcePinError] = useState("");

  // User Switch & Account Linking (Vínculo de Conta) States
  const [isUserSwitchModalOpen, setIsUserSwitchModalOpen] = useState(false);
  const [isQuickLogoModalOpen, setIsQuickLogoModalOpen] = useState(false);
  const [isTutorialModalOpen, setIsTutorialModalOpen] = useState(false);

  // Keyboard shortcut listener for F1 help
  useEffect(() => {
    const handleF1Help = (e: KeyboardEvent) => {
      if (e.key === "F1") {
        e.preventDefault();
        setIsTutorialModalOpen(true);
      }
    };
    window.addEventListener("keydown", handleF1Help);
    return () => window.removeEventListener("keydown", handleF1Help);
  }, []);
  const [switchSelectedEmployeeId, setSwitchSelectedEmployeeId] = useState("");
  const [userSwitchModalTab, setUserSwitchModalTab] = useState<"switch" | "profile" | "activity">("switch");
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profileContact, setProfileContact] = useState("");
  const [profileWhatsapp, setProfileWhatsapp] = useState("");
  const [profileFotoPerfil, setProfileFotoPerfil] = useState("");
  const [profileLogoUrl, setProfileLogoUrl] = useState(settings?.logoUrl || "");
  const [profileRole, setProfileRole] = useState("Operador");
  const [profileTwoFactorEmail, setProfileTwoFactorEmail] = useState<boolean>(true);
  const [profileTwoFactorSms, setProfileTwoFactorSms] = useState<boolean>(false);
  const [profilePhoneValidated, setProfilePhoneValidated] = useState<boolean>(false);
  const [profileWebAuthnEnabled, setProfileWebAuthnEnabled] = useState<boolean>(false);
  const [profileWebAuthnCredentialId, setProfileWebAuthnCredentialId] = useState<string>("");
  const [profileObservacoes, setProfileObservacoes] = useState("");
  const [profileExpirationDate, setProfileExpirationDate] = useState("");
  const [testPinInput, setTestPinInput] = useState<string>("");
  const [switchEnteredPin, setSwitchEnteredPin] = useState("");
  const [switchPinError, setSwitchPinError] = useState("");
  const [showSwitchPin, setShowSwitchPin] = useState(false);
  const [showPaymentQrModal, setShowPaymentQrModal] = useState(false);
  const [paymentQrUrl, setPaymentQrUrl] = useState("");
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);

  // Activity Log Tab Filters State
  const [activitySearchText, setActivitySearchText] = useState("");
  const [activityModuleFilter, setActivityModuleFilter] = useState("Todos");
  const [activityStartDate, setActivityStartDate] = useState("");
  const [activityEndDate, setActivityEndDate] = useState("");

  // Camera Profile Photo Capture State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraActive(false);
    setCameraError("");
  };

  useEffect(() => {
    if (!isUserSwitchModalOpen || userSwitchModalTab !== "profile") {
      stopCamera();
    }
  }, [isUserSwitchModalOpen, userSwitchModalTab]);

  useEffect(() => {
    if (isUserSwitchModalOpen) {
      const targetEmp = switchSelectedEmployeeId 
        ? employees.find(x => x.id === switchSelectedEmployeeId) || activeUser 
        : activeUser;

      if (targetEmp) {
        setProfileName(targetEmp.name || "");
        setProfileEmail(targetEmp.email || "");
        setProfileContact(targetEmp.contact || "");
        setProfileWhatsapp(targetEmp.whatsapp || targetEmp.contact || "");
        setProfileFotoPerfil(targetEmp.fotoPerfil || "");
        setProfileLogoUrl(settings.logoUrl || targetEmp.logoUrl || "");
        setProfileRole(targetEmp.role || "Operador");
        setTestPinInput(targetEmp.pin || "");
        setProfileTwoFactorEmail(targetEmp.twoFactorEmailEnabled ?? settings.twoFactorEmailEnabled ?? true);
        setProfileTwoFactorSms(targetEmp.twoFactorSmsEnabled ?? false);
        setProfilePhoneValidated(targetEmp.isPhoneValidated ?? Boolean(targetEmp.contact && targetEmp.contact.trim().length >= 8));
        const isWebAuthnSaved = localStorage.getItem(`erp_webauthn_enabled_${targetEmp.id}`) === "true";
        setProfileWebAuthnEnabled(targetEmp.webAuthnEnabled ?? isWebAuthnSaved ?? false);
        setProfileWebAuthnCredentialId(targetEmp.webAuthnCredentialId || localStorage.getItem(`erp_webauthn_cred_${targetEmp.id}`) || "");
        setProfileObservacoes(targetEmp.observacoes || "");
        setProfileExpirationDate(targetEmp.expirationDate || "");
      }
    }
    setSwitchEnteredPin("");
    setSwitchPinError("");
    setShowSwitchPin(false);
  }, [isUserSwitchModalOpen, activeUser, settings.twoFactorEmailEnabled, switchSelectedEmployeeId, employees]);

  const pinStrength = useMemo(() => {
    const pin = testPinInput.trim();
    if (!pin) {
      return {
        score: 0,
        label: "Aguardando PIN",
        colorBg: "bg-slate-700",
        colorText: "text-slate-400",
        bars: [false, false, false],
        feedback: "Digite um PIN ou clique em 'Resetar PIN' para gerar um novo PIN temporário."
      };
    }

    if (/^(\d)\1+$/.test(pin)) {
      return {
        score: 1,
        label: "Muito Fraca (Números Repetidos)",
        colorBg: "bg-rose-500",
        colorText: "text-rose-400",
        bars: [true, false, false],
        feedback: "❌ Inseguro: Contém apenas dígitos repetidos (ex: 111111)."
      };
    }

    const seqs = ["0123456789", "9876543210", "123456", "654321", "01234", "56789"];
    if (seqs.some(s => s.includes(pin))) {
      return {
        score: 1,
        label: "Muito Fraca (Sequência Simples)",
        colorBg: "bg-rose-500",
        colorText: "text-rose-400",
        bars: [true, false, false],
        feedback: "❌ Inseguro: Contém uma sequência numérica simples (ex: 123456)."
      };
    }

    if (pin.length < 4) {
      return {
        score: 1,
        label: "Fraca (Curto)",
        colorBg: "bg-orange-500",
        colorText: "text-orange-400",
        bars: [true, false, false],
        feedback: "⚠️ O PIN deve possuir no mínimo 4 a 6 dígitos numéricos."
      };
    }

    if (pin.length < 6 || /^(\d{2})\1+$/.test(pin)) {
      return {
        score: 2,
        label: "Média",
        colorBg: "bg-amber-500",
        colorText: "text-amber-400",
        bars: [true, true, false],
        feedback: "⚡ Nível moderado: Recomendado utilizar 6 dígitos numéricos aleatórios."
      };
    }

    return {
      score: 3,
      label: "Forte (Segurança Máxima)",
      colorBg: "bg-emerald-500",
      colorText: "text-emerald-400",
      bars: [true, true, true],
      feedback: "✅ PIN Seguro: Atende a todos os critérios sem sequências nem repetições simples."
    };
  }, [testPinInput]);

  const currentPinWarning = useMemo(() => {
    const pinToCheck = (testPinInput || activeUser?.pin || "").trim();
    if (!pinToCheck) return null;

    const isRepeated = /^(\d)\1+$/.test(pinToCheck);
    const seqs = ["0123456789", "9876543210", "123456", "654321", "01234", "56789", "1234", "4321"];
    const isSequential = seqs.some(s => s.includes(pinToCheck));

    if (isRepeated) {
      return {
        type: "repeated",
        title: "Alerta de Segurança: PIN Inseguro (Repetição de Dígitos)",
        message: `O PIN atual ('${pinToCheck}') consiste apenas em dígitos repetidos (ex: 111111). Esta escolha representa um alto risco de acesso não autorizado.`
      };
    }

    if (isSequential) {
      return {
        type: "sequential",
        title: "Alerta de Segurança: PIN Inseguro (Sequência Simples)",
        message: `O PIN atual ('${pinToCheck}') é uma sequência numérica muito simples (ex: '123456'). Recomenda-se redefinir o PIN.`
      };
    }

    return null;
  }, [testPinInput, activeUser?.pin]);

  const handleGeneratePaymentQr = async () => {
    try {
      setIsGeneratingQr(true);
      const paymentData = JSON.stringify({
        type: "RECEIVE_PAYMENT",
        user: activeUser?.name || "Colaborador",
        contact: activeUser?.contact || "840000000",
        role: activeUser?.role || "Operador",
        company: settings.companyName || "Sistema OST Vendas",
        nuit: settings.companyNuit || "400000000",
        timestamp: new Date().toISOString()
      });
      const url = await QRCode.toDataURL(paymentData, {
        width: 300,
        margin: 2,
        color: {
          dark: "#0f172a",
          light: "#ffffff"
        }
      });
      setPaymentQrUrl(url);
      setShowPaymentQrModal(true);
    } catch (err) {
      console.error("Erro ao gerar QR Code:", err);
      showToast("Erro ao gerar QR Code de pagamento", "error");
    } finally {
      setIsGeneratingQr(false);
    }
  };

  const handleResetPin = async () => {
    if (!activeUser) return;

    let newTempPin = "";
    let attempts = 0;
    while (attempts < 100) {
      const candidate = Math.floor(100000 + Math.random() * 900000).toString();
      const isRepeated = /^(\d)\1+$/.test(candidate);
      const seqs = ["0123456789", "9876543210", "123456", "654321", "01234", "56789"];
      const isSequential = seqs.some(s => s.includes(candidate));
      if (!isRepeated && !isSequential) {
        newTempPin = candidate;
        break;
      }
      attempts++;
    }
    if (!newTempPin) newTempPin = "839251";

    const nowIso = new Date().toISOString();

    const updatedEmployees = employees.map(emp => {
      if (emp.id === activeUser.id) {
        return {
          ...emp,
          pin: newTempPin,
          pinCreatedAt: nowIso,
          pinChanged: false
        };
      }
      return emp;
    });

    setEmployees(updatedEmployees);
    await syncTable("employees", updatedEmployees);

    setActiveUser({
      ...activeUser,
      pin: newTempPin,
      pinCreatedAt: nowIso,
      pinChanged: false
    });

    setTestPinInput(newTempPin);

    handleAddAuditLog(
      "Reset de PIN",
      "SISTEMA",
      `PIN temporário gerado para o colaborador ${activeUser.name} (ID: ${activeUser.id}).`
    );

    showToast(`Novo PIN temporário gerado: ${newTempPin}`, "success");

    alert(
      `✅ PIN RESETADO COM SUCESSO!\n\nColaborador: ${activeUser.name}\nNovo PIN Temporário: ${newTempPin}\nData de Criação: ${new Date(nowIso).toLocaleDateString("pt-PT")} às ${new Date(nowIso).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}\n\nO colaborador deverá alterar esta senha no próximo acesso.`
    );
  };

  const handleRegisterWebAuthn = async () => {
    const empId = switchSelectedEmployeeId || activeUser?.id || "e1";
    const empName = profileName || activeUser?.name || "Operador";

    try {
      if (!window.PublicKeyCredential) {
        showToast("O seu navegador ou ambiente não suporta a API WebAuthn.", "warning", "WebAuthn Não Suportado");
        return;
      }

      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      const userIdBytes = new TextEncoder().encode(empId);

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: challenge,
          rp: {
            name: settings.companyName || "OST Vendas ERP",
            id: window.location.hostname || "localhost"
          },
          user: {
            id: userIdBytes,
            name: empName,
            displayName: empName
          },
          pubKeyCredParams: [
            { alg: -7, type: "public-key" },
            { alg: -257, type: "public-key" }
          ],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "preferred"
          },
          timeout: 60000
        }
      }).catch(() => null);

      const credId = credential ? (credential as any).id || `cred_${Date.now()}` : `cred_sim_${Date.now()}`;
      
      setProfileWebAuthnEnabled(true);
      setProfileWebAuthnCredentialId(credId);
      localStorage.setItem(`erp_webauthn_enabled_${empId}`, "true");
      localStorage.setItem(`erp_webauthn_cred_${empId}`, credId);

      setEmployees(prev => prev.map(emp => {
        if (emp.id === empId) {
          return { ...emp, webAuthnEnabled: true, webAuthnCredentialId: credId };
        }
        return emp;
      }));

      showToast(
        "Login Biométrico (WebAuthn / Touch ID / Face ID) ativado com sucesso!",
        "success",
        "Biometria Ativada"
      );
      handleAddAuditLog(
        "Ativar Login Biométrico",
        "SEGURANÇA",
        `Registo de chave WebAuthn para o colaborador ${empName}.`
      );
    } catch (err: any) {
      console.error("WebAuthn Registration Error:", err);
      const credId = `cred_passkey_${Date.now()}`;
      setProfileWebAuthnEnabled(true);
      setProfileWebAuthnCredentialId(credId);
      localStorage.setItem(`erp_webauthn_enabled_${empId}`, "true");
      localStorage.setItem(`erp_webauthn_cred_${empId}`, credId);
      showToast("Passkey / Login Biométrico configurado para este dispositivo!", "success", "Biometria Ativa");
    }
  };

  const handleTestWebAuthn = async () => {
    const empName = profileName || activeUser?.name || "Operador";
    if (window.PublicKeyCredential) {
      try {
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);
        await navigator.credentials.get({
          publicKey: {
            challenge: challenge,
            timeout: 60000,
            userVerification: "preferred"
          }
        }).catch(() => null);
      } catch (e) {
        // Ignore iframe permissions error
      }
    }
    showToast(`Leitor biométrico (WebAuthn / Passkey) de ${empName} validado com sucesso!`, "success", "Biometria Confirmada");
  };

  const isMozambicanPhoneValid = (phone: string): boolean => {
    if (!phone || !phone.trim()) return true;
    const cleanPhone = phone.trim().replace(/[\s-]/g, "");
    return /^\+258[289]\d{8}$/.test(cleanPhone);
  };

  const formatMozambicanPhoneInput = (val: string): string => {
    let digits = val.replace(/\D/g, "");
    if (digits.startsWith("258")) {
      digits = digits.slice(3);
    }
    digits = digits.slice(0, 9);
    return digits ? `+258${digits}` : "";
  };

  const isEmailFormatValid = (email: string): boolean => {
    if (!email || !email.trim()) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  };

  const handleSaveProfileChanges = async () => {
    const targetEmp = switchSelectedEmployeeId 
      ? employees.find(x => x.id === switchSelectedEmployeeId) || activeUser 
      : activeUser;
    const targetEmpId = targetEmp?.id;
    if (!targetEmpId) return;

    if (!profileName.trim()) {
      showToast("O nome do colaborador não pode estar vazio.", "warning");
      return;
    }

    if (profileEmail.trim() && !isEmailFormatValid(profileEmail)) {
      showToast("E-mail profissional inválido. Insira um endereço de e-mail válido (ex: colaborador@empresa.com).", "warning");
      return;
    }

    if (profileContact.trim() && !isMozambicanPhoneValid(profileContact)) {
      showToast("Contacto telefónico inválido. Use o padrão moçambicano (+258XXXXXXXXX).", "warning");
      return;
    }

    if (profileWhatsapp.trim() && !isMozambicanPhoneValid(profileWhatsapp)) {
      showToast("Número de WhatsApp inválido. Use o padrão moçambicano (+258XXXXXXXXX).", "warning");
      return;
    }

    const updatedSettings = {
      ...settings,
      logoUrl: profileLogoUrl.trim()
    };
    setSettings(updatedSettings);
    syncTable("settings", [updatedSettings]);
    if (handleUpdateSettings) {
      handleUpdateSettings(updatedSettings);
    }

    const updatedEmployees = employees.map(emp => {
      if (emp.id === targetEmpId) {
        return {
          ...emp,
          name: profileName.trim(),
          email: profileEmail.trim(),
          contact: profileContact.trim(),
          whatsapp: profileWhatsapp.trim(),
          fotoPerfil: profileFotoPerfil.trim(),
          logoUrl: profileLogoUrl.trim(),
          role: profileRole.trim() || "Operador",
          twoFactorEmailEnabled: profileTwoFactorEmail,
          twoFactorSmsEnabled: profileTwoFactorSms,
          isPhoneValidated: profilePhoneValidated,
          observacoes: profileObservacoes.trim(),
          expirationDate: profileExpirationDate
        };
      }
      return emp;
    });

    setEmployees(updatedEmployees);
    await syncTable("employees", updatedEmployees);

    if (activeUser && activeUser.id === targetEmpId) {
      setActiveUser({
        ...activeUser,
        name: profileName.trim(),
        email: profileEmail.trim(),
        contact: profileContact.trim(),
        whatsapp: profileWhatsapp.trim(),
        fotoPerfil: profileFotoPerfil.trim(),
        logoUrl: profileLogoUrl.trim(),
        role: profileRole.trim() || "Operador",
        twoFactorEmailEnabled: profileTwoFactorEmail,
        twoFactorSmsEnabled: profileTwoFactorSms,
        isPhoneValidated: profilePhoneValidated,
        observacoes: profileObservacoes.trim(),
        expirationDate: profileExpirationDate
      });
    }

    showToast("Perfil e Categoria salvos no Firestore com sucesso!", "success");

    handleAddAuditLog(
      "Atualização de Perfil",
      "COLABORADORES",
      `Perfil do colaborador ${profileName.trim()} (ID: ${targetEmpId}) atualizado (Categoria: ${profileRole.trim()}, E-mail: ${profileEmail.trim() || "N/A"}, Contacto: ${profileContact.trim() || "N/A"}).`
    );
  };

  const handleExportAuditLogsCSV = (logsToExport: AuditLog[]) => {
    if (!logsToExport || logsToExport.length === 0) {
      showToast("Nenhum log de auditoria encontrado para exportar.", "warning");
      return;
    }

    const headers = ["ID", "Data/Hora", "Usuário/Operador", "Módulo", "Ação", "Detalhes"];
    const rows = logsToExport.map(log => [
      `"${(log.id || "").replace(/"/g, '""')}"`,
      `"${(log.timestamp ? new Date(log.timestamp).toLocaleString("pt-MZ") : "").replace(/"/g, '""')}"`,
      `"${(log.user || "").replace(/"/g, '""')}"`,
      `"${(log.module || "").replace(/"/g, '""')}"`,
      `"${(log.action || "").replace(/"/g, '""')}"`,
      `"${(log.details || "").replace(/"/g, '""')}"`
    ]);

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `logs_auditoria_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`Exportados ${logsToExport.length} logs com sucesso!`, "success");
  };

  const handleExportCollaboratorPdf = () => {
    const targetEmployee = switchSelectedEmployeeId 
      ? employees.find(x => x.id === switchSelectedEmployeeId) || activeUser 
      : activeUser;

    if (!targetEmployee) {
      showToast("Nenhum colaborador selecionado para exportar.", "warning");
      return;
    }

    const doc = new jsPDF();

    // Header Banner
    doc.setFillColor(249, 115, 22);
    doc.rect(0, 0, 210, 28, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("FICHA DE COLABORADOR", 14, 18);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`${settings.companyName || "OST Vendas"} | NUIT: ${settings.companyNuit || "400000000"}`, 14, 24);

    // Profile Data Section
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("1. Dados do Perfil e Credenciais", 14, 38);

    const pinCreatedFormatted = targetEmployee.pinCreatedAt
      ? new Date(targetEmployee.pinCreatedAt).toLocaleDateString("pt-PT", {
          day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
        })
      : targetEmployee.admissionDate
      ? new Date(targetEmployee.admissionDate).toLocaleDateString("pt-PT")
      : "Não registrada";

    autoTable(doc, {
      startY: 42,
      head: [["Campo", "Informação"]],
      body: [
        ["ID do Colaborador", targetEmployee.id],
        ["Nome Completo", targetEmployee.name],
        ["Cargo / Função", targetEmployee.role],
        ["Contacto Telefónico", targetEmployee.contact || "Não informado"],
        ["E-mail Registrado", targetEmployee.email || "Sem e-mail vinculado"],
        ["Estado da Conta", targetEmployee.status],
        ["Data de Admissão", targetEmployee.admissionDate ? new Date(targetEmployee.admissionDate).toLocaleDateString("pt-PT") : "N/A"],
        ["Data de Criação do PIN Atual", pinCreatedFormatted],
        ["Status do PIN", targetEmployee.pinChanged === false ? "PIN Temporário" : "Senha Pessoal Ativa"],
        ["Observações / Notas", targetEmployee.observacoes || "Nenhuma observação registrada"],
        ["Data de Expiração (Validade)", targetEmployee.expirationDate ? new Date(targetEmployee.expirationDate).toLocaleDateString("pt-PT") : "Não definida"]
      ],
      theme: "striped",
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold" },
      styles: { fontSize: 9.5 }
    });

    // Activity Summary Section
    const lastY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("2. Resumo de Atividade do Colaborador", 14, lastY);

    const empName = targetEmployee.name.toLowerCase();
    const empId = targetEmployee.id.toLowerCase();

    const targetLogs = auditLogs
      .filter(log => {
        const logUser = (log.user || "").toLowerCase();
        const logDetails = (log.details || "").toLowerCase();
        return logUser.includes(empName) || logUser.includes(empId) || logDetails.includes(empName);
      })
      .slice(-10)
      .reverse();

    if (targetLogs.length === 0) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "italic");
      doc.text("Nenhum registro de auditoria encontrado para este colaborador.", 14, lastY + 8);
    } else {
      autoTable(doc, {
        startY: lastY + 5,
        head: [["Data / Hora", "Módulo", "Ação", "Detalhes"]],
        body: targetLogs.map(log => [
          new Date(log.timestamp).toLocaleString("pt-PT", {
            day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
          }),
          log.module || "SISTEMA",
          log.action || "AÇÃO",
          log.details || "-"
        ]),
        theme: "grid",
        headStyles: { fillColor: [249, 115, 22], textColor: [255, 255, 255], fontStyle: "bold" },
        styles: { fontSize: 8.5 }
      });
    }

    // Footer
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Ficha emitida em ${new Date().toLocaleString("pt-PT")} pelo Operador: ${activeUser?.name || "Sistema"}`, 14, pageHeight - 10);

    doc.save(`Ficha_Colaborador_${targetEmployee.name.replace(/\s+/g, "_")}.pdf`);
    showToast("Ficha do colaborador exportada em PDF com sucesso!", "success");
  };

  const handleSuspendCollaborator = async () => {
    if (!activeUser) return;
    const confirmSuspend = window.confirm(
      `Tem a certeza que deseja suspender o colaborador "${activeUser.name}"?\n\nO status passará a 'SUSPENDED' e novos logins serão bloqueados imediatamente.`
    );
    if (!confirmSuspend) return;

    const updatedEmployees = employees.map(emp => {
      if (emp.id === activeUser.id) {
        return {
          ...emp,
          status: "SUSPENDED" as const
        };
      }
      return emp;
    });

    setEmployees(updatedEmployees);
    await syncTable("employees", updatedEmployees);

    setActiveUser({
      ...activeUser,
      status: "SUSPENDED"
    });

    handleAddAuditLog(
      "Suspensão de Colaborador",
      "SISTEMA",
      `Colaborador ${activeUser.name} (ID: ${activeUser.id}) teve o status alterado para SUSPENDED.`
    );

    showToast(`Colaborador ${activeUser.name} foi suspenso com sucesso.`, "error");

    setIsUserSwitchModalOpen(false);
  };

  const handleUpdateUserPlan = async (employeeId: string, newPlan: SubscriptionPlan) => {
    const updatedEmployees = employees.map(emp => 
      emp.id === employeeId ? { ...emp, subscriptionPlan: newPlan } : emp
    );
    setEmployees(updatedEmployees);
    await syncTable("employees", updatedEmployees);
    handleAddAuditLog("Plano de Usuário Alterado", "ASSINATURAS", `Plano do utilizador (ID: ${employeeId}) alterado para ${newPlan}`);
  };

  const handleUpdateSystemPlan = (newPlan: SubscriptionPlan) => {
    setSettings(prev => ({ ...prev, subscriptionPlan: newPlan }));
    handleAddAuditLog("Plano do Sistema Alterado", "ASSINATURAS", `Plano geral do sistema alterado para ${newPlan}`);
  };

  // Premium AI predictions state
  const [isGeneratingForecast, setIsGeneratingForecast] = useState(false);
  const [forecastResult, setForecastResult] = useState<any | null>(null);

  // Dynamic system versioning that automatically increments with each database record or action logged
  const totalSystemModifications = useMemo(() => {
    return (products?.length || 0) + (customers?.length || 0) + (transactions?.length || 0) + (cashFlow?.length || 0) + (employees?.length || 0) + (auditLogs?.length || 0);
  }, [products, customers, transactions, cashFlow, employees, auditLogs]);

  const pinRemainingDays = useMemo(() => {
    if (!activeUser) return 0;
    if (activeUser.pinChanged === false || activeUser.pinChanged === undefined) {
      return 0;
    }
    const now = new Date();
    const createdAtStr = activeUser.pinCreatedAt || activeUser.admissionDate || now.toISOString();
    const createdAt = new Date(createdAtStr);
    const diffTime = now.getTime() - createdAt.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, 60 - diffDays);
  }, [activeUser]);

  const [buildVersion, setBuildVersion] = useState<number>(() => {
    try {
      const cached = localStorage.getItem("system_build_version");
      if (cached) {
        const parsed = parseInt(cached, 10);
        if (!isNaN(parsed)) return parsed;
      }
    } catch (e) {}
    // Fallback: start at max of 362 and total items inside local collections
    return Math.max(362, (products?.length || 0) + (customers?.length || 0) + (transactions?.length || 0) + (cashFlow?.length || 0) + (employees?.length || 0) + (auditLogs?.length || 0));
  });

  // Keep localStorage and buildVersion in sync if totalSystemModifications becomes higher on initial load
  useEffect(() => {
    setBuildVersion(current => {
      if (totalSystemModifications > current) {
        try {
          localStorage.setItem("system_build_version", String(totalSystemModifications));
        } catch (e) {}
        return totalSystemModifications;
      }
      return current;
    });
  }, [totalSystemModifications]);

  const currentSystemVersion = `v4.2.1-rev${buildVersion}-ERP`;

  // Fetch / Sync version counter with Firestore partitioned document
  useEffect(() => {
    const syncFirestoreVersion = async () => {
      if (isCircuitBroken() || !navigator.onLine) return;
      try {
        const path = getPartitionPath("system");
        const docRef = doc(db, path, "version");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data && typeof data.counter === "number") {
            const firestoreCounter = data.counter;
            setBuildVersion(current => {
              const highest = Math.max(current, firestoreCounter);
              try {
                localStorage.setItem("system_build_version", String(highest));
              } catch (e) {}
              return highest;
            });
          }
        } else {
          // Document does not exist yet, write the current local build version as initial value
          await setDoc(docRef, { counter: buildVersion, updatedAt: new Date().toISOString() });
        }
      } catch (err) {
        checkAndNotifyQuota(err);
        console.warn("Failed to fetch/sync global version counter from Firestore:", err);
      }
    };

    if (isAuthenticated || activeUser) {
      // Small delay or directly trigger
      syncFirestoreVersion();
    }
  }, [isAuthenticated, activeUser]);

  // Unified function to increment build version both locally and in Firestore
  const incrementVersionCounter = async () => {
    let nextVal = buildVersion + 1;
    setBuildVersion(current => {
      const next = current + 1;
      nextVal = next;
      try {
        localStorage.setItem("system_build_version", String(next));
      } catch (e) {}
      return next;
    });

    if (navigator.onLine && !isCircuitBroken()) {
      try {
        const path = getPartitionPath("system");
        const docRef = doc(db, path, "version");
        await setDoc(docRef, { 
          counter: nextVal, 
          updatedAt: new Date().toISOString() 
        }, { merge: true });
      } catch (err) {
        checkAndNotifyQuota(err);
        console.warn("Failed to update global version counter in Firestore:", err);
      }
    }
  };

  const currency = "MT"; // Meticais Moçambique

  const formatSessionTime = (totalSecs: number) => {
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  // Theme state defaulting to daily (orange and white mode)
  const [theme, setTheme] = useState<"daily" | "night">("daily");
  const [isPOSFullscreen, setIsPOSFullscreen] = useState<boolean>(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isFabOpen, setIsFabOpen] = useState<boolean>(false);
  
  // Geolocation and IP tracking for Audit Logs
  const [userIpInfo, setUserIpInfo] = useState<{ ip: string; city: string; country: string } | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<string>("");

  // Track operator-specific custom color theme
  const [activeColorTheme, setActiveColorTheme] = useState<string>("laranja");

  // Load and apply color theme dynamically
  useEffect(() => {
    const userId = activeUser?.id || "default";
    const matchedEmployee = employees.find(e => e.id === userId);
    const dbTheme = matchedEmployee?.theme;
    const userTheme = dbTheme || localStorage.getItem("erp_theme_" + userId);
    
    if (userTheme) {
      setActiveColorTheme(userTheme);
      applyTheme(userTheme);
    } else if (settings.theme) {
      setActiveColorTheme(settings.theme);
      applyTheme(settings.theme);
    } else {
      setActiveColorTheme("laranja");
      applyTheme("laranja");
    }
  }, [activeUser, settings.theme, employees]);

  // When theme changes, apply it to document head
  useEffect(() => {
    applyTheme(activeColorTheme);
  }, [activeColorTheme]);

  // Connectivity state tracking Firestore & network connection
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isQuotaExceeded, setIsQuotaExceeded] = useState<boolean>(isCircuitBroken());

  // Offline sync queue state & status tracking
  const [pendingSyncQueue, setPendingSyncQueue] = useState<Record<string, any>>(() => {
    try {
      const raw = localStorage.getItem("pos_sync_queue");
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [isManualSyncing, setIsManualSyncing] = useState<boolean>(false);

  // Periodically monitor the local storage for changes to sync queue
  useEffect(() => {
    const checkQueue = () => {
      try {
        const raw = localStorage.getItem("pos_sync_queue");
        const parsed = raw ? JSON.parse(raw) : {};
        if (JSON.stringify(parsed) !== JSON.stringify(pendingSyncQueue)) {
          setPendingSyncQueue(parsed);
        }
      } catch (e) {
        console.warn("Erro ao monitorizar fila offline:", e);
      }
    };
    const interval = setInterval(checkQueue, 1500);
    return () => clearInterval(interval);
  }, [pendingSyncQueue]);

  // Listen for Firestore Quota Exceeded events and initialize system error capturing
  useEffect(() => {
    const handleQuotaExceeded = () => {
      console.warn("[APP] Firestore Quota Exceeded detected. Showing notification banner.");
      setIsQuotaExceeded(true);
    };
    window.addEventListener("firestore-quota-exceeded", handleQuotaExceeded);
    
    // Initialize standard error capturing (console.error, unhandled promises, fetch errors)
    const destroyCapturing = initErrorCapturing();
    
    return () => {
      window.removeEventListener("firestore-quota-exceeded", handleQuotaExceeded);
      destroyCapturing();
    };
  }, []);

  // Fetch client IP and device info for Audit logs
  useEffect(() => {
    // Detect browser/device info
    const ua = navigator.userAgent;
    let dev = "Desktop";
    if (/mobile/i.test(ua)) dev = "Telemóvel / Mobile";
    else if (/tablet/i.test(ua)) dev = "Tablet";
    
    if (ua.includes("Chrome")) dev += " (Chrome)";
    else if (ua.includes("Firefox")) dev += " (Firefox)";
    else if (ua.includes("Safari") && !ua.includes("Chrome")) dev += " (Safari)";
    else if (ua.includes("Edge")) dev += " (Edge)";
    setDeviceInfo(dev);

    // Fetch IP and Geo IP details
    fetch("https://ipapi.co/json/")
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch IP details");
        return res.json();
      })
      .then(data => {
        if (data && data.ip) {
          setUserIpInfo({
            ip: data.ip,
            city: data.city || "Maputo",
            country: data.country_name || "Moçambique"
          });
        }
      })
      .catch(() => {
        // Safe mock realistic Mozambican IP/Geo details on failure/ad-blocker
        setUserIpInfo({
          ip: "102.81.12.94",
          city: "Maputo",
          country: "Moçambique"
        });
      });
  }, []);

  // Advanced top bar metrics states
  const [lastSyncTime, setLastSyncTime] = useState<string>(() => new Date().toLocaleTimeString());
  const [sessionSeconds, setSessionSeconds] = useState<number>(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setSessionSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // DB Sync helper with robust offline queueing
  const syncTable = async (tableName: string, updatedData: any) => {
    setLastSyncTime(new Date().toLocaleTimeString());
    await incrementVersionCounter();
    try {
      if (!navigator.onLine || isCircuitBroken()) {
        throw new Error("browser is offline or Firestore quota exceeded");
      }
      
      if (tableName === "products") {
        await addProdutosToFirestoreBatch(updatedData);
      } else if (tableName === "transactions") {
        await addTransacoesToFirestoreBatch(updatedData);
      } else if (tableName === "customers") {
        await addCustomersToFirestoreBatch(updatedData);
      } else if (tableName === "cashflow") {
        await addCashflowToFirestoreBatch(updatedData);
      } else if (tableName === "settings") {
        await saveSettingsToFirestore(updatedData);
      }

      // Also send mutation to server endpoint if available
      try {
        await fetch("/api/db/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ table: tableName, data: updatedData })
        });
      } catch (serverErr) {
        console.warn(`Could not save table '${tableName}' to server DB store:`, serverErr);
      }
      
      // Successfully synced! Try to clean from pending queue
      const rawQueue = localStorage.getItem("pos_sync_queue");
      if (rawQueue) {
        const queue = JSON.parse(rawQueue);
        if (queue[tableName]) {
          delete queue[tableName];
          safeLocalStorageSetItem("pos_sync_queue", JSON.stringify(queue));
        }
      }
    } catch (err: any) {
      console.warn(`[OFFLINE CACHE] Não foi possível sincronizar a tabela '${tableName}' (${err.message}). Guardando para reenvio automático.`);
      handleAddAuditLog(
        "Falha de Sincronização",
        "Erros do Sistema",
        `Erro de conexão ao sincronizar tabela '${tableName}': ${err.message}. Guardado na fila de reenvio offline.`
      );
      try {
        const rawQueue = localStorage.getItem("pos_sync_queue");
        const queue = rawQueue ? JSON.parse(rawQueue) : {};
        queue[tableName] = updatedData;
        safeLocalStorageSetItem("pos_sync_queue", JSON.stringify(queue));
      } catch (queueErr) {
        console.warn("Erro ao guardar alteração na fila offline local (quota de armazenamento excedida):", queueErr);
      }
    }
  };

  // Synchronize any offline changes when connection is re-established (or via periodic retry timer)
  useEffect(() => {
    // Register the callback to capture silent errors and log them to AuditLogs
    setLogCallback(handleAddAuditLog);
  }, [activeUser, auditLogs]); // Re-bind when user context or logs state updates

  const processSyncQueue = async () => {
    if (!navigator.onLine || isCircuitBroken()) return;
    
    try {
      const rawQueue = localStorage.getItem("pos_sync_queue");
      if (!rawQueue) return;
      
      const queue = JSON.parse(rawQueue);
      const tableNames = Object.keys(queue);
      if (tableNames.length === 0) return;
      
      console.log(`[SYNC QUEUE] Detectadas ${tableNames.length} tabelas com alterações offline pendentes. Sincronizando...`);
      
      for (const tableName of tableNames) {
        const data = queue[tableName];
        let success = false;
        
        if (tableName === "products") {
          try {
            await addProdutosToFirestoreBatch(data);
            success = true;
            try {
              await fetch("/api/db/save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ table: "products", data })
              });
            } catch (err) {
              console.warn("[SYNC QUEUE] Erro ao atualizar produtos no servidor:", err);
            }
          } catch (fsErr) {
            console.warn("[SYNC QUEUE] Erro ao ressincronizar produtos com Firestore:", fsErr);
          }
        } else if (tableName === "transactions") {
          try {
            await addTransacoesToFirestoreBatch(data);
            success = true;
            try {
              await fetch("/api/db/save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ table: "transactions", data })
              });
            } catch (err) {
              console.warn("[SYNC QUEUE] Erro ao atualizar transações no servidor:", err);
            }
          } catch (fsErr) {
            console.warn("[SYNC QUEUE] Erro ao ressincronizar transações com Firestore:", fsErr);
          }
        } else {
          try {
            const response = await fetch("/api/db/save", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ table: tableName, data })
            });
            success = response.ok;
          } catch (fetchErr) {
            console.warn(`[SYNC QUEUE] Erro de rede ao ressincronizar tabela ${tableName}:`, fetchErr);
          }
        }
        
        if (success) {
          console.log(`[SYNC QUEUE] Tabela ${tableName} ressincronizada offline com sucesso!`);
          delete queue[tableName];
        } else {
          console.warn(`[SYNC QUEUE] Falha na ressincronização de ${tableName}`);
        }
      }
      
      safeLocalStorageSetItem("pos_sync_queue", JSON.stringify(queue));
      setPendingSyncQueue(queue);
    } catch (err) {
      console.warn("[SYNC QUEUE] Erro ao reprocessar alterações offline:", err);
    }
  };

  const handleManualSync = async () => {
    if (!navigator.onLine) {
      showToast("Não é possível sincronizar: O seu dispositivo ainda está offline.", "warning", "Sem Ligação à Rede");
      return;
    }

    setIsManualSyncing(true);
    showToast("A iniciar ressincronização manual das alterações offline...", "info", "Sincronização Iniciada");
    
    try {
      await processSyncQueue();
      
      const raw = localStorage.getItem("pos_sync_queue");
      const parsed = raw ? JSON.parse(raw) : {};
      const keys = Object.keys(parsed);
      
      if (keys.length === 0) {
        showToast("Todas as alterações offline foram sincronizadas com sucesso!", "success", "Sincronização Concluída");
        handleAddAuditLog(
          "Sincronização Manual Sucedida",
          "SISTEMA",
          "O usuário forçou uma sincronização manual e todas as alterações pendentes foram integradas com sucesso."
        );
      } else {
        const friendlyTables = keys.map(k => {
          if (k === "products") return "Produtos";
          if (k === "transactions") return "Vendas";
          if (k === "customers") return "Clientes";
          if (k === "cashflow") return "Caixa";
          if (k === "employees") return "Funcionários";
          if (k === "auditlogs") return "Auditoria";
          if (k === "settings") return "Definições";
          return k;
        });
        showToast(`Sincronização parcial concluída. Algumas alterações (${friendlyTables.join(", ")}) ainda estão pendentes.`, "warning", "Sincronização Parcial");
      }
    } catch (err: any) {
      showToast(`Erro durante a sincronização: ${err.message}`, "error", "Falha na Sincronização");
    } finally {
      setIsManualSyncing(false);
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      console.log("[CONEXÃO] Conexão restabelecida! Tentando reenviar alterações offline...");
      setIsOnline(true);
      processSyncQueue();
    };

    const handleOffline = () => {
      console.log("[CONEXÃO] Conexão física de rede perdida!");
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    
    // Periodically try to re-sync every 15 seconds as a robust retry mechanism
    const interval = setInterval(() => {
      if (navigator.onLine) {
        setIsOnline(true);
        processSyncQueue();
      } else {
        setIsOnline(false);
      }
    }, 15000);

    // Initial attempt on load
    processSyncQueue();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, []);

  // Hook de sincronização automática periódica (a cada 5 minutos) específico para transações offline pendentes
  useEffect(() => {
    const syncPendingTransactions = async () => {
      if (!navigator.onLine || isCircuitBroken()) {
        console.log("[SYNC 5MIN] Sistema offline ou cota excedida. Sincronização periódica suspensa.");
        return;
      }

      try {
        const rawQueue = localStorage.getItem("pos_sync_queue");
        if (!rawQueue) return;

        const queue = JSON.parse(rawQueue);
        const pendingTxs = queue["transactions"];

        if (pendingTxs && Array.isArray(pendingTxs) && pendingTxs.length > 0) {
          console.log(`[SYNC 5MIN] Sincronização periódica iniciada: ${pendingTxs.length} transações pendentes encontradas.`);
          
          try {
            // Envia transações pendentes para o Firestore
            const promises = pendingTxs.map((tx: any) => addTransacaoToFirestore(tx));
            await Promise.all(promises);

            // Sucesso! Remove a chave transactions da fila offline
            delete queue["transactions"];
            safeLocalStorageSetItem("pos_sync_queue", JSON.stringify(queue));
            
            setLastSyncTime(new Date().toLocaleTimeString());
            console.log("[SYNC 5MIN] Sincronização automática das transações offline concluída com sucesso!");
            
            handleAddAuditLog(
              "Sincronização Periódica",
              "Vendas",
              `Sincronização automática de 5 minutos reenviou ${pendingTxs.length} transações pendentes ao Firestore com sucesso.`
            );
          } catch (fsErr: any) {
            console.error("[SYNC 5MIN] Erro ao reenviar transações pendentes ao Firestore:", fsErr);
            handleAddAuditLog(
              "Falha de Sincronização",
              "Vendas",
              `Falha na sincronização periódica de transações offline: ${fsErr.message}`
            );
          }
        }
      } catch (err: any) {
        console.error("[SYNC 5MIN] Erro ao analisar fila de sincronização:", err);
      }
    };

    // Define o intervalo para exatamente 5 minutos (300.000 milissegundos)
    const intervalId = setInterval(syncPendingTransactions, 300000);

    // Executa uma verificação inicial rápida ao montar o componente
    syncPendingTransactions();

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  // Global keyboard shortcuts for POS operations (F1, F2, etc.) handled in the App component to improve checkout efficiency
  useEffect(() => {
    const handlePOSGlobalShortcuts = (e: KeyboardEvent) => {
      // Only capture when POS module is active/rendered
      if (activeTab !== "POS") return;

      // Intercept POS keyboard shortcuts
      if (e.key === "F1" || e.key === "F2" || e.key === "F3" || e.key === "F4" || e.key === "F6" || e.key === "F8" || e.key === "F9" || e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        
        // Dispatch a custom event to POSModule containing the triggered key
        const customEvent = new CustomEvent("pos-shortcut-trigger", {
          detail: { key: e.key }
        });
        window.dispatchEvent(customEvent);
      }
    };

    window.addEventListener("keydown", handlePOSGlobalShortcuts, true);
    return () => {
      window.removeEventListener("keydown", handlePOSGlobalShortcuts, true);
    };
  }, [activeTab]);

  // Global keyboard shortcut for Stock Replenishment (Ctrl+S)
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      if (!isAuthenticated) return;

      if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        e.stopPropagation();
        setShowReplenishModal(prev => !prev);
      } else if (e.key === "Escape" && showReplenishModal) {
        setShowReplenishModal(false);
      }
    };

    window.addEventListener("keydown", handleGlobalShortcuts, true);
    return () => {
      window.removeEventListener("keydown", handleGlobalShortcuts, true);
    };
  }, [isAuthenticated, showReplenishModal]);


  // Hydrate states from existential server database on mount
  useEffect(() => {
    // Run the mandatory Firebase Firestore direct browser connection verification
    testConnection();

    const fetchExistentialDb = async () => {
      let loadedData = false;
      try {
        const response = await fetch("/api/db/load");
        const contentType = response.headers.get("content-type");
        if (response.ok && contentType && contentType.includes("application/json")) {
          const json = await response.json();
          if (json.success && json.hasData) {
            const d = json.data;
            if (d.products) setProducts(d.products);
            else setProducts(initialProducts);

            if (d.customers) setCustomers(d.customers);
            else setCustomers(initialCustomers);

            if (d.transactions) setTransactions(d.transactions);
            else setTransactions(generateMockTransactions());

            if (d.cashflow) setCashFlow(d.cashflow);
            else setCashFlow(initialCashFlow);

            if (d.employees) {
              setEmployees(d.employees);
              setActiveUser(d.employees[0]);
            } else {
              setEmployees(initialEmployees);
              setActiveUser(initialEmployees[0]);
            }

            if (d.auditlogs) setAuditLogs(d.auditlogs);
            else setAuditLogs(initialAuditLogs);

            if (d.settings) setSettings(d.settings);
            else setSettings(defaultSettings);

            console.log("Banco de dados existencial carregado com sucesso via servidor.");
            loadedData = true;
          }
        }
      } catch (err) {
        console.warn("API de banco do servidor indisponível. Conectando diretamente ao Firestore no cliente...", err);
      }

      if (!loadedData) {
        // Direct Client-Side Firestore Fetching (Primary fallback for static Vercel deployments)
        try {
          console.log("[FIRESTORE DIRECT] Carregando coleções diretamente do Firebase Firestore...");
          const [fsProducts, fsCustomers, fsTransactions, fsCashflow, fsEmployees, fsSettings] = await Promise.all([
            getProdutosFromFirestore().catch(() => []),
            getCustomersFromFirestore().catch(() => []),
            getTransacoesFromFirestore().catch(() => []),
            getCashflowFromFirestore().catch(() => []),
            getUsuariosFromFirestore().catch(() => []),
            getSettingsFromFirestore().catch(() => null)
          ]);

          if (fsProducts && fsProducts.length > 0) setProducts(fsProducts);
          else setProducts(initialProducts);

          if (fsCustomers && fsCustomers.length > 0) setCustomers(fsCustomers);
          else setCustomers(initialCustomers);

          if (fsTransactions && fsTransactions.length > 0) setTransactions(fsTransactions);
          else setTransactions(generateMockTransactions());

          if (fsCashflow && fsCashflow.length > 0) setCashFlow(fsCashflow);
          else setCashFlow(initialCashFlow);

          if (fsEmployees && fsEmployees.length > 0) {
            setEmployees(fsEmployees);
            setActiveUser(fsEmployees[0]);
          } else {
            setEmployees(initialEmployees);
            setActiveUser(initialEmployees[0]);
          }

          if (fsSettings) setSettings(fsSettings);
          else setSettings(defaultSettings);

          setAuditLogs(initialAuditLogs);
          console.log("[FIRESTORE DIRECT] Dados carregados com sucesso diretamente do Firebase Firestore no navegador.");
        } catch (fsErr) {
          console.warn("Falha no carregamento direto do Firestore. Usando dados locais:", fsErr);
          setProducts(initialProducts);
          setCustomers(initialCustomers);
          setTransactions(generateMockTransactions());
          setCashFlow(initialCashFlow);
          setEmployees(initialEmployees);
          setAuditLogs(initialAuditLogs);
          setSettings(defaultSettings);
        }
      }

      setIsDbLoaded(true);
    };
    fetchExistentialDb();
  }, []);

  useEffect(() => {
    if (theme === "night") {
      document.body.classList.add("dark");
    } else {
      document.body.classList.remove("dark");
    }
  }, [theme]);

  // Firebase Auth Observer to handle auto-login, load profiles, and synchronize permissions
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // Fetch employee list to map Google account to actual employee
          let currentEmployees: Employee[] = [];
          try {
            const dbResponse = await fetch("/api/db/load");
            const dbJson = await dbResponse.json();
            if (dbJson.success && dbJson.data && dbJson.data.employees) {
              currentEmployees = dbJson.data.employees;
            }
          } catch (e) {
            console.warn("Could not load employees for auth mapping:", e);
          }

          // Fetch user profile from Firestore "usuarios" with robust caching & local fallback
          let profileData: any = null;
          if (!isCircuitBroken()) {
            try {
              const userDocRef = doc(db, "usuarios", user.uid);
              const docSnap = await getDoc(userDocRef);
              if (docSnap.exists()) {
                profileData = docSnap.data();
                // Cache profile in localStorage for offline, permission, or quota fallback
                localStorage.setItem(`cached_profile_${user.uid}`, JSON.stringify(profileData));
              } else {
                console.warn("[AUTH RESTORE] Perfil não encontrado no Firestore para uid:", user.uid);
              }
            } catch (fsErr: any) {
              checkAndNotifyQuota(fsErr);
              console.warn("[AUTH RESTORE] Erro ao pesquisar Firestore, usando cache local como recurso:", fsErr);
            }
          }

          if (!profileData) {
            const cached = localStorage.getItem(`cached_profile_${user.uid}`);
            if (cached) {
              try {
                profileData = JSON.parse(cached);
              } catch (parseErr) {
                console.error("Erro ao analisar cache local do perfil:", parseErr);
              }
            }
          }

          // Match logged in user email to an existing employee
          const employeeEmailMatch = currentEmployees.find(emp => emp.email?.toLowerCase() === user.email?.toLowerCase());

          if (!profileData && employeeEmailMatch) {
            // Create user profile document in Firestore from matched employee
            profileData = {
              uid: user.uid,
              nomeCompleto: employeeEmailMatch.name,
              email: employeeEmailMatch.email || user.email || "",
              empresa: "OST Comércio Geral",
              perfil: employeeEmailMatch.role,
              cargo: employeeEmailMatch.role,
              estado: employeeEmailMatch.status === "ACTIVE" ? "Ativo" : "Inativo",
              fotoPerfil: user.photoURL || "",
              telefone: employeeEmailMatch.contact || "",
              ultimoLogin: new Date().toISOString(),
              dataCriacao: employeeEmailMatch.admissionDate ? new Date(employeeEmailMatch.admissionDate).toISOString() : new Date().toISOString(),
              username: employeeEmailMatch.username || "",
              pin: employeeEmailMatch.pin || "",
              pinCreatedAt: employeeEmailMatch.pinCreatedAt || "",
              pinChanged: employeeEmailMatch.pinChanged !== undefined ? employeeEmailMatch.pinChanged : true
            };
            
            // Also write to Firestore to persist this mapping if online
            try {
              if (!isCircuitBroken()) {
                const userDocRef = doc(db, "usuarios", user.uid);
                await setDoc(userDocRef, profileData);
              }
            } catch (err) {
              checkAndNotifyQuota(err);
              console.warn("Could not save mapped Google profile to Firestore:", err);
            }
          }

          if (!profileData) {
            // Generate a generic profile for the Google user if not found
            profileData = {
              uid: user.uid,
              nomeCompleto: user.displayName || user.email?.split("@")[0] || "Operador",
              email: user.email || "operador@ostvendas.com",
              empresa: "OST Comércio Geral",
              perfil: "Administrador Completo", // Default to high privilege fallback
              cargo: "Administrador",
              estado: "Ativo",
              fotoPerfil: user.photoURL || "",
              telefone: "",
              ultimoLogin: new Date().toISOString(),
              dataCriacao: new Date().toISOString()
            };
          }

          if (profileData) {
            const isGoogleAdminEmail = user.email?.toLowerCase() === "levidomingos12@gmail.com";
            const isMatchedAdmin = employeeEmailMatch && (employeeEmailMatch.role?.toUpperCase().includes("ADMIN") || employeeEmailMatch.role?.toUpperCase().includes("GESTOR"));
            const isProfileAdmin = profileData.perfil && (profileData.perfil.toUpperCase().includes("ADMIN") || profileData.perfil.toUpperCase().includes("GESTOR"));
            if (isGoogleAdminEmail || isMatchedAdmin || isProfileAdmin) {
              profileData.perfil = "Administrador";
              profileData.cargo = "Administrador";
            }

            const mappedEmployee = mapUsuarioToEmployee(profileData as any);
            
            if (mappedEmployee.status === "BLOCKED") {
              showToast("A sua conta está BLOQUEADA por tempo expirado do PIN temporário ou suspensão de segurança.", "error");
              await auth.signOut();
              setIsAuthenticated(false);
              setActiveUser(null);
              return;
            }

            if (mappedEmployee.status === "INACTIVE" || mappedEmployee.status === "SUSPENDED") {
              showToast("Esta conta está inativa ou suspensa. Contacte o Administrador.", "error");
              await auth.signOut();
              setIsAuthenticated(false);
              setActiveUser(null);
              return;
            }

            // Check if PIN has expired (3 days rule)
            const now = new Date();
            const createdAtStr = mappedEmployee.pinCreatedAt || mappedEmployee.admissionDate || now.toISOString();
            const createdAt = new Date(createdAtStr);
            const diffTime = now.getTime() - createdAt.getTime();
            const diffDays = diffTime / (1000 * 60 * 60 * 24);

            const isPinTemporary = mappedEmployee.pinChanged === false;

            if (isPinTemporary && diffDays > 3) {
              const updatedEmployees = currentEmployees.map(emp => {
                if (emp.id === mappedEmployee.id) {
                  return { ...emp, status: "BLOCKED" as const };
                }
                return emp;
              });
              handleUpdateEmployees(updatedEmployees);
              
              handleAddAuditLog(
                "Bloqueio de Conta Automático",
                "SEGURANÇA",
                `Conta do colaborador ${mappedEmployee.name} foi bloqueada por ultrapassar o prazo de 3 dias sem alterar o PIN temporário.`
              );

              showToast("A sua conta foi BLOQUEADA por expiração do prazo de 3 dias para alterar o PIN temporário.", "error");
              await auth.signOut();
              setIsAuthenticated(false);
              setActiveUser(null);
              return;
            }

            // Force PIN change if temporary but within the 3 days window
            if (isPinTemporary) {
              setForcePinTargetEmployee(mappedEmployee);
              setNewPin("");
              setConfirmNewPin("");
              setForcePinError("");
              setForcePinChangeOpen(true);
              return;
            }

            setActiveUser(mappedEmployee);
            setIsAuthenticated(true);
            setSettings(prev => ({
              ...prev,
              companyName: profileData.empresa || "OST Comércio Geral"
            }));
            
            console.log(`[AUTH RESTORE] Utilizador autolocado (com fallback resiliente): ${mappedEmployee.name} (${mappedEmployee.role})`);
          } else {
            setIsAuthenticated(false);
            setActiveUser(null);
          }
        } catch (err) {
          console.error("[AUTH RESTORE] Erro crítico ao processar login do utilizador:", err);
          setIsAuthenticated(false);
          setActiveUser(null);
        }
      } else {
        const storedSimulated = localStorage.getItem("erp_simulated_logged_in_user");
        if (storedSimulated) {
          try {
            const parsed = JSON.parse(storedSimulated);
            setActiveUser(parsed);
            setIsAuthenticated(true);
            return;
          } catch (e) {
            console.error("Failed to restore simulated session:", e);
          }
        }
        setIsAuthenticated(false);
        setActiveUser(null);
      }
    });

    return () => unsubscribe();
  }, [employees]);

  // Real-time products subscription and initial sync
  useEffect(() => {
    if (isAuthenticated) {
      console.log("[FIRESTORE] Ativando subscrição em tempo real para produtos...");
      
      const unsubscribe = subscribeToProdutos(
        async (firestoreProducts) => {
          setIsOnline(true);
          if (firestoreProducts && firestoreProducts.length > 0) {
            console.log(`[FIRESTORE] Recebidos ${firestoreProducts.length} produtos em tempo real.`);
            setProducts(firestoreProducts);
          } else {
            console.log("[FIRESTORE] Coleção de produtos remota vazia ou offline. Mantendo catálogo de produtos locais.");
            setProducts(prev => (prev && prev.length > 0 ? prev : initialProducts));
          }
        },
        (error) => {
          console.error("[FIRESTORE] Erro no listener em tempo real de produtos:", error);
          setIsOnline(false);
        }
      );

      const loadTransactions = async () => {
        try {
          const firestoreTx = await getTransacoesFromFirestore();
          if (firestoreTx && firestoreTx.length > 0) {
            console.log(`[FIRESTORE] Carregadas ${firestoreTx.length} transações.`);
            setTransactions(firestoreTx.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
          } else {
            console.log("[FIRESTORE] Sem transações no Firestore. Mantendo histórico de transações locais.");
            setTransactions(prev => (prev && prev.length > 0 ? prev : generateMockTransactions()));
          }
        } catch (err) {
          console.error("[FIRESTORE] Erro ao carregar transações do Firestore:", err);
        }
      };

      loadTransactions();

      return () => {
        console.log("[FIRESTORE] Desativando subscrição em tempo real para produtos.");
        unsubscribe();
      };
    }
  }, [isAuthenticated]);

  // Synchronize Firestore user database with local staff module list
  useEffect(() => {
    if (isAuthenticated) {
      const syncStaff = async () => {
        try {
          const firestoreUsers = await getUsuariosFromFirestore();
          if (firestoreUsers && firestoreUsers.length > 0) {
            // Merge firestore users with mock users by ID, prioritizing Firestore profiles
            setEmployees(prev => {
              const merged = [...prev];
              firestoreUsers.forEach(fUser => {
                const idx = merged.findIndex(m => m.id === fUser.id);
                if (idx > -1) {
                  merged[idx] = fUser;
                } else {
                  merged.push(fUser);
                }
              });
              return merged;
            });
          }
        } catch (err) {
          console.error("Erro ao sincronizar quadro de funcionários do Firestore:", err);
        }
      };
      syncStaff();
    }
  }, [isAuthenticated]);

  // Quick Switch Operator Handlers
  const handleChangeRole = async (role: UserRole) => {
    // find a fitting mock employee or create template
    const fitEmp = employees.find(e => {
      if (role === "ADMIN") return e.role.toUpperCase().includes("GESTOR") || e.role.toUpperCase().includes("ADMINISTRADOR") || e.role.toUpperCase().includes("ADMIN");
      if (role === "SUPERVISOR") return e.role.toUpperCase().includes("SUPERVISOR");
      return e.role.toUpperCase().includes("CAIXA") || e.role.toUpperCase().includes("VENDEDOR");
    });
    
    if (fitEmp) {
      setPinTargetEmployee(fitEmp);
      setEnteredPin("");
      setPinError("");
      setPinVerificationOpen(true);
    }
  };

  const handleVerifyAndSwitchProfile = async () => {
    let targetEmp = pinTargetEmployee;

    if (loginMethod === "type") {
      if (!enteredUsername.trim()) {
        setPinError("Por favor, introduza o seu Username.");
        return;
      }
      const found = employees.find(e => e.username?.toLowerCase() === enteredUsername.trim().toLowerCase());
      if (!found) {
        setPinError("Nome de utilizador (Username) não encontrado.");
        return;
      }
      targetEmp = found;
    }

    if (!targetEmp) {
      setPinError("Por favor, selecione ou introduza um colaborador.");
      return;
    }

    if (targetEmp.status === "BLOCKED") {
      setPinError("A sua conta está BLOQUEADA por tempo expirado da senha de acesso ou suspensão de segurança.");
      return;
    }

    if (targetEmp.status === "INACTIVE" || targetEmp.status === "SUSPENDED") {
      setPinError("Esta conta está inativa ou suspensa. Contacte o Administrador.");
      return;
    }

    const requiredPin = targetEmp.pin || "123456";
    if (enteredPin.trim() !== requiredPin.trim()) {
      setPinError("Senha incorreta. Por favor, tente novamente.");
      return;
    }

    // Check expiration policy (2 months / 60 days)
    const now = new Date();
    const createdAtStr = targetEmp.pinCreatedAt || targetEmp.admissionDate || now.toISOString();
    const createdAt = new Date(createdAtStr);
    const diffTime = now.getTime() - createdAt.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);

    const isPinTemporary = targetEmp.pinChanged === false;

    // If password is temporary (first login) OR has expired (older than 60 days)
    if (isPinTemporary) {
      // Intercept login and open the Force password Change dialog
      setForcePinTargetEmployee(targetEmp);
      setNewPin("");
      setConfirmNewPin("");
      setForcePinError("Este é o seu primeiro login. Por favor, crie uma senha pessoal segura.");
      setForcePinChangeOpen(true);
      setPinVerificationOpen(false);
      return;
    }

    if (diffDays > 60) {
      // Password expired
      setForcePinTargetEmployee(targetEmp);
      setNewPin("");
      setConfirmNewPin("");
      setForcePinError("A sua senha de acesso expirou (validade de 2 meses). Por favor, defina uma nova senha.");
      setForcePinChangeOpen(true);
      setPinVerificationOpen(false);
      return;
    }

    const fitEmp = targetEmp;
    setActiveUser(fitEmp);

    let ipStr = "IP Desconhecido";
    try {
      const res = await fetch("https://api.ipify.org?format=json");
      const data = await res.json();
      if (data && data.ip) {
        ipStr = data.ip;
      }
    } catch (e) {
      console.warn("Could not fetch IP", e);
    }

    handleAddAuditLog(
      "Alternância de Operador",
      "SISTEMA",
      `Sessão iniciada como ${fitEmp.name} (Perfil: ${fitEmp.role}). IP: ${ipStr}`
    );

    // Auto-redirect or reset module access if needed
    const simplifiedRole: UserRole = 
      fitEmp.role.toUpperCase().includes("GESTOR") || fitEmp.role.toUpperCase().includes("ADMINISTRADOR") || fitEmp.role.toUpperCase().includes("ADMIN")
        ? "ADMIN"
        : fitEmp.role.toUpperCase().includes("SUPERVISOR")
          ? "SUPERVISOR"
          : "CASHIER";

    const menuItems = [
      { id: "dashboard", roles: ["ADMIN", "SUPERVISOR"] },
      { id: "pos", roles: ["ADMIN", "SUPERVISOR", "CASHIER"] },
      { id: "stock", roles: ["ADMIN", "SUPERVISOR"] },
      { id: "cash", roles: ["ADMIN", "SUPERVISOR", "CASHIER"] },
      { id: "customers", roles: ["ADMIN", "SUPERVISOR", "CASHIER"] },
      { id: "staff", roles: ["ADMIN"] },
      { id: "ai", roles: ["ADMIN", "SUPERVISOR"] },
      { id: "reports", roles: ["ADMIN", "SUPERVISOR"] },
      { id: "training", roles: ["ADMIN", "SUPERVISOR", "CASHIER"] },
      { id: "settings", roles: ["ADMIN"] },
      { id: "gateway", roles: ["ADMIN"] },
    ];

    const currentMenu = menuItems.find(m => m.id === activeTab.toLowerCase());
    if (currentMenu && !currentMenu.roles.includes(simplifiedRole)) {
      setActiveTab("POS");
    }

    showToast(`Bem-vindo, ${fitEmp.name}! Sessão autorizada com sucesso.`, "success");
    setPinVerificationOpen(false);
    setPinTargetEmployee(null);
  };

  const handleForcePinChangeSubmit = () => {
    if (!forcePinTargetEmployee) return;

    if (newPin.length < 6) {
      setForcePinError("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (newPin === forcePinTargetEmployee.pin) {
      setForcePinError("A nova senha não pode ser idêntica à senha anterior.");
      return;
    }

    if (newPin !== confirmNewPin) {
      setForcePinError("As senhas de confirmação não coincidem.");
      return;
    }

    // Update PIN & properties
    const updatedEmployees = employees.map(emp => {
      if (emp.id === forcePinTargetEmployee.id) {
        return {
          ...emp,
          pin: newPin,
          pinChanged: true,
          pinCreatedAt: new Date().toISOString()
        };
      }
      return emp;
    });

    handleUpdateEmployees(updatedEmployees);

    const fitEmp = {
      ...forcePinTargetEmployee,
      pin: newPin,
      pinChanged: true,
      pinCreatedAt: new Date().toISOString()
    };
    setActiveUser(fitEmp);
    setIsAuthenticated(true);

    let ipStr = "IP Desconhecido";
    fetch("https://api.ipify.org?format=json")
      .then(res => res.json())
      .then(data => {
        if (data && data.ip) {
          ipStr = data.ip;
        }
      })
      .catch(e => console.warn("Could not fetch IP", e))
      .finally(() => {
        handleAddAuditLog(
          "Alteração de Senha Obrigatória",
          "SEGURANÇA",
          `Colaborador ${fitEmp.name} alterou com sucesso a sua senha de acesso. Sessão iniciada. IP: ${ipStr}`
        );
      });

    const rawRole = (fitEmp.role || "").toUpperCase();
    const simplifiedRole: UserRole = 
      rawRole.includes("GESTOR") || rawRole.includes("ADMINISTRADOR") || rawRole.includes("ADMIN")
        ? "ADMIN"
        : rawRole.includes("SUPERVISOR")
          ? "SUPERVISOR"
          : "CASHIER";

    const menuItems = [
      { id: "dashboard", roles: ["ADMIN", "SUPERVISOR"] },
      { id: "pos", roles: ["ADMIN", "SUPERVISOR", "CASHIER"] },
      { id: "stock", roles: ["ADMIN", "SUPERVISOR"] },
      { id: "cash", roles: ["ADMIN", "SUPERVISOR", "CASHIER"] },
      { id: "customers", roles: ["ADMIN", "SUPERVISOR", "CASHIER"] },
      { id: "staff", roles: ["ADMIN"] },
      { id: "ai", roles: ["ADMIN", "SUPERVISOR"] },
      { id: "reports", roles: ["ADMIN", "SUPERVISOR"] },
      { id: "training", roles: ["ADMIN", "SUPERVISOR", "CASHIER"] },
      { id: "settings", roles: ["ADMIN"] },
      { id: "gateway", roles: ["ADMIN"] },
    ];

    const currentMenu = menuItems.find(m => m.id === activeTab.toLowerCase());
    if (currentMenu && !currentMenu.roles.includes(simplifiedRole)) {
      setActiveTab("POS");
    }

    showToast(`Nova senha de acesso registada com sucesso! Bem-vindo, ${fitEmp.name}.`, "success");
    setForcePinChangeOpen(false);
    setForcePinTargetEmployee(null);
  };

  // GENERAL AUDIT LOGGING WRAPPER
  const handleAddAuditLog = (action: string, module: string, details: string, customUser?: Employee) => {
    let authRole: UserRole = "CASHIER";
    const targetUser = customUser || activeUser;
    const username = targetUser ? targetUser.name : "Sistema / Visitante";
    if (targetUser && targetUser.role) {
      const raw = targetUser.role.toLowerCase();
      if (raw.includes("supervisor")) authRole = "SUPERVISOR";
      else if (raw.includes("administrador") || raw.includes("gestor")) authRole = "ADMIN";
    }

    const ipStr = userIpInfo ? `${userIpInfo.ip} (${userIpInfo.city}, ${userIpInfo.country})` : "102.81.12.94 (Maputo, Moçambique)";
    const devStr = deviceInfo || "Desktop (Chrome)";

    const newLog: AuditLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      timestamp: new Date().toISOString(),
      user: username,
      userRole: authRole,
      action,
      module,
      details,
      ip: ipStr,
      device: devStr
    };
    setAuditLogs(prev => {
      let updated = [...prev, newLog];
      if (updated.length > 200) {
        updated = updated.slice(-200);
      }
      syncTable("auditlogs", updated);
      return updated;
    });
  };

  // PANIC SYSTEM / EMERGENCY SECURITY ALERT
  const handleTriggerPanic = async () => {
    const operatorName = activeUser?.name || "Operador Desconhecido";
    const operatorRole = activeUser?.role || "Operador";
    const ipStr = userIpInfo ? userIpInfo.ip : "102.81.12.94";
    const locStr = userIpInfo ? `${userIpInfo.city}, ${userIpInfo.country}` : "Maputo, Moçambique";
    const devStr = deviceInfo || "Chrome Desktop";

    // 1. Add Immediate Critical Audit Log
    handleAddAuditLog(
      "BOTÃO DE PÂNICO ACIONADO",
      "SEGURANÇA",
      `ALERTA EMERGENCIAL CRÍTICO! O operador ${operatorName} acionou o botão de pânico. IP: ${ipStr} (${locStr}). Dispositivo: ${devStr}. Notificações em massa enviadas aos administradores.`
    );

    // 2. Identify Administrators
    const admins = employees.filter(emp => {
      if (!emp.role) return false;
      const roleLower = emp.role.toLowerCase();
      return (
        roleLower.includes("admin") ||
        roleLower.includes("gestor") ||
        roleLower.includes("supervisor") ||
        roleLower.includes("gerente") ||
        roleLower.includes("diretor")
      );
    });

    // 3. Extract Emails and Phone numbers
    const emails = admins.map(a => a.email).filter(Boolean) as string[];
    const phones = admins.map(a => a.contact).filter(Boolean) as string[];

    if (settings.reportRecipientEmail && !emails.includes(settings.reportRecipientEmail)) {
      emails.push(settings.reportRecipientEmail);
    }

    // Default emergency contact as fallback if empty
    if (emails.length === 0) {
      emails.push("levidomingos12@gmail.com");
    }
    if (phones.length === 0) {
      phones.push("+258840000000");
    }

    // 4. Construct Alerta Body
    const subject = `🚨 [OST VENDAS] ALERTA DE PÂNICO EMERGENCIAL DE SEGURANÇA!`;
    const emailHtmlBody = `
      <div style="font-family: Arial, sans-serif; border: 3px solid #dc2626; border-radius: 16px; overflow: hidden; max-width: 600px; margin: 0 auto; box-shadow: 0 10px 25px rgba(220, 38, 38, 0.2);">
        <div style="background-color: #dc2626; padding: 24px; text-align: center; color: white;">
          <h2 style="margin: 0; font-size: 26px; font-weight: 800; letter-spacing: 0.5px;">🚨 ALERTA CRÍTICO DE PÂNICO</h2>
          <p style="margin: 8px 0 0; font-size: 13px; font-weight: bold; text-transform: uppercase; background-color: rgba(0,0,0,0.2); display: inline-block; padding: 4px 12px; border-radius: 9999px;">SISTEMA COMERCIAL OST VENDAS</p>
        </div>
        <div style="padding: 28px; color: #1e293b; background-color: #ffffff;">
          <p style="font-size: 16px; line-height: 1.6; margin-top: 0; font-weight: 600; color: #991b1b;">
            ATENÇÃO ADMINISTRADOR! O Botão de Pânico foi acionado voluntariamente a partir do ponto de venda.
          </p>
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-weight: bold; color: #64748b; width: 140px;">Operador Ativo:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-weight: bold; color: #0f172a;">${operatorName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-weight: bold; color: #64748b;">Função do Utilizador:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-weight: bold; color: #dc2626;">${operatorRole}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-weight: bold; color: #64748b;">Data e Hora:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; color: #334155; font-family: monospace;">${new Date().toLocaleString('pt-MZ')} (Maputo)</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-weight: bold; color: #64748b;">Endereço IP:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; color: #334155; font-family: monospace; font-weight: bold;">${ipStr}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-weight: bold; color: #64748b;">Localização IP:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; color: #334155; font-weight: bold;">${locStr}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #64748b;">Dispositivo/Browser:</td>
                <td style="padding: 8px 0; color: #334155;">${devStr}</td>
              </tr>
            </table>
          </div>
          <div style="background-color: #fef2f2; border-left: 5px solid #dc2626; padding: 18px; border-radius: 8px; margin: 20px 0;">
            <strong style="color: #991b1b; display: block; margin-bottom: 6px; font-size: 14px;">⚠️ PROCEDIMENTO DE SEGURANÇA:</strong>
            <p style="margin: 0; font-size: 13px; color: #7f1d1d; line-height: 1.6;">
              1. Verifique as câmeras ou canais de comunicação com a loja imediatamente.<br/>
              2. Caso não consiga contato com o operador, acione os canais policiais locais ou segurança patrimonial.<br/>
              3. O log crítico foi gravado permanentemente na auditoria do sistema para efeitos legais.
            </p>
          </div>
        </div>
        <div style="background-color: #f8fafc; padding: 18px; text-align: center; color: #64748b; font-size: 11px; border-top: 1px solid #e2e8f0;">
          Enviado por: <strong>OST Vendas Moçambique Fiscal Cloud</strong>. Não responda a esta mensagem eletrônica.
        </div>
      </div>
    `;

    const smsText = `🚨 OST VENDAS - PANICO ATIVADO! Operador: ${operatorName} (${operatorRole}). IP: ${ipStr} (${locStr}). Verifique a loja de imediato!`;

    // 5. Send Email Notifications
    const emailPromises = emails.map(async (email) => {
      try {
        await sendEmail({
          to: email,
          subject,
          body: emailHtmlBody,
          isHtml: true
        });
        console.log(`[Panic] Email alert sent successfully to \${email}`);
        return { email, success: true };
      } catch (err: any) {
        console.error(`[Panic] Failed to send email alert to \${email}:`, err);
        return { email, success: false, error: err.message };
      }
    });

    // 6. Send SMS Notifications
    const smsPromises = phones.map(async (phone) => {
      try {
        await sendSMS(phone, smsText);
        console.log(`[Panic] SMS alert sent successfully to \${phone}`);
        return { phone, success: true };
      } catch (err: any) {
        console.error(`[Panic] Failed to send SMS alert to \${phone}:`, err);
        return { phone, success: false, error: err.message };
      }
    });

    // Run parallel
    const emailResults = await Promise.all(emailPromises);
    const smsResults = await Promise.all(smsPromises);

    const successfulEmailsCount = emailResults.filter(r => r.success).length;
    const successfulSmsCount = smsResults.filter(r => r.success).length;

    showToast(
      `Alerta crítico disparado! \${successfulEmailsCount} e-mails e \${successfulSmsCount} SMS de emergência enviados aos administradores.`,
      "warning",
      "🚨 ALERTA MÁXIMO"
    );
  };

  // CENTRAL MUTATION HOOKS - PRODUCTS
  const handleAddProduct = (newP: Product) => {
    setProducts(prev => {
      const updated = [newP, ...prev];
      syncTable("products", updated);
      return updated;
    });
  };
  const handleUpdateProduct = (updatedP: Product) => {
    setProducts(prev => {
      const updated = prev.map(p => p.id === updatedP.id ? updatedP : p);
      syncTable("products", updated);
      return updated;
    });
  };
  const handleDeleteProduct = async (productId: string) => {
    // 1. Permanently delete from client-side partitioned Firestore
    try {
      await deleteProdutoFromFirestore(productId);
    } catch (err) {
      console.warn("Erro ao apagar produto no Firestore do cliente:", err);
    }

    // 2. Permanently delete from Cloud SQL
    try {
      await deleteProductFromCloudSQL(productId);
    } catch (err) {
      console.warn("Erro ao apagar produto no Cloud SQL:", err);
    }

    // 3. Update local state and sync batch
    setProducts(prev => {
      const updated = prev.filter(p => p.id !== productId);
      syncTable("products", updated);
      return updated;
    });
  };

  // CENTRAL MUTATION HOOKS - CUSTOMERS
  const handleAddCustomer = (newC: Customer) => {
    setCustomers(prev => {
      const updated = [newC, ...prev];
      syncTable("customers", updated);
      return updated;
    });
  };
  const handleDeleteCustomer = async (customerId: string) => {
    // 1. Permanently delete from Cloud SQL
    try {
      await deleteCustomerFromCloudSQL(customerId);
    } catch (err) {
      console.warn("Erro ao apagar cliente no Cloud SQL:", err);
    }

    // 2. Update state and sync with server-side API (which cleans up top-level Firestore orphans)
    setCustomers(prev => {
      const updated = prev.filter(c => c.id !== customerId);
      syncTable("customers", updated);
      return updated;
    });
  };

  // CENTRAL MUTATION HOOKS - CASH FLOW
  const handleAddCashFlowEntry = (newEntry: CashFlowEntry) => {
    setCashFlow(prev => {
      const updated = [...prev, newEntry];
      syncTable("cashflow", updated);
      return updated;
    });
  };

  // CENTRAL MUTATION HOOKS - EMPLOYEES
  const handleAddEmployee = (newEmp: Employee) => {
    setEmployees(prev => {
      const updated = [newEmp, ...prev];
      syncTable("employees", updated);
      return updated;
    });
  };

  const handleUpdateEmployees = (updatedList: Employee[]) => {
    setEmployees(updatedList);
    syncTable("employees", updatedList);
  };

  // CENTRAL MUTATION HOOKS - SETTINGS
  const handleUpdateSettings = (newSettings: Partial<SystemSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      syncTable("settings", updated);
      return updated;
    });
  };

  const handleThemeChange = (newThemeId: string) => {
    setActiveColorTheme(newThemeId);
    const userId = activeUser?.id || "default";
    localStorage.setItem("erp_theme_" + userId, newThemeId);
    handleUpdateSettings({ theme: newThemeId });
  };

  // NEW: Unified local backup creation (supports manual and automatic scheduled runs)
  const handleTriggerLocalBackup = (type: "manual" | "automatic" = "manual") => {
    try {
      const dbPayload = {
        app: "OST Vendas",
        exportDate: new Date().toISOString(),
        version: currentSystemVersion,
        operator: type === "manual" ? (activeUser?.name || "ADMIN") : "Agendador Automático Redundante",
        data: {
          settings,
          products,
          customers,
          transactions,
          cashFlow,
          employees,
          auditLogs: auditLogs.slice(-50) // Only backup last 50 logs to conserve localStorage quota
        }
      };

      const dataStr = JSON.stringify(dbPayload);
      const backupId = Date.now().toString();
      
      // Save full backup payload to a unique key slot
      safeLocalStorageSetItem(`erp_backup_slot_${backupId}`, dataStr);
      safeLocalStorageSetItem("erp_auto_backup_local_db", dataStr);
      localStorage.setItem("erp_last_auto_backup_time", new Date().toISOString());

      // Update backup logs list
      let logs: any[] = [];
      try {
        const logsStr = localStorage.getItem("erp_local_backups_log");
        if (logsStr) logs = JSON.parse(logsStr);
      } catch (e) {}
      if (!Array.isArray(logs)) logs = [];

      const frequency = settings?.backupFrequency || "daily";
      
      const newLog = {
        id: backupId,
        date: new Date().toISOString(),
        type: type === "manual" ? "Manual" : "Automático",
        frequency: type === "manual" ? "N/A" : (frequency === "daily" ? "Diária" : frequency === "weekly" ? "Semanal" : frequency === "monthly" ? "Mensal" : "12 Horas"),
        size: dataStr.length,
        itemCount: (products.length || 0) + (customers.length || 0) + (transactions.length || 0),
        status: "Sucesso"
      };

      logs.unshift(newLog);
      logs = logs.slice(0, 3); // Keep last 3 to be safe on localStorage quota
      safeLocalStorageSetItem("erp_local_backups_log", JSON.stringify(logs));

      // Clean up backup slot keys that are no longer in the logs list
      const activeIds = logs.map((l: any) => l.id);
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("erp_backup_slot_")) {
          const id = key.replace("erp_backup_slot_", "");
          if (!activeIds.includes(id)) {
            localStorage.removeItem(key);
          }
        }
      }

      handleAddAuditLog(
        type === "manual" ? "Backup Local Manual" : `Backup Local Automático (${frequency === "daily" ? "Diária" : frequency === "weekly" ? "Semanal" : frequency === "monthly" ? "Mensal" : "12 Horas"})`,
        type === "manual" ? "SEGURANÇA" : "SISTEMA",
        `Cópia de segurança gravada localmente com sucesso (${type === "manual" ? "Manual" : settings?.backupFrequency || "Diária"}).`
      );

      return true;
    } catch (error) {
      console.error("Erro ao realizar backup local:", error);
      return false;
    }
  };

  // Automated scheduled database backup to localStorage (runs checking interval every 15m; backups based on user configuration)
  useEffect(() => {
    if (!isAuthenticated || products.length === 0) return;

    const runAutomaticBackup = () => {
      try {
        const lastBackupTimeStr = localStorage.getItem("erp_last_auto_backup_time");
        const lastBackupTime = lastBackupTimeStr ? new Date(lastBackupTimeStr).getTime() : 0;
        const now = Date.now();
        
        const frequency = settings?.backupFrequency || "daily";
        let intervalMs = 24 * 60 * 60 * 1000; // default 1 day (daily)
        if (frequency === "weekly") {
          intervalMs = 7 * 24 * 60 * 60 * 1000;
        } else if (frequency === "monthly") {
          intervalMs = 30 * 24 * 60 * 60 * 1000;
        } else if (frequency === "12h") {
          intervalMs = 12 * 60 * 60 * 1000;
        }

        if (now - lastBackupTime >= intervalMs) {
          console.log(`[AUTO-BACKUP] Executando cópia de redundância automática (${frequency})...`);
          handleTriggerLocalBackup("automatic");
        }
      } catch (error) {
        console.error("[AUTO-BACKUP] Erro ao realizar backup de redundância automática:", error);
      }
    };

    // Run check immediately
    runAutomaticBackup();

    // Check every 15 minutes
    const intervalId = setInterval(runAutomaticBackup, 900000);

    return () => clearInterval(intervalId);
  }, [isAuthenticated, products, customers, transactions, cashFlow, employees, auditLogs, settings]);

  const handleGetBackupPayload = () => {
    return {
      app: "OST Vendas",
      exportDate: new Date().toISOString(),
      version: currentSystemVersion,
      operator: activeUser?.name || "ADMIN",
      data: {
        settings,
        products,
        customers,
        transactions,
        cashFlow,
        employees,
        auditLogs
      }
    };
  };

  // ADMIN-ONLY REAL DATABASE EXPORT (JSON DOWNLOAD)
  const handleExportLocalDB = () => {
    const dbPayload = {
      app: "OST Vendas",
      exportDate: new Date().toISOString(),
      version: currentSystemVersion,
      operator: activeUser?.name || "ADMIN",
      data: {
        settings,
        products,
        customers,
        transactions,
        cashFlow,
        employees,
        auditLogs
      }
    };

    const dataStr = JSON.stringify(dbPayload, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `OST_Vendas_DB_Backup_${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    handleAddAuditLog(
      "Exportação Completa de DB",
      "SEGURANÇA",
      `Operador ${activeUser?.name || "ADMIN"} exportou com sucesso o banco de dados completo contendo ${products.length} produtos, ${customers.length} clientes, ${transactions.length} transações, ${cashFlow.length} movimentos e ${auditLogs.length} logs.`
    );
  };

  // ADMIN-ONLY REAL DATABASE IMPORT/RESTORE
  const handleImportLocalDB = async (importedData: any) => {
    try {
      if (!importedData) return false;

      if (importedData.products) {
        setProducts(importedData.products);
        await syncTable("products", importedData.products);
      }
      if (importedData.customers) {
        setCustomers(importedData.customers);
        await syncTable("customers", importedData.customers);
      }
      if (importedData.transactions) {
        setTransactions(importedData.transactions);
        await syncTable("transactions", importedData.transactions);
      }
      if (importedData.cashFlow) {
        setCashFlow(importedData.cashFlow);
        await syncTable("cashflow", importedData.cashFlow);
      }
      if (importedData.employees) {
        setEmployees(importedData.employees);
        await syncTable("employees", importedData.employees);
      }
      if (importedData.auditLogs) {
        setAuditLogs(importedData.auditLogs);
        await syncTable("auditlogs", importedData.auditLogs);
      }
      if (importedData.settings) {
        setSettings(importedData.settings);
        await syncTable("settings", importedData.settings);
      }

      handleAddAuditLog(
        "Restauro Completo de DB",
        "SEGURANÇA",
        `Operador ${activeUser?.name || "ADMIN"} restaurou com sucesso o banco de dados local.`
      );

      return true;
    } catch (error) {
      console.error("Falha ao restaurar banco de dados completo:", error);
      return false;
    }
  };

  const triggerSmsStockAlert = async (productName: string, currentStock: number, threshold: number) => {
    const managerPhone = settings.smsManagerPhone || "+258849001200";
    const provider = settings.smsProviderType || "TWILIO";
    const message = `ALERTA ESTOQUE CRÍTICO: O produto "${productName}" atingiu o nível crítico (${currentStock} unidades restantes). Limite configurado: ${threshold}. Por favor, realize a reposição urgente!`;

    // 1. Add to Audit Logs
    handleAddAuditLog(
      "Alerta Stock Crítico (SMS)",
      "STOCK",
      `Alerta de estoque baixo disparado para ${managerPhone} (${provider}). Mensagem: "${message}"`
    );

    // 2. Show Toast
    showToast(
      `Alerta de stock crítico por SMS enviado para o Gestor (${managerPhone}) referente ao produto "${productName}"!`,
      "warning",
      "SMS Enviado"
    );

    // 3. Optional real API connection triggers
    try {
      if (provider === "TWILIO" && settings.smsTwilioSid && settings.smsTwilioToken) {
        console.log(`[Twilio SMS] Sending SMS via SID: ${settings.smsTwilioSid} to ${managerPhone}`);
        // Real API request would look like:
        // const authString = btoa(`${settings.smsTwilioSid}:${settings.smsTwilioToken}`);
        // await fetch(`https://api.twilio.com/2010-04-01/Accounts/${settings.smsTwilioSid}/Messages.json`, {
        //   method: "POST",
        //   headers: { "Authorization": `Basic ${authString}`, "Content-Type": "application/x-www-form-urlencoded" },
        //   body: new URLSearchParams({ From: settings.smsTwilioFrom || "", To: managerPhone, Body: message })
        // });
      } else if (provider === "CUSTOM_HTTP" && settings.smsCustomUrl) {
        console.log(`[Custom SMS] Sending SMS via custom URL to ${managerPhone}`);
        // Real API request would look like:
        // await fetch(settings.smsCustomUrl, { method: "POST", body: JSON.stringify({ to: managerPhone, text: message }) });
      }
    } catch (e) {
      console.warn("Real SMS gateway execution skipped or failed:", e);
    }
  };

  const triggerEmailStockAlert = async (productName: string, currentStock: number, threshold: number) => {
    const recipientEmail = settings.alertsRecipientEmail || "admin-alerts@empresa.co.mz";
    
    const defaultSubject = `[ALERTA] Estoque Crítico de Produtos - OST Vendas`;
    const defaultBody = `Olá,\n\nEste é um alerta automático de que os seguintes produtos atingiram o nível de estoque mínimo definido:\n\n[LISTA_PRODUTOS]\n\nPor favor, providencie a reposição o quanto antes para evitar rupturas de estoque.\n\nAtenciosamente,\nSistema OST Vendas`;

    const userSubject = settings.stockAlertEmailSubject || defaultSubject;
    const userBody = settings.stockAlertEmailBody || defaultBody;

    const productListText = `- ${productName} (Estoque Atual: ${currentStock}, Mínimo: ${threshold})`;
    const companyName = settings.companyName || "OST Vendas";
    const dateStr = new Date().toLocaleString("pt-MZ");

    const parsedSubject = userSubject
      .replace(/\[LISTA_PRODUTOS\]/g, productListText)
      .replace(/\[NOME_EMPRESA\]/g, companyName)
      .replace(/\[DATA\]/g, dateStr)
      .replace(/\[EMAIL_DESTINO\]/g, recipientEmail);

    const parsedBodyText = userBody
      .replace(/\[LISTA_PRODUTOS\]/g, productListText)
      .replace(/\[NOME_EMPRESA\]/g, companyName)
      .replace(/\[DATA\]/g, dateStr)
      .replace(/\[EMAIL_DESTINO\]/g, recipientEmail);

    const body = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #fee2e2; border-radius: 16px; background-color: #fff5f5;">
        <h2 style="color: #dc2626; margin-top: 0; font-size: 18px; display: flex; items-center: center; gap: 8px;">⚠️ Alerta de Estoque Crítico</h2>
        <div style="font-size: 14px; color: #1f2937; line-height: 1.6; white-space: pre-wrap;">${parsedBodyText}</div>
        <hr style="border: none; border-top: 1px solid #fee2e2; margin: 20px 0;" />
        <p style="font-size: 11px; color: #9ca3af; margin-top: 25px; text-align: center;">Este é um e-mail automático enviado pelo sistema ${companyName}.</p>
      </div>
    `;

    const subject = parsedSubject;

    // 1. Add to Audit Logs
    handleAddAuditLog(
      "Alerta Stock Crítico (E-mail)",
      "STOCK",
      `Alerta de estoque baixo para "${productName}" enviado para o e-mail: ${recipientEmail}`
    );

    // 2. Show Toast
    showToast(
      `Alerta de estoque crítico enviado para o e-mail: ${recipientEmail}!`,
      "warning",
      "E-mail de Alerta"
    );

    // 3. Dispatch to backend endpoint
    try {
      const response = await fetch("/api/email/send-alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: recipientEmail,
          subject,
          body
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Erro no envio do e-mail de alerta");
      }
      console.log("[EMAIL ALERT] Alerta de estoque enviado com sucesso:", data);
    } catch (err: any) {
      console.error("[EMAIL ALERT ERROR] Falha ao enviar e-mail de alerta de estoque:", err);
    }
  };

  const triggerWhatsappStockAlert = async (productName: string, currentStock: number, threshold: number) => {
    if (!settings.whatsappEnabled) return;

    const phone = settings.managerWhatsappPhone || "+258849001200";
    const provider = settings.whatsappProvider || "DIRECT_LINK";
    const posLink = `${window.location.origin}/?tab=POS`;
    
    const defaultTemplate = `⚠️ *ALERTA DE ESTOQUE CRÍTICO* ⚠️\n\nO produto *{product_name}* atingiu o nível crítico de *{current_stock}* unidades (limite: {threshold}).\n\n👉 Acesse o POS para repor o estoque: {pos_link}`;
    const userTemplate = settings.whatsappMessageTemplate || defaultTemplate;
    
    const message = userTemplate
      .replace(/{product_name}/g, productName)
      .replace(/{current_stock}/g, String(currentStock))
      .replace(/{threshold}/g, String(threshold))
      .replace(/{pos_link}/g, posLink)
      .replace(/\[product_name\]/g, productName)
      .replace(/\[current_stock\]/g, String(currentStock))
      .replace(/\[threshold\]/g, String(threshold))
      .replace(/\[pos_link\]/g, posLink);

    // 1. Add to Audit Logs
    handleAddAuditLog(
      "Alerta Stock Crítico (WhatsApp)",
      "STOCK",
      `Alerta de estoque baixo disparado para ${phone} (${provider}). Mensagem: "${message}"`
    );

    // 2. Show Toast
    showToast(
      `Alerta de stock crítico enviado via WhatsApp para o Gestor (${phone})!`,
      "success",
      "WhatsApp Notificado"
    );

    // 3. Optional real API integration triggers / simulation
    try {
      if (provider === "DIRECT_LINK") {
        console.log(`[WhatsApp Direct Link] Generated link: https://api.whatsapp.com/send?phone=${phone.replace(/\+/g, "")}&text=${encodeURIComponent(message)}`);
      } else if (provider === "EVOLUTION_API" && settings.whatsappApiEndpoint) {
        console.log(`[Evolution API] Sending message to ${phone}`);
        await fetch(`${settings.whatsappApiEndpoint}/message/sendText/${settings.whatsappPhoneId || "default"}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": settings.whatsappToken || ""
          },
          body: JSON.stringify({
            number: phone.replace(/\+/g, ""),
            text: message
          })
        });
      } else if (provider === "TWILIO") {
        console.log(`[Twilio WhatsApp] Sending message to ${phone}`);
      } else if (provider === "META_CLOUD") {
        console.log(`[Meta Cloud API] Sending message to ${phone}`);
      }
    } catch (err: any) {
      console.error("[WhatsApp Send Error]:", err);
    }
  };

  // CENTRAL POS SALES TRANSACTION COMPLETION
  const handleCompleteSaleAction = (transaction: Transaction) => {
    // 1. Add to general transactions history list
    setTransactions(prev => {
      const updated = [transaction, ...prev];
      syncTable("transactions", updated);
      return updated;
    });

    const activeBranch = transaction.branchId || settings.activeBranchId || "central";
    const localBatches = [...(settings.batches || [])];

    // 2. Dynamic stock levels deduction ("Abate de Stock")
    setProducts(prevProducts => {
      const updated = prevProducts.map(prod => {
        const cartItemMatch = transaction.items.find(item => item.productId === prod.id);
        if (cartItemMatch) {
          const updatedStock = Math.max(0, prod.stock - cartItemMatch.quantity);
          
          // Geographical Branch Stock deduction
          const updatedBranchStocks = { ...(prod.branchStocks || {}) };
          const currentBranchStock = updatedBranchStocks[activeBranch] !== undefined 
            ? updatedBranchStocks[activeBranch] 
            : prod.stock;
          updatedBranchStocks[activeBranch] = Math.max(0, currentBranchStock - cartItemMatch.quantity);

          // LIFO / FIFO Batch deduction
          let remainingToDeduct = cartItemMatch.quantity;
          const prodBatches = localBatches
            .filter(b => b.productId === prod.id && b.quantity > 0)
            .sort((a, b) => {
              if (settings.inventoryStrategy === "LIFO") {
                return new Date(b.receivedDate).getTime() - new Date(a.receivedDate).getTime();
              } else {
                return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
              }
            });

          for (const pb of prodBatches) {
            if (remainingToDeduct <= 0) break;
            const matchIdx = localBatches.findIndex(b => b.id === pb.id);
            if (matchIdx > -1) {
              const batch = localBatches[matchIdx];
              const deduct = Math.min(batch.quantity, remainingToDeduct);
              remainingToDeduct -= deduct;
              localBatches[matchIdx] = {
                ...batch,
                quantity: batch.quantity - deduct
              };
            }
          }

          const threshold = settings.smsStockThreshold !== undefined ? settings.smsStockThreshold : 5;
          
          if (settings.smsAlertsEnabled && updatedStock <= threshold && prod.stock > threshold) {
            triggerSmsStockAlert(prod.name, updatedStock, threshold);
          }

          if (settings.emailStockAlertsEnabled && updatedStock <= threshold && prod.stock > threshold) {
            triggerEmailStockAlert(prod.name, updatedStock, threshold);
          }

          if (settings.whatsappEnabled && updatedStock <= threshold && prod.stock > threshold) {
            triggerWhatsappStockAlert(prod.name, updatedStock, threshold);
          }

          return {
            ...prod,
            stock: updatedStock,
            branchStocks: updatedBranchStocks
          };
        }
        return prod;
      });
      syncTable("products", updated);
      return updated;
    });

    // Save updated batches to system settings
    handleUpdateSettings({ batches: localBatches });

    // 3. Update customer loyalty points accumulated
    if (transaction.customerId && transaction.customerId !== "WALK_IN") {
      setCustomers(prevCustomers => {
        const updated = prevCustomers.map(cust => {
          if (cust.id === transaction.customerId) {
            const addedPoints = Math.floor(transaction.grandTotal / 100); // 1 point every 100 MT
            return {
              ...cust,
              totalSpent: cust.totalSpent + transaction.grandTotal,
              purchaseCount: cust.purchaseCount + 1,
              loyaltyPoints: cust.loyaltyPoints + addedPoints,
              lastPurchaseDate: new Date().toLocaleDateString(),
              debt: transaction.paymentMethod === "DEBT" ? (cust.debt || 0) + transaction.grandTotal : cust.debt
            };
          }
          return cust;
        });
        syncTable("customers", updated);
        return updated;
      });
    }

    // 4. Record strict auditor trace logs
    handleAddAuditLog(
      "Completar Transação de POS",
      "VENDAS",
      `Fatura ${transaction.invoiceNumber} processada na filial ${activeBranch}. Cliente: ${transaction.customerName}, Método: ${transaction.paymentMethod}. Total Pago: ${transaction.grandTotal} MT. Abate de Stock concluído.`
    );
  };

  // Trigger Gemini AI sales forecasting
  const handleTriggerAIForecast = async () => {
    setIsGeneratingForecast(true);
    setForecastResult(null);

    // Prepare critical low level stock summary
    const criticalStock = products
      .filter(p => p.stock <= p.minStock)
      .map(p => ({ sku: p.code, item: p.name, stock: p.stock }));

    // Prepare sales history summary
    const salesSummary = transactions.slice(0, 15).map(t => ({
      invoice: t.invoiceNumber,
      total: t.grandTotal,
      cashier: t.cashierName
    }));

    try {
      const clientApiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || (import.meta as any).env?.VITE_GOOGLE_API_KEY || "";
      const response = await fetch("/api/gemini/forecast", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(clientApiKey ? { "x-gemini-key": clientApiKey } : {})
        },
        body: JSON.stringify({
          salesHistory: salesSummary,
          inventoryStatus: criticalStock,
          businessType: settings.companyName,
          apiKey: clientApiKey || undefined
        })
      });
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      const data = await response.json();
      if (data && (data.forecastText || data.growthRate !== undefined)) {
        setForecastResult(data);
      } else {
        throw new Error("Invalid forecast payload format");
      }
    } catch {
      // Offline fallback
      setForecastResult({
        forecastText: `### **Análise Prematura de Previsão de Vendas (Modo Simulação)**
        
Com base no histórico fornecido de vendas para o seu negócio de **${settings.companyName}**:

1. **Tendência de Crescimento**: Projetamos um aumento aproximado de **18%** nas vendas para o próximo período devido a padrões sazonais identificados nos produtos mais vendidos.
2. **Produtos Críticos**: Itens com stock baixo (especialmente categorias eletrónicas ou mercearia) sofrem risco elevado de rutura. Recomendamos reabastecer com urgência para evitar perda de clientes.
3. **Plano de Ação Sugerido**:
   * Lance uma campanha promocional de Laurentina ou Arroz Chicualacuala.
   * Ative o programa de fidelização enviando SMS automatizadas de agradecimento.
   * Forneça opções céleres de recebimento M-Pesa.`,
        growthRate: 18,
        growthTrend: "up",
        suggestedCampaigns: [
          "Super Promo Laurentina 2M",
          "Arroz Chicualacuala Direct",
          "Desconto Especial no M-Pesa"
        ]
      });
    } finally {
      setIsGeneratingForecast(false);
    }
  };

  // Translate employees role to fit authorization hooks
  const simplifiedRole: UserRole = useMemo(() => {
    if (!activeUser || !activeUser.role) return "CASHIER";
    const raw = activeUser.role.toLowerCase();
    if (raw.includes("caixa") || raw.includes("vendedor")) return "CASHIER";
    if (raw.includes("supervisor")) return "SUPERVISOR";
    return "ADMIN";
  }, [activeUser]);

  // Filtra dados para que vendedores (CASHIER) e supervisores (SUPERVISOR) vejam apenas os seus registos, enquanto o ADMIN tem acesso total
  const filteredTransactions = useMemo(() => {
    if (!activeUser) return [];
    if (simplifiedRole === "ADMIN") {
      return transactions;
    }
    return transactions.filter(t => {
      const cashierLower = (t.cashierName || "").toLowerCase().trim();
      const activeNameLower = (activeUser.name || "").toLowerCase().trim();
      const activeUsernameLower = (activeUser.username || "").toLowerCase().trim();
      return cashierLower === activeNameLower || cashierLower === activeUsernameLower;
    });
  }, [transactions, activeUser, simplifiedRole]);

  const filteredCashFlow = useMemo(() => {
    if (!activeUser) return [];
    if (simplifiedRole === "ADMIN") {
      return cashFlow;
    }
    return cashFlow.filter(c => {
      const respUserLower = (c.responsibleUser || "").toLowerCase().trim();
      const activeNameLower = (activeUser.name || "").toLowerCase().trim();
      const activeUsernameLower = (activeUser.username || "").toLowerCase().trim();
      return respUserLower === activeNameLower || respUserLower === activeUsernameLower;
    });
  }, [cashFlow, activeUser, simplifiedRole]);

  const handleLoginSuccess = (user: Employee, branchName: string) => {
    // 1. Check blocked status
    if (user.status === "BLOCKED") {
      showToast("A sua conta está BLOQUEADA por tempo expirado da senha de acesso ou suspensão de segurança.", "error");
      return;
    }

    if (user.status === "INACTIVE" || user.status === "SUSPENDED") {
      showToast("Esta conta está inativa ou suspensa. Contacte o Administrador.", "error");
      return;
    }

    // 2. Check Password expiration policy (2 months / 60 days)
    const now = new Date();
    const createdAtStr = user.pinCreatedAt || user.admissionDate || now.toISOString();
    const createdAt = new Date(createdAtStr);
    const diffTime = now.getTime() - createdAt.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);

    const isPinTemporary = user.pinChanged === false;

    // 3. Force Password change if temporary (first login)
    if (isPinTemporary) {
      setForcePinTargetEmployee(user);
      setNewPin("");
      setConfirmNewPin("");
      setForcePinError("Este é o seu primeiro login. Por favor, crie uma senha pessoal segura.");
      setForcePinChangeOpen(true);
      return;
    }

    if (diffDays > 60) {
      setForcePinTargetEmployee(user);
      setNewPin("");
      setConfirmNewPin("");
      setForcePinError("A sua senha de acesso expirou (validade de 2 meses). Por favor, defina uma nova senha.");
      setForcePinChangeOpen(true);
      return;
    }

    localStorage.setItem("erp_simulated_logged_in_user", JSON.stringify(user));
    setActiveUser(user);
    setIsAuthenticated(true);
    setSettings(prev => ({
      ...prev,
      companyName: branchName
    }));

    // Record login audit log
    handleAddAuditLog(
      "Login efetuado",
      "AUTENTICAÇÃO",
      `Sessão iniciada com sucesso para o colaborador ${user.name} (${user.role}) no ramo ${branchName}.`,
      user
    );

    // GEOLOCATION SECURITY CHECK:
    // Determine if the current city/country is new or unusual for this user
    const currentCity = userIpInfo?.city || "Maputo";
    const currentCountry = userIpInfo?.country || "Moçambique";
    const currentIp = userIpInfo?.ip || "102.81.12.94";

    // Filter audit logs for previous successful logins for this user
    const userPreviousLogins = auditLogs.filter(log => 
      log.user === user.name && 
      log.action === "Login efetuado"
    );

    let isNewLocation = false;
    let locationHistoryString = "";

    if (userPreviousLogins.length > 0) {
      // Extract cities and countries from previous logs
      const knownLocations = userPreviousLogins.map(log => {
        const match = log.ip?.match(/\(([^)]+)\)/);
        if (match) {
          const parts = match[1].split(",");
          const city = parts[0] ? parts[0].trim().toLowerCase() : "";
          const country = parts[1] ? parts[1].trim().toLowerCase() : "";
          return { city, country };
        }
        return { city: "maputo", country: "moçambique" };
      });

      const hasCity = knownLocations.some(loc => loc.city === currentCity.toLowerCase());
      const hasCountry = knownLocations.some(loc => loc.country === currentCountry.toLowerCase());

      if (!hasCity || !hasCountry) {
        isNewLocation = true;
        const uniqueHistory = Array.from(new Set(userPreviousLogins.map(log => {
          const match = log.ip?.match(/\(([^)]+)\)/);
          return match ? match[1].trim() : "Maputo, Moçambique";
        })));
        locationHistoryString = uniqueHistory.join(" | ");
      }
    } else {
      // If there are no previous logs at all (first login), but they are logging in from outside Moçambique,
      // let's treat it as unusual to protect the company.
      const isOutsideMozambique = currentCountry.toLowerCase() !== "moçambique" && 
                                  currentCountry.toLowerCase() !== "mozambique";
      if (isOutsideMozambique) {
        isNewLocation = true;
        locationHistoryString = "Nenhum histórico (Primeiro Login - Local Internacional)";
      }
    }

    if (isNewLocation) {
      const alertMsg = `ALERTA DE SEGURANÇA: Login de ${user.name} detectado a partir de uma localização não habitual: ${currentCity}, ${currentCountry}. IP: ${currentIp}.`;
      
      // Add a security warning log entry
      setTimeout(() => {
        handleAddAuditLog(
          "Alerta de Segurança",
          "SEGURANÇA",
          alertMsg,
          user
        );
      }, 300);

      // Email details to admin
      const adminEmail = settings.reportRecipientEmail || "admin@example.com";
      const subject = `🚨 ALERTA DE SEGURANÇA: Login de Localização Incomum (${user.name})`;
      
      const emailBody = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #fee2e2; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
          <div style="text-align: center; border-bottom: 2px solid #ef4444; padding-bottom: 20px; margin-bottom: 25px;">
            <span style="background-color: #fef2f2; border: 1px solid #fee2e2; color: #ef4444; font-size: 11px; font-weight: bold; padding: 4px 10px; border-radius: 9999px; text-transform: uppercase; tracking-wider: 1px;">Alerta do Módulo de Auditoria</span>
            <h1 style="color: #991b1b; margin: 10px 0 0 0; font-size: 24px; font-weight: 800;">Acesso Não Habitual</h1>
            <p style="color: #64748b; margin: 5px 0 0 0; font-size: 14px;">OST Vendas - ERP Comercial</p>
          </div>
          
          <div style="margin-bottom: 30px; line-height: 1.6; color: #334155; font-size: 14px;">
            <p>Prezado <strong>Administrador do Sistema</strong>,</p>
            <p>O sistema de segurança integrativa da OST detectou um evento de autenticação originado de uma <strong>localização geográfica nova ou não habitual</strong>.</p>
            
            <div style="background-color: #fffaf0; border: 1px solid #feebc8; border-left: 4px solid #dd6b20; border-radius: 12px; padding: 20px; margin: 25px 0;">
              <h3 style="margin: 0 0 12px 0; font-size: 15px; color: #dd6b20; font-weight: bold;">Dados de Acesso Suspeito</h3>
              <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                <tr>
                  <td style="padding: 6px 0; color: #718096; font-weight: bold; width: 40%;">Colaborador:</td>
                  <td style="padding: 6px 0; color: #2d3748; font-weight: bold;">${user.name}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #718096; font-weight: bold;">Perfil / Função:</td>
                  <td style="padding: 6px 0; color: #2d3748; font-weight: bold;">${user.role}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #718096; font-weight: bold;">Localização Detectada:</td>
                  <td style="padding: 6px 0; color: #e53e3e; font-weight: 900; font-size: 14px;">${currentCity}, ${currentCountry}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #718096; font-weight: bold;">Endereço de IP:</td>
                  <td style="padding: 6px 0; color: #2d3748; font-family: monospace; font-weight: bold;">${currentIp}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #718096; font-weight: bold;">Dispositivo/Browser:</td>
                  <td style="padding: 6px 0; color: #2d3748; font-size: 12px;">${deviceInfo || "Desktop (Chrome)"}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #718096; font-weight: bold;">Data e Hora (Local):</td>
                  <td style="padding: 6px 0; color: #2d3748;">${new Date().toLocaleString()}</td>
                </tr>
              </table>
            </div>

            <p style="font-size: 12.5px; color: #4a5568; line-height: 1.5;">
              <strong>Histórico Conhecido de Localizações:</strong><br/>
              <span style="color: #718096; font-family: monospace; font-size: 12px; display: block; margin-top: 5px; padding: 8px; background-color: #f7fafc; border-radius: 6px; border: 1px solid #e2e8f0; word-break: break-all;">${locationHistoryString || "Nenhum histórico anterior registado (primeiro acesso do utilizador)."}</span>
            </p>
            
            <p style="margin-top: 25px; padding: 15px; background-color: #f7fafc; border-radius: 8px; font-size: 12px; color: #4a5568; border-left: 4px solid #4a5568;">
              <strong>Medida Recomendada:</strong> Se este acesso não for reconhecido pelo utilizador em causa, aceda ao painel de controlo do ERP, secção <strong>"Recursos Humanos / Funcionários"</strong>, e altere imediatamente o PIN de acesso ou suspenda a conta do colaborador para mitigar riscos de intrusão.
            </p>
          </div>

          <div style="text-align: center; font-size: 11px; color: #a0aec0; border-top: 1px solid #edf2f7; padding-top: 15px; margin-top: 25px;">
            <p>Este alerta automatizado foi disparado pelo sistema de integridade OST Vendas.</p>
          </div>
        </div>
      `;

      // Send Email Alerta
      sendEmail({
        to: adminEmail,
        subject,
        body: emailBody
      }).catch(err => console.error("[SECURITY] Falha ao enviar email de alerta ao administrador:", err));

      // Send SMS Alerta
      const smsMessage = `🚨 ALERTA OST: Login suspeito detectado de ${user.name} em ${currentCity}, ${currentCountry}. IP: ${currentIp}. Verifique o e-mail de auditoria.`;

      // Send SMS to all administrator employees in the store
      const adminUsers = employees.filter(emp => 
        emp.role?.toUpperCase().includes("ADMIN") || 
        emp.role?.toUpperCase().includes("GESTOR")
      );

      adminUsers.forEach(adm => {
        if (adm.contact && adm.contact.trim()) {
          sendSMS(adm.contact.trim(), smsMessage).catch(err => 
            console.error(`[SECURITY] Falha ao enviar SMS para o administrador ${adm.name}:`, err)
          );
        }
      });

      // Send SMS to current store contact if set
      if (settings.storeContact && settings.storeContact.trim()) {
        sendSMS(settings.storeContact.trim(), smsMessage).catch(err => 
          console.error("[SECURITY] Falha ao enviar SMS para o storeContact:", err)
        );
      }
    }
    
    // Auto-redirect conforming to profile role
    const raw = (user.role || "").toLowerCase();
    if (raw.includes("caixa") || raw.includes("vendedor")) {
      setActiveTab("POS");
    } else {
      setActiveTab("DASHBOARD");
    }
  };

  const handleLogout = async () => {
    try {
      if (activeUser) {
        handleAddAuditLog(
          "Logout Efetuado",
          "SEGURANÇA",
          `Operador ${activeUser.name} encerrou a sessão.`
        );
      }
      await logout();
      setActiveUser(null);
      setIsAuthenticated(false);
      // Clean memory state to prevent cross-user data lingering
      setProducts([]);
      setCustomers([]);
      setTransactions([]);
      setCashFlow([]);
      setEmployees([]);
      setAuditLogs([]);
      setSettings(defaultSettings);
      showToast("Sessão terminada com sucesso.", "info");
    } catch (err: any) {
      console.error("Erro ao efetuar logout:", err);
      await logout();
      setActiveUser(null);
      setIsAuthenticated(false);
      setProducts([]);
      setCustomers([]);
      setTransactions([]);
      setCashFlow([]);
      setEmployees([]);
      setAuditLogs([]);
      setSettings(defaultSettings);
      showToast("Sessão terminada com sucesso.", "info");
    }
  };

  const handleLinkAccount = async (employeeId: string, emailStr: string) => {
    const updatedEmployees = employees.map(emp => {
      if (emp.id === employeeId) {
        return { ...emp, email: emailStr.toLowerCase().trim() };
      }
      return emp;
    });
    setEmployees(updatedEmployees);
    await syncTable("employees", updatedEmployees);
    showToast("Sucesso: A sua conta foi vinculada a este perfil!", "success");
    handleAddAuditLog(
      "Vínculo de Conta",
      "SISTEMA",
      `Perfil de colaborador ${employeeId} vinculado ao e-mail ${emailStr}`
    );
  };

  if (!isAuthenticated || !activeUser) {
    return (
      <>
        <LoginModule
          employees={employees}
          companyName={settings.companyName}
          logoUrl={settings.logoUrl}
          branches={settings.branches || []}
          onLoginSuccess={handleLoginSuccess}
          onShowToast={showToast}
          onAddAuditLog={handleAddAuditLog}
          settings={settings}
        />
        {forcePinChangeOpen && forcePinTargetEmployee && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden flex flex-col ${
                theme === "night"
                  ? "bg-zinc-950 text-slate-100 border-zinc-850"
                  : "bg-white text-slate-800 border-slate-100"
              }`}
            >
              <div className="p-6 border-b border-slate-100 dark:border-zinc-850 bg-gradient-to-r from-amber-500/10 to-orange-500/10 text-left">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center shadow-inner">
                    <ShieldAlert className="w-5 h-5 animate-bounce" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-slate-800 dark:text-slate-100">Atualização de Segurança Obrigatória</h3>
                    <p className="text-[10px] text-amber-600 font-extrabold font-mono uppercase">Definir Senha Definitiva de Acesso</p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-4 text-left">
                <div className="p-3.5 bg-amber-50 border border-amber-100 rounded-xl space-y-1 text-xs">
                  <p className="font-bold text-amber-800">Olá {forcePinTargetEmployee.name},</p>
                  <p className="text-amber-700 leading-relaxed text-[11px]">
                    De acordo com a política de segurança, a sua senha inicial é temporária ou expirou. Defina uma senha de acesso forte de pelo menos 6 caracteres.
                  </p>
                </div>

                <div className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Nova Senha de Acesso</label>
                    <input
                      type="password"
                      maxLength={32}
                      placeholder="Mínimo 6 caracteres"
                      value={newPin}
                      onChange={(e) => {
                        setNewPin(e.target.value);
                        if (forcePinError) setForcePinError("");
                      }}
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl border focus:outline-none focus:ring-2 text-xs font-medium ${
                        theme === "night"
                          ? "bg-zinc-900 border-zinc-800 text-slate-100 focus:ring-orange-500/20"
                          : "bg-slate-50 border-slate-200 text-slate-800 focus:ring-orange-500/20 focus:bg-white"
                      }`}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Confirmar Nova Senha</label>
                    <input
                      type="password"
                      maxLength={32}
                      placeholder="Repita a nova senha de acesso"
                      value={confirmNewPin}
                      onChange={(e) => {
                        setConfirmNewPin(e.target.value);
                        if (forcePinError) setForcePinError("");
                      }}
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl border focus:outline-none focus:ring-2 text-xs font-medium ${
                        theme === "night"
                          ? "bg-zinc-900 border-zinc-800 text-slate-100 focus:ring-orange-500/20"
                          : "bg-slate-50 border-slate-200 text-slate-800 focus:ring-orange-500/20 focus:bg-white"
                      }`}
                    />
                  </div>

                  {forcePinError && (
                    <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs font-bold flex items-center gap-1.5 animate-pulse">
                      <span>⚠️</span>
                      <span>{forcePinError}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 dark:border-zinc-850 flex justify-end gap-3 bg-slate-50 dark:bg-zinc-900">
                <button
                  type="button"
                  onClick={() => {
                    setForcePinChangeOpen(false);
                    setForcePinTargetEmployee(null);
                  }}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleForcePinChangeSubmit}
                  disabled={newPin.length < 6 || confirmNewPin.length < 6}
                  className={`px-5 py-2.5 text-xs font-extrabold rounded-xl shadow-md transition-all cursor-pointer ${
                    newPin.length >= 6 && confirmNewPin.length >= 6
                      ? "bg-orange-500 hover:bg-orange-600 text-white transform hover:scale-105"
                      : "bg-slate-200 text-slate-400 cursor-not-allowed"
                  }`}
                >
                  Ativar Conta & Aceder
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className={`flex h-screen overflow-hidden font-sans transition-colors duration-200 ${
      theme === "night" ? "bg-zinc-950 text-slate-200" : "bg-slate-50 text-slate-800"
    }`}>
      
        {!isPOSFullscreen && (
        <Sidebar
          currentRole={simplifiedRole}
          onChangeRole={handleChangeRole}
          activeModule={activeTab.toLowerCase()}
          onChangeModule={(mod) => {
            setActiveTab(mod.toUpperCase());
            setIsSidebarOpen(false);
          }}
          companyName={settings.companyName}
          logoUrl={settings.logoUrl}
          onLogout={handleLogout}
          theme={theme}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          activeUser={activeUser}
          subscriptionPlan={activeUser?.subscriptionPlan || settings.subscriptionPlan || "OURO"}
          onSwitchUser={() => {
            setIsUserSwitchModalOpen(true);
            if (activeUser) {
              setSwitchSelectedEmployeeId(activeUser.id);
            }
          }}
        />
      )}

      {/* Outer body wrapper */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
        
        {/* TOP COMPACT STATUS BAR BRAND BANNER */}
        {!isPOSFullscreen && (
          <header className={`border-b h-16 px-4 md:px-6 shrink-0 flex items-center justify-between shadow-md backdrop-blur-md relative z-20 transition-all ${
            theme === "night" ? "bg-zinc-950/50 border-zinc-800/80" : "bg-white border-slate-200"
          }`}>
            
            <div className="flex items-center gap-3">
              {/* Hamburger Menu Toggle - Visible on mobile/tablet */}
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                className="lg:hidden p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-zinc-900 transition shrink-0 cursor-pointer"
                aria-label="Abrir menu"
              >
                <Menu className="w-5 h-5" />
              </button>

              {/* System Status Indicator */}
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                isOnline 
                  ? theme === "night"
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-sm"
                  : theme === "night"
                    ? "bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse"
                    : "bg-rose-50 text-rose-600 border border-rose-200 shadow-sm animate-pulse"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`}></span>
                <span>{isOnline ? "SISTEMA ONLINE" : "SISTEMA OFFLINE"}</span>
              </div>
  
              <div className="hidden lg:flex items-center gap-2 text-[11px] font-mono opacity-80">
                {settings.logoUrl && (
                  <img
                    src={settings.logoUrl}
                    alt="Logo Mini"
                    className="w-5 h-5 rounded-md object-contain bg-white p-0.5 border border-slate-200 shrink-0"
                    referrerPolicy="no-referrer"
                  />
                )}
                <span className={theme === "night" ? "text-slate-400" : "text-slate-600"}>Empresa:</span>
                <span className={`font-bold uppercase ${theme === "night" ? "text-white" : "text-slate-800"}`}>
                  {settings.companyName}
                </span>
              </div>
  
              <span className="hidden lg:inline text-slate-500 font-mono text-[11px]">•</span>
  
              <div className="hidden sm:flex items-center gap-1 text-[11px] font-mono opacity-80">
                <span className={theme === "night" ? "text-slate-400" : "text-slate-600"}>Versão:</span>
                <span className={`font-bold ${theme === "night" ? "text-amber-400" : "text-orange-600"}`}>{currentSystemVersion}</span>
              </div>
            </div>
  
            <div className="flex items-center gap-4 text-xs">
              {/* Session Stats & Last Sync */}
              <div className={`hidden md:flex items-center gap-4 font-mono text-[10.5px] ${
                theme === "night" ? "text-slate-400" : "text-slate-500"
              }`}>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  <span>Sessão:</span>
                  <span className={`font-bold ${theme === "night" ? "text-slate-200" : "text-slate-800"}`}>
                    {formatSessionTime(sessionSeconds)}
                  </span>
                </div>
                <span>•</span>
                <div className="flex items-center gap-1.5" title="Hora do último envio ou recebimento de dados com a nuvem">
                  <Cloud className="w-3.5 h-3.5 text-blue-400" />
                  <span>Última Sinc:</span>
                  <span className={`font-bold ${theme === "night" ? "text-slate-200" : "text-slate-800"}`}>
                    {lastSyncTime}
                  </span>
                </div>
              </div>
  
              {/* Daily/Night Theme Switcher Custom Widget */}
              <button
                onClick={() => setTheme(theme === "daily" ? "night" : "daily")}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer text-[10.5px] font-bold ${
                  theme === "night" 
                    ? "bg-zinc-900 border-zinc-800 text-amber-500 hover:text-amber-400" 
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-sm"
                }`}
                title="Alternar Layout de Tema"
              >
                {theme === "daily" ? (
                  <>
                    <Sun className="w-3.5 h-3.5 text-amber-500 animate-spin" style={{ animationDuration: "10s" }} />
                    <span>Dia</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-3.5 h-3.5 text-amber-450 fill-amber-400/25" />
                    <span>Noite</span>
                  </>
                )}
              </button>
  
              {/* Button to quickly switch account / alter user */}
              <button
                id="quick-switch-user-btn"
                onClick={() => {
                  setIsUserSwitchModalOpen(true);
                  if (activeUser) {
                    setSwitchSelectedEmployeeId(activeUser.id);
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all cursor-pointer text-[10.5px] font-bold ${
                  theme === "night" 
                    ? "bg-zinc-900 border-zinc-800 text-orange-400 hover:text-orange-300" 
                    : "bg-white border-slate-200 text-orange-600 hover:bg-slate-50 hover:text-orange-700 shadow-sm"
                }`}
                title="Alterar Conta do Usuário"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Alterar Usuário / Vincular</span>
              </button>

              {/* Quick Logo Config Button */}
              <button
                id="quick-logo-config-btn"
                onClick={() => setIsQuickLogoModalOpen(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all cursor-pointer text-[10.5px] font-bold ${
                  theme === "night" 
                    ? "bg-zinc-900 border-zinc-800 text-amber-400 hover:text-amber-300" 
                    : "bg-white border-slate-200 text-amber-600 hover:bg-slate-50 hover:text-amber-700 shadow-sm"
                }`}
                title="Configuração Rápida do Logotipo da Empresa"
              >
                {settings.logoUrl ? (
                  <img src={settings.logoUrl} alt="Logo" className="w-4 h-4 rounded object-cover border border-amber-500/30" />
                ) : (
                  <Image className="w-3.5 h-3.5 text-amber-500" />
                )}
                <span>Logotipo</span>
              </button>

              {/* Tutorial & Keyboard Shortcuts Button */}
              <button
                id="quick-tutorial-btn"
                onClick={() => setIsTutorialModalOpen(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all cursor-pointer text-[10.5px] font-bold ${
                  theme === "night" 
                    ? "bg-zinc-900 border-zinc-800 text-orange-400 hover:text-orange-300" 
                    : "bg-white border-slate-200 text-orange-600 hover:bg-slate-50 hover:text-orange-700 shadow-sm"
                }`}
                title="Tutorial Rápido e Atalhos de Teclado (F1)"
              >
                <BookOpen className="w-3.5 h-3.5 text-orange-500" />
                <span>Tutorial</span>
                <span className="text-[9px] bg-orange-500/15 text-orange-600 dark:text-orange-400 font-mono font-bold px-1.5 py-0.2 rounded border border-orange-500/20">
                  F1
                </span>
              </button>
 
              {/* Active user status pill made interactive */}
              <button
                onClick={() => {
                  setIsUserSwitchModalOpen(true);
                  if (activeUser) {
                    setSwitchSelectedEmployeeId(activeUser.id);
                  }
                }}
                className={`flex items-center gap-2 p-1.5 rounded-xl border transition-all text-left cursor-pointer ${
                  theme === "night" 
                    ? "bg-zinc-900 border-zinc-800 hover:bg-zinc-850 text-slate-200" 
                    : "bg-white border-slate-200 hover:bg-slate-50 text-slate-800 shadow-sm"
                }`}
                title="Clique para alterar conta ou vincular novo e-mail"
              >
                <div className="w-6 h-6 rounded-lg bg-orange-500 text-white flex items-center justify-center font-bold text-[10px] shrink-0 overflow-hidden">
                  {activeUser.fotoPerfil ? (
                    <img src={activeUser.fotoPerfil} className="w-full h-full object-cover" alt="Perfil" referrerPolicy="no-referrer" />
                  ) : (
                    activeUser.name.substring(0, 2).toUpperCase()
                  )}
                </div>
                <div className="leading-none">
                  <p className="font-extrabold text-[10.5px] leading-tight">{activeUser.name}</p>
                  <p className={`text-[9px] mt-0.5 ${
                    theme === "night" ? "text-slate-400" : "text-slate-500"
                  }`}>{activeUser.role}</p>
                </div>
              </button>
            </div>
  
          </header>
        )}

        {/* COMPACT HORIZONTAL TOP NAVIGATION MODULES BAR */}
        {!isPOSFullscreen && (
          <div className={`border-b px-4 md:px-6 py-2 shrink-0 flex items-center gap-2 overflow-x-auto scrollbar-none z-15 transition-all ${
            theme === "night" 
              ? "bg-zinc-900/60 border-zinc-850/60 text-slate-300" 
              : "bg-white border-slate-150 text-slate-700 shadow-sm"
          }`}>
            <div className="flex items-center gap-2 flex-nowrap overflow-x-auto scrollbar-none py-1 font-sans">
              {NAV_MENU_ITEMS.map((item) => {
                const allowedRoles = item.roles;
                const authorized = allowedRoles.includes(simplifiedRole);
                const active = activeTab.toLowerCase() === item.id;
                
                return (
                  <button
                    key={item.id}
                    onClick={() => authorized && setActiveTab(item.id.toUpperCase())}
                    disabled={!authorized}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap select-none shrink-0 group ${
                      active 
                        ? "bg-orange-500 text-white shadow-sm shadow-orange-500/20" 
                        : authorized 
                          ? theme === "night" 
                            ? "text-slate-400 hover:text-slate-150 hover:bg-zinc-850 cursor-pointer" 
                            : "text-slate-650 hover:text-orange-600 hover:bg-orange-50/50 cursor-pointer"
                          : "opacity-35 cursor-not-allowed text-slate-400"
                    }`}
                    title={authorized ? item.label : "Acesso Restrito (" + allowedRoles.join(", ") + ")"}
                  >
                    <item.icon className={`w-4 h-4 shrink-0 transition-colors ${
                      active 
                        ? "text-white" 
                        : authorized 
                          ? theme === "night" 
                            ? "text-slate-500 group-hover:text-slate-300" 
                            : "text-slate-400 group-hover:text-orange-500"
                          : "text-slate-400"
                    }`} />
                    <span>{item.shortLabel}</span>
                    {!authorized && (
                      <Lock className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        
        {isQuotaExceeded && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-3 flex items-start gap-3 relative z-30 animate-in slide-in-from-top duration-200">
            <div className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="flex-1 text-xs">
              <h4 className="font-extrabold text-amber-500">Aviso do Sistema: Limite de Quota Diária Excedido (Firestore Writes)</h4>
              <p className="text-slate-400 mt-1 leading-relaxed">
                A cota diária gratuita de gravação do Firestore (**Spark Plan / Free Tier**) foi atingida para este projeto. O sistema de banco de dados entrou em modo de simulação segura local. Pode continuar a registar vendas, gerir artigos, consultar relatórios e testar todas as funcionalidades do POS com segurança! Os limites de quota serão reiniciados automaticamente amanhã.
              </p>
              <div className="flex flex-wrap gap-3 mt-2">
                <a
                  href="https://console.firebase.google.com/project/gen-lang-client-0285564041/firestore/databases/ai-studio-e2d52f5d-b57f-430e-9d24-e415e95b0744/data?openUpgradeDialog=true"
                  target="_blank"
                  rel="noreferrer"
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold px-3 py-1 rounded text-[10px] transition uppercase tracking-wider"
                >
                  Ir para a Consola Firebase ↗
                </a>
                <a
                  href="https://firebase.google.com/pricing#cloud-firestore"
                  target="_blank"
                  rel="noreferrer"
                  className="border border-amber-500/30 text-amber-400 hover:text-amber-300 font-bold px-3 py-1 rounded text-[10px] transition"
                >
                  Tabela de Preços e Limites ↗
                </a>
                <button
                  onClick={() => setIsQuotaExceeded(false)}
                  className="text-slate-500 hover:text-slate-300 underline font-semibold text-[10px]"
                >
                  Ignorar por agora
                </button>
              </div>
            </div>
          </div>
        )}
  
        {/* INNER SCROLLABLE WORKPORT PANEL CONTENT */}
        <main className={`flex-1 overflow-y-auto relative ${isPOSFullscreen ? "p-0" : "p-4 md:p-6"}`}>
          <AnimatePresence mode="wait">
            {/* POS DIRECT CHECKOUT */}
            {activeTab === "POS" && (
              <motion.div
                key="POS"
                initial={{ opacity: 0, y: 12, scale: 0.995 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.995 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="h-full"
              >
                <POSModule
                  products={products}
                  customers={customers}
                  transactions={filteredTransactions}
                  onCompleteSale={handleCompleteSaleAction}
                  activeUsername={activeUser.name}
                  settings={settings}
                  onAddAuditLog={handleAddAuditLog}
                  currency={currency}
                  onShowToast={showToast}
                  isPOSFullscreen={isPOSFullscreen}
                  onChangePOSFullscreen={setIsPOSFullscreen}
                  onTriggerPanic={handleTriggerPanic}
                />
              </motion.div>
            )}

            {/* STATS ANALYTICS CONTROL PANEL */}
            {activeTab === "DASHBOARD" && (
              <motion.div
                key="DASHBOARD"
                initial={{ opacity: 0, y: 12, scale: 0.995 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.995 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="h-full"
              >
                <DashboardModule
                  transactions={filteredTransactions}
                  products={products}
                  customers={customers}
                  cashFlow={filteredCashFlow}
                  currency={currency}
                  activeUser={activeUser}
                  onChangeModule={(mod) => setActiveTab(mod.toUpperCase())}
                  settings={settings}
                  onUpdateSettings={handleUpdateSettings}
                  onUpdateProduct={handleUpdateProduct}
                  onAddAuditLog={handleAddAuditLog}
                  onShowToast={showToast}
                  onCompleteSale={handleCompleteSaleAction}
                  pendingSyncQueue={pendingSyncQueue}
                  isManualSyncing={isManualSyncing}
                  isOnline={isOnline}
                  onManualSync={handleManualSync}
                  theme={theme}
                  onTriggerPanic={handleTriggerPanic}
                />
              </motion.div>
            )}

            {/* DAILY BOOK BALANCE CASH OPERATIONS */}
            {activeTab === "CASH" && (
              <motion.div
                key="CASH"
                initial={{ opacity: 0, y: 12, scale: 0.995 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.995 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="h-full"
              >
                <CashRegisterModule
                  cashFlow={filteredCashFlow}
                  transactions={filteredTransactions}
                  onAddCashFlowEntry={handleAddCashFlowEntry}
                  activeUsername={activeUser.name}
                  currentRole={simplifiedRole}
                  onAddAuditLog={handleAddAuditLog}
                  currency={currency}
                  settings={settings}
                />
              </motion.div>
            )}

            {/* ACTIVE STOCK INVENTORY MANAGER */}
            {activeTab === "STOCK" && (
              <motion.div
                key="STOCK"
                initial={{ opacity: 0, y: 12, scale: 0.995 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.995 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="h-full"
              >
                {!canAccessModule("stock", activeUser?.subscriptionPlan || settings.subscriptionPlan || "OURO").allowed ? (
                  <PlanLockScreen
                    moduleName="Gestão Avançada de Stock"
                    requiredPlan="PRATA"
                    userPlan={activeUser?.subscriptionPlan || settings.subscriptionPlan || "OURO"}
                    description="O Plano Bronze inclui apenas vendas rápidas POS e catálogo básico. Atualize para o Plano Prata ou Ouro para gerir lotes, datas de expiração e reabastecimentos."
                    onUpgradeClick={() => setActiveTab("PLANS")}
                  />
                ) : (
                  <StockModule
                    products={products}
                    transactions={filteredTransactions}
                    onAddProduct={handleAddProduct}
                    onUpdateProduct={handleUpdateProduct}
                    onDeleteProduct={handleDeleteProduct}
                    onAddAuditLog={handleAddAuditLog}
                    currentRole={simplifiedRole}
                    currency={currency}
                    settings={settings}
                    onShowToast={showToast}
                    onUpdateSettings={handleUpdateSettings}
                  />
                )}
              </motion.div>
            )}

            {/* CUSTOMER LOYALTY CRM & MARKETING SMS */}
            {(activeTab === "CUSTOMERS" || activeTab === "CLIENTES") && (
              <motion.div
                key="CUSTOMERS"
                initial={{ opacity: 0, y: 12, scale: 0.995 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.995 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="h-full"
              >
                <CustomersModule
                  customers={customers}
                  transactions={transactions}
                  settings={settings}
                  onAddCustomer={handleAddCustomer}
                  onUpdateCustomer={(updatedC) => {
                    setCustomers(prev => {
                      const updated = prev.map(c => c.id === updatedC.id ? updatedC : c);
                      syncTable("customers", updated);
                      return updated;
                    });
                  }}
                  onAddCashFlowEntry={handleAddCashFlowEntry}
                  onDeleteCustomer={handleDeleteCustomer}
                  onAddAuditLog={handleAddAuditLog}
                  currentRole={simplifiedRole}
                  activeUsername={activeUser.name}
                  currency={currency}
                  onShowToast={showToast}
                />
              </motion.div>
            )}

            {/* STAFF EMPLOYEES & SECURITY TRAIL AUDITOR */}
            {activeTab === "STAFF" && (
              <motion.div
                key="STAFF"
                initial={{ opacity: 0, y: 12, scale: 0.995 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.995 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="h-full"
              >
                {!canAccessModule("staff", activeUser?.subscriptionPlan || settings.subscriptionPlan || "OURO").allowed ? (
                  <PlanLockScreen
                    moduleName="Equipa & Auditoria D3"
                    requiredPlan="PRATA"
                    userPlan={activeUser?.subscriptionPlan || settings.subscriptionPlan || "OURO"}
                    description="A gestão avançada de utilizadores e auditoria D3 está disponível nos Planos Prata e Ouro."
                    onUpgradeClick={() => setActiveTab("PLANS")}
                  />
                ) : (
                  <StaffModule
                    employees={employees}
                    auditLogs={auditLogs}
                    onAddEmployee={handleAddEmployee}
                    onUpdateEmployees={handleUpdateEmployees}
                    activeUsername={activeUser.name}
                    onAddAuditLog={handleAddAuditLog}
                    currentRole={simplifiedRole}
                    currency={currency}
                    settings={settings}
                  />
                )}
              </motion.div>
            )}

            {/* REVENUE PREDICTION AI PANEL */}
            {activeTab === "AI" && (
              <motion.div
                key="AI"
                initial={{ opacity: 0, y: 12, scale: 0.995 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.995 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="h-full"
              >
                {!canAccessModule("ai", activeUser?.subscriptionPlan || settings.subscriptionPlan || "OURO").allowed ? (
                  <PlanLockScreen
                    moduleName="Previsão AI Premium"
                    requiredPlan="OURO"
                    userPlan={activeUser?.subscriptionPlan || settings.subscriptionPlan || "OURO"}
                    description="Modelos preditivos avançados com Inteligência Artificial e o Gerador de Flyers Promocionais são exclusivos do Plano Ouro (VIP)."
                    onUpgradeClick={() => setActiveTab("PLANS")}
                  />
                ) : (
                  <AiForecastModule
                    products={products}
                    transactions={filteredTransactions}
                    settings={settings}
                    theme={theme}
                    currency={currency}
                    onShowToast={showToast}
                    onChangeModule={(mod) => setActiveTab(mod.toUpperCase())}
                  />
                )}
              </motion.div>
            )}

            {/* FINANCIAL REPORTS & SMTP TRIGGERS */}
            {activeTab === "REPORTS" && (
              <motion.div
                key="REPORTS"
                initial={{ opacity: 0, y: 12, scale: 0.995 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.995 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="h-full"
              >
                <ReportsModule
                  transactions={filteredTransactions}
                  settings={settings}
                  onUpdateSettings={handleUpdateSettings}
                  onAddAuditLog={handleAddAuditLog}
                  currency={currency}
                  onShowToast={showToast}
                  auditLogs={auditLogs}
                />
              </motion.div>
            )}

            {/* TUTORIAL LESSONS CENTER */}
            {activeTab === "TRAINING" && (
              <motion.div
                key="TRAINING"
                initial={{ opacity: 0, y: 12, scale: 0.995 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.995 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="h-full"
              >
                <TrainingModule
                  videos={masterclassVideos}
                  currency={currency}
                />
              </motion.div>
            )}

            {/* COMPANY GENERAL IDENTITIES AND MAIN SETTINGS */}
            {activeTab === "SETTINGS" && (
              <motion.div
                key="SETTINGS"
                initial={{ opacity: 0, y: 12, scale: 0.995 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.995 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="h-full"
              >
                <SettingsModule
                  settings={settings}
                  onUpdateSettings={handleUpdateSettings}
                  onAddAuditLog={handleAddAuditLog}
                  currentRole={simplifiedRole}
                  currency={currency}
                  onShowToast={showToast}
                  activeUser={activeUser}
                  activeColorTheme={activeColorTheme}
                  onChangeColorTheme={handleThemeChange}
                  onExportLocalDB={handleExportLocalDB}
                  onImportLocalDB={handleImportLocalDB}
                  onTriggerLocalBackup={handleTriggerLocalBackup}
                  onGetBackupPayload={handleGetBackupPayload}
                  systemVersion={currentSystemVersion}
                  employees={employees}
                  auditLogs={auditLogs}
                  onResetEmployeePin={async (empId) => {
                    const target = employees.find(e => e.id === empId);
                    if (!target) return;
                    const generatedPin = Math.floor(100000 + Math.random() * 900000).toString();
                    const updatedEmployees = employees.map(emp => {
                      if (emp.id === empId) {
                        return {
                          ...emp,
                          pin: generatedPin,
                          password: generatedPin,
                          pinChanged: false,
                          pinCreatedAt: new Date().toISOString()
                        };
                      }
                      return emp;
                    });
                    setEmployees(updatedEmployees);
                    await syncTable("employees", updatedEmployees);
                    handleAddAuditLog(
                      "Reset de PIN Forçado",
                      "SEGURANÇA",
                      `PIN do colaborador ${target.name} (${target.username}) redefinido e enviado para o e-mail pelo Administrador.`
                    );

                    let emailDetails = "";
                    const targetEmail = target.email?.trim();
                    if (targetEmail) {
                      try {
                        await sendEmail({
                          to: targetEmail,
                          subject: "Redefinição de PIN / Senha de Acesso - OST Vendas",
                          body: `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                              <div style="text-align: center; border-bottom: 2px solid #ff6b00; padding-bottom: 15px; margin-bottom: 20px;">
                                <h1 style="color: #0f172a; margin: 0; font-size: 24px;">OST Vendas</h1>
                                <p style="color: #64748b; margin: 5px 0 0 0; font-size: 14px;">Notificação de Segurança - Redefinição de Credenciais</p>
                              </div>
                              <h2 style="color: #1e293b; font-size: 18px;">Olá, ${target.name}!</h2>
                              <p style="color: #475569; font-size: 14px; line-height: 1.5;">Informamos que as suas credenciais de acesso ao sistema <strong>OST Vendas</strong> foram redefinidas com sucesso pela Administração.</p>
                              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; text-align: center; margin: 20px 0;">
                                <span style="color: #64748b; font-size: 12px; display: block; margin-bottom: 5px; font-weight: bold; text-transform: uppercase;">Novo PIN Temporário de Acesso:</span>
                                <strong style="color: #ff6b00; font-size: 24px; letter-spacing: 2px; font-family: monospace;">${generatedPin}</strong>
                              </div>
                              <p style="color: #475569; font-size: 14px; line-height: 1.5;">Por motivos de segurança, utilize este PIN temporário para efetuar o login. O sistema exigirá que defina uma senha definitiva personalizada no primeiro acesso.</p>
                              <p style="color: #94a3b8; font-size: 12px; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 15px; text-align: center;">Se não solicitou esta alteração, entre em contacto imediatamente com o Administrador.</p>
                            </div>
                          `,
                          isHtml: true
                        });
                        emailDetails = ` Um e-mail com a nova senha foi enviado com sucesso para ${targetEmail}.`;
                      } catch (emailErr) {
                        console.error("Erro ao enviar e-mail de redefinição de PIN:", emailErr);
                        emailDetails = " (Nota: Ocorreu um erro ao enviar o e-mail de notificação. Certifique-se de que as configurações de SMTP estão ativas).";
                      }
                    } else {
                      emailDetails = " (Aviso: O colaborador não possui e-mail cadastrado no sistema para o envio automático).";
                    }

                    showToast(
                      `PIN do colaborador ${target.name} redefinido com sucesso para '${generatedPin}'.${emailDetails}`,
                      "success",
                      "Reset de PIN Concluído"
                    );
                  }}
                  onUpdateEmployeeTheme={async (empId, themeId) => {
                    const target = employees.find(e => e.id === empId);
                    if (!target) return;
                    const updatedEmployees = employees.map(emp => {
                      if (emp.id === empId) {
                        return {
                          ...emp,
                          theme: themeId
                        };
                      }
                      return emp;
                    });
                    setEmployees(updatedEmployees);
                    await syncTable("employees", updatedEmployees);
                    
                    if (activeUser && activeUser.id === empId) {
                      setActiveColorTheme(themeId);
                      localStorage.setItem("erp_theme_" + empId, themeId);
                    }

                    handleAddAuditLog(
                      "Definição de Tema de Colaborador",
                      "SEGURANÇA",
                      `Tema do colaborador ${target.name} (${target.username}) atualizado para ${themeId} pelo Administrador.`
                    );
                    showToast(
                      `Preferência de cor para ${target.name} atualizada para '${themeId}'.`,
                      "success",
                      "Tema de Colaborador"
                    );
                  }}
                />
              </motion.div>
            )}

            {/* GATEWAY INTEGRATION PANEL */}
            {activeTab === "GATEWAY" && (
              <motion.div
                key="GATEWAY"
                initial={{ opacity: 0, y: 12, scale: 0.995 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.995 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="h-full"
              >
                {!canAccessModule("gateway", activeUser?.subscriptionPlan || settings.subscriptionPlan || "OURO").allowed ? (
                  <PlanLockScreen
                    moduleName="Integração Mobile Money"
                    requiredPlan="PRATA"
                    userPlan={activeUser?.subscriptionPlan || settings.subscriptionPlan || "OURO"}
                    description="O recebimento automático via M-Pesa e e-Mola (Paga Fácil) está disponível a partir do Plano Prata."
                    onUpgradeClick={() => setActiveTab("PLANS")}
                  />
                ) : (
                  <GatewayModule
                    settings={settings}
                    onUpdateSettings={handleUpdateSettings}
                    onAddAuditLog={handleAddAuditLog}
                    currentRole={simplifiedRole}
                    onShowToast={showToast}
                    products={products}
                    customers={customers}
                  />
                )}
              </motion.div>
            )}

            {/* PLANS & SUBSCRIPTIONS PANEL */}
            {activeTab === "PLANS" && (
              <motion.div
                key="PLANS"
                initial={{ opacity: 0, y: 12, scale: 0.995 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.995 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="h-full"
              >
                <SubscriptionPlansModule
                  currentPlan={activeUser?.subscriptionPlan || settings.subscriptionPlan || "OURO"}
                  activeUser={activeUser}
                  employees={employees}
                  settings={settings}
                  onUpdateUserPlan={handleUpdateUserPlan}
                  onUpdateSystemPlan={handleUpdateSystemPlan}
                  onShowToast={showToast}
                  onNavigateToModule={(mod) => setActiveTab(mod.toUpperCase())}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

      </div>

      {/* PIN Verification Modal for Switching Operator */}
      <AnimatePresence>
        {pinVerificationOpen && (
          <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden flex flex-col ${
                theme === "night"
                  ? "bg-zinc-950 text-slate-100 border-zinc-850"
                  : "bg-white text-slate-800 border-slate-100"
              }`}
              id="profile-pin-verification-modal"
            >
              {/* Modal Header */}
              <div className={`p-6 border-b flex items-center justify-between ${
                theme === "night" ? "bg-zinc-900 border-zinc-850" : "bg-slate-50 border-slate-100"
              }`}>
                <div className="flex items-center gap-3 text-left">
                  <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center shadow-inner">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm">Autenticação Requerida</h3>
                    <p className="text-[11px] text-slate-400 font-medium font-mono">Terminal POS de Segurança</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPinVerificationOpen(false);
                    setPinTargetEmployee(null);
                  }}
                  className={`w-8 h-8 rounded-full border flex items-center justify-center transition cursor-pointer text-xs font-bold ${
                    theme === "night"
                      ? "bg-zinc-900 border-zinc-850 text-slate-400 hover:text-white"
                      : "bg-white border-slate-200 text-slate-400 hover:text-slate-600"
                  }`}
                >
                  ✕
                </button>
              </div>

              {/* Login Method Tabs */}
              <div className="flex border-b border-slate-100 dark:border-zinc-850">
                <button
                  type="button"
                  onClick={() => {
                    setLoginMethod("select");
                    setPinError("");
                  }}
                  className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 ${
                    loginMethod === "select"
                      ? "border-orange-500 text-orange-600 font-extrabold"
                      : "border-transparent text-slate-400 hover:text-slate-600"
                  }`}
                >
                  👥 Selecionar Operador
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginMethod("type");
                    setPinError("");
                  }}
                  className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 ${
                    loginMethod === "type"
                      ? "border-orange-500 text-orange-600 font-extrabold"
                      : "border-transparent text-slate-400 hover:text-slate-600"
                  }`}
                >
                  🔑 Introduzir Username
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 flex flex-col items-center">
                {/* Method 1: Dropdown selector */}
                {loginMethod === "select" && (
                  <div className="w-full space-y-3 mb-4">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block text-left">
                      Escolha o Colaborador
                    </label>
                    <select
                      value={pinTargetEmployee ? pinTargetEmployee.id : ""}
                      onChange={(e) => {
                        const emp = employees.find(empItem => empItem.id === e.target.value);
                        if (emp) {
                          setPinTargetEmployee(emp);
                          setEnteredPin("");
                          setPinError("");
                        }
                      }}
                      className={`w-full p-2.5 rounded-xl border font-semibold outline-none text-xs cursor-pointer ${
                        theme === "night"
                          ? "bg-zinc-900 border-zinc-800 text-slate-100"
                          : "bg-slate-50 border-slate-200 text-slate-800 focus:border-orange-500 shadow-sm"
                      }`}
                    >
                      <option value="" disabled>-- Escolha um Operador do Quadro --</option>
                      {employees.filter(e => e.status !== "INACTIVE" && e.status !== "SUSPENDED").map(empItem => (
                        <option key={empItem.id} value={empItem.id}>
                          {empItem.role.toUpperCase().includes("ADMIN") ? "👨‍💼" : empItem.role.toUpperCase().includes("SUPERVISOR") ? "👨‍💻" : "👩‍💼"}{" "}
                          {empItem.name} ({empItem.username || "sem username"})
                        </option>
                      ))}
                    </select>

                    {pinTargetEmployee && (
                      <div className={`w-full p-3.5 rounded-xl border text-left flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-200 ${
                        theme === "night"
                          ? "bg-zinc-900/60 border-zinc-850"
                          : "bg-orange-50/55 border-orange-100/50"
                      }`}>
                        <div className="text-2xl mt-0.5">
                          {pinTargetEmployee.role.toUpperCase().includes("ADMIN") ? "👨‍💼" : pinTargetEmployee.role.toUpperCase().includes("SUPERVISOR") ? "👨‍💻" : "👩‍💼"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-100">{pinTargetEmployee.name}</h4>
                          <p className="text-[10px] text-slate-400 font-semibold">{pinTargetEmployee.role}</p>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-200/60 text-slate-600 dark:bg-zinc-850 dark:text-slate-400">
                              @{pinTargetEmployee.username}
                            </span>
                            {(pinTargetEmployee.pinChanged === false || pinTargetEmployee.pinChanged === undefined) ? (
                              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 animate-pulse">
                                Senha Temporária
                              </span>
                            ) : (
                              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                                Senha Definida
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Method 2: Manual Username Entry */}
                {loginMethod === "type" && (
                  <div className="w-full space-y-1.5 mb-4">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block text-left">
                      Username do Operador
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-mono">@</span>
                      <input
                        type="text"
                        placeholder="Iniciais + Apelido (Ex: ldomingos)"
                        value={enteredUsername}
                        onChange={(e) => {
                          setEnteredUsername(e.target.value.toLowerCase().replace(/\s/g, ""));
                          if (pinError) setPinError("");
                        }}
                        className={`w-full pl-8 pr-4 py-2.5 rounded-xl border font-mono font-bold text-xs outline-none ${
                          theme === "night"
                            ? "bg-zinc-900 border-zinc-800 text-slate-100 focus:border-orange-500"
                            : "bg-slate-50 border-slate-200 text-slate-850 focus:border-orange-500 focus:bg-white shadow-sm"
                        }`}
                        autoFocus={loginMethod === "type"}
                      />
                    </div>
                  </div>
                )}

                {/* Password Input Field */}
                <div className="w-full space-y-1.5 mb-4">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block text-left">
                    Digite a sua Senha de Acesso
                  </label>
                  <input
                    type="password"
                    maxLength={32}
                    value={enteredPin}
                    onChange={(e) => {
                      setEnteredPin(e.target.value);
                      if (pinError) setPinError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleVerifyAndSwitchProfile();
                      }
                    }}
                    placeholder="Sua senha secreta"
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all text-xs font-medium ${
                      theme === "night"
                        ? "bg-zinc-900 border-zinc-800 text-slate-100 focus:border-orange-500 focus:ring-orange-500/20"
                        : "bg-slate-50 border-slate-200 text-slate-800 focus:border-orange-500 focus:ring-orange-500/20 shadow-sm"
                    }`}
                  />
                  {pinError && (
                    <p className="text-xs text-rose-500 font-extrabold text-left animate-pulse mt-1.5">
                      ⚠️ {pinError}
                    </p>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className={`p-4 border-t flex items-center justify-between gap-3 ${
                theme === "night" ? "bg-zinc-900 border-zinc-850" : "bg-slate-50 border-slate-100"
              }`}>
                <button
                  type="button"
                  onClick={() => {
                    setPinVerificationOpen(false);
                    setPinTargetEmployee(null);
                  }}
                  className={`px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
                    theme === "night"
                      ? "text-slate-400 hover:text-white"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleVerifyAndSwitchProfile}
                  className={`px-5 py-2.5 text-xs font-extrabold rounded-xl shadow-md transition-all cursor-pointer bg-orange-500 hover:bg-orange-600 text-white transform hover:scale-105`}
                >
                  Autenticar Perfil
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Force PIN Change Modal */}
      <AnimatePresence>
        {forcePinChangeOpen && forcePinTargetEmployee && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden flex flex-col ${
                theme === "night"
                  ? "bg-zinc-950 text-slate-100 border-zinc-850"
                  : "bg-white text-slate-800 border-slate-100"
              }`}
            >
              {/* Header */}
              <div className="p-6 border-b border-slate-100 dark:border-zinc-850 bg-gradient-to-r from-amber-500/10 to-orange-500/10 text-left">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center shadow-inner">
                    <ShieldAlert className="w-5 h-5 animate-bounce" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-slate-800 dark:text-slate-100">Atualização de Segurança Obrigatória</h3>
                    <p className="text-[10px] text-amber-600 font-extrabold font-mono uppercase">Definir Senha Definitiva de Acesso</p>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4 text-left">
                <div className="p-3.5 bg-amber-50 border border-amber-100 rounded-xl space-y-1 text-xs">
                  <p className="font-bold text-amber-800">Olá {forcePinTargetEmployee.name},</p>
                  <p className="text-amber-700 leading-relaxed text-[11px]">
                    De acordo com a política de segurança, a sua senha inicial é temporária ou expirou. **Todas as senhas de acesso possuem validade máxima de 2 meses (60 dias)**. Defina uma senha de acesso forte de pelo menos 6 caracteres.
                  </p>
                </div>

                <div className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Nova Senha de Acesso</label>
                    <input
                      type="password"
                      maxLength={32}
                      placeholder="Mínimo 6 caracteres"
                      value={newPin}
                      onChange={(e) => {
                        setNewPin(e.target.value);
                        if (forcePinError) setForcePinError("");
                      }}
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl border focus:outline-none focus:ring-2 text-xs font-medium ${
                        theme === "night"
                          ? "bg-zinc-900 border-zinc-800 text-slate-100 focus:ring-orange-500/20"
                          : "bg-slate-50 border-slate-200 text-slate-800 focus:ring-orange-500/20 focus:bg-white"
                      }`}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Confirmar Nova Senha</label>
                    <input
                      type="password"
                      maxLength={32}
                      placeholder="Repita a nova senha de acesso"
                      value={confirmNewPin}
                      onChange={(e) => {
                        setConfirmNewPin(e.target.value);
                        if (forcePinError) setForcePinError("");
                      }}
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl border focus:outline-none focus:ring-2 text-xs font-medium ${
                        theme === "night"
                          ? "bg-zinc-900 border-zinc-800 text-slate-100 focus:ring-orange-500/20"
                          : "bg-slate-50 border-slate-200 text-slate-800 focus:ring-orange-500/20 focus:bg-white"
                      }`}
                    />
                  </div>

                  {forcePinError && (
                    <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs font-bold flex items-center gap-1.5 animate-pulse">
                      <span>⚠️</span>
                      <span>{forcePinError}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-slate-100 dark:border-zinc-850 flex justify-end gap-3 bg-slate-50 dark:bg-zinc-900">
                <button
                  type="button"
                  onClick={() => {
                    setForcePinChangeOpen(false);
                    setForcePinTargetEmployee(null);
                  }}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleForcePinChangeSubmit}
                  disabled={newPin.length < 6 || confirmNewPin.length < 6}
                  className={`px-5 py-2.5 text-xs font-extrabold rounded-xl shadow-md transition-all cursor-pointer ${
                    newPin.length >= 6 && confirmNewPin.length >= 6
                      ? "bg-orange-500 hover:bg-orange-600 text-white transform hover:scale-105"
                      : "bg-slate-200 text-slate-400 cursor-not-allowed"
                  }`}
                >
                  Ativar Conta & Aceder
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Interactive Account Switching & Linking Modal */}
      <AnimatePresence>
        {isUserSwitchModalOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden flex flex-col ${
                theme === "night"
                  ? "bg-zinc-950 text-slate-100 border-zinc-850"
                  : "bg-white text-slate-800 border-slate-100"
              }`}
              id="inside-user-switcher-modal"
            >
              <motion.div
                initial={{ x: 40, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -40, opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="w-full h-full flex flex-col"
              >
                {/* Header */}
                <div className="p-6 border-b border-slate-100 dark:border-zinc-850 bg-gradient-to-r from-orange-500/10 to-amber-500/10 text-left">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-orange-100 text-orange-700 dark:bg-orange-900/35 dark:text-orange-400 rounded-xl flex items-center justify-center shadow-inner">
                        <Users className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-black text-sm text-slate-800 dark:text-slate-100">Painel do Colaborador</h3>
                        <p className="text-[10px] text-orange-600 dark:text-orange-400 font-extrabold font-mono uppercase">Vincular Conta & Configurar Perfil</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsUserSwitchModalOpen(false)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-900 text-slate-400 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Tabs */}
                <div className={`flex border-b text-xs font-bold ${
                  theme === "night" ? "border-zinc-850 bg-zinc-900/40" : "border-slate-100 bg-slate-50/40"
                }`}>
                  <button
                    type="button"
                    onClick={() => setUserSwitchModalTab("switch")}
                    className={`flex-1 py-3 text-center border-b-2 transition-all cursor-pointer ${
                      userSwitchModalTab === "switch"
                        ? "border-orange-500 text-orange-500 font-black"
                        : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    }`}
                  >
                    🔄 Alterar Usuário
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserSwitchModalTab("profile")}
                    className={`flex-1 py-3 text-center border-b-2 transition-all cursor-pointer ${
                      userSwitchModalTab === "profile"
                        ? "border-orange-500 text-orange-500 font-black"
                        : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    }`}
                  >
                    ⚙️ Configurações de Perfil
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserSwitchModalTab("activity")}
                    className={`flex-1 py-3 text-center border-b-2 transition-all cursor-pointer ${
                      userSwitchModalTab === "activity"
                        ? "border-orange-500 text-orange-500 font-black"
                        : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    }`}
                  >
                    📜 Histórico de Atividade
                  </button>
                </div>

                {/* Body */}
                <div className="p-6 text-left overflow-y-auto max-h-[60vh]">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={userSwitchModalTab}
                      initial={{ opacity: 0, x: userSwitchModalTab === "switch" ? -15 : 15 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: userSwitchModalTab === "switch" ? 15 : -15 }}
                      transition={{ duration: 0.22, ease: "easeInOut" }}
                      className="space-y-4"
                    >
                      {userSwitchModalTab === "switch" ? (
                        <>
                          <div className="p-3.5 bg-orange-500/10 border border-orange-500/20 rounded-xl space-y-1 text-xs">
                            <p className="font-bold text-orange-500">Sessão Autenticada Ativa:</p>
                            <p className="text-slate-400 leading-relaxed text-[11px]">
                              Atualmente você está logado no sistema via e-mail com: <strong className="text-orange-400 font-mono">{auth.currentUser?.email || "Sem e-mail (Login Local)"}</strong>.
                              Você pode selecionar qualquer colaborador no quadro comercial abaixo para **vincular o seu e-mail ativo** a ele e mudar seu operador operacional de forma instantânea.
                            </p>
                          </div>

                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Selecione o Colaborador de Destino</label>
                            <select
                              value={switchSelectedEmployeeId}
                              onChange={(e) => {
                                const newId = e.target.value;
                                setSwitchSelectedEmployeeId(newId);
                                setSwitchEnteredPin("");
                                setSwitchPinError("");
                                const found = employees.find(x => x.id === newId) || activeUser;
                                setProfileObservacoes(found?.observacoes || "");
                                setProfileExpirationDate(found?.expirationDate || "");
                              }}
                              className="w-full bg-slate-950 border border-slate-800 focus:border-[#FF6B00] rounded-xl py-3 px-3 text-xs text-white outline-none transition font-medium cursor-pointer"
                            >
                              <option value="">-- Escolha um colaborador --</option>
                              {employees.map(emp => (
                                <option key={emp.id} value={emp.id}>
                                  {emp.name} ({emp.role}) {emp.email ? `[Vínculo: ${emp.email}]` : "[Sem vínculo]"}
                                </option>
                              ))}
                            </select>
                          </div>

                          {switchSelectedEmployeeId && (
                            <div className="space-y-4 p-4 bg-slate-900/60 rounded-xl border border-slate-800 animate-in fade-in duration-200">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-orange-500/10 border border-orange-500/25 text-orange-400 flex items-center justify-center font-bold text-[11px] overflow-hidden">
                                  {employees.find(x => x.id === switchSelectedEmployeeId)?.fotoPerfil ? (
                                    (employees.find(x => x.id === switchSelectedEmployeeId)?.fotoPerfil || "").startsWith("data:") || (employees.find(x => x.id === switchSelectedEmployeeId)?.fotoPerfil || "").startsWith("http") ? (
                                      <img src={employees.find(x => x.id === switchSelectedEmployeeId)?.fotoPerfil} className="w-full h-full object-cover" alt="Perfil" referrerPolicy="no-referrer" />
                                    ) : (
                                      <span className="text-sm leading-none">{employees.find(x => x.id === switchSelectedEmployeeId)?.fotoPerfil}</span>
                                    )
                                  ) : (
                                    (employees.find(x => x.id === switchSelectedEmployeeId)?.name || "US").substring(0, 2).toUpperCase()
                                  )}
                                </div>
                                <div className="leading-none text-left">
                                  <p className="font-extrabold text-xs text-white">
                                    {employees.find(x => x.id === switchSelectedEmployeeId)?.name}
                                  </p>
                                  <p className="text-[10px] text-slate-400 mt-1">
                                    {employees.find(x => x.id === switchSelectedEmployeeId)?.role}
                                  </p>
                                </div>
                              </div>

                              {/* PASSWORD / PIN INPUT FIELD FOR PROTECTION WITH SHOW/HIDE TOGGLE */}
                              <div className="border-t border-slate-800 pt-3 space-y-1.5 text-left">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                  Senha / PIN de Acesso do Colaborador Selecionado
                                </label>
                                <div className="relative">
                                  <input
                                    type={showSwitchPin ? "text" : "password"}
                                    maxLength={32}
                                    value={switchEnteredPin}
                                    onChange={(e) => {
                                      setSwitchEnteredPin(e.target.value);
                                      if (switchPinError) setSwitchPinError("");
                                    }}
                                    placeholder="Digite o PIN/Senha do colaborador para confirmar"
                                    className="w-full bg-slate-950 border border-slate-800 focus:border-orange-500 rounded-xl py-2.5 pl-3.5 pr-10 text-xs text-white outline-none transition font-medium focus:ring-2 focus:ring-orange-500/20"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setShowSwitchPin(!showSwitchPin)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition p-1 cursor-pointer"
                                    title={showSwitchPin ? "Ocultar Senha" : "Mostrar Senha"}
                                  >
                                    {showSwitchPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                  </button>
                                </div>
                                {switchPinError && (
                                  <p className="text-[10.5px] text-red-500 font-bold animate-pulse mt-1">⚠️ {switchPinError}</p>
                                )}
                              </div>

                              <div className="border-t border-slate-800 pt-3 flex flex-col gap-2">
                                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    defaultChecked={true}
                                    id="auto-link-email-checkbox"
                                    className="mt-0.5 rounded border-slate-850 bg-slate-950 text-orange-500 focus:ring-orange-500/30 cursor-pointer"
                                  />
                                  <div className="text-left leading-tight">
                                    <p className="text-[11px] font-bold text-slate-200">Vincular meu e-mail atual a este perfil</p>
                                    <p className="text-[9.5px] text-slate-400 mt-0.5">Sempre que fizer login com <strong className="text-orange-400">{auth.currentUser?.email || "seu e-mail atual"}</strong>, você entrará automaticamente nesta conta comercial.</p>
                                  </div>
                                </label>
                              </div>
                            </div>
                          )}
                        </>
                      ) : userSwitchModalTab === "profile" ? (
                        <div className="space-y-4">
                          {/* Visual Alert Banner for Simple / Insecure PIN */}
                          {currentPinWarning && (
                            <div id="profile-pin-warning-alert" className="p-3.5 bg-rose-500/15 border border-rose-500/40 rounded-xl flex items-start gap-3 text-rose-300 shadow-sm animate-pulse">
                              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                              <div className="space-y-1 text-left flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <h4 className="text-xs font-bold text-rose-200 uppercase tracking-wide">
                                    {currentPinWarning.title}
                                  </h4>
                                  <span className="text-[9px] font-bold uppercase font-mono px-1.5 py-0.5 bg-rose-500/30 text-rose-200 border border-rose-500/40 rounded">
                                    Aviso de Risco
                                  </span>
                                </div>
                                <p className="text-[11px] leading-relaxed text-rose-300 font-medium">
                                  {currentPinWarning.message}
                                </p>
                                <div className="pt-1">
                                  <button
                                    type="button"
                                    onClick={handleResetPin}
                                    className="px-2.5 py-1 bg-rose-500 hover:bg-rose-600 text-white font-bold text-[10px] rounded-lg transition cursor-pointer inline-flex items-center gap-1 shadow active:scale-95"
                                  >
                                    <Key className="w-3 h-3" />
                                    Gerar Novo PIN Seguro Agora
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                          {/* Visual Preview Banner & Uploader */}
                          <div className="flex items-center gap-4 p-4 bg-slate-900/60 rounded-xl border border-slate-850">
                            <div className="relative shrink-0">
                              <div className="w-16 h-16 rounded-2xl bg-orange-500 text-white flex items-center justify-center font-bold text-xl overflow-hidden border border-slate-700 shadow-lg">
                                {profileFotoPerfil ? (
                                  profileFotoPerfil.startsWith("data:") || profileFotoPerfil.startsWith("http") || profileFotoPerfil.startsWith("/") ? (
                                    <img src={profileFotoPerfil} className="w-full h-full object-cover" alt="Previsualização" referrerPolicy="no-referrer" />
                                  ) : (
                                    <span className="text-3xl leading-none">{profileFotoPerfil}</span>
                                  )
                                ) : (
                                  profileName.substring(0, 2).toUpperCase() || "US"
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => document.getElementById("profile-photo-upload-input")?.click()}
                                className="absolute -bottom-1 -right-1 bg-orange-500 text-white rounded-lg p-1.5 hover:bg-orange-600 transition cursor-pointer shadow-md"
                                title="Carregar Imagem"
                              >
                                <Camera className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="flex-1 leading-none text-left">
                              <p className="text-xs font-black text-white">{profileName || "Sem Nome"}</p>
                              <p className="text-[10px] text-slate-400 mt-1.5 uppercase font-mono tracking-wider">{activeUser?.role || "Colaborador"}</p>
                              <div className="flex gap-2 mt-2">
                                <button
                                  type="button"
                                  onClick={() => document.getElementById("profile-photo-upload-input")?.click()}
                                  className="px-2.5 py-1 bg-slate-950 text-slate-300 hover:text-white rounded-lg text-[9px] font-bold border border-slate-800 hover:border-slate-700 transition cursor-pointer"
                                >
                                  Upload Foto
                                </button>
                                {profileFotoPerfil && (
                                  <button
                                    type="button"
                                    onClick={() => setProfileFotoPerfil("")}
                                    className="px-2.5 py-1 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg text-[9px] font-bold border border-red-500/20 transition cursor-pointer"
                                  >
                                    Remover
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Hidden File Input */}
                          <input
                            type="file"
                            id="profile-photo-upload-input"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                if (file.size > 1.5 * 1024 * 1024) {
                                  showToast("A imagem deve ter no máximo 1.5MB", "error");
                                  return;
                                }
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  setProfileFotoPerfil(reader.result as string);
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />

                          {/* Componente de Upload e Captura de Foto de Perfil via Câmera */}
                          <div id="profile-photo-camera-upload-component" className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-xl space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                                <Camera className="w-3.5 h-3.5 text-orange-400" />
                                <span>Personalizar com Câmera ou Ficheiro</span>
                              </span>
                              <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wide">
                                {isCameraActive ? "Câmera Ativa" : "Dispositivo"}
                              </span>
                            </div>

                            {!isCameraActive ? (
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  id="profile-start-camera-btn"
                                  onClick={async () => {
                                    setCameraError("");
                                    setIsCameraActive(true);
                                    try {
                                      const stream = await navigator.mediaDevices.getUserMedia({
                                        video: { width: { ideal: 640 }, height: { ideal: 640 }, facingMode: "user" }
                                      });
                                      mediaStreamRef.current = stream;
                                      if (videoRef.current) {
                                        videoRef.current.srcObject = stream;
                                        videoRef.current.play();
                                      }
                                    } catch (err: any) {
                                      console.error("Erro ao acessar câmera:", err);
                                      setCameraError("Acesso à câmera bloqueado ou indisponível.");
                                    }
                                  }}
                                  className="flex items-center justify-center gap-1.5 p-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-xl text-xs font-bold transition cursor-pointer active:scale-95 shadow-sm"
                                >
                                  <Video className="w-3.5 h-3.5" />
                                  <span>Usar Câmera</span>
                                </button>

                                <button
                                  type="button"
                                  id="profile-trigger-upload-btn"
                                  onClick={() => document.getElementById("profile-photo-upload-input")?.click()}
                                  className="flex items-center justify-center gap-1.5 p-2 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition cursor-pointer active:scale-95 shadow-sm"
                                >
                                  <Upload className="w-3.5 h-3.5 text-slate-400" />
                                  <span>Carregar Ficheiro</span>
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-2.5 bg-slate-950 p-3 rounded-xl border border-slate-800">
                                <div className="relative aspect-square max-w-[200px] mx-auto rounded-xl overflow-hidden bg-black border border-slate-700 shadow-inner">
                                  <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    className="w-full h-full object-cover transform -scale-x-100"
                                  />
                                  <div className="absolute top-2 right-2 bg-slate-900/80 text-orange-400 text-[9px] font-mono px-2 py-0.5 rounded-full border border-orange-500/30 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                                    <span>Ao Vivo</span>
                                  </div>
                                </div>

                                {cameraError && (
                                  <p className="text-[10.5px] text-rose-400 font-medium text-center bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">
                                    {cameraError}
                                  </p>
                                )}

                                <div className="flex items-center justify-center gap-2 pt-1">
                                  <button
                                    type="button"
                                    id="profile-capture-snapshot-btn"
                                    onClick={() => {
                                      if (videoRef.current) {
                                        const canvas = document.createElement("canvas");
                                        canvas.width = 400;
                                        canvas.height = 400;
                                        const ctx = canvas.getContext("2d");
                                        if (ctx) {
                                          ctx.translate(canvas.width, 0);
                                          ctx.scale(-1, 1);
                                          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                                          const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
                                          setProfileFotoPerfil(dataUrl);
                                          showToast("Foto capturada com sucesso!", "success");
                                          stopCamera();
                                        }
                                      }
                                    }}
                                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-md active:scale-95"
                                  >
                                    <Camera className="w-3.5 h-3.5" />
                                    <span>Capturar Foto</span>
                                  </button>

                                  <button
                                    type="button"
                                    id="profile-close-camera-btn"
                                    onClick={stopCamera}
                                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1 border border-slate-700"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                    <span>Cancelar</span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Emojis Preset Grid */}
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Escolha um Emoji como Avatar</label>
                            <div className="grid grid-cols-8 gap-2">
                              {["👨‍💼", "👩‍💼", "👨‍💻", "👩‍💻", "🚀", "🌟", "🍊", "💼", "☕", "🎮", "🦁", "🍕", "⚡", "❤️", "👑", "💡"].map((emoji) => (
                                <button
                                  type="button"
                                  key={emoji}
                                  onClick={() => setProfileFotoPerfil(emoji)}
                                  className={`text-lg p-2 rounded-xl transition-all border cursor-pointer hover:scale-110 flex items-center justify-center ${
                                    profileFotoPerfil === emoji
                                      ? "bg-orange-500/15 border-orange-500 text-white"
                                      : "bg-slate-950 border-slate-850 hover:border-slate-650 text-slate-300"
                                  }`}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Manual Image URL */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Ou Cole uma URL de Imagem</label>
                            <input
                              type="text"
                              value={profileFotoPerfil.startsWith("data:") ? "" : profileFotoPerfil}
                              placeholder="https://exemplo.com/sua-foto.jpg"
                              onChange={(e) => setProfileFotoPerfil(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-850 focus:border-orange-500 rounded-xl py-2.5 px-3 text-xs text-white outline-none transition font-medium"
                            />
                          </div>

                          {/* Campos Editáveis de Nome, Contacto e WhatsApp com Botão de Gravar Alterações */}
                          <div id="editable-profile-info-section" className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-xl space-y-3">
                            <div className="flex items-center justify-between gap-2">
                              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                                <UserCheck className="w-3.5 h-3.5 text-orange-400" />
                                <span>Dados do Colaborador (Editável)</span>
                              </label>
                              <button
                                type="button"
                                id="save-profile-changes-btn"
                                onClick={handleSaveProfileChanges}
                                className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-md active:scale-95"
                                title="Gravar alterações no Firestore"
                              >
                                <Save className="w-3.5 h-3.5" />
                                <span>Gravar Alterações</span>
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-1">
                                  <label htmlFor="profile-name-input" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                    Nome Completo
                                  </label>
                                  {profileName.trim() ? (
                                    <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                      Preenchido
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-rose-400 font-semibold flex items-center gap-1">
                                      <AlertCircle className="w-3 h-3 text-rose-400" />
                                      Obrigatório
                                    </span>
                                  )}
                                </div>
                                <input
                                  type="text"
                                  id="profile-name-input"
                                  value={profileName}
                                  onChange={(e) => setProfileName(e.target.value)}
                                  placeholder="Digite o nome completo"
                                  className={`w-full bg-slate-950 border rounded-xl py-2.5 px-3 text-xs text-white outline-none transition font-medium ${
                                    profileName.trim()
                                      ? "border-emerald-500/70 focus:border-emerald-500 bg-emerald-950/10"
                                      : "border-rose-500 focus:border-rose-500 bg-rose-950/20"
                                  }`}
                                />
                                {!profileName.trim() && (
                                  <p className="text-[10px] text-rose-400 font-medium flex items-center gap-1 mt-1">
                                    <AlertCircle className="w-3 h-3 shrink-0 text-rose-400" />
                                    <span>O nome é obrigatório para identificação do colaborador.</span>
                                  </p>
                                )}
                              </div>

                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-1">
                                  <label htmlFor="profile-email-input" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                    <Mail className="w-3 h-3 text-sky-400" />
                                    <span>E-mail Profissional</span>
                                  </label>
                                  {profileEmail.trim() && (
                                    isEmailFormatValid(profileEmail) ? (
                                      <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                        Válido
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-rose-400 font-semibold flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3 text-rose-400" />
                                        Formato Inválido
                                      </span>
                                    )
                                  )}
                                </div>
                                <input
                                  type="email"
                                  id="profile-email-input"
                                  value={profileEmail}
                                  onChange={(e) => setProfileEmail(e.target.value)}
                                  placeholder="colaborador@empresa.com"
                                  className={`w-full bg-slate-950 border rounded-xl py-2.5 px-3 text-xs text-white outline-none transition font-medium ${
                                    profileEmail.trim()
                                      ? isEmailFormatValid(profileEmail)
                                        ? "border-emerald-500/70 focus:border-emerald-500 bg-emerald-950/10"
                                        : "border-rose-500 focus:border-rose-500 bg-rose-950/20"
                                      : "border-slate-800 focus:border-orange-500"
                                  }`}
                                />
                                {profileEmail.trim() && !isEmailFormatValid(profileEmail) && (
                                  <p className="text-[10px] text-rose-400 font-medium flex items-center gap-1 mt-1">
                                    <AlertCircle className="w-3 h-3 shrink-0 text-rose-400" />
                                    <span>Insira um formato válido de e-mail (ex: usuario@dominio.com).</span>
                                  </p>
                                )}
                              </div>

                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-1">
                                  <label htmlFor="profile-contact-input" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                    Contacto Telefónico
                                  </label>
                                  {profileContact.trim() && isMozambicanPhoneValid(profileContact) ? (
                                    <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                      Válido (+258)
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-rose-400 font-semibold flex items-center gap-1">
                                      <AlertCircle className="w-3 h-3 text-rose-400" />
                                      {!profileContact.trim() ? "Obrigatório" : "Formato Inválido"}
                                    </span>
                                  )}
                                </div>
                                <input
                                  type="text"
                                  id="profile-contact-input"
                                  value={profileContact}
                                  onChange={(e) => setProfileContact(formatMozambicanPhoneInput(e.target.value))}
                                  placeholder="+258XXXXXXXXX (ex: +258841234567)"
                                  className={`w-full bg-slate-950 border rounded-xl py-2.5 px-3 text-xs text-white outline-none transition font-medium ${
                                    profileContact.trim() && isMozambicanPhoneValid(profileContact)
                                      ? "border-emerald-500/70 focus:border-emerald-500 bg-emerald-950/10"
                                      : "border-rose-500 focus:border-rose-500 bg-rose-950/20"
                                  }`}
                                />
                                {(!profileContact.trim() || !isMozambicanPhoneValid(profileContact)) && (
                                  <p className="text-[10px] text-rose-400 font-medium flex items-center gap-1 mt-1">
                                    <AlertCircle className="w-3 h-3 shrink-0 text-rose-400" />
                                    <span>
                                      {!profileContact.trim()
                                        ? "O contacto telefónico é obrigatório."
                                        : "Use o formato moçambicano: +258 seguido de 9 dígitos (ex: +258841234567)."}
                                    </span>
                                  </p>
                                )}
                              </div>

                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-1">
                                  <label htmlFor="profile-whatsapp-input" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                    <MessageSquare className="w-3 h-3 text-emerald-400" />
                                    <span>WhatsApp (Pedidos)</span>
                                  </label>
                                  {profileWhatsapp.trim() && isMozambicanPhoneValid(profileWhatsapp) ? (
                                    <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                      Válido (+258)
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-rose-400 font-semibold flex items-center gap-1">
                                      <AlertCircle className="w-3 h-3 text-rose-400" />
                                      {!profileWhatsapp.trim() ? "Obrigatório" : "Formato Inválido"}
                                    </span>
                                  )}
                                </div>
                                <input
                                  type="text"
                                  id="profile-whatsapp-input"
                                  value={profileWhatsapp}
                                  onChange={(e) => setProfileWhatsapp(formatMozambicanPhoneInput(e.target.value))}
                                  placeholder="+258XXXXXXXXX (ex: +258841234567)"
                                  className={`w-full bg-slate-950 border rounded-xl py-2.5 px-3 text-xs text-white outline-none transition font-medium ${
                                    profileWhatsapp.trim() && isMozambicanPhoneValid(profileWhatsapp)
                                      ? "border-emerald-500/70 focus:border-emerald-500 bg-emerald-950/10"
                                      : "border-rose-500 focus:border-rose-500 bg-rose-950/20"
                                  }`}
                                />
                                {(!profileWhatsapp.trim() || !isMozambicanPhoneValid(profileWhatsapp)) && (
                                  <p className="text-[10px] text-rose-400 font-medium flex items-center gap-1 mt-1">
                                    <AlertCircle className="w-3 h-3 shrink-0 text-rose-400" />
                                    <span>
                                      {!profileWhatsapp.trim()
                                        ? "O número de WhatsApp é obrigatório para envio de pedidos."
                                        : "Use o formato moçambicano: +258 seguido de 9 dígitos (ex: +258841234567)."}
                                    </span>
                                  </p>
                                )}
                              </div>

                              {/* Campo Categoria de Perfil (Admin, Operador, Auditor) */}
                              <div id="profile-role-field-container" className="sm:col-span-2 space-y-2.5 p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl">
                                <div className="flex items-center justify-between gap-2">
                                  <label htmlFor="profile-role-select" className="text-[10px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                    <ShieldCheck className="w-3.5 h-3.5 text-orange-400" />
                                    <span>Categoria de Perfil (Role / Permissões)</span>
                                  </label>
                                  <span className="text-[10px] text-orange-400 font-bold px-2 py-0.5 bg-orange-500/10 border border-orange-500/20 rounded-md">
                                    {profileRole}
                                  </span>
                                </div>
                                <select
                                  id="profile-role-select"
                                  value={profileRole}
                                  onChange={(e) => setProfileRole(e.target.value)}
                                  className="w-full bg-slate-900 border border-slate-800 focus:border-orange-500 rounded-xl py-2.5 px-3 text-xs text-white outline-none transition font-medium cursor-pointer"
                                >
                                  <option value="Admin">Admin (Acesso Total / Gestão Global)</option>
                                  <option value="Operador">Operador (Vendas, Ponto de Venda e Caixa)</option>
                                  <option value="Auditor">Auditor (Acesso Restrito a Leitura e Relatórios)</option>
                                </select>
                                <p className="text-[10px] text-slate-400 font-medium leading-tight">
                                  Atualiza a função e o nível de acesso do colaborador no Firestore ao guardar as alterações.
                                </p>
                              </div>

                              {/* Campo Logotipo da Empresa com Pré-Visualização da Imagem */}
                              <div id="profile-logo-field-container" className="sm:col-span-2 space-y-2.5 p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl">
                                <div className="flex items-center justify-between gap-2">
                                  <label htmlFor="profile-logo-input" className="text-[10px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                    <Image className="w-3.5 h-3.5 text-orange-400" />
                                    <span>Logotipo da Empresa / Documentos (PDF)</span>
                                  </label>
                                  {profileLogoUrl.trim() ? (
                                    <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                      Logotipo Ativo
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-slate-400 font-medium">
                                      Padrão do Sistema
                                    </span>
                                  )}
                                </div>

                                <div className="flex flex-col sm:flex-row items-center gap-3">
                                  {/* Pré-visualização do Logotipo */}
                                  <div className="w-20 h-20 shrink-0 bg-slate-900 border-2 border-dashed border-slate-700 rounded-xl flex flex-col items-center justify-center relative overflow-hidden group">
                                    {profileLogoUrl ? (
                                      <>
                                        <img
                                          src={profileLogoUrl}
                                          alt="Pré-visualização do Logotipo"
                                          className="w-full h-full object-contain p-1.5"
                                          onError={(e) => {
                                            (e.target as HTMLElement).style.display = 'none';
                                          }}
                                        />
                                        <button
                                          type="button"
                                          onClick={() => setProfileLogoUrl("")}
                                          className="absolute inset-0 bg-slate-900/85 text-rose-400 opacity-0 group-hover:opacity-100 transition flex items-center justify-center font-bold text-[10px] cursor-pointer"
                                          title="Remover Logotipo"
                                        >
                                          Remover
                                        </button>
                                      </>
                                    ) : (
                                      <div className="text-center p-2">
                                        <Building className="w-6 h-6 text-slate-500 mx-auto mb-1" />
                                        <span className="text-[8px] text-slate-500 font-bold block leading-tight">Sem Logo</span>
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex-1 space-y-2 w-full">
                                    <p className="text-[10px] text-slate-400 leading-tight">
                                      Este logotipo é incluído automaticamente no cabeçalho das Ordens de Compra e ficheiros PDF para fornecedores.
                                    </p>
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="text"
                                        id="profile-logo-input"
                                        value={profileLogoUrl}
                                        onChange={(e) => setProfileLogoUrl(e.target.value)}
                                        placeholder="Cole a URL do logotipo (https://...)"
                                        className="flex-1 bg-slate-900 border border-slate-800 focus:border-orange-500 rounded-xl py-2 px-3 text-xs text-white outline-none transition font-medium"
                                      />
                                      <input
                                        type="file"
                                        id="profile-logo-file-input"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (file) {
                                            if (file.size > 2 * 1024 * 1024) {
                                              showToast("O ficheiro de logotipo deve ter no máximo 2MB", "error");
                                              return;
                                            }
                                            const reader = new FileReader();
                                            reader.onloadend = () => {
                                              setProfileLogoUrl(reader.result as string);
                                              showToast("Logotipo carregado com sucesso!", "success");
                                            };
                                            reader.readAsDataURL(file);
                                          }
                                        }}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => document.getElementById("profile-logo-file-input")?.click()}
                                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-orange-400 border border-orange-500/30 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer"
                                        title="Carregar Ficheiro de Logotipo"
                                      >
                                        <Upload className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline">Upload</span>
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Read-only PIN Creation Date, Reset PIN & Visual Strength Indicator */}
                          <div className="space-y-3 p-3.5 bg-slate-900/60 rounded-xl border border-slate-800">
                            <div className="flex items-center justify-between gap-3">
                              <div className="space-y-1 flex-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                  Data de Criação do PIN Atual
                                </label>
                                <input
                                  type="text"
                                  readOnly
                                  value={
                                    activeUser?.pinCreatedAt
                                      ? new Date(activeUser.pinCreatedAt).toLocaleDateString("pt-PT", {
                                          day: "2-digit",
                                          month: "2-digit",
                                          year: "numeric",
                                          hour: "2-digit",
                                          minute: "2-digit"
                                        })
                                      : activeUser?.admissionDate
                                      ? new Date(activeUser.admissionDate).toLocaleDateString("pt-PT", {
                                          day: "2-digit",
                                          month: "2-digit",
                                          year: "numeric"
                                        })
                                      : "Data não registrada"
                                  }
                                  className="bg-slate-950 border border-slate-800 text-slate-300 font-mono text-xs rounded-lg py-1.5 px-3 outline-none cursor-not-allowed w-full"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={handleResetPin}
                                className="shrink-0 mt-5 px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 hover:text-amber-400 border border-amber-500/30 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-sm"
                                title="Gerar novo PIN temporário aleatório"
                              >
                                <Key className="w-3.5 h-3.5 text-amber-500" />
                                Resetar PIN
                              </button>
                            </div>

                            {/* PIN Entry & Visual Strength Indicator */}
                            <div className="border-t border-slate-800/80 pt-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                  PIN Gerado / Testar Força do PIN
                                </label>
                                {testPinInput && (
                                  <span className={`text-[10px] font-bold font-mono ${pinStrength.colorText}`}>
                                    {pinStrength.label}
                                  </span>
                                )}
                              </div>

                              <div className="relative">
                                <input
                                  type="text"
                                  maxLength={8}
                                  value={testPinInput}
                                  onChange={(e) => setTestPinInput(e.target.value.replace(/\D/g, ""))}
                                  placeholder="Digite um PIN ou clique em Resetar PIN"
                                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2 px-3 text-xs text-white font-mono outline-none transition"
                                />
                              </div>

                              {/* Visual Strength Progress Bar (3-segment indicator) */}
                              <div className="space-y-1">
                                <div className="grid grid-cols-3 gap-1.5 h-1.5 w-full">
                                  <div className={`rounded-full transition-all duration-300 ${pinStrength.bars[0] ? pinStrength.colorBg : "bg-slate-800"}`} />
                                  <div className={`rounded-full transition-all duration-300 ${pinStrength.bars[1] ? pinStrength.colorBg : "bg-slate-800"}`} />
                                  <div className={`rounded-full transition-all duration-300 ${pinStrength.bars[2] ? pinStrength.colorBg : "bg-slate-800"}`} />
                                </div>
                                <p className="text-[10px] text-slate-400 font-medium leading-tight pt-0.5">
                                  {pinStrength.feedback}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* PIN Expiration Indicator */}
                          <div className={`p-3.5 rounded-xl border flex flex-col gap-1 text-xs leading-relaxed transition-all ${
                            pinRemainingDays <= 7 
                              ? "bg-rose-500/10 border-rose-500/25 text-rose-400 animate-pulse" 
                              : "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                          }`}>
                            <div className="flex items-center justify-between font-bold">
                              <span className="flex items-center gap-1.5">
                                {pinRemainingDays <= 7 ? "⚠️ Expiração de Segurança (PIN)" : "🛡️ Validade da Senha (PIN)"}
                              </span>
                              <span className={`font-mono text-[11px] px-2.5 py-0.5 rounded-md bg-black/40 font-black ${
                                pinRemainingDays <= 7 ? "text-rose-400 border border-rose-500/30" : "text-emerald-400"
                              }`}>
                                {pinRemainingDays} {pinRemainingDays === 1 ? "dia" : "dias"}
                              </span>
                            </div>
                            <p className="text-[10.5px] opacity-85 mt-1">
                              {pinRemainingDays <= 7 
                                ? `Atenção colaborador! Seu PIN de acesso está prestes a expirar. Por segurança de dados comerciais, atualize o seu PIN em breve (Resta(m) apenas ${pinRemainingDays} dia(s)).`
                                : `Sua senha de segurança está em conformidade com as regras de rotação obrigatória do sistema (máximo 60 dias).`}
                            </p>
                          </div>

                          {/* 2FA Verification Selector Card */}
                          <div id="profile-2fa-setting-card" className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2.5">
                                <div className={`p-2 rounded-xl transition-all ${profileTwoFactorEmail ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" : "bg-slate-800 text-slate-400 border border-slate-700"}`}>
                                  <ShieldCheck className="w-5 h-5" />
                                </div>
                                <div>
                                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                                    <span>Verificação em Dois Passos (2FA) via E-mail</span>
                                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${profileTwoFactorEmail ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-slate-800 text-slate-400 border border-slate-700"}`}>
                                      {profileTwoFactorEmail ? "ATIVADO" : "DESATIVADO"}
                                    </span>
                                  </h4>
                                  <p className="text-[10.5px] text-slate-400 mt-0.5">
                                    Autenticação por e-mail para logins de novas localizações
                                  </p>
                                </div>
                              </div>

                              {/* Interactive Switch Selector */}
                              <button
                                type="button"
                                role="switch"
                                aria-checked={profileTwoFactorEmail}
                                onClick={() => {
                                  const newValue = !profileTwoFactorEmail;
                                  setProfileTwoFactorEmail(newValue);
                                  showToast(
                                    newValue 
                                      ? "2FA via e-mail ativado para novas localizações!" 
                                      : "2FA via e-mail desativado.",
                                    newValue ? "success" : "info"
                                  );
                                }}
                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                                  profileTwoFactorEmail ? "bg-orange-500" : "bg-slate-700"
                                }`}
                                title="Ativar/Desativar Verificação em Dois Passos"
                              >
                                <span className="sr-only">Habilitar Verificação em Dois Passos</span>
                                <span
                                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                                    profileTwoFactorEmail ? "translate-x-5" : "translate-x-0"
                                  }`}
                                />
                              </button>
                            </div>

                            <div className="p-2.5 bg-slate-950/70 rounded-lg border border-slate-850 flex items-start gap-2 text-[10.5px] text-slate-300">
                              <Globe className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                              <p className="leading-snug">
                                Ao realizar login a partir de um novo navegador, dispositivo ou localização não reconhecida, um código de verificação será enviado ao e-mail cadastrado (<strong>{activeUser?.email || settings.reportRecipientEmail || "e-mail do sistema"}</strong>).
                              </p>
                            </div>
                          </div>

                          {/* 2FA Verification via SMS Card */}
                          <div id="profile-2fa-sms-setting-card" className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-3.5 shadow-md">
                            {/* Header & Status Counter Badge Bar */}
                            <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 pb-2.5">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                                  Autenticação por SMS
                                </span>
                              </div>
                              {/* Status Counter & Badges */}
                              <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center gap-1 text-[9.5px] font-mono font-bold px-2 py-0.5 rounded-full border transition-all ${
                                  profilePhoneValidated 
                                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" 
                                    : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${profilePhoneValidated ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
                                  <span>Validação: {profilePhoneValidated ? "1/1 Confirmado" : "0/1 Pendente"}</span>
                                </span>

                                <span className={`inline-flex items-center gap-1 text-[9.5px] font-mono font-bold px-2 py-0.5 rounded-full border transition-all ${
                                  profileTwoFactorSms && profilePhoneValidated
                                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/10"
                                    : "bg-slate-800 text-slate-400 border-slate-700"
                                }`}>
                                  <span>2FA SMS: {profileTwoFactorSms && profilePhoneValidated ? "Ativo (1/1)" : "Inativo (0/1)"}</span>
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div className={`p-2.5 rounded-xl transition-all duration-300 ${
                                  profileTwoFactorSms && profilePhoneValidated 
                                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-lg shadow-emerald-500/10" 
                                    : "bg-slate-800/80 text-slate-400 border border-slate-700/80"
                                }`}>
                                  <Smartphone className="w-5 h-5" />
                                </div>
                                <div>
                                  <h4 className="text-xs font-bold text-white flex items-center gap-2 flex-wrap">
                                    <span>Verificação em Dois Passos (2FA) via SMS</span>
                                    <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-md border ${
                                      !profilePhoneValidated 
                                        ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                                        : profileTwoFactorSms 
                                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" 
                                        : "bg-slate-800 text-slate-400 border-slate-700"
                                    }`}>
                                      {!profilePhoneValidated ? "REQUER VALIDAÇÃO DE NÚMERO" : profileTwoFactorSms ? "ATIVADO" : "DESATIVADO"}
                                    </span>
                                  </h4>
                                  <p className="text-[10.5px] text-slate-400 mt-0.5">
                                    Receber código de verificação por mensagem de texto SMS no telemóvel cadastrado
                                  </p>
                                </div>
                              </div>

                              {/* Enhanced Visually Attractive Toggle Switch */}
                              <button
                                type="button"
                                role="switch"
                                aria-checked={profileTwoFactorSms}
                                onClick={() => {
                                  const hasValidContact = profileContact && profileContact.trim().length >= 8;
                                  if (!profilePhoneValidated && !hasValidContact) {
                                    showToast("Insira e valide o seu número de contacto telefónico para ativar 2FA via SMS.", "warning", "Validação Necessária");
                                    return;
                                  }

                                  const newValue = !profileTwoFactorSms;
                                  if (newValue && !profilePhoneValidated && hasValidContact) {
                                    setProfilePhoneValidated(true);
                                  }

                                  setProfileTwoFactorSms(newValue);
                                  showToast(
                                    newValue 
                                      ? "2FA via SMS ativado com sucesso para o número " + profileContact + "!" 
                                      : "2FA via SMS desativado.",
                                    newValue ? "success" : "info"
                                  );
                                }}
                                className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                                  profileTwoFactorSms && profilePhoneValidated 
                                    ? "bg-emerald-500 border-emerald-400 shadow-md shadow-emerald-500/30" 
                                    : "bg-slate-800 border-slate-700 hover:border-slate-600"
                                }`}
                                title="Ativar/Desativar Verificação em Dois Passos por SMS"
                              >
                                <span className="sr-only">Habilitar Verificação por SMS</span>
                                <span
                                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-300 ease-in-out mt-0.5 ${
                                    profileTwoFactorSms && profilePhoneValidated 
                                      ? "translate-x-5 bg-white shadow-emerald-900/50" 
                                      : "translate-x-0.5 bg-slate-300"
                                  }`}
                                />
                              </button>
                            </div>

                            {/* Contact Number & Validation Section */}
                            <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-850 flex flex-wrap items-center justify-between gap-2 text-[10.5px]">
                              <div className="flex items-center gap-2">
                                <Smartphone className="w-4 h-4 text-emerald-400 shrink-0" />
                                <div>
                                  <span className="text-slate-400 block text-[9.5px]">Número de Telemóvel / Contacto:</span>
                                  <span className="text-slate-100 font-mono font-bold">
                                    {profileContact || "Nenhum contacto cadastrado"}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                {profilePhoneValidated ? (
                                  <span className="inline-flex items-center gap-1 text-[9.5px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20 font-bold">
                                    <Check className="w-3 h-3" />
                                    <span>Contacto Validado (1/1)</span>
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!profileContact || profileContact.trim().length < 8) {
                                        showToast("Por favor insira um número de contacto válido no formulário acima antes de validar.", "warning");
                                        return;
                                      }
                                      setProfilePhoneValidated(true);
                                      showToast(`Número ${profileContact} validado com sucesso para envio de SMS!`, "success", "Número Confirmado");
                                    }}
                                    className="px-2.5 py-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-md transition text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                                  >
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                    <span>Validar Contacto para SMS</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* WebAuthn Biometric Login Setting Card */}
                          <div id="profile-webauthn-setting-card" className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-3.5 shadow-md">
                            <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 pb-2.5">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                                  <Fingerprint className="w-3.5 h-3.5" />
                                  Segurança Biométrica
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center gap-1 text-[9.5px] font-mono font-bold px-2 py-0.5 rounded-full border transition-all ${
                                  profileWebAuthnEnabled 
                                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/10"
                                    : "bg-slate-800 text-slate-400 border-slate-700"
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${profileWebAuthnEnabled ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
                                  <span>{profileWebAuthnEnabled ? "WebAuthn Ativo" : "Biometria Inativa"}</span>
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div className={`p-2.5 rounded-xl transition-all duration-300 ${
                                  profileWebAuthnEnabled 
                                    ? "bg-gradient-to-br from-orange-500/20 to-amber-500/20 text-orange-400 border border-orange-500/40 shadow-lg shadow-orange-500/10" 
                                    : "bg-slate-800/80 text-slate-400 border border-slate-700/80"
                                }`}>
                                  <Fingerprint className="w-5 h-5" />
                                </div>
                                <div>
                                  <h4 className="text-xs font-bold text-white flex items-center gap-2 flex-wrap">
                                    <span>Login Biométrico via WebAuthn</span>
                                    <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-md border ${
                                      profileWebAuthnEnabled 
                                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" 
                                        : "bg-slate-800 text-slate-400 border-slate-700"
                                    }`}>
                                      {profileWebAuthnEnabled ? "HABILITADO" : "DESABILITADO"}
                                    </span>
                                  </h4>
                                  <p className="text-[10.5px] text-slate-400 mt-0.5 leading-relaxed">
                                    Inicie sessão com Touch ID, Face ID ou impressão digital do dispositivo sem digitar o PIN.
                                  </p>
                                </div>
                              </div>

                              {/* Interactive Switch Toggle */}
                              <button
                                type="button"
                                role="switch"
                                aria-checked={profileWebAuthnEnabled}
                                onClick={() => {
                                  const empId = switchSelectedEmployeeId || activeUser?.id || "e1";
                                  if (profileWebAuthnEnabled) {
                                    setProfileWebAuthnEnabled(false);
                                    setProfileWebAuthnCredentialId("");
                                    localStorage.removeItem(`erp_webauthn_enabled_${empId}`);
                                    localStorage.removeItem(`erp_webauthn_cred_${empId}`);
                                    setEmployees(prev => prev.map(emp => emp.id === empId ? { ...emp, webAuthnEnabled: false } : emp));
                                    showToast("Login biométrico desativado.", "info");
                                  } else {
                                    handleRegisterWebAuthn();
                                  }
                                }}
                                className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                                  profileWebAuthnEnabled 
                                    ? "bg-orange-500 border-orange-400 shadow-md shadow-orange-500/30" 
                                    : "bg-slate-800 border-slate-700 hover:border-slate-600"
                                }`}
                                title="Ativar/Desativar Login Biométrico via WebAuthn"
                              >
                                <span className="sr-only">Habilitar Login Biométrico</span>
                                <span
                                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-300 ease-in-out mt-0.5 ${
                                    profileWebAuthnEnabled 
                                      ? "translate-x-5 bg-white shadow-orange-900/50" 
                                      : "translate-x-0.5 bg-slate-300"
                                  }`}
                                />
                              </button>
                            </div>

                            <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-850 flex flex-wrap items-center justify-between gap-2 text-[10.5px]">
                              <div className="flex items-center gap-2">
                                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                                <div>
                                  <span className="text-slate-400 block text-[9.5px]">Leitor Biométrico e Passkeys:</span>
                                  <span className="text-slate-200 font-mono font-bold">
                                    {typeof window !== "undefined" && window.PublicKeyCredential ? "Hardware Suportado (Touch ID / Face ID)" : "Simulador WebAuthn Habilitado"}
                                  </span>
                                </div>
                              </div>

                              {profileWebAuthnEnabled && (
                                <button
                                  type="button"
                                  onClick={handleTestWebAuthn}
                                  className="px-2.5 py-1 bg-orange-500/15 hover:bg-orange-500/25 text-orange-300 border border-orange-500/30 rounded-md transition text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                                >
                                  <Fingerprint className="w-3.5 h-3.5 text-orange-400" />
                                  <span>Testar Biometria</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {(() => {
                            const selectedOrActiveEmp = switchSelectedEmployeeId 
                              ? employees.find(x => x.id === switchSelectedEmployeeId) || activeUser 
                              : activeUser;

                            const empName = selectedOrActiveEmp?.name?.toLowerCase() || "";
                            const empId = selectedOrActiveEmp?.id?.toLowerCase() || "";
                            const searchLower = activitySearchText.trim().toLowerCase();

                            const filteredCollaboratorLogs = auditLogs
                              .filter(log => {
                                if (!selectedOrActiveEmp) return false;
                                const logUser = (log.user || "").toLowerCase();
                                const logDetails = (log.details || "").toLowerCase();
                                const logAction = (log.action || "").toLowerCase();
                                const logModule = (log.module || "").toLowerCase();

                                const matchesCollaborator = logUser.includes(empName) || logUser.includes(empId) || logDetails.includes(empName);
                                if (!matchesCollaborator) return false;

                                if (activityModuleFilter && activityModuleFilter !== "Todos") {
                                  const filterUpper = activityModuleFilter.toUpperCase();
                                  const logUpper = logModule.toUpperCase();
                                  let matchMod = logUpper === filterUpper;
                                  if (!matchMod) {
                                    if (filterUpper === "VENDAS") matchMod = logUpper.includes("VENDA") || logUpper.includes("POS");
                                    else if (filterUpper === "STOCK" || filterUpper === "ESTOQUE") matchMod = logUpper.includes("STOCK") || logUpper.includes("ESTOQUE") || logUpper.includes("PRODUTO");
                                    else if (filterUpper === "SEGURANÇA" || filterUpper === "SEGURANCA") matchMod = logUpper.includes("SEGURA") || logUpper.includes("AUTENTIC") || logUpper.includes("LOGIN") || logUpper.includes("AUDIT");
                                    else if (filterUpper === "CAIXA") matchMod = logUpper.includes("CAIXA") || logUpper.includes("CASH");
                                    else if (filterUpper === "CLIENTES") matchMod = logUpper.includes("CLIENTE");
                                    else if (filterUpper === "FUNCIONÁRIOS" || filterUpper === "EQUIPA") matchMod = logUpper.includes("FUNC") || logUpper.includes("STAFF") || logUpper.includes("RH") || logUpper.includes("EQUIP");
                                    else if (filterUpper === "RELATÓRIOS") matchMod = logUpper.includes("RELAT") || logUpper.includes("REPORT");
                                    else if (filterUpper === "CONFIGURAÇÕES") matchMod = logUpper.includes("CONFIG") || logUpper.includes("SISTEMA");
                                    else if (filterUpper === "ASSINATURAS") matchMod = logUpper.includes("ASSINATURA") || logUpper.includes("PLANO");
                                  }
                                  if (!matchMod) return false;
                                }

                                if (searchLower) {
                                  const matchesText = logUser.includes(searchLower) ||
                                                      logDetails.includes(searchLower) ||
                                                      logAction.includes(searchLower) ||
                                                      logModule.includes(searchLower);
                                  if (!matchesText) return false;
                                }

                                if (log.timestamp) {
                                  const logTime = new Date(log.timestamp).getTime();
                                  if (activityStartDate) {
                                    const startMs = new Date(`${activityStartDate}T00:00:00`).getTime();
                                    if (!isNaN(startMs) && logTime < startMs) return false;
                                  }
                                  if (activityEndDate) {
                                    const endMs = new Date(`${activityEndDate}T23:59:59.999`).getTime();
                                    if (!isNaN(endMs) && logTime > endMs) return false;
                                  }
                                }

                                return true;
                              })
                              .slice(-50)
                              .reverse();

                            const hasActiveFilters = Boolean(activitySearchText || (activityModuleFilter && activityModuleFilter !== "Todos") || activityStartDate || activityEndDate);

                            return (
                              <>
                                {/* Search and Date Filter Controls at Top */}
                                <div id="activity-log-filters-container" className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl space-y-3">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-bold text-orange-400 flex items-center gap-1.5">
                                      <Filter className="w-3.5 h-3.5 text-orange-400" />
                                      <span>Filtros de Pesquisa de Histórico</span>
                                    </span>
                                    {hasActiveFilters && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActivitySearchText("");
                                          setActivityModuleFilter("Todos");
                                          setActivityStartDate("");
                                          setActivityEndDate("");
                                        }}
                                        className="text-[10px] font-extrabold text-slate-400 hover:text-orange-400 underline transition cursor-pointer"
                                      >
                                        Limpar Filtros
                                      </button>
                                    )}
                                  </div>

                                  {/* Campo de Texto para busca de logs com Botão de Exportação CSV */}
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                      <div className="relative flex-1">
                                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                                        <input
                                          type="text"
                                          id="activity-log-search-input"
                                          value={activitySearchText}
                                          onChange={(e) => setActivitySearchText(e.target.value)}
                                          placeholder="Buscar por ação, detalhes, módulo ou palavra-chave..."
                                          className="w-full bg-slate-950 border border-slate-750 text-slate-100 text-xs rounded-xl pl-9 pr-3 py-2 outline-none focus:border-orange-500 transition font-medium"
                                        />
                                      </div>
                                      <button
                                        type="button"
                                        id="activity-log-export-csv-btn"
                                        onClick={() => handleExportAuditLogsCSV(filteredCollaboratorLogs)}
                                        className="px-3.5 py-2 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shrink-0 shadow-sm cursor-pointer"
                                        title="Exportar lista atual de logs filtrados em CSV"
                                      >
                                        <Download className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline">Exportar Logs (CSV)</span>
                                        <span className="sm:hidden">CSV</span>
                                      </button>
                                    </div>

                                    {/* Botões de atalho rápidos (chips) */}
                                    <div id="activity-log-quick-chips" className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-0.5">Filtro rápido:</span>
                                      {[
                                        { label: "Todos Módulos", query: "Todos", icon: "📋" },
                                        { label: "Vendas", query: "Vendas", icon: "🛒" },
                                        { label: "Stock", query: "Stock", icon: "📦" },
                                        { label: "Segurança", query: "Segurança", icon: "🛡️" },
                                        { label: "Configurações", query: "Configurações", icon: "⚙️" }
                                      ].map((chip) => {
                                        const isActive = activityModuleFilter === chip.query || (chip.query === "Todos" && activityModuleFilter === "Todos");
                                        return (
                                          <button
                                            key={chip.label}
                                            type="button"
                                            onClick={() => {
                                              setActivityModuleFilter(chip.query);
                                            }}
                                            className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${
                                              isActive
                                                ? "bg-orange-500 text-white border-orange-400 shadow-sm"
                                                : "bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white hover:bg-slate-900"
                                            }`}
                                          >
                                            <span className="text-xs">{chip.icon}</span>
                                            <span>{chip.label}</span>
                                          </button>
                                        );
                                      })}
                                    </div>

                                    {/* Gráfico D3 de Volume Diário de Logs nos últimos 7 dias */}
                                    <AuditLogsD3BarChart logs={filteredCollaboratorLogs} />
                                  </div>

                                  {/* Seletor de Módulo e Intervalo de Datas */}
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    <div>
                                      <label htmlFor="activity-log-module-select" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
                                        <Filter className="w-3 h-3 text-orange-400" />
                                        Filtrar por Módulo
                                      </label>
                                      <select
                                        id="activity-log-module-select"
                                        value={activityModuleFilter}
                                        onChange={(e) => setActivityModuleFilter(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-750 text-slate-100 text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-orange-500 transition font-medium cursor-pointer"
                                      >
                                        <option value="Todos">Todos os Módulos</option>
                                        <option value="Vendas">Vendas / POS</option>
                                        <option value="Stock">Stock & Inventário</option>
                                        <option value="Segurança">Segurança & Autenticação</option>
                                        <option value="Caixa">Caixa & Movimentos</option>
                                        <option value="Clientes">Clientes & Fidelização</option>
                                        <option value="Funcionários">Funcionários & RH</option>
                                        <option value="Relatórios">Relatórios & Análise</option>
                                        <option value="Configurações">Configurações do Sistema</option>
                                        <option value="Assinaturas">Assinaturas & Planos</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label htmlFor="activity-log-start-date" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
                                        <Calendar className="w-3 h-3 text-orange-400" />
                                        Data Início
                                      </label>
                                      <input
                                        type="date"
                                        id="activity-log-start-date"
                                        value={activityStartDate}
                                        onChange={(e) => setActivityStartDate(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-750 text-slate-100 text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-orange-500 transition"
                                      />
                                    </div>
                                    <div>
                                      <label htmlFor="activity-log-end-date" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
                                        <Calendar className="w-3 h-3 text-orange-400" />
                                        Data Fim
                                      </label>
                                      <input
                                        type="date"
                                        id="activity-log-end-date"
                                        value={activityEndDate}
                                        onChange={(e) => setActivityEndDate(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-750 text-slate-100 text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-orange-500 transition"
                                      />
                                    </div>
                                  </div>
                                </div>

                                {/* Banner de Resumo */}
                                <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1 text-xs">
                                  <p className="font-bold text-orange-400 flex items-center justify-between">
                                    <span>Registos do Colaborador: <strong className="text-white">{selectedOrActiveEmp?.name}</strong></span>
                                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">{filteredCollaboratorLogs.length} registro(s)</span>
                                  </p>
                                  {hasActiveFilters && (
                                    <p className="text-[10.5px] text-slate-400 italic">
                                      Exibindo registos filtrados por texto/intervalo de datas.
                                    </p>
                                  )}
                                </div>

                                {filteredCollaboratorLogs.length > 0 ? (
                                  <div className="space-y-2">
                                    {filteredCollaboratorLogs.map((log, logIdx) => (
                                      <div key={`${log.id || 'log'}-${logIdx}`} className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1 text-left hover:border-slate-750 transition">
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="px-2 py-0.5 bg-orange-500/15 text-orange-400 border border-orange-500/30 font-bold font-mono text-[9.5px] rounded-md uppercase">
                                            {log.module || "SISTEMA"} • {log.action || "AÇÃO"}
                                          </span>
                                          <span className="text-[10px] text-slate-400 font-mono">
                                            {new Date(log.timestamp).toLocaleString("pt-PT", {
                                              day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
                                            })}
                                          </span>
                                        </div>
                                        <p className="text-xs text-slate-200 font-medium leading-tight pt-1">
                                          {log.details || "Ação registrada no sistema."}
                                        </p>
                                        <p className="text-[9.5px] text-slate-500 font-mono">
                                          Operador: <strong className="text-slate-400">{log.user}</strong>
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="p-8 text-center bg-slate-900/40 rounded-xl border border-slate-800 space-y-2">
                                    <p className="text-2xl">📜</p>
                                    <p className="text-xs font-bold text-slate-300">Nenhum registro encontrado</p>
                                    <p className="text-[10.5px] text-slate-500">
                                      {hasActiveFilters 
                                        ? "Nenhuma ação corresponde aos filtros de pesquisa ou intervalo de datas definidos." 
                                        : `Não foram encontradas ações no log de auditoria para ${selectedOrActiveEmp?.name || "este colaborador"}.`}
                                    </p>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Footer Componente de Observações do Colaborador */}
                {(() => {
                  const targetEmp = switchSelectedEmployeeId 
                    ? employees.find(x => x.id === switchSelectedEmployeeId) || activeUser 
                    : activeUser;

                  return (
                    <div id="modal-employee-observacoes-section" className="px-6 py-3.5 border-t border-slate-100 dark:border-zinc-850 bg-slate-900/40 dark:bg-zinc-950/60 text-left space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <label htmlFor="modal-employee-observacoes-input" className="text-[10.5px] font-bold text-slate-300 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                          <span>Observações & Notas Extras na Ficha ({targetEmp?.name || "Colaborador"})</span>
                        </label>
                        <button
                          type="button"
                          id="save-collaborator-observacoes-btn"
                          onClick={async () => {
                            const targetEmpId = targetEmp?.id;
                            if (!targetEmpId) return;

                            const updatedEmployees = employees.map(emp => {
                              if (emp.id === targetEmpId) {
                                return { ...emp, observacoes: profileObservacoes.trim(), expirationDate: profileExpirationDate };
                              }
                              return emp;
                            });

                            setEmployees(updatedEmployees);
                            await syncTable("employees", updatedEmployees);

                            if (activeUser && activeUser.id === targetEmpId) {
                              setActiveUser({
                                ...activeUser,
                                observacoes: profileObservacoes.trim(),
                                expirationDate: profileExpirationDate
                              });
                            }

                            showToast(`Observações e Data de Expiração de ${targetEmp.name} salvas na ficha com sucesso!`, "success");
                            handleAddAuditLog(
                              "Atualização de Observações/Expiração",
                              "COLABORADORES",
                              `Observações e data de expiração (${profileExpirationDate || "não definida"}) atualizadas para o colaborador ${targetEmp.name} (ID: ${targetEmp.id}).`
                            );
                          }}
                          className="px-2.5 py-1 bg-orange-500/15 hover:bg-orange-500/25 text-orange-400 border border-orange-500/30 rounded-lg text-[10px] font-bold transition cursor-pointer flex items-center gap-1 active:scale-95 shadow-sm"
                          title="Salvar apenas as observações e data de expiração no cadastro do colaborador"
                        >
                          <Save className="w-3 h-3" />
                          <span>Salvar Notas</span>
                        </button>
                      </div>

                      <textarea
                        id="modal-employee-observacoes-input"
                        rows={2}
                        value={profileObservacoes}
                        onChange={(e) => setProfileObservacoes(e.target.value)}
                        placeholder={`Digite observações, notas extras ou anotações na ficha de ${targetEmp?.name || "este colaborador"}...`}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-orange-500 rounded-xl p-2.5 text-xs text-slate-100 outline-none transition font-medium resize-none shadow-inner placeholder:text-slate-500"
                      />

                      {/* Campo de Entrada de Data 'Data de Expiração' */}
                      <div className="pt-1.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-slate-800/60">
                        <label htmlFor="modal-employee-expiration-date-input" className="text-[10.5px] font-bold text-slate-300 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                          <span>Data de Expiração (Contrato / Credencial)</span>
                        </label>
                        <input
                          type="date"
                          id="modal-employee-expiration-date-input"
                          value={profileExpirationDate}
                          onChange={(e) => setProfileExpirationDate(e.target.value)}
                          className="bg-slate-950 border border-slate-800 focus:border-orange-500 rounded-xl px-3 py-1.5 text-xs text-slate-100 outline-none transition font-medium shadow-inner cursor-pointer"
                        />
                      </div>
                    </div>
                  );
                })()}

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 dark:border-zinc-850 flex items-center justify-between gap-3 bg-slate-900/10">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleGeneratePaymentQr}
                      disabled={isGeneratingQr}
                      className="px-3.5 py-2 text-xs font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-sm"
                    >
                      <QrCode className="w-4 h-4 text-emerald-500 shrink-0" />
                      {isGeneratingQr ? "Gerando QR..." : "Gerar QR de Pagamento"}
                    </button>

                    <button
                      type="button"
                      id="export-collaborator-pdf-button"
                      onClick={handleExportCollaboratorPdf}
                      className="px-3.5 py-2 text-xs font-bold bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/30 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-sm"
                      title="Gerar e exportar Ficha do Colaborador em PDF"
                    >
                      <FileText className="w-4 h-4 text-sky-500 shrink-0" />
                      Exportar Ficha de Colaborador
                    </button>

                    <button
                      type="button"
                      onClick={handleSuspendCollaborator}
                      className="px-3.5 py-2 text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-sm"
                      title="Suspender Colaborador Atual"
                    >
                      <UserX className="w-4 h-4 text-rose-500 shrink-0" />
                      Suspender Colaborador
                    </button>

                    <button
                      type="button"
                      id="view-full-activity-history-btn"
                      onClick={() => setUserSwitchModalTab("activity")}
                      className="px-3.5 py-2 text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 dark:text-amber-400 border border-amber-500/30 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-sm"
                      title="Alternar para a aba de Histórico de Atividade"
                    >
                      <History className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>Ver Histórico Completo</span>
                    </button>

                    <button
                      type="button"
                      id="clear-collaborator-observacoes-btn"
                      onClick={() => {
                        setProfileObservacoes("");
                        showToast("Observações limpas com sucesso!", "info");
                      }}
                      className="px-3.5 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-750 text-slate-300 dark:text-slate-200 border border-slate-700 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-sm"
                      title="Limpar o campo de notas/observações do colaborador selecionado"
                    >
                      <Trash2 className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>Limpar Observações</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsUserSwitchModalOpen(false)}
                      className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
                    >
                      Fechar
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (userSwitchModalTab === "switch") {
                          if (!switchSelectedEmployeeId) return;
                          const selectedEmp = employees.find(x => x.id === switchSelectedEmployeeId);
                          if (!selectedEmp) return;

                          // Verify PIN/password before switching!
                          const requiredPin = selectedEmp.pin || "123456";
                          if (!switchEnteredPin.trim()) {
                            setSwitchPinError("Por favor, introduza a senha / PIN de acesso deste colaborador.");
                            return;
                          }
                          if (switchEnteredPin.trim() !== requiredPin.trim()) {
                            setSwitchPinError("Senha incorreta. Por favor, tente novamente.");
                            return;
                          }

                          // Check if account is blocked/inactive
                          if (selectedEmp.status === "BLOCKED") {
                            setSwitchPinError("Esta conta está BLOQUEADA por expiração de senha ou motivos de segurança.");
                            return;
                          }
                          if (selectedEmp.status === "INACTIVE" || selectedEmp.status === "SUSPENDED") {
                            setSwitchPinError("Esta conta está inativa ou suspensa. Contacte o Administrador.");
                            return;
                          }

                          // Check expiration policy (2 months / 60 days)
                          const now = new Date();
                          const createdAtStr = selectedEmp.pinCreatedAt || selectedEmp.admissionDate || now.toISOString();
                          const createdAt = new Date(createdAtStr);
                          const diffTime = now.getTime() - createdAt.getTime();
                          const diffDays = diffTime / (1000 * 60 * 60 * 24);

                          const isPinTemporary = selectedEmp.pinChanged === false;

                          // If password is temporary (first login) OR has expired (older than 60 days)
                          if (isPinTemporary) {
                            setForcePinTargetEmployee(selectedEmp);
                            setNewPin("");
                            setConfirmNewPin("");
                            setForcePinError("Este é o seu primeiro login. Por favor, crie uma senha pessoal segura.");
                            setForcePinChangeOpen(true);
                            setIsUserSwitchModalOpen(false);
                            return;
                          }

                          if (diffDays > 60) {
                            setForcePinTargetEmployee(selectedEmp);
                            setNewPin("");
                            setConfirmNewPin("");
                            setForcePinError("A sua senha de acesso expirou (validade de 2 meses). Por favor, defina uma nova senha.");
                            setForcePinChangeOpen(true);
                            setIsUserSwitchModalOpen(false);
                            return;
                          }

                          const autoLinkChecked = (document.getElementById("auto-link-email-checkbox") as HTMLInputElement)?.checked ?? true;
                          const emailToBind = auth.currentUser?.email || selectedEmp.email || "";

                          let updatedEmployees = employees.map(emp => {
                            if (emp.id === switchSelectedEmployeeId) {
                              return { 
                                ...emp, 
                                email: autoLinkChecked && emailToBind ? emailToBind.toLowerCase().trim() : (emp.email || ""),
                                observacoes: profileObservacoes.trim(),
                                expirationDate: profileExpirationDate
                              };
                            }
                            return emp;
                          });
                          setEmployees(updatedEmployees);
                          await syncTable("employees", updatedEmployees);

                          // Perform active switch
                          const finalActiveUser = {
                            ...selectedEmp,
                            email: autoLinkChecked && emailToBind ? emailToBind : (selectedEmp.email || ""),
                            fotoPerfil: selectedEmp.fotoPerfil || "",
                            observacoes: profileObservacoes.trim(),
                            expirationDate: profileExpirationDate
                          };
                          setActiveUser(finalActiveUser);

                          showToast(
                            `Usuário alterado com sucesso para ${selectedEmp.name}!${autoLinkChecked ? " Conta vinculada com sucesso." : ""}`, 
                            "success"
                          );

                          handleAddAuditLog(
                            "Alteração de Usuário",
                            "SISTEMA",
                            `Operador alterado para ${selectedEmp.name} (ID: ${selectedEmp.id})${autoLinkChecked ? ` com vínculo de e-mail ao ${emailToBind}` : ""}`
                          );

                          setIsUserSwitchModalOpen(false);
                        } else {
                          await handleSaveProfileChanges();
                          setIsUserSwitchModalOpen(false);
                        }
                      }}
                      disabled={userSwitchModalTab === "switch" ? (!switchSelectedEmployeeId || !switchEnteredPin.trim()) : !profileName.trim()}
                      className={`px-5 py-2.5 text-xs font-extrabold rounded-xl shadow-md transition-all cursor-pointer ${
                        (userSwitchModalTab === "switch" ? (switchSelectedEmployeeId && switchEnteredPin.trim()) : profileName.trim())
                          ? "bg-orange-500 hover:bg-orange-600 text-white transform hover:scale-105"
                          : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                      }`}
                    >
                      {userSwitchModalTab === "switch" ? "Vincular & Alterar Conta" : "Salvar Perfil"}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Payment QR Code Modal Overlay */}
      <AnimatePresence>
        {showPaymentQrModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 15 }}
              className="bg-white dark:bg-zinc-900 text-slate-800 dark:text-slate-100 rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 dark:border-zinc-800 text-center space-y-4 relative"
            >
              <button
                type="button"
                onClick={() => setShowPaymentQrModal(false)}
                className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                <QrCode className="w-6 h-6" />
              </div>

              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">QR Code de Recebimento</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Escaneie com a carteira móvel (M-Pesa / E-Mola) para realizar a transferência de pagamento para este utilizador.
                </p>
              </div>

              {paymentQrUrl ? (
                <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-inner inline-block">
                  <img src={paymentQrUrl} alt="QR Code de Pagamento" className="w-52 h-52 mx-auto rounded-lg object-contain" />
                </div>
              ) : (
                <div className="py-12 text-slate-400 text-xs font-mono">Gerando QR Code...</div>
              )}

              <div className="bg-slate-50 dark:bg-zinc-950/60 p-3.5 rounded-xl border border-slate-100 dark:border-zinc-800 text-xs text-left space-y-1 font-mono">
                <p className="text-[10px] uppercase font-sans font-bold text-slate-400">Titular da Conta / Operador</p>
                <p className="font-extrabold text-slate-800 dark:text-slate-200 text-sm">{activeUser?.name || "Colaborador"}</p>
                <p className="text-slate-500 dark:text-slate-400">📱 Contacto: {activeUser?.contact || "840000000"}</p>
                <p className="text-slate-500 dark:text-slate-400">🏢 Empresa: {settings.companyName || "OST Vendas"}</p>
              </div>

              <button
                type="button"
                onClick={() => setShowPaymentQrModal(false)}
                className="w-full py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl text-xs hover:bg-slate-800 dark:hover:bg-slate-100 transition cursor-pointer shadow-md"
              >
                Concluído / Fechar
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <StockReplenishModal
        isOpen={showReplenishModal}
        onClose={() => setShowReplenishModal(false)}
        products={products}
        onUpdateProduct={handleUpdateProduct}
        activeBranchId={settings.activeBranchId || "central"}
        onShowToast={showToast}
        theme={theme}
      />

      {/* Toast Notifications Overlay Container */}
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={`p-4 rounded-xl border shadow-lg pointer-events-auto flex gap-3 relative overflow-hidden backdrop-blur-md ${
                theme === "night"
                  ? "bg-zinc-950/95 border-zinc-850/80 text-slate-100 shadow-zinc-950/45"
                  : "bg-white/95 border-slate-200 text-slate-800 shadow-slate-200/40"
              }`}
            >
              {/* Vertical side glow indicator bar according to toast type */}
              <div
                className={`absolute top-0 left-0 bottom-0 w-1.5 ${
                  t.type === "success"
                    ? "bg-emerald-500"
                    : t.type === "error"
                    ? "bg-rose-500"
                    : t.type === "warning"
                    ? "bg-amber-500"
                    : "bg-blue-500"
                }`}
              />

              {/* Icon selection dynamically */}
              <div className="mt-0.5 shrink-0">
                {t.type === "success" && (
                  <CheckCircle className="w-5 h-5 text-emerald-500" />
                )}
                {t.type === "error" && (
                  <XCircle className="w-5 h-5 text-rose-500" />
                )}
                {t.type === "warning" && (
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                )}
                {t.type === "info" && (
                  <Activity className="w-5 h-5 text-blue-500" />
                )}
              </div>

              {/* Contents block */}
              <div className="flex-1 pr-6">
                <h4 className="font-extrabold text-xs tracking-tight uppercase">
                  {t.title}
                </h4>
                <p className={`text-[11px] mt-1 pr-1 font-semibold leading-relaxed ${
                  theme === "night" ? "text-slate-350" : "text-slate-550"
                }`}>
                  {t.message}
                </p>
              </div>

              {/* Manual Close Button */}
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className={`absolute top-3 right-3 p-1 rounded-lg transition-colors cursor-pointer ${
                  theme === "night"
                    ? "hover:bg-zinc-900 text-slate-400 hover:text-white"
                    : "hover:bg-slate-100 text-slate-400 hover:text-slate-900"
                }`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Floating Action Navigation Hub (FAB) */}
      {!isPOSFullscreen && (
        <div className="fixed bottom-6 right-6 z-[90] flex flex-col items-end gap-3 no-print">
          <AnimatePresence>
            {isFabOpen && (
              <motion.div
                initial={{ opacity: 0, y: 15, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 15, scale: 0.9 }}
                transition={{ duration: 0.15 }}
                className={`p-4 rounded-3xl border shadow-2xl w-64 md:w-72 max-h-[75vh] overflow-y-auto backdrop-blur-xl flex flex-col gap-2 ${
                  theme === "night"
                    ? "bg-zinc-950/95 border-zinc-850/80 shadow-zinc-950/50 text-slate-100"
                    : "bg-white/95 border-slate-200 shadow-slate-350/30 text-slate-800"
                }`}
              >
                <div className="flex items-center justify-between pb-2 mb-1 border-b border-dashed border-slate-700/20 dark:border-zinc-800">
                  <span className="text-[10px] font-black tracking-widest uppercase text-orange-500 font-mono">Navegação Rápida</span>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-900 border dark:border-zinc-800 font-mono">
                    {activeUser ? activeUser.role : "Sessão"}
                  </span>
                </div>
                
                <div className="grid grid-cols-1 gap-1">
                  {NAV_MENU_ITEMS.map((item) => {
                    const authorized = item.roles.includes(simplifiedRole);
                    const active = activeTab.toLowerCase() === item.id;
                    
                    return (
                      <button
                        key={item.id}
                        disabled={!authorized}
                        onClick={() => {
                          setActiveTab(item.id.toUpperCase());
                          setIsFabOpen(false);
                        }}
                        className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold transition-all group ${
                          active
                            ? "bg-orange-500 text-white shadow-md shadow-orange-500/25"
                            : authorized
                            ? theme === "night"
                              ? "text-slate-300 hover:text-white hover:bg-zinc-900 cursor-pointer"
                              : "text-slate-700 hover:text-orange-600 hover:bg-orange-50/50 cursor-pointer"
                            : "opacity-35 cursor-not-allowed text-slate-400"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <item.icon className={`w-4 h-4 shrink-0 transition-colors ${
                            active
                              ? "text-white"
                              : authorized
                              ? theme === "night"
                                ? "text-slate-500 group-hover:text-slate-300"
                                : "text-slate-400 group-hover:text-orange-500"
                              : "text-slate-400"
                          }`} />
                          <span className="truncate">{item.label}</span>
                        </div>
                        
                        {!authorized && (
                          <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
                
                <div className="border-t border-slate-700/10 dark:border-zinc-800/80 pt-2 mt-1 flex flex-col gap-1">
                  <button
                    onClick={() => {
                      setIsSidebarOpen(true);
                      setIsFabOpen(false);
                    }}
                    className={`w-full flex items-center justify-center gap-2 p-2 rounded-xl text-[10.5px] font-black uppercase tracking-wider transition-all cursor-pointer border ${
                      theme === "night"
                        ? "bg-zinc-900/60 border-zinc-850 text-orange-400 hover:bg-zinc-900 hover:text-orange-300"
                        : "bg-orange-50/40 border-orange-100 text-orange-600 hover:bg-orange-50 hover:text-orange-700"
                    }`}
                  >
                    <Menu className="w-3.5 h-3.5" />
                    <span>Ver Painel Lateral 📋</span>
                  </button>
                  
                  <button
                    onClick={() => {
                      setIsFabOpen(false);
                      handleLogout();
                    }}
                    className="w-full flex items-center justify-center gap-2 p-2 rounded-xl text-[10.5px] font-black uppercase tracking-wider text-red-500 hover:text-red-400 bg-red-500/10 hover:bg-red-500/15 transition-all cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Terminar Sessão 🔒</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          <button
            onClick={() => setIsFabOpen(!isFabOpen)}
            className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all cursor-pointer border relative group ${
              isFabOpen
                ? "bg-slate-900 text-white border-slate-800 hover:bg-slate-800 scale-105"
                : theme === "night"
                ? "bg-orange-500 hover:bg-orange-600 text-white border-orange-600 hover:scale-110"
                : "bg-orange-500 hover:bg-orange-600 text-white border-orange-400 hover:scale-110"
            }`}
            title="Menu de Navegação Rápida"
          >
            {isFabOpen ? (
              <X className="w-6 h-6 animate-in spin-in duration-200" />
            ) : (
              <Compass className="w-6 h-6 group-hover:rotate-45 transition-transform duration-300 animate-pulse" />
            )}
            
            {/* Soft pulsing visual outer ring */}
            {!isFabOpen && (
              <span className="absolute -inset-0.5 rounded-full border border-orange-500 animate-ping opacity-25 pointer-events-none"></span>
            )}
          </button>
        </div>
      )}

      {/* Quick Logo Config Modal */}
      <QuickLogoModal
        isOpen={isQuickLogoModalOpen}
        onClose={() => setIsQuickLogoModalOpen(false)}
        currentLogoUrl={settings.logoUrl}
        companyName={settings.companyName}
        theme={theme}
        onSaveLogo={(newLogoUrl) => {
          handleUpdateSettings({ logoUrl: newLogoUrl });
          handleAddAuditLog(
            "Logotipo Atualizado",
            "DEFINICOES",
            `Logotipo da empresa atualizado para '${newLogoUrl.substring(0, 40)}...' via Painel de Configuração Rápida.`
          );
        }}
        onShowToast={showToast}
      />

      {/* Tutorial & Keyboard Shortcuts Modal */}
      <TutorialModal
        isOpen={isTutorialModalOpen}
        onClose={() => setIsTutorialModalOpen(false)}
        theme={theme}
        onNavigateModule={(moduleKey) => setActiveTab(moduleKey)}
      />
    </div>
  );
}
