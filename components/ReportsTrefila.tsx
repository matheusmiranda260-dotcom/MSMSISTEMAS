import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Page } from '../types';

interface ReportsTrefilaProps {
    setPage: (page: Page) => void;
}

// Interfaces locais para estruturação do Relatório da Trefila
interface StopRow {
    id: string;
    inicio: string; // "hh:mm:ss"
    fim: string;    // "hh:mm:ss"
    motivo: string;
}

interface ShiftStats {
    horasTrabalhadas: string; // Padrão "09:00:00"
    pesoEntrada: number;
    pesoSaida: number;
    sucata: number;
    metrosProduzidos: number;
    velocidade: number;
}

interface ProductionUpdateRow {
    id: string;
    data: string; // ex: "07/05/26"
    kgEntrada: number;
    saida: number;
    bitola: string;
}

// Tipo de Notificação
interface Toast {
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    id: string;
}

// Ícones em SVG de Alta Resolução
const CalendarIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
);
const ClipboardIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
);
const UserIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
);
const ClockIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
);
const LayersIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
);

const ReportsTrefila: React.FC<ReportsTrefilaProps> = ({ setPage }) => {
    // 1. Estados de Controle
    const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toLocaleDateString('sv'));
    const [toasts, setToasts] = useState<Toast[]>([]);

    // 2. Estados dos Campos do Formulário
    const [productionOrder, setProductionOrder] = useState<string>('');
    const [operator, setOperator] = useState<string>('');
    const [productDescriptionIn, setProductDescriptionIn] = useState<string>('8mm -- FIO MÁQUINA--');
    const [productDescriptionOut, setProductDescriptionOut] = useState<string>('6mm ---CA60--');

    // Tabela de paradas
    const [stops, setStops] = useState<StopRow[]>([]);

    // Estatísticas do turno
    const [stats, setStats] = useState<ShiftStats>({
        horasTrabalhadas: '09:45:00',
        pesoEntrada: 0,
        pesoSaida: 0,
        sucata: 0,
        metrosProduzidos: 0,
        velocidade: 0
    });

    // Tabela de atualização da produção (rodapé)
    const [productionUpdates, setProductionUpdates] = useState<ProductionUpdateRow[]>([]);

    const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // 3. Sistema de Toasts
    const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts(prev => [...prev, { message, type, id }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
    };

    // 4. Helpers de Cálculo
    const timeToSeconds = (timeStr: string): number => {
        if (!timeStr) return 0;
        const parts = timeStr.trim().split(':');
        const hrs = parseInt(parts[0], 10) || 0;
        const mins = parseInt(parts[1], 10) || 0;
        const secs = parseInt(parts[2], 10) || 0;
        return hrs * 3600 + mins * 60 + secs;
    };

    const secondsToTime = (totalSeconds: number): string => {
        if (totalSeconds <= 0 || isNaN(totalSeconds)) return '00:00:00';
        const hrs = Math.floor(totalSeconds / 3600);
        const mins = Math.floor((totalSeconds % 3600) / 60);
        const secs = Math.floor(totalSeconds % 60);
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    };

    const calculateStopDurationSeconds = (inicio: string, fim: string): number => {
        if (!inicio || !fim) return 0;
        let diff = timeToSeconds(fim) - timeToSeconds(inicio);
        if (diff < 0) diff += 24 * 3600; 
        return diff;
    };

    // Formatações de Data
    const formattedProductionDate = useMemo(() => {
        if (!selectedDate) return '';
        const parts = selectedDate.split('-');
        const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        const weekdays = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
        const dayName = weekdays[dateObj.getDay()];
        const day = dateObj.getDate();
        const year = dateObj.getFullYear();
        const monthName = dateObj.toLocaleDateString('pt-BR', { month: 'long' });
        return `${dayName}, ${day} de ${monthName} de ${year}`;
    }, [selectedDate]);

    const formattedDayOfWeek = useMemo(() => {
        if (!selectedDate) return '';
        const parts = selectedDate.split('-');
        const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        const weekdays = ['DOMINGO', 'SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA', 'SEXTA-FEIRA', 'SÁBADO'];
        return weekdays[dateObj.getDay()];
    }, [selectedDate]);

    // 5. Motor de Cálculos Dinâmicos
    const calculatedData = useMemo(() => {
        // PARADAS
        const paradasSec = stops.reduce((acc, stop) => acc + calculateStopDurationSeconds(stop.inicio, stop.fim), 0);
        
        // TEMPO EFETIVO
        const turnoSec = timeToSeconds(stats.horasTrabalhadas);
        const efetivoSec = Math.max(0, turnoSec - paradasSec);

        // PERCENTUAIS
        const pctParada = turnoSec > 0 ? (paradasSec / turnoSec) * 100 : 0;
        const pctEfetivo = turnoSec > 0 ? (efetivoSec / turnoSec) * 100 : 0;

        // SUCATA PERCENTUAL
        const pctSucata = stats.pesoEntrada > 0 ? (stats.sucata / stats.pesoEntrada) * 100 : 0;

        // TOTAIS DA ATUALIZAÇÃO DE PRODUÇÃO
        const totalKgEntrada = productionUpdates.reduce((acc, row) => acc + (row.kgEntrada || 0), 0);
        const totalKgSaida = productionUpdates.reduce((acc, row) => acc + (row.saida || 0), 0);

        // AGRUPAMENTO POR DATA (Para desenhar a tabela igual ao modelo)
        const groupedUpdates: Record<string, ProductionUpdateRow[]> = {};
        productionUpdates.forEach(row => {
            if (!groupedUpdates[row.data]) groupedUpdates[row.data] = [];
            groupedUpdates[row.data].push(row);
        });

        return {
            tempoParadoSec: paradasSec,
            tempoParadoStr: secondsToTime(paradasSec),
            percentParado: pctParada.toFixed(1).replace('.', ','),
            
            tempoEfetivoSec: efetivoSec,
            tempoEfetivoStr: secondsToTime(efetivoSec),
            percentEfetivo: pctEfetivo.toFixed(1).replace('.', ','),

            percentSucata: pctSucata.toFixed(2).replace('.', ','),

            totalKgEntrada,
            totalKgSaida,
            groupedUpdates
        };
    }, [stops, stats, productionUpdates]);

    // 6. Persistência de Dados (Local Storage)
    const DRAFT_KEY = 'trefila_report_draft';

    const loadDraft = () => {
        try {
            const saved = localStorage.getItem(DRAFT_KEY);
            if (saved) {
                const data = JSON.parse(saved);
                if (data.selectedDate) setSelectedDate(data.selectedDate);
                setProductionOrder(data.productionOrder || '');
                setOperator(data.operator || '');
                setProductDescriptionIn(data.productDescriptionIn || '8mm -- FIO MÁQUINA--');
                setProductDescriptionOut(data.productDescriptionOut || '6mm ---CA60--');
                setStops(data.stops || []);
                setStats(data.stats || { horasTrabalhadas: '09:45:00', pesoEntrada: 0, pesoSaida: 0, sucata: 0, metrosProduzidos: 0, velocidade: 0 });
                setProductionUpdates(data.productionUpdates || []);
                return true;
            }
        } catch (e) {
            console.error('Erro ao carregar rascunho', e);
        }
        return false;
    };

    const resetFormToDefault = () => {
        setSelectedDate(new Date().toLocaleDateString('sv'));
        setProductionOrder('');
        setOperator('');
        setProductDescriptionIn('8mm -- FIO MÁQUINA--');
        setProductDescriptionOut('6mm ---CA60--');
        setStops([]);
        setStats({ horasTrabalhadas: '09:45:00', pesoEntrada: 0, pesoSaida: 0, sucata: 0, metrosProduzidos: 0, velocidade: 0 });
        setProductionUpdates([]);
    };

    const saveReportData = () => {
        const payload = {
            selectedDate,
            productionOrder,
            operator,
            productDescriptionIn,
            productDescriptionOut,
            stops,
            stats,
            productionUpdates
        };
        try {
            localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
        } catch (e) {
            console.error('Erro ao salvar rascunho:', e);
        }
    };

    useEffect(() => {
        loadDraft();
        // Injetar CSS global para inputs numéricos
        const style = document.createElement('style');
        style.innerHTML = `
            .modern-editable-input::-webkit-outer-spin-button,
            .modern-editable-input::-webkit-inner-spin-button {
                -webkit-appearance: none;
                margin: 0;
            }
            .modern-editable-input[type=number] {
                -moz-appearance: textfield;
            }
        `;
        document.head.appendChild(style);
        return () => { document.head.removeChild(style); };
    }, []);

    // Autosave
    useEffect(() => {
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = setTimeout(() => {
            saveReportData();
        }, 1000);
    }, [selectedDate, productionOrder, operator, productDescriptionIn, productDescriptionOut, stops, stats, productionUpdates]);

    // 7. Funções de Manipulação do Formulário
    const addStopRow = () => {
        setStops([...stops, { id: Math.random().toString(), inicio: '', fim: '', motivo: '' }]);
    };
    const removeStopRow = (id: string) => {
        setStops(stops.filter(s => s.id !== id));
    };
    const updateStopRow = (id: string, field: keyof StopRow, value: string) => {
        setStops(stops.map(s => s.id === id ? { ...s, [field]: value } : s));
    };

    const addProductionUpdateRow = () => {
        const defaultData = selectedDate ? `${selectedDate.split('-')[2]}/${selectedDate.split('-')[1]}/${selectedDate.split('-')[0].slice(2)}` : '';
        setProductionUpdates([...productionUpdates, { id: Math.random().toString(), data: defaultData, kgEntrada: 0, saida: 0, bitola: '' }]);
    };
    const removeProductionUpdateRow = (id: string) => {
        setProductionUpdates(productionUpdates.filter(r => r.id !== id));
    };
    const updateProductionUpdateRow = (id: string, field: keyof ProductionUpdateRow, value: any) => {
        setProductionUpdates(productionUpdates.map(r => r.id === id ? { ...r, [field]: value } : r));
    };

    const handleClearData = () => {
        if (window.confirm(`Tem certeza que deseja limpar todos os dados preenchidos da Trefila? Esta ação não pode ser desfeita.`)) {
            resetFormToDefault();
            localStorage.removeItem(DRAFT_KEY);
            showToast('Dados do relatório limpos com sucesso!', 'success');
        }
    };

    const handlePrint = () => {
        saveReportData();
        window.print();
    };

    return (
        <div className="flex flex-col h-full bg-slate-100 overflow-hidden relative">
            {/* Sistema de Toasts */}
            <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
                {toasts.map(toast => (
                    <div key={toast.id} className={`px-4 py-3 rounded-lg shadow-lg text-white font-bold text-sm flex items-center gap-2 animate-fade-in ${toast.type === 'success' ? 'bg-emerald-500' : toast.type === 'error' ? 'bg-rose-500' : toast.type === 'warning' ? 'bg-amber-500' : 'bg-blue-500'}`}>
                        {toast.message}
                    </div>
                ))}
            </div>

            {/* Painel de Controle Superior */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10 shrink-0 shadow-sm no-print">
                <div className="flex items-center gap-4">
                    <div className="bg-blue-600 w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                        <ClipboardIcon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-800 tracking-tight">Geração de Relatório Manual</h1>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Trefila</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button onClick={handleClearData} className="px-5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold rounded-xl text-sm transition-colors border border-rose-200">
                        Limpar Dados
                    </button>
                    <button onClick={handlePrint} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-sm transition-all shadow-md flex items-center gap-2">
                        <ClipboardIcon className="h-4 w-4" />
                        Imprimir Relatório
                    </button>
                </div>
            </div>

            {/* Área Dividida (Formulário Oculto na Impressão, apenas Visível na Tela) */}
            <div className="flex-1 overflow-hidden flex flex-col lg:flex-row print:block print:overflow-visible">
                
                {/* 1. PAINEL DE EDIÇÃO LATERAL (ESCONDIDO NA IMPRESSÃO) */}
                <div className="w-full lg:w-[450px] bg-white border-r border-slate-200 flex flex-col shrink-0 no-print z-0 shadow-[4px_0_24px_rgba(0,0,0,0.02)] overflow-y-auto">
                    <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                        <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <CalendarIcon className="h-4 w-4 text-blue-500" />
                            Configurações Gerais
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Data da Produção</label>
                                <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Ordem de Produção</label>
                                <input type="text" value={productionOrder} onChange={(e) => setProductionOrder(e.target.value)} placeholder="Ex: 83583" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Operador / Auxiliar</label>
                                <input type="text" value={operator} onChange={(e) => setOperator(e.target.value)} placeholder="Ex: Willian / Denis" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all" />
                            </div>
                        </div>
                    </div>

                    <div className="p-6 border-b border-slate-100">
                        <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <LayersIcon className="h-4 w-4 text-blue-500" />
                            Produto
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Descrição Entrada</label>
                                <input type="text" value={productDescriptionIn} onChange={(e) => setProductDescriptionIn(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Descrição Saída</label>
                                <input type="text" value={productDescriptionOut} onChange={(e) => setProductDescriptionOut(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700" />
                            </div>
                        </div>
                    </div>

                    <div className="p-6">
                        <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100 flex items-start gap-4">
                            <div className="bg-blue-100 text-blue-600 w-10 h-10 rounded-full flex items-center justify-center shrink-0">
                                <span className="text-xl">💡</span>
                            </div>
                            <div>
                                <h3 className="font-black text-blue-900 mb-1">Preenchimento Direto</h3>
                                <p className="text-xs text-blue-700 font-medium leading-relaxed">
                                    Os dados de Paradas, Estatísticas e Lotes devem ser preenchidos <strong>diretamente na folha ao lado</strong>. Basta clicar nas linhas pontilhadas ou sobre os números!
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. ÁREA DA FOLHA A4 (Visível na Tela e na Impressão) */}
                <div className="flex-1 overflow-y-auto bg-slate-100 p-8 flex justify-center print:p-0 print:bg-white print:overflow-visible custom-scrollbar">
                    {/* Container A4 */}
                    <div className="bg-white w-full max-w-[800px] shadow-2xl print:shadow-none print:max-w-none print:w-[100%] mx-auto relative group">
                        
                        {/* FOLHA DE IMPRESSÃO */}
                        <div id="print-content" className="w-full bg-white text-black font-sans print:p-0 p-8" style={{ minHeight: '1050px' }}>
                            
                            {/* CABEÇALHO */}
                            <div className="flex justify-between items-center mb-2">
                                <img src="/ita-acos-logo.png" alt="ITA AÇOS" className="h-16 w-auto object-contain" />
                                <div className="text-center flex-1">
                                    <h1 className="text-base font-black uppercase leading-tight tracking-tight">
                                        CONTROLE DE PRODUÇÃO DIARIA- SETOR LAMINAÇÃO<br/>
                                        TREFILA
                                    </h1>
                                </div>
                                <div className="w-16"></div> {/* Spacer */}
                            </div>

                            {/* INFORMAÇÕES GERAIS */}
                            <table className="w-full border-collapse border-2 border-black mb-2 text-sm font-bold">
                                <tbody>
                                    <tr>
                                        <td className="border-2 border-black p-1.5 bg-white text-center">
                                            Ordem de produção : <span className="font-black text-base">{productionOrder || '___________'}</span>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="border-2 border-black p-1.5 bg-white text-center">
                                            Data da produção: <span className="font-bold uppercase text-base">{formattedProductionDate}</span>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="border-2 border-black p-1.5 bg-white text-center">
                                            Operador/auxiliar: <span className="font-black text-base uppercase">{operator || '________________________'}</span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>

                            {/* DESCRIÇÃO DO PRODUTO */}
                            <table className="w-full border-collapse border-2 border-black mb-4 text-sm font-bold">
                                <tbody>
                                    <tr>
                                        <td className="border-b-2 border-black p-1.5 text-center">
                                            Descrição do produto (entrada): <span className="font-black text-rose-700 text-base ml-2">{productDescriptionIn}</span>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="p-1.5 text-center">
                                            Descrição do produto (Saída): <span className="font-black text-emerald-700 text-base ml-2">{productDescriptionOut}</span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>

                            {/* PARADAS E SEUS MOTIVOS */}
                            <div className="mb-4">
                                <h2 className="text-center italic font-black text-sm mb-1 underline uppercase">PARADAS E SEUS MOTIVOS:</h2>
                                <table className="w-full border-collapse border-2 border-black text-xs font-bold text-center">
                                    <tbody>
                                        {stops.map((stop) => {
                                            const durationSec = calculateStopDurationSeconds(stop.inicio, stop.fim);
                                            return (
                                                <tr key={stop.id} className="relative group/row">
                                                    <td className="border border-black w-[15%] text-rose-600 p-0">
                                                        <input type="time" value={stop.inicio} onChange={e => updateStopRow(stop.id, 'inicio', e.target.value)} className="w-full text-center font-bold text-rose-600 bg-transparent border-none p-1 focus:ring-0" />
                                                    </td>
                                                    <td className="border border-black w-[15%] text-emerald-600 p-0">
                                                        <input type="time" value={stop.fim} onChange={e => updateStopRow(stop.id, 'fim', e.target.value)} className="w-full text-center font-bold text-emerald-600 bg-transparent border-none p-1 focus:ring-0" />
                                                    </td>
                                                    <td className="border border-black w-[50%] p-0 px-2 italic">
                                                        <input type="text" value={stop.motivo} onChange={e => updateStopRow(stop.id, 'motivo', e.target.value)} placeholder="Motivo da parada..." className="w-full font-bold italic text-center text-slate-800 bg-transparent border-none p-1 focus:ring-0" />
                                                    </td>
                                                    <td className="border border-black w-[20%] text-rose-600 font-black p-1">
                                                        {secondsToTime(durationSec)}
                                                    </td>
                                                    {/* Delete Button (No Print) */}
                                                    <td className="border-none w-0 p-0 relative no-print">
                                                        <button onClick={() => removeStopRow(stop.id)} className="absolute -right-8 top-1/2 -translate-y-1/2 p-1 text-slate-300 hover:text-rose-500 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                                            ✕
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {/* Row to add more */}
                                        <tr className="no-print">
                                            <td colSpan={4} className="p-1 border border-slate-200">
                                                <button onClick={addStopRow} className="w-full py-1 text-xs font-black text-blue-500 hover:bg-blue-50 rounded transition-colors">+ ADICIONAR PARADA</button>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* ESTATÍSTICA DO DIA */}
                            <div className="mb-4 border-2 border-black p-4">
                                <h2 className="text-center italic font-black text-sm mb-4 underline uppercase">ESTATÍSTICA DO DIA:</h2>
                                <div className="max-w-[450px] mx-auto space-y-1 text-sm">
                                    {/* Horas */}
                                    <div className="flex justify-between items-center font-bold">
                                        <span className="text-right w-1/2 pr-2">Horas (Turno trabalhados):</span>
                                        <div className="w-1/2 pl-2">
                                            <input type="time" step="1" value={stats.horasTrabalhadas} onChange={e => setStats({ ...stats, horasTrabalhadas: e.target.value })} className="modern-editable-input font-black text-base text-slate-900 border-none p-0 w-24 focus:ring-0" />
                                        </div>
                                    </div>
                                    {/* Parada */}
                                    <div className="flex items-center font-bold text-rose-600">
                                        <span className="text-right w-1/2 pr-2">Tempo de maquina (parada) :</span>
                                        <div className="w-1/2 pl-2 flex gap-4 items-center">
                                            <span className="font-black text-base w-20">{calculatedData.tempoParadoStr}</span>
                                            <span>{calculatedData.percentParado}%</span>
                                        </div>
                                    </div>
                                    {/* Efetivo */}
                                    <div className="flex items-center font-bold text-emerald-600">
                                        <span className="text-right w-1/2 pr-2">Tempo de maquina (Efetivo) :</span>
                                        <div className="w-1/2 pl-2 flex gap-4 items-center">
                                            <span className="font-black text-base w-20">{calculatedData.tempoEfetivoStr}</span>
                                            <span>{calculatedData.percentEfetivo}%</span>
                                        </div>
                                    </div>
                                    {/* Peso Entrada */}
                                    <div className="flex items-center font-bold">
                                        <span className="text-right w-1/2 pr-2">Peso entrada:</span>
                                        <div className="w-1/2 pl-2 flex items-center font-black text-base">
                                            <input type="number" value={stats.pesoEntrada || ''} onChange={e => setStats({ ...stats, pesoEntrada: parseInt(e.target.value) || 0 })} className="modern-editable-input text-left w-16 border-none p-0 font-black focus:ring-0" placeholder="0" /> kg
                                        </div>
                                    </div>
                                    {/* Peso Saída */}
                                    <div className="flex items-center font-bold">
                                        <span className="text-right w-1/2 pr-2">Peso saida:</span>
                                        <div className="w-1/2 pl-2 flex items-center font-black text-base">
                                            <input type="number" value={stats.pesoSaida || ''} onChange={e => setStats({ ...stats, pesoSaida: parseInt(e.target.value) || 0 })} className="modern-editable-input text-left w-16 border-none p-0 font-black focus:ring-0" placeholder="0" /> kg
                                        </div>
                                    </div>
                                    {/* Sucata */}
                                    <div className="flex items-center font-bold">
                                        <span className="text-right w-1/2 pr-2">sucata:</span>
                                        <div className="w-1/2 pl-2 flex items-center gap-4">
                                            <div className="font-black text-base">
                                                <input type="number" value={stats.sucata || ''} onChange={e => setStats({ ...stats, sucata: parseInt(e.target.value) || 0 })} className="modern-editable-input text-left w-12 border-none p-0 font-black focus:ring-0" placeholder="0" /> kg
                                            </div>
                                            <span className="text-rose-600 font-bold">{calculatedData.percentSucata}%</span>
                                        </div>
                                    </div>
                                    {/* Metros */}
                                    <div className="flex items-center font-bold">
                                        <span className="text-right w-1/2 pr-2">Quant. metros produzidos:</span>
                                        <div className="w-1/2 pl-2 flex items-center font-black text-base">
                                            <input type="number" value={stats.metrosProduzidos || ''} onChange={e => setStats({ ...stats, metrosProduzidos: parseInt(e.target.value) || 0 })} className="modern-editable-input text-left w-20 border-none p-0 font-black focus:ring-0" placeholder="0" /> metros
                                        </div>
                                    </div>
                                    {/* Velocidade */}
                                    <div className="flex items-center font-bold">
                                        <span className="text-right w-1/2 pr-2">Velocidade:</span>
                                        <div className="w-1/2 pl-2">
                                            <input type="number" step="0.01" value={stats.velocidade || ''} onChange={e => setStats({ ...stats, velocidade: parseFloat(e.target.value) || 0 })} className="modern-editable-input text-left w-16 border-none p-0 font-black text-base focus:ring-0" placeholder="0" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* ATUALIZAÇÃO DA PRODUÇÃO */}
                            <div className="border-2 border-black p-4">
                                <h2 className="text-center italic font-black text-sm mb-4 underline uppercase">ATUALIZAÇÃO DA PRODUÇÃO:</h2>
                                
                                <table className="w-full max-w-[500px] mx-auto border-collapse text-xs font-bold text-center">
                                    <thead>
                                        <tr className="border-b-2 border-black">
                                            <th className="p-1.5 border-x border-black w-1/4">Data</th>
                                            <th className="p-1.5 border-x border-black w-1/4">kg (entrada)</th>
                                            <th className="p-1.5 border-x border-black w-1/4">saida</th>
                                            <th className="p-1.5 border-x border-black w-1/4">bitola</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.entries(calculatedData.groupedUpdates).map(([date, rows], groupIdx) => {
                                            const totalKgEntradaGroup = rows.reduce((acc, row) => acc + (row.kgEntrada || 0), 0);
                                            const totalSaidaGroup = rows.reduce((acc, row) => acc + (row.saida || 0), 0);
                                            
                                            return (
                                                <React.Fragment key={groupIdx}>
                                                    {rows.map((row, rowIdx) => (
                                                        <tr key={row.id} className="border-x border-black relative group/row">
                                                            {rowIdx === 0 ? (
                                                                <td rowSpan={rows.length} className="border-x border-black p-1 align-middle text-sm">
                                                                    <input type="text" value={row.data} onChange={e => updateProductionUpdateRow(row.id, 'data', e.target.value)} className="w-full text-center font-bold bg-transparent border-none p-0 focus:ring-0" placeholder="DD/MM/AA" />
                                                                </td>
                                                            ) : null}
                                                            <td className="border-x border-black p-1">
                                                                <input type="number" value={row.kgEntrada || ''} onChange={e => updateProductionUpdateRow(row.id, 'kgEntrada', parseInt(e.target.value) || 0)} className="w-full text-center font-bold bg-transparent border-none p-0 focus:ring-0 modern-editable-input" />
                                                            </td>
                                                            <td className="border-x border-black p-1">
                                                                <input type="number" value={row.saida || ''} onChange={e => updateProductionUpdateRow(row.id, 'saida', parseInt(e.target.value) || 0)} className="w-full text-center font-bold bg-transparent border-none p-0 focus:ring-0 modern-editable-input" />
                                                            </td>
                                                            <td className="border-x border-black p-1">
                                                                <input type="text" value={row.bitola} onChange={e => updateProductionUpdateRow(row.id, 'bitola', e.target.value)} className="w-full text-center font-bold bg-transparent border-none p-0 focus:ring-0" placeholder="5,98mm" />
                                                            </td>
                                                            {/* Delete Button (No Print) */}
                                                            <td className="border-none w-0 p-0 relative no-print">
                                                                <button onClick={() => removeProductionUpdateRow(row.id)} className="absolute -right-8 top-1/2 -translate-y-1/2 p-1 text-slate-300 hover:text-rose-500 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                                                    ✕
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {/* Subtotal do Grupo */}
                                                    <tr className="border-y border-black font-black text-rose-600 text-sm">
                                                        <td className="border-x border-black"></td>
                                                        <td className="border-x border-black p-1">{totalKgEntradaGroup > 0 ? totalKgEntradaGroup : ''}</td>
                                                        <td className="border-x border-black p-1">{totalSaidaGroup > 0 ? totalSaidaGroup : ''}</td>
                                                        <td className="border-x border-black"></td>
                                                    </tr>
                                                </React.Fragment>
                                            );
                                        })}
                                        
                                        <tr className="no-print">
                                            <td colSpan={4} className="p-1 border border-slate-200">
                                                <button onClick={addProductionUpdateRow} className="w-full py-1 text-xs font-black text-blue-500 hover:bg-blue-50 rounded transition-colors">+ ADICIONAR LOTE DE PESAGEM</button>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReportsTrefila;
