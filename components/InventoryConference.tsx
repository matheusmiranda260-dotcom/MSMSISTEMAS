import React, { useState, useRef, useEffect } from 'react';
import { QrCodeIcon, TrashIcon, PrinterIcon } from '@heroicons/react/outline';

export const InventoryConference: React.FC = () => {
    const [scannedLots, setScannedLots] = useState<string[]>([]);
    const [currentScan, setCurrentScan] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    // Keep focus on input for continuous scanning
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, [scannedLots]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && currentScan.trim() !== '') {
            const code = currentScan.trim();
            if (!scannedLots.includes(code)) {
                setScannedLots(prev => [code, ...prev]);
            }
            setCurrentScan('');
        }
    };

    const handleRemoveLot = (lotToRemove: string) => {
        setScannedLots(prev => prev.filter(lot => lot !== lotToRemove));
    };

    const handleClearList = () => {
        if (window.confirm('Tem certeza que deseja limpar toda a lista?')) {
            setScannedLots([]);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8 animate-fadeIn">
            {/* Header - No print */}
            <div className="no-print bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                        <QrCodeIcon className="w-8 h-8 text-blue-500" />
                        Inventário (Leitura de QR Code)
                    </h1>
                    <p className="text-slate-500 mt-1">
                        Leia os QR Codes dos lotes no pátio para gerar um relatório de inventário. Essa ação <strong className="text-amber-600">não altera</strong> o estoque no sistema.
                    </p>
                </div>
                
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button
                        onClick={handleClearList}
                        disabled={scannedLots.length === 0}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 disabled:opacity-50 transition-colors font-medium"
                    >
                        <TrashIcon className="w-5 h-5" />
                        Limpar Lista
                    </button>
                    <button
                        onClick={handlePrint}
                        disabled={scannedLots.length === 0}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium shadow-sm shadow-blue-200"
                    >
                        <PrinterIcon className="w-5 h-5" />
                        Imprimir Relatório
                    </button>
                </div>
            </div>

            {/* Scanning Input - No print */}
            <div className="no-print bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-6">
                <label htmlFor="scan-input" className="block text-sm font-semibold text-slate-700 mb-2">
                    Aguardando Leitura... (Use o leitor de QR Code)
                </label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <QrCodeIcon className="h-6 w-6 text-slate-400" />
                    </div>
                    <input
                        id="scan-input"
                        ref={inputRef}
                        type="text"
                        value={currentScan}
                        onChange={(e) => setCurrentScan(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Posicione o cursor aqui e leia o QR Code"
                        className="block w-full pl-12 pr-4 py-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg shadow-inner bg-slate-50"
                        autoFocus
                        autoComplete="off"
                    />
                </div>
            </div>

            {/* List and Print Area */}
            <div className="print-section bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <div className="hidden print:block mb-6 text-center">
                    <h2 className="text-2xl font-bold text-slate-800">Relatório de Inventário</h2>
                    <p className="text-slate-500">Data e Hora: {new Date().toLocaleString('pt-BR')}</p>
                    <p className="text-slate-500">Total de Lotes Lidos: {scannedLots.length}</p>
                </div>
                
                <div className="flex justify-between items-center mb-4 no-print">
                    <h2 className="text-lg font-semibold text-slate-800">Lotes Lidos ({scannedLots.length})</h2>
                </div>

                {scannedLots.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
                        <QrCodeIcon className="mx-auto h-12 w-12 text-slate-300" />
                        <h3 className="mt-2 text-sm font-medium text-slate-900">Nenhum lote lido</h3>
                        <p className="mt-1 text-sm text-slate-500">Comece a ler os QR Codes para preencher a lista.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
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
                                    <tr key={lot} className="hover:bg-slate-50">
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
        </div>
    );
};
