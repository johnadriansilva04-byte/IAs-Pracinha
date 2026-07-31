import { GoogleGenerativeAI } from '@google/generative-ai';

const GOOGLE_AI_KEY = process.env.GOOGLE_AI_API_KEY || '';
const genAI = new GoogleGenerativeAI(GOOGLE_AI_KEY);

export interface CompressedContext {
  facts: string[];
  timeline: Array<{ time: string; event: string }>;
  summary: string;
}

export class ContextCompressor {
  private async getModel() {
    return genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }

  async compressMessages(messages: Array<{ role: string; content: string }>): Promise<CompressedContext> {
    console.log('[COMPRESSOR] Iniciando compressão de', messages.length, 'mensagens');
    
    const prompt = `Analise estas mensagens e extraia:
1. FATOS IMPORTANTES: Informações cruciais que não podem ser esquecidas
2. LINHA DO TEMPO: Eventos em ordem cronológica
3. RESUMO: Síntese concisa da conversa

Mensagens:
${messages.map(m => `${m.role}: ${m.content}`).join('\n\n')}

Responda em formato JSON:
{
  "facts": ["fato1", "fato2"],
  "timeline": [{"time": "data/hora aproximada", "event": "descrição"}],
  "summary": "resumo conciso"
}`;

    try {
      const model = await this.getModel();
      console.log('[COMPRESSOR] Modelo obtido, enviando prompt...');
      const result = await model.generateContent(prompt);
      const response = await result.response.text();
      
      console.log('[COMPRESSOR] Resposta recebida, tamanho:', response.length);
      
      // Tentar extrair JSON da resposta
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log('[COMPRESSOR] JSON parseado com sucesso:', {
          facts: parsed.facts?.length || 0,
          timeline: parsed.timeline?.length || 0,
          summary_length: parsed.summary?.length || 0
        });
        return parsed;
      }
      
      console.warn('[COMPRESSOR] Não foi possível extrair JSON, usando fallback');
      // Fallback se não conseguir parsear JSON
      return {
        facts: [],
        timeline: [],
        summary: response.substring(0, 500)
      };
    } catch (error: any) {
      console.error('[COMPRESSOR] Erro ao comprimir contexto:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      return {
        facts: [],
        timeline: [],
        summary: messages.map(m => m.content).join(' ').substring(0, 500)
      };
    }
  }

  async reconstructContext(compressed: CompressedContext, recentMessages: Array<{ role: string; content: string }>): Promise<string> {
    const contextParts: string[] = [];

    if (compressed.facts.length > 0) {
      contextParts.push('FATOS IMPORTANTES:\n' + compressed.facts.join('\n'));
    }

    if (compressed.timeline.length > 0) {
      contextParts.push('LINHA DO TEMPO:\n' + compressed.timeline.map(t => `${t.time}: ${t.event}`).join('\n'));
    }

    if (compressed.summary) {
      contextParts.push('RESUMO ANTERIOR:\n' + compressed.summary);
    }

    if (recentMessages.length > 0) {
      contextParts.push('MENSAGENS RECENTES:\n' + recentMessages.map(m => `${m.role}: ${m.content}`).join('\n'));
    }

    return contextParts.join('\n\n');
  }

  estimateTokens(text: string): number {
    // Estimativa aproximada: 1 token ≈ 4 caracteres (para inglês) ou 2 caracteres (para português)
    return Math.ceil(text.length / 3);
  }

  shouldCompress(currentTokens: number, maxTokens: number = 100000): boolean {
    // Comprimir se estiver usando mais de 60% do limite
    return currentTokens > (maxTokens * 0.6);
  }
}