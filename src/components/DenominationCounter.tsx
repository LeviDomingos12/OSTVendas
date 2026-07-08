import React, { useMemo } from "react";
import { Coins, Plus, Minus } from "lucide-react";

export interface Denomination {
  value: number;
  label: string;
  type: "note" | "coin";
}

export const DENOMINATIONS: Denomination[] = [
  { value: 1000, label: "1000 MT", type: "note" },
  { value: 500, label: "500 MT", type: "note" },
  { value: 200, label: "200 MT", type: "note" },
  { value: 100, label: "100 MT", type: "note" },
  { value: 50, label: "50 MT", type: "note" },
  { value: 20, label: "20 MT", type: "note" },
  { value: 10, label: "10 MT", type: "coin" },
  { value: 5, label: "5 MT", type: "coin" },
  { value: 2, label: "2 MT", type: "coin" },
  { value: 1, label: "1 MT", type: "coin" },
  { value: 0.5, label: "0.5 MT", type: "coin" }
];

interface DenominationCounterProps {
  denomCounts: { [key: string]: number };
  onChangeCount: (value: number, count: number) => void;
  currency: string;
  isInteractive?: boolean;
}

export default function DenominationCounter({
  denomCounts,
  onChangeCount,
  currency,
  isInteractive = true
}: DenominationCounterProps) {

  const totalCalculated = useMemo(() => {
    return DENOMINATIONS.reduce((sum, d) => {
      const qty = denomCounts[d.value.toString()] || 0;
      return sum + (d.value * qty);
    }, 0);
  }, [denomCounts]);

  return (
    <div className="bg-slate-50 p-4.5 rounded-2xl border border-slate-200/60 dark:bg-zinc-900/60 dark:border-zinc-800">
      <div className="flex items-center justify-between border-b border-slate-200/50 pb-2 mb-3 dark:border-zinc-800">
        <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1.5 dark:text-zinc-400">
          <Coins className="w-4 h-4 text-orange-500" />
          Resumo e Contagem de Caixa (Cédulas & Moedas)
        </span>
        <span className="text-xs font-mono font-bold text-slate-800 dark:text-zinc-200">
          Total: {totalCalculated.toLocaleString()} {currency}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Notes (Notas) Column */}
        <div className="space-y-2">
          <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Notas</span>
          <div className="space-y-1.5">
            {DENOMINATIONS.filter(d => d.type === "note").map(d => {
              const qty = denomCounts[d.value.toString()] || 0;
              return (
                <div key={d.value} className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-100 dark:bg-zinc-950 dark:border-zinc-850/80 text-xs">
                  <span className="font-bold text-slate-700 dark:text-zinc-300 font-mono w-16">{d.label}</span>
                  
                  {isInteractive ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onChangeCount(d.value, Math.max(0, qty - 1))}
                        className="w-5 h-5 bg-slate-100 hover:bg-slate-200 rounded text-slate-650 flex items-center justify-center font-bold dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 transition"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={qty || ""}
                        onChange={(e) => onChangeCount(d.value, Math.max(0, Number(e.target.value)))}
                        className="w-10 text-center font-mono font-bold bg-slate-50 border border-slate-200 rounded p-0.5 outline-none dark:bg-zinc-900 dark:border-zinc-800"
                      />
                      <button
                        type="button"
                        onClick={() => onChangeCount(d.value, qty + 1)}
                        className="w-5 h-5 bg-slate-100 hover:bg-slate-200 rounded text-slate-650 flex items-center justify-center font-bold dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 transition"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <span className="font-mono text-slate-400 font-semibold">{qty} un</span>
                  )}

                  <span className="w-16 text-right font-mono font-bold text-slate-800 dark:text-zinc-200">
                    {(qty * d.value).toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Coins (Moedas) Column */}
        <div className="space-y-2">
          <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Moedas</span>
          <div className="space-y-1.5">
            {DENOMINATIONS.filter(d => d.type === "coin").map(d => {
              const qty = denomCounts[d.value.toString()] || 0;
              return (
                <div key={d.value} className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-100 dark:bg-zinc-950 dark:border-zinc-850/80 text-xs">
                  <span className="font-bold text-slate-700 dark:text-zinc-300 font-mono w-16">{d.label}</span>
                  
                  {isInteractive ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onChangeCount(d.value, Math.max(0, qty - 1))}
                        className="w-5 h-5 bg-slate-100 hover:bg-slate-200 rounded text-slate-650 flex items-center justify-center font-bold dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 transition"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={qty || ""}
                        onChange={(e) => onChangeCount(d.value, Math.max(0, Number(e.target.value)))}
                        className="w-10 text-center font-mono font-bold bg-slate-50 border border-slate-200 rounded p-0.5 outline-none dark:bg-zinc-900 dark:border-zinc-800"
                      />
                      <button
                        type="button"
                        onClick={() => onChangeCount(d.value, qty + 1)}
                        className="w-5 h-5 bg-slate-100 hover:bg-slate-200 rounded text-slate-650 flex items-center justify-center font-bold dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 transition"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <span className="font-mono text-slate-400 font-semibold">{qty} un</span>
                  )}

                  <span className="w-16 text-right font-mono font-bold text-slate-800 dark:text-zinc-200">
                    {(qty * d.value).toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
