/**
 * Utilitário para sugerir URLs baseadas no contexto atual (aba ativa) e no histórico do navegador.
 */

export const suggestionService = {
  getSuggestedUrls: async (): Promise<{ gitlabUrl?: string; redmineUrl?: string }> => {
    let gitlabUrl: string | undefined;
    let redmineUrl: string | undefined;

    const extractBaseUrl = (urlStr: string) => {
      try {
        const url = new URL(urlStr);
        return `${url.protocol}//${url.host}`;
      } catch {
        return null;
      }
    };

    // 1. Tenta pegar a aba ativa atual como prioridade máxima
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length > 0 && tabs[0].url) {
        const activeUrl = tabs[0].url;
        const base = extractBaseUrl(activeUrl);
        if (base) {
          if (activeUrl.toLowerCase().includes('gitlab')) gitlabUrl = base;
          if (activeUrl.toLowerCase().includes('redmine')) redmineUrl = base;
        }
      }
    } catch (e) {
      console.warn("Falha ao ler abas ativas", e);
    }

    // 2. Tenta preencher com o histórico do navegador para o que ainda estiver vazio
    if (!gitlabUrl || !redmineUrl) {
      try {
        const searchHistory = async (query: string) => {
          const results = await chrome.history.search({
            text: query,
            startTime: Date.now() - 30 * 24 * 60 * 60 * 1000, // Últimos 30 dias
            maxResults: 50,
          });

          // Conta frequências dos domínios para sugerir o mais acessado
          const domainCounts: Record<string, number> = {};
          
          for (const item of results) {
            if (!item.url) continue;
            const base = extractBaseUrl(item.url);
            if (base) {
              domainCounts[base] = (domainCounts[base] || 0) + (item.visitCount || 1);
            }
          }

          // Ordena pelo domínio mais visitado
          const sortedDomains = Object.entries(domainCounts).sort((a, b) => b[1] - a[1]);
          return sortedDomains.length > 0 ? sortedDomains[0][0] : undefined;
        };

        if (!gitlabUrl) gitlabUrl = await searchHistory('gitlab');
        if (!redmineUrl) redmineUrl = await searchHistory('redmine');
      } catch (e) {
        console.warn("Falha ao ler histórico (permissão não concedida ou erro)", e);
      }
    }

    return { gitlabUrl, redmineUrl };
  }
};
