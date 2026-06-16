import React, { useState, useMemo, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { PencilIcon, XIcon, SearchIcon, CheckCircleIcon, PrinterIcon } from '../icons';
import type { Employee, OrgUnit, OrgPosition, Evaluation, Partner } from '../../types';
import { insertItem, updateItem } from '../../services/supabaseService';

// --- STATIC ORG CHART (Fixed Structure) ---
// The hierarchy is hardcoded. Only employees in slots and shift times are editable.

const VLine: React.FC<{ height?: number }> = ({ height = 32 }) => (
    <div className="org-vline" style={{ width: 2, height: height || 32, background: '#000', margin: '0 auto' }} />
);

const BlueLabelBox: React.FC<{ label: string }> = ({ label }) => (
    <div style={{
        background: '#4F81BD', border: '2px solid #2F5496', color: '#fff',
        fontWeight: 900, fontSize: 14, letterSpacing: 2, textTransform: 'uppercase',
        padding: '10px 36px', textAlign: 'center', minWidth: 200, whiteSpace: 'nowrap',
    }}>
        {label}
    </div>
);

interface SlotDef { key: string; title: string; }
interface ShiftCardProps {
    shiftKey: string; defaultTime: string; slots: SlotDef[];
    employees: Employee[]; shiftTimes: Record<string, string>;
    onEditShiftTime: (key: string, cur: string) => void;
    onAddEmployee: (slotKey: string) => void;
    onUnassign: (slotKey: string) => void;
}
const StaticShiftCard: React.FC<ShiftCardProps> = ({
    shiftKey, defaultTime, slots, employees, shiftTimes, onEditShiftTime, onAddEmployee, onUnassign
}) => {
    const display = shiftTimes[shiftKey] || defaultTime;
    return (
        <div style={{ border: '1.5px solid #9ca3af', background: '#fff', minWidth: 220, maxWidth: 280 }}>
            <div
                onClick={() => onEditShiftTime(shiftKey, display)}
                title="Clique para editar horário"
                style={{
                    background: '#f1f5f9', borderBottom: '1px solid #d1d5db', padding: '7px 12px',
                    textAlign: 'center', fontWeight: 900, fontSize: 13, textTransform: 'uppercase',
                    color: '#1e293b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
            >
                {display}
                <PencilIcon className="no-print h-3.5 w-3.5 opacity-50" />
            </div>
            <div style={{ padding: '10px 14px' }}>
                {slots.map(slot => {
                    const occ = employees.find(e => e.orgPositionId === slot.key);
                    return (
                        <div key={slot.key} style={{ marginBottom: 5, display: 'flex', alignItems: 'center', gap: 5 }}>
                            {occ ? (
                                <>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div style={{ height: 28, width: 28, borderRadius: '50%', background: '#e2e8f0', overflow: 'hidden', border: '1px solid #cbd5e1', flexShrink: 0 }}>
                                            {occ.photoUrl ? (
                                                <img src={occ.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (
                                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#64748b' }}>
                                                    {occ.name.charAt(0)}
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span 
                                                style={{ fontWeight: 800, fontSize: 12, color: '#0f172a', cursor: 'pointer', textTransform: 'uppercase', lineHeight: 1 }}
                                                title="Clique para desvincular"
                                                onClick={() => onUnassign(slot.key)}
                                            >{occ.name.toUpperCase()}</span>
                                            <span style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{slot.title}</span>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <span style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>???? ( {slot.title} )</span>
                                    <button
                                        onClick={() => onAddEmployee(slot.key)}
                                        className="no-print"
                                        style={{ background: '#dbeafe', border: 'none', borderRadius: 4, padding: '2px 7px', fontSize: 13, color: '#2563eb', cursor: 'pointer', fontWeight: 700, marginLeft: 4 }}
                                    >+</button>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// Static shift definitions — keys are stable, stored as orgPositionId in DB
const SHIFTS = {
    adm1:       { key: 'adm_t1',     def: 'TURNO 2:00 AS 11:34', slots: [{ key: 'adm_t1_enc', title: 'encarregado' }] },
    adm2:       { key: 'adm_t2',     def: 'TURNO 5:00 AS 14:44', slots: [{ key: 'adm_t2_ges', title: 'gestor qualidade' }] },
    tr1_t1:     { key: 'tr1_t1',     def: 'TURNO 7:45 AS 17:30', slots: [{ key: 'tr1_t1_op', title: 'operador' }, { key: 'tr1_t1_a1', title: 'Auxiliar' }, { key: 'tr1_t1_a2', title: 'Auxiliar' }] },
    tc1_t1:     { key: 'tc1_t1',     def: 'TURNO 5:00 AS 14:44', slots: [{ key: 'tc1_t1_op', title: 'operador' }, { key: 'tc1_t1_a1', title: 'Auxiliar' }] },
    tc1_t2:     { key: 'tc1_t2',     def: 'TURNO 2:00 AS 11:34', slots: [{ key: 'tc1_t2_op', title: 'operador' }, { key: 'tc1_t2_a1', title: 'Auxiliar' }] },
    tc2_t1:     { key: 'tc2_t1',     def: 'TURNO 5:00 AS 14:44', slots: [{ key: 'tc2_t1_op', title: 'operador' }, { key: 'tc2_t1_a1', title: 'Auxiliar' }] },
    // tc2_t2:     { key: 'tc2_t2',     def: 'TURNO 2:00 AS 11:34', slots: [{ key: 'tc2_t2_op', title: 'operador' }, { key: 'tc2_t2_a1', title: 'Auxiliar' }] },
    malha_t1:   { key: 'malha_t1',   def: 'TURNO 7:45 AS 17:30', slots: [{ key: 'malha_t1_op', title: 'operador' }, { key: 'malha_t1_a1', title: 'Auxiliar' }, { key: 'malha_t1_a2', title: 'Auxiliar' }] },
};

const OrgChart: React.FC<{
    employees: Employee[];
    units: OrgUnit[];
    positions: OrgPosition[];
    reloadData: () => void;
    triggerAddEmployee: (posId?: string, prefillSector?: string) => void;
    triggerEditEmployee: (emp: Employee) => void;
    evaluations: Evaluation[];
    activeBrandingPartner?: Partner | null;
}> = ({ employees, units, positions, reloadData, triggerAddEmployee, triggerEditEmployee, activeBrandingPartner }) => {

    const [shiftTimes, setShiftTimes] = useState<Record<string, string>>(() => {
        try { const s = localStorage.getItem('orgShiftTimes'); return s ? JSON.parse(s) : {}; } catch { return {}; }
    });

    // Stats calculation
    const totalSlots = useMemo(() => {
        return Object.values(SHIFTS).reduce((acc, s) => acc + s.slots.length, 0);
    }, []);

    const assignedCount = useMemo(() => {
        const slotKeys = Object.values(SHIFTS).flatMap(s => s.slots.map(sl => sl.key));
        return employees.filter(e => e.orgPositionId && slotKeys.includes(e.orgPositionId)).length;
    }, [employees]);

    const vacanciesCount = totalSlots - assignedCount;

    const handlePrint = () => {
        window.print();
    };

    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const copyToClipboard = async () => {
        try {
            const element = document.getElementById('org-chart-sheet');
            if (!element) return;

            showToast('Gerando imagem de alta resolução...', 'info');

            element.classList.add('is-capturing');
            // Wait a tiny bit for render updates
            await new Promise(resolve => setTimeout(resolve, 100));

            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
                onclone: (clonedDoc) => {
                    const clonedElement = clonedDoc.getElementById('org-chart-sheet');
                    if (clonedElement) {
                        clonedElement.style.overflow = 'visible';
                    }
                }
            });

            element.classList.remove('is-capturing');

            canvas.toBlob(async (blob) => {
                if (blob) {
                    try {
                        await navigator.clipboard.write([
                            new ClipboardItem({ [blob.type]: blob })
                        ]);
                        showToast('Imagem copiada! Cole (Ctrl+V) no WhatsApp.', 'success');
                    } catch (err) {
                        // Fallback: Download file
                        const link = document.createElement('a');
                        link.download = `Organograma_Setorial_${new Date().toISOString().split('T')[0]}.png`;
                        link.href = canvas.toDataURL();
                        link.click();
                        showToast('Imagem baixada! Envie o arquivo no WhatsApp.', 'info');
                    }
                }
            }, 'image/png');
        } catch (e) {
            console.error(e);
            const element = document.getElementById('org-chart-sheet');
            if (element) element.classList.remove('is-capturing');
            showToast('Erro ao gerar imagem.', 'error');
        }
    };

    const handleEditShiftTime = (key: string, cur: string) => {
        const v = prompt('Editar horário (ex: TURNO 7:45 AS 17:30):', cur);
        if (v && v !== cur) {
            const next = { ...shiftTimes, [key]: v };
            setShiftTimes(next);
            localStorage.setItem('orgShiftTimes', JSON.stringify(next));
        }
    };

    // Added state for the NEW selection UI
    const [selectingFor, setSelectingFor] = useState<{ slotKey: string, title: string, sector: string } | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);

    // Self-healing: Ensure hardcoded IDs exist in DB to satisfy Foreign Key constraints
    useEffect(() => {
        let isSyncing = false;
        const syncDB = async () => {
            if (isSyncing || units.length === 0) return;
            isSyncing = true;
            try {
                // Find or create a base unit for static positions
                let unitId = units[0]?.id;
                
                // Collect required IDs
                const requiredIds: string[] = [];
                Object.values(SHIFTS).forEach(s => s.slots.forEach(sl => requiredIds.push(sl.key)));

                const missing = requiredIds.filter(id => !positions.find(p => p.id === id));
                if (missing.length > 0) {
                    console.log('Syncing missing positions:', missing);
                    for (const id of missing) {
                        try {
                            await insertItem<OrgPosition>('org_positions', {
                                id: id,
                                orgUnitId: unitId,
                                title: 'Slot'
                            });
                        } catch (e) {}
                    }
                    reloadData();
                }
            } catch (err) {} finally { isSyncing = false; }
        };
        syncDB();
    }, [positions.length, units.length]); // Only re-run if lengths change


    const handleUnassign = async (slotKey: string) => {
        if (!confirm('Desvincular este funcionário do cargo?')) return;
        const occ = employees.find(e => e.orgPositionId === slotKey);
        if (occ) await updateItem('employees', occ.id, { orgPositionId: null });
        reloadData();
    };

    const handleAddEmployee = (slotKey: string, title: string, sector: string) => {
        setSelectingFor({ slotKey, title, sector });
        setSearchTerm('');
    };

    const confirmAssignment = async (employeeId: string) => {
        if (!selectingFor || isUpdating) return;
        setIsUpdating(true);
        console.log('Confirming assignment for:', employeeId, selectingFor);
        
        try {
            const { slotKey, title, sector } = selectingFor;

            // 1. Desvincular quem estava antes no slot alvo (se houver)
            const occupants = employees.filter(e => e.orgPositionId === slotKey);
            for (const occ of occupants) {
                console.log('Clearing previous occupant:', occ.name);
                await updateItem('employees', occ.id, { orgPositionId: null });
            }

            // 2. Vincular o novo funcionário e sincronizar cargo/setor
            console.log('Updating employee:', employeeId, 'to', title, sector);
            const result = await updateItem('employees', employeeId, { 
                orgPositionId: slotKey,
                jobTitle: title,
                sector: sector
            });
            console.log('Update result:', result);

            setSelectingFor(null);
            reloadData();
        } catch (error: any) {
            console.error('Error assigning employee:', error);
            alert(`Falha ao vincular funcionário: ${error.message || 'Erro desconhecido'}. Verifique sua conexão ou permissões.`);
        } finally {
            setIsUpdating(false);
        }
    };

    const card = (s: any, sector: string) => (
        <StaticShiftCard
            key={s.key}
            shiftKey={s.key} defaultTime={s.def} slots={s.slots}
            employees={employees} shiftTimes={shiftTimes}
            onEditShiftTime={handleEditShiftTime}
            onAddEmployee={(slotKey) => handleAddEmployee(slotKey, s.slots.find(x => x.key === slotKey)?.title || '', sector)}
            onUnassign={handleUnassign}
        />
    );

    const col: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center' };

    return (
        <div className="org-scroll-wrapper" style={{ overflow: 'auto', padding: '24px', background: '#f8fafc', minHeight: '600px' }}>
            
            {/* Local Toast System */}
            {toast && (
                <div className="fixed top-4 right-4 z-[9999] bg-[#002060] text-white px-4 py-3 rounded-lg shadow-xl border border-blue-500 font-bold text-xs animate-fadeIn pointer-events-auto">
                    {toast.message}
                </div>
            )}

            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    .no-print { display: none !important; }
                    html, body { 
                        background: white !important; 
                        padding: 0 !important; 
                        margin: 0 !important; 
                    }
                    /* Reset wrappers for print to ensure full width and no margins */
                    .app-container,
                    .main-content,
                    .main-content > div,
                    .app-container > main,
                    div.p-4,
                    div.p-8,
                    .min-h-screen {
                        display: block !important;
                        width: 100% !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        position: static !important;
                        border: none !important;
                        box-shadow: none !important;
                    }
                    .org-scroll-wrapper { 
                        overflow: visible !important; 
                        padding: 0 !important; 
                        background: white !important;
                        width: 100% !important;
                        height: auto !important;
                    }
                    .org-sheet-container {
                        border: none !important;
                        box-shadow: none !important;
                        padding: 0 !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        margin: 0 !important;
                    }
                    .org-container { 
                        display: flex !important;
                        padding: 0 !important; 
                        background: white !important; 
                        width: 100% !important;
                    }
                    @page { 
                        size: A4 landscape; 
                        margin: 5mm; 
                    }
                    * { 
                        -webkit-print-color-adjust: exact !important; 
                        print-color-adjust: exact !important; 
                        box-shadow: none !important; 
                    }
                }

                .is-capturing .no-print {
                    display: none !important;
                }
                .is-capturing {
                    padding: 24px !important;
                    margin: 0 auto !important;
                    box-shadow: none !important;
                    border: 2px solid #002060 !important;
                    border-radius: 8px !important;
                    width: 1240px !important;
                    max-width: 1240px !important;
                }
            `}} />
            
            <div id="org-chart-sheet" className="max-w-[1240px] mx-auto bg-white border-2 border-[#002060] rounded-xl shadow-lg p-6 org-sheet-container relative">
                
                {/* CABEÇALHO PADRÃO ITA */}
                <div className="grid grid-cols-12 border border-[#002060]">
                    <div className="col-span-3 bg-white p-3 flex items-center justify-center border-r border-[#002060]">
                        {activeBrandingPartner?.logoUrl ? (
                            <img src={activeBrandingPartner.logoUrl} alt={activeBrandingPartner.companyName} className="h-14 md:h-16 object-contain" style={{ maxHeight: '60px' }} />
                        ) : null}
                    </div>

                    <div className="col-span-6 bg-white p-3 flex flex-col justify-center text-center gap-1">
                        <h2 className="text-xl md:text-2xl font-black uppercase tracking-wider text-[#002060] leading-none">
                            Organograma Setorial
                        </h2>
                        <p className="text-[13px] font-extrabold text-slate-500 uppercase mt-0.5">
                            Setor Laminação e Trefilação
                        </p>
                    </div>

                    <div className="col-span-3 bg-[#002060] text-white p-3 flex flex-col justify-center text-center font-bold">
                        <div className="text-[10px] font-black text-slate-300 uppercase">Data de Emissão</div>
                        <div className="text-lg font-black mt-0.5">{new Date().toLocaleDateString('pt-BR')}</div>
                    </div>
                </div>

                {/* METADATA BLOCK CONECTADO */}
                <div className="grid grid-cols-3 border-x border-b border-[#002060] mb-6 text-center font-bold text-xs uppercase text-[#002060]">
                    <div className="p-2 border-r border-[#002060] bg-slate-50/50">
                        <span className="text-[10px] text-slate-500 font-extrabold block">Colaboradores Ativos</span>
                        <span className="text-sm font-black">{assignedCount}</span>
                    </div>
                    <div className="p-2 border-r border-[#002060] bg-slate-50/50">
                        <span className="text-[10px] text-slate-500 font-extrabold block">Vagas Disponíveis</span>
                        <span className="text-sm font-black text-blue-600">{vacanciesCount}</span>
                    </div>
                    <div className="p-2 bg-slate-50/50">
                        <span className="text-[10px] text-slate-500 font-extrabold block">Status</span>
                        <span className="text-sm font-black text-emerald-600">Atualizado</span>
                    </div>
                </div>

                {/* Botão sob a tabela (Apenas na tela) */}
                <div className="flex justify-end mb-6 no-print gap-2">
                    <button 
                        onClick={copyToClipboard}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg font-bold transition shadow flex items-center gap-2 text-xs uppercase tracking-wider"
                    >
                        <CheckCircleIcon className="h-4 w-4" />
                        Copiar Imagem (Zap)
                    </button>
                    <button 
                        onClick={handlePrint}
                        className="bg-[#002060] hover:bg-[#0A2A3D] text-white px-5 py-2.5 rounded-lg font-bold transition shadow flex items-center gap-2 text-xs uppercase tracking-wider"
                    >
                        <PrinterIcon className="h-4 w-4" />
                        Imprimir Organograma
                    </button>
                </div>

                <div className="org-container" style={col}>

                <BlueLabelBox label="SETOR LAMINAÇÃO" />
                <VLine />
                <BlueLabelBox label="ADMINISTRAÇÃO" />
                <VLine />
                {card(SHIFTS.adm1, 'ADMINISTRAÇÃO')}
                <VLine />
                {card(SHIFTS.adm2, 'ADMINISTRAÇÃO')}
                <VLine />
                <BlueLabelBox label="MÁQUINAS" />
                <VLine />

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 48, alignItems: 'flex-start' }}>

                        <div style={col}>
                            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                                <div className="org-hline" style={{ position: 'absolute', top: 0, left: '50%', right: -24, height: 2, background: '#000' }} />
                                <div className="org-vline" style={{ width: 2, height: 24, background: '#000', zIndex: 1 }} />
                            </div>
                            <BlueLabelBox label="TREFILA 1" />
                            <VLine />
                            {card(SHIFTS.tr1_t1, 'TREFILA 1')}
                        </div>

                        <div style={col}>
                            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                                <div className="org-hline" style={{ position: 'absolute', top: 0, left: -24, right: -24, height: 2, background: '#000' }} />
                                <div className="org-vline" style={{ width: 2, height: 24, background: '#000', zIndex: 1 }} />
                            </div>
                            <BlueLabelBox label="TRELIÇA 1" />
                            <VLine />
                            {card(SHIFTS.tc1_t1, 'TRELIÇA 1')}
                            <VLine />
                            {card(SHIFTS.tc1_t2, 'TRELIÇA 1')}
                        </div>

                        {/* TRELIÇA 2 — middle column: line extends 24px on both sides */}
                        <div style={col}>
                            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                                <div className="org-hline" style={{ position: 'absolute', top: 0, left: -24, right: -24, height: 2, background: '#000' }} />
                                <div className="org-vline" style={{ width: 2, height: 24, background: '#000', zIndex: 1 }} />
                            </div>
                            <BlueLabelBox label="TRELIÇA 2" />
                            <VLine />
                            {card(SHIFTS.tc2_t1, 'TRELIÇA 2')}
                        </div>

                        {/* MALHA — last column: line extends left into gap */}
                        <div style={col}>
                            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                                {/* Horizontal: from left (extends 24px past column edge) → center */}
                                <div className="org-hline" style={{ position: 'absolute', top: 0, left: -24, right: '50%', height: 2, background: '#000' }} />
                                <div className="org-vline" style={{ width: 2, height: 24, background: '#000', zIndex: 1 }} />
                            </div>
                            <BlueLabelBox label="MALHA" />
                            <VLine />
                            {card(SHIFTS.malha_t1, 'MALHA')}
                        </div>

                    </div>
                </div>

            {/* Employee Selection Overlay */}
            {selectingFor && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[80vh]">
                        <div className="p-6 border-b flex justify-between items-center bg-slate-50 rounded-t-2xl">
                            <div className="flex-1">
                                <h3 className="font-bold text-slate-800 text-lg">Vincular Colaborador</h3>
                                <p className="text-xs text-slate-500 uppercase font-black tracking-tight mt-1">
                                    {selectingFor.sector} — <span className="text-blue-600">{selectingFor.title}</span>
                                </p>
                            </div>
                            <button onClick={() => setSelectingFor(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                                <XIcon className="h-6 w-6 text-slate-400" />
                            </button>
                        </div>
                        
                        <div className="p-4 bg-white sticky top-0 z-10">
                            <div className="relative">
                                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                <input 
                                    type="text" 
                                    placeholder="Buscar por nome..." 
                                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>
                        
                        <div className="flex-1 overflow-auto p-3 space-y-1">
                            {employees
                                .filter(e => e.active) // Only active
                                .filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                .length > 0 ? (
                                    employees
                                        .filter(e => e.active)
                                        .filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                        .sort((a,b) => a.name.localeCompare(b.name))
                                        .map(e => {
                                            const isCurrentlyAssigned = !!e.orgPositionId;
                                            return (
                                                <button 
                                                    key={e.id}
                                                    disabled={isUpdating}
                                                    onClick={async () => {
                                                        if (isCurrentlyAssigned && !confirm(`${e.name} já possui um cargo. Deseja movê-lo para esta nova posição?`)) return;
                                                        await confirmAssignment(e.id);
                                                    }}
                                                    className={`w-full text-left p-3 hover:bg-blue-50 rounded-xl flex items-center gap-4 group transition-all border border-transparent hover:border-blue-100 ${isUpdating ? 'opacity-50 cursor-wait' : ''}`}
                                                >
                                                    <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold group-hover:bg-blue-100 group-hover:text-blue-600 overflow-hidden shrink-0 border border-slate-200">
                                                        {e.photoUrl ? <img src={e.photoUrl} className="h-full w-full object-cover" /> : e.name.charAt(0)}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-bold text-slate-800 group-hover:text-blue-800 truncate">{e.name}</p>
                                                        <p className="text-[10px] text-slate-500 uppercase font-medium">
                                                            {isCurrentlyAssigned ? `${e.jobTitle} • ${e.sector}` : 'Disponível / Sem Cargo'}
                                                        </p>
                                                    </div>
                                                    {isCurrentlyAssigned && (
                                                        <div className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded font-bold uppercase group-hover:bg-blue-200 group-hover:text-blue-700">Mover</div>
                                                    )}
                                                </button>
                                            );
                                        })
                                ) : (
                                    <div className="text-center py-12 px-6">
                                        <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <SearchIcon className="h-10 w-10 text-slate-200" />
                                        </div>
                                        <p className="text-slate-400 font-medium">Nenhum colaborador encontrado com "{searchTerm}"</p>
                                        <button 
                                            onClick={() => { setSelectingFor(null); triggerAddEmployee(selectingFor.slotKey, selectingFor.sector); }}
                                            className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition"
                                        >
                                            + Cadastrar Novo
                                        </button>
                                    </div>
                                )
                            }
                        </div>
                        <div className="p-4 bg-slate-50 border-t rounded-b-2xl text-[10px] text-center text-slate-400 uppercase font-black tracking-widest">
                            Lista de Colaboradores MSM
                        </div>
                    </div>
                </div>
            )}
        </div>
    </div>
    </div>
    );
};

export default OrgChart;
