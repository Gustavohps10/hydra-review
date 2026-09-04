# Decisões de Design (UI/UX)

Este documento registra as escolhas visuais feitas para que a extensão agregue valor sem causar fadiga visual (ruído) ao longo do tempo.

## 1. Shadow DOM para Isolamento CSS
**Decisão:** Todos os componentes injetados pelo Hydra Review (como badges, ícones e popovers) usam `attachShadow({ mode: 'open' })`.
**Por quê?** O GitLab atualiza suas classes CSS com frequência. Se vazarmos Tailwind CSS global na página, correríamos o risco de quebrar botões do GitLab, ou ter nosso estilo quebrado por uma classe idêntica deles. O Shadow DOM encasula tudo, garantindo que o HoverCard renderize de forma perfeita 100% das vezes, adaptando-se a injeção ao estilo local via variáveis `:host`.

## 2. Skeleton Loaders Instantâneos
**Decisão:** Injetar Skeletons (elementos pulsantes acinzentados) no DOM antes mesmo da chamada na API do Redmine ser concluída.
**Por quê?** A percepção de performance. Assim que a página carrega, o usuário sabe exatamente quais MRs a extensão interceptou e que os metadados estão chegando. Assim que os dados chegam, a substituição dos Skeletons pela badge real ocorre sem saltos bruscos na interface.

## 3. Cores Semânticas Não-Invasivas (Água / Muted)
**Decisão:** Utilização de cores com fundos transparentes, bordas removidas e textos discretos na listagem principal:
- *Tracker (Bug, Funcionalidade):* Reduzidos a texto puro com `text-muted-foreground` neutro.
- *Prioridade Normal/Baixa:* Cinza/Slate (`#6B7280`). Invisível na leitura passiva, identificável na busca ativa.
- *Bugs:* Azul turquesa (Teal) no lugar de Vermelho, pois o vermelho causava "ansiedade" remetendo a quebra de Pipeline/Testes.
- *Aguardando Revisão/Em Revisão:* Tons de Violeta ou Âmbar suaves no lugar do Laranja "alerta".
**Por quê?** Menos é mais. O objetivo principal do GitLab List View é ler os títulos dos MRs. Elementos pesados (fundos coloridos vibrantes) competiam pela atenção do usuário e "poluíam" a tela. 

## 4. Resolução de Permissões (Erro 403)
**Decisão:** Criação de um `ErrorBadge` explícito (Logo cinza Redmine + texto em vermelho "Sem Acesso (403)").
**Por quê?** Originalmente a API do Redmine simplesmente não devolve tarefas restritas, fazendo com que a extensão as "ignorasse". Isso daria a falsa impressão de que a extensão quebrou. Expondo visualmente o 403, delegamos a culpa correta (credenciais insuficientes do Redmine), melhorando muito o Debug UX.
