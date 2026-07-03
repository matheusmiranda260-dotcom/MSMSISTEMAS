import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import type { CommercialOrder, CommercialOrderItem, StockGauge, Customer, Partner, User } from '../types';
import { fetchItems, fetchTable, fetchByColumn } from '../services/supabaseService';

interface OrderPrintViewProps {
    order: CommercialOrder;
    onClose: () => void;
    activeBrandingPartner?: Partner | null;
}

export const OrderPrintView: React.FC<OrderPrintViewProps> = ({ order, onClose, activeBrandingPartner }) => {
    const [items, setItems] = useState<CommercialOrderItem[]>([]);
    const [gauges, setGauges] = useState<StockGauge[]>([]);
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [seller, setSeller] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isCopying, setIsCopying] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);
    const printRef = useRef<HTMLDivElement>(null);

    const handleCopyToWhatsApp = async () => {
        if (!printRef.current) return;
        
        try {
            setIsCopying(true);
            setCopySuccess(false);

            // Wait for React to apply isCopying classes (removing margins/centering)
            await new Promise(resolve => setTimeout(resolve, 100));

            // Temporarily scroll to top to prevent html2canvas from cropping the image
            const scrollContainer = printRef.current.closest('.overflow-y-auto');
            if (scrollContainer) {
                (window as any)._previousScrollY = scrollContainer.scrollTop;
                scrollContainer.scrollTop = 0;
            }
            
            const canvas = await html2canvas(printRef.current, {
                scale: 2, // Higher quality
                useCORS: true,
                backgroundColor: '#ffffff',
                scrollX: 0,
                scrollY: 0,
                onclone: (doc, element) => {
                    // Force the element out of its scroll container to top-left to avoid clipping
                    element.style.position = 'fixed';
                    element.style.top = '0px';
                    element.style.left = '0px';
                    element.style.margin = '0px';
                    element.style.padding = '10mm'; // Ensure padding is present in clone
                    element.style.width = '210mm';
                    element.style.transform = 'none';
                    element.style.boxShadow = 'none';
                    element.style.boxSizing = 'border-box';
                }
            });
            
            canvas.toBlob(async (blob) => {
                if (!blob) {
                    throw new Error('Falha ao gerar imagem');
                }
                
                try {
                    await navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': blob })
                    ]);
                    setCopySuccess(true);
                    setTimeout(() => setCopySuccess(false), 3000);
                } catch (clipboardError) {
                    console.error('Erro ao copiar para a área de transferência:', clipboardError);
                    alert('Não foi possível copiar a imagem automaticamente. O seu navegador pode não suportar esta função.');
                }
            }, 'image/png');
            
        } catch (error) {
            console.error('Erro ao gerar imagem:', error);
            alert('Ocorreu um erro ao gerar a imagem.');
        } finally {
            setIsCopying(false);
            
            // Restore scroll position
            const scrollContainer = printRef.current?.closest('.overflow-y-auto');
            if (scrollContainer && (window as any)._previousScrollY !== undefined) {
                scrollContainer.scrollTop = (window as any)._previousScrollY;
            }
        }
    };

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                // Fetch items for this order
                if (order.id) {
                    const data = await fetchItems('commercial_order_items', '*', { column: 'order_id', value: order.id });
                    setItems(data as unknown as CommercialOrderItem[]);
                }
                
                // Fetch all gauges
                const gaugesData = await fetchTable<StockGauge>('stock_gauges');
                setGauges(gaugesData);

                // Fetch customer details to get CPF/CNPJ
                if (order.clientCode) {
                    const customerData = await fetchItems('customers', '*', { column: 'code', value: order.clientCode });
                    if (customerData && customerData.length > 0) {
                        setCustomer(customerData[0] as unknown as Customer);
                    }
                }
                
                // Fetch seller details to get phone and email
                if (order.salesperson) {
                    try {
                        // Traz todos os usuários e procura ignorando maiúsculas/minúsculas
                        const allUsers = await fetchTable<User>('app_users');
                        const matchedUser = allUsers.find(u => u.username?.toLowerCase() === order.salesperson?.toLowerCase());
                        if (matchedUser) {
                            setSeller(matchedUser);
                        }
                    } catch (e) {
                        console.error('Error fetching seller', e);
                    }
                }
            } catch (error) {
                console.error("Error loading print data:", error);
            } finally {
                setIsLoading(false);
            }
        };
        
        loadData();
    }, [order]);

    // Calculate aggregated bitolas (just like in OrderItemsEditor)
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
        const pricePerKg = (gauge?.rawWeightValue && gauge.rawWeightValue > 0) 
            ? (gauge.purchasePrice || 0) / gauge.rawWeightValue 
            : (gauge?.purchasePrice || 0);

        const total = kg * pricePerKg;

        return {
            id: bitolaId,
            cod,
            desc,
            kg,
            pricePerKg,
            total
        };
    }).sort((a, b) => b.kg - a.kg); // Example sorting

    const totalSummaryKg = summaryRows.reduce((acc, r) => acc + r.kg, 0);
    const totalSummaryRs = summaryRows.reduce((acc, r) => acc + r.total, 0);

    const formattedDate = (order.date && String(order.date).includes('-')) 
        ? String(order.date).split('-').reverse().join('/') 
        : (order.date || '');

    return (
        <div id="order-print-overlay" className={`fixed inset-0 bg-slate-900 z-[200] overflow-y-auto print:overflow-visible print:bg-white print:static print:block print:w-full print:max-w-full print:m-0 print:p-0 flex flex-col ${isCopying ? 'items-start justify-start' : 'items-center'}`}>
            
            {/* Action Bar (No Print) */}
            {!isCopying && (
                <div className="sticky top-0 bg-slate-800 w-full p-4 flex justify-between items-center no-print shadow-xl z-[201]">
                <div className="text-white font-bold flex items-center gap-2">
                    <span>🖨️</span> Visualização de Impressão
                </div>
                <div className="flex gap-3">
                    <button onClick={onClose} className="px-5 py-2 rounded font-bold text-slate-300 hover:bg-slate-700 transition-colors">
                        ✕ Cancelar
                    </button>
                    <button 
                        onClick={handleCopyToWhatsApp}
                        disabled={isCopying || isLoading}
                        className={`px-5 py-2 rounded font-bold text-white shadow-md transition-all flex items-center gap-2 ${
                            copySuccess ? 'bg-emerald-600' : 'bg-emerald-500 hover:bg-emerald-400'
                        } ${isCopying ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                        <span>📱</span> 
                        {isCopying ? 'Copiando...' : copySuccess ? 'Copiado! ✓' : 'Copiar p/ Whats'}
                    </button>
                    <button 
                        onClick={() => window.print()}
                        className="px-6 py-2 rounded font-bold text-white bg-sky-600 hover:bg-sky-500 shadow-md transition-all flex items-center gap-2"
                    >
                        <span>🖨️</span> Imprimir
                    </button>
                </div>
                </div>
            )}

            <div id="order-print-area" className={`w-full max-w-[210mm] print:w-full print:max-w-full print:shadow-none print:m-0 print:border-none bg-white relative shadow-2xl ${isCopying ? 'm-0' : 'mx-auto my-8'}`}>
                <div ref={printRef} className="bg-white min-h-[297mm] print:min-h-0 print:h-auto p-[10mm] print:p-0 text-[11px] font-sans text-black leading-tight w-full h-full">
                    {isLoading ? (
                    <div className="flex items-center justify-center h-64 text-slate-400 font-bold">Carregando dados...</div>
                ) : (
                    <div className="border border-black flex flex-col h-full">
                        
                        {/* HEADER */}
                        <div className="flex border-b border-black">
                            {/* Logo Box */}
                            <div className="w-1/3 border-r border-black flex flex-col items-center justify-center p-4">
                                {activeBrandingPartner?.logoUrl ? (
                                    <img src={activeBrandingPartner.logoUrl} alt="Logo Parceiro" className="max-w-full max-h-[140px] object-contain" />
                                ) : (
                                    <>
                                        {/* SVG Logo recreation */}
                                        <svg width="80" height="80" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M50 10 L85 30 L85 70 L50 90 L15 70 L15 30 Z" stroke="#333" strokeWidth="4" fill="none" />
                                            <path d="M50 10 L50 50 M15 30 L50 50 M85 30 L50 50" stroke="#333" strokeWidth="2" />
                                            <rect x="40" y="45" width="20" height="30" fill="#E67E22" />
                                        </svg>
                                        <div className="mt-2 text-center">
                                            <div className="font-black text-xl tracking-tighter" style={{fontFamily: "Arial Black, Arial, sans-serif", color: "#1E293B"}}>ARMAÇO</div>
                                            <div className="text-[6px] uppercase font-bold tracking-widest text-slate-500 mt-1">Ferragem Armada</div>
                                        </div>
                                    </>
                                )}
                            </div>
                            
                            {/* Company Details Box */}
                            <div className="w-2/3 p-2 text-center flex flex-col justify-center gap-0.5" style={{ fontSize: '10px' }}>
                                <div className="font-bold">ARMAÇO FERRAGEM ARMADA, MATERIAIS PARA CONSTRUCAO E TRANSPORTE LTDA</div>
                                <div>CNPJ: 58.894.273/0001-07</div>
                                <div>Rua JC-28, Quadra 31 - Lotes 01-02</div>
                                <div>Residencial Jardim Canedo II, Senador Canedo/GO - CEP: 75.250-307</div>
                                <div>Telefone: {seller?.phone || 'INSERIR NO CADASTRO ESSA INFORMAÇÃO'}</div>
                                <div>E-mail: {seller?.email || 'INSERIR NO CADASTRO ESSA INFORMAÇÃO'}</div>
                                <div className="text-blue-600 underline">www.armacoferragens.com.br</div>
                            </div>
                        </div>

                        {/* CLIENT INFO */}
                        <div className="text-[12px]">
                            <div className="flex border-b border-black">
                                <div className="w-2/3 border-r border-black p-1.5 flex">
                                    <span className="font-bold w-16 shrink-0">Cliente:</span> 
                                    <span className="uppercase">{order.clientName}</span>
                                </div>
                                <div className="w-1/3 p-1.5 flex whitespace-nowrap">
                                    <span className="font-bold w-20 shrink-0">CPF/CNPJ:</span> 
                                    <span className="uppercase">{customer?.document1 || ''}</span>
                                </div>
                            </div>
                            <div className="flex border-b border-black p-1.5">
                                <span className="font-bold w-20">Endereço:</span> 
                                <span className="uppercase">{order.clientCity}</span>
                            </div>
                            <div className="flex border-b border-black">
                                <div className="w-1/3 border-r border-black p-1.5 flex">
                                    <span className="font-bold w-20">Vendedor:</span> 
                                    <span className="uppercase">{order.salesperson}</span>
                                </div>
                                <div className="w-1/3 border-r border-black p-1.5 flex">
                                    <span className="font-bold w-[110px]">Data de emissão:</span> 
                                    <span>{formattedDate}</span>
                                </div>
                                <div className="w-1/3 p-1.5 flex">
                                    <span className="font-bold w-[120px]">Prazo de entrega:</span> 
                                    <span className="uppercase">{order.deliveryTime || '10 DIAS ÚTEIS'}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex border-b border-black p-2 justify-center bg-gray-100 font-bold text-lg" style={{backgroundColor: '#f3f4f6', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>
                            Orçamento nº: {order.orderNumber}
                        </div>

                        {/* FIRST TABLE: ITENS DO ORÇAMENTO */}
                        <div className="bg-[#3b3e41] text-white text-center py-1 font-bold text-sm uppercase" style={{backgroundColor: '#3b3e41', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>
                            (ITENS DO ORÇAMENTO)
                        </div>
                        <div className="flex flex-col">
                            <table className="w-full text-center border-collapse border-b border-black table-fixed print:min-w-0">
                                <thead>
                                    <tr className="text-black font-bold">
                                        <th className="border border-black p-1 w-10 text-center bg-[#ffe0b2]" style={{backgroundColor: '#ffe0b2', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>ITEM</th>
                                        <th className="border border-black p-1 w-16 text-center bg-[#ffe0b2]" style={{backgroundColor: '#ffe0b2', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>FOLHA</th>
                                        <th className="border border-black p-1 text-center bg-[#ffe0b2]" style={{backgroundColor: '#ffe0b2', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>ETAPA / DESCRIÇÃO</th>
                                        <th className="border border-black p-1 w-24 text-center bg-[#ffe0b2]" style={{backgroundColor: '#ffe0b2', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>TIPO</th>
                                        <th className="border border-black p-1 w-16 text-center bg-[#ffe0b2]" style={{backgroundColor: '#ffe0b2', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>QTD (KG)</th>
                                        <th className="border border-black p-1 w-24 text-center bg-[#ffe0b2]" style={{backgroundColor: '#ffe0b2', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>PREÇO TOTAL</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item, idx) => {
                                        return (
                                            <tr key={`item-${idx}`}>
                                                <td className="border-x border-b border-black p-0"><div className="flex items-center justify-center min-h-[26px] leading-none px-1 pb-[3px]">{idx + 1}</div></td>
                                                <td className="border-x border-b border-black p-0"><div className="flex items-center justify-center min-h-[26px] leading-none px-1 pb-[3px]">{item.folha || '\u00A0'}</div></td>
                                                <td className="border-x border-b border-black p-0"><div className="flex items-center justify-center min-h-[26px] leading-none px-1 pb-[3px] uppercase">{item.descricao || '\u00A0'}</div></td>
                                                <td className="border-x border-b border-black p-0"><div className="flex items-center justify-center min-h-[26px] leading-none px-1 pb-[3px] uppercase">{item.tipo || '\u00A0'}</div></td>
                                                <td className="border-x border-b border-black p-0"><div className="flex items-center justify-center min-h-[26px] leading-none px-1 pb-[3px]">{item.peso > 0 ? item.peso.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '0,00'}</div></td>
                                                <td className="border-x border-b border-black p-0"><div className="flex items-center justify-center min-h-[26px] leading-none px-1 pb-[3px]">
                                                    {item.valor > 0 ? `R$ ${item.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : 'R$ -'}
                                                </div></td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* SECOND TABLE: RESUMO DE AÇO */}
                        <div className="bg-[#3b3e41] text-white text-center py-1 font-bold text-sm uppercase border-t border-black mt-6" style={{backgroundColor: '#3b3e41', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>
                            (RESUMO DO AÇO)
                        </div>

                        <div className="flex-1 flex flex-col">
                            <table className="w-full text-center border-collapse table-fixed print:min-w-0">
                                <thead>
                                    <tr className="text-black font-bold">
                                        <th className="border border-black p-1 w-12 text-center bg-[#ffe0b2]" style={{backgroundColor: '#ffe0b2', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>CÓD.</th>
                                        <th className="border border-black p-1 text-center bg-[#ffe0b2]" style={{backgroundColor: '#ffe0b2', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>DESCRIÇÃO</th>
                                        <th className="border border-black p-1 w-20 text-center bg-[#ffe0b2]" style={{backgroundColor: '#ffe0b2', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>QTD</th>
                                        <th className="border border-black p-1 w-12 text-center bg-[#ffe0b2]" style={{backgroundColor: '#ffe0b2', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>UND</th>
                                        <th className="border border-black p-1 w-24 text-center bg-[#ffe0b2]" style={{backgroundColor: '#ffe0b2', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>PREÇO<br/>UNIT. (KG)</th>
                                        <th className="border border-black p-1 w-28 text-center bg-[#ffe0b2]" style={{backgroundColor: '#ffe0b2', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>PREÇO TOTAL</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {summaryRows.map((row, idx) => (
                                        <tr key={`sum-${idx}`}>
                                            <td className="border-x border-b border-black p-0"><div className="flex items-center justify-center min-h-[26px] leading-none px-1 pb-[3px]">{row.cod || idx + 1}</div></td>
                                            <td className="border-x border-b border-black p-0"><div className="flex items-center justify-center min-h-[26px] leading-none px-1 pb-[3px] uppercase">{row.desc || '\u00A0'}</div></td>
                                            <td className="border-x border-b border-black p-0"><div className="flex items-center justify-center min-h-[26px] leading-none px-1 pb-[3px]">{row.kg > 0 ? row.kg.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '0,00'}</div></td>
                                            <td className="border-x border-b border-black p-0"><div className="flex items-center justify-center min-h-[26px] leading-none px-1 pb-[3px]">KG</div></td>
                                            <td className="border-x border-b border-black p-0"><div className="flex items-center justify-center min-h-[26px] leading-none px-1 pb-[3px]">
                                                {row.pricePerKg > 0 ? `R$ ${row.pricePerKg.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : '\u00A0'}
                                            </div></td>
                                            <td className="border-x border-b border-black p-0"><div className="flex items-center justify-center min-h-[26px] leading-none px-1 pb-[3px]">
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
                                        <td className="bg-gray-200 text-black font-bold text-center p-2 border-l border-t border-b border-black text-[12px]" style={{backgroundColor: '#e5e7eb', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>
                                            VALOR TOTAL
                                        </td>
                                        <td className="bg-gray-200 text-black font-black text-center p-2 border-r border-t border-b border-black text-[12px]" style={{backgroundColor: '#e5e7eb', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>
                                            R$ {totalSummaryRs > 0 ? totalSummaryRs.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : ''}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td colSpan={4} className="border-none"></td>
                                        <td className="bg-gray-200 text-black font-bold text-center p-2 border-l border-b border-black text-[12px]" style={{backgroundColor: '#e5e7eb', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>
                                            PESO TOTAL
                                        </td>
                                        <td className="bg-gray-200 text-black font-black text-center p-2 border-r border-b border-black text-[12px]" style={{backgroundColor: '#e5e7eb', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>
                                            {totalSummaryKg > 0 ? totalSummaryKg.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : ''} KG
                                        </td>
                                    </tr>
                                    {order.paymentCondition && (
                                        <tr>
                                            <td colSpan={4} className="border-none"></td>
                                            <td className="bg-gray-200 text-black font-bold text-center p-2 border-l border-b border-black text-[10px]" style={{backgroundColor: '#e5e7eb', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact', lineHeight: '1.1'}}>
                                                CONDIÇÃO DE PAGAMENTO
                                            </td>
                                            <td className="bg-gray-200 text-black font-black text-center p-2 border-r border-b border-black text-[12px] uppercase" style={{backgroundColor: '#e5e7eb', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>
                                                {order.paymentCondition}
                                            </td>
                                        </tr>
                                    )}
                                </tfoot>
                            </table>
                        </div>

                        {/* OBSERVAÇÕES */}
                        <div className="flex flex-col mt-auto border-t-2 border-black">
                            <div className="bg-[#3b3e41] text-white text-center py-1 font-bold" style={{backgroundColor: '#3b3e41', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}>
                                OBSERVAÇÕES
                            </div>
                            <div className="p-2 space-y-1.5 text-[9px] leading-tight font-semibold">
                                <p>01 - O orçamento é baseado nos resumos do aço dos projetos fornecidos pelo cliente. Caso haja divergência, ocorrerá a alteração de valores e prazos;</p>
                                <p>02 - A entrega está dividida em 1 etapa, e a descarga e conferência do material é de responsabilidade do cliente;</p>
                                <p>03 - Caso a entrega não possa acontecer na data acordada, por eventualidade do cliente, será cobrado um novo frete adicional e a entrega será reprogramada em até 7 dias;</p>
                                <p>04 - O prazo de reclamação do pedido é de até 48 horas após a entrega;</p>
                                <p>05 - O prazo de entrega dos produtos será contado a partir da confirmação do pagamento antecipado;</p>
                            </div>
                            
                            <div className="text-center font-bold pb-2 pt-2 text-[10px]">
                                VALIDADE DO ORÇAMENTO: 01 DIA
                            </div>
                        </div>

                    </div>
                )}
                </div>
            </div>
            <style dangerouslySetInnerHTML={{__html: `
                @media print {
                    @page { margin: 0 !important; size: A4 portrait; }
                    html, body, #root { margin: 0 !important; padding: 0 !important; background: white !important; overflow: visible !important; width: 100% !important; max-width: 100% !important; }
                    body * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    table { min-width: 0 !important; }
                    .sidebar, .top-bar, .no-print { display: none !important; }
                    .app-container, .main-content { display: block !important; margin: 0 !important; padding: 0 !important; width: 100% !important; max-width: 100% !important; overflow: visible !important; background: white !important; }
                    #order-print-area { display: block !important; width: 100% !important; max-width: 100% !important; margin: 0 !important; padding: 0 !important; box-shadow: none !important; max-height: none !important; overflow: visible !important; border-radius: 0 !important; }
                    #order-print-overlay { position: static !important; background: white !important; overflow: visible !important; display: block !important; width: 100% !important; max-width: 100% !important; margin: 0 !important; padding: 0 !important; }
                }
            `}} />
        </div>
    );
};

export default OrderPrintView;
