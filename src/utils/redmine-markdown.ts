/**
 * Utilitário para converter dados completos da API do Redmine (JSON)
 * em um documento estruturado Markdown legível e ideal para LLMs (Claude).
 */

export interface BuildTaskMarkdownOptions {
  cleanRedmineUrl?: string;
  responsavelRevisaoText?: string;
  redmineBranchValue?: string;
  redmineVersionValue?: string;
  linkedMRs?: any[];
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('pt-BR');
  } catch {
    return dateStr;
  }
}

export function buildTaskMarkdown(issue: any, options: BuildTaskMarkdownOptions = {}): string {
  if (!issue) return '# Tarefa não encontrada\n';

  const cleanUrl = (options.cleanRedmineUrl || 'http://redmine.atakone.com.br').replace(/\/$/, '');
  const reviewer = options.responsavelRevisaoText || 'Nenhum';
  const branch = options.redmineBranchValue || 'Não especificada';
  const version = options.redmineVersionValue || 'Não especificada';

  let md = `# Tarefa #${issue.id} - ${issue.subject || 'Sem título'}\n\n`;

  // 1. Cabeçalho de Metadados
  md += `## 📋 Informações Gerais\n`;
  md += `- **Link no Redmine:** ${cleanUrl}/issues/${issue.id}\n`;
  md += `- **Projeto:** ${issue.project?.name || 'N/A'}\n`;
  md += `- **Tipo (Tracker):** ${issue.tracker?.name || 'N/A'}\n`;
  md += `- **Status:** ${issue.status?.name || 'N/A'}\n`;
  md += `- **Prioridade:** ${issue.priority?.name || 'N/A'}\n`;
  md += `- **Autor:** ${issue.author?.name || 'N/A'}\n`;
  md += `- **Responsável Atual:** ${issue.assigned_to?.name || 'Não atribuído'}\n`;
  md += `- **Revisor Indicado:** ${reviewer}\n`;
  md += `- **Branch Solicitada:** ${branch}\n`;
  md += `- **Versão Solicitada:** ${version}\n`;
  md += `- **Data de Criação:** ${formatDate(issue.created_on)}\n`;
  md += `- **Última Atualização:** ${formatDate(issue.updated_on)}\n`;

  if (issue.start_date) md += `- **Data de Início:** ${issue.start_date}\n`;
  if (issue.due_date) md += `- **Data Limite:** ${issue.due_date}\n`;
  if (issue.estimated_hours) md += `- **Horas Estimadas:** ${issue.estimated_hours}h\n`;
  if (typeof issue.done_ratio === 'number') md += `- **Progresso:** ${issue.done_ratio}%\n`;

  md += `\n`;

  // 2. Campos Personalizados (Custom Fields)
  if (Array.isArray(issue.custom_fields) && issue.custom_fields.length > 0) {
    const relevantFields = issue.custom_fields.filter((cf: any) => {
      if (!cf.value) return false;
      if (Array.isArray(cf.value) && cf.value.length === 0) return false;
      // Ignora campos já exibidos no topo para evitar redundância
      const name = String(cf.name || '').toLowerCase();
      if (name.includes('branch') || name.includes('revisor') || name.includes('responsável revisão')) {
        return false;
      }
      return true;
    });

    if (relevantFields.length > 0) {
      md += `## 🏷️ Campos Personalizados\n`;
      for (const cf of relevantFields) {
        const val = Array.isArray(cf.value) ? cf.value.join(', ') : String(cf.value);
        md += `- **${cf.name}:** ${val}\n`;
      }
      md += `\n`;
    }
  }

  // 3. Subtarefas e Relações
  if (Array.isArray(issue.children) && issue.children.length > 0) {
    md += `## 🗂️ Subtarefas (${issue.children.length})\n`;
    for (const child of issue.children) {
      const childTracker = child.tracker?.name ? `[${child.tracker.name}] ` : '';
      const childStatus = child.status?.name ? `(Status: ${child.status.name})` : '';
      md += `- #${child.id} ${childTracker}${child.subject} ${childStatus}\n`;
    }
    md += `\n`;
  }

  if (Array.isArray(issue.relations) && issue.relations.length > 0) {
    md += `## 🔗 Relações (${issue.relations.length})\n`;
    for (const rel of issue.relations) {
      const targetId = rel.issue_to_id === issue.id ? rel.issue_id : rel.issue_to_id;
      md += `- ${rel.relation_type || 'Relacionada com'} #${targetId}\n`;
    }
    md += `\n`;
  }

  // 4. Anexos
  if (Array.isArray(issue.attachments) && issue.attachments.length > 0) {
    md += `## 📎 Anexos (${issue.attachments.length})\n`;
    for (const att of issue.attachments) {
      const sizeKb = att.filesize ? `${(att.filesize / 1024).toFixed(1)} KB` : '';
      const downloadUrl = att.content_url || `${cleanUrl}/attachments/download/${att.id}/${encodeURIComponent(att.filename)}`;
      const author = att.author?.name ? `por ${att.author.name}` : '';
      const desc = att.description ? ` — _${att.description}_` : '';
      md += `- [${att.filename}](${downloadUrl}) (${sizeKb}) ${author}${desc}\n`;
    }
    md += `\n`;
  }

  // 5. Merge Requests Vinculados (GitLab - Front, Back, ERP, etc.)
  if (Array.isArray(options.linkedMRs) && options.linkedMRs.length > 0) {
    md += `## 🔀 Merge Requests Vinculados (GitLab - ${options.linkedMRs.length})\n`;
    for (const mr of options.linkedMRs) {
      const ref = mr.references?.full || `!${mr.iid}`;
      const repo = mr.references?.full ? mr.references.full.split('!')[0].split('/').pop() : `project-${mr.project_id}`;
      const title = mr.title || 'Sem título';
      const status = mr.state === 'opened' ? '🟢 Aberto' : mr.state === 'merged' ? '🟣 Mesclado (Merged)' : '⚪ Fechado';
      const author = mr.author?.name ? ` por ${mr.author.name}` : '';
      const url = mr.web_url || '#';
      md += `- **[${ref}](${url})** — **${repo}** ➔ \`${mr.target_branch}\` [${status}]${author}\n`;
      md += `  _${title}_\n`;
    }
    md += `\n`;
  }

  // 6. Descrição e Requisitos da Tarefa
  md += `---
## 📝 Requisitos e Descrição da Tarefa

${(issue.description || 'Sem descrição informada no Redmine.').trim()}

`;

  // 6. Histórico Completo de Discussão e Journals
  if (Array.isArray(issue.journals) && issue.journals.length > 0) {
    const cfMap = new Map<string, string>();
    if (Array.isArray(issue.custom_fields)) {
      for (const cf of issue.custom_fields) {
        if (cf.id && cf.name) {
          cfMap.set(String(cf.id), cf.name);
        }
      }
    }

    const attrMap: Record<string, string> = {
      status_id: 'Status',
      assigned_to_id: 'Responsável',
      done_ratio: 'Progresso (%)',
      estimated_hours: 'Horas Estimadas',
      priority_id: 'Prioridade',
      tracker_id: 'Tipo de Tarefa',
      subject: 'Título',
      description: 'Descrição',
      start_date: 'Data Início',
      due_date: 'Data Limite',
      category_id: 'Categoria',
      fixed_version_id: 'Versão',
    };

    md += `---
## 💬 Histórico de Discussão e Journals (${issue.journals.length})

`;

    issue.journals.forEach((j: any, idx: number) => {
      const user = j.user?.name || 'Usuário do Redmine';
      const date = formatDate(j.created_on);
      const notes = (j.notes || '').trim();

      md += `### 🗨️ Comentário #${idx + 1} — ${user} (${date})\n\n`;

      if (notes) {
        md += `${notes}\n\n`;
      } else {
        md += `_Sem comentário textual._\n\n`;
      }

      if (Array.isArray(j.details) && j.details.length > 0) {
        md += `**Alterações registradas:**\n`;
        for (const det of j.details) {
          if (det.property === 'attachment') {
            md += `- **Anexo adicionado:** \`${det.new_value || det.name}\`\n`;
            continue;
          }

          let fieldLabel = det.name;
          if (det.property === 'cf' && cfMap.has(String(det.name))) {
            fieldLabel = cfMap.get(String(det.name))!;
          } else if (det.property === 'attr' && attrMap[det.name]) {
            fieldLabel = attrMap[det.name];
          }

          let oldVal = det.old_value !== null && det.old_value !== undefined && det.old_value !== '' ? String(det.old_value) : 'vazio';
          let newVal = det.new_value !== null && det.new_value !== undefined && det.new_value !== '' ? String(det.new_value) : 'vazio';

          // Se for string muito longa (ex: json bruto de checklist antigo), limita
          if (oldVal.length > 150) oldVal = oldVal.slice(0, 150) + '...';
          if (newVal.length > 150) newVal = newVal.slice(0, 150) + '...';

          md += `- **${fieldLabel}:** \`${oldVal}\` ➔ \`${newVal}\`\n`;
        }
        md += `\n`;
      }
    });
  }

  return md;
}
