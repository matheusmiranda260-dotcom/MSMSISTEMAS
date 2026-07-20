// FinishedConferencesModal.tsx
import React, { useState, useEffect } from 'react';
import type { ConferenceData, ConferenceLotData, StockItem, Bitola, MaterialType, StockGauge } from '../types';
import { MaterialOptions, FioMaquinaBitolaOptions, CA60BitolaOptions, SteelTypeOptions } from '../types';
import { PrinterIcon, PencilIcon, TrashIcon, WarningIcon } from './icons';

const calculateTheoreticalWeight = (gauge: StockGauge | undefined, qtyPackages: number) => {
    if (!gauge) return 0;
    const type = gauge.packagingType || 'granel';
    const qtyPerPack = gauge.qtyPerPackaging || 1;
    const size = gauge.pieceSize || 0;
    const wpm = gauge.weightPerMeter || 0;
    
    if (type === 'rolo') {
        return Number((qtyPackages * (gauge.rawWeightValue || 2000)).toFixed(2));
    }
    if (type === 'pacote') {
        return Number((qtyPackages * qtyPerPack * size * wpm).toFixed(2));
    }
    if (type === 'barra') {
        return Number((qtyPackages * size * wpm).toFixed(2));
    }
    return 0;
};

const getStandardizedGaugeKey = (gaugeStr: string) => {
    if (!gaugeStr) return '';
    const clean = gaugeStr.trim().replace(',', '.');
    const match = clean.match(/^([\d.]+)\s*(.*)$/);
    if (match) {
        const num = parseFloat(match[1]);
        if (!isNaN(num)) {
            const unit = match[2].trim().toLowerCase() || 'mm';
            return `${num.toFixed(2)} ${unit}`;
        }
    }
    return clean.toLowerCase();
};

interface FinishedConferencesModalProps {
    conferences: ConferenceData[];
    stock: StockItem[];
    onClose: () => void;
    onShowReport: (conference: ConferenceData) => void;
    onEditConference: (conferenceNumber: string, updatedData: ConferenceData) => void;
    onDeleteConference: (conferenceNumber: string) => void;
    gauges: StockGauge[];
}

// ---------- Edit Conference Modal ----------
const EditConferenceModal: React.FC<{
    conference: ConferenceData;
    stock: StockItem[];
    gauges: StockGauge[];
    conferences: ConferenceData[];
    onClose: () => void;
    onSubmit: (updatedData: ConferenceData) => void;
}> = ({ conference, stock, gauges, conferences, onClose, onSubmit }) => {
    const [formData, setFormData] = useState<ConferenceData>(() => {
        const lots = conference.lots?.map(l => ({
            ...l,
            labelWeightInput: l.labelWeight !== undefined && l.labelWeight !== null ? String(l.labelWeight).replace('.', ',') : ''
        })) || [];
        return { ...conference, lots };
    });
    const [duplicateErrors, setDuplicateErrors] = useState<Record<number, string>>({});
    const [showManualInput, setShowManualInput] = useState<Record<number, boolean>>({});

    // all bitola options (both machine types)
    const allBitolaOptions: Bitola[] = [...new Set<string>(gauges.map(g => g.gauge))];

    const checkIfAutoGenerate = (materialType: string, bitola: string) => {
        const g = gauges.find(x => x.materialType === materialType && x.gauge === bitola);
        return !!g?.autoGenerateLot;
    };

    // Validate duplicate lot combinations
    useEffect(() => {
        const newErrors: Record<number, string> = {};
        const existingInternalLots = new Set(
            stock
                .filter(item => !formData.lots.some(lot =>
                    item.internalLot === lot.internalLot &&
                    item.conferenceNumber === conference.conferenceNumber))
                .map(item => item.internalLot.trim().toLowerCase())
        );
        const currentKeys = new Set<string>();
        formData.lots.forEach((lot, idx) => {
            if (checkIfAutoGenerate(lot.materialType || '', lot.bitola || '')) return;
            if (!lot.internalLot) return;
            const key = lot.internalLot.trim().toLowerCase();
            if (existingInternalLots.has(key)) {
                newErrors[idx] = 'Este lote já existe no estoque.';
            } else if (currentKeys.has(key)) {
                newErrors[idx] = 'Lote duplicado nesta conferência.';
            }
            currentKeys.add(key);
        });
        setDuplicateErrors(newErrors);
    }, [formData.lots, stock, conference.conferenceNumber]);

    const handleAddLot = () => {
        const dynamicMaterialOptions = Array.from(new Set(gauges.map(g => g.materialType))).filter(Boolean) as string[];
        const sortedMaterialOptions = dynamicMaterialOptions.sort();
        const defaultMaterial = sortedMaterialOptions[0] || '';
        const fmGauges = gauges.filter(g => g.materialType === defaultMaterial).map(g => g.gauge);
        const defaultBitola = fmGauges[0] || '';

        // Find default steel type if configured
        const defaultGauge = gauges.find(g => g.materialType === defaultMaterial && g.gauge === defaultBitola);
        const defaultSteel = defaultGauge && (defaultGauge.customFieldLabel || defaultGauge.defaultSteelType)
            ? (defaultGauge.customFieldValue || defaultGauge.defaultSteelType || '')
            : '';
        
        const packagingType = defaultGauge?.packagingType || 'granel';
        const qtyPerPackaging = defaultGauge?.qtyPerPackaging || 1;
        const pieceSize = defaultGauge?.pieceSize || 0;
        const qtyPackages = packagingType !== 'granel' ? 1 : undefined;
        const totalPieces = packagingType === 'pacote' ? (defaultGauge?.qtyPerPackaging || 200) : (qtyPackages || 1);
        const labelWeight = defaultGauge ? calculateTheoreticalWeight(defaultGauge, qtyPackages || 1) : 0;

        setFormData(prev => ({
            ...prev,
            lots: [...prev.lots, {
                internalLot: '',
                runNumber: '',
                bitola: defaultBitola,
                materialType: defaultMaterial as MaterialType,
                labelWeight: labelWeight,
                labelWeightInput: labelWeight ? String(labelWeight).replace('.', ',') : '0',
                steelType: defaultSteel,
                packagingType,
                qtyPerPackaging,
                pieceSize,
                qtyPackages,
                totalPieces
            }],
        }));
    };

    const handleLotChange = (index: number, field: keyof ConferenceLotData, value: string | number) => {
        setFormData(prev => {
            const newLots = [...prev.lots];
            (newLots[index] as any)[field] = value;

            if (field === 'materialType') {
                const applicable = gauges.filter(g => g.materialType === value).map(g => g.gauge);
                if (!applicable.includes(newLots[index].bitola)) {
                    newLots[index].bitola = applicable[0] || '';
                }
            }

            // Auto-populate default steel type and packaging if configured
            const currentMaterial = newLots[index].materialType;
            const currentBitola = newLots[index].bitola;
            if (currentMaterial && currentBitola) {
                const targetGauge = gauges.find(g => g.materialType === currentMaterial && getStandardizedGaugeKey(g.gauge) === getStandardizedGaugeKey(currentBitola));
                if (targetGauge) {
                    if (field === 'materialType' || field === 'bitola') {
                        if (targetGauge.customFieldLabel || targetGauge.defaultSteelType) {
                            newLots[index].steelType = targetGauge.customFieldValue || targetGauge.defaultSteelType || '';
                        } else {
                            newLots[index].steelType = '';
                        }
                    }

                    if (field === 'materialType' || field === 'bitola' || field === 'qtyPackages') {
                        newLots[index].packagingType = targetGauge.packagingType || 'granel';
                        newLots[index].qtyPerPackaging = targetGauge.qtyPerPackaging || 1;
                        newLots[index].pieceSize = targetGauge.pieceSize || 0;

                        const qtyPack = field === 'qtyPackages' ? (Number(value) || 0) : (newLots[index].qtyPackages || 1);
                        if (field !== 'qtyPackages' && !newLots[index].qtyPackages) {
                            newLots[index].qtyPackages = 1;
                        }

                        newLots[index].totalPieces = newLots[index].packagingType === 'pacote' 
                            ? (targetGauge.qtyPerPackaging || 200) * qtyPack 
                            : qtyPack;

                        const defaultWeight = calculateTheoreticalWeight(targetGauge, qtyPack);
                        if (defaultWeight > 0) {
                            newLots[index].labelWeight = defaultWeight;
                            newLots[index].labelWeightInput = String(defaultWeight).replace('.', ',');
                        } else {
                            newLots[index].labelWeight = 0;
                            newLots[index].labelWeightInput = '0';
                        }
                    }
                }
            }

            return { ...prev, lots: newLots };
        });
    };

    const handleRemoveLot = (index: number) => {
        setFormData(prev => ({
            ...prev,
            lots: prev.lots.filter((_, i) => i !== index),
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Find the highest existing numeric lot number in stock (excluding items from the current conference) and conferences
        let maxLotNum = 0;
        stock.forEach(item => {
            if (item.conferenceNumber !== conference.conferenceNumber) {
                const num = parseInt(item.internalLot.replace(/\D/g, '')) || 0;
                if (num > maxLotNum) maxLotNum = num;
            }
        });
        conferences.forEach(c => {
            if (c.conferenceNumber !== conference.conferenceNumber) {
                c.lots?.forEach(l => {
                    const num = parseInt(l.internalLot.replace(/\D/g, '')) || 0;
                    if (num > maxLotNum) maxLotNum = num;
                });
            }
        });

        // Also check if any existing lots in the form already have a numeric lot number to not overwrite them
        formData.lots.forEach(l => {
            const num = parseInt(l.internalLot.replace(/\D/g, '')) || 0;
            if (num > maxLotNum) maxLotNum = num;
        });

        // Assign automatic lot numbers for empty lots configured as auto-generate
        const updatedLots = formData.lots.map(l => {
            const isAuto = checkIfAutoGenerate(l.materialType || '', l.bitola || '');
            if (isAuto && !l.internalLot) {
                maxLotNum += 1;
                return {
                    ...l,
                    internalLot: String(maxLotNum).padStart(4, '0')
                };
            }
            return l;
        });

        // Re-run validation on the updated lots
        const newErrors: Record<number, string> = {};
        const existingInternalLots = new Set(
            stock
                .filter(item => !formData.lots.some(lot =>
                    item.internalLot === lot.internalLot &&
                    item.conferenceNumber === conference.conferenceNumber))
                .map(item => item.internalLot.trim().toLowerCase())
        );
        const currentKeys = new Set<string>();
        let hasErrors = false;

        updatedLots.forEach((lot, idx) => {
            if (!lot.internalLot) {
                newErrors[idx] = 'O lote interno é obrigatório.';
                hasErrors = true;
                return;
            }
            const key = lot.internalLot.trim().toLowerCase();
            if (existingInternalLots.has(key)) {
                newErrors[idx] = 'Este lote já existe no estoque.';
                hasErrors = true;
            } else if (currentKeys.has(key)) {
                newErrors[idx] = 'Lote duplicado nesta conferência.';
                hasErrors = true;
            }
            currentKeys.add(key);
        });

        if (hasErrors) {
            setDuplicateErrors(newErrors);
            alert('Existem lotes inválidos ou duplicados. Corrija-os antes de continuar.');
            return;
        }

        if (updatedLots.length === 0) {
            alert('A conferência deve ter ao menos um lote.');
            return;
        }

        const finalData = { ...formData, lots: updatedLots };
        onSubmit(finalData);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[70] p-4">
            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-xl w-full max-w-6xl max-h-[95vh] flex flex-col">
                <h2 className="text-2xl font-bold text-slate-800 mb-4 border-b pb-4">Editar Conferência: {conference.conferenceNumber}</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 p-4 bg-slate-50 rounded-lg border">
                    <div className="text-center">
                        <label className="block text-sm font-medium mb-1">Data Entrada</label>
                        <input type="date" value={formData.entryDate} onChange={e => setFormData({ ...formData, entryDate: e.target.value })} className="w-full p-2 border border-slate-300 rounded text-center" required />
                    </div>
                    <div className="text-center">
                        <label className="block text-sm font-medium mb-1">Fornecedor</label>
                        <input type="text" value={formData.supplier} onChange={e => setFormData({ ...formData, supplier: e.target.value })} className="w-full p-2 border border-slate-300 rounded text-center" required />
                    </div>
                    <div className="text-center">
                        <label className="block text-sm font-medium mb-1">Nota Fiscal (NFe)</label>
                        <input type="text" value={formData.nfe} onChange={e => setFormData({ ...formData, nfe: e.target.value })} className="w-full p-2 border border-slate-300 rounded text-center" required />
                    </div>
                    <div className="text-center">
                        <label className="block text-sm font-medium mb-1">Nº Conferência</label>
                        <input type="text" value={formData.conferenceNumber} disabled className="w-full p-2 border border-slate-300 rounded bg-slate-100 text-center" />
                    </div>
                </div>
                <div className="flex-grow overflow-y-auto border rounded-lg">
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-slate-100 z-10">
                            <tr>
                                {['Lote Interno', 'Especificações', 'Corrida', 'Tipo Material', 'Bitola', 'Embalagem', 'Peso Etiqueta (kg)', ''].map(h => {
                                    let displayHeader = h;
                                    if (h === 'Especificações') {
                                        const customLabels = formData.lots
                                            .map(lot => {
                                                const g = gauges.find(x => x.materialType === lot.materialType && x.gauge === lot.bitola);
                                                const lbl = g?.customFieldLabel;
                                                return lbl === 'Tipo de Aço' ? 'Especificações' : lbl;
                                            })
                                            .filter(Boolean) as string[];
                                        
                                        if (customLabels.length > 0) {
                                            const unique = Array.from(new Set(customLabels));
                                            displayHeader = unique.length === 1 ? unique[0] : 'Info. Adicional';
                                        }
                                    }
                                    return (
                                        <th key={h} className="p-2 text-center font-semibold text-slate-600 space-nowrap whitespace-nowrap">{displayHeader}</th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {formData.lots.map((lot, idx) => (
                                <tr key={idx} className="border-b">
                                    <td className="p-2">
                                        {checkIfAutoGenerate(lot.materialType || '', lot.bitola || '') ? (
                                            <input
                                                type="text"
                                                value={lot.internalLot || '(Gerado Automático)'}
                                                disabled
                                                className="w-full p-2 border border-slate-300 rounded text-center bg-slate-100 text-slate-500 font-semibold italic"
                                            />
                                        ) : (
                                            <input
                                                type="text"
                                                value={lot.internalLot}
                                                onChange={e => handleLotChange(idx, 'internalLot', e.target.value)}
                                                className="w-full p-2 border border-slate-300 rounded text-center"
                                                required
                                            />
                                        )}
                                        {duplicateErrors[idx] && <p className="text-red-500 text-xs mt-1 text-center">{duplicateErrors[idx]}</p>}
                                    </td>
                                    <td className="p-2">
                                        {(() => {
                                            const g = gauges.find(x => x.materialType === lot.materialType && getStandardizedGaugeKey(x.gauge) === getStandardizedGaugeKey(lot.bitola));
                                            const hasCustom = g && (g.customFieldLabel || g.defaultSteelType);
                                            const options = g?.customFieldOptions
                                                ? g.customFieldOptions.split(/[,;\-]+/).map(o => o.trim()).filter(Boolean)
                                                : [];
                                            
                                            if (hasCustom) {
                                                const isManual = showManualInput[idx] || (!!lot.steelType && !options.includes(lot.steelType));
                                                if (options.length > 0 && !isManual) {
                                                    return (
                                                        <select
                                                            value={lot.steelType || ''}
                                                            onChange={e => {
                                                                const val = e.target.value;
                                                                if (val === '__MANUAL__') {
                                                                    setShowManualInput(prev => ({ ...prev, [idx]: true }));
                                                                    handleLotChange(idx, 'steelType', '');
                                                                } else {
                                                                    handleLotChange(idx, 'steelType', val);
                                                                }
                                                            }}
                                                            className="w-full p-2 border border-slate-300 rounded text-center bg-white text-slate-700"
                                                            required
                                                        >
                                                            <option value="">Selecione...</option>
                                                            {options.map(opt => (
                                                                <option key={opt} value={opt}>{opt}</option>
                                                            ))}
                                                            <option value="__MANUAL__">Outro (Digitar)...</option>
                                                        </select>
                                                    );
                                                }
                                                return (
                                                    <div className="flex items-center gap-1">
                                                        <input
                                                            type="text"
                                                            value={lot.steelType || ''}
                                                            onChange={e => handleLotChange(idx, 'steelType', e.target.value)}
                                                            placeholder={(g.customFieldLabel === 'Tipo de Aço' ? 'Especificações' : g.customFieldLabel) || 'Especificações'}
                                                            className="w-full p-2 border border-slate-300 rounded text-center bg-white"
                                                            required
                                                        />
                                                        {options.length > 0 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setShowManualInput(prev => ({ ...prev, [idx]: false }));
                                                                    handleLotChange(idx, 'steelType', options[0]);
                                                                }}
                                                                className="px-1 text-slate-400 hover:text-slate-600 text-xs font-bold"
                                                                title="Voltar para seleção"
                                                            >
                                                                Listar
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            } else {
                                                return (
                                                    <input
                                                        type="text"
                                                        value={lot.steelType || ''}
                                                        onChange={e => handleLotChange(idx, 'steelType', e.target.value)}
                                                        placeholder="-"
                                                        className="w-full p-2 border border-slate-300 rounded text-center bg-white"
                                                    />
                                                );
                                            }
                                        })()}
                                    </td>
                                    <td className="p-2">
                                        <input type="text" value={lot.runNumber} onChange={e => handleLotChange(idx, 'runNumber', e.target.value)} className="w-full p-2 border border-slate-300 rounded text-center" required />
                                    </td>
                                    <td className="p-2">
                                        <select value={lot.materialType} onChange={e => handleLotChange(idx, 'materialType', e.target.value)} className="w-full p-2 border border-slate-300 rounded bg-white text-center">
                                            {(() => {
                                                const dynamicMaterialOptions = Array.from(new Set(gauges.map(g => g.materialType))).filter(Boolean) as string[];
                                                return dynamicMaterialOptions.sort().map(m => (<option key={m} value={m}>{m}</option>));
                                            })()}
                                        </select>
                                    </td>
                                    <td className="p-2">
                                        {(() => {
                                            const customGauges = gauges.filter(g => g.materialType === lot.materialType);
                                            const matchingGauge = customGauges.find(g => getStandardizedGaugeKey(g.gauge) === getStandardizedGaugeKey(lot.bitola));
                                            const selectValue = matchingGauge ? matchingGauge.gauge : lot.bitola;

                                            const allOptions = customGauges.map(g => ({ gauge: g.gauge, code: g.productCode }));
  
                                            const map = new Map();
                                            allOptions.forEach(opt => {
                                                const stdKey = getStandardizedGaugeKey(opt.gauge);
                                                const existing = map.get(stdKey);
                                                if (!existing || (opt.code && !existing.code)) {
                                                    map.set(stdKey, opt);
                                                }
                                            });
  
                                            const uniqueOptions = Array.from(map.values())
                                                .sort((a, b) => parseFloat(a.gauge.replace(',', '.')) - parseFloat(b.gauge.replace(',', '.')));

                                            return (
                                                <select 
                                                    value={selectValue} 
                                                    onChange={e => handleLotChange(idx, 'bitola', e.target.value)} 
                                                    className="w-full p-2 border border-slate-300 rounded bg-white text-center text-slate-700"
                                                >
                                                    {uniqueOptions.map(opt => (
                                                        <option key={`${opt.gauge}-${opt.code}`} value={opt.gauge}>
                                                            {opt.gauge.replace('.', ',')} {opt.code ? `(${opt.code})` : ''}
                                                        </option>
                                                    ))}
                                                </select>
                                            );
                                        })()}
                                    </td>
                                    <td className="p-2">
                                        {(() => {
                                            const g = gauges.find(x => x.materialType === lot.materialType && x.gauge === lot.bitola);
                                            const hasPackaging = g && g.packagingType && g.packagingType !== 'granel';
                                            
                                            if (hasPackaging) {
                                                const packName = g.packagingType === 'rolo' ? 'Rolo' : g.packagingType === 'pacote' ? 'Pacote' : 'Barra';
                                                const descText = g.packagingType === 'pacote' 
                                                    ? `${g.qtyPerPackaging || 200} un x ${g.pieceSize || 6}m`
                                                    : g.packagingType === 'barra'
                                                    ? `${g.pieceSize || 6}m`
                                                    : `~${g.rawWeightValue || 2000}kg`;
                                                
                                                return (
                                                    <div className="flex flex-col items-center">
                                                        <div className="flex items-center gap-1 justify-center">
                                                            <input
                                                                type="number"
                                                                value={lot.qtyPackages || 1}
                                                                onChange={e => {
                                                                    const val = Math.max(1, parseInt(e.target.value) || 1);
                                                                    handleLotChange(idx, 'qtyPackages', val);
                                                                }}
                                                                className="w-16 p-1 border rounded text-center font-bold"
                                                                min="1"
                                                                required
                                                            />
                                                            <span className="text-xs font-semibold text-slate-700">{packName}s</span>
                                                        </div>
                                                        <span className="text-[10px] text-slate-500 font-bold mt-1">({descText})</span>
                                                    </div>
                                                );
                                            } else {
                                                return (
                                                    <input
                                                        type="text"
                                                        value="-"
                                                        disabled
                                                        className="w-full p-2 border rounded text-center bg-slate-100 text-slate-500 font-semibold cursor-not-allowed"
                                                    />
                                                );
                                            }
                                        })()}
                                    </td>
                                    <td className="p-2">
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            value={lot.labelWeightInput !== undefined ? lot.labelWeightInput : (lot.labelWeight || '')}
                                            onChange={e => {
                                                const val = e.target.value.replace(/[^0-9.,]/g, '');
                                                const normalized = val.replace(',', '.');
                                                const parsed = parseFloat(normalized);
                                                handleLotChange(idx, 'labelWeight', isNaN(parsed) ? 0 : parsed);
                                                handleLotChange(idx, 'labelWeightInput', val);
                                            }}
                                            className="w-full p-2 border border-slate-300 rounded no-spinner text-center"
                                            required
                                        />
                                    </td>
                                    <td className="p-2 text-center">
                                        <button type="button" onClick={() => handleRemoveLot(idx)} className="p-1 text-red-500 hover:text-red-700">
                                            <TrashIcon className="h-5 w-5" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <button type="button" onClick={handleAddLot} className="text-slate-600 hover:text-slate-800 font-semibold py-2 mt-2 self-start">+ Adicionar outro lote</button>
                <div className="flex justify-end gap-4 mt-4 pt-4 border-t">
                    <button type="button" onClick={onClose} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-4 rounded-lg transition">Cancelar</button>
                    <button type="submit" className="bg-[#0F3F5C] text-white font-bold py-2 px-4 rounded-lg hover:bg-[#0A2A3D] transition">Salvar Alterações</button>
                </div>
            </form>
        </div>
    );
};

// ---------- Finished Conferences Modal ----------
const FinishedConferencesModal: React.FC<FinishedConferencesModalProps> = ({ conferences, stock, onClose, onShowReport, onEditConference, onDeleteConference, gauges }) => {
    const [expandedConferenceId, setExpandedConferenceId] = useState<string | null>(null);
    const [editingConference, setEditingConference] = useState<ConferenceData | null>(null);
    const [deletingConference, setDeletingConference] = useState<ConferenceData | null>(null);

    // Reconstruct lots from stock_items for conferences that don't have lots populated
    const conferencesWithLots = conferences.map(conf => {
        if (conf.lots && conf.lots.length > 0) return conf;
        // Rebuild lots from stock_items
        const stockItems = stock.filter(s => {
            const confNum = conf.conferenceNumber || (conf as any).conferencenumber || (conf as any).conference_number;
            const stockConfNum = s.conferenceNumber || (s as any).conferencenumber || (s as any).conference_number;
            return confNum && stockConfNum && String(stockConfNum) === String(confNum);
        });
        const dynamicMaterialOptions = Array.from(new Set(gauges.map(g => g.materialType))).filter(Boolean) as string[];
        const defaultMaterial = dynamicMaterialOptions.sort()[0] || '';

        const lots: ConferenceLotData[] = stockItems.map(s => ({
            internalLot: s.internalLot || '',
            runNumber: s.runNumber || '',
            steelType: s.steelType || '',
            bitola: s.bitola || '',
            materialType: s.materialType || defaultMaterial,
            labelWeight: Number(s.labelWeight) || 0,
            supplier: s.supplier || conf.supplier || '',
            packagingType: s.packagingType || 'granel',
            qtyPerPackaging: s.qtyPerPackaging || 1,
            pieceSize: s.pieceSize || 0,
            qtyPackages: s.qtyPackages || 1,
            totalPieces: s.totalPieces || 1
        }));
        return { ...conf, lots };
    });

    const toggleExpand = (conferenceNumber: string) => {
        setExpandedConferenceId(prev => (prev === conferenceNumber ? null : conferenceNumber));
    };

    const handleEdit = (conf: ConferenceData) => setEditingConference(conf);
    const handleEditSubmit = (updated: ConferenceData) => {
        onEditConference(updated.conferenceNumber, updated);
        setEditingConference(null);
    };
    const handleDeleteConfirm = () => {
        if (deletingConference) {
            onDeleteConference(deletingConference.conferenceNumber);
            setDeletingConference(null);
        }
    };

    return (
        <>
            {editingConference && (
                <EditConferenceModal conference={editingConference} stock={stock} gauges={gauges} conferences={conferences} onClose={() => setEditingConference(null)} onSubmit={handleEditSubmit} />
            )}
            {deletingConference && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70]">
                    <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-md text-center">
                        <WarningIcon className="h-16 w-16 mx-auto text-red-500 mb-4" />
                        <p className="text-lg text-slate-700 mb-6">Tem certeza que deseja excluir a conferência <strong>{deletingConference.conferenceNumber}</strong>? Todos os lotes associados serão removidos do estoque.</p>
                        <div className="flex justify-center gap-4">
                            <button onClick={() => setDeletingConference(null)} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-6 rounded-lg transition">Cancelar</button>
                            <button onClick={handleDeleteConfirm} className="bg-red-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-red-700 transition">Confirmar Exclusão</button>
                        </div>
                    </div>
                </div>
            )}
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
                <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-7xl max-h-[90vh] flex flex-col">
                    <div className="flex justify-between items-center border-b pb-4 mb-4">
                        <h2 className="text-2xl font-bold text-slate-800">Histórico de Conferências Finalizadas</h2>
                        <button onClick={onClose} className="text-slate-500 hover:text-slate-800 text-3xl">&times;</button>
                    </div>
                    <div className="flex-grow overflow-y-auto pr-2">
                        {conferencesWithLots.length > 0 ? (
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-left sticky top-0">
                                    <tr>
                                        <th className="p-3 font-semibold text-slate-600">Data</th>
                                        <th className="p-3 font-semibold text-slate-600">Nº Conferência</th>
                                        <th className="p-3 font-semibold text-slate-600">Fornecedor</th>
                                        <th className="p-3 font-semibold text-slate-600">Nota Fiscal</th>
                                        <th className="p-3 font-semibold text-slate-600 text-center">Nº Lotes</th>
                                        <th className="p-3 font-semibold text-slate-600 text-center">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {conferencesWithLots.map(conf => {
                                        const lots = conf.lots || [];
                                        return (
                                            <React.Fragment key={conf.conferenceNumber}>
                                                <tr className="hover:bg-slate-50">
                                                    <td className="p-3">{new Date(conf.entryDate).toLocaleDateString('pt-BR')}</td>
                                                    <td className="p-3 font-medium">{conf.conferenceNumber}</td>
                                                    <td className="p-3">{conf.supplier}</td>
                                                    <td className="p-3">{conf.nfe}</td>
                                                    <td className="p-3 text-center">{lots.length}</td>
                                                    <td className="p-3 text-center">
                                                        <div className="flex justify-center gap-3">
                                                            <button onClick={() => { onShowReport(conf); onClose(); }} className="text-emerald-600 hover:underline text-xs font-semibold flex items-center gap-1" title="Reimprimir Relatório">
                                                                <PrinterIcon className="h-4 w-4" />
                                                                <span>Reimprimir</span>
                                                            </button>
                                                            <button onClick={() => handleEdit(conf)} className="text-[#0F3F5C] hover:underline text-xs font-semibold flex items-center gap-1" title="Editar Conferência">
                                                                <PencilIcon className="h-4 w-4" />
                                                                <span>Editar</span>
                                                            </button>
                                                            <button onClick={() => setDeletingConference(conf)} className="text-red-600 hover:underline text-xs font-semibold flex items-center gap-1" title="Excluir Conferência">
                                                                <TrashIcon className="h-4 w-4" />
                                                                <span>Excluir</span>
                                                            </button>
                                                            <button onClick={() => toggleExpand(conf.conferenceNumber)} className="text-slate-600 hover:underline text-xs font-semibold">
                                                                {expandedConferenceId === conf.conferenceNumber ? 'Ocultar' : 'Ver Lotes'}
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                                {expandedConferenceId === conf.conferenceNumber && (
                                                    <tr className="bg-slate-50">
                                                        <td colSpan={6} className="p-4">
                                                            <h4 className="font-semibold text-slate-700 mb-2 pl-2">Lotes da Conferência: {conf.conferenceNumber}</h4>
                                                            {lots.length > 0 ? (
                                                                <div className="overflow-x-auto border rounded-md bg-white">
                                                                    <table className="min-w-full text-xs">
                                                                        <thead className="bg-slate-100">
                                                                            <tr>
                                                                                <th className="p-2 text-left font-semibold">Lote Interno</th>
                                                                                <th className="p-2 text-left font-semibold">Lote Fornecedor</th>
                                                                                <th className="p-2 text-left font-semibold">Tipo de Material</th>
                                                                                <th className="p-2 text-left font-semibold">Bitola</th>
                                                                                <th className="p-2 text-left font-semibold">Embalagem</th>
                                                                                <th className="p-2 text-right font-semibold">Peso Etiqueta (kg)</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {lots.map((lot, i) => (
                                                                                <tr key={i}>
                                                                                    <td className="p-2">{lot.internalLot}</td>
                                                                                    <td className="p-2">{lot.supplierLot}</td>
                                                                                    <td className="p-2">{lot.materialType}</td>
                                                                                    <td className="p-2">{lot.bitola}</td>
                                                                                    <td className="p-2">
                                                                                        {lot.packagingType && lot.packagingType !== 'granel'
                                                                                            ? `${lot.qtyPackages || 1} ${lot.packagingType === 'rolo' ? 'rolo(s)' : lot.packagingType === 'pacote' ? `pacote(s) (${lot.totalPieces} un)` : 'barra(s)'}`
                                                                                            : 'Granel'}
                                                                                    </td>
                                                                                    <td className="p-2 text-right">{(Number(lot.labelWeight) || 0).toFixed(2)}</td>
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            ) : (
                                                                <p className="text-sm text-slate-400 pl-2">Nenhum lote encontrado para esta conferência.</p>
                                                            )}
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        ) : (
                            <p className="text-center text-slate-500 py-10">Nenhuma conferência foi finalizada ainda.</p>
                        )}
                    </div>
                    <div className="flex justify-end pt-4 mt-auto border-t">
                        <button type="button" onClick={onClose} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-4 rounded-lg transition">Fechar</button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default FinishedConferencesModal;