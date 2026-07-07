import React, { useState, useEffect } from 'react';
import type { CommercialOrder, CommercialOrderItem, StockGauge, User, Customer, Partner } from '../types';
import { insertItem, updateItem, deleteItem, fetchItems, fetchTable, supabase } from '../services/supabaseService';
import { OrderPrintTemplate } from './OrderPrintTemplate';
import EstriboDrawingBoard from './EstriboDrawingBoard';

const renderTableDrawingSvg = (d: any) => {
    const stroke = "currentColor";
    const sw = "4";
    const valA = d.a || 'A';
    const valB = d.b || 'B';
    const valC = d.c || 'C';
    
    switch (d.type) {
        case 'barra': 
            return <svg viewBox="0 0 100 30" className="w-16 h-10 text-slate-800 drop-shadow-sm">
                <line x1="10" y1="20" x2="90" y2="20" stroke={stroke} strokeWidth={sw} strokeLinecap="round"/>
                <text x="50" y="10" fill="red" fontSize="14" fontWeight="bold" textAnchor="middle">{valA}</text>
            </svg>;
        case 'ferro_l': 
            return <svg viewBox="0 0 100 100" className="w-16 h-16 text-slate-800 drop-shadow-sm">
                <polyline points="25,20 25,75 80,75" fill="none" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round"/>
                <text x="10" y="50" fill="red" fontSize="14" fontWeight="bold">{valA}</text>
                <text x="50" y="95" fill="red" fontSize="14" fontWeight="bold" textAnchor="middle">{valB}</text>
            </svg>;
        case 'ferro_u': 
            return <svg viewBox="0 0 100 100" className="w-16 h-16 text-slate-800 drop-shadow-sm">
                <polyline points="25,20 25,75 75,75 75,20" fill="none" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round"/>
                <text x="5" y="50" fill="red" fontSize="14" fontWeight="bold">{valA}</text>
                <text x="50" y="95" fill="red" fontSize="14" fontWeight="bold" textAnchor="middle">{valB}</text>
                <text x="85" y="50" fill="red" fontSize="14" fontWeight="bold">{valC}</text>
            </svg>;
        case 'estribo': 
            return <svg viewBox="0 0 100 100" className="w-16 h-16 text-slate-800 drop-shadow-sm">
                <rect x="25" y="25" width="50" height="50" fill="none" stroke={stroke} strokeWidth={sw} strokeLinejoin="round"/>
                <polyline points="25,45 45,25" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round"/>
                <polyline points="45,25 25,25 25,45" fill="none" stroke={stroke} strokeWidth={sw} strokeLinejoin="round"/>
                <text x="10" y="55" fill="red" fontSize="14" fontWeight="bold">{valA}</text>
                <text x="50" y="90" fill="red" fontSize="14" fontWeight="bold" textAnchor="middle">{valB}</text>
            </svg>;
        case 'caranguejo': 
            return <svg viewBox="0 0 100 100" className="w-16 h-16 text-slate-800 drop-shadow-sm">
                <polyline points="15,80 30,65 30,35 70,35 70,65 85,50" fill="none" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round"/>
                <text x="15" y="55" fill="red" fontSize="14" fontWeight="bold">{valA}</text>
                <text x="50" y="25" fill="red" fontSize="14" fontWeight="bold" textAnchor="middle">{valB}</text>
                <text x="85" y="70" fill="red" fontSize="14" fontWeight="bold">{valC}</text>
            </svg>;
        case 'bandeja': 
            return <svg viewBox="0 0 100 100" className="w-16 h-16 text-slate-800 drop-shadow-sm">
                <polyline points="40,60 25,75 25,35 75,35 75,75 90,60" fill="none" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round"/>
                <text x="50" y="25" fill="red" fontSize="14" fontWeight="bold" textAnchor="middle">{valA}</text>
                <text x="15" y="55" fill="red" fontSize="14" fontWeight="bold">{valB}</text>
                <text x="90" y="70" fill="red" fontSize="14" fontWeight="bold">{valC}</text>
            </svg>;
        case 'circular': 
            return <svg viewBox="0 0 100 100" className="w-16 h-16 text-slate-800 drop-shadow-sm">
                <circle cx="50" cy="50" r="35" fill="none" stroke={stroke} strokeWidth={sw}/>
                <text x="50" y="55" fill="red" fontSize="16" fontWeight="bold" textAnchor="middle">{valA}</text>
            </svg>;
        case 'espiral': 
            return <svg viewBox="0 0 100 100" className="w-16 h-16 text-slate-800 drop-shadow-sm">
                <path d="M 20 50 Q 35 10 50 50 T 80 50" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round"/>
                <path d="M 20 60 Q 35 20 50 60 T 80 60" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" opacity="0.4"/>
                <text x="50" y="90" fill="red" fontSize="12" fontWeight="bold" textAnchor="middle">{valA},{valB},{valC}</text>
            </svg>;
        case 'custom':
            if (d.customData) {
                const { points, labels } = d.customData;
                if (!points || points.length === 0) return null;
                const pointsStr = points.map((pt: any) => `${pt.x},${pt.y}`).join(' ');
                return (
                    <svg viewBox="0 0 400 400" className="w-16 h-16 text-slate-800 drop-shadow-sm">
                        <polyline points={pointsStr} fill="none" stroke={stroke} strokeWidth="12" strokeLinejoin="round" strokeLinecap="round"/>
                        {labels && labels.map((l: any, idx: number) => (
                            <text key={idx} x={l.x} y={l.y + 8} fill="red" fontSize="32" fontWeight="bold" textAnchor="middle">{d.dimensions?.[l.text] || l.text}</text>
                        ))}
                    </svg>
                );
            }
            return null;
        default: return null;
    }
};

interface OrderItemsEditorProps {
    order: CommercialOrder;
    onClose: () => void;
    onSaveSuccess: () => void;
}

export const OrderItemsEditor: React.FC<OrderItemsEditorProps> = ({ order, onClose, onSaveSuccess }) => {
    const [items, setItems] = useState<CommercialOrderItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [projectIdent, setProjectIdent] = useState(order.projectIdent || '');
    const [clientCode, setClientCode] = useState(order.clientCode || '1001');
    const [clientName, setClientName] = useState(order.clientName || '');
    const [clientCity, setClientCity] = useState(order.clientCity || '');
    const [isSearchingClient, setIsSearchingClient] = useState(false);
    const [clientSearchTerm, setClientSearchTerm] = useState('');
    const [clientSearchResult, setClientSearchResult] = useState<Customer | null>(null);
    const [searchClientError, setSearchClientError] = useState('');
    const [deliveryTime, setDeliveryTime] = useState(order.deliveryTime || '');
    const [paymentCondition, setPaymentCondition] = useState(order.paymentCondition || '');
    const [paymentFees, setPaymentFees] = useState({ card_1x: 3.46, card_2x: 4.85, card_3x: 5.44 });
    const [isPaymentConfigOpen, setIsPaymentConfigOpen] = useState(false);
    
    const [paymentMode, setPaymentMode] = useState<'A_VISTA' | 'CARTAO' | 'BOLETO' | 'CUSTOM'>(() => {
        const val = order.paymentCondition || '';
        if (val === 'CARTÃO (MOSTRAR OPÇÕES)') return 'CARTAO';
        if (val.startsWith('BOLETO')) return 'BOLETO';
        if (val === 'À VISTA' || !val) return 'A_VISTA';
        return 'CUSTOM';
    });
    
    const [paymentDetails, setPaymentDetails] = useState(() => {
        const val = order.paymentCondition || '';
        if (val.startsWith('BOLETO')) return val.replace('BOLETO - ', '').replace('BOLETO', '').trim();
        if (val !== 'CARTÃO (MOSTRAR OPÇÕES)' && val !== 'À VISTA') return val;
        return '';
    });

    useEffect(() => {
        if (paymentMode === 'A_VISTA') setPaymentCondition('À VISTA');
        else if (paymentMode === 'CARTAO') setPaymentCondition('CARTÃO (MOSTRAR OPÇÕES)');
        else if (paymentMode === 'BOLETO') setPaymentCondition(`BOLETO - ${paymentDetails}`.trim());
        else setPaymentCondition(paymentDetails);
    }, [paymentMode, paymentDetails]);
    const [freight, setFreight] = useState(order.freight || '');
    const [freightValue, setFreightValue] = useState<number>(order.freightValue || 0);
    const [adjustmentPercentage, setAdjustmentPercentage] = useState<number>(order.adjustmentPercentage || 0);
    const [adjustmentValue, setAdjustmentValue] = useState<number>(order.adjustmentValue || 0);
    const [isSaving, setIsSaving] = useState(false);
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [seller, setSeller] = useState<User | null>(null);
    const [activeBrandingPartner, setActiveBrandingPartner] = useState<Partner | null>(null);
    const [importantObs, setImportantObs] = useState<string[]>(order.importantObs || []);

    // Bitolas Calculator State
    const [gauges, setGauges] = useState<StockGauge[]>([]);
    const [isBitolasModalOpen, setIsBitolasModalOpen] = useState(false);
    const [bitolasQuantities, setBitolasQuantities] = useState<Record<string, number>>({});
    const [bitolasMeters, setBitolasMeters] = useState<Record<string, number>>({});
    const [pieceQty, setPieceQty] = useState('');
    const [pieceName, setPieceName] = useState('broca');
    const [pieceStirrupFormat, setPieceStirrupFormat] = useState('');
    const [stirrupA, setStirrupA] = useState('');
    const [stirrupB, setStirrupB] = useState('');
    const [stirrupC, setStirrupC] = useState('');
    const [stirrupSpacing, setStirrupSpacing] = useState('');
    const [stirrupQty, setStirrupQty] = useState('');
    const [stirrupGaugeId, setStirrupGaugeId] = useState('');
    
    // 2nd stirrup (for blocos with 3 dimensions)
    const [useSecondStirrup, setUseSecondStirrup] = useState(false);
    const [pieceStirrupFormat2, setPieceStirrupFormat2] = useState('');
    const [stirrupA2, setStirrupA2] = useState('');
    const [stirrupB2, setStirrupB2] = useState('');
    const [stirrupC2, setStirrupC2] = useState('');
    const [stirrupSpacing2, setStirrupSpacing2] = useState('');
    const [stirrupQty2, setStirrupQty2] = useState('');
    const [stirrupGaugeId2, setStirrupGaugeId2] = useState('');
    const [pieceDetails, setPieceDetails] = useState<Array<{ id: string, irons: string, position: string, format?: string, sideA?: string, sideB?: string, sideC?: string, spacing?: string, size: string, gaugeId: string }>>([
        { id: '1', irons: '', position: 'principal', format: 'reto', sideA: '', sideB: '', sideC: '', spacing: '', size: '', gaugeId: '' }
    ]);
    const [blocoDimensions, setBlocoDimensions] = useState('');
    const [pieceGaugeId, setPieceGaugeId] = useState('');
    const [piecesList, setPiecesList] = useState<Array<{
        id: string, 
        qty: number, 
        name: string, 
        stirrupFormat?: string,
        stirrupA?: number,
        stirrupB?: number,
        stirrupC?: number,
        stirrupQty?: number,
        stirrupSpacing?: string,
        stirrupGaugeId?: string,
        stirrupSize?: number,
        stirrupFormat2?: string,
        stirrupA2?: number,
        stirrupB2?: number,
        stirrupC2?: number,
        stirrupQty2?: number,
        stirrupSpacing2?: string,
        stirrupGaugeId2?: string,
        stirrupSize2?: number,
        gaugeId?: string, 
        kg?: number,
        details?: Array<{irons: number, size: number, position: string, gaugeId: string, kg: number, format?: string, sideA?: number, sideB?: number, sideC?: number, spacing?: number}>
    }>>([]);
    const [customPrices, setCustomPrices] = useState<Record<string, number>>({});
    const [bitolasMode, setBitolasMode] = useState<'KG' | 'METRO' | 'PECA' | 'DESENHO'>('KG');
    const [drawingType, setDrawingType] = useState<'barra' | 'ferro_l' | 'ferro_u' | 'espiral' | 'estribo' | 'caranguejo' | 'bandeja' | 'circular' | 'custom'>('barra');
    const [drawingQty, setDrawingQty] = useState('');
    const [drawingA, setDrawingA] = useState('');
    const [drawingB, setDrawingB] = useState('');
    const [drawingC, setDrawingC] = useState('');
    const [drawingGaugeId, setDrawingGaugeId] = useState('');
    const [drawingPieces, setDrawingPieces] = useState<import('../types').DrawingPiece[]>([]);
    
    // Custom drawing state
    const [isDrawingBoardOpen, setIsDrawingBoardOpen] = useState(false);
    const [customDrawingData, setCustomDrawingData] = useState<import('../types').DrawingData | null>(null);
    const [customDimensions, setCustomDimensions] = useState<Record<string, string>>({});
    // Auth Modal para Gestor
    const [authModal, setAuthModal] = useState<{ isOpen: boolean; gaugeId: string | null }>({ isOpen: false, gaugeId: null });
    const [authPassword, setAuthPassword] = useState('');
    const [authError, setAuthError] = useState('');
    const [tempPrice, setTempPrice] = useState('');

    // Form state for new item
    const [newItem, setNewItem] = useState<Partial<CommercialOrderItem>>({
        codigo: '',
        folha: '',
        descricao: '',
        tipo: 'CORTE / DOBRA',
        peso: 0,
        valor: 0
    });

    const vergalhaoGauges = gauges.filter(g => {
        const name = (g.commercialName || g.materialType || '').toUpperCase();
        if (newItem.tipo === 'CORTE / DOBRA') return name.includes('CD VERGALH');
        if (newItem.tipo === 'ARMADO') return name.includes('AR VERGALH');
        return name.includes('VERGALH');
    });

    const [arameActive, setArameActive] = useState(false);
    const [arameGaugeId, setArameGaugeId] = useState('');
    const [aramePercentage, setAramePercentage] = useState(5);

    useEffect(() => {
        if (!arameGaugeId && gauges && gauges.length > 0) {
            const defaultArame = gauges.find(g => (g.commercialName || g.materialType || '').toUpperCase().includes('ARAME 18'));
            if (defaultArame) {
                setArameGaugeId(defaultArame.id);
            }
        }
    }, [gauges, arameGaugeId]);

    const arameGauges = gauges.filter(g => {
        const name = (g.commercialName || g.materialType || '').toUpperCase();
        return name.includes('ARAME');
    });

    const parsedQty = parseInt(pieceQty) || 0;
    
    let metrosUsados = 0;
    let currentPieceKg = 0;
    let currentPieceBreakdown: Array<{ gaugeId: string; gaugeName: string; type: string; metros: number; kg: number; price: number }> = [];

    let calculatedStirrupSize = 0;
    const sA = parseFloat(stirrupA) || 0;
    const sB = parseFloat(stirrupB) || 0;
    const sC = parseFloat(stirrupC) || 0;
    if (pieceStirrupFormat === 'quadrado') calculatedStirrupSize = sA * 4 + 10;
    if (pieceStirrupFormat === 'retangular' || pieceStirrupFormat === 'fechado') calculatedStirrupSize = sA * 2 + sB * 2 + 10;
    if (pieceStirrupFormat === 'triangular') calculatedStirrupSize = sA + sB * 2 + 10;
    if (pieceStirrupFormat === 'redondo') calculatedStirrupSize = Math.round(sA * 3.14) + 10;
    if (pieceStirrupFormat === 'sextavado') calculatedStirrupSize = sA * 6 + 10;
    if (pieceStirrupFormat === 'aberto') calculatedStirrupSize = sA + sB + sC;

    let calculatedStirrupSize2 = 0;
    const sA2 = parseFloat(stirrupA2) || 0;
    const sB2 = parseFloat(stirrupB2) || 0;
    const sC2 = parseFloat(stirrupC2) || 0;
    if (pieceStirrupFormat2 === 'quadrado') calculatedStirrupSize2 = sA2 * 4 + 10;
    if (pieceStirrupFormat2 === 'retangular' || pieceStirrupFormat2 === 'fechado') calculatedStirrupSize2 = sA2 * 2 + sB2 * 2 + 10;
    if (pieceStirrupFormat2 === 'triangular') calculatedStirrupSize2 = sA2 + sB2 * 2 + 10;
    if (pieceStirrupFormat2 === 'redondo') calculatedStirrupSize2 = Math.round(sA2 * 3.14) + 10;
    if (pieceStirrupFormat2 === 'sextavado') calculatedStirrupSize2 = sA2 * 6 + 10;
    if (pieceStirrupFormat2 === 'aberto') calculatedStirrupSize2 = sA2 + sB2 + sC2;

    if (['broca', 'viga', 'pilares', 'bloco', 'blocos'].includes((pieceName || '').toLowerCase())) {
        pieceDetails.forEach(detail => {
            const parsedIrons = parseInt(detail.irons) || 0;
            const parsedSize = parseInt(detail.size) || 0;
            const metros = (parsedQty * parsedIrons * parsedSize) / 100;
            metrosUsados += metros;
            
            if (detail.gaugeId && metros > 0) {
                const gauge = gauges.find(g => g.id === detail.gaugeId);
                if (gauge && gauge.gauge) {
                    const bitolaVal = parseFloat(String(gauge.gauge || '').replace(/[^\d.,]/g, '').replace(',', '.'));
                    if (!isNaN(bitolaVal)) {
                        const massaMetro = Math.ceil(bitolaVal * bitolaVal * 0.006162 * 1000) / 1000;
                        const kg = metros * massaMetro;
                        currentPieceKg += kg;
                        const finalPrice = customPrices[gauge.id] || gauge.basePrice || 0;
                        currentPieceBreakdown.push({
                            gaugeId: gauge.id,
                            gaugeName: `${gauge.commercialName || gauge.materialType} ${gauge.gauge}`,
                            type: `FERROS (${detail.position})`,
                            metros: metros,
                            kg: kg,
                            price: kg * finalPrice
                        });
                    }
                }
            }
        });

        if (pieceStirrupFormat && stirrupGaugeId && stirrupQty && calculatedStirrupSize > 0) {
            const parsedSQty = parseInt(stirrupQty) || 0;
            const sMetros = (parsedQty * parsedSQty * calculatedStirrupSize) / 100;
            metrosUsados += sMetros;
            
            const gauge = gauges.find(g => g.id === stirrupGaugeId);
            if (gauge && gauge.gauge) {
                const bitolaVal = parseFloat(String(gauge.gauge || '').replace(/[^\d.,]/g, '').replace(',', '.'));
                if (!isNaN(bitolaVal)) {
                    const massaMetro = Math.ceil(bitolaVal * bitolaVal * 0.006162 * 1000) / 1000;
                    const kg = sMetros * massaMetro;
                    currentPieceKg += kg;
                    const finalPrice = customPrices[gauge.id] || gauge.basePrice || 0;
                    currentPieceBreakdown.push({
                        gaugeId: gauge.id,
                        gaugeName: `${gauge.commercialName || gauge.materialType} ${gauge.gauge}`,
                        type: `ESTRIBOS (${pieceStirrupFormat})`,
                        metros: sMetros,
                        kg: kg,
                        price: kg * finalPrice
                    });
                }
            }
        }
        
        if (useSecondStirrup && pieceStirrupFormat2 && stirrupGaugeId2 && stirrupQty2 && calculatedStirrupSize2 > 0) {
            const parsedSQty2 = parseInt(stirrupQty2) || 0;
            const sMetros2 = (parsedQty * parsedSQty2 * calculatedStirrupSize2) / 100;
            metrosUsados += sMetros2;
            
            const gauge2 = gauges.find(g => g.id === stirrupGaugeId2);
            if (gauge2 && gauge2.gauge) {
                const bitolaVal2 = parseFloat(String(gauge2.gauge || '').replace(/[^\d.,]/g, '').replace(',', '.'));
                if (!isNaN(bitolaVal2)) {
                    const massaMetro2 = Math.ceil(bitolaVal2 * bitolaVal2 * 0.006162 * 1000) / 1000;
                    const kg2 = sMetros2 * massaMetro2;
                    currentPieceKg += kg2;
                    const finalPrice2 = customPrices[gauge2.id] || gauge2.basePrice || 0;
                    currentPieceBreakdown.push({
                        gaugeId: gauge2.id,
                        gaugeName: `${gauge2.commercialName || gauge2.materialType} ${gauge2.gauge}`,
                        type: `ESTRIBOS (${pieceStirrupFormat2}) [2º]`,
                        metros: sMetros2,
                        kg: kg2,
                        price: kg2 * finalPrice2
                    });
                }
            }
        }
    } else if (pieceGaugeId) {
        // Fallback for simple piece types like blocos
        const gauge = gauges.find(g => g.id === pieceGaugeId);
    }

    if (newItem.tipo === 'ARMADO' && arameGaugeId && aramePercentage > 0 && currentPieceKg > 0) {
        const arameKgForPiece = currentPieceKg * (aramePercentage / 100);
        const gauge = gauges.find(g => g.id === arameGaugeId);
        if (gauge) {
            const finalPrice = customPrices[gauge.id] || gauge.basePrice || 0;
            currentPieceBreakdown.push({
                gaugeId: gauge.id,
                gaugeName: `${gauge.commercialName || gauge.materialType} ${gauge.gauge}`,
                type: `ARAME (${aramePercentage}%)`,
                metros: 0,
                kg: arameKgForPiece,
                price: arameKgForPiece * finalPrice
            });
        }
    }

    const handleSearchClient = async () => {
        setSearchClientError('');
        setClientSearchResult(null);
        if (!clientSearchTerm.trim()) {
            setSearchClientError('Digite algo para buscar.');
            return;
        }

        const term = clientSearchTerm.toLowerCase().trim();
        
        if (term === '1001' || term === 'consumidor balcao' || term === 'consumidor balcão') {
            setClientSearchResult({
                id: '1001',
                code: '1001',
                name: 'CONSUMIDOR BALCAO',
                customerType: 'Pessoa Física',
                document1: '000.000.000-00',
                document2: '',
                phone: '',
                email: '',
                addressMain: '',
                addressDelivery: '',
                addressBilling: '',
                createdAt: new Date().toISOString()
            });
            return;
        }

        try {
            const customers = await fetchTable<Customer>('customers');
            const found = customers.find(c => 
                (c.code && c.code.toLowerCase() === term) ||
                (c.name && c.name.toLowerCase().includes(term)) ||
                (c.document1 && c.document1.replace(/\D/g, '') === term.replace(/\D/g, '')) ||
                (c.document2 && c.document2.toLowerCase().includes(term))
            );

            if (found) {
                setClientSearchResult(found);
            } else {
                setSearchClientError('Cliente não encontrado.');
            }
        } catch (error) {
            console.error('Error fetching customers:', error);
            setSearchClientError('Erro ao buscar cliente.');
        }
    };

    const handleConfirmClientChange = () => {
        if (clientSearchResult) {
            setClientCode(clientSearchResult.code || '1001');
            setClientName(clientSearchResult.name || '');
            setClientCity(clientSearchResult.addressMain || '');
            setIsSearchingClient(false);
            setClientSearchResult(null);
            setClientSearchTerm('');
        }
    };

    const loadItems = async () => {
        if (!order.id) return;
        setIsLoading(true);
        try {
            const data = await fetchItems('commercial_order_items', '*', { column: 'order_id', value: order.id });
            setItems(data as unknown as CommercialOrderItem[]);
            
            const gaugesData = await fetchTable<StockGauge>('stock_gauges');
            // Filter only active gauges if you want, or just show all
            setGauges(gaugesData.filter(g => g.status !== 'Inativo'));
            
            if (order.salesperson) {
                try {
                    const allUsers = await fetchTable<User>('app_users');
                    const matchedUser = allUsers.find(u => u.username?.toLowerCase() === order.salesperson?.toLowerCase());
                    if (matchedUser) setSeller(matchedUser);
                } catch (e) {
                    console.error('Error fetching seller', e);
                }
            }
            
            try {
                const { data } = await supabase.from('system_settings').select('value').eq('key', 'payment_fees').single();
                if (data && data.value) {
                    setPaymentFees(data.value as any);
                }
            } catch (e) {
                console.error('Error fetching payment fees', e);
            }
            
            try {
                const partners = await fetchTable<Partner>('partners');
                const active = partners.find(p => p.isActiveBranding) || (partners.length > 0 ? partners[0] : null);
                if (active) setActiveBrandingPartner(active);
            } catch (e) {
                console.error('Error fetching partner', e);
            }
        } catch (error) {
            console.error('Error loading items:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadItems();
    }, [order.id]);

    const saveCurrentItem = async (itemData: typeof newItem, bitolasData: any) => {
        if (!order.id) return;
        try {
            const itemToSave = {
                order_id: order.id,
                codigo: itemData.codigo!,
                folha: itemData.folha!,
                descricao: itemData.descricao!,
                tipo: itemData.tipo!,
                peso: itemData.peso!,
                valor: itemData.valor!,
                bitolas_details: Object.keys(bitolasData).length > 0 ? bitolasData : undefined,
                custom_prices: Object.keys(customPrices).length > 0 ? customPrices : undefined
            };
            
            if (editingItemId) {
                await updateItem('commercial_order_items', editingItemId, itemToSave);
                setEditingItemId(null);
            } else {
                await insertItem<CommercialOrderItem>('commercial_order_items', itemToSave);
            }
            
            setNewItem({
                codigo: '',
                folha: '',
                descricao: '',
                tipo: 'CORTE / DOBRA',
                peso: 0,
                valor: 0
            });
            setBitolasQuantities({});
            setPiecesList([]);
            setDrawingPieces([]);
            setCustomPrices({});
            await loadItems();
        } catch (error) {
            console.error('Error adding item:', error);
            alert('Erro ao salvar item.');
        }
    };

    const handleAddItem = async (e: React.FormEvent) => {
        e.preventDefault();
        await saveCurrentItem(newItem, bitolasQuantities);
    };

    const handleEditItem = (item: CommercialOrderItem) => {
        if (!item.id) return;
        setEditingItemId(item.id);
        setNewItem({
            codigo: item.codigo,
            folha: item.folha,
            descricao: item.descricao,
            tipo: item.tipo,
            peso: item.peso,
            valor: item.valor
        });
        
        const bitolasDetails = (item as any).bitolasDetails || item.bitolas_details;
        if (bitolasDetails) {
            setBitolasQuantities(bitolasDetails);
            if (bitolasDetails['pecas']) {
                setPiecesList(bitolasDetails['pecas']);
            } else {
                setPiecesList([]);
            }
            if (bitolasDetails['drawings']) {
                setDrawingPieces(bitolasDetails['drawings']);
            } else {
                setDrawingPieces([]);
            }
        } else {
            setBitolasQuantities({});
            setPiecesList([]);
            setDrawingPieces([]);
        }

        const customPricesData = (item as any).customPrices || item.custom_prices;
        if (customPricesData) {
            setCustomPrices(customPricesData);
        } else {
            setCustomPrices({});
        }
        
        // Scroll to top where the form is
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDeleteItem = async (itemId: string) => {
        if (!confirm('Excluir este item?')) return;
        try {
            await deleteItem('commercial_order_items', itemId);
            await loadItems();
        } catch (error) {
            console.error('Error deleting item:', error);
        }
    };

    const totalWeight = items.reduce((acc, item) => acc + (item.peso || 0), 0);
    const baseItemsValue = items.reduce((acc, item) => acc + (item.valor || 0), 0);
    const multiplier = 1 + ((adjustmentPercentage || 0) / 100);
    const totalValue = (baseItemsValue * multiplier) + freightValue;

    const handleAdjustmentPercentageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const valStr = e.target.value.replace(',', '.');
        const pct = parseFloat(valStr);
        if (isNaN(pct)) {
            setAdjustmentPercentage(0);
            setAdjustmentValue(0);
            return;
        }
        setAdjustmentPercentage(pct);
        setAdjustmentValue(baseItemsValue * (pct / 100));
    };

    const handleAdjustmentValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const valStr = e.target.value.replace(',', '.');
        const val = parseFloat(valStr);
        if (isNaN(val)) {
            setAdjustmentValue(0);
            setAdjustmentPercentage(0);
            return;
        }
        setAdjustmentValue(val);
        if (baseItemsValue > 0) {
            setAdjustmentPercentage((val / baseItemsValue) * 100);
        } else {
            setAdjustmentPercentage(0);
        }
    };

    // Compute bitolas summary
    const bitolasSummary: Record<string, { kg: number }> = {};
    items.forEach(item => {
        const bitolasDetails = (item as any).bitolasDetails || item.bitolas_details;
        if (bitolasDetails) {
            Object.entries(bitolasDetails).forEach(([bitolaId, kg]) => {
                if (bitolaId === 'pecas') return;
                const kgNum = Number(kg) || 0;
                if (kgNum > 0) {
                    if (!bitolasSummary[bitolaId]) {
                        bitolasSummary[bitolaId] = { kg: 0 };
                    }
                    bitolasSummary[bitolaId].kg += kgNum;
                }
            });
        }
    });

    const summaryRows = Object.keys(bitolasSummary).map(bitolaId => {
        const gauge = gauges.find(g => g.id === bitolaId);
        const kg = bitolasSummary[bitolaId].kg;
        const desc = gauge ? `AÇO CORTADO/DOBRADO ${gauge.commercialName || gauge.materialType} - ${gauge.gauge}` : 'AÇO DESCONHECIDO';
        
        const pesoUnitario = gauge?.rawWeightValue || 1;
        const barras = kg / pesoUnitario;
        
        const basePricePerKg = (gauge?.rawWeightValue && gauge.rawWeightValue > 0 && gauge?.weightType === 'unid') 
            ? (gauge.purchasePrice || 0) / gauge.rawWeightValue 
            : (gauge?.purchasePrice || 0);
            
        const rawPricePerKg = customPrices[bitolaId] !== undefined ? customPrices[bitolaId] : basePricePerKg;
        const pricePerKg = rawPricePerKg * multiplier;

        const pricePerBarra = gauge?.purchasePrice || 0;
        const total = kg * pricePerKg;

        return {
            id: gauge?.productCode || bitolaId.substring(0, 4).toUpperCase(),
            desc,
            barras: isFinite(barras) ? barras : 0,
            pricePerBarra,
            kg,
            pricePerKg,
            total,
            isFreight: false
        };
    }).sort((a, b) => b.kg - a.kg); // Sort by weight for example

    if (freight || freightValue) {
        summaryRows.push({
            id: '0100',
            desc: `FRETE${freight ? ` - ${freight}` : ''}`,
            barras: 0,
            pricePerBarra: 0,
            kg: 1,
            pricePerKg: 0,
            total: freightValue || 0,
            isFreight: true
        });
    }

    const totalSummaryKg = summaryRows.filter(r => !r.isFreight).reduce((acc, r) => acc + r.kg, 0);
    const totalSummaryRs = summaryRows.reduce((acc, r) => acc + r.total, 0);

    const handleSaveOrder = async () => {
        if (!order.id) return;
        setIsSaving(true);
        try {
            // Update the main order with totals and metadata
            const statusToSave = totalValue > 0 ? (order.status.toLowerCase().includes('incompleto') ? 'Orçamento' : order.status) : order.status;
            
            const newHistoryEntry = {
                date: new Date().toISOString(),
                user: order.salesperson || 'SISTEMA',
                action: 'Orçamento atualizado',
                details: `Valor total: R$ ${totalValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})} | Peso: ${totalWeight.toLocaleString('pt-BR', {minimumFractionDigits: 2})} kg | Status: ${statusToSave}`
            };
            const updatedHistory = [...(order.history || []), newHistoryEntry];

            await updateItem('commercial_orders', order.id, {
                projectIdent: projectIdent,
                clientCode: clientCode,
                clientName: clientName,
                clientCity: clientCity,
                delivery_time: deliveryTime,
                paymentCondition: paymentCondition,
                freight: freight,
                freight_value: freightValue,
                adjustment_percentage: adjustmentPercentage,
                adjustment_value: adjustmentValue,
                totalWeight: totalWeight,
                price: totalValue, // Update main price
                status: statusToSave,
                history: updatedHistory,
                important_obs: importantObs
            });
            onSaveSuccess();
            onClose();
        } catch (error) {
            console.error('Error saving order:', error);
            alert('Erro ao salvar orçamento.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleConfirmBitolas = () => {
        let totalKg = 0;
        let totalRs = 0;
        let finalQuantities = { ...bitolasQuantities };
        let updatedFolha = newItem.folha || '';
        let updatedDescricao = newItem.descricao || '';

        if (bitolasMode === 'PECA') {
            let effectivePieces = [...piecesList];
            
            if (pieceQty && parseInt(pieceQty) > 0) {
                const isComplex = ['broca', 'viga', 'pilares', 'bloco', 'blocos'].includes((pieceName || '').toLowerCase());
                if (isComplex && !pieceStirrupFormat) {
                    alert('O Formato do Estribo é obrigatório!');
                    return;
                }
                const isBloco = ['bloco', 'blocos'].includes((pieceName || '').toLowerCase());
                if (isBloco && useSecondStirrup && !pieceStirrupFormat2) {
                    alert('O Formato do 2º Estribo é obrigatório!');
                    return;
                }
                
                effectivePieces.push({
                    id: Date.now().toString(),
                    qty: parseInt(pieceQty),
                    name: isBloco && blocoDimensions ? `${pieceName} ${blocoDimensions}` : pieceName,
                    stirrupFormat: isComplex && pieceStirrupFormat ? pieceStirrupFormat : undefined,
                    stirrupA: sA > 0 ? sA : undefined,
                    stirrupB: sB > 0 ? sB : undefined,
                    stirrupQty: parseInt(stirrupQty) || undefined,
                    stirrupSpacing: stirrupSpacing || undefined,
                    stirrupGaugeId: stirrupGaugeId || undefined,
                    stirrupSize: calculatedStirrupSize > 0 ? calculatedStirrupSize : undefined,
                    stirrupFormat2: isComplex && useSecondStirrup && pieceStirrupFormat2 ? pieceStirrupFormat2 : undefined,
                    stirrupA2: sA2 > 0 ? sA2 : undefined,
                    stirrupB2: sB2 > 0 ? sB2 : undefined,
                    stirrupQty2: parseInt(stirrupQty2) || undefined,
                    stirrupSpacing2: stirrupSpacing2 || undefined,
                    stirrupGaugeId2: stirrupGaugeId2 || undefined,
                    stirrupSize2: calculatedStirrupSize2 > 0 ? calculatedStirrupSize2 : undefined,
                    gaugeId: !isComplex ? (pieceGaugeId || undefined) : undefined,
                    kg: currentPieceKg > 0 ? currentPieceKg : undefined,
                    details: isComplex ? pieceDetails.map(d => ({
                        irons: parseInt(d.irons) || 0,
                        size: parseInt(d.size) || 0,
                        position: d.position,
                        format: d.format || 'reto',
                        sideA: parseFloat(d.sideA || '0') || undefined,
                        sideB: parseFloat(d.sideB || '0') || undefined,
                        sideC: parseFloat(d.sideC || '0') || undefined,
                        gaugeId: d.gaugeId,
                        kg: 0
                    })).filter(d => d.irons > 0 && d.size > 0) : undefined
                });
                setPiecesList(effectivePieces);
                setPieceQty('');
                setPieceStirrupFormat('');
                setStirrupSpacing('');
                setStirrupA('');
                setStirrupB('');
                setStirrupQty('');
                setStirrupGaugeId('');
                setPieceGaugeId('');
                setUseSecondStirrup(false);
                setPieceStirrupFormat2('');
                setStirrupA2('');
                setStirrupB2('');
                setStirrupSpacing2('');
                setStirrupQty2('');
                setStirrupGaugeId2('');
                setPieceDetails([{ id: Date.now().toString(), irons: '', position: 'principal', size: '', gaugeId: '' }]);
            }

            finalQuantities = {};
            effectivePieces.forEach(p => {
                if (['broca', 'viga', 'pilares', 'bloco', 'blocos'].some(t => (p.name || '').toLowerCase().includes(t))) {
                    if (p.details && p.details.length > 0) {
                        p.details.forEach(d => {
                            const gauge = gauges.find(g => g.id === d.gaugeId);
                            if (gauge && gauge.gauge) {
                                const dMetros = (p.qty * d.irons * d.size) / 100;
                                const bitolaVal = parseFloat(String(gauge.gauge || '').replace(/[^\d.,]/g, '').replace(',', '.'));
                                if (!isNaN(bitolaVal)) {
                                    const massaMetro = Math.ceil(bitolaVal * bitolaVal * 0.006162 * 1000) / 1000;
                                    const kg = dMetros * massaMetro;
                                    finalQuantities[gauge.id] = (finalQuantities[gauge.id] || 0) + kg;
                                }
                            }
                        });
                    }
                    if (p.stirrupFormat && p.stirrupGaugeId && p.stirrupQty && p.stirrupSize && p.stirrupSize > 0) {
                        const gauge = gauges.find(g => g.id === p.stirrupGaugeId);
                        if (gauge && gauge.gauge) {
                            const sMetros = (p.qty * p.stirrupQty * p.stirrupSize) / 100;
                            const bitolaVal = parseFloat(String(gauge.gauge || '').replace(/[^\d.,]/g, '').replace(',', '.'));
                            if (!isNaN(bitolaVal)) {
                                const massaMetro = Math.ceil(bitolaVal * bitolaVal * 0.006162 * 1000) / 1000;
                                const kg = sMetros * massaMetro;
                                finalQuantities[gauge.id] = (finalQuantities[gauge.id] || 0) + kg;
                            }
                        }
                    }
                    if (p.stirrupFormat2 && p.stirrupGaugeId2 && p.stirrupQty2 && p.stirrupSize2 && p.stirrupSize2 > 0) {
                        const gauge = gauges.find(g => g.id === p.stirrupGaugeId2);
                        if (gauge && gauge.gauge) {
                            const sMetros = (p.qty * p.stirrupQty2 * p.stirrupSize2) / 100;
                            const bitolaVal = parseFloat(String(gauge.gauge || '').replace(/[^\d.,]/g, '').replace(',', '.'));
                            if (!isNaN(bitolaVal)) {
                                const massaMetro = Math.ceil(bitolaVal * bitolaVal * 0.006162 * 1000) / 1000;
                                const kg = sMetros * massaMetro;
                                finalQuantities[gauge.id] = (finalQuantities[gauge.id] || 0) + kg;
                            }
                        }
                    }
                } else if (p.gaugeId && p.kg) {
                    finalQuantities[p.gaugeId] = (finalQuantities[p.gaugeId] || 0) + p.kg;
                }
            });
            if (effectivePieces.length > 0) {
                finalQuantities['pecas'] = effectivePieces as any;
            }

            if (effectivePieces.length > 0) {
                const piecesText = effectivePieces.map(p => {
                    let parts = [];
                    let nameAndFormat = p.name || '';
                    if (p.stirrupFormat) {
                        let format = p.stirrupFormat;
                        if (nameAndFormat.toLowerCase() === 'broca' && format === 'quadrado') format = 'quadrada';
                        if (nameAndFormat.toLowerCase() === 'broca' && format === 'retangular') format = 'retangular';
                        if (nameAndFormat.toLowerCase() === 'broca' && format === 'redondo') format = 'redonda';
                        if (nameAndFormat.toLowerCase() === 'broca' && format === 'sextavado') format = 'sextavada';
                        
                        let dimText = '';
                        if (format.includes('quadrad')) {
                            dimText = `${p.stirrupA || 0}X${p.stirrupA || 0}`;
                        } else if (format.includes('retangular') || format.includes('triangular') || format.includes('fechado')) {
                            dimText = `${p.stirrupA || 0}X${p.stirrupB || 0}`;
                        } else if (format.includes('aberto')) {
                            dimText = `${p.stirrupA || 0}X${p.stirrupB || 0}X${p.stirrupC || 0}`;
                        } else if (format.includes('redond')) {
                            dimText = `∅ (${p.stirrupA || 0})`;
                        } else if (format.includes('sextavad')) {
                            dimText = `(${p.stirrupA || 0})`;
                        }
                        
                        if (!['bloco', 'blocos'].some(t => (p.name || '').toLowerCase().includes(t))) {
                            nameAndFormat = `${nameAndFormat} ${format} ${dimText}`.trim();
                        } else {
                            nameAndFormat = nameAndFormat.replace(/^(BLOCO(?:S)?)\b/i, `$1 ${format}`);
                        }
                    }
                    parts.push(nameAndFormat.toUpperCase());
                    
                    if (['broca', 'viga', 'pilares', 'bloco', 'blocos'].some(t => (p.name || '').toLowerCase().includes(t)) && p.details && p.details.length > 0) {
                        const ironsArr = p.details.map(d => {
                            let gaugeName = '';
                            if (d.gaugeId) {
                                const gauge = gauges.find(g => g.id === d.gaugeId);
                                if (gauge) {
                                    const num = parseFloat((gauge.gauge || '').replace(',', '.').replace(/[^\d.]/g, ''));
                                    if (!isNaN(num)) {
                                        gaugeName = `${num}mm`;
                                    }
                                }
                            }
                            if (d.format?.includes('estribo')) {
                                const spaceText = d.spacing ? `C/${(d.spacing / 100).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}m` : `Tam ${d.size}cm`;
                                return `${d.irons} EST ∅${gaugeName} ${spaceText}`.trim();
                            } else {
                                let sizeText = `${d.size}cm`;
                                if (d.format === '1-dobra' && d.sideA && d.sideB) {
                                    sizeText = `${d.sideA}cm+${d.sideB}cm`;
                                } else if (d.format === '2-dobras' && d.sideC && d.sideA && d.sideB) {
                                    sizeText = `${d.sideC}cm+${d.sideA}cm+${d.sideB}cm`;
                                } else if (d.format === 'reto' && d.sideA) {
                                    sizeText = `${d.sideA}cm`;
                                }
                                return `${d.irons}∅ ${gaugeName} C/${sizeText}`.trim();
                            }
                        });
                        parts.push(ironsArr.join(', '));
                    }
                    
                    if (p.stirrupFormat && p.stirrupGaugeId) {
                        let gaugeName = '';
                        const gauge = gauges.find(g => g.id === p.stirrupGaugeId);
                        if (gauge) {
                            const num = parseFloat((gauge.gauge || '').replace(',', '.').replace(/[^\d.]/g, ''));
                            if (!isNaN(num)) {
                                gaugeName = `${num.toLocaleString('pt-BR')}mm`;
                            }
                        }
                        
                        let spacingMeters = p.stirrupSpacing;
                        if (p.stirrupSpacing) {
                            const spacingNum = parseFloat(p.stirrupSpacing.replace(',', '.'));
                            if (!isNaN(spacingNum)) {
                                spacingMeters = (spacingNum / 100).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
                            }
                        }
                        
                        let spacingText = p.stirrupSpacing ? `c/${spacingMeters}m` : (p.stirrupQty ? `${p.stirrupQty}un` : '');
                        let prefix = p.stirrupQty && p.stirrupSpacing ? `${p.stirrupQty} ` : '';
                        let isBloco = ['bloco', 'blocos'].some(t => (p.name || '').toLowerCase().includes(t));
                        
                        if (isBloco) {
                            parts.push(`${prefix}EST. ∅${gaugeName.toLowerCase()} ${spacingText.toLowerCase()}`.trim());
                        } else {
                            parts.push(`EST. ∅${gaugeName} ${p.stirrupSpacing ? `C/${spacingMeters}m` : (p.stirrupQty ? `${p.stirrupQty}un` : '')}`.trim());
                        }
                    }
                    
                    if (p.stirrupFormat2 && p.stirrupGaugeId2) {
                        let gaugeName2 = '';
                        const gauge2 = gauges.find(g => g.id === p.stirrupGaugeId2);
                        if (gauge2) {
                            const num2 = parseFloat((gauge2.gauge || '').replace(',', '.').replace(/[^\d.]/g, ''));
                            if (!isNaN(num2)) {
                                gaugeName2 = `${num2.toLocaleString('pt-BR')}mm`;
                            }
                        }
                        
                        let spacingMeters2 = p.stirrupSpacing2;
                        if (p.stirrupSpacing2) {
                            const spacingNum2 = parseFloat(p.stirrupSpacing2.replace(',', '.'));
                            if (!isNaN(spacingNum2)) {
                                spacingMeters2 = (spacingNum2 / 100).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
                            }
                        }
                        
                        let spacingText2 = p.stirrupSpacing2 ? `c/${spacingMeters2}m` : (p.stirrupQty2 ? `${p.stirrupQty2}un` : '');
                        let prefix2 = p.stirrupQty2 && p.stirrupSpacing2 ? `${p.stirrupQty2} ` : '';
                        let isBloco2 = ['bloco', 'blocos'].some(t => (p.name || '').toLowerCase().includes(t));
                        
                        if (isBloco2) {
                            parts.push(`${prefix2}EST. ∅${gaugeName2.toLowerCase()} ${spacingText2.toLowerCase()}`.trim());
                        } else {
                            parts.push(`EST. ∅${gaugeName2} ${p.stirrupSpacing2 ? `C/${spacingMeters2}m` : (p.stirrupQty2 ? `${p.stirrupQty2}un` : '')}`.trim());
                        }
                    }
                    
                    return parts.join(', ');
                }).join(' + ');

                const totalQty = effectivePieces.reduce((acc, p) => acc + p.qty, 0);

                if (newItem.codigo === 'DETALHADO') {
                    updatedFolha = totalQty.toString();
                    updatedDescricao = piecesText;
                } else {
                    let newDesc = updatedDescricao || '';
                    if (newDesc.includes(' --- PEÇAS: ')) {
                        newDesc = newDesc.split(' --- PEÇAS: ')[0];
                    }
                    updatedDescricao = `${newDesc} --- PEÇAS: ${piecesText}`;
                }
            }
            // Do NOT return here, let it fall through to calculate totalKg and totalRs from finalQuantities
        }

        if (bitolasMode === 'METRO') {
            finalQuantities = {};
            Object.entries(bitolasMeters).forEach(([bitolaId, mValue]) => {
                const meters = mValue as number;
                if (meters > 0) {
                    const gauge = gauges.find(g => g.id === bitolaId);
                    if (gauge && gauge.gauge) {
                        const bitolaVal = parseFloat(String(gauge.gauge || '').replace(/[^\d.,]/g, '').replace(',', '.'));
                        if (!isNaN(bitolaVal)) {
                            // Arredondando para cima 3 casas decimais
                            const massaMetro = Math.ceil(bitolaVal * bitolaVal * 0.006162 * 1000) / 1000;
                            finalQuantities[bitolaId] = meters * massaMetro;
                        }
                    }
                }
            });
        }
        
        if (bitolasMode === 'DESENHO') {
            finalQuantities = {};
            let effectiveDrawingPieces = [...drawingPieces];
            
            const qty = parseInt(drawingQty) || 0;
            if (qty > 0 && drawingGaugeId) {
                const a = parseFloat(drawingA) || 0;
                const b = parseFloat(drawingB) || 0;
                const c = parseFloat(drawingC) || 0;
                
                let totalSize = 0;
                let dimensionsMap: Record<string, number> = {};
                
                if (drawingType === 'custom') {
                    if (customDrawingData && customDrawingData.labels && customDrawingData.labels.length > 0) {
                        customDrawingData.labels.forEach(l => {
                            const val = parseFloat(customDimensions[l.text]) || 0;
                            totalSize += val;
                            dimensionsMap[l.text] = val;
                        });
                    }
                } else {
                    if (drawingType === 'barra' || drawingType === 'circular') {
                        totalSize = drawingType === 'circular' ? (a * 3.14) + 10 : a;
                    } else if (drawingType === 'ferro_l' || drawingType === 'estribo') {
                        totalSize = drawingType === 'estribo' ? (a * 2 + b * 2) + 10 : (a + b);
                    } else if (drawingType === 'ferro_u') {
                        totalSize = a + b + c;
                    } else if (drawingType === 'caranguejo') {
                        totalSize = (a * 2) + b + (c * 2);
                    } else if (drawingType === 'bandeja') {
                        totalSize = a + (b * 2) + (c * 2);
                    } else if (drawingType === 'espiral') {
                        const numEspiras = b > 0 ? c / b : 0;
                        const compEspira = Math.sqrt(Math.pow(Math.PI * a, 2) + Math.pow(b, 2));
                        totalSize = numEspiras * compEspira;
                    }
                }
                
                const gauge = gauges.find(g => g.id === drawingGaugeId);
                let kg = 0;
                if (gauge && gauge.gauge && totalSize > 0) {
                    const bitolaVal = parseFloat(String(gauge.gauge || '').replace(/[^\d.,]/g, '').replace(',', '.'));
                    if (!isNaN(bitolaVal)) {
                        const massaMetro = Math.ceil(bitolaVal * bitolaVal * 0.006162 * 1000) / 1000;
                        kg = (qty * totalSize / 100) * massaMetro;
                    }
                }

                const newPiece = {
                    id: Date.now().toString(),
                    type: drawingType,
                    qty,
                    gaugeId: drawingGaugeId,
                    a: drawingType !== 'custom' ? a : undefined,
                    b: drawingType !== 'custom' ? b : undefined,
                    c: drawingType !== 'custom' ? c : undefined,
                    dimensions: drawingType === 'custom' ? dimensionsMap : undefined,
                    customData: drawingType === 'custom' ? customDrawingData : undefined,
                    totalSize,
                    kg,
                };
                
                effectiveDrawingPieces.push(newPiece);
                setDrawingPieces(effectiveDrawingPieces);
                
                setDrawingQty('');
                setDrawingA('');
                setDrawingB('');
                setDrawingC('');
                setDrawingGaugeId('');
                setCustomDimensions({});
            }

            if (effectiveDrawingPieces.length > 0) {
                finalQuantities['drawings'] = effectiveDrawingPieces as any;
                effectiveDrawingPieces.forEach(p => {
                    finalQuantities[p.gaugeId] = (finalQuantities[p.gaugeId] || 0) + p.kg;
                });
                
                const drawingsText = effectiveDrawingPieces.map(p => {
                    const gauge = gauges.find(g => g.id === p.gaugeId);
                    let gaugeStr = '';
                    if (gauge) {
                        const num = parseFloat((gauge.gauge || '').replace(',', '.').replace(/[^\d.]/g, ''));
                        if (!isNaN(num)) {
                            gaugeStr = `∅ ${num}mm`;
                        } else {
                            gaugeStr = gauge.commercialName || gauge.materialType || '';
                        }
                    }
                    
                    const shapeName = p.type === 'custom' ? 'PERSONALIZADO' : p.type.replace('_', ' ').toUpperCase();
                    const desc = p.type === 'custom' 
                            ? Object.entries(p.dimensions || {}).map(([key, val]) => `${key}:${val}`).join(' ') 
                            : (p.a ? `A:${p.a} ` : '') + (p.b ? `B:${p.b} ` : '') + (p.c ? `C:${p.c}` : '');
                    
                    return `${p.qty} PEÇAS (${shapeName} ${desc.trim()}), ${gaugeStr}`;
                }).join(' + ');
                
                let newDesc = updatedDescricao || '';
                if (newDesc.includes(' --- DESENHOS: ')) {
                    newDesc = newDesc.split(' --- DESENHOS: ')[0];
                }
                updatedDescricao = `${newDesc} --- DESENHOS: ${drawingsText}`;
            }
        }

        const isArmado = newItem.tipo === 'ARMADO';
        
        if (isArmado && (!arameGaugeId || aramePercentage <= 0)) {
            alert('Para itens do tipo ARMADO, é obrigatório selecionar o Arame e a Porcentagem.');
            return;
        }

        if (isArmado && arameGaugeId && aramePercentage > 0) {
            let tempTotal = 0;
            Object.entries(finalQuantities).forEach(([bId, kgVal]) => {
                if (bId !== 'pecas' && bId !== 'drawings') {
                    const isArame = arameGauges.some(a => a.id === bId);
                    if (!isArame) {
                        tempTotal += (kgVal as number) || 0;
                    }
                }
            });
            if (tempTotal > 0) {
                const aKg = tempTotal * (aramePercentage / 100);
                finalQuantities[arameGaugeId] = (finalQuantities[arameGaugeId] || 0) + aKg;
            }
        }
        
        Object.entries(finalQuantities).forEach(([bitolaId, kgValue]) => {
            if (bitolaId === 'pecas' || bitolaId === 'drawings') return;
            const kg = kgValue as number;
            if (kg > 0) {
                const gauge = gauges.find(g => g.id === bitolaId);
                if (gauge) {
                    const pricePerKg = (gauge.rawWeightValue && gauge.rawWeightValue > 0 && gauge.weightType === 'unid') 
                        ? (gauge.purchasePrice || 0) / gauge.rawWeightValue 
                        : (gauge.purchasePrice || 0);
                        
                    totalKg += kg;
                    totalRs += (kg * pricePerKg);
                }
            }
        });
        
        setBitolasQuantities({...finalQuantities});
        
        const finalItemToSave = {
            ...newItem,
            folha: updatedFolha,
            descricao: updatedDescricao,
            peso: totalKg,
            valor: totalRs
        };

        setNewItem(finalItemToSave);
        setIsBitolasModalOpen(false);
        saveCurrentItem(finalItemToSave, finalQuantities);
    };

    const liveOrder: CommercialOrder = {
        ...order,
        importantObs,
        projectIdent,
        clientName,
        clientCode,
        clientCity,
        deliveryTime,
        paymentCondition,
        freight,
        freightValue,
        adjustmentPercentage,
        adjustmentValue
    };
    
    const liveCustomer = clientSearchResult || {
        id: clientCode,
        code: clientCode,
        name: clientName,
        document1: '',
        customerType: 'Pessoa Física' as const,
        addressMain: clientCity
    } as Customer;

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4 md:p-8 animate-in fade-in">
            <div className="bg-slate-50 w-[98vw] h-[95vh] rounded-xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
                {/* Header */}
                <div className="bg-white px-8 py-5 flex justify-between items-center shrink-0 border-b border-slate-200">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                            Edição de Orçamento <span className="text-slate-400 font-normal">#{order.orderNumber}</span>
                        </h2>
                        <div className="text-slate-400 font-bold text-xs mt-2 flex items-center gap-2 uppercase tracking-wider">
                            <span className="text-blue-500">🏠 Orçamentos</span> <span>&gt;</span> <span className="text-blue-500">Edição</span>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-5 py-2 border border-slate-200 rounded-lg font-bold text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-2 shadow-sm text-sm">
                            ✕ Cancelar
                        </button>
                        <button 
                            onClick={handleSaveOrder} 
                            disabled={isSaving}
                            className="px-6 py-2 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all flex items-center gap-2 shadow-md shadow-blue-600/20 disabled:opacity-50 text-sm"
                        >
                            {isSaving ? 'Salvando...' : '✓ Salvar Orçamento'}
                        </button>
                    </div>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* Coluna Esquerda: Formulário */}
                    <div className="w-1/2 p-8 overflow-y-auto space-y-6 border-r border-slate-200">
                        
                        {/* Header Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
                                👤
                            </div>
                            {isSearchingClient ? (
                                <div className="flex-1 w-full relative z-10">
                                    <div className="font-bold text-slate-400 text-[10px] uppercase tracking-widest mb-1">Buscar Cliente</div>
                                    <div className="flex gap-2 mb-2">
                                        <input 
                                            type="text" 
                                            className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold w-full uppercase bg-slate-50 focus:bg-white focus:border-blue-500 focus:outline-none"
                                            value={clientSearchTerm}
                                            onChange={e => setClientSearchTerm(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleSearchClient()}
                                            placeholder="CÓDIGO, NOME, CPF/CNPJ..."
                                        />
                                        <button onClick={handleSearchClient} className="bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold">Buscar</button>
                                        <button onClick={() => { setIsSearchingClient(false); setClientSearchResult(null); setSearchClientError(''); }} className="text-slate-500 hover:text-red-500 px-2 py-1.5 text-xs font-bold">Cancelar</button>
                                    </div>
                                    {searchClientError && <div className="text-red-500 text-[10px] font-bold mb-2">{searchClientError}</div>}
                                    {clientSearchResult && (
                                        <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg mb-2 shadow-sm animate-in fade-in">
                                            <div className="text-xs font-bold text-emerald-800">({clientSearchResult.code}) {clientSearchResult.name}</div>
                                            <div className="text-[10px] font-semibold text-emerald-600 mt-0.5">{clientSearchResult.addressMain || 'Sem endereço cadastrado'}</div>
                                            <button onClick={handleConfirmClientChange} className="mt-2 w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-1.5 rounded transition-colors shadow-sm">Confirmar Troca</button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="font-bold text-slate-400 text-[10px] uppercase tracking-widest">Cliente</div>
                                        <button onClick={() => setIsSearchingClient(true)} className="text-blue-500 hover:text-blue-700 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors bg-blue-50 hover:bg-blue-100 px-1.5 py-0.5 rounded border border-blue-200">
                                            <span>🔄</span> Trocar Cliente
                                        </button>
                                    </div>
                                    <div className="font-black text-slate-800 text-sm mb-3">({clientCode}) {clientName}</div>
                                    <div className="font-bold text-slate-400 text-[10px] uppercase tracking-widest mb-1">Endereço</div>
                                    <div className="font-bold text-slate-600 text-xs">{clientCity || 'N/A'}</div>
                                </div>
                            )}
                        </div>

                        <div className="hidden bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
                                📅
                            </div>
                            <div className="flex-1">
                                <div className="font-bold text-slate-400 text-[10px] uppercase tracking-widest mb-1">Data Orçamento</div>
                                <div className="flex items-center gap-3 mb-3">
                                    <span className="font-black text-slate-800 text-sm">{order.date.split('-').reverse().join('/')}</span>
                                    <span className="bg-blue-50 text-blue-600 text-[10px] font-bold px-2 py-1 rounded border border-blue-100 flex items-center gap-1">
                                        ⏱️ VÁLIDO POR 1 DIA ÚTIL
                                    </span>
                                </div>
                                <div className="font-bold text-slate-400 text-[10px] uppercase tracking-widest mb-1 mt-3">Vendedor</div>
                                <div className="font-bold text-slate-800 text-xs uppercase flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px]">👤</span>
                                    {order.salesperson}
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-4">
                            {/* projectIdent input removed as per user request */}
                            <div>
                                <div className="font-bold text-slate-400 text-[10px] uppercase tracking-widest mb-2">Prazo de Entrega</div>
                                <input 
                                    type="text" 
                                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold w-full uppercase bg-slate-50 focus:bg-white transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                    value={deliveryTime}
                                    onChange={e => setDeliveryTime(e.target.value)}
                                    placeholder="Ex: 10 DIAS ÚTEIS"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Add/Edit Item Form */}
                    <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2">
                                <span>{editingItemId ? '✏️' : '➕'}</span> {editingItemId ? 'Editar Linha' : 'Adicionar Nova Linha'}
                            </h3>
                            {editingItemId && (
                                <button 
                                    type="button" 
                                    onClick={() => {
                                        setEditingItemId(null);
                                        setNewItem({ codigo: '', folha: '', descricao: '', tipo: 'CORTE / DOBRA', peso: 0, valor: 0 });
                                        setBitolasQuantities({});
                                        setDrawingPieces([]);
                                    }}
                                    className="text-[10px] font-bold text-slate-500 hover:text-slate-800 uppercase"
                                >
                                    Cancelar Edição
                                </button>
                            )}
                        </div>
                        <form onSubmit={handleAddItem} className="grid grid-cols-6 gap-3">
                            <div className="col-span-12 md:col-span-2">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Cód.</label>
                                <select 
                                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-bold uppercase focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                    value={newItem.codigo} onChange={e => setNewItem({...newItem, codigo: e.target.value})}
                                    required
                                >
                                    <option value="" disabled>SELECIONE...</option>
                                    {(!items.length || items[0].codigo === 'RESUMO' || items[0].codigo !== 'DETALHADO') && (
                                        <option value="RESUMO">RESUMO</option>
                                    )}
                                    {(!items.length || items[0].codigo === 'DETALHADO') && (
                                        <option value="DETALHADO">DETALHADO</option>
                                    )}
                                </select>
                            </div>
                            <div className="col-span-12 md:col-span-4">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tipo</label>
                                <select 
                                    className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-bold uppercase focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                    value={['CORTE / DOBRA', 'ARMADO'].includes(newItem.tipo || '') ? newItem.tipo : 'CORTE / DOBRA'}
                                    onChange={e => setNewItem({...newItem, tipo: e.target.value})}
                                >
                                    <option value="CORTE / DOBRA">CORTE / DOBRA</option>
                                    <option value="ARMADO">ARMADO</option>
                                </select>
                            </div>
                            {newItem.codigo !== 'DETALHADO' && (
                                <>
                                    <div className="col-span-12 md:col-span-2">
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Folha</label>
                                        <input 
                                            type="text" className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-bold uppercase focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
                                            value={newItem.folha} onChange={e => setNewItem({...newItem, folha: e.target.value})}
                                            placeholder="Ex: 241" required
                                        />
                                    </div>
                                    <div className="col-span-12 md:col-span-4">
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Descrição</label>
                                        <input 
                                            type="text" className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-bold uppercase focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
                                            value={newItem.descricao} onChange={e => setNewItem({...newItem, descricao: e.target.value})}
                                            placeholder="Ex: PILARES" required
                                        />
                                    </div>
                                </>
                            )}
                            
                            <div className="col-span-12 flex justify-end gap-3 mt-2">
                                <button 
                                    type="button" 
                                    disabled={!newItem.codigo}
                                    onClick={() => {
                                        setIsBitolasModalOpen(true);
                                        setBitolasMode(newItem.codigo === 'RESUMO' ? 'KG' : (newItem.tipo === 'ARMADO' ? 'PECA' : 'DESENHO'));
                                    }}
                                    className={`px-6 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors ${!newItem.codigo ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed' : 'text-blue-600 bg-white border border-blue-200 hover:bg-blue-50'}`}
                                >
                                    + Inserir Bitolas
                                </button>
                                {editingItemId && (
                                    <button type="submit" className="px-6 py-2 rounded-lg font-bold text-white transition-colors text-sm shadow-md flex items-center gap-2 bg-amber-500 hover:bg-amber-600 shadow-amber-500/20">
                                        💾 Salvar Alteração
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>

                    {/* Items Table Section */}
                    <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
                        <div className="p-4 border-b border-slate-200">
                            <h3 className="font-black text-slate-800 text-sm">Itens do Orçamento</h3>
                        </div>
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-white border-b border-slate-200 text-slate-400 text-[10px] uppercase tracking-wider">
                                    <th className="p-3 font-bold">Cód.</th>
                                    <th className="p-3 font-bold text-center">{(items.length > 0 ? items[0].codigo : newItem.codigo) === 'DETALHADO' ? 'Qtd de Peças' : 'Folha'}</th>
                                    <th className="p-3 font-bold">{(items.length > 0 ? items[0].codigo : newItem.codigo) === 'DETALHADO' ? 'Descrição' : 'Etapa - Descrição'}</th>
                                    <th className="p-3 font-bold text-center">Tipo</th>
                                    <th className="p-3 font-bold text-right">Peso (kg)</th>
                                    <th className="p-3 font-bold text-right">Valor (R$)</th>
                                    <th className="p-3 font-bold text-center w-20">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    <tr><td colSpan={7} className="p-8 text-center text-slate-500 font-bold">Carregando itens...</td></tr>
                                ) : items.length === 0 ? (
                                    <tr><td colSpan={7} className="p-8 text-center text-slate-400 font-bold">Nenhum item adicionado ainda.</td></tr>
                                ) : (
                                    items.map((item, idx) => {
                                        const totalPeso = items.reduce((acc, i) => acc + (i.peso || 0), 0);
                                        const prop = totalPeso > 0 ? (item.peso || 0) / totalPeso : (1 / items.length);
                                        const itemFreight = (freightValue || 0) * prop;
                                        const finalValor = ((item.valor || 0) * multiplier) + itemFreight;

                                        return (
                                        <tr key={item.id || idx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                            <td className="p-3 text-xs font-bold text-slate-600 uppercase">{item.codigo}</td>
                                            <td className="p-3 text-xs font-black text-slate-800 text-center uppercase">{item.folha}</td>
                                            <td className="p-3 text-xs font-bold text-slate-700 uppercase">
                                                {(() => {
                                                    const bitolasDetails = (item as any).bitolasDetails || (item as any).bitolas_details;
                                                    if (bitolasDetails && bitolasDetails['drawings'] && bitolasDetails['drawings'].length > 0) {
                                                        return (
                                                            <div className="flex flex-col gap-1 w-full items-start justify-center">
                                                                {bitolasDetails['drawings'].map((drawing: any, dIdx: number) => (
                                                                    <div key={dIdx} className="flex items-center gap-1 w-fit">
                                                                        <span className="text-[10px] text-slate-700">{drawing.qty} peças:</span>
                                                                        <div className="h-8 w-14 flex items-center justify-center">
                                                                            {renderTableDrawingSvg(drawing)}
                                                                        </div>
                                                                        <span className="text-[10px] text-slate-700">
                                                                            , ∅{(() => {
                                                                                const gId = drawing.gaugeId || drawing.gauge_id;
                                                                                if (!gId) return 'N/A';
                                                                                const g = gauges.find(gg => String(gg.id) === String(gId));
                                                                                if (!g) return `ID:${String(gId).substring(0,4)}`;
                                                                                const num = parseFloat((g.gauge || '').replace(',', '.').replace(/[^\d.]/g, ''));
                                                                                if (!isNaN(num) && num > 0) return `${num}MM`;
                                                                                return (g.commercialName || g.materialType || g.gauge || '??').toUpperCase();
                                                                            })()}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        );
                                                    }
                                                    return <div>{item.descricao?.split(' --- DESENHOS: ')[0] || '\u00A0'}</div>;
                                                })()}
                                            </td>
                                            <td className="p-3 text-xs font-bold text-slate-600 text-center uppercase">{item.tipo}</td>
                                            <td className="p-3 text-sm font-bold text-slate-800 text-right">
                                                {item.peso.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                            </td>
                                            <td className="p-3 text-sm font-black text-emerald-600 text-right">
                                                R$ {finalValor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                            </td>
                                            <td className="p-3 text-center flex justify-center gap-3">
                                                <button onClick={() => handleEditItem(item)} className="text-slate-400 hover:text-slate-800 font-bold transition-colors" title="Editar">✏️</button>
                                                <button onClick={() => item.id && handleDeleteItem(item.id)} className="text-red-400 hover:text-red-600 font-black transition-colors" title="Excluir">🗑️</button>
                                            </td>
                                        </tr>
                                    )})
                                )}
                            </tbody>
                        </table>
                        
                    </div>

                    {/* Resumo do Aço */}
                    {summaryRows.length > 0 && (
                        <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden mb-6">
                            <div className="bg-slate-700 p-2 text-center text-white font-black text-sm uppercase tracking-wider">
                                RESUMO DE AÇO
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse min-w-[600px]">
                                    <thead>
                                        <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 text-[10px] uppercase tracking-wider">
                                            <th className="p-3 font-bold w-16">Cód.</th>
                                            <th className="p-3 font-bold">Descrição</th>
                                            <th className="p-3 font-bold text-right w-28">Kg</th>
                                            <th className="p-3 font-bold text-right w-28">R$/Kg</th>
                                            <th className="p-3 font-bold text-right w-32">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {summaryRows.map((row, idx) => (
                                            <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors">
                                                <td className="p-3 text-slate-500">{row.id}</td>
                                                <td className="p-3 uppercase">{row.desc}</td>
                                                <td className="p-3 text-right bg-slate-50/50">{row.isFreight ? '1' : row.kg.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                                <td className="p-3 text-right">{row.isFreight ? '' : `R$ ${row.pricePerKg.toLocaleString('pt-BR', {minimumFractionDigits: 3, maximumFractionDigits: 3})}`}</td>
                                                <td className="p-3 text-right text-slate-800">R$ {row.total.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            
                            <div className="bg-slate-200/40 p-4 border-t border-slate-200 flex flex-col items-end gap-2 text-xs">
                                <div className="flex items-center gap-4">
                                    <span className="font-bold text-slate-500 uppercase tracking-wider">Peso Corte / Dobra &gt;&gt;&gt;</span>
                                    <span className="font-black text-slate-800 w-32 text-right text-sm">{totalSummaryKg.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} kg</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="font-bold text-slate-500 uppercase tracking-wider">Valor Corte / Dobra &gt;&gt;&gt;</span>
                                    <span className="font-black text-slate-800 w-32 text-right text-sm">R$ {totalSummaryRs.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Totals Finais */}
                    <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 mb-6 flex flex-col items-end gap-3">
                        <div className="flex items-center gap-4 text-sm w-full justify-end">
                            <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Frete:</span>
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    className="border border-slate-200 rounded px-3 py-1.5 text-sm font-bold w-96 text-right uppercase bg-slate-50 focus:bg-white transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                    value={freight}
                                    onChange={e => setFreight(e.target.value)}
                                    placeholder="OBSERVAÇÕES DE FRETE..."
                                />
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">R$</span>
                                    <input 
                                        type="number"
                                        step="0.01"
                                        className="border border-slate-200 rounded py-1.5 pr-3 pl-8 text-sm font-bold w-32 text-right bg-slate-50 focus:bg-white transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                        value={freightValue || ''}
                                        onChange={e => {
                                            const val = parseFloat(e.target.value);
                                            setFreightValue(isNaN(val) ? 0 : val);
                                        }}
                                        placeholder="0,00"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm w-full justify-end mt-2">
                            <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Reajuste (+ ou -):</span>
                            <div className="flex gap-2">
                                <div className="relative">
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">%</span>
                                    <input 
                                        type="number"
                                        step="0.01"
                                        className="border border-slate-200 rounded py-1.5 pl-3 pr-8 text-sm font-bold w-24 text-right bg-slate-50 focus:bg-white transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                        value={adjustmentPercentage || ''}
                                        onChange={handleAdjustmentPercentageChange}
                                        placeholder="0,00"
                                    />
                                </div>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">R$</span>
                                    <input 
                                        type="number"
                                        step="0.01"
                                        className="border border-slate-200 rounded py-1.5 pr-3 pl-8 text-sm font-bold w-32 text-right bg-slate-50 focus:bg-white transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                        value={adjustmentValue || ''}
                                        onChange={handleAdjustmentValueChange}
                                        placeholder="0,00"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-6 text-sm">
                            <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Peso Total:</span>
                            <span className="font-black text-slate-800 w-32 text-right">{totalWeight.toLocaleString('pt-BR', {minimumFractionDigits: 2})} kg</span>
                        </div>
                        <div className="flex items-center justify-end gap-2 text-sm">
                            <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Pagamento:</span>
                            
                            <select
                                className="border border-slate-200 rounded px-2 py-1.5 text-xs font-bold uppercase bg-slate-50 focus:bg-white transition-colors focus:border-blue-500"
                                value={paymentMode}
                                onChange={e => setPaymentMode(e.target.value as any)}
                            >
                                <option value="A_VISTA">À VISTA</option>
                                <option value="CARTAO">CARTÃO</option>
                                <option value="BOLETO">BOLETO</option>
                                <option value="CUSTOM">OUTRO</option>
                            </select>

                            {paymentMode === 'CARTAO' && (
                                <button
                                    onClick={() => setIsPaymentConfigOpen(true)}
                                    title="Configurar Taxas"
                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                                >
                                    ⚙️
                                </button>
                            )}

                            {(paymentMode === 'BOLETO' || paymentMode === 'CUSTOM') && (
                                <input 
                                    type="text" 
                                    className="border border-slate-200 rounded px-2 py-1.5 text-xs font-bold w-28 uppercase bg-slate-50 focus:bg-white transition-colors focus:border-blue-500"
                                    value={paymentDetails}
                                    onChange={e => setPaymentDetails(e.target.value)}
                                    placeholder={paymentMode === 'BOLETO' ? "Ex: 7/14/21" : "..."}
                                />
                            )}
                        </div>
                        <div className="flex items-center gap-6 text-xl mt-3 pt-3 border-t border-slate-200">
                            <span className="font-black text-slate-800 uppercase text-xs tracking-wider">Valor Total:</span>
                            <span className="font-black text-emerald-600 w-32 text-right">R$ {totalValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                        </div>
                    </div>

                    {/* Observações */}
                    <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-5 mb-8 hidden">
                        <h4 className="font-black text-blue-800 text-sm flex items-center gap-2 mb-3">
                            <span>ℹ️</span> Observações Importantes (Impressas no PDF)
                        </h4>
                        <div className="flex flex-col gap-2">
                            {[
                                "MATERIAL: AÇO+CORTE E DOBRA+ARMADO",
                                "PRAZO DE ENTREGA: 10 DIAS ÚTEIS",
                                "FRETE: INCLUSO",
                                "A DESCARGA É POR CONTA DO CLIENTE",
                                "PAGAMENTO: A VISTA OU CARTÃO"
                            ].map(obs => (
                                <label key={obs} className="flex items-center gap-3 cursor-pointer group">
                                    <input 
                                        type="checkbox"
                                        className="w-4 h-4 text-blue-600 rounded border-blue-300 focus:ring-blue-500 cursor-pointer"
                                        checked={importantObs.includes(obs)}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setImportantObs(prev => [...prev, obs]);
                                            } else {
                                                setImportantObs(prev => prev.filter(o => o !== obs));
                                            }
                                        }}
                                    />
                                    <span className="text-sm font-bold text-blue-900 group-hover:text-blue-700 transition-colors">{obs}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Coluna Direita: Live Preview */}
                <div className="w-1/2 bg-slate-200 p-8 overflow-y-auto flex justify-center items-start">
                    <div className="origin-top scale-[0.65] xl:scale-75 shadow-2xl transition-transform" style={{ width: '210mm' }}>
                        <OrderPrintTemplate
                            order={liveOrder}
                            items={items}
                            gauges={gauges}
                            customer={liveCustomer}
                            seller={seller}
                            activeBrandingPartner={activeBrandingPartner}
                            previewCodigo={newItem.codigo}
                            paymentFees={paymentFees}
                        />
                    </div>
                </div>
            </div>
        </div>

        {/* Bitolas Calculator Modal */}
            {isBitolasModalOpen && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4 animate-in fade-in">
                    <div className="bg-white w-[95vw] max-w-7xl rounded-2xl shadow-2xl flex flex-col overflow-hidden border-2 border-indigo-500">
                        <div className="bg-indigo-600 p-4 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-6">
                                <h3 className="text-lg font-black text-white flex items-center gap-2">
                                    <span>⚖️</span> Inserir Bitolas e Quantidades
                                </h3>
                                <div className="flex bg-indigo-800/50 rounded-lg p-1 text-sm font-bold shadow-inner">
                                    {newItem.codigo === 'RESUMO' ? (
                                        <>
                                            <button 
                                                onClick={() => setBitolasMode('KG')}
                                                className={`px-4 py-1.5 rounded-md transition-all ${bitolasMode === 'KG' ? 'bg-white text-indigo-700 shadow-sm' : 'text-indigo-200 hover:text-white'}`}
                                            >
                                                POR KG
                                            </button>
                                            <button 
                                                onClick={() => setBitolasMode('METRO')}
                                                className={`px-4 py-1.5 rounded-md transition-all ${bitolasMode === 'METRO' ? 'bg-white text-indigo-700 shadow-sm' : 'text-indigo-200 hover:text-white'}`}
                                            >
                                                POR METRO
                                            </button>
                                            <button 
                                                onClick={() => setBitolasMode('DESENHO')}
                                                className={`px-4 py-1.5 rounded-md transition-all ${bitolasMode === 'DESENHO' ? 'bg-white text-indigo-700 shadow-sm' : 'text-indigo-200 hover:text-white'}`}
                                            >
                                                POR DESENHO
                                            </button>
                                        </>
                                    ) : newItem.tipo === 'ARMADO' ? (
                                        <button 
                                            onClick={() => setBitolasMode('PECA')}
                                            className={`px-4 py-1.5 rounded-md transition-all ${bitolasMode === 'PECA' ? 'bg-white text-indigo-700 shadow-sm' : 'text-indigo-200 hover:text-white'}`}
                                        >
                                            POR PEÇA
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={() => setBitolasMode('DESENHO')}
                                            className={`px-4 py-1.5 rounded-md transition-all ${bitolasMode === 'DESENHO' ? 'bg-white text-indigo-700 shadow-sm' : 'text-indigo-200 hover:text-white'}`}
                                        >
                                            POR DESENHO
                                        </button>
                                    )}
                                </div>
                                {newItem.tipo === 'ARMADO' && bitolasMode === 'PECA' && (
                                    <div className="ml-6 flex items-center gap-3 bg-red-50 p-1.5 rounded-lg border border-red-200">
                                        <label className="flex items-center gap-2 text-red-600 text-xs font-bold">
                                            <span className="text-amber-500">⚠️</span>
                                            Obrigatório: Arame
                                        </label>
                                        <select 
                                            className="bg-white border border-red-300 text-red-600 font-bold rounded px-2 py-1 text-xs outline-none max-w-[150px]"
                                            value={arameGaugeId}
                                            onChange={e => setArameGaugeId(e.target.value)}
                                        >
                                            <option value="">SELECIONE O ARAME...</option>
                                            {arameGauges.map(g => (
                                                <option key={g.id} value={g.id}>{g.commercialName || g.materialType} {g.gauge}</option>
                                            ))}
                                        </select>
                                        <div className="flex items-center gap-1">
                                            <input 
                                                type="number" step="0.1" min="0"
                                                className="bg-white border border-red-300 text-red-600 font-bold rounded px-2 py-1 text-xs outline-none w-14 text-right"
                                                value={aramePercentage}
                                                onChange={e => setAramePercentage(parseFloat(e.target.value) || 0)}
                                            />
                                            <span className="text-red-600 text-xs font-bold">%</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <button onClick={() => setIsBitolasModalOpen(false)} className="text-indigo-200 hover:text-white transition-colors">
                                ✕ Fechar
                            </button>
                        </div>
                        
                        <div className="p-4 flex-1 overflow-y-auto max-h-[60vh] bg-slate-50">
                            <div className="space-y-2">
                                {bitolasMode === 'PECA' ? (
                                    <div className="bg-white rounded-lg p-4 border border-slate-200">
                                        <div className="grid grid-cols-12 gap-3 mb-4 items-end">
                                            <div className={`col-span-12 ${['broca', 'viga', 'pilares'].includes((pieceName || '').toLowerCase()) ? 'md:col-span-1' : 'md:col-span-3'}`}>
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 leading-tight">Qtd</label>
                                                <input 
                                                    type="number" min="1"
                                                    className="w-full border border-slate-300 rounded p-2 text-sm font-bold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                    value={pieceQty} onChange={e => setPieceQty(e.target.value)}
                                                    placeholder="Ex: 50"
                                                />
                                            </div>
                                            <div className={`col-span-12 ${['broca', 'viga', 'pilares'].includes((pieceName || '').toLowerCase()) ? 'md:col-span-3' : 'md:col-span-4'}`}>
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 leading-tight">Nome da Peça</label>
                                                <select 
                                                    className="w-full border border-slate-300 rounded p-2 text-sm font-bold uppercase focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                    value={pieceName} onChange={e => setPieceName(e.target.value)}
                                                >
                                                    <option value="broca">Broca</option>
                                                    <option value="viga">Viga</option>
                                                    <option value="pilares">Pilares</option>
                                                    <option value="blocos">Blocos</option>
                                                    <option value="corte e dobra">Corte e Dobra</option>
                                                </select>
                                            </div>
                                            {['bloco', 'blocos'].includes((pieceName || '').toLowerCase()) && (
                                                <div className="col-span-12 md:col-span-4">
                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 leading-tight">Dimensões (C x L x A)</label>
                                                    <input 
                                                        type="text" 
                                                        className="w-full border border-slate-300 rounded p-2 text-sm font-bold uppercase focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                        value={blocoDimensions} onChange={e => setBlocoDimensions(e.target.value)}
                                                        placeholder="Ex: 50x50x30"
                                                    />
                                                </div>
                                            )}
                                            {['broca', 'viga', 'pilares', 'bloco', 'blocos'].includes((pieceName || '').toLowerCase()) && (
                                                <div className="col-span-12 md:col-span-8">
                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 leading-tight">Formato de Estribo (Obrigatório)</label>
                                                    <select 
                                                        className="w-full border border-slate-300 rounded p-2 text-sm font-bold uppercase focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                        value={pieceStirrupFormat} onChange={e => setPieceStirrupFormat(e.target.value)}
                                                    >
                                                        <option value="" disabled>SELECIONE O FORMATO...</option>
                                                        {['bloco', 'blocos'].includes((pieceName || '').toLowerCase()) ? (
                                                            <>
                                                                <option value="fechado">Fechado</option>
                                                                <option value="aberto">Aberto</option>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <option value="quadrado">Quadrado</option>
                                                                <option value="retangular">Retangular</option>
                                                                <option value="triangular">Triangular</option>
                                                                <option value="redondo">Redondo</option>
                                                                <option value="sextavado">Sextavado</option>
                                                            </>
                                                        )}
                                                    </select>
                                                </div>
                                            )}

                                            {['broca', 'viga', 'pilares'].includes((pieceName || '').toLowerCase()) ? (
                                                <div className="col-span-12 space-y-2 border border-slate-200 rounded p-3 bg-slate-50">
                                                    <h4 className="text-[11px] font-bold text-slate-700 uppercase mb-2">Detalhes da Peça</h4>
                                                    {pieceDetails.map((detail, index) => (
                                                        <div key={detail.id} className="grid grid-cols-12 gap-3 items-end bg-white p-3 rounded shadow-sm border border-slate-200 relative">
                                                            <div className="col-span-12 lg:col-span-1">
                                                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 leading-tight" title="Ferros Cada">Qtd</label>
                                                                <input 
                                                                    type="number" min="1"
                                                                    className="w-full border border-slate-300 rounded p-2 text-sm font-bold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                                    value={detail.irons} onChange={e => {
                                                                        const newDetails = [...pieceDetails];
                                                                        newDetails[index].irons = e.target.value;
                                                                        setPieceDetails(newDetails);
                                                                    }}
                                                                    placeholder="Ex: 4"
                                                                />
                                                            </div>
                                                            <div className="col-span-12 lg:col-span-2">
                                                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 leading-tight">Posição</label>
                                                                <select 
                                                                    className="w-full border border-slate-300 rounded p-2 text-sm font-bold uppercase focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                                    value={detail.position} onChange={e => {
                                                                        const newDetails = [...pieceDetails];
                                                                        newDetails[index].position = e.target.value;
                                                                        setPieceDetails(newDetails);
                                                                    }}
                                                                >
                                                                    <option value="principal">Principal</option>
                                                                    <option value="costela">Costela</option>
                                                                    <option value="2° camada">2° Camada</option>
                                                                    <option value="cavalete">Cavalete</option>
                                                                </select>
                                                            </div>
                                                            <div className="col-span-12 lg:col-span-2">
                                                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 leading-tight flex items-center gap-1">
                                                                    Modelo
                                                                    {detail.format === 'reto' || !detail.format ? <svg viewBox="0 0 40 20" className="w-5 h-2.5 stroke-slate-500" fill="none" strokeWidth="4"><path d="M5 10 H35"/></svg> :
                                                                     detail.format === '1-dobra' ? <svg viewBox="0 0 40 40" className="w-3.5 h-3.5 stroke-slate-500" fill="none" strokeWidth="4"><path d="M10 30 H30 V10"/></svg> :
                                                                     <svg viewBox="0 0 40 40" className="w-3.5 h-3.5 stroke-slate-500" fill="none" strokeWidth="4"><path d="M10 10 V30 H30 V10"/></svg>}
                                                                </label>
                                                                <select 
                                                                    className="w-full border border-slate-300 rounded p-2 text-[11px] font-bold uppercase focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                                    value={detail.format || 'reto'} onChange={e => {
                                                                        const newDetails = [...pieceDetails];
                                                                        newDetails[index].format = e.target.value;
                                                                        newDetails[index].sideA = '';
                                                                        newDetails[index].sideB = '';
                                                                        newDetails[index].sideC = '';
                                                                        newDetails[index].size = '';
                                                                        setPieceDetails(newDetails);
                                                                    }}
                                                                >
                                                                    <option value="reto">Reto</option>
                                                                    <option value="1-dobra">Dobra 1 Lado</option>
                                                                    <option value="2-dobras">Dobra 2 Lados</option>
                                                                    <option value="estribo-quadrado">Estribo Quadrado</option>
                                                                    <option value="estribo-retangular">Estribo Retangular</option>
                                                                </select>
                                                            </div>
                                                            <div className="col-span-12 lg:col-span-3 flex gap-1">
                                                                <div className="flex-1">
                                                                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1 leading-tight whitespace-nowrap" title="Base">A (Base)</label>
                                                                    <input 
                                                                        type="number" min="1"
                                                                        className="w-full border border-slate-300 rounded p-2 text-sm font-bold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                                        value={detail.sideA || ''} onChange={e => {
                                                                            const newDetails = [...pieceDetails];
                                                                            newDetails[index].sideA = e.target.value;
                                                                            
                                                                            const a = parseFloat(newDetails[index].sideA || '0');
                                                                            const b = parseFloat(newDetails[index].sideB || '0');
                                                                            const c = parseFloat(newDetails[index].sideC || '0');
                                                                            if (newDetails[index].format === 'estribo-quadrado') {
                                                                                newDetails[index].size = ((a * 4) + 10).toString();
                                                                            } else if (newDetails[index].format === 'estribo-retangular') {
                                                                                newDetails[index].size = ((a * 2) + (b * 2) + 10).toString();
                                                                            } else {
                                                                                newDetails[index].size = (a + b + c).toString();
                                                                            }
                                                                            setPieceDetails(newDetails);
                                                                            
                                                                            if (index === 0) {
                                                                                const spacing = parseInt(stirrupSpacing);
                                                                                if (spacing > 0 && a > 0) {
                                                                                    setStirrupQty(Math.ceil(a / spacing).toString());
                                                                                }
                                                                            }
                                                                        }}
                                                                        placeholder="Ex: 200"
                                                                    />
                                                                </div>
                                                                {['1-dobra', '2-dobras', 'estribo-retangular'].includes(detail.format || 'reto') && (
                                                                    <div className="flex-1">
                                                                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1 leading-tight whitespace-nowrap" title="Lado Direito">B (Dir)</label>
                                                                        <input 
                                                                            type="number" min="1"
                                                                            className="w-full border border-slate-300 rounded p-2 text-sm font-bold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                                            value={detail.sideB || ''} onChange={e => {
                                                                                const newDetails = [...pieceDetails];
                                                                                newDetails[index].sideB = e.target.value;
                                                                                const a = parseFloat(newDetails[index].sideA || '0');
                                                                                const b = parseFloat(newDetails[index].sideB || '0');
                                                                                const c = parseFloat(newDetails[index].sideC || '0');
                                                                                if (newDetails[index].format === 'estribo-quadrado') {
                                                                                    newDetails[index].size = ((a * 4) + 10).toString();
                                                                                } else if (newDetails[index].format === 'estribo-retangular') {
                                                                                    newDetails[index].size = ((a * 2) + (b * 2) + 10).toString();
                                                                                } else {
                                                                                    newDetails[index].size = (a + b + c).toString();
                                                                                }
                                                                                setPieceDetails(newDetails);
                                                                                
                                                                                if (index === 0) {
                                                                                    const spacing = parseInt(stirrupSpacing);
                                                                                    if (spacing > 0 && a > 0) {
                                                                                        setStirrupQty(Math.ceil(a / spacing).toString());
                                                                                    }
                                                                                }
                                                                            }}
                                                                            placeholder="Ex: 50"
                                                                        />
                                                                    </div>
                                                                )}
                                                                {(detail.format === '2-dobras') && (
                                                                    <div className="flex-1">
                                                                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1 leading-tight whitespace-nowrap" title="Lado Esquerdo">C (Esq)</label>
                                                                        <input 
                                                                            type="number" min="1"
                                                                            className="w-full border border-slate-300 rounded p-2 text-sm font-bold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                                            value={detail.sideC || ''} onChange={e => {
                                                                                const newDetails = [...pieceDetails];
                                                                                newDetails[index].sideC = e.target.value;
                                                                                const a = parseFloat(newDetails[index].sideA || '0');
                                                                                const b = parseFloat(newDetails[index].sideB || '0');
                                                                                const c = parseFloat(newDetails[index].sideC || '0');
                                                                                if (newDetails[index].format === 'estribo-quadrado') {
                                                                                    newDetails[index].size = ((a * 4) + 10).toString();
                                                                                } else if (newDetails[index].format === 'estribo-retangular') {
                                                                                    newDetails[index].size = ((a * 2) + (b * 2) + 10).toString();
                                                                                } else {
                                                                                    newDetails[index].size = (a + b + c).toString();
                                                                                }
                                                                                setPieceDetails(newDetails);
                                                                                
                                                                                if (index === 0) {
                                                                                    const spacing = parseInt(stirrupSpacing);
                                                                                    if (spacing > 0 && a > 0) {
                                                                                        setStirrupQty(Math.ceil(a / spacing).toString());
                                                                                    }
                                                                                }
                                                                            }}
                                                                            placeholder="Ex: 50"
                                                                        />
                                                                    </div>
                                                                )}
                                                                {['estribo-quadrado', 'estribo-retangular'].includes(detail.format || '') && (
                                                                    <div className="flex-1">
                                                                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1 leading-tight whitespace-nowrap" title="Espaçamento">Espaç (cm)</label>
                                                                        <input 
                                                                            type="number" min="1"
                                                                            className="w-full border border-slate-300 rounded p-2 text-sm font-bold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                                            value={detail.spacing || ''} onChange={e => {
                                                                                const newDetails = [...pieceDetails];
                                                                                newDetails[index].spacing = e.target.value;
                                                                                setPieceDetails(newDetails);
                                                                            }}
                                                                            placeholder="Ex: 15"
                                                                        />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="col-span-12 lg:col-span-1">
                                                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 leading-tight" title="Tamanho Total">Total</label>
                                                                <div className="w-full border border-slate-200 bg-slate-100 rounded p-2 text-sm font-bold text-slate-600 cursor-not-allowed flex items-center justify-center h-[38px]">
                                                                    {detail.size || '0'}
                                                                </div>
                                                            </div>
                                                            <div className="col-span-12 lg:col-span-2">
                                                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 leading-tight">Bitola (Ferro)</label>
                                                                <select 
                                                                    className="w-full border border-slate-300 rounded p-2 text-sm font-bold uppercase focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                                    value={detail.gaugeId} onChange={e => {
                                                                        const newDetails = [...pieceDetails];
                                                                        newDetails[index].gaugeId = e.target.value;
                                                                        setPieceDetails(newDetails);
                                                                    }}
                                                                >
                                                                    <option value="">SELECIONE...</option>
                                                                    {vergalhaoGauges.map(g => (
                                                                        <option key={g.id} value={g.id}>
                                                                            {g.commercialName || g.materialType} {g.gauge}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                            <div className="col-span-12 lg:col-span-1 flex justify-center pb-2">
                                                                {pieceDetails.length > 1 && (
                                                                    <button 
                                                                        onClick={() => setPieceDetails(pieceDetails.filter((_, i) => i !== index))} 
                                                                        className="text-red-500 hover:text-red-700 font-black text-lg"
                                                                        title="Remover Detalhe"
                                                                    >
                                                                        ✕
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                    <button 
                                                        onClick={() => setPieceDetails([...pieceDetails, { id: Date.now().toString(), irons: '', position: 'principal', format: 'reto', sideA: '', sideB: '', sideC: '', size: '', gaugeId: '' }])}
                                                        className="mt-2 text-[11px] font-bold text-indigo-700 bg-indigo-100 px-4 py-2 rounded shadow-sm hover:bg-indigo-200 transition-colors"
                                                    >
                                                        ➕ Adicionar Nova Posição
                                                    </button>
                                                </div>
                                            ) : !['bloco', 'blocos'].includes((pieceName || '').toLowerCase()) ? (
                                                <div className="col-span-12 md:col-span-5">
                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 leading-tight">Bitola (Ferro)</label>
                                                    <select 
                                                        className="w-full border border-slate-300 rounded p-2 text-sm font-bold uppercase focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                        value={pieceGaugeId} onChange={e => setPieceGaugeId(e.target.value)}
                                                    >
                                                        <option value="">SELECIONE...</option>
                                                        {vergalhaoGauges.map(g => (
                                                            <option key={g.id} value={g.id}>
                                                                {g.commercialName || g.materialType} {g.gauge}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            ) : null}
                                            
                                            {['broca', 'viga', 'pilares', 'bloco', 'blocos'].includes((pieceName || '').toLowerCase()) && pieceStirrupFormat && (
                                                <div className="col-span-12 space-y-2 border border-orange-200 rounded p-3 bg-orange-50 mt-2 mb-2">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="text-[11px] font-bold text-orange-800 uppercase">Configuração de Estribos</h4>
                                                            {pieceStirrupFormat === 'aberto' && (
                                                                <svg viewBox="0 0 40 40" className="w-5 h-5 stroke-orange-600" fill="none" strokeWidth="4" title="Aberto (Base + Lado Dir + Lado Esq)"><path d="M10 10 V30 H30 V10" /></svg>
                                                            )}
                                                            {(pieceStirrupFormat === 'retangular' || pieceStirrupFormat === 'fechado') && (
                                                                <svg viewBox="0 0 40 40" className="w-5 h-5 stroke-orange-600" fill="none" strokeWidth="4" title="Retangular"><rect x="5" y="10" width="30" height="20" /></svg>
                                                            )}
                                                        </div>
                                                        <span className="text-[10px] font-bold text-orange-700 bg-orange-200 px-2 py-0.5 rounded">
                                                            Tamanho Automático: {calculatedStirrupSize > 0 ? calculatedStirrupSize + ' cm' : '--'}
                                                        </span>
                                                    </div>
                                                    <div className="grid grid-cols-12 gap-3 items-end bg-white p-3 rounded shadow-sm border border-orange-200">
                                                        <div className="col-span-12 md:col-span-2">
                                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 leading-tight">Espaçamento (CM)</label>
                                                            <input 
                                                                type="number" min="1"
                                                                className="w-full border border-slate-300 rounded p-2 text-sm font-bold focus:border-orange-500 focus:ring-1 focus:ring-orange-500 bg-orange-50/50"
                                                                value={stirrupSpacing} onChange={e => {
                                                                    setStirrupSpacing(e.target.value);
                                                                    const spacing = parseInt(e.target.value);
                                                                    const mainBase = parseFloat(pieceDetails[0]?.sideA || '0') || parseFloat(pieceDetails[0]?.size || '0') || 0;
                                                                    if (spacing > 0 && mainBase > 0) {
                                                                        setStirrupQty(Math.ceil(mainBase / spacing).toString());
                                                                    }
                                                                }}
                                                                placeholder="Ex: 15"
                                                            />
                                                        </div>
                                                        <div className="col-span-12 md:col-span-2">
                                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 leading-tight">Qtd. por Peça</label>
                                                            <input 
                                                                type="number" min="1"
                                                                className="w-full border border-slate-300 rounded p-2 text-sm font-bold focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                                                                value={stirrupQty} onChange={e => setStirrupQty(e.target.value)}
                                                                placeholder="Ex: 15"
                                                            />
                                                        </div>
                                                        <div className="col-span-12 md:col-span-2">
                                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 leading-tight">{pieceStirrupFormat === 'aberto' ? 'Base (A)' : 'Lado A'}</label>
                                                            <input 
                                                                type="number" min="1"
                                                                className="w-full border border-slate-300 rounded p-2 text-sm font-bold focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                                                                value={stirrupA} onChange={e => setStirrupA(e.target.value)}
                                                                placeholder="Ex: 15"
                                                            />
                                                        </div>
                                                        {['retangular', 'triangular', 'aberto', 'fechado'].includes(pieceStirrupFormat) && (
                                                            <div className="col-span-12 md:col-span-2">
                                                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 leading-tight">{pieceStirrupFormat === 'aberto' ? 'Lat Dir (B)' : 'Lado B'}</label>
                                                                <input 
                                                                    type="number" min="1"
                                                                    className="w-full border border-slate-300 rounded p-2 text-sm font-bold focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                                                                    value={stirrupB} onChange={e => setStirrupB(e.target.value)}
                                                                    placeholder="Ex: 15"
                                                                />
                                                            </div>
                                                        )}
                                                        {['aberto'].includes(pieceStirrupFormat) && (
                                                            <div className="col-span-12 md:col-span-2">
                                                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 leading-tight">Lat Esq (C)</label>
                                                                <input 
                                                                    type="number" min="1"
                                                                    className="w-full border border-slate-300 rounded p-2 text-sm font-bold focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                                                                    value={stirrupC} onChange={e => setStirrupC(e.target.value)}
                                                                    placeholder="Ex: 15"
                                                                />
                                                            </div>
                                                        )}
                                                        <div className={`col-span-12 ${['aberto'].includes(pieceStirrupFormat) ? 'md:col-span-12' : ['retangular', 'triangular', 'fechado'].includes(pieceStirrupFormat) ? 'md:col-span-4' : 'md:col-span-6'}`}>
                                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 leading-tight">Bitola do Estribo</label>
                                                            <select 
                                                                className="w-full border border-slate-300 rounded p-2 text-sm font-bold uppercase focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                                                                value={stirrupGaugeId} onChange={e => setStirrupGaugeId(e.target.value)}
                                                            >
                                                                <option value="">SELECIONE...</option>
                                                                {vergalhaoGauges.map(g => (
                                                                    <option key={g.id} value={g.id}>
                                                                        {g.commercialName || g.materialType} {g.gauge}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    </div>
                                                    
                                                    {['bloco', 'blocos'].includes((pieceName || '').toLowerCase()) && (
                                                        <div className="flex justify-end mt-2">
                                                            <button 
                                                                onClick={() => setUseSecondStirrup(!useSecondStirrup)}
                                                                className="text-[11px] font-bold text-orange-700 bg-orange-100 hover:bg-orange-200 px-3 py-1 rounded transition-colors"
                                                            >
                                                                {useSecondStirrup ? '✕ Remover 2º Estribo' : '➕ Adicionar 2º Estribo'}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {['bloco', 'blocos'].includes((pieceName || '').toLowerCase()) && useSecondStirrup && (
                                                <div className="col-span-12 space-y-2 border border-orange-200 rounded p-3 bg-orange-50 mt-2 mb-2">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="text-[11px] font-bold text-orange-800 uppercase">Configuração de 2º Estribo</h4>
                                                            {pieceStirrupFormat2 === 'aberto' && (
                                                                <svg viewBox="0 0 40 40" className="w-5 h-5 stroke-orange-600" fill="none" strokeWidth="4" title="Aberto (Base + Lado Dir + Lado Esq)"><path d="M10 10 V30 H30 V10" /></svg>
                                                            )}
                                                            {(pieceStirrupFormat2 === 'retangular' || pieceStirrupFormat2 === 'fechado') && (
                                                                <svg viewBox="0 0 40 40" className="w-5 h-5 stroke-orange-600" fill="none" strokeWidth="4" title="Retangular"><rect x="5" y="10" width="30" height="20" /></svg>
                                                            )}
                                                        </div>
                                                        <span className="text-[10px] font-bold text-orange-700 bg-orange-200 px-2 py-0.5 rounded">
                                                            Tamanho Automático: {calculatedStirrupSize2 > 0 ? calculatedStirrupSize2 + ' cm' : '--'}
                                                        </span>
                                                    </div>
                                                    <div className="grid grid-cols-12 gap-3 items-end bg-white p-3 rounded shadow-sm border border-orange-200">
                                                        <div className="col-span-12 md:col-span-12">
                                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 leading-tight">Formato do 2º Estribo</label>
                                                            <select 
                                                                className="w-full border border-slate-300 rounded p-2 text-sm font-bold uppercase focus:border-orange-500 focus:ring-1 focus:ring-orange-500 bg-orange-50/50"
                                                                value={pieceStirrupFormat2} onChange={e => setPieceStirrupFormat2(e.target.value)}
                                                            >
                                                                <option value="" disabled>SELECIONE O FORMATO...</option>
                                                                <option value="fechado">Fechado</option>
                                                                <option value="aberto">Aberto</option>
                                                            </select>
                                                        </div>
                                                        <div className="col-span-12 md:col-span-2">
                                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 leading-tight">Espaçamento (CM)</label>
                                                            <input 
                                                                type="number" min="1"
                                                                className="w-full border border-slate-300 rounded p-2 text-sm font-bold focus:border-orange-500 focus:ring-1 focus:ring-orange-500 bg-orange-50/50"
                                                                value={stirrupSpacing2} onChange={e => {
                                                                    setStirrupSpacing2(e.target.value);
                                                                    const spacing = parseInt(e.target.value);
                                                                    const mainBase = parseFloat(pieceDetails[0]?.sideB || '0') || parseFloat(pieceDetails[0]?.size || '0') || 0;
                                                                    if (spacing > 0 && mainBase > 0) {
                                                                        setStirrupQty2(Math.ceil(mainBase / spacing).toString());
                                                                    }
                                                                }}
                                                                placeholder="Ex: 15"
                                                            />
                                                        </div>
                                                        <div className="col-span-12 md:col-span-2">
                                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 leading-tight">Qtd. por Peça</label>
                                                            <input 
                                                                type="number" min="1"
                                                                className="w-full border border-slate-300 rounded p-2 text-sm font-bold focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                                                                value={stirrupQty2} onChange={e => setStirrupQty2(e.target.value)}
                                                                placeholder="Ex: 15"
                                                            />
                                                        </div>
                                                        <div className="col-span-12 md:col-span-2">
                                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 leading-tight">{pieceStirrupFormat2 === 'aberto' ? 'Base (A)' : 'Lado A'}</label>
                                                            <input 
                                                                type="number" min="1"
                                                                className="w-full border border-slate-300 rounded p-2 text-sm font-bold focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                                                                value={stirrupA2} onChange={e => setStirrupA2(e.target.value)}
                                                                placeholder="Ex: 15"
                                                            />
                                                        </div>
                                                        {['retangular', 'triangular', 'aberto', 'fechado'].includes(pieceStirrupFormat2) && (
                                                            <div className="col-span-12 md:col-span-2">
                                                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 leading-tight">{pieceStirrupFormat2 === 'aberto' ? 'Lat Dir (B)' : 'Lado B'}</label>
                                                                <input 
                                                                    type="number" min="1"
                                                                    className="w-full border border-slate-300 rounded p-2 text-sm font-bold focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                                                                    value={stirrupB2} onChange={e => setStirrupB2(e.target.value)}
                                                                    placeholder="Ex: 15"
                                                                />
                                                            </div>
                                                        )}
                                                        {['aberto'].includes(pieceStirrupFormat2) && (
                                                            <div className="col-span-12 md:col-span-2">
                                                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 leading-tight">Lat Esq (C)</label>
                                                                <input 
                                                                    type="number" min="1"
                                                                    className="w-full border border-slate-300 rounded p-2 text-sm font-bold focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                                                                    value={stirrupC2} onChange={e => setStirrupC2(e.target.value)}
                                                                    placeholder="Ex: 15"
                                                                />
                                                            </div>
                                                        )}
                                                        <div className={`col-span-12 ${['aberto'].includes(pieceStirrupFormat2) ? 'md:col-span-12' : ['retangular', 'triangular', 'fechado'].includes(pieceStirrupFormat2) ? 'md:col-span-4' : 'md:col-span-6'}`}>
                                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 leading-tight">Bitola do Estribo</label>
                                                            <select 
                                                                className="w-full border border-slate-300 rounded p-2 text-sm font-bold uppercase focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                                                                value={stirrupGaugeId2} onChange={e => setStirrupGaugeId2(e.target.value)}
                                                            >
                                                                <option value="">SELECIONE...</option>
                                                                {vergalhaoGauges.map(g => (
                                                                    <option key={g.id} value={g.id}>
                                                                        {g.commercialName || g.materialType} {g.gauge}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* LIVE CALCULATION SUMMARY */}
                                            {['broca', 'viga', 'pilares', 'bloco', 'blocos'].includes((pieceName || '').toLowerCase()) && currentPieceBreakdown.length > 0 && (
                                                <div className="col-span-12 mt-2 border border-slate-200 rounded-lg p-3 bg-slate-50 flex flex-col gap-3">
                                                    <div className="overflow-x-auto rounded border border-slate-200">
                                                            <table className="w-full text-left text-[10px] bg-white">
                                                                <thead className="bg-slate-100 text-slate-600">
                                                                    <tr>
                                                                        <th className="p-1.5 font-bold uppercase">Aço / Tipo</th>
                                                                        <th className="p-1.5 font-bold uppercase text-right">Metros</th>
                                                                        <th className="p-1.5 font-bold uppercase text-right">Peso</th>
                                                                        <th className="p-1.5 font-bold uppercase text-right">Preço</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {currentPieceBreakdown.map((b, idx) => (
                                                                        <tr key={idx} className="border-t border-slate-100">
                                                                            <td className="p-1.5 text-slate-700 font-bold uppercase">{b.type} - <span className="text-indigo-700">{b.gaugeName}</span></td>
                                                                            <td className="p-1.5 text-slate-600 text-right font-semibold">{b.metros.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} M</td>
                                                                            <td className="p-1.5 text-slate-600 text-right font-semibold">{b.kg.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} KG</td>
                                                                            <td className="p-1.5 text-emerald-700 font-black text-right">R$ {b.price.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                </div>
                                            )}

                                            <div className="col-span-12 hidden">
                                                <button 
                                                    type="button"
                                                    onClick={() => {
                                                        if (!pieceQty || parseInt(pieceQty) <= 0) return;
                                                        const isComplex = ['broca', 'viga', 'pilares', 'bloco', 'blocos'].includes((pieceName || '').toLowerCase());
                                                        if (isComplex && !pieceStirrupFormat) {
                                                            alert('O Formato do Estribo é obrigatório!');
                                                            return;
                                                        }
                                                        const isBloco = ['bloco', 'blocos'].includes((pieceName || '').toLowerCase());
                                                        if (isBloco && useSecondStirrup && !pieceStirrupFormat2) {
                                                            alert('O Formato do 2º Estribo é obrigatório!');
                                                            return;
                                                        }
                                                        
                                                        setPiecesList(prev => [...prev, {
                                                            id: Date.now().toString(),
                                                            qty: parseInt(pieceQty),
                                                            name: isBloco && blocoDimensions ? `${pieceName} ${blocoDimensions}` : pieceName,
                                                            stirrupFormat: isComplex && pieceStirrupFormat ? pieceStirrupFormat : undefined,
                                                            stirrupA: sA > 0 ? sA : undefined,
                                                            stirrupB: sB > 0 ? sB : undefined,
                                                            stirrupC: sC > 0 ? sC : undefined,
                                                            stirrupQty: parseInt(stirrupQty) || undefined,
                                                            stirrupSpacing: stirrupSpacing || undefined,
                                                            stirrupGaugeId: stirrupGaugeId || undefined,
                                                            stirrupSize: calculatedStirrupSize > 0 ? calculatedStirrupSize : undefined,
                                                            stirrupFormat2: isComplex && useSecondStirrup && pieceStirrupFormat2 ? pieceStirrupFormat2 : undefined,
                                                            stirrupA2: sA2 > 0 ? sA2 : undefined,
                                                            stirrupB2: sB2 > 0 ? sB2 : undefined,
                                                            stirrupC2: sC2 > 0 ? sC2 : undefined,
                                                            stirrupQty2: parseInt(stirrupQty2) || undefined,
                                                            stirrupSpacing2: stirrupSpacing2 || undefined,
                                                            stirrupGaugeId2: stirrupGaugeId2 || undefined,
                                                            stirrupSize2: calculatedStirrupSize2 > 0 ? calculatedStirrupSize2 : undefined,
                                                            gaugeId: !isComplex ? (pieceGaugeId || undefined) : undefined,
                                                            kg: currentPieceKg > 0 ? currentPieceKg : undefined,
                                                            details: isComplex ? pieceDetails.map(d => ({
                                                                irons: parseInt(d.irons) || 0,
                                                                size: parseInt(d.size) || 0,
                                                                position: d.position,
                                                                format: d.format || 'reto',
                                                                sideA: parseFloat(d.sideA || '0') || undefined,
                                                                sideB: parseFloat(d.sideB || '0') || undefined,
                                                                sideC: parseFloat(d.sideC || '0') || undefined,
                                                                spacing: parseFloat(d.spacing || '0') || undefined,
                                                                gaugeId: d.gaugeId,
                                                                kg: 0
                                                            })).filter(d => d.irons > 0 && d.size > 0) : undefined
                                                        }]);
                                                        setPieceQty('');
                                                        setPieceStirrupFormat('');
                                                        setStirrupSpacing('');
                                                        setStirrupA('');
                                                        setStirrupB('');
                                                        setStirrupC('');
                                                        setStirrupQty('');
                                                        setStirrupGaugeId('');
                                                        setPieceGaugeId('');
                                                        setBlocoDimensions('');
                                                        setUseSecondStirrup(false);
                                                        setPieceStirrupFormat2('');
                                                        setStirrupA2('');
                                                        setStirrupB2('');
                                                        setStirrupC2('');
                                                        setStirrupSpacing2('');
                                                        setStirrupQty2('');
                                                        setStirrupGaugeId2('');
                                                        setPieceDetails([{ id: Date.now().toString(), irons: '', position: 'principal', size: '', gaugeId: '' }]);
                                                    }}
                                                    className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 px-4 py-2 text-sm font-bold rounded-lg w-full transition-colors"
                                                >
                                                    ➕ Adicionar à Lista
                                                </button>
                                            </div>
                                        </div>

                                        {piecesList.length > 0 && (
                                            <div className="mt-4 border border-slate-200 rounded-lg overflow-hidden">
                                                <table className="w-full text-left bg-white">
                                                    <thead className="bg-slate-50">
                                                        <tr>
                                                            <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase">Qtd</th>
                                                            <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase">Peça</th>
                                                            <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase">Detalhes</th>
                                                            <th className="px-3 py-2 w-10"></th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {piecesList.map(p => (
                                                            <tr key={p.id}>
                                                                <td className="px-3 py-2 text-sm font-bold">{p.qty}</td>
                                                                <td className="px-3 py-2 text-sm font-bold uppercase">
                                                                    {p.name}
                                                                    {p.stirrupFormat && (
                                                                        <div className="mt-1 bg-orange-50 p-1.5 rounded border border-orange-200 text-[10px] text-orange-900 font-semibold space-y-1">
                                                                            <div className="flex gap-2 border-b border-orange-200 pb-1">
                                                                                <span className="uppercase text-orange-700">Estribos: {p.stirrupFormat}</span>
                                                                                <span>|</span>
                                                                                <span>{p.stirrupQty} Un</span>
                                                                            </div>
                                                                            <div className="flex flex-wrap gap-x-3 gap-y-1">
                                                                                <span>A: {p.stirrupA}</span>
                                                                                {['retangular', 'triangular', 'aberto', 'fechado'].includes(p.stirrupFormat) && <span>B: {p.stirrupB}</span>}
                                                                                {['aberto'].includes(p.stirrupFormat) && <span>C: {p.stirrupC}</span>}
                                                                                <span>Tam: {p.stirrupSize}</span>
                                                                                {p.stirrupGaugeId && <span className="font-bold text-orange-700">({gauges.find(g => g.id === p.stirrupGaugeId)?.gauge})</span>}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </td>
                                                                <td className="px-3 py-2 text-xs font-semibold text-slate-600">
                                                                    {['broca', 'viga', 'pilares', 'bloco', 'blocos'].some(t => (p.name || '').toLowerCase().includes(t)) && p.details ? (
                                                                        <div className="space-y-1">
                                                                            {p.details.map((d, idx) => (
                                                                                <div key={idx} className="bg-slate-50 p-1 rounded border border-slate-100 flex items-center gap-2">
                                                                                    <span className="font-bold">{d.irons} Ferros</span>
                                                                                    <span className="text-slate-400">|</span>
                                                                                    <span className="uppercase">Pos: {d.position ? d.position.charAt(0).toUpperCase() + d.position.slice(1) : 'Principal'}</span>
                                                                                    <span className="text-slate-400">|</span>
                                                                                    <span>Tam: {d.size}</span>
                                                                                    {d.gaugeId && (
                                                                                        <span className="text-[10px] text-indigo-600 font-bold ml-1">
                                                                                            ({gauges.find(g => g.id === d.gaugeId)?.gauge || ''})
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    ) : '-'}
                                                                    {!['broca', 'viga', 'pilares', 'bloco', 'blocos'].some(t => (p.name || '').toLowerCase().includes(t)) && p.gaugeId && (
                                                                        <div className="text-[10px] text-indigo-600 mt-1 font-bold">
                                                                            Bitola: {gauges.find(g => g.id === p.gaugeId)?.gauge || 'Desconhecida'} 
                                                                            {p.kg ? ` (${p.kg.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} kg)` : ''}
                                                                        </div>
                                                                    )}
                                                                </td>
                                                                <td className="px-3 py-2 flex items-center justify-end gap-3">
                                                                    <button onClick={() => {
                                                                        setPieceQty(p.qty.toString());
                                                                        setPieceName(p.name);
                                                                        if (p.stirrupFormat) {
                                                                            setPieceStirrupFormat(p.stirrupFormat);
                                                                            setStirrupQty(p.stirrupQty?.toString() || '');
                                                                            setStirrupA(p.stirrupA?.toString() || '');
                                                                            setStirrupB(p.stirrupB?.toString() || '');
                                                                            setStirrupC(p.stirrupC?.toString() || '');
                                                                            setStirrupGaugeId(p.stirrupGaugeId || '');
                                                                            setStirrupSpacing('');
                                                                        } else {
                                                                            setPieceStirrupFormat('');
                                                                        }
                                                                        if (p.details && p.details.length > 0) {
                                                                            setPieceDetails(p.details.map((d, i) => ({
                                                                                id: Date.now().toString() + i,
                                                                                irons: d.irons ? d.irons.toString() : '',
                                                                                position: d.position || 'principal',
                                                                                gaugeId: d.gaugeId || '',
                                                                                size: d.size ? d.size.toString() : '',
                                                                                format: d.format || 'reto',
                                                                                sideA: d.sideA ? d.sideA.toString() : '',
                                                                                sideB: d.sideB ? d.sideB.toString() : '',
                                                                                sideC: d.sideC ? d.sideC.toString() : ''
                                                                            })));
                                                                        } else {
                                                                            setPieceDetails([{ id: Date.now().toString(), irons: '', position: 'principal', format: 'reto', sideA: '', sideB: '', sideC: '', size: '', gaugeId: '' }]);
                                                                            setPieceGaugeId(p.gaugeId || '');
                                                                        }
                                                                        setPiecesList(prev => prev.filter(x => x.id !== p.id));
                                                                    }} className="text-indigo-500 hover:text-indigo-700 font-bold text-lg" title="Editar Peça">✏️</button>
                                                                    <button onClick={() => setPiecesList(prev => prev.filter(x => x.id !== p.id))} className="text-red-500 hover:text-red-700 font-bold text-lg" title="Remover Peça">✕</button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                        
                                        {piecesList.length > 0 && (
                                            <div className="mt-4 border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
                                                <div className="bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 border-b border-slate-200 uppercase tracking-wider flex items-center gap-2">
                                                    📊 Resumo do Aço
                                                </div>
                                                <table className="w-full text-left">
                                                     <thead className="bg-slate-50">
                                                         <tr>
                                                             <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase">Bitola</th>
                                                             <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase text-right">Peso (Kg)</th>
                                                         </tr>
                                                     </thead>
                                                     <tbody className="divide-y divide-slate-100">
                                                         {(() => {
                                                             const summary: Record<string, { gauge: string, name: string, kg: number }> = {};
                                                             piecesList.forEach(p => {
                                                                 if (['broca', 'viga', 'pilares', 'bloco', 'blocos'].some(t => (p.name || '').toLowerCase().includes(t))) {
                                                                     if (p.details && p.details.length > 0) {
                                                                         p.details.forEach(d => {
                                                                             const gauge = gauges.find(g => g.id === d.gaugeId);
                                                                             if (gauge && gauge.gauge) {
                                                                                 const dMetros = (p.qty * d.irons * d.size) / 100;
                                                                                 const bitolaVal = parseFloat(String(gauge.gauge || '').replace(/[^\d.,]/g, '').replace(',', '.'));
                                                                                 if (!isNaN(bitolaVal)) {
                                                                                     const massaMetro = Math.ceil(bitolaVal * bitolaVal * 0.006162 * 1000) / 1000;
                                                                                     const kg = dMetros * massaMetro;
                                                                                     if (!summary[gauge.id]) summary[gauge.id] = { gauge: gauge.gauge, name: gauge.commercialName || gauge.materialType || '', kg: 0 };
                                                                                     summary[gauge.id].kg += kg;
                                                                                 }
                                                                             }
                                                                         });
                                                                     }
                                                                     if (p.stirrupFormat && p.stirrupGaugeId && p.stirrupQty && p.stirrupSize && p.stirrupSize > 0) {
                                                                         const gauge = gauges.find(g => g.id === p.stirrupGaugeId);
                                                                         if (gauge && gauge.gauge) {
                                                                             const sMetros = (p.qty * p.stirrupQty * p.stirrupSize) / 100;
                                                                             const bitolaVal = parseFloat(String(gauge.gauge || '').replace(/[^\d.,]/g, '').replace(',', '.'));
                                                                             if (!isNaN(bitolaVal)) {
                                                                                 const massaMetro = Math.ceil(bitolaVal * bitolaVal * 0.006162 * 1000) / 1000;
                                                                                 const kg = sMetros * massaMetro;
                                                                                 if (!summary[gauge.id]) summary[gauge.id] = { gauge: gauge.gauge, name: gauge.commercialName || gauge.materialType || '', kg: 0 };
                                                                                 summary[gauge.id].kg += kg;
                                                                             }
                                                                         }
                                                                     }
                                                                     if (p.stirrupFormat2 && p.stirrupGaugeId2 && p.stirrupQty2 && p.stirrupSize2 && p.stirrupSize2 > 0) {
                                                                         const gauge = gauges.find(g => g.id === p.stirrupGaugeId2);
                                                                         if (gauge && gauge.gauge) {
                                                                             const sMetros = (p.qty * p.stirrupQty2 * p.stirrupSize2) / 100;
                                                                             const bitolaVal = parseFloat(String(gauge.gauge || '').replace(/[^\d.,]/g, '').replace(',', '.'));
                                                                             if (!isNaN(bitolaVal)) {
                                                                                 const massaMetro = Math.ceil(bitolaVal * bitolaVal * 0.006162 * 1000) / 1000;
                                                                                 const kg = sMetros * massaMetro;
                                                                                 if (!summary[gauge.id]) summary[gauge.id] = { gauge: gauge.gauge, name: gauge.commercialName || gauge.materialType || '', kg: 0 };
                                                                                 summary[gauge.id].kg += kg;
                                                                             }
                                                                         }
                                                                     }
                                                                 } else if (p.gaugeId && p.kg) {
                                                                     const gauge = gauges.find(g => g.id === p.gaugeId);
                                                                     if (gauge) {
                                                                         if (!summary[gauge.id]) summary[gauge.id] = { gauge: gauge.gauge, name: gauge.commercialName || gauge.materialType || '', kg: 0 };
                                                                         summary[gauge.id].kg += p.kg;
                                                                     }
                                                                 }
                                                             });
                                                             
                                                             let arameKg = 0;
                                                             if (newItem.tipo === 'ARMADO' && arameGaugeId && aramePercentage > 0) {
                                                                 const totalAco = Object.values(summary).reduce((acc, curr) => acc + curr.kg, 0);
                                                                 arameKg = (totalAco * aramePercentage) / 100;
                                                                 const arameGauge = arameGauges.find(g => g.id === arameGaugeId);
                                                                 if (arameGauge && arameKg > 0) {
                                                                     summary[arameGaugeId] = {
                                                                         gauge: arameGauge.gauge || '',
                                                                         name: arameGauge.commercialName || arameGauge.materialType || 'Arame',
                                                                         kg: arameKg
                                                                     };
                                                                 }
                                                             }
                                                             
                                                             const items = Object.values(summary).sort((a, b) => parseFloat(a.gauge.replace(/[^\d.,]/g, '').replace(',', '.')) - parseFloat(b.gauge.replace(/[^\d.,]/g, '').replace(',', '.')));
                                                             const totalGeral = items.reduce((acc, curr) => acc + curr.kg, 0);

                                                             return (
                                                                 <>
                                                                     {items.map((item, idx) => (
                                                                         <tr key={idx}>
                                                                             <td className="px-3 py-1.5 text-xs font-bold text-slate-700 uppercase">{item.name} {item.gauge}</td>
                                                                             <td className="px-3 py-1.5 text-xs font-black text-emerald-700 text-right">{item.kg.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} kg</td>
                                                                         </tr>
                                                                     ))}
                                                                     <tr className="bg-slate-100/50">
                                                                         <td className="px-3 py-2 text-xs font-black text-slate-800 uppercase text-right">Total Geral:</td>
                                                                         <td className="px-3 py-2 text-xs font-black text-indigo-700 text-right">{totalGeral.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} kg</td>
                                                                     </tr>
                                                                 </>
                                                             );
                                                         })()}
                                                     </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                ) : bitolasMode === 'DESENHO' ? (
                                    <div className="bg-white rounded-lg p-4 border border-slate-200">
                                        <div className="grid grid-cols-12 gap-3 mb-4 items-end">
                                            <div className="col-span-12 md:col-span-3 flex gap-2 items-end">
                                                <div className="flex-1">
                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 leading-tight">Tipo de Desenho</label>
                                                    <select 
                                                        className="w-full border border-slate-300 rounded p-2 text-sm font-bold uppercase focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                        value={drawingType} onChange={e => setDrawingType(e.target.value as any)}
                                                    >
                                                        <option value="barra">Barra</option>
                                                        <option value="ferro_l">Ferro L</option>
                                                        <option value="ferro_u">Ferro U</option>
                                                        <option value="espiral">Espiral</option>
                                                        <option value="estribo">Estribo</option>
                                                        <option value="caranguejo">Caranguejo</option>
                                                        <option value="bandeja">Bandeja</option>
                                                        <option value="circular">Circular</option>
                                                        <option value="custom">Personalizado</option>
                                                    </select>
                                                </div>
                                                <div className="w-20 h-20 border border-slate-300 rounded bg-slate-50 flex items-center justify-center p-1.5 shrink-0" title="Preview do Formato">
                                                    {(() => {
                                                        const stroke = "currentColor";
                                                        const sw = "6";
                                                        switch (drawingType) {
                                                            case 'barra': return <svg viewBox="0 0 100 30" className="w-full h-full text-slate-600">
                                                                <line x1="10" y1="20" x2="90" y2="20" stroke={stroke} strokeWidth={sw} strokeLinecap="round"/>
                                                                <text x="50" y="10" fill="red" fontSize="14" fontWeight="bold" textAnchor="middle">A</text>
                                                            </svg>;
                                                            case 'ferro_l': return <svg viewBox="0 0 100 100" className="w-full h-full text-slate-600">
                                                                <polyline points="30,20 30,75 80,75" fill="none" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round"/>
                                                                <text x="22" y="55" fill="red" fontSize="14" fontWeight="bold" textAnchor="end">A</text>
                                                                <text x="55" y="95" fill="red" fontSize="14" fontWeight="bold" textAnchor="middle">B</text>
                                                            </svg>;
                                                            case 'ferro_u': return <svg viewBox="0 0 100 100" className="w-full h-full text-slate-600">
                                                                <polyline points="25,30 25,75 75,75 75,30" fill="none" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round"/>
                                                                <text x="18" y="60" fill="red" fontSize="14" fontWeight="bold" textAnchor="end">A</text>
                                                                <text x="50" y="95" fill="red" fontSize="14" fontWeight="bold" textAnchor="middle">B</text>
                                                                <text x="82" y="60" fill="red" fontSize="14" fontWeight="bold">C</text>
                                                            </svg>;
                                                            case 'estribo': return <svg viewBox="0 0 100 100" className="w-full h-full text-slate-600">
                                                                <rect x="25" y="25" width="50" height="50" fill="none" stroke={stroke} strokeWidth={sw} strokeLinejoin="round"/>
                                                                <polyline points="25,45 45,25" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round"/>
                                                                <polyline points="45,25 25,25 25,45" fill="none" stroke={stroke} strokeWidth={sw} strokeLinejoin="round"/>
                                                                <text x="18" y="55" fill="red" fontSize="14" fontWeight="bold" textAnchor="end">A</text>
                                                                <text x="50" y="90" fill="red" fontSize="14" fontWeight="bold" textAnchor="middle">B</text>
                                                            </svg>;
                                                            case 'caranguejo': return <svg viewBox="0 0 100 100" className="w-full h-full text-slate-600">
                                                                <polyline points="15,75 30,60 30,40 70,40 70,60 85,45" fill="none" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round"/>
                                                                <text x="22" y="55" fill="red" fontSize="14" fontWeight="bold" textAnchor="end">A</text>
                                                                <text x="50" y="30" fill="red" fontSize="14" fontWeight="bold" textAnchor="middle">B</text>
                                                                <text x="82" y="70" fill="red" fontSize="14" fontWeight="bold">C</text>
                                                            </svg>;
                                                            case 'bandeja': return <svg viewBox="0 0 100 100" className="w-full h-full text-slate-600">
                                                                <polyline points="40,55 25,70 25,35 75,35 75,70 90,55" fill="none" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round"/>
                                                                <text x="50" y="25" fill="red" fontSize="14" fontWeight="bold" textAnchor="middle">A</text>
                                                                <text x="18" y="55" fill="red" fontSize="14" fontWeight="bold" textAnchor="end">B</text>
                                                                <text x="82" y="70" fill="red" fontSize="14" fontWeight="bold">C</text>
                                                            </svg>;
                                                            case 'circular': return <svg viewBox="0 0 100 100" className="w-full h-full text-slate-600">
                                                                <circle cx="50" cy="50" r="30" fill="none" stroke={stroke} strokeWidth={sw}/>
                                                                <text x="50" y="55" fill="red" fontSize="16" fontWeight="bold" textAnchor="middle">A</text>
                                                            </svg>;
                                                            case 'espiral': return <svg viewBox="0 0 100 100" className="w-full h-full text-slate-600">
                                                                <path d="M 20 45 Q 35 15 50 45 T 80 45" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round"/>
                                                                <path d="M 20 65 Q 35 25 50 65 T 80 65" fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" opacity="0.4"/>
                                                                <text x="50" y="95" fill="red" fontSize="12" fontWeight="bold" textAnchor="middle">A(D), B(P), C(H)</text>
                                                            </svg>;
                                                            case 'custom': return (
                                                                <button
                                                                    onClick={() => setIsDrawingBoardOpen(true)}
                                                                    className="w-full h-full flex flex-col items-center justify-center gap-1 text-indigo-600 hover:text-indigo-800 transition-colors bg-indigo-50 rounded"
                                                                >
                                                                    <span className="text-2xl leading-none">🖌️</span>
                                                                    <span className="text-[9px] font-bold text-center leading-tight">ABRIR<br/>PRANCHETA</span>
                                                                </button>
                                                            );
                                                            default: return null;
                                                        }
                                                    })()}
                                                </div>
                                            </div>
                                            <div className="col-span-12 md:col-span-1">
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 leading-tight">Qtd</label>
                                                <input 
                                                    type="number" min="1"
                                                    className="w-full border border-slate-300 rounded p-2 text-sm font-bold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                    value={drawingQty} onChange={e => setDrawingQty(e.target.value)}
                                                    placeholder="Ex: 10"
                                                />
                                            </div>
                                            
                                            {drawingType === 'custom' ? (
                                                customDrawingData && customDrawingData.labels && customDrawingData.labels.length > 0 ? (
                                                    <div className="col-span-12 md:col-span-4 grid grid-cols-2 gap-2">
                                                        {customDrawingData.labels.map(l => (
                                                            <div key={l.text}>
                                                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 leading-tight">
                                                                    {l.text} (cm)
                                                                </label>
                                                                <input 
                                                                    type="number" min="0" step="0.1"
                                                                    className="w-full border border-slate-300 rounded p-2 text-sm font-bold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                                    value={customDimensions[l.text] || ''} 
                                                                    onChange={e => setCustomDimensions(prev => ({...prev, [l.text]: e.target.value}))}
                                                                    placeholder="Ex: 50"
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="col-span-12 md:col-span-4 text-[10px] text-red-500 font-bold flex items-center bg-red-50 p-2 rounded border border-red-200">
                                                        ⚠️ Clique em ABRIR PRANCHETA para desenhar as linhas e colar as marcações A, B, C, etc.
                                                    </div>
                                                )
                                            ) : (
                                                <>
                                                    <div className="col-span-12 md:col-span-2">
                                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 leading-tight flex justify-between">
                                                            <span>{drawingType === 'espiral' ? 'A (Diâmetro)' : 'A (cm)'}</span>
                                                        </label>
                                                        <input 
                                                            type="number" min="0" step="0.1"
                                                            className="w-full border border-slate-300 rounded p-2 text-sm font-bold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                            value={drawingA} onChange={e => setDrawingA(e.target.value)}
                                                            placeholder="Ex: 50"
                                                        />
                                                    </div>
                                                    {['ferro_l', 'ferro_u', 'espiral', 'estribo', 'caranguejo', 'bandeja'].includes(drawingType) && (
                                                        <div className="col-span-12 md:col-span-2">
                                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 leading-tight">
                                                                {drawingType === 'espiral' ? 'B (Passo cm)' : 'B (cm)'}
                                                            </label>
                                                            <input 
                                                                type="number" min="0" step="0.1"
                                                                className="w-full border border-slate-300 rounded p-2 text-sm font-bold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                                value={drawingB} onChange={e => setDrawingB(e.target.value)}
                                                                placeholder="Ex: 50"
                                                            />
                                                        </div>
                                                    )}
                                                    {['ferro_u', 'espiral', 'caranguejo', 'bandeja'].includes(drawingType) && (
                                                        <div className="col-span-12 md:col-span-2">
                                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 leading-tight">
                                                                {drawingType === 'espiral' ? 'C (Altura cm)' : 'C (cm)'}
                                                            </label>
                                                            <input 
                                                                type="number" min="0" step="0.1"
                                                                className="w-full border border-slate-300 rounded p-2 text-sm font-bold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                                value={drawingC} onChange={e => setDrawingC(e.target.value)}
                                                                placeholder="Ex: 50"
                                                            />
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                            
                                            <div className="col-span-12 md:col-span-2">
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 leading-tight">Bitola</label>
                                                <select 
                                                    className="w-full border border-slate-300 rounded p-2 text-sm font-bold uppercase focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                    value={drawingGaugeId} onChange={e => setDrawingGaugeId(e.target.value)}
                                                >
                                                    <option value="">SELECIONE...</option>
                                                    {vergalhaoGauges.map(g => (
                                                        <option key={g.id} value={g.id}>
                                                            {g.commercialName || g.materialType} {g.gauge}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            
                                            <div className="col-span-12 flex items-end">
                                                <button 
                                                    onClick={() => {
                                                        const qty = parseInt(drawingQty) || 0;
                                                        if (qty <= 0 || !drawingGaugeId) return;
                                                        
                                                        const a = parseFloat(drawingA) || 0;
                                                        const b = parseFloat(drawingB) || 0;
                                                        const c = parseFloat(drawingC) || 0;
                                                        
                                                        let totalSize = 0;
                                                        let dimensionsMap: Record<string, number> = {};
                                                        
                                                        if (drawingType === 'custom') {
                                                            if (!customDrawingData || !customDrawingData.labels || customDrawingData.labels.length === 0) {
                                                                alert("Desenhe e adicione rótulos na prancheta antes de adicionar o desenho.");
                                                                return;
                                                            }
                                                            customDrawingData.labels.forEach(l => {
                                                                const val = parseFloat(customDimensions[l.text]) || 0;
                                                                totalSize += val;
                                                                dimensionsMap[l.text] = val;
                                                            });
                                                        } else {
                                                            if (drawingType === 'barra' || drawingType === 'circular') {
                                                                totalSize = drawingType === 'circular' ? (a * 3.14) + 10 : a;
                                                            } else if (drawingType === 'ferro_l' || drawingType === 'estribo') {
                                                                totalSize = drawingType === 'estribo' ? (a * 2 + b * 2) + 10 : (a + b);
                                                            } else if (drawingType === 'ferro_u') {
                                                                totalSize = a + b + c;
                                                            } else if (drawingType === 'caranguejo') {
                                                                totalSize = (a * 2) + b + (c * 2);
                                                            } else if (drawingType === 'bandeja') {
                                                                totalSize = a + (b * 2) + (c * 2);
                                                            } else if (drawingType === 'espiral') {
                                                                const numEspiras = b > 0 ? c / b : 0;
                                                                const compEspira = Math.sqrt(Math.pow(Math.PI * a, 2) + Math.pow(b, 2));
                                                                totalSize = numEspiras * compEspira;
                                                            }
                                                        }
                                                        
                                                        const gauge = gauges.find(g => g.id === drawingGaugeId);
                                                        let kg = 0;
                                                        if (gauge && gauge.gauge && totalSize > 0) {
                                                            const bitolaVal = parseFloat(String(gauge.gauge || '').replace(/[^\d.,]/g, '').replace(',', '.'));
                                                            if (!isNaN(bitolaVal)) {
                                                                const massaMetro = Math.ceil(bitolaVal * bitolaVal * 0.006162 * 1000) / 1000;
                                                                kg = (qty * totalSize / 100) * massaMetro;
                                                            }
                                                        }

                                                        const newPiece = {
                                                            id: Date.now().toString(),
                                                            type: drawingType,
                                                            qty,
                                                            gaugeId: drawingGaugeId,
                                                            a: drawingType !== 'custom' ? a : undefined,
                                                            b: drawingType !== 'custom' ? b : undefined,
                                                            c: drawingType !== 'custom' ? c : undefined,
                                                            dimensions: drawingType === 'custom' ? dimensionsMap : undefined,
                                                            customData: drawingType === 'custom' ? customDrawingData : undefined,
                                                            totalSize,
                                                            kg,
                                                        };
                                                        
                                                        setDrawingPieces(prev => [...prev, newPiece]);
                                                        
                                                        setDrawingQty('');
                                                        setDrawingA('');
                                                        setDrawingB('');
                                                        setDrawingC('');
                                                        setDrawingGaugeId('');
                                                        setCustomDimensions({});
                                                    }}
                                                    className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 px-4 py-2 text-sm font-bold rounded-lg w-full transition-colors mt-2"
                                                >
                                                    ➕ Adicionar Desenho
                                                </button>
                                            </div>
                                        </div>

                                        {drawingPieces.length > 0 && (
                                            <div className="mt-4 border border-slate-200 rounded-lg overflow-hidden">
                                                <table className="w-full text-left bg-white">
                                                    <thead className="bg-slate-50">
                                                        <tr>
                                                            <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase">Qtd</th>
                                                            <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase">Desenho</th>
                                                            <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase">Medidas</th>
                                                            <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase">Bitola</th>
                                                            <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase text-right">Peso (kg)</th>
                                                            <th className="px-3 py-2 w-10"></th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {drawingPieces.map(p => {
                                                            const gauge = gauges.find(g => g.id === p.gaugeId);
                                                            const desc = p.type === 'custom' 
                                                                    ? Object.entries(p.dimensions || {}).map(([key, val]) => `${key}: ${val}cm`).join(' ') 
                                                                    : (p.a ? `A: ${p.a}cm ` : '') + (p.b ? `B: ${p.b}cm ` : '') + (p.c ? `C: ${p.c}cm` : '');
                                                            return (
                                                                <tr key={p.id}>
                                                                    <td className="px-3 py-2 text-sm font-bold">{p.qty}</td>
                                                                    <td className="px-3 py-2 text-sm font-bold uppercase">
                                                                        <div className="flex flex-col items-center">
                                                                            <span className="mb-1 text-[10px] text-slate-500">{p.type === 'custom' ? 'PERSONALIZADO' : p.type.replace('_', ' ')}</span>
                                                                            {renderTableDrawingSvg(p)}
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-3 py-2 text-xs font-semibold text-slate-600">
                                                                        <div className="text-xs font-bold text-slate-600">{desc}</div>
                                                                        <div className="text-[10px] text-slate-400 font-bold">Tam: {p.totalSize.toLocaleString('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 1})}cm/un</div>
                                                                    </td>
                                                                    <td className="px-3 py-2 text-xs font-bold text-indigo-700 uppercase">
                                                                        {gauge ? `${gauge.commercialName || gauge.materialType} ${gauge.gauge}` : ''}
                                                                    </td>
                                                                    <td className="px-3 py-2 text-sm font-black text-emerald-700 text-right">
                                                                        {p.kg.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                                                    </td>
                                                                    <td className="px-3 py-2 text-center">
                                                                        <button 
                                                                            onClick={() => setDrawingPieces(prev => prev.filter(dp => dp.id !== p.id))}
                                                                            className="text-red-400 hover:text-red-600 font-bold"
                                                                        >
                                                                            ✕
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                                <div className="bg-slate-100/50 px-3 py-2 text-right">
                                                    <span className="text-xs font-black text-slate-800 uppercase">Total: </span>
                                                    <span className="text-sm font-black text-indigo-700">{drawingPieces.reduce((acc, p) => acc + p.kg, 0).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} kg</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : [...vergalhaoGauges, ...arameGauges].length === 0 ? (
                                    <p className="text-center text-slate-500 p-4">Nenhum material cadastrado em Configuração de Materiais.</p>
                                ) : (
                                    <table className="w-full text-left border-collapse bg-white rounded-lg overflow-hidden shadow-sm border border-slate-200">
                                        <thead>
                                            <tr className="bg-slate-100 text-slate-600 text-[10px] uppercase tracking-wider">
                                                <th className="p-3 font-bold">Material / Dimensão</th>
                                                <th className="p-3 font-bold text-center">Peso Unit.</th>
                                                <th className="p-3 font-bold text-right">R$ / Kg</th>
                                                {bitolasMode === 'METRO' && (
                                                    <th className="p-3 font-bold text-right w-24">Massa/m</th>
                                                )}
                                                <th className="p-3 font-bold text-right w-32">Quantidade ({bitolasMode === 'KG' ? 'Kg' : 'Metros'})</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {[...vergalhaoGauges, ...arameGauges].map(g => (
                                                <tr key={g.id} className="border-b border-slate-100 hover:bg-slate-50">
                                                    <td className="p-3 text-sm font-bold text-slate-700 uppercase">
                                                        {g.commercialName || g.materialType} {g.gauge}
                                                    </td>
                                                    <td className="p-3 text-sm font-bold text-slate-500 text-center">
                                                        {String(g.rawWeightValue || 0).replace('.', ',')} kg
                                                    </td>
                                                    <td className="p-3 text-sm font-black text-emerald-600 text-right group">
                                                        <div className="flex items-center justify-end gap-2">
                                                            {(() => {
                                                                const defaultPricePerKg = (g.rawWeightValue && g.rawWeightValue > 0) 
                                                                    ? (g.purchasePrice || 0) / g.rawWeightValue 
                                                                    : (g.purchasePrice || 0);
                                                                const currentPrice = customPrices[g.id] !== undefined ? customPrices[g.id] : defaultPricePerKg;
                                                                return `R$ ${currentPrice.toFixed(2)}`;
                                                            })()}
                                                            <button 
                                                                onClick={() => {
                                                                    const currentPrice = customPrices[g.id] !== undefined ? customPrices[g.id] : ((g.rawWeightValue && g.rawWeightValue > 0) ? (g.purchasePrice || 0) / g.rawWeightValue : (g.purchasePrice || 0));
                                                                    setTempPrice(currentPrice.toFixed(2));
                                                                    setAuthModal({ isOpen: true, gaugeId: g.id });
                                                                }}
                                                                className="text-slate-400 hover:text-indigo-600 transition-colors"
                                                                title="Editar Preço (Requer Senha de Gestor)"
                                                            >
                                                                ✏️
                                                            </button>
                                                        </div>
                                                    </td>
                                                    {bitolasMode === 'METRO' && (
                                                        <td className="p-3 text-sm font-bold text-slate-500 text-right">
                                                            {(() => {
                                                                const bitolaVal = parseFloat(String(g.gauge || '').replace(/[^\d.,]/g, '').replace(',', '.'));
                                                                if (isNaN(bitolaVal)) return '-';
                                                                const massaMetro = Math.ceil(bitolaVal * bitolaVal * 0.006162 * 1000) / 1000;
                                                                return `${massaMetro.toFixed(3).replace('.', ',')} kg/m`;
                                                            })()}
                                                        </td>
                                                    )}
                                                    <td className="p-3 flex flex-col items-end">
                                                        <input 
                                                            type="number" 
                                                            step="0.01" 
                                                            className="w-full border border-slate-300 rounded p-1 text-right text-sm font-bold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                            placeholder="0.00"
                                                            value={bitolasMode === 'KG' ? (bitolasQuantities[g.id] || '') : (bitolasMeters[g.id] || '')}
                                                            onChange={e => {
                                                                const val = parseFloat(e.target.value);
                                                                if (bitolasMode === 'KG') {
                                                                    setBitolasQuantities(prev => ({
                                                                        ...prev,
                                                                        [g.id]: isNaN(val) ? 0 : val
                                                                    }));
                                                                } else {
                                                                    setBitolasMeters(prev => ({
                                                                        ...prev,
                                                                        [g.id]: isNaN(val) ? 0 : val
                                                                    }));
                                                                }
                                                            }}
                                                        />
                                                        {bitolasMode === 'METRO' && (bitolasMeters[g.id] || 0) > 0 && (
                                                            <span className="text-[10px] text-slate-500 font-bold mt-1">
                                                                {(() => {
                                                                    const bitolaVal = parseFloat(g.gauge.replace(/[^\d.,]/g, '').replace(',', '.'));
                                                                    if (isNaN(bitolaVal)) return '0 kg';
                                                                    const massaMetro = Math.ceil(bitolaVal * bitolaVal * 0.006162 * 1000) / 1000;
                                                                    const kg = (bitolasMeters[g.id] * massaMetro);
                                                                    return `≈ ${kg.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} kg`;
                                                                })()}
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>

                        <div className="bg-white p-4 border-t border-slate-200 flex justify-between items-center shrink-0">
                            <div className="text-sm font-bold text-slate-500">
                                {bitolasMode === 'KG' ? 'Preencha os Kg de cada bitola que irá usar.' : (bitolasMode === 'METRO' ? 'Preencha a metragem total (metros) de cada bitola.' : 'Preencha a quantidade para cada tipo de peça estrutural.')}
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setIsBitolasModalOpen(false)} className="px-4 py-2 rounded-lg font-bold text-slate-600 hover:bg-slate-100 transition-colors">
                                    Cancelar
                                </button>
                                <button 
                                    onClick={handleConfirmBitolas} 
                                    className="px-6 py-2 rounded-lg font-black text-white bg-indigo-600 hover:bg-indigo-700 shadow-md transition-all flex items-center gap-2"
                                >
                                    Confirmar e Calcular
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isDrawingBoardOpen && (
                <EstriboDrawingBoard 
                    initialData={customDrawingData}
                    requiredSides={['A','B','C','D','E','F','G','H','I','J']}
                    onSave={(data) => {
                        setCustomDrawingData(data);
                        setIsDrawingBoardOpen(false);
                    }}
                    onClose={() => setIsDrawingBoardOpen(false)}
                />
            )}

            {/* Auth Modal para Editar Preço */}
            {authModal.isOpen && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[300] p-4 animate-in fade-in">
                    <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl flex flex-col overflow-hidden border-2 border-slate-300">
                        <div className="bg-slate-800 p-4 shrink-0">
                            <h3 className="text-lg font-black text-white flex items-center gap-2">
                                🔒 Autorização de Gestor
                            </h3>
                        </div>
                        <div className="p-5 flex flex-col gap-4">
                            <p className="text-sm text-slate-600">Insira a senha de um Administrador ou Gestor para alterar o preço deste material neste orçamento.</p>
                            
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Senha do Gestor</label>
                                <input 
                                    type="password"
                                    className="w-full border border-slate-300 rounded p-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    value={authPassword}
                                    onChange={e => setAuthPassword(e.target.value)}
                                    placeholder="••••••••"
                                />
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Novo Preço R$ / KG</label>
                                <input 
                                    type="number"
                                    step="0.01"
                                    className="w-full border border-slate-300 rounded p-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-bold text-emerald-700"
                                    value={tempPrice}
                                    onChange={e => setTempPrice(e.target.value)}
                                />
                            </div>
                            
                            {authError && (
                                <p className="text-xs text-red-600 font-bold bg-red-50 p-2 rounded border border-red-200">{authError}</p>
                            )}
                        </div>
                        <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end gap-3">
                            <button 
                                onClick={() => {
                                    setAuthModal({ isOpen: false, gaugeId: null });
                                    setAuthPassword('');
                                    setAuthError('');
                                }} 
                                className="px-4 py-2 rounded-lg font-bold text-slate-600 hover:bg-slate-200 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={async () => {
                                    setAuthError('');
                                    if (!authPassword) {
                                        setAuthError('Digite a senha.');
                                        return;
                                    }
                                    try {
                                        const users = await fetchTable<User>('app_users');
                                        const manager = users.find(u => u.password === authPassword && (u.role === 'admin' || u.role === 'gestor'));
                                        if (!manager) {
                                            setAuthError('Senha inválida ou usuário sem permissão.');
                                            return;
                                        }
                                        
                                        // Authorized!
                                        const newPrice = parseFloat(tempPrice);
                                        if (isNaN(newPrice)) {
                                            setAuthError('Preço inválido.');
                                            return;
                                        }
                                        if (authModal.gaugeId) {
                                            setCustomPrices(prev => ({ ...prev, [authModal.gaugeId as string]: newPrice }));
                                        }
                                        
                                        setAuthModal({ isOpen: false, gaugeId: null });
                                        setAuthPassword('');
                                    } catch (err) {
                                        setAuthError('Erro ao validar senha.');
                                    }
                                }} 
                                className="px-6 py-2 font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-lg shadow-md transition-colors"
                            >
                                Liberar e Aplicar
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Modal Configuração de Pagamento */}
            {isPaymentConfigOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[400] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
                        <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center text-white">
                            <h3 className="font-black flex items-center gap-2">⚙️ Configurar Taxas de Cartão</h3>
                            <button onClick={() => setIsPaymentConfigOpen(false)} className="text-white/70 hover:text-white">&times;</button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Taxa Cartão 1x (%)</label>
                                <input 
                                    type="number" step="0.01" min="0"
                                    className="w-full border border-slate-300 rounded p-2 focus:border-indigo-500"
                                    value={paymentFees.card_1x}
                                    onChange={e => setPaymentFees(prev => ({...prev, card_1x: parseFloat(e.target.value) || 0}))}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Taxa Cartão 2x (%)</label>
                                <input 
                                    type="number" step="0.01" min="0"
                                    className="w-full border border-slate-300 rounded p-2 focus:border-indigo-500"
                                    value={paymentFees.card_2x}
                                    onChange={e => setPaymentFees(prev => ({...prev, card_2x: parseFloat(e.target.value) || 0}))}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Taxa Cartão 3x (%)</label>
                                <input 
                                    type="number" step="0.01" min="0"
                                    className="w-full border border-slate-300 rounded p-2 focus:border-indigo-500"
                                    value={paymentFees.card_3x}
                                    onChange={e => setPaymentFees(prev => ({...prev, card_3x: parseFloat(e.target.value) || 0}))}
                                />
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 border-t flex justify-end gap-2">
                            <button onClick={() => setIsPaymentConfigOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-600">Cancelar</button>
                            <button onClick={async () => {
                                try {
                                    await supabase.from('system_settings').upsert({ key: 'payment_fees', value: paymentFees }, { onConflict: 'key' });
                                    setIsPaymentConfigOpen(false);
                                } catch (e) {
                                    console.error(e);
                                    alert("Erro ao salvar configurações");
                                }
                            }} className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded hover:bg-indigo-700">Salvar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
