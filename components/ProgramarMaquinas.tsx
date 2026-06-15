import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { MachineOrder, MachineOrderStatus } from '../types';

/* ============================================================
   MACHINES DATA
   ============================================================ */
interface Machine {
  id: string;
  name: string;
  gauges: string[];
  color: string;
}

const MACHINES: Machine[] = [
  { id: 'dhalmar_6p', name: 'DHALMAR 6P', gauges: ['5mm'], color: 'emerald' },
  { id: 'jjw', name: 'JJW', gauges: ['6.3mm', '8mm'], color: 'blue' },
  { id: 'prima', name: 'PRIMA', gauges: ['10mm', '12.5mm'], color: 'indigo' },
  { id: 'desbobinadeira', name: 'Desbobinadeira', gauges: ['8mm', '10mm'], color: 'amber' },
  { id: 'bancada', name: 'Bancada', gauges: ['16mm', '20mm', '25mm', '32mm'], color: 'purple' },
  { id: 'cortador', name: 'Cortador', gauges: ['16mm', '20mm', '25mm', '32mm'], color: 'rose' },
];

/* ============================================================
   HELPERS
   ============================================================ */
const getRelativeDateStr = (offsetDays: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
};

const getOrderDurationDays = (start: string, end: string) => {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1);
};

const getDayIndexForDate = (start: string, current: string) => {
  const s = new Date(start + 'T00:00:00');
  const c = new Date(current + 'T00:00:00');
  return Math.round((c.getTime() - s.getTime()) / 86400000) + 1;
};

const formatDateReadable = (d: string) => {
  const p = d.split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}` : d;
};

const getOrderWeight = (o: MachineOrder) => {
  return o.weight || (o.quantityUnit === 'kg' ? o.quantity : o.quantityUnit === 'ton' ? o.quantity * 1000 : 0);
};

const STATUS_STYLES: Record<MachineOrderStatus, { label: string; bg: string; text: string; border: string }> = {
  scheduled: { label: 'Programado', bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200' },
  in_progress: { label: 'Em Produção', bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
  completed: { label: 'Concluído', bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200' },
  paused: { label: 'Pausado', bg: 'bg-slate-100', text: 'text-slate-800', border: 'border-slate-200' },
};

/* ============================================================
   PROPS
   ============================================================ */
interface ProgramarMaquinasProps {
  orders: MachineOrder[];
  onSave: (data: Partial<MachineOrder>) => Promise<MachineOrder | null>;
  onUpdate: (orderId: string, updates: Partial<MachineOrder>) => Promise<void>;
  onDelete: (orderId: string) => Promise<void>;
}

/* ============================================================
   PROGRAMAR MAQUINAS COMPONENT
   ============================================================ */
export default function ProgramarMaquinas({ orders, onSave, onUpdate, onDelete }: ProgramarMaquinasProps) {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [showForm, setShowForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState<MachineOrder | null>(null);
  const [showCapacities, setShowCapacities] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [localOrders, setLocalOrders] = useState<MachineOrder[]>(orders);

  useEffect(() => {
    setLocalOrders(orders);
  }, [orders]);

  /* ---- Machine Capacities (localStorage only) ---- */
  const [capacities, setCapacities] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('msm_maquinas_capacities');
    if (saved) return JSON.parse(saved);
    return { dhalmar_6p: 500, jjw: 600, prima: 800, desbobinadeira: 1000, bancada: 1200, cortador: 450 };
  });

  const updateCapacity = (id: string, val: number) => {
    const next = { ...capacities, [id]: Math.max(1, val) };
    setCapacities(next);
    localStorage.setItem('msm_maquinas_capacities', JSON.stringify(next));
  };

  /* ---- Filters for selected date ---- */
  const dayOrders = useMemo(() => {
    const target = new Date(selectedDate + 'T00:00:00');
    return localOrders.filter(o => {
      const s = new Date(o.startDate + 'T00:00:00');
      const e = new Date(o.endDate + 'T00:00:00');
      return target >= s && target <= e;
    });
  }, [localOrders, selectedDate]);

  const weekdayName = useMemo(() => {
    const d = new Date(selectedDate + 'T12:00:00');
    return d.toLocaleDateString('pt-BR', { weekday: 'long' }).toUpperCase();
  }, [selectedDate]);

  /* ---- Save / Edit / Delete ---- */
  const handleSave = async (order: Partial<MachineOrder>) => {
    if (order.id) {
      await onUpdate(order.id, order as Partial<MachineOrder>);
    } else {
      await onSave(order);
    }
    setShowForm(false);
    setEditingOrder(null);
  };

  const handleDelete = async (id: string) => {
    const o = localOrders.find(x => x.id === id);
    if (!o || !window.confirm(`Excluir programação de "${o.clientName}"?`)) return;
    await onDelete(id);
  };

  const handleUpdateStatus = async (id: string, status: MachineOrderStatus) => {
    await onUpdate(id, { status } as Partial<MachineOrder>);
  };

  const openNewOrder = (date?: string, machineId?: string) => {
    const m = machineId ? MACHINES.find(x => x.id === machineId) : MACHINES[0];
    setEditingOrder({
      id: '',
      clientName: '',
      machineId: machineId || MACHINES[0].id,
      gauge: m?.gauges[0] || '',
      quantity: 100,
      quantityUnit: 'kg',
      startDate: date || selectedDate,
      endDate: date || selectedDate,
      status: 'scheduled' as MachineOrderStatus,
      createdAt: new Date().toISOString(),
    } as MachineOrder);
    setShowForm(true);
  };

  const openEditOrder = (order: MachineOrder) => {
    setEditingOrder(order);
    setShowForm(true);
  };

  /* ---- Backup ---- */
  const handleExport = () => {
    const blob = new Blob([JSON.stringify(localOrders, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `programacao_maquinas_${getRelativeDateStr(0)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (Array.isArray(data)) {
          for (const item of data) {
            await onSave(item);
          }
          alert('Programações importadas com sucesso!');
        } else alert('Arquivo inválido.');
      } catch { alert('Erro ao ler arquivo.'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  /* ---- Computed Grid Data ---- */
  const rowsPerMachine = 5;
  const totalTableRows = MACHINES.length * rowsPerMachine;

  const gridData = useMemo(() => MACHINES.map(m => {
    const mOrders = dayOrders.filter(o => o.machineId === m.id);
    const rows: (MachineOrder | null)[] = [...mOrders];
    while (rows.length < rowsPerMachine) rows.push(null);
    const proratedWeight = mOrders.reduce((sum, o) => {
      const w = getOrderWeight(o);
      return sum + Math.round(w / getOrderDurationDays(o.startDate, o.endDate));
    }, 0);
    const nominalWeight = mOrders.reduce((sum, o) => sum + getOrderWeight(o), 0);
    return { machine: m, rows, proratedWeight, nominalWeight, orderCount: mOrders.length };
  }), [dayOrders]);

  const totalProrated = useMemo(() => dayOrders.reduce((acc, o) => {
    return acc + Math.round(getOrderWeight(o) / getOrderDurationDays(o.startDate, o.endDate));
  }, 0), [dayOrders]);

  const totalNominal = useMemo(() => dayOrders.reduce((acc, o) => acc + getOrderWeight(o), 0), [dayOrders]);
  const totalOS = useMemo(() => dayOrders.reduce((acc, o) => acc + (o.osQuantity || 1), 0), [dayOrders]);
  const totalOSProrated = useMemo(() => dayOrders.reduce((acc, o) => {
    return acc + Math.round((o.osQuantity || 1) / getOrderDurationDays(o.startDate, o.endDate));
  }, 0), [dayOrders]);

  /* ============================================================
     RENDER
     ============================================================ */
  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800">🔧 Programar Máquinas</h1>
          <p className="text-sm text-slate-500">Planilha diária de produção por máquina e bitola</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} className="border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold py-2 px-3 rounded-xl text-xs">
            💾 Exportar
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold py-2 px-3 rounded-xl text-xs">
            📂 Importar
          </button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
          <button onClick={() => openNewOrder()} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-xl text-xs shadow-sm">
            ➕ Programar Produção
          </button>
        </div>
      </div>

      {/* Date Navigation + Capacities Toggle */}
      <div className="bg-white rounded-2xl border p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => {
            const d = new Date(selectedDate + 'T12:00:00');
            d.setDate(d.getDate() - 1);
            setSelectedDate(d.toISOString().split('T')[0]);
          }} className="p-2 border rounded-lg hover:bg-slate-50 text-slate-600">◀</button>
          <div className="flex flex-col items-center bg-indigo-50 px-4 py-1.5 rounded-xl border border-indigo-100">
            <input type="date" value={selectedDate} onChange={e => e.target.value && setSelectedDate(e.target.value)}
              className="text-xs font-bold text-indigo-700 bg-transparent text-center focus:outline-none cursor-pointer" />
            <span className="text-[10px] text-slate-500 font-bold uppercase">{formatDateReadable(selectedDate)}</span>
          </div>
          <button onClick={() => {
            const d = new Date(selectedDate + 'T12:00:00');
            d.setDate(d.getDate() + 1);
            setSelectedDate(d.toISOString().split('T')[0]);
          }} className="p-2 border rounded-lg hover:bg-slate-50 text-slate-600">▶</button>
          <button onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
            className="px-3 py-2 text-xs font-bold border rounded-lg hover:bg-slate-50 text-slate-600">Hoje</button>
          <button onClick={() => setShowCapacities(!showCapacities)}
            className={`px-3 py-2 text-xs font-bold rounded-lg border transition ${showCapacities ? 'bg-indigo-600 text-white border-indigo-600' : 'hover:bg-slate-50 text-slate-600'}`}>
            ⚙️ Capacidades
          </button>
        </div>
      </div>

      {/* Capacities Panel */}
      {showCapacities && (
        <div className="bg-white rounded-2xl border p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-800">Parametrização de Capacidades Diárias (kg/dia)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {MACHINES.map(m => (
              <div key={m.id} className="p-3 bg-slate-50 rounded-xl border flex flex-col gap-2">
                <span className="font-extrabold text-xs text-slate-700">{m.name}</span>
                <div className="flex items-center gap-2">
                  <input type="number" min={50} step={50} value={capacities[m.id] || 500}
                    onChange={e => updateCapacity(m.id, Number(e.target.value))}
                    className="w-full p-2 border rounded text-xs font-bold text-center" />
                  <span className="text-[10px] text-slate-400 font-bold">kg</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Spreadsheet Table */}
      <div className="bg-white rounded-2xl border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 text-xs font-bold border-b-2 border-slate-300">
                <th className="py-3 px-4 border text-center w-[140px]">Dia</th>
                <th className="py-3 px-4 border text-left w-[180px]">Máquina</th>
                <th className="py-3 px-4 border text-center w-[120px]">Bitola</th>
                <th className="py-3 px-4 border text-left min-w-[180px]">Cliente</th>
                <th className="py-3 px-4 border text-center w-[120px]">Ordem Produção</th>
                <th className="py-3 px-4 border text-center w-[130px]">Qtd. OS</th>
                <th className="py-3 px-4 border text-right w-[110px]">Peso (kg)</th>
                <th className="py-3 px-3 border text-center w-[100px]">Ações</th>
              </tr>
            </thead>
            <tbody>
              {gridData.map(({ machine, rows, proratedWeight, nominalWeight }, mi) =>
                rows.map((order, ri) => {
                  const isFirstMachineRow = ri === 0;
                  const isFirstTableRow = mi === 0 && ri === 0;
                  const capacity = capacities[machine.id] || 500;
                  const utilizationPct = capacity > 0 ? Math.round((proratedWeight / capacity) * 100) : 0;

                  let rowClass = '';
                  if (order) {
                    if (order.status === 'in_progress') rowClass = 'bg-blue-50/20';
                    else if (order.status === 'completed') rowClass = 'bg-emerald-50/20 line-through text-slate-400';
                    else if (order.status === 'paused') rowClass = 'bg-slate-50/50';
                  }

                  let barColor = 'bg-indigo-500';
                  let utilizationLabel = `${utilizationPct}% ocupada`;
                  if (utilizationPct >= 100) { barColor = 'bg-rose-500 animate-pulse'; utilizationLabel = 'Sobrecarga'; }
                  else if (utilizationPct >= 85) { barColor = 'bg-amber-500'; }

                  return (
                    <tr key={`${machine.id}-${ri}`} className={`hover:bg-slate-50/30 transition border-b text-xs ${rowClass}`}>
                      {isFirstTableRow && (
                        <td rowSpan={totalTableRows} className="border bg-white text-center font-black text-slate-800 align-middle py-6 select-none">
                          <div className="flex flex-col items-center justify-center gap-1.5" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                            <span className="text-sm tracking-wider" style={{ transform: 'scaleY(-1) scaleX(-1)' }}>{weekdayName}</span>
                            <span className="text-xs text-indigo-600 font-mono font-bold mt-2" style={{ transform: 'scaleY(-1) scaleX(-1)' }}>{formatDateReadable(selectedDate)}</span>
                          </div>
                        </td>
                      )}

                      {isFirstMachineRow && (
                        <td rowSpan={rowsPerMachine} className="border bg-slate-50/45 p-3.5 align-top">
                          <div className="flex flex-col gap-2 min-w-[155px]">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-extrabold text-slate-900 text-xs uppercase">{machine.name}</span>
                              <span className="text-[9px] text-slate-400 font-semibold">Aço Estrutural</span>
                            </div>
                            <div className="border-t pt-2 flex flex-col gap-1.5">
                              <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400">
                                <span>Capacidade:</span>
                                <span className="font-mono text-slate-700 font-bold">{capacity} kg/dia</span>
                              </div>
                              <div className="flex items-center justify-between text-[10px] font-semibold">
                                <span className="text-slate-400">Programado:</span>
                                <span className={`font-mono font-bold ${utilizationPct >= 100 ? 'text-rose-600' : utilizationPct >= 85 ? 'text-amber-600' : 'text-indigo-600'}`}>{proratedWeight} kg</span>
                              </div>
                              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                <div className={`h-full ${barColor} transition-all duration-300`} style={{ width: `${Math.min(100, utilizationPct)}%` }} />
                              </div>
                              <div className="flex items-center justify-between mt-0.5">
                                <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wide ${utilizationPct >= 100 ? 'bg-rose-50 text-rose-700 border' : utilizationPct >= 85 ? 'bg-amber-50 text-amber-700 border' : 'bg-indigo-50 text-indigo-700 border'}`}>
                                  {utilizationLabel}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                      )}

                      {isFirstMachineRow && (
                        <td rowSpan={rowsPerMachine} className="border bg-slate-50/20 font-bold text-slate-700 text-center p-3 align-middle font-mono text-sm">
                          {machine.gauges.map(g => g.replace('mm', '')).join(' -- ')}
                        </td>
                      )}

                      <td className="border p-2.5 font-semibold text-slate-800">
                        {order ? (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-900 text-xs">{order.clientName}</span>
                              {getOrderDurationDays(order.startDate, order.endDate) > 1 && (
                                <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-[9px] text-indigo-700 font-bold border border-indigo-100">
                                  {getOrderDurationDays(order.startDate, order.endDate)} Dias
                                </span>
                              )}
                            </div>
                            {order.notes && <span className="text-[10px] text-slate-400 italic truncate max-w-[200px]">{order.notes}</span>}
                            {getOrderDurationDays(order.startDate, order.endDate) > 1 && (
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50/50 px-1 py-0.5 rounded">
                                  Dia {getDayIndexForDate(order.startDate, selectedDate)} de {getOrderDurationDays(order.startDate, order.endDate)}
                                </span>
                                <span className="text-[9px] text-slate-400">({formatDateReadable(order.startDate)} - {formatDateReadable(order.endDate)})</span>
                              </div>
                            )}
                          </div>
                        ) : <span className="text-slate-300 italic select-none">Vazio</span>}
                      </td>

                      <td className="border p-2.5 text-center font-mono text-slate-700 font-bold">
                        {order ? (
                          <span>{order.orderCode || `OP-${order.id.slice(-3).toUpperCase()}`}</span>
                        ) : <span className="text-slate-300 select-none">-</span>}
                      </td>

                      <td className="border p-2.5 text-center font-semibold text-slate-800">
                        {order ? (() => {
                          const dur = getOrderDurationDays(order.startDate, order.endDate);
                          const totalOSQty = order.osQuantity || 1;
                          if (dur > 1) {
                            const proOS = Math.round(totalOSQty / dur) || 1;
                            return <div className="flex flex-col items-center"><span className="font-bold text-indigo-600">{proOS} <span className="text-[9px] text-slate-400">OS/dia</span></span><span className="text-[10px] text-slate-400">Total: {totalOSQty} OS</span></div>;
                          }
                          return <span className="font-bold">{totalOSQty}</span>;
                        })() : <span className="text-slate-300 select-none">-</span>}
                      </td>

                      <td className="border p-2.5 text-right font-mono font-bold text-indigo-600">
                        {order ? (() => {
                          const dur = getOrderDurationDays(order.startDate, order.endDate);
                          const w = getOrderWeight(order);
                          if (dur > 1) {
                            const proW = Math.round(w / dur);
                            return <div className="flex flex-col items-end"><span className="font-bold">{proW.toLocaleString('pt-BR')} <span className="text-[9px] text-slate-400 font-sans">kg/dia</span></span><span className="text-[10px] text-slate-400">Total: {w.toLocaleString('pt-BR')} kg</span></div>;
                          }
                          return <span>{w.toLocaleString('pt-BR')} <span className="text-[9px] text-slate-400 font-sans">kg</span></span>;
                        })() : <span className="text-slate-300 select-none">-</span>}
                      </td>

                      <td className="border p-2 text-center align-middle">
                        {order ? (
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => openEditOrder(order)}
                              className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600" title="Editar">✏️</button>
                            <button onClick={() => handleUpdateStatus(order.id, order.status === 'in_progress' ? 'completed' : 'in_progress')}
                              className={`p-1 rounded ${order.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-50 text-emerald-700'}`}
                              title={order.status === 'in_progress' ? 'Concluir' : 'Iniciar'}>
                              {order.status === 'in_progress' ? '✅' : '▶️'}
                            </button>
                            <button onClick={() => handleDelete(order.id)}
                              className="p-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-600" title="Excluir">🗑️</button>
                          </div>
                        ) : (
                          <button onClick={() => openNewOrder(selectedDate, machine.id)}
                            className="inline-flex items-center gap-1 text-[10px] text-indigo-600 hover:text-indigo-700 bg-indigo-50/50 hover:bg-indigo-50 px-1.5 py-0.5 rounded border border-transparent hover:border-indigo-200 font-semibold transition-all">
                            ➕ Programar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Summary bar */}
        <div className="p-4 bg-slate-50 border-t flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
          <span className="text-slate-500 font-medium">🔹 Programação inteligente: Ordens de múltiplos dias dividem peso e OS proporcionalmente.</span>
          <div className="flex items-center gap-6 sm:gap-8 font-bold">
            <div className="flex flex-col gap-1 text-slate-600">
              <span>Total OS (Prorrateado): <span className="text-sm font-black text-slate-900">{totalOSProrated}</span></span>
              <span className="text-[10px] text-slate-400 font-semibold text-right">Soma Nominal: {totalOS} OS</span>
            </div>
            <div className="flex flex-col gap-1 text-indigo-600 border-l border-slate-200 pl-6">
              <span>Peso Proporcional: <span className="text-sm font-black text-indigo-700">{totalProrated.toLocaleString('pt-BR')} kg</span></span>
              <span className="text-[10px] text-slate-400 font-semibold text-right">Soma Integral: {totalNominal.toLocaleString('pt-BR')} kg</span>
            </div>
          </div>
        </div>
      </div>

      {/* Order Form Modal */}
      {showForm && (
        <OrderFormModal
          order={editingOrder}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditingOrder(null); }}
          allOrders={localOrders}
        />
      )}
    </div>
  );
}

/* ============================================================
   ORDER FORM MODAL
   ============================================================ */
interface OrderFormProps {
  order: MachineOrder | null;
  onSave: (order: Partial<MachineOrder>) => Promise<void>;
  onClose: () => void;
  allOrders: MachineOrder[];
}

function OrderFormModal({ order, onSave, onClose, allOrders }: OrderFormProps) {
  const [clientName, setClientName] = useState(order?.clientName || '');
  const [machineId, setMachineId] = useState(order?.machineId || MACHINES[0].id);
  const [gauge, setGauge] = useState(order?.gauge || MACHINES[0]?.gauges[0] || '');
  const [quantity, setQuantity] = useState(order?.quantity || 100);
  const [quantityUnit, setQuantityUnit] = useState<'kg' | 'ton' | 'm' | 'peças'>(order?.quantityUnit || 'kg');
  const [startDate, setStartDate] = useState(order?.startDate || getRelativeDateStr(0));
  const [endDate, setEndDate] = useState(order?.endDate || getRelativeDateStr(0));
  const [status, setStatus] = useState<MachineOrderStatus>(order?.status || 'scheduled');
  const [notes, setNotes] = useState(order?.notes || '');
  const [orderCode, setOrderCode] = useState(order?.orderCode || '');
  const [osQuantity, setOsQuantity] = useState(order?.osQuantity || 1);
  const [weight, setWeight] = useState(order?.weight || order?.quantity || 100);

  const selectedMachine = MACHINES.find(m => m.id === machineId);

  useEffect(() => {
    const m = MACHINES.find(x => x.id === machineId);
    if (m && !m.gauges.includes(gauge)) setGauge(m.gauges[0] || '');
  }, [machineId]);

  const conflicts = useMemo(() => {
    if (!machineId || !startDate || !endDate) return [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return [];
    return allOrders.filter(o => {
      if (order && o.id === order.id) return false;
      if (o.machineId !== machineId) return false;
      if (o.status === 'completed') return false;
      const os = new Date(o.startDate);
      const oe = new Date(o.endDate);
      return start <= oe && end >= os;
    });
  }, [machineId, startDate, endDate, allOrders, order]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !machineId || !gauge || !startDate || !endDate) return;
    if (new Date(startDate) > new Date(endDate)) { alert('Data de início não pode ser posterior ao término.'); return; }
    await onSave({
      id: order?.id || `order_${Date.now()}`,
      clientName: clientName.trim(),
      machineId, gauge,
      quantity: Number(quantity), quantityUnit,
      startDate, endDate, status,
      notes: notes.trim() || undefined,
      createdAt: order?.createdAt || new Date().toISOString(),
      orderCode: orderCode.trim() || undefined,
      osQuantity: Number(osQuantity),
      weight: Number(weight),
    });
    onClose();
  };

  const statuses: { id: MachineOrderStatus; label: string }[] = [
    { id: 'scheduled', label: 'Programado' },
    { id: 'in_progress', label: 'Em Produção' },
    { id: 'completed', label: 'Concluído' },
    { id: 'paused', label: 'Pausado' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto z-10 m-4">
        <div className="p-5 border-b flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-800">{order?.id ? 'Editar Programação' : 'Programar Produção'}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{order?.id ? 'Altere os dados da programação' : 'Defina os detalhes para um novo cliente'}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl font-bold">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">👤 Nome do Cliente *</label>
            <input type="text" required placeholder="Ex: Metalúrgica Silva" value={clientName} onChange={e => setClientName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">⚙️ Máquina *</label>
              <select value={machineId} onChange={e => setMachineId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm cursor-pointer focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none">
                {MACHINES.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">📏 Bitola *</label>
              <select value={gauge} onChange={e => setGauge(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm cursor-pointer focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none">
                {selectedMachine?.gauges.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase mb-1 block"># Quantidade</label>
              <input type="number" min="1" required value={quantity} onChange={e => {
                const v = Math.max(1, Number(e.target.value));
                setQuantity(v);
                if (weight === quantity) setWeight(v);
              }} className="w-full px-3 py-2 border rounded-lg text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">Unidade</label>
              <div className="flex rounded-lg border p-0.5 bg-slate-50 h-[38px] items-center">
                {(['kg', 'ton', 'm', 'peças'] as const).map(u => (
                  <button key={u} type="button" onClick={() => setQuantityUnit(u)}
                    className={`flex-1 py-1 text-xs font-bold rounded-md transition h-full flex items-center justify-center ${quantityUnit === u ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
                    {u === 'peças' ? 'Pçs' : u}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border space-y-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600">📋 Dados da Planilha</span>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Ordem de Produção</label>
              <input type="text" placeholder="Ex: 0-01" value={orderCode} onChange={e => setOrderCode(e.target.value)}
                className="w-full px-3 py-1.5 border rounded-lg text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/10 outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Qtd. de OS</label>
                <input type="number" min="1" value={osQuantity} onChange={e => setOsQuantity(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3 py-1.5 border rounded-lg text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/10 outline-none" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Peso (kg)</label>
                <input type="number" min="0" value={weight} onChange={e => setWeight(Math.max(0, Number(e.target.value)))}
                  className="w-full px-3 py-1.5 border rounded-lg text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/10 outline-none" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">📅 Data Início *</label>
              <input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">📅 Data Término *</label>
              <input type="date" required value={endDate} onChange={e => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none" />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">Status</label>
            <div className="grid grid-cols-2 gap-2">
              {statuses.map(st => (
                <button key={st.id} type="button" onClick={() => setStatus(st.id)}
                  className={`px-3 py-2 text-xs font-bold rounded-lg border text-center transition ${status === st.id ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500/10' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  {status === st.id && '✓ '}{st.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">📝 Observações</label>
            <textarea placeholder="Ex: Exigências de embalagem, tolerância de bitola..." value={notes} onChange={e => setNotes(e.target.value)}
              rows={2} className="w-full px-3 py-2 border rounded-lg text-sm resize-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none" />
          </div>

          {conflicts.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
              <div className="flex items-start gap-2 text-amber-800 text-xs font-semibold">
                <span>⚠️</span>
                <div>
                  <span>Alerta de Conflito de Agenda!</span>
                  <p className="text-[11px] text-amber-700 font-medium mt-0.5">
                    {selectedMachine?.name} já possui produção de: {conflicts.map(c => c.clientName).join(', ')}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 px-4 border rounded-lg text-slate-700 hover:bg-slate-50 text-sm font-bold">Cancelar</button>
            <button type="submit" disabled={!clientName.trim()}
              className="flex-1 py-2 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold shadow-sm">
              {order?.id ? 'Salvar Alterações' : 'Confirmar Programação'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
