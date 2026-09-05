import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { storageService } from '@/services/storage';
import { redmineApi } from '@/services/api/redmine';
import { gitlabApi } from '@/services/api/gitlab';
import { Settings, Save, CheckCircle2, XCircle, Loader2, Info, User, Mail, ShieldAlert, Key, LogOut, RotateCw, FileText, Trash2, FolderArchive, Copy, Check } from 'lucide-react';

// Shadcn UI
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ThemeToggle } from '@/components/theme-toggle';
import type { RedmineUserResponse, GitLabUserResponse } from '@/types';

const formSchema = z.object({
  redmineUrl: z.string().url("A URL do Redmine deve ser válida.").or(z.literal('')),
  redmineApiKey: z.string().or(z.literal('')),
  gitlabUrl: z.string().url("A URL do GitLab deve ser válida.").or(z.literal('')),
  gitlabToken: z.string().or(z.literal('')),
  mcpServerUrl: z.string().url("A URL do MCP Server deve ser válida.").or(z.literal('')).optional(),
});

type FormValues = z.infer<typeof formSchema>;
type ViewState = 'loading' | 'form' | 'dashboard' | 'logs';

export default function App() {
  const [view, setView] = useState<ViewState>('loading');
  const [status, setStatus] = useState<{ type: 'idle' | 'success' | 'error'; message: string }>({ type: 'idle', message: '' });
  
  const [redmineUser, setRedmineUser] = useState<RedmineUserResponse['user'] | null>(null);
  const [gitlabUser, setGitlabUser] = useState<GitLabUserResponse | null>(null);
  const [logs, setLogs] = useState<any[]>([]);

  const [cacheStats, setCacheStats] = useState<{
    running: boolean;
    serverUrl?: string;
    taskCount?: number;
    totalFiles?: number;
    totalBytes?: number;
  } | null>(null);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(false);

  const loadLogs = async () => {
    const { loggerService } = await import('@/services/logger');
    const allLogs = await loggerService.getLogs();
    setLogs(allLogs.reverse()); // Mais recentes primeiro
  };

  const loadCacheStats = async () => {
    const config = await storageService.getConfig();
    chrome.runtime.sendMessage({ type: 'GET_MCP_STATUS', payload: { mcpServerUrl: config.mcpServerUrl } }, (res) => {
      if (res?.success && res?.data) {
        setCacheStats(res.data);
      } else {
        setCacheStats({ running: false, serverUrl: res?.data?.serverUrl || config.mcpServerUrl || 'http://127.0.0.1:47106' });
      }
    });
  };

  const handleClearCache = async () => {
    setIsClearingCache(true);
    const config = await storageService.getConfig();
    chrome.runtime.sendMessage({ type: 'CLEAR_MCP_CACHE', payload: { mcpServerUrl: config.mcpServerUrl } }, async (res) => {
      setIsClearingCache(false);
      if (res?.success) {
        await loadCacheStats();
        setStatus({ type: 'success', message: 'Cache de arquivos temporários limpo!' });
        setTimeout(() => setStatus({ type: 'idle', message: '' }), 3000);
      } else {
        setStatus({ type: 'error', message: res?.message || 'Falha ao conectar ao servidor MCP.' });
      }
    });
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { redmineUrl: '', redmineApiKey: '', gitlabUrl: '', gitlabToken: '', mcpServerUrl: '' },
  });

  const validateSavedConfig = async (config: FormValues) => {
    let isValid = true;
    let rUser = null;
    let gUser = null;
    
    if (config.redmineUrl && config.redmineApiKey) {
      const redmineRes = await redmineApi.validateConnection(config.redmineUrl, config.redmineApiKey);
      if (redmineRes.success && redmineRes.data) {
        rUser = redmineRes.data;
      } else {
        isValid = false;
        setStatus({ type: 'error', message: `Redmine: ${redmineRes.message}` });
      }
    } else {
      isValid = false;
    }

    if (isValid && config.gitlabUrl && config.gitlabToken) {
      const gitlabRes = await gitlabApi.validateConnection(config.gitlabUrl, config.gitlabToken);
      if (gitlabRes.success && gitlabRes.data) {
        gUser = gitlabRes.data;
      } else {
        isValid = false;
        setStatus({ type: 'error', message: `GitLab: ${gitlabRes.message}` });
      }
    } else {
      isValid = false;
    }

    if (isValid) {
      setRedmineUser(rUser);
      setGitlabUser(gUser);
      setView('dashboard');
    } else {
      setView('form');
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const savedConfig = await storageService.getConfig();
        const hasSavedData = savedConfig.redmineUrl || savedConfig.gitlabUrl;

        form.reset({
          redmineUrl: savedConfig.redmineUrl || '',
          redmineApiKey: savedConfig.redmineApiKey || '',
          gitlabUrl: savedConfig.gitlabUrl || '',
          gitlabToken: savedConfig.gitlabToken || '',
          mcpServerUrl: savedConfig.mcpServerUrl || '',
        });

        if (hasSavedData && savedConfig.redmineApiKey && savedConfig.gitlabToken) {
          // Tenta validar as configurações já salvas para entrar no dashboard direto
          await validateSavedConfig(savedConfig as FormValues);
        } else {
          // Sem configs suficientes, abre o form
          // Sugestões se o banco estiver vazio
          if (!hasSavedData) {
            const { suggestionService } = await import('@/services/suggestions');
            const suggestions = await suggestionService.getSuggestedUrls();
            form.reset({
              ...form.getValues(),
              redmineUrl: suggestions.redmineUrl || '',
              gitlabUrl: suggestions.gitlabUrl || '',
              mcpServerUrl: savedConfig.mcpServerUrl || '',
            });
          }
          setView('form');
        }
      } catch (err) {
        console.error('Falha ao inicializar', err);
        setView('form');
      }
    };
    init();
  }, [form]);

  // Auto-save do rascunho
  useEffect(() => {
    if (view !== 'form') return;
    const subscription = form.watch((value) => {
      storageService.setConfig({
        redmineUrl: value.redmineUrl || '',
        redmineApiKey: value.redmineApiKey || '',
        gitlabUrl: value.gitlabUrl || '',
        gitlabToken: value.gitlabToken || '',
        mcpServerUrl: value.mcpServerUrl || '',
      });
    });
    return () => subscription.unsubscribe();
  }, [form, view]);

  // Carrega status do cache MCP quando estiver no dashboard
  useEffect(() => {
    if (view === 'dashboard') {
      loadCacheStats();
    }
  }, [view]);

  const onSubmit = async (data: FormValues) => {
    setStatus({ type: 'idle', message: '' });
    
    // Validação manual
    if (!data.redmineUrl || !data.redmineApiKey || !data.gitlabUrl || !data.gitlabToken) {
      setStatus({ type: 'error', message: 'Preencha todas as URLs e Tokens para continuar.' });
      return;
    }

    setView('loading');
    await validateSavedConfig(data);
  };

  if (view === 'loading') {
    return (
      <div className="w-[400px] h-[600px] flex flex-col items-center justify-center bg-background gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground animate-pulse">Conectando aos serviços...</p>
      </div>
    );
  }

  return (
    <div className="w-[400px] h-[600px] flex flex-col bg-background">
      <Card className="border-0 shadow-none relative flex flex-col h-full rounded-none">
        <div className="absolute right-6 top-6 z-10">
          <ThemeToggle />
        </div>
        
        {view === 'form' ? (
          <>
            <CardHeader className="shrink-0 pb-4 border-b">
              <div className="flex items-center gap-3 pr-10">
                <img src="/icon-48.png" alt="Hydra Review" className="w-8 h-8 rounded-lg shadow-sm border border-border/60 shrink-0" />
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-bold leading-tight">Hydra Review</CardTitle>
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full border">
                      <Settings className="w-3 h-3" />
                      Configurações
                    </span>
                  </div>
                  <CardDescription className="text-xs mt-0.5">Configure suas credenciais de acesso.</CardDescription>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar">
              <form id="config-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    <img src="https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/redmine.svg" alt="Redmine" className="w-5 h-5" />
                    Redmine Config
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="redmineUrl">URL Base</Label>
                    <Input id="redmineUrl" type="url" placeholder="http://redmine.atakone.com.br" {...form.register("redmineUrl")} />
                    {form.formState.errors.redmineUrl && <p className="text-xs text-destructive">{form.formState.errors.redmineUrl.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="redmineApiKey">API Key</Label>
                    <Input id="redmineApiKey" type="password" placeholder="Sua API Key do Redmine" {...form.register("redmineApiKey")} />
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    <img src="https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/gitlab.svg" alt="GitLab" className="w-5 h-5" />
                    GitLab Config
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gitlabUrl">URL Base</Label>
                    <Input id="gitlabUrl" type="url" placeholder="https://gitlab.com" {...form.register("gitlabUrl")} />
                    {form.formState.errors.gitlabUrl && <p className="text-xs text-destructive">{form.formState.errors.gitlabUrl.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gitlabToken">Access Token</Label>
                    <Input id="gitlabToken" type="password" placeholder="Personal Access Token" {...form.register("gitlabToken")} />
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      <FolderArchive className="w-5 h-5 text-amber-500" />
                      Claude Desktop MCP (Opcional)
                    </div>
                    <span className="text-[10px] text-muted-foreground font-normal">Padrão: :47106</span>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mcpServerUrl">URL do Servidor MCP</Label>
                    <Input id="mcpServerUrl" type="url" placeholder="http://127.0.0.1:47106" {...form.register("mcpServerUrl")} />
                    {form.formState.errors.mcpServerUrl && <p className="text-xs text-destructive">{form.formState.errors.mcpServerUrl.message}</p>}
                    <p className="text-[11px] text-muted-foreground">
                      Deixe vazio para o servidor local padrão (<code className="font-mono">127.0.0.1:47106</code>) ou informe a URL do servidor MCP da equipe.
                    </p>
                  </div>
                </div>

                {status.type !== 'idle' && (
                  <Alert variant={status.type === 'success' ? 'success' : 'destructive'} className="mt-4">
                    {status.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <Info className="h-4 w-4" />}
                    <AlertTitle>{status.type === 'success' ? 'Sucesso' : 'Problema na Conexão'}</AlertTitle>
                    <AlertDescription className="text-sm mt-1 leading-relaxed">{status.message}</AlertDescription>
                  </Alert>
                )}
              </form>
            </CardContent>
            
            <CardFooter className="shrink-0 p-4 border-t bg-card flex gap-2">
              {redmineUser && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-xs" 
                  type="button" 
                  onClick={() => setView('dashboard')}
                >
                  Cancelar
                </Button>
              )}
              <Button type="submit" form="config-form" variant="outline" className="flex-1">
                <Save className="w-4 h-4 mr-2" />
                Salvar Configurações
              </Button>
            </CardFooter>
          </>
        ) : view === 'dashboard' ? (
          <>
            <CardHeader className="shrink-0 pb-4 border-b">
              <div className="flex items-center gap-3 pr-10">
                <img src="/icon-48.png" alt="Hydra Review" className="w-8 h-8 rounded-lg shadow-sm border border-border/60 shrink-0" />
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-bold leading-tight">Hydra Review</CardTitle>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      Conectado
                    </span>
                  </div>
                  <CardDescription className="text-xs mt-0.5">Integrações ativas e autenticadas.</CardDescription>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="flex-1 overflow-y-auto px-6 py-4 space-y-6 custom-scrollbar">
              {status.type === 'success' && status.message && (
                <Alert variant="success">
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Sucesso</AlertTitle>
                  <AlertDescription className="text-sm mt-1">{status.message}</AlertDescription>
                </Alert>
              )}
              {/* Redmine Card */}
              {redmineUser && (
                <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
                  <div className="flex items-center gap-3 border-b p-4">
                    <img src="https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/redmine.svg" alt="Redmine" className="w-6 h-6" />
                    <h3 className="font-semibold text-sm">Redmine Workspace</h3>
                  </div>
                  <div className="p-4 space-y-3 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span>{redmineUser.firstname} {redmineUser.lastname} <span className="text-muted-foreground">({redmineUser.login})</span></span>
                    </div>
                    {redmineUser.mail && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <span>{redmineUser.mail}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Key className="w-4 h-4 text-muted-foreground" />
                      <span>ID: {redmineUser.id}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* GitLab Card */}
              {gitlabUser && (
                <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
                  <div className="flex items-center gap-3 border-b p-4">
                    <img src="https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/gitlab.svg" alt="GitLab" className="w-6 h-6" />
                    <h3 className="font-semibold text-sm">GitLab Workspace</h3>
                  </div>
                  <div className="p-4 space-y-3 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span>{gitlabUser.name} <span className="text-muted-foreground">(@{gitlabUser.username})</span></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Key className="w-4 h-4 text-muted-foreground" />
                      <span>ID: {gitlabUser.id}</span>
                    </div>
                    {gitlabUser.state && (
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-emerald-500" />
                        <span className="capitalize">Status: {gitlabUser.state}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Card de Cache de Arquivos Temporários do MCP */}
              <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
                <div className="flex items-center justify-between border-b p-4">
                  <div className="flex items-center gap-3">
                    <FolderArchive className="w-5 h-5 text-amber-500" />
                    <div>
                      <h3 className="font-semibold text-sm">Arquivos Temporários (MCP)</h3>
                      <p className="text-[11px] text-muted-foreground truncate max-w-[180px]" title={cacheStats?.serverUrl || 'http://127.0.0.1:47106'}>
                        {cacheStats?.serverUrl || 'http://127.0.0.1:47106'}
                      </p>
                    </div>
                  </div>
                  {cacheStats?.running ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      Conectado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                      Offline
                    </span>
                  )}
                </div>
                <div className="p-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Tarefas em cache:</span>
                    <span className="font-medium text-foreground">
                      {cacheStats?.taskCount ?? 0} ({cacheStats?.totalFiles ?? 0} arquivos, {(((cacheStats?.totalBytes ?? 0) / 1024)).toFixed(1)} KB)
                    </span>
                  </div>
                  {!cacheStats?.running && (
                    <div className="p-2.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs space-y-2">
                      <div className="flex items-start gap-1.5 text-amber-800 dark:text-amber-300">
                        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>Servidor MCP offline em {cacheStats?.serverUrl || 'http://127.0.0.1:47106'}.</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Ao rodar <strong className="text-foreground">npm run dev</strong> a configuração é feita automaticamente. Se precisar rodar manualmente:
                      </p>
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-amber-500/20">
                        <code className="text-[11px] bg-background/80 px-1.5 py-0.5 rounded font-mono text-foreground">
                          npm run setup:mcp
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[11px] cursor-pointer shrink-0"
                          type="button"
                          onClick={async () => {
                            await navigator.clipboard.writeText('npm run setup:mcp');
                            setCopiedCommand(true);
                            setTimeout(() => setCopiedCommand(false), 2000);
                          }}
                        >
                          {copiedCommand ? <Check className="w-3 h-3 text-emerald-500 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                          {copiedCommand ? 'Copiado!' : 'Copiar'}
                        </Button>
                      </div>
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 border-rose-500/20 cursor-pointer"
                    type="button"
                    disabled={isClearingCache || !cacheStats?.taskCount}
                    onClick={handleClearCache}
                  >
                    {isClearingCache ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    Limpar Arquivos Temporários
                  </Button>
                </div>
              </div>
            </CardContent>
            
            <CardFooter className="shrink-0 p-4 border-t bg-card flex flex-col gap-2">
              <div className="flex items-center gap-2 w-full">
                <Button 
                  variant="outline" 
                  size="sm"
                  className="flex-1 text-xs"
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setStatus({ type: 'idle', message: '' });
                    setView('form');
                  }}
                >
                  <Settings className="w-3.5 h-3.5 mr-1.5" />
                  Alterar Config
                </Button>
                <Button 
                  variant="default" 
                  size="sm"
                  className="flex-1 text-xs"
                  type="button"
                  onClick={async (e) => {
                    e.preventDefault();
                    setStatus({ type: 'idle', message: '' });
                    setView('loading');
                    await validateSavedConfig(form.getValues());
                    setStatus({ type: 'success', message: 'Conexões testadas e ativas!' });
                    setTimeout(() => setStatus({ type: 'idle', message: '' }), 3000);
                  }}
                >
                  <RotateCw className="w-3.5 h-3.5 mr-1.5" />
                  Reconectar
                </Button>
                <Button 
                  variant="secondary" 
                  size="sm"
                  className="flex-1 text-xs"
                  type="button"
                  onClick={() => {
                    loadLogs();
                    setView('logs');
                  }}
                >
                  <FileText className="w-3.5 h-3.5 mr-1.5" />
                  Ver Logs
                </Button>
              </div>
            </CardFooter>
          </>
        ) : view === 'logs' ? (
          <>
            <CardHeader className="shrink-0 pb-4 border-b">
              <div className="flex items-center gap-3 pr-10">
                <img src="/icon-48.png" alt="Hydra Review" className="w-8 h-8 rounded-lg shadow-sm border border-border/60 shrink-0" />
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-bold leading-tight">Hydra Review</CardTitle>
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full border">
                      <FileText className="w-3 h-3" />
                      Logs
                    </span>
                  </div>
                  <CardDescription className="text-xs mt-0.5">Logs de execução do Content Script no GitLab.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto px-0 py-0 custom-scrollbar bg-black/5">
              {logs.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">Nenhum log registrado ainda. Acesse uma página do GitLab.</div>
              ) : (
                <div className="divide-y divide-border/50">
                  {logs.map((log, i) => (
                    <div key={i} className="p-3 text-xs font-mono space-y-1">
                      <div className="flex items-center justify-between opacity-70">
                        <span>{new Date(log.timestamp).toLocaleTimeString()} - {log.source}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                          log.level === 'error' ? 'bg-red-500/20 text-red-500' : 
                          log.level === 'warn' ? 'bg-amber-500/20 text-amber-500' : 
                          'bg-blue-500/20 text-blue-500'
                        }`}>{log.level}</span>
                      </div>
                      <div className="break-words whitespace-pre-wrap">{log.message}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            <CardFooter className="shrink-0 p-6 pt-4 border-t bg-card flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setView('dashboard')}>
                Voltar
              </Button>
              <Button variant="destructive" className="flex-1" onClick={async () => {
                const { loggerService } = await import('@/services/logger');
                await loggerService.clearLogs();
                setLogs([]);
              }}>
                Limpar Logs
              </Button>
            </CardFooter>
          </>
        ) : null}
      </Card>
    </div>
  );
}
