import { defineContentScript } from 'wxt/sandbox';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { storageService } from '@/services/storage';
import { redmineApi } from '@/services/api/redmine';
import { IssuePopover } from '@/components/redmine/IssuePopover';
import { loggerService } from '@/services/logger';
import type { RedmineIssue, MRBranchInfo } from '@/types';

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
        const issueBranchesMap = new Map<number, Set<string>>();
        const issueMRDetailsMap = new Map<number, Map<string, MRBranchInfo>>();

        // Varrer todos os MRs (inclusive os já processados) para ter a visão completa das branches abertas na tela
        titleNodes.forEach((node) => {
          const text = node.textContent || '';
          let match;

          // No GitLab, a branch alvo só aparece explícita com o ícone de branch quando NÃO é a branch padrão (develop).
          // Ou seja: se tem o ícone de branch mostrando "release" ou "master", é ela. Se não tiver nada, é "develop"!
          const row = node.closest('li.issuable-row, li.merge-request, .issuable-info-container') || node.closest('.issuable-main-info')?.parentElement;
          let targetBranch = 'develop'; // DEFAULT!
          let mrUrl = '';
          let mrIid = '';
          let diffsUrl = '';
          let filesCount = '';
          let addedLines = '';
          let deletedLines = '';

          let projectPath = '';
          if (row) {
            const rowText = row.textContent || '';
            // Verifica se tem ícone ou menção explícita de master ou release
            if (/\bmaster\b/i.test(rowText) || /\bmain\b/i.test(rowText)) {
              targetBranch = 'master';
            } else if (/\brelease\b/i.test(rowText)) {
              targetBranch = 'release';
            } else if (/\bdevelop\b/i.test(rowText)) {
              targetBranch = 'develop';
            }

            // URL do MR e URL dos Diffs
            const mrLink = (node as HTMLAnchorElement).href || row.querySelector('.merge-request-title-text a, .issuable-title a')?.getAttribute('href') || '';
            if (mrLink) {
              const cleanUrl = mrLink.startsWith('http') ? mrLink : `${window.location.origin}${mrLink}`;
              mrUrl = cleanUrl;
              diffsUrl = cleanUrl.endsWith('/diffs') ? cleanUrl : `${cleanUrl.replace(/\/$/, '')}/diffs`;
              
              const matchMR = cleanUrl.match(/(?:https?:\/\/[^/]+)\/(.+?)\/-\/merge_requests\/(\d+)/);
              if (matchMR) {
                projectPath = matchMR[1];
                mrIid = matchMR[2];
              } else {
                const iidMatch = cleanUrl.match(/\/merge_requests\/(\d+)/);
                if (iidMatch) {
                  mrIid = iidMatch[1];
                }
              }
            }

            // Extrair métricas de diff do GitLab (se disponível no DOM)
            const filesEl = row.querySelector('[data-testid="files-changed"], .files-changed, .diff-stats, .issuable-mr-metrics');
            if (filesEl) {
              const filesText = filesEl.textContent || '';
              const fMatch = filesText.match(/(\d+)\s*(?:files|arquivos)?/i);
              if (fMatch) filesCount = fMatch[1];

              const addMatch = filesText.match(/\+(\d+)/);
              if (addMatch) addedLines = `+${addMatch[1]}`;

              const delMatch = filesText.match(/-(\d+)/);
              if (delMatch) deletedLines = `-${delMatch[1]}`;
            } else {
              const fMatch = rowText.match(/(\d+)\s+files?/i);
              if (fMatch) filesCount = fMatch[1];
              const addMatch = rowText.match(/\+(\d+)/);
              if (addMatch) addedLines = `+${addMatch[1]}`;
              const delMatch = rowText.match(/-(\d+)/);
              if (delMatch) deletedLines = `-${delMatch[1]}`;
            }
          }

          while ((match = issueRegex.exec(text)) !== null) {
            const id = parseInt(match[1], 10);
            issueIds.add(id);
            
            if (!domMap.has(id)) {
              domMap.set(id, []);
            }
            // Só adiciona aos nós que precisam de injeção se for nó novo não processado
            if (unprocessedNodes.includes(node)) {
              domMap.get(id)?.push(node);
            }

            if (targetBranch) {
              if (!issueBranchesMap.has(id)) {
                issueBranchesMap.set(id, new Set<string>());
              }
              issueBranchesMap.get(id)?.add(targetBranch);

              if (!issueMRDetailsMap.has(id)) {
                issueMRDetailsMap.set(id, new Map<string, MRBranchInfo>());
              }
              issueMRDetailsMap.get(id)?.set(targetBranch, {
                branch: targetBranch,
                projectPath,
                mrIid,
                mrUrl,
                diffsUrl,
                filesCount,
                addedLines,
                deletedLines
              });
            }
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
              let badgesContainer = container?.querySelector<HTMLElement>('.hydra-review-badges-container');
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
        issues.forEach((issue: RedmineIssue) => {
          const targetNodes = domMap.get(issue.id);
          if (!targetNodes) return;

          targetNodes.forEach((node) => {
            const container = node.closest('.issuable-main-info') || node.parentElement;
            const badgesContainer = container?.querySelector('.hydra-review-badges-container');
            if (!badgesContainer) return;

            const hostElement = badgesContainer.querySelector(`.hydra-review-injected[data-issue-id="${issue.id}"]`) as any;
            const detectedBranches = Array.from(issueBranchesMap.get(issue.id) || []);
            const branchDetails = Array.from(issueMRDetailsMap.get(issue.id)?.values() || []);
            if (hostElement && hostElement._reactRoot) {
              const reactRoot = hostElement.shadowRoot?.querySelector('div') || undefined;
              hostElement._reactRoot.render(
                <IssuePopover 
                  issue={issue} 
                  container={reactRoot} 
                  usersMap={usersMap} 
                  targetBranches={detectedBranches} 
                  branchDetails={branchDetails} 
                  gitlabUrl={config.gitlabUrl || window.location.origin}
                  gitlabToken={config.gitlabToken || ''}
                  redmineUrl={config.redmineUrl}
                  redmineApiKey={config.redmineApiKey}
                />
              );
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
    setTimeout(processPage, 200); // Aguarda um breve momento para garantir que a DOM do GitLab renderizou
  },
});
