// ============================================================
// 前端认证状态管理 —— 运动员管理系统（AMS）
// ============================================================
// 职责：
// 1. 管理当前登录用户信息
// 2. 提供 login / logout 操作
// 3. 与后端 Cookie 会话配合
// ============================================================

import { create } from 'zustand';
import type { UserInfo } from '@/types';

interface AuthState {
  user: UserInfo | null;
  isLoading: boolean;
  setUser: (user: UserInfo | null) => void;
  login: (user: UserInfo) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,

  setUser: (user) => set({ user }),

  login: (user) => set({ user, isLoading: false }),

  logout: () => set({ user: null, isLoading: false }),

  setLoading: (loading) => set({ isLoading: loading }),
}));