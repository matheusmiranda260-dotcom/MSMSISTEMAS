import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseService';
import { CommercialOrder } from '../types';

interface RomaneioDistributionModalProps {
    isOpen: boolean;
    onClose: () => void;
    order: CommercialOrder | null;
    onDistributionComplete: () => void;
}

export const RomaneioDistributionModal: React.FC<RomaneioDistributionModalProps> = ({
    isOpen,
    onClose,
    order,
    onDistributionComplete
}) => {
    const [file, setFile] = useState<File | null>(null);
    const [isExtracting, setIsExtracting] = useState(false);
    const [extractedBitola, setExtractedBitola] = useState('');
    const [extractedOSs, setExtractedOSs] = useState<string[]>([]);
    const [selectedMachine, setSelectedMachine] = useState('');
    const [machines, setMachines] = useState<{ id: string, name: string }[]>([]);
    const [alreadyProgrammedOs, setAlreadyProgrammedOs] = useState<number>(0);
    const [isSaving, setIsSaving] = useState(false);
    const [localTotalOs, setLocalTotalOs] = useState<number>(0);

    useEffect(() => {
        if (isOpen && order) {
            fetchMachines();
            fetchProgrammedCount();
            setFile(null);
            setExtractedBitola('');
            setExtractedOSs([]);
            setSelectedMachine('');
            setLocalTotalOs(order.totalOsQuantity || 0);
        }
    }, [isOpen, order]);

    const fetchMachines = async () => {
        const { data, error } = await supabase.from('machines').select('id, name').order('name');
        if (!error && data) {
            setMachines(data);
        }
    };

    const fetchProgrammedCount = async () => {
        if (!order?.orderNumber) return;
        const { data, error } = await supabase
            .from('machine_orders')
            .select('quantity')
            .eq('order_code', order.orderNumber);
        
        if (!error && data) {
            const count = data.reduce((acc, curr) => acc + (curr.quantity || 0), 0);
            setAlreadyProgrammedOs(count);
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            await extractDataFromPdf(e.target.files[0]);
        }
    };

    const loadPdfJs = async () => {
        if ((window as any).pdfjsLib) return (window as any).pdfjsLib;
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
            script.onload = () => {
                const lib = (window as any).pdfjsLib;
                lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
                resolve(lib);
            };
            script.onerror = reject;
            document.body.appendChild(script);
        });
    };

    const extractDataFromPdf = async (pdfFile: File) => {
        setIsExtracting(true);
        try {
            const arrayBuffer = await pdfFile.arrayBuffer();
            const pdfjsLib: any = await loadPdfJs();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            
            let fullText = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                const pageText = content.items.map((item: any) => item.str).join(' ');
                fullText += pageText + ' ';
            }

            // Achar bitola - formato esperado: "Bitola: 8,00 mm CA50"
            const bitolaMatch = fullText.match(/Bitola:\s*([\d,]+)\s*mm/i);
            if (bitolaMatch) {
                setExtractedBitola(bitolaMatch[1] + ' mm');
            } else {
                setExtractedBitola('Desconhecida');
            }

            // Como as OSs estão num formato de grid, a extração de texto vai gerar uma sequência de números
            // Vamos procurar o cabeçalho e tentar ler os números entre o cabeçalho e a tabela final
            
            // Heurística de extração baseada no formato do PDF (bingo)
            // Normalmente os itens da tabela de OS são números curtos (ex: 127, 130, 261...)
            // Vamos limpar o texto e pegar tokens que se pareçam com OS
            // Isso requer uma lógica refinada, mas podemos identificar blocos de números de 1 a 5 dígitos
            
            const startStr = "Relação de OS's";
            const endStr = "BITOLA"; // cabeçalho da tabela de rodapé
            
            let osList: string[] = [];
            
            if (fullText.includes(startStr) && fullText.includes(endStr)) {
                const section = fullText.substring(fullText.indexOf(startStr), fullText.indexOf(endStr));
                const words = section.split(/\s+/);
                
                for (const word of words) {
                    // Se for apenas número
                    if (/^\d{1,5}$/.test(word)) {
                        osList.push(word);
                    }
                }
            }
            
            setExtractedOSs(osList);

        } catch (error) {
            console.error('Erro na extração', error);
            alert('Falha ao ler o PDF do Romaneio.');
        } finally {
            setIsExtracting(false);
        }
    };

    const handleSave = async () => {
        if (!selectedMachine) {
            alert('Selecione uma máquina primeiro!');
            return;
        }
        if (extractedOSs.length === 0) {
            alert('Nenhuma OS encontrada no PDF.');
            return;
        }
        if (!order) return;

        setIsSaving(true);
        try {
            // Inserir registro no machine_orders
            // Como esse PDF representa um lote para a máquina, podemos inserir 1 registro de `machine_order` com a quantidade total de OSs daquele PDF
            
            const selectedMachineObj = machines.find(m => m.id === selectedMachine);
            
            const newMachineOrder = {
                id: crypto.randomUUID(),
                client_name: order.clientName,
                machine_id: selectedMachine,
                gauge: extractedBitola,
                quantity: extractedOSs.length, // Cada OS conta como 1 unidade? O Romaneio abate OSs.
                quantity_unit: 'OS',
                start_date: new Date().toISOString().split('T')[0],
                end_date: order.deliveryTime || new Date().toISOString().split('T')[0],
                status: 'scheduled',
                notes: `Romaneio da Bitola ${extractedBitola}. OSs: ${extractedOSs.length}`,
                created_at: new Date().toISOString(),
                order_code: order.orderNumber,
                os_quantity: extractedOSs.length
            };

            const { error } = await supabase.from('machine_orders').insert([newMachineOrder]);
            
            if (error) throw error;
            
            // Se o total de OS era 0 e o usuário informou agora, vamos atualizar o pedido
            if ((!order.totalOsQuantity || order.totalOsQuantity === 0) && localTotalOs > 0) {
                await supabase.from('commercial_orders').update({ total_os_quantity: localTotalOs }).eq('id', order.id);
            }
            
            alert('Romaneio programado com sucesso!');
            onDistributionComplete();
            onClose();
        } catch (error) {
            console.error('Erro ao salvar no BD:', error);
            alert('Erro ao distribuir OSs.');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen || !order) return null;

    const totalOs = localTotalOs || 0;
    const balance = totalOs - alreadyProgrammedOs;
    const newBalance = balance - extractedOSs.length;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div>
                        <h2 className="text-xl font-black text-slate-800">Distribuir Romaneio de Produção</h2>
                        <p className="text-sm font-semibold text-slate-500 mt-1">Pedido {order.orderNumber} - {order.clientName}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-xl transition-colors">
                        <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    {/* Progression bar */}
                    <div className="bg-sky-50 p-4 rounded-2xl border border-sky-100">
                        <div className="flex justify-between items-end mb-2">
                            <div>
                                <p className="text-xs font-bold text-sky-600 uppercase">Saldo do Pedido</p>
                                <p className="text-xl font-black text-slate-800">{balance} OSs Restantes</p>
                            </div>
                            {(!order.totalOsQuantity || order.totalOsQuantity === 0) ? (
                                <div className="text-right">
                                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Definir Total de OS</label>
                                    <input 
                                        type="number" 
                                        value={localTotalOs || ''} 
                                        onChange={(e) => setLocalTotalOs(parseInt(e.target.value) || 0)}
                                        className="w-24 px-2 py-1 text-sm font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-sky-500 text-right"
                                        placeholder="Ex: 290"
                                    />
                                </div>
                            ) : (
                                <p className="text-sm font-bold text-slate-500">Total: {totalOs}</p>
                            )}
                        </div>
                        <div className="w-full bg-sky-200 rounded-full h-3 overflow-hidden">
                            <div 
                                className="bg-sky-500 h-3 transition-all duration-500" 
                                style={{ width: `${totalOs > 0 ? (alreadyProgrammedOs / totalOs) * 100 : 0}%` }}
                            ></div>
                        </div>
                    </div>

                    <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center hover:bg-slate-50 transition-colors">
                        <input 
                            type="file" 
                            accept=".pdf" 
                            id="romaneio-upload" 
                            className="hidden" 
                            onChange={handleFileChange} 
                        />
                        <label htmlFor="romaneio-upload" className="cursor-pointer flex flex-col items-center justify-center">
                            <svg className="w-12 h-12 text-slate-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            <span className="font-bold text-sky-600">Selecione o PDF do Romaneio da Bitola</span>
                            <span className="text-xs text-slate-500 mt-1">O sistema lerá as OSs automaticamente</span>
                        </label>
                    </div>

                    {isExtracting && (
                        <div className="text-center p-4">
                            <p className="text-sm font-bold text-slate-600 animate-pulse">Analisando o PDF...</p>
                        </div>
                    )}

                    {extractedOSs.length > 0 && !isExtracting && (
                        <div className="bg-green-50 border border-green-100 rounded-2xl p-5 space-y-4">
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="text-xs font-bold text-green-600 uppercase">Dados Extraídos</p>
                                    <p className="text-lg font-black text-slate-800">Bitola {extractedBitola}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-bold text-slate-500 uppercase">Quantidade</p>
                                    <p className="text-lg font-black text-green-600">{extractedOSs.length} OSs</p>
                                </div>
                            </div>
                            
                            {newBalance < 0 && (
                                <div className="bg-red-100 text-red-600 p-2 rounded-lg text-xs font-bold text-center">
                                    Aviso: A quantidade importada supera o saldo restante do pedido!
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-black text-slate-700 uppercase mb-2">Enviar para qual Máquina?</label>
                                <select 
                                    value={selectedMachine}
                                    onChange={(e) => setSelectedMachine(e.target.value)}
                                    className="w-full bg-white border border-slate-300 rounded-xl p-3 text-sm font-bold text-slate-800 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                                >
                                    <option value="">Selecione uma máquina...</option>
                                    {machines.map(m => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-6 py-3 bg-white text-slate-700 font-bold text-sm rounded-xl hover:bg-slate-50 transition-colors border border-slate-200">
                        Cancelar
                    </button>
                    <button 
                        onClick={handleSave} 
                        disabled={isSaving || extractedOSs.length === 0 || !selectedMachine}
                        className={`px-6 py-3 font-bold text-sm rounded-xl transition-colors shadow-md ${
                            isSaving || extractedOSs.length === 0 || !selectedMachine 
                                ? 'bg-slate-300 text-slate-500 cursor-not-allowed' 
                                : 'bg-sky-500 text-white hover:bg-sky-600 hover:shadow-lg'
                        }`}
                    >
                        {isSaving ? 'Salvando...' : 'Programar Romaneio'}
                    </button>
                </div>
            </div>
        </div>
    );
};
