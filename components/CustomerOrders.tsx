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
        if (!status) return 'bg-emerald-50/70 border-b border-emerald-100 hover:bg-emerald-100/50 text-slate-800';
        const clean = status.toLowerCase();
        
        if (clean === 'orçamento') {
            return 'bg-orange-100 border-b-2 border-orange-300 hover:bg-orange-200 text-slate-900 font-medium shadow-sm';
        }
        
        if (clean === 'orçamento vazio' || clean === 'orçamento incompleto') {
            return 'bg-red-50/70 border-b border-red-100 hover:bg-red-100/50 text-slate-800';
        }
        if (clean === 'preço desatualizado') {
            return 'bg-amber-50/70 border-b border-amber-100 hover:bg-amber-100/50 text-slate-800';
        }
        if (clean === 'em processo de leitura') {
            return 'bg-green-200 border-b-2 border-green-400 hover:bg-green-300 text-slate-900 font-medium shadow-sm';
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
        <div className="p-4 md:p-8 space-y-6">
            {/* Top Navigation with Mini Dashboard */}
            <div className="flex items-center justify-between no-print">
                <div className="flex items-center gap-8">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                            <span className="text-4xl">📝</span>
                            Gestão de Vendas
                        </h1>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">MSM SISTEMAS • SETOR COMERCIAL</p>
                    </div>

                    {/* Mini Dashboard KPIs */}
                    <div className="flex gap-3">
                        <div className="bg-white border border-slate-200 shadow-sm rounded-xl px-5 py-2 flex flex-col items-center justify-center min-w-[120px]">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Orçamentos</span>
                            <span className="text-2xl font-black text-orange-500">{totalOrcamentos}</span>
                        </div>
                        <div className="bg-white border border-slate-200 shadow-sm rounded-xl px-5 py-2 flex flex-col items-center justify-center min-w-[120px]">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pedidos</span>
                            <span className="text-2xl font-black text-emerald-600">{totalPedidos}</span>
                        </div>
                        <div className="bg-white border border-slate-200 shadow-sm rounded-xl px-5 py-2 flex flex-col items-center justify-center min-w-[120px]">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total</span>
                            <span className="text-2xl font-black text-slate-700">{baseOrders.length}</span>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button 
                        onClick={() => setPage('productsCatalog')}
                        className="bg-white border border-slate-200 hover:border-purple-300 text-slate-700 hover:text-purple-600 font-extrabold py-2 px-4 rounded-xl transition-all shadow-sm flex items-center gap-2 text-sm"
                    >
                        <span>🏷️ Consultar Produtos</span>
                    </button>
                    <button 
                        onClick={() => setPage('customersManagement')}
                        className="bg-white border border-slate-200 hover:border-sky-300 text-slate-700 hover:text-sky-600 font-extrabold py-2 px-4 rounded-xl transition-all shadow-sm flex items-center gap-2 text-sm"
                    >
                        <span>👥 Gestão de Clientes</span>
                    </button>
                    <button 
                        onClick={() => setIsAddModalOpen(true)}
                        className="bg-sky-600 hover:bg-sky-700 text-white font-extrabold py-2 px-5 rounded-xl transition-all shadow-md flex items-center gap-2 text-sm"
                    >
                        <span>+ Novo Orçamento</span>
                    </button>
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
                                <th className="p-4 text-center font-bold text-xs uppercase w-20 border-r border-black">Nº</th>
                                <th className="p-4 text-center font-bold text-xs uppercase w-24 border-r border-black">Data</th>
                                <th className="p-4 text-center font-bold text-xs uppercase w-28 border-r border-black">Vendedor</th>
                                <th className="p-4 font-bold text-xs uppercase w-[350px] min-w-[250px] border-r border-black">Cliente</th>
                                <th className="p-4 text-center font-bold text-xs uppercase w-full min-w-[220px] border-r border-black">Orçamento</th>
                                <th className="p-4 text-center font-bold text-xs uppercase w-48 border-r border-black">Leitura</th>
                                <th className="p-4 text-center font-bold text-xs uppercase w-48 border-r border-black">Pedido</th>
                                <th className="p-4 text-center font-bold text-xs uppercase min-w-[180px]">Ações</th>
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

                                const isOrcamento = q.status?.toLowerCase() === 'orçamento';
                                const isIncomplete = isOrcamento && (!q.price || q.price === 0);
                                const isComplete = isOrcamento && (q.price && q.price > 0);

                                return (
                                    <tr key={q.id} className={`${getRowClass(q.status)} transition-colors`}>
                                        <td className="p-4 text-center font-black text-slate-900 text-sm border-r border-black">{q.orderNumber}</td>
                                        <td className="p-4 text-center font-bold text-slate-600 text-xs border-r border-black">{formattedDate}</td>
                                        <td className="p-4 text-center font-bold text-slate-700 text-xs border-r border-black">{q.salesperson}</td>
                                        <td className="p-4 border-r border-black">
                                            <div className="flex flex-col">
                                                <span className="font-extrabold text-slate-950 text-xs uppercase">
                                                    ({q.clientCode}) {q.clientName}
                                                </span>
                                                <span className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">{q.clientCity}</span>
                                                {q.clientObs && <span className="text-[9px] font-semibold text-sky-600 mt-1 italic">{q.clientObs}</span>}
                                            </div>
                                        </td>
                                        <td className={`p-4 text-center border-r border-black transition-colors duration-300 ${isIncomplete ? 'bg-red-500' : isComplete ? 'bg-green-500' : ''}`}>
                                            {isOrcamento ? (
                                                isIncomplete ? (
                                                    <div className="text-[12px] font-black text-slate-900 uppercase tracking-tight flex items-center justify-center gap-1 drop-shadow-sm">
                                                        <span>⚠️</span> INCOMPLETO
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center text-slate-900 drop-shadow-sm">
                                                        <div className="text-[8px] font-black uppercase tracking-tight flex items-center justify-center gap-1 leading-tight text-center">
                                                            <span>✅</span> ORÇAMENTO COMPLETO<br/>AGUARDANDO CLIENTE
                                                        </div>
                                                        <div className="mt-1 flex items-center justify-center gap-1.5 bg-black/5 px-2 py-0.5 rounded border border-black/10 text-[10px] font-black whitespace-nowrap">
                                                            <span>R$ {(q.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                            {q.totalWeight ? <span className="opacity-80 px-1 border-l border-black/20">{(q.totalWeight).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg</span> : null}
                                                        </div>
                                                    </div>
                                                )
                                            ) : (
                                                <div className="flex flex-col items-center justify-center gap-1 drop-shadow-sm">
                                                    <div className="text-[14px] font-black text-slate-900 uppercase tracking-tight">
                                                        ORÇAMENTO FECHADO
                                                    </div>
                                                    <div className="flex items-center justify-center gap-1.5 bg-black/5 px-2 py-0.5 rounded border border-black/10 text-[10px] font-black whitespace-nowrap text-slate-900">
                                                        <span>R$ {(q.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                        {q.totalWeight ? <span className="opacity-80 px-1 border-l border-black/20">{(q.totalWeight).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg</span> : null}
                                                    </div>
                                                    <div className="text-[9px] font-bold text-slate-500 uppercase">
                                                        {q.createdAt ? new Date(q.createdAt).toLocaleString('pt-BR') : q.date}
                                                    </div>
                                                </div>
                                            )}
                                        </td>
                                        <td className={`p-4 text-center border-r border-black transition-colors duration-300 ${!isOrcamento && q.status?.toLowerCase() === 'aguardando engenharia' ? 'bg-red-500' : ''} ${!isOrcamento && q.status?.toLowerCase() === 'em processo de leitura' ? 'bg-orange-600' : ''}`}>
                                            {!isOrcamento && q.status?.toLowerCase() === 'aguardando engenharia' ? (
                                                <div className="flex flex-col items-center justify-center h-full drop-shadow-sm">
                                                    <div className="text-[12px] font-black text-slate-900 uppercase tracking-tight leading-tight">
                                                        AGUARDANDO PRAZO<br/>SETOR ENGENHARIA
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center gap-2">
                                                    {!isOrcamento && (
                                                        <div>
                                                            {q.status?.toLowerCase() === 'em processo de leitura' ? (
                                                                <div className="flex flex-col items-center drop-shadow-sm">
                                                                    <div className="bg-orange-800 text-white text-[10px] font-black uppercase px-2 py-1 rounded-full whitespace-nowrap shadow-md border border-orange-400 inline-block animate-[pulse_1s_ease-in-out_infinite]">
                                                                        Em Leitura
                                                                    </div>
                                                                    {q.engineeringDeadline && (
                                                                        <div className="text-[9px] font-black text-white mt-2 uppercase tracking-wide bg-black/20 px-2 py-0.5 rounded border border-white/10 shadow-inner">
                                                                            Prazo: {q.engineeringDeadline}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : q.status?.toLowerCase() === 'leitura finalizada, aguardo setor de produção' ? (
                                                                <div className="bg-orange-500 text-white text-[10px] font-black uppercase px-2 py-1 rounded-full whitespace-nowrap shadow-sm border border-orange-600 inline-block">
                                                                    Aguardando Produção
                                                                </div>
                                                            ) : (
                                                                <div className="text-[10px] font-bold text-slate-600 uppercase tracking-tight italic bg-slate-100 px-2 py-1 rounded border border-slate-200">
                                                                    {q.status || 'N/A'}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    
                                                    {q.readingStartedAt || q.readingFinishedAt ? (
                                                        <div className="flex flex-col items-center justify-center gap-1 w-full">
                                                            {q.readingStartedAt && (
                                                                <div className="flex flex-col items-center bg-slate-50 px-2 py-1 rounded border border-slate-200 w-full min-w-[90px]">
                                                                    <span className="text-[8px] font-black text-slate-500 uppercase">Início</span>
                                                                    <span className="text-[9px] font-bold text-slate-700">{q.readingStartedAt}</span>
                                                                </div>
                                                            )}
                                                            {q.readingFinishedAt && (
                                                                <div className="flex flex-col items-center bg-blue-50 px-2 py-1 rounded border border-blue-200 w-full min-w-[90px]">
                                                                    <span className="text-[8px] font-black text-blue-500 uppercase">Fim</span>
                                                                    <span className="text-[9px] font-bold text-blue-700">{q.readingFinishedAt}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-[9px] font-bold text-slate-400 italic">Leitura Pendente</span>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 text-center border-r border-black">
                                            {/* Espaço para a coluna Pedido */}
                                        </td>
                                        <td className="p-4 text-center">
                                            <select 
                                                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
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
                                                    <option value="edit">✏️ Editar Orçamento</option>
                                                )}
                                                <option value="print">🖨️ Imprimir Orçamento</option>
                                                {q.status?.toLowerCase() === 'orçamento' && (
                                                    <>
                                                        <option value="export">➡️ Exportar Pedido</option>
                                                        <option value="delete">🗑️ Excluir Orçamento</option>
                                                    </>
                                                )}
                                                {isGestor && (
                                                    <option value="delete_gestor" className="text-red-600 font-bold">🗑️ Excluir Projeto (Gestor)</option>
                                                )}
                                            </select>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
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
