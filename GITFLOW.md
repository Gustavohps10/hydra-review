# Fluxo de Desenvolvimento e Releases (Git & Changesets)

Este documento é o guia oficial de padronização para desenvolvedores e revisores do projeto **Hydra Review**.

---

## 🎯 Filosofia: Trunk-Based Development com Changesets

No **Hydra Review**, adotamos o modelo **Trunk-Based** assistido por **Changesets**:
- A branch de integração contínua é a **`main`**.
- **Nenhum desenvolvedor edita manualmente o `package.json` ou o `CHANGELOG.md`** ao desenvolver uma funcionalidade.
- A decisão da versão (`patch`, `minor`, `major`) e o texto descritivo são registrados através do CLI do **Changesets**.
- Releases de produção (geração de tag, compilação da extensão `.zip` e executável `.exe`) só acontecem quando o PR oficial de release gerado pelo robô é aceito.

---

## 🚀 Ciclo de Vida de uma Tarefa (Passo a Passo do Dev)

### 1. Atualizar a `main` e criar sua branch
Sempre inicie sua tarefa a partir da `main` mais recente:
```bash
git checkout main
git pull origin main
git checkout -b feature/nome-da-sua-tarefa
# ou fix/nome-do-bug
```

### 2. Desenvolver o código
Faça seu trabalho normalmente, escrevendo seu código, componentes e testes.

### 3. Registrar a Alteração com o Changeset (Obrigatório)
Quando terminar o desenvolvimento e estiver pronto para abrir o Pull Request, execute:
```bash
npm run changeset
```
*(Ou `npx changeset`)*

O assistente no terminal fará 3 perguntas:
1. **Qual pacote foi alterado?**  
   - Pressione `Espaço` para selecionar `hydra-review` e aperte `Enter`.
2. **Qual é o tipo de versionamento?**
   - **`patch`**: Correções de bugs, pequenas melhorias internas que não adicionam novas funções para o usuário (Ex: `0.5.1` ➔ `0.5.2`).
   - **`minor`**: Novas funcionalidades, novas telas ou campos retrocompatíveis (Ex: `0.5.1` ➔ `0.6.0`).
   - **`major`**: Mudanças críticas que quebram retrocompatibilidade (Ex: `0.5.1` ➔ `1.0.0`).
3. **Mensagem do Changelog**:  
   - Escreva uma mensagem clara, objetiva e em português descrevendo o que mudou sob a ótica do usuário final.
   - *Evite*: "ajustes", "wip", "commit".
   - *Prefira*: "Adiciona suporte à captura automática de MRs do repositório ERP".

> 💡 **O que isso gera?**  
> Um arquivo markdown com nome aleatório único na pasta `.changeset/` (ex: `.changeset/warm-foxes-sing.md`).

### 4. Comitar e Abrir o Pull Request
Comite o arquivo do changeset junto com o seu código:
```bash
git add .
git commit -m "feat: adiciona captura de MRs do ERP"
git push origin feature/nome-da-sua-tarefa
```
Abra o Pull Request direcionado para a branch **`main`**.

---

## 🔍 Guia para Revisores de Código

Ao revisar um Pull Request:
1. **Verifique se há um arquivo `.changeset/*.md` incluído no PR**:
   - Se a alteração traz novo comportamento ou conserta um bug, o PR **deve** conter um changeset.
   - Se for uma alteração estritamente interna (ex: arrumando documentação ou comentário), o changeset pode ser dispensado.
2. **Avalie o tipo semântico escolhido**:
   - Verifique se o autor escolheu corretamente entre `patch`, `minor` ou `major`.
3. **Aprovação**:
   - Aprove e faça o **Merge** na `main` usando *Squash and Merge* ou *Rebase and Merge*.

---

## 🤖 O Papel do Robô no Lançamento de Releases

Assim que um PR com changeset entra na `main`:

1. **GitHub Actions acorda automaticamente**:
   - O robô do Changesets lê todos os arquivos `.changeset/*.md` pendentes na `main`.
2. **O PR `chore: release packages`**:
   - O robô abre (ou atualiza, se já existir) um Pull Request automático chamado:  
     `chore: release packages`
   - Esse PR acumula as alterações de todos os desenvolvedores que mergearam tarefas recentemente.
   - Ele calcula sozinho a nova versão no `package.json` e consolida o `CHANGELOG.md`.
3. **Publicação Oficial (Produção)**:
   - Quando o Tech Lead ou Release Manager decide que é hora de liberar a versão para os usuários:
     - Ele acessa o PR `chore: release packages` no GitHub e clica em **Merge**.
   - Ao mergear esse PR:
     - Uma **Tag Git** oficial é criada (ex: `v0.6.0`).
     - A extensão do Chrome é empacotada em `.zip`.
     - O servidor MCP do Windows é compilado como executável nativo (`hydra-review-mcp.exe`).
     - A **GitHub Release** é publicada com os binários e notas da versão prontas para download.

---

## ❓ Perguntas Frequentes (FAQ)

### E se vários devs abrirem PRs com `minor` ao mesmo tempo?
Não há nenhum conflito. O Changesets soma todas as alterações. Se 5 features `minor` entrarem na `main` antes do lançamento, a versão subirá apenas uma minor (ex: `0.5.1` ➔ `0.6.0`), e o changelog conterá os 5 itens agrupados.

### Esqueci de gerar o changeset e o PR já foi mergeado na `main`. O que fazer?
Basta criar uma branch rápida a partir da `main`, rodar `npm run changeset`, descrever a alteração pendente e abrir um PR rápido para a `main`. O robô capturará a alteração normalmente.

### Minha alteração é apenas um ajuste no README ou no CI. Preciso de changeset?
Não. Alterações que não afetam o código do produto final não precisam de changeset. O PR pode ser aceito normalmente sem gerar versão.
