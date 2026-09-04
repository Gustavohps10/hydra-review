# Arquitetura e Performance

Este documento detalha as principais decisões técnicas e de arquitetura tomadas durante a concepção do **Hydra Review**.

## 1. Identificação Flexível com Regex em vez de HTML puro
**Decisão:** Utilizar Expressões Regulares (`/(?:#|bug-|feature-)?(\d{4,6})/gi`) para varrer os elementos de texto no GitLab em vez de depender apenas de links estruturados.
**Por quê?** Os desenvolvedores escrevem os títulos dos MRs de várias maneiras (ex: `#77546`, `77546`, `bug-77546`). Uma Regex garante que a extração não seja frágil e consiga capturar o ID da tarefa independente dos prefixos informais adotados pelos times.

## 2. Buscas em Lote (Evitando o Problema N+1)
**Decisão:** Nunca buscar dados de usuários individualmente por tarefa. Em vez disso:
1. Pega-se todos os IDs listados na tela.
2. Faz-se uma busca em massa no endpoint `/issues.json?issue_id=...`.
3. Extraem-se apenas os `project_id`s únicos resultantes.
4. Faz-se chamadas `/projects/{id}/memberships.json` **apenas** para esses projetos únicos.
**Por quê?** Listagens no GitLab podem possuir até 100 MRs em uma tela (sem paginação contínua). Se para cada MR precisássemos buscar usuários no Redmine, estaríamos sujeitos a Rate Limits severos e um carregamento lento da UI. Ao transformar requests O(N) em O(Projetos Únicos), deixamos a extensão ultrarrápida.

## 3. Message Passing (Background vs Content)
**Decisão:** Os scripts de injeção (`gitlab.content.tsx`) não fazem os requests (via `fetch`) para as APIs do Redmine diretamente; eles utilizam `chrome.runtime.sendMessage` enviando as requisições para o `background.ts`.
**Por quê?** O GitLab possui regras estritas de Content Security Policy (CSP) que bloqueiam requests para domínios de terceiros (CORS). O `background.ts` não sofre dessas limitações de CSP da aba ativa, operando como um proxy perfeito para trafegar dados logados no Redmine de forma segura.

## 4. Estratégia de Renderização no DOM
**Decisão:** Em vez de dar um replace destrutivo nos elementos HTML originais do GitLab, nós criamos containers isolados anexados (`insertAdjacentElement`) aos nós já existentes.
**Por quê?** Isso evita que os scripts nativos (Vue/Vanilla do GitLab) quebrem ou apresentem "hydration errors" quando o DOM for mutado pela extensão. Mutações são estritamente aditivas.
