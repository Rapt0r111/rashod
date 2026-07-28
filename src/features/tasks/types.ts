export type Task = {
  id: string;
  parentId: string | null;
  title: string;
  description: string;
  sortOrder: number;
  completedAt: number | null;
  createdAt: number;
  updatedAt: number;
};

export type TasksSnapshot = {
  active: Task[];
  history: Task[];
};
