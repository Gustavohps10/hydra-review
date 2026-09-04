import React from 'react';
import type { RedmineIssue } from '@/types';
import { getPriorityConfig, getStatusConfig, getTrackerConfig } from '@/utils/redmine-metadata';
import { Users, Clock, AlertCircle, User, ShieldAlert, Bookmark, CheckCircle2, AlertTriangle, Minus, GitBranch } from 'lucide-react';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"

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

interface IssuePopoverProps {
  issue: RedmineIssue;
  container?: HTMLElement;
  usersMap?: Record<string, string>;
  targetBranches?: string[];
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

export function IssuePopover({ issue, container, usersMap = {}, targetBranches = [] }: IssuePopoverProps) {
  const priority = getPriorityConfig(issue.priority.id, issue.priority.name);
  const status = getStatusConfig(issue.status.id, issue.status.name);
  const tracker = getTrackerConfig(issue.tracker.id);

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
  const hasDevelop = targetLower.some(b => b.includes('develop'));
  const hasRelease = targetLower.some(b => b.includes('release'));
  const hasMaster = targetLower.some(b => b.includes('master') || b.includes('main'));
  
  // Se no Redmine está explicitamente definido "Branch: Release" e não temos MR de release
  const redmineDemandsRelease = redmineBranch.includes('release');
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
        className="w-[340px] p-0 overflow-hidden bg-background"
        style={{ 
          boxShadow: '0 8px 30px rgba(0,0,0,0.24)', 
          border: '1px solid rgba(150,150,150,0.25)',
          borderRadius: '8px'
        }}
        side="right" 
        align="start"
        sideOffset={12}
      >
        <div className="p-3 border-b bg-muted/50">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="font-semibold text-[10px] uppercase text-muted-foreground">
              {issue.tracker.name}
            </span>
            <span className="font-semibold text-[10px] px-2 py-0.5 rounded-full uppercase" style={{ backgroundColor: priority.colors.background, color: priority.colors.text }}>
              {issue.priority.name}
            </span>
          </div>
          <a href={`http://redmine.atakone.com.br/issues/${issue.id}`} target="_blank" rel="noreferrer" className="font-semibold text-sm hover:underline line-clamp-2 mt-2 leading-tight">
            #{issue.id} - {issue.subject}
          </a>
        </div>
        
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

              {/* Release */}
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

              {/* Master */}
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
            </div>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
