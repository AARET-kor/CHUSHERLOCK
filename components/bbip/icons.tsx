import {
  CalendarDays,
  Droplets,
  MessageCircle,
  MessageCircleQuestion,
  Microscope,
  Pill,
  Repeat2,
  Search,
  Shield,
  Siren,
  Stethoscope,
  StickyNote,
  Syringe,
  User,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { SectionGroup } from "../../lib/bbip/sections";
import type { ParsedCase, SectionKey, TurnKind } from "../../lib/bbip/types";

// Client-side icon vocabulary for the BBIP console. lib/bbip stays
// framework-free (its emoji are used in prompts and note titles).

export const SECTION_ICONS: Record<SectionKey, LucideIcon> = {
  cautions: Shield,
  adverse: Siren,
  ddx: Search,
  tips: Syringe,
  schedule: CalendarDays,
  homecare: Droplets,
  marketing: MessageCircle,
  alternatives: Repeat2,
  notes: StickyNote,
};

export const CHIP_ICONS: Record<keyof ParsedCase, LucideIcon> = {
  patient: User,
  conditions: Stethoscope,
  meds: Pill,
  procedures: Syringe,
};

export const GROUP_LABELS: Record<SectionGroup, { ko: string; en: string }> = {
  safety: { ko: "안전", en: "Safety" },
  practice: { ko: "실무", en: "Practice" },
  business: { ko: "비즈니스", en: "Business" },
};

export function turnIcon(turn: { kind: TurnKind; sectionKey?: SectionKey }): LucideIcon {
  if (turn.kind === "brief") return Zap;
  if (turn.kind === "section" && turn.sectionKey) return SECTION_ICONS[turn.sectionKey];
  if (turn.kind === "literature") return Microscope;
  return MessageCircleQuestion;
}
