/**
 * Curated icon registry for tree-shaking optimization
 *
 * This module imports only the icons actually used in the app,
 * reducing bundle size from ~1MB (all 1500+ icons) to ~50KB.
 *
 * To add a new icon:
 * 1. Import it from lucide-react
 * 2. Add it to ICON_REGISTRY with kebab-case key
 */

import type { LucideIcon } from 'lucide-react';

// UI icons
import {
  Activity,
  AlertTriangle,
  Archive,
  ArrowUpRight,
  BarChart2,
  Bot,
  Box,
  Bug,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Code,
  Code2,
  Copy,
  Database,
  Edit2,
  Edit3,
  ExternalLink,
  Eye,
  FileInput,
  FileSearch,
  FileText,
  FlaskConical,
  Folder,
  Globe,
  HelpCircle,
  Layers,
  LayoutGrid,
  LayoutList,
  Lightbulb,
  Link,
  Loader2,
  LogOut,
  Mail,
  MessageCircle,
  MessageSquare,
  Milestone,
  Monitor,
  Moon,
  MoreVertical,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  PlayCircle,
  Plug,
  Plus,
  RefreshCw,
  Rocket,
  Route,
  Search,
  Send,
  Share2,
  Sparkles,
  Sun,
  Tag,
  Target,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  TrendingUp,
  Upload,
  Users,
  Video,
  Wrench,
  X,
} from 'lucide-react';

/**
 * Registry mapping kebab-case icon names to lucide-react components.
 * Only icons in this registry will be included in the bundle.
 */
export const ICON_REGISTRY: Record<string, LucideIcon> = {
  // UI navigation & actions
  'chevron-down': ChevronDown,
  'chevron-right': ChevronRight,
  'external-link': ExternalLink,
  'layout-grid': LayoutGrid,
  'layout-list': LayoutList,
  'log-out': LogOut,
  'more-vertical': MoreVertical,
  'panel-left-close': PanelLeftClose,
  'panel-left-open': PanelLeftOpen,
  'play-circle': PlayCircle,
  'refresh-cw': RefreshCw,
  plus: Plus,
  x: X,

  // Content & editing
  copy: Copy,
  'edit-2': Edit2,
  'edit-3': Edit3,
  eye: Eye,
  pencil: Pencil,
  'share-2': Share2,
  'trash-2': Trash2,
  upload: Upload,

  // Status & feedback
  activity: Activity,
  'alert-triangle': AlertTriangle,
  check: Check,
  'help-circle': HelpCircle,
  'loader-2': Loader2,
  'thumbs-down': ThumbsDown,
  'thumbs-up': ThumbsUp,
  'trending-up': TrendingUp,

  // Communication
  'message-circle': MessageCircle,
  'message-square': MessageSquare,
  send: Send,

  // Data & content types
  'bar-chart-2': BarChart2,
  'file-text': FileText,
  folder: Folder,
  link: Link,
  milestone: Milestone,
  route: Route,
  target: Target,
  video: Video,

  // Tools (from config.ts)
  'file-input': FileInput,
  'file-search': FileSearch,
  calendar: Calendar,
  code: Code,
  'code-2': Code2,
  database: Database,
  globe: Globe,
  mail: Mail,
  plug: Plug,
  search: Search,
  wrench: Wrench,

  // Agent status icons (from validationConstants.ts)
  archive: Archive,
  bug: Bug,
  'flask-conical': FlaskConical,
  lightbulb: Lightbulb,
  rocket: Rocket,

  // Theme icons
  monitor: Monitor,
  moon: Moon,
  sparkles: Sparkles,
  sun: Sun,

  // Misc
  'arrow-up-right': ArrowUpRight,
  bot: Bot,
  box: Box,
  clock: Clock,
  layers: Layers,
  tag: Tag,
  users: Users,
};

/**
 * Get an icon component by kebab-case name.
 * Returns undefined if the icon is not in the registry.
 */
export function getIconComponent(name: string): LucideIcon | undefined {
  return ICON_REGISTRY[name];
}
