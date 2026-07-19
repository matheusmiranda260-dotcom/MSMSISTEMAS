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
    const [manuals, setManuals] = useState<any[]>([]);
    const [isUploadingManual, setIsUploadingManual] = useState(false);
    const [newManualTitle, setNewManualTitle] = useState('');
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

            const { data: manualsData } = await supabase
                .from('machine_manuals')
                .select('*')
                .eq('machine_name', machineName)
                .order('created_at', { ascending: false });

            if (manualsData) {
                setManuals(manualsData);
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

    const handleManualUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!newManualTitle.trim()) {
            alert('Por favor, digite o título do manual antes de anexar.');
            return;
        }

        try {
            setIsUploadingManual(true);
            const fileExt = file.name.split('.').pop();
            const fileName = `${machineName}-${Date.now()}.${fileExt}`;
            const filePath = `manuals/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('kb-files')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: publicUrlData } = supabase.storage
                .from('kb-files')
                .getPublicUrl(filePath);

            const payload = {
                machine_name: machineName,
                title: newManualTitle,
                file_url: publicUrlData.publicUrl
            };

            const { error: dbError } = await supabase.from('machine_manuals').insert([payload]);
            if (dbError) throw dbError;

            fetchTechDetails();
            setNewManualTitle('');
            alert('Manual anexado com sucesso!');
        } catch (error: any) {
            console.error('Upload error:', error.message);
            alert('Erro ao fazer upload do arquivo.');
        } finally {
            setIsUploadingManual(false);
        }
    };

    const deleteManual = async (id: string) => {
        if (!window.confirm('Tem certeza que deseja excluir este manual?')) return;
        try {
            const { error } = await supabase.from('machine_manuals').delete().eq('id', id);
            if (error) throw error;
            fetchTechDetails();
        } catch (error) {
            console.error('Error deleting manual:', error);
            alert('Erro ao excluir manual.');
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

                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                                    <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                                        <h3 className="text-lg font-bold text-slate-800">Manuais e Documentos Técnicos</h3>
                                    </div>

                                    <div className="flex flex-col md:flex-row gap-4 mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200 items-end">
                                        <div className="flex-1">
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo de Manual (Ex: Elétrico, Operação)</label>
                                            <input value={newManualTitle} onChange={e => setNewManualTitle(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/50 text-slate-700" placeholder="Ex: Diagrama Elétrico" />
                                        </div>
                                        <div>
                                            <label className={`px-6 py-2 flex items-center justify-center gap-2 font-bold rounded-xl cursor-pointer transition-all ${newManualTitle.trim() ? 'bg-sky-600 hover:bg-sky-700 text-white shadow-md' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
                                                {isUploadingManual ? 'Enviando...' : (
                                                    <>
                                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                                                        Anexar PDF
                                                    </>
                                                )}
                                                <input type="file" className="hidden" accept=".pdf,.doc,.docx" disabled={!newManualTitle.trim() || isUploadingManual} onChange={handleManualUpload} />
                                            </label>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        {manuals.length === 0 ? (
                                            <div className="text-center p-6 text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                                                Nenhum manual cadastrado para esta máquina.
                                            </div>
                                        ) : (
                                            manuals.map(manual => (
                                                <div key={manual.id} className="flex justify-between items-center p-4 bg-white border border-slate-200 rounded-xl hover:shadow-sm transition-shadow">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 bg-emerald-50 text-emerald-500 rounded-lg flex items-center justify-center">
                                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>
                                                        </div>
                                                        <div>
                                                            <h4 className="font-bold text-slate-800">{manual.title}</h4>
                                                            <p className="text-xs text-slate-500">Adicionado em {new Date(manual.created_at || '').toLocaleDateString('pt-BR')}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <a href={manual.file_url} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-emerald-100 text-emerald-700 font-bold rounded-lg hover:bg-emerald-200 transition-colors text-sm">
                                                            Abrir
                                                        </a>
                                                        <button onClick={() => deleteManual(manual.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
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
