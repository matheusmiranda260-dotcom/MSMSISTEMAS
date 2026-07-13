import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

const PurchaseOrdersManager: React.FC = () => {
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

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

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-slate-800">Ordens de Compra</h2>
                <button className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-2 px-4 rounded-xl shadow-md transition-all">
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
        </div>
    );
};

export default PurchaseOrdersManager;
