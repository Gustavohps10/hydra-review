import { defineContentScript } from 'wxt/sandbox';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { storageService } from '@/services/storage';
import { redmineApi } from '@/services/api/redmine';
import { IssuePopover } from '@/components/redmine/IssuePopover';
import { loggerService } from '@/services/logger';
import type { RedmineIssue } from '@/types';

export default defineContentScript({
  matches: ['*://gitlab.com/*', '*://gitlab2.atakone.com.br/*'],
  
  async main() {
    await loggerService.addLog('info', 'GitLab', 'Content Script Injetado e Aguardando.');

    let isProcessing = false;

    async function processPage() {
      if (isProcessing) return;
      isProcessing = true;
      try {
        // 1. Carregar credenciais do storage
        const config = await storageService.getConfig();
        if (!config.redmineUrl || !config.redmineApiKey) {
          isProcessing = false;
          return; // Silencioso se não configurado
        }

        // 2. Localizar todos os títulos de MR na tela
        const titleNodes = document.querySelectorAll('.merge-request-title-text a, .merge-request-title a, .issue-title-text a');
        
        // Filtra nós que já foram processados
        const unprocessedNodes = Array.from(titleNodes).filter(node => {
          const container = node.closest('.issuable-main-info') || node.parentElement;
          return !container?.querySelector('.hydra-review-badges-container');
        });

        if (unprocessedNodes.length === 0) {
          isProcessing = false;
          return;
        }

        await loggerService.addLog('info', 'GitLab', `Encontrados ${unprocessedNodes.length} novos nós de MR não processados.`);

        const issueRegex = /(?:^|\b|#)(\d{4,6})\b/g;
        const domMap = new Map<number, Element[]>();
        const issueIds = new Set<number>();

        unprocessedNodes.forEach((node) => {
          const text = node.textContent || '';
          let match;

          while ((match = issueRegex.exec(text)) !== null) {
            const id = parseInt(match[1], 10);
            issueIds.add(id);
            
            if (!domMap.has(id)) {
              domMap.set(id, []);
            }
            domMap.get(id)?.push(node);
          }
        });

        if (issueIds.size === 0) {
          await loggerService.addLog('warn', 'GitLab', 'Nenhum ID de tarefa válido extraído (4 a 6 dígitos).');
          isProcessing = false;
          return;
        }

        await loggerService.addLog('info', 'GitLab', `Buscando ${issueIds.size} tarefas no Redmine: ${Array.from(issueIds).join(', ')}`);

        // 3.5. Injetar UI de Skeleton temporário (Carregando...)
        import('@/components/redmine/IssuePopover').then(({ SkeletonBadge }) => {
          issueIds.forEach((id) => {
            const targetNodes = domMap.get(id);
            if (!targetNodes) return;
  
            targetNodes.forEach((node) => {
              const container = node.closest('.issuable-main-info') || node.parentElement;
              let badgesContainer = container?.querySelector('.hydra-review-badges-container');
              if (!badgesContainer) {
                badgesContainer = document.createElement('div');
                badgesContainer.className = 'hydra-review-badges-container';
                badgesContainer.style.display = 'flex';
                badgesContainer.style.gap = '6px';
                badgesContainer.style.marginTop = '6px';
                container?.appendChild(badgesContainer);
              }
  
              if (badgesContainer.querySelector(`.hydra-review-injected[data-issue-id="${id}"]`)) return;
  
              const hostElement = document.createElement('div');
              hostElement.className = 'hydra-review-injected';
              hostElement.dataset.issueId = String(id);
              hostElement.style.display = 'contents';
              
              badgesContainer.appendChild(hostElement);
              const shadowRoot = hostElement.attachShadow({ mode: 'open' });
              
              import('@/assets/globals.css?inline').then((css) => {
                const style = document.createElement('style');
                style.textContent = css.default.replace(/:root/g, ':host');
                shadowRoot.appendChild(style);
  
                const reactRoot = document.createElement('div');
                const isDark = document.documentElement.classList.contains('gl-dark') 
                            || document.body.classList.contains('gl-dark')
                            || document.body.dataset.theme === 'dark';
                            
                reactRoot.className = isDark ? 'dark' : ''; 
                reactRoot.style.display = 'contents';
                shadowRoot.appendChild(reactRoot);
  
                const root = createRoot(reactRoot);
                root.render(<SkeletonBadge />);
                
                // Salvar a referência do root para dar update depois
                (hostElement as any)._reactRoot = root;
              });
            });
          });
        });

        // 4. Buscar detalhes das tarefas
        const issuesResult = await new Promise<any>((resolve) => {
          chrome.runtime.sendMessage(
            { 
              type: 'FETCH_REDMINE_ISSUES', 
              payload: { url: config.redmineUrl, apiKey: config.redmineApiKey, issueIds: Array.from(issueIds) } 
            }, 
            (response) => {
              if (chrome.runtime.lastError) {
                const errMsg = chrome.runtime.lastError.message || 'Erro desconhecido';
                resolve({ success: false, message: errMsg });
              } else {
                resolve(response);
              }
            }
          );
        });

        if (!issuesResult.success || !issuesResult.data) {
          await loggerService.addLog('error', 'GitLab', `Falha ao buscar dados: ${issuesResult.message}`);
          isProcessing = false;
          return;
        }

        const issues = issuesResult.data;
        
        // 5. Pegar IDs de projetos únicos dessas issues e buscar memberships (MUITO EFICIENTE)
        const projectIds = Array.from(new Set(issues.filter((i: any) => i.project?.id).map((i: any) => i.project.id)));
        
        let usersMap: Record<string, string> = {};
        
        if (projectIds.length > 0) {
          const usersResult = await new Promise<any>((resolve) => {
            chrome.runtime.sendMessage(
              { 
                type: 'FETCH_REDMINE_PROJECT_MEMBERSHIPS', 
                payload: { url: config.redmineUrl, apiKey: config.redmineApiKey, projectIds } 
              }, 
              (response) => {
                if (chrome.runtime.lastError) {
                  resolve({ success: false, data: {}, logs: [`[ERROR] ${chrome.runtime.lastError.message}`] });
                } else {
                  resolve(response);
                }
              }
            );
          });
          
          if (usersResult?.logs) {
            for (const log of usersResult.logs) {
              const level = log.startsWith('[ERROR]') ? 'error' : 'info';
              await loggerService.addLog(level, 'Redmine', log);
            }
          }
          
          usersMap = usersResult?.data || {};
        }

        await loggerService.addLog('info', 'GitLab', `Sucesso! Mapeadas ${issues.length} tarefas. ${projectIds.length} projetos únicos trouxeram ${Object.keys(usersMap).length} desenvolvedores.`);

        // 5. Injetar a UI atualizada (substituindo o skeleton)
        issues.forEach((issue) => {
          const targetNodes = domMap.get(issue.id);
          if (!targetNodes) return;

          targetNodes.forEach((node) => {
            const container = node.closest('.issuable-main-info') || node.parentElement;
            const badgesContainer = container?.querySelector('.hydra-review-badges-container');
            if (!badgesContainer) return;

            const hostElement = badgesContainer.querySelector(`.hydra-review-injected[data-issue-id="${issue.id}"]`) as any;
            if (hostElement && hostElement._reactRoot) {
              const reactRoot = hostElement.shadowRoot.querySelector('div');
              hostElement._reactRoot.render(<IssuePopover issue={issue} container={reactRoot} usersMap={usersMap} />);
            }

            // Injetar Prioridade (Esquerda) e Status (Direita) do título
            import('@/components/redmine/IssuePopover').then(({ PriorityBadge, StatusBadge }) => {
              if (!node.previousElementSibling?.classList.contains('hydra-priority-badge')) {
                const priorityHost = document.createElement('span');
                priorityHost.className = 'hydra-priority-badge';
                priorityHost.style.display = 'inline-block';
                node.insertAdjacentElement('beforebegin', priorityHost);
                const shadow = priorityHost.attachShadow({ mode: 'open' });
                import('@/assets/globals.css?inline').then((css) => {
                  const style = document.createElement('style');
                  style.textContent = css.default.replace(/:root/g, ':host');
                  shadow.appendChild(style);
                  const reactRoot = document.createElement('span');
                  reactRoot.className = document.documentElement.classList.contains('gl-dark') ? 'dark' : '';
                  shadow.appendChild(reactRoot);
                  createRoot(reactRoot).render(<PriorityBadge issue={issue} />);
                });
              }
              
              if (!node.nextElementSibling?.classList.contains('hydra-status-badge')) {
                const statusHost = document.createElement('span');
                statusHost.className = 'hydra-status-badge';
                statusHost.style.display = 'inline-block';
                node.insertAdjacentElement('afterend', statusHost);
                const shadow = statusHost.attachShadow({ mode: 'open' });
                import('@/assets/globals.css?inline').then((css) => {
                  const style = document.createElement('style');
                  style.textContent = css.default.replace(/:root/g, ':host');
                  shadow.appendChild(style);
                  const reactRoot = document.createElement('span');
                  reactRoot.className = document.documentElement.classList.contains('gl-dark') ? 'dark' : '';
                  shadow.appendChild(reactRoot);
                  createRoot(reactRoot).render(<StatusBadge issue={issue} />);
                });
              }
            });
          });
        });

        // 6. Injetar UI de Erro (403/Não encontrado) para as tarefas que não vieram
        const foundIds = new Set(issues.map((i: any) => i.id));
        const missingIds = Array.from(issueIds).filter(id => !foundIds.has(id));

        if (missingIds.length > 0) {
          await loggerService.addLog('warn', 'GitLab', `${missingIds.length} tarefas não foram retornadas pelo Redmine (Possível 403 / Sem acesso). IDs: ${missingIds.join(', ')}`);
          
          import('@/components/redmine/IssuePopover').then(({ ErrorBadge }) => {
            missingIds.forEach((id) => {
              const targetNodes = domMap.get(id);
              if (!targetNodes) return;
    
              targetNodes.forEach((node) => {
                const container = node.closest('.issuable-main-info') || node.parentElement;
                const badgesContainer = container?.querySelector('.hydra-review-badges-container');
                if (!badgesContainer) return;
    
                const hostElement = badgesContainer.querySelector(`.hydra-review-injected[data-issue-id="${id}"]`) as any;
                if (hostElement && hostElement._reactRoot) {
                  hostElement._reactRoot.render(<ErrorBadge />);
                }
              });
            });
          });
        }

      } catch (err) {
        await loggerService.addLog('error', 'GitLab', `Erro genérico: ${err}`);
      } finally {
        isProcessing = false;
      }
    }

    // Executa a primeira vez ao carregar a página
    setTimeout(processPage, 1000); // Aguarda um breve momento para garantir que a DOM do GitLab renderizou
  },
});
