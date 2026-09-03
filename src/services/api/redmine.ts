import type { ValidationResult, RedmineUserResponse } from '@/types';

export const redmineApi = {
  /**
   * Valida as credenciais do Redmine fazendo um fetch para /users/current.json
   */
  validateConnection: async (url: string, apiKey: string): Promise<ValidationResult<RedmineUserResponse['user']>> => {
    if (!url || !apiKey) {
      return { success: false, message: 'URL e API Key são obrigatórios.' };
    }

    try {
      // Remove trailing slash se houver
      const baseUrl = url.replace(/\/$/, '');
      const response = await fetch(`${baseUrl}/users/current.json`, {
        method: 'GET',
        credentials: 'omit',
        headers: {
          'X-Redmine-API-Key': apiKey,
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          return { success: false, message: 'API Key do Redmine inválida.' };
        }
        return { success: false, message: `Erro HTTP Redmine: ${response.status}` };
      }

      const data: RedmineUserResponse = await response.json();
      if (data && data.user) {
        return { success: true, data: data.user };
      }

      return { success: false, message: 'Formato de resposta inesperado.' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      let details = errorMessage;
      if (errorMessage.includes('Failed to fetch')) {
        details = 'Failed to fetch (Falha de rede). Certifique-se de que a URL possui o protocolo correto (http/https) e que o servidor aceita conexões.';
      }
      return { success: false, message: `Falha de conexão com Redmine: ${details}` };
    }
  }
};
