import React, { useState, useMemo } from 'react';
import type { Partner, MachineConfig, ArmadoTeam, ArmadoEmployee, MachineCapabilities } from '../types';
import { uploadFile } from '../services/supabaseService';

interface PartnerConfigProps {
    partners: Partner[];
    onAdd: (partner: Omit<Partner, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Partner>;
    onUpdate: (id: string, updates: Partial<Partner>) => Promise<Partner>;
    onDelete: (id: string) => Promise<void>;
    showNotification: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
    currentUser?: any;
}

// Inline SVGs for reliability
const PlusIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
);

const TrashIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
);

const PencilIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
    </svg>
);

const CheckIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
);

const CloseIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);

const StarIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className={className}>
        <path d="M12 .587l3.668 7.431 8.2 1.192-5.934 5.787 1.4 8.168L12 18.896l-7.334 3.857 1.4-8.168L.132 9.21l8.2-1.192L12 .587z" />
    </svg>
);

const PartnerConfig: React.FC<PartnerConfigProps> = ({
    partners,
    onAdd,
    onUpdate,
    onDelete,
    showNotification,
    currentUser
}) => {
    const [viewMode, setViewMode] = useState<'list' | 'form'>('list');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Form inputs state
    const [companyName, setCompanyName] = useState('');
    const [cnpj, setCnpj] = useState('');
    const [nomeFantasia, setNomeFantasia] = useState('');
    const [razaoSocial, setRazaoSocial] = useState('');
    const [endereco, setEndereco] = useState('');
    const [telefone, setTelefone] = useState('');
    const [email, setEmail] = useState('');
    const [logoUrl, setLogoUrl] = useState('');
    const [materialQty, setMaterialQty] = useState('');
    const [servicesProvided, setServicesProvided] = useState('');
    const [startDate, setStartDate] = useState('');
    const [isActiveBranding, setIsActiveBranding] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    // Machine configuration state
    const [machinesList, setMachinesList] = useState<MachineConfig[]>([]);
    const [showMachineForm, setShowMachineForm] = useState(false);
    const [editingMachineIdx, setEditingMachineIdx] = useState<number | null>(null);
    const [machineName, setMachineName] = useState('');
    const [machineImageUrl, setMachineImageUrl] = useState('');
    const [machineCapacity, setMachineCapacity] = useState('');
    const [machineGauge, setMachineGauge] = useState('');
    const [machineSpeed, setMachineSpeed] = useState('');
    const [machineMaxStraight, setMachineMaxStraight] = useState('');
    const [machineMaxBars, setMachineMaxBars] = useState('');
    const [machineShiftType, setMachineShiftType] = useState<'1turno' | '2turnos' | 'continuo'>('1turno');
    const [machineShift1Start, setMachineShift1Start] = useState('');
    const [machineShift1End, setMachineShift1End] = useState('');
    const [machineShift2Start, setMachineShift2Start] = useState('');
    const [machineShift2End, setMachineShift2End] = useState('');
    const [machineHasLunch, setMachineHasLunch] = useState(false);
    const [machineLunchStart, setMachineLunchStart] = useState('');
    const [machineLunchEnd, setMachineLunchEnd] = useState('');
    const [machineShift1Staff, setMachineShift1Staff] = useState<{ function: string; quantity: number }[]>([]);
    const [machineShift2Staff, setMachineShift2Staff] = useState<{ function: string; quantity: number }[]>([]);
    const [machineCapabilities, setMachineCapabilities] = useState<MachineCapabilities>({
        estribo: { enabled: false },
        reto: { enabled: false },
        corteDobra: { enabled: false }
    });
    const [newStaffFunction, setNewStaffFunction] = useState('');
    const [newStaffQuantity, setNewStaffQuantity] = useState('');
    const [staffForShift, setStaffForShift] = useState<1 | 2>(1);

    // Armado section state
    const [armadoTeams, setArmadoTeams] = useState<ArmadoTeam[]>([]);
    const [armadoDailyKg, setArmadoDailyKg] = useState('');
    const [armadoDailyMeters, setArmadoDailyMeters] = useState('');
    const [showArmadoTeamForm, setShowArmadoTeamForm] = useState(false);
    const [editingArmadoTeamIdx, setEditingArmadoTeamIdx] = useState<number | null>(null);
    const [armadoTeamName, setArmadoTeamName] = useState('');
    const [armadoEmployees, setArmadoEmployees] = useState<ArmadoEmployee[]>([]);
    const [armadoEmployeeName, setArmadoEmployeeName] = useState('');
    const [armadoEmployeeFunction, setArmadoEmployeeFunction] = useState('');

    // PCP section state
    const [pcpEmployees, setPcpEmployees] = useState<ArmadoEmployee[]>([]);
    const [pcpEmployeeName, setPcpEmployeeName] = useState('');
    const [pcpEmployeeFunction, setPcpEmployeeFunction] = useState('');

    const isGestor = currentUser?.role === 'admin' || currentUser?.role === 'gestor' || currentUser?.username === 'admin';

    // Handle image file upload using standard bucket 'kb-files'
    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploading(true);
        try {
            const path = `partner-logos/${Date.now()}-${file.name}`;
            const url = await uploadFile('kb-files', path, file);
            if (url) {
                setLogoUrl(url);
                showNotification('Logotipo carregado com sucesso!', 'success');
            }
        } catch (err) {
            console.error('Error uploading logo:', err);
            showNotification('Erro ao carregar logotipo.', 'error');
        } finally {
            setIsUploading(false);
        }
    };

    const resetMachineForm = () => {
        setShowMachineForm(false);
        setEditingMachineIdx(null);
        setMachineName('');
        setMachineImageUrl('');
        setMachineCapacity('');
        setMachineGauge('');
        setMachineSpeed('');
        setMachineMaxStraight('');
        setMachineMaxBars('');
        setMachineShiftType('1turno');
        setMachineShift1Start('');
        setMachineShift1End('');
        setMachineShift2Start('');
        setMachineShift2End('');
        setMachineHasLunch(false);
        setMachineLunchStart('');
        setMachineLunchEnd('');
        setMachineShift1Staff([]);
        setMachineShift2Staff([]);
        setMachineCapabilities({
            estribo: { enabled: false },
            reto: { enabled: false },
            corteDobra: { enabled: false }
        });
        setNewStaffFunction('');
        setNewStaffQuantity('');
    };

    const resetArmadoTeamForm = () => {
        setShowArmadoTeamForm(false);
        setEditingArmadoTeamIdx(null);
        setArmadoTeamName('');
        setArmadoEmployees([]);
        setArmadoEmployeeName('');
        setArmadoEmployeeFunction('');
    };

    const handleReset = () => {
        setEditingId(null);
        setCompanyName('');
        setCnpj('');
        setNomeFantasia('');
        setRazaoSocial('');
        setEndereco('');
        setTelefone('');
        setEmail('');
        setLogoUrl('');
        setMaterialQty('');
        setServicesProvided('');
        setStartDate('');
        setIsActiveBranding(false);
        setMachinesList([]);
        setArmadoTeams([]);
        setArmadoDailyKg('');
        setArmadoDailyMeters('');
        setPcpEmployees([]);
        setPcpEmployeeName('');
        setPcpEmployeeFunction('');
        resetMachineForm();
        resetArmadoTeamForm();
    };

    const handleMachineImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploading(true);
        try {
            const path = `machine-images/${Date.now()}-${file.name}`;
            const url = await uploadFile('kb-files', path, file);
            if (url) {
                setMachineImageUrl(url);
                showNotification('Imagem da máquina carregada com sucesso!', 'success');
            }
        } catch (err) {
            console.error('Error uploading machine image:', err);
            showNotification('Erro ao carregar imagem da máquina.', 'error');
        } finally {
            setIsUploading(false);
        }
    };

    const handleSaveMachine = () => {
        if (!machineName.trim()) {
            showNotification('Nome da máquina é obrigatório.', 'error');
            return;
        }
        if (!machineCapacity || parseFloat(machineCapacity) <= 0) {
            showNotification('Capacidade produtiva deve ser maior que zero.', 'error');
            return;
        }

        const machine: MachineConfig = {
            name: machineName.trim(),
            imageUrl: machineImageUrl.trim() || undefined,
            capacityKgPerHour: parseFloat(machineCapacity),
            gaugeRange: machineGauge.trim(),
            speedMetersPerSecond: machineSpeed ? parseFloat(machineSpeed) : undefined,
            maxStraightMeters: machineMaxStraight ? parseFloat(machineMaxStraight) : undefined,
            maxBarsAtOnce: machineMaxBars ? parseInt(machineMaxBars, 10) : undefined,
            shiftType: machineShiftType,
            shift1Start: machineShiftType !== 'continuo' ? machineShift1Start : undefined,
            shift1End: machineShiftType !== 'continuo' ? machineShift1End : undefined,
            shift2Start: machineShiftType === '2turnos' ? machineShift2Start : undefined,
            shift2End: machineShiftType === '2turnos' ? machineShift2End : undefined,
            hasLunchBreak: machineShiftType !== 'continuo' ? machineHasLunch : undefined,
            lunchStart: machineShiftType !== 'continuo' && machineHasLunch ? machineLunchStart : undefined,
            lunchEnd: machineShiftType !== 'continuo' && machineHasLunch ? machineLunchEnd : undefined,
            shift1Staff: machineShiftType !== 'continuo' && machineShift1Staff.length > 0 ? machineShift1Staff : undefined,
            shift2Staff: machineShiftType === '2turnos' && machineShift2Staff.length > 0 ? machineShift2Staff : undefined,
            capabilities: machineCapabilities,
        };

        if (editingMachineIdx !== null) {
            const updated = [...machinesList];
            updated[editingMachineIdx] = machine;
            setMachinesList(updated);
        } else {
            setMachinesList([...machinesList, machine]);
        }

        resetMachineForm();
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!companyName.trim()) {
            showNotification('O nome da empresa é obrigatório.', 'error');
            return;
        }

        setIsSaving(true);
        try {
            const partnerData = {
                companyName: companyName.trim(),
                cnpj: cnpj.trim() || undefined,
                nomeFantasia: nomeFantasia.trim() || undefined,
                razaoSocial: razaoSocial.trim() || undefined,
                endereco: endereco.trim() || undefined,
                telefone: telefone.trim() || undefined,
                email: email.trim() || undefined,
                logoUrl: logoUrl.trim() || undefined,
                materialQty: materialQty.trim() || undefined,
                servicesProvided: servicesProvided.trim() || undefined,
                startDate: startDate || undefined,
                isActiveBranding,
                machines: machinesList.length > 0 ? machinesList : undefined,
                armadoTeams: armadoTeams.length > 0 ? armadoTeams : undefined,
                armadoDailyKg: armadoDailyKg ? parseFloat(armadoDailyKg) : undefined,
                armadoDailyMeters: armadoDailyMeters ? parseFloat(armadoDailyMeters) : undefined,
                pcpEmployees: pcpEmployees.length > 0 ? pcpEmployees : undefined,
            };

            // If we are setting this partner as the active branding, we first turn off the branding of all others.
            if (isActiveBranding) {
                const currentlyBranded = partners.filter(p => p.id !== editingId && p.isActiveBranding);
                for (const p of currentlyBranded) {
                    await onUpdate(p.id, { isActiveBranding: false });
                }
            }

            if (editingId) {
                await onUpdate(editingId, partnerData);
                showNotification('Parceiro atualizado com sucesso!', 'success');
            } else {
                await onAdd(partnerData);
                showNotification('Parceiro cadastrado com sucesso!', 'success');
            }

            handleReset();
            setViewMode('list');
        } catch (err: any) {
            console.error('Error saving partner:', err);
            showNotification(`Erro ao salvar parceiro: ${err?.message || 'erro desconhecido'}`, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleStartEdit = (partner: Partner) => {
        setEditingId(partner.id);
        setCompanyName(partner.companyName);
        setCnpj(partner.cnpj || '');
        setNomeFantasia(partner.nomeFantasia || '');
        setRazaoSocial(partner.razaoSocial || '');
        setEndereco(partner.endereco || '');
        setTelefone(partner.telefone || '');
        setEmail(partner.email || '');
        setLogoUrl(partner.logoUrl || '');
        setMaterialQty(partner.materialQty || '');
        setServicesProvided(partner.servicesProvided || '');
        setStartDate(partner.startDate || '');
        setIsActiveBranding(!!partner.isActiveBranding);
        setMachinesList(partner.machines || []);
        setArmadoTeams(partner.armadoTeams || []);
        setArmadoDailyKg(partner.armadoDailyKg ? String(partner.armadoDailyKg) : '');
        setArmadoDailyMeters(partner.armadoDailyMeters ? String(partner.armadoDailyMeters) : '');
        setPcpEmployees(partner.pcpEmployees || []);
        setViewMode('form');
    };

    const handleDelete = async (id: string) => {
        const partner = partners.find(p => p.id === id);
        if (!partner) return;
        if (!confirm(`Deseja realmente excluir o parceiro "${partner.companyName}"?`)) {
            return;
        }
        try {
            await onDelete(id);
            showNotification('Parceiro excluído com sucesso!', 'success');
        } catch (err) {
            console.error('Error deleting partner:', err);
            showNotification('Erro ao excluir parceiro.', 'error');
        }
    };

    // Filtered partners based on search input
    const filteredPartners = useMemo(() => {
        return partners.filter(p => {
            const searchLower = searchTerm.toLowerCase();
            return (
                p.companyName.toLowerCase().includes(searchLower) ||
                (p.cnpj || '').toLowerCase().includes(searchLower) ||
                (p.nomeFantasia || '').toLowerCase().includes(searchLower) ||
                (p.razaoSocial || '').toLowerCase().includes(searchLower) ||
                (p.endereco || '').toLowerCase().includes(searchLower) ||
                (p.telefone || '').toLowerCase().includes(searchLower) ||
                (p.email || '').toLowerCase().includes(searchLower) ||
                (p.servicesProvided || '').toLowerCase().includes(searchLower) ||
                (p.materialQty || '').toLowerCase().includes(searchLower)
            );
        });
    }, [partners, searchTerm]);

    return (
        <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8 animate-fadeIn">
            <div className="max-w-6xl mx-auto space-y-6">
                
                {/* Header */}
                <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight font-sans">
                            Configuração de Parceiros
                        </h1>
                        <p className="text-slate-500 text-sm mt-1">
                            Gerencie empresas parceiras, configure white-label e controle logotipo e metadados.
                        </p>
                    </div>
                    {isGestor && viewMode === 'list' && partners.length === 0 && (
                        <button
                            onClick={() => {
                                handleReset();
                                setViewMode('form');
                            }}
                            className="bg-[#0F3F5C] hover:bg-[#0A2A3D] text-white font-bold py-2.5 px-6 rounded-xl shadow-md transition-all flex items-center gap-2 self-start sm:self-auto"
                        >
                            <PlusIcon className="h-5 w-5" /> Novo Parceiro
                        </button>
                    )}
                </header>

                {/* Form view */}
                {viewMode === 'form' ? (
                    <form onSubmit={handleSave} className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-slide-up">
                        <div className="p-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                            <h2 className="text-lg font-bold text-[#0F3F5C] flex items-center gap-2">
                                {editingId ? <PencilIcon className="h-5 w-5 text-blue-600" /> : <PlusIcon className="h-5 w-5 text-blue-600" />}
                                {editingId ? 'Editar Parceiro' : 'Adicionar Novo Parceiro'}
                            </h2>
                            <button
                                type="button"
                                onClick={() => {
                                    handleReset();
                                    setViewMode('list');
                                }}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <CloseIcon className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
                            
                            {/* Company logo upload column */}
                            <div className="md:col-span-4 flex flex-col items-center">
                                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-3 self-start">
                                    Logotipo do Cliente
                                </label>
                                <div className="w-48 h-48 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center overflow-hidden relative group shadow-inner">
                                    {logoUrl ? (
                                        <>
                                            <img src={logoUrl} className="w-full h-full object-contain p-2" alt="Logo Cliente" />
                                            {isGestor && (
                                                <button
                                                    type="button"
                                                    onClick={() => setLogoUrl('')}
                                                    className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-xs uppercase gap-2"
                                                >
                                                    <TrashIcon className="h-4 w-4" /> Remover
                                                </button>
                                            )}
                                        </>
                                    ) : (
                                        <div className="text-center p-4">
                                            <span className="text-3xl block mb-2">🏢</span>
                                            <span className="text-xs font-bold text-slate-400">Nenhum logo carregado</span>
                                        </div>
                                    )}
                                </div>
                                {isGestor && (
                                    <div className="mt-4 w-full max-w-[200px]">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleLogoUpload}
                                            id="partner-logo-upload"
                                            className="hidden"
                                            disabled={isUploading}
                                        />
                                        <label
                                            htmlFor="partner-logo-upload"
                                            className={`block text-center text-xs font-black py-2.5 px-4 rounded-xl border cursor-pointer transition shadow-sm ${
                                                isUploading
                                                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
                                            }`}
                                        >
                                            {isUploading ? 'Enviando...' : 'Carregar Logo'}
                                        </label>
                                    </div>
                                )}
                            </div>

                            {/* Form fields column */}
                            <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-5">
                                
                                <div className="sm:col-span-2">
                                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5">
                                        Nome da Empresa / Cliente *
                                    </label>
                                    <input
                                        type="text"
                                        value={companyName}
                                        onChange={e => setCompanyName(e.target.value)}
                                        placeholder="Ex: Armaço Ferragem Armada Ltda"
                                        required
                                        className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-semibold"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5">
                                        CNPJ
                                    </label>
                                    <input
                                        type="text"
                                        value={cnpj}
                                        onChange={e => setCnpj(e.target.value)}
                                        placeholder="Ex: 00.000.000/0001-00"
                                        className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-semibold"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5">
                                        Nome Fantasia
                                    </label>
                                    <input
                                        type="text"
                                        value={nomeFantasia}
                                        onChange={e => setNomeFantasia(e.target.value)}
                                        placeholder="Ex: Armaço Ferragens"
                                        className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-semibold"
                                    />
                                </div>

                                <div className="sm:col-span-2">
                                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5">
                                        Razão Social
                                    </label>
                                    <input
                                        type="text"
                                        value={razaoSocial}
                                        onChange={e => setRazaoSocial(e.target.value)}
                                        placeholder="Ex: Armaço Ferragem Armada Ltda"
                                        className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-semibold"
                                    />
                                </div>

                                <div className="sm:col-span-2">
                                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5">
                                        Endereço
                                    </label>
                                    <input
                                        type="text"
                                        value={endereco}
                                        onChange={e => setEndereco(e.target.value)}
                                        placeholder="Ex: Rua Exemplo, 123 - Bairro, Cidade - UF"
                                        className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-semibold"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5">
                                        Telefone
                                    </label>
                                    <input
                                        type="text"
                                        value={telefone}
                                        onChange={e => setTelefone(e.target.value)}
                                        placeholder="Ex: (11) 99999-9999"
                                        className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-semibold"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5">
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        placeholder="Ex: contato@armaco.com.br"
                                        className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-semibold"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5">
                                        Quantidade de Materiais
                                    </label>
                                    <input
                                        type="text"
                                        value={materialQty}
                                        onChange={e => setMaterialQty(e.target.value)}
                                        placeholder="Ex: 50.000 kg/mês"
                                        className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-semibold"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5">
                                        Data de Início
                                    </label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={e => setStartDate(e.target.value)}
                                        className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-semibold"
                                    />
                                </div>

                                <div className="sm:col-span-2">
                                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5">
                                        Serviços Prestados / Detalhes
                                    </label>
                                    <textarea
                                        value={servicesProvided}
                                        onChange={e => setServicesProvided(e.target.value)}
                                        placeholder="Descreva os serviços prestados, termos do contrato ou detalhes da parceria..."
                                        rows={3}
                                        className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-semibold"
                                    />
                                </div>

                                {/* Active Branding Toggle */}
                                <div className="sm:col-span-2 bg-blue-50/50 border border-blue-100 rounded-2xl p-4 flex items-center justify-between gap-4 mt-2">
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                            <span>🎨 Usar como Logotipo do Sistema</span>
                                            {isActiveBranding && <StarIcon className="h-3.5 w-3.5 text-yellow-500" />}
                                        </span>
                                        <span className="text-[10px] text-slate-500">
                                            Se ativado, este parceiro será exibido como a marca e logo principal no topo do menu lateral.
                                        </span>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                        <input
                                            type="checkbox"
                                            checked={isActiveBranding}
                                            onChange={e => setIsActiveBranding(e.target.checked)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00E5FF]"></div>
                                    </label>
                                </div>

                            </div>
                        </div>

                        {/* MACHINE CONFIGURATION SECTION */}
                        <div className="border-t border-slate-200">
                            <div className="p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Máquinas da Produção</h3>
                                        <p className="text-[10px] text-slate-500 mt-0.5">Configure as máquinas, capacidades, bitolas e turnos</p>
                                    </div>
                                    {!showMachineForm && (
                                        <button
                                            type="button"
                                            onClick={() => { resetMachineForm(); setShowMachineForm(true); }}
                                            className="text-xs font-black py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition-all"
                                        >
                                            + Adicionar Máquina
                                        </button>
                                    )}
                                </div>

                                {/* Machine list */}
                                {machinesList.length > 0 && (
                                    <div className="space-y-2 mb-4">
                                        {machinesList.map((m, idx) => (
                                            <div key={idx} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                                                <div className="flex-1 grid grid-cols-6 gap-2 text-xs">
                                                    <div>
                                                        <span className="text-slate-400 font-bold block">Máquina</span>
                                                        <span className="font-black text-slate-800">{m.name}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-400 font-bold block">Capacidade</span>
                                                        <span className="font-semibold">{m.capacityKgPerHour} kg/h</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-400 font-bold block">Bitola</span>
                                                        <span className="font-semibold">{m.gaugeRange || '-'}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-400 font-bold block">Turno</span>
                                                        <span className="font-semibold">
                                                            {m.shiftType === 'continuo' ? 'Contínuo' : `${m.shiftType === '2turnos' ? '2 Turnos' : '1 Turno'} ${m.shift1Start || ''}-${m.shift1End || ''}${m.hasLunchBreak ? ' (c/ almoço)' : ''}`}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-400 font-bold block">Funcionários</span>
                                                        <span className="font-semibold">
                                                            {(() => {
                                                                const s1 = m.shift1Staff?.reduce((a, b) => a + b.quantity, 0) || 0;
                                                                const s2 = m.shift2Staff?.reduce((a, b) => a + b.quantity, 0) || 0;
                                                                const total = s1 + s2;
                                                                return total > 0 ? `${total} func.` : '-';
                                                            })()}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setEditingMachineIdx(idx);
                                                                setMachineName(m.name);
                                                                setMachineImageUrl(m.imageUrl || '');
                                                                setMachineCapacity(String(m.capacityKgPerHour));
                                                                setMachineGauge(m.gaugeRange);
                                                                setMachineSpeed(m.speedMetersPerSecond ? String(m.speedMetersPerSecond) : '');
                                                                setMachineMaxStraight(m.maxStraightMeters ? String(m.maxStraightMeters) : '');
                                                                setMachineMaxBars(m.maxBarsAtOnce ? String(m.maxBarsAtOnce) : '');
                                                                setMachineShiftType(m.shiftType);
                                                                setMachineShift1Start(m.shift1Start || '');
                                                                setMachineShift1End(m.shift1End || '');
                                                                setMachineShift2Start(m.shift2Start || '');
                                                                setMachineShift2End(m.shift2End || '');
                                                                setMachineHasLunch(!!m.hasLunchBreak);
                                                                setMachineLunchStart(m.lunchStart || '');
                                                                setMachineLunchEnd(m.lunchEnd || '');
                                                                setMachineShift1Staff(m.shift1Staff || []);
                                                                setMachineShift2Staff(m.shift2Staff || []);
                                                                setMachineCapabilities(m.capabilities || { estribo: { enabled: false }, reto: { enabled: false }, corteDobra: { enabled: false } });
                                                                setShowMachineForm(true);
                                                            }}
                                                            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg transition-colors text-xs border border-blue-200"
                                                            title="Editar Máquina"
                                                        >
                                                            <PencilIcon className="h-3.5 w-3.5 inline mr-1" /> Editar
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                if (confirm(`Excluir máquina "${m.name}"?`)) {
                                                                    setMachinesList(machinesList.filter((_, i) => i !== idx));
                                                                }
                                                            }}
                                                            className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-colors"
                                                            title="Excluir Máquina"
                                                        >
                                                            <TrashIcon className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Machine sub-form */}
                                {showMachineForm && (
                                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                                        <h4 className="text-xs font-black text-slate-600 uppercase tracking-wider">
                                            {editingMachineIdx !== null ? 'Editar Máquina' : 'Nova Máquina'}
                                        </h4>
                                        
                                        {/* Machine Image Upload */}
                                        <div className="flex items-center gap-4 mb-4">
                                            <div className="w-20 h-20 bg-slate-100 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden flex-shrink-0 relative">
                                                {machineImageUrl ? (
                                                    <img src={machineImageUrl} alt="Máquina" className="w-full h-full object-cover" />
                                                ) : (
                                                    <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Foto da Máquina (Opcional)</label>
                                                <div className="flex items-center gap-2">
                                                    <label className={`cursor-pointer inline-flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 transition-colors ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                                        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                                        {isUploading ? 'Enviando...' : 'Escolher Imagem'}
                                                        <input type="file" className="hidden" accept="image/*" onChange={handleMachineImageUpload} disabled={isUploading} />
                                                    </label>
                                                    {machineImageUrl && (
                                                        <button type="button" onClick={() => setMachineImageUrl('')} className="text-xs text-red-500 hover:text-red-700 font-bold transition-colors">Remover</button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Nome da Máquina *</label>
                                                <input type="text" value={machineName} onChange={e => setMachineName(e.target.value)}
                                                    placeholder="Ex: Trefila 01" className="w-full p-2.5 border border-slate-300 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Capacidade (kg/h) *</label>
                                                <input type="number" step="0.01" min="0" value={machineCapacity} onChange={e => setMachineCapacity(e.target.value)}
                                                    placeholder="Ex: 500" className="w-full p-2.5 border border-slate-300 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Bitola (ex: 10mm-12,5mm)</label>
                                                <input type="text" value={machineGauge} onChange={e => setMachineGauge(e.target.value)}
                                                    placeholder="Ex: 10mm-12,5mm" className="w-full p-2.5 border border-slate-300 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500" />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Velocidade (Metros/Seg)</label>
                                                <input type="number" step="0.1" min="0" value={machineSpeed} onChange={e => setMachineSpeed(e.target.value)}
                                                    placeholder="Ex: 2.5" className="w-full p-2.5 border border-slate-300 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Até Quantos Metros Reto</label>
                                                <input type="number" step="0.1" min="0" value={machineMaxStraight} onChange={e => setMachineMaxStraight(e.target.value)}
                                                    placeholder="Ex: 12" className="w-full p-2.5 border border-slate-300 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Trabalha com Quantos Ferros</label>
                                                <input type="number" min="1" value={machineMaxBars} onChange={e => setMachineMaxBars(e.target.value)}
                                                    placeholder="Ex: 2" className="w-full p-2.5 border border-slate-300 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500" />
                                            </div>
                                        </div>

                                        {/* Regras de Produção Avançadas */}
                                        <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 mt-4">
                                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4">Avançado: Regras de Produção</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                {/* Estribos */}
                                                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                                                    <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-2">
                                                        <input type="checkbox" checked={machineCapabilities.estribo?.enabled} 
                                                            onChange={e => setMachineCapabilities({ ...machineCapabilities, estribo: { ...machineCapabilities.estribo, enabled: e.target.checked } })} />
                                                        <span className="font-bold text-sm text-slate-700 uppercase">Estribos</span>
                                                    </div>
                                                    {machineCapabilities.estribo?.enabled && (
                                                        <div className="space-y-3">
                                                            <div className="grid grid-cols-3 gap-2">
                                                                <div>
                                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Peças/Hora</label>
                                                                    <input type="number" className="w-full p-1.5 border rounded text-xs" placeholder="Ex: 1000"
                                                                        value={machineCapabilities.estribo?.benchmarkPiecesPerHour || ''} 
                                                                        onChange={e => {
                                                                            const val = e.target.value ? Number(e.target.value) : undefined;
                                                                            const wires = machineCapabilities.estribo?.benchmarkWires || 1;
                                                                            const linear = machineCapabilities.estribo?.benchmarkLinearCm || 0;
                                                                            const mph = val && linear ? (val * linear / 100) * wires : undefined;
                                                                            setMachineCapabilities({ ...machineCapabilities, estribo: { ...machineCapabilities.estribo, benchmarkPiecesPerHour: val, calculatedMetersPerHour: mph } });
                                                                        }} />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Nº Fios</label>
                                                                    <input type="number" min="1" className="w-full p-1.5 border rounded text-xs" placeholder="Ex: 1"
                                                                        value={machineCapabilities.estribo?.benchmarkWires || ''} 
                                                                        onChange={e => {
                                                                            const val = e.target.value ? Number(e.target.value) : undefined;
                                                                            const pcs = machineCapabilities.estribo?.benchmarkPiecesPerHour || 0;
                                                                            const linear = machineCapabilities.estribo?.benchmarkLinearCm || 0;
                                                                            const mph = pcs && linear && val ? (pcs * linear / 100) * val : undefined;
                                                                            setMachineCapabilities({ ...machineCapabilities, estribo: { ...machineCapabilities.estribo, benchmarkWires: val, calculatedMetersPerHour: mph } });
                                                                        }} />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Base (cm)</label>
                                                                    <input type="number" className="w-full p-1.5 border rounded text-xs" placeholder="Ex: 58"
                                                                        value={machineCapabilities.estribo?.benchmarkLinearCm || ''} 
                                                                        onChange={e => {
                                                                            const val = e.target.value ? Number(e.target.value) : undefined;
                                                                            const pcs = machineCapabilities.estribo?.benchmarkPiecesPerHour || 0;
                                                                            const wires = machineCapabilities.estribo?.benchmarkWires || 1;
                                                                            const mph = pcs && val ? (pcs * val / 100) * wires : undefined;
                                                                            setMachineCapabilities({ ...machineCapabilities, estribo: { ...machineCapabilities.estribo, benchmarkLinearCm: val, calculatedMetersPerHour: mph } });
                                                                        }} />
                                                                </div>
                                                            </div>
                                                            {machineCapabilities.estribo?.calculatedMetersPerHour && (
                                                                <div className="bg-blue-50 border border-blue-100 rounded-md p-2 flex items-center justify-between text-xs">
                                                                    <span className="text-blue-600 font-bold uppercase tracking-wider text-[10px]">Veloc. Calc:</span>
                                                                    <span className="text-blue-800 font-black text-right">
                                                                        {Math.round(machineCapabilities.estribo.calculatedMetersPerHour)} m/h <br/>
                                                                        <span className="text-[10px] text-blue-600/80">~{((machineCapabilities.estribo.calculatedMetersPerHour * 100) / 3600).toFixed(1)} cm/s</span>
                                                                    </span>
                                                                </div>
                                                            )}
                                                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                                                                <div>
                                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase">A Máx (cm)</label>
                                                                    <input type="number" className="w-full p-1.5 border rounded text-xs" value={machineCapabilities.estribo?.maxSideA_cm || ''} onChange={e => setMachineCapabilities({ ...machineCapabilities, estribo: { ...machineCapabilities.estribo, maxSideA_cm: e.target.value ? Number(e.target.value) : undefined } })} />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase">B Máx (cm)</label>
                                                                    <input type="number" className="w-full p-1.5 border rounded text-xs" value={machineCapabilities.estribo?.maxSideB_cm || ''} onChange={e => setMachineCapabilities({ ...machineCapabilities, estribo: { ...machineCapabilities.estribo, maxSideB_cm: e.target.value ? Number(e.target.value) : undefined } })} />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Retos */}
                                                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                                                    <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-2">
                                                        <input type="checkbox" checked={machineCapabilities.reto?.enabled} 
                                                            onChange={e => setMachineCapabilities({ ...machineCapabilities, reto: { ...machineCapabilities.reto, enabled: e.target.checked } })} />
                                                        <span className="font-bold text-sm text-slate-700 uppercase">Retos</span>
                                                    </div>
                                                    {machineCapabilities.reto?.enabled && (
                                                        <div className="space-y-2">
                                                            <div>
                                                                <label className="block text-[10px] font-bold text-slate-500 uppercase">Capacidade Específica (kg/h)</label>
                                                                <input type="number" className="w-full p-1.5 border rounded text-xs" placeholder="Ex: 800"
                                                                    value={machineCapabilities.reto?.capacityKgPerHour || ''} onChange={e => setMachineCapabilities({ ...machineCapabilities, reto: { ...machineCapabilities.reto, capacityKgPerHour: e.target.value ? Number(e.target.value) : undefined } })} />
                                                            </div>
                                                            <div>
                                                                <label className="block text-[10px] font-bold text-slate-500 uppercase">Comp. Máx (m)</label>
                                                                <input type="number" className="w-full p-1.5 border rounded text-xs" value={machineCapabilities.reto?.maxLength_m || ''} onChange={e => setMachineCapabilities({ ...machineCapabilities, reto: { ...machineCapabilities.reto, maxLength_m: e.target.value ? Number(e.target.value) : undefined } })} />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Dobras */}
                                                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                                                    <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-2">
                                                        <input type="checkbox" checked={machineCapabilities.corteDobra?.enabled} 
                                                            onChange={e => setMachineCapabilities({ ...machineCapabilities, corteDobra: { ...machineCapabilities.corteDobra, enabled: e.target.checked } })} />
                                                        <span className="font-bold text-sm text-slate-700 uppercase">Corte e Dobra</span>
                                                    </div>
                                                    {machineCapabilities.corteDobra?.enabled && (
                                                        <div className="space-y-2">
                                                            <div>
                                                                <label className="block text-[10px] font-bold text-slate-500 uppercase">Capacidade Específica (kg/h)</label>
                                                                <input type="number" className="w-full p-1.5 border rounded text-xs" placeholder="Ex: 500"
                                                                    value={machineCapabilities.corteDobra?.capacityKgPerHour || ''} onChange={e => setMachineCapabilities({ ...machineCapabilities, corteDobra: { ...machineCapabilities.corteDobra, capacityKgPerHour: e.target.value ? Number(e.target.value) : undefined } })} />
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <div>
                                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Máx Dobras</label>
                                                                    <input type="number" className="w-full p-1.5 border rounded text-xs" placeholder="Ex: 2" value={machineCapabilities.corteDobra?.maxBends || ''} onChange={e => setMachineCapabilities({ ...machineCapabilities, corteDobra: { ...machineCapabilities.corteDobra, maxBends: e.target.value ? Number(e.target.value) : undefined } })} />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Soma (cm)</label>
                                                                    <input type="number" className="w-full p-1.5 border rounded text-xs" placeholder="A+B+C" value={machineCapabilities.corteDobra?.maxSumSides_cm || ''} onChange={e => setMachineCapabilities({ ...machineCapabilities, corteDobra: { ...machineCapabilities.corteDobra, maxSumSides_cm: e.target.value ? Number(e.target.value) : undefined } })} />
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <label className="block text-[10px] font-bold text-slate-500 uppercase">Máx. Base c/ Múltiplas Dobras (cm)</label>
                                                                <input type="number" className="w-full p-1.5 border rounded text-xs" placeholder="Ex: 200" value={machineCapabilities.corteDobra?.maxBaseForMultipleBends_cm || ''} onChange={e => setMachineCapabilities({ ...machineCapabilities, corteDobra: { ...machineCapabilities.corteDobra, maxBaseForMultipleBends_cm: e.target.value ? Number(e.target.value) : undefined } })} />
                                                                <p className="text-[9px] text-slate-400 mt-0.5 leading-tight">Se a base (Lado A) for maior que isso num desenho com 2 ou mais dobras, ela será incompatível.</p>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Tipo de Turno</label>
                                            <div className="flex gap-2">
                                                {(['1turno', '2turnos', 'continuo'] as const).map(t => (
                                                    <button
                                                        key={t}
                                                        type="button"
                                                        onClick={() => setMachineShiftType(t)}
                                                        className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                                                            machineShiftType === t
                                                                ? 'bg-blue-600 text-white shadow'
                                                                : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'
                                                        }`}
                                                    >
                                                        {t === '1turno' ? '1 Turno' : t === '2turnos' ? '2 Turnos' : 'Roda sem Parar'}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {machineShiftType !== 'continuo' && (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div className="space-y-3 p-3 bg-white rounded-xl border border-slate-200">
                                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Turno 1</span>
                                                    <div className="flex gap-2">
                                                        <input type="time" value={machineShift1Start} onChange={e => setMachineShift1Start(e.target.value)}
                                                            className="w-full p-2 border border-slate-300 rounded-lg text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500" />
                                                        <span className="text-slate-400 self-center font-bold">-</span>
                                                        <input type="time" value={machineShift1End} onChange={e => setMachineShift1End(e.target.value)}
                                                            className="w-full p-2 border border-slate-300 rounded-lg text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500" />
                                                    </div>
                                                </div>
                                                {machineShiftType === '2turnos' && (
                                                    <div className="space-y-3 p-3 bg-white rounded-xl border border-slate-200">
                                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Turno 2</span>
                                                        <div className="flex gap-2">
                                                            <input type="time" value={machineShift2Start} onChange={e => setMachineShift2Start(e.target.value)}
                                                                className="w-full p-2 border border-slate-300 rounded-lg text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500" />
                                                            <span className="text-slate-400 self-center font-bold">-</span>
                                                            <input type="time" value={machineShift2End} onChange={e => setMachineShift2End(e.target.value)}
                                                                className="w-full p-2 border border-slate-300 rounded-lg text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500" />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {machineShiftType !== 'continuo' && (
                                            <div className="flex items-center gap-4 flex-wrap">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input type="checkbox" checked={machineHasLunch} onChange={e => setMachineHasLunch(e.target.checked)}
                                                        className="rounded border-slate-300" />
                                                    <span className="text-xs font-bold text-slate-700">Pausa para almoço</span>
                                                </label>
                                                {machineHasLunch && (
                                                    <div className="flex items-center gap-2">
                                                        <input type="time" value={machineLunchStart} onChange={e => setMachineLunchStart(e.target.value)}
                                                            className="p-2 border border-slate-300 rounded-lg text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500" />
                                                        <span className="text-slate-400 font-bold">-</span>
                                                        <input type="time" value={machineLunchEnd} onChange={e => setMachineLunchEnd(e.target.value)}
                                                            className="p-2 border border-slate-300 rounded-lg text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500" />
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Staff per shift */}
                                        {machineShiftType !== 'continuo' && (
                                            <div>
                                                <div className="flex gap-2 mb-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => setStaffForShift(1)}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                                                            staffForShift === 1
                                                                ? 'bg-blue-600 text-white shadow'
                                                                : 'bg-white border border-slate-300 text-slate-600'
                                                        }`}
                                                    >
                                                        Turno 1
                                                    </button>
                                                    {machineShiftType === '2turnos' && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setStaffForShift(2)}
                                                            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                                                                staffForShift === 2
                                                                    ? 'bg-blue-600 text-white shadow'
                                                                    : 'bg-white border border-slate-300 text-slate-600'
                                                            }`}
                                                        >
                                                            Turno 2
                                                        </button>
                                                    )}
                                                </div>

                                                <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2">
                                                    {(staffForShift === 1 ? machineShift1Staff : machineShift2Staff).map((s, i) => (
                                                        <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                                                            <span className="text-xs font-bold text-slate-700">{s.function}: <span className="text-blue-700">{s.quantity} funcionário(s)</span></span>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const updated = (staffForShift === 1 ? machineShift1Staff : machineShift2Staff).filter((_, idx) => idx !== i);
                                                                    staffForShift === 1 ? setMachineShift1Staff(updated) : setMachineShift2Staff(updated);
                                                                }}
                                                                className="text-red-400 hover:text-red-600"
                                                            >
                                                                <TrashIcon className="h-3.5 w-3.5" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                    {(staffForShift === 1 ? machineShift1Staff : machineShift2Staff).length === 0 && (
                                                        <p className="text-xs text-slate-400 text-center py-2">Nenhum funcionário configurado para este turno.</p>
                                                    )}
                                                    <div className="flex items-center gap-2 pt-1">
                                                        <input type="text" value={newStaffFunction} onChange={e => setNewStaffFunction(e.target.value)}
                                                            placeholder="Função (ex: Operador)"
                                                            className="flex-1 p-2 border border-slate-300 rounded-lg text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500" />
                                                        <input type="number" min="1" value={newStaffQuantity} onChange={e => setNewStaffQuantity(e.target.value)}
                                                            placeholder="Qtd"
                                                            className="w-20 p-2 border border-slate-300 rounded-lg text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500" />
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                if (!newStaffFunction.trim() || !newStaffQuantity || parseInt(newStaffQuantity) <= 0) {
                                                                    showNotification('Preencha a função e quantidade.', 'error');
                                                                    return;
                                                                }
                                                                const entry = { function: newStaffFunction.trim(), quantity: parseInt(newStaffQuantity) };
                                                                if (staffForShift === 1) {
                                                                    setMachineShift1Staff([...machineShift1Staff, entry]);
                                                                } else {
                                                                    setMachineShift2Staff([...machineShift2Staff, entry]);
                                                                }
                                                                setNewStaffFunction('');
                                                                setNewStaffQuantity('');
                                                            }}
                                                            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition-all"
                                                        >
                                                            + Adicionar
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex justify-end gap-2 pt-2">
                                            <button type="button" onClick={resetMachineForm}
                                                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-50 transition-all">
                                                Cancelar
                                            </button>
                                            <button type="button" onClick={handleSaveMachine}
                                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all">
                                                {editingMachineIdx !== null ? 'Atualizar Máquina' : 'Adicionar Máquina'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ARMADO SECTION */}
                        <div className="border-t border-slate-200">
                            <div className="p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Setor de Armado</h3>
                                        <p className="text-[10px] text-slate-500 mt-0.5">Configure as equipes, funcionários e metas diárias do setor de armado</p>
                                    </div>
                                </div>

                                {/* Daily goals */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Meta Diária (kg/dia)</label>
                                        <input type="number" step="0.01" min="0" value={armadoDailyKg} onChange={e => setArmadoDailyKg(e.target.value)}
                                            placeholder="Ex: 5000" className="w-full p-2.5 border border-slate-300 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Meta Diária (metros/dia)</label>
                                        <input type="number" step="0.01" min="0" value={armadoDailyMeters} onChange={e => setArmadoDailyMeters(e.target.value)}
                                            placeholder="Ex: 1000" className="w-full p-2.5 border border-slate-300 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500" />
                                    </div>
                                </div>

                                {/* Armado teams list */}
                                {armadoTeams.length > 0 && (
                                    <div className="space-y-2 mb-4">
                                        {armadoTeams.map((team, idx) => (
                                            <div key={idx} className="flex items-start justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                                                <div className="flex-1 grid grid-cols-3 gap-2 text-xs">
                                                    <div>
                                                        <span className="text-slate-400 font-bold block">Equipe</span>
                                                        <span className="font-black text-slate-800">{team.name}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-400 font-bold block">Funcionários</span>
                                                        <span className="font-semibold">{team.employees.length > 0 ? `${team.employees.length} func.` : '-'}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-400 font-bold block">Funções</span>
                                                        <span className="font-semibold">{team.employees.map(e => `${e.name} (${e.function})`).join(', ') || '-'}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 ml-2 shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setEditingArmadoTeamIdx(idx);
                                                            setArmadoTeamName(team.name);
                                                            setArmadoEmployees(team.employees);
                                                            setShowArmadoTeamForm(true);
                                                        }}
                                                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg transition-colors text-xs border border-blue-200"
                                                        title="Editar Equipe"
                                                    >
                                                        <PencilIcon className="h-3.5 w-3.5 inline mr-1" /> Editar
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (confirm(`Excluir equipe "${team.name}"?`)) {
                                                                setArmadoTeams(armadoTeams.filter((_, i) => i !== idx));
                                                            }
                                                        }}
                                                        className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-colors"
                                                        title="Excluir Equipe"
                                                    >
                                                        <TrashIcon className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Armado team form */}
                                {showArmadoTeamForm && (
                                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                                        <h4 className="text-xs font-black text-slate-600 uppercase tracking-wider">
                                            {editingArmadoTeamIdx !== null ? 'Editar Equipe' : 'Nova Equipe'}
                                        </h4>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Nome da Equipe *</label>
                                            <input type="text" value={armadoTeamName} onChange={e => setArmadoTeamName(e.target.value)}
                                                placeholder="Ex: Equipe A" className="w-full p-2.5 border border-slate-300 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500" />
                                        </div>

                                        {/* Employees within team */}
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Funcionários da Equipe</label>
                                            <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2">
                                                {armadoEmployees.map((emp, i) => (
                                                    <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                                                        <span className="text-xs font-bold text-slate-700">
                                                            {emp.name} <span className="text-blue-700">- {emp.function}</span>
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setArmadoEmployees(armadoEmployees.filter((_, idx) => idx !== i));
                                                            }}
                                                            className="text-red-400 hover:text-red-600"
                                                        >
                                                            <TrashIcon className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                ))}
                                                {armadoEmployees.length === 0 && (
                                                    <p className="text-xs text-slate-400 text-center py-2">Nenhum funcionário cadastrado nesta equipe.</p>
                                                )}
                                                <div className="flex items-center gap-2 pt-1">
                                                    <input type="text" value={armadoEmployeeName} onChange={e => setArmadoEmployeeName(e.target.value)}
                                                        placeholder="Nome do funcionário"
                                                        className="flex-1 p-2 border border-slate-300 rounded-lg text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500" />
                                                    <input type="text" value={armadoEmployeeFunction} onChange={e => setArmadoEmployeeFunction(e.target.value)}
                                                        placeholder="Função"
                                                        className="flex-1 p-2 border border-slate-300 rounded-lg text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500" />
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (!armadoEmployeeName.trim() || !armadoEmployeeFunction.trim()) {
                                                                showNotification('Preencha o nome e a função do funcionário.', 'error');
                                                                return;
                                                            }
                                                            setArmadoEmployees([...armadoEmployees, { name: armadoEmployeeName.trim(), function: armadoEmployeeFunction.trim() }]);
                                                            setArmadoEmployeeName('');
                                                            setArmadoEmployeeFunction('');
                                                        }}
                                                        className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition-all"
                                                    >
                                                        + Adicionar
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex justify-end gap-2 pt-2">
                                            <button type="button" onClick={resetArmadoTeamForm}
                                                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-50 transition-all">
                                                Cancelar
                                            </button>
                                            <button type="button" onClick={() => {
                                                if (!armadoTeamName.trim()) {
                                                    showNotification('Nome da equipe é obrigatório.', 'error');
                                                    return;
                                                }
                                                const team: ArmadoTeam = {
                                                    name: armadoTeamName.trim(),
                                                    employees: armadoEmployees,
                                                };
                                                if (editingArmadoTeamIdx !== null) {
                                                    const updated = [...armadoTeams];
                                                    updated[editingArmadoTeamIdx] = team;
                                                    setArmadoTeams(updated);
                                                } else {
                                                    setArmadoTeams([...armadoTeams, team]);
                                                }
                                                resetArmadoTeamForm();
                                            }}
                                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all">
                                                {editingArmadoTeamIdx !== null ? 'Atualizar Equipe' : 'Adicionar Equipe'}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Add team button */}
                                {!showArmadoTeamForm && (
                                    <button
                                        type="button"
                                        onClick={() => { resetArmadoTeamForm(); setShowArmadoTeamForm(true); }}
                                        className="text-xs font-black py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition-all"
                                    >
                                        + Adicionar Equipe
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* PCP SECTION */}
                        <div className="border-t border-slate-200">
                            <div className="p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Setor de PCP</h3>
                                        <p className="text-[10px] text-slate-500 mt-0.5">Planejamento e Controle de Produção — cadastre os funcionários e suas funções</p>
                                    </div>
                                </div>

                                {/* PCP employees list */}
                                {pcpEmployees.length > 0 && (
                                    <div className="space-y-2 mb-4">
                                        {pcpEmployees.map((emp, idx) => (
                                            <div key={idx} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                                                <div className="flex-1 grid grid-cols-2 gap-2 text-xs">
                                                    <div>
                                                        <span className="text-slate-400 font-bold block">Funcionário</span>
                                                        <span className="font-black text-slate-800">{emp.name}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-400 font-bold block">Função</span>
                                                        <span className="font-semibold">{emp.function}</span>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (confirm(`Remover "${emp.name}" do PCP?`)) {
                                                            setPcpEmployees(pcpEmployees.filter((_, i) => i !== idx));
                                                        }
                                                    }}
                                                    className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-colors ml-2 shrink-0"
                                                    title="Remover Funcionário"
                                                >
                                                    <TrashIcon className="h-4 w-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* PCP employee form */}
                                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                                    <h4 className="text-xs font-black text-slate-600 uppercase tracking-wider">Adicionar Funcionário</h4>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1">
                                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Nome</label>
                                            <input type="text" value={pcpEmployeeName} onChange={e => setPcpEmployeeName(e.target.value)}
                                                placeholder="Nome do funcionário"
                                                className="w-full p-2.5 border border-slate-300 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500" />
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Função</label>
                                            <input type="text" value={pcpEmployeeFunction} onChange={e => setPcpEmployeeFunction(e.target.value)}
                                                placeholder="Ex: Programador"
                                                className="w-full p-2.5 border border-slate-300 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500" />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (!pcpEmployeeName.trim() || !pcpEmployeeFunction.trim()) {
                                                    showNotification('Preencha o nome e a função do funcionário.', 'error');
                                                    return;
                                                }
                                                setPcpEmployees([...pcpEmployees, { name: pcpEmployeeName.trim(), function: pcpEmployeeFunction.trim() }]);
                                                setPcpEmployeeName('');
                                                setPcpEmployeeFunction('');
                                            }}
                                            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all mt-5"
                                        >
                                            + Adicionar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Form Footer Action Buttons */}
                        <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    handleReset();
                                    setViewMode('list');
                                }}
                                className="px-5 py-2.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold rounded-xl shadow-sm text-sm transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="px-8 py-2.5 bg-[#0F3F5C] hover:bg-[#0A2A3D] text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSaving ? 'Salvando...' : 'Salvar Parceiro'}
                            </button>
                        </div>
                    </form>
                ) : (
                    // List View
                    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden animate-fadeIn">
                        
                        {/* Search and Filters */}
                        <div className="p-5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row gap-4 items-center justify-between">
                            <div className="relative w-full sm:max-w-md">
                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    placeholder="Buscar por nome da empresa ou serviço..."
                                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                                />
                            </div>
                            <div className="text-xs font-bold text-slate-400 shrink-0">
                                Total: {filteredPartners.length} {filteredPartners.length === 1 ? 'Parceiro' : 'Parceiros'}
                            </div>
                        </div>

                        {/* Partners Table */}
                        {filteredPartners.length === 0 ? (
                            <div className="p-12 text-center text-slate-500">
                                <span className="text-4xl block mb-2">🤝</span>
                                <p className="font-bold text-sm">Nenhum parceiro encontrado.</p>
                                <p className="text-xs text-slate-400 mt-1">Crie um novo parceiro ou ajuste os termos da busca.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-wider">
                                            <th className="p-4 text-left w-20">LOGO</th>
                                            <th className="p-4 text-left">EMPRESA</th>
                                            <th className="p-4 text-left">SERVIÇOS PRESTADOS</th>
                                            <th className="p-4 text-left">MATERIAIS</th>
                                            <th className="p-4 text-center">MÁQUINAS</th>
                                            <th className="p-4 text-left">DATA DE INÍCIO</th>
                                            <th className="p-4 text-center">BRANDING</th>
                                            {isGestor && <th className="p-4 text-center w-28">AÇÕES</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-sm">
                                        {filteredPartners.map(p => (
                                            <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group">
                                                {/* Logo image slot */}
                                                <td className="p-4">
                                                    <div className="w-12 h-12 rounded-lg border bg-white flex items-center justify-center overflow-hidden shadow-sm">
                                                        {p.logoUrl ? (
                                                            <img src={p.logoUrl} className="w-full h-full object-contain p-1" alt="Logo" />
                                                        ) : (
                                                            <span className="text-xl">🏢</span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Company info */}
                                                <td className="p-4 font-bold text-slate-900">
                                                    <div className="flex flex-col">
                                                        <span>{p.companyName}</span>
                                                        {p.isActiveBranding && (
                                                            <span className="inline-flex items-center gap-1 text-[9px] font-black text-amber-600 bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5 w-fit mt-1 uppercase tracking-wider">
                                                                <StarIcon className="h-2 w-2 text-amber-500" /> Logotipo Ativo
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Services provided */}
                                                <td className="p-4 text-xs font-semibold text-slate-600 max-w-xs truncate" title={p.servicesProvided}>
                                                    {p.servicesProvided || 'Não especificado'}
                                                </td>

                                                {/* Material quantity metadata */}
                                                <td className="p-4 font-bold text-slate-800">
                                                    {p.materialQty || '-'}
                                                </td>

                                                {/* Machine count */}
                                                <td className="p-4 text-center">
                                                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-black text-xs">
                                                        {p.machines?.length || 0}
                                                    </span>
                                                </td>

                                                {/* Start date */}
                                                <td className="p-4 text-slate-500 font-mono text-xs">
                                                    {p.startDate ? new Date(p.startDate + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                                                </td>

                                                {/* Branding badge indicator */}
                                                <td className="p-4 text-center">
                                                    <span className={`inline-block px-2.5 py-0.5 text-xs font-bold rounded-full border ${
                                                        p.isActiveBranding
                                                            ? 'bg-amber-100 text-amber-800 border-amber-200 font-black'
                                                            : 'bg-slate-100 text-slate-500 border-slate-200'
                                                    }`}>
                                                        {p.isActiveBranding ? 'Logotipo Sistema' : 'Inativo'}
                                                    </span>
                                                </td>

                                                {/* Action buttons */}
                                                {isGestor && (
                                                    <td className="p-4 text-center">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button
                                                                onClick={() => handleStartEdit(p)}
                                                                title="Editar Parceiro"
                                                                className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                                                                type="button"
                                                            >
                                                                <PencilIcon className="h-5 w-5" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(p.id)}
                                                                title="Excluir Parceiro"
                                                                className="p-1.5 hover:bg-red-50 text-red-500 hover:text-red-600 rounded-lg transition-colors border border-transparent hover:border-red-100"
                                                                type="button"
                                                            >
                                                                <TrashIcon className="h-5 w-5" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PartnerConfig;
