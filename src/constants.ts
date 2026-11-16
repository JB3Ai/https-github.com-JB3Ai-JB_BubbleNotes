import {
  AppConfig,
  BubbleCategory,
  BubbleColorId,
  BubbleImportance,
  CategoryMap,
  CategoryMeta,
  ImportanceMeta,
  JellyfishColorMeta,
  BubbleNote,
  DeadlineInfo,
} from './types';

// Iridescent Liquid Metal & Aurora Spheres Palette
export const JELLYFISH_COLORS: Record<BubbleColorId, JellyfishColorMeta> = {
  cyan: {
    id: 'cyan',
    name: 'Aurora Cyan',
    color: '#22D3EE',
    glowColor: 'rgba(34, 211, 238, 0.50)',
    coreColor: 'rgba(103, 232, 249, 0.48)',
    accentColor: '#A5F3FC',
    membraneColor: 'rgba(34, 211, 238, 0.16)',
    auroraSecondary: '#6366F1',
    metalTint: '#D8F8FF',
    textColor: '#ECFEFF',
  },
  violet: {
    id: 'violet',
    name: 'Dichroic Violet',
    color: '#A855F7',
    glowColor: 'rgba(168, 85, 247, 0.50)',
    coreColor: 'rgba(216, 180, 254, 0.46)',
    accentColor: '#E9D5FF',
    membraneColor: 'rgba(168, 85, 247, 0.16)',
    auroraSecondary: '#22D3EE',
    metalTint: '#F3E8FF',
    textColor: '#FAF5FF',
  },
  rose: {
    id: 'rose',
    name: 'Prism Rose',
    color: '#FB7185',
    glowColor: 'rgba(251, 113, 133, 0.50)',
    coreColor: 'rgba(253, 164, 175, 0.46)',
    accentColor: '#FECDD3',
    membraneColor: 'rgba(251, 113, 133, 0.16)',
    auroraSecondary: '#F59E0B',
    metalTint: '#FFE4E6',
    textColor: '#FFF1F2',
  },
  emerald: {
    id: 'emerald',
    name: 'Emerald Plasma',
    color: '#34D399',
    glowColor: 'rgba(52, 211, 153, 0.48)',
    coreColor: 'rgba(110, 231, 183, 0.44)',
    accentColor: '#A7F3D0',
    membraneColor: 'rgba(52, 211, 153, 0.16)',
    auroraSecondary: '#38BDF8',
    metalTint: '#DCFCE7',
    textColor: '#ECFDF5',
  },
  blue: {
    id: 'blue',
    name: 'Cobalt Chrome',
    color: '#60A5FA',
    glowColor: 'rgba(96, 165, 250, 0.50)',
    coreColor: 'rgba(147, 197, 253, 0.46)',
    accentColor: '#BFDBFE',
    membraneColor: 'rgba(96, 165, 250, 0.16)',
    auroraSecondary: '#818CF8',
    metalTint: '#DBEAFE',
    textColor: '#EFF6FF',
  },
  amber: {
    id: 'amber',
    name: 'Solar Amber',
    color: '#F59E0B',
    glowColor: 'rgba(245, 158, 11, 0.48)',
    coreColor: 'rgba(253, 224, 71, 0.42)',
    accentColor: '#FDE68A',
    membraneColor: 'rgba(245, 158, 11, 0.15)',
    auroraSecondary: '#FB7185',
    metalTint: '#FEF3C7',
    textColor: '#FFFBEB',
  },
  magenta: {
    id: 'magenta',
    name: 'Orchid Quartz',
    color: '#E879F9',
    glowColor: 'rgba(232, 121, 249, 0.50)',
    coreColor: 'rgba(240, 171, 252, 0.46)',
    accentColor: '#F5D0FE',
    membraneColor: 'rgba(232, 121, 249, 0.16)',
    auroraSecondary: '#38BDF8',
    metalTint: '#FAE8FF',
    textColor: '#FDF4FF',
  },
  pearl: {
    id: 'pearl',
    name: 'Liquid Pearl',
    color: '#CBD5E1',
    glowColor: 'rgba(203, 213, 225, 0.42)',
    coreColor: 'rgba(241, 245, 249, 0.40)',
    accentColor: '#F8FAFC',
    membraneColor: 'rgba(203, 213, 225, 0.15)',
    auroraSecondary: '#67E8F9',
    metalTint: '#F8FAFC',
    textColor: '#F8FAFC',
  },
};

export const JELLYFISH_COLOR_LIST: JellyfishColorMeta[] = Object.values(JELLYFISH_COLORS);

export const CATEGORY_DEFAULT_COLOR: Record<BubbleCategory, BubbleColorId> = {
  bills: 'rose',
  income: 'emerald',
  family: 'magenta',
  work: 'blue',
  ideas: 'violet',
  personal: 'amber',
  general: 'pearl',
};

export function getBubbleTheme(note: Pick<BubbleNote, 'category' | 'color'>): JellyfishColorMeta {
  if (note.color && JELLYFISH_COLORS[note.color]) {
    return JELLYFISH_COLORS[note.color];
  }
  const fallbackColor = CATEGORY_DEFAULT_COLOR[note.category] || 'cyan';
  return JELLYFISH_COLORS[fallbackColor];
}

export const CATEGORIES: Record<BubbleCategory, CategoryMeta> = {
  bills: {
    id: 'bills',
    name: 'Bills & Expenses',
    description: 'Urgent payments & bills',
    color: '#FB7185',
    glowColor: 'rgba(251, 113, 133, 0.45)',
    accentColor: '#FECDD3',
    membraneColor: 'rgba(251, 113, 133, 0.16)',
    textColor: '#FFE4E6',
  },
  income: {
    id: 'income',
    name: 'Money In & Opps',
    description: 'Income, deals & opportunities',
    color: '#34D399',
    glowColor: 'rgba(52, 211, 153, 0.45)',
    accentColor: '#A7F3D0',
    membraneColor: 'rgba(52, 211, 153, 0.16)',
    textColor: '#D1FAE5',
  },
  family: {
    id: 'family',
    name: 'Kids & Family',
    description: 'Family activities & kids',
    color: '#E879F9',
    glowColor: 'rgba(232, 121, 249, 0.45)',
    accentColor: '#F5D0FE',
    membraneColor: 'rgba(232, 121, 249, 0.16)',
    textColor: '#FAE8FF',
  },
  work: {
    id: 'work',
    name: 'Work',
    description: 'Professional projects & deliverables',
    color: '#60A5FA',
    glowColor: 'rgba(96, 165, 250, 0.45)',
    accentColor: '#BFDBFE',
    membraneColor: 'rgba(96, 165, 250, 0.16)',
    textColor: '#DBEAFE',
  },
  ideas: {
    id: 'ideas',
    name: 'Ideas',
    description: 'Creative thoughts & inspirations',
    color: '#A855F7',
    glowColor: 'rgba(168, 85, 247, 0.45)',
    accentColor: '#E9D5FF',
    membraneColor: 'rgba(168, 85, 247, 0.16)',
    textColor: '#F3E8FF',
  },
  personal: {
    id: 'personal',
    name: 'Personal',
    description: 'Health, wellness & personal life',
    color: '#F59E0B',
    glowColor: 'rgba(245, 158, 11, 0.45)',
    accentColor: '#FDE68A',
    membraneColor: 'rgba(245, 158, 11, 0.16)',
    textColor: '#FEF3C7',
  },
  general: {
    id: 'general',
    name: 'General',
    description: 'Miscellaneous tasks & notes',
    color: '#CBD5E1',
    glowColor: 'rgba(203, 213, 225, 0.35)',
    accentColor: '#F1F5F9',
    membraneColor: 'rgba(203, 213, 225, 0.15)',
    textColor: '#F8FAFC',
  },
};

export const IMPORTANCE_LEVELS: Record<BubbleImportance, ImportanceMeta> = {
  1: {
    level: 1,
    name: 'Tiny',
    baseRadius: 48,
    mass: 0.7,
    label: 'Low Priority',
  },
  2: {
    level: 2,
    name: 'Small',
    baseRadius: 60,
    mass: 1.0,
    label: 'Standard',
  },
  3: {
    level: 3,
    name: 'Medium',
    baseRadius: 74,
    mass: 1.4,
    label: 'Important',
  },
  4: {
    level: 4,
    name: 'Large',
    baseRadius: 90,
    mass: 1.9,
    label: 'High Priority',
  },
  5: {
    level: 5,
    name: 'Critical',
    baseRadius: 110,
    mass: 2.6,
    label: 'Critical Focus',
  },
};

// Helper: Calculate dynamic bubble radius based on importance and text content length
export function calculateDynamicBubbleRadius(
  importance: BubbleImportance,
  title: string = '',
  fullNote?: string
): number {
  const baseRadius = (IMPORTANCE_LEVELS[importance] || IMPORTANCE_LEVELS[3]).baseRadius;
  const titleLen = title.trim().length;
  const noteLen = fullNote ? fullNote.trim().length : 0;
  const totalLen = titleLen + noteLen;

  if (totalLen <= 30) {
    return baseRadius;
  }

  const extraRadius = Math.min(24, Math.round((totalLen - 30) * 0.14));
  return baseRadius + extraRadius;
}

// Helper: Format Age floating in tank
export function getFloatingAgeText(createdAt: number): string {
  const now = Date.now();
  const diffMs = Math.max(0, now - createdAt);
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffDays === 0) {
    if (diffHours === 0) {
      if (diffMinutes < 2) return 'Just born';
      return `${diffMinutes}m floating`;
    }
    return `${diffHours}h floating`;
  }
  if (diffDays === 1) {
    return '1 day floating';
  }
  return `${diffDays} days floating`;
}

// Helper: Format Deadline Countdown
export function getDeadlineInfo(deadlineDateStr?: string): DeadlineInfo {
  if (!deadlineDateStr) {
    return {
      status: 'none',
      badgeText: '',
      daysRemaining: 999,
      urgencyLevel: 0,
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [year, month, day] = deadlineDateStr.split('-').map(Number);
  const targetDate = new Date(year, month - 1, day);
  targetDate.setHours(0, 0, 0, 0);

  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    return {
      status: 'overdue',
      badgeText: overdueDays === 1 ? 'Overdue by 1 day' : `Overdue by ${overdueDays} days`,
      daysRemaining: diffDays,
      urgencyLevel: 3,
    };
  }

  if (diffDays === 0) {
    return {
      status: 'today',
      badgeText: 'Today',
      daysRemaining: 0,
      urgencyLevel: 3,
    };
  }

  if (diffDays === 1) {
    return {
      status: 'tomorrow',
      badgeText: 'Tomorrow',
      daysRemaining: 1,
      urgencyLevel: 2,
    };
  }

  if (diffDays <= 3) {
    return {
      status: 'urgent',
      badgeText: `${diffDays} days left`,
      daysRemaining: diffDays,
      urgencyLevel: 2,
    };
  }

  if (diffDays <= 7) {
    return {
      status: 'approaching',
      badgeText: `${diffDays} days left`,
      daysRemaining: diffDays,
      urgencyLevel: 1,
    };
  }

  return {
    status: 'future',
    badgeText: `${diffDays} days left`,
    daysRemaining: diffDays,
    urgencyLevel: 0,
  };
}

export function getRelativeDeadlineDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function mergeBubbleNotes(targetNote: BubbleNote, sourceNote: BubbleNote): BubbleNote {
  const combinedImportance = Math.min(
    5,
    targetNote.importance + sourceNote.importance
  ) as BubbleImportance;

  const combinedTitle = `${targetNote.title} + ${sourceNote.title}`;

  const details: string[] = [];
  if (targetNote.fullNote?.trim()) {
    details.push(targetNote.fullNote.trim());
  }
  if (sourceNote.fullNote?.trim()) {
    details.push(sourceNote.fullNote.trim());
  }
  const combinedFullNote = details.length > 0 ? details.join('\n\n---\n') : undefined;

  let combinedCategory = targetNote.category;
  if (sourceNote.importance > targetNote.importance) {
    combinedCategory = sourceNote.category;
  } else if (targetNote.category === 'general' && sourceNote.category !== 'general') {
    combinedCategory = sourceNote.category;
  }

  let combinedDeadline = targetNote.deadline;
  if (sourceNote.deadline && !targetNote.deadline) {
    combinedDeadline = sourceNote.deadline;
  } else if (sourceNote.deadline && targetNote.deadline) {
    combinedDeadline = sourceNote.deadline < targetNote.deadline ? sourceNote.deadline : targetNote.deadline;
  }

  let combinedColor = targetNote.color;
  if (sourceNote.importance > targetNote.importance && sourceNote.color) {
    combinedColor = sourceNote.color;
  } else if (!combinedColor && sourceNote.color) {
    combinedColor = sourceNote.color;
  }

  const combinedIsToday = targetNote.isToday || sourceNote.isToday;
  const combinedVideo = targetNote.videoAttachment || sourceNote.videoAttachment;

  return {
    ...targetNote,
    title: combinedTitle,
    fullNote: combinedFullNote,
    category: combinedCategory,
    color: combinedColor,
    importance: combinedImportance,
    deadline: combinedDeadline,
    isToday: combinedIsToday,
    videoAttachment: combinedVideo,
    createdAt: Math.min(targetNote.createdAt, sourceNote.createdAt),
  };
}

export const DEFAULT_APP_CONFIG: AppConfig = {
  mergeSameCategoryOnly: true,
  driftSpeed: 'calm',
  showWorkflowHints: true,
  categoryOverrides: {},
};

export function getEffectiveCategories(config?: AppConfig): CategoryMap {
  if (!config || !config.categoryOverrides) {
    return CATEGORIES;
  }

  const result = { ...CATEGORIES };
  (Object.keys(CATEGORIES) as BubbleCategory[]).forEach((key) => {
    const base = CATEGORIES[key];
    const override = config.categoryOverrides[key];
    if (override) {
      result[key] = {
        ...base,
        name: override.name?.trim() || base.name,
        description: override.description?.trim() || base.description,
        color: override.color || base.color,
      };
    }
  });
  return result;
}

export function suggestBubbleSplit(note: BubbleNote): {
  firstTitle: string;
  firstFullNote: string;
  firstImportance: BubbleImportance;
  secondTitle: string;
  secondFullNote: string;
  secondImportance: BubbleImportance;
} {
  const halfImportance = Math.max(1, Math.ceil(note.importance / 2)) as BubbleImportance;
  const secondHalfImportance = Math.max(1, Math.floor(note.importance / 2)) as BubbleImportance;

  // 1. Check if previously merged with " + " in title
  const plusParts = note.title.split(' + ').map((s) => s.trim()).filter(Boolean);
  const noteSections = (note.fullNote || '').split(/\n\s*---\s*\n/).map((s) => s.trim()).filter(Boolean);

  if (plusParts.length >= 2) {
    const firstTitle = plusParts[0];
    const secondTitle = plusParts.slice(1).join(' + ');
    return {
      firstTitle,
      firstFullNote: noteSections[0] || '',
      firstImportance: halfImportance,
      secondTitle,
      secondFullNote: noteSections.slice(1).join('\n\n---\n') || '',
      secondImportance: secondHalfImportance,
    };
  }

  // 2. Check if fullNote has multiple lines/bullet items that can become the second bubble
  const noteLines = (note.fullNote || '')
    .split('\n')
    .map((l) => l.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean);

  if (noteLines.length >= 2) {
    return {
      firstTitle: note.title,
      firstFullNote: noteLines.slice(0, Math.ceil(noteLines.length / 2)).join('\n'),
      firstImportance: halfImportance,
      secondTitle: noteLines[Math.ceil(noteLines.length / 2)].slice(0, 90),
      secondFullNote: noteLines.slice(Math.ceil(noteLines.length / 2) + 1).join('\n'),
      secondImportance: secondHalfImportance,
    };
  }

  // 3. Check comma or semicolon separation in title
  const commaParts = note.title.split(/[;,]/).map((s) => s.trim()).filter(Boolean);
  if (commaParts.length >= 2) {
    return {
      firstTitle: commaParts[0],
      firstFullNote: note.fullNote || '',
      firstImportance: halfImportance,
      secondTitle: commaParts.slice(1).join(', '),
      secondFullNote: '',
      secondImportance: secondHalfImportance,
    };
  }

  // 4. Default clean split fallback
  return {
    firstTitle: note.title,
    firstFullNote: note.fullNote || '',
    firstImportance: halfImportance,
    secondTitle: `${note.title} (part 2)`.slice(0, 90),
    secondFullNote: '',
    secondImportance: secondHalfImportance,
  };
}

const NOW = Date.now();
const ONE_DAY = 24 * 60 * 60 * 1000;

export const INITIAL_BUBBLE_NOTES: BubbleNote[] = [
  {
    id: 'b-1',
    title: 'Pay electricity account',
    fullNote: 'Quarterly power bill from Horizon Energy. Amount due: $284.50 via online banking.',
    category: 'bills',
    color: 'rose',
    importance: 5,
    createdAt: NOW - 12 * ONE_DAY,
    deadline: getRelativeDeadlineDate(-1),
    isToday: false,
    completed: false,
  },
  {
    id: 'b-2',
    title: 'Send investor pack',
    fullNote: 'Update latest monthly revenue charts, churn metrics, and product roadmap slide deck before meeting.',
    category: 'work',
    color: 'cyan',
    importance: 4,
    createdAt: NOW - 3 * ONE_DAY,
    deadline: getRelativeDeadlineDate(0),
    isToday: true,
    completed: false,
  },
  {
    id: 'b-3',
    title: 'Finish school project',
    fullNote: 'Solar system diorama with painted planets and orbital rings for Leo.',
    category: 'family',
    color: 'magenta',
    importance: 3,
    createdAt: NOW - 5 * ONE_DAY,
    deadline: getRelativeDeadlineDate(4),
    isToday: false,
    completed: false,
  },
  {
    id: 'b-4',
    title: 'Follow up on outstanding invoice',
    fullNote: 'Invoice #4029 for client design sprint ($4,200). Check in with accounts payable.',
    category: 'income',
    color: 'emerald',
    importance: 4,
    createdAt: NOW - 1 * ONE_DAY,
    deadline: getRelativeDeadlineDate(2),
    isToday: false,
    completed: false,
  },
  {
    id: 'b-5',
    title: 'Explore molten lava-lamp shaders',
    fullNote: 'Refine thin-film iridescence, specular rim highlights, and slow thermal convection.',
    category: 'ideas',
    color: 'violet',
    importance: 3,
    createdAt: NOW - 6 * ONE_DAY,
    isToday: false,
    completed: false,
  },
  {
    id: 'b-6',
    title: 'Book dentist appointment',
    fullNote: 'Regular 6-month checkup and routine teeth clean for the whole family.',
    category: 'personal',
    color: 'amber',
    importance: 2,
    createdAt: NOW - 18 * ONE_DAY,
    deadline: getRelativeDeadlineDate(8),
    isToday: false,
    completed: false,
  },
  {
    id: 'b-7',
    title: 'Replace water filter',
    fullNote: 'Under-sink RO filtration replacement cartridge order arrived yesterday.',
    category: 'general',
    color: 'blue',
    importance: 1,
    createdAt: NOW - 24 * ONE_DAY,
    isToday: false,
    completed: false,
  },
];
