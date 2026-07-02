import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import type { User, CommercialOrder, ProductionOrderData } from '../types';

interface MobileOperatorPanelProps {
    currentUser: User;
    onLogout: () => void;
    allProgrammedOrders: ProductionOrderData[];
    commercialOrders: CommercialOrder[];
    customers: any[];
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

const MobileOperatorPanel: React.FC<MobileOperatorPanelProps> = ({ currentUser, onLogout, allProgrammedOrders, commercialOrders, customers }) => {
    const assignedMachines = currentUser.assignedMachines || [];
    const [selectedMachine, setSelectedMachine] = useState<string>(assignedMachines[0] || '');
    const [searchQuery, setSearchQuery] = useState('');
    
    // Shift State
    const [isOnline, setIsOnline] = useState(currentUser.isOnline || false);

    // Modal state
    const [activeModalPoId, setActiveModalPoId] = useState<string | null>(null);
    const [subOsSearch, setSubOsSearch] = useState('');
    const [activeSubOs, setActiveSubOs] = useState<any>(null);

    const toggleShift = async () => {
        const newValue = !isOnline;
        setIsOnline(newValue);
        try {
            const { error } = await supabase.from('app_users').update({ is_online: newValue }).eq('id', currentUser.id);
            if (error) {
                console.error('Error toggling shift:', error);
                alert('Erro ao alterar status do turno: ' + error.message);
                setIsOnline(!newValue);
            }
        } catch (e) {
            console.error('Error toggling shift:', e);
            alert('Erro de conexão ao alterar turno.');
            setIsOnline(!newValue);
        }
    };

    const handleOpenModal = (osId: string) => {
        setActiveModalPoId(osId);
        setSubOsSearch('');
        setActiveSubOs(null);
    };

    const handleStartSubOs = async (osId: string, subOsKey: string) => {
        try {
            const po = allProgrammedOrders.find(p => p.id === osId);
            if (!po) return;
            
            let currentProgress = po.sub_items_progress;
            if (typeof currentProgress === 'string') {
                try { currentProgress = JSON.parse(currentProgress); } catch(e) { currentProgress = {}; }
            }
            currentProgress = currentProgress || {};
            
            const startTime = new Date().toISOString();
            
            const updatedProgress = {
                ...currentProgress,
                [subOsKey]: { status: 'producing', start_time: startTime }
            };

            await supabase
                .from('production_orders')
                .update({ 
                    sub_items_progress: updatedProgress, 
                    ...(po.status !== 'producing' ? { status: 'producing', start_time: startTime } : {})
                })
                .eq('id', osId);
                
        } catch (e) {
            console.error('Erro ao iniciar mini OS:', e);
            alert('Erro ao iniciar corte da peça.');
        }
    };

    const handleFinishSubOs = async (osId: string, subOsKey: string) => {
        try {
            const po = allProgrammedOrders.find(p => p.id === osId);
            if (!po) return;
            
            let currentProgress = po.sub_items_progress;
            if (typeof currentProgress === 'string') {
                try { currentProgress = JSON.parse(currentProgress); } catch(e) { currentProgress = {}; }
            }
            currentProgress = currentProgress || {};
            const endTime = new Date().toISOString();
            const existingStart = currentProgress[subOsKey]?.start_time || currentProgress[subOsKey]?.startTime;
            
            const updatedProgress = {
                ...currentProgress,
                [subOsKey]: { status: 'completed', start_time: existingStart, end_time: endTime }
            };

            await supabase
                .from('production_orders')
                .update({ sub_items_progress: updatedProgress })
                .eq('id', osId);
                
            setSubOsSearch('');
            setActiveSubOs(null);
        } catch (e) {
            console.error('Erro ao finalizar mini OS:', e);
            alert('Erro ao finalizar corte da peça.');
        }
    };

    const handleFinishProductionBatch = async (osId: string) => {
        try {
            const endTime = new Date().toISOString();
            await supabase
                .from('production_orders')
                .update({ status: 'completed', end_time: endTime })
                .eq('id', osId);
                
            setAllProgrammedOrders(prev => prev.filter(po => po.id !== osId));
            setActiveModalPoId(null);
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
        const matchMachine = String(po.machine).trim().toLowerCase() === String(selectedMachine).trim().toLowerCase();
        const matchQuery = !searchQuery || String(po.orderNumber).toLowerCase().includes(searchQuery.toLowerCase());
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
                
                <div className="mt-2">
                    <button 
                        onClick={toggleShift}
                        className={`w-full py-4 rounded-xl font-black text-[15px] uppercase shadow-sm transition-all active:scale-95 flex items-center justify-center gap-3 ${
                            isOnline 
                                ? 'bg-rose-50 hover:bg-rose-100 text-rose-600 border-2 border-rose-200' 
                                : 'bg-emerald-500 hover:bg-emerald-600 text-white border-2 border-emerald-400'
                        }`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 5.636a9 9 0 1012.728 0M12 3v9" />
                        </svg>
                        {isOnline ? '🔴 DESLIGAR MÁQUINA (ENCERRAR TURNO)' : '🟢 LIGAR MÁQUINA (INICIAR TURNO)'}
                    </button>
                </div>
            </header>

            <main className="flex-1 p-4 flex flex-col gap-4 max-w-lg w-full mx-auto">
                <div className="relative">
                    <input 
                        type="text" 
                        inputMode="numeric"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Pesquisar número Pedido..."
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
                        const commOrder = commercialOrders.find(co => co.id === (po as any).related_commercial_order_id);
                        const isProducing = po.status === 'producing';
                        
                        // Determinar o comprimento (tamanho) da peça
                        const lengthCm = (po as any).tamanho || ((po as any).total_meters && (po as any).quantity_os ? Math.round(((po as any).total_meters / (po as any).quantity_os) * 100) : 0);
                        
                        return (
                            <div key={po.id} className={`bg-white rounded-2xl p-5 shadow-sm border-l-8 flex flex-col gap-4 transition-all ${isProducing ? 'border-orange-400 shadow-md ring-2 ring-orange-200' : 'border-indigo-500'}`}>
                                <div className="flex justify-between items-start">
                                    <div className="flex-1 pr-2">
                                        <div className="flex flex-col gap-1">
                                            {((commOrder as any)?.order_number || commOrder?.orderNumber) && (
                                                <p className="text-sm font-bold text-slate-600 bg-slate-100 rounded px-2 py-1 inline-block self-start">
                                                    Pedido #{((commOrder as any)?.order_number || commOrder?.orderNumber)}
                                                </p>
                                            )}
                                            {((commOrder as any)?.client_name || commOrder?.clientName) && (
                                                <p className="text-sm font-semibold text-slate-700 mt-1">
                                                    <span className="text-slate-400 font-normal">Cliente:</span> {((commOrder as any)?.client_name || commOrder?.clientName)}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="bg-slate-100 px-3 py-1.5 rounded-lg text-center shrink-0">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Bitola</p>
                                        <p className="font-black text-lg text-slate-700">{(po as any).target_bitola || po.targetBitola}mm</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Quantidade / Tam.</p>
                                        <p className="font-bold text-slate-800 text-sm">{((po as any).quantity_os || (po as any).quantityOs || 0)} un. {lengthCm > 0 && <span className="text-indigo-600">({lengthCm} cm)</span>}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Peso Total</p>
                                        <p className="font-bold text-slate-800 text-sm">{parseFloat(((po as any).total_weight || (po as any).totalWeight || '0').toString()).toFixed(2)} kg</p>
                                    </div>
                                </div>
                                
                                {(() => {
                                    let subItems: any[] = [];
                                    const rawProjectData = (commOrder as any)?.project_data || commOrder?.projectData;
                                    
                                    if (rawProjectData && Array.isArray(rawProjectData)) {
                                        const normalizedData = rawProjectData.map(item => {
                                            const newItem: any = {};
                                            for (const key in item) {
                                                newItem[key.trim().toLowerCase()] = item[key];
                                            }
                                            return newItem;
                                        });
                                        subItems = normalizedData.filter(item => {
                                            const mm = item.mm || item.bitola || item.diametro || item.bit;
                                            const poBitola = (po as any).target_bitola || po.targetBitola || '0';
                                            return parseFloat(String(mm).replace(',', '.').replace(/[^\d.-]/g, '')) === parseFloat(String(poBitola).replace(',', '.').replace(/[^\d.-]/g, ''));
                                        });
                                    }
                                    
                                    if (subItems.length === 0) return null;

                                    return (
                                        <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden mt-1">
                                            <div className="bg-slate-200/70 px-3 py-2 border-b border-slate-200">
                                                <p className="text-[10px] font-black text-slate-600 uppercase tracking-wider">Itens para Produzir (OS Individuais)</p>
                                            </div>
                                            <div className="max-h-48 overflow-y-auto">
                                                <table className="w-full text-xs text-left">
                                                    <thead className="bg-slate-100 text-slate-500 sticky top-0 shadow-sm">
                                                        <tr>
                                                            <th className="px-3 py-1.5 font-bold uppercase">OS</th>
                                                            <th className="px-2 py-1.5 font-bold uppercase">POS</th>
                                                            <th className="px-2 py-1.5 font-bold uppercase">QTD</th>
                                                            <th className="px-2 py-1.5 font-bold uppercase">COMP.</th>
                                                            <th className="px-2 py-1.5 font-bold uppercase">Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {subItems.map((item, idx) => {
                                                            const status = po.sub_items_progress?.[item.os]?.status;
                                                            return (
                                                                <tr key={idx} className={`transition-colors ${status === 'completed' ? 'bg-emerald-50/70 opacity-50' : status === 'producing' ? 'bg-orange-50 animate-pulse' : 'hover:bg-indigo-50/50'}`}>
                                                                    <td className="px-3 py-2 font-black text-slate-700">{item.os || '-'}</td>
                                                                    <td className="px-2 py-2 font-bold text-slate-600">{item.pos || '-'}</td>
                                                                    <td className="px-2 py-2 font-semibold text-slate-800">{item.qunti || item.quantidade || item.qtd || '-'}</td>
                                                                    <td className="px-2 py-2 font-semibold text-slate-600">{item.comprimento || item.comp || '-'}</td>
                                                                    <td className="px-2 py-2 font-black">
                                                                        {status === 'completed' && <span className="text-emerald-500">✅</span>}
                                                                        {status === 'producing' && <span className="text-orange-500">⏱️</span>}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    );
                                })()}
                                
                                {isProducing && po.startTime && (
                                    <div className="bg-orange-50 rounded-xl p-4 flex flex-col items-center justify-center border border-orange-200">
                                        <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest animate-pulse mb-1">Em Execução Global</span>
                                        <ActiveTimer startTime={po.startTime} />
                                    </div>
                                )}

                                {!isProducing ? (
                                    <button 
                                        onClick={() => handleOpenModal(po.id)}
                                        className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 rounded-xl text-lg uppercase shadow-sm active:scale-95 transition-all"
                                    >
                                        Iniciar Produção
                                    </button>
                                ) : (
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => handleOpenModal(po.id)}
                                            className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white font-black py-5 rounded-xl text-lg uppercase shadow-md active:scale-95 transition-all"
                                        >
                                            CONTINUAR CORTE
                                        </button>
                                        <button 
                                            onClick={() => handleFinishProductionBatch(po.id)}
                                            className="flex-none px-4 bg-red-500 hover:bg-red-600 text-white font-black py-5 rounded-xl text-sm uppercase shadow-md active:scale-95 transition-all"
                                        >
                                            FINALIZAR
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </main>

            {/* MODAL DE EXECUÇÃO INDIVIDUAL */}
            {activeModalPoId && (() => {
                const po = allProgrammedOrders.find(p => p.id === activeModalPoId);
                if (!po) return null;
                const commOrder = commercialOrders.find(co => co.id === (po as any).related_commercial_order_id);
                
                let subItems: any[] = [];
                const rawProjectData = (commOrder as any)?.project_data || commOrder?.projectData;
                if (rawProjectData && Array.isArray(rawProjectData)) {
                    const normalizedData = rawProjectData.map(item => {
                        const newItem: any = {};
                        for (const key in item) {
                            newItem[key.trim().toLowerCase()] = item[key];
                        }
                        return newItem;
                    });
                    subItems = normalizedData.filter(item => {
                        const mm = item.mm || item.bitola || item.diametro || item.bit;
                        const poBitola = (po as any).target_bitola || po.targetBitola || '0';
                        return parseFloat(String(mm).replace(',', '.').replace(/[^\d.-]/g, '')) === parseFloat(String(poBitola).replace(',', '.').replace(/[^\d.-]/g, ''));
                    });
                }

                const handleSearch = () => {
                    if (!subOsSearch.trim()) return;
                    const found = subItems.find(s => String(s.os).trim() === subOsSearch.trim());
                    if (found) {
                        setActiveSubOs(found);
                    } else {
                        alert('O.S. não encontrada neste lote de bitola.');
                        setActiveSubOs(null);
                    }
                };

                const currentItemStatus = activeSubOs ? po.sub_items_progress?.[activeSubOs.os]?.status : null;
                const currentItemStart = activeSubOs ? (po.sub_items_progress?.[activeSubOs.os]?.start_time || po.sub_items_progress?.[activeSubOs.os]?.startTime) : null;

                return (
                    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                        <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden flex flex-col">
                            <div className="bg-[#0F3F5C] p-4 flex justify-between items-center text-white">
                                <div>
                                    <h2 className="font-black text-xl tracking-tight">Execução Detalhada</h2>
                                    <p className="text-xs text-indigo-200">Lote Bitola {(po as any).target_bitola || po.targetBitola}mm</p>
                                </div>
                                <button onClick={() => setActiveModalPoId(null)} className="p-2 bg-white/10 rounded-full hover:bg-white/20">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                            
                            <div className="p-6 flex flex-col gap-6">
                                <div>
                                    <label className="text-sm font-bold text-slate-600 block mb-2">Digite o número da OS:</label>
                                    <div className="flex gap-2">
                                        <input 
                                            type="text" 
                                            inputMode="numeric"
                                            value={subOsSearch}
                                            onChange={e => setSubOsSearch(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleSearch()}
                                            placeholder="Ex: 147"
                                            className="flex-1 bg-slate-100 border-2 border-slate-200 rounded-xl px-4 py-3 text-lg font-black text-slate-800 focus:outline-none focus:border-indigo-500"
                                        />
                                        <button onClick={handleSearch} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 rounded-xl flex items-center justify-center">
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
                                        </button>
                                    </div>
                                </div>

                                {activeSubOs && (
                                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col gap-4">
                                        <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                                            <h3 className="font-black text-3xl text-slate-800 tracking-tighter">O.S. {activeSubOs.os}</h3>
                                            <div className="bg-slate-200 px-3 py-1 rounded-lg text-slate-600 font-bold text-sm uppercase">POS {activeSubOs.pos}</div>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase">Quantidade</p>
                                                <p className="font-black text-slate-700 text-xl">{activeSubOs.qunti || activeSubOs.quantidade || activeSubOs.qtd || '-'} un.</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase">Comprimento</p>
                                                <p className="font-black text-slate-700 text-xl">{activeSubOs.comprimento || activeSubOs.comp || '-'} cm</p>
                                            </div>
                                        </div>

                                        <div className="mt-2 pt-4 border-t border-slate-200">
                                            {currentItemStatus === 'completed' ? (
                                                <div className="bg-emerald-100 text-emerald-700 font-black p-4 rounded-xl text-center flex flex-col items-center gap-2">
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8"><path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" /></svg>
                                                    Corte Concluído!
                                                </div>
                                            ) : currentItemStatus === 'producing' ? (
                                                <div className="flex flex-col gap-3">
                                                    <div className="flex justify-between items-center text-xs text-slate-500 font-bold px-1">
                                                        <span>QUANTIDADE</span>
                                                        <span>COMPRIMENTO</span>
                                                    </div>
                                                    <div className="flex justify-between items-center bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
                                                        <span className="font-black text-xl text-slate-800">{activeSubOs.quantidade || activeSubOs.qtd} un.</span>
                                                        <span className="font-black text-xl text-slate-800">{activeSubOs.comprimento || activeSubOs.comp} cm</span>
                                                    </div>
                                                    <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-4 flex flex-col items-center justify-center gap-1 shadow-inner">
                                                        <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Em Andamento</span>
                                                        <ActiveTimer startTime={currentItemStart!} />
                                                    </div>
                                                    <button onClick={() => handleFinishSubOs(po.id, activeSubOs.os)} className="w-full bg-red-500 hover:bg-red-600 text-white font-black py-4 rounded-xl text-lg uppercase shadow-md active:scale-95 transition-all">
                                                        Finalizar Corte
                                                    </button>
                                                </div>
                                            ) : (
                                                <button onClick={() => handleStartSubOs(po.id, activeSubOs.os)} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 rounded-xl text-lg uppercase shadow-sm active:scale-95 transition-all">
                                                    Iniciar Corte
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

export default MobileOperatorPanel;
