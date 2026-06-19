import React, { useState, useEffect, useRef } from 'react';
import { DrawingData, DrawingPoint, DrawingLabel } from '../types';

interface EstriboDrawingBoardProps {
    initialData: DrawingData | null;
    requiredSides: string[];
    onSave: (data: DrawingData) => void;
    onClose: () => void;
}

export default function EstriboDrawingBoard({ initialData, requiredSides, onSave, onClose }: EstriboDrawingBoardProps) {
    const [points, setPoints] = useState<DrawingPoint[]>(initialData?.points || []);
    const [labels, setLabels] = useState<DrawingLabel[]>(initialData?.labels || []);
    const [mode, setMode] = useState<'draw' | 'label'>('draw');
    const [activeLabel, setActiveLabel] = useState<string>(requiredSides[0] || 'A');

    const svgRef = useRef<SVGSVGElement>(null);

    const GRID_SIZE = 20;

    const [draggingLabelIdx, setDraggingLabelIdx] = useState<number | null>(null);

    const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
        if (!svgRef.current) return;
        
        const rect = svgRef.current.getBoundingClientRect();
        const rawX = e.clientX - rect.left;
        const rawY = e.clientY - rect.top;

        // Snap to grid
        const x = Math.round(rawX / GRID_SIZE) * GRID_SIZE;
        const y = Math.round(rawY / GRID_SIZE) * GRID_SIZE;

        if (mode === 'draw') {
            setPoints(prev => [...prev, { x, y }]);
        } else {
            // Check if there's already a label with this text to move it
            setLabels(prev => {
                const filtered = prev.filter(l => l.text !== activeLabel);
                return [...filtered, { text: activeLabel, x, y }];
            });
            
            // Auto-advance label
            const currentIdx = requiredSides.indexOf(activeLabel);
            if (currentIdx !== -1 && currentIdx < requiredSides.length - 1) {
                setActiveLabel(requiredSides[currentIdx + 1]);
            }
        }
    };

    const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
        if (draggingLabelIdx === null || !svgRef.current) return;
        
        const rect = svgRef.current.getBoundingClientRect();
        const rawX = e.clientX - rect.left;
        const rawY = e.clientY - rect.top;

        // Finer snap for labels
        const x = Math.round(rawX / (GRID_SIZE / 2)) * (GRID_SIZE / 2);
        const y = Math.round(rawY / (GRID_SIZE / 2)) * (GRID_SIZE / 2);

        setLabels(prev => prev.map((l, i) => i === draggingLabelIdx ? { ...l, x, y } : l));
    };

    const handleSvgMouseUp = () => {
        setDraggingLabelIdx(null);
    };

    const handleUndo = () => {
        if (mode === 'draw') {
            setPoints(prev => prev.slice(0, -1));
        } else {
            setLabels(prev => prev.slice(0, -1));
        }
    };

    const generateShape = (sides: number) => {
        if (points.length > 0 && !confirm('Isso vai substituir o seu desenho atual pelas linhas da nova forma. Continuar?')) {
            return;
        }

        const cx = 200;
        const cy = 200;
        const r = 140;
        const pts = [];
        
        let angleOffset = -Math.PI / 2;
        if (sides === 6) angleOffset = -Math.PI / 2 + (Math.PI / 6);
        if (sides === 8) angleOffset = -Math.PI / 2 + (Math.PI / 8);

        for (let i = 0; i <= sides; i++) {
            const theta = angleOffset + (i * 2 * Math.PI) / sides;
            pts.push({
                x: Math.round(cx + r * Math.cos(theta)),
                y: Math.round(cy + r * Math.sin(theta))
            });
        }

        setPoints(pts);
        setMode('label');
    };

    const handleClear = () => {
        if (confirm('Tem certeza que deseja limpar todo o desenho?')) {
            setPoints([]);
            setLabels([]);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden">
                <div className="bg-slate-800 text-white p-4 flex justify-between items-center">
                    <h2 className="text-lg font-bold">Editor de Desenho do Estribo</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors text-2xl font-bold leading-none">×</button>
                </div>

                <div className="flex flex-col md:flex-row h-[500px]">
                    {/* Toolbar */}
                    <div className="w-full md:w-48 bg-slate-50 border-r border-slate-200 p-4 flex flex-col gap-4">
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase mb-2">Ferramenta</p>
                            <div className="flex flex-col gap-2">
                                <button 
                                    onClick={() => setMode('draw')}
                                    className={`py-2 px-3 rounded text-sm font-bold text-left transition-colors ${mode === 'draw' ? 'bg-blue-600 text-white shadow' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-100'}`}
                                >
                                    ✎ Desenhar Linhas
                                </button>
                                <button 
                                    onClick={() => setMode('label')}
                                    className={`py-2 px-3 rounded text-sm font-bold text-left transition-colors ${mode === 'label' ? 'bg-emerald-600 text-white shadow' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-100'}`}
                                >
                                    T Adicionar Lados
                                </button>
                            </div>
                        </div>

                        {mode === 'label' && (
                            <div>
                                <p className="text-xs font-bold text-slate-500 uppercase mb-2">Qual lado fixar?</p>
                                <div className="flex flex-wrap gap-2">
                                    {requiredSides.map(side => (
                                        <button
                                            key={side}
                                            onClick={() => setActiveLabel(side)}
                                            className={`w-8 h-8 rounded font-bold transition-colors flex items-center justify-center ${activeLabel === side ? 'bg-emerald-100 border-2 border-emerald-500 text-emerald-800' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-100'}`}
                                        >
                                            {side}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-[10px] text-slate-500 mt-2">Clique no quadro para fixar a letra no desenho.</p>
                            </div>
                        )}

                        <div className="mt-4 border-t border-slate-200 pt-4">
                            <p className="text-xs font-bold text-slate-500 uppercase mb-2">Formas Rápidas</p>
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => generateShape(36)} className="bg-white border border-slate-300 text-slate-600 hover:bg-slate-100 py-1.5 rounded text-xs font-bold transition-colors">
                                    🔴 Redondo
                                </button>
                                <button onClick={() => generateShape(6)} className="bg-white border border-slate-300 text-slate-600 hover:bg-slate-100 py-1.5 rounded text-xs font-bold transition-colors">
                                    ⬡ Sextavado
                                </button>
                                <button onClick={() => generateShape(5)} className="bg-white border border-slate-300 text-slate-600 hover:bg-slate-100 py-1.5 rounded text-xs font-bold transition-colors">
                                    ⬠ Pentágono
                                </button>
                                <button onClick={() => generateShape(8)} className="bg-white border border-slate-300 text-slate-600 hover:bg-slate-100 py-1.5 rounded text-xs font-bold transition-colors">
                                    🛑 Octógono
                                </button>
                            </div>
                        </div>

                        <div className="mt-auto flex flex-col gap-2">
                            <button onClick={handleUndo} className="bg-amber-100 text-amber-800 hover:bg-amber-200 py-2 rounded text-sm font-bold transition-colors">
                                Desfazer Último
                            </button>
                            <button onClick={handleClear} className="bg-red-100 text-red-800 hover:bg-red-200 py-2 rounded text-sm font-bold transition-colors">
                                Limpar Tudo
                            </button>
                        </div>
                    </div>

                    {/* Canvas Area */}
                    <div className="flex-1 bg-slate-100 relative overflow-hidden flex items-center justify-center p-4">
                        <div className="bg-white shadow-sm border border-slate-300 relative" style={{ width: 400, height: 400 }}>
                            <svg 
                                ref={svgRef}
                                width="400" 
                                height="400" 
                                onClick={handleSvgClick}
                                onMouseMove={handleSvgMouseMove}
                                onMouseUp={handleSvgMouseUp}
                                onMouseLeave={handleSvgMouseUp}
                                className={`cursor-crosshair w-full h-full ${mode === 'draw' ? 'hover:bg-blue-50/50' : 'hover:bg-emerald-50/50'}`}
                            >
                                {/* Grid Pattern */}
                                <defs>
                                    <pattern id="grid" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
                                        <path d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`} fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
                                    </pattern>
                                    <pattern id="grid-strong" width={GRID_SIZE * 5} height={GRID_SIZE * 5} patternUnits="userSpaceOnUse">
                                        <rect width={GRID_SIZE * 5} height={GRID_SIZE * 5} fill="url(#grid)" />
                                        <path d={`M ${GRID_SIZE * 5} 0 L 0 0 0 ${GRID_SIZE * 5}`} fill="none" stroke="#cbd5e1" strokeWidth="1" />
                                    </pattern>
                                </defs>
                                
                                <rect width="100%" height="100%" fill="url(#grid-strong)" />

                                {/* Draw Lines */}
                                {points.length > 0 && (
                                    <polyline 
                                        points={points.map(p => `${p.x},${p.y}`).join(' ')} 
                                        fill="none" 
                                        stroke="#1e293b" 
                                        strokeWidth="12"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                )}

                                {/* Draw Points */}
                                {points.map((p, i) => (
                                    <circle key={i} cx={p.x} cy={p.y} r="4" fill="#3b82f6" />
                                ))}

                                {/* Draw Labels */}
                                {labels.map((l, i) => (
                                    <g 
                                        key={i} 
                                        transform={`translate(${l.x}, ${l.y})`}
                                        onMouseDown={(e) => {
                                            if (mode === 'label') {
                                                e.stopPropagation();
                                                setDraggingLabelIdx(i);
                                            }
                                        }}
                                        style={{ cursor: mode === 'label' ? (draggingLabelIdx === i ? 'grabbing' : 'grab') : 'default' }}
                                    >
                                        <circle cx="0" cy="0" r="25" fill="transparent" />
                                        <text x="0" y="12" textAnchor="middle" fontSize="38" fontWeight="bold" fill="#10b981" style={{ pointerEvents: 'none' }}>{l.text}</text>
                                    </g>
                                ))}
                            </svg>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-50 border-t border-slate-200 p-4 flex justify-end gap-3">
                    <button onClick={onClose} className="px-5 py-2 text-slate-600 hover:text-slate-800 font-bold bg-white border border-slate-300 rounded shadow-sm hover:bg-slate-50 transition-colors">
                        Cancelar
                    </button>
                    <button onClick={() => onSave({ points, labels })} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded shadow transition-colors">
                        Salvar Desenho
                    </button>
                </div>
            </div>
        </div>
    );
}
