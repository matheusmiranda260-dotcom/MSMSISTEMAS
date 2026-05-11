import React, { useState, useEffect, useMemo } from 'react';
import type { Page, StockItem, ProductionRecord } from '../types';
import { supabase } from '../services/supabaseService';

interface ReportsProps {
    stock: StockItem[];
    trefilaProduction: ProductionRecord[];
    trelicaProduction: ProductionRecord[];
    setPage: (page: Page) => void;
}

// Interfaces locais para estruturação do Relatório da Treliça
interface StopRow {
    id: string;
    inicio: string; // "hh:mm" ou "hh:mm:ss"
    fim: string;    // "hh:mm" ou "hh:mm:ss"
    motivo: string;
}

interface ShiftStats {
    horasTrabalhadas: string; // Padrão "09:00:00"
    pecasProduzidas: number;
    tamanhoPeca: number;      // Metros por peça (ex: 6)
}

interface ProductionUpdateRow {
    id: string;
    qnt: number;
    peso: number;
    data: string; // ex: "01-04"
}

// Tipo de Notificação
interface Toast {
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    id: string;
}

const Reports: React.FC<ReportsProps> = ({ stock, setPage }) => {
    // 1. Estados de Controle da Página
    const [selectedMachine, setSelectedMachine] = useState<'Treliça 1' | 'Treliça 2'>('Treliça 1');
    const [selectedDate, setSelectedDate] = useState<string>(() => {
        // Data de hoje em fuso local AAAA-MM-DD
        return new Date().toLocaleDateString('sv');
    });
    const [loading, setLoading] = useState<boolean>(false);
    const [reportId, setReportId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [toasts, setToasts] = useState<Toast[]>([]);

    // 2. Estados dos Campos do Formulário
    const [productionOrder, setProductionOrder] = useState<string>('');
    const [operatorShiftA, setOperatorShiftA] = useState<string>('');
    const [operatorShiftB, setOperatorShiftB] = useState<string>('');
    const [productDescription, setProductDescription] = useState<string>('TRELIÇA H-12 LEVE 6 MTS');
    const [piecesToProduce, setPiecesToProduce] = useState<number>(4500);

    // Tabelas de paradas
    const [stopsShiftA, setStopsShiftA] = useState<StopRow[]>([]);
    const [stopsShiftB, setStopsShiftB] = useState<StopRow[]>([]);

    // Estatísticas dos turnos
    const [statsShiftA, setStatsShiftA] = useState<ShiftStats>({
        horasTrabalhadas: '09:00:00',
        pecasProduzidas: 0,
        tamanhoPeca: 6
    });
    const [statsShiftB, setStatsShiftB] = useState<ShiftStats>({
        horasTrabalhadas: '09:00:00',
        pecasProduzidas: 0,
        tamanhoPeca: 6
    });

    // Tabela de atualização da produção (rodapé)
    const [productionUpdates, setProductionUpdates] = useState<ProductionUpdateRow[]>([]);

    // Estado para guiar se o banco está ativo ou usando localStorage
    const [dbAvailable, setDbAvailable] = useState<boolean>(true);

    // 3. Sistema Dinâmico de Toasts
    const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts(prev => [...prev, { message, type, id }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 5000);
    };

    // 4. Helpers de Cálculo de Horas e Tempos
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
        // Se a hora fim for menor que a hora início, assume que cruzou a meia-noite
        if (diff < 0) diff += 24 * 3600;
        return diff;
    };

    // Formata data por extenso em português (ex: "quarta-feira, 1 de abril de 2026")
    const formattedProductionDate = useMemo(() => {
        if (!selectedDate) return '';
        const parts = selectedDate.split('-');
        const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return dateObj.toLocaleDateString('pt-BR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }, [selectedDate]);

    // 5. Cálculos em Tempo Real das Tabelas de Paradas e Estatísticas
    const calculatedData = useMemo(() => {
        // Soma as paradas do Turno A
        const secondsParadoA = stopsShiftA.reduce((sum, stop) => {
            return sum + calculateStopDurationSeconds(stop.inicio, stop.fim);
        }, 0);

        // Soma as paradas do Turno B
        const secondsParadoB = stopsShiftB.reduce((sum, stop) => {
            return sum + calculateStopDurationSeconds(stop.inicio, stop.fim);
        }, 0);

        // Total do turno trabalhado (padrão 9 horas = 32400 segundos)
        const totalWorkedA = timeToSeconds(statsShiftA.horasTrabalhadas) || 9 * 3600;
        const totalWorkedB = timeToSeconds(statsShiftB.horasTrabalhadas) || 9 * 3600;

        // Porcentagens do Turno A
        const percentParadoA = totalWorkedA > 0 ? (secondsParadoA / totalWorkedA) * 100 : 0;
        const secondsEfetivoA = Math.max(0, totalWorkedA - secondsParadoA);
        const percentEfetivoA = totalWorkedA > 0 ? (secondsEfetivoA / totalWorkedA) * 100 : 0;

        // Porcentagens do Turno B
        const percentParadoB = totalWorkedB > 0 ? (secondsParadoB / totalWorkedB) * 100 : 0;
        const secondsEfetivoB = Math.max(0, totalWorkedB - secondsParadoB);
        const percentEfetivoB = totalWorkedB > 0 ? (secondsEfetivoB / totalWorkedB) * 100 : 0;

        // Produção em metros
        const metrosProduzidosA = statsShiftA.pecasProduzidas * statsShiftA.tamanhoPeca;
        const metrosProduzidosB = statsShiftB.pecasProduzidas * statsShiftB.tamanhoPeca;

        // Tempo por peça
        const tempoPorPecaSecondsA = statsShiftA.pecasProduzidas > 0 ? (secondsEfetivoA / statsShiftA.pecasProduzidas) : 0;
        const tempoPorPecaSecondsB = statsShiftB.pecasProduzidas > 0 ? (secondsEfetivoB / statsShiftB.pecasProduzidas) : 0;

        // Velocidade (metros por minuto)
        const velocidadeMinutoA = secondsEfetivoA > 0 ? (metrosProduzidosA / (secondsEfetivoA / 60)) : 0;
        const velocidadeMinutoB = secondsEfetivoB > 0 ? (metrosProduzidosB / (secondsEfetivoB / 60)) : 0;

        // Soma das peças produzidas no dia
        const totalPecasProduzidas = statsShiftA.pecasProduzidas + statsShiftB.pecasProduzidas;

        return {
            totalPecasProduzidas,
            turnoA: {
                tempoParadoStr: secondsToTime(secondsParadoA),
                percentParado: percentParadoA.toFixed(1).replace('.', ','),
                tempoEfetivoStr: secondsToTime(secondsEfetivoA),
                percentEfetivo: percentEfetivoA.toFixed(1).replace('.', ','),
                metrosProduzidos: metrosProduzidosA,
                metrosProduzidosStr: `${metrosProduzidosA} metros`,
                tempoPorPecaStr: secondsToTime(Math.floor(tempoPorPecaSecondsA)),
                velocidadeStr: `${velocidadeMinutoA.toFixed(1).replace('.', ',')} metros/ minuto`
            },
            turnoB: {
                tempoParadoStr: secondsToTime(secondsParadoB),
                percentParado: percentParadoB.toFixed(1).replace('.', ','),
                tempoEfetivoStr: secondsToTime(secondsEfetivoB),
                percentEfetivo: percentEfetivoB.toFixed(1).replace('.', ','),
                metrosProduzidosStr: `${metrosProduzidosB} metros`,
                tempoPorPecaStr: secondsToTime(Math.floor(tempoPorPecaSecondsB)),
                velocidadeStr: `${velocidadeMinutoB.toFixed(1).replace('.', ',')} metros/ minuto`
            }
        };
    }, [stopsShiftA, stopsShiftB, statsShiftA, statsShiftB]);

    // 6. Efeito para carregar relatório ao alterar data ou máquina
    useEffect(() => {
        const loadReport = async () => {
            setLoading(true);
            try {
                // Tenta carregar do Supabase
                const { data, error } = await supabase
                    .from('trelica_daily_reports')
                    .select('*')
                    .eq('date', selectedDate)
                    .eq('machine_type', selectedMachine)
                    .maybeSingle();

                if (error) {
                    // Se for erro de tabela inexistente (42P01), desativa dbAvailable e carrega localmente
                    if (error.code === '42P01') {
                        setDbAvailable(false);
                        loadLocalReport();
                    } else {
                        throw error;
                    }
                } else if (data) {
                    setDbAvailable(true);
                    setReportId(data.id);
                    setProductionOrder(data.production_order || '');
                    setOperatorShiftA(data.operator_shift_a || '');
                    setOperatorShiftB(data.operator_shift_b || '');
                    setProductDescription(data.product_description || 'TRELIÇA H-12 LEVE 6 MTS');
                    setPiecesToProduce(Number(data.pieces_to_produce ?? 4500));
                    setStopsShiftA(data.stops_shift_a || []);
                    setStopsShiftB(data.stops_shift_b || []);
                    setStatsShiftA(data.stats_shift_a || { horasTrabalhadas: '09:00:00', pecasProduzidas: 0, tamanhoPeca: 6 });
                    setStatsShiftB(data.stats_shift_b || { horasTrabalhadas: '09:00:00', pecasProduzidas: 0, tamanhoPeca: 6 });
                    setProductionUpdates(data.production_updates || []);
                    showToast(`Relatório de ${selectedMachine} para ${selectedDate} carregado da nuvem.`, 'success');
                } else {
                    // Sem dados no Supabase, tenta o localStorage
                    loadLocalReport();
                }
            } catch (err: any) {
                console.error('Erro ao conectar ao Supabase:', err);
                setDbAvailable(false);
                loadLocalReport();
            } finally {
                setLoading(false);
            }
        };

        const loadLocalReport = () => {
            const localKey = `trelica_report_${selectedMachine}_${selectedDate}`;
            const localData = localStorage.getItem(localKey);
            if (localData) {
                try {
                    const parsed = JSON.parse(localData);
                    setReportId(parsed.id || null);
                    setProductionOrder(parsed.production_order || '');
                    setOperatorShiftA(parsed.operator_shift_a || '');
                    setOperatorShiftB(parsed.operator_shift_b || '');
                    setProductDescription(parsed.product_description || 'TRELIÇA H-12 LEVE 6 MTS');
                    setPiecesToProduce(Number(parsed.pieces_to_produce ?? 4500));
                    setStopsShiftA(parsed.stops_shift_a || []);
                    setStopsShiftB(parsed.stops_shift_b || []);
                    setStatsShiftA(parsed.stats_shift_a || { horasTrabalhadas: '09:00:00', pecasProduzidas: 0, tamanhoPeca: 6 });
                    setStatsShiftB(parsed.stats_shift_b || { horasTrabalhadas: '09:00:00', pecasProduzidas: 0, tamanhoPeca: 6 });
                    setProductionUpdates(parsed.production_updates || []);
                    showToast(`Relatório carregado localmente (Offline).`, 'info');
                } catch (e) {
                    resetFormToDefault();
                }
            } else {
                resetFormToDefault();
            }
        };

        loadReport();
    }, [selectedMachine, selectedDate]);

    // Reseta o formulário para padrões limpos
    const resetFormToDefault = () => {
        setReportId(null);
        setProductionOrder('');
        setOperatorShiftA('');
        setOperatorShiftB('');
        setProductDescription('TRELIÇA H-12 LEVE 6 MTS');
        setPiecesToProduce(4500);
        setStopsShiftA([]);
        setStopsShiftB([]);
        setStatsShiftA({ horasTrabalhadas: '09:00:00', pecasProduzidas: 0, tamanhoPeca: 6 });
        setStatsShiftB({ horasTrabalhadas: '09:00:00', pecasProduzidas: 0, tamanhoPeca: 6 });
        setProductionUpdates([]);
    };

    // 7. Salvar relatório (Nuvem com Fallback Local)
    const handleSaveReport = async () => {
        setIsSaving(true);
        const reportData = {
            date: selectedDate,
            machine_type: selectedMachine,
            production_order: productionOrder,
            operator_shift_a: operatorShiftA,
            operator_shift_b: operatorShiftB,
            product_description: productDescription,
            pieces_to_produce: piecesToProduce,
            stops_shift_a: stopsShiftA,
            stops_shift_b: stopsShiftB,
            stats_shift_a: statsShiftA,
            stats_shift_b: statsShiftB,
            production_updates: productionUpdates,
        };

        // Salva sempre no localStorage primeiro como redundância instantânea
        const localKey = `trelica_report_${selectedMachine}_${selectedDate}`;
        localStorage.setItem(localKey, JSON.stringify({ id: reportId || `local_${Date.now()}`, ...reportData }));

        try {
            if (dbAvailable) {
                // Tenta salvar no Supabase via upsert
                const payload = reportId ? { id: reportId, ...reportData } : reportData;
                const { data, error } = await supabase
                    .from('trelica_daily_reports')
                    .upsert(payload, { onConflict: 'date,machine_type' })
                    .select()
                    .single();

                if (error) {
                    throw error;
                }

                if (data) {
                    setReportId(data.id);
                    // Atualiza o ID no localStorage para manter sincronizado
                    localStorage.setItem(localKey, JSON.stringify(data));
                }
                showToast(`Relatório da ${selectedMachine} salvo em nuvem com sucesso!`, 'success');
            } else {
                // Se já sabemos que o DB não está disponível
                showToast(`Salvo localmente! Para sincronizar em nuvem, execute o script SQL no Supabase.`, 'warning');
            }
        } catch (err: any) {
            console.error('Erro ao salvar relatório no banco de dados:', err);
            setDbAvailable(false);
            showToast(`Salvo localmente! Houve um erro ao salvar na nuvem: ${err.message || 'Verifique sua conexão.'}`, 'warning');
        } finally {
            setIsSaving(false);
        }
    };

    // 8. Carregar Dados de Exemplo (WOW Factor - dados idênticos aos da imagem!)
    const handleLoadSampleData = () => {
        setProductionOrder('OP-2026-0401');
        setOperatorShiftA('Adrian/ junior');
        setOperatorShiftB('Alceu/ thiago');
        setProductDescription('TRELIÇA H-12 LEVE 6 MTS');
        setPiecesToProduce(4500);

        // Paradas Turno B (Esquerdo no modelo físico)
        setStopsShiftB([
            { id: 'sb-1', inicio: '15:15:00', fim: '15:28:00', motivo: 'troca de rolo inferior lado direito' },
            { id: 'sb-2', inicio: '15:33:00', fim: '15:43:00', motivo: 'alinhamento da peça' },
            { id: 'sb-3', inicio: '16:10:00', fim: '16:24:00', motivo: 'troca de rolo inferior lado esquerdo' },
            { id: 'sb-4', inicio: '16:33:00', fim: '16:45:00', motivo: 'alinhamento da peça' },
            { id: 'sb-5', inicio: '18:19:00', fim: '18:34:00', motivo: 'enrosco na calha' },
            { id: 'sb-6', inicio: '19:54:00', fim: '20:18:00', motivo: 'enrosco no pisador de dobra fixa' },
            { id: 'sb-7', inicio: '22:11:00', fim: '22:38:00', motivo: 'enrosco no pisador de dobra fixa' }
        ]);

        // Paradas Turno A (Direito no modelo físico)
        setStopsShiftA([
            { id: 'sa-1', inicio: '05:00:00', fim: '05:18:00', motivo: 'lubrificação' },
            { id: 'sa-2', inicio: '05:22:00', fim: '05:48:00', motivo: 'enrosco no fio sinuzoide' },
            { id: 'sa-3', inicio: '06:10:00', fim: '06:33:00', motivo: 'enrosco no pisador de dobra fixa' },
            { id: 'sa-4', inicio: '06:44:00', fim: '07:01:00', motivo: 'enrosco no pisador de dobra fixa' },
            { id: 'sa-5', inicio: '08:44:00', fim: '09:13:00', motivo: 'quebra de fio sinuzoide' },
            { id: 'sa-6', inicio: '11:10:00', fim: '11:18:00', motivo: 'enrosco no pisador de dobra fixa' }
        ]);

        // Estatísticas Turno A
        setStatsShiftA({
            horasTrabalhadas: '09:00:00',
            pecasProduzidas: 488,
            tamanhoPeca: 6
        });

        // Estatísticas Turno B
        setStatsShiftB({
            horasTrabalhadas: '09:00:00',
            pecasProduzidas: 493,
            tamanhoPeca: 6
        });

        // Atualização de produção
        setProductionUpdates([
            { id: 'pu-1', qnt: 981, peso: 3453, data: '01-04' },
            { id: 'pu-2', qnt: 981, peso: 3453, data: '01-04' }
        ]);

        showToast('Dados de exemplo idênticos aos da foto carregados com sucesso!', 'success');
    };

    // 9. Operações das Tabelas (Adição e Remoção)
    const addStopRow = (shift: 'A' | 'B') => {
        const newStop: StopRow = {
            id: Math.random().toString(36).substring(2, 9),
            inicio: '00:00:00',
            fim: '00:00:00',
            motivo: ''
        };
        if (shift === 'A') {
            setStopsShiftA([...stopsShiftA, newStop]);
        } else {
            setStopsShiftB([...stopsShiftB, newStop]);
        }
    };

    const removeStopRow = (shift: 'A' | 'B', id: string) => {
        if (shift === 'A') {
            setStopsShiftA(stopsShiftA.filter(r => r.id !== id));
        } else {
            setStopsShiftB(stopsShiftB.filter(r => r.id !== id));
        }
    };

    const updateStopField = (shift: 'A' | 'B', id: string, field: keyof StopRow, value: string) => {
        const updater = (rows: StopRow[]) => rows.map(r => r.id === id ? { ...r, [field]: value } : r);
        if (shift === 'A') {
            setStopsShiftA(updater);
        } else {
            setStopsShiftB(updater);
        }
    };

    const addProductionUpdateRow = () => {
        const totalPcs = calculatedData.totalPecasProduzidas || 0;
        const newRow: ProductionUpdateRow = {
            id: Math.random().toString(36).substring(2, 9),
            qnt: totalPcs,
            peso: 0,
            data: selectedDate ? selectedDate.split('-').slice(1, 3).reverse().join('-') : '' // DD-MM
        };
        setProductionUpdates([...productionUpdates, newRow]);
    };

    const removeProductionUpdateRow = (id: string) => {
        setProductionUpdates(productionUpdates.filter(r => r.id !== id));
    };

    const updateProductionUpdateField = (id: string, field: keyof ProductionUpdateRow, value: any) => {
        setProductionUpdates(productionUpdates.map(r => r.id === id ? { ...r, [field]: value } : r));
    };

    return (
        <div className="p-4 sm:p-6 md:p-8 bg-slate-50 min-h-screen font-sans text-slate-800 print-modal-container relative">
            
            {/* CSS de Impressão de alta fidelidade e estilos customizados */}
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    body {
                        background: white !important;
                        color: black !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                    .print-section {
                        padding: 0 !important;
                        margin: 0 !important;
                        background: white !important;
                        border: none !important;
                        box-shadow: none !important;
                    }
                    .print-compact-table {
                        width: 100% !important;
                        border-collapse: collapse !important;
                        margin-bottom: 8px !important;
                    }
                    .print-compact-table th, .print-compact-table td {
                        border: 1px solid #334155 !important;
                        padding: 2px 4px !important;
                        font-size: 10px !important;
                        color: black !important;
                        text-align: center !important;
                    }
                    .print-compact-table th {
                        background-color: #f1f5f9 !important;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .input-print-mode {
                        border: none !important;
                        background: transparent !important;
                        padding: 0 !important;
                        font-weight: bold !important;
                        color: black !important;
                        box-shadow: none !important;
                        width: 100% !important;
                        text-align: center !important;
                    }
                    .card-print {
                        border: 1px solid #94a3b8 !important;
                        border-radius: 4px !important;
                        padding: 8px !important;
                        margin-bottom: 8px !important;
                        background: transparent !important;
                        box-shadow: none !important;
                    }
                    .grid-print {
                        display: grid !important;
                        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                        gap: 12px !important;
                    }
                    .title-print {
                        font-size: 14px !important;
                        text-transform: uppercase !important;
                    }
                }
            `}} />

            {/* Toasts de Notificação Premium */}
            <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none no-print">
                {toasts.map(t => (
                    <div 
                        key={t.id} 
                        className={`p-4 rounded-xl shadow-lg border text-white font-medium flex items-center gap-3 animate-slide-in pointer-events-auto max-w-sm ${
                            t.type === 'success' ? 'bg-emerald-600 border-emerald-500' :
                            t.type === 'error' ? 'bg-rose-600 border-rose-500' :
                            t.type === 'warning' ? 'bg-amber-500 border-amber-400 text-slate-900' :
                            'bg-slate-800 border-slate-700'
                        }`}
                    >
                        {t.type === 'success' && (
                            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        )}
                        {t.type === 'error' && (
                            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        )}
                        {t.type === 'warning' && (
                            <svg className="w-5 h-5 flex-shrink-0 text-slate-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        )}
                        <span className="text-sm">{t.message}</span>
                    </div>
                ))}
            </div>

            {/* Painel Administrativo de Ações - No Print */}
            <header className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 pb-6 border-b border-slate-200 no-print gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-800 flex items-center gap-2">
                        <svg className="w-8 h-8 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 2v-6m-9-3h18c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H3c-1.1 0-2-.9-2-2V5c0-1.1.9-2 2-2z" />
                        </svg>
                        Controle de Produção Diária
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Gere, edite e acompanhe relatórios diários das máquinas Treliça 1 e 2.</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    {/* Botão de Exemplo */}
                    <button
                        onClick={handleLoadSampleData}
                        className="bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold py-2 px-4 rounded-lg transition-all flex items-center gap-2 text-sm border border-amber-300 shadow-sm"
                        title="Preencher com os dados idênticos aos da foto de demonstração."
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Carregar Exemplo
                    </button>

                    <button
                        onClick={() => window.print()}
                        className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2 px-4 rounded-lg transition-all flex items-center gap-2 text-sm shadow-sm"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                        Imprimir
                    </button>

                    <button
                        onClick={handleSaveReport}
                        disabled={isSaving}
                        className={`font-bold py-2 px-5 rounded-lg transition-all flex items-center gap-2 text-sm shadow-md ${
                            isSaving 
                                ? 'bg-slate-400 text-slate-200 cursor-not-allowed' 
                                : 'bg-slate-800 hover:bg-slate-900 text-white'
                        }`}
                    >
                        {isSaving ? (
                            <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                        ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                            </svg>
                        )}
                        {isSaving ? 'Salvando...' : 'Salvar Relatório'}
                    </button>

                    <button
                        onClick={() => {
                            if(window.confirm('Deseja realmente limpar todos os campos deste relatório?')) {
                                resetFormToDefault();
                                showToast('Formulário limpo.', 'info');
                            }
                        }}
                        className="bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold py-2 px-3 rounded-lg transition-all text-sm border border-rose-300 shadow-sm"
                        title="Limpar formulário atual"
                    >
                        Limpar
                    </button>
                </div>
            </header>

            {/* Controles de Filtros e Abas de Seleção - No Print */}
            <section className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 no-print">
                {/* Seletor de Máquina Treliça 1 e 2 */}
                <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 w-full sm:w-auto">
                    {(['Treliça 1', 'Treliça 2'] as const).map(machine => (
                        <button
                            key={machine}
                            onClick={() => setSelectedMachine(machine)}
                            className={`py-2 px-6 rounded-lg font-bold text-sm transition-all w-1/2 sm:w-auto text-center ${
                                selectedMachine === machine
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            {machine}
                        </button>
                    ))}
                </div>

                {/* Filtro por Data */}
                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    <label htmlFor="report-date" className="font-bold text-slate-700 text-sm whitespace-nowrap">Data do Relatório:</label>
                    <input
                        type="date"
                        id="report-date"
                        value={selectedDate}
                        onChange={e => setSelectedDate(e.target.value)}
                        className="p-2 border border-slate-300 rounded-lg text-sm text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-slate-500"
                    />
                </div>
            </section>

            {/* Mensagem Informativa de Status de Conexão - No Print */}
            {!dbAvailable && (
                <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-xl mb-6 shadow-sm flex items-start gap-3 no-print">
                    <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                        <h4 className="font-bold text-amber-800 text-sm">Modo de Persistência Local (Offline) Ativo</h4>
                        <p className="text-amber-700 text-xs mt-0.5">
                            O sistema está salvando seus relatórios com total segurança no navegador. Para compartilhar esses relatórios em nuvem com os demais usuários, peça ao seu administrador para executar o arquivo <strong>supabase_trelica_daily_reports.sql</strong> no painel do Supabase.
                        </p>
                    </div>
                </div>
            )}

            {/* Corpo do Relatório - Área de Impressão e Formulário */}
            {loading ? (
                <div className="bg-white rounded-3xl p-16 border border-slate-200 shadow-sm flex flex-col items-center justify-center min-h-[400px]">
                    <svg className="animate-spin h-10 w-10 text-slate-600 mb-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span className="text-slate-600 font-bold">Buscando informações do relatório...</span>
                </div>
            ) : (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-md p-6 sm:p-8 md:p-10 print-section">
                    
                    {/* Cabeçalho de Impressão Identitário */}
                    <div className="flex flex-col md:flex-row items-center justify-between pb-4 border-b-2 border-slate-800 mb-6 gap-4">
                        <div className="flex items-center gap-3">
                            {/* Logo Corporativo Simulado */}
                            <div className="bg-slate-900 text-white font-black px-4 py-2 rounded text-base flex flex-col items-center justify-center leading-none tracking-tight">
                                <span className="text-xs font-semibold text-slate-400">GRUPO</span>
                                <span className="text-sm font-black">ITA AÇOS</span>
                            </div>
                            <div className="border-l border-slate-300 pl-3">
                                <h2 className="text-lg md:text-xl font-extrabold text-slate-950 uppercase tracking-tight leading-tight">Controle de Produção Diária - Setor Laminação</h2>
                                <h3 className="text-xs md:text-sm font-bold text-slate-700 tracking-wider">MÁQUINA: <span className="text-slate-950 underline">{selectedMachine.toUpperCase()}</span></h3>
                            </div>
                        </div>
                        <div className="text-right flex flex-col md:items-end justify-center">
                            <span className="text-xs font-bold text-slate-500 uppercase">Ficha Técnica Oficial</span>
                            <span className="text-xs md:text-sm font-extrabold text-slate-950 bg-slate-100 py-1 px-3 rounded mt-0.5 border border-slate-200">
                                {reportId ? `Nº: ${reportId.slice(0,8).toUpperCase()}` : 'CRIANDO NOVO RELATÓRIO'}
                            </span>
                        </div>
                    </div>

                    {/* Metadados e Informações Gerais da Ordem de Produção */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 card-print">
                        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-col">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Ordem de Produção :</label>
                            <input
                                type="text"
                                value={productionOrder}
                                onChange={e => setProductionOrder(e.target.value)}
                                placeholder="Insira a OP..."
                                className="mt-1 bg-transparent border-b border-slate-300 focus:border-slate-800 focus:outline-none font-bold text-slate-900 input-print-mode"
                            />
                        </div>

                        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-col md:col-span-1 lg:col-span-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Data da Produção :</label>
                            <span className="text-slate-900 font-extrabold text-sm mt-2 capitalize">{formattedProductionDate}</span>
                        </div>

                        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-col">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Operador/Auxiliar Turno A :</label>
                            <input
                                type="text"
                                value={operatorShiftA}
                                onChange={e => setOperatorShiftA(e.target.value)}
                                placeholder="Ex: Adrian / Junior..."
                                className="mt-1 bg-transparent border-b border-slate-300 focus:border-slate-800 focus:outline-none font-bold text-slate-900 input-print-mode"
                            />
                        </div>

                        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-col">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Operador/Auxiliar Turno B :</label>
                            <input
                                type="text"
                                value={operatorShiftB}
                                onChange={e => setOperatorShiftB(e.target.value)}
                                placeholder="Ex: Alceu / Thiago..."
                                className="mt-1 bg-transparent border-b border-slate-300 focus:border-slate-800 focus:outline-none font-bold text-slate-900 input-print-mode"
                            />
                        </div>

                        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-col lg:col-span-2">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Descrição do Produto :</label>
                                    <input
                                        type="text"
                                        value={productDescription}
                                        onChange={e => setProductDescription(e.target.value)}
                                        placeholder="Ex: TRELIÇA H-12 LEVE 6 MTS..."
                                        className="mt-1 w-full bg-transparent border-b border-slate-300 focus:border-slate-800 focus:outline-none font-bold text-slate-900 input-print-mode"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Peças Produzidas :</label>
                                    <p className="text-xl font-black text-slate-950 mt-1">{calculatedData.totalPecasProduzidas} peças</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* SEÇÃO DE PARADAS E MOTIVOS: TURNO B (Esquerdo) E TURNO A (Direito) */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 grid-print">
                        
                        {/* TURNO B */}
                        <div className="border border-slate-200 rounded-2xl p-4 bg-white flex flex-col justify-between card-print">
                            <div>
                                <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
                                    <h4 className="font-extrabold text-sm text-slate-950 tracking-wider flex items-center gap-1.5 uppercase title-print">
                                        <span className="w-2 h-2 rounded-full bg-slate-900" />
                                        Paradas e Seus Motivos: Turno B
                                    </h4>
                                    <button
                                        onClick={() => addStopRow('B')}
                                        className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs py-1 px-3 rounded transition-all no-print flex items-center gap-1 btn-action-row"
                                    >
                                        + Adicionar Parada
                                    </button>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs text-left text-slate-600 print-compact-table">
                                        <thead className="text-slate-700 bg-slate-100 uppercase font-bold">
                                            <tr>
                                                <th scope="col" className="px-2 py-2 text-center w-20 border border-slate-200">Hr Inicial</th>
                                                <th scope="col" className="px-2 py-2 text-center w-20 border border-slate-200">Hr Final</th>
                                                <th scope="col" className="px-3 py-2 border border-slate-200">Motivo da Parada</th>
                                                <th scope="col" className="px-2 py-2 text-center w-20 border border-slate-200">Duração</th>
                                                <th scope="col" className="px-1 py-1 text-center w-8 no-print border border-slate-200 btn-action-row">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {stopsShiftB.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="text-center py-4 text-slate-400 font-bold italic border border-slate-200">
                                                        Nenhuma parada registrada para o Turno B.
                                                    </td>
                                                </tr>
                                            ) : (
                                                stopsShiftB.map(stop => {
                                                    const duracaoSeconds = calculateStopDurationSeconds(stop.inicio, stop.fim);
                                                    return (
                                                        <tr key={stop.id} className="border-b border-slate-200 hover:bg-slate-50 transition-all">
                                                            <td className="p-1 border border-slate-200 text-center">
                                                                <input
                                                                    type="text"
                                                                    value={stop.inicio}
                                                                    onChange={e => updateStopField('B', stop.id, 'inicio', e.target.value)}
                                                                    placeholder="00:00:00"
                                                                    className="text-center w-full bg-transparent border-none font-semibold focus:ring-0 text-slate-800 input-print-mode"
                                                                />
                                                            </td>
                                                            <td className="p-1 border border-slate-200 text-center">
                                                                <input
                                                                    type="text"
                                                                    value={stop.fim}
                                                                    onChange={e => updateStopField('B', stop.id, 'fim', e.target.value)}
                                                                    placeholder="00:00:00"
                                                                    className="text-center w-full bg-transparent border-none font-semibold focus:ring-0 text-slate-800 input-print-mode"
                                                                />
                                                            </td>
                                                            <td className="p-1 border border-slate-200 text-left">
                                                                <input
                                                                    type="text"
                                                                    value={stop.motivo}
                                                                    onChange={e => updateStopField('B', stop.id, 'motivo', e.target.value)}
                                                                    placeholder="Descreva o motivo..."
                                                                    className="text-left w-full bg-transparent border-none font-semibold focus:ring-0 text-slate-800 input-print-mode"
                                                                />
                                                            </td>
                                                            <td className="p-1 border border-slate-200 text-center font-bold text-slate-900">
                                                                {secondsToTime(duracaoSeconds)}
                                                            </td>
                                                            <td className="p-1 border border-slate-200 text-center no-print btn-action-row">
                                                                <button
                                                                    onClick={() => removeStopRow('B', stop.id)}
                                                                    className="text-rose-600 hover:text-rose-800 font-extrabold hover:bg-rose-50 p-1 rounded"
                                                                    title="Remover linha"
                                                                >
                                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                    </svg>
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Estatísticas do Turno B */}
                            <div className="mt-4 pt-4 border-t border-slate-200">
                                <h5 className="font-extrabold text-xs text-slate-950 uppercase tracking-widest text-center mb-3">Estatística do Turno B:</h5>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-center">
                                        <span className="block text-[10px] font-bold text-slate-500 uppercase">Horas Trabalhadas</span>
                                        <input
                                            type="text"
                                            value={statsShiftB.horasTrabalhadas}
                                            onChange={e => setStatsShiftB({ ...statsShiftB, horasTrabalhadas: e.target.value })}
                                            className="font-extrabold text-sm text-slate-900 text-center w-full bg-transparent border-none p-0 focus:ring-0 input-print-mode mt-0.5"
                                        />
                                    </div>
                                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-center">
                                        <span className="block text-[10px] font-bold text-slate-500 uppercase">Tempo Parada</span>
                                        <span className="font-extrabold text-sm text-rose-600 block mt-0.5">
                                            {calculatedData.turnoB.tempoParadoStr} <span className="text-xs font-black text-rose-500">({calculatedData.turnoB.percentParado}%)</span>
                                        </span>
                                    </div>
                                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-center">
                                        <span className="block text-[10px] font-bold text-slate-500 uppercase">Tempo Efetivo</span>
                                        <span className="font-extrabold text-sm text-emerald-600 block mt-0.5">
                                            {calculatedData.turnoB.tempoEfetivoStr} <span className="text-xs font-black text-emerald-500">({calculatedData.turnoB.percentEfetivo}%)</span>
                                        </span>
                                    </div>
                                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-center">
                                        <span className="block text-[10px] font-bold text-slate-500 uppercase">Quant. Peças Produzidas</span>
                                        <input
                                            type="number"
                                            value={statsShiftB.pecasProduzidas || ''}
                                            onChange={e => setStatsShiftB({ ...statsShiftB, pecasProduzidas: parseInt(e.target.value, 10) || 0 })}
                                            className="font-extrabold text-sm text-slate-900 text-center w-full bg-transparent border-none p-0 focus:ring-0 input-print-mode mt-0.5"
                                        />
                                    </div>
                                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-center">
                                        <span className="block text-[10px] font-bold text-slate-500 uppercase">Tamanho (mts/pç)</span>
                                        <input
                                            type="number"
                                            value={statsShiftB.tamanhoPeca || ''}
                                            onChange={e => setStatsShiftB({ ...statsShiftB, tamanhoPeca: parseFloat(e.target.value) || 0 })}
                                            className="font-extrabold text-sm text-slate-900 text-center w-full bg-transparent border-none p-0 focus:ring-0 input-print-mode mt-0.5"
                                        />
                                    </div>
                                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-center col-span-2 md:col-span-1">
                                        <span className="block text-[10px] font-bold text-slate-500 uppercase">Metros Produzidos</span>
                                        <span className="font-extrabold text-sm text-slate-900 block mt-0.5">{calculatedData.turnoB.metrosProduzidosStr}</span>
                                    </div>
                                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-center col-span-1">
                                        <span className="block text-[10px] font-bold text-slate-500 uppercase">Tempo por Peça</span>
                                        <span className="font-extrabold text-sm text-slate-900 block mt-0.5">{calculatedData.turnoB.tempoPorPecaStr}</span>
                                    </div>
                                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-center col-span-2">
                                        <span className="block text-[10px] font-bold text-slate-500 uppercase">Velocidade da Máquina</span>
                                        <span className="font-extrabold text-sm text-slate-900 block mt-0.5">{calculatedData.turnoB.velocidadeStr}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* TURNO A */}
                        <div className="border border-slate-200 rounded-2xl p-4 bg-white flex flex-col justify-between card-print">
                            <div>
                                <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
                                    <h4 className="font-extrabold text-sm text-slate-950 tracking-wider flex items-center gap-1.5 uppercase title-print">
                                        <span className="w-2 h-2 rounded-full bg-slate-900" />
                                        Paradas e Seus Motivos: Turno A
                                    </h4>
                                    <button
                                        onClick={() => addStopRow('A')}
                                        className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs py-1 px-3 rounded transition-all no-print flex items-center gap-1 btn-action-row"
                                    >
                                        + Adicionar Parada
                                    </button>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs text-left text-slate-600 print-compact-table">
                                        <thead className="text-slate-700 bg-slate-100 uppercase font-bold">
                                            <tr>
                                                <th scope="col" className="px-2 py-2 text-center w-20 border border-slate-200">Hr Inicial</th>
                                                <th scope="col" className="px-2 py-2 text-center w-20 border border-slate-200">Hr Final</th>
                                                <th scope="col" className="px-3 py-2 border border-slate-200">Motivo da Parada</th>
                                                <th scope="col" className="px-2 py-2 text-center w-20 border border-slate-200">Duração</th>
                                                <th scope="col" className="px-1 py-1 text-center w-8 no-print border border-slate-200 btn-action-row">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {stopsShiftA.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="text-center py-4 text-slate-400 font-bold italic border border-slate-200">
                                                        Nenhuma parada registrada para o Turno A.
                                                    </td>
                                                </tr>
                                            ) : (
                                                stopsShiftA.map(stop => {
                                                    const duracaoSeconds = calculateStopDurationSeconds(stop.inicio, stop.fim);
                                                    return (
                                                        <tr key={stop.id} className="border-b border-slate-200 hover:bg-slate-50 transition-all">
                                                            <td className="p-1 border border-slate-200 text-center">
                                                                <input
                                                                    type="text"
                                                                    value={stop.inicio}
                                                                    onChange={e => updateStopField('A', stop.id, 'inicio', e.target.value)}
                                                                    placeholder="00:00:00"
                                                                    className="text-center w-full bg-transparent border-none font-semibold focus:ring-0 text-slate-800 input-print-mode"
                                                                />
                                                            </td>
                                                            <td className="p-1 border border-slate-200 text-center">
                                                                <input
                                                                    type="text"
                                                                    value={stop.fim}
                                                                    onChange={e => updateStopField('A', stop.id, 'fim', e.target.value)}
                                                                    placeholder="00:00:00"
                                                                    className="text-center w-full bg-transparent border-none font-semibold focus:ring-0 text-slate-800 input-print-mode"
                                                                />
                                                            </td>
                                                            <td className="p-1 border border-slate-200 text-left">
                                                                <input
                                                                    type="text"
                                                                    value={stop.motivo}
                                                                    onChange={e => updateStopField('A', stop.id, 'motivo', e.target.value)}
                                                                    placeholder="Descreva o motivo..."
                                                                    className="text-left w-full bg-transparent border-none font-semibold focus:ring-0 text-slate-800 input-print-mode"
                                                                />
                                                            </td>
                                                            <td className="p-1 border border-slate-200 text-center font-bold text-slate-900">
                                                                {secondsToTime(duracaoSeconds)}
                                                            </td>
                                                            <td className="p-1 border border-slate-200 text-center no-print btn-action-row">
                                                                <button
                                                                    onClick={() => removeStopRow('A', stop.id)}
                                                                    className="text-rose-600 hover:text-rose-800 font-extrabold hover:bg-rose-50 p-1 rounded"
                                                                    title="Remover linha"
                                                                >
                                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                    </svg>
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Estatísticas do Turno A */}
                            <div className="mt-4 pt-4 border-t border-slate-200">
                                <h5 className="font-extrabold text-xs text-slate-950 uppercase tracking-widest text-center mb-3">Estatística do Turno A:</h5>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-center">
                                        <span className="block text-[10px] font-bold text-slate-500 uppercase">Horas Trabalhadas</span>
                                        <input
                                            type="text"
                                            value={statsShiftA.horasTrabalhadas}
                                            onChange={e => setStatsShiftA({ ...statsShiftA, horasTrabalhadas: e.target.value })}
                                            className="font-extrabold text-sm text-slate-900 text-center w-full bg-transparent border-none p-0 focus:ring-0 input-print-mode mt-0.5"
                                        />
                                    </div>
                                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-center">
                                        <span className="block text-[10px] font-bold text-slate-500 uppercase">Tempo Parada</span>
                                        <span className="font-extrabold text-sm text-rose-600 block mt-0.5">
                                            {calculatedData.turnoA.tempoParadoStr} <span className="text-xs font-black text-rose-500">({calculatedData.turnoA.percentParado}%)</span>
                                        </span>
                                    </div>
                                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-center">
                                        <span className="block text-[10px] font-bold text-slate-500 uppercase">Tempo Efetivo</span>
                                        <span className="font-extrabold text-sm text-emerald-600 block mt-0.5">
                                            {calculatedData.turnoA.tempoEfetivoStr} <span className="text-xs font-black text-emerald-500">({calculatedData.turnoA.percentEfetivo}%)</span>
                                        </span>
                                    </div>
                                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-center">
                                        <span className="block text-[10px] font-bold text-slate-500 uppercase">Quant. Peças Produzidas</span>
                                        <input
                                            type="number"
                                            value={statsShiftA.pecasProduzidas || ''}
                                            onChange={e => setStatsShiftA({ ...statsShiftA, pecasProduzidas: parseInt(e.target.value, 10) || 0 })}
                                            className="font-extrabold text-sm text-slate-900 text-center w-full bg-transparent border-none p-0 focus:ring-0 input-print-mode mt-0.5"
                                        />
                                    </div>
                                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-center">
                                        <span className="block text-[10px] font-bold text-slate-500 uppercase">Tamanho (mts/pç)</span>
                                        <input
                                            type="number"
                                            value={statsShiftA.tamanhoPeca || ''}
                                            onChange={e => setStatsShiftA({ ...statsShiftA, tamanhoPeca: parseFloat(e.target.value) || 0 })}
                                            className="font-extrabold text-sm text-slate-900 text-center w-full bg-transparent border-none p-0 focus:ring-0 input-print-mode mt-0.5"
                                        />
                                    </div>
                                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-center col-span-2 md:col-span-1">
                                        <span className="block text-[10px] font-bold text-slate-500 uppercase">Metros Produzidos</span>
                                        <span className="font-extrabold text-sm text-slate-900 block mt-0.5">{calculatedData.turnoA.metrosProduzidosStr}</span>
                                    </div>
                                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-center col-span-1">
                                        <span className="block text-[10px] font-bold text-slate-500 uppercase">Tempo por Peça</span>
                                        <span className="font-extrabold text-sm text-slate-900 block mt-0.5">{calculatedData.turnoA.tempoPorPecaStr}</span>
                                    </div>
                                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-center col-span-2">
                                        <span className="block text-[10px] font-bold text-slate-500 uppercase">Velocidade da Máquina</span>
                                        <span className="font-extrabold text-sm text-slate-900 block mt-0.5">{calculatedData.turnoA.velocidadeStr}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* SEÇÃO RODAPÉ: ATUALIZAÇÃO DA PRODUÇÃO */}
                    <div className="border border-slate-200 rounded-2xl p-5 bg-white card-print mt-4">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-200 pb-3 mb-4 gap-4">
                            <h4 className="font-extrabold text-sm text-slate-950 uppercase tracking-widest title-print flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded bg-slate-900 animate-pulse" />
                                Atualização da Produção
                            </h4>
                            
                            <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                                <div className="flex items-center gap-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase whitespace-nowrap">Quantidade a produzir :</label>
                                    <input
                                        type="number"
                                        value={piecesToProduce}
                                        onChange={e => setPiecesToProduce(parseInt(e.target.value, 10) || 0)}
                                        className="w-24 p-1 bg-slate-50 border border-slate-300 rounded font-extrabold text-slate-900 text-center input-print-mode text-xs"
                                    />
                                    <span className="text-xs font-bold text-slate-600 uppercase">treliças</span>
                                </div>
                                <button
                                    onClick={addProductionUpdateRow}
                                    className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs py-1.5 px-3 rounded-lg transition-all no-print ml-auto btn-action-row"
                                >
                                    + Adicionar Registro
                                </button>
                            </div>
                        </div>

                        {/* Tabela de Pesagem e Lotes */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-center text-slate-600 print-compact-table">
                                <thead className="text-slate-700 bg-slate-100 uppercase font-bold">
                                    <tr>
                                        <th scope="col" className="px-4 py-2 border border-slate-200">Quantidade (Pç)</th>
                                        <th scope="col" className="px-4 py-2 border border-slate-200">Peso Total (Kg)</th>
                                        <th scope="col" className="px-4 py-2 border border-slate-200">Peso Médio por Peça (Kg)</th>
                                        <th scope="col" className="px-4 py-2 border border-slate-200">Data</th>
                                        <th scope="col" className="px-2 py-1 no-print border border-slate-200 btn-action-row" style={{ width: '60px' }}>Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {productionUpdates.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="text-center py-4 text-slate-400 font-bold italic border border-slate-200">
                                                Nenhuma pesagem/lote registrado na tabela de atualização.
                                            </td>
                                        </tr>
                                    ) : (
                                        productionUpdates.map(row => {
                                            const weightAverage = row.qnt > 0 ? (row.peso / row.qnt) : 0;
                                            return (
                                                <tr key={row.id} className="border-b border-slate-200 hover:bg-slate-50 transition-all">
                                                    <td className="p-1.5 border border-slate-200">
                                                        <input
                                                            type="number"
                                                            value={row.qnt || ''}
                                                            onChange={e => updateProductionUpdateField(row.id, 'qnt', parseInt(e.target.value, 10) || 0)}
                                                            placeholder="Total de peças"
                                                            className="text-center w-full bg-transparent border-none font-bold text-slate-850 input-print-mode"
                                                        />
                                                    </td>
                                                    <td className="p-1.5 border border-slate-200">
                                                        <input
                                                            type="number"
                                                            value={row.peso || ''}
                                                            onChange={e => updateProductionUpdateField(row.id, 'peso', parseFloat(e.target.value) || 0)}
                                                            placeholder="Insira o peso em Kg"
                                                            className="text-center w-full bg-transparent border-none font-extrabold text-slate-850 input-print-mode"
                                                        />
                                                    </td>
                                                    <td className="p-1.5 border border-slate-200 font-black text-slate-900 bg-slate-50">
                                                        {weightAverage.toFixed(2).replace('.', ',')} Kg
                                                    </td>
                                                    <td className="p-1.5 border border-slate-200">
                                                        <input
                                                            type="text"
                                                            value={row.data}
                                                            onChange={e => updateProductionUpdateField(row.id, 'data', e.target.value)}
                                                            placeholder="DD-MM"
                                                            className="text-center w-full bg-transparent border-none font-bold text-slate-800 input-print-mode"
                                                        />
                                                    </td>
                                                    <td className="p-1.5 border border-slate-200 text-center no-print btn-action-row">
                                                        <button
                                                            onClick={() => removeProductionUpdateRow(row.id)}
                                                            className="text-rose-600 hover:text-rose-800 font-extrabold hover:bg-rose-50 p-1.5 rounded"
                                                            title="Excluir Registro"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Linhas Oficiais de Assinatura de Responsabilidade - Apenas Visíveis na Impressão ou rodapé da Ficha */}
                    <div className="mt-8 pt-8 grid grid-cols-2 gap-8 text-center text-xs font-bold border-t border-dashed border-slate-300 card-print">
                        <div className="flex flex-col items-center">
                            <div className="w-48 border-b-2 border-slate-900 mb-1" />
                            <span className="text-slate-500 uppercase text-[9px] tracking-wider">Assinatura Encarregado / Operador Turno A</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <div className="w-48 border-b-2 border-slate-900 mb-1" />
                            <span className="text-slate-500 uppercase text-[9px] tracking-wider">Assinatura Encarregado / Operador Turno B</span>
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
};

export default Reports;