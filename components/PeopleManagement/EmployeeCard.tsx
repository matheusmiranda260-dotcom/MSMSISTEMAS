import React from 'react';
import { StarIcon, ChartBarIcon, TrashIcon } from '../icons';
import type { Employee, Evaluation } from '../../types';

const EmployeeCard: React.FC<{ employee: Employee; onSelect: () => void; onDelete: () => void; evaluations: Evaluation[] }> = React.memo(({ employee, onSelect, onDelete, evaluations }) => {
    const employeeEvals = evaluations.filter(e => e.employeeId === employee.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const lastEvaluation = employeeEvals[0];
    const displayScore = lastEvaluation ? (lastEvaluation.totalScore / 5) : 0;

    return (
        <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all border border-slate-100 p-4 flex items-center space-x-4 relative group">
            <div onClick={onSelect} className="flex-grow flex items-center space-x-4 cursor-pointer">
                <div className="h-16 w-16 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden border-2 border-slate-100 shrink-0">
                    {employee.photoUrl ? (
                        <img src={employee.photoUrl} alt={employee.name} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                        <span className="text-2xl font-bold text-slate-400">{employee.name.charAt(0)}</span>
                    )}
                </div>
                <div className="flex-grow min-w-0">
                    <h3 className="font-bold text-slate-800 truncate">{employee.name}</h3>
                    <p className="text-sm text-slate-500 truncate">{employee.sector} • {employee.shift}</p>
                    {employee.jobTitle && <p className="text-xs text-slate-400 truncate">{employee.jobTitle}</p>}
                    <div className="flex items-center mt-1">
                        <StarIcon className="h-4 w-4 text-yellow-400 fill-current mr-1" />
                        <span className="font-bold text-slate-700">{displayScore.toFixed(1)}</span>
                        <span className="text-xs text-slate-400 ml-2">({employeeEvals.length} avaliações)</span>
                    </div>
                </div>
            </div>
            <div className="flex flex-col gap-2">
                <button onClick={onSelect} className="text-blue-500 hover:text-blue-700">
                    <ChartBarIcon className="h-6 w-6" />
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Excluir Funcionário"
                >
                    <TrashIcon className="h-5 w-5" />
                </button>
            </div>
        </div>
    );
});

export default EmployeeCard;
