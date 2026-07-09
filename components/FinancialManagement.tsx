import React, { useState } from 'react';
import type { Page, Customer, CommercialOrder, User } from '../types';
import { updateItem } from '../services/supabaseService';
import { OrderItemsEditor } from './OrderItemsEditor';
import { OrderPrintView } from './OrderPrintView';

interface FinancialManagementProps {
    setPage: (page: Page) => void;
    customers: Customer[];
    commercialOrders: CommercialOrder[];
    currentUser?: User | null;
    activeBrandingPartner?: any;
}

export const FinancialManagement: React.FC<FinancialManagementProps> = ({
    setPage,
    customers,
    commercialOrders,
    currentUser,
    activeBrandingPartner
}) => {
    const [activeTab, setActiveTab] = useState<'pedidos' | 'creditos'>('pedidos');
    const [isUpdating, setIsUpdating] = useState(false);
    const [viewingOrder, setViewingOrder] = useState<CommercialOrder | null>(null);
    const [printingOrder, setPrintingOrder] = useState<CommercialOrder | null>(null);

    // Filter orders
    const pendingOrders = commercialOrders.filter(o => o.status?.toLowerCase() === 'aguardando financeiro');
    const creditOrders = commercialOrders.filter(o => o.creditRequestStatus === 'Pendente');

    const handleApproveOrder = async (order: CommercialOrder) => {
        if (window.confirm(`Deseja aprovar o pedido ${order.orderNumber} e enviá-lo para a Engenharia (Leitura)?`)) {
            setIsUpdating(true);
            try {
                await updateItem('commercial_orders', order.id!, { status: 'Aguardando Engenharia' });
            } catch (error) {
                console.error('Erro ao aprovar pedido:', error);
                alert('Erro ao aprovar pedido.');
            } finally {
                setIsUpdating(false);
            }
        }
    };

    const handleRejectOrder = async (order: CommercialOrder) => {
        if (window.confirm(`Deseja rejeitar o pedido ${order.orderNumber} e devolvê-lo para Orçamento?`)) {
            setIsUpdating(true);
            try {
                await updateItem('commercial_orders', order.id!, { status: 'Orçamento' });
            } catch (error) {
                console.error('Erro ao rejeitar pedido:', error);
                alert('Erro ao rejeitar pedido.');
            } finally {
                setIsUpdating(false);
            }
        }
    };

    const handleApproveCredit = async (order: CommercialOrder) => {
        if (window.confirm(`Deseja aprovar o crédito para o pedido ${order.orderNumber}?`)) {
            setIsUpdating(true);
            try {
                // Adiciona o crédito ao cliente
                const customer = customers.find(c => (order.clientId && c.id === order.clientId) || (order.clientCode && String(c.code) === String(order.clientCode)));
                if (customer) {
                    const creditToAdd = order.paymentValue || 0;
                    
                    const historyEntry = {
                        date: new Date().toISOString(),
                        amount: creditToAdd,
                        requestedBy: order.salesperson || 'Desconhecido',
                        approvedBy: currentUser?.name || 'Financeiro',
                        orderNumber: order.orderNumber,
                        status: 'Aprovado'
                    };
                    
                    await updateItem('customers', customer.id, {
                        creditGenerated: (customer.creditGenerated || 0) + creditToAdd,
                        creditHistory: [...(customer.creditHistory || []), historyEntry]
                    });
                }
                
                await updateItem('commercial_orders', order.id!, { creditRequestStatus: 'Aprovado' });
            } catch (error) {
                console.error('Erro ao aprovar crédito:', error);
                alert('Erro ao aprovar crédito.');
            } finally {
                setIsUpdating(false);
            }
        }
    };

    const handleRejectCredit = async (order: CommercialOrder) => {
        if (window.confirm(`Deseja rejeitar o crédito para o pedido ${order.orderNumber}?`)) {
            setIsUpdating(true);
            try {
                // Adiciona o histórico de rejeição ao cliente
                const customer = customers.find(c => (order.clientId && c.id === order.clientId) || (order.clientCode && String(c.code) === String(order.clientCode)));
                if (customer) {
                    const creditToReject = order.paymentValue || 0;
                    
                    const historyEntry = {
                        date: new Date().toISOString(),
                        amount: creditToReject,
                        requestedBy: order.salesperson || 'Desconhecido',
                        approvedBy: currentUser?.name || 'Financeiro',
                        orderNumber: order.orderNumber,
                        status: 'Rejeitado'
                    };
                    
                    await updateItem('customers', customer.id, {
                        creditHistory: [...(customer.creditHistory || []), historyEntry]
                    });
                }
                
                await updateItem('commercial_orders', order.id!, { creditRequestStatus: 'Rejeitado' });
            } catch (error) {
                console.error('Erro ao rejeitar crédito:', error);
                alert('Erro ao rejeitar crédito.');
            } finally {
                setIsUpdating(false);
            }
        }
    };

    if (viewingOrder) {
        return (
            <OrderItemsEditor
                order={viewingOrder}
                onClose={() => setViewingOrder(null)}
                onSaveSuccess={() => {}}
                readOnly={true}
            />
        );
    }

    if (printingOrder) {
        return (
            <OrderPrintView
                order={printingOrder}
                onClose={() => setPrintingOrder(null)}
            />
        );
    }

    return (
        <div className="flex flex-col h-full bg-[#f8fafc]">
            {/* Header */}
            <div className="bg-[#112331] shrink-0 p-4 xl:p-6 shadow-lg border-b border-white/5 relative z-10">
                <div className="absolute inset-0 bg-gradient-to-r from-[#00E5FF]/10 to-transparent pointer-events-none opacity-50" />
                <div className="max-w-[1600px] mx-auto w-full relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => window.dispatchEvent(new Event('toggle_mobile_menu'))}
                            className="xl:hidden p-2 -ml-2 text-white/70 hover:text-white rounded-lg hover:bg-white/10"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00E5FF] to-blue-500 flex items-center justify-center shadow-lg shadow-[#00E5FF]/20 ring-1 ring-white/20">
                                <span className="text-2xl">💰</span>
                            </div>
                            <div>
                                <h1 className="text-2xl font-black tracking-tight text-white">Gestão Financeira</h1>
                                <p className="text-[#00E5FF] font-medium text-sm flex items-center gap-2 mt-0.5">
                                    Aprovação de Créditos e Pedidos
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-auto pt-6 relative z-20 px-4 xl:px-6 pb-6">
                <div className="max-w-[1600px] mx-auto w-full flex flex-col gap-6">
                    
                    {/* Tabs */}
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setActiveTab('pedidos')}
                            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-sm ${activeTab === 'pedidos' ? 'bg-[#112331] text-white shadow-lg' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                        >
                            <span>📝 Pedidos ({pendingOrders.length})</span>
                        </button>
                        <button 
                            onClick={() => setActiveTab('creditos')}
                            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-sm ${activeTab === 'creditos' ? 'bg-[#112331] text-white shadow-lg' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                        >
                            <span>💳 Análise de Crédito ({creditOrders.length})</span>
                        </button>
                    </div>

                    {/* Orders Tab */}
                    {activeTab === 'pedidos' && (
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
                                        {pendingOrders.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="p-8 text-center text-slate-500 font-medium border-b border-slate-100">
                                                    Nenhum pedido aguardando aprovação.
                                                </td>
                                            </tr>
                                        ) : (
                                            pendingOrders.map(order => {
                                                const formattedDate = (order.date && String(order.date).includes('-')) 
                                                    ? String(order.date).split('-').reverse().join('/') 
                                                    : (order.date || '');

                                                return (
                                                    <tr key={order.id} className="bg-red-200 hover:bg-red-300 border-b border-red-300 transition-colors">
                                                        <td className="p-4 text-center font-black text-slate-900 text-sm">{order.orderNumber}</td>
                                                        <td className="p-4 text-center font-bold text-slate-600 text-xs">{formattedDate}</td>
                                                        <td className="p-4 text-center font-bold text-slate-700 text-xs">{order.salesperson || 'N/A'}</td>
                                                        <td className="p-4">
                                                            <div className="flex flex-col">
                                                                <span className="font-extrabold text-slate-950 text-xs uppercase">
                                                                    ({order.clientCode}) {order.clientName}
                                                                </span>
                                                                {order.clientCity && <span className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">{order.clientCity}</span>}
                                                            </div>
                                                        </td>
                                                        <td className="p-4 text-center">
                                                            <div className="bg-red-500 text-white text-[10px] font-black uppercase px-2 py-1 rounded-full animate-pulse whitespace-nowrap shadow-md border border-red-600 inline-block">
                                                                Aguardando Fin.
                                                            </div>
                                                        </td>
                                                        <td className="p-4 text-center font-black text-slate-900 text-sm">
                                                            <div>R$ {(order.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                                            {order.paymentValue ? (
                                                                <div className="text-[10px] text-slate-500 font-bold mt-0.5">
                                                                    Sinal: R$ {order.paymentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                                </div>
                                                            ) : null}
                                                        </td>
                                                        <td className="p-4 text-center">
                                                            <div className="min-w-[140px] w-full xl:w-auto flex justify-center">
                                                                    <select 
                                                                        className="w-full xl:w-auto bg-white border border-transparent hover:border-slate-300 rounded-xl px-3 py-2.5 text-xs font-black text-slate-800 shadow-md focus:ring-2 focus:ring-[#315f69] cursor-pointer outline-none transition-all appearance-none text-center"
                                                                        style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%231c3a40%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right .7rem top 50%', backgroundSize: '.65rem auto', paddingRight: '2rem' }}
                                                                        onChange={(e) => {
                                                                            if (e.target.value === 'view') {
                                                                                setPrintingOrder(order);
                                                                            } else if (e.target.value === 'approve') {
                                                                                handleApproveOrder(order);
                                                                            } else if (e.target.value === 'reject') {
                                                                                handleRejectOrder(order);
                                                                            }
                                                                            e.target.value = '';
                                                                        }}
                                                                    >
                                                                        <option value="">Ações...</option>
                                                                        <option value="view">👁️ Ver Orçamento</option>
                                                                        <option value="approve">✅ Aprovar</option>
                                                                        <option value="reject">❌ Rejeitar</option>
                                                                    </select>
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
                    )}

                    {/* Credit Tab */}
                    {activeTab === 'creditos' && (
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
                                            <th className="p-4 text-center font-bold text-xs uppercase w-36">Valores</th>
                                            <th className="p-4 text-center font-bold text-xs uppercase w-48">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {creditOrders.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="p-8 text-center text-slate-500 font-medium border-b border-slate-100">
                                                    Nenhuma solicitação de crédito pendente.
                                                </td>
                                            </tr>
                                        ) : (
                                            creditOrders.map(order => {
                                                const formattedDate = (order.date && String(order.date).includes('-')) 
                                                    ? String(order.date).split('-').reverse().join('/') 
                                                    : (order.date || '');

                                                return (
                                                    <tr key={order.id} className="bg-purple-50/50 hover:bg-purple-100/50 border-b border-slate-100 transition-colors">
                                                        <td className="p-4 text-center font-black text-slate-900 text-sm">{order.orderNumber}</td>
                                                        <td className="p-4 text-center font-bold text-slate-600 text-xs">{formattedDate}</td>
                                                        <td className="p-4 text-center font-bold text-slate-700 text-xs">{order.salesperson || 'N/A'}</td>
                                                        <td className="p-4">
                                                            <div className="flex flex-col">
                                                                <span className="font-extrabold text-slate-950 text-xs uppercase">
                                                                    ({order.clientCode}) {order.clientName}
                                                                </span>
                                                                {order.clientCity && <span className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">{order.clientCity}</span>}
                                                            </div>
                                                        </td>
                                                        <td className="p-4 text-center">
                                                            <div className="bg-purple-500 text-white text-[10px] font-black uppercase px-2 py-1 rounded-full whitespace-nowrap shadow-sm border border-purple-600 inline-block">
                                                                Análise Crédito
                                                            </div>
                                                        </td>
                                                        <td className="p-4 text-center font-black text-slate-900 text-sm">
                                                            <div className="flex flex-col items-center gap-1">
                                                                <span className="text-xs text-slate-500">Total: R$ {(order.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                                <span className="text-xs text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded">Sol.: R$ {(order.paymentValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                            </div>
                                                        </td>
                                                        <td className="p-4 text-center">
                                                            <div className="flex flex-col gap-2 items-center">
                                                                {order.creditRequestUrl && (
                                                                    <a 
                                                                        href={order.creditRequestUrl} 
                                                                        target="_blank" 
                                                                        rel="noopener noreferrer"
                                                                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-[10px] font-black uppercase bg-blue-50 px-2 py-1 rounded"
                                                                    >
                                                                        📄 Ver Anexo
                                                                    </a>
                                                                )}
                                                                <div className="min-w-[140px] w-full xl:w-auto flex justify-center">
                                                                    <select 
                                                                        className="w-full xl:w-auto bg-white border border-transparent hover:border-slate-300 rounded-xl px-3 py-2.5 text-xs font-black text-slate-800 shadow-md focus:ring-2 focus:ring-[#315f69] cursor-pointer outline-none transition-all appearance-none text-center"
                                                                        style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%231c3a40%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right .7rem top 50%', backgroundSize: '.65rem auto', paddingRight: '2rem' }}
                                                                        onChange={(e) => {
                                                                            if (e.target.value === 'view') {
                                                                                setPrintingOrder(order);
                                                                            } else if (e.target.value === 'approve') {
                                                                                handleApproveCredit(order);
                                                                            } else if (e.target.value === 'reject') {
                                                                                handleRejectCredit(order);
                                                                            }
                                                                            e.target.value = '';
                                                                        }}
                                                                    >
                                                                        <option value="">Ações...</option>
                                                                        <option value="view">👁️ Ver Orçamento</option>
                                                                        <option value="approve">✅ Aprovar</option>
                                                                        <option value="reject">❌ Rejeitar</option>
                                                                    </select>
                                                                </div>
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
                    )}

                </div>
            </div>
        </div>
    );
};
