import fs from 'fs';
import path from 'path';

const ROOT_DIR = path.resolve(import.meta.dirname || path.dirname(new URL(import.meta.url).pathname), '..');
const PACKAGE_JSON_PATH = path.join(ROOT_DIR, 'package.json');
const CHANGELOG_PATH = path.join(ROOT_DIR, 'CHANGELOG.md');
const OUTPUT_NOTES_PATH = path.join(ROOT_DIR, 'RELEASE_NOTES.md');

function extractReleaseNotes(): void {
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf-8'));
  const version = pkg.version;
  console.log(`🔍 Extraindo changelog para a versão v${version}...`);

  if (!fs.existsSync(CHANGELOG_PATH)) {
    console.warn('⚠️ CHANGELOG.md não encontrado. Criando nota básica...');
    fs.writeFileSync(OUTPUT_NOTES_PATH, `## Release v${version}\n\nVersão v${version} do Hydra Review.`);
    return;
  }

  const changelog = fs.readFileSync(CHANGELOG_PATH, 'utf-8');
  
  // Encontra a seção ## [versão] até a próxima ## [versão] ou fim do arquivo
  const versionHeaderPattern = new RegExp(`^##\\s+\\[?${version.replace(/\./g, '\\.')}\\]?.*$`, 'm');
  const match = changelog.match(versionHeaderPattern);

  if (!match || match.index === undefined) {
    console.warn(`⚠️ Não foi encontrada seção para a versão ${version} no CHANGELOG.md.`);
    fs.writeFileSync(OUTPUT_NOTES_PATH, `## Release v${version}\n\nVersão v${version} do Hydra Review.`);
    return;
  }

  const startIndex = match.index;
  const contentAfterHeader = changelog.slice(startIndex);
  
  // Procura o próximo "## "
  const nextHeaderMatch = contentAfterHeader.slice(match[0].length).match(/\n##\s+/);
  let sectionContent = '';
  
  if (nextHeaderMatch && nextHeaderMatch.index !== undefined) {
    sectionContent = contentAfterHeader.slice(0, match[0].length + nextHeaderMatch.index).trim();
  } else {
    sectionContent = contentAfterHeader.trim();
  }

  // Remove a linha do título "## 0.5.0" já que a Release do GitHub já tem o título
  const cleanedLines = sectionContent.split('\n');
  if (cleanedLines[0].startsWith('## ')) {
    cleanedLines.shift();
  }
  const finalNotes = cleanedLines.join('\n').trim();

  fs.writeFileSync(OUTPUT_NOTES_PATH, finalNotes, 'utf-8');
  console.log(`✅ Notas de release salvas em RELEASE_NOTES.md (${Buffer.byteLength(finalNotes, 'utf-8')} bytes):`);
  console.log('----------------------------------------------------');
  console.log(finalNotes);
  console.log('----------------------------------------------------');
}

extractReleaseNotes();
