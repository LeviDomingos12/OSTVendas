import React from "react";
import { Upload, Download, CheckCircle, FileSpreadsheet, FileText, ArrowDownToLine } from "lucide-react";
import { Product } from "../../types";
import { downloadStockTemplateExcel, downloadStockTemplateCSV, exportCurrentStockToExcel } from "../../lib/stockExcelService";

export interface StockCsvImportExportModalProps {
  isOpen: boolean;
  importStatus: "idle" | "processing" | "success";
  importedRowCount: number;
  products?: Product[];
  currency?: string;
  onClose: () => void;
  onParseAndImportFile: (file: File) => void;
  onDownloadCSVTemplate?: () => void;
  onDownloadExcelTemplate?: () => void;
  onExportCurrentStock?: () => void;
}

export const StockCsvImportExportModal: React.FC<StockCsvImportExportModalProps> = ({
  isOpen,
  importStatus,
  importedRowCount,
  products = [],
  currency = "MT",
  onClose,
  onParseAndImportFile,
  onDownloadCSVTemplate,
  onDownloadExcelTemplate,
  onExportCurrentStock
}) => {
  if (!isOpen) return null;

  const handleDownloadExcel = () => {
    if (onDownloadExcelTemplate) {
      onDownloadExcelTemplate();
    } else {
      downloadStockTemplateExcel();
    }
  };

  const handleDownloadCSV = () => {
    if (onDownloadCSVTemplate) {
      onDownloadCSVTemplate();
    } else {
      downloadStockTemplateCSV();
    }
  };

  const handleExportStock = () => {
    if (onExportCurrentStock) {
      onExportCurrentStock();
    } else {
      exportCurrentStockToExcel(products, currency);
    }
  };

  return (
    <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl animate-in slide-in-from-top duration-200 space-y-4 dark:bg-zinc-900 dark:border-zinc-800 shadow-sm">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-600/10 text-emerald-600 flex items-center justify-center dark:bg-emerald-500/20 dark:text-emerald-400">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-slate-800 text-sm dark:text-zinc-100">
              Importação & Exportação de Stock (Excel e CSV)
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1 dark:text-zinc-400">
            Adicione ou atualize produtos e quantidades em massa com planilhas Excel perfeitamente estruturadas em colunas.
          </p>
        </div>
        <button 
          onClick={onClose}
          className="text-slate-450 hover:text-slate-600 text-xs font-semibold cursor-pointer dark:hover:text-zinc-300 p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-800"
        >
          ✕ Fechar
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Dropzone Column */}
        <div 
          onClick={() => document.getElementById("native-excel-picker")?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const file = e.dataTransfer.files?.[0];
            if (file) {
              onParseAndImportFile(file);
            }
          }}
          className="lg:col-span-6 border-2 border-dashed border-slate-300 rounded-xl bg-white p-6 text-center space-y-3 flex flex-col justify-center items-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/10 transition-colors dark:bg-zinc-950 dark:border-zinc-800"
        >
          <input 
            id="native-excel-picker"
            type="file"
            accept=".xlsx,.xls,.csv,.txt,.tsv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                onParseAndImportFile(file);
              }
              e.target.value = "";
            }}
          />
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center dark:bg-emerald-950/40 dark:text-emerald-400">
            <Upload className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-800 dark:text-zinc-200">
              Clique ou arraste a sua planilha preenchida aqui
            </p>
            <p className="text-[11px] text-slate-400 mt-1 max-w-sm">
              Compatível com ficheiros Microsoft Excel (.xlsx, .xls) ou CSV. Reconhece automaticamente colunas de Código, Nome, Categoria, Preços, Stock e Fornecedor.
            </p>
          </div>

          {importStatus === "processing" && (
            <div className="text-xs font-bold text-orange-600 flex items-center gap-2 mt-2 bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-200 dark:bg-orange-950/30 dark:border-orange-900">
              <span className="w-3.5 h-3.5 rounded-full border-2 border-orange-500 border-t-transparent animate-spin"></span>
              Processando produtos e quantidades...
            </div>
          )}

          {importStatus === "success" && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-2.5 rounded-xl flex items-center gap-2 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-300">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="text-left">
                <p className="font-bold">Planilha Importada com Sucesso!</p>
                <p className="text-[10px]">+{importedRowCount} artigos adicionados / atualizados no inventário.</p>
              </div>
            </div>
          )}
        </div>

        {/* Templates & Export Options Column */}
        <div className="lg:col-span-6 flex flex-col gap-3">
          {/* Card 1: Official Excel Template (.xlsx) */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 dark:bg-zinc-950 dark:border-zinc-800 flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 dark:bg-emerald-950/40 dark:text-emerald-400">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-200">Modelo Excel (.xlsx)</h4>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[9px] font-bold">
                    Recomendado
                  </span>
                </div>
                <p className="text-[10.5px] text-slate-400 mt-0.5">
                  Organizado em colunas separadas para facilitar o preenchimento no Excel sem ponto e vírgula.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDownloadExcel}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-3 rounded-xl transition flex items-center gap-1.5 shrink-0 cursor-pointer shadow-sm shadow-emerald-600/15"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar .xlsx</span>
            </button>
          </div>

          {/* Card 2: Standard CSV Template */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 dark:bg-zinc-950 dark:border-zinc-800 flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 dark:bg-zinc-800 dark:text-zinc-300">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-200">Modelo CSV (.csv)</h4>
                <p className="text-[10.5px] text-slate-400 mt-0.5">
                  Formato CSV padrão UTF-8 separado por vírgulas compatível com todos os editores.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDownloadCSV}
              className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs py-2 px-3 rounded-xl transition flex items-center gap-1.5 shrink-0 cursor-pointer dark:bg-zinc-800 dark:hover:bg-zinc-700"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar .csv</span>
            </button>
          </div>

          {/* Card 3: Export Current Catalog */}
          {products.length > 0 && (
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 dark:bg-zinc-950 dark:border-zinc-800 flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0 dark:bg-orange-950/40 dark:text-orange-400">
                  <ArrowDownToLine className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-200">Exportar Stock Atual em Excel</h4>
                  <p className="text-[10.5px] text-slate-400 mt-0.5">
                    Descarregue os seus {products.length} produtos atuais com códigos, preços e stocks numa planilha Excel.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleExportStock}
                className="border border-orange-300 hover:bg-orange-50 text-orange-600 font-bold text-xs py-2 px-3 rounded-xl transition flex items-center gap-1.5 shrink-0 cursor-pointer dark:border-orange-800 dark:hover:bg-orange-950/30 dark:text-orange-400"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
