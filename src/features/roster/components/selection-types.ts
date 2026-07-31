export type SelectionProps = {
  selectedIds: ReadonlySet<string>;
  pendingIds: ReadonlySet<string>;
  onToggleSelect: (personId: string) => void;
  onVisiblePeopleChange?: (ids: string[]) => void;
};
