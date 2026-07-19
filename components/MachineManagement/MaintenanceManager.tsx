import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

interface MaintenanceManagerProps {
    activeBrandingPartner?: any;
    machineFilter?: string;
}

const MaintenanceManager: React.FC<MaintenanceManagerProps> = ({ activeBrandingPartner, machineFilter }) => {
    const [maintenances, setMaintenances] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'Todas' | 'Planejada' | 'Aguardando Mecânico' | 'Em Andamento' | 'Encerrada'>('Todas');
    const [mechanicModal, setMechanicModal] = useState<{show: boolean, maintenanceId: string | null, mechanicName: string}>({show: false, maintenanceId: null, mechanicName: ''});

    // Form state
    const [machineName, setMachineName] = useState('');
    
    // Set initial machine name if options exist
    useEffect(() => {
        if (activeBrandingPartner?.machines?.length > 0 && !machineName) {
            setMachineName(activeBrandingPartner.machines[0].name);
        }
    }, [activeBrandingPartner]);

    const [maintenanceType, setMaintenanceType] = useState('Preventiva');
    const [tasks, setTasks] = useState<{id?: string, description: string}[]>([{ description: '' }]);
    const [description, setDescription] = useState('');
    const [technicianName, setTechnicianName] = useState('');
    const [cost, setCost] = useState('');
    const [status, setStatus] = useState('Pendente');
    const [scheduledDate, setScheduledDate] = useState('');

    const openNewModal = () => {
        setEditingId(null);
        setMachineName(machineFilter || (activeBrandingPartner?.machines?.length > 0 ? activeBrandingPartner.machines[0].name : ''));
        setMaintenanceType('Preventiva');
        setTasks([{ description: '' }]);
        setDescription('');
        setTechnicianName('');
        setCost('');
        setStatus('Planejada');
        setScheduledDate('');
        setShowModal(true);
    };

    const handleEditMaintenance = async (maintenance: any) => {
        setEditingId(maintenance.id);
        setMachineName(maintenance.machine_name);
        setMaintenanceType(maintenance.maintenance_type);
        setDescription(maintenance.description || '');
        setTechnicianName(maintenance.technician_name || '');
        
        // Fetch tasks
        try {
            const { data } = await supabase
                .from('machine_maintenance_tasks')
                .select('*')
                .eq('maintenance_id', maintenance.id)
                .order('created_at', { ascending: true });
            
            if (data && data.length > 0) {
                setTasks(data.map(t => ({ id: t.id, description: t.description })));
            } else {
                setTasks([{ description: maintenance.description || '' }]);
            }
        } catch (error) {
            console.error('Error fetching tasks:', error);
            setTasks([{ description: maintenance.description || '' }]);
        }
        setCost(maintenance.cost ? maintenance.cost.toString() : '');
        setStatus(maintenance.status);
        setScheduledDate(maintenance.scheduled_date ? maintenance.scheduled_date.split('T')[0] : '');
        setShowModal(true);
    };

    useEffect(() => {
        fetchMaintenances();
    }, [machineFilter]);

    const fetchMaintenances = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('machine_maintenance')
                .select('*')
                .order('created_at', { ascending: false });
                
            if (machineFilter) {
                query = query.eq('machine_name', machineFilter);
            }
            
            const { data, error } = await query;
            
            if (error) {
                console.error('Error fetching maintenances:', error);
            } else {
                setMaintenances(data || []);
            }
        } catch (err) {
            console.error('Error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Filter out empty tasks
        const validTasks = tasks.filter(t => t.description.trim() !== '');
        if (validTasks.length === 0) {
            alert('Adicione pelo menos um problema/serviço.');
            return;
        }

        setSaving(true);
        try {
            const summary = validTasks.map((t, idx) => `${idx + 1}º ${t.description.trim()}`).join('\n');
            
            const payload = {
                machine_name: machineName,
                maintenance_type: maintenanceType,
                description: summary,
                technician_name: technicianName,
                cost: cost ? parseFloat(cost) : 0,
                status,
                scheduled_date: scheduledDate || null
            };

            let maintenanceId = editingId;

            if (editingId) {
                const { error } = await supabase
                    .from('machine_maintenance')
                    .update(payload)
                    .eq('id', editingId);
                if (error) throw error;
            } else {
                const { data, error } = await supabase
                    .from('machine_maintenance')
                    .insert([payload])
                    .select()
                    .single();
                if (error) throw error;
                maintenanceId = data.id;
            }

            // Save tasks
            if (maintenanceId) {
                // If editing, delete old tasks (simplest way to handle removed tasks)
                if (editingId) {
                    await supabase.from('machine_maintenance_tasks').delete().eq('maintenance_id', editingId);
                }
                
                const tasksPayload = validTasks.map(t => ({
                    maintenance_id: maintenanceId,
                    description: t.description.trim(),
                    status: 'Pendente'
                }));
                
                await supabase.from('machine_maintenance_tasks').insert(tasksPayload);
            }

            setShowModal(false);
            fetchMaintenances();
            
            setEditingId(null);
            setMachineName('');
            setMaintenanceType('Preventiva');
            setTasks([{ description: '' }]);
            setDescription('');
            setTechnicianName('');
            setCost('');
            setStatus('Planejada');
            setScheduledDate('');
        } catch (err) {
            console.error('Error saving maintenance:', err);
            alert('Erro ao salvar manutenção.');
        } finally {
            setSaving(false);
        }
    };

    const updateStatus = async (id: string, newStatus: string, extraData: any = {}) => {
        try {
            const { error } = await supabase
                .from('machine_maintenance')
                .update({ status: newStatus, ...extraData })
                .eq('id', id);
            if (error) throw error;
            fetchMaintenances();
        } catch (err) {
            console.error('Error updating status:', err);
            alert('Erro ao atualizar status.');
        }
    };

    const handleExportToMechanic = (id: string) => {
        if (!window.confirm('Exportar esta manutenção para o mecânico?')) return;
        updateStatus(id, 'Aguardando Mecânico');
    };

    const startMechanicMaintenance = (e: React.FormEvent) => {
        e.preventDefault();
        if (mechanicModal.maintenanceId && mechanicModal.mechanicName.trim()) {
            updateStatus(mechanicModal.maintenanceId, 'Em Andamento', { technician_name: mechanicModal.mechanicName });
            setMechanicModal({show: false, maintenanceId: null, mechanicName: ''});
        }
    };

    const filteredMaintenances = maintenances.filter(m => activeTab === 'Todas' || m.status === activeTab);

    return (
        <div className="p-6 relative">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-slate-800">Manutenções</h2>
                <button 
                    onClick={openNewModal}
                    className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-2 px-4 rounded-xl shadow-md transition-all"
                >
                    + Nova Manutenção
                </button>
            </div>

            <div className="flex flex-wrap gap-2 mb-6 p-1.5 bg-slate-100 rounded-xl w-fit">
                {['Todas', 'Planejada', 'Aguardando Mecânico', 'Em Andamento', 'Encerrada'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                            activeTab === tab 
                            ? 'bg-white text-sky-700 shadow-sm border border-slate-200/50' 
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                        }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600"></div></div>
            ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                                <th className="p-4 font-bold">Máquina</th>
                                <th className="p-4 font-bold">Tipo</th>
                                <th className="p-4 font-bold">Responsável</th>
                                <th className="p-4 font-bold">Status</th>
                                <th className="p-4 font-bold">Data Agendada</th>
                                <th className="p-4 font-bold text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredMaintenances.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-slate-500 font-medium">Nenhuma manutenção encontrada para este filtro.</td>
                                </tr>
                            ) : (
                                filteredMaintenances.map(item => (
                                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4 font-bold text-slate-800">{item.machine_name}</td>
                                        <td className="p-4 text-slate-600">{item.maintenance_type}</td>
                                        <td className="p-4 text-slate-600">{item.technician_name || '-'}</td>
                                        <td className="p-4">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                                item.status === 'Planejada' ? 'bg-amber-100 text-amber-700' :
                                                item.status === 'Aguardando Mecânico' ? 'bg-orange-100 text-orange-700' :
                                                item.status === 'Em Andamento' ? 'bg-sky-100 text-sky-700' :
                                                item.status === 'Encerrada' ? 'bg-emerald-100 text-emerald-700' :
                                                'bg-slate-100 text-slate-700'
                                            }`}>
                                                {item.status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-slate-600">
                                            {item.scheduled_date ? new Date(item.scheduled_date).toLocaleDateString('pt-BR') : '-'}
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {item.status === 'Planejada' && (
                                                    <button 
                                                        onClick={() => handleExportToMechanic(item.id)}
                                                        className="text-amber-600 hover:text-amber-800 font-bold text-sm bg-amber-50 px-3 py-1.5 rounded-lg transition-colors"
                                                    >
                                                        Exportar para Mecânico
                                                    </button>
                                                )}
                                                {item.status === 'Aguardando Mecânico' && (
                                                    <button 
                                                        onClick={() => setMechanicModal({show: true, maintenanceId: item.id, mechanicName: ''})}
                                                        className="text-orange-600 hover:text-orange-800 font-bold text-sm bg-orange-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" /></svg>
                                                        Iniciar
                                                    </button>
                                                )}
                                                {item.status === 'Em Andamento' && (
                                                    <button 
                                                        onClick={() => {
                                                            if(window.confirm('Deseja finalizar esta manutenção?')) updateStatus(item.id, 'Encerrada');
                                                        }}
                                                        className="text-emerald-600 hover:text-emerald-800 font-bold text-sm bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                                                        Finalizar
                                                    </button>
                                                )}
                                                {item.status === 'Planejada' && (
                                                    <button 
                                                        onClick={() => handleEditMaintenance(item)}
                                                        className="text-sky-600 hover:text-sky-800 font-bold text-sm bg-sky-50 px-3 py-1.5 rounded-lg transition-colors"
                                                    >
                                                        Editar
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-slate-800">{editingId ? 'Editar Manutenção' : 'Nova Manutenção'}</h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 flex flex-col gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Máquina *</label>
                                {activeBrandingPartner?.machines?.length > 0 ? (
                                    <select required value={machineName} onChange={e => setMachineName(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/50 text-slate-700">
                                        <option value="">Selecione uma máquina</option>
                                        {activeBrandingPartner.machines.map((m: any, idx: number) => (
                                            <option key={idx} value={m.name}>{m.name}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <input required value={machineName} onChange={e => setMachineName(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/50 text-slate-700" placeholder="Ex: Trefila 1" />
                                )}
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo de Manutenção</label>
                                    <select value={maintenanceType} onChange={e => setMaintenanceType(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/50 text-slate-700">
                                        <option value="Preventiva">Preventiva</option>
                                        <option value="Corretiva">Corretiva</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                                    <select value={status} onChange={e => setStatus(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/50 text-slate-700">
                                        <option value="Planejada">Planejada</option>
                                        <option value="Aguardando Mecânico">Aguardando Mecânico</option>
                                        <option value="Em Andamento">Em Andamento</option>
                                        <option value="Encerrada">Encerrada</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-xs font-bold text-slate-500 uppercase">Problemas / Serviços a realizar *</label>
                                </div>
                                <div className="flex flex-col gap-3">
                                    {tasks.map((task, index) => (
                                        <div key={index} className="flex gap-2 items-start">
                                            <div className="pt-2.5 font-bold text-slate-400 text-sm w-6 shrink-0 text-right">{index + 1}º</div>
                                            <textarea 
                                                required
                                                rows={2} 
                                                value={task.description} 
                                                onChange={e => {
                                                    const newTasks = [...tasks];
                                                    newTasks[index].description = e.target.value;
                                                    setTasks(newTasks);
                                                }} 
                                                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/50 text-slate-700 resize-none"
                                                placeholder={`Descreva o ${index + 1}º problema ou serviço`}
                                            ></textarea>
                                            <button 
                                                type="button"
                                                onClick={() => {
                                                    if (tasks.length > 1) {
                                                        setTasks(tasks.filter((_, i) => i !== index));
                                                    }
                                                }}
                                                className={`p-2 rounded-lg mt-1 transition-colors ${tasks.length > 1 ? 'text-red-400 hover:bg-red-50 hover:text-red-600' : 'text-slate-200 cursor-not-allowed'}`}
                                                disabled={tasks.length <= 1}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <button 
                                    type="button" 
                                    onClick={() => setTasks([...tasks, { description: '' }])}
                                    className="mt-3 text-sm font-bold text-sky-600 hover:text-sky-800 flex items-center gap-1 ml-8"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                                    Adicionar novo problema
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Responsável / Técnico</label>
                                    <input value={technicianName} onChange={e => setTechnicianName(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/50 text-slate-700" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data Agendada</label>
                                    <input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/50 text-slate-700" />
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Custo Estimado (R$)</label>
                                <input type="number" step="0.01" value={cost} onChange={e => setCost(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/50 text-slate-700" placeholder="0.00" />
                            </div>

                            <div className="mt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors">
                                    Cancelar
                                </button>
                                <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-xl font-bold text-white bg-sky-600 hover:bg-sky-700 transition-colors disabled:opacity-50 flex items-center gap-2">
                                    {saving && <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                                    {saving ? 'Salvando...' : 'Salvar Manutenção'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {mechanicModal.show && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-orange-50">
                            <h3 className="text-lg font-bold text-orange-800 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" /></svg>
                                Iniciar Manutenção
                            </h3>
                            <button onClick={() => setMechanicModal({show: false, maintenanceId: null, mechanicName: ''})} className="text-orange-400 hover:text-orange-600">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <form onSubmit={startMechanicMaintenance} className="p-6 flex flex-col gap-4">
                            <p className="text-sm text-slate-600 mb-2">Por favor, confirme seu nome para iniciar esta manutenção.</p>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Seu Nome (Mecânico) *</label>
                                <input 
                                    required 
                                    autoFocus
                                    value={mechanicModal.mechanicName} 
                                    onChange={e => setMechanicModal(prev => ({...prev, mechanicName: e.target.value}))} 
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/50 text-slate-700" 
                                    placeholder="Digite seu nome" 
                                />
                            </div>
                            <div className="mt-2 flex justify-end gap-3">
                                <button type="button" onClick={() => setMechanicModal({show: false, maintenanceId: null, mechanicName: ''})} className="px-4 py-2 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors">
                                    Cancelar
                                </button>
                                <button type="submit" disabled={!mechanicModal.mechanicName.trim()} className="px-4 py-2 rounded-xl font-bold text-white bg-orange-500 hover:bg-orange-600 transition-colors disabled:opacity-50">
                                    Começar Serviço
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MaintenanceManager;
