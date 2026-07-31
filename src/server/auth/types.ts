import type { Permission } from "@/features/auth/permissions";

export type AuthContext = {
  user: { id: string; username: string; displayName: string };
  permissions: Permission[];
  roleIds: string[];
};

export type RoleRecord = {
  id: string;
  key: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissions: Permission[];
};

export type UserRecord = {
  id: string;
  username: string;
  displayName: string;
  active: boolean;
  roleIds: string[];
  createdAt: number;
};
