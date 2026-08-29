import { Router, Request, Response } from "express";
import { GoogleGenAI, Type } from "@google/genai";
import { geminiForecastSchema, geminiMarketingSmsSchema, geminiMarketingSloganSchema, geminiChatSchema } from "./validation";

export const aiRouter = Router();

export function getAiClient(_req?: Request): GoogleGenAI | null {
  const currentKey = 
    process.env.GEMINI_API_KEY || 
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY;

  if (!currentKey) {
    return null;
  }
  try {
    return new GoogleGenAI({
      apiKey: currentKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        }
      }
    });
  } catch (err) {
    console.error("Error creating GoogleGenAI instance:", err);
    return null;
  }
}

// 1. Forecast Route
aiRouter.post("/forecast", async (req: Request, res: Response) => {
  try {
    const parsed = geminiForecastSchema.safeParse(req.body);
    const { salesHistory, inventoryStatus, businessType } = parsed.success ? parsed.data : req.body;
    const ai = getAiClient(req);

    if (!ai) {
      return res.json({
        forecastText: `### **Análise de Previsão de Vendas (Modo Simulação & Análise Local)**
        
Com base no histórico fornecido de vendas para o seu negócio de **${businessType || "Comércio Geral"}**:

1. **Tendência de Crescimento**: Projetamos um aumento aproximado de **14%** nas vendas para o próximo período devido a padrões sazonais identificados nos produtos mais vendidos.
2. **Produtos Críticos**: Itens com stock baixo sofrem risco elevado de rutura. Recomendamos reabastecer com urgência.
3. **Plano de Ação Sugerido**:
   * Lance uma campanha promocional direcionada para itens parados.
   * Ative o programa de fidelização com o envio de SMS para clientes inativos.
   * Centralize os recebimentos via M-Pesa Paga Fácil e E-Mola para agilizar o fluxo de caixa.`,
        growthRate: 14,
        growthTrend: "up",
        suggestedCampaigns: [
          "Super Semana de Descontos",
          "Fidelização M-Pesa Promocional",
          "Clientes VIP Stock-Out Clearance"
        ]
      });
    }

    const prompt = `Você é o OST Vendas AI, um assistente inteligente especialista em análise comercial para pequenas e médias empresas em Moçambique e mercados africanos.
Analise os seguintes dados comerciais de uma empresa do tipo "${businessType || "Comércio Geral"}":

1. Histórico de Vendas Recentes: ${JSON.stringify(salesHistory || [])}
2. Produtos em Estado Crítico de Stock: ${JSON.stringify(inventoryStatus || [])}

Gere um relatório de previsão de vendas e conselhos comerciais práticos. Retorne o resultado em formato JSON com a seguinte estrutura exata:
{
  "forecastText": "texto formatado em Markdown com análise, tendências e sugestões detalhadas de negócios em português.",
  "growthRate": número representando a taxa percentual esperada de crescimento ou variação,
  "growthTrend": "up" ou "down" ou "stable",
  "suggestedCampaigns": ["Campanha 1", "Campanha 2"]
}`;

    const modelsToTry = ["gemini-3.7-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];
    let responseText = "";
    let succeeded = false;

    for (const modelCandidate of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model: modelCandidate,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                forecastText: { type: Type.STRING },
                growthRate: { type: Type.NUMBER },
                growthTrend: { type: Type.STRING },
                suggestedCampaigns: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                }
              },
              required: ["forecastText", "growthRate", "growthTrend", "suggestedCampaigns"]
            }
          }
        });
        responseText = response.text || "{}";
        succeeded = true;
        break;
      } catch (e) {
        console.warn(`Model ${modelCandidate} failed, trying fallback:`, (e as Error).message);
      }
    }

    if (!succeeded) {
      throw new Error("Não foi possível obter resposta dos modelos de IA.");
    }

    const parsedJson = JSON.parse(responseText);
    res.json(parsedJson);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro desconhecido ao processar previsão com IA.";
    res.status(500).json({ error: errorMsg });
  }
});

// 2. Marketing SMS Route
aiRouter.post("/marketing/sms", async (req: Request, res: Response) => {
  try {
    const parsed = geminiMarketingSmsSchema.safeParse(req.body);
    const { productName, originalPrice, promoPrice, targetAudience } = parsed.success ? parsed.data : req.body;
    const ai = getAiClient(req);

    if (!ai) {
      return res.json({
        smsText: `🔥 Super Promoção OST! ${productName || "Produto"} por apenas ${promoPrice || 0} MT (Antes: ${originalPrice || 0} MT). Aproveite hoje mesmo! Visite a nossa loja ou peça via M-Pesa. Válido até durar o stock.`
      });
    }

    const prompt = `Crie um texto de SMS promocional persuasivo, conciso e com gatilhos de urgência para o mercado moçambicano.
Produto: ${productName}
Preço Original: ${originalPrice} MT
Preço Promocional: ${promoPrice} MT
Público Alvo: ${targetAudience || "Geral"}

O SMS deve ter menos de 160 caracteres se possível, usar emojis com moderação e incluir uma chamada para ação clara (ex: pagar por M-Pesa/visitar loja). Retorne estritamente em JSON:
{
  "smsText": "texto do SMS"
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            smsText: { type: Type.STRING }
          },
          required: ["smsText"]
        }
      }
    });

    const parsedData = JSON.parse(response.text || "{}");
    res.json(parsedData);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro ao gerar SMS de marketing.";
    res.status(500).json({ error: errorMsg });
  }
});

// 3. Marketing Slogan Route
aiRouter.post("/marketing/slogan", async (req: Request, res: Response) => {
  try {
    const parsed = geminiMarketingSloganSchema.safeParse(req.body);
    const { businessName, industry, tone } = parsed.success ? parsed.data : req.body;
    const ai = getAiClient(req);

    if (!ai) {
      return res.json({
        slogans: [
          `${businessName || "OST Vendas"} - Qualidade e confiança ao melhor preço!`,
          `O seu parceiro de confiança para as melhores compras em Moçambique.`,
          `Mais valor para o seu dia a dia.`
        ]
      });
    }

    const prompt = `Gere 3 slogans criativos e marcantes para o seguinte negócio em Moçambique:
Nome do Negócio: ${businessName}
Setor / Ramo: ${industry}
Tom de Voz: ${tone || "Profissional e acolhedor"}

Retorne em formato JSON:
{
  "slogans": ["slogan 1", "slogan 2", "slogan 3"]
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            slogans: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["slogans"]
        }
      }
    });

    const parsedData = JSON.parse(response.text || "{}");
    res.json(parsedData);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro ao gerar slogans.";
    res.status(500).json({ error: errorMsg });
  }
});

// 4. Chat Assistant Route
aiRouter.post("/chat", async (req: Request, res: Response) => {
  try {
    const parsed = geminiChatSchema.safeParse(req.body);
    const { prompt, context } = parsed.success ? parsed.data : req.body;
    const ai = getAiClient(req);

    if (!ai) {
      return res.json({
        answer: `### 🤖 Assistente OST Vendas (Modo Offline / Regras Comerciais)

Recebi a sua pergunta sobre: **"${prompt}"**.

Como especialista de gestão do OST Vendas:
- **Fluxo de Caixa**: Mantenha sempre os fechos de caixa registados diariamente.
- **Stock**: Realize contagens de inventário regulares e controle as datas de validade dos lotes.
- **Vendas**: Utilize a leitura rápida de código de barras ou atalhos de teclado (F2, F3) para agilizar o atendimento no POS.`
      });
    }

    const systemPrompt = `Você é o consultor de negócios e assistente especializado do ERP "OST Vendas", o sistema de gestão comercial e ponto de venda líder para Moçambique e mercados lusófonos.
Responda de forma clara, prestativa, altamente profissional e estruturada com formatação Markdown.
Contexto adicional do negócio atual: ${JSON.stringify(context || {})}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: `${systemPrompt}\n\nPergunta do utilizador:\n${prompt}`
    });

    res.json({ answer: response.text || "Sem resposta gerada." });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro no assistente de IA.";
    res.status(500).json({ error: errorMsg });
  }
});
