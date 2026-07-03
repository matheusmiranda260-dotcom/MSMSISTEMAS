import React, { useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import type { Page, User, Employee, UserAccessLog } from '../types';
import { ArrowLeftIcon, PencilIcon, TrashIcon, WarningIcon } from './icons';

interface UserManagementProps {
    users: User[];
    employees: Employee[];
    addUser: (data: { username: string; password: string; fullName?: string; phone?: string; email?: string; permissions: Partial<Record<Page, boolean>>; role: string; employeeId?: string; assignedMachines?: string[] }) => void;
    updateUser: (userId: string, data: Partial<User>) => void;
    deleteUser: (userId: string) => void;
    setPage: (page: Page) => void;
    accessLogs: UserAccessLog[];
    currentUser?: User | null;
    activeBrandingPartner?: any;
}

const permissionCategories = [
    {
        title: '📝 Pedidos e Orçamento',
        permissions: [
            { page: 'customerRegistration', label: '✨ Novo Cadastro' },
            { page: 'customersManagement', label: '👥 Gestão de Clientes' },
            { page: 'customerOrders', label: '📝 Gestão de Vendas' },
            { page: 'productsCatalog', label: '📦 Produtos Cadastrados' },
        ]
    },
    {
        title: '⚙️ Produção',
        permissions: [
            { page: 'orderManagement', label: '⚙️ Gestão de Pedidos - Eng' },
            { page: 'productionManagement', label: '🏭 Gestão de Produção' },
        ]
    },
    {
        title: '📦 Estoque',
        permissions: [
            { page: 'stockAdd', label: '+ Conferência' },
            { page: 'stockTransfer', label: '➡️ Transferência' },
            { page: 'stock', label: '⚙️ Gestão de Lotes' },
        ]
    },
    {
        title: '👥 Pessoas',
        permissions: [
            { page: 'peopleManagement', label: '👥 Gestão de Pessoas' },
            { page: 'continuousImprovement', label: '✨ Melhoria Contínua' },
        ]
    },
    {
        title: '🧰 Gestão',
        permissions: [
            { page: 'reports', label: '📈 Relatórios' },
            { page: 'documents', label: '📄 Documentos' },
            { page: 'workInstructions', label: '📖 Instruções' },
            { page: 'partsManager', label: '🔧 Peças' },
        ]
    },
    {
        title: '⚙️ Sistema',
        permissions: [
            { page: 'userManagement', label: '👥 Usuários' },
            { page: 'partnerConfig', label: '🤝 Configuração de Parceiros' },
            { page: 'gaugesManager', label: '⚙️ Configuração de Materiais' },
            { page: 'labelConfig', label: '🏷️ Configuração de Etiqueta' },
        ]
    }
];

const manageablePages = permissionCategories.flatMap(c => c.permissions.map(p => p.page as Page));

const UserModal: React.FC<{
    user?: User | null;
    employees: Employee[];
    activeBrandingPartner?: any;
    onClose: () => void;
    onSubmit: (data: any) => void;
}> = ({ user, employees, activeBrandingPartner, onClose, onSubmit }) => {
    const [username, setUsername] = useState(user?.username || '');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState(user?.fullName || '');
    const [phone, setPhone] = useState(user?.phone || '');
    const [email, setEmail] = useState(user?.email || '');
    const [permissions, setPermissions] = useState<Partial<Record<Page, boolean>>>(
        user?.permissions || {}
    );
    const [role, setRole] = useState(user?.role || 'user');
    const [employeeId, setEmployeeId] = useState(user?.employeeId || '');
    const [assignedMachines, setAssignedMachines] = useState<string[]>(user?.assignedMachines || []);
    const isEditing = !!user;

    const handlePermissionChange = (page: Page, isChecked: boolean) => {
        setPermissions(prev => ({ ...prev, [page]: isChecked }));
    };

    const handleMachineToggle = (machineName: string) => {
        setAssignedMachines(prev => 
            prev.includes(machineName) ? prev.filter(m => m !== machineName) : [...prev, machineName]
        );
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!isEditing && (!username || !password)) {
            alert('Nome de usuário e senha são obrigatórios.');
            return;
        }
        if (isEditing) {
            const dataToSubmit: Partial<User> = { permissions, role, employeeId, assignedMachines, fullName, phone, email };
            if (password) {
                dataToSubmit.password = password;
            }
            onSubmit(dataToSubmit);
        } else {
            onSubmit({ username, password, fullName, phone, email, permissions, role, employeeId, assignedMachines });
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
                <h2 className="text-2xl font-bold text-slate-800 mb-6">{isEditing ? `Editar Usuário: ${user.username}` : 'Adicionar Novo Usuário'}</h2>
                <div className="space-y-4 flex-grow overflow-y-auto pr-2">
                    {!isEditing && (
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-700">Nome de Usuário (Login)</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="mt-1 p-2 w-full border border-slate-300 rounded-md"
                                required
                            />
                        </div>
                    )}
                    
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-slate-700">Nome Completo</label>
                        <input
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="mt-1 p-2 w-full border border-slate-300 rounded-md"
                            placeholder="Ex: João da Silva"
                        />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Celular / WhatsApp</label>
                            <input
                                type="text"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="mt-1 p-2 w-full border border-slate-300 rounded-md"
                                placeholder="(00) 00000-0000"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">E-mail</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="mt-1 p-2 w-full border border-slate-300 rounded-md"
                                placeholder="usuario@email.com"
                            />
                        </div>
                    </div>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-slate-700">Vincular Funcionário (Opcional)</label>
                        <select
                            value={employeeId}
                            onChange={(e) => setEmployeeId(e.target.value)}
                            className="mt-1 p-2 w-full border border-slate-300 rounded-md"
                        >
                            <option value="">-- Nenhum --</option>
                            {employees.filter(e => e.active).map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.name} ({emp.sector || 'Sem setor'})</option>
                            ))}
                        </select>
                        <p className="text-xs text-slate-500 mt-1">Ao vincular, o usuário verá seu próprio Painel de RH.</p>
                    </div>

                    {activeBrandingPartner?.machines && activeBrandingPartner.machines.length > 0 && (
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-700 mb-2">Vincular a Máquina (Acesso Mobile Operador)</label>
                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
                                {activeBrandingPartner.machines.map((m: any) => (
                                    <label key={m.id || m.name || m} className="flex items-center space-x-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={assignedMachines.includes(m.name || m)}
                                            onChange={() => handleMachineToggle(m.name || m)}
                                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span className="text-sm font-semibold text-slate-700">{m.name || m}</span>
                                    </label>
                                ))}
                            </div>
                            <p className="text-xs text-slate-500 mt-1">Se vinculado, este usuário será direcionado ao Painel Mobile exclusivo para operadores.</p>
                        </div>
                    )}

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-slate-700">Função (Role)</label>
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            className="mt-1 p-2 w-full border border-slate-300 rounded-md"
                        >
                            <option value="user">Usuário Comum</option>
                            <option value="gestor">Gestor / Supervisor</option>
                            <option value="admin">Administrador Total</option>
                        </select>
                        <p className="text-[10px] text-slate-500 mt-1">Gestores e Admins possuem acesso total automático.</p>
                    </div>

                    <div className="mb-6">
                        <label className="block text-sm font-medium text-slate-700">{isEditing ? 'Nova Senha' : 'Senha'}</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="mt-1 p-2 w-full border border-slate-300 rounded-md"
                            required={!isEditing}
                            placeholder={isEditing ? 'Deixe em branco para não alterar' : ''}
                        />
                    </div>
                    <div className="mt-6 border-t pt-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-extrabold text-[#0F3F5C] px-1">Permissões de Acesso</h3>
                            {role === 'user' ? (
                                <span className="text-[10px] bg-indigo-100 text-indigo-700 font-bold px-2 py-1 rounded-full uppercase tracking-tighter">Personalizado</span>
                            ) : (
                                <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-2 py-1 rounded-full uppercase tracking-tighter">Acesso Total</span>
                            )}
                        </div>

                        {role !== 'user' ? (
                            <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-2xl text-center">
                                <div className="w-12 h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-200">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                                </div>
                                <p className="text-sm font-bold text-emerald-800">Acesso Total Habilitado</p>
                                <p className="text-xs text-emerald-600 mt-1 px-4">Usuários com função <strong>{role === 'admin' ? 'Administrador' : 'Gestor'}</strong> possuem permissão para acessar todas as funcionalidades do sistema automaticamente.</p>
                            </div>
                        ) : (
                            <div className="space-y-6 animate-fadeIn">
                                {permissionCategories.map((category) => (
                                    <div key={category.title} className="bg-slate-50 p-4 rounded-xl border border-slate-100 group/cat transition-all hover:shadow-md hover:bg-white overflow-hidden">
                                        <div className="flex justify-between items-center mb-4">
                                            <h4 className="text-sm font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                                                {category.title}
                                            </h4>
                                            <div className="flex gap-2 opacity-0 group-hover/cat:opacity-100 transition-opacity">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const newPerms = { ...permissions };
                                                        category.permissions.forEach(p => newPerms[p.page as Page] = true);
                                                        setPermissions(newPerms);
                                                    }}
                                                    className="text-[10px] font-bold text-indigo-500 hover:text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded transition"
                                                >
                                                    Marcar Tudo
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const newPerms = { ...permissions };
                                                        category.permissions.forEach(p => newPerms[p.page as Page] = false);
                                                        setPermissions(newPerms);
                                                    }}
                                                    className="text-[10px] font-bold text-slate-400 hover:text-red-500 bg-white px-2 py-0.5 rounded border border-slate-100 transition"
                                                >
                                                    Limpar
                                                </button>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 gap-2">
                                            {category.permissions.map(({ page, label }) => (
                                                <label key={page} className="flex items-center space-x-3 p-2.5 rounded-lg hover:bg-slate-50 transition-all cursor-pointer border border-transparent hover:border-slate-100 group">
                                                    <input
                                                        type="checkbox"
                                                        checked={!!permissions[page as Page]}
                                                        onChange={(e) => handlePermissionChange(page as Page, e.target.checked)}
                                                        className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer"
                                                    />
                                                    <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900">{label}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex justify-end gap-4 pt-4 mt-auto border-t">
                    <button type="button" onClick={onClose} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-4 rounded-lg transition">Cancelar</button>
                    <button type="submit" className="bg-[#0F3F5C] text-white font-bold py-2 px-4 rounded-lg hover:bg-[#0A2A3D] transition">Salvar</button>
                </div>
            </form>
        </div>
    );
};


const AccessHistoryModal: React.FC<{
    user: User;
    accessLogs: UserAccessLog[];
    onClose: () => void;
}> = ({ user, accessLogs, onClose }) => {
    const userLogs = useMemo(() => {
        return accessLogs
            .filter(log => log.userId === user.id)
            .sort((a, b) => new Date(b.loginAt).getTime() - new Date(a.loginAt).getTime());
    }, [accessLogs, user.id]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col animate-fadeIn">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        📜 Histórico: {user.username}
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold text-xl">&times;</button>
                </div>
                
                <div className="flex-grow overflow-y-auto pr-1 space-y-2 mb-6">
                    {userLogs.length > 0 ? (
                        userLogs.map((log) => {
                            const formattedDate = new Date(log.loginAt).toLocaleString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit'
                            });
                            return (
                                <div key={log.id} className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full bg-indigo-500"></div>
                                        <span className="text-xs font-bold text-slate-700">Acesso ao sistema</span>
                                    </div>
                                    <span className="text-xs font-semibold text-slate-500">{formattedDate}</span>
                                </div>
                            );
                        })
                    ) : (
                        <div className="text-center py-10 text-slate-400">
                            <p>Nenhum registro de acesso encontrado.</p>
                        </div>
                    )}
                </div>
                
                <div className="flex justify-end pt-4 border-t">
                    <button onClick={onClose} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-4 rounded-lg transition">
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
};


const UserManagement: React.FC<UserManagementProps> = ({ users, employees, addUser, updateUser, deleteUser, setPage, accessLogs, currentUser, activeBrandingPartner }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [deletingUser, setDeletingUser] = useState<User | null>(null);
    const [viewingHistoryUser, setViewingHistoryUser] = useState<User | null>(null);

    // Permite gerenciar todos os usuários, mas o admin principal (id: 'admin') pode ter proteção extra se quiser
    const manageableUsers = users.filter(u => u.username !== 'admin');

    const handleAddUser = (data: { username: string; password: string; permissions: Partial<Record<Page, boolean>>; role: string; employeeId?: string; assignedMachines?: string[] }) => {
        addUser(data);
        setIsModalOpen(false);
    };

    const handleEditUser = (data: Partial<User>) => {
        if (editingUser) {
            updateUser(editingUser.id, data);
        }
        setEditingUser(null);
    };

    const handleDeleteConfirm = () => {
        if (deletingUser) {
            deleteUser(deletingUser.id);
        }
        setDeletingUser(null);
    };

    return (
        <div className="p-4 sm:p-6 md:p-8">
            {isModalOpen && <UserModal employees={employees} activeBrandingPartner={activeBrandingPartner} onClose={() => setIsModalOpen(false)} onSubmit={handleAddUser} />}
            {editingUser && <UserModal user={editingUser} employees={employees} activeBrandingPartner={activeBrandingPartner} onClose={() => setEditingUser(null)} onSubmit={handleEditUser} />}
            {viewingHistoryUser && <AccessHistoryModal user={viewingHistoryUser} accessLogs={accessLogs} onClose={() => setViewingHistoryUser(null)} />}
            {deletingUser && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-md text-center">
                        <WarningIcon className="h-16 w-16 mx-auto text-red-500 mb-4" />
                        <p className="text-lg text-slate-700 mb-6">Tem certeza que deseja excluir o usuário <strong>{deletingUser.username}</strong>? Esta ação não pode ser desfeita.</p>
                        <div className="flex justify-center gap-4">
                            <button onClick={() => setDeletingUser(null)} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-6 rounded-lg transition">Cancelar</button>
                            <button onClick={handleDeleteConfirm} className="bg-red-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-red-700 transition">Confirmar Exclusão</button>
                        </div>
                    </div>
                </div>
            )}

            <header className="flex items-center mb-6 pt-4">
                <h1 className="text-3xl font-bold text-slate-800">Gerenciar Usuários</h1>
            </header>

            <div className="mb-6 flex justify-between items-center">
                <button
                    onClick={async () => {
                        if (!window.confirm('ALERTA: Tem certeza que deseja reiniciar o sistema?\n\nTodos os usuários ativos (inclusive você) serão desconectados imediatamente e precisarão fazer login novamente.')) return;
                        try {
                            const newAccessLog = {
                                id: (crypto as any).randomUUID ? (crypto as any).randomUUID() : 'log-' + Date.now(),
                                user_id: currentUser?.id || '00000000-0000-0000-0000-000000000000',
                                username: 'SYSTEM_RESTART',
                                login_at: new Date().toISOString()
                            };
                            await supabase.from('user_access_logs').insert([newAccessLog]);
                            alert('Comando de reinício enviado! Todos os usuários serão desconectados em instantes.');
                        } catch (e) {
                            console.error('Error restarting system:', e);
                            alert('Erro ao enviar o comando de reinício.');
                        }
                    }}
                    className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-rose-700 text-white font-bold py-2 px-4 rounded-lg hover:from-red-700 hover:to-rose-800 transition shadow-md shadow-red-500/20 active:scale-[0.98]"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                    Reiniciar Sistema
                </button>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-[#0F3F5C] hover:bg-[#0A2A3D] text-white font-bold py-2 px-4 rounded-lg transition"
                >
                    Adicionar Usuário
                </button>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm">
                <h2 className="text-xl font-semibold text-slate-700 mb-4">Lista de Usuários</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-slate-500">
                        <thead className="text-xs text-slate-700 uppercase bg-slate-50">
                            <tr>
                                <th scope="col" className="px-6 py-3">Nome de Usuário</th>
                                <th scope="col" className="px-6 py-3">Função</th>
                                <th scope="col" className="px-6 py-3">Status</th>
                                <th scope="col" className="px-6 py-3">Acessos</th>
                                <th scope="col" className="px-6 py-3">Último Acesso</th>
                                <th scope="col" className="px-6 py-3">Permissões</th>
                                <th scope="col" className="px-6 py-3 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {manageableUsers.map(user => {
                                const formattedLastAccess = user.lastLoginAt
                                    ? new Date(user.lastLoginAt).toLocaleString('pt-BR', {
                                        day: '2-digit',
                                        month: '2-digit',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })
                                    : 'Sem registro';

                                return (
                                    <tr key={user.id} className="bg-white border-b hover:bg-slate-50">
                                        <td className="px-6 py-4 font-medium text-slate-900">{user.username}</td>
                                        <td className="px-6 py-4 capitalize">{user.role}</td>
                                        <td className="px-6 py-4">
                                            {user.isOnline ? (
                                                <span className="flex items-center gap-1.5 text-emerald-600 font-bold">
                                                    <span className="relative flex h-2.5 w-2.5">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                                                    </span>
                                                    Online
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1.5 text-slate-400 font-semibold">
                                                    <span className="h-2.5 w-2.5 rounded-full bg-slate-300"></span>
                                                    Offline
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 font-bold text-slate-700">{user.loginCount || 0}</td>
                                        <td className="px-6 py-4 text-xs font-semibold text-slate-500">{formattedLastAccess}</td>
                                        <td className="px-6 py-4 font-medium text-slate-600">{Object.values(user.permissions || {}).filter(Boolean).length} / {manageablePages.length}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-center space-x-3">
                                                <button onClick={() => setViewingHistoryUser(user)} className="p-1 text-indigo-600 hover:text-indigo-800 transition-colors" title="Histórico de Acessos">
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                                                </button>
                                                <button onClick={() => setEditingUser(user)} className="p-1 text-slate-600 hover:text-slate-800 transition-colors" title="Editar Usuário">
                                                    <PencilIcon className="h-5 w-5" />
                                                </button>
                                                <button onClick={() => setDeletingUser(user)} className="p-1 text-red-600 hover:text-red-800 transition-colors" title="Excluir Usuário">
                                                    <TrashIcon className="h-5 w-5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {manageableUsers.length === 0 && (
                        <div className="text-center text-slate-500 py-10">
                            <p>Nenhum usuário cadastrado ainda.</p>
                            <p className="text-sm">Clique em "Adicionar Usuário" para começar.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UserManagement;