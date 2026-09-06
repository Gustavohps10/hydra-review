import type { ValidationResult, GitLabUserResponse } from '@/types';

export const gitlabApi = {
  /**
   * Valida as credenciais do GitLab fazendo um fetch para /api/v4/user
   */
  validateConnection: async (url: string, token: string): Promise<ValidationResult<GitLabUserResponse>> => {
    if (!url || !token) {
      return { success: false, message: 'URL e Token são obrigatórios.' };
    }

    try {
      // Remove trailing slash se houver
      const baseUrl = url.replace(/\/$/, '');
      const response = await fetch(`${baseUrl}/api/v4/user`, {
        method: 'GET',
        credentials: 'omit',
        headers: {
          'PRIVATE-TOKEN': token,
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          return { success: false, message: 'Token do GitLab inválido.' };
        }
        return { success: false, message: `Erro HTTP GitLab: ${response.status}` };
      }

      const data: GitLabUserResponse = await response.json();
      if (data && data.username) {
        return { success: true, data };
      }

      return { success: false, message: 'Formato de resposta inesperado.' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      let details = errorMessage;
      if (errorMessage.includes('Failed to fetch')) {
        details = 'Failed to fetch (Falha de rede). Certifique-se de que a URL possui o protocolo correto (http/https) e que o servidor aceita conexões.';
      }
      return { success: false, message: `Falha de conexão com GitLab: ${details}` };
    }
  },

  /**
   * Obtém as métricas de diff (arquivos alterados, adições e deleções) de um Merge Request em 1 request.
   * Tenta primeiro via diffs_metadata.json (o mesmo endpoint interno usado pela UI do GitLab no navegador,
   * que garante números 100% idênticos ao GitLab mesmo com +2000 diffs ou paginação).
   * Se falhar, faz fallback para a API REST oficial (/changes).
   * Utiliza cache em memória para evitar chamadas duplicadas.
   */
  getMRDiffStats: async (
    url: string,
    token: string,
    projectPath: string,
    mrIid: string,
    mrUrl?: string
  ): Promise<{ filesCount: string; addedLines: string; deletedLines: string } | null> => {
    if ((!url && !mrUrl) || !projectPath || !mrIid) {
      return null;
    }

    const cacheKey = `${projectPath}:${mrIid}`;
    if (mrDiffCache.has(cacheKey)) {
      return mrDiffCache.get(cacheKey)!;
    }

    const baseUrl = (url || (typeof window !== 'undefined' ? window.location?.origin : '') || '').replace(/\/$/, '');

    // 1. Tentar primeiro via diffs_metadata.json (com os cookies da sessão ativa do GitLab no navegador)
    try {
      const cleanMrUrl = mrUrl ? mrUrl.replace(/\/diffs$/, '').replace(/\/$/, '') : `${baseUrl}/${projectPath}/-/merge_requests/${mrIid}`;
      const metadataUrl = `${cleanMrUrl}/diffs_metadata.json`;

      const metaRes = await fetch(metadataUrl, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json',
          ...(token ? { 'PRIVATE-TOKEN': token } : {})
        },
      });

      if (metaRes.ok) {
        const metaContentType = metaRes.headers.get('content-type') || '';
        if (metaContentType.includes('application/json')) {
          const metaData = await metaRes.json();
          if (metaData && (metaData.diff_files || metaData.real_size)) {
            let added = 0;
            let deleted = 0;
            const files = Array.isArray(metaData.diff_files) ? metaData.diff_files : [];
            for (const file of files) {
              if (typeof file.added_lines === 'number') added += file.added_lines;
              if (typeof file.removed_lines === 'number') deleted += file.removed_lines;
            }

            const filesCount = String(metaData.real_size || files.length);
            const result = {
              filesCount,
              addedLines: `+${added}`,
              deletedLines: `-${deleted}`,
            };

            mrDiffCache.set(cacheKey, result);
            return result;
          }
        }
      }
    } catch (err) {
      console.warn('[HydraReview] diffs_metadata.json falhou, usando fallback REST API:', err);
    }

    // 2. Fallback: REST API oficial (/changes)
    try {
      const encodedPath = encodeURIComponent(projectPath);
      const response = await fetch(`${baseUrl}/api/v4/projects/${encodedPath}/merge_requests/${mrIid}/changes`, {
        method: 'GET',
        headers: {
          ...(token ? { 'PRIVATE-TOKEN': token } : {}),
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const filesCount = String(data.changes_count || (Array.isArray(data.changes) ? data.changes.length : 0));

      let added = 0;
      let deleted = 0;

      if (Array.isArray(data.changes)) {
        for (const change of data.changes) {
          if (change.diff && typeof change.diff === 'string') {
            const lines = change.diff.split('\n');
            for (const line of lines) {
              if (line.startsWith('+') && !line.startsWith('+++')) {
                added++;
              } else if (line.startsWith('-') && !line.startsWith('---')) {
                deleted++;
              }
            }
          }
        }
      }

      const result = {
        filesCount,
        addedLines: `+${added}`,
        deletedLines: `-${deleted}`,
      };

      mrDiffCache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.warn('Erro ao obter métricas de diff do MR:', error);
      return null;
    }
  },

  /**
   * Baixa o diff unificado completo de um Merge Request.
   * Prioriza as rotas de diff bruto nativas do Git/GitLab (.diff e /raw_diffs) para garantir
   * que nenhum arquivo grande seja colapsado ou truncado (como ocorre na API /changes).
   */
  getMRRawDiff: async (mrUrl: string, token?: string): Promise<string | null> => {
    try {
      // 1. Rota .diff nativa do GitLab (retorna o diff completo do Git/Gitaly, idêntico ao download no navegador)
      const cleanUrl = mrUrl.replace(/\/diffs\/?$/, '').replace(/\/$/, '');
      const diffUrl = `${cleanUrl}.diff`;
      const diffHeaders: Record<string, string> = {
        'Accept': 'text/plain, */*',
      };
      if (token) {
        diffHeaders['PRIVATE-TOKEN'] = token;
      }

      try {
        const response = await fetch(diffUrl, {
          method: 'GET',
          headers: diffHeaders,
          credentials: 'include',
        });

        if (response.ok) {
          const contentType = response.headers.get('content-type') || '';
          if (!contentType.includes('text/html')) {
            const text = await response.text();
            if (text && !text.trim().startsWith('<!DOCTYPE') && !text.trim().startsWith('<html')) {
              return text;
            }
          }
        }
      } catch (err) {
        console.warn('[HydraReview] Falha ao obter diff via .diff, tentando raw_diffs:', err);
      }

      // 2. Rota oficial /raw_diffs da REST API v4 do GitLab
      const match = mrUrl.match(/(?:https?:\/\/[^/]+)\/(.+?)\/-\/merge_requests\/(\d+)/);
      if (match) {
        const projectPath = match[1];
        const mrIid = match[2];
        const baseUrl = mrUrl.split('/-/')[0].split('/').slice(0, 3).join('/');
        const encodedPath = encodeURIComponent(projectPath);
        const rawDiffsUrl = `${baseUrl}/api/v4/projects/${encodedPath}/merge_requests/${mrIid}/raw_diffs`;

        const apiHeaders: Record<string, string> = {
          'Accept': 'text/plain, */*',
        };
        if (token) {
          apiHeaders['PRIVATE-TOKEN'] = token;
        }

        try {
          const res = await fetch(rawDiffsUrl, {
            method: 'GET',
            headers: apiHeaders,
            credentials: 'include',
          });

          if (res.ok) {
            const contentType = res.headers.get('content-type') || '';
            if (!contentType.includes('text/html')) {
              const text = await res.text();
              if (text && !text.trim().startsWith('<!DOCTYPE') && !text.trim().startsWith('<html')) {
                return text;
              }
            }
          }
        } catch (err) {
          console.warn('[HydraReview] Falha ao obter diff via raw_diffs, tentando /changes como fallback:', err);
        }

        // 3. Fallback: REST API oficial /changes (caso endpoints brutos estejam inacessíveis)
        try {
          const apiUrl = `${baseUrl}/api/v4/projects/${encodedPath}/merge_requests/${mrIid}/changes`;
          const changesHeaders: Record<string, string> = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          };
          if (token) {
            changesHeaders['PRIVATE-TOKEN'] = token;
          }

          const res = await fetch(apiUrl, {
            method: 'GET',
            headers: changesHeaders,
            credentials: 'include',
          });

          if (res.ok) {
            const data = await res.json();
            if (data && Array.isArray(data.changes) && data.changes.length > 0) {
              let fullDiff = '';
              for (const c of data.changes) {
                fullDiff += `diff --git a/${c.old_path} b/${c.new_path}\n`;
                if (c.new_file) fullDiff += `new file mode 100644\n`;
                if (c.deleted_file) fullDiff += `deleted file mode 100644\n`;
                fullDiff += `--- a/${c.old_path}\n+++ b/${c.new_path}\n`;
                if (c.diff) {
                  fullDiff += c.diff + '\n\n';
                } else if (c.collapsed || c.too_large) {
                  fullDiff += `@@ -0,0 +0,0 @@ [Diff colapsado pelo GitLab]\n\n`;
                } else {
                  fullDiff += '\n';
                }
              }
              return fullDiff.trim();
            }
          }
        } catch (err) {
          console.warn('[HydraReview] Falha no fallback /changes:', err);
        }
      }

      return null;
    } catch (error) {
      console.warn('[HydraReview] Erro inesperado ao obter diff do MR:', error);
      return null;
    }
  },

  /**
   * Busca todos os Merge Requests vinculados ao ID da tarefa em todos os repositórios do GitLab
   */
  searchMRsByIssue: async (baseUrl: string, token: string, issueId: number): Promise<any[]> => {
    try {
      const cleanUrl = (baseUrl || 'http://gitlab2.atakone.com.br').replace(/\/$/, '');
      const url = `${cleanUrl}/api/v4/merge_requests?search=${issueId}&scope=all&per_page=50`;
      const headers: Record<string, string> = { 'Accept': 'application/json' };
      if (token) {
        headers['PRIVATE-TOKEN'] = token;
      }

      const res = await fetch(url, {
        method: 'GET',
        headers,
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      }
      return [];
    } catch {
      return [];
    }
  },
};

const mrDiffCache = new Map<string, { filesCount: string; addedLines: string; deletedLines: string }>();
