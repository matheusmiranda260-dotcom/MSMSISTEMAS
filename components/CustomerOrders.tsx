import React, { useState, useEffect } from 'react';
import type { Page, Customer, CommercialOrder, User, Partner } from '../types';
import { insertItem, deleteItem } from '../services/supabaseService';
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
            status: 'Orçamento'
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
        return 'bg-emerald-50/70 border-b border-emerald-100 hover:bg-emerald-100/50 text-slate-800';
    };

    const totalOrcamentos = commercialOrders.filter(o => o.status?.toLowerCase().includes('orçamento')).length;
    const totalPedidos = commercialOrders.filter(o => !o.status?.toLowerCase().includes('orçamento')).length;

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
                            Lançar Orçamentos / Pedidos
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
                            <span className="text-2xl font-black text-slate-700">{commercialOrders.length}</span>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3">
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
                                <th className="p-4 text-center font-bold text-xs uppercase w-20">Nº</th>
                                <th className="p-4 text-center font-bold text-xs uppercase w-24">Data</th>
                                <th className="p-4 text-center font-bold text-xs uppercase w-28">Vendedor</th>
                                <th className="p-4 font-bold text-xs uppercase">Cliente</th>
                                <th className="p-4 text-center font-bold text-xs uppercase w-36">Preço</th>
                                <th className="p-4 text-center font-bold text-xs uppercase w-48">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[...(commercialOrders || [])].sort((a, b) => String(b.orderNumber || '').localeCompare(String(a.orderNumber || ''))).map((q) => {
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
                                        <td className="p-4 text-center font-black text-slate-900 text-sm">
                                            R$ {(q.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            {(!q.price || q.price === 0) ? (
                                                <div className="text-[10px] font-black text-red-600 uppercase tracking-tight mt-1 animate-pulse flex items-center justify-center gap-1">
                                                    <span>⚠️</span> INCOMPLETO
                                                </div>
                                            ) : (
                                                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-tight mt-0.5 italic">{q.status}</div>
                                            )}
                                        </td>
                                        <td className="p-4 text-center">
                                            <select 
                                                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                                                onChange={(e) => {
                                                    if (e.target.value === 'delete') {
                                                        if (q.id) handleDeleteOrder(q.id);
                                                    } else if (e.target.value === 'edit') {
                                                        setEditingOrder(q);
                                                    } else if (e.target.value === 'print') {
                                                        setPrintingOrder(q);
                                                    }
                                                    e.target.value = '';
                                                }}
                                            >
                                                <option value="">Ações...</option>
                                                <option value="edit">✏️ Editar Orçamento</option>
                                                <option value="print">🖨️ Imprimir Orçamento</option>
                                                <option value="delete">🗑️ Excluir Orçamento</option>
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
        </div>
    );
};
