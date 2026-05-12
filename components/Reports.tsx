import React, { useState } from 'react';
import type { Page, StockItem, ProductionRecord } from '../types';
import ReportsTrelica from './ReportsTrelica';
import ReportsTrefila from './ReportsTrefila';

interface ReportsProps {
    stock: StockItem[];
    trefilaProduction: ProductionRecord[];
    trelicaProduction: ProductionRecord[];
    setPage: (page: Page) => void;
}

const Reports: React.FC<ReportsProps> = ({ stock, trefilaProduction, trelicaProduction, setPage }) => {
    const [activeTab, setActiveTab] = useState<'trelica' | 'trefila'>('trelica');

    return (
        <div className="flex flex-col h-full bg-slate-100">
            {/* Tabs de Seleção (Ocultas na Impressão) */}
            <div className="bg-white px-6 py-3 border-b border-slate-200 flex items-center gap-2 no-print shrink-0 shadow-sm z-20">
                <button
                    onClick={() => setActiveTab('trelica')}
                    className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all ${
                        activeTab === 'trelica' 
                        ? 'bg-indigo-600 text-white shadow-md' 
                        : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200'
                    }`}
                >
                    Relatório Diário - Treliça
                </button>
                <button
                    onClick={() => setActiveTab('trefila')}
                    className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all ${
                        activeTab === 'trefila' 
                        ? 'bg-blue-600 text-white shadow-md' 
                        : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200'
                    }`}
                >
                    Relatório Diário - Trefila
                </button>
            </div>

            {/* Renderizar o Relatório Selecionado */}
            <div className="flex-1 flex flex-col overflow-hidden relative">
                {activeTab === 'trelica' ? (
                    <ReportsTrelica 
                        stock={stock} 
                        trefilaProduction={trefilaProduction} 
                        trelicaProduction={trelicaProduction} 
                        setPage={setPage} 
                    />
                ) : (
                    <ReportsTrefila 
                        setPage={setPage} 
                    />
                )}
            </div>
        </div>
    );
};

export default Reports;
