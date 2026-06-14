import React, { useState, useMemo, useEffect } from 'react';
import type { StockGauge, StockItem } from '../types';
import { TrashIcon, PlusIcon, ScaleIcon, PencilIcon, XIcon, SearchIcon } from './icons';

interface GaugesManagerProps {
    gauges: StockGauge[];
    stock: StockItem[];
    onAdd: (gauge: Omit<StockGauge, 'id'>) => void;
    onDelete: (id: string) => void;
    onUpdate: (id: string, data: Partial<StockGauge>) => void;
}

const GaugesManager: React.FC<GaugesManagerProps> = ({ gauges, stock, onAdd, onDelete, onUpdate }) => {
    // Form fields states
    const [selectedGroup, setSelectedGroup] = useState<string>('Fio Máquina');
    const [customGroupName, setCustomGroupName] = useState('');
    const [isCreatingNewGroup, setIsCreatingNewGroup] = useState(false);
    
    const [metricUnit, setMetricUnit] = useState('mm');
    const [gaugeValue, setGaugeValue] = useState('');
    
    const [productCode, setProductCode] = useState('');
    const [purchasePrice, setPurchasePrice] = useState('');
    const [technicalDescription, setTechnicalDescription] = useState('');
    const [status, setStatus] = useState('Ativo');

    // New fields states for weight configurations
    const [weightPerMeter, setWeightPerMeter] = useState('');
    const [pieceSize, setPieceSize] = useState('');
    const [weightType, setWeightType] = useState('metro'); // 'metro' | 'unid' | 'peso'
    const [weightUnit, setWeightUnit] = useState('kg');     // 'kg' | 'g'
    const [rawWeightValue, setRawWeightValue] = useState('');

    // Auto-calculate weightPerMeter in real-time
    useEffect(() => {
        const raw = parseFloat(rawWeightValue);
        if (isNaN(raw) || raw <= 0) {
            setWeightPerMeter('');
            return;
        }

        // Convert to kg if unit is grams
        const weightInKg = weightUnit === 'g' ? raw / 1000 : raw;

        if (weightType === 'metro') {
            setWeightPerMeter(weightInKg.toString());
        } else if (weightType === 'unid') {
            const size = parseFloat(pieceSize);
            if (!isNaN(size) && size > 0) {
                setWeightPerMeter((weightInKg / size).toString());
            } else {
                setWeightPerMeter('');
            }
        } else if (weightType === 'peso') {
            setWeightPerMeter('1');
        }
    }, [rawWeightValue, weightType, weightUnit, pieceSize]);

    // Force values if weightType is 'peso' (1:1)
    useEffect(() => {
        if (weightType === 'peso') {
            setRawWeightValue('1');
            setWeightUnit('kg');
        }
    }, [weightType]);
    
    // Global actions / editing state
    const [editingId, setEditingId] = useState<string | null>(null);
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

    // Code suggestion auto-generation logic
    useEffect(() => {
        if (editingId) return; // Do not overwrite when editing

        // 1. Scan existing product codes to find the maximum numeric code
        let maxNum = 0;
        gauges.forEach(g => {
            if (g.productCode) {
                // Find any sequence of digits in the product code
                const matches = g.productCode.match(/\d+/g);
                if (matches) {
                    matches.forEach(m => {
                        const num = parseInt(m, 10);
                        if (!isNaN(num) && num > maxNum) {
                            maxNum = num;
                        }
                    });
                }
            }
        });

        // 2. Read from localStorage the maximum sequence number ever generated
        const storedMaxStr = localStorage.getItem('msm_max_product_code');
        if (storedMaxStr) {
            const storedMax = parseInt(storedMaxStr, 10);
            if (!isNaN(storedMax) && storedMax > maxNum) {
                maxNum = storedMax;
            }
        }

        // 3. Generate the next code formatted with 4 digits
        const nextSerial = maxNum + 1;
        const suggested = String(nextSerial).padStart(4, '0');
        
        setProductCode(suggested);
    }, [gauges, editingId]);

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

    // Calculate dynamic stock details
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

    const getStockInfo = (materialType: string, gaugeStr: string) => {
        const groupKey = (materialType || '').trim().toLowerCase();
        const gaugeKey = normalizeGauge(gaugeStr);
        const compositeKey = `${groupKey}::${gaugeKey}`;
        return gaugeStockItems[compositeKey] || { count: 0, totalWeight: 0, items: [] };
    };

    // Dynamic Calculations

    const pricePerMeter = useMemo(() => {
        const price = parseFloat(purchasePrice);
        const wpm = parseFloat(weightPerMeter);
        if (!isNaN(price) && !isNaN(wpm)) {
            return (price * wpm).toFixed(2);
        }
        return '---';
    }, [purchasePrice, weightPerMeter]);

    const metresStatus = useMemo(() => {
        if (metricUnit === 'mts') {
            return `Ativo (1m = ${weightPerMeter || '0'} kg)`;
        }
        if (metricUnit === 'kg') {
            return `Ativo (${weightPerMeter || '0'} kg/m)`;
        }
        return 'Desativado';
    }, [metricUnit, weightPerMeter]);

    const unidStatus = useMemo(() => {
        if (metricUnit === 'unid') {
            const wpm = parseFloat(weightPerMeter);
            const size = parseFloat(pieceSize);
            if (!isNaN(wpm) && !isNaN(size)) {
                return `Ativo (${(wpm * size).toFixed(3)} kg/peça)`;
            }
            return 'Ativo (Tamanho Peça Mts?)';
        }
        return 'Desativado';
    }, [metricUnit, weightPerMeter, pieceSize]);

    // Form resets
    const handleReset = () => {
        setEditingId(null);
        setGaugeValue('');
        setProductCode('');
        setPurchasePrice('');
        setTechnicalDescription('');
        setStatus('Ativo');
        setIsCreatingNewGroup(false);
        setCustomGroupName('');
        setWeightPerMeter('');
        setPieceSize('');
        setWeightType('metro');
        setWeightUnit('kg');
        setRawWeightValue('');
    };

    // Save action
    const handleSave = () => {
        const groupToUse = isCreatingNewGroup ? customGroupName.trim() : selectedGroup;
        if (!groupToUse) {
            alert('Por favor, informe ou selecione o grupo/material.');
            return;
        }

        if (!gaugeValue) {
            alert('Por favor, insira a medida/bitola.');
            return;
        }

        let finalGauge = normalizeGauge(gaugeValue);
        if (metricUnit !== 'nenhum' && !finalGauge.toLowerCase().includes(metricUnit.toLowerCase())) {
            finalGauge = `${finalGauge} ${metricUnit}`;
        }

        const trimmedCode = productCode.trim();
        if (!trimmedCode) {
            alert('O código do produto é obrigatório.');
            return;
        }

        // Check unique code
        const codeExists = gauges.some(g => g.id !== editingId && g.productCode?.toLowerCase() === trimmedCode.toLowerCase());
        if (codeExists) {
            alert('Este código de produto já está em uso. Por favor, informe um código único.');
            return;
        }

        // Check duplicate measure in the group
        const duplicateExists = gauges.some(g => 
            g.id !== editingId && 
            g.materialType.toLowerCase() === groupToUse.toLowerCase() && 
            g.gauge.toLowerCase() === finalGauge.toLowerCase()
        );
        if (duplicateExists) {
            alert('Esta bitola/medida já está cadastrada para este material.');
            return;
        }

        // Store the sequence number in localStorage to prevent reusing if deleted
        const codeNum = parseInt(trimmedCode, 10);
        if (!isNaN(codeNum)) {
            const localMaxStr = localStorage.getItem('msm_max_product_code');
            const currentLocalMax = localMaxStr ? parseInt(localMaxStr, 10) : 0;
            if (codeNum > currentLocalMax) {
                localStorage.setItem('msm_max_product_code', String(codeNum));
            }
        }

        const gaugeData: Partial<StockGauge> = {
            materialType: groupToUse,
            gauge: finalGauge,
            productCode: trimmedCode,
            purchasePrice: purchasePrice ? parseFloat(purchasePrice) : undefined,
            technicalDescription: technicalDescription.trim() || undefined,
            status: status,
            weightPerMeter: weightPerMeter ? parseFloat(weightPerMeter) : undefined,
            pieceSize: pieceSize ? parseFloat(pieceSize) : undefined,
            weightType: weightType,
            weightUnit: weightUnit,
            rawWeightValue: rawWeightValue ? parseFloat(rawWeightValue) : undefined
        };

        if (editingId) {
            onUpdate(editingId, gaugeData);
            alert('Material atualizado com sucesso!');
        } else {
            onAdd(gaugeData as Omit<StockGauge, 'id'>);
            alert('Material cadastrado com sucesso!');
        }

        handleReset();
    };

    // Edit action
    const handleStartEdit = (g: StockGauge) => {
        setEditingId(g.id);
        
        let value = g.gauge;
        let unit = 'mm';
        const units = ['mm', 'mts', 'kg', 'unid', 'BWG'];
        for (const u of units) {
            if (g.gauge.toLowerCase().endsWith(` ${u.toLowerCase()}`)) {
                value = g.gauge.substring(0, g.gauge.length - u.length - 1);
                unit = u;
                break;
            } else if (g.gauge.toLowerCase().endsWith(u.toLowerCase())) {
                value = g.gauge.substring(0, g.gauge.length - u.length);
                unit = u;
                break;
            }
        }
        
        setGaugeValue(value);
        setMetricUnit(unit);
        setProductCode(g.productCode || '');
        setPurchasePrice(g.purchasePrice?.toString() || '');
        setTechnicalDescription(g.technicalDescription || '');
        setStatus(g.status || 'Ativo');
        setWeightPerMeter(g.weightPerMeter?.toString() || '');
        setPieceSize(g.pieceSize?.toString() || '');
        setWeightType(g.weightType || 'metro');
        setWeightUnit(g.weightUnit || 'kg');
        setRawWeightValue(g.rawWeightValue?.toString() || g.weightPerMeter?.toString() || '');
        
        if (dynamicGroups.includes(g.materialType)) {
            setIsCreatingNewGroup(false);
            setSelectedGroup(g.materialType);
        } else {
            setIsCreatingNewGroup(true);
            setCustomGroupName(g.materialType);
        }
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Group-level actions
    const handleRenameGroup = async (oldName: string) => {
        const groupGauges = gauges.filter(g => g.materialType === oldName);
        const hasStock = groupGauges.some(g => getStockInfo(g.materialType, g.gauge).count > 0);
        if (hasStock) {
            alert(`Não é possível renomear o grupo "${oldName}" pois existem lotes em estoque.`);
            return;
        }

        const newName = prompt(`Renomear grupo "${oldName}" para:`, oldName);
        if (!newName || newName.trim() === oldName) return;

        const cleanNewName = newName.trim();
        const alreadyExists = dynamicGroups.some(g => g.toLowerCase() === cleanNewName.toLowerCase() && g !== oldName);
        if (alreadyExists) {
            alert('Já existe um grupo com este nome.');
            return;
        }
        
        try {
            for (const g of groupGauges) {
                await onUpdate(g.id, { materialType: cleanNewName });
            }
            setSelectedGroup(cleanNewName);
            alert('Grupo renomeado com sucesso!');
        } catch (err) {
            console.error('Error renaming group:', err);
            alert('Erro ao renomear o grupo.');
        }
    };

    const handleDeleteGroup = async (groupName: string) => {
        const groupGauges = gauges.filter(g => g.materialType === groupName);
        const hasStock = groupGauges.some(g => getStockInfo(g.materialType, g.gauge).count > 0);
        if (hasStock) {
            alert(`Não é possível excluir o grupo "${groupName}" pois existem lotes em estoque.`);
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
            alert('Grupo excluído com sucesso!');
        } catch (err) {
            console.error('Error deleting group:', err);
            alert('Erro ao excluir o grupo.');
        }
    };

    // Search and filter
    const filteredGauges = useMemo(() => {
        return gauges
            .filter(g => {
                if (!searchTerm) return true;
                const searchLower = searchTerm.toLowerCase();
                return (
                    g.gauge.replace('.', ',').includes(searchLower) ||
                    g.gauge.includes(searchLower) ||
                    (g.productCode || '').toLowerCase().includes(searchLower) ||
                    g.materialType.toLowerCase().includes(searchLower) ||
                    (g.technicalDescription || '').toLowerCase().includes(searchLower)
                );
            })
            .sort((a, b) => {
                const matCompare = a.materialType.localeCompare(b.materialType);
                if (matCompare !== 0) return matCompare;
                return parseFloat(a.gauge) - parseFloat(b.gauge);
            });
    }, [gauges, searchTerm]);

    return (
        <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8 animate-fadeIn">
            <div className="max-w-6xl mx-auto space-y-6">
                <header className="flex items-center justify-between pt-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">Gerenciar Bitolas</h1>
                        <p className="text-slate-500 text-sm">Adicione, edite ou remova materiais e bitolas do sistema.</p>
                    </div>
                </header>

                {/* Form Card */}
                <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                    <div className="p-6 bg-slate-50 border-b border-slate-200">
                        <h2 className="text-lg font-bold text-[#0F3F5C] mb-4 flex items-center gap-2">
                            {editingId ? (
                                <>
                                    <PencilIcon className="h-5 w-5 text-blue-600" />
                                    Editar Material & Bitola
                                </>
                            ) : (
                                <>
                                    <PlusIcon className="h-5 w-5 text-blue-600" />
                                    Cadastrar Material & Bitola
                                </>
                            )}
                        </h2>
                        
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-stretch">
                            {/* Column 1: Identificação */}
                            <div className="flex flex-col space-y-4">
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">MATERIAL</label>
                                        {!isCreatingNewGroup && !editingId && (
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => handleRenameGroup(selectedGroup)}
                                                    title="Renomear Material"
                                                    className="text-slate-400 hover:text-blue-600 transition"
                                                >
                                                    <PencilIcon className="h-3 w-3" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteGroup(selectedGroup)}
                                                    title="Excluir Material"
                                                    className="text-slate-400 hover:text-red-600 transition"
                                                >
                                                    <TrashIcon className="h-3 w-3" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
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
                                        className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm bg-white font-medium text-slate-700 text-sm"
                                    >
                                        {dynamicGroups.map(m => <option key={m} value={m}>{m}</option>)}
                                        <option value="__NEW_GROUP__" className="text-blue-600 font-bold">+ Cadastrar Novo Material...</option>
                                    </select>
                                    
                                    {isCreatingNewGroup && (
                                        <input
                                            type="text"
                                            value={customGroupName}
                                            onChange={e => setCustomGroupName(e.target.value)}
                                            placeholder="Nome do Novo Material (Ex: CA-60)"
                                            className="w-full p-3 mt-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm text-sm"
                                            autoFocus
                                        />
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">CÓD. PRODUTO</label>
                                    <input
                                        type="text"
                                        value={productCode}
                                        onChange={e => setProductCode(e.target.value)}
                                        placeholder="0001"
                                        className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm font-semibold text-sm"
                                    />
                                </div>
                            </div>

                            {/* Column 2: Métricas */}
                            <div className="flex flex-col space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">MÉTRICA E MEDIDA PRINCIPAL</label>
                                    <div className="flex gap-2">
                                        <select
                                            value={metricUnit}
                                            onChange={e => setMetricUnit(e.target.value)}
                                            className="w-1/3 p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm bg-white font-medium text-slate-700 text-sm"
                                        >
                                            <option value="mm">mm</option>
                                            <option value="mts">mts</option>
                                            <option value="kg">kg</option>
                                            <option value="unid">unid</option>
                                            <option value="BWG">BWG</option>
                                            <option value="nenhum">-</option>
                                        </select>
                                        <input
                                            type="text"
                                            value={gaugeValue}
                                            onChange={e => setGaugeValue(e.target.value)}
                                            placeholder="Ex: 8.00 ou B"
                                            className="w-2/3 p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm font-semibold text-sm"
                                        />
                                    </div>
                                </div>

                            </div>

                            {/* Column 3: CONFIGURAÇÃO DE KG */}
                            <div className="bg-slate-100 rounded-2xl p-4 border border-slate-200 flex flex-col justify-between space-y-4">
                                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider text-center border-b border-slate-200 pb-2">
                                    CONFIGURAÇÃO DE KG
                                </h3>

                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">TIPO DE CONTROLE</label>
                                    <select
                                        value={weightType}
                                        onChange={e => setWeightType(e.target.value)}
                                        className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm font-semibold text-sm bg-white text-slate-700"
                                    >
                                        <option value="metro">Por Metro (Mts)</option>
                                        <option value="unid">Por Unidade (Unid)</option>
                                        <option value="peso">Apenas por Peso (Kg)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                        {weightType === 'metro' ? 'PESO POR METRO' : weightType === 'unid' ? 'PESO DA PEÇA' : 'PESO BASE'}
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            value={rawWeightValue}
                                            onChange={e => setRawWeightValue(e.target.value)}
                                            placeholder={weightType === 'metro' ? "Ex: 0.109" : weightType === 'unid' ? "Ex: 5.2" : "Ex: 1.0"}
                                            step="any"
                                            min="0"
                                            disabled={weightType === 'peso'}
                                            className="w-2/3 p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm font-semibold text-sm bg-white disabled:bg-slate-50 disabled:text-slate-400"
                                        />
                                        <select
                                            value={weightUnit}
                                            onChange={e => setWeightUnit(e.target.value)}
                                            disabled={weightType === 'peso'}
                                            className="w-1/3 p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm font-semibold text-sm bg-white text-slate-700 disabled:bg-slate-50 disabled:text-slate-400"
                                        >
                                            <option value="kg">kg</option>
                                            <option value="g">gramas</option>
                                        </select>
                                    </div>
                                </div>

                                {weightType === 'unid' && (
                                    <div className="animate-fadeIn">
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">TAMANHO DA PEÇA (MTS)</label>
                                        <input
                                            type="number"
                                            value={pieceSize}
                                            onChange={e => setPieceSize(e.target.value)}
                                            placeholder="Ex: 12.0"
                                            step="any"
                                            min="0"
                                            className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm font-semibold text-sm bg-white"
                                        />
                                    </div>
                                )}

                                <div className="text-[10px] text-slate-500 font-semibold space-y-1 bg-white/50 p-2 rounded-xl border border-slate-200">
                                    <span className="block">
                                        Status de Conversão:
                                    </span>
                                    <span className="block text-slate-600 font-bold">
                                        Calculado: {parseFloat(weightPerMeter) ? `${parseFloat(weightPerMeter).toFixed(4)} kg/m` : '---'}
                                    </span>
                                </div>
                            </div>

                            {/* Column 4: Preço & Ações */}
                            <div className="flex flex-col justify-between space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">PREÇO DE COMPRA (KG)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">R$</span>
                                        <input
                                            type="number"
                                            value={purchasePrice}
                                            onChange={e => setPurchasePrice(e.target.value)}
                                            placeholder="0,00"
                                            step="0.01"
                                            min="0"
                                            className="w-full p-3 pl-9 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm font-semibold text-sm"
                                        />
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-semibold mt-1.5 block">
                                        (R$ {pricePerMeter} / Mts)
                                    </span>
                                </div>

                                {editingId && (
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">STATUS</label>
                                        <select
                                            value={status}
                                            onChange={e => setStatus(e.target.value)}
                                            className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm bg-white font-bold text-slate-700 text-sm"
                                        >
                                            <option value="Ativo">Ativo</option>
                                            <option value="Inativo">Inativo</option>
                                        </select>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">BOTÕES AÇÃO</label>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleReset}
                                            className="flex-grow bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold py-3.5 px-3 rounded-xl shadow-sm transition text-xs flex items-center justify-center gap-1.5"
                                        >
                                            <XIcon className="h-4 w-4" /> Novo Cadastro
                                        </button>
                                        <button
                                            onClick={handleSave}
                                            className="bg-[#0F3F5C] hover:bg-[#0A2A3D] text-white font-bold p-3.5 rounded-xl shadow-sm transition flex items-center justify-center w-14 border border-transparent"
                                            title={editingId ? 'Salvar Alterações' : 'Salvar Material'}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Row 2: Technical Description */}
                        <div className="mt-4 pt-4 border-t border-slate-200">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">DESCRIÇÃO TÉCNICA DO PRODUTO</label>
                            <textarea
                                value={technicalDescription}
                                onChange={e => setTechnicalDescription(e.target.value)}
                                placeholder="Descreva as especificações técnicas, padrões de qualidade ou observações do produto..."
                                rows={2}
                                className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm text-sm"
                            />
                        </div>
                    </div>
                </div>

                {/* Search and List Section */}
                <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center gap-4">
                        <div className="relative w-full">
                            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar por material, bitola ou código de produto..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 outline-none text-sm text-slate-600 font-medium bg-transparent"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-slate-700">
                            <thead>
                                <tr className="bg-slate-50/70 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                                    <th className="p-4">Cód. Produto</th>
                                    <th className="p-4">Material</th>
                                    <th className="p-4">Bitola</th>
                                    <th className="p-4">Preço (kg)</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4 text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-sm">
                                {filteredGauges.map(g => {
                                    const stockInfo = getStockInfo(g.materialType, g.gauge);
                                    const hasStock = stockInfo.count > 0;
                                    
                                    // Parse value and unit for display
                                    const parts = g.gauge.split(' ');
                                    const displayValue = parts[0].replace('.', ',');
                                    const displayUnit = parts[1] || 'mm';
                                    
                                    return (
                                        <tr key={g.id} className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="p-4 font-semibold text-slate-900">
                                                <div className="flex flex-col">
                                                    <span className={g.productCode ? 'text-blue-600 font-mono font-bold' : 'text-slate-400 italic'}>
                                                        {g.productCode || 'Sem código'}
                                                    </span>
                                                    {g.technicalDescription && (
                                                        <span className="text-[10px] text-slate-400 font-normal line-clamp-1 max-w-[250px]" title={g.technicalDescription}>
                                                            {g.technicalDescription}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-slate-800">{g.materialType}</span>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-800">{displayValue} {displayUnit}</span>
                                                    {g.weightPerMeter && (
                                                        <span className="text-[10px] text-slate-500 font-semibold">Peso/m: {g.weightPerMeter} kg/m</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4 font-bold text-slate-800">
                                                {g.purchasePrice ? `R$ ${g.purchasePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full border ${
                                                        g.status === 'Inativo'
                                                            ? 'bg-slate-100 text-slate-500 border-slate-200'
                                                            : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                                    }`}>
                                                        {g.status || 'Ativo'}
                                                    </span>
                                                    {hasStock && (
                                                        <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full font-extrabold flex items-center gap-1 animate-fadeIn">
                                                            <span className="h-1 w-1 rounded-full bg-emerald-500"></span>
                                                            {stockInfo.count} Lote(s) ({stockInfo.totalWeight.toLocaleString('pt-BR')} kg)
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => handleStartEdit(g)}
                                                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                                        title="Editar"
                                                    >
                                                        <PencilIcon className="h-4 w-4" />
                                                    </button>
                                                    {hasStock ? (
                                                        <button
                                                            onClick={() => alert(`Não é possível excluir pois existem lotes em estoque usando esta bitola.`)}
                                                            className="p-1.5 text-slate-300 cursor-not-allowed rounded-lg"
                                                            title="Em estoque (bloqueado)"
                                                        >
                                                            <TrashIcon className="h-4 w-4 opacity-50" />
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => {
                                                                if (confirm(`Deseja realmente excluir a bitola ${g.gauge} do material ${g.materialType}?`)) {
                                                                    onDelete(g.id);
                                                                }
                                                            }}
                                                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                                                            title="Excluir"
                                                        >
                                                            <TrashIcon className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredGauges.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="p-8 text-center text-slate-400 italic">
                                            Nenhum material ou bitola cadastrada que corresponda à busca.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Info Card */}
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
