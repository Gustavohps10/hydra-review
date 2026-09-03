import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { storageService } from '@/services/storage';
import { redmineApi } from '@/services/api/redmine';
import { gitlabApi } from '@/services/api/gitlab';
import { Settings, Save, CheckCircle2, XCircle, Loader2, Info, User, Mail, ShieldAlert, Key, LogOut } from 'lucide-react';

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
});

type FormValues = z.infer<typeof formSchema>;
type ViewState = 'loading' | 'form' | 'dashboard';

export default function App() {
  const [view, setView] = useState<ViewState>('loading');
  const [status, setStatus] = useState<{ type: 'idle' | 'success' | 'error'; message: string }>({ type: 'idle', message: '' });
  
  const [redmineUser, setRedmineUser] = useState<RedmineUserResponse['user'] | null>(null);
  const [gitlabUser, setGitlabUser] = useState<GitLabUserResponse | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { redmineUrl: '', redmineApiKey: '', gitlabUrl: '', gitlabToken: '' },
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
      });
    });
    return () => subscription.unsubscribe();
  }, [form, view]);

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
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary" />
                <CardTitle>Hydra Review</CardTitle>
              </div>
              <CardDescription>Configure suas credenciais de acesso.</CardDescription>
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

                {status.type !== 'idle' && (
                  <Alert variant={status.type === 'success' ? 'success' : 'destructive'} className="mt-4">
                    {status.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <Info className="h-4 w-4" />}
                    <AlertTitle>{status.type === 'success' ? 'Sucesso' : 'Problema na Conexão'}</AlertTitle>
                    <AlertDescription className="text-sm mt-1 leading-relaxed">{status.message}</AlertDescription>
                  </Alert>
                )}
              </form>
            </CardContent>
            
            <CardFooter className="shrink-0 p-6 pt-4 border-t bg-card">
              <Button type="submit" form="config-form" className="w-full">
                <Save className="w-4 h-4 mr-2" />
                Conectar
              </Button>
            </CardFooter>
          </>
        ) : (
          <>
            <CardHeader className="shrink-0 pb-4 border-b">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <CardTitle>Conectado</CardTitle>
              </div>
              <CardDescription>Integrações ativas e autenticadas.</CardDescription>
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
            </CardContent>
            
            <CardFooter className="shrink-0 p-6 pt-4 border-t bg-card flex gap-3">
              <Button 
                variant="ghost" 
                className="flex-1"
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setStatus({ type: 'idle', message: '' });
                  setView('form');
                }}
              >
                <Settings className="w-4 h-4 mr-2" />
                Alterar Config
              </Button>
              <Button 
                variant="secondary" 
                className="flex-1"
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
                <Loader2 className="w-4 h-4 mr-2" />
                Retestar
              </Button>
            </CardFooter>
          </>
        )}
      </Card>
    </div>
  );
}
