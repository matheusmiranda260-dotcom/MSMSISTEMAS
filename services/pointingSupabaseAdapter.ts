import { supabase } from './supabaseService';
import type { Quote, ProductItem, FerroItem, QuoteHistoryRecord, BitolaConfig, ArameConfig, EstriboModel, FerroModel, TravaModel } from '../types';

export const fetchAllQuotesFromDB = async (): Promise<Quote[]> => {
    // Fetch all tables in parallel for maximum speed
    const [
        { data: quotesData, error: quotesError },
        { data: productsData, error: productsError },
        { data: ferrosData, error: ferrosError },
        { data: notesData, error: notesError },
        { data: historyData, error: historyError }
    ] = await Promise.all([
        supabase.from('quotes').select('*'),
        supabase.from('quote_products').select('*'),
        supabase.from('quote_product_ferros').select('*'),
        supabase.from('quote_notes').select('*'),
        supabase.from('quote_history').select('*')
    ]);

    if (quotesError) {
        console.error('Error fetching quotes:', quotesError);
        return [];
    }
    if (productsError) console.error('Error fetching quote_products:', productsError);
    if (ferrosError) console.error('Error fetching quote_product_ferros:', ferrosError);
    if (notesError) console.error('Error fetching quote_notes:', notesError);
    if (historyError) console.error('Error fetching quote_history:', historyError);

    const quotes: Quote[] = quotesData.map((q: any) => {
        // Find products for this quote
        const qProducts = (productsData || []).filter((p: any) => p.quote_id === q.id).map((p: any): ProductItem => {
            // Find ferros for this product
            const pFerros = (ferrosData || []).filter((f: any) => f.product_id === p.id).map((f: any): FerroItem => ({
                id: f.id,
                nomeElemento: f.nome_elemento,
                qtde: Number(f.qtde),
                bitola: f.bitola,
                bitolaKgm: Number(f.bitola_kgm),
                bitolaPrice: f.bitola_price ? Number(f.bitola_price) : undefined,
                ferroModelId: f.ferro_model_id,
                ladoA: f.lado_a,
                ladoB: f.lado_b,
                ladoC: f.lado_c,
                ladoD: f.lado_d,
                ladoE: f.lado_e,
                ladoF: f.lado_f,
                obs: f.obs,
                drawingType: f.drawing_type,
                estriboShape: f.estribo_shape,
                espacamento: f.espacamento
            }));

            return {
                id: p.id,
                description: p.description,
                qty: Number(p.qty),
                length: Number(p.length),
                weightPerMeter: Number(p.weight_per_meter),
                weight: Number(p.weight),
                price: Number(p.price),
                locked: p.locked,
                attachmentName: p.attachment_name,
                attachmentUrl: p.attachment_url,
                ferros: pFerros
            };
        });

        const qNotes = (notesData || []).filter((n: any) => n.quote_id === q.id).map((n: any) => n.note);
        const qHistory = (historyData || []).filter((h: any) => h.quote_id === q.id).map((h: any): QuoteHistoryRecord => ({
            date: h.date,
            action: h.action,
            user: h.username
        }));

        return {
            id: q.id,
            date: q.date,
            salesperson: q.salesperson,
            clientCode: q.client_code,
            clientName: q.client_name,
            clientCity: q.client_city,
            clientObs: q.client_obs,
            price: Number(q.price),
            hardwareType: q.hardware_type,
            forecastDate: q.forecast_date,
            status: q.status,
            ddd: q.ddd,
            phone: q.phone,
            email: q.email,
            dischargeByClient: q.discharge_by_client,
            acrescimoPercent: q.acrescimo_percent ? Number(q.acrescimo_percent) : 0,
            acrescimoReal: q.acrescimo_real ? Number(q.acrescimo_real) : 0,
            descontoPercent: q.desconto_percent ? Number(q.desconto_percent) : 0,
            descontoReal: q.desconto_real ? Number(q.desconto_real) : 0,
            condicoesPagamento: q.condicoes_pagamento,
            arameKg: q.arame_kg ? Number(q.arame_kg) : 0,
            aramePreco: q.arame_preco ? Number(q.arame_preco) : 0,
            products: qProducts,
            notes: qNotes,
            history: qHistory
        };
    });

    return quotes;
};

export const saveQuoteToDB = async (quote: Quote) => {
    // 1. Upsert Quote
    const quotePayload = {
        id: quote.id,
        date: quote.date,
        salesperson: quote.salesperson,
        client_code: quote.clientCode,
        client_name: quote.clientName,
        client_city: quote.clientCity,
        client_obs: quote.clientObs,
        price: quote.price,
        hardware_type: quote.hardwareType,
        forecast_date: quote.forecastDate,
        status: quote.status,
        ddd: quote.ddd,
        phone: quote.phone,
        email: quote.email,
        discharge_by_client: quote.dischargeByClient,
        acrescimo_percent: quote.acrescimoPercent,
        acrescimo_real: quote.acrescimoReal,
        desconto_percent: quote.descontoPercent,
        desconto_real: quote.descontoReal,
        condicoes_pagamento: quote.condicoesPagamento,
        arame_kg: quote.arameKg,
        arame_preco: quote.aramePreco,
        updated_at: new Date().toISOString()
    };

    const { error: quoteError } = await supabase.from('quotes').upsert(quotePayload);
    if (quoteError) {
        console.error('Error upserting quote:', quoteError);
        alert(`Erro ao salvar orçamento ${quote.id}: ${quoteError.message}`);
        return false;
    }

    // Since we don't have an easy diff mechanism for deeply nested structures in frontend right now,
    // we delete existing products, ferros, notes and history and recreate them to ensure sync.
    // In production, a smarter diff would be better, but cascading deletes makes this safe.
    const { error: delProductsError } = await supabase.from('quote_products').delete().eq('quote_id', quote.id);
    if (delProductsError) {
        console.error('Error deleting products:', delProductsError);
        alert(`Erro ao limpar produtos antigos do orçamento ${quote.id}: ${delProductsError.message}`);
        return false;
    }

    const { error: delNotesError } = await supabase.from('quote_notes').delete().eq('quote_id', quote.id);
    if (delNotesError) {
        console.error('Error deleting notes:', delNotesError);
        alert(`Erro ao limpar notas antigas do orçamento ${quote.id}: ${delNotesError.message}`);
        return false;
    }

    const { error: delHistoryError } = await supabase.from('quote_history').delete().eq('quote_id', quote.id);
    if (delHistoryError) {
        console.error('Error deleting history:', delHistoryError);
        alert(`Erro ao limpar histórico antigo do orçamento ${quote.id}: ${delHistoryError.message}`);
        return false;
    }

    // 2. Insert Products
    if (quote.products && quote.products.length > 0) {
        for (const prod of quote.products) {
            // Check if prod.id is a valid UUID, otherwise we let the DB generate it or we generate one.
            // For safety, we will generate a UUID if it's not standard 36 chars.
            let pId = prod.id;
            if (pId.length !== 36) {
                pId = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') 
                    ? crypto.randomUUID() 
                    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                        return v.toString(16);
                    });
            }

            const pPayload = {
                id: pId,
                quote_id: quote.id,
                description: prod.description,
                qty: prod.qty,
                length: prod.length,
                weight_per_meter: prod.weightPerMeter,
                weight: prod.weight,
                price: prod.price,
                locked: prod.locked,
                attachment_name: prod.attachmentName,
                attachment_url: prod.attachmentUrl
            };
            const { error: pError } = await supabase.from('quote_products').insert(pPayload);
            if (pError) {
                console.error('Error inserting product:', pError);
                alert(`Erro ao inserir produto no orçamento: ${pError.message}`);
                return false;
            }

            // 3. Insert Ferros
            if (prod.ferros && prod.ferros.length > 0) {
                const ferrosPayload = prod.ferros.map(f => {
                    let fId = f.id;
                    if (!fId || fId.length !== 36) {
                        fId = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
                            ? crypto.randomUUID()
                            : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                                var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                                return v.toString(16);
                            });
                    }
                    return {
                        id: fId,
                        product_id: pId,
                        nome_elemento: f.nomeElemento,
                        qtde: f.qtde,
                        bitola: f.bitola,
                        bitola_kgm: f.bitolaKgm,
                        bitola_price: f.bitolaPrice,
                        ferro_model_id: f.ferroModelId,
                        lado_a: f.ladoA,
                        lado_b: f.ladoB,
                        lado_c: f.ladoC,
                        lado_d: f.ladoD,
                        lado_e: f.ladoE,
                        lado_f: f.ladoF,
                        obs: f.obs,
                        drawing_type: f.drawingType,
                        estribo_shape: f.estriboShape,
                        espacamento: f.espacamento
                    };
                });
                const { error: fError } = await supabase.from('quote_product_ferros').insert(ferrosPayload);
                if (fError) {
                    console.error('Error inserting ferros:', fError);
                    alert(`Erro ao inserir os ferros/estribos do produto: ${fError.message}`);
                    return false;
                }
            }
        }
    }

    // 4. Insert Notes
    if (quote.notes && quote.notes.length > 0) {
        const notesPayload = quote.notes.map(n => ({
            quote_id: quote.id,
            note: n
        }));
        const { error: notesError } = await supabase.from('quote_notes').insert(notesPayload);
        if (notesError) {
            console.error('Error inserting notes:', notesError);
            alert(`Erro ao salvar notas do orçamento: ${notesError.message}`);
            return false;
        }
    }

    // 5. Insert History
    if (quote.history && quote.history.length > 0) {
        const historyPayload = quote.history.map(h => ({
            quote_id: quote.id,
            date: h.date,
            action: h.action,
            username: h.user
        }));
        const { error: historyError } = await supabase.from('quote_history').insert(historyPayload);
        if (historyError) {
            console.error('Error inserting history:', historyError);
            alert(`Erro ao salvar histórico do orçamento: ${historyError.message}`);
            return false;
        }
    }

    return true;
};

export const deleteQuoteFromDB = async (id: string) => {
    const { error } = await supabase.from('quotes').delete().eq('id', id);
    if (error) console.error('Error deleting quote:', error);
    return !error;
};

export const fetchBitolasConfigFromDB = async (): Promise<BitolaConfig[]> => {
    const { data, error } = await supabase.from('config_bitolas').select('*').order('created_at', { ascending: true });
    if (error) {
        alert(`ERRO CRÍTICO no banco: ${error.message} (Verifique se a coluna created_at existe ou se o RLS está bloqueando a leitura)`);
        console.error('Error fetching config_bitolas:', error);
        return [];
    }
    return data.map((d: any) => ({
        id: d.id,
        label: d.label,
        kgm: Number(d.kgm),
        price: Number(d.price),
        amarrado: d.amarrado,
        corteDobra: d.corte_dobra,
        codMerco: d.cod_merco
    }));
};

export const fetchArameConfigFromDB = async (): Promise<ArameConfig | null> => {
    // Use maybeSingle() instead of single() to avoid errors when the table is empty
    const { data, error } = await supabase.from('config_arame').select('*').limit(1).maybeSingle();
    if (error) {
        console.error('Error fetching arame config:', error);
        return null;
    }
    if (!data) return null;
    return {
        ptsPorKg: Number(data.pts_por_kg),
        precoPorKg: Number(data.preco_por_kg),
        materialId: data.material_id
    };
};
