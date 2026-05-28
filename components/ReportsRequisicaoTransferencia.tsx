import React, { useState, useRef } from 'react';
import type { Page } from '../types';

interface ReportsProps {
    setPage: (page: Page) => void;
}

const ReportsRequisicaoTransferencia: React.FC<ReportsProps> = ({ setPage }) => {
    const dateInputRef = useRef<HTMLInputElement>(null);

    // Get today's date in YYYY-MM-DD for the date picker
    const today = new Date();
    const [selectedDate, setSelectedDate] = useState(today.toISOString().split('T')[0]);

    // Form states
    const [material, setMaterial] = useState('');
    const [quantidade, setQuantidade] = useState('');
    const [peso, setPeso] = useState('');
    const [setorEntrada, setSetorEntrada] = useState('');
    const [responsavelLaminacao, setResponsavelLaminacao] = useState('');
    const [responsavelEntrada, setResponsavelEntrada] = useState('');
    const [assinaturaDate, setAssinaturaDate] = useState('');

    // Format date for display: DD/MM/YY
    const formatDateBr = (isoString: string) => {
        if (!isoString) return '';
        const [year, month, day] = isoString.split('-');
        return `${day}/${month}/${year.slice(2)}`;
    };

    const formattedDate = formatDateBr(selectedDate);

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="flex-1 bg-slate-100 p-4 md:p-8 overflow-y-auto no-print-bg print-container">
            {/* Controles de Relatório (Apenas Tela) */}
            <section className="bg-white p-4 rounded border border-slate-200 shadow-sm mb-4 flex flex-col sm:flex-row items-center justify-between gap-4 no-print">
                <div>
                    <span className="text-xs font-bold text-slate-500 uppercase">Configurações de Relatório</span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handlePrint} className="bg-[#002060] text-white px-4 py-2 rounded font-bold shadow hover:bg-blue-800 transition-colors uppercase text-xs">
                        Imprimir Ficha
                    </button>
                </div>
            </section>

            {/* Fichas de Requisição (2 cópias por folha) */}
            <div className="max-w-[1240px] mx-auto flex flex-col gap-8 print:gap-6 print:block">
            {[1, 2].map((copyIndex) => (
                <div key={copyIndex} className={`bg-white op-sheet-container border-2 border-[#002060] rounded-lg overflow-hidden shadow-lg p-4 relative flex-col justify-start print:break-inside-avoid ${copyIndex > 1 ? 'hidden print:flex print:mt-6' : 'flex'}`}>
                
                {/* CABEÇALHO */}
                <div className="grid grid-cols-12 border border-[#002060] mb-4 h-24">
                    {/* Logo */}
                    <div className="col-span-3 p-2 flex items-center justify-center">
                        <img src="/ita-acos-logo.png" alt="Logo Grupo Ita Aços" className="h-16 md:h-20 object-contain w-full" style={{ maxHeight: '80px' }} />
                    </div>

                    {/* Título */}
                    <div className="col-span-9 p-2 flex flex-col justify-center text-center gap-1">
                        <h2 className="text-xl md:text-2xl font-black uppercase tracking-wider text-[#002060] leading-none">
                            REQUISIÇÃO INTERNA
                        </h2>
                        <h3 className="text-lg md:text-xl font-extrabold uppercase tracking-wider text-[#002060] leading-none mt-1">
                            TRANSFERÊNCIA DE MATERIAL
                        </h3>
                    </div>
                </div>

                {/* TABELA DE PREENCHIMENTO */}
                <div className="border border-[#002060] rounded overflow-hidden relative mb-4">
                    <table className="w-full border-collapse text-left text-[14px] table-fixed">
                        <colgroup>
                            <col style={{ width: '35%' }} />
                            <col style={{ width: '65%' }} />
                        </colgroup>
                        <tbody>
                            <tr className="border-b border-[#002060] bg-slate-50">
                                <td className="p-3 border-r border-[#002060] font-black text-[#002060] uppercase text-center tracking-wider">
                                    Material:
                                </td>
                                <td className="p-3">
                                    <input 
                                        type="text" 
                                        value={material} 
                                        onChange={e => setMaterial(e.target.value)} 
                                        className="op-editable-input print:placeholder-transparent w-full font-black text-center text-[22px] uppercase text-[#002060]" 
                                        placeholder="EX: TRELIÇA H12 PESADA DE 6 METROS" 
                                    />
                                </td>
                            </tr>
                            <tr className="border-b border-[#002060] bg-slate-50">
                                <td className="p-3 border-r border-[#002060] font-black text-[#002060] uppercase text-center tracking-wider">
                                    Quantidade:
                                </td>
                                <td className="p-3">
                                    <input 
                                        type="text" 
                                        value={quantidade} 
                                        onChange={e => setQuantidade(e.target.value)} 
                                        className="op-editable-input print:placeholder-transparent w-full font-black text-center text-[22px] text-[#002060]" 
                                        placeholder="EX: 4734 peças" 
                                    />
                                </td>
                            </tr>
                            <tr className="border-b border-[#002060] bg-slate-50">
                                <td className="p-3 border-r border-[#002060] font-black text-[#002060] uppercase text-center tracking-wider">
                                    Peso:
                                </td>
                                <td className="p-3">
                                    <input 
                                        type="text" 
                                        value={peso} 
                                        onChange={e => setPeso(e.target.value)} 
                                        className="op-editable-input print:placeholder-transparent w-full font-black text-center text-[22px] text-[#002060]" 
                                        placeholder="EX: 24956 kg" 
                                    />
                                </td>
                            </tr>
                            <tr className="border-b border-[#002060] bg-slate-50">
                                <td className="p-3 border-r border-[#002060] font-black text-[#002060] uppercase text-center tracking-wider">
                                    Setor Saída:
                                </td>
                                <td className="p-3 text-center font-black text-[22px] uppercase text-[#002060]">
                                    Laminação e Trefilação
                                </td>
                            </tr>
                            <tr className="border-b border-[#002060] bg-slate-50">
                                <td className="p-3 border-r border-[#002060] font-black text-[#002060] uppercase text-center tracking-wider">
                                    Setor Entrada:
                                </td>
                                <td className="p-3">
                                    <input 
                                        type="text" 
                                        value={setorEntrada} 
                                        onChange={e => setSetorEntrada(e.target.value)} 
                                        className="op-editable-input print:placeholder-transparent w-full font-black text-center text-[22px] uppercase text-[#002060]" 
                                        placeholder="EX: Ca50" 
                                    />
                                </td>
                            </tr>

                            {/* ASSINATURAS */}
                            <tr className="border-b border-[#002060]">
                                <td className="p-3 border-r border-[#002060] bg-slate-50 text-center font-black text-[#002060]">
                                    <div className="uppercase">ASSINATURA RESPONSÁVEL:</div>
                                    <div className="uppercase mt-1">SETOR LAMINAÇÃO E TREFILAÇÃO:</div>
                                </td>
                                <td className="p-3 relative">
                                    <input 
                                        type="text" 
                                        value={responsavelLaminacao} 
                                        onChange={e => setResponsavelLaminacao(e.target.value)} 
                                        className="op-editable-input print:placeholder-transparent w-full h-full text-center font-black text-3xl italic text-[#002060]" 
                                        placeholder="Assinatura..." 
                                    />
                                </td>
                            </tr>
                            <tr className="border-b border-[#002060]">
                                <td className="p-3 border-r border-[#002060] bg-slate-50 text-center font-black text-[#002060]">
                                    <div className="uppercase">ASSINATURA RESPONSÁVEL:</div>
                                    <div className="uppercase mt-1 flex items-center justify-center gap-1">
                                        SETOR <span className="border-b border-black w-24 inline-block"></span>:
                                    </div>
                                </td>
                                <td className="p-3">
                                    <input 
                                        type="text" 
                                        value={responsavelEntrada} 
                                        onChange={e => setResponsavelEntrada(e.target.value)} 
                                        className="op-editable-input print:placeholder-transparent w-full h-12 text-center font-black text-3xl italic text-[#002060]" 
                                        placeholder="Assinatura..." 
                                    />
                                </td>
                            </tr>
                            
                            {/* DATA DA TRANSFERÊNCIA */}
                            <tr>
                                <td className="p-3 border-r border-[#002060] bg-slate-50 text-center font-black text-[#002060]">
                                    <div className="uppercase">DATA DA</div>
                                    <div className="uppercase">TRANSFERÊNCIA DE MATERIAL</div>
                                </td>
                                <td className="p-3 text-center font-black text-3xl text-[#002060] cursor-pointer hover:bg-slate-50 relative"
                                    onClick={() => {
                                        try {
                                            dateInputRef.current?.showPicker();
                                        } catch (err) {
                                            dateInputRef.current?.click();
                                        }
                                    }}
                                >
                                    {formattedDate}
                                    <input 
                                        ref={dateInputRef}
                                        type="date" 
                                        value={selectedDate} 
                                        onChange={e => setSelectedDate(e.target.value)} 
                                        className="absolute w-0 h-0 opacity-0 pointer-events-none" 
                                    />
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                </div>
            ))}
            </div>
        </div>
    );
};

export default ReportsRequisicaoTransferencia;
