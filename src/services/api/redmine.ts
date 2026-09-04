import type { ValidationResult, RedmineUserResponse } from '@/types';

export const redmineApi = {
  /**
   * Valida as credenciais do Redmine fazendo um fetch para /users/current.json
   */
  async validateConnection(baseUrl: string, apiKey: string): Promise<ValidationResult> {
    try {
      const url = `${baseUrl.replace(/\/$/, '')}/users/current.json`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Redmine-API-Key': apiKey,
          'Content-Type': 'application/json',
        },
        credentials: 'omit'
      });

      if (response.ok) {
        const data = (await response.json()) as RedmineUserResponse;
        return { success: true, data: data.user };
      }

      if (response.status === 401) {
        return { success: false, message: 'Chave de API inválida.' };
      }

      return { success: false, message: `Erro HTTP: ${response.status}` };
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : String(error);
      return { success: false, message: `Falha na conexão: ${errMessage}` };
    }
  },

  /**
   * Busca as informações detalhadas de múltiplas issues no Redmine de uma só vez
   */
  async getIssues(baseUrl: string, apiKey: string, issueIds: number[]) {
    try {
      const url = `${baseUrl.replace(/\/$/, '')}/issues.json?issue_id=${issueIds.join(',')}&status_id=*&limit=100`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Redmine-API-Key': apiKey,
          'Content-Type': 'application/json',
        },
        credentials: 'omit' // Evitar prompts de basic auth
      });

      if (response.ok) {
        const data = await response.json();
        return { success: true, data: data.issues };
      }

      return { success: false, message: `Erro HTTP: ${response.status}` };
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : String(error);
      return { success: false, message: `Falha na requisição Fetch: ${errMessage}` };
    }
  },

  /**
   * Busca os memberships de projetos específicos e extrai os usuários
   */
  async getProjectMemberships(baseUrl: string, apiKey: string, projectIds: number[]): Promise<{ success: boolean, data: Record<string, string>, logs: string[] }> {
    const logs: string[] = [];
    const userMap: Record<string, string> = {};
    const MAX_CONCURRENT = 5;

    if (!projectIds || projectIds.length === 0) {
      return { success: true, data: {}, logs };
    }

    try {
      logs.push(`[INFO] Buscando memberships para ${projectIds.length} projetos únicos...`);
      
      const getJson = async (path: string) => {
        const res = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
          headers: { 'X-Redmine-API-Key': apiKey },
          credentials: 'omit'
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      };

      for (let i = 0; i < projectIds.length; i += MAX_CONCURRENT) {
        const batch = projectIds.slice(i, i + MAX_CONCURRENT);
        await Promise.all(batch.map(async (pid) => {
          try {
            const mRes = await getJson(`/projects/${pid}/memberships.json?limit=100`);
            if (mRes.memberships) {
              mRes.memberships.forEach((m: any) => {
                if (m.user) userMap[String(m.user.id)] = m.user.name;
              });
            }
          } catch (e) {
            // ignore
          }
        }));
      }

      logs.push(`[INFO] Memberships processados! ${Object.keys(userMap).length} usuários encontrados.`);
      return { success: true, data: userMap, logs };
    } catch (e) {
      logs.push(`[ERROR] Falha crítica ao buscar memberships: ${e}`);
      return { success: false, data: {}, logs };
    }
  }
};
