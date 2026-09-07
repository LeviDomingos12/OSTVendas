import React from "react";
import { 
  UserCheck, 
  DollarSign, 
  Plus, 
  Search, 
  SlidersHorizontal, 
  ArrowUpDown, 
  Grid, 
  List, 
  Table as TableIcon, 
  Lock, 
  Edit3, 
  KeyRound, 
  History, 
  Trash2, 
  ChevronRight 
} from "lucide-react";
import { Employee, UserRole } from "../../types";

export interface RecoveryRequest {
  id: string;
  employeeName: string;
  type: "PIN" | "PASSWORD";
  email?: string;
  timestamp: string;
  status: "PENDENTE" | "RESOLVIDO";
}

export interface StaffStats {
  total: number;
  activeCount: number;
  totalSalarySheet: number;
  hiredThisMonth: number;
}

export interface StaffListTabProps {
  recoveryRequests: RecoveryRequest[];
  onResetPasswordFromRequest: (req: RecoveryRequest) => void;
  onResolveRecoveryRequest: (id: string) => void;
  staffStats: StaffStats;
  currency: string;
  currentRole: UserRole;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  roleFilter: string;
  setRoleFilter: (role: string) => void;
  sortBy: "name" | "date" | "salary" | "role";
  setSortBy: (sort: "name" | "date" | "salary" | "role") => void;
  viewMode: "cards" | "list" | "table";
  setViewMode: (mode: "cards" | "list" | "table") => void;
  filteredEmployees: Employee[];
  selectedEmployees: string[];
  toggleSelectEmployee: (id: string) => void;
  toggleSelectAll: () => void;
  openEmployeeDrawer: (emp: Employee) => void;
  openEditModal: (emp: Employee, e: React.MouseEvent) => void;
  openPermissionsModal: (emp: Employee, e: React.MouseEvent) => void;
  handleResetCredentialsDirectly: (emp: Employee) => void;
  handleDeleteEmployee: (emp: Employee) => void;
}

export const StaffListTab: React.FC<StaffListTabProps> = ({
  recoveryRequests,
  onResetPasswordFromRequest,
  onResolveRecoveryRequest,
  staffStats,
  currency,
  currentRole,
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  roleFilter,
  setRoleFilter,
  sortBy,
  setSortBy,
  viewMode,
  setViewMode,
  filteredEmployees,
  selectedEmployees,
  toggleSelectEmployee,
  toggleSelectAll,
  openEmployeeDrawer,
  openEditModal,
  openPermissionsModal,
  handleResetCredentialsDirectly,
  handleDeleteEmployee
}) => {
  return (
    <div className="space-y-6">
      {/* NOTIFICAÇÕES DE RECUPERAÇÃO DE SENHA */}
      {recoveryRequests.filter(req => req.status === "PENDENTE").length > 0 && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4.5 space-y-3.5 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between border-b border-amber-100 pb-2">
            <p className="font-extrabold text-slate-800 text-xs flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
              </span>
              Solicitações de Recuperação de Senha / PIN Pendentes ({recoveryRequests.filter(req => req.status === "PENDENTE").length})
            </p>
            <span className="text-[10px] bg-amber-100 text-amber-800 py-0.5 px-2 rounded-full font-bold uppercase tracking-wide">Ação Necessária</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {recoveryRequests.filter(req => req.status === "PENDENTE").map((req) => (
              <div key={req.id} className="bg-white p-3 rounded-xl border border-amber-200/60 shadow-sm flex flex-col justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex justify-between items-start gap-2">
                    <strong className="text-slate-900 font-bold text-xs">{req.employeeName}</strong>
                    <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md uppercase ${
                      req.type === "PIN" ? "bg-orange-50 text-orange-600 border border-orange-100" : "bg-blue-50 text-blue-600 border border-blue-100"
                    }`}>
                      {req.type === "PIN" ? "PIN do Terminal" : "Senha de Login"}
                    </span>
                  </div>
                  {req.email && <p className="text-[10px] text-slate-500 font-medium font-mono">{req.email}</p>}
                  <p className="text-[9px] text-slate-400 font-medium">Solicitado em: {new Date(req.timestamp).toLocaleString("pt-PT")}</p>
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                  <button
                    onClick={() => onResetPasswordFromRequest(req)}
                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold py-1.5 px-3.5 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition shadow-sm"
                  >
                    <Lock className="w-3.5 h-3.5 shrink-0" />
                    Resetar Senha / PIN
                  </button>
                  
                  <button
                    onClick={() => {
                      if (confirm("Deseja marcar esta solicitação como resolvida sem alterar as credenciais?")) {
                        onResolveRecoveryRequest(req.id);
                      }
                    }}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 text-[10px] font-bold py-1.5 px-3 rounded-lg cursor-pointer transition"
                  >
                    Descartar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* STATS BENTO GRIDS (ITEM 4) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white p-4.5 rounded-2xl border border-slate-150 shadow-sm flex items-center justify-between hover:shadow-md transition">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Funcionários</span>
            <span className="text-xl font-extrabold text-slate-800">{staffStats.total}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center border border-orange-100">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-150 shadow-sm flex items-center justify-between hover:shadow-md transition">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Ativos</span>
            <span className="text-xl font-extrabold text-emerald-600">{staffStats.activeCount}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-500 flex items-center justify-center border border-emerald-100">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-150 shadow-sm flex items-center justify-between hover:shadow-md transition">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Folha Salarial</span>
            <span className="text-xl font-extrabold text-slate-800">{(staffStats.totalSalarySheet).toLocaleString()} <span className="text-xs font-bold text-slate-400">{currency}</span></span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center border border-blue-100">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-150 shadow-sm flex items-center justify-between hover:shadow-md transition">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Novos Este Mês</span>
            <span className="text-xl font-extrabold text-orange-600">{staffStats.hiredThisMonth}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-500 flex items-center justify-center border border-purple-100">
            <Plus className="w-5 h-5" />
          </div>
        </div>

      </div>

      {/* FILTERS & SEARCH CONTROLS (ITEMS 2 & 3 & 9) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row gap-4 items-center justify-between">
        
        {/* Search Input */}
        <div className="relative w-full lg:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Pesquisar por nome, cargo, telefone, ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-1.5 text-xs outline-none focus:ring-1 focus:ring-orange-400/50 font-medium transition"
          />
        </div>

        {/* Select controls */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-start lg:justify-end">
          
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border text-slate-700 rounded-xl py-1.5 px-3 text-xs outline-none cursor-pointer font-bold border-slate-200"
            >
              <option value="Todos">Todos</option>
              <option value="Ativos">Ativos</option>
              <option value="Suspensos">Suspensos</option>
              <option value="Desativados">Desativados</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cargo:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-slate-50 border text-slate-700 rounded-xl py-1.5 px-3 text-xs outline-none cursor-pointer font-bold border-slate-200"
            >
              <option value="Todos">Todos</option>
              <option value="Administrador">Administrador</option>
              <option value="Supervisor">Supervisor</option>
              <option value="Caixa">Caixa / Operador</option>
              <option value="Armazém">Armazém / Stock</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ordenar:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "name" | "date" | "salary" | "role")}
              className="bg-slate-50 border text-slate-700 rounded-xl py-1.5 px-3 text-xs outline-none cursor-pointer font-bold border-slate-200"
            >
              <option value="name">Nome</option>
              <option value="date">Data de Admissão</option>
              <option value="salary">Salário</option>
              <option value="role">Cargo</option>
            </select>
          </div>

          {/* View switches */}
          <div className="flex bg-slate-100 rounded-lg p-0.5 border border-slate-200 gap-1 ml-2">
            <button
              onClick={() => setViewMode("cards")}
              className={`p-1.5 rounded-md cursor-pointer transition ${viewMode === "cards" ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-650"}`}
              title="Visualizar em Cartões"
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-md cursor-pointer transition ${viewMode === "list" ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-650"}`}
              title="Visualizar em Lista"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded-md cursor-pointer transition ${viewMode === "table" ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-650"}`}
              title="Visualizar em Tabela"
            >
              <TableIcon className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>

      </div>

      {/* EMPLOYEES GRID/LIST/TABLE SELECTION DISPLAY */}
      {filteredEmployees.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 font-sans text-xs text-slate-400">
          Nenhum colaborador corresponde aos critérios de pesquisa selecionados.
        </div>
      ) : viewMode === "cards" ? (
        
        /* CARDS VIEW - COMPACT DESIGN */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4.5">
          {filteredEmployees.map((emp) => {
            const isSelected = selectedEmployees.includes(emp.id);
            return (
              <div 
                key={emp.id} 
                onClick={() => openEmployeeDrawer(emp)}
                className={`bg-white p-4.5 rounded-2xl border transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer relative overflow-hidden group hover:border-orange-200 ${
                  isSelected ? "ring-2 ring-orange-500 border-orange-500" : "border-slate-200"
                }`}
              >
                
                {/* Discret selection checkbox */}
                <div 
                  onClick={(e) => { e.stopPropagation(); toggleSelectEmployee(emp.id); }}
                  className={`absolute top-4 left-4 w-4.5 h-4.5 rounded-md border flex items-center justify-center transition-all ${
                    isSelected ? "bg-orange-500 border-orange-500 text-white" : "border-slate-300 hover:border-orange-400"
                  }`}
                >
                  {isSelected && <span className="text-[10px] font-bold">✓</span>}
                </div>

                {/* Discrete Status Circle */}
                <div className="absolute top-4 right-4 flex items-center gap-1.5 text-[10px] font-bold font-mono">
                  <span className={`w-2 h-2 rounded-full ${
                    emp.status === "ACTIVE" 
                      ? "bg-emerald-500" 
                      : emp.status === "SUSPENDED" 
                      ? "bg-amber-500 animate-pulse" 
                      : "bg-slate-400"
                  }`}></span>
                  <span className="text-slate-400 uppercase text-[9px]">
                    {emp.status === "ACTIVE" ? "Ativo" : emp.status === "SUSPENDED" ? "Suspenso" : "Desativo"}
                  </span>
                </div>

                {/* Card Header Profile & Initials backup */}
                <div className="flex gap-3 items-center mt-4">
                  {emp.admissionDate === "HAS_AVATAR" ? (
                    <img 
                      src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${emp.name}`} 
                      alt={emp.name} 
                      className="w-10 h-10 rounded-xl bg-orange-50 object-cover border border-orange-100"
                    />
                  ) : (
                    <span className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-extrabold text-xs border border-slate-200 uppercase group-hover:bg-orange-500 group-hover:text-white transition-colors duration-200">
                      {emp.name.substring(0, 2).toUpperCase()}
                    </span>
                  )}
                  <div className="truncate">
                    <h4 className="font-extrabold text-slate-800 text-xs leading-none mb-1 group-hover:text-orange-600 transition-colors">{emp.name}</h4>
                    <span className="text-[10px] font-medium text-slate-400 font-mono bg-slate-100 border px-1.5 py-0.5 rounded leading-none">{emp.role}</span>
                  </div>
                </div>

                {/* Compact Details */}
                <div className="border-t border-slate-100 mt-3 pt-3.5 grid grid-cols-3 gap-2 text-[10px] text-slate-500">
                  <div>
                    <span className="block text-slate-400">Telefone</span>
                    <span className="font-semibold text-slate-700 block mt-0.5">{emp.contact}</span>
                  </div>
                  <div>
                    <span className="block text-slate-400">Salário Base</span>
                    <span className="font-extrabold text-slate-800 block mt-0.5">{(emp.salary).toLocaleString()} MT</span>
                  </div>
                  <div>
                    <span className="block text-slate-400">Admissão</span>
                    <span className="font-mono text-slate-600 block mt-0.5">{emp.admissionDate || "10 Jan 2024"}</span>
                  </div>
                </div>

                {/* Quick actions row */}
                <div className="border-t border-slate-100/70 mt-3.5 pt-2.5 flex items-center justify-end gap-2.5 opacity-40 group-hover:opacity-100 transition-all">
                  <button 
                    onClick={(e) => openEditModal(emp, e)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition transform hover:scale-115 cursor-pointer"
                    title="Editar Detalhes"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={(e) => openPermissionsModal(emp, e)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-blue-600 transition transform hover:scale-115 cursor-pointer"
                    title="Modificar Permissões"
                  >
                    <Lock className="w-3.5 h-3.5" />
                  </button>
                  {(currentRole === "ADMIN" || currentRole === "SUPERVISOR") && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleResetCredentialsDirectly(emp); }}
                      className="p-1.5 rounded-lg hover:bg-amber-50 text-slate-500 hover:text-amber-600 transition transform hover:scale-115 cursor-pointer"
                      title="Resetar Senha / PIN"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button 
                    onClick={(e) => { e.stopPropagation(); openEmployeeDrawer(emp); }}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-orange-500 transition transform hover:scale-115 cursor-pointer"
                    title="Ver Histórico Completo"
                  >
                    <History className="w-3.5 h-3.5" />
                  </button>
                  {currentRole === "ADMIN" && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeleteEmployee(emp); }}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition transform hover:scale-115 cursor-pointer"
                      title="Remover Colaborador"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

              </div>
            );
          })}
        </div>

      ) : viewMode === "list" ? (
        
        /* LIST VIEW DESIGN */
        <div className="space-y-2">
          {filteredEmployees.map((emp) => {
            const isSelected = selectedEmployees.includes(emp.id);
            return (
              <div 
                key={emp.id}
                onClick={() => openEmployeeDrawer(emp)}
                className={`bg-white p-3 rounded-xl border flex items-center justify-between gap-4 cursor-pointer hover:border-orange-200 transition shadow-sm ${
                  isSelected ? "ring-1 ring-orange-500 border-orange-500 bg-orange-50/10" : "border-slate-200"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div 
                    onClick={(e) => { e.stopPropagation(); toggleSelectEmployee(emp.id); }}
                    className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                      isSelected ? "bg-orange-500 border-orange-500 text-white" : "border-slate-300"
                    }`}
                  >
                    {isSelected && <span className="text-[9px] font-bold">✓</span>}
                  </div>

                  <span className="w-8 h-8 rounded-lg bg-slate-150 text-slate-700 flex items-center justify-center font-extrabold text-xs border uppercase">
                    {emp.name.substring(0, 2).toUpperCase()}
                  </span>

                  <div>
                    <h4 className="font-bold text-slate-800 text-xs">{emp.name}</h4>
                    <span className="text-[10px] font-mono text-slate-400">{emp.role}</span>
                  </div>
                </div>

                <div className="flex items-center gap-6 text-[11px] font-mono">
                  <div>
                    <span className="text-slate-400 mr-2">Contacto:</span>
                    <span className="font-semibold text-slate-700">{emp.contact}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 mr-2">Vencimento:</span>
                    <span className="font-extrabold text-slate-800">{(emp.salary).toLocaleString()} MT</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${emp.status === 'ACTIVE' ? 'bg-emerald-500' : emp.status === 'SUSPENDED' ? 'bg-amber-500' : 'bg-slate-300'}`}></span>
                    <span className="text-slate-500 capitalize text-[10px]">
                      {emp.status === 'ACTIVE' ? 'Ativo' : emp.status === 'SUSPENDED' ? 'Suspenso' : 'Desativo'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button 
                    onClick={(e) => openEditModal(emp, e)}
                    className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
                    title="Editar Detalhes"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  {currentRole === "ADMIN" && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeleteEmployee(emp); }}
                      className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition cursor-pointer"
                      title="Remover Colaborador"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {(currentRole === "ADMIN" || currentRole === "SUPERVISOR") && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleResetCredentialsDirectly(emp); }}
                      className="p-1 rounded hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition cursor-pointer font-bold"
                      title="Resetar Senha / PIN"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button 
                    onClick={(e) => { e.stopPropagation(); openEmployeeDrawer(emp); }}
                    className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-orange-500 transition"
                    title="Ver Histórico Completo"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

      ) : (
        
        /* TABLE VIEW DESIGN */
        <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto max-h-[500px] overflow-y-auto shadow-sm custom-scrollbar">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[9px] font-mono">
                <th className="p-3 w-10">
                  <input 
                    type="checkbox" 
                    checked={selectedEmployees.length > 0 && selectedEmployees.length === filteredEmployees.length}
                    onChange={toggleSelectAll}
                    className="cursor-pointer"
                  />
                </th>
                <th className="p-3">NOME DO COLABORADOR</th>
                <th className="p-3">CARGO</th>
                <th className="p-3">CONTACTO</th>
                <th className="p-3 text-right">SALÁRIO BRUTO</th>
                <th className="p-3">DATA ADMISSÃO</th>
                <th className="p-3 text-center">ESTADO</th>
                <th className="p-3 text-right">ACÇÕES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEmployees.map((emp) => {
                const isSelected = selectedEmployees.includes(emp.id);
                return (
                  <tr 
                    key={emp.id} 
                    onClick={() => openEmployeeDrawer(emp)}
                    className={`hover:bg-slate-50/50 cursor-pointer transition ${isSelected ? "bg-orange-50/10" : ""}`}
                  >
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectEmployee(emp.id)}
                        className="cursor-pointer"
                      />
                    </td>
                    <td className="p-3 font-bold text-slate-800">{emp.name}</td>
                    <td className="p-3 text-slate-500 font-medium">{emp.role}</td>
                    <td className="p-3 text-slate-600 font-mono">{emp.contact}</td>
                    <td className="p-3 text-right font-extrabold text-slate-800 font-mono">{(emp.salary).toLocaleString()} MT</td>
                    <td className="p-3 text-slate-450 font-mono">{emp.admissionDate || "2024-01-10"}</td>
                    <td className="p-3 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                        emp.status === "ACTIVE" 
                          ? "bg-emerald-50 text-emerald-700" 
                          : emp.status === "SUSPENDED" 
                          ? "bg-amber-50 text-amber-700" 
                          : "bg-slate-100 text-slate-600"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${emp.status === 'ACTIVE' ? 'bg-emerald-500' : emp.status === 'SUSPENDED' ? 'bg-amber-500' : 'bg-slate-400'}`}></span>
                        {emp.status === 'ACTIVE' ? 'Ativo' : emp.status === 'SUSPENDED' ? 'Suspenso' : 'Inativo'}
                      </span>
                    </td>
                    <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={(e) => openEditModal(emp, e)}
                          className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-800 transition cursor-pointer"
                          title="Editar Detalhes"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={(e) => openPermissionsModal(emp, e)}
                          className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-blue-600 transition cursor-pointer"
                          title="Modificar Permissões"
                        >
                          <Lock className="w-3.5 h-3.5" />
                        </button>
                        {currentRole === "ADMIN" && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteEmployee(emp); }}
                            className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-600 transition cursor-pointer"
                            title="Remover Colaborador"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {(currentRole === "ADMIN" || currentRole === "SUPERVISOR") && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleResetCredentialsDirectly(emp); }}
                            className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-amber-600 transition cursor-pointer"
                            title="Resetar Senha / PIN"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button 
                          onClick={() => openEmployeeDrawer(emp)}
                          className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-orange-500 transition cursor-pointer"
                          title="Ver Histórico Completo"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
