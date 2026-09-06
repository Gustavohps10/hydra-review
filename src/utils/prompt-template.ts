import type { ClaudePromptPreset } from '@/types';

export interface PromptTemplateVariables {
  issueId: number | string;
  issueSubject: string;
  status: string;
  priority: string;
  author: string;
  assignee: string;
  reviewer: string;
  branch: string;
  version: string;
  redmineUrl: string;
  taskFile: string;
}

export const PROMPT_VARIABLES_HELP = [
  { tag: '{{issueId}}', label: 'ID da Tarefa', example: '77676' },
  { tag: '{{issueSubject}}', label: 'Título da Tarefa', example: 'ERP V2 > Módulos...' },
  { tag: '{{status}}', label: 'Status', example: 'AGUARDANDO REVISÃO' },
  { tag: '{{priority}}', label: 'Prioridade', example: 'Normal' },
  { tag: '{{author}}', label: 'Autor', example: 'Guilherme Kitagawa' },
  { tag: '{{assignee}}', label: 'Responsável', example: 'Lucas Calixto' },
  { tag: '{{reviewer}}', label: 'Revisor Indicado', example: 'Lucas Calixto' },
  { tag: '{{branch}}', label: 'Branch Solicitada', example: 'Develop - Trunk' },
  { tag: '{{version}}', label: 'Versão Solicitada', example: '2026.5.1.0' },
  { tag: '{{redmineUrl}}', label: 'Link do Redmine', example: 'http://redmine.../issues/77676' },
  { tag: '{{taskFile}}', label: 'Arquivo da Tarefa', example: 'tarefa-77676.md' },
];

export const DEFAULT_CLAUDE_PROMPT_TEMPLATE = `Você é um Engenheiro de Software Sênior especialista em Code Review.
Por favor, realize uma revisão da tarefa #{{issueId}} - {{issueSubject}}.

Utilize a ferramenta MCP \`get_hydra_review_context\` com \`issueId: {{issueId}}\` para obter todos os requisitos da tarefa ({{taskFile}} com descrição e histórico completo de journals) e os diffs do Git extraídos na pasta temporária. Use \`read_task_file\` para examinar o código e os diffs detalhadamente.

---
## 📋 Dados da Tarefa (Redmine #{{issueId}})
- **Título:** {{issueSubject}}
- **Status:** {{status}}
- **Prioridade:** {{priority}}
- **Autor:** {{author}}
- **Responsável:** {{assignee}}
- **Revisor Indicado:** {{reviewer}}
- **Branch Solicitada:** {{branch}}
- **Versão Solicitada:** {{version}}
- **Link no Redmine:** {{redmineUrl}}

---
## 🎯 Objetivo
Analise o material da tarefa (requisitos e histórico de journals em \`{{taskFile}}\`) e os diffs do Git em conjunto e faça uma **revisão objetiva da implementação**, verificando se o código atende ao que foi solicitado na tarefa.

### Avalie
🟢 **Pontos fortes**
* O que foi bem implementado.
* Decisões técnicas adequadas.
* Aderência aos requisitos e aos padrões existentes.

🟡 **Pontos de atenção**
* Possíveis melhorias.
* Trechos questionáveis ou que merecem revisão (aponte sempre o **caminho do arquivo**).
* Requisitos parcialmente atendidos.
* Riscos ou inconsistências que não necessariamente bloqueiam a entrega.

🔴 **Problemas**
* Bugs ou comportamentos incorretos (aponte sempre o **caminho do arquivo** e trecho relevante).
* Requisitos não atendidos.
* Regressões ou riscos relevantes.
* Problemas que deveriam ser corrigidos antes do merge.

### Checklist
Monte um checklist dos requisitos da tarefa e marque cada item como:
* 🟢 **Atendido**
* 🟡 **Parcial / precisa de atenção**
* 🔴 **Não atendido**
Para cada item, seja breve e cite o **caminho do arquivo** e trecho relevante quando necessário.

---
## 📑 Formato da Resposta
1. **Resumo geral** — poucas linhas, dizendo se a implementação está adequada.
2. **🟢 Pontos fortes**
3. **🟡 Pontos de atenção** (apontando sempre o caminho do arquivo)
4. **🔴 Problemas** (apontando sempre o caminho do arquivo)
5. **Checklist dos requisitos** (com caminho do arquivo de referência)
6. **Veredito final** — diga claramente se você aprovaria, aprovaria com ressalvas ou pediria alterações.

### ⚠️ Importante
Seja **direto ao ponto**. Não faça explicações longas ou genéricas. Foque exclusivamente no que pode ser comprovado pelo PDF/descrição e pelos diffs. **Não invente requisitos ou problemas.** Se algo não puder ser confirmado pelos materiais, indique isso explicitamente. Priorize problemas reais e relevantes em vez de sugerir melhorias de estilo ou preferências pessoais. Lembre-se de sempre apontar o **caminho do arquivo** ao referenciar qualquer trecho de código.
`;

export const QUICK_REVIEW_CLAUDE_PROMPT_TEMPLATE = `Você é um Engenheiro de Software realizando uma **Revisão Rápida (Sanity Check)** da tarefa #{{issueId}} - {{issueSubject}}.

Acesse os arquivos pelo MCP \`get_hydra_review_context\` (\`issueId: {{issueId}}\`) e avalie rapidamente \`{{taskFile}}\` e os diffs do Git na pasta temporária.

---
## 📋 Tarefa: #{{issueId}} - {{issueSubject}}
- **Branch:** {{branch}} | **Versão:** {{version}} | **Autor:** {{author}}

---
## ⚡ Foco da Revisão Rápida
Seja sintético e analise diretamente:
1. **Quebra de compilação ou regressões óbvias:** Há erros de sintaxe, imports inexistentes ou comportamentos quebrados nos diffs?
2. **Atendimento aos requisitos principais:** O que o autor fez atende ao escopo principal descrito em \`{{taskFile}}\`?
3. **Riscos críticos:** Há alterações perigosas em banco de dados, migrações ou métodos compartilhados?

## 📑 Resposta Esperada (Direto ao Ponto)
- **Status:** [APROVADO / REVISAR / REPROVADO]
- **Principais Achados:** Lista com bullets citando o arquivo e linha quando relevante.
- **Veredito:** 1 ou 2 frases objetivas.
`;

export const SECURITY_CLAUDE_PROMPT_TEMPLATE = `Você é um Especialista em Segurança de Software (AppSec) e Auditoria de Código.
Realize uma auditoria focada em **Segurança, Integridade e Tratamento de Erros** na tarefa #{{issueId}} - {{issueSubject}}.

Utilize a ferramenta MCP \`get_hydra_review_context\` com \`issueId: {{issueId}}\` e examine \`{{taskFile}}\` e os diffs do Git com \`read_task_file\`.

---
## 📋 Dados da Tarefa
- **#{{issueId}}:** {{issueSubject}}
- **Branch:** {{branch}} | **Autor:** {{author}} | **Responsável:** {{assignee}}

---
## 🛡️ Vetores de Auditoria Obrigatórios
1. **Injeção de SQL / Sanitização:** Todas as queries SQL ou chamadas dinâmicas utilizam bind parameters? Há risco de concatenação de strings?
2. **Autorização e Permissões:** O acesso aos novos endpoints, regras de negócio ou telas valida adequadamente permissões de usuário / tenant?
3. **Exposição de Dados Sensíveis:** Há logs expondo senhas, tokens, dados fiscais, CPF ou chaves em texto claro?
4. **Tratamento de Exceções & Transações:** Blocos \`try/catch\` ou transações de banco (\`BEGIN/COMMIT/ROLLBACK\`) deixam conexões abertas ou transações pendentes em caso de falha?
5. **Validação de Entradas (Payloads):** Parâmetros nulos, vazios ou fora do padrão podem derrubar o serviço ou gerar loops infinitos?

## 📑 Formato do Relatório
1. **Resumo de Risco:** [BAIXO / MÉDIO / ALTO / CRÍTICO]
2. **Vulnerabilidades Detectadas:** (Citar arquivo, linha e explicação objetiva do risco)
3. **Recomendações de Correção:** (Exemplo de código seguro para cada item apontado)
`;

export const DEFAULT_CLAUDE_PRESETS: ClaudePromptPreset[] = [
  {
    id: 'completa',
    name: 'Padrão (Revisão Completa)',
    description: 'Checklist detalhado, pontos fortes, atenção, problemas e veredito.',
    promptTemplate: DEFAULT_CLAUDE_PROMPT_TEMPLATE,
    isDefault: true,
  },
  {
    id: 'rapida',
    name: 'Revisão Rápida (Sanity Check)',
    description: 'Foco direto em regressões óbvias, diffs principais e riscos imediatos.',
    promptTemplate: QUICK_REVIEW_CLAUDE_PROMPT_TEMPLATE,
    isDefault: true,
  },
  {
    id: 'seguranca',
    name: 'Auditoria de Segurança & SQL',
    description: 'Foco em injeção de SQL, transações, vazamento de dados e tratamento de erros.',
    promptTemplate: SECURITY_CLAUDE_PROMPT_TEMPLATE,
    isDefault: true,
  },
];

/**
 * Interpola as variáveis {{variavel}} no template de prompt.
 */
export function interpolatePromptTemplate(
  template: string,
  variables: PromptTemplateVariables
): string {
  let result = template;
  
  result = result.replace(/\{\{issueId\}\}/g, String(variables.issueId || ''));
  result = result.replace(/\{\{issueSubject\}\}/g, variables.issueSubject || '');
  result = result.replace(/\{\{status\}\}/g, variables.status || '');
  result = result.replace(/\{\{priority\}\}/g, variables.priority || '');
  result = result.replace(/\{\{author\}\}/g, variables.author || '');
  result = result.replace(/\{\{assignee\}\}/g, variables.assignee || '');
  result = result.replace(/\{\{reviewer\}\}/g, variables.reviewer || '');
  result = result.replace(/\{\{branch\}\}/g, variables.branch || '');
  result = result.replace(/\{\{version\}\}/g, variables.version || '');
  result = result.replace(/\{\{redmineUrl\}\}/g, variables.redmineUrl || '');
  result = result.replace(/\{\{taskFile\}\}/g, variables.taskFile || '');

  return result;
}
