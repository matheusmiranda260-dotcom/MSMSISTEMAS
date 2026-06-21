import React, { useState, useMemo, useEffect } from 'react';
import type { Partner, MachineOrder, ProductionOrderData, MachineConfig, User } from '../types';
import { fetchAllQuotesFromDB } from '../services/pointingSupabaseAdapter';

interface UnscheduledOrder {
    id: string;
    os: string;
    cliente: string;
    bitola: string;
    pesoTotal: number;
    status: string;
    data: string;
    quantidade: number;
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
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [selectedMachineName, setSelectedMachineName] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [pendingVisualSchedule, setPendingVisualSchedule] = useState<{
        quoteId: string,
        bitola: string,
        weight: number,
        metros: number,
        qty: number,
        osQty: number,
        clientName: string
    } | null>(null);

    useEffect(() => {
        const handlePendingVisual = (e: Event) => {
            const customEvent = e as CustomEvent;
            setPendingVisualSchedule(customEvent.detail);
        };
        window.addEventListener('pending_visual_schedule', handlePendingVisual);
        return () => window.removeEventListener('pending_visual_schedule', handlePendingVisual);
    }, []);

    const isMachineCompatibleWithBitola = (machineGaugeRange: string, bitolaStr: string) => {
        if (!machineGaugeRange) return true;
        const cleanMachineRange = machineGaugeRange.replace(/\s+/g, '').replace(',', '.');
        const bounds = cleanMachineRange.split('-');
        const min = parseFloat(bounds[0]) || 0;
        const max = bounds.length > 1 ? parseFloat(bounds[1]) : min;
        const bValue = parseFloat(bitolaStr.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
        return bValue >= min && bValue <= max;
    };

    const dates = useMemo(() => getNext7Days(), []);

    const [quotes, setQuotes] = useState<any[]>([]);

    useEffect(() => {
        const loadQuotes = async () => {
            try {
                const dbQuotes = await fetchAllQuotesFromDB();
                setQuotes(dbQuotes);
            } catch (e) {
                console.error('Failed to load quotes for schedule:', e);
            }
        };
        loadQuotes();
    }, []);

    // Load active machines from the active branding partner
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

    // Unscheduled Production Orders
    const unscheduledOrders = useMemo(() => {
        // Find quotes that are exported
        const activeQuotes = quotes.filter(q => q.status === 'Enviado p/ Produção');
        
        // Exclude ones that are already scheduled in MachineOrders
        const scheduledOrderCodes = new Set(machineOrders.map(mo => mo.orderCode));
        
        return activeQuotes.filter(q => {
            if (scheduledOrderCodes.has(q.id)) return false;
            if (searchTerm) {
                const search = searchTerm.toLowerCase();
                return q.id.toLowerCase().includes(search) || 
                       q.clientName.toLowerCase().includes(search);
            }
            return true;
        }).map(q => {
            const firstProduct = q.products?.[0];
            const firstFerro = firstProduct?.ferros?.[0];
            const bitolaStr = firstFerro?.bitola || firstProduct?.description || '';
            const peso = q.products?.reduce((sum: number, p: any) => sum + (p.weight || 0), 0) || 0;
            const qtd = q.products?.reduce((sum: number, p: any) => sum + (p.qty || 0), 0) || 0;
            return {
                id: q.id,
                os: q.id,
                cliente: q.clientName,
                bitola: bitolaStr,
                pesoTotal: peso,
                status: q.status,
                data: q.createdAt || new Date().toISOString(),
                quantidade: qtd,
            };
        });
    }, [quotes, machineOrders, searchTerm]);

    // Machine Orders for the selected date and machine
    const currentMachineOrders = useMemo(() => {
        if (!selectedMachineName || !selectedDate) return [];
        return machineOrders.filter(mo => 
            mo.machineId === selectedMachineName && 
            mo.startDate === selectedDate
        ).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }, [machineOrders, selectedMachineName, selectedDate]);

    const selectedMachineDetails = useMemo(() => {
        return activeMachines.find(m => m.name === selectedMachineName);
    }, [activeMachines, selectedMachineName]);

    // Calculate machine occupation for the selected day
    const machineDailyCapacity = useMemo(() => {
        if (!selectedMachineDetails) return 0;
        let hours = 8; // Default 1 shift
        if (selectedMachineDetails.shiftType === '2turnos') hours = 16;
        if (selectedMachineDetails.shiftType === 'continuo') hours = 24;
        return selectedMachineDetails.capacityKgPerHour * hours;
    }, [selectedMachineDetails]);

    const scheduledWeight = useMemo(() => {
        return currentMachineOrders.reduce((sum, mo) => sum + (mo.weight || 0), 0);
    }, [currentMachineOrders]);

    const occupationPercentage = machineDailyCapacity > 0 ? (scheduledWeight / machineDailyCapacity) * 100 : 0;

    const handleScheduleOrder = async (po: UnscheduledOrder) => {
        if (!selectedMachineName || !selectedDate) {
            showNotification('Selecione uma máquina e uma data primeiro.', 'error');
            return;
        }

        try {
            const newOrder: Partial<MachineOrder> = {
                clientName: po.cliente,
                machineId: selectedMachineName,
                gauge: po.bitola || '',
                quantity: po.quantidade || 0,
                quantityUnit: 'peças',
                startDate: selectedDate,
                endDate: selectedDate,
                status: 'scheduled',
                orderCode: po.os,
                osQuantity: po.quantidade,
                weight: po.pesoTotal,
                createdAt: new Date().toISOString()
            };
            await onAddMachineOrder(newOrder);
            showNotification(`OS ${po.os} agendada para ${formatDateBr(selectedDate)} em ${selectedMachineName}`, 'success');
        } catch (error) {
            console.error('Failed to schedule order', error);
            showNotification('Erro ao agendar a OS.', 'error');
        }
    };

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
                totalMetros: pendingVisualSchedule.metros,
                createdAt: new Date().toISOString()
            };
            await onAddMachineOrder(newOrder);
            showNotification(`Bitola ${pendingVisualSchedule.bitola} agendada para ${formatDateBr(dateStr)} em ${machineName}`, 'success');
            setPendingVisualSchedule(null);
        } catch (error) {
            console.error('Failed to schedule order visually', error);
            showNotification('Erro ao agendar.', 'error');
        }
    };

    const handleUnscheduleOrder = async (id: string) => {
        try {
            await onDeleteMachineOrder(id);
            showNotification('Agendamento removido.', 'success');
        } catch (error) {
            console.error('Failed to unschedule', error);
            showNotification('Erro ao remover o agendamento.', 'error');
        }
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] p-2 md:p-4 animate-fadeIn">
            <div className="w-full mx-auto space-y-4">
                
                {/* Header */}
                <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight font-sans">
                            Cronograma de Máquinas
                        </h1>
                        <p className="text-slate-500 text-sm mt-1">
                            Arraste ou selecione as Ordens de Serviço pendentes para a fila de produção de cada máquina.
                        </p>
                    </div>
                </header>

                <div className="flex flex-col gap-6">
                    {/* Top Section: Schedule Matrix */}
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col h-[60vh] overflow-hidden relative">
                        {pendingVisualSchedule && (
                            <div className="absolute top-0 left-0 right-0 z-50 bg-blue-600 text-white p-3 px-6 shadow-lg flex items-center justify-between animate-fadeIn">
                                <div>
                                    <h3 className="font-bold text-sm">📌 Modo de Agendamento</h3>
                                    <p className="text-xs text-blue-100">
                                        Clique em uma célula verde abaixo para agendar a OP <strong>{pendingVisualSchedule.quoteId}</strong> ({pendingVisualSchedule.clientName}) - Bitola <strong>{pendingVisualSchedule.bitola.replace(/VERGALHAO CA\d+\(ARMADO-AMARRADO\)\s*/i, '').trim()}</strong> ({pendingVisualSchedule.weight.toFixed(2)} kg).
                                    </p>
                                </div>
                                <button 
                                    onClick={() => setPendingVisualSchedule(null)}
                                    className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                                >
                                    Cancelar
                                </button>
                            </div>
                        )}
                        <div className="flex-1 overflow-auto p-4 bg-slate-50 relative">
                            {activeMachines.length === 0 ? (
                                <div className="text-center py-20 text-slate-400 font-semibold">
                                    Nenhuma máquina cadastrada no parceiro ativo. Configure em Parceiros.
                                </div>
                            ) : (
                                <div className="min-w-max">
                                    <table className="w-full border-collapse bg-white shadow-sm rounded-lg overflow-hidden">
                                        <thead className="bg-slate-100 text-slate-700 text-xs uppercase font-black sticky top-0 z-20 shadow-sm">
                                            <tr>
                                                <th className="p-3 border-r border-b border-slate-200 w-32 bg-slate-200 sticky left-0 z-30">Dias</th>
                                                {activeMachines.map(machine => (
                                                    <th key={machine.name} className="p-3 border-b border-r border-slate-200 text-center">
                                                        {machine.name}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {dates.map((dateStr, dIdx) => (
                                                <tr key={dateStr} className="border-b border-slate-200">
                                                    <td className="p-3 border-r border-slate-200 bg-slate-50 font-bold text-slate-700 uppercase text-[10px] text-center sticky left-0 z-10 w-32 shadow-[1px_0_0_0_#e2e8f0]">
                                                        {dIdx === 0 ? 'Hoje' : getDayOfWeek(dateStr)}<br/>
                                                        <span className="text-slate-400 font-normal">{dateStr.split('-').reverse().join('/')}</span>
                                                    </td>
                                                    {activeMachines.map(machine => {
                                                        const cellOrders = machineOrders.filter(mo => mo.startDate === dateStr && mo.machineId === machine.name).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                                                        const isScheduling = !!pendingVisualSchedule;
                                                        const isCompatible = isScheduling ? isMachineCompatibleWithBitola(machine.gaugeRange, pendingVisualSchedule.bitola) : true;
                                                        
                                                        return (
                                                            <td 
                                                                key={machine.name} 
                                                                onClick={() => {
                                                                    if (isScheduling && isCompatible) {
                                                                        handleVisualScheduleClick(dateStr, machine.name);
                                                                    }
                                                                }}
                                                                className={`p-2 border-r border-slate-200 align-top min-w-[350px] transition-colors ${
                                                                    isScheduling 
                                                                        ? isCompatible 
                                                                            ? 'cursor-pointer hover:bg-green-50 border-2 hover:border-green-400 bg-white shadow-inner' 
                                                                            : 'bg-slate-100 opacity-50 cursor-not-allowed'
                                                                        : ''
                                                                }`}
                                                            >
                                                                {cellOrders.length === 0 ? (
                                                                    <div className={`text-center text-xs py-4 ${isScheduling && isCompatible ? 'text-green-600 font-bold' : 'text-slate-300'}`}>
                                                                        {isScheduling && isCompatible ? '+ Agendar Aqui' : 'Livre'}
                                                                    </div>
                                                                ) : (
                                                                    <div className="space-y-2">
                                                                        <table className="w-full text-[10px] border border-slate-200 text-slate-700">
                                                                            <thead className="bg-slate-100 border-b border-slate-200">
                                                                                <tr>
                                                                                    <th className="p-1 border-r border-slate-200 text-center font-bold">OP</th>
                                                                                    <th className="p-1 border-r border-slate-200 text-left font-bold">CLIENTE</th>
                                                                                    <th className="p-1 border-r border-slate-200 text-center font-bold">BITOLA</th>
                                                                                    <th className="p-1 border-r border-slate-200 text-center font-bold">QNT OS</th>
                                                                                    <th className="p-1 text-center border-r border-slate-200 font-bold">METROS</th>
                                                                                    <th className="w-6"></th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody>
                                                                                {cellOrders.map(mo => (
                                                                                    <tr key={mo.id} className="border-b border-slate-100 hover:bg-slate-50">
                                                                                        <td className="p-1 border-r border-slate-200 text-center font-bold text-blue-700">{mo.orderCode}</td>
                                                                                        <td className="p-1 border-r border-slate-200 font-semibold truncate max-w-[120px]" title={mo.clientName}>{mo.clientName}</td>
                                                                                        <td className="p-1 border-r border-slate-200 text-center font-bold text-slate-800">{mo.gauge.replace(/VERGALHAO CA\d+\(ARMADO-AMARRADO\)\s*/i, '').trim()}</td>
                                                                                        <td className="p-1 border-r border-slate-200 text-center font-bold">{mo.osQuantity || 1}</td>
                                                                                        <td className="p-1 border-r border-slate-200 text-center text-sky-700 font-bold">{(mo.totalMetros || 0).toFixed(1)}</td>
                                                                                        <td className="p-1 text-center">
                                                                                            <button 
                                                                                                onClick={() => handleUnscheduleOrder(mo.id)}
                                                                                                className="text-red-400 hover:text-red-600"
                                                                                                title="Remover"
                                                                                            >
                                                                                                🗑️
                                                                                            </button>
                                                                                        </td>
                                                                                    </tr>
                                                                                ))}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Bottom Section: Unscheduled Orders */}
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col h-[30vh]">
                        <div className="p-4 border-b border-slate-200 bg-slate-50 rounded-t-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">Ordens Disponíveis</h2>
                                <p className="text-xs text-slate-500">Orçamentos / OS prontas para agendar</p>
                            </div>
                            <input
                                type="text"
                                placeholder="Buscar por OP, Cliente, Projeto..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full sm:w-64 p-2 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div className="p-4 overflow-x-auto overflow-y-hidden flex gap-4 bg-slate-50 items-start h-full scrollbar-thin">
                            {unscheduledOrders.length === 0 ? (
                                <div className="text-center w-full py-10 text-slate-400 text-sm font-semibold">
                                    Nenhuma OS pendente no momento.
                                </div>
                            ) : (
                                unscheduledOrders.map(po => (
                                    <div key={po.id} className="min-w-[280px] bg-white border border-slate-200 rounded-xl p-3 shadow-sm hover:shadow transition-shadow flex flex-col flex-shrink-0">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <span className="text-xs font-black bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                                                    OP: {po.os}
                                                </span>
                                                <h3 className="text-sm font-bold text-slate-800 mt-1 truncate max-w-[150px]" title={po.cliente}>{po.cliente}</h3>
                                            </div>
                                            <div className="flex flex-col gap-1 items-end">
                                                <button 
                                                    onClick={() => {
                                                        sessionStorage.setItem('pending_print_action', JSON.stringify({ type: 'print_corte', quoteId: po.id }));
                                                        sessionStorage.setItem('return_to_after_print', 'machineSchedule');
                                                        window.dispatchEvent(new Event('navigate_to_pointing'));
                                                    }}
                                                    className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors"
                                                >
                                                    Agendar ➔
                                                </button>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 mt-2 text-[10px] text-slate-600">
                                            <div><span className="font-bold text-slate-400">Bitola:</span> {po.bitola.replace(/VERGALHAO CA\d+\(ARMADO-AMARRADO\)\s*/i, '').trim()}</div>
                                            <div><span className="font-bold text-slate-400">Peso:</span> {po.pesoTotal?.toFixed(2)} kg</div>
                                            <div><span className="font-bold text-slate-400">Status:</span> {po.status}</div>
                                            <div><span className="font-bold text-slate-400">Data:</span> {formatDateBr(po.data.split('T')[0])}</div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default MachineSchedule;
