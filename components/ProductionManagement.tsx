import React, { useState, useEffect } from 'react';
import type { Page, Customer, CommercialOrder, User, Partner } from '../types';
import { insertItem, deleteItem, updateItem } from '../services/supabaseService';
import { OrderItemsEditor } from './OrderItemsEditor';
import { OrderPrintView } from './OrderPrintView';

interface OrderManagementProps {
    setPage: (page: Page) => void;
    customers: Customer[];
    commercialOrders: CommercialOrder[];
    currentUser: User | null;
    activeBrandingPartner?: Partner | null;
}

export const ProductionManagement: React.FC<OrderManagementProps> = ({ setPage, customers, commercialOrders, currentUser, activeBrandingPartner }) => {
    const [search, setSearch] = useState('');
    const [orderBy, setOrderBy] = useState<'id' | 'clientCode'>('id');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState<CommercialOrder | null>(null);
    const [printingOrder, setPrintingOrder] = useState<CommercialOrder | null>(null);
    
    // View Project Modal
    const [isViewProjectModalOpen, setIsViewProjectModalOpen] = useState(false);
    const [orderToView, setOrderToView] = useState<CommercialOrder | null>(null);
    const [viewMode, setViewMode] = useState<'detalhado' | 'resumo'>('detalhado');

    // Form fields for New Order
    const [clientSearchTerm, setClientSearchTerm] = useState('');
    const [selectedClient, setSelectedClient] = useState<Customer | null>(null);
    const [newId, setNewId] = useState('');
    const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
    const [newSalesperson, setNewSalesperson] = useState('');
    const [newPrice, setNewPrice] = useState('');
    const [newStatus, setNewStatus] = useState('Em Produção');
    const [searchError, setSearchError] = useState('');
    const [newObservations, setNewObservations] = useState('');
    
    const [isAuthorizeModalOpen, setIsAuthorizeModalOpen] = useState(false);
    const [orderToAuthorize, setOrderToAuthorize] = useState<CommercialOrder | null>(null);
    const [authorizeDate, setAuthorizeDate] = useState('');
    const [authorizeTime, setAuthorizeTime] = useState('');

    const [isFinishReadingModalOpen, setIsFinishReadingModalOpen] = useState(false);
    const [orderToFinishReading, setOrderToFinishReading] = useState<CommercialOrder | null>(null);
    const [jsonContent, setJsonContent] = useState('');

    const handleSearchClient = () => {
        setSearchError('');
        if (!clientSearchTerm.trim()) {
            setSearchError('Digite algo para buscar.');
            return;
        }

        const term = clientSearchTerm.toLowerCase().trim();
        
        // Tratar caso especial do consumidor balcão
        if (term === '1001' || term === 'consumidor balcao' || term === 'consumidor balcão') {
            setSelectedClient({
                id: '1001',
                code: '1001',
                name: 'CONSUMIDOR BALCAO',
                customerType: 'Pessoa Física',
                document1: '000.000.000-00',
                document2: '',
                phone: '',
                email: '',
                addressMain: '',
                addressDelivery: '',
                addressBilling: '',
                createdAt: new Date().toISOString()
            });
            return;
        }

        const found = customers.find(c => 
            (c.code && c.code.toLowerCase() === term) ||
            (c.name && c.name.toLowerCase().includes(term)) ||
            (c.document1 && c.document1.replace(/\D/g, '') === term.replace(/\D/g, '')) ||
            (c.document2 && c.document2.toLowerCase().includes(term))
        );

        if (found) {
            setSelectedClient(found);
        } else {
            setSelectedClient(null);
            setSearchError('Cliente não encontrado.');
        }
    };

    const handleCreateOrder = async () => {
        if (!selectedClient) {
            setSearchError('Selecione um cliente primeiro.');
            return;
        }

        // Encontrar o maior número de pedido atual
        const maxId = commercialOrders.reduce((max, q) => {
            const num = parseInt(q.orderNumber, 10);
            return isNaN(num) ? max : Math.max(max, num);
        }, 0);
        const nextId = String(maxId + 1).padStart(7, '0');

        // Formatar data de hoje para o banco (YYYY-MM-DD)
        const today = new Date().toISOString().split('T')[0];

        const newQuote = {
            orderNumber: nextId,
            date: today,
            salesperson: (currentUser?.name || currentUser?.username || 'SISTEMA').toUpperCase(),
            clientCode: selectedClient.code || '1001',
            clientName: selectedClient.name,
            clientCity: selectedClient.addressMain || '',
            clientObs: newObservations.trim() ? `OBS: ${newObservations.trim()}` : '',
            price: 0.00,
            status: 'Orçamento',
            history: [{
                date: new Date().toISOString(),
                user: (currentUser?.name || currentUser?.username || 'SISTEMA').toUpperCase(),
                action: 'Orçamento iniciado'
            }]
        };

        try {
            await insertItem<CommercialOrder>('commercial_orders', newQuote);
        } catch (error) {
            console.error("Erro ao criar orçamento:", error);
            setSearchError("Erro ao criar orçamento. Tente novamente.");
            return;
        }
        
        // Reset states and close
        setIsAddModalOpen(false);
        setSearch('');
        setSelectedClient(null);
        setSearchError('');
        setNewObservations('');
    };

    const handleDeleteOrder = async (id: string) => {
        if (window.confirm('Tem certeza que deseja excluir este pedido?')) {
            try {
                await deleteItem('commercial_orders', id);
            } catch (error) {
                console.error('Erro ao excluir pedido:', error);
                alert('Erro ao excluir pedido.');
            }
        }
    };

    const handleApproveOrder = async () => {
        if (!orderToAuthorize) return;
        if (!authorizeDate || !authorizeTime) {
            alert('Por favor, informe a data e hora do término da leitura.');
            return;
        }
        
        const [year, month, day] = authorizeDate.split('-');
        const deadline = `${day}/${month}/${year} às ${authorizeTime}`;

        // Get current date/time for startedAt
        const now = new Date();
        const startedAt = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth()+1).toString().padStart(2, '0')}/${now.getFullYear()} às ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        try {
            await updateItem('commercial_orders', orderToAuthorize.id!, { 
                status: 'Em processo de leitura',
                engineeringDeadline: deadline,
                readingStartedAt: startedAt
            });
            setIsAuthorizeModalOpen(false);
            setOrderToAuthorize(null);
            setAuthorizeDate('');
            setAuthorizeTime('');
        } catch (error) {
            console.error('Erro ao autorizar pedido:', error);
            alert('Erro ao autorizar pedido.');
        }
    };

    const handleFinishReading = async () => {
        if (!orderToFinishReading) return;
        if (!jsonContent.trim()) {
            alert('Por favor, cole o conteúdo JSON do projeto.');
            return;
        }

        let parsedData;
        try {
            parsedData = JSON.parse(jsonContent);
        } catch (e) {
            alert('JSON inválido. Por favor, verifique o conteúdo.');
            return;
        }

        const now = new Date();
        const finishedAt = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth()+1).toString().padStart(2, '0')}/${now.getFullYear()} às ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        try {
            await updateItem('commercial_orders', orderToFinishReading.id!, { 
                status: 'Leitura Finalizada, aguardo setor de produção',
                projectData: parsedData,
                readingFinishedAt: finishedAt
            });
            setIsFinishReadingModalOpen(false);
            setOrderToFinishReading(null);
            setJsonContent('');
        } catch (error) {
            console.error('Erro ao finalizar leitura:', error);
            alert('Erro ao finalizar leitura.');
        }
    };

    const getRowClass = (status?: string) => {
        if (!status) return 'bg-emerald-50/70 border-b border-emerald-100 hover:bg-emerald-100/50 text-slate-800';
        const clean = status.toLowerCase();
        
        if (clean === 'orçamento vazio' || clean === 'orçamento incompleto') {
            return 'bg-red-50/70 border-b border-red-100 hover:bg-red-100/50 text-slate-800';
        }
        if (clean === 'preço desatualizado') {
            return 'bg-amber-50/70 border-b border-amber-100 hover:bg-amber-100/50 text-slate-800';
        }
        if (clean === 'em processo de leitura') {
            return 'bg-orange-100 border-b-2 border-orange-400 hover:bg-orange-200 text-slate-900 font-medium shadow-sm';
        }
        if (clean === 'leitura finalizada, aguardo setor de produção') {
            return 'bg-orange-100 border-b-2 border-orange-400 hover:bg-orange-200 text-slate-900 font-medium shadow-sm';
        }
        if (clean === 'aguardando engenharia') {
            return 'bg-green-200 border-b-2 border-green-400 hover:bg-green-300 text-slate-900 font-medium shadow-sm';
        }
        if (clean === 'autorizado engenharia' || clean === 'pedido autorizado') {
            return 'bg-emerald-100 border-b-2 border-emerald-300 hover:bg-emerald-200 text-slate-900 font-medium shadow-sm';
        }
        return 'bg-emerald-50/70 border-b border-emerald-100 hover:bg-emerald-100/50 text-slate-800';
    };

    const isGestor = currentUser?.role === 'gestor' || currentUser?.role === 'admin';
    const baseOrders = (commercialOrders || []).filter(o => {
        // Apenas mostra os pedidos (onde status não é 'orçamento')
        if (o.status?.toLowerCase().includes('orçamento')) return false;

        if (!isGestor) {
            const userName = (currentUser?.name || currentUser?.username || '').toUpperCase();
            const orderSalesperson = (o.salesperson || '').toUpperCase();
            if (orderSalesperson !== userName) {
                return false;
            }
        }

        if (search.trim()) {
            const term = search.toLowerCase().trim();
            const matchesSearch = 
                (o.orderNumber && String(o.orderNumber).toLowerCase().includes(term)) ||
                (o.clientName && o.clientName.toLowerCase().includes(term)) ||
                (o.clientCode && String(o.clientCode).toLowerCase().includes(term)) ||
                (o.salesperson && o.salesperson.toLowerCase().includes(term));
            
            if (!matchesSearch) return false;
        }

        return true;
    });

    const totalPedidos = baseOrders.length;

    if (editingOrder) {
        return (
            <OrderItemsEditor
                order={editingOrder}
                onClose={() => setEditingOrder(null)}
                onSaveSuccess={() => {
                    // It will automatically refresh due to Realtime subscriptions
                }}
            />
        );
    }

    return (
        <div className="p-4 md:p-8 space-y-6">
            {/* Top Navigation with Mini Dashboard */}
            <div className="flex items-center justify-between no-print">
                <div className="flex items-center gap-8">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                            <span className="text-4xl">📝</span>
                            Gestão de Produção
                        </h1>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">MSM SISTEMAS • SETOR DE PRODUÇÃO</p>
                    </div>

                    {/* Mini Dashboard KPIs */}
                    <div className="flex gap-3">
                        <div className="bg-white border border-slate-200 shadow-sm rounded-xl px-5 py-2 flex flex-col items-center justify-center min-w-[120px]">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pedidos Ativos</span>
                            <span className="text-2xl font-black text-emerald-600">{totalPedidos}</span>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3">
                    {/* Botões de atalho omitidos para o setor de produção */}
                </div>
            </div>

            {/* Classification & Search Bar */}
            <div className="bg-white p-5 rounded-2xl border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
                <div className="flex flex-wrap items-center gap-6">
                    <div className="flex items-center gap-2">
                        <input 
                            type="radio" 
                            id="order-budget"
                            name="orderBy"
                            checked={orderBy === 'id'}
                            onChange={() => setOrderBy('id')}
                            className="accent-sky-600 w-4 h-4 cursor-pointer"
                        />
                        <label htmlFor="order-budget" className="text-xs font-bold text-slate-700 uppercase cursor-pointer">Classificar por Nº de Orçamento</label>
                    </div>
                    <div className="flex items-center gap-2">
                        <input 
                            type="radio" 
                            id="order-client"
                            name="orderBy"
                            checked={orderBy === 'clientCode'}
                            onChange={() => setOrderBy('clientCode')}
                            className="accent-sky-600 w-4 h-4 cursor-pointer"
                        />
                        <label htmlFor="order-client" className="text-xs font-bold text-slate-700 uppercase cursor-pointer">Classificar por Cód. Cliente</label>
                    </div>
                </div>

                <div className="flex items-center gap-2.5 max-w-md w-full">
                    <input 
                        type="text" 
                        placeholder="Pesquisar orçamento, cliente ou vendedor..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="flex-grow p-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    <button className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider">
                        Pesquisar
                    </button>
                </div>
            </div>

            {/* Quotes Table List */}
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden no-print">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-800 text-white">
                                <th className="p-4 text-center font-bold text-xs uppercase w-20">Nº</th>
                                <th className="p-4 text-center font-bold text-xs uppercase w-24">Data</th>
                                <th className="p-4 text-center font-bold text-xs uppercase w-28">Vendedor</th>
                                <th className="p-4 font-bold text-xs uppercase">Cliente</th>
                                <th className="p-4 text-center font-bold text-xs uppercase w-32">Status</th>
                                <th className="p-4 text-center font-bold text-xs uppercase w-36">Preço</th>
                                <th className="p-4 text-center font-bold text-xs uppercase w-48">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[...baseOrders].sort((a, b) => {
                                if (orderBy === 'id') {
                                    return String(b.orderNumber || '').localeCompare(String(a.orderNumber || ''));
                                }
                                return String(a.clientCode || '').localeCompare(String(b.clientCode || ''));
                            }).map((q) => {
                                // Formatar a data para o padrão BR caso venha como YYYY-MM-DD
                                const formattedDate = (q.date && String(q.date).includes('-')) 
                                    ? String(q.date).split('-').reverse().join('/') 
                                    : (q.date || '');

                                return (
                                    <tr key={q.id} className={`${getRowClass(q.status)} transition-colors`}>
                                        <td className="p-4 text-center font-black text-slate-900 text-sm">{q.orderNumber}</td>
                                        <td className="p-4 text-center font-bold text-slate-600 text-xs">{formattedDate}</td>
                                        <td className="p-4 text-center font-bold text-slate-700 text-xs">{q.salesperson}</td>
                                        <td className="p-4">
                                            <div className="flex flex-col">
                                                <span className="font-extrabold text-slate-950 text-xs uppercase">
                                                    ({q.clientCode}) {q.clientName}
                                                </span>
                                                <span className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">{q.clientCity}</span>
                                                {q.clientObs && <span className="text-[9px] font-semibold text-sky-600 mt-1 italic">{q.clientObs}</span>}
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            {q.status?.toLowerCase() === 'aguardando engenharia' ? (
                                                <div className="bg-red-500 text-white text-[10px] font-black uppercase px-2 py-1 rounded-full animate-pulse whitespace-nowrap shadow-md border border-red-600">
                                                    Aguardando Eng.
                                                </div>
                                            ) : q.status?.toLowerCase() === 'em processo de leitura' ? (
                                                <div className="flex flex-col items-center">
                                                    <span className="bg-orange-500 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-full whitespace-nowrap shadow-sm">
                                                        Em Leitura
                                                    </span>
                                                    {q.engineeringDeadline && (
                                                        <span className="text-[8px] font-bold text-orange-700 mt-1 uppercase whitespace-nowrap">
                                                            Até: {q.engineeringDeadline}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : q.status?.toLowerCase() === 'leitura finalizada, aguardo setor de produção' ? (
                                                <div className="bg-orange-500 text-white text-[9px] font-black uppercase px-2 py-1 rounded-full whitespace-nowrap shadow-sm border border-orange-600">
                                                    Aguardando Produção
                                                </div>
                                            ) : (
                                                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-tight italic">
                                                    {q.status || 'N/A'}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 text-center font-black text-slate-900 text-sm">
                                            R$ {(q.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            {(!q.price || q.price === 0) && (
                                                <div className="text-[10px] font-black text-red-600 uppercase tracking-tight mt-1 flex items-center justify-center gap-1">
                                                    <span>⚠️</span> INCOMPLETO
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 text-center">
                                            <select 
                                                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                                                onChange={(e) => {
                                                    if (e.target.value === 'print') {
                                                        setPrintingOrder(q);
                                                    } else if (e.target.value === 'view_project') {
                                                        setOrderToView(q);
                                                        setIsViewProjectModalOpen(true);
                                                    }
                                                    e.target.value = '';
                                                }}
                                            >
                                                <option value="">Ações...</option>
                                                {q.projectData ? (
                                                    <option value="view_project">👁️ Visualizar Projeto JSON</option>
                                                ) : null}
                                            </select>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Novo Orçamento (Desativado) Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-slate-50 w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        
                        <div className="p-6 border-b border-slate-200 bg-white flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-black text-slate-900">Novo Orçamento (Desativado) / Pedido</h2>
                                <p className="text-sm font-bold text-slate-500 uppercase mt-1">Preencha os dados abaixo para iniciar</p>
                            </div>
                            <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-red-500 transition-colors p-2 bg-slate-100 hover:bg-red-50 rounded-xl">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 space-y-8 bg-slate-50/50">
                            
                            {/* Buscar Cliente */}
                            <div className="space-y-3">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 text-sky-500"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
                                    Buscar Cliente
                                </label>
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        placeholder="Digite o nome, código ou CPF/CNPJ do cliente..." 
                                        value={clientSearchTerm}
                                        onChange={(e) => setClientSearchTerm(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSearchClient()}
                                        className="flex-1 bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-700 font-medium focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none transition-all shadow-sm" 
                                    />
                                    <button 
                                        onClick={handleSearchClient}
                                        className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-6 py-3 rounded-xl transition-colors shadow-md"
                                    >
                                        Buscar
                                    </button>
                                </div>
                                <div className="flex justify-between items-center">
                                    <p className="text-xs font-semibold text-slate-500">
                                        Cliente sem cadastro utilizar código <span className="text-sky-600 font-black">1001</span> (CONSUMIDOR BALCAO)
                                    </p>
                                    {searchError && (
                                        <p className="text-xs font-bold text-red-500 animate-pulse">{searchError}</p>
                                    )}
                                </div>
                                
                                {/* Exibição do cliente selecionado */}
                                {selectedClient && (
                                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mt-2 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest border border-emerald-200">
                                                    CÓD: {selectedClient.code}
                                                </span>
                                                <h3 className="font-bold text-emerald-950 text-sm">{selectedClient.name}</h3>
                                            </div>
                                            <div className="flex items-center gap-3 mt-1.5">
                                                <p className="text-xs font-semibold text-emerald-700">
                                                    {selectedClient.document1} {selectedClient.document2 ? `• ${selectedClient.document2}` : ''}
                                                </p>
                                                {selectedClient.phone && (
                                                    <p className="text-xs font-semibold text-emerald-700">
                                                        📞 {selectedClient.phone}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => {
                                                setSelectedClient(null);
                                                setClientSearchTerm('');
                                            }} 
                                            className="text-emerald-600 hover:text-emerald-800 hover:bg-emerald-100 p-2 rounded-lg transition-colors"
                                            title="Limpar cliente"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                )}
                                
                                <div className="space-y-2 mt-4">
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Observações (Opcional)</label>
                                    <textarea 
                                        rows={2}
                                        value={newObservations} 
                                        onChange={e => setNewObservations(e.target.value)} 
                                        placeholder="Ex: Descarregamento por conta do cliente..." 
                                        className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-slate-700 font-medium focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none transition-all shadow-sm resize-none" 
                                    />
                                </div>
                            </div>

                            <hr className="border-slate-200" />
                        </div>

                        <div className="p-6 border-t border-slate-200 bg-white flex justify-end gap-3">
                            <button onClick={() => setIsAddModalOpen(false)} className="px-6 py-2.5 rounded-xl font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors">
                                Cancelar
                            </button>
                            <button onClick={handleCreateOrder} disabled={!selectedClient} className="px-6 py-2.5 rounded-xl font-bold bg-emerald-500 hover:bg-emerald-600 text-white transition-colors shadow-md shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed">
                                Iniciar Orçamento
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Print View Modal */}
            {printingOrder && (
                <OrderPrintView 
                    order={printingOrder} 
                    onClose={() => setPrintingOrder(null)} 
                    activeBrandingPartner={activeBrandingPartner}
                />
            )}
            {/* View Project Modal */}
            {isViewProjectModalOpen && orderToView && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                            <div className="flex items-center gap-6">
                                <div>
                                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">
                                        Projeto: Pedido {orderToView.orderNumber}
                                    </h2>
                                    <p className="text-sm font-medium text-slate-500 mt-1">
                                        Cliente: {orderToView.clientName}
                                    </p>
                                </div>
                                <div className="flex bg-slate-200 rounded-lg p-1">
                                    <button
                                        onClick={() => setViewMode('detalhado')}
                                        className={`px-4 py-1.5 text-sm font-bold rounded-md transition-colors ${viewMode === 'detalhado' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        Detalhado
                                    </button>
                                    <button
                                        onClick={() => setViewMode('resumo')}
                                        className={`px-4 py-1.5 text-sm font-bold rounded-md transition-colors ${viewMode === 'resumo' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        Resumo Total
                                    </button>
                                </div>
                            </div>
                            <button 
                                onClick={() => setIsViewProjectModalOpen(false)}
                                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
                            {(() => {
                                try {
                                    const data = orderToView.projectData;
                                    if (!Array.isArray(data)) {
                                        return <div className="p-4 text-red-500 font-bold">O formato do projeto salvo não é uma lista JSON válida ou está vazio. Verifique como foi salvo.</div>;
                                    }

                                    // Normalize keys to lowercase and trim
                                    const normalizedData = data.map(item => {
                                        const newItem: any = {};
                                        for (const key in item) {
                                            newItem[key.trim().toLowerCase()] = item[key];
                                        }
                                        return newItem;
                                    });

                                    // Group by bitola (mm)
                                    const groups: Record<string, any[]> = {};
                                    normalizedData.forEach(item => {
                                        const mm = item.mm || item.bitola || item.diametro || 'Indefinido';
                                        if (!groups[mm]) groups[mm] = [];
                                        groups[mm].push(item);
                                    });

                                    if (viewMode === 'resumo') {
                                        let grandTotalComp = 0;
                                        let grandTotalPeso = 0;
                                        let grandTotalQtd = 0;

                                        return (
                                            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                                                <div className="bg-slate-800 px-4 py-2 flex items-center justify-center">
                                                    <h3 className="text-white font-bold text-lg uppercase tracking-widest">Resumo Geral</h3>
                                                </div>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-center border-collapse">
                                                        <thead>
                                                            <tr className="bg-slate-200 border-b-2 border-slate-300">
                                                                <th className="p-3 text-sm font-black text-slate-700 uppercase border-r border-slate-300">Bitola</th>
                                                                <th className="p-3 text-sm font-black text-slate-700 uppercase border-r border-slate-300">Aço</th>
                                                                <th className="p-3 text-sm font-black text-slate-700 uppercase border-r border-slate-300">Comp. (m)</th>
                                                                <th className="p-3 text-sm font-black text-slate-700 uppercase border-r border-slate-300">Peso (Kg)</th>
                                                                <th className="p-3 text-sm font-black text-slate-700 uppercase">Quantidade de O.S.</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {Object.entries(groups).map(([mm, items], idx) => {
                                                                const totalPeso = items.reduce((acc, curr) => acc + (parseFloat(curr.peso?.toString().replace(',','.')) || 0), 0);
                                                                // Convert cm to meters => / 100
                                                                const totalMetros = items.reduce((acc, curr) => acc + ((parseFloat(curr.qunti?.toString() || curr.quantidade?.toString() || curr.qtd?.toString()) || 0) * (parseFloat(curr.comprimento?.toString()) || 0)), 0) / 100;
                                                                
                                                                // Calculate unique OSs for this bitola
                                                                const uniqueOs = new Set(items.map(item => item.os));
                                                                const totalQtd = uniqueOs.size;
                                                                
                                                                grandTotalComp += totalMetros;
                                                                grandTotalPeso += totalPeso;
                                                                grandTotalQtd += totalQtd;
                                                                
                                                                let aco = 'CA50';
                                                                if (mm === '5,00' || mm === '5.00' || mm === '5' || mm === '6,00' || mm === '6.00' || mm === '6') aco = 'CA60';

                                                                return (
                                                                    <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50">
                                                                        <td className="p-3 text-sm font-medium text-slate-700 border-r border-slate-200">{mm}</td>
                                                                        <td className="p-3 text-sm font-medium text-slate-700 border-r border-slate-200">{aco}</td>
                                                                        <td className="p-3 text-sm font-medium text-slate-700 border-r border-slate-200">{totalMetros.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                                        <td className="p-3 text-sm font-medium text-slate-700 border-r border-slate-200">{totalPeso.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                                        <td className="p-3 text-sm font-medium text-slate-700">{totalQtd}</td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                        <tfoot className="bg-slate-100 border-t-2 border-slate-300">
                                                            <tr>
                                                                <td colSpan={2} className="p-3 text-sm font-black text-slate-800 uppercase text-right border-r border-slate-300">TOTAL:</td>
                                                                <td className="p-3 text-sm font-black text-slate-800 border-r border-slate-300">{grandTotalComp.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                                <td className="p-3 text-sm font-black text-slate-800 border-r border-slate-300">{grandTotalPeso.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                                <td className="p-3 text-sm font-black text-slate-800">{grandTotalQtd}</td>
                                                            </tr>
                                                        </tfoot>
                                                    </table>
                                                </div>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div className="space-y-8">
                                            {Object.entries(groups).map(([mm, items]) => {
                                                const totalPeso = items.reduce((acc, curr) => acc + (parseFloat(curr.peso?.toString().replace(',','.')) || 0), 0);
                                                const totalMetros = items.reduce((acc, curr) => acc + ((parseFloat(curr.qunti?.toString()) || 0) * (parseFloat(curr.comprimento?.toString()) || 0)), 0);

                                                return (
                                                    <div key={mm} className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                                                        <div className="bg-slate-800 px-4 py-2 flex items-center justify-between">
                                                            <h3 className="text-white font-bold text-sm uppercase">Bitola: {mm} mm</h3>
                                                        </div>
                                                        <div className="overflow-x-auto">
                                                            <table className="w-full text-left border-collapse">
                                                                <thead>
                                                                    <tr className="bg-slate-50 border-b border-slate-200">
                                                                        <th className="p-3 text-xs font-bold text-slate-500 uppercase">OS</th>
                                                                        <th className="p-3 text-xs font-bold text-slate-500 uppercase">POS</th>
                                                                        <th className="p-3 text-xs font-bold text-slate-500 uppercase text-center">QTD</th>
                                                                        <th className="p-3 text-xs font-bold text-slate-500 uppercase text-center">Comprimento</th>
                                                                        <th className="p-3 text-xs font-bold text-slate-500 uppercase text-right">Peso</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {items.map((item, idx) => (
                                                                        <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/50">
                                                                            <td className="p-3 text-sm font-medium text-slate-700">{item.os || '-'}</td>
                                                                            <td className="p-3 text-sm font-bold text-slate-900">{item.pos || '-'}</td>
                                                                            <td className="p-3 text-sm text-center font-medium text-slate-600">{item.qunti || item.quantidade || item.qtd || '-'}</td>
                                                                            <td className="p-3 text-sm text-center font-medium text-slate-600">{item.comprimento || '-'}</td>
                                                                            <td className="p-3 text-sm text-right font-bold text-slate-700">{parseFloat(item.peso?.toString().replace(',','.') || '0').toFixed(2)} kg</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                                <tfoot className="bg-slate-50/80">
                                                                    <tr>
                                                                        <td colSpan={2} className="p-3 text-xs font-bold text-slate-500 uppercase text-right">Totais desta bitola:</td>
                                                                        <td className="p-3 text-sm text-center font-black text-slate-800">{items.reduce((acc, curr) => acc + (parseInt(curr.qunti?.toString() || curr.quantidade?.toString() || curr.qtd?.toString()) || 0), 0)} un</td>
                                                                        <td className="p-3 text-sm text-center font-black text-slate-800">{totalMetros.toFixed(2)} cm</td>
                                                                        <td className="p-3 text-sm text-right font-black text-sky-600">{totalPeso.toFixed(2)} kg</td>
                                                                    </tr>
                                                                </tfoot>
                                                            </table>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                } catch (e) {
                                    return <div className="p-4 text-red-500">Erro ao processar dados do projeto.</div>;
                                }
                            })()}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
