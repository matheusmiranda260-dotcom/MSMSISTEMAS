import React, { useState, useMemo } from 'react';
import type { Partner } from '../types';
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
    const [logoUrl, setLogoUrl] = useState('');
    const [materialQty, setMaterialQty] = useState('');
    const [servicesProvided, setServicesProvided] = useState('');
    const [startDate, setStartDate] = useState('');
    const [isActiveBranding, setIsActiveBranding] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

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

    const handleReset = () => {
        setEditingId(null);
        setCompanyName('');
        setLogoUrl('');
        setMaterialQty('');
        setServicesProvided('');
        setStartDate('');
        setIsActiveBranding(false);
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
                logoUrl: logoUrl.trim() || undefined,
                materialQty: materialQty.trim() || undefined,
                servicesProvided: servicesProvided.trim() || undefined,
                startDate: startDate || undefined,
                isActiveBranding
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
        setLogoUrl(partner.logoUrl || '');
        setMaterialQty(partner.materialQty || '');
        setServicesProvided(partner.servicesProvided || '');
        setStartDate(partner.startDate || '');
        setIsActiveBranding(!!partner.isActiveBranding);
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
                    {isGestor && viewMode === 'list' && (
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
                                                            >
                                                                <PencilIcon className="h-4.5 w-4.5" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(p.id)}
                                                                title="Excluir Parceiro"
                                                                className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg transition-colors border border-transparent hover:border-red-100"
                                                            >
                                                                <TrashIcon className="h-4.5 w-4.5" />
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
