export const colorPalettes = {
  blue: { badge: '#3B82F6', background: '#3B82F626', text: '#60A5FA' },
  amber: { badge: '#F59E0B', background: '#F59E0B26', text: '#FBBF24' },
  violet: { badge: '#A78BFA', background: '#A78BFA26', text: '#C4B5FD' },
  pink: { badge: '#EC4899', background: '#EC489926', text: '#F472B6' },
  green: { badge: '#22C55E', background: '#22C55E26', text: '#4ADE80' },
  red: { badge: '#EF4444', background: '#EF444426', text: '#F87171' },
  orange: { badge: '#F97316', background: '#F9731626', text: '#FB923C' },
  teal: { badge: '#14B8A6', background: '#14B8A626', text: '#2DD4BF' },
  slate: { badge: '#64748B', background: '#64748B26', text: '#94A3B8' },
  
  priorityLowest: { badge: '#6B728080', background: 'transparent', text: '#6B7280' }, // very subtle gray
  priorityNormal: { badge: '#6B728080', background: 'transparent', text: '#6B7280' }, // very subtle gray
  priorityHigh: { badge: '#FB923C', background: '#FFF7ED', text: '#9A3412' }, 
  priorityUrgent: { badge: '#EF4444', background: '#EF444426', text: '#F87171' }, 
  priorityImmediate: { badge: '#B91C1C', background: '#B91C1C26', text: '#EF4444' }, 
};

export function getStatusConfig(statusId: number | string, statusName?: string) {
  const id = Number(statusId);
  const name = statusName?.toLowerCase() || '';

  if (name.includes('rejeitada')) return { icon: 'CircleX', colors: colorPalettes.red };
  if (name.includes('aguardando revisão')) return { icon: 'Eye', colors: colorPalettes.priorityNormal };
  if (name.includes('em revisão')) return { icon: 'Eye', colors: colorPalettes.amber };
  if (name.includes('andamento')) return { icon: 'Play', colors: colorPalettes.blue };

  switch (id) {
    case 1:
    case 25:
      return { icon: 'Timer', colors: colorPalettes.blue };
    case 2:
    case 20:
    case 8:
    case 10:
    case 26:
      return { icon: 'Zap', colors: colorPalettes.amber };
    case 24:
    case 28:
    case 7:
    case 9:
    case 11:
      return { icon: 'PauseCircle', colors: colorPalettes.orange };
    case 19:
    case 6:
    case 23:
    case 15:
      return { icon: 'CircleX', colors: colorPalettes.red };
    case 21:
    case 22:
    case 27:
    case 18:
    case 3:
    case 14:
      return { icon: 'CheckCircle2', colors: colorPalettes.green };
    case 12:
    case 13:
      return { icon: 'ArchiveX', colors: colorPalettes.slate };
    default:
      return { icon: 'HelpCircle', colors: colorPalettes.slate };
  }
}

export function getPriorityConfig(priorityId: number | string, priorityName?: string) {
  const id = Number(priorityId);
  const name = priorityName?.toLowerCase() || '';

  if (name.includes('baixa')) return { icon: 'ArrowDown', colors: colorPalettes.priorityLowest };
  if (name.includes('normal')) return { icon: 'Minus', colors: colorPalettes.priorityNormal };
  if (name.includes('alta')) return { icon: 'ArrowUp', colors: colorPalettes.priorityHigh };
  if (name.includes('urgente')) return { icon: 'AlertTriangle', colors: colorPalettes.priorityUrgent };
  if (name.includes('imediata')) return { icon: 'Siren', colors: colorPalettes.priorityImmediate };

  // Fallback to IDs if name doesn't match
  switch (id) {
    case 1:
    case 2:
      return { icon: 'ArrowDown', colors: colorPalettes.priorityLowest };
    case 3:
      return { icon: 'Minus', colors: colorPalettes.priorityNormal };
    case 4:
      return { icon: 'ArrowUp', colors: colorPalettes.priorityHigh };
    case 5:
    case 6:
      return { icon: 'AlertTriangle', colors: colorPalettes.priorityUrgent };
    default:
      return { icon: 'Minus', colors: colorPalettes.priorityNormal };
  }
}

export function getTrackerConfig(trackerId: number | string) {
  const id = Number(trackerId);
  switch (id) {
    case 1:
      return { icon: 'Bug', colors: colorPalettes.teal };
    case 2:
      return { icon: 'Star', colors: colorPalettes.violet };
    case 3:
      return { icon: 'LifeBuoy', colors: colorPalettes.blue };
    default:
      return { icon: 'Tag', colors: colorPalettes.slate };
  }
}
