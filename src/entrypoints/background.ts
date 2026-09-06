import { defineBackground } from 'wxt/sandbox';
import { redmineApi } from '@/services/api/redmine';
import { gitlabApi } from '@/services/api/gitlab';
import { storageService } from '@/services/storage';

async function getMcpBaseUrl(overrideUrl?: string): Promise<string> {
  if (overrideUrl && overrideUrl.trim()) {
    return overrideUrl.trim().replace(/\/$/, '');
  }
  try {
    const config = await storageService.getConfig();
    if (config.mcpServerUrl && config.mcpServerUrl.trim()) {
      return config.mcpServerUrl.trim().replace(/\/$/, '');
    }
  } catch {}
  return 'http://127.0.0.1:47106';
}

export default defineBackground(() => {
  console.log('Hydra Review: Background Service Worker iniciado.');

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'FETCH_REDMINE_ISSUES') {
      const { url, apiKey, issueIds } = message.payload;
      
      // A chamada é feita aqui no Background, que possui host_permissions e ignora CORS
      redmineApi.getIssues(url, apiKey, issueIds)
        .then(result => sendResponse(result))
        .catch(err => {
          const errMessage = err instanceof Error ? err.message : String(err);
          sendResponse({ success: false, message: errMessage });
        });
        
      return true; // Indica que a resposta será assíncrona
    }

    if (message.type === 'FETCH_REDMINE_PROJECT_MEMBERSHIPS') {
      const { url, apiKey, projectIds } = message.payload;
      
      redmineApi.getProjectMemberships(url, apiKey, projectIds || [])
        .then(result => sendResponse(result))
        .catch(err => {
          sendResponse({ success: false, data: {}, logs: [`[ERROR] Falha crítica no background: ${err}`] });
        });
        
      return true;
    }

    if (message.type === 'FETCH_REDMINE_ISSUE_DETAILS') {
      const { url, apiKey, issueId } = message.payload;
      redmineApi.getIssueFullDetails(url, apiKey, Number(issueId))
        .then(result => sendResponse(result))
        .catch(err => {
          sendResponse({ success: false, message: String(err) });
        });
      return true;
    }

    if (message.type === 'FETCH_GITLAB_ISSUE_MRS') {
      const { url, token, issueId } = message.payload;
      gitlabApi.searchMRsByIssue(url, token, Number(issueId))
        .then(mrs => sendResponse({ success: true, mrs }))
        .catch(err => {
          sendResponse({ success: false, mrs: [], message: String(err) });
        });
      return true;
    }

    if (message.type === 'FETCH_GITLAB_MR_DIFF') {
      const { mrUrl, token } = message.payload;
      gitlabApi.getMRRawDiff(mrUrl, token)
        .then(diff => sendResponse({ success: Boolean(diff), diff }))
        .catch(err => {
          sendResponse({ success: false, diff: null, message: String(err) });
        });
      return true;
    }

    if (message.type === 'FETCH_REDMINE_PDF') {
      const { url, apiKey, issueId } = message.payload;
      const cleanBase = (url || 'http://redmine.atakone.com.br').replace(/\/$/, '');
      const hasKey = Boolean(apiKey && apiKey.trim());
      const pdfUrl = hasKey 
        ? `${cleanBase}/issues/${issueId}.pdf?key=${encodeURIComponent(apiKey.trim())}`
        : `${cleanBase}/issues/${issueId}.pdf`;

      const headers: Record<string, string> = {
        'Accept': 'application/pdf, application/octet-stream, */*',
      };
      if (hasKey) {
        headers['X-Redmine-API-Key'] = apiKey.trim();
      }

      fetch(pdfUrl, {
        method: 'GET',
        headers,
        credentials: 'include', // Utiliza a sessão ativa do Redmine no navegador!
      })
        .then(async (res) => {
          const contentType = res.headers.get('content-type') || '';
          
          // Se redirecionou para login ou retornou HTML, a sessão/key não autorizou o download
          if (res.url.includes('/login') || contentType.includes('text/html')) {
            sendResponse({ 
              success: false, 
              message: 'Não autenticado no Redmine (sessão ou API Key necessária).' 
            });
            return;
          }

          if (!res.ok) {
            sendResponse({ success: false, message: `Erro HTTP ${res.status}` });
            return;
          }

          const arrayBuffer = await res.arrayBuffer();
          if (arrayBuffer.byteLength === 0) {
            sendResponse({ success: false, message: 'Arquivo PDF vazio retornado pelo Redmine.' });
            return;
          }

          // Converte ArrayBuffer em Base64 de forma compatível com Service Worker (sem FileReader)
          const bytes = new Uint8Array(arrayBuffer);
          const chunkSize = 0x8000;
          let binary = '';
          for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, i + chunkSize);
            binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
          }
          const base64 = btoa(binary);
          const dataUrl = `data:application/pdf;base64,${base64}`;

          sendResponse({ success: true, dataUrl, size: arrayBuffer.byteLength });
        })
        .catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          sendResponse({ success: false, message: msg });
        });

      return true;
    }

    if (message.type === 'SYNC_TASK_TO_LOCAL_MCP') {
      getMcpBaseUrl(message.payload?.mcpServerUrl).then((baseUrl) => {
        fetch(`${baseUrl}/api/task`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(message.payload),
        })
          .then(async (res) => {
            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              sendResponse({ 
                success: false, 
                message: errData.error || `Erro HTTP ${res.status} ao salvar arquivos no servidor MCP (${baseUrl}).` 
              });
              return;
            }
            const data = await res.json();
            sendResponse({ success: true, data });
          })
          .catch((err) => {
            console.warn('[HydraReview] MCP bridge inacessível:', err);
            sendResponse({ 
              success: false, 
              message: `Servidor MCP inacessível em ${baseUrl}. Verifique se o servidor está rodando ou revise a URL nas configurações da extensão.` 
            });
          });
      });

      return true;
    }

    if (message.type === 'GET_MCP_STATUS') {
      getMcpBaseUrl(message.payload?.mcpServerUrl).then((baseUrl) => {
        fetch(`${baseUrl}/api/status`)
          .then(async (res) => {
            if (res.ok) {
              const data = await res.json();
              sendResponse({ success: true, data: { ...data, serverUrl: baseUrl } });
            } else {
              sendResponse({ success: false, data: { running: false, serverUrl: baseUrl } });
            }
          })
          .catch(() => {
            sendResponse({ success: false, data: { running: false, serverUrl: baseUrl } });
          });
      });

      return true;
    }

    if (message.type === 'CLEAR_MCP_CACHE') {
      getMcpBaseUrl(message.payload?.mcpServerUrl).then((baseUrl) => {
        fetch(`${baseUrl}/api/clear-cache`, { method: 'POST' })
          .then(async (res) => {
            if (res.ok) {
              const data = await res.json();
              sendResponse({ success: true, data });
            } else {
              sendResponse({ success: false, message: `Erro HTTP ${res.status}` });
            }
          })
          .catch(() => {
            sendResponse({ success: false, message: `Servidor MCP inacessível em ${baseUrl}.` });
          });
      });

      return true;
    }
  });
});
