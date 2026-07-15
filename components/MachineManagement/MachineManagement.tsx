import React, { useState, useEffect } from 'react';
import MachineDashboard from './MachineDashboard';

interface MachineManagementProps {
    activeBrandingPartner: any;
}

const MachineManagement: React.FC<MachineManagementProps> = ({ activeBrandingPartner }) => {
    const [selectedMachine, setSelectedMachine] = useState<string | null>(null);

    const machines = activeBrandingPartner?.machines || [];

    useEffect(() => {
        // Seleciona a primeira máquina por padrão se não houver nenhuma selecionada e a lista existir
        if (!selectedMachine && machines.length > 0) {
            setSelectedMachine(machines[0].name);
        }
    }, [machines, selectedMachine]);

    return (
        <div className="flex h-full bg-slate-50 relative animate-in fade-in duration-300">
            {/* Sidebar de Máquinas */}
            <div className="w-64 bg-white border-r border-slate-200 flex flex-col shadow-sm z-20">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                    <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-sky-600">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.036 18.036 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014-8.81c-2.24 2.133-5.27 3.24-8.38 3.24" />
                        </svg>
                        Máquinas
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">Selecione uma máquina para ver o painel completo</p>
                </div>
                
                <div className="flex-1 overflow-y-auto p-2">
                    {machines.length === 0 ? (
                        <div className="text-center p-4 text-sm text-slate-500">
                            Nenhuma máquina cadastrada.
                        </div>
                    ) : (
                        <ul className="space-y-1">
                            {machines.map((m: any, idx: number) => (
                                <li key={idx}>
                                    <button
                                        onClick={() => setSelectedMachine(m.name)}
                                        className={`w-full text-left px-4 py-3 rounded-xl transition-all font-medium text-sm flex items-center gap-3 ${
                                            selectedMachine === m.name
                                                ? 'bg-sky-50 text-sky-700 font-bold border border-sky-100 shadow-sm'
                                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                                        }`}
                                    >
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                            selectedMachine === m.name ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-400'
                                        }`}>
                                            {m.name.charAt(0)}
                                        </div>
                                        <span className="truncate">{m.name}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            {/* Painel da Máquina Selecionada */}
            <div className="flex-1 flex flex-col min-w-0">
                {selectedMachine ? (
                    <MachineDashboard 
                        machineName={selectedMachine} 
                        activeBrandingPartner={activeBrandingPartner} 
                    />
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-24 h-24 mb-4 text-slate-200">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.036 18.036 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014-8.81c-2.24 2.133-5.27 3.24-8.38 3.24" />
                        </svg>
                        <p className="text-lg font-medium">Selecione uma máquina ao lado para visualizar o painel.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MachineManagement;
