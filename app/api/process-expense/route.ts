import { NextRequest, NextResponse } from 'next/server';
// @ts-expect-error - pdf-parse has no TypeScript types
import pdfParse from 'pdf-parse';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

async function callGemini(prompt: string): Promise<string> {
  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${errorBody}`);
  }

  const json = await res.json();
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';
}

function buildPrompt(text: string): string {
  return `
Você é um assistente financeiro pessoal brasileiro. Analise o texto abaixo e extraia TODAS as despesas mencionadas.

Retorne SOMENTE um array JSON válido no seguinte formato, sem nenhum texto adicional:
[
  {
    "description": "Nome curto e claro da despesa",
    "amount": 0.00,
    "category": "Categoria (ex: Alimentação, Transporte, Lazer, Saúde, Mercado, Outros)",
    "is_shared": true ou false
  }
]

Regras:
- "amount" deve ser um número decimal (ex: 45.90)
- "is_shared" é true se a despesa for mencionada como dividida, compartilhada, meio a meio, etc.
- Se nenhuma despesa for encontrada, retorne um array vazio: []
- Não inclua explicações, apenas o JSON puro.

Texto para analisar:
"""
${text}
"""
`.trim();
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const textField = formData.get('text');
    const fileField = formData.get('file');

    let inputText = '';

    if (textField && typeof textField === 'string' && textField.trim().length > 0) {
      // Processamento de texto puro
      inputText = textField.trim();
    } else if (fileField && fileField instanceof Blob) {
      // Processamento de PDF
      const buffer = Buffer.from(await fileField.arrayBuffer());
      const parsed = await pdfParse(buffer);
      inputText = parsed.text;
    } else {
      return NextResponse.json({ success: false, error: 'Nenhum texto ou arquivo recebido.' }, { status: 400 });
    }

    if (!inputText || inputText.trim().length < 3) {
      return NextResponse.json({ success: false, error: 'O conteúdo enviado está vazio ou muito curto.' }, { status: 400 });
    }

    const prompt = buildPrompt(inputText);
    const rawResponse = await callGemini(prompt);

    let expenses;
    try {
      expenses = JSON.parse(rawResponse);
    } catch {
      // Tenta extrair JSON do texto caso o modelo tenha adicionado texto extra
      const match = rawResponse.match(/\[[\s\S]*\]/);
      if (match) {
        expenses = JSON.parse(match[0]);
      } else {
        throw new Error('A IA não retornou um JSON válido.');
      }
    }

    if (!Array.isArray(expenses)) {
      return NextResponse.json({ success: false, error: 'Formato inesperado da resposta da IA.' }, { status: 500 });
    }

    if (expenses.length === 0) {
      return NextResponse.json({ success: false, error: 'Nenhuma despesa foi encontrada no texto fornecido.' });
    }

    return NextResponse.json({ success: true, expenses });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno desconhecido.';
    console.error('[process-expense] Erro:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
