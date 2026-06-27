import React, { useState, useEffect, useMemo } from 'react';
import { updateItem, deleteItem, fetchByColumn, fetchTable } from '../services/supabaseService';
import type { Page, Customer, CommercialOrder, CommercialOrderItem, StockGauge } from '../types';
import { SearchIcon, UserGroupIcon, PlusIcon, DocumentTextIcon, LocationIcon, UserIcon, XIcon } from './icons';
import { maskCPF, maskCNPJ, maskRG, maskPhone } from '../utils/masks';

interface CustomersManagementProps {
    setPage: (page: Page) => void;
    customers: Customer[];
}

const CustomersManagement: React.FC<CustomersManagementProps> = ({ setPage, customers }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<Partial<Customer>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const [customerOrders, setCustomerOrders] = useState<CommercialOrder[]>([]);
    const [isLoadingOrders, setIsLoadingOrders] = useState(false);

    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
    const [expandedOrderItems, setExpandedOrderItems] = useState<CommercialOrderItem[]>([]);
    const [isLoadingExpanded, setIsLoadingExpanded] = useState(false);

    const [gauges, setGauges] = useState<StockGauge[]>([]);

    const bitolasSummaryMemo = useMemo(() => {
        const summary: Record<string, { kg: number }> = {};
        expandedOrderItems.forEach(item => {
            const bitolas = (item as any).bitolasDetails || item.bitolas_details;
            if (bitolas) {
                Object.entries(bitolas).forEach(([bitolaId, kg]) => {
                    const kgNum = Number(kg) || 0;
                    if (kgNum > 0) {
                        if (!summary[bitolaId]) {
                            summary[bitolaId] = { kg: 0 };
                        }
                        summary[bitolaId].kg += kgNum;
                    }
                });
            }
        });
        return summary;
    }, [expandedOrderItems]);

    useEffect(() => {
        const loadGauges = async () => {
            try {
                const data = await fetchTable<StockGauge>('stock_gauges');
                setGauges(data);
            } catch (err) {
                console.error('Error fetching gauges:', err);
            }
        };
        loadGauges();
    }, []);

    const handleToggleOrder = async (orderId: string) => {
        if (expandedOrderId === orderId) {
            setExpandedOrderId(null);
            setExpandedOrderItems([]);
            return;
        }
        
        setExpandedOrderId(orderId);
        setIsLoadingExpanded(true);
        try {
            const items = await fetchByColumn<CommercialOrderItem>('commercial_order_items', 'order_id', orderId);
            setExpandedOrderItems(items);
        } catch (error) {
            console.error('Error fetching order items:', error);
            setExpandedOrderItems([]);
        } finally {
            setIsLoadingExpanded(false);
        }
    };

    useEffect(() => {
        const fetchOrders = async () => {
            if (selectedCustomer?.code) {
                setIsLoadingOrders(true);
                try {
                    const orders = await fetchByColumn<CommercialOrder>('commercial_orders', 'client_code', selectedCustomer.code);
                    setCustomerOrders(orders);
                } catch (err) {
                    console.error('Error fetching orders for customer', err);
                    setCustomerOrders([]);
                } finally {
                    setIsLoadingOrders(false);
                }
            } else {
                setCustomerOrders([]);
            }
        };
        fetchOrders();
    }, [selectedCustomer?.code]);

    const handleDeleteClick = async () => {
        if (!selectedCustomer) return;
        const pwd = window.prompt('Digite a senha de Gestor para EXCLUIR este cliente:');
        if (pwd === '070223') {
            const confirm = window.confirm(`ATENÇÃO! Você está prestes a excluir permanentemente o cliente ${selectedCustomer.name}. Deseja continuar?`);
            if (confirm) {
                setIsDeleting(true);
                try {
                    await deleteItem('customers', selectedCustomer.id);
                    setSelectedCustomer(null);
                } catch (e) {
                    alert('Erro ao excluir cliente.');
                } finally {
                    setIsDeleting(false);
                }
            }
        } else if (pwd !== null) {
            alert('Senha incorreta!');
        }
    };

    const handleEditClick = () => {
        const pwd = window.prompt('Digite a senha de Gestor para editar:');
        if (pwd === '070223') {
            setIsEditing(true);
            setEditForm(selectedCustomer || {});
        } else if (pwd !== null) {
            alert('Senha incorreta!');
        }
    };

    const handleSaveEdit = async () => {
        if (!selectedCustomer) return;
        setIsSaving(true);
        try {
            // Mapeando para snake_case pro supabase
            const dbUpdates: any = {
                name: editForm.name,
                document1: editForm.document1,
                document2: editForm.document2,
                email: editForm.email,
                phone: editForm.phone,
                birth_date: editForm.birthDate,
                address_main: editForm.addressMain,
                address_delivery: editForm.addressDelivery,
                address_billing: editForm.addressBilling,
                additional_info: editForm.additionalInfo,
                trade_name: editForm.tradeName,
            };
            // Remover undefineds
            Object.keys(dbUpdates).forEach(key => dbUpdates[key] === undefined && delete dbUpdates[key]);

            await updateItem('customers', selectedCustomer.id, dbUpdates);
            
            // Realtime vai atualizar a lista principal, atualizamos apenas o modal atual
            setSelectedCustomer({ ...selectedCustomer, ...editForm });
            setIsEditing(false);
        } catch (error) {
            alert('Erro ao salvar edições.');
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    const filteredCustomers = customers.filter(c => {
        const term = searchTerm.toLowerCase();
        return (
            (c.name || '').toLowerCase().includes(term) ||
            (c.code || '').toLowerCase().includes(term) ||
            (c.document1 && c.document1.toLowerCase().includes(term))
        );
    });

    return (
        <div className="flex flex-col h-screen bg-[#0A2A3D] text-slate-200">
            {/* Header */}
            <div className="bg-[#0D3B54] border-b border-white/10 p-6 shadow-md flex items-center justify-between sticky top-0 z-20">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00E5FF]/20 to-blue-500/20 flex items-center justify-center border border-[#00E5FF]/30">
                        <UserGroupIcon className="w-6 h-6 text-[#00E5FF]" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-white tracking-wider uppercase drop-shadow-sm flex items-center gap-3">
                            Gestão de Clientes
                        </h1>
                        <p className="text-sm text-slate-400 font-medium mt-1">
                            {customers.length} cliente{customers.length !== 1 ? 's' : ''} cadastrado{customers.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Buscar cliente..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-[#0A2A3D]/50 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white font-medium focus:outline-none focus:border-[#00E5FF] transition-colors w-64"
                        />
                        <SearchIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    </div>

                    <button
                        onClick={() => setPage('customerRegistration')}
                        className="bg-[#00E5FF] text-[#0A2A3D] hover:bg-[#00B4CC] px-5 py-2.5 rounded-xl font-bold text-sm tracking-wide transition-all shadow-lg shadow-[#00E5FF]/20 flex items-center gap-2"
                    >
                        <PlusIcon className="w-5 h-5" />
                        Novo Cliente
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                <div className="max-w-6xl mx-auto space-y-4">
                    {filteredCustomers.length === 0 ? (
                        <div className="text-center py-20">
                            <UserGroupIcon className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-white mb-2">Nenhum cliente encontrado</h3>
                            <p className="text-slate-400">Tente buscar com outros termos ou cadastre um novo cliente.</p>
                        </div>
                    ) : (
                        filteredCustomers.map(customer => (
                            <div 
                                key={customer.id} 
                                className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-all cursor-pointer shadow-md group"
                                onClick={() => setSelectedCustomer(customer)}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg ${
                                            customer.customerType === 'Pessoa Física' 
                                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                            : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                                        }`}>
                                            {customer.customerType === 'Pessoa Física' ? 'PF' : 'PJ'}
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-white group-hover:text-[#00E5FF] transition-colors">
                                                {customer.name}
                                            </h3>
                                            <div className="flex items-center gap-3 mt-1 text-xs font-medium text-slate-400 uppercase tracking-wider">
                                                <span className="bg-black/20 px-2 py-0.5 rounded text-slate-300 border border-white/5">
                                                    {customer.code}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <DocumentTextIcon className="w-3.5 h-3.5" />
                                                    {customer.document1}
                                                </span>
                                                {customer.phone && (
                                                    <span className="flex items-center gap-1">
                                                        <UserIcon className="w-3.5 h-3.5" />
                                                        {customer.phone}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-4">
                                        <div className="text-right text-sm">
                                            <div className="text-slate-400 font-medium">Cadastrado em</div>
                                            <div className="text-white font-bold">
                                                {customer.createdAt ? new Date(customer.createdAt).toLocaleDateString('pt-BR') : '-'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Modal de Dashboard do Cliente */}
            {selectedCustomer && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-2 bg-black/70 backdrop-blur-md animate-fadeIn">
                    <div className="bg-[#0A2A3D] rounded-2xl w-[98vw] h-[96vh] max-w-none flex flex-col shadow-2xl border border-white/10 animate-slideUp overflow-hidden">
                        {/* Header */}
                        <div className="p-5 border-b border-white/10 flex justify-between items-center bg-[#0D3B54]">
                            <h2 className="text-xl font-black text-white uppercase tracking-wider flex items-center gap-3">
                                <UserIcon className="w-6 h-6 text-[#00E5FF]" />
                                Dashboard do Cliente
                            </h2>
                            <button onClick={() => { setSelectedCustomer(null); setIsEditing(false); }} className="text-slate-400 hover:text-white transition-colors bg-white/5 hover:bg-red-500/20 p-2 rounded-lg">
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>
                        
                        {/* Body */}
                        <div className="flex-1 flex overflow-hidden">
                            
                            {/* Left Column - Customer Details */}
                            <div className="w-1/3 bg-[#0D3B54]/30 border-r border-white/10 flex flex-col overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
                                <div className="p-6">
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="text-lg font-bold text-[#00E5FF]">Dados Cadastrais</h3>
                                        <button onClick={handleEditClick} className="text-xs font-bold bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors text-white">Editar</button>
                                    </div>
                                    
                                    <div className="space-y-5">
                                        <div>
                                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Nome / Razão Social</div>
                                            {isEditing ? (
                                                <input type="text" className="w-full bg-[#0A2A3D] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#00E5FF] outline-none" value={editForm.name || ''} onChange={e => setEditForm({...editForm, name: e.target.value})} />
                                            ) : (
                                                <div className="text-base font-bold text-white leading-tight">{selectedCustomer.name}</div>
                                            )}
                                        </div>
                                        <div className="flex gap-4">
                                            <div className="flex-1">
                                                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Código</div>
                                                <div className="text-sm font-bold text-[#00E5FF] bg-[#00E5FF]/10 px-2 py-1 rounded inline-block">{selectedCustomer.code}</div>
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Tipo</div>
                                                <div className="text-sm font-bold text-slate-300">{selectedCustomer.customerType}</div>
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{selectedCustomer.customerType === 'Pessoa Física' ? 'CPF' : 'CNPJ'}</div>
                                            {isEditing ? (
                                                <input type="text" className="w-full bg-[#0A2A3D] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#00E5FF] outline-none" value={editForm.document1 || ''} onChange={e => setEditForm({...editForm, document1: selectedCustomer.customerType === 'Pessoa Física' ? maskCPF(e.target.value) : maskCNPJ(e.target.value)})} />
                                            ) : (
                                                <div className="text-sm font-bold text-slate-300">{selectedCustomer.document1}</div>
                                            )}
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Telefone</div>
                                            {isEditing ? (
                                                <input type="tel" className="w-full bg-[#0A2A3D] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#00E5FF] outline-none" value={editForm.phone || ''} onChange={e => setEditForm({...editForm, phone: maskPhone(e.target.value)})} />
                                            ) : (
                                                <div className="text-sm font-bold text-slate-300">{selectedCustomer.phone || '-'}</div>
                                            )}
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Endereço Principal</div>
                                            {isEditing ? (
                                                <textarea rows={2} className="w-full bg-[#0A2A3D] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#00E5FF] outline-none resize-none" value={editForm.addressMain || ''} onChange={e => setEditForm({...editForm, addressMain: e.target.value})} />
                                            ) : (
                                                <div className="text-sm text-slate-400 bg-black/20 p-3 rounded-lg border border-white/5">{selectedCustomer.addressMain || 'Não informado'}</div>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {isEditing && (
                                        <div className="mt-8 flex flex-col gap-3">
                                            <button onClick={handleSaveEdit} disabled={isSaving} className="w-full py-3 rounded-xl font-bold bg-[#00E5FF] hover:bg-[#00B4CC] text-[#0A2A3D] transition-colors disabled:opacity-50">
                                                {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                                            </button>
                                            <button onClick={() => setIsEditing(false)} className="w-full py-3 rounded-xl font-bold bg-white/5 hover:bg-white/10 text-white transition-colors">
                                                Cancelar Edição
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right Column - Dashboard */}
                            <div className="w-2/3 bg-black/20 flex flex-col overflow-hidden">
                                {/* Metrics Cards */}
                                <div className="p-6 grid grid-cols-3 gap-4 border-b border-white/5">
                                    <div className="bg-[#0D3B54]/50 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                                        <div>
                                            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Total de Pedidos</div>
                                            <div className="text-2xl font-black text-white">{customerOrders.length}</div>
                                        </div>
                                        <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                                            <DocumentTextIcon className="w-5 h-5" />
                                        </div>
                                    </div>
                                    <div className="bg-[#0D3B54]/50 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                                        <div>
                                            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Peso Total (KG)</div>
                                            <div className="text-2xl font-black text-white">
                                                {customerOrders.reduce((acc, order) => acc + (order.totalWeight || 0), 0).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                            </div>
                                        </div>
                                        <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400">
                                            <div className="font-bold text-xs">KG</div>
                                        </div>
                                    </div>
                                    <div className="bg-[#0D3B54]/50 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                                        <div>
                                            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Valor Total Movimentado</div>
                                            <div className="text-2xl font-black text-[#00E5FF]">
                                                R$ {customerOrders.reduce((acc, order) => acc + (order.price || 0), 0).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                            </div>
                                        </div>
                                        <div className="w-10 h-10 rounded-full bg-[#00E5FF]/20 flex items-center justify-center text-[#00E5FF]">
                                            <div className="font-bold text-sm">R$</div>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Orders List */}
                                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/10">
                                    <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                                        Histórico de Orçamentos / Pedidos
                                    </h3>
                                    
                                    {isLoadingOrders ? (
                                        <div className="text-center py-10 text-slate-400 font-medium">Carregando histórico...</div>
                                    ) : customerOrders.length === 0 ? (
                                        <div className="text-center py-10 bg-white/5 border border-dashed border-white/10 rounded-xl">
                                            <DocumentTextIcon className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                                            <p className="text-slate-400 font-medium">Nenhum pedido encontrado para este cliente.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {customerOrders.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(order => (
                                                <div key={order.id} className="bg-white/5 border border-white/10 hover:border-white/20 rounded-xl flex flex-col overflow-hidden transition-colors">
                                                    <div 
                                                        className="p-4 flex items-center justify-between cursor-pointer"
                                                        onClick={() => order.id && handleToggleOrder(order.id)}
                                                    >
                                                        <div className="flex gap-4 items-center">
                                                            <div className="w-12 h-12 bg-black/20 rounded-lg flex flex-col items-center justify-center border border-white/5">
                                                                <span className="text-[10px] text-slate-500 font-bold uppercase">Nº</span>
                                                                <span className="text-sm font-black text-white">{order.orderNumber}</span>
                                                            </div>
                                                            <div>
                                                                <div className="font-bold text-white text-sm">Orçamento emitido em {new Date(order.date).toLocaleDateString('pt-BR')}</div>
                                                                <div className="text-xs text-slate-400 mt-0.5 flex gap-3">
                                                                    <span>Vendedor: <strong className="text-slate-300">{order.salesperson}</strong></span>
                                                                    <span>Status: <strong className={order.status === 'Vendido' ? 'text-green-400' : 'text-amber-400'}>{order.status}</strong></span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-lg font-black text-[#00E5FF]">
                                                                R$ {order.price.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                                            </div>
                                                            <div className="text-xs text-slate-400 font-medium">
                                                                {order.totalWeight ? `${order.totalWeight.toLocaleString('pt-BR', {minimumFractionDigits: 2})} kg` : '-'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    
                                                    {expandedOrderId === order.id && (
                                                        <div className="bg-black/40 border-t border-white/5 p-4 animate-fadeIn">
                                                            <h4 className="text-xs font-bold text-[#00E5FF] uppercase tracking-wider mb-3 flex items-center gap-2">
                                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                                                                </svg>
                                                                Itens do Orçamento
                                                            </h4>
                                                            {isLoadingExpanded ? (
                                                                <div className="text-xs text-slate-400">Carregando itens...</div>
                                                            ) : expandedOrderItems.length === 0 ? (
                                                                <div className="text-xs text-slate-400">Nenhum item cadastrado neste orçamento.</div>
                                                            ) : (
                                                                <div className="overflow-x-auto rounded-lg border border-white/5">
                                                                    <table className="w-full text-left text-xs">
                                                                        <thead className="bg-white/5 text-slate-400">
                                                                            <tr>
                                                                                <th className="p-2 font-medium">Cód.</th>
                                                                                <th className="p-2 font-medium">Folha</th>
                                                                                <th className="p-2 font-medium">Descrição</th>
                                                                                <th className="p-2 font-medium">Qtde</th>
                                                                                <th className="p-2 font-medium text-right">Peso (KG)</th>
                                                                                <th className="p-2 font-medium text-right">Total</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="divide-y divide-white/5 text-slate-400 bg-black/20">
                                                                            {expandedOrderItems.map(item => (
                                                                                <tr key={item.id} className="hover:bg-white/5 text-slate-400">
                                                                                    <td className="p-2">{item.codigo}</td>
                                                                                    <td className="p-2">{item.folha || '-'}</td>
                                                                                    <td className="p-2 max-w-[200px] truncate" title={item.descricao}>{item.descricao}</td>
                                                                                    <td className="p-2">{item.tipo}</td>
                                                                                    <td className="p-2 text-right text-slate-300">{item.peso.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                                                                    <td className="p-2 text-right text-slate-300">R$ {item.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            )}

                                                            {/* Resumo do Aço */}
                                                            {expandedOrderItems.length > 0 && gauges.length > 0 && (
                                                                <div className="mt-4">
                                                                    <h4 className="text-xs font-bold text-[#00E5FF] uppercase tracking-wider mb-3 flex items-center gap-2">
                                                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                                                                        </svg>
                                                                        Resumo do Aço
                                                                    </h4>
                                                                    <div className="overflow-x-auto rounded-lg border border-white/5">
                                                                        <table className="w-full text-left text-xs">
                                                                            <thead className="bg-white/5 text-slate-400">
                                                                                <tr>
                                                                                    <th className="p-2 font-medium">Cód.</th>
                                                                                    <th className="p-2 font-medium">Descrição Material</th>
                                                                                    <th className="p-2 font-medium text-right">Qtde (KG)</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-white/5 text-slate-400 bg-black/20">
                                                                                {Object.keys(bitolasSummaryMemo).map(bitolaId => {
                                                                                        const gauge = gauges.find(g => g.id === bitolaId);
                                                                                        const kg = bitolasSummaryMemo[bitolaId].kg;
                                                                                        let desc = 'AÇO DESCONHECIDO';
                                                                                        if (gauge) {
                                                                                            const name = gauge.commercialName || gauge.materialType;
                                                                                            const prefix = name.toUpperCase().startsWith('CD ') ? '' : 'CD ';
                                                                                            desc = `${prefix}${name} ${gauge.gauge}`;
                                                                                        }
                                                                                        const cod = gauge?.productCode || '';
                                                                                        
                                                                                        return (
                                                                                            <tr key={bitolaId} className="hover:bg-white/5 text-slate-400">
                                                                                                <td className="p-2">{cod}</td>
                                                                                                <td className="p-2 uppercase">{desc}</td>
                                                                                                <td className="p-2 text-right text-slate-300">{kg.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                                                                            </tr>
                                                                                        );
                                                                                    })}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Linha do Tempo / Histórico */}
                                                            <div className="mt-6 border-t border-white/5 pt-4">
                                                                <h4 className="text-xs font-bold text-[#00E5FF] uppercase tracking-wider mb-4 flex items-center gap-2">
                                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                    </svg>
                                                                    Linha do Tempo / Movimentações
                                                                </h4>
                                                                {(!order.history || order.history.length === 0) ? (
                                                                    <div className="text-xs text-slate-500 italic">Nenhum histórico registrado.</div>
                                                                ) : (
                                                                    <div className="space-y-4">
                                                                        {order.history.map((log, index) => (
                                                                            <div key={index} className="flex gap-4 relative">
                                                                                <div className="w-2 h-2 rounded-full bg-[#00E5FF] mt-1.5 absolute left-[-16px]"></div>
                                                                                <div className="border-l-2 border-white/10 absolute left-[-13px] top-4 bottom-[-16px]" style={{ display: index === order.history!.length - 1 ? 'none' : 'block' }}></div>
                                                                                <div>
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className="text-xs font-bold text-white">{log.action}</span>
                                                                                        <span className="text-[10px] text-slate-400 bg-black/30 px-2 py-0.5 rounded-full">{new Date(log.date).toLocaleString('pt-BR')}</span>
                                                                                    </div>
                                                                                    <div className="text-xs text-slate-400 mt-1">Por: <span className="font-bold text-slate-300">{log.user}</span></div>
                                                                                    {log.details && (
                                                                                        <div className="text-xs text-slate-300 bg-white/5 p-2 rounded-md mt-2 border border-white/5">{log.details}</div>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomersManagement;
