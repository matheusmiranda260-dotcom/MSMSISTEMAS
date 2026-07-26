import React, { useState, useRef, useEffect } from 'react';
import { QrCodeIcon, TrashIcon, PrinterIcon, PlayIcon, CheckCircleIcon, ClockIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { insertData, fetchData } from '../services/supabaseService';
import { InventoryConferenceData, Partner } from '../types';

interface Props {
    activeBrandingPartner?: Partner | null;
}

export const InventoryConference: React.FC<Props> = ({ activeBrandingPartner }) => {
    const [scannedLots, setScannedLots] = useState<string[]>([]);
    const [currentScan, setCurrentScan] = useState('');
    const [isConferenceStarted, setIsConferenceStarted] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    // History Modal State
    const [showHistory, setShowHistory] = useState(false);
    const [historyData, setHistoryData] = useState<InventoryConferenceData[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);

    // Keep focus on input for continuous scanning if started
    useEffect(() => {
        if (isConferenceStarted && inputRef.current) {
            inputRef.current.focus();
        }
    }, [scannedLots, isConferenceStarted]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && currentScan.trim() !== '') {
            const code = currentScan.trim();
            
            if (!isConferenceStarted) {
                alert("Atenção: Inicie uma nova conferência antes de bipar os lotes!");
                setCurrentScan('');
                return;
            }

            if (scannedLots.includes(code)) {
                // Alerta de duplicidade (pode ser sonoro no futuro)
                alert(`⚠️ ATENÇÃO: Lote duplicado!\nO lote "${code}" já foi lido nesta conferência.`);
            } else {
                setScannedLots(prev => [code, ...prev]);
            }
            setCurrentScan('');
        }
    };

    const handleRemoveLot = (lotToRemove: string) => {
        setScannedLots(prev => prev.filter(lot => lot !== lotToRemove));
    };

    const handleStartConference = () => {
        if (scannedLots.length > 0) {
            if (!window.confirm('Iniciar nova conferência limpará a lista atual. Deseja continuar?')) {
                return;
            }
        }
        setScannedLots([]);
        setIsConferenceStarted(true);
    };

    const handleFinishConference = async () => {
        if (scannedLots.length === 0) {
            alert('Não há lotes lidos para finalizar a conferência.');
            return;
        }

        if (!window.confirm(`Deseja finalizar esta conferência com ${scannedLots.length} lotes lidos?`)) {
            return;
        }

        setIsSaving(true);
        try {
            await insertData<any>('inventory_conferences', {
                lots: scannedLots,
                status: 'Finalizada',
                user_name: 'Operador Pátio' // Poderia vir do currentUser se estivesse disponível
            });
            alert('Conferência salva com sucesso no Histórico!');
            setIsConferenceStarted(false);
            setScannedLots([]);
        } catch (error) {
            console.error('Erro ao salvar conferência de inventário:', error);
            alert('Erro ao salvar no banco de dados. Tente novamente.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleOpenHistory = async () => {
        setShowHistory(true);
        setIsLoadingHistory(true);
        try {
            const data = await fetchData<InventoryConferenceData>('inventory_conferences');
            // Sort by date descending
            data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            setHistoryData(data || []);
        } catch (error) {
            console.error('Erro ao buscar histórico:', error);
            alert('Erro ao buscar o histórico de conferências.');
        } finally {
            setIsLoadingHistory(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8 animate-fadeIn">
            {/* Header - No print */}
            <div className="no-print bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                        <QrCodeIcon className="w-8 h-8 text-[#00E5FF]" />
                        Inventário (Pátio)
                    </h1>
                    <p className="text-slate-500 mt-1">
                        Leia os QR Codes dos lotes no pátio para gerar um relatório de inventário. Essa ação <strong className="text-amber-600">não altera</strong> o estoque no sistema.
                    </p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <button
                        onClick={handleOpenHistory}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-200 transition-colors font-semibold"
                    >
                        <ClockIcon className="w-5 h-5" />
                        Ver Histórico
                    </button>
                    {!isConferenceStarted ? (
                        <button
                            onClick={handleStartConference}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-bold shadow-sm"
                        >
                            <PlayIcon className="w-5 h-5" />
                            Iniciar Conferência
                        </button>
                    ) : (
                        <button
                            onClick={handleFinishConference}
                            disabled={isSaving || scannedLots.length === 0}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-bold shadow-sm"
                        >
                            <CheckCircleIcon className="w-5 h-5" />
                            {isSaving ? 'Salvando...' : 'Finalizar e Salvar'}
                        </button>
                    )}
                </div>
            </div>

            {/* Scanning Input - No print */}
            <div className={`no-print bg-white p-6 rounded-2xl shadow-sm border mb-6 transition-colors ${isConferenceStarted ? 'border-emerald-400 bg-emerald-50/30' : 'border-slate-200 opacity-70'}`}>
                <label htmlFor="scan-input" className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                    {isConferenceStarted ? (
                        <>
                            <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
                            Conferência em andamento - Aguardando Leitura...
                        </>
                    ) : (
                        "Conferência Parada - Clique em 'Iniciar Conferência' para começar a bipar"
                    )}
                </label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <QrCodeIcon className={`h-6 w-6 ${isConferenceStarted ? 'text-emerald-500' : 'text-slate-400'}`} />
                    </div>
                    <input
                        id="scan-input"
                        ref={inputRef}
                        type="text"
                        value={currentScan}
                        onChange={(e) => setCurrentScan(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={!isConferenceStarted}
                        placeholder={isConferenceStarted ? "Posicione o cursor aqui e leia o QR Code" : "Inicie a conferência primeiro..."}
                        className={`block w-full pl-12 pr-4 py-4 border rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-lg shadow-inner ${isConferenceStarted ? 'border-emerald-300 bg-white' : 'border-slate-300 bg-slate-100 cursor-not-allowed'}`}
                        autoFocus={isConferenceStarted}
                        autoComplete="off"
                    />
                </div>
            </div>

            {/* List Area */}
            <div className="print-section bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <div className="flex justify-between items-center mb-4 no-print">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        Lotes Lidos <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-sm">{scannedLots.length}</span>
                    </h2>
                    {scannedLots.length > 0 && (
                        <button
                            onClick={() => window.print()}
                            className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-semibold"
                        >
                            <PrinterIcon className="w-5 h-5" />
                            Imprimir
                        </button>
                    )}
                </div>

                {scannedLots.length === 0 ? (
                    <div className="flex flex-col justify-center items-center py-20 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 relative overflow-hidden">
                        {activeBrandingPartner?.logoUrl ? (
                            <div className="relative w-64 h-64 md:w-80 md:h-80 flex items-center justify-center">
                                {/* Círculo pulsante de fundo */}
                                <div className="absolute inset-0 bg-blue-100 rounded-full animate-pulse-ring"></div>
                                
                                {/* Animação de preenchimento e explosão */}
                                <img 
                                    src={activeBrandingPartner.logoUrl} 
                                    alt="Logo" 
                                    className="absolute inset-0 w-full h-full object-contain animate-fill-explode"
                                />
                                
                                {/* Logo completa revelada após a explosão */}
                                <img 
                                    src={activeBrandingPartner.logoUrl} 
                                    alt="Logo Completa" 
                                    className="relative w-full h-full object-contain animate-logo-reveal"
                                    style={{ animationDelay: '1.2s', opacity: 0 }}
                                />
                            </div>
                        ) : (
                            <QrCodeIcon className="h-16 w-16 text-slate-300 mb-4 animate-bounce" />
                        )}
                        <h3 className="mt-6 text-lg font-bold text-slate-800">Nenhum lote lido</h3>
                        <p className="mt-2 text-sm text-slate-500 font-medium text-center max-w-sm">
                            Inicie a conferência e posicione o cursor no campo de leitura para começar a bipar os QR Codes.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto border rounded-xl">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-16">
                                        #
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                                        Código do Lote (QR Code)
                                    </th>
                                    <th scope="col" className="relative px-6 py-3 no-print w-24">
                                        <span className="sr-only">Ações</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                                {scannedLots.map((lot, index) => (
                                    <tr key={`${lot}-${index}`} className="hover:bg-slate-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-medium">
                                            {scannedLots.length - index}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900 font-mono">
                                            {lot}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium no-print">
                                            <button
                                                onClick={() => handleRemoveLot(lot)}
                                                className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-2 rounded-lg transition-colors"
                                                title="Remover da lista"
                                            >
                                                <TrashIcon className="w-5 h-5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* History Modal */}
            {showHistory && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-fadeIn">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
                            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                                <ClockIcon className="w-7 h-7 text-blue-500" />
                                Histórico de Conferências de Pátio
                            </h2>
                            <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-slate-600 bg-white p-1 rounded-full shadow-sm">
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto flex-grow bg-slate-50">
                            {isLoadingHistory ? (
                                <div className="text-center py-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                                    <p className="mt-4 text-slate-500 font-medium">Carregando histórico...</p>
                                </div>
                            ) : historyData.length === 0 ? (
                                <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
                                    <ClockIcon className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                                    <p className="text-slate-500 font-medium">Nenhum histórico encontrado.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {historyData.map((conf) => (
                                        <div key={conf.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
                                                <div>
                                                    <p className="text-sm font-bold text-slate-800">
                                                        Data: {new Date(conf.created_at).toLocaleString('pt-BR')}
                                                    </p>
                                                    <p className="text-xs text-slate-500 mt-1">
                                                        Resp: <span className="font-semibold">{conf.user_name || 'Desconhecido'}</span>
                                                    </p>
                                                </div>
                                                <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold border border-blue-100">
                                                    {conf.lots.length} Lotes Lidos
                                                </div>
                                            </div>
                                            
                                            <div className="mt-2">
                                                <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Lotes registrados:</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {conf.lots.map((l, i) => (
                                                        <span key={i} className="inline-block bg-slate-100 border border-slate-200 text-slate-700 text-xs px-2 py-1 rounded font-mono font-medium">
                                                            {l}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
