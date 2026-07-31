// Sistema de antiloop para prevenir múltiplas requisições simultâneas
const pendingRequests = new Map<string, Promise<any>>();
const REQUEST_TIMEOUT = 30000; // 30 segundos

export async function withAntiloop<T>(
  key: string,
  fn: () => Promise<T>
): Promise<T> {
  // Verificar se já existe uma requisição pendente com a mesma chave
  if (pendingRequests.has(key)) {
    console.log(`[ANTILOOP] Requisição duplicada detectada: ${key}`);
    throw new Error('Operação já em andamento. Aguarde a conclusão.');
  }

  try {
    const promise = fn();
    pendingRequests.set(key, promise);

    // Adicionar timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        pendingRequests.delete(key);
        reject(new Error('Tempo limite da operação excedido'));
      }, REQUEST_TIMEOUT);
    });

    // Race entre a promise e o timeout
    const result = await Promise.race([promise, timeoutPromise]);
    return result;
  } finally {
    pendingRequests.delete(key);
  }
}

// Gerar chave única para antiloop baseada nos parâmetros
export function generateAntiLoopKey(prefix: string, params: Record<string, any>): string {
  const paramString = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join('&');
  return `${prefix}:${paramString}`;
}

// Limpar requisições pendentes (útil para cleanup)
export function clearPendingRequests() {
  pendingRequests.clear();
}