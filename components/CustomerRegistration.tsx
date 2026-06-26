import React, { useState } from 'react';
import type { Page, Customer } from '../types';
import { insertItem } from '../services/supabaseService';
import { ArrowLeftIcon, UserGroupIcon, PlusIcon, DocumentTextIcon, LocationIcon, UserIcon } from './icons';
import { maskCPF, maskCNPJ, maskRG, maskPhone } from '../utils/masks';

interface CustomerRegistrationProps {
    setPage: (page: Page) => void;
    customers: Customer[];
}

const CustomerRegistration: React.FC<CustomerRegistrationProps> = ({ setPage, customers }) => {
    const [customerType, setCustomerType] = useState<'Pessoa Física' | 'Pessoa Jurídica'>('Pessoa Física');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [name, setName] = useState(''); // Used for Razão Social

    const [document1, setDocument1] = useState(''); // CPF ou CNPJ
    const [document2, setDocument2] = useState(''); // RG ou Inscrição Estadual
    const [birthDate, setBirthDate] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [tradeName, setTradeName] = useState('');
    
    // Novos campos de endereço (Rua, Numero, Bairro, Cidade, CEP)
    const [rua, setRua] = useState('');
    const [numero, setNumero] = useState('');
    const [bairro, setBairro] = useState('');
    const [cidade, setCidade] = useState('');
    const [cep, setCep] = useState('');

    const [sameAsMain, setSameAsMain] = useState(true);
    const [ruaEntrega, setRuaEntrega] = useState('');
    const [numeroEntrega, setNumeroEntrega] = useState('');
    const [bairroEntrega, setBairroEntrega] = useState('');
    const [cidadeEntrega, setCidadeEntrega] = useState('');
    const [cepEntrega, setCepEntrega] = useState('');
    
    const [additionalInfo, setAdditionalInfo] = useState('');

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

    const generateCustomerCode = () => {
        let maxId = 999;
        customers.forEach(c => {
            const match = c.code.match(/^(?:CLI-)?(\d+)$/);
            if (match) {
                const num = parseInt(match[1], 10);
                if (num > maxId) maxId = num;
            }
        });
        const nextId = maxId + 1;
        return `${nextId}`; 
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validação de Nome e Sobrenome
        let finalName = '';
        if (customerType === 'Pessoa Física') {
            if (!firstName.trim() || !lastName.trim()) {
                setNotification({ message: 'Por favor, preencha o Nome e o Sobrenome.', type: 'error' });
                setTimeout(() => setNotification(null), 3000);
                return;
            }
            finalName = `${firstName.trim()} ${lastName.trim()}`;
        } else {
            if (!name.trim()) {
                setNotification({ message: 'Por favor, preencha a Razão Social.', type: 'error' });
                setTimeout(() => setNotification(null), 3000);
                return;
            }
            finalName = name.trim();
        }

        // Validação de Data de Nascimento
        if (customerType === 'Pessoa Física' && birthDate) {
            const year = new Date(birthDate).getFullYear();
            if (year < 1900 || year > new Date().getFullYear()) {
                setNotification({ message: 'Por favor, insira uma Data de Nascimento válida.', type: 'error' });
                setTimeout(() => setNotification(null), 3000);
                return;
            }
        }
        
        if (!finalName || !document1) {
            setNotification({ message: 'Preencha os campos obrigatórios (Nome e CPF/CNPJ).', type: 'error' });
            setTimeout(() => setNotification(null), 3000);
            return;
        }

        // Checking for duplicates (Errors - block registration)
        const duplicateError = customers.find(c => 
            c.document1 === document1 || 
            (document2 && c.document2 === document2) || 
            c.name.toLowerCase() === finalName.toLowerCase() || 
            (email && c.email?.toLowerCase() === email.toLowerCase())
        );

        if (duplicateError) {
            let reason = 'Nome';
            if (duplicateError.document1 === document1) reason = 'CPF/CNPJ';
            else if (document2 && duplicateError.document2 === document2) reason = 'RG/Inscrição Estadual';
            else if (email && duplicateError.email?.toLowerCase() === email.toLowerCase()) reason = 'E-mail';

            setNotification({ message: `Cadastro bloqueado: Já existe um cliente com este ${reason} (${duplicateError.name})!`, type: 'error' });
            setTimeout(() => setNotification(null), 5000);
            return;
        }

        // Concatenar endereço
        const addrMain = (rua || numero || bairro || cidade || cep) 
            ? `${rua || ''}, ${numero || 'S/N'} - ${bairro || ''} - ${cidade || ''} - CEP: ${cep || ''}` 
            : '';

        const addrDelivery = sameAsMain 
            ? addrMain
            : (ruaEntrega || numeroEntrega || bairroEntrega || cidadeEntrega || cepEntrega)
                ? `${ruaEntrega || ''}, ${numeroEntrega || 'S/N'} - ${bairroEntrega || ''} - ${cidadeEntrega || ''} - CEP: ${cepEntrega || ''}`
                : '';

        // Checking for duplicates (Warnings - ask for confirmation)
        const duplicateWarning = customers.find(c => 
            (phone && c.phone === phone) || 
            (addrMain && c.addressMain === addrMain)
        );

        if (duplicateWarning) {
            let reason = 'Telefone';
            if (addrMain && duplicateWarning.addressMain === addrMain) reason = 'Endereço';

            const proceed = window.confirm(`ATENÇÃO!\n\nO cliente "${duplicateWarning.name}" já está cadastrado com este mesmo ${reason}.\n\nDeseja continuar e cadastrar este novo cliente mesmo assim?`);
            if (!proceed) return;
        }

        setIsSubmitting(true);
        const newCode = generateCustomerCode();

        const newCustomer: Partial<Customer> = {
            customerType,
            code: newCode,
            name: finalName,
            document1,
            document2,
            birthDate: customerType === 'Pessoa Física' ? birthDate : undefined,
            email,
            phone,
            addressMain: addrMain,
            addressDelivery: customerType === 'Pessoa Física' ? addrDelivery : undefined,
            addressBilling: customerType === 'Pessoa Jurídica' ? addrDelivery : undefined,
            tradeName: customerType === 'Pessoa Jurídica' ? tradeName : undefined,
            additionalInfo,
        };

        try {
            await insertItem<Customer>('customers', newCustomer);
            setNotification({ message: 'Cliente cadastrado com sucesso!', type: 'success' });
            
            // Limpa o form
            setName('');
            setFirstName('');
            setLastName('');
            setDocument1('');
            setDocument2('');
            setBirthDate('');
            setEmail('');
            setPhone('');
            setRua('');
            setNumero('');
            setBairro('');
            setCidade('');
            setCep('');
            setSameAsMain(true);
            setRuaEntrega('');
            setNumeroEntrega('');
            setBairroEntrega('');
            setCidadeEntrega('');
            setCepEntrega('');
            setTradeName('');
            setAdditionalInfo('');

            setTimeout(() => {
                setPage('customersManagement');
            }, 1500);

        } catch (err: any) {
            console.error('Error saving customer:', err);
            setNotification({ message: 'Erro ao salvar o cliente. Tente novamente.', type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col min-h-screen bg-[#0A2A3D] text-slate-200">
            {/* Header */}
            <div className="bg-[#0D3B54] border-b border-white/10 p-6 shadow-md flex items-center justify-between sticky top-0 z-20">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setPage('customersManagement')}
                        className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors border border-white/10"
                    >
                        <ArrowLeftIcon className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-white tracking-wider uppercase drop-shadow-sm flex items-center gap-3">
                            <PlusIcon className="w-7 h-7 text-[#00E5FF]" />
                            Novo Cliente
                        </h1>
                        <p className="text-sm text-slate-400 font-medium mt-1">
                            Preencha os dados para cadastrar um novo cliente
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex-1 p-4 lg:p-6 max-w-5xl mx-auto w-full animate-fadeIn">
                {notification && (
                    <div className={`p-3 rounded-xl mb-4 text-sm font-bold shadow-lg flex items-center gap-3 ${
                        notification.type === 'success' 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                        : 'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}>
                        {notification.type === 'success' ? '✅' : '❌'}
                        {notification.message}
                    </div>
                )}

                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 lg:p-6 backdrop-blur-sm shadow-xl">
                    
                    {/* Customer Type Selector */}
                    <div className="flex items-center gap-4 mb-4 bg-white/5 p-1.5 rounded-xl border border-white/10">
                        <button
                            type="button"
                            onClick={() => setCustomerType('Pessoa Física')}
                            className={`flex-1 py-3 px-4 rounded-lg font-bold text-sm tracking-wide transition-all ${
                                customerType === 'Pessoa Física'
                                ? 'bg-[#00E5FF] text-[#0A2A3D] shadow-lg shadow-[#00E5FF]/20'
                                : 'text-slate-400 hover:bg-white/5 hover:text-white'
                            }`}
                        >
                            👨🏽 Pessoa Física
                        </button>
                        <button
                            type="button"
                            onClick={() => setCustomerType('Pessoa Jurídica')}
                            className={`flex-1 py-3 px-4 rounded-lg font-bold text-sm tracking-wide transition-all ${
                                customerType === 'Pessoa Jurídica'
                                ? 'bg-[#00E5FF] text-[#0A2A3D] shadow-lg shadow-[#00E5FF]/20'
                                : 'text-slate-400 hover:bg-white/5 hover:text-white'
                            }`}
                        >
                            🏢 Pessoa Jurídica
                        </button>
                    </div>

                    <form onSubmit={handleSave} className="space-y-4">
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Nome / Razão Social */}
                            {customerType === 'Pessoa Física' ? (
                                <div className="grid grid-cols-2 gap-4 col-span-2 md:col-span-1">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black tracking-wider text-slate-400 uppercase">
                                            Nome <span className="text-[#00E5FF]">*</span>
                                        </label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <UserIcon className="h-5 w-5 text-slate-500" />
                                            </div>
                                            <input
                                                type="text"
                                                required
                                                autoComplete="new-password"
                                                value={firstName}
                                                onChange={(e) => setFirstName(e.target.value)}
                                                className="w-full bg-[#0A2A3D]/50 focus:bg-[#0A2A3D]/50 border border-white/10 rounded-xl pl-10 pr-3 py-2 text-white text-sm font-medium focus:outline-none focus:border-[#00E5FF] focus:ring-0 transition-colors"
                                                placeholder="Nome"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black tracking-wider text-slate-400 uppercase">
                                            Sobrenome <span className="text-[#00E5FF]">*</span>
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                required
                                                autoComplete="new-password"
                                                value={lastName}
                                                onChange={(e) => setLastName(e.target.value)}
                                                className="w-full bg-[#0A2A3D]/50 focus:bg-[#0A2A3D]/50 border border-white/10 rounded-xl px-3 py-2 text-white text-sm font-medium focus:outline-none focus:border-[#00E5FF] focus:ring-0 transition-colors"
                                                placeholder="Sobrenome"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-4 col-span-2 md:col-span-1">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black tracking-wider text-slate-400 uppercase">
                                            Razão Social <span className="text-[#00E5FF]">*</span>
                                        </label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <UserIcon className="h-5 w-5 text-slate-500" />
                                            </div>
                                            <input
                                                type="text"
                                                required
                                                autoComplete="new-password"
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                className="w-full bg-[#0A2A3D]/50 focus:bg-[#0A2A3D]/50 border border-white/10 rounded-xl pl-10 pr-3 py-2 text-white text-sm font-medium focus:outline-none focus:border-[#00E5FF] focus:ring-0 transition-colors"
                                                placeholder="Razão Social"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black tracking-wider text-slate-400 uppercase">
                                            Nome Fantasia
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                autoComplete="new-password"
                                                value={tradeName}
                                                onChange={(e) => setTradeName(e.target.value)}
                                                className="w-full bg-[#0A2A3D]/50 focus:bg-[#0A2A3D]/50 border border-white/10 rounded-xl px-3 py-2 text-white text-sm font-medium focus:outline-none focus:border-[#00E5FF] focus:ring-0 transition-colors"
                                                placeholder="Nome Fantasia"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* CPF / CNPJ */}
                            <div className="space-y-2">
                                <label className="text-xs font-black tracking-wider text-slate-400 uppercase">
                                    {customerType === 'Pessoa Física' ? 'CPF *' : 'CNPJ *'}
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <DocumentTextIcon className="h-5 w-5 text-slate-500" />
                                    </div>
                                    <input
                                        type="text"
                                        required
                                        autoComplete="new-password"
                                        value={document1}
                                        onChange={(e) => setDocument1(customerType === 'Pessoa Física' ? maskCPF(e.target.value) : maskCNPJ(e.target.value))}
                                        className="w-full bg-[#0A2A3D]/50 focus:bg-[#0A2A3D]/50 border border-white/10 rounded-xl pl-10 pr-3 py-2 text-white text-sm font-medium focus:outline-none focus:border-[#00E5FF] focus:ring-0 transition-colors"
                                        placeholder={customerType === 'Pessoa Física' ? '000.000.000-00' : '00.000.000/0000-00'}
                                    />
                                </div>
                            </div>

                            {/* RG / Inscrição Estadual */}
                            <div className="space-y-2">
                                <label className="text-xs font-black tracking-wider text-slate-400 uppercase">
                                    {customerType === 'Pessoa Física' ? 'RG' : 'Inscrição Estadual'}
                                </label>
                                <input
                                    type="text"
                                    autoComplete="new-password"
                                    value={document2}
                                    onChange={(e) => setDocument2(customerType === 'Pessoa Física' ? maskRG(e.target.value) : e.target.value)}
                                    className="w-full bg-[#0A2A3D]/50 focus:bg-[#0A2A3D]/50 border border-white/10 rounded-xl px-3 py-2 text-white text-sm font-medium focus:outline-none focus:border-[#00E5FF] focus:ring-0 transition-colors"
                                    placeholder={customerType === 'Pessoa Física' ? 'Digite o RG' : 'Digite a Inscrição Estadual'}
                                />
                            </div>

                            {/* Data de Nascimento (apenas PF) */}
                            {customerType === 'Pessoa Física' && (
                                <div className="space-y-2">
                                    <label className="text-xs font-black tracking-wider text-slate-400 uppercase">
                                        Data de Nascimento
                                    </label>
                                    <input
                                        type="date"
                                        autoComplete="new-password"
                                        value={birthDate}
                                        onChange={(e) => setBirthDate(e.target.value)}
                                        className="w-full bg-[#0A2A3D]/50 focus:bg-[#0A2A3D]/50 border border-white/10 rounded-xl px-3 py-2 text-white text-sm font-medium focus:outline-none focus:border-[#00E5FF] focus:ring-0 transition-colors"
                                    />
                                </div>
                            )}

                            {/* Email */}
                            <div className="space-y-2">
                                <label className="text-xs font-black tracking-wider text-slate-400 uppercase">
                                    E-mail
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <DocumentTextIcon className="h-5 w-5 text-slate-500" />
                                    </div>
                                    <input
                                        type="email"
                                        autoComplete="new-password"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-[#0A2A3D]/50 focus:bg-[#0A2A3D]/50 border border-white/10 rounded-xl pl-10 pr-3 py-2 text-white text-sm font-medium focus:outline-none focus:border-[#00E5FF] focus:ring-0 transition-colors"
                                        placeholder="email@exemplo.com"
                                    />
                                </div>
                            </div>

                            {/* Telefone */}
                            <div className="space-y-2">
                                <label className="text-xs font-black tracking-wider text-slate-400 uppercase">
                                    Telefone / Celular
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <UserIcon className="h-5 w-5 text-slate-500" />
                                    </div>
                                    <input
                                        type="tel"
                                        autoComplete="new-password"
                                        value={phone}
                                        onChange={(e) => setPhone(maskPhone(e.target.value))}
                                        className="w-full bg-[#0A2A3D]/50 focus:bg-[#0A2A3D]/50 border border-white/10 rounded-xl pl-10 pr-3 py-2 text-white text-sm font-medium focus:outline-none focus:border-[#00E5FF] focus:ring-0 transition-colors"
                                        placeholder="(00) 000000000"
                                    />
                                </div>
                            </div>
                        </div>

                        <hr className="border-white/10 my-4" />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Endereço Principal / Residencial / Localização */}
                            <div className="space-y-2">
                                <label className="text-xs font-black tracking-wider text-slate-400 uppercase">
                                    {customerType === 'Pessoa Física' ? 'Endereço Residencial' : 'Localização'}
                                </label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        <div className="space-y-0.5">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase">Rua</label>
                                            <input
                                                type="text"
                                                autoComplete="new-password"
                                                value={rua}
                                                onChange={(e) => setRua(e.target.value)}
                                                className="w-full bg-[#0A2A3D]/50 focus:bg-[#0A2A3D]/50 border border-white/10 rounded-xl px-3 py-1.5 text-white text-sm font-medium focus:outline-none focus:border-[#00E5FF] focus:ring-0 transition-colors"
                                                placeholder="Nome da rua"
                                            />
                                        </div>
                                        <div className="space-y-0.5">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase">Número</label>
                                            <input
                                                type="text"
                                                autoComplete="new-password"
                                                value={numero}
                                                onChange={(e) => setNumero(e.target.value)}
                                                className="w-full bg-[#0A2A3D]/50 focus:bg-[#0A2A3D]/50 border border-white/10 rounded-xl px-3 py-1.5 text-white text-sm font-medium focus:outline-none focus:border-[#00E5FF] focus:ring-0 transition-colors"
                                                placeholder="Nº ou S/N"
                                            />
                                        </div>
                                        <div className="space-y-0.5">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase">Bairro</label>
                                            <input
                                                type="text"
                                                autoComplete="new-password"
                                                value={bairro}
                                                onChange={(e) => setBairro(e.target.value)}
                                                className="w-full bg-[#0A2A3D]/50 focus:bg-[#0A2A3D]/50 border border-white/10 rounded-xl px-3 py-1.5 text-white text-sm font-medium focus:outline-none focus:border-[#00E5FF] focus:ring-0 transition-colors"
                                                placeholder="Nome do bairro"
                                            />
                                        </div>
                                        <div className="space-y-0.5">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase">Cidade / UF</label>
                                            <input
                                                type="text"
                                                autoComplete="new-password"
                                                value={cidade}
                                                onChange={(e) => setCidade(e.target.value)}
                                                className="w-full bg-[#0A2A3D]/50 focus:bg-[#0A2A3D]/50 border border-white/10 rounded-xl px-3 py-1.5 text-white text-sm font-medium focus:outline-none focus:border-[#00E5FF] focus:ring-0 transition-colors"
                                                placeholder="Ex: São Paulo - SP"
                                            />
                                        </div>
                                        <div className="space-y-0.5 md:col-span-2">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase">CEP</label>
                                            <input
                                                type="text"
                                                autoComplete="new-password"
                                                value={cep}
                                                onChange={(e) => setCep(e.target.value.replace(/\D/g, '').replace(/^(\d{5})(\d)/, '$1-$2'))}
                                                maxLength={9}
                                                className="w-full bg-[#0A2A3D]/50 focus:bg-[#0A2A3D]/50 border border-white/10 rounded-xl px-3 py-1.5 text-white text-sm font-medium focus:outline-none focus:border-[#00E5FF] focus:ring-0 transition-colors"
                                                placeholder="00000-000"
                                            />
                                        </div>
                                    </div>
                                </div>

                            {/* Endereço Secundário (Entrega/Correspondência) */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-black tracking-wider text-slate-400 uppercase">
                                        {customerType === 'Pessoa Física' ? 'Endereço de Entrega' : 'Endereço de Correspondência'}
                                    </label>
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={sameAsMain} 
                                            onChange={e => setSameAsMain(e.target.checked)} 
                                            className="rounded border-white/10 text-[#00E5FF] focus:ring-[#00E5FF] bg-[#0A2A3D]/50" 
                                        />
                                        <span className="text-[10px] font-bold text-slate-400">
                                            {customerType === 'Pessoa Física' ? 'Mesmo que o residencial' : 'Mesmo que a localização'}
                                        </span>
                                    </label>
                                </div>
                                
                                {!sameAsMain ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        <div className="space-y-0.5">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase">Rua</label>
                                            <input
                                                type="text"
                                                autoComplete="new-password"
                                                value={ruaEntrega}
                                                onChange={(e) => setRuaEntrega(e.target.value)}
                                                className="w-full bg-[#0A2A3D]/50 focus:bg-[#0A2A3D]/50 border border-white/10 rounded-xl px-3 py-1.5 text-white text-sm font-medium focus:outline-none focus:border-[#00E5FF] focus:ring-0 transition-colors"
                                                placeholder="Nome da rua"
                                            />
                                        </div>
                                        <div className="space-y-0.5">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase">Número</label>
                                            <input
                                                type="text"
                                                autoComplete="new-password"
                                                value={numeroEntrega}
                                                onChange={(e) => setNumeroEntrega(e.target.value)}
                                                className="w-full bg-[#0A2A3D]/50 focus:bg-[#0A2A3D]/50 border border-white/10 rounded-xl px-3 py-1.5 text-white text-sm font-medium focus:outline-none focus:border-[#00E5FF] focus:ring-0 transition-colors"
                                                placeholder="Nº ou S/N"
                                            />
                                        </div>
                                        <div className="space-y-0.5">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase">Bairro</label>
                                            <input
                                                type="text"
                                                autoComplete="new-password"
                                                value={bairroEntrega}
                                                onChange={(e) => setBairroEntrega(e.target.value)}
                                                className="w-full bg-[#0A2A3D]/50 focus:bg-[#0A2A3D]/50 border border-white/10 rounded-xl px-3 py-1.5 text-white text-sm font-medium focus:outline-none focus:border-[#00E5FF] focus:ring-0 transition-colors"
                                                placeholder="Nome do bairro"
                                            />
                                        </div>
                                        <div className="space-y-0.5">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase">Cidade / UF</label>
                                            <input
                                                type="text"
                                                autoComplete="new-password"
                                                value={cidadeEntrega}
                                                onChange={(e) => setCidadeEntrega(e.target.value)}
                                                className="w-full bg-[#0A2A3D]/50 focus:bg-[#0A2A3D]/50 border border-white/10 rounded-xl px-3 py-1.5 text-white text-sm font-medium focus:outline-none focus:border-[#00E5FF] focus:ring-0 transition-colors"
                                                placeholder="Ex: São Paulo - SP"
                                            />
                                        </div>
                                        <div className="space-y-0.5 md:col-span-2">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase">CEP</label>
                                            <input
                                                type="text"
                                                autoComplete="new-password"
                                                value={cepEntrega}
                                                onChange={(e) => setCepEntrega(e.target.value.replace(/\D/g, '').replace(/^(\d{5})(\d)/, '$1-$2'))}
                                                maxLength={9}
                                                className="w-full bg-[#0A2A3D]/50 focus:bg-[#0A2A3D]/50 border border-white/10 rounded-xl px-3 py-1.5 text-white text-sm font-medium focus:outline-none focus:border-[#00E5FF] focus:ring-0 transition-colors"
                                                placeholder="00000-000"
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-[11px] text-slate-400 font-medium text-center">
                                        O endereço será o mesmo.
                                    </div>
                                )}
                            </div>
                            {/* Informações Adicionais */}
                            <div className="space-y-2 col-span-1 md:col-span-2">
                                <label className="text-xs font-black tracking-wider text-slate-400 uppercase">
                                    Informações Adicionais (Opcional)
                                </label>
                                <textarea
                                    value={additionalInfo}
                                    onChange={(e) => setAdditionalInfo(e.target.value)}
                                    rows={2}
                                    className="w-full bg-[#0A2A3D]/50 focus:bg-[#0A2A3D]/50 border border-white/10 rounded-xl px-3 py-2 text-white text-sm font-medium focus:outline-none focus:border-[#00E5FF] focus:ring-0 transition-colors resize-none"
                                    placeholder="Observações, pontos de referência, etc..."
                                />
                            </div>
                        </div>

                        {/* Submit Button */}
                        <div className="pt-4 border-t border-white/10 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setPage('customersManagement')}
                                className="px-6 py-2 rounded-xl font-bold bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className={`px-8 py-2 rounded-xl font-black text-sm tracking-wider uppercase transition-all ${
                                    isSubmitting
                                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                    : 'bg-[#00E5FF] text-[#0A2A3D] hover:bg-[#00B4CC] hover:shadow-lg hover:shadow-[#00E5FF]/20'
                                } flex items-center gap-2`}
                            >
                                {isSubmitting ? 'Salvando...' : 'Cadastrar Cliente'}
                            </button>
                        </div>

                    </form>
                </div>
            </div>
        </div>
    );
};

export default CustomerRegistration;
