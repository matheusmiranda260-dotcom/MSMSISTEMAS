import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import type { User, CommercialOrder, ProductionOrderData, StockItem, StockGauge } from '../types';

interface MobileOperatorPanelProps {
    currentUser: User;
    onLogout: () => void;
    allProgrammedOrders: ProductionOrderData[];
    commercialOrders: CommercialOrder[];
    customers: any[];
    stock: StockItem[];
    gauges: StockGauge[];
    activeBrandingPartner?: any;
    machineStates?: import('../types').MachineCurrentState[];
    setMachineStates?: React.Dispatch<React.SetStateAction<import('../types').MachineCurrentState[]>>;
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

const MobileOperatorPanel: React.FC<MobileOperatorPanelProps> = ({ currentUser, onLogout, allProgrammedOrders, commercialOrders, customers, stock, gauges, activeBrandingPartner, machineStates, setMachineStates }) => {
    const assignedMachines = currentUser.assignedMachines || [];
    const [selectedMachine, setSelectedMachine] = useState<string>(assignedMachines[0] || '');
    const [searchQuery, setSearchQuery] = useState('');
    const [showCompleted, setShowCompleted] = useState(false);
    
    // Porta rolos state with initial load from Realtime
    const currentMachineState = machineStates?.find(m => m.machineName === selectedMachine);
    const portaRolo1 = currentMachineState?.portaRolo1Lot || '';
    const portaRolo2 = currentMachineState?.portaRolo2Lot || '';
    const activeFeed1 = currentMachineState?.activeFeed1 ?? true;
    const activeFeed2 = currentMachineState?.activeFeed2 ?? true;

    const updateMachineStateDB = async (updates: Partial<import('../types').MachineCurrentState>) => {
        if (!selectedMachine) return;
        try {
            const current = machineStates?.find(m => m.machineName === selectedMachine) || {
                machineName: selectedMachine,
                status: 'PARADA' as const,
                activeFeed1: true,
                activeFeed2: true
            };
            const payload = { ...current, ...updates, operatorId: currentUser.id };
            
            // Optimistic update for snappy UI
            if (setMachineStates) {
                setMachineStates(prev => {
                    const newStates = [...(prev || [])];
                    const idx = newStates.findIndex(s => s.machineName === selectedMachine);
                    if (idx >= 0) {
                        newStates[idx] = { ...newStates[idx], ...updates };
                    } else {
                        newStates.push(payload as import('../types').MachineCurrentState);
                    }
                    return newStates;
                });
            }

            const { error } = await supabase.from('machine_current_states').upsert({
                machine_name: payload.machineName,
                operator_id: payload.operatorId,
                status: payload.status,
                status_since: payload.statusSince,
                stop_reason: payload.stopReason,
                idle_since: payload.idleSince,
                porta_rolo_1_lot: payload.portaRolo1Lot,
                porta_rolo_2_lot: payload.portaRolo2Lot,
                active_feed_1: payload.activeFeed1,
                active_feed_2: payload.activeFeed2
            });
            if (error) {
                console.error('Supabase error:', error);
                alert('Erro ao sincronizar máquina: ' + error.message);
            }
        } catch (e) {
            console.error('Error updating machine state', e);
            alert('Erro inesperado: ' + e);
        }
    };

    const handleFeedToggle = (rolo: 1 | 2) => {
        if (rolo === 1) {
            updateMachineStateDB({ activeFeed1: !activeFeed1 });
        } else {
            updateMachineStateDB({ activeFeed2: !activeFeed2 });
        }
    };

    const handlePortaRoloChange = (rolo: 1 | 2, value: string) => {
        if (rolo === 1) {
            updateMachineStateDB({ portaRolo1Lot: value });
        } else {
            updateMachineStateDB({ portaRolo2Lot: value });
        }
    };

    // Polled orders fallback and visual feedback state
    const [localOrders, setLocalOrders] = useState<ProductionOrderData[]>(allProgrammedOrders.filter(po => po.status !== 'pending'));
    const [loadingAction, setLoadingAction] = useState<string | null>(null);

    useEffect(() => {
        if (allProgrammedOrders.length > 0) {
            setLocalOrders(allProgrammedOrders.filter(po => po.status !== 'pending'));
        }
    }, [allProgrammedOrders]);

    // Clear Porta Rolo if it was manually reverted to 'Disponível' by gestor
    useEffect(() => {
        let changed = false;
        let newPR1 = portaRolo1;
        let newPR2 = portaRolo2;
        let newF1 = activeFeed1;
        let newF2 = activeFeed2;

        if (portaRolo1) {
            const lot1 = stock.find(i => i.internalLot === portaRolo1);
            if (lot1 && lot1.status?.toLowerCase() === 'disponível') {
                newPR1 = '';
                newF1 = false;
                changed = true;
            }
        }
        if (portaRolo2) {
            const lot2 = stock.find(i => i.internalLot === portaRolo2);
            if (lot2 && lot2.status?.toLowerCase() === 'disponível') {
                newPR2 = '';
                newF2 = false;
                changed = true;
            }
        }

        if (changed) {
            updateMachineStateDB({ portaRolo1Lot: newPR1, portaRolo2Lot: newPR2, activeFeed1: newF1, activeFeed2: newF2 });
        }
    }, [stock, portaRolo1, portaRolo2, selectedMachine]);

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
                        newPo.sub_items_progress = typeof po.subItemsProgress === 'string' ? JSON.parse(po.subItemsProgress) : (po.subItemsProgress || {});
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
    
    const [isOnline, setIsOnline] = useState<boolean>(() => {
        const stored = localStorage.getItem(`shift_online_${currentUser.id}`);
        if (stored !== null) return stored === 'true';
        return currentUser.isOnline || false;
    });
    const [isTogglingShift, setIsTogglingShift] = useState(false);

    // Machine Status State (DB Sync)
    const machineState = currentMachineState?.status || 'PARADA';
    const machineStateSince = currentMachineState?.statusSince || new Date().toISOString();
    const idleSince = currentMachineState?.idleSince || null;
    const activeStopReason = currentMachineState?.stopReason || 'Aguardando início de produção';
    
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
    const [idleTimer, setIdleTimer] = useState<string>('00:00:00');

    useEffect(() => {
        if (!isOnline) return;
        const interval = setInterval(() => {
            setMachineTimer(formatTimeDiff(machineStateSince));
            setIdleTimer(idleSince ? formatTimeDiff(idleSince) : '00:00:00');
        }, 1000);
        return () => clearInterval(interval);
    }, [isOnline, machineStateSince, idleSince]);

    const isAnyProducing = React.useMemo(() => {
        return localOrders.some(po => {
            if (!po.subItemsProgress) return false;
            try {
                const progressObj = typeof po.subItemsProgress === 'string' ? JSON.parse(po.subItemsProgress) : po.subItemsProgress;
                return Object.values(progressObj).some((p: any) => p.status === 'producing');
            } catch (e) { return false; }
        });
    }, [localOrders]);

    useEffect(() => {
        if (machineState === 'ATIVA' && !isAnyProducing) {
            if (!idleSince) {
                const now = new Date().toISOString();
                updateMachineStateDB({ idleSince: now });
            }
        } else {
            if (idleSince !== null) {
                updateMachineStateDB({ idleSince: null });
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

        setMachineTimer('00:00:00');
        updateMachineStateDB({ status: 'ATIVA', statusSince: now, stopReason: '' });
    };

    // Modal state
    const [isStopReasonModalOpen, setIsStopReasonModalOpen] = useState(false);

    // Abastecimento Modal state
    const [isAbastecimentoModalOpen, setIsAbastecimentoModalOpen] = useState(false);
    const [abastecimentoStep, setAbastecimentoStep] = useState<1 | 2>(1);
    const [selectedPortaRolo, setSelectedPortaRolo] = useState<1 | 2>(1);
    const [selectedBitola, setSelectedBitola] = useState<string>('');
    const [availableLots, setAvailableLots] = useState<any[]>([]);
    const [isLoadingLots, setIsLoadingLots] = useState(false);
    const [isLoadingMaterials, setIsLoadingMaterials] = useState(false);
    
    // As opções agora são puxadas dinamicamente do estoque (ex: ROLO - 12.50 mm)
    const [availableMaterialOptions, setAvailableMaterialOptions] = useState<string[]>([]);

    const fetchAvailableMaterialOptions = () => {
        setIsLoadingMaterials(true);
        try {
            const machineConfig = activeBrandingPartner?.machines?.find((m: any) => m.name === selectedMachine);
            let allowedBitolas: string[] = [];
            if (machineConfig?.gaugeRange) {
                allowedBitolas = machineConfig.gaugeRange.split('-').map((b: string) => b.trim().toLowerCase());
            }

            // Utilizamos o stock já carregado na memória pelo App.tsx
            const activeGauges = gauges.filter(g => g.showInStockManagement !== false).map(g => `${g.materialType} - ${g.gauge}`);
            const availableStock = stock.filter(i => i.status !== 'Consumido').map(i => `${i.materialType} - ${i.bitola}`);
            
            const uniqueOptions = Array.from(new Set([...activeGauges, ...availableStock])).filter(s => {
                if (!s || s === ' - ' || s === 'undefined - undefined') return false;
                if (!s.toUpperCase().includes('ROLO')) return false;

                if (allowedBitolas.length > 0) {
                    const match = allowedBitolas.some(ab => {
                        const abValue = parseFloat(ab.replace('mm', '').replace(',', '.').trim());
                        const sValue = parseFloat(s.split('-')[1]?.replace('mm', '').trim() || '0');
                        return abValue === sValue;
                    });
                    if (!match) return false;
                }

                return true;
            }).sort();
            
            setAvailableMaterialOptions(uniqueOptions);
        } catch (e) {
            console.error('Erro ao processar opções de material:', e);
        } finally {
            setIsLoadingMaterials(false);
        }
    };

    const confirmStopMachine = async (reason: string) => {
        setIsStopReasonModalOpen(false);
        if (reason.toUpperCase() === 'ABASTECIMENTO') {
            setAbastecimentoStep(1);
            setSelectedPortaRolo(1);
            setSelectedBitola('');
            setAvailableLots([]);
            setIsAbastecimentoModalOpen(true);
            fetchAvailableMaterialOptions();
            return;
        }
        await registerMachineStop(reason);
    };

    const registerMachineStop = async (reason: string) => {

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

        setMachineTimer('00:00:00');
        updateMachineStateDB({ status: 'PARADA', statusSince: now, stopReason: reason });
    };

    const handleSearchLots = async () => {
        if (!selectedBitola) return;
        setIsLoadingLots(true);
        setAbastecimentoStep(2);
        try {
            let material = '';
            let bitola = '';
            if (selectedBitola.includes(' - ')) {
                const parts = selectedBitola.split(' - ');
                material = parts[0];
                bitola = parts.slice(1).join(' - ');
            }

            // Filtrar localmente usando a prop 'stock' passada pelo App.tsx
            const validLots = stock.filter(item => {
                if (item.status === 'Consumido') return false;
                // Exigir que seja Disponível ou não consumido, mas para alimentar a máquina geralmente é "Disponível"
                // Vamos usar a mesma lógica do painel de estoques, onde tudo não consumido é operável.
                if (material && item.materialType !== material) return false;
                if (bitola && item.bitola !== bitola) return false;
                return true;
            });

            // Ordenar por entryDate ascendente
            validLots.sort((a, b) => {
                const dateA = a.entryDate ? new Date(a.entryDate).getTime() : 0;
                const dateB = b.entryDate ? new Date(b.entryDate).getTime() : 0;
                return dateA - dateB;
            });

            setAvailableLots(validLots);
        } catch (e) {
            console.error('Erro ao buscar lotes', e);
            alert('Falha ao buscar lotes');
            setAbastecimentoStep(1);
        } finally {
            setIsLoadingLots(false);
        }
    };

    const handleSelectLot = async (lot: any) => {
        try {
            // Find old lot in the selected porta rolo to free it
            const oldInternalLot = selectedPortaRolo === 1 ? portaRolo1 : portaRolo2;
            if (oldInternalLot && oldInternalLot !== lot.internalLot) {
                const oldLot = stock.find(i => i.internalLot === oldInternalLot);
                if (oldLot) {
                    await supabase.from('stock_items').update({ status: 'Disponível' }).eq('id', oldLot.id);
                }
            }

            // Bind new lot to machine and add history
            const newHistoryItem = {
                date: new Date().toISOString(),
                action: `Operador(a) ${currentUser.username || currentUser.name || 'Desconhecido'} selecionou o lote para uso na máquina ${selectedMachine}`,
                user: currentUser.username || currentUser.name || 'Sistema'
            };
            const existingHistory = lot.history || [];
            
            await supabase.from('stock_items').update({ 
                status: `Em suporte de ${selectedMachine}`,
                history: [...existingHistory, newHistoryItem]
            }).eq('id', lot.id);
        } catch (error) {
            console.error('Erro ao vincular lote:', error);
        }

        handlePortaRoloChange(selectedPortaRolo, lot.internalLot || lot.supplierLot || lot.id);
        setIsAbastecimentoModalOpen(false);
        registerMachineStop('Abastecimento');
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
        localStorage.setItem(`shift_online_${currentUser.id}`, String(newValue));
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
                        
                    setMachineTimer('00:00:00');
                    updateMachineStateDB({ status: 'ATIVA', statusSince: now, stopReason: '' });
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
                        
                    updateMachineStateDB({ status: 'PARADA', statusSince: now, stopReason: '' });
                } else {
                    throw error;
                }
            }
        } catch (e: any) {
            console.error('Error toggling shift:', e);
            alert('Erro ao alterar status do turno: ' + (e.message || 'Erro inesperado.'));
            setIsOnline(!newValue);
            localStorage.setItem(`shift_online_${currentUser.id}`, String(!newValue));
        } finally {
            setIsTogglingShift(false);
        }
    };

    const validateBitolaMatch = (osId: string) => {
        const po = localOrders.find(p => p.id === osId);
        if (!po) return true;
        
        const osBitola = (po as any).target_bitola || (po as any).targetBitola || '';
        if (!osBitola) return true;
        
        const stdOsBitola = parseFloat(String(osBitola).replace(',', '.').replace(/[^\d.]/g, ''));

        let activeLotsBitolas: number[] = [];
        if (portaRolo1 && activeFeed1) {
            const l1 = stock.find(i => i.internalLot === portaRolo1);
            if (l1) {
                const b = parseFloat(String(l1.bitola || l1.gauge || '').replace(',', '.').replace(/[^\d.]/g, ''));
                if (!isNaN(b)) activeLotsBitolas.push(b);
            }
        }
        if (portaRolo2 && activeFeed2) {
            const l2 = stock.find(i => i.internalLot === portaRolo2);
            if (l2) {
                const b = parseFloat(String(l2.bitola || l2.gauge || '').replace(',', '.').replace(/[^\d.]/g, ''));
                if (!isNaN(b)) activeLotsBitolas.push(b);
            }
        }

        const mismatch = activeLotsBitolas.some(b => b !== stdOsBitola);
        if (mismatch && !isNaN(stdOsBitola)) {
            alert(`ALERTA DE SEGURANÇA:\nA bitola do pedido é ${osBitola}, mas você selecionou rolos com bitolas diferentes no Porta Rolo ativo. Por favor, corrija o abastecimento ou a seleção antes de continuar.`);
            return false;
        }
        return true;
    };

    const handleOpenModal = (osId: string) => {
        const hasValidFeed = (portaRolo1 && activeFeed1) || (portaRolo2 && activeFeed2);
        if (!hasValidFeed) {
            alert('Você precisa abastecer a máquina e manter ATIVADA pelo menos uma das opções (Porta Rolo 1 ou 2) antes de continuar o corte.');
            return;
        }
        if (!validateBitolaMatch(osId)) return;
        setActiveModalPoId(osId);
        const po = localOrders.find(p => p.id === osId);
        let foundProducing = false;

        if (po) {
            const currentProgressObj = typeof po.subItemsProgress === 'string' 
                ? JSON.parse(po.subItemsProgress) 
                : (po.subItemsProgress || {});
            
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
        const hasValidFeed = (portaRolo1 && activeFeed1) || (portaRolo2 && activeFeed2);
        if (!hasValidFeed) {
            alert('Você precisa abastecer a máquina e manter ATIVADA pelo menos uma das opções (Porta Rolo 1 ou 2) antes de iniciar ou continuar o corte.');
            return;
        }
        if (!validateBitolaMatch(osId)) return;
        setLoadingAction(`start-${osId}-${subOsKey}`);
        try {
            const po = localOrders.find(p => p.id === osId);
            if (!po) { setLoadingAction(null); return; }
            
            let currentProgress = po.subItemsProgress;
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
                        subItemsProgress: updatedProgress,
                        status: (p.status !== 'producing' && p.status !== 'in_progress') ? 'in_progress' : p.status,
                        startTime: (p.status !== 'producing' && p.status !== 'in_progress') ? startTime : p.startTime
                    };
                }
                return p;
            }));

            const { error } = await supabase
                .from('production_orders')
                .update({ sub_items_progress: updatedProgress, 
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
            
            let currentProgress = po.subItemsProgress;
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
                    return { ...p, subItemsProgress: updatedProgress };
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
            } else {
                // Abater peso do lote selecionado
                try {
                    const qtd = parseFloat(activeSubOs.qunti || activeSubOs.quantidade || activeSubOs.qtd || '0');
                    const compCm = parseFloat(activeSubOs.comprimento || activeSubOs.comp || '0');
                    let weightProduced = parseFloat(activeSubOs.peso || activeSubOs.pesoTotal || '0');
                    
                    if (!weightProduced || isNaN(weightProduced) || weightProduced === 0) {
                        const bitolaStr = po.target_bitola || po.targetBitola || '';
                        const gaugeObj = gauges.find(g => g.gauge === bitolaStr);
                        const weightPerM = gaugeObj?.weightPerMeter || gaugeObj?.rawWeightValue || 0;
                        if (weightPerM > 0) {
                            weightProduced = (compCm / 100) * qtd * weightPerM;
                        }
                    }

                    if (weightProduced > 0) {
                        const activeLots = [];
                        if (portaRolo1 && activeFeed1) {
                            const l1 = stock.find(i => i.internalLot === portaRolo1);
                            if (l1) activeLots.push(l1);
                        }
                        if (portaRolo2 && activeFeed2) {
                            const l2 = stock.find(i => i.internalLot === portaRolo2);
                            if (l2) activeLots.push(l2);
                        }

                        if (activeLots.length > 0) {
                            const weightPerLot = weightProduced / activeLots.length;
                            
                            for (const lotObj of activeLots) {
                                const currentQty = lotObj.remainingQuantity ?? lotObj.weight ?? lotObj.labelWeight ?? 0;
                                const newRemaining = Math.max(0, currentQty - weightPerLot);
                                
                                const consumeHistoryItem = {
                                    date: endTime,
                                    action: `OS ${po.orderNumber} - SubOS ${subOsKey}: Baixa de ${weightPerLot.toFixed(2)} kg`,
                                    user: currentUser.username || currentUser.name || 'Sistema'
                                };

                                await supabase.from('stock_items').update({
                                    remaining_quantity: newRemaining,
                                    history: [...(lotObj.history || []), consumeHistoryItem]
                                }).eq('id', lotObj.id);
                            }
                        }
                    }
                } catch (err) {
                    console.error('Erro ao abater peso do lote:', err);
                }
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
                
            setLocalOrders(prev => prev.map(po => {
                if (po.id === osId) {
                    return { ...po, status: 'completed', end_time: endTime };
                }
                return po;
            }));
            setActiveModalPoId(null);
        } catch (e) {
            console.error('Erro ao finalizar produção:', e);
            alert('Erro ao finalizar produção.');
        } finally {
            setLoadingAction(null);
        }
    };

    const handlePauseProductionBatch = async (osId: string) => {
        setLoadingAction(`pause-batch-${osId}`);
        try {
            await supabase
                .from('production_orders')
                .update({ status: 'pending' })
                .eq('id', osId);
                
            setLocalOrders(prev => prev.map(po => {
                if (po.id === osId) {
                    return { ...po, status: 'pending' };
                }
                return po;
            }));
        } catch (e) {
            console.error('Erro ao pausar produção:', e);
            alert('Erro ao pausar a O.S.');
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

    const filteredOrders = localOrders.filter(po => {
        const matchMachine = String(po.machine).trim().toLowerCase() === String(selectedMachine).trim().toLowerCase();
        const matchQuery = !searchQuery || String(po.orderNumber || (po as any).order_number).toLowerCase().includes(searchQuery.toLowerCase());
        return matchMachine && matchQuery;
    });

    const pendingOrders = filteredOrders.filter(po => po.status !== 'completed');
    const completedOrders = filteredOrders.filter(po => po.status === 'completed');
    
    const osList = showCompleted ? completedOrders : pendingOrders;

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
                {machineState === 'ATIVA' && (
                <div className="bg-slate-800 w-full shadow-md z-20">
                    <div className="max-w-lg mx-auto w-full p-4 flex flex-col gap-3">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Status em tempo real</p>
                                <p className={`text-lg font-black mt-0.5 ${idleSince ? 'text-orange-400 animate-pulse' : 'text-emerald-400'}`}>
                                    {idleSince ? 'MÁQUINA PARADA' : 'ESTADO ATIVO'}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={toggleMachineState}
                                    className="px-4 py-3 rounded-xl flex items-center gap-3 font-black text-white transition-all bg-red-500 hover:bg-red-600 shadow-[0_0_15px_rgba(239,68,68,0.5)]"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                                    PARAR MÁQUINA
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
                        <div className={`py-2 px-4 rounded-lg flex items-center justify-center gap-2 font-mono text-xl font-bold ${idleSince ? 'bg-orange-900/50 text-orange-400 border border-orange-500/30' : 'bg-emerald-900/50 text-emerald-100'}`}>
                            {idleSince && (
                                <span className="uppercase text-[12px] mr-2 font-black tracking-widest text-orange-400 animate-pulse">AGUARDANDO O.S. — </span>
                            )}
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            {idleSince ? idleTimer : machineTimer}
                        </div>
                    </div>
                </div>
                )}
                
                <main className="flex-1 p-4 flex flex-col gap-4 max-w-lg w-full mx-auto relative">
                    {machineState === 'PARADA' && (
                        <div className="absolute inset-0 z-30 bg-slate-50/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-in zoom-in-95 duration-300">
                            <div className="w-32 h-32 bg-red-100 rounded-full flex items-center justify-center mb-6 shadow-inner animate-pulse">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <h2 className="text-3xl font-black text-slate-800 mb-2 uppercase tracking-tight">MÁQUINA PARADA</h2>
                            
                            <div className="flex flex-col items-center justify-center bg-red-50 border border-red-100 px-6 py-4 rounded-2xl mb-8 w-full max-w-xs shadow-sm">
                                <p className="text-red-500 font-black text-2xl uppercase tracking-wider">{activeStopReason || 'Motivo não especificado'}</p>
                                <div className="flex items-center gap-2 mt-2 text-red-400 font-mono text-xl font-bold">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                    {machineTimer}
                                </div>
                            </div>

                            <div className="w-full flex flex-col gap-3 max-w-xs">
                                <button 
                                    onClick={toggleMachineState}
                                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-5 rounded-2xl text-xl uppercase shadow-[0_0_20px_rgba(16,185,129,0.6)] active:scale-95 transition-all flex items-center justify-center gap-3"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="white" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                                    RETORNAR À PRODUÇÃO
                                </button>
                                
                                <button 
                                    onClick={toggleShift}
                                    className="w-full bg-slate-200 hover:bg-slate-300 text-slate-600 font-bold py-4 rounded-2xl text-lg uppercase active:scale-95 transition-all flex items-center justify-center gap-2 mt-2"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 5.636a9 9 0 1012.728 0M12 3v9" />
                                    </svg>
                                    FINALIZAR TURNO
                                </button>
                            </div>
                        </div>
                    )}
                
                <div className="bg-white p-4 rounded-2xl shadow-sm border-2 border-slate-200 flex flex-col gap-3">
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
                        Alimentação (Porta Rolos)
                    </h3>
                    <div className="flex gap-3">
                        {(() => {
                            const renderPortaRolo = (title: string, internalLotId: string, roloIndex: 1 | 2) => {
                                const lot = stock.find(i => i.internalLot === internalLotId);
                                const isActive = roloIndex === 1 ? activeFeed1 : activeFeed2;
                                
                                if (!lot) {
                                    return (
                                        <div className="flex-1 flex flex-col gap-1">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase">{title}</label>
                                            <div className="w-full min-h-[104px] bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-400">
                                                <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Livre / Vazio</span>
                                            </div>
                                        </div>
                                    );
                                }

                                const initialWeight = lot.labelWeight || lot.weight || 0;
                                const remainingWeight = lot.remainingQuantity ?? initialWeight;
                                const consumedWeight = Math.max(0, initialWeight - remainingWeight);

                                return (
                                    <div className={`flex-1 flex flex-col gap-1 transition-all ${isActive ? 'opacity-100' : 'opacity-60 grayscale'}`}>
                                        <div className="flex justify-between items-center">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase">{title}</label>
                                            <div className="flex items-center gap-1 cursor-pointer" onClick={() => handleFeedToggle(roloIndex)}>
                                                <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${isActive ? 'bg-indigo-500' : 'bg-slate-300'}`}>
                                                    <div className={`bg-white w-3 h-3 rounded-full shadow-sm transform transition-transform ${isActive ? 'translate-x-4' : 'translate-x-0'}`}></div>
                                                </div>
                                                <span className={`text-[9px] font-bold uppercase ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}>
                                                    {isActive ? 'Ativo' : 'Pausado'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className={`bg-white border-2 rounded-xl p-3 flex flex-col gap-1 shadow-sm relative overflow-hidden min-h-[104px] transition-colors ${isActive ? 'border-indigo-200' : 'border-slate-200'}`}>
                                            <div className="absolute top-0 right-0 bg-indigo-500 text-white text-[9px] font-black px-2 py-0.5 rounded-bl-lg z-10">
                                                LOTE: {lot.internalLot || lot.supplierLot}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-black text-slate-800">{lot.bitola || lot.gauge || '-'}</span>
                                                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase tracking-wider">{lot.materialType}</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-1 text-[10px]">
                                                <div className="flex flex-col">
                                                    <span className="text-slate-400 font-bold uppercase">Inicial</span>
                                                    <span className="text-slate-700 font-black">{Number(initialWeight).toFixed(2)} kg</span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-slate-400 font-bold uppercase">Restante</span>
                                                    <span className="text-emerald-600 font-black">{Number(remainingWeight).toFixed(2)} kg</span>
                                                </div>
                                                <div className="flex col-span-2 pt-1 border-t border-slate-100 flex-row justify-between items-center">
                                                    <span className="text-slate-400 font-bold uppercase">Consumido</span>
                                                    <span className="text-orange-500 font-black">{Number(consumedWeight).toFixed(2)} kg</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            };

                            return (
                                <>
                                    {renderPortaRolo('Porta Rolo 1', portaRolo1, 1)}
                                    {renderPortaRolo('Porta Rolo 2', portaRolo2, 2)}
                                </>
                            );
                        })()}
                    </div>
                </div>

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
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setShowCompleted(!showCompleted)}
                            className={`text-[10px] font-bold px-2 py-1.5 rounded-lg border transition-all ${
                                showCompleted 
                                ? 'bg-indigo-100 text-indigo-700 border-indigo-200' 
                                : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                            }`}
                        >
                            {showCompleted ? 'Ver Pendentes' : 'Ver Finalizados'}
                        </button>
                        <span className={`text-xs font-bold px-2 py-1.5 rounded-lg ${
                            showCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'
                        }`}>
                            {showCompleted ? `${completedOrders.length} O.S. Finalizadas` : `${pendingOrders.length} O.S. Pendentes`}
                        </span>
                    </div>
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

                                {po.status === 'completed' ? (
                                    <div className="w-full bg-emerald-100 border border-emerald-300 text-emerald-700 font-black py-4 rounded-xl text-lg uppercase shadow-sm text-center">
                                        Finalizado
                                    </div>
                                ) : !isProducing ? (
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
                                            disabled={loadingAction === `pause-batch-${po.id}`}
                                            onClick={() => handlePauseProductionBatch(po.id)}
                                            className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-black py-4 px-2 rounded-xl text-[13px] sm:text-sm uppercase shadow-md active:scale-95 transition-all disabled:opacity-50 whitespace-nowrap"
                                        >
                                            {loadingAction === `pause-batch-${po.id}` ? 'AGUARDE...' : 'PAUSAR'}
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

                const currentProgressObj = typeof po.subItemsProgress === 'string' ? JSON.parse(po.subItemsProgress) : (po.subItemsProgress || {});
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

                {/* Modal de Abastecimento (Porta Rolo e Lote) */}
                {isAbastecimentoModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[250] flex flex-col items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
                        <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden flex flex-col shadow-2xl h-[85vh]">
                            <div className="bg-[#0F3F5C] p-6 flex justify-between items-center shrink-0">
                                <div>
                                    <h3 className="text-xl font-black text-white uppercase tracking-tight">Abastecimento de Máquina</h3>
                                    <p className="text-xs font-bold text-indigo-200 mt-1">
                                        {abastecimentoStep === 1 ? 'Selecione o porta rolo e a bitola' : 'Selecione o lote desejado'}
                                    </p>
                                </div>
                                <button onClick={() => setIsAbastecimentoModalOpen(false)} className="p-2 bg-white/10 rounded-xl shadow-sm text-white hover:bg-white/20">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                            
                            <div className="p-6 flex-1 overflow-y-auto bg-slate-50">
                                {abastecimentoStep === 1 && (
                                    <div className="flex flex-col gap-6">
                                        <div className="flex flex-col gap-3">
                                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest">1. Qual Porta Rolo?</label>
                                            <div className="flex gap-4">
                                                <button 
                                                    onClick={() => setSelectedPortaRolo(1)}
                                                    className={`flex-1 flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${selectedPortaRolo === 1 ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-md' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-100'}`}
                                                >
                                                    <span className="font-black text-lg">Porta Rolo 1</span>
                                                    {portaRolo1 && (
                                                        <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full mt-1 uppercase">
                                                            Já abastecido
                                                        </span>
                                                    )}
                                                </button>
                                                <button 
                                                    onClick={() => setSelectedPortaRolo(2)}
                                                    className={`flex-1 flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${selectedPortaRolo === 2 ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-md' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-100'}`}
                                                >
                                                    <span className="font-black text-lg">Porta Rolo 2</span>
                                                    {portaRolo2 && (
                                                        <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full mt-1 uppercase">
                                                            Já abastecido
                                                        </span>
                                                    )}
                                                </button>
                                            </div>
                                            {((selectedPortaRolo === 1 && portaRolo1) || (selectedPortaRolo === 2 && portaRolo2)) && (
                                                <div className="bg-amber-50 border border-amber-200 text-amber-700 p-3 rounded-xl text-xs font-bold flex items-center gap-2">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                    </svg>
                                                    <span>Atenção: O Porta Rolo selecionado já possui um lote. Ao continuar, o lote atual será substituído.</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex flex-col gap-3">
                                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest">2. Qual o Material?</label>
                                            {isLoadingMaterials ? (
                                                <div className="flex justify-center items-center py-4 text-slate-400 font-bold text-sm">
                                                    Carregando opções disponíveis...
                                                </div>
                                            ) : availableMaterialOptions.length === 0 ? (
                                                <div className="flex justify-center items-center py-4 text-slate-400 font-bold text-sm">
                                                    Nenhum material disponível no estoque.
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                                    {availableMaterialOptions.map(option => (
                                                        <button
                                                            key={option}
                                                            onClick={() => setSelectedBitola(option)}
                                                            className={`p-3 rounded-xl border-2 font-black text-sm transition-all ${selectedBitola === option ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-md' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'}`}
                                                        >
                                                            {option}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <button 
                                            disabled={!selectedBitola}
                                            onClick={handleSearchLots}
                                            className="mt-4 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-xl text-lg uppercase shadow-sm active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
                                        >
                                            Buscar Lotes Disponíveis
                                        </button>
                                    </div>
                                )}

                                {abastecimentoStep === 2 && (
                                    <div className="flex flex-col gap-4">
                                        <button 
                                            onClick={() => setAbastecimentoStep(1)}
                                            className="text-xs font-bold text-indigo-600 uppercase flex items-center gap-1 hover:underline self-start"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" /></svg>
                                            Voltar para Bitolas
                                        </button>
                                        
                                        <h4 className="font-black text-slate-700 uppercase">Lotes de {selectedBitola}</h4>
                                        
                                        {isLoadingLots ? (
                                            <div className="flex justify-center p-8">
                                                <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-indigo-600"></div>
                                            </div>
                                        ) : availableLots.length === 0 ? (
                                            <div className="bg-red-50 border-2 border-dashed border-red-200 p-8 text-center rounded-2xl">
                                                <p className="text-red-500 font-bold uppercase tracking-wider">Nenhum lote disponível encontrado para {selectedBitola}</p>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-3">
                                                {availableLots.map(lot => (
                                                    <div key={lot.id} className="bg-white border-2 border-slate-200 rounded-2xl p-4 flex justify-between items-center hover:border-indigo-300 hover:shadow-md transition-all">
                                                        <div>
                                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lot.supplier || 'Fornecedor Desconhecido'}</p>
                                                            <p className="text-lg font-black text-slate-800 uppercase tracking-tight">{lot.internalLot || lot.supplierLot}</p>
                                                            <div className="flex gap-3 mt-1">
                                                                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">Peso: {lot.remainingQuantity || lot.weight || lot.labelWeight} kg</span>
                                                                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">{lot.materialType}</span>
                                                            </div>
                                                        </div>
                                                        <button 
                                                            onClick={() => handleSelectLot(lot)}
                                                            className="bg-emerald-500 hover:bg-emerald-600 text-white font-black px-6 py-3 rounded-xl uppercase shadow-sm active:scale-95 transition-all text-sm"
                                                        >
                                                            Selecionar
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
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
