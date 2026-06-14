import React, { useState, useMemo, useEffect } from 'react';
import type { Page, User } from '../types';
import { 
    PencilIcon, TrashIcon, ArrowLeftIcon 
} from './icons';

interface ProductItem {
    id: string;
    description: string;
    qty: number;
    length: number;
    weightPerMeter: number;
    weight: number;
    price: number;
}

interface Quote {
    id: string; // Quote Number
    date: string; // dd/mm/yy
    salesperson: string; // Vendedor
    clientCode: string;
    clientName: string;
    clientCity: string;
    clientObs: string;
    price: number;
    hardwareType: string; // e.g. "FERRAGEM"
    forecastDate: string; // Previsão Término
    status: string; // e.g. "Aguardando Exportação", "Orçamento Vazio", "Preço Desatualizado"
    products: ProductItem[];
    notes: string[];
    history: { date: string; action: string; user: string }[];
}

interface PointingSystemProps {
    currentUser: User | null;
    showNotification: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

const INITIAL_QUOTES: Quote[] = [
    {
        id: '228802',
        date: '10/06/26',
        salesperson: 'KFOGACA',
        clientCode: '17406',
        clientName: 'CONSUMIDOR BALCAO',
        clientCity: 'ITAPETININGA-SP',
        clientObs: 'OBS: JR CAMPOLIM - ESTACAS TORRE',
        price: 141838.50,
        hardwareType: 'FERRAGEM',
        forecastDate: '15/06/26',
        status: 'Aguardando Exportação',
        products: [
            { id: '1', description: 'Coluna Pronta CA50 10.00mm', qty: 150, length: 6, weightPerMeter: 0.617, weight: 555.3, price: 141838.50 }
        ],
        notes: ['Entregar de manhã', 'Falar com engenheiro Carlos'],
        history: [
            { date: '14/06/2026 19:10', action: 'Orçamento Criado', user: 'KFOGACA' },
            { date: '14/06/2026 19:15', action: 'Produtos Adicionados', user: 'KFOGACA' }
        ]
    },
    {
        id: '228801',
        date: '10/06/26',
        salesperson: 'KFOGACA',
        clientCode: '17406',
        clientName: 'CONSUMIDOR BALCAO',
        clientCity: 'ITAPETININGA-SP',
        clientObs: 'OBS: JR CAMPOLIM - ESTACAS',
        price: 37707.00,
        hardwareType: 'FERRAGEM',
        forecastDate: '16/06/26',
        status: 'Aguardando Exportação',
        products: [
            { id: '1', description: 'Viga Pronta CA60 6.30mm', qty: 80, length: 4, weightPerMeter: 0.245, weight: 78.4, price: 37707.00 }
        ],
        notes: [],
        history: [
            { date: '14/06/2026 18:30', action: 'Orçamento Criado', user: 'KFOGACA' }
        ]
    },
    {
        id: '228788',
        date: '10/06/26',
        salesperson: 'GCRUZ',
        clientCode: '165762',
        clientName: 'VITAL SOUZA SANTOS',
        clientCity: 'TATUI-SP',
        clientObs: 'OBS: VIGAS BALDRAME - FOLHA 06/15',
        price: 0.00,
        hardwareType: '',
        forecastDate: '18/06/26',
        status: 'Orçamento Vazio',
        products: [],
        notes: [],
        history: [
            { date: '14/06/2026 17:45', action: 'Orçamento Criado (Sem Itens)', user: 'GCRUZ' }
        ]
    },
    {
        id: '228787',
        date: '10/06/26',
        salesperson: 'GCRUZ',
        clientCode: '165762',
        clientName: 'VITAL SOUZA SANTOS',
        clientCity: 'TATUI-SP',
        clientObs: 'OBS: ARRANQUES - FOLHA 05/15',
        price: 0.00,
        hardwareType: '',
        forecastDate: '18/06/26',
        status: 'Orçamento Vazio',
        products: [],
        notes: [],
        history: [
            { date: '14/06/2026 17:42', action: 'Orçamento Criado (Sem Itens)', user: 'GCRUZ' }
        ]
    },
    {
        id: '228786',
        date: '10/06/26',
        salesperson: 'GCRUZ',
        clientCode: '165762',
        clientName: 'VITAL SOUZA SANTOS',
        clientCity: 'TATUI-SP',
        clientObs: 'OBS: BLOCOS - FOLHA 05/15',
        price: 0.00,
        hardwareType: 'FERRAGEM',
        forecastDate: '19/06/26',
        status: 'Preço Desatualizado',
        products: [],
        notes: [],
        history: [
            { date: '14/06/2026 17:30', action: 'Orçamento Criado', user: 'GCRUZ' },
            { date: '14/06/2026 17:35', action: 'Status alterado para Preço Desatualizado', user: 'Sistema' }
        ]
    },
    {
        id: '228785',
        date: '10/06/26',
        salesperson: 'GCRUZ',
        clientCode: '165762',
        clientName: 'VITAL SOUZA SANTOS',
        clientCity: 'TATUI-SP',
        clientObs: 'OBS: ESTACAS - FOLHA 01/15',
        price: 3297.45,
        hardwareType: 'FERRAGEM',
        forecastDate: '20/06/26',
        status: 'Aguardando Exportação',
        products: [
            { id: '1', description: 'Aço Estribo CA60 5.00mm', qty: 200, length: 1, weightPerMeter: 0.154, weight: 30.8, price: 3297.45 }
        ],
        notes: [],
        history: [
            { date: '14/06/2026 17:10', action: 'Orçamento Criado', user: 'GCRUZ' }
        ]
    },
    {
        id: '228783',
        date: '10/06/26',
        salesperson: 'MGALVAO',
        clientCode: '21312',
        clientName: 'JOSE APARECIDO RODRIGUES',
        clientCity: 'ITAPETININGA-SP',
        clientObs: 'OBS: AGUARDANDO AUTORIZAÇÃO DO SETOR DE CRÉDITO/FINANCEIRO.',
        price: 74.04,
        hardwareType: 'FERRAGEM',
        forecastDate: '22/06/26',
        status: 'Exportado 10/06/26 PREVENDA: 2019749',
        products: [
            { id: '1', description: 'Barra CA50 8.00mm', qty: 10, length: 12, weightPerMeter: 0.395, weight: 47.4, price: 74.04 }
        ],
        notes: ['Verificar liberação com financeiro antes do corte.'],
        history: [
            { date: '14/06/2026 16:50', action: 'Orçamento Criado', user: 'MGALVAO' },
            { date: '14/06/2026 17:00', action: 'Orçamento Exportado para o ERP', user: 'Sistema' }
        ]
    },
    {
        id: '228781',
        date: '10/06/26',
        salesperson: 'ADRIAN',
        clientCode: '54555',
        clientName: 'LUCIANA PAULA DE ALMEIDA CIANFLONE',
        clientCity: 'ITAPETININGA-SP',
        clientObs: 'OBS: VIGAS DE COBERTURA',
        price: 0.00,
        hardwareType: 'FERRAGEM',
        forecastDate: '23/06/26',
        status: 'Preço Desatualizado',
        products: [],
        notes: [],
        history: [
            { date: '14/06/2026 16:20', action: 'Orçamento Criado', user: 'ADRIAN' }
        ]
    }
];

const PointingSystem: React.FC<PointingSystemProps> = ({ currentUser, showNotification }) => {
    const [quotes, setQuotes] = useState<Quote[]>(() => {
        const saved = localStorage.getItem('msm_quotes');
        return saved ? JSON.parse(saved) : INITIAL_QUOTES;
    });

    useEffect(() => {
        localStorage.setItem('msm_quotes', JSON.stringify(quotes));
    }, [quotes]);

    // Filter & Order State
    const [search, setSearch] = useState('');
    const [orderBy, setOrderBy] = useState<'id' | 'clientCode'>('id');
    const [isAddOpen, setIsAddOpen] = useState(false);

    // Modals control
    const [activeModal, setActiveModal] = useState<{
        type: 'client' | 'salesperson' | 'notes' | 'products' | 'price' | 'duplicate' | 'print' | 'printFull' | 'printSteel' | 'history';
        quoteId: string;
    } | null>(null);

    // Calculation factor (standard R$ 8.50 per kg of steel)
    const STEEL_PRICE_FACTOR = 8.50;

    // Filter budget list
    const filteredQuotes = useMemo(() => {
        let result = quotes.filter(q => {
            const term = search.toLowerCase();
            return (
                q.id.toLowerCase().includes(term) ||
                q.clientName.toLowerCase().includes(term) ||
                q.clientCode.toLowerCase().includes(term) ||
                q.salesperson.toLowerCase().includes(term)
            );
        });

        if (orderBy === 'id') {
            result.sort((a, b) => b.id.localeCompare(a.id));
        } else {
            result.sort((a, b) => a.clientCode.localeCompare(b.clientCode));
        }
        return result;
    }, [quotes, search, orderBy]);

    // Stats calculations
    const stats = useMemo(() => {
        const counts = {
            waitingExport: 67,
            exported: 153,
            exportedPv: 2,
            sentProduction: 20,
            producing: 35,
            completed: 252,
            outdatedPrice: 21,
            incomplete: 49
        };

        // Dynamically adjust from added budgets
        const customQuotes = quotes.filter(q => !INITIAL_QUOTES.some(iq => iq.id === q.id));
        customQuotes.forEach(q => {
            if (q.status === 'Aguardando Exportação') counts.waitingExport++;
            else if (q.status === 'Orçamento Vazio') counts.incomplete++;
            else if (q.status === 'Preço Desatualizado') counts.outdatedPrice++;
            else if (q.status === 'Concluído') counts.completed++;
        });

        return counts;
    }, [quotes]);

    const activeQuote = useMemo(() => {
        if (!activeModal) return null;
        return quotes.find(q => q.id === activeModal.quoteId) || null;
    }, [activeModal, quotes]);

    // Form inputs state for New Quote
    const [newId, setNewId] = useState('');
    const [newClientCode, setNewClientCode] = useState('');
    const [newClientName, setNewClientName] = useState('');
    const [newClientCity, setNewClientCity] = useState('');
    const [newClientObs, setNewClientObs] = useState('');
    const [newHardwareType, setNewHardwareType] = useState('FERRAGEM');
    const [newForecast, setNewForecast] = useState('');

    useEffect(() => {
        if (isAddOpen) {
            const maxId = Math.max(...quotes.map(q => parseInt(q.id) || 0));
            setNewId(String(maxId + 1));
            setNewClientCode('');
            setNewClientName('');
            setNewClientCity('');
            setNewClientObs('');
            setNewHardwareType('FERRAGEM');
            const today = new Date();
            today.setDate(today.getDate() + 5); // Default forecast is 5 days from now
            setNewForecast(today.toISOString().split('T')[0]);
        }
    }, [isAddOpen, quotes]);

    const handleCreateQuote = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newId || !newClientName) {
            showNotification('Preencha os campos obrigatórios.', 'warning');
            return;
        }
        if (quotes.some(q => q.id === newId)) {
            showNotification('Número de orçamento já cadastrado.', 'error');
            return;
        }

        const date = new Date();
        const formattedDate = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear().toString().substring(2)}`;

        const newQuote: Quote = {
            id: newId,
            date: formattedDate,
            salesperson: (currentUser?.username || 'GCRUZ').toUpperCase(),
            clientCode: newClientCode || '00000',
            clientName: newClientName,
            clientCity: newClientCity || 'ITAPETININGA-SP',
            clientObs: newClientObs ? `OBS: ${newClientObs}` : '',
            price: 0.00,
            hardwareType: newHardwareType,
            forecastDate: newForecast ? newForecast.split('-').reverse().join('/').substring(0, 8) : formattedDate,
            status: 'Orçamento Vazio',
            products: [],
            notes: [],
            history: [{ date: new Date().toLocaleString('pt-BR'), action: 'Orçamento Criado', user: currentUser?.username || 'Sistema' }]
        };

        setQuotes(prev => [newQuote, ...prev]);
        setIsAddOpen(false);
        showNotification(`Orçamento ${newId} criado com sucesso!`, 'success');
    };

    const updateQuoteField = (quoteId: string, fields: Partial<Quote>) => {
        setQuotes(prev => prev.map(q => {
            if (q.id === quoteId) {
                const updated = {
                    ...q,
                    ...fields,
                    history: [
                        ...(q.history || []),
                        {
                            date: new Date().toLocaleString('pt-BR'),
                            action: Object.keys(fields).map(k => `Campo ${k} atualizado`).join(', '),
                            user: currentUser?.username || 'Sistema'
                        }
                    ]
                };
                return updated;
            }
            return q;
        }));
    };

    const handleDuplicate = (quoteId: string, newIdInput: string) => {
        const target = quotes.find(q => q.id === quoteId);
        if (!target) return;
        if (quotes.some(q => q.id === newIdInput)) {
            showNotification('ID de destino já existe.', 'error');
            return;
        }

        const duplicated: Quote = {
            ...target,
            id: newIdInput,
            date: new Date().toLocaleDateString('pt-BR').substring(0, 8),
            history: [{ date: new Date().toLocaleString('pt-BR'), action: `Duplicado do orçamento ${quoteId}`, user: currentUser?.username || 'Sistema' }]
        };

        setQuotes(prev => [duplicated, ...prev]);
        setActiveModal(null);
        showNotification(`Orçamento ${quoteId} duplicado para ${newIdInput}!`, 'success');
    };

    const handleProductSave = (quoteId: string, productsList: ProductItem[]) => {
        const totalPrice = productsList.reduce((sum, item) => sum + item.price, 0);
        const nextStatus = productsList.length === 0 ? 'Orçamento Vazio' : 'Aguardando Exportação';
        
        setQuotes(prev => prev.map(q => {
            if (q.id === quoteId) {
                return {
                    ...q,
                    products: productsList,
                    price: totalPrice,
                    status: nextStatus,
                    history: [
                        ...(q.history || []),
                        {
                            date: new Date().toLocaleString('pt-BR'),
                            action: `Produtos atualizados (Preço recalculado: R$ ${totalPrice.toFixed(2)})`,
                            user: currentUser?.username || 'Sistema'
                        }
                    ]
                };
            }
            return q;
        }));
        showNotification('Produtos salvos com sucesso e preço atualizado!', 'success');
    };

    // Row styles resolver
    const getRowClass = (status: string, price: number) => {
        const clean = status.toLowerCase();
        if (clean === 'orçamento vazio' || clean === 'orçamento incompleto') {
            return 'bg-red-50/70 border-b border-red-100 hover:bg-red-100/50 text-slate-800';
        }
        if (clean === 'preço desatualizado') {
            return 'bg-amber-50/70 border-b border-amber-100 hover:bg-amber-100/50 text-slate-800';
        }
        return 'bg-emerald-50/70 border-b border-emerald-100 hover:bg-emerald-100/50 text-slate-800';
    };

    return (
        <div className="p-4 md:p-8 space-y-6">
            {/* Top Navigation */}
            <div className="flex items-center justify-between no-print">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 flex items-center gap-2">
                        <span>📝 Apontamento de Orçamentos</span>
                    </h1>
                    <p className="text-xs text-slate-500 font-bold uppercase mt-1">MSM Sistemas • Setor Comercial</p>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={() => setIsAddOpen(true)}
                        className="bg-sky-600 hover:bg-sky-700 text-white font-extrabold py-2 px-5 rounded-xl transition-all shadow-md flex items-center gap-2 text-sm"
                    >
                        <span>+ Novo Orçamento</span>
                    </button>
                </div>
            </div>

            {/* Badges/Stats Header Panel */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 no-print">
                <div className="bg-[#122A45]/10 border border-amber-500/20 p-3 rounded-2xl text-center">
                    <span className="block text-[22px] font-black text-amber-500">{stats.waitingExport}</span>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-tight">Aguardando Exportação</span>
                </div>
                <div className="bg-[#122A45]/10 border border-sky-500/20 p-3 rounded-2xl text-center">
                    <span className="block text-[22px] font-black text-sky-500">{stats.exported}</span>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-tight">Exportado Orçamento</span>
                </div>
                <div className="bg-[#122A45]/10 border border-indigo-500/20 p-3 rounded-2xl text-center">
                    <span className="block text-[22px] font-black text-indigo-500">{stats.exportedPv}</span>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-tight">Exportado PV Merco</span>
                </div>
                <div className="bg-[#122A45]/10 border border-slate-500/20 p-3 rounded-2xl text-center">
                    <span className="block text-[22px] font-black text-slate-600">{stats.sentProduction}</span>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-tight">Enviado p/ Produção</span>
                </div>
                <div className="bg-[#122A45]/10 border border-blue-500/20 p-3 rounded-2xl text-center">
                    <span className="block text-[22px] font-black text-blue-500">{stats.producing}</span>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-tight">Produzindo</span>
                </div>
                <div className="bg-[#122A45]/10 border border-emerald-500/20 p-3 rounded-2xl text-center">
                    <span className="block text-[22px] font-black text-emerald-500">{stats.completed}</span>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-tight">Concluído</span>
                </div>
                <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-2xl text-center animate-pulse">
                    <span className="block text-[22px] font-black text-red-500">{stats.outdatedPrice}</span>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-tight">Preço Desatualizado</span>
                </div>
                <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-2xl text-center">
                    <span className="block text-[22px] font-black text-red-400">{stats.incomplete}</span>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-tight">Orçamento Incompleto</span>
                </div>
            </div>

            {/* Classification & Search Bar */}
            <div className="bg-white p-5 rounded-2xl border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
                <div className="flex flex-wrap items-center gap-6">
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
                                <th className="p-4 text-center font-bold text-xs uppercase w-36">Preço</th>
                                <th className="p-4 text-center font-bold text-xs uppercase w-32">Tipo</th>
                                <th className="p-4 text-center font-bold text-xs uppercase w-36">Previsão Término</th>
                                <th className="p-4 text-center font-bold text-xs uppercase w-48">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredQuotes.map((q) => (
                                <tr key={q.id} className={`${getRowClass(q.status, q.price)} transition-colors`}>
                                    <td className="p-4 text-center font-black text-slate-900 text-sm">{q.id}</td>
                                    <td className="p-4 text-center font-bold text-slate-600 text-xs">{q.date}</td>
                                    <td className="p-4 text-center font-bold text-slate-700 text-xs">{q.salesperson}</td>
                                    <td className="p-4">
                                        <div className="flex flex-col">
                                            <span className="font-extrabold text-slate-950 text-xs">
                                                ({q.clientCode}) {q.clientName}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">{q.clientCity}</span>
                                            {q.clientObs && <span className="text-[9px] font-semibold text-sky-600 mt-1 italic">{q.clientObs}</span>}
                                        </div>
                                    </td>
                                    <td className="p-4 text-center font-black text-slate-900 text-sm">
                                        {q.price > 0 ? `R$ ${q.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'R$ 0,00'}
                                        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-tight mt-0.5 italic">{q.status}</div>
                                    </td>
                                    <td className="p-4 text-center font-extrabold text-slate-700 text-xs uppercase">
                                        {q.hardwareType || '-'}
                                    </td>
                                    <td className="p-4 text-center font-bold text-slate-600 text-xs">
                                        {q.forecastDate}
                                    </td>
                                    <td className="p-4 text-center">
                                        <select
                                            value=""
                                            onChange={(e) => {
                                                const action = e.target.value;
                                                if (action) {
                                                    setActiveModal({ type: action as any, quoteId: q.id });
                                                }
                                            }}
                                            className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                                        >
                                            <option value="">Ações...</option>
                                            <option value="client">📝 Editar Cliente</option>
                                            <option value="salesperson">👤 Editar Vendedor</option>
                                            <option value="notes">📌 Editar Lembretes</option>
                                            <option value="products">🛠️ Editar Produtos</option>
                                            <option value="price">💰 Editar Preço</option>
                                            <option value="duplicate">📋 Duplicar Orçamento</option>
                                            <option value="print">🖨️ Imprimir Orçamento</option>
                                            <option value="printFull">🖨️ Imprimir Completo</option>
                                            <option value="printSteel">🖨️ Resumo do Aço</option>
                                            <option value="history">📜 Ver Histórico</option>
                                        </select>
                                    </td>
                                </tr>
                            ))}
                            {filteredQuotes.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="p-8 text-center text-slate-500 font-bold">Nenhum orçamento encontrado.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL: Novo Orçamento */}
            {isAddOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <form onSubmit={handleCreateQuote} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
                        <div className="bg-[#0F3F5C] p-5 text-white flex justify-between items-center">
                            <h2 className="text-xl font-bold flex items-center gap-2"><span>Novo Orçamento de Venda</span></h2>
                            <button type="button" onClick={() => setIsAddOpen(false)} className="text-white hover:text-slate-200 text-2xl font-bold">&times;</button>
                        </div>
                        <div className="p-6 space-y-4 overflow-y-auto flex-grow">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Nº Orçamento *</label>
                                    <input 
                                        type="text" 
                                        value={newId} 
                                        onChange={(e) => setNewId(e.target.value.replace(/\D/g, ''))}
                                        className="w-full p-2.5 border rounded-xl text-sm font-bold bg-slate-50 text-slate-700" 
                                        required 
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Vendedor (Sessão)</label>
                                    <input 
                                        type="text" 
                                        value={currentUser?.username || 'GCRUZ'} 
                                        disabled 
                                        className="w-full p-2.5 border rounded-xl text-sm font-bold bg-slate-100 text-slate-500 cursor-not-allowed" 
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-1">
                                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Cód. Cliente</label>
                                    <input 
                                        type="text" 
                                        placeholder="17406"
                                        value={newClientCode} 
                                        onChange={(e) => setNewClientCode(e.target.value)}
                                        className="w-full p-2.5 border rounded-xl text-sm font-bold" 
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Nome Cliente *</label>
                                    <input 
                                        type="text" 
                                        placeholder="CONSUMIDOR BALCÃO"
                                        value={newClientName} 
                                        onChange={(e) => setNewClientName(e.target.value)}
                                        className="w-full p-2.5 border rounded-xl text-sm font-bold" 
                                        required 
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Cidade / Estado</label>
                                    <input 
                                        type="text" 
                                        placeholder="ITAPETININGA-SP"
                                        value={newClientCity} 
                                        onChange={(e) => setNewClientCity(e.target.value)}
                                        className="w-full p-2.5 border rounded-xl text-sm font-bold" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Tipo de Ferragem</label>
                                    <select 
                                        value={newHardwareType} 
                                        onChange={(e) => setNewHardwareType(e.target.value)}
                                        className="w-full p-2.5 border rounded-xl text-sm font-bold bg-white"
                                    >
                                        <option value="FERRAGEM">FERRAGEM</option>
                                        <option value="">Nenhum (Vazio)</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Observações do Cliente</label>
                                <textarea 
                                    rows={2} 
                                    placeholder="Detalhes adicionais do orçamento..."
                                    value={newClientObs} 
                                    onChange={(e) => setNewClientObs(e.target.value)}
                                    className="w-full p-2.5 border rounded-xl text-sm font-bold resize-none" 
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4 border-t pt-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Previsão de Término</label>
                                    <input 
                                        type="date" 
                                        value={newForecast} 
                                        onChange={(e) => setNewForecast(e.target.value)}
                                        className="w-full p-2.5 border rounded-xl text-sm font-bold" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Preço Inicial</label>
                                    <input 
                                        type="text" 
                                        value="R$ 0,00" 
                                        disabled 
                                        className="w-full p-2.5 border rounded-xl text-sm font-bold bg-slate-100 text-slate-500 select-none cursor-not-allowed" 
                                    />
                                    <span className="text-[9px] text-slate-400 font-bold block mt-1">Calculado pelo sistema ao adicionar produtos</span>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 border-t flex justify-end gap-3">
                            <button type="button" onClick={() => setIsAddOpen(false)} className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2 px-5 rounded-xl transition text-sm">Cancelar</button>
                            <button type="submit" className="bg-[#0F3F5C] hover:bg-[#0A2A3D] text-white font-extrabold py-2 px-6 rounded-xl transition text-sm">Salvar Orçamento</button>
                        </div>
                    </form>
                </div>
            )}

            {/* MOCK ACTIONS MODALS */}
            {activeModal && activeQuote && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    {/* MODAL: Editar Cliente */}
                    {activeModal.type === 'client' && (
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                            <div className="bg-[#0F3F5C] p-4 text-white flex justify-between items-center">
                                <h3 className="font-bold text-lg">📝 Editar Dados do Cliente</h3>
                                <button onClick={() => setActiveModal(null)} className="text-white text-xl font-bold">&times;</button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Código do Cliente</label>
                                    <input 
                                        type="text" 
                                        defaultValue={activeQuote.clientCode} 
                                        id="edit-client-code"
                                        className="w-full p-2.5 border rounded-xl text-sm font-bold" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Nome do Cliente</label>
                                    <input 
                                        type="text" 
                                        defaultValue={activeQuote.clientName} 
                                        id="edit-client-name"
                                        className="w-full p-2.5 border rounded-xl text-sm font-bold" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Cidade / UF</label>
                                    <input 
                                        type="text" 
                                        defaultValue={activeQuote.clientCity} 
                                        id="edit-client-city"
                                        className="w-full p-2.5 border rounded-xl text-sm font-bold" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Observações do Orçamento</label>
                                    <textarea 
                                        defaultValue={activeQuote.clientObs.replace(/^OBS:\s*/, '')} 
                                        id="edit-client-obs"
                                        className="w-full p-2.5 border rounded-xl text-sm font-bold resize-none" 
                                        rows={2}
                                    />
                                </div>
                            </div>
                            <div className="p-4 bg-slate-50 border-t flex justify-end gap-3">
                                <button onClick={() => setActiveModal(null)} className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2 px-4 rounded-xl text-xs uppercase">Cancelar</button>
                                <button 
                                    onClick={() => {
                                        const code = (document.getElementById('edit-client-code') as HTMLInputElement).value;
                                        const name = (document.getElementById('edit-client-name') as HTMLInputElement).value;
                                        const city = (document.getElementById('edit-client-city') as HTMLInputElement).value;
                                        const obsStr = (document.getElementById('edit-client-obs') as HTMLTextAreaElement).value;
                                        const obs = obsStr ? `OBS: ${obsStr}` : '';
                                        updateQuoteField(activeQuote.id, { clientCode: code, clientName: name, clientCity: city, clientObs: obs });
                                        setActiveModal(null);
                                        showNotification('Dados do cliente atualizados!', 'success');
                                    }}
                                    className="bg-[#0F3F5C] text-white font-extrabold py-2 px-5 rounded-xl text-xs uppercase"
                                >
                                    Salvar Alterações
                                </button>
                            </div>
                        </div>
                    )}

                    {/* MODAL: Editar Vendedor */}
                    {activeModal.type === 'salesperson' && (
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                            <div className="bg-[#0F3F5C] p-4 text-white flex justify-between items-center">
                                <h3 className="font-bold text-md">👤 Reatribuir Vendedor</h3>
                                <button onClick={() => setActiveModal(null)} className="text-white text-xl font-bold">&times;</button>
                            </div>
                            <div className="p-6 space-y-4">
                                <label className="block text-[10px] font-black text-slate-400 uppercase">Selecione o Vendedor</label>
                                <select 
                                    defaultValue={activeQuote.salesperson} 
                                    id="edit-salesperson-select"
                                    className="w-full p-2.5 border rounded-xl text-sm font-bold bg-white"
                                >
                                    <option value="KFOGACA">KFOGACA</option>
                                    <option value="GCRUZ">GCRUZ</option>
                                    <option value="MGALVAO">MGALVAO</option>
                                    <option value="ADRIAN">ADRIAN</option>
                                    <option value="MATHEUS">MATHEUS</option>
                                </select>
                            </div>
                            <div className="p-4 bg-slate-50 border-t flex justify-end gap-2">
                                <button onClick={() => setActiveModal(null)} className="bg-slate-200 text-slate-600 font-bold py-1.5 px-3 rounded-lg text-xs">Cancelar</button>
                                <button 
                                    onClick={() => {
                                        const seller = (document.getElementById('edit-salesperson-select') as HTMLSelectElement).value;
                                        updateQuoteField(activeQuote.id, { salesperson: seller });
                                        setActiveModal(null);
                                        showNotification('Vendedor reatribuído!', 'success');
                                    }}
                                    className="bg-[#0F3F5C] text-white font-extrabold py-1.5 px-4 rounded-lg text-xs"
                                >
                                    Confirmar
                                </button>
                            </div>
                        </div>
                    )}

                    {/* MODAL: Editar Lembretes */}
                    {activeModal.type === 'notes' && (
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[80vh]">
                            <div className="bg-[#0F3F5C] p-4 text-white flex justify-between items-center shrink-0">
                                <h3 className="font-bold text-lg">📌 Notas e Lembretes - Orçamento {activeQuote.id}</h3>
                                <button onClick={() => setActiveModal(null)} className="text-white text-xl font-bold">&times;</button>
                            </div>
                            <div className="p-6 flex-grow overflow-y-auto space-y-4">
                                <div className="space-y-2">
                                    {activeQuote.notes.length === 0 ? (
                                        <p className="text-xs text-slate-400 italic text-center py-4">Nenhum lembrete cadastrado para este orçamento.</p>
                                    ) : (
                                        activeQuote.notes.map((note, idx) => (
                                            <div key={idx} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-xs font-semibold text-slate-700">
                                                <span>{note}</span>
                                                <button 
                                                    onClick={() => {
                                                        const updatedList = activeQuote.notes.filter((_, i) => i !== idx);
                                                        updateQuoteField(activeQuote.id, { notes: updatedList });
                                                    }}
                                                    className="text-red-500 hover:text-red-700 transition"
                                                >
                                                    Excluir
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                                <div className="border-t pt-4">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Novo Lembrete</label>
                                    <div className="flex gap-2">
                                        <input 
                                            type="text" 
                                            placeholder="Digitar nova observação..." 
                                            id="new-note-input"
                                            className="flex-grow p-2 text-xs border rounded-lg focus:outline-none"
                                        />
                                        <button 
                                            onClick={() => {
                                                const inp = document.getElementById('new-note-input') as HTMLInputElement;
                                                const val = inp.value.trim();
                                                if (val) {
                                                    updateQuoteField(activeQuote.id, { notes: [...activeQuote.notes, val] });
                                                    inp.value = '';
                                                    showNotification('Lembrete adicionado!', 'success');
                                                }
                                            }}
                                            className="bg-[#0F3F5C] hover:bg-[#0A2A3D] text-white font-bold px-3 py-2 rounded-lg text-xs"
                                        >
                                            Adicionar
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="p-4 bg-slate-50 border-t flex justify-end shrink-0">
                                <button onClick={() => setActiveModal(null)} className="bg-[#0F3F5C] text-white font-bold py-2 px-5 rounded-xl text-xs">Fechar</button>
                            </div>
                        </div>
                    )}

                    {/* MODAL: Editar Produtos (Calcula preço pelo sistema) */}
                    {activeModal.type === 'products' && (
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
                            <div className="bg-[#0F3F5C] p-4 text-white flex justify-between items-center shrink-0">
                                <h3 className="font-bold text-lg">🛠️ Itens de Aço do Orçamento {activeQuote.id}</h3>
                                <button onClick={() => setActiveModal(null)} className="text-white text-xl font-bold">&times;</button>
                            </div>
                            <div className="p-6 flex-grow overflow-y-auto space-y-6">
                                {/* Table of existing items */}
                                <div>
                                    <h4 className="text-xs font-black text-slate-400 uppercase mb-2">Produtos no Orçamento</h4>
                                    <div className="border border-slate-100 rounded-xl overflow-hidden shadow-inner bg-slate-50/50">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-slate-100 text-slate-700">
                                                <tr>
                                                    <th className="p-2.5 font-bold uppercase">Descrição</th>
                                                    <th className="p-2.5 text-center font-bold uppercase w-16">Qtd</th>
                                                    <th className="p-2.5 text-center font-bold uppercase w-20">Tamanho</th>
                                                    <th className="p-2.5 text-center font-bold uppercase w-20">Conversão</th>
                                                    <th className="p-2.5 text-center font-bold uppercase w-24">Peso (kg)</th>
                                                    <th className="p-2.5 text-center font-bold uppercase w-28">Preço (R$)</th>
                                                    <th className="p-2.5 text-center w-12"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {activeQuote.products.map((item, idx) => (
                                                    <tr key={item.id} className="border-b bg-white text-slate-700">
                                                        <td className="p-2.5 font-bold">{item.description}</td>
                                                        <td className="p-2.5 text-center font-extrabold">{item.qty}</td>
                                                        <td className="p-2.5 text-center font-mono">{item.length.toFixed(2)}m</td>
                                                        <td className="p-2.5 text-center font-mono text-slate-400">{item.weightPerMeter.toFixed(3)} kg/m</td>
                                                        <td className="p-2.5 text-center font-black text-slate-900">{item.weight.toFixed(2)}</td>
                                                        <td className="p-2.5 text-center font-black text-indigo-700">R$ {item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                                        <td className="p-2.5 text-center">
                                                            <button 
                                                                onClick={() => {
                                                                    const updated = activeQuote.products.filter((_, i) => i !== idx);
                                                                    handleProductSave(activeQuote.id, updated);
                                                                }}
                                                                className="text-red-500 hover:text-red-700 p-1 font-bold"
                                                            >
                                                                &times;
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {activeQuote.products.length === 0 && (
                                                    <tr>
                                                        <td colSpan={7} className="p-6 text-center text-slate-400 italic">Nenhum produto cadastrado para este orçamento.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="flex justify-between items-center text-xs font-black text-slate-900 mt-2 px-2">
                                        <span>TOTAL KG: {activeQuote.products.reduce((acc, i) => acc + i.weight, 0).toFixed(2)} kg</span>
                                        <span className="text-indigo-800">PREÇO TOTAL: R$ {activeQuote.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                </div>

                                {/* Form to add new product */}
                                <div className="border-t pt-4">
                                    <h4 className="text-xs font-black text-slate-400 uppercase mb-3">Adicionar Novo Produto (Calculado por KG)</h4>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                        <div className="col-span-2 sm:col-span-2">
                                            <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Item de Aço</label>
                                            <select 
                                                id="prod-type-select"
                                                className="w-full p-2 border rounded-lg text-xs font-semibold bg-white"
                                            >
                                                <option value="Coluna Pronta CA50 10.00mm,0.617">Coluna Pronta CA50 10,00mm (0.617 kg/m)</option>
                                                <option value="Viga Pronta CA60 6.30mm,0.245">Viga Pronta CA60 6,30mm (0.245 kg/m)</option>
                                                <option value="Estribo Pronto CA60 5.00mm,0.154">Estribo Pronto CA60 5,00mm (0.154 kg/m)</option>
                                                <option value="Barra Cortada CA50 12.50mm,0.963">Barra Cortada CA50 12,50mm (0.963 kg/m)</option>
                                                <option value="Rolo CA50 8.00mm,0.395">Rolo CA50 8,00mm (0.395 kg/m)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Quantidade</label>
                                            <input 
                                                type="number" 
                                                defaultValue={10} 
                                                id="prod-qty-input"
                                                className="w-full p-2 border rounded-lg text-xs font-mono text-center font-bold" 
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Comprimento (m)</label>
                                            <input 
                                                type="number" 
                                                step="0.1"
                                                defaultValue={6.0} 
                                                id="prod-len-input"
                                                className="w-full p-2 border rounded-lg text-xs font-mono text-center font-bold" 
                                            />
                                        </div>
                                    </div>
                                    <div className="flex justify-end mt-3">
                                        <button 
                                            onClick={() => {
                                                const typeSelect = document.getElementById('prod-type-select') as HTMLSelectElement;
                                                const qtyInp = document.getElementById('prod-qty-input') as HTMLInputElement;
                                                const lenInp = document.getElementById('prod-len-input') as HTMLInputElement;
                                                
                                                const [desc, factorStr] = typeSelect.value.split(',');
                                                const qty = parseInt(qtyInp.value) || 0;
                                                const len = parseFloat(lenInp.value) || 0;
                                                const factor = parseFloat(factorStr) || 0;

                                                if (qty <= 0 || len <= 0) {
                                                    showNotification('Insira quantidade e comprimento válidos.', 'warning');
                                                    return;
                                                }

                                                const calculatedWeight = qty * len * factor;
                                                const calculatedPrice = calculatedWeight * STEEL_PRICE_FACTOR;

                                                const newProduct: ProductItem = {
                                                    id: String(Date.now()),
                                                    description: desc,
                                                    qty: qty,
                                                    length: len,
                                                    weightPerMeter: factor,
                                                    weight: parseFloat(calculatedWeight.toFixed(2)),
                                                    price: parseFloat(calculatedPrice.toFixed(2))
                                                };

                                                handleProductSave(activeQuote.id, [...activeQuote.products, newProduct]);
                                            }}
                                            className="bg-[#0F3F5C] hover:bg-[#0A2A3D] text-white font-extrabold py-2 px-5 rounded-xl text-xs uppercase"
                                        >
                                            Adicionar Item
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="p-4 bg-slate-50 border-t flex justify-end shrink-0">
                                <button onClick={() => setActiveModal(null)} className="bg-slate-200 text-slate-700 font-bold py-2 px-5 rounded-xl text-xs uppercase">Fechar</button>
                            </div>
                        </div>
                    )}

                    {/* MODAL: Editar Preço */}
                    {activeModal.type === 'price' && (
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                            <div className="bg-[#0F3F5C] p-4 text-white flex justify-between items-center">
                                <h3 className="font-bold text-md">💰 Ajustar Preço Manual</h3>
                                <button onClick={() => setActiveModal(null)} className="text-white text-xl font-bold">&times;</button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="bg-slate-50 p-3 rounded-lg border text-xs font-semibold text-slate-600">
                                    Preço atual calculado por KG de Aço: <span className="font-black text-slate-900 block mt-1">R$ {activeQuote.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Novo Preço customizado (R$)</label>
                                    <input 
                                        type="number" 
                                        defaultValue={activeQuote.price} 
                                        id="edit-price-input"
                                        className="w-full p-2.5 border rounded-xl text-sm font-bold" 
                                    />
                                </div>
                            </div>
                            <div className="p-4 bg-slate-50 border-t flex justify-end gap-2">
                                <button onClick={() => setActiveModal(null)} className="bg-slate-200 text-slate-600 font-bold py-1.5 px-3 rounded-lg text-xs">Cancelar</button>
                                <button 
                                    onClick={() => {
                                        const newPrice = parseFloat((document.getElementById('edit-price-input') as HTMLInputElement).value) || 0;
                                        updateQuoteField(activeQuote.id, { price: newPrice });
                                        setActiveModal(null);
                                        showNotification('Preço atualizado com sucesso!', 'success');
                                    }}
                                    className="bg-[#0F3F5C] text-white font-extrabold py-1.5 px-4 rounded-lg text-xs"
                                >
                                    Confirmar
                                </button>
                            </div>
                        </div>
                    )}

                    {/* MODAL: Duplicar Orçamento */}
                    {activeModal.type === 'duplicate' && (
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                            <div className="bg-[#0F3F5C] p-4 text-white flex justify-between items-center">
                                <h3 className="font-bold text-md">📋 Duplicar Orçamento</h3>
                                <button onClick={() => setActiveModal(null)} className="text-white text-xl font-bold">&times;</button>
                            </div>
                            <div className="p-6 space-y-4">
                                <p className="text-xs text-slate-500 font-semibold">Cria uma cópia idêntica deste orçamento sob um novo número identificador.</p>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Novo Número do Orçamento</label>
                                    <input 
                                        type="text" 
                                        defaultValue={String(parseInt(activeQuote.id) + 1)} 
                                        id="duplicate-id-input"
                                        className="w-full p-2.5 border rounded-xl text-sm font-mono text-center font-bold" 
                                    />
                                </div>
                            </div>
                            <div className="p-4 bg-slate-50 border-t flex justify-end gap-2">
                                <button onClick={() => setActiveModal(null)} className="bg-slate-200 text-slate-600 font-bold py-1.5 px-3 rounded-lg text-xs">Cancelar</button>
                                <button 
                                    onClick={() => {
                                        const nid = (document.getElementById('duplicate-id-input') as HTMLInputElement).value.trim();
                                        if (nid) {
                                            handleDuplicate(activeQuote.id, nid);
                                        }
                                    }}
                                    className="bg-[#0F3F5C] text-white font-extrabold py-1.5 px-4 rounded-lg text-xs"
                                >
                                    Duplicar
                                </button>
                            </div>
                        </div>
                    )}

                    {/* MODAL: Imprimir (Orçamento, Completo, Resumo do Aço) */}
                    {(activeModal.type === 'print' || activeModal.type === 'printFull' || activeModal.type === 'printSteel') && (
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
                            <div className="bg-[#0F3F5C] p-4 text-white flex justify-between items-center shrink-0 no-print">
                                <h3 className="font-bold text-md">
                                    {activeModal.type === 'print' && '🖨️ Visualização de Impressão (Orçamento)'}
                                    {activeModal.type === 'printFull' && '🖨️ Visualização de Impressão (Completo)'}
                                    {activeModal.type === 'printSteel' && '🖨️ Visualização de Impressão (Resumo do Aço)'}
                                </h3>
                                <button onClick={() => setActiveModal(null)} className="text-white text-xl font-bold">&times;</button>
                            </div>
                            
                            {/* Printable Content Area */}
                            <div className="p-8 bg-white text-slate-800 flex-grow overflow-y-auto font-sans text-xs space-y-6" id="printable-quote-content">
                                <div className="border-b pb-4 flex justify-between items-start">
                                    <div>
                                        <h1 className="text-lg font-black text-slate-900 uppercase">MSM SISTEMAS DE GESTÃO</h1>
                                        <p className="text-[10px] text-slate-400 font-bold">CNPJ: 00.000.000/0001-00 • Fone: (15) 3271-0000</p>
                                    </div>
                                    <div className="text-right">
                                        <h2 className="text-md font-black text-slate-900 uppercase">ORÇAMENTO Nº {activeQuote.id}</h2>
                                        <p className="text-[10px] text-slate-500 font-bold">Data: {activeQuote.date} • Previsão: {activeQuote.forecastDate}</p>
                                    </div>
                                </div>

                                <div className="bg-slate-50 p-4 rounded-xl border grid grid-cols-2 gap-4">
                                    <div>
                                        <span className="block text-[9px] font-black text-slate-400 uppercase">Cliente</span>
                                        <span className="font-extrabold text-slate-900">({activeQuote.clientCode}) {activeQuote.clientName}</span>
                                        <span className="block text-[10px] text-slate-500 mt-0.5">{activeQuote.clientCity}</span>
                                    </div>
                                    <div>
                                        <span className="block text-[9px] font-black text-slate-400 uppercase">Vendedor responsável</span>
                                        <span className="font-extrabold text-slate-900">{activeQuote.salesperson}</span>
                                        <span className="block text-[10px] text-slate-500 mt-0.5">Ferragem: {activeQuote.hardwareType || 'NÃO'}</span>
                                    </div>
                                </div>

                                {activeModal.type !== 'printSteel' ? (
                                    <div>
                                        <h3 className="font-black text-slate-900 uppercase mb-2 border-b pb-1">Itens do Orçamento</h3>
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr className="border-b-2 text-[10px] font-bold text-slate-400 uppercase">
                                                    <th className="py-2">Descrição do Produto</th>
                                                    <th className="py-2 text-center w-16">Qtd</th>
                                                    <th className="py-2 text-center w-20">Compr.</th>
                                                    <th className="py-2 text-center w-24">Peso (kg)</th>
                                                    {activeModal.type === 'printFull' && <th className="py-2 text-center w-24">KG/M</th>}
                                                    <th className="py-2 text-right w-28">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {activeQuote.products.map(item => (
                                                    <tr key={item.id} className="border-b">
                                                        <td className="py-2.5 font-bold text-slate-800">{item.description}</td>
                                                        <td className="py-2.5 text-center font-extrabold">{item.qty}</td>
                                                        <td className="py-2.5 text-center font-mono">{item.length.toFixed(2)}m</td>
                                                        <td className="py-2.5 text-center font-mono">{item.weight.toFixed(2)}</td>
                                                        {activeModal.type === 'printFull' && <td className="py-2.5 text-center font-mono">{item.weightPerMeter.toFixed(3)}</td>}
                                                        <td className="py-2.5 text-right font-black text-slate-900">R$ {item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                                    </tr>
                                                ))}
                                                {activeQuote.products.length === 0 && (
                                                    <tr>
                                                        <td colSpan={activeModal.type === 'printFull' ? 6 : 5} className="py-6 text-center text-slate-400 italic">Sem produtos vinculados.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div>
                                        <h3 className="font-black text-slate-900 uppercase mb-2 border-b pb-1">Resumo Consumo do Aço (KG)</h3>
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr className="border-b-2 text-[10px] font-bold text-slate-400 uppercase">
                                                    <th className="py-2">Tipo de Aço / Bitola</th>
                                                    <th className="py-2 text-center w-32">Conversão</th>
                                                    <th className="py-2 text-right w-36">Peso Total (kg)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {/* Group by gauge weight to show steel total */}
                                                {Object.entries(
                                                    activeQuote.products.reduce((groups, item) => {
                                                        const key = item.description.match(/\d+[\d,.]*\s*mm/)?.[0] || 'Outros';
                                                        if (!groups[key]) groups[key] = { weight: 0, factor: item.weightPerMeter };
                                                        groups[key].weight += item.weight;
                                                        return groups;
                                                    }, {} as Record<string, { weight: number; factor: number }>)
                                                ).map(([gauge, dataVal]) => {
                                                    const data = dataVal as { weight: number; factor: number };
                                                    return (
                                                        <tr key={gauge} className="border-b font-semibold">
                                                            <td className="py-2.5 font-bold">{gauge}</td>
                                                            <td className="py-2.5 text-center font-mono">{data.factor.toFixed(3)} kg/m</td>
                                                            <td className="py-2.5 text-right font-black text-slate-900">{data.weight.toFixed(2)} kg</td>
                                                        </tr>
                                                    );
                                                })}
                                                {activeQuote.products.length === 0 && (
                                                    <tr>
                                                        <td colSpan={3} className="py-6 text-center text-slate-400 italic">Nenhum dado de aço disponível.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                <div className="pt-4 border-t flex flex-col items-end space-y-1">
                                    <span className="text-[10px] font-bold text-slate-500">Valor total calculado: R$ {activeQuote.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    <span className="text-md font-black text-slate-900">Preço Final do Sistema: R$ {activeQuote.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    <span className="text-[9px] text-slate-400 italic font-bold">Impressão gerada em {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</span>
                                </div>
                            </div>

                            <div className="p-4 bg-slate-50 border-t flex justify-end gap-3 shrink-0 no-print">
                                <button onClick={() => setActiveModal(null)} className="bg-slate-200 text-slate-600 font-bold py-2 px-5 rounded-xl text-xs uppercase">Fechar</button>
                                <button 
                                    onClick={() => {
                                        window.print();
                                        showNotification('Documento enviado para fila de impressão!', 'success');
                                    }}
                                    className="bg-sky-600 hover:bg-sky-700 text-white font-extrabold py-2 px-6 rounded-xl text-xs uppercase"
                                >
                                    Imprimir Relatório
                                </button>
                            </div>
                        </div>
                    )}

                    {/* MODAL: Histórico */}
                    {activeModal.type === 'history' && (
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[80vh]">
                            <div className="bg-[#0F3F5C] p-4 text-white flex justify-between items-center shrink-0">
                                <h3 className="font-bold text-lg">📜 Log de Eventos: Orçamento {activeQuote.id}</h3>
                                <button onClick={() => setActiveModal(null)} className="text-white text-xl font-bold">&times;</button>
                            </div>
                            <div className="p-6 flex-grow overflow-y-auto space-y-3">
                                {activeQuote.history && activeQuote.history.length > 0 ? (
                                    activeQuote.history.map((h, index) => (
                                        <div key={index} className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex flex-col gap-1 text-xs">
                                            <div className="flex justify-between items-center font-bold text-slate-700">
                                                <span className="text-sky-600">{h.action}</span>
                                                <span className="text-slate-400 font-mono">{h.date}</span>
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-500 uppercase">Efetuado por: {h.user}</span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-xs text-slate-400 italic text-center py-4">Nenhum evento registrado.</p>
                                )}
                            </div>
                            <div className="p-4 bg-slate-50 border-t flex justify-end shrink-0">
                                <button onClick={() => setActiveModal(null)} className="bg-slate-200 text-slate-700 font-bold py-2 px-5 rounded-xl text-xs uppercase">Fechar</button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default PointingSystem;
