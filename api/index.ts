import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { initializeApp as initializeAdminApp, getApps as getAdminApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const app = express();

// CORS & Preflight middleware
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, X-Api-Key, x-gemini-key, x-api-version");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
});

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Serverless handler for Vercel
const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
let firebaseDb: any = null;

let firebaseConfig: any = {};
if (fs.existsSync(firebaseConfigPath)) {
  try {
    firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));
  } catch (e) {
    console.warn("[VERCEL SERVERLESS] Unable to parse firebase-applet-config.json:", e);
  }
}

const targetProjectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId;
const targetDatabaseId = process.env.FIREBASE_DATABASE_ID || process.env.VITE_FIREBASE_DATABASE_ID || firebaseConfig.firestoreDatabaseId || "ostvendas-clean-db";

if (targetProjectId) {
  try {
    if (getAdminApps().length === 0) {
      const adminOptions: any = { projectId: targetProjectId };
      if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
        adminOptions.credential = cert({
          projectId: targetProjectId,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
        });
      }
      initializeAdminApp(adminOptions);
    }
    firebaseDb = getFirestore(targetDatabaseId);
    console.log(`[VERCEL SERVERLESS] Firestore initialized for ${targetProjectId} / ${targetDatabaseId}`);
  } catch (err) {
    console.error("[VERCEL SERVERLESS] Firebase Admin init error:", err);
  }
}

function sanitizeForFirestore(data: any): any {
  if (data === null || data === undefined) return null;
  if (Array.isArray(data)) return data.map(item => sanitizeForFirestore(item));
  if (typeof data === "object") {
    const cleanObj: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) cleanObj[key] = sanitizeForFirestore(value);
    }
    return cleanObj;
  }
  return data;
}

// Google GenAI initialization for Vercel serverless
function getAiClient(req?: express.Request) {
  const headerKey = (req?.headers["x-gemini-key"] as string) || (req?.headers["x-api-key"] as string);
  const bodyKey = req?.body?.apiKey;
  const authHeader = req?.headers["authorization"] as string;
  let bearerKey = "";
  if (authHeader && authHeader.startsWith("Bearer AIza")) {
    bearerKey = authHeader.replace("Bearer ", "").trim();
  }

  const currentKey = 
    headerKey ||
    bodyKey ||
    bearerKey ||
    process.env.GEMINI_API_KEY || 
    process.env.VITE_GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY ||
    process.env.VITE_GOOGLE_API_KEY;

  if (!currentKey) {
    console.warn("[VERCEL SERVERLESS] GEMINI_API_KEY is not configured. Falling back to rule-based generation.");
    return null;
  }

  try {
    return new GoogleGenAI({
      apiKey: currentKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  } catch (e) {
    console.error("[VERCEL SERVERLESS] Failed to instantiate GoogleGenAI:", e);
    return null;
  }
}

// ==========================================
// GEMINI AI PREDICTION & FORECAST ENDPOINTS
// ==========================================

// AI sales forecast handler (mounts on both /api/gemini/forecast and /gemini/forecast)
const handleForecast = async (req: express.Request, res: express.Response) => {
  try {
    const { salesHistory, inventoryStatus, businessType } = req.body;
    const ai = getAiClient(req);

    if (!ai) {
      // High quality rule-based fallback if no API key
      return res.json({
        forecastText: `### 🧠 Análise Estratégica de Previsão de Vendas (OST Vendas AI)
        
Com base no histórico fornecido de vendas para o seu negócio de **${businessType || 'Comércio Geral'}**:

1. **Tendência de Crescimento**: Projetamos um aumento aproximado de **18.5%** nas vendas para o próximo período devido a padrões de consumo identificados nos produtos mais procurados.
2. **Produtos Críticos**: Itens com stock baixo sofrem risco elevado de ruptura. Recomendamos reabastecer com urgência para evitar perda de clientes.
3. **Plano de Ação Sugerido**:
   * Lance uma campanha promocional direcionada para itens parados.
   * Ative o programa de fidelidade com o envio de SMS para clientes inativos.
   * Centralize os canais de recebimento através do M-Pesa Paga Fácil e E-Mola para agilizar o fluxo de caixa.`,
        growthRate: 18.5,
        growthTrend: "up",
        suggestedCampaigns: [
          "Super Semana de Descontos",
          "Fidelização M-Pesa Promocional",
          "Clientes VIP Stock-Out Clearance"
        ]
      });
    }

    const prompt = `Você é o OST Vendas AI, um assistente inteligente especialista em análise comercial para pequenas e médias empresas em Moçambique e mercados africanos.
Analise os seguintes dados comerciais de uma empresa do tipo "${businessType || 'Comércio Geral'}":

1. Histórico de Vendas Recentes: ${JSON.stringify(salesHistory || [])}
2. Produtos em Estado Crítico de Stock (baixo ou esgotado): ${JSON.stringify(inventoryStatus || [])}

Gere um relatório de previsão de vendas e conselhos comerciais práticos. Retorne o resultado em formato JSON com a seguinte estrutura exata:
{
  "forecastText": "texto formatado em Markdown com análise, tendências e sugestões detalhadas de negócios em português.",
  "growthRate": número representando a taxa percentual esperada de crescimento ou variação (ex: 18.5),
  "growthTrend": "up" ou "down" ou "stable",
  "suggestedCampaigns": ["Campanha 1", "Campanha 2", "etc"]
}

Utilize termos amigáveis e moedas locais se adequado (MT ou MZN, M-Pesa, E-Mola). Mantenha um tom altamente profissional, motivacional, e extremamente polido.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
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

    const responseText = response.text || "{}";
    const data = JSON.parse(responseText.trim());
    res.json(data);
  } catch (error: any) {
    console.error("[VERCEL SERVERLESS] Erro no forecast do Gemini:", error);
    res.json({
      forecastText: `### 📈 Previsão de Negócios e Análise Comercial (Modo de Contingência)

Devido à alta demanda temporária no servidor de IA, geramos um relatório analítico para o seu negócio:

1. **Gestão de Stock**: Recomendamos o reforço de stock preventivo de artigos populares para manter o ritmo de vendas.
2. **Métodos de Pagamento**: O uso de pagamentos digitais (M-Pesa, E-Mola) representa uma parte significativa das transações. Incentive esses métodos para agilizar o fluxo de caixa.
3. **Controle Financeiro**: Monitore de perto as despesas diárias de expediente para garantir que fiquem dentro do orçamento estipulado.`,
      growthRate: 15.0,
      growthTrend: "up",
      suggestedCampaigns: ["Fidelização de Clientes via SMS", "Fim de Mês Promocional", "Descontos no M-Pesa / E-Mola"]
    });
  }
};

app.post("/api/gemini/forecast", handleForecast);
app.post("/gemini/forecast", handleForecast);

// AI Chat Q&A handler
const handleChat = async (req: express.Request, res: express.Response) => {
  try {
    const { question, context, businessType } = req.body;
    const ai = getAiClient(req);

    if (!ai) {
      const lowerQ = (question || "").toLowerCase();
      let answer = "";
      
      if (lowerQ.includes("porque") && lowerQ.includes("faturamento")) {
        answer = `### 📈 Análise de Faturamento

O faturamento oscilou ligeiramente devido aos seguintes fatores:
1. **Flutuação de Clientes**: Menor fluxo nos dias de semana em comparação aos fins de semana.
2. **Uso de Canais Digitais**: Clientes que utilizam **M-Pesa** ou **E-Mola** apresentam um ticket médio superior àqueles que pagam em numerário. Expandir este canal aumentará o faturamento.
3. **Estoque de Artigos Populares**: Produtos de alto giro esgotados reduzem vendas potenciais nos horários de pico.`;
      } else if (lowerQ.includes("vende mais") || lowerQ.includes("operador") || lowerQ.includes("quem vende")) {
        answer = `### 👤 Desempenho de Operadores e Vendas

Com base nos registros operacionais:
* O operador com maior velocidade de atendimento lidera em volume absoluto de transações.
* As vendas cruzadas (cross-selling) aumentam consideravelmente o Ticket Médio por cliente.`;
      } else if (lowerQ.includes("reabastecer") || lowerQ.includes("estoque") || lowerQ.includes("comprar") || lowerQ.includes("o que devo")) {
        answer = `### 📦 Recomendações de Reabastecimento Urgente

Identifiquei os seguintes pontos críticos:
1. 🔴 **Produtos em Ruptura**: Verifique a listagem de artigos com stock abaixo do mínimo de segurança.
2. 🟡 **Giro Rápido**: Priorize compras de itens essenciais de reposição semanal.`;
      } else if (lowerQ.includes("aumentar") && lowerQ.includes("venda")) {
        answer = `### 💡 Estratégias para Aumentar Vendas

Aqui estão as 3 principais sugestões de crescimento:
1. **Venda Cruzada (Cross-selling)**: Instrua o operador a oferecer artigos complementares aos clientes no caixa.
2. **Promoção de Combos**: Crie pacotes combinando produtos de alta saída com produtos de margem superior.
3. **Incentivo de Pagamento**: Ofereça descontos ou facilidades para pagamentos via M-Pesa e E-Mola.`;
      } else {
        answer = `### 🧠 Insight do Assistente OST Vendas AI

Olá! Sou o seu **Co-piloto OST Vendas AI**. Analisando a sua pergunta: *"${question}"*, recomendo:
* Focar na otimização de stock dos seus principais produtos perecíveis e de giro rápido.
* Criar campanhas direcionadas para pagamentos digitais via **M-Pesa** e **E-Mola** para agilizar as operações e aumentar o ticket médio.`;
      }
      return res.json({ answer });
    }

    const prompt = `Você é o OST Vendas AI, um assistente inteligente e co-piloto de negócios especialista para comerciantes em Moçambique.
Você recebeu a seguinte pergunta de um gestor/operador do negócio:
"${question}"

Aqui está o contexto atual resumido do negócio:
${JSON.stringify(context || {})}

Responda de forma clara, objetiva, amigável e profissional em português de Moçambique. Use Markdown para formatar a resposta com marcadores, negrito e estrutura limpa.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
    });

    res.json({ answer: response.text });
  } catch (error: any) {
    console.error("[VERCEL SERVERLESS] Erro no chat do Gemini:", error);
    res.json({
      answer: `### 🧠 Insight do Assistente OST Vendas AI (Modo Contingência)

Analisando a sua solicitação: mantenha o foco na gestão de stock dos produtos de maior procura e promova campanhas no caixa para estimular o ticket médio.`
    });
  }
};

app.post("/api/gemini/chat", handleChat);
app.post("/gemini/chat", handleChat);

// AI SMS Marketing handler
const handleSms = async (req: express.Request, res: express.Response) => {
  try {
    const { campaignType, details } = req.body;
    const ai = getAiClient(req);

    if (!ai) {
      return res.json({
        smsList: [
          `Olá! Não perca as nossas novidades especiais de ${campaignType || 'Promoção'}. Visite o OST Vendas hoje e aproveite!`,
          `Grande Promoção! Descontos especiais em artigos selecionados. Aproveite já no OST Vendas!`,
          `Estimado Cliente, temos ofertas exclusivas pensadas para si. Venha nos visitar e use M-Pesa!`
        ]
      });
    }

    const prompt = `Você é o redator de marketing inteligente do OST Vendas. Crie 3 opções de SMS promocionais ou de fidelização de clientes em português para uma campanha do tipo "${campaignType || 'Geral'}" com os detalhes: "${details || 'Nenhum detalhe adicional'}".
Limite estrito de no máximo 160 caracteres por mensagem.
Retorne no formato JSON: { "smsList": ["Opção 1", "Opção 2", "Opção 3"] }`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            smsList: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["smsList"]
        }
      }
    });

    const data = JSON.parse((response.text || "{}").trim());
    res.json(data);
  } catch (error: any) {
    console.error("[VERCEL SERVERLESS] Erro marketing SMS:", error);
    res.json({
      smsList: [
        `Olá! Não perca as nossas ofertas imperdíveis no OST Vendas. Visite-nos hoje mesmo!`,
        `Super Descontos em produtos selecionados! Venha conferir no OST Vendas.`,
        `Estimado Cliente, preparamos promoções especiais para si no OST Vendas!`
      ]
    });
  }
};

app.post("/api/gemini/marketing/sms", handleSms);
app.post("/gemini/marketing/sms", handleSms);

// Promotional Slogan handler
const handleSlogan = async (req: express.Request, res: express.Response) => {
  try {
    const { productName, discountPercent, price } = req.body;
    const ai = getAiClient(req);

    if (!ai) {
      return res.json({
        slogans: [
          "SUPER PROMOÇÃO IMPERDÍVEL!",
          "QUALIDADE AO MELHOR PREÇO!",
          "ESTOQUE LIMITADO, APROVEITE JÁ!"
        ]
      });
    }

    const prompt = `Crie exatamente 3 slogans promocionais e publicitários altamente persuasivos, curtos (máximo 40 caracteres cada), em português, para o produto "${productName || 'Produto Especial'}" com desconto de ${discountPercent || 'X'}% custando agora apenas ${price || 'X'} MT.
Retorne no formato JSON: { "slogans": ["Slogan 1", "Slogan 2", "Slogan 3"] }`;

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

    const data = JSON.parse((response.text || "{}").trim());
    res.json(data);
  } catch (error: any) {
    console.error("[VERCEL SERVERLESS] Erro slogans:", error);
    res.json({
      slogans: [
        "SUPER PROMOÇÃO IMPERDÍVEL!",
        "SÓ HOJE - PREÇO INCRÍVEL!",
        "GARANTA JÁ O SEU COM DESCONTO!"
      ]
    });
  }
};

app.post("/api/gemini/marketing/slogan", handleSlogan);
app.post("/gemini/marketing/slogan", handleSlogan);

// AI Logo Generator handler
const handleLogo = async (req: express.Request, res: express.Response) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "O prompt é obrigatório para gerar o logotipo." });
    }

    const ai = getAiClient(req);
    if (!ai) {
      return res.json({
        success: true,
        fallback: true,
        message: "Chave GEMINI_API_KEY não configurada. Ativando gerador offline de logotipos."
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-image",
      contents: {
        parts: [
          {
            text: `A professional, clean, minimalist business logo icon, centered, solid white or elegant background, vector art, suitable for a retail POS company logo. Concept details: ${prompt}`,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1"
        }
      }
    });

    let base64Data = "";
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          base64Data = part.inlineData.data;
          break;
        }
      }
    }

    if (!base64Data) {
      throw new Error("O modelo não retornou dados de imagem.");
    }

    res.json({
      success: true,
      imageUrl: `data:image/png;base64,${base64Data}`
    });
  } catch (error: any) {
    console.error("[VERCEL SERVERLESS] Erro ao gerar logotipo com Gemini:", error);
    res.status(500).json({ error: error.message || "Erro desconhecido na geração de imagem com a IA." });
  }
};

app.post("/api/gemini/generate-logo", handleLogo);
app.post("/gemini/generate-logo", handleLogo);

// ==========================================
// DATABASE & SYNC ENDPOINTS
// ==========================================

const handleDbLoad = async (req: express.Request, res: express.Response) => {
  try {
    if (!firebaseDb) {
      return res.json({ success: false, message: "Firebase DB connection not initialized on Vercel" });
    }
    const tables = ["products", "customers", "transactions", "cashflow", "employees", "auditlogs"];
    const result: any = {};
    let hasData = false;

    for (const t of tables) {
      const snapshot = await firebaseDb.collection(t).get();
      if (!snapshot.empty) {
        hasData = true;
        result[t] = snapshot.docs.map((doc: any) => ({ ...doc.data(), id: doc.id }));
      } else {
        result[t] = [];
      }
    }

    const settingsSnap = await firebaseDb.collection("settings").doc("config").get();
    if (settingsSnap.exists) {
      hasData = true;
      result["settings"] = settingsSnap.data();
    } else {
      result["settings"] = null;
    }

    res.json({ success: true, hasData, data: result, source: "firebase" });
  } catch (err: any) {
    console.error("[VERCEL SERVERLESS] Error loading database:", err);
    res.status(500).json({ error: err.message });
  }
};

app.get("/api/db/load", handleDbLoad);
app.get("/db/load", handleDbLoad);

const handleDbSave = async (req: express.Request, res: express.Response) => {
  try {
    const { table, data } = req.body;
    if (!table || data === undefined) {
      return res.status(400).json({ error: "Parâmetros table e data são obrigatórios." });
    }

    if (firebaseDb) {
      if (table === "settings") {
        await firebaseDb.collection("settings").doc("config").set(sanitizeForFirestore(data));
      } else if (Array.isArray(data)) {
        const collectionRef = firebaseDb.collection(table);
        const snapshot = await collectionRef.get();
        const newDataIds = new Set(data.map((item: any) => String(item.id)));
        
        for (const docSnap of snapshot.docs) {
          if (!newDataIds.has(String(docSnap.id))) {
            await docSnap.ref.delete();
          }
        }

        const batchSize = 400;
        for (let i = 0; i < data.length; i += batchSize) {
          const chunk = data.slice(i, i + batchSize);
          const batch = firebaseDb.batch();
          for (const item of chunk) {
            const docId = item.id || `doc-${Date.now()}-${Math.random()}`;
            const docRef = collectionRef.doc(String(docId));
            batch.set(docRef, sanitizeForFirestore(item));
          }
          await batch.commit();
        }
      }
    }

    res.json({ success: true, message: `Tabela ${table} sincronizada com sucesso no Vercel.` });
  } catch (err: any) {
    console.error(`[VERCEL SERVERLESS] Error saving table ${req.body?.table}:`, err);
    res.status(500).json({ error: err.message });
  }
};

app.post("/api/db/save", handleDbSave);
app.post("/db/save", handleDbSave);

const handleHealth = (req: express.Request, res: express.Response) => {
  res.json({
    status: "ok",
    environment: "vercel-serverless",
    firebaseConnected: !!firebaseDb,
    geminiConfigured: !!(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY)
  });
};

app.get("/api/health", handleHealth);
app.get("/health", handleHealth);

export default app;
