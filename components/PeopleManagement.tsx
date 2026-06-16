import React, { useState, useEffect, useMemo } from 'react';
import { PlusIcon, UserGroupIcon } from './icons';
import type { Page, Employee, Evaluation, EmployeeAbsence, EmployeeVacation, User, OrgUnit, OrgPosition, Partner } from '../types';
import { fetchTable, insertItem, deleteItem, fetchByColumn } from '../services/supabaseService';

import DashboardRH from './PeopleManagement/DashboardRH';
import EmployeeCard from './PeopleManagement/EmployeeCard';
import EmployeeSelfDashboard from './PeopleManagement/EmployeeSelfDashboard';
import EmployeeDetailModal from './PeopleManagement/EmployeeDetailModal';
import OrgChart from './PeopleManagement/OrgChart';

interface PeopleManagementProps {
    setPage: (page: Page) => void;
    currentUser: User | null;
    activeBrandingPartner?: Partner | null;
}

const PeopleManagement: React.FC<PeopleManagementProps> = ({ setPage, currentUser, activeBrandingPartner }) => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
    const [absences, setAbsences] = useState<EmployeeAbsence[]>([]);
    const [vacations, setVacations] = useState<EmployeeVacation[]>([]);
    const [selectedEmployee, setSelectedEmployee] = useState<{ emp: Employee, tab?: any } | null>(null);
    const [viewMode, setViewMode] = useState<'dashboard' | 'cards' | 'orgChart'>('dashboard');
    const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([]);
    const [orgPositions, setOrgPositions] = useState<OrgPosition[]>([]);

    // Employee Form State (Simplified for direct creation)
    const [newEmployeeName, setNewEmployeeName] = useState('');

    const isRestrictedUser = useMemo(() => currentUser?.role === 'user' && !!currentUser?.employeeId, [currentUser]);

    const loadData = async () => {
        let emp = await fetchTable<Employee>('employees');
        let evals = await fetchTable<Evaluation>('evaluations');
        let abs = await fetchTable<EmployeeAbsence>('employee_absences');
        let vacs = await fetchTable<EmployeeVacation>('employee_vacations');

        if (isRestrictedUser) {
            emp = emp.filter(e => e.id === currentUser!.employeeId);
            evals = evals.filter(ev => ev.employeeId === currentUser!.employeeId);
            abs = abs.filter(a => a.employeeId === currentUser!.employeeId);
            vacs = vacs.filter(v => v.employeeId === currentUser!.employeeId);
        }

        const units = await fetchTable<OrgUnit>('org_units');
        const pos = await fetchTable<OrgPosition>('org_positions');

        setEmployees(emp);
        setEvaluations(evals);
        setAbsences(abs);
        setVacations(vacs);
        setOrgUnits(units);
        setOrgPositions(pos);
    };

    useEffect(() => {
        loadData();
        if (isRestrictedUser) {
            setViewMode('cards'); // We will override the render content for restricted user anyway
        }
    }, [isRestrictedUser]);

    // New Flow: Create Placeholder -> Open Detail Modal
    const handleCreateAndEdit = async (name: string, positionId?: string, sector?: string) => {
        if (!name) return;
        try {
            // Auto-fill Job Title from Position Name if linked via OrgChart
            let autoJobTitle = '';
            if (positionId) {
                try {
                    const connectedPosList = await fetchByColumn<OrgPosition>('org_positions', 'id', positionId);
                    if (connectedPosList && connectedPosList.length > 0) {
                        autoJobTitle = connectedPosList[0].title;
                    }
                } catch (e) { console.error('Error fetching position for auto-fill', e); }
            }

            const newEmpPayload: Partial<Employee> = {
                name: name,
                sector: sector || 'Não Definido',
                shift: '-', // Placeholder to satisfy DB NOT NULL constraint
                active: true,
                orgPositionId: positionId || undefined,
                jobTitle: autoJobTitle, // Auto-sync Job Title
                phone: '',
                // Dates MUST be omitted or null, not empty strings
                // admissionDate: undefined,
                // birthDate: undefined
            };

            const newEmp = await insertItem<Employee>('employees', newEmpPayload as Employee);

            await loadData();
            setSelectedEmployee({ emp: newEmp });

        } catch (error) {
            console.error(error);
            alert('Erro ao criar registro inicial. Verifique o console.');
        }
    };

    const promptAndCreateEmployee = (posId?: string, sector?: string) => {
        const name = prompt("Nome do Novo Funcionário:");
        if (name) {
            handleCreateAndEdit(name, posId, sector);
        }
    };

    // ... delete function remains ...
    const handleDeleteEmployee = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir este funcionário? Essa ação não pode ser desfeita.')) return;
        try {
            await deleteItem('employees', id);
            alert('Funcionário excluído.');
            setSelectedEmployee(null);
            loadData();
        } catch (error) {
            alert('Erro ao excluir.');
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-4 sm:p-6 md:p-8">
            {selectedEmployee && (
                <EmployeeDetailModal
                    employee={selectedEmployee.emp}
                    currentUser={currentUser}
                    onClose={() => setSelectedEmployee(null)}
                    onSave={loadData}
                    onDelete={() => handleDeleteEmployee(selectedEmployee.emp.id)}
                    readOnly={isRestrictedUser}
                    initialTab={selectedEmployee.tab}
                />
            )}

            {/* Simple Add Modal removed, replaced by direct prompt logic */}

            <header className="no-print flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 pt-4">
                <div className="flex items-center justify-between md:justify-start w-full md:w-auto">
                    <div className="flex items-center">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Gestão de Pessoas</h1>
                            <p className="text-sm md:text-base text-slate-500">Prontuário Digital</p>
                        </div>
                    </div>
                    {/* Mobile Only Add Button */}
                    {!isRestrictedUser && (
                        <button onClick={() => promptAndCreateEmployee()} className="md:hidden bg-[#0F3F5C] text-white p-2 rounded-lg shadow-lg">
                            <PlusIcon className="h-6 w-6" />
                        </button>
                    )}
                </div>

                {!isRestrictedUser && (
                    <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                        <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 shadow-sm overflow-x-auto w-full md:w-auto">
                            <button
                                onClick={() => setViewMode('dashboard')}
                                className={`flex-1 md:flex-none px-4 py-2 rounded-md font-medium text-sm transition whitespace-nowrap ${viewMode === 'dashboard' ? 'bg-slate-100 text-[#0F3F5C] font-bold' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Dashboard
                            </button>
                            <button
                                onClick={() => setViewMode('cards')}
                                className={`flex-1 md:flex-none px-4 py-2 rounded-md font-medium text-sm transition whitespace-nowrap ${viewMode === 'cards' ? 'bg-slate-100 text-[#0F3F5C] font-bold' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Lista
                            </button>
                            <button
                                onClick={() => setViewMode('orgChart')}
                                className={`flex-1 md:flex-none px-4 py-2 rounded-md font-medium text-sm transition whitespace-nowrap ${viewMode === 'orgChart' ? 'bg-slate-100 text-[#0F3F5C] font-bold' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Organograma
                            </button>
                        </div>

                        <button onClick={() => promptAndCreateEmployee()} className="hidden md:flex bg-[#0F3F5C] text-white px-4 py-2 rounded-lg font-bold hover:bg-[#0A2A3D] transition items-center gap-2 whitespace-nowrap">
                            <PlusIcon className="h-5 w-5" />
                            Novo Funcionário
                        </button>
                    </div>
                )}
            </header>

            {viewMode === 'cards' ? (
                <>
                    {/* Employee Dashboard for Restricted Users */}
                    {isRestrictedUser && employees.length > 0 ? (
                        <EmployeeSelfDashboard
                            employee={employees[0]}
                            onOpenModal={(tab) => setSelectedEmployee({ emp: employees[0], tab })}
                        />
                    ) : (
                        <div className="space-y-12">
                            {(Object.entries(
                                employees.reduce((acc, emp) => {
                                    const sector = emp.sector || 'Geral / Outros';
                                    if (!acc[sector]) acc[sector] = [];
                                    acc[sector].push(emp);
                                    return acc;
                                }, {} as Record<string, Employee[]>)
                            ) as [string, Employee[]][]).sort(([a], [b]) => a.localeCompare(b)).map(([sector, sectorEmps]) => (
                                <div key={sector}>
                                    <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="h-8 w-1 bg-[#0F3F5C] rounded-full"></div>
                                            <h2 className="text-xl font-extrabold text-[#0F3F5C] uppercase tracking-wider">{sector}</h2>
                                            <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-xs font-bold">{sectorEmps.length}</span>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {sectorEmps.map(emp => (
                                            <EmployeeCard
                                                key={emp.id}
                                                employee={emp}
                                                evaluations={evaluations}
                                                onSelect={() => setSelectedEmployee({ emp })}
                                                onDelete={() => handleDeleteEmployee(emp.id)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))}
                            {employees.length === 0 && (
                                <div className="col-span-full text-center py-20 bg-white rounded-2xl border-2 border-dashed border-slate-200">
                                    <UserGroupIcon className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                                    <p className="text-slate-500 font-medium">Nenhum funcionário cadastrado. Adicione o primeiro!</p>
                                </div>
                            )}
                        </div>
                    )}
                </>
            ) : viewMode === 'orgChart' ? (
                <OrgChart
                    employees={employees}
                    units={orgUnits}
                    positions={orgPositions}
                    evaluations={evaluations}
                    reloadData={loadData}
                    triggerAddEmployee={promptAndCreateEmployee}
                    triggerEditEmployee={(emp) => setSelectedEmployee({ emp })}
                    activeBrandingPartner={activeBrandingPartner}
                />
            ) : (
                <DashboardRH
                    employees={employees}
                    absences={absences}
                    vacations={vacations}
                    onSelectEmployee={(emp, tab) => setSelectedEmployee({ emp, tab })}
                    onReloadData={loadData}
                />
            )}
            {selectedEmployee && (
                <EmployeeDetailModal
                    employee={selectedEmployee.emp}
                    currentUser={currentUser}
                    onClose={() => setSelectedEmployee(null)}
                    onSave={loadData}
                    onDelete={() => handleDeleteEmployee(selectedEmployee.emp.id)}
                    readOnly={isRestrictedUser}
                    initialTab={selectedEmployee.tab}
                    orgUnits={orgUnits}
                    orgPositions={orgPositions}
                />
            )}
        </div>
    );
};

export default PeopleManagement;
