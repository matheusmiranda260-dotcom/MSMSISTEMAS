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
        <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8 animate-fadeIn">
            <div className="max-w-7xl mx-auto space-y-6">
                
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

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left Column: Unscheduled Orders */}
                    <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col h-[calc(100vh-180px)]">
                        <div className="p-4 border-b border-slate-200 bg-slate-50 rounded-t-2xl">
                            <h2 className="text-lg font-bold text-slate-800">Ordens Disponíveis</h2>
                            <p className="text-xs text-slate-500 mb-3">Orçamentos / OS prontas para agendar</p>
                            <input
                                type="text"
                                placeholder="Buscar por OP, Cliente, Projeto..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full p-2 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div className="p-4 overflow-y-auto flex-1 space-y-3 bg-slate-50">
                            {unscheduledOrders.length === 0 ? (
                                <div className="text-center py-10 text-slate-400 text-sm font-semibold">
                                    Nenhuma OS pendente no momento.
                                </div>
                            ) : (
                                unscheduledOrders.map(po => (
                                    <div key={po.id} className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm hover:shadow transition-shadow">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <span className="text-xs font-black bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                                                    OP: {po.os}
                                                </span>
                                                <h3 className="text-sm font-bold text-slate-800 mt-1">{po.cliente}</h3>
                                            </div>
                                            <div className="flex flex-col gap-1 items-end">
                                                <button 
                                                    onClick={() => handleScheduleOrder(po)}
                                                    className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors"
                                                >
                                                    Agendar ➔
                                                </button>
                                                <div className="flex gap-1 mt-1">
                                                    <button 
                                                        onClick={() => {
                                                            sessionStorage.setItem('pending_print_action', JSON.stringify({ type: 'print_corte', quoteId: po.id }));
                                                            window.dispatchEvent(new Event('navigate_to_pointing'));
                                                        }}
                                                        className="bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-600 p-1.5 rounded-lg text-xs"
                                                        title="Imprimir Plano de Corte"
                                                    >
                                                        ✂️
                                                    </button>
                                                    <button 
                                                        onClick={() => {
                                                            sessionStorage.setItem('pending_print_action', JSON.stringify({ type: 'print_etiqueta_maquina', quoteId: po.id }));
                                                            window.dispatchEvent(new Event('navigate_to_pointing'));
                                                        }}
                                                        className="bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-600 p-1.5 rounded-lg text-xs"
                                                        title="Imprimir Etiqueta Produção"
                                                    >
                                                        🏷️
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-slate-600">
                                            <div><span className="font-bold text-slate-400">Bitola:</span> {po.bitola}</div>
                                            <div><span className="font-bold text-slate-400">Peso:</span> {po.pesoTotal?.toFixed(2)} kg</div>
                                            <div><span className="font-bold text-slate-400">Status:</span> {po.status}</div>
                                            <div><span className="font-bold text-slate-400">Data:</span> {formatDateBr(po.data.split('T')[0])}</div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Right Column: Schedule Board */}
                    <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col h-[calc(100vh-180px)]">
                        {/* Board Controls */}
                        <div className="p-4 border-b border-slate-200 flex flex-col gap-4">
                            {/* Dates selector */}
                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                {dates.map(dateStr => {
                                    const isSelected = selectedDate === dateStr;
                                    const isToday = dateStr === dates[0];
                                    return (
                                        <button
                                            key={dateStr}
                                            onClick={() => setSelectedDate(dateStr)}
                                            className={`flex-shrink-0 flex flex-col items-center justify-center min-w-[70px] h-16 rounded-xl border transition-all ${
                                                isSelected 
                                                ? 'bg-blue-600 border-blue-600 text-white shadow-md' 
                                                : isToday
                                                    ? 'bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100'
                                                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                            }`}
                                        >
                                            <span className="text-[10px] font-black uppercase tracking-wider">{isToday ? 'Hoje' : getDayOfWeek(dateStr)}</span>
                                            <span className="text-lg font-bold">{dateStr.split('-')[2]}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Machine Selector */}
                            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                {activeMachines.length === 0 ? (
                                    <div className="text-sm text-amber-600 font-semibold bg-amber-50 px-4 py-2 rounded-lg">
                                        Nenhuma máquina cadastrada no parceiro ativo. Configure em Parceiros.
                                    </div>
                                ) : (
                                    activeMachines.map(machine => {
                                        const isSelected = selectedMachineName === machine.name;
                                        return (
                                            <button
                                                key={machine.name}
                                                onClick={() => setSelectedMachineName(machine.name)}
                                                className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-all border ${
                                                    isSelected
                                                    ? 'bg-slate-800 text-white border-slate-800 shadow-md'
                                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                                                }`}
                                            >
                                                {machine.name}
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* Schedule List for Machine + Date */}
                        <div className="flex-1 overflow-y-auto p-4 bg-slate-50 relative">
                            {selectedMachineDetails && (
                                <div className="mb-4 bg-white border border-slate-200 rounded-xl p-4 flex justify-between items-center shadow-sm">
                                    <div>
                                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                                            Resumo do Dia - {selectedMachineDetails.name}
                                        </h3>
                                        <div className="text-xs text-slate-500 mt-1 font-semibold flex items-center gap-4">
                                            <span>Turno: {selectedMachineDetails.shiftType}</span>
                                            <span>Capacidade: {selectedMachineDetails.capacityKgPerHour} kg/h</span>
                                            <span>Máx Diário: {machineDailyCapacity} kg</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-2xl font-black text-slate-800">
                                            {scheduledWeight.toFixed(0)} <span className="text-sm text-slate-500 font-bold">kg agendados</span>
                                        </div>
                                        <div className="w-32 h-2 bg-slate-200 rounded-full mt-1 overflow-hidden ml-auto">
                                            <div 
                                                className={`h-full rounded-full ${occupationPercentage > 100 ? 'bg-red-500' : occupationPercentage > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                                style={{ width: `${Math.min(occupationPercentage, 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-3">
                                {currentMachineOrders.length === 0 ? (
                                    <div className="text-center py-20 text-slate-400 font-semibold">
                                        <div className="text-4xl mb-2">🏭</div>
                                        Fila de produção vazia para {selectedMachineName} no dia {formatDateBr(selectedDate)}.
                                    </div>
                                ) : (
                                    currentMachineOrders.map((mo, index) => (
                                        <div key={mo.id} className="bg-white border-l-4 border-blue-600 rounded-r-xl rounded-l-md p-4 shadow-sm flex items-center justify-between group">
                                            <div className="flex items-center gap-4">
                                                <div className="text-2xl font-black text-slate-200 w-8 text-right">
                                                    {index + 1}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-black bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                                                            OP: {mo.orderCode}
                                                        </span>
                                                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                                            mo.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                                                            mo.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                                                            'bg-amber-100 text-amber-700'
                                                        }`}>
                                                            {mo.status === 'scheduled' ? 'Agendado' : mo.status === 'in_progress' ? 'Rodando' : 'Concluído'}
                                                        </span>
                                                    </div>
                                                    <h4 className="text-sm font-bold text-slate-800 mt-1">{mo.clientName}</h4>
                                                    <div className="text-xs font-semibold text-slate-500 mt-0.5">
                                                        Bitola: {mo.gauge} • Peso: {mo.weight?.toFixed(2)} kg
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleUnscheduleOrder(mo.id)}
                                                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Remover da programação"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default MachineSchedule;
