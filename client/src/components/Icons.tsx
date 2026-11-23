import type { IconType } from "react-icons";
import {
  LuAnnoyed, LuArrowLeftRight, LuBot, LuCalendarDays, LuChartColumn, LuClock, LuDumbbell, LuFlame, LuFrown, LuHouse, LuLaugh, LuLayers, LuListChecks, LuMeh,
  LuPanelLeftClose, LuPanelLeftOpen, LuX, LuTrash2, LuSearch, LuBell, LuChevronLeft, LuChevronRight,
  LuUtensils, LuDroplet, LuPlus, LuMinus,
  LuBed, LuBicepsFlexed, LuBrain, LuInfo, LuLogOut, LuPencil, LuPlay, LuSettings, LuSmile, LuSparkles, LuStar, LuTriangleAlert, LuTrophy, LuUser, LuZap,
} from "react-icons/lu";

/** Icon registry (Lucide via react-icons). Add a name here to use it with <Icon />. */
const ICONS = {
  home: LuHouse,
  calendar: LuCalendarDays,
  chart: LuChartColumn,
  dumbbell: LuDumbbell,
  list: LuListChecks,
  sparkles: LuSparkles,
  user: LuUser,
  layers: LuLayers,
  clock: LuClock,
  flame: LuFlame,
  bot: LuBot,
  frown: LuFrown,
  meh: LuMeh,
  smile: LuSmile,
  laugh: LuLaugh,
  annoyed: LuAnnoyed,
  trophy: LuTrophy,
  alert: LuTriangleAlert,
  star: LuStar,
  pencil: LuPencil,
  swap: LuArrowLeftRight,
  bed: LuBed,
  zap: LuZap,
  biceps: LuBicepsFlexed,
  brain: LuBrain,
  play: LuPlay,
  info: LuInfo,
  settings: LuSettings,
  logout: LuLogOut,
  panelClose: LuPanelLeftClose,
  panelOpen: LuPanelLeftOpen,
  x: LuX,
  trash: LuTrash2,
  search: LuSearch,
  bell: LuBell,
  chevronLeft: LuChevronLeft,
  chevronRight: LuChevronRight,
  utensils: LuUtensils,
  droplet: LuDroplet,
  plus: LuPlus,
  minus: LuMinus,
} satisfies Record<string, IconType>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 20, className = "" }: { name: IconName; size?: number; className?: string }) {
  const C = ICONS[name];
  return <C size={size} className={`inline-block shrink-0 align-[-0.125em] ${className}`} aria-hidden />;
}

/** Mood 1..5 → line icon. The app uses icons, never emoji. */
export const MOOD_ICONS: IconName[] = ["frown", "annoyed", "meh", "smile", "laugh"];
