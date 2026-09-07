import React from "react";
import { Upload, Download, CheckCircle } from "lucide-react";

export interface StockCsvImportExportModalProps {
  isOpen: boolean;
  importStatus: "idle" | "processing" | "success";
  importedRowCount: number;
  onClose: () => void;
  onParseAndImportFile: (file: File) => void;
  onDownloadCSVTemplate: () => void;
}

export const StockCsvImportExportModal: React.FC<StockCsvImportExportModalProps> = ({
  isOpen,
  importStatus,
  importedRowCount,
  onClose,
  onParseAndImportFile,
  onDownloadCSVTemplate
}) => {
  if (!isOpen) return null;

  return (
    <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl animate-in slide-in-from-top duration-200 space-y-4 dark:bg-zinc-900 dark:border-zinc-800">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-bold text-slate-800 text-xs dark:text-zinc-200">Importação de Ficheiros XLS / CSV</h3>
          <p className="text-xs text-slate-400 mt-0.5">Carregue catálogos de fornecedores em massa com preços e quantidades do stock.</p>
        </div>
        <button 
          onClick={onClose}
          className="text-slate-450 hover:text-slate-600 text-xs font-semibold cursor-pointer dark:hover:text-zinc-300"
        >
          Fechar Painel X
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div 
          onClick={() => document.getElementById("native-excel-picker")?.click()}
          className="border-2 border-dashed border-slate-300 rounded-xl bg-white p-5 text-center space-y-2 flex flex-col justify-center items-center cursor-pointer hover:border-orange-400 hover:bg-orange-50/5 transition-colors dark:bg-zinc-950 dark:border-zinc-800"
        >
          <input 
            id="native-excel-picker"
            type="file"
            accept=".csv,.txt,.tsv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                onParseAndImportFile(file);
              }
              e.target.value = "";
            }}
          />
          <Upload className="w-8 h-8 text-slate-400" />
          <div>
            <p className="text-xs font-bold text-slate-700 dark:text-zinc-300">Clique para selecionar ficheiro CSV / TXT real</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Lê e importa produtos reais com nomes, preços e stocks</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col justify-between dark:bg-zinc-950 dark:border-zinc-800">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase font-mono block">Modelo Oficial</span>
            <h4 className="text-xs font-bold text-slate-700 mt-1 dark:text-zinc-300">Descarregar Modelo CSV</h4>
            <p className="text-[11px] text-slate-400">Baixe a planilha modelo pré-formatada para preencher os seus produtos reais.</p>
          </div>

          {importStatus === "idle" ? (
            <button
              type="button"
              onClick={onDownloadCSVTemplate}
              className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs py-2 px-3 rounded-lg mt-3 cursor-pointer text-center transition flex items-center justify-center gap-2 dark:bg-zinc-800 dark:hover:bg-zinc-700"
            >
              <Download className="w-3.5 h-3.5" />
              Baixar Template CSV
            </button>
          ) : importStatus === "processing" ? (
            <div className="text-xs font-bold text-orange-600 flex items-center gap-2 mt-3">
              <span className="w-4 h-4 rounded-full border-2 border-orange-500 border-t-transparent animate-spin"></span>
              Processando e importando ficheiro real...
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 text-green-800 text-xs p-2 rounded-lg mt-3 flex items-center gap-2 dark:bg-green-950/20 dark:border-green-800/50 dark:text-green-400">
              <CheckCircle className="w-4 h-4 text-green-700 shrink-0" />
              <div>
                <p className="font-bold">Ficheiro Processado!</p>
                <p className="text-[10px]">+{importedRowCount} produtos reais importados com sucesso.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
