import React, { useState, useEffect } from 'react';
import type { Page, Customer, CommercialOrder, User, Partner } from '../types';
import { insertItem, deleteItem, updateItem } from '../services/supabaseService';
import { OrderItemsEditor } from './OrderItemsEditor';
import { OrderPrintView } from './OrderPrintView';

interface CustomerOrdersProps {
    setPage: (page: Page) => void;
    customers: Customer[];
    commercialOrders: CommercialOrder[];
    currentUser: User | null;
    activeBrandingPartner?: Partner | null;
}

export const CustomerOrders: React.FC<CustomerOrdersProps> = ({ setPage, customers, commercialOrders, currentUser, activeBrandingPartner }) => {
    const [search, setSearch] = useState('');
    const [orderBy, setOrderBy] = useState<'id' | 'clientCode'>('id');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState<CommercialOrder | null>(null);
    const [printingOrder, setPrintingOrder] = useState<CommercialOrder | null>(null);
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

    // Gestor Delete Order
    const [deleteGestorModalOpen, setDeleteGestorModalOpen] = useState(false);
    const [orderToDeleteGestor, setOrderToDeleteGestor] = useState<CommercialOrder | null>(null);
    const [deleteGestorPassword, setDeleteGestorPassword] = useState('');
    const [deleteGestorError, setDeleteGestorError] = useState('');

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
        if (window.confirm('Tem certeza que deseja excluir este orçamento?')) {
            try {
                await deleteItem('commercial_orders', id);
            } catch (error) {
                console.error('Erro ao excluir orçamento:', error);
                alert('Erro ao excluir orçamento.');
            }
        }
    };

    const handleConfirmDeleteGestor = async () => {
        setDeleteGestorError('');
        if (!deleteGestorPassword) {
            setDeleteGestorError('A senha é obrigatória.');
            return;
        }

        if (deleteGestorPassword !== currentUser?.password) {
            setDeleteGestorError('Senha incorreta.');
            return;
        }

        if (orderToDeleteGestor?.id) {
            try {
                await deleteItem('commercial_orders', orderToDeleteGestor.id);
                setDeleteGestorModalOpen(false);
                setOrderToDeleteGestor(null);
                setDeleteGestorPassword('');
            } catch (error) {
                console.error('Erro ao excluir pedido:', error);
                setDeleteGestorError('Erro ao excluir o pedido. Verifique sua conexão e tente novamente.');
            }
        }
    };

    const handleExportOrder = async (order: CommercialOrder) => {
        if (window.confirm('LEMBRETE IMPORTANTE:\n\nPor favor, certifique-se de enviar por e-mail ou WhatsApp os projetos/documentos do pedido.\n\nDeseja confirmar a exportação deste pedido?')) {
            try {
                // Ao exportar, o status muda para Aguardando Engenharia
                await updateItem('commercial_orders', order.id!, { status: 'Aguardando Engenharia' });
            } catch (error) {
                console.error('Erro ao exportar pedido:', error);
                alert('Erro ao exportar pedido.');
            }
        }
    };

    const getRowClass = (status?: string) => {
        if (!status) return 'bg-green-200 border-b-2 border-green-400 text-slate-900 font-medium shadow-sm';
        const clean = status.toLowerCase();
        
        if (clean === 'orçamento' || clean === 'orçamento vazio' || clean === 'orçamento incompleto') {
            return 'bg-green-200 border-b-2 border-green-400 text-slate-900 font-medium shadow-sm';
        }
        if (clean === 'preço desatualizado') {
            return 'bg-amber-50/70 border-b border-amber-100 text-slate-800';
        }
        if (clean === 'em processo de leitura') {
            return 'bg-green-200 border-b-2 border-green-400 text-slate-900 font-medium shadow-sm';
        }
        if (clean === 'leitura finalizada, aguardo setor de produção') {
            return 'bg-green-200 border-b-2 border-green-400 text-slate-900 font-medium shadow-sm';
        }
        if (clean === 'aguardando engenharia') {
            return 'bg-green-200 border-b-2 border-green-400 text-slate-900 font-medium shadow-sm';
        }
        if (clean === 'autorizado engenharia' || clean === 'pedido autorizado') {
            return 'bg-emerald-100 border-b-2 border-emerald-300 text-slate-900 font-medium shadow-sm';
        }
        return 'bg-green-200 border-b-2 border-green-400 text-slate-900 font-medium shadow-sm';
    };

    const isGestor = currentUser?.role === 'gestor' || currentUser?.role === 'admin';
    const baseOrders = (commercialOrders || []).filter(o => {
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

    const totalOrcamentos = baseOrders.filter(o => o.status?.toLowerCase().includes('orçamento')).length;
    const totalPedidos = baseOrders.filter(o => !o.status?.toLowerCase().includes('orçamento')).length;

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
        <div className="p-4 md:p-8 space-y-6 bg-slate-50 min-h-screen">
            {/* Top Navigation with Mini Dashboard */}
            <div className="bg-[#0A2A3D] text-white rounded-[2rem] p-6 shadow-xl flex flex-col xl:flex-row xl:items-center justify-between gap-6 no-print">
                <div className="flex flex-col md:flex-row md:items-center gap-6">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-3">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <h1 className="text-2xl font-black tracking-tight text-white">Gestão de Vendas</h1>
                        </div>
                        <p className="text-[10px] font-bold text-sky-200/60 uppercase tracking-widest mt-1 ml-11">- MSM SISTEMAS</p>
                    </div>

                    {/* Mini Dashboard KPIs */}
                    <div className="flex flex-wrap gap-4 md:ml-6">
                        <div className="bg-white/10 rounded-2xl px-5 py-3 flex items-center justify-between w-[150px] shadow-inner border border-white/5 backdrop-blur-sm">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-sky-200/70 uppercase tracking-wider">Orçamentos</span>
                                <span className="text-2xl font-black text-orange-400">{totalOrcamentos}</span>
                            </div>
                            <div className="w-8 h-8 rounded-full border-[3px] border-[#0A2A3D] border-t-orange-400 border-r-orange-400 opacity-80 rotate-45"></div>
                        </div>
                        <div className="bg-white/10 rounded-2xl px-5 py-3 flex items-center justify-between w-[150px] shadow-inner border border-white/5 backdrop-blur-sm">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-sky-200/70 uppercase tracking-wider">Pedidos</span>
                                <span className="text-2xl font-black text-emerald-400">{totalPedidos}</span>
                            </div>
                            <div className="w-8 h-8 flex items-center justify-center bg-emerald-400/20 text-emerald-400 font-black text-[10px] rounded-full border border-emerald-400/30">
                                100%
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-4 w-full xl:w-auto">
                    <div className="flex flex-wrap gap-3 xl:self-end">
                        <button 
                            onClick={() => setPage('productsCatalog')}
                            className="bg-white/10 hover:bg-white/20 text-sky-100 font-bold py-2.5 px-4 rounded-full transition-all shadow-sm flex items-center gap-2 text-xs uppercase tracking-wider border border-white/5 backdrop-blur-sm"
                        >
                            <span>🏷️ Consultar Produtos</span>
                        </button>
                        <button 
                            onClick={() => setPage('customersManagement')}
                            className="bg-white/10 hover:bg-white/20 text-sky-100 font-bold py-2.5 px-4 rounded-full transition-all shadow-sm flex items-center gap-2 text-xs uppercase tracking-wider border border-white/5 backdrop-blur-sm"
                        >
                            <span>👥 Gestão de Clientes</span>
                        </button>
                        <button 
                            onClick={() => setIsAddModalOpen(true)}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white font-black py-2.5 px-6 rounded-full transition-all shadow-md flex items-center gap-2 text-xs uppercase tracking-wider border border-emerald-400"
                        >
                            <span>+ Novo Orçamento</span>
                        </button>
                    </div>
                    <div className="flex items-center gap-2 bg-[#264b52] p-1.5 rounded-full border border-white/5 shadow-inner">
                        <div className="pl-4 text-teal-200/50">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                            </svg>
                        </div>
                        <input 
                            type="text" 
                            placeholder="Pesquisar orçamento, cliente ou vendedor..." 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="flex-grow bg-transparent text-white placeholder:text-teal-200/50 px-2 py-1 text-sm outline-none w-full min-w-[200px]"
                        />
                        <button className="bg-[#1c3a40] hover:bg-[#152a2e] text-teal-100 px-4 py-2 rounded-full transition-colors text-xs font-bold uppercase tracking-wider shadow-sm">
                            Pesquisar
                        </button>
                    </div>
                </div>
            </div>

            {/* Classification Toggles */}
            <div className="flex items-center gap-4 px-2 no-print">
                <div className="flex gap-2 bg-white p-1 rounded-full shadow-sm border border-slate-200">
                    <button 
                        onClick={() => setOrderBy('id')}
                        className={`px-5 py-2 rounded-full text-[11px] font-black tracking-wider transition-all ${orderBy === 'id' ? 'bg-[#315f69] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        Nº DE ORÇAMENTO
                    </button>
                    <button 
                        onClick={() => setOrderBy('clientCode')}
                        className={`px-5 py-2 rounded-full text-[11px] font-black tracking-wider transition-all ${orderBy === 'clientCode' ? 'bg-[#315f69] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        CÓD. CLIENTE
                    </button>
                </div>
            </div>

            {/* Main Content Area - Cards */}
            <div className="space-y-6 no-print">

                {[...baseOrders].sort((a, b) => {
                    if (orderBy === 'id') {
                        return String(b.orderNumber || '').localeCompare(String(a.orderNumber || ''));
                    }
                    return String(a.clientCode || '').localeCompare(String(b.clientCode || ''));
                }).map((q) => {
                    const formattedDate = (q.date && String(q.date).includes('-')) 
                        ? String(q.date).split('-').reverse().join('/') 
                        : (q.date || '');

                    const isOrcamento = q.status?.toLowerCase() === 'orçamento';
                    const isIncomplete = isOrcamento && (!q.price || q.price === 0);
                    
                    // Card background color logic
                    let cardBg = 'bg-[#9CB4C4]'; // Default slate blue
                    let cardBorder = 'border-[#7A95A8]';
                    
                    if (isOrcamento && isIncomplete) {
                        cardBg = 'bg-[#B3C8D6] opacity-90'; // Lighter for incomplete
                    } else if (q.status?.toLowerCase() === 'em processo de leitura') {
                        cardBg = 'bg-[#e59b69]'; // Orange for reading
                        cardBorder = 'border-[#c97d4b]';
                    }

                    // Process Project Data if available
                    let projectWeight = 0;
                    let projectOsCount = 0;
                    try {
                        if (q.projectData && Array.isArray(q.projectData)) {
                            const normalizedData = q.projectData.map(item => {
                                const newItem: any = {};
                                for (const key in item) {
                                    newItem[key.trim().toLowerCase()] = item[key];
                                }
                                return newItem;
                            });
                            
                            const groups: Record<string, any[]> = {};
                            normalizedData.forEach(item => {
                                const mm = item.mm || item.bitola || item.diametro || 'Indefinido';
                                if (!groups[mm]) groups[mm] = [];
                                groups[mm].push(item);
                            });
                            
                            Object.entries(groups).forEach(([mm, items]) => {
                                const totalPeso = items.reduce((acc, curr) => acc + (parseFloat(curr.peso?.toString().replace(',','.')) || 0), 0);
                                const uniqueOs = new Set(items.map(item => item.os));
                                const totalQtd = uniqueOs.size;
                                
                                projectWeight += totalPeso;
                                projectOsCount += totalQtd;
                            });
                        }
                    } catch (e) {}

                    return (
                        <div key={q.id} className={`${cardBg} rounded-[1.5rem] shadow-lg border-b-4 ${cardBorder} flex flex-col transition-all relative mt-8 xl:mt-0 ${expandedOrderId === q.id ? 'z-50' : 'z-10'}`}>
                            
                            {/* Main Row */}
                            <div 
                                className="p-5 flex flex-col xl:flex-row items-center gap-4 relative cursor-pointer hover:bg-black/5 rounded-[1.5rem] transition-colors"
                                onClick={() => setExpandedOrderId(expandedOrderId === q.id ? null : q.id)}
                            >
                                {/* Left Section: ID & Client */}
                                <div className="flex flex-wrap md:flex-nowrap items-center gap-4 w-full xl:w-[350px] border-b xl:border-b-0 xl:border-r border-black/10 pb-4 xl:pb-0 pr-4">
                                    <div className="flex flex-col min-w-[70px]">
                                        <span className="font-black text-slate-900 text-lg">{q.orderNumber}</span>
                                        <span className="text-[10px] font-bold text-slate-800/70">{formattedDate}</span>
                                    </div>
                                    <div className="w-px h-10 bg-black/10 hidden xl:block mx-1"></div>
                                    <div className="flex flex-col flex-grow">
                                        <span className="font-black text-slate-950 text-xs uppercase leading-tight">
                                            ({q.clientCode}) {q.clientName}
                                        </span>
                                        <span className="text-[9px] font-bold text-slate-800 uppercase mt-0.5 max-w-[200px] truncate">{q.clientCity}</span>
                                        
                                        <div className="flex flex-col gap-1 mt-1.5">
                                            <span className="text-[10px] font-black text-[#0A2A3D] uppercase tracking-tight flex items-center gap-1.5 bg-white/40 px-2 py-0.5 rounded border border-black/5 self-start shadow-sm">
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-sky-600">
                                                    <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
                                                </svg>
                                                VENDEDOR: {q.salesperson || 'NÃO INFORMADO'}
                                            </span>
                                            {q.clientObs && <span className="text-[9px] font-black text-slate-900/80 italic">{q.clientObs}</span>}
                                        </div>
                                    </div>
                                </div>



                                {(() => {
                                        const st = q.status?.toLowerCase() || '';
                                        let activeStage = 'orcamento';
                                        if (st === 'orçamento') activeStage = 'orcamento';
                                        else if (st === 'em processo de leitura') activeStage = 'leitura';
                                        else if (st.includes('aguardo setor de produção') || st.includes('aguardando engenharia')) activeStage = 'pedido';
                                        else if (st.includes('produção') || st.includes('pcp') || st === 'fechado') activeStage = 'pcp';
                                        else if (st.includes('entreg') && !st.includes('entregue') && !st.includes('finalizado')) activeStage = 'entrega';
                                        else if (st.includes('entregue') || st.includes('finalizado')) activeStage = 'completed';

                                        const getDotClasses = (stageName: string, isPastOrActive: boolean) => {
                                            if (activeStage === stageName) return 'bg-orange-500 ring-4 ring-orange-500/40 scale-[1.3] animate-pulse shadow-[0_0_15px_rgba(249,115,22,0.6)]';
                                            if (isPastOrActive) return 'bg-emerald-500 ring-4 ring-emerald-500/30 scale-110 shadow-[0_0_10px_rgba(16,185,129,0.4)]';
                                            return 'bg-black/20';
                                        };

                                        const getLabelClasses = (stageName: string, isPastOrActive: boolean) => {
                                            if (activeStage === stageName) return 'text-orange-600';
                                            if (isPastOrActive) return 'text-emerald-700';
                                            return 'text-black/40';
                                        };

                                        const isCompleted = (stageName: string, isPastOrActive: boolean) => {
                                            return isPastOrActive && activeStage !== stageName;
                                        };

                                        const Checkmark = () => (
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-white/90 drop-shadow-sm">
                                                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                            </svg>
                                        );

                                        return (
                                            <div className="flex-1 flex items-center justify-between px-6 relative h-16 w-full xl:w-auto mt-4 xl:mt-0">
                                                {/* The connecting line in background */}
                                                <div className="absolute left-10 right-10 h-1.5 bg-black/10 top-1/2 -translate-y-1/2 rounded-full"></div>
                                                
                                                {/* Nodes */}
                                                <div className="relative flex flex-col items-center gap-2 z-10 w-16 group">
                                                    <div className={`w-5 h-5 flex items-center justify-center rounded-full transition-all duration-300 ${getDotClasses('orcamento', true)}`}>
                                                        {isCompleted('orcamento', true) && <Checkmark />}
                                                    </div>
                                                    <span className={`text-[9px] font-black uppercase mt-1 transition-all ${getLabelClasses('orcamento', true)}`}>Orçamento</span>
                                                    {expandedOrderId === q.id && (
                                                        <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-white rounded-xl p-3 shadow-xl border border-slate-100 flex flex-col min-w-[160px] z-30 cursor-default" onClick={(e) => e.stopPropagation()}>
                                                            <div className="bg-[#315f69] text-white text-[10px] font-black px-3 py-1.5 rounded-t-lg absolute top-0 left-0 right-0 text-center uppercase tracking-widest shadow-sm">
                                                                Orçamento
                                                            </div>
                                                            <div className="pt-8 flex flex-col gap-1 whitespace-nowrap">
                                                                <span className="font-black text-slate-800 text-[11px] uppercase flex items-center gap-1.5">
                                                                    {isOrcamento ? (isIncomplete ? <><span className="text-red-500">⚠️</span> INCOMPLETO</> : <><span className="text-emerald-500">✅</span> FECHADO</>) : 'FECHADO'}
                                                                </span>
                                                                {(q.totalWeight || projectWeight > 0) ? (
                                                                    <span className="text-[10px] text-slate-600 font-bold">
                                                                        - PESO: {(projectWeight > 0 ? projectWeight : (q.totalWeight || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg
                                                                    </span>
                                                                ) : null}
                                                                <span className="text-[11px] font-black text-slate-900 mt-1 bg-slate-50 px-2 py-1 rounded border border-slate-100">
                                                                    - VALOR: R$ {(q.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                <div className="relative flex flex-col items-center gap-2 z-10 w-16 group">
                                                    <div className={`w-5 h-5 flex items-center justify-center rounded-full transition-all duration-300 ${getDotClasses('leitura', !isOrcamento)}`}>
                                                        {isCompleted('leitura', !isOrcamento) && <Checkmark />}
                                                    </div>
                                                    <span className={`text-[9px] font-black uppercase mt-1 transition-all ${getLabelClasses('leitura', !isOrcamento)}`}>Leitura</span>
                                                    {!isOrcamento && expandedOrderId === q.id && (
                                                        <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-white rounded-xl p-3 shadow-xl border border-slate-100 flex flex-col min-w-[180px] z-30 cursor-default" onClick={(e) => e.stopPropagation()}>
                                                            <div className="bg-[#315f69] text-white text-[10px] font-black px-3 py-1.5 rounded-t-lg absolute top-0 left-0 right-0 text-center uppercase tracking-widest shadow-sm">
                                                                Leitura
                                                            </div>
                                                            <div className="pt-8 flex flex-col gap-2 text-[10px] text-slate-600 font-medium whitespace-nowrap">
                                                                {q.status?.toLowerCase() === 'em processo de leitura' ? (
                                                                    <span className="text-orange-600 font-black uppercase animate-pulse">- EM LEITURA</span>
                                                                ) : q.status?.toLowerCase() === 'leitura finalizada, aguardo setor de produção' ? (
                                                                    <span className="text-emerald-600 font-black uppercase">- FINALIZADA</span>
                                                                ) : (
                                                                    <span className="text-slate-700 font-bold uppercase w-full truncate">- STATUS: {q.status}</span>
                                                                )}
                                                                {q.readingStartedAt && <span>- ENVIADO: <span className="font-bold text-slate-800">{q.readingStartedAt}</span></span>}
                                                                {q.engineeringDeadline && <span>- PRAZO: <span className="font-bold text-red-600">{q.engineeringDeadline}</span></span>}
                                                                {q.readingFinishedAt && <span>- FINALIZADO: <span className="font-bold text-emerald-600">{q.readingFinishedAt}</span></span>}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                <div className="relative flex flex-col items-center gap-2 z-10 w-16 group">
                                                    <div className={`w-5 h-5 flex items-center justify-center rounded-full transition-all duration-300 ${getDotClasses('pedido', !isOrcamento && (st.includes('produção') || st.includes('engenharia') || st.includes('fechado')))}`}>
                                                        {isCompleted('pedido', !isOrcamento && (st.includes('produção') || st.includes('engenharia') || st.includes('fechado'))) && <Checkmark />}
                                                    </div>
                                                    <span className={`text-[9px] font-black uppercase mt-1 transition-all ${getLabelClasses('pedido', !isOrcamento && (st.includes('produção') || st.includes('engenharia') || st.includes('fechado')))}`}>Pedido</span>
                                                    {!isOrcamento && expandedOrderId === q.id && (
                                                        <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-white rounded-xl p-3 shadow-xl border border-slate-100 flex flex-col min-w-[150px] z-30 cursor-default" onClick={(e) => e.stopPropagation()}>
                                                            <div className="bg-[#2a4e55] text-white text-[10px] font-black px-3 py-1.5 rounded-t-lg absolute top-0 left-0 right-0 text-center uppercase tracking-widest shadow-sm">
                                                                Pedido
                                                            </div>
                                                            <div className="pt-8 flex flex-col gap-2 text-[10px] text-slate-600 font-medium whitespace-nowrap">
                                                                {(st.includes('produção') || st.includes('engenharia') || st.includes('fechado')) ? (
                                                                    <span className="text-emerald-600 font-black uppercase">- APROVADO</span>
                                                                ) : (
                                                                    <span className="text-slate-400 italic">Pendente...</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="relative flex flex-col items-center gap-2 z-10 w-16 group">
                                                    <div className={`w-5 h-5 flex items-center justify-center rounded-full transition-all duration-300 ${getDotClasses('pcp', !isOrcamento && st.includes('pcp'))}`}>
                                                        {isCompleted('pcp', !isOrcamento && st.includes('pcp')) && <Checkmark />}
                                                    </div>
                                                    <span className={`text-[9px] font-black uppercase mt-1 transition-all ${getLabelClasses('pcp', !isOrcamento && st.includes('pcp'))}`}>PCP</span>
                                                    {!isOrcamento && expandedOrderId === q.id && (
                                                        <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-white rounded-xl p-3 shadow-xl border border-slate-100 flex flex-col min-w-[180px] z-30 cursor-default" onClick={(e) => e.stopPropagation()}>
                                                            <div className="bg-[#4b7f74] text-white text-[10px] font-black px-3 py-1.5 rounded-t-lg absolute top-0 left-0 right-0 text-center uppercase tracking-widest shadow-sm">
                                                                PCP
                                                            </div>
                                                            <div className="pt-8 flex flex-col gap-2 text-[10px] text-slate-600 font-medium whitespace-nowrap">
                                                                {st === 'aguardando engenharia' ? (
                                                                    <span className="text-red-600 font-black uppercase">- AGUARDANDO ENGENHARIA</span>
                                                                ) : st === 'leitura finalizada, aguardo setor de produção' ? (
                                                                    <>
                                                                        <span className="text-slate-800 font-black uppercase">- AGUARDANDO PRODUÇÃO</span>
                                                                        {projectOsCount > 0 && <span className="mt-1 bg-slate-100 px-2 py-1 rounded font-bold text-slate-700 border border-slate-200 self-start">{projectOsCount} O.S. GERADAS</span>}
                                                                    </>
                                                                ) : (
                                                                    <span className="text-slate-400 italic">Pendente...</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="relative flex flex-col items-center gap-2 z-10 w-16 group">
                                                    <div className={`w-5 h-5 flex items-center justify-center rounded-full transition-all duration-300 ${getDotClasses('entrega', !isOrcamento && st.includes('entreg'))}`}>
                                                        {isCompleted('entrega', !isOrcamento && st.includes('entreg')) && <Checkmark />}
                                                    </div>
                                                    <span className={`text-[9px] font-black uppercase mt-1 transition-all ${getLabelClasses('entrega', !isOrcamento && st.includes('entreg'))}`}>Entrega</span>
                                                    {!isOrcamento && expandedOrderId === q.id && (
                                                        <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-white rounded-xl p-3 shadow-xl border border-slate-100 flex flex-col min-w-[150px] z-30 cursor-default" onClick={(e) => e.stopPropagation()}>
                                                            <div className="bg-[#284a44] text-white text-[10px] font-black px-3 py-1.5 rounded-t-lg absolute top-0 left-0 right-0 text-center uppercase tracking-widest shadow-sm">
                                                                Entrega
                                                            </div>
                                                            <div className="pt-8 flex flex-col gap-2 text-[10px] text-slate-600 font-medium whitespace-nowrap">
                                                                <span className="text-slate-400 italic">Pendente...</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })()}

                                {/* Actions Dropdown */}
                                <div className="min-w-[140px] w-full xl:w-auto mt-4 xl:mt-0 flex justify-end xl:justify-center">
                                    <select 
                                        className="w-full xl:w-auto bg-white border border-transparent hover:border-slate-300 rounded-xl px-3 py-2.5 text-xs font-black text-slate-800 shadow-md focus:ring-2 focus:ring-[#315f69] cursor-pointer outline-none transition-all appearance-none text-center"
                                        style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%231c3a40%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right .7rem top 50%', backgroundSize: '.65rem auto', paddingRight: '2rem' }}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => {
                                            if (e.target.value === 'delete') {
                                                if (q.id) handleDeleteOrder(q.id);
                                            } else if (e.target.value === 'delete_gestor') {
                                                setOrderToDeleteGestor(q);
                                                setDeleteGestorPassword('');
                                                setDeleteGestorError('');
                                                setDeleteGestorModalOpen(true);
                                            } else if (e.target.value === 'edit') {
                                                setEditingOrder(q);
                                            } else if (e.target.value === 'print') {
                                                setPrintingOrder(q);
                                            } else if (e.target.value === 'export') {
                                                handleExportOrder(q);
                                            }
                                            e.target.value = '';
                                        }}
                                    >
                                        <option value="">Ações...</option>
                                        {q.status?.toLowerCase() === 'orçamento' && (
                                            <option value="edit">✏️ Editar</option>
                                        )}
                                        <option value="print">🖨️ Imprimir</option>
                                        {q.status?.toLowerCase() === 'orçamento' && (
                                            <>
                                                <option value="export">➡️ Exportar</option>
                                                <option value="delete">🗑️ Excluir</option>
                                            </>
                                        )}
                                        {isGestor && (
                                            <option value="delete_gestor" className="text-red-600 font-bold">🗑️ Excluir (Gestor)</option>
                                        )}
                                    </select>
                                </div>
                            </div>


                        </div>
                    );
                })}
            </div>

            {/* Novo Orçamento Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-slate-50 w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        
                        <div className="p-6 border-b border-slate-200 bg-white flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-black text-slate-900">Novo Orçamento / Pedido</h2>
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

            {/* Gestor Delete Modal */}
            {deleteGestorModalOpen && orderToDeleteGestor && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-200 bg-red-50 flex items-center gap-4">
                            <div className="bg-red-100 p-3 rounded-full text-red-600">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-red-900">Excluir Projeto (Gestor)</h2>
                                <p className="text-sm font-bold text-red-700 mt-1">Pedido: {orderToDeleteGestor.orderNumber}</p>
                            </div>
                        </div>

                        <div className="p-6 flex-1 space-y-4">
                            <p className="text-sm font-medium text-slate-700">
                                Você está prestes a excluir este projeto do sistema <span className="font-bold text-red-600">definitivamente</span>. Essa ação não pode ser desfeita.
                            </p>

                            <div className="space-y-2 pt-2">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-wider">
                                    Confirme com sua senha de gestor
                                </label>
                                <input
                                    type="password"
                                    value={deleteGestorPassword}
                                    onChange={(e) => setDeleteGestorPassword(e.target.value)}
                                    placeholder="Digite sua senha..."
                                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-slate-900 font-bold focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none transition-all"
                                    onKeyDown={(e) => e.key === 'Enter' && handleConfirmDeleteGestor()}
                                />
                                {deleteGestorError && (
                                    <p className="text-xs font-bold text-red-500 mt-1">{deleteGestorError}</p>
                                )}
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setDeleteGestorModalOpen(false);
                                    setOrderToDeleteGestor(null);
                                    setDeleteGestorPassword('');
                                    setDeleteGestorError('');
                                }}
                                className="px-5 py-2.5 rounded-xl font-bold bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmDeleteGestor}
                                className="px-5 py-2.5 rounded-xl font-bold bg-red-600 hover:bg-red-700 text-white transition-colors shadow-md shadow-red-500/20"
                            >
                                Confirmar Exclusão
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
