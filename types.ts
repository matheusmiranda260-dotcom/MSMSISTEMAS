// types.ts

export type Page = 'login' | 'menu' | 'stock' | 'stockAdd' | 'stockTransfer' | 'documents' | 'finishedGoods' | 'productionOrder' | 'productionDashboard' | 'meetingsTasks' | 'continuousImprovement' | 'peopleManagement' | 'reports' | 'userManagement' | 'gaugesManager' | 'partsManager' | 'workInstructions' | 'people' | 'finished_goods' | 'spare_parts' | 'quality' | 'instructions' | 'weighing' | 'meetings' | 'downtimeConfigs' | 'desbobinadeira' | 'desbobinadeiraDashboard' | 'desbobinadeiraInProgress' | 'desbobinadeiraPending' | 'desbobinadeiraCompleted' | 'desbobinadeiraReports' | 'productionOrderDesbobinadeira' | 'trefila' | 'trefilaInProgress' | 'trefilaPending' | 'trefilaCompleted' | 'trefilaReports' | 'trefilaParts' | 'trefilaWeighing' | 'trefilaRings' | 'trelica' | 'trelicaInProgress' | 'trelicaPending' | 'trelicaCompleted' | 'trelicaReports' | 'trelicaParts' | 'productionOrderTrelica' | 'labelConfig' | 'partnerConfig' | 'pointingSystem';

export interface DowntimeConfig {
    id: string;
    reason: string;
    thresholdMinutes: number;
    machineType: string;
    isActive: boolean;
}

export interface Document {
    id: string;
    title: string;
    category?: string;
    url: string;
    createdAt?: string;
    author?: string;
    fileType?: string;
}

export interface EmployeeDocument {
    id: string;
    employeeId: string;
    title: string;
    type: string;
    url: string;
    createdAt?: string;
}

export type MachineType = 'Corte-01' | 'Corte-02' | 'Geral' | 'Empilhadeira' | 'Desbobinadeira 1' | 'Trefila 1' | 'Trefila 2' | 'Treliça 1' | 'Treliça 2' | 'Trefila' | 'Treliça';

export type MaterialType = 'Fio Máquina' | 'Sucata' | 'CA-60' | 'CA-50';

export type Bitola = string; // e.g., '3.40', '4,20', '8.00'

export interface User {
    id: string;
    username: string;
    password?: string;
    role: 'admin' | 'user' | 'gestor';
    permissions?: Partial<Record<Page, boolean>>;
    employeeId?: string;
    isOnline?: boolean;
    loginCount?: number;
    lastLoginAt?: string;
}

export interface Employee {
    id: string;
    name: string;
    photoUrl?: string; // Mapped from photo_url
    sector: string;
    shift: string;
    active: boolean;
    appUserId?: string;
    createdAt?: string;

    // Personnel Details
    jobTitle?: string;
    admissionDate?: string;
    birthDate?: string;
    maritalStatus?: string;
    childrenCount?: number;
    phone?: string;
    email?: string;
    managerId?: string;
    orgPositionId?: string;
    assignedMachine?: string;
}

export interface StockItem {
    id: string;
    internalLot: string;
    supplierLot?: string;
    runNumber?: string;
    model?: string;
    bitola: Bitola;
    quantity?: number;
    weight?: number;
    labelWeight?: number;
    initialQuantity?: number;
    remainingQuantity: number;
    sector?: string;
    materialType: MaterialType | string;
    supplier?: string;
    nfe?: string;
    conferenceNumber?: string;
    entryDate?: string;
    status: string;
    history?: any[];
    lastMovement?: string;
    subSlot?: string;
    productionOrderIds?: string[];
    location?: string;
    lastAuditDate?: string;
    auditObservation?: string;
    steelType?: string;
    packagingType?: string;
    qtyPerPackaging?: number;
    pieceSize?: number;
    qtyPackages?: number;
    totalPieces?: number;
}

export interface ConferenceLotData {
    internalLot: string;
    runNumber: string;
    steelType: string;
    materialType: string | MaterialType;
    bitola: Bitola;
    labelWeight: number;
    supplier?: string;
    packagingType?: string;
    qtyPerPackaging?: number;
    pieceSize?: number;
    qtyPackages?: number;
    totalPieces?: number;
    labelWeightInput?: string;
}

export interface ConferenceData {
    id: string;
    date: string;
    entryDate: string;
    operator: string;
    supplier: string;
    nfe: string;
    conferenceNumber: string;
    lots: ConferenceLotData[];
}

export interface ProductionOrderData {
    id: string;
    orderNumber: string;
    startTime: string;
    endTime?: string;
    creationDate?: string;
    status: 'Inativa' | 'Ativa' | 'Finalizado' | 'pending' | 'completed' | 'Cancelada' | string;
    machine: MachineType;
    operator: string;
    targetBitola: Bitola;
    trelicaModel?: string;
    tamanho?: string;
    quantityToProduce: number;
    scraps?: { type: string; weight: number }[];
    stops?: { reason: string; duration: number }[];
    totalProducedMeters?: number;
    totalProducedWeight?: number;
    actualProducedWeight?: number;
    actualProducedQuantity?: number;
    plannedOutputWeight?: number;
    averageSpeed?: number;
    summary?: any;
    selectedLotIds?: any;
    totalWeight?: number;
    weighedPackages?: any[];
    processedLots?: any[];
    downtimeEvents?: any[];
    operatorLogs?: any[];
    activeLotProcessing?: { lotId: string; startTime: string; speed?: number };
    pontas?: Ponta[];
    lastQuantityUpdate?: string;
    scrapWeight?: number;
    scrapx?: { type: string; weight: number }[]; // Compatibility if typo was used
    inputBitola?: string;
    isGhostOrder?: boolean;
    trelicaSuperior?: string;
    trelicaInferior?: string;
    trelicaSinusoide?: string;
}

export interface TransferRecord {
    id: string;
    date: string;
    operator: string;
    destinationSector: string;
    transferredLots: TransferredLotInfo[];
}

export interface TransferredLotInfo {
    id?: string;
    lotId?: string;
    internalLot?: string;
    materialType?: string;
    bitola?: string;
    transferredQuantity?: number;
    model?: string;
    quantity?: number;
    weight?: number;
    originalSector?: string;
}

export interface ProductionRecord {
    id: string;
    productionOrderId?: string;
    date: string;
    machine: MachineType;
    operator?: string;
    producedWeight: number;
    producedQuantity?: number;
    bitola?: Bitola;
    model?: string;
    consumedLots?: any[];
}

export interface PartsRequest {
    id: string;
    date: string;
    operator: string;
    machine: MachineType;
    productionOrderId: string;
    partDescription: string;
    quantity: number;
    priority: 'Normal' | 'Urgente';
    status: 'Pendente' | 'Atendido';
}

export interface ShiftReport {
    id: string;
    machine: MachineType;
    operator: string;
    productionOrderId: string;
    orderNumber?: string;
    targetBitola?: Bitola;
    trelicaModel?: string;
    tamanho?: string;
    quantityToProduce?: number;
    shiftStartTime?: string;
    shiftEndTime?: string;
    processedLots?: any[];
    downtimeEvents?: any[];
    totalProducedQuantity?: number;
    totalProducedWeight?: number;
    totalProducedMeters?: number;
    totalScrapWeight?: number;
    scrapPercentage?: number;
    date?: string;

    // Optional old fields
    startTime?: string;
    endTime?: string;
    totalWeight?: number;
    totalPcs?: number;
    scraps?: { type: string; weight: number }[];
    stops?: { reason: string; duration: number }[];
}

export interface ProcessedLot {
    lotId: string;
    finalWeight: number | null;
    measuredGauge?: number;
    startTime: string;
    endTime: string;
}

export interface DowntimeEvent {
    id?: string;
    stopTime: string;
    resumeTime: string | null;
    reason: string;
    justification?: string;
}

export interface OperatorLog {
    operator: string;
    startTime: string;
    endTime?: string | null;
    startQuantity?: number;
    endQuantity?: number;
}

export interface WeighedPackage {
    id?: string;
    weight: number;
    timestamp: string;
    packageNumber: number;
    quantity?: number;
}













export interface StockMovement {
    id: string;
    date: string;
    type: 'transfer' | 'adjustment' | 'out' | 'addition';
    from: 'virtual' | 'physical' | 'system' | 'out' | 'production';
    to: 'virtual' | 'physical' | 'system' | 'out' | 'production';
    quantity: number;
    operator: string;
    observations?: string;
}


export interface KaizenAction {
    id: string;
    date: string;
    description: string;
    photoUrl?: string;
    type: 'action' | 'resolution';
}

export interface KaizenProblem {
    id: string;
    description: string;
    sector: string;
    responsible: string;
    status: 'Aberto' | 'Em melhoria' | 'Resolvido';
    date: string;
    photoUrl?: string;
    history: KaizenAction[];
    responsibleIds?: string[];
}

export interface MeetingItem {
    id: string;
    content: string;
    completed: boolean;
    completedAt?: string;
    itemType?: 'improvement' | 'idea';
    dueDate?: string;
    category?: string;
    pauta?: string;
}

export interface Meeting {
    id: string;
    title: string;
    meetingDate: string;
    categoryId?: string;
    createdAt?: string;
    author?: string;
    items: MeetingItem[];
}

export interface MeetingCategory {
    id: string;
    label: string;
    icon_name?: string;
}

export interface StickyNote {
    id: string;
    content: string;
    color: string;
    author: string;
    date: string;
    completed?: boolean;
}

export interface StockGauge {
    id: string;
    gauge: string;
    materialType: MaterialType | string;
    minWeight?: number;
    idealWeight?: number;
    productCode?: string;
    technicalDescription?: string;
    purchasePrice?: number;
    commercialName?: string;
    bitolaNominal?: string;
    comercialEstimada?: string;
    lotValidity?: string;
    status?: string;
    weightPerMeter?: number;
    pieceSize?: number;
    weightType?: string;
    weightUnit?: string;
    rawWeightValue?: number;
    itemType?: string; // 'materia_prima' | 'produto_composto'
    autoGenerateLot?: boolean;
    defaultSteelType?: string;
    customFieldLabel?: string;
    customFieldOptions?: string;
    customFieldValue?: string;
    packagingType?: string;
    qtyPerPackaging?: number;
    imageUrl?: string;
}

export interface GaugeComponent {
    id: string;
    parentGaugeId: string;
    componentGaugeId: string;
    funcao?: string;
    consumption: number;
    consumptionType?: 'quantidade' | 'metro' | 'peso';
    consumptionValue?: number;
}



export interface Evaluation {
    id: string;
    employeeId: string;
    evaluator: string;
    date: string;
    organizationScore: number;
    cleanlinessScore: number;
    effortScore: number;
    communicationScore: number;
    improvementScore: number;
    totalScore: number;
    note?: string;
    photoUrl?: string;
}

export interface TechnicalEvaluation {
    id: string;
    employeeId: string;
    evaluator: string;
    date: string;
    monthNum: number;
    machineType: 'Treliça';
    
    // Conhecimento (Questões)
    q1Answer?: string;
    q1Score: number;
    q2Answer?: string;
    q2Score: number;
    q3Answer?: string;
    q3Score: number;
    q4Answer?: string;
    q4Score: number;
    q5Answer?: string;
    q5Score: number;
    
    // Habilidade (Prática)
    h1Score: number;
    h2Score: number;
    h3Score: number;
    h4Score: number;
    
    // Atitude (Comportamento)
    a1Score: number;
    a2Score: number;
    a3Score: number;
    a4Score: number;
    
    // Geral
    totalScore: number;
    note?: string;
}

export interface Achievement {
    id: string;
    employeeId: string;
    type: string;
    title: string;
    description?: string;
    date: string;
}

export interface EmployeeCourse {
    id: string;
    employeeId: string;
    courseName: string;
    institution?: string;
    educationType?: string;
    completionDate?: string | null;
    expiryDate?: string | null;
    workloadHours?: number | null;
    status: string;
    attachmentUrl?: string | null;
}

export interface EmployeeAbsence {
    id: string;
    employeeId: string;
    type: string;
    startDate: string;
    endDate?: string | null;
    reason: string;
    attachmentUrl?: string | null;
}

export interface EmployeeVacation {
    id: string;
    employeeId: string;
    period?: string;
    startDate: string;
    endDate: string;
    status: string;
}

export interface EmployeeResponsibility {
    id: string;
    employeeId: string;
    description: string;
    isCritical: boolean;
}

export interface OrgUnit {
    id: string;
    name: string;
    unitType?: string;
    parentId?: string;
    displayOrder: number;
}

export interface OrgPosition {
    id: string;
    orgUnitId: string;
    title: string;
    description?: string;
    isLeadership: boolean;
    displayOrder: number;
}

export interface EmployeeDocument {
    id: string;
    employeeId: string;
    title: string;
    type: string;
    url: string;
    createdAt?: string;
}



export interface SparePart {
    id: string;
    name: string;
    model: string;
    machine: string;
    currentStock: number;
    minStock: number;
    imageUrl?: string;
}

export interface PartUsage {
    id: string;
    date: string;
    quantity: number;
    machine: string;
    reason: string;
    user: string;
    type: 'IN' | 'OUT';
}

export interface InstructionStep {
    id: string;
    order: number;
    title: string;
    description: string;
    photoUrl?: string;
}

export interface WorkInstruction {
    id: string;
    title: string;
    machine: string;
    description: string;
    steps: InstructionStep[];
    updatedAt?: string;
}

export interface UserAccessLog {
    id: string;
    userId: string;
    username: string;
    loginAt: string;
}

export const MaterialOptions = ['Fio Máquina', 'CA-60'];
export const FioMaquinaBitolaOptions = ['8.00', '7.00', '6.50', '6.35', '5.50'];
export const CA60BitolaOptions = ['3.20', '3.40', '3.80', '4.20', '4.40', '4.90', '5.00', '5.50', '5.60', '5.80', '6.00', '6.35', '7.00'];
export const SteelTypeOptions = ['1006', '1008', '1010', '1012', '1015', '1018', 'Outro'];

export const TrefilaBitolaOptions = ['3.40', '3.80', '4.20', '4.60', '5.00', '5.40', '6.00', '6.35', '3.20', '5.60', '5.80', '8.00', '6.00', '5.00'] as const;

export const DOWNTIME_THRESHOLDS: Record<string, number> = {
    'Enrosco de fio': 15,
    'Falha no sensor': 10,
    'Quebra fio': 20,
    'Setup': 180,
    'Lubrificação': 10,
    'Limpeza de eletrodos': 15,
    'Limpar eletrodos': 15,
    'Limpeza': 15,
    'Manutenção': 60,
    'Mecanica': 60,
    'Eletrica': 60,
    'Outros': 15,
    'Preparação': 15
};

export const trelicaModels = [
    { cod: 'H6LE12S', modelo: 'H-6 LEVE (ESPAÇADOR)', tamanho: '12', superior: '5,4', inferior: '3,2', senozoide: '3,2', pesoFinal: '5,502' },
    { cod: 'H6_12', modelo: 'H-6', tamanho: '12', superior: '5,6', inferior: '3,8', senozoide: '3,2', pesoFinal: '6,288' },
    { cod: 'H8L6', modelo: 'H-8 LEVE', tamanho: '6', superior: '5,6', inferior: '3,2', senozoide: '3,2', pesoFinal: '2,898' },
    { cod: 'H8L12', modelo: 'H-8 LEVE', tamanho: '12', superior: '5,6', inferior: '3,2', senozoide: '3,2', pesoFinal: '5,797' },
    { cod: 'H8M6', modelo: 'H-8 MÉDIA', tamanho: '6', superior: '5,6', inferior: '3,8', senozoide: '3,2', pesoFinal: '3,209' },
    { cod: 'H8M12', modelo: 'H-8 MÉDIA', tamanho: '12', superior: '5,6', inferior: '3,8', senozoide: '3,2', pesoFinal: '6,418' },
    { cod: 'H8P6', modelo: 'H-8 PESADA', tamanho: '6', superior: '6', inferior: '3,8', senozoide: '4,2', pesoFinal: '4,087' },
    { cod: 'H8P12', modelo: 'H-8 PESADA', tamanho: '12', superior: '6', inferior: '3,8', senozoide: '4,2', pesoFinal: '8,174' },
    { cod: 'H10L6', modelo: 'H-10 LEVE', tamanho: '6', superior: '5,8', inferior: '3,8', senozoide: '3,8', pesoFinal: '3,843' },
    { cod: 'H10L12', modelo: 'H-10 LEVE', tamanho: '12', superior: '5,8', inferior: '3,8', senozoide: '3,8', pesoFinal: '7,686' },
    { cod: 'H10P12', modelo: 'H-10 PESADA', tamanho: '12', superior: '6', inferior: '4,2', senozoide: '4,2', pesoFinal: '9,057' },
    { cod: 'H12L6', modelo: 'H-12 LEVE', tamanho: '6', superior: '5,8', inferior: '3,2', senozoide: '3,8', pesoFinal: '3,522' },
    { cod: 'H12L12', modelo: 'H-12 LEVE', tamanho: '12', superior: '5,8', inferior: '3,2', senozoide: '3,8', pesoFinal: '7,044' },
    { cod: 'H12P6', modelo: 'H-12 PESADA', tamanho: '6', superior: '6', inferior: '5', senozoide: '4,2', pesoFinal: '5,270' },
    { cod: 'H12P12', modelo: 'H-12 PESADA', tamanho: '12', superior: '6', inferior: '5', senozoide: '4,2', pesoFinal: '10,540' },
    { cod: 'H16_12', modelo: 'H-16', tamanho: '12', superior: '6', inferior: '5', senozoide: '4,2', pesoFinal: '11,263' },
    { cod: 'H25_12', modelo: 'H-25', tamanho: '12', superior: '8', inferior: '6', senozoide: '5', pesoFinal: '20,042' },
];

export interface TrelicaSelectedLots {
    superior: string;
    inferior1: string;
    inferior2: string;
    senozoide1: string;
    senozoide2: string;
    allSuperior?: string[];
    allInferior?: string[];
    allSenozoide?: string[];
    allInferiorLeft?: string[];
    allInferiorRight?: string[];
    allSenozoideLeft?: string[];
    allSenozoideRight?: string[];
}

export interface Ponta {
    quantity: number;
    size: number; // in meters
    totalWeight: number;
}

export interface FinishedProductItem {
    id: string;
    productionDate: string; // ISO string
    productionOrderId: string;
    orderNumber: string;
    productType: 'Treliça';
    model: string;
    size: string;
    quantity: number;
    totalWeight: number;
    status: 'Disponível' | 'Vendido' | 'Transferido';
    physicalQuantity?: number;
    pendingTransferQuantity?: number;
    movementHistory?: any[];
    isConferred?: boolean;
    conferralJustification?: string;
    opStartTime?: string;
    opEndTime?: string;
}

export interface PontaItem {
    id: string;
    productionDate: string; // ISO string
    productionOrderId: string;
    orderNumber: string;
    productType: 'Ponta de Treliça';
    model: string;
    size: string; // The size of the ponta, e.g., "7" for 7m
    quantity: number;
    totalWeight: number;
    status: 'Disponível' | 'Vendido' | 'Transferido';
    physicalQuantity?: number;
    pendingTransferQuantity?: number;
    movementHistory?: any[];
    isConferred?: boolean;
    conferralJustification?: string;
    opStartTime?: string;
    opEndTime?: string;
}

export interface TransferredFinishedGoodInfo {
    productId: string;
    productType: 'Treliça' | 'Ponta de Treliça';
    model: string;
    size: string;
    transferredQuantity: number;
    totalWeight: number;
}

export interface FinishedGoodsTransferRecord {
    id: string;
    date: string; // ISO string
    operator: string;
    destinationSector: string;
    otherDestination?: string;
    transferredItems: TransferredFinishedGoodInfo[];
}

export interface TrefilaRecipe {
    id: string;
    name: string;
    type: 'K-7 CA 60' | string;
    entryDiameter: number;
    finalDiameter: number;
    passes: number;
    passDiameters: number[];
    passRings: { entry: string; output: string }[];
    createdAt?: string;
}

export interface TrefilaRingStock {
    id: string;
    model: string;
    quantity: number;
}

export interface Partner {
    id: string;
    companyName: string;
    logoUrl?: string;
    materialQty?: string;
    servicesProvided?: string;
    startDate?: string;
    isActiveBranding?: boolean;
    createdAt?: string;
    updatedAt?: string;
}
