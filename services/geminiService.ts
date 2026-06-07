const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";

// Helper to call Gemini API, trying models in priority order
async function callGeminiAPI(requestBody: object): Promise<string> {
    const models = ['gemini-2.5-flash', 'gemini-3.5-flash', 'gemini-2.0-flash'];
    let lastError: Error | null = null;

    for (const model of models) {
        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody)
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const msg = errorData?.error?.message || `HTTP ${response.status}`;

                // 403 = API key issue (don't retry other models, it won't help)
                if (response.status === 403 || response.status === 401) {
                    throw new Error(
                        `Chave de API inválida ou sem permissão (${response.status}). ` +
                        `Gere uma nova chave em https://aistudio.google.com/app/apikey e atualize o arquivo .env. ` +
                        `Detalhe: ${msg}`
                    );
                }

                lastError = new Error(`Modelo ${model} falhou: ${msg}`);
                continue;
            }

            const result = await response.json();
            const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
            return text;
        } catch (err: any) {
            // Re-throw auth errors immediately
            if (err.message?.includes('inválida') || err.message?.includes('permissão')) {
                throw err;
            }
            lastError = err;
        }
    }

    throw lastError || new Error('Todos os modelos Gemini falharam.');
}

// Helper to extract JSON from raw text response
function extractJSON(rawText: string): any {
    let text = rawText.trim();
    
    // Remove triple backticks markdown wraps if they exist anywhere
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    
    if (jsonStart !== -1 && jsonEnd !== -1) {
        text = text.substring(jsonStart, jsonEnd + 1);
    }
    
    try {
        return JSON.parse(text);
    } catch (e) {
        console.warn("Direct JSON parsing failed, attempting cleanup. Raw text:", rawText);
        // Fallback: strip dangerous characters
        try {
            // Remove comments if any
            const cleaned = text.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1');
            return JSON.parse(cleaned);
        } catch (inner) {
            throw new Error("Resposta da IA não pôde ser convertida em JSON válido. Resposta pura: " + rawText.substring(0, 150));
        }
    }
}

export async function extractLotDataFromImage(file: File) {
    try {
        const base64EncodedDataPromise = new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result?.toString();
                if (result) {
                    resolve(result.split(',')[1]);
                } else {
                    reject(new Error("Falha ao ler o arquivo"));
                }
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

        const base64Image = await base64EncodedDataPromise;

        const prompt = `Você é um robô leitor especialista em etiquetas industriais (aço, arames, trefila) e romaneios.
Sua tarefa é extrair os dados EXATOS com precisão máxima.
Regras RIGOROSAS para cada campo:
1. Lote Fornecedor (supplierLot): É o número de lote original de fábrica (fabricante). Costuma ter muitos números ou código de barras associado. Procure palavras como "Lote", "Lot", "Lote Forn".
2. Lote Interno (internalLot): Se não houver, coloque \`null\`.
3. Corrida (runNumber): Procure estritamente pelas palavras "Corrida", "Heat", "Nº Corrida" ou "Cast". Identifica a fundição do metal.
4. Fornecedor (supplier): O nome da empresa que fabricou ou enviou o material (Ex: ArcelorMittal, Gerdau, Simec, etc). Fica no topo da etiqueta ou logotipo. Ignore números como "1008" ou "1006" neste campo (esses são qualidades do aço).
5. Bitola / Diâmetro (bitola): A grossura em milímetros. Exemplo: 5.5, 6.0, 12.5. Retorne isso em formato numérico como String (ex: "5.5" ou "6.0").
6. Peso Líquido (labelWeight): O peso original na etiqueta de fábrica ou romaneio do fornecedor (KG). Ignore "Peso Bruto". Pegue APENAS o número.
7. Peso da Balança (scaleWeight): Geralmente é um peso aferido (pesado) localmente, às vezes anotado à mão na nota, impresso em etiqueta de balança local ou em ticket de pesagem da própria fábrica. Se achar, coloque aqui. Se não houver nenhum peso aferido secundário/de balança aparente diferente, preencha com \`null\` ou passe o MESMO peso do labelWeight.

[NOVAS INSTRUÇÕES GLOBAIS]
Verifique se na imagem constam também as seguintes informações gerais do documento:
- nfe: Número da Nota Fiscal (NF, NFe, Nota Fiscal Eletrônica).
- conferenceNumber: Algum número de Conferência ou Romaneio visível.

Sua resposta DEVE ser ÚNICA E EXCLUSIVAMENTE um objeto JSON válido. NÃO inclua nenhum tipo de texto antes ou depois do JSON. Não coloque crases (\`\`\`).
Se não achar alguma informação, preencha com \`null\` (sem aspas).

Formato EXATO esperado (SEMPRE UM ÚNICO OBJETO JSON com a propriedade "lots" sendo um array):
{
  "nfe": "texto ou null",
  "conferenceNumber": "texto ou null",
  "lots": [
    {
      "internalLot": "texto ou null",
      "supplierLot": "texto encontrado",
      "runNumber": "texto",
      "bitola": "texto",
      "labelWeight": 1500.5,
      "scaleWeight": 1500.5,
      "supplier": "texto do fornecedor"
    }
  ]
}`;

        const requestBody = {
            contents: [
                {
                    parts: [
                        { text: prompt },
                        {
                            inline_data: {
                                mime_type: file.type || "image/jpeg",
                                data: base64Image
                            }
                        }
                    ]
                }
            ]
        };

        const textResult = await callGeminiAPI(requestBody);
        const parsedData = extractJSON(textResult);

        // Suporta tanto o formato antigo (array direto) quanto o novo (objeto com NFe e lots)
        let nfe = null;
        let conferenceNumber = null;
        let dataArray = [];

        if (Array.isArray(parsedData)) {
            dataArray = parsedData;
        } else if (parsedData && parsedData.lots) {
            nfe = parsedData.nfe;
            conferenceNumber = parsedData.conferenceNumber;
            dataArray = Array.isArray(parsedData.lots) ? parsedData.lots : [];
        } else if (parsedData) {
            dataArray = [parsedData];
        }

        const lotsData = dataArray.map((data: any) => ({
            internalLot: data.internalLot,
            supplierLot: data.supplierLot,
            runNumber: data.runNumber,
            labelWeight: typeof data.labelWeight === 'number' ? data.labelWeight : (parseFloat(data.labelWeight) || null),
            scaleWeight: typeof data.scaleWeight === 'number' ? data.scaleWeight : (parseFloat(data.scaleWeight) || null),
            bitola: typeof data.bitola === 'number' ? data.bitola.toString() : (data.bitola || null),
            supplier: data.supplier
        }));

        return {
            nfe,
            conferenceNumber,
            lots: lotsData
        };

    } catch (error) {
        console.error("Erro na leitura da imagem:", error);
        throw error;
    }
}

export async function extractOrderDataFromPDF(file: File) {
    try {
        const base64EncodedDataPromise = new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result?.toString();
                if (result) {
                    resolve(result.split(',')[1]);
                } else {
                    reject(new Error("Falha ao ler o arquivo"));
                }
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

        const base64Data = await base64EncodedDataPromise;

        const prompt = `You are a professional industrial engineering parser. 
CRITICAL REQUIREMENT: Analyze the entire metallurgical/civil engineering PDF drawing and extract EVERY SINGLE position/item (OS) listed in the document. Do not skip any item. Do not truncate the list. If there are many pages or items, you must list all of them.

FIELDS TO EXTRACT:
- orderNumber: The production order ID, drawing code, or document ID (usually found at the top, in the title block, or document header).
- inputBitola: Input wire diameter in mm (highest gauge/diameter listed in the document). E.g., "12.50", "8.00".
- targetBitola: Output diameter in mm (most common gauge in the cut list). E.g., "12.50", "5.00".
- totalWeight: Total weight of all positions in kg.

List of item positions ("items"):
Scan all tables, notes, drawings, and texts to extract EVERY OS position (usually labeled as "OS 1", "OS 2", "OS 3", etc. up to the very last one).
For each entry, extract:
- os: Full item ID (e.g., "OS 1", "OS 2", "OS 191")
- bitola: Steel gauge/diameter in mm (e.g., "12.5", "5.0", "10.0")
- steelType: Steel grade (e.g., "CA50", "CA60")
- length: Cut length in cm (e.g., 220, 20, 78)
- quantity: Cut count / quantity (e.g., 6, 13, 27)
- weight: Weight of this position in kg (e.g., 12.71, 0.40)
- drawingType: Geometric shape type. Choose exactly one: "Reto" (straight bar), "Gancho" (hooks at ends), "Estribo" (closed stirrup shape), or "Outro" (any other shape).

Return ONLY a valid raw JSON object. Do not include markdown wraps, code blocks, or triple backticks. Do not stop outputting until you have listed EVERY SINGLE OS ITEM.

Example Format:
{
  "orderNumber": "SS-ESJ-SCO-PE-BLI-014-GER-PIL-R00",
  "inputBitola": "12.5",
  "targetBitola": "12.5",
  "totalWeight": 12.71,
  "items": [
    {
      "os": "OS 1",
      "bitola": "12.5",
      "steelType": "CA50",
      "length": 220,
      "quantity": 6,
      "weight": 12.71,
      "drawingType": "Reto"
    }
  ]
}`;

        const requestBody = {
            contents: [
                {
                    parts: [
                        { text: prompt },
                        {
                            inline_data: {
                                mime_type: "application/pdf",
                                data: base64Data
                            }
                        }
                    ]
                }
            ]
        };

        const textResult = await callGeminiAPI(requestBody);
        const data = extractJSON(textResult);
        
        const items = Array.isArray(data.items) ? data.items.map((item: any) => ({
            os: item.os || null,
            bitola: typeof item.bitola === 'number' ? item.bitola.toString() : (item.bitola || null),
            steelType: item.steelType || null,
            length: typeof item.length === 'number' ? item.length : (parseFloat(item.length) || null),
            quantity: typeof item.quantity === 'number' ? item.quantity : (parseInt(item.quantity) || null),
            weight: typeof item.weight === 'number' ? item.weight : (parseFloat(item.weight) || null),
            drawingType: item.drawingType || null
        })) : [];

        return {
            orderNumber: data.orderNumber || null,
            inputBitola: typeof data.inputBitola === 'number' ? data.inputBitola.toString() : (data.inputBitola || null),
            targetBitola: typeof data.targetBitola === 'number' ? data.targetBitola.toString() : (data.targetBitola || null),
            totalWeight: typeof data.totalWeight === 'number' ? data.totalWeight : (parseFloat(data.totalWeight) || null),
            items
        };
    } catch (error) {
        console.error("Erro na leitura do PDF:", error);
        throw error;
    }
}
