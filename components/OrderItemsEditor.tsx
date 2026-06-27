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

    const handleSaveOrder = async () => {
        if (!order.id) return;
        setIsSaving(true);
        try {
            // Update the main order with totals and metadata
            await updateItem('commercial_orders', order.id, {
                projectIdent: projectIdent,
                paymentCondition: paymentCondition,
                totalWeight: totalWeight,
                price: totalValue, // Update main price
                status: totalValue > 0 ? (order.status.toLowerCase().includes('incompleto') ? 'Orçamento' : order.status) : order.status
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in">
            <div className="bg-white w-full max-w-6xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="bg-slate-900 p-6 flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-2xl font-black text-white flex items-center gap-3">
                            <span>📋</span> Edição de Orçamento - {order.orderNumber}
                        </h2>
                        <p className="text-slate-400 font-bold text-sm mt-1 uppercase tracking-wider">
                            {order.clientName}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors bg-white/10 hover:bg-white/20 p-2 rounded-lg">
                        ✕ Fechar
                    </button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto space-y-6 bg-slate-50">
                    
                    {/* Header Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <div className="space-y-3">
                            <div><span className="font-bold text-slate-500 text-xs uppercase">Cliente:</span> <span className="font-black text-sm">({order.clientCode}) {order.clientName}</span></div>
                            <div><span className="font-bold text-slate-500 text-xs uppercase">Endereço:</span> <span className="font-bold text-slate-800 text-sm">{order.clientCity || 'N/A'}</span></div>
                            <div><span className="font-bold text-slate-500 text-xs uppercase">Vendedor:</span> <span className="font-bold text-slate-800 text-sm">{order.salesperson}</span></div>
                        </div>
                        <div className="space-y-3">
                            <div><span className="font-bold text-slate-500 text-xs uppercase">Data Orç:</span> <span className="font-bold text-slate-800 text-sm">{order.date.split('-').reverse().join('/')} (PROPOSTA VÁLIDA POR 1 DIA ÚTIL)</span></div>
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-500 text-xs uppercase whitespace-nowrap">Identif. do Projeto:</span>
                                <input 
                                    type="text" 
                                    className="border border-slate-300 rounded px-2 py-1 text-sm font-bold w-full uppercase"
                                    value={projectIdent}
                                    onChange={e => setProjectIdent(e.target.value)}
                                    placeholder="Ex: PROJETO ESTRUTURAL - 04 FOLHAS"
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
                            <div className="col-span-6 md:col-span-1">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Cód.</label>
                                <select 
                                    className="w-full border border-slate-300 rounded-lg p-2 text-xs font-bold uppercase"
                                    value={newItem.codigo} onChange={e => setNewItem({...newItem, codigo: e.target.value})}
                                >
                                    <option value="RESUMO">RESUMO</option>
                                    <option value="ETAPA">ETAPA</option>
                                    <option value="EXTRA">EXTRA</option>
                                </select>
                            </div>
                            <div className="col-span-6 md:col-span-1">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Folha</label>
                                <input 
                                    type="text" className="w-full border border-slate-300 rounded-lg p-2 text-xs font-bold uppercase" 
                                    value={newItem.folha} onChange={e => setNewItem({...newItem, folha: e.target.value})}
                                    placeholder="Ex: 241" required
                                />
                            </div>
                            <div className="col-span-6 md:col-span-2">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Descrição</label>
                                <input 
                                    type="text" className="w-full border border-slate-300 rounded-lg p-2 text-xs font-bold uppercase" 
                                    value={newItem.descricao} onChange={e => setNewItem({...newItem, descricao: e.target.value})}
                                    placeholder="Ex: PILARES PAV TÉRREO" required
                                />
                            </div>
                            <div className="col-span-6 md:col-span-1">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Tipo</label>
                                <select 
                                    className="w-full border border-slate-300 rounded-lg p-2 text-xs font-bold uppercase"
                                    value={newItem.tipo} onChange={e => setNewItem({...newItem, tipo: e.target.value})}
                                >
                                    <option value="CORTE / DOBRA">CORTE / DOBRA</option>
                                    <option value="CA50">CA50</option>
                                    <option value="CA60">CA60</option>
                                    <option value="MALHA">MALHA</option>
                                    <option value="ARMADO">ARMADO</option>
                                </select>
                            </div>
                            <div className="col-span-6 md:col-span-1 flex gap-2">
                                <div className="flex-1">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Peso (kg)</label>
                                    <div className="flex flex-col gap-1">
                                        <input 
                                            type="number" step="0.01" className="w-full border border-slate-300 rounded-lg p-2 text-xs font-bold" 
                                            value={newItem.peso || ''} onChange={e => setNewItem({...newItem, peso: parseFloat(e.target.value) || 0})}
                                            required
                                        />
                                        <button 
                                            type="button" 
                                            onClick={() => setIsBitolasModalOpen(true)}
                                            className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-[10px] font-black uppercase py-1 px-2 rounded border border-indigo-200 transition-colors"
                                        >
                                            + Inserir Bitolas
                                        </button>
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Valor (R$)</label>
                                    <input 
                                        type="number" step="0.01" className="w-full border border-slate-300 rounded-lg p-2 text-xs font-bold" 
                                        value={newItem.valor || ''} onChange={e => setNewItem({...newItem, valor: parseFloat(e.target.value) || 0})}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="col-span-6 flex justify-end">
                                <button type="submit" className={`${editingItemId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-sky-600 hover:bg-sky-700'} text-white font-bold px-6 py-2 rounded-lg text-sm transition-colors shadow-md`}>
                                    {editingItemId ? '💾 Salvar Alteração' : '+ Inserir Linha'}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Items Table */}
                    <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-800 text-white text-[10px] uppercase tracking-wider">
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
                                            <td className="p-3 text-sm font-black text-slate-800 text-right">
                                                {item.peso.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                            </td>
                                            <td className="p-3 text-sm font-black text-emerald-600 text-right">
                                                R$ {item.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                            </td>
                                            <td className="p-3 text-center flex justify-center gap-2">
                                                <button onClick={() => handleEditItem(item)} className="text-amber-500 hover:text-amber-600 font-bold" title="Editar">✏️</button>
                                                <button onClick={() => item.id && handleDeleteItem(item.id)} className="text-red-400 hover:text-red-600 font-black" title="Excluir">✕</button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                        
                        {/* Totals */}
                        <div className="bg-slate-50 p-4 border-t border-slate-200 flex flex-col items-end gap-2">
                            <div className="flex items-center gap-4 text-sm">
                                <span className="font-bold text-slate-500 uppercase">Peso Total:</span>
                                <span className="font-black text-slate-800 w-32 text-right">{totalWeight.toLocaleString('pt-BR', {minimumFractionDigits: 2})} kg</span>
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                                <span className="font-bold text-slate-500 uppercase">Condição de Pgto:</span>
                                <input 
                                    type="text" 
                                    className="border border-slate-300 rounded px-2 py-1 text-sm font-bold w-32 text-right uppercase"
                                    value={paymentCondition}
                                    onChange={e => setPaymentCondition(e.target.value)}
                                    placeholder="Ex: À Vista"
                                />
                            </div>
                            <div className="flex items-center gap-4 text-lg mt-2">
                                <span className="font-black text-slate-700 uppercase">Valor Total:</span>
                                <span className="font-black text-emerald-600 w-32 text-right">R$ {totalValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="bg-white p-4 border-t border-slate-200 flex justify-end gap-3 shrink-0">
                    <button onClick={onClose} className="px-6 py-2 rounded-lg font-bold text-slate-600 hover:bg-slate-100 transition-colors">
                        Cancelar
                    </button>
                    <button 
                        onClick={handleSaveOrder} 
                        disabled={isSaving}
                        className="px-6 py-2 rounded-lg font-black text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                        {isSaving ? 'Salvando...' : '✅ Salvar Orçamento'}
                    </button>
                </div>
            </div>

            {/* Bitolas Calculator Modal */}
            {isBitolasModalOpen && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4 animate-in fade-in">
                    <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden border-2 border-indigo-500">
                        <div className="bg-indigo-600 p-4 flex justify-between items-center shrink-0">
                            <h3 className="text-lg font-black text-white flex items-center gap-2">
                                <span>⚖️</span> Inserir Bitolas e Quantidades
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
