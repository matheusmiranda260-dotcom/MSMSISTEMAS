import React, { useState, useEffect } from 'react';
import { UserIcon, ExclamationIcon, ArrowLeftIcon, DocumentTextIcon, StarIcon } from '../icons';
import type { Employee, KaizenProblem } from '../../types';
import { fetchTable } from '../../services/supabaseService';

const EmployeeSelfDashboard: React.FC<{ employee: Employee, onOpenModal: (tab: string) => void }> = ({ employee, onOpenModal }) => {
    const [pendingTasksCount, setPendingTasksCount] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkTasks = async () => {
            try {
                const allProblems = await fetchTable<KaizenProblem>('kaizen_problems');
                const myTasks = allProblems.filter(p => {
                    const isResponsibleId = p.responsibleIds?.includes(employee.id);
                    const isResponsibleName = p.responsible && p.responsible.includes(employee.name);
                    return (isResponsibleId || isResponsibleName) && p.status !== 'Resolvido';
                });
                setPendingTasksCount(myTasks.length);
            } catch (e) {
                console.error('Error fetching dashboard tasks', e);
            } finally {
                setLoading(false);
            }
        };
        checkTasks();
    }, [employee.id]);

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            {/* Welcome Header */}
            <div className="bg-gradient-to-r from-[#0F3F5C] to-[#1a5f8a] rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 opacity-10 transform translate-x-10 -translate-y-10">
                    <UserIcon className="h-64 w-64" />
                </div>
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-6">
                    <div className="h-24 w-24 rounded-full border-4 border-white/30 shadow-lg overflow-hidden bg-white/10 shrink-0">
                        {employee.photoUrl ? <img src={employee.photoUrl} className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center text-3xl font-bold"> {employee.name.charAt(0)} </span>}
                    </div>
                    <div className="text-center md:text-left">
                        <h2 className="text-3xl font-bold mb-1">Olá, {employee.name.split(' ')[0]}!</h2>
                        <p className="text-blue-100 text-lg opacity-90">Bem-vindo ao seu Portal do Colaborador.</p>
                        <p className="text-sm text-blue-200 mt-2 font-mono uppercase tracking-widest">{employee.jobTitle || 'Colaborador'} • {employee.sector}</p>
                    </div>
                </div>
            </div>

            {/* Pending Tasks Alert */}
            {pendingTasksCount > 0 && (
                <div onClick={() => onOpenModal('tasks')} className="bg-orange-50 border-l-8 border-orange-500 rounded-xl p-6 shadow-sm cursor-pointer hover:shadow-md hover:translate-x-1 transition-all group">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="bg-orange-100 p-3 rounded-full text-orange-600 group-hover:bg-orange-200 transition">
                                <ExclamationIcon className="h-8 w-8" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-800 group-hover:text-orange-700 transition">Atenção Necessária</h3>
                                <p className="text-slate-600">Você possui <strong className="text-orange-600">{pendingTasksCount} pendência(s)</strong> ou ações do Kaizen atribuídas a você.</p>
                            </div>
                        </div>
                        <div className="hidden md:flex items-center text-orange-600 font-bold text-sm gap-1 group-hover:gap-2 transition-all">
                            Ver Pendências <ArrowLeftIcon className="h-4 w-4 rotate-180" />
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Access Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <button onClick={() => onOpenModal('profile')} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all group text-left">
                    <div className="bg-blue-50 w-12 h-12 rounded-xl flex items-center justify-center text-[#0F3F5C] mb-4 group-hover:scale-110 transition-transform">
                        <UserIcon className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2">Meus Dados</h3>
                    <p className="text-slate-500 text-sm">Visualize e matenha seus dados cadastrais atualizados.</p>
                </button>

                <button onClick={() => onOpenModal('documents')} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all group text-left">
                    <div className="bg-purple-50 w-12 h-12 rounded-xl flex items-center justify-center text-purple-600 mb-4 group-hover:scale-110 transition-transform">
                        <DocumentTextIcon className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2">Meus Documentos</h3>
                    <p className="text-slate-500 text-sm">Acesse seus comprovantes, holerites e certificados.</p>
                </button>

                <button onClick={() => onOpenModal('evaluations')} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all group text-left">
                    <div className="bg-yellow-50 w-12 h-12 rounded-xl flex items-center justify-center text-yellow-600 mb-4 group-hover:scale-110 transition-transform">
                        <StarIcon className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2">Minhas Avaliações</h3>
                    <p className="text-slate-500 text-sm">Acompanhe seu desempenho e feedbacks recebidos.</p>
                </button>
            </div>

            {/* Info Footer */}
            <div className="text-center text-slate-400 text-sm pt-8">
                <p>Mantenha seus dados sempre atualizados para facilitar a comunicação.</p>
            </div>
        </div>
    );
};

export default EmployeeSelfDashboard;
