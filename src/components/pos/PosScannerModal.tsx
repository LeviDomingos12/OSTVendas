import React, { useState, useRef } from "react";
import { Camera } from "lucide-react";
import { Product } from "../../types";
import QrCodeScannerComponent from "../QrCodeScannerComponent";

interface PosScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  localProducts: Product[];
  cartItemQuantities: Map<string, number>;
  onAddToCart: (product: Product) => void;
  onShowToast?: (message: string, type: "success" | "error" | "info" | "warning", title?: string) => void;
}

export const PosScannerModal: React.FC<PosScannerModalProps> = ({
  isOpen,
  onClose,
  localProducts,
  cartItemQuantities,
  onAddToCart,
  onShowToast,
}) => {
  const [scannerTab, setScannerTab] = useState<"camera" | "simulation">("camera");
  const [continuousScan, setContinuousScan] = useState(false);
  const [manualBarcodeScan, setManualBarcodeScan] = useState("");
  const lastScannedCodeRef = useRef<string>("");
  const lastScannedTimeRef = useRef<number>(0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white p-5 rounded-2xl max-w-sm w-full border border-slate-100 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
        {/* Header / Tab Switcher */}
        <div className="text-center space-y-2.5">
          <div className="w-11 h-11 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto">
            <Camera className="w-5.5 h-5.5" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900 text-sm">Leitor de Códigos de Barra</h3>
            <p className="text-[10.5px] text-slate-400 mt-0.5">
              Efetue a leitura de artigos para o carrinho de compras de forma automática.
            </p>
          </div>

          {/* Tab Selector */}
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setScannerTab("camera")}
              className={`flex-1 py-1.5 text-[11px] font-extrabold rounded-lg transition-all cursor-pointer ${
                scannerTab === "camera"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              📷 Câmara Real
            </button>
            <button
              type="button"
              onClick={() => setScannerTab("simulation")}
              className={`flex-1 py-1.5 text-[11px] font-extrabold rounded-lg transition-all cursor-pointer ${
                scannerTab === "simulation"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              🧪 Emulador POS
            </button>
          </div>
        </div>

        {/* TAB CONTENT 1: PHYSICAL CAMERA CAPTURE */}
        {scannerTab === "camera" && (
          <div className="space-y-3.5">
            <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-950 flex items-center justify-center">
              {/* Glowing Laser line animation overlay */}
              <div
                className="absolute left-0 right-0 h-[1.5px] bg-red-500 shadow-[0_0_8px_#ef4444] z-10 animate-pulse"
                style={{
                  top: "50%",
                  transform: "translateY(-50%)",
                }}
              />

              {/* Viewfinder corner overlays */}
              <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-orange-500 z-10" />
              <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-orange-500 z-10" />
              <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-orange-500 z-10" />
              <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-orange-500 z-10" />

              {/* HTML5 QrReader Component */}
              <QrCodeScannerComponent
                onResult={(result, _error) => {
                  if (result) {
                    const textValue = result.text || String(result);
                    if (textValue) {
                      const trimmed = textValue.trim();
                      const now = Date.now();

                      // Prevent rapid duplicate scans within 2.5 seconds
                      if (trimmed === lastScannedCodeRef.current && now - lastScannedTimeRef.current < 2500) {
                        return;
                      }

                      lastScannedCodeRef.current = trimmed;
                      lastScannedTimeRef.current = now;

                      const match = localProducts.find((p) => p.barcode === trimmed || p.code === trimmed);
                      if (match) {
                        onAddToCart(match);
                        if (!continuousScan) {
                          onClose();
                        }
                      } else {
                        if (onShowToast) {
                          onShowToast(`Código lido: "${trimmed}" não registado no catálogo.`, "warning", "Código Desconhecido");
                        }
                      }
                    }
                  }
                }}
                facingMode="environment"
                scanDelay={400}
              />
            </div>

            {/* Continuous Scan Checkbox */}
            <label className="flex items-center gap-2 px-3 py-2 text-slate-600 justify-center text-[10.5px] bg-slate-50 rounded-xl border border-slate-150 cursor-pointer hover:bg-slate-100 transition">
              <input
                type="checkbox"
                checked={continuousScan}
                onChange={(e) => setContinuousScan(e.target.checked)}
                className="rounded text-orange-500 focus:ring-orange-500 w-3.5 h-3.5 cursor-pointer"
              />
              <span className="font-bold select-none text-slate-700">Leitura Contínua (Não fechar painel após ler)</span>
            </label>
          </div>
        )}

        {/* TAB CONTENT 2: MOCK EMULATION LIST */}
        {scannerTab === "simulation" && (
          <div className="space-y-3.5">
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              <span className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider font-mono block">
                Barcodes Disponíveis:
              </span>
              {localProducts.map((p) => {
                const inCartQty = cartItemQuantities.get(p.id) || 0;
                const liveStock = Math.max(0, p.stock - inCartQty);
                const isExhausted = liveStock <= 0;
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={isExhausted}
                    onClick={() => {
                      onAddToCart(p);
                      onClose();
                    }}
                    className={`w-full text-left p-2 border rounded-lg text-xs flex justify-between items-center transition ${
                      isExhausted
                        ? "bg-slate-100/60 border-slate-200 cursor-not-allowed opacity-60"
                        : "bg-slate-50 border-slate-150 hover:bg-orange-50 hover:border-orange-200 cursor-pointer"
                    }`}
                  >
                    <div className="truncate pr-2">
                      <span className="font-bold text-slate-700 block truncate">{p.name}</span>
                      <span className="text-[9.5px] font-mono text-slate-400 block">
                        {p.barcode || "Sem Barcode"} • Disp: {liveStock} un
                      </span>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-orange-600 bg-white border border-slate-100 px-1.5 py-0.5 rounded shrink-0">
                      {isExhausted ? "Esgotado" : "Bipar"}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="border-t border-slate-100 pt-3 flex gap-2">
              <input
                type="text"
                placeholder="Insira barcode manualmente..."
                value={manualBarcodeScan}
                onChange={(e) => setManualBarcodeScan(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-mono outline-none focus:ring-1 focus:ring-orange-500"
              />
              <button
                type="button"
                onClick={() => {
                  if (manualBarcodeScan) {
                    const match = localProducts.find(
                      (p) => p.barcode === manualBarcodeScan.trim() || p.code === manualBarcodeScan.trim()
                    );
                    if (match) {
                      onAddToCart(match);
                      onClose();
                      setManualBarcodeScan("");
                    } else {
                      if (onShowToast) onShowToast("Nenhum produto associado a este código.", "error", "Manual");
                    }
                  }
                }}
                className="px-3.5 bg-slate-900 text-white rounded-xl text-xs font-extrabold cursor-pointer hover:bg-slate-800"
              >
                Ler
              </button>
            </div>
          </div>
        )}

        {/* Footer Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition"
        >
          Fechar Painel
        </button>
      </div>
    </div>
  );
};
