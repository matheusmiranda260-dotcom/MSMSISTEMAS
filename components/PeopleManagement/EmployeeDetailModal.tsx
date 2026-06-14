import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ArrowLeftIcon, PlusIcon, StarIcon, SearchIcon, UserIcon, BookOpenIcon, ClockIcon, DocumentTextIcon, PencilIcon, TrashIcon, DownloadIcon, SaveIcon, XIcon, PrinterIcon, ChartBarIcon, CheckCircleIcon, ExclamationIcon } from '../icons';
import type { Employee, Evaluation, TechnicalEvaluation, EmployeeCourse, EmployeeAbsence, EmployeeVacation, EmployeeResponsibility, EmployeeDocument, KaizenProblem, User, Achievement, OrgUnit, OrgPosition } from '../../types';
import { fetchTable, insertItem, updateItem, deleteItem, deleteItemByColumn, uploadFile, fetchByColumn } from '../../services/supabaseService';
import { formatDbDate, getDurationDays, isDateWithinRange, getAvailablePeriods, getPeriodDeadline } from './dateUtils';
import { TREFILA_QUESTIONS, TRELICA_QUESTIONS, resizeImage } from './constants';
import MobileFriendlyDateInput from './MobileFriendlyDateInput';
import StarRating from './StarRating';

const EmployeeDetailModal: React.FC<{
    employee: Employee;
    onClose: () => void;
    onSave: () => void;
    onDelete: () => void; // New prop
    currentUser: User | null;
    readOnly?: boolean;
    initialTab?: 'profile' | 'responsibilities' | 'development' | 'hr' | 'evaluations' | 'documents' | 'tasks';
    orgUnits?: OrgUnit[];
    orgPositions?: OrgPosition[];
}> = ({ employee, onClose, onSave, onDelete, currentUser, readOnly, initialTab = 'profile', orgUnits = [], orgPositions = [] }) => {
    // ... Copy existing implementation or use a placeholder if too long (I'll keep it shortened for this specific file write as the focus is Organograma)
    // To ensure I don't break existing features, I will replicate it or assume it's there. 
    // Given the previous step saw the full file, I will perform a full overwrite including the Modal code to be safe.

    const [activeTab, setActiveTab] = useState<'profile' | 'responsibilities' | 'development' | 'hr' | 'evaluations' | 'documents' | 'tasks'>(initialTab);
    const [empData, setEmpData] = useState<Employee>(employee);
    const [responsibilities, setResponsibilities] = useState<EmployeeResponsibility[]>([]);
    const [courses, setCourses] = useState<EmployeeCourse[]>([]);
    const [absences, setAbsences] = useState<EmployeeAbsence[]>([]);
    const [vacations, setVacations] = useState<EmployeeVacation[]>([]);
    const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
    const [kaizenTasks, setKaizenTasks] = useState<KaizenProblem[]>([]);
    const [newResp, setNewResp] = useState('');

    // Refs for file inputs to ensure reliable mobile triggering
    const profilePhotoInputRef = useRef<HTMLInputElement>(null);
    const courseFileInputRef = useRef<HTMLInputElement>(null);
    const absenceFileInputRef = useRef<HTMLInputElement>(null);
    const [newCourse, setNewCourse] = useState('');
    const [isUploading, setIsUploading] = useState(false); // New state for feedback
    const [isEvaluating, setIsEvaluating] = useState(false);
    const [evalScores, setEvalScores] = useState({ organization: 0, cleanliness: 0, effort: 0, communication: 0, improvement: 0 });
    const [evalNote, setEvalNote] = useState('');

    // Estados para Avaliação CHA (Conhecimento, Habilidade e Atitude)
    const [technicalEvaluations, setTechnicalEvaluations] = useState<TechnicalEvaluation[]>([]);
    const [activeEvalSubTab, setActiveEvalSubTab] = useState<'behavioral' | 'technical'>('behavioral');
    const [isEvaluatingTechnical, setIsEvaluatingTechnical] = useState(false);
    const [selectedTechEval, setSelectedTechEval] = useState<TechnicalEvaluation | null>(null);
    const [techEvalMonth, setTechEvalMonth] = useState<number>(1);
    const [techEvalDate, setTechEvalDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
    const [techEvalMachineType, setTechEvalMachineType] = useState<'Trefila' | 'Treliça'>('Trefila');
    const [techEvalAnswers, setTechEvalAnswers] = useState<Record<string, string>>({ q1: '', q2: '', q3: '', q4: '', q5: '' });
    const [techEvalScores, setTechEvalScores] = useState<Record<string, number>>({ q1: 0, q2: 0, q3: 0, q4: 0, q5: 0 });
    const [techEvalSkills, setTechEvalSkills] = useState<Record<string, number>>({ h1: 0, h2: 0, h3: 0, h4: 0 });
    const [techEvalAttitudes, setTechEvalAttitudes] = useState<Record<string, number>>({ a1: 0, a2: 0, a3: 0, a4: 0 });
    const [techEvalNote, setTechEvalNote] = useState('');

    const shuffledTechQuestions = useMemo(() => {
        const questions = techEvalMachineType === 'Trefila' ? TREFILA_QUESTIONS : TRELICA_QUESTIONS;
        return questions.map(q => ({
            ...q,
            options: [...q.options].sort(() => Math.random() - 0.5)
        }));
    }, [techEvalMachineType, isEvaluatingTechnical]);

    // Documents State
    const [documents, setDocuments] = useState<EmployeeDocument[]>([]);

    // Development Form State
    const [newCourseData, setNewCourseData] = useState<{
        educationType: 'Escolaridade' | 'Graduação' | 'Pós-Graduação' | 'Técnico' | 'Curso Livre' | 'Certificação';
        courseName: string;
        institution: string;
        completionDate: string;
        workloadHours: string;
    }>({ educationType: 'Curso Livre', courseName: '', institution: '', completionDate: '', workloadHours: '' });
    const [courseFile, setCourseFile] = useState<File | null>(null);
    // HR Form State

    // HR Form State
    const [newAbsence, setNewAbsence] = useState({ type: 'Falta Injustificada', startDate: '', endDate: '', reason: '' });
    const [absenceFile, setAbsenceFile] = useState<File | null>(null);
    const periodsOptions = useMemo(() => getAvailablePeriods(employee.admissionDate), [employee.admissionDate]);
    const [newVacation, setNewVacation] = useState({ period: periodsOptions[0] || '', startDate: '', endDate: '', status: 'Agendada' });

    // Handlers for HR
    const handleAddAbsence = async () => {
        if (!newAbsence.startDate) return;
        try {
            let attachmentUrl = null;

            if (absenceFile) {
                const fileName = `absences/${employee.id}_${Date.now()}_${absenceFile.name}`;
                attachmentUrl = await uploadFile('kb-files', fileName, absenceFile);
            }

            await insertItem('employee_absences', {
                employeeId: employee.id,
                type: newAbsence.type,
                startDate: newAbsence.startDate,
                endDate: newAbsence.endDate || null,
                reason: newAbsence.reason,
                attachmentUrl: attachmentUrl
            } as any);
            alert('Ausência registrada');
            setNewAbsence({ type: 'Falta Injustificada', startDate: '', endDate: '', reason: '' });
            setAbsenceFile(null);
            loadDetails();
        } catch (e) {
            console.error(e);
            alert('Erro ao registrar ausência. Verifique se criou a coluna attachment_url no banco.');
        }
    };

    const handleDeleteAbsence = async (id: string) => {
        if (!confirm('Excluir registro?')) return;
        await deleteItem('employee_absences', id);
        loadDetails();
    };

    const handleAddVacation = async () => {
        if (!newVacation.startDate || !newVacation.endDate) return;
        try {
            await insertItem('employee_vacations', {
                employeeId: employee.id,
                period: newVacation.period,
                startDate: newVacation.startDate,
                endDate: newVacation.endDate,
                status: newVacation.status || 'Agendada'
            } as any);
            alert('Férias registradas com sucesso!');
            setNewVacation({ period: periodsOptions[0] || '', startDate: '', endDate: '', status: 'Agendada' });
            loadDetails();
        } catch (e) { alert('Erro ao registrar férias'); }
    };

    const handleDeleteVacation = async (id: string) => {
        if (!confirm('Excluir registro?')) return;
        await deleteItem('employee_vacations', id);
        loadDetails();
    };

    const handleQuickSettleVacation = async (period: string, balance: number) => {
        if (!confirm(`Deseja marcar o saldo restante de ${balance} dias do período ${period} como QUITADO? Isso registrará férias gozadas de ${balance} dias.`)) {
            return;
        }
        try {
            const startYear = parseInt(period);
            const start = new Date(startYear, 0, 1);
            const end = new Date(start);
            end.setDate(start.getDate() + balance - 1);

            const startDateStr = start.toISOString().split('T')[0];
            const endDateStr = end.toISOString().split('T')[0];

            await insertItem('employee_vacations', {
                employeeId: employee.id,
                period: period,
                startDate: startDateStr,
                endDate: endDateStr,
                status: 'Gozada'
            } as any);

            alert('Férias quitadas com sucesso!');
            loadDetails();
            onSave();
        } catch (e) {
            console.error(e);
            alert('Erro ao quitar férias.');
        }
    };

    // Document Handlers
    const handleUploadDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];

        try {
            // Upload to Supabase bucket 'kb-files'
            const fileName = `emp_docs/${employee.id}_${Date.now()}_${file.name}`;
            const publicUrl = await uploadFile('kb-files', fileName, file);

            if (publicUrl) {
                await insertItem('employee_documents', {
                    employeeId: employee.id,
                    title: file.name,
                    type: 'Documento', // Could be refined
                    url: publicUrl
                } as any);
                alert('Documento anexado com sucesso!');
                loadDetails();
            }
        } catch (error) {
            console.error(error);
            alert('Erro ao enviar arquivo. Verifique se o Bucket "kb-files" existe.');
        }
    };

    const handleDeleteDocument = async (id: string) => {
        if (!confirm('Remover este documento?')) return;
        await deleteItem('employee_documents', id);
        loadDetails();
    };

    const handleUpdatePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        let file = e.target.files[0];

        setIsUploading(true);
        try {
            // Compress image if it's large
            if (file.size > 1024 * 1024) { // Only resize if > 1MB
                try {
                    file = await resizeImage(file);
                } catch (err) { console.error("Error resizing", err); }
            }

            const fileName = `avatars/${employee.id}_${Date.now()}_normalized.jpg`;
            const publicUrl = await uploadFile('kb-files', fileName, file);
            if (publicUrl) {
                // Force a query param to bust cache
                const urlWithCacheBust = `${publicUrl}?t=${Date.now()}`;
                const updated = await updateItem('employees', employee.id, { photoUrl: urlWithCacheBust });
                setEmpData({ ...empData, photoUrl: urlWithCacheBust });
                // Also update local list if possible? Ideally reloadData but we are in modal.
                // We'll trust onSave() or next reload.
                alert('Foto atualizada com sucesso!');
            }
        } catch (error) {
            console.error(error);
            alert('Erro ao atualizar foto. Tente uma imagem menor.');
        } finally {
            setIsUploading(false);
            // Clear input
            if (profilePhotoInputRef.current) profilePhotoInputRef.current.value = '';
        }
    };

    const handlePrintProfile = () => {
        // Simple print: open a new window with formatted content or use CSS print media queries on the modal
        // For simplicity, we'll suggest using browser print on a clean view, but opening a new window is cleaner
        window.print();
    };

    useEffect(() => { loadDetails(); }, [employee.id]);

    const loadDetails = async () => {
        try {
            const [resps, crs, abs, vacs, evals, techEvals] = await Promise.all([
                fetchByColumn<EmployeeResponsibility>('employee_responsibilities', 'employee_id', employee.id),
                fetchByColumn<EmployeeCourse>('employee_courses', 'employee_id', employee.id),
                fetchByColumn<EmployeeAbsence>('employee_absences', 'employee_id', employee.id),
                fetchByColumn<EmployeeVacation>('employee_vacations', 'employee_id', employee.id),
                fetchByColumn<Evaluation>('evaluations', 'employee_id', employee.id),
                fetchByColumn<TechnicalEvaluation>('technical_evaluations', 'employee_id', employee.id).catch(() => [])
            ]);
            setResponsibilities(resps);
            setCourses(crs);
            setAbsences(abs);
            setVacations(vacs);
            setTechnicalEvaluations(techEvals.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));

            // Fetch Documents
            const docs = await fetchByColumn<EmployeeDocument>('employee_documents', 'employee_id', employee.id);
            setDocuments(docs || []);

            // Load HR Data
            const absencesData = await fetchByColumn<EmployeeAbsence>('employee_absences', 'employee_id', employee.id);
            const vacationsData = await fetchByColumn<EmployeeVacation>('employee_vacations', 'employee_id', employee.id);
            if (absencesData) setAbsences(absencesData);
            if (vacationsData) setVacations(vacationsData);

            setEvaluations(evals.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));

            // Fetch Kaizen Tasks
            try {
                const allProblems = await fetchTable<KaizenProblem>('kaizen_problems');
                const employeeTasks = allProblems.filter(p => {
                    const isResponsibleId = p.responsibleIds?.includes(employee.id);
                    const isResponsibleName = p.responsible && p.responsible.includes(employee.name); // Backward compatibility
                    return (isResponsibleId || isResponsibleName) && p.status !== 'Resolvido';
                });
                setKaizenTasks(employeeTasks);
            } catch (kErr) { console.error('Error fetching kaizen tasks', kErr); }

        } catch (e) {
            console.error("Error loading employee details", e);
        }
    };

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await updateItem('employees', empData.id, empData);
            alert('Perfil atualizado!');
            onSave();
        } catch (error) { alert('Erro ao atualizar perfil.'); }
    };

    // ... Handlers for tabs ...
    const handleAddResponsibility = async () => {
        if (!newResp) return;
        try {
            const added = await insertItem<EmployeeResponsibility>('employee_responsibilities', {
                employeeId: employee.id, description: newResp, isCritical: false
            } as EmployeeResponsibility);
            setResponsibilities([...responsibilities, added]);
            setNewResp('');
        } catch (e) { alert('Erro ao adicionar'); }
    };

    const handleDeleteResponsibility = async (id: string) => {
        if (!confirm('Remover?')) return;
        await deleteItem('employee_responsibilities', id);
        setResponsibilities(responsibilities.filter(r => r.id !== id));
    };

    // Development Handlers
    const handleAddCourse = async () => {
        if (!newCourseData.courseName) return;
        try {
            let attachmentUrl = null;
            if (courseFile) {
                const fileName = `courses/${employee.id}_${Date.now()}_${courseFile.name}`;
                attachmentUrl = await uploadFile('kb-files', fileName, courseFile);
            }

            const added = await insertItem('employee_courses', {
                employeeId: employee.id,
                courseName: newCourseData.courseName,
                institution: newCourseData.institution,
                educationType: newCourseData.educationType,
                completionDate: newCourseData.completionDate || null,
                workloadHours: newCourseData.workloadHours ? parseFloat(newCourseData.workloadHours) : null,
                status: 'Concluído',
                attachmentUrl: attachmentUrl
            } as any);

            setCourses([...courses, added as EmployeeCourse]);
            alert('Qualificação adicionada!');
            setNewCourseData({ educationType: 'Curso Livre', courseName: '', institution: '', completionDate: '', workloadHours: '' });
            setCourseFile(null);
            loadDetails();
        } catch (e) {
            console.error(e);
            alert('Erro ao registrar curso. Verifique se executou o script SQL.');
        }
    };

    const handleDeleteCourse = async (id: string) => {
        if (!confirm('Remover esta qualificação?')) return;
        await deleteItem('employee_courses', id);
        loadDetails();
    };

    const handleSubmitEvaluation = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) return;
        try {
            const newEval = await insertItem<Evaluation>('evaluations', {
                employeeId: employee.id,
                evaluator: currentUser.username,
                date: new Date().toISOString(),
                organizationScore: evalScores.organization,
                cleanlinessScore: evalScores.cleanliness,
                effortScore: evalScores.effort,
                communicationScore: evalScores.communication,
                improvementScore: evalScores.improvement,
                note: evalNote
            } as Evaluation);
            setEvaluations([newEval, ...evaluations]);
            setIsEvaluating(false);
            setEvalScores({ organization: 0, cleanliness: 0, effort: 0, communication: 0, improvement: 0 });
            setEvalNote('');
            alert('Avaliação salva!');
            onSave();
        } catch (e) { alert('Erro ao salvar avaliação'); }
    };

    const handleSubmitTechnicalEvaluation = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) return;
        
        // Calculate average score of graded elements (CHA)
        // Both Trefila and Treliça have exactly 5 knowledge questions, 4 skills, and 4 attitudes, totaling 13 graded elements.
        const qSum = techEvalScores.q1 + techEvalScores.q2 + techEvalScores.q3 + techEvalScores.q4 + techEvalScores.q5;
        const hSum = techEvalSkills.h1 + techEvalSkills.h2 + techEvalSkills.h3 + techEvalSkills.h4;
        const aSum = techEvalAttitudes.a1 + techEvalAttitudes.a2 + techEvalAttitudes.a3 + techEvalAttitudes.a4;
        const total = (qSum + hSum + aSum) / 13;

        try {
            const newEval = await insertItem<TechnicalEvaluation>('technical_evaluations', {
                employeeId: employee.id,
                evaluator: currentUser.username,
                date: new Date(techEvalDate).toISOString(),
                monthNum: techEvalMonth,
                machineType: techEvalMachineType,
                q1Answer: techEvalAnswers.q1,
                q1Score: techEvalScores.q1,
                q2Answer: techEvalAnswers.q2,
                q2Score: techEvalScores.q2,
                q3Answer: techEvalAnswers.q3,
                q3Score: techEvalScores.q3,
                q4Answer: techEvalAnswers.q4,
                q4Score: techEvalScores.q4,
                q5Answer: techEvalAnswers.q5,
                q5Score: techEvalScores.q5,
                h1Score: techEvalSkills.h1,
                h2Score: techEvalSkills.h2,
                h3Score: techEvalSkills.h3,
                h4Score: techEvalSkills.h4,
                a1Score: techEvalAttitudes.a1,
                a2Score: techEvalAttitudes.a2,
                a3Score: techEvalAttitudes.a3,
                a4Score: techEvalAttitudes.a4,
                totalScore: parseFloat(total.toFixed(2)),
                note: techEvalNote
            } as TechnicalEvaluation);

            setTechnicalEvaluations([newEval, ...technicalEvaluations]);
            setIsEvaluatingTechnical(false);
            setTechEvalMonth(1);
            setTechEvalDate(new Date().toISOString().split('T')[0]);
            setTechEvalAnswers({ q1: '', q2: '', q3: '', q4: '', q5: '' });
            setTechEvalScores({ q1: 0, q2: 0, q3: 0, q4: 0, q5: 0 });
            setTechEvalSkills({ h1: 0, h2: 0, h3: 0, h4: 0 });
            setTechEvalAttitudes({ a1: 0, a2: 0, a3: 0, a4: 0 });
            setTechEvalNote('');
            alert('Avaliação de Conhecimento salva com sucesso!');
            loadDetails();
            onSave();
        } catch (e) {
            console.error('Error saving technical evaluation:', e);
            alert('Erro ao salvar avaliação.');
        }
    };

    const handleDeleteTechnicalEvaluation = async (id: string) => {
        if (!confirm('Deseja realmente excluir esta avaliação técnica?')) return;
        try {
            await deleteItem('technical_evaluations', id);
            setTechnicalEvaluations(technicalEvaluations.filter(e => e.id !== id));
            alert('Avaliação técnica excluída!');
            loadDetails();
            onSave();
        } catch (e) {
            console.error(e);
            alert('Erro ao excluir avaliação técnica.');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-0">
            <div className="bg-white w-full h-full shadow-2xl flex flex-col overflow-hidden">
                <div className="bg-slate-50 p-6 border-b border-slate-200 flex justify-between items-start no-print">
                    <div className="flex items-center space-x-4">
                        <div className="h-20 w-20 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden border-4 border-white shadow-sm relative group">
                            {empData.photoUrl ? <img src={empData.photoUrl} alt={empData.name} className={`h-full w-full object-cover transition-opacity ${isUploading ? 'opacity-50' : ''}`} /> : <span className="text-3xl font-bold text-slate-400">{empData.name.charAt(0)}</span>}

                            {/* Loading Spinner */}
                            {isUploading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-20">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                                </div>
                            )}

                            <div onClick={() => !readOnly && !isUploading && profilePhotoInputRef.current?.click()} className={`absolute inset-0 bg-black/30 flex items-center justify-center cursor-pointer transition ${readOnly ? 'hidden' : ''} ${isUploading ? 'hidden' : ''}`}>
                                <PencilIcon className="text-white h-6 w-6 opacity-70 hover:opacity-100" />
                                <input
                                    ref={profilePhotoInputRef}
                                    type="file"
                                    accept="image/*"
                                    capture="user"
                                    className="hidden"
                                    onChange={handleUpdatePhoto}
                                    disabled={readOnly || isUploading}
                                />
                            </div>
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800">{empData.name}</h2>
                            <p className="text-slate-500">{empData.sector} • {empData.shift}</p>
                            <div className="flex space-x-2 mt-2">
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${empData.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{empData.active ? 'Ativo' : 'Inativo'}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={handlePrintProfile} className="text-blue-400 hover:text-blue-600 p-2 rounded-full hover:bg-blue-50 transition" title="Imprimir Ficha">
                            <PrinterIcon className="h-5 w-5" />
                        </button>
                        {empData.orgPositionId && (
                            <button
                                onClick={() => { onClose(); onSave(); /* Signal parent to switch view? We can just tell the user to switch to Org Chart */ alert('Mude para a aba "Organograma" para visualizar este colaborador na hierarquia.'); }}
                                className="text-amber-500 hover:text-amber-600 p-2 rounded-full hover:bg-amber-50 transition"
                                title="Localizar no Organograma"
                            >
                                <ChartBarIcon className="h-5 w-5" />
                            </button>
                        )}
                        {!readOnly && (
                            <button onClick={onDelete} className="text-red-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition" title="Excluir Este Funcionário">
                                <TrashIcon className="h-5 w-5" />
                            </button>
                        )}
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-200 transition">✕</button>
                    </div>
                </div>
                <div className="flex border-b border-slate-200 bg-white overflow-x-auto no-scrollbar no-print">
                    {[
                        { id: 'profile', label: 'Resumo / Perfil', icon: <UserIcon className="h-4 w-4" /> },
                        { id: 'responsibilities', label: 'Atribuições', icon: <DocumentTextIcon className="h-4 w-4" /> },
                        { id: 'development', label: 'Desenvolvimento', icon: <BookOpenIcon className="h-4 w-4" /> },
                        { id: 'hr', label: 'RH (Férias/Faltas)', icon: <ClockIcon className="h-4 w-4" /> },
                        { id: 'documents', label: 'Documentos', icon: <DocumentTextIcon className="h-4 w-4" /> },
                        { id: 'evaluations', label: 'Avaliações', icon: <StarIcon className="h-4 w-4" /> },
                        { id: 'tasks', label: 'Pendências', icon: <CheckCircleIcon className="h-4 w-4" /> },
                    ].map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`relative flex items-center space-x-2 px-6 py-4 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === tab.id ? 'border-[#0F3F5C] text-[#0F3F5C] bg-slate-50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
                            {tab.icon} <span>{tab.label}</span>
                            {tab.id === 'tasks' && kaizenTasks.length > 0 && (
                                <span className="absolute top-2 right-2 flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                </span>
                            )}
                        </button>
                    ))}
                </div>
                <div className="flex-grow overflow-y-auto p-6 bg-slate-50">
                    {activeTab === 'profile' && (
                        <form onSubmit={handleUpdateProfile} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                                <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">Dados Pessoais</h3>
                                <div className="space-y-4">
                                    <div><label className="block text-xs font-semibold text-slate-500 uppercase">Nome Completo</label><input type="text" disabled={readOnly} className="w-full mt-1 p-2 border rounded-lg disabled:bg-slate-100" value={empData.name} onChange={e => setEmpData({ ...empData, name: e.target.value })} /></div>
                                    <MobileFriendlyDateInput label="Data Nascimento" value={empData.birthDate} onChange={v => setEmpData({ ...empData, birthDate: v })} disabled={readOnly} />
                                    <div><label className="block text-xs font-semibold text-slate-500 uppercase">Estado Civil</label><select disabled={readOnly} className="w-full mt-1 p-2 border rounded-lg disabled:bg-slate-100" value={empData.maritalStatus || ''} onChange={e => setEmpData({ ...empData, maritalStatus: e.target.value })}><option value="">Selecione</option><option value="Solteiro(a)">Solteiro(a)</option><option value="Casado(a)">Casado(a)</option><option value="Divorciado(a)">Divorciado(a)</option></select></div>
                                    <div><label className="block text-xs font-semibold text-slate-500 uppercase">Filhos</label><input type="number" disabled={readOnly} className="w-full mt-1 p-2 border rounded-lg disabled:bg-slate-100" value={empData.childrenCount || 0} onChange={e => setEmpData({ ...empData, childrenCount: parseInt(e.target.value) })} /></div>
                                    <div><label className="block text-xs font-semibold text-slate-500 uppercase">Telefone / Contato</label><input type="text" disabled={readOnly} className="w-full mt-1 p-2 border rounded-lg disabled:bg-slate-100" value={empData.phone || ''} onChange={e => setEmpData({ ...empData, phone: e.target.value })} /></div>
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                                <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">Dados Profissionais</h3>
                                <div className="space-y-4">
                                    {/* Link to Org Chart Position */}
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase">Posição no Organograma (Vínculo Hierárquico)</label>
                                        <select
                                            disabled={readOnly}
                                            className="w-full mt-1 p-2 border rounded-lg disabled:bg-slate-100 bg-blue-50/50 font-bold text-[#0F3F5C]"
                                            value={empData.orgPositionId || ''}
                                            onChange={e => {
                                                const posId = e.target.value;
                                                const selectedPos = orgPositions.find(p => p.id === posId);
                                                const selectedUnit = orgUnits.find(u => u.id === selectedPos?.orgUnitId);

                                                setEmpData({
                                                    ...empData,
                                                    orgPositionId: posId || undefined,
                                                    jobTitle: selectedPos?.title || empData.jobTitle,
                                                    sector: selectedUnit?.name || empData.sector
                                                });
                                            }}
                                        >
                                            <option value="">Não Vinculado ao Organograma</option>
                                            {orgUnits.map(unit => (
                                                <optgroup key={unit.id} label={unit.name}>
                                                    {orgPositions.filter(p => p.orgUnitId === unit.id).map(p => (
                                                        <option key={p.id} value={p.id}>{p.title}</option>
                                                    ))}
                                                </optgroup>
                                            ))}
                                        </select>
                                        <p className="text-[10px] text-slate-400 mt-1 italic">* Ao selecionar uma posição, o Cargo e Setor serão atualizados automaticamente.</p>
                                    </div>

                                    {/* Job Description from OrgPosition */}
                                    {empData.orgPositionId && orgPositions.find(p => p.id === empData.orgPositionId)?.description && (
                                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                            <label className="block text-xs font-bold text-[#0F3F5C] uppercase mb-1 flex items-center gap-1">
                                                <DocumentTextIcon className="h-3 w-3" /> Descrição de Cargo (Organograma)
                                            </label>
                                            <div className="text-xs text-slate-600 whitespace-pre-wrap italic">
                                                {orgPositions.find(p => p.id === empData.orgPositionId)?.description}
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase">Cargo / Função (Exibição)</label>
                                        <input type="text" disabled={readOnly} className="w-full mt-1 p-2 border rounded-lg disabled:bg-slate-100" value={empData.jobTitle || ''} onChange={e => setEmpData({ ...empData, jobTitle: e.target.value })} placeholder="Ex: Operador Trefila I" />
                                    </div>
                                    <MobileFriendlyDateInput label="Data Admissão" value={empData.admissionDate} onChange={v => setEmpData({ ...empData, admissionDate: v })} disabled={readOnly} />
                                    <div className="grid grid-cols-1 gap-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 uppercase">Setor (Exibição)</label>
                                            <input type="text" disabled={readOnly} className="w-full mt-1 p-2 border rounded-lg disabled:bg-slate-100" value={empData.sector} onChange={e => setEmpData({ ...empData, sector: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 uppercase">Máquina Atribuída (Para Ordem de Produção)</label>
                                            <select
                                                disabled={readOnly}
                                                className="w-full mt-1 p-2 border rounded-lg disabled:bg-slate-100"
                                                value={empData.assignedMachine || ''}
                                                onChange={e => setEmpData({ ...empData, assignedMachine: e.target.value })}
                                            >
                                                <option value="">Sem máquina específica (Todas permitidas)</option>
                                                <option value="Trefila 1">Trefila 1</option>
                                                <option value="Trefila 2">Trefila 2</option>
                                                <option value="Treliça 1">Treliça 1</option>
                                                <option value="Treliça 2">Treliça 2</option>
                                            </select>
                                        </div>
                                    </div>
                                    {!readOnly && <div className="pt-4 flex justify-end"><button type="submit" className="bg-[#0F3F5C] text-white font-bold py-2 px-6 rounded-lg hover:bg-[#0A2A3D] transition">Salvar Alterações</button></div>}
                                </div>
                            </div>
                        </form>
                    )}
                    {activeTab === 'responsibilities' && (
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                            {!readOnly && <div className="flex gap-2 mb-6"><input className="flex-grow p-2 border rounded-lg" placeholder="Adicionar nova responsabilidade..." value={newResp} onChange={e => setNewResp(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddResponsibility()} /><button onClick={handleAddResponsibility} className="bg-green-600 text-white px-4 rounded-lg hover:bg-green-700">Adicionar</button></div>}
                            <ul className="space-y-2">{responsibilities.map(r => (<li key={r.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100"><span className="text-slate-700">{r.description}</span>{!readOnly && <button onClick={() => handleDeleteResponsibility(r.id)} className="text-red-500 hover:text-red-700"><TrashIcon className="h-4 w-4" /></button>}</li>))} {responsibilities.length === 0 && <p className="text-slate-400 text-center py-4">Nenhuma atribuição cadastrada.</p>}</ul>
                        </div>
                    )}
                    {activeTab === 'development' && (
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                            <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2 flex items-center gap-2">
                                <BookOpenIcon className="h-5 w-5 text-blue-500" />
                                Histórico Educacional e Cursos
                            </h3>
                            {!readOnly && (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 bg-slate-50 p-4 rounded-lg">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500">Tipo</label>
                                        <select
                                            className="w-full p-2 border rounded"
                                            value={newCourseData.educationType}
                                            onChange={e => setNewCourseData({ ...newCourseData, educationType: e.target.value as any })}
                                        >
                                            <option value="Escolaridade">Escolaridade Básica</option>
                                            <option value="Graduação">Graduação</option>
                                            <option value="Pós-Graduação">Pós-Graduação</option>
                                            <option value="Técnico">Curso Técnico</option>
                                            <option value="Curso Livre">Curso Livre / Treinamento</option>
                                            <option value="Certificação">Certificação</option>
                                        </select>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="text-xs font-bold text-slate-500">Nome do Curso / Formação</label>
                                        <input className="w-full p-2 border rounded" placeholder="Ex: Engenharia de Produção, NR-12..." value={newCourseData.courseName} onChange={e => setNewCourseData({ ...newCourseData, courseName: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500">Instituição</label>
                                        <input className="w-full p-2 border rounded" placeholder="Ex: SENAI, USP..." value={newCourseData.institution} onChange={e => setNewCourseData({ ...newCourseData, institution: e.target.value })} />
                                    </div>

                                    <div>
                                        <MobileFriendlyDateInput label="Data Conclusão" value={newCourseData.completionDate} onChange={v => setNewCourseData({ ...newCourseData, completionDate: v })} disabled={readOnly} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500">Carga Horária (h)</label>
                                        <input type="number" className="w-full p-2 border rounded" placeholder="Ex: 40" value={newCourseData.workloadHours} onChange={e => setNewCourseData({ ...newCourseData, workloadHours: e.target.value })} />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="text-xs font-bold text-slate-500">Certificado (PDF/Img)</label>
                                        <input
                                            ref={courseFileInputRef}
                                            type="file"
                                            accept="image/*"
                                            capture="environment"
                                            className="hidden"
                                            onChange={(e) => setCourseFile(e.target.files ? e.target.files[0] : null)}
                                        />
                                        <button
                                            onClick={() => courseFileInputRef.current?.click()}
                                            className="w-full py-2 px-4 border border-dashed border-blue-300 rounded-lg text-blue-600 bg-blue-50 hover:bg-blue-100 text-xs font-bold flex items-center justify-center gap-2"
                                        >
                                            <DocumentTextIcon className="h-4 w-4" />
                                            {courseFile ? 'Arquivo Selecionado (Clique para alterar)' : 'Tirar Foto ou Escolher Arquivo'}
                                        </button>
                                    </div>
                                    <div className="flex items-end">
                                        <button onClick={handleAddCourse} className="w-full bg-blue-600 text-white font-bold py-2 rounded hover:bg-blue-700 transition">Adicionar Qualificação</button>
                                    </div>
                                </div>
                            )}

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs uppercase bg-slate-100 text-slate-600 font-bold">
                                        <tr>
                                            <th className="px-4 py-3">Tipo</th>
                                            <th className="px-4 py-3">Curso / Instituição</th>
                                            <th className="px-4 py-3">Conclusão</th>
                                            <th className="px-4 py-3 text-center">Certificado</th>
                                            <th className="px-4 py-3 text-center">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {courses.map(c => (
                                            <tr key={c.id} className="border-b hover:bg-slate-50">
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${c.educationType?.includes('Graduação') ? 'bg-purple-100 text-purple-700' :
                                                        c.educationType === 'Técnico' ? 'bg-orange-100 text-orange-700' :
                                                            'bg-slate-200 text-slate-700'
                                                        }`}>
                                                        {c.educationType || 'Curso'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="font-bold text-slate-800">{c.courseName}</div>
                                                    <div className="text-xs text-slate-500">{c.institution} {c.workloadHours ? `• ${c.workloadHours}h` : ''}</div>
                                                </td>
                                                <td className="px-4 py-3 text-slate-600">
                                                    {c.completionDate ? new Date(c.completionDate).toLocaleDateString() : '-'}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {c.attachmentUrl ? (
                                                        <a href={c.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline flex items-center justify-center gap-1 text-xs font-bold">
                                                            <DocumentTextIcon className="h-4 w-4" /> Ver Anexo
                                                        </a>
                                                    ) : <span className="text-slate-300">-</span>}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {!readOnly && <button onClick={() => handleDeleteCourse(c.id)} className="text-red-400 hover:text-red-600"><TrashIcon className="h-4 w-4" /></button>}
                                                </td>
                                            </tr>
                                        ))}
                                        {courses.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-slate-400">Nenhum curso registrado.</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                    {activeTab === 'evaluations' && (
                        <div className="space-y-6">
                            {/* Navegação de Sub-abas */}
                            <div className="flex border-b border-slate-200 mb-4 no-print gap-2">
                                <button
                                    type="button"
                                    onClick={() => { setActiveEvalSubTab('behavioral'); setSelectedTechEval(null); setIsEvaluatingTechnical(false); }}
                                    className={`px-4 py-2 text-xs font-black uppercase tracking-wider border-b-2 transition-colors ${activeEvalSubTab === 'behavioral' ? 'border-[#0F3F5C] text-[#0F3F5C]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                                >
                                    🎭 Comportamental / Rápida
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setActiveEvalSubTab('technical'); setIsEvaluating(false); }}
                                    className={`px-4 py-2 text-xs font-black uppercase tracking-wider border-b-2 transition-colors ${activeEvalSubTab === 'technical' ? 'border-[#0F3F5C] text-[#0F3F5C]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                                >
                                    ⚙️ Teste de Conhecimento (CHA)
                                </button>
                            </div>

                            {/* SUB-ABA 1: AVALIAÇÃO COMPORTAMENTAL */}
                            {activeEvalSubTab === 'behavioral' && (
                                <div className="space-y-6 no-print">
                                    {!readOnly && (
                                        !isEvaluating ? (
                                            <button onClick={() => setIsEvaluating(true)} className="w-full bg-[#0F3F5C] text-white font-bold py-3 rounded-xl hover:bg-[#0A2A3D] transition shadow-md">
                                                + Nova Avaliação Rápida
                                            </button>
                                        ) : (
                                            <div className="bg-white p-6 rounded-xl border border-blue-100 shadow-md">
                                                <h4 className="font-bold text-lg mb-4 text-[#0F3F5C]">Nova Avaliação</h4>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                                    {[{ key: 'organization', label: 'Organização' }, { key: 'cleanliness', label: 'Limpeza Máquina' }, { key: 'effort', label: 'Empenho' }, { key: 'communication', label: 'Comunicação' }, { key: 'improvement', label: 'Melhoria' }].map(cat => (
                                                        <div key={cat.key} className="flex justify-between items-center bg-slate-50 p-3 rounded-lg">
                                                            <span className="text-sm font-medium">{cat.label}</span>
                                                            {/* @ts-ignore */}
                                                            <StarRating score={evalScores[cat.key]} onChange={v => setEvalScores({ ...evalScores, [cat.key]: v })} />
                                                        </div>
                                                    ))}
                                                </div>
                                                <textarea className="w-full border p-2 rounded-lg text-sm mb-4" placeholder="Observação..." value={evalNote} onChange={e => setEvalNote(e.target.value)} />
                                                <div className="flex justify-end gap-3">
                                                    <button onClick={() => setIsEvaluating(false)} className="text-slate-500 hover:text-slate-700">Cancelar</button>
                                                    <button onClick={handleSubmitEvaluation} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold">Salvar Avaliação</button>
                                                </div>
                                            </div>
                                        )
                                    )}
                                    <div className="space-y-4">
                                        {evaluations.map(ev => (
                                            <div key={ev.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-800">{new Date(ev.date).toLocaleDateString()} - Avaliado por {ev.evaluator}</p>
                                                        <div className="flex items-center mt-1">
                                                            <StarIcon className="h-4 w-4 text-yellow-400 fill-current mr-1" />
                                                            <span className="font-bold">{(ev.totalScore / 5).toFixed(1)}</span>
                                                        </div>
                                                    </div>
                                                    <span className="text-xs text-slate-400 font-semibold">Total: {ev.totalScore}/25</span>
                                                </div>
                                                {ev.note && <p className="text-sm text-slate-600 bg-slate-50 p-2 rounded italic">"{ev.note}"</p>}
                                            </div>
                                        ))}
                                        {evaluations.length === 0 && (
                                            <p className="text-slate-400 text-center py-4">Nenhuma avaliação comportamental registrada.</p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* SUB-ABA 2: TESTE DE CONHECIMENTO (CHA) */}
                            {activeEvalSubTab === 'technical' && (() => {
                                const liveCScore = (techEvalScores.q1 + techEvalScores.q2 + techEvalScores.q3 + techEvalScores.q4 + techEvalScores.q5) / 5;
                                const liveHScore = (techEvalSkills.h1 + techEvalSkills.h2 + techEvalSkills.h3 + techEvalSkills.h4) / 4;
                                const liveAScore = (techEvalAttitudes.a1 + techEvalAttitudes.a2 + techEvalAttitudes.a3 + techEvalAttitudes.a4) / 4;
                                const liveTotalScore = (techEvalScores.q1 + techEvalScores.q2 + techEvalScores.q3 + techEvalScores.q4 + techEvalScores.q5 +
                                                       techEvalSkills.h1 + techEvalSkills.h2 + techEvalSkills.h3 + techEvalSkills.h4 +
                                                       techEvalAttitudes.a1 + techEvalAttitudes.a2 + techEvalAttitudes.a3 + techEvalAttitudes.a4) / 13;
                                return (
                                    <div className="space-y-6">
                                        {/* Caso 1: Criando/Editando Avaliação CHA */}
                                        {isEvaluatingTechnical && !readOnly && (
                                            <form onSubmit={handleSubmitTechnicalEvaluation} className="bg-white p-6 rounded-xl border border-blue-100 shadow-md space-y-6 no-print">
                                                <div className="flex justify-between items-center border-b pb-3">
                                                    <h4 className="font-black text-lg text-[#0F3F5C] uppercase tracking-tight">Novo Teste de Conhecimento (CHA)</h4>
                                                <button type="button" onClick={() => setIsEvaluatingTechnical(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
                                            </div>

                                            {/* Cabeçalho do formulário */}
                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                                <div>
                                                    <label className="block text-xs font-black text-slate-500 uppercase">Máquina / Posto de Trabalho</label>
                                                    <select
                                                        required
                                                        className="w-full mt-1 p-2 border rounded-lg bg-blue-50 text-[#0F3F5C] font-extrabold"
                                                        value={techEvalMachineType}
                                                        onChange={e => {
                                                            const type = e.target.value as 'Trefila' | 'Treliça';
                                                            setTechEvalMachineType(type);
                                                            // Limpar respostas antigas ao trocar
                                                            setTechEvalAnswers({ q1: '', q2: '', q3: '', q4: '', q5: '' });
                                                            setTechEvalScores({ q1: 0, q2: 0, q3: 0, q4: 0, q5: 0 });
                                                        }}
                                                    >
                                                        <option value="Trefila">Trefila (Wire Drawing)</option>
                                                        <option value="Treliça">Treliça (Truss Machine)</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-black text-slate-500 uppercase">Período de Experiência</label>
                                                    <select
                                                        required
                                                        className="w-full mt-1 p-2 border rounded-lg bg-slate-50 text-slate-900 font-bold"
                                                        value={techEvalMonth}
                                                        onChange={e => setTechEvalMonth(parseInt(e.target.value))}
                                                    >
                                                        <option value={1}>1º Mês de Experiência</option>
                                                        <option value={2}>2º Mês de Experiência</option>
                                                        <option value={3}>3º Mês de Experiência</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-black text-slate-500 uppercase">Data do Teste</label>
                                                    <input
                                                        type="date"
                                                        required
                                                        className="w-full mt-1 p-2 border rounded-lg bg-slate-50 text-slate-900 font-bold"
                                                        value={techEvalDate}
                                                        onChange={e => setTechEvalDate(e.target.value)}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-black text-slate-500 uppercase">Avaliador</label>
                                                    <input
                                                        type="text"
                                                        disabled
                                                        className="w-full mt-1 p-2 border rounded-lg bg-slate-200 text-slate-700 font-bold cursor-not-allowed"
                                                        value={currentUser?.username || ''}
                                                    />
                                                </div>
                                            </div>

                                            {/* Painel de Notas CHA em Tempo Real */}
                                            <div className="bg-[#0F3F5C]/5 border border-[#0F3F5C]/10 rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-4 items-center">
                                                <div className="text-center p-2 bg-white rounded-lg shadow-sm border border-blue-100/40">
                                                    <span className="text-[10px] font-black text-blue-700 uppercase tracking-wider block">C - Conhecimento</span>
                                                    <span className="text-lg font-black text-blue-800">{liveCScore.toFixed(1)} <span className="text-xs text-blue-400">/10</span></span>
                                                </div>
                                                <div className="text-center p-2 bg-white rounded-lg shadow-sm border border-green-100/40">
                                                    <span className="text-[10px] font-black text-green-700 uppercase tracking-wider block">H - Habilidade</span>
                                                    <span className="text-lg font-black text-green-800">{liveHScore.toFixed(1)} <span className="text-xs text-green-400">/10</span></span>
                                                </div>
                                                <div className="text-center p-2 bg-white rounded-lg shadow-sm border border-purple-100/40">
                                                    <span className="text-[10px] font-black text-purple-700 uppercase tracking-wider block">A - Atitude</span>
                                                    <span className="text-lg font-black text-purple-800">{liveAScore.toFixed(1)} <span className="text-xs text-purple-400">/10</span></span>
                                                </div>
                                                <div className="text-center p-2 bg-blue-600 text-white rounded-lg shadow-md col-span-2 md:col-span-1">
                                                    <span className="text-[10px] font-black text-blue-100 uppercase tracking-wider block">Média CHA Geral</span>
                                                    <span className="text-xl font-black">{liveTotalScore.toFixed(1)} <span className="text-xs text-blue-200">/10</span></span>
                                                </div>
                                            </div>

                                            {/* PILLAR 1: CONHECIMENTO */}
                                            <div className="space-y-6 border-t pt-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="flex items-center justify-center bg-blue-100 text-[#0F3F5C] h-6 w-6 rounded-full font-black text-xs">C</span>
                                                    <h3 className="text-base font-black text-[#0F3F5C] uppercase tracking-wider">Avaliação de Conhecimento (Perguntas)</h3>
                                                </div>
                                                
                                                {shuffledTechQuestions.map((q, idx) => (
                                                    <div key={q.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 space-y-4">
                                                        <div>
                                                            <span className="text-[9px] font-black uppercase text-blue-700 tracking-wider block">{q.section}</span>
                                                            <label className="text-sm font-black text-[#0F3F5C] block mt-0.5">{idx + 1}. {q.text}</label>
                                                        </div>
                                                        
                                                        <div className="space-y-2">
                                                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide">Selecione a resposta dada pelo colaborador:</label>
                                                            <div className="grid grid-cols-1 gap-2">
                                                                {q.options.map((optionText, optIdx) => {
                                                                    const isSelected = techEvalAnswers[q.id] === optionText;
                                                                    return (
                                                                        <label
                                                                            key={optIdx}
                                                                            className={`flex items-start gap-3 p-3 rounded-lg border text-xs font-bold cursor-pointer transition-all ${
                                                                                isSelected
                                                                                    ? 'border-blue-500 bg-blue-50/50 text-blue-900 shadow-sm'
                                                                                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                                                                            }`}
                                                                        >
                                                                            <input
                                                                                type="radio"
                                                                                name={`question_${q.id}`}
                                                                                required
                                                                                className="mt-0.5 text-blue-600 focus:ring-blue-400"
                                                                                checked={isSelected}
                                                                                onChange={() => {
                                                                                    const newAnswers = { ...techEvalAnswers, [q.id]: optionText };
                                                                                    setTechEvalAnswers(newAnswers);
                                                                                    
                                                                                    const isCorrect = optionText === q.correct;
                                                                                    const newScores = { ...techEvalScores, [q.id]: isCorrect ? 10 : 0 };
                                                                                    setTechEvalScores(newScores);
                                                                                }}
                                                                            />
                                                                            <span>{optionText}</span>
                                                                        </label>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="flex justify-between items-center bg-white px-3 py-2 rounded-lg border border-slate-100">
                                                            <span className="text-xs font-bold text-slate-500">
                                                                Gabarito: <strong className="text-slate-800">{q.correct}</strong>
                                                            </span>
                                                            <div className="flex items-center gap-2 shrink-0">
                                                                <label className="text-[10px] font-black text-slate-400 uppercase">Ajustar Nota (Manual):</label>
                                                                <select
                                                                    className="p-1 border rounded bg-slate-50 font-black text-xs text-[#0F3F5C] w-16 text-center"
                                                                    value={techEvalScores[q.id]}
                                                                    onChange={e => setTechEvalScores({ ...techEvalScores, [q.id]: parseFloat(e.target.value) })}
                                                                >
                                                                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                                                                        <option key={n} value={n}>{n}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* PILLAR 2: HABILIDADE */}
                                            <div className="space-y-4 border-t pt-6">
                                                <div className="flex items-center gap-2">
                                                    <span className="flex items-center justify-center bg-green-100 text-green-700 h-6 w-6 rounded-full font-black text-xs">H</span>
                                                    <h3 className="text-base font-black text-green-700 uppercase tracking-wider">Avaliação de Habilidade (Prática Operacional)</h3>
                                                </div>
                                                
                                                {[
                                                    { id: 'h1', title: 'Setup e Ajustes da Máquina', desc: 'Domínio técnico na regulagem, troca de carretéis, ferramentas e preparação geral da máquina.' },
                                                    { id: 'h2', title: 'Ritmo de Trabalho e Produtividade', desc: 'Eficiência e velocidade na operação diária, atingimento de metas e foco produtivo.' },
                                                    { id: 'h3', title: 'Controle de Qualidade', desc: 'Inspeção de bitolas, conformidade de tolerâncias e prevenção de defeitos do produto final.' },
                                                    { id: 'h4', title: 'Segurança Operacional', desc: 'Cumprimento de regras de segurança, uso correto de EPIs e postura segura de trabalho.' }
                                                ].map(h => (
                                                    <div key={h.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 flex flex-col md:flex-row justify-between md:items-center gap-4">
                                                        <div>
                                                            <h5 className="font-bold text-slate-800 text-sm">{h.title}</h5>
                                                            <p className="text-xs text-slate-500">{h.desc}</p>
                                                        </div>
                                                        <div className="flex items-center gap-3 shrink-0">
                                                            <label className="text-xs font-bold text-slate-500 uppercase">Nota (0 a 10):</label>
                                                            <select
                                                                className="p-1.5 border rounded-lg bg-white font-extrabold text-green-700 w-24 text-center"
                                                                value={techEvalSkills[h.id]}
                                                                onChange={e => setTechEvalSkills({ ...techEvalSkills, [h.id]: parseFloat(e.target.value) })}
                                                            >
                                                                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                                                                    <option key={n} value={n}>{n}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* PILLAR 3: ATITUDE */}
                                            <div className="space-y-4 border-t pt-6">
                                                <div className="flex items-center gap-2">
                                                    <span className="flex items-center justify-center bg-purple-100 text-purple-700 h-6 w-6 rounded-full font-black text-xs">A</span>
                                                    <h3 className="text-base font-black text-purple-700 uppercase tracking-wider">Avaliação de Atitude (Comportamento)</h3>
                                                </div>

                                                {[
                                                    { id: 'a1', title: 'Organização e Limpeza (5S)', desc: 'Conservação da máquina atribuída, limpeza do posto de trabalho e descarte correto de resíduos/sucata.' },
                                                    { id: 'a2', title: 'Assiduidade e Disciplina', desc: 'Cumprimento de horários, postura profissional, respeito às normas da fábrica e assiduidade.' },
                                                    { id: 'a3', title: 'Iniciativa e Melhoria Contínua', desc: 'Proatividade para buscar soluções, informar desvios operacionais e buscar novos aprendizados.' },
                                                    { id: 'a4', title: 'Trabalho em Equipe e Postura', desc: 'Espírito cooperativo com o turno, comunicação clara com colegas e líderes e postura ética.' }
                                                ].map(a => (
                                                    <div key={a.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 flex flex-col md:flex-row justify-between md:items-center gap-4">
                                                        <div>
                                                            <h5 className="font-bold text-slate-800 text-sm">{a.title}</h5>
                                                            <p className="text-xs text-slate-500">{a.desc}</p>
                                                        </div>
                                                        <div className="flex items-center gap-3 shrink-0">
                                                            <label className="text-xs font-bold text-slate-500 uppercase">Nota (0 a 10):</label>
                                                            <select
                                                                className="p-1.5 border rounded-lg bg-white font-extrabold text-purple-700 w-24 text-center"
                                                                value={techEvalAttitudes[a.id]}
                                                                onChange={e => setTechEvalAttitudes({ ...techEvalAttitudes, [a.id]: parseFloat(e.target.value) })}
                                                            >
                                                                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                                                                    <option key={n} value={n}>{n}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Observações Gerais */}
                                            <div className="border-t pt-4">
                                                <label className="block text-xs font-black text-slate-500 uppercase">Parecer Geral / Observações do Gestor</label>
                                                <textarea
                                                    className="w-full mt-1 p-2 border rounded-lg text-sm bg-white text-slate-900 font-medium"
                                                    placeholder="Descreva pontos positivos, potencial e feedbacks dados..."
                                                    rows={3}
                                                    value={techEvalNote}
                                                    onChange={e => setTechEvalNote(e.target.value)}
                                                />
                                            </div>

                                            <div className="flex justify-end gap-3 pt-2">
                                                <button type="button" onClick={() => setIsEvaluatingTechnical(false)} className="px-5 py-2 border rounded-lg text-slate-600 font-bold text-sm hover:bg-slate-50">Cancelar</button>
                                                <button type="submit" className="px-6 py-2 bg-[#0F3F5C] text-white font-bold rounded-lg text-sm hover:bg-[#0A2A3D] transition shadow-md">Salvar Avaliação CHA</button>
                                            </div>
                                        </form>
                                    )}

                                    {/* Caso 2: Visualizando Resultados de um Teste CHA */}
                                    {selectedTechEval && (
                                        <div className="space-y-6">
                                            {/* Ações na tela (Voltar / Imprimir) */}
                                            <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-100 shadow-sm no-print">
                                                <button
                                                    onClick={() => setSelectedTechEval(null)}
                                                    className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 rounded-lg text-slate-700 text-xs font-bold hover:bg-slate-50 transition"
                                                >
                                                    <ArrowLeftIcon className="h-4 w-4" /> Voltar ao Histórico
                                                </button>
                                                <button
                                                    onClick={() => window.print()}
                                                    className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition shadow"
                                                >
                                                    <PrinterIcon className="h-4 w-4" /> Imprimir Avaliação
                                                </button>
                                            </div>

                                            {/* Painel de Visualização no Sistema */}
                                            <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-md space-y-6 no-print">
                                                {/* Cabeçalho */}
                                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-4 gap-4">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-black bg-blue-100 text-[#0F3F5C] px-2 py-0.5 rounded uppercase border border-blue-200">
                                                                Posto: {selectedTechEval.machineType}
                                                            </span>
                                                        </div>
                                                        <h4 className="text-xl font-black text-slate-800 mt-1">
                                                            {selectedTechEval.monthNum}º Mês de Experiência
                                                        </h4>
                                                        <p className="text-xs text-slate-500 font-semibold mt-1">
                                                            Avaliado por <strong className="text-slate-700">{selectedTechEval.evaluator}</strong> em {new Date(selectedTechEval.date).toLocaleDateString('pt-BR')}
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Média Geral CHA</span>
                                                        <div className="flex items-baseline justify-end gap-1 mt-1">
                                                            <span className={`text-4xl font-black ${selectedTechEval.totalScore >= 7 ? 'text-green-600' : selectedTechEval.totalScore >= 5 ? 'text-amber-500' : 'text-red-500'}`}>
                                                                {selectedTechEval.totalScore.toFixed(1)}
                                                            </span>
                                                            <span className="text-slate-400 font-bold text-sm">/ 10</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Dashboard Rápido de Notas CHA */}
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    {/* Conhecimento */}
                                                    {(() => {
                                                        const scores = [selectedTechEval.q1Score, selectedTechEval.q2Score, selectedTechEval.q3Score, selectedTechEval.q4Score, selectedTechEval.q5Score];
                                                        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
                                                        return (
                                                            <div className="bg-blue-50/40 p-4 rounded-xl border border-blue-100/60 text-center">
                                                                <span className="text-xs font-bold text-blue-700 uppercase block tracking-wider">C - Conhecimento</span>
                                                                <span className="text-2xl font-black text-blue-800 block mt-1">{avg.toFixed(1)} <strong className="text-xs text-blue-400 font-semibold">/10</strong></span>
                                                                <span className="text-[10px] text-slate-400 mt-1 block">Média das Questões de Conhecimento</span>
                                                            </div>
                                                        );
                                                    })()}

                                                    {/* Habilidade */}
                                                    {(() => {
                                                        const avg = (selectedTechEval.h1Score + selectedTechEval.h2Score + selectedTechEval.h3Score + selectedTechEval.h4Score) / 4;
                                                        return (
                                                            <div className="bg-green-50/40 p-4 rounded-xl border border-green-100/60 text-center">
                                                                <span className="text-xs font-bold text-green-700 uppercase block tracking-wider">H - Habilidade</span>
                                                                <span className="text-2xl font-black text-green-800 block mt-1">{avg.toFixed(1)} <strong className="text-xs text-green-400 font-semibold">/10</strong></span>
                                                                <span className="text-[10px] text-slate-400 mt-1 block">Média de Operação Prática</span>
                                                            </div>
                                                        );
                                                    })()}

                                                    {/* Atitude */}
                                                    {(() => {
                                                        const avg = (selectedTechEval.a1Score + selectedTechEval.a2Score + selectedTechEval.a3Score + selectedTechEval.a4Score) / 4;
                                                        return (
                                                            <div className="bg-purple-50/40 p-4 rounded-xl border border-purple-100/60 text-center">
                                                                <span className="text-xs font-bold text-purple-700 uppercase block tracking-wider">A - Atitude</span>
                                                                <span className="text-2xl font-black text-purple-800 block mt-1">{avg.toFixed(1)} <strong className="text-xs text-purple-400 font-semibold">/10</strong></span>
                                                                <span className="text-[10px] text-slate-400 mt-1 block">Média Comportamental</span>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>

                                                {/* Detalhes Conhecimento */}
                                                <div className="space-y-4">
                                                    <h5 className="font-black text-slate-800 text-sm uppercase tracking-wide border-b pb-1">1. Detalhamento - Conhecimento</h5>
                                                    {(selectedTechEval.machineType === 'Trefila' ? TREFILA_QUESTIONS : TRELICA_QUESTIONS).map((q, idx) => {
                                                        const answer = selectedTechEval[`${q.id}Answer` as keyof TechnicalEvaluation] || '';
                                                        const score = selectedTechEval[`${q.id}Score` as keyof TechnicalEvaluation] || 0;
                                                        return (
                                                            <div key={q.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 space-y-3">
                                                                <div>
                                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">{q.section}</span>
                                                                    <h6 className="font-bold text-slate-800 text-xs mt-0.5">{idx + 1}. {q.text}</h6>
                                                                </div>
                                                                
                                                                {/* Opções de Resposta em modo Leitura */}
                                                                <div className="grid grid-cols-1 gap-1.5 text-xs font-semibold">
                                                                    {q.options.map((opt, optIdx) => {
                                                                        const isSelected = answer === opt;
                                                                        const isCorrectOption = opt === q.correct;
                                                                        let itemClass = "bg-white border-slate-100 text-slate-600";
                                                                        if (isSelected) {
                                                                            itemClass = isCorrectOption 
                                                                                ? "bg-emerald-50 border-emerald-200 text-emerald-900 font-bold" 
                                                                                : "bg-red-50 border-red-200 text-red-900 font-bold";
                                                                        } else if (isCorrectOption && answer) {
                                                                            itemClass = "bg-emerald-50/20 border-emerald-100 text-emerald-800 border-dashed";
                                                                        }
                                                                        return (
                                                                            <div key={optIdx} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${itemClass}`}>
                                                                                <span className="h-4 w-4 shrink-0 flex items-center justify-center rounded-full border text-[9px] font-black uppercase">
                                                                                    {isSelected ? (isCorrectOption ? '✓' : '✕') : String.fromCharCode(65 + optIdx)}
                                                                                </span>
                                                                                <span>{opt}</span>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                                
                                                                <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-200/60">
                                                                    <span className="text-[10px] font-black uppercase tracking-tight">
                                                                        {answer === q.correct ? (
                                                                            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">✓ Resposta Correta</span>
                                                                        ) : answer ? (
                                                                            <span className="text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100">✕ Resposta Incorreta</span>
                                                                        ) : (
                                                                            <span className="text-slate-400 bg-slate-100 px-2 py-0.5 rounded border">Não Respondida</span>
                                                                        )}
                                                                    </span>
                                                                    <span className="font-extrabold text-slate-600">Nota: <strong className="text-slate-800 text-sm">{score}</strong> / 10</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                {/* Detalhes Habilidade */}
                                                <div className="space-y-3">
                                                    <h5 className="font-black text-slate-800 text-sm uppercase tracking-wide border-b pb-1">2. Detalhamento - Habilidade</h5>
                                                    {[
                                                        { key: 'h1', title: 'Setup e Ajustes da Máquina', val: selectedTechEval.h1Score },
                                                        { key: 'h2', title: 'Ritmo de Trabalho e Produtividade', val: selectedTechEval.h2Score },
                                                        { key: 'h3', title: 'Controle de Qualidade', val: selectedTechEval.h3Score },
                                                        { key: 'h4', title: 'Segurança Operacional', val: selectedTechEval.h4Score }
                                                    ].map(h => (
                                                        <div key={h.key} className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border">
                                                            <span className="text-xs font-bold text-slate-700">{h.title}</span>
                                                            <span className="text-xs font-extrabold text-[#0F3F5C] bg-white px-3 py-1 rounded border">Nota: <strong className="text-sm font-black">{h.val}</strong> / 10</span>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Detalhes Atitude */}
                                                <div className="space-y-3">
                                                    <h5 className="font-black text-slate-800 text-sm uppercase tracking-wide border-b pb-1">3. Detalhamento - Atitude</h5>
                                                    {[
                                                        { key: 'a1', title: 'Organização e Limpeza (5S)', val: selectedTechEval.a1Score },
                                                        { key: 'a2', title: 'Assiduidade e Disciplina', val: selectedTechEval.a2Score },
                                                        { key: 'a3', title: 'Iniciativa e Melhoria Contínua', val: selectedTechEval.a3Score },
                                                        { key: 'a4', title: 'Trabalho em Equipe e Postura', val: selectedTechEval.a4Score }
                                                    ].map(a => (
                                                        <div key={a.key} className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border">
                                                            <span className="text-xs font-bold text-slate-700">{a.title}</span>
                                                            <span className="text-xs font-extrabold text-purple-700 bg-white px-3 py-1 rounded border">Nota: <strong className="text-sm font-black">{a.val}</strong> / 10</span>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Observações */}
                                                {selectedTechEval.note && (
                                                    <div className="bg-blue-50/20 border border-blue-100/50 p-4 rounded-xl">
                                                        <h5 className="text-xs font-black text-[#0F3F5C] uppercase tracking-wider mb-1">Comentários e Feedbacks do Gestor</h5>
                                                        <p className="text-slate-700 text-sm whitespace-pre-wrap font-medium italic">"{selectedTechEval.note}"</p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* FOLHA DE IMPRESSÃO A4 (EXCLUSIVA PARA IMPRESSÃO) */}
                                            <div className="hidden print:block print:fixed print:inset-0 print:bg-white print:z-[9999] print:p-10 print:text-black print:overflow-visible text-slate-900 font-sans">
                                                {/* Cabeçalho do Documento */}
                                                <div className="border-b-2 border-slate-900 pb-4 mb-6 flex justify-between items-end">
                                                    <div>
                                                        <h1 className="text-xl font-black tracking-tight uppercase">MSM - Gestão Inteligente de Produção</h1>
                                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-0.5">Relatório de Avaliação CHA de Experiência</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-xs font-bold bg-slate-100 px-3 py-1 rounded border border-slate-200 uppercase">Posto: {selectedTechEval.machineType}</span>
                                                    </div>
                                                </div>

                                                {/* Ficha do Funcionário */}
                                                <div className="grid grid-cols-2 gap-x-8 gap-y-3 bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm mb-6">
                                                    <div>
                                                        <span className="font-bold text-slate-500 text-xs block uppercase">Colaborador Avaliado</span>
                                                        <span className="font-black text-slate-800 text-base">{employee.name}</span>
                                                    </div>
                                                    <div>
                                                        <span className="font-bold text-slate-500 text-xs block uppercase">Avaliador (Gestor)</span>
                                                        <span className="font-bold text-slate-800 text-base">{selectedTechEval.evaluator}</span>
                                                    </div>
                                                    <div>
                                                        <span className="font-bold text-slate-500 text-xs block uppercase">Data de Aplicação</span>
                                                        <span className="font-semibold text-slate-800">{new Date(selectedTechEval.date).toLocaleDateString('pt-BR')}</span>
                                                    </div>
                                                    <div>
                                                        <span className="font-bold text-slate-500 text-xs block uppercase">Período de Experiência</span>
                                                        <span className="font-black text-blue-800 text-base">{selectedTechEval.monthNum}º Mês</span>
                                                    </div>
                                                </div>

                                                {/* Tabela Resumo CHA */}
                                                <div className="border border-slate-200 rounded-lg overflow-hidden mb-6 text-xs text-left">
                                                    <table className="w-full">
                                                        <thead className="bg-slate-100 uppercase font-black text-slate-700">
                                                            <tr>
                                                                <th className="p-3 border-b border-r">C - Média Conhecimento</th>
                                                                <th className="p-3 border-b border-r">H - Média Habilidade</th>
                                                                <th className="p-3 border-b border-r">A - Média Atitude</th>
                                                                <th className="p-3 border-b bg-blue-100 text-blue-900">Média Geral CHA</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="font-bold text-slate-800">
                                                            <tr>
                                                                <td className="p-3 border-r">
                                                                    {(() => {
                                                                        const scores = [selectedTechEval.q1Score, selectedTechEval.q2Score, selectedTechEval.q3Score, selectedTechEval.q4Score, selectedTechEval.q5Score];
                                                                        return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
                                                                    })()} / 10
                                                                </td>
                                                                <td className="p-3 border-r">
                                                                    {((selectedTechEval.h1Score + selectedTechEval.h2Score + selectedTechEval.h3Score + selectedTechEval.h4Score) / 4).toFixed(1)} / 10
                                                                </td>
                                                                <td className="p-3 border-r">
                                                                    {((selectedTechEval.a1Score + selectedTechEval.a2Score + selectedTechEval.a3Score + selectedTechEval.a4Score) / 4).toFixed(1)} / 10
                                                                </td>
                                                                <td className="p-3 bg-blue-50 text-blue-950 font-black text-sm">
                                                                    {selectedTechEval.totalScore.toFixed(1)} / 10
                                                                </td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </div>

                                                {/* Seção Conhecimento */}
                                                <div className="space-y-4 mb-6">
                                                    <h2 className="text-xs font-black text-slate-800 border-b pb-1 uppercase tracking-wider">1. Detalhado - Conhecimento (Perguntas)</h2>
                                                    {(selectedTechEval.machineType === 'Trefila' ? TREFILA_QUESTIONS : TRELICA_QUESTIONS).map((q, idx) => {
                                                        const answer = selectedTechEval[`${q.id}Answer` as keyof TechnicalEvaluation] || '';
                                                        const score = selectedTechEval[`${q.id}Score` as keyof TechnicalEvaluation] || 0;
                                                        return (
                                                            <div key={q.id} className="border-l-2 border-slate-400 pl-3 py-1 space-y-1 page-break-inside-avoid">
                                                                <p className="text-xs font-bold text-slate-900">{idx + 1}. {q.text}</p>
                                                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] font-medium mt-1">
                                                                    {q.options.map((opt, optIdx) => {
                                                                        const isSelected = answer === opt;
                                                                        const isCorrectOption = opt === q.correct;
                                                                        let mark = "[ ]";
                                                                        let optStyle = "text-slate-600";
                                                                        if (isSelected) {
                                                                            mark = isCorrectOption ? "[x] (✓)" : "[x] (✕)";
                                                                            optStyle = isCorrectOption ? "text-emerald-800 font-bold bg-emerald-50/50 rounded px-1" : "text-red-800 font-bold bg-red-50/50 rounded px-1";
                                                                        } else if (isCorrectOption) {
                                                                            mark = "[ ] (Correto)";
                                                                            optStyle = "text-emerald-700 border-b border-dashed border-emerald-300";
                                                                        }
                                                                        return (
                                                                            <div key={optIdx} className={optStyle}>
                                                                                {mark} {opt}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                                <p className="text-[9px] text-slate-500 font-semibold">Nota obtida nesta questão: {score} / 10</p>
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                {/* Seções Habilidade e Atitude */}
                                                <div className="grid grid-cols-2 gap-8 mb-6 text-xs">
                                                    <div>
                                                        <h2 className="font-black text-slate-800 border-b pb-1 uppercase tracking-wider mb-2">2. Detalhado - Habilidades</h2>
                                                        <div className="space-y-1.5">
                                                            <div>Setup e Ajustes: <strong>{selectedTechEval.h1Score} / 10</strong></div>
                                                            <div>Ritmo de Trabalho: <strong>{selectedTechEval.h2Score} / 10</strong></div>
                                                            <div>Controle de Qualidade: <strong>{selectedTechEval.h3Score} / 10</strong></div>
                                                            <div>Segurança Operacional: <strong>{selectedTechEval.h4Score} / 10</strong></div>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <h2 className="font-black text-slate-800 border-b pb-1 uppercase tracking-wider mb-2">3. Detalhado - Atitudes</h2>
                                                        <div className="space-y-1.5">
                                                            <div>Organização e 5S: <strong>{selectedTechEval.a1Score} / 10</strong></div>
                                                            <div>Assiduidade e Disciplina: <strong>{selectedTechEval.a2Score} / 10</strong></div>
                                                            <div>Iniciativa e Proatividade: <strong>{selectedTechEval.a3Score} / 10</strong></div>
                                                            <div>Trabalho em Equipe: <strong>{selectedTechEval.a4Score} / 10</strong></div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Observações e Parecer */}
                                                {selectedTechEval.note && (
                                                    <div className="bg-slate-50 p-4 rounded border text-xs mb-12">
                                                        <span className="font-bold text-slate-500 uppercase block">Observações e Parecer Técnico Geral</span>
                                                        <p className="text-slate-800 mt-1 italic">"{selectedTechEval.note}"</p>
                                                    </div>
                                                )}

                                                {/* Assinaturas */}
                                                <div className="grid grid-cols-2 gap-16 text-center text-xs pt-8 mt-auto border-t border-slate-200 border-dashed">
                                                    <div className="flex flex-col items-center">
                                                        <div className="w-64 border-b border-slate-400 mb-2"></div>
                                                        <span className="font-bold text-slate-600 uppercase tracking-wider">Assinatura do Avaliador</span>
                                                        <span className="text-[10px] text-slate-400 font-semibold">({selectedTechEval.evaluator})</span>
                                                    </div>
                                                    <div className="flex flex-col items-center">
                                                        <div className="w-64 border-b border-slate-400 mb-2"></div>
                                                        <span className="font-bold text-slate-600 uppercase tracking-wider">Assinatura do Colaborador</span>
                                                        <span className="text-[10px] text-slate-400 font-semibold">({employee.name})</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Caso 3: Listagem Histórica dos Testes */}
                                    {!isEvaluatingTechnical && !selectedTechEval && (
                                        <div className="space-y-4 no-print">
                                            {!readOnly && (
                                                <button
                                                    onClick={() => {
                                                        // Preencher por padrão com a máquina vinculada ao funcionário
                                                        const defaultMachine = (employee.assignedMachine && employee.assignedMachine.includes('Treliça')) ? 'Treliça' : 'Trefila';
                                                        setTechEvalMachineType(defaultMachine);
                                                        
                                                        setIsEvaluatingTechnical(true);
                                                        setTechEvalMonth(1);
                                                        setTechEvalDate(new Date().toISOString().split('T')[0]);
                                                        setTechEvalAnswers({ q1: '', q2: '', q3: '', q4: '', q5: '' });
                                                        setTechEvalScores({ q1: 0, q2: 0, q3: 0, q4: 0, q5: 0 });
                                                        setTechEvalSkills({ h1: 0, h2: 0, h3: 0, h4: 0 });
                                                        setTechEvalAttitudes({ a1: 0, a2: 0, a3: 0, a4: 0 });
                                                        setTechEvalNote('');
                                                    }}
                                                    className="w-full bg-[#0F3F5C] text-white font-bold py-3 rounded-xl hover:bg-[#0A2A3D] transition shadow-md"
                                                >
                                                    + Novo Teste de Conhecimento (CHA)
                                                </button>
                                            )}

                                            <div className="space-y-3">
                                                {technicalEvaluations.map(ev => (
                                                    <div key={ev.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center hover:bg-slate-50/50 transition">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <h5 className="font-black text-slate-800 text-sm uppercase">Teste de Conhecimento: {ev.monthNum}º Mês</h5>
                                                                <span className="text-[9px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded border">
                                                                    {ev.machineType}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-slate-500 mt-0.5">
                                                                Avaliado por <strong className="text-slate-700">{ev.evaluator}</strong> em {new Date(ev.date).toLocaleDateString()}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-4">
                                                            <div className="text-right">
                                                                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">Nota Final</span>
                                                                <span className={`text-base font-black ${ev.totalScore >= 7 ? 'text-green-600' : ev.totalScore >= 5 ? 'text-amber-500' : 'text-red-500'}`}>
                                                                    {ev.totalScore.toFixed(1)} <strong className="text-[10px] text-slate-400 font-bold">/10</strong>
                                                                </span>
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={() => setSelectedTechEval(ev)}
                                                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border text-slate-700 font-bold rounded-lg text-xs transition"
                                                                >
                                                                    📂 Visualizar
                                                                </button>
                                                                {!readOnly && (
                                                                    <button
                                                                        onClick={() => handleDeleteTechnicalEvaluation(ev.id)}
                                                                        className="p-1.5 hover:bg-red-50 text-red-500 hover:text-red-600 rounded-lg transition"
                                                                        title="Excluir Teste"
                                                                    >
                                                                        <TrashIcon className="h-5 w-5" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                                {technicalEvaluations.length === 0 && (
                                                    <p className="text-slate-400 text-center py-4">Nenhum teste de conhecimento registrado para este colaborador.</p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )})()}
                        </div>
                    )}
                    {activeTab === 'hr' && (
                        <div className="space-y-6">
                            {/* Ausências / Faltas */}
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                                <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2 flex items-center gap-2">
                                    <ExclamationIcon className="h-5 w-5 text-red-500" />
                                    Registro de Ausências e Faltas
                                </h3>
                                {!readOnly && (
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 bg-slate-50 p-4 rounded-lg">
                                        <div>
                                            <label className="text-xs font-bold text-slate-500">Tipo</label>
                                            <select className="w-full p-2 border rounded" value={newAbsence.type} onChange={e => setNewAbsence({ ...newAbsence, type: e.target.value })}>
                                                <option value="Falta Injustificada">Falta Injustificada</option>
                                                <option value="Atestado Médico">Atestado Médico</option>
                                                <option value="Licença">Licença</option>
                                                <option value="Suspensão">Suspensão</option>
                                            </select>
                                        </div>
                                        <div>
                                            <MobileFriendlyDateInput label="Data Início" value={newAbsence.startDate} onChange={v => setNewAbsence({ ...newAbsence, startDate: v })} disabled={readOnly} />
                                        </div>
                                        <div>
                                            <MobileFriendlyDateInput label="Data Fim (Opcional)" value={newAbsence.endDate} onChange={v => setNewAbsence({ ...newAbsence, endDate: v })} disabled={readOnly} />
                                        </div>
                                        <div className="flex flex-col justify-end">
                                            <button onClick={handleAddAbsence} className="bg-red-600 text-white font-bold py-2 px-4 rounded hover:bg-red-700 transition">Registrar Ausência</button>
                                        </div>
                                        <div className="md:col-span-3">
                                            <label className="text-xs font-bold text-slate-500">Motivo / Observação</label>
                                            <input type="text" className="w-full p-2 border rounded" placeholder="Ex: Dor de barriga, Atestado Dr. Fulano..." value={newAbsence.reason} onChange={e => setNewAbsence({ ...newAbsence, reason: e.target.value })} />
                                        </div>
                                        <div className="md:col-span-1">
                                            <label className="text-xs font-bold text-slate-500">Anexo (Atestado/Foto)</label>
                                            <input
                                                ref={absenceFileInputRef}
                                                type="file"
                                                accept="image/*"
                                                capture="environment"
                                                className="hidden"
                                                onChange={(e) => setAbsenceFile(e.target.files ? e.target.files[0] : null)}
                                            />
                                            <button
                                                onClick={() => absenceFileInputRef.current?.click()}
                                                className="w-full py-2 px-4 border border-dashed border-blue-300 rounded-lg text-blue-600 bg-blue-50 hover:bg-blue-100 text-xs font-bold flex items-center justify-center gap-2"
                                            >
                                                <DocumentTextIcon className="h-4 w-4" />
                                                {absenceFile ? 'Arquivo Selecionado' : 'Anexar Foto/Atestado'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-100 text-slate-600 font-bold">
                                            <tr>
                                                <th className="p-3">Tipo</th>
                                                <th className="p-3">Período</th>
                                                <th className="p-3">Motivo</th>
                                                <th className="p-3 text-center">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {absences.map(abs => (
                                                <tr key={abs.id} className="border-b hover:bg-slate-50">
                                                    <td className="p-3 font-semibold text-slate-700">{abs.type}</td>
                                                    <td className="p-3 text-slate-600">
                                                        {new Date(abs.startDate).toLocaleDateString()}
                                                        {abs.endDate ? ` até ${new Date(abs.endDate).toLocaleDateString()}` : ''}
                                                    </td>
                                                    <td className="p-3 text-slate-500 italic">
                                                        {abs.reason || '-'}
                                                        {abs.attachmentUrl && (
                                                            <a href={abs.attachmentUrl} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex items-center gap-1 text-blue-500 hover:underline text-xs">
                                                                <DownloadIcon className="h-3 w-3" /> Ver Anexo
                                                            </a>
                                                        )}
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        {!readOnly && <button onClick={() => handleDeleteAbsence(abs.id)} className="text-red-400 hover:text-red-600"><TrashIcon className="h-4 w-4" /></button>}
                                                    </td>
                                                </tr>
                                            ))}
                                            {absences.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-slate-400">Nenhum registro encontrado.</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Férias */}
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                                <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2 flex items-center gap-2">
                                    <ClockIcon className="h-5 w-5 text-blue-500" />
                                    Controle de Férias
                                </h3>
                                {!readOnly && (
                                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4 bg-blue-50/50 border border-blue-100 p-4 rounded-xl">
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase">Período Aquisitivo</label>
                                            <select className="w-full mt-1 p-2 border rounded-lg bg-white" value={newVacation.period} onChange={e => setNewVacation({ ...newVacation, period: e.target.value })}>
                                                <option value="">Selecione</option>
                                                {periodsOptions.map(p => (
                                                    <option key={p} value={p}>{p}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <MobileFriendlyDateInput label="Início do Gozo" value={newVacation.startDate} onChange={v => setNewVacation({ ...newVacation, startDate: v })} disabled={readOnly} />
                                        </div>
                                        <div>
                                            <MobileFriendlyDateInput label="Fim do Gozo" value={newVacation.endDate} onChange={v => setNewVacation({ ...newVacation, endDate: v })} disabled={readOnly} />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase">Status</label>
                                            <select className="w-full mt-1 p-2 border rounded-lg bg-white" value={newVacation.status || 'Agendada'} onChange={e => setNewVacation({ ...newVacation, status: e.target.value })}>
                                                <option value="Agendada">Agendada</option>
                                                <option value="Programada">Programada</option>
                                                <option value="Gozada">Gozada (Tirada)</option>
                                                <option value="Vendida">Vendida (Abono)</option>
                                                <option value="Cancelada">Cancelada</option>
                                            </select>
                                        </div>
                                        <div className="flex flex-col justify-end">
                                            <button onClick={handleAddVacation} className="bg-blue-600 text-white font-bold py-2.5 px-4 rounded-lg hover:bg-blue-700 transition">Registrar Férias</button>
                                        </div>
                                    </div>
                                )}
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-100 text-slate-600 font-bold">
                                            <tr>
                                                <th className="p-3">Período Aquisitivo</th>
                                                <th className="p-3">Data de Gozo</th>
                                                <th className="p-3">Duração</th>
                                                <th className="p-3">Status</th>
                                                <th className="p-3 text-center">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {vacations.map(vac => {
                                                const durationDays = getDurationDays(vac.startDate, vac.endDate);
                                                return (
                                                    <tr key={vac.id} className="border-b hover:bg-slate-50">
                                                        <td className="p-3 font-semibold text-slate-700">{vac.period}</td>
                                                        <td className="p-3 text-slate-600">
                                                            {formatDbDate(vac.startDate)} a {formatDbDate(vac.endDate)}
                                                        </td>
                                                        <td className="p-3 text-slate-600 font-medium">
                                                            {isNaN(durationDays) ? '-' : `${durationDays} ${durationDays === 1 ? 'dia' : 'dias'}`}
                                                        </td>
                                                        <td className="p-3">
                                                            <span className={`px-2 py-1 rounded text-xs font-bold border ${
                                                                vac.status === 'Gozada' 
                                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                                                    : vac.status === 'Vendida' 
                                                                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                                        : vac.status === 'Cancelada'
                                                                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                                                                            : 'bg-blue-50 text-blue-700 border-blue-200'
                                                            }`}>
                                                                {vac.status === 'Gozada' ? 'Gozada (Tirada)' : vac.status === 'Vendida' ? 'Vendida (Abono)' : vac.status}
                                                            </span>
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            {!readOnly && <button onClick={() => handleDeleteVacation(vac.id)} className="text-red-400 hover:text-red-600"><TrashIcon className="h-4 w-4" /></button>}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            {vacations.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-slate-400">Nenhuma férias registrada.</td></tr>}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Resumo de Saldos por Período */}
                                {vacations.length > 0 && (
                                    <div className="mt-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                        <h4 className="font-bold text-slate-700 text-sm mb-3 uppercase tracking-wider">Saldo por Período Aquisitivo (Base: 30 dias)</h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {Object.entries(
                                                vacations.reduce((acc, vac) => {
                                                    const p = vac.period || 'Sem Período';
                                                    if (!acc[p]) acc[p] = { gozados: 0, agendados: 0, vendidos: 0 };
                                                    const days = getDurationDays(vac.startDate, vac.endDate);
                                                    if (!isNaN(days) && vac.status !== 'Cancelada') {
                                                        if (vac.status === 'Gozada') {
                                                            acc[p].gozados += days;
                                                        } else if (vac.status === 'Vendida') {
                                                            acc[p].vendidos += days;
                                                        } else {
                                                            acc[p].agendados += days;
                                                        }
                                                    }
                                                    return acc;
                                                }, {} as Record<string, { gozados: number; agendados: number; vendidos: number }>)
                                            ).map(([period, statsVal]) => {
                                                const stats = statsVal as { gozados: number; agendados: number; vendidos: number };
                                                const totalUsed = stats.gozados + stats.agendados + stats.vendidos;
                                                const balance = 30 - totalUsed;
                                                
                                                // Cálculos de alerta de vencimento
                                                const deadline = getPeriodDeadline(employee.admissionDate, period);
                                                const now = new Date();
                                                let deadlineAlert = null;
                                                
                                                if (deadline && balance > 0) {
                                                    const diffTime = deadline.getTime() - now.getTime();
                                                    const daysToDeadline = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                                    if (diffTime < 0) {
                                                        deadlineAlert = { type: 'overdue', label: 'VENCIDAS ⚠️' };
                                                    } else if (daysToDeadline <= 90) {
                                                        deadlineAlert = { type: 'warning', label: `Vence em ${daysToDeadline} dias` };
                                                    }
                                                }

                                                return (
                                                    <div key={period} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                                                        <div>
                                                            <div className="flex justify-between items-center mb-2">
                                                                <span className="font-extrabold text-slate-700">Período {period}</span>
                                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                                                    balance <= 0 ? 'bg-green-100 text-green-700' : balance === 30 ? 'bg-slate-100 text-slate-600' : 'bg-blue-100 text-blue-700'
                                                                }`}>
                                                                    {balance <= 0 ? 'Quitado' : `${balance} dias em haver`}
                                                                </span>
                                                            </div>
                                                            {deadlineAlert && (
                                                                <div className="mb-2">
                                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                                                                        deadlineAlert.type === 'overdue' ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-amber-100 text-amber-700'
                                                                    }`}>
                                                                        {deadlineAlert.label}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            <div className="text-xs text-slate-500 space-y-1">
                                                                <div className="flex justify-between"><span>Gozados (Tirados):</span> <span className="font-semibold text-slate-700">{stats.gozados} dias</span></div>
                                                                <div className="flex justify-between"><span>Agendados:</span> <span className="font-semibold text-slate-700">{stats.agendados} dias</span></div>
                                                                <div className="flex justify-between"><span>Vendidos (Abono):</span> <span className="font-semibold text-slate-700">{stats.vendidos} dias</span></div>
                                                                <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden flex">
                                                                    <div className="bg-emerald-500 h-full" style={{ width: `${(stats.gozados / 30) * 100}%` }} title={`Gozados: ${stats.gozados} dias`}></div>
                                                                    <div className="bg-blue-500 h-full" style={{ width: `${(stats.agendados / 30) * 100}%` }} title={`Agendados: ${stats.agendados} dias`}></div>
                                                                    <div className="bg-amber-500 h-full" style={{ width: `${(stats.vendidos / 30) * 100}%` }} title={`Vendidos: ${stats.vendidos} dias`}></div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Atalhos Rápidos de Ação */}
                                                        {balance > 0 && !readOnly && (
                                                            <div className="mt-4 pt-3 border-t border-dashed border-slate-100 flex gap-2">
                                                                <button
                                                                    onClick={() => {
                                                                        setNewVacation(prev => ({
                                                                            ...prev,
                                                                            period: period,
                                                                            status: 'Agendada'
                                                                        }));
                                                                    }}
                                                                    className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-bold py-1.5 px-2 rounded-lg border border-blue-100 transition text-center"
                                                                >
                                                                    Agendar Restante
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        setNewVacation(prev => ({
                                                                            ...prev,
                                                                            period: period,
                                                                            status: 'Vendida'
                                                                        }));
                                                                    }}
                                                                    className="flex-1 bg-amber-50 hover:bg-amber-100 text-amber-700 text-[10px] font-bold py-1.5 px-2 rounded-lg border border-amber-100 transition text-center"
                                                                >
                                                                    Vender Restante
                                                                </button>
                                                                <button
                                                                    onClick={() => handleQuickSettleVacation(period, balance)}
                                                                    className="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold py-1.5 px-2 rounded-lg border border-emerald-200 transition text-center"
                                                                >
                                                                    Quitar Restante
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'tasks' && (
                        <div className="space-y-6">
                            <h3 className="text-lg font-bold text-slate-800">Pendências e Kaizens Atribuídos</h3>
                            {kaizenTasks.length === 0 ? (
                                <p className="text-slate-500">Nenhuma pendência encontrada para este funcionário.</p>
                            ) : (
                                <div className="grid grid-cols-1 gap-4">
                                    {kaizenTasks.map(task => (
                                        <div key={task.id} className="bg-white p-4 rounded-xl shadow-sm border border-l-4 border-l-orange-500 border-slate-100 flex gap-4">
                                            <div className="flex-1">
                                                <div className="flex justify-between items-start mb-2">
                                                    <h4 className="font-bold text-slate-800">{task.description}</h4>
                                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${task.status === 'Aberto' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>{task.status}</span>
                                                </div>
                                                <p className="text-sm text-slate-500 mb-2">Setor: {task.sector} | Aberto em: {new Date(task.date).toLocaleDateString('pt-BR')}</p>
                                                <div className="bg-yellow-50 p-3 rounded-lg text-sm text-yellow-800 border border-yellow-200">
                                                    <strong>Ação Necessária:</strong> Este problema foi atribuído a você. Por favor, acesse o módulo de Melhoria Contínua para registrar as ações tomadas ou resolver o problema.
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div >
    );
};

export default EmployeeDetailModal;
