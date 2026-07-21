import React from 'react';
import type { StockItem } from '../types';
import { CheckCircleIcon } from './icons';

interface LotHistoryModalProps {
  lot: StockItem;
  onClose: () => void;
}

const LotHistoryModal: React.FC<LotHistoryModalProps> = ({ lot, onClose }) => {
  const sortedHistory = Array.isArray(lot.history) 
    ? [...lot.history].sort((a, b) => {
        const dateA = a && typeof a === 'object' && a.date ? new Date(a.date).getTime() : 0;
        const dateB = b && typeof b === 'object' && b.date ? new Date(b.date).getTime() : 0;
        return (isNaN(dateA) ? 0 : dateA) - (isNaN(dateB) ? 0 : dateB);
      }) 
    : [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center border-b pb-4 mb-6">
          <h2 className="text-2xl font-bold text-slate-800">Histórico do Lote: {lot.internalLot}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800 text-3xl">&times;</button>
        </div>
        
        <div className="flex-grow overflow-y-auto pr-4 -ml-4 pl-4">
            {sortedHistory.length > 0 ? (
                <div className="relative">
                    {/* The timeline line */}
                    <div className="absolute top-1 left-2.5 h-full w-0.5 bg-slate-200"></div>
                    
                    {sortedHistory.map((event, index) => {
                        const isObject = event && typeof event === 'object';
                        const dateStr = isObject && event.date ? new Date(event.date) : null;
                        const dateFormatted = dateStr && !isNaN(dateStr.getTime()) ? dateStr.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Data desconhecida';
                        const typeStr = isObject ? event.type || 'Atualização' : 'Registro';
                        const detailsObj = isObject ? event.details : event;

                        return (
                            <div key={index} className="relative pl-8 pb-8">
                                {/* The timeline circle */}
                                <div className={`absolute -left-3 top-1 h-5 w-5 bg-slate-600 rounded-full flex items-center justify-center ring-4 ring-white`}>
                                    <CheckCircleIcon className="h-3 w-3 text-white" />
                                </div>
                                <p className="text-sm text-slate-500">{dateFormatted}</p>
                                <h4 className="font-semibold text-slate-800">{typeStr}</h4>
                                <div className="mt-2 p-3 bg-slate-50 rounded-md border text-sm text-slate-600">
                                    {detailsObj && typeof detailsObj === 'object' ? (
                                        Object.entries(detailsObj).map(([key, value]) => (
                                            <p key={key}><strong className="font-medium text-slate-700">{key}:</strong> {String(value)}</p>
                                        ))
                                    ) : (
                                        <p>{String(detailsObj || '')}</p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <p className="text-center text-slate-500 py-10">Nenhum histórico registrado para este lote.</p>
            )}
        </div>

        <div className="flex justify-end pt-4 mt-auto border-t">
          <button type="button" onClick={onClose} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-4 rounded-lg transition">Fechar</button>
        </div>
      </div>
    </div>
  );
};

export default LotHistoryModal;