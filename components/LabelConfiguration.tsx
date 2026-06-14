import React, { useState, useEffect, useRef } from 'react';
import type { StockGauge } from '../types';

interface LabelConfigurationProps {
    gauges: StockGauge[];
    showNotification: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

// Default items if database is empty or offline
const DEFAULT_PRESETS: StockGauge[] = [
    {
        id: 'PRESET-1',
        productCode: '0025',
        materialType: 'ROLO CA-60',
        gauge: '4,20 mm',
        bitolaNominal: '4,20 mm (Ø)',
        weightPerMeter: 0.108,
        technicalDescription: 'Norma ABNT NBR 7480',
        defaultSteelType: 'SAE 1008',
        packagingType: 'Rolo',
        status: 'Ativo',
        imageUrl: '/images/wire_coil.png'
    },
    {
        id: 'PRESET-2',
        productCode: '0032',
        materialType: 'BARRA CA-50',
        gauge: '8,00 mm',
        bitolaNominal: '8,00 mm (Barra)',
        weightPerMeter: 0.395,
        technicalDescription: 'Norma ABNT NBR 7480',
        defaultSteelType: 'CA-50',
        packagingType: 'Fardo de Barras',
        status: 'Ativo',
        imageUrl: '/images/steel_bars.png'
    },
    {
        id: 'PRESET-3',
        productCode: '0012',
        materialType: 'BOBINA FIO MÁQUINA',
        gauge: '6,30 mm',
        bitolaNominal: '6,30 mm (Ø)',
        weightPerMeter: 0.245,
        technicalDescription: 'Norma ABNT NBR 7480',
        defaultSteelType: 'SAE 1006 / 1008',
        packagingType: 'Bobina',
        status: 'Ativo',
        imageUrl: '/images/wire_coil.png'
    }
];

const LabelConfiguration: React.FC<LabelConfigurationProps> = ({ gauges = [], showNotification }) => {
    // Combine db gauges with defaults to guarantee we have presets to display
    const dbGaugesFiltered = gauges.filter(g => g.materialType && g.gauge);
    const presets = dbGaugesFiltered.length > 0 ? dbGaugesFiltered : DEFAULT_PRESETS;

    // Selected Preset
    const [selectedPresetId, setSelectedPresetId] = useState<string>(presets[0]?.id || '');

    // Form inputs state
    const [productCode, setProductCode] = useState('0025');
    const [material, setMaterial] = useState('ROLO CA-60');
    const [bitola, setBitola] = useState('4,20 mm (Ø)');
    const [conversionFactor, setConversionFactor] = useState('0,108 kg/m');
    const [specification, setSpecification] = useState('Norma ABNT NBR 7480');
    const [composition, setComposition] = useState('SAE 1008');
    const [origin, setOrigin] = useState('Fabricado (Interno)');
    const [status, setStatus] = useState('Ativo');
    const [imageUrl, setImageUrl] = useState('/images/wire_coil.png');

    // Lot details
    const [lotNumber, setLotNumber] = useState('LOTE-2026-0043');
    const [currentTime, setCurrentTime] = useState('');

    // Toggle options
    const [showImage, setShowImage] = useState(true);
    const [showBarcode, setShowBarcode] = useState(true);
    const [showQrCode, setShowQrCode] = useState(true);
    const [showComposition, setShowComposition] = useState(true);
    const [showOrigin, setShowOrigin] = useState(true);

    // Label printer config
    const [labelFormat, setLabelFormat] = useState<'portrait' | 'square'>('portrait'); // portrait = 100x150mm, square = 100x100mm
    const [previewTheme, setPreviewTheme] = useState<'light' | 'dark'>('dark'); // screen preview bg

    // DOM references for barcode and QR code containers
    const barcodeRef = useRef<SVGSVGElement | null>(null);
    const [qrCodeHtml, setQrCodeHtml] = useState<string>('');

    // Update preset attributes when a new one is selected
    useEffect(() => {
        const selected = presets.find(p => p.id === selectedPresetId);
        if (selected) {
            setProductCode(selected.productCode || '');
            setMaterial(selected.materialType || '');
            setBitola(selected.bitolaNominal || selected.gauge || '');
            
            const factor = selected.weightPerMeter ? `${selected.weightPerMeter.toString().replace('.', ',')} kg/m` : '';
            setConversionFactor(factor);
            
            setSpecification(selected.technicalDescription || '');
            setComposition(selected.defaultSteelType || '');
            setStatus(selected.status || 'Ativo');
            setImageUrl(selected.imageUrl || (selected.materialType?.toLowerCase().includes('barra') ? '/images/steel_bars.png' : '/images/wire_coil.png'));
        }
    }, [selectedPresetId]);

    // Live update clock (simulating current date and time on generation)
    useEffect(() => {
        const updateClock = () => {
            const now = new Date();
            const pad = (num: number) => num.toString().padStart(2, '0');
            const dateStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
            const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
            setCurrentTime(`${dateStr} - ${timeStr}`);
        };
        updateClock();
        const interval = setInterval(updateClock, 1000);
        return () => clearInterval(interval);
    }, []);

    // Generate Barcode using JsBarcode from CDN
    useEffect(() => {
        if (showBarcode && barcodeRef.current) {
            const jsBarcode = (window as any).JsBarcode;
            if (typeof jsBarcode !== 'undefined') {
                try {
                    jsBarcode(barcodeRef.current, lotNumber, {
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
                    console.error("Error rendering barcode with JsBarcode:", err);
                }
            }
        }
    }, [lotNumber, showBarcode]);

    // Generate QR Code using qrcode-generator from CDN
    useEffect(() => {
        if (showQrCode) {
            const qrcodeLib = (window as any).qrcode;
            if (typeof qrcodeLib !== 'undefined') {
                try {
                    // QR content can contain a deep link to lot tracking / inventory
                    const qrData = `https://msm.gestao/stock/track?lot=${lotNumber}&code=${productCode}&mat=${encodeURIComponent(material)}`;
                    const qr = qrcodeLib(0, 'M');
                    qr.addData(qrData);
                    qr.make();
                    
                    // Creates SVG markup with a 3px cell size
                    const svgMarkup = qr.createSvgTag(3, 0);
                    setQrCodeHtml(svgMarkup);
                } catch (err) {
                    console.error("Error generating QR code:", err);
                }
            } else {
                // Public API Fallback if offline library fails
                const apiQr = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(lotNumber)}" alt="QR Code" class="w-24 h-24 object-contain" />`;
                setQrCodeHtml(apiQr);
            }
        }
    }, [lotNumber, productCode, material, showQrCode]);

    const handlePrint = () => {
        window.print();
        showNotification("Enviado para a fila de impressão!", "success");
    };

    return (
        <div className="flex flex-col lg:flex-row gap-6 p-4 md:p-6 w-full text-slate-100 max-w-7xl mx-auto min-h-[calc(100vh-80px)] no-print">
            {/* Inline CSS styling for print override */}
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    /* Hide everything */
                    body, html, #root, .app-container, .main-content, .no-print {
                        visibility: hidden !important;
                        background: white !important;
                        height: auto !important;
                        overflow: visible !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    /* Show only the print-area element */
                    .printable-label-card {
                        visibility: visible !important;
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        box-shadow: none !important;
                        border: 2px solid black !important;
                        background: white !important;
                        color: black !important;
                        width: ${labelFormat === 'portrait' ? '100mm' : '100mm'} !important;
                        height: ${labelFormat === 'portrait' ? '150mm' : '100mm'} !important;
                        padding: 6mm !important;
                        box-sizing: border-box !important;
                        display: flex !important;
                        flex-direction: column !important;
                        justify-content: space-between !important;
                        page-break-inside: avoid !important;
                        page-break-after: always !important;
                    }
                    /* Set page rules */
                    @page {
                        size: ${labelFormat === 'portrait' ? '100mm 150mm' : '100mm 100mm'} !important;
                        margin: 0 !important;
                    }
                    /* Ensure print text remains pure black and sharp */
                    .printable-label-card text, 
                    .printable-label-card span, 
                    .printable-label-card div, 
                    .printable-label-card p,
                    .printable-label-card h1,
                    .printable-label-card h2,
                    .printable-label-card td,
                    .printable-label-card th {
                        color: black !important;
                        font-family: Arial, sans-serif !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                }
            `}} />

            {/* Left Controls Panel */}
            <div className="w-full lg:w-[420px] bg-[#0A1E31]/75 backdrop-blur-lg border border-white/10 rounded-2xl p-6 flex flex-col gap-6 shrink-0 shadow-xl">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <span>🏷️ Layout de Etiqueta</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                        Configure e visualize o visual da etiqueta antes de integrar ao fluxo de recebimento.
                    </p>
                </div>

                {/* Preset Dropdown */}
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Carregar Cadastro Existente</label>
                    <select
                        value={selectedPresetId}
                        onChange={(e) => setSelectedPresetId(e.target.value)}
                        className="bg-[#122A45] border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-[#00E5FF] transition-all cursor-pointer"
                    >
                        {presets.map(p => (
                            <option key={p.id} value={p.id}>
                                [{p.productCode || 'SEM CÓD'}] {p.materialType} - {p.gauge}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="h-px bg-white/10" />

                {/* Fields Editor Form */}
                <div className="flex flex-col gap-4 overflow-y-auto max-h-[420px] pr-2 scrollbar-thin">
                    <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Customizar Campos</h3>
                    
                    {/* Cod & Status */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Cód. Produto</label>
                            <input
                                type="text"
                                value={productCode}
                                onChange={(e) => setProductCode(e.target.value)}
                                className="bg-[#122A45] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#00E5FF] transition-all"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Status</label>
                            <input
                                type="text"
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                                className="bg-[#122A45] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#00E5FF] transition-all"
                            />
                        </div>
                    </div>

                    {/* Material Name */}
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Material</label>
                        <input
                            type="text"
                            value={material}
                            onChange={(e) => setMaterial(e.target.value)}
                            className="bg-[#122A45] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#00E5FF] transition-all"
                        />
                    </div>

                    {/* Bitola Nominal */}
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Bitola / Dimensão</label>
                        <input
                            type="text"
                            value={bitola}
                            onChange={(e) => setBitola(e.target.value)}
                            className="bg-[#122A45] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#00E5FF] transition-all"
                        />
                    </div>

                    {/* Fator Conversao & Espec */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Fator Conversão</label>
                            <input
                                type="text"
                                value={conversionFactor}
                                onChange={(e) => setConversionFactor(e.target.value)}
                                className="bg-[#122A45] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#00E5FF] transition-all"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Especificação</label>
                            <input
                                type="text"
                                value={specification}
                                onChange={(e) => setSpecification(e.target.value)}
                                className="bg-[#122A45] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#00E5FF] transition-all"
                            />
                        </div>
                    </div>

                    {/* Composição & Origem */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Composição</label>
                            <input
                                type="text"
                                value={composition}
                                onChange={(e) => setComposition(e.target.value)}
                                className="bg-[#122A45] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#00E5FF] transition-all"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Fabricação / Origem</label>
                            <input
                                type="text"
                                value={origin}
                                onChange={(e) => setOrigin(e.target.value)}
                                className="bg-[#122A45] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#00E5FF] transition-all"
                            />
                        </div>
                    </div>

                    {/* Imagem do Produto URL */}
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Imagem URL</label>
                        <input
                            type="text"
                            value={imageUrl}
                            onChange={(e) => setImageUrl(e.target.value)}
                            className="bg-[#122A45] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#00E5FF] transition-all"
                        />
                    </div>

                    {/* Test Lot Code */}
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Lote para Teste (Código Barras/QR)</label>
                        <input
                            type="text"
                            value={lotNumber}
                            onChange={(e) => setLotNumber(e.target.value)}
                            className="bg-[#122A45] border border-white/10 rounded-xl p-2.5 text-xs font-mono text-white focus:outline-none focus:border-[#00E5FF] transition-all"
                        />
                    </div>
                </div>

                <div className="h-px bg-white/10" />

                {/* Print & Formatting Toggles */}
                <div className="flex flex-col gap-4">
                    <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Opções de Visualização</h3>
                    
                    {/* Dimension format selector */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Tamanho da Etiqueta Física</label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => setLabelFormat('portrait')}
                                className={`py-2 px-3 text-xs rounded-xl font-bold transition-all ${labelFormat === 'portrait' ? 'bg-[#00E5FF] text-[#0A1E31]' : 'bg-[#122A45] hover:bg-white/5 border border-white/10 text-slate-300'}`}
                            >
                                100 x 150 mm (Retrato)
                            </button>
                            <button
                                onClick={() => setLabelFormat('square')}
                                className={`py-2 px-3 text-xs rounded-xl font-bold transition-all ${labelFormat === 'square' ? 'bg-[#00E5FF] text-[#0A1E31]' : 'bg-[#122A45] hover:bg-white/5 border border-white/10 text-slate-300'}`}
                            >
                                100 x 100 mm (Quadrado)
                            </button>
                        </div>
                    </div>

                    {/* Section display toggles */}
                    <div className="flex flex-col gap-2">
                        <label className="flex items-center gap-3 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={showImage}
                                onChange={(e) => setShowImage(e.target.checked)}
                                className="w-4 h-4 rounded accent-[#00E5FF] cursor-pointer"
                            />
                            <span className="text-xs text-slate-300">Exibir Imagem do Produto</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={showBarcode}
                                onChange={(e) => setShowBarcode(e.target.checked)}
                                className="w-4 h-4 rounded accent-[#00E5FF] cursor-pointer"
                            />
                            <span className="text-xs text-slate-300">Exibir Código de Barras (Lote)</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={showQrCode}
                                onChange={(e) => setShowQrCode(e.target.checked)}
                                className="w-4 h-4 rounded accent-[#00E5FF] cursor-pointer"
                            />
                            <span className="text-xs text-slate-300">Exibir QR Code (Rastreabilidade)</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={showComposition}
                                onChange={(e) => setShowComposition(e.target.checked)}
                                className="w-4 h-4 rounded accent-[#00E5FF] cursor-pointer"
                            />
                            <span className="text-xs text-slate-300">Exibir Composição do Aço</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={showOrigin}
                                onChange={(e) => setShowOrigin(e.target.checked)}
                                className="w-4 h-4 rounded accent-[#00E5FF] cursor-pointer"
                            />
                            <span className="text-xs text-slate-300">Exibir Informações de Origem</span>
                        </label>
                    </div>

                    {/* Preview background selector */}
                    <div className="flex items-center justify-between text-xs text-slate-300 border-t border-white/5 pt-3">
                        <span>Fundo do Painel</span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPreviewTheme('dark')}
                                className={`px-2.5 py-1 rounded-md font-bold transition-all ${previewTheme === 'dark' ? 'bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/30' : 'text-slate-400 hover:text-slate-200'}`}
                            >
                                Escuro
                            </button>
                            <button
                                onClick={() => setPreviewTheme('light')}
                                className={`px-2.5 py-1 rounded-md font-bold transition-all ${previewTheme === 'light' ? 'bg-white/10 text-white border border-white/20' : 'text-slate-400 hover:text-slate-200'}`}
                            >
                                Claro
                            </button>
                        </div>
                    </div>
                </div>

                {/* Print trigger */}
                <button
                    onClick={handlePrint}
                    className="w-full mt-2 bg-[#00E5FF] hover:bg-[#00c8e0] text-[#0A1E31] font-extrabold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-[#00E5FF]/10 hover:shadow-[#00E5FF]/20 hover:scale-[1.01] active:scale-[0.99] transition-all"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0a2.25 2.25 0 01-2.24 2.156H8.58A2.25 2.25 0 016.34 18m11.32 0h-11.32M9 11V9a3 3 0 016 0v2m3.6 10.5a8.969 8.969 0 00-11.2 0" />
                    </svg>
                    Imprimir Etiqueta de Teste
                </button>
            </div>

            {/* Right Label Preview Canvas */}
            <div className={`flex-grow flex items-center justify-center rounded-2xl border border-white/5 p-8 transition-colors duration-300 relative shadow-inner ${previewTheme === 'dark' ? 'bg-[#071321]' : 'bg-slate-200'}`}>
                {/* Visual Guidelines */}
                <div className="absolute top-4 left-4 text-xs text-slate-400/80 font-mono hidden md:block">
                    <span>Área de Visualização Física ({labelFormat === 'portrait' ? '100 x 150 mm' : '100 x 100 mm'})</span>
                </div>

                {/* Physical Label Template */}
                <div 
                    className="printable-label-card bg-white text-black border-2 border-black p-5 shadow-2xl flex flex-col justify-between select-none"
                    style={{
                        width: '100mm',
                        height: labelFormat === 'portrait' ? '150mm' : '100mm',
                        boxSizing: 'border-box',
                        transition: 'height 0.3s ease'
                    }}
                >
                    {/* Header: Product Logo + Basic details */}
                    <div className="flex gap-4 items-start border-b-2 border-black pb-3">
                        {showImage && (
                            <div className="w-[64px] h-[64px] border border-slate-300 rounded overflow-hidden flex items-center justify-center shrink-0 bg-slate-50">
                                {imageUrl ? (
                                    <img 
                                        src={imageUrl} 
                                        alt="Produto" 
                                        className="w-full h-full object-contain"
                                        onError={(e) => {
                                            // Handle broken local image preview
                                            (e.currentTarget as HTMLImageElement).src = '/logo.png';
                                        }}
                                    />
                                ) : (
                                    <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                )}
                            </div>
                        )}
                        <div className="flex-grow flex flex-col">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-black tracking-wider text-slate-700 uppercase bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                    CÓD. {productCode || 'N/A'}
                                </span>
                                {status && (
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-pulse print:animate-none"></span>
                                        <span className="text-[10px] font-black text-emerald-700 uppercase">{status}</span>
                                    </div>
                                )}
                            </div>
                            <h1 className="text-sm font-black text-slate-900 mt-1 uppercase truncate">
                                {material || 'MATERIAL NÃO DEFINIDO'}
                            </h1>
                            <span className="text-[9px] font-bold text-slate-500 tracking-wide mt-0.5 uppercase">
                                MSM Sistemas de Gestão de Produção
                            </span>
                        </div>
                    </div>

                    {/* Specifications Grid */}
                    <div className="my-2.5 flex-grow">
                        <table className="w-full text-left border-collapse">
                            <tbody>
                                <tr className="border-b border-slate-200">
                                    <td className="py-1.5 text-[9px] font-extrabold text-slate-400 uppercase w-28">Bitola/Dimensão</td>
                                    <td className="py-1.5 text-xs font-black text-slate-900 uppercase">{bitola || 'N/A'}</td>
                                </tr>
                                <tr className="border-b border-slate-200">
                                    <td className="py-1.5 text-[9px] font-extrabold text-slate-400 uppercase">Fator Conversão</td>
                                    <td className="py-1.5 text-xs font-black text-slate-900 font-mono">{conversionFactor || 'N/A'}</td>
                                </tr>
                                <tr className="border-b border-slate-200">
                                    <td className="py-1.5 text-[9px] font-extrabold text-slate-400 uppercase">Especificação</td>
                                    <td className="py-1.5 text-xs font-bold text-slate-800 uppercase">{specification || 'N/A'}</td>
                                </tr>
                                {showComposition && composition && (
                                    <tr className="border-b border-slate-200">
                                        <td className="py-1.5 text-[9px] font-extrabold text-slate-400 uppercase">Composição</td>
                                        <td className="py-1.5 text-xs font-bold text-slate-800 uppercase">{composition}</td>
                                    </tr>
                                )}
                                {showOrigin && origin && (
                                    <tr className="border-b border-slate-200">
                                        <td className="py-1.5 text-[9px] font-extrabold text-slate-400 uppercase">Fabricado/Origem</td>
                                        <td className="py-1.5 text-xs font-bold text-slate-800 uppercase">{origin}</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Big Lot Code Banner */}
                    <div className="border-t border-b border-black py-2 my-1.5 text-center bg-slate-50">
                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">LOTE DE RASTREABILIDADE</span>
                        <span className="text-2xl font-black text-slate-900 font-mono tracking-wider block mt-0.5">
                            {lotNumber}
                        </span>
                    </div>

                    {/* Barcode Section (Lot number representation) */}
                    {showBarcode && (
                        <div className="flex flex-col items-center justify-center py-2.5 border-t border-b border-slate-200/80 bg-slate-50/50">
                            <svg 
                                ref={barcodeRef} 
                                id="barcode-canvas" 
                                className="max-w-full"
                            />
                        </div>
                    )}

                    {/* QR Code and Instructions Section */}
                    <div className="flex items-center justify-between gap-4 mt-3">
                        <div className="flex-grow flex flex-col justify-center border-l-4 border-black pl-3 py-1">
                            <span className="text-[10px] font-black tracking-widest text-slate-950 uppercase">ETIQUETA DE REGISTRO</span>
                            <p className="text-[8px] text-slate-600 font-bold leading-normal mt-0.5 max-w-[200px]">
                                Escaneie o código ao lado para rastrear as movimentações de estoque deste lote.
                            </p>
                        </div>
                        {showQrCode && qrCodeHtml && (
                            <div 
                                className="w-[68px] h-[68px] flex items-center justify-center bg-white shrink-0 border border-slate-200 rounded p-1"
                                dangerouslySetInnerHTML={{ __html: qrCodeHtml }}
                            />
                        )}
                    </div>

                    {/* Footer text (Generated indicator) */}
                    <div className="border-t border-slate-200 pt-2.5 mt-2 flex justify-between items-center text-[7px] font-black text-slate-400 uppercase tracking-wider">
                        <span>Gerado Automaticamente</span>
                        <span className="font-mono text-slate-500">{currentTime}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LabelConfiguration;
