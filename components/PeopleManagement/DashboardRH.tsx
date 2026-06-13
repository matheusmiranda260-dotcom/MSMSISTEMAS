import React, { useMemo } from 'react';
import { UserGroupIcon, UserIcon, ClockIcon, ExclamationIcon } from '../icons';
import type { Employee, EmployeeAbsence, EmployeeVacation } from '../../types';
import { insertItem } from '../../services/supabaseService';
import { formatDbDate, getDurationDays, isDateWithinRange } from './dateUtils';

const DashboardRH: React.FC<{
    employees: Employee[];
    absences: EmployeeAbsence[];
    vacations: EmployeeVacation[];
    onSelectEmployee?: (emp: Employee, tab?: any) => void;
    onReloadData?: () => void;
}> = ({ employees, absences, vacations, onSelectEmployee, onReloadData }) => {
    const handleSettlePeriod = async (employee: Employee, periodStr: string, daysRemaining: number) => {
        if (!confirm(`Deseja marcar o período ${periodStr} como QUITADO para ${employee.name}? Isso registrará férias gozadas de ${daysRemaining} dias.`)) {
            return;
        }
        try {
            const startYear = parseInt(periodStr);
            const start = new Date(startYear, 0, 1);
            const end = new Date(start);
            end.setDate(start.getDate() + daysRemaining - 1);

            const startDateStr = start.toISOString().split('T')[0];
            const endDateStr = end.toISOString().split('T')[0];

            await insertItem('employee_vacations', {
                employeeId: employee.id,
                period: periodStr,
                startDate: startDateStr,
                endDate: endDateStr,
                status: 'Gozada'
            } as any);

            alert(`Férias do período ${periodStr} quitadas com sucesso!`);
            if (onReloadData) onReloadData();
        } catch (e) {
            console.error(e);
            alert('Erro ao quitar período de férias.');
        }
    };

    const totalEmployees = employees.length;
    const activeEmployees = employees.filter(e => e.active).length;
    const inactiveEmployees = totalEmployees - activeEmployees;

    // Simple analysis
    const currentlyOnVacation = vacations.filter(v => {
        if (v.status !== 'Gozada' && v.status !== 'Agendada' && v.status !== 'Programada') return false;
        const todayStr = new Date().toISOString().split('T')[0];
        return isDateWithinRange(todayStr, v.startDate, v.endDate);
    }).length;

    const recentAbsences = absences.length; // Could filter by date

    // Birthday calculations
    const birthdayAlerts = useMemo(() => {
        const alerts: { employee: Employee; daysUntil: number; isToday: boolean; birthDateStr: string; age: number }[] = [];
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentDate = now.getDate();

        employees.forEach(emp => {
            if (!emp.birthDate || !emp.active) return;
            // Parse YYYY-MM-DD manually to avoid timezone shifting
            const parts = emp.birthDate.split('-');
            if (parts.length !== 3) return;
            const birthYear = parseInt(parts[0]);
            const birthMonth = parseInt(parts[1]) - 1; // 0-indexed
            const birthDay = parseInt(parts[2]);

            let nextBirthday = new Date(now.getFullYear(), birthMonth, birthDay);
            
            // If birthday has already occurred this year, check next year's birthday
            if (nextBirthday < new Date(now.getFullYear(), currentMonth, currentDate)) {
                nextBirthday.setFullYear(now.getFullYear() + 1);
            }

            const diffTime = nextBirthday.getTime() - new Date(now.getFullYear(), currentMonth, currentDate).getTime();
            const daysUntil = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            const isToday = birthMonth === currentMonth && birthDay === currentDate;
            const age = nextBirthday.getFullYear() - birthYear;

            // Show alert if birthday is today or within the next 15 days
            if (isToday || daysUntil <= 15) {
                const formattedBirthDate = `${birthDay.toString().padStart(2, '0')}/${(birthMonth + 1).toString().padStart(2, '0')}`;
                alerts.push({
                    employee: emp,
                    daysUntil: isToday ? 0 : daysUntil,
                    isToday,
                    birthDateStr: formattedBirthDate,
                    age
                });
            }
        });

        return alerts.sort((a, b) => a.daysUntil - b.daysUntil);
    }, [employees]);

    // Vacation expiration calculations (Férias Vencendo/A Vencer)
    const vacationAlerts = useMemo(() => {
        const alerts: { employee: Employee; periodStr: string; daysRemaining: number; deadlineStr: string; daysToDeadline: number; isOverdue: boolean }[] = [];
        const now = new Date();

        employees.forEach(emp => {
            if (!emp.admissionDate || !emp.active) return;
            
            const parts = emp.admissionDate.split('-');
            if (parts.length !== 3) return;
            const admYear = parseInt(parts[0]);
            const admMonth = parseInt(parts[1]) - 1;
            const admDay = parseInt(parts[2]);
            const admission = new Date(admYear, admMonth, admDay);

            // Calculate how many completed years since admission
            const yearsWorked = Math.floor((now.getTime() - admission.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
            
            // Check periods for each completed year
            for (let i = 0; i < yearsWorked; i++) {
                const periodStart = new Date(admission);
                periodStart.setFullYear(admission.getFullYear() + i);
                const periodEnd = new Date(admission);
                periodEnd.setFullYear(admission.getFullYear() + i + 1);
                
                // Deadline to take this vacation is 1 year after the period ends (so admissionDate + i + 2 years)
                const deadline = new Date(admission);
                deadline.setFullYear(admission.getFullYear() + i + 2);
                deadline.setDate(deadline.getDate() - 1); // Deadline is usually the day before the anniversary of the 2nd year

                const startYear = periodStart.getFullYear();
                const periodStr = startYear.toString();

                // Find all vacations for this employee that match this period
                const empVacations = vacations.filter(v => {
                    if (v.employeeId !== emp.id) return false;
                    if (!v.period) return false;
                    
                    const normPeriod = v.period.trim();
                    return normPeriod === periodStr || normPeriod.startsWith(periodStr);
                });

                // Calculate total days taken/scheduled/sold
                let daysUsed = 0;
                empVacations.forEach(v => {
                    if (v.status === 'Cancelada') return;
                    const days = getDurationDays(v.startDate, v.endDate);
                    if (!isNaN(days)) {
                        daysUsed += days;
                    }
                });

                const daysRemaining = 30 - daysUsed;

                if (daysRemaining > 0) {
                    const diffTime = deadline.getTime() - now.getTime();
                    const daysToDeadline = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    const isOverdue = daysToDeadline < 0;

                    // Show alert if overdue or if deadline is in less than 90 days
                    if (isOverdue || daysToDeadline <= 90) {
                        alerts.push({
                            employee: emp,
                            periodStr,
                            daysRemaining,
                            deadlineStr: deadline.toLocaleDateString('pt-BR'),
                            daysToDeadline,
                            isOverdue
                        });
                    }
                }
            }
        });

        return alerts.sort((a, b) => a.daysToDeadline - b.daysToDeadline);
    }, [employees, vacations]);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-bold text-slate-500 uppercase">Total Colaboradores</p>
                        <p className="text-3xl font-bold text-[#0F3F5C]">{totalEmployees}</p>
                    </div>
                    <UserGroupIcon className="h-10 w-10 text-slate-200" />
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-bold text-slate-500 uppercase">Ativos</p>
                        <p className="text-3xl font-bold text-green-600">{activeEmployees}</p>
                    </div>
                    <UserIcon className="h-10 w-10 text-green-100" />
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-bold text-slate-500 uppercase">Em Férias (Hoje)</p>
                        <p className="text-3xl font-bold text-blue-600">{currentlyOnVacation}</p>
                    </div>
                    <ClockIcon className="h-10 w-10 text-blue-100" />
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-bold text-slate-500 uppercase">Faltas/Ausências</p>
                        <p className="text-3xl font-bold text-red-500">{recentAbsences}</p>
                    </div>
                    <ExclamationIcon className="h-10 w-10 text-red-100" />
                </div>
            </div>

            {/* SEÇÃO DE ALERTAS E LEMBRETES DE RH */}
            {(birthdayAlerts.length > 0 || vacationAlerts.length > 0) && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 animate-fadeIn">
                    <h3 className="font-extrabold text-[#0F3F5C] text-lg mb-4 border-b pb-2 flex items-center gap-2">
                        <ExclamationIcon className="h-5 w-5 text-amber-500" />
                        Lembretes e Alertas de RH
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Alertas de Aniversário */}
                        {birthdayAlerts.length > 0 && (
                            <div className="bg-pink-50/30 p-4 rounded-xl border border-pink-100/50">
                                <h4 className="font-bold text-pink-700 text-sm mb-3 flex items-center gap-1.5">
                                    🎂 Próximos Aniversários
                                </h4>
                                <ul className="space-y-3">
                                    {birthdayAlerts.map(({ employee, daysUntil, isToday, birthDateStr, age }) => (
                                        <li key={employee.id} className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-pink-100/30 shadow-sm text-sm">
                                            <div>
                                                <span className="font-bold text-slate-800">{employee.name}</span>
                                                <span className="text-xs text-slate-500 ml-1">({age} anos • {birthDateStr})</span>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                                isToday ? 'bg-pink-100 text-pink-700 animate-pulse' : 'bg-slate-100 text-slate-600'
                                            }`}>
                                                {isToday ? 'Faz aniversário hoje! 🎉' : `Em ${daysUntil} ${daysUntil === 1 ? 'dia' : 'dias'}`}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Alertas de Férias a Vencer */}
                        {vacationAlerts.length > 0 && (
                            <div className="bg-amber-50/30 p-4 rounded-xl border border-amber-100/50">
                                <h4 className="font-bold text-amber-700 text-sm mb-3 flex items-center gap-1.5">
                                    📅 Férias a Vencer / Vencidas
                                </h4>
                                <ul className="space-y-3">
                                    {vacationAlerts.map(({ employee, periodStr, daysRemaining, deadlineStr, daysToDeadline, isOverdue }) => (
                                        <li key={`${employee.id}-${periodStr}`} className="flex flex-col bg-white p-2.5 rounded-lg border border-amber-100/30 shadow-sm text-sm">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <span className="font-bold text-slate-800">{employee.name}</span>
                                                    <span className="text-xs text-slate-500 block">Período Aquisitivo: {periodStr}</span>
                                                </div>
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold shrink-0 ${
                                                    isOverdue ? 'bg-red-100 text-red-700 font-extrabold animate-pulse' : 'bg-amber-100 text-amber-700'
                                                }`}>
                                                    {isOverdue ? 'FÉRIAS VENCIDAS ⚠️' : `Vence em ${daysToDeadline} ${daysToDeadline === 1 ? 'dia' : 'dias'}`}
                                                </span>
                                            </div>
                                            <div className="mt-2 text-xs flex justify-between text-slate-600 border-t pt-1.5 border-dashed">
                                                <span>Dias em haver: <strong>{daysRemaining} dias</strong></span>
                                                <span>Prazo: {deadlineStr}</span>
                                            </div>
                                            <div className="mt-2.5 pt-2 border-t border-dashed border-slate-100 flex gap-2 justify-end">
                                                <button
                                                    onClick={() => onSelectEmployee?.(employee, 'hr')}
                                                    className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded text-xs font-bold transition border border-slate-200"
                                                >
                                                    Ver Detalhes
                                                </button>
                                                <button
                                                    onClick={() => handleSettlePeriod(employee, periodStr, daysRemaining)}
                                                    className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded text-xs font-bold transition border border-emerald-200"
                                                >
                                                    Quitar Período
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Graphs / Lists could go here */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <h3 className="font-bold text-slate-700 mb-4">Colaboradores em Férias</h3>
                {vacations.filter(v => {
                    if (v.status !== 'Gozada' && v.status !== 'Agendada' && v.status !== 'Programada') return false;
                    const todayStr = new Date().toISOString().split('T')[0];
                    return v.endDate >= todayStr;
                }).length > 0 ? (
                    <table className="w-full text-sm">
                        <thead className="text-left bg-slate-50 text-slate-500 uppercase text-xs">
                            <tr><th className="p-2">Colaborador</th><th className="p-2">Início</th><th className="p-2">Fim</th><th className="p-2">Status</th></tr>
                        </thead>
                        <tbody>
                            {vacations.filter(v => {
                                if (v.status !== 'Gozada' && v.status !== 'Agendada' && v.status !== 'Programada') return false;
                                const todayStr = new Date().toISOString().split('T')[0];
                                return v.endDate >= todayStr;
                            }).map(v => {
                                const emp = employees.find(e => e.id === v.employeeId);
                                return (
                                    <tr key={v.id} className="border-b">
                                        <td className="p-2 font-bold">{emp?.name || 'Desconhecido'}</td>
                                        <td className="p-2">{formatDbDate(v.startDate)}</td>
                                        <td className="p-2">{formatDbDate(v.endDate)}</td>
                                        <td className="p-2">
                                            <span className={`px-2 py-0.5 rounded text-xs font-bold border ${
                                                v.status === 'Gozada' 
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                                    : 'bg-blue-50 text-blue-700 border-blue-200'
                                            }`}>
                                                {v.status === 'Gozada' ? 'Em Gozo' : 'Agendada'}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                ) : <p className="text-slate-400">Ninguém em férias no momento.</p>}
            </div>
        </div>
    );
};

export default DashboardRH;
