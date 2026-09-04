# hydra-review

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
