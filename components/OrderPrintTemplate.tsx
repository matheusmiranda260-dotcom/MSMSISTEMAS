import React, { forwardRef } from 'react';
import type { CommercialOrder, CommercialOrderItem, StockGauge, Customer, Partner, User } from '../types';

export interface OrderPrintTemplateProps {
    order: CommercialOrder;
    items: CommercialOrderItem[];
    gauges: StockGauge[];
    customer: Customer | null;
    seller: User | null;
    activeBrandingPartner?: Partner | null;
    previewCodigo?: string;
    showItems?: boolean;
    showSummary?: boolean;
    paymentFees?: { card_1x: number, card_2x: number, card_3x: number };
}

export const OrderPrintTemplate = forwardRef<HTMLDivElement, OrderPrintTemplateProps>(({
    order,
    items,
    gauges,
    customer,
    seller,
    activeBrandingPartner,
    previewCodigo,
    showItems = true,
    showSummary = true,
    paymentFees = { card_1x: 3.46, card_2x: 4.85, card_3x: 5.44 }
}, ref) => {
    const bitolasSummary: Record<string, { kg: number }> = {};
    
    items.forEach(item => {
        const bitolasDetails = (item as any).bitolasDetails || (item as any).bitolas_details;
        if (bitolasDetails) {
            Object.entries(bitolasDetails).forEach(([bitolaId, kg]) => {
                if (bitolaId === 'pecas' || bitolaId === 'drawings') return;
                const kgNum = Number(kg) || 0;
                if (kgNum > 0) {
                    if (!bitolasSummary[bitolaId]) {
                        bitolasSummary[bitolaId] = { kg: 0 };
                    }
                    bitolasSummary[bitolaId].kg += kgNum;
                }
            });
        }
    });

    const multiplier = 1 + ((order.adjustmentPercentage || 0) / 100);

    const renderDrawingSvg = (d: any) => {
        const stroke = "black";
        const sw = "6"; // Thicker stroke for printing visibility
        const valA = d.a || 'A';
        const valB = d.b || 'B';
        const valC = d.c || 'C';
        
        switch (d.type) {
            case 'barra': 
                return <svg viewBox="0 0 100 30" className="w-full h-full text-black drop-shadow-sm">
                    <line x1="10" y1="20" x2="90" y2="20" stroke={stroke} strokeWidth={sw} strokeLinecap="round"/>
                    <text x="50" y="10" fill="red" fontSize="16" fontWeight="bold" textAnchor="middle">{valA}</text>
                </svg>;
            case 'ferro_l': 
                return <svg viewBox="0 0 100 100" className="w-full h-full text-black drop-shadow-sm">
                    <polyline points="30,20 30,75 80,75" fill="none" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round"/>
                    <text x="22" y="55" fill="red" fontSize="16" fontWeight="bold" textAnchor="end">{valA}</text>
                    <text x="55" y="95" fill="red" fontSize="16" fontWeight="bold" textAnchor="middle">{valB}</text>
                </svg>;
            case 'ferro_u': 
                return <svg viewBox="0 0 100 100" className="w-full h-full text-black drop-shadow-sm">
                    <polyline points="25,30 25,75 75,75 75,30" fill="none" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round"/>
                    <text x="18" y="60" fill="red" fontSize="16" fontWeight="bold" textAnchor="end">{valA}</text>
                    <text x="50" y="95" fill="red" fontSize="16" fontWeight="bold" textAnchor="middle">{valB}</text>
                    <text x="82" y="60" fill="red" fontSize="16" fontWeight="bold">{valC}</text>
                </svg>;
            case 'estribo': 
                return <svg viewBox="0 0 100 100" className="w-full h-full text-black drop-shadow-sm">
                    <rect x="25" y="25" width="50" height="50" fill="none" stroke={stroke} strokeWidth={sw} strokeLinejoin="round"/>
                    <polyline points="25,45 45,25" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round"/>
                    <polyline points="45,25 25,25 25,45" fill="none" stroke={stroke} strokeWidth={sw} strokeLinejoin="round"/>
                    <text x="18" y="55" fill="red" fontSize="16" fontWeight="bold" textAnchor="end">{valA}</text>
                    <text x="50" y="90" fill="red" fontSize="16" fontWeight="bold" textAnchor="middle">{valB}</text>
                </svg>;
            case 'caranguejo': 
                return <svg viewBox="0 0 100 100" className="w-full h-full text-black drop-shadow-sm">
                    <polyline points="15,75 30,60 30,40 70,40 70,60 85,45" fill="none" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round"/>
                    <text x="22" y="55" fill="red" fontSize="16" fontWeight="bold" textAnchor="end">{valA}</text>
                    <text x="50" y="30" fill="red" fontSize="16" fontWeight="bold" textAnchor="middle">{valB}</text>
                    <text x="82" y="70" fill="red" fontSize="16" fontWeight="bold">{valC}</text>
                </svg>;
            case 'bandeja': 
                return <svg viewBox="0 0 100 100" className="w-full h-full text-black drop-shadow-sm">
                    <polyline points="40,55 25,70 25,35 75,35 75,70 90,55" fill="none" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round"/>
                    <text x="50" y="25" fill="red" fontSize="16" fontWeight="bold" textAnchor="middle">{valA}</text>
                    <text x="18" y="55" fill="red" fontSize="16" fontWeight="bold" textAnchor="end">{valB}</text>
                    <text x="82" y="70" fill="red" fontSize="16" fontWeight="bold">{valC}</text>
                </svg>;
            case 'circular': 
                return <svg viewBox="0 0 100 100" className="w-full h-full text-black drop-shadow-sm">
                    <circle cx="50" cy="50" r="30" fill="none" stroke={stroke} strokeWidth={sw}/>
                    <text x="50" y="55" fill="red" fontSize="16" fontWeight="bold" textAnchor="middle">{valA}</text>
                </svg>;
            case 'espiral': 
                return <svg viewBox="0 0 100 100" className="w-full h-full text-black drop-shadow-sm">
                    <path d="M 20 45 Q 35 15 50 45 T 80 45" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round"/>
                    <path d="M 20 65 Q 35 25 50 65 T 80 65" fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" opacity="0.4"/>
                    <text x="50" y="95" fill="red" fontSize="12" fontWeight="bold" textAnchor="middle">{valA}(D), {valB}(P), {valC}(H)</text>
                </svg>;
            case 'custom':
            if (d.customData) {
                const { points, labels } = d.customData;
                if (!points || points.length === 0) return null;
                const pointsStr = points.map((p: any) => `${p.x},${p.y}`).join(' ');
                return (
                    <svg viewBox="0 0 400 400" className="w-full h-full text-black drop-shadow-sm">
                        <polyline points={pointsStr} fill="none" stroke={stroke} strokeWidth="12" strokeLinejoin="round" strokeLinecap="round"/>
                        {labels && labels.map((l: any, idx: number) => (
                            <text key={idx} x={l.x} y={l.y + 8} fill="red" fontSize="32" fontWeight="bold" textAnchor="middle">{d.dimensions?.[l.text] || l.text}</text>
                        ))}
                    </svg>
                );
            }
            return null;
        default: return null;
        }
    };

    const summaryRows = Object.keys(bitolasSummary).map(bitolaId => {
        const gauge = gauges.find(g => g.id === bitolaId);
        const kg = bitolasSummary[bitolaId].kg;
        let desc = 'AÇO DESCONHECIDO';
        if (gauge) {
            const name = gauge.commercialName || gauge.materialType;
            const nameUpper = name.toUpperCase();
            const prefix = (nameUpper.startsWith('CD') || nameUpper.startsWith('AR')) ? '' : 'CD ';
            desc = `${prefix}${name} ${gauge.gauge}`.trim();
        }
        
        const cod = gauge?.productCode || '';
        const basePricePerKg = (gauge?.rawWeightValue && gauge.rawWeightValue > 0) 
            ? (gauge.purchasePrice || 0) / gauge.rawWeightValue 
            : (gauge?.purchasePrice || 0);

        let rawPricePerKg = basePricePerKg;
        for (const item of items) {
            if (item.custom_prices && item.custom_prices[bitolaId] !== undefined) {
                rawPricePerKg = item.custom_prices[bitolaId];
                break;
            }
        }

        const pricePerKg = rawPricePerKg * multiplier;
        const total = kg * pricePerKg;

        return {
            id: bitolaId,
            cod,
            desc,
            kg,
            pricePerKg,
            total,
            isFreight: false
        };
    }).sort((a, b) => b.kg - a.kg);

    if (order.freight || order.freightValue) {
        summaryRows.push({
            id: 'FRETE',
            cod: '0100',
            desc: `FRETE${order.freight ? ` - ${order.freight}` : ''}`,
            kg: 1,
            pricePerKg: 0,
            total: order.freightValue || 0,
            isFreight: true
        });
    }

    const totalSummaryKg = summaryRows.filter(r => !r.isFreight).reduce((acc, r) => acc + r.kg, 0);
    const totalSummaryRs = summaryRows.reduce((acc, r) => acc + r.total, 0);
    const safeValue = totalSummaryRs || 0;

    const formattedDate = (order.date && String(order.date).includes('-')) 
        ? String(order.date).split('-').reverse().join('/') 
        : (order.date || '');

    return (
        <div ref={ref} className="bg-white min-h-[297mm] print:min-h-0 print:h-auto p-[10mm] print:p-0 text-[11px] font-sans text-black leading-tight w-full h-full print:shadow-none bg-gray-100 flex justify-center pb-20">
            <div className="w-full bg-white flex flex-col relative print:border-none border border-gray-200 shadow-lg p-6 rounded-lg print:p-0 print:shadow-none print:rounded-none">
                
                {/* 1. HEADER (Logo & Info) */}
                <div className="flex relative h-[120px] mb-4 overflow-hidden rounded-t-lg print:rounded-none border border-gray-300">
                    {/* Left Side: Logo */}
                    <div className="w-[45%] bg-white flex items-center justify-center p-4 z-10">
                        {activeBrandingPartner?.logoUrl ? (
                            <img src={activeBrandingPartner.logoUrl} alt="Logo Parceiro" className="max-w-[80%] max-h-full object-contain" />
                        ) : (
                            <img src="/logo.png" alt="Logo" className="max-w-[70%] max-h-full object-contain" />
                        )}
                    </div>

                    {/* Right Side Backgrounds (Slanted) */}
                    <div className="absolute inset-0 z-0 flex justify-end">
                        <div className="h-full w-[60%] relative">
                            {/* Orange stripe */}
                            <div className="absolute inset-0 bg-[#ff7300] skew-x-[-20deg] origin-bottom-left border-l-[6px] border-white" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}></div>
                            {/* Gray background */}
                            <div className="absolute inset-0 bg-[#2b2d31] skew-x-[-20deg] origin-bottom-left translate-x-3 flex items-center" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}></div>
                        </div>
                    </div>

                    {/* Right Side Content (Un-skewed text) */}
                    <div className="absolute right-0 top-0 bottom-0 w-[55%] z-20 flex flex-col justify-center text-white text-[9px] pl-10 leading-[1.4] pr-4">
                        <div className="font-bold text-[11px] mb-1 leading-tight uppercase">ARMAÇO FERRAGEM ARMADA, MATERIAIS PARA CONSTRUCAO E TRANSPORTE LTDA</div>
                        <div>CNPJ: 58.894.273/0001-07</div>
                        <div>Rua JC-28, Quadra 31 - Lotes 01-02</div>
                        <div>Residencial Jardim Canadá II, Senador Canedo/GO - CEP: 75.250-307</div>
                        <div className="flex items-center gap-1.5 mt-1">
                            <svg className="w-3 h-3 text-[#ff7300] fill-current" viewBox="0 0 24 24"><path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/></svg>
                            Telefone: {seller?.phone || 'INSERIR NO CADASTRO ESSA INFORMAÇÃO'}
                        </div>
                        <div className="flex items-center gap-1.5">
                            <svg className="w-3 h-3 text-[#ff7300] fill-current" viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
                            E-mail: {seller?.email || 'INSERIR NO CADASTRO ESSA INFORMAÇÃO'}
                        </div>
                        <div className="flex items-center gap-1.5 text-[#ff7300] font-bold">
                            <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
                            www.armacoferragens.com.br
                        </div>
                    </div>
                </div>

                {/* 2. ORÇAMENTO BANNER & NUMBER */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4 flex-1">
                        <div className="bg-[#ff7300] text-white p-2 px-3 rounded-r-lg shadow-sm flex items-center justify-center" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                            <svg className="w-8 h-8 fill-current" viewBox="0 0 24 24">
                                <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                            </svg>
                        </div>
                        <h1 className="text-4xl font-black text-[#333] uppercase tracking-wide">ORÇAMENTO</h1>
                    </div>
                    <div className="bg-[#2b2d31] text-white text-2xl font-bold px-6 py-2 rounded-l-lg tracking-widest shadow-sm flex items-center" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                        Nº {order.orderNumber}
                    </div>
                </div>

                {/* 3. CLIENT INFO */}
                <div className="border border-gray-300 rounded-lg overflow-hidden text-[10px] mb-6">
                    <div className="flex border-b border-gray-300">
                        <div className="w-2/3 border-r border-gray-300 p-2.5 flex items-center">
                            <span className="font-bold w-16 shrink-0">CLIENTE:</span>
                            <span className="uppercase font-semibold text-gray-800">{order.clientName}</span>
                        </div>
                        <div className="w-1/3 p-2.5 flex items-center">
                            <span className="font-bold w-[70px] shrink-0">CPF/CNPJ:</span>
                            <span className="uppercase font-semibold text-gray-800">{customer?.document1 || ''}</span>
                        </div>
                    </div>
                    <div className="flex border-b border-gray-300 p-2.5 items-center">
                        <span className="font-bold w-20 shrink-0">ENDEREÇO:</span>
                        <span className="uppercase font-semibold text-gray-800">{order.clientCity}</span>
                    </div>
                    <div className="flex">
                        <div className="w-[30%] border-r border-gray-300 p-2.5 flex items-center">
                            <span className="font-bold w-[75px] shrink-0">VENDEDOR:</span>
                            <span className="uppercase font-semibold text-gray-800 truncate">{seller?.fullName || order.salesperson}</span>
                        </div>
                        <div className="w-[35%] border-r border-gray-300 p-2.5 flex items-center gap-2">
                            <span className="font-bold shrink-0">DATA DE EMISSÃO:</span>
                            <svg className="w-4 h-4 text-[#ff7300] fill-current" viewBox="0 0 24 24"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z"/></svg>
                            <span className="font-semibold text-gray-800">{formattedDate}</span>
                        </div>
                        <div className="w-[35%] p-2.5 flex items-center gap-2">
                            <span className="font-bold shrink-0">PRAZO DE ENTREGA:</span>
                            <svg className="w-4 h-4 text-[#ff7300] fill-current" viewBox="0 0 24 24"><path d="M20 8h-3V4H3v13h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zm-12 9c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm8.5-7l1.96 2.5H17V10h-2.5zm-2 7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/></svg>
                            <span className="uppercase font-semibold text-gray-800">{order.deliveryTime || '10 DIAS ÚTEIS'}</span>
                        </div>
                    </div>
                </div>

                {/* 4. ITENS DO ORÇAMENTO */}
                {showItems && (
                    <div className="mb-6">
                        <div className="bg-[#ff7300] text-white font-bold text-[11px] uppercase px-4 py-2 rounded-t-xl flex items-center gap-2 w-max" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M21 16.5c0 .38-.21.71-.53.88l-7.9 4.44c-.16.12-.36.18-.57.18-.21 0-.41-.06-.57-.18l-7.9-4.44A.991.991 0 0 1 3 16.5v-9c0-.38.21-.71.53-.88l7.9-4.44c.16-.12.36-.18.57-.18.21 0 .41.06.57.18l7.9 4.44c.32.17.53.5.53.88v9zM12 4.15L6.04 7.5 12 10.85l5.96-3.35L12 4.15zM5 15.91l6 3.38v-6.71L5 9.19v6.72zm14 0v-6.72l-6 3.39v6.71l6-3.38z"/></svg>
                            ITENS DO ORÇAMENTO
                        </div>
                        <div className="border border-gray-300 rounded-tr-lg rounded-b-lg overflow-hidden -mt-[1px]">
                            <table className="w-full text-center border-collapse table-fixed">
                                <thead>
                                    <tr className="bg-[#2b2d31] text-white font-bold text-[10px]" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                        <th className="p-2 border-r border-gray-400 w-[10%] bg-[#2b2d31] text-white" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>ITEM</th>
                                        <th className="p-2 border-r border-gray-400 w-[10%] bg-[#2b2d31] text-white" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>{(items.length > 0 ? items[0].codigo : previewCodigo) === 'DETALHADO' ? 'QTD PEÇAS' : 'FOLHA'}</th>
                                        <th className="p-2 border-r border-gray-400 bg-[#2b2d31] text-white" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>{(items.length > 0 ? items[0].codigo : previewCodigo) === 'DETALHADO' ? 'DESCRIÇÃO' : 'ETAPA / DESCRIÇÃO'}</th>
                                        <th className="p-2 border-r border-gray-400 w-[12%] bg-[#2b2d31] text-white" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>TIPO</th>
                                        <th className="p-2 border-r border-gray-400 w-[12%] bg-[#2b2d31] text-white" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>QTD (KG)</th>
                                        <th className="p-2 w-[15%] bg-[#2b2d31] text-white" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>PREÇO TOTAL</th>
                                    </tr>
                                </thead>
                                <tbody className="text-[10px]">
                                    {items.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="border-b border-gray-200 p-3 text-center text-gray-500 italic">
                                                Nenhum item adicionado
                                            </td>
                                        </tr>
                                    ) : (
                                        items.map((item, idx) => {
                                            const totalPeso = items.reduce((acc, i) => acc + (i.peso || 0), 0);
                                            const prop = totalPeso > 0 ? (item.peso || 0) / totalPeso : (1 / items.length);
                                            const itemFreight = (order.freightValue || 0) * prop;
                                            const finalValor = ((item.valor || 0) * multiplier) + itemFreight;
                                            
                                            return (
                                                <tr key={`item-${idx}`} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} border-b border-gray-200`}>
                                                    <td className="p-1 border-r border-gray-200 font-semibold">{idx + 1}</td>
                                                    <td className="p-1 border-r border-gray-200 font-semibold">{item.folha || '\u00A0'}</td>
                                                    <td className="p-1 border-r border-gray-200 uppercase text-center break-words px-2">
                                                        {(() => {
                                                            const bitolasDetails = (item as any).bitolasDetails || (item as any).bitolas_details;
                                                            if (bitolasDetails && bitolasDetails['drawings'] && bitolasDetails['drawings'].length > 0) {
                                                                return (
                                                                    <div className="flex flex-col items-center justify-center gap-1 w-full my-1">
                                                                        {bitolasDetails['drawings'].map((drawing: any, dIdx: number) => (
                                                                            <div key={dIdx} className="flex items-center justify-center gap-1">
                                                                                <span className="text-[9px] text-gray-700 font-semibold">{drawing.qty} pç:</span>
                                                                                <div className="h-10 w-16 flex items-center justify-center">
                                                                                    {renderDrawingSvg(drawing)}
                                                                                </div>
                                                                                <span className="text-[9px] text-gray-700 font-bold">
                                                                                    ∅{(() => {
                                                                                        const gId = drawing.gaugeId || drawing.gauge_id;
                                                                                        if (!gId) return 'N/A';
                                                                                        const g = gauges.find(gg => String(gg.id) === String(gId));
                                                                                        if (!g) return `?`;
                                                                                        const num = parseFloat((g.gauge || '').replace(',', '.').replace(/[^\d.]/g, ''));
                                                                                        if (!isNaN(num) && num > 0) return `${num}MM`;
                                                                                        return (g.commercialName || g.materialType || g.gauge || '').toUpperCase();
                                                                                    })()}
                                                                                </span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                );
                                                            }
                                                            return <div className="font-semibold text-gray-800">{item.descricao?.split(' --- DESENHOS: ')[0] || '\u00A0'}</div>;
                                                        })()}
                                                    </td>
                                                    <td className="p-1 border-r border-gray-200 font-semibold uppercase text-[9px]">{item.tipo || '\u00A0'}</td>
                                                    <td className="p-1 border-r border-gray-200 font-semibold">{item.peso > 0 ? item.peso.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '0,00'}</td>
                                                    <td className="p-1 font-bold text-gray-800">
                                                        {finalValor > 0 ? `R$ ${finalValor.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : 'R$ -'}
                                                    </td>
                                                </tr>
                                            )
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 5. RESUMO DO AÇO */}
                {showSummary && (
                    <div className="mb-4 flex-1">
                        <div className="bg-[#ff7300] text-white font-bold text-[11px] uppercase px-4 py-2 rounded-t-xl flex items-center gap-2 w-max" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/></svg>
                            RESUMO DO AÇO
                        </div>
                        <div className="border border-gray-300 rounded-tr-lg rounded-b-lg overflow-hidden -mt-[1px]">
                            <table className="w-full text-center border-collapse table-fixed">
                                <thead>
                                    <tr className="bg-[#2b2d31] text-white font-bold text-[10px]" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                        <th className="p-2 border-r border-gray-400 w-[12%] bg-[#2b2d31] text-white" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>CÓD.</th>
                                        <th className="p-2 border-r border-gray-400 bg-[#2b2d31] text-white" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>DESCRIÇÃO</th>
                                        <th className="p-2 border-r border-gray-400 w-[12%] bg-[#2b2d31] text-white" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>QTD</th>
                                        <th className="p-2 border-r border-gray-400 w-[8%] bg-[#2b2d31] text-white" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>UND</th>
                                        <th className="p-2 border-r border-gray-400 w-[16%] bg-[#2b2d31] text-white" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>PREÇO UNIT. (KG)</th>
                                        <th className="p-2 w-[18%] bg-[#2b2d31] text-white" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>PREÇO TOTAL</th>
                                    </tr>
                                </thead>
                                <tbody className="text-[10px]">
                                    {summaryRows.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="border-b border-gray-200 p-3 text-center text-gray-500 italic">
                                                Nenhum aço contabilizado
                                            </td>
                                        </tr>
                                    ) : (
                                        summaryRows.map((row, idx) => (
                                            <tr key={`sum-${idx}`} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} border-b border-gray-200`}>
                                                <td className="p-1.5 border-r border-gray-200 font-semibold">{row.cod || idx + 1}</td>
                                                <td className="p-1.5 border-r border-gray-200 uppercase font-semibold text-center truncate px-2">{row.desc || '\u00A0'}</td>
                                                <td className="p-1.5 border-r border-gray-200 font-semibold">{row.isFreight ? '1' : (row.kg > 0 ? row.kg.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '0,00')}</td>
                                                <td className="p-1.5 border-r border-gray-200 font-semibold">{row.isFreight ? '\u00A0' : 'KG'}</td>
                                                <td className="p-1.5 border-r border-gray-200 font-semibold text-gray-800">
                                                    {row.isFreight ? '\u00A0' : (row.pricePerKg > 0 ? `R$ ${row.pricePerKg.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : '\u00A0')}
                                                </td>
                                                <td className="p-1.5 font-bold text-gray-800">
                                                    {row.total > 0 ? `R$ ${row.total.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : 'R$ -'}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 6. TOTALS GRID */}
                <div className="flex justify-end mb-6">
                    <div className="w-[60%]">
                        <table className="w-full border-collapse border border-gray-300 rounded-lg overflow-hidden text-[10px]">
                            <tbody>
                                <tr className="border-b border-gray-300">
                                    <td className="w-10 bg-[#2b2d31] text-white p-2 align-middle border-b-0 border-gray-300" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                        <div className="flex justify-center items-center w-full h-full">
                                            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg>
                                        </div>
                                    </td>
                                    <td className="bg-gray-100 p-2 font-bold uppercase tracking-wide border-r border-gray-300 w-1/2">VALOR TOTAL</td>
                                    <td className="bg-gray-100 p-2 text-center font-black text-sm">R$ {totalSummaryRs > 0 ? totalSummaryRs.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '0,00'}</td>
                                </tr>
                                <tr className="border-b border-gray-300">
                                    <td className="w-10 bg-[#2b2d31] text-white p-2 align-middle border-b-0 border-gray-300" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                        <div className="flex justify-center items-center w-full h-full">
                                            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12 3c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-1 5v5h2V8h-2zm-3 8.5v3h8v-3H8zm-5-3l1.8-6h14.4l1.8 6H3z"/></svg>
                                        </div>
                                    </td>
                                    <td className="p-2 font-bold uppercase tracking-wide border-r border-gray-300">PESO TOTAL</td>
                                    <td className="p-2 text-center font-black text-[12px]">{totalSummaryKg > 0 ? totalSummaryKg.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '0,00'} KG</td>
                                </tr>
                                {order.paymentCondition === 'CARTÃO (MOSTRAR OPÇÕES)' ? (
                                    <>
                                        <tr className="border-b border-gray-300">
                                            <td rowSpan={3} className="w-10 bg-[#2b2d31] text-white p-2 align-middle border-b-0 border-gray-300" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                                <div className="flex justify-center items-center w-full h-full">
                                                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/></svg>
                                                </div>
                                            </td>
                                            <td className="bg-gray-100 p-2 font-bold uppercase tracking-wide border-r border-gray-300">TOTAL CARTÃO 1x R$</td>
                                            <td className="bg-gray-100 p-2 text-center font-bold text-[12px]">R$ {(safeValue * (1 + paymentFees.card_1x / 100)).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                        </tr>
                                        <tr className="border-b border-gray-300">
                                            <td className="bg-gray-100 p-2 font-bold uppercase tracking-wide border-r border-gray-300">TOTAL CARTÃO 2x R$</td>
                                            <td className="bg-gray-100 p-2 text-center font-bold text-[12px]">R$ {(safeValue * (1 + paymentFees.card_2x / 100)).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                        </tr>
                                        <tr>
                                            <td className="bg-gray-100 p-2 font-bold uppercase tracking-wide border-r border-gray-300">TOTAL CARTÃO 3x R$</td>
                                            <td className="bg-gray-100 p-2 text-center font-bold text-[12px]">R$ {(safeValue * (1 + paymentFees.card_3x / 100)).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                        </tr>
                                    </>
                                ) : (
                                    <tr>
                                        <td className="w-10 bg-[#2b2d31] text-white p-2 align-middle border-b-0 border-gray-300" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                            <div className="flex justify-center items-center w-full h-full">
                                                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/></svg>
                                            </div>
                                        </td>
                                        <td className="bg-gray-100 p-2 font-bold uppercase tracking-wide border-r border-gray-300">CONDIÇÃO DE PAGAMENTO</td>
                                        <td className="bg-gray-100 p-2 text-center font-bold text-[11px] uppercase truncate">{order.paymentCondition || 'À VISTA'}</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 7. OBSERVAÇÕES */}
                <div className="border border-gray-300 rounded-lg overflow-hidden mb-4">
                    <div className="bg-[#2b2d31] text-white font-bold text-[10px] px-3 py-1.5 flex items-center gap-2" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/></svg>
                        OBSERVAÇÕES
                    </div>
                    <div className="p-3 text-[9px] leading-[1.6] font-semibold bg-gray-50 text-gray-800">
                        <p>01 - O orçamento é baseado nos resumos do aço dos projetos fornecidos pelo cliente. Caso haja divergência, ocorrerá a alteração de valores e prazos;</p>
                        <p>02 - A entrega está dividida em 1 etapa, e a descarga e conferência do material é de responsabilidade do cliente;</p>
                        <p>03 - Caso a entrega não possa acontecer na data acordada, por eventualidade do cliente, será cobrado um novo frete adicional e a entrega será reprogramada em até 7 dias;</p>
                        <p>04 - O prazo de reclamação do pedido é de até 48 horas após a entrega;</p>
                        <p>05 - O prazo de entrega dos produtos será contado a partir da confirmação do pagamento antecipado;</p>
                        {order.importantObs && order.importantObs.length > 0 && order.importantObs.map((obs, idx) => (
                            <p key={idx} className="text-[#ff7300] font-bold mt-1">{(idx + 6).toString().padStart(2, '0')} - {obs}</p>
                        ))}
                    </div>
                </div>

                {/* 8. FOOTER BANNER */}
                <div className="bg-[#2b2d31] text-white text-center py-2 font-bold text-[10px] flex items-center justify-center gap-2 rounded-lg mt-auto" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zm-5-7h3v3h-3z"/></svg>
                    <span>VALIDADE DO ORÇAMENTO: <span className="text-[#ff7300]">01 DIA</span></span>
                </div>

            </div>
        </div>
    );
});
