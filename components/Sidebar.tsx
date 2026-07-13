import React, { useState } from 'react';
import type { Page, User, Employee, Partner } from '../types';
import { fetchByColumn } from '../services/supabaseService';
import {
    ChartBarIcon,
    CogIcon,
    ClipboardListIcon,
    ArchiveIcon,
    UserGroupIcon,
    AdjustmentsIcon,
    DocumentTextIcon,
    WrenchScrewdriverIcon,
    ChatBubbleLeftRightIcon,
    StarIcon,
    ChevronRightIcon,
    DocumentReportIcon,
    LogoutIcon
} from './icons';

interface SidebarProps {
    page: Page;
    setPage: (page: Page) => void;
    currentUser: User | null;
    notificationCount?: number;
    isMobileMenuOpen?: boolean;
    onLogout?: () => void;
    activeBrandingPartner?: Partner | null;
}

const Sidebar: React.FC<SidebarProps> = ({ page, setPage, currentUser, notificationCount, isMobileMenuOpen, onLogout, activeBrandingPartner }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [expandedMenus, setExpandedMenus] = useState<string[]>(['stock']); // Default open
    const [assignedMachine, setAssignedMachine] = useState<string | null>(null);

    const isGestor = currentUser?.role === 'admin' || currentUser?.role === 'gestor' || currentUser?.username === 'admin';

    React.useEffect(() => {
        if (!isGestor && currentUser?.employeeId) {
            fetchByColumn<Employee>('employees', 'id', currentUser.employeeId)
                .then(emps => {
                    if (emps && emps.length > 0 && emps[0].assignedMachine) {
                        setAssignedMachine(emps[0].assignedMachine);
                    }
                })
                .catch(err => console.error("Error fetching employee assigned machine in Sidebar:", err));
        } else {
            setAssignedMachine(null);
        }
    }, [currentUser, isGestor]);

    React.useEffect(() => {
        const handleCollapse = () => setIsCollapsed(true);
        const handleExpand = () => setIsCollapsed(false);
        window.addEventListener('collapse_sidebar', handleCollapse);
        window.addEventListener('expand_sidebar', handleExpand);
        return () => {
            window.removeEventListener('collapse_sidebar', handleCollapse);
            window.removeEventListener('expand_sidebar', handleExpand);
        };
    }, []);

    const toggleMenu = (menu: string) => {
        setExpandedMenus(prev => prev.includes(menu) ? prev.filter(m => m !== menu) : [...prev, menu]);
    };

    React.useEffect(() => {
        if (['stock', 'stockAdd', 'stockTransfer'].includes(page)) {
            setExpandedMenus(prev => prev.includes('stock') ? prev : [...prev, 'stock']);
        } else if (['pointingSystem'].includes(page)) {
            setExpandedMenus(prev => prev.includes('pointing') ? prev : [...prev, 'pointing']);
        } else if (['customersManagement', 'customerRegistration', 'customerOrders'].includes(page)) {
            setExpandedMenus(prev => prev.includes('customers') ? prev : [...prev, 'customers']);
        } else if (['desbobinadeiraDashboard', 'desbobinadeiraInProgress', 'desbobinadeiraPending', 'desbobinadeiraCompleted', 'desbobinadeiraReports'].includes(page)) {
            setExpandedMenus(prev => prev.includes('desbobinadeira') ? prev : [...prev, 'desbobinadeira']);
        } else if (['programarMaquinas'].includes(page)) {
            setExpandedMenus(prev => prev.includes('machines') ? prev : [...prev, 'machines']);
            if (isCollapsed) setIsCollapsed(false);
        } else if (['peopleManagement', 'continuousImprovement', 'machineManagement'].includes(page)) {
            setExpandedMenus(prev => prev.includes('people') ? prev : [...prev, 'people']);
        }
    }, [page]);

    const hasPermission = (targetPage: Page): boolean => {
        if (!currentUser) return false;
        // Super-admin and gestores always have access to everything by default
        if (currentUser.username === 'admin' || currentUser.role === 'admin' || currentUser.role === 'gestor') return true;

        // Self-management for employees
        if (targetPage === 'peopleManagement' && currentUser.employeeId) return true;

        // Specific permissions check
        return !!currentUser.permissions?.[targetPage];
    };

    const MenuItem = ({ target, label, icon: Icon, highlight = false }: { target: Page, label: string, icon: any, highlight?: boolean }) => {
        if (!hasPermission(target)) return null;

        return (
            <button
                onClick={() => setPage(target)}
                className={`sidebar-item ${page === target ? 'active' : ''}`}
                title={isCollapsed ? label : ''}
            >
                <div className="sidebar-item-icon">
                    <Icon className="w-full h-full" />
                </div>
                {!isCollapsed && (
                    <span className="sidebar-item-label flex items-center gap-2">
                        {label}
                        {highlight && <StarIcon className="h-3 w-3 text-yellow-400" />}
                    </span>
                )}
                {label === 'Gestão de Pessoas' && notificationCount && notificationCount > 0 && isCollapsed && (
                    <div className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-[#0A2A3D]" />
                )}
            </button>
        );
    };

    return (        <aside className={`sidebar no-print ${isCollapsed ? 'collapsed' : ''} ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
            <div className={`sidebar-header relative ${activeBrandingPartner ? 'flex flex-col items-center pt-5 pb-3 px-4 border-b border-white/10 gap-2' : ''}`}>
                {activeBrandingPartner ? (
                    isCollapsed ? (
                        <button 
                            onClick={() => setIsCollapsed(false)} 
                            className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl font-black text-[#00E5FF] ${
                                !activeBrandingPartner?.logoUrl ? 'bg-white/5 border border-white/10' : 'bg-white p-1.5 shadow-md'
                            }`}
                        >
                            {activeBrandingPartner?.logoUrl ? (
                                <img src={activeBrandingPartner.logoUrl} className="w-full h-full object-contain" alt="L" />
                            ) : (
                                activeBrandingPartner?.companyName?.charAt(0) || "M"
                            )}
                        </button>
                    ) : (
                        <div className="w-full flex flex-col items-center text-center animate-fadeIn relative">
                            {/* Client logo */}
                            {activeBrandingPartner?.logoUrl ? (
                                <div className="w-[80px] h-[80px] rounded-xl overflow-hidden flex items-center justify-center bg-white p-2 shadow-lg mb-2">
                                    <img src={activeBrandingPartner.logoUrl} className="w-full h-full object-contain" alt="Logo Cliente" />
                                </div>
                            ) : (
                                <div className="w-[60px] h-[60px] rounded-xl bg-gradient-to-tr from-[#0F3F5C] to-[#00E5FF] flex items-center justify-center text-2xl font-black text-white mb-2 shadow-lg">
                                    {activeBrandingPartner?.companyName?.charAt(0) || 'M'}
                                </div>
                            )}

                            {/* Company Name */}
                            <h2 className="text-sm font-black text-white tracking-widest uppercase mt-1">
                                {activeBrandingPartner?.companyName}
                            </h2>

                            <div className="w-full h-px bg-white/10 my-1.5"></div>

                            {/* Subtitle */}
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-normal">
                                Sistema de Controle de Produção
                            </span>

                            <div className="w-full h-px bg-white/10 my-1.5"></div>

                            {/* Powered By Badge */}
                            <div className="flex flex-col items-center gap-0.5 mt-0.5 animate-pulse-slow">
                                <span className="text-[7px] font-black text-slate-500 tracking-widest uppercase">POWERED BY</span>
                                <div className="flex items-center gap-1.5 bg-[#00E5FF]/10 border border-[#00E5FF]/20 px-2.5 py-0.5 rounded-full">
                                    <span className="text-[9px] font-black text-[#00E5FF] tracking-wider font-sans">MSM GESTÃO</span>
                                </div>
                            </div>
                        </div>
                    )
                ) : (
                    !isCollapsed && (
                        <div className="sidebar-logo">
                            <span className="text-[#00E5FF]">MSM</span> GESTÃO
                        </div>
                    )
                )}
                
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className={`sidebar-toggle ${activeBrandingPartner ? 'absolute right-3 top-3 mt-0 !mb-0' : 'mt-2'}`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d={isCollapsed ? "M11.25 4.5l7.5 7.5-7.5 7.5m-6-15l7.5 7.5-7.5 7.5" : "M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5"} />
                    </svg>
                </button>
            </div>

            <div className="sidebar-content">
                {/* PEDIDOS E ORÇAMENTO */}
                {/* PEDIDOS E ORÇAMENTO */}
                {(hasPermission('customerRegistration') || hasPermission('customersManagement') || hasPermission('customerOrders') || hasPermission('productsCatalog')) && (
                    <div className="sidebar-category">
                        <div className="sidebar-category-title">{isCollapsed ? '📝' : '📝 Pedidos e Orçamento'}</div>

                        <button
                            onClick={() => toggleMenu('customers')}
                            className={`sidebar-item ${['customersManagement', 'customerRegistration', 'customerOrders', 'productsCatalog'].includes(page) ? 'active' : ''} justify-between group`}
                            title={isCollapsed ? 'Clientes' : ''}
                        >
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className="sidebar-item-icon shrink-0">
                                    <UserGroupIcon className="w-full h-full" />
                                </div>
                                {!isCollapsed && <span className="sidebar-item-label whitespace-nowrap">Clientes</span>}
                            </div>
                            {!isCollapsed && (
                                <ChevronRightIcon className={`w-3 h-3 text-slate-500 transition-transform duration-200 ${expandedMenus.includes('customers') ? 'rotate-90' : ''}`} />
                            )}
                        </button>

                        {!isCollapsed && expandedMenus.includes('customers') && (
                            <div className="ml-4 pl-4 border-l border-slate-700/50 flex flex-col gap-0.5 mt-1 mb-2 animate-in slide-in-from-left-2 duration-200">
                                {hasPermission('customerOrders') && (
                                    <button onClick={() => setPage('customerOrders')} className={`text-left text-[12px] font-medium py-1.5 px-3 rounded-md transition-all ${page === 'customerOrders' ? 'text-[#00E5FF] bg-white/5' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
                                        📝 Gestão de Vendas
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* FINANCEIRO */}
                {hasPermission('financialManagement') && (
                    <div className="sidebar-category">
                        <div className="sidebar-category-title">{isCollapsed ? '💰' : '💰 Gestão Financeira'}</div>
                        <button
                            onClick={() => setPage('financialManagement')}
                            className={`sidebar-item ${page === 'financialManagement' ? 'active' : ''} justify-between group`}
                            title={isCollapsed ? 'Financeiro' : ''}
                        >
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className="sidebar-item-icon shrink-0 text-emerald-500">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-full h-full">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                {!isCollapsed && <span className="sidebar-item-label whitespace-nowrap text-emerald-600 font-bold group-hover:text-emerald-700">Financeiro</span>}
                            </div>
                        </button>
                    </div>
                )}

                {/* PRODUÇÃO */}
                {(hasPermission('orderManagement') || hasPermission('productionManagement')) && (
                    <div className="sidebar-category">
                        <div className="sidebar-category-title">{isCollapsed ? '⚙️' : '⚙️ Produção'}</div>
                        {hasPermission('orderManagement') && (
                            <button
                                onClick={() => setPage('orderManagement')}
                                className={`sidebar-item ${page === 'orderManagement' ? 'active' : ''} justify-between group`}
                                title={isCollapsed ? 'Gestão de Pedidos - Engenharia' : ''}
                            >
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="sidebar-item-icon shrink-0">
                                        <CogIcon className="w-full h-full" />
                                    </div>
                                    {!isCollapsed && <span className="sidebar-item-label whitespace-nowrap">Gestão de Pedidos - Eng</span>}
                                </div>
                            </button>
                        )}
                        {hasPermission('productionManagement') && (
                            <button
                                onClick={() => setPage('productionManagement')}
                                className={`sidebar-item ${page === 'productionManagement' ? 'active' : ''} justify-between group mt-1`}
                                title={isCollapsed ? 'Gestão de Produção' : ''}
                            >
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="sidebar-item-icon shrink-0">
                                        <span className="w-full h-full flex items-center justify-center text-lg">🏭</span>
                                    </div>
                                    {!isCollapsed && <span className="sidebar-item-label whitespace-nowrap">Gestão de Produção</span>}
                                </div>
                            </button>
                        )}
                    </div>
                )}

                {/* ESTOQUE */}
                {(hasPermission('stock') || hasPermission('stockAdd') || hasPermission('stockTransfer')) && (
                    <div className="sidebar-category">
                        <div className="sidebar-category-title">{isCollapsed ? '📦' : '📦 Estoque'}</div>



                    {hasPermission('stock') && (
                        <>
                            {/* Collapsible Matéria-prima */}
                            <button
                                onClick={() => toggleMenu('stock')}
                                className={`sidebar-item ${['stock', 'stockAdd', 'stockTransfer'].includes(page) ? 'active' : ''} justify-between group`}
                                title={isCollapsed ? 'Matéria-prima' : ''}
                            >
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="sidebar-item-icon shrink-0">
                                        <ArchiveIcon className="w-full h-full" />
                                    </div>
                                    {!isCollapsed && <span className="sidebar-item-label whitespace-nowrap">Matéria-prima</span>}
                                </div>
                                {!isCollapsed && (
                                    <ChevronRightIcon className={`w-3 h-3 text-slate-500 transition-transform duration-200 ${expandedMenus.includes('stock') ? 'rotate-90' : ''}`} />
                                )}
                            </button>

                            {/* Submenu */}
                            {!isCollapsed && expandedMenus.includes('stock') && (
                                <div className="ml-4 pl-4 border-l border-slate-700/50 flex flex-col gap-0.5 mt-1 mb-2 animate-in slide-in-from-left-2 duration-200">
                                    {hasPermission('stockAdd') && (
                                        <button onClick={() => setPage('stockAdd')} className={`text-left text-[12px] font-medium py-1.5 px-3 rounded-md transition-all ${page === 'stockAdd' ? 'text-[#00E5FF] bg-white/5' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
                                            + Conferência
                                        </button>
                                    )}
                                    {hasPermission('stockTransfer') && (
                                        <button onClick={() => setPage('stockTransfer')} className={`text-left text-[12px] font-medium py-1.5 px-3 rounded-md transition-all ${page === 'stockTransfer' ? 'text-[#00E5FF] bg-white/5' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
                                            ➡️ Transferência
                                        </button>
                                    )}
                                    {hasPermission('stock') && (
                                        <button onClick={() => setPage('stock')} className={`text-left text-[12px] font-medium py-1.5 px-3 rounded-md transition-all ${page === 'stock' ? 'text-[#00E5FF] bg-white/5' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
                                            ⚙️ Gestão de Lotes
                                        </button>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

                {/* PESSOAS */}
                {(hasPermission('peopleManagement') || hasPermission('continuousImprovement') || hasPermission('machineManagement')) && (
                    <div className="sidebar-category">
                        <div className="sidebar-category-title">{isCollapsed ? '👥' : '👥 Pessoas'}</div>

                        <button
                            onClick={() => toggleMenu('people')}
                            className={`sidebar-item ${['peopleManagement', 'continuousImprovement', 'machineManagement'].includes(page) ? 'active' : ''} justify-between group`}
                            title={isCollapsed ? 'Pessoas' : ''}
                        >
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className="sidebar-item-icon shrink-0">
                                    <UserGroupIcon className="w-full h-full" />
                                </div>
                                {!isCollapsed && <span className="sidebar-item-label whitespace-nowrap">Gestão</span>}
                            </div>
                            {!isCollapsed && (
                                <ChevronRightIcon className={`w-3 h-3 text-slate-500 transition-transform duration-200 ${expandedMenus.includes('people') ? 'rotate-90' : ''}`} />
                            )}
                        </button>

                        {!isCollapsed && expandedMenus.includes('people') && (
                            <div className="ml-4 pl-4 border-l border-slate-700/50 flex flex-col gap-0.5 mt-1 mb-2 animate-in slide-in-from-left-2 duration-200">
                                {hasPermission('peopleManagement') && (
                                    <button onClick={() => setPage('peopleManagement')} className={`text-left text-[12px] font-medium py-1.5 px-3 rounded-md transition-all ${page === 'peopleManagement' ? 'text-[#00E5FF] bg-white/5' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
                                        👥 Gestão de Pessoas
                                    </button>
                                )}
                                {hasPermission('continuousImprovement') && (
                                    <button onClick={() => setPage('continuousImprovement')} className={`text-left text-[12px] font-medium py-1.5 px-3 rounded-md transition-all ${page === 'continuousImprovement' ? 'text-[#00E5FF] bg-white/5' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
                                        ✨ Melhoria Contínua
                                    </button>
                                )}
                                {hasPermission('machineManagement') && (
                                    <button onClick={() => setPage('machineManagement')} className={`text-left text-[12px] font-medium py-1.5 px-3 rounded-md transition-all ${page === 'machineManagement' ? 'text-[#00E5FF] bg-white/5' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
                                        ⚙️ Gestão de Máquinas
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* GESTÃO */}
                {(hasPermission('reports') || hasPermission('documents') || hasPermission('workInstructions') || hasPermission('partsManager')) && (
                    <div className="sidebar-category">
                        <div className="sidebar-category-title">{isCollapsed ? '🧰' : '🧰 Gestão'}</div>
                        <MenuItem target="reports" label="Relatórios" icon={ChartBarIcon} />
                        <MenuItem target="documents" label="Documentos" icon={DocumentTextIcon} />
                        <MenuItem target="workInstructions" label="Instruções" icon={DocumentTextIcon} />
                        {/* Peças is now moved into Gestão de Máquinas */}
                    </div>
                )}

                {/* SISTEMA */}
                {(hasPermission('userManagement') || hasPermission('partnerConfig') || hasPermission('downtimeConfigs') || hasPermission('gaugesManager') || hasPermission('labelConfig')) && (
                    <div className="sidebar-category">
                        <div className="sidebar-category-title">{isCollapsed ? '⚙️' : '⚙️ Sistema'}</div>
                        <MenuItem target="userManagement" label="Usuários" icon={UserGroupIcon} />
                        <MenuItem target="partnerConfig" label="Configuração de Parceiros" icon={UserGroupIcon} />
                        <MenuItem target="gaugesManager" label="Configuração de Materiais" icon={CogIcon} />
                        <MenuItem target="labelConfig" label="Configuração de Etiquetas" icon={DocumentTextIcon} />
                        <MenuItem target="databaseMetrics" label="Banco de Dados" icon={ChartBarIcon} />
                    </div>
                )}
            </div>

            {/* Logout Button & Footer Watermark */}
            <div className="sidebar-footer p-4 border-t border-white/10 flex flex-col gap-2">
                <button
                    onClick={() => {
                        if (onLogout && confirm('Deseja realmente sair e voltar para a tela de login?')) {
                            onLogout();
                        }
                    }}
                    className="flex items-center gap-3 w-full p-3 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 group"
                    title={isCollapsed ? 'Sair' : ''}
                >
                    <div className="sidebar-item-icon shrink-0">
                        <LogoutIcon className="w-full h-full group-hover:scale-110 transition-transform" />
                    </div>
                    {!isCollapsed && <span className="font-bold text-sm uppercase tracking-wider">Sair do Sistema</span>}
                </button>
                
                {/* Watermark Branding Footer */}
                {!isCollapsed && (
                    <div className="flex flex-col items-center mt-1 border-t border-white/5 pt-3 animate-fadeIn text-center">
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-md bg-[#00E5FF]/10 flex items-center justify-center border border-[#00E5FF]/20 text-[9px] font-black text-[#00E5FF]">
                                M
                            </div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                Powered by <span className="text-[#00E5FF]">MSM Gestão</span>
                            </span>
                        </div>
                        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mt-1">
                            Versão 2.0.0
                        </span>
                    </div>
                )}
            </div>
        </aside>
    );
};

export default Sidebar;
