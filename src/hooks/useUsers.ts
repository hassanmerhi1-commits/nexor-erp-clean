// User Management Hook — API-First
import { useState, useEffect, useCallback } from 'react';
import { User } from '@/types/erp';
import { UserRole } from '@/lib/permissions';
import { api } from '@/lib/api/client';

export function useUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api.auth.me();
      // Try fetching all users from API
      const usersResponse = await api.users.list();
      if (usersResponse.data && Array.isArray(usersResponse.data)) {
        setUsers(usersResponse.data);
      } else {
        // Fallback to localStorage
        const raw = localStorage.getItem('kwanzaerp_users');
        setUsers(raw ? JSON.parse(raw) : []);
      }
    } catch {
      const raw = localStorage.getItem('kwanzaerp_users');
      setUsers(raw ? JSON.parse(raw) : []);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { refreshUsers(); }, [refreshUsers]);

  const createUser = useCallback(async (data: {
    email: string; name: string; username?: string; role: UserRole; branchId: string; password?: string;
  }): Promise<User> => {
    try {
      const response = await api.users.create(data);
      if (response.data) {
        await refreshUsers();
        return response.data;
      }
    } catch { /* fallback below */ }

    // Fallback: localStorage
    const newUser: User = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      email: data.email, name: data.name, username: data.username,
      role: data.role, branchId: data.branchId, isActive: true,
      createdAt: new Date().toISOString(),
    };
    const raw = localStorage.getItem('kwanzaerp_users');
    const all = raw ? JSON.parse(raw) : [];
    all.push(newUser);
    localStorage.setItem('kwanzaerp_users', JSON.stringify(all));
    await refreshUsers();
    return newUser;
  }, [refreshUsers]);

  const updateUser = useCallback(async (user: User): Promise<void> => {
    try {
      const response = await api.users.update(user.id, user);
      if (!response.error) { await refreshUsers(); return; }
    } catch { /* fallback */ }

    const raw = localStorage.getItem('kwanzaerp_users');
    const all: User[] = raw ? JSON.parse(raw) : [];
    const idx = all.findIndex(u => u.id === user.id);
    if (idx >= 0) all[idx] = user; else all.push(user);
    localStorage.setItem('kwanzaerp_users', JSON.stringify(all));
    await refreshUsers();
  }, [refreshUsers]);

  const deleteUser = useCallback(async (userId: string): Promise<void> => {
    try {
      const response = await api.users.delete(userId);
      if (!response.error) { await refreshUsers(); return; }
    } catch { /* fallback */ }

    const raw = localStorage.getItem('kwanzaerp_users');
    const all: User[] = raw ? JSON.parse(raw) : [];
    localStorage.setItem('kwanzaerp_users', JSON.stringify(all.filter(u => u.id !== userId)));
    await refreshUsers();
  }, [refreshUsers]);

  const updateUserRole = useCallback(async (userId: string, role: UserRole): Promise<void> => {
    const user = users.find(u => u.id === userId);
    if (user) {
      await updateUser({ ...user, role, updatedAt: new Date().toISOString() });
    }
  }, [users, updateUser]);

  const toggleUserActive = useCallback(async (userId: string): Promise<void> => {
    const user = users.find(u => u.id === userId);
    if (user) {
      await updateUser({ ...user, isActive: !user.isActive, updatedAt: new Date().toISOString() });
    }
  }, [users, updateUser]);

  const getUserById = useCallback((userId: string): User | undefined => {
    return users.find(u => u.id === userId);
  }, [users]);

  return { users, isLoading, refreshUsers, createUser, updateUser, deleteUser, updateUserRole, toggleUserActive, getUserById };
}
