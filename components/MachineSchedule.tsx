import React, { useState, useMemo, useEffect } from 'react';
import type { Partner, MachineOrder, ProductionOrderData, MachineConfig, User } from '../types';
import { DEFAULT_ESTRIBO_MODELS as estriboModels, DEFAULT_FERRO_MODELS as ferroModels } from '../types';
import { fetchAllQuotesFromDB, fetchBitolasConfigFromDB, saveQuoteToDB } from '../services/pointingSupabaseAdapter';
import { fetchTable } from '../services/supabaseService';
import { getFerroTotalLengthCm, renderEstriboSVG, renderBarDiagramSVG, renderTravaSVG } from './ScheduleDrawingHelpers';

interface GaugeGroup {
    bitola: string;
    totalWeight: number;
    totalMeters: number;
    osCount: number;
    scheduledCount: number;
    ferros: any[];
}

interface GroupedOrder {
    id: string;
    os: string;
    cliente: string;
    status: string;
    data: string;
    gauges: GaugeGroup[];
    quoteDetails: any;
}

interface MachineScheduleProps {
    partners: Partner[];
    machineOrders: MachineOrder[];
    productionOrders: ProductionOrderData[];
    onAddMachineOrder: (data: Partial<MachineOrder>) => Promise<MachineOrder | null>;
    onUpdateMachineOrder: (id: string, updates: Partial<MachineOrder>) => Promise<void>;
    onDeleteMachineOrder: (id: string) => Promise<void>;
    showNotification: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
    currentUser: User | null;
}

const getNext7Days = () => {
    const days = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        days.push(d.toISOString().split('T')[0]);
    }
    return days;
};

const formatDateBr = (dateStr: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
};

const getDayOfWeek = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-');
    const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    return days[date.getDay()];
};

const cleanGaugeString = (str: string) => {
    const s = String(str || '');
    const m = s.match(/(\d+\.?\d*\s*mm)/i);
    return m ? m[1].toUpperCase() : s.replace(/VERGALHAO CA\d+\(ARMADO-AMARRADO\)\s*/i, '').trim().toUpperCase();
};

const getGaugeLabel = (ferro: any, product: any) => {
    let raw = '';
    if (ferro?.bitola) raw = String(ferro.bitola);
    else if (product?.description && String(product.description).toLowerCase().includes('ca')) {
        raw = String(product.description);
    }
    if (raw) return cleanGaugeString(raw);
    return 'Desconhecida';
};

const MachineSchedule: React.FC<MachineScheduleProps> = ({
    partners,
    machineOrders,
    productionOrders,
    onAddMachineOrder,
    onUpdateMachineOrder,
    onDeleteMachineOrder,
    showNotification,
    currentUser
}) => {
    const activeBrandingPartner = partners?.find(p => p.isActiveBranding) || null;
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [selectedMachineName, setSelectedMachineName] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [bottomTab, setBottomTab] = useState<'pendentes' | 'producao'>('pendentes');
    const [selectedQuoteForDetails, setSelectedQuoteForDetails] = useState<GroupedOrder | null>(null);
    const [showCutPlan, setShowCutPlan] = useState(false);
    const [editingMachineOrder, setEditingMachineOrder] = useState<MachineOrder | null>(null);
    const [printingMachineOrder, setPrintingMachineOrder] = useState<MachineOrder | null>(null);

    const [isLabelConfigOpen, setIsLabelConfigOpen] = useState(false);
    const [labelScale, setLabelScale] = useState(parseFloat(localStorage.getItem('msm_label_scale') || '2.25'));
    const [labelHeight, setLabelHeight] = useState(parseFloat(localStorage.getItem('msm_label_height') || '320'));
    const [labelWidth, setLabelWidth] = useState(parseFloat(localStorage.getItem('msm_label_width') || '448'));

    useEffect(() => {
        localStorage.setItem('msm_label_scale', labelScale.toString());
        localStorage.setItem('msm_label_height', labelHeight.toString());
        localStorage.setItem('msm_label_width', labelWidth.toString());
    }, [labelScale, labelHeight, labelWidth]);

    const [pendingVisualSchedule, setPendingVisualSchedule] = useState<{
        quoteId: string,
        bitola: string,
        weight: number,
        metros: number,
        qty: number,
        osQty: number,
        clientName: string
    } | null>(null);

    const [quotes, setQuotes] = useState<any[]>([]);
    const [bitolasConfig, setBitolasConfig] = useState<any[]>([]);
    const [dbFerroModels, setDbFerroModels] = useState<any[]>(ferroModels);
    const [dbEstriboModels, setDbEstriboModels] = useState<any[]>(estriboModels);

    useEffect(() => {
        const loadQuotesAndBitolas = async () => {
            try {
                const [dbQuotes] = await Promise.all([
                    fetchAllQuotesFromDB()
                ]);
                const cfgMap = await fetchBitolasConfigFromDB().catch(() => []);
                setQuotes(dbQuotes);
                setBitolasConfig(cfgMap);

                try {
                    const [loadedFerros, loadedEstribos] = await Promise.all([
                        fetchTable<any>('model_ferros'),
                        fetchTable<any>('model_estribos')
                    ]);
                    if (loadedFerros && loadedFerros.length > 0) setDbFerroModels(loadedFerros);
                    if (loadedEstribos && loadedEstribos.length > 0) setDbEstriboModels(loadedEstribos);
                } catch (e) {
                    console.error("Failed to load custom models", e);
                }
            } catch (err) {
                console.error('Failed to load initial data for schedule:', err);
            }
        };
        loadQuotesAndBitolas();
    }, []);

    useEffect(() => {
        const saved = sessionStorage.getItem('pending_visual_schedule');
        if (saved) {
            try {
                setPendingVisualSchedule(JSON.parse(saved));
                sessionStorage.removeItem('pending_visual_schedule');
            } catch (e) {}
        }

        const handlePendingVisual = (e: Event) => {
            const customEvent = e as CustomEvent;
            setPendingVisualSchedule(customEvent.detail);
        };
        window.addEventListener('pending_visual_schedule', handlePendingVisual);
        return () => window.removeEventListener('pending_visual_schedule', handlePendingVisual);
    }, []);

    const isMachineCompatibleWithBitola = (machineGaugeRange: string, bitolaStr: string) => {
        if (!machineGaugeRange) return true;
        
        let bValue = 0;
        const safeBitola = String(bitolaStr || '');
        const match = safeBitola.match(/(\d+(?:[.,]\d+)?) ?mm/i);
        if (match) {
            bValue = parseFloat(match[1].replace(',', '.'));
        } else {
            const noCA = safeBitola.replace(/CA\d+/i, '');
            bValue = parseFloat(noCA.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
        }

        const cleanMachineRange = String(machineGaugeRange).toLowerCase().replace(/mm/g, '').replace(/\s+/g, '');
        const matches = [...cleanMachineRange.matchAll(/\d+(?:[.,]\d+)?/g)];
        const numbers = matches.map(m => parseFloat(m[0].replace(',', '.')));
        
        if (numbers.length === 0) return true;

        // Se tem exatamente 2 números e usou hífen, tratamos como um "Range" (Intervalo) Ex: 4.2-8.0
        if (numbers.length === 2 && cleanMachineRange.includes('-')) {
            const min = Math.min(numbers[0], numbers[1]);
            const max = Math.max(numbers[0], numbers[1]);
            if (bValue >= min && bValue <= max) return true;
        }

        // Caso contrário (ou se a verificação de range falhar), tratamos como uma lista de valores exatos permitidos
        return numbers.some(p => Math.abs(p - bValue) < 0.01);
    };

    const dates = useMemo(() => getNext7Days(), []);

    const activePartner = useMemo(() => {
        return partners.find(p => p.isActiveBranding) || partners[0] || null;
    }, [partners]);

    const activeMachines = useMemo(() => {
        if (!activePartner?.machines) return [];
        return activePartner.machines;
    }, [activePartner]);

    useEffect(() => {
        if (activeMachines.length > 0 && !selectedMachineName) {
            setSelectedMachineName(activeMachines[0].name);
        }
    }, [activeMachines, selectedMachineName]);

    const processedOrders = useMemo(() => {
        const activeQuotes = quotes.filter(q => q.status === 'Enviado p/ Produção' || q.status === 'Em Produção');
        const scheduledMap: Record<string, Record<string, number>> = {};
        
        machineOrders.forEach(mo => {
            if (!scheduledMap[mo.orderCode]) {
                scheduledMap[mo.orderCode] = {};
            }
            // Normalize gauge name for matching
            const g = cleanGaugeString(mo.gauge || '');
            scheduledMap[mo.orderCode][g] = (scheduledMap[mo.orderCode][g] || 0) + (mo.osQuantity || 1);
        });

        return activeQuotes.map(q => {
            const gaugesMap: Record<string, GaugeGroup> = {};
            
            let globalFIdx = 0;
            q.products?.forEach((product: any, pIdx: number) => {
                const productQty = product.qty || 1;
                const ferros = product.ferros || [];
                
                if (ferros.length === 0) {
                    const gauge = getGaugeLabel(null, product);
                    if (!gaugesMap[gauge]) {
                        gaugesMap[gauge] = { bitola: gauge, totalWeight: 0, totalMeters: 0, osCount: 0, scheduledCount: 0, ferros: [] };
                    }
                    gaugesMap[gauge].totalWeight += Number(product.weight || 0);
                    gaugesMap[gauge].osCount += Number(productQty);
                } else {
                    ferros.forEach((f: any, fIdx: number) => {
                        const osNumberString = `OS: ${String(q.products.slice(0, pIdx).reduce((acc: number, prevP: any) => acc + (prevP.ferros?.length || 0), 0) + fIdx + 1).padStart(2, '0')}`;
                        globalFIdx++;
                        
                        const gauge = getGaugeLabel(f, product);
                        if (!gaugesMap[gauge]) {
                            gaugesMap[gauge] = { bitola: gauge, totalWeight: 0, totalMeters: 0, osCount: 0, scheduledCount: 0, ferros: [] };
                        }
                        
                        const lengthCm = getFerroTotalLengthCm(f, product?.pDesc || '');
                        const fQtd = Number(f.qtde || f.quantidade || 1);
                        const totalMeters = (lengthCm / 100) * fQtd * productQty;
                        
                        // Try to calculate weight if linear weight is known
                        let unitWeight = 0;
                        if (f.bitolaPesoLinear) {
                            unitWeight = Number(f.bitolaPesoLinear);
                        } else {
                            const config = bitolasConfig.find(b => cleanGaugeString(b.label) === gauge);
                            if (config) unitWeight = Number(config.kgm || 0);
                        }
                        
                        const weight = totalMeters * unitWeight;
                        
                        gaugesMap[gauge].totalMeters += totalMeters;
                        gaugesMap[gauge].totalWeight += weight;
                        gaugesMap[gauge].osCount += (fQtd * productQty);
                        gaugesMap[gauge].ferros.push({ ...f, productInfo: product, osNumberString });
                    });
                }
            });

            // Re-map scheduled counts
            Object.values(gaugesMap).forEach(g => {
                const normG = cleanGaugeString(g.bitola || '');
                g.scheduledCount = scheduledMap[q.id]?.[normG] || 0;
                // Avoid overflow in case of manual edits
                if (g.scheduledCount > g.osCount) g.scheduledCount = g.osCount;
            });

            // Sort gauges by size descending
            const sortedGauges = Object.values(gaugesMap).sort((a, b) => {
                const vA = parseFloat(String(a.bitola || '').replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
                const vB = parseFloat(String(b.bitola || '').replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
                return vB - vA;
            });

            return {
                id: q.id,
                os: q.id,
                cliente: q.clientName,
                status: q.status,
                data: q.createdAt || new Date().toISOString(),
                gauges: sortedGauges,
                quoteDetails: q
            } as GroupedOrder;
        }).filter(q => {
            if (searchTerm) {
                const search = searchTerm.toLowerCase();
                return q.id.toLowerCase().includes(search) || 
                       q.cliente.toLowerCase().includes(search);
            }
            return true;
        });
    }, [quotes, machineOrders, searchTerm, bitolasConfig]);

    const { pendentes, emProducao } = useMemo(() => {
        const pendentesList: GroupedOrder[] = [];
        const producaoList: GroupedOrder[] = [];

        processedOrders.forEach(order => {
            const isFullyScheduled = order.gauges.every(g => g.scheduledCount >= g.osCount);
            if (isFullyScheduled) {
                producaoList.push(order);
            } else {
                pendentesList.push(order);
            }
        });

        return { pendentes: pendentesList, emProducao: producaoList };
    }, [processedOrders]);

    // Machine Orders for the selected date and machine
    const currentMachineOrders = useMemo(() => {
        if (!selectedMachineName || !selectedDate) return [];
        return machineOrders.filter(mo => 
            mo.machineId === selectedMachineName && 
            mo.startDate === selectedDate
        ).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }, [machineOrders, selectedMachineName, selectedDate]);

    const handleVisualScheduleClick = async (dateStr: string, machineName: string) => {
        if (!pendingVisualSchedule) return;
        
        try {
            const newOrder: Partial<MachineOrder> = {
                clientName: pendingVisualSchedule.clientName || 'Desconhecido',
                machineId: machineName,
                gauge: pendingVisualSchedule.bitola || '',
                quantity: pendingVisualSchedule.qty || 0,
                quantityUnit: 'peças',
                startDate: dateStr,
                endDate: dateStr,
                status: 'scheduled',
                orderCode: pendingVisualSchedule.quoteId,
                osQuantity: pendingVisualSchedule.osQty,
                weight: pendingVisualSchedule.weight,
                notes: JSON.stringify({ totalMetros: pendingVisualSchedule.metros }),
                createdAt: new Date().toISOString()
            };
            const addedOrder = await onAddMachineOrder(newOrder);
            
            showNotification(`Bitola ${pendingVisualSchedule.bitola} agendada para ${formatDateBr(dateStr)} em ${machineName}`, 'success');
            
            // Verificação de transição de status para Em Produção
            const quote = processedOrders.find(q => q.id === pendingVisualSchedule.quoteId);
            if (quote) {
                // Simula como ficarão as contagens após este agendamento
                const isFullyScheduledNow = quote.gauges.every(g => {
                    let sCount = g.scheduledCount;
                    if (g.bitola === pendingVisualSchedule.bitola) {
                        sCount += pendingVisualSchedule.osQty;
                    }
                    return sCount >= g.osCount;
                });

                if (isFullyScheduledNow && quote.status !== 'Em Produção') {
                    const originalQuote = quote.quoteDetails;
                    const updatedQuote = { ...originalQuote, status: 'Em Produção' };
                    try {
                        await saveQuoteToDB(updatedQuote);
                        setQuotes(prev => prev.map(q => q.id === updatedQuote.id ? updatedQuote : q));
                        showNotification(`OP ${quote.id} totalmente agendada! Movida para Em Produção.`, 'success');
                    } catch (e) {
                        console.error('Failed to update quote status to Em Produção', e);
                    }
                }
            }

            setPendingVisualSchedule(null);
            setSelectedQuoteForDetails(null); // Close modal on schedule
        } catch (error) {
            console.error('Failed to schedule order visually', error);
            showNotification('Erro ao agendar.', 'error');
        }
    };

    const handleUnscheduleOrder = async (id: string) => {
        try {
            const mo = machineOrders.find(m => m.id === id);
            await onDeleteMachineOrder(id);
            showNotification('Agendamento removido.', 'success');

            if (mo) {
                const quote = processedOrders.find(q => q.id === mo.orderCode);
                if (quote && quote.status === 'Em Produção') {
                    // Se desprogramou algo de uma OP que estava em produção, volta ela para Pendentes
                    const originalQuote = quote.quoteDetails;
                    const updatedQuote = { ...originalQuote, status: 'Enviado p/ Produção' };
                    try {
                        await saveQuoteToDB(updatedQuote);
                        setQuotes(prev => prev.map(q => q.id === updatedQuote.id ? updatedQuote : q));
                        showNotification(`OP ${quote.id} voltou para Pendentes.`, 'warning');
                    } catch (e) {
                        console.error('Failed to update quote status to Pendentes', e);
                    }
                }
            }
        } catch (error) {
            console.error('Failed to unschedule', error);
            showNotification('Erro ao remover o agendamento.', 'error');
        }
    };

    const renderGaugeShape = (ferro: any) => {
        if (ferro.customImageBase64) {
            return (
                <div className="w-32 h-24 flex items-center justify-center bg-slate-50 border border-slate-200 rounded overflow-visible p-2">
                    <img src={ferro.customImageBase64} alt="Custom Drawing" className="w-full h-full object-contain" />
                </div>
            );
        }

        const type = ferro.tipo || ferro.drawingType || 'Reta';
        const productDesc = ferro.productInfo?.description || '';
        const matchLados = productDesc.match(/(\d+ LADOS|REDONDA)/);
        const ladosDesc = matchLados ? matchLados[1] : '4 LADOS';
        
        let svgContent = null;
        if (type === 'Estribo' || type === 'CorteDobra') {
            svgContent = renderEstriboSVG(ladosDesc, ferro.estriboShape || ferro.ferroModelId || 'Padrão', ferro.ladoA, ferro.ladoB, ferro.ladoC, ferro.ladoD, ferro.ladoE, ferro.ladoF, [...dbEstriboModels, ...dbFerroModels]) || 
                         renderBarDiagramSVG(dbFerroModels.find(m => m.id === ferro.ferroModelId)?.name || '', ferro.ladoA, ferro.ladoB, ferro.ladoC, ferro.ladoD, ferro.ladoE, true);
        } else if (type === 'Trava') {
            svgContent = renderTravaSVG(Number(ferro.estriboShape) || 1, ferro.ladoA, ferro.ladoB, ferro.ladoC, ferro.ladoD, ferro.ladoE);
        } else {
            const ferroModel = ferro.ferroModelId ? dbFerroModels.find(m => m.id === ferro.ferroModelId) : null;
            const isAdvancedModel = ferroModel && (ferroModel.customDrawingData || ferroModel.customImageBase64);
            
            if (isAdvancedModel) {
                svgContent = renderEstriboSVG('4 LADOS', ferro.ferroModelId, ferro.ladoA, ferro.ladoB, ferro.ladoC, ferro.ladoD, ferro.ladoE, ferro.ladoF, dbFerroModels);
            } else {
                svgContent = renderBarDiagramSVG(
                    ferroModel?.name || ferro.nomeElemento || ferro.posicao || ferro.tipo || type,
                    ferro.ladoA,
                    ferro.ladoB,
                    ferro.ladoC,
                    ferro.ladoD,
                    ferro.ladoE,
                    true
                );
            }
        }

        if (svgContent) {
            return (
                <div className="w-32 h-24 flex items-center justify-center bg-slate-50 border border-slate-200 rounded overflow-visible p-2">
                    <div className="scale-125 origin-center w-full h-full flex items-center justify-center">
                        {svgContent}
                    </div>
                </div>
            );
        }

        return (
            <div className="w-32 h-24 flex items-center justify-center bg-slate-50 border border-slate-200 rounded text-xs text-slate-400 font-medium">
                {type}
            </div>
        );
    };

    const renderMatrix = (isModal: boolean) => {
        const isSchedulingMode = isModal && !!pendingVisualSchedule;

        return (
            <div className={`flex-1 overflow-auto p-4 md:p-6 relative scrollbar-thin ${isModal ? 'bg-slate-50/50 max-h-[70vh]' : 'bg-[#e2e8f0]/30 max-h-[55vh]'}`}>
                {activeMachines.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <svg className="w-16 h-16 mb-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                        <h3 className="text-xl font-bold text-slate-500">Nenhuma máquina disponível</h3>
                        <p className="mt-2 text-sm text-slate-400">Configure as máquinas ativas no parceiro selecionado.</p>
                    </div>
                ) : (
                    <div className="min-w-max pb-4">
                        <table className="w-full border-separate border-spacing-0 shadow-[8px_8px_16px_#d1d9e6,-8px_-8px_16px_#ffffff] rounded-2xl overflow-hidden bg-[#e2e8f0]/20 ring-1 ring-white/50 backdrop-blur-sm">
                            <thead className="sticky top-0 z-20">
                                <tr>
                                    <th className="p-4 w-48 bg-[#e2e8f0] sticky left-0 z-30 border-r border-b border-white/40 shadow-sm rounded-tl-2xl flex items-center justify-between">
                                        <svg className="w-6 h-6 text-slate-400 drop-shadow-sm" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                        <svg className="w-7 h-7 text-slate-500 drop-shadow-sm" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                    </th>
                                    {dates.map((dateStr, dIdx) => {
                                        const isToday = dIdx === 0;
                                        const [y, m, d] = dateStr.split('-');
                                        const dayLabel = isToday ? 'HOJE' : getDayOfWeek(dateStr).toUpperCase();
                                        
                                        const gradients = [
                                            'bg-gradient-to-r from-[#172c4e] to-[#16385d]',
                                            'bg-gradient-to-r from-[#16385d] to-[#154b70]',
                                            'bg-gradient-to-r from-[#154b70] to-[#166687]',
                                            'bg-gradient-to-r from-[#166687] to-[#1888a2]',
                                            'bg-gradient-to-r from-[#1888a2] to-[#1caabd]',
                                            'bg-gradient-to-r from-[#1caabd] to-[#20cfd4]',
                                            'bg-gradient-to-r from-[#20cfd4] to-[#24e5e5]'
                                        ];
                                        const bgColor = gradients[dIdx] || 'bg-[#1e293b]';
                                        
                                        return (
                                            <th key={dateStr} className={`p-4 text-center border-l border-white/20 border-b border-b-slate-900/10 min-w-[280px] shadow-sm ${bgColor} ${dIdx === dates.length - 1 ? 'rounded-tr-2xl' : ''}`}>
                                                <div className="flex items-center justify-center gap-2">
                                                    <span className="font-extrabold text-white tracking-widest text-sm drop-shadow-md">{dayLabel}</span>
                                                    <span className="font-bold text-white/80 text-sm drop-shadow-md">{d}/{m}</span>
                                                </div>
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            
                            <tbody>
                                {activeMachines.map((machine, mIdx) => {
                                    const todaysOrders = machineOrders.filter(mo => mo.startDate === dates[0] && mo.machineId === machine.name);
                                    const isOperante = todaysOrders.length > 0;
                                    const isLastRow = mIdx === activeMachines.length - 1;
                                    
                                    return (
                                        <tr key={machine.name} className="group transition-colors">
                                            <td className={`p-4 border-t border-t-white/60 border-r border-r-white/40 bg-[#f1f5f9] sticky left-0 z-10 w-48 shadow-[1px_0_0_0_#cbd5e1] align-middle ${isLastRow ? 'rounded-bl-2xl' : ''}`}>
                                                <div className="flex items-center gap-3">
                                                    <div className="bg-gradient-to-br from-[#e0eaf5] to-[#c8d4e4] w-[42px] h-[42px] flex-shrink-0 rounded-xl shadow-[inset_1px_1px_2px_#ffffff,inset_-1px_-1px_2px_#94a3b8,2px_2px_4px_#94a3b8,-2px_-2px_4px_#ffffff] flex items-center justify-center overflow-hidden">
                                                        {machine.imageUrl ? (
                                                            <img src={machine.imageUrl} alt={machine.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <svg className="w-7 h-7 text-slate-600 drop-shadow-sm" fill="currentColor" viewBox="0 0 24 24"><path d="M19.5 8h-15A1.5 1.5 0 003 9.5v5A1.5 1.5 0 004.5 16h15a1.5 1.5 0 001.5-1.5v-5A1.5 1.5 0 0019.5 8zM5 14H4v-3h1v3zm3 0H7v-3h1v3zm3 0h-1v-3h1v3zm6 0h-5v-3h5v3z" opacity="0.3"/><path d="M21 9.5A2.5 2.5 0 0018.5 7h-13A2.5 2.5 0 003 9.5v5A2.5 2.5 0 005.5 17h13a2.5 2.5 0 002.5-2.5v-5zM19 14.5a.5.5 0 01-.5.5h-13a.5.5 0 01-.5-.5v-5a.5.5 0 01.5-.5h13a.5.5 0 01.5.5v5z" opacity="0.7"/><path d="M17 10h1v4h-1zM14 10h1v4h-1zM11 10h1v4h-1zM8 10h1v4H8z" fill="#475569"/><circle cx="6" cy="12" r="1" fill="#475569"/></svg>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <h3 className="font-black text-slate-800 text-[13px] uppercase tracking-tighter drop-shadow-sm leading-tight">{machine.name}</h3>
                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                            <div className={`w-2 h-2 rounded-full ${isOperante ? 'bg-[#10b981] shadow-[0_0_6px_rgba(16,185,129,0.8)]' : 'bg-slate-400 shadow-inner'}`} />
                                                            <span className="text-[11px] font-bold text-slate-500 drop-shadow-sm">{isOperante ? 'Operante' : 'Ociosa'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            
                                            {dates.map((dateStr, dIdx) => {
                                                const cellOrders = machineOrders.filter(mo => mo.startDate === dateStr && mo.machineId === machine.name).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                                                
                                                let isCompatible = true;
                                                if (isSchedulingMode && pendingVisualSchedule) {
                                                    // First check bitola limits
                                                    if (!isMachineCompatibleWithBitola(machine.gaugeRange || '', pendingVisualSchedule.bitola)) {
                                                        isCompatible = false;
                                                    }
                                                    
                                                    // Then check shape/drawing limits
                                                    if (isCompatible && machine.capabilities) {
                                                        const quote = quotes.find(q => q.os === pendingVisualSchedule.quoteId);
                                                    if (quote && quote.items) {
                                                        const group = quote.items.find((g: any) => cleanGaugeString(g.bitola) === cleanGaugeString(pendingVisualSchedule.bitola));
                                                        if (group && group.ferros) {
                                                            for (const f of group.ferros) {
                                                                const typeStr = (f.nomeElemento || f.tipo || f.drawingType || '').toUpperCase();
                                                                let formatCat = 'reto';
                                                                if (typeStr.includes('ESTRIBO')) formatCat = 'estribo';
                                                                else if (typeStr.includes('CORTE') || typeStr.includes('DOBRA') || typeStr.includes('GANCHO') || f.ladoB) formatCat = 'corteDobra';

                                                                if (formatCat === 'estribo') {
                                                                    if (machine.capabilities.estribo?.enabled === false) isCompatible = false;
                                                                    if (machine.capabilities.estribo?.maxSideA_cm && parseFloat(f.ladoA || '0') > machine.capabilities.estribo.maxSideA_cm) isCompatible = false;
                                                                    if (machine.capabilities.estribo?.maxSideB_cm && parseFloat(f.ladoB || '0') > machine.capabilities.estribo.maxSideB_cm) isCompatible = false;
                                                                } else if (formatCat === 'reto') {
                                                                    if (machine.capabilities.reto?.enabled === false) isCompatible = false;
                                                                    const compCm = getFerroTotalLengthCm(f, f.productInfo?.description || '');
                                                                    if (machine.capabilities.reto?.maxLength_m && (compCm / 100) > machine.capabilities.reto.maxLength_m) isCompatible = false;
                                                                } else if (formatCat === 'corteDobra') {
                                                                    if (machine.capabilities.corteDobra?.enabled === false) isCompatible = false;
                                                                    
                                                                    // Check Max Base for Multiple Bends constraint
                                                                    const maxBase = machine.capabilities.corteDobra?.maxBaseForMultipleBends_cm;
                                                                    if (maxBase && isCompatible) {
                                                                        // Pela convenção do usuário: Lado A é sempre a base. Lado B e C são as pernas/alturas.
                                                                        // Se tem Lado B E Lado C, significa que tem múltiplas dobras (ex: formato em U).
                                                                        const hasMultipleBends = (f.ladoB && parseFloat(f.ladoB) > 0) && (f.ladoC && parseFloat(f.ladoC) > 0);
                                                                        const baseA = f.ladoA ? parseFloat(f.ladoA) : 0;
                                                                        
                                                                        if (hasMultipleBends && baseA > maxBase) {
                                                                            isCompatible = false;
                                                                        }
                                                                    }
                                                                }
                                                                if (!isCompatible) break;
                                                            }
                                                        }
                                                    }
                                                }
                                                }
                                                
                                                return (
                                                    <td 
                                                        key={`${machine.name}-${dateStr}`} 
                                                        onClick={() => {
                                                            if (isSchedulingMode && isCompatible) {
                                                                handleVisualScheduleClick(dateStr, machine.name);
                                                            }
                                                        }}
                                                        className={`p-2 border-t border-white/60 border-l border-l-slate-300/30 align-top transition-all duration-300 ${
                                                            isSchedulingMode && isCompatible 
                                                                ? 'cursor-pointer hover:bg-green-100/40 relative' 
                                                                : 'bg-[#f4f7fb]/60 hover:bg-[#eef2f7]/80'
                                                        }`}
                                                    >
                                                        {isSchedulingMode && isCompatible && (
                                                            <div className="absolute inset-0 border-2 border-transparent hover:border-green-400/80 pointer-events-none rounded-lg m-1 transition-colors" />
                                                        )}
                                                        
                                                        {cellOrders.length === 0 ? (
                                                            <div className={`h-[88px] rounded-xl border-[1.5px] border-dashed flex flex-col items-center justify-center gap-2 transition-all ${isSchedulingMode && isCompatible ? 'border-green-400 bg-green-50/50 hover:border-green-500 hover:bg-green-100/70 shadow-sm' : 'border-slate-300/60 bg-transparent'}`}>
                                                                {isSchedulingMode && isCompatible ? (
                                                                    <>
                                                                        <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center shadow-inner ring-1 ring-green-200">
                                                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                                                                        </div>
                                                                    </>
                                                                ) : (
                                                                    <svg className="w-6 h-6 text-slate-300/50 drop-shadow-sm" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-col gap-2 relative z-0">
                                                                {cellOrders.map((mo, idx) => {
                                                                    const parsedNotes = (() => { try { return mo.notes ? JSON.parse(mo.notes) : {} } catch { return {} } })();
                                                                    const meters = Number(parsedNotes.totalMetros || 0).toFixed(2);
                                                                    // Fix for dirty bitola strings in the database that might have appended weights (e.g., "10.00 mm0.62")
                                                                    const gauge = cleanGaugeString(mo.gauge || '');
                                                                    
                                                                    // Tonalidades seguindo a imagem: Teal para alguns, Ouro/Amarelo para outros
                                                                    const isTeal = idx % 2 === 0;
                                                                    const gradientClass = isTeal 
                                                                        ? 'bg-gradient-to-br from-[#80d8d4] to-[#aee9e3] shadow-[4px_4px_8px_rgba(128,216,212,0.3),inset_1px_1px_1px_rgba(255,255,255,0.6)] text-[#0c4a46] border border-[#71ccc8]/50'
                                                                        : 'bg-gradient-to-br from-[#d4a34b] to-[#dfbc71] shadow-[4px_4px_8px_rgba(212,163,75,0.3),inset_1px_1px_1px_rgba(255,255,255,0.4)] text-[#4a350c] border border-[#c5943d]/50';

                                                                    const moTimeMins = (() => {
                                                                        let cap = machine.capacityKgPerHour || 0;
                                                                        const quote = quotes.find(q => q.os === mo.orderCode);
                                                                        const group = quote?.items?.find((g: any) => cleanGaugeString(g.bitola) === cleanGaugeString(mo.gauge));
                                                                        const ferro = group?.ferros?.[0];

                                                                        if (ferro && machine.capabilities) {
                                                                            const typeStr = (ferro.nomeElemento || ferro.tipo || ferro.drawingType || '').toUpperCase();
                                                                            let formatCat = 'reto';
                                                                            if (typeStr.includes('ESTRIBO')) formatCat = 'estribo';
                                                                            else if (typeStr.includes('CORTE') || typeStr.includes('DOBRA') || typeStr.includes('GANCHO') || ferro.ladoB) formatCat = 'corteDobra';

                                                                            if (formatCat === 'estribo' && machine.capabilities.estribo?.enabled && machine.capabilities.estribo.calculatedMetersPerHour) {
                                                                                const mph = machine.capabilities.estribo.calculatedMetersPerHour;
                                                                                if (mph > 0) return (Number(meters) / mph) * 60;
                                                                            }
                                                                            if (formatCat === 'reto' && machine.capabilities.reto?.enabled) cap = machine.capabilities.reto.capacityKgPerHour || cap;
                                                                            if (formatCat === 'corteDobra' && machine.capabilities.corteDobra?.enabled) cap = machine.capabilities.corteDobra.capacityKgPerHour || cap;
                                                                        }
                                                                        
                                                                        if (!cap) return null;
                                                                        return (Number(mo.weight || 0) / cap) * 60;
                                                                    })();

                                                                    return (
                                                                        <div key={mo.id} className={`rounded-xl p-2.5 flex flex-col relative overflow-hidden group hover:-translate-y-0.5 hover:shadow-md transition-all ${gradientClass}`}>
                                                                            <div className="flex justify-between items-start mb-1">
                                                                                <div className={`font-black text-[11px] uppercase tracking-wide px-1.5 py-0.5 rounded shadow-sm flex items-center gap-1 ${isTeal ? 'bg-white/40 text-[#0f5e5a]' : 'bg-white/30 text-[#5e420f]'}`}>
                                                                                    OP {mo.orderCode}
                                                                                </div>
                                                                                <div className="flex items-center gap-1 z-10">
                                                                                    <button 
                                                                                        onClick={(e) => { 
                                                                                            e.stopPropagation(); 
                                                                                            setPrintingMachineOrder(mo);
                                                                                        }}
                                                                                        className={`hover:scale-110 rounded p-1 transition-all flex items-center gap-1 ${mo.labelPrinted ? 'bg-green-600 text-white shadow-sm' : 'bg-slate-800/20 text-slate-900 hover:bg-slate-800/40'}`}
                                                                                        title={mo.labelPrinted ? "Imprimir Etiqueta Novamente" : "Imprimir Etiqueta"}
                                                                                    >
                                                                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                                                                    </button>
                                                                                    <button 
                                                                                        onClick={(e) => { 
                                                                                            e.stopPropagation(); 
                                                                                            setEditingMachineOrder(mo); 
                                                                                        }}
                                                                                        className="hover:scale-110 bg-slate-800/10 hover:bg-slate-800/30 rounded p-1 transition-all"
                                                                                        title="Editar Agendamento"
                                                                                    >
                                                                                        <svg className={`w-3.5 h-3.5 opacity-80 ${isTeal ? 'text-[#0f5e5a]' : 'text-[#5e420f]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                            <div className="font-extrabold text-[9px] leading-tight mt-0.5 truncate uppercase opacity-90" title={mo.clientName}>{mo.clientName}</div>
                                                                            <div className="flex justify-between items-end mt-1.5 pt-1.5 border-t border-black/10">
                                                                                <div className="flex flex-col">
                                                                                    <span className="text-[7px] font-extrabold uppercase tracking-widest opacity-70">Bitola</span>
                                                                                    <span className="text-[11px] font-black">{gauge}</span>
                                                                                </div>
                                                                                <div className="flex gap-2.5 text-right">
                                                                                    <div className="flex flex-col items-end">
                                                                                        <span className="text-[7px] font-extrabold uppercase tracking-widest opacity-70">Peças</span>
                                                                                        <span className="font-black text-[10px] tracking-tight">{mo.osQuantity || mo.quantity || 0} un</span>
                                                                                    </div>
                                                                                    <div className="flex flex-col items-end">
                                                                                        <span className="text-[7px] font-extrabold uppercase tracking-widest opacity-70">Total</span>
                                                                                        <span className="font-black text-[10px] tracking-tight">{meters} m</span>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                            {moTimeMins !== null && (
                                                                                <div className="flex justify-between items-center mt-1 pt-1 border-t border-black/5 text-[9px] font-bold">
                                                                                    <span className="opacity-70">⚖️ {Number(mo.weight || 0).toFixed(1)}kg</span>
                                                                                    <span className="opacity-80 bg-black/5 px-1.5 py-0.5 rounded">⏱️ ~{Math.ceil(moTimeMins)} min</span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] p-2 md:p-4 animate-fadeIn relative">
            <div className="w-full mx-auto space-y-4">
                
                {/* Header */}
                <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/30 flex items-center justify-center text-white">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        </div>
                        <div>
                            <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 tracking-tight font-sans">
                                Cronograma de Máquinas
                            </h1>
                            <p className="text-slate-500 text-sm font-medium mt-0.5">
                                Acompanhe e distribua a fila de produção das suas máquinas.
                            </p>
                        </div>
                    </div>
                </header>

                <div className="flex flex-col gap-6">
                    {/* MATRIZ DE AGENDAMENTO FIXA */}
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden">
                        <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                            <h2 className="text-lg font-bold text-slate-800">Visão Geral da Produção (Próximos 7 Dias)</h2>
                        </div>
                        {renderMatrix(false)}
                    </div>

                    {/* Full Screen: Orders Tabs */}
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col min-h-[50vh]">
                        <div className="p-3 border-b border-slate-200 bg-white rounded-t-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner">
                                <button
                                    onClick={() => setBottomTab('pendentes')}
                                    className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${bottomTab === 'pendentes' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                                >
                                    Pendentes <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${bottomTab === 'pendentes' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-500'}`}>{pendentes.length}</span>
                                </button>
                                <button
                                    onClick={() => setBottomTab('producao')}
                                    className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${bottomTab === 'producao' ? 'bg-white shadow text-green-600' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                                >
                                    Em Produção <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${bottomTab === 'producao' ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500'}`}>{emProducao.length}</span>
                                </button>
                            </div>
                            <div className="relative w-full sm:w-72">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                </div>
                                <input
                                    type="text"
                                    placeholder="Buscar por OP, Cliente..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all shadow-sm"
                                />
                            </div>
                        </div>
                        
                        <div className="p-6 overflow-x-auto overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 bg-slate-50 items-start h-full scrollbar-thin">
                            {(bottomTab === 'pendentes' ? pendentes : emProducao).length === 0 ? (
                                <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400">
                                    <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                                        <svg className="w-10 h-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-600">Nenhuma OS encontrada</h3>
                                    <p className="text-sm font-medium mt-1">A lista desta aba está vazia no momento.</p>
                                </div>
                            ) : (
                                (bottomTab === 'pendentes' ? pendentes : emProducao).map(order => (
                                    <div 
                                        key={order.id} 
                                        onClick={() => {
                                            setSelectedQuoteForDetails(order);
                                            setShowCutPlan(false);
                                        }}
                                        className="w-full bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col cursor-pointer hover:border-blue-300"
                                    >
                                        <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-3">
                                            <div>
                                                <span className={`text-xs font-black px-2.5 py-1 rounded-full ${bottomTab === 'pendentes' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}`}>
                                                    OP: {order.os}
                                                </span>
                                                <h3 className="text-base font-bold text-slate-800 mt-2 truncate max-w-[200px]" title={order.cliente}>{order.cliente}</h3>
                                            </div>
                                            <div className="text-xs text-slate-400 font-medium">
                                                {formatDateBr(order.data.split('T')[0])}
                                            </div>
                                        </div>
                                        
                                        <div className="space-y-3">
                                            {order.gauges.slice(0, 4).map((g, i) => {
                                                const isFullyScheduled = g.scheduledCount >= g.osCount;
                                                return (
                                                    <div key={i} className="flex flex-col text-xs p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                                                        <div className="flex justify-between items-center mb-1">
                                                            <span className="font-black text-slate-800 text-sm">
                                                                {(() => {
                                                                    const bStr = String(g.bitola || '');
                                                                    const m = bStr.match(/(\d+\.?\d*\s*mm)/i);
                                                                    return m ? m[1].toUpperCase() : bStr.replace(/VERGALHAO CA\d+\(ARMADO-AMARRADO\)\s*/i, '').trim().toUpperCase();
                                                                })()}
                                                            </span>
                                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${isFullyScheduled ? 'bg-green-200 text-green-800' : 'bg-orange-200 text-orange-800'}`}>
                                                                {isFullyScheduled ? 'Programado' : 'Falta'}
                                                            </span>
                                                        </div>
                                                        <div className="flex gap-4 text-slate-500 font-medium mt-1">
                                                            <span>Qtd: <strong className="text-slate-700">{g.osCount} un</strong></span>
                                                            <span>Peso: <strong className="text-slate-700">{Number(g.totalWeight || 0).toFixed(1)}kg</strong></span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {order.gauges.length > 4 && (
                                                <div className="text-xs text-center text-blue-500 font-bold bg-blue-50 py-2 rounded-lg">
                                                    + {order.gauges.length - 4} bitolas...
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal de Detalhes da OP */}
            {selectedQuoteForDetails && (
                <div className="fixed inset-0 z-[100] flex flex-col bg-white animate-fadeIn w-full h-full overflow-hidden">
                    <div className="flex-1 w-full h-full flex flex-col overflow-hidden">
                        <div className="p-6 md:px-12 border-b border-slate-200 flex justify-between items-start bg-slate-50 shrink-0 shadow-sm z-10">
                            <div>
                                <div className="flex items-center gap-3">
                                    <h2 className="text-2xl font-black text-slate-800">OP: {selectedQuoteForDetails.os}</h2>
                                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${bottomTab === 'pendentes' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}`}>
                                        {bottomTab === 'pendentes' ? 'Pendente de Programação' : 'Em Produção'}
                                    </span>
                                </div>
                                <p className="text-sm font-semibold text-slate-600 mt-1">Cliente: <span className="text-slate-900">{selectedQuoteForDetails.cliente}</span></p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => setShowCutPlan(!showCutPlan)}
                                    className="px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-sm font-bold transition-colors border border-blue-200"
                                >
                                    {showCutPlan ? 'Ocultar Plano de Corte' : 'Ver Plano de Corte Completo'}
                                </button>
                                <button 
                                    onClick={() => setSelectedQuoteForDetails(null)}
                                    className="p-2 text-slate-400 hover:bg-slate-200 rounded-full transition-colors"
                                >
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        </div>
                        <div className="p-6 md:px-12 overflow-y-auto bg-white flex-1 space-y-6">
                            
                            {/* Resumo por Bitolas */}
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                                    Resumo de Programação por Bitola
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {selectedQuoteForDetails.gauges.map((g, idx) => {
                                        const isFullyScheduled = g.scheduledCount >= g.osCount;
                                        const gNorm = cleanGaugeString(g.bitola || '');
                                        const relatedOrders = machineOrders.filter(mo => 
                                            mo.orderCode === selectedQuoteForDetails.os && 
                                            cleanGaugeString(mo.gauge || '') === gNorm
                                        );

                                        return (
                                            <div key={idx} className={`p-4 rounded-xl border-2 transition-all flex flex-col justify-between ${isFullyScheduled ? 'bg-green-50 border-green-200' : 'bg-white border-orange-200 shadow-sm'}`}>
                                                <div>
                                                    <div className="flex justify-between items-start mb-3">
                                                        <h4 className="font-black text-slate-800 text-lg">
                                                            {(() => {
                                                                const m = gNorm.match(/(\d+\.?\d*\s*mm)/i);
                                                                return m ? m[1].toUpperCase() : gNorm.toUpperCase();
                                                            })()}
                                                        </h4>
                                                        {isFullyScheduled ? (
                                                            <span className="bg-green-500 text-white text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-wide shadow-sm">Programado</span>
                                                        ) : (
                                                            <span className="bg-orange-500 text-white text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-wide animate-pulse shadow-sm">Falta Programar</span>
                                                        )}
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-y-2 text-sm text-slate-600 font-medium mb-3">
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] text-slate-400 uppercase font-bold">Quantidade</span>
                                                            <span className="text-slate-800">{g.osCount} <span className="text-xs">un</span></span>
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] text-slate-400 uppercase font-bold">Peso Total</span>
                                                            <span className="text-slate-800">{Number(g.totalWeight || 0).toFixed(2)} <span className="text-xs">kg</span></span>
                                                        </div>
                                                                    <div className="flex flex-col">
                                                                        <span className="text-[10px] text-slate-400 uppercase font-bold">Quantidade de Metros</span>
                                                                        <span className="text-slate-800">{Number(g.totalMeters || 0).toFixed(2)} <span className="text-xs">m</span></span>
                                                                    </div>
                                                                    {relatedOrders.length > 0 && (
                                                                        <div className="flex flex-col">
                                                                            <span className="text-[10px] text-slate-400 uppercase font-bold">Tempo Programado</span>
                                                                            <span className="text-slate-800">
                                                                                ~{Math.ceil(relatedOrders.reduce((acc, ro) => {
                                                                                    const machineForRo = activeMachines.find(m => m.name === ro.machineId);
                                                                                    let roTimeMins = 0;
                                                                                    if (machineForRo) {
                                                                                        let cap = machineForRo.capacityKgPerHour || 0;
                                                                                        const quote = quotes.find(q => q.os === ro.orderCode);
                                                                                        const group = quote?.items?.find((g: any) => cleanGaugeString(g.bitola) === cleanGaugeString(ro.gauge));
                                                                                        const ferro = group?.ferros?.[0];
                                                                                        
                                                                                        if (ferro && machineForRo.capabilities) {
                                                                                            const typeStr = (ferro.nomeElemento || ferro.tipo || ferro.drawingType || '').toUpperCase();
                                                                                            let formatCat = 'reto';
                                                                                            if (typeStr.includes('ESTRIBO')) formatCat = 'estribo';
                                                                                            else if (typeStr.includes('CORTE') || typeStr.includes('DOBRA') || typeStr.includes('GANCHO') || ferro.ladoB) formatCat = 'corteDobra';
                                                                                            
                                                                                            if (formatCat === 'estribo' && machineForRo.capabilities.estribo?.enabled && machineForRo.capabilities.estribo.calculatedMetersPerHour) {
                                                                                                const mph = machineForRo.capabilities.estribo.calculatedMetersPerHour;
                                                                                                const parsedNotes = (() => { try { return ro.notes ? JSON.parse(ro.notes) : {} } catch { return {} } })();
                                                                                                const mtrs = Number(parsedNotes.totalMetros || 0);
                                                                                                if (mph > 0) return acc + ((mtrs / mph) * 60);
                                                                                            }
                                                                                            if (formatCat === 'reto' && machineForRo.capabilities.reto?.enabled) cap = machineForRo.capabilities.reto.capacityKgPerHour || cap;
                                                                                            if (formatCat === 'corteDobra' && machineForRo.capabilities.corteDobra?.enabled) cap = machineForRo.capabilities.corteDobra.capacityKgPerHour || cap;
                                                                                        }
                                                                                        
                                                                                        if (cap > 0) roTimeMins = (Number(ro.weight || 0) / cap) * 60;
                                                                                    }
                                                                                    return acc + roTimeMins;
                                                                                }, 0))} <span className="text-xs">min</span>
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                    </div>
                                                </div>

                                                <div className="mt-2">
                                                    {isFullyScheduled ? (
                                                        <div className="bg-white rounded-lg p-2 border border-green-100 flex flex-col gap-2">
                                                            {relatedOrders.map(ro => {
                                                                const machineForRo = activeMachines.find(m => m.name === ro.machineId);
                                                                let roTimeMins = null;
                                                                
                                                                if (machineForRo) {
                                                                    let cap = machineForRo.capacityKgPerHour || 0;
                                                                    const quote = quotes.find(q => q.os === ro.orderCode);
                                                                    const group = quote?.items?.find((g: any) => cleanGaugeString(g.bitola) === cleanGaugeString(ro.gauge));
                                                                    const ferro = group?.ferros?.[0];
                                                                    
                                                                    if (ferro && machineForRo.capabilities) {
                                                                        const typeStr = (ferro.nomeElemento || ferro.tipo || ferro.drawingType || '').toUpperCase();
                                                                        let formatCat = 'reto';
                                                                        if (typeStr.includes('ESTRIBO')) formatCat = 'estribo';
                                                                        else if (typeStr.includes('CORTE') || typeStr.includes('DOBRA') || typeStr.includes('GANCHO') || ferro.ladoB) formatCat = 'corteDobra';

                                                                        if (formatCat === 'estribo' && machineForRo.capabilities.estribo?.enabled && machineForRo.capabilities.estribo.calculatedMetersPerHour) {
                                                                            const mph = machineForRo.capabilities.estribo.calculatedMetersPerHour;
                                                                            const parsedNotes = (() => { try { return ro.notes ? JSON.parse(ro.notes) : {} } catch { return {} } })();
                                                                            const mtrs = Number(parsedNotes.totalMetros || 0);
                                                                            if (mph > 0) {
                                                                                roTimeMins = (mtrs / mph) * 60;
                                                                                cap = 0;
                                                                            }
                                                                        }
                                                                        if (cap > 0 && formatCat === 'reto' && machineForRo.capabilities.reto?.enabled) cap = machineForRo.capabilities.reto.capacityKgPerHour || cap;
                                                                        if (cap > 0 && formatCat === 'corteDobra' && machineForRo.capabilities.corteDobra?.enabled) cap = machineForRo.capabilities.corteDobra.capacityKgPerHour || cap;
                                                                    }
                                                                    
                                                                    if (cap > 0 && !roTimeMins) roTimeMins = (Number(ro.weight || 0) / cap) * 60;
                                                                }

                                                                return (
                                                                    <div key={ro.id} className="flex justify-between items-center bg-green-50 px-2 py-1.5 rounded border border-green-100">
                                                                        <div className="flex flex-col gap-0.5">
                                                                            <span className="text-[10px] text-green-800 font-bold">🗓️ {formatDateBr(ro.startDate)}</span>
                                                                            <span className="text-[10px] text-green-700">🤖 {ro.machineId}</span>
                                                                            {roTimeMins !== null && (
                                                                                <span className="text-[9px] text-green-600 bg-green-100/50 px-1 py-0.5 rounded self-start mt-0.5 font-semibold shadow-sm border border-green-200/50">
                                                                                    ⏱️ ~{Math.ceil(roTimeMins)} min
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <button 
                                                                            onClick={() => {
                                                                                if (window.confirm('Deseja remover este agendamento? A OP pode voltar para "Pendentes".')) {
                                                                                    handleUnscheduleOrder(ro.id);
                                                                                }
                                                                            }}
                                                                            className="text-red-400 hover:text-red-600 p-1 bg-white rounded shadow-sm hover:shadow transition-all"
                                                                            title="Remover Agendamento"
                                                                        >
                                                                            🗑️
                                                                        </button>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <button 
                                                            onClick={() => {
                                                                setPendingVisualSchedule({
                                                                    quoteId: selectedQuoteForDetails.os,
                                                                    bitola: g.bitola,
                                                                    weight: g.totalWeight,
                                                                    metros: g.totalMeters,
                                                                    qty: 1,
                                                                    osQty: g.osCount,
                                                                    clientName: selectedQuoteForDetails.cliente
                                                                });
                                                            }}
                                                            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 rounded-lg transition-colors shadow-sm"
                                                        >
                                                            Programar Agora
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Plano de Corte */}
                            {showCutPlan && (
                                <div className="mt-8 border-t border-slate-100 pt-6 animate-fadeIn">
                                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" /></svg>
                                        Plano de Corte Completo
                                    </h3>
                                    
                                    <div className="space-y-6">
                                        {selectedQuoteForDetails.gauges.map((g, gIdx) => {
                                            if (g.ferros.length === 0) return null;
                                            return (
                                                <div key={gIdx} className="bg-slate-50 rounded-xl p-4 border border-slate-200 shadow-sm">
                                                    <h4 className="font-bold text-slate-800 mb-4 pb-2 flex items-center gap-2">
                                                        <span className="bg-slate-800 text-white px-3 py-1.5 rounded-md text-sm uppercase tracking-wide shadow-sm">
                                                            {cleanGaugeString(g.bitola || '')}
                                                        </span>
                                                    </h4>
                                                    <div className="overflow-x-auto rounded-lg border border-slate-300 shadow-sm">
                                                        <table className="w-full text-left text-sm border-collapse bg-white">
                                                            <thead>
                                                                <tr className="bg-slate-100 text-slate-600 border-b border-slate-300">
                                                                    <th className="p-3 font-bold text-center border-r border-slate-300 w-20 uppercase">OS</th>
                                                                    <th className="p-3 font-bold text-center border-r border-slate-300 w-24 uppercase">Qtd</th>
                                                                    <th className="p-3 font-bold text-center border-r border-slate-300 w-48 uppercase">Formato</th>
                                                                    <th className="p-3 font-bold text-center border-r border-slate-300 w-32 uppercase">Comp. (cm)</th>
                                                                    <th className="p-3 font-bold text-center border-r border-slate-300 w-32 uppercase">Total (m)</th>
                                                                    <th className="p-3 font-bold text-center border-r border-slate-300 w-32 uppercase">Peso (kg)</th>
                                                                    <th className="p-3 font-bold text-center border-r border-slate-300 w-32 uppercase">Tempo (min)</th>
                                                                    <th className="p-3 font-bold text-center w-40 uppercase">Desenho</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {g.ferros.map((ferro, fIdx) => {
                                                                    const formatText = (ferro.nomeElemento || ferro.posicao || ferro.tipo || ferro.drawingType || 'RETO').toUpperCase();

                                                                    const compCm = getFerroTotalLengthCm(ferro, ferro.productInfo?.description || '');
                                                                    const productQty = Number(ferro.productInfo?.qty || 1);
                                                                    const qtd = Number(ferro.qtde || ferro.quantidade || 0) * productQty;
                                                                    const totalMeters = compCm ? ((compCm / 100) * qtd) : 0;
                                                                    
                                                                    let unitWeight = 0;
                                                                    if (ferro.bitolaPesoLinear) {
                                                                        unitWeight = Number(ferro.bitolaPesoLinear);
                                                                    } else {
                                                                        const gaugeName = getGaugeLabel(ferro, ferro.productInfo);
                                                                        const config = bitolasConfig.find(b => cleanGaugeString(b.label) === gaugeName);
                                                                        if (config) unitWeight = Number(config.kgm || 0);
                                                                    }
                                                                    const weightKg = totalMeters * unitWeight;

                                                                    return (
                                                                        <tr key={fIdx} className="border-b border-slate-200 last:border-0 hover:bg-slate-50 transition-colors">
                                                                            <td className="p-3 text-center border-r border-slate-300 font-bold text-slate-800 text-lg bg-slate-50/50">{ferro.osNumberString || '-'}</td>
                                                                            <td className="p-3 text-center border-r border-slate-300 font-black text-sky-700 text-lg">{qtd || '-'}</td>
                                                                            <td className="p-3 text-center border-r border-slate-300 font-bold text-slate-800 text-xs">
                                                                                {formatText}
                                                                            </td>
                                                                            <td className="p-3 text-center border-r border-slate-300 font-bold text-slate-700">
                                                                                {compCm ? `${compCm.toFixed(1)}` : '-'}
                                                                            </td>
                                                                            <td className="p-3 text-center border-r border-slate-300 font-bold text-green-700 bg-green-50/50">
                                                                                {totalMeters ? `${totalMeters.toFixed(2)} m` : '-'}
                                                                            </td>
                                                                            <td className="p-3 text-center border-r border-slate-300 font-bold text-slate-700">
                                                                                {weightKg ? `${weightKg.toFixed(2)} kg` : '-'}
                                                                            </td>
                                                                            <td className="p-3 text-center border-r border-slate-300 font-bold text-slate-700">
                                                                                {(() => {
                                                                                    if (!weightKg) return '-';
                                                                                    const machineId = selectedQuoteForDetails?.machineOrdersInfo?.[0]?.machineId;
                                                                                    const machine = activeMachines.find(m => m.name === machineId);
                                                                                    if (!machine) return '-';
                                                                                    
                                                                                    const typeStr = (ferro.nomeElemento || ferro.tipo || ferro.drawingType || '').toUpperCase();
                                                                                    let formatCat = 'reto';
                                                                                    if (typeStr.includes('ESTRIBO')) formatCat = 'estribo';
                                                                                    else if (typeStr.includes('CORTE') || typeStr.includes('DOBRA') || typeStr.includes('GANCHO') || ferro.ladoB) formatCat = 'corteDobra';

                                                                                    let cap = machine.capacityKgPerHour || 0;
                                                                                    if (machine.capabilities) {
                                                                                        if (formatCat === 'estribo' && machine.capabilities.estribo?.enabled && machine.capabilities.estribo.calculatedMetersPerHour) {
                                                                                            // Usar fórmula exata baseada em metros/hora ao invés de Kg genérico!
                                                                                            const compCm = getFerroTotalLengthCm(ferro, ferro.productInfo?.description || '');
                                                                                            const totalMeters = (compCm / 100) * (ferro.quantidade || 0);
                                                                                            const mph = machine.capabilities.estribo.calculatedMetersPerHour;
                                                                                            if (mph > 0) {
                                                                                                const mins = (totalMeters / mph) * 60;
                                                                                                return `${Math.ceil(mins)} min`;
                                                                                            }
                                                                                        }
                                                                                        if (formatCat === 'reto' && machine.capabilities.reto?.enabled) cap = machine.capabilities.reto.capacityKgPerHour || cap;
                                                                                        if (formatCat === 'corteDobra' && machine.capabilities.corteDobra?.enabled) cap = machine.capabilities.corteDobra.capacityKgPerHour || cap;
                                                                                    }
                                                                                    
                                                                                    if (!cap) return '-';
                                                                                    const mins = (weightKg / cap) * 60;
                                                                                    return `${Math.ceil(mins)} min`;
                                                                                })()}
                                                                            </td>
                                                                            <td className="p-2 text-center align-middle">
                                                                                <div className="flex justify-center items-center h-full w-full">
                                                                                    {renderGaugeShape(ferro)}
                                                                                </div>
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Agendamento Visual (Ativado via botão Programar Agora) */}
            {pendingVisualSchedule && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[90vh] flex flex-col overflow-hidden">
                        
                        {/* Header do Agendamento */}
                        <div className="bg-blue-600 text-white p-4 px-6 shadow-lg flex items-center justify-between flex-shrink-0">
                            <div>
                                <h3 className="font-bold text-xl flex items-center gap-2">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                    Modo de Agendamento Visual
                                </h3>
                                <p className="text-sm text-blue-100 mt-1">
                                    Clique em uma célula <strong className="text-white">Livre (Verde)</strong> abaixo para agendar a OP <strong>{pendingVisualSchedule.quoteId}</strong> ({pendingVisualSchedule.clientName}) - Bitola <strong>{String(pendingVisualSchedule.bitola || '').replace(/VERGALHAO CA\d+\(ARMADO-AMARRADO\)\s*/i, '').trim()}</strong> ({Number(pendingVisualSchedule.weight || 0).toFixed(2)} kg).
                                </p>
                            </div>
                            <button 
                                onClick={() => setPendingVisualSchedule(null)}
                                className="bg-white text-blue-600 hover:bg-slate-100 px-6 py-2.5 rounded-xl text-sm font-black transition-colors shadow"
                            >
                                Cancelar
                            </button>
                        </div>

                        {/* Corpo da Matriz no Modal */}
                        {renderMatrix(true)}
                    </div>
                </div>
            )}

            {/* Modal de Edição de Agendamento */}
            {editingMachineOrder && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
                        <div className="bg-slate-50 border-b border-slate-200 p-4 flex justify-between items-center">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                Opções do Agendamento
                            </h3>
                            <button onClick={() => setEditingMachineOrder(null)} className="text-slate-400 hover:bg-slate-200 p-1.5 rounded-full transition-colors">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="p-5 flex flex-col gap-4">
                            <div className="flex flex-col gap-1">
                                <span className="text-xs font-bold text-slate-500 uppercase">Mover para outro dia</span>
                                <select 
                                    className="w-full border-slate-300 rounded-xl shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2.5 text-sm font-semibold text-slate-700 bg-slate-50"
                                    value={editingMachineOrder.startDate}
                                    onChange={async (e) => {
                                        const newDate = e.target.value;
                                        await onUpdateMachineOrder(editingMachineOrder.id, { startDate: newDate, endDate: newDate });
                                        showNotification('Data alterada com sucesso!', 'success');
                                        setEditingMachineOrder(null);
                                    }}
                                >
                                    {dates.map(d => (
                                        <option key={d} value={d}>{formatDateBr(d)} ({getDayOfWeek(d)})</option>
                                    ))}
                                </select>
                            </div>
                            
                            <hr className="border-slate-100" />
                            
                            <button 
                                onClick={() => {
                                    const quote = processedOrders.find(q => q.id === editingMachineOrder.orderCode);
                                    if (quote) {
                                        setSelectedQuoteForDetails(quote);
                                        setShowCutPlan(true);
                                    } else {
                                        showNotification('OP não encontrada na aba de Produção.', 'warning');
                                    }
                                    setEditingMachineOrder(null);
                                }}
                                className="w-full flex justify-center items-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold py-2.5 rounded-xl transition-colors border border-blue-200"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" /></svg>
                                Ver Plano de Corte Completo
                            </button>
                            
                            <button 
                                onClick={() => {
                                    if (window.confirm('Tem certeza que deseja excluir esta OP da máquina?')) {
                                        handleUnscheduleOrder(editingMachineOrder.id);
                                        setEditingMachineOrder(null);
                                    }
                                }}
                                className="w-full flex justify-center items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 font-bold py-2.5 rounded-xl transition-colors border border-red-200"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                Excluir Programação
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Impressão de Etiqueta */}
            {printingMachineOrder && (() => {
                const printingQuote = processedOrders.find(q => q.id === printingMachineOrder.orderCode);
                const rawMoGauge = String(printingMachineOrder.gauge || '').replace(/VERGALHAO CA\d+\(ARMADO-AMARRADO\)\s*/i, '').trim();
                const gaugeMatch = rawMoGauge.match(/(\d+(?:[.,]\d+)?)\s*mm/i);
                const gauge = gaugeMatch ? gaugeMatch[0] : rawMoGauge;

                const printingGaugeGroup = printingQuote?.gauges.find(g => {
                    const normG = cleanGaugeString(g.bitola || '');
                    return normG === gauge || normG.includes(gauge) || gauge.includes(normG);
                });

                const ferrosToPrint = printingGaugeGroup?.ferros || [];

                return (
                <div className="fixed inset-0 z-[150] bg-slate-900 overflow-y-auto print:bg-white animate-fadeIn">
                    <div className="min-h-screen p-4 flex flex-col items-center print:p-0 print:block">
                        <div className="w-full max-w-4xl flex justify-between items-center mb-8 bg-white p-4 rounded-xl shadow-lg print:hidden">
                            <h2 className="text-xl font-bold text-slate-800">🏷️ Etiquetas de Produção Máquina - OP {printingMachineOrder.orderCode.toString().padStart(6, '0')}</h2>
                            <div className="flex gap-4">
                                <button onClick={() => setIsLabelConfigOpen(true)} className="px-4 py-2 bg-slate-100 border border-slate-300 text-slate-700 font-bold rounded-lg hover:bg-slate-200 flex items-center gap-2">
                                    ⚙️ Configurar
                                </button>
                                <button 
                                    onClick={async () => {
                                        window.print();
                                        await onUpdateMachineOrder(printingMachineOrder.id, { labelPrinted: true });
                                        showNotification('Enviado para a fila de impressão e marcado como impresso!', 'success');
                                        setPrintingMachineOrder(null);
                                    }} 
                                    className="px-6 py-2 bg-sky-600 text-white font-bold rounded-lg hover:bg-sky-700 shadow-md flex items-center gap-2"
                                    disabled={ferrosToPrint.length === 0}
                                >
                                    🖨️ Imprimir Etiquetas
                                </button>
                                <button onClick={() => setPrintingMachineOrder(null)} className="px-6 py-2 bg-slate-200 text-slate-700 font-bold rounded-lg hover:bg-slate-300">
                                    Fechar
                                </button>
                            </div>
                        </div>

                        <div className="w-full print:w-full flex flex-col gap-8 print:gap-0 print:block mx-auto" style={{ maxWidth: `${labelWidth}px` }}>
                            {ferrosToPrint.length === 0 && (
                                <div className="text-slate-500 font-bold p-8 text-center bg-white rounded-lg shadow-xl print:hidden">Nenhum detalhe de desenho encontrado para esta bitola nesta OP.</div>
                            )}
                            {ferrosToPrint.map((ferro, idx) => {
                                const productInfo = ferro.productInfo;
                                const prodQtde = productInfo?.qty || 1;
                                const cutQty = (ferro.qtde || ferro.quantidade || 1) * prodQtde;
                                const osName = (productInfo?.description || 'PRODUTO').replace(/\s*\d*\s*LADOS X.*/i, '').trim();
                                const osNumber = ferro.osNumberString || `OS: ${(idx+1).toString().padStart(2, '0')}`;
                                
                                const bitolaStr = printingGaugeGroup?.bitola || gauge;
                                const regexMatch = bitolaStr.match(/(\d+\.?\d*\s*mm)/i);
                                const shortBitola = regexMatch ? regexMatch[1].toUpperCase() : bitolaStr.toUpperCase();

                                let drawTypeLabel = ferro.drawingType || 'RETO';
                                if (ferro.drawingType === 'Estribo') drawTypeLabel = 'ESTRIBO';
                                if (ferro.drawingType === 'CorteDobra') drawTypeLabel = 'CORTE E DOBRA';
                                if (ferro.drawingType === 'Trava') drawTypeLabel = 'TRAVA';
                                if (ferro.nomeElemento) drawTypeLabel = ferro.nomeElemento.toUpperCase();

                                let dims = [];
                                if (ferro.a || ferro.ladoA) dims.push(`A: ${ferro.a || ferro.ladoA}`);
                                if (ferro.b || ferro.ladoB) dims.push(`B: ${ferro.b || ferro.ladoB}`);
                                if (ferro.c || ferro.ladoC) dims.push(`C: ${ferro.c || ferro.ladoC}`);
                                if (ferro.d || ferro.ladoD) dims.push(`D: ${ferro.d || ferro.ladoD}`);
                                if (ferro.e || ferro.ladoE) dims.push(`E: ${ferro.e || ferro.ladoE}`);
                                const dimStr = dims.length > 0 ? ` (${dims.join(', ')})` : '';
                                const formatoDimensions = `${drawTypeLabel}${dimStr}`;

                                return (
                                    <div 
                                        key={idx}
                                        className="bg-white rounded-lg shadow-xl print:shadow-none print:rounded-none overflow-hidden flex flex-col"
                                        style={{
                                            padding: '20px',
                                            boxSizing: 'border-box',
                                            pageBreakAfter: 'always',
                                            minHeight: '100vh'
                                        }}
                                    >
                                        <div>
                                            {/* Header */}
                                            <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4 mb-4">
                                                <div className="flex flex-col items-start w-full">
                                                    <div className="flex justify-between w-full items-center mb-2">
                                                        <span className="text-xl font-black text-slate-800 bg-slate-100 px-4 py-2 rounded border border-slate-200">
                                                            {osNumber}
                                                        </span>
                                                        <div className="w-20 h-20 border-2 border-slate-200 flex flex-col items-center justify-center rounded bg-white shrink-0 p-1">
                                                            {activeBrandingPartner?.logoUrl ? (
                                                                <img src={activeBrandingPartner.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                                                            ) : (
                                                                <div className="text-[10px] font-bold text-slate-400 text-center uppercase">Logo Cliente</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <h1 className="text-2xl font-black text-slate-800 uppercase leading-tight mt-1">
                                                        {osName}
                                                    </h1>
                                                    <h2 className="text-sm font-bold text-slate-500 uppercase mt-1">
                                                        CLIENTE: {printingQuote?.cliente || printingMachineOrder.clientName || 'NÃO INFORMADO'}
                                                    </h2>
                                                    <h2 className="text-sm font-bold text-slate-500 uppercase mt-1">
                                                        ORDEM DE PRODUÇÃO: {printingMachineOrder.orderCode.toString().padStart(6, '0')}
                                                    </h2>
                                                </div>
                                            </div>

                                            {/* Details */}
                                            <div className="flex flex-col gap-3 mb-6">
                                                <div className="flex border-b border-slate-200 pb-2">
                                                    <div className="w-1/3 text-xs font-bold text-slate-400 uppercase">Quantidade</div>
                                                    <div className="w-2/3 text-xl font-black text-slate-800">
                                                        {cutQty}
                                                    </div>
                                                </div>
                                                <div className="flex border-b border-slate-200 pb-2 items-center">
                                                    <div className="w-1/3 text-xs font-bold text-slate-400 uppercase leading-tight pr-2">Nome do Elemento</div>
                                                    <div className="w-2/3 text-lg font-black text-slate-800 uppercase">
                                                        {formatoDimensions}
                                                    </div>
                                                </div>
                                                <div className="flex border-b border-slate-200 pb-2 items-center">
                                                    <div className="w-1/3 text-xs font-bold text-slate-400 uppercase">Formato</div>
                                                    <div className="w-2/3 flex flex-col items-start py-2">
                                                        <div className="w-full flex items-center justify-center shrink-0 border border-slate-200 rounded bg-white shadow-sm p-2 overflow-hidden" style={{ height: `${labelHeight}px` }}>
                                                            <div className="origin-center" style={{ transform: `scale(${labelScale})` }}>
                                                                {renderGaugeShape(ferro)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex border-b border-slate-200 pb-2">
                                                    <div className="w-1/3 text-xs font-bold text-slate-400 uppercase">Bitola</div>
                                                    <div className="w-2/3 text-base font-black text-slate-800">{shortBitola}</div>
                                                </div>
                                            </div>

                                            {/* Barcode Mock */}
                                            <div className="bg-slate-100 p-4 rounded-lg flex flex-col items-center justify-center mb-4 border border-slate-200 mt-8">
                                                <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest">Código de Rastreio</div>
                                                <div className="text-xl font-black text-slate-800 tracking-wider">
                                                    LOTE-{new Date().getFullYear()}-{printingMachineOrder.orderCode.toString().padStart(6, '0')}-{idx + 1}
                                                </div>
                                                <div className="h-16 w-full max-w-[250px] bg-black mt-3 opacity-80" style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 2px, white 2px, white 4px)' }}></div>
                                            </div>
                                        </div>

                                        {/* Footer */}
                                        <div className="flex justify-between items-end border-t border-slate-200 pt-4 mt-auto">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-black text-slate-800">ETIQUETA DE REGISTRO</span>
                                                <span className="text-[10px] text-slate-500">Uso interno na produção da máquina.</span>
                                            </div>
                                            <div className="text-[9px] text-slate-400 font-bold">
                                                GERADO EM {new Date().toLocaleDateString('pt-BR')}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Config Modal for Printing */}
                    {isLabelConfigOpen && (
                        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black bg-opacity-50 print:hidden">
                            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm">
                                <h3 className="text-xl font-bold text-slate-800 mb-4 border-b pb-2 flex items-center gap-2">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                    Configuração de Impressão
                                </h3>
                                
                                <div className="space-y-4 mb-6">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">
                                            Largura da Etiqueta (px)
                                        </label>
                                        <input type="number" value={labelWidth} onChange={(e) => setLabelWidth(Number(e.target.value))} className="w-full p-2 border rounded" min="200" max="1000" />
                                        <p className="text-xs text-slate-500 mt-1">Padrão: 448px</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">
                                            Escala do Desenho
                                        </label>
                                        <input type="number" step="0.1" value={labelScale} onChange={(e) => setLabelScale(Number(e.target.value))} className="w-full p-2 border rounded" min="0.5" max="10" />
                                        <p className="text-xs text-slate-500 mt-1">Padrão: 2.25</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">
                                            Altura da Caixa do Desenho (px)
                                        </label>
                                        <input type="number" value={labelHeight} onChange={(e) => setLabelHeight(Number(e.target.value))} className="w-full p-2 border rounded" min="50" max="1000" />
                                        <p className="text-xs text-slate-500 mt-1">Padrão: 320px</p>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2">
                                    <button onClick={() => { setLabelWidth(448); setLabelHeight(320); setLabelScale(2.25); }} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded font-bold">
                                        Resetar
                                    </button>
                                    <button onClick={() => setIsLabelConfigOpen(false)} className="px-4 py-2 bg-sky-600 text-white rounded font-bold hover:bg-sky-700">
                                        Salvar e Fechar
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                );
            })()}

        </div>
    );
};

export default MachineSchedule;
