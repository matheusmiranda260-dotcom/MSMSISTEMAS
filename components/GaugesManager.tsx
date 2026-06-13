import React, { useState, useMemo, useEffect } from 'react';
import type { StockGauge, StockItem } from '../types';
import { MaterialOptions } from '../types';
import { TrashIcon, PlusIcon, CheckCircleIcon, ScaleIcon, ArrowPathIcon, PencilIcon, XIcon, SearchIcon } from './icons';

interface GaugesManagerProps {
    gauges: StockGauge[];
    stock: StockItem[];
    onAdd: (gauge: Omit<StockGauge, 'id'>) => void;
    onDelete: (id: string) => void;
    onUpdate: (id: string, data: Partial<StockGauge>) => void;
}

const GaugesManager: React.FC<GaugesManagerProps> = ({ gauges, stock, onAdd, onDelete, onUpdate }) => {
    const [newGauge, setNewGauge] = useState('');
    const [newProductCode, setNewProductCode] = useState('');
    const [selectedGroup, setSelectedGroup] = useState<string>('Fio Máquina');
    const [customGroupName, setCustomGroupName] = useState('');
    const [isCreatingNewGroup, setIsCreatingNewGroup] = useState(false);
    const [metricUnit, setMetricUnit] = useState('mm');
    
    // Editing states
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingGaugeVal, setEditingGaugeVal] = useState('');
    const [editingCode, setEditingCode] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    const dynamicGroups = useMemo(() => {
        const groups = Array.from(new Set(gauges.map(g => g.materialType))).filter(Boolean) as string[];
        return groups.sort();
    }, [gauges]);

    useEffect(() => {
        if (dynamicGroups.length === 0) {
            setIsCreatingNewGroup(true);
        } else if (!isCreatingNewGroup && !dynamicGroups.includes(selectedGroup)) {
            setSelectedGroup(dynamicGroups[0]);
        }
    }, [dynamicGroups, selectedGroup, isCreatingNewGroup]);

    const normalizeGauge = (val: string) => {
        if (!val) return '';
        const str = val.trim();
        const match = str.match(/^([\d.,]+)(.*)$/);
        if (match) {
            const num = parseFloat(match[1].replace(',', '.'));
            if (!isNaN(num)) {
                return num.toFixed(2) + match[2].toLowerCase();
            }
        }
        return str.toLowerCase();
    };

    // Calculate dynamic stock summary per group and per gauge
    const gaugeStockItems = useMemo(() => {
        const map: Record<string, { count: number; totalWeight: number; items: StockItem[] }> = {};
        
        (stock || []).forEach(item => {
            if (item.status === 'Consumido') return;
            const groupKey = (item.materialType || '').trim().toLowerCase();
            const gaugeKey = normalizeGauge(item.bitola);
            const compositeKey = `${groupKey}::${gaugeKey}`;
            
            if (!map[compositeKey]) {
                map[compositeKey] = { count: 0, totalWeight: 0, items: [] };
            }
            
            const qty = item.remainingQuantity || 0;
            map[compositeKey].count += 1;
            map[compositeKey].totalWeight += qty;
            map[compositeKey].items.push(item);
        });
        
        return map;
    }, [stock]);

    const groupStockSummaries = useMemo(() => {
        const summaries: Record<string, { totalCount: number; totalWeight: number }> = {};
        
        dynamicGroups.forEach(group => {
            summaries[group] = { totalCount: 0, totalWeight: 0 };
        });
        
        (stock || []).forEach(item => {
            if (item.status === 'Consumido') return;
            const groupName = (item.materialType || '').trim().toLowerCase();
            
            const matchedGroup = dynamicGroups.find(g => g.toLowerCase() === groupName);
            if (matchedGroup) {
                summaries[matchedGroup].totalCount += 1;
                summaries[matchedGroup].totalWeight += item.remainingQuantity || 0;
            }
        });
        
        return summaries;
    }, [stock, dynamicGroups]);

    const getStockInfo = (materialType: string, gaugeStr: string) => {
        const groupKey = (materialType || '').trim().toLowerCase();
        const gaugeKey = normalizeGauge(gaugeStr);
        const compositeKey = `${groupKey}::${gaugeKey}`;
        return gaugeStockItems[compositeKey] || { count: 0, totalWeight: 0, items: [] };
    };

    const handleAdd = () => {
        if (!newGauge) return;

        const groupToUse = isCreatingNewGroup ? customGroupName.trim() : selectedGroup;
        if (!groupToUse) {
            alert('Por favor, informe ou selecione o grupo.');
            return;
        }

        let finalGauge = normalizeGauge(newGauge);
        if (metricUnit !== 'nenhum' && !finalGauge.toLowerCase().includes(metricUnit.toLowerCase())) {
            finalGauge = `${finalGauge} ${metricUnit}`;
        }

        // Check if already exists
        const exists = gauges.some(g => g.materialType.toLowerCase() === groupToUse.toLowerCase() && g.gauge.toLowerCase() === finalGauge.toLowerCase());
        if (exists) {
            alert('Esta bitola/medida já está cadastrada para este material.');
            return;
        }

        onAdd({
            materialType: groupToUse,
            gauge: finalGauge,
            productCode: newProductCode.trim() || undefined
        });

        setNewGauge('');
        setNewProductCode('');

        if (isCreatingNewGroup) {
            setSelectedGroup(groupToUse);
            setIsCreatingNewGroup(false);
            setCustomGroupName('');
        }
    };

    const handleUpdate = (id: string) => {
        const normalized = editingGaugeVal.replace(',', '.');
        const numberVal = parseFloat(normalized);
        if (isNaN(numberVal)) {
            alert('Por favor, insira um número válido para a bitola.');
            return;
        }
        const formatted = numberVal.toFixed(2);

        const targetGauge = gauges.find(g => g.id === id);
        if (targetGauge) {
            const hasStock = getStockInfo(targetGauge.materialType, targetGauge.gauge).count > 0;
            if (hasStock && formatted !== targetGauge.gauge) {
                alert(`Não é possível alterar a medida da bitola pois existem lotes em estoque usando ela. Se precisar corrigir o código do produto, mude apenas o código.`);
                return;
            }
        }

        onUpdate(id, { 
            gauge: formatted,
            productCode: editingCode.trim() || undefined 
        });
        setEditingId(null);
        setEditingCode('');
        setEditingGaugeVal('');
    };

    const startEditing = (g: StockGauge) => {
        setEditingId(g.id);
        setEditingGaugeVal(g.gauge);
        setEditingCode(g.productCode || '');
    };

    const handleRenameGroup = async (oldName: string) => {
        const groupGauges = gauges.filter(g => g.materialType === oldName);
        
        const hasStock = groupGauges.some(g => getStockInfo(g.materialType, g.gauge).count > 0);
        if (hasStock) {
            alert(`Não é possível renomear o grupo "${oldName}" pois existem lotes em estoque para algumas de suas bitolas. Consuma ou transfira o estoque primeiro.`);
            return;
        }

        const newName = prompt(`Renomear grupo "${oldName}" para:`, oldName);
        if (!newName || newName.trim() === oldName) return;

        const cleanNewName = newName.trim();
        
        // Check if new name already exists (case-insensitive)
        const alreadyExists = dynamicGroups.some(g => g.toLowerCase() === cleanNewName.toLowerCase() && g !== oldName);
        if (alreadyExists) {
            alert('Já existe um grupo com este nome.');
            return;
        }

        
        try {
            // Update all gauges in this group sequentially
            for (const g of groupGauges) {
                await onUpdate(g.id, { materialType: cleanNewName });
            }
            setSelectedGroup(cleanNewName);
        } catch (err) {
            console.error('Error renaming group:', err);
            alert('Erro ao renomear o grupo.');
        }
    };

    const handleDeleteGroup = async (groupName: string) => {
        const groupGauges = gauges.filter(g => g.materialType === groupName);
        
        // Block deletion if any gauge in this group is currently in stock
        const hasStock = groupGauges.some(g => getStockInfo(g.materialType, g.gauge).count > 0);
        if (hasStock) {
            alert(`Não é possível excluir o grupo "${groupName}" pois existem lotes em estoque para algumas de suas bitolas. Consuma ou transfira o estoque primeiro.`);
            return;
        }

        const count = groupGauges.length;
        if (!confirm(`⚠️ ATENÇÃO: Deseja realmente excluir o grupo "${groupName}" e TODAS as suas ${count} bitolas?`)) {
            return;
        }
        try {
            for (const g of groupGauges) {
                await onDelete(g.id);
            }
            if (selectedGroup === groupName) {
                setSelectedGroup(dynamicGroups.find(g => g !== groupName) || 'Fio Máquina');
            }
        } catch (err) {
            console.error('Error deleting group:', err);
            alert('Erro ao excluir o grupo.');
        }
    };

    const gaugesByMaterial = useMemo(() => {
        const result: Record<string, StockGauge[]> = {};

        // Push gauges to respective groups
        gauges.forEach(g => {
            const grp = g.materialType || 'Outros';
            if (!result[grp]) {
                result[grp] = [];
            }
            result[grp].push(g);
        });

        // Filter and sort
        Object.keys(result).forEach(group => {
            result[group] = result[group]
                .filter(g => {
                    if (!searchTerm) return true;
                    const searchLower = searchTerm.toLowerCase();
                    return (
                        g.gauge.replace('.', ',').includes(searchLower) ||
                        g.gauge.includes(searchLower) ||
                        (g.productCode || '').toLowerCase().includes(searchLower) ||
                        g.materialType.toLowerCase().includes(searchLower)
                    );
                })
                .sort((a, b) => parseFloat(a.gauge) - parseFloat(b.gauge));
        });

        return result;
    }, [gauges, dynamicGroups, searchTerm]);

    return (
        <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8 animate-fadeIn">
            <div className="max-w-4xl mx-auto space-y-6">
                <header className="flex items-center justify-between pt-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">Gerenciar Bitolas</h1>
                        <p className="text-slate-500 text-sm">Adicione, edite ou remova materiais e bitolas do sistema.</p>
                    </div>
                </header>

                <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                    <div className="p-6 bg-slate-50 border-b border-slate-200">
                        <h2 className="text-lg font-bold text-[#0F3F5C] mb-4 flex items-center gap-2">
                            <PlusIcon className="h-5 w-5 text-blue-600" />
                            Cadastrar Material & Bitola
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">MATERIAL</label>
                                <select
                                    value={isCreatingNewGroup ? '__NEW_GROUP__' : selectedGroup}
                                    onChange={e => {
                                        const val = e.target.value;
                                        if (val === '__NEW_GROUP__') {
                                            setIsCreatingNewGroup(true);
                                        } else {
                                            setIsCreatingNewGroup(false);
                                            setSelectedGroup(val);
                                        }
                                    }}
                                    className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm bg-white font-medium text-slate-700"
                                >
                                    {dynamicGroups.map(m => <option key={m} value={m}>{m}</option>)}
                                    <option value="__NEW_GROUP__" className="text-blue-600 font-bold">+ Cadastrar Novo Material...</option>
                                </select>
                                
                                {isCreatingNewGroup && (
                                    <input
                                        type="text"
                                        value={customGroupName}
                                        onChange={e => setCustomGroupName(e.target.value)}
                                        placeholder="Nome do material (Ex: CA-50)"
                                        className="w-full p-3 mt-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm text-sm"
                                        autoFocus
                                    />
                                )}
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">MÉTRICA E MEDIDA</label>
                                <div className="flex gap-2">
                                    <select
                                        value={metricUnit}
                                        onChange={e => setMetricUnit(e.target.value)}
                                        className="w-1/3 p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm bg-white font-medium text-slate-700"
                                    >
                                        <option value="mm">mm</option>
                                        <option value="kg">kg</option>
                                        <option value="m">m</option>
                                        <option value="barras">barras</option>
                                        <option value="nenhum">-</option>
                                    </select>
                                    <input
                                        type="text"
                                        value={newGauge}
                                        onChange={e => setNewGauge(e.target.value)}
                                        placeholder="Ex: 8.00 ou Barra / 1"
                                        className="w-2/3 p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm font-semibold"
                                        onKeyPress={e => e.key === 'Enter' && handleAdd()}
                                    />
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Cód. Produto (Opcional)</label>
                                <input
                                    type="text"
                                    value={newProductCode}
                                    onChange={e => setNewProductCode(e.target.value)}
                                    placeholder="Ex: CA60-001"
                                    className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                                    onKeyPress={e => e.key === 'Enter' && handleAdd()}
                                />
                            </div>
                            
                            <div className="flex items-end h-full">
                                <button
                                    onClick={handleAdd}
                                    className="w-full bg-[#0F3F5C] hover:bg-[#0A2A3D] text-white font-bold py-3 px-4 rounded-xl shadow-sm transition flex items-center justify-center gap-2"
                                >
                                    <PlusIcon className="h-5 w-5" /> Salvar Material
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="px-6 py-4 bg-white border-b border-slate-100 flex items-center gap-4">
                        <div className="relative w-full">
                            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar por material, bitola ou código de produto..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 outline-none text-sm text-slate-600 font-medium"
                            />
                        </div>
                    </div>

                    <div className="p-6 space-y-8">
                        {Object.keys(gaugesByMaterial).sort().map(group => {
                            const list = gaugesByMaterial[group];
                            const summary = groupStockSummaries[group] || { totalCount: 0, totalWeight: 0 };
                            return (
                                <div key={group} className="space-y-4 p-5 bg-slate-50/50 rounded-2xl border border-slate-200/60 shadow-sm">
                                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <ScaleIcon className="h-5 w-5 text-slate-500" />
                                            <h3 className="text-base font-bold text-slate-800">
                                                {group}
                                            </h3>
                                            <span className="text-[10px] bg-slate-200/80 text-slate-600 px-2 py-0.5 rounded-full font-bold">
                                                {list.length} {list.length === 1 ? 'item' : 'itens'}
                                            </span>
                                            {summary.totalCount > 0 && (
                                                <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full font-extrabold flex items-center gap-1.5">
                                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                                    {summary.totalCount} {summary.totalCount === 1 ? 'lote' : 'lotes'} ({summary.totalWeight.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} kg)
                                                </span>
                                            )}
                                        </div>
                                        
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleRenameGroup(group)}
                                                title="Renomear Material"
                                                className="p-1.5 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-700 transition"
                                            >
                                                <PencilIcon className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteGroup(group)}
                                                title="Excluir Material"
                                                className="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-600 transition"
                                            >
                                                <TrashIcon className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                        {list.map(g => {
                                            const stockInfo = getStockInfo(g.materialType, g.gauge);
                                            return (
                                                <div key={g.id} className="group flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-sm transition-all">
                                                    <div className="flex flex-col flex-grow">
                                                        {editingId === g.id ? (
                                                            <div className="space-y-1.5 p-1">
                                                                <input
                                                                    type="text"
                                                                    value={editingGaugeVal}
                                                                    onChange={e => setEditingGaugeVal(e.target.value)}
                                                                    className="text-xs w-full p-1 border rounded bg-white font-bold"
                                                                    placeholder="Bitola (mm)"
                                                                />
                                                                <input
                                                                    type="text"
                                                                    value={editingCode}
                                                                    onChange={e => setEditingCode(e.target.value)}
                                                                    className="text-[10px] w-full p-1 border rounded bg-white font-bold"
                                                                    placeholder="Cód. Produto"
                                                                    onKeyPress={e => e.key === 'Enter' && handleUpdate(g.id)}
                                                                />
                                                                <div className="flex gap-2 justify-end mt-2">
                                                                    <button onClick={() => setEditingId(null)} className="text-slate-400 hover:bg-slate-100 px-2 py-0.5 rounded text-[10px] font-bold transition">
                                                                        Cancelar
                                                                    </button>
                                                                    <button onClick={() => handleUpdate(g.id)} className="bg-emerald-500 hover:bg-emerald-600 text-white px-2 py-0.5 rounded text-[10px] font-bold transition flex items-center gap-1">
                                                                        Salvar
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <span className="font-bold text-slate-800 text-sm">{g.gauge.replace('.', ',')}</span>
                                                                <span className={`text-[10px] font-bold uppercase ${g.productCode ? 'text-blue-600' : 'text-slate-400 italic'}`}>
                                                                    {g.productCode || 'Sem código'}
                                                                </span>
                                                                
                                                                {stockInfo.count > 0 ? (
                                                                    <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-emerald-700 font-extrabold bg-emerald-50 border border-emerald-100 rounded-lg px-2 py-1 w-fit animate-fadeIn">
                                                                        <span className="relative flex h-1.5 w-1.5 shrink-0">
                                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                                                        </span>
                                                                        <span>
                                                                            {stockInfo.count} {stockInfo.count === 1 ? 'Lote' : 'Lotes'} ({stockInfo.totalWeight.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} kg)
                                                                        </span>
                                                                    </div>
                                                                ) : (
                                                                    <div className="mt-1 text-[10px] text-slate-400 font-semibold bg-slate-100/80 rounded-lg px-2 py-0.5 w-fit">
                                                                        Sem estoque
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                    
                                                    {editingId !== g.id && (
                                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => startEditing(g)}
                                                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                                                title="Editar Bitola / Código"
                                                            >
                                                                <PencilIcon className="h-4 w-4" />
                                                            </button>
                                                            {stockInfo.count > 0 ? (
                                                                <button
                                                                    onClick={() => alert(`Não é possível excluir a medida ${g.gauge.replace('.', ',')} pois existem ${stockInfo.count} lotes em estoque usando ela.`)}
                                                                    className="p-1.5 text-slate-300 cursor-not-allowed rounded-lg transition"
                                                                    title="Não é possível excluir (Em estoque)"
                                                                >
                                                                    <TrashIcon className="h-4 w-4 opacity-50" />
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={() => {
                                                                        if (confirm(`Deseja remover a medida ${g.gauge.replace('.', ',')} para ${group}?`)) {
                                                                            onDelete(g.id);
                                                                        }
                                                                    }}
                                                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                                                                    title="Excluir Bitola"
                                                                >
                                                                    <TrashIcon className="h-4 w-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                        {list.length === 0 && (
                                            <div className="col-span-full py-6 text-center text-slate-400 text-xs italic bg-white rounded-xl border border-dashed border-slate-200">
                                                Nenhuma bitola cadastrada para este material.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="bg-amber-50 rounded-xl p-4 border border-amber-200 shadow-sm">
                    <h3 className="text-amber-800 font-bold text-sm mb-2 flex items-center gap-2">
                        <div className="w-5 h-5 bg-amber-200 rounded-full flex items-center justify-center text-xs">i</div>
                        Dica de Gestão
                    </h3>
                    <p className="text-amber-700 text-xs leading-relaxed">
                        Os materiais e bitolas cadastrados aqui serão exibidos automaticamente em todos os seletores do sistema como opções de matéria-prima disponíveis.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default GaugesManager;
