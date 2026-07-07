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
        <div ref={ref} className="bg-white min-h-[297mm] print:min-h-0 print:h-auto p-[10mm] print:p-0 text-[11px] font-sans text-black leading-tight w-full h-full shadow-2xl overflow-hidden print:shadow-none">
            <div className="border border-black flex flex-col h-full bg-white relative">
                {/* HEADER */}
                <div className="flex border-b border-black h-[140px]">
                    {/* Logo Box */}
                    <div className="w-1/3 border-r border-black flex flex-col items-center justify-center p-2 h-[140px]">
                        {activeBrandingPartner?.logoUrl ? (
                            <img src={activeBrandingPartner.logoUrl} alt="Logo Parceiro" className="max-w-[90%] max-h-full object-contain" />
                        ) : (
                            <img src="/logo.png" alt="Logo" className="max-w-[90%] max-h-full object-contain" />
                        )}
                    </div>
                    
                    {/* Company Details Box */}
                    <div className="w-2/3 p-2 text-center flex flex-col justify-center gap-0.5" style={{ fontSize: '10px' }}>
                        <div className="font-bold uppercase">ARMAÇO FERRAGEM ARMADA, MATERIAIS PARA CONSTRUCAO E TRANSPORTE LTDA</div>
                        <div>CNPJ: 58.894.273/0001-07</div>
                        <div>Rua JC-28, Quadra 31 - Lotes 01-02</div>
                        <div>Residencial Jardim Canedo II, Senador Canedo/GO - CEP: 75.250-307</div>
                        <div>Telefone: {seller?.phone || 'INSERIR NO CADASTRO ESSA INFORMAÇÃO'}</div>
                        <div>E-mail: {seller?.email || 'INSERIR NO CADASTRO ESSA INFORMAÇÃO'}</div>
                        <div className="text-blue-600 underline">www.armacoferragens.com.br</div>
                    </div>
                </div>

                {/* CLIENT INFO */}
                <div className="text-[12px] leading-[1.5]">
                    <div className="flex border-b border-black">
                        <div className="w-2/3 border-r border-black p-1.5 flex items-center overflow-hidden">
                            <span className="font-bold w-16 shrink-0 pt-0.5 pb-1">Cliente:</span> 
                            <span className="uppercase w-full pt-0.5 pb-1 whitespace-nowrap overflow-hidden text-ellipsis">{order.clientName}</span>
                        </div>
                        <div className="w-1/3 p-1.5 flex items-center overflow-hidden">
                            <span className="font-bold w-20 shrink-0 pt-0.5 pb-1">CPF/CNPJ:</span> 
                            <span className="uppercase w-full pt-0.5 pb-1 whitespace-nowrap overflow-hidden text-ellipsis">{customer?.document1 || ''}</span>
                        </div>
                    </div>
                    <div className="flex border-b border-black p-1.5 items-center overflow-hidden">
                        <span className="font-bold w-20 shrink-0 pt-0.5 pb-1">Endereço:</span> 
                        <span className="uppercase w-full pt-0.5 pb-1 whitespace-nowrap overflow-hidden text-ellipsis">{order.clientCity}</span>
                    </div>
                    <div className="flex border-b border-black">
                        <div className="w-1/3 border-r border-black p-1.5 flex items-center overflow-hidden">
                            <span className="font-bold w-20 shrink-0 pt-0.5 pb-1">Vendedor:</span> 
                            <span className="uppercase w-full pt-0.5 pb-1 whitespace-nowrap overflow-hidden text-ellipsis">{seller?.fullName || order.salesperson}</span>
                        </div>
                        <div className="w-1/3 border-r border-black p-1.5 flex items-center overflow-hidden">
                            <span className="font-bold w-[110px] shrink-0 pt-0.5 pb-1">Data de emissão:</span> 
                            <span className="pt-0.5 pb-1 whitespace-nowrap">{formattedDate}</span>
                        </div>
                        <div className="w-1/3 p-1.5 flex items-center overflow-hidden">
                            <span className="font-bold w-[115px] shrink-0 pt-0.5 pb-1">Prazo de entrega:</span> 
                            <span className="uppercase w-full pt-0.5 pb-1 whitespace-nowrap overflow-hidden text-ellipsis">{order.deliveryTime || '10 DIAS ÚTEIS'}</span>
                        </div>
                    </div>
                </div>
                <div className="flex border-b border-black p-1.5 justify-center bg-gray-100 font-bold text-[15px]" style={{backgroundColor: '#f3f4f6', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>
                    Orçamento nº: {order.orderNumber}
                </div>

                {/* FIRST TABLE: ITENS DO ORÇAMENTO */}
                {showItems && (
                    <>
                        <div className="bg-[#3b3e41] text-white text-center py-1 font-bold text-[11px] uppercase" style={{backgroundColor: '#3b3e41', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>
                            (ITENS DO ORÇAMENTO)
                        </div>
                        <div className="flex flex-col flex-none min-h-[50px]">
                            <table className="w-full text-center border-collapse border-b border-black table-fixed print:min-w-0">
                        <thead>
                            <tr className="text-black font-bold text-[10px]">
                                <th className="border border-black p-1 w-[7%] text-center bg-[#ffe0b2]" style={{backgroundColor: '#ffe0b2', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>ITEM</th>
                                <th className="border border-black p-1 w-[9%] text-center bg-[#ffe0b2]" style={{backgroundColor: '#ffe0b2', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>{(items.length > 0 ? items[0].codigo : previewCodigo) === 'DETALHADO' ? 'QTD PEÇAS' : 'FOLHA'}</th>
                                <th className="border border-black p-1 text-center bg-[#ffe0b2]" style={{backgroundColor: '#ffe0b2', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>{(items.length > 0 ? items[0].codigo : previewCodigo) === 'DETALHADO' ? 'DESCRIÇÃO' : 'ETAPA / DESCRIÇÃO'}</th>
                                <th className="border border-black p-1 w-[12%] text-center bg-[#ffe0b2]" style={{backgroundColor: '#ffe0b2', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>TIPO</th>
                                <th className="border border-black p-1 w-[10%] text-center bg-[#ffe0b2]" style={{backgroundColor: '#ffe0b2', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>QTD (KG)</th>
                                <th className="border border-black p-1 w-[12%] text-center bg-[#ffe0b2]" style={{backgroundColor: '#ffe0b2', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>PREÇO TOTAL</th>
                            </tr>
                        </thead>
                        <tbody className="text-[10px]">
                            {items.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="border-x border-b border-black p-2 text-center text-gray-500 italic">
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
                                        <tr key={`item-${idx}`}>
                                            <td className="border-x border-b border-black p-0"><div className="flex items-center justify-center min-h-[22px] leading-none px-1 py-1">{idx + 1}</div></td>
                                            <td className="border-x border-b border-black p-0"><div className="flex items-center justify-center min-h-[22px] leading-none px-1 py-1">{item.folha || '\u00A0'}</div></td>
                                            <td className="border-x border-b border-black p-0">
                                                <div className="flex flex-col items-center justify-center min-h-[22px] leading-tight px-1 py-1 uppercase text-center break-words">
                                                    {(() => {
                                                        const bitolasDetails = (item as any).bitolasDetails || (item as any).bitolas_details;
                                                        if (bitolasDetails && bitolasDetails['drawings'] && bitolasDetails['drawings'].length > 0) {
                                                            return (
                                                                <div className="flex flex-col items-center justify-center gap-1 w-full">
                                                                    {bitolasDetails['drawings'].map((drawing: any, dIdx: number) => (
                                                                        <div key={dIdx} className="flex items-center justify-center gap-1">
                                                                            <span className="text-[10px] text-black">{drawing.qty} peças:</span>
                                                                            <div className="h-10 w-16 flex items-center justify-center">
                                                                                {renderDrawingSvg(drawing)}
                                                                            </div>
                                                                            <span className="text-[10px] text-black">
                                                                                , ∅{(() => {
                                                                                    const gId = drawing.gaugeId || drawing.gauge_id;
                                                                                    if (!gId) return 'N/A';
                                                                                    const g = gauges.find(gg => String(gg.id) === String(gId));
                                                                                    if (!g) return `ID:${String(gId).substring(0,4)}`;
                                                                                    const num = parseFloat((g.gauge || '').replace(',', '.').replace(/[^\d.]/g, ''));
                                                                                    if (!isNaN(num) && num > 0) return `${num}MM`;
                                                                                    return (g.commercialName || g.materialType || g.gauge || '??').toUpperCase();
                                                                                })()}
                                                                            </span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            );
                                                        }
                                                        return <div>{item.descricao?.split(' --- DESENHOS: ')[0] || '\u00A0'}</div>;
                                                    })()}
                                                </div>
                                            </td>
                                            <td className="border-x border-b border-black p-0"><div className="flex items-center justify-center min-h-[22px] leading-[1.1] px-1 py-1 uppercase text-center text-[9px] break-words whitespace-normal">{item.tipo || '\u00A0'}</div></td>
                                            <td className="border-x border-b border-black p-0"><div className="flex items-center justify-center min-h-[22px] leading-none px-1 py-1">{item.peso > 0 ? item.peso.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '0,00'}</div></td>
                                            <td className="border-x border-b border-black p-0"><div className="flex items-center justify-center min-h-[22px] leading-none px-1 py-1">
                                                {finalValor > 0 ? `R$ ${finalValor.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : 'R$ -'}
                                            </div></td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                            </table>
                        </div>
                    </>
                )}

                {/* SECOND TABLE: RESUMO DE AÇO */}
                {showSummary && (
                    <div className="bg-[#3b3e41] text-white text-center py-1 font-bold text-[11px] uppercase border-t border-black mt-4" style={{backgroundColor: '#3b3e41', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>
                        (RESUMO DO AÇO)
                    </div>
                )}

                <div className="flex flex-col flex-1 pb-[120px] relative">
                    <table className="w-full text-center border-collapse table-fixed print:min-w-0">
                        {showSummary && (
                            <>
                                <thead>
                                    <tr className="text-black font-bold text-[10px]">
                                <th className="border border-black p-1 w-[10%] text-center bg-[#ffe0b2]" style={{backgroundColor: '#ffe0b2', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>CÓD.</th>
                                <th className="border border-black p-1 text-center bg-[#ffe0b2]" style={{backgroundColor: '#ffe0b2', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>DESCRIÇÃO</th>
                                <th className="border border-black p-1 w-[12%] text-center bg-[#ffe0b2]" style={{backgroundColor: '#ffe0b2', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>QTD</th>
                                <th className="border border-black p-1 w-[8%] text-center bg-[#ffe0b2]" style={{backgroundColor: '#ffe0b2', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>UND</th>
                                <th className="border border-black p-1 w-[18%] text-center bg-[#ffe0b2]" style={{backgroundColor: '#ffe0b2', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>PREÇO<br/>UNIT. (KG)</th>
                                <th className="border border-black p-1 w-[22%] text-center bg-[#ffe0b2]" style={{backgroundColor: '#ffe0b2', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>PREÇO TOTAL</th>
                            </tr>
                        </thead>
                        <tbody className="text-[10px]">
                            {summaryRows.map((row, idx) => (
                                <tr key={`sum-${idx}`}>
                                    <td className="border-x border-b border-black p-0"><div className="flex items-center justify-center min-h-[22px] leading-none px-1 py-0.5">{row.cod || idx + 1}</div></td>
                                    <td className="border-x border-b border-black p-0"><div className="flex items-center justify-center min-h-[22px] leading-none px-1 py-0.5 uppercase truncate max-w-full overflow-hidden block mx-auto text-center">{row.desc || '\u00A0'}</div></td>
                                    <td className="border-x border-b border-black p-0"><div className="flex items-center justify-center min-h-[22px] leading-none px-1 py-0.5">{row.isFreight ? '1' : (row.kg > 0 ? row.kg.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '0,00')}</div></td>
                                    <td className="border-x border-b border-black p-0"><div className="flex items-center justify-center min-h-[22px] leading-none px-1 py-0.5">{row.isFreight ? '\u00A0' : 'KG'}</div></td>
                                    <td className="border-x border-b border-black p-0"><div className="flex items-center justify-center min-h-[22px] leading-none px-1 py-0.5">
                                        {row.isFreight ? '\u00A0' : (row.pricePerKg > 0 ? `R$ ${row.pricePerKg.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : '\u00A0')}
                                    </div></td>
                                    <td className="border-x border-b border-black p-0"><div className="flex items-center justify-center min-h-[22px] leading-none px-1 py-0.5">
                                        {row.total > 0 ? `R$ ${row.total.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : 'R$ -'}
                                    </div></td>
                                    </tr>
                                ))}
                            </tbody>
                        </>
                        )}
                        <tfoot>
                            <tr className="h-4">
                                <td colSpan={6} className="border-none"></td>
                            </tr>
                            {order.paymentCondition !== 'CARTÃO (MOSTRAR OPÇÕES)' && (
                                <tr>
                                    <td colSpan={4} rowSpan={3} className="border-none p-1 align-bottom">
                                        {order.importantObs && order.importantObs.length > 0 && (
                                            <div className="w-[85%] border border-black">
                                                <div className="bg-white text-black font-bold text-[10px] p-0.5 px-1 border-b border-black">
                                                    OBSERVAÇÕES IMPORTANTES:
                                                </div>
                                                <ul className="text-[9px] font-bold">
                                                    {order.importantObs.map((o, idx) => (
                                                        <li key={idx} className={`px-1 py-0.5 border-black ${idx !== order.importantObs!.length - 1 ? 'border-b' : ''}`}>
                                                            - {o}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </td>
                                    <td className="bg-gray-200 text-black font-bold text-center p-1 border-l border-t border-b border-black text-[10px]" style={{backgroundColor: '#e5e7eb', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>
                                        VALOR TOTAL
                                    </td>
                                    <td className="bg-gray-200 text-black font-black text-center p-1 border-r border-t border-b border-black text-[11px]" style={{backgroundColor: '#e5e7eb', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>
                                        R$ {totalSummaryRs > 0 ? totalSummaryRs.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : ''}
                                    </td>
                                </tr>
                            )}
                            <tr>
                                {order.paymentCondition === 'CARTÃO (MOSTRAR OPÇÕES)' && (
                                    <td colSpan={4} rowSpan={5} className="border-none p-1 align-bottom">
                                        {order.importantObs && order.importantObs.length > 0 && (
                                            <div className="w-[85%] border border-black">
                                                <div className="bg-white text-black font-bold text-[10px] p-0.5 px-1 border-b border-black">
                                                    OBSERVAÇÕES IMPORTANTES:
                                                </div>
                                                <ul className="text-[9px] font-bold">
                                                    {order.importantObs.map((o, idx) => (
                                                        <li key={idx} className={`px-1 py-0.5 border-black ${idx !== order.importantObs!.length - 1 ? 'border-b' : ''}`}>
                                                            - {o}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </td>
                                )}
                                <td className={`bg-gray-200 text-black font-bold text-center p-1 border-l border-b border-black text-[10px] ${order.paymentCondition === 'CARTÃO (MOSTRAR OPÇÕES)' ? 'border-t' : ''}`} style={{backgroundColor: '#e5e7eb', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>
                                    PESO TOTAL
                                </td>
                                <td className={`bg-gray-200 text-black font-black text-center p-1 border-r border-b border-black text-[11px] ${order.paymentCondition === 'CARTÃO (MOSTRAR OPÇÕES)' ? 'border-t' : ''}`} style={{backgroundColor: '#e5e7eb', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>
                                    {totalSummaryKg > 0 ? totalSummaryKg.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : ''} KG
                                </td>
                            </tr>
                            {order.paymentCondition === 'CARTÃO (MOSTRAR OPÇÕES)' ? (
                                <>
                                    <tr>
                                        <td className="bg-gray-200 text-black font-bold text-right p-1 border-l border-b border-black text-[12px]" style={{backgroundColor: '#e5e7eb', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>
                                            TOTAL PIX / À VISTA R$
                                        </td>
                                        <td className="bg-gray-200 text-black font-black text-center p-1 border-r border-b border-black text-[12px]" style={{backgroundColor: '#e5e7eb', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>
                                            R$ {safeValue.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="bg-gray-200 text-black font-bold text-right p-1 border-l border-b border-black text-[12px]" style={{backgroundColor: '#e5e7eb', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>
                                            TOTAL CARTÃO 1x R$
                                        </td>
                                        <td className="bg-gray-200 text-black font-black text-center p-1 border-r border-b border-black text-[12px]" style={{backgroundColor: '#e5e7eb', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>
                                            R$ {(safeValue * (1 + paymentFees.card_1x / 100)).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="bg-gray-200 text-black font-bold text-right p-1 border-l border-b border-black text-[12px]" style={{backgroundColor: '#e5e7eb', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>
                                            TOTAL CARTÃO 2x R$
                                        </td>
                                        <td className="bg-gray-200 text-black font-black text-center p-1 border-r border-b border-black text-[12px]" style={{backgroundColor: '#e5e7eb', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>
                                            R$ {(safeValue * (1 + paymentFees.card_2x / 100)).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="bg-gray-200 text-black font-bold text-right p-1 border-l border-b border-black text-[12px]" style={{backgroundColor: '#e5e7eb', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>
                                            TOTAL CARTÃO 3x R$
                                        </td>
                                        <td className="bg-gray-200 text-black font-black text-center p-1 border-r border-b border-black text-[12px]" style={{backgroundColor: '#e5e7eb', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>
                                            R$ {(safeValue * (1 + paymentFees.card_3x / 100)).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                        </td>
                                    </tr>
                                </>
                            ) : (
                                <tr>
                                    <td className="bg-gray-200 text-black font-bold text-center p-1 border-l border-b border-black text-[12px]" style={{backgroundColor: '#e5e7eb', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact', lineHeight: '1.1'}}>
                                        CONDIÇÃO DE PAGAMENTO
                                    </td>
                                    <td className="bg-gray-200 text-black font-black text-center p-1 border-r border-b border-black text-[12px] uppercase" style={{backgroundColor: '#e5e7eb', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>
                                        {order.paymentCondition || 'À VISTA'}
                                    </td>
                                </tr>
                            )}
                        </tfoot>
                    </table>
                </div>

                {/* OBSERVAÇÕES */}
                <div className="flex flex-col border-t-2 border-black absolute bottom-0 left-0 w-full bg-white h-[115px]">
                    <div className="bg-[#3b3e41] text-white text-center py-0.5 font-bold text-[10px]" style={{backgroundColor: '#3b3e41', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>
                        OBSERVAÇÕES
                    </div>
                    <div className="p-1.5 space-y-1 text-[8px] leading-[1.1] font-semibold flex-1">
                        <p>01 - O orçamento é baseado nos resumos do aço dos projetos fornecidos pelo cliente. Caso haja divergência, ocorrerá a alteração de valores e prazos;</p>
                        <p>02 - A entrega está dividida em 1 etapa, e a descarga e conferência do material é de responsabilidade do cliente;</p>
                        <p>03 - Caso a entrega não possa acontecer na data acordada, por eventualidade do cliente, será cobrado um novo frete adicional e a entrega será reprogramada em até 7 dias;</p>
                        <p>04 - O prazo de reclamação do pedido é de até 48 horas após a entrega;</p>
                        <p>05 - O prazo de entrega dos produtos será contado a partir da confirmação do pagamento antecipado;</p>
                    </div>
                    
                    <div className="text-center font-bold pb-1 pt-1 text-[9px]">
                        VALIDADE DO ORÇAMENTO: 01 DIA
                    </div>
                </div>

            </div>

        </div>
    );
});
