import React, { useState } from 'react';
import SparePartsManager from '../SparePartsManager';
import MaintenanceManager from './MaintenanceManager';
import PurchaseOrdersManager from './PurchaseOrdersManager';

interface MachineManagementProps {
    activeBrandingPartner: any;
}

const MachineManagement: React.FC<MachineManagementProps> = ({ activeBrandingPartner }) => {
    const [activeTab, setActiveTab] = useState<'maintenance' | 'parts' | 'purchases'>('maintenance');

    return (
        <div className="flex flex-col h-full bg-slate-50 relative animate-in fade-in duration-300">
            {/* Header */}
            <header className="bg-white px-6 py-4 border-b border-slate-200 sticky top-0 z-20 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8 text-sky-600">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.036 18.036 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014-8.81c-2.24 2.133-5.27 3.24-8.38 3.24" />
                        </svg>
                        Gestão de Máquinas
                    </h1>
                    <p className="text-slate-500 font-medium text-sm mt-1">
                        Gerencie manutenções, estoque de peças de reposição e ordens de compra.
                    </p>
                </div>
                
                {/* Tabs */}
                <div className="flex bg-slate-100 p-1.5 rounded-xl shadow-inner border border-slate-200">
                    <button
                        onClick={() => setActiveTab('maintenance')}
                        className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                            activeTab === 'maintenance'
                                ? 'bg-white text-sky-600 shadow-sm border border-slate-200/50'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                        }`}
                    >
                        Manutenções
                    </button>
                    <button
                        onClick={() => setActiveTab('parts')}
                        className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                            activeTab === 'parts'
                                ? 'bg-white text-sky-600 shadow-sm border border-slate-200/50'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                        }`}
                    >
                        Peças de Reposição
                    </button>
                    <button
                        onClick={() => setActiveTab('purchases')}
                        className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                            activeTab === 'purchases'
                                ? 'bg-white text-sky-600 shadow-sm border border-slate-200/50'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                        }`}
                    >
                        Ordens de Compra
                    </button>
                </div>
            </header>

            {/* Content Area */}
            <main className="flex-1 overflow-y-auto bg-slate-50/50">
                {activeTab === 'maintenance' && <MaintenanceManager activeBrandingPartner={activeBrandingPartner} />}
                {activeTab === 'parts' && <SparePartsManager />}
                {activeTab === 'purchases' && <PurchaseOrdersManager activeBrandingPartner={activeBrandingPartner} />}
            </main>
        </div>
    );
};

export default MachineManagement;
