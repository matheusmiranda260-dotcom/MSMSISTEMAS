import React, { forwardRef } from 'react';
import type { CommercialOrder, CommercialOrderItem, StockGauge, Customer, Partner, User } from '../types';

export interface OrderPrintTemplateProps {
    order: CommercialOrder;
    items: CommercialOrderItem[];
    gauges: StockGauge[];
    customer: Customer | null;
    seller: User | null;
    activeBrandingPartner?: Partner | null;
}

export const OrderPrintTemplate = forwardRef<HTMLDivElement, OrderPrintTemplateProps>(({
    order,
    items,
    gauges,
    customer,
    seller,
    activeBrandingPartner
}, ref) => {
    // Calculate aggregated bitolas
    const bitolasSummary: Record<string, { kg: number }> = {};
    items.forEach(item => {
        if (item.bitolas_details) {
            Object.entries(item.bitolas_details).forEach(([bitolaId, kg]) => {
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

    const summaryRows = Object.keys(bitolasSummary).map(bitolaId => {
        const gauge = gauges.find(g => g.id === bitolaId);
        const kg = bitolasSummary[bitolaId].kg;
        let desc = 'AÇO DESCONHECIDO';
        if (gauge) {
            const name = gauge.commercialName || gauge.materialType;
            const prefix = name.toUpperCase().startsWith('CD ') ? '' : 'CD ';
            desc = `${prefix}${name} ${gauge.gauge}`;
        }
        
        const cod = gauge?.productCode || '';
        const basePricePerKg = (gauge?.rawWeightValue && gauge.rawWeightValue > 0) 
            ? (gauge.purchasePrice || 0) / gauge.rawWeightValue 
            : (gauge?.purchasePrice || 0);

        let pricePerKg = basePricePerKg;
        for (const item of items) {
            if (item.custom_prices && item.custom_prices[bitolaId] !== undefined) {
                pricePerKg = item.custom_prices[bitolaId];
                break;
            }
        }

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
                        <div className="font-bold uppercase">{activeBrandingPartner?.razaoSocial || activeBrandingPartner?.companyName || 'ARMAÇO FERRAGEM ARMADA, MATERIAIS PARA CONSTRUCAO E TRANSPORTE LTDA'}</div>
                        <div>CNPJ: {activeBrandingPartner?.cnpj || '58.894.273/0001-07'}</div>
                        <div>{activeBrandingPartner?.endereco || 'Rua JC-28, Quadra 31 - Lotes 01-02, Residencial Jardim Canedo II, Senador Canedo/GO - CEP: 75.250-307'}</div>
                        <div>Telefone: {activeBrandingPartner?.telefone || seller?.phone || 'INSERIR NO CADASTRO ESSA INFORMAÇÃO'}</div>
                        <div>E-mail: {activeBrandingPartner?.email || seller?.email || 'INSERIR NO CADASTRO ESSA INFORMAÇÃO'}</div>
                        {!activeBrandingPartner && <div className="text-blue-600 underline">www.armacoferragens.com.br</div>}
                    </div>
                </div>

                {/* CLIENT INFO */}
                <div className="text-[12px]">
                    <div className="flex border-b border-black">
                        <div className="w-2/3 border-r border-black p-1.5 flex overflow-hidden">
                            <span className="font-bold w-16 shrink-0">Cliente:</span> 
                            <span className="uppercase truncate block w-full">{order.clientName}</span>
                        </div>
                        <div className="w-1/3 p-1.5 flex whitespace-nowrap overflow-hidden">
                            <span className="font-bold w-20 shrink-0">CPF/CNPJ:</span> 
                            <span className="uppercase truncate block w-full">{customer?.document1 || ''}</span>
                        </div>
                    </div>
                    <div className="flex border-b border-black p-1.5 overflow-hidden">
                        <span className="font-bold w-20 shrink-0">Endereço:</span> 
                        <span className="uppercase truncate block w-full">{order.clientCity}</span>
                    </div>
                    <div className="flex border-b border-black">
                        <div className="w-1/3 border-r border-black p-1.5 flex overflow-hidden">
                            <span className="font-bold w-20 shrink-0">Vendedor:</span> 
                            <span className="uppercase truncate block w-full">{seller?.fullName || order.salesperson}</span>
                        </div>
                        <div className="w-1/3 border-r border-black p-1.5 flex whitespace-nowrap">
                            <span className="font-bold w-[110px] shrink-0">Data de emissão:</span> 
                            <span>{formattedDate}</span>
                        </div>
                        <div className="w-1/3 p-1.5 flex whitespace-nowrap overflow-hidden">
                            <span className="font-bold w-[115px] shrink-0">Prazo de entrega:</span> 
                            <span className="uppercase truncate block w-full">{order.deliveryTime || '10 DIAS ÚTEIS'}</span>
                        </div>
                    </div>
                </div>
                <div className="flex border-b border-black p-1.5 justify-center bg-gray-100 font-bold text-[15px]" style={{backgroundColor: '#f3f4f6', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>
                    Orçamento nº: {order.orderNumber}
                </div>

                {/* FIRST TABLE: ITENS DO ORÇAMENTO */}
                <div className="bg-[#3b3e41] text-white text-center py-1 font-bold text-[11px] uppercase" style={{backgroundColor: '#3b3e41', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>
                    (ITENS DO ORÇAMENTO)
                </div>
                <div className="flex flex-col flex-none min-h-[50px]">
                    <table className="w-full text-center border-collapse border-b border-black table-fixed print:min-w-0">
                        <thead>
                            <tr className="text-black font-bold text-[10px]">
                                <th className="border border-black p-1 w-[8%] text-center bg-[#ffe0b2]" style={{backgroundColor: '#ffe0b2', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>ITEM</th>
                                <th className="border border-black p-1 w-[12%] text-center bg-[#ffe0b2]" style={{backgroundColor: '#ffe0b2', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>FOLHA</th>
                                <th className="border border-black p-1 text-center bg-[#ffe0b2]" style={{backgroundColor: '#ffe0b2', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>ETAPA / DESCRIÇÃO</th>
                                <th className="border border-black p-1 w-[18%] text-center bg-[#ffe0b2]" style={{backgroundColor: '#ffe0b2', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>TIPO</th>
                                <th className="border border-black p-1 w-[12%] text-center bg-[#ffe0b2]" style={{backgroundColor: '#ffe0b2', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>QTD (KG)</th>
                                <th className="border border-black p-1 w-[18%] text-center bg-[#ffe0b2]" style={{backgroundColor: '#ffe0b2', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>PREÇO TOTAL</th>
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
                                    const finalValor = (item.valor || 0) + itemFreight;
                                    
                                    return (
                                        <tr key={`item-${idx}`}>
                                            <td className="border-x border-b border-black p-0"><div className="flex items-center justify-center min-h-[22px] leading-none px-1 py-0.5">{idx + 1}</div></td>
                                            <td className="border-x border-b border-black p-0"><div className="flex items-center justify-center min-h-[22px] leading-none px-1 py-0.5">{item.folha || '\u00A0'}</div></td>
                                            <td className="border-x border-b border-black p-0"><div className="flex items-center justify-center min-h-[22px] leading-none px-1 py-0.5 uppercase truncate max-w-full overflow-hidden block mx-auto text-center">{item.descricao || '\u00A0'}</div></td>
                                            <td className="border-x border-b border-black p-0"><div className="flex items-center justify-center min-h-[22px] leading-none px-1 py-0.5 uppercase truncate max-w-full overflow-hidden block mx-auto text-center">{item.tipo || '\u00A0'}</div></td>
                                            <td className="border-x border-b border-black p-0"><div className="flex items-center justify-center min-h-[22px] leading-none px-1 py-0.5">{item.peso > 0 ? item.peso.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '0,00'}</div></td>
                                            <td className="border-x border-b border-black p-0"><div className="flex items-center justify-center min-h-[22px] leading-none px-1 py-0.5">
                                                {finalValor > 0 ? `R$ ${finalValor.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : 'R$ -'}
                                            </div></td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* SECOND TABLE: RESUMO DE AÇO */}
                <div className="bg-[#3b3e41] text-white text-center py-1 font-bold text-[11px] uppercase border-t border-black mt-4" style={{backgroundColor: '#3b3e41', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>
                    (RESUMO DO AÇO)
                </div>

                <div className="flex flex-col flex-1 pb-[120px] relative">
                    <table className="w-full text-center border-collapse table-fixed print:min-w-0">
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
                        <tfoot>
                            <tr className="h-4">
                                <td colSpan={6} className="border-none"></td>
                            </tr>
                            <tr>
                                <td colSpan={4} className="border-none"></td>
                                <td className="bg-gray-200 text-black font-bold text-center p-1 border-l border-t border-b border-black text-[10px]" style={{backgroundColor: '#e5e7eb', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>
                                    VALOR TOTAL
                                </td>
                                <td className="bg-gray-200 text-black font-black text-center p-1 border-r border-t border-b border-black text-[11px]" style={{backgroundColor: '#e5e7eb', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>
                                    R$ {totalSummaryRs > 0 ? totalSummaryRs.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : ''}
                                </td>
                            </tr>
                            <tr>
                                <td colSpan={4} className="border-none"></td>
                                <td className="bg-gray-200 text-black font-bold text-center p-1 border-l border-b border-black text-[10px]" style={{backgroundColor: '#e5e7eb', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>
                                    PESO TOTAL
                                </td>
                                <td className="bg-gray-200 text-black font-black text-center p-1 border-r border-b border-black text-[11px]" style={{backgroundColor: '#e5e7eb', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>
                                    {totalSummaryKg > 0 ? totalSummaryKg.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : ''} KG
                                </td>
                            </tr>
                            {order.paymentCondition && (
                                <tr>
                                    <td colSpan={4} className="border-none"></td>
                                    <td className="bg-gray-200 text-black font-bold text-center p-1 border-l border-b border-black text-[9px]" style={{backgroundColor: '#e5e7eb', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact', lineHeight: '1.1'}}>
                                        CONDIÇÃO DE PAGAMENTO
                                    </td>
                                    <td className="bg-gray-200 text-black font-black text-center p-1 border-r border-b border-black text-[10px] uppercase" style={{backgroundColor: '#e5e7eb', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>
                                        {order.paymentCondition}
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
