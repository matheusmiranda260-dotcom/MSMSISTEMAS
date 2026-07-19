import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import type { MachineMaintenanceTask } from '../../types';

interface TaskExecutionModalProps {
    maintenanceId: string;
    maintenanceData?: any;
    onClose: () => void;
    onAllTasksCompleted: () => void;
}

const TaskExecutionModal: React.FC<TaskExecutionModalProps> = ({ maintenanceId, maintenanceData, onClose, onAllTasksCompleted }) => {
    const [tasks, setTasks] = useState<MachineMaintenanceTask[]>([]);
    const [taskLogs, setTaskLogs] = useState<Record<string, any[]>>({});
    const [loading, setLoading] = useState(true);

    const [activeTask, setActiveTask] = useState<MachineMaintenanceTask | null>(null);
    const [actionType, setActionType] = useState<'start' | 'finish' | 'request_part' | null>(null);
    const [resolutionNotes, setResolutionNotes] = useState('');
    const [photoBase64, setPhotoBase64] = useState<string | null>(null);
    const [partName, setPartName] = useState('');
    const [partQty, setPartQty] = useState('1');
    const [saving, setSaving] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (maintenanceId) {
            fetchTasksAndLogs();
        }
    }, [maintenanceId]);

    const fetchTasksAndLogs = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('machine_maintenance_tasks')
                .select('*')
                .eq('maintenance_id', maintenanceId)
                .order('created_at', { ascending: true });
            
            if (error) throw error;
            const fetchedTasks = data || [];
            setTasks(fetchedTasks);

            if (fetchedTasks.length > 0) {
                const taskIds = fetchedTasks.map(t => t.id);
                const { data: logsData } = await supabase
                    .from('machine_maintenance_task_logs')
                    .select('*')
                    .in('maintenance_task_id', taskIds)
                    .order('created_at', { ascending: true });
                
                if (logsData) {
                    const logsMap: Record<string, any[]> = {};
                    logsData.forEach(log => {
                        if (!logsMap[log.maintenance_task_id]) {
                            logsMap[log.maintenance_task_id] = [];
                        }
                        logsMap[log.maintenance_task_id].push(log);
                    });
                    setTaskLogs(logsMap);
                }
            }

        } catch (err) {
            console.error('Error fetching tasks:', err);
        } finally {
            setLoading(false);
        }
    };

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setPhotoBase64(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSaveAction = async () => {
        if (!activeTask || !actionType) return;
        setSaving(true);
        try {
            const updatePayload: any = {};
            
            const userName = maintenanceData?.technician_name || 'Mecânico';
            let logDesc = '';

            if (actionType === 'start') {
                updatePayload.status = 'Em Andamento';
                logDesc = `Tarefa Iniciada por ${userName}.`;
                if (photoBase64) {
                    updatePayload.before_image_url = photoBase64;
                    logDesc += ' (Foto anexada)';
                }
            } else if (actionType === 'finish') {
                updatePayload.status = 'Resolvido';
                updatePayload.resolution_notes = resolutionNotes;
                logDesc = `Tarefa Finalizada. Nota: "${resolutionNotes}".`;
                if (photoBase64) {
                    updatePayload.after_image_url = photoBase64;
                    logDesc += ' (Foto anexada)';
                }
            } else if (actionType === 'request_part') {
                // Handle purchase order creation
                const { error: poError } = await supabase
                    .from('machine_purchase_orders')
                    .insert([{
                        part_name: partName,
                        machine_name: maintenanceData?.machine_name || 'Desconhecida',
                        quantity: parseInt(partQty, 10),
                        requester_name: userName,
                        status: 'Pendente',
                        priority: 'Alta',
                        notes: `Peça solicitada via Tarefa: ${activeTask.description}`,
                        maintenance_task_id: activeTask.id
                    }]);
                if (poError) throw poError;

                updatePayload.status = 'Aguardando Peça';
                logDesc = `Peça '${partName}' (${partQty} un) solicitada por ${userName}. Aguardando gestor.`;
            }

            const { error } = await supabase
                .from('machine_maintenance_tasks')
                .update(updatePayload)
                .eq('id', activeTask.id);

            if (error) throw error;

            // Inserir Log
            if (logDesc) {
                await supabase
                    .from('machine_maintenance_task_logs')
                    .insert([{
                        maintenance_task_id: activeTask.id,
                        action_type: actionType,
                        description: logDesc,
                        user_name: userName
                    }]);
            }

            const updatedTasks = tasks.map(t => t.id === activeTask.id ? { ...t, ...updatePayload } : t);
            setTasks(updatedTasks);
            
            // Refresh logs
            fetchTasksAndLogs();
            
            setActiveTask(null);
            setActionType(null);
            setPhotoBase64(null);
            setResolutionNotes('');
            setPartName('');
            setPartQty('1');

            if (updatedTasks.every(t => t.status === 'Resolvido')) {
                onAllTasksCompleted();
            }
        } catch (error) {
            console.error('Error saving task action:', error);
            alert('Erro ao salvar tarefa.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-sky-50">
                    <h3 className="text-lg font-bold text-sky-800 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" /></svg>
                        Tarefas da Manutenção
                    </h3>
                    <button onClick={onClose} className="text-sky-400 hover:text-sky-600">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex justify-center p-8">
                            <svg className="animate-spin h-8 w-8 text-sky-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        </div>
                    ) : tasks.length === 0 ? (
                        <div className="text-center text-slate-500 p-8">
                            Nenhuma tarefa encontrada para esta manutenção.
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            {tasks.map((task, idx) => (
                                <div key={task.id} className="border border-slate-200 rounded-xl p-4 flex flex-col gap-3">
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-black text-slate-400 text-sm">{idx + 1}º</span>
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                                    task.status === 'Resolvido' ? 'bg-emerald-100 text-emerald-700' :
                                                    task.status === 'Em Andamento' ? 'bg-sky-100 text-sky-700' :
                                                    task.status === 'Aguardando Peça' ? 'bg-purple-100 text-purple-700' :
                                                    'bg-orange-100 text-orange-700'
                                                }`}>
                                                    {task.status}
                                                </span>
                                            </div>
                                            <p className="font-semibold text-slate-800">{task.description}</p>
                                        </div>
                                        <div>
                                            {(task.status === 'Pendente' || task.status === 'Em Andamento' || task.status === 'Aguardando Peça') && (
                                                <button 
                                                    onClick={() => { setActiveTask(task); setActionType('request_part'); setPartName(''); setPartQty('1'); }}
                                                    className="px-3 py-2 text-purple-600 bg-purple-50 hover:bg-purple-100 hover:text-purple-700 font-bold text-xs rounded-lg transition-colors mr-2 border border-purple-200"
                                                    title="Solicitar Peça / Ordem de Compra"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 inline-block mr-1"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
                                                    Solicitar Peça
                                                </button>
                                            )}
                                            {task.status === 'Pendente' && (
                                                <button 
                                                    onClick={() => { setActiveTask(task); setActionType('start'); setPhotoBase64(null); setResolutionNotes(''); }}
                                                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm rounded-lg transition-colors"
                                                >
                                                    Iniciar
                                                </button>
                                            )}
                                            {(task.status === 'Em Andamento' || task.status === 'Aguardando Peça') && (
                                                <button 
                                                    onClick={() => { setActiveTask(task); setActionType('finish'); setPhotoBase64(null); setResolutionNotes(''); }}
                                                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm rounded-lg transition-colors"
                                                >
                                                    Finalizar
                                                </button>
                                            )}
                                            {task.status === 'Resolvido' && (
                                                <div className="flex items-center gap-1 text-emerald-600 font-bold text-sm bg-emerald-50 px-3 py-1.5 rounded-lg">
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                                                    Resolvido
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {/* Mostrar detalhes se estiver resolvido ou em andamento */}
                                    {(task.before_image_url || task.after_image_url || task.resolution_notes) && (
                                        <div className="mt-2 bg-slate-50 rounded-lg p-3 text-sm grid grid-cols-1 md:grid-cols-2 gap-4 border border-slate-100">
                                            {task.before_image_url && (
                                                <div>
                                                    <p className="font-bold text-slate-500 mb-1 text-xs uppercase">Foto do Problema</p>
                                                    <img src={task.before_image_url} alt="Antes" className="w-full h-32 object-cover rounded-lg border border-slate-200" />
                                                </div>
                                            )}
                                            <div>
                                                {task.after_image_url && (
                                                    <div className="mb-3">
                                                        <p className="font-bold text-slate-500 mb-1 text-xs uppercase">Foto Resolvido</p>
                                                        <img src={task.after_image_url} alt="Depois" className="w-full h-32 object-cover rounded-lg border border-slate-200" />
                                                    </div>
                                                )}
                                                {task.resolution_notes && (
                                                    <div>
                                                        <p className="font-bold text-slate-500 mb-1 text-xs uppercase">Anotações do Mecânico</p>
                                                        <p className="text-slate-700">{task.resolution_notes}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Mostrar histórico de eventos (logs) */}
                                    {taskLogs[task.id] && taskLogs[task.id].length > 0 && (
                                        <div className="mt-3">
                                            <p className="font-bold text-slate-500 mb-2 text-xs uppercase flex items-center gap-1">
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                Histórico da Tarefa
                                            </p>
                                            <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 flex flex-col gap-3">
                                                {taskLogs[task.id].map((log, i) => (
                                                    <div key={log.id} className="relative pl-4">
                                                        {i !== taskLogs[task.id].length - 1 && <div className="absolute left-[3px] top-4 bottom-[-16px] w-[2px] bg-slate-200"></div>}
                                                        <div className={`absolute left-0 top-1.5 w-2 h-2 rounded-full ${log.action_type === 'gestor_update' ? 'bg-sky-500' : 'bg-slate-400'}`}></div>
                                                        <p className="text-xs text-slate-500 mb-0.5">
                                                            <span className="font-bold">{log.user_name}</span> &bull; {new Date(log.created_at).toLocaleString('pt-BR')}
                                                        </p>
                                                        <p className="text-sm font-medium text-slate-800">{log.description}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Sub-modal para ação da tarefa */}
            {activeTask && actionType && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className={`px-6 py-4 border-b border-slate-100 flex justify-between items-center ${actionType === 'start' ? 'bg-orange-50' : actionType === 'finish' ? 'bg-emerald-50' : 'bg-purple-50'}`}>
                            <h3 className={`text-lg font-bold flex items-center gap-2 ${actionType === 'start' ? 'text-orange-800' : actionType === 'finish' ? 'text-emerald-800' : 'text-purple-800'}`}>
                                {actionType === 'start' ? 'Iniciar Tarefa' : actionType === 'finish' ? 'Finalizar Tarefa' : 'Solicitar Peça'}
                            </h3>
                        </div>
                        <div className="p-6 flex flex-col gap-4">
                            <p className="font-semibold text-slate-800 bg-slate-50 p-3 rounded-lg border border-slate-200 text-sm">
                                {activeTask.description}
                            </p>

                            {actionType === 'request_part' ? (
                                <div className="flex flex-col gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome da Peça / Produto *</label>
                                        <input 
                                            required
                                            value={partName} 
                                            onChange={e => setPartName(e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-slate-700"
                                            placeholder="Ex: Parafuso Allen M8"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Quantidade *</label>
                                        <input 
                                            type="number"
                                            required
                                            min="1"
                                            value={partQty} 
                                            onChange={e => setPartQty(e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-slate-700"
                                        />
                                    </div>
                                    <div className="p-3 bg-blue-50 text-blue-800 rounded-lg text-xs font-medium flex gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" /></svg>
                                        Esta solicitação será enviada imediatamente para aprovação e compra do gestor. O status da tarefa mudará para Aguardando Peça.
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                                        {actionType === 'start' ? 'Anexar Foto do Problema (Opcional)' : 'Anexar Foto do Serviço Concluído (Opcional)'}
                                    </label>
                            {actionType !== 'request_part' && (
                                <input 
                                    type="file" 
                                    accept="image/*" 
                                    className="hidden" 
                                    ref={fileInputRef}
                                    onChange={handlePhotoUpload}
                                />
                            )}
                                {photoBase64 ? (
                                    <div className="relative">
                                        <img src={photoBase64} alt="Preview" className="w-full h-48 object-cover rounded-xl border-2 border-dashed border-slate-300" />
                                        <button 
                                            onClick={() => setPhotoBase64(null)}
                                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1.5 shadow-md hover:bg-red-600"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    </div>
                                ) : (
                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-full h-32 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-sky-600 hover:border-sky-300 transition-colors"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" /></svg>
                                        <span className="font-semibold text-sm">Tirar Foto / Escolher Arquivo</span>
                                    </button>
                                )}
                            </div>
                        )}

                            {actionType === 'finish' && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">O que foi feito? *</label>
                                    <textarea 
                                        required
                                        rows={3} 
                                        value={resolutionNotes} 
                                        onChange={e => setResolutionNotes(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-slate-700 resize-none"
                                        placeholder="Descreva a solução aplicada"
                                    ></textarea>
                                </div>
                            )}

                            <div className="mt-4 flex justify-end gap-3">
                                <button 
                                    onClick={() => { setActiveTask(null); setActionType(null); }}
                                    className="px-5 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={handleSaveAction}
                                    disabled={saving || (actionType === 'finish' && !resolutionNotes.trim()) || (actionType === 'request_part' && !partName.trim())}
                                    className={`px-5 py-2.5 rounded-xl font-bold text-white transition-colors flex items-center gap-2 disabled:opacity-50 ${actionType === 'start' ? 'bg-orange-500 hover:bg-orange-600' : actionType === 'finish' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-purple-600 hover:bg-purple-700'}`}
                                >
                                    {saving && <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                                    {saving ? 'Salvando...' : actionType === 'start' ? 'Confirmar Início' : actionType === 'finish' ? 'Salvar Conclusão' : 'Enviar Solicitação'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TaskExecutionModal;
