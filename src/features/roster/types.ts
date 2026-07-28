export type SectionKey = "overview" | "all" | string;

export type Person = {
  id: string;
  platoonId: string;
  rank: string;
  name: string;
  conscriptionNumber: string | null;
  location: string;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
};

export type Platoon = {
  id: string;
  key: string;
  label: string;
  sortOrder: number;
  isSystem: boolean;
};

export type LocationOption = {
  id: string;
  key: string;
  label: string;
  colorToken: string;
  isQuick: boolean;
  quickCode: string | null;
  isSystem: boolean;
  sortOrder: number;
};

export type LocationGroup = {
  id: string;
  label: string;
  colorToken: string;
  enabled: boolean;
  sortOrder: number;
  locationKeys: string[];
};

export type LocationGroupConflict = {
  locationKey: string;
  groupId: string;
  groupLabel: string;
};

export type OverviewBlockId =
  | "hero"
  | "activity"
  | "location-distribution"
  | "platoons"
  | "location-cards"
  | "recent-activity";

export type OverviewDensity = "standard" | "compact";

export type OverviewLayout = "full" | "half";

export type OverviewHeroMetricKey =
  | "total"
  | "present"
  | "peakLocation"
  | "activeLocations";

export type OverviewActivityMetricKey = "lastHour" | "lastDay" | "logTotal";

export type OverviewSelection = {
  mode: "all" | "selected";
  keys: string[];
};

export type OverviewLocationDisplaySettings = {
  locationSelection: OverviewSelection;
  showEmpty: boolean;
  showPercent: boolean;
  expandableGroups: boolean;
  showMemberCounts: boolean;
};

export type OverviewBlockConfig = {
  hero: {
    metricKeys: OverviewHeroMetricKey[];
  };
  activity: {
    metricKeys: OverviewActivityMetricKey[];
  };
  "location-distribution": OverviewLocationDisplaySettings;
  platoons: {
    platoonSelection: OverviewSelection;
    showEmpty: boolean;
    showPercent: boolean;
  };
  "location-cards": OverviewLocationDisplaySettings;
  "recent-activity": {
    limit: number;
    showRelativeTime: boolean;
  };
};

export type OverviewBlockSettings = {
  [Id in OverviewBlockId]: {
    id: Id;
    visible: boolean;
    density: OverviewDensity;
    layout: OverviewLayout;
    config: OverviewBlockConfig[Id];
  };
}[OverviewBlockId];

export type OverviewSettings = {
  version: 2;
  blocks: OverviewBlockSettings[];
};

export type LogEntry = {
  id: string;
  personId: string;
  name: string;
  from: string;
  to: string;
  ts: number;
};

export type Snapshot = {
  people: Person[];
  platoons: Platoon[];
  locations: LocationOption[];
  locationGroups: LocationGroup[];
  overviewSettings: OverviewSettings;
  changeLog: LogEntry[];
  serverTime: number;
};

export type ToastChange = {
  personId: string;
  name: string;
  from: string;
  to: string;
};
