import React, { useState, useMemo, useEffect } from 'react';
import type { StockGauge, StockItem, GaugeComponent, User } from '../types';
import { SteelTypeOptions } from '../types';
import { TrashIcon, PlusIcon, ScaleIcon, PencilIcon, XIcon, SearchIcon } from './icons';
import { insertItem, deleteItemByColumn, uploadFile } from '../services/supabaseService';

interface GaugesManagerProps {
    gauges: StockGauge[];
    stock: StockItem[];
    onAdd: (gauge: Omit<StockGauge, 'id'>) => Promise<StockGauge>;
    onDelete: (id: string) => void;
    onUpdate: (id: string, data: Partial<StockGauge>) => Promise<StockGauge>;
    gaugeComponents?: GaugeComponent[];
    onSaveComponents?: (parentGaugeId: string, components: Omit<GaugeComponent, 'id'>[]) => Promise<void>;
    currentUser?: User | null;
}

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

const GaugesManager: React.FC<GaugesManagerProps> = ({ gauges, stock, onAdd, onDelete, onUpdate, gaugeComponents, onSaveComponents, currentUser }) => {
    const isGestor = currentUser?.role === 'admin' || currentUser?.role === 'gestor' || currentUser?.username === 'admin' || currentUser?.id === 'local-admin-gestor';

    // Form fields states
    const [selectedGroup, setSelectedGroup] = useState<string>('');
    const [customGroupName, setCustomGroupName] = useState('');
    const [isCreatingNewGroup, setIsCreatingNewGroup] = useState(false);
    
    // View modes and upload states
    const [viewMode, setViewMode] = useState<'list' | 'form'>('list');
    const [imageUrl, setImageUrl] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [viewingGauge, setViewingGauge] = useState<StockGauge | null>(null);

    // SVG icon for eye
    const EyeIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
        <svg xmlns="http://www.w3.org/2050/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
    );

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploading(true);
        try {
            const path = `product-images/${Date.now()}-${file.name}`;
            const url = await uploadFile('kb-files', path, file);
            if (url) {
                setImageUrl(url);
                alert('Imagem carregada com sucesso!');
            }
        } catch (err) {
            console.error('Error uploading image:', err);
            alert('Erro ao carregar imagem.');
        } finally {
            setIsUploading(false);
        }
    };
    
    const [metricUnit, setMetricUnit] = useState('mm');
    const [gaugeValue, setGaugeValue] = useState('');
    
    const [productCode, setProductCode] = useState('');
    const [subgroupCode, setSubgroupCode] = useState('');
    const [purchasePrice, setPurchasePrice] = useState('');
    const [technicalDescription, setTechnicalDescription] = useState('');
    const [status, setStatus] = useState('Ativo');
    const [autoGenerateLot, setAutoGenerateLot] = useState<boolean>(false);
    const [defaultSteelType, setDefaultSteelType] = useState<string>('');
    const [useCustomField, setUseCustomField] = useState<boolean>(false);
    const [customFieldLabel, setCustomFieldLabel] = useState<string>('');
    const [customFieldOptions, setCustomFieldOptions] = useState<string>('');
    const [customFieldValue, setCustomFieldValue] = useState<string>('');
    const [packagingType, setPackagingType] = useState<string>('granel');
    const [qtyPerPackaging, setQtyPerPackaging] = useState<string>('1');

    // New fields states for weight configurations
    const [weightPerMeter, setWeightPerMeter] = useState('');
    const [pieceSize, setPieceSize] = useState('');
    const [weightType, setWeightType] = useState('metro'); // 'metro' | 'unid' | 'peso'
    const [weightUnit, setWeightUnit] = useState('kg');     // 'kg' | 'g'
    const [rawWeightValue, setRawWeightValue] = useState('');

    // Compound products states
    const [itemType, setItemType] = useState<'materia_prima' | 'produto_composto'>('materia_prima');
    const [componentsForm, setComponentsForm] = useState<{
        componentGaugeId: string;
        funcao: string;
        consumption: number;
        consumptionType: 'quantidade' | 'metro' | 'peso';
        consumptionValue: number;
    }[]>([]);

    // Calculate dynamic cost of compound products
    const totalTheoreticalCost = useMemo(() => {
        return componentsForm.reduce((sum, item) => {
            const compGauge = gauges.find(g => g.id === item.componentGaugeId);
            const price = compGauge?.purchasePrice || 0;
            return sum + ((parseFloat(item.consumption.toString()) || 0) * price);
        }, 0);
    }, [componentsForm, gauges]);

    // Calculate dynamic weight of compound products
    const totalTheoreticalWeight = useMemo(() => {
        return componentsForm.reduce((sum, item) => sum + (parseFloat(item.consumption.toString()) || 0), 0);
    }, [componentsForm]);

    // Sync calculated values to form state for saving
    useEffect(() => {
        if (itemType === 'produto_composto') {
            setRawWeightValue(totalTheoreticalWeight.toString());
            setPurchasePrice(totalTheoreticalCost.toString());
        }
    }, [itemType, totalTheoreticalWeight, totalTheoreticalCost]);

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
            if (packagingType === 'rolo') {
                // Do not overwrite weightPerMeter, it is set directly by the input
            } else {
                setWeightPerMeter('1');
            }
        }
    }, [rawWeightValue, weightType, weightUnit, pieceSize, packagingType]);

    // Force values if weightType is 'peso' (1:1), except for rolo where we allow custom rawWeightValue
    useEffect(() => {
        if (weightType === 'peso' && packagingType !== 'rolo') {
            setRawWeightValue('1');
            setWeightUnit('kg');
        }
    }, [weightType, packagingType]);
    
    // Global actions / editing state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const allExistingGroups = useMemo(() => {
        const groups = Array.from(new Set(gauges.map(g => g.materialType))).filter(Boolean) as string[];
        return groups.sort();
    }, [gauges]);

    const dynamicGroups = useMemo(() => {
        const groups = Array.from(
            new Set(
                gauges
                    .filter(g => (g.itemType === 'produto_composto' ? 'produto_composto' : 'materia_prima') === itemType)
                    .map(g => g.materialType)
            )
        ).filter(Boolean) as string[];
        return groups.sort();
    }, [gauges, itemType]);

    useEffect(() => {
        if (dynamicGroups.length === 0) {
            setIsCreatingNewGroup(true);
        } else if (!isCreatingNewGroup && selectedGroup !== '' && !dynamicGroups.includes(selectedGroup)) {
            setSelectedGroup(dynamicGroups[0]);
        }
    }, [dynamicGroups, selectedGroup, isCreatingNewGroup]);

    const generateNextCode = (list: StockGauge[]) => {
        let maxNum = 0;
        list.forEach(g => {
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

        // Update localStorage if we found a higher code in the loaded gauges
        const storedMaxStr = localStorage.getItem('msm_max_product_code');
        let finalMax = maxNum;
        if (storedMaxStr) {
            const storedMax = parseInt(storedMaxStr, 10);
            if (!isNaN(storedMax) && storedMax > finalMax) {
                finalMax = storedMax;
            }
        }
        
        if (finalMax > 0) {
            localStorage.setItem('msm_max_product_code', String(finalMax));
        }

        // Generate the next code formatted with 4 digits
        const nextSerial = finalMax + 1;
        return String(nextSerial).padStart(4, '0');
    };

    // Code suggestion auto-generation logic
    useEffect(() => {
        if (editingId) return; // Do not overwrite when editing
        setProductCode(generateNextCode(gauges));
    }, [gauges, editingId]);

    const normalizeGauge = (val: string) => {
        if (!val) return '';
        const str = val.trim();
        const match = str.match(/^([\d.,]+)\s*(.*)$/);
        if (match) {
            const num = parseFloat(match[1].replace(',', '.'));
            if (!isNaN(num)) {
                const unit = match[2].trim().toLowerCase();
                return num.toFixed(2) + (unit ? ' ' + unit : '');
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
            const gaugeKey = getStandardizedGaugeKey(item.bitola);
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
        const gaugeKey = getStandardizedGaugeKey(gaugeStr);
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
        setSelectedGroup('');
        setProductCode(generateNextCode(gauges));
        setSubgroupCode('');
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
        setItemType('materia_prima');
        setComponentsForm([]);
        setAutoGenerateLot(false);
        setDefaultSteelType('');
        setUseCustomField(false);
        setCustomFieldLabel('');
        setCustomFieldOptions('');
        setCustomFieldValue('');
        setPackagingType('granel');
        setQtyPerPackaging('1');
        setImageUrl('');
    };

    const calculateRowConsumptionWeight = (
        componentGaugeId: string,
        type: 'quantidade' | 'metro' | 'peso',
        value: number
    ): number => {
        if (isNaN(value) || value <= 0) return 0;
        if (type === 'peso') return value;

        const compGauge = gauges.find(g => g.id === componentGaugeId);
        if (!compGauge) return 0;

        const wpm = compGauge.weightPerMeter || 0;

        if (type === 'metro') {
            return value * wpm;
        }

        if (type === 'quantidade') {
            const size = compGauge.pieceSize || 1;
            return value * (wpm * size);
        }

        return 0;
    };

    // Ficha técnica component editors
    const handleAddComponentRow = () => {
        const rawMaterials = gauges.filter(g => g.itemType !== 'produto_composto');
        setComponentsForm(prev => [
            ...prev,
            {
                componentGaugeId: rawMaterials.length > 0 ? rawMaterials[0].id : '',
                funcao: '',
                consumption: 0,
                consumptionType: 'peso',
                consumptionValue: 0
            }
        ]);
    };

    const handleUpdateComponentRow = (index: number, field: string, value: any) => {
        setComponentsForm(prev => {
            const updated = [...prev];
            const row = { ...updated[index], [field]: value };

            // Recalculate consumption in kg based on value and type
            row.consumption = calculateRowConsumptionWeight(
                row.componentGaugeId,
                row.consumptionType,
                row.consumptionValue
            );

            updated[index] = row;
            return updated;
        });
    };

    const handleRemoveComponentRow = (index: number) => {
        setComponentsForm(prev => prev.filter((_, i) => i !== index));
    };

    // Save action
    const handleSave = async () => {
        const groupToUse = isCreatingNewGroup ? customGroupName.trim() : selectedGroup;
        if (!groupToUse) {
            alert('Por favor, informe ou selecione o grupo/material.');
            return;
        }

        if (isCreatingNewGroup) {
            const cleanNew = customGroupName.trim();
            if (!cleanNew) {
                alert('Por favor, informe o nome do novo material.');
                return;
            }

            // If editing, check if the material name actually changed
            let originalMaterialName = '';
            if (editingId) {
                const originalGauge = gauges.find(g => g.id === editingId);
                if (originalGauge) {
                    originalMaterialName = originalGauge.materialType;
                }
            }

            const normalizedNew = cleanNew.toLowerCase().replace(/[^a-z0-9]/g, '');
            const exists = allExistingGroups.some(g => 
                g.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedNew &&
                g.toLowerCase() !== originalMaterialName.toLowerCase()
            );
            if (exists) {
                alert('Este material já está cadastrado (ou um com nome muito semelhante). Para adicionar uma nova bitola, selecione o material existente no seletor de materiais.');
                return;
            }
        }

        // Check if the material name already exists under a different itemType (cross-validation)
        const differentTypeExists = gauges.some(g => 
            g.materialType.toLowerCase() === groupToUse.toLowerCase() && 
            (g.itemType === 'produto_composto' ? 'produto_composto' : 'materia_prima') !== itemType
        );
        if (differentTypeExists) {
            const existingItem = gauges.find(g => g.materialType.toLowerCase() === groupToUse.toLowerCase());
            const existingTypeName = existingItem?.itemType === 'produto_composto' ? 'Produto Composto' : 'Matéria-Prima';
            alert(`Não é possível usar este nome. O material "${groupToUse}" já está cadastrado como um ${existingTypeName}. Um material não pode ser Matéria-Prima e Produto Composto ao mesmo tempo.`);
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
            subgroupCode: subgroupCode.trim() || undefined,
            purchasePrice: purchasePrice ? parseFloat(purchasePrice) : undefined,
            technicalDescription: technicalDescription.trim() || undefined,
            status: status,
            weightPerMeter: weightPerMeter ? parseFloat(weightPerMeter) : undefined,
            pieceSize: pieceSize ? parseFloat(pieceSize) : undefined,
            weightType: weightType,
            weightUnit: weightUnit,
            rawWeightValue: rawWeightValue ? parseFloat(rawWeightValue) : undefined,
            itemType: itemType,
            autoGenerateLot: autoGenerateLot,
            defaultSteelType: useCustomField ? (customFieldValue || undefined) : undefined,
            customFieldLabel: useCustomField ? customFieldLabel.trim() : undefined,
            customFieldOptions: useCustomField ? customFieldOptions.trim() : undefined,
            customFieldValue: useCustomField ? customFieldValue.trim() : undefined,
            packagingType: packagingType,
            qtyPerPackaging: qtyPerPackaging ? parseFloat(qtyPerPackaging) : 1,
            imageUrl: imageUrl.trim() || undefined
        };

        try {
            let savedGauge: StockGauge;
            if (editingId) {
                savedGauge = await onUpdate(editingId, gaugeData);
                if (!onSaveComponents) {
                    await deleteItemByColumn('gauge_components', 'parent_gauge_id', editingId);
                }
            } else {
                savedGauge = await onAdd(gaugeData as Omit<StockGauge, 'id'>);
            }

            if (itemType === 'produto_composto' && savedGauge?.id) {
                if (onSaveComponents) {
                    await onSaveComponents(savedGauge.id, componentsForm.map(comp => ({
                        parentGaugeId: savedGauge.id,
                        componentGaugeId: comp.componentGaugeId,
                        funcao: comp.funcao,
                        consumption: comp.consumption,
                        consumptionType: comp.consumptionType,
                        consumptionValue: comp.consumptionValue
                    })));
                } else {
                    for (const comp of componentsForm) {
                        if (comp.componentGaugeId && comp.consumption > 0) {
                            await insertItem<GaugeComponent>('gauge_components', {
                                parentGaugeId: savedGauge.id,
                                componentGaugeId: comp.componentGaugeId,
                                funcao: comp.funcao,
                                consumption: comp.consumption,
                                consumptionType: comp.consumptionType,
                                consumptionValue: comp.consumptionValue
                            } as any);
                        }
                    }
                }
            }

            alert(editingId ? 'Material atualizado com sucesso!' : 'Material cadastrado com sucesso!');
            handleReset();
            setViewMode('list');
        } catch (error: any) {
            console.error('Error saving gauge/components:', error);
            alert(`Erro ao salvar: ${error?.message || 'erro desconhecido'}`);
        }
    };

    // Edit action
    const handleStartEdit = (g: StockGauge) => {
        setEditingId(g.id);
        
        let value = g.gauge;
        let unit = 'nenhum';
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
        setSubgroupCode(g.subgroupCode || '');
        setPurchasePrice(g.purchasePrice?.toString() || '');
        setTechnicalDescription(g.technicalDescription || '');
        setStatus(g.status || 'Ativo');
        setAutoGenerateLot(g.autoGenerateLot || false);
        setDefaultSteelType(g.defaultSteelType || '');
        setUseCustomField(!!g.customFieldLabel);
        setCustomFieldLabel(g.customFieldLabel || '');
        setCustomFieldOptions(g.customFieldOptions || '');
        setCustomFieldValue(g.customFieldValue || '');
        setPackagingType(g.packagingType || 'granel');
        setQtyPerPackaging(g.qtyPerPackaging?.toString() || '1');
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

        const currentItemType = (g.itemType === 'produto_composto' ? 'produto_composto' : 'materia_prima') as 'materia_prima' | 'produto_composto';
        setItemType(currentItemType);
        setImageUrl(g.imageUrl || '');
        setViewMode('form');

        if (currentItemType === 'produto_composto') {
            const comps = (gaugeComponents || []).filter(c => c.parentGaugeId === g.id);
            setComponentsForm(comps.map(c => ({
                componentGaugeId: c.componentGaugeId,
                funcao: c.funcao || '',
                consumption: c.consumption,
                consumptionType: c.consumptionType || 'peso',
                consumptionValue: c.consumptionValue ?? c.consumption
            })));
        } else {
            setComponentsForm([]);
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
        const normalizedNew = cleanNewName.toLowerCase().replace(/[^a-z0-9]/g, '');
        const alreadyExists = allExistingGroups.some(g => 
            g.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedNew && 
            g.toLowerCase() !== oldName.toLowerCase()
        );
        if (alreadyExists) {
            alert('Já existe um grupo com este nome ou semelhante.');
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
                <header className="flex items-center justify-between pt-4 bg-transparent border-none">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">Configuração de Materiais</h1>
                        <p className="text-slate-500 text-sm">Adicione, edite ou remova materiais e bitolas do sistema.</p>
                    </div>
                    {isGestor && viewMode === 'list' && (
                        <button
                            onClick={() => {
                                handleReset();
                                setViewMode('form');
                            }}
                            className="bg-[#0F3F5C] hover:bg-[#0A2A3D] text-white font-bold py-2.5 px-6 rounded-xl shadow-sm transition flex items-center gap-2"
                        >
                            <PlusIcon className="h-5 w-5" /> Novo Cadastro
                        </button>
                    )}
                </header>

                {/* Form Card */}
                {isGestor && viewMode === 'form' ? (
                    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                        <div className="p-6 bg-slate-50 border-b border-slate-200">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                            <h2 className="text-lg font-bold text-[#0F3F5C] flex items-center gap-2">
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
                            <div className="bg-slate-200/60 p-1 rounded-xl flex items-center gap-1 self-start md:self-auto">
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (editingId) return;
                                        setItemType('materia_prima');
                                        setMetricUnit('mm');
                                        setWeightType('metro');
                                        setSelectedGroup('');
                                        setCustomGroupName('');
                                        setIsCreatingNewGroup(false);
                                        setGaugeValue('');
                                        setPurchasePrice('');
                                        setTechnicalDescription('');
                                        setWeightPerMeter('');
                                        setPieceSize('');
                                        setRawWeightValue('');
                                        setComponentsForm([]);
                                        setProductCode(generateNextCode(gauges));
                                    }}
                                    className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                                        itemType === 'materia_prima'
                                            ? 'bg-[#0F3F5C] text-white shadow-sm'
                                            : 'text-slate-600 hover:text-[#0F3F5C] cursor-pointer'
                                    } ${editingId ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    Matéria-Prima
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (editingId) return;
                                        setItemType('produto_composto');
                                        setMetricUnit('nenhum');
                                        setWeightType('unid');
                                        setSelectedGroup('');
                                        setCustomGroupName('');
                                        setIsCreatingNewGroup(false);
                                        setGaugeValue('');
                                        setPurchasePrice('');
                                        setTechnicalDescription('');
                                        setWeightPerMeter('');
                                        setPieceSize('');
                                        setRawWeightValue('');
                                        setComponentsForm([]);
                                        setProductCode(generateNextCode(gauges));
                                    }}
                                    className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                                        itemType === 'produto_composto'
                                            ? 'bg-[#0F3F5C] text-white shadow-sm'
                                            : 'text-slate-600 hover:text-[#0F3F5C] cursor-pointer'
                                    } ${editingId ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    Produto Composto
                                </button>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-stretch">
                            {/* Column 1: Identificação */}
                            <div className="flex flex-col space-y-4">
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">MATERIAL</label>
                                        {!isCreatingNewGroup && !editingId && selectedGroup !== '' && (
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
                                        <option value="">Selecione um material...</option>
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
                                
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">CÓD. SUBGRUPO</label>
                                    <input
                                        type="text"
                                        value={subgroupCode}
                                        onChange={e => setSubgroupCode(e.target.value)}
                                        placeholder="Ex: GRP-4.2"
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
                                            <option value="nenhum">Sem unid.</option>
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

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">NUMERAÇÃO DO LOTE</label>
                                    <select
                                        value={autoGenerateLot ? 'true' : 'false'}
                                        onChange={e => setAutoGenerateLot(e.target.value === 'true')}
                                        className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm bg-white font-medium text-slate-700 text-sm"
                                    >
                                        <option value="false">Manual (Digitar no recebimento)</option>
                                        <option value="true">Automático (Gerar sequencial)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">CAMPO ADICIONAL PERSONALIZADO</label>
                                    <div className="space-y-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                id="useCustomField"
                                                checked={useCustomField}
                                                onChange={e => {
                                                    setUseCustomField(e.target.checked);
                                                    if (e.target.checked && !customFieldLabel) {
                                                        setCustomFieldLabel('Especificações');
                                                    }
                                                }}
                                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                                            />
                                            <label htmlFor="useCustomField" className="text-xs font-bold text-slate-700 cursor-pointer">
                                                Ativar Informação Adicional
                                            </label>
                                        </div>

                                        {useCustomField && (
                                            <div className="space-y-2 animate-fadeIn">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nome do Campo</label>
                                                    <input
                                                        type="text"
                                                        value={customFieldLabel}
                                                        onChange={e => setCustomFieldLabel(e.target.value)}
                                                        placeholder="Ex: Especificações, Dureza, Cor"
                                                        className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Opções do Campo (separadas por vírgula ou hífen)</label>
                                                    <input
                                                        type="text"
                                                        value={customFieldOptions}
                                                        onChange={e => setCustomFieldOptions(e.target.value)}
                                                        placeholder="Ex: 1006, 1010, 1018 ou 1006-1018"
                                                        className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Valor Padrão</label>
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            list="default-value-options"
                                                            value={customFieldValue}
                                                            onChange={e => setCustomFieldValue(e.target.value)}
                                                            placeholder="Selecione ou digite o valor padrão"
                                                            className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                        />
                                                        <datalist id="default-value-options">
                                                            {customFieldOptions
                                                                .split(/[,;\-]+/)
                                                                .map(o => o.trim())
                                                                .filter(Boolean)
                                                                .map(opt => (
                                                                    <option key={opt} value={opt} />
                                                                ))}
                                                        </datalist>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Column 3: CONFIGURAÇÃO DE EMBALAGEM & CONVERSÃO */}
                            <div className={`rounded-2xl p-4 border flex flex-col justify-between space-y-4 transition-colors ${
                                itemType === 'produto_composto'
                                    ? 'bg-purple-50/50 border-purple-200'
                                    : 'bg-slate-100 border-slate-200'
                            }`}>
                                <h3 className={`text-xs font-bold uppercase tracking-wider text-center border-b pb-2 ${
                                    itemType === 'produto_composto' ? 'text-purple-700 border-purple-200' : 'text-slate-700 border-slate-200'
                                }`}>
                                    {itemType === 'produto_composto' ? 'PESO TEÓRICO (FICHA)' : 'EMBALAGEM & CONVERSÃO'}
                                </h3>

                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">TIPO DE EMBALAGEM</label>
                                    <select
                                        value={packagingType}
                                        onChange={e => {
                                            const val = e.target.value;
                                            setPackagingType(val);
                                            if (val === 'rolo') {
                                                setWeightType('peso');
                                                setRawWeightValue('2000');
                                                setQtyPerPackaging('1');
                                            } else if (val === 'pacote') {
                                                setWeightType('unid');
                                                setQtyPerPackaging('200');
                                            } else if (val === 'barra') {
                                                setWeightType('unid');
                                                setQtyPerPackaging('1');
                                            } else {
                                                setWeightType('metro');
                                                setQtyPerPackaging('1');
                                            }
                                        }}
                                        className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm font-semibold text-sm bg-white text-slate-700"
                                    >
                                        <option value="granel">Granel (Apenas Peso)</option>
                                        <option value="rolo">Rolo / Bobina</option>
                                        <option value="pacote">Fardo / Pacote</option>
                                        <option value="barra">Barra / Peça Avulsa</option>
                                    </select>
                                </div>

                                {packagingType === 'pacote' && (
                                    <div className="animate-fadeIn">
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">QTD DE PEÇAS NO PACOTE</label>
                                        <input
                                            type="number"
                                            value={qtyPerPackaging}
                                            onChange={e => setQtyPerPackaging(e.target.value)}
                                            placeholder="Ex: 200"
                                            min="1"
                                            className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm font-semibold text-sm bg-white"
                                        />
                                    </div>
                                )}

                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">TIPO DE CONTROLE DE PESO</label>
                                    <select
                                        value={weightType}
                                        onChange={e => setWeightType(e.target.value)}
                                        className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm font-semibold text-sm bg-white text-slate-700"
                                    >
                                        <option value="metro">Por Metro (Mts)</option>
                                        <option value="unid">Por Unidade / Barra (Ex: 12m, 13m)</option>
                                        <option value="peso">Apenas por Peso (Kg)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                        {weightType === 'metro' ? 'PESO POR METRO' : weightType === 'unid' ? 'PESO TOTAL DA BARRA/PEÇA' : 'PESO BASE'}
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            value={
                                                itemType === 'produto_composto'
                                                    ? totalTheoreticalWeight.toFixed(3)
                                                    : (packagingType === 'rolo' && weightType === 'peso')
                                                    ? weightPerMeter
                                                    : rawWeightValue
                                            }
                                            onChange={e => {
                                                if (packagingType === 'rolo' && weightType === 'peso') {
                                                    setWeightPerMeter(e.target.value);
                                                } else {
                                                    setRawWeightValue(e.target.value);
                                                }
                                            }}
                                            placeholder={weightType === 'metro' ? "Ex: 0.109" : weightType === 'unid' ? "Ex: 10.5" : "Ex: 1.0"}
                                            step="any"
                                            min="0"
                                            disabled={(weightType === 'peso' && packagingType !== 'rolo') || itemType === 'produto_composto'}
                                            className="w-2/3 p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm font-semibold text-sm bg-white disabled:bg-slate-50 disabled:text-slate-400"
                                        />
                                        <select
                                            value={itemType === 'produto_composto' ? 'kg' : weightUnit}
                                            onChange={e => setWeightUnit(e.target.value)}
                                            disabled={(weightType === 'peso' && packagingType !== 'rolo') || itemType === 'produto_composto'}
                                            className="w-1/3 p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm font-semibold text-sm bg-white text-slate-700 disabled:bg-slate-50 disabled:text-slate-400"
                                        >
                                            <option value="kg">kg</option>
                                            <option value="g">gramas</option>
                                        </select>
                                    </div>
                                </div>

                                {(weightType === 'unid' || packagingType === 'pacote' || packagingType === 'barra') && (
                                    <div className="animate-fadeIn">
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">COMPRIMENTO DA BARRA/PEÇA (MTS)</label>
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

                            {/* Column 4: Imagem, Preço & Ações */}
                            <div className="flex flex-col justify-between space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">IMAGEM DO PRODUTO</label>
                                    <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                                        <div className="w-16 h-16 rounded-lg border bg-white flex items-center justify-center overflow-hidden flex-shrink-0 shadow-inner">
                                            {imageUrl ? (
                                                <img src={imageUrl} className="w-full h-full object-cover" />
                                            ) : (
                                                <ScaleIcon className="h-8 w-8 text-slate-300" />
                                            )}
                                        </div>
                                        <div className="flex flex-col space-y-1.5 w-full">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleImageUpload}
                                                id="gauge-image-upload"
                                                className="hidden"
                                                disabled={isUploading}
                                            />
                                            <label
                                                htmlFor="gauge-image-upload"
                                                className={`text-center text-xs font-bold py-1.5 px-3 rounded-lg border cursor-pointer transition ${
                                                    isUploading
                                                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300 shadow-sm'
                                                }`}
                                            >
                                                {isUploading ? 'Enviando...' : 'Selecionar Imagem'}
                                            </label>
                                            {imageUrl && (
                                                <button
                                                    type="button"
                                                    onClick={() => setImageUrl('')}
                                                    className="text-left text-[10px] text-red-500 hover:text-red-700 font-bold uppercase tracking-wider"
                                                >
                                                    Remover Imagem
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                        {itemType === 'produto_composto' ? 'CUSTO MATÉRIA-PRIMA' : 'PREÇO DE COMPRA (KG)'}
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">R$</span>
                                        <input
                                            type="number"
                                            value={purchasePrice}
                                            onChange={e => setPurchasePrice(e.target.value)}
                                            placeholder="0,00"
                                            step="0.01"
                                            min="0"
                                            className="w-full p-3 pl-9 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm font-semibold text-sm bg-white"
                                        />
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-semibold mt-1.5 block">
                                        {itemType === 'produto_composto' ? '(Custo Teórico Total)' : `(R$ ${pricePerMeter} / Mts)`}
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
                                    <div className="flex gap-2 flex-wrap md:flex-nowrap">
                                        {editingId && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setEditingId(null);
                                                    alert("Modo de edição desativado. Agora você pode salvar este item como um NOVO cadastro!");
                                                }}
                                                className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold py-3.5 px-3 rounded-xl shadow-sm transition text-xs flex items-center justify-center gap-1.5 flex-grow"
                                                title="Usar os dados atuais para criar um novo registro"
                                            >
                                                Usar como Modelo
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                handleReset();
                                                setViewMode('list');
                                            }}
                                            className="flex-grow bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold py-3.5 px-3 rounded-xl shadow-sm transition text-xs flex items-center justify-center gap-1.5"
                                        >
                                            <XIcon className="h-4 w-4" /> {editingId ? 'Cancelar' : 'Voltar'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleSave}
                                            className="bg-[#0F3F5C] hover:bg-[#0A2A3D] text-white font-bold p-3.5 rounded-xl shadow-sm transition flex items-center justify-center gap-2 flex-grow border border-transparent text-xs"
                                            title={editingId ? 'Salvar Alterações' : 'Salvar Material'}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-4 h-4">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                            </svg>
                                            Salvar
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

                        {/* Row 3: Ficha Técnica (Estrutura do Produto) */}
                        {itemType === 'produto_composto' && (
                            <div className="mt-6 pt-6 border-t border-slate-200 animate-fadeIn">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 className="text-sm font-bold text-[#0F3F5C] uppercase tracking-wider">
                                            Estrutura do Produto (Ficha Técnica Teórica)
                                        </h3>
                                        <p className="text-xs text-slate-500">
                                            Selecione as matérias-primas e consumos para calcular o peso e custo teóricos do produto composto.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleAddComponentRow}
                                        className="bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold py-2 px-3 rounded-lg border border-blue-200 transition text-xs flex items-center gap-1.5"
                                    >
                                        <PlusIcon className="h-4 w-4" /> Adicionar Componente
                                    </button>
                                </div>

                                {componentsForm.length === 0 ? (
                                    <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-6 text-center text-slate-500 text-xs italic">
                                        Nenhum componente adicionado à estrutura deste produto. Clique no botão acima para adicionar.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {componentsForm.map((comp, idx) => {
                                            const rawMaterials = gauges.filter(g => g.itemType !== 'produto_composto');
                                            return (
                                                <div
                                                    key={idx}
                                                    className="flex flex-col md:flex-row gap-3 items-start md:items-center bg-slate-50 p-3 rounded-xl border border-slate-200 animate-fadeIn"
                                                >
                                                    <div className="w-full md:w-4/12">
                                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                                            Matéria-Prima / Bitola
                                                        </label>
                                                        <select
                                                            value={comp.componentGaugeId}
                                                            onChange={e => handleUpdateComponentRow(idx, 'componentGaugeId', e.target.value)}
                                                            className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm bg-white font-medium text-slate-700 text-sm"
                                                        >
                                                            <option value="" disabled>Selecione uma matéria-prima...</option>
                                                            {rawMaterials.map(rm => (
                                                                <option key={rm.id} value={rm.id}>
                                                                    {rm.materialType} - {rm.gauge} {rm.purchasePrice ? `(R$ ${rm.purchasePrice}/kg)` : ''}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    <div className="w-full md:w-3/12">
                                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                                            Função / Posição
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={comp.funcao || ''}
                                                            onChange={e => handleUpdateComponentRow(idx, 'funcao', e.target.value)}
                                                            placeholder="Ex: Banzo Superior, Estribo..."
                                                            className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm bg-white font-medium text-slate-700 text-sm"
                                                        />
                                                    </div>

                                                    <div className="w-full md:w-2/12">
                                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                                            Medida por
                                                        </label>
                                                        <select
                                                            value={comp.consumptionType || 'peso'}
                                                            onChange={e => handleUpdateComponentRow(idx, 'consumptionType', e.target.value)}
                                                            className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm bg-white font-medium text-slate-700 text-sm"
                                                        >
                                                            <option value="peso">Peso (kg)</option>
                                                            <option value="metro">Metro (mts)</option>
                                                            <option value="quantidade">Qtd (unid)</option>
                                                        </select>
                                                    </div>

                                                    <div className="w-full md:w-2/12">
                                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                                            Consumo
                                                        </label>
                                                        <input
                                                            type="number"
                                                            value={comp.consumptionValue || ''}
                                                            onChange={e => handleUpdateComponentRow(idx, 'consumptionValue', parseFloat(e.target.value) || 0)}
                                                            placeholder="Ex: 1.25"
                                                            step="any"
                                                            min="0"
                                                            className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm font-semibold text-sm bg-white"
                                                        />
                                                        {comp.consumptionType && comp.consumptionType !== 'peso' && (
                                                            <span className="text-[10px] text-slate-500 mt-1 block font-semibold">
                                                                = {comp.consumption.toFixed(3)} kg
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="w-full md:w-1/12 flex justify-end md:justify-center self-center md:pt-4">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveComponentRow(idx)}
                                                            className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition"
                                                            title="Remover Componente"
                                                        >
                                                            <TrashIcon className="h-5 w-5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                        </div>
                    </div>
                ) : viewMode === 'form' ? (
                    <div className="bg-amber-50 rounded-xl p-4 border border-amber-200 shadow-sm text-center text-amber-800 font-semibold text-sm">
                        Apenas administradores e gestores possuem permissão para cadastrar ou editar materiais e bitolas.
                    </div>
                ) : null}

                {/* Search and List Section */}
                {viewMode === 'list' && (
                    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden animate-fadeIn">
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
                                        <th className="p-4 text-left">COD</th>
                                        <th className="p-4 text-left">IMAGEM</th>
                                        <th className="p-4 text-left">MATERIAL</th>
                                        <th className="p-4 text-left">SUBGRUPO</th>
                                        <th className="p-4 text-left">ESPECIFICAÇÃO</th>
                                        <th className="p-4 text-left">BITOLA/DIMENSÃO</th>
                                        <th className="p-4 text-left">FATOR CONVERSÃO</th>
                                        <th className="p-4 text-left">ESTOQUE</th>
                                        <th className="p-4 text-left">PREÇO (KG)</th>
                                        <th className="p-4 text-left">STATUS</th>
                                        {isGestor && <th className="p-4 text-center">AÇÕES</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-sm">
                                    {filteredGauges.map(g => {
                                        const stockInfo = getStockInfo(g.materialType, g.gauge);
                                        const hasStock = stockInfo.count > 0;
                                        
                                        // Parse value and unit for display
                                        let displayValue = g.gauge.replace('.', ',');
                                        let displayUnit = '';
                                        const units = ['mm', 'mts', 'kg', 'unid', 'BWG'];
                                        for (const u of units) {
                                            if (g.gauge.toLowerCase().endsWith(` ${u.toLowerCase()}`)) {
                                                displayValue = g.gauge.substring(0, g.gauge.length - u.length - 1).replace('.', ',');
                                                displayUnit = u;
                                                break;
                                            } else if (g.gauge.toLowerCase().endsWith(u.toLowerCase())) {
                                                displayValue = g.gauge.substring(0, g.gauge.length - u.length).replace('.', ',');
                                                displayUnit = u;
                                                break;
                                            }
                                        }

                                        const percent = g.idealWeight ? Math.min(100, (stockInfo.totalWeight / g.idealWeight) * 100) : (stockInfo.totalWeight > 0 ? 50 : 0);
                                        
                                        return (
                                            <tr key={g.id} className="hover:bg-slate-50/50 transition-colors group">
                                                {/* COD */}
                                                <td className="p-4 font-semibold text-slate-900">
                                                    <span className={g.productCode ? 'text-blue-600 font-mono font-bold text-sm' : 'text-slate-400 italic text-sm'}>
                                                        {g.productCode || 'Sem código'}
                                                    </span>
                                                </td>

                                                {/* IMAGEM */}
                                                <td className="p-4">
                                                    <div className="w-12 h-12 rounded-lg border bg-white flex items-center justify-center overflow-hidden shadow-sm">
                                                        {g.imageUrl ? (
                                                            <img src={g.imageUrl} className="w-full h-full object-cover" />
                                                        ) : g.materialType.toLowerCase().includes('rolo') || g.gauge.toLowerCase().includes('rolo') ? (
                                                            <img src="/images/wire_coil.png" className="w-full h-full object-cover opacity-90" />
                                                        ) : g.materialType.toLowerCase().includes('vergalhão') || g.materialType.toLowerCase().includes('barra') || g.packagingType === 'barra' ? (
                                                            <img src="/images/steel_bars.png" className="w-full h-full object-cover opacity-90" />
                                                        ) : (
                                                            <ScaleIcon className="h-6 w-6 text-slate-300" />
                                                        )}
                                                    </div>
                                                </td>

                                                {/* MATERIAL */}
                                                <td className="p-4">
                                                    <div className="flex flex-col space-y-1">
                                                        <span className="font-bold text-slate-805 text-sm">{g.materialType}</span>
                                                        <div className="flex flex-wrap gap-1">
                                                            <span className={`inline-block px-1.5 py-0.5 text-[9px] font-bold rounded ${
                                                                g.itemType === 'produto_composto'
                                                                    ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                                                    : 'bg-blue-100 text-blue-700 border border-blue-200'
                                                            }`}>
                                                                {g.itemType === 'produto_composto' ? 'Composto' : 'Matéria-Prima'}
                                                            </span>
                                                            {g.packagingType && g.packagingType !== 'granel' && (
                                                                <span className="inline-block px-1.5 py-0.5 text-[9px] font-bold rounded bg-indigo-100 text-indigo-700 border border-indigo-200">
                                                                    {g.packagingType === 'rolo' ? 'Rolo' : g.packagingType === 'pacote' ? `Pacote` : g.packagingType === 'barra' ? 'Barra' : 'Granel'}
                                                                </span>
                                                            )}
                                                            {g.defaultSteelType && (
                                                                <span className="inline-block px-1.5 py-0.5 text-[9px] font-bold rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                                    {g.defaultSteelType}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* SUBGRUPO */}
                                                <td className="p-4">
                                                    {g.subgroupCode ? (
                                                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-slate-100 text-slate-700 font-medium text-xs border border-slate-200 shadow-sm">
                                                            {g.subgroupCode}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-300 text-xs">-</span>
                                                    )}
                                                </td>

                                                {/* ESPECIFICAÇÃO */}
                                                <td className="p-4">
                                                    <span className="text-slate-600 font-medium text-xs">
                                                        {g.technicalDescription || 'Norma ABNT NBR 7480'}
                                                    </span>
                                                </td>

                                                {/* BITOLA/DIMENSÃO */}
                                                <td className="p-4 font-bold text-slate-850 text-sm">
                                                    <div className="flex flex-col">
                                                        <span>
                                                            {displayValue}{displayUnit ? ` ${displayUnit}` : ''}
                                                            {g.weightType === 'unid' && g.pieceSize ? ` x ${String(g.pieceSize).replace('.', ',')}m` : ''}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 font-normal">
                                                            {g.weightType === 'unid' && g.pieceSize ? '(Ø/L)' : '(Ø)'}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* FATOR CONVERSÃO */}
                                                <td className="p-4 text-xs font-semibold text-slate-700">
                                                    {g.weightType === 'unid' && g.pieceSize ? (
                                                        <div className="flex flex-col">
                                                            <span>{String(g.rawWeightValue || 0).replace('.', ',')} kg/barra</span>
                                                            <span className="text-[10px] text-slate-400 font-normal">({String(g.weightPerMeter || 0).replace('.', ',')} kg/m)</span>
                                                        </div>
                                                    ) : (
                                                        <span>{String(g.weightPerMeter || 0).replace('.', ',')} kg/m</span>
                                                    )}
                                                </td>

                                                {/* ESTOQUE */}
                                                <td className="p-4 text-xs font-semibold text-slate-700">
                                                    <div className="flex flex-col space-y-1">
                                                        <span className="font-bold text-slate-800">
                                                            Total: {stockInfo.totalWeight.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 3 })} kg
                                                        </span>
                                                        <span className="text-xs text-slate-500 font-semibold">
                                                            {stockInfo.count} {stockInfo.count === 1 ? 'Lote' : 'Lotes'}
                                                        </span>
                                                        {stockInfo.totalWeight > 0 && (
                                                            <div className="w-24 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                                                <div 
                                                                    className={`h-full rounded-full ${
                                                                        percent < 25 ? 'bg-red-500' : percent < 60 ? 'bg-amber-500' : 'bg-emerald-500'
                                                                    }`}
                                                                    style={{ width: `${percent}%` }}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* PREÇO (KG) */}
                                                <td className="p-4 font-bold text-slate-850 text-sm">
                                                    {g.purchasePrice ? `R$ ${g.purchasePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                                                </td>

                                                {/* STATUS */}
                                                <td className="p-4">
                                                    <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full border flex items-center gap-1 w-fit ${
                                                        g.status === 'Inativo'
                                                            ? 'bg-slate-100 text-slate-500 border-slate-200'
                                                            : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                                    }`}>
                                                        <span className={`h-1.5 w-1.5 rounded-full ${g.status === 'Inativo' ? 'bg-slate-450' : 'bg-emerald-500'}`} />
                                                        {g.status || 'Ativo'}
                                                    </span>
                                                </td>

                                                {/* AÇÕES */}
                                                {isGestor && (
                                                    <td className="p-4">
                                                        <div className="flex items-center justify-center gap-2">
                                                            {g.id.startsWith('STOCK-') ? (
                                                                <>
                                                                    <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded font-bold">
                                                                        Sem cadastro
                                                                    </span>
                                                                    <button
                                                                        onClick={() => {
                                                                            if (confirm(`A bitola "${g.gauge}" do material "${g.materialType}" aparece no estoque mas não está cadastrada no sistema.\n\nCadastre-a para ter controle total.\n\nDeseja apenas remover da visualização?`)) {
                                                                                onDelete(g.id);
                                                                            }
                                                                        }}
                                                                        className="p-1.5 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition"
                                                                        title="Remover da visualização (não cadastrado)"
                                                                    >
                                                                        <TrashIcon className="h-4 w-4" />
                                                                    </button>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <button
                                                                        onClick={() => setViewingGauge(g)}
                                                                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                                                                        title="Visualizar Detalhes"
                                                                    >
                                                                        <EyeIcon className="h-4 w-4" />
                                                                    </button>
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
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                    {filteredGauges.length === 0 && (
                                        <tr>
                                            <td colSpan={isGestor ? 10 : 9} className="p-8 text-center text-slate-400 italic">
                                                Nenhum material ou bitola cadastrada que corresponda à busca.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

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

            {/* viewingGauge modal popup */}
            {viewingGauge && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in duration-200">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900">Detalhes do Material</h3>
                                <p className="text-xs text-slate-500">Visualização detalhada da bitola cadastrada</p>
                            </div>
                            <button
                                onClick={() => setViewingGauge(null)}
                                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition"
                            >
                                <XIcon className="h-5 w-5" />
                            </button>
                        </div>
                        {/* Content */}
                        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                            <div className="flex flex-col md:flex-row gap-6">
                                {/* Image */}
                                <div className="w-full md:w-1/3 flex-shrink-0">
                                    <div className="w-full aspect-square rounded-xl border bg-slate-50 flex items-center justify-center overflow-hidden shadow-inner">
                                        {viewingGauge.imageUrl ? (
                                            <img src={viewingGauge.imageUrl} className="w-full h-full object-cover" />
                                        ) : viewingGauge.materialType.toLowerCase().includes('rolo') || viewingGauge.gauge.toLowerCase().includes('rolo') ? (
                                            <img src="/images/wire_coil.png" className="w-full h-full object-cover opacity-90" />
                                        ) : viewingGauge.materialType.toLowerCase().includes('vergalhão') || viewingGauge.materialType.toLowerCase().includes('barra') || viewingGauge.packagingType === 'barra' ? (
                                            <img src="/images/steel_bars.png" className="w-full h-full object-cover opacity-90" />
                                        ) : (
                                            <ScaleIcon className="h-12 w-12 text-slate-300" />
                                        )}
                                    </div>
                                </div>
                                {/* Primary Info */}
                                <div className="flex-grow space-y-4">
                                    <div>
                                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Código do Produto</span>
                                        <p className="text-lg font-mono font-bold text-blue-600">{viewingGauge.productCode || 'Sem código'}</p>
                                    </div>
                                    <div>
                                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Material / Grupo</span>
                                        <p className="text-lg font-bold text-slate-800">{viewingGauge.materialType}</p>
                                    </div>
                                    <div>
                                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Bitola / Dimensão</span>
                                        <p className="text-lg font-bold text-slate-900">{viewingGauge.gauge}</p>
                                    </div>
                                </div>
                            </div>
                            
                            <hr className="border-slate-100" />
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">Especificações Técnicas</span>
                                    <p className="text-sm font-medium text-slate-700 bg-slate-50 p-2.5 rounded-lg border">
                                        {viewingGauge.technicalDescription || 'Norma ABNT NBR 7480'}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">Configuração de Embalagem</span>
                                    <p className="text-sm font-medium text-slate-700 bg-slate-50 p-2.5 rounded-lg border">
                                        {viewingGauge.packagingType === 'rolo' ? 'Rolo / Bobina' : viewingGauge.packagingType === 'pacote' ? `Pacote (${viewingGauge.qtyPerPackaging} unidades)` : viewingGauge.packagingType === 'barra' ? 'Barra avulsa' : 'Granel'}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">Fator de Conversão</span>
                                    <p className="text-sm font-medium text-slate-700 bg-slate-50 p-2.5 rounded-lg border">
                                        {viewingGauge.weightPerMeter ? `${String(viewingGauge.weightPerMeter).replace('.', ',')} kg/m` : '---'}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">Preço de Compra</span>
                                    <p className="text-sm font-bold text-slate-900 bg-slate-50 p-2.5 rounded-lg border">
                                        {viewingGauge.purchasePrice ? `R$ ${viewingGauge.purchasePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / kg` : '-'}
                                    </p>
                                </div>
                            </div>
                        </div>
                        {/* Footer */}
                        <div className="p-4 bg-slate-50 border-t flex justify-end">
                            <button
                                onClick={() => setViewingGauge(null)}
                                className="bg-[#0F3F5C] hover:bg-[#0A2A3D] text-white font-bold py-2 px-6 rounded-xl transition"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GaugesManager;
