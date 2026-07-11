import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { ChartBarIcon, DatabaseIcon, RefreshIcon } from './icons'; // Adjust if icons differ

export default function DatabaseMetrics() {
    const [metrics, setMetrics] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const fetchMetrics = async () => {
        setLoading(true);
        try {
            const tables = [
                { name: 'user_access_logs', label: 'Logs de Acesso' },
                { name: 'conferences', label: 'Conferências (NFs)' },
                { name: 'production_orders', label: 'Ordens de Produção' },
                { name: 'machine_orders', label: 'Ordens de Máquina' },
                { name: 'machine_stops', label: 'Paradas de Máquina' },
                { name: 'stock_items', label: 'Estoque Ativo' },
                { name: 'transfers', label: 'Transferências' },
                { name: 'shift_reports', label: 'Relatórios de Turno' },
            ];

            const results: Record<string, number> = {};

            // Fetch counts using HEAD requests via supabase REST (exact count)
            for (const table of tables) {
                const { count, error } = await supabase
                    .from(table.name)
                    .select('*', { count: 'exact', head: true });
                
                if (error) {
                    console.error(`Erro ao contar ${table.name}:`, error);
                    results[table.label] = 0;
                } else {
                    results[table.label] = count || 0;
                }
            }

            setMetrics(results);
        } catch (error) {
            console.error("Failed to fetch database metrics", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMetrics();
    }, []);

    return (
        <div className="p-6 max-w-7xl mx-auto animate-fadeIn">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-black text-white flex items-center gap-3">
                        <svg className="w-8 h-8 text-[#00E5FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                        </svg>
                        Métricas do Banco de Dados
                    </h1>
                    <p className="text-slate-400 mt-2">Acompanhe o volume de registros e o uso de armazenamento do sistema em tempo real.</p>
                </div>
                <button
                    onClick={fetchMetrics}
                    disabled={loading}
                    className="bg-[#00E5FF]/10 text-[#00E5FF] border border-[#00E5FF]/30 px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-[#00E5FF]/20 transition-all font-bold disabled:opacity-50"
                >
                    <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Atualizar Dados
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00E5FF]"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {metrics && Object.entries(metrics).map(([label, count]: [string, any]) => {
                        // Calculate an arbitrary "health" percentage (e.g. out of 4000) for visual flair
                        const limit = 4000;
                        const percentage = Math.min(100, Math.round((count / limit) * 100));
                        const isWarning = percentage > 80;

                        return (
                            <div key={label} className="bg-[#0A2A3D]/80 backdrop-blur-md border border-white/10 rounded-2xl p-6 flex flex-col relative overflow-hidden group hover:border-[#00E5FF]/30 transition-colors">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#00E5FF]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-full blur-2xl -mr-10 -mt-10"></div>
                                
                                <span className="text-slate-400 font-bold text-sm mb-4">{label}</span>
                                <div className="flex items-end gap-2 mb-4">
                                    <span className="text-4xl font-black text-white">{count}</span>
                                    <span className="text-slate-500 text-sm mb-1 font-medium">registros</span>
                                </div>
                                
                                <div className="mt-auto">
                                    <div className="flex justify-between text-xs font-bold mb-1">
                                        <span className={isWarning ? 'text-amber-400' : 'text-slate-400'}>Ocupação da Tela (Top 4k)</span>
                                        <span className={isWarning ? 'text-amber-400' : 'text-[#00E5FF]'}>{percentage}%</span>
                                    </div>
                                    <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                                        <div 
                                            className={`h-1.5 rounded-full ${isWarning ? 'bg-amber-400' : 'bg-[#00E5FF]'}`} 
                                            style={{ width: `${percentage}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
