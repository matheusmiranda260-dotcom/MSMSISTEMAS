import React, { useState, useMemo } from 'react';
import type { StockGauge, StockItem } from '../types';

interface ProductsCatalogProps {
    gauges: StockGauge[];
    stock: StockItem[];
}

export const ProductsCatalog: React.FC<ProductsCatalogProps> = ({ gauges, stock }) => {
    const [search, setSearch] = useState('');

    const catalogData = useMemo(() => {
        return gauges.map(g => {
            // Calculate available stock for this gauge
            // Based on matching bitola/gauge and materialType
            const relatedStock = stock.filter(s => 
                s.status === 'Disponível' && 
                s.bitola === g.gauge && 
                (s.materialType === g.materialType || !g.materialType)
            );
            
            const totalStockWeight = relatedStock.reduce((acc, item) => acc + (item.remainingQuantity || 0), 0);

            return {
                id: g.id,
                description: g.commercialName || g.technicalDescription || `Bitola ${g.gauge}`,
                code: g.productCode || '-',
                price: g.purchasePrice || 0,
                stockWeight: totalStockWeight,
                gauge: g.gauge,
                material: g.materialType || '-'
            };
        });
    }, [gauges, stock]);

    const filteredCatalog = useMemo(() => {
        if (!search.trim()) return catalogData;
        const term = search.toLowerCase().trim();
        return catalogData.filter(item => 
            item.description.toLowerCase().includes(term) ||
            item.code.toLowerCase().includes(term) ||
            item.gauge.toLowerCase().includes(term) ||
            item.material.toLowerCase().includes(term)
        );
    }, [catalogData, search]);

    return (
        <div className="p-4 md:p-8 space-y-6">
            <div className="flex items-center justify-between no-print">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <span className="text-4xl">🏷️</span>
                        Produtos Cadastrados
                    </h1>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">CATÁLOGO E PREÇOS</p>
                </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
                <div className="flex items-center gap-2.5 max-w-md w-full">
                    <input 
                        type="text" 
                        placeholder="Pesquisar produto, código, bitola ou material..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="flex-grow p-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                </div>
            </div>

            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-800 text-white">
                                <th className="p-4 font-bold text-xs uppercase w-32">Código</th>
                                <th className="p-4 font-bold text-xs uppercase">Descrição do Produto</th>
                                <th className="p-4 font-bold text-xs uppercase w-32">Bitola</th>
                                <th className="p-4 text-center font-bold text-xs uppercase w-40">Preço Base (R$)</th>
                                <th className="p-4 text-center font-bold text-xs uppercase w-48">Estoque Disponível</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredCatalog.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-slate-500 font-medium">
                                        Nenhum produto encontrado.
                                    </td>
                                </tr>
                            ) : (
                                filteredCatalog.map((item, index) => (
                                    <tr key={item.id} className={`${index % 2 === 0 ? 'bg-slate-50/50' : 'bg-white'} border-b hover:bg-slate-100/50 transition-colors`}>
                                        <td className="p-4 font-bold text-slate-500 text-xs uppercase">{item.code}</td>
                                        <td className="p-4">
                                            <span className="font-extrabold text-slate-900 uppercase text-sm">{item.description}</span>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{item.material}</div>
                                        </td>
                                        <td className="p-4 font-bold text-slate-600 text-xs">{item.gauge}</td>
                                        <td className="p-4 text-center font-black text-emerald-600 text-sm">
                                            R$ {item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 })}
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="flex flex-col items-center">
                                                <span className={`font-black text-sm ${item.stockWeight > 0 ? 'text-sky-600' : 'text-slate-400'}`}>
                                                    {item.stockWeight.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KG
                                                </span>
                                                {item.stockWeight <= 0 && (
                                                    <span className="text-[9px] font-bold text-red-500 uppercase tracking-widest mt-0.5">Sem Estoque</span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
