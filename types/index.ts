// ============================================================
// 运动员管理系统 —— 全局类型与权限定义
// ============================================================

// ============================================================
// 枚举类型
// ============================================================

export enum UserRole {
  COACH = 'COACH',
  MEDICAL = 'MEDICAL',
  ADMIN = 'ADMIN',
}

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
}

export const GenderLabels: Record<Gender, string> = {
  MALE: '男',
  FEMALE: '女',
};

export enum PlanStatus {
  DRAFT = 'DRAFT',
  SCHEDULED = 'SCHEDULED',
  COMPLETED = 'COMPLETED',
}

export enum InjuryStatus {
  INJURED = 'INJURED',
  RECOVERING = 'RECOVERING',
  RETURNED = 'RETURNED',
}

export enum RecoveryStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

export enum TestDirection {
  HIGHER_BETTER = 'HIGHER_BETTER',
  LOWER_BETTER = 'LOWER_BETTER',
}

export enum HealthMetricType {
  HEART_RATE = 'HEART_RATE',
  SLEEP = 'SLEEP',
  RPE = 'RPE',
  HRV = 'HRV',
}

export enum HealthMetricSource {
  MANUAL = 'MANUAL',
  POLAR = 'POLAR',
}

// ============================================================
// 权限系统
// ============================================================

export const Permissions = {
  ATHLETE_READ: 'ATHLETE_READ',
  ATHLETE_WRITE: 'ATHLETE_WRITE',
  ATHLETE_DELETE: 'ATHLETE_DELETE',
  TRAINING_READ: 'TRAINING_READ',
  TRAINING_WRITE: 'TRAINING_WRITE',
  FITNESS_READ: 'FITNESS_READ',
  FITNESS_WRITE: 'FITNESS_WRITE',
  HEALTH_READ: 'HEALTH_READ',
  HEALTH_WRITE: 'HEALTH_WRITE',
  USER_MANAGE: 'USER_MANAGE',
  AUDIT_READ: 'AUDIT_READ',
} as const;

export type PermissionKey = (typeof Permissions)[keyof typeof Permissions];

export const RolePermissions: Record<UserRole, PermissionKey[]> = {
  [UserRole.COACH]: [
    Permissions.ATHLETE_READ,
    Permissions.ATHLETE_WRITE,
    Permissions.TRAINING_READ,
    Permissions.TRAINING_WRITE,
    Permissions.FITNESS_READ,
    Permissions.FITNESS_WRITE,
  ],
  [UserRole.MEDICAL]: [
    Permissions.ATHLETE_READ,
    Permissions.HEALTH_READ,
    Permissions.HEALTH_WRITE,
    Permissions.FITNESS_READ,
  ],
  [UserRole.ADMIN]: [
    Permissions.ATHLETE_READ,
    Permissions.ATHLETE_WRITE,
    Permissions.ATHLETE_DELETE,
    Permissions.TRAINING_READ,
    Permissions.TRAINING_WRITE,
    Permissions.FITNESS_READ,
    Permissions.FITNESS_WRITE,
    Permissions.HEALTH_READ,
    Permissions.HEALTH_WRITE,
    Permissions.USER_MANAGE,
    Permissions.AUDIT_READ,
  ],
};

export function hasPermission(role: UserRole, permission: PermissionKey): boolean {
  return RolePermissions[role]?.includes(permission) ?? false;
}

// ============================================================
// 通用业务类型
// ============================================================

export interface UserInfo {
  userId: number;
  username: string;
  name: string;
  role: UserRole;
  isActive: boolean;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}