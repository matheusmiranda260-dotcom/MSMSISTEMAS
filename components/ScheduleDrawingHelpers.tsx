import React from 'react';
import type { FerroItem } from '../types';
import { 
    DEFAULT_ESTRIBO_MODELS as estriboModels, 
    DEFAULT_FERRO_MODELS as ferroModels, 
    DEFAULT_TRAVA_MODELS as travaModels 
} from '../types';

export const getFerroTotalLengthCm = (ferro: FerroItem, colDescription: string): number => {
    const a = parseFloat(ferro.ladoA) || 0;
    const b = parseFloat(ferro.ladoB) || 0;
    const c = parseFloat(ferro.ladoC) || 0;
    const d = parseFloat(ferro.ladoD) || 0;
    const e = parseFloat(ferro.ladoE) || 0;
    
    if (ferro.drawingType === 'Estribo' || ferro.drawingType === 'CorteDobra') {
        const shapeType = ferro.estriboShape || 'Padrão';
        const safeDesc = String(colDescription || '');
        const m = safeDesc.match(/(\d+ LADOS|REDONDA)/);
        const ladosDesc = m ? m[1] : '4 LADOS';
        
        const model = estriboModels.find(m => m.id === shapeType || (m.name === shapeType && m.category === ladosDesc));
        
        if (model) {
            const f = parseFloat(ferro.ladoF) || 0;
            try {
                let expression = model.formula
                    .replace(/Math\.PI/g, Math.PI.toString())
                    .replace(/\bA\b/g, a.toString())
                    .replace(/\bB\b/g, b.toString())
                    .replace(/\bC\b/g, c.toString())
                    .replace(/\bD\b/g, d.toString())
                    .replace(/\bE\b/g, e.toString())
                    .replace(/\bF\b/g, f.toString());
                return new Function('return ' + expression)() || 0;
            } catch (err) {
                console.error("Erro ao avaliar fórmula de estribo", model.formula, err);
                return 0;
            }
        } else {
            // Fallback safe defaults if model not found
            if (ladosDesc === 'REDONDA') return (a * Math.PI) + 15;
            if (ladosDesc === '3 LADOS') return a + (b * 2) + 10;
            return (a * 2) + (b * 2) + 10; // Default 4 Lados
        }
    }
    
    if (ferro.drawingType === 'Trava') {
        const shape = Number(ferro.estriboShape) || 1;
        const model = (travaModels || []).find(m => m.shapeId === shape);
        if (model) {
            try {
                let expression = model.formula
                    .replace(/Math\.PI/g, Math.PI.toString())
                    .replace(/\bA\b/g, a.toString())
                    .replace(/\bB\b/g, b.toString())
                    .replace(/\bC\b/g, c.toString())
                    .replace(/\bD\b/g, d.toString())
                    .replace(/\bE\b/g, e.toString());
                return new Function('return ' + expression)() || 0;
            } catch (err) {
                console.error("Erro ao avaliar fórmula de trava", model.formula, err);
            }
        }
        switch(shape) {
            case 1: return a;
            case 2: return a + b + c;
            case 3: return a + b + c;
            case 4: return a + b + c;
            case 5: return a + b;
            case 6: return a + b + c;
            case 7: return a + b + c;
            case 8: return a + b + c + d + e;
            default: return a;
        }
    }
    
    // Regular ferros
    const ferroModel = ferroModels.find(m => m.id === ferro.ferroModelId);
    if (ferroModel) {
        const f = parseFloat(ferro.ladoF) || 0;
        try {
            let expression = ferroModel.formula
                .replace(/Math\.PI/g, Math.PI.toString())
                .replace(/\bA\b/g, a.toString())
                .replace(/\bB\b/g, b.toString())
                .replace(/\bC\b/g, c.toString())
                .replace(/\bD\b/g, d.toString())
                .replace(/\bE\b/g, e.toString())
                .replace(/\bF\b/g, f.toString());
            return new Function('return ' + expression)() || 0;
        } catch (err) {
            console.error("Erro ao avaliar fórmula de ferro", ferroModel.formula, err);
        }
    }

    return a + b + c + d + e;
};

export const renderTravaSVG = (shape: number, A?: string, B?: string, C?: string, D?: string, E?: string) => {
    const W = 100;
    const H = 60;
    let p = '';
    const labels = [];
    
    switch (shape) {
        case 1:
            p = "M 10,30 L 90,30";
            labels.push({ x: 50, y: 20, t: 'A', v: A });
            break;
        case 2:
            p = "M 10,45 L 30,45 L 30,15 L 70,15 L 70,45 L 90,45";
            labels.push({ x: 20, y: 55, t: 'A', v: A });
            labels.push({ x: 20, y: 30, t: 'B', v: B });
            labels.push({ x: 50, y: 10, t: 'C', v: C });
            break;
        case 3:
            p = "M 30,30 L 20,30 L 20,50 L 80,50 L 80,30 L 70,30";
            labels.push({ x: 25, y: 25, t: 'A', v: A });
            labels.push({ x: 10, y: 40, t: 'B', v: B });
            labels.push({ x: 50, y: 45, t: 'C', v: C });
            break;
        case 4:
            p = "M 10,50 L 40,50 L 60,10 L 90,10";
            labels.push({ x: 25, y: 58, t: 'C', v: C });
            labels.push({ x: 40, y: 30, t: 'B', v: B });
            labels.push({ x: 75, y: 5, t: 'A', v: A });
            break;
        case 5:
            p = "M 10,40 L 10,20 L 90,20";
            labels.push({ x: 5, y: 30, t: 'B', v: B });
            labels.push({ x: 50, y: 15, t: 'A', v: A });
            break;
        case 6:
            p = "M 20,15 L 20,45 L 80,45 L 80,15";
            labels.push({ x: 10, y: 30, t: 'A', v: A });
            labels.push({ x: 50, y: 55, t: 'B', v: B });
            labels.push({ x: 90, y: 30, t: 'C', v: C });
            break;
        case 7:
            p = "M 10,45 L 40,45 L 60,15 L 90,15";
            labels.push({ x: 25, y: 55, t: 'A', v: A });
            labels.push({ x: 50, y: 25, t: 'B', v: B });
            labels.push({ x: 75, y: 25, t: 'C', v: C });
            break;
        case 8:
            p = "M 10,45 L 30,45 L 30,15 L 70,15 L 70,45 L 90,45";
            labels.push({ x: 20, y: 55, t: 'A', v: A });
            labels.push({ x: 20, y: 30, t: 'B', v: B });
            labels.push({ x: 50, y: 10, t: 'C', v: C });
            labels.push({ x: 80, y: 30, t: 'D', v: D });
            labels.push({ x: 80, y: 55, t: 'E', v: E });
            break;
    }

    return (
        <svg viewBox={"0 0 " + W + " " + H} className="w-full h-full min-h-[40px] max-h-[80px] overflow-visible">
            <path d={p} stroke="#1e293b" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            {labels.map((lbl, i) => (
                <text key={i} x={lbl.x} y={lbl.y} fontSize="8" fontWeight="bold" fill="#dc2626" textAnchor="middle">
                    {lbl.v || lbl.t}
                </text>
            ))}
        </svg>
    );
};

export const renderEstriboSVG = (lados: string, shapeType?: string, A?: string, B?: string, C?: string, D?: string, E?: string, F?: string, customModelsList?: any[]) => {
    const fs = 14;
    
    const modelsToSearch = customModelsList || estriboModels;
    const model = modelsToSearch.find(m => m.id === shapeType || (m.name === shapeType && (m as any).category === lados));
    let template = shapeType;
    let effectiveLados = lados;
    
    if (model) {
        if (model.customDrawingData && model.customDrawingData.points) {
            const { points, labels } = model.customDrawingData;
            return (
                <svg viewBox="0 0 400 400" className="w-full h-full max-h-[120px] overflow-visible" xmlns="http://www.w3.org/2000/svg">
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
                    {labels.map((l, i) => {
                        let val = l.text;
                        if (l.text === 'A') val = A || 'A';
                        else if (l.text === 'B') val = B || 'B';
                        else if (l.text === 'C') val = C || 'C';
                        else if (l.text === 'D') val = D || 'D';
                        else if (l.text === 'E') val = E || 'E';
                        else if (l.text === 'F') val = F || 'F';

                        return (
                            <g key={i} transform={`translate(${l.x}, ${l.y})`}>
                                <text x="0" y="12" textAnchor="middle" fontSize="38" fontWeight="bold" fill="#1e293b">{val}</text>
                            </g>
                        );
                    })}
                </svg>
            );
        }

        if (model.customImageBase64) {
            return (
                <img src={model.customImageBase64} alt="Estribo Customizado" className="w-full h-full max-h-[120px] object-contain" />
            );
        }
        template = model.svgTemplate;
        if (template === 'padrao_4_lados') { effectiveLados = '4 LADOS'; template = 'Padrão'; }
        else if (template === 'formato_l') { effectiveLados = '4 LADOS'; template = 'L'; }
        else if (template === 'formato_reto') { effectiveLados = '4 LADOS'; template = 'Reto'; }
        else if (template === 'formato_u') { effectiveLados = '4 LADOS'; template = 'U'; }
        else if (template === 'padrao_3_lados') { effectiveLados = '3 LADOS'; template = 'Padrão'; }
        else if (template === 'redonda_padrao') { effectiveLados = 'REDONDA'; template = 'Padrão'; }
        else if (template === 'generico') { effectiveLados = '4 LADOS'; template = 'Especial'; }
    }
    
    if (effectiveLados === '3 LADOS') {
        return (
            <svg viewBox="0 0 160 160" className="w-full h-full max-h-[120px] overflow-visible" xmlns="http://www.w3.org/2000/svg">
                <polygon points="80,30 30,120 130,120" fill="none" stroke="#777" strokeWidth="4" />
                <text x="115" y="70" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{A || 'A'}</text>
                <text x="80" y="140" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{B || 'B'}</text>
            </svg>
        );
    }
    
    if (effectiveLados === '4 LADOS') {
        if (template === 'L') {
            return (
                <svg viewBox="0 0 160 160" className="w-full h-full max-h-[120px] overflow-visible" xmlns="http://www.w3.org/2000/svg">
                    <path d="M 40,40 L 40,120 L 120,120" fill="none" stroke="#777" strokeWidth="4" strokeLinejoin="round" />
                    <text x="80" y="140" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{A || 'A'}</text>
                    <text x="25" y="80" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{B || 'B'}</text>
                </svg>
            );
        }
        if (template === 'Reto') {
            return (
                <svg viewBox="0 0 160 160" className="w-full h-full max-h-[120px] overflow-visible" xmlns="http://www.w3.org/2000/svg">
                    <line x1="30" y1="80" x2="130" y2="80" stroke="#777" strokeWidth="4" />
                    <text x="80" y="70" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{A || 'A'}</text>
                </svg>
            );
        }
        if (template === 'Padrão') {
            const heightVal = C || B || 'C';
            return (
                <svg viewBox="0 0 160 160" className="w-full h-full max-h-[120px] overflow-visible" xmlns="http://www.w3.org/2000/svg">
                    <rect x="45" y="45" width="70" height="70" rx="4" fill="none" stroke="#777" strokeWidth="4" />
                    <text x="80" y="35" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{A || 'A'}</text>
                    <text x="80" y="135" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{A || 'A'}</text>
                    <text x="25" y="85" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{heightVal}</text>
                    <text x="130" y="85" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{heightVal}</text>
                </svg>
            );
        }
        if (template === 'U') {
            return (
                <svg viewBox="0 0 160 160" className="w-full h-full max-h-[120px] overflow-visible" xmlns="http://www.w3.org/2000/svg">
                    <path d="M 45,50 L 45,115 L 115,115 L 115,50" fill="none" stroke="#777" strokeWidth="4" strokeLinejoin="round" />
                    <text x="80" y="135" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{A || 'A'}</text>
                    <text x="25" y="85" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{C || 'C'}</text>
                    <text x="130" y="85" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{C || 'C'}</text>
                </svg>
            );
        }
        if (template === 'U Dobras Ext') {
            return (
                <svg viewBox="0 0 160 160" className="w-full h-full max-h-[120px] overflow-visible" xmlns="http://www.w3.org/2000/svg">
                    <path d="M 30,50 L 50,50 L 50,115 L 110,115 L 110,50 L 130,50" fill="none" stroke="#777" strokeWidth="4" strokeLinejoin="round" />
                    <text x="80" y="135" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{A || 'A'}</text>
                    <text x="35" y="85" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{C || 'C'}</text>
                    <text x="125" y="85" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{C || 'C'}</text>
                    <text x="120" y="40" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{D || 'D'}</text>
                    <text x="40" y="40" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{D || 'D'}</text>
                </svg>
            );
        }
        if (template === 'U Dobras Int') {
            return (
                <svg viewBox="0 0 160 160" className="w-full h-full max-h-[120px] overflow-visible" xmlns="http://www.w3.org/2000/svg">
                    <path d="M 65,50 L 50,50 L 50,115 L 110,115 L 110,50 L 95,50" fill="none" stroke="#777" strokeWidth="4" strokeLinejoin="round" />
                    <text x="80" y="135" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{A || 'A'}</text>
                    <text x="35" y="85" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{C || 'C'}</text>
                    <text x="125" y="85" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{C || 'C'}</text>
                    <text x="102" y="40" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#D">{D || 'D'}</text>
                    <text x="58" y="40" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#f00">{E || 'E'}</text>
                </svg>
            );
        }
        if (template === 'Especial') {
            return (
                <svg viewBox="0 0 160 160" className="w-full h-full max-h-[120px] overflow-visible" xmlns="http://www.w3.org/2000/svg">
                    <path d="M 25,70 L 40,70 L 40,115 L 65,115 L 65,50 L 95,50 L 95,115 L 120,115 L 120,70 L 135,70" fill="none" stroke="#777" strokeWidth="4" strokeLinejoin="round" />
                    <text x="110" y="130" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{A || 'A'}</text>
                    <text x="135" y="95" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{B || 'B'}</text>
                    <text x="80" y="40" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#C">{C || 'C'}</text>
                    <text x="128" y="60" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#D">{D || 'D'}</text>
                    <text x="32" y="60" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#f00">{E || 'E'}</text>
                    <text x="53" y="85" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#F">{F || 'F'}</text>
                </svg>
            );
        }
        if (template === 'Padrão, definir dobras finais') {
            return (
                <svg viewBox="0 0 160 160" className="w-full h-full max-h-[120px] overflow-visible" xmlns="http://www.w3.org/2000/svg">
                    <rect x="50" y="50" width="70" height="70" rx="4" fill="none" stroke="#777" strokeWidth="4" />
                    <text x="85" y="140" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{A || 'A'}</text>
                    <text x="135" y="90" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{B || 'B'}</text>
                    <path d="M 50,50 L 30,50" fill="none" stroke="#f00" strokeWidth="3" strokeDasharray="4,3" />
                    <path d="M 50,50 L 50,30" fill="none" stroke="#f00" strokeWidth="3" strokeDasharray="4,3" />
                    <text x="35" y="40" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#f00">{C || 'C'}</text>
                </svg>
            );
        }
        if (template === 'Transpasse em X') {
            return (
                <svg viewBox="0 0 160 160" className="w-full h-full max-h-[120px] overflow-visible" xmlns="http://www.w3.org/2000/svg">
                    <rect x="50" y="50" width="60" height="60" rx="4" fill="none" stroke="#777" strokeWidth="4" />
                    <text x="80" y="130" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{A || 'A'}</text>
                    <text x="125" y="85" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#B">{B || 'B'}</text>
                    <path d="M 50,50 L 35,35" fill="none" stroke="#777" strokeWidth="4" strokeLinecap="round" />
                    <path d="M 110,50 L 125,35" fill="none" stroke="#777" strokeWidth="4" strokeLinecap="round" />
                    <text x="30" y="30" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{C || 'C'}</text>
                    <text x="130" y="30" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{D || 'D'}</text>
                </svg>
            );
        }
        if (template === 'Estribo de travamento') {
            return (
                <svg viewBox="0 0 160 160" className="w-full h-full max-h-[120px] overflow-visible" xmlns="http://www.w3.org/2000/svg">
                    <rect x="50" y="50" width="60" height="60" rx="4" fill="none" stroke="#777" strokeWidth="4" />
                    <line x1="50" y1="50" x2="110" y2="110" stroke="#777" strokeWidth="3" />
                    <text x="80" y="130" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{A || 'A'}</text>
                    <text x="125" y="85" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#B">{B || 'B'}</text>
                    <text x="65" y="70" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{C || 'C'}</text>
                    <text x="95" y="90" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{D || 'D'}</text>
                </svg>
            );
        }
    }
    
    if (effectiveLados === 'REDONDA') {
        return (
            <svg viewBox="0 0 160 160" className="w-full h-full max-h-[120px] overflow-visible" xmlns="http://www.w3.org/2000/svg">
                <circle cx="80" cy="80" r="40" fill="none" stroke="#777" strokeWidth="4" />
                <text x="80" y="85" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{A || 'A'}</text>
                {B && <text x="80" y="135" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#f00">{B}</text>}
            </svg>
        );
    }
    
    // Default fallback
    return (
        <svg viewBox="0 0 160 160" className="w-full h-full max-h-[120px] overflow-visible" xmlns="http://www.w3.org/2000/svg">
            <rect x="45" y="45" width="70" height="70" rx="4" fill="none" stroke="#777" strokeWidth="4" />
            <text x="80" y="35" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{A || 'A'}</text>
            <text x="25" y="85" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#000">{B || 'B'}</text>
        </svg>
    );
};

export const renderBarDiagramSVG = (
    modelName: string,
    ladoA: string, ladoB: string, ladoC: string, ladoD: string, ladoE: string,
    small = false
) => {
    const W = small ? 120 : 200;
    const H = small ? 70 : 140;
    const mainY = small ? 45 : 90;
    const topY  = small ? 8 :  22;
    const botY  = small ? 65 : 130;
    const lX    = small ? 20 : 30;
    const rX    = small ? 100 : 170;
    const hook  = small ? 10 : 18;
    const fs    = small ? 9 : 12;
    const midY  = (mainY + topY) / 2;
    const midYb = (mainY + botY) / 2;

    const nameUpper = (modelName || '').toUpperCase();
    
    // Se o nome sugere que vai para fora
    const isFora = nameUpper.includes('FORA');
    
    // Verifica se é afunilado
    const isAful = nameUpper.includes('AFUNILADO');
    
    // Se tem valor numérico nos lados, desenha a respectiva ponta
    const valD = parseFloat(ladoD) || 0;
    const valE = parseFloat(ladoE) || 0;
    
    // Esquerda (Lado D)
    const leftUp   = valD > 0 && !isFora && !isAful;
    const leftDown = valD > 0 && isFora && !isAful;
    const leftAful = valD > 0 && isAful;

    // Direita (Lado E, ou Lado B como fallback para legados)
    const valRight = valE > 0 ? valE : (parseFloat(ladoB) || 0);
    const strRight = valE > 0 ? ladoE : ladoB;
    const rightUp   = valRight > 0 && !isFora && !isAful;
    const rightDown = valRight > 0 && isFora && !isAful;
    const rightAful = valRight > 0 && isAful;

    const isGancho = nameUpper.includes('GANCHO');

    return (
        <svg viewBox={`0 0 ${W} ${H}`} className={small ? 'w-28 h-16' : 'w-44 h-32'} xmlns="http://www.w3.org/2000/svg">
            {/* Main bar */}
            <line x1={lX} y1={mainY} x2={rX} y2={mainY} stroke="#333" strokeWidth="2.5"/>
            {/* A label below */}
            <text x={(lX+rX)/2} y={mainY + fs + 4} textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#444">
                {ladoA || 'A'}
            </text>

            {/* LEFT arm - goes UP (PARA DENTRO) */}
            {leftUp && <>
                <line x1={lX} y1={mainY} x2={lX} y2={topY} stroke="#333" strokeWidth="2.5"/>
                {isGancho && <line x1={lX} y1={topY} x2={lX+hook} y2={topY} stroke="#333" strokeWidth="2.5"/>}
                <text x={lX-14} y={midY+fs/2} textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#444">
                    {ladoD || 'D'}
                </text>
            </>}

            {/* LEFT arm - goes DOWN (PARA FORA) */}
            {leftDown && <>
                <line x1={lX} y1={mainY} x2={lX} y2={botY} stroke="#333" strokeWidth="2.5"/>
                {isGancho && <line x1={lX} y1={botY} x2={lX+hook} y2={botY} stroke="#333" strokeWidth="2.5"/>}
                <text x={lX-14} y={midYb+fs/2} textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#444">
                    {ladoD || 'D'}
                </text>
            </>}

            {/* LEFT - AFUNILADO */}
            {leftAful && <>
                <line x1={lX} y1={mainY} x2={lX-12} y2={mainY-20} stroke="#333" strokeWidth="2"/>
                <text x={lX-20} y={mainY-8} textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#444">
                    {ladoD || 'D'}
                </text>
            </>}

            {/* RIGHT arm - goes UP (PARA DENTRO) */}
            {rightUp && <>
                <line x1={rX} y1={mainY} x2={rX} y2={topY} stroke="#333" strokeWidth="2.5"/>
                {isGancho && <line x1={rX} y1={topY} x2={rX-hook} y2={topY} stroke="#333" strokeWidth="2.5"/>}
                <text x={rX+14} y={midY+fs/2} textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#444">
                    {strRight || 'E'}
                </text>
            </>}

            {/* RIGHT arm - goes DOWN (PARA FORA) */}
            {rightDown && <>
                <line x1={rX} y1={mainY} x2={rX} y2={botY} stroke="#333" strokeWidth="2.5"/>
                {isGancho && <line x1={rX} y1={botY} x2={rX-hook} y2={botY} stroke="#333" strokeWidth="2.5"/>}
                <text x={rX+14} y={midYb+fs/2} textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#444">
                    {strRight || 'E'}
                </text>
            </>}

            {/* RIGHT - AFUNILADO */}
            {rightAful && <>
                <line x1={rX} y1={mainY} x2={rX+12} y2={mainY-20} stroke="#333" strokeWidth="2"/>
                <text x={rX+20} y={mainY-8} textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#444">
                    {strRight || 'E'}
                </text>
            </>}
        </svg>
    );
};
