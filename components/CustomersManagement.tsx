import React, { useState } from 'react';
import { updateItem, deleteItem } from '../services/supabaseService';
import type { Page, Customer } from '../types';
import { SearchIcon, UserGroupIcon, PlusIcon, DocumentTextIcon, LocationIcon, UserIcon, XIcon } from './icons';
import { maskCPF, maskCNPJ, maskRG, maskPhone } from '../utils/masks';

interface CustomersManagementProps {
    setPage: (page: Page) => void;
    customers: Customer[];
}

const CustomersManagement: React.FC<CustomersManagementProps> = ({ setPage, customers }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<Partial<Customer>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDeleteClick = async () => {
        if (!selectedCustomer) return;
        const pwd = window.prompt('Digite a senha de Gestor para EXCLUIR este cliente:');
        if (pwd === '070223') {
            const confirm = window.confirm(`ATENÇÃO! Você está prestes a excluir permanentemente o cliente ${selectedCustomer.name}. Deseja continuar?`);
            if (confirm) {
                setIsDeleting(true);
                try {
                    await deleteItem('customers', selectedCustomer.id);
                    setSelectedCustomer(null);
                } catch (e) {
                    alert('Erro ao excluir cliente.');
                } finally {
                    setIsDeleting(false);
                }
            }
        } else if (pwd !== null) {
            alert('Senha incorreta!');
        }
    };

    const handleEditClick = () => {
        const pwd = window.prompt('Digite a senha de Gestor para editar:');
        if (pwd === '070223') {
            setIsEditing(true);
            setEditForm(selectedCustomer || {});
        } else if (pwd !== null) {
            alert('Senha incorreta!');
        }
    };

    const handleSaveEdit = async () => {
        if (!selectedCustomer) return;
        setIsSaving(true);
        try {
            // Mapeando para snake_case pro supabase
            const dbUpdates: any = {
                name: editForm.name,
                document1: editForm.document1,
                document2: editForm.document2,
                email: editForm.email,
                phone: editForm.phone,
                birth_date: editForm.birthDate,
                address_main: editForm.addressMain,
                address_delivery: editForm.addressDelivery,
                address_billing: editForm.addressBilling,
                additional_info: editForm.additionalInfo,
                trade_name: editForm.tradeName,
            };
            // Remover undefineds
            Object.keys(dbUpdates).forEach(key => dbUpdates[key] === undefined && delete dbUpdates[key]);

            await updateItem('customers', selectedCustomer.id, dbUpdates);
            
            // Realtime vai atualizar a lista principal, atualizamos apenas o modal atual
            setSelectedCustomer({ ...selectedCustomer, ...editForm });
            setIsEditing(false);
        } catch (error) {
            alert('Erro ao salvar edições.');
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    const filteredCustomers = customers.filter(c => {
        const term = searchTerm.toLowerCase();
        return (
            (c.name || '').toLowerCase().includes(term) ||
            (c.code || '').toLowerCase().includes(term) ||
            (c.document1 && c.document1.toLowerCase().includes(term))
        );
    });

    return (
        <div className="flex flex-col h-screen bg-[#0A2A3D] text-slate-200">
            {/* Header */}
            <div className="bg-[#0D3B54] border-b border-white/10 p-6 shadow-md flex items-center justify-between sticky top-0 z-20">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00E5FF]/20 to-blue-500/20 flex items-center justify-center border border-[#00E5FF]/30">
                        <UserGroupIcon className="w-6 h-6 text-[#00E5FF]" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-white tracking-wider uppercase drop-shadow-sm flex items-center gap-3">
                            Gestão de Clientes
                        </h1>
                        <p className="text-sm text-slate-400 font-medium mt-1">
                            {customers.length} cliente{customers.length !== 1 ? 's' : ''} cadastrado{customers.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Buscar cliente..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-[#0A2A3D]/50 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white font-medium focus:outline-none focus:border-[#00E5FF] transition-colors w-64"
                        />
                        <SearchIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    </div>

                    <button
                        onClick={() => setPage('customerRegistration')}
                        className="bg-[#00E5FF] text-[#0A2A3D] hover:bg-[#00B4CC] px-5 py-2.5 rounded-xl font-bold text-sm tracking-wide transition-all shadow-lg shadow-[#00E5FF]/20 flex items-center gap-2"
                    >
                        <PlusIcon className="w-5 h-5" />
                        Novo Cliente
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                <div className="max-w-6xl mx-auto space-y-4">
                    {filteredCustomers.length === 0 ? (
                        <div className="text-center py-20">
                            <UserGroupIcon className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-white mb-2">Nenhum cliente encontrado</h3>
                            <p className="text-slate-400">Tente buscar com outros termos ou cadastre um novo cliente.</p>
                        </div>
                    ) : (
                        filteredCustomers.map(customer => (
                            <div 
                                key={customer.id} 
                                className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-all cursor-pointer shadow-md group"
                                onClick={() => setSelectedCustomer(customer)}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg ${
                                            customer.customerType === 'Pessoa Física' 
                                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                            : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                                        }`}>
                                            {customer.customerType === 'Pessoa Física' ? 'PF' : 'PJ'}
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-white group-hover:text-[#00E5FF] transition-colors">
                                                {customer.name}
                                            </h3>
                                            <div className="flex items-center gap-3 mt-1 text-xs font-medium text-slate-400 uppercase tracking-wider">
                                                <span className="bg-black/20 px-2 py-0.5 rounded text-slate-300 border border-white/5">
                                                    {customer.code}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <DocumentTextIcon className="w-3.5 h-3.5" />
                                                    {customer.document1}
                                                </span>
                                                {customer.phone && (
                                                    <span className="flex items-center gap-1">
                                                        <UserIcon className="w-3.5 h-3.5" />
                                                        {customer.phone}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-4">
                                        <div className="text-right text-sm">
                                            <div className="text-slate-400 font-medium">Cadastrado em</div>
                                            <div className="text-white font-bold">
                                                {customer.createdAt ? new Date(customer.createdAt).toLocaleDateString('pt-BR') : '-'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Modal de Detalhes */}
            {selectedCustomer && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-[#0D3B54] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl border border-white/10 animate-slideUp">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <h2 className="text-xl font-black text-white uppercase tracking-wider flex items-center gap-3">
                                <DocumentTextIcon className="w-6 h-6 text-[#00E5FF]" />
                                {isEditing ? 'Editar Cliente' : 'Detalhes do Cliente'}
                            </h2>
                            <button onClick={() => { setSelectedCustomer(null); setIsEditing(false); }} className="text-slate-400 hover:text-white transition-colors">
                                <XIcon className="w-6 h-6" />
                            </button>
                        </div>
                        
                        <div className="p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <div className="text-xs font-black text-slate-500 uppercase tracking-wider mb-1">Nome / Razão Social</div>
                                    {isEditing ? (
                                        <input type="text" autoComplete="new-password" className="w-full bg-[#0A2A3D]/50 border border-white/10 rounded-lg px-3 py-1.5 text-white focus:border-[#00E5FF] outline-none" value={editForm.name || ''} onChange={e => setEditForm({...editForm, name: e.target.value})} />
                                    ) : (
                                        <div className="text-lg font-bold text-white">{selectedCustomer.name}</div>
                                    )}
                                </div>
                                <div>
                                    <div className="text-xs font-black text-slate-500 uppercase tracking-wider mb-1">Código</div>
                                    <div className="text-lg font-bold text-[#00E5FF]">{selectedCustomer.code} <span className="text-xs text-slate-500 font-normal ml-2">(Não editável)</span></div>
                                </div>
                                {selectedCustomer.customerType === 'Pessoa Jurídica' && (
                                    <div>
                                        <div className="text-xs font-black text-slate-500 uppercase tracking-wider mb-1">Nome Fantasia</div>
                                        {isEditing ? (
                                            <input type="text" className="w-full bg-[#0A2A3D]/50 border border-white/10 rounded-lg px-3 py-1.5 text-white focus:border-[#00E5FF] outline-none" value={editForm.tradeName || ''} onChange={e => setEditForm({...editForm, tradeName: e.target.value})} />
                                        ) : (
                                            <div className="text-base font-bold text-slate-300">{selectedCustomer.tradeName || '-'}</div>
                                        )}
                                    </div>
                                )}
                                <div>
                                    <div className="text-xs font-black text-slate-500 uppercase tracking-wider mb-1">Tipo</div>
                                    <div className="text-base font-bold text-slate-300">{selectedCustomer.customerType} <span className="text-xs text-slate-500 font-normal ml-2">(Não editável)</span></div>
                                </div>
                                <div>
                                    <div className="text-xs font-black text-slate-500 uppercase tracking-wider mb-1">{selectedCustomer.customerType === 'Pessoa Física' ? 'CPF' : 'CNPJ'}</div>
                                    {isEditing ? (
                                        <input type="text" autoComplete="new-password" className="w-full bg-[#0A2A3D]/50 border border-white/10 rounded-lg px-3 py-1.5 text-white focus:border-[#00E5FF] outline-none" value={editForm.document1 || ''} onChange={e => setEditForm({...editForm, document1: selectedCustomer.customerType === 'Pessoa Física' ? maskCPF(e.target.value) : maskCNPJ(e.target.value)})} />
                                    ) : (
                                        <div className="text-base font-bold text-slate-300">{selectedCustomer.document1}</div>
                                    )}
                                </div>
                                <div>
                                    <div className="text-xs font-black text-slate-500 uppercase tracking-wider mb-1">{selectedCustomer.customerType === 'Pessoa Física' ? 'RG' : 'Inscrição Estadual'}</div>
                                    {isEditing ? (
                                        <input type="text" autoComplete="new-password" className="w-full bg-[#0A2A3D]/50 border border-white/10 rounded-lg px-3 py-1.5 text-white focus:border-[#00E5FF] outline-none" value={editForm.document2 || ''} onChange={e => setEditForm({...editForm, document2: selectedCustomer.customerType === 'Pessoa Física' ? maskRG(e.target.value) : e.target.value})} />
                                    ) : (
                                        <div className="text-base font-bold text-slate-300">{selectedCustomer.document2 || '-'}</div>
                                    )}
                                </div>
                                {(selectedCustomer.birthDate || isEditing) && selectedCustomer.customerType === 'Pessoa Física' && (
                                    <div>
                                        <div className="text-xs font-black text-slate-500 uppercase tracking-wider mb-1">Data de Nascimento</div>
                                        {isEditing ? (
                                            <input type="date" autoComplete="new-password" className="w-full bg-[#0A2A3D]/50 border border-white/10 rounded-lg px-3 py-1.5 text-white focus:border-[#00E5FF] outline-none" value={editForm.birthDate || ''} onChange={e => setEditForm({...editForm, birthDate: e.target.value})} />
                                        ) : (
                                            <div className="text-base font-bold text-slate-300">{selectedCustomer.birthDate ? new Date(selectedCustomer.birthDate).toLocaleDateString('pt-BR') : '-'}</div>
                                        )}
                                    </div>
                                )}
                                <div>
                                    <div className="text-xs font-black text-slate-500 uppercase tracking-wider mb-1">E-mail</div>
                                    {isEditing ? (
                                        <input type="email" autoComplete="new-password" className="w-full bg-[#0A2A3D]/50 border border-white/10 rounded-lg px-3 py-1.5 text-white focus:border-[#00E5FF] outline-none" value={editForm.email || ''} onChange={e => setEditForm({...editForm, email: e.target.value})} />
                                    ) : (
                                        <div className="text-base font-bold text-slate-300">{selectedCustomer.email || '-'}</div>
                                    )}
                                </div>
                                <div>
                                    <div className="text-xs font-black text-slate-500 uppercase tracking-wider mb-1">Telefone</div>
                                    {isEditing ? (
                                        <input type="tel" autoComplete="new-password" className="w-full bg-[#0A2A3D]/50 border border-white/10 rounded-lg px-3 py-1.5 text-white focus:border-[#00E5FF] outline-none" value={editForm.phone || ''} onChange={e => setEditForm({...editForm, phone: maskPhone(e.target.value)})} />
                                    ) : (
                                        <div className="text-base font-bold text-slate-300">{selectedCustomer.phone || '-'}</div>
                                    )}
                                </div>
                            </div>
                            
                            <hr className="border-white/10" />
                            
                            <div className="space-y-4">
                                {(selectedCustomer.addressMain || isEditing) && (
                                    <div>
                                        <div className="text-xs font-black text-slate-500 uppercase tracking-wider mb-1">
                                            {selectedCustomer.customerType === 'Pessoa Física' ? 'Endereço Residencial' : 'Localização'}
                                        </div>
                                        {isEditing ? (
                                            <input type="text" autoComplete="new-password" className="w-full bg-[#0A2A3D]/50 border border-white/10 rounded-lg px-3 py-1.5 text-white focus:border-[#00E5FF] outline-none" value={editForm.addressMain || ''} onChange={e => setEditForm({...editForm, addressMain: e.target.value})} />
                                        ) : (
                                            <div className="text-sm font-medium text-slate-300 bg-white/5 p-3 rounded-xl border border-white/5">{selectedCustomer.addressMain}</div>
                                        )}
                                    </div>
                                )}
                                {(selectedCustomer.addressDelivery || selectedCustomer.addressBilling || isEditing) && (
                                    <div>
                                        <div className="text-xs font-black text-slate-500 uppercase tracking-wider mb-1">
                                            {selectedCustomer.customerType === 'Pessoa Física' ? 'Endereço de Entrega' : 'Endereço de Correspondência'}
                                        </div>
                                        {isEditing ? (
                                            <input 
                                                type="text" 
                                                autoComplete="off" 
                                                className="w-full bg-[#0A2A3D]/50 border border-white/10 rounded-lg px-3 py-1.5 text-white focus:border-[#00E5FF] outline-none" 
                                                value={selectedCustomer.customerType === 'Pessoa Física' ? (editForm.addressDelivery || '') : (editForm.addressBilling || '')} 
                                                onChange={e => {
                                                    if (selectedCustomer.customerType === 'Pessoa Física') {
                                                        setEditForm({...editForm, addressDelivery: e.target.value});
                                                    } else {
                                                        setEditForm({...editForm, addressBilling: e.target.value});
                                                    }
                                                }} 
                                            />
                                        ) : (
                                            <div className="text-sm font-medium text-slate-300 bg-white/5 p-3 rounded-xl border border-white/5">
                                                {selectedCustomer.customerType === 'Pessoa Física' ? selectedCustomer.addressDelivery : selectedCustomer.addressBilling}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-6 border-t border-white/10 bg-black/20 flex justify-end gap-3">
                            {isEditing ? (
                                <>
                                    <button onClick={() => setIsEditing(false)} className="px-6 py-2.5 rounded-xl font-bold bg-white/10 hover:bg-white/20 text-white transition-colors">
                                        Cancelar
                                    </button>
                                    <button onClick={handleSaveEdit} disabled={isSaving} className="px-6 py-2.5 rounded-xl font-bold bg-[#00E5FF] hover:bg-[#00B4CC] text-[#0A2A3D] transition-colors disabled:opacity-50">
                                        {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button onClick={handleDeleteClick} disabled={isDeleting} className="px-6 py-2.5 rounded-xl font-bold bg-red-500/20 hover:bg-red-500/40 text-red-400 transition-colors mr-auto border border-red-500/30 hover:border-red-500/60 disabled:opacity-50">
                                        {isDeleting ? 'Excluindo...' : 'Excluir'}
                                    </button>
                                    <button onClick={handleEditClick} className="px-6 py-2.5 rounded-xl font-bold bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors border border-amber-500/30">
                                        Editar
                                    </button>
                                    <button onClick={() => setSelectedCustomer(null)} className="px-6 py-2.5 rounded-xl font-bold bg-white/10 hover:bg-white/20 text-white transition-colors">
                                        Fechar
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomersManagement;
