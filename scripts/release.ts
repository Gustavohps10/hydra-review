import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const ROOT_DIR = path.resolve(import.meta.dirname || path.dirname(new URL(import.meta.url).pathname), '..');

async function release(): Promise<void> {
  console.log('\n🚀 Iniciando processo de release do Hydra Review...\n');

  // 1. Build extension zip
  console.log('📦 Passo 1/3: Empacotando extensão para Chrome (.zip)...');
  execSync('npm run zip', { stdio: 'inherit', cwd: ROOT_DIR });

  // 2. Build MCP server (.exe)
  console.log('\n🔨 Passo 2/3: Compilando servidor MCP para Windows (.exe)...');
  execSync('npm run build:mcp', { stdio: 'inherit', cwd: ROOT_DIR });

  // 3. Notificar changesets/action se CHANGESETS_OUTPUT estiver definido
  if (process.env.CHANGESETS_OUTPUT) {
    console.log('\n📝 Passo 3/3: Registrando evento de publicação no CHANGESETS_OUTPUT...');
    const pkgPath = path.join(ROOT_DIR, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const event = JSON.stringify({
      type: 'git-tag',
      tag: `v${pkg.version}`,
      packageName: pkg.name,
    });
    fs.appendFileSync(process.env.CHANGESETS_OUTPUT, event + '\n', 'utf-8');
    console.log(`✅ Evento gravado: ${event}`);
  } else {
    console.log('\n✅ Passo 3/3: Execução local finalizada com sucesso!');
  }
}

release().catch((err) => {
  console.error('❌ Erro durante o processo de release:', err);
  process.exit(1);
});
