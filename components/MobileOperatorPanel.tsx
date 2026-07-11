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
    
    // Polled orders fallback and visual feedback state
    const [localOrders, setLocalOrders] = useState<ProductionOrderData[]>(allProgrammedOrders.filter(po => po.status !== 'pending'));
    const [loadingAction, setLoadingAction] = useState<string | null>(null);

    useEffect(() => {
        if (allProgrammedOrders.length > 0) {
            setLocalOrders(allProgrammedOrders.filter(po => po.status !== 'pending'));
        }
    }, [allProgrammedOrders]);

    useEffect(() => {
        const fetchOrders = async () => {
            const { data } = await supabase.from('production_orders')
                .select('*')
                .in('status', ['in_progress', 'producing', 'completed']);
            if (data) {
                const mapped = data.map((po: any) => {
                    const newPo: any = { ...po };
                    newPo.targetBitola = po.target_bitola;
                    newPo.orderNumber = po.order_number;
                    newPo.startTime = po.start_time;
                    newPo.endTime = po.end_time;
                    try {
                        newPo.sub_items_progress = typeof po.sub_items_progress === 'string' ? JSON.parse(po.sub_items_progress) : (po.sub_items_progress || {});
                    } catch(e) {
                        newPo.sub_items_progress = {};
                    }
                    return newPo;
                });
                setLocalOrders(mapped);
            }
        };
        fetchOrders();
        const interval = setInterval(fetchOrders, 3000);
        return () => clearInterval(interval);
    }, []);
    
    // Shift State
    const [isOnline, setIsOnline] = useState(currentUser.isOnline || false);
    const [isTogglingShift, setIsTogglingShift] = useState(false);

    // Machine Status State (Local for now)
    const [machineState, setMachineState] = useState<'PARADA' | 'ATIVA'>(() => {
        return (localStorage.getItem(`machine_state_${currentUser.id}`) as 'PARADA' | 'ATIVA') || 'PARADA';
    });
    const [machineStateSince, setMachineStateSince] = useState<string>(() => {
        return localStorage.getItem(`machine_state_since_${currentUser.id}`) || new Date().toISOString();
    });
    
    const formatTimeDiff = (startStr: string) => {
        const start = new Date(startStr).getTime();
        const now = new Date().getTime();
        const diff = Math.floor(Math.max(0, now - start) / 1000);
        const h = Math.floor(diff / 3600).toString().padStart(2, '0');
        const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
        const s = (diff % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    };
    const [machineTimer, setMachineTimer] = useState<string>(() => formatTimeDiff(machineStateSince));

    const [idleSince, setIdleSince] = useState<string | null>(() => {
        return localStorage.getItem(`machine_idle_since_${currentUser.id}`);
    });
    const [idleTimer, setIdleTimer] = useState<string>('00:00:00');

    useEffect(() => {
        if (!isOnline) return;
        const interval = setInterval(() => {
            setMachineTimer(formatTimeDiff(machineStateSince));
            setIdleTimer(prev => {
                const newIdle = localStorage.getItem(`machine_idle_since_${currentUser.id}`);
                return newIdle ? formatTimeDiff(newIdle) : '00:00:00';
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [isOnline, machineStateSince, currentUser.id]);

    const isAnyProducing = React.useMemo(() => {
        return localOrders.some(po => {
            if (!po.sub_items_progress) return false;
            try {
                const progressObj = typeof po.sub_items_progress === 'string' ? JSON.parse(po.sub_items_progress) : po.sub_items_progress;
                return Object.values(progressObj).some((p: any) => p.status === 'producing');
            } catch (e) { return false; }
        });
    }, [localOrders]);

    useEffect(() => {
        if (machineState === 'ATIVA' && !isAnyProducing) {
            if (!idleSince) {
                const now = new Date().toISOString();
                setIdleSince(now);
                localStorage.setItem(`machine_idle_since_${currentUser.id}`, now);
            }
        } else {
            if (idleSince !== null) {
                setIdleSince(null);
                localStorage.removeItem(`machine_idle_since_${currentUser.id}`);
            }
        }
    }, [machineState, isAnyProducing, idleSince, currentUser.id]);

    const toggleMachineState = async () => {
        if (machineState === 'ATIVA') {
            setIsStopReasonModalOpen(true);
            return;
        }

        const now = new Date().toISOString();
        
        try {
            await supabase.from('machine_stops')
                .update({ end_time: now })
                .eq('user_id', currentUser.id)
                .eq('machine', selectedMachine)
                .is('end_time', null);
        } catch (e) {
            console.error('Error updating machine stop state', e);
        }

        setMachineState('ATIVA');
        setMachineStateSince(now);
        setMachineTimer('00:00:00');
        setActiveStopReason('');
        localStorage.setItem(`machine_state_${currentUser.id}`, 'ATIVA');
        localStorage.setItem(`machine_state_since_${currentUser.id}`, now);
        localStorage.removeItem(`machine_stop_reason_${currentUser.id}`);
    };

    // Modal state
    const [isStopReasonModalOpen, setIsStopReasonModalOpen] = useState(false);
    const [activeStopReason, setActiveStopReason] = useState<string>(() => localStorage.getItem(`machine_stop_reason_${currentUser.id}`) || 'Aguardando início de produção');

    const confirmStopMachine = async (reason: string) => {
        setIsStopReasonModalOpen(false);
        const now = new Date().toISOString();
        
        try {
            await supabase.from('machine_stops').insert({
                machine: selectedMachine,
                user_id: currentUser.id,
                username: currentUser.username,
                start_time: now,
                reason: reason
            });
        } catch (e) {
            console.error('Error starting machine stop', e);
        }

        setMachineState('PARADA');
        setMachineStateSince(now);
        setMachineTimer('00:00:00');
        setActiveStopReason(reason);
        localStorage.setItem(`machine_state_${currentUser.id}`, 'PARADA');
        localStorage.setItem(`machine_state_since_${currentUser.id}`, now);
        localStorage.setItem(`machine_stop_reason_${currentUser.id}`, reason);
    };

    // SubOs Modal state
    const [activeModalPoId, setActiveModalPoId] = useState<string | null>(null);
    const [subOsSearch, setSubOsSearch] = useState('');
    const [activeSubOs, setActiveSubOs] = useState<any>(null);

    const toggleShift = async () => {
        if (isTogglingShift) return;
        setIsTogglingShift(true);
        
        const newValue = !isOnline;
        setIsOnline(newValue);
        const now = new Date().toISOString();
        const shiftStart = newValue ? now : null;
        try {
            if (newValue) {
                // Iniciar Turno
                const { error } = await supabase.from('app_users').update({ 
                    is_online: true,
                    current_shift_start: now 
                }).eq('id', currentUser.id);

                if (!error) {
                    // Previne turnos fantasmas: fecha qualquer turno que possa ter ficado aberto
                    await supabase.from('operator_shifts')
                        .update({ end_time: now })
                        .eq('user_id', currentUser.id)
                        .is('end_time', null);

                    await supabase.from('operator_shifts').insert({
                        user_id: currentUser.id,
                        username: currentUser.username,
                        machine: selectedMachine,
                        start_time: now
                    });
                    
                    // Previne paradas fantasmas
                    await supabase.from('machine_stops')
                        .update({ end_time: now })
                        .eq('user_id', currentUser.id)
                        .is('end_time', null);
                        
                    setMachineState('ATIVA');
                    setMachineStateSince(now);
                    setMachineTimer('00:00:00');
                    setActiveStopReason('');
                    localStorage.setItem(`machine_state_${currentUser.id}`, 'ATIVA');
                    localStorage.setItem(`machine_state_since_${currentUser.id}`, now);
                    localStorage.removeItem(`machine_stop_reason_${currentUser.id}`);
                } else {
                    throw error;
                }
            } else {
                // Finalizar Turno
                const { error } = await supabase.from('app_users').update({ 
                    is_online: false
                }).eq('id', currentUser.id);
                
                if (!error) {
                    // Fecha todos os turnos abertos do usuário
                    await supabase.from('operator_shifts')
                        .update({ end_time: now })
                        .eq('user_id', currentUser.id)
                        .is('end_time', null);
                        
                    // Fecha paradas pendentes
                    await supabase.from('machine_stops')
                        .update({ end_time: now })
                        .eq('user_id', currentUser.id)
                        .is('end_time', null);
                        
                    localStorage.removeItem(`machine_state_${currentUser.id}`);
                    localStorage.removeItem(`machine_state_since_${currentUser.id}`);
                    localStorage.removeItem(`machine_stop_reason_${currentUser.id}`);
                    setActiveStopReason('');
                } else {
                    throw error;
                }
            }
        } catch (e: any) {
            console.error('Error toggling shift:', e);
            alert('Erro ao alterar status do turno: ' + (e.message || 'Erro inesperado.'));
            setIsOnline(!newValue);
        } finally {
            setIsTogglingShift(false);
        }
    };

    const handleOpenModal = (osId: string) => {
        setActiveModalPoId(osId);
        const po = localOrders.find(p => p.id === osId);
        let foundProducing = false;

        if (po) {
            const currentProgressObj = typeof po.sub_items_progress === 'string' 
                ? JSON.parse(po.sub_items_progress) 
                : (po.sub_items_progress || {});
            
            for (const subOsKey in currentProgressObj) {
                if (currentProgressObj[subOsKey].status === 'producing') {
                    const commOrderId = (po as any).related_commercial_order_id || (po as any).relatedCommercialOrderId;
                    const commOrder = commercialOrders.find(co => co.id === commOrderId);
                    const rawProjectData = (commOrder as any)?.project_data || commOrder?.projectData;
                    
                    if (rawProjectData && Array.isArray(rawProjectData)) {
                        const normalizedData = rawProjectData.map(item => {
                            const newItem: any = {};
                            for (const key in item) {
                                newItem[key.trim().toLowerCase()] = item[key];
                            }
                            return newItem;
                        });
                        const foundSub = normalizedData.find(s => String(s.os).trim() === subOsKey);
                        if (foundSub) {
                            setActiveSubOs(foundSub);
                            setSubOsSearch(subOsKey);
                            foundProducing = true;
                            break;
                        }
                    }
                }
            }
        }
        
        if (!foundProducing) {
            setSubOsSearch('');
            setActiveSubOs(null);
        }
    };

    const handleStartSubOs = async (osId: string, subOsKey: string) => {
        setLoadingAction(`start-${osId}-${subOsKey}`);
        try {
            const po = localOrders.find(p => p.id === osId);
            if (!po) { setLoadingAction(null); return; }
            
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

            // OPTIMISTIC UPDATE: Immediate UI Feedback
            setLocalOrders(prev => prev.map(p => {
                if (p.id === osId) {
                    return { 
                        ...p, 
                        sub_items_progress: updatedProgress,
                        status: (p.status !== 'producing' && p.status !== 'in_progress') ? 'in_progress' : p.status,
                        startTime: (p.status !== 'producing' && p.status !== 'in_progress') ? startTime : p.startTime
                    };
                }
                return p;
            }));

            const { error } = await supabase
                .from('production_orders')
                .update({ 
                    sub_items_progress: updatedProgress, 
                    ...((po.status !== 'producing' && po.status !== 'in_progress') ? { status: 'in_progress', start_time: startTime } : {})
                })
                .eq('id', osId);
                
            if (error) {
                console.error('Supabase error:', error);
                alert('Erro do sistema ao iniciar o corte. As mudanças não foram salvas.');
            }
                
        } catch (e) {
            console.error('Erro ao iniciar mini OS:', e);
            alert('Erro ao iniciar corte da peça.');
        } finally {
            setLoadingAction(null);
        }
    };

    const handleFinishSubOs = async (osId: string, subOsKey: string) => {
        setLoadingAction(`finish-${osId}-${subOsKey}`);
        try {
            const po = localOrders.find(p => p.id === osId);
            if (!po) { setLoadingAction(null); return; }
            
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

            // OPTIMISTIC UPDATE: Immediate UI Feedback
            setLocalOrders(prev => prev.map(p => {
                if (p.id === osId) {
                    return { ...p, sub_items_progress: updatedProgress };
                }
                return p;
            }));

            const { error } = await supabase
                .from('production_orders')
                .update({ sub_items_progress: updatedProgress })
                .eq('id', osId);
                
            if (error) {
                console.error('Supabase error:', error);
                alert('Erro do sistema ao finalizar o corte.');
            }
                
            const commOrderId = (po as any).related_commercial_order_id || (po as any).relatedCommercialOrderId;
            const commOrder = commercialOrders.find(co => co.id === commOrderId);
            
            let totalSubItems = 0;
            const rawProjectData = (commOrder as any)?.project_data || commOrder?.projectData;
            if (rawProjectData && Array.isArray(rawProjectData)) {
                const subItems = rawProjectData.filter(item => {
                    const mm = item.mm || item.bitola || item.diametro || item.bit;
                    const poBitola = (po as any).target_bitola || po.targetBitola || '0';
                    return parseFloat(String(mm).replace(',', '.').replace(/[^\d.-]/g, '')) === parseFloat(String(poBitola).replace(',', '.').replace(/[^\d.-]/g, ''));
                });
                totalSubItems = subItems.length;
            }

            const completedCount = Object.values(updatedProgress).filter((p: any) => p.status === 'completed').length;

            if (totalSubItems > 0 && completedCount >= totalSubItems) {
                // Auto-finaliza a O.S pai
                await handleFinishProductionBatch(osId);
            } else {
                setSubOsSearch('');
                setActiveSubOs(null);
            }
        } catch (e) {
            console.error('Erro ao finalizar mini OS:', e);
            alert('Erro ao finalizar corte da peça.');
        } finally {
            setLoadingAction(null);
        }
    };

    const handleFinishProductionBatch = async (osId: string) => {
        setLoadingAction(`finish-batch-${osId}`);
        try {
            const endTime = new Date().toISOString();
            await supabase
                .from('production_orders')
                .update({ status: 'completed', end_time: endTime })
                .eq('id', osId);
                
            setLocalOrders(prev => prev.filter(po => po.id !== osId));
            setActiveModalPoId(null);
        } catch (e) {
            console.error('Erro ao finalizar produção:', e);
            alert('Erro ao finalizar produção.');
        } finally {
            setLoadingAction(null);
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

    const osList = localOrders.filter(po => {
        const matchMachine = String(po.machine).trim().toLowerCase() === String(selectedMachine).trim().toLowerCase();
        const matchQuery = !searchQuery || String(po.orderNumber || (po as any).order_number).toLowerCase().includes(searchQuery.toLowerCase());
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

            {!isOnline ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-in fade-in slide-in-from-bottom-4">
                    <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 max-w-sm w-full">
                        <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-black text-slate-800 mb-2 uppercase tracking-tight">Turno Fechado</h2>
                        <p className="text-slate-500 mb-8 font-medium">Inicie o seu turno para visualizar e processar as ordens de serviço.</p>
                        <button 
                            onClick={toggleShift}
                            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-5 rounded-2xl text-lg uppercase shadow-[0_0_20px_rgba(16,185,129,0.6)] animate-pulse active:scale-95 transition-all flex items-center justify-center gap-3"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                            INICIAR TURNO
                        </button>
                    </div>
                </div>
            ) : (
                <>
                {/* MACHINE STATUS BAR */}
                <div className="bg-slate-800 w-full shadow-md z-20">
                    <div className="max-w-lg mx-auto w-full p-4 flex flex-col gap-3">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Status em tempo real</p>
                                <p className={`text-lg font-black mt-0.5 ${machineState === 'ATIVA' ? 'text-emerald-400' : 'text-red-400'}`}>
                                    ESTADO {machineState === 'ATIVA' ? 'ATIVO' : 'PARADO'}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={toggleMachineState}
                                    className={`px-4 py-3 rounded-xl flex items-center gap-3 font-black text-white transition-all ${machineState === 'ATIVA' ? 'bg-red-500 hover:bg-red-600 shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'bg-emerald-500 hover:bg-emerald-600 shadow-[0_0_15px_rgba(16,185,129,0.5)]'}`}
                                >
                                    {machineState === 'ATIVA' ? (
                                        <>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                                            PARAR MÁQUINA
                                        </>
                                    ) : (
                                        <>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                                            ATIVAR MÁQUINA
                                        </>
                                    )}
                                </button>
                                <button 
                                    onClick={toggleShift}
                                    className="px-4 py-3 rounded-xl flex items-center gap-2 font-black text-rose-300 hover:text-white bg-slate-700 hover:bg-rose-500 transition-all border border-slate-600 hover:border-rose-400"
                                    title="Finalizar Turno"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 5.636a9 9 0 1012.728 0M12 3v9" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div className={`py-2 px-4 rounded-lg flex items-center justify-center gap-2 font-mono text-xl font-bold ${machineState === 'ATIVA' ? (idleSince ? 'bg-orange-900/50 text-orange-400 border border-orange-500/30' : 'bg-emerald-900/50 text-emerald-100') : 'bg-red-500 text-white animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.8)]'}`}>
                            {machineState === 'PARADA' && (
                                <span className="uppercase text-[12px] mr-2 font-black tracking-widest">{activeStopReason} — </span>
                            )}
                            {machineState === 'ATIVA' && idleSince && (
                                <span className="uppercase text-[12px] mr-2 font-black tracking-widest text-orange-400 animate-pulse">AGUARDANDO O.S. — </span>
                            )}
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            {machineState === 'ATIVA' && idleSince ? idleTimer : machineTimer}
                        </div>
                    </div>
                </div>
                
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
                        const commOrderId = (po as any).related_commercial_order_id || (po as any).relatedCommercialOrderId;
                        const commOrder = commercialOrders.find(co => co.id === commOrderId);
                        const isProducing = po.status === 'producing' || po.status === 'in_progress';
                        
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

                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 mt-1">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Quantidade / Comprimento</p>
                                    <p className="font-bold text-slate-800 text-sm">
                                        {((po as any).quantity_os || (po as any).quantityOs || 0)} un. {lengthCm > 0 && <span className="text-indigo-600 font-black"> x {lengthCm} cm</span>}
                                    </p>
                                </div>
                                
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
                                            className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white font-black py-4 px-2 rounded-xl text-[13px] sm:text-sm uppercase shadow-md active:scale-95 transition-all whitespace-nowrap"
                                        >
                                            CONTINUAR CORTE
                                        </button>
                                        <button 
                                            disabled={loadingAction === `finish-batch-${po.id}`}
                                            onClick={() => handleFinishProductionBatch(po.id)}
                                            className="flex-1 bg-rose-500 hover:bg-rose-600 text-white font-black py-4 px-2 rounded-xl text-[13px] sm:text-sm uppercase shadow-md active:scale-95 transition-all disabled:opacity-50 whitespace-nowrap"
                                        >
                                            {loadingAction === `finish-batch-${po.id}` ? 'AGUARDE...' : 'FINALIZAR'}
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
                const po = localOrders.find(p => p.id === activeModalPoId);
                if (!po) return null;
                const commOrderId = (po as any).related_commercial_order_id || (po as any).relatedCommercialOrderId;
                const commOrder = commercialOrders.find(co => co.id === commOrderId);
                
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

                const currentProgressObj = typeof po.sub_items_progress === 'string' ? JSON.parse(po.sub_items_progress) : (po.sub_items_progress || {});
                const currentItemStatus = activeSubOs ? currentProgressObj?.[activeSubOs.os]?.status : null;
                const currentItemStart = activeSubOs ? (currentProgressObj?.[activeSubOs.os]?.start_time || currentProgressObj?.[activeSubOs.os]?.startTime) : null;

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
                                {currentItemStatus !== 'producing' && (
                                    <div>
                                        <label className="text-sm font-bold text-slate-600 block mb-2">Digite o número da OS:</label>
                                        <div className="flex gap-2 w-full">
                                            <input 
                                                type="text" 
                                                inputMode="numeric"
                                                value={subOsSearch}
                                                onChange={e => setSubOsSearch(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                                                placeholder="Ex: 147"
                                                className="flex-1 min-w-0 bg-slate-100 border-2 border-slate-200 rounded-xl px-4 py-3 text-lg font-black text-slate-800 focus:outline-none focus:border-indigo-500"
                                            />
                                            <button onClick={handleSearch} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 rounded-xl flex-none flex items-center justify-center">
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                )}

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
                                                    <button 
                                                        disabled={loadingAction === `finish-${po.id}-${activeSubOs.os}`}
                                                        onClick={() => handleFinishSubOs(po.id, activeSubOs.os)} 
                                                        className="w-full bg-red-500 hover:bg-red-600 text-white font-black py-4 rounded-xl text-lg uppercase shadow-md active:scale-95 transition-all disabled:opacity-50">
                                                        {loadingAction === `finish-${po.id}-${activeSubOs.os}` ? 'FINALIZANDO...' : 'FINALIZAR CORTE'}
                                                    </button>
                                                </div>
                                            ) : (
                                                <button 
                                                    disabled={loadingAction === `start-${po.id}-${activeSubOs.os}`}
                                                    onClick={() => handleStartSubOs(po.id, activeSubOs.os)} 
                                                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 rounded-xl text-lg uppercase shadow-sm active:scale-95 transition-all disabled:opacity-50">
                                                    {loadingAction === `start-${po.id}-${activeSubOs.os}` ? 'INICIANDO...' : 'INICIAR CORTE'}
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

                {/* Modal Motivo de Parada */}
                {isStopReasonModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[200] flex flex-col items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
                        <div className="bg-white rounded-3xl w-full max-w-3xl overflow-hidden flex flex-col shadow-2xl">
                            <div className="bg-red-50 p-6 border-b border-red-100 flex justify-between items-center shrink-0">
                                <div>
                                    <h3 className="text-xl font-black text-red-900 uppercase tracking-tight">Motivo da Parada</h3>
                                    <p className="text-xs font-bold text-red-600 mt-1">Selecione o que aconteceu com a máquina</p>
                                </div>
                                <button onClick={() => setIsStopReasonModalOpen(false)} className="p-2 bg-white rounded-xl shadow-sm text-slate-400 hover:text-red-500">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                            <div className="p-6 grid grid-cols-2 md:grid-cols-3 gap-3 bg-slate-50 overflow-y-auto max-h-[65vh]">
                                {[
                                    'Check-list', 'Refeição', 'Set Up', 'Falta Materia Prima', 
                                    'Abastecimento', 'Acúmulo de Produção', 'Manutenção', 'Regulagem', 
                                    'Falta Energia Elétrica', 'Reunião / Treinamento', 'Manutenção Autônoma', 
                                    'Máquina sem Programação', 'Embalagem', 'Limpeza e organização', 
                                    'Digitação', 'Embolo no desbobinamento', 'Problema no Compressor', 
                                    'Problema no Pórtico', 'Outros'
                                ].map((reason) => (
                                    <button
                                        key={reason}
                                        onClick={() => confirmStopMachine(reason)}
                                        className="bg-white border-2 border-slate-200 hover:border-red-400 hover:bg-red-50 text-slate-700 hover:text-red-700 font-bold p-3 rounded-2xl transition-all shadow-sm active:scale-95 text-[11px] uppercase flex items-center justify-center text-center h-full min-h-[60px]"
                                    >
                                        {reason}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
                </>
            )}
        </div>
    );
};

export default MobileOperatorPanel;
