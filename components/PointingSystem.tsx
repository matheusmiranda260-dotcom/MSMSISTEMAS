import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { 
    Page, User, StockGauge, EstriboModel, FerroModel, Partner, TravaModel,
    Quote, ProductItem, FerroItem, BitolaConfig, ArameConfig
} from '../types';
import { DEFAULT_ESTRIBO_MODELS, DEFAULT_FERRO_MODELS, DEFAULT_TRAVA_MODELS } from '../types';
import { fetchTable, insertItem, updateItem, deleteItem, upsertItem, uploadFile, supabase } from '../services/supabaseService';
import { fetchAllQuotesFromDB, saveQuoteToDB, deleteQuoteFromDB, fetchBitolasConfigFromDB, fetchArameConfigFromDB } from '../services/pointingSupabaseAdapter';
import EstriboDrawingBoard from './EstriboDrawingBoard';
import { 
    PencilIcon, TrashIcon, ArrowLeftIcon 
} from './icons';

const ProductTitleText = ({ description }: { description: string }) => {
    const desc = description || '';
    const isStructural = desc.startsWith('COLUNA') || desc.startsWith('PILAR') || desc.startsWith('VIGA') || desc.startsWith('BROCA') || desc.startsWith('SAPATA');

    if (!isStructural) {
        return <span className="font-extrabold text-slate-800 uppercase tracking-wide">{desc}</span>;
    }

    const parts = desc.split(' ');
    const category = parts[0] || '';
    
    const amarracaoIdx = parts.findIndex(p => p === 'AMARRADA' || p === 'SOLDADA');
    let name = '';
    let rest = '';
    if (amarracaoIdx !== -1) {
        name = parts.slice(1, amarracaoIdx).join(' ');
        rest = parts.slice(amarracaoIdx).join(' ');
    } else {
        name = parts[1] || '';
        rest = parts.slice(2).join(' ');
    }

    return (
        <span className="font-extrabold uppercase tracking-wide">
            <span className="text-slate-800">{category}</span>{' '}
            {name && <span className="text-blue-600 italic">{name}</span>}{' '}
            <span className="text-slate-800">{rest}</span>
        </span>
    );
};

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
    gauges?: StockGauge[];
    activeBrandingPartner?: Partner | null;
}

const INITIAL_QUOTES: Quote[] = [];

const PointingSystem: React.FC<PointingSystemProps> = ({ currentUser, showNotification, gauges, activeBrandingPartner }) => {
    const [isLoadingData, setIsLoadingData] = useState(true);

    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [bitolas, setBitolas] = useState<BitolaConfig[]>([]);
    const [arameConfig, setArameConfig] = useState<ArameConfig>({ ptsPorKg: 256, precoPorKg: 10 });
    const [estriboModels, setEstriboModels] = useState<EstriboModel[]>([]);
    const [ferroModels, setFerroModels] = useState<FerroModel[]>([]);
    const [travaModels, setTravaModels] = useState<TravaModel[]>([]);

    const prevQuotesRef = useRef<Quote[]>([]);
    const prevBitolasRef = useRef<BitolaConfig[]>([]);
    const prevArameRef = useRef<ArameConfig>({ ptsPorKg: 256, precoPorKg: 10 });
    const prevEstribosRef = useRef<EstriboModel[]>([]);
    const prevFerrosRef = useRef<FerroModel[]>([]);
    const prevTravasRef = useRef<TravaModel[]>([]);

    useEffect(() => {
        const loadAllData = async () => {
            setIsLoadingData(true);
            let dbQuotes: Quote[] = [];
            let dbBitolas: BitolaConfig[] = [];
            let dbArame: ArameConfig | null = null;
            let dbEstribos: EstriboModel[] = [];
            let dbFerros: FerroModel[] = [];
            let dbTravas: TravaModel[] = [];
            let loadErrors: string[] = [];

            // Helper to fetch safely without failing the whole sequence
            async function fetchSafe<T>(name: string, fetchFn: () => Promise<T>, fallback: T): Promise<T> {
                try {
                    return await fetchFn();
                } catch (err: any) {
                    console.error(`Error fetching ${name}:`, err);
                    loadErrors.push(name);
                    return fallback;
                }
            }

            dbQuotes = await fetchSafe('orçamentos', fetchAllQuotesFromDB, []);
            dbBitolas = await fetchSafe('bitolas', fetchBitolasConfigFromDB, []);
            dbArame = await fetchSafe('configuração de arame', fetchArameConfigFromDB, null);
            dbEstribos = await fetchSafe('modelos de estribos', () => fetchTable<EstriboModel>('model_estribos'), []);
            dbFerros = await fetchSafe('modelos de ferros', () => fetchTable<FerroModel>('model_ferros'), []);
            dbTravas = await fetchSafe('modelos de travas', () => fetchTable<TravaModel>('model_travas'), []);            // No fallbacks, just use what is in the DB
            const loadedQuotes = dbQuotes;            
            const loadedBitolas = dbBitolas;
            const loadedArame = dbArame || { ptsPorKg: 256, precoPorKg: 10 };
            
            const loadedEstribos = dbEstribos.map((m: any) => ({ ...m, customImageBase64: m.customImageUrl || m.customImageBase64 }));
            const loadedFerros = dbFerros.map((m: any) => ({ ...m, customImageBase64: m.customImageUrl || m.customImageBase64 }));
            const loadedTravas = dbTravas.map((m: any) => ({ ...m, customImageBase64: m.customImageUrl || m.customImageBase64 }));

            setQuotes(loadedQuotes);
            setBitolas(loadedBitolas);
            setArameConfig(loadedArame);
            setEstriboModels(loadedEstribos);
            setFerroModels(loadedFerros);
            setTravaModels(loadedTravas);

            prevQuotesRef.current = loadedQuotes;
            prevBitolasRef.current = loadedBitolas;
            prevArameRef.current = loadedArame;
            prevEstribosRef.current = loadedEstribos;
            prevFerrosRef.current = loadedFerros;
            prevTravasRef.current = loadedTravas;

            if (loadErrors.length > 0) {
                showNotification(`Aviso: Erro ao carregar dados do Supabase para as tabelas: ${loadErrors.join(', ')}. Alguns dados podem estar desatualizados.`, 'warning');
            }
            setIsLoadingData(false);
        };
        loadAllData();
    }, []);

    // Supabase Sync Effect for Quotes
    useEffect(() => {
        if (isLoadingData) return;
        const syncQuotes = async () => {
            try {
                const changedOrAdded = quotes.filter(q => {
                    const prev = prevQuotesRef.current.find(pq => pq.id === q.id);
                    if (!prev) return true;
                    return JSON.stringify(q) !== JSON.stringify(prev);
                });
                for (const q of changedOrAdded) {
                    const success = await saveQuoteToDB(q);
                    if (!success) {
                        showNotification(`Erro ao sincronizar orçamento ${q.id} com Supabase.`, 'error');
                    }
                }
                const deleted = prevQuotesRef.current.filter(pq => !quotes.some(q => q.id === pq.id));
                for (const pq of deleted) {
                    const success = await deleteQuoteFromDB(pq.id);
                    if (!success) {
                        showNotification(`Erro ao deletar orçamento ${pq.id} do Supabase.`, 'error');
                    }
                }
                prevQuotesRef.current = quotes;
            } catch (err: any) {
                console.error('Error syncing quotes:', err);
                showNotification(`Erro de sincronização de orçamentos: ${err.message || err}`, 'error');
            }
        };
        syncQuotes();
    }, [quotes, isLoadingData]);

    // Supabase Sync for Bitolas
    useEffect(() => {
        if (isLoadingData) return;
        const syncBitolas = async () => {
            try {
                const changed = bitolas.filter(b => {
                    const prev = prevBitolasRef.current.find(pb => pb.id === b.id);
                    if (!prev) return true;
                    return JSON.stringify(b) !== JSON.stringify(prev);
                });
                for (const b of changed) {
                    await upsertItem('config_bitolas', b);
                }
                
                const deleted = prevBitolasRef.current.filter(pb => !bitolas.some(b => b.id === pb.id));
                for (const pb of deleted) {
                    await deleteItem('config_bitolas', pb.id);
                }
                prevBitolasRef.current = bitolas;
            } catch (err: any) {
                console.error('Error syncing bitolas:', err);
                showNotification(`Erro ao salvar bitolas no Supabase: ${err.message || err}`, 'error');
            }
        };
        syncBitolas();
    }, [bitolas, isLoadingData]);

    // Supabase Sync for Arame
    useEffect(() => {
        if (isLoadingData) return;
        const syncArame = async () => {
            try {
                const { data, error } = await supabase.from('config_arame').select('id').limit(1).maybeSingle();
                if (error) throw error;

                if (data) {
                    await updateItem('config_arame', data.id, arameConfig);
                } else {
                    await insertItem('config_arame', arameConfig);
                }
                prevArameRef.current = arameConfig;
            } catch (err: any) {
                console.error('Error syncing arame config:', err);
                showNotification(`Erro ao salvar config de arame no Supabase: ${err.message || err}`, 'error');
            }
        };
        syncArame();
    }, [arameConfig, isLoadingData]);

    // Supabase Sync for Estribo Models
    useEffect(() => {
        if (isLoadingData) return;
        const syncEstribos = async () => {
            try {
                const changed = estriboModels.filter(m => {
                    const prev = prevEstribosRef.current.find(pm => pm.id === m.id);
                    if (!prev) return true;
                    return JSON.stringify(m) !== JSON.stringify(prev);
                });
                for (const m of changed) {
                    await supabase.from('model_estribos').upsert({
                        id: m.id, name: m.name, category: m.category, formula: m.formula,
                        required_sides: m.requiredSides || [],
                        svg_template: m.svgTemplate || null,
                        custom_image_url: m.customImageBase64 || null,
                        custom_drawing_data: m.customDrawingData || null,
                        applications: m.applications || [],
                    }, { onConflict: 'id' });
                }
                const deleted = prevEstribosRef.current.filter(pm => !estriboModels.some(m => m.id === pm.id));
                for (const pm of deleted) {
                    await deleteItem('model_estribos', pm.id);
                }
                prevEstribosRef.current = estriboModels;
            } catch (err: any) {
                console.error('Error syncing estribo models:', err);
                showNotification(`Erro ao salvar modelos de estribos no Supabase: ${err.message || err}`, 'error');
            }
        };
        syncEstribos();
    }, [estriboModels, isLoadingData]);

    // Supabase Sync for Ferro Models
    useEffect(() => {
        if (isLoadingData) return;
        const syncFerros = async () => {
            try {
                const changed = ferroModels.filter(m => {
                    const prev = prevFerrosRef.current.find(pm => pm.id === m.id);
                    if (!prev) return true;
                    return JSON.stringify(m) !== JSON.stringify(prev);
                });
                for (const m of changed) {
                    await supabase.from('model_ferros').upsert({
                        id: m.id, name: m.name, formula: m.formula,
                        required_sides: m.requiredSides || [],
                        custom_image_url: m.customImageBase64 || null,
                        custom_drawing_data: m.customDrawingData || null,
                    }, { onConflict: 'id' });
                }
                const deleted = prevFerrosRef.current.filter(pm => !ferroModels.some(m => m.id === pm.id));
                for (const pm of deleted) {
                    await deleteItem('model_ferros', pm.id);
                }
                prevFerrosRef.current = ferroModels;
            } catch (err: any) {
                console.error('Error syncing ferro models:', err);
                showNotification(`Erro ao salvar modelos de ferros no Supabase: ${err.message || err}`, 'error');
            }
        };
        syncFerros();
    }, [ferroModels, isLoadingData]);

    // Supabase Sync for Trava Models
    useEffect(() => {
        if (isLoadingData) return;
        const syncTravas = async () => {
            try {
                const changed = travaModels.filter(m => {
                    const prev = prevTravasRef.current.find(pm => pm.id === m.id);
                    if (!prev) return true;
                    return JSON.stringify(m) !== JSON.stringify(prev);
                });
                for (const m of changed) {
                    await supabase.from('model_travas').upsert({
                        id: m.id, name: m.name, formula: m.formula,
                        required_sides: m.requiredSides || [],
                        shape_id: m.shapeId || 1,
                        custom_image_url: m.customImageBase64 || null,
                        custom_drawing_data: m.customDrawingData || null,
                    }, { onConflict: 'id' });
                }
                const deleted = prevTravasRef.current.filter(pm => !travaModels.some(m => m.id === pm.id));
                for (const pm of deleted) {
                    await deleteItem('model_travas', pm.id);
                }
                prevTravasRef.current = travaModels;
            } catch (err: any) {
                console.error('Error syncing trava models:', err);
                showNotification(`Erro ao salvar modelos de travas no Supabase: ${err.message || err}`, 'error');
            }
        };
        syncTravas();
    }, [travaModels, isLoadingData]);

    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [settingsTab, setSettingsTab] = useState<'bitolas' | 'estribos' | 'ferros' | 'arame' | 'travas'>('bitolas');

    // Filter & Order State
    const [search, setSearch] = useState('');
    const [orderBy, setOrderBy] = useState<'id' | 'clientCode'>('id');
    const [isAddOpen, setIsAddOpen] = useState(false);

    // Modals control
    const [activeModal, setActiveModal] = useState<{
        type: 'client' | 'salesperson' | 'notes' | 'products' | 'price' | 'duplicate' | 'print' | 'printFull' | 'printSteel' | 'print_orcamento' | 'checkout' | 'history' | 'delete' | 'export_production' | 'post_export' | 'print_corte' | 'print_etiqueta_maquina' | 'cd_anexar_desenho' | 'cd_alterar_bitolas';
        quoteId: string;
    } | null>(null);

    // Label Config State
    const [labelScale, setLabelScale] = useState(() => {
        const saved = localStorage.getItem('msm_label_scale');
        return saved ? parseFloat(saved) : 2.25;
    });
    const [labelHeight, setLabelHeight] = useState(() => {
        const saved = localStorage.getItem('msm_label_height');
        return saved ? parseInt(saved, 10) : 320;
    });
    const [labelWidth, setLabelWidth] = useState(() => {
        const saved = localStorage.getItem('msm_label_width');
        return saved ? parseInt(saved, 10) : 448; // equivalent to max-w-md
    });
    const [isLabelConfigOpen, setIsLabelConfigOpen] = useState(false);

    useEffect(() => {
        localStorage.setItem('msm_label_scale', labelScale.toString());
        localStorage.setItem('msm_label_height', labelHeight.toString());
        localStorage.setItem('msm_label_width', labelWidth.toString());
    }, [labelScale, labelHeight, labelWidth]);

    // Check for pending print actions from other screens
    useEffect(() => {
        if (isLoadingData) return;
        
        const pendingActionStr = sessionStorage.getItem('pending_print_action');
        if (pendingActionStr) {
            try {
                const actionData = JSON.parse(pendingActionStr);
                sessionStorage.removeItem('pending_print_action');
                if (actionData && actionData.type && actionData.quoteId) {
                    setActiveModal(actionData);
                }
            } catch (e) {
                console.error("Error parsing pending_print_action", e);
            }
        }
    }, [isLoadingData]);

    // Track previous modal state to know when it closes
    const prevModalRef = useRef(activeModal);

    // Check if we need to return to another screen after closing the modal
    useEffect(() => {
        // Only trigger if a modal WAS open and is NOW closed
        if (activeModal === null && prevModalRef.current !== null) {
            const returnTo = sessionStorage.getItem('return_to_after_print');
            if (returnTo) {
                sessionStorage.removeItem('return_to_after_print');
                if (returnTo === 'machineSchedule') {
                    window.dispatchEvent(new Event('navigate_to_programarMaquinas'));
                }
            }
        }
        prevModalRef.current = activeModal;
    }, [activeModal]);

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

    // Coluna / Structural sub-modal states
    const [showColunaModal, setShowColunaModal] = useState(false);
    const [structuralCategory, setStructuralCategory] = useState('COLUNA');
    const [colunaName, setColunaName] = useState('');
    const [colunaQtde, setColunaQtde] = useState('');
    const [colunaTipoAmarracao, setColunaTipoAmarracao] = useState<'AMARRADA' | 'SOLDADA'>('AMARRADA');
    const [colunaQtdeLados, setColunaQtdeLados] = useState('4 LADOS');
    const [colunaAreaSemEstr1, setColunaAreaSemEstr1] = useState('');
    const [colunaAreaSemEstr2, setColunaAreaSemEstr2] = useState('');
    const [colunaObs, setColunaObs] = useState('');


    // Sapata sub-modal states
    const [showSapataModal, setShowSapataModal] = useState(false);
    const [sapataName, setSapataName] = useState('');
    const [sapataQtde, setSapataQtde] = useState('');
    const [sapataTipo, setSapataTipo] = useState<'FECHADA' | 'ABERTA'>('FECHADA');
    const [sapataLength, setSapataLength] = useState('');
    const [sapataWidth, setSapataWidth] = useState('');
    const [sapataHeight, setSapataHeight] = useState('');
    const [sapataObs, setSapataObs] = useState('');
    const [editingSapataId, setEditingSapataId] = useState<string | null>(null);

    // Corte e Dobra sub-modal states
    const [showCorteDobraModal, setShowCorteDobraModal] = useState(false);
    const [corteDobraName, setCorteDobraName] = useState('');
    const [corteDobraObs, setCorteDobraObs] = useState('');
    const [editingCorteDobraId, setEditingCorteDobraId] = useState<string | null>(null);

    // Ferros Principais sub-modal states
    const [showFerrosModal, setShowFerrosModal] = useState(false);
    const [ferroTargetProdIdx, setFerroTargetProdIdx] = useState(-1);
    const [ferroTargetColunaNome, setFerroTargetColunaNome] = useState('');
    const [ferroNomeElemento, setFerroNomeElemento] = useState('');
    const [ferroQtde, setFerroQtde] = useState('');
    const [ferroBitola, setFerroBitola] = useState('');
    const [ferroModelId, setFerroModelId] = useState('');
    const [ferroLadoA, setFerroLadoA] = useState('');
    const [ferroLadoB, setFerroLadoB] = useState('');
    const [ferroLadoC, setFerroLadoC] = useState('');
    const [ferroLadoD, setFerroLadoD] = useState('');
    const [ferroLadoE, setFerroLadoE] = useState('');
    const [ferroLadoF, setFerroLadoF] = useState('');
    const [ferroObs, setFerroObs] = useState('');

    // Estribos sub-modal states
    const [showEstribosModal, setShowEstribosModal] = useState(false);
    const [estriboTargetProdIdx, setEstriboTargetProdIdx] = useState(-1);
    const [estriboTargetColunaNome, setEstriboTargetColunaNome] = useState('');
    const [estriboNomeElemento, setEstriboNomeElemento] = useState('');
    const [estriboEspacamento, setEstriboEspacamento] = useState('');
    const [estriboQtde, setEstriboQtde] = useState('');
    const [estriboBitola, setEstriboBitola] = useState('');
    const [estriboCalcAutomatico, setEstriboCalcAutomatico] = useState(false);
    const [estriboShapeType, setEstriboShapeType] = useState('Padrão');
    const [estriboLadoA, setEstriboLadoA] = useState('');
    const [estriboLadoB, setEstriboLadoB] = useState('');
    const [estriboLadoC, setEstriboLadoC] = useState('');
    const [estriboLadoD, setEstriboLadoD] = useState('');
    const [estriboLadoE, setEstriboLadoE] = useState('');
    const [estriboLadoF, setEstriboLadoF] = useState('');
    const [estriboObs, setEstriboObs] = useState('');

    // Trava sub-modal states
    const [showTravaModal, setShowTravaModal] = useState(false);
    const [travaTargetProdIdx, setTravaTargetProdIdx] = useState(-1);
    const [travaTargetColunaNome, setTravaTargetColunaNome] = useState('');
    const [travaEditId, setTravaEditId] = useState<string | null>(null);
    const [travaShapeId, setTravaShapeId] = useState(1);
    const [travaNomeElemento, setTravaNomeElemento] = useState('TRAVA');
    const [travaQtde, setTravaQtde] = useState('');
    const [travaBitola, setTravaBitola] = useState('');
    const [travaLadoA, setTravaLadoA] = useState('');
    const [travaLadoB, setTravaLadoB] = useState('');
    const [travaLadoC, setTravaLadoC] = useState('');
    const [travaLadoD, setTravaLadoD] = useState('');
    const [travaLadoE, setTravaLadoE] = useState('');
    const [travaObs, setTravaObs] = useState('');

    const [settingsEstriboArea, setSettingsEstriboArea] = useState('Coluna');
    const [settingsEstriboCat, setSettingsEstriboCat] = useState('4 LADOS');
    const [drawingBoardTarget, setDrawingBoardTarget] = useState<EstriboModel | null>(null);
    const [ferroDrawingBoardTarget, setFerroDrawingBoardTarget] = useState<FerroModel | null>(null);
    const [travaDrawingBoardTarget, setTravaDrawingBoardTarget] = useState<TravaModel | null>(null);

    const [editingColunaId, setEditingColunaId] = useState<string | null>(null);
    const [ferroModalTitle, setFerroModalTitle] = useState('Ferros Principais');
    const [ferroEditId, setFerroEditId] = useState<string | null>(null);

    // Corte e Dobra elements states
    const [openActionDropdownId, setOpenActionDropdownId] = useState<string | null>(null);
    const [showElementoModal, setShowElementoModal] = useState(false);
    const [elementoTargetProdIdx, setElementoTargetProdIdx] = useState(-1);
    const [elementoTargetGroupNome, setElementoTargetGroupNome] = useState('');
    const [elementoNomeElemento, setElementoNomeElemento] = useState('');
    const [elementoQtde, setElementoQtde] = useState('');
    const [elementoBitola, setElementoBitola] = useState('');
    const [elementoShapeId, setElementoShapeId] = useState('');
    const [elementoLadoA, setElementoLadoA] = useState('');
    const [elementoLadoB, setElementoLadoB] = useState('');
    const [elementoLadoC, setElementoLadoC] = useState('');
    const [elementoLadoD, setElementoLadoD] = useState('');
    const [elementoLadoE, setElementoLadoE] = useState('');
    const [elementoLadoF, setElementoLadoF] = useState('');
    const [elementoObs, setElementoObs] = useState('');
    const [elementoEditId, setElementoEditId] = useState<string | null>(null);

    // Alterar Bitolas states
    const [showAlterarBitolasModal, setShowAlterarBitolasModal] = useState(false);
    const [alterarBitolasTargetIdx, setAlterarBitolasTargetIdx] = useState(-1);
    const [alterarBitolasValue, setAlterarBitolasValue] = useState('');

    // Anexar Desenho / Attachment Preview states
    const [showPreviewAttachmentModal, setShowPreviewAttachmentModal] = useState(false);
    const [previewAttachmentName, setPreviewAttachmentName] = useState('');
    const [previewAttachmentData, setPreviewAttachmentData] = useState('');
    const [anexarDesenhoTargetIdx, setAnexarDesenhoTargetIdx] = useState(-1);



    const getTravaRequiredSides = (shape: number) => {
        const model = (travaModels || []).find(m => m.shapeId === shape);
        if (model) return model.requiredSides;
        switch(shape) {
            case 1: return ['A'];
            case 2: return ['A', 'B', 'C'];
            case 3: return ['A', 'B', 'C'];
            case 4: return ['A', 'B', 'C'];
            case 5: return ['A', 'B'];
            case 6: return ['A', 'B', 'C'];
            case 7: return ['A', 'B', 'C'];
            case 8: return ['A', 'B', 'C', 'D', 'E'];
            default: return ['A'];
        }
    };

    const renderTravaSVG = (shape: number, A?: string, B?: string, C?: string, D?: string, E?: string) => {
        const W = 100;
        const H = 60;
        let p = '';
        const labels = [];
        
        switch (shape) {
            case 1:
                p = "M 10,30 L 90,30";
                labels.push({ x: 50, y: 20, t: 'A', v: A });
                break;
            case 2:
                p = "M 10,45 L 30,45 L 30,15 L 70,15 L 70,45 L 90,45";
                labels.push({ x: 20, y: 55, t: 'A', v: A });
                labels.push({ x: 20, y: 30, t: 'B', v: B });
                labels.push({ x: 50, y: 10, t: 'C', v: C });
                break;
            case 3:
                p = "M 30,30 L 20,30 L 20,50 L 80,50 L 80,30 L 70,30";
                labels.push({ x: 25, y: 25, t: 'A', v: A });
                labels.push({ x: 10, y: 40, t: 'B', v: B });
                labels.push({ x: 50, y: 45, t: 'C', v: C });
                break;
            case 4:
                p = "M 10,50 L 40,50 L 60,10 L 90,10";
                labels.push({ x: 25, y: 58, t: 'C', v: C });
                labels.push({ x: 40, y: 30, t: 'B', v: B });
                labels.push({ x: 75, y: 5, t: 'A', v: A });
                break;
            case 5:
                p = "M 10,40 L 10,20 L 90,20";
                labels.push({ x: 5, y: 30, t: 'B', v: B });
                labels.push({ x: 50, y: 15, t: 'A', v: A });
                break;
            case 6:
                p = "M 20,15 L 20,45 L 80,45 L 80,15";
                labels.push({ x: 10, y: 30, t: 'A', v: A });
                labels.push({ x: 50, y: 55, t: 'B', v: B });
                labels.push({ x: 90, y: 30, t: 'C', v: C });
                break;
            case 7:
                p = "M 10,45 L 40,45 L 60,15 L 90,15";
                labels.push({ x: 25, y: 55, t: 'A', v: A });
                labels.push({ x: 50, y: 25, t: 'B', v: B });
                labels.push({ x: 75, y: 25, t: 'C', v: C });
                break;
            case 8:
                p = "M 10,45 L 30,45 L 30,15 L 70,15 L 70,45 L 90,45";
                labels.push({ x: 20, y: 55, t: 'A', v: A });
                labels.push({ x: 20, y: 30, t: 'B', v: B });
                labels.push({ x: 50, y: 10, t: 'C', v: C });
                labels.push({ x: 80, y: 30, t: 'D', v: D });
                labels.push({ x: 80, y: 55, t: 'E', v: E });
                break;
        }

        return (
            <svg viewBox={"0 0 " + W + " " + H} className="w-full h-full min-h-[40px] max-h-[80px] overflow-visible">
                <path d={p} stroke="#1e293b" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                {labels.map((lbl, i) => (
                    <text key={i} x={lbl.x} y={lbl.y} fontSize="8" fontWeight="bold" fill="#dc2626" textAnchor="middle">
                        {lbl.v || lbl.t}
                    </text>
                ))}
            </svg>
        );
    };

    const renderEstriboSVG = (lados: string, shapeType?: string, A?: string, B?: string, C?: string, D?: string, E?: string, F?: string, customModelsList?: any[]) => {
        const fs = 14;
        
        const modelsToSearch = customModelsList || estriboModels;
        const model = modelsToSearch.find(m => m.id === shapeType || (m.name === shapeType && (m as any).category === lados));
        let template = shapeType;
        let effectiveLados = lados;
        
        if (model) {
            if (model.customDrawingData && model.customDrawingData.points) {
                const { points, labels } = model.customDrawingData;
                return (
                    <svg viewBox="0 0 400 400" className="w-full h-full max-h-[120px] overflow-visible" xmlns="http://www.w3.org/2000/svg">
                        {points.length > 0 && (
                            <polyline 
                                points={points.map(p => `${p.x},${p.y}`).join(' ')} 
                                fill="none" 
                                stroke="#1e293b" 
                                strokeWidth="12"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        )}
                        {labels.map((l, i) => {
                            let val = l.text;
                            if (l.text === 'A') val = A || 'A';
                            else if (l.text === 'B') val = B || 'B';
                            else if (l.text === 'C') val = C || 'C';
                            else if (l.text === 'D') val = D || 'D';
                            else if (l.text === 'E') val = E || 'E';
                            else if (l.text === 'F') val = F || 'F';

                            return (
                                <g key={i} transform={`translate(${l.x}, ${l.y})`}>
                                    <text x="0" y="12" textAnchor="middle" fontSize="38" fontWeight="bold" fill="#1e293b">{val}</text>
                                </g>
                            );
                        })}
                    </svg>
                );
            }

            if (model.customImageBase64) {
                return (
                    <img src={model.customImageBase64} alt="Estribo Customizado" className="w-full h-full max-h-[120px] object-contain" />
                );
            }
            template = model.svgTemplate;
            if (template === 'padrao_4_lados') { effectiveLados = '4 LADOS'; template = 'Padrão'; }
            else if (template === 'formato_l') { effectiveLados = '4 LADOS'; template = 'L'; }
            else if (template === 'formato_reto') { effectiveLados = '4 LADOS'; template = 'Reto'; }
            else if (template === 'formato_u') { effectiveLados = '4 LADOS'; template = 'U'; }
            else if (template === 'padrao_3_lados') { effectiveLados = '3 LADOS'; template = 'Padrão'; }
            else if (template === 'redonda_padrao') { effectiveLados = 'REDONDA'; template = 'Padrão'; }
            else if (template === 'generico') { effectiveLados = '4 LADOS'; template = 'Especial'; }
        }
        
        if (effectiveLados === '3 LADOS') {
            return (
                <svg viewBox="0 0 160 160" className="w-full h-full max-h-[120px] overflow-visible" xmlns="http://www.w3.org/2000/svg">
                    <polygon points="80,30 30,120 130,120" fill="none" stroke="#777" strokeWidth="4" />
                    <text x="115" y="70" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{A || 'A'}</text>
                    <text x="80" y="140" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{B || 'B'}</text>
                </svg>
            );
        }
        
        if (effectiveLados === '4 LADOS') {
            if (template === 'L') {
                return (
                    <svg viewBox="0 0 160 160" className="w-full h-full max-h-[120px] overflow-visible" xmlns="http://www.w3.org/2000/svg">
                        <path d="M 40,40 L 40,120 L 120,120" fill="none" stroke="#777" strokeWidth="4" strokeLinejoin="round" />
                        <text x="80" y="140" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{A || 'A'}</text>
                        <text x="25" y="80" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{B || 'B'}</text>
                    </svg>
                );
            }
            if (template === 'Reto') {
                return (
                    <svg viewBox="0 0 160 160" className="w-full h-full max-h-[120px] overflow-visible" xmlns="http://www.w3.org/2000/svg">
                        <line x1="30" y1="80" x2="130" y2="80" stroke="#777" strokeWidth="4" />
                        <text x="80" y="70" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{A || 'A'}</text>
                    </svg>
                );
            }
            if (template === 'Padrão') {
                const heightVal = C || B || 'C';
                return (
                    <svg viewBox="0 0 160 160" className="w-full h-full max-h-[120px] overflow-visible" xmlns="http://www.w3.org/2000/svg">
                        <rect x="45" y="45" width="70" height="70" rx="4" fill="none" stroke="#777" strokeWidth="4" />
                        <text x="80" y="35" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{A || 'A'}</text>
                        <text x="80" y="135" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{A || 'A'}</text>
                        <text x="25" y="85" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{heightVal}</text>
                        <text x="130" y="85" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{heightVal}</text>
                    </svg>
                );
            }
            if (template === 'U') {
                return (
                    <svg viewBox="0 0 160 160" className="w-full h-full max-h-[120px] overflow-visible" xmlns="http://www.w3.org/2000/svg">
                        <path d="M 45,50 L 45,115 L 115,115 L 115,50" fill="none" stroke="#777" strokeWidth="4" strokeLinejoin="round" />
                        <text x="80" y="135" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{A || 'A'}</text>
                        <text x="25" y="85" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{C || 'C'}</text>
                        <text x="130" y="85" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{C || 'C'}</text>
                    </svg>
                );
            }
            if (template === 'U Dobras Ext') {
                return (
                    <svg viewBox="0 0 160 160" className="w-full h-full max-h-[120px] overflow-visible" xmlns="http://www.w3.org/2000/svg">
                        <path d="M 30,50 L 50,50 L 50,115 L 110,115 L 110,50 L 130,50" fill="none" stroke="#777" strokeWidth="4" strokeLinejoin="round" />
                        <text x="80" y="135" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{A || 'A'}</text>
                        <text x="35" y="85" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{C || 'C'}</text>
                        <text x="125" y="85" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{C || 'C'}</text>
                        <text x="120" y="40" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{D || 'D'}</text>
                        <text x="40" y="40" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{D || 'D'}</text>
                    </svg>
                );
            }
            if (template === 'U Dobras Int') {
                return (
                    <svg viewBox="0 0 160 160" className="w-full h-full max-h-[120px] overflow-visible" xmlns="http://www.w3.org/2000/svg">
                        <path d="M 65,50 L 50,50 L 50,115 L 110,115 L 110,50 L 95,50" fill="none" stroke="#777" strokeWidth="4" strokeLinejoin="round" />
                        <text x="80" y="135" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{A || 'A'}</text>
                        <text x="35" y="85" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{C || 'C'}</text>
                        <text x="125" y="85" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{C || 'C'}</text>
                        <text x="102" y="40" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{D || 'D'}</text>
                        <text x="58" y="40" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#f00">{E || 'E'}</text>
                    </svg>
                );
            }
            if (template === 'Especial') {
                return (
                    <svg viewBox="0 0 160 160" className="w-full h-full max-h-[120px] overflow-visible" xmlns="http://www.w3.org/2000/svg">
                        <path d="M 25,70 L 40,70 L 40,115 L 65,115 L 65,50 L 95,50 L 95,115 L 120,115 L 120,70 L 135,70" fill="none" stroke="#777" strokeWidth="4" strokeLinejoin="round" />
                        <text x="110" y="130" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{A || 'A'}</text>
                        <text x="135" y="95" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{B || 'B'}</text>
                        <text x="80" y="40" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{C || 'C'}</text>
                        <text x="128" y="60" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{D || 'D'}</text>
                        <text x="32" y="60" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#f00">{E || 'E'}</text>
                        <text x="53" y="85" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{F || 'F'}</text>
                    </svg>
                );
            }
            if (template === 'Padrão, definir dobras finais') {
                return (
                    <svg viewBox="0 0 160 160" className="w-full h-full max-h-[120px] overflow-visible" xmlns="http://www.w3.org/2000/svg">
                        <rect x="50" y="50" width="70" height="70" rx="4" fill="none" stroke="#777" strokeWidth="4" />
                        <text x="85" y="140" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{A || 'A'}</text>
                        <text x="135" y="90" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{B || 'B'}</text>
                        <path d="M 50,50 L 30,50" fill="none" stroke="#f00" strokeWidth="3" strokeDasharray="4,3" />
                        <path d="M 50,50 L 50,30" fill="none" stroke="#f00" strokeWidth="3" strokeDasharray="4,3" />
                        <text x="35" y="40" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#f00">{C || 'C'}</text>
                    </svg>
                );
            }
            if (template === 'Transpasse em X') {
                return (
                    <svg viewBox="0 0 160 160" className="w-full h-full max-h-[120px] overflow-visible" xmlns="http://www.w3.org/2000/svg">
                        <rect x="50" y="50" width="70" height="70" rx="4" fill="none" stroke="#777" strokeWidth="4" />
                        <path d="M 50,50 L 25,50" fill="none" stroke="#f00" strokeWidth="3" strokeDasharray="4,3" />
                        <path d="M 50,50 L 50,25" fill="none" stroke="#f00" strokeWidth="3" strokeDasharray="4,3" />
                        <text x="85" y="140" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{A || 'A'}</text>
                        <text x="135" y="90" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{B || 'B'}</text>
                        <text x="85" y="20" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#f00">{C || 'C'}</text>
                        <text x="20" y="90" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#f00">{D || 'D'}</text>
                    </svg>
                );
            }
            if (template === 'Estribo de travamento') {
                return (
                    <svg viewBox="0 0 160 160" className="w-full h-full max-h-[120px] overflow-visible" xmlns="http://www.w3.org/2000/svg">
                        <path d="M 50,70 L 50,110 L 110,110 L 110,70" fill="none" stroke="#777" strokeWidth="4" strokeLinejoin="round" />
                        <path d="M 110,70 L 80,70 L 80,90" fill="none" stroke="#777" strokeWidth="4" strokeLinejoin="round" />
                        <path d="M 50,70 L 50,50 L 70,50" fill="none" stroke="#777" strokeWidth="4" strokeLinejoin="round" />
                        <text x="125" y="95" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{A || 'A'}</text>
                        <text x="80" y="130" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{B || 'B'}</text>
                        <text x="65" y="40" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{C || 'C'}</text>
                        <text x="95" y="60" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{D || 'D'}</text>
                    </svg>
                );
            }
            if (template === 'Estribo de travamento 2') {
                return (
                    <svg viewBox="0 0 160 160" className="w-full h-full max-h-[120px] overflow-visible" xmlns="http://www.w3.org/2000/svg">
                        <path d="M 45,60 L 45,115 L 115,115 L 115,45 L 60,45" fill="none" stroke="#777" strokeWidth="4" strokeLinejoin="round" />
                        <path d="M 45,60 L 60,75" fill="none" stroke="#777" strokeWidth="4" />
                        <path d="M 60,45 L 45,30" fill="none" stroke="#f00" strokeWidth="3" strokeDasharray="4,3" />
                        <text x="80" y="135" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{A || 'A'}</text>
                        <text x="130" y="85" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{B || 'B'}</text>
                        <text x="80" y="35" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{C || 'C'}</text>
                        <text x="30" y="90" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{D || 'D'}</text>
                        <text x="40" y="20" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#f00">{E || 'E'}</text>
                    </svg>
                );
            }
            return (
                <svg viewBox="0 0 160 160" className="w-full h-full max-h-[120px] overflow-visible" xmlns="http://www.w3.org/2000/svg">
                    <rect x="45" y="45" width="70" height="70" rx="4" fill="none" stroke="#777" strokeWidth="4" />
                    <text x="80" y="35" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{A || 'A'}</text>
                    <text x="80" y="135" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{A || 'A'}</text>
                    <text x="25" y="85" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{B || 'B'}</text>
                    <text x="130" y="85" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{B || 'B'}</text>
                </svg>
            );
        }

        if (effectiveLados === '6 LADOS') {
            return (
                <svg viewBox="0 0 160 160" className="w-full h-full max-h-[120px] overflow-visible" xmlns="http://www.w3.org/2000/svg">
                    <polygon points="50,30 110,30 140,80 110,130 50,130 20,80" fill="none" stroke="#777" strokeWidth="4" />
                    <text x="80" y="20" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{A || 'A'}</text>
                    <text x="135" y="45" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{B || 'B'}</text>
                    <text x="135" y="125" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{C || 'C'}</text>
                </svg>
            );
        }

        if (effectiveLados === '8 LADOS') {
            return (
                <svg viewBox="0 0 160 160" className="w-full h-full max-h-[120px] overflow-visible" xmlns="http://www.w3.org/2000/svg">
                    <polygon points="60,20 100,20 130,50 130,90 100,120 60,120 30,90 30,50" fill="none" stroke="#777" strokeWidth="4" />
                    <text x="80" y="10" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{A || 'A'}</text>
                    <text x="125" y="30" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{B || 'B'}</text>
                    <text x="145" y="75" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{C || 'C'}</text>
                    <text x="125" y="115" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{D || 'D'}</text>
                </svg>
            );
        }

        if (effectiveLados === 'REDONDA') {
            if (template === 'Definir transpasse') {
                return (
                    <svg viewBox="0 0 160 160" className="w-full h-full max-h-[120px] overflow-visible" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="80" cy="80" r="50" fill="none" stroke="#777" strokeWidth="4" />
                        <path d="M 128,65 A 55,55 0 0,1 128,95" fill="none" stroke="#f00" strokeWidth="4" strokeDasharray="4,3" />
                        <text x="80" y="20" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{A || 'A'}</text>
                        <text x="145" y="85" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{B || 'B'}</text>
                    </svg>
                );
            }
            if (template === 'Transpasse Dobrado') {
                return (
                    <svg viewBox="0 0 160 160" className="w-full h-full max-h-[120px] overflow-visible" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="80" cy="80" r="50" fill="none" stroke="#777" strokeWidth="4" />
                        <path d="M 125,55 A 40,40 0 0,1 125,105" fill="none" stroke="#f00" strokeWidth="4" strokeDasharray="4,3" />
                        <path d="M 128,65 L 110,65" fill="none" stroke="#f00" strokeWidth="4" strokeDasharray="4,3" />
                        <path d="M 128,95 L 110,95" fill="none" stroke="#f00" strokeWidth="4" strokeDasharray="4,3" />
                        <text x="80" y="20" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{A || 'A'}</text>
                        <text x="145" y="85" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{B || 'B'}</text>
                        <text x="100" y="85" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{C || 'C'}</text>
                    </svg>
                );
            }
            return (
                <svg viewBox="0 0 160 160" className="w-full h-full max-h-[120px] overflow-visible" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="80" cy="80" r="50" fill="none" stroke="#777" strokeWidth="4" />
                    <text x="80" y="20" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{A || 'A'}</text>
                </svg>
            );
        }

        return null;
    };

    const getFerroTotalLengthCm = (ferro: FerroItem, colDescription: string): number => {
        const a = parseFloat(ferro.ladoA) || 0;
        const b = parseFloat(ferro.ladoB) || 0;
        const c = parseFloat(ferro.ladoC) || 0;
        const d = parseFloat(ferro.ladoD) || 0;
        const e = parseFloat(ferro.ladoE) || 0;
        
        if (ferro.drawingType === 'Estribo' || ferro.drawingType === 'CorteDobra') {
            const shapeType = ferro.estriboShape || 'Padrão';
            const m = colDescription.match(/(\d+ LADOS|REDONDA)/);
            const ladosDesc = m ? m[1] : '4 LADOS';
            
            const model = estriboModels.find(m => m.id === shapeType || (m.name === shapeType && m.category === ladosDesc));
            
            if (model) {
                const f = parseFloat(ferro.ladoF) || 0;
                try {
                    let expression = model.formula
                        .replace(/Math\.PI/g, Math.PI.toString())
                        .replace(/\bA\b/g, a.toString())
                        .replace(/\bB\b/g, b.toString())
                        .replace(/\bC\b/g, c.toString())
                        .replace(/\bD\b/g, d.toString())
                        .replace(/\bE\b/g, e.toString())
                        .replace(/\bF\b/g, f.toString());
                    return new Function('return ' + expression)() || 0;
                } catch (err) {
                    console.error("Erro ao avaliar fórmula de estribo", model.formula, err);
                    return 0;
                }
            } else {
                // Fallback safe defaults if model not found
                if (ladosDesc === 'REDONDA') return (a * Math.PI) + 15;
                if (ladosDesc === '3 LADOS') return a + (b * 2) + 10;
                return (a * 2) + (b * 2) + 10; // Default 4 Lados
            }
        }
        
        if (ferro.drawingType === 'Trava') {
            const shape = Number(ferro.estriboShape) || 1;
            const model = (travaModels || []).find(m => m.shapeId === shape);
            if (model) {
                try {
                    let expression = model.formula
                        .replace(/Math\.PI/g, Math.PI.toString())
                        .replace(/\bA\b/g, a.toString())
                        .replace(/\bB\b/g, b.toString())
                        .replace(/\bC\b/g, c.toString())
                        .replace(/\bD\b/g, d.toString())
                        .replace(/\bE\b/g, e.toString());
                    return new Function('return ' + expression)() || 0;
                } catch (err) {
                    console.error("Erro ao avaliar fórmula de trava", model.formula, err);
                }
            }
            switch(shape) {
                case 1: return a;
                case 2: return a + b + c;
                case 3: return a + b + c;
                case 4: return a + b + c;
                case 5: return a + b;
                case 6: return a + b + c;
                case 7: return a + b + c;
                case 8: return a + b + c + d + e;
                default: return a;
            }
        }
        
        // Regular ferros
        const ferroModel = ferroModels.find(m => m.id === ferro.ferroModelId);
        if (ferroModel) {
            const f = parseFloat(ferro.ladoF) || 0;
            try {
                let expression = ferroModel.formula
                    .replace(/Math\.PI/g, Math.PI.toString())
                    .replace(/\bA\b/g, a.toString())
                    .replace(/\bB\b/g, b.toString())
                    .replace(/\bC\b/g, c.toString())
                    .replace(/\bD\b/g, d.toString())
                    .replace(/\bE\b/g, e.toString())
                    .replace(/\bF\b/g, f.toString());
                return new Function('return ' + expression)() || 0;
            } catch (err) {
                console.error("Erro ao avaliar fórmula de ferro", ferroModel.formula, err);
            }
        }

        return a + b + c + d + e;
    };



    const recalcProduct = (p: ProductItem): ProductItem => {
        if (!p.ferros || p.ferros.length === 0) {
            return Object.assign({}, p, { length: 0, weight: 0, price: 0 });
        }
        
        let totalKg = 0;
        let totalPrice = 0;
        let principalLength = 0;
        
        p.ferros.forEach(f => {
            const totalCm = getFerroTotalLengthCm(f, p.description);
            const factor = f.bitolaKgm || parseFloat((f.bitola || '').split(',')[1]) || 0;
            const priceFactor = f.bitolaPrice || parseFloat((f.bitola || '').split(',')[2]) || 0;
            const weight = (totalCm / 100) * factor * f.qtde;
            totalKg += weight;
            totalPrice += weight * priceFactor;
            
            if (f.drawingType !== 'Estribo' && f.drawingType !== 'Trava') {
                const lenM = (parseFloat(f.ladoA) || 0) / 100;
                if (lenM > principalLength) {
                    principalLength = lenM;
                }
            }
        });
        
        if (principalLength === 0 && p.ferros.length > 0) {
            principalLength = (parseFloat(p.ferros[0].ladoA) || 0) / 100;
        }

        return Object.assign({}, p, {
            length: parseFloat(principalLength.toFixed(2)),
            weight: parseFloat(totalKg.toFixed(2)),
            price: parseFloat((totalPrice > 0 ? totalPrice : (totalKg * 8.5)).toFixed(2))
        });
    };

    const getProfessionalTitle = (item: ProductItem): string => {
        const desc = item.description || '';
        
        const isColuna = desc.startsWith('COLUNA');
        const isPillar = desc.startsWith('PILAR');
        const isViga = desc.startsWith('VIGA');
        const isBroca = desc.startsWith('BROCA');
        const isSapata = desc.startsWith('SAPATA');
        const isStructural = isColuna || isPillar || isViga || isBroca || isSapata;
        
        if (!isStructural) return desc;

        const parts = desc.split(' ');
        let category = parts[0] ? parts[0].toLowerCase() : 'coluna';
        const isPlural = item.qty > 1;

        if (isPlural) {
            if (category === 'pilar') category = 'pilares';
            else if (['coluna', 'viga', 'broca', 'sapata', 'biga'].includes(category)) category += 's';
        }
        
        let name = '';
        let amarracao = 'amarrada';
        let lados = '';
        
        const amarracaoIdx = parts.findIndex(p => p === 'AMARRADA' || p === 'SOLDADA');
        if (amarracaoIdx !== -1) {
            amarracao = parts[amarracaoIdx].toLowerCase();
            name = parts.slice(1, amarracaoIdx).join(' ').toLowerCase();
        } else {
            name = (parts[1] || '').toLowerCase();
            if (name === 'lados' || name.match(/^\d+$/) || name === 'redonda') {
                name = '';
            }
        }

        if (isPlural) {
            if (amarracao === 'amarrada') amarracao = 'amarradas';
            else if (amarracao === 'soldada') amarracao = 'soldadas';
            
            if (name) {
                name = name.split(' ').map(w => {
                    if (w === 'superior') return 'superiores';
                    if (w === 'baldrame') return 'baldrames';
                    return w;
                }).join(' ');
            }
        }

        let lengthText = '';
        if (item.length > 0) {
            lengthText = `c/ ${item.length} metros`;
        } else {
            const principal = (item.ferros || []).find(f => f.drawingType !== 'Estribo' && f.drawingType !== 'Trava');
            if (principal && principal.ladoA) {
                const lenM = (parseFloat(principal.ladoA) || 0) / 100;
                if (lenM > 0) {
                    lengthText = `c/ ${lenM} metros`;
                }
            }
        }

        const estribo = (item.ferros || []).find(f => f.drawingType === 'Estribo');
        let dimText = '';
        let espText = '';
        if (estribo) {
            const ladosIdx = parts.findIndex(p => p.includes('LADOS') || p === 'REDONDA');
            if (ladosIdx !== -1) {
                if (parts[ladosIdx] === 'REDONDA') {
                    lados = 'redonda';
                } else {
                    lados = ((parts[ladosIdx - 1] || '') + ' ' + parts[ladosIdx]).toLowerCase();
                }
            }
            
            if (lados === 'redonda') {
                dimText = estribo.ladoA ? `estribos Ø${estribo.ladoA}` : '';
            } else {
                const a = estribo.ladoA || '';
                const b = estribo.ladoB || '';
                if (a && b) {
                    dimText = `estribos ${a}x${b}`;
                } else if (a) {
                    dimText = `estribos ${a}`;
                }
            }
            
            if (estribo.espacamento) {
                let esp = estribo.espacamento;
                const espNum = parseFloat(esp);
                if (!isNaN(espNum)) {
                   esp = (espNum / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                }
                espText = `esp c/${esp}`;
            }
        }

        let result = category;
        if (name && !['redonda', 'lados'].includes(name)) result += ` ${name}`;
        if (amarracao && !['redonda', 'lados'].includes(amarracao)) result += ` ${amarracao}`;
        if (lengthText) result += ` ${lengthText}`;
        if (dimText) result += `, ${dimText}`;
        if (espText) result += `, ${espText}`;
        
        return result;
    };

    const renderColumnProfileSVG = (lados: string) => {
        const fs = 14;
        if (lados === 'REDONDA') {
            return (
                <svg viewBox="0 0 160 160" className="w-full h-full max-h-[100px] overflow-visible" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="80" cy="80" r="50" fill="none" stroke="#777" strokeWidth="4" />
                    <text x="80" y="20" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">A</text>
                </svg>
            );
        }
        if (lados === '3 LADOS') {
            return (
                <svg viewBox="0 0 160 160" className="w-full h-full max-h-[100px] overflow-visible" xmlns="http://www.w3.org/2000/svg">
                    <polygon points="80,30 30,120 130,120" fill="none" stroke="#777" strokeWidth="4" />
                    <text x="115" y="70" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">A</text>
                    <text x="80" y="140" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">B</text>
                </svg>
            );
        }
        if (lados === '6 LADOS') {
            return (
                <svg viewBox="0 0 160 160" className="w-full h-full max-h-[100px] overflow-visible" xmlns="http://www.w3.org/2000/svg">
                    <polygon points="50,30 110,30 140,80 110,130 50,130 20,80" fill="none" stroke="#777" strokeWidth="4" />
                    <text x="80" y="20" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">A</text>
                    <text x="135" y="45" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">B</text>
                    <text x="135" y="125" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">C</text>
                </svg>
            );
        }
        if (lados === '8 LADOS') {
            return (
                <svg viewBox="0 0 160 160" className="w-full h-full max-h-[100px] overflow-visible" xmlns="http://www.w3.org/2000/svg">
                    <polygon points="60,20 100,20 130,50 130,90 100,120 60,120 30,90 30,50" fill="none" stroke="#777" strokeWidth="4" />
                    <text x="80" y="10" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">A</text>
                    <text x="125" y="30" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">B</text>
                    <text x="145" y="75" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">C</text>
                    <text x="125" y="115" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">D</text>
                </svg>
            );
        }
        // default: 4 LADOS
        return (
            <svg viewBox="0 0 160 160" className="w-full h-full max-h-[100px] overflow-visible" xmlns="http://www.w3.org/2000/svg">
                <rect x="45" y="45" width="70" height="70" rx="4" fill="none" stroke="#777" strokeWidth="4" />
                <text x="80" y="35" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">A</text>
                <text x="130" y="85" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">B</text>
            </svg>
        );
    };

    const renderBarDiagramSVG = (
        modelName: string,
        ladoA: string, ladoB: string, ladoC: string, ladoD: string, ladoE: string,
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
        const midY  = (mainY + topY) / 2;
        const midYb = (mainY + botY) / 2;

        const nameUpper = (modelName || '').toUpperCase();
        
        // Se o nome sugere que vai para fora
        const isFora = nameUpper.includes('FORA');
        
        // Verifica se é afunilado
        const isAful = nameUpper.includes('AFUNILADO');
        
        // Se tem valor numérico nos lados, desenha a respectiva ponta
        const valD = parseFloat(ladoD) || 0;
        const valE = parseFloat(ladoE) || 0;
        
        // Esquerda (Lado D)
        const leftUp   = valD > 0 && !isFora && !isAful;
        const leftDown = valD > 0 && isFora && !isAful;
        const leftAful = valD > 0 && isAful;

        // Direita (Lado E, ou Lado B como fallback para legados)
        const valRight = valE > 0 ? valE : (parseFloat(ladoB) || 0);
        const strRight = valE > 0 ? ladoE : ladoB;
        const rightUp   = valRight > 0 && !isFora && !isAful;
        const rightDown = valRight > 0 && isFora && !isAful;
        const rightAful = valRight > 0 && isAful;

        const isGancho = nameUpper.includes('GANCHO');

        return (
            <svg viewBox={`0 0 ${W} ${H}`} className={small ? 'w-28 h-16' : 'w-44 h-32'} xmlns="http://www.w3.org/2000/svg">
                {/* Main bar */}
                <line x1={lX} y1={mainY} x2={rX} y2={mainY} stroke="#333" strokeWidth="2.5"/>
                {/* A label below */}
                <text x={(lX+rX)/2} y={mainY + fs + 4} textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#444">
                    {ladoA || 'A'}
                </text>

                {/* LEFT arm - goes UP (PARA DENTRO) */}
                {leftUp && <>
                    <line x1={lX} y1={mainY} x2={lX} y2={topY} stroke="#333" strokeWidth="2.5"/>
                    {isGancho && <line x1={lX} y1={topY} x2={lX+hook} y2={topY} stroke="#333" strokeWidth="2.5"/>}
                    <text x={lX-14} y={midY+fs/2} textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#444">
                        {ladoD || 'D'}
                    </text>
                </>}

                {/* LEFT arm - goes DOWN (PARA FORA) */}
                {leftDown && <>
                    <line x1={lX} y1={mainY} x2={lX} y2={botY} stroke="#333" strokeWidth="2.5"/>
                    {isGancho && <line x1={lX} y1={botY} x2={lX+hook} y2={botY} stroke="#333" strokeWidth="2.5"/>}
                    <text x={lX-14} y={midYb+fs/2} textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#444">
                        {ladoD || 'D'}
                    </text>
                </>}

                {/* LEFT - AFUNILADO */}
                {leftAful && <>
                    <line x1={lX} y1={mainY} x2={lX-12} y2={mainY-20} stroke="#333" strokeWidth="2"/>
                    <text x={lX-20} y={mainY-8} textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#444">
                        {ladoD || 'D'}
                    </text>
                </>}

                {/* RIGHT arm - goes UP (PARA DENTRO) */}
                {rightUp && <>
                    <line x1={rX} y1={mainY} x2={rX} y2={topY} stroke="#333" strokeWidth="2.5"/>
                    {isGancho && <line x1={rX} y1={topY} x2={rX-hook} y2={topY} stroke="#333" strokeWidth="2.5"/>}
                    <text x={rX+14} y={midY+fs/2} textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#444">
                        {strRight || 'E'}
                    </text>
                </>}

                {/* RIGHT arm - goes DOWN (PARA FORA) */}
                {rightDown && <>
                    <line x1={rX} y1={mainY} x2={rX} y2={botY} stroke="#333" strokeWidth="2.5"/>
                    {isGancho && <line x1={rX} y1={botY} x2={rX-hook} y2={botY} stroke="#333" strokeWidth="2.5"/>}
                    <text x={rX+14} y={midYb+fs/2} textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#444">
                        {strRight || 'E'}
                    </text>
                </>}

                {/* RIGHT - AFUNILADO */}
                {rightAful && <>
                    <line x1={rX} y1={mainY} x2={rX+12} y2={mainY-20} stroke="#333" strokeWidth="2"/>
                    <text x={rX+20} y={mainY-8} textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#444">
                        {ladoB || 'B'}
                    </text>
                </>}
            </svg>
        );
    };

    // Helper: get ponta description text for table

    // Product list sort state
    const [productSortBy, setProductSortBy] = useState<'date' | 'type' | 'name'>('date');
    const [openDropdownIdx, setOpenDropdownIdx] = useState<number | null>(null);

    // Checkout States
    const [checkoutAcrescimoPercent, setCheckoutAcrescimoPercent] = useState('');
    const [checkoutAcrescimoReal, setCheckoutAcrescimoReal] = useState('');
    const [checkoutDescontoPercent, setCheckoutDescontoPercent] = useState('');
    const [checkoutDescontoReal, setCheckoutDescontoReal] = useState('');
    const [checkoutCondicoesPagamento, setCheckoutCondicoesPagamento] = useState('');
    const [checkoutArameKg, setCheckoutArameKg] = useState('');
    const [checkoutAramePreco, setCheckoutAramePreco] = useState('');
    const [checkoutIncludeArame, setCheckoutIncludeArame] = useState(true);

    const getQuoteTotalPoints = (quote: Quote) => {
        if (!quote || !Array.isArray(quote.products)) return 0;
        return quote.products.reduce((acc, p) => {
            if (!p || !Array.isArray(p.ferros)) return acc;
            const qtdEstribos = p.ferros.filter(f => f && f.nomeElemento && (f.nomeElemento.toUpperCase().includes('ESTRIB') || f.nomeElemento.toUpperCase().includes('TRAVA'))).reduce((sum, f) => sum + (f.qtde || 0), 0);
            const qtdFerros = p.ferros.filter(f => f && f.nomeElemento && (f.nomeElemento.toUpperCase().includes('FERRO') || f.nomeElemento.toUpperCase().includes('COSTELA') || f.nomeElemento.toUpperCase().includes('REFORÇO') || f.nomeElemento.toUpperCase().includes('2ª CAMADA'))).reduce((sum, f) => sum + (f.qtde || 0), 0);
            return acc + (qtdEstribos * qtdFerros * (p.qty || 1));
        }, 0);
    };

    const checkoutData = useMemo(() => {
        if (!activeQuote) return { rows: [], finalTotalPrice: 0, finalTotalPriceAdjusted: 0, finalTotalAcrescimo: 0, finalTotalDesconto: 0 };
        
        const groups: { [key: string]: { bitolaConfig?: BitolaConfig, bitolaStr: string, totalLinearMeters: number, osSet: Set<string> } } = {};
        (activeQuote.products || []).forEach((p, pIdx) => {
            const prodQtde = p.qty || 1;
            (p.ferros || []).forEach(f => {
                const bitolaStr = f.bitola || '';
                const bConfig = (bitolas || []).find(b => bitolaStr.startsWith(b.label));
                const key = bConfig ? bConfig.id : (bitolaStr || 'unknown');
                if (!groups[key]) groups[key] = { bitolaConfig: bConfig, bitolaStr: bitolaStr, totalLinearMeters: 0, osSet: new Set() };
                
                groups[key].osSet.add(p.id || String(pIdx));
                
                const totalCm = getFerroTotalLengthCm(f, p.description);
                groups[key].totalLinearMeters += (totalCm / 100) * (f.qtde || 1) * prodQtde;
            });
        });

        let finalTotalPrice = 0;
        let finalTotalPriceAdjusted = 0;
        
        const aP = parseFloat(checkoutAcrescimoPercent) || 0;
        const aR = parseFloat(checkoutAcrescimoReal) || 0;
        const dP = parseFloat(checkoutDescontoPercent) || 0;
        const dR = parseFloat(checkoutDescontoReal) || 0;

        const rows: any[] = [];
        Object.values(groups).forEach((g) => {
            const exactBars = g.totalLinearMeters / 12;
            const roundedBars = Math.max(1, Math.round(exactBars));
            
            const gaugeMatch = (gauges || []).find(ga => g.bitolaStr === `${ga.materialType} ${ga.gauge}` || g.bitolaStr.startsWith(`${ga.materialType} ${ga.gauge}`));

            const bKgm = gaugeMatch?.weightPerMeter || (g.bitolaConfig ? g.bitolaConfig.kgm : (parseFloat((g.bitolaStr || '').split(',')[1]) || 0));
            const bPrice = gaugeMatch?.purchasePrice || (g.bitolaConfig ? g.bitolaConfig.price : (parseFloat((g.bitolaStr || '').split(',')[2]) || 0));
            const codMerco = gaugeMatch?.productCode || g.bitolaConfig?.codMerco || '';
            const label = gaugeMatch ? `${gaugeMatch.materialType} ${gaugeMatch.gauge}` : (g.bitolaConfig ? g.bitolaConfig.label : (g.bitolaStr || '').split(',')[0] || 'Desconhecida');
            
            const pesoUn = 12 * bKgm;
            const pesoTotal = roundedBars * pesoUn;
            
            let precoUnAjustado = bPrice;
            precoUnAjustado = precoUnAjustado * (1 + (aP / 100)) + aR;
            precoUnAjustado = precoUnAjustado * (1 - (dP / 100)) - dR;
            if (precoUnAjustado < 0) precoUnAjustado = 0;
            
            const precoTotal = roundedBars * bPrice;
            const precoTotalAjustado = roundedBars * precoUnAjustado;
            
            finalTotalPrice += precoTotal;
            finalTotalPriceAdjusted += precoTotalAjustado;

            rows.push({
                codMerco, label, roundedBars, exactBars, bPrice, precoUnAjustado, precoTotal, precoTotalAjustado, pesoUn, pesoTotal, metros: g.totalLinearMeters, cortes: g.osSet.size
            });
        });

        const finalArameKg = checkoutIncludeArame ? (parseFloat(checkoutArameKg) || 0) : 0;

        if (finalArameKg > 0) {
            const roundedArameKg = Math.max(1, Math.round(finalArameKg));
            const precoUnAjustado = parseFloat(checkoutAramePreco) || 0;

            const arameGauge = arameConfig.materialId ? gauges.find(g => g.id === arameConfig.materialId) : null;
            const arameCod = arameGauge ? (arameGauge.productCode || '-') : '-';
            const arameDesc = arameGauge ? `${arameGauge.commercialName || arameGauge.gauge} (REF: ${getQuoteTotalPoints(activeQuote)} PTS)` : `ARAME RECOZIDO (REF: ${getQuoteTotalPoints(activeQuote)} PTS)`;
            const arameBPrice = arameGauge && arameGauge.purchasePrice ? arameGauge.purchasePrice : precoUnAjustado;

            const precoTotal = roundedArameKg * arameBPrice;
            const precoTotalAjustado = roundedArameKg * precoUnAjustado;

            rows.push({
                isArame: true,
                codMerco: arameCod,
                label: arameDesc,
                roundedBars: roundedArameKg,
                exactBars: finalArameKg,
                bPrice: arameBPrice,
                precoUnAjustado: precoUnAjustado,
                precoTotal: precoTotal,
                precoTotalAjustado: precoTotalAjustado,
                pesoUn: 1,
                pesoTotal: roundedArameKg,
                metros: getQuoteTotalPoints(activeQuote) * 0.05,
                cortes: 0
            });
            finalTotalPrice += precoTotal;
            finalTotalPriceAdjusted += precoTotalAjustado;
        }

        const finalTotalAcrescimo = finalTotalPriceAdjusted > finalTotalPrice ? finalTotalPriceAdjusted - finalTotalPrice : 0;
        const finalTotalDesconto = finalTotalPrice > finalTotalPriceAdjusted ? finalTotalPrice - finalTotalPriceAdjusted : 0;

        return { rows, finalTotalPrice, finalTotalPriceAdjusted, finalTotalAcrescimo, finalTotalDesconto };
    }, [activeQuote, bitolas, gauges, checkoutAcrescimoPercent, checkoutAcrescimoReal, checkoutDescontoPercent, checkoutDescontoReal, checkoutArameKg, checkoutAramePreco, checkoutIncludeArame]);

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
            const maxId = quotes.length > 0 ? Math.max(...quotes.map(q => parseInt(q.id) || 0)) : 0;
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
                        onClick={() => setShowSettingsModal(true)}
                        className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-extrabold py-2 px-4 rounded-xl transition-all shadow-sm flex items-center gap-2 text-sm"
                    >
                        <span>⚙️ Configurações</span>
                    </button>
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
                                <th className="p-4 text-center font-bold text-xs uppercase w-48">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredQuotes.map((q) => (
                                <tr key={q.id} className={`${getRowClass(q.status, q.price)} transition-colors`}>
                                    <td className="p-4 text-center font-black text-slate-900 text-sm">{String(q.id).padStart(7, '0')}</td>
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
                                            {(!q.status.includes('Enviado p/ Produção') && !q.status.includes('Produzindo') && !q.status.includes('Concluído')) ? (
                                                <>
                                                    <option value="client">📝 Editar Cliente</option>
                                                    <option value="salesperson">👤 Editar Vendedor</option>
                                                    <option value="products">🛠️ Editar Produtos</option>
                                                    <option value="price">💰 Editar Preço</option>
                                                    <option value="duplicate">📋 Duplicar Orçamento</option>
                                                    <option value="print_orcamento">🖨️ Imprimir Modelo Cliente</option>
                                                    <option value="export_production">➡️ Exportar para Produção</option>
                                                    <option value="delete">🗑️ Excluir Orçamento</option>
                                                </>
                                            ) : (
                                                <>
                                                    <option value="duplicate">📋 Duplicar Orçamento</option>
                                                    <option value="print_orcamento">🖨️ Imprimir Modelo Cliente</option>
                                                    <option value="print_corte">✂️ Imprimir Plano de Corte</option>
                                                    <option value="print_etiqueta_maquina">🏷️ Imprimir Etiqueta Produção</option>
                                                </>
                                            )}
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
                                    {/* Removed Tipo de Ferragem and Previsão de Término as requested */}

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
            {activeModal && (
                <div className={`fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex ${activeModal.type === 'products' ? 'p-0 overflow-hidden' : 'items-center justify-center p-4'}`}>
                    {/* MODAL: Checkout / Preço */}
                    {activeModal.type === 'checkout' && activeQuote && (
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[95vh] border border-slate-300">
                            <div className="bg-[#E6EEF2] p-4 border-b flex justify-center items-center rounded-t-2xl">
                                <h3 className="font-medium text-2xl text-[#1A4B6B]">Preço</h3>
                            </div>
                            
                            <div className="p-4 overflow-y-auto flex-grow print-content">
                                <table className="w-full text-left border border-slate-300 border-collapse text-sm mb-6">
                                    <thead>
                                        <tr className="bg-[#175C8A] text-white">
                                            <th className="p-3 font-bold border-r border-[#1a6699] text-center w-24">Cód Merco</th>
                                            <th className="p-3 font-bold border-r border-[#1a6699] text-center w-16">OS</th>
                                            <th className="p-3 font-bold border-r border-[#1a6699]">Descrição</th>
                                            <th className="p-3 font-bold border-r border-[#1a6699] text-center">Qtde</th>
                                            <th className="p-3 font-bold border-r border-[#1a6699] text-center w-24">Metros</th>
                                            <th className="p-3 font-bold border-r border-[#1a6699] text-center w-28">Preço Un. (R$)</th>
                                            <th className="p-3 font-bold border-r border-[#1a6699] text-center w-32">Preço Un. Ajustado (R$)</th>
                                            <th className="p-3 font-bold border-r border-[#1a6699] text-center w-28">Preço Total (R$)</th>
                                            <th className="p-3 font-bold border-r border-[#1a6699] text-center w-32">Preço Total Ajustado (R$)</th>
                                            <th className="p-3 font-bold border-r border-[#1a6699] text-center w-24">Peso Un. (kg)</th>
                                            <th className="p-3 font-bold text-center w-24">Peso Total (kg)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {checkoutData.rows.map((row, idx) => (
                                            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-[#E6EEF2]'}>
                                                <td className="p-3 text-center border-r border-slate-300 text-slate-500 font-medium">{row.codMerco}</td>
                                                <td className="p-3 text-center border-r border-slate-300 text-sky-700 font-bold">{row.cortes > 0 ? row.cortes : '-'}</td>
                                                <td className="p-3 border-r border-slate-300 text-slate-700 font-bold uppercase text-[11px]">{row.label}</td>
                                                <td className="p-3 text-center border-r border-slate-300">
                                                    <div className="bg-[#6B7280] text-white font-bold rounded-full px-3 py-1 inline-block text-xs">
                                                        {row.isArame ? (
                                                            <>{row.pesoTotal.toFixed(2)} <span className="font-normal opacity-80">kg</span></>
                                                        ) : (
                                                            <>{row.roundedBars} <span className="font-normal opacity-80">({row.exactBars.toFixed(2)}) br</span></>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-3 text-center border-r border-slate-300 text-slate-600 font-bold">{row.metros !== undefined ? row.metros.toFixed(2) : '-'}</td>
                                                <td className="p-3 text-center border-r border-slate-300 text-slate-600">{row.bPrice.toFixed(2)}</td>
                                                <td className="p-3 text-center border-r border-slate-300 font-bold text-slate-800">{row.precoUnAjustado.toFixed(2)}</td>
                                                <td className="p-3 text-center border-r border-slate-300 text-slate-600">{row.precoTotal.toFixed(2)}</td>
                                                <td className="p-3 text-center border-r border-slate-300 font-bold text-[#175C8A]">{row.precoTotalAjustado.toFixed(2)}</td>
                                                <td className="p-3 text-center border-r border-slate-300 text-slate-600">{row.pesoUn.toFixed(2)}</td>
                                                <td className="p-3 text-center border-slate-300 text-slate-600">{row.pesoTotal.toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                {/* Footer Form */}
                                <div className="grid grid-cols-2 gap-8 mb-6 mt-12">
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center px-8">
                                            <label className="text-slate-600 font-bold text-sm tracking-widest uppercase">Acréscimo</label>
                                        </div>
                                        <div className="flex gap-4">
                                            <div className="relative flex-1">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                                                <input type="number" step="0.01" placeholder="0.00" value={checkoutAcrescimoPercent} onChange={e => setCheckoutAcrescimoPercent(e.target.value)} className="w-full border border-rose-300 rounded pl-8 pr-3 py-2 outline-none focus:border-sky-500 font-bold" />
                                            </div>
                                            <div className="relative flex-1">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R$</span>
                                                <input type="number" step="0.01" placeholder="0.00" value={checkoutAcrescimoReal} onChange={e => setCheckoutAcrescimoReal(e.target.value)} className="w-full border border-rose-300 rounded pl-8 pr-3 py-2 outline-none focus:border-sky-500 font-bold" />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center px-8">
                                            <label className="text-slate-600 font-bold text-sm tracking-widest uppercase">Desconto</label>
                                        </div>
                                        <div className="flex gap-4">
                                            <div className="relative flex-1">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                                                <input type="number" step="0.01" placeholder="0.00" value={checkoutDescontoPercent} onChange={e => setCheckoutDescontoPercent(e.target.value)} className="w-full border border-rose-300 rounded pl-8 pr-3 py-2 outline-none focus:border-sky-500 font-bold" />
                                            </div>
                                            <div className="relative flex-1">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R$</span>
                                                <input type="number" step="0.01" placeholder="0.00" value={checkoutDescontoReal} onChange={e => setCheckoutDescontoReal(e.target.value)} className="w-full border border-rose-300 rounded pl-8 pr-3 py-2 outline-none focus:border-sky-500 font-bold" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-1 mb-8 mt-4">
                                    <label className="text-slate-600 font-bold text-sm uppercase">Condições de Pagamento</label>
                                    <input type="text" value={checkoutCondicoesPagamento} onChange={e => setCheckoutCondicoesPagamento(e.target.value)} className="w-full border border-rose-300 rounded px-3 py-2 outline-none focus:border-sky-500 font-bold text-slate-700" />
                                </div>
                                
                                {/* Totals Summary */}
                                <div className="flex justify-between items-end border-t border-slate-300 pt-6">
                                    <div>
                                        <div className="text-slate-500 text-xs font-bold uppercase mb-1">Preço Total:</div>
                                        <div className="text-slate-500 font-bold text-xl">R$ {checkoutData.finalTotalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                    </div>
                                    <div>
                                        <div className="text-slate-500 text-xs font-bold uppercase mb-1">Acréscimo:</div>
                                        <div className="text-slate-500 font-bold">R$ {checkoutData.finalTotalAcrescimo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                    </div>
                                    <div>
                                        <div className="text-slate-500 text-xs font-bold uppercase mb-1">Desconto:</div>
                                        <div className="text-slate-500 font-bold">R$ {checkoutData.finalTotalDesconto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-slate-500 text-xs font-bold uppercase mb-1">Preço Ajustado:</div>
                                        <div className="text-[#175C8A] font-bold text-3xl">R$ {checkoutData.finalTotalPriceAdjusted.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Action Buttons */}
                            <div className="p-4 bg-white flex justify-center items-center gap-4 border-t shrink-0 print-hidden">
                                <button 
                                    onClick={() => {
                                        // Save financial fields to Quote
                                        const newQuotes = [...quotes];
                                        const qIdx = newQuotes.findIndex(q => q.id === activeQuote.id);
                                        if (qIdx >= 0) {
                                            newQuotes[qIdx].acrescimoPercent = parseFloat(checkoutAcrescimoPercent) || 0;
                                            newQuotes[qIdx].acrescimoReal = parseFloat(checkoutAcrescimoReal) || 0;
                                            newQuotes[qIdx].descontoPercent = parseFloat(checkoutDescontoPercent) || 0;
                                            newQuotes[qIdx].descontoReal = parseFloat(checkoutDescontoReal) || 0;
                                            newQuotes[qIdx].condicoesPagamento = checkoutCondicoesPagamento;
                                            newQuotes[qIdx].arameKg = checkoutIncludeArame ? parseFloat(checkoutArameKg) || 0 : 0;
                                            newQuotes[qIdx].aramePreco = parseFloat(checkoutAramePreco) || 0;
                                            setQuotes(newQuotes);
                                        }
                                        setActiveModal({ type: 'products', quoteId: activeQuote.id });
                                    }} 
                                    className="bg-[#4b6b8b] hover:bg-[#3a5670] text-white font-bold py-2 px-6 rounded text-sm transition"
                                >
                                    &larr; Voltar
                                </button>
                                <button 
                                    onClick={() => {
                                        showNotification('Exportação iniciada.', 'info');
                                        window.print();
                                    }}
                                    className="bg-[#5CB85C] hover:bg-[#4cae4c] text-white font-bold py-2 px-6 rounded text-sm transition"
                                >
                                    EXPORTAR
                                </button>
                                <button 
                                    onClick={() => {
                                        if (!activeQuote) return;
                                        const newQuotes = quotes.map(q => {
                                            if (q.id === activeQuote.id) {
                                                return {
                                                    ...q,
                                                    price: checkoutData.finalTotalPriceAdjusted,
                                                    acrescimoPercent: parseFloat(checkoutAcrescimoPercent) || 0,
                                                    acrescimoReal: parseFloat(checkoutAcrescimoReal) || 0,
                                                    descontoPercent: parseFloat(checkoutDescontoPercent) || 0,
                                                    descontoReal: parseFloat(checkoutDescontoReal) || 0,
                                                    condicoesPagamento: checkoutCondicoesPagamento,
                                                    arameKg: checkoutIncludeArame ? parseFloat(checkoutArameKg) || 0 : 0,
                                                    aramePreco: parseFloat(checkoutAramePreco) || 0,
                                                    status: 'Orçamento Finalizado'
                                                };
                                            }
                                            return q;
                                        });
                                        setQuotes(newQuotes);
                                        localStorage.setItem('msm_quotes', JSON.stringify(newQuotes));
                                        setActiveModal(null);
                                        showNotification('Orçamento salvo com sucesso.', 'success');
                                    }}
                                    className="bg-[#F0AD4E] hover:bg-[#eea236] text-white font-bold py-2 px-6 rounded text-sm transition"
                                >
                                    EXPORTAR COMO ORÇAMENTO
                                </button>
                            </div>
                        </div>
                    )}

                    {/* MODAL: Editar Cliente */}
                    {activeModal.type === 'client' && activeQuote && (
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
                    {activeModal.type === 'salesperson' && activeQuote && (
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
                    {activeModal.type === 'notes' && activeQuote && (
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
                    {activeModal.type === 'products' && activeQuote && (
                        <div className="bg-white shadow-2xl flex-1 rounded-none animate-in fade-in duration-150 flex flex-col min-h-0">
                            {/* Custom header bar centered and matching design */}
                            <div className="bg-slate-200 py-3.5 px-5 border-b border-slate-300 flex justify-between items-center shrink-0">
                                <div className="flex-1 text-center font-display text-slate-800 text-lg font-bold tracking-tight">
                                    ORÇAMENTO Nº {String(activeQuote.id).padStart(7, '0')}
                                    <div className="text-xs text-slate-500 font-extrabold uppercase mt-0.5">
                                        (CÓD {activeQuote.clientCode}) {activeQuote.clientName}
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 shrink-0">
                                    <button 
                                        type="button" 
                                        onClick={() => {
                                            if (!document.fullscreenElement) {
                                                document.documentElement.requestFullscreen().catch(err => console.log(err));
                                            } else {
                                                document.exitFullscreen().catch(err => console.log(err));
                                            }
                                        }}
                                        className="text-slate-500 hover:text-sky-600 font-bold flex items-center gap-1.5 text-xs uppercase bg-white/50 px-3 py-1.5 rounded-lg border border-slate-300 shadow-sm transition-colors"
                                        title="Abrir em Tela Cheia"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                                        Tela Cheia
                                    </button>
                                    <button type="button" onClick={() => setActiveModal(null)} className="text-slate-500 hover:text-red-600 text-3xl font-bold font-sans line-none transition-colors">&times;</button>
                                </div>
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
                                                
                                                if (cat === 'Sapata') {
                                                    setSapataName('');
                                                    setSapataQtde('');
                                                    setSapataTipo('FECHADA');
                                                    setSapataLength('');
                                                    setSapataWidth('');
                                                    setSapataHeight('');
                                                    setSapataObs('');
                                                    setShowSapataModal(true);
                                                    return;
                                                }
                                                if (cat === 'Corte e Dobra') {
                                                    setCorteDobraName('');
                                                    setCorteDobraObs('');
                                                    setEditingCorteDobraId(null);
                                                    setShowCorteDobraModal(true);
                                                    return;
                                                }
                                                const structuralTypes = ['Coluna', 'Pilar', 'Broca', 'Viga', 'Viga Superior', 'Viga Baldrame'];

                                                if (structuralTypes.includes(cat)) {
                                                    setStructuralCategory(cat.toUpperCase());
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
                                            const isSapata = item.description.startsWith('SAPATA');
                                            const isCorteDobra = item.description.startsWith('CORTE E DOBRA');
                                            const isStructural = isColuna || isPillar;
                                            
                                            let sapataC = '';
                                            let sapataL = '';
                                            let sapataA = '';
                                            if (isSapata) {
                                                const dimMatch = item.description.match(/(\d+)x(\d+)x(\d+)/);
                                                if (dimMatch) {
                                                    sapataC = dimMatch[1];
                                                    sapataL = dimMatch[2];
                                                    sapataA = dimMatch[3];
                                                }
                                            }
                                            
                                            // Dynamic minimum principal reinforcement count based on sides
                                            const matchLados = item.description.match(/(\d+ LADOS|REDONDA)/);
                                            const ladosDesc = matchLados ? matchLados[1] : '4 LADOS';
                                            let minPrincipalFerros = 4;
                                            if (ladosDesc === '3 LADOS') minPrincipalFerros = 3;
                                            else if (ladosDesc === '4 LADOS') minPrincipalFerros = 4;
                                            else if (ladosDesc === '6 LADOS') minPrincipalFerros = 6;
                                            else if (ladosDesc === '8 LADOS') minPrincipalFerros = 8;
                                            else if (ladosDesc === 'REDONDA') minPrincipalFerros = 3;
                                            
                                            const principalFerrosCount = (item.ferros || [])
                                                .filter(f => f.drawingType !== 'Estribo' && f.drawingType !== 'Trava')
                                                .reduce((sum, f) => sum + f.qtde, 0);
                                            const hasEnoughPrincipalFerros = principalFerrosCount >= minPrincipalFerros;
                                            const hasEstribos = (item.ferros || []).some(f => f.drawingType === 'Estribo' && f.qtde > 0);
                                            
                                            // Sapata completeness check
                                            let isSapataIncomplete = false;
                                            let missingSapataEstribo1 = false;
                                            let missingSapataEstribo2 = false;
                                            let sapataEstribo1Name = '';
                                            let sapataEstribo2Name = '';
                                            
                                            if (isSapata && sapataC && sapataL && sapataA) {
                                                const w1 = parseFloat(sapataC) || 0;
                                                const w2 = parseFloat(sapataL) || 0;
                                                const h = parseFloat(sapataA) || 0;
                                                
                                                sapataEstribo1Name = `${sapataC}x${sapataA}`;
                                                sapataEstribo2Name = `${sapataL}x${sapataA}`;
                                                
                                                const isMatch = (f: any, w: number, heightVal: number) => {
                                                    if (f.drawingType !== 'Estribo' || !(f.qtde > 0)) return false;
                                                    const a = parseFloat(f.ladoA) || 0;
                                                    const b = parseFloat(f.ladoB) || 0;
                                                    const c = parseFloat(f.ladoC) || 0;
                                                    const d = parseFloat(f.ladoD) || 0;
                                                    const e = parseFloat(f.ladoE) || 0;
                                                    const fVal = parseFloat(f.ladoF) || 0;
                                                    
                                                    // Standard action adds side A and side C
                                                    if ((a === w && c === heightVal) || (a === heightVal && c === w)) return true;
                                                     
                                                    const hasW = a === w || b === w || c === w || d === w || e === w || fVal === w;
                                                    const hasH = a === heightVal || b === heightVal || c === heightVal || d === heightVal || e === heightVal || fVal === heightVal;
                                                    if (hasW && hasH) return true;
                                                     
                                                    const nameLower = (f.nomeElemento || '').toLowerCase();
                                                    if (nameLower.includes(`${w}x${heightVal}`) || nameLower.includes(`${heightVal}x${w}`)) return true;
                                                     
                                                    return false;
                                                };
                                                
                                                const hasEstribo1 = (item.ferros || []).some(f => isMatch(f, w1, h));
                                                missingSapataEstribo1 = !hasEstribo1;
                                                
                                                if (w1 !== w2) {
                                                    const hasEstribo2 = (item.ferros || []).some(f => isMatch(f, w2, h));
                                                    missingSapataEstribo2 = !hasEstribo2;
                                                }
                                                
                                                isSapataIncomplete = missingSapataEstribo1 || missingSapataEstribo2;
                                            }
                                            
                                            const hasAnyElement = (item.ferros || []).length > 0;
                                            const incomplete = !hasAnyElement || (isStructural && (!hasEnoughPrincipalFerros || !hasEstribos)) || isSapataIncomplete;
                                            
                                            return (
                                                <div
                                                    key={item.id}
                                                    className={`border rounded-lg overflow-hidden relative shadow-sm flex flex-col mb-4 ${
                                                        incomplete
                                                            ? 'bg-red-50/50 border-red-200'
                                                            : 'bg-emerald-50/30 border-emerald-200'
                                                    }`}
                                                >
                                                    {/* Ribbon corner completion badge */}
                                                    <div className="absolute top-0 right-0 overflow-hidden w-24 h-24 pointer-events-none z-10">
                                                        <div
                                                            className={`absolute top-[22px] right-[-24px] transform rotate-45 text-center text-[7px] font-black tracking-widest text-white py-1 w-24 uppercase shadow-sm ${
                                                                incomplete ? 'bg-red-500' : 'bg-emerald-600'
                                                            }`}
                                                        >
                                                            {incomplete ? 'INCOMPLETO' : 'COMPLETO'}
                                                        </div>
                                                    </div>

                                                    {/* Card Header */}
                                                    <div
                                                        className={`flex flex-wrap items-center justify-between px-4 py-3 border-b shrink-0 ${
                                                            incomplete
                                                                ? 'bg-red-100/60 border-red-200'
                                                                : 'bg-emerald-100/60 border-emerald-200'
                                                        }`}
                                                    >
                                                        {/* Left side: title + badge */}
                                                        <div className="flex items-center gap-2 max-w-[50%] md:max-w-[60%]">
                                                            <span className="text-blue-700 font-bold text-sm bg-blue-100 px-2 py-0.5 rounded">
                                                                {item.qty}x
                                                            </span>
                                                            <div className="flex flex-wrap gap-2 items-center">
                                                                <span className="text-slate-800 text-sm font-semibold tracking-wide lowercase">
                                                                    {getProfessionalTitle(item)}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Center side: Actions Select */}
                                                        <div className="flex-1 max-w-[200px] px-2">
                                                            <select
                                                                value=""
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    if (!val) return;
                                                                    
                                                                    if (val === 'edit') {
                                                                        
                                                                        const isSapata = item.description.startsWith('SAPATA');
                                                                        const isCorteDobra = item.description.startsWith('CORTE E DOBRA');
                                                                        const isStructural = item.description.startsWith('COLUNA') || item.description.startsWith('VIGA') || item.description.startsWith('PILAR') || item.description.startsWith('BROCA');
                                                                        
                                                                        if (isSapata) {
                                                                            const dimMatch = item.description.match(/(\d+)x(\d+)x(\d+)/);
                                                                            if (dimMatch) {
                                                                                setSapataLength(dimMatch[1]);
                                                                                setSapataWidth(dimMatch[2]);
                                                                                setSapataHeight(dimMatch[3]);
                                                                            }
                                                                            const isFechada = item.description.includes('FECHADA');
                                                                            setSapataTipo(isFechada ? 'FECHADA' : 'ABERTA');
                                                                            setSapataQtde(String(item.qty));
                                                                            
                                                                            const obsMatch = item.description.match(/OBS:\s*(.*)/);
                                                                            setSapataObs(obsMatch ? obsMatch[1].trim() : '');
                                                                            
                                                                            // Extract name
                                                                            let name = '';
                                                                            const typeKeyword = isFechada ? 'FECHADA' : 'ABERTA';
                                                                            const shapeKeyword = item.description.includes('QUADRADA') ? 'QUADRADA' : (item.description.includes('RETANGULAR') ? 'RETANGULAR' : '');
                                                                            
                                                                            const prefixEnd = item.description.indexOf(shapeKeyword) + shapeKeyword.length;
                                                                            const typeIndex = item.description.indexOf(typeKeyword);
                                                                            if (prefixEnd > -1 && typeIndex > prefixEnd) {
                                                                                name = item.description.substring(prefixEnd, typeIndex).trim();
                                                                            }
                                                                            setSapataName(name);
                                                                            setEditingSapataId(item.id);
                                                                            setShowSapataModal(true);
                                                                        } else if (isCorteDobra) {
                                                                            const obsMatch = item.description.match(/OBS:\s*(.*)/);
                                                                            setCorteDobraObs(obsMatch ? obsMatch[1].trim() : '');
                                                                            let name = '';
                                                                            let descWithoutObs = item.description;
                                                                            if (obsMatch) {
                                                                                descWithoutObs = descWithoutObs.substring(0, descWithoutObs.indexOf('OBS:')).trim();
                                                                            }
                                                                            const prefixLength = 'CORTE E DOBRA'.length;
                                                                            if (descWithoutObs.length > prefixLength) {
                                                                                name = descWithoutObs.substring(prefixLength).trim();
                                                                            }
                                                                            setCorteDobraName(name);
                                                                            setEditingCorteDobraId(item.id);
                                                                            setShowCorteDobraModal(true);
                                                                        } else if (isStructural) {
                                                                            let structCat = 'COLUNA';
                                                                            ['VIGA SUPERIOR', 'VIGA BALDRAME', 'VIGA', 'PILAR', 'BROCA', 'COLUNA'].forEach(c => {
                                                                                if (item.description.startsWith(c)) structCat = c;
                                                                            });
                                                                            
                                                                            const remainingDesc = item.description.substring(structCat.length).trim();
                                                                            const parts = remainingDesc.split(' ');
                                                                            const namePart = (parts[0] !== 'AMARRADA' && parts[0] !== 'SOLDADA') ? parts[0] : '';
                                                                            
                                                                            const typeIndex = parts.indexOf('AMARRADA') !== -1 ? parts.indexOf('AMARRADA') : parts.indexOf('SOLDADA');
                                                                            const tipoAmarracao = parts[typeIndex] || 'AMARRADA';
                                                                            const ladosIndex = parts.findIndex(p => p.includes('LADOS') || p === 'REDONDA');
                                                                            const qtdeLados = parts[ladosIndex] || '4 LADOS';
                                                                            
                                                                            const areaMatch = item.description.match(/x (\d+)\s*(?:\/\s*(\d+))?\s*CM/);
                                                                            const area1 = areaMatch ? areaMatch[1] : '';
                                                                            const area2 = areaMatch && areaMatch[2] ? areaMatch[2] : '';
                                                                            
                                                                            const obsMatch = item.description.match(/OBS:\s*(.*)/);
                                                                            const obs = obsMatch ? obsMatch[1].trim() : '';

                                                                            setColunaName(namePart);
                                                                            setColunaQtde(String(item.qty));
                                                                            setColunaTipoAmarracao(tipoAmarracao as any);
                                                                            setColunaQtdeLados(qtdeLados);
                                                                            setColunaAreaSemEstr1(area1);
                                                                            setColunaAreaSemEstr2(area2);
                                                                            setColunaObs(obs);
                                                                            setStructuralCategory(structCat);
                                                                            setEditingColunaId(item.id);
                                                                            setShowColunaModal(true);
                                                                        } else {
                                                                            setActiveCategory(item.description.split(' ')[0]);
                                                                            setQtyInput(item.qty);
                                                                            setLenInput(item.length);
                                                                            setWeightInput(item.weight);
                                                                            setEditingColunaId(item.id);
                                                                        }
                                                                    } else if (val === 'delete') {
                                                                        setTempProducts(prev => prev.filter((_, i) => i !== idx));
                                                                    } else if (val.startsWith('sapata_estribo_')) {
                                                                        const [, , dim1, dim2] = val.split('_');
                                                                        
                                                                        const isFechada = item.description.includes('FECHADA');
                                                                        const typeKeyword = isFechada ? 'FECHADA' : 'ABERTA';
                                                                        const shapeKeyword = item.description.includes('QUADRADA') ? 'QUADRADA' : (item.description.includes('RETANGULAR') ? 'RETANGULAR' : '');
                                                                        let sapataNameVal = '';
                                                                        const prefixEnd = item.description.indexOf(shapeKeyword) + shapeKeyword.length;
                                                                        const typeIndex = item.description.indexOf(typeKeyword);
                                                                        if (prefixEnd > -1 && typeIndex > prefixEnd) {
                                                                            sapataNameVal = item.description.substring(prefixEnd, typeIndex).trim();
                                                                        }
                                                                        const displayName = `SAPATA ${shapeKeyword}${sapataNameVal ? ' ' + sapataNameVal : ''}`;

                                                                        setEstriboTargetProdIdx(idx);
                                                                        setEstriboTargetColunaNome(displayName);
                                                                        setEstriboNomeElemento(`ESTRIBOS ${dim1}x${dim2}`);
                                                                        setEstriboEspacamento('');
                                                                        setEstriboQtde('');
                                                                        setEstriboBitola('');
                                                                        setEstriboCalcAutomatico(false);
                                                                        setEstriboShapeType('Padrão');
                                                                        setEstriboLadoA(dim1);
                                                                        setEstriboLadoB(dim2);
                                                                        setEstriboLadoC(dim2);
                                                                        setEstriboLadoD('');
                                                                        setEstriboLadoE('');
                                                                        setEstriboLadoF('');
                                                                        setEstriboObs('');
                                                                        setShowEstribosModal(true);
                                                                    } else if (val.startsWith('sapata_costela_')) {
                                                                        const [, , dim1, dim2] = val.split('_');
                                                                        
                                                                        const isFechada = item.description.includes('FECHADA');
                                                                        const typeKeyword = isFechada ? 'FECHADA' : 'ABERTA';
                                                                        const shapeKeyword = item.description.includes('QUADRADA') ? 'QUADRADA' : (item.description.includes('RETANGULAR') ? 'RETANGULAR' : '');
                                                                        let sapataNameVal = '';
                                                                        const prefixEnd = item.description.indexOf(shapeKeyword) + shapeKeyword.length;
                                                                        const typeIndex = item.description.indexOf(typeKeyword);
                                                                        if (prefixEnd > -1 && typeIndex > prefixEnd) {
                                                                            sapataNameVal = item.description.substring(prefixEnd, typeIndex).trim();
                                                                        }
                                                                        const displayName = `SAPATA ${shapeKeyword}${sapataNameVal ? ' ' + sapataNameVal : ''}`;

                                                                        setFerroTargetProdIdx(idx);
                                                                        setFerroTargetColunaNome(displayName);
                                                                        setFerroNomeElemento(`COSTELAS ${dim1}x${dim2}`);
                                                                        setFerroQtde('');
                                                                        setFerroBitola('');
                                                                        setFerroModelId('fm_1');
                                                                        setFerroLadoA(dim1);
                                                                        setFerroLadoB(dim2);
                                                                        setFerroLadoC('');
                                                                        setFerroLadoD('');
                                                                        setFerroLadoE('');
                                                                        setFerroObs('');
                                                                        setFerroModalTitle('Costelas');
                                                                        setShowFerrosModal(true);
                                                                    } else if (val === 'add_ferros') {
                                                                        const parts = item.description.split(' ');
                                                                        setFerroTargetProdIdx(idx);
                                                                        setFerroTargetColunaNome(parts.length > 1 ? parts[1] : '');
                                                                        setFerroNomeElemento('FERROS PRINCIPAIS');
                                                                        setFerroQtde('');
                                                                        setFerroBitola('');
                                                                        setFerroModelId('fm_1');
                                                                        setFerroLadoA('');
                                                                        setFerroLadoB('');
                                                                        setFerroLadoC('');
                                                                        setFerroLadoD('');
                                                                        setFerroLadoE('');
                                                                        setFerroObs('');
                                                                        setFerroModalTitle('Ferros Principais');
                                                                        setShowFerrosModal(true);
                                                                    } else if (val === 'add_estribos') {
                                                                        const parts = item.description.split(' ');
                                                                        setEstriboTargetProdIdx(idx);
                                                                        setEstriboTargetColunaNome(parts.length > 1 ? parts[1] : '');
                                                                        setEstriboNomeElemento('ESTRIBOS');
                                                                        setEstriboEspacamento('');
                                                                        setEstriboQtde('');
                                                                        setEstriboBitola('');
                                                                        setEstriboCalcAutomatico(false);
                                                                        setEstriboShapeType('Padrão');
                                                                        setEstriboLadoA('');
                                                                        setEstriboLadoB('');
                                                                        setEstriboLadoC('');
                                                                        setEstriboLadoD('');
                                                                        setEstriboLadoE('');
                                                                        setEstriboLadoF('');
                                                                        setEstriboObs('');
                                                                        setShowEstribosModal(true);
                                                                    } else if (val === 'add_trava') {
                                                                        const parts = item.description.split(' ');
                                                                        setTravaTargetProdIdx(idx);
                                                                        setTravaTargetColunaNome(parts.length > 1 ? parts[1] : '');
                                                                        setTravaNomeElemento('TRAVA');
                                                                        setTravaQtde('');
                                                                        setTravaBitola('');
                                                                        setTravaShapeId(1);
                                                                        setTravaLadoA('');
                                                                        setTravaLadoB('');
                                                                        setTravaLadoC('');
                                                                        setTravaLadoD('');
                                                                        setTravaLadoE('');
                                                                        setTravaObs('');
                                                                        setShowTravaModal(true);
                                                                    } else if (val === 'add_costelas' || val === 'add_reforcos' || val === 'add_2camada') {
                                                                        const optionLabel = val === 'add_costelas' ? 'Costelas' : val === 'add_reforcos' ? 'Reforços' : '2ª Camada';
                                                                        const parts = item.description.split(' ');
                                                                        setFerroTargetProdIdx(idx);
                                                                        setFerroTargetColunaNome(parts.length > 1 ? parts[1] : '');
                                                                        setFerroNomeElemento(optionLabel.toUpperCase());
                                                                        setFerroQtde('');
                                                                        setFerroBitola('');
                                                                        setFerroModelId('fm_1');
                                                                        setFerroLadoA('');
                                                                        setFerroLadoB('');
                                                                        setFerroLadoC('');
                                                                        setFerroLadoD('');
                                                                        setFerroLadoE('');
                                                                        setFerroObs('');
                                                                        setFerroModalTitle(optionLabel);
                                                                        setShowFerrosModal(true);
                                                                    } else if (val === 'cd_add_elemento') {
                                                                        setElementoTargetProdIdx(idx);
                                                                        let cdGroupName = item.description;
                                                                        const obsIdx2 = cdGroupName.indexOf(' OBS:');
                                                                        if (obsIdx2 !== -1) cdGroupName = cdGroupName.substring(0, obsIdx2);
                                                                        setElementoTargetGroupNome(cdGroupName);
                                                                        setElementoNomeElemento('');
                                                                        setElementoQtde('');
                                                                        setElementoBitola('');
                                                                        setElementoShapeId('');
                                                                        setElementoLadoA('');
                                                                        setElementoLadoB('');
                                                                        setElementoLadoC('');
                                                                        setElementoLadoD('');
                                                                        setElementoLadoE('');
                                                                        setElementoLadoF('');
                                                                        setElementoObs('');
                                                                        setElementoEditId(null);
                                                                        setShowElementoModal(true);
                                                                    } else if (val === 'cd_alterar_bitolas') {
                                                                        setAlterarBitolasTargetIdx(idx);
                                                                        setAlterarBitolasValue('');
                                                                        setShowAlterarBitolasModal(true);
                                                                    } else if (val === 'cd_anexar_desenho') {
                                                                        setAnexarDesenhoTargetIdx(idx);
                                                                        const fileInput = document.createElement('input');
                                                                        fileInput.type = 'file';
                                                                        fileInput.accept = 'image/*,.pdf';
                                                                        fileInput.onchange = (ev) => {
                                                                            const file = (ev.target as HTMLInputElement).files?.[0];
                                                                            if (!file) return;
                                                                            const reader = new FileReader();
                                                                            reader.onload = (e) => {
                                                                                const data = e.target?.result as string;
                                                                                const updated = tempProducts.map((p, pi) =>
                                                                                    pi === idx ? { ...p, attachmentName: file.name, attachmentData: data } : p
                                                                                );
                                                                                setTempProducts(updated);
                                                                                if (activeQuote) handleProductSave(activeQuote.id, updated);
                                                                                showNotification('Desenho anexado com sucesso!', 'success');
                                                                            };
                                                                            reader.readAsDataURL(file);
                                                                        };
                                                                        fileInput.click();
                                                                    } else if (val === 'cd_duplicar') {
                                                                        const copied = {
                                                                            ...item,
                                                                            id: String(Date.now() + Math.random()),
                                                                            ferros: (item.ferros || []).map(f => ({ ...f, id: String(Date.now() + Math.random()) }))
                                                                        };
                                                                        const updated = [...tempProducts, copied];
                                                                        setTempProducts(updated);
                                                                        if (activeQuote) handleProductSave(activeQuote.id, updated);
                                                                        showNotification('Peça duplicada!', 'success');
                                                                    } else if (val === 'cd_bloquear') {
                                                                        const updated = tempProducts.map((p, pi) =>
                                                                            pi === idx ? { ...p, locked: !p.locked } : p
                                                                        );
                                                                        setTempProducts(updated);
                                                                        if (activeQuote) handleProductSave(activeQuote.id, updated);
                                                                        showNotification(item.locked ? 'Peça desbloqueada!' : 'Peça bloqueada!', 'info');
                                                                    }
                                                                }}
                                                                className="w-full bg-white border border-slate-300 hover:border-slate-400 rounded px-2 py-1 text-[10px] font-bold text-slate-700 focus:outline-none cursor-pointer"
                                                            >
                                                                <option value="">Ações...</option>
                                                                <option value="edit">✏️ Editar Peça</option>
                                                                {!item.locked && <option value="delete">❌ Excluir Peça</option>}
                                                                {isCorteDobra ? (
                                                                    <>
                                                                        <option value="cd_add_elemento">➕ + Elemento</option>
                                                                        <option value="cd_alterar_bitolas">🔩 Alterar Bitolas</option>
                                                                        <option value="cd_anexar_desenho">📎 Anexar Desenho</option>
                                                                        <option value="cd_duplicar">📋 Duplicar Peça</option>
                                                                        <option value="cd_bloquear">{item.locked ? '🔓 Desbloquear' : '🔒 Bloquear'}</option>
                                                                    </>
                                                                ) : isSapata ? (
                                                                    <>
                                                                        {sapataC && sapataA && (
                                                                            <option value={`sapata_estribo_${sapataC}_${sapataA}`}>➕ Estribos {sapataC}x{sapataA}</option>
                                                                        )}
                                                                        {sapataL && sapataA && sapataC !== sapataL && (
                                                                            <option value={`sapata_estribo_${sapataL}_${sapataA}`}>➕ Estribos {sapataL}x{sapataA}</option>
                                                                        )}
                                                                        {sapataC && sapataL && (
                                                                            <option value={`sapata_costela_${sapataC}_${sapataL}`}>➕ Costelas {sapataC}x{sapataL}</option>
                                                                        )}
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <option value="add_ferros">➕ Ferros Principais</option>
                                                                        <option value="add_estribos">➕ Estribos</option>
                                                                        <option value="add_costelas">➕ Costelas</option>
                                                                        <option value="add_reforcos">➕ Reforços</option>
                                                                        <option value="add_2camada">➕ 2ª Camada</option>
                                                                        <option value="add_trava">➕ Trava</option>
                                                                    </>
                                                                )}
                                                            </select>
                                                        </div>

                                                        {/* Right side: Price + Weight + Pontos */}
                                                        <div className="text-right pr-14 shrink-0 flex flex-col justify-center gap-0.5">
                                                            {item.ferros && item.ferros.length > 0 ? (
                                                                <>
                                                                    <div className="text-xs font-black text-slate-800">
                                                                        {(() => {
                                                                            const totalKg = (item.ferros || []).reduce((sum, f) => {
                                                                                const totalCm = getFerroTotalLengthCm(f, item.description);
                                                                                const factor = parseFloat((f.bitola || '').split(',')[1]) || 0;
                                                                                return sum + (totalCm / 100) * factor * f.qtde;
                                                                            }, 0);
                                                                            const price = totalKg * 8.5;
                                                                            return `Aprox. R$ ${price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                                                                        })()}
                                                                    </div>
                                                                    <div className="text-[9px] font-bold text-blue-600">
                                                                        {(() => {
                                                                            const totalKg = (item.ferros || []).reduce((sum, f) => {
                                                                                const totalCm = getFerroTotalLengthCm(f, item.description);
                                                                                const factor = parseFloat((f.bitola || '').split(',')[1]) || 0;
                                                                                return sum + (totalCm / 100) * factor * f.qtde;
                                                                            }, 0);
                                                                            return `Peso Total = ${totalKg.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`;
                                                                        })()}
                                                                    </div>
                                                                    {(() => {
                                                                        const isEstribo = (f: any) => f && (f.drawingType === 'Estribo' || f.drawingType === 'Trava' || (f.nomeElemento && (f.nomeElemento.toUpperCase().includes('ESTRIB') || f.nomeElemento.toUpperCase().includes('TRAVA'))));
                                                                        const qtdEstribos = (item.ferros || []).filter(isEstribo).reduce((sum, f) => sum + (f.qtde || 0), 0);
                                                                        const qtdFerros = (item.ferros || []).filter(f => f && !isEstribo(f)).reduce((sum, f) => sum + (f.qtde || 0), 0);
                                                                        const pts = qtdEstribos * qtdFerros * (item.qty || 1);
                                                                        if (pts > 0) {
                                                                            const metros = (pts * 5) / 100;
                                                                            return (
                                                                                <div className="flex flex-col gap-0.5 mt-0.5">
                                                                                    <div className="text-[9px] font-bold text-amber-600">
                                                                                        🔗 {pts} pontos de arame
                                                                                    </div>
                                                                                    <div className="text-[9px] font-bold text-slate-500 text-right pr-0.5">
                                                                                        📏 {metros.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mts linear
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        }
                                                                        return null;
                                                                    })()}
                                                                </>
                                                            ) : (
                                                                <div className="text-xs font-black text-slate-400">R$ 0,00</div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Card Body */}
                                                    {isCorteDobra ? (
                                                        /* Corte e Dobra Card Body */
                                                        <div className="bg-white">
                                                            {/* Attachment badge */}
                                                            {item.attachmentName && (
                                                                <div className="px-3 py-1.5 bg-sky-50 border-b border-sky-100 flex items-center gap-2">
                                                                    <span className="text-[10px] font-bold text-sky-700">📎 {item.attachmentName}</span>
                                                                    <button
                                                                        onClick={() => {
                                                                            setPreviewAttachmentName(item.attachmentName || '');
                                                                            setPreviewAttachmentData(item.attachmentData || '');
                                                                            setShowPreviewAttachmentModal(true);
                                                                        }}
                                                                        className="text-[9px] font-bold text-sky-600 underline"
                                                                    >Ver</button>
                                                                </div>
                                                            )}
                                                            {item.locked && (
                                                                <div className="px-3 py-1 bg-amber-50 border-b border-amber-100 text-[10px] font-bold text-amber-700">🔒 Peça bloqueada — use Ações {'>'} Desbloquear para editar</div>
                                                            )}
                                                            {item.ferros && item.ferros.length > 0 ? (
                                                                <table className="w-full text-[10px] min-w-[640px]">
                                                                    <thead className="bg-[#0F3F5C] text-white">
                                                                        <tr>
                                                                            <th className="px-2 py-0.5 text-center font-bold uppercase text-[9px] tracking-wide w-12">OS</th>
                                                                            <th className="px-2 py-0.5 text-center font-bold uppercase text-[9px] tracking-wide">Img</th>
                                                                            <th className="px-2 py-0.5 text-center font-bold uppercase text-[9px] tracking-wide">Elemento</th>
                                                                            <th className="px-2 py-0.5 text-center font-bold uppercase text-[9px] tracking-wide">Qtde</th>
                                                                            <th className="px-2 py-0.5 text-center font-bold uppercase text-[9px] tracking-wide">Bitola</th>
                                                                            <th className="px-2 py-0.5 text-center font-bold uppercase text-[9px] tracking-wide">Comp. Linear</th>
                                                                            <th className="px-2 py-0.5 text-center font-bold uppercase text-[9px] tracking-wide">Obs</th>
                                                                            <th className="px-2 py-0.5 text-center font-bold uppercase text-[9px] tracking-wide">Ações</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {item.ferros.map((ferro, fIdx) => (
                                                                            <tr key={ferro.id} className="bg-white hover:bg-slate-50">
                                                                                <td className="px-2 py-0.5 text-center font-bold text-slate-500 text-[10px]">OS:{String((tempProducts.slice(0, idx).reduce((acc, p) => acc + (p.ferros?.length || 0), 0)) + fIdx + 1).padStart(2, '0')}</td>
                                                                                <td className="px-2 py-0.5 text-center w-36">
                                                                                    <div className="flex items-center justify-center min-h-[50px]">
                                                                                        <div className="scale-110 origin-center">
                                                                                            {renderEstriboSVG('4 LADOS', ferro.estriboShape || ferro.ferroModelId || 'Padrão', ferro.ladoA, ferro.ladoB, ferro.ladoC, ferro.ladoD, ferro.ladoE, ferro.ladoF, [...estriboModels, ...ferroModels]) || renderBarDiagramSVG(ferroModels.find(m => m.id === ferro.ferroModelId)?.name || '', ferro.ladoA, ferro.ladoB, ferro.ladoC, ferro.ladoD, ferro.ladoE, true)}
                                                                                        </div>
                                                                                    </div>
                                                                                </td>
                                                                                <td className="px-2 py-0.5 text-center font-bold text-slate-800">{ferro.nomeElemento || '-'}</td>
                                                                                <td className="px-2 py-0.5 text-center">
                                                                                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-slate-500 text-white font-bold text-[9px] min-w-[20px]">{ferro.qtde}</span>
                                                                                </td>
                                                                                <td className="px-2 py-0.5 text-center font-bold text-slate-700">
                                                                                    {(() => {
                                                                                        const bitolaFull = (ferro.bitola || '').split(',')[0];
                                                                                        const match = bitolaFull.match(/([\d.]+)\s*mm/i);
                                                                                        return match ? `${parseFloat(match[1])}mm` : bitolaFull;
                                                                                    })()}
                                                                                </td>
                                                                                <td className="px-2 py-0.5 text-center font-mono text-slate-700">
                                                                                    {(() => {
                                                                                        const a = parseFloat(ferro.ladoA) || 0;
                                                                                        const b = parseFloat(ferro.ladoB) || 0;
                                                                                        const c = parseFloat(ferro.ladoC) || 0;
                                                                                        const d = parseFloat(ferro.ladoD) || 0;
                                                                                        const e = parseFloat(ferro.ladoE) || 0;
                                                                                        const f = parseFloat(ferro.ladoF || '') || 0;
                                                                                        return getFerroTotalLengthCm(ferro, item.description) + ' cm';
                                                                                    })()}
                                                                                </td>
                                                                                <td className="px-2 py-0.5 text-center text-slate-500 italic max-w-[80px] truncate">{ferro.obs || '-'}</td>
                                                                                <td className="px-2 py-0.5 text-center">
                                                                                    {!item.locked && (
                                                                                        <div className="flex items-center justify-center gap-1">
                                                                                            <button
                                                                                                onClick={() => {
                                                                                                    setElementoTargetProdIdx(idx);
                                                                                                    let cdGroupName2 = item.description;
                                                                                                    const obsIdx3 = cdGroupName2.indexOf(' OBS:');
                                                                                                    if (obsIdx3 !== -1) cdGroupName2 = cdGroupName2.substring(0, obsIdx3);
                                                                                                    setElementoTargetGroupNome(cdGroupName2);
                                                                                                    setElementoNomeElemento(ferro.nomeElemento);
                                                                                                    setElementoQtde(String(ferro.qtde));
                                                                                                    setElementoBitola(ferro.bitola);
                                                                                                    setElementoShapeId(ferro.estriboShape || '');
                                                                                                    setElementoLadoA(ferro.ladoA);
                                                                                                    setElementoLadoB(ferro.ladoB);
                                                                                                    setElementoLadoC(ferro.ladoC);
                                                                                                    setElementoLadoD(ferro.ladoD);
                                                                                                    setElementoLadoE(ferro.ladoE);
                                                                                                    setElementoLadoF(ferro.ladoF || '');
                                                                                                    setElementoObs(ferro.obs);
                                                                                                    setElementoEditId(ferro.id);
                                                                                                    setShowElementoModal(true);
                                                                                                }}
                                                                                                className="bg-orange-500 hover:bg-orange-600 text-white font-semibold py-1 px-2 rounded text-[9px]"
                                                                                            >Editar</button>
                                                                                            <button
                                                                                                onClick={() => {
                                                                                                    const updated = tempProducts.map((p, pi) =>
                                                                                                        pi === idx ? recalcProduct({ ...p, ferros: (p.ferros || []).filter((_, fi) => fi !== fIdx) }) : p
                                                                                                    );
                                                                                                    setTempProducts(updated);
                                                                                                    if (activeQuote) handleProductSave(activeQuote.id, updated);
                                                                                                }}
                                                                                                className="bg-red-600 hover:bg-red-700 text-white font-semibold py-1 px-2 rounded text-[9px]"
                                                                                            >Excluir</button>
                                                                                        </div>
                                                                                    )}
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            ) : (
                                                                <div className="p-8 text-center text-slate-400 font-semibold">
                                                                    Nenhum elemento adicionado. Use <strong>Ações → + Elemento</strong> para começar.
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                    <div className="flex flex-col md:flex-row items-stretch bg-white">
                                                        {/* Profile Diagram (Left Column) */}
                                                        <div className="w-full md:w-[130px] shrink-0 border-b md:border-b-0 md:border-r border-slate-200 flex items-center justify-center p-3.5 bg-slate-50/30">
                                                            <div className="w-full flex flex-col items-center gap-1.5 text-center">
                                                                {renderColumnProfileSVG(ladosDesc)}
                                                            </div>
                                                        </div>

                                                        {/* Table (Right Column) */}
                                                        <div className="flex-grow min-w-0 overflow-x-auto">
                                                            {(isStructural || isSapata) && (
                                                                <div className="p-2 space-y-1 bg-amber-50/40 border-b border-slate-100">
                                                                    {isStructural && !hasEnoughPrincipalFerros && (
                                                                        <div className="text-red-500 text-[9px] font-bold">⚠️ Sem ferros principais suficientes (Mínimo {minPrincipalFerros} para {ladosDesc})</div>
                                                                    )}
                                                                    {isStructural && !hasEstribos && (
                                                                        <div className="text-red-500 text-[9px] font-bold">⚠️ Sem estribos suficientes</div>
                                                                    )}
                                                                    {isSapata && missingSapataEstribo1 && (
                                                                        <div className="text-red-500 text-[9px] font-bold">⚠️ Falta estribo {sapataC === sapataL ? '' : 'maior '}({sapataEstribo1Name})</div>
                                                                    )}
                                                                    {isSapata && missingSapataEstribo2 && (
                                                                        <div className="text-red-500 text-[9px] font-bold">⚠️ Falta estribo menor ({sapataEstribo2Name})</div>
                                                                    )}
                                                                </div>
                                                            )}

                                                            {item.ferros && item.ferros.length > 0 ? (
                                                                <table className="w-full text-[10px] min-w-[780px]">
                                                                    <thead className="bg-[#0F3F5C] text-white">
                                                                        <tr>
                                                                            <th className="px-2 py-0.5 text-center font-bold uppercase text-[9px] tracking-wide w-12">OS</th>
                                                                            <th className="px-2 py-0.5 text-center font-bold uppercase text-[9px] tracking-wide">Img</th>
                                                                            <th className="px-2 py-0.5 text-center font-bold uppercase text-[9px] tracking-wide">Elemento</th>
                                                                            <th className="px-2 py-0.5 text-center font-bold uppercase text-[9px] tracking-wide">Qtde</th>
                                                                            <th className="px-2 py-0.5 text-center font-bold uppercase text-[9px] tracking-wide">Tipo</th>
                                                                            <th className="px-2 py-0.5 text-center font-bold uppercase text-[9px] tracking-wide">Bitola</th>
                                                                            <th className="px-2 py-0.5 text-center font-bold uppercase text-[9px] tracking-wide">Esp. Estr.</th>
                                                                            <th className="px-2 py-0.5 text-center font-bold uppercase text-[9px] tracking-wide">Área s/ Est.</th>
                                                                            <th className="px-2 py-0.5 text-center font-bold uppercase text-[9px] tracking-wide">Ponta</th>
                                                                            <th className="px-2 py-0.5 text-center font-bold uppercase text-[9px] tracking-wide">Obs</th>
                                                                            <th className="px-2 py-0.5 text-center font-bold uppercase text-[9px] tracking-wide">Cálculos</th>
                                                                            <th className="px-2 py-0.5 text-center font-bold uppercase text-[9px] tracking-wide">Ações</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {item.ferros.map((ferro, fIdx) => {
                                                                            const areaMatch = item.description.match(/x (\d+)\s*(?:\/\s*(\d+))?\s*CM/);
                                                                            const areaVal = areaMatch ? areaMatch[1] : '';
                                                                            const areaText = areaVal ? `${areaVal} CM S/ ESTR` : '-';
                                                                            
                                                                            return (
                                                                                <tr key={ferro.id} className="bg-white hover:bg-slate-50 transition-colors">
                                                                                    <td className="px-2 py-0.5 text-center font-bold text-slate-500 text-[10px]">OS:{String((tempProducts.slice(0, idx).reduce((acc, p) => acc + (p.ferros?.length || 0), 0)) + fIdx + 1).padStart(2, '0')}</td>
                                                                                    {/* img */}
                                                                                    <td className="px-2 py-0.5 text-center w-36">
                                                                                        <div className="flex items-center justify-center min-h-[50px]">
                                                                                            {ferro.drawingType === 'Estribo'
                                                                                                ? <div className="scale-110 origin-center">{renderEstriboSVG(ladosDesc, ferro.estriboShape || 'Padrão', ferro.ladoA, ferro.ladoB, ferro.ladoC, ferro.ladoD, ferro.ladoE, ferro.ladoF)}</div>
                                                                                                : ferro.drawingType === 'CorteDobra'
                                                                                                ? <div className="scale-110 origin-center">{renderEstriboSVG(ladosDesc, ferro.estriboShape || ferro.ferroModelId || 'Padrão', ferro.ladoA, ferro.ladoB, ferro.ladoC, ferro.ladoD, ferro.ladoE, ferro.ladoF, [...estriboModels, ...ferroModels]) || renderBarDiagramSVG(ferroModels.find(m => m.id === ferro.ferroModelId)?.name || '', ferro.ladoA, ferro.ladoB, ferro.ladoC, ferro.ladoD, ferro.ladoE, true)}</div>
                                                                                                : ferro.drawingType === 'Trava'
                                                                                                ? <div className="scale-110 origin-center">{renderTravaSVG(Number(ferro.estriboShape) || 1, ferro.ladoA, ferro.ladoB, ferro.ladoC, ferro.ladoD, ferro.ladoE)}</div>
                                                                                                : <div className="scale-110 origin-center">{renderEstriboSVG(ladosDesc || '4 LADOS', ferro.estriboShape || ferro.ferroModelId || 'Padrão', ferro.ladoA, ferro.ladoB, ferro.ladoC, ferro.ladoD, ferro.ladoE, ferro.ladoF, [...estriboModels, ...ferroModels]) || renderBarDiagramSVG(ferroModels.find(m => m.id === ferro.ferroModelId)?.name || '', ferro.ladoA, ferro.ladoB, ferro.ladoC, ferro.ladoD, ferro.ladoE, true)}</div>}
                                                                                        </div>
                                                                                    </td>

                                                                                    {/* nome elemento */}
                                                                                    <td className="px-2 py-0.5 text-center font-bold text-slate-700">{ferro.nomeElemento}</td>

                                                                                    {/* qtde - centered gray badge */}
                                                                                    <td className="px-2 py-0.5 text-center">
                                                                                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-slate-500 text-white font-bold text-[9px] min-w-[20px]">
                                                                                            {ferro.qtde}
                                                                                        </span>
                                                                                    </td>

                                                                                    {/* tipo */}
                                                                                    <td className="px-2 py-0.5 text-center text-slate-600 font-semibold">
                                                                                        {ferro.drawingType === 'Estribo' ? 'ESTRIBOS' : ferro.drawingType === 'Trava' ? 'TRAVA' : ferro.drawingType === 'CorteDobra' ? 'ELEMENTO' : 'FERROS'}
                                                                                    </td>

                                                                                    {/* bitola */}
                                                                                    <td className="px-2 py-0.5 text-center font-bold text-slate-700">
                                                                                        {(() => {
                                                                                            const bitolaFull = (ferro.bitola || '').split(',')[0];
                                                                                            const match = bitolaFull.match(/([\d.]+)\s*mm/i);
                                                                                            return match ? `${parseFloat(match[1])}mm` : bitolaFull;
                                                                                        })()}
                                                                                    </td>

                                                                                    {/* esp estr. */}
                                                                                    <td className="px-2 py-0.5 text-center text-slate-600 font-bold">
                                                                                        {ferro.drawingType === 'Estribo' ? (ferro.espacamento ? ferro.espacamento + ' CM' : '-') : '-'}
                                                                                    </td>

                                                                                    {/* area s/ est. */}
                                                                                    <td className="px-2 py-0.5 text-center text-slate-600" style={{ maxWidth: '120px' }}>
                                                                                        {ferro.drawingType === 'Estribo' ? '-' : areaText}
                                                                                    </td>

                                                                                    {/* ponta */}
                                                                                    <td className="px-2 py-0.5 text-center text-slate-600">
                                                                                        {ferro.drawingType === 'Estribo' || ferro.drawingType === 'Trava' || ferro.drawingType === 'CorteDobra' ? '-' : ferroModels.find(m => m.id === ferro.ferroModelId)?.name || 'RETO'}
                                                                                    </td>

                                                                                    {/* obs */}
                                                                                    <td className="px-2 py-0.5 text-center text-slate-500 italic max-w-[100px] truncate">{ferro.obs || '-'}</td>

                                                                                    {/* calculos fraction layout */}
                                                                                    <td className="px-2 py-0.5 text-center w-28">
                                                                                        <div className="flex flex-col items-center justify-center text-center">
                                                                                            <span className="text-[8px] text-slate-400 font-semibold leading-tight">Tamanho linear</span>
                                                                                            <span className="text-[8px] text-slate-400 font-semibold leading-tight">unitário:</span>
                                                                                            <div className="w-12 border-b border-slate-200 my-0.5"></div>
                                                                                            <span className="font-extrabold text-slate-800 text-[10px]">{getFerroTotalLengthCm(ferro, item.description)} cm</span>
                                                                                        </div>
                                                                                    </td>

                                                                                    {/* acao horizontal styled buttons */}
                                                                                    <td className="px-2 py-0.5 text-center w-36">
                                                                                        <div className="flex items-center justify-center gap-1.5">
                                                                                            <button
                                                                                                onClick={() => {
                                                                                                    if (ferro.drawingType === 'Estribo') {
                                                                                                        setEstriboTargetProdIdx(idx);
                                                                                                        const prod = tempProducts[idx];
                                                                                                        const parts = prod.description.split(' ');
                                                                                                        setEstriboTargetColunaNome(parts.length > 1 ? parts[1] : '');
                                                                                                        setEstriboNomeElemento(ferro.nomeElemento);
                                                                                                        setEstriboEspacamento(ferro.espacamento || '');
                                                                                                        setEstriboQtde(String(ferro.qtde));
                                                                                                        setEstriboBitola(ferro.bitola);
                                                                                                        setEstriboCalcAutomatico(false);
                                                                                                        setEstriboShapeType(ferro.estriboShape || 'Padrão');
                                                                                                        setEstriboLadoA(ferro.ladoA);
                                                                                                        setEstriboLadoB(ferro.ladoB);
                                                                                                        setEstriboLadoC(ferro.ladoC || ferro.ladoB);
                                                                                                        setEstriboLadoD(ferro.ladoD);
                                                                                                        setEstriboLadoE(ferro.ladoE || '');
                                                                                                        setEstriboLadoF(ferro.ladoF || '');
                                                                                                        setEstriboObs(ferro.obs);
                                                                                                        setFerroEditId(ferro.id);
                                                                                                        setShowEstribosModal(true);
                                                                                                    } else if (ferro.drawingType === 'Trava') {
                                                                                                        setTravaTargetProdIdx(idx);
                                                                                                        const prod = tempProducts[idx];
                                                                                                        const parts = prod.description.split(' ');
                                                                                                        setTravaTargetColunaNome(parts.length > 1 ? parts[1] : '');
                                                                                                        setTravaNomeElemento(ferro.nomeElemento);
                                                                                                        setTravaQtde(String(ferro.qtde));
                                                                                                        setTravaBitola(ferro.bitola);
                                                                                                        setTravaShapeId(Number(ferro.estriboShape) || 1);
                                                                                                        setTravaLadoA(ferro.ladoA);
                                                                                                        setTravaLadoB(ferro.ladoB);
                                                                                                        setTravaLadoC(ferro.ladoC);
                                                                                                        setTravaLadoD(ferro.ladoD);
                                                                                                        setTravaLadoE(ferro.ladoE || '');
                                                                                                        setTravaObs(ferro.obs);
                                                                                                        setTravaEditId(ferro.id);
                                                                                                        setShowTravaModal(true);
                                                                                                    } else {
                                                                                                        setFerroTargetProdIdx(idx);
                                                                                                        const prod = tempProducts[idx];
                                                                                                        const parts = prod.description.split(' ');
                                                                                                        setFerroTargetColunaNome(parts.length > 1 ? parts[1] : '');
                                                                                                        setFerroNomeElemento(ferro.nomeElemento);
                                                                                                        setFerroQtde(String(ferro.qtde));
                                                                                                        setFerroBitola(ferro.bitola);
                                                                                                        setFerroModelId(ferro.ferroModelId || 'fm_1');
                                                                                                        setFerroLadoA(ferro.ladoA);
                                                                                                        setFerroLadoB(ferro.ladoB);
                                                                                                        setFerroLadoC(ferro.ladoC);
                                                                                                        setFerroLadoD(ferro.ladoD);
                                                                                                        setFerroLadoE(ferro.ladoE || '');
                                                                                                        setFerroObs(ferro.obs);
                                                                                                        setFerroModalTitle(ferro.nomeElemento);
                                                                                                        setFerroEditId(ferro.id);
                                                                                                        setShowFerrosModal(true);
                                                                                                    }
                                                                                                }}
                                                                                                className="bg-orange-500 hover:bg-orange-600 border border-orange-600 text-white font-semibold py-1 px-2.5 rounded text-[10px] transition shadow-sm"
                                                                                            >
                                                                                                Editar
                                                                                            </button>
                                                                                            <button
                                                                                                onClick={() => {
                                                                                                    const copied = {
                                                                                                        id: String(Date.now() + Math.random()),
                                                                                                        nomeElemento: ferro.nomeElemento + ' (CÓPIA)',
                                                                                                        qtde: ferro.qtde,
                                                                                                        bitola: ferro.bitola,
                                                                                                        bitolaKgm: ferro.bitolaKgm,
                                                                                                        ferroModelId: ferro.ferroModelId,
                                                                                                        ladoA: ferro.ladoA,
                                                                                                        ladoB: ferro.ladoB,
                                                                                                        ladoC: ferro.ladoC,
                                                                                                        ladoD: ferro.ladoD,
                                                                                                        ladoE: ferro.ladoE,
                                                                                                        obs: ferro.obs,
                                                                                                        drawingType: ferro.drawingType,
                                                                                                        estriboShape: ferro.estriboShape,
                                                                                                        espacamento: ferro.espacamento
                                                                                                    };
                                                                                                    const updated = tempProducts.map((p, pi) =>
                                                                                                        pi === idx ? recalcProduct(Object.assign({}, p, { ferros: [...(p.ferros || []), copied] })) : p
                                                                                                    );
                                                                                                    setTempProducts(updated);
                                                                                                    if (activeQuote) handleProductSave(activeQuote.id, updated);
                                                                                                    showNotification('Elemento copiado!', 'success');
                                                                                                }}
                                                                                                className="bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-semibold py-1 px-2.5 rounded text-[10px] transition shadow-sm"
                                                                                            >
                                                                                                Duplicar
                                                                                            </button>
                                                                                            <button
                                                                                                onClick={() => {
                                                                                                    const updated = tempProducts.map((p, pi) =>
                                                                                                        pi === idx ? recalcProduct(Object.assign({}, p, { ferros: (p.ferros || []).filter((_, fi) => fi !== fIdx) })) : p
                                                                                                    );
                                                                                                    setTempProducts(updated);
                                                                                                    if (activeQuote) handleProductSave(activeQuote.id, updated);
                                                                                                }}
                                                                                                className="bg-red-600 hover:bg-red-700 text-white font-semibold py-1 px-2.5 rounded text-[10px] transition shadow-sm"
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
                                                            ) : (
                                                                <div className="p-8 text-center text-slate-400 font-semibold">
                                                                    Nenhum componente adicionado a esta peça.
                                                                </div>
                                                            )}
                                                        </div>
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
                                        setCheckoutAcrescimoPercent(activeQuote.acrescimoPercent?.toString() || '');
                                        setCheckoutAcrescimoReal(activeQuote.acrescimoReal?.toString() || '');
                                        setCheckoutDescontoPercent(activeQuote.descontoPercent?.toString() || '');
                                        setCheckoutDescontoReal(activeQuote.descontoReal?.toString() || '');
                                        setCheckoutCondicoesPagamento(activeQuote.condicoesPagamento || '');

                                        const pts = getQuoteTotalPoints(activeQuote);
                                        const kgBase = pts / (arameConfig?.ptsPorKg || 256);
                                        setCheckoutArameKg(activeQuote.arameKg?.toString() || (kgBase > 0 ? kgBase.toFixed(2) : ''));
                                        
                                        const arameLinkedGauge = arameConfig?.materialId ? gauges.find(g => g.id === arameConfig.materialId) : null;
                                        const preFillPreco = arameLinkedGauge?.purchasePrice?.toString() || activeQuote.aramePreco?.toString() || arameConfig?.precoPorKg?.toString() || '10';
                                        setCheckoutAramePreco(preFillPreco);

                                        setActiveModal({ type: 'checkout', quoteId: activeQuote.id });
                                    }}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-2.5 px-7 rounded text-sm transition shadow-sm"
                                >
                                    Continuar
                                </button>
                            </div>
                        </div>
                    )}

                    {/* MODAL: + Elemento (Corte e Dobra) */}
                    {showElementoModal && (
                        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
                            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl border border-slate-300 overflow-y-auto max-h-[95vh]">
                                <div className="flex items-center justify-between px-5 py-3 bg-[#0F3F5C] text-white rounded-t-xl">
                                    <h3 className="text-sm font-black uppercase tracking-wider">
                                        {elementoEditId ? '✏️ Editar Elemento' : '➕ Novo Elemento'} — <span className="underline">{elementoTargetGroupNome}</span>
                                    </h3>
                                    <button type="button" onClick={() => setShowElementoModal(false)} className="text-white text-xl font-bold w-7 h-7 flex items-center justify-center border border-white/40 rounded">×</button>
                                </div>
                                <div className="p-5 space-y-4">
                                    <div className="grid grid-cols-12 gap-3 items-end">
                                        <div className="col-span-4">
                                            <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">Nome do Elemento (opcional):</label>
                                            <div className="flex items-stretch border border-slate-300 rounded overflow-hidden">
                                                <div className="w-8 bg-slate-100 border-r border-slate-200 flex items-center justify-center shrink-0">
                                                    <span className="font-black text-xs text-slate-400">Nº</span>
                                                </div>
                                                <input type="text" value={elementoNomeElemento} onChange={e => setElementoNomeElemento(e.target.value)}
                                                    placeholder="Ex: BARRA PRINCIPAL"
                                                    className="w-full px-2 py-1.5 text-xs font-bold outline-none bg-transparent text-slate-800" />
                                            </div>
                                        </div>
                                        <div className="col-span-3">
                                            <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">Quantidade:</label>
                                            <div className={`flex items-stretch border rounded overflow-hidden ${elementoQtde ? 'border-emerald-400' : 'border-red-400'}`}>
                                                <div className={`w-8 border-r flex items-center justify-center shrink-0 ${elementoQtde ? 'bg-emerald-100 border-emerald-300' : 'bg-red-100 border-red-300'}`}>
                                                    <span className={`font-black text-xs ${elementoQtde ? 'text-emerald-600' : 'text-red-600'}`}>{elementoQtde ? '✓' : '✕'}</span>
                                                </div>
                                                <input type="number" min="1" value={elementoQtde} onChange={e => setElementoQtde(e.target.value)}
                                                    className={`w-full px-2 py-1.5 text-xs font-bold outline-none bg-transparent text-center ${elementoQtde ? 'text-slate-800' : 'text-red-500'}`} />
                                            </div>
                                        </div>
                                        <div className="col-span-5">
                                            <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">Bitola:</label>
                                            <div className={`flex items-stretch border rounded overflow-hidden ${elementoBitola ? 'border-emerald-400' : 'border-red-400'}`}>
                                                <div className={`w-8 border-r flex items-center justify-center shrink-0 ${elementoBitola ? 'bg-emerald-100 border-emerald-300' : 'bg-red-100 border-red-300'}`}>
                                                    <span className={`font-black text-xs ${elementoBitola ? 'text-emerald-600' : 'text-red-600'}`}>{elementoBitola ? '✓' : '✕'}</span>
                                                </div>
                                                <select value={elementoBitola} onChange={e => setElementoBitola(e.target.value)}
                                                    className={`w-full px-2 py-1.5 text-xs font-bold outline-none bg-transparent cursor-pointer ${elementoBitola ? 'text-emerald-700' : 'text-red-500'}`}>
                                                    <option value="">Selecione...</option>
                                                    {bitolas.filter(b => b.corteDobra).map(b => (
                                                        <option key={b.label} value={`${b.label},${b.kgm},${b.price || 0}`}>{b.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="shrink-0">
                                        <p className="text-xs text-slate-600 mb-3">Selecione o formato para Corte e Dobra:</p>
                                        <div className="flex flex-wrap gap-2">
                                            {estriboModels.filter(m => m.applications.includes('Corte e Dobra')).map(opt => (
                                                <label key={opt.id} className={"flex flex-col items-center justify-between gap-3 cursor-pointer p-4 rounded border transition-all min-w-[120px] " + (elementoShapeId === opt.id ? 'border-slate-400 bg-slate-50' : 'border-slate-200')}>
                                                    <div className="h-24 w-full flex items-center justify-center pointer-events-none">
                                                        {renderEstriboSVG(opt.category, opt.name)}
                                                    </div>
                                                    <div className="flex flex-col items-center gap-1">
                                                        <input type="radio" name="elementoShapeId" checked={elementoShapeId === opt.id} onChange={() => setElementoShapeId(opt.id)} className="w-4 h-4 accent-blue-600" />
                                                        <span className="text-[10px] font-bold text-slate-500 text-center">{opt.name}</span>
                                                    </div>
                                                </label>
                                            ))}
                                            {estriboModels.filter(m => m.applications.includes('Corte e Dobra')).length === 0 && (
                                                <div className="text-sm text-slate-500 italic p-4">Nenhum modelo configurado para Corte e Dobra. Cadastre em Configurações {'>'} Estribos.</div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-4 mt-2 shrink-0">
                                        {(() => {
                                            const fields: { label: string, val: string, set: (v: string) => void, required: boolean }[] = [];
                                            
                                            const model = estriboModels.find(m => m.id === elementoShapeId && m.applications.includes('Corte e Dobra'));
                                            
                                            if (model && model.requiredSides && model.requiredSides.length > 0) {
                                                model.requiredSides.forEach(side => {
                                                    const isA = side === 'A';
                                                    const isDiam = isA && model.category === 'REDONDA';
                                                    const labelStr = isDiam ? 'Diâmetro (cm)' : `Lado ${side} (cm)`;
                                                    
                                                    if (side === 'A') fields.push({ label: labelStr, val: elementoLadoA, set: setElementoLadoA, required: true });
                                                    if (side === 'B') fields.push({ label: labelStr, val: elementoLadoB, set: setElementoLadoB, required: true });
                                                    if (side === 'C') fields.push({ label: labelStr, val: elementoLadoC, set: setElementoLadoC, required: true });
                                                    if (side === 'D') fields.push({ label: labelStr, val: elementoLadoD, set: setElementoLadoD, required: true });
                                                    if (side === 'E') fields.push({ label: labelStr, val: elementoLadoE, set: setElementoLadoE, required: true });
                                                    if (side === 'F') fields.push({ label: labelStr, val: elementoLadoF, set: setElementoLadoF, required: true });
                                                });
                                            } else {
                                                // Fallback to all 6 sides optional if no model selected or model has no sides
                                                fields.push({ label: 'Lado A (cm)', val: elementoLadoA, set: setElementoLadoA, required: false });
                                                fields.push({ label: 'Lado B (cm)', val: elementoLadoB, set: setElementoLadoB, required: false });
                                                fields.push({ label: 'Lado C (cm)', val: elementoLadoC, set: setElementoLadoC, required: false });
                                                fields.push({ label: 'Lado D (cm)', val: elementoLadoD, set: setElementoLadoD, required: false });
                                                fields.push({ label: 'Lado E (cm)', val: elementoLadoE, set: setElementoLadoE, required: false });
                                                fields.push({ label: 'Lado F (cm)', val: elementoLadoF, set: setElementoLadoF, required: false });
                                            }
                                            
                                            return fields.map(({ label, val, set, required }) => (
                                                <div key={label} className="w-48">
                                                    <label className="block text-xs font-black text-slate-600 uppercase mb-1">{label}</label>
                                                    <div className={"flex items-stretch border rounded overflow-hidden h-9 " + (val ? 'border-emerald-400' : required ? 'border-red-400' : 'border-slate-300')}>
                                                        <div className={"w-8 border-r flex items-center justify-center shrink-0 " + (val ? 'bg-emerald-100 border-emerald-300' : required ? 'bg-red-100 border-red-300' : 'bg-slate-50 border-slate-200')}>
                                                            <span className={"font-black text-xs " + (val ? 'text-emerald-600' : required ? 'text-red-600' : 'text-slate-400')}>{val ? '✓' : required ? '✘' : '—'}</span>
                                                        </div>
                                                        <input type="number" value={val} onChange={e => set(e.target.value)}
                                                            className="w-full px-2 text-sm text-blue-800 outline-none bg-transparent" />
                                                    </div>
                                                </div>
                                            ));
                                        })()}
                                    </div>

                                    <div className="bg-slate-50 border border-slate-200 rounded p-2.5 flex justify-between items-center">
                                        <span className="text-[10px] font-bold text-slate-600 uppercase">Comprimento Linear Total:</span>
                                        <span className="text-sm font-black text-slate-900">
                                            {(() => {
                                                const a = parseFloat(elementoLadoA) || 0;
                                                const b = parseFloat(elementoLadoB) || 0;
                                                const c = parseFloat(elementoLadoC) || 0;
                                                const d = parseFloat(elementoLadoD) || 0;
                                                const e = parseFloat(elementoLadoE) || 0;
                                                const f = parseFloat(elementoLadoF) || 0;
                                                return (a + b + c + d + e + f).toFixed(1) + ' cm';
                                            })()}
                                        </span>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">Observação (opcional):</label>
                                        <div className="flex items-stretch border border-slate-300 rounded overflow-hidden">
                                            <div className="w-8 bg-slate-100 border-r border-slate-200 flex items-center justify-center shrink-0">
                                                <span className="font-black text-xs text-slate-400">✕</span>
                                            </div>
                                            <input type="text" placeholder="OPCIONAL" value={elementoObs} onChange={e => setElementoObs(e.target.value)}
                                                className="w-full px-2 py-1.5 text-xs font-semibold text-slate-700 placeholder-slate-400 outline-none bg-transparent" />
                                        </div>
                                    </div>
                                </div>

                                <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-end gap-3">
                                    <button type="button" onClick={() => setShowElementoModal(false)}
                                        className="bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold py-1.5 px-4 rounded text-xs">
                                        Cancelar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (!elementoQtde || !elementoBitola) {
                                                showNotification('Preencha Quantidade e Bitola obrigatórios.', 'warning');
                                                return;
                                            }
                                            const bitolaKgmVal = parseFloat(elementoBitola.split(',')[1]) || 0;
                                            const newFerro: FerroItem = {
                                                id: elementoEditId || String(Date.now() + Math.random()),
                                                nomeElemento: elementoNomeElemento || 'ELEMENTO',
                                                qtde: parseInt(elementoQtde) || 1,
                                                bitola: elementoBitola,
                                                bitolaKgm: bitolaKgmVal,
                                                ferroModelId: ferroModelId || 'fm_1',
                                                ladoA: elementoLadoA,
                                                ladoB: elementoLadoB,
                                                ladoC: elementoLadoC,
                                                ladoD: elementoLadoD,
                                                ladoE: elementoLadoE,
                                                ladoF: elementoLadoF,
                                                obs: elementoObs,
                                                drawingType: 'CorteDobra',
                                                estriboShape: elementoShapeId,
                                            };
                                            const updated = tempProducts.map((p, pi) => {
                                                if (pi !== elementoTargetProdIdx) return p;
                                                let ferros = p.ferros || [];
                                                if (elementoEditId) {
                                                    ferros = ferros.map(f => f.id === elementoEditId ? newFerro : f);
                                                } else {
                                                    ferros = [...ferros, newFerro];
                                                }
                                                return recalcProduct({ ...p, ferros });
                                            });
                                            setTempProducts(updated);
                                            if (activeQuote) handleProductSave(activeQuote.id, updated);
                                            setShowElementoModal(false);
                                            showNotification(elementoEditId ? 'Elemento atualizado!' : 'Elemento adicionado!', 'success');
                                        }}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-1.5 px-5 rounded text-xs"
                                    >
                                        {elementoEditId ? 'Salvar Alterações' : 'Adicionar Elemento'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* MODAL: Alterar Bitolas em Lote */}
                    {showAlterarBitolasModal && (
                        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
                            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md border border-slate-300">
                                <div className="flex items-center justify-between px-5 py-3 bg-[#0F3F5C] text-white rounded-t-xl">
                                    <h3 className="text-sm font-black uppercase tracking-wider">🔩 Alterar Bitolas em Lote</h3>
                                    <button type="button" onClick={() => setShowAlterarBitolasModal(false)} className="text-white text-xl font-bold w-7 h-7 flex items-center justify-center border border-white/40 rounded">×</button>
                                </div>
                                <div className="p-5 space-y-4">
                                    <p className="text-xs text-slate-600 font-semibold">Selecione a nova bitola para aplicar a <strong>todos os elementos</strong> desta peça:</p>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">Nova Bitola:</label>
                                        <select value={alterarBitolasValue} onChange={e => setAlterarBitolasValue(e.target.value)}
                                            className="w-full border border-slate-300 rounded px-3 py-2 text-xs font-bold text-slate-700 outline-none cursor-pointer">
                                            <option value="">Selecione...</option>
                                            {bitolas.map(b => (
                                                <option key={b.label} value={`${b.label},${b.kgm},${b.price || 0}`}>{b.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="px-5 py-3 border-t border-slate-200 flex justify-end gap-3">
                                    <button type="button" onClick={() => setShowAlterarBitolasModal(false)}
                                        className="bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold py-1.5 px-4 rounded text-xs">
                                        Cancelar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (!alterarBitolasValue) {
                                                showNotification('Selecione uma bitola.', 'warning');
                                                return;
                                            }
                                            const newKgm = parseFloat(alterarBitolasValue.split(',')[1]) || 0;
                                            const updated = tempProducts.map((p, pi) => {
                                                if (pi !== alterarBitolasTargetIdx) return p;
                                                const ferros = (p.ferros || []).map(f => ({ ...f, bitola: alterarBitolasValue, bitolaKgm: newKgm }));
                                                return recalcProduct({ ...p, ferros });
                                            });
                                            setTempProducts(updated);
                                            if (activeQuote) handleProductSave(activeQuote.id, updated);
                                            setShowAlterarBitolasModal(false);
                                            showNotification('Bitolas alteradas em todos os elementos!', 'success');
                                        }}
                                        className="bg-[#0F3F5C] hover:bg-sky-900 text-white font-extrabold py-1.5 px-5 rounded text-xs"
                                    >
                                        Aplicar a Todos
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* MODAL: Preview Desenho Técnico */}
                    {showPreviewAttachmentModal && (
                        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" onClick={() => setShowPreviewAttachmentModal(false)}>
                            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl border border-slate-300 overflow-hidden" onClick={e => e.stopPropagation()}>
                                <div className="flex items-center justify-between px-5 py-3 bg-[#0F3F5C] text-white rounded-t-xl">
                                    <h3 className="text-sm font-black uppercase tracking-wider">📎 {previewAttachmentName}</h3>
                                    <button type="button" onClick={() => setShowPreviewAttachmentModal(false)} className="text-white text-xl font-bold w-7 h-7 flex items-center justify-center border border-white/40 rounded">×</button>
                                </div>
                                <div className="p-4 flex items-center justify-center min-h-[300px] bg-slate-100">
                                    {previewAttachmentData.startsWith('data:image') ? (
                                        <img src={previewAttachmentData} alt={previewAttachmentName} className="max-w-full max-h-[60vh] object-contain rounded shadow" />
                                    ) : (
                                        <div className="text-center text-slate-500 space-y-3">
                                            <div className="text-4xl">📄</div>
                                            <p className="font-semibold text-sm">{previewAttachmentName}</p>
                                            <a href={previewAttachmentData} download={previewAttachmentName}
                                                className="inline-block bg-sky-600 text-white font-bold py-2 px-4 rounded text-xs">
                                                ⬇️ Baixar Arquivo
                                            </a>
                                        </div>
                                    )}
                                </div>
                                <div className="px-5 py-3 border-t flex justify-end">
                                    <button type="button" onClick={() => setShowPreviewAttachmentModal(false)}
                                        className="bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold py-1.5 px-4 rounded text-xs">
                                        Fechar
                                    </button>
                                </div>
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
                                                    {bitolas.filter(b => b.amarrado).map(b => (
                                                        <option key={b.label} value={`${b.label},${b.kgm},${b.price || 0}`}>{b.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Row 2: Selecione o formato */}
                                    <div className="flex gap-4">
                                        <div className="w-1/2">
                                            <p className="text-[10px] font-black text-slate-600 uppercase mb-2">Formato do Ferro:</p>
                                            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                                                {ferroModels.map(model => (
                                                    <label key={model.id} className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${ferroModelId === model.id ? 'bg-sky-50 border-sky-400' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                                                        <input type="radio" name="ferroModelId" value={model.id} checked={ferroModelId === model.id} onChange={(e) => setFerroModelId(e.target.value)} className="accent-sky-600" />
                                                        <span className="text-[10px] font-bold text-slate-700 uppercase">{model.name}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="w-1/2 flex items-center justify-center min-h-[120px] bg-slate-50 border border-slate-200 rounded">
                                            {(() => {
                                                const model = ferroModels.find(m => m.id === ferroModelId);
                                                if (!model) return <span className="text-xs text-slate-400 font-bold uppercase">Selecione um formato</span>;
                                                return <div className="scale-100 origin-center">{renderEstriboSVG('4 LADOS', model.id, ferroLadoA, ferroLadoB, ferroLadoC, ferroLadoD, ferroLadoE, ferroLadoF, ferroModels)}</div>;
                                            })()}
                                        </div>
                                    </div>

                                    {/* Row 3: Lados Dinâmicos */}
                                    <div className="grid grid-cols-6 gap-2">
                                        {(() => {
                                            const model = ferroModels.find(m => m.id === ferroModelId);
                                            const sides = model && model.requiredSides && model.requiredSides.length > 0 ? model.requiredSides : ['A'];
                                            const fields = [];
                                            const sideData: Record<string, {val: string, set: React.Dispatch<React.SetStateAction<string>>}> = {
                                                'A': { val: ferroLadoA, set: setFerroLadoA },
                                                'B': { val: ferroLadoB, set: setFerroLadoB },
                                                'C': { val: ferroLadoC, set: setFerroLadoC },
                                                'D': { val: ferroLadoD, set: setFerroLadoD },
                                                'E': { val: ferroLadoE, set: setFerroLadoE },
                                                'F': { val: ferroLadoF, set: setFerroLadoF },
                                            };
                                            sides.forEach(side => {
                                                if (sideData[side]) {
                                                    fields.push({ label: `Lado ${side} (cm)`, val: sideData[side].val, set: sideData[side].set, required: true });
                                                }
                                            });
                                            if (fields.length === 0) fields.push({ label: 'Lado A (cm)', val: ferroLadoA, set: setFerroLadoA, required: true });

                                            return fields.map(({ label, val, set, required }) => (
                                                <div key={label}>
                                                    <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">{label}:</label>
                                                    <div className={`flex items-stretch border rounded overflow-hidden ${val ? 'border-emerald-400' : required ? 'border-red-400' : 'border-slate-300'}`}>
                                                        <div className={`w-7 border-r flex items-center justify-center shrink-0 ${val ? 'bg-emerald-100 border-emerald-300' : 'bg-red-100 border-red-300'}`}>
                                                            <span className={`font-black text-xs ${val ? 'text-emerald-600' : 'text-red-600'}`}>{val ? '✓' : '✕'}</span>
                                                        </div>
                                                        <input type="number" value={val} onChange={e => set(e.target.value)}
                                                            className={`w-full px-1.5 py-1.5 text-xs font-bold outline-none bg-transparent text-center ${val ? 'text-slate-800' : 'text-red-500'}`} />
                                                    </div>
                                                </div>
                                            ));
                                        })()}
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
                                            
                                            let updated;
                                            if (ferroEditId) {
                                                updated = tempProducts.map((p, pi) =>
                                                    pi === ferroTargetProdIdx
                                                        ? recalcProduct(Object.assign({}, p, {
                                                            ferros: (p.ferros || []).map(f =>
                                                                f.id === ferroEditId
                                                                    ? Object.assign({}, f, { nomeElemento: ferroNomeElemento, qtde: parseInt(ferroQtde), bitola: bitolaLabel + ',' + bitolaKgm, bitolaKgm, ferroModelId: ferroModelId, ladoA: ferroLadoA, ladoB: ferroLadoB, ladoC: ferroLadoC, ladoD: ferroLadoD, ladoE: ferroLadoE, ladoF: ferroLadoF, obs: ferroObs })
                                                                    : f
                                                            )
                                                        }))
                                                        : p
                                                );
                                            } else {
                                                const newFerro = {
                                                    id: String(Date.now() + Math.random()),
                                                    nomeElemento: ferroNomeElemento || 'FERRO',
                                                    qtde: parseInt(ferroQtde),
                                                    bitola: bitolaLabel + ',' + bitolaKgm,
                                                    bitolaKgm,
                                                    ferroModelId: ferroModelId || 'fm_1',
                                                    ladoA: ferroLadoA,
                                                    ladoB: ferroLadoB,
                                                    ladoC: ferroLadoC,
                                                    ladoD: ferroLadoD,
                                                    ladoE: ferroLadoE,
                                                    obs: ferroObs,
                                                };
                                                updated = tempProducts.map((p, pi) =>
                                                    pi === ferroTargetProdIdx
                                                        ? recalcProduct(Object.assign({}, p, { ferros: [...(p.ferros || []), newFerro] }))
                                                        : p
                                                );
                                            }
                                            setTempProducts(updated);
                                            if (activeQuote) handleProductSave(activeQuote.id, updated);
                                            setShowFerrosModal(false);
                                            setFerroEditId(null);
                                            showNotification(ferroEditId ? 'Elemento atualizado!' : 'Elemento adicionado!', 'success');
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

                    
                    {/* MODAL: Trava sub-modal */}
                    {showTravaModal && (() => {
                        const requiredSides = getTravaRequiredSides(travaShapeId);
                        
                        return (
                            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40">
                                <div className="bg-white rounded shadow-2xl w-full max-w-2xl border border-slate-300 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[95vh]">
                                    {/* Header */}
                                    <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 shrink-0">
                                        <h3 className="text-base font-black text-slate-800 uppercase tracking-wider">
                                            {travaEditId ? 'EDITAR TRAVA' : 'TRAVAS'}
                                        </h3>
                                        <button
                                            type="button"
                                            onClick={() => { setShowTravaModal(false); setTravaEditId(null); }}
                                            className="text-slate-400 hover:text-slate-700 text-xl font-bold w-6 h-6 flex items-center justify-center border border-slate-200 rounded transition"
                                        >
                                            ×
                                        </button>
                                    </div>

                                    <div className="p-5 overflow-y-auto space-y-6">
                                        {/* Row 1: Nome Elemento, Qtde, Bitola */}
                                        <div className="grid grid-cols-12 gap-3 items-end">
                                            <div className="col-span-5">
                                                <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">NOME ELEMENTO:</label>
                                                <div className={"flex items-stretch border rounded overflow-hidden " + (travaNomeElemento ? 'border-emerald-400' : 'border-red-400')}>
                                                    <div className={"w-6 border-r flex items-center justify-center shrink-0 " + (travaNomeElemento ? 'bg-emerald-100 border-emerald-300' : 'bg-red-100 border-red-300')}>
                                                        <span className={"font-black text-[10px] " + (travaNomeElemento ? 'text-emerald-600' : 'text-red-600')}>#</span>
                                                    </div>
                                                    <input type="text" placeholder="OPCIONAL" value={travaNomeElemento} onChange={e => setTravaNomeElemento(e.target.value)}
                                                        className="w-full px-2 py-1.5 text-xs font-bold outline-none bg-transparent text-slate-800" />
                                                </div>
                                            </div>
                                            <div className="col-span-3">
                                                <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">QTDE:</label>
                                                <div className={"flex items-stretch border rounded overflow-hidden " + (travaQtde ? 'border-emerald-400' : 'border-red-400')}>
                                                    <div className={"w-6 border-r flex items-center justify-center shrink-0 " + (travaQtde ? 'bg-emerald-100 border-emerald-300' : 'bg-red-100 border-red-300')}>
                                                        <span className={"font-black text-[10px] " + (travaQtde ? 'text-emerald-600' : 'text-red-600')}>#</span>
                                                    </div>
                                                    <input type="number" min="1" value={travaQtde} onChange={e => setTravaQtde(e.target.value)}
                                                        className="w-full px-2 py-1.5 text-xs font-bold outline-none bg-transparent text-slate-800 text-center" />
                                                </div>
                                            </div>
                                            <div className="col-span-4">
                                                <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">BITOLA:</label>
                                                <div className={"flex items-stretch border rounded overflow-hidden " + (travaBitola ? 'border-emerald-400' : 'border-red-400')}>
                                                    <div className={"w-6 border-r flex items-center justify-center shrink-0 " + (travaBitola ? 'bg-emerald-100 border-emerald-300' : 'bg-red-100 border-red-300')}>
                                                        <span className={"font-black text-[10px] " + (travaBitola ? 'text-emerald-600' : 'text-red-600')}>#</span>
                                                    </div>
                                                    <select value={travaBitola} onChange={e => setTravaBitola(e.target.value)}
                                                        className="w-full px-2 py-1.5 text-[10px] font-bold outline-none bg-transparent cursor-pointer text-slate-800">
                                                        <option value="">Selecione...</option>
                                                        {bitolas.filter(b => b.amarrado).map(b => (
                                                            <option key={b.label} value={`${b.label},${b.kgm},${b.price || 0}`}>{b.label}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Row 2: Formatos Grid */}
                                        <div className="grid grid-cols-4 gap-4 p-4 border border-slate-200 rounded-lg bg-slate-50">
                                            {[1, 2, 3, 4, 5, 6, 7, 8].map(shape => (
                                                <label key={shape} className={"flex flex-col items-center gap-2 cursor-pointer p-2 rounded-lg border-2 transition-all " + (travaShapeId === shape ? 'border-blue-500 bg-blue-50' : 'border-transparent hover:border-slate-300')}>
                                                    <div className="h-16 w-full pointer-events-none">
                                                        {renderTravaSVG(shape)}
                                                    </div>
                                                    <input 
                                                        type="radio" 
                                                        name="travaShape" 
                                                        checked={travaShapeId === shape} 
                                                        onChange={() => setTravaShapeId(shape)}
                                                        className="w-4 h-4 accent-blue-600"
                                                    />
                                                </label>
                                            ))}
                                        </div>

                                        {/* Row 3: Campos de Lados */}
                                        <div className="flex flex-wrap gap-3">
                                            {requiredSides.includes('A') && (
                                                <div className="w-24">
                                                    <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">LADO A (CM)</label>
                                                    <div className={"flex items-stretch border rounded overflow-hidden " + (travaLadoA ? 'border-emerald-400' : 'border-red-400')}>
                                                        <div className={"w-5 border-r flex items-center justify-center shrink-0 " + (travaLadoA ? 'bg-emerald-100 border-emerald-300' : 'bg-red-100 border-red-300')}>
                                                            <span className={"font-black text-[9px] " + (travaLadoA ? 'text-emerald-600' : 'text-red-600')}>#</span>
                                                        </div>
                                                        <input type="number" value={travaLadoA} onChange={e => setTravaLadoA(e.target.value)}
                                                            className="w-full px-1 py-1 text-xs font-bold outline-none bg-transparent text-slate-800 text-center" />
                                                    </div>
                                                </div>
                                            )}
                                            {requiredSides.includes('B') && (
                                                <div className="w-24">
                                                    <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">LADO B (CM)</label>
                                                    <div className={"flex items-stretch border rounded overflow-hidden " + (travaLadoB ? 'border-emerald-400' : 'border-red-400')}>
                                                        <div className={"w-5 border-r flex items-center justify-center shrink-0 " + (travaLadoB ? 'bg-emerald-100 border-emerald-300' : 'bg-red-100 border-red-300')}>
                                                            <span className={"font-black text-[9px] " + (travaLadoB ? 'text-emerald-600' : 'text-red-600')}>#</span>
                                                        </div>
                                                        <input type="number" value={travaLadoB} onChange={e => setTravaLadoB(e.target.value)}
                                                            className="w-full px-1 py-1 text-xs font-bold outline-none bg-transparent text-slate-800 text-center" />
                                                    </div>
                                                </div>
                                            )}
                                            {requiredSides.includes('C') && (
                                                <div className="w-24">
                                                    <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">LADO C (CM)</label>
                                                    <div className={"flex items-stretch border rounded overflow-hidden " + (travaLadoC ? 'border-emerald-400' : 'border-red-400')}>
                                                        <div className={"w-5 border-r flex items-center justify-center shrink-0 " + (travaLadoC ? 'bg-emerald-100 border-emerald-300' : 'bg-red-100 border-red-300')}>
                                                            <span className={"font-black text-[9px] " + (travaLadoC ? 'text-emerald-600' : 'text-red-600')}>#</span>
                                                        </div>
                                                        <input type="number" value={travaLadoC} onChange={e => setTravaLadoC(e.target.value)}
                                                            className="w-full px-1 py-1 text-xs font-bold outline-none bg-transparent text-slate-800 text-center" />
                                                    </div>
                                                </div>
                                            )}
                                            {requiredSides.includes('D') && (
                                                <div className="w-24">
                                                    <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">LADO D (CM)</label>
                                                    <div className={"flex items-stretch border rounded overflow-hidden " + (travaLadoD ? 'border-emerald-400' : 'border-red-400')}>
                                                        <div className={"w-5 border-r flex items-center justify-center shrink-0 " + (travaLadoD ? 'bg-emerald-100 border-emerald-300' : 'bg-red-100 border-red-300')}>
                                                            <span className={"font-black text-[9px] " + (travaLadoD ? 'text-emerald-600' : 'text-red-600')}>#</span>
                                                        </div>
                                                        <input type="number" value={travaLadoD} onChange={e => setTravaLadoD(e.target.value)}
                                                            className="w-full px-1 py-1 text-xs font-bold outline-none bg-transparent text-slate-800 text-center" />
                                                    </div>
                                                </div>
                                            )}
                                            {requiredSides.includes('E') && (
                                                <div className="w-24">
                                                    <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">LADO E (CM)</label>
                                                    <div className={"flex items-stretch border rounded overflow-hidden " + (travaLadoE ? 'border-emerald-400' : 'border-red-400')}>
                                                        <div className={"w-5 border-r flex items-center justify-center shrink-0 " + (travaLadoE ? 'bg-emerald-100 border-emerald-300' : 'bg-red-100 border-red-300')}>
                                                            <span className={"font-black text-[9px] " + (travaLadoE ? 'text-emerald-600' : 'text-red-600')}>#</span>
                                                        </div>
                                                        <input type="number" value={travaLadoE} onChange={e => setTravaLadoE(e.target.value)}
                                                            className="w-full px-1 py-1 text-xs font-bold outline-none bg-transparent text-slate-800 text-center" />
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Row 4: Observação */}
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">OBSERVAÇÃO:</label>
                                            <div className="flex items-stretch border border-slate-300 rounded overflow-hidden">
                                                <div className="w-6 bg-slate-100 border-r border-slate-300 flex items-center justify-center shrink-0">
                                                    <span className="font-black text-[10px] text-slate-500">#</span>
                                                </div>
                                                <input type="text" placeholder="OPCIONAL" value={travaObs} onChange={e => setTravaObs(e.target.value)}
                                                    className="w-full px-2 py-1.5 text-xs font-bold outline-none bg-transparent text-slate-800" />
                                            </div>
                                        </div>

                                    </div>

                                    {/* Footer */}
                                    <div className="flex justify-start gap-3 px-5 py-4 border-t border-slate-200 bg-slate-50 shrink-0">
                                        <button
                                            type="button"
                                            disabled={!travaQtde || !travaBitola}
                                            onClick={() => {
                                                if (!travaQtde || !travaBitola) return;
                                                const [bitolaLabel, bitolaKgmStr] = travaBitola.split(',');
                                                const bitolaKgm = parseFloat(bitolaKgmStr) || 0;

                                                if (travaEditId) {
                                                    const updated = tempProducts.map((p, pi) =>
                                                        pi === travaTargetProdIdx
                                                            ? recalcProduct(Object.assign({}, p, {
                                                                ferros: (p.ferros || []).map(f =>
                                                                    f.id === travaEditId
                                                                        ? Object.assign({}, f, {
                                                                            nomeElemento: travaNomeElemento || 'TRAVA',
                                                                            qtde: parseInt(travaQtde) || 1,
                                                                            bitola: travaBitola,
                                                                            bitolaKgm,
                                                                            estriboShape: String(travaShapeId),
                                                                            ladoA: travaLadoA,
                                                                            ladoB: travaLadoB,
                                                                            ladoC: travaLadoC,
                                                                            ladoD: travaLadoD,
                                                                            ladoE: travaLadoE,
                                                                            obs: travaObs,
                                                                        })
                                                                        : f
                                                                )
                                                            }))
                                                            : p
                                                    );
                                                    setTempProducts(updated);
                                                    if (activeQuote) handleProductSave(activeQuote.id, updated);
                                                    setShowTravaModal(false);
                                                    setTravaEditId(null);
                                                    showNotification('Trava atualizada!', 'success');
                                                } else {
                                                    const newTrava = {
                                                        id: String(Date.now() + Math.random()),
                                                        nomeElemento: travaNomeElemento || 'TRAVA',
                                                        qtde: parseInt(travaQtde) || 1,
                                                        bitola: travaBitola,
                                                        bitolaKgm,
                                                        drawingType: 'Trava',
                                                        estriboShape: String(travaShapeId),
                                                        ladoA: travaLadoA,
                                                        ladoB: travaLadoB,
                                                        ladoC: travaLadoC,
                                                        ladoD: travaLadoD,
                                                        ladoE: travaLadoE,
                                                        obs: travaObs,
                                                    };
                                                    const updated = tempProducts.map((p, pi) =>
                                                        pi === travaTargetProdIdx
                                                            ? recalcProduct(Object.assign({}, p, { ferros: [...(p.ferros || []), newTrava] }))
                                                            : p
                                                    );
                                                    setTempProducts(updated);
                                                    if (activeQuote) handleProductSave(activeQuote.id, updated);
                                                    setShowTravaModal(false);
                                                    showNotification('Trava adicionada!', 'success');
                                                }
                                            }}
                                            className="bg-[#1565C0] hover:bg-[#0D47A1] disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold py-2 px-5 rounded text-sm transition shadow"
                                        >
                                            {travaEditId ? 'atualizar' : 'salvar elemento'}
                                        </button>
                                        <button type="button" onClick={() => { setShowTravaModal(false); setTravaEditId(null); }} className="text-slate-600 hover:text-slate-800 font-bold py-2 px-4 text-sm transition bg-slate-200 hover:bg-slate-300 rounded">
                                            cancelar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* MODAL: Estribos sub-modal */}
                    {showEstribosModal && (() => {
                        const prod = tempProducts[estriboTargetProdIdx];
                        let lados = '4 LADOS';
                        let parentAreaName = 'Outros';
                        if (prod) {
                            const m = prod.description.match(/(\d+ LADOS|REDONDA)/);
                            if (m) lados = m[1];
                            
                            const descUpper = prod.description.toUpperCase();
                            if (descUpper.startsWith('COLUNA')) parentAreaName = 'Coluna';
                            else if (descUpper.startsWith('PILAR')) parentAreaName = 'Pilar';
                            else if (descUpper.startsWith('BROCA')) parentAreaName = 'Broca';
                            else if (descUpper.startsWith('VIGA SUPERIOR')) parentAreaName = 'Viga Superior';
                            else if (descUpper.startsWith('VIGA BALDRAME')) parentAreaName = 'Viga Baldrame';
                            else if (descUpper.startsWith('VIGA')) parentAreaName = 'Viga Superior';
                            else if (descUpper.startsWith('SAPATA')) parentAreaName = 'Sapata';
                            else if (descUpper.startsWith('CORTE E DOBRA')) parentAreaName = 'Corte e Dobra';
                        }

                        const isEstriboFormValid = () => {
                            if (!estriboQtde || !estriboBitola) return false;
                            const model = estriboModels.find(m => m.name === estriboShapeType && m.category === lados);
                            if (model && model.requiredSides) {
                                for (const side of model.requiredSides) {
                                    if (side === 'A' && !estriboLadoA) return false;
                                    if (side === 'B' && !estriboLadoB) return false;
                                    if (side === 'C' && !estriboLadoC) return false;
                                    if (side === 'D' && !estriboLadoD) return false;
                                    if (side === 'E' && !estriboLadoE) return false;
                                    if (side === 'F' && !estriboLadoF) return false;
                                }
                                return true;
                            }
                            
                            // Fallback logic
                            if (lados === 'REDONDA') {
                                if (!estriboLadoA) return false;
                                if (estriboShapeType === 'Definir transpasse' && !estriboLadoB) return false;
                                if (estriboShapeType === 'Transpasse Dobrado' && (!estriboLadoB || !estriboLadoC)) return false;
                            } else if (lados === '3 LADOS') {
                                if (!estriboLadoA || !estriboLadoB) return false;
                            } else if (lados === '4 LADOS') {
                                if (estriboShapeType === 'L') {
                                    if (!estriboLadoA || !estriboLadoB) return false;
                                } else if (estriboShapeType === 'Reto') {
                                    if (!estriboLadoA) return false;
                                } else if (estriboShapeType === 'Padrão' || estriboShapeType === 'U') {
                                    if (!estriboLadoA || !estriboLadoC) return false;
                                } else if (estriboShapeType === 'U Dobras Ext') {
                                    if (!estriboLadoA || !estriboLadoC || !estriboLadoD) return false;
                                } else if (estriboShapeType === 'U Dobras Int') {
                                    if (!estriboLadoA || !estriboLadoC || !estriboLadoD || !estriboLadoE) return false;
                                } else if (estriboShapeType === 'Especial') {
                                    if (!estriboLadoA || !estriboLadoB || !estriboLadoC || !estriboLadoD || !estriboLadoE || !estriboLadoF) return false;
                                } else {
                                    if (!estriboLadoA || !estriboLadoB) return false;
                                }
                            } else {
                                if (!estriboLadoA || !estriboLadoB || !estriboLadoC) return false;
                            }
                            return true;
                        };

                        return (
                            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40">
                                <div className="bg-white shadow-2xl w-full max-w-4xl flex flex-col max-h-[95vh]">
                                    {/* Header */}
                                    <div className="flex items-center justify-between px-6 py-4 shrink-0">
                                        <h3 className="text-lg text-slate-500 uppercase tracking-wide">
                                            ESTRIBOS PARA <span className="font-bold text-slate-700 underline">{estriboTargetColunaNome}</span>
                                        </h3>
                                        <button
                                            type="button"
                                            onClick={() => setShowEstribosModal(false)}
                                            className="text-slate-400 hover:text-slate-600 border border-slate-200 w-8 h-8 flex items-center justify-center bg-slate-50 text-xl font-bold"
                                        >
                                            ×
                                        </button>
                                    </div>
                                    <hr className="border-slate-100 shrink-0" />

                                    <div className="p-6 overflow-y-auto flex flex-col gap-6">
                                        {/* Row 1: Nome, Espac, Qtde, Bitola */}
                                        <div className="space-y-4 shrink-0">
                                            <div className="w-full md:w-1/2">
                                                <label className="block text-xs font-black text-slate-600 uppercase mb-1">NOME ELEMENTO:</label>
                                                <div className="flex items-stretch border border-red-300 rounded overflow-hidden h-9">
                                                    <div className="w-8 bg-red-50 border-r border-red-300 flex items-center justify-center shrink-0">
                                                        <span className="font-black text-xs text-red-600">✘</span>
                                                    </div>
                                                    <input type="text" placeholder="OPCIONAL" value={estriboNomeElemento} onChange={e => setEstriboNomeElemento(e.target.value.toUpperCase())} className="w-full px-2 text-sm text-slate-700 outline-none" />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div>
                                                    <label className="block text-xs font-black text-slate-600 uppercase mb-1">ESPAÇ. ESTRIBOS (CM):</label>
                                                    <div className="flex items-stretch border border-red-300 rounded overflow-hidden h-9">
                                                        <div className="w-8 bg-red-50 border-r border-red-300 flex items-center justify-center shrink-0">
                                                            <span className="font-black text-xs text-red-600">✘</span>
                                                        </div>
                                                        <input type="number" value={estriboEspacamento} onChange={e => {
                                                            const val = e.target.value;
                                                            setEstriboEspacamento(val);
                                                            if (estriboCalcAutomatico && val && prod) {
                                                                const principal = (prod.ferros || []).find(f => f.drawingType !== 'Estribo' && f.drawingType !== 'Trava');
                                                                if (principal && principal.ladoA) {
                                                                    const compCm = parseFloat(principal.ladoA);
                                                                    const espac = parseFloat(val);
                                                                    let area1 = prod.areaSemEstr1 || 0;
                                                                    let area2 = prod.areaSemEstr2 || 0;
                                                                    if (!area1 && !area2 && prod.description) {
                                                                        const match = prod.description.match(/x\s+(\d+(?:\.\d+)?)\s+CM(?:\s+\/\s+(\d+(?:\.\d+)?)\s+CM)?/i);
                                                                        if (match) {
                                                                            area1 = parseFloat(match[1]) || 0;
                                                                            area2 = parseFloat(match[2]) || 0;
                                                                        }
                                                                    }
                                                                    const areaDisponivel = Math.max(0, compCm - area1 - area2);
                                                                    if (!isNaN(compCm) && !isNaN(espac) && espac > 0) {
                                                                        setEstriboQtde(Math.ceil(areaDisponivel / espac).toString());
                                                                    }
                                                                }
                                                            }
                                                        }} className="w-full px-2 text-sm text-slate-700 outline-none" />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-black text-slate-600 uppercase mb-1">QTDE. ESTRIBOS:</label>
                                                    <div className="flex items-stretch border border-red-300 rounded overflow-hidden h-9">
                                                        <div className="w-8 bg-red-50 border-r border-red-300 flex items-center justify-center shrink-0">
                                                            <span className="font-black text-xs text-red-600">✘</span>
                                                        </div>
                                                        <input type="number" min="1" value={estriboQtde} onChange={e => { setEstriboQtde(e.target.value); setEstriboCalcAutomatico(false); }} className="w-full px-2 text-sm text-slate-700 outline-none" />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-black text-slate-600 uppercase mb-1">BITOLA:</label>
                                                    <div className="flex items-stretch border border-blue-600 rounded overflow-hidden h-9">
                                                        <div className="w-8 bg-red-50 border-r border-red-300 flex items-center justify-center shrink-0">
                                                            <span className="font-black text-xs text-red-600">✘</span>
                                                        </div>
                                                        <select value={estriboBitola} onChange={e => setEstriboBitola(e.target.value)} className="w-full px-2 text-sm font-bold text-blue-800 outline-none cursor-pointer bg-white">
                                                            <option value="">Selecione...</option>
                                                            {bitolas.filter(b => b.amarrado).map(opt => (
                                                                <option key={opt.label} value={`${opt.label},${opt.kgm},${opt.price || 0}`}>{opt.label}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center gap-2 mt-2">
                                                <input type="checkbox" checked={estriboCalcAutomatico} onChange={e => {
                                                    const checked = e.target.checked;
                                                    setEstriboCalcAutomatico(checked);
                                                    if (checked && estriboEspacamento && prod && prod.ferros && prod.ferros.length > 0) {
                                                        const principal = prod.ferros.find(f => f.drawingType !== 'Estribo' && f.drawingType !== 'Trava');
                                                        if (principal && principal.ladoA) {
                                                            const compCm = parseFloat(principal.ladoA);
                                                            const espac = parseFloat(estriboEspacamento);
                                                            if (!isNaN(compCm) && !isNaN(espac) && espac > 0) {
                                                                setEstriboQtde(Math.ceil(compCm / espac).toString());
                                                            }
                                                        } else {
                                                            showNotification('Não há ferro principal com comprimento (Lado A) para o cálculo.', 'warning');
                                                            setEstriboCalcAutomatico(false);
                                                        }
                                                    }
                                                }} className="w-4 h-4 accent-slate-400" />
                                                <span className="text-xs font-bold text-slate-500">Cálculo automático <span className="font-normal">(Espaçamento deve estar preenchido)</span></span>
                                            </div>
                                        </div>

                                        <hr className="border-slate-300 border-t-2 shrink-0" />

                                        {/* Row 2: Selecione o estribo */}
                                        <div className="shrink-0">
                                            <p className="text-xs text-slate-600 mb-3">Selecione o estribo que será usado (AMARRADA):</p>
                                            
                                            <div className="flex flex-wrap gap-2">
                                                {estriboModels.filter(m => m.category === lados && m.applications.includes(parentAreaName)).map(opt => (
                                                    <label key={opt.id} className={"flex flex-col items-center justify-between gap-3 cursor-pointer p-4 rounded border transition-all min-w-[120px] " + (estriboShapeType === opt.name ? 'border-slate-400 bg-slate-50' : 'border-slate-200')}>
                                                        <div className="h-24 w-full flex items-center justify-center pointer-events-none">
                                                            {renderEstriboSVG(lados, opt.name)}
                                                        </div>
                                                        <div className="flex flex-col items-center gap-1">
                                                            <input type="radio" name="estriboShapeType" checked={estriboShapeType === opt.name} onChange={() => setEstriboShapeType(opt.name)} className="w-4 h-4 accent-blue-600" />
                                                            <span className="text-[10px] font-bold text-slate-500 text-center">{opt.name}</span>
                                                        </div>
                                                    </label>
                                                ))}
                                                {estriboModels.filter(m => m.category === lados && m.applications.includes(parentAreaName)).length === 0 && (
                                                    <div className="text-sm text-slate-500 italic p-4">Nenhum modelo configurado para esta área ({parentAreaName}) e categoria ({lados}).</div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Row 3: Lados A-E Dinâmicos */}
                                        <div className="flex flex-wrap gap-4 mt-2 shrink-0">
                                            {(() => {
                                                const fields: { label: string, val: string, set: (v: string) => void, required: boolean }[] = [];
                                                
                                                const model = estriboModels.find(m => m.name === estriboShapeType && m.category === lados);
                                                
                                                if (model && model.requiredSides) {
                                                    model.requiredSides.forEach(side => {
                                                        const isA = side === 'A';
                                                        const isDiam = isA && lados === 'REDONDA';
                                                        const labelStr = isDiam ? 'Diâmetro (cm)' : `Lado ${side} (cm)`;
                                                        
                                                        if (side === 'A') fields.push({ label: labelStr, val: estriboLadoA, set: setEstriboLadoA, required: true });
                                                        if (side === 'B') fields.push({ label: labelStr, val: estriboLadoB, set: setEstriboLadoB, required: true });
                                                        if (side === 'C') fields.push({ label: labelStr, val: estriboLadoC, set: setEstriboLadoC, required: true });
                                                        if (side === 'D') fields.push({ label: labelStr, val: estriboLadoD, set: setEstriboLadoD, required: true });
                                                        if (side === 'E') fields.push({ label: labelStr, val: estriboLadoE, set: setEstriboLadoE, required: true });
                                                        if (side === 'F') fields.push({ label: labelStr, val: estriboLadoF, set: setEstriboLadoF, required: true });
                                                    });
                                                } else {
                                                    // Fallback
                                                    fields.push({ label: 'Lado A (cm)', val: estriboLadoA, set: setEstriboLadoA, required: true });
                                                    fields.push({ label: 'Lado B (cm)', val: estriboLadoB, set: setEstriboLadoB, required: true });
                                                }
                                                
                                                return fields.map(({ label, val, set, required }) => (
                                                    <div key={label} className="w-48">
                                                        <label className="block text-xs font-black text-slate-600 uppercase mb-1">{label}</label>
                                                        <div className={"flex items-stretch border rounded overflow-hidden h-9 " + (val ? 'border-emerald-400' : required ? 'border-red-400' : 'border-slate-300')}>
                                                            <div className={"w-8 border-r flex items-center justify-center shrink-0 " + (val ? 'bg-emerald-100 border-emerald-300' : required ? 'bg-red-100 border-red-300' : 'bg-slate-50 border-slate-200')}>
                                                                <span className={"font-black text-xs " + (val ? 'text-emerald-600' : required ? 'text-red-600' : 'text-slate-400')}>{val ? '✓' : '✘'}</span>
                                                            </div>
                                                            <input type="number" value={val} onChange={e => set(e.target.value)}
                                                                className="w-full px-2 text-sm text-blue-800 outline-none bg-transparent" />
                                                        </div>
                                                    </div>
                                                ));
                                            })()}
                                        </div>
                                        {lados === '3 LADOS' && (
                                            <p className="text-sm font-bold text-slate-600 mt-1 shrink-0">
                                                O <span className="underline">Lado B</span> não pode ser maior que o <span className="underline">Lado A</span> em estribos com 3 lados
                                            </p>
                                        )}

                                        <hr className="border-slate-300 border-t-2 shrink-0" />

                                        {/* Observação */}
                                        <div className="shrink-0">
                                            <label className="block text-xs font-black text-slate-600 uppercase mb-1">OBSERVAÇÃO:</label>
                                            <div className="flex items-stretch border border-red-300 rounded overflow-hidden h-9">
                                                <div className="w-8 bg-red-50 border-r border-red-300 flex items-center justify-center shrink-0">
                                                    <span className="font-black text-xs text-red-600">✘</span>
                                                </div>
                                                <input type="text" placeholder="OPCIONAL" value={estriboObs} onChange={e => setEstriboObs(e.target.value)} className="w-full px-2 text-sm text-slate-700 outline-none" />
                                            </div>
                                        </div>

                                    </div>

                                    {/* Footer */}
                                    <div className="px-6 py-4 flex gap-2 border-t border-slate-200 bg-slate-50 shrink-0">
                                        <button
                                            type="button"
                                            disabled={!isEstriboFormValid()}
                                            onClick={() => {
                                                if (!isEstriboFormValid()) return;
                                                
                                                if (lados === '3 LADOS') {
                                                    const a = parseFloat(estriboLadoA) || 0;
                                                    const b = parseFloat(estriboLadoB) || 0;
                                                    if (b > a) {
                                                        showNotification('O Lado B não pode ser maior que o Lado A em estribos com 3 lados.', 'error');
                                                        return;
                                                    }
                                                }

                                                const [bitolaLabel, bitolaKgmStr] = estriboBitola.split(',');
                                                const bitolaKgm = parseFloat(bitolaKgmStr) || 0;

                                                let updated;
                                                if (ferroEditId) {
                                                    updated = tempProducts.map((p, pi) =>
                                                        pi === estriboTargetProdIdx
                                                            ? recalcProduct(Object.assign({}, p, {
                                                                ferros: (p.ferros || []).map(f =>
                                                                    f.id === ferroEditId
                                                                        ? Object.assign({}, f, {
                                                                            nomeElemento: estriboNomeElemento || 'ESTRIBO',
                                                                            qtde: parseInt(estriboQtde) || 1,
                                                                            bitola: estriboBitola,
                                                                            bitolaKgm,
                                                                            estriboShape: estriboShapeType,
                                                                            espacamento: estriboEspacamento,
                                                                            ladoA: estriboLadoA,
                                                                            ladoB: estriboLadoB,
                                                                            ladoC: estriboLadoC,
                                                                            ladoD: estriboLadoD,
                                                                            ladoE: estriboLadoE,
                                                                            ladoF: estriboLadoF,
                                                                            obs: estriboObs,
                                                                        })
                                                                        : f
                                                                )
                                                            }))
                                                            : p
                                                    );
                                                    setFerroEditId(null);
                                                } else {
                                                    const newEstribo = {
                                                        id: String(Date.now() + Math.random()),
                                                        nomeElemento: estriboNomeElemento || 'ESTRIBO',
                                                        qtde: parseInt(estriboQtde) || 1,
                                                        bitola: estriboBitola,
                                                        bitolaKgm,
                                                        drawingType: 'Estribo',
                                                        estriboShape: estriboShapeType,
                                                        espacamento: estriboEspacamento,
                                                        ladoA: estriboLadoA,
                                                        ladoB: estriboLadoB,
                                                        ladoC: estriboLadoC,
                                                        ladoD: estriboLadoD,
                                                        ladoE: estriboLadoE,
                                                        ladoF: estriboLadoF,
                                                        obs: estriboObs,
                                                    };
                                                    updated = tempProducts.map((p, pi) =>
                                                        pi === estriboTargetProdIdx
                                                            ? recalcProduct(Object.assign({}, p, { ferros: [...(p.ferros || []), newEstribo] }))
                                                            : p
                                                    );
                                                }
                                                setTempProducts(updated);
                                                if (activeQuote) handleProductSave(activeQuote.id, updated);
                                                setShowEstribosModal(false);
                                                showNotification(ferroEditId ? 'Estribo updated!' : 'Estribo added!', 'success');
                                            }}
                                            className="bg-[#1565C0] hover:bg-[#0D47A1] disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold py-2 px-5 rounded text-sm transition shadow"
                                        >
                                            {ferroEditId ? 'ATUALIZAR' : 'SALVAR ELEMENTO'}
                                        </button>
                                        <button type="button" onClick={() => { setShowEstribosModal(false); setFerroEditId(null); }} className="text-slate-600 hover:text-slate-800 font-bold py-2 px-4 text-sm transition bg-slate-200 hover:bg-slate-300 rounded">
                                            CANCELAR
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    
                    {/* MODAL: Sapata */}
                    {showSapataModal && (
                        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                            <div className="bg-white rounded shadow-2xl w-full max-w-2xl border border-slate-300 animate-in fade-in zoom-in-95 duration-150">
                                {/* Header */}
                                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
                                    <h3 className="text-base font-black text-slate-800 uppercase tracking-wider">
                                        {editingSapataId ? 'Editar Sapata' : 'Sapata'}
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={() => setShowSapataModal(false)}
                                        className="text-slate-500 hover:text-slate-800 text-xl font-bold w-7 h-7 flex items-center justify-center border border-slate-300 rounded"
                                    >
                                        ×
                                    </button>
                                </div>

                                <div className="p-5 space-y-4">
                                    {/* Row 1 */}
                                    <div className="grid grid-cols-12 gap-4 items-start">
                                        <div className="col-span-8">
                                            <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">NOME DA SAPATA:</label>
                                            <div className="flex items-stretch border border-red-400 rounded overflow-hidden">
                                                <div className="w-8 bg-red-100 border-r border-red-300 flex items-center justify-center shrink-0">
                                                    <span className="text-red-600 font-black text-xs">✕</span>
                                                </div>
                                                <input
                                                    type="text"
                                                    placeholder="OPCIONAL"
                                                    value={sapataName}
                                                    onChange={e => setSapataName(e.target.value.toUpperCase())}
                                                    className="w-full px-2 py-1.5 text-xs font-semibold text-slate-800 outline-none bg-transparent"
                                                />
                                            </div>
                                        </div>

                                        <div className="col-span-4">
                                            <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">QTDE.:</label>
                                            <div className={`flex items-stretch border rounded overflow-hidden ${sapataQtde ? 'border-emerald-400' : 'border-red-400'}`}>
                                                <div className={`w-8 border-r flex items-center justify-center shrink-0 ${sapataQtde ? 'bg-emerald-100 border-emerald-300' : 'bg-red-100 border-red-300'}`}>
                                                    <span className={`font-black text-xs ${sapataQtde ? 'text-emerald-600' : 'text-red-600'}`}>{}</span>
                                                </div>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={sapataQtde}
                                                    onChange={e => setSapataQtde(e.target.value)}
                                                    className={`w-full px-2 py-1.5 text-xs font-bold outline-none bg-transparent text-center ${sapataQtde ? 'text-slate-800' : 'text-red-500'}`}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Center Content: Type & SVG */}
                                    <div className="flex flex-row items-center gap-6 py-4">
                                        <div className="flex flex-col gap-2">
                                            <label className="block text-[10px] font-black text-slate-600 uppercase">TIPO SAPATA:</label>
                                            <div className="flex gap-4">
                                                <label className="flex items-center gap-2 cursor-pointer border rounded px-3 py-1.5 hover:bg-slate-50">
                                                    <input
                                                        type="radio"
                                                        name="sapataTipo"
                                                        checked={sapataTipo === 'FECHADA'}
                                                        onChange={() => setSapataTipo('FECHADA')}
                                                        className="accent-blue-600 w-3.5 h-3.5"
                                                    />
                                                    <span className="text-xs font-bold text-slate-700">FECHADA</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer border rounded px-3 py-1.5 hover:bg-slate-50">
                                                    <input
                                                        type="radio"
                                                        name="sapataTipo"
                                                        checked={sapataTipo === 'ABERTA'}
                                                        onChange={() => setSapataTipo('ABERTA')}
                                                        className="accent-blue-600 w-3.5 h-3.5"
                                                    />
                                                    <span className="text-xs font-bold text-slate-700">ABERTA</span>
                                                </label>
                                            </div>
                                        </div>

                                        <div className="flex-1 flex justify-center relative">
                                            <div className="relative w-[200px] h-[100px]">
                                                {/* Simple 3D Box Representation */}
                                                <svg viewBox="0 0 200 100" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                                                    <g fill="none" stroke="#64748b" strokeWidth="2" strokeLinejoin="round">
                                                        {/* Back face */}
                                                        <rect x="50" y="20" width="100" height="40" />
                                                        {/* Front face */}
                                                        <rect x="20" y="50" width="100" height="40" />
                                                        {/* Connecting lines */}
                                                        <line x1="20" y1="50" x2="50" y2="20" />
                                                        <line x1="120" y1="50" x2="150" y2="20" />
                                                        <line x1="20" y1="90" x2="50" y2="60" />
                                                        <line x1="120" y1="90" x2="150" y2="60" />
                                                        
                                                        {/* Inner grid lines for reinforcement look */}
                                                        <line x1="53" y1="50" x2="83" y2="20" />
                                                        <line x1="86" y1="50" x2="116" y2="20" />
                                                        <line x1="53" y1="90" x2="53" y2="50" />
                                                        <line x1="86" y1="90" x2="86" y2="50" />
                                                        <line x1="83" y1="60" x2="83" y2="20" />
                                                        <line x1="116" y1="60" x2="116" y2="20" />
                                                        <line x1="20" y1="70" x2="120" y2="70" />
                                                        <line x1="50" y1="40" x2="150" y2="40" />
                                                    </g>
                                                </svg>
                                                <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-2 text-[10px] font-black tracking-wide bg-white px-1">COMPRIMENTO</div>
                                                <div className="absolute right-0 top-1/2 -translate-y-1/2 -mr-8 text-[10px] font-black tracking-wide">LARGURA</div>
                                                <div className="absolute right-0 bottom-0 mr-2 mb-2 text-[10px] font-black tracking-wide">ALTURA</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Row 3: Dimensions */}
                                    <div className="grid grid-cols-3 gap-4 items-start">
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">COMPRIMENTO (cm):</label>
                                            <div className={`flex items-stretch border rounded overflow-hidden ${sapataLength ? 'border-emerald-400' : 'border-red-400'}`}>
                                                <div className={`w-8 border-r flex items-center justify-center shrink-0 ${sapataLength ? 'bg-emerald-100 border-emerald-300' : 'bg-red-100 border-red-300'}`}>
                                                    <span className={`font-black text-xs ${sapataLength ? 'text-emerald-600' : 'text-red-600'}`}>{}</span>
                                                </div>
                                                <input
                                                    type="number"
                                                    value={sapataLength}
                                                    onChange={e => setSapataLength(e.target.value)}
                                                    className="w-full px-2 py-1.5 text-xs font-bold outline-none bg-transparent"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">LARGURA (cm):</label>
                                            <div className={`flex items-stretch border rounded overflow-hidden ${sapataWidth ? 'border-emerald-400' : 'border-red-400'}`}>
                                                <div className={`w-8 border-r flex items-center justify-center shrink-0 ${sapataWidth ? 'bg-emerald-100 border-emerald-300' : 'bg-red-100 border-red-300'}`}>
                                                    <span className={`font-black text-xs ${sapataWidth ? 'text-emerald-600' : 'text-red-600'}`}>{}</span>
                                                </div>
                                                <input
                                                    type="number"
                                                    value={sapataWidth}
                                                    onChange={e => setSapataWidth(e.target.value)}
                                                    className="w-full px-2 py-1.5 text-xs font-bold outline-none bg-transparent"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">ALTURA (cm):</label>
                                            <div className={`flex items-stretch border rounded overflow-hidden ${sapataHeight ? 'border-emerald-400' : 'border-red-400'}`}>
                                                <div className={`w-8 border-r flex items-center justify-center shrink-0 ${sapataHeight ? 'bg-emerald-100 border-emerald-300' : 'bg-red-100 border-red-300'}`}>
                                                    <span className={`font-black text-xs ${sapataHeight ? 'text-emerald-600' : 'text-red-600'}`}>{}</span>
                                                </div>
                                                <input
                                                    type="number"
                                                    value={sapataHeight}
                                                    onChange={e => setSapataHeight(e.target.value)}
                                                    className="w-full px-2 py-1.5 text-xs font-bold outline-none bg-transparent"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Row 4: Observacao */}
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">OBSERVAÇÃO:</label>
                                        <div className="flex items-stretch border border-red-400 rounded overflow-hidden">
                                            <div className="w-8 bg-red-100 border-r border-red-300 flex items-center justify-center shrink-0">
                                                <span className="text-red-600 font-black text-xs">✕</span>
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="OPCIONAL"
                                                value={sapataObs}
                                                onChange={e => setSapataObs(e.target.value)}
                                                className="w-full px-2 py-1.5 text-xs font-semibold text-slate-800 outline-none bg-transparent"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="flex justify-start gap-3 px-5 py-4 border-t border-slate-200 bg-slate-50 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (!sapataQtde || !sapataLength || !sapataWidth || !sapataHeight) {
                                                showNotification('Preencha as quantidades e as três dimensões.', 'warning');
                                                return;
                                            }
                                            const qty = parseInt(sapataQtde) || 1;
                                            const shapeStr = sapataLength === sapataWidth ? 'QUADRADA' : 'RETANGULAR';
                                            const nameStr = sapataName ? ' ' + sapataName : '';
                                            const obsStr = sapataObs ? ' OBS: ' + sapataObs.toUpperCase() : '';
                                            const description = `SAPATA ${shapeStr}${nameStr} ${sapataTipo} ${sapataLength}x${sapataWidth}x${sapataHeight}${obsStr}`.replace(/\s+/g, ' ').trim();
                                            
                                            const newProd = {
                                                id: String(Date.now() + Math.random()),
                                                description,
                                                qty,
                                                length: 0,
                                                weightPerMeter: 0,
                                                weight: 0,
                                                price: 0
                                            };
                                            
                                            let updated;
                                            if (editingSapataId) {
                                                updated = tempProducts.map(p =>
                                                    p.id === editingSapataId ? recalcProduct(Object.assign({}, p, { description, qty })) : p
                                                );
                                            } else {
                                                updated = [...tempProducts, newProd];
                                            }
                                            
                                            setTempProducts(updated);
                                            if (activeQuote) handleProductSave(activeQuote.id, updated);
                                            setEditingSapataId(null);
                                            setShowSapataModal(false);
                                            showNotification(editingSapataId ? 'Sapata atualizada!' : 'Sapata adicionada!', 'success');
                                        }}
                                        className="bg-[#1565C0] hover:bg-[#0D47A1] text-white font-extrabold py-2 px-5 rounded text-sm transition shadow"
                                    >
                                        Salvar Peça
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setShowSapataModal(false); setEditingSapataId(null); }}
                                        className="text-slate-600 hover:text-slate-800 font-bold py-2 px-4 text-sm transition border bg-slate-100 hover:bg-slate-200"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* MODAL: Corte e Dobra sub-modal */}
                    {showCorteDobraModal && (
                        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                            <div className="bg-white rounded shadow-2xl w-full max-w-md border border-slate-300 animate-in fade-in zoom-in-95 duration-150">
                                {/* Header */}
                                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
                                    <h3 className="text-base font-black text-slate-800 uppercase tracking-wider">
                                        {editingCorteDobraId ? 'Editar Corte e Dobra' : 'Corte e Dobra'}
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={() => setShowCorteDobraModal(false)}
                                        className="text-slate-500 hover:text-slate-800 text-xl font-bold w-7 h-7 flex items-center justify-center border border-slate-300 rounded"
                                    >
                                        &times;
                                    </button>
                                </div>

                                {/* Body */}
                                <div className="px-5 py-4 space-y-4">
                                    {/* Name / Group Input */}
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">NOME DO GRUPO <span className="text-red-500">*</span></label>
                                        <div className="flex border border-slate-300 rounded overflow-hidden">
                                            <div className="bg-slate-100 px-3 flex items-center justify-center border-r border-slate-300 text-slate-500">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                            </div>
                                            <input
                                                type="text"
                                                placeholder=""
                                                value={corteDobraName}
                                                onChange={e => setCorteDobraName(e.target.value)}
                                                className="w-full px-2 py-1.5 text-xs font-bold text-slate-800 outline-none bg-transparent uppercase"
                                            />
                                        </div>
                                    </div>

                                    {/* Observation */}
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">OBSERVAÇÃO</label>
                                        <div className="flex border border-slate-300 rounded overflow-hidden">
                                            <input
                                                type="text"
                                                placeholder="OPCIONAL"
                                                value={corteDobraObs}
                                                onChange={e => setCorteDobraObs(e.target.value)}
                                                className="w-full px-2 py-1.5 text-xs font-semibold text-slate-800 outline-none bg-transparent uppercase"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="flex justify-start gap-3 px-5 py-4 border-t border-slate-200 bg-slate-50 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (!corteDobraName) {
                                                showNotification('Preencha o nome do grupo.', 'warning');
                                                return;
                                            }
                                            const nameStr = corteDobraName ? ' ' + corteDobraName : '';
                                            const obsStr = corteDobraObs ? ' OBS: ' + corteDobraObs.toUpperCase() : '';
                                            const description = `CORTE E DOBRA${nameStr}${obsStr}`.replace(/\s+/g, ' ').trim();
                                            
                                            const newProd = {
                                                id: String(Date.now() + Math.random()),
                                                description,
                                                qty: 1,
                                                length: 0,
                                                weightPerMeter: 0,
                                                weight: 0,
                                                price: 0
                                            };
                                            
                                            let updated;
                                            if (editingCorteDobraId) {
                                                updated = tempProducts.map(p =>
                                                    p.id === editingCorteDobraId ? recalcProduct(Object.assign({}, p, { description })) : p
                                                );
                                            } else {
                                                updated = [...tempProducts, newProd];
                                            }
                                            
                                            setTempProducts(updated);
                                            if (activeQuote) handleProductSave(activeQuote.id, updated);
                                            setEditingCorteDobraId(null);
                                            setShowCorteDobraModal(false);
                                            showNotification(editingCorteDobraId ? 'Corte e Dobra atualizado!' : 'Corte e Dobra adicionado!', 'success');
                                        }}
                                        className="bg-[#1565C0] hover:bg-[#0D47A1] text-white font-extrabold py-2 px-5 rounded text-sm transition shadow"
                                    >
                                        Salvar Peça
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setShowCorteDobraModal(false); setEditingCorteDobraId(null); }}
                                        className="text-slate-600 hover:text-slate-800 font-bold py-2 px-4 text-sm transition border bg-slate-100 hover:bg-slate-200"
                                    >
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
                                    <h3 className="text-base font-black text-slate-800 uppercase tracking-wider">
                                        {editingColunaId ? `Editar ${structuralCategory}` : structuralCategory}
                                    </h3>
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
                                            <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">Nome da Peça:</label>
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
                                                    <option value="3 LADOS">3 LADOS</option>
                                                    <option value="4 LADOS">4 LADOS</option>
                                                    <option value="6 LADOS">6 LADOS</option>
                                                    <option value="8 LADOS">8 LADOS</option>
                                                    <option value="REDONDA">REDONDA</option>
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
                                                showNotification('Informe a quantidade de peças.', 'warning');
                                                return;
                                            }
                                            const qty = parseInt(colunaQtde);
                                            const nomePart = colunaName ? colunaName.toUpperCase() : '';
                                            const areaVal1 = colunaAreaSemEstr1 || 'ESP';
                                            const areaVal2 = colunaAreaSemEstr2 ? ' / ' + colunaAreaSemEstr2 + ' CM' : '';
                                            const obsPart = colunaObs ? ' OBS: ' + colunaObs.toUpperCase() : '';
                                            const description = (structuralCategory + (nomePart ? ' ' + nomePart : '') + ' ' + colunaTipoAmarracao + ' ' + colunaQtdeLados + ' x ' + areaVal1 + ' CM' + areaVal2 + obsPart).replace(/\s+/g, ' ').trim();
                                            const newProd = {
                                                id: String(Date.now() + Math.random()),
                                                description,
                                                qty,
                                                length: 0,
                                                weightPerMeter: 0,
                                                weight: 0,
                                                price: 0,
                                                areaSemEstr1: colunaAreaSemEstr1 ? parseFloat(colunaAreaSemEstr1) : 0,
                                                areaSemEstr2: colunaAreaSemEstr2 ? parseFloat(colunaAreaSemEstr2) : 0
                                            };
                                            let updated;
                                            if (editingColunaId) {
                                                updated = tempProducts.map(p =>
                                                    p.id === editingColunaId ? recalcProduct(Object.assign({}, p, { description, qty })) : p
                                                );
                                            } else {
                                                updated = [...tempProducts, newProd];
                                            }
                                            setTempProducts(updated);
                                            if (activeQuote) handleProductSave(activeQuote.id, updated);
                                            setEditingColunaId(null);
                                            setShowColunaModal(false);
                                            showNotification(editingColunaId ? 'Peça atualizada!' : 'Peça adicionada ao orçamento!', 'success');
                                        }}
                                        className="bg-[#1565C0] hover:bg-[#0D47A1] text-white font-extrabold py-2 px-5 rounded text-sm transition shadow"
                                    >
                                        Salvar Peça
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setShowColunaModal(false); setEditingColunaId(null); }}
                                        className="text-slate-600 hover:text-slate-800 font-bold py-2 px-4 text-sm transition"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* MODAL: Editar Preço */}
                    {activeModal.type === 'price' && activeQuote && (
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
                    {activeModal.type === 'duplicate' && activeQuote && (
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
                    {(activeModal.type === 'print' || activeModal.type === 'printFull' || activeModal.type === 'printSteel') && activeQuote && (
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
                                        <h2 className="text-md font-black text-slate-900 uppercase">ORÇAMENTO Nº {String(activeQuote.id).padStart(7, '0')}</h2>
                                        <p className="text-[10px] text-slate-500 font-bold">Data: {activeQuote.date}</p>
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

                    {/* MODAL: Imprimir Modelo Cliente (Ita Aços) */}
                    {activeModal.type === 'print_orcamento' && activeQuote && (
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
                            <div className="bg-[#0F3F5C] p-4 text-white flex justify-between items-center shrink-0 no-print">
                                <h3 className="font-bold text-md">🖨️ Visualização de Impressão (Modelo Cliente)</h3>
                                <button onClick={() => setActiveModal(null)} className="text-white text-xl font-bold">&times;</button>
                            </div>
                            
                            <div className="p-8 bg-white text-black flex-grow overflow-y-auto font-sans text-sm space-y-6 print:p-0 print:m-0 print:w-full print:h-full" id="printable-ita-quote">
                                {/* Header */}
                                <div className="flex justify-between items-center border-b-[1.5px] border-black pb-2">
                                    <div className="w-1/3">
                                    {activeBrandingPartner?.logoUrl ? (
                                        <img src={activeBrandingPartner.logoUrl} alt="Logo" className="h-14 object-contain" />
                                    ) : (
                                        <h1 className="text-2xl font-black">{activeBrandingPartner?.companyName || 'Sua Empresa'}</h1>
                                    )}
                                    </div>
                                    <div className="text-[9px] text-right font-semibold leading-tight w-2/3">
                                        Ferros e Acessórios para Serralheria, Chapas, Tubos, Metalon e Perfilados - Ferros para Construção Civil, em Barras ou Colunas e Sapatas Montadas (pronto p/ a Obra) - Dobras Especiais até 1/2 polegada, Telhas, Corte Plasma, Steel Frame e muito mais. Confira!
                                    </div>
                                </div>

                                {/* Title */}
                                <div className="text-center font-extrabold text-xl uppercase border-b-[1.5px] border-black pb-2">
                                    ORÇAMENTO Nº{String(activeQuote.id).padStart(7, '0')}
                                </div>

                                {/* Info */}
                                <div className="grid grid-cols-[100px_1fr] gap-x-2 gap-y-0.5 text-xs font-bold uppercase border-b-[1.5px] border-black pb-4">
                                    <span>CLIENTE:</span>
                                    <span className="font-semibold">({activeQuote.clientCode}) {activeQuote.clientName}</span>
                                    <span>VENDEDOR:</span>
                                    <span className="font-semibold">{activeQuote.salesperson}</span>
                                    <span>DATA ORÇ.:</span>
                                    <span className="font-semibold">{activeQuote.date} (DATA DA ENTREGA A COMBINAR)</span>
                                </div>

                                {/* Products */}
                                <div className="space-y-6 pt-2">
                                    {activeQuote.products.map((prod, pIdx) => {
                                        const tags = prod.description.split(' ').filter(t => t.trim().length > 0);
                                        return (
                                            <div key={pIdx} className="border-[1.5px] border-slate-200 rounded-lg overflow-hidden">
                                                {/* Header do Produto (Professional Title) */}
                                                <div className="bg-emerald-50/50 p-3 flex items-center gap-2 border-b-[1.5px] border-emerald-100">
                                                    <span className="text-blue-700 font-bold text-sm bg-blue-100 px-2 py-0.5 rounded">
                                                        {prod.qty}x
                                                    </span>
                                                    <div className="flex flex-wrap gap-2 items-center">
                                                        <span className="text-slate-800 text-sm font-semibold tracking-wide lowercase">
                                                            {getProfessionalTitle(prod)}
                                                        </span>
                                                    </div>
                                                </div>
                                                
                                                {/* Tabela de Elementos */}
                                                <div className="bg-white p-0">
                                                    <div className="grid grid-cols-[1.5fr_2fr_1fr_1.5fr] bg-slate-50 border-b-[1.5px] border-slate-100 p-2.5 text-[9px] font-black text-slate-500 uppercase text-center tracking-wider">
                                                        <div>IMG</div>
                                                        <div className="text-left">ELEMENTO</div>
                                                        <div>QTDE</div>
                                                        <div>TIPO</div>
                                                    </div>
                                                    
                                                    <div className="flex flex-col">
                                                        {prod.ferros?.map((f, fIdx) => {
                                                            const isLine = !f.ladoB && !f.ladoC && !f.ladoD && (!f.estriboShape || f.estriboShape === 'formato_reto');
                                                            const mainVal = f.ladoA || getFerroTotalLengthCm(f, prod.description).toString();
                                                            const isEstribo = f && f.nomeElemento ? (f.nomeElemento.toUpperCase().includes('ESTRIBO') || (f.estriboShape && f.estriboShape !== 'formato_reto')) : false;
                                                            const hasImage = !!f.customImageBase64;
                                                            const ladosDesc = prod.description.match(/(\d+) LADOS/)?.[1] ? `${prod.description.match(/(\d+) LADOS/)?.[1]} LADOS` : '4 LADOS';
                                                            
                                                            return (
                                                                <div key={fIdx} className="grid grid-cols-[1.5fr_2fr_1fr_1.5fr] items-center border-b-[1.5px] border-slate-100 last:border-b-0 p-5 text-[10px] font-extrabold uppercase text-center text-slate-700">
                                                                    {/* IMG Column */}
                                                                    <div className="flex items-center justify-center pt-2 pb-2">
                                                                        {isLine ? (
                                                                            <div className="flex flex-col items-center gap-1">
                                                                                <div className="w-16 h-1.5 bg-slate-800 rounded-full"></div>
                                                                                <span className="font-black text-[11px] text-slate-900">{mainVal}</span>
                                                                            </div>
                                                                        ) : hasImage ? (
                                                                            <img src={f.customImageBase64} alt="Custom" className="w-full max-h-16 object-contain" />
                                                                        ) : (
                                                                            <div className="flex items-center justify-center min-h-[50px] scale-90">
                                                                                {f.drawingType === 'Estribo'
                                                                                    ? <div className="origin-center">{renderEstriboSVG(ladosDesc, f.estriboShape || 'Padrão', f.ladoA, f.ladoB, f.ladoC, f.ladoD, f.ladoE, f.ladoF)}</div>
                                                                                    : f.drawingType === 'CorteDobra'
                                                                                    ? <div className="origin-center">{renderEstriboSVG(ladosDesc, f.estriboShape || f.ferroModelId || 'Padrão', f.ladoA, f.ladoB, f.ladoC, f.ladoD, f.ladoE, f.ladoF, [...estriboModels, ...ferroModels]) || renderBarDiagramSVG(ferroModels.find(m => m.id === f.ferroModelId)?.name || '', f.ladoA, f.ladoB, f.ladoC, f.ladoD, f.ladoE, true)}</div>
                                                                                    : f.drawingType === 'Trava'
                                                                                    ? <div className="origin-center">{renderTravaSVG(Number(f.estriboShape) || 1, f.ladoA, f.ladoB, f.ladoC, f.ladoD, f.ladoE)}</div>
                                                                                    : <div className="origin-center">{renderEstriboSVG(ladosDesc || '4 LADOS', f.estriboShape || f.ferroModelId || 'Padrão', f.ladoA, f.ladoB, f.ladoC, f.ladoD, f.ladoE, f.ladoF, [...estriboModels, ...ferroModels]) || renderBarDiagramSVG(ferroModels.find(m => m.id === f.ferroModelId)?.name || '', f.ladoA, f.ladoB, f.ladoC, f.ladoD, f.ladoE, true)}</div>}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    
                                                                    {/* ELEMENTO */}
                                                                    <div className="text-left font-black text-[11px] text-slate-600">{f.nomeElemento || 'FERRO'}</div>
                                                                    
                                                                    {/* QTDE */}
                                                                    <div>
                                                                        <span className="bg-slate-500 text-white px-2.5 py-0.5 rounded-full text-[10px] shadow-sm">{f.qtde * prod.qty}</span>
                                                                    </div>
                                                                    
                                                                    {/* TIPO */}
                                                                    <div className="text-slate-500 font-bold tracking-wide">{isEstribo ? 'ESTRIBOS' : 'FERROS'}</div>
                                                                </div>
                                                            );
                                                        })}
                                                        
                                                        {(!prod.ferros || prod.ferros.length === 0) && (
                                                            <div className="p-6 text-center text-slate-400 font-bold italic text-xs">
                                                                NENHUM ELEMENTO DETALHADO. ({prod.length}m)
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* PREÇO */}
                                <div className="font-black text-sm uppercase flex gap-12 mt-6">
                                    <span>PREÇO:</span>
                                    <span>R$ {activeQuote.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>

                                {/* ATENÇÃO */}
                                <div className="mt-8 space-y-4">
                                    <h3 className="font-extrabold text-base underline">ATENÇÃO!</h3>
                                    <p className="text-xs font-semibold leading-relaxed">
                                        Declaro que estou de acordo com as especificações do orçamento acima (quantidade, medidas, preço) e também estou de acordo que serei responsável pela descarga e conferência dos materiais listados neste orçamento:
                                    </p>

                                    <div className="grid grid-cols-[130px_1fr_40px_1fr] gap-y-6 gap-x-2 items-end mt-10 text-[11px] font-bold">
                                        <span>NOME COMPLETO:</span>
                                        <div className="border-b border-black"></div>
                                        <span className="text-right">RG:</span>
                                        <div className="border-b border-black"></div>
                                        
                                        <span>ASSINATURA:</span>
                                        <div className="border-b border-black"></div>
                                        <span className="text-right">DATA:</span>
                                        <div className="border-b border-black flex justify-center text-gray-400">____/____/____</div>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="pt-4 text-[8px] text-gray-500 font-bold border-t-[1.5px] border-black mt-12 flex justify-between">
                                    <span>
                                        {activeBrandingPartner?.companyName || 'MSM Sistemas'} - {activeBrandingPartner?.endereco || 'Endereço não cadastrado'} - CNPJ: {activeBrandingPartner?.cnpj || 'Não informado'}
                                    </span>
                                    <span>
                                        Visite nosso site. Impresso por {currentUser?.username || 'SISTEMA'} em {new Date().toLocaleString('pt-BR')} - V-06
                                    </span>
                                </div>
                            </div>
                            
                            <div className="p-4 bg-slate-50 border-t flex justify-end gap-3 shrink-0 no-print">
                                <button onClick={() => setActiveModal(null)} className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2 px-6 rounded-xl text-xs uppercase transition">Cancelar</button>
                                <button 
                                    onClick={() => {
                                        window.print();
                                        showNotification('Enviado para impressão.', 'success');
                                    }}
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-2 px-8 rounded-xl text-xs uppercase transition shadow-md"
                                >
                                    Imprimir
                                </button>
                            </div>
                        </div>
                    )}

                    {/* MODAL: Plano de Corte */}
                    {activeModal.type === 'print_corte' && activeQuote && (() => {
                        const planoCorte = (() => {
                            const bitolaMap = new Map<string, any[]>();
                            activeQuote.products.forEach((p, pIdx) => {
                                const rawOsName = p.description || 'Produto';
                                const osName = rawOsName.replace(/\s*\d*\s*LADOS X.*/i, '').trim();
                                const prodQtde = p.qty || 1;
                                (p.ferros || []).forEach((f, fIdx) => {
                                    const osNumber = `OS: ${String(activeQuote.products.slice(0, pIdx).reduce((acc, prevP) => acc + (prevP.ferros?.length || 0), 0) + fIdx + 1).padStart(2, '0')}`;
                                    const bitolaStr = f.bitola || '';
                                    const bConfig = (bitolas || []).find(b => bitolaStr.startsWith(b.label));
                                    const bitolaLabel = bConfig ? bConfig.label : (bitolaStr.split(',')[0] || 'Desconhecida');
                                    
                                    if (!bitolaMap.has(bitolaLabel)) {
                                        bitolaMap.set(bitolaLabel, []);
                                    }
                                    
                                    const items = bitolaMap.get(bitolaLabel)!;
                                    let osGroup = items.find(i => i.osNumber === osNumber);
                                    if (!osGroup) {
                                        osGroup = { osNumber, osName, prodQtde, cuts: [] };
                                        items.push(osGroup);
                                    }
                                    
                                    const cutQty = (f.qtde || 1) * prodQtde;
                                    const totalCm = getFerroTotalLengthCm(f, p.description);
                                    const metros = (totalCm / 100) * cutQty;
                                    
                                    let drawTypeLabel = f.drawingType || 'RETO';
                                    if (f.drawingType === 'Estribo') drawTypeLabel = 'ESTRIBO';
                                    if (f.drawingType === 'CorteDobra') drawTypeLabel = 'CORTE E DOBRA';
                                    if (f.drawingType === 'Trava') drawTypeLabel = 'TRAVA';
                                    
                                    const ferroModel = ferroModels.find(m => m.id === f.ferroModelId);
                                    if (ferroModel && f.drawingType !== 'Estribo' && f.drawingType !== 'Trava' && f.drawingType !== 'CorteDobra') {
                                        drawTypeLabel = ferroModel.name;
                                    }
                                    
                                    if (f.nomeElemento) {
                                        drawTypeLabel = f.nomeElemento.toUpperCase();
                                    }
                                    
                                    let dims = [];
                                    if (f.a) dims.push(`A: ${f.a}`);
                                    if (f.b) dims.push(`B: ${f.b}`);
                                    if (f.c) dims.push(`C: ${f.c}`);
                                    if (f.d) dims.push(`D: ${f.d}`);
                                    if (f.e) dims.push(`E: ${f.e}`);
                                    const dimStr = dims.length > 0 ? ` (${dims.join(', ')})` : '';
                                    
                                    osGroup.cuts.push({
                                        format: `${drawTypeLabel}${dimStr}`,
                                        qty: cutQty,
                                        metros: metros,
                                        f: f,
                                        pDesc: p.description
                                    });
                                });
                            });
                            return Array.from(bitolaMap.entries()).map(([bitola, osGroups]) => ({ bitola, osGroups }));
                        })();

                        return (
                            <div className="fixed inset-0 bg-white z-50 overflow-y-auto print:bg-white print:overflow-visible flex flex-col">
                                <div className="p-4 bg-slate-100 flex justify-between items-center print:hidden border-b border-slate-200">
                                    <h2 className="text-xl font-bold text-slate-800">✂️ Plano de Corte - Orçamento {activeQuote.id}</h2>
                                    <div className="space-x-3">
                                        <button onClick={() => window.print()} className="bg-sky-600 text-white px-4 py-2 rounded font-bold">Imprimir</button>
                                        <button onClick={() => setActiveModal({ type: 'none' })} className="bg-slate-400 text-white px-4 py-2 rounded font-bold">Fechar</button>
                                    </div>
                                </div>
                                <div className="p-8 max-w-4xl mx-auto w-full print:p-0 print:max-w-none text-slate-800">
                                    <div className="text-center mb-8 pb-4 border-b-2 border-slate-800">
                                        <h1 className="text-3xl font-black uppercase tracking-wider mb-2">PLANO DE CORTE</h1>
                                        <p className="text-sm font-bold">ORÇAMENTO Nº {String(activeQuote.id).padStart(7, '0')} — {activeQuote.clientName}</p>
                                    </div>
                                    
                                    {planoCorte.length === 0 ? (
                                        <div className="text-center text-slate-500 py-10">Nenhum item adicionado a este orçamento.</div>
                                    ) : (
                                        planoCorte.map((grupo, gIdx) => (
                                            <div key={gIdx} className="mb-12 break-inside-avoid">
                                                <h2 className="text-xl font-black text-center bg-slate-200 py-1 mb-2 border-y border-slate-400">{grupo.bitola}</h2>
                                                
                                                <table className="w-full text-left text-sm border-collapse border border-slate-300">
                                                    <thead>
                                                        <tr className="bg-slate-50 text-slate-600 border-b border-slate-300">
                                                            <th className="p-2 font-bold text-center border-r border-slate-300 w-24 uppercase">OS</th>
                                                            <th className="p-2 font-bold text-center border-r border-slate-300 uppercase">DESCRIÇÃO</th>
                                                            <th className="p-2 font-bold text-center border-r border-slate-300 w-32 uppercase">QNT. DE CORTES</th>
                                                            <th className="p-2 font-bold text-center border-r border-slate-300 uppercase">FORMATO/ DIMENSÕES</th>
                                                            <th className="p-2 font-bold text-center w-32 uppercase">METROS TOTAIS</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {grupo.osGroups.map((os, oIdx) => (
                                                            os.cuts.map((cut: any, cIdx: number) => {
                                                                const ladosDesc = cut.pDesc.match(/(\d+) LADOS/)?.[1] ? `${cut.pDesc.match(/(\d+) LADOS/)?.[1]} LADOS` : '4 LADOS';
                                                                return (
                                                                <tr key={`${oIdx}-${cIdx}`} className="border-b border-slate-200 last:border-0 break-inside-avoid">
                                                                    {cIdx === 0 && (
                                                                        <>
                                                                            <td rowSpan={os.cuts.length} className="p-3 border-r border-slate-300 align-middle bg-slate-50 text-center font-bold text-slate-800 text-lg">
                                                                                {os.osNumber}
                                                                            </td>
                                                                            <td rowSpan={os.cuts.length} className="p-3 border-r border-slate-300 align-middle bg-slate-50 text-center font-bold text-slate-800 text-sm uppercase">
                                                                                {os.prodQtde} {os.osName}
                                                                            </td>
                                                                        </>
                                                                    )}
                                                                    <td className="p-3 text-center border-r border-slate-300 font-bold text-sky-700 text-base">{cut.qty}</td>
                                                                    <td className="p-2 border-r border-slate-300 font-medium text-slate-700">
                                                                        <div className="flex items-center justify-center gap-6">
                                                                            <div className="flex flex-col">
                                                                                <span className="font-bold text-slate-800">{cut.format}</span>
                                                                            </div>
                                                                            <div className="w-32 h-24 flex items-center justify-center shrink-0">
                                                                                <div className="origin-center scale-100">
                                                                                    {cut.f.drawingType === 'Estribo' ? (
                                                                                        renderEstriboSVG(ladosDesc, cut.f.estriboShape || cut.f.ferroModelId || 'Padrão', cut.f.ladoA, cut.f.ladoB, cut.f.ladoC, cut.f.ladoD, cut.f.ladoE, cut.f.ladoF, [...estriboModels, ...ferroModels]) || renderBarDiagramSVG(ferroModels.find(m => m.id === cut.f.ferroModelId)?.name || '', cut.f.ladoA, cut.f.ladoB, cut.f.ladoC, cut.f.ladoD, cut.f.ladoE, true)
                                                                                    ) : cut.f.drawingType === 'Trava' ? (
                                                                                        renderEstriboSVG(ladosDesc, cut.f.estriboShape || cut.f.ferroModelId || 'Padrão', cut.f.ladoA, cut.f.ladoB, cut.f.ladoC, cut.f.ladoD, cut.f.ladoE, cut.f.ladoF, [...estriboModels, ...ferroModels]) || renderBarDiagramSVG(ferroModels.find(m => m.id === cut.f.ferroModelId)?.name || '', cut.f.ladoA, cut.f.ladoB, cut.f.ladoC, cut.f.ladoD, cut.f.ladoE, true)
                                                                                    ) : cut.f.drawingType === 'CorteDobra' ? (
                                                                                        renderEstriboSVG(ladosDesc, cut.f.estriboShape || cut.f.ferroModelId || 'Padrão', cut.f.ladoA, cut.f.ladoB, cut.f.ladoC, cut.f.ladoD, cut.f.ladoE, cut.f.ladoF, [...estriboModels, ...ferroModels]) || renderBarDiagramSVG(ferroModels.find(m => m.id === cut.f.ferroModelId)?.name || '', cut.f.ladoA, cut.f.ladoB, cut.f.ladoC, cut.f.ladoD, cut.f.ladoE, true)
                                                                                    ) : (
                                                                                        renderEstriboSVG(ladosDesc || '4 LADOS', cut.f.estriboShape || cut.f.ferroModelId || 'Padrão', cut.f.ladoA, cut.f.ladoB, cut.f.ladoC, cut.f.ladoD, cut.f.ladoE, cut.f.ladoF, [...estriboModels, ...ferroModels]) || renderBarDiagramSVG(ferroModels.find(m => m.id === cut.f.ferroModelId)?.name || '', cut.f.ladoA, cut.f.ladoB, cut.f.ladoC, cut.f.ladoD, cut.f.ladoE, true)
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                    <td className="p-3 text-center font-bold text-slate-600 text-sm">{cut.metros.toFixed(2)} m</td>
                                                                </tr>
                                                                );
                                                            })
                                                            ))}
                                                            {(() => {
                                                                const totalOS = grupo.osGroups.length;
                                                                const summaryPecasMap = new Map<string, number>();
                                                                let totalCortes = 0;
                                                                const summaryFormatosMap = new Map<string, number>();
                                                                let totalMetros = 0;
                                                                
                                                                grupo.osGroups.forEach(os => {
                                                                    const currentPecas = summaryPecasMap.get(os.osName) || 0;
                                                                    summaryPecasMap.set(os.osName, currentPecas + os.prodQtde);
                                                                    
                                                                    os.cuts.forEach(cut => {
                                                                        totalCortes += cut.qty;
                                                                        totalMetros += cut.metros;
                                                                        
                                                                        let drawTypeLabel = cut.f.drawingType || 'RETO';
                                                                        if (cut.f.drawingType === 'Estribo') drawTypeLabel = 'ESTRIBO';
                                                                        if (cut.f.drawingType === 'CorteDobra') drawTypeLabel = 'CORTE E DOBRA';
                                                                        if (cut.f.drawingType === 'Trava') drawTypeLabel = 'TRAVA';
                                                                        const ferroModel = ferroModels.find(m => m.id === cut.f.ferroModelId);
                                                                        if (ferroModel && cut.f.drawingType !== 'Estribo' && cut.f.drawingType !== 'Trava' && cut.f.drawingType !== 'CorteDobra') {
                                                                            drawTypeLabel = ferroModel.name;
                                                                        }
                                                                        if (cut.f.nomeElemento) {
                                                                            drawTypeLabel = cut.f.nomeElemento.toUpperCase();
                                                                        }
                                                                        
                                                                        const currentFormato = summaryFormatosMap.get(drawTypeLabel) || 0;
                                                                        summaryFormatosMap.set(drawTypeLabel, currentFormato + cut.qty);
                                                                    });
                                                                });
                                                                
                                                                const summaryPecas = Array.from(summaryPecasMap.entries()).map(([name, qty]) => `${qty} ${name}`);
                                                                const summaryFormatos = Array.from(summaryFormatosMap.entries()).map(([name, qty]) => `${qty} ${name}`);
                                                                
                                                                return (
                                                                    <tr className="bg-slate-200 border-t-2 border-slate-400 font-bold text-slate-800 break-inside-avoid">
                                                                        <td className="p-3 text-center border-r border-slate-300">
                                                                            <div className="text-[10px] text-slate-500 mb-1 uppercase">Total OS</div>
                                                                            <div className="text-lg text-sky-800">{totalOS}</div>
                                                                        </td>
                                                                        <td className="p-3 border-r border-slate-300 text-sm text-center">
                                                                            <div className="text-[10px] text-slate-500 mb-1 uppercase">Qtd de Peças</div>
                                                                            <div className="flex flex-col gap-1 items-center justify-center">
                                                                                {summaryPecas.map((p, i) => (
                                                                                    <div key={i} className="text-sky-800 text-center">{p}</div>
                                                                                ))}
                                                                            </div>
                                                                        </td>
                                                                        <td className="p-3 text-center border-r border-slate-300">
                                                                            <div className="text-[10px] text-slate-500 mb-1 uppercase">Total Cortes</div>
                                                                            <div className="text-lg text-sky-800">{totalCortes}</div>
                                                                        </td>
                                                                        <td className="p-3 border-r border-slate-300 text-sm text-center">
                                                                            <div className="text-[10px] text-slate-500 mb-1 uppercase">Formatos</div>
                                                                            <div className="flex flex-col gap-1 items-center justify-center">
                                                                                {summaryFormatos.map((f, i) => (
                                                                                    <div key={i} className="text-sky-800 text-center">{f}</div>
                                                                                ))}
                                                                            </div>
                                                                        </td>
                                                                        <td className="p-3 text-center text-lg text-sky-800">
                                                                            {totalMetros.toFixed(2)} m
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })()}
                                                        </tbody>
                                                </table>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        );
                    })()}

                    {/* MODAL: Etiqueta Produção Máquina */}
                    {activeModal.type === 'print_etiqueta_maquina' && activeQuote && (() => {
                        const etiquetas: any[] = [];
                        activeQuote.products.forEach((p, pIdx) => {
                            let osName = p.description || 'Produto';
                            osName = osName.replace(/\s*\d*\s*LADOS X.*/i, '').trim();
                            const prodQtde = p.qty || 1;
                            (p.ferros || []).forEach((f, fIdx) => {
                                const osNumber = `OS: ${String(activeQuote.products.slice(0, pIdx).reduce((acc, prevP) => acc + (prevP.ferros?.length || 0), 0) + fIdx + 1).padStart(2, '0')}`;
                                const bitolaStr = f.bitola || '';
                                const bConfig = (bitolas || []).find(b => bitolaStr.startsWith(b.label));
                                const bitolaLabel = bConfig ? bConfig.label : (bitolaStr.split(',')[0] || 'Desconhecida');
                                
                                const cutQty = (f.qtde || 1) * prodQtde;
                                
                                let drawTypeLabel = f.drawingType || 'RETO';
                                if (f.drawingType === 'Estribo') drawTypeLabel = 'ESTRIBO';
                                if (f.drawingType === 'CorteDobra') drawTypeLabel = 'CORTE E DOBRA';
                                if (f.drawingType === 'Trava') drawTypeLabel = 'TRAVA';
                                
                                const ferroModel = ferroModels.find(m => m.id === f.ferroModelId);
                                if (ferroModel && f.drawingType !== 'Estribo' && f.drawingType !== 'Trava' && f.drawingType !== 'CorteDobra') {
                                    drawTypeLabel = ferroModel.name;
                                }
                                
                                if (f.nomeElemento) {
                                    drawTypeLabel = f.nomeElemento.toUpperCase();
                                }
                                
                                let dims = [];
                                if (f.a) dims.push(`A: ${f.a}`);
                                if (f.b) dims.push(`B: ${f.b}`);
                                if (f.c) dims.push(`C: ${f.c}`);
                                if (f.d) dims.push(`D: ${f.d}`);
                                if (f.e) dims.push(`E: ${f.e}`);
                                const dimStr = dims.length > 0 ? ` (${dims.join(', ')})` : '';
                                const formatoDimensions = `${drawTypeLabel}${dimStr}`;

                                const ladosDesc = (p.description || '').match(/(\d+) LADOS/)?.[1] ? `${(p.description || '').match(/(\d+) LADOS/)?.[1]} LADOS` : '4 LADOS';

                                const regexMatch = bitolaLabel.match(/(\d+\.?\d*\s*mm)/i);
                                const shortBitola = regexMatch ? regexMatch[1].toUpperCase() : bitolaLabel.toUpperCase();

                                etiquetas.push({
                                    osNumber,
                                    osName,
                                    bitola: shortBitola,
                                    cutQty,
                                    formatoDimensions,
                                    ladosDesc,
                                    f
                                });
                            });
                        });

                        return (
                            <div className="fixed inset-0 z-50 bg-slate-900 overflow-y-auto print:bg-white">
                                <div className="min-h-screen p-4 flex flex-col items-center print:p-0 print:block">
                                    <div className="w-full max-w-4xl flex justify-between items-center mb-8 bg-white p-4 rounded-xl shadow-lg print:hidden">
                                        <h2 className="text-xl font-bold text-slate-800">🏷️ Etiquetas de Produção Máquina - Orçamento {activeQuote.id}</h2>
                                        <div className="flex gap-4">
                                            <button onClick={() => setIsLabelConfigOpen(true)} className="px-4 py-2 bg-slate-100 border border-slate-300 text-slate-700 font-bold rounded-lg hover:bg-slate-200 flex items-center gap-2">
                                                ⚙️ Configurar
                                            </button>
                                            <button onClick={() => window.print()} className="px-6 py-2 bg-sky-600 text-white font-bold rounded-lg hover:bg-sky-700 shadow-md flex items-center gap-2">
                                                🖨️ Imprimir Etiquetas
                                            </button>
                                            <button onClick={() => setActiveModal(null)} className="px-6 py-2 bg-slate-200 text-slate-700 font-bold rounded-lg hover:bg-slate-300">
                                                Fechar
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div className="w-full print:w-full flex flex-col gap-8 print:gap-0 print:block mx-auto" style={{ maxWidth: `${labelWidth}px` }}>
                                        {etiquetas.map((etq, idx) => (
                                            <div key={idx} className="bg-white rounded-lg shadow-xl print:shadow-none print:rounded-none overflow-hidden flex flex-col" style={{ padding: '20px', boxSizing: 'border-box', pageBreakAfter: 'always', minHeight: '100vh' }}>
                                                <div>
                                                    {/* Header */}
                                                    <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4 mb-4">
                                                        <div className="flex flex-col items-start w-full">
                                                            <div className="flex justify-between w-full items-center mb-2">
                                                                <span className="text-xl font-black text-slate-800 bg-slate-100 px-4 py-2 rounded border border-slate-200">
                                                                    {etq.osNumber}
                                                                </span>
                                                                <div className="w-20 h-20 border-2 border-slate-200 flex flex-col items-center justify-center rounded bg-white shrink-0 p-1">
                                                                    {activeBrandingPartner?.logoUrl ? (
                                                                        <img src={activeBrandingPartner.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                                                                    ) : (
                                                                        <div className="text-[10px] font-bold text-slate-400 text-center uppercase">Logo Cliente</div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <h1 className="text-2xl font-black text-slate-800 uppercase leading-tight mt-1">
                                                                {etq.osName}
                                                            </h1>
                                                            <h2 className="text-sm font-bold text-slate-500 uppercase mt-1">
                                                                CLIENTE: {activeQuote.clientName || 'NÃO INFORMADO'}
                                                            </h2>
                                                            <h2 className="text-sm font-bold text-slate-500 uppercase mt-1">
                                                                ORDEM DE PRODUÇÃO: {activeQuote.id.toString().padStart(6, '0')}
                                                            </h2>
                                                        </div>
                                                    </div>

                                                    {/* Details */}
                                                    <div className="flex flex-col gap-3 mb-6">
                                                        <div className="flex border-b border-slate-200 pb-2">
                                                            <div className="w-1/3 text-xs font-bold text-slate-400 uppercase">Quantidade</div>
                                                            <div className="w-2/3 text-xl font-black text-slate-800">{etq.cutQty}</div>
                                                        </div>
                                                        <div className="flex border-b border-slate-200 pb-2 items-center">
                                                            <div className="w-1/3 text-xs font-bold text-slate-400 uppercase leading-tight pr-2">Nome do Elemento</div>
                                                            <div className="w-2/3 text-lg font-black text-slate-800">{etq.formatoDimensions}</div>
                                                        </div>
                                                        <div className="flex border-b border-slate-200 pb-2 items-center">
                                                            <div className="w-1/3 text-xs font-bold text-slate-400 uppercase">Formato</div>
                                                            <div className="w-2/3 flex flex-col items-start py-2">
                                                                <div className="w-full flex items-center justify-center shrink-0 border border-slate-200 rounded bg-white shadow-sm p-2 overflow-hidden" style={{ height: `${labelHeight}px` }}>
                                                                    <div className="origin-center" style={{ transform: `scale(${labelScale})` }}>
                                                                        {etq.f.drawingType === 'Estribo' ? (
                                                                            renderEstriboSVG(etq.ladosDesc, etq.f.estriboShape || etq.f.ferroModelId || 'Padrão', etq.f.ladoA, etq.f.ladoB, etq.f.ladoC, etq.f.ladoD, etq.f.ladoE, etq.f.ladoF, [...estriboModels, ...ferroModels]) || renderBarDiagramSVG(ferroModels.find(m => m.id === etq.f.ferroModelId)?.name || '', etq.f.ladoA, etq.f.ladoB, etq.f.ladoC, etq.f.ladoD, etq.f.ladoE, true)
                                                                        ) : (
                                                                            renderEstriboSVG(etq.ladosDesc || '4 LADOS', etq.f.estriboShape || etq.f.ferroModelId || 'Padrão', etq.f.ladoA, etq.f.ladoB, etq.f.ladoC, etq.f.ladoD, etq.f.ladoE, etq.f.ladoF, [...estriboModels, ...ferroModels]) || renderBarDiagramSVG(ferroModels.find(m => m.id === etq.f.ferroModelId)?.name || '', etq.f.ladoA, etq.f.ladoB, etq.f.ladoC, etq.f.ladoD, etq.f.ladoE, true)
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex border-b border-slate-200 pb-2">
                                                            <div className="w-1/3 text-xs font-bold text-slate-400 uppercase">Bitola</div>
                                                            <div className="w-2/3 text-base font-black text-slate-800">{etq.bitola}</div>
                                                        </div>
                                                    </div>

                                                    {/* Barcode Mock */}
                                                    <div className="bg-slate-100 p-4 rounded-lg flex flex-col items-center justify-center mb-4 border border-slate-200 mt-8">
                                                        <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest">Código de Rastreio</div>
                                                        <div className="text-xl font-black text-slate-800 tracking-wider">
                                                            LOTE-{new Date().getFullYear()}-{activeQuote.id.toString().padStart(6, '0')}-{idx + 1}
                                                        </div>
                                                        <div className="h-16 w-full max-w-[250px] bg-black mt-3 opacity-80" style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 2px, white 2px, white 4px)' }}></div>
                                                    </div>
                                                </div>

                                                {/* Footer */}
                                                <div className="flex justify-between items-end border-t border-slate-200 pt-4 mt-auto">
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-black text-slate-800">ETIQUETA DE REGISTRO</span>
                                                        <span className="text-[10px] text-slate-500">Uso interno na produção da máquina.</span>
                                                    </div>
                                                    <div className="text-[9px] text-slate-400 font-bold">
                                                        GERADO EM {new Date().toLocaleDateString('pt-BR')}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Config Modal */}
                                    {isLabelConfigOpen && (
                                        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50 print:hidden">
                                            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm">
                                                <h3 className="text-xl font-bold text-slate-800 mb-4 border-b pb-2">⚙️ Configuração de Impressão</h3>
                                                
                                                <div className="space-y-4 mb-6">
                                                    <div>
                                                        <label className="block text-sm font-bold text-slate-700 mb-1">
                                                            Largura da Etiqueta (px)
                                                        </label>
                                                        <input type="number" value={labelWidth} onChange={(e) => setLabelWidth(Number(e.target.value))} className="w-full p-2 border rounded" min="200" max="1000" />
                                                        <p className="text-xs text-slate-500 mt-1">Padrão: 448px</p>
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-bold text-slate-700 mb-1">
                                                            Escala do Desenho
                                                        </label>
                                                        <input type="number" step="0.1" value={labelScale} onChange={(e) => setLabelScale(Number(e.target.value))} className="w-full p-2 border rounded" min="0.5" max="10" />
                                                        <p className="text-xs text-slate-500 mt-1">Padrão: 2.25</p>
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-bold text-slate-700 mb-1">
                                                            Altura da Caixa do Desenho (px)
                                                        </label>
                                                        <input type="number" value={labelHeight} onChange={(e) => setLabelHeight(Number(e.target.value))} className="w-full p-2 border rounded" min="50" max="1000" />
                                                        <p className="text-xs text-slate-500 mt-1">Padrão: 320px</p>
                                                    </div>
                                                </div>

                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => { setLabelWidth(448); setLabelHeight(320); setLabelScale(2.25); }} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded font-bold">
                                                        Resetar
                                                    </button>
                                                    <button onClick={() => setIsLabelConfigOpen(false)} className="px-4 py-2 bg-sky-600 text-white rounded font-bold hover:bg-sky-700">
                                                        Salvar e Fechar
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                </div>
                            </div>
                        );
                    })()}

                    {/* MODAL: Histórico */}
                    {activeModal.type === 'history' && activeQuote && (
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
                    {activeModal.type === 'delete' && activeQuote && (
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
            {/* MODAL: Configurações de Sistema */}
            {showSettingsModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh]">
                        <div className="bg-slate-800 text-white py-4 px-6 flex justify-between items-center rounded-t-2xl shrink-0">
                            <h2 className="text-xl font-black flex items-center gap-2">
                                ⚙️ Configurações de Sistema
                            </h2>
                            <button onClick={() => setShowSettingsModal(false)} className="text-white hover:text-slate-300 text-2xl font-bold">&times;</button>
                        </div>
                        <div className="flex bg-slate-100 border-b">
                            <button 
                                onClick={() => setSettingsTab('bitolas')}
                                className={`flex-1 py-3 font-bold text-sm text-center border-b-2 transition-colors ${settingsTab === 'bitolas' ? 'border-sky-500 text-sky-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                            >
                                Controle de Bitolas
                            </button>
                            <button 
                                onClick={() => setSettingsTab('estribos')}
                                className={`flex-1 py-3 font-bold text-sm text-center border-b-2 transition-colors ${settingsTab === 'estribos' ? 'border-sky-500 text-sky-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                            >
                                Modelos de Estribos
                            </button>
                            <button 
                                onClick={() => setSettingsTab('ferros')}
                                className={`flex-1 py-3 font-bold text-sm text-center border-b-2 transition-colors ${settingsTab === 'ferros' ? 'border-sky-500 text-sky-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                            >
                                Pontas de Ferros
                            </button>
                            <button 
                                onClick={() => setSettingsTab('arame')}
                                className={`flex-1 py-3 font-bold text-sm text-center border-b-2 transition-colors ${settingsTab === 'arame' ? 'border-sky-500 text-sky-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                            >
                                🔗 Arame Recozido
                            </button>
                            <button 
                                onClick={() => setSettingsTab('travas')}
                                className={`flex-1 py-3 font-bold text-sm text-center border-b-2 transition-colors ${settingsTab === 'travas' ? 'border-sky-500 text-sky-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                            >
                                Modelos de Travas
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-grow bg-slate-50">
                            {settingsTab === 'bitolas' ? (
                                <div>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold text-slate-800">Controle de Bitolas</h3>
                                <div>
                                    <button 
                                        onClick={() => setBitolas([...bitolas, { id: String(Date.now()), label: 'Nova Bitola', kgm: 0, price: 0, amarrado: true, corteDobra: true, codMerco: '' }])}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-xl text-sm transition-colors shadow"
                                    >
                                        + Adicionar Bitola
                                    </button>
                                </div>
                            </div>
                            
                            <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-100 text-slate-700 border-b">
                                            <th className="p-3 font-bold text-sm w-24">Cód Merco</th>
                                            <th className="p-3 font-bold text-sm">Bitola (Label)</th>
                                            <th className="p-3 font-bold text-sm w-24">Peso (kg/m)</th>
                                            <th className="p-3 font-bold text-sm w-24">Preço (R$)</th>
                                            <th className="p-3 font-bold text-sm w-24 text-center">Amarrados</th>
                                            <th className="p-3 font-bold text-sm w-24 text-center">Corte/Dobra</th>
                                            <th className="p-3 font-bold text-sm w-20 text-center">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {bitolas.map((b, idx) => (
                                            <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="p-2">
                                                    <input 
                                                        type="text" 
                                                        value={b.codMerco || ''} 
                                                        onChange={(e) => {
                                                            const newBitolas = [...bitolas];
                                                            newBitolas[idx].codMerco = e.target.value;
                                                            setBitolas(newBitolas);
                                                        }}
                                                        placeholder="Código"
                                                        className="w-full border rounded px-2 py-1.5 text-sm font-semibold outline-none focus:border-sky-500 bg-white" 
                                                    />
                                                </td>
                                                <td className="p-2">
                                                    <select
                                                        value={b.id}
                                                        onChange={(e) => {
                                                            const selected = gauges?.find(g => g.id === e.target.value);
                                                            const newBitolas = [...bitolas];
                                                            if (selected) {
                                                                newBitolas[idx].id = selected.id;
                                                                newBitolas[idx].label = `${selected.materialType} ${selected.gauge}`;
                                                                newBitolas[idx].kgm = selected.weightPerMeter || 0;
                                                                newBitolas[idx].price = selected.purchasePrice || 0;
                                                            }
                                                            setBitolas(newBitolas);
                                                        }}
                                                        className="w-full border rounded px-2 py-1.5 text-sm font-semibold outline-none focus:border-sky-500 bg-white"
                                                    >
                                                        <option value={b.id}>{b.label}</option>
                                                        {gauges?.map(g => (
                                                            <option key={g.id} value={g.id}>{g.materialType} - {g.gauge}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="p-2">
                                                    <input type="number" step="0.001" value={b.kgm} readOnly className="w-full border-none rounded px-2 py-1 text-sm bg-transparent outline-none text-center" />
                                                </td>
                                                <td className="p-2">
                                                    <input type="number" step="0.01" value={b.price || 0} readOnly className="w-full border-none rounded px-2 py-1 text-sm bg-transparent outline-none text-center" />
                                                </td>
                                                <td className="p-2 text-center">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={b.amarrado}
                                                        onChange={(e) => {
                                                            const newBitolas = [...bitolas];
                                                            newBitolas[idx].amarrado = e.target.checked;
                                                            setBitolas(newBitolas);
                                                        }}
                                                        className="w-5 h-5 accent-emerald-600 cursor-pointer"
                                                    />
                                                </td>
                                                <td className="p-2 text-center">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={b.corteDobra}
                                                        onChange={(e) => {
                                                            const newBitolas = [...bitolas];
                                                            newBitolas[idx].corteDobra = e.target.checked;
                                                            setBitolas(newBitolas);
                                                        }}
                                                        className="w-5 h-5 accent-emerald-600 cursor-pointer"
                                                    />
                                                </td>
                                                <td className="p-2 text-center">
                                                    <button 
                                                        onClick={async () => {
                                                            try {
                                                                await deleteItem('config_bitolas', b.id);
                                                                showNotification(`Bitola excluída com sucesso no banco de dados!`, 'success');
                                                                
                                                                // Atualiza a tela
                                                                const newBitolas = bitolas.filter((_, i) => i !== idx);
                                                                prevBitolasRef.current = newBitolas;
                                                                setBitolas(newBitolas);
                                                            } catch (err: any) {
                                                                showNotification(`Erro ao excluir bitola: ${err.message || err}`, 'error');
                                                            }
                                                        }}
                                                        className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-2 rounded-lg transition-colors"
                                                        title="Excluir"
                                                    >
                                                        <TrashIcon />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                                </div>
                            ) : settingsTab === 'estribos' ? (
                                <div>
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-lg font-bold text-slate-800">Modelos de Estribos</h3>
                                        <button 
                                            onClick={() => setEstriboModels([...estriboModels, { id: 'est_novo_' + Date.now(), name: 'Novo Estribo', category: settingsEstriboCat, formula: 'A + B', requiredSides: ['A', 'B'], svgTemplate: 'generico', applications: [settingsEstriboArea] }])}
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-xl text-sm transition-colors shadow"
                                        >
                                            + Adicionar Modelo
                                        </button>
                                    </div>

                                    <div className="mb-4 space-y-2">
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Área de Aplicação</p>
                                        <div className="flex gap-2 overflow-x-auto pb-2">
                                            {['Coluna', 'Pilar', 'Broca', 'Viga Superior', 'Viga Baldrame', 'Sapata', 'Corte e Dobra', 'Outros'].map(area => (
                                                <button
                                                    key={area}
                                                    onClick={() => setSettingsEstriboArea(area)}
                                                    className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${settingsEstriboArea === area ? 'bg-blue-600 text-white shadow' : 'bg-white text-slate-600 hover:bg-slate-50 border'}`}
                                                >
                                                    {area}
                                                </button>
                                            ))}
                                        </div>
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider pt-2">Formato</p>
                                        <div className="flex gap-2">
                                            {['3 LADOS', '4 LADOS', '6 LADOS', '8 LADOS', 'REDONDA'].map(cat => (
                                                <button
                                                    key={cat}
                                                    onClick={() => setSettingsEstriboCat(cat)}
                                                    className={`px-3 py-1.5 rounded text-xs font-bold transition-colors ${settingsEstriboCat === cat ? 'bg-slate-700 text-white shadow' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                                >
                                                    {cat}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-slate-100 text-slate-700 border-b">
                                                    <th className="p-3 font-bold text-xs w-48">Nome do Modelo</th>
                                                    <th className="p-3 font-bold text-xs">Fórmula Matemática</th>
                                                    <th className="p-3 font-bold text-xs w-32">Lados Req.</th>
                                                    <th className="p-3 font-bold text-xs w-48">Aparece em:</th>
                                                    <th className="p-3 font-bold text-xs w-36">Desenho</th>
                                                    <th className="p-3 font-bold text-xs w-16 text-center">Excluir</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {estriboModels.filter(m => m.category === settingsEstriboCat && m.applications.includes(settingsEstriboArea)).map((est) => {
                                                    const idx = estriboModels.findIndex(m => m.id === est.id);
                                                    return (
                                                    <tr key={est.id} className="hover:bg-slate-50 transition-colors">
                                                        <td className="p-2">
                                                            <input 
                                                                type="text" 
                                                                value={est.name} 
                                                                onChange={(e) => {
                                                                    const newModels = [...estriboModels];
                                                                    newModels[idx].name = e.target.value;
                                                                    setEstriboModels(newModels);
                                                                }} 
                                                                className="w-full border rounded px-2 py-1.5 text-xs font-semibold outline-none focus:border-sky-500" 
                                                            />
                                                        </td>
                                                        <td className="p-2">
                                                            <input 
                                                                type="text" 
                                                                value={est.formula} 
                                                                onChange={(e) => {
                                                                    const newModels = [...estriboModels];
                                                                    newModels[idx].formula = e.target.value;
                                                                    setEstriboModels(newModels);
                                                                }} 
                                                                className="w-full border rounded px-2 py-1.5 text-xs font-semibold outline-none focus:border-sky-500" 
                                                                placeholder="Ex: (A*2)+B"
                                                            />
                                                        </td>
                                                        <td className="p-2">
                                                            <input 
                                                                type="text" 
                                                                value={est.requiredSides.join(', ')} 
                                                                onChange={(e) => {
                                                                    const newModels = [...estriboModels];
                                                                    newModels[idx].requiredSides = e.target.value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
                                                                    setEstriboModels(newModels);
                                                                }} 
                                                                className="w-full border rounded px-2 py-1.5 text-xs font-semibold outline-none focus:border-sky-500" 
                                                                placeholder="A, B"
                                                            />
                                                        </td>
                                                        <td className="p-2">
                                                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                                                                {['Coluna', 'Pilar', 'Broca', 'Viga Superior', 'Viga Baldrame', 'Sapata', 'Corte e Dobra', 'Outros'].map(app => (
                                                                    <label key={app} className={`cursor-pointer px-1.5 py-0.5 rounded text-[9px] font-bold border transition-colors ${est.applications.includes(app) ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'}`}>
                                                                        <input 
                                                                            type="checkbox"
                                                                            className="hidden"
                                                                            checked={est.applications.includes(app)}
                                                                            onChange={(e) => {
                                                                                const newModels = [...estriboModels];
                                                                                if (e.target.checked) {
                                                                                    if (!newModels[idx].applications.includes(app)) newModels[idx].applications.push(app);
                                                                                } else {
                                                                                    newModels[idx].applications = newModels[idx].applications.filter(a => a !== app);
                                                                                }
                                                                                setEstriboModels(newModels);
                                                                            }}
                                                                        />
                                                                        {app}
                                                                    </label>
                                                                ))}
                                                            </div>
                                                        </td>
                                                        <td className="p-2">
                                                            <div className="flex flex-col gap-1 w-32">
                                                                <div className="h-16 border rounded bg-white flex items-center justify-center p-1 relative group">
                                                                    <div className="pointer-events-none w-full h-full flex items-center justify-center">
                                                                        {renderEstriboSVG(est.category, est.name)}
                                                                    </div>
                                                                    {est.customImageBase64 && (
                                                                        <button 
                                                                            onClick={(e) => {
                                                                                e.preventDefault();
                                                                                const newModels = [...estriboModels];
                                                                                newModels[idx].customImageBase64 = undefined;
                                                                                setEstriboModels(newModels);
                                                                            }}
                                                                            className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto"
                                                                            title="Remover Imagem"
                                                                        >
                                                                            <TrashIcon className="w-3 h-3" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                                {!est.customImageBase64 && (
                                                                    <select
                                                                        value={est.svgTemplate}
                                                                        onChange={(e) => {
                                                                            const newModels = [...estriboModels];
                                                                            newModels[idx].svgTemplate = e.target.value;
                                                                            setEstriboModels(newModels);
                                                                        }}
                                                                        className="w-full border rounded px-1 py-1 text-[10px] font-semibold outline-none focus:border-sky-500 bg-white"
                                                                    >
                                                                        <option value="padrao_4_lados">Padrão 4 L</option>
                                                                        <option value="formato_l">Formato L</option>
                                                                        <option value="formato_reto">Reto</option>
                                                                        <option value="formato_u">Formato U</option>
                                                                        <option value="padrao_3_lados">Padrão 3 L</option>
                                                                        <option value="redonda_padrao">Redonda</option>
                                                                        <option value="generico">Genérico</option>
                                                                    </select>
                                                                )}
                                                                <label className="cursor-pointer text-[10px] text-center bg-slate-200 hover:bg-slate-300 text-slate-700 py-1 rounded transition-colors w-full inline-block">
                                                                    Anexar Imagem
                                                                    <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                                                                        const file = e.target.files?.[0];
                                                                        if (file) {
                                                                            const reader = new FileReader();
                                                                            reader.onload = (ev) => {
                                                                                const newModels = [...estriboModels];
                                                                                newModels[idx].customImageBase64 = ev.target?.result as string;
                                                                                setEstriboModels(newModels);
                                                                            };
                                                                            reader.readAsDataURL(file);
                                                                        }
                                                                    }} />
                                                                </label>
                                                            </div>
                                                        </td>
                                                        <td className="p-2 text-center">
                                                            <div className="flex flex-col gap-1 items-center">
                                                                <button
                                                                    onClick={() => setDrawingBoardTarget(est)}
                                                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors w-full flex items-center justify-center gap-1"
                                                                    title="Desenhar Manualmente"
                                                                >
                                                                    <PencilIcon className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={async () => {
                                                                        try {
                                                                            const m = estriboModels[idx];
                                                                            await deleteItem('model_estribos', m.id);
                                                                            const newModels = estriboModels.filter((_, i) => i !== idx);
                                                                            prevEstribosRef.current = newModels;
                                                                            setEstriboModels(newModels);
                                                                        } catch (err: any) {
                                                                            showNotification(`Erro ao excluir modelo: ${err.message || err}`, 'error');
                                                                        }
                                                                    }}
                                                                    className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors w-full flex items-center justify-center gap-1"
                                                                    title="Remover Modelo"
                                                                >
                                                                    <TrashIcon className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : settingsTab === 'ferros' ? (
                                <div>
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-lg font-bold text-slate-800">Modelos de Ferros Principais</h3>
                                        <button 
                                            onClick={() => setFerroModels([...ferroModels, { 
                                                id: 'fm_' + Date.now(), 
                                                name: 'NOVO FORMATO',
                                                formula: 'A',
                                                requiredSides: ['A']
                                            }])}
                                            className="px-3 py-1.5 bg-sky-500 text-white rounded text-sm font-bold hover:bg-sky-600 transition-colors"
                                        >
                                            + Novo Formato
                                        </button>
                                    </div>
                                    <div className="overflow-x-auto border rounded-lg bg-white shadow-sm max-h-[60vh] overflow-y-auto">
                                        <table className="w-full text-left text-sm text-slate-600">
                                            <thead className="bg-slate-100 text-slate-700 uppercase text-xs sticky top-0 z-10 shadow-sm">
                                                <tr>
                                                    <th className="p-3 w-16">ID</th>
                                                    <th className="p-3">NOME DO MODELO</th>
                                                    <th className="p-3">FÓRMULA DE CÁLCULO</th>
                                                    <th className="p-3 w-32 text-center">LADOS</th>
                                                    <th className="p-3 w-64 text-center">VISUALIZAÇÃO / ANEXO</th>
                                                    <th className="p-3 w-20 text-center">AÇÕES</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {ferroModels.map((ferro, idx) => {
                                                    const hasDrawingData = ferro.customDrawingData && ferro.customDrawingData.points && ferro.customDrawingData.points.length > 0;
                                                    const hasImage = !!ferro.customImageBase64;
                                                    return (
                                                        <tr key={ferro.id} className="hover:bg-slate-50 transition-colors">
                                                            <td className="p-2">
                                                                <span className="font-mono text-xs text-slate-400">{ferro.id}</span>
                                                            </td>
                                                            <td className="p-2">
                                                                <input 
                                                                    type="text" 
                                                                    value={ferro.name} 
                                                                    onChange={(e) => {
                                                                        const newModels = [...ferroModels];
                                                                        newModels[idx].name = e.target.value.toUpperCase();
                                                                        setFerroModels(newModels);
                                                                    }} 
                                                                    className="w-full border rounded px-2 py-1.5 text-xs font-bold outline-none focus:border-sky-500 uppercase" 
                                                                    placeholder="NOME"
                                                                />
                                                            </td>
                                                            <td className="p-2">
                                                                <input 
                                                                    type="text" 
                                                                    value={ferro.formula} 
                                                                    onChange={(e) => {
                                                                        const newModels = [...ferroModels];
                                                                        newModels[idx].formula = e.target.value;
                                                                        setFerroModels(newModels);
                                                                    }} 
                                                                    className="w-full border rounded px-2 py-1.5 text-xs font-mono outline-none focus:border-sky-500" 
                                                                    placeholder="ex: A + D + E"
                                                                />
                                                            </td>
                                                            <td className="p-2">
                                                                <div className="flex flex-wrap gap-1 justify-center">
                                                                    {['A','B','C','D','E','F'].map(side => (
                                                                        <label key={side} className="flex items-center gap-1 cursor-pointer">
                                                                            <input 
                                                                                type="checkbox" 
                                                                                className="accent-sky-600"
                                                                                checked={ferro.requiredSides.includes(side)}
                                                                                onChange={(e) => {
                                                                                    const newModels = [...ferroModels];
                                                                                    if (e.target.checked) {
                                                                                        newModels[idx].requiredSides.push(side);
                                                                                    } else {
                                                                                        newModels[idx].requiredSides = newModels[idx].requiredSides.filter(s => s !== side);
                                                                                    }
                                                                                    setFerroModels(newModels);
                                                                                }}
                                                                            />
                                                                            <span className="text-[10px] font-bold">{side}</span>
                                                                        </label>
                                                                    ))}
                                                                </div>
                                                            </td>
                                                            <td className="p-2 text-center relative group">
                                                                <div className="flex items-center justify-center gap-3">
                                                                    {/* Preview Visualization */}
                                                                    <div className="w-32 h-16 border border-slate-200 rounded flex items-center justify-center bg-white shadow-sm shrink-0 relative">
                                                                        {hasDrawingData ? (
                                                                            <svg viewBox="0 0 400 400" className="w-full h-full p-1" xmlns="http://www.w3.org/2000/svg">
                                                                                <polyline
                                                                                    points={ferro.customDrawingData!.points.map(p => `${p.x},${p.y}`).join(' ')}
                                                                                    fill="none"
                                                                                    stroke="#333"
                                                                                    strokeWidth="8"
                                                                                    strokeLinejoin="round"
                                                                                    strokeLinecap="round"
                                                                                />
                                                                            </svg>
                                                                        ) : hasImage ? (
                                                                            <img src={ferro.customImageBase64} alt="Custom" className="w-full h-full object-contain" />
                                                                        ) : (
                                                                            <div className="flex items-center justify-center w-full h-full">
                                                                                <span className="text-[10px] text-slate-400 font-bold uppercase">SEM DESENHO</span>
                                                                            </div>
                                                                        )}
                                                                        
                                                                        {/* Remove Image Button overlay */}
                                                                        {hasImage && (
                                                                            <button 
                                                                                onClick={(e) => {
                                                                                    e.preventDefault();
                                                                                    const newModels = [...ferroModels];
                                                                                    newModels[idx].customImageBase64 = undefined;
                                                                                    setFerroModels(newModels);
                                                                                }}
                                                                                className="absolute top-0 right-0 bg-red-500 text-white rounded-bl p-0.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto"
                                                                                title="Remover Imagem"
                                                                            >
                                                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                                            </button>
                                                                        )}
                                                                    </div>

                                                                    {/* Upload/Status label */}
                                                                    <div className="flex flex-col items-center justify-center w-16">
                                                                        {hasDrawingData ? (
                                                                            <span className="text-[9px] text-green-600 font-bold bg-green-50 rounded px-1 py-0.5 text-center leading-tight">DESENHO<br/>MANUAL</span>
                                                                        ) : (
                                                                            <label className="cursor-pointer text-blue-600 hover:text-blue-700 text-[10px] flex flex-col items-center group/label">
                                                                                <svg className="w-4 h-4 mb-0.5 text-blue-400 group-hover/label:text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                                                                <span className="font-bold">ANEXAR</span>
                                                                                <input 
                                                                                    type="file" 
                                                                                    accept="image/*" 
                                                                                    className="hidden" 
                                                                                    onChange={(e) => {
                                                                                        const file = e.target.files?.[0];
                                                                                        if (file) {
                                                                                            const reader = new FileReader();
                                                                                            reader.onload = (ev) => {
                                                                                                const newModels = [...ferroModels];
                                                                                                newModels[idx].customImageBase64 = ev.target?.result as string;
                                                                                                setFerroModels(newModels);
                                                                                            };
                                                                                            reader.readAsDataURL(file);
                                                                                        }
                                                                                    }}
                                                                                />
                                                                            </label>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="p-2 text-center">
                                                                <div className="flex flex-col gap-1 items-center">
                                                                    <button
                                                                        onClick={() => setFerroDrawingBoardTarget(ferro)}
                                                                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors w-full flex items-center justify-center gap-1"
                                                                        title="Desenhar Manualmente"
                                                                    >
                                                                        <PencilIcon className="w-4 h-4" />
                                                                    </button>
                                                                    <button
                                                                        onClick={async () => {
                                                                            try {
                                                                                const m = ferroModels[idx];
                                                                                await deleteItem('model_ferros', m.id);
                                                                                const newModels = ferroModels.filter((_, i) => i !== idx);
                                                                                prevFerrosRef.current = newModels;
                                                                                setFerroModels(newModels);
                                                                            } catch (err: any) {
                                                                                showNotification(`Erro ao excluir modelo: ${err.message || err}`, 'error');
                                                                            }
                                                                        }}
                                                                        className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors w-full flex items-center justify-center gap-1"
                                                                        title="Remover Modelo"
                                                                    >
                                                                        <TrashIcon className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : settingsTab === 'arame' ? (
                                <div className="max-w-lg mx-auto">
                                    <h3 className="text-lg font-bold text-slate-800 mb-1">⚙️ Configuração de Arame Recozido</h3>
                                    <p className="text-xs text-slate-500 mb-6">Defina os parâmetros para cálculo automático do arame necessário para cada orçamento. Os <strong>"pontos"</strong> são calculados como: <strong>Qtd Estribos × Qtd Ferros × Qtd da Peça</strong>.</p>

                                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-6">
                                        <div>
                                            <label className="block text-xs font-black text-slate-500 uppercase mb-2">Pontos por KG de Arame</label>
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    step="1"
                                                    value={arameConfig.ptsPorKg}
                                                    onChange={(e) => setArameConfig(prev => ({ ...prev, ptsPorKg: parseFloat(e.target.value) || 256 }))}
                                                    className="w-40 border border-slate-300 rounded-lg p-2.5 text-sm font-bold text-center focus:outline-none focus:border-sky-500 bg-white"
                                                />
                                                <span className="text-sm text-slate-500 font-semibold">pontos = 1 kg de arame</span>
                                            </div>
                                            <p className="text-[11px] text-slate-400 mt-1">Padrão: 256 pontos/kg. Ajuste conforme sua experiência de campo.</p>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-black text-slate-500 uppercase mb-2">Preço Padrão por KG de Arame (R$)</label>
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.50"
                                                    value={arameConfig.precoPorKg}
                                                    onChange={(e) => setArameConfig(prev => ({ ...prev, precoPorKg: parseFloat(e.target.value) || 10 }))}
                                                    className="w-40 border border-slate-300 rounded-lg p-2.5 text-sm font-bold text-center focus:outline-none focus:border-sky-500 bg-white"
                                                />
                                                <span className="text-sm text-slate-500 font-semibold">R$/kg</span>
                                            </div>
                                            <p className="text-[11px] text-slate-400 mt-1">Será preenchido automaticamente ao abrir o checkout do orçamento.</p>
                                        </div>

                                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                            <div className="text-xs font-bold text-amber-800 mb-2">🔗 Como funciona o cálculo:</div>
                                            <div className="text-[11px] text-amber-700 space-y-1.5">
                                                <div>1. Cada peça gera <strong>pontos = estribos × ferros × qtde da peça</strong></div>
                                                <div>2. Total de pontos do orçamento ÷ <strong>{arameConfig.ptsPorKg} pts/kg</strong> = kg de arame sugerido</div>
                                                <div>3. No checkout, o kg calculado é preenchido automaticamente com preço de <strong>R$ {arameConfig.precoPorKg.toFixed(2)}/kg</strong></div>
                                            </div>
                                        </div>

                                        <div className="mt-6 border-t border-slate-200 pt-6">
                                            <label className="block text-xs font-black text-slate-500 uppercase mb-2">Vincular a um Material do Estoque</label>
                                            <select 
                                                value={arameConfig.materialId || ''}
                                                onChange={(e) => setArameConfig(prev => ({ ...prev, materialId: e.target.value }))}
                                                className="w-full max-w-lg border border-slate-300 rounded px-3 py-2 text-sm bg-white font-bold text-slate-700 outline-none focus:border-sky-500 shadow-sm"
                                            >
                                                <option value="">-- Não vincular (Usar preço manual) --</option>
                                                {gauges.map(g => (
                                                    <option key={g.id} value={g.id}>
                                                        {g.productCode ? `[${g.productCode}] ` : ''}{g.commercialName || g.gauge} {g.purchasePrice ? `(R$ ${g.purchasePrice.toFixed(2)})` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                            <p className="text-[10px] text-slate-500 mt-1 uppercase font-semibold">Ao selecionar um material, o sistema usará o código e descrição dele no orçamento final.</p>
                                        </div>

                                        <div className="pt-6 mt-6 border-t border-slate-100">
                                            <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide text-center">Os valores são salvos automaticamente no navegador.</div>
                                        </div>
                                    </div>
                                </div>
                            ) : settingsTab === 'travas' ? (
                                <div>
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-lg font-bold text-slate-800">Modelos de Travas</h3>
                                        <button 
                                            onClick={() => setTravaModels([...travaModels, { 
                                                id: 'trava_' + Date.now(), 
                                                name: 'NOVO FORMATO TRAVA',
                                                formula: 'A',
                                                requiredSides: ['A'],
                                                shapeId: 1
                                            }])}
                                            className="px-3 py-1.5 bg-sky-500 text-white rounded text-sm font-bold hover:bg-sky-600 transition-colors shadow"
                                        >
                                            + Novo Formato
                                        </button>
                                    </div>
                                    <div className="overflow-x-auto border rounded-lg bg-white shadow-sm max-h-[60vh] overflow-y-auto">
                                        <table className="w-full text-left text-sm text-slate-600">
                                            <thead className="bg-slate-100 text-slate-700 uppercase text-xs sticky top-0 z-10 shadow-sm">
                                                <tr>
                                                    <th className="p-3 w-16">ID</th>
                                                    <th className="p-3">NOME DO MODELO</th>
                                                    <th className="p-3">FÓRMULA DE CÁLCULO</th>
                                                    <th className="p-3 w-32 text-center">LADOS</th>
                                                    <th className="p-3 w-40 text-center">SHAPE BASE</th>
                                                    <th className="p-3 w-20 text-center">AÇÕES</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {travaModels.map((trava, idx) => (
                                                    <tr key={trava.id} className="hover:bg-slate-50 transition-colors">
                                                        <td className="p-2">
                                                            <span className="font-mono text-xs text-slate-400">{trava.id}</span>
                                                        </td>
                                                        <td className="p-2">
                                                            <input 
                                                                type="text" 
                                                                value={trava.name} 
                                                                onChange={(e) => {
                                                                    const newModels = [...travaModels];
                                                                    newModels[idx].name = e.target.value.toUpperCase();
                                                                    setTravaModels(newModels);
                                                                }} 
                                                                className="w-full border rounded px-2 py-1.5 text-xs font-bold outline-none focus:border-sky-500 uppercase bg-white text-slate-800" 
                                                                placeholder="NOME"
                                                            />
                                                        </td>
                                                        <td className="p-2">
                                                            <input 
                                                                type="text" 
                                                                value={trava.formula} 
                                                                onChange={(e) => {
                                                                    const newModels = [...travaModels];
                                                                    newModels[idx].formula = e.target.value;
                                                                    setTravaModels(newModels);
                                                                }} 
                                                                className="w-full border rounded px-2 py-1.5 text-xs font-mono outline-none focus:border-sky-500 bg-white text-slate-800" 
                                                                placeholder="ex: A + B"
                                                            />
                                                        </td>
                                                        <td className="p-2">
                                                            <div className="flex flex-wrap gap-1 justify-center">
                                                                {['A','B','C','D','E'].map(side => (
                                                                    <label key={side} className="flex items-center gap-1 cursor-pointer">
                                                                        <input 
                                                                            type="checkbox" 
                                                                            className="accent-sky-600"
                                                                            checked={trava.requiredSides.includes(side)}
                                                                            onChange={(e) => {
                                                                                const newModels = [...travaModels];
                                                                                if (e.target.checked) {
                                                                                    newModels[idx].requiredSides.push(side);
                                                                                } else {
                                                                                    newModels[idx].requiredSides = newModels[idx].requiredSides.filter(s => s !== side);
                                                                                }
                                                                                setTravaModels(newModels);
                                                                            }}
                                                                        />
                                                                        <span className="text-[10px] font-bold">{side}</span>
                                                                    </label>
                                                                ))}
                                                            </div>
                                                        </td>
                                                        <td className="p-2 text-center">
                                                            <select
                                                                value={trava.shapeId}
                                                                onChange={(e) => {
                                                                    const newModels = [...travaModels];
                                                                    newModels[idx].shapeId = Number(e.target.value);
                                                                    newModels[idx].requiredSides = getTravaRequiredSides(Number(e.target.value));
                                                                    setTravaModels(newModels);
                                                                }}
                                                                className="border rounded px-1.5 py-1 text-xs bg-white font-bold outline-none cursor-pointer"
                                                            >
                                                                {[1,2,3,4,5,6,7,8].map(s => (
                                                                    <option key={s} value={s}>Shape {s}</option>
                                                                ))}
                                                            </select>
                                                        </td>
                                                        <td className="p-2 text-center">
                                                            <div className="flex flex-col gap-1 items-center">
                                                                <button
                                                                    onClick={() => setTravaDrawingBoardTarget(trava)}
                                                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors w-full flex items-center justify-center gap-1"
                                                                    title="Desenhar Manualmente"
                                                                >
                                                                    <PencilIcon className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={async () => {
                                                                        try {
                                                                            await deleteItem('model_travas', trava.id);
                                                                            const newModels = travaModels.filter(m => m.id !== trava.id);
                                                                            prevTravasRef.current = newModels;
                                                                            setTravaModels(newModels);
                                                                        } catch (err: any) {
                                                                            showNotification(`Erro ao excluir modelo: ${err.message || err}`, 'error');
                                                                        }
                                                                    }}
                                                                    className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors w-full flex items-center justify-center gap-1"
                                                                    title="Excluir"
                                                                >
                                                                    <TrashIcon className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: Exportar para Produção */}
            {activeModal?.type === 'export_production' && activeQuote && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150 relative z-[101]">
                        <div className="bg-slate-200 py-3.5 px-5 border-b border-slate-300 flex justify-between items-center shrink-0">
                            <div className="flex-1 text-center font-display text-slate-800 text-lg font-bold tracking-tight">
                                Exportar para Produção
                            </div>
                            <button onClick={() => setActiveModal(null)} className="text-white text-xl font-bold">&times;</button>
                        </div>
                        <div className="p-6 space-y-4 text-center">
                            <div className="text-4xl">🚀</div>
                            <h2 className="text-lg font-bold text-slate-800">Deseja enviar a OS nº {activeQuote.id} para as Máquinas?</h2>
                            <p className="text-xs text-slate-500">Ao confirmar, o status será alterado para <strong>Enviado p/ Produção</strong> e ela não poderá mais ser alterada.</p>
                        </div>
                        <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end gap-3 rounded-b-2xl">
                            <button onClick={() => setActiveModal(null)} className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2 px-5 rounded-xl text-xs uppercase transition">Cancelar</button>
                            <button
                                onClick={() => {
                                    setQuotes(prev => prev.map(q => q.id === activeQuote.id ? {
                                        ...q,
                                        status: 'Enviado p/ Produção',
                                        history: [...(q.history || []), { date: new Date().toLocaleString('pt-BR'), action: 'Enviado para Produção', user: currentUser?.name || 'Sistema' }]
                                    } : q));
                                    
                                    // Notify other components that quotes have been updated
                                    setTimeout(() => window.dispatchEvent(new Event('quotes_updated')), 100);

                                    setActiveModal({ type: 'post_export', quoteId: activeQuote.id });
                                    showNotification(`OS nº ${activeQuote.id} enviada para produção!`, 'success');
                                }}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-5 rounded-xl text-xs uppercase transition"
                            >
                                Confirmar Exportação
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: Pós Exportação (Imprimir) */}
            {activeModal?.type === 'post_export' && activeQuote && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150 relative z-[101]">
                        <div className="bg-slate-200 py-3.5 px-5 border-b border-slate-300 flex justify-between items-center shrink-0">
                            <div className="flex-1 text-center font-display text-slate-800 text-lg font-bold tracking-tight">
                                Exportação Concluída
                            </div>
                            <button onClick={() => setActiveModal(null)} className="text-white text-xl font-bold">&times;</button>
                        </div>
                        <div className="p-6 space-y-4 text-center">
                            <div className="text-4xl">✅</div>
                            <h2 className="text-md font-bold text-slate-800">OS nº {activeQuote.id} enviada para produção!</h2>
                            <p className="text-xs text-slate-500 mb-4">O que você deseja imprimir agora?</p>
                            
                            <div className="flex flex-col gap-2">
                                <button 
                                    onClick={() => setActiveModal({ type: 'print_orcamento', quoteId: activeQuote.id })}
                                    className="w-full bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold py-3 px-4 rounded-xl text-sm transition"
                                >
                                    📄 Imprimir Orçamento Modelo Cliente
                                </button>
                                <button 
                                    onClick={() => setActiveModal({ type: 'print_corte', quoteId: activeQuote.id })}
                                    className="w-full bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold py-3 px-4 rounded-xl text-sm transition"
                                >
                                    ✂️ Imprimir Plano de Corte
                                </button>
                                <button 
                                    onClick={() => setActiveModal({ type: 'print_etiqueta_maquina', quoteId: activeQuote.id })}
                                    className="w-full bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold py-3 px-4 rounded-xl text-sm transition"
                                >
                                    🏷️ Imprimir Etiqueta Produção
                                </button>
                            </div>
                        </div>
                        <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-center rounded-b-2xl">
                            <button onClick={() => setActiveModal(null)} className="bg-slate-300 hover:bg-slate-400 text-slate-800 font-bold py-2 px-8 rounded-xl text-xs uppercase transition">Fechar</button>
                        </div>
                    </div>
                </div>
            )}

            {drawingBoardTarget && (
                <EstriboDrawingBoard
                    initialData={drawingBoardTarget.customDrawingData || null}
                    requiredSides={drawingBoardTarget.requiredSides}
                    onSave={(data) => {
                        const newModels = estriboModels.map(m => m.id === drawingBoardTarget.id ? { ...m, customDrawingData: data } : m);
                        setEstriboModels(newModels);
                        setDrawingBoardTarget(null);
                    }}
                    onClose={() => setDrawingBoardTarget(null)}
                />
            )}

            {ferroDrawingBoardTarget && (
                <EstriboDrawingBoard
                    initialData={ferroDrawingBoardTarget.customDrawingData || null}
                    requiredSides={ferroDrawingBoardTarget.requiredSides}
                    onSave={(data) => {
                        const newModels = ferroModels.map(m => m.id === ferroDrawingBoardTarget.id ? { ...m, customDrawingData: data } : m);
                        setFerroModels(newModels);
                        setFerroDrawingBoardTarget(null);
                    }}
                    onClose={() => setFerroDrawingBoardTarget(null)}
                />
            )}

            {travaDrawingBoardTarget && (
                <EstriboDrawingBoard
                    initialData={travaDrawingBoardTarget.customDrawingData || null}
                    requiredSides={travaDrawingBoardTarget.requiredSides}
                    onSave={(data) => {
                        const newModels = travaModels.map(m => m.id === travaDrawingBoardTarget.id ? { ...m, customDrawingData: data } : m);
                        setTravaModels(newModels);
                        setTravaDrawingBoardTarget(null);
                    }}
                    onClose={() => setTravaDrawingBoardTarget(null)}
                />
            )}
        </div>
    );
};

export default PointingSystem;
