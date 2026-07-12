import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { ConferenceData, StockGauge, Partner } from '../types';
import { PrinterIcon } from './icons';
import { supabase } from '../supabaseClient';

interface ConferenceReportProps {
  reportData: ConferenceData;
  onClose: () => void;
  gauges: StockGauge[];
  activeBrandingPartner?: Partner | null;
}

const ConferenceReport: React.FC<ConferenceReportProps> = ({ reportData, onClose, gauges, activeBrandingPartner }) => {
  const safeLots = (reportData.lots || []).map(lot => ({
    ...lot,
    labelWeight: Number(lot.labelWeight) || 0,
  }));
  const totalLabelWeight = safeLots.reduce((acc, lot) => acc + lot.labelWeight, 0);

  // Sempre busca o parceiro direto do banco para garantir a logo
  const [resolvedLogoUrl, setResolvedLogoUrl] = useState<string>(activeBrandingPartner?.logoUrl || '');
  const [resolvedCompanyName, setResolvedCompanyName] = useState<string>(activeBrandingPartner?.companyName || '');

  useEffect(() => {
    if (activeBrandingPartner?.logoUrl) {
      setResolvedLogoUrl(activeBrandingPartner.logoUrl);
      setResolvedCompanyName(activeBrandingPartner.companyName || '');
      return;
    }
    // Busca direto do banco como fallback garantido
    supabase.from('partners').select('id, company_name, logo_url, is_active_branding').then(({ data }) => {
      if (data && data.length > 0) {
        const active = data.find((p: any) => p.is_active_branding) || data[0];
        if (active?.logo_url) {
          setResolvedLogoUrl(active.logo_url);
          setResolvedCompanyName(active.company_name || '');
        }
      }
    });
  }, [activeBrandingPartner]);

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999] print-modal-container">
      <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-5xl max-h-[95vh] flex flex-col print-modal-content">
        {/* Header with actions */}
        <div className="flex justify-between items-center mb-4 pb-4 border-b border-[#0F3F5C]/20 no-print">
          <h2 className="text-2xl font-bold text-[#0F3F5C]">Relatório de Entrada de Material</h2>
          <div className="flex gap-3">
            <button
              onClick={() => window.print()}
              className="bg-gradient-to-r from-[#FF8C00] to-[#FFA333] hover:from-[#E67E00] hover:to-[#FF8C00] text-white font-bold py-2 px-4 rounded-lg transition-all shadow-md flex items-center justify-center gap-2"
              title="Imprimir / Salvar PDF"
            >
              <PrinterIcon className="h-5 w-5" />
              <span>Imprimir</span>
            </button>
            <button
              onClick={onClose}
              className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-4 rounded-lg transition"
            >
              Fechar
            </button>
          </div>
        </div>

        {/* Printable Content */}
        <div className="overflow-y-auto print-section bg-white flex flex-col h-full font-sans text-black">
          <div className="p-4 w-full h-full flex flex-col">

            {/* 1. Logo e Título */}
            <div className="flex items-center justify-between mb-6 border-b-2 border-slate-900 pb-4">
              {resolvedLogoUrl ? (
                <img
                  src={resolvedLogoUrl}
                  alt={resolvedCompanyName || 'Logo'}
                  className="h-16 md:h-20 object-contain"
                  style={{ maxHeight: '80px', maxWidth: '200px' }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="h-16 w-40 flex items-center justify-center text-slate-300 text-xs italic">
                  {/* espaço reservado para logo */}
                </div>
              )}
              <h1 className="text-xl md:text-2xl font-bold text-black uppercase text-center flex-1 tracking-wide pl-4">
                CONFERÊNCIA DE MATÉRIA PRIMA
              </h1>
            </div>

            {/* 2. Cabeçalho com Data, NF e Conferência */}
            <div className="flex gap-4 mb-6">
              <div className="flex-1 border-2 border-slate-900 px-2 py-1">
                <span className="font-bold text-[10px] text-black block">Data:</span>
                <span className="font-bold text-black text-lg text-center block w-full">
                  {new Date(reportData.entryDate).toLocaleDateString('pt-BR')}
                </span>
              </div>
              <div className="flex-1 border-2 border-slate-900 px-2 py-1">
                <span className="font-bold text-[10px] text-black block">Numero da NF:</span>
                <span className="font-bold text-black text-lg text-center block w-full">
                  {reportData.nfe}
                </span>
              </div>
              <div className="flex-1 border-2 border-slate-900 px-2 py-1">
                <span className="font-bold text-[10px] text-black uppercase block">NUMERO DA CONFERÊNCIA</span>
                <span className="font-bold text-black text-lg text-center block w-full">
                  {reportData.conferenceNumber}
                </span>
              </div>
            </div>

            {/* 3. Tabela de Lotes */}
            <div className="flex-grow">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="text-sm text-black uppercase font-black border-y-2 border-slate-900">
                  <tr>
                    <th className="px-2 py-2 text-center border-l border-r border-slate-400 w-12">Qnt.</th>
                    <th className="px-2 py-2 text-center border-r border-slate-400">Lote fornecedor</th>
                    <th className="px-2 py-2 text-center border-r border-slate-400">Lote interno</th>
                    <th className="px-2 py-2 text-center border-r border-slate-400 w-24">Bitola(mm)</th>
                    <th className="px-2 py-2 text-center border-r border-slate-400">FORNECEDOR</th>
                    <th className="px-2 py-2 text-center border-r border-slate-400">Corrida</th>
                    <th className="px-2 py-2 text-center border-r border-slate-400 w-32">Peso Liquido (Kg)</th>
                  </tr>
                </thead>
                <tbody className="text-black border-b-2 border-slate-900">
                  {safeLots.map((lot, index) => {
                    const displaySupplier = lot.supplier || reportData.supplier;
                    return (
                      <tr key={index} className="border-b border-slate-300">
                        <td className="px-2 py-2 text-center border-l border-r border-slate-400 font-bold text-base">{index + 1}</td>
                        <td className="px-2 py-2 text-center border-r border-slate-400 font-mono font-bold text-base">{lot.supplierLot}</td>
                        <td className="px-2 py-2 text-center border-r border-slate-400 font-black text-lg text-[#0F3F5C]">{lot.internalLot}</td>
                        <td className="px-2 py-2 text-center border-r border-slate-400">
                          <div className="flex flex-col items-center">
                            <span className="font-black text-lg">{lot.bitola}</span>
                            {(() => {
                              const gauge = gauges.find(g => g.materialType === lot.materialType && g.gauge === lot.bitola);
                              return gauge?.productCode ? <span className="text-[9px] font-black uppercase text-slate-500">{gauge.productCode}</span> : null;
                            })()}
                          </div>
                        </td>
                        <td className="px-2 py-2 text-center border-r border-slate-400 uppercase truncate max-w-[120px] font-bold text-sm" title={displaySupplier}>{displaySupplier}</td>
                        <td className="px-2 py-2 text-center border-r border-slate-400 font-mono font-bold text-base">{lot.runNumber}</td>
                        <td className="px-2 py-2 text-center border-r border-slate-400 font-bold text-lg">{lot.labelWeight.toFixed(0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="font-bold text-black">
                  <tr>
                    <td colSpan={9} className="h-4"></td>
                  </tr>
                  <tr className="text-base">
                    <td colSpan={6} className="px-2 py-2 text-right uppercase font-black text-sm">Total Geral:</td>
                    <td className="px-2 py-2 text-center font-black text-xl">{totalLabelWeight.toFixed(0)} KG</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* 4. Assinaturas e Rodapé */}
            <div className="mt-8">
              <div className="mb-4">
                <span className="font-bold text-xs uppercase text-slate-700 block mb-6">CONFERENTE:</span>
                <div className="border-b-2 border-slate-900 w-full mb-1"></div>
              </div>
              <div className="mb-8">
                <span className="font-bold text-xs uppercase text-slate-700 block mb-6">ENCARREGADO:</span>
                <div className="border-b-2 border-slate-900 w-full mb-1"></div>
              </div>
              <div className="text-center pt-8">
                <p className="text-xs text-slate-500 font-medium">Sistema de Gestões inteligente MSM</p>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>,
    document.body
  );
};

export default ConferenceReport;
