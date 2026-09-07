import React, { useState, useEffect, useRef, useMemo } from "react";
import * as d3 from "d3";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Crop,
  Download,
  Calendar,
  MousePointer,
  MoveLeft,
  MoveRight,
  ZoomIn,
  ZoomOut,
  RotateCcw
} from "lucide-react";
import { AuditLog } from "../types";

export interface AuditLogsD3BarChartProps {
  logs: AuditLog[];
}

export function AuditLogsD3BarChart({ logs }: AuditLogsD3BarChartProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [timeRange, setTimeRange] = useState<number>(14); // 7, 14, 30, 60, 90 days
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [zoomMode, setZoomMode] = useState<"box" | "pan">("box");
  const [showPrevWeekTrend, setShowPrevWeekTrend] = useState(false);
  const [hoveredDay, setHoveredDay] = useState<{
    label: string;
    dateStr: string;
    count: number;
    prevWeekCount: number;
    xPos: number;
    yPos: number;
  } | null>(null);

  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  // High activity moving average calculation (30-day window)
  const { isHighActivity, movingAvg30Val } = useMemo(() => {
    if (!logs || logs.length === 0) return { isHighActivity: false, movingAvg30Val: 0 };
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
    const avg30 = logs30dCount > 0 ? logs30dCount / 30 : 0;
    const threshold50 = avg30 * 1.5;

    const cutoff = new Date(now30);
    cutoff.setDate(cutoff.getDate() - timeRange);
    const recentLogs = logs.filter(l => l.timestamp && new Date(l.timestamp) >= cutoff);
    const avgRecent = recentLogs.length / Math.max(1, timeRange);
    const exceedsThreshold = avg30 > 0 && avgRecent > threshold50;

    return { isHighActivity: exceedsThreshold, movingAvg30Val: avg30 };
  }, [logs, timeRange]);

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

    const brush = d3.brushX()
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
        brush.clear(brushGroup);
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

          chartContent.select<SVGPathElement>(".prev-week-line")
            .attr("d", lineGeneratorRescaled(days) || "");

          chartContent.selectAll<SVGCircleElement, { label: string; prevWeekCount: number }>(".prev-dot")
            .attr("cx", d => (xRescaled(d.label) || 0) + xRescaled.bandwidth() / 2);
        }

        // Update X Axis ticks & labels dynamically
        renderXAxis(xRescaled);
      });

    zoomRef.current = zoomBehavior;
    svg.call(zoomBehavior);

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
