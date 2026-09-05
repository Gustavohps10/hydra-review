import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import * as esbuild from 'esbuild';

const ROOT_DIR = path.resolve(import.meta.dirname || path.dirname(new URL(import.meta.url).pathname), '..');
const OUTPUT_DIR = path.join(ROOT_DIR, '.output');
const MCP_DIR = path.join(ROOT_DIR, 'mcp');

const ENTRY_FILE = path.join(MCP_DIR, 'server.ts');
const BUNDLE_FILE = path.join(MCP_DIR, 'bundle.cjs');
const SEA_CONFIG_FILE = path.join(MCP_DIR, 'sea-config.json');
const BLOB_FILE = path.join(MCP_DIR, 'sea-prep.blob');
const TARGET_EXE = path.join(OUTPUT_DIR, 'hydra-review-mcp.exe');

async function build(): Promise<void> {
  console.log('\n🔨 Compilando Hydra Review MCP Server (TypeScript -> .exe)...\n');

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // 1. Bundle com esbuild em formato CommonJS a partir do TypeScript
  console.log('📦 Passo 1/4: Gerando bundle CJS a partir de server.ts com esbuild...');
  await esbuild.build({
    entryPoints: [ENTRY_FILE],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    outfile: BUNDLE_FILE,
    banner: {
      js: '/* Hydra Review MCP Standalone (Compiled from TypeScript) */',
    },
  });

  // 2. Configuração SEA
  console.log('⚙️  Passo 2/4: Gerando blob binário do Node.js SEA...');
  const seaConfig = {
    main: path.relative(ROOT_DIR, BUNDLE_FILE).replace(/\\/g, '/'),
    output: path.relative(ROOT_DIR, BLOB_FILE).replace(/\\/g, '/'),
    disableExperimentalSEAWarning: true,
    useCodeCache: false,
  };
  fs.writeFileSync(SEA_CONFIG_FILE, JSON.stringify(seaConfig, null, 2), 'utf-8');

  execSync(`"${process.execPath}" --experimental-sea-config "${SEA_CONFIG_FILE}"`, {
    cwd: ROOT_DIR,
    stdio: 'inherit',
  });

  // 3. Copiar base node.exe para o arquivo de destino
  console.log(`📄 Passo 3/4: Copiando runtime Node para ${path.basename(TARGET_EXE)}...`);
  if (fs.existsSync(TARGET_EXE)) {
    try {
      fs.unlinkSync(TARGET_EXE);
    } catch {
      // No Windows, arquivos abertos podem ser renomeados mesmo quando não podem ser deletados diretamente
      try {
        const tempOld = `${TARGET_EXE}.${Date.now()}.old`;
        fs.renameSync(TARGET_EXE, tempOld);
      } catch {}
    }
  }
  fs.copyFileSync(process.execPath, TARGET_EXE);

  // 4. Injetar o blob no executável usando postject
  console.log('💉 Passo 4/4: Injetando recursos no executável com postject...');
  execSync(
    `npx postject "${TARGET_EXE}" NODE_SEA_BLOB "${BLOB_FILE}" --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`,
    {
      cwd: ROOT_DIR,
      stdio: 'inherit',
    }
  );

  // Limpeza de arquivos intermediários
  try {
    if (fs.existsSync(BUNDLE_FILE)) fs.unlinkSync(BUNDLE_FILE);
    if (fs.existsSync(SEA_CONFIG_FILE)) fs.unlinkSync(SEA_CONFIG_FILE);
    if (fs.existsSync(BLOB_FILE)) fs.unlinkSync(BLOB_FILE);
  } catch {}

  if (fs.existsSync(TARGET_EXE)) {
    const stats = fs.statSync(TARGET_EXE);
    const sizeMb = (stats.size / (1024 * 1024)).toFixed(1);
    console.log(`\n🎉 SUCESSO! Executável gerado a partir do TypeScript:`);
    console.log(`   📁 Caminho: ${TARGET_EXE}`);
    console.log(`   📊 Tamanho: ${sizeMb} MB`);
    console.log(`\n✨ O executável está ao lado do arquivo .zip em .output/!\n`);
  } else {
    console.error('\n❌ Erro: Falha ao gerar executável.');
    process.exit(1);
  }
}

build().catch((err) => {
  console.error('Erro na compilação:', err);
  process.exit(1);
});
