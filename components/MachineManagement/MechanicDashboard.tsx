import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import type { Partner } from '../../types';
import TaskExecutionModal from './TaskExecutionModal';

interface MechanicDashboardProps {
    activeBrandingPartner?: Partner | null;
}

const MechanicDashboard: React.FC<MechanicDashboardProps> = ({ activeBrandingPartner }) => {
    const [maintenances, setMaintenances] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'Aguardando Mecânico' | 'Em Andamento' | 'Encerrada'>('Aguardando Mecânico');
    const [mechanicModal, setMechanicModal] = useState<{show: boolean, maintenanceId: string | null, mechanicName: string}>({show: false, maintenanceId: null, mechanicName: ''});
    const [viewModal, setViewModal] = useState<{show: boolean, data: any | null}>({show: false, data: null});
    const [taskModal, setTaskModal] = useState<{show: boolean, maintenanceId: string | null}>({show: false, maintenanceId: null});

    useEffect(() => {
        fetchMaintenances();
    }, []);

    const fetchMaintenances = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('machine_maintenance')
                .select('*')
                .in('status', ['Aguardando Mecânico', 'Em Andamento', 'Encerrada'])
                .order('scheduled_date', { ascending: true });

            if (error) throw error;
            setMaintenances(data || []);
        } catch (err) {
            console.error('Error fetching mechanic tasks:', err);
        } finally {
            setLoading(false);
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

    const startMechanicMaintenance = (e: React.FormEvent) => {
        e.preventDefault();
        if (mechanicModal.maintenanceId && mechanicModal.mechanicName.trim()) {
            updateStatus(mechanicModal.maintenanceId, 'Em Andamento', { technician_name: mechanicModal.mechanicName });
            setMechanicModal({show: false, maintenanceId: null, mechanicName: ''});
        }
    };

    const filteredMaintenances = maintenances.filter(m => m.status === activeTab);

    return (
        <div className="flex-1 p-8 h-screen overflow-y-auto bg-slate-50">
            <div className="max-w-7xl mx-auto space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
                            <span className="text-4xl">🛠️</span> Painel do Mecânico
                        </h1>
                        <p className="text-slate-500 mt-2 font-medium">Gestão de manutenções e ordens de serviço</p>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-6">
                        <div className="flex flex-wrap gap-2 mb-6 p-1.5 bg-slate-100 rounded-xl w-fit">
                            {['Aguardando Mecânico', 'Em Andamento', 'Encerrada'].map((tab) => (
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
                                    <span className="ml-2 px-2 py-0.5 rounded-full bg-slate-100 text-xs text-slate-600">
                                        {maintenances.filter(m => m.status === tab).length}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {loading ? (
                            <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600"></div></div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-100 text-slate-400">
                                            <th className="p-4 font-bold uppercase tracking-wider text-xs">Máquina</th>
                                            <th className="p-4 font-bold uppercase tracking-wider text-xs">Tipo</th>
                                            <th className="p-4 font-bold uppercase tracking-wider text-xs">Descrição</th>
                                            <th className="p-4 font-bold uppercase tracking-wider text-xs">Responsável</th>
                                            <th className="p-4 font-bold uppercase tracking-wider text-xs">Status</th>
                                            <th className="p-4 font-bold uppercase tracking-wider text-xs">Data Agendada</th>
                                            <th className="p-4 font-bold uppercase tracking-wider text-xs text-right">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredMaintenances.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="p-12 text-center text-slate-500 font-medium">
                                                    Nenhuma manutenção encontrada na aba {activeTab}.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredMaintenances.map(item => (
                                                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="p-4 font-bold text-slate-800">{item.machine_name}</td>
                                                    <td className="p-4 font-semibold text-slate-700">{item.maintenance_type}</td>
                                                    <td className="p-4 text-slate-600 max-w-xs truncate" title={item.description}>{item.description || '-'}</td>
                                                    <td className="p-4 text-slate-600">{item.technician_name || '-'}</td>
                                                    <td className="p-4">
                                                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
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
                                                            <button 
                                                                onClick={() => setViewModal({show: true, data: item})}
                                                                className="text-sky-600 hover:bg-sky-100 font-bold text-sm bg-sky-50 px-3 py-2 rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                                                                title="Visualizar Solicitação"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                                Visualizar
                                                            </button>
                                                            {item.status === 'Aguardando Mecânico' && (
                                                                <button 
                                                                    onClick={() => setMechanicModal({show: true, maintenanceId: item.id, mechanicName: ''})}
                                                                    className="text-white hover:bg-orange-600 font-bold text-sm bg-orange-500 px-4 py-2 rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                                                                >
                                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" /></svg>
                                                                    Iniciar Serviço
                                                                </button>
                                                            )}
                                                            {item.status === 'Em Andamento' && (
                                                                <button 
                                                                    onClick={() => setTaskModal({show: true, maintenanceId: item.id})}
                                                                    className="text-white hover:bg-emerald-600 font-bold text-sm bg-emerald-500 px-4 py-2 rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                                                                >
                                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" /></svg>
                                                                    Ver Tarefas
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
                    </div>
                </div>
            </div>

            {/* Modal de Iniciar Manutenção */}
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

            {/* Modal de Visualizar Solicitação */}
            {viewModal.show && viewModal.data && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-sky-50">
                            <h3 className="text-lg font-bold text-sky-800 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                                Detalhes da Solicitação
                            </h3>
                            <button onClick={() => setViewModal({show: false, data: null})} className="text-sky-400 hover:text-sky-600">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="p-6 flex flex-col gap-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">Máquina</p>
                                    <p className="text-sm font-bold text-slate-800">{viewModal.data.machine_name}</p>
                                </div>
                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">Tipo de Manutenção</p>
                                    <p className="text-sm font-bold text-slate-800">{viewModal.data.maintenance_type}</p>
                                </div>
                            </div>
                            
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                <p className="text-xs font-bold text-slate-400 uppercase mb-1">Descrição do Problema / Serviço</p>
                                <p className="text-sm text-slate-700 whitespace-pre-wrap">{viewModal.data.description || 'Nenhuma descrição fornecida.'}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">Responsável Solicitado</p>
                                    <p className="text-sm font-bold text-slate-800">{viewModal.data.technician_name || '-'}</p>
                                </div>
                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">Data Agendada</p>
                                    <p className="text-sm font-bold text-slate-800">
                                        {viewModal.data.scheduled_date ? new Date(viewModal.data.scheduled_date).toLocaleDateString('pt-BR') : '-'}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-2 flex justify-end gap-3">
                                {viewModal.data.status === 'Aguardando Mecânico' && (
                                    <button 
                                        onClick={() => {
                                            setViewModal({show: false, data: null});
                                            setMechanicModal({show: true, maintenanceId: viewModal.data.id, mechanicName: ''});
                                        }}
                                        className="px-5 py-2.5 rounded-xl font-bold text-white bg-orange-500 hover:bg-orange-600 transition-colors flex items-center gap-2"
                                    >
                                        Iniciar Serviço
                                    </button>
                                )}
                                <button 
                                    onClick={() => setViewModal({show: false, data: null})} 
                                    className="px-5 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                                >
                                    Fechar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Execução de Tarefas */}
            {taskModal.show && taskModal.maintenanceId && (
                <TaskExecutionModal 
                    maintenanceId={taskModal.maintenanceId}
                    onClose={() => setTaskModal({show: false, maintenanceId: null})}
                    onAllTasksCompleted={() => {
                        updateStatus(taskModal.maintenanceId!, 'Encerrada');
                        setTaskModal({show: false, maintenanceId: null});
                    }}
                />
            )}
        </div>
    );
};

export default MechanicDashboard;
