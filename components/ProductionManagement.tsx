import React, { useState, useEffect } from 'react';
import type { Page, Customer, CommercialOrder, User, Partner } from '../types';
import { insertItem, deleteItem, updateItem } from '../services/supabaseService';
import { OrderItemsEditor } from './OrderItemsEditor';
import { OrderPrintView } from './OrderPrintView';

import { supabase } from '../supabaseClient';

const ActiveTimer = ({ startTime }: { startTime: string }) => {
    const [elapsed, setElapsed] = React.useState('');

    React.useEffect(() => {
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

    return <span className="font-mono text-sm font-black tracking-wider text-slate-700 tabular-nums">{elapsed || '00:00:00'}</span>;
};


const calculateTotalMachineHours = (machine: any) => {
    let totalMinutes = 0;
    const parseTime = (t: string) => {
        if (!t) return null;
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
    };

    if (machine.shift1Start && machine.shift1End) {
        const start = parseTime(machine.shift1Start);
        const end = parseTime(machine.shift1End);
        if (start !== null && end !== null) {
            let dur = end - start;
            if (dur < 0) dur += 24 * 60;
            totalMinutes += dur;
        }
    }

    if (machine.shiftType === '2turnos' && machine.shift2Start && machine.shift2End) {
        const start = parseTime(machine.shift2Start);
        const end = parseTime(machine.shift2End);
        if (start !== null && end !== null) {
            let dur = end - start;
            if (dur < 0) dur += 24 * 60;
            totalMinutes += dur;
        }
    }

    if (machine.hasLunchBreak && machine.lunchStart && machine.lunchEnd) {
        const start = parseTime(machine.lunchStart);
        const end = parseTime(machine.lunchEnd);
        if (start !== null && end !== null) {
            let dur = end - start;
            if (dur < 0) dur += 24 * 60;
            totalMinutes -= dur;
        }
    }

    if (totalMinutes <= 0) return '0h';
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h${minutes.toString().padStart(2, '0')}`;
};

const getOrderColor = (orderNumber: string) => {
    if (!orderNumber) return { bg: 'bg-emerald-50/95', border: 'border-emerald-200', text: 'text-emerald-800', titleText: 'text-emerald-900', titleBorder: 'border-emerald-100', timeBg: 'bg-emerald-100/50', timeText: 'text-emerald-700' };
    const baseNum = orderNumber.split('-')[0];
    const palettes = [
        { bg: 'bg-emerald-50/95', border: 'border-emerald-200', text: 'text-emerald-800', titleText: 'text-emerald-900', titleBorder: 'border-emerald-100', timeBg: 'bg-emerald-100/50', timeText: 'text-emerald-700' },
        { bg: 'bg-blue-50/95', border: 'border-blue-200', text: 'text-blue-800', titleText: 'text-blue-900', titleBorder: 'border-blue-100', timeBg: 'bg-blue-100/50', timeText: 'text-blue-700' },
        { bg: 'bg-purple-50/95', border: 'border-purple-200', text: 'text-purple-800', titleText: 'text-purple-900', titleBorder: 'border-purple-100', timeBg: 'bg-purple-100/50', timeText: 'text-purple-700' },
        { bg: 'bg-amber-50/95', border: 'border-amber-200', text: 'text-amber-800', titleText: 'text-amber-900', titleBorder: 'border-amber-100', timeBg: 'bg-amber-100/50', timeText: 'text-amber-700' },
        { bg: 'bg-rose-50/95', border: 'border-rose-200', text: 'text-rose-800', titleText: 'text-rose-900', titleBorder: 'border-rose-100', timeBg: 'bg-rose-100/50', timeText: 'text-rose-700' }
    ];
    let hash = 0;
    for (let i = 0; i < baseNum.length; i++) {
        hash = baseNum.charCodeAt(i) + ((hash << 5) - hash);
    }
    return palettes[Math.abs(hash) % palettes.length];
};

const formatMachineTime = (decimalHours: number) => {
    const totalSeconds = Math.round(decimalHours * 3600);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    
    let parts = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0 || h > 0) parts.push(`${m.toString().padStart(2, '0')}m`);
    parts.push(`${s.toString().padStart(2, '0')}s`);
    
    return parts.join(' ');
};

interface OrderManagementProps {
    setPage: (page: Page) => void;
    customers: Customer[];
    commercialOrders: CommercialOrder[];
    currentUser: User | null;
    activeBrandingPartner?: Partner | null;
    users?: User[];
    productionOrders?: any[]; // Realtime orders from App.tsx
}

export const ProductionManagement: React.FC<OrderManagementProps> = ({ setPage, customers, commercialOrders, currentUser, activeBrandingPartner, users, productionOrders }) => {
    const [search, setSearch] = useState('');
    const [orderBy, setOrderBy] = useState<'id' | 'clientCode'>('id');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState<CommercialOrder | null>(null);
    const [printingOrder, setPrintingOrder] = useState<CommercialOrder | null>(null);
    const [programmedOrders, setProgrammedOrders] = useState<any[]>([]);
    // Use realtime orders from App.tsx if available, fall back to local polling
    const [localProgrammedOrders, setLocalProgrammedOrders] = useState<any[]>([]);
    // localProgrammedOrders is always fresh (polled every 3s), use it as primary
    const allProgrammedOrders = localProgrammedOrders.length > 0 
        ? localProgrammedOrders 
        : (productionOrders || []);
    
    // View Project Modal
    const [isViewProjectModalOpen, setIsViewProjectModalOpen] = useState(false);
    const [orderToView, setOrderToView] = useState<CommercialOrder | null>(null);
    const [viewMode, setViewMode] = useState<'detalhado' | 'resumo'>('detalhado');

    // Modal Programar Maquina variables (moved to top for useEffect dependencies)
    const [isProgramModalOpen, setIsProgramModalOpen] = useState(false);
    const [programData, setProgramData] = useState<{bitola: string, peso: number, orderNum: string, quantity: number, compM?: number} | null>(null);
    const [weekOffset, setWeekOffset] = useState(0);
    const [showSaturday, setShowSaturday] = useState(true);
    const [selectedDay, setSelectedDay] = useState<number | null>(null);

    useEffect(() => {
        if (!orderToView) {
            setProgrammedOrders([]);
            return;
        }
        const fetchProgrammed = async () => {
            try {
                const { data, error } = await supabase
                    .from('production_orders')
                    .select('id, target_bitola, creation_date, machine')
                    .eq('related_commercial_order_id', orderToView.id);
                if (data && !error) {
                    setProgrammedOrders(data);
                }
            } catch (e) { console.error(e); }
        };
        fetchProgrammed();
    }, [orderToView, isViewProjectModalOpen, isProgramModalOpen]);

    // Form fields for New Order
    const [clientSearchTerm, setClientSearchTerm] = useState('');
    const [selectedClient, setSelectedClient] = useState<Customer | null>(null);
    const [newId, setNewId] = useState('');
    const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
    const [newSalesperson, setNewSalesperson] = useState('');
    const [newPrice, setNewPrice] = useState('');
    const [newStatus, setNewStatus] = useState('Em Produção');
    const [searchError, setSearchError] = useState('');
    const [newObservations, setNewObservations] = useState('');
    
    const [isAuthorizeModalOpen, setIsAuthorizeModalOpen] = useState(false);
    const [orderToAuthorize, setOrderToAuthorize] = useState<CommercialOrder | null>(null);
    const [isMachinesModalOpen, setIsMachinesModalOpen] = useState(false);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [dailyShifts, setDailyShifts] = useState<any[]>([]);
    const [selectedMachineTab, setSelectedMachineTab] = useState<string>('');
    const [machineSearchQuery, setMachineSearchQuery] = useState('');
    const [authorizeDate, setAuthorizeDate] = useState('');
    const [authorizeTime, setAuthorizeTime] = useState('');

    // Live users state - polls DB directly every 3s when modal open (bypasses Realtime issues)
    const [liveUsers, setLiveUsers] = useState<User[]>(users || []);
    useEffect(() => {
        // Sync from parent Realtime users when they update
        if (users && users.length > 0) setLiveUsers(users);
    }, [users]);
    useEffect(() => {
        if (!isMachinesModalOpen) return;
        const fetchUsers = async () => {
            try {
                const { data } = await supabase
                    .from('app_users')
                    .select('id, username, role, assigned_machines, is_online, current_shift_start');
                if (data) {
                    const mapped = data.map((u: any) => ({
                        id: u.id,
                        username: u.username,
                        role: u.role,
                        assignedMachines: (() => {
                            try {
                                if (typeof u.assigned_machines === 'string') return JSON.parse(u.assigned_machines);
                                if (Array.isArray(u.assigned_machines)) return u.assigned_machines;
                                return [u.assigned_machines].filter(Boolean);
                            } catch (e) {
                                return [u.assigned_machines].filter(Boolean);
                            }
                        })(),
                        isOnline: u.is_online || false,
                        current_shift_start: u.current_shift_start
                    })) as User[];
                    setLiveUsers(mapped);
                }
            } catch(e) {}
        };
        fetchUsers();
        const interval = setInterval(fetchUsers, 3000);
        return () => clearInterval(interval);
    }, [isMachinesModalOpen]);

    const [currentMachineStop, setCurrentMachineStop] = useState<any>(null);
    useEffect(() => {
        if (!isMachinesModalOpen || !selectedMachineTab) return;
        const fetchStops = async () => {
            try {
                const { data } = await supabase
                    .from('machine_stops')
                    .select('*')
                    .eq('machine', selectedMachineTab)
                    .is('end_time', null)
                    .limit(1);
                setCurrentMachineStop(data && data.length > 0 ? data[0] : null);
            } catch(e) {}
        };
        fetchStops();
        const interval = setInterval(fetchStops, 3000);
        return () => clearInterval(interval);
    }, [isMachinesModalOpen, selectedMachineTab]);

    const [machineStops, setMachineStops] = useState<any[]>([]);
    
    // Fetch shifts and stops for the daily report
    useEffect(() => {
        if (!isReportModalOpen || !selectedMachineTab) return;
        
        const fetchData = async () => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const { data: shifts } = await supabase
                .from('operator_shifts')
                .select('*')
                .eq('machine', selectedMachineTab)
                .gte('start_time', today.toISOString())
                .order('start_time', { ascending: false });
                
            if (shifts) setDailyShifts(shifts);
            
            const { data: stops } = await supabase
                .from('machine_stops')
                .select('*')
                .eq('machine', selectedMachineTab)
                .gte('start_time', today.toISOString())
                .order('start_time', { ascending: false });
                
            if (stops) setMachineStops(stops);
        };
        
        fetchData();
        const interval = setInterval(fetchData, 10000); // refresh every 10s while open
        return () => clearInterval(interval);
    }, [isReportModalOpen, selectedMachineTab]);

    // Always poll production orders when machines modal is open (guarantees fresh data)
    useEffect(() => {
        const fetchAll = async () => {
            try {
                const { data } = await supabase.from('production_orders')
                    .select('id, machine, creation_date, total_weight, total_meters, target_bitola, status, order_number, quantity_os, related_commercial_order_id, start_time, end_time, sub_items_progress')
                    .in('status', ['pending', 'in_progress', 'producing', 'completed']);
                if (data) setLocalProgrammedOrders(data);
            } catch(e) {}
        };
        fetchAll();
        const interval = setInterval(fetchAll, 3000);
        return () => clearInterval(interval);
    }, [isProgramModalOpen, isViewProjectModalOpen, isMachinesModalOpen]);

    const [isFinishReadingModalOpen, setIsFinishReadingModalOpen] = useState(false);
    const [orderToFinishReading, setOrderToFinishReading] = useState<CommercialOrder | null>(null);
    const [jsonContent, setJsonContent] = useState('');

    const [programMachine, setProgramMachine] = useState('Trefila 1');
    const [programOrderNumber, setProgramOrderNumber] = useState('');
    const [programWeight, setProgramWeight] = useState('');
    const [programBitolaOriginal, setProgramBitolaOriginal] = useState('');

    const getWorkingDays = () => {
        const days = [];
        const today = new Date();
        const dayOfWeek = today.getDay();
        const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        
        const monday = new Date(today);
        monday.setDate(today.getDate() + diffToMonday + (weekOffset * 7));
        
        const dayNames = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        
        if (selectedDay !== null) {
            const d = new Date(monday);
            d.setDate(monday.getDate() + selectedDay);
            days.push({
                date: d.toISOString().split('T')[0],
                name: dayNames[selectedDay],
                shortDate: `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`
            });
            return days;
        }

        const numDays = showSaturday ? 6 : 5;
        
        for (let i = 0; i < numDays; i++) {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            days.push({
                date: d.toISOString().split('T')[0],
                name: dayNames[i],
                shortDate: `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`
            });
        }
        return days;
    };

    const handleProgramMachine = async (dateStr: string, machineName: string) => {
        if (!programData || !orderToView) return;
        if (!programOrderNumber.trim() || !programWeight) {
            alert('Preencha os campos obrigatórios.');
            return;
        }

        const newOrder = {
            orderNumber: programOrderNumber.trim(),
            machine: machineName,
            targetBitola: programData.bitola,
            selectedLotIds: [],
            totalWeight: parseFloat(programWeight.toString().replace(',','.')),
            totalMeters: parseFloat(programData.compM?.toString().replace(',','.') || '0'),
            isGhostOrder: true,
            inputBitola: '',
            status: 'pending',
            creationDate: dateStr + 'T12:00:00Z',
            relatedCommercialOrderId: orderToView.id,
            quantityOs: programData.quantity
        };

        try {
            await insertItem('production_orders', newOrder as any);
            alert(`Máquina ${machineName} programada para o dia ${dateStr.split('-').reverse().join('/')} com sucesso!`);
            setIsProgramModalOpen(false);
        } catch (error: any) {
            console.error('Erro ao programar máquina:', error);
            alert(`Erro ao programar máquina: ${error?.message || JSON.stringify(error)}`);
        }
    };

    const handleLiberarOS = async (commercialOrderId: string, machine: string) => {
        try {
            // Update production orders for this machine
            await supabase
                .from('production_orders')
                .update({ status: 'in_progress' })
                .eq('related_commercial_order_id', commercialOrderId)
                .eq('machine', machine);
                
            // Update local state to reflect change immediately without page reload
            setLocalProgrammedOrders(prev => prev.map(po => 
                (po.related_commercial_order_id === commercialOrderId && po.machine === machine)
                ? { ...po, status: 'in_progress' }
                : po
            ));

            // Refetch to see if we still have pending ones
            const { data: remainingPending } = await supabase
                .from('production_orders')
                .select('id')
                .eq('related_commercial_order_id', commercialOrderId)
                .eq('status', 'pending')
                .limit(1);
                
            if (!remainingPending || remainingPending.length === 0) {
                // all released, update commercial order status to 'Em Produção'
                await updateItem('commercial_orders', commercialOrderId, { status: 'Em Produção' });
            }
            
            alert(`O.S. enviadas para a máquina ${machine} com sucesso!`);
        } catch (e) {
            console.error('Erro ao liberar O.S.:', e);
            alert('Erro ao liberar O.S.');
        }
    };

    const handleStartProduction = async (osId: string) => {
        try {
            const startTime = new Date().toISOString();
            await supabase
                .from('production_orders')
                .update({ status: 'producing', start_time: startTime })
                .eq('id', osId);
                
            setLocalProgrammedOrders(prev => prev.map(po => 
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
                
            setLocalProgrammedOrders(prev => prev.map(po => 
                po.id === osId ? { ...po, status: 'completed', end_time: endTime } : po
            ));
        } catch (e) {
            console.error('Erro ao finalizar produção:', e);
            alert('Erro ao finalizar produção.');
        }
    };

    const handleSearchClient = () => {
        setSearchError('');
        if (!clientSearchTerm.trim()) {
            setSearchError('Digite algo para buscar.');
            return;
        }

        const term = clientSearchTerm.toLowerCase().trim();
        
        // Tratar caso especial do consumidor balcão
        if (term === '1001' || term === 'consumidor balcao' || term === 'consumidor balcão') {
            setSelectedClient({
                id: '1001',
                code: '1001',
                name: 'CONSUMIDOR BALCAO',
                customerType: 'Pessoa Física',
                document1: '000.000.000-00',
                document2: '',
                phone: '',
                email: '',
                addressMain: '',
                addressDelivery: '',
                addressBilling: '',
                createdAt: new Date().toISOString()
            });
            return;
        }

        const found = customers.find(c => 
            (c.code && c.code.toLowerCase() === term) ||
            (c.name && c.name.toLowerCase().includes(term)) ||
            (c.document1 && c.document1.replace(/\D/g, '') === term.replace(/\D/g, '')) ||
            (c.document2 && c.document2.toLowerCase().includes(term))
        );

        if (found) {
            setSelectedClient(found);
        } else {
            setSelectedClient(null);
            setSearchError('Cliente não encontrado.');
        }
    };

    const handleCreateOrder = async () => {
        if (!selectedClient) {
            setSearchError('Selecione um cliente primeiro.');
            return;
        }

        // Encontrar o maior número de pedido atual
        const maxId = commercialOrders.reduce((max, q) => {
            const num = parseInt(q.orderNumber, 10);
            return isNaN(num) ? max : Math.max(max, num);
        }, 0);
        const nextId = String(maxId + 1).padStart(7, '0');

        // Formatar data de hoje para o banco (YYYY-MM-DD)
        const today = new Date().toISOString().split('T')[0];

        const newQuote = {
            orderNumber: nextId,
            date: today,
            salesperson: (currentUser?.name || currentUser?.username || 'SISTEMA').toUpperCase(),
            clientCode: selectedClient.code || '1001',
            clientName: selectedClient.name,
            clientCity: selectedClient.addressMain || '',
            clientObs: newObservations.trim() ? `OBS: ${newObservations.trim()}` : '',
            price: 0.00,
            status: 'Orçamento',
            history: [{
                date: new Date().toISOString(),
                user: (currentUser?.name || currentUser?.username || 'SISTEMA').toUpperCase(),
                action: 'Orçamento iniciado'
            }]
        };

        try {
            await insertItem<CommercialOrder>('commercial_orders', newQuote);
        } catch (error) {
            console.error("Erro ao criar orçamento:", error);
            setSearchError("Erro ao criar orçamento. Tente novamente.");
            return;
        }
        
        // Reset states and close
        setIsAddModalOpen(false);
        setSearch('');
        setSelectedClient(null);
        setSearchError('');
        setNewObservations('');
    };

    const handleDeleteOrder = async (id: string) => {
        if (window.confirm('Tem certeza que deseja excluir este pedido?')) {
            try {
                await deleteItem('commercial_orders', id);
            } catch (error) {
                console.error('Erro ao excluir pedido:', error);
                alert('Erro ao excluir pedido.');
            }
        }
    };

    const handleApproveOrder = async () => {
        if (!orderToAuthorize) return;
        if (!authorizeDate || !authorizeTime) {
            alert('Por favor, informe a data e hora do término da leitura.');
            return;
        }
        
        const [year, month, day] = authorizeDate.split('-');
        const deadline = `${day}/${month}/${year} às ${authorizeTime}`;

        // Get current date/time for startedAt
        const now = new Date();
        const startedAt = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth()+1).toString().padStart(2, '0')}/${now.getFullYear()} às ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        try {
            await updateItem('commercial_orders', orderToAuthorize.id!, { 
                status: 'Em processo de leitura',
                engineeringDeadline: deadline,
                readingStartedAt: startedAt
            });
            setIsAuthorizeModalOpen(false);
            setOrderToAuthorize(null);
            setAuthorizeDate('');
            setAuthorizeTime('');
        } catch (error) {
            console.error('Erro ao autorizar pedido:', error);
            alert('Erro ao autorizar pedido.');
        }
    };

    const handleFinishReading = async () => {
        if (!orderToFinishReading) return;
        if (!jsonContent.trim()) {
            alert('Por favor, cole o conteúdo JSON do projeto.');
            return;
        }

        let parsedData;
        try {
            parsedData = JSON.parse(jsonContent);
        } catch (e) {
            alert('JSON inválido. Por favor, verifique o conteúdo.');
            return;
        }

        const now = new Date();
        const finishedAt = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth()+1).toString().padStart(2, '0')}/${now.getFullYear()} às ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        try {
            await updateItem('commercial_orders', orderToFinishReading.id!, { 
                status: 'Leitura Finalizada, aguardo setor de produção',
                projectData: parsedData,
                readingFinishedAt: finishedAt
            });
            setIsFinishReadingModalOpen(false);
            setOrderToFinishReading(null);
            setJsonContent('');
        } catch (error) {
            console.error('Erro ao finalizar leitura:', error);
            alert('Erro ao finalizar leitura.');
        }
    };

    const getRowClass = (status?: string) => {
        if (!status) return 'bg-emerald-50/70 border-b border-emerald-100 hover:bg-emerald-100/50 text-slate-800';
        const clean = status.toLowerCase();
        
        if (clean === 'orçamento vazio' || clean === 'orçamento incompleto') {
            return 'bg-red-50/70 border-b border-red-100 hover:bg-red-100/50 text-slate-800';
        }
        if (clean === 'preço desatualizado') {
            return 'bg-amber-50/70 border-b border-amber-100 hover:bg-amber-100/50 text-slate-800';
        }
        if (clean === 'em processo de leitura') {
            return 'bg-orange-100 border-b-2 border-orange-400 hover:bg-orange-200 text-slate-900 font-medium shadow-sm';
        }
        if (clean === 'leitura finalizada, aguardo setor de produção') {
            return 'bg-orange-100 border-b-2 border-orange-400 hover:bg-orange-200 text-slate-900 font-medium shadow-sm';
        }
        if (clean === 'aguardando engenharia') {
            return 'bg-green-200 border-b-2 border-green-400 hover:bg-green-300 text-slate-900 font-medium shadow-sm';
        }
        if (clean === 'autorizado engenharia' || clean === 'pedido autorizado') {
            return 'bg-emerald-100 border-b-2 border-emerald-300 hover:bg-emerald-200 text-slate-900 font-medium shadow-sm';
        }
        return 'bg-emerald-50/70 border-b border-emerald-100 hover:bg-emerald-100/50 text-slate-800';
    };

    const isGestor = currentUser?.role === 'gestor' || currentUser?.role === 'admin';
    const baseOrders = (commercialOrders || []).filter(o => {
        // Apenas mostra os pedidos (onde status não é 'orçamento')
        if (o.status?.toLowerCase().includes('orçamento')) return false;
        
        // Esconde pedidos que ainda estão na Engenharia
        if (o.status?.toLowerCase() === 'aguardando engenharia' || o.status?.toLowerCase() === 'em processo de leitura') return false;

        if (!isGestor) {
            const userName = (currentUser?.name || currentUser?.username || '').toUpperCase();
            const orderSalesperson = (o.salesperson || '').toUpperCase();
            if (orderSalesperson !== userName) {
                return false;
            }
        }

        if (search.trim()) {
            const term = search.toLowerCase().trim();
            const matchesSearch = 
                (o.orderNumber && String(o.orderNumber).toLowerCase().includes(term)) ||
                (o.clientName && o.clientName.toLowerCase().includes(term)) ||
                (o.clientCode && String(o.clientCode).toLowerCase().includes(term)) ||
                (o.salesperson && o.salesperson.toLowerCase().includes(term));
            
            if (!matchesSearch) return false;
        }

        return true;
    });

    const totalPedidos = baseOrders.length;

    if (editingOrder) {
        return (
            <OrderItemsEditor
                order={editingOrder}
                onClose={() => setEditingOrder(null)}
                onSaveSuccess={() => {
                    // It will automatically refresh due to Realtime subscriptions
                }}
            />
        );
    }

    return (
        <div className="p-4 md:p-8 space-y-6">
            {/* Top Navigation with Mini Dashboard */}
            <div className="flex items-center justify-between no-print">
                <div className="flex items-center gap-8">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                            <span className="text-4xl">📝</span>
                            Gestão de Produção
                        </h1>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">MSM SISTEMAS • SETOR DE PRODUÇÃO</p>
                    </div>

                    {/* Mini Dashboard KPIs */}
                    <div className="flex gap-3">
                        <div className="bg-white border border-slate-200 shadow-sm rounded-xl px-5 py-2 flex flex-col items-center justify-center min-w-[120px]">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pedidos Ativos</span>
                            <span className="text-2xl font-black text-emerald-600">{totalPedidos}</span>
                        </div>
                    </div>

                    <button 
                        onClick={() => setIsMachinesModalOpen(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-sm transition-all text-sm uppercase tracking-wider"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="16" x="4" y="4" rx="2" ry="2"/><rect width="6" height="6" x="9" y="9" rx="1" ry="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/></svg>
                        Máquinas
                    </button>
                </div>

                <div className="flex gap-3">
                    <button 
                        onClick={() => {
                            setProgramData(null);
                            setIsProgramModalOpen(true);
                        }}
                        className="bg-sky-500 hover:bg-sky-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-sm transition-all text-sm uppercase tracking-wider"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                        Visão Semanal
                    </button>
                </div>
            </div>

            {/* Classification & Search Bar */}
            <div className="bg-white p-5 rounded-2xl border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
                <div className="flex flex-wrap items-center gap-6">
                    <div className="flex items-center gap-2">
                        <input 
                            type="radio" 
                            id="order-budget"
                            name="orderBy"
                            checked={orderBy === 'id'}
                            onChange={() => setOrderBy('id')}
                            className="accent-sky-600 w-4 h-4 cursor-pointer"
                        />
                        <label htmlFor="order-budget" className="text-xs font-bold text-slate-700 uppercase cursor-pointer">Classificar por Nº de Orçamento</label>
                    </div>
                    <div className="flex items-center gap-2">
                        <input 
                            type="radio" 
                            id="order-client"
                            name="orderBy"
                            checked={orderBy === 'clientCode'}
                            onChange={() => setOrderBy('clientCode')}
                            className="accent-sky-600 w-4 h-4 cursor-pointer"
                        />
                        <label htmlFor="order-client" className="text-xs font-bold text-slate-700 uppercase cursor-pointer">Classificar por Cód. Cliente</label>
                    </div>
                </div>

                <div className="flex items-center gap-2.5 max-w-md w-full">
                    <input 
                        type="text" 
                        placeholder="Pesquisar orçamento, cliente ou vendedor..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="flex-grow p-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    <button className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider">
                        Pesquisar
                    </button>
                </div>
            </div>

            {/* Quotes Table List */}
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden no-print">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-800 text-white">
                                <th className="p-4 text-center font-bold text-xs uppercase w-20">Nº</th>
                                <th className="p-4 text-center font-bold text-xs uppercase w-24">Data</th>
                                <th className="p-4 text-center font-bold text-xs uppercase w-28">Vendedor</th>
                                <th className="p-4 font-bold text-xs uppercase">Cliente</th>
                                <th className="p-4 text-center font-bold text-xs uppercase w-32">Máquinas</th>
                                <th className="p-4 text-center font-bold text-xs uppercase w-20">Qtd O.S</th>
                                <th className="p-4 text-center font-bold text-xs uppercase w-28">Bitolas</th>
                                <th className="p-4 text-center font-bold text-xs uppercase w-24">Tempo</th>
                                <th className="p-4 text-center font-bold text-xs uppercase w-32">Status</th>
                                <th className="p-4 text-center font-bold text-xs uppercase w-36">Preço</th>
                                <th className="p-4 text-center font-bold text-xs uppercase w-48">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[...baseOrders].sort((a, b) => {
                                if (orderBy === 'id') {
                                    return String(b.orderNumber || '').localeCompare(String(a.orderNumber || ''));
                                }
                                return String(a.clientCode || '').localeCompare(String(b.clientCode || ''));
                            }).map((q) => {
                                // Formatar a data para o padrão BR caso venha como YYYY-MM-DD
                                const formattedDate = (q.date && String(q.date).includes('-')) 
                                    ? String(q.date).split('-').reverse().join('/') 
                                    : (q.date || '');

                                let projectOsCount = 0;
                                let projectBitolas: string[] = [];
                                let projectEstimatedHours = 0;
                                
                                try {
                                    if (q.projectData && Array.isArray(q.projectData)) {
                                        const normalizedData = q.projectData.map(item => {
                                            const newItem: any = {};
                                            for (const key in item) {
                                                newItem[key.trim().toLowerCase()] = item[key];
                                            }
                                            return newItem;
                                        });
                                        
                                        const groups: Record<string, any[]> = {};
                                        normalizedData.forEach(item => {
                                            const mm = item.mm || item.bitola || item.diametro || 'Indefinido';
                                            if (!groups[mm]) groups[mm] = [];
                                            groups[mm].push(item);
                                        });
                                        
                                        Object.entries(groups).forEach(([mm, items]) => {
                                            const totalLength = items.reduce((acc, curr) => acc + ((parseFloat(curr.qunti?.toString() || curr.quantidade?.toString() || curr.qtd?.toString()) || 0) * (parseFloat(curr.comprimento?.toString()) || 0)), 0) / 100;
                                            const uniqueOs = new Set(items.map(item => item.os));
                                            const totalQtd = uniqueOs.size;
                                            
                                            projectOsCount += totalQtd;
                                            if (mm !== 'Indefinido' && !projectBitolas.includes(mm)) {
                                                projectBitolas.push(mm);
                                            }
                                            
                                            const normalizedTarget = parseFloat(mm.replace(',', '.').replace(/[^\d.]/g, ''));
                                            if (activeBrandingPartner?.machines) {
                                                const compatibleMachines = activeBrandingPartner.machines.filter(m => {
                                                    if (!m.gaugeRange) return false;
                                                    const ranges = m.gaugeRange.split(/[-;|\/]+/).map((s: string) => parseFloat(s.replace(',', '.').replace(/[^\d.]/g, '')));
                                                    return ranges.includes(normalizedTarget);
                                                });
                                                if (compatibleMachines.length > 0) {
                                                    const mph = compatibleMachines[0].capabilities?.estribo?.calculatedMetersPerHour || 0;
                                                    if (mph > 0) {
                                                        projectEstimatedHours += totalLength / mph;
                                                    }
                                                }
                                            }
                                        });
                                    }
                                } catch (e) {}
                                
                                const orderMachines = Array.from(new Set(
                                    allProgrammedOrders
                                        .filter(po => po.related_commercial_order_id === q.id)
                                        .map(po => po.machine)
                                        .filter(Boolean)
                                ));
                                
                                const hours = Math.floor(projectEstimatedHours);
                                const minutes = Math.round((projectEstimatedHours - hours) * 60);
                                const formattedTime = projectEstimatedHours > 0 
                                    ? `${hours}h ${minutes}m` 
                                    : '-';

                                return (
                                    <tr key={q.id} className={`${getRowClass(q.status)} transition-colors`}>
                                        <td className="p-4 text-center font-black text-slate-900 text-sm">{q.orderNumber}</td>
                                        <td className="p-4 text-center font-bold text-slate-600 text-xs">{formattedDate}</td>
                                        <td className="p-4 text-center font-bold text-slate-700 text-xs">{q.salesperson}</td>
                                        <td className="p-4">
                                            <div className="flex flex-col">
                                                <span className="font-extrabold text-slate-950 text-xs uppercase">
                                                    ({q.clientCode}) {q.clientName}
                                                </span>
                                                <span className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">{q.clientCity}</span>
                                                {q.clientObs && <span className="text-[9px] font-semibold text-sky-600 mt-1 italic">{q.clientObs}</span>}
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            {orderMachines.length > 0 ? (
                                                <div className="flex flex-col gap-1 items-center">
                                                    {orderMachines.map((m, idx) => (
                                                        <span key={idx} className="bg-slate-100 border border-slate-200 text-slate-700 text-[9px] font-bold px-2 py-0.5 rounded uppercase whitespace-nowrap">
                                                            {m}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-[9px] font-bold text-slate-400 italic uppercase">-</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className="text-xs font-black text-slate-700">{projectOsCount || '-'}</span>
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="flex flex-wrap items-center justify-center gap-1 max-w-[100px]">
                                                {projectBitolas.length > 0 ? projectBitolas.map((b, idx) => (
                                                    <span key={idx} className="bg-sky-50 border border-sky-100 text-sky-700 text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap">
                                                        {b}
                                                    </span>
                                                )) : <span className="text-[9px] font-bold text-slate-400 italic uppercase">-</span>}
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className={`text-xs font-bold ${projectEstimatedHours > 0 ? 'text-indigo-600' : 'text-slate-400'}`}>
                                                {formattedTime}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center">
                                            {q.status?.toLowerCase() === 'aguardando engenharia' ? (
                                                <div className="bg-red-500 text-white text-[10px] font-black uppercase px-2 py-1 rounded-full animate-pulse whitespace-nowrap shadow-md border border-red-600">
                                                    Aguardando Eng.
                                                </div>
                                            ) : q.status?.toLowerCase() === 'em processo de leitura' ? (
                                                <div className="flex flex-col items-center">
                                                    <span className="bg-orange-500 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-full whitespace-nowrap shadow-sm">
                                                        Em Leitura
                                                    </span>
                                                    {q.engineeringDeadline && (
                                                        <span className="text-[8px] font-bold text-orange-700 mt-1 uppercase whitespace-nowrap">
                                                            Até: {q.engineeringDeadline}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : q.status?.toLowerCase() === 'leitura finalizada, aguardo setor de produção' ? (
                                                <div className="bg-red-500 text-white text-[9px] font-black uppercase px-2 py-1 rounded-full animate-pulse whitespace-nowrap shadow-sm border border-red-600">
                                                    Aguardando Programação de Máquinas
                                                </div>
                                            ) : q.status?.toLowerCase() === 'aguardando liberar produção' ? (
                                                <div className="bg-red-600 text-white text-[9px] font-black uppercase px-2 py-1 rounded-full animate-pulse whitespace-nowrap shadow-md border border-red-700 flex items-center justify-center gap-1">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                                                    !! LIBERAR O.S PARA MÁQUINA !!
                                                </div>
                                            ) : q.status?.toLowerCase() === 'em produção' ? (
                                                <div className="bg-orange-500 text-white text-[9px] font-black uppercase px-2 py-1 rounded-full animate-pulse whitespace-nowrap shadow-md border border-orange-600 inline-flex items-center justify-center">
                                                    EM PRODUÇÃO
                                                </div>
                                            ) : (
                                                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-tight italic">
                                                    {q.status || 'N/A'}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 text-center font-black text-slate-900 text-sm">
                                            R$ {(q.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            {(!q.price || q.price === 0) && (
                                                <div className="text-[10px] font-black text-red-600 uppercase tracking-tight mt-1 flex items-center justify-center gap-1">
                                                    <span>⚠️</span> INCOMPLETO
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 text-center">
                                            <select 
                                                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                                                onChange={(e) => {
                                                    if (e.target.value === 'print') {
                                                        setPrintingOrder(q);
                                                    } else if (e.target.value === 'view_project') {
                                                        setOrderToView(q);
                                                        setIsViewProjectModalOpen(true);
                                                    } else if (e.target.value.startsWith('liberar_')) {
                                                        const machine = e.target.value.replace('liberar_', '');
                                                        handleLiberarOS(q.id!, machine);
                                                    }
                                                    e.target.value = '';
                                                }}
                                            >
                                                <option value="">Ações...</option>
                                                {q.projectData ? (
                                                    <option value="view_project">👁️ Visualizar Projeto JSON</option>
                                                ) : null}
                                                {q.status === 'Aguardando liberar produção' && (() => {
                                                    const posForQ = allProgrammedOrders.filter(po => po.related_commercial_order_id === q.id);
                                                    const machinesForQ = Array.from(new Set(posForQ.map(po => po.machine).filter(Boolean)));
                                                    
                                                    return machinesForQ.map(m => {
                                                        const isReleased = !posForQ.some(po => po.machine === m && po.status === 'pending');
                                                        
                                                        if (isReleased) {
                                                            return <option key={`liberar_${m}`} value="" disabled>✔️ Enviado para {m}</option>;
                                                        }
                                                        
                                                        return <option key={`liberar_${m}`} value={`liberar_${m}`}>⚡ Liberar OS para {m}</option>;
                                                    });
                                                })()}
                                            </select>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Novo Orçamento (Desativado) Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-slate-50 w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        
                        <div className="p-6 border-b border-slate-200 bg-white flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-black text-slate-900">Novo Orçamento (Desativado) / Pedido</h2>
                                <p className="text-sm font-bold text-slate-500 uppercase mt-1">Preencha os dados abaixo para iniciar</p>
                            </div>
                            <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-red-500 transition-colors p-2 bg-slate-100 hover:bg-red-50 rounded-xl">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 space-y-8 bg-slate-50/50">
                            
                            {/* Buscar Cliente */}
                            <div className="space-y-3">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 text-sky-500"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
                                    Buscar Cliente
                                </label>
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        placeholder="Digite o nome, código ou CPF/CNPJ do cliente..." 
                                        value={clientSearchTerm}
                                        onChange={(e) => setClientSearchTerm(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSearchClient()}
                                        className="flex-1 bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-700 font-medium focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none transition-all shadow-sm" 
                                    />
                                    <button 
                                        onClick={handleSearchClient}
                                        className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-6 py-3 rounded-xl transition-colors shadow-md"
                                    >
                                        Buscar
                                    </button>
                                </div>
                                <div className="flex justify-between items-center">
                                    <p className="text-xs font-semibold text-slate-500">
                                        Cliente sem cadastro utilizar código <span className="text-sky-600 font-black">1001</span> (CONSUMIDOR BALCAO)
                                    </p>
                                    {searchError && (
                                        <p className="text-xs font-bold text-red-500 animate-pulse">{searchError}</p>
                                    )}
                                </div>
                                
                                {/* Exibição do cliente selecionado */}
                                {selectedClient && (
                                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mt-2 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest border border-emerald-200">
                                                    CÓD: {selectedClient.code}
                                                </span>
                                                <h3 className="font-bold text-emerald-950 text-sm">{selectedClient.name}</h3>
                                            </div>
                                            <div className="flex items-center gap-3 mt-1.5">
                                                <p className="text-xs font-semibold text-emerald-700">
                                                    {selectedClient.document1} {selectedClient.document2 ? `• ${selectedClient.document2}` : ''}
                                                </p>
                                                {selectedClient.phone && (
                                                    <p className="text-xs font-semibold text-emerald-700">
                                                        📞 {selectedClient.phone}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => {
                                                setSelectedClient(null);
                                                setClientSearchTerm('');
                                            }} 
                                            className="text-emerald-600 hover:text-emerald-800 hover:bg-emerald-100 p-2 rounded-lg transition-colors"
                                            title="Limpar cliente"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                )}
                                
                                <div className="space-y-2 mt-4">
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Observações (Opcional)</label>
                                    <textarea 
                                        rows={2}
                                        value={newObservations} 
                                        onChange={e => setNewObservations(e.target.value)} 
                                        placeholder="Ex: Descarregamento por conta do cliente..." 
                                        className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-slate-700 font-medium focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none transition-all shadow-sm resize-none" 
                                    />
                                </div>
                            </div>

                            <hr className="border-slate-200" />
                        </div>

                        <div className="p-6 border-t border-slate-200 bg-white flex justify-end gap-3">
                            <button onClick={() => setIsAddModalOpen(false)} className="px-6 py-2.5 rounded-xl font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors">
                                Cancelar
                            </button>
                            <button onClick={handleCreateOrder} disabled={!selectedClient} className="px-6 py-2.5 rounded-xl font-bold bg-emerald-500 hover:bg-emerald-600 text-white transition-colors shadow-md shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed">
                                Iniciar Orçamento
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Print View Modal */}
            {printingOrder && (
                <OrderPrintView 
                    order={printingOrder} 
                    onClose={() => setPrintingOrder(null)} 
                    activeBrandingPartner={activeBrandingPartner}
                />
            )}
            {/* View Project Modal */}
            {isViewProjectModalOpen && orderToView && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                            <div className="flex items-center gap-6">
                                <div>
                                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">
                                        Projeto: Pedido {orderToView.orderNumber}
                                    </h2>
                                    <p className="text-sm font-medium text-slate-500 mt-1">
                                        Cliente: {orderToView.clientName}
                                    </p>
                                </div>
                                <div className="flex bg-slate-200 rounded-lg p-1">
                                    <button
                                        onClick={() => setViewMode('detalhado')}
                                        className={`px-4 py-1.5 text-sm font-bold rounded-md transition-colors ${viewMode === 'detalhado' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        Detalhado
                                    </button>
                                    <button
                                        onClick={() => setViewMode('resumo')}
                                        className={`px-4 py-1.5 text-sm font-bold rounded-md transition-colors ${viewMode === 'resumo' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        Resumo Total
                                    </button>
                                </div>
                            </div>
                            <button 
                                onClick={() => setIsViewProjectModalOpen(false)}
                                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
                            {(() => {
                                try {
                                    const data = orderToView.projectData;
                                    if (!Array.isArray(data)) {
                                        return <div className="p-4 text-red-500 font-bold">O formato do projeto salvo não é uma lista JSON válida ou está vazio. Verifique como foi salvo.</div>;
                                    }

                                    // Normalize keys to lowercase and trim
                                    const normalizedData = data.map(item => {
                                        const newItem: any = {};
                                        for (const key in item) {
                                            newItem[key.trim().toLowerCase()] = item[key];
                                        }
                                        return newItem;
                                    });

                                    // Group by bitola (mm)
                                    const groups: Record<string, any[]> = {};
                                    normalizedData.forEach(item => {
                                        const mm = item.mm || item.bitola || item.diametro || 'Indefinido';
                                        if (!groups[mm]) groups[mm] = [];
                                        groups[mm].push(item);
                                    });

                                    if (viewMode === 'resumo') {
                                        let grandTotalComp = 0;
                                        let grandTotalPeso = 0;
                                        let grandTotalQtd = 0;
                                        let grandTotalHours = 0;

                                        const orderItemsGrouped = Object.entries(groups).map(([mm, items]) => {
                                            const totalPeso = items.reduce((acc, curr) => acc + (parseFloat(curr.peso?.toString().replace(',','.')) || 0), 0);
                                            const totalMetros = items.reduce((acc, curr) => acc + ((parseFloat(curr.qunti?.toString() || curr.quantidade?.toString() || curr.qtd?.toString()) || 0) * (parseFloat(curr.comprimento?.toString()) || 0)), 0) / 100;
                                            const uniqueOs = new Set(items.map(item => item.os));
                                            const totalQtd = uniqueOs.size;
                                            return { bitola: mm, aco: (['5,00', '5.00', '5', '6,00', '6.00', '6'].includes(mm)) ? 'CA60' : 'CA50', totalLength: totalMetros, totalWeight: totalPeso, quantity: totalQtd };
                                        });

                                        const allProgrammed = orderItemsGrouped.length > 0 && orderItemsGrouped.every(item => programmedOrders.some(po => po.target_bitola === item.bitola));

                                        return (
                                            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm flex flex-col">
                                                <div className="bg-slate-800 px-4 py-2 flex items-center justify-center">
                                                    <h3 className="text-white font-bold text-lg uppercase tracking-widest">Resumo Geral</h3>
                                                </div>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-center border-collapse">
                                                        <thead>
                                                            <tr className="bg-slate-200 border-b-2 border-slate-300">
                                                                <th className="p-3 text-sm font-black text-slate-700 uppercase border-r border-slate-300">Bitola</th>
                                                                <th className="p-3 text-sm font-black text-slate-700 uppercase border-r border-slate-300">Aço</th>
                                                                <th className="p-3 text-sm font-black text-slate-700 uppercase border-r border-slate-300">Comp. (m)</th>
                                                                <th className="p-3 text-sm font-black text-slate-700 uppercase border-r border-slate-300">Peso (Kg)</th>
                                                                <th className="p-3 text-sm font-black text-slate-700 uppercase border-r border-slate-300">Qtd O.S.</th>
                                                                <th className="p-3 text-sm font-black text-slate-700 uppercase border-r border-slate-300">Sugestão Máquina</th>
                                                                <th className="p-3 text-sm font-black text-slate-700 uppercase">Status</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {orderItemsGrouped.map((item, idx) => {
                                                                const programmedInfo = programmedOrders.find(po => po.target_bitola === item.bitola);
                                                                grandTotalComp += item.totalLength;
                                                                grandTotalPeso += item.totalWeight;
                                                                grandTotalQtd += item.quantity;
                                                                
                                                                const normalizedTarget = parseFloat(item.bitola.replace(',', '.').replace(/[^\d.]/g, ''));
                                                                let bestMachine: any = null;
                                                                let bestMachineHours = 0;

                                                                if (activeBrandingPartner?.machines) {
                                                                    const compatibleMachines = activeBrandingPartner.machines.filter(m => {
                                                                        if (!m.gaugeRange) return false;
                                                                        const ranges = m.gaugeRange.split(/[-;|\/]+/).map((s: string) => parseFloat(s.replace(',', '.').replace(/[^\d.]/g, '')));
                                                                        return ranges.includes(normalizedTarget);
                                                                    });
                                                                    
                                                                    if (compatibleMachines.length > 0) {
                                                                        bestMachine = compatibleMachines[0];
                                                                        const mph = bestMachine.capabilities?.estribo?.calculatedMetersPerHour || 0;
                                                                        if (mph > 0) {
                                                                            bestMachineHours = item.totalLength / mph;
                                                                        }
                                                                    }
                                                                }

                                                                grandTotalHours += bestMachineHours;

                                                                return (
                                                                    <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50">
                                                                        <td className="p-3 text-sm font-medium text-slate-700 border-r border-slate-200">{item.bitola}</td>
                                                                        <td className="p-3 text-sm font-medium text-slate-700 border-r border-slate-200">{item.aco}</td>
                                                                        <td className="p-3 text-sm font-medium text-slate-700 border-r border-slate-200">{item.totalLength.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                                        <td className="p-3 text-sm font-medium text-slate-700 border-r border-slate-200">{item.totalWeight.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                                        <td className="p-3 text-sm font-medium text-slate-700 border-r border-slate-200">{item.quantity}</td>
                                                                        <td className="p-3 text-sm border-r border-slate-200">
                                                                            {bestMachine ? (
                                                                                <div className="flex flex-col items-center justify-center gap-1">
                                                                                    <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200 uppercase">{bestMachine.name}</span>
                                                                                    {bestMachineHours > 0 && (
                                                                                        <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                                                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                                                                            {formatMachineTime(bestMachineHours)}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            ) : (
                                                                                <span className="text-[9px] font-bold text-slate-400 uppercase">N/A</span>
                                                                            )}
                                                                        </td>
                                                                        <td className="p-3 text-sm text-center">
                                                                            {programmedInfo ? (
                                                                                <div className="flex flex-col items-center justify-center bg-emerald-50 px-3 py-1 rounded border border-emerald-100 relative group overflow-hidden h-[42px] min-w-[120px]">
                                                                                    <div className="flex flex-col items-center justify-center group-hover:-translate-y-8 transition-transform duration-300">
                                                                                        <span className="text-[10px] font-black text-emerald-600 uppercase">Programado</span>
                                                                                        <span className="text-[9px] font-bold text-emerald-400">{programmedInfo.creation_date?.substring(0,10).split('-').reverse().join('/')} - {programmedInfo.machine}</span>
                                                                                    </div>
                                                                                    <button 
                                                                                        onClick={async (e) => {
                                                                                            e.stopPropagation();
                                                                                            if (window.confirm(`Deseja remover a programação da bitola ${item.bitola}mm?`)) {
                                                                                                try {
                                                                                                    await supabase.from('production_orders').delete().eq('id', programmedInfo.id);
                                                                                                    setProgrammedOrders(prev => prev.filter(p => p.id !== programmedInfo.id));
                                                                                                    setAllProgrammedOrders(prev => prev.filter(p => p.id !== programmedInfo.id));
                                                                                                } catch (err) { alert('Erro ao remover programação'); }
                                                                                            }
                                                                                        }}
                                                                                        className="absolute inset-0 bg-red-50 text-red-600 font-bold text-[10px] uppercase flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-8 group-hover:translate-y-0 cursor-pointer hover:bg-red-100"
                                                                                    >
                                                                                        Remover
                                                                                    </button>
                                                                                </div>
                                                                            ) : (
                                                                                <button 
                                                                                    onClick={() => {
                                                                                        setProgramData({ bitola: item.bitola, peso: item.totalWeight, orderNum: orderToView?.orderNumber || '', quantity: item.quantity, compM: item.totalLength });
                                                                                        setProgramBitolaOriginal(item.bitola);
                                                                                        setProgramOrderNumber(`${orderToView?.orderNumber || ''}-${item.bitola.replace(',', '.')}`);
                                                                                        setProgramWeight(item.totalWeight.toString());
                                                                                        setProgramMachine(bestMachine ? bestMachine.name : (item.aco === 'CA60' ? 'Trefila 1' : 'Treliça'));
                                                                                        setIsProgramModalOpen(true);
                                                                                    }}
                                                                                    className="text-[9px] bg-slate-800 text-white font-bold px-2 py-1 rounded-md hover:bg-sky-600 transition uppercase shadow-sm"
                                                                                >
                                                                                    Programar
                                                                                </button>
                                                                            )}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                        <tfoot className="bg-slate-100 border-t-2 border-slate-300">
                                                            <tr>
                                                                <td colSpan={2} className="p-3 text-sm font-black text-slate-800 uppercase text-right border-r border-slate-300">TOTAL:</td>
                                                                <td className="p-3 text-sm font-black text-slate-800 border-r border-slate-300">{grandTotalComp.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                                <td className="p-3 text-sm font-black text-slate-800 border-r border-slate-300">{grandTotalPeso.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                                <td className="p-3 text-sm font-black text-slate-800 border-r border-slate-300">{grandTotalQtd}</td>
                                                                <td className="p-3 text-sm font-black text-sky-800 border-r border-slate-300 text-center">
                                                                    {grandTotalHours > 0 ? (
                                                                        <div className="flex items-center justify-center gap-1">
                                                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                                                            {formatMachineTime(grandTotalHours)}
                                                                        </div>
                                                                    ) : '-'}
                                                                </td>
                                                                <td></td>
                                                            </tr>
                                                        </tfoot>
                                                    </table>
                                                </div>
                                                
                                                {allProgrammed && (
                                                    <div className="bg-emerald-50 border-t-2 border-emerald-200 p-5 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2">
                                                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                                            <div className="flex items-center gap-3">
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
                                                                <div>
                                                                    <h4 className="text-emerald-800 font-black text-lg uppercase tracking-tight">Pedido Programado</h4>
                                                                    <p className="text-emerald-600 font-bold text-[10px] uppercase">
                                                                        {orderToView.status === 'Aguardando liberar produção' 
                                                                            ? 'Máquinas aguardando liberação das O.S.'
                                                                            : 'Todas as bitolas foram atribuídas às máquinas.'}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            
                                                            {orderToView.status !== 'Aguardando liberar produção' && (
                                                                <button 
                                                                    onClick={async () => {
                                                                        try {
                                                                            await supabase.from('commercial_orders').update({ status: 'Aguardando liberar produção' }).eq('id', orderToView.id);
                                                                            setOrderToView({...orderToView, status: 'Aguardando liberar produção'});
                                                                        } catch (e) { alert('Erro ao atualizar status'); }
                                                                    }}
                                                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-6 py-3 rounded-xl uppercase tracking-widest shadow-lg hover:shadow-emerald-500/50 transition-all flex items-center gap-2"
                                                                >
                                                                    Confirmar Programação
                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    }

                                    return (
                                        <div className="space-y-8">
                                            {Object.entries(groups).map(([mm, items]) => {
                                                const totalPeso = items.reduce((acc, curr) => acc + (parseFloat(curr.peso?.toString().replace(',','.')) || 0), 0);
                                                const totalMetros = items.reduce((acc, curr) => acc + ((parseFloat(curr.qunti?.toString()) || 0) * (parseFloat(curr.comprimento?.toString()) || 0)), 0);

                                                return (
                                                    <div key={mm} className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                                                        <div className="bg-slate-800 px-4 py-2 flex items-center justify-between">
                                                            <h3 className="text-white font-bold text-sm uppercase">Bitola: {mm} mm</h3>
                                                        </div>
                                                        <div className="overflow-x-auto">
                                                            <table className="w-full text-left border-collapse">
                                                                <thead>
                                                                    <tr className="bg-slate-50 border-b border-slate-200">
                                                                        <th className="p-3 text-xs font-bold text-slate-500 uppercase">OS</th>
                                                                        <th className="p-3 text-xs font-bold text-slate-500 uppercase">POS</th>
                                                                        <th className="p-3 text-xs font-bold text-slate-500 uppercase text-center">QTD</th>
                                                                        <th className="p-3 text-xs font-bold text-slate-500 uppercase text-center">Comprimento</th>
                                                                        <th className="p-3 text-xs font-bold text-slate-500 uppercase text-right">Peso</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {items.map((item, idx) => (
                                                                        <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/50">
                                                                            <td className="p-3 text-sm font-medium text-slate-700">{item.os || '-'}</td>
                                                                            <td className="p-3 text-sm font-bold text-slate-900">{item.pos || '-'}</td>
                                                                            <td className="p-3 text-sm text-center font-medium text-slate-600">{item.qunti || item.quantidade || item.qtd || '-'}</td>
                                                                            <td className="p-3 text-sm text-center font-medium text-slate-600">{item.comprimento || '-'}</td>
                                                                            <td className="p-3 text-sm text-right font-bold text-slate-700">{parseFloat(item.peso?.toString().replace(',','.') || '0').toFixed(2)} kg</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                                <tfoot className="bg-slate-50/80">
                                                                    <tr>
                                                                        <td colSpan={2} className="p-3 text-xs font-bold text-slate-500 uppercase text-right">Totais desta bitola:</td>
                                                                        <td className="p-3 text-sm text-center font-black text-slate-800">{items.reduce((acc, curr) => acc + (parseInt(curr.qunti?.toString() || curr.quantidade?.toString() || curr.qtd?.toString()) || 0), 0)} un</td>
                                                                        <td className="p-3 text-sm text-center font-black text-slate-800">{totalMetros.toFixed(2)} cm</td>
                                                                        <td className="p-3 text-sm text-right font-black text-sky-600">{totalPeso.toFixed(2)} kg</td>
                                                                    </tr>
                                                                </tfoot>
                                                            </table>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                } catch (e) {
                                    return <div className="p-4 text-red-500">Erro ao processar dados do projeto.</div>;
                                }
                            })()}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Programar Maquina (Semana Matriz) */}
{isProgramModalOpen && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-[98vw] max-w-[1800px] h-[95vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
                            <div>
                                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-sky-500"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                                    {programData ? 'Programar Produção' : 'Visão Geral da Produção'}
                                    <span className="text-sm font-medium bg-slate-100 text-slate-500 px-2 py-1 rounded-md ml-2 border border-slate-200">
                                        {weekOffset === 0 ? '(Semana Atual)' : weekOffset === 1 ? '(Próxima Semana)' : weekOffset === -1 ? '(Semana Passada)' : `(${weekOffset > 0 ? '+' : ''}${weekOffset} Semanas)`}
                                    </span>
                                </h2>
                                {programData && (
                                    <p className="text-sm font-medium text-slate-500 mt-1">
                                        Pedido: <span className="font-bold text-slate-800">{orderToView?.orderNumber}</span> | Bitola: <span className="font-bold text-sky-600">{programBitolaOriginal} mm</span> | Peso: <span className="font-bold text-slate-800">{parseFloat(programWeight).toFixed(2)} kg</span>
                                    </p>
                                )}
                            </div>
                            
                            <div className="flex items-center gap-4">
                                <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                                    <select 
                                        value={selectedDay !== null ? selectedDay.toString() : (showSaturday ? 'seg-sab' : 'seg-sex')}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === 'seg-sex') { setSelectedDay(null); setShowSaturday(false); }
                                            else if (val === 'seg-sab') { setSelectedDay(null); setShowSaturday(true); }
                                            else { setSelectedDay(Number(val)); }
                                        }}
                                        className="px-3 py-1.5 text-xs font-bold rounded-md bg-transparent text-slate-700 outline-none cursor-pointer hover:bg-white transition-colors"
                                    >
                                        <option value="seg-sex">Seg a Sex</option>
                                        <option value="seg-sab">Seg a Sáb</option>
                                        <option disabled>────────</option>
                                        <option value="0">Segunda</option>
                                        <option value="1">Terça</option>
                                        <option value="2">Quarta</option>
                                        <option value="3">Quinta</option>
                                        <option value="4">Sexta</option>
                                        <option value="5">Sábado</option>
                                    </select>
                                </div>
                                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                                    <button 
                                        onClick={() => {
                                            if (selectedDay !== null) {
                                                if (selectedDay === 0) {
                                                    setWeekOffset(w => w - 1);
                                                    setSelectedDay(5);
                                                } else {
                                                    setSelectedDay(selectedDay - 1);
                                                }
                                            } else {
                                                setWeekOffset(w => w - 1);
                                            }
                                        }} 
                                        className="p-1.5 hover:bg-white rounded-md text-slate-500 hover:text-slate-800 transition-colors"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                                    </button>
                                    <span className="text-xs font-bold text-slate-700 px-2 uppercase tracking-wider">
                                        {selectedDay !== null ? 'Dia' : 'Semana'}
                                    </span>
                                    <button 
                                        onClick={() => {
                                            if (selectedDay !== null) {
                                                if (selectedDay === 5) {
                                                    setWeekOffset(w => w + 1);
                                                    setSelectedDay(0);
                                                } else {
                                                    setSelectedDay(selectedDay + 1);
                                                }
                                            } else {
                                                setWeekOffset(w => w + 1);
                                            }
                                        }} 
                                        className="p-1.5 hover:bg-white rounded-md text-slate-500 hover:text-slate-800 transition-colors"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center gap-6">
                                {programData && (
                                    <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Número da O.P.</label>
                                        <input 
                                            type="text" 
                                            value={programOrderNumber}
                                            onChange={e => setProgramOrderNumber(e.target.value)}
                                            className="w-32 bg-transparent text-slate-800 font-bold focus:outline-none focus:text-sky-600 transition-colors"
                                            required
                                        />
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                                    </div>
                                )}
                                <button onClick={() => setIsProgramModalOpen(false)} className="p-2 text-slate-400 hover:text-rose-500 bg-slate-200 hover:bg-rose-100 rounded-full transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                                </button>
                            </div>
                        </div>
                        
                        <div className="flex-1 overflow-auto p-6 bg-slate-100/50">
                            <div className="min-w-max border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
                                {/* Header Row (Days) */}
                                <div className="flex border-b border-slate-200 bg-slate-800 text-white shadow-md relative z-20">
                                    <div className="w-48 shrink-0 p-4 border-r border-slate-700 flex flex-col justify-center bg-slate-900/50">
                                        <div className="text-xs font-black tracking-widest text-slate-400 uppercase">Selecione para</div>
                                        <div className="text-lg font-black tracking-wider text-white">MÁQUINAS</div>
                                    </div>
                                    {getWorkingDays().map(day => (
                                        <div key={day.date} className="flex-1 min-w-[140px] p-3 text-center border-r border-slate-700/50 last:border-0 flex flex-col items-center justify-center">
                                            <div className="text-[10px] font-black text-sky-400 uppercase tracking-widest">{day.name}</div>
                                            <div className="text-xl font-bold mt-0.5">{day.shortDate}</div>
                                        </div>
                                    ))}
                                </div>
                                
                                {/* Machine Rows */}
                                <div className="flex flex-col relative z-10">
                                    {(activeBrandingPartner?.machines || [
                                        { name: 'Trefila 1', capacityKgPerHour: 500 },
                                        { name: 'Trefila 2', capacityKgPerHour: 500 },
                                        { name: 'Treliça', capacityKgPerHour: 800 }
                                    ]).map((machine, mIdx) => {
                                        const normalizedTarget = parseFloat(programBitolaOriginal.replace(',', '.').replace(/[^\d.]/g, ''));
                                        let isCompatible = false;
                                        if (machine.gaugeRange) {
                                            const ranges = machine.gaugeRange.split(/[-;|\/]+/).map((s: string) => parseFloat(s.replace(',', '.').replace(/[^\d.]/g, '')));
                                            isCompatible = ranges.includes(normalizedTarget);
                                        }
                                        
                                        return (
                                            <div key={machine.name} className="flex border-b border-slate-100 last:border-0 hover:bg-slate-50/80 transition-colors group">
                                                <div className="w-48 shrink-0 p-4 border-r border-slate-200 flex flex-col justify-center bg-white shadow-[2px_0_5px_rgba(0,0,0,0.02)] z-10 relative">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-md shrink-0 ${isCompatible ? (mIdx % 2 === 0 ? 'bg-sky-500' : 'bg-indigo-500') : 'bg-slate-300'}`}>
                                                            {machine.imageUrl ? (
                                                                <img src={machine.imageUrl} alt={machine.name} className="w-full h-full object-cover rounded-xl" />
                                                            ) : (
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 12h4"/><path d="M14 12h4"/></svg>
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="font-black text-slate-700 text-sm leading-tight">{machine.name}</span>
                                                            <span className="text-[9px] font-bold text-sky-600 uppercase mt-0.5 tracking-wider bg-sky-50 px-1.5 py-0.5 rounded self-start border border-sky-100 flex items-center gap-1">
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                                                T. DISP: {calculateTotalMachineHours(machine)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    </div>
                                                {getWorkingDays().map(day => {
                                                    const cellOrders = allProgrammedOrders.filter(po => po.machine === machine.name && po.creation_date?.startsWith(day.date));
                                                    const cellWeight = cellOrders.reduce((sum, po) => sum + (Number(po.total_weight) || 0), 0);

                                                    return (
                                                    <div key={`${machine.name}-${day.date}`} className="flex-1 min-w-[140px] border-r border-slate-100 last:border-0 p-2.5 relative flex flex-col gap-2">
                                                        
                                                        
                                                        {cellOrders.length > 0 && (
                                                            <div className="absolute top-1 left-1 right-1 flex flex-col gap-1 z-10 max-h-[90%] overflow-hidden">
                                                                {cellOrders.map(po => {
                                                                    const machineData = activeBrandingPartner?.machines?.find(m => m.name === po.machine);
                                                                    const mph = machineData?.capabilities?.estribo?.calculatedMetersPerHour || 0;
                                                                    let estimatedHours = 0;
                                                                    if (po.total_meters && mph > 0) {
                                                                        estimatedHours = po.total_meters / mph;
                                                                    }
                                                                    const c = getOrderColor(po.order_number);

                                                                    return (
                                                                    <div key={po.id} className={`${c.bg} backdrop-blur border ${c.border} rounded px-1.5 py-1 text-[8px] ${c.text} shadow-sm flex items-center justify-between gap-1 relative group/card overflow-hidden whitespace-nowrap`}>
                                                                        <div className="flex items-center gap-1 min-w-0">
                                                                            <span className={`font-black text-[9px] ${c.titleText} truncate`}>Nº {po.order_number}</span>
                                                                            <span className="font-bold opacity-80 shrink-0">({po.target_bitola}mm)</span>
                                                                            <span className="font-bold opacity-80 shrink-0">({po.quantity_os || 0} OS)</span>
                                                                        </div>
                                                                        {estimatedHours > 0 && (
                                                                            <div className={`text-[8px] font-black ${c.timeText} ${c.timeBg} rounded px-1 py-0.5 flex items-center gap-1 border ${c.border} ml-auto shrink-0`}>
                                                                                <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                                                                <span className="truncate">{formatMachineTime(estimatedHours)}</span>
                                                                            </div>
                                                                        )}
                                                                        <button
                                                                            onClick={async (e) => {
                                                                                e.stopPropagation();
                                                                                if (window.confirm(`Deseja remover a programação da OS ${po.order_number}?`)) {
                                                                                    try {
                                                                                        await supabase.from('production_orders').delete().eq('id', po.id);
                                                                                        setAllProgrammedOrders(prev => prev.filter(p => p.id !== po.id));
                                                                                        setProgrammedOrders(prev => prev.filter(p => p.id !== po.id));
                                                                                    } catch(err) { alert('Erro ao remover'); }
                                                                                }
                                                                            }}
                                                                            className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity shadow-md hover:bg-red-600 z-20 cursor-pointer"
                                                                        >
                                                                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                                                                        </button>
                                                                    </div>
                                                                )})}
                                                            </div>
                                                        )}

                                                        <button
                                                            disabled={!programData}
                                                            onClick={() => {
                                                                if (!programData) return;
                                                                if (!isCompatible) {
                                                                    const conf = window.confirm(`Atenção: A bitola ${programBitolaOriginal}mm não é o padrão desta máquina. Deseja programar mesmo assim?`);
                                                                    if (!conf) return;
                                                                }
                                                                handleProgramMachine(day.date, machine.name);
                                                            }}
                                                            className={`w-full h-full min-h-[100px] border-[2px] border-dashed rounded-xl flex flex-col items-center justify-center transition-all duration-200 group/btn pt-6
                                                                ${!programData ? 'border-slate-100 hover:bg-slate-50/50 cursor-default' : 
                                                                  isCompatible 
                                                                    ? 'border-slate-200 hover:border-sky-400 hover:bg-sky-50/80 text-slate-300 hover:text-sky-500 hover:shadow-md hover:scale-[1.02] cursor-pointer' 
                                                                    : 'border-slate-100 hover:border-amber-400 hover:bg-amber-50/50 text-slate-200 hover:text-amber-500 cursor-pointer'}`}
                                                        >
                                                            {programData && (
                                                                <div className="flex flex-col items-center gap-1.5 opacity-0 group-hover/btn:opacity-100 transition-opacity transform translate-y-2 group-hover/btn:translate-y-0">
                                                                    <div className={`p-2 rounded-full ${isCompatible ? 'bg-sky-100 text-sky-500' : 'bg-amber-100 text-amber-500'}`}>
                                                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                                                                    </div>
                                                                    <span className="text-[10px] font-black uppercase tracking-widest mt-1 text-center leading-tight">
                                                                        {isCompatible ? 'Programar Aqui' : 'Forçar Prog.'}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </button>
                                                    </div>
                                                )})}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Máquinas */}
            {isMachinesModalOpen && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-[90vw] max-w-6xl h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-200 bg-indigo-50 flex justify-between items-center shrink-0">
                            <div>
                                <h2 className="text-xl font-black text-indigo-900 uppercase tracking-tight flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600"><rect width="16" height="16" x="4" y="4" rx="2" ry="2"/><rect width="6" height="6" x="9" y="9" rx="1" ry="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/></svg>
                                    Painel de Máquinas
                                </h2>
                                <p className="text-xs font-bold text-indigo-700 mt-1 uppercase">Fila de Produção e O.S. Liberadas</p>
                            </div>
                            <button onClick={() => setIsMachinesModalOpen(false)} className="text-slate-400 hover:text-red-500 transition-colors p-2 bg-white hover:bg-red-50 rounded-xl shadow-sm">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="flex flex-1 overflow-hidden">
                            {/* Sidebar de Máquinas */}
                            <div className="w-64 bg-slate-50 border-r border-slate-200 p-4 flex flex-col gap-2 overflow-y-auto">
                                {['Schnell-PRIMA', 'DHE 6P', 'JJW', 'Desbobinadeira', 'Bancada/Cortador'].map(m => {
                                    const machineOsCount = allProgrammedOrders.filter(po => po.machine === m && (po.status === 'in_progress' || po.status === 'producing')).length;
                                    return (
                                        <button 
                                            key={m}
                                            onClick={() => {
                                                setSelectedMachineTab(m);
                                                setMachineSearchQuery('');
                                            }}
                                            className={`p-4 rounded-xl text-left transition-all font-bold flex items-center justify-between border ${selectedMachineTab === m ? 'bg-indigo-600 text-white border-indigo-700 shadow-md' : 'bg-white text-slate-700 border-slate-200 hover:bg-indigo-50 hover:border-indigo-200'}`}
                                        >
                                            <span className="uppercase text-xs">{m}</span>
                                            {machineOsCount > 0 && (
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full ${selectedMachineTab === m ? 'bg-indigo-500 text-white' : 'bg-indigo-100 text-indigo-700'}`}>
                                                    {machineOsCount}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                            
                            {/* Área Principal de O.S. da Máquina */}
                            <div className="flex-1 bg-white p-6 overflow-y-auto">
                                {!selectedMachineTab ? (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-4 text-slate-200"><rect width="16" height="16" x="4" y="4" rx="2" ry="2"/><rect width="6" height="6" x="9" y="9" rx="1" ry="1"/></svg>
                                        <p className="font-bold uppercase tracking-wider text-sm">Selecione uma máquina ao lado</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-4">
                                            <h3 className="font-black text-slate-800 text-lg uppercase">
                                                Fila: {selectedMachineTab}
                                            </h3>
                                            <div className="flex items-center gap-3">
                                                <button 
                                                    onClick={() => setIsReportModalOpen(true)}
                                                    className="flex items-center gap-2 px-4 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-bold uppercase text-xs rounded-lg transition-colors border border-indigo-200"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/></svg>
                                                    Ver Relatório Diário
                                                </button>
                                                <div className="relative">
                                                    <input 
                                                        type="text" 
                                                        value={machineSearchQuery}
                                                        onChange={e => setMachineSearchQuery(e.target.value)}
                                                        placeholder="Buscar O.S..."
                                                        className="w-56 pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all uppercase"
                                                    />
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                                        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
                                                    </svg>
                                                </div>
                                            </div>
                                        </div>

                                        {(() => {
                                            // Normalize field access: works with both camelCase (Realtime) and snake_case (local fetch)
                                            const getField = (po: any, snake: string, camel: string) => po[snake] ?? po[camel];

                                            const osList = allProgrammedOrders.filter(po => {
                                                const machine = getField(po, 'machine', 'machine');
                                                const status = getField(po, 'status', 'status');
                                                const matchMachine = String(machine).trim().toLowerCase() === String(selectedMachineTab).trim().toLowerCase();
                                                const matchStatus = status === 'in_progress' || status === 'producing';
                                                const orderNum = getField(po, 'order_number', 'orderNumber');
                                                const matchQuery = !machineSearchQuery || String(orderNum).toLowerCase().includes(machineSearchQuery.toLowerCase());
                                                return matchMachine && matchStatus && matchQuery;
                                            });

                                            // Machine online status - uses liveUsers (polled directly from DB every 3s)
                                            const operatorsAssigned = liveUsers.filter(u => 
                                                u.assignedMachines?.some(m => m.toLowerCase() === selectedMachineTab.toLowerCase())
                                            );
                                            const isOperatorOnline = operatorsAssigned.some(u => u.isOnline);
                                            const hasAssignedOperator = operatorsAssigned.length > 0;

                                            // Check if any OS is actively producing
                                            const isAnyProducing = osList.some(po => {
                                                const poStatus = getField(po, 'status', 'status');
                                                let progressObj = getField(po, 'sub_items_progress', 'subItemsProgress');
                                                if (typeof progressObj === 'string') {
                                                    try { progressObj = JSON.parse(progressObj); } catch(e) { progressObj = {}; }
                                                }
                                                progressObj = progressObj || {};
                                                const producingEntry = Object.values(progressObj).some((val: any) => val && typeof val === 'object' && val.status === 'producing');
                                                return poStatus === 'producing' || producingEntry;
                                            });

                                            if (osList.length === 0) {
                                                return (
                                                    <div className="space-y-3">
                                                        {/* Status da máquina */}
                                                        <div className={`flex items-center gap-3 p-4 rounded-xl border ${hasAssignedOperator && !isOperatorOnline ? 'bg-rose-50 border-rose-200' : isOperatorOnline ? (currentMachineStop ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200') : 'bg-slate-50 border-slate-200'}`}>
                                                            <div className={`w-3 h-3 rounded-full ${hasAssignedOperator && !isOperatorOnline ? 'bg-rose-500' : isOperatorOnline ? (currentMachineStop ? 'bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'bg-orange-400 animate-pulse shadow-[0_0_8px_rgba(251,146,60,0.8)]') : 'bg-slate-400'}`}></div>
                                                            <div>
                                                                <p className={`text-xs font-black uppercase tracking-wide ${hasAssignedOperator && !isOperatorOnline ? 'text-rose-600' : isOperatorOnline ? (currentMachineStop ? 'text-red-700' : 'text-orange-600') : 'text-slate-600'}`}>
                                                                    {hasAssignedOperator && !isOperatorOnline ? '🔴 Máquina Desligada' : isOperatorOnline ? (currentMachineStop ? '🔴 Máquina Parada' : '🟠 Máquina Parada') : '⚪ Sem operador vinculado'}
                                                                </p>
                                                                <p className={`text-[10px] mt-0.5 font-bold ${currentMachineStop || isOperatorOnline ? (currentMachineStop ? 'text-red-500' : 'text-orange-500') : 'text-slate-500'}`}>
                                                                    {hasAssignedOperator && !isOperatorOnline ? 'Turno não iniciado' : isOperatorOnline ? (currentMachineStop ? `Motivo: ${currentMachineStop.reason}` : 'Aguardando O.S.') : 'Nenhuma O.S. na fila'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                                                            <p className="text-slate-400 font-bold uppercase text-xs">Nenhuma O.S. liberada para esta máquina</p>
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div className="space-y-3">
                                                    {/* Banner status do operador */}
                                                    <div className={`flex items-center gap-3 p-3 rounded-xl border ${hasAssignedOperator && !isOperatorOnline ? 'bg-rose-50 border-rose-200' : isOperatorOnline ? (currentMachineStop ? 'bg-red-50 border-red-200' : (!isAnyProducing ? 'bg-orange-50 border-orange-200' : 'bg-emerald-50 border-emerald-200')) : 'bg-amber-50 border-amber-200'}`}>
                                                        <div className={`w-3 h-3 rounded-full shrink-0 ${hasAssignedOperator && !isOperatorOnline ? 'bg-rose-500' : isOperatorOnline ? (currentMachineStop ? 'bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]' : (!isAnyProducing ? 'bg-orange-400 animate-pulse shadow-[0_0_8px_rgba(251,146,60,0.8)]' : 'bg-emerald-500 animate-pulse')) : 'bg-amber-500'}`}></div>
                                                        <div className="flex flex-col">
                                                            <p className={`text-xs font-black uppercase tracking-wide ${hasAssignedOperator && !isOperatorOnline ? 'text-rose-600' : isOperatorOnline ? (currentMachineStop ? 'text-red-700' : (!isAnyProducing ? 'text-orange-600' : 'text-emerald-700')) : 'text-amber-700'}`}>
                                                                {hasAssignedOperator && !isOperatorOnline ? '🔴 Operador Offline — Turno não iniciado' 
                                                                 : isOperatorOnline ? (currentMachineStop ? '🔴 MÁQUINA PARADA' : (!isAnyProducing ? '🟠 MÁQUINA PARADA' : `🟢 ${operatorsAssigned.find(u=>u.isOnline)?.username || 'Operador'} está online`)) 
                                                                 : '⚪ Sem operador vinculado'}
                                                            </p>
                                                            {isOperatorOnline && currentMachineStop && (
                                                                <p className="text-[10px] font-bold text-red-500 uppercase mt-0.5">Motivo: {currentMachineStop.reason}</p>
                                                            )}
                                                            {isOperatorOnline && !currentMachineStop && !isAnyProducing && (
                                                                <p className="text-[10px] font-bold text-orange-500 uppercase mt-0.5">Aguardando início de O.S.</p>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Lista de O.S. */}
                                                    <div className="grid gap-3">
                                                        {osList.map((po, idx) => {
                                                            const poId = getField(po, 'id', 'id');
                                                            const orderNum = getField(po, 'order_number', 'orderNumber');
                                                            const targetBitola = getField(po, 'target_bitola', 'targetBitola');
                                                            const quantityOs = getField(po, 'quantity_os', 'quantityOs');
                                                            const totalWeight = getField(po, 'total_weight', 'totalWeight');
                                                            const relatedId = getField(po, 'related_commercial_order_id', 'relatedCommercialOrderId');
                                                            const startTime = getField(po, 'start_time', 'startTime');
                                                            const poStatus = getField(po, 'status', 'status');
                                                            
                                                            const commOrder = commercialOrders.find(co => co.id === relatedId);
                                                            const isProducing = poStatus === 'producing';

                                                            // Parse sub_items_progress
                                                            let progressObj = getField(po, 'sub_items_progress', 'subItemsProgress');
                                                            if (typeof progressObj === 'string') {
                                                                try { progressObj = JSON.parse(progressObj); } catch(e) { progressObj = {}; }
                                                            }
                                                            progressObj = progressObj || {};

                                                            const entries = Object.entries(progressObj);
                                                            const producingEntry = entries.find(([_, val]: any) => val && typeof val === 'object' && val.status === 'producing');
                                                            const isActuallyProducing = isProducing || !!producingEntry;

                                                            const completedPieces = Object.values(progressObj).filter((v: any) => v && typeof v === 'object' && v.status === 'completed').length;
                                                            const totalPieces = Number(quantityOs) || 1;
                                                            const progressPercent = Math.min(100, Math.round((completedPieces / totalPieces) * 100));

                                                            // Determine card color
                                                            let cardBorder = 'border-slate-200';
                                                            let cardBg = 'bg-white';
                                                            if (isActuallyProducing && producingEntry) {
                                                                cardBorder = 'border-orange-400 ring-2 ring-orange-100';
                                                                cardBg = 'bg-orange-50/30';
                                                            } else if (isActuallyProducing) {
                                                                cardBorder = 'border-amber-300 ring-1 ring-amber-100';
                                                                cardBg = 'bg-amber-50/30';
                                                            } else if (hasAssignedOperator && !isOperatorOnline) {
                                                                cardBorder = 'border-rose-200';
                                                            } else if (isOperatorOnline) {
                                                                cardBorder = 'border-emerald-200';
                                                            }

                                                            return (
                                                                <div key={poId || idx} className={`${cardBg} border-2 ${cardBorder} rounded-xl p-4 shadow-sm transition-all hover:shadow-md`}>
                                                                    {/* Header */}
                                                                    <div className="flex items-start justify-between mb-3">
                                                                        <div className="flex items-center gap-2 flex-wrap">
                                                                            <span className="bg-indigo-100 text-indigo-800 font-black text-[10px] px-2 py-0.5 rounded uppercase">O.S. #{orderNum}</span>
                                                                            {commOrder?.orderNumber && (
                                                                                <span className="bg-slate-100 text-slate-600 font-bold text-[10px] px-2 py-0.5 rounded uppercase">Pedido {commOrder.orderNumber}</span>
                                                                            )}
                                                                            {isActuallyProducing && (
                                                                                <span className={`font-black text-[9px] px-2 py-0.5 rounded uppercase animate-pulse ${producingEntry ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'}`}>
                                                                                    {producingEntry ? '✂️ Cortando' : '▶ Em Produção'}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        
                                                                        {/* Action buttons */}
                                                                        {isActuallyProducing ? (
                                                                            <button 
                                                                                onClick={() => handleFinishProduction(poId)}
                                                                                className="bg-red-50 hover:bg-red-100 text-red-600 font-bold px-3 py-1.5 rounded-lg text-[10px] uppercase shadow-sm transition-colors border border-red-200 shrink-0"
                                                                            >
                                                                                Forçar Fim
                                                                            </button>
                                                                        ) : (
                                                                            <button 
                                                                                onClick={() => handleStartProduction(poId)}
                                                                                className="bg-slate-100 hover:bg-emerald-100 hover:text-emerald-700 text-slate-600 font-bold px-3 py-1.5 rounded-lg text-[10px] uppercase shadow-sm transition-colors border border-slate-200 shrink-0"
                                                                            >
                                                                                Forçar Início
                                                                            </button>
                                                                        )}
                                                                    </div>

                                                                    {/* Details */}
                                                                    <p className="text-xs font-bold text-slate-700 mb-1">
                                                                        Bitola {targetBitola}mm • {quantityOs} Un. • {parseFloat(String(totalWeight || '0')).toFixed(2)} kg
                                                                    </p>
                                                                    <p className="text-[10px] font-medium text-slate-500 mb-3">Cliente: {commOrder?.clientName || 'N/A'}</p>

                                                                    {/* Progress bar */}
                                                                    <div className="mb-3">
                                                                        <div className="flex justify-between text-[9px] font-black uppercase mb-1">
                                                                            <span className="text-slate-500">Progresso</span>
                                                                            <span className="text-indigo-600">{progressPercent}% ({completedPieces}/{totalPieces} peças)</span>
                                                                        </div>
                                                                        <div className="w-full bg-slate-100 rounded-full h-2.5">
                                                                            <div 
                                                                                className={`h-2.5 rounded-full transition-all duration-500 ${completedPieces >= totalPieces ? 'bg-emerald-500' : 'bg-indigo-500'}`} 
                                                                                style={{ width: `${progressPercent}%` }}
                                                                            ></div>
                                                                        </div>
                                                                    </div>

                                                                    {/* Status & Timer */}
                                                                    <div className={`flex items-center justify-between p-2.5 rounded-lg ${isActuallyProducing ? (producingEntry ? 'bg-orange-50 border border-orange-200' : 'bg-amber-50 border border-amber-200') : (hasAssignedOperator && !isOperatorOnline ? 'bg-rose-50 border border-rose-200' : 'bg-slate-50 border border-slate-200')}`}>
                                                                        <div>
                                                                            {isActuallyProducing ? (
                                                                                producingEntry ? (
                                                                                    <div>
                                                                                        <p className="text-[9px] font-black text-orange-600 uppercase tracking-widest">✂️ Cortando peça #{(producingEntry[0] as string).replace('sub_', '')}</p>
                                                                                        <p className="text-[9px] text-orange-500 font-bold">Tempo de corte ativo</p>
                                                                                    </div>
                                                                                ) : (
                                                                                    <div>
                                                                                        <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest">▶ Produção Iniciada</p>
                                                                                        <p className="text-[9px] text-amber-500 font-bold">Tempo desde início</p>
                                                                                    </div>
                                                                                )
                                                                            ) : (hasAssignedOperator && !isOperatorOnline) ? (
                                                                                <div>
                                                                                    <p className="text-[9px] font-black text-rose-600 uppercase tracking-widest">🔴 Máquina Desligada</p>
                                                                                    <p className="text-[9px] text-rose-500 font-bold">Turno não iniciado</p>
                                                                                </div>
                                                                            ) : isOperatorOnline ? (
                                                                                <div>
                                                                                    <p className={`text-[9px] font-black uppercase tracking-widest ${currentMachineStop ? 'text-red-600 animate-pulse' : 'text-orange-500 animate-pulse'}`}>{currentMachineStop ? '🔴 Máquina Parada' : '🟠 Máquina Parada'}</p>
                                                                                    <p className={`text-[9px] font-bold ${currentMachineStop ? 'text-red-500' : 'text-orange-500'}`}>{currentMachineStop ? `Motivo: ${currentMachineStop.reason}` : 'Aguardando início da O.S.'}</p>
                                                                                </div>
                                                                            ) : (
                                                                                <div>
                                                                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">⚪ Aguardando</p>
                                                                                    <p className="text-[9px] text-slate-400 font-bold">Sem operador vinculado</p>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        {/* Live Timer */}
                                                                        {isActuallyProducing && (
                                                                            <div className="text-right">
                                                                                <ActiveTimer 
                                                                                    startTime={
                                                                                        producingEntry 
                                                                                            ? ((producingEntry[1] as any).start_time || (producingEntry[1] as any).startTime)
                                                                                            : (startTime as string)
                                                                                    } 
                                                                                />
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Modal de Relatório Diário */}
            {isReportModalOpen && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-[90vw] max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-200 bg-indigo-50 flex justify-between items-center shrink-0">
                            <div>
                                <h2 className="text-xl font-black text-indigo-900 uppercase tracking-tight flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/></svg>
                                    Relatório de Produção: {selectedMachineTab}
                                </h2>
                                <p className="text-xs font-bold text-indigo-700 mt-1 uppercase">Acompanhamento Diário da Máquina</p>
                            </div>
                            <button onClick={() => setIsReportModalOpen(false)} className="text-slate-400 hover:text-red-500 transition-colors p-2 bg-white hover:bg-red-50 rounded-xl shadow-sm">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto bg-slate-50 flex-1">
                            {(() => {
                                const getField = (po: any, snake: string, camel: string) => po[snake] ?? po[camel];
                                const getParsedProgress = (po: any) => typeof po.sub_items_progress === 'string' ? JSON.parse(po.sub_items_progress) : (po.sub_items_progress || {});

                                // 1. Operador atual e horário
                                const operatorsAssigned = liveUsers.filter(u => u.assignedMachines?.some(m => m.toLowerCase() === selectedMachineTab?.toLowerCase()));
                                const isOperatorOnline = operatorsAssigned.some(u => u.isOnline);
                                const currentOp = operatorsAssigned.find(u => u.isOnline);
                                const shiftStartStr = currentOp && (currentOp as any).current_shift_start ? new Date((currentOp as any).current_shift_start).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}) : '--:--';

                                // 2. Coletar e formatar todas as sub-O.S trabalhadas
                                const reportItems: any[] = [];
                                allProgrammedOrders.forEach(po => {
                                    if (String(getField(po, 'machine', 'machine')).trim().toLowerCase() !== String(selectedMachineTab).trim().toLowerCase()) return;
                                    
                                    const progress = getParsedProgress(po);
                                    Object.entries(progress).forEach(([subKey, val]: [string, any]) => {
                                        if (val && typeof val === 'object' && val.start_time) {
                                            const subNum = subKey.replace('sub_', '');
                                            const osNum = getField(po, 'order_number', 'orderNumber');
                                            
                                            // Calcula a duração
                                            let durationStr = 'Em andamento';
                                            if (val.end_time) {
                                                const dStart = new Date(val.start_time);
                                                const dEnd = new Date(val.end_time);
                                                const diffS = Math.floor((dEnd.getTime() - dStart.getTime()) / 1000);
                                                const m = Math.floor(diffS / 60);
                                                const s = diffS % 60;
                                                durationStr = `${m}m ${s}s`;
                                            }

                                            reportItems.push({
                                                osNum,
                                                subNum,
                                                startTimeRaw: val.start_time,
                                                endTimeRaw: val.end_time,
                                                startTimeStr: new Date(val.start_time).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit', second:'2-digit'}),
                                                endTimeStr: val.end_time ? new Date(val.end_time).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit', second:'2-digit'}) : '--:--:--',
                                                durationStr,
                                                status: val.status
                                            });
                                        }
                                    });
                                });

                                const formatDuration = (s: number) => {
                                    const h = Math.floor(s / 3600);
                                    const m = Math.floor((s % 3600) / 60);
                                    const sec = s % 60;
                                    if (h > 0) return `${h}h ${m}m ${sec}s`;
                                    return `${m}m ${sec}s`;
                                };

                                let totalProductionS = 0;
                                let totalStopS = 0;
                                const nowTime = new Date().getTime();

                                const timelineEvents: any[] = [];

                                // 1. Shifts
                                dailyShifts.forEach((shift: any) => {
                                    timelineEvents.push({
                                        id: `shift_start_${shift.id}`,
                                        timestampRaw: shift.start_time,
                                        label: 'Início do Turno',
                                        details: 'Turno iniciado',
                                        operator: shift.username,
                                        icon: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 3v18"/><path d="m19 9-7 7-7-7"/></svg>,
                                        colorClass: 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                    });
                                    if (shift.end_time) {
                                        timelineEvents.push({
                                            id: `shift_end_${shift.id}`,
                                            timestampRaw: shift.end_time,
                                            label: 'Fim do Turno',
                                            details: 'Turno finalizado',
                                            operator: shift.username,
                                            icon: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>,
                                            colorClass: 'bg-slate-200 text-slate-700 border-slate-300'
                                        });
                                    }
                                });

                                // 2. Stops
                                machineStops.forEach((stop: any) => {
                                    const dStart = new Date(stop.start_time).getTime();
                                    const dEnd = stop.end_time ? new Date(stop.end_time).getTime() : nowTime;
                                    const durS = Math.floor(Math.max(0, dEnd - dStart) / 1000);
                                    totalStopS += durS;

                                    timelineEvents.push({
                                        id: `stop_start_${stop.id}`,
                                        timestampRaw: stop.start_time,
                                        label: 'Máquina Parada',
                                        details: `Motivo: ${stop.reason || 'Não informado'}`,
                                        operator: stop.username,
                                        icon: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>,
                                        colorClass: 'bg-rose-100 text-rose-700 border-rose-200'
                                    });
                                    if (stop.end_time) {
                                        timelineEvents.push({
                                            id: `stop_end_${stop.id}`,
                                            timestampRaw: stop.end_time,
                                            label: 'Retorno à Produção',
                                            details: `Voltou de: ${stop.reason || 'Não informado'} (Parado por ${formatDuration(durS)})`,
                                            operator: stop.username,
                                            icon: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
                                            colorClass: 'bg-indigo-100 text-indigo-700 border-indigo-200'
                                        });
                                    }
                                });

                                // 3. Cuts
                                reportItems.forEach((item, idx) => {
                                    const dStart = new Date(item.startTimeRaw).getTime();
                                    const dEnd = item.endTimeRaw ? new Date(item.endTimeRaw).getTime() : nowTime;
                                    const durS = Math.floor(Math.max(0, dEnd - dStart) / 1000);
                                    totalProductionS += durS;

                                    timelineEvents.push({
                                        id: `cut_start_${item.osNum}_${item.subNum}_${idx}`,
                                        timestampRaw: item.startTimeRaw,
                                        label: 'Início de Corte',
                                        details: `O.S. #${item.osNum} - POS ${item.subNum}`,
                                        operator: 'Sistema',
                                        icon: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>,
                                        colorClass: 'bg-amber-100 text-amber-700 border-amber-200'
                                    });
                                    if (item.endTimeRaw) {
                                        timelineEvents.push({
                                            id: `cut_end_${item.osNum}_${item.subNum}_${idx}`,
                                            timestampRaw: item.endTimeRaw,
                                            label: 'Fim de Corte',
                                            details: `O.S. #${item.osNum} - POS ${item.subNum} (Cortando por ${formatDuration(durS)})`,
                                            operator: 'Sistema',
                                            icon: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7"/></svg>,
                                            colorClass: 'bg-blue-100 text-blue-700 border-blue-200'
                                        });
                                    }
                                });

                                // Sort timeline
                                timelineEvents.sort((a, b) => new Date(b.timestampRaw).getTime() - new Date(a.timestampRaw).getTime());

                                return (
                                    <div className="space-y-6">
                                        {/* Metricas */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className={`p-4 rounded-xl border flex items-center justify-between ${isOperatorOnline ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-100 border-slate-200'}`}>
                                                <div>
                                                    <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Operador Logado</p>
                                                    <p className={`text-sm font-bold mt-0.5 ${isOperatorOnline ? 'text-emerald-800' : 'text-slate-700'}`}>
                                                        {currentOp ? currentOp.username : 'Nenhum operador online'}
                                                    </p>
                                                </div>
                                                <div className={`w-3 h-3 rounded-full ${isOperatorOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></div>
                                            </div>
                                            
                                            <div className="p-4 rounded-xl border bg-blue-50 border-blue-200 flex items-center justify-between">
                                                <div>
                                                    <p className="text-[10px] font-black uppercase text-blue-500 tracking-wider">Tempo em Produção</p>
                                                    <p className="text-xl font-bold mt-0.5 text-blue-800">
                                                        {formatDuration(totalProductionS)}
                                                    </p>
                                                </div>
                                                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                                </div>
                                            </div>

                                            <div className="p-4 rounded-xl border bg-rose-50 border-rose-200 flex items-center justify-between">
                                                <div>
                                                    <p className="text-[10px] font-black uppercase text-rose-500 tracking-wider">Tempo de Parada</p>
                                                    <p className="text-xl font-bold mt-0.5 text-rose-800">
                                                        {formatDuration(totalStopS)}
                                                    </p>
                                                </div>
                                                <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Linha do Tempo */}
                                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                                                <h4 className="font-black text-slate-800 uppercase text-xs flex items-center gap-2">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><path d="M12 2v20"/><path d="m8 6 4-4 4 4"/><path d="m8 18 4 4 4-4"/></svg>
                                                    Linha do Tempo (Sequencial)
                                                </h4>
                                                <span className="text-[10px] font-bold text-slate-500">{timelineEvents.length} eventos</span>
                                            </div>
                                            
                                            <div className="p-4 max-h-[60vh] overflow-y-auto">
                                                {timelineEvents.length === 0 ? (
                                                    <div className="py-8 text-center text-slate-400 text-sm font-bold">Nenhum evento registrado hoje.</div>
                                                ) : (
                                                    <div className="relative border-l-2 border-slate-200 ml-4 space-y-6 pb-4">
                                                        {timelineEvents.map((ev, i) => (
                                                            <div key={ev.id} className="relative pl-6">
                                                                <div className={`absolute -left-[17px] top-1 w-8 h-8 rounded-full border-2 bg-white flex items-center justify-center shadow-sm z-10 ${ev.colorClass}`}>
                                                                    {ev.icon}
                                                                </div>
                                                                <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
                                                                    <div className="flex justify-between items-start">
                                                                        <div className="flex flex-col">
                                                                            <span className={`text-[11px] font-black uppercase tracking-wider ${ev.colorClass.split(' ')[1]}`}>{ev.label}</span>
                                                                            <span className="text-sm font-bold text-slate-800 mt-0.5">{ev.details}</span>
                                                                        </div>
                                                                        <div className="flex flex-col items-end">
                                                                            <span className="text-xs font-bold text-slate-500">{new Date(ev.timestampRaw).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit', second:'2-digit'})}</span>
                                                                            <span className="text-[10px] font-bold text-slate-400 uppercase mt-1">{ev.operator}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
