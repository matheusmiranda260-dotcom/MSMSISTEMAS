import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

interface PurchaseOrdersManagerProps {
    activeBrandingPartner?: any;
}

const PurchaseOrdersManager: React.FC<PurchaseOrdersManagerProps> = ({ activeBrandingPartner }) => {
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);

    // Form state
    const [partName, setPartName] = useState('');
    const [machineName, setMachineName] = useState('');
    const [quantity, setQuantity] = useState('1');
    const [requesterName, setRequesterName] = useState('');
    const [supplierName, setSupplierName] = useState('');
    const [estimatedCost, setEstimatedCost] = useState('');
    const [status, setStatus] = useState('Pendente');
    const [priority, setPriority] = useState('Média');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('machine_purchase_orders')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) {
                console.error('Error fetching purchase orders:', error);
            } else {
                setOrders(data || []);
            }
        } catch (err) {
            console.error('Error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const { error } = await supabase
                .from('machine_purchase_orders')
                .insert([{
                    part_name: partName,
                    machine_name: machineName,
                    quantity: parseInt(quantity, 10),
                    requester_name: requesterName,
                    supplier_name: supplierName,
                    estimated_cost: estimatedCost ? parseFloat(estimatedCost) : 0,
                    status,
                    priority,
                    notes
                }]);

            if (error) throw error;

            setShowModal(false);
            fetchOrders();
            
            // Reset form
            setPartName('');
            setMachineName('');
            setQuantity('1');
            setRequesterName('');
            setSupplierName('');
            setEstimatedCost('');
            setStatus('Pendente');
            setPriority('Média');
            setNotes('');
        } catch (err) {
            console.error('Error saving order:', err);
            alert('Erro ao salvar ordem de compra.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-6 relative">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-slate-800">Ordens de Compra</h2>
                <button 
                    onClick={() => setShowModal(true)}
                    className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-2 px-4 rounded-xl shadow-md transition-all"
                >
                    + Solicitar Peça
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600"></div></div>
            ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                                <th className="p-4 font-bold">Peça</th>
                                <th className="p-4 font-bold">Máquina</th>
                                <th className="p-4 font-bold">Qtd</th>
                                <th className="p-4 font-bold">Solicitante</th>
                                <th className="p-4 font-bold">Status</th>
                                <th className="p-4 font-bold">Data Solicitação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {orders.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-slate-500 font-medium">Nenhuma ordem de compra registrada.</td>
                                </tr>
                            ) : (
                                orders.map(item => (
                                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4 font-bold text-slate-800">{item.part_name}</td>
                                        <td className="p-4 text-slate-600">{item.machine_name || '-'}</td>
                                        <td className="p-4 font-bold text-slate-600">{item.quantity}</td>
                                        <td className="p-4 text-slate-600">{item.requester_name}</td>
                                        <td className="p-4">
                                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                                                {item.status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-slate-600">
                                            {item.created_at ? new Date(item.created_at).toLocaleDateString('pt-BR') : '-'}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-slate-800">Nova Ordem de Compra</h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Peça Solicitada *</label>
                                    <input required value={partName} onChange={e => setPartName(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/50 text-slate-700" placeholder="Ex: Rolamento 6205" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Máquina Relacionada</label>
                                    {activeBrandingPartner?.machines?.length > 0 ? (
                                        <select value={machineName} onChange={e => setMachineName(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/50 text-slate-700">
                                            <option value="">Nenhuma / Geral</option>
                                            {activeBrandingPartner.machines.map((m: any, idx: number) => (
                                                <option key={idx} value={m.name}>{m.name}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input value={machineName} onChange={e => setMachineName(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/50 text-slate-700" placeholder="Ex: Trefila 2" />
                                    )}
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Quantidade *</label>
                                    <input required type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/50 text-slate-700" />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Solicitante *</label>
                                    <input required value={requesterName} onChange={e => setRequesterName(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/50 text-slate-700" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                                    <select value={status} onChange={e => setStatus(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/50 text-slate-700">
                                        <option value="Pendente">Pendente</option>
                                        <option value="Aprovada">Aprovada</option>
                                        <option value="Comprada">Comprada</option>
                                        <option value="Entregue">Entregue</option>
                                        <option value="Cancelada">Cancelada</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Prioridade</label>
                                    <select value={priority} onChange={e => setPriority(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/50 text-slate-700">
                                        <option value="Baixa">Baixa</option>
                                        <option value="Média">Média</option>
                                        <option value="Alta">Alta</option>
                                        <option value="Urgente">Urgente</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fornecedor (Opcional)</label>
                                    <input value={supplierName} onChange={e => setSupplierName(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/50 text-slate-700" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Custo Estimado (R$)</label>
                                    <input type="number" step="0.01" value={estimatedCost} onChange={e => setEstimatedCost(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/50 text-slate-700" placeholder="0.00" />
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Observações Adicionais</label>
                                <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/50 text-slate-700 resize-none"></textarea>
                            </div>

                            <div className="mt-4 flex justify-end gap-3 pt-4 border-t border-slate-100">
                                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors">
                                    Cancelar
                                </button>
                                <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-xl font-bold text-white bg-sky-600 hover:bg-sky-700 transition-colors disabled:opacity-50 flex items-center gap-2">
                                    {saving && <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                                    {saving ? 'Salvando...' : 'Criar Ordem'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PurchaseOrdersManager;
