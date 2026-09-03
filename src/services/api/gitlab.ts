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
  }
};
