import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import type { CommercialOrder, CommercialOrderItem, StockGauge, Customer, Partner, User } from '../types';
import { fetchItems, fetchTable, fetchByColumn } from '../services/supabaseService';
import { OrderPrintTemplate } from './OrderPrintTemplate';

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
    const [showItems, setShowItems] = useState(true);
    const [showSummary, setShowSummary] = useState(true);
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

    // Define o título da página temporariamente para usar como nome padrão do arquivo ao "Salvar como PDF"
    useEffect(() => {
        const originalTitle = document.title;
        const number = order.orderNumber || '000000';
        document.title = `Orcamento_${number}`;
        
        return () => {
            document.title = originalTitle;
        };
    }, [order.orderNumber]);

    const formattedDate = (order.date && String(order.date).includes('-')) 
        ? String(order.date).split('-').reverse().join('/') 
        : (order.date || '');

    return (
        <div id="order-print-overlay" className={`fixed inset-0 bg-slate-900 z-[200] overflow-y-auto print:overflow-visible print:bg-white print:static print:block print:w-full print:max-w-full print:m-0 print:p-0 flex flex-col ${isCopying ? 'items-start justify-start' : 'items-center'}`}>
            
            {/* Action Bar (No Print) */}
            {!isCopying && (
                <div className="sticky top-0 bg-slate-800 w-full p-4 flex flex-col md:flex-row justify-between items-center gap-4 no-print shadow-xl z-[201]">
                <div className="text-white font-bold flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span>🖨️</span> Visualização de Impressão
                    </div>
                    <div className="flex flex-wrap items-center gap-4 md:ml-6 md:border-l border-slate-600 md:pl-6 text-sm font-normal">
                        <label className="flex items-center gap-2 cursor-pointer hover:text-sky-300 transition-colors">
                            <input 
                                type="checkbox" 
                                checked={showItems}
                                onChange={(e) => setShowItems(e.target.checked)}
                                className="w-4 h-4 rounded text-sky-500 bg-slate-700 border-slate-500 focus:ring-sky-500 focus:ring-offset-slate-800"
                            />
                            Itens do Orçamento
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer hover:text-sky-300 transition-colors">
                            <input 
                                type="checkbox" 
                                checked={showSummary}
                                onChange={(e) => setShowSummary(e.target.checked)}
                                className="w-4 h-4 rounded text-sky-500 bg-slate-700 border-slate-500 focus:ring-sky-500 focus:ring-offset-slate-800"
                            />
                            Resumo do Aço
                        </label>
                    </div>
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
                {isLoading ? (
                    <div className="flex items-center justify-center h-[297mm] text-slate-400 font-bold">Carregando dados...</div>
                ) : (
                    <OrderPrintTemplate
                        ref={printRef}
                        order={order}
                        items={items}
                        gauges={gauges}
                        customer={customer}
                        seller={seller}
                        activeBrandingPartner={activeBrandingPartner}
                        showItems={showItems}
                        showSummary={showSummary}
                    />
                )}
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
