import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import MaintenanceManager from './MaintenanceManager';
import SparePartsManager from '../SparePartsManager';
import PurchaseOrdersManager from './PurchaseOrdersManager';

interface MachineDashboardProps {
    machineName: string;
    activeBrandingPartner: any;
}

const MachineDashboard: React.FC<MachineDashboardProps> = ({ machineName, activeBrandingPartner }) => {
    const [activeTab, setActiveTab] = useState<'info' | 'maintenance' | 'parts' | 'purchases'>('info');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    
    const [techDetails, setTechDetails] = useState<any>(null);
    const [installationDate, setInstallationDate] = useState('');
    const [model, setModel] = useState('');
    const [serialNumber, setSerialNumber] = useState('');
    const [manufacturer, setManufacturer] = useState('');

    useEffect(() => {
        if (machineName) {
            fetchTechDetails();
        }
    }, [machineName]);

    const fetchTechDetails = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('machine_technical_details')
                .select('*')
                .eq('machine_name', machineName)
                .single();

            if (data) {
                setTechDetails(data);
                setInstallationDate(data.installation_date || '');
                setModel(data.model || '');
                setSerialNumber(data.serial_number || '');
                setManufacturer(data.manufacturer || '');
            } else {
                setTechDetails(null);
                setInstallationDate('');
                setModel('');
                setSerialNumber('');
                setManufacturer('');
            }
        } catch (error) {
            console.error('Error fetching technical details:', error);
        } finally {
            setLoading(false);
        }
    };

    const saveTechDetails = async () => {
        setSaving(true);
        try {
            const payload = {
                machine_name: machineName,
                installation_date: installationDate || null,
                model,
                serial_number: serialNumber,
                manufacturer
            };

            if (techDetails?.id) {
                await supabase
                    .from('machine_technical_details')
                    .update(payload)
                    .eq('id', techDetails.id);
            } else {
                await supabase
                    .from('machine_technical_details')
                    .insert([payload]);
            }
            alert('Informações salvas com sucesso!');
            fetchTechDetails();
        } catch (error) {
            console.error('Error saving technical details:', error);
            alert('Erro ao salvar informações técnicas.');
        } finally {
            setSaving(false);
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, field: 'parts_manual_url' | 'instruction_manual_url') => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            setLoading(true);
            const fileExt = file.name.split('.').pop();
            const fileName = `${machineName}-${field}-${Math.random()}.${fileExt}`;
            const filePath = `manuals/${fileName}`;

            // Substitua 'documents' pelo nome correto do seu bucket no Supabase caso seja outro.
            const { error: uploadError } = await supabase.storage
                .from('documents')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: publicUrlData } = supabase.storage
                .from('documents')
                .getPublicUrl(filePath);

            const fileUrl = publicUrlData.publicUrl;

            const payload = {
                machine_name: machineName,
                [field]: fileUrl
            };

            if (techDetails?.id) {
                await supabase.from('machine_technical_details').update(payload).eq('id', techDetails.id);
            } else {
                await supabase.from('machine_technical_details').insert([payload]);
            }

            fetchTechDetails();
            alert('Arquivo anexado com sucesso!');
        } catch (error: any) {
            console.error('Upload error:', error.message);
            alert('Erro ao fazer upload do arquivo.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="bg-white border-b border-slate-200 p-4 shadow-sm z-10 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-sky-100 text-sky-600 rounded-xl flex items-center justify-center font-bold text-xl border border-sky-200">
                        {machineName.charAt(0)}
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-800">{machineName}</h2>
                        <p className="text-sm text-slate-500 font-medium">Painel da Máquina</p>
                    </div>
                </div>

                <div className="flex bg-slate-100 p-1.5 rounded-xl shadow-inner border border-slate-200">
                    <button
                        onClick={() => setActiveTab('info')}
                        className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                            activeTab === 'info' ? 'bg-white text-sky-600 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                        }`}
                    >
                        Informações Gerais
                    </button>
                    <button
                        onClick={() => setActiveTab('maintenance')}
                        className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                            activeTab === 'maintenance' ? 'bg-white text-sky-600 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                        }`}
                    >
                        Manutenções
                    </button>
                    <button
                        onClick={() => setActiveTab('parts')}
                        className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                            activeTab === 'parts' ? 'bg-white text-sky-600 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                        }`}
                    >
                        Peças de Reposição
                    </button>
                    <button
                        onClick={() => setActiveTab('purchases')}
                        className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                            activeTab === 'purchases' ? 'bg-white text-sky-600 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                        }`}
                    >
                        Ordens de Compra
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-50 relative">
                {activeTab === 'info' && (
                    <div className="p-6 max-w-5xl mx-auto space-y-6">
                        {loading && !techDetails ? (
                            <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600"></div></div>
                        ) : (
                            <>
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                                    <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Informações Técnicas</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Modelo</label>
                                            <input value={model} onChange={e => setModel(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/50 text-slate-700" placeholder="Ex: Prima 12" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nº de Série</label>
                                            <input value={serialNumber} onChange={e => setSerialNumber(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/50 text-slate-700" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fabricante</label>
                                            <input value={manufacturer} onChange={e => setManufacturer(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/50 text-slate-700" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data de Instalação</label>
                                            <input type="date" value={installationDate} onChange={e => setInstallationDate(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/50 text-slate-700" />
                                        </div>
                                    </div>
                                    <div className="mt-4 flex justify-end">
                                        <button onClick={saveTechDetails} disabled={saving} className="px-6 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-2">
                                            {saving ? 'Salvando...' : 'Salvar Informações'}
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center">
                                        <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-3">
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>
                                        </div>
                                        <h4 className="font-bold text-slate-800 text-lg">Manual de Instruções</h4>
                                        <p className="text-sm text-slate-500 mb-4">Anexe ou visualize o manual de operação.</p>
                                        
                                        {techDetails?.instruction_manual_url ? (
                                            <div className="flex gap-2">
                                                <a href={techDetails.instruction_manual_url} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-colors">
                                                    Abrir Manual
                                                </a>
                                                <label className="px-4 py-2 border-2 border-dashed border-emerald-300 text-emerald-600 font-bold rounded-lg hover:bg-emerald-50 cursor-pointer transition-colors">
                                                    Substituir
                                                    <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={e => handleFileUpload(e, 'instruction_manual_url')} />
                                                </label>
                                            </div>
                                        ) : (
                                            <label className="px-6 py-2 bg-slate-100 text-slate-600 font-bold rounded-lg hover:bg-slate-200 cursor-pointer transition-colors border border-slate-300">
                                                Anexar PDF
                                                <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={e => handleFileUpload(e, 'instruction_manual_url')} />
                                            </label>
                                        )}
                                    </div>

                                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center">
                                        <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mb-3">
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.036 18.036 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014-8.81c-2.24 2.133-5.27 3.24-8.38 3.24" /></svg>
                                        </div>
                                        <h4 className="font-bold text-slate-800 text-lg">Manual de Peças</h4>
                                        <p className="text-sm text-slate-500 mb-4">Catálogo de peças de reposição e diagramas.</p>
                                        
                                        {techDetails?.parts_manual_url ? (
                                            <div className="flex gap-2">
                                                <a href={techDetails.parts_manual_url} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-amber-500 text-white font-bold rounded-lg hover:bg-amber-600 transition-colors">
                                                    Abrir Manual
                                                </a>
                                                <label className="px-4 py-2 border-2 border-dashed border-amber-300 text-amber-600 font-bold rounded-lg hover:bg-amber-50 cursor-pointer transition-colors">
                                                    Substituir
                                                    <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={e => handleFileUpload(e, 'parts_manual_url')} />
                                                </label>
                                            </div>
                                        ) : (
                                            <label className="px-6 py-2 bg-slate-100 text-slate-600 font-bold rounded-lg hover:bg-slate-200 cursor-pointer transition-colors border border-slate-300">
                                                Anexar PDF
                                                <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={e => handleFileUpload(e, 'parts_manual_url')} />
                                            </label>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}
                
                {/* We pass the machineName down so these components can filter appropriately */}
                {activeTab === 'maintenance' && <MaintenanceManager activeBrandingPartner={activeBrandingPartner} machineFilter={machineName} />}
                {activeTab === 'parts' && <SparePartsManager activeBrandingPartner={activeBrandingPartner} machineFilter={machineName} />}
                {activeTab === 'purchases' && <PurchaseOrdersManager activeBrandingPartner={activeBrandingPartner} machineFilter={machineName} />}
            </div>
        </div>
    );
};

export default MachineDashboard;
