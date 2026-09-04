# Hydra Review

O **Hydra Review** é uma extensão de navegador poderosa e não obstrusiva projetada para enriquecer a experiência de Code Review no GitLab. Ele identifica automaticamente IDs de tarefas do Redmine presentes nos títulos dos Merge Requests (MRs) e injeta informações valiosas diretamente na interface do GitLab, sem poluir a visão do desenvolvedor.

## 🚀 Funcionalidades

- **Identificação Automática:** Lê o título dos MRs (ex: `#76874`, `bug-76874`) e vincula à tarefa correspondente no Redmine.
- **Injeção de Metadados UI:** Exibe Status, Prioridade, Tracker (Bug, Funcionalidade, etc) e os Desenvolvedores responsáveis pela revisão.
- **Design Adaptativo e Limpo:** Suporta nativamente Dark/Light mode do GitLab usando Shadow DOM para isolar os estilos (Tailwind CSS) e não quebrar o layout da página original.
- **Alta Performance:** Executa a varredura da página em tempo `O(1)` no DOM e agrupa chamadas de rede para não sobrecarregar as APIs.
- **Tratamento de Permissões:** Identifica tarefas que o usuário não tem acesso (Erro 403) e exibe um alerta de forma controlada em vez de falhar de forma silenciosa.

## 🛠️ Tecnologias Utilizadas

- **WXT Framework:** Framework moderno para desenvolvimento de extensões.
- **React 18:** Para componentização das tooltips e badges (via `createRoot`).
- **Tailwind CSS + Shadcn UI:** Para estilo unificado e primitivas acessíveis de hover-cards.
- **TypeScript:** Garantindo tipagem estrita para dados de integração do GitLab e Redmine.

## 📦 Como rodar localmente (Dev)

1. Clone e instale as dependências:
   ```bash
   npm install
   ```
2. Para modo desenvolvimento (Hot Reload):
   ```bash
   npm run dev
   ```
3. Para build de produção:
   ```bash
   npm run build
   ```
4. No Chrome, acesse `chrome://extensions/`, ative o "Modo do desenvolvedor" e clique em "Carregar sem compactação", selecionando a pasta `.output/chrome-mv3`.

## 📚 Documentação e Decisões

Para entender a fundo o motivo das nossas escolhas arquiteturais e de design ao longo do projeto, consulte a pasta `/docs`:
- [Arquitetura e Performance](./docs/01-arquitetura-e-performance.md)
- [Design e UI/UX](./docs/02-decisoes-de-ui-ux.md)
