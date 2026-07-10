import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    ArrowLeftIcon, CameraIcon, TrashIcon, CheckCircleIcon, DocumentReportIcon,
    AdjustmentsIcon, PencilIcon, BookOpenIcon, SearchIcon, FilterIcon, XIcon, PrinterIcon,
    ArrowPathIcon, DownloadIcon
} from './icons';
import type {
    ConferenceLotData, ConferenceData, StockItem, Bitola, MaterialType, Page, StockGauge, User, TransferRecord, Partner
} from '../types';
import {
    FioMaquinaBitolaOptions, CA60BitolaOptions, MaterialOptions, SteelTypeOptions
} from '../types';

import ConferenceReport from './ConferenceReport';
import FinishedConferencesModal from './FinishedConferencesModal';
import LotHistoryModal from './LotHistoryModal';

declare const extractLotDataFromImage: any;

const getStatusBadge = (status: string) => {
    const baseClass = "px-2 py-0.5 rounded text-[10px] font-bold border";
    switch (status) {
        case 'Disponível': return <span className={`${baseClass} bg-green-100 text-green-800 border-green-200`}>Disponível</span>;
        case 'Reservado': return <span className={`${baseClass} bg-slate-200 text-slate-700 border-slate-300`}>Reservado</span>;
        case 'Consumido': return <span className={`${baseClass} bg-slate-100 text-slate-400 border-slate-200 italic`}>Consumido</span>;
        default: return <span className={`${baseClass} bg-slate-100 text-slate-500 border-slate-200`}>{status}</span>;
    }
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

const calculateTheoreticalWeight = (gauge: StockGauge | undefined, qtyPackages: number | undefined) => {
    if (!gauge) return 0;
    const type = gauge.packagingType || 'granel';
    const qtyPerPack = gauge.qtyPerPackaging || 1;
    const size = gauge.pieceSize || 0;
    const wpm = gauge.weightPerMeter || 0;
    const safeQty = qtyPackages || 1;
    
    if (type === 'rolo') {
        return Number((safeQty * (gauge.rawWeightValue || 2000)).toFixed(2));
    }
    if (type === 'pacote') {
        return Number((safeQty * qtyPerPack * size * wpm).toFixed(2));
    }
    if (type === 'barra') {
        return Number((safeQty * size * wpm).toFixed(2));
    }
    return 0;
};

const generateQrCodeSvg = (lotVal: string, prodCode: string, mat: string) => {
    const qrcodeLib = (window as any).qrcode;
    if (typeof qrcodeLib !== 'undefined') {
        try {
            const qrData = `https://msm.gestao/stock/track?lot=${lotVal}&code=${prodCode}&mat=${encodeURIComponent(mat)}`;
            const qr = qrcodeLib(0, 'M');
            qr.addData(qrData);
            qr.make();
            return qr.createSvgTag(3, 0);
        } catch (e) {
            console.error(e);
        }
    }
    return `<img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(lotVal)}" alt="QR" class="w-16 h-16 object-contain" />`;
};

const AddConferencePage: React.FC<{
    onClose: () => void;
    onSubmit: (data: ConferenceData) => Promise<void> | void;
    stock: StockItem[];
    onShowReport: (data: ConferenceData) => void;
    conferences: ConferenceData[];
    onEditConference: (id: string, data: ConferenceData) => void;
    onDeleteConference: (id: string) => void;
    gauges: StockGauge[];
    isGestor: boolean;
    setPage: (page: Page) => void;
    activeBrandingPartner?: Partner | null;
}> = ({ onClose, onSubmit, stock, onShowReport, conferences, onEditConference, onDeleteConference, gauges, isGestor, setPage, activeBrandingPartner }) => {
    const dynamicMaterialOptions = useMemo(() => {
        const list = Array.from(new Set(gauges.map(g => g.materialType))).filter(m => {
            if (!m) return false;
            const normalized = m.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            if (normalized === 'vergalhao cd' || normalized === 'vergalhao cda' || normalized === 'vergalhaoi cd' || normalized === 'barra' || normalized === 'arame cd' || normalized === 'arame cda') return false;
            return true;
        }) as string[];
        return list.sort();
    }, [gauges]);

    const [conferenceData, setConferenceData] = useState<Omit<ConferenceData, 'lots'>>({
        entryDate: new Date().toISOString().split('T')[0],
        supplier: '', nfe: '', conferenceNumber: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [lots, setLots] = useState<Partial<ConferenceLotData>[]>([{
        internalLot: '', runNumber: '', steelType: '', bitola: '', materialType: dynamicMaterialOptions[0] || '', labelWeight: 0, labelWeightInput: '0'
    }]);
    const [showManualInput, setShowManualInput] = useState<Record<number, boolean>>({});
    const [duplicateErrors, setDuplicateErrors] = useState<Record<number, string>>({});
    const [historyOpen, setHistoryOpen] = useState(false);
    const [conferenceNumberError, setConferenceNumberError] = useState<string>('');
    const [submitResult, setSubmitResult] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const [printLots, setPrintLots] = useState<ConferenceLotData[] | null>(null);

    useEffect(() => {
        if (lots.length === 1 && lots[0].bitola === '' && dynamicMaterialOptions[0]) {
            const firstMat = dynamicMaterialOptions[0];
            const matGauges = gauges.filter(g => g.materialType === firstMat);
            if (matGauges.length > 0) {
                setLots(prev => {
                    const copy = [...prev];
                    if (copy[0] && copy[0].bitola === '') {
                        copy[0].bitola = matGauges[0].gauge;
                        copy[0].materialType = firstMat;
                        if (matGauges[0].customFieldLabel || matGauges[0].defaultSteelType) {
                            copy[0].steelType = matGauges[0].customFieldValue || matGauges[0].defaultSteelType || '';
                        } else {
                            copy[0].steelType = '';
                        }
                        
                        copy[0].packagingType = matGauges[0].packagingType || 'granel';
                        copy[0].qtyPerPackaging = matGauges[0].qtyPerPackaging || 1;
                        copy[0].pieceSize = matGauges[0].pieceSize || 0;
                        copy[0].qtyPackages = 1;
                        copy[0].totalPieces = copy[0].packagingType === 'pacote' ? (matGauges[0].qtyPerPackaging || 200) : 1;
                        
                        const defaultWeight = calculateTheoreticalWeight(matGauges[0], 1);
                        if (defaultWeight > 0) {
                            copy[0].labelWeight = defaultWeight;
                            copy[0].labelWeightInput = String(defaultWeight).replace('.', ',');
                        }
                    }
                    return copy;
                });
            }
        }
    }, [dynamicMaterialOptions, gauges, lots]);

    const initializedSeq = useRef(false);

    useEffect(() => {
        if (!initializedSeq.current) {
            let nextNum = 1;
            while (conferences.some(c => {
                const confNum = c.conferenceNumber ? c.conferenceNumber.trim() : '';
                return confNum === String(nextNum).padStart(4, '0') || confNum === String(nextNum);
            })) {
                nextNum++;
            }
            const nextSeq = String(nextNum).padStart(4, '0');
            setConferenceData(prev => ({ ...prev, conferenceNumber: nextSeq }));
            initializedSeq.current = true;
        }
    }, [conferences]);


    useEffect(() => {
        if (!conferenceData.conferenceNumber) {
            setConferenceNumberError('');
            return;
        }
        const existingConf = conferences.find(c => Boolean(c.conferenceNumber) && c.conferenceNumber.trim().toLowerCase() === conferenceData.conferenceNumber.trim().toLowerCase());
        if (existingConf) {
            setConferenceNumberError(`A conferência '${conferenceData.conferenceNumber}' já consta no sistema.`);
        } else {
            setConferenceNumberError('');
        }
    }, [conferenceData.conferenceNumber, conferences]);

    const checkIfAutoGenerate = (materialType: string, bitola: string) => {
        const g = gauges.find(x => x.materialType === materialType && x.gauge === bitola);
        return !!g?.autoGenerateLot;
    };

    useEffect(() => {
        const newErrors: Record<number, string> = {};
        const existingStock = new Set(stock.filter(s => s.status !== 'Consumido').map(i => i.internalLot.trim().toLowerCase()));
        const currentBatch = new Set();
        lots.forEach((l, i) => {
            if (checkIfAutoGenerate(l.materialType || '', l.bitola || '')) return;
            if (!l.internalLot) return;
            const key = l.internalLot.trim().toLowerCase();
            if (existingStock.has(key)) newErrors[i] = "Já existe no estoque.";
            else if (currentBatch.has(key)) newErrors[i] = "Duplicado nesta lista.";
            currentBatch.add(key);
        });
        setDuplicateErrors(newErrors);
    }, [lots, stock]);

    const handleAddLot = () => {
        const lastLot = lots[lots.length - 1];
        const targetGauge = gauges.find(g => g.materialType === lastLot.materialType && g.gauge === lastLot.bitola);
        const defaultWeight = calculateTheoreticalWeight(targetGauge, 1);
        
        setLots([...lots, { 
            ...lastLot, 
            internalLot: '', 
            qtyPackages: 1, 
            labelWeight: defaultWeight || 0,
            labelWeightInput: defaultWeight ? String(defaultWeight).replace('.', ',') : '0',
            packagingType: targetGauge?.packagingType || 'granel',
            qtyPerPackaging: targetGauge?.qtyPerPackaging || 1,
            pieceSize: targetGauge?.pieceSize || 0,
            totalPieces: targetGauge?.packagingType === 'pacote' ? (targetGauge.qtyPerPackaging || 200) : 1
        }]);
    };

    const handleLotChange = (index: number, field: keyof ConferenceLotData, value: any) => {
        const newLots = [...lots];
        (newLots[index] as any)[field] = value;

        if (field === 'materialType') {
            const all = gauges.filter(g => g.materialType === value).map(g => g.gauge);

            if (!all.includes(newLots[index].bitola || '')) {
                newLots[index].bitola = all[0] || '';
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

                    const qtyPack = field === 'qtyPackages' ? (Number(value) || 0) : 1;
                    if (field !== 'qtyPackages') {
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

        setLots(newLots);
    };

    const handleGlobalScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; if (!file) return;
        setIsScanning(true);
        try {
            const res = await extractLotDataFromImage(file);
            if (res.nfe || res.conferenceNumber) setConferenceData(p => ({ ...p, nfe: res.nfe || p.nfe, conferenceNumber: res.conferenceNumber || p.conferenceNumber }));
            if (res.lots?.length) {
                const mapped = res.lots.map((l: any) => {
                    const wt = Number(l.labelWeight) || 0;
                    return {
                        internalLot: l.internalLot || '',
                        runNumber: String(l.runNumber || ''),
                        bitola: (l.bitola || '8.00').replace('.', ','),
                        materialType: (dynamicMaterialOptions[0] || '') as MaterialType,
                        labelWeight: wt,
                        labelWeightInput: String(wt).replace('.', ',')
                    };
                });
                setLots(p => (p.length === 1 && !p[0].internalLot) ? mapped : [...p, ...mapped]);
            }
        } catch (e) { alert('Erro na leitura'); } finally { setIsScanning(false); }
    };

    const handleFinalSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (isSubmitting) return;

        // Find the highest existing numeric lot number in stock and conferences
        let maxLotNum = 0;
        stock.forEach(item => {
            const num = parseInt(item.internalLot.replace(/\D/g, '')) || 0;
            if (num > maxLotNum) maxLotNum = num;
        });
        conferences.forEach(c => {
            c.lots?.forEach(l => {
                const num = parseInt(l.internalLot.replace(/\D/g, '')) || 0;
                if (num > maxLotNum) maxLotNum = num;
            });
        });

        // Assign automatic lot numbers for empty lots configured as auto-generate
        const updatedLots = lots.map(l => {
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

        // Perform validation with the assigned lot numbers
        const newErrors: Record<number, string> = {};
        const existingStock = new Set(stock.filter(s => s.status !== 'Consumido').map(i => i.internalLot.trim().toLowerCase()));
        const currentBatch = new Set();
        let hasErrors = false;

        updatedLots.forEach((l, i) => {
            if (!l.internalLot) {
                newErrors[i] = "Lote interno é obrigatório.";
                hasErrors = true;
                return;
            }
            const key = l.internalLot.trim().toLowerCase();
            if (existingStock.has(key)) {
                newErrors[i] = "Já existe no estoque.";
                hasErrors = true;
            } else if (currentBatch.has(key)) {
                newErrors[i] = "Duplicado nesta lista.";
                hasErrors = true;
            }
            currentBatch.add(key);
        });

        if (hasErrors) {
            setDuplicateErrors(newErrors);
            setSubmitResult({ type: 'error', message: 'Existem lotes inválidos, duplicados ou já cadastrados. Corrija-os antes de finalizar.' });
            return;
        }

        if (conferenceNumberError) {
            setSubmitResult({ type: 'error', message: conferenceNumberError });
            return;
        }

        const validLots = updatedLots.filter(l => !!l.internalLot) as ConferenceLotData[];
        if (!validLots.length) {
            setSubmitResult({ type: 'error', message: 'Por favor, adicione pelo menos um lote válido.' });
            return;
        }

        setIsSubmitting(true);
        try {
            const final = { ...conferenceData, lots: validLots } as ConferenceData;
            await onSubmit(final);
            setPrintLots(validLots);
            setSubmitResult({ type: 'success', message: 'Conferência registrada no sistema com sucesso!' });
        } catch (error: any) {
            setIsSubmitting(false);
            setSubmitResult({ type: 'error', message: error.message || 'Erro ao registrar conferência.' });
        }
    };

    useEffect(() => {
        if (printLots && printLots.length > 0) {
            const jsBarcode = (window as any).JsBarcode;
            if (typeof jsBarcode !== 'undefined') {
                setTimeout(() => {
                    printLots.forEach(lot => {
                        const element = document.getElementById(`print-barcode-${lot.internalLot}`);
                        if (element) {
                            try {
                                jsBarcode(element, lot.internalLot, {
                                    format: "CODE128",
                                    lineColor: "#000000",
                                    width: 1.8,
                                    height: 50,
                                    displayValue: true,
                                    fontSize: 12,
                                    font: "monospace",
                                    textMargin: 2,
                                    margin: 0
                                });
                            } catch (err) {
                                console.error("Error rendering print barcode:", err);
                            }
                        }
                    });
                }, 150);
            }
        }
    }, [printLots]);


    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8 animate-fadeIn">
            {submitResult && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden p-6 text-center animate-in fade-in zoom-in">
                        {submitResult.type === 'success' ? (
                            <CheckCircleIcon className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
                        ) : (
                            <XIcon className="h-16 w-16 text-red-500 mx-auto mb-4" />
                        )}
                        <h3 className="text-xl font-bold text-slate-800 mb-2">
                            {submitResult.type === 'success' ? 'Sucesso!' : 'Atenção!'}
                        </h3>
                        <div className="text-sm font-medium text-slate-600 mb-6">
                            <p>{submitResult.message}</p>
                            {submitResult.type === 'success' && (
                                <p className="mt-3 font-extrabold text-slate-800">
                                    Deseja imprimir as etiquetas dos lotes recebidos?
                                </p>
                            )}
                        </div>
                        {submitResult.type === 'success' ? (
                            <div className="flex flex-col gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setTimeout(() => {
                                            window.print();
                                            setSubmitResult(null);
                                            const validLots = lots.filter(l => !!l.internalLot) as ConferenceLotData[];
                                            const final = { ...conferenceData, lots: validLots } as ConferenceData;
                                            onShowReport(final);
                                            onClose();
                                        }, 200);
                                    }}
                                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
                                >
                                    <PrinterIcon className="h-5 w-5" />
                                    Sim, Imprimir Etiquetas
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSubmitResult(null);
                                        const validLots = lots.filter(l => !!l.internalLot) as ConferenceLotData[];
                                        const final = { ...conferenceData, lots: validLots } as ConferenceData;
                                        onShowReport(final);
                                        onClose();
                                    }}
                                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-2.5 px-4 rounded-xl transition-colors"
                                >
                                    Voltar para o Estoque
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setSubmitResult(null)}
                                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 px-4 rounded-xl transition-colors mb-2"
                            >
                                Voltar e Corrigir
                            </button>
                        )}
                    </div>
                </div>
            )}
            {historyOpen && <FinishedConferencesModal
                conferences={conferences}
                stock={stock}
                onClose={() => setHistoryOpen(false)}
                onShowReport={(conf) => {
                    onShowReport(conf);
                    setHistoryOpen(false);
                    onClose();
                }}
                onEditConference={onEditConference}
                onDeleteConference={onDeleteConference}
                gauges={gauges}
            />}
            <div className="max-w-[98%] 2xl:max-w-[1600px] mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <button onClick={onClose} className="bg-white p-2 rounded-full shadow-sm hover:bg-slate-100 flex items-center gap-2 px-4 font-bold"><ArrowLeftIcon className="h-5 w-5" /> Voltar</button>
                    <button onClick={() => setHistoryOpen(true)} className="bg-white text-slate-600 font-bold py-2 px-4 rounded-lg shadow-sm border">Histórico</button>
                </div>
                <form onSubmit={handleFinalSubmit} className="bg-white rounded-xl shadow-lg border overflow-hidden">
                    <div className="p-6 bg-slate-50 border-b grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="text-center"><label className="block text-sm font-bold text-slate-500 uppercase mb-1">Data</label><input type="date" value={conferenceData.entryDate} onChange={e => setConferenceData({ ...conferenceData, entryDate: e.target.value })} className="w-full p-3 border rounded-lg text-center text-lg font-semibold" required /></div>
                        <div className="text-center"><label className="block text-sm font-bold text-slate-500 uppercase mb-1">Fornecedor</label><input type="text" value={conferenceData.supplier} onChange={e => setConferenceData({ ...conferenceData, supplier: e.target.value })} className="w-full p-3 border rounded-lg text-center text-lg font-semibold" required /></div>
                        <div className="text-center"><label className="block text-sm font-bold text-slate-500 uppercase mb-1">NFe</label><input type="text" value={conferenceData.nfe} onChange={e => setConferenceData({ ...conferenceData, nfe: e.target.value })} className="w-full p-3 border rounded-lg text-center text-lg font-semibold" required /></div>
                        <div className="text-center relative"><label className="block text-sm font-bold text-slate-500 uppercase mb-1">Nº Conf.</label>
                            <input type="text" value={conferenceData.conferenceNumber} onChange={e => setConferenceData({ ...conferenceData, conferenceNumber: e.target.value })} className={`w-full p-3 border rounded-lg text-center text-lg font-semibold ${conferenceNumberError ? 'border-red-500 bg-red-50' : ''}`} required />
                            {conferenceNumberError && <p className="text-red-500 text-xs font-bold absolute -bottom-5 w-full left-0">{conferenceNumberError}</p>}
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-y">
                                <tr>
                                    {['Lote Interno', 'Especificações', 'Corrida', 'Material', 'Descrição', 'Embalagem', 'Peso Etiqueta', ''].map(h => {
                                        let displayHeader = h;
                                        if (h === 'Especificações') {
                                            const customLabels = lots
                                                .map(lot => {
                                                    const g = gauges.find(x => x.materialType === lot.materialType && x.gauge === lot.bitola);
                                                    const lbl = g?.customFieldLabel;
                                                    return lbl === 'Tipo de Aço' ? 'Especificações' : lbl;
                                                })
                                                .filter(Boolean) as string[];
                                            
                                            if (customLabels.length > 0) {
                                                const unique = Array.from(new Set(customLabels));
                                                displayHeader = unique.length === 1 ? unique[0] : 'Especificações';
                                            }
                                        }
                                        return (
                                            <th key={h} className="p-4 text-center font-bold text-slate-600 uppercase text-xs border-b-2 border-slate-200">
                                                {displayHeader}
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {lots.map((lot, index) => (
                                    <tr key={index} className="border-b">
                                        <td className="p-2">
                                            {checkIfAutoGenerate(lot.materialType || '', lot.bitola || '') ? (
                                                <input
                                                    type="text"
                                                    value={lot.internalLot || '(Gerado Automático)'}
                                                    disabled
                                                    className="w-full min-w-[180px] p-3 border rounded-lg text-center bg-slate-100 text-slate-500 font-semibold italic text-base"
                                                />
                                            ) : (
                                                <input
                                                    type="text"
                                                    value={lot.internalLot || ''}
                                                    onChange={e => handleLotChange(index, 'internalLot', e.target.value)}
                                                    className="w-full min-w-[180px] p-3 border rounded-lg text-center text-base font-semibold"
                                                    required
                                                />
                                            )}
                                            {duplicateErrors[index] && <p className="text-red-500 text-[9px] font-bold text-center">{duplicateErrors[index]}</p>}
                                        </td>
                                        <td className="p-2">
                                            {(() => {
                                                const g = gauges.find(x => x.materialType === lot.materialType && getStandardizedGaugeKey(x.gauge) === getStandardizedGaugeKey(lot.bitola));
                                                const hasCustom = g && (g.customFieldLabel || g.defaultSteelType);
                                                const options = g?.customFieldOptions
                                                    ? g.customFieldOptions.split(/[,;\-]+/).map(o => o.trim()).filter(Boolean)
                                                    : [];
                                                
                                                if (hasCustom) {
                                                    const isManual = showManualInput[index] || (!!lot.steelType && !options.includes(lot.steelType));
                                                    if (options.length > 0 && !isManual) {
                                                        return (
                                                            <select
                                                                value={lot.steelType || ''}
                                                                onChange={e => {
                                                                    const val = e.target.value;
                                                                    if (val === '__MANUAL__') {
                                                                        setShowManualInput(prev => ({ ...prev, [index]: true }));
                                                                        handleLotChange(index, 'steelType', '');
                                                                    } else {
                                                                        handleLotChange(index, 'steelType', val);
                                                                    }
                                                                }}
                                                                className="w-full p-3 border rounded-lg text-center bg-white text-base font-semibold"
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
                                                                onChange={e => handleLotChange(index, 'steelType', e.target.value)}
                                                                placeholder={(g.customFieldLabel === 'Tipo de Aço' ? 'Especificações' : g.customFieldLabel) || 'Especificações'}
                                                                className="w-full p-3 border rounded-lg text-center bg-white text-base font-semibold"
                                                                required
                                                            />
                                                            {options.length > 0 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setShowManualInput(prev => ({ ...prev, [index]: false }));
                                                                        handleLotChange(index, 'steelType', options[0]);
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
                                                            value="-"
                                                            disabled
                                                            className="w-full p-3 border rounded-lg text-center bg-slate-100 text-slate-500 font-semibold cursor-not-allowed"
                                                        />
                                                    );
                                                }
                                            })()}
                                        </td>
                                        <td className="p-2"><input type="text" value={lot.runNumber || ''} onChange={e => handleLotChange(index, 'runNumber', e.target.value)} className="w-full min-w-[120px] p-3 border rounded-lg text-center text-base font-semibold" required /></td>
                                        <td className="p-2"><select value={lot.materialType} onChange={e => handleLotChange(index, 'materialType', e.target.value)} className="w-full min-w-[260px] p-3 border rounded-lg text-center text-base font-semibold">{dynamicMaterialOptions.map(m => <option key={m} value={m}>{m}</option>)}</select></td>
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
                                                        onChange={e => handleLotChange(index, 'bitola', e.target.value)} 
                                                        className="w-full min-w-[250px] p-3 border rounded-lg text-center bg-white text-base font-semibold"
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
                                                const g = gauges.find(x => x.materialType === lot.materialType && getStandardizedGaugeKey(x.gauge) === getStandardizedGaugeKey(lot.bitola || ''));
                                                const hasPackaging = g && g.packagingType && g.packagingType !== 'granel';
                                                
                                                if (hasPackaging) {
                                                    const packName = g.packagingType === 'rolo' ? 'Rolo' : g.packagingType === 'pacote' ? 'Pacote' : 'Barra';
                                                    const descText = g.packagingType === 'pacote' 
                                                        ? `${g.qtyPerPackaging || 200} un x ${g.pieceSize || 6}m`
                                                        : g.packagingType === 'barra'
                                                        ? `${g.pieceSize || 6}m`
                                                        : `~${g.rawWeightValue || 2000}kg`;
                                                    
                                                    return (
                                                        <div className="flex items-center justify-center gap-2">
                                                            <input
                                                                type="number"
                                                                value={lot.qtyPackages || 1}
                                                                onChange={e => {
                                                                    const val = Math.max(1, parseInt(e.target.value) || 1);
                                                                    handleLotChange(index, 'qtyPackages', val);
                                                                }}
                                                                className="w-16 p-2 border rounded-lg text-center font-bold text-base"
                                                                min="1"
                                                                required
                                                            />
                                                            <span className="text-sm font-bold text-slate-700 whitespace-nowrap">
                                                                {packName}s <span className="text-slate-500 font-semibold">de ({descText})</span>
                                                            </span>
                                                        </div>
                                                    );
                                                } else {
                                                    return (
                                                        <input
                                                            type="text"
                                                            value="-"
                                                            disabled
                                                            className="w-full p-3 border rounded-lg text-center bg-slate-100 text-slate-500 font-semibold cursor-not-allowed text-base"
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
                                                        handleLotChange(index, 'labelWeight', isNaN(parsed) ? 0 : parsed);
                                                        handleLotChange(index, 'labelWeightInput', val);
                                                    }}
                                                    className="w-full p-3 border rounded-lg font-bold text-center no-spinner text-xl text-blue-800"
                                                    placeholder="0"
                                                    required
                                                />
                                        </td>
                                        <td className="p-2"><button type="button" onClick={() => setLots(lots.filter((_, i) => i !== index))} className="p-2 text-red-500"><TrashIcon className="h-5 w-5" /></button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <button type="button" onClick={handleAddLot} className="w-full py-4 text-[#0F3F5C] font-bold hover:bg-slate-50 transition">+ Adicionar Peça</button>
                    </div>
                    <div className="p-6 bg-slate-50 border-t flex justify-end gap-4">
                        <button type="button" onClick={onClose} className="font-bold text-slate-500 px-6">Cancelar</button>
                        <button type="submit" disabled={isSubmitting} className="bg-[#0F3F5C] text-white px-10 py-3 rounded-xl font-bold">{isSubmitting ? 'Salvando...' : 'Finalizar'}</button>
                    </div>
                </form>
            {/* Hidden printable label container */}
            {printLots && printLots.length > 0 && (
                <div className="hidden print:block print-labels-container">
                    <style dangerouslySetInnerHTML={{ __html: `
                        @media print {
                            body, html, #root, .app-container, .main-content, .min-h-screen, .max-w-7xl, header, aside, .no-print, form, .print-section {
                                visibility: hidden !important;
                                height: 0 !important;
                                overflow: visible !important;
                                margin: 0 !important;
                                padding: 0 !important;
                            }
                            .print-labels-container {
                                visibility: visible !important;
                                display: block !important;
                                position: absolute !important;
                                left: 0 !important;
                                top: 0 !important;
                                width: 100mm !important;
                                height: auto !important;
                                margin: 0 !important;
                                padding: 0 !important;
                                background: white !important;
                            }
                            .print-labels-container *, .print-label-card, .print-label-card * {
                                visibility: visible !important;
                            }
                            .print-label-card {
                                position: relative !important;
                                width: 100mm !important;
                                height: 150mm !important;
                                padding: 6mm !important;
                                border: 2px solid black !important;
                                box-sizing: border-box !important;
                                background: white !important;
                                color: black !important;
                                display: flex !important;
                                flex-direction: column !important;
                                justify-content: space-between !important;
                                page-break-inside: avoid !important;
                                page-break-after: always !important;
                            }
                            @page {
                                size: 100mm 150mm !important;
                                margin: 0 !important;
                            }
                            .print-label-card text, 
                            .print-label-card span, 
                            .print-label-card div, 
                            .print-label-card p,
                            .print-label-card h1,
                            .print-label-card h2,
                            .print-label-card td,
                            .print-label-card th {
                                color: black !important;
                                font-family: Arial, sans-serif !important;
                                -webkit-print-color-adjust: exact !important;
                                print-color-adjust: exact !important;
                            }
                        }
                    `}} />

                    {printLots.map((lot, idx) => {
                        const gauge = gauges.find(g => g.materialType === lot.materialType && g.gauge === lot.bitola);
                        const isBar = lot.materialType?.toLowerCase().includes('barra');
                        const defaultImg = isBar ? '/images/steel_bars.png' : '/images/wire_coil.png';
                        const imageToUse = gauge?.imageUrl || defaultImg;
                        const factorStr = gauge?.weightPerMeter ? `${gauge.weightPerMeter.toString().replace('.', ',')} kg/m` : lot.labelWeightInput || '';
                        
                        return (
                            <div key={idx} className="print-label-card bg-white text-black border-2 border-black p-5 flex flex-col justify-between">
                                {/* Header */}
                                <div className="flex gap-4 items-start border-b-2 border-black pb-3">
                                    <div className="flex-grow flex flex-col min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black tracking-wider text-slate-700 uppercase bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                                CÓD. {gauge?.productCode || 'N/A'}
                                            </span>
                                        </div>
                                        <h1 className="text-sm font-black text-slate-900 mt-1 uppercase truncate">
                                            {lot.materialType || 'N/A'}
                                        </h1>
                                        <span className="text-[9px] font-bold text-slate-500 tracking-wide mt-0.5 uppercase truncate">
                                            {activeBrandingPartner ? activeBrandingPartner.companyName : "MSM Sistemas de Gestão"}
                                        </span>
                                    </div>
                                    {activeBrandingPartner?.logoUrl && (
                                        <div className="w-[56px] h-[56px] bg-white rounded border border-slate-200 p-1 flex items-center justify-center shrink-0">
                                            <img 
                                                src={activeBrandingPartner.logoUrl} 
                                                alt="Logo Cliente" 
                                                className="w-full h-full object-contain" 
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Spec Grid */}
                                <div className="my-2.5 flex-grow">
                                    <table className="w-full text-left border-collapse">
                                        <tbody>
                                            <tr className="border-b border-slate-200">
                                                <td className="py-1.5 text-[9px] font-extrabold text-slate-400 uppercase w-28">Bitola/Dimensão</td>
                                                <td className="py-1.5 text-xs font-black text-slate-900 uppercase">{lot.bitola || 'N/A'}</td>
                                            </tr>
                                            <tr className="border-b border-slate-200">
                                                <td className="py-1.5 text-[9px] font-extrabold text-slate-400 uppercase">Peso Registrado</td>
                                                <td className="py-1.5 text-xs font-black text-indigo-700 font-mono">
                                                    {lot.labelWeight 
                                                        ? `${lot.labelWeight.toFixed(2).replace('.', ',')} kg` 
                                                        : (lot.labelWeightInput ? `${lot.labelWeightInput} kg` : '0 kg')}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                {/* Big Lot Code Banner */}
                                <div className="border-t border-b border-black py-2 my-1.5 text-center bg-slate-50">
                                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">LOTE DE RASTREABILIDADE</span>
                                    <span className="text-2xl font-black text-slate-900 font-mono tracking-wider block mt-0.5">
                                        {lot.internalLot}
                                    </span>
                                </div>

                                {/* Barcode Section */}
                                <div className="flex flex-col items-center justify-center py-2 bg-slate-50">
                                    <svg 
                                        id={`print-barcode-${lot.internalLot}`} 
                                        className="max-w-full"
                                    />
                                </div>

                                {/* Footer */}
                                <div className="border-t border-slate-200 pt-2 mt-2 flex justify-between items-center text-[7px] font-black text-slate-400 uppercase tracking-wider">
                                    <span>Gerado Automaticamente</span>
                                    <span className="font-mono text-slate-500">{new Date().toLocaleDateString('pt-BR')} - {new Date().toLocaleTimeString('pt-BR')}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            </div>
        </div>
    );
};

const StockControl: React.FC<{
    stock: StockItem[]; conferences: ConferenceData[]; setPage: (p: Page) => void;
    addConference: (d: ConferenceData) => void; deleteStockItem: (id: string) => void;
    updateStockItem: (i: StockItem) => void; editConference: (id: string, d: ConferenceData) => void;
    deleteConference: (id: string) => void; gauges: StockGauge[]; currentUser: User | null;
    initialView?: 'list' | 'add';
    activeBrandingPartner?: Partner | null;
}> = ({ stock, conferences, setPage, addConference, deleteStockItem, updateStockItem, editConference, deleteConference, gauges, currentUser, initialView = 'list', activeBrandingPartner }) => {
    const isGestor = currentUser?.role === 'admin' || currentUser?.role === 'gestor';
    const [isAdding, setIsAdding] = useState(initialView === 'add');

    useEffect(() => {
        setIsAdding(initialView === 'add');
    }, [initialView]);
    const [reportView, setReportView] = useState<ConferenceData | null>(null);
    const [historyLot, setHistoryLot] = useState<StockItem | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingItem, setEditingItem] = useState<StockItem | null>(null);
    const [consumingItem, setConsumingItem] = useState<StockItem | null>(null);
    const [materialFilter, setMaterialFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState<string[]>([]);
    const [isStatusOpen, setIsStatusOpen] = useState(false);
    const [isMobileStatusOpen, setIsMobileStatusOpen] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);
    const [reprintLot, setReprintLot] = useState<StockItem | null>(null);

    const dynamicMaterialOptions = useMemo(() => {
        const activeGauges = gauges.filter(g => g.showInStockManagement !== false).map(g => `${g.materialType} - ${g.gauge}`);
        const stockItems = stock.filter(i => i.status !== 'Consumido').map(i => `${i.materialType} - ${i.bitola}`);
        const list = Array.from(new Set([...activeGauges, ...stockItems])).filter(s => {
            if (!s || s === ' - ' || s === 'undefined - undefined') return false;
            if (s.toUpperCase().includes('VERGALHAO COM 12 METROS') || s.toUpperCase().includes('VERGALHAO COM 11 METROS') || s.toUpperCase().includes('VERGALHAO COM 10 METROS')) return false;
            return true;
        });
        return list.sort();
    }, [gauges, stock]);

    const statusDesktopRef = useRef<HTMLDivElement>(null);
    const statusMobileRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (statusDesktopRef.current && !statusDesktopRef.current.contains(event.target as Node)) setIsStatusOpen(false);
            if (statusMobileRef.current && !statusMobileRef.current.contains(event.target as Node)) setIsMobileStatusOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (isPrinting) {
            window.print();
            // Pequeno delay para garantir que o estado volte após a caixa de impressão fechar
            // Em alguns browsers window.print é síncrono, em outros não.
            setTimeout(() => setIsPrinting(false), 500);
        }
    }, [isPrinting]);

    useEffect(() => {
        if (reprintLot) {
            const jsBarcode = (window as any).JsBarcode;
            if (typeof jsBarcode !== 'undefined') {
                setTimeout(() => {
                    const element = document.getElementById(`reprint-barcode-${reprintLot.internalLot}`);
                    if (element) {
                        try {
                            jsBarcode(element, reprintLot.internalLot, {
                                format: "CODE128",
                                lineColor: "#000000",
                                width: 1.8,
                                height: 50,
                                displayValue: true,
                                fontSize: 12,
                                font: "monospace",
                                textMargin: 2,
                                margin: 0
                            });
                        } catch (err) {
                            console.error("Error rendering reprint barcode:", err);
                        }
                    }
                }, 100);
            }
        }
    }, [reprintLot]);

    const handleReprintLabel = (item: StockItem) => {
        setReprintLot(item);
        setTimeout(() => {
            window.print();
            setTimeout(() => setReprintLot(null), 1000);
        }, 250);
    };

    const filtered = useMemo(() => stock.filter(i => {
        const gauge = gauges.find(g => g.materialType === i.materialType && g.gauge === i.bitola);
        const productCode = gauge?.productCode || '';

        const searchLower = searchTerm.trim().toLowerCase();
        const passesSearch = searchLower.length > 0 ? (
            (i.internalLot || '').toLowerCase().includes(searchLower) ||
            (i.nfe || '').toLowerCase().includes(searchLower) ||
            (i.steelType || '').toLowerCase().includes(searchLower) ||
            (productCode || '').toLowerCase().includes(searchLower)
        ) : true;

        let splitMaterial = materialFilter;
        let splitBitola = '';
        if (materialFilter.includes(' - ')) {
            const parts = materialFilter.split(' - ');
            splitMaterial = parts[0];
            splitBitola = parts.slice(1).join(' - ');
        }

        const passesMaterial = materialFilter === '' || (i.materialType === splitMaterial && i.bitola === splitBitola);
        const passesBitola = true; // Unified with Material

        if (statusFilter.length > 0) {
            return passesSearch && passesMaterial && passesBitola && statusFilter.includes(i.status);
        } else {
            return passesSearch && passesMaterial && passesBitola && i.status !== 'Consumido';
        }
    }).sort((a, b) => {
        const lotA = parseInt(a.internalLot.replace(/\D/g, '')) || 0;
        const lotB = parseInt(b.internalLot.replace(/\D/g, '')) || 0;

        if (isPrinting) {
            // Ordem Crescente para impressão
            if (lotA !== lotB) return lotA - lotB;
            return a.internalLot.localeCompare(b.internalLot);
        } else {
            if (lotA !== lotB) return lotB - lotA;
            return b.internalLot.localeCompare(a.internalLot);
        }
    }), [stock, searchTerm, materialFilter, statusFilter, isPrinting]);

    const handlePrint = () => {
        setIsPrinting(true);
    };

    const stats = useMemo(() => {
        return filtered.reduce((acc, item) => ({
            count: acc.count + 1,
            weight: acc.weight + (item.weight || 0)
        }), { count: 0, weight: 0 });
    }, [filtered]);

    const summaryData = useMemo(() => {
        if (!materialFilter) return null;
        
        let splitMaterial = materialFilter;
        let splitBitola = '';
        if (materialFilter.includes(' - ')) {
            const parts = materialFilter.split(' - ');
            splitMaterial = parts[0];
            splitBitola = parts.slice(1).join(' - ');
        }
        
        const parentGauge = gauges.find(g => g.materialType === splitMaterial && g.gauge === splitBitola);
        if (!parentGauge) return null;
        
        const subgroups = parentGauge.productCode 
            ? gauges.filter(g => g.subgroupCode === parentGauge.productCode && g.id !== parentGauge.id)
            : [];
            
        const getStats = (g: StockGauge) => {
            const items = stock.filter(i => 
                i.materialType?.trim() === g.materialType?.trim() && 
                (i.bitola === g.gauge || getStandardizedGaugeKey(i.bitola) === getStandardizedGaugeKey(g.gauge)) && 
                i.status !== 'Consumido'
            );
            const qty = items.reduce((acc, curr) => acc + (curr.qtyPackages || curr.totalPieces || 1), 0);
            const weight = items.reduce((acc, curr) => acc + (curr.weight || curr.labelWeight || 0), 0);
            const formattedName = g.productCode ? `${g.productCode} - ${g.materialType} ${g.gauge}` : `${g.materialType} ${g.gauge}`;
            return {
                name: formattedName,
                qty,
                weight
            };
        };

        const parentStats = getStats(parentGauge);
        const subgroupStats = subgroups.map(getStats);
        
        const totalQty = parentStats.qty + subgroupStats.reduce((sum, s) => sum + s.qty, 0);
        const totalWeight = parentStats.weight + subgroupStats.reduce((sum, s) => sum + s.weight, 0);
        
        return {
            parent: parentStats,
            subgroups: subgroupStats,
            totalQty,
            totalWeight
        };
    }, [materialFilter, gauges, stock]);

    const handleRevertToAvailable = (item: StockItem) => {
        if (confirm(`Deseja voltar o lote ${item.internalLot} para status "Disponível"?`)) {
            const updated = {
                ...item,
                status: 'Disponível',
                history: [...(item.history || []), {
                    type: 'Status Revertido',
                    date: new Date().toISOString(),
                    details: {
                        'Ação': 'Retorno manual para Disponível',
                        'Status Anterior': item.status,
                        'Operador': currentUser?.username || 'Sistema'
                    }
                }]
            };
            updateStockItem(updated);
        }
    };

    if (isAdding) return <AddConferencePage onClose={() => setIsAdding(false)} onSubmit={addConference} stock={stock} onShowReport={setReportView} conferences={conferences} onEditConference={editConference} onDeleteConference={deleteConference} gauges={gauges} isGestor={isGestor} setPage={setPage} activeBrandingPartner={activeBrandingPartner} />;

    return (
        <div className="p-4 md:p-8 space-y-6">
            {consumingItem && (
                <ConsumeLotModal
                    item={consumingItem}
                    onClose={() => setConsumingItem(null)}
                    onSave={(updated) => {
                        updateStockItem(updated);
                        setConsumingItem(null);
                    }}
                    currentUser={currentUser}
                />
            )}
            {/* Printable Report Header - Only visible during print */}
            <div className="hidden print:block mb-8 border-b-2 border-slate-900 pb-4">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic">MSM <span className="text-slate-500 font-light">Gestão Inteligente</span></h1>
                        <p className="text-[10px] font-bold text-slate-500 uppercase">Relatório de Inventário de Estoque - Setor Laminação</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs font-bold text-slate-900">{new Date().toLocaleDateString('pt-BR')} {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                        <p className="text-[10px] text-slate-500 font-medium italic">Sistema MSM Control</p>
                    </div>
                </div>

                <div className="flex justify-between items-center bg-slate-50 p-4 rounded-lg border">
                    <div className="flex gap-8">
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Filtro Material e Descrição</p>
                            <p className="text-base font-black text-slate-800">{materialFilter || 'Todos'}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</p>
                            <p className="text-base font-black text-slate-800 max-w-[150px] truncate">{statusFilter.length === 0 ? 'Todos' : statusFilter.join(', ')}</p>
                        </div>
                    </div>
                    <div className="flex gap-6 items-center text-center">
                        <div className="px-6 py-2 bg-white rounded-xl shadow-sm border border-slate-200/60">
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Lotes</p>
                            <p className="text-3xl font-black text-slate-900">{stats.count}</p>
                        </div>
                        <div className="px-6 py-2 bg-blue-50 rounded-xl shadow-sm border border-blue-200">
                            <p className="text-[11px] font-bold text-blue-500 uppercase tracking-widest mb-1">Peso Total</p>
                            <p className="text-3xl font-black text-blue-700 tracking-tight">{stats.weight.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} <span className="text-xl font-bold text-blue-500">kg</span></p>
                        </div>
                    </div>
                </div>
            </div>

            {reportView && <ConferenceReport reportData={reportView} onClose={() => setReportView(null)} gauges={gauges} />}
            {historyLot && <LotHistoryModal lot={historyLot} onClose={() => setHistoryLot(null)} />}
            {editingItem && (
                <EditStockItemModal
                    item={editingItem}
                    onClose={() => setEditingItem(null)}
                    onSave={(updated) => {
                        updateStockItem(updated);
                        setEditingItem(null);
                    }}
                    gauges={gauges}
                />
            )}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-6">
                    <h1 className="text-3xl font-bold text-slate-800 shrink-0 no-print">Estoque</h1>
                    <div className="hidden md:flex items-center gap-4 no-print grow">
                        <div className="bg-white p-2 rounded-xl shadow border flex items-center gap-2 px-4 shrink-0">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Material e Descrição</label>
                            <select value={materialFilter} onChange={e => setMaterialFilter(e.target.value)} className="bg-transparent outline-none font-bold text-sm min-w-[200px]">
                                <option value="">Todos</option>
                                {dynamicMaterialOptions.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                        <div className="bg-white p-2 rounded-xl shadow border flex items-center gap-2 px-4 shrink-0 relative" ref={statusDesktopRef}>
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Status</label>
                            <button
                                onClick={() => setIsStatusOpen(!isStatusOpen)}
                                className="bg-transparent outline-none font-bold text-sm min-w-[80px] text-left flex justify-between items-center"
                            >
                                <span className="truncate max-w-[100px]">{statusFilter.length === 0 ? 'Todos' : `${statusFilter.length} Sel.`}</span>
                                <svg className="w-4 h-4 ml-1 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            </button>
                            {isStatusOpen && (
                                <div className="absolute top-full left-0 mt-2 bg-white border rounded-xl shadow-xl z-50 p-3 flex flex-col gap-2 min-w-[200px]">
                                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer mb-1 hover:text-[#0F3F5C] transition-colors">
                                        <input type="checkbox" checked={statusFilter.length === 0} onChange={() => setStatusFilter([])} className="form-checkbox h-4 w-4 text-[#0F3F5C] rounded border-slate-300 focus:ring-[#0F3F5C]" />
                                        Todos
                                    </label>
                                    <hr className="my-1 border-slate-100" />
                                    {[
                                        { val: 'Disponível', label: 'Disponível' },
                                        { val: 'Reservado', label: 'Reservado' },
                                        { val: 'Consumido', label: 'Consumido' }
                                    ].map(s => (
                                        <label key={s.val} className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer hover:text-slate-900 transition-colors py-1">
                                            <input
                                                type="checkbox"
                                                checked={statusFilter.includes(s.val)}
                                                onChange={e => {
                                                    if (e.target.checked) setStatusFilter([...statusFilter, s.val]);
                                                    else setStatusFilter(statusFilter.filter(x => x !== s.val));
                                                }}
                                                className="form-checkbox h-4 w-4 text-[#0F3F5C] rounded border-slate-300 focus:ring-[#0F3F5C]"
                                            />
                                            {s.label}
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button onClick={handlePrint} className="bg-white text-slate-600 font-bold py-2 px-4 rounded-xl shadow border flex items-center gap-2 hover:bg-slate-50 transition mr-2">
                            <PrinterIcon className="h-5 w-5" />
                        </button>

                        <div className="flex items-center gap-4 border-l pl-6 ml-2">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-slate-400 border-b border-transparent">Lotes</span>
                                <span className="text-xl font-black text-slate-800">{stats.count}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kg Disponível</span>
                                <span className="text-xl font-black text-blue-600">{stats.weight.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-4 no-print">

                    <button onClick={() => setIsAdding(true)} className="bg-[#0F3F5C] text-white font-bold py-2 px-6 rounded-lg shadow-lg shrink-0 whitespace-nowrap">+ Novo Recebimento</button>
                </div>
            </header>
            <div className="md:hidden flex flex-wrap gap-2 no-print p-2">
                <div className="bg-white p-2 rounded-lg shadow border flex items-center gap-2 px-4 shadow-sm w-full">
                    <label className="text-[10px] font-bold text-slate-500">MAT / DESC:</label>
                    <select value={materialFilter} onChange={e => setMaterialFilter(e.target.value)} className="bg-transparent outline-none font-bold text-xs w-full">
                        <option value="">Todos</option>
                        {dynamicMaterialOptions.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                </div>
                <div className="bg-white p-2 rounded-lg shadow border flex items-center gap-2 px-4 shadow-sm relative flex-grow" ref={statusMobileRef}>
                    <label className="text-[10px] font-bold text-slate-500">ST:</label>
                    <button
                        onClick={() => setIsMobileStatusOpen(!isMobileStatusOpen)}
                        className="bg-transparent outline-none font-bold text-xs text-left"
                    >
                        {statusFilter.length === 0 ? 'Todos' : `${statusFilter.length} Sel.`}
                    </button>
                    {isMobileStatusOpen && (
                        <div className="absolute top-full left-0 mt-2 bg-white border rounded-xl shadow-xl z-50 p-3 min-w-[200px] flex flex-col gap-2">
                            <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer mb-1 hover:text-[#0F3F5C] transition-colors">
                                <input type="checkbox" checked={statusFilter.length === 0} onChange={() => setStatusFilter([])} className="form-checkbox h-4 w-4 text-[#0F3F5C] rounded border-slate-300 focus:ring-[#0F3F5C]" />
                                Todos
                            </label>
                            <hr className="my-1 border-slate-100" />
                            {[
                                { val: 'Disponível', label: 'Disponível' },
                                { val: 'Reservado', label: 'Reservado' },
                                { val: 'Consumido', label: 'Consumido' }
                            ].map(s => (
                                <label key={s.val} className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer hover:text-slate-900 transition-colors py-1">
                                    <input
                                        type="checkbox"
                                        checked={statusFilter.includes(s.val)}
                                        onChange={e => {
                                            if (e.target.checked) setStatusFilter([...statusFilter, s.val]);
                                            else setStatusFilter(statusFilter.filter(x => x !== s.val));
                                        }}
                                        className="form-checkbox h-4 w-4 text-[#0F3F5C] rounded border-slate-300 focus:ring-[#0F3F5C]"
                                    />
                                    {s.label}
                                </label>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {summaryData && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-inner no-print animate-fadeIn">
                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-4 border-b pb-2">Resumo do Material Selecionado</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                            <span className="text-[10px] font-bold text-blue-500 uppercase">Resumo Geral</span>
                            <div className="font-black text-slate-800 text-sm uppercase mb-3 truncate" title={summaryData.parent.name}>{summaryData.parent.name}</div>
                            
                            <div className="flex flex-col gap-2">
                                {/* Rolos / Lotes (Parent) */}
                                <div className="flex justify-between items-center bg-slate-50 p-2 rounded border">
                                    <span className="text-xs font-bold text-slate-600 uppercase">Lotes / Rolos</span>
                                    <div className="flex gap-4 text-right">
                                        <div className="flex flex-col">
                                            <span className="text-[9px] text-slate-400 font-bold uppercase">Qtd</span>
                                            <span className="text-sm font-black text-slate-700">{summaryData.parent.qty}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[9px] text-slate-400 font-bold uppercase">Peso (kg)</span>
                                            <span className="text-sm font-black text-slate-700">{summaryData.parent.weight.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Barras (Subgroups) */}
                                <div className="flex justify-between items-center bg-slate-50 p-2 rounded border">
                                    <span className="text-xs font-bold text-slate-600 uppercase">Barras (Deriv.)</span>
                                    <div className="flex gap-4 text-right">
                                        <div className="flex flex-col">
                                            <span className="text-[9px] text-slate-400 font-bold uppercase">Qtd</span>
                                            <span className="text-sm font-black text-slate-700">{summaryData.totalQty - summaryData.parent.qty}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[9px] text-slate-400 font-bold uppercase">Peso (kg)</span>
                                            <span className="text-sm font-black text-slate-700">{(summaryData.totalWeight - summaryData.parent.weight).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Total Geral */}
                                <div className="flex justify-between items-center p-2 mt-1 border-t-2 border-slate-100">
                                    <span className="text-sm font-black text-slate-800 uppercase">Total Geral</span>
                                    <div className="text-right">
                                        <span className="text-lg font-black text-blue-600">{summaryData.totalWeight.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} <span className="text-xs font-bold text-blue-400">kg</span></span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {summaryData.subgroups.length > 0 && (
                            <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                                <span className="text-[10px] font-bold text-indigo-500 uppercase mb-2 block">Derivados / Subgrupos ({summaryData.subgroups.length})</span>
                                <div className="space-y-3">
                                    {summaryData.subgroups.map((sg, idx) => (
                                        <div key={idx} className="flex justify-between items-center border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                                            <span className="font-bold text-slate-600 text-xs uppercase" title={sg.name}>{sg.name}</span>
                                            <div className="flex gap-4 text-right">
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] text-slate-400 font-bold uppercase">Qtd</span>
                                                    <span className="text-sm font-black text-slate-600">{sg.qty}</span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] text-slate-400 font-bold uppercase">Peso</span>
                                                    <span className="text-sm font-black text-slate-700">{sg.weight.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
            <div className="no-print bg-white p-4 rounded-xl shadow border flex items-center gap-4">
                <SearchIcon className="h-5 w-5 text-slate-400" />
                <input type="text" placeholder="Buscar lote ou NFe..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="flex-grow outline-none" />
            </div>
            <div className="bg-white rounded-xl shadow-lg border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b font-bold text-slate-600 uppercase text-[10px]">
                            <tr>
                                <th className="p-3 text-center print:hidden">Data</th>
                                <th className="p-3 text-center">Lote Interno</th>
                                <th className="p-3 text-center">
                                    {(() => {
                                        const customLabels = filtered
                                            .map(item => {
                                                const g = gauges.find(x => x.materialType === item.materialType && x.gauge === item.bitola);
                                                const lbl = g?.customFieldLabel;
                                                return lbl === 'Tipo de Aço' ? 'Especificações' : lbl;
                                            })
                                            .filter(Boolean) as string[];
                                        
                                        if (customLabels.length > 0) {
                                            const unique = Array.from(new Set(customLabels));
                                            return unique.length === 1 ? unique[0] : 'Especificações';
                                        }
                                        return 'Especificações';
                                    })()}
                                </th>
                                <th className="p-3 text-center">NFe</th>
                                <th className="p-3 text-center">Conf.</th>
                                <th className="p-3 text-center">Mat.</th>
                                <th className="p-3 text-center">Descrição</th>
                                <th className="p-3 text-center">Peso (kg)</th>
                                <th className="p-3 text-center">Status</th>
                                <th className="p-3 text-center no-print">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {filtered.map(item => (
                                <tr key={item.id} className="hover:bg-slate-50">
                                    <td className="p-3 text-center text-slate-500 font-medium print:hidden">{new Date(item.entryDate).toLocaleDateString('pt-BR')}</td>
                                    <td className="p-3 text-center font-black text-slate-900">{item.internalLot}</td>
                                    <td className="p-3 text-center font-bold text-slate-600">
                                        {(() => {
                                            const g = gauges.find(x => x.materialType === item.materialType && x.gauge === item.bitola);
                                            const hasCustom = g && (g.customFieldLabel || g.defaultSteelType);
                                            return hasCustom ? (item.steelType || '-') : '-';
                                        })()}
                                    </td>
                                    <td className="p-3 text-center font-bold text-slate-500">{item.nfe || '-'}</td>
                                    <td className="p-3 text-center font-bold text-slate-500">{item.conferenceNumber || '-'}</td>
                                    <td className="p-3 text-center text-slate-500">{item.materialType}</td>
                                    <td className="p-3 text-center">
                                        <div className="flex flex-col items-center">
                                            {item.bitola ? (
                                                <span className="font-black text-blue-600">{item.bitola.replace('.', ',')}</span>
                                            ) : (
                                                <span className="text-xs text-red-500 italic font-semibold hover:underline cursor-pointer" onClick={() => setEditingItem(item)} title="Clique para editar e definir uma bitola/descrição">
                                                    Sem Descrição (Editar)
                                                </span>
                                            )}
                                            {(() => {
                                                const gauge = gauges.find(g => g.materialType === item.materialType && g.gauge === item.bitola);
                                                return gauge?.productCode ? <span className="text-[9px] text-slate-500 font-black uppercase print:text-black">{gauge.productCode}</span> : null;
                                            })()}
                                        </div>
                                    </td>
                                    <td className="p-3 text-center font-black text-slate-800">
                                        <div>{item.remainingQuantity.toFixed(2)}</div>
                                        {item.packagingType && item.packagingType !== 'granel' && (
                                            <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                                                {(() => {
                                                    const ratio = item.labelWeight && item.labelWeight > 0 ? (item.remainingQuantity / item.labelWeight) : 1;
                                                    const packs = Math.round((item.qtyPackages || 1) * ratio * 100) / 100;
                                                    const packName = item.packagingType === 'rolo' ? 'rolo' : item.packagingType === 'pacote' ? 'pacote' : 'barra';
                                                    const suffix = packs !== 1 ? 's' : '';
                                                    
                                                    if (item.packagingType === 'pacote') {
                                                        const pieces = Math.round((item.totalPieces || 0) * ratio);
                                                        return `${packs} ${packName}${suffix} (${pieces} un)`;
                                                    }
                                                    if (item.packagingType === 'barra') {
                                                        return `${packs} ${packName}${suffix}`;
                                                    }
                                                    if (item.packagingType === 'rolo') {
                                                        return `${packs} ${packName}${suffix}`;
                                                    }
                                                    return null;
                                                })()}
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-3 text-center">{getStatusBadge(item.status)}</td>
                                    <td className="p-3 flex justify-center gap-2 no-print">
                                        {(item.status.includes('Produção') || item.status === 'Reservado') && (
                                            <button onClick={() => handleRevertToAvailable(item)} title="Voltar para Disponível" className="p-1 hover:bg-emerald-50 rounded-lg transition-colors">
                                                <ArrowPathIcon className="h-5 w-5 text-emerald-500" />
                                            </button>
                                        )}
                                        <button onClick={() => setConsumingItem(item)} title="Dar Baixa (Consumir)" className="p-1 hover:bg-slate-50 rounded-lg transition-colors">
                                            <DownloadIcon className="h-5 w-5 text-slate-400 hover:text-[#0F3F5C]" />
                                        </button>
                                        <button onClick={() => setHistoryLot(item)} title="Histórico" className="p-1 hover:bg-blue-50 rounded-lg transition-colors">
                                            <BookOpenIcon className="h-5 w-5 text-slate-400 hover:text-blue-500" />
                                        </button>
                                        <button onClick={() => setEditingItem(item)} title="Editar" className="p-1 hover:bg-amber-50 rounded-lg transition-colors">
                                            <PencilIcon className="h-5 w-5 text-slate-400 hover:text-amber-500" />
                                        </button>
                                        <button onClick={() => handleReprintLabel(item)} title="Reimprimir Etiqueta" className="p-1 hover:bg-slate-50 rounded-lg transition-colors">
                                            <PrinterIcon className="h-5 w-5 text-slate-400 hover:text-indigo-600" />
                                        </button>
                                        <button onClick={() => confirm('Excluir?') && deleteStockItem(item.id)} title="Excluir" className="p-1 hover:bg-red-50 rounded-lg transition-colors">
                                            <TrashIcon className="h-5 w-5 text-red-400 hover:text-red-600" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Printable Report Footer */}
            <div className="hidden print:flex mt-12 justify-between items-end border-t border-dashed pt-8">
                <div className="flex flex-col gap-1">
                    <div className="w-48 h-px bg-slate-400"></div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Responsável pelo Estoque</p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 italic">MSM - Tecnologia em Gestão de Produção</p>
                </div>
            </div>
            {/* Hidden reprint label container */}
            {reprintLot && (
                <div className="hidden print:block print-reprint-container">
                    <style dangerouslySetInnerHTML={{ __html: `
                        @media print {
                            body, html, #root, .app-container, .main-content, .min-h-screen, .max-w-7xl, header, aside, .no-print, form, .print-section, .print-labels-container {
                                visibility: hidden !important;
                                height: 0 !important;
                                overflow: visible !important;
                                margin: 0 !important;
                                padding: 0 !important;
                            }
                            .print-reprint-container {
                                visibility: visible !important;
                                display: block !important;
                                position: absolute !important;
                                left: 0 !important;
                                top: 0 !important;
                                width: 100mm !important;
                                height: auto !important;
                                margin: 0 !important;
                                padding: 0 !important;
                                background: white !important;
                            }
                            .print-reprint-container *, .print-label-card, .print-label-card * {
                                visibility: visible !important;
                            }
                            .print-label-card {
                                position: relative !important;
                                width: 100mm !important;
                                height: 150mm !important;
                                padding: 6mm !important;
                                border: 2px solid black !important;
                                box-sizing: border-box !important;
                                background: white !important;
                                color: black !important;
                                display: flex !important;
                                flex-direction: column !important;
                                justify-content: space-between !important;
                                page-break-inside: avoid !important;
                                page-break-after: always !important;
                            }
                            @page {
                                size: 100mm 150mm !important;
                                margin: 0 !important;
                            }
                            .print-label-card text, 
                            .print-label-card span, 
                            .print-label-card div, 
                            .print-label-card p,
                            .print-label-card h1,
                            .print-label-card h2,
                            .print-label-card td,
                            .print-label-card th {
                                color: black !important;
                                font-family: Arial, sans-serif !important;
                                -webkit-print-color-adjust: exact !important;
                                print-color-adjust: exact !important;
                            }
                        }
                    `}} />

                    {(() => {
                        const gauge = gauges.find(g => g.materialType === reprintLot.materialType && g.gauge === reprintLot.bitola);
                        const isBar = reprintLot.materialType?.toLowerCase().includes('barra');
                        const defaultImg = isBar ? '/images/steel_bars.png' : '/images/wire_coil.png';
                        const imageToUse = gauge?.imageUrl || defaultImg;
                        const factorStr = gauge?.weightPerMeter ? `${gauge.weightPerMeter.toString().replace('.', ',')} kg/m` : '';
                        
                        return (
                            <div className="print-label-card bg-white text-black border-2 border-black p-5 flex flex-col justify-between">
                                {/* Header */}
                                <div className="flex gap-4 items-start border-b-2 border-black pb-3">
                                    <div className="flex-grow flex flex-col min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black tracking-wider text-slate-700 uppercase bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                                CÓD. {gauge?.productCode || 'N/A'}
                                            </span>
                                        </div>
                                        <h1 className="text-sm font-black text-slate-900 mt-1 uppercase truncate">
                                            {reprintLot.materialType || 'N/A'}
                                        </h1>
                                        <span className="text-[9px] font-bold text-slate-500 tracking-wide mt-0.5 uppercase truncate">
                                            {activeBrandingPartner ? activeBrandingPartner.companyName : "MSM Sistemas de Gestão"}
                                        </span>
                                    </div>
                                    {activeBrandingPartner?.logoUrl && (
                                        <div className="w-[56px] h-[56px] bg-white rounded border border-slate-200 p-1 flex items-center justify-center shrink-0">
                                            <img 
                                                src={activeBrandingPartner.logoUrl} 
                                                alt="Logo Cliente" 
                                                className="w-full h-full object-contain" 
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Spec Grid */}
                                <div className="my-2.5 flex-grow">
                                    <table className="w-full text-left border-collapse">
                                        <tbody>
                                            <tr className="border-b border-slate-200">
                                                <td className="py-1.5 text-[9px] font-extrabold text-slate-400 uppercase w-28">Bitola/Dimensão</td>
                                                <td className="py-1.5 text-xs font-black text-slate-900 uppercase">{reprintLot.bitola || 'N/A'}</td>
                                            </tr>
                                            <tr className="border-b border-slate-200">
                                                <td className="py-1.5 text-[9px] font-extrabold text-slate-400 uppercase">Peso Registrado</td>
                                                <td className="py-1.5 text-xs font-black text-indigo-700 font-mono">{reprintLot.weight ? `${reprintLot.weight.toFixed(2).replace('.', ',')} kg` : '0 kg'}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                {/* Big Lot Code Banner */}
                                <div className="border-t border-b border-black py-2 my-1.5 text-center bg-slate-50">
                                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">LOTE DE RASTREABILIDADE</span>
                                    <span className="text-2xl font-black text-slate-900 font-mono tracking-wider block mt-0.5">
                                        {reprintLot.internalLot}
                                    </span>
                                </div>

                                {/* Barcode Section */}
                                <div className="flex flex-col items-center justify-center py-2 bg-slate-50">
                                    <svg 
                                        id={`reprint-barcode-${reprintLot.internalLot}`} 
                                        className="max-w-full"
                                    />
                                </div>

                                {/* Footer */}
                                <div className="border-t border-slate-200 pt-2 mt-2 flex justify-between items-center text-[7px] font-black text-slate-400 uppercase tracking-wider">
                                    <span>Gerado Automaticamente</span>
                                    <span className="font-mono text-slate-500">{new Date().toLocaleDateString('pt-BR')} - {new Date().toLocaleTimeString('pt-BR')}</span>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}
        </div>
    );
};

const EditStockItemModal: React.FC<{ item: StockItem; onClose: () => void; onSave: (i: StockItem) => void; gauges: StockGauge[] }> = ({ item, onClose, onSave, gauges }) => {
    const [formData, setFormData] = useState<StockItem>(() => {
        const initial = { ...item };
        if (!initial.bitola && initial.materialType) {
            const customGauges = gauges.filter(g => g.materialType === initial.materialType);
            if (customGauges.length > 0) {
                initial.bitola = customGauges[0].gauge;
            }
        }
        const g = gauges.find(x => x.materialType === initial.materialType && x.gauge === initial.bitola);
        if (g) {
            if (!initial.packagingType) initial.packagingType = g.packagingType || 'granel';
            if (!initial.qtyPerPackaging) initial.qtyPerPackaging = g.qtyPerPackaging || 1;
            if (initial.pieceSize === undefined || initial.pieceSize === null) initial.pieceSize = g.pieceSize || 0;
            if (initial.qtyPackages === undefined || initial.qtyPackages === null) initial.qtyPackages = 1;
            if (initial.totalPieces === undefined || initial.totalPieces === null) {
                initial.totalPieces = initial.packagingType === 'pacote' ? (g.qtyPerPackaging || 200) : 1;
            }
            if (!initial.labelWeight) {
                initial.labelWeight = calculateTheoreticalWeight(g, initial.qtyPackages || 1);
            }
        }
        return initial;
    });
    const [showManualInput, setShowManualInput] = useState(false);

    const dynamicMaterialOptions = useMemo(() => {
        const list = Array.from(new Set(gauges.filter(g => !g.subgroupCode || g.subgroupCode === g.productCode).map(g => g.materialType))).filter(Boolean) as string[];
        return list.sort();
    }, [gauges]);

    const materialGauges = useMemo(() => {
        const customOptions = gauges.filter(g => g.materialType === formData.materialType).map(g => g.gauge);

        return [...new Set(customOptions)]
            .filter(Boolean)
            .sort((a: any, b: any) => {
                const numA = parseFloat(String(a).replace(',', '.'));
                const numB = parseFloat(String(b).replace(',', '.'));
                return numA - numB;
            });
    }, [gauges, formData.materialType]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="bg-[#0F3F5C] p-4 text-white flex justify-between items-center">
                    <h2 className="text-lg font-bold">Editar Lote: {item.internalLot}</h2>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors"><XIcon className="h-6 w-6" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Lote Interno</label>
                            <input type="text" value={formData.internalLot} onChange={e => setFormData({ ...formData, internalLot: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
                        </div>
                        <div className="space-y-1">
                            {(() => {
                                const g = gauges.find(x => x.materialType === formData.materialType && getStandardizedGaugeKey(x.gauge) === getStandardizedGaugeKey(formData.bitola));
                                const hasCustom = g && (g.customFieldLabel || g.defaultSteelType);
                                const label = (g?.customFieldLabel === 'Tipo de Aço' ? 'Especificações' : g?.customFieldLabel) || 'Especificações';
                                const options = g?.customFieldOptions
                                    ? g.customFieldOptions.split(/[,;\-]+/).map(o => o.trim()).filter(Boolean)
                                    : [];
                                
                                if (hasCustom) {
                                    const isManual = showManualInput || (!!formData.steelType && !options.includes(formData.steelType));
                                    if (options.length > 0 && !isManual) {
                                        return (
                                            <>
                                                <label className="text-xs font-bold text-slate-500 uppercase">{label}</label>
                                                <select
                                                    value={formData.steelType || ''}
                                                    onChange={e => {
                                                        const val = e.target.value;
                                                        if (val === '__MANUAL__') {
                                                            setShowManualInput(true);
                                                            setFormData({ ...formData, steelType: '' });
                                                        } else {
                                                            setFormData({ ...formData, steelType: val });
                                                        }
                                                    }}
                                                    className="w-full px-3 py-2 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                                                    required
                                                >
                                                    <option value="">Selecione...</option>
                                                    {options.map(opt => (
                                                        <option key={opt} value={opt}>{opt}</option>
                                                    ))}
                                                    <option value="__MANUAL__">Outro (Digitar)...</option>
                                                </select>
                                            </>
                                        );
                                    }
                                    return (
                                        <>
                                            <label className="text-xs font-bold text-slate-500 uppercase">{label}</label>
                                            <div className="flex items-center gap-1">
                                                <input
                                                    type="text"
                                                    value={formData.steelType || ''}
                                                    onChange={e => setFormData({ ...formData, steelType: e.target.value })}
                                                    placeholder={label}
                                                    className="w-full px-3 py-2 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                                    required
                                                />
                                                {options.length > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setShowManualInput(false);
                                                            setFormData({ ...formData, steelType: options[0] });
                                                        }}
                                                        className="px-1 text-slate-400 hover:text-slate-600 text-xs font-bold"
                                                        title="Voltar para seleção"
                                                    >
                                                        Listar
                                                    </button>
                                                )}
                                            </div>
                                        </>
                                    );
                                } else {
                                    return (
                                        <>
                                            <label className="text-xs font-bold text-slate-500 uppercase">Especificações</label>
                                            <input
                                                type="text"
                                                value="-"
                                                disabled
                                                className="w-full px-3 py-2 bg-slate-100 border rounded-lg text-slate-500 font-semibold cursor-not-allowed text-center"
                                            />
                                        </>
                                    );
                                }
                            })()}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">NFe</label>
                            <input type="text" value={formData.nfe} onChange={e => setFormData({ ...formData, nfe: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Corrida</label>
                            <input type="text" value={formData.runNumber || ''} onChange={e => setFormData({ ...formData, runNumber: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Tipo de Material</label>
                            <select
                                value={formData.materialType}
                                onChange={e => {
                                    const val = e.target.value as any;
                                    const all = gauges.filter(g => g.materialType === val).map(g => g.gauge);
                                    const nextBitola = all.includes(formData.bitola) ? formData.bitola : (all[0] || '');
                                    const targetGauge = gauges.find(g => g.materialType === val && g.gauge === nextBitola);

                                    setFormData(p => {
                                        const copy = {
                                            ...p,
                                            materialType: val,
                                            bitola: nextBitola
                                        };
                                        if (targetGauge) {
                                            copy.packagingType = targetGauge.packagingType || 'granel';
                                            copy.qtyPerPackaging = targetGauge.qtyPerPackaging || 1;
                                            copy.pieceSize = targetGauge.pieceSize || 0;
                                            copy.qtyPackages = 1;
                                            copy.totalPieces = copy.packagingType === 'pacote' 
                                                ? (targetGauge.qtyPerPackaging || 200) 
                                                : 1;
                                            const defaultWeight = calculateTheoreticalWeight(targetGauge, 1);
                                            copy.labelWeight = defaultWeight;
                                            copy.remainingQuantity = defaultWeight;
                                        }
                                        return copy;
                                    });
                                }}
                                className="w-full px-3 py-2 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                {dynamicMaterialOptions.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Descrição</label>
                            {(() => {
                                const customGauges = gauges.filter(g => g.materialType === formData.materialType);
                                const matchingGauge = customGauges.find(g => getStandardizedGaugeKey(g.gauge) === getStandardizedGaugeKey(formData.bitola));
                                const selectValue = matchingGauge ? matchingGauge.gauge : formData.bitola;
                                
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
                                        onChange={e => {
                                            const nextBitola = e.target.value;
                                            const targetGauge = gauges.find(g => g.materialType === formData.materialType && g.gauge === nextBitola);
                                            
                                            setFormData(p => {
                                                const copy = {
                                                    ...p,
                                                    bitola: nextBitola
                                                };
                                                if (targetGauge) {
                                                    copy.packagingType = targetGauge.packagingType || 'granel';
                                                    copy.qtyPerPackaging = targetGauge.qtyPerPackaging || 1;
                                                    copy.pieceSize = targetGauge.pieceSize || 0;
                                                    copy.qtyPackages = 1;
                                                    copy.totalPieces = copy.packagingType === 'pacote' 
                                                        ? (targetGauge.qtyPerPackaging || 200) 
                                                        : 1;
                                                    const defaultWeight = calculateTheoreticalWeight(targetGauge, 1);
                                                    copy.labelWeight = defaultWeight;
                                                    copy.remainingQuantity = defaultWeight;
                                                }
                                                return copy;
                                            });
                                        }}
                                        className="w-full px-3 py-2 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                                    >
                                        {uniqueOptions.map(opt => (
                                            <option key={`${opt.gauge}-${opt.code}`} value={opt.gauge}>
                                                {opt.gauge.replace('.', ',')} {opt.code ? `(${opt.code})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                );
                            })()}
                        </div>
                    </div>

                    {formData.packagingType && formData.packagingType !== 'granel' && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase">
                                    Qtd de {formData.packagingType === 'rolo' ? 'Rolo' : formData.packagingType === 'pacote' ? 'Pacote' : 'Barra'}s
                                </label>
                                <input
                                    type="number"
                                    value={formData.qtyPackages || 1}
                                    onChange={e => {
                                        const val = Math.max(1, parseInt(e.target.value) || 1);
                                        const targetGauge = gauges.find(g => g.materialType === formData.materialType && g.gauge === formData.bitola);
                                        const nextWeight = calculateTheoreticalWeight(targetGauge, val);
                                        
                                        setFormData(p => ({
                                            ...p,
                                            qtyPackages: val,
                                            totalPieces: p.packagingType === 'pacote' 
                                                ? (p.qtyPerPackaging || 200) * val 
                                                : val,
                                            labelWeight: nextWeight || p.labelWeight,
                                            remainingQuantity: nextWeight || p.remainingQuantity
                                        }));
                                    }}
                                    className="w-full px-3 py-2 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-center"
                                    min="1"
                                    required
                                />
                            </div>
                            <div className="space-y-1 flex flex-col justify-end">
                                <span className="text-xs text-slate-500 font-semibold mb-2">
                                    {formData.packagingType === 'pacote' 
                                        ? `Equivale a: ${(formData.totalPieces || 0)} un` 
                                        : formData.packagingType === 'barra'
                                        ? `Equivale a: ${(formData.pieceSize || 0) * (formData.qtyPackages || 1)} m`
                                        : `Peso base: ${formData.labelWeight} kg`}
                                </span>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Peso Atual (kg)</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={formData.remainingQuantity}
                                onChange={e => {
                                    const val = e.target.value.replace(/\D/g, '');
                                    setFormData({ ...formData, remainingQuantity: parseInt(val) || 0 });
                                }}
                                className="w-full px-3 py-2 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none no-spinner"
                                required
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Status</label>
                            <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as any })} className="w-full px-3 py-2 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                                <option value="Disponível">Disponível</option>
                                <option value="Reservado">Reservado</option>
                                <option value="Em Produção">Em Produção</option>
                                <option value="Consumido">Consumido</option>
                            </select>
                        </div>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors">Cancelar</button>
                        <button type="submit" className="flex-1 px-4 py-2 bg-[#0F3F5C] text-white font-bold rounded-xl hover:bg-[#0A2A3D] transition-colors shadow-lg shadow-blue-900/20">Salvar Alterações</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const ConsumeLotModal: React.FC<{ item: StockItem; onClose: () => void; onSave: (i: StockItem) => void; currentUser: User | null }> = ({ item, onClose, onSave, currentUser }) => {
    const [formData, setFormData] = useState({
        weight: item.remainingQuantity,
        observation: '',
        reason: 'Uso na Produção'
    });

    const hasPackaging = item.packagingType && item.packagingType !== 'granel';
    const unitName = item.packagingType === 'rolo' ? 'rolo' : item.packagingType === 'pacote' ? 'pacote' : item.packagingType === 'barra' ? 'barra' : 'unidade';
    
    // Calculate current remaining units based on remainingQuantity ratio
    const currentRatio = item.labelWeight && item.labelWeight > 0 ? (item.remainingQuantity / item.labelWeight) : 1;
    const remainingUnits = Math.max(1, Math.round((item.qtyPackages || 1) * currentRatio));
    const weightPerUnit = item.qtyPackages && item.qtyPackages > 0 ? (item.labelWeight / item.qtyPackages) : item.labelWeight;

    const [consumeType, setConsumeType] = useState<'weight' | 'unit'>(hasPackaging ? 'unit' : 'weight');
    const [unitsToConsume, setUnitsToConsume] = useState<number>(1);

    // Initialize weight if consuming by unit initially
    useEffect(() => {
        if (hasPackaging) {
            setFormData(prev => ({
                ...prev,
                weight: Math.min(item.remainingQuantity, Number((1 * weightPerUnit).toFixed(2)))
            }));
        }
    }, [hasPackaging, weightPerUnit, item.remainingQuantity]);

    const handleUnitsChange = (val: number) => {
        const sanitizedVal = Math.min(remainingUnits, Math.max(1, val));
        setUnitsToConsume(sanitizedVal);
        const calculatedWeight = Number((sanitizedVal * weightPerUnit).toFixed(2));
        setFormData(prev => ({
            ...prev,
            weight: Math.min(item.remainingQuantity, calculatedWeight)
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const newWeight = Math.max(0, item.remainingQuantity - formData.weight);

        const updated: StockItem = {
            ...item,
            remainingQuantity: newWeight,
            status: newWeight <= 0 ? 'Consumido' : item.status,
            history: [...(item.history || []), {
                type: 'Baixa de Lote',
                date: new Date().toISOString(),
                details: {
                    'Motivo': formData.reason,
                    'Peso Retirado': `${formData.weight.toFixed(2)} kg`,
                    'Peso Restante': `${newWeight.toFixed(2)} kg`,
                    'Observação': formData.observation || '-',
                    'Operador': currentUser?.username || 'Sistema',
                    ...(hasPackaging ? {
                        'Unidades Retiradas': `${consumeType === 'unit' ? unitsToConsume : Math.round(formData.weight / weightPerUnit)} ${unitName}${Math.round(formData.weight / weightPerUnit) !== 1 ? 's' : ''}`
                    } : {})
                }
            }]
        };
        onSave(updated);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 border">
                <div className="bg-[#0F3F5C] p-4 text-white flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-bold">Dar Baixa no Lote</h2>
                        <p className="text-xs opacity-80">{item.internalLot} - {item.materialType} {item.bitola}</p>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors"><XIcon className="h-6 w-6" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex justify-between items-center animate-fadeIn">
                        <div className="flex flex-col">
                            <span className="text-xs font-bold text-blue-800 uppercase">Saldo Atual:</span>
                            {hasPackaging && (
                                <span className="text-[10px] font-bold text-blue-600 uppercase mt-0.5">({remainingUnits} {unitName}{remainingUnits !== 1 ? 's' : ''})</span>
                            )}
                        </div>
                        <span className="text-xl font-black text-[#0F3F5C]">{item.remainingQuantity.toFixed(2)} kg</span>
                    </div>

                    {hasPackaging ? (
                        <div className="space-y-4">
                            {/* Segmented Control / Toggle */}
                            <div className="bg-slate-100 p-1 rounded-xl flex gap-1 border">
                                <button
                                    type="button"
                                    onClick={() => setConsumeType('unit')}
                                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${consumeType === 'unit' ? 'bg-[#0F3F5C] text-white shadow-sm' : 'text-slate-600 hover:text-[#0F3F5C]'}`}
                                >
                                    Por {unitName.charAt(0).toUpperCase() + unitName.slice(1)}s
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setConsumeType('weight')}
                                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${consumeType === 'weight' ? 'bg-[#0F3F5C] text-white shadow-sm' : 'text-slate-600 hover:text-[#0F3F5C]'}`}
                                >
                                    Por Peso (kg)
                                </button>
                            </div>

                            {consumeType === 'unit' ? (
                                <div className="space-y-2 animate-fadeIn">
                                    <label className="block text-xs font-bold text-slate-500 uppercase">Qtd de {unitName}s para Baixar (Max: {remainingUnits})</label>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleUnitsChange(unitsToConsume - 1)}
                                            className="px-4 py-3 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-black rounded-xl text-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                            disabled={unitsToConsume <= 1}
                                        >
                                            -
                                        </button>
                                        <input
                                            type="number"
                                            value={unitsToConsume}
                                            onChange={e => handleUnitsChange(parseInt(e.target.value) || 0)}
                                            min="1"
                                            max={remainingUnits}
                                            className="flex-grow p-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-center text-lg"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleUnitsChange(unitsToConsume + 1)}
                                            className="px-4 py-3 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-black rounded-xl text-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                            disabled={unitsToConsume >= remainingUnits}
                                        >
                                            +
                                        </button>
                                    </div>
                                    <p className="text-xs font-semibold text-slate-500 mt-1 italic">
                                        Equivale a cerca de <span className="font-bold text-slate-700">{formData.weight.toFixed(2)} kg</span>
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-1 animate-fadeIn">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Quantidade para Baixar (kg)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.weight || ''}
                                        onChange={e => {
                                            const w = parseFloat(e.target.value) || 0;
                                            setFormData({ ...formData, weight: w });
                                            const u = Math.max(1, Math.round(w / weightPerUnit));
                                            setUnitsToConsume(Math.min(remainingUnits, u));
                                        }}
                                        max={item.remainingQuantity}
                                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-lg"
                                        required
                                    />
                                    <p className="text-xs font-semibold text-slate-500 mt-1 italic">
                                        Equivale a retirar cerca de <span className="font-bold text-slate-700">{Math.round(formData.weight / weightPerUnit)} {unitName}{Math.round(formData.weight / weightPerUnit) !== 1 ? 's' : ''}</span>
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Quantidade para Baixar (kg)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={formData.weight || ''}
                                onChange={e => setFormData({ ...formData, weight: parseFloat(e.target.value) || 0 })}
                                max={item.remainingQuantity}
                                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-lg"
                                required
                            />
                        </div>
                    )}

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Motivo / Destino</label>
                        <select
                            value={formData.reason}
                            onChange={e => setFormData({ ...formData, reason: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                        >
                            <option value="Uso na Produção">Uso na Produção</option>
                            <option value="Uso para Treliça">Uso para Treliça</option>
                            <option value="Uso para Trefila">Uso para Trefila</option>
                            <option value="Correção de Inventário">Correção de Inventário</option>
                            <option value="Sucata / Perda">Sucata / Perda</option>
                            <option value="Outro">Outro</option>
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Observações Extras</label>
                        <textarea
                            value={formData.observation}
                            onChange={e => setFormData({ ...formData, observation: e.target.value })}
                            placeholder="Ex: Utilizado para fazer treliça H12..."
                            className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none min-h-[100px]"
                        />
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-3 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors cursor-pointer">Cancelar</button>
                        <button type="submit" className="flex-1 px-4 py-3 bg-[#0F3F5C] text-white font-bold rounded-xl hover:bg-[#0A2A3D] transition-colors shadow-lg shadow-blue-900/20 cursor-pointer">Confirmar Baixa</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default StockControl;
