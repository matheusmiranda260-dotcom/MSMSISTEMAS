import React, { useState, useEffect } from 'react';
import type { Page, Customer, CommercialOrder, User, Partner } from '../types';
import { insertItem, deleteItem, updateItem } from '../services/supabaseService';
import { OrderItemsEditor } from './OrderItemsEditor';
import { OrderPrintView } from './OrderPrintView';

interface OrderManagementProps {
    setPage: (page: Page) => void;
    customers: Customer[];
    commercialOrders: CommercialOrder[];
    currentUser: User | null;
    activeBrandingPartner?: Partner | null;
}

export const OrderManagement: React.FC<OrderManagementProps> = ({ setPage, customers, commercialOrders, currentUser, activeBrandingPartner }) => {
    const [search, setSearch] = useState('');
    const [orderBy, setOrderBy] = useState<'id' | 'clientCode'>('id');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState<CommercialOrder | null>(null);
    const [printingOrder, setPrintingOrder] = useState<CommercialOrder | null>(null);
    const [activeTab, setActiveTab] = useState<'ativos' | 'finalizados'>('ativos');
    
    // Auth Modal
    const [isAuthorizeModalOpen, setIsAuthorizeModalOpen] = useState(false);
    const [orderToAuthorize, setOrderToAuthorize] = useState<CommercialOrder | null>(null);
    const [authorizeDate, setAuthorizeDate] = useState('');
    const [authorizeTime, setAuthorizeTime] = useState('');

    // Finish Reading Modal
    const [isFinishReadingModalOpen, setIsFinishReadingModalOpen] = useState(false);
    const [orderToFinishReading, setOrderToFinishReading] = useState<CommercialOrder | null>(null);
    const [jsonContent, setJsonContent] = useState('');

    // Form fields for New Order
    const [clientSearchTerm, setClientSearchTerm] = useState('');
    const [selectedClient, setSelectedClient] = useState<Customer | null>(null);
    const [newId, setNewId] = useState('');
    const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
    const [newSalesperson, setNewSalesperson] = useState('');
    const [newPrice, setNewPrice] = useState('');
    const [newStatus, setNewStatus] = useState('Em Produção');
    const [searchError, setSearchError] = useState('');
    const [newObservations, setNewObservations] = useState('');

    const handleSearchClient = () => {
        setSearchError('');
        if (!clientSearchTerm.trim()) {
            setSearchError('Digite algo para buscar.');
            return;
        }

        const term = clientSearchTerm.toLowerCase().trim();
        
        // Tratar caso especial do consumidor balcão
        if (term === '1001' || term === 'consumidor balcao' || term === 'consumidor balcão') {
            setSelectedClient({
                id: '1001',
                code: '1001',
                name: 'CONSUMIDOR BALCAO',
                customerType: 'Pessoa Física',
                document1: '000.000.000-00',
                document2: '',
                phone: '',
                email: '',
                addressMain: '',
                addressDelivery: '',
                addressBilling: '',
                createdAt: new Date().toISOString()
            });
            return;
        }

        const found = customers.find(c => 
            (c.code && c.code.toLowerCase() === term) ||
            (c.name && c.name.toLowerCase().includes(term)) ||
            (c.document1 && c.document1.replace(/\D/g, '') === term.replace(/\D/g, '')) ||
            (c.document2 && c.document2.toLowerCase().includes(term))
        );

        if (found) {
            setSelectedClient(found);
        } else {
            setSelectedClient(null);
            setSearchError('Cliente não encontrado.');
        }
    };

    const handleCreateOrder = async () => {
        if (!selectedClient) {
            setSearchError('Selecione um cliente primeiro.');
            return;
        }

        // Encontrar o maior número de pedido atual
        const maxId = commercialOrders.reduce((max, q) => {
            const num = parseInt(q.orderNumber, 10);
            return isNaN(num) ? max : Math.max(max, num);
        }, 0);
        const nextId = String(maxId + 1).padStart(7, '0');

        // Formatar data de hoje para o banco (YYYY-MM-DD)
        const today = new Date().toISOString().split('T')[0];

        const newQuote = {
            orderNumber: nextId,
            date: today,
            salesperson: (currentUser?.name || currentUser?.username || 'SISTEMA').toUpperCase(),
            clientCode: selectedClient.code || '1001',
            clientName: selectedClient.name,
            clientCity: selectedClient.addressMain || '',
            clientObs: newObservations.trim() ? `OBS: ${newObservations.trim()}` : '',
            price: 0.00,
            status: 'Orçamento',
            history: [{
                date: new Date().toISOString(),
                user: (currentUser?.name || currentUser?.username || 'SISTEMA').toUpperCase(),
                action: 'Orçamento iniciado'
            }]
        };

        try {
            await insertItem<CommercialOrder>('commercial_orders', newQuote);
        } catch (error) {
            console.error("Erro ao criar orçamento:", error);
            setSearchError("Erro ao criar orçamento. Tente novamente.");
            return;
        }
        
        // Reset states and close
        setIsAddModalOpen(false);
        setSearch('');
        setSelectedClient(null);
        setSearchError('');
        setNewObservations('');
    };

    const handleDeleteOrder = async (id: string) => {
        if (window.confirm('Tem certeza que deseja excluir este pedido?')) {
            try {
                await deleteItem('commercial_orders', id);
            } catch (error) {
                console.error('Erro ao excluir pedido:', error);
                alert('Erro ao excluir pedido.');
            }
        }
    };

    const handleApproveOrder = async () => {
        if (!orderToAuthorize) return;
        if (!authorizeDate || !authorizeTime) {
            alert('Por favor, informe a data e hora do término da leitura.');
            return;
        }
        
        const [year, month, day] = authorizeDate.split('-');
        const deadline = `${day}/${month}/${year} às ${authorizeTime}`;

        // Get current date/time for startedAt
        const now = new Date();
        const startedAt = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth()+1).toString().padStart(2, '0')}/${now.getFullYear()} às ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        try {
            await updateItem('commercial_orders', orderToAuthorize.id!, { 
                status: 'Em processo de leitura',
                engineeringDeadline: deadline,
                readingStartedAt: startedAt
            });
            setIsAuthorizeModalOpen(false);
            setOrderToAuthorize(null);
            setAuthorizeDate('');
            setAuthorizeTime('');
        } catch (error) {
            console.error('Erro ao autorizar pedido:', error);
            alert('Erro ao autorizar pedido.');
        }
    };

    const handleFinishReading = async () => {
        if (!orderToFinishReading) return;
        if (!jsonContent.trim()) {
            alert('Por favor, cole o conteúdo JSON do projeto.');
            return;
        }

        let parsedData;
        try {
            parsedData = JSON.parse(jsonContent);
        } catch (e) {
            alert('JSON inválido. Por favor, verifique o conteúdo.');
            return;
        }

        const now = new Date();
        const finishedAt = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth()+1).toString().padStart(2, '0')}/${now.getFullYear()} às ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        try {
            await updateItem('commercial_orders', orderToFinishReading.id!, { 
                status: 'Leitura Finalizada, aguardo setor de produção',
                projectData: parsedData,
                readingFinishedAt: finishedAt
            });
            setIsFinishReadingModalOpen(false);
            setOrderToFinishReading(null);
            setJsonContent('');
        } catch (error) {
            console.error('Erro ao finalizar leitura:', error);
            alert('Erro ao finalizar leitura.');
        }
    };

    const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            // Carregar via CDN para garantir que funcione sem problemas de build do Vite
            const loadPdfJs = async () => {
                if ((window as any).pdfjsLib) return (window as any).pdfjsLib;
                return new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
                    script.onload = () => {
                        const lib = (window as any).pdfjsLib;
                        lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                        resolve(lib);
                    };
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
            };

            const pdfjsLib: any = await loadPdfJs();
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            let fullText = '';

            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items
                    .map((item: any) => item.str.trim())
                    .filter((str: string) => str.length > 0)
                    .join(' ');
                fullText += pageText + ' ';
            }

            console.log("Texto extraído do PDF:", fullText);

            // O formato extraído pelo pdfjs saiu misturado, exatamente assim:
            // "220 Peso (kg) OS Ø (mm) Aço Qtde Compr. (cm) 12,5 CA50 6 12,710 1 Feixe único N1 Pos."
            const regex = /(\d+)\s+Peso \(kg\)\s+OS\s+Ø \(mm\)\s+Aço\s+Qtde\s+Compr\.\s*\(cm\)\s+(\d+(?:,\d+)?)\s+CA\d+\s+(\d+)\s+(\d+(?:,\d+)?)\s+(\d+(?:-\d+)?)\s+.*?\s+([A-Za-z0-9]+)\s+Pos\./gi;
            const results = [];
            let match;
            while ((match = regex.exec(fullText)) !== null) {
                const comprimento = parseInt(match[1], 10);
                const mm = parseFloat(match[2].replace(',', '.'));
                const qunti = parseInt(match[3], 10);
                const peso = parseFloat(match[4].replace(',', '.'));
                const os = match[5].includes('-') ? match[5] : parseInt(match[5], 10) || match[5];
                const pos = match[6];
                
                if (qunti > 0 && mm > 0 && comprimento > 0) {
                    results.push({
                        os,
                        pos,
                        mm,
                        qunti,
                        comprimento,
                        peso
                    });
                }
            }

            if (results.length > 0) {
                setJsonContent(JSON.stringify(results, null, 2));
                alert(`Sucesso! ${results.length} itens extraídos do PDF.`);
            } else {
                alert('Não foi possível encontrar itens válidos no PDF. Você ainda pode colar o JSON manualmente.');
            }

        } catch (error) {
            console.error('Erro ao processar PDF:', error);
            alert('Erro ao processar o arquivo PDF. Certifique-se de que é um arquivo válido.');
        } finally {
            // Limpa o input para permitir selecionar o mesmo arquivo novamente
            e.target.value = '';
        }
    };

    const getRowClass = (status?: string) => {
        if (!status) return 'bg-emerald-50/70 border-b border-emerald-100 hover:bg-emerald-100/50 text-slate-800';
        const clean = status.toLowerCase();
        
        if (clean === 'orçamento vazio' || clean === 'orçamento incompleto') {
            return 'bg-red-50/70 border-b border-red-100 hover:bg-red-100/50 text-slate-800';
        }
        if (clean === 'preço desatualizado') {
            return 'bg-amber-50/70 border-b border-amber-100 hover:bg-amber-100/50 text-slate-800';
        }
        if (clean === 'em processo de leitura') {
            return 'bg-orange-100 border-b-2 border-orange-400 hover:bg-orange-200 text-slate-900 font-medium shadow-sm';
        }
        if (clean === 'leitura finalizada, aguardo setor de produção') {
            return 'bg-green-100 border-b-2 border-green-400 hover:bg-green-200 text-slate-900 font-medium shadow-sm';
        }
        if (clean === 'aguardando engenharia') {
            return 'bg-red-200 border-b-2 border-red-400 hover:bg-red-300 text-slate-900 font-medium shadow-sm';
        }
        if (clean === 'autorizado engenharia' || clean === 'pedido autorizado') {
            return 'bg-emerald-100 border-b-2 border-emerald-300 hover:bg-emerald-200 text-slate-900 font-medium shadow-sm';
        }
        return 'bg-emerald-50/70 border-b border-emerald-100 hover:bg-emerald-100/50 text-slate-800';
    };

    const isGestor = currentUser?.role === 'gestor' || currentUser?.role === 'admin';
    const baseOrders = (commercialOrders || []).filter(o => {
        // Apenas mostra os pedidos (onde status não é 'orçamento')
        if (o.status?.toLowerCase().includes('orçamento')) return false;

        if (!isGestor) {
            const userName = (currentUser?.name || currentUser?.username || '').toUpperCase();
            const orderSalesperson = (o.salesperson || '').toUpperCase();
            if (orderSalesperson !== userName) {
                return false;
            }
        }

        if (search.trim()) {
            const term = search.toLowerCase().trim();
            const matchesSearch = 
                (o.orderNumber && String(o.orderNumber).toLowerCase().includes(term)) ||
                (o.clientName && o.clientName.toLowerCase().includes(term)) ||
                (o.clientCode && String(o.clientCode).toLowerCase().includes(term)) ||
                (o.salesperson && o.salesperson.toLowerCase().includes(term));
            
            if (!matchesSearch) return false;
        }

        // Filter by active tab
        const status = o.status?.toLowerCase() || '';
        const isFinished = status !== 'aguardando engenharia' && status !== 'em processo de leitura';
        
        if (activeTab === 'ativos' && isFinished) return false;
        if (activeTab === 'finalizados' && !isFinished) return false;

        return true;
    });

    const totalPedidos = baseOrders.length;

    if (editingOrder) {
        return (
            <OrderItemsEditor
                order={editingOrder}
                onClose={() => setEditingOrder(null)}
                onSaveSuccess={() => {
                    // It will automatically refresh due to Realtime subscriptions
                }}
            />
        );
    }

    return (
        <div className="p-4 md:p-8 space-y-6">
            {/* Top Navigation with Mini Dashboard */}
            <div className="flex items-center justify-between no-print">
                <div className="flex items-center gap-8">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                            <span className="text-4xl">📝</span>
                            Gestão de Pedidos - Engenharia
                        </h1>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">MSM SISTEMAS • SETOR DE ENGENHARIA</p>
                    </div>

                    {/* Mini Dashboard KPIs */}
                    <div className="flex gap-3">
                        <div className="bg-white border border-slate-200 shadow-sm rounded-xl px-5 py-2 flex flex-col items-center justify-center min-w-[120px]">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pedidos Ativos</span>
                            <span className="text-2xl font-black text-emerald-600">{totalPedidos}</span>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3">
                    {/* Botões de atalho omitidos para o setor de produção */}
                </div>
            </div>

            {/* Classification & Search Bar */}
            <div className="bg-white p-5 rounded-2xl border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
                <div className="flex flex-wrap items-center gap-6">
                    <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                        <button 
                            onClick={() => setActiveTab('ativos')}
                            className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase transition-all ${activeTab === 'ativos' ? 'bg-white shadow-sm text-sky-700' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Projetos Ativos
                        </button>
                        <button 
                            onClick={() => setActiveTab('finalizados')}
                            className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase transition-all ${activeTab === 'finalizados' ? 'bg-white shadow-sm text-sky-700' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Projetos Finalizados
                        </button>
                    </div>

                    <div className="flex items-center gap-4 border-l border-slate-200 pl-6">
                        <div className="flex items-center gap-2">
                            <input 
                                type="radio" 
                                id="order-budget"
                                name="orderBy"
                                checked={orderBy === 'id'}
                                onChange={() => setOrderBy('id')}
                                className="accent-sky-600 w-4 h-4 cursor-pointer"
                            />
                            <label htmlFor="order-budget" className="text-xs font-bold text-slate-700 uppercase cursor-pointer">Classificar por Nº de Orçamento</label>
                        </div>
                        <div className="flex items-center gap-2">
                            <input 
                                type="radio" 
                                id="order-client"
                                name="orderBy"
                                checked={orderBy === 'clientCode'}
                                onChange={() => setOrderBy('clientCode')}
                                className="accent-sky-600 w-4 h-4 cursor-pointer"
                            />
                            <label htmlFor="order-client" className="text-xs font-bold text-slate-700 uppercase cursor-pointer">Classificar por Cód. Cliente</label>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2.5 max-w-md w-full">
                    <input 
                        type="text" 
                        placeholder="Pesquisar orçamento, cliente ou vendedor..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="flex-grow p-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    <button className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider">
                        Pesquisar
                    </button>
                </div>
            </div>

            {/* Quotes Table List */}
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden no-print">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-800 text-white">
                                <th className="p-4 text-center font-bold text-xs uppercase w-20">Nº</th>
                                <th className="p-4 text-center font-bold text-xs uppercase w-24">Data</th>
                                <th className="p-4 text-center font-bold text-xs uppercase w-28">Vendedor</th>
                                <th className="p-4 font-bold text-xs uppercase">Cliente</th>
                                <th className="p-4 text-center font-bold text-xs uppercase w-32">Status</th>
                                <th className="p-4 text-center font-bold text-xs uppercase w-36">Preço</th>
                                <th className="p-4 text-center font-bold text-xs uppercase w-48">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[...baseOrders].sort((a, b) => {
                                if (orderBy === 'id') {
                                    return String(b.orderNumber || '').localeCompare(String(a.orderNumber || ''));
                                }
                                return String(a.clientCode || '').localeCompare(String(b.clientCode || ''));
                            }).map((q) => {
                                // Formatar a data para o padrão BR caso venha como YYYY-MM-DD
                                const formattedDate = (q.date && String(q.date).includes('-')) 
                                    ? String(q.date).split('-').reverse().join('/') 
                                    : (q.date || '');

                                return (
                                    <tr key={q.id} className={`${getRowClass(q.status)} transition-colors`}>
                                        <td className="p-4 text-center font-black text-slate-900 text-sm">{q.orderNumber}</td>
                                        <td className="p-4 text-center font-bold text-slate-600 text-xs">{formattedDate}</td>
                                        <td className="p-4 text-center font-bold text-slate-700 text-xs">{q.salesperson}</td>
                                        <td className="p-4">
                                            <div className="flex flex-col">
                                                <span className="font-extrabold text-slate-950 text-xs uppercase">
                                                    ({q.clientCode}) {q.clientName}
                                                </span>
                                                <span className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">{q.clientCity}</span>
                                                {q.clientObs && <span className="text-[9px] font-semibold text-sky-600 mt-1 italic">{q.clientObs}</span>}
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            {q.status?.toLowerCase() === 'aguardando engenharia' ? (
                                                <div className="bg-red-500 text-white text-[10px] font-black uppercase px-2 py-1 rounded-full animate-pulse whitespace-nowrap shadow-md border border-red-600">
                                                    Aguardando Eng.
                                                </div>
                                            ) : q.status?.toLowerCase() === 'em processo de leitura' ? (
                                                <div className="flex flex-col items-center">
                                                    <span className="bg-orange-500 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-full whitespace-nowrap shadow-sm">
                                                        Em Leitura
                                                    </span>
                                                    {q.engineeringDeadline && (
                                                        <span className="text-[8px] font-bold text-orange-700 mt-1 uppercase whitespace-nowrap">
                                                            Até: {q.engineeringDeadline}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : q.status?.toLowerCase() === 'leitura finalizada, aguardo setor de produção' ? (
                                                <div className="bg-green-600 text-white text-[10px] font-black uppercase px-2 py-1 rounded-full whitespace-nowrap shadow-sm border border-green-700 inline-block">
                                                    Finalizado
                                                </div>
                                            ) : (
                                                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-tight italic">
                                                    {q.status || 'N/A'}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 text-center font-black text-slate-900 text-sm">
                                            <div>
                                                R$ {(q.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </div>
                                            {q.totalWeight ? (
                                                <div className="text-[10px] text-slate-500 font-bold mt-0.5">
                                                    {q.totalWeight.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg
                                                </div>
                                            ) : null}
                                            {(!q.price || q.price === 0) && (
                                                <div className="text-[10px] font-black text-red-600 uppercase tracking-tight mt-1 flex items-center justify-center gap-1">
                                                    <span>⚠️</span> INCOMPLETO
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 text-center">
                                            <select 
                                                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                                                onChange={(e) => {
                                                    if (e.target.value === 'print') {
                                                        setPrintingOrder(q);
                                                    } else if (e.target.value === 'approve') {
                                                        setOrderToAuthorize(q);
                                                        setIsAuthorizeModalOpen(true);
                                                    } else if (e.target.value === 'finish_reading') {
                                                        setOrderToFinishReading(q);
                                                        setIsFinishReadingModalOpen(true);
                                                    }
                                                    e.target.value = '';
                                                }}
                                            >
                                                <option value="">Ações...</option>
                                                <option value="print">🖨️ Imprimir Pedido</option>
                                                {q.status?.toLowerCase() === 'aguardando engenharia' && (
                                                    <option value="approve">✅ Autorizar Pedido</option>
                                                )}
                                                {q.status?.toLowerCase() === 'em processo de leitura' && (
                                                    <option value="finish_reading">🏁 Finalizar Leitura</option>
                                                )}
                                            </select>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Novo Orçamento Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-slate-50 w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        
                        <div className="p-6 border-b border-slate-200 bg-white flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-black text-slate-900">Novo Orçamento / Pedido</h2>
                                <p className="text-sm font-bold text-slate-500 uppercase mt-1">Preencha os dados abaixo para iniciar</p>
                            </div>
                            <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-red-500 transition-colors p-2 bg-slate-100 hover:bg-red-50 rounded-xl">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 space-y-8 bg-slate-50/50">
                            
                            {/* Buscar Cliente */}
                            <div className="space-y-3">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 text-sky-500"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
                                    Buscar Cliente
                                </label>
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        placeholder="Digite o nome, código ou CPF/CNPJ do cliente..." 
                                        value={clientSearchTerm}
                                        onChange={(e) => setClientSearchTerm(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSearchClient()}
                                        className="flex-1 bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-700 font-medium focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none transition-all shadow-sm" 
                                    />
                                    <button 
                                        onClick={handleSearchClient}
                                        className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-6 py-3 rounded-xl transition-colors shadow-md"
                                    >
                                        Buscar
                                    </button>
                                </div>
                                <div className="flex justify-between items-center">
                                    <p className="text-xs font-semibold text-slate-500">
                                        Cliente sem cadastro utilizar código <span className="text-sky-600 font-black">1001</span> (CONSUMIDOR BALCAO)
                                    </p>
                                    {searchError && (
                                        <p className="text-xs font-bold text-red-500 animate-pulse">{searchError}</p>
                                    )}
                                </div>
                                
                                {/* Exibição do cliente selecionado */}
                                {selectedClient && (
                                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mt-2 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest border border-emerald-200">
                                                    CÓD: {selectedClient.code}
                                                </span>
                                                <h3 className="font-bold text-emerald-950 text-sm">{selectedClient.name}</h3>
                                            </div>
                                            <div className="flex items-center gap-3 mt-1.5">
                                                <p className="text-xs font-semibold text-emerald-700">
                                                    {selectedClient.document1} {selectedClient.document2 ? `• ${selectedClient.document2}` : ''}
                                                </p>
                                                {selectedClient.phone && (
                                                    <p className="text-xs font-semibold text-emerald-700">
                                                        📞 {selectedClient.phone}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => {
                                                setSelectedClient(null);
                                                setClientSearchTerm('');
                                            }} 
                                            className="text-emerald-600 hover:text-emerald-800 hover:bg-emerald-100 p-2 rounded-lg transition-colors"
                                            title="Limpar cliente"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                )}
                                
                                <div className="space-y-2 mt-4">
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Observações (Opcional)</label>
                                    <textarea 
                                        rows={2}
                                        value={newObservations} 
                                        onChange={e => setNewObservations(e.target.value)} 
                                        placeholder="Ex: Descarregamento por conta do cliente..." 
                                        className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-slate-700 font-medium focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none transition-all shadow-sm resize-none" 
                                    />
                                </div>
                            </div>

                            <hr className="border-slate-200" />
                        </div>

                        <div className="p-6 border-t border-slate-200 bg-white flex justify-end gap-3">
                            <button onClick={() => setIsAddModalOpen(false)} className="px-6 py-2.5 rounded-xl font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors">
                                Cancelar
                            </button>
                            <button onClick={handleCreateOrder} disabled={!selectedClient} className="px-6 py-2.5 rounded-xl font-bold bg-emerald-500 hover:bg-emerald-600 text-white transition-colors shadow-md shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed">
                                Iniciar Orçamento
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Print View Modal */}
            {printingOrder && (
                <OrderPrintView 
                    order={printingOrder} 
                    onClose={() => setPrintingOrder(null)} 
                    activeBrandingPartner={activeBrandingPartner}
                />
            )}
            {/* Modal de Autorização */}
            {isAuthorizeModalOpen && orderToAuthorize && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-slate-50 w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-200 bg-white">
                            <h2 className="text-xl font-black text-slate-900">Autorizar Pedido</h2>
                            <p className="text-sm font-bold text-slate-500 uppercase mt-1">
                                Defina o tempo de leitura do projeto
                            </p>
                        </div>
                        <div className="p-6 flex flex-col gap-5">
                            <div>
                                <label className="block text-xs font-black text-slate-700 uppercase mb-2">Data de Término</label>
                                <input 
                                    type="date"
                                    value={authorizeDate}
                                    onChange={(e) => setAuthorizeDate(e.target.value)}
                                    className="w-full bg-white border border-slate-300 rounded-xl p-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-700 uppercase mb-2">Hora de Término</label>
                                <input 
                                    type="time"
                                    value={authorizeTime}
                                    onChange={(e) => setAuthorizeTime(e.target.value)}
                                    className="w-full bg-white border border-slate-300 rounded-xl p-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
                                />
                            </div>
                        </div>
                        <div className="p-6 border-t border-slate-200 bg-white flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setIsAuthorizeModalOpen(false);
                                    setOrderToAuthorize(null);
                                    setAuthorizeDate('');
                                    setAuthorizeTime('');
                                }}
                                className="px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleApproveOrder}
                                className="bg-sky-600 hover:bg-sky-700 text-white font-extrabold px-6 py-3 rounded-xl shadow-md transition-all"
                            >
                                Confirmar e Autorizar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Finalizar Leitura */}
            {isFinishReadingModalOpen && orderToFinishReading && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-slate-50 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-200 bg-white">
                            <h2 className="text-xl font-black text-slate-900">Finalizar Leitura</h2>
                            <p className="text-sm font-bold text-slate-500 uppercase mt-1">
                                Importe um PDF do projeto ou cole o conteúdo JSON abaixo
                            </p>
                        </div>
                        <div className="p-6 flex flex-col gap-5">
                            <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 flex flex-col items-center justify-center gap-3">
                                <span className="text-sm font-black text-sky-800 uppercase text-center">Opção Inteligente: Extrair do PDF</span>
                                <label className="cursor-pointer bg-white hover:bg-sky-100 text-sky-700 border border-sky-300 font-bold px-6 py-3 rounded-xl transition-all shadow-sm flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                    </svg>
                                    Selecionar PDF do Projeto
                                    <input type="file" accept=".pdf" className="hidden" onChange={handlePdfUpload} />
                                </label>
                                <p className="text-xs text-sky-600 font-medium text-center">Os dados (OS, Posição, MM, etc.) serão lidos e o JSON será gerado automaticamente abaixo.</p>
                            </div>
                            
                            <div className="relative flex items-center justify-center">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-slate-200"></div>
                                </div>
                                <div className="relative bg-slate-50 px-4 text-xs font-black text-slate-400 uppercase">Ou Manualmente</div>
                            </div>

                            <div>
                                <label className="block text-xs font-black text-slate-700 uppercase mb-2">
                                    Dados do Projeto (JSON) <span className="text-red-500">*</span>
                                </label>
                                <textarea 
                                    value={jsonContent}
                                    onChange={(e) => setJsonContent(e.target.value)}
                                    className="w-full bg-white border border-slate-300 rounded-xl p-3 text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 h-64 resize-none shadow-sm"
                                    placeholder='[\n  { "os": 36, "pos": "N3", "mm": 8.0, "qunti": 64, "comprimento": 150, "peso": 37.920 }\n]'
                                />
                            </div>
                        </div>
                        <div className="p-6 border-t border-slate-200 bg-white flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setIsFinishReadingModalOpen(false);
                                    setOrderToFinishReading(null);
                                    setJsonContent('');
                                }}
                                className="px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleFinishReading}
                                disabled={!jsonContent.trim()}
                                className={`font-extrabold px-6 py-3 rounded-xl shadow-md transition-all ${
                                    jsonContent.trim()
                                        ? 'bg-sky-600 hover:bg-sky-700 text-white'
                                        : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                }`}
                            >
                                Salvar Projeto e Finalizar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
