# hydra-review

## 0.6.2

### Patch Changes

- 063af87: Adiciona ícone oficial do MCP com suporte a inversão de temas e cabeçalho com repositório GitHub e estrelas.

## 0.6.1

### Patch Changes

- 8776a70: Corrige truncamento de diffs do GitLab enviados ao servidor MCP e Claude, priorizando download de diff bruto nativo (.diff e /raw_diffs) sem colapso de arquivos grandes.
- c63884e: Remove tokens e credenciais hardcoded, garantindo que autenticação ocorra exclusivamente via configuracoes do usuario.

## 0.6.0

### Minor Changes

- 632ccef: Adiciona split button com presets de comando para o Claude Desktop e icone oficial no executavel MCP

## 0.5.1

### Patch Changes

- **CI/CD e Releases Automáticas**:
  - Compilação cross-platform do executável Windows (`hydra-review-mcp.exe`) em runners Linux (Ubuntu) no GitHub Actions via Node SEA e `postject`.
  - Inclusão automática do `.exe` junto do `.zip` nos assets das releases do GitHub.
  - Correção na extração e renderização das notas de release (changelog) no corpo da publicação.

## 0.5.0

### Minor Changes

- **Suporte a Multi-Repositório no Code Review (Front + Back + ERP)**:
  - Varredura e busca automática de todos os Merge Requests vinculados à tarefa no GitLab via `/api/v4/merge_requests?search=${issueId}`.
  - Download e consolidação dos diffs de cada repositório na pasta temporária com nomes identificando claramente o projeto (ex: `atak.frontend-MR1000-develop.diff.txt`, `atak.backend-MR1731-develop.diff.txt`, `erpv1-MR37-develop.diff.txt`).
  - Preservação total da interface visual do popover, mantendo estabilidade na navegação do GitLab.
- **Requisitos e Histórico Estruturado em Markdown (`tarefa-{issueId}.md`)**:
  - Substituição do arquivo binário PDF por documento Markdown estruturado extraído da API do Redmine (`include=journals,attachments,relations,children,changesets`).
  - Inclui descrição completa, campos personalizados (Critério de Validação, Sistema, Módulo, etc.), anexos com links diretos e histórico cronológico completo de discussões e alterações de campos (journals).
  - Seção dedicada listando todos os Merge Requests vinculados de todos os repositórios com links diretos no Redmine Markdown.
- **MCP Server Padronizado em TypeScript**:
  - Migração de 100% dos scripts e do servidor MCP de `.mjs` para TypeScript (`.ts`) com tipagem estática e execução via `tsx`.
  - Compilação automatizada para executável Windows standalone (`hydra-review-mcp.exe`) via Node SEA e `esbuild`.
  - Ferramenta MCP `get_hydra_review_context` embutindo automaticamente os requisitos e journals para análise imediata no Claude Desktop.

## 0.4.1

### Patch Changes

- **Identidade Visual & Ícones do Addon**:
  - Adicionado conjunto completo de ícones oficiais (`16x16`, `32x32`, `48x48`, `128x128`) configurados no manifest para exibição nativa no Chrome e barra de extensões.
  - Novo cabeçalho visual no popup com o logo oficial elegante, título e status de conexão.
- **Aprimoramentos de UI no Popup**:
  - Botão de reconectar renomeado para `"Reconectar"` (com ícone rotativo).
  - Botões de configuração com variante `outline` preservada para hierarquia visual limpa.
  - Cabeçalho padronizado e alinhado entre todas as telas (Configuração, Dashboard e Logs).
- **Documentação Renovada**:
  - `README.md` reestruturado com topo elegante, logo centralizado, badges de tecnologia e visão objetiva sem excessos técnicos.

## 0.4.0

### Minor Changes

- **Resumo de Diffs por Branch no Popover**:
  - Exibição da quantidade de arquivos alterados (`[ícone] X files`) e saldo de linhas (`+adicionadas`, `-removidas`) logo abaixo de cada branch (`develop`, `release`, `master`).
  - Layout elegante em 2 linhas alinhadas à esquerda, acomodando grandes volumes de alterações (ex: `+100.000` linhas) sem quebra indevida.
  - Link direto e clicável que navega para a página `/diffs` do Merge Request específico.
  - Extração de métricas de alta precisão via `diffs_metadata.json` (sessão ativa do navegador) com fallback para a API REST oficial (`/changes`).
  - Cache em memória inteligente para carregar instantaneamente sem chamadas repetidas.


## 0.3.0

### Minor Changes

- eea7cc6: Melhorias visuais na janela do popup e nova release:
  - Alinhamento dos 3 botões de ação na base do popup (Alterar Config, Retestar, Ver Logs)
  - Estilização do botão Alterar Config como outline e Retestar com destaque padrão
  - Versionamento automático da extensão sincronizado entre manifest e package.json

## 0.2.0

### Minor Changes

- 8d65a7b: Lançamento inicial da versão 0.1.0:
  - Integração de Merge Requests do GitLab com Redmine
  - Injeção de status, prioridade e tracker
  - Comparativo e validação de branches alvo (develop, release, master)
  - Exibição de branch e versão solicitadas na tarefa do Redmine
  - Skeletons animados imediatos e suporte a Dark/Light mode

## 0.1.0

### Minor Changes

- Lançamento inicial da versão 0.1.0:
  - Integração de Merge Requests do GitLab com tarefas do Redmine
  - Injeção inteligente de status, prioridade e tracker
  - Comparativo e validação de branches alvo (develop, release, master)
  - Exibição de branch solicitada e versão solicitada no popover
  - Skeletons animados imediatos e suporte a Dark/Light mode
