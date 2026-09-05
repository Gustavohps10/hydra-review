<h2 align="center">
  <div align="center">
    <img height="100" src="./src/assets/logo.png" alt="Hydra Review Logo" />
  </div>

  Extensão inteligente para produtividade e visibilidade de Merge Requests e tarefas no GitLab.

</h2>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.5.1-blue.svg?style=flat-square" alt="Version 0.5.1" />
  <img src="https://img.shields.io/badge/TypeScript-007acc?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/platform-Chrome%20Extension-success.svg?style=flat-square" alt="Chrome Extension" />
  <img src="https://img.shields.io/badge/built%20with-WXT%20%7C%20React%20%7C%20Tailwind-blueviolet.svg?style=flat-square" alt="Tech Stack" />
</p>

---

## 🎯 O que é o Hydra Review?

O **Hydra Review** é uma extensão Chrome criada para acelerar a rotina de desenvolvimento e code review no GitLab. Ela conecta automaticamente os Merge Requests (MRs) às tarefas do Redmine e disponibiliza visibilidade imediata das branches e diffs sem fricção.

## 🚀 Principais Recursos

- **Vínculo Automático com Redmine:** Detecta IDs de tarefas em títulos ou branches de MRs (`#12345`, `feature/12345`) e exibe status, prioridade, autor e revisores em hover cards elegantes.
- **Rastreador de Branches & Diffs:** Exibe o status de cada branch de destino (`develop`, `release`, `master`) com badges diretos e métricas exatas de alterações (`X files`, `+Y -Z`) com link direto para a tela de diffs.
- **Isolamento Completo (Shadow DOM):** Interface moderna com Tailwind CSS e Shadcn UI injetada sem interferir nos estilos nativos do GitLab.
- **Suporte a Dark & Light Mode:** Cores e tipografia adaptadas harmonicamente ao tema do GitLab e da extensão.
- **Dashboard de Conexão Rápida:** Popup intuitivo para testar credenciais, reconectar serviços e inspecionar logs de execução em tempo real.

## 📦 Instalação

1. Baixe o pacote `.zip` da versão mais recente na aba de [Releases](https://github.com/Gustavohps10/hydra-review/releases).
2. Extraia o conteúdo em uma pasta no seu computador.
3. No Google Chrome, acesse `chrome://extensions/`.
4. Ative a chave **"Modo do desenvolvedor"** no canto superior direito.
5. Clique em **"Carregar sem compactação"** e selecione a pasta descompactada.
6. Abra o popup da extensão para configurar as URLs e tokens de acesso do GitLab e Redmine.

## 🛠️ Desenvolvimento Local

```bash
# Instalar dependências
npm install

# Modo desenvolvimento (com hot-reload)
npm run dev

# Gerar build de produção
npm run build

# Gerar pacote zip para distribuição
npm run zip
```

## 🤝 Fluxo de Trabalho & Releases (Git)

Consulte o documento oficial [GITFLOW.md](./GITFLOW.md) para entender a política de branches, uso do `changeset` para versionamento e como funciona o fluxo de Pull Requests e releases automáticas do projeto.

