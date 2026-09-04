import { defineBackground } from 'wxt/sandbox';
import { redmineApi } from '@/services/api/redmine';

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
  });
});
