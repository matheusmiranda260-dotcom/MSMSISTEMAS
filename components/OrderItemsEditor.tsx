import React, { useState, useEffect } from 'react';
import type { CommercialOrder, CommercialOrderItem, StockGauge } from '../types';
import { insertItem, updateItem, deleteItem, fetchItems, fetchTable } from '../services/supabaseService';

interface OrderItemsEditorProps {
    order: CommercialOrder;
    onClose: () => void;
    onSaveSuccess: () => void;
}

export const OrderItemsEditor: React.FC<OrderItemsEditorProps> = ({ order, onClose, onSaveSuccess }) => {
    const [items, setItems] = useState<CommercialOrderItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [projectIdent, setProjectIdent] = useState(order.projectIdent || '');
    const [deliveryTime, setDeliveryTime] = useState(order.deliveryTime || '');
    const [paymentCondition, setPaymentCondition] = useState(order.paymentCondition || '');
    const [isSaving, setIsSaving] = useState(false);
    const [editingItemId, setEditingItemId] = useState<string | null>(null);

    // Bitolas Calculator State
    const [gauges, setGauges] = useState<StockGauge[]>([]);
    const [isBitolasModalOpen, setIsBitolasModalOpen] = useState(false);
    const [bitolasQuantities, setBitolasQuantities] = useState<Record<string, number>>({});

    // Form state for new item
    const [newItem, setNewItem] = useState<Partial<CommercialOrderItem>>({
        codigo: 'RESUMO',
        folha: '',
        descricao: '',
        tipo: 'CORTE / DOBRA',
        peso: 0,
        valor: 0
    });

    const loadItems = async () => {
        if (!order.id) return;
        setIsLoading(true);
        try {
            const data = await fetchItems('commercial_order_items', '*', { column: 'order_id', value: order.id });
            setItems(data as unknown as CommercialOrderItem[]);
            
            const gaugesData = await fetchTable<StockGauge>('stock_gauges');
            // Filter only active gauges if you want, or just show all
            setGauges(gaugesData.filter(g => g.status !== 'Inativo'));
        } catch (error) {
            console.error('Error loading items:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadItems();
    }, [order.id]);

    const handleAddItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!order.id) return;

        try {
            const itemToSave = {
                order_id: order.id,
                codigo: newItem.codigo!,
                folha: newItem.folha!,
                descricao: newItem.descricao!,
                tipo: newItem.tipo!,
                peso: newItem.peso!,
                valor: newItem.valor!,
                bitolas_details: Object.keys(bitolasQuantities).length > 0 ? bitolasQuantities : undefined
            };
            
            if (editingItemId) {
                await updateItem('commercial_order_items', editingItemId, itemToSave);
                setEditingItemId(null);
            } else {
                await insertItem<CommercialOrderItem>('commercial_order_items', itemToSave);
            }
            
            // Reset form
            setNewItem({
                codigo: 'RESUMO',
                folha: '',
                descricao: '',
                tipo: 'CORTE / DOBRA',
                peso: 0,
                valor: 0
            });
            setBitolasQuantities({});
            await loadItems();
        } catch (error) {
            console.error('Error adding item:', error);
            alert('Erro ao salvar item.');
        }
    };

    const handleEditItem = (item: CommercialOrderItem) => {
        if (!item.id) return;
        setEditingItemId(item.id);
        setNewItem({
            codigo: item.codigo,
            folha: item.folha,
            descricao: item.descricao,
            tipo: item.tipo,
            peso: item.peso,
            valor: item.valor
        });
        
        if (item.bitolas_details) {
            setBitolasQuantities(item.bitolas_details);
        } else {
            setBitolasQuantities({});
        }
        
        // Scroll to top where the form is
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDeleteItem = async (itemId: string) => {
        if (!confirm('Excluir este item?')) return;
        try {
            await deleteItem('commercial_order_items', itemId);
            await loadItems();
        } catch (error) {
            console.error('Error deleting item:', error);
        }
    };

    const totalWeight = items.reduce((acc, item) => acc + (item.peso || 0), 0);
    const totalValue = items.reduce((acc, item) => acc + (item.valor || 0), 0);

    // Compute bitolas summary
    const bitolasSummary: Record<string, { kg: number }> = {};
    items.forEach(item => {
        if (item.bitolas_details) {
            Object.entries(item.bitolas_details).forEach(([bitolaId, kg]) => {
                const kgNum = Number(kg) || 0;
                if (kgNum > 0) {
                    if (!bitolasSummary[bitolaId]) {
                        bitolasSummary[bitolaId] = { kg: 0 };
                    }
                    bitolasSummary[bitolaId].kg += kgNum;
                }
            });
        }
    });

    const summaryRows = Object.keys(bitolasSummary).map(bitolaId => {
        const gauge = gauges.find(g => g.id === bitolaId);
        const kg = bitolasSummary[bitolaId].kg;
        const desc = gauge ? `AÇO CORTADO/DOBRADO ${gauge.commercialName || gauge.materialType} - ${gauge.gauge}` : 'AÇO DESCONHECIDO';
        
        const pesoUnitario = gauge?.rawWeightValue || 1;
        const barras = kg / pesoUnitario;
        
        const pricePerKg = (gauge?.rawWeightValue && gauge.rawWeightValue > 0) 
            ? (gauge.purchasePrice || 0) / gauge.rawWeightValue 
            : (gauge?.purchasePrice || 0);

        const pricePerBarra = gauge?.purchasePrice || 0;
        const total = kg * pricePerKg;

        return {
            id: gauge?.productCode || bitolaId.substring(0, 4).toUpperCase(),
            desc,
            barras: isFinite(barras) ? barras : 0,
            pricePerBarra,
            kg,
            pricePerKg,
            total
        };
    }).sort((a, b) => b.kg - a.kg); // Sort by weight for example

    const totalSummaryKg = summaryRows.reduce((acc, r) => acc + r.kg, 0);
    const totalSummaryRs = summaryRows.reduce((acc, r) => acc + r.total, 0);

    const handleSaveOrder = async () => {
        if (!order.id) return;
        setIsSaving(true);
        try {
            // Update the main order with totals and metadata
            const statusToSave = totalValue > 0 ? (order.status.toLowerCase().includes('incompleto') ? 'Orçamento' : order.status) : order.status;
            
            const newHistoryEntry = {
                date: new Date().toISOString(),
                user: order.salesperson || 'SISTEMA',
                action: 'Orçamento atualizado',
                details: `Valor total: R$ ${totalValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})} | Peso: ${totalWeight.toLocaleString('pt-BR', {minimumFractionDigits: 2})} kg | Status: ${statusToSave}`
            };
            const updatedHistory = [...(order.history || []), newHistoryEntry];

            await updateItem('commercial_orders', order.id, {
                projectIdent: projectIdent,
                delivery_time: deliveryTime,
                paymentCondition: paymentCondition,
                totalWeight: totalWeight,
                price: totalValue, // Update main price
                status: statusToSave,
                history: updatedHistory
            });
            onSaveSuccess();
            onClose();
        } catch (error) {
            console.error('Error saving order:', error);
            alert('Erro ao salvar orçamento.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleConfirmBitolas = () => {
        let totalKg = 0;
        let totalRs = 0;
        
        Object.entries(bitolasQuantities).forEach(([bitolaId, kgValue]) => {
            const kg = kgValue as number;
            if (kg > 0) {
                const gauge = gauges.find(g => g.id === bitolaId);
                if (gauge) {
                    const pricePerKg = (gauge.rawWeightValue && gauge.rawWeightValue > 0) 
                        ? (gauge.purchasePrice || 0) / gauge.rawWeightValue 
                        : (gauge.purchasePrice || 0);
                        
                    totalKg += kg;
                    totalRs += (kg * pricePerKg);
                }
            }
        });
        
        setNewItem({
            ...newItem,
            peso: totalKg,
            valor: totalRs
        });
        setIsBitolasModalOpen(false);
        // Do NOT reset bitolasQuantities here, because they are bound to the current form item.
        // It will be reset when the item is saved or canceled.
    };

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4 md:p-8 animate-in fade-in">
            <div className="bg-slate-50 w-full h-full max-w-[1400px] rounded-xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
                {/* Header */}
                <div className="bg-white px-8 py-5 flex justify-between items-center shrink-0 border-b border-slate-200">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                            Edição de Orçamento <span className="text-slate-400 font-normal">#{order.orderNumber}</span>
                        </h2>
                        <div className="text-slate-400 font-bold text-xs mt-2 flex items-center gap-2 uppercase tracking-wider">
                            <span className="text-blue-500">🏠 Orçamentos</span> <span>&gt;</span> <span className="text-blue-500">Edição</span>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-5 py-2 border border-slate-200 rounded-lg font-bold text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-2 shadow-sm text-sm">
                            ✕ Cancelar
                        </button>
                        <button 
                            onClick={handleSaveOrder} 
                            disabled={isSaving}
                            className="px-6 py-2 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all flex items-center gap-2 shadow-md shadow-blue-600/20 disabled:opacity-50 text-sm"
                        >
                            {isSaving ? 'Salvando...' : '✓ Salvar Orçamento'}
                        </button>
                    </div>
                </div>

                <div className="p-8 flex-1 overflow-y-auto space-y-6">
                    
                    {/* Header Info */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
                                👤
                            </div>
                            <div className="flex-1">
                                <div className="font-bold text-slate-400 text-[10px] uppercase tracking-widest mb-1">Cliente</div>
                                <div className="font-black text-slate-800 text-sm mb-3">({order.clientCode}) {order.clientName}</div>
                                <div className="font-bold text-slate-400 text-[10px] uppercase tracking-widest mb-1">Endereço</div>
                                <div className="font-bold text-slate-600 text-xs">{order.clientCity || 'N/A'}</div>
                            </div>
                        </div>

                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
                                📅
                            </div>
                            <div className="flex-1">
                                <div className="font-bold text-slate-400 text-[10px] uppercase tracking-widest mb-1">Data Orçamento</div>
                                <div className="flex items-center gap-3 mb-3">
                                    <span className="font-black text-slate-800 text-sm">{order.date.split('-').reverse().join('/')}</span>
                                    <span className="bg-blue-50 text-blue-600 text-[10px] font-bold px-2 py-1 rounded border border-blue-100 flex items-center gap-1">
                                        ⏱️ VÁLIDO POR 1 DIA ÚTIL
                                    </span>
                                </div>
                                <div className="font-bold text-slate-400 text-[10px] uppercase tracking-widest mb-1 mt-3">Vendedor</div>
                                <div className="font-bold text-slate-800 text-xs uppercase flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px]">👤</span>
                                    {order.salesperson}
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-4">
                            <div>
                                <div className="font-bold text-slate-400 text-[10px] uppercase tracking-widest mb-2">Identif. do Projeto</div>
                                <input 
                                    type="text" 
                                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold w-full uppercase bg-slate-50 focus:bg-white transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                    value={projectIdent}
                                    onChange={e => setProjectIdent(e.target.value)}
                                    placeholder="Ex: Projeto Estrutural - 04 Folhas"
                                />
                            </div>
                            <div>
                                <div className="font-bold text-slate-400 text-[10px] uppercase tracking-widest mb-2">Prazo de Entrega</div>
                                <input 
                                    type="text" 
                                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold w-full uppercase bg-slate-50 focus:bg-white transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                    value={deliveryTime}
                                    onChange={e => setDeliveryTime(e.target.value)}
                                    placeholder="Ex: 10 DIAS ÚTEIS"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Add/Edit Item Form */}
                    <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2">
                                <span>{editingItemId ? '✏️' : '➕'}</span> {editingItemId ? 'Editar Linha' : 'Adicionar Nova Linha'}
                            </h3>
                            {editingItemId && (
                                <button 
                                    type="button" 
                                    onClick={() => {
                                        setEditingItemId(null);
                                        setNewItem({ codigo: 'RESUMO', folha: '', descricao: '', tipo: 'CORTE / DOBRA', peso: 0, valor: 0 });
                                        setBitolasQuantities({});
                                    }}
                                    className="text-[10px] font-bold text-slate-500 hover:text-slate-800 uppercase"
                                >
                                    Cancelar Edição
                                </button>
                            )}
                        </div>
                        <form onSubmit={handleAddItem} className="grid grid-cols-6 gap-3">
                            <div className="col-span-12 md:col-span-2">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Cód.</label>
                                <select 
                                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-bold uppercase focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                    value={newItem.codigo} onChange={e => setNewItem({...newItem, codigo: e.target.value})}
                                >
                                    <option value="RESUMO">RESUMO</option>
                                    <option value="ETAPA">ETAPA</option>
                                    <option value="EXTRA">EXTRA</option>
                                </select>
                            </div>
                            <div className="col-span-12 md:col-span-2">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Folha</label>
                                <input 
                                    type="text" className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-bold uppercase focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
                                    value={newItem.folha} onChange={e => setNewItem({...newItem, folha: e.target.value})}
                                    placeholder="Ex: 241" required
                                />
                            </div>
                            <div className="col-span-12 md:col-span-4">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Descrição</label>
                                <input 
                                    type="text" className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-bold uppercase focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
                                    value={newItem.descricao} onChange={e => setNewItem({...newItem, descricao: e.target.value})}
                                    placeholder="Ex: PILARES" required
                                />
                            </div>
                            <div className="col-span-12 md:col-span-4">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tipo</label>
                                <select 
                                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-bold uppercase focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                    value={newItem.tipo} onChange={e => setNewItem({...newItem, tipo: e.target.value})}
                                >
                                    <option value="CORTE / DOBRA">CORTE / DOBRA</option>
                                    <option value="CA50">CA50</option>
                                    <option value="CA60">CA60</option>
                                    <option value="MALHA">MALHA</option>
                                    <option value="ARMADO">ARMADO</option>
                                </select>
                            </div>
                            <div className="col-span-12 md:col-span-6 flex gap-3">
                                <div className="flex-1">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Peso (kg)</label>
                                    <input 
                                        type="number" step="0.01" className="w-full border border-slate-200 bg-slate-100 cursor-not-allowed text-slate-500 rounded-lg p-2.5 text-xs font-bold focus:outline-none" 
                                        value={newItem.peso || ''} 
                                        readOnly
                                        placeholder="Calculado pelas bitolas"
                                        required
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Valor (R$)</label>
                                    <input 
                                        type="number" step="0.01" className="w-full border border-slate-200 bg-slate-100 cursor-not-allowed text-slate-500 rounded-lg p-2.5 text-xs font-bold focus:outline-none" 
                                        value={newItem.valor || ''} 
                                        readOnly
                                        placeholder="Calculado pelas bitolas"
                                        required
                                    />
                                </div>
                            </div>
                            
                            <div className="col-span-12 flex justify-end gap-3 mt-2">
                                <button 
                                    type="button" 
                                    onClick={() => setIsBitolasModalOpen(true)}
                                    className="px-6 py-2 rounded-lg font-bold text-blue-600 bg-white border border-blue-200 hover:bg-blue-50 transition-colors text-sm flex items-center gap-2"
                                >
                                    + Inserir Bitolas
                                </button>
                                <button type="submit" className={`px-6 py-2 rounded-lg font-bold text-white transition-colors text-sm shadow-md flex items-center gap-2 ${editingItemId ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'}`}>
                                    {editingItemId ? '💾 Salvar Alteração' : '➕ Adicionar Item'}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Items Table Section */}
                    <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
                        <div className="p-4 border-b border-slate-200">
                            <h3 className="font-black text-slate-800 text-sm">Itens do Orçamento</h3>
                        </div>
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-white border-b border-slate-200 text-slate-400 text-[10px] uppercase tracking-wider">
                                    <th className="p-3 font-bold">Cód.</th>
                                    <th className="p-3 font-bold text-center">Folha</th>
                                    <th className="p-3 font-bold">Etapa - Descrição</th>
                                    <th className="p-3 font-bold text-center">Tipo</th>
                                    <th className="p-3 font-bold text-right">Peso (kg)</th>
                                    <th className="p-3 font-bold text-right">Valor (R$)</th>
                                    <th className="p-3 font-bold text-center w-20">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    <tr><td colSpan={7} className="p-8 text-center text-slate-500 font-bold">Carregando itens...</td></tr>
                                ) : items.length === 0 ? (
                                    <tr><td colSpan={7} className="p-8 text-center text-slate-400 font-bold">Nenhum item adicionado ainda.</td></tr>
                                ) : (
                                    items.map((item, idx) => (
                                        <tr key={item.id || idx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                            <td className="p-3 text-xs font-bold text-slate-600 uppercase">{item.codigo}</td>
                                            <td className="p-3 text-xs font-black text-slate-800 text-center uppercase">{item.folha}</td>
                                            <td className="p-3 text-xs font-bold text-slate-700 uppercase">{item.descricao}</td>
                                            <td className="p-3 text-xs font-bold text-slate-600 text-center uppercase">{item.tipo}</td>
                                            <td className="p-3 text-sm font-bold text-slate-800 text-right">
                                                {item.peso.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                            </td>
                                            <td className="p-3 text-sm font-black text-emerald-600 text-right">
                                                R$ {item.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                            </td>
                                            <td className="p-3 text-center flex justify-center gap-3">
                                                <button onClick={() => handleEditItem(item)} className="text-slate-400 hover:text-slate-800 font-bold transition-colors" title="Editar">✏️</button>
                                                <button onClick={() => item.id && handleDeleteItem(item.id)} className="text-red-400 hover:text-red-600 font-black transition-colors" title="Excluir">🗑️</button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                        
                    </div>

                    {/* Resumo do Aço */}
                    {summaryRows.length > 0 && (
                        <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden mb-6">
                            <div className="bg-slate-700 p-2 text-center text-white font-black text-sm uppercase tracking-wider">
                                RESUMO DE AÇO
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse min-w-[600px]">
                                    <thead>
                                        <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 text-[10px] uppercase tracking-wider">
                                            <th className="p-3 font-bold w-16">Cód.</th>
                                            <th className="p-3 font-bold">Descrição</th>
                                            <th className="p-3 font-bold text-right w-28">Kg</th>
                                            <th className="p-3 font-bold text-right w-28">R$/Kg</th>
                                            <th className="p-3 font-bold text-right w-32">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {summaryRows.map((row, idx) => (
                                            <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors">
                                                <td className="p-3 text-slate-500">{row.id}</td>
                                                <td className="p-3 uppercase">{row.desc}</td>
                                                <td className="p-3 text-right bg-slate-50/50">{row.kg.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                                <td className="p-3 text-right">R$ {row.pricePerKg.toLocaleString('pt-BR', {minimumFractionDigits: 3, maximumFractionDigits: 3})}</td>
                                                <td className="p-3 text-right text-slate-800">R$ {row.total.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            
                            <div className="bg-slate-200/40 p-4 border-t border-slate-200 flex flex-col items-end gap-2 text-xs">
                                <div className="flex items-center gap-4">
                                    <span className="font-bold text-slate-500 uppercase tracking-wider">Peso Corte / Dobra &gt;&gt;&gt;</span>
                                    <span className="font-black text-slate-800 w-32 text-right text-sm">{totalSummaryKg.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} kg</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="font-bold text-slate-500 uppercase tracking-wider">Valor Corte / Dobra &gt;&gt;&gt;</span>
                                    <span className="font-black text-slate-800 w-32 text-right text-sm">R$ {totalSummaryRs.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Totals Finais */}
                    <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 mb-6 flex flex-col items-end gap-3">
                        <div className="flex items-center gap-6 text-sm">
                            <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Peso Total:</span>
                            <span className="font-black text-slate-800 w-32 text-right">{totalWeight.toLocaleString('pt-BR', {minimumFractionDigits: 2})} kg</span>
                        </div>
                        <div className="flex items-center gap-6 text-sm">
                            <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Condição de Pagamento:</span>
                            <input 
                                type="text" 
                                className="border border-slate-200 rounded px-3 py-1.5 text-sm font-bold w-48 text-right uppercase bg-slate-50 focus:bg-white transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                value={paymentCondition}
                                onChange={e => setPaymentCondition(e.target.value)}
                                placeholder="À VISTA"
                            />
                        </div>
                        <div className="flex items-center gap-6 text-xl mt-3 pt-3 border-t border-slate-200">
                            <span className="font-black text-slate-800 uppercase text-xs tracking-wider">Valor Total:</span>
                            <span className="font-black text-emerald-600 w-32 text-right">R$ {totalValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                        </div>
                    </div>

                    {/* Observações */}
                    <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-5 mb-8">
                        <h4 className="font-black text-blue-800 text-sm flex items-center gap-2 mb-3">
                            <span>ℹ️</span> Observações Importantes
                        </h4>
                        <ul className="text-xs text-blue-900/70 font-medium space-y-1.5 pl-2 list-disc list-inside">
                            <li>Orçamento realizado conforme tabela do resumo. Sujeito a alteração caso divergente do quantitativo real.</li>
                            <li>Ferragem apenas cortada e dobrada, não armada, para os arranques dos pilares, ferragem da laje e escada.</li>
                            <li>Prazo de entrega condicionado à demanda de produção e logística.</li>
                            <li>É de responsabilidade do cliente: descarregamento e conferência do material recebido.</li>
                            <li>Orçamento elaborado de acordo com a leitura e quantificação do projeto. Qualquer alteração, revisão ou inclusão é de total responsabilidade do cliente.</li>
                        </ul>
                    </div>

                </div>
            </div>

            {/* Bitolas Calculator Modal */}
            {isBitolasModalOpen && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4 animate-in fade-in">
                    <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden border-2 border-indigo-500">
                        <div className="bg-indigo-600 p-4 flex justify-between items-center shrink-0">
                            <h3 className="text-lg font-black text-white flex items-center gap-2">
                                <span>⚖️</span> Inserir Bitolas e Quantidades (POR KG)
                            </h3>
                            <button onClick={() => setIsBitolasModalOpen(false)} className="text-indigo-200 hover:text-white transition-colors">
                                ✕ Fechar
                            </button>
                        </div>
                        
                        <div className="p-4 flex-1 overflow-y-auto max-h-[60vh] bg-slate-50">
                            <div className="space-y-2">
                                {gauges.length === 0 ? (
                                    <p className="text-center text-slate-500 p-4">Nenhum material cadastrado em Configuração de Materiais.</p>
                                ) : (
                                    <table className="w-full text-left border-collapse bg-white rounded-lg overflow-hidden shadow-sm border border-slate-200">
                                        <thead>
                                            <tr className="bg-slate-100 text-slate-600 text-[10px] uppercase tracking-wider">
                                                <th className="p-3 font-bold">Material / Dimensão</th>
                                                <th className="p-3 font-bold text-center">Peso Unit.</th>
                                                <th className="p-3 font-bold text-right">R$ / Kg</th>
                                                <th className="p-3 font-bold text-right w-32">Quantidade (Kg)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {gauges.map(g => (
                                                <tr key={g.id} className="border-b border-slate-100 hover:bg-slate-50">
                                                    <td className="p-3 text-sm font-bold text-slate-700 uppercase">
                                                        {g.commercialName || g.materialType} {g.gauge}
                                                    </td>
                                                    <td className="p-3 text-sm font-bold text-slate-500 text-center">
                                                        {String(g.rawWeightValue || 0).replace('.', ',')} kg
                                                    </td>
                                                    <td className="p-3 text-sm font-black text-emerald-600 text-right">
                                                        {(() => {
                                                            const pricePerKg = (g.rawWeightValue && g.rawWeightValue > 0) 
                                                                ? (g.purchasePrice || 0) / g.rawWeightValue 
                                                                : (g.purchasePrice || 0);
                                                            return `R$ ${pricePerKg.toFixed(2)}`;
                                                        })()}
                                                    </td>
                                                    <td className="p-3">
                                                        <input 
                                                            type="number" 
                                                            step="0.01" 
                                                            className="w-full border border-slate-300 rounded p-1 text-right text-sm font-bold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                            placeholder="0.00"
                                                            value={bitolasQuantities[g.id] || ''}
                                                            onChange={e => {
                                                                const val = parseFloat(e.target.value);
                                                                setBitolasQuantities(prev => ({
                                                                    ...prev,
                                                                    [g.id]: isNaN(val) ? 0 : val
                                                                }));
                                                            }}
                                                        />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>

                        <div className="bg-white p-4 border-t border-slate-200 flex justify-between items-center shrink-0">
                            <div className="text-sm font-bold text-slate-500">
                                Preencha os Kg de cada bitola que irá usar.
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setIsBitolasModalOpen(false)} className="px-4 py-2 rounded-lg font-bold text-slate-600 hover:bg-slate-100 transition-colors">
                                    Cancelar
                                </button>
                                <button 
                                    onClick={handleConfirmBitolas} 
                                    className="px-6 py-2 rounded-lg font-black text-white bg-indigo-600 hover:bg-indigo-700 shadow-md transition-all flex items-center gap-2"
                                >
                                    Confirmar e Calcular
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
