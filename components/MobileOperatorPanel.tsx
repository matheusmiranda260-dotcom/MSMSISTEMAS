import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import type { User, CommercialOrder } from '../types';

interface MobileOperatorPanelProps {
    currentUser: User;
    onLogout: () => void;
}

const ActiveTimer = ({ startTime }: { startTime: string }) => {
    const [elapsed, setElapsed] = useState('');

    useEffect(() => {
        if (!startTime) return;
        
        const updateTimer = () => {
            const start = new Date(startTime).getTime();
            const now = new Date().getTime();
            const diff = Math.max(0, now - start);
            
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            
            setElapsed(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
        };
        
        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [startTime]);

    return <span className="font-mono text-3xl font-black tracking-wider text-slate-800 tabular-nums">{elapsed || '00:00:00'}</span>;
};

const MobileOperatorPanel: React.FC<MobileOperatorPanelProps> = ({ currentUser, onLogout }) => {
    const assignedMachines = currentUser.assignedMachines || [];
    const [selectedMachine, setSelectedMachine] = useState<string>(assignedMachines[0] || '');
    const [searchQuery, setSearchQuery] = useState('');
    const [allProgrammedOrders, setAllProgrammedOrders] = useState<any[]>([]);
    const [commercialOrders, setCommercialOrders] = useState<CommercialOrder[]>([]);

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                const { data: coData } = await supabase.from('commercial_orders').select('*');
                if (coData) setCommercialOrders(coData);

                const { data: poData } = await supabase.from('production_orders')
                    .select('id, machine, creation_date, total_weight, total_meters, target_bitola, status, order_number, quantity_os, related_commercial_order_id, start_time, end_time')
                    .in('status', ['in_progress', 'producing']);
                
                if (poData) setAllProgrammedOrders(poData);
            } catch (e) {
                console.error(e);
            }
        };

        fetchOrders();
        
        const interval = setInterval(fetchOrders, 30000);
        return () => clearInterval(interval);
    }, []);

    const handleStartProduction = async (osId: string) => {
        try {
            const startTime = new Date().toISOString();
            await supabase
                .from('production_orders')
                .update({ status: 'producing', start_time: startTime })
                .eq('id', osId);
                
            setAllProgrammedOrders(prev => prev.map(po => 
                po.id === osId ? { ...po, status: 'producing', start_time: startTime } : po
            ));
        } catch (e) {
            console.error('Erro ao iniciar produção:', e);
            alert('Erro ao iniciar produção.');
        }
    };

    const handleFinishProduction = async (osId: string) => {
        try {
            const endTime = new Date().toISOString();
            await supabase
                .from('production_orders')
                .update({ status: 'completed', end_time: endTime })
                .eq('id', osId);
                
            setAllProgrammedOrders(prev => prev.filter(po => po.id !== osId));
        } catch (e) {
            console.error('Erro ao finalizar produção:', e);
            alert('Erro ao finalizar produção.');
        }
    };

    if (assignedMachines.length === 0) {
        return (
            <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
                <div className="bg-white p-6 rounded-2xl shadow-xl max-w-sm w-full text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-red-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <h2 className="text-xl font-bold text-slate-800 mb-2">Sem Máquina Vinculada</h2>
                    <p className="text-sm text-slate-500 mb-6">Peça ao seu gestor para vincular uma máquina ao seu usuário.</p>
                    <button onClick={onLogout} className="w-full bg-slate-800 text-white font-bold py-3 rounded-xl">Sair</button>
                </div>
            </div>
        );
    }

    const osList = allProgrammedOrders.filter(po => {
        const matchMachine = po.machine === selectedMachine;
        const matchQuery = !searchQuery || String(po.order_number).toLowerCase().includes(searchQuery.toLowerCase());
        return matchMachine && matchQuery;
    });

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            <header className="bg-[#0F3F5C] text-white p-4 shadow-md sticky top-0 z-10 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-xl font-black uppercase tracking-tight">Painel Operador</h1>
                        <p className="text-xs text-indigo-200">Olá, {currentUser.username}</p>
                    </div>
                    <button onClick={onLogout} className="p-2 bg-white/10 rounded-lg hover:bg-white/20">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
                        </svg>
                    </button>
                </div>
                
                {assignedMachines.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
                        {assignedMachines.map(m => (
                            <button
                                key={m}
                                onClick={() => setSelectedMachine(m)}
                                className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors ${selectedMachine === m ? 'bg-white text-[#0F3F5C]' : 'bg-white/10 text-white'}`}
                            >
                                {m}
                            </button>
                        ))}
                    </div>
                )}
            </header>

            <main className="flex-1 p-4 flex flex-col gap-4 max-w-lg w-full mx-auto">
                <div className="relative">
                    <input 
                        type="text" 
                        inputMode="numeric"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Pesquisar número O.S..."
                        className="w-full pl-12 pr-4 py-4 bg-white border-2 border-slate-200 rounded-2xl text-lg font-bold text-slate-800 focus:outline-none focus:border-indigo-500 shadow-sm"
                    />
                    <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <circle cx="11" cy="11" r="8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m21 21-4.3-4.3"/>
                    </svg>
                </div>

                <div className="flex justify-between items-end px-1">
                    <h2 className="font-black text-slate-800 text-lg uppercase tracking-tight">{selectedMachine}</h2>
                    <span className="text-xs font-bold text-slate-500 bg-slate-200 px-2 py-1 rounded-md">{osList.length} O.S. Pendentes</span>
                </div>

                <div className="flex flex-col gap-4 pb-10">
                    {osList.length === 0 && (
                        <div className="bg-white rounded-2xl p-8 text-center border-2 border-dashed border-slate-200 mt-4">
                            <p className="text-slate-500 font-bold uppercase">Nenhuma O.S na fila</p>
                        </div>
                    )}
                    
                    {osList.map(po => {
                        const commOrder = commercialOrders.find(co => co.id === po.related_commercial_order_id);
                        const isProducing = po.status === 'producing';
                        
                        return (
                            <div key={po.id} className={`bg-white rounded-2xl p-5 shadow-sm border-l-8 flex flex-col gap-4 transition-all ${isProducing ? 'border-orange-400 shadow-md ring-2 ring-orange-200' : 'border-indigo-500'}`}>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-black text-2xl text-slate-800 mb-1 tracking-tighter">O.S. #{po.order_number}</h3>
                                        {commOrder?.orderNumber && (
                                            <p className="text-sm font-bold text-slate-500">Pedido #{commOrder.orderNumber}</p>
                                        )}
                                    </div>
                                    <div className="bg-slate-100 px-3 py-1.5 rounded-lg text-center">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Bitola</p>
                                        <p className="font-black text-lg text-slate-700">{po.target_bitola}mm</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Quantidade</p>
                                        <p className="font-bold text-slate-800 text-sm">{po.quantity_os} Un.</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Peso Total</p>
                                        <p className="font-bold text-slate-800 text-sm">{parseFloat(po.total_weight?.toString() || '0').toFixed(2)} kg</p>
                                    </div>
                                </div>
                                
                                {isProducing && po.start_time && (
                                    <div className="bg-orange-50 rounded-xl p-4 flex flex-col items-center justify-center border border-orange-200">
                                        <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest animate-pulse mb-1">Em Execução</span>
                                        <ActiveTimer startTime={po.start_time} />
                                    </div>
                                )}

                                {!isProducing ? (
                                    <button 
                                        onClick={() => handleStartProduction(po.id)}
                                        className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 rounded-xl text-lg uppercase shadow-sm active:scale-95 transition-all"
                                    >
                                        Iniciar Produção
                                    </button>
                                ) : (
                                    <button 
                                        onClick={() => handleFinishProduction(po.id)}
                                        className="w-full bg-red-500 hover:bg-red-600 text-white font-black py-5 rounded-xl text-xl uppercase shadow-md active:scale-95 transition-all animate-pulse"
                                    >
                                        FINALIZAR O.S.
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </main>
        </div>
    );
};

export default MobileOperatorPanel;
