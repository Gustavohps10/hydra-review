#!/usr/bin/env node
/**
 * Setup Automático do MCP Hydra Review para o Claude Desktop
 * 
 * Este script detecta a instalação do Claude Desktop no sistema operacional,
 * localiza o arquivo de configuração (claude_desktop_config.json) e registra
 * o servidor hydra-review apontando para este repositório.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

const ROOT_DIR = path.resolve(import.meta.dirname || path.dirname(new URL(import.meta.url).pathname), '..');
const serverPath = path.resolve(ROOT_DIR, 'mcp', 'server.ts');
const exePath = path.resolve(ROOT_DIR, '.output', 'hydra-review-mcp.exe');

console.log('\n🚀 Configurando MCP Hydra Review no Claude Desktop...\n');
console.log(`📁 Servidor MCP (TypeScript): ${serverPath}`);

if (!fs.existsSync(serverPath)) {
  console.error(`❌ Erro: Arquivo server.ts não encontrado em ${serverPath}`);
  process.exit(1);
}

// Detecta possíveis locais do arquivo de configuração do Claude Desktop
const configPaths: string[] = [];
const platform = os.platform();

if (platform === 'win32') {
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');

  // 1. Instalação padrão (Roaming)
  configPaths.push(path.join(appData, 'Claude', 'claude_desktop_config.json'));

  // 2. Instalação Windows Store / MSIX (LocalCache)
  const packagesDir = path.join(localAppData, 'Packages');
  if (fs.existsSync(packagesDir)) {
    try {
      const entries = fs.readdirSync(packagesDir);
      for (const entry of entries) {
        if (entry.toLowerCase().startsWith('claude_')) {
          configPaths.push(
            path.join(packagesDir, entry, 'LocalCache', 'Roaming', 'Claude', 'claude_desktop_config.json')
          );
        }
      }
    } catch {}
  }
} else if (platform === 'darwin') {
  configPaths.push(path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'));
} else {
  configPaths.push(path.join(os.homedir(), '.config', 'Claude', 'claude_desktop_config.json'));
}

let configuredCount = 0;

for (const targetConfig of configPaths) {
  try {
    const configDir = path.dirname(targetConfig);
    
    // Se a pasta pai existir (ou se for o caminho primário do AppData), configura
    if (!fs.existsSync(configDir)) {
      if (targetConfig === configPaths[0]) {
        fs.mkdirSync(configDir, { recursive: true });
      } else {
        continue;
      }
    }

    let config: { mcpServers?: Record<string, any> } = { mcpServers: {} };

    if (fs.existsSync(targetConfig)) {
      try {
        const raw = fs.readFileSync(targetConfig, 'utf-8');
        if (raw.trim()) {
          config = JSON.parse(raw);
        }
      } catch {
        console.warn(`⚠️ Aviso: Não foi possível ler JSON em ${targetConfig}. Criando backup...`);
        fs.copyFileSync(targetConfig, `${targetConfig}.backup-${Date.now()}`);
        config = { mcpServers: {} };
      }
    }

    if (!config.mcpServers || typeof config.mcpServers !== 'object') {
      config.mcpServers = {};
    }

    const hasExe = fs.existsSync(exePath);

    // Se o executável compilado existir, usa ele diretamente (sem precisar de Node instalado)
    if (hasExe) {
      config.mcpServers['hydra-review'] = {
        command: exePath,
        args: [],
      };
      console.log(`✨ Configurado para utilizar o executável standalone:\n   ${exePath}`);
    } else {
      // Caso contrário, executa server.ts via npx tsx
      config.mcpServers['hydra-review'] = {
        command: 'npx',
        args: ['-y', 'tsx', serverPath],
      };
      console.log(`✨ Configurado para executar TypeScript via npx tsx:\n   ${serverPath}`);
    }

    fs.writeFileSync(targetConfig, JSON.stringify(config, null, 2), 'utf-8');
    console.log(`✅ Configuração salva em:\n   ${targetConfig}\n`);
    configuredCount++;
  } catch (err: any) {
    console.warn(`⚠️ Não foi possível salvar em ${targetConfig}:`, err.message);
  }
}

if (configuredCount > 0) {
  console.log(`🎉 Sucesso! Hydra Review MCP configurado em ${configuredCount} local(is) do Claude Desktop.`);
  console.log('👉 Reinicie o Claude Desktop para carregar as novas ferramentas.\n');
} else {
  console.log('ℹ️ Claude Desktop não parece estar instalado nos diretórios padrão.');
}
