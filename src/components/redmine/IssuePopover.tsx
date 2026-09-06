import React from 'react';
import type { RedmineIssue, MRBranchInfo } from '@/types';
import { getPriorityConfig, getStatusConfig, getTrackerConfig } from '@/utils/redmine-metadata';
import { buildTaskMarkdown } from '@/utils/redmine-markdown';
import { gitlabApi } from '@/services/api/gitlab';
import { 
  Users, 
  Clock, 
  AlertCircle, 
  User, 
  ShieldAlert, 
  Bookmark, 
  CheckCircle2, 
  AlertTriangle, 
  Minus, 
  GitBranch, 
  FileCode, 
  Check, 
  Loader2,
  ChevronRight,
  SlidersHorizontal,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ClaudePresetsDialog } from './ClaudePresetsDialog';
import { storageService } from '@/services/storage';
import type { ClaudePromptPreset } from '@/types';
import {
  interpolatePromptTemplate,
  DEFAULT_CLAUDE_PRESETS,
  type PromptTemplateVariables,
} from '@/utils/prompt-template';

export function SkeletonBadge() {
  return (
    <div className="inline-flex items-center gap-1.5 animate-pulse">
      <div className="w-5 h-5 rounded-sm bg-muted ring-1 ring-inset ring-black/5 dark:ring-white/5" />
      <div className="h-4 w-16 bg-muted rounded-sm" />
    </div>
  );
}

export function ErrorBadge() {
  return (
    <div className="inline-flex items-center gap-1.5 opacity-80 hover:opacity-100 transition-opacity">
      <div className="relative inline-flex items-center justify-center w-5 h-5 rounded-sm">
        <img 
          src="https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/redmine.svg" 
          alt="Redmine" 
          className="w-3 h-3 grayscale opacity-70"
        />
      </div>
      <span className="text-[11px] font-bold uppercase tracking-wider text-red-500 flex items-center gap-1">
        <ShieldAlert className="w-3.5 h-3.5" />
        Sem Acesso (403)
      </span>
    </div>
  );
}

function BranchDiffSummary({
  mrInfo,
  gitlabUrl,
  gitlabToken,
}: {
  mrInfo: MRBranchInfo;
  gitlabUrl?: string;
  gitlabToken?: string;
}) {
  const [stats, setStats] = React.useState<{
    filesCount?: string;
    addedLines?: string;
    deletedLines?: string;
  } | null>(() => {
    if (mrInfo.filesCount && mrInfo.addedLines) {
      return {
        filesCount: mrInfo.filesCount,
        addedLines: mrInfo.addedLines,
        deletedLines: mrInfo.deletedLines,
      };
    }
    return null;
  });

  React.useEffect(() => {
    if (stats?.filesCount) return;

    if (mrInfo.projectPath && mrInfo.mrIid) {
      const gUrl = gitlabUrl || window.location.origin;
      const gToken = gitlabToken || '';
      gitlabApi.getMRDiffStats(gUrl, gToken, mrInfo.projectPath, mrInfo.mrIid, mrInfo.mrUrl).then((res) => {
        if (res) {
          setStats(res);
        }
      });
    }
  }, [mrInfo.projectPath, mrInfo.mrIid, mrInfo.mrUrl, gitlabUrl, gitlabToken]);

  const href = mrInfo.diffsUrl || mrInfo.mrUrl || '#';
  const filesCount = stats?.filesCount || mrInfo.filesCount;
  const addedLines = stats?.addedLines || mrInfo.addedLines;
  const deletedLines = stats?.deletedLines || mrInfo.deletedLines;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex flex-col items-start text-muted-foreground hover:text-foreground hover:underline transition-colors py-0.5 mt-0.5 px-1"
      title="Abrir alterações deste MR (/diffs)"
    >
      <div className="flex items-center gap-1 text-[9.5px] font-mono leading-tight">
        <FileCode className="w-2.5 h-2.5 shrink-0 opacity-70" />
        <span>{filesCount ? `${filesCount} files` : (mrInfo.mrIid ? `!${mrInfo.mrIid}` : 'diffs')}</span>
      </div>
      {(addedLines || deletedLines) && (
        <div className="flex items-center gap-1 text-[9px] font-mono font-bold leading-tight mt-0.5">
          {addedLines && <span className="text-emerald-500">{addedLines}</span>}
          {deletedLines && <span className="text-rose-500">{deletedLines}</span>}
        </div>
      )}
    </a>
  );
}

interface IssuePopoverProps {
  issue: RedmineIssue;
  container?: HTMLElement;
  usersMap?: Record<string, string>;
  targetBranches?: string[];
  branchDetails?: MRBranchInfo[];
  gitlabUrl?: string;
  gitlabToken?: string;
  redmineUrl?: string;
  redmineApiKey?: string;
}

export function StatusBadge({ issue }: { issue: RedmineIssue }) {
  const status = getStatusConfig(issue.status.id, issue.status.name);
  return (
    <span 
      className="ml-2 text-[11px] font-bold uppercase tracking-wider inline-flex items-center align-middle"
      style={{ color: status.colors.badge }}
    >
      {issue.status.name}
    </span>
  );
}

export function PriorityBadge({ issue }: { issue: RedmineIssue }) {
  const priority = getPriorityConfig(issue.priority.id, issue.priority.name);
  return (
    <span 
      className="mr-1.5 text-[11px] font-bold uppercase tracking-wider inline-flex items-center gap-1 align-middle"
      style={{ color: priority.colors.badge }}
    >
      <Bookmark className="w-3.5 h-3.5" style={{ color: priority.colors.badge, fill: priority.colors.badge }} />
      {issue.priority.name}
    </span>
  );
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn('[HydraReview] navigator.clipboard falhou:', err);
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch {
    return false;
  }
}

export function IssuePopover({ 
  issue, 
  container, 
  usersMap = {}, 
  targetBranches = [], 
  branchDetails = [], 
  gitlabUrl, 
  gitlabToken,
  redmineUrl,
  redmineApiKey,
}: IssuePopoverProps) {
  const priority = getPriorityConfig(issue.priority.id, issue.priority.name);
  const status = getStatusConfig(issue.status.id, issue.status.name);
  const tracker = getTrackerConfig(issue.tracker.id);

  const [isPreparingClaude, setIsPreparingClaude] = React.useState(false);
  const [claudeFeedback, setClaudeFeedback] = React.useState<{ message: string; isError?: boolean } | null>(null);
  const [claudePresets, setClaudePresets] = React.useState<ClaudePromptPreset[]>(DEFAULT_CLAUDE_PRESETS);
  const [activePresetId, setActivePresetId] = React.useState<string>(DEFAULT_CLAUDE_PRESETS[0].id);
  const [isOptionsOpen, setIsOptionsOpen] = React.useState(false);
  const [isPresetsDialogOpen, setIsPresetsDialogOpen] = React.useState(false);

  // Carrega presets de revisão e seleção ativa salvos no storage
  React.useEffect(() => {
    storageService.getClaudePresets().then(({ presets, activeId }) => {
      setClaudePresets(presets);
      setActivePresetId(activeId);
    }).catch(console.error);
  }, []);

  const handleSelectPreset = async (id: string) => {
    setActivePresetId(id);
    await storageService.setActiveClaudePresetId(id);
    setIsOptionsOpen(false);
  };

  const handleResetPresets = async () => {
    const { presets, activeId } = await storageService.resetClaudePresets();
    setClaudePresets(presets);
    setActivePresetId(activeId);
    setIsOptionsOpen(false);
    setClaudeFeedback({
      message: 'Presets restaurados para o padrão.',
      isError: false,
    });
    setTimeout(() => setClaudeFeedback(null), 4000);
  };

  const handleSavePresets = async (updated: ClaudePromptPreset[], newActiveId?: string) => {
    const targetActive = newActiveId || activePresetId;
    await storageService.saveClaudePresets(updated, targetActive);
    setClaudePresets(updated);
    setActivePresetId(targetActive);
  };

  const responsavelRevisaoField = issue.custom_fields?.find(f => f.id === 9);
  let responsavelRevisaoText = '';
  if (responsavelRevisaoField?.value) {
    const ids = Array.isArray(responsavelRevisaoField.value) 
      ? responsavelRevisaoField.value 
      : [String(responsavelRevisaoField.value)];
    
    // Mapeia IDs para Nomes (fallback pro ID se não achar)
    const names = ids.map(id => usersMap[id] || id);
    responsavelRevisaoText = names.join(', ');
  }
  const branchCustomField = issue.custom_fields?.find(f => f.id === 52 || f.name?.toLowerCase() === 'branch');
  const redmineBranchValue = branchCustomField?.value ? String(branchCustomField.value) : '';
  const redmineBranch = redmineBranchValue.toLowerCase();

  // Versão solicitada (Versão Disponibilizado id 66, ou fixed_version nativa)
  const versionCustomField = issue.custom_fields?.find(f => f.id === 66 || f.name?.toLowerCase().includes('versão'));
  const redmineVersionValue = versionCustomField?.value 
    ? String(versionCustomField.value) 
    : (issue.fixed_version?.name || '');

  const targetLower = (targetBranches || []).map(b => b.toLowerCase());
  const hasDevelop = targetLower.some(b => b.includes('develop')) || branchDetails.some(b => b.branch.toLowerCase().includes('develop'));
  const hasRelease = targetLower.some(b => b.includes('release')) || branchDetails.some(b => b.branch.toLowerCase().includes('release'));
  const hasMaster = targetLower.some(b => b.includes('master') || b.includes('main')) || branchDetails.some(b => b.branch.toLowerCase().includes('master') || b.branch.toLowerCase().includes('main'));
  
  const developMR = branchDetails.find(b => b.branch.toLowerCase().includes('develop'));
  const releaseMR = branchDetails.find(b => b.branch.toLowerCase().includes('release'));
  const masterMR = branchDetails.find(b => b.branch.toLowerCase().includes('master') || b.branch.toLowerCase().includes('main'));

  // Se no Redmine está explicitamente definido "Branch: Release" e não temos MR de release
  const redmineDemandsRelease = redmineBranch.includes('release');

  // Variáveis para interpolação dinâmica do template do Claude
  const cleanRedmine = (redmineUrl || '').replace(/\/$/, '');
  const sampleVariables: PromptTemplateVariables = React.useMemo(() => {
    return {
      issueId: issue.id,
      issueSubject: issue.subject,
      status: issue.status.name,
      priority: issue.priority.name,
      author: issue.author.name,
      assignee: issue.assigned_to?.name || 'Não atribuído',
      reviewer: responsavelRevisaoText || 'Nenhum',
      branch: redmineBranchValue || 'Não especificada',
      version: redmineVersionValue || 'Não especificada',
      redmineUrl: cleanRedmine ? `${cleanRedmine}/issues/${issue.id}` : '',
      taskFile: `tarefa-${issue.id}.md`,
    };
  }, [issue, cleanRedmine, responsavelRevisaoText, redmineBranchValue, redmineVersionValue]);

  // Ação: Envia arquivos para o MCP local (pasta temporária limpa) e abre o Claude Desktop
  const handleOpenInClaude = async () => {
    if (isPreparingClaude) return;
    setIsPreparingClaude(true);
    setClaudeFeedback(null);

    try {
      const cleanGitlabUrl = gitlabUrl || window.location.origin;
      const gToken = gitlabToken || '';

      // 1. Busca todos os MRs associados a esta tarefa no GitLab (varre todos os repositórios: front, back, erp, etc.)
      const allFoundMRs: any[] = [];
      try {
        const mrsResponse = await new Promise<any>((resolve) => {
          chrome.runtime.sendMessage(
            {
              type: 'FETCH_GITLAB_ISSUE_MRS',
              payload: {
                url: cleanGitlabUrl,
                token: gToken,
                issueId: issue.id,
              },
            },
            (res) => {
              if (chrome.runtime.lastError) {
                resolve({ success: false, mrs: [] });
              } else {
                resolve(res);
              }
            }
          );
        });
        if (mrsResponse?.success && Array.isArray(mrsResponse.mrs)) {
          allFoundMRs.push(...mrsResponse.mrs);
        }
      } catch {
        // Fallback silencioso
      }

      // 2. Coleta os diffs de todos os repositórios encontrados
      const diffEntries: Array<{ label: string; diff: string }> = [];
      const processedMrUrls = new Set<string>();

      // Helper para buscar o diff unificado bruto completo (direto ou via background service worker)
      const fetchDiffWithFallback = async (targetMrUrl: string): Promise<string | null> => {
        let diff = await gitlabApi.getMRRawDiff(targetMrUrl, gToken);
        if (!diff) {
          try {
            const bgRes = await new Promise<any>((resolve) => {
              chrome.runtime.sendMessage(
                {
                  type: 'FETCH_GITLAB_MR_DIFF',
                  payload: { mrUrl: targetMrUrl, token: gToken },
                },
                (res) => {
                  if (chrome.runtime.lastError) resolve(null);
                  else resolve(res);
                }
              );
            });
            if (bgRes?.success && bgRes?.diff) {
              diff = bgRes.diff;
            }
          } catch {}
        }
        return diff;
      };

      if (allFoundMRs.length > 0) {
        // Ordena: abertos primeiro, depois mesclados por data recente
        allFoundMRs.sort((a, b) => {
          if (a.state === 'opened' && b.state !== 'opened') return -1;
          if (a.state !== 'opened' && b.state === 'opened') return 1;
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        });

        for (const mr of allFoundMRs) {
          // Ignora MRs descartados (fechados sem merge)
          if (mr.state === 'closed') continue;

          const mrUrl = mr.web_url;
          if (!mrUrl || processedMrUrls.has(mrUrl)) continue;
          processedMrUrls.add(mrUrl);

          const rawDiff = await fetchDiffWithFallback(mrUrl);
          if (rawDiff && rawDiff.trim()) {
            const repoName = mr.references?.full ? mr.references.full.split('!')[0].split('/').pop() : `project-${mr.project_id}`;
            const fileName = `${repoName}-MR${mr.iid}-${mr.target_branch}.diff.txt`;
            diffEntries.push({ label: fileName, diff: rawDiff });
          }
        }
      }

      // Complementa com branchDetails do DOM caso algum MR não tenha vindo na busca
      for (const b of branchDetails) {
        const mrUrl = b.mrUrl || (b.projectPath && b.mrIid 
          ? `${cleanGitlabUrl.replace(/\/$/, '')}/${b.projectPath}/-/merge_requests/${b.mrIid}`
          : null);
        
        if (mrUrl && !processedMrUrls.has(mrUrl)) {
          processedMrUrls.add(mrUrl);
          const rawDiff = await fetchDiffWithFallback(mrUrl);
          if (rawDiff && rawDiff.trim()) {
            const repoName = b.projectPath ? b.projectPath.split('/').pop() : 'repo';
            const fileName = `${repoName}-${b.branch}.diff.txt`;
            diffEntries.push({ label: fileName, diff: rawDiff });
          }
        }
      }

      // 3. Busca os detalhes completos da tarefa no Redmine (incluindo journals, anexos, relações e campos)
      let taskMarkdown: string | null = null;
      try {
        const detailsResponse = await new Promise<any>((resolve) => {
          chrome.runtime.sendMessage(
            {
              type: 'FETCH_REDMINE_ISSUE_DETAILS',
              payload: {
                url: redmineUrl,
                apiKey: redmineApiKey,
                issueId: issue.id,
              },
            },
            (res) => {
              if (chrome.runtime.lastError) {
                resolve({ success: false });
              } else {
                resolve(res);
              }
            }
          );
        });

        if (detailsResponse?.success && detailsResponse?.issue) {
          taskMarkdown = buildTaskMarkdown(detailsResponse.issue, {
            cleanRedmineUrl: redmineUrl,
            responsavelRevisaoText: responsavelRevisaoText || undefined,
            redmineBranchValue: redmineBranchValue || undefined,
            redmineVersionValue: redmineVersionValue || undefined,
            linkedMRs: allFoundMRs,
          });
        }
      } catch {
        // Fallback silencioso se falhar
      }

      // Se por algum motivo a busca detalhada não retornou, gera o markdown estruturado com os dados já carregados
      if (!taskMarkdown) {
        taskMarkdown = buildTaskMarkdown(issue, {
          cleanRedmineUrl: redmineUrl,
          responsavelRevisaoText: responsavelRevisaoText || undefined,
          redmineBranchValue: redmineBranchValue || undefined,
          redmineVersionValue: redmineVersionValue || undefined,
          linkedMRs: allFoundMRs,
        });
      }

      // Validação: se não temos nenhum diff e nenhum requisito
      if (diffEntries.length === 0 && !taskMarkdown) {
        setClaudeFeedback({
          message: 'Nenhum arquivo de contexto (diff ou requisitos da tarefa) encontrado.',
          isError: true,
        });
        setTimeout(() => setClaudeFeedback(null), 6000);
        return;
      }

      // 3. Envia os arquivos para o servidor MCP local salvar na pasta temporária limpa (Zero downloads no navegador!)
      // A chamada é feita pelo background service worker para evitar bloqueio de Private Network Access (PNA)
      const syncResult = await new Promise<{ success: boolean; message?: string; data?: any }>((resolve) => {
        chrome.runtime.sendMessage(
          {
            type: 'SYNC_TASK_TO_LOCAL_MCP',
            payload: {
              issueId: issue.id,
              taskMarkdown,
              diffs: diffEntries.map(d => ({ name: d.label, content: d.diff })),
              metadata: {
                subject: issue.subject,
                status: issue.status.name,
                priority: issue.priority.name,
                author: issue.author.name,
                assignee: issue.assigned_to?.name || 'Não atribuído',
                reviewer: responsavelRevisaoText || 'Nenhum',
                branch: redmineBranchValue || 'Não especificada',
                version: redmineVersionValue || 'Não especificada',
                description: issue.description || '',
              },
            },
          },
          (res) => {
            if (chrome.runtime.lastError) {
              resolve({ success: false, message: chrome.runtime.lastError.message });
            } else {
              resolve(res || { success: false, message: 'Sem resposta do background service worker' });
            }
          }
        );
      });

      if (!syncResult.success) {
        setClaudeFeedback({
          message: syncResult.message || 'Servidor MCP offline. Abra o Claude Desktop com o MCP ativo.',
          isError: true,
        });
        setTimeout(() => setClaudeFeedback(null), 8000);
        return;
      }

      const totalFilesSaved = syncResult.data?.files?.length || 0;

      // 4. Monta o prompt dinâmico a partir do preset ativo
      const activePreset = claudePresets.find(p => p.id === activePresetId) || claudePresets[0] || DEFAULT_CLAUDE_PRESETS[0];
      const prompt = interpolatePromptTemplate(activePreset.promptTemplate, sampleVariables);


      // 5. Copia para a área de transferência
      await copyTextToClipboard(prompt);

      // 6. Abre o Claude Desktop via protocolo claude://
      const claudeUri = `claude://claude.ai/new?q=${encodeURIComponent(prompt)}`;
      const claudeLink = document.createElement('a');
      claudeLink.href = claudeUri;
      claudeLink.style.display = 'none';
      document.body.appendChild(claudeLink);
      claudeLink.click();
      setTimeout(() => {
        if (document.body.contains(claudeLink)) document.body.removeChild(claudeLink);
      }, 1000);

      setClaudeFeedback({
        message: `Claude Desktop aberto! ${totalFilesSaved} arquivo(s) prontos no MCP.`,
        isError: false,
      });
      setTimeout(() => setClaudeFeedback(null), 6000);
    } catch (err) {
      console.error('[HydraReview] Erro ao preparar contexto para o Claude:', err);
      setClaudeFeedback({
        message: 'Erro ao preparar dados da tarefa.',
        isError: true,
      });
      setTimeout(() => setClaudeFeedback(null), 5000);
    } finally {
      setIsPreparingClaude(false);
    }
  };


  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <div className="inline-flex items-center gap-1.5 cursor-pointer group">
          <div 
            className="relative inline-flex items-center justify-center w-5 h-5 rounded-sm transition-opacity opacity-80 group-hover:opacity-100"
          >
            <img 
              src="https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/redmine.svg" 
              alt="Redmine" 
              className="w-3 h-3"
            />
          </div>
          
          <div className="flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {issue.tracker.name}
            </span>
            
            {responsavelRevisaoText && (
              <span className="text-xs font-medium text-muted-foreground">
                - Responsável Revisão: {responsavelRevisaoText}
              </span>
            )}
          </div>
        </div>
      </HoverCardTrigger>
      
      <HoverCardContent 
        container={container} 
        className="w-[360px] p-0 overflow-hidden bg-background"
        style={{ 
          boxShadow: '0 8px 30px rgba(0,0,0,0.24)', 
          border: '1px solid rgba(150,150,150,0.25)',
          borderRadius: '8px'
        }}
        side="right" 
        align="start"
        sideOffset={12}
      >
        {/* Cabeçalho */}
        <div className="p-3 border-b bg-muted/50">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="font-semibold text-[10px] uppercase text-muted-foreground">
              {issue.tracker.name}
            </span>
            <span className="font-semibold text-[10px] px-2 py-0.5 rounded-full uppercase" style={{ backgroundColor: priority.colors.background, color: priority.colors.text }}>
              {issue.priority.name}
            </span>
          </div>
          <a 
            href={cleanRedmine ? `${cleanRedmine}/issues/${issue.id}` : '#'} 
            target="_blank" 
            rel="noreferrer" 
            className="font-semibold text-sm hover:underline line-clamp-2 mt-2 leading-tight"
          >
            #{issue.id} - {issue.subject}
          </a>
        </div>
    
        {/* Conteúdo dos Detalhes */}
        <div className="p-3 space-y-3 bg-card text-card-foreground">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 w-24 text-muted-foreground text-xs font-medium">
              <AlertCircle className="w-3.5 h-3.5" /> Status
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase" style={{ backgroundColor: status.colors.background, color: status.colors.text }}>
              {issue.status.name}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 w-24 text-muted-foreground text-xs font-medium">
              <User className="w-3.5 h-3.5" /> Responsável
            </div>
            <span className="text-xs font-medium text-foreground truncate">
              {issue.assigned_to?.name || 'Não atribuído'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 w-24 text-muted-foreground text-xs font-medium">
              <Clock className="w-3.5 h-3.5" /> Autor
            </div>
            <span className="text-xs text-foreground truncate">
              {issue.author.name}
            </span>
          </div>

          {responsavelRevisaoText && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 w-24 text-muted-foreground text-xs font-medium">
                <Users className="w-3.5 h-3.5" /> Revisão
              </div>
              <span className="text-xs font-medium text-foreground truncate">
                {responsavelRevisaoText}
              </span>
            </div>
          )}

          {/* Dados Solicitados no Redmine (Branch e Versão) */}
          {(redmineBranchValue || redmineVersionValue) && (
            <div className="pt-2 border-t border-border/50 space-y-1">
              {redmineBranchValue && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-medium">Branch solicitada:</span>
                  <span className="font-semibold text-foreground bg-muted/60 px-1.5 py-0.5 rounded text-[11px]">
                    {redmineBranchValue}
                  </span>
                </div>
              )}
              {redmineVersionValue && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-medium">Versão solicitada:</span>
                  <span className="font-semibold text-foreground bg-muted/60 px-1.5 py-0.5 rounded text-[11px]">
                    {redmineVersionValue}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Comparativo de Branches Alvo */}
          <div className="pt-2 border-t border-border/50 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground mb-1">
              <span className="flex items-center gap-1">
                <GitBranch className="w-3.5 h-3.5 text-primary/70" />
                Branches Alvo (MRs)
              </span>
              {/* Validação: Se abriu pra release OU master, OBRIGATÓRIO ter develop */}
              {(hasMaster || hasRelease) && !hasDevelop && (
                <span className="text-[10px] text-amber-500 font-bold flex items-center gap-0.5">
                  <AlertTriangle className="w-3 h-3" /> Falta develop
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-1.5 pt-0.5">
              {/* Develop */}
              <div className="flex flex-col">
                <div 
                  className={`flex items-center justify-between px-2 py-1 rounded text-[10px] font-medium border ${
                    hasDevelop 
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                      : (hasMaster || hasRelease)
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                      : 'bg-muted/40 text-muted-foreground border-transparent'
                  }`}
                >
                  <span>develop</span>
                  {hasDevelop ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  ) : (hasMaster || hasRelease) ? (
                    <AlertTriangle className="w-3 h-3 text-amber-500" />
                  ) : (
                    <Minus className="w-3 h-3 opacity-40" />
                  )}
                </div>
                {hasDevelop && developMR && (
                  <BranchDiffSummary mrInfo={developMR} gitlabUrl={gitlabUrl} gitlabToken={gitlabToken} />
                )}
              </div>

              {/* Release */}
              <div className="flex flex-col">
                <div 
                  className={`flex items-center justify-between px-2 py-1 rounded text-[10px] font-medium border ${
                    hasRelease 
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                      : redmineDemandsRelease
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                      : 'bg-muted/40 text-muted-foreground border-transparent'
                  }`}
                >
                  <span>release</span>
                  {hasRelease ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  ) : redmineDemandsRelease ? (
                    <AlertTriangle className="w-3 h-3 text-amber-500" />
                  ) : (
                    <Minus className="w-3 h-3 opacity-40" />
                  )}
                </div>
                {hasRelease && releaseMR && (
                  <BranchDiffSummary mrInfo={releaseMR} gitlabUrl={gitlabUrl} gitlabToken={gitlabToken} />
                )}
              </div>

              {/* Master */}
              <div className="flex flex-col">
                <div 
                  className={`flex items-center justify-between px-2 py-1 rounded text-[10px] font-medium border ${
                    hasMaster 
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                      : 'bg-muted/40 text-muted-foreground border-transparent'
                  }`}
                >
                  <span>master</span>
                  {hasMaster ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <Minus className="w-3 h-3 opacity-40" />
                  )}
                </div>
                {hasMaster && masterMR && (
                  <BranchDiffSummary mrInfo={masterMR} gitlabUrl={gitlabUrl} gitlabToken={gitlabToken} />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé: Ação de Revisão Direta com IA no Claude Desktop */}
        <div className="p-3 border-t bg-muted/20 space-y-2">
          <div className="flex items-center gap-[2px] w-full">
            {/* Botão Principal: Abrir no Claude */}
            <button
              type="button"
              onClick={handleOpenInClaude}
              disabled={isPreparingClaude}
              className="flex-1 h-8 inline-flex items-center justify-center gap-2 px-3 text-xs font-semibold text-amber-900 dark:text-amber-100 bg-amber-500/15 hover:bg-amber-500/25 active:scale-[0.99] border border-amber-500/30 rounded-md transition-all disabled:opacity-50 cursor-pointer min-w-0"
              title={`Extrai arquivos em background e abre o Claude Desktop (${claudePresets.find(p => p.id === activePresetId)?.name || 'Padrão'})`}
            >
              {isPreparingClaude ? (
                <Loader2 className="w-4 h-4 animate-spin text-amber-600 dark:text-amber-400 shrink-0" />
              ) : (
                <img 
                  src="https://cdn.jsdelivr.net/gh/selfhst/icons/svg/claude.svg" 
                  alt="Claude" 
                  className="w-4 h-4 shrink-0"
                />
              )}
              <span className="truncate">
                {isPreparingClaude 
                  ? 'Preparando arquivos temporários...' 
                  : `Abrir no Claude - ${claudePresets.find(p => p.id === activePresetId)?.name || 'Padrão'}`}
              </span>
            </button>

            {/* Botão Split com Setinha para Direita: Opções de comando */}
            <Popover open={isOptionsOpen} onOpenChange={setIsOptionsOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  disabled={isPreparingClaude}
                  className="h-8 w-8 inline-flex items-center justify-center text-xs font-semibold text-amber-900 dark:text-amber-100 bg-amber-500/15 hover:bg-amber-500/25 active:scale-[0.99] border border-amber-500/30 rounded-md transition-all disabled:opacity-50 cursor-pointer shrink-0"
                  title="Opções de presets e comandos para o Claude"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </PopoverTrigger>

              <PopoverContent 
                container={container} 
                align="end" 
                side="right"
                sideOffset={8}
                className="w-72 p-2 text-xs bg-popover/95 backdrop-blur-md z-50 rounded-lg space-y-1"
                style={{
                  boxShadow: '0 12px 36px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(120, 120, 120, 0.3)',
                  border: '1px solid rgba(120, 120, 120, 0.3)',
                }}
              >
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Presets de Revisão</span>
                  <Sparkles className="w-3 h-3 text-amber-500" />
                </div>

                <div className="space-y-0.5">
                  {claudePresets.map((preset) => {
                    const isSelected = preset.id === activePresetId;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSelectPreset(preset.id)}
                        className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-left transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500/15 text-amber-900 dark:text-amber-100 font-medium'
                            : 'hover:bg-muted text-foreground'
                        }`}
                      >
                        <div className="truncate pr-2">
                          <div className="truncate text-xs">{preset.name}</div>
                          {preset.description && (
                            <div className="truncate text-[10px] text-muted-foreground">{preset.description}</div>
                          )}
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                <div className="h-px bg-border my-1" />

                <button
                  type="button"
                  onClick={() => {
                    setIsOptionsOpen(false);
                    setIsPresetsDialogOpen(true);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-foreground hover:bg-muted transition-colors text-left cursor-pointer"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Alterar comando / Gerenciar presets</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetPresets}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-left cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restaurar para o padrão</span>
                </button>
              </PopoverContent>
            </Popover>
          </div>

          {claudeFeedback && (
            <div
              className={`flex items-start gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded animate-in fade-in-0 duration-150 ${
                claudeFeedback.isError
                  ? 'text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20'
                  : 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
              }`}
            >
              {claudeFeedback.isError ? (
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-500 mt-0.5" />
              ) : (
                <Check className="w-3.5 h-3.5 shrink-0 text-emerald-500 mt-0.5" />
              )}
              <span className="leading-tight">{claudeFeedback.message}</span>
            </div>
          )}
        </div>
      </HoverCardContent>

      {/* Modal de Edição e Customização de Presets do Claude */}
      <ClaudePresetsDialog
        open={isPresetsDialogOpen}
        onOpenChange={setIsPresetsDialogOpen}
        container={container}
        presets={claudePresets}
        activePresetId={activePresetId}
        onSavePresets={handleSavePresets}
        sampleVariables={sampleVariables}
      />
    </HoverCard>
  );
}
