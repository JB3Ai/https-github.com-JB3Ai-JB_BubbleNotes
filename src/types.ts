export type BubbleCategory =
  | 'bills'
  | 'income'
  | 'family'
  | 'work'
  | 'ideas'
  | 'personal'
  | 'general';

export type BubbleColorId =
  | 'cyan'
  | 'violet'
  | 'rose'
  | 'emerald'
  | 'blue'
  | 'amber'
  | 'magenta'
  | 'pearl';

export type BubbleImportance = 1 | 2 | 3 | 4 | 5; // 1: Tiny, 2: Small, 3: Medium, 4: Large, 5: Critical

export type VideoAspectRatio = '16:9' | '9:16';

export interface VideoAttachment {
  url: string;
  aspectRatio: VideoAspectRatio;
  prompt: string;
  createdAt: number;
  interactionId?: string;
}

export interface BubbleNote {
  id: string;
  title: string;          // One short sentence
  fullNote?: string;      // Optional full note details
  category: BubbleCategory;
  color?: BubbleColorId;  // Iridescent liquid metal & aurora color
  importance: BubbleImportance;
  createdAt: number;      // Epoch timestamp
  deadline?: string;      // ISO date string 'YYYY-MM-DD'
  isToday: boolean;       // In the Today Goal Zone
  completed: boolean;
  completedAt?: number;
  videoAttachment?: VideoAttachment;
}

export interface JellyfishColorMeta {
  id: BubbleColorId;
  name: string;
  color: string;           // Primary hex color
  glowColor: string;       // Bioluminescent outer glow RGBA
  coreColor: string;       // Inner aurora nucleus RGBA
  accentColor: string;     // Bright dichroic rim highlight hex
  membraneColor: string;   // Translucent metallic fill RGBA
  auroraSecondary: string; // Secondary shifting aurora hex
  metalTint: string;       // Liquid metal specular tint hex
  textColor: string;
}

export interface CategoryMeta {
  id: BubbleCategory;
  name: string;
  description: string;
  color: string;           // Hex color
  glowColor: string;       // RGBA or hex for aura
  accentColor: string;     // Bright highlight
  membraneColor: string;   // Translucent fill
  textColor: string;
}

export interface ImportanceMeta {
  level: BubbleImportance;
  name: string;
  baseRadius: number;
  mass: number;
  label: string;
}

export interface DeadlineInfo {
  status: 'none' | 'overdue' | 'today' | 'tomorrow' | 'urgent' | 'approaching' | 'future';
  badgeText: string;
  daysRemaining: number;
  urgencyLevel: number; // 0 (calm) to 3 (critical/overdue)
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  maxLife: number;
  life: number;
  color: string;
  type: 'droplet' | 'ring' | 'sparkle' | 'microbubble';
}

export interface TankCaustic {
  x: number;
  y: number;
  radius: number;
  speed: number;
  phase: number;
  opacity: number;
}

export type DriftSpeedPreset = 'ultra-slow' | 'calm' | 'gentle';

export interface CategoryOverride {
  name: string;
  description: string;
  color: string;
}

export type CategoryMap = Record<BubbleCategory, CategoryMeta>;

export interface AppConfig {
  mergeSameCategoryOnly: boolean;
  driftSpeed: DriftSpeedPreset;
  showWorkflowHints: boolean;
  categoryOverrides: Partial<Record<BubbleCategory, Partial<CategoryOverride>>>;
}

