#!/usr/bin/env node
/**
 * Hydra Review MCP Server & Local Bridge para Claude Desktop
 * 
 * Funcionalidades:
 * 1. Protocolo MCP via stdio para o Claude Desktop.
 * 2. Bridge HTTP local em 127.0.0.1:47106 para a extensão enviar dados/arquivos diretamente (sem downloads no navegador).
 * 3. Gerenciamento de pasta temporária limpa em C:\Users\Gustavo\.hydra-review\tasks\{issueId}\.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';

const GITLAB_BASE_URL = 'http://gitlab2.atakone.com.br';
const GITLAB_TOKEN = 'xs34h5P5a7xn26NU8pj2';
const HTTP_PORT = 47106;

// Diretório base de tarefas temporárias
const BASE_CACHE_DIR = path.join(os.homedir(), '.hydra-review', 'tasks');

export interface SavedFileInfo {
  name: string;
  size: number;
  type: 'pdf' | 'diff' | 'markdown' | 'text';
}

export interface TaskSyncPayload {
  issueId: number;
  taskMarkdown?: string;
  pdfBase64?: string | null;
  diffs?: Array<{ name: string; content: string }>;
  metadata?: {
    subject?: string;
    status?: string;
    priority?: string;
    author?: string;
    assignee?: string;
    reviewer?: string;
    branch?: string;
    version?: string;
    description?: string;
  };
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getTaskDir(issueId: number | string): string {
  return path.join(BASE_CACHE_DIR, String(issueId));
}

function cleanTaskDir(issueId: number | string): string {
  const dir = getTaskDir(issueId);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  ensureDir(dir);
  return dir;
}

function clearAllCache(): void {
  if (fs.existsSync(BASE_CACHE_DIR)) {
    fs.rmSync(BASE_CACHE_DIR, { recursive: true, force: true });
  }
  ensureDir(BASE_CACHE_DIR);
}

function getCacheStats() {
  ensureDir(BASE_CACHE_DIR);
  const tasks = fs.readdirSync(BASE_CACHE_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  let totalBytes = 0;
  let totalFiles = 0;

  for (const taskId of tasks) {
    const taskPath = path.join(BASE_CACHE_DIR, taskId);
    const files = fs.readdirSync(taskPath, { withFileTypes: true }).filter(f => f.isFile());
    totalFiles += files.length;
    for (const f of files) {
      try {
        const stat = fs.statSync(path.join(taskPath, f.name));
        totalBytes += stat.size;
      } catch {}
    }
  }

  return {
    cacheDir: BASE_CACHE_DIR,
    taskCount: tasks.length,
    totalFiles,
    totalBytes,
    tasks,
  };
}

// -------------------------------------------------------------
// 1. Bridge HTTP Local (Comunicação direta com a extensão Chrome)
// -------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  // CORS Headers para a extensão conseguir se comunicar
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);

  // Endpoint: Status do cache
  if (req.method === 'GET' && url.pathname === '/api/status') {
    const stats = getCacheStats();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ running: true, ...stats }));
    return;
  }

  // Endpoint: Limpar todo o cache
  if (req.method === 'POST' && url.pathname === '/api/clear-cache') {
    clearAllCache();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Cache de tarefas temporárias limpo com sucesso.' }));
    return;
  }

  // Endpoint: Receber e salvar arquivos da tarefa da extensão
  if (req.method === 'POST' && url.pathname === '/api/task') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload: TaskSyncPayload = JSON.parse(body);
        const { issueId, taskMarkdown, pdfBase64, diffs, metadata } = payload;

        if (!issueId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'issueId é obrigatório' }));
          return;
        }

        // Limpa versão anterior para evitar arquivos obsoletos/lixo
        const taskDir = cleanTaskDir(issueId);
        const savedFiles: SavedFileInfo[] = [];

        // 1. Salva o Markdown completo estruturado da tarefa (tarefa-{issueId}.md)
        if (taskMarkdown) {
          const taskMdFileName = `tarefa-${issueId}.md`;
          const taskMdPath = path.join(taskDir, taskMdFileName);
          fs.writeFileSync(taskMdPath, taskMarkdown, 'utf-8');
          savedFiles.push({ name: taskMdFileName, size: Buffer.byteLength(taskMarkdown, 'utf-8'), type: 'markdown' });
        }

        // 2. Salva o PDF da tarefa (se enviado como legado)
        if (pdfBase64) {
          const pdfData = pdfBase64.replace(/^data:application\/pdf;base64,/, '');
          const pdfBuffer = Buffer.from(pdfData, 'base64');
          const pdfFileName = `tarefa-${issueId}.pdf`;
          const pdfPath = path.join(taskDir, pdfFileName);
          fs.writeFileSync(pdfPath, pdfBuffer);
          savedFiles.push({ name: pdfFileName, size: pdfBuffer.length, type: 'pdf' });
        }

        // 3. Salva cada arquivo de diff
        if (Array.isArray(diffs)) {
          for (const d of diffs) {
            if (d.name && d.content) {
              const diffPath = path.join(taskDir, d.name);
              fs.writeFileSync(diffPath, d.content, 'utf-8');
              savedFiles.push({ name: d.name, size: Buffer.byteLength(d.content, 'utf-8'), type: 'diff' });
            }
          }
        }

        // 4. Salva resumo-tarefa.md se enviado metadata e não houver taskMarkdown
        if (metadata && !taskMarkdown) {
          let summary = `# Metadados da Tarefa #${issueId} - ${metadata.subject || ''}\n\n`;
          summary += `- **Status:** ${metadata.status || 'N/A'}\n`;
          summary += `- **Prioridade:** ${metadata.priority || 'N/A'}\n`;
          summary += `- **Autor:** ${metadata.author || 'N/A'}\n`;
          summary += `- **Responsável:** ${metadata.assignee || 'Não atribuído'}\n`;
          summary += `- **Revisor:** ${metadata.reviewer || 'Nenhum'}\n`;
          summary += `- **Branch Solicitada:** ${metadata.branch || 'Não especificada'}\n`;
          summary += `- **Versão Solicitada:** ${metadata.version || 'Não especificada'}\n\n`;
          summary += `## Requisitos e Descrição\n\n${metadata.description || 'Sem descrição.'}\n`;

          const metaPath = path.join(taskDir, 'resumo-tarefa.md');
          fs.writeFileSync(metaPath, summary, 'utf-8');
          savedFiles.push({ name: 'resumo-tarefa.md', size: Buffer.byteLength(summary, 'utf-8'), type: 'markdown' });
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          issueId,
          folder: taskDir,
          files: savedFiles,
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: String(err) }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint não encontrado' }));
});

server.on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    // Outro processo do MCP Server já está escutando na porta
  } else {
    console.error('[HydraBridge] Erro no servidor HTTP:', err.message);
  }
});

server.listen(HTTP_PORT, '127.0.0.1', () => {
  console.error('\n┌─────────────────────────────────────────────────────────────┐');
  console.error('│  🚀 Hydra Review MCP Server ativo com sucesso!              │');
  console.error('│                                                             │');
  console.error(`│  👉 URL para configurar na extensão:                        │`);
  console.error(`│     http://127.0.0.1:${HTTP_PORT}                                  │`);
  console.error('│                                                             │');
  console.error(`│  📁 Pasta temporária de cache:                              │`);
  console.error(`│     ${BASE_CACHE_DIR}`);
  console.error('└─────────────────────────────────────────────────────────────┘\n');
});

// -------------------------------------------------------------
// 2. Helpers para busca direta no GitLab (Fallback se não enviado pela extensão)
// -------------------------------------------------------------
async function fetchGitLabMRsForIssue(issueId: number): Promise<any[]> {
  try {
    const url = `${GITLAB_BASE_URL}/api/v4/merge_requests?search=${issueId}&scope=all&per_page=50`;
    const res = await fetch(url, {
      headers: { 'PRIVATE-TOKEN': GITLAB_TOKEN, 'Accept': 'application/json' }
    });
    if (!res.ok) return [];
    const list = await res.json();
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

async function fetchMRChanges(projectId: number | string, mrIid: number | string): Promise<any | null> {
  try {
    const url = `${GITLAB_BASE_URL}/api/v4/projects/${projectId}/merge_requests/${mrIid}/changes`;
    const res = await fetch(url, {
      headers: { 'PRIVATE-TOKEN': GITLAB_TOKEN, 'Accept': 'application/json' }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function assembleUnifiedDiff(changes: any[]): string {
  if (!changes || !Array.isArray(changes) || changes.length === 0) {
    return 'Nenhum arquivo alterado.';
  }
  let out = '';
  for (const c of changes) {
    out += `diff --git a/${c.old_path} b/${c.new_path}\n`;
    if (c.new_file) out += `new file mode 100644\n`;
    if (c.deleted_file) out += `deleted file mode 100644\n`;
    out += `--- a/${c.old_path}\n+++ b/${c.new_path}\n`;
    out += (c.diff || '') + '\n\n';
  }
  return out.trim();
}

async function prepareTaskFromGitLab(issueId: number) {
  const taskDir = cleanTaskDir(issueId);
  const mrs = await fetchGitLabMRsForIssue(issueId);
  const savedFiles: SavedFileInfo[] = [];

  mrs.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  let summary = `# Resumo da Tarefa #${issueId} extraído do GitLab\n\n`;
  summary += `Foram encontrados **${mrs.length} Merge Request(s)** vinculados à tarefa no GitLab:\n\n`;

  for (const mr of mrs) {
    if (mr.state === 'closed') continue; // Ignora MRs descartados

    const repoName = mr.references?.full ? mr.references.full.split('!')[0].split('/').pop() : `project-${mr.project_id}`;
    summary += `### [${repoName}] MR !${mr.iid}: ${mr.title}\n`;
    summary += `- **Repositório:** \`${repoName}\` (ID: ${mr.project_id})\n`;
    summary += `- **Branch:** \`${mr.source_branch}\` ➔ \`${mr.target_branch}\`\n`;
    summary += `- **Status:** ${mr.state} | **Autor:** ${mr.author?.name || 'N/A'}\n\n`;

    const changes = await fetchMRChanges(mr.project_id, mr.iid);
    if (changes && changes.changes) {
      const diffContent = assembleUnifiedDiff(changes.changes);
      const fileName = `${repoName}-MR${mr.iid}-${mr.target_branch}.diff.txt`;
      fs.writeFileSync(path.join(taskDir, fileName), diffContent, 'utf-8');
      savedFiles.push({ name: fileName, size: Buffer.byteLength(diffContent, 'utf-8'), type: 'diff' });
    }
  }

  fs.writeFileSync(path.join(taskDir, 'resumo-tarefa.md'), summary, 'utf-8');
  savedFiles.push({ name: 'resumo-tarefa.md', size: Buffer.byteLength(summary, 'utf-8'), type: 'markdown' });

  return { taskDir, files: savedFiles };
}

// -------------------------------------------------------------
// 3. Protocolo MCP via Stdio (Claude Desktop)
// -------------------------------------------------------------
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

function sendResponse(id: any, result: any): void {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
}

function sendError(id: any, code: number, message: string): void {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n');
}

rl.on('line', async (line: string) => {
  if (!line.trim()) return;

  try {
    const request = JSON.parse(line);
    const { id, method, params } = request;

    switch (method) {
      case 'initialize': {
        sendResponse(id, {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'hydra-review', version: '2.0.0' },
        });
        break;
      }

      case 'notifications/initialized': {
        break;
      }

      case 'tools/list': {
        sendResponse(id, {
          tools: [
            {
              name: 'get_hydra_review_context',
              description: 'Obtém a lista de arquivos de contexto, requisitos completos com histórico de journals (tarefa-{issueId}.md) e diffs do Git extraídos para a pasta temporária da tarefa para realização de Code Review.',
              inputSchema: {
                type: 'object',
                properties: {
                  issueId: {
                    type: 'number',
                    description: 'Número da tarefa no Redmine/GitLab (ex: 75106)',
                  },
                },
                required: ['issueId'],
              },
            },
            {
              name: 'read_task_file',
              description: 'Lê o conteúdo completo de um dos arquivos de requisitos (.md) ou diff (.diff.txt) extraídos para a pasta temporária da tarefa.',
              inputSchema: {
                type: 'object',
                properties: {
                  issueId: {
                    type: 'number',
                    description: 'Número da tarefa (ex: 75106)',
                  },
                  filename: {
                    type: 'string',
                    description: 'Nome do arquivo a ler (ex: tarefa-75106.md, atak.frontend-master.diff.txt)',
                  },
                },
                required: ['issueId', 'filename'],
              },
            },
            {
              name: 'clear_task_cache',
              description: 'Limpa os arquivos temporários de uma tarefa específica ou de todo o cache.',
              inputSchema: {
                type: 'object',
                properties: {
                  issueId: {
                    type: 'number',
                    description: 'Número da tarefa a limpar (opcional; se omitido, limpa todo o cache temporário)',
                  },
                },
              },
            },
          ],
        });
        break;
      }

      case 'tools/call': {
        const toolName = params?.name;
        const args = params?.arguments || {};

        if (toolName === 'get_hydra_review_context') {
          const issueId = Number(args.issueId);
          if (!issueId) {
            sendResponse(id, { content: [{ type: 'text', text: 'Parâmetro issueId obrigatório.' }], isError: true });
            break;
          }

          const taskDir = getTaskDir(issueId);
          let files: SavedFileInfo[] = [];

          // Se a pasta já existir com arquivos gravados pela extensão, usa ela; senão, busca do GitLab
          if (fs.existsSync(taskDir)) {
            const existing = fs.readdirSync(taskDir, { withFileTypes: true }).filter(f => f.isFile());
            if (existing.length > 0) {
              files = existing.map(f => ({
                name: f.name,
                size: fs.statSync(path.join(taskDir, f.name)).size,
                type: f.name.endsWith('.pdf') ? 'pdf' : f.name.endsWith('.diff.txt') ? 'diff' : f.name.endsWith('.md') ? 'markdown' : 'text',
              }));
            }
          }

          if (files.length === 0) {
            const fallback = await prepareTaskFromGitLab(issueId);
            files = fallback.files;
          }

          let response = `# Contexto da Tarefa #${issueId} em Arquivos Temporários\n\n`;
          response += `📁 **Pasta dos Arquivos:** \`${taskDir}\`\n\n`;
          response += `### Arquivos Disponíveis para Revisão:\n`;
          for (const f of files) {
            const kb = (f.size / 1024).toFixed(1);
            response += `- **${f.name}** (${kb} KB) — _${f.type.toUpperCase()}_\n`;
          }
          response += `\n> 💡 **Instrução para Análise:**\n`;
          response += `> Você pode ler o arquivo de requisitos/journals (tarefa-${issueId}.md) ou os diffs completos de cada branch chamando a ferramenta \`read_task_file\` com o nome do arquivo desejado.\n\n`;

          // Se existir o arquivo tarefa-${issueId}.md, já anexa diretamente para o Claude ter os requisitos e journals completos
          const taskMdFile = path.join(taskDir, `tarefa-${issueId}.md`);
          const summaryFile = path.join(taskDir, 'resumo-tarefa.md');

          if (fs.existsSync(taskMdFile)) {
            response += `## Requisitos, Descrição e Histórico de Journals (tarefa-${issueId}.md)\n\n`;
            response += fs.readFileSync(taskMdFile, 'utf-8') + '\n\n';
          } else if (fs.existsSync(summaryFile)) {
            response += `## Resumo e Requisitos da Tarefa\n\n`;
            response += fs.readFileSync(summaryFile, 'utf-8') + '\n\n';
          }

          // Se existirem diffs e forem razoáveis, lista o cabeçalho de cada um
          const diffFiles = files.filter(f => f.type === 'diff');
          if (diffFiles.length > 0) {
            response += `## Diffs Prontos para Análise\n`;
            for (const df of diffFiles) {
              const content = fs.readFileSync(path.join(taskDir, df.name), 'utf-8');
              response += `### 📄 ${df.name}\n\`\`\`diff\n${content}\n\`\`\`\n\n`;
            }
          }

          sendResponse(id, { content: [{ type: 'text', text: response }] });
        } else if (toolName === 'read_task_file') {
          const issueId = Number(args.issueId);
          const filename = String(args.filename || '');
          const filePath = path.join(getTaskDir(issueId), filename);

          if (!fs.existsSync(filePath)) {
            sendResponse(id, { content: [{ type: 'text', text: `Arquivo ${filename} não encontrado para a tarefa #${issueId}.` }], isError: true });
            break;
          }

          if (filename.endsWith('.pdf')) {
            sendResponse(id, { content: [{ type: 'text', text: `Arquivo binário PDF (${filename}). O arquivo está localizado em: ${filePath}` }] });
          } else {
            const content = fs.readFileSync(filePath, 'utf-8');
            sendResponse(id, { content: [{ type: 'text', text: content }] });
          }
        } else if (toolName === 'clear_task_cache') {
          if (args.issueId) {
            cleanTaskDir(args.issueId);
            sendResponse(id, { content: [{ type: 'text', text: `Cache da tarefa #${args.issueId} limpo com sucesso.` }] });
          } else {
            clearAllCache();
            sendResponse(id, { content: [{ type: 'text', text: `Todo o cache temporário de tarefas foi limpo com sucesso.` }] });
          }
        } else {
          sendError(id, -32601, `Ferramenta não encontrada: ${toolName}`);
        }
        break;
      }

      default: {
        if (id !== undefined) {
          sendError(id, -32601, `Método não implementado: ${method}`);
        }
        break;
      }
    }
  } catch (err) {
    console.error('Erro no MCP:', err);
  }
});
