/**
 * 用户管理页 —— /admin/users
 */

'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit, Lock, Power } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface User {
  id: number;
  username: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

const roleLabels: Record<string, { label: string; color: string }> = {
  COACH: { label: '教练员', color: 'text-ams-primary bg-ams-primary/10' },
  MEDICAL: { label: '科研/医疗', color: 'text-ams-success bg-ams-success/10' },
  ADMIN: { label: '管理员', color: 'text-ams-warning bg-ams-warning/10' },
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', name: '', role: 'COACH' });
  const [error, setError] = useState('');

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (search) params.set('search', search);
      const res = await fetch(`/api/admin/users?${params}`);
      const json = await res.json();
      if (json.success) {
        setUsers(json.data.users);
        setTotal(json.data.total);
        setTotalPages(json.data.totalPages);
      }
    } catch { /* empty */ }
    finally { setIsLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);
  useEffect(() => { fetchUsers(); }, [page]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!newUser.username || !newUser.password || !newUser.name) {
      setError('请填写所有字段');
      return;
    }
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      });
      const json = await res.json();
      if (json.success) {
        setShowCreate(false);
        setNewUser({ username: '', password: '', name: '', role: 'COACH' });
        fetchUsers();
      } else {
        setError(json.error?.message || '创建失败');
      }
    } catch {
      setError('网络错误');
    }
  };

  const handleToggleActive = async (user: User) => {
    const action = user.isActive ? '停用' : '启用';
    if (!confirm(`确定${action}用户「${user.name}」？`)) return;
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id, isActive: !user.isActive }),
      });
      const json = await res.json();
      if (json.success) fetchUsers();
      else alert(json.error?.message || `${action}失败`);
    } catch {
      alert('网络错误');
    }
  };

  const handleChangeRole = async (user: User, role: string) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id, role }),
      });
      const json = await res.json();
      if (json.success) fetchUsers();
    } catch { /* empty */ }
  };

  const handleResetPassword = async (user: User) => {
    const password = prompt(`重置用户「${user.name}」的密码：`);
    if (!password) return;
    if (password.length < 6) { alert('密码至少 6 位'); return; }
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id, password }),
      });
      const json = await res.json();
      if (json.success) alert('密码已重置');
      else alert(json.error?.message || '重置失败');
    } catch {
      alert('网络错误');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-ams-text-primary">用户管理</h2>
        <Button onClick={() => setShowCreate(!showCreate)}>
          <Plus className="h-4 w-4" />
          新建用户
        </Button>
      </div>

      {showCreate && (
        <div className="ams-card p-6">
          <h3 className="mb-4 text-base font-semibold">新建用户</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm text-ams-text-secondary">用户名</label>
                <input value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-ams-text-secondary">密码</label>
                <input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-ams-text-secondary">姓名</label>
                <input value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-ams-text-secondary">角色</label>
                <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })} className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary">
                  <option value="COACH">教练员</option>
                  <option value="MEDICAL">科研/医疗人员</option>
                  <option value="ADMIN">管理员</option>
                </select>
              </div>
            </div>
            {error && <div className="text-sm text-ams-danger">{error}</div>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
              <Button type="submit">创建</Button>
            </div>
          </form>
        </div>
      )}

      <div className="ams-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-ams-text-secondary">加载中...</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-ams-text-secondary">暂无用户</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ams-border">
                    <th className="px-4 py-3 text-left ams-table-header">用户名</th>
                    <th className="px-4 py-3 text-left ams-table-header">姓名</th>
                    <th className="px-4 py-3 text-left ams-table-header">角色</th>
                    <th className="px-4 py-3 text-left ams-table-header">状态</th>
                    <th className="px-4 py-3 text-left ams-table-header">创建时间</th>
                    <th className="px-4 py-3 text-right ams-table-header">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const r = roleLabels[u.role] || { label: u.role, color: 'text-ams-text-secondary bg-ams-surface-hover' };
                    return (
                      <tr key={u.id} className="border-b border-ams-border/50 hover:bg-ams-surface-hover">
                        <td className="px-4 py-3 text-ams-text-primary font-mono">{u.username}</td>
                        <td className="px-4 py-3 text-ams-text-primary">{u.name}</td>
                        <td className="px-4 py-3">
                          <select
                            value={u.role}
                            onChange={(e) => handleChangeRole(u, e.target.value)}
                            className={`rounded-full px-2 py-0.5 text-xs font-medium border-0 ${r.color} cursor-pointer`}
                          >
                            <option value="COACH">教练员</option>
                            <option value="MEDICAL">科研/医疗人员</option>
                            <option value="ADMIN">管理员</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                            u.isActive ? 'bg-ams-success/10 text-ams-success' : 'bg-ams-danger/10 text-ams-danger'
                          }`}>
                            {u.isActive ? '启用' : '停用'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-ams-text-secondary">{new Date(u.createdAt).toLocaleDateString('zh-CN')}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => handleResetPassword(u)} title="重置密码">
                              <Lock className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleToggleActive(u)} title={u.isActive ? '停用' : '启用'}>
                              <Power className={`h-4 w-4 ${u.isActive ? 'text-ams-danger' : 'text-ams-success'}`} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-ams-border px-4 py-3">
                <div className="text-sm text-ams-text-secondary">共 {total} 人</div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>下一页</Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
