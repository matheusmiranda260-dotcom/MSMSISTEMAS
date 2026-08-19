import React, { useState, useEffect, useRef } from 'react';
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
    const [bancadaConfirmState, setBancadaConfirmState] = useState<{ isOpen: boolean, subOsKey: string, po: any, subOsItem: any, weight: number } | null>(null);
    
    const bancadaMachineObj = activeBrandingPartner?.machines?.find((m: any) => m.name.toLowerCase().includes('bancada') || m.name.toLowerCase().includes('cortador'));
    const bancadaTargetName = bancadaMachineObj ? bancadaMachineObj.name : 'Bancada/Cortador';
    const isCurrentMachineBancada = selectedMachine.toLowerCase().includes('bancada') || selectedMachine.toLowerCase().includes('cortador');
    
    // Porta rolos state with initial load from Realtime (supports both camelCase and snake_case DB fields)
    const currentMachineState = machineStates?.find(m => (m.machineName || (m as any).machine_name) === selectedMachine);
    let portaRolo1 = (currentMachineState?.portaRolo1Lot || (currentMachineState as any)?.porta_rolo_1_lot || '').toString().trim();
    let portaRolo2 = (currentMachineState?.portaRolo2Lot || (currentMachineState as any)?.porta_rolo_2_lot || '').toString().trim();
    let portaRolo1Wait = (currentMachineState?.portaRolo1WaitLot || (currentMachineState as any)?.porta_rolo_1_wait_lot || '').toString().trim();
    let portaRolo2Wait = (currentMachineState?.portaRolo2WaitLot || (currentMachineState as any)?.porta_rolo_2_wait_lot || '').toString().trim();
    
    // Auto-sanitização visual: Se ambos tiverem o mesmo lote no banco, evita duplicação na interface
    if (portaRolo1 && portaRolo1 === portaRolo2) {
        portaRolo2 = '';
    }

    const activeFeed1 = currentMachineState?.activeFeed1 ?? (currentMachineState as any)?.active_feed_1 ?? true;
    const activeFeed2 = currentMachineState?.activeFeed2 ?? (currentMachineState as any)?.active_feed_2 ?? true;

    const updateMachineStateDB = async (updates: Partial<import('../types').MachineCurrentState>) => {
        if (!selectedMachine) return;
        try {
            const current = machineStates?.find(m => (m.machineName || (m as any).machine_name) === selectedMachine) || {
                machineName: selectedMachine,
                status: 'PARADA' as const,
                activeFeed1: true,
                activeFeed2: true
            };
            
            // Extract the desired values explicitly. If `updates` provides a value (even null), it MUST override.
            const nextPR1 = 'portaRolo1Lot' in updates ? (updates.portaRolo1Lot || null) : (current.portaRolo1Lot || (current as any).porta_rolo_1_lot || null);
            let nextPR2 = 'portaRolo2Lot' in updates ? (updates.portaRolo2Lot || null) : (current.portaRolo2Lot || (current as any).porta_rolo_2_lot || null);
            
            const nextPR1Wait = 'portaRolo1WaitLot' in updates ? (updates.portaRolo1WaitLot || null) : (current.portaRolo1WaitLot || (current as any).porta_rolo_1_wait_lot || null);
            let nextPR2Wait = 'portaRolo2WaitLot' in updates ? (updates.portaRolo2WaitLot || null) : (current.portaRolo2WaitLot || (current as any).porta_rolo_2_wait_lot || null);
            
            // Prevent duplicate lots explicitly
            if (nextPR1 && nextPR1 === nextPR2) {
                nextPR2 = null;
            }

            const payload = { ...current, ...updates, operatorId: currentUser.id };
            
            // Optimistic update for snappy UI
            if (setMachineStates) {
                setMachineStates(prev => {
                    const newStates = [...(prev || [])];
                    const idx = newStates.findIndex(s => (s.machineName || (s as any).machine_name) === selectedMachine);
                    const updatedObj = {
                        ...(idx >= 0 ? newStates[idx] : {}),
                        ...updates,
                        machineName: selectedMachine,
                        machine_name: selectedMachine,
                        portaRolo1Lot: nextPR1 || undefined,
                        portaRolo2Lot: nextPR2 || undefined,
                        portaRolo1WaitLot: nextPR1Wait || undefined,
                        portaRolo2WaitLot: nextPR2Wait || undefined,
                        porta_rolo_1_lot: nextPR1,
                        porta_rolo_2_lot: nextPR2,
                        porta_rolo_1_wait_lot: nextPR1Wait,
                        porta_rolo_2_wait_lot: nextPR2Wait,
                    };
                    if (idx >= 0) {
                        newStates[idx] = updatedObj as any;
                    } else {
                        newStates.push(updatedObj as any);
                    }
                    return newStates;
                });
            }

            const { error } = await supabase.from('machine_current_states').upsert({
                machine_name: selectedMachine,
                operator_id: currentUser.id,
                status: payload.status,
                status_since: payload.statusSince,
                stop_reason: payload.stopReason,
                idle_since: payload.idleSince,
                porta_rolo_1_lot: nextPR1,
                porta_rolo_2_lot: nextPR2,
                porta_rolo_1_wait_lot: nextPR1Wait,
                porta_rolo_2_wait_lot: nextPR2Wait,
                active_feed_1: payload.activeFeed1 ?? true,
                active_feed_2: payload.activeFeed2 ?? true
            });
            if (error) {
                console.error('Supabase error:', error);
                alert('Erro do banco ao tentar atualizar a máquina: ' + error.message);
            }
        } catch (e: any) {
            console.error('Error updating machine state', e);
            alert('Falha crítica ao atualizar máquina: ' + (e?.message || JSON.stringify(e)));
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
    const [localOrders, setLocalOrders] = useState<ProductionOrderData[]>(allProgrammedOrders);
    const [loadingAction, setLoadingAction] = useState<string | null>(null);

    const getProgressObj = (po: any) => {
        if (!po) return {};
        let p = po.sub_items_progress || po.subItemsProgress;
        if (typeof p === 'string') {
            try { p = JSON.parse(p); } catch(e) { p = {}; }
        }
        return p || {};
    };

    useEffect(() => {
        if (allProgrammedOrders) {
            setLocalOrders(allProgrammedOrders.map(p => ({
                ...p,
                subItemsProgress: (p as any).sub_items_progress || p.subItemsProgress,
                sub_items_progress: (p as any).sub_items_progress || p.subItemsProgress
            })));
        }
    }, [allProgrammedOrders]);

    // Fast direct polling for operator panel (1.5s interval)
    useEffect(() => {
        if (!selectedMachine) return;
        const pollFreshData = async () => {
            try {
                const { data: pos } = await supabase
                    .from('production_orders')
                    .select('*')
                    .eq('machine', selectedMachine)
                    .in('status', ['pending', 'in_progress', 'producing', 'completed']);
                if (pos) {
                    setLocalOrders(pos.map(p => ({
                        ...p,
                        subItemsProgress: p.sub_items_progress || (p as any).subItemsProgress,
                        sub_items_progress: p.sub_items_progress || (p as any).subItemsProgress
                    })));
                }
            } catch(e) {}
        };
        pollFreshData();
        const interval = setInterval(pollFreshData, 1500);
        return () => clearInterval(interval);
    }, [selectedMachine]);

    const recentlySelectedLots = useRef<Record<string, number>>({});



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
            const progressObj = getProgressObj(po);
            return Object.values(progressObj).some((p: any) => p && typeof p === 'object' && p.status === 'producing');
        });
    }, [localOrders]);

    const idleStopRef = useRef(false);

    useEffect(() => {
        if (machineState === 'ATIVA' && !isAnyProducing) {
            if (!idleStopRef.current) {
                idleStopRef.current = true;
                const now = new Date().toISOString();
                
                if (!idleSince) {
                    updateMachineStateDB({ idleSince: now });
                }
                
                // Registra a parada de Aguardando O.S.
                const startIdleStop = async () => {
                    try {
                        // Fecha paradas "fantasmas" antigas do mesmo motivo que ficaram sem end_time
                        await supabase.from('machine_stops')
                            .update({ end_time: now })
                            .eq('machine', selectedMachine)
                            .eq('reason', 'Aguardando O.S.')
                            .is('end_time', null);
                    } catch (e) {
                        console.error('Ignorando erro ao fechar paradas fantasmas:', e);
                    }
                            
                    try {
                        console.log('Inserindo nova parada de Aguardando O.S.');
                        const insertResult = await supabase.from('machine_stops').insert({
                            machine: selectedMachine,
                            user_id: currentUser?.id || null,
                            username: currentUser?.username || 'unknown',
                            start_time: now,
                            reason: 'Aguardando O.S.'
                        });
                        console.log('Resultado da inserção:', insertResult);
                        if (insertResult.error) {
                            console.error('Erro ao inserir parada:', insertResult.error);
                        }
                    } catch (e) {
                        console.error('Error recording idle stop', e);
                    }
                };
                startIdleStop();
            }
        } else {
            idleStopRef.current = false;
            if (idleSince !== null) {
                const now = new Date().toISOString();
                updateMachineStateDB({ idleSince: null });
                
                // Encerra a parada de Aguardando O.S.
                const endIdleStop = async () => {
                    try {
                        await supabase.from('machine_stops')
                            .update({ end_time: now })
                            .eq('machine', selectedMachine)
                            .eq('reason', 'Aguardando O.S.')
                            .is('end_time', null);
                    } catch (e) {
                        console.error('Error closing idle stop', e);
                    }
                };
                endIdleStop();
            }
        }
    }, [machineState, isAnyProducing, idleSince, currentUser?.id, currentUser?.username, selectedMachine]);

    const toggleMachineState = async () => {
        idleStopRef.current = false;
        if (machineState === 'ATIVA') {
            setIsStopReasonModalOpen(true);
            return;
        }

        const now = new Date().toISOString();
        
        try {
            await supabase.from('machine_stops')
                .update({ end_time: now })
                .eq('machine', selectedMachine)
                .is('end_time', null);
        } catch (e) {
            console.error('Error updating machine stop state', e);
        }

        setMachineTimer('00:00:00');
        updateMachineStateDB({ status: 'ATIVA', statusSince: now, stopReason: '', idleSince: null });
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
    const [lotSearchQuery, setLotSearchQuery] = useState('');
    
    // As opções agora são puxadas dinamicamente do estoque (ex: ROLO - 12.50 mm)
    const [availableMaterialOptions, setAvailableMaterialOptions] = useState<string[]>([]);

    const fetchAvailableMaterialOptions = () => {
        setIsLoadingMaterials(true);
        try {
            const machineConfig = activeBrandingPartner?.machines?.find((m: any) => m.name === selectedMachine);
            let minGauge = 0;
            let maxGauge = 999;
            let specificGauges: number[] = [];

            if (machineConfig?.gaugeRange || machineConfig?.gauge_range) {
                const gr = String(machineConfig.gaugeRange || machineConfig.gauge_range).toUpperCase();
                const numbers = (gr.match(/\d+(?:[.,]\d+)?/g) || []).map(n => parseFloat(n.replace(',', '.')));
                
                if (gr.includes('À') || gr.includes('A') || gr.includes('ATE') || gr.includes('ATÉ') || gr.includes('-')) {
                    if (numbers.length >= 2) {
                        minGauge = Math.min(...numbers);
                        maxGauge = Math.max(...numbers);
                    } else if (numbers.length === 1) {
                        specificGauges = numbers;
                    }
                } else {
                    specificGauges = numbers;
                }
            } else {
                // Se não tem configuração de bitola, permite tudo
                minGauge = 0;
                maxGauge = 999;
            }

            // Utilizamos o stock já carregado na memória pelo App.tsx
            const activeGauges = gauges.filter(g => g.showInStockManagement !== false).map(g => `${g.materialType} - ${g.gauge}`);
            const availableStock = stock.filter(i => i.status !== 'Consumido').map(i => `${i.materialType} - ${i.bitola}`);
            
            const uniqueOptions = Array.from(new Set([...activeGauges, ...availableStock])).filter(s => {
                if (!s || s === ' - ' || s === 'undefined - undefined') return false;
                if (!s.toUpperCase().includes('ROLO')) return false;

                const sValueStr = s.split('-')[1]?.replace(',', '.').replace(/[^\d.]/g, '') || '0';
                const sValue = parseFloat(sValueStr);

                if (specificGauges.length > 0) {
                    if (!specificGauges.includes(sValue)) return false;
                } else {
                    if (sValue < minGauge || sValue > maxGauge) return false;
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
            setLotSearchQuery('');
            setIsAbastecimentoModalOpen(true);
            fetchAvailableMaterialOptions();
            return;
        }
        await registerMachineStop(reason);
    };

    const registerMachineStop = async (reason: string) => {
        const now = new Date().toISOString();
        idleStopRef.current = false;
        
        try {
            // Fecha qualquer parada "Aguardando O.S." aberta antes de iniciar a nova parada manual
            await supabase.from('machine_stops')
                .update({ end_time: now })
                .eq('machine', selectedMachine)
                .eq('reason', 'Aguardando O.S.')
                .is('end_time', null);

            await supabase.from('machine_stops').insert({
                machine: selectedMachine,
                user_id: currentUser?.id || null,
                username: currentUser?.username || 'unknown',
                start_time: now,
                reason: reason
            });
        } catch (e) {
            console.error('Error starting machine stop', e);
        }

        setMachineTimer('00:00:00');
        updateMachineStateDB({ status: 'PARADA', statusSince: now, stopReason: reason, idleSince: null });
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
        setIsAbastecimentoModalOpen(false);
        const lotValToSave = lot.internalLot || lot.supplierLot || lot.id;
        const now = new Date().toISOString();
        recentlySelectedLots.current[lotValToSave] = Date.now();

        let newPR1 = portaRolo1;
        let newPR2 = portaRolo2;
        let newPR1Wait = portaRolo1Wait;
        let newPR2Wait = portaRolo2Wait;

        if (selectedPortaRolo === 1) {
            if (portaRolo1) {
                const wantsReplace = window.confirm(`O Porta Rolo 1 já tem o lote ${portaRolo1}.\n\nClique em [OK] para SUBSTITUIR o lote atual.\nClique em [Cancelar] para definir este como LOTE EM ESPERA.`);
                if (wantsReplace) {
                    newPR1 = lotValToSave;
                } else {
                    newPR1Wait = lotValToSave;
                }
            } else {
                newPR1 = lotValToSave;
            }
        } else if (selectedPortaRolo === 2) {
            if (portaRolo2) {
                const wantsReplace = window.confirm(`O Porta Rolo 2 já tem o lote ${portaRolo2}.\n\nClique em [OK] para SUBSTITUIR o lote atual.\nClique em [Cancelar] para definir este como LOTE EM ESPERA.`);
                if (wantsReplace) {
                    newPR2 = lotValToSave;
                } else {
                    newPR2Wait = lotValToSave;
                }
            } else {
                newPR2 = lotValToSave;
            }
        }

        if (newPR1 === lotValToSave && portaRolo1 === lotValToSave) newPR1 = null;
        if (newPR2 === lotValToSave && portaRolo2 === lotValToSave) newPR2 = null;

        // 1. Immediate optimistic UI update
        if (setMachineStates) {
            setMachineStates(prev => {
                const newStates = [...(prev || [])];
                const idx = newStates.findIndex(s => (s.machineName || (s as any).machine_name) === selectedMachine);
                const updatedObj = {
                    ...(idx >= 0 ? newStates[idx] : {}),
                    machineName: selectedMachine,
                    machine_name: selectedMachine,
                    portaRolo1Lot: newPR1 || undefined,
                    portaRolo2Lot: newPR2 || undefined,
                    portaRolo1WaitLot: newPR1Wait || undefined,
                    portaRolo2WaitLot: newPR2Wait || undefined,
                    porta_rolo_1_lot: newPR1 || null,
                    porta_rolo_2_lot: newPR2 || null,
                    porta_rolo_1_wait_lot: newPR1Wait || null,
                    porta_rolo_2_wait_lot: newPR2Wait || null,
                    status: 'PARADA',
                    statusSince: now,
                    stopReason: 'Abastecimento'
                };
                if (idx >= 0) {
                    newStates[idx] = updatedObj as any;
                } else {
                    newStates.push(updatedObj as any);
                }
                return newStates;
            });
        }

        setMachineTimer('00:00:00');

        // 2. Immediate DB update
        try {
            await supabase.from('machine_current_states').upsert({
                machine_name: selectedMachine,
                operator_id: currentUser.id,
                status: 'PARADA',
                status_since: now,
                stop_reason: 'Abastecimento',
                porta_rolo_1_lot: newPR1,
                porta_rolo_2_lot: newPR2,
                porta_rolo_1_wait_lot: newPR1Wait,
                porta_rolo_2_wait_lot: newPR2Wait,
                active_feed_1: activeFeed1,
                active_feed_2: activeFeed2
            });
        } catch (e) {
            console.error('Error updating machine state on select lot', e);
        }

        // 3. Background updates for stock_items and machine_stops
        try {
            const oldInternalLot = selectedPortaRolo === 1 ? portaRolo1 : portaRolo2;
            if (oldInternalLot && oldInternalLot !== lotValToSave) {
                const oldLot = stock.find(i => i.internalLot === oldInternalLot || i.supplierLot === oldInternalLot || i.id === oldInternalLot);
                if (oldLot) {
                    supabase.from('stock_items').update({ status: 'Disponível' }).eq('id', oldLot.id).then(() => {}).catch(() => {});
                }
            }

            const newHistoryItem = {
                date: now,
                action: `Operador(a) ${currentUser.username || currentUser.name || 'Desconhecido'} selecionou o lote para uso na máquina ${selectedMachine}`,
                user: currentUser.username || currentUser.name || 'Sistema'
            };
            const existingHistory = Array.isArray(lot.history) ? lot.history : [];
            
            supabase.from('stock_items').update({ 
                status: `Em suporte de ${selectedMachine}`,
                history: [...existingHistory, newHistoryItem]
            }).eq('id', lot.id).then(() => {}).catch(() => {});

            supabase.from('machine_stops').insert({
                machine: selectedMachine,
                user_id: currentUser.id,
                username: currentUser.username,
                start_time: now,
                reason: 'Abastecimento'
            }).then(() => {}).catch(() => {});
            
            alert('Lote selecionado com sucesso!');
        } catch (error) {
            console.error('Erro ao vincular lote:', error);
            alert('Erro ao selecionar lote.');
        }
    };

    const handleRemoveLot = async (roloIndex: 1 | 2, lot: any) => {
        const confirm = window.confirm('Realmente quer desabastecer?');
        if (!confirm) {
            return;
        }
        try {
            const now = new Date().toISOString();
            const lotVal = String(lot?.internalLot || lot?.supplierLot || lot?.id || '').trim();

            const isDuplicateOnBoth = Boolean(
                (portaRolo1 && portaRolo2 && portaRolo1 === portaRolo2) ||
                (lotVal && (portaRolo1 === lotVal || String((currentMachineState as any)?.porta_rolo_1_lot || '').trim() === lotVal) && (portaRolo2 === lotVal || String((currentMachineState as any)?.porta_rolo_2_lot || '').trim() === lotVal))
            );

            let newPR1 = (roloIndex === 1 || isDuplicateOnBoth) ? null : (portaRolo1 || null);
            let newPR2 = (roloIndex === 2 || isDuplicateOnBoth) ? null : (portaRolo2 || null);

            if (newPR1 && newPR1 === newPR2) {
                newPR1 = null;
                newPR2 = null;
            }

            if (setMachineStates) {
                setMachineStates(prev => {
                    const newStates = [...(prev || [])];
                    const idx = newStates.findIndex(s => (s.machineName || (s as any).machine_name) === selectedMachine);
                    const updatedObj = {
                        ...(idx >= 0 ? newStates[idx] : {}),
                        machineName: selectedMachine,
                        machine_name: selectedMachine,
                        portaRolo1Lot: newPR1 || undefined,
                        portaRolo2Lot: newPR2 || undefined,
                        porta_rolo_1_lot: newPR1 || null,
                        porta_rolo_2_lot: newPR2 || null,
                        status: 'PARADA',
                        statusSince: now,
                        stopReason: 'Abastecimento'
                    };
                    if (idx >= 0) {
                        newStates[idx] = updatedObj as any;
                    } else {
                        newStates.push(updatedObj as any);
                    }
                    return newStates;
                });
            }

            setMachineTimer('00:00:00');

            await supabase.from('machine_current_states').upsert({
                machine_name: selectedMachine,
                operator_id: currentUser?.id || null,
                status: 'PARADA',
                status_since: now,
                stop_reason: 'Abastecimento',
                porta_rolo_1_lot: newPR1,
                porta_rolo_2_lot: newPR2,
                active_feed_1: activeFeed1,
                active_feed_2: activeFeed2
            });

            if (lot && lot.id) {
                const newHistoryItem = {
                    date: now,
                    action: `Operador(a) ${currentUser?.username || currentUser?.name || 'Desconhecido'} desabasteceu o lote da máquina ${selectedMachine}`,
                    user: currentUser?.username || currentUser?.name || 'Sistema'
                };
                const existingHistory = Array.isArray(lot.history) ? lot.history : [];
                
                await supabase.from('stock_items').update({ 
                    status: 'Disponível',
                    history: [...existingHistory, newHistoryItem]
                }).eq('id', lot.id);
            } else if (lotVal) {
                await supabase.from('stock_items').update({ 
                    status: 'Disponível'
                }).or(`internalLot.eq.${lotVal},supplierLot.eq.${lotVal},id.eq.${lotVal}`);
            }

            try {
                await supabase.from('machine_stops').insert({
                    machine: selectedMachine,
                    user_id: currentUser?.id || null,
                    username: currentUser?.username || 'unknown',
                    start_time: now,
                    reason: 'Abastecimento'
                });
            } catch (e) {}
            
            alert('Lote removido com sucesso!');
        } catch (error: any) {
            alert('ERRO AO DESABASTECER: ' + (error?.message || JSON.stringify(error)));
            console.error(error);
        }
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
        if (isCurrentMachineBancada) return true;
        
        const po = localOrders.find(p => p.id === osId);
        if (!po) return true;
        
        const osBitola = (po as any).target_bitola || (po as any).targetBitola || '';
        if (!osBitola) return true;
        
        const stdOsBitola = parseFloat(String(osBitola).replace(',', '.').replace(/[^\d.]/g, ''));

        let activeLotsBitolas: number[] = [];
        if (portaRolo1 && activeFeed1) {
            const l1 = stock.find(i => i.internalLot === portaRolo1 || i.supplierLot === portaRolo1 || i.id === portaRolo1);
            if (l1) {
                const b = parseFloat(String(l1.bitola || l1.gauge || '').replace(',', '.').replace(/[^\d.]/g, ''));
                if (!isNaN(b)) activeLotsBitolas.push(b);
            }
        }
        if (portaRolo2 && activeFeed2) {
            const l2 = stock.find(i => i.internalLot === portaRolo2 || i.supplierLot === portaRolo2 || i.id === portaRolo2);
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
        if (!isCurrentMachineBancada && !hasValidFeed) {
            alert('Você precisa abastecer a máquina e manter ATIVADA pelo menos uma das opções (Porta Rolo 1 ou 2) antes de continuar o corte.');
            return;
        }
        if (!validateBitolaMatch(osId)) return;
        setActiveModalPoId(osId);
        const po = localOrders.find(p => p.id === osId);
        let foundProducing = false;

        if (po) {
            const currentProgressObj = getProgressObj(po);
            
            for (const key in currentProgressObj) {
                if (currentProgressObj[key]?.status === 'producing') {
                    let cleanSubOsKey = key.replace('sub_', '').split('_')[0];
                    const valSubOsKey = currentProgressObj[key]?.subOsKey || currentProgressObj[key]?.sub_os_key;
                    if (valSubOsKey) cleanSubOsKey = String(valSubOsKey);
                    const commOrderId = (po as any).related_commercial_order_id || (po as any).relatedCommercialOrderId;
                    const commOrder = commercialOrders.find(co => co.id === commOrderId);
                    const rawProjectData = (commOrder as any)?.project_data || commOrder?.projectData;
                    
                    if (rawProjectData && Array.isArray(rawProjectData)) {
                        const normalizedData = rawProjectData.map(item => {
                            const newItem: any = {};
                            for (const k in item) {
                                newItem[k.trim().toLowerCase()] = item[k];
                            }
                            return newItem;
                        });
                        const foundSub = normalizedData.find(s => String(s.os).trim() === cleanSubOsKey);
                        if (foundSub) {
                            setActiveSubOs(foundSub);
                            setSubOsSearch(cleanSubOsKey);
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
        if (!isCurrentMachineBancada && !hasValidFeed) {
            alert('Você precisa abastecer a máquina e manter ATIVADA pelo menos uma das opções (Porta Rolo 1 ou 2) antes de iniciar ou continuar o corte.');
            return;
        }
        if (!validateBitolaMatch(osId)) return;
        setLoadingAction(`start-${osId}-${subOsKey}`);
        try {
            const po = localOrders.find(p => p.id === osId);
            if (!po) { setLoadingAction(null); return; }
            
            // --- NEW: Weight Check Logic ---
            if (!isCurrentMachineBancada) {
                const commOrderId = (po as any).related_commercial_order_id || (po as any).relatedCommercialOrderId;
                const commOrder = commercialOrders.find(co => co.id === commOrderId);
                const rawProjectData = (commOrder as any)?.project_data || commOrder?.projectData;
                let weightNeeded = 0;
                
                if (rawProjectData && Array.isArray(rawProjectData)) {
                    const normalizedData = rawProjectData.map(item => {
                        const newItem: any = {};
                        for (const k in item) {
                            newItem[k.trim().toLowerCase()] = item[k];
                        }
                        return newItem;
                    });
                    const foundSub = normalizedData.find(s => String(s.os).trim() === String(subOsKey).trim());
                    if (foundSub) {
                        const qtd = parseFloat(foundSub.qunti || foundSub.quantidade || foundSub.qtd || '0');
                        const compCm = parseFloat(foundSub.comprimento || foundSub.comp || '0');
                        weightNeeded = parseFloat(foundSub.peso || foundSub.pesoTotal || '0');
                        
                        if (!weightNeeded || isNaN(weightNeeded) || weightNeeded === 0) {
                            const bitolaStr = po.target_bitola || po.targetBitola || '';
                            const gaugeObj = gauges.find(g => g.gauge === bitolaStr);
                            const weightPerM = gaugeObj?.weightPerMeter || gaugeObj?.rawWeightValue || 0;
                            if (weightPerM > 0) {
                                weightNeeded = (compCm / 100) * qtd * weightPerM;
                            }
                        }
                    }
                }

                if (weightNeeded > 0) {
                    let totalRemaining = 0;
                    let hasWaitLot = false;
                    
                    if (portaRolo1 && activeFeed1) {
                        const l1 = stock.find(i => i.internalLot === portaRolo1 || i.supplierLot === portaRolo1 || i.id === portaRolo1);
                        if (l1) totalRemaining += (l1.remainingQuantity ?? l1.labelWeight ?? l1.weight ?? 0);
                        if (portaRolo1Wait) hasWaitLot = true;
                    }
                    if (portaRolo2 && activeFeed2) {
                        const l2 = stock.find(i => i.internalLot === portaRolo2 || i.supplierLot === portaRolo2 || i.id === portaRolo2);
                        if (l2) totalRemaining += (l2.remainingQuantity ?? l2.labelWeight ?? l2.weight ?? 0);
                        if (portaRolo2Wait) hasWaitLot = true;
                    }

                    if (totalRemaining < weightNeeded && !hasWaitLot) {
                        alert(`ATENÇÃO: A peça requer ${weightNeeded.toFixed(2)} kg, mas o rolo ativo possui apenas ${totalRemaining.toFixed(2)} kg.\n\nPor favor, adicione um LOTE EM ESPERA no abastecimento antes de continuar.`);
                        setLoadingAction(null);
                        
                        // Try to open modal automatically for the first active porta rolo
                        if (portaRolo1 && activeFeed1) {
                            try {
                                (window as any)._hackSetSelectedPortaRolo && (window as any)._hackSetSelectedPortaRolo(1);
                                (window as any)._hackSetAbastecimentoStep && (window as any)._hackSetAbastecimentoStep(1);
                                (window as any)._hackSetIsAbastecimentoModalOpen && (window as any)._hackSetIsAbastecimentoModalOpen(true);
                            } catch(e) {}
                        } else if (portaRolo2 && activeFeed2) {
                            try {
                                (window as any)._hackSetSelectedPortaRolo && (window as any)._hackSetSelectedPortaRolo(2);
                                (window as any)._hackSetAbastecimentoStep && (window as any)._hackSetAbastecimentoStep(1);
                                (window as any)._hackSetIsAbastecimentoModalOpen && (window as any)._hackSetIsAbastecimentoModalOpen(true);
                            } catch(e) {}
                        }
                        return;
                    }
                }
            }
            // --- END NEW ---
            
            let currentProgress = getProgressObj(po);
            const startTime = new Date().toISOString();
            const strSubKey = String(subOsKey).trim();
            
            if (machineState === 'PARADA') {
                try {
                    await supabase.from('machine_stops')
                        .update({ end_time: startTime })
                        .eq('user_id', currentUser.id)
                        .eq('machine', selectedMachine)
                        .is('end_time', null);
                    updateMachineStateDB({ status: 'ATIVA', statusSince: startTime, stopReason: '' });
                } catch(e) {}
            }
            
            // Check if there is already an entry for this subOsKey that is currently 'producing'
            let cutKey = Object.keys(currentProgress).find(k => {
                let clean = k.replace('sub_', '').split('_')[0];
                const valSubOsKey = currentProgress[k]?.subOsKey || currentProgress[k]?.sub_os_key;
                if (valSubOsKey) clean = String(valSubOsKey);
                return clean === strSubKey && currentProgress[k]?.status === 'producing';
            });

            if (!cutKey) {
                // Generate a unique timestamped key so previous cuts are NEVER overwritten
                cutKey = `${strSubKey}_${Date.now()}`;
            }

            const updatedProgress = {
                ...currentProgress,
                [cutKey]: { status: 'producing', start_time: startTime, sub_os_key: strSubKey }
            };

            // OPTIMISTIC UPDATE: Immediate UI Feedback
            setLocalOrders(prev => prev.map(p => {
                if (p.id === osId) {
                    return { 
                        ...p, 
                        subItemsProgress: updatedProgress,
                        sub_items_progress: updatedProgress,
                        status: 'in_progress',
                        startTime: p.startTime || p.start_time || startTime
                    };
                }
                return p;
            }));

            const { error } = await supabase
                .from('production_orders')
                .update({ 
                    sub_items_progress: updatedProgress, 
                    status: 'in_progress',
                    ...((!po.startTime && !po.start_time) ? { start_time: startTime } : {})
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
            if (!po) { 
                alert('OS não encontrada na memória local.');
                setLoadingAction(null); 
                return; 
            }
            
            let currentProgress = getProgressObj(po);
            const endTime = new Date().toISOString();
            const strSubKey = String(subOsKey).trim();

            let cutKey = Object.keys(currentProgress).find(k => {
                let clean = k.replace('sub_', '').split('_')[0];
                const valSubOsKey = currentProgress[k]?.subOsKey || currentProgress[k]?.sub_os_key;
                if (valSubOsKey) clean = String(valSubOsKey);
                return clean === strSubKey && currentProgress[k]?.status === 'producing';
            });

            if (!cutKey) {
                if (currentProgress[strSubKey] && currentProgress[strSubKey].status !== 'completed') {
                    cutKey = strSubKey;
                } else {
                    cutKey = `${strSubKey}_${Date.now()}`;
                }
            }

            const existingStart = currentProgress[cutKey]?.start_time || currentProgress[cutKey]?.startTime || endTime;
            
            const usedLotsArr = [];
            if (portaRolo1 && activeFeed1) usedLotsArr.push(portaRolo1);
            if (portaRolo2 && activeFeed2) usedLotsArr.push(portaRolo2);
            const lotUsedStr = usedLotsArr.join(', ') || '-';

            const updatedProgress = {
                ...currentProgress,
                [cutKey]: { status: 'completed', start_time: existingStart, end_time: endTime, sub_os_key: strSubKey, lot_used: lotUsedStr }
            };

            // OPTIMISTIC UPDATE
            setLocalOrders(prev => prev.map(p => {
                if (p.id === osId) {
                    return { 
                        ...p, 
                        subItemsProgress: updatedProgress,
                        sub_items_progress: updatedProgress
                    };
                }
                return p;
            }));

            const activeSubOsRef = { ...activeSubOs };
            let pieceWeightForBancada = 0;

            const { error } = await supabase
                .from('production_orders')
                .update({ sub_items_progress: updatedProgress })
                .eq('id', osId);
                
            if (error) {
                console.error('Supabase error:', error);
                alert(`Erro do sistema ao finalizar o corte: ${error.message || JSON.stringify(error)}`);
            } else {
                // Abater peso
                if (!isCurrentMachineBancada) {
                    try {
                        const qtd = parseFloat(activeSubOsRef.qunti || activeSubOsRef.quantidade || activeSubOsRef.qtd || '0');
                        const compCm = parseFloat(activeSubOsRef.comprimento || activeSubOsRef.comp || '0');
                        let weightProduced = parseFloat(activeSubOsRef.peso || activeSubOsRef.pesoTotal || '0');
                        
                        if (!weightProduced || isNaN(weightProduced) || weightProduced === 0) {
                            const bitolaStr = po.target_bitola || po.targetBitola || '';
                            const gaugeObj = gauges.find(g => g.gauge === bitolaStr);
                            const weightPerM = gaugeObj?.weightPerMeter || gaugeObj?.rawWeightValue || 0;
                    if (weightPerM > 0) {
                                weightProduced = (compCm / 100) * qtd * weightPerM;
                            }
                        }

                        pieceWeightForBancada = weightProduced;

                        if (weightProduced > 0) {
                            const activeLotsParams = [];
                            if (portaRolo1 && activeFeed1) {
                                const l1 = stock.find(i => i.internalLot === portaRolo1 || i.supplierLot === portaRolo1 || i.id === portaRolo1);
                                const w1 = portaRolo1Wait ? stock.find(i => i.internalLot === portaRolo1Wait || i.supplierLot === portaRolo1Wait || i.id === portaRolo1Wait) : undefined;
                                if (l1) activeLotsParams.push({ primary: l1, wait: w1, pIndex: 1 });
                            }
                            if (portaRolo2 && activeFeed2) {
                                const l2 = stock.find(i => i.internalLot === portaRolo2 || i.supplierLot === portaRolo2 || i.id === portaRolo2);
                                const w2 = portaRolo2Wait ? stock.find(i => i.internalLot === portaRolo2Wait || i.supplierLot === portaRolo2Wait || i.id === portaRolo2Wait) : undefined;
                                if (l2) activeLotsParams.push({ primary: l2, wait: w2, pIndex: 2 });
                            }

                            if (activeLotsParams.length > 0) {
                                const weightPerLot = weightProduced / activeLotsParams.length;
                                
                                for (const param of activeLotsParams) {
                                    const lotObj = param.primary;
                                    const waitObj = param.wait;
                                    const currentQty = lotObj.remainingQuantity ?? lotObj.weight ?? lotObj.labelWeight ?? 0;
                                    
                                    const commOrderId = (po as any).related_commercial_order_id || (po as any).relatedCommercialOrderId;
                                    const commOrder = commercialOrders.find(co => co.id === commOrderId);
                                    const clientName = (commOrder as any)?.client_name || commOrder?.clientName || 'Não informado';
                                    const orderNumberStr = (commOrder as any)?.order_number || commOrder?.orderNumber || (po as any).order_number || po.orderNumber || 'Desconhecido';

                                    if (currentQty >= weightPerLot) {
                                        // Consumo normal
                                        const newRemaining = currentQty - weightPerLot;
                                        
                                        const consumeHistoryItem = {
                                            date: endTime,
                                            action: `Máquina: ${selectedMachine} | Operador: ${currentUser.username || currentUser.name || 'Sistema'} | Cliente: ${clientName} | Pedido: ${orderNumberStr} (SubOS ${subOsKey}) | Baixa: ${weightPerLot.toFixed(2)} kg`,
                                            user: currentUser.username || currentUser.name || 'Sistema'
                                        };

                                        await supabase.from('stock_items').update({
                                            remaining_quantity: newRemaining,
                                            history: [...(lotObj.history || []), consumeHistoryItem]
                                        }).eq('id', lotObj.id);
                                    } else {
                                        // Consumiu todo o lote principal, o resto vai pro Lote em Espera
                                        const deficit = weightPerLot - currentQty;
                                        
                                        const consumePrimaryHistoryItem = {
                                            date: endTime,
                                            action: `Máquina: ${selectedMachine} | Operador: ${currentUser.username || currentUser.name || 'Sistema'} | Cliente: ${clientName} | Pedido: ${orderNumberStr} (SubOS ${subOsKey}) | Baixa Final: ${currentQty.toFixed(2)} kg. (Restante de ${deficit.toFixed(2)} kg abatido do Lote em Espera)`,
                                            user: currentUser.username || currentUser.name || 'Sistema'
                                        };

                                        await supabase.from('stock_items').update({
                                            remaining_quantity: 0,
                                            status: 'Consumido',
                                            history: [...(lotObj.history || []), consumePrimaryHistoryItem]
                                        }).eq('id', lotObj.id);

                                        if (waitObj) {
                                            const waitQty = waitObj.remainingQuantity ?? waitObj.weight ?? waitObj.labelWeight ?? 0;
                                            const newWaitRemaining = Math.max(0, waitQty - deficit);
                                            
                                            const consumeWaitHistoryItem = {
                                                date: endTime,
                                                action: `Máquina: ${selectedMachine} | Operador: ${currentUser.username || currentUser.name || 'Sistema'} | Cliente: ${clientName} | Pedido: ${orderNumberStr} (SubOS ${subOsKey}) | Baixa (Início Rolo): ${deficit.toFixed(2)} kg`,
                                                user: currentUser.username || currentUser.name || 'Sistema'
                                            };

                                            await supabase.from('stock_items').update({
                                                remaining_quantity: newWaitRemaining,
                                                status: `Em suporte de ${selectedMachine}`,
                                                history: [...(waitObj.history || []), consumeWaitHistoryItem]
                                            }).eq('id', waitObj.id);

                                            // Transition wait lot to primary lot
                                            const nextLotId = waitObj.internalLot || waitObj.supplierLot || waitObj.id;
                                            if (param.pIndex === 1) {
                                                updateMachineStateDB({ portaRolo1Lot: nextLotId, portaRolo1WaitLot: null });
                                            } else {
                                                updateMachineStateDB({ portaRolo2Lot: nextLotId, portaRolo2WaitLot: null });
                                            }
                                        } else {
                                            // Se não tinha lote de espera, o deficit foi perdido (já alertamos no início, mas caso ocorra)
                                            if (param.pIndex === 1) {
                                                updateMachineStateDB({ portaRolo1Lot: null });
                                            } else {
                                                updateMachineStateDB({ portaRolo2Lot: null });
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    } catch (err: any) {
                        console.error('Erro ao abater peso do lote:', err);
                        alert(`Erro ao abater peso: ${err.message || 'Desconhecido'}`);
                    }
                }
            }
                
            setSubOsSearch('');
            setActiveSubOs(null);
            
            if (!isCurrentMachineBancada) {
                setBancadaConfirmState({ isOpen: true, subOsKey, po, subOsItem: activeSubOsRef, weight: pieceWeightForBancada });
            }
        } catch (e: any) {
            console.error('Erro ao finalizar mini OS:', e);
            alert(`Erro Crítico ao finalizar corte da peça: ${e.message || JSON.stringify(e)}`);
            setSubOsSearch('');
            setActiveSubOs(null);
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
            const po = localOrders.find(p => p.id === osId);
            let updatedProgress = getProgressObj(po);
            
            let hasChanges = false;
            const now = new Date().toISOString();
            
            Object.keys(updatedProgress).forEach(key => {
                if ((updatedProgress as any)[key].status === 'producing') {
                    (updatedProgress as any)[key].status = 'paused';
                    (updatedProgress as any)[key].end_time = now;
                    hasChanges = true;
                }
            });

            await supabase
                .from('production_orders')
                .update({ 
                    status: 'pending',
                    ...(hasChanges ? { sub_items_progress: updatedProgress } : {})
                })
                .eq('id', osId);
                
            setLocalOrders(prev => prev.map(poItem => {
                if (poItem.id === osId) {
                    return { 
                        ...poItem, 
                        status: 'pending',
                        ...(hasChanges ? { subItemsProgress: updatedProgress } : {})
                    };
                }
                return poItem;
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

    const isOrderFullyCut = (po: any) => {
        const total = (po as any).quantity_os || (po as any).quantityOs || 0;
        const completed = po.sub_items_progress 
            ? Object.values(po.sub_items_progress).filter((s: any) => s.status === 'completed').length 
            : 0;
        return total > 0 && completed >= total;
    };

    const pendingOrders = filteredOrders.filter(po => po.status !== 'completed' && !isOrderFullyCut(po)).sort((a, b) => {
        const aIsCutting = a.sub_items_progress && Object.values(a.sub_items_progress).some((sub: any) => sub.status === 'producing');
        const bIsCutting = b.sub_items_progress && Object.values(b.sub_items_progress).some((sub: any) => sub.status === 'producing');
        if (aIsCutting && !bIsCutting) return -1;
        if (!aIsCutting && bIsCutting) return 1;
        
        const aIsProducing = a.status === 'producing' || a.status === 'in_progress';
        const bIsProducing = b.status === 'producing' || b.status === 'in_progress';
        if (aIsProducing && !bIsProducing) return -1;
        if (!aIsProducing && bIsProducing) return 1;

        return 0;
    });
    const completedOrders = filteredOrders.filter(po => po.status === 'completed' || (po.status !== 'completed' && isOrderFullyCut(po)));
    
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
                                <p className={`text-lg font-black mt-0.5 ${isAnyProducing ? 'text-emerald-400' : 'text-orange-400 animate-pulse'}`}>
                                    {isAnyProducing ? '⚡ EM PRODUÇÃO' : '🟠 AGUARDANDO O.S.'}
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
                        <div className={`py-2 px-4 rounded-lg flex items-center justify-center gap-2 font-mono text-xl font-bold ${isAnyProducing ? 'bg-emerald-900/50 text-emerald-100 border border-emerald-500/30' : 'bg-orange-900/50 text-orange-400 border border-orange-500/30'}`}>
                            {!isAnyProducing && (
                                <span className="uppercase text-[12px] mr-2 font-black tracking-widest text-orange-400 animate-pulse">AGUARDANDO O.S. — </span>
                            )}
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            {isAnyProducing ? machineTimer : (idleTimer !== '00:00:00' ? idleTimer : machineTimer)}
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
                                
                            </div>
                        </div>
                    )}
                
                {!isCurrentMachineBancada && (
                <div className="bg-white p-4 rounded-2xl shadow-sm border-2 border-slate-200 flex flex-col gap-3">
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
                        Alimentação (Porta Rolos)
                    </h3>
                    <div className="flex gap-3">
                        {(() => {
                            const renderPortaRolo = (title: string, internalLotId: string, waitLotId: string, roloIndex: 1 | 2) => {
                                const lot = internalLotId ? stock.find(i => (i.internalLot && i.internalLot === internalLotId) || (i.supplierLot && i.supplierLot === internalLotId) || (i.id && i.id === internalLotId)) : undefined;
                                const waitLot = waitLotId ? stock.find(i => (i.internalLot && i.internalLot === waitLotId) || (i.supplierLot && i.supplierLot === waitLotId) || (i.id && i.id === waitLotId)) : undefined;
                                const isActive = roloIndex === 1 ? activeFeed1 : activeFeed2;
                                
                                if (!lot && !waitLot) {
                                    return (
                                        <div className="flex-1 flex flex-col gap-1">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase">{title}</label>
                                            <div className="w-full min-h-[104px] bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-400">
                                                <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Livre / Vazio</span>
                                            </div>
                                        </div>
                                    );
                                }

                                const initialWeight = lot ? (lot.labelWeight || lot.weight || 0) : 0;
                                const remainingWeight = lot ? (lot.remainingQuantity ?? initialWeight) : 0;
                                const consumedWeight = Math.max(0, initialWeight - remainingWeight);

                                const waitInitialWeight = waitLot ? (waitLot.labelWeight || waitLot.weight || 0) : 0;
                                const waitRemainingWeight = waitLot ? (waitLot.remainingQuantity ?? waitInitialWeight) : 0;

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
                                        {lot && (
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
                                                    <div className="col-span-2 mt-1">
                                                        <button
                                                            onClick={() => handleRemoveLot(roloIndex, lot)}
                                                            className="w-full text-[10px] font-bold text-red-500 bg-red-50 hover:bg-red-100 rounded py-1.5 px-2 uppercase transition-colors"
                                                        >
                                                            Desabastecer
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {waitLot && (
                                            <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl p-3 flex flex-col gap-1 relative overflow-hidden mt-2">
                                                <div className="absolute top-0 right-0 bg-slate-400 text-white text-[8px] font-black px-2 py-0.5 rounded-bl-lg z-10">
                                                    EM ESPERA: {waitLot.internalLot || waitLot.supplierLot}
                                                </div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-sm font-black text-slate-600">{waitLot.bitola || waitLot.gauge || '-'}</span>
                                                    <span className="text-[10px] font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded uppercase tracking-wider">{waitLot.materialType}</span>
                                                </div>
                                                <div className="flex flex-row justify-between items-center mt-1 text-[10px]">
                                                    <span className="text-slate-400 font-bold uppercase">Disp.</span>
                                                    <span className="text-slate-700 font-black">{Number(waitRemainingWeight).toFixed(2)} kg</span>
                                                </div>
                                                <div className="mt-1 border-t border-slate-200 pt-1">
                                                    <button
                                                        onClick={() => {
                                                            const confirm = window.confirm('Deseja remover este lote da espera?');
                                                            if (confirm) {
                                                                if (roloIndex === 1) updateMachineStateDB({ portaRolo1WaitLot: null });
                                                                else updateMachineStateDB({ portaRolo2WaitLot: null });
                                                            }
                                                        }}
                                                        className="w-full text-[9px] font-bold text-red-400 hover:text-red-600 uppercase text-center"
                                                    >
                                                        Remover Espera
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            };

                            return (
                                <>
                                    {renderPortaRolo('Porta Rolo 1', portaRolo1, portaRolo1Wait, 1)}
                                    {renderPortaRolo('Porta Rolo 2', portaRolo2, portaRolo2Wait, 2)}
                                </>
                            );
                        })()}
                    </div>
                </div>
                )}

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
                        
                        const lengthCm = (po as any).tamanho || ((po as any).total_meters && (po as any).quantity_os ? Math.round(((po as any).total_meters / (po as any).quantity_os) * 100) : 0);
                        const isCuttingSubOS = po.sub_items_progress && Object.values(po.sub_items_progress).some((sub: any) => sub.status === 'producing');
                        const isMachineCutting = localOrders.some(p => p.sub_items_progress && Object.values(p.sub_items_progress).some((sub: any) => sub.status === 'producing'));
                        
                        return (
                            <div key={po.id} className={`bg-white rounded-xl p-3 shadow-sm border-l-4 flex flex-col gap-2 transition-all duration-500 ${po.status === 'completed' || isOrderFullyCut(po) ? 'border-slate-300 opacity-80' : isCuttingSubOS ? 'border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.4)] ring-2 ring-orange-400 bg-orange-50/40 animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]' : isProducing ? 'border-emerald-500 shadow-md ring-1 ring-emerald-100 bg-emerald-50/30' : (po.status === 'paused' || (po.status === 'pending' && po.startTime)) ? 'border-orange-400 shadow-md ring-1 ring-orange-100' : 'border-indigo-500'}`}>
                                {/* Linha 1: Pedido e Bitola */}
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2 overflow-hidden pr-2">
                                        {((commOrder as any)?.order_number || commOrder?.orderNumber) && (
                                            <span className="text-xs font-black text-slate-700 bg-slate-100 rounded px-2 py-0.5 shrink-0">
                                                #{((commOrder as any)?.order_number || commOrder?.orderNumber)}
                                            </span>
                                        )}
                                        {((commOrder as any)?.client_name || commOrder?.clientName) && (
                                            <span className="text-[11px] font-semibold text-slate-500 truncate">
                                                {((commOrder as any)?.client_name || commOrder?.clientName)}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center shrink-0">
                                        <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px] font-black text-slate-600 border border-slate-200">
                                            {(po as any).target_bitola || po.targetBitola}mm
                                        </span>
                                    </div>
                                </div>

                                {/* Linha 2: Quantidade/Comprimento e Status */}
                                <div className="flex justify-between items-center bg-slate-50 rounded-lg p-2 border border-slate-100">
                                    <div className="flex items-center gap-1.5">
                                        <svg xmlns="http://www.w3.org/2000/svg" className={`w-3.5 h-3.5 shrink-0 ${isCuttingSubOS ? 'text-orange-500 animate-[spin_3s_linear_infinite]' : isProducing ? 'text-emerald-500 animate-[spin_3s_linear_infinite]' : 'text-slate-400'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                                            <circle cx="12" cy="12" r="3"/>
                                        </svg>
                                        <span className="font-bold text-slate-700 text-[11px]">
                                            {(() => {
                                                const total = (po as any).quantity_os || (po as any).quantityOs || 0;
                                                const completed = po.sub_items_progress 
                                                    ? Object.values(po.sub_items_progress).filter((s: any) => s.status === 'completed').length 
                                                    : 0;
                                                return `${completed} / ${total} un.`;
                                            })()}
                                        </span>
                                        {lengthCm > 0 && (
                                            <>
                                                <span className="text-slate-300 text-[11px] font-black">×</span>
                                                <span className="text-indigo-600 font-black text-[11px]">{lengthCm} cm</span>
                                            </>
                                        )}
                                    </div>

                                    <div className="shrink-0">
                                        {po.status === 'completed' || isOrderFullyCut(po) ? (
                                            <span className="text-[9px] font-black text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded uppercase">Finalizada</span>
                                        ) : isProducing && po.startTime ? (
                                            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded border shadow-sm ${isCuttingSubOS ? 'bg-orange-100 border-orange-300' : 'bg-emerald-100 border-emerald-200'}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isCuttingSubOS ? 'bg-orange-500' : 'bg-emerald-500'}`}></span>
                                                <span className={`text-[9px] font-black uppercase flex items-center gap-1 ${isCuttingSubOS ? 'text-orange-700' : 'text-emerald-700'}`}>
                                                    CORTANDO: <ActiveTimer startTime={po.startTime} />
                                                </span>
                                            </div>
                                        ) : (po.status === 'paused' || (po.status === 'pending' && po.startTime)) ? (
                                            <span className="text-[9px] font-black text-orange-600 bg-orange-100 px-2 py-0.5 rounded uppercase">Pausada</span>
                                        ) : (
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Aguardando</span>
                                        )}
                                    </div>
                                </div>

                                {/* Linha 3: Botões */}
                                {(po.status !== 'completed' && !isOrderFullyCut(po)) && (
                                    <div className="mt-0.5">
                                        {isMachineCutting && !isCuttingSubOS ? (
                                            <div className="w-full bg-slate-100 text-slate-400 font-black py-2.5 rounded-lg text-xs uppercase text-center border border-slate-200 shadow-inner">
                                                Em fila para produzir
                                            </div>
                                        ) : !isProducing ? (
                                            <button 
                                                disabled={localOrders.some(p => p.status === 'producing' || p.status === 'in_progress')}
                                                onClick={() => handleOpenModal(po.id)}
                                                className={`w-full ${po.status === 'paused' || (po.status === 'pending' && po.startTime) ? 'bg-indigo-500 hover:bg-indigo-600' : 'bg-emerald-500 hover:bg-emerald-600'} text-white font-black py-2.5 rounded-lg text-xs uppercase shadow-sm active:scale-95 transition-all disabled:opacity-50 disabled:bg-slate-300 disabled:text-slate-500 disabled:pointer-events-none`}
                                            >
                                                {po.status === 'paused' || (po.status === 'pending' && po.startTime) ? 'Retomar Produção' : 'Iniciar Produção'}
                                            </button>
                                        ) : (
                                            <button 
                                                onClick={() => handleOpenModal(po.id)}
                                                className={`w-full ${isCuttingSubOS ? 'bg-red-500 hover:bg-red-600' : 'bg-indigo-500 hover:bg-indigo-600'} text-white font-black py-2.5 px-2 rounded-lg text-[10px] sm:text-[11px] uppercase shadow-sm active:scale-95 transition-all whitespace-nowrap`}
                                            >
                                                {isCuttingSubOS ? (isCurrentMachineBancada ? 'FINALIZAR DOBRA' : 'FINALIZAR CORTE') : (isCurrentMachineBancada ? 'INICIAR DOBRA' : 'INICIAR CORTE')}
                                            </button>
                                        )}
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
                    
                    let subItemsResult = normalizedData.filter(item => {
                        const mm = item.mm || item.bitola || item.diametro || item.bit;
                        const poBitola = (po as any).target_bitola || po.targetBitola || '0';
                        return parseFloat(String(mm).replace(',', '.').replace(/[^\d.-]/g, '')) === parseFloat(String(poBitola).replace(',', '.').replace(/[^\d.-]/g, ''));
                    });

                    // Se a máquina for Bancada, mostra apenas os itens que constam no sub_items_progress (peças enviadas)
                    const isBancada = selectedMachine?.trim().toLowerCase() === 'bancada' || selectedMachine?.trim().toLowerCase() === 'bancada/cortador';
                    if (isBancada) {
                        const progress = getProgressObj(po);
                        const allowedSubOsKeys = Object.keys(progress).map(k => {
                            const valSubOsKey = progress[k]?.subOsKey || progress[k]?.sub_os_key;
                            if (valSubOsKey) return String(valSubOsKey).trim();
                            return k.replace('sub_', '').split('_')[0].trim();
                        });
                        
                        subItemsResult = subItemsResult.filter(item => {
                            return allowedSubOsKeys.includes(String(item.os).trim());
                        });
                    }
                    
                    subItems = subItemsResult;
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

                const currentProgressObj = getProgressObj(po);
                const targetSubOsStr = activeSubOs ? String(activeSubOs.os).trim() : '';

                const handleFinishAllSubOs = async () => {
                    const pass = window.prompt("Digite a senha do gestor para finalizar todas as O.S. restantes:");
                    if (pass !== "070223") {
                        if (pass !== null) alert("Senha incorreta!");
                        return;
                    }

                    const pendingSubItems = subItems.filter(item => {
                        const itemOsStr = String(item.os).trim();
                        const isComp = Object.values(currentProgressObj).some((v: any) => {
                            const kStr = v?.subOsKey || v?.sub_os_key;
                            return String(kStr) === itemOsStr && v?.status === 'completed';
                        });
                        return !isComp;
                    });

                    if (pendingSubItems.length === 0) {
                        alert("Todas as O.S. deste lote já estão finalizadas.");
                        return;
                    }

                    let totalWeightToDeduce = 0;
                    const bitolaStr = po.target_bitola || po.targetBitola || '';
                    const gaugeObj = gauges.find(g => g.gauge === bitolaStr);
                    const weightPerM = gaugeObj?.weightPerMeter || gaugeObj?.rawWeightValue || 0;

                    pendingSubItems.forEach(item => {
                        let weightProduced = parseFloat(item.peso || item.pesoTotal || '0');
                        if (!weightProduced || isNaN(weightProduced) || weightProduced === 0) {
                            const qtd = parseFloat(item.qunti || item.quantidade || item.qtd || '0');
                            const compCm = parseFloat(item.comprimento || item.comp || '0');
                            if (weightPerM > 0) {
                                weightProduced = (compCm / 100) * qtd * weightPerM;
                            }
                        }
                        totalWeightToDeduce += (weightProduced || 0);
                    });

                    const activeLotsParams: any[] = [];
                    if (!isCurrentMachineBancada && totalWeightToDeduce > 0) {
                        if (portaRolo1 && activeFeed1) {
                            const l1 = stock.find(i => i.internalLot === portaRolo1 || i.supplierLot === portaRolo1 || i.id === portaRolo1);
                            const w1 = portaRolo1Wait ? stock.find(i => i.internalLot === portaRolo1Wait || i.supplierLot === portaRolo1Wait || i.id === portaRolo1Wait) : undefined;
                            if (l1) activeLotsParams.push({ primary: l1, wait: w1, pIndex: 1 });
                        }
                        if (portaRolo2 && activeFeed2) {
                            const l2 = stock.find(i => i.internalLot === portaRolo2 || i.supplierLot === portaRolo2 || i.id === portaRolo2);
                            const w2 = portaRolo2Wait ? stock.find(i => i.internalLot === portaRolo2Wait || i.supplierLot === portaRolo2Wait || i.id === portaRolo2Wait) : undefined;
                            if (l2) activeLotsParams.push({ primary: l2, wait: w2, pIndex: 2 });
                        }

                        if (activeLotsParams.length === 0) {
                            alert("Erro: Nenhum lote ativo na máquina para abater o peso. Verifique o abastecimento.");
                            return;
                        }

                        const weightPerLot = totalWeightToDeduce / activeLotsParams.length;
                        
                        for (const param of activeLotsParams) {
                            const lotObj = param.primary;
                            const waitObj = param.wait;
                            const primaryQty = lotObj.remainingQuantity ?? lotObj.weight ?? lotObj.labelWeight ?? 0;
                            const waitQty = waitObj ? (waitObj.remainingQuantity ?? waitObj.weight ?? waitObj.labelWeight ?? 0) : 0;
                            
                            const totalAvailable = primaryQty + waitQty;
                            if (totalAvailable < weightPerLot) {
                                alert(`ERRO: O lote ${lotObj.internalLot || lotObj.id} (incluindo espera) possui apenas ${totalAvailable.toFixed(2)} kg disponíveis, mas são necessários ${weightPerLot.toFixed(2)} kg para finalizar as ${pendingSubItems.length} O.S. restantes.\n\nPor favor, abasteça a máquina antes de prosseguir.`);
                                return;
                            }
                        }
                    }

                    const confirm = window.confirm(`Deseja realmente finalizar TODAS as ${pendingSubItems.length} O.S. restantes de uma vez?\n\nPeso total a abater: ${totalWeightToDeduce.toFixed(2)} kg.`);
                    if (!confirm) return;

                    setLoadingAction(`finish-all-${po.id}`);

                    try {
                        const endTime = new Date().toISOString();
                        const usedLotsArr = [];
                        if (portaRolo1 && activeFeed1) usedLotsArr.push(portaRolo1);
                        if (portaRolo2 && activeFeed2) usedLotsArr.push(portaRolo2);
                        const lotUsedStr = usedLotsArr.join(', ') || '-';

                        const updatedProgress = { ...currentProgressObj };
                        let pieceWeightForBancada = 0;

                        pendingSubItems.forEach(item => {
                            const strSubKey = String(item.os).trim();
                            let cutKey = Object.keys(updatedProgress).find(k => {
                                let clean = k.replace('sub_', '').split('_')[0];
                                const valSubOsKey = updatedProgress[k]?.subOsKey || updatedProgress[k]?.sub_os_key;
                                if (valSubOsKey) clean = String(valSubOsKey);
                                return clean === strSubKey && updatedProgress[k]?.status === 'producing';
                            });

                            if (!cutKey) {
                                if (updatedProgress[strSubKey] && updatedProgress[strSubKey].status !== 'completed') {
                                    cutKey = strSubKey;
                                } else {
                                    cutKey = `${strSubKey}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
                                }
                            }

                            const existingStart = updatedProgress[cutKey]?.start_time || updatedProgress[cutKey]?.startTime || endTime;
                            updatedProgress[cutKey] = { status: 'completed', start_time: existingStart, end_time: endTime, sub_os_key: strSubKey, lot_used: lotUsedStr };
                            
                            let itemWeight = parseFloat(item.peso || item.pesoTotal || '0');
                            if (!itemWeight || isNaN(itemWeight) || itemWeight === 0) {
                                const qtd = parseFloat(item.qunti || item.quantidade || item.qtd || '0');
                                const compCm = parseFloat(item.comprimento || item.comp || '0');
                                if (weightPerM > 0) {
                                    itemWeight = (compCm / 100) * qtd * weightPerM;
                                }
                            }
                            pieceWeightForBancada += (itemWeight || 0);
                        });

                        setLocalOrders(prev => prev.map(p => {
                            if (p.id === po.id) {
                                return { ...p, subItemsProgress: updatedProgress, sub_items_progress: updatedProgress };
                            }
                            return p;
                        }));

                        const { error: poError } = await supabase.from('production_orders').update({ sub_items_progress: updatedProgress }).eq('id', po.id);
                        if (poError) throw poError;

                        if (!isCurrentMachineBancada && totalWeightToDeduce > 0 && activeLotsParams.length > 0) {
                            const weightPerLot = totalWeightToDeduce / activeLotsParams.length;
                            const commOrderId = (po as any).related_commercial_order_id || (po as any).relatedCommercialOrderId;
                            const commOrder = commercialOrders.find(co => co.id === commOrderId);
                            const clientName = (commOrder as any)?.client_name || commOrder?.clientName || 'Não informado';
                            const orderNumberStr = (commOrder as any)?.order_number || commOrder?.orderNumber || (po as any).order_number || po.orderNumber || 'Desconhecido';

                            for (const param of activeLotsParams) {
                                const lotObj = param.primary;
                                const waitObj = param.wait;
                                const currentQty = lotObj.remainingQuantity ?? lotObj.weight ?? lotObj.labelWeight ?? 0;

                                if (currentQty >= weightPerLot) {
                                    const newRemaining = currentQty - weightPerLot;
                                    const consumeHistoryItem = {
                                        date: endTime,
                                        action: `Máquina: ${selectedMachine} | Operador: ${currentUser.username || currentUser.name || 'Sistema'} | Cliente: ${clientName} | Pedido: ${orderNumberStr} (Finalização em Lote) | Baixa: ${weightPerLot.toFixed(2)} kg`,
                                        user: currentUser.username || currentUser.name || 'Sistema'
                                    };
                                    await supabase.from('stock_items').update({
                                        remaining_quantity: newRemaining,
                                        history: [...(lotObj.history || []), consumeHistoryItem]
                                    }).eq('id', lotObj.id);
                                } else {
                                    const deficit = weightPerLot - currentQty;
                                    const consumePrimaryHistoryItem = {
                                        date: endTime,
                                        action: `Máquina: ${selectedMachine} | Operador: ${currentUser.username || currentUser.name || 'Sistema'} | Cliente: ${clientName} | Pedido: ${orderNumberStr} (Finalização em Lote) | Baixa Final: ${currentQty.toFixed(2)} kg. (Restante de ${deficit.toFixed(2)} kg abatido do Lote em Espera)`,
                                        user: currentUser.username || currentUser.name || 'Sistema'
                                    };
                                    await supabase.from('stock_items').update({
                                        remaining_quantity: 0,
                                        status: 'Consumido',
                                        history: [...(lotObj.history || []), consumePrimaryHistoryItem]
                                    }).eq('id', lotObj.id);

                                    if (waitObj) {
                                        const waitQty = waitObj.remainingQuantity ?? waitObj.weight ?? waitObj.labelWeight ?? 0;
                                        const newWaitRemaining = Math.max(0, waitQty - deficit);
                                        const consumeWaitHistoryItem = {
                                            date: endTime,
                                            action: `Máquina: ${selectedMachine} | Operador: ${currentUser.username || currentUser.name || 'Sistema'} | Cliente: ${clientName} | Pedido: ${orderNumberStr} (Finalização em Lote) | Baixa de Deficit: ${deficit.toFixed(2)} kg`,
                                            user: currentUser.username || currentUser.name || 'Sistema'
                                        };
                                        const waitStatus = newWaitRemaining <= 0 ? 'Consumido' : waitObj.status;
                                        
                                        await supabase.from('stock_items').update({
                                            remaining_quantity: newWaitRemaining,
                                            status: waitStatus,
                                            history: [...(waitObj.history || []), consumeWaitHistoryItem]
                                        }).eq('id', waitObj.id);
                                        
                                        if (param.pIndex === 1 && portaRolo1Wait && newWaitRemaining > 0) {
                                            await supabase.from('machine_current_states').update({ porta_rolo_1_lot: portaRolo1Wait, porta_rolo_1_wait_lot: null }).eq('machine_name', selectedMachine);
                                        } else if (param.pIndex === 2 && portaRolo2Wait && newWaitRemaining > 0) {
                                            await supabase.from('machine_current_states').update({ porta_rolo_2_lot: portaRolo2Wait, porta_rolo_2_wait_lot: null }).eq('machine_name', selectedMachine);
                                        }
                                    }
                                }
                            }
                        }

                        if (bancadaTargetName && pieceWeightForBancada > 0 && !isCurrentMachineBancada) {
                            try {
                                await supabase.from('bancada_items').insert({
                                    production_order_id: po.id,
                                    sub_os_key: `LOTE-${Date.now()}`,
                                    piece_weight: pieceWeightForBancada,
                                    status: 'pending',
                                    bancada_machine_name: bancadaTargetName,
                                    operator_id: currentUser?.id,
                                    operator_name: currentUser?.username || currentUser?.name || 'Sistema',
                                    created_at: endTime
                                });
                            } catch (e) {
                                console.error('Error inserting into bancada:', e);
                            }
                        } else if (isCurrentMachineBancada) {
                            try {
                                await supabase.from('bancada_items').update({
                                    status: 'completed',
                                    completed_at: endTime
                                }).eq('production_order_id', po.id).eq('status', 'pending');
                            } catch (e) {}
                        }

                        if (machineState === 'ATIVA') {
                            try {
                                const { data: openCuts } = await supabase.from('machine_stops')
                                    .select('id, start_time')
                                    .eq('machine', selectedMachine)
                                    .eq('reason', 'Produzindo Lote')
                                    .is('end_time', null);
                                    
                                if (openCuts && openCuts.length > 0) {
                                    for (const cut of openCuts) {
                                        await supabase.from('machine_stops').update({ end_time: endTime }).eq('id', cut.id);
                                    }
                                }
                            } catch(e) {}
                        }

                        setActiveModalPoId(null);
                        alert(`Foram finalizadas ${pendingSubItems.length} O.S. com sucesso!`);
                    } catch (e: any) {
                        console.error('Error in handleFinishAllSubOs', e);
                        alert(`Erro ao finalizar todas as O.S.: ${e.message}`);
                    } finally {
                        setLoadingAction(null);
                    }
                };

                const producingCutEntry = activeSubOs ? Object.entries(currentProgressObj).find(([k, v]: any) => {
                    const cleanKey = k.replace('sub_', '').split('_')[0];
                    const valSubOsKey = v?.subOsKey || v?.sub_os_key;
                    if (valSubOsKey) {
                         return String(valSubOsKey) === targetSubOsStr && v?.status === 'producing';
                    }
                    return cleanKey === targetSubOsStr && v?.status === 'producing';
                }) : null;

                const completedCutsCount = activeSubOs ? Object.entries(currentProgressObj).filter(([k, v]: any) => {
                    const cleanKey = k.replace('sub_', '').split('_')[0];
                    const valSubOsKey = v?.subOsKey || v?.sub_os_key;
                    if (valSubOsKey) {
                         return String(valSubOsKey) === targetSubOsStr && v?.status === 'completed';
                    }
                    return cleanKey === targetSubOsStr && v?.status === 'completed';
                }).length : 0;

                const isCompleted = activeSubOs ? Object.values(currentProgressObj).some((v: any) => {
                    if (!v || typeof v !== 'object') return false;
                    const valSubOsKey = v?.subOsKey || v?.sub_os_key;
                    if (valSubOsKey) {
                        return String(valSubOsKey) === targetSubOsStr && v?.status === 'completed';
                    }
                    return false;
                }) : false;

                let currentItemStatus = null;
                let currentItemStart = null;

                if (producingCutEntry) {
                    currentItemStatus = 'producing';
                    currentItemStart = (producingCutEntry[1] as any)?.start_time || (producingCutEntry[1] as any)?.startTime;
                } else if (isCompleted || completedCutsCount > 0) {
                    currentItemStatus = 'completed';
                }

                return (
                    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                        <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden flex flex-col">
                            <div className="bg-[#0F3F5C] p-4 flex justify-between items-center text-white">
                                <div>
                                    <h2 className="font-black text-xl tracking-tight">Execução Detalhada</h2>
                                    <p className="text-xs text-indigo-200">Lote Bitola {(po as any).target_bitola || po.targetBitola}mm</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button 
                                        disabled={loadingAction?.startsWith('finish-all')}
                                        onClick={handleFinishAllSubOs} 
                                        className="px-3 py-1.5 bg-red-500 hover:bg-red-600 active:scale-95 transition-all text-white rounded-xl text-[10px] sm:text-xs font-black shadow-sm flex items-center gap-1 uppercase">
                                        {loadingAction?.startsWith('finish-all') ? 'FINALIZANDO...' : 'FINALIZAR TODAS AS O.S.'}
                                    </button>
                                    <button onClick={() => setActiveModalPoId(null)} className="p-2 bg-white/10 rounded-full hover:bg-white/20">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                            </div>
                            
                            <div className="p-6 flex flex-col gap-6">
                                {subItems.length > 0 && (
                                    <div className="flex flex-col gap-2">
                                        <label className="text-xs font-black text-slate-500 uppercase tracking-wider block">O.S. deste Lote ({subItems.length}):</label>
                                        <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
                                            {subItems.map(item => {
                                                const itemOsStr = String(item.os).trim();
                                                const isComp = Object.values(currentProgressObj).some((v: any) => {
                                                    const kStr = v?.subOsKey || v?.sub_os_key;
                                                    return String(kStr) === itemOsStr && v?.status === 'completed';
                                                });
                                                const isProd = Object.values(currentProgressObj).some((v: any) => {
                                                    const kStr = v?.subOsKey || v?.sub_os_key;
                                                    return String(kStr) === itemOsStr && v?.status === 'producing';
                                                });
                                                const isSelected = activeSubOs && String(activeSubOs.os).trim() === itemOsStr;

                                                let badgeStyle = 'bg-slate-100 text-slate-700 border-slate-200';
                                                if (isComp) badgeStyle = 'bg-emerald-100 text-emerald-800 border-emerald-300 font-black';
                                                else if (isProd) badgeStyle = 'bg-orange-100 text-orange-800 border-orange-300 font-black animate-pulse';

                                                return (
                                                    <button
                                                        key={itemOsStr}
                                                        onClick={() => {
                                                            setActiveSubOs(item);
                                                            setSubOsSearch(itemOsStr);
                                                        }}
                                                        className={`px-3 py-2 rounded-xl text-xs border transition-all flex items-center gap-1.5 whitespace-nowrap shadow-sm ${badgeStyle} ${isSelected ? 'ring-2 ring-indigo-500 scale-105' : 'opacity-80 hover:opacity-100'}`}
                                                    >
                                                        {isComp ? '✅' : isProd ? '⚡' : '⏱️'} OS {itemOsStr}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

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
                                        
                                        <div className="grid grid-cols-3 gap-3">
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase">Quantidade</p>
                                                <p className="font-black text-slate-700 text-xl whitespace-nowrap">{activeSubOs.qunti || activeSubOs.quantidade || activeSubOs.qtd || '-'} un.</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase">Comprimento</p>
                                                <p className="font-black text-slate-700 text-xl whitespace-nowrap">{activeSubOs.comprimento || activeSubOs.comp || '-'} cm</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase">Peso</p>
                                                <p className="font-black text-slate-700 text-xl whitespace-nowrap">{activeSubOs.peso ? parseFloat(activeSubOs.peso.toString().replace(',','.')).toFixed(2) : '-'} kg</p>
                                            </div>
                                        </div>

                                        <div className="mt-2 pt-4 border-t border-slate-200">
                                            {currentItemStatus === 'completed' ? (
                                                <div className="bg-emerald-50 border-2 border-emerald-300 text-emerald-800 font-black p-5 rounded-2xl text-center flex flex-col items-center gap-2 shadow-sm">
                                                    <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md">
                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7"><path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" /></svg>
                                                    </div>
                                                    <span className="text-lg uppercase font-black tracking-tight text-emerald-900">O.S. JÁ FINALIZADA!</span>
                                                    <p className="text-xs font-bold text-emerald-700">Esta O.S. foi executada e concluída. Não é possível iniciar ou alterar novamente.</p>
                                                </div>
                                            ) : currentItemStatus === 'producing' ? (
                                                <div className="flex flex-col gap-3">
                                                    <div className="grid grid-cols-3 gap-2 text-xs text-slate-500 font-bold px-1 text-center">
                                                        <span className="text-left">QUANTIDADE</span>
                                                        <span>COMPRIMENTO</span>
                                                        <span className="text-right">PESO</span>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-2 items-center bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm text-center">
                                                        <span className="font-black text-xl text-slate-800 text-left whitespace-nowrap">{activeSubOs.qunti || activeSubOs.quantidade || activeSubOs.qtd || '-'} un.</span>
                                                        <span className="font-black text-xl text-slate-800 whitespace-nowrap">{activeSubOs.comprimento || activeSubOs.comp || '-'} cm</span>
                                                        <span className="font-black text-xl text-slate-800 text-right whitespace-nowrap">{activeSubOs.peso ? parseFloat(activeSubOs.peso.toString().replace(',','.')).toFixed(2) : '-'} kg</span>
                                                    </div>
                                                    <div className="bg-orange-50 border-2 border-orange-300 rounded-xl p-4 flex flex-col items-center justify-center gap-1 shadow-[0_0_15px_rgba(251,146,60,0.6)] animate-pulse transition-all">
                                                        <span className="text-[11px] font-black text-orange-600 uppercase tracking-widest flex items-center gap-2">
                                                            <span className="w-2 h-2 rounded-full bg-orange-500 animate-bounce"></span>
                                                            Em Andamento
                                                            <span className="w-2 h-2 rounded-full bg-orange-500 animate-bounce" style={{animationDelay: '0.2s'}}></span>
                                                        </span>
                                                        <div className="scale-110 mt-1">
                                                            <ActiveTimer startTime={currentItemStart!} />
                                                        </div>
                                                    </div>
                                                    <button 
                                                        disabled={loadingAction === `finish-${po.id}-${activeSubOs.os}`}
                                                        onClick={() => handleFinishSubOs(po.id, activeSubOs.os)} 
                                                        className="w-full bg-red-500 hover:bg-red-600 text-white font-black py-4 rounded-xl text-lg uppercase shadow-md active:scale-95 transition-all disabled:opacity-50">
                                                        {loadingAction === `finish-${po.id}-${activeSubOs.os}` ? 'FINALIZANDO...' : (isCurrentMachineBancada ? 'FINALIZAR DOBRA' : 'FINALIZAR CORTE')}
                                                    </button>
                                                </div>
                                            ) : (
                                                <button 
                                                    disabled={loadingAction === `start-${po.id}-${activeSubOs.os}`}
                                                    onClick={() => handleStartSubOs(po.id, activeSubOs.os)} 
                                                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 rounded-xl text-lg uppercase shadow-sm active:scale-95 transition-all disabled:opacity-50">
                                                    {loadingAction === `start-${po.id}-${activeSubOs.os}` ? 'INICIANDO...' : (isCurrentMachineBancada ? 'INICIAR DOBRA' : 'INICIAR CORTE')}
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

                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <svg className="h-5 w-5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="Buscar por número do lote..."
                                                value={lotSearchQuery}
                                                onChange={(e) => setLotSearchQuery(e.target.value)}
                                                className="w-full pl-10 pr-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-bold text-slate-700 bg-white"
                                            />
                                        </div>
                                        
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
                                                {availableLots.filter(lot => {
                                                    if (!lotSearchQuery) return true;
                                                    const searchLower = lotSearchQuery.toLowerCase();
                                                    const lotId = String(lot.internalLot || lot.supplierLot || lot.id || '').toLowerCase();
                                                    return lotId.includes(searchLower);
                                                }).map(lot => (
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
                                                {availableLots.filter(lot => {
                                                    if (!lotSearchQuery) return true;
                                                    const searchLower = lotSearchQuery.toLowerCase();
                                                    const lotId = String(lot.internalLot || lot.supplierLot || lot.id || '').toLowerCase();
                                                    return lotId.includes(searchLower);
                                                }).length === 0 && (
                                                    <div className="bg-slate-50 border-2 border-dashed border-slate-200 p-8 text-center rounded-2xl">
                                                        <p className="text-slate-500 font-bold uppercase tracking-wider">Nenhum lote encontrado para "{lotSearchQuery}"</p>
                                                    </div>
                                                )}
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

            {/* Modal Confirmação Bancada */}
            {bancadaConfirmState?.isOpen && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200">
                        <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4 text-3xl">
                            🤔
                        </div>
                        <h3 className="text-xl font-black text-slate-800 mb-2">Atenção</h3>
                        <p className="text-sm font-medium text-slate-500 mb-6">
                            A peça <strong className="text-indigo-600">{bancadaConfirmState.subOsKey}</strong> finalizada agora precisa ir para a Bancada?
                        </p>
                        <div className="flex gap-3 w-full">
                            <button
                                onClick={() => setBancadaConfirmState(null)}
                                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 px-4 rounded-xl transition-colors"
                            >
                                Não
                            </button>
                            <button
                                onClick={async () => {
                                    const { subOsKey, po, subOsItem, weight } = bancadaConfirmState;
                                    setBancadaConfirmState(null);
                                    try {
                                        const { data: existingOrders, error: fetchErr } = await supabase
                                            .from('production_orders')
                                            .select('*')
                                            .eq('machine', bancadaTargetName)
                                            .eq('related_commercial_order_id', po.related_commercial_order_id || po.relatedCommercialOrderId)
                                            .eq('target_bitola', po.target_bitola || po.targetBitola)
                                            .in('status', ['in_progress', 'producing', 'pending']);
                                            
                                        if (fetchErr) throw fetchErr;
                                        
                                        const existingOrder = existingOrders && existingOrders.length > 0 ? existingOrders[0] : null;

                                        const qtd = parseFloat(subOsItem?.qunti || subOsItem?.quantidade || subOsItem?.qtd || '0');
                                        const compCm = parseFloat(subOsItem?.comprimento || subOsItem?.comp || '0');
                                        const metersToAdd = (compCm / 100) * qtd;

                                        if (existingOrder) {
                                            const newWeight = (existingOrder.total_weight || 0) + (weight || 0);
                                            const newMeters = (existingOrder.total_meters || 0) + metersToAdd;
                                            
                                            const updatedProgress = { ...(existingOrder.sub_items_progress || {}) };
                                            updatedProgress[subOsKey] = { status: 'pending', from_machine: true };
                                            
                                            const orderNumbers = existingOrder.order_number.split(',').map((n: string) => n.trim());
                                            let newOrderNumber = existingOrder.order_number;
                                            if (!orderNumbers.includes(subOsKey) && !existingOrder.order_number.includes('BANCADA')) {
                                                newOrderNumber = `${existingOrder.order_number}, ${subOsKey}`;
                                            }

                                            const newQuantity = (existingOrder.quantity_os || 1) + 1;

                                            await supabase
                                                .from('production_orders')
                                                .update({
                                                    total_weight: newWeight,
                                                    total_meters: newMeters,
                                                    sub_items_progress: updatedProgress,
                                                    order_number: newOrderNumber,
                                                    quantity_os: newQuantity
                                                })
                                                .eq('id', existingOrder.id);
                                                
                                            // alert(`Peça ${subOsKey} acumulada na O.S. da Bancada!`);
                                        } else {
                                            const newOs = {
                                                order_number: `${po.order_number || po.orderNumber} - BANCADA`,
                                                machine: bancadaTargetName,
                                                target_bitola: po.target_bitola || po.targetBitola,
                                                selected_lot_ids: po.selected_lot_ids || po.selectedLotIds || [],
                                                total_weight: weight || 0,
                                                total_meters: metersToAdd || 0,
                                                is_ghost_order: po.is_ghost_order || po.isGhostOrder,
                                                status: 'in_progress',
                                                creation_date: new Date().toISOString(),
                                                related_commercial_order_id: po.related_commercial_order_id || po.relatedCommercialOrderId,
                                                quantity_os: 1,
                                                sub_items_progress: {
                                                    [subOsKey]: { status: 'pending', from_machine: true }
                                                }
                                            };
                                            await supabase.from('production_orders').insert(newOs);
                                            // alert(`Peça ${subOsKey} enviada para a fila da Bancada com sucesso!`);
                                        }
                                    } catch (err) {
                                        console.error('Erro ao processar bancada:', err);
                                        alert('Erro ao enviar peça para bancada.');
                                    }
                                }}
                                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-md"
                            >
                                Sim
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MobileOperatorPanel;
