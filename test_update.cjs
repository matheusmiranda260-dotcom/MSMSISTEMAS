const fs = require('fs');
const file = 'c:/Users/GIGABYTE/Desktop/projeto leonardo/Nova pasta/MSMSISTEMAS/MSMSISTEMAS/components/GaugesManager.tsx';
let content = fs.readFileSync(file, 'utf8');

const tableStart = '{filteredGauges.map(g => {';
const tableEndStr = '                                    {filteredGauges.length === 0 && (';

const startIndex = content.indexOf(tableStart);
const endIndex = content.indexOf(tableEndStr);

if (startIndex === -1 || endIndex === -1) {
    console.error('Could not find table boundaries');
    process.exit(1);
}

const newTable = `
                                    {(() => {
                                        const childrenMap = new Map<string, import('../types').StockGauge[]>();
                                        const topLevelGauges = filteredGauges.filter(g => {
                                            if (g.subgroupCode && g.subgroupCode !== g.productCode) {
                                                const parent = filteredGauges.find(p => p.productCode === g.subgroupCode);
                                                if (parent) {
                                                    if (!childrenMap.has(parent.id)) childrenMap.set(parent.id, []);
                                                    childrenMap.get(parent.id).push(g);
                                                    return false; // It's a child
                                                }
                                            }
                                            return true; // Top level
                                        });

                                        const toggleExpand = (id: string) => {
                                            setExpandedRows(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]);
                                        };

                                        return topLevelGauges.map(g => {
                                            const children = childrenMap.get(g.id) || [];
                                            const hasChildren = children.length > 0;
                                            const isExpanded = expandedRows.includes(g.id);
                                            
                                            const stockInfo = getStockInfo(g.materialType, g.gauge);
                                            
                                            // Aggregate totals
                                            let totalWeight = stockInfo.totalWeight;
                                            let totalLots = stockInfo.count;
                                            children.forEach(child => {
                                                const childStock = getStockInfo(child.materialType, child.gauge);
                                                totalWeight += childStock.totalWeight;
                                                totalLots += childStock.count;
                                            });
                                            
                                            const percent = g.idealWeight ? Math.min(100, (totalWeight / g.idealWeight) * 100) : (totalWeight > 0 ? 50 : 0);

                                            const renderRow = (item: import('../types').StockGauge, isChild: boolean, aggregatedTotalWeight?: number, aggregatedTotalLots?: number, percentValue?: number) => {
                                                const itemStockInfo = getStockInfo(item.materialType, item.gauge);
                                                const hasStock = itemStockInfo.count > 0;
                                                
                                                let displayValue = item.gauge.replace('.', ',');
                                                let displayUnit = '';
                                                const units = ['mm', 'mts', 'kg', 'unid', 'BWG'];
                                                for (const u of units) {
                                                    if (item.gauge.toLowerCase().endsWith(\` \${u.toLowerCase()}\`)) {
                                                        displayValue = item.gauge.substring(0, item.gauge.length - u.length - 1).replace('.', ',');
                                                        displayUnit = u;
                                                        break;
                                                    } else if (item.gauge.toLowerCase().endsWith(u.toLowerCase())) {
                                                        displayValue = item.gauge.substring(0, item.gauge.length - u.length).replace('.', ',');
                                                        displayUnit = u;
                                                        break;
                                                    }
                                                }

                                                return (
                                                    <tr key={item.id} className={\`hover:bg-slate-50/50 transition-colors group \${isChild ? 'bg-slate-50 border-l-4 border-l-blue-400' : 'border-b border-slate-100'}\`}>
                                                        <td className="p-4 font-semibold text-slate-900">
                                                            <div className="flex items-center gap-2">
                                                                {!isChild && hasChildren && (
                                                                    <button onClick={() => toggleExpand(item.id)} className="p-1 text-slate-400 hover:text-blue-600 bg-white rounded shadow-sm border border-slate-200">
                                                                        <svg xmlns="http://www.w3.org/2000/svg" className={\`h-4 w-4 transition-transform \${isExpanded ? 'rotate-180' : ''}\`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                                        </svg>
                                                                    </button>
                                                                )}
                                                                {isChild && <div className="w-4" />}
                                                                <span className={item.productCode ? 'text-blue-600 font-mono font-bold text-sm' : 'text-slate-400 italic text-sm'}>
                                                                    {item.productCode || 'Sem código'}
                                                                </span>
                                                            </div>
                                                        </td>

                                                        <td className="p-4">
                                                            <div className="flex flex-col space-y-1">
                                                                <span className="font-bold text-slate-805 text-sm">{item.materialType}</span>
                                                                <div className="flex flex-wrap gap-1">
                                                                    <span className={\`inline-block px-1.5 py-0.5 text-[9px] font-bold rounded \${
                                                                        item.itemType === 'produto_composto'
                                                                            ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                                                            : 'bg-blue-100 text-blue-700 border border-blue-200'
                                                                    }\`}>
                                                                        {item.itemType === 'produto_composto' ? 'Composto' : 'Matéria-Prima'}
                                                                    </span>
                                                                    {item.packagingType && item.packagingType !== 'granel' && (
                                                                        <span className="inline-block px-1.5 py-0.5 text-[9px] font-bold rounded bg-indigo-100 text-indigo-700 border border-indigo-200">
                                                                            {item.packagingType === 'rolo' ? 'Rolo' : item.packagingType === 'pacote' ? \`Pacote\` : item.packagingType === 'barra' ? 'Barra' : 'Granel'}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>

                                                        <td className="p-4">
                                                            {item.subgroupCode ? (
                                                                <span className="inline-flex items-center px-2 py-1 rounded-md bg-slate-100 text-slate-700 font-medium text-xs border border-slate-200 shadow-sm">
                                                                    {item.subgroupCode}
                                                                </span>
                                                            ) : (
                                                                <span className="text-slate-300 text-xs">-</span>
                                                            )}
                                                        </td>

                                                        <td className="p-4 font-bold text-slate-850 text-sm">
                                                            <div className="flex flex-col">
                                                                <span>
                                                                    {displayValue}{displayUnit ? \` \${displayUnit}\` : ''}
                                                                    {item.weightType === 'unid' && item.pieceSize ? \` x \${String(item.pieceSize).replace('.', ',')}m\` : ''}
                                                                </span>
                                                                <span className="text-[10px] text-slate-400 font-normal">
                                                                    {item.weightType === 'unid' && item.pieceSize ? '(Ø/L)' : '(Ø)'}
                                                                </span>
                                                            </div>
                                                        </td>

                                                        <td className="p-4 text-xs font-semibold text-slate-700">
                                                            {item.weightType === 'unid' && item.pieceSize ? (
                                                                <div className="flex flex-col">
                                                                    <span>{String(item.rawWeightValue || 0).replace('.', ',')} kg/barra</span>
                                                                    <span className="text-[10px] text-slate-400 font-normal">({String(item.weightPerMeter || 0).replace('.', ',')} kg/m)</span>
                                                                </div>
                                                            ) : (
                                                                <span>{String(item.weightPerMeter || 0).replace('.', ',')} kg/m</span>
                                                            )}
                                                        </td>

                                                        <td className="p-4 text-xs font-semibold text-slate-700">
                                                            <div className="flex flex-col space-y-1">
                                                                <span className="font-bold text-slate-800">
                                                                    Total: {(aggregatedTotalWeight !== undefined ? aggregatedTotalWeight : itemStockInfo.totalWeight).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 3 })} kg
                                                                </span>
                                                                <span className="text-xs text-slate-500 font-semibold">
                                                                    {aggregatedTotalLots !== undefined ? aggregatedTotalLots : itemStockInfo.count} Lotes
                                                                </span>
                                                                {(aggregatedTotalWeight !== undefined ? aggregatedTotalWeight : itemStockInfo.totalWeight) > 0 && (
                                                                    <div className="w-24 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                                                        <div 
                                                                            className={\`h-full rounded-full \${
                                                                                (percentValue !== undefined ? percentValue : 50) < 25 ? 'bg-red-500' : (percentValue !== undefined ? percentValue : 50) < 60 ? 'bg-amber-500' : 'bg-emerald-500'
                                                                            }\`}
                                                                            style={{ width: \`\${percentValue !== undefined ? percentValue : 50}%\` }}
                                                                        />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>

                                                        <td className="p-4 font-bold text-slate-850 text-sm">
                                                            {item.purchasePrice ? \`R$ \${item.purchasePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\` : '-'}
                                                        </td>

                                                        <td className="p-4">
                                                            <span className={\`px-2.5 py-0.5 text-xs font-bold rounded-full border flex items-center gap-1 w-fit \${
                                                                item.status === 'Inativo'
                                                                    ? 'bg-slate-100 text-slate-500 border-slate-200'
                                                                    : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                                            }\`}>
                                                                <span className={\`h-1.5 w-1.5 rounded-full \${item.status === 'Inativo' ? 'bg-slate-450' : 'bg-emerald-500'}\`} />
                                                                {item.status || 'Ativo'}
                                                            </span>
                                                        </td>

                                                        {isGestor && (
                                                            <td className="p-4">
                                                                <div className="flex items-center justify-center gap-2">
                                                                    {item.id.startsWith('STOCK-') ? (
                                                                        <>
                                                                            <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded font-bold">
                                                                                Sem cadastro
                                                                            </span>
                                                                            <button
                                                                                onClick={() => {
                                                                                    if (confirm(\`A bitola "\${item.gauge}" do material "\${item.materialType}" aparece no estoque mas não está cadastrada no sistema.\\n\\nCadastre-a para ter controle total.\\n\\nDeseja apenas remover da visualização?\`)) {
                                                                                        onDelete(item.id);
                                                                                    }
                                                                                }}
                                                                                className="p-1.5 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition"
                                                                                title="Remover da visualização (não cadastrado)"
                                                                            >
                                                                                <TrashIcon className="h-4 w-4" />
                                                                            </button>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <button
                                                                                onClick={() => setViewingGauge(item)}
                                                                                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                                                                                title="Visualizar Histórico e Detalhes"
                                                                            >
                                                                                <EyeIcon className="h-4 w-4" />
                                                                            </button>
                                                                            <button
                                                                                onClick={() => handleStartEdit(item)}
                                                                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                                                                title="Editar"
                                                                            >
                                                                                <PencilIcon className="h-4 w-4" />
                                                                            </button>
                                                                            {hasStock ? (
                                                                                <button
                                                                                    onClick={() => alert(\`Não é possível excluir pois existem lotes em estoque usando esta bitola.\`)}
                                                                                    className="p-1.5 text-slate-300 cursor-not-allowed rounded-lg"
                                                                                    title="Em estoque (bloqueado)"
                                                                                >
                                                                                    <TrashIcon className="h-4 w-4 opacity-50" />
                                                                                </button>
                                                                            ) : (
                                                                                <button
                                                                                    onClick={() => {
                                                                                        if (confirm(\`Deseja realmente excluir a bitola \${item.gauge} do material \${item.materialType}?\`)) {
                                                                                            onDelete(item.id);
                                                                                        }
                                                                                    }}
                                                                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                                                                                    title="Excluir"
                                                                                >
                                                                                    <TrashIcon className="h-4 w-4" />
                                                                                </button>
                                                                            )}
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        )}
                                                    </tr>
                                                );
                                            };

                                            return (
                                                <React.Fragment key={g.id}>
                                                    {renderRow(g, false, hasChildren ? totalWeight : undefined, hasChildren ? totalLots : undefined, hasChildren ? percent : undefined)}
                                                    {isExpanded && children.map(child => renderRow(child, true))}
                                                </React.Fragment>
                                            );
                                        });
                                    })()}
`;

content = content.substring(0, startIndex) + newTable + content.substring(endIndex);
fs.writeFileSync(file, content, 'utf8');
console.log('Table rewritten successfully.');
