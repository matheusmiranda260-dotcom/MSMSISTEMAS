import React, { useState, useMemo, useEffect } from 'react';
import type { Page, User } from '../types';
import { 
    PencilIcon, TrashIcon, ArrowLeftIcon 
} from './icons';

interface FerroItem {
    id: string;
    nomeElemento: string;
    qtde: number;
    bitola: string;
    bitolaKgm: number;
    pontaEsquerdo: string;
    pontaDireito: string;
    ladoA: string;
    ladoB: string;
    ladoC: string;
    ladoD: string;
    ladoE: string;
    obs: string;
}

interface ProductItem {
    id: string;
    description: string;
    qty: number;
    length: number;
    weightPerMeter: number;
    weight: number;
    price: number;
    ferros?: FerroItem[];
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
    ddd?: string;
    phone?: string;
    email?: string;
    dischargeByClient?: string;
}

interface ClientLookup {
    code: string;
    name: string;
    city: string;
    address: string;
}

const MOCK_CLIENTS: ClientLookup[] = [
    { code: '17406', name: 'CONSUMIDOR BALCAO', city: 'ITAPETININGA-SP', address: 'END. CADASTRO: , SN - , - ITAPETININGA - SP' },
    { code: '165762', name: 'VITAL SOUZA SANTOS', city: 'TATUI-SP', address: 'END. CADASTRO: RUA ONZE, 120 - TATUI - SP' },
    { code: '21312', name: 'JOSE APARECIDO RODRIGUES', city: 'ITAPETININGA-SP', address: 'END. CADASTRO: AV PRINCIPAL, 450 - ITAPETININGA - SP' },
    { code: '54555', name: 'LUCIANA PAULA DE ALMEIDA CIANFLONE', city: 'ITAPETININGA-SP', address: 'END. CADASTRO: RUA DAS FLORES, 78 - ITAPETININGA - SP' }
];

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
        type: 'client' | 'salesperson' | 'notes' | 'products' | 'price' | 'duplicate' | 'print' | 'printFull' | 'printSteel' | 'history' | 'delete';
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

    // Form wizard states for New Quote
    const [addStep, setAddStep] = useState(1);
    const [searchType, setSearchType] = useState<'code' | 'name'>('code');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedClient, setSelectedClient] = useState<ClientLookup | null>(null);

    const [newId, setNewId] = useState('');
    const [newDate, setNewDate] = useState('');
    const [newDdd, setNewDdd] = useState('');
    const [newPhone, setNewPhone] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newClientName, setNewClientName] = useState('');
    const [newDischarge, setNewDischarge] = useState('');
    
    const [newHardwareType, setNewHardwareType] = useState('FERRAGEM');
    const [newForecast, setNewForecast] = useState('');

    // Edit Products Modal local states
    const [tempProducts, setTempProducts] = useState<ProductItem[]>([]);
    const [activeCategory, setActiveCategory] = useState<string | null>(null);

    const [selectedSteelSpec, setSelectedSteelSpec] = useState('CA50 10.00mm,0.617');
    const [qtyInput, setQtyInput] = useState(10);
    const [lenInput, setLenInput] = useState(6.0);
    const [dobraQty, setDobraQty] = useState(10);
    const [dobraPrice, setDobraPrice] = useState(1.50);
    const [weightInput, setWeightInput] = useState(100.0);
    const [pricePerKg, setPricePerKg] = useState(8.50);
    const [freightPrice, setFreightPrice] = useState(150.0);
    const [freightObs, setFreightObs] = useState('');

    // Coluna sub-modal states
    const [showColunaModal, setShowColunaModal] = useState(false);
    const [colunaName, setColunaName] = useState('');
    const [colunaQtde, setColunaQtde] = useState('');
    const [colunaTipoAmarracao, setColunaTipoAmarracao] = useState<'AMARRADA' | 'SOLDADA'>('AMARRADA');
    const [colunaQtdeLados, setColunaQtdeLados] = useState('4 LADOS');
    const [colunaAreaSemEstr1, setColunaAreaSemEstr1] = useState('');
    const [colunaAreaSemEstr2, setColunaAreaSemEstr2] = useState('');
    const [colunaObs, setColunaObs] = useState('');

    // Ferros Principais sub-modal states
    const [showFerrosModal, setShowFerrosModal] = useState(false);
    const [ferroTargetProdIdx, setFerroTargetProdIdx] = useState(-1);
    const [ferroTargetColunaNome, setFerroTargetColunaNome] = useState('');
    const [ferroNomeElemento, setFerroNomeElemento] = useState('');
    const [ferroQtde, setFerroQtde] = useState('');
    const [ferroBitola, setFerroBitola] = useState('');
    const [ferroPontaEsq, setFerroPontaEsq] = useState('');
    const [ferroPontaDir, setFerroPontaDir] = useState('');
    const [ferroLadoA, setFerroLadoA] = useState('');
    const [ferroLadoB, setFerroLadoB] = useState('');
    const [ferroLadoC, setFerroLadoC] = useState('');
    const [ferroLadoD, setFerroLadoD] = useState('');
    const [ferroLadoE, setFerroLadoE] = useState('');
    const [ferroObs, setFerroObs] = useState('');

    const BITOLA_OPTIONS = [
        { label: '3/8" - 10.0 mm', kgm: 0.617 },
        { label: '1/2" - 12.5 mm', kgm: 0.963 },
        { label: '5/8" - 16.0 mm', kgm: 1.578 },
        { label: '3/4" - 19.0 mm', kgm: 2.234 },
        { label: '7/8" - 22.2 mm', kgm: 3.045 },
        { label: '1" - 25.4 mm',   kgm: 3.984 },
        { label: 'CA60 5.0 mm',    kgm: 0.154 },
        { label: 'CA60 6.3 mm',    kgm: 0.245 },
        { label: 'CA60 8.0 mm',    kgm: 0.395 },
        { label: 'CA50 10.0 mm',   kgm: 0.617 },
        { label: 'CA50 12.5 mm',   kgm: 0.963 },
        { label: 'CA50 16.0 mm',   kgm: 1.578 },
        { label: 'CA50 20.0 mm',   kgm: 2.466 },
        { label: 'CA50 25.0 mm',   kgm: 3.853 },
    ];

    const PONTA_OPTIONS = ['SEM PONTA', 'AFUNILADO', 'NEGATIVADA PARA DENTRO', 'NEGATIVADA PARA FORA', 'GANCHO PARA DENTRO', 'GANCHO PARA FORA'];

    // Helper: render the bar shape SVG based on ponta selections
    const renderBarDiagramSVG = (
        pontaEsq: string, pontaDir: string,
        ladoA: string, ladoB: string, ladoD: string,
        small = false
    ) => {
        const W = small ? 120 : 200;
        const H = small ? 70 : 140;
        const mainY = small ? 45 : 90;
        const topY  = small ? 8 :  22;
        const botY  = small ? 65 : 130;
        const lX    = small ? 20 : 30;
        const rX    = small ? 100 : 170;
        const hook  = small ? 10 : 18;
        const fs    = small ? 9 : 12;
        const fsDim = small ? 8 : 10;
        const midY  = (mainY + topY) / 2;
        const midYb = (mainY + botY) / 2;

        const leftUp   = ['NEGATIVADA PARA DENTRO','GANCHO PARA DENTRO'].includes(pontaEsq);
        const leftDown = ['NEGATIVADA PARA FORA','GANCHO PARA FORA'].includes(pontaEsq);
        const rightUp  = ['NEGATIVADA PARA DENTRO','GANCHO PARA DENTRO'].includes(pontaDir);
        const rightDown= ['NEGATIVADA PARA FORA','GANCHO PARA FORA'].includes(pontaDir);
        const leftAful = pontaEsq === 'AFUNILADO';
        const rightAful= pontaDir === 'AFUNILADO';

        return (
            <svg viewBox={`0 0 ${W} ${H}`} className={small ? 'w-28 h-16' : 'w-44 h-32'} xmlns="http://www.w3.org/2000/svg">
                {/* Main bar */}
                <line x1={lX} y1={mainY} x2={rX} y2={mainY} stroke="#333" strokeWidth="2.5"/>
                {/* A label below */}
                <text x={(lX+rX)/2} y={mainY + fs + 4} textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#444">A</text>
                {ladoA && <text x={(lX+rX)/2} y={mainY + fs*2 + 5} textAnchor="middle" fontSize={fsDim} fill="#777">{ladoA}</text>}

                {/* LEFT arm - goes UP (PARA DENTRO) */}
                {leftUp && <>
                    <line x1={lX} y1={mainY} x2={lX} y2={topY} stroke="#333" strokeWidth="2.5"/>
                    {pontaEsq === 'GANCHO PARA DENTRO' && <line x1={lX} y1={topY} x2={lX+hook} y2={topY} stroke="#333" strokeWidth="2.5"/>}
                    {!small && <text x={lX-14} y={midY+fs/2} textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#444">D</text>}
                    {ladoD && <text x={lX-14} y={midY + fs + 4} textAnchor="middle" fontSize={fsDim} fill="#777">{ladoD}</text>}
                </>}

                {/* LEFT arm - goes DOWN (PARA FORA) */}
                {leftDown && <>
                    <line x1={lX} y1={mainY} x2={lX} y2={botY} stroke="#333" strokeWidth="2.5"/>
                    {pontaEsq === 'GANCHO PARA FORA' && <line x1={lX} y1={botY} x2={lX+hook} y2={botY} stroke="#333" strokeWidth="2.5"/>}
                    {!small && <text x={lX-14} y={midYb+fs/2} textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#444">D</text>}
                    {ladoD && <text x={lX-14} y={midYb + fs + 4} textAnchor="middle" fontSize={fsDim} fill="#777">{ladoD}</text>}
                </>}

                {/* LEFT - AFUNILADO */}
                {leftAful && <>
                    <line x1={lX} y1={mainY} x2={lX-12} y2={mainY-20} stroke="#333" strokeWidth="2"/>
                    {!small && <text x={lX-20} y={mainY-8} textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#444">D</text>}
                </>}

                {/* RIGHT arm - goes UP (PARA DENTRO) */}
                {rightUp && <>
                    <line x1={rX} y1={mainY} x2={rX} y2={topY} stroke="#333" strokeWidth="2.5"/>
                    {pontaDir === 'GANCHO PARA DENTRO' && <line x1={rX} y1={topY} x2={rX-hook} y2={topY} stroke="#333" strokeWidth="2.5"/>}
                    {!small && <text x={rX+14} y={midY+fs/2} textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#444">B</text>}
                    {ladoB && <text x={rX+14} y={midY + fs + 4} textAnchor="middle" fontSize={fsDim} fill="#777">{ladoB}</text>}
                </>}

                {/* RIGHT arm - goes DOWN (PARA FORA) */}
                {rightDown && <>
                    <line x1={rX} y1={mainY} x2={rX} y2={botY} stroke="#333" strokeWidth="2.5"/>
                    {pontaDir === 'GANCHO PARA FORA' && <line x1={rX} y1={botY} x2={rX-hook} y2={botY} stroke="#333" strokeWidth="2.5"/>}
                    {!small && <text x={rX+14} y={midYb+fs/2} textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#444">B</text>}
                    {ladoB && <text x={rX+14} y={midYb + fs + 4} textAnchor="middle" fontSize={fsDim} fill="#777">{ladoB}</text>}
                </>}

                {/* RIGHT - AFUNILADO */}
                {rightAful && <>
                    <line x1={rX} y1={mainY} x2={rX+12} y2={mainY-20} stroke="#333" strokeWidth="2"/>
                    {!small && <text x={rX+20} y={mainY-8} textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#444">B</text>}
                </>}
            </svg>
        );
    };

    // Helper: get ponta description text for table
    const getPontaText = (esq: string, dir: string) => {
        if (esq === 'SEM PONTA' && dir === 'SEM PONTA') return 'SEM PONTAS';
        if (esq === dir) return `${esq.replace('PARA ', 'P/ ')} AMBOS LADOS`;
        return `ESQ: ${esq.replace('PARA ', 'P/ ')} / DIR: ${dir.replace('PARA ', 'P/ ')}`;
    };

    // Product list sort state
    const [productSortBy, setProductSortBy] = useState<'date' | 'type' | 'name'>('date');
    const [openDropdownIdx, setOpenDropdownIdx] = useState<number | null>(null);

    const STEEL_SPECS = [
        { label: 'CA50 10.00mm (0.617 kg/m)', factor: 0.617, spec: 'CA50 10.00mm' },
        { label: 'CA50 8.00mm (0.395 kg/m)', factor: 0.395, spec: 'CA50 8.00mm' },
        { label: 'CA50 12.50mm (0.963 kg/m)', factor: 0.963, spec: 'CA50 12.50mm' },
        { label: 'CA50 16.00mm (1.578 kg/m)', factor: 1.578, spec: 'CA50 16.00mm' },
        { label: 'CA60 5.00mm (0.154 kg/m)', factor: 0.154, spec: 'CA60 5.00mm' },
        { label: 'CA60 6.30mm (0.245 kg/m)', factor: 0.245, spec: 'CA60 6.30mm' },
        { label: 'CA60 4.20mm (0.109 kg/m)', factor: 0.109, spec: 'CA60 4.20mm' },
    ];

    useEffect(() => {
        if (activeModal && activeModal.type === 'products' && activeQuote) {
            setTempProducts(activeQuote.products || []);
            setActiveCategory(null);
        }
    }, [activeModal, activeQuote]);

    const handleAddTempProduct = () => {
        if (!activeCategory) return;

        let description = '';
        let qty = 1;
        let length = 0;
        let factor = 0;
        let weight = 0;
        let price = 0;

        if (activeCategory === 'Frete') {
            if (freightPrice <= 0) {
                showNotification('Insira um valor de frete válido.', 'warning');
                return;
            }
            description = `Frete${freightObs.trim() ? ` (${freightObs.trim()})` : ''}`;
            qty = 1;
            length = 0;
            factor = 0;
            weight = 0;
            price = freightPrice;
        } else if (activeCategory === 'Dobra') {
            if (dobraQty <= 0 || dobraPrice <= 0) {
                showNotification('Insira quantidade e preço de dobras válidos.', 'warning');
                return;
            }
            description = `Dobra de Bitola (${dobraQty} un x R$ ${dobraPrice.toFixed(2)})`;
            qty = dobraQty;
            length = 0;
            factor = 0;
            weight = 0;
            price = dobraQty * dobraPrice;
        } else if (activeCategory === 'Corte Dobra (PESO)') {
            if (weightInput <= 0 || pricePerKg <= 0) {
                showNotification('Insira peso e preço por KG válidos.', 'warning');
                return;
            }
            description = `Corte e Dobra (PESO) (${weightInput.toFixed(2)} kg x R$ ${pricePerKg.toFixed(2)}/kg)`;
            qty = 1;
            length = 0;
            factor = 0;
            weight = weightInput;
            price = weightInput * pricePerKg;
        } else {
            const [spec, factorStr] = selectedSteelSpec.split(',');
            const currentFactor = parseFloat(factorStr) || 0;
            
            if (qtyInput <= 0 || lenInput <= 0) {
                showNotification('Insira quantidade e comprimento válidos.', 'warning');
                return;
            }

            description = `${activeCategory} ${spec}`;
            qty = qtyInput;
            length = lenInput;
            factor = currentFactor;
            weight = qtyInput * lenInput * currentFactor;
            price = weight * STEEL_PRICE_FACTOR;
        }

        const newProd: ProductItem = {
            id: String(Date.now() + Math.random()),
            description,
            qty,
            length: parseFloat(length.toFixed(2)),
            weightPerMeter: factor,
            weight: parseFloat(weight.toFixed(2)),
            price: parseFloat(price.toFixed(2))
        };

        setTempProducts(prev => [...prev, newProd]);
        setActiveCategory(null);
        showNotification('Produto adicionado ao orçamento!', 'success');
    };

    useEffect(() => {
        if (isAddOpen) {
            const maxId = Math.max(...quotes.map(q => parseInt(q.id) || 0));
            setNewId(String(maxId + 1));
            setAddStep(1);
            setSearchType('code');
            setSearchTerm('');
            setSelectedClient(null);
            
            const today = new Date();
            setNewDate(today.toISOString().split('T')[0]);
            setNewDdd('');
            setNewPhone('');
            setNewEmail('');
            setNewClientName('');
            setNewDischarge('');
            setNewHardwareType('FERRAGEM');
            
            const forecastDate = new Date();
            forecastDate.setDate(forecastDate.getDate() + 5);
            setNewForecast(forecastDate.toISOString().split('T')[0]);
        }
    }, [isAddOpen, quotes]);

    const matchedClients = useMemo(() => {
        const existingClients = quotes.map(q => ({
            code: q.clientCode,
            name: q.clientName,
            city: q.clientCity,
            address: `END. CADASTRO: , SN - , - ${q.clientCity}`
        }));
        
        const allClients = [...MOCK_CLIENTS];
        existingClients.forEach(ec => {
            if (!allClients.some(ac => ac.code === ec.code)) {
                allClients.push(ec);
            }
        });

        if (!searchTerm.trim()) {
            return [];
        }

        const term = searchTerm.toLowerCase().trim();
        return allClients.filter(c => {
            if (searchType === 'code') {
                return c.code.toLowerCase().includes(term);
            } else {
                return c.name.toLowerCase().includes(term);
            }
        });
    }, [searchTerm, searchType, quotes]);

    const handleCreateQuote = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!newDdd || !newPhone || !newClientName || !newDischarge) {
            showNotification('Preencha todos os campos obrigatórios.', 'warning');
            return;
        }

        if (quotes.some(q => q.id === newId)) {
            showNotification('Número de orçamento já cadastrado.', 'error');
            return;
        }

        const dateObj = new Date(newDate + 'T12:00:00');
        const formattedDate = `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth() + 1).toString().padStart(2, '0')}/${dateObj.getFullYear().toString().substring(2)}`;

        const clientObsParts = [];
        if (newDdd && newPhone) clientObsParts.push(`TEL: (${newDdd}) ${newPhone}`);
        if (newEmail) clientObsParts.push(`EMAIL: ${newEmail}`);
        if (newDischarge === 'Sim') clientObsParts.push('OBS: DESCARREGAMENTO POR CONTA DO CLIENTE');
        const finalObs = clientObsParts.join(' • ');

        const newQuote: Quote = {
            id: newId,
            date: formattedDate,
            salesperson: (currentUser?.username || 'GCRUZ').toUpperCase(),
            clientCode: selectedClient?.code || '17406',
            clientName: newClientName,
            clientCity: selectedClient?.city || 'ITAPETININGA-SP',
            clientObs: finalObs,
            price: 0.00,
            hardwareType: newHardwareType,
            forecastDate: newForecast ? newForecast.split('-').reverse().join('/').substring(0, 8) : formattedDate,
            status: 'Orçamento Vazio',
            products: [],
            notes: [],
            history: [{ date: new Date().toLocaleString('pt-BR'), action: 'Orçamento Criado', user: currentUser?.username || 'Sistema' }],
            ddd: newDdd,
            phone: newPhone,
            email: newEmail,
            dischargeByClient: newDischarge
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
                                            <option value="delete">🗑️ Excluir Orçamento</option>
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
                    <form onSubmit={handleCreateQuote} className={`bg-white rounded-2xl shadow-2xl w-full ${addStep === 1 ? 'max-w-md' : 'max-w-2xl'} overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]`}>
                        {/* Custom Gray Header styled like screens */}
                        <div className="bg-slate-200 py-3.5 px-5 border-b border-slate-300 flex justify-between items-center shrink-0">
                            <div className="flex-1 text-center font-display text-slate-800 text-lg font-bold tracking-tight">
                                Novo Orçamento
                            </div>
                            <button type="button" onClick={() => setIsAddOpen(false)} className="text-slate-500 hover:text-slate-800 text-2xl font-bold font-sans line-none">&times;</button>
                        </div>
                        
                        <div className="overflow-y-auto flex-grow">
                            {/* Step 1: Client Selection */}
                            {addStep === 1 && (
                                <div className="p-6 space-y-6">
                                    <div className="flex flex-col gap-4">
                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <input 
                                                type="radio" 
                                                name="searchType" 
                                                checked={searchType === 'code'} 
                                                onChange={() => { setSearchType('code'); setSearchTerm(''); setSelectedClient(null); }}
                                                className="w-5 h-5 text-sky-600 border-slate-300 focus:ring-sky-500 cursor-pointer"
                                            />
                                            <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900 transition-colors">
                                                Pesquisar por <strong className="text-sky-700 font-black">código</strong> do cliente
                                            </span>
                                        </label>
                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <input 
                                                type="radio" 
                                                name="searchType" 
                                                checked={searchType === 'name'} 
                                                onChange={() => { setSearchType('name'); setSearchTerm(''); setSelectedClient(null); }}
                                                className="w-5 h-5 text-sky-600 border-slate-300 focus:ring-sky-500 cursor-pointer"
                                            />
                                            <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900 transition-colors">
                                                Pesquisar por <strong className="text-sky-700 font-black">nome</strong> do cliente
                                            </span>
                                        </label>
                                    </div>

                                    {/* Search Input field */}
                                    <div className="relative">
                                        <input 
                                            type="text" 
                                            placeholder={searchType === 'code' ? "Digite o código do cliente (ex: 17406)..." : "Digite o nome do cliente (ex: CONSUMIDOR)..."}
                                            value={searchTerm}
                                            onChange={(e) => {
                                                setSearchTerm(e.target.value);
                                                setSelectedClient(null); // Reset selection if typing
                                            }}
                                            className="w-full p-3 border border-slate-300 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-sky-500 placeholder-slate-400" 
                                        />
                                        
                                        {/* Suggestions Dropdown */}
                                        {matchedClients.length > 0 && !selectedClient && (
                                            <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl z-50 mt-1 max-h-48 overflow-y-auto divide-y divide-slate-100">
                                                {matchedClients.map(c => (
                                                    <button
                                                        type="button"
                                                        key={c.code}
                                                        onClick={() => {
                                                            setSelectedClient(c);
                                                            setSearchTerm(searchType === 'code' ? c.code : c.name);
                                                            setNewClientName(c.name);
                                                        }}
                                                        className="w-full text-left p-3 hover:bg-sky-50 text-xs font-bold text-slate-700 flex justify-between items-center transition-colors"
                                                    >
                                                        <div>
                                                            <span className="text-sky-600 font-extrabold">[{c.code}]</span> {c.name}
                                                        </div>
                                                        <span className="text-[10px] text-slate-400 uppercase font-semibold">{c.city}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Selected Client Display Badge */}
                                    {selectedClient && (
                                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center justify-between animate-in fade-in duration-200">
                                            <div className="text-xs">
                                                <span className="block text-[9px] font-black text-emerald-600 uppercase tracking-wider">Cliente Selecionado</span>
                                                <strong className="text-slate-800 font-extrabold">({selectedClient.code}) {selectedClient.name}</strong>
                                                <span className="block text-[10px] text-slate-500 mt-0.5">{selectedClient.city}</span>
                                            </div>
                                            <button 
                                                type="button" 
                                                onClick={() => setSelectedClient(null)} 
                                                className="text-red-500 hover:text-red-700 font-black text-sm p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                Remover
                                            </button>
                                        </div>
                                    )}

                                    <hr className="border-slate-300" />
                                    <div className="text-slate-600 text-[11px] font-bold uppercase tracking-tight leading-relaxed">
                                        OBS: Cliente sem cadastro utilizar código <strong className="text-slate-800 font-black">17406</strong> (CONSUMIDOR)
                                    </div>
                                    <hr className="border-slate-300" />

                                    {/* Footer Buttons */}
                                    <div className="flex justify-start gap-3 pt-2">
                                        <button 
                                            type="button" 
                                            onClick={() => {
                                                // If search term matches a code exactly, lookup. If not select standard 17406
                                                let client = selectedClient;
                                                if (!client) {
                                                    const match = MOCK_CLIENTS.find(c => c.code === searchTerm.trim() || c.name.toLowerCase() === searchTerm.toLowerCase().trim());
                                                    if (match) {
                                                        client = match;
                                                    } else {
                                                        client = MOCK_CLIENTS.find(c => c.code === '17406') || MOCK_CLIENTS[0];
                                                    }
                                                }
                                                setSelectedClient(client);
                                                setNewClientName(client.name);
                                                setAddStep(2);
                                            }}
                                            className="bg-[#0F3F5C] hover:bg-[#0A2A3D] text-white font-extrabold py-2 px-6 rounded text-sm transition-all shadow-sm"
                                        >
                                            Continuar ...
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={() => setIsAddOpen(false)} 
                                            className="bg-slate-50 hover:bg-slate-100 border text-slate-700 font-bold py-2 px-5 rounded text-sm transition"
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Step 2: Form Details */}
                            {addStep === 2 && selectedClient && (
                                <div className="p-6 space-y-5">
                                    {/* Top client metadata card */}
                                    <div className="border border-slate-300 bg-slate-50/50 rounded-xl p-4 space-y-1">
                                        <h3 className="text-sm font-black text-sky-900 uppercase tracking-tight">
                                            {selectedClient.code} - {selectedClient.name}
                                        </h3>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                            {selectedClient.address}
                                        </p>
                                    </div>

                                    {/* Form grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {/* Data do Orçamento */}
                                        <div className="md:col-span-1">
                                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">
                                                Data do Orçamento:
                                            </label>
                                            <div className="flex items-stretch border border-emerald-300 bg-white rounded overflow-hidden shadow-sm">
                                                <div className="w-10 bg-emerald-100 text-emerald-700 border-r border-emerald-200 flex items-center justify-center font-black text-sm shrink-0">
                                                    ✓
                                                </div>
                                                <input 
                                                    type="date"
                                                    value={newDate}
                                                    onChange={(e) => setNewDate(e.target.value)}
                                                    className="w-full p-2.5 text-xs font-bold text-slate-800 outline-none bg-transparent"
                                                    required
                                                />
                                            </div>
                                        </div>

                                        {/* DDD */}
                                        <div className="md:col-span-1">
                                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">
                                                DDD:
                                            </label>
                                            <div className={`flex items-stretch border rounded overflow-hidden shadow-sm transition-all ${newDdd ? 'border-emerald-300 bg-emerald-50/10' : 'border-red-300 bg-red-50/20'}`}>
                                                <div className={`w-10 border-r flex items-center justify-center font-black text-xs shrink-0 transition-colors ${newDdd ? 'bg-emerald-100 border-emerald-200 text-emerald-700' : 'bg-red-100 border-red-200 text-red-700'}`}>
                                                    {newDdd ? '✓' : '✕'}
                                                </div>
                                                <input 
                                                    type="text"
                                                    maxLength={2}
                                                    placeholder="OBRIGATÓRIO"
                                                    value={newDdd}
                                                    onChange={(e) => setNewDdd(e.target.value.replace(/\D/g, ''))}
                                                    className={`w-full p-2 text-xs font-bold outline-none bg-transparent placeholder-red-400 ${newDdd ? 'text-slate-800' : 'text-red-700'}`}
                                                    required
                                                />
                                            </div>
                                        </div>

                                        {/* Telefone */}
                                        <div className="md:col-span-1">
                                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">
                                                Telefone:
                                            </label>
                                            <div className={`flex items-stretch border rounded overflow-hidden shadow-sm transition-all ${newPhone ? 'border-emerald-300 bg-emerald-50/10' : 'border-red-300 bg-red-50/20'}`}>
                                                <div className={`w-10 border-r flex items-center justify-center font-black text-xs shrink-0 transition-colors ${newPhone ? 'bg-emerald-100 border-emerald-200 text-emerald-700' : 'bg-red-100 border-red-200 text-red-700'}`}>
                                                    {newPhone ? '✓' : '✕'}
                                                </div>
                                                <input 
                                                    type="text"
                                                    placeholder="OBRIGATÓRIO"
                                                    value={newPhone}
                                                    onChange={(e) => setNewPhone(e.target.value.replace(/[^\d-]/g, ''))}
                                                    className={`w-full p-2 text-xs font-bold outline-none bg-transparent placeholder-red-400 ${newPhone ? 'text-slate-800' : 'text-red-700'}`}
                                                    required
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Email */}
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">
                                            Email:
                                        </label>
                                        <div className={`flex items-stretch border rounded overflow-hidden shadow-sm transition-all ${newEmail ? 'border-emerald-300 bg-emerald-50/10' : 'border-red-300 bg-red-50/20'}`}>
                                            <div className={`w-10 border-r flex items-center justify-center font-black text-xs shrink-0 transition-colors ${newEmail ? 'bg-emerald-100 border-emerald-200 text-emerald-700' : 'bg-red-100 border-red-200 text-red-700'}`}>
                                                {newEmail ? '✓' : '✕'}
                                            </div>
                                            <input 
                                                type="email"
                                                placeholder="OPCIONAL"
                                                value={newEmail}
                                                onChange={(e) => setNewEmail(e.target.value)}
                                                className={`w-full p-2 text-xs font-bold outline-none bg-transparent placeholder-red-400 ${newEmail ? 'text-slate-800' : 'text-red-700'}`}
                                            />
                                        </div>
                                    </div>

                                    {/* Nome do Cliente */}
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">
                                            Nome do Cliente
                                        </label>
                                        <div className={`flex items-stretch border rounded overflow-hidden shadow-sm transition-all ${newClientName ? 'border-emerald-300 bg-emerald-50/10' : 'border-red-300 bg-red-50/20'}`}>
                                            <div className={`w-10 border-r flex items-center justify-center font-black text-xs shrink-0 transition-colors ${newClientName ? 'bg-emerald-100 border-emerald-200 text-emerald-700' : 'bg-red-100 border-red-200 text-red-700'}`}>
                                                {newClientName ? '✓' : '✕'}
                                            </div>
                                            <textarea 
                                                rows={2}
                                                placeholder="OBRIGATÓRIO"
                                                value={newClientName}
                                                onChange={(e) => setNewClientName(e.target.value)}
                                                className={`w-full p-2 text-xs font-bold outline-none bg-transparent placeholder-red-400 resize-none ${newClientName ? 'text-slate-800' : 'text-red-700'}`}
                                                required
                                            />
                                        </div>
                                    </div>

                                    {/* Descarregamento */}
                                    <div>
                                        <div className="block text-[10.5px] font-extrabold text-slate-700 mb-1 border-b pb-0.5">
                                            Descarregamento por conta do cliente?
                                        </div>
                                        <div className={`flex items-stretch border rounded overflow-hidden shadow-sm transition-all ${newDischarge ? 'border-emerald-300 bg-emerald-50/10' : 'border-red-300 bg-red-50/20'}`}>
                                            <div className={`w-10 border-r flex items-center justify-center font-black text-xs shrink-0 transition-colors ${newDischarge ? 'bg-emerald-100 border-emerald-200 text-emerald-700' : 'bg-red-100 border-red-200 text-red-700'}`}>
                                                {newDischarge ? '✓' : '✕'}
                                            </div>
                                            <select
                                                value={newDischarge}
                                                onChange={(e) => setNewDischarge(e.target.value)}
                                                className={`w-full p-2 text-xs font-bold outline-none bg-transparent cursor-pointer ${newDischarge ? 'text-slate-800 font-bold' : 'text-red-700 font-bold'}`}
                                                required
                                            >
                                                <option value="" className="text-red-500 font-bold">SELECIONE UMA OPÇÃO</option>
                                                <option value="Sim" className="text-slate-800 font-semibold">Sim</option>
                                                <option value="Não" className="text-slate-800 font-semibold">Não</option>
                                            </select>
                                        </div>
                                        <p className="text-[10px] text-slate-400 font-semibold mt-1 leading-relaxed">
                                            Se o descarregamento for por conta do cliente, uma mensagem será impressa no orçamento explicando que ele será o responsável pelo descarregamento dos produtos no momento da entrega.
                                        </p>
                                    </div>

                                    {/* Additional configurations */}
                                    <div className="grid grid-cols-2 gap-4 border-t pt-4">
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Previsão de Término</label>
                                            <input 
                                                type="date" 
                                                value={newForecast} 
                                                onChange={(e) => setNewForecast(e.target.value)}
                                                className="w-full p-2.5 border border-slate-300 rounded text-xs font-bold bg-white" 
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Tipo de Ferragem</label>
                                            <select 
                                                value={newHardwareType} 
                                                onChange={(e) => setNewHardwareType(e.target.value)}
                                                className="w-full p-2.5 border border-slate-300 rounded text-xs font-bold bg-white cursor-pointer"
                                            >
                                                <option value="FERRAGEM">FERRAGEM</option>
                                                <option value="">Nenhum (Vazio)</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Footer Buttons */}
                                    <div className="flex justify-start gap-3 pt-3 border-t">
                                        <button 
                                            type="button" 
                                            onClick={() => setAddStep(1)} 
                                            className="bg-slate-50 hover:bg-slate-100 border text-slate-700 font-bold py-2 px-5 rounded text-sm transition"
                                        >
                                            Voltar
                                        </button>
                                        <button 
                                            type="submit" 
                                            disabled={!newDdd || !newPhone || !newClientName || !newDischarge}
                                            className={`font-extrabold py-2 px-6 rounded text-sm transition-all shadow-sm ${(!newDdd || !newPhone || !newClientName || !newDischarge) ? 'bg-slate-200 text-slate-400 cursor-not-allowed border' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
                                        >
                                            Salvar e Continuar ...
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </form>
                </div>
            )}

            {/* MOCK ACTIONS MODALS */}
            {activeModal && activeQuote && (
                <div className={`fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex ${activeModal.type === 'products' ? 'p-0 overflow-hidden' : 'items-center justify-center p-4'}`}>
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
                        <div className="bg-white shadow-2xl flex-1 rounded-none animate-in fade-in duration-150 flex flex-col min-h-0">
                            {/* Custom header bar centered and matching design */}
                            <div className="bg-slate-200 py-3.5 px-5 border-b border-slate-300 flex justify-between items-center shrink-0">
                                <div className="flex-1 text-center font-display text-slate-800 text-lg font-bold tracking-tight">
                                    ORÇAMENTO Nº {activeQuote.id}
                                    <div className="text-xs text-slate-500 font-extrabold uppercase mt-0.5">
                                        (CÓD {activeQuote.clientCode}) {activeQuote.clientName}
                                    </div>
                                </div>
                                <button type="button" onClick={() => setActiveModal(null)} className="text-slate-500 hover:text-slate-800 text-2xl font-bold font-sans line-none shrink-0">&times;</button>
                            </div>

                            {/* Deep blue actions menu buttons arranged in 3 rows */}
                            <div className="bg-slate-50 p-4 border-b border-slate-200 space-y-2.5 shrink-0">
                                {/* Row 1 */}
                                <div className="flex flex-wrap justify-center gap-2">
                                    {['Coluna', 'Pilar', 'Broca', 'Viga', 'Viga Superior', 'Viga Baldrame', 'Sapata', 'Corte e Dobra', 'Aço Armado + Arame (Não inserir bitolas com aproveitamento)'].map(cat => (
                                        <button
                                            type="button"
                                            key={cat}
                                            onClick={() => {
                                                if (cat === 'Coluna') {
                                                    setColunaName('');
                                                    setColunaQtde('');
                                                    setColunaTipoAmarracao('AMARRADA');
                                                    setColunaQtdeLados('4 LADOS');
                                                    setColunaAreaSemEstr1('');
                                                    setColunaAreaSemEstr2('');
                                                    setColunaObs('');
                                                    setShowColunaModal(true);
                                                    return;
                                                }
                                                setActiveCategory(cat);
                                                setSelectedSteelSpec('CA50 10.00mm,0.617');
                                                setQtyInput(10);
                                                setLenInput(6);
                                                setDobraQty(10);
                                                setDobraPrice(1.50);
                                                setWeightInput(100);
                                                setPricePerKg(8.50);
                                                setFreightPrice(150);
                                                setFreightObs('');
                                            }}
                                            className={`text-[11px] font-extrabold px-3.5 py-2 rounded transition-all shadow-sm ${activeCategory === cat ? 'bg-sky-600 text-white' : 'bg-[#0F3F5C] hover:bg-[#0A2A3D] text-white'}`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                                
                                {/* Row 2 */}
                                <div className="flex flex-wrap justify-center gap-2">
                                    {['Corte Dobra (PESO)', 'Dobra'].map(cat => (
                                        <button
                                            type="button"
                                            key={cat}
                                            onClick={() => {
                                                setActiveCategory(cat);
                                                setQtyInput(10);
                                                setLenInput(6);
                                                setDobraQty(10);
                                                setDobraPrice(1.50);
                                                setWeightInput(100);
                                                setPricePerKg(8.50);
                                                setFreightPrice(150);
                                                setFreightObs('');
                                            }}
                                            className={`text-[11px] font-extrabold px-4 py-2 rounded transition-all shadow-sm ${activeCategory === cat ? 'bg-sky-600 text-white' : 'bg-[#0F3F5C] hover:bg-[#0A2A3D] text-white'}`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>

                                {/* Row 3 */}
                                <div className="flex flex-wrap justify-center gap-2">
                                    {['Frete'].map(cat => (
                                        <button
                                            type="button"
                                            key={cat}
                                            onClick={() => {
                                                setActiveCategory(cat);
                                                setFreightPrice(150);
                                                setFreightObs('');
                                            }}
                                            className={`text-[11px] font-extrabold px-5 py-2 rounded transition-all shadow-sm ${activeCategory === cat ? 'bg-sky-600 text-white' : 'bg-[#0F3F5C] hover:bg-[#0A2A3D] text-white'}`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Category form details section */}
                            {activeCategory && (
                                <div className="bg-sky-50/40 p-4 border-b border-sky-100/50 animate-in slide-in-from-top duration-150 shrink-0">
                                    <h4 className="text-xs font-black text-sky-900 uppercase mb-3 flex items-center justify-between">
                                        <span>Adicionar {activeCategory}</span>
                                        <button type="button" onClick={() => setActiveCategory(null)} className="text-sky-500 hover:text-sky-700 text-xs font-bold font-sans">Fechar</button>
                                    </h4>

                                    {activeCategory === 'Frete' ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                                            <div className="sm:col-span-1">
                                                <label className="block text-[9.5px] font-bold text-slate-500 uppercase mb-1">Valor do Frete (R$)</label>
                                                <input 
                                                    type="number" 
                                                    value={freightPrice}
                                                    onChange={(e) => setFreightPrice(parseFloat(e.target.value) || 0)}
                                                    className="w-full p-2 border border-slate-300 rounded text-xs font-mono text-center font-bold bg-white" 
                                                />
                                            </div>
                                            <div className="sm:col-span-2">
                                                <label className="block text-[9.5px] font-bold text-slate-500 uppercase mb-1">Observações do Frete</label>
                                                <input 
                                                    type="text" 
                                                    placeholder="Carga fechada, entrega imediata..."
                                                    value={freightObs}
                                                    onChange={(e) => setFreightObs(e.target.value)}
                                                    className="w-full p-2 border border-slate-300 rounded text-xs font-semibold bg-white" 
                                                />
                                            </div>
                                        </div>
                                    ) : activeCategory === 'Dobra' ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                                            <div>
                                                <label className="block text-[9.5px] font-bold text-slate-500 uppercase mb-1">Quantidade de Dobras</label>
                                                <input 
                                                    type="number" 
                                                    value={dobraQty}
                                                    onChange={(e) => setDobraQty(parseInt(e.target.value) || 0)}
                                                    className="w-full p-2 border border-slate-300 rounded text-xs font-mono text-center font-bold bg-white" 
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[9.5px] font-bold text-slate-500 uppercase mb-1">Preço Unitário da Dobra (R$)</label>
                                                <input 
                                                    type="number" 
                                                    step="0.05"
                                                    value={dobraPrice}
                                                    onChange={(e) => setDobraPrice(parseFloat(e.target.value) || 0)}
                                                    className="w-full p-2 border border-slate-300 rounded text-xs font-mono text-center font-bold bg-white" 
                                                />
                                            </div>
                                        </div>
                                    ) : activeCategory === 'Corte Dobra (PESO)' ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                                            <div>
                                                <label className="block text-[9.5px] font-bold text-slate-500 uppercase mb-1">Peso Total (kg)</label>
                                                <input 
                                                    type="number" 
                                                    value={weightInput}
                                                    onChange={(e) => setWeightInput(parseFloat(e.target.value) || 0)}
                                                    className="w-full p-2 border border-slate-300 rounded text-xs font-mono text-center font-bold bg-white" 
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[9.5px] font-bold text-slate-500 uppercase mb-1">Preço por KG (R$)</label>
                                                <input 
                                                    type="number" 
                                                    step="0.05"
                                                    value={pricePerKg}
                                                    onChange={(e) => setPricePerKg(parseFloat(e.target.value) || 0)}
                                                    className="w-full p-2 border border-slate-300 rounded text-xs font-mono text-center font-bold bg-white" 
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        /* Standard steel specs items */
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                                            <div>
                                                <label className="block text-[9.5px] font-bold text-slate-500 uppercase mb-1">Bitola / Tipo de Aço</label>
                                                <select 
                                                    value={selectedSteelSpec}
                                                    onChange={(e) => setSelectedSteelSpec(e.target.value)}
                                                    className="w-full p-2 border border-slate-300 rounded text-xs font-semibold bg-white cursor-pointer"
                                                >
                                                    {STEEL_SPECS.map(spec => (
                                                        <option key={spec.label} value={`${spec.spec},${spec.factor}`}>
                                                            {spec.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[9.5px] font-bold text-slate-500 uppercase mb-1">Quantidade</label>
                                                <input 
                                                    type="number" 
                                                    value={qtyInput}
                                                    onChange={(e) => setQtyInput(parseInt(e.target.value) || 0)}
                                                    className="w-full p-2 border border-slate-300 rounded text-xs font-mono text-center font-bold bg-white" 
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[9.5px] font-bold text-slate-500 uppercase mb-1">Comprimento (m)</label>
                                                <input 
                                                    type="number" 
                                                    step="0.1"
                                                    value={lenInput}
                                                    onChange={(e) => setLenInput(parseFloat(e.target.value) || 0)}
                                                    className="w-full p-2 border border-slate-300 rounded text-xs font-mono text-center font-bold bg-white" 
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-sky-100/50">
                                        <button 
                                            type="button" 
                                            onClick={() => setActiveCategory(null)}
                                            className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold py-1.5 px-4 rounded transition"
                                        >
                                            Cancelar
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={handleAddTempProduct}
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-1.5 px-5 rounded transition shadow-sm"
                                        >
                                            Adicionar Item
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Product list area: sort bar + lançamento cards */}
                            <div className="flex-grow overflow-y-auto flex flex-col min-h-[220px]">
                                {/* Sort controls */}
                                <div className="px-4 py-2 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center gap-x-5 gap-y-1 shrink-0">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wide">Classificar itens por:</span>
                                    {(['date', 'type', 'name'] as const).map((opt, i) => (
                                        <label key={opt} className="flex items-center gap-1.5 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="productSort"
                                                checked={productSortBy === opt}
                                                onChange={() => setProductSortBy(opt)}
                                                className="accent-sky-600 w-3 h-3"
                                            />
                                            <span className="text-[10px] font-bold text-slate-600 uppercase">
                                                {opt === 'date' ? 'DATA DE INCLUSÃO' : opt === 'type' ? 'TIPO DE PEÇA' : 'NOME DA PEÇA'}
                                            </span>
                                        </label>
                                    ))}
                                </div>

                                {tempProducts.length === 0 ? (
                                    <div className="flex-grow flex items-center justify-center">
                                        <span className="text-xl font-black uppercase tracking-widest text-slate-300 select-none">Orçamento Vazio</span>
                                    </div>
                                ) : (
                                    <div className="p-3 space-y-1.5 flex-grow">
                                        {tempProducts.map((item, idx) => {
                                            const isColuna = item.description.startsWith('COLUNA');
                                            const isPillar = item.description.startsWith('PILAR');
                                            const isStructural = isColuna || isPillar;
                                            const incomplete = isStructural; // red alert when structural has no bars
                                            const isOpen = openDropdownIdx === idx;
                                            return (
                                                <div
                                                    key={item.id}
                                                    className={`border rounded-lg overflow-visible relative ${incomplete ? 'bg-red-50 border-red-300' : 'bg-emerald-50/60 border-emerald-200'}`}
                                                >
                                                    <div className="flex items-start gap-3 px-3 py-2.5">
                                                        {/* Number badge */}
                                                        <div className={`w-6 h-6 rounded-full text-white text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5 ${incomplete ? 'bg-red-500' : 'bg-emerald-600'}`}>
                                                            {idx + 1}
                                                        </div>
                                                        {/* Content */}
                                                        <div className="flex-grow min-w-0">
                                                            {/* Approx price */}
                                                            {item.ferros && item.ferros.length > 0 && (
                                                                <div className="text-right shrink-0">
                                                                    <div className="text-[10px] font-black text-slate-600 whitespace-nowrap">
                                                                        {(() => {
                                                                            const totalKg = (item.ferros || []).reduce((sum, f) => {
                                                                                const sides = [f.ladoA, f.ladoB, f.ladoC, f.ladoD, f.ladoE].filter(Boolean);
                                                                                const totalCm = sides.reduce((s, v) => s + (parseFloat(v) || 0), 0);
                                                                                const factor = parseFloat(f.bitola.split(',')[1]) || 0;
                                                                                return sum + (totalCm / 100) * factor * f.qtde;
                                                                            }, 0);
                                                                            const price = totalKg * 8.5;
                                                                            return `Aprox. R$ ${price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                                                                        })()}
                                                                    </div>
                                                                </div>
                                                            )}
                                                            <div className="text-sky-700 font-extrabold text-xs leading-snug uppercase tracking-wide">
                                                                {item.description}
                                                            </div>
                                                            {isStructural && (
                                                                <>
                                                                    <div className="text-red-500 text-[10px] font-bold mt-0.5">Sem ferros principais suficientes</div>
                                                                    <div className="text-red-500 text-[10px] font-bold">Sem estribos suficientes</div>
                                                                </>
                                                            )}
                                                            {!isStructural && item.weight > 0 && (
                                                                <div className="text-slate-500 text-[10px] font-semibold mt-0.5">
                                                                    Qtd: {item.qty} | Peso: {item.weight.toFixed(2)} kg | R$ {item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {/* Dropdown trigger */}
                                                        <div className="relative shrink-0">
                                                            <button
                                                                onClick={() => setOpenDropdownIdx(isOpen ? null : idx)}
                                                                className="flex items-center gap-1 border border-slate-300 bg-white hover:bg-slate-50 rounded px-2 py-1 text-[10px] font-bold text-slate-600 transition"
                                                            >
                                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                                                            </button>

                                                            {/* Dropdown menu */}
                                                            {isOpen && (
                                                                <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded shadow-xl z-[70] w-52 py-1 text-xs">
                                                                    {/* Red header bar */}
                                                                    <div className="bg-red-500 h-1.5 rounded-t mx-1 mb-1" />

                                                                    {/* Edit actions */}
                                                                    <button className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 font-semibold text-slate-700">
                                                                        <span>✏️</span> Editar
                                                                    </button>
                                                                    <button className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 font-semibold text-slate-700">
                                                                        <span>📋</span> Duplicar
                                                                    </button>
                                                                    <button className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 font-semibold text-slate-700">
                                                                        <span>🔒</span> Bloquear
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            setTempProducts(prev => prev.filter((_, i) => i !== idx));
                                                                            setOpenDropdownIdx(null);
                                                                        }}
                                                                        className="w-full text-left px-3 py-1.5 hover:bg-red-50 flex items-center gap-2 font-bold text-red-600"
                                                                    >
                                                                        <span>✕</span> Excluir
                                                                    </button>

                                                                    <div className="border-t border-slate-100 my-1" />

                                                                    {/* Add steel components */}
                                                                    {/* Ferros Principais - opens dedicated modal */}
                                                                    <button
                                                                        onClick={() => {
                                                                            const prod = tempProducts[idx];
                                                                            const parts = prod.description.split(' ');
                                                                            setFerroTargetProdIdx(idx);
                                                                            setFerroTargetColunaNome(parts.length > 1 ? parts[1] : '');
                                            setFerroNomeElemento('');
                                            setFerroQtde('');
                                            setFerroBitola('');
                                            setFerroPontaEsq('');
                                            setFerroPontaDir('');
                                            setFerroLadoA('');
                                                                            setFerroLadoB('');
                                                                            setFerroLadoC('');
                                                                            setFerroLadoD('');
                                                                            setFerroLadoE('');
                                                                            setFerroObs('');
                                                                            setOpenDropdownIdx(null);
                                                                            setShowFerrosModal(true);
                                                                        }}
                                                                        className="w-full text-left px-3 py-1.5 hover:bg-blue-50 flex items-center gap-2 font-semibold text-slate-700"
                                                                    >
                                                                        <span className="text-blue-600 font-black">+</span> Ferros Principais
                                                                    </button>
                                                                    {['Estribos', 'Costelas', 'Reforços', '2ª Camada', 'Trava'].map(option => (
                                                                        <button
                                                                            key={option}
                                                                            className="w-full text-left px-3 py-1.5 hover:bg-blue-50 flex items-center gap-2 font-semibold text-slate-700"
                                                                        >
                                                                            <span className="text-blue-600 font-black">+</span> {option}
                                                                        </button>
                                                                    ))}

                                                                    <div className="border-t border-slate-100 my-1" />

                                                                    {/* Extra options */}
                                                                    <button className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 font-semibold text-slate-500">
                                                                        <span>🖼️</span> Alterar Bitolas
                                                                    </button>
                                                                    <button className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 font-semibold text-slate-500">
                                                                        <span>🔄</span> Copiar para Corte e Dobra
                                                                    </button>
                                                                    <button className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 font-semibold text-slate-500">
                                                                        <span>📎</span> Anexar Desenho
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Ferros table (shown when ferros exist) */}
                                                    {item.ferros && item.ferros.length > 0 && (
                                                        <div className="border-t border-red-200 overflow-x-auto">
                                                            <table className="w-full text-[10px] min-w-[800px]">
                                                                <thead className="bg-[#0F3F5C] text-white">
                                                                    <tr>
                                                                        <th className="px-2 py-1.5 text-center font-bold">img</th>
                                                                        <th className="px-2 py-1.5 text-center font-bold">nome elemento</th>
                                                                        <th className="px-2 py-1.5 text-center font-bold">qtde</th>
                                                                        <th className="px-2 py-1.5 text-center font-bold">tipo</th>
                                                                        <th className="px-2 py-1.5 text-center font-bold">bitola</th>
                                                                        <th className="px-2 py-1.5 text-center font-bold">esp estr.</th>
                                                                        <th className="px-2 py-1.5 text-center font-bold">area s/ est.</th>
                                                                        <th className="px-2 py-1.5 text-center font-bold">ponta</th>
                                                                        <th className="px-2 py-1.5 text-center font-bold">obs</th>
                                                                        <th className="px-2 py-1.5 text-center font-bold">calculos</th>
                                                                        <th className="px-2 py-1.5 text-center font-bold">açao</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {item.ferros.map((ferro, fIdx) => {
                                                                        const sides = [ferro.ladoA, ferro.ladoB, ferro.ladoC, ferro.ladoD, ferro.ladoE].filter(Boolean);
                                                                        const totalLen = sides.reduce((s, v) => s + (parseFloat(v) || 0), 0);
                                                                        const areaMatch = item.description.match(/x (\d+) CM/);
                                                                        const areaVal = areaMatch ? areaMatch[1] : '';
                                                                        const areaText = areaVal ? `${areaVal} CM S/ ESTR LADO DIREITO + ${areaVal} CM S/ ESTR LADO ESQUERDO` : '-';
                                                                        const pontaText = (ferro.pontaEsquerdo === 'SEM PONTA' && ferro.pontaDireito === 'SEM PONTA') ? 'SEM PONTAS' : `ESQ: ${ferro.pontaEsquerdo} / DIR: ${ferro.pontaDireito}`;
                                                                        return (
                                                                            <tr key={ferro.id} className="border-b border-slate-100 bg-white hover:bg-slate-50">
                                                                                {/* img - dynamic bar shape */}
                                                                                <td className="px-2 py-1.5 text-center">
                                                                                    {renderBarDiagramSVG(
                                                                                        ferro.pontaEsquerdo, ferro.pontaDireito,
                                                                                        ferro.ladoA, ferro.ladoB, ferro.ladoD,
                                                                                        true
                                                                                    )}
                                                                                </td>
                                                                                <td className="px-2 py-1.5 text-center font-bold text-slate-700">{ferro.nomeElemento}</td>
                                                                                <td className="px-2 py-1.5 text-center font-bold text-slate-700">{ferro.qtde}</td>
                                                                                <td className="px-2 py-1.5 text-center text-slate-600">FERROS</td>
                                                                                <td className="px-2 py-1.5 text-center font-bold">{ferro.bitola.split(',')[0]}</td>
                                                                                <td className="px-2 py-1.5 text-center text-slate-500">-</td>
                                                                                <td className="px-2 py-1.5 text-center text-slate-600" style={{maxWidth: '180px'}}>{areaText}</td>
                                                                                <td className="px-2 py-1.5 text-center text-slate-600">{getPontaText(ferro.pontaEsquerdo, ferro.pontaDireito)}</td>
                                                                                <td className="px-2 py-1.5 text-center text-slate-500">{ferro.obs || '-'}</td>
                                                                                <td className="px-2 py-1.5 text-left">
                                                                                    <div className="text-slate-500">Tamanho total:</div>
                                                                                    <div className="text-slate-500">linear</div>
                                                                                    <div className="text-slate-500">unidade:</div>
                                                                                    <div className="font-black text-slate-800">{totalLen} cm</div>
                                                                                </td>
                                                                                <td className="px-2 py-1.5 text-center">
                                                                                    <div className="flex flex-col items-center gap-1">
                                                                                        <div className="flex gap-1">
                                                                                            <button className="text-[10px] font-bold text-slate-600 hover:underline">Editar</button>
                                                                                            <span className="text-slate-300">|</span>
                                                                                            <button className="text-[10px] font-bold text-slate-600 hover:underline">Copiar</button>
                                                                                        </div>
                                                                                        <button
                                                                                            onClick={() => setTempProducts(prev => prev.map((p, pi) =>
                                                                                                pi === idx ? { ...p, ferros: (p.ferros || []).filter((_, fi) => fi !== fIdx) } : p
                                                                                            ))}
                                                                                            className="bg-red-500 hover:bg-red-600 text-white text-[9px] font-bold py-0.5 px-2 rounded transition"
                                                                                        >
                                                                                            Excluir
                                                                                        </button>
                                                                                    </div>
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Voltar and Continuar bottom actions */}
                            <div className="p-4 bg-slate-50 border-t flex justify-between shrink-0">
                                <button 
                                    onClick={() => setActiveModal(null)} 
                                    className="bg-slate-50 hover:bg-slate-100 border text-slate-700 font-bold py-2.5 px-6 rounded text-sm transition"
                                >
                                    Voltar
                                </button>
                                <button 
                                    onClick={() => {
                                        handleProductSave(activeQuote.id, tempProducts);
                                        setActiveModal(null);
                                    }}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-2.5 px-7 rounded text-sm transition shadow-sm"
                                >
                                    Continuar
                                </button>
                            </div>
                        </div>
                    )}

                    {/* MODAL: Ferros Principais */}
                    {showFerrosModal && (
                        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                            <div className="bg-white rounded shadow-2xl w-full max-w-3xl border border-slate-300 overflow-y-auto max-h-[95vh]">
                                {/* Header */}
                                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
                                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                                        Ferros Principais Para{' '}
                                        <span className="underline">{ferroTargetColunaNome || 'PEÇA'}</span>
                                    </h3>
                                    <button type="button" onClick={() => setShowFerrosModal(false)} className="text-slate-500 hover:text-slate-800 text-xl font-bold w-7 h-7 flex items-center justify-center border border-slate-300 rounded">×</button>
                                </div>

                                <div className="p-5 space-y-4">
                                    {/* Row 1: Nome, Qtde, Bitola */}
                                    <div className="grid grid-cols-12 gap-3 items-end">
                                        {/* Nome Elemento */}
                                        <div className="col-span-4">
                                            <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">Nome Elemento:</label>
                                            <div className={`flex items-stretch border rounded overflow-hidden ${ferroNomeElemento ? 'border-emerald-400' : 'border-red-400'}`}>
                                                <div className={`w-8 border-r flex items-center justify-center shrink-0 ${ferroNomeElemento ? 'bg-emerald-100 border-emerald-300' : 'bg-red-100 border-red-300'}`}>
                                                    <span className={`font-black text-xs ${ferroNomeElemento ? 'text-emerald-600' : 'text-red-600'}`}>{ferroNomeElemento ? '✓' : '✕'}</span>
                                                </div>
                                                <input type="text" value={ferroNomeElemento} onChange={e => setFerroNomeElemento(e.target.value)}
                                                    className={`w-full px-2 py-1.5 text-xs font-bold outline-none bg-transparent ${ferroNomeElemento ? 'text-slate-800' : 'text-red-500'}`} />
                                            </div>
                                        </div>
                                        {/* Qtde */}
                                        <div className="col-span-3">
                                            <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">QTDE Ferros Principais:</label>
                                            <div className={`flex items-stretch border rounded overflow-hidden ${ferroQtde ? 'border-emerald-400' : 'border-red-400'}`}>
                                                <div className={`w-8 border-r flex items-center justify-center shrink-0 ${ferroQtde ? 'bg-emerald-100 border-emerald-300' : 'bg-red-100 border-red-300'}`}>
                                                    <span className={`font-black text-xs ${ferroQtde ? 'text-emerald-600' : 'text-red-600'}`}>{ferroQtde ? '✓' : '✕'}</span>
                                                </div>
                                                <input type="number" min="1" value={ferroQtde} onChange={e => setFerroQtde(e.target.value)}
                                                    className={`w-full px-2 py-1.5 text-xs font-bold outline-none bg-transparent text-center ${ferroQtde ? 'text-slate-800' : 'text-red-500'}`} />
                                            </div>
                                        </div>
                                        {/* Bitola */}
                                        <div className="col-span-5">
                                            <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">Bitola:</label>
                                            <div className={`flex items-stretch border rounded overflow-hidden ${ferroBitola ? 'border-emerald-400' : 'border-red-400'}`}>
                                                <div className={`w-8 border-r flex items-center justify-center shrink-0 ${ferroBitola ? 'bg-emerald-100 border-emerald-300' : 'bg-red-100 border-red-300'}`}>
                                                    <span className={`font-black text-xs ${ferroBitola ? 'text-emerald-600' : 'text-red-600'}`}>{ferroBitola ? '✓' : '✕'}</span>
                                                </div>
                                                <select value={ferroBitola} onChange={e => setFerroBitola(e.target.value)}
                                                    className={`w-full px-2 py-1.5 text-xs font-bold outline-none bg-transparent cursor-pointer ${ferroBitola ? 'text-emerald-700' : 'text-red-500'}`}>
                                                    <option value="">Selecione...</option>
                                                    {BITOLA_OPTIONS.map(b => (
                                                        <option key={b.label} value={`${b.label},${b.kgm}`}>{b.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Row 2: Pontas + Diagram */}
                                    <div className="grid grid-cols-5 gap-3 items-start">
                                        {/* Ponta Lado Esquerdo */}
                                        <div className="col-span-2">
                                            <label className="block text-[10px] font-black text-slate-600 uppercase mb-2">Ponta Lado Esquerdo:</label>
                                            <div className="border border-slate-200 rounded p-2 space-y-1">
                                                {PONTA_OPTIONS.map(p => (
                                                    <label key={p} className="flex items-center gap-2 cursor-pointer">
                                                        <input type="radio" name="ferroPontaEsq" checked={ferroPontaEsq === p} onChange={() => setFerroPontaEsq(p)} className="accent-sky-600 w-3 h-3" />
                                                        <span className="text-[10px] font-bold text-slate-700 uppercase">{p}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                        {/* Diagram - live SVG preview */}
                                        <div className="col-span-1 flex items-center justify-center min-h-[120px]">
                                            {renderBarDiagramSVG(ferroPontaEsq, ferroPontaDir, ferroLadoA, ferroLadoB, ferroLadoD)}
                                        </div>
                                        {/* Ponta Lado Direito */}
                                        <div className="col-span-2">
                                            <label className="block text-[10px] font-black text-slate-600 uppercase mb-2">Ponta Lado Direito:</label>
                                            <div className="border border-slate-200 rounded p-2 space-y-1">
                                                {PONTA_OPTIONS.map(p => (
                                                    <label key={p} className="flex items-center gap-2 cursor-pointer">
                                                        <input type="radio" name="ferroPontaDir" checked={ferroPontaDir === p} onChange={() => setFerroPontaDir(p)} className="accent-sky-600 w-3 h-3" />
                                                        <span className="text-[10px] font-bold text-slate-700 uppercase">{p}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Row 3: Lados A-E */}
                                    <div className="grid grid-cols-5 gap-2">
                                        {[
                                            { label: 'Lado A (cm)', val: ferroLadoA, set: setFerroLadoA, required: true },
                                            { label: 'Lado B (cm)', val: ferroLadoB, set: setFerroLadoB, required: false },
                                            { label: 'Lado C (cm)', val: ferroLadoC, set: setFerroLadoC, required: false },
                                            { label: 'Lado D (cm)', val: ferroLadoD, set: setFerroLadoD, required: false },
                                            { label: 'Lado E (cm)', val: ferroLadoE, set: setFerroLadoE, required: false },
                                        ].map(({ label, val, set, required }) => (
                                            <div key={label}>
                                                <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">{label}:</label>
                                                <div className={`flex items-stretch border rounded overflow-hidden ${val ? 'border-emerald-400' : required ? 'border-red-400' : 'border-red-400'}`}>
                                                    <div className={`w-7 border-r flex items-center justify-center shrink-0 ${val ? 'bg-emerald-100 border-emerald-300' : 'bg-red-100 border-red-300'}`}>
                                                        <span className={`font-black text-xs ${val ? 'text-emerald-600' : 'text-red-600'}`}>{val ? '✓' : '✕'}</span>
                                                    </div>
                                                    <input type="number" value={val} onChange={e => set(e.target.value)}
                                                        className={`w-full px-1.5 py-1.5 text-xs font-bold outline-none bg-transparent text-center ${val ? 'text-slate-800' : 'text-red-500'}`} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Observação */}
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">Observação:</label>
                                        <div className="flex items-stretch border border-red-400 rounded overflow-hidden">
                                            <div className="w-8 bg-red-100 border-r border-red-300 flex items-center justify-center shrink-0">
                                                <span className="text-red-600 font-black text-xs">✕</span>
                                            </div>
                                            <input type="text" placeholder="OPCIONAL" value={ferroObs} onChange={e => setFerroObs(e.target.value)}
                                                className="w-full px-2 py-1.5 text-xs font-semibold text-red-500 placeholder-red-400 outline-none bg-transparent" />
                                        </div>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="px-5 py-3 border-t border-slate-200 flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (!ferroQtde || parseInt(ferroQtde) <= 0) {
                                                showNotification('Informe a quantidade de ferros.', 'warning'); return;
                                            }
                                            if (!ferroLadoA) {
                                                showNotification('Informe o Lado A (comprimento principal).', 'warning'); return;
                                            }
                                            if (!ferroBitola) {
                                                showNotification('Selecione a bitola.', 'warning'); return;
                                            }
                                            const bitolaKgm = parseFloat(ferroBitola.split(',')[1]) || 0.617;
                                            const bitolaLabel = ferroBitola.split(',')[0];
                                            const newFerro: FerroItem = {
                                                id: String(Date.now() + Math.random()),
                                                nomeElemento: ferroNomeElemento,
                                                qtde: parseInt(ferroQtde),
                                                bitola: `${bitolaLabel},${bitolaKgm}`,
                                                bitolaKgm,
                                                pontaEsquerdo: ferroPontaEsq,
                                                pontaDireito: ferroPontaDir,
                                                ladoA: ferroLadoA,
                                                ladoB: ferroLadoB,
                                                ladoC: ferroLadoC,
                                                ladoD: ferroLadoD,
                                                ladoE: ferroLadoE,
                                                obs: ferroObs,
                                            };
                                            setTempProducts(prev => prev.map((p, pi) =>
                                                pi === ferroTargetProdIdx
                                                    ? { ...p, ferros: [...(p.ferros || []), newFerro] }
                                                    : p
                                            ));
                                            setShowFerrosModal(false);
                                            showNotification('Ferro principal adicionado!', 'success');
                                        }}
                                        className="bg-[#1565C0] hover:bg-[#0D47A1] text-white font-extrabold py-2 px-5 rounded text-sm transition shadow"
                                    >
                                        Salvar Elemento
                                    </button>
                                    <button type="button" onClick={() => setShowFerrosModal(false)} className="text-slate-600 hover:text-slate-800 font-bold py-2 px-4 text-sm transition">
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* MODAL: Coluna sub-modal */}
                    {showColunaModal && (
                        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                            <div className="bg-white rounded shadow-2xl w-full max-w-2xl border border-slate-300 animate-in fade-in zoom-in-95 duration-150">
                                {/* Header */}
                                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
                                    <h3 className="text-base font-black text-slate-800 uppercase tracking-wider">Coluna</h3>
                                    <button
                                        type="button"
                                        onClick={() => setShowColunaModal(false)}
                                        className="text-slate-500 hover:text-slate-800 text-xl font-bold w-7 h-7 flex items-center justify-center border border-slate-300 rounded"
                                    >
                                        ×
                                    </button>
                                </div>

                                <div className="p-5 space-y-4">
                                    {/* Row 1: Nome, Qtde, Tipo Amarração */}
                                    <div className="grid grid-cols-12 gap-3 items-start">
                                        {/* Nome da Coluna */}
                                        <div className="col-span-4">
                                            <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">Nome da Coluna:</label>
                                            <div className="flex items-stretch border border-red-400 rounded overflow-hidden">
                                                <div className="w-8 bg-red-100 border-r border-red-300 flex items-center justify-center shrink-0">
                                                    <span className="text-red-600 font-black text-xs">✕</span>
                                                </div>
                                                <input
                                                    type="text"
                                                    placeholder="OPCIONAL"
                                                    value={colunaName}
                                                    onChange={e => setColunaName(e.target.value)}
                                                    className="w-full px-2 py-1.5 text-xs font-semibold text-red-500 placeholder-red-400 outline-none bg-transparent"
                                                />
                                            </div>
                                        </div>

                                        {/* Qtde */}
                                        <div className="col-span-3">
                                            <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">QTDE:</label>
                                            <div className={`flex items-stretch border rounded overflow-hidden ${colunaQtde ? 'border-emerald-400' : 'border-red-400'}`}>
                                                <div className={`w-8 border-r flex items-center justify-center shrink-0 ${colunaQtde ? 'bg-emerald-100 border-emerald-300' : 'bg-red-100 border-red-300'}`}>
                                                    <span className={`font-black text-xs ${colunaQtde ? 'text-emerald-600' : 'text-red-600'}`}>{colunaQtde ? '✓' : '✕'}</span>
                                                </div>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    placeholder=""
                                                    value={colunaQtde}
                                                    onChange={e => setColunaQtde(e.target.value)}
                                                    className={`w-full px-2 py-1.5 text-xs font-bold outline-none bg-transparent text-center ${colunaQtde ? 'text-slate-800' : 'text-red-500'}`}
                                                />
                                            </div>
                                        </div>

                                        {/* Tipo Amarração */}
                                        <div className="col-span-5">
                                            <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">TIPO AMARRAÇÃO:</label>
                                            <div className="flex flex-col gap-1 pt-0.5">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="colunaAmarracao"
                                                        checked={colunaTipoAmarracao === 'AMARRADA'}
                                                        onChange={() => setColunaTipoAmarracao('AMARRADA')}
                                                        className="accent-sky-600 w-3.5 h-3.5"
                                                    />
                                                    <span className="text-xs font-bold text-slate-700">AMARRADA</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="colunaAmarracao"
                                                        checked={colunaTipoAmarracao === 'SOLDADA'}
                                                        onChange={() => setColunaTipoAmarracao('SOLDADA')}
                                                        className="accent-sky-600 w-3.5 h-3.5"
                                                    />
                                                    <span className="text-xs font-bold text-slate-700">SOLDADA</span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Row 2: Qtde Lados, Área S/ Estr 1, Área S/ Estr 2 */}
                                    <div className="grid grid-cols-3 gap-3 items-start">
                                        {/* Qtde Lados */}
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">QTDE LADOS:</label>
                                            <div className="flex items-stretch border border-emerald-400 rounded overflow-hidden">
                                                <div className="w-8 bg-emerald-100 border-r border-emerald-300 flex items-center justify-center shrink-0">
                                                    <span className="text-emerald-600 font-black text-xs">✓</span>
                                                </div>
                                                <select
                                                    value={colunaQtdeLados}
                                                    onChange={e => setColunaQtdeLados(e.target.value)}
                                                    className="w-full px-2 py-1.5 text-xs font-bold text-emerald-700 outline-none bg-transparent cursor-pointer"
                                                >
                                                    <option value="4 LADOS">4 LADOS</option>
                                                    <option value="3 LADOS">3 LADOS</option>
                                                    <option value="2 LADOS">2 LADOS</option>
                                                </select>
                                            </div>
                                        </div>

                                        {/* Área S/ Estr 1 */}
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">ÁREA S/ ESTR: (cm):</label>
                                            <div className="flex items-stretch border border-red-400 rounded overflow-hidden">
                                                <div className="w-8 bg-red-100 border-r border-red-300 flex items-center justify-center shrink-0">
                                                    <span className="text-red-600 font-black text-xs">✕</span>
                                                </div>
                                                <input
                                                    type="text"
                                                    placeholder="OPCIONAL"
                                                    value={colunaAreaSemEstr1}
                                                    onChange={e => setColunaAreaSemEstr1(e.target.value)}
                                                    className="w-full px-2 py-1.5 text-xs font-semibold text-red-500 placeholder-red-400 outline-none bg-transparent"
                                                />
                                            </div>
                                        </div>

                                        {/* Área S/ Estr 2 */}
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">ÁREA S/ ESTR: (cm):</label>
                                            <div className="flex items-stretch border border-red-400 rounded overflow-hidden">
                                                <div className="w-8 bg-red-100 border-r border-red-300 flex items-center justify-center shrink-0">
                                                    <span className="text-red-600 font-black text-xs">✕</span>
                                                </div>
                                                <input
                                                    type="text"
                                                    placeholder="OPCIONAL"
                                                    value={colunaAreaSemEstr2}
                                                    onChange={e => setColunaAreaSemEstr2(e.target.value)}
                                                    className="w-full px-2 py-1.5 text-xs font-semibold text-red-500 placeholder-red-400 outline-none bg-transparent"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Column diagram SVG */}
                                    <div className="flex flex-col items-center py-2">
                                        <svg viewBox="0 0 500 80" className="w-full max-w-lg" xmlns="http://www.w3.org/2000/svg">
                                            {/* Outer rectangle representing full column span */}
                                            <rect x="10" y="10" width="480" height="42" fill="none" stroke="#333" strokeWidth="2"/>
                                            {/* Left area without stirrups - dashed zone */}
                                            <rect x="10" y="10" width="110" height="42" fill="none" stroke="none"/>
                                            {/* Stirrup zone - vertical bars in center */}
                                            {[128, 142, 156, 170, 184, 198, 212, 226, 240, 254, 268, 282, 296, 310, 324, 338, 352, 366].map((x: number) => (
                                                <line key={x} x1={x} y1="10" x2={x} y2="52" stroke="#222" strokeWidth="1.5"/>
                                            ))}
                                            {/* Right area without stirrups */}
                                            <rect x="380" y="10" width="110" height="42" fill="none" stroke="none"/>
                                            {/* Left bracket */}
                                            <line x1="120" y1="5" x2="120" y2="57" stroke="#555" strokeWidth="1" strokeDasharray="3,2"/>
                                            {/* Right bracket */}
                                            <line x1="380" y1="5" x2="380" y2="57" stroke="#555" strokeWidth="1" strokeDasharray="3,2"/>
                                            {/* Labels */}
                                            <text x="65" y="72" textAnchor="middle" fontSize="9" fill="#666" fontFamily="sans-serif" fontWeight="bold">ÁREA SEM ESTRIBOS</text>
                                            <text x="435" y="72" textAnchor="middle" fontSize="9" fill="#666" fontFamily="sans-serif" fontWeight="bold">ÁREA SEM ESTRIBOS</text>
                                        </svg>
                                    </div>

                                    {/* Observação */}
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">OBSERVAÇÃO:</label>
                                        <div className="flex items-stretch border border-red-400 rounded overflow-hidden">
                                            <div className="w-8 bg-red-100 border-r border-red-300 flex items-center justify-center shrink-0">
                                                <span className="text-red-600 font-black text-xs">✕</span>
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="OPCIONAL"
                                                value={colunaObs}
                                                onChange={e => setColunaObs(e.target.value)}
                                                className="w-full px-2 py-1.5 text-xs font-semibold text-red-500 placeholder-red-400 outline-none bg-transparent"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Footer buttons */}
                                <div className="px-5 py-3 border-t border-slate-200 flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (!colunaQtde || parseInt(colunaQtde) <= 0) {
                                                showNotification('Informe a quantidade de colunas.', 'warning');
                                                return;
                                            }
                                            const qty = parseInt(colunaQtde);
                                            const nomePart = colunaName ? colunaName.toUpperCase() : '';
                                            const areaVal = colunaAreaSemEstr1 || 'ESP';
                                            const obsPart = colunaObs ? ` OBS: ${colunaObs.toUpperCase()}` : '';
                                            const description = `COLUNA ${nomePart} ${colunaTipoAmarracao} ${colunaQtdeLados} x ${areaVal} CM${obsPart}`.replace(/\s+/g, ' ').trim();
                                            const newProd: ProductItem = {
                                                id: String(Date.now() + Math.random()),
                                                description,
                                                qty,
                                                length: 0,
                                                weightPerMeter: 0,
                                                weight: 0,
                                                price: 0
                                            };
                                            setTempProducts(prev => [...prev, newProd]);
                                            setShowColunaModal(false);
                                            showNotification('Coluna adicionada ao orçamento!', 'success');
                                        }}
                                        className="bg-[#1565C0] hover:bg-[#0D47A1] text-white font-extrabold py-2 px-5 rounded text-sm transition shadow"
                                    >
                                        Salvar Peça
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowColunaModal(false)}
                                        className="text-slate-600 hover:text-slate-800 font-bold py-2 px-4 text-sm transition"
                                    >
                                        Cancelar
                                    </button>
                                </div>
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
                                        {(activeQuote.ddd || activeQuote.phone) && (
                                            <span className="block text-[9.5px] text-slate-600 font-bold mt-1">
                                                Fone: ({activeQuote.ddd}) {activeQuote.phone}
                                            </span>
                                        )}
                                        {activeQuote.email && (
                                            <span className="block text-[9.5px] text-slate-600 font-bold">
                                                Email: {activeQuote.email}
                                            </span>
                                        )}
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

                                {activeQuote.dischargeByClient === 'Sim' && (
                                    <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 mt-4 text-amber-800 font-bold text-[10px] leading-normal uppercase">
                                        ⚠️ AVISO IMPORTANTE: O descarregamento dos produtos no momento da entrega é de inteira responsabilidade do cliente. A MSM Sistemas não se responsabiliza pelo descarregamento.
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

                    {/* MODAL: Excluir Orçamento */}
                    {activeModal.type === 'delete' && (
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                            <div className="bg-red-600 p-4 text-white flex justify-between items-center shrink-0">
                                <h3 className="font-bold text-lg">🗑️ Excluir Orçamento</h3>
                                <button onClick={() => setActiveModal(null)} className="text-white text-xl font-bold">&times;</button>
                            </div>
                            <div className="p-6 space-y-4">
                                <p className="text-sm text-slate-700 font-semibold">
                                    Tem certeza que deseja excluir o orçamento <strong>nº {activeQuote.id}</strong>?
                                </p>
                                <p className="text-xs text-slate-500">
                                    Cliente: {activeQuote.clientName} — Valor: R$ {activeQuote.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                                <p className="text-xs text-red-500 font-bold">Esta ação não pode ser desfeita.</p>
                            </div>
                            <div className="p-4 bg-slate-50 border-t flex justify-end gap-2 shrink-0">
                                <button onClick={() => setActiveModal(null)} className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2 px-5 rounded-xl text-xs uppercase transition">Cancelar</button>
                                <button
                                    onClick={() => {
                                        setQuotes(prev => prev.filter(q => q.id !== activeQuote.id));
                                        setActiveModal(null);
                                        showNotification(`Orçamento nº ${activeQuote.id} excluído com sucesso!`, 'success');
                                    }}
                                    className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-5 rounded-xl text-xs uppercase transition"
                                >
                                    Confirmar Exclusão
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default PointingSystem;
