import os
import re

file_path = "components/MobileOperatorPanel.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update Props
content = re.sub(
    r"(activeBrandingPartner\?:\s*any;\s*)}",
    r"\1    machineStates?: import('../types').MachineCurrentState[];\n}",
    content, count=1
)

content = re.sub(
    r"const MobileOperatorPanel: React\.FC<MobileOperatorPanelProps> = \({([^}]+)}\) => {",
    r"const MobileOperatorPanel: React.FC<MobileOperatorPanelProps> = ({\1, machineStates }) => {",
    content, count=1
)

# 2. State replacement
state_replacement = """
    // Porta rolos state with initial load from realtime DB
    const currentMachineState = machineStates?.find(m => m.machineName === selectedMachine);
    const portaRolo1 = currentMachineState?.portaRolo1Lot || '';
    const portaRolo2 = currentMachineState?.portaRolo2Lot || '';
    const activeFeed1 = currentMachineState?.activeFeed1 ?? true;
    const activeFeed2 = currentMachineState?.activeFeed2 ?? true;
    
    const updateMachineStateDB = async (updates: any) => {
        if (!selectedMachine) return;
        try {
            const current = machineStates?.find(m => m.machineName === selectedMachine) || {
                machineName: selectedMachine,
                status: 'PARADA',
                activeFeed1: true,
                activeFeed2: true
            };
            const payload = { ...current, ...updates, operatorId: currentUser.id };
            await supabase.from('machine_current_states').upsert({
                machine_name: payload.machineName,
                operator_id: payload.operatorId,
                status: payload.status,
                status_since: payload.statusSince,
                stop_reason: payload.stopReason,
                idle_since: payload.idleSince,
                porta_rolo_1_lot: payload.portaRolo1Lot,
                porta_rolo_2_lot: payload.portaRolo2Lot,
                active_feed_1: payload.activeFeed1,
                active_feed_2: payload.activeFeed2
            });
        } catch (e) { console.error('Error updating machine state', e); }
    };

    const handleFeedToggle = (rolo: 1 | 2) => {
        if (rolo === 1) {
            updateMachineStateDB({ activeFeed1: !activeFeed1 });
        } else {
            updateMachineStateDB({ activeFeed2: !activeFeed2 });
        }
    };

    const handlePortaRoloChange = (rolo: 1 | 2, value: string) => {
        if (rolo === 1) {
            updateMachineStateDB({ portaRolo1Lot: value });
        } else {
            updateMachineStateDB({ portaRolo2Lot: value });
        }
    };
"""

content = re.sub(
    r"// Porta rolos state with initial load from localStorage[\s\S]*?const handlePortaRoloChange.*?};",
    state_replacement.strip(),
    content, count=1
)

# 3. Clean Porta Rolo Effect
clean_porta_rolo_effect = """
    // Clear Porta Rolo if it was manually reverted to 'Disponível' by gestor
    useEffect(() => {
        let changed = false;
        let newPR1 = portaRolo1;
        let newPR2 = portaRolo2;
        let newF1 = activeFeed1;
        let newF2 = activeFeed2;
        
        if (portaRolo1) {
            const lot1 = stock.find(i => i.internalLot === portaRolo1);
            if (lot1 && lot1.status?.toLowerCase() === 'disponível') {
                newPR1 = '';
                newF1 = false;
                changed = true;
            }
        }
        if (portaRolo2) {
            const lot2 = stock.find(i => i.internalLot === portaRolo2);
            if (lot2 && lot2.status?.toLowerCase() === 'disponível') {
                newPR2 = '';
                newF2 = false;
                changed = true;
            }
        }
        if (changed) {
            updateMachineStateDB({ portaRolo1Lot: newPR1, portaRolo2Lot: newPR2, activeFeed1: newF1, activeFeed2: newF2 });
        }
    }, [stock, portaRolo1, portaRolo2, selectedMachine]);
"""
content = re.sub(
    r"// Clear Porta Rolo if it was manually reverted to 'Disponvel' by gestor.*?localStorage\.setItem\(`active_feed_2_\${selectedMachine}`, 'false'\);\s*}\s*}\s*}, \[stock, portaRolo1, portaRolo2, selectedMachine\]\);",
    clean_porta_rolo_effect.strip(),
    content, flags=re.DOTALL
)
# Retrying with robust regex for the effect
content = re.sub(
    r"// Clear Porta Rolo if it was manually reverted.*?(?=useEffect \(\(\) => \{\s*const fetchOrders = async \(\) => \{)",
    clean_porta_rolo_effect.strip() + "\n\n    ",
    content, flags=re.DOTALL
)

# 4. Machine Status State
machine_status_replacement = """
    // Machine Status State (DB Sync)
    const machineState = currentMachineState?.status || 'PARADA';
    const machineStateSince = currentMachineState?.statusSince || new Date().toISOString();
    const activeStopReason = currentMachineState?.stopReason || 'Aguardando início de produção';
    const idleSince = currentMachineState?.idleSince || null;
"""
content = re.sub(
    r"// Machine Status State \(Local for now\).*?(?=const formatTimeDiff = \(startStr: string\) => \{)",
    machine_status_replacement.strip() + "\n\n    ",
    content, flags=re.DOTALL
)

# 5. Remove old hooks for idleTimer and machineState
content = re.sub(
    r"const \[idleSince, setIdleSince\] = useState<string \| null>\(\(\) => \{[\s\S]*?\}\);",
    "",
    content
)

content = re.sub(
    r"const \[idleTimer, setIdleTimer\] = useState<string>\('00:00:00'\);[\s\S]*?return \(\) => clearInterval\(interval\);\s*}, \[isOnline, machineStateSince, currentUser\.id\]\);",
    r"""const [idleTimer, setIdleTimer] = useState<string>('00:00:00');

    useEffect(() => {
        if (!isOnline) return;
        const interval = setInterval(() => {
            setMachineTimer(formatTimeDiff(machineStateSince));
            setIdleTimer(idleSince ? formatTimeDiff(idleSince) : '00:00:00');
        }, 1000);
        return () => clearInterval(interval);
    }, [isOnline, machineStateSince, idleSince]);""",
    content, count=1
)

# 6. isAnyProducing -> Update Machine Status
content = re.sub(
    r"useEffect\(\(\) => \{[\s\S]*?if \(!idleSince\) \{[\s\S]*?const now = new Date\(\)\.toISOString\(\);[\s\S]*?setIdleSince\(now\);[\s\S]*?localStorage\.setItem\(`machine_idle_since_\${currentUser\.id}`, now\);[\s\S]*?\} else \{[\s\S]*?if \(idleSince !== null\) \{[\s\S]*?setIdleSince\(null\);[\s\S]*?localStorage\.removeItem\(`machine_idle_since_\${currentUser\.id}`\);[\s\S]*?\}\s*\}, \[machineState, isAnyProducing, idleSince, currentUser\.id\]\);",
    r"""useEffect(() => {
        if (machineState === 'ATIVA' && !isAnyProducing) {
            if (!idleSince) {
                const now = new Date().toISOString();
                updateMachineStateDB({ idleSince: now });
            }
        } else {
            if (idleSince !== null) {
                updateMachineStateDB({ idleSince: null });
            }
        }
    }, [machineState, isAnyProducing, idleSince, currentUser.id]);""",
    content
)

# 7. toggleMachineState
content = re.sub(
    r"setMachineState\('ATIVA'\);[\s\S]*?setMachineStateSince\(now\);[\s\S]*?setMachineTimer\('00:00:00'\);[\s\S]*?setActiveStopReason\(''\);[\s\S]*?localStorage\.setItem\(`machine_state_\${currentUser\.id}`, 'ATIVA'\);[\s\S]*?localStorage\.setItem\(`machine_state_since_\${currentUser\.id}`, now\);[\s\S]*?localStorage\.removeItem\(`machine_stop_reason_\${currentUser\.id}`\);",
    r"""setMachineTimer('00:00:00');
        updateMachineStateDB({ status: 'ATIVA', statusSince: now, stopReason: '' });""",
    content
)

# 8. activeStopReason and setIsStopReasonModalOpen
content = re.sub(
    r"// Modal state\s*const \[isStopReasonModalOpen, setIsStopReasonModalOpen\] = useState\(false\);\s*const \[activeStopReason, setActiveStopReason\] = useState<string>\(\(\) => localStorage\.getItem\(`machine_stop_reason_\${currentUser\.id}`\) \|\| 'Aguardando [^']+'\);",
    r"""// Modal state
    const [isStopReasonModalOpen, setIsStopReasonModalOpen] = useState(false);""",
    content
)

# 9. In Modal submission (handleStopMachine)
content = re.sub(
    r"setMachineState\('PARADA'\);[\s\S]*?setMachineStateSince\(now\);[\s\S]*?setMachineTimer\('00:00:00'\);[\s\S]*?setActiveStopReason\(reason\);[\s\S]*?localStorage\.setItem\(`machine_state_\${currentUser\.id}`, 'PARADA'\);[\s\S]*?localStorage\.setItem\(`machine_state_since_\${currentUser\.id}`, now\);[\s\S]*?localStorage\.setItem\(`machine_stop_reason_\${currentUser\.id}`, reason\);",
    r"""setMachineTimer('00:00:00');
        updateMachineStateDB({ status: 'PARADA', statusSince: now, stopReason: reason });""",
    content
)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("Updated MobileOperatorPanel.tsx successfully")
