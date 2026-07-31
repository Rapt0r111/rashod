import {
  BroomIcon,
  ClipboardTextIcon,
  ForkKnifeIcon,
  MapPinAreaIcon,
} from "@phosphor-icons/react";
import type { GroupPriorityMode } from "../types";

export const iconMap = {
  Broom: BroomIcon,
  ForkKnife: ForkKnifeIcon,
  MapPinArea: MapPinAreaIcon,
  ClipboardText: ClipboardTextIcon,
};

export const priorityModeOptions: Array<{ label: string; value: GroupPriorityMode }> = [
  { value: "oldest", label: "По очереди" },
  { value: "random", label: "Случайно" },
];

export const priorityModeLabels: Record<GroupPriorityMode, string> = {
  oldest: "по очереди",
  random: "случайно",
};
