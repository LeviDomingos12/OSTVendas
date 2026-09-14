import React, { useState, useEffect } from "react";
import { Product } from "../../types";
import { generateEntityId, generateDeterministicBarcodeEan13, generateUUID } from "../../lib/deterministic";

export interface ProductFormDrawerProps {
  isOpen: boolean;
  editingProduct: Product | null;
  productsCount?: number;
  categoriesList?: string[];
  suppliersList?: string[];
  currency?: string;
  onClose: () => void;
  onSave?: (product: Product) => void;
  onSaveProduct?: (product: Product) => void;
}

export const ProductFormDrawer: React.FC<ProductFormDrawerProps> = ({
  isOpen,
  editingProduct,
  productsCount = 0,
  categoriesList,
  suppliersList,
  currency = "MT",
  onClose,
  onSave,
  onSaveProduct
}) => {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [category, setCategory] = useState("Mercearia");
  const [supplier, setSupplier] = useState("");
  const [costPrice, setCostPrice] = useState<number>(0);
  const [salePrice, setSalePrice] = useState<number>(0);
  const [stock, setStock] = useState<number>(0);
  const [minStock, setMinStock] = useState<number>(5);
  const [expiryDate, setExpiryDate] = useState("");
  const [barcode, setBarcode] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [emoji, setEmoji] = useState("📦");
  const [promotion, setPromotion] = useState<string>("");
  const [vatRate, setVatRate] = useState<number>(16);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (editingProduct) {
      setName(editingProduct.name || "");
      setCode(editingProduct.code || "");
      setCategory(editingProduct.category || "Mercearia");
      setSupplier(editingProduct.supplier || "");
      setCostPrice(editingProduct.costPrice || 0);
      setSalePrice(editingProduct.salePrice || 0);
      setStock(editingProduct.stock || 0);
      setMinStock(editingProduct.minStock || 5);
      setExpiryDate(editingProduct.expiryDate || "");
      setBarcode(editingProduct.barcode || "");
      setImageUrl(editingProduct.image || "");
      setEmoji(editingProduct.emoji || "📦");
      setPromotion(editingProduct.promotion || "");
      setVatRate(editingProduct.vatRate || 16);
      setValidationError(null);
    } else {
      setName("");
      setCode("");
      setCategory("Mercearia");
      setSupplier("");
      setCostPrice(0);
      setSalePrice(0);
      setStock(0);
      setMinStock(5);
      setExpiryDate("");
      setBarcode("");
      setImageUrl("");
      setEmoji("📦");
      setPromotion("");
      setVatRate(16);
      setValidationError(null);
    }
  }, [editingProduct, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setValidationError("Por favor, escreva o nome do produto.");
      return;
    }
    if (salePrice < 0 || costPrice < 0) {
      setValidationError("Os preços não podem ser negativos.");
      return;
    }

    // Auto-gera código SKU amigável caso o usuário não tenha preenchido
    const finalCode = code.trim() || `SKU-${generateUUID().slice(0, 8).toUpperCase()}`;
    const finalSupplier = supplier.trim() || "Geral";

    const savedProduct: Product = {
      id: editingProduct ? editingProduct.id : generateEntityId("prod"),
      name: name.trim(),
      code: finalCode,
      category,
      supplier: finalSupplier,
      costPrice: Number(costPrice || 0),
      salePrice: Number(salePrice || 0),
      stock: Number(stock || 0),
      minStock: Number(minStock !== undefined ? minStock : 5),
      expiryDate: expiryDate || undefined,
      barcode: barcode.trim() || undefined,
      image: imageUrl.trim() || undefined,
      emoji: emoji || "📦",
      promotion: promotion || undefined,
      vatRate: Number(vatRate || 16),
      branchStocks: editingProduct?.branchStocks
    };

    if (onSaveProduct) {
      onSaveProduct(savedProduct);
    } else if (onSave) {
      onSave(savedProduct);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 rounded-2xl max-w-xl w-full border border-slate-100 shadow-2xl space-y-4 animate-in fade-in duration-200 dark:bg-zinc-900 dark:border-zinc-800">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-zinc-800">
          <h3 className="font-bold text-slate-950 text-sm dark:text-zinc-100">
            {editingProduct ? `Editar Detalhes: ${editingProduct.name}` : "Cadastrar Novo Produto para Stock"}
          </h3>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {validationError && (
            <p className="bg-red-50 border border-red-200 text-red-700 text-xs p-2.5 rounded-lg font-semibold">{validationError}</p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Name */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Nome Comercial do Produto *</label>
              <input
                type="text"
                required
                placeholder="Ex: Óleo Alimentar Maçaroca 5L"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg p-2 font-semibold outline-none focus:border-orange-500 text-slate-800 dark:text-zinc-100"
              />
            </div>

            {/* SKU Code */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Código / SKU *</label>
              <input
                type="text"
                required
                placeholder="Ex: OLE-MAÇ-05"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg p-2 font-semibold outline-none focus:border-orange-500 text-slate-800 dark:text-zinc-100"
              />
            </div>

            {/* Barcode (EAN / Scanner) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                  <span>🏷️ Código de Barras (EAN)</span>
                </label>
                <button
                  type="button"
                  onClick={() => setBarcode(generateDeterministicBarcodeEan13("560", productsCount + 1))}
                  className="text-[9.5px] text-orange-600 hover:text-orange-700 font-bold hover:underline cursor-pointer"
                >
                  ⚡ Gerar EAN-13
                </button>
              </div>
              <input
                type="text"
                placeholder="Bipe com o leitor ou digite o código"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg p-2 font-semibold font-mono text-slate-800 dark:text-zinc-100 outline-none focus:border-orange-500"
              />
            </div>

            {/* Category selection */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Categoria</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg p-2 font-semibold outline-none cursor-pointer text-slate-800 dark:text-zinc-100"
              >
                <option value="Mercearia">Mercearia</option>
                <option value="Bebidas">Bebidas</option>
                <option value="Eletrónicos">Eletrónicos</option>
                <option value="Construção">Construção</option>
                <option value="Vestuário">Vestuário</option>
                <option value="Outros">Outros</option>
              </select>
            </div>

            {/* Supplier */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Fornecedor Distribuidor *</label>
              <input
                type="text"
                required
                placeholder="Ex: CDM Moçambique ou MozAlimentos"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg p-2 font-semibold outline-none focus:border-orange-500 text-slate-800 dark:text-zinc-100"
              />
            </div>

            {/* Cost price */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Preço de Custo (MT) *</label>
              <input
                type="number"
                required
                min="0"
                placeholder="Ex: 110"
                value={costPrice || ""}
                onChange={(e) => setCostPrice(Number(e.target.value))}
                className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg p-2 font-semibold font-mono outline-none text-slate-800 dark:text-zinc-100"
              />
            </div>

            {/* Sale price */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Preço de Venda (MT) *</label>
              <input
                type="number"
                required
                min="0"
                placeholder="Ex: 165"
                value={salePrice || ""}
                onChange={(e) => setSalePrice(Number(e.target.value))}
                className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg p-2 font-semibold font-mono outline-none text-slate-800 dark:text-zinc-100"
              />
            </div>

            {/* Stock default */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Estoque Inicial (Unidades) *</label>
              <input
                type="number"
                required
                min="0"
                placeholder="Ex: 30"
                value={stock}
                onChange={(e) => setStock(Number(e.target.value))}
                className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg p-2 font-semibold font-mono outline-none text-slate-800 dark:text-zinc-100"
              />
            </div>

            {/* Stock limit minimum */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Estoque Mínimo de Alerta *</label>
              <input
                type="number"
                required
                min="0"
                placeholder="Ex: 5"
                value={minStock}
                onChange={(e) => setMinStock(Number(e.target.value))}
                className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg p-2 font-semibold font-mono outline-none text-slate-800 dark:text-zinc-100"
              />
            </div>

            {/* Expiry Date */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Data de Validade/Vencimento</label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg p-2 font-semibold outline-none text-slate-800 dark:text-zinc-100"
              />
            </div>

            {/* Image URL input (Optional) */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">URL da Imagem do Produto (Opcional)</label>
              <input
                type="url"
                placeholder="https://exemplo.com/imagem.png"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg p-2 font-semibold outline-none focus:border-orange-500 text-slate-800 dark:text-zinc-100"
              />
            </div>

            {/* Emoji visual selector */}
            <div className="space-y-1 md:col-span-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Emoji do Produto / Decorador</label>
              <select
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg p-2 font-semibold outline-none cursor-pointer text-slate-800 dark:text-zinc-100"
              >
                <option value="🍙">🍙 Arroz / Grãos</option>
                <option value="🧴">🧴 Garrafas / Óleo</option>
                <option value="🌾">🌾 Sacos / Farinhas</option>
                <option value="🍺">🍺 Garrafas / Laurentina</option>
                <option value="🍻">🍻 Latas / Cervejas</option>
                <option value="🧃">🧃 Sumos / Tetrapaks</option>
                <option value="🔌">🔌 Acessórios USB</option>
                <option value="📱">📱 Celulares / Smartphones</option>
                <option value="🧱">🧱 Cimento / Tijolo</option>
                <option value="👕">👕 Roupas / Vestuário</option>
                <option value="🥫">🥫 Enlatados / Tomate</option>
                <option value="📦">📦 Outros Genericamente</option>
              </select>
            </div>

            {/* Promotion Type */}
            <div className="space-y-1 md:col-span-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Campanha Promocional (Opcional)</label>
              <select
                value={promotion}
                onChange={(e) => setPromotion(e.target.value)}
                className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg p-2 font-semibold outline-none cursor-pointer text-slate-800 dark:text-zinc-100"
              >
                <option value="">Nenhuma</option>
                <option value="PROMO">PROMO - Promoção Geral</option>
                <option value="DESCONTO">DESCONTO - Oferta / Liquidação</option>
                <option value="MAIS_VENDIDO">MAIS VENDIDO - Destaque de Vendas</option>
                <option value="NOVO">NOVO - Lançamento</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="w-1/2 py-2.5 border border-slate-200 bg-white text-slate-700 font-bold rounded-xl text-xs cursor-pointer hover:bg-slate-50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="w-1/2 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs cursor-pointer transition"
            >
              {editingProduct ? "Salvar Alterações" : "Cadastrar Produto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
