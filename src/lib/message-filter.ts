/**
 * Filtro Inteligente de Salvamento
 * Determina se uma mensagem deve ser salva permanentemente no banco de dados
 * ou se é apenas uma interação temporária que não merece persistência
 */

export class MessageFilter {
  // Lista de mensagens que não devem ser salvas (saudações curtas, irrelevantes)
  private static readonly UNSAVABLE_PATTERNS = [
    /^(oi|olá|e aí|e ai|eaí|ea|oi tudo bem|olá tudo bem|hey|hi|hello)$/i,
    /^(tudo bem|tudo bem\?|como vai|como está|como você está)$/i,
    /^(ok|ok\!|blz|beleza|certo|sim|não|nao)$/i,
    /^(vlw|valeu|obrigado|obrigada|thanks|thank you)$/i,
    /^(\s*|\.|\?|\!)$/, // Apenas pontuação ou espaços
    /^(ah|uhm|hmm|hum)$/i, // Sons de hesitação
  ];

  // Lista de palavras que indicam conteúdo relevante
  private static readonly RELEVANT_KEYWORDS = [
    'ajuda', 'dúvida', 'duvida', 'pergunta', 'explica', 'explicar',
    'como', 'por que', 'porque', 'quando', 'onde', 'qual', 'qual',
    'problema', 'erro', 'solução', 'solucao', 'implementar', 'criar',
    'código', 'codigo', 'programação', 'programacao', 'desenvolver',
    'análise', 'analise', 'projeto', 'ideia', 'sugestão', 'sugestao',
    'configurar', 'configuracao', 'configuração', 'instalar', 'deploy',
    'data', 'informação', 'informacao', 'documento', 'arquivo', 'texto',
    'qual', 'melhor', 'pior', 'diferença', 'comparar', 'vantagem',
    'risco', 'segurança', 'seguranca', 'performance', 'otimizar',
    'aprender', 'ensinar', 'explicar', 'mostrar', 'exemplo', 'tutorial',
    'passo', 'passos', 'guia', 'manual', 'documento', 'referência',
    'experiência', 'experiencia', 'história', 'historia', 'memória',
    'lembrar', 'gravar', 'salvar', 'armazenar', 'manter', 'guardar',
  ];

  /**
   * Verifica se a mensagem deve ser salva permanentemente
   * @param message Conteúdo da mensagem
   * @param role Papel (user ou assistant)
   * @returns true se deve salvar, false se deve ignorar
   */
  static shouldSave(message: string, role: 'user' | 'assistant'): boolean {
    // Mensagens do assistente sempre são salvas (respostas são úteis)
    if (role === 'assistant') {
      return this.isRelevantAssistantMessage(message);
    }

    // Verificar se é uma saudação irrelevante
    if (this.isUnsavableGreeting(message)) {
      return false;
    }

    // Verificar tamanho mínimo (menos de 3 caracteres não salva)
    if (message.trim().length < 3) {
      return false;
    }

    // Verificar se tem palavras-chave relevantes
    if (this.hasRelevantKeywords(message)) {
      return true;
    }

    // Se a mensagem for longa (mais de 30 caracteres), provavelmente é relevante
    if (message.trim().length > 30) {
      return true;
    }

    // Mensagens curtas sem palavras-chave não salvam
    return false;
  }

  /**
   * Verifica se é uma saudação que não deve ser salva
   */
  private static isUnsavableGreeting(message: string): boolean {
    const trimmed = message.trim();
    return this.UNSAVABLE_PATTERNS.some(pattern => pattern.test(trimmed));
  }

  /**
   * Verifica se a mensagem tem palavras-chave relevantes
   */
  private static hasRelevantKeywords(message: string): boolean {
    const lowerMessage = message.toLowerCase();
    return this.RELEVANT_KEYWORDS.some(keyword => 
      lowerMessage.includes(keyword)
    );
  }

  /**
   * Verifica se a mensagem do assistente é relevante
   * (respostas muito curtas ou genéricas não salvam)
   */
  private static isRelevantAssistantMessage(message: string): boolean {
    const trimmed = message.trim();
    
    // Respostas muito curtas (menos de 10 caracteres)
    if (trimmed.length < 10) {
      return false;
    }

    // Respostas genéricas que não valem salvar
    const genericResponses = [
      /^(ok|sim|não|nao|certo|entendido|com certeza|claro)$/i,
      /^(entendi|ok\!|blz|beleza|perfeito|ótimo|otimo)$/i,
    ];

    if (genericResponses.some(pattern => pattern.test(trimmed))) {
      return false;
    }

    return true;
  }

  /**
   * Retorna o motivo pelo qual a mensagem não deve ser salva (útil para logs)
   */
  static getSaveReason(message: string, role: 'user' | 'assistant'): string {
    if (role === 'assistant') {
      if (message.trim().length < 10) {
        return 'Resposta muito curta';
      }
      return 'Relevante';
    }

    if (this.isUnsavableGreeting(message)) {
      return 'Saudação irrelevante';
    }

    if (message.trim().length < 3) {
      return 'Mensagem muito curta';
    }

    if (this.hasRelevantKeywords(message)) {
      return 'Conteúdo relevante';
    }

    if (message.trim().length > 30) {
      return 'Mensagem longa';
    }

    return 'Mensagem curta sem conteúdo relevante';
  }
}