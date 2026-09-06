import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import type { ClaudePromptPreset } from '@/types';
import {
  PROMPT_VARIABLES_HELP,
  DEFAULT_CLAUDE_PRESETS,
  interpolatePromptTemplate,
  type PromptTemplateVariables,
} from '@/utils/prompt-template';
import {
  Sparkles,
  Plus,
  Trash2,
  RotateCcw,
  Check,
  Eye,
  Code2,
  FileCode,
  Tag,
} from 'lucide-react';

interface ClaudePresetsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  container?: HTMLElement | null;
  presets: ClaudePromptPreset[];
  activePresetId: string;
  onSavePresets: (updatedPresets: ClaudePromptPreset[], newActiveId?: string) => Promise<void>;
  sampleVariables: PromptTemplateVariables;
}

export function ClaudePresetsDialog({
  open,
  onOpenChange,
  container,
  presets,
  activePresetId,
  onSavePresets,
  sampleVariables,
}: ClaudePresetsDialogProps) {
  const [localPresets, setLocalPresets] = React.useState<ClaudePromptPreset[]>(presets);
  const [selectedPresetId, setSelectedPresetId] = React.useState<string>(activePresetId);
  const [activeTab, setActiveTab] = React.useState<'editor' | 'preview'>('editor');
  const [feedback, setFeedback] = React.useState<string | null>(null);

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Sincroniza estado quando o dialog abre ou os presets mudam
  React.useEffect(() => {
    if (open) {
      setLocalPresets(presets);
      setSelectedPresetId(activePresetId);
      setActiveTab('editor');
      setFeedback(null);
    }
  }, [open, presets, activePresetId]);

  const currentPreset = localPresets.find((p) => p.id === selectedPresetId) || localPresets[0];

  const handleUpdateCurrentField = (field: keyof ClaudePromptPreset, value: any) => {
    if (!currentPreset) return;
    setLocalPresets((prev) =>
      prev.map((p) => (p.id === currentPreset.id ? { ...p, [field]: value } : p))
    );
  };

  const handleInsertVariable = (tag: string) => {
    const textarea = textareaRef.current;
    if (!textarea || !currentPreset) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = currentPreset.promptTemplate;
    const newText = currentText.substring(0, start) + tag + currentText.substring(end);

    handleUpdateCurrentField('promptTemplate', newText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length, start + tag.length);
    }, 0);
  };

  const handleCreateNewPreset = () => {
    const newId = `custom-${Date.now()}`;
    const newPreset: ClaudePromptPreset = {
      id: newId,
      name: `Novo Preset ${localPresets.length + 1}`,
      description: 'Preset personalizado de revisão',
      promptTemplate: currentPreset ? currentPreset.promptTemplate : DEFAULT_CLAUDE_PRESETS[0].promptTemplate,
      isDefault: false,
      createdAt: Date.now(),
    };

    setLocalPresets((prev) => [...prev, newPreset]);
    setSelectedPresetId(newId);
    setActiveTab('editor');
  };

  const handleDeleteCurrentPreset = () => {
    if (!currentPreset || currentPreset.isDefault) return;
    const updated = localPresets.filter((p) => p.id !== currentPreset.id);
    setLocalPresets(updated);
    setSelectedPresetId(updated[0]?.id || 'completa');
  };

  const handleResetToDefault = () => {
    if (!currentPreset) return;
    const factoryDefault = DEFAULT_CLAUDE_PRESETS.find((p) => p.id === currentPreset.id);
    if (factoryDefault) {
      handleUpdateCurrentField('promptTemplate', factoryDefault.promptTemplate);
      handleUpdateCurrentField('name', factoryDefault.name);
      handleUpdateCurrentField('description', factoryDefault.description);
    } else {
      // Se for um custom, reseta pro padrão da revisão completa
      handleUpdateCurrentField('promptTemplate', DEFAULT_CLAUDE_PRESETS[0].promptTemplate);
    }
    setFeedback('Template restaurado para o original.');
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleSave = async (makeActive: boolean = false) => {
    const targetActiveId = makeActive ? selectedPresetId : activePresetId;
    await onSavePresets(localPresets, targetActiveId);
    setFeedback(makeActive ? 'Salvo e definido como ativo!' : 'Presets salvos com sucesso!');
    setTimeout(() => {
      setFeedback(null);
      onOpenChange(false);
    }, 600);
  };

  const renderedPreview = React.useMemo(() => {
    if (!currentPreset) return '';
    return interpolatePromptTemplate(currentPreset.promptTemplate, sampleVariables);
  }, [currentPreset, sampleVariables]);

  if (!currentPreset) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        container={container} 
        className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden"
        style={{
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(120, 120, 120, 0.35)',
          border: '1px solid rgba(120, 120, 120, 0.35)',
        }}
      >
        {/* Header */}
        <DialogHeader className="p-5 pb-4 border-b bg-muted/20">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">Configurar Presets de Revisão (Claude)</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Altere ou crie modelos de comando enviados ao Claude Desktop ao clicar em &quot;Abrir no Claude&quot;.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Body com Sidebar de Presets e Área de Edição */}
        <div className="flex-1 flex overflow-hidden min-h-[480px]">
          {/* Sidebar de Presets */}
          <div className="w-64 border-r bg-muted/10 p-3 flex flex-col gap-2 shrink-0 overflow-y-auto">
            <div className="flex items-center justify-between px-1 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Seus Presets
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCreateNewPreset}
                className="h-6 px-2 text-[11px] gap-1 cursor-pointer"
                title="Criar novo preset customizado"
              >
                <Plus className="w-3 h-3" />
                <span>Novo</span>
              </Button>
            </div>

            <div className="space-y-1">
              {localPresets.map((preset) => {
                const isSelected = preset.id === selectedPresetId;
                const isActive = preset.id === activePresetId;

                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setSelectedPresetId(preset.id);
                      setFeedback(null);
                    }}
                    className={`w-full text-left p-2.5 rounded-md text-xs transition-all flex flex-col gap-1 border cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-500/30 text-amber-950 dark:text-amber-100 font-medium'
                        : 'bg-background hover:bg-muted border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 w-full">
                      <span className="truncate font-semibold">{preset.name}</span>
                      {isActive && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 shrink-0">
                          Ativo
                        </Badge>
                      )}
                    </div>
                    {preset.description && (
                      <span className="text-[10px] text-muted-foreground line-clamp-1">
                        {preset.description}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Área Principal de Configuração */}
          <div className="flex-1 flex flex-col p-4 overflow-y-auto gap-3">
            {/* Metadados do Preset */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="preset-name" className="text-xs font-semibold">
                  Nome do Preset
                </Label>
                <Input
                  id="preset-name"
                  value={currentPreset.name}
                  onChange={(e) => handleUpdateCurrentField('name', e.target.value)}
                  className="h-8 text-xs"
                  placeholder="Ex: Revisão Express"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="preset-desc" className="text-xs font-semibold">
                  Descrição (Opcional)
                </Label>
                <Input
                  id="preset-desc"
                  value={currentPreset.description || ''}
                  onChange={(e) => handleUpdateCurrentField('description', e.target.value)}
                  className="h-8 text-xs"
                  placeholder="Ex: Focado em sanity check rápido"
                />
              </div>
            </div>

            {/* Helper de Variáveis Dinâmicas */}
            <div className="bg-muted/30 border rounded-md p-2.5 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                <Tag className="w-3.5 h-3.5" />
                <span>Variáveis Dinâmicas (clique para inserir no cursor):</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {PROMPT_VARIABLES_HELP.map((v) => (
                  <button
                    key={v.tag}
                    type="button"
                    onClick={() => handleInsertVariable(v.tag)}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono bg-background border hover:border-amber-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors cursor-pointer"
                    title={`Exemplo: ${v.example} (${v.label})`}
                  >
                    <span>{v.tag}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Tabs de Edição e Preview */}
            <div className="flex items-center justify-between border-b pb-1">
              <div className="flex items-center gap-1">
                <Button
                  variant={activeTab === 'editor' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveTab('editor')}
                  className="h-7 text-xs gap-1.5 cursor-pointer"
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>Editor de Prompt</span>
                </Button>
                <Button
                  variant={activeTab === 'preview' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveTab('preview')}
                  className="h-7 text-xs gap-1.5 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Pré-visualização (Live Preview)</span>
                </Button>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetToDefault}
                  className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1 cursor-pointer"
                  title="Restaurar prompt padrão de fábrica"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Restaurar Original</span>
                </Button>

                {!currentPreset.isDefault && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDeleteCurrentPreset}
                    className="h-7 px-2 text-[11px] text-red-500 hover:text-red-600 hover:bg-red-500/10 gap-1 cursor-pointer"
                    title="Excluir este preset customizado"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Excluir</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Conteúdo da Tab */}
            <div className="flex-1 min-h-[220px]">
              {activeTab === 'editor' ? (
                <Textarea
                  ref={textareaRef}
                  value={currentPreset.promptTemplate}
                  onChange={(e) => handleUpdateCurrentField('promptTemplate', e.target.value)}
                  className="h-full min-h-[240px] font-mono text-xs leading-relaxed resize-none p-3"
                  placeholder="Escreva o prompt a ser enviado ao Claude..."
                />
              ) : (
                <div className="h-full min-h-[240px] max-h-[320px] overflow-y-auto border rounded-md p-3 bg-muted/20 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-foreground select-text">
                  {renderedPreview}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="p-3 border-t bg-muted/20 flex items-center justify-between sm:justify-between">
          <div className="text-xs">
            {feedback && (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 animate-in fade-in-0 duration-150">
                <Check className="w-3.5 h-3.5" />
                {feedback}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSave(false)}
              className="text-xs cursor-pointer"
            >
              Salvar Alterações
            </Button>
            <Button
              size="sm"
              onClick={() => handleSave(true)}
              className="text-xs bg-amber-600 hover:bg-amber-700 text-white gap-1.5 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Salvar e Definir como Ativo</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
