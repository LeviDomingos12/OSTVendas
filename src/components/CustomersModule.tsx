import React, { useState, useMemo } from "react";
import { 
  Users, 
  Plus, 
  Trash2, 
  Search, 
  Star, 
  Smartphone, 
  Award, 
  AlertCircle, 
  Mail, 
  Sparkles, 
  Send,
  CheckCircle2,
  PhoneCall,
  DollarSign
} from "lucide-react";
import { sendEmail } from "../lib/gmail";
import { Customer, UserRole } from "../types";

interface CustomersModuleProps {
  customers: Customer[];
  onAddCustomer: (c: Customer) => void;
  onUpdateCustomer?: (c: Customer) => void;
  onAddCashFlowEntry?: (entry: any) => void;
  onDeleteCustomer: (cId: string) => void;
  onAddAuditLog: (action: string, module: string, details: string) => void;
  currentRole: UserRole;
  currency: string;
  activeUsername?: string;
  onShowToast?: (message: string, type: "success" | "error" | "info" | "warning", title?: string) => void;
}

export default function CustomersModule({
  customers,
  onAddCustomer,
  onUpdateCustomer,
  onAddCashFlowEntry,
  onDeleteCustomer,
  onAddAuditLog,
  currentRole,
  currency,
  activeUsername,
  onShowToast
}: CustomersModuleProps) {
  
  // Local states
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | "VIP" | "DEBT" | "INACTIVE">("ALL");

  // Sub-tabs navigation inside Customer Module
  const [activeSubTab, setActiveSubTab] = useState<"list" | "register" | "history" | "debts">("list");

  // Debt Settlement Modal States
  const [settleDebtCustomer, setSettleDebtCustomer] = useState<Customer | null>(null);
  const [settlementAmount, setSettlementAmount] = useState<number | "">("");
  const [isSettling, setIsSettling] = useState(false);

  // Customer Creator
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [nuit, setNuit] = useState("");
  const [localError, setLocalError] = useState("");

  // SMS Marketing states
  const [showSmsPanel, setShowSmsPanel] = useState(false);
  const [campaignTarget, setCampaignTarget] = useState<"ALL" | "VIP" | "DEBT" | "INACTIVE">("ALL");
  const [customSmsPrompt, setCustomSmsPrompt] = useState("");
  const [smsOptions, setSmsOptions] = useState<string[]>([]);
  const [selectedSms, setSelectedSms] = useState("");
  const [isGeneratingSms, setIsGeneratingSms] = useState(false);
  const [smsDispatchStatus, setSmsDispatchStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [dispatchCount, setDispatchCount] = useState(0);

  // Filtered customer list
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      // 1. Search text
      const matchSearch = 
        (c.name || "").toLowerCase().includes(searchQuery.toLowerCase()) || 
        (c.phone || "").includes(searchQuery) || 
        (c.nuit && c.nuit.includes(searchQuery));
      // 2. Advanced filters
      let matchFilter = true;
      if (filterType === "VIP") {
        matchFilter = c.purchaseCount >= 10;
      } else if (filterType === "DEBT") {
        matchFilter = c.debt > 0;
      } else if (filterType === "INACTIVE") {
        matchFilter = c.purchaseCount <= 4;
      }

      return matchSearch && matchFilter;
    });
  }, [customers, searchQuery, filterType]);

  // Target count calculator for SMS Campaigns
  const targetClientsCount = useMemo(() => {
    return customers.filter(c => {
      if (campaignTarget === "ALL") return true;
      if (campaignTarget === "VIP") return c.purchaseCount >= 10;
      if (campaignTarget === "DEBT") return c.debt > 0;
      if (campaignTarget === "INACTIVE") return c.purchaseCount <= 4;
      return true;
    }).length;
  }, [customers, campaignTarget]);

  // Handle customer registration
  const handleSubmitCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !nuit.trim()) {
      setLocalError("Por favor, preencha os campos obrigatórios (Nome, Telefone e NUIT).");
      return;
    }
    setLocalError("");

    const payload: Customer = {
      id: `cust-${Date.now()}`,
      name,
      phone,
      email: email || "consumidor@geral.com",
      address: address || "Não Informado, Maputo",
      nuit,
      totalSpent: 0,
      purchaseCount: 0,
      debt: 0,
      loyaltyPoints: 0
    };

    onAddCustomer(payload);
    onAddAuditLog(
      "Cadastrar Cliente",
      "CLIENTES",
      `Novo cliente '${payload.name}' cadastrado por ${currentRole}. NUIT: ${payload.nuit}, Telefone: ${payload.phone}`
    );

    if (onShowToast) {
      onShowToast(`Cliente ${payload.name} cadastrado com sucesso!`, "success", "Cadastro Concluído");
    }

    setIsFormOpen(false);
    setActiveSubTab("list");
    setName("");
    setPhone("");
    setEmail("");
    setAddress("");
    setNuit("");
  };

  // Delete Customer
  const handleDeleteCustomerClick = (customerId: string) => {
    const cli = customers.find(c => c.id === customerId);
    if (!cli) return;

    if (cli.debt > 0 && currentRole === "CASHIER") {
      if (onShowToast) onShowToast(`Operadores não têm permissão para apagar clientes com dívidas ativas. Contate um Administrador.`, "error", "Bloqueio de Segurança");
      return;
    }

    if (confirm("Deseja apagar permanentemente este registro de cliente? Todos os acúmulos de pontos e histórico serão apagados.")) {
      onDeleteCustomer(customerId);
      onAddAuditLog("Excluir Cliente", "CLIENTES", `Cadastro de '${cli.name}' excluído do sistema por ${currentRole}.`);
    }
  };

  // Debt Settlement
  const handleSettleDebt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleDebtCustomer || !settlementAmount || !onUpdateCustomer || !onAddCashFlowEntry) return;
    
    const amountToPay = Number(settlementAmount);
    if (amountToPay <= 0) {
      if (onShowToast) onShowToast("O valor a ser liquidado deve ser maior que zero.", "error");
      return;
    }

    if (amountToPay > settleDebtCustomer.debt) {
      if (onShowToast) onShowToast(`O valor informado (${amountToPay} MT) é maior que a dívida atual (${settleDebtCustomer.debt} MT).`, "error");
      return;
    }

    setIsSettling(true);
    
    // Simulate network processing and sending SMS/Email
    setTimeout(async () => {
      const settlementRecord = {
        id: `set-${Date.now()}`,
        date: new Date().toISOString(),
        amount: amountToPay,
        method: "Numerário"
      };

      // 1. Update customer debt and history
      onUpdateCustomer({
        ...settleDebtCustomer,
        debt: settleDebtCustomer.debt - amountToPay,
        settlements: [...(settleDebtCustomer.settlements || []), settlementRecord]
      });

      // 2. Add cash flow entry
      onAddCashFlowEntry({
        id: `cash-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: "INPUT",
        amount: amountToPay,
        reason: `Liquidação de dívida: ${settleDebtCustomer.name}`,
        responsibleUser: activeUsername || "Operador Atual"
      });

      // 3. Log audit
      onAddAuditLog(
        "Liquidação de Dívida",
        "CLIENTES",
        `Dívida de ${settleDebtCustomer.name} liquidada em ${amountToPay} MT.`
      );

      const receiptNumber = `REC-${Date.now()}`;
      const operatorName = activeUsername || "Operador Atual";
      const remainingBalance = settleDebtCustomer.debt - amountToPay;
      const paymentMethodStr = "Numerário";

      // 4. Send email receipt
      if (settleDebtCustomer.email && settleDebtCustomer.email.includes("@")) {
        try {
          const htmlReceipt = `
            <div style="font-family: sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px;">
              <h2 style="color: #047857; text-align: center; margin-bottom: 20px;">Recibo de Liquidação de Dívida</h2>
              <p><strong>Recibo Nº:</strong> ${receiptNumber}</p>
              <p><strong>Data:</strong> ${new Date().toLocaleString()}</p>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 15px 0;" />
              <p>Olá <strong>${settleDebtCustomer.name}</strong>,</p>
              <p>Confirmamos a receção do pagamento no valor de <strong>${amountToPay.toLocaleString()} MT</strong> via ${paymentMethodStr}.</p>
              <p>A sua dívida pendente foi atualizada para: <strong>${remainingBalance.toLocaleString()} MT</strong>.</p>
              <p>Operador: ${operatorName}</p>
              <p style="margin-top: 30px; font-size: 12px; color: #64748b; text-align: center;">Obrigado pela sua preferência!<br><em>OST Vendas - Sistema de Faturação</em></p>
            </div>
          `;
          await sendEmail({
            to: settleDebtCustomer.email,
            subject: `Recibo ${receiptNumber} - OST Vendas`,
            body: htmlReceipt,
            isHtml: true
          });
        } catch (e) {
          console.error("Failed to send receipt email:", e);
        }
      }

      // 4.5 Send SMS receipt
      if (settleDebtCustomer.phone) {
        try {
          const { sendSMS } = await import("../lib/sms");
          const smsMsg = `OST Vendas (Recibo: ${receiptNumber}): Pagamento de ${amountToPay} MT efetuado via ${paymentMethodStr}. Divida atual: ${remainingBalance} MT. Obrigado!`;
          await sendSMS(settleDebtCustomer.phone, smsMsg);
        } catch (e) {
          console.error("Failed to send SMS receipt:", e);
        }
      }

      // 4.6 Generate PDF Receipt
      try {
        const { jsPDF } = await import("jspdf");
        const doc = new jsPDF();
        
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(4, 120, 87);
        doc.text("OST VENDAS - COMPROVATIVO DE LIQUIDACAO", 14, 20);
        
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text(`Recibo Nº: ${receiptNumber}`, 14, 30);
        doc.text(`Data: ${new Date().toLocaleString()}`, 14, 38);
        doc.text(`Operador: ${operatorName}`, 14, 46);
        
        doc.setLineWidth(0.5);
        doc.line(14, 52, 196, 52);
        
        doc.text(`Cliente: ${settleDebtCustomer.name}`, 14, 62);
        doc.text(`Nuit: ${settleDebtCustomer.nuit || "N/A"}`, 14, 70);
        
        doc.setFont("helvetica", "bold");
        doc.text(`Valor Liquidado: ${amountToPay.toLocaleString()} MT`, 14, 85);
        doc.setFont("helvetica", "normal");
        doc.text(`Método de Pagamento: ${paymentMethodStr}`, 14, 93);
        doc.text(`Dívida Restante: ${remainingBalance.toLocaleString()} MT`, 14, 101);
        
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text("Obrigado por regularizar a sua situacao!", 14, 120);
        doc.text("Processado por computador", 14, 126);
        
        doc.autoPrint();
        const blobUrl = doc.output('bloburl');
        window.open(blobUrl, '_blank');
        
        doc.save(`${receiptNumber}_${settleDebtCustomer.name.replace(/\s+/g, '_')}.pdf`);
      } catch (err) {
        console.error("Error generating PDF receipt:", err);
      }

      // 5. Confirmation toast
      if (onShowToast) {
        onShowToast(
          `Liquidação de ${amountToPay} MT efetuada! Comprovativo enviado por SMS/E-mail para ${settleDebtCustomer.phone}.`,
          "success",
          "Dívida Liquidada"
        );
      }

      setSettleDebtCustomer(null);
      setSettlementAmount("");
      setIsSettling(false);
    }, 1200);
  };

  // Trigger Gemini API to generate gorgeous creative SMS
  const handleGenerateAISms = async () => {
    setIsGeneratingSms(true);
    setSmsOptions([]);
    setSelectedSms("");

    try {
      const response = await fetch("/api/gemini/marketing/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignType: campaignTarget === "ALL" ? "Geral de Promoções" : campaignTarget === "VIP" ? "Fidelização VIP" : campaignTarget === "DEBT" ? "Cobrança de Dívidas Pendentes" : "Reativação de Inativos",
          details: customSmsPrompt
        })
      });

      const data = await response.json();
      if (data.smsList) {
        setSmsOptions(data.smsList);
        setSelectedSms(data.smsList[0]); // default select first
      } else {
        throw new Error("Formato inválido recebido do servidor AI.");
      }
    } catch (error) {
      console.warn("Erro ao contactar Gemini, aplicando fallback local...");
      // Perfect fallback list if offline or no key
      const fallbackList = [
        `Estimado Cliente VIP. Venha conhecer as novidades especiais do OST Vendas esta semana! Use M-Pesa e ganhe descontos!`,
        `Prezado Cliente. Lembrete amigável de fatura pendente com facilidade de pagamento via M-Pesa. Contacte-nos para fechar.`,
        `Campanha Especial OST Vendas! Visite nossa loja hoje e acumule pontos em dobro na compra de qualquer saco de arroz.`
      ];
      setSmsOptions(fallbackList);
      setSelectedSms(fallbackList[0]);
    } finally {
      setIsGeneratingSms(false);
    }
  };

  // Dispatch Campaign
  const handleDispatchSmsCampaign = async () => {
    if (!selectedSms.trim()) return;

    setSmsDispatchStatus("sending");
    setDispatchCount(targetClientsCount);

    try {
      const response = await fetch("/api/campaign/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channels: ["SMS"],
          campaignTitle: `Fidelização ${campaignTarget}`,
          message: selectedSms,
          recipients: Array(targetClientsCount || 1).fill({}),
          simulateError: selectedSms.toLowerCase().includes("erro") || selectedSms.toLowerCase().includes("fail")
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSmsDispatchStatus("sent");
        onAddAuditLog(
          "Campanha Marketing SMS Disparada",
          "CLIENTES",
          `Campanha SMS enviada para ${targetClientsCount} destinatários. Mensagem: "${selectedSms.substring(0, 50)}..."`
        );
        if (onShowToast) {
          onShowToast(data.message || "Campanha disparada com sucesso!", "success", "Campanha Disparada");
        }
      } else {
        throw new Error(data.error || "O servidor de campanhas de telefonia recusou a requisição.");
      }
    } catch (err: any) {
      setSmsDispatchStatus("idle");
      if (onShowToast) {
        onShowToast(err.message || "Falha ao despachar a campanha de SMS.", "error", "Falha de Envio");
      }
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Sub tabs navigation */}
      <div className="flex gap-1 border-b border-slate-200/30 pb-px mb-5">
        <button
          type="button"
          onClick={() => setActiveSubTab("list")}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeSubTab === "list"
              ? "border-amber-500 text-amber-500"
              : "border-transparent text-slate-400 hover:text-slate-250 hover:border-slate-300"
          }`}
        >
          <Users className="w-4 h-4" />
          Fichas de Clientes ({customers.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab("debts")}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeSubTab === "debts"
              ? "border-red-500 text-red-600"
              : "border-transparent text-slate-400 hover:text-slate-250 hover:border-slate-300"
          }`}
        >
          <AlertCircle className="w-4 h-4" />
          Com Dívidas ({customers.filter(c => c.debt > 0).length})
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab("register")}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeSubTab === "register"
              ? "border-amber-500 text-amber-500"
              : "border-transparent text-slate-400 hover:text-slate-250 hover:border-slate-300"
          }`}
        >
          <Plus className="w-4 h-4" />
          Cadastrar Novo Cliente
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab("history")}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeSubTab === "history"
              ? "border-amber-500 text-amber-500"
              : "border-transparent text-slate-400 hover:text-slate-250 hover:border-slate-300"
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          Histórico de Liquidações
        </button>
      </div>

      {activeSubTab === "list" && (
        <>
          {/* 1. Filter switches & SMS Marketing Toggle */}
          <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
            
            {/* KPI quick filtering hooks */}
            <div className="flex gap-2.5 flex-wrap">
              <button
                onClick={() => setFilterType("ALL")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border ${
                  filterType === "ALL"
                    ? "bg-slate-900 border-slate-900 text-white"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                Todos os Clientes ({customers.length})
              </button>

              <button
                onClick={() => setFilterType("VIP")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border flex items-center gap-1.5 ${
                  filterType === "VIP"
                    ? "bg-amber-500 border-amber-500 text-white"
                    : "bg-white border-slate-200 text-amber-700 hover:bg-amber-50"
                }`}
              >
                <Star className="w-3.5 h-3.5" />
                VIP (Recorrentes) ({customers.filter(c => c.purchaseCount >= 10).length})
              </button>

              <button
                onClick={() => setActiveSubTab("debts")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border flex items-center gap-1.5 ${
                  activeSubTab === "debts"
                    ? "bg-red-600 border-red-600 text-white"
                    : "bg-white border-slate-200 text-red-600 hover:bg-red-50"
                }`}
              >
                <AlertCircle className="w-3.5 h-3.5" />
                Com Dívidas ({customers.filter(c => c.debt > 0).length})
              </button>

              <button
                onClick={() => setFilterType("INACTIVE")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border ${
                  filterType === "INACTIVE"
                    ? "bg-slate-500 border-slate-500 text-white"
                    : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                }`}
              >
                Inativos / Poucos Clientes ({customers.filter(c => c.purchaseCount <= 4).length})
              </button>
            </div>

            {/* Action Triggers */}
            <div className="flex gap-2.5 items-center w-full md:w-auto">
              <button
                onClick={() => setShowSmsPanel(!showSmsPanel)}
                className="flex-1 md:flex-initial bg-lime-100 hover:bg-lime-200 py-2 px-3.5 rounded-xl text-xs font-bold text-lime-850 flex items-center justify-center gap-1.5 cursor-pointer transition border border-lime-200"
              >
                <Smartphone className="w-4 h-4 text-lime-700 shrink-0" />
                Campanhas SMS Marketing
              </button>

              <button
                onClick={() => setActiveSubTab("register")}
                className="flex-1 md:flex-initial bg-orange-500 hover:bg-orange-600 py-2 px-4 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/10 cursor-pointer transition"
              >
                <Plus className="w-4 h-4" />
                Cadastrar Cliente
              </button>
            </div>

          </div>

          {/* 1B. SMS Marketing automated Campaign Assistant Panel */}
          {showSmsPanel && (
            <div className="bg-slate-55 border border-slate-200 p-5 rounded-2xl animate-in slide-in-from-top duration-200 space-y-4">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4.5 h-4.5 text-orange-500" />
                  <h3 className="font-bold text-slate-800 text-xs">Assistente Inteligente de SMS Marketing</h3>
                </div>
                <button 
                  onClick={() => { setShowSmsPanel(false); setSmsDispatchStatus("idle"); setSmsOptions([]); }}
                  className="text-slate-450 hover:text-slate-650 text-xs font-semibold"
                >
                  Fechar Painel X
                </button>
              </div>

              <p className="text-xs text-slate-500">Desenhe campanhas promocionais ou envie cobranças personalizadas de faturas para os seus clientes de Moçambique num clique de IA.</p>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                
                {/* Setting campaign guidelines */}
                <div className="md:col-span-5 bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">Público Alvo Destinatário</label>
                    <select
                      value={campaignTarget}
                      onChange={(e) => setCampaignTarget(e.target.value as any)}
                      className="w-full bg-slate-55 border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-600"
                    >
                      <option value="ALL">Todos os Clientes ({customers.length})</option>
                      <option value="VIP">Clientes Recorrentes VIP ({customers.filter(c => c.purchaseCount >= 10).length})</option>
                      <option value="DEBT">Clientes com Contas e Dívidas ({customers.filter(c => c.debt > 0).length})</option>
                      <option value="INACTIVE">Clientes Inativos ({customers.filter(c => c.purchaseCount <= 4).length})</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">Ideia / Detalhes de Ajuda para o Gemini</label>
                    <textarea
                      rows={2}
                      value={customSmsPrompt}
                      onChange={(e) => setCustomSmsPrompt(e.target.value)}
                      className="w-full bg-slate-55 border border-slate-200 rounded-lg p-2 text-xs outline-none focus:border-orange-505"
                      placeholder="Ex: Desconto de 15% em bebidas no M-Pesa ou prazos limite para dívidas..."
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleGenerateAISms}
                    disabled={isGeneratingSms}
                    className="w-full h-10 bg-slate-900 text-white hover:bg-slate-800 font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-75"
                  >
                    <Sparkles className="w-4 h-4 text-orange-400 animate-pulse" />
                    {isGeneratingSms ? "Gerando Textos com IA..." : "Gerar Textos Promocionais com IA"}
                  </button>
                </div>

                {/* Generated copy list & final trigger action */}
                <div className="md:col-span-7 bg-white p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">Selecione o Melhor Texto</span>
                    
                    {smsOptions.length === 0 ? (
                      <div className="border border-slate-100 rounded-xl bg-slate-55 p-6 text-center text-xs text-slate-400 italic mt-2">
                        Clique em "Gerar Textos..." à esquerda para obter propostas automáticas estruturadas da IA.
                      </div>
                    ) : (
                      <div className="space-y-2 mt-2">
                        {smsOptions.map((opt, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setSelectedSms(opt)}
                            className={`w-full p-2.5 rounded-lg border text-left text-xs transition relative flex items-start gap-2 ${
                              selectedSms === opt
                                ? "border-orange-400 bg-orange-50/20 text-orange-900"
                                : "border-slate-200 bg-white hover:bg-slate-55 text-slate-650"
                            }`}
                          >
                            <span className="w-5 h-5 rounded-full bg-slate-100 font-bold text-[10px] text-slate-650 flex items-center justify-center shrink-0 mt-0.5">
                              {idx + 1}
                            </span>
                            <div>
                              <p>{opt}</p>
                              <span className="text-[9.5px] text-slate-400 font-mono mt-1 block font-medium">Caracteres: {opt.length}/160</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {smsOptions.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div className="text-left">
                        <span className="text-[10px] text-slate-400 font-bold block">DISPARAR PARA:</span>
                        <span className="text-xs font-bold font-mono text-slate-800">{targetClientsCount} destinatários</span>
                      </div>

                      {smsDispatchStatus === "idle" ? (
                        <button
                          type="button"
                          onClick={handleDispatchSmsCampaign}
                          className="bg-lime-600 hover:bg-lime-700 text-white font-bold text-xs py-2 px-4 rounded-lg flex items-center gap-1 cursor-pointer transition"
                        >
                          <Send className="w-3.5 h-3.5" />
                          Emitir Campanha via Gateway SMS
                        </button>
                      ) : smsDispatchStatus === "sending" ? (
                        <div className="text-xs font-bold text-orange-600 flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full border-2 border-orange-500 border-t-transparent animate-spin"></span>
                          Disparando SMS...
                        </div>
                      ) : (
                        <div className="bg-emerald-50 text-emerald-800 text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                          Campanha SMS disparada com sucesso para {dispatchCount} contatos!
                        </div>
                      )}
                    </div>
                  )}

                </div>

              </div>
            </div>
          )}

          {/* 2. Custom Dashboard Database Grid */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col min-h-[320px]">
            
            {/* Search header tool */}
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="relative w-80">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Pesquisar por nome, contato ou NUIT tax ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-4 py-1.5 text-xs outline-none focus:border-orange-505"
                />
              </div>

              <span className="text-[10px] text-slate-400 font-mono">Fidelização active: 1 Ponto = 100 MT</span>
            </div>

            {/* Database List Table */}
            <div className="flex-1 overflow-x-auto max-h-[500px] overflow-y-auto text-[11.5px] custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wide text-[9.5px]">
                    <th className="p-3.5">FOTO</th>
                    <th className="p-3.5">CLIENTE</th>
                    <th className="p-3.5">CONTATO / EMAIL</th>
                    <th className="p-3.5">NUIT FISCAL</th>
                    <th className="p-3.5">ENDEREÇO</th>
                    <th className="p-3.5 text-right">TOTAL COMPRADO</th>
                    <th className="p-3.5 text-center">Nº DE COMPRAS</th>
                    <th className="p-3.5 text-right">DÍVIDA ATIVA</th>
                    <th className="p-3.5 text-center">LOYALTY PONTOS</th>
                    <th className="p-3.5 text-center">EXCLUIR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150">
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-400 italic colSpan-10">Nenhum cliente atendeu aos filtros selecionados.</td>
                    </tr>
                  ) : (
                    filteredCustomers.map((c) => {
                      const isVip = c.purchaseCount >= 10;
                      const hasDebt = c.debt > 0;

                      return (
                        <tr key={c.id} className="hover:bg-slate-50/45 transition">
                          <td className="p-3 text-center">
                            <span className="w-7 h-7 bg-orange-100 text-orange-850 rounded-full text-xs font-bold flex items-center justify-center">
                              {c.name.substring(0, 2).toUpperCase()}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-850">{c.name}</span>
                              {isVip && (
                                <span className="text-[8.5px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 flex items-center gap-0.5">
                                  <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                                  VIP
                                </span>
                              )}
                            </div>
                            {c.lastPurchaseDate && (
                              <span className="text-[9.5px] text-slate-400 font-mono mt-0.5 block">Último: {c.lastPurchaseDate}</span>
                            )}
                          </td>
                          <td className="p-3 font-mono text-slate-600">
                            <div>{c.phone}</div>
                            <span className="text-[10px] text-slate-400 font-sans">{c.email}</span>
                          </td>
                          <td className="p-3 font-mono text-slate-500">{c.nuit}</td>
                          <td className="p-3 text-slate-500 max-w-[150px] truncate">{c.address}</td>
                          <td className="p-3 text-right font-mono font-bold text-slate-800">{c.totalSpent.toLocaleString()} {currency}</td>
                          <td className="p-3 text-center font-mono text-slate-500">{c.purchaseCount} vezes</td>
                          <td className={`p-3 text-right font-mono text-xs font-bold ${
                            hasDebt ? "text-red-700 bg-red-50/30" : "text-slate-400"
                          }`}>
                            {c.debt > 0 ? `${c.debt.toLocaleString()} MT` : "Sem dívidas"}
                            {hasDebt && (
                              <span className="text-[8.5px] font-sans font-bold bg-red-100 text-red-700 block rounded px-1 mt-0.5 text-center leading-none">VENCIDO</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <div className="inline-flex items-center gap-1 py-0.5 px-2 bg-amber-50 rounded-full border border-amber-200">
                              <Award className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              <span className="font-mono text-xs font-bold text-amber-800">{c.loyaltyPoints}</span>
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {hasDebt && (
                                <button
                                  onClick={() => {
                                    setSettleDebtCustomer(c);
                                    setSettlementAmount(c.debt);
                                  }}
                                  className="p-1 text-slate-400 hover:text-emerald-600 rounded transition"
                                  title="Liquidar Dívida"
                                >
                                  <DollarSign className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteCustomerClick(c.id)}
                                className="p-1 text-slate-350 hover:text-red-650 rounded cursor-pointer animate-none"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeSubTab === "register" && (
        <div className="bg-white p-6 rounded-2xl max-w-lg mx-auto border border-slate-200 shadow-md space-y-5 animate-in fade-in duration-200">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Users className="w-5 h-5 text-orange-500" />
            <h3 className="font-bold text-slate-900 text-sm">Registrar Cliente no OST Vendas</h3>
          </div>

          <form onSubmit={handleSubmitCustomer} className="space-y-4 text-xs">
            {localError && (
              <div className="bg-red-500/10 text-red-500 p-2.5 rounded-lg text-xs font-semibold border border-red-500/20">
                {localError}
              </div>
            )}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Nome Completo do Cliente *</label>
              <input
                type="text"
                required
                placeholder="Ex: Carlos Tembe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-55 border border-slate-200 rounded-lg p-2.5 font-semibold outline-none focus:border-orange-500 text-slate-850"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Contacto Telefónico *</label>
                <input
                  type="tel"
                  required
                  placeholder="Ex: 847231455"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-55 border border-slate-200 rounded-lg p-2.5 font-mono font-semibold outline-none focus:border-orange-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-505 uppercase">NUIT Fiscal de Moçambique *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 142533669"
                  value={nuit}
                  onChange={(e) => setNuit(e.target.value)}
                  className="w-full bg-slate-55 border border-slate-200 rounded-lg p-2.5 font-mono font-semibold outline-none focus:border-orange-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-505 uppercase">E-mail de Notificação</label>
              <input
                type="email"
                placeholder="Ex: carlostembe@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-55 border border-slate-200 rounded-lg p-2.5 font-semibold outline-none focus:border-orange-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-505 uppercase">Endereço Residencial</label>
              <input
                type="text"
                placeholder="Ex: Av. Julius Nyerere, Maputo"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full bg-slate-55 border border-slate-200 rounded-lg p-2.5 font-semibold outline-none focus:border-orange-500 text-slate-850"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setActiveSubTab("list");
                  setLocalError("");
                }}
                className="w-1/2 py-2.5 border border-slate-200 bg-white text-slate-700 font-bold rounded-xl text-xs cursor-pointer hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="w-1/2 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs cursor-pointer"
              >
                Confirmar Cadastro
              </button>
            </div>
          </form>
        </div>
      )}

      {activeSubTab === "debts" && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <div>
                <h3 className="font-bold text-slate-800 text-lg">Gestão de Clientes com Dívidas</h3>
                <p className="text-xs text-slate-500">Controle e liquidação de contas pendentes.</p>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-red-50 p-4 rounded-xl border border-red-100">
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total em Dívida</p>
              <p className="text-2xl font-bold text-red-600 mt-1">
                {customers.filter(c => c.debt > 0).reduce((acc, c) => acc + c.debt, 0).toLocaleString()} {currency}
              </p>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Clientes Devedores</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">
                {customers.filter(c => c.debt > 0).length}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[350px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                  <th className="p-3 font-semibold rounded-tl-lg">Cliente</th>
                  <th className="p-3 font-semibold">Valor da Dívida</th>
                  <th className="p-3 font-semibold">Última Compra</th>
                  <th className="p-3 font-semibold">Dias em Atraso</th>
                  <th className="p-3 font-semibold">Estado</th>
                  <th className="p-3 font-semibold text-right rounded-tr-lg">Ação</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-100">
                {customers.filter(c => c.debt > 0).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-500">Nenhum cliente com dívida ativa no momento.</td>
                  </tr>
                ) : (
                  customers.filter(c => c.debt > 0).sort((a, b) => b.debt - a.debt).map(customer => {
                    const lastPurchaseStr = customer.lastPurchaseDate;
                    let daysDelayed = 0;
                    if (lastPurchaseStr) {
                      const lastDate = new Date(lastPurchaseStr.split('/').reverse().join('-')); // Adjust if date format is DD/MM/YYYY
                      if (!isNaN(lastDate.getTime())) {
                        daysDelayed = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
                      }
                    }
                    
                    const debtState = customer.debt > 0 && customer.settlements && customer.settlements.length > 0 
                      ? "Parcialmente Liquidada" 
                      : customer.debt > 0 ? "Ativa" : "Liquidada";

                    return (
                      <tr key={customer.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-bold text-slate-800">{customer.name}</td>
                        <td className="p-3 font-bold font-mono text-red-600">{customer.debt.toLocaleString()} {currency}</td>
                        <td className="p-3 text-slate-600">{lastPurchaseStr || "N/A"}</td>
                        <td className="p-3 font-medium text-slate-800">{daysDelayed > 0 ? `${daysDelayed} dias` : "Recente"}</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full ${
                            debtState === "Ativa" ? "bg-red-100 text-red-700" :
                            debtState === "Parcialmente Liquidada" ? "bg-orange-100 text-orange-700" : "bg-emerald-100 text-emerald-700"
                          }`}>
                            {debtState}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => {
                              setSettleDebtCustomer(customer);
                              setSettlementAmount(customer.debt);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-xs font-bold transition-colors ml-auto cursor-pointer"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            Liquidar Dívida
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === "history" && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-amber-500" />
              <div>
                <h3 className="font-bold text-slate-800">Histórico de Liquidações</h3>
                <p className="text-xs text-slate-500">Registo global de amortizações e pagamentos de dívidas efetuados pelos clientes.</p>
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto max-h-[350px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 uppercase text-[10px] font-bold text-slate-500 tracking-wider">
                  <th className="p-3 border-b border-slate-200">Data e Hora</th>
                  <th className="p-3 border-b border-slate-200">Cliente</th>
                  <th className="p-3 border-b border-slate-200">Método de Liquidação</th>
                  <th className="p-3 border-b border-slate-200 text-right">Valor Pago (MT)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.flatMap(c => 
                  (c.settlements || []).map(s => ({...s, customerName: c.name}))
                ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(settlement => (
                  <tr key={settlement.id} className="hover:bg-slate-50/50 transition">
                    <td className="p-3 text-xs text-slate-600">
                      {new Date(settlement.date).toLocaleString()}
                    </td>
                    <td className="p-3 text-xs font-semibold text-slate-800">
                      {settlement.customerName}
                    </td>
                    <td className="p-3">
                      <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide">
                        {settlement.method}
                      </span>
                    </td>
                    <td className="p-3 text-xs font-mono font-bold text-slate-800 text-right">
                      {settlement.amount.toLocaleString()} MT
                    </td>
                  </tr>
                ))}
                {customers.flatMap(c => c.settlements || []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-slate-500 text-xs">
                      Nenhum histórico de liquidação encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Debt Settlement Modal */}
      {settleDebtCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="bg-emerald-500 p-4 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg">Liquidar Dívida Pendente</h3>
                <p className="text-emerald-50 text-xs mt-0.5">Operação de regularização financeira</p>
              </div>
              <DollarSign className="w-6 h-6 opacity-80" />
            </div>

            <form onSubmit={handleSettleDebt} className="p-5 space-y-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-semibold">Cliente</p>
                  <p className="font-bold text-slate-800">{settleDebtCustomer.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500 font-semibold">Dívida Total</p>
                  <p className="font-bold font-mono text-red-600">{settleDebtCustomer.debt.toLocaleString()} {currency}</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-700">Valor a Liquidar (MT)</label>
                  <button 
                    type="button"
                    onClick={() => setSettlementAmount(settleDebtCustomer.debt)}
                    className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 hover:bg-emerald-100 font-bold uppercase tracking-wide cursor-pointer"
                  >
                    Liquidar Totalmente
                  </button>
                </div>
                <input
                  type="number"
                  required
                  min="1"
                  max={settleDebtCustomer.debt}
                  step="0.01"
                  autoFocus
                  value={settlementAmount}
                  onChange={(e) => setSettlementAmount(e.target.value ? Number(e.target.value) : "")}
                  className="w-full text-lg font-mono font-bold text-emerald-700 border-2 border-slate-200 rounded-xl p-3 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all"
                  placeholder="0.00"
                />
                {settlementAmount && settlementAmount < settleDebtCustomer.debt && (
                  <p className="text-[10px] text-orange-600 font-medium">
                    Liquidação Parcial. Saldo remanescente será: <span className="font-bold">{(settleDebtCustomer.debt - Number(settlementAmount)).toLocaleString()} {currency}</span>
                  </p>
                )}
                {settlementAmount === settleDebtCustomer.debt && (
                  <p className="text-[10px] text-emerald-600 font-medium font-bold">
                    Liquidação Total efetuada. Dívida será encerrada.
                  </p>
                )}
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setSettleDebtCustomer(null);
                    setSettlementAmount("");
                  }}
                  disabled={isSettling}
                  className="flex-1 py-2.5 font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSettling || !settlementAmount}
                  className="flex-1 py-2.5 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl text-xs shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSettling ? (
                    <>
                      <span className="w-3 h-3 rounded-full border-2 border-white/40 border-t-white animate-spin"></span>
                      Processando...
                    </>
                  ) : (
                    <>
                      Confirmar Liquidação
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
