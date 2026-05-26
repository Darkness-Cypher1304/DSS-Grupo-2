'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, ShieldOff, ShieldCheck, Users } from 'lucide-react';

import { apiGet, apiPatch } from '@/lib/api-client';

interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'PARENT' | 'SPECIALIST' | 'ADMIN';
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION';
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

interface UserList {
  items: User[];
  pagination: { page: number; perPage: number; total: number; totalPages: number };
}

export default function AdminUsersPage() {
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<UserList>({
    queryKey: ['admin-users', page],
    queryFn: () => apiGet<UserList>(`/users/admin/all?page=${page}&perPage=20`),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ACTIVE' | 'SUSPENDED' }) =>
      apiPatch(`/users/admin/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  return (
    <div className="container-wide py-12">
      <span className="text-xs font-mono uppercase tracking-widest text-coral-700">
        Gestión
      </span>
      <h1 className="font-display text-4xl tracking-tightest mt-2 mb-2">
        Usuarios registrados
      </h1>
      <p className="text-ink-mute mb-8">
        Lista de todas las cuentas. Puedes suspender accesos sospechosos.
      </p>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={28} className="animate-spin text-teal-700" />
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="card text-center py-12">
          <Users size={28} className="mx-auto text-teal-300 mb-2" />
          <p className="text-ink-mute text-sm">No hay usuarios.</p>
        </div>
      ) : (
        <>
          <div className="card overflow-hidden p-0">
            <table className="w-full">
              <thead className="bg-bone-100 border-b border-bone-200">
                <tr className="text-xs uppercase tracking-wider text-ink-fade font-mono">
                  <th className="px-4 py-3 text-left">Usuario</th>
                  <th className="px-4 py-3 text-left">Rol</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Verificado</th>
                  <th className="px-4 py-3 text-left">Último acceso</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bone-200">
                {data.items.map((u) => (
                  <tr key={u.id} className="hover:bg-bone-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-sm">{u.fullName}</div>
                      <div className="text-xs text-ink-fade">{u.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${
                        u.role === 'ADMIN' ? 'bg-ink text-bone-50' :
                        u.role === 'SPECIALIST' ? 'bg-coral-100 text-coral-800' :
                        'bg-teal-100 text-teal-800'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${
                        u.status === 'ACTIVE' ? 'bg-teal-100 text-teal-800' :
                        u.status === 'SUSPENDED' ? 'bg-coral-100 text-coral-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {u.emailVerified ? '✓' : <span className="text-ink-fade">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-fade">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('es-PE') : 'Nunca'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {u.role !== 'ADMIN' && (
                        u.status === 'ACTIVE' ? (
                          <button
                            onClick={() => statusMutation.mutate({ id: u.id, status: 'SUSPENDED' })}
                            disabled={statusMutation.isPending}
                            className="btn-ghost text-xs px-3 py-1.5 text-coral-700"
                          >
                            <ShieldOff size={14} />
                            Suspender
                          </button>
                        ) : (
                          <button
                            onClick={() => statusMutation.mutate({ id: u.id, status: 'ACTIVE' })}
                            disabled={statusMutation.isPending}
                            className="btn-ghost text-xs px-3 py-1.5 text-teal-700"
                          >
                            <ShieldCheck size={14} />
                            Reactivar
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <span className="text-sm text-ink-mute">
                Página {data.pagination.page} de {data.pagination.totalPages} · {data.pagination.total} usuarios
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn-secondary text-sm"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
                  disabled={page >= data.pagination.totalPages}
                  className="btn-secondary text-sm"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
