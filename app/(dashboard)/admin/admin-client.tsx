"use client";

import { useState, useEffect, useCallback } from "react";

/* ───── Types ───── */
interface Sede {
  id: string;
  name: string;
  active: boolean;
  itemCount: number;
  userCount: number;
  activeLoans: number;
}

interface UserItem {
  id: string;
  name: string;
  username: string;
  role: "ADMIN" | "OPERATOR";
  active: boolean;
  sede: { id: string; name: string } | null;
}

/* ───── Modal ───── */
function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-vgsurface-lowest rounded-xl shadow-xl w-full max-w-md mx-4 p-6 border border-vgoutline-variant/15">
        <div className="flex items-center justify-between mb-6">
          <h3
            className="text-lg font-bold text-vgprimary"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            {title}
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-vgoutline hover:text-vgprimary transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ───── Main Client Component ───── */
export default function AdminClient() {
  /* ── State ── */
  const [activeTab, setActiveTab] = useState<"all" | "sedes" | "usuarios">("all");
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [loadingSedes, setLoadingSedes] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Filters
  const [filterRole, setFilterRole] = useState("");
  const [filterSede, setFilterSede] = useState("");

  // Create sede modal
  const [showCreateSede, setShowCreateSede] = useState(false);
  const [newSedeName, setNewSedeName] = useState("");
  const [creatingSede, setCreatingSede] = useState(false);
  const [sedeError, setSedeError] = useState("");

  // Edit sede modal
  const [editSede, setEditSede] = useState<Sede | null>(null);
  const [editSedeName, setEditSedeName] = useState("");
  const [editingSede, setEditingSede] = useState(false);

  // Create user form
  const [userForm, setUserForm] = useState({
    name: "",
    username: "",
    password: "",
    role: "OPERATOR" as "ADMIN" | "OPERATOR",
    sedeId: "",
  });
  const [creatingUser, setCreatingUser] = useState(false);
  const [userFormError, setUserFormError] = useState("");

  // Edit user modal
  const [editUser, setEditUser] = useState<UserItem | null>(null);
  const [editUserForm, setEditUserForm] = useState({ name: "", role: "OPERATOR" as "ADMIN" | "OPERATOR", sedeId: "" });
  const [editingUser, setEditingUser] = useState(false);
  const [editUserError, setEditUserError] = useState("");

  // Reset password modal
  const [resetUser, setResetUser] = useState<UserItem | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);

  /* ── Fetchers ── */
  const fetchSedes = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/sedes");
      if (!res.ok) return;
      const data = await res.json();
      setSedes(data.sedes);
    } finally {
      setLoadingSedes(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterRole) params.set("role", filterRole);
      if (filterSede) params.set("sedeId", filterSede);
      const res = await fetch(`/api/admin/users?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setUsers(data.users);
      setUsersTotal(data.total);
    } finally {
      setLoadingUsers(false);
    }
  }, [filterRole, filterSede]);

  useEffect(() => {
    fetchSedes();
    fetchUsers();
  }, [fetchSedes, fetchUsers]);

  /* ── Sede actions ── */
  async function handleCreateSede() {
    if (!newSedeName.trim()) return;
    setCreatingSede(true);
    setSedeError("");
    try {
      const res = await fetch("/api/admin/sedes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newSedeName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        setSedeError(typeof data.error === "string" ? data.error : "Error al crear sede");
        return;
      }
      setNewSedeName("");
      setShowCreateSede(false);
      fetchSedes();
    } finally {
      setCreatingSede(false);
    }
  }

  async function handleEditSede() {
    if (!editSede || !editSedeName.trim()) return;
    setEditingSede(true);
    try {
      const res = await fetch(`/api/admin/sedes/${editSede.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editSedeName.trim() }),
      });
      if (res.ok) {
        setEditSede(null);
        fetchSedes();
      }
    } finally {
      setEditingSede(false);
    }
  }

  async function handleToggleSede(sede: Sede) {
    if (sede.active) {
      if (!confirm(`¿Desactivar "${sede.name}"? Los operadores asignados no podrán acceder.`)) return;
    }
    const res = await fetch(`/api/admin/sedes/${sede.id}`, { method: "PATCH" });
    if (!res.ok) {
      const data = await res.json();
      alert(typeof data.error === "string" ? data.error : "Error al cambiar estado");
      return;
    }
    fetchSedes();
  }

  /* ── User actions ── */
  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setCreatingUser(true);
    setUserFormError("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: userForm.name.trim(),
          username: userForm.username.trim(),
          password: userForm.password,
          role: userForm.role,
          sedeId: userForm.role === "OPERATOR" ? userForm.sedeId : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setUserFormError(typeof data.error === "string" ? data.error : "Error al crear usuario");
        return;
      }
      setUserForm({ name: "", username: "", password: "", role: "OPERATOR", sedeId: "" });
      fetchUsers();
    } finally {
      setCreatingUser(false);
    }
  }

  async function handleEditUser() {
    if (!editUser) return;
    setEditingUser(true);
    setEditUserError("");
    try {
      const res = await fetch(`/api/admin/users/${editUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editUserForm.name.trim(),
          role: editUserForm.role,
          sedeId: editUserForm.role === "OPERATOR" ? editUserForm.sedeId : null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setEditUserError(typeof data.error === "string" ? data.error : "Error al editar usuario");
        return;
      }
      setEditUser(null);
      fetchUsers();
    } finally {
      setEditingUser(false);
    }
  }

  async function handleResetPassword() {
    if (!resetUser || !resetPassword) return;
    setResettingPassword(true);
    try {
      const res = await fetch(`/api/admin/users/${resetUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset-password", password: resetPassword }),
      });
      if (res.ok) {
        setResetUser(null);
        setResetPassword("");
      }
    } finally {
      setResettingPassword(false);
    }
  }

  async function handleToggleUser(user: UserItem) {
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle" }),
    });
    if (res.ok) fetchUsers();
  }

  const activeSedes = sedes.filter((s) => s.active);

  /* ──────────── RENDER ──────────── */
  return (
    <>
      {/* Page Header */}
      <div className="px-8 pt-8 pb-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1
              className="text-3xl font-extrabold tracking-tight text-vgprimary mb-2"
              style={{ fontFamily: "Manrope, sans-serif" }}
            >
              Administración del Sistema
            </h1>
            <p
              className="text-vgon-surface-variant text-sm font-medium"
              style={{ fontFamily: "Inter, sans-serif" }}
            >
              Gestión de sedes y usuarios del sistema.
            </p>
          </div>
          <div className="bg-vgsurface-low p-1 rounded-xl flex gap-1 self-start">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${
                activeTab === "all"
                  ? "bg-white shadow-sm text-vgprimary"
                  : "text-vgon-surface-variant hover:bg-white/50"
              }`}
              style={{ fontFamily: "Manrope, sans-serif" }}
            >
              Todo
            </button>
            <button
              onClick={() => setActiveTab("sedes")}
              className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${
                activeTab === "sedes"
                  ? "bg-white shadow-sm text-vgprimary"
                  : "text-vgon-surface-variant hover:bg-white/50"
              }`}
              style={{ fontFamily: "Manrope, sans-serif" }}
            >
              Sedes
            </button>
            <button
              onClick={() => setActiveTab("usuarios")}
              className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${
                activeTab === "usuarios"
                  ? "bg-white shadow-sm text-vgprimary"
                  : "text-vgon-surface-variant hover:bg-white/50"
              }`}
              style={{ fontFamily: "Manrope, sans-serif" }}
            >
              Usuarios
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-8 pb-12">
        <div className="grid grid-cols-12 gap-6">
          {/* ═══ LEFT: Sedes ═══ */}
          <section
            className={`col-span-12 ${
              activeTab === "usuarios" ? "hidden" : "lg:col-span-5"
            } ${activeTab === "sedes" ? "lg:col-span-12" : ""} flex flex-col gap-6`}
          >
            {/* Sede Directory */}
            <div className="bg-vgsurface-lowest p-6 rounded-xl shadow-sm border border-vgoutline-variant/15">
              <div className="flex items-center justify-between mb-6">
                <h2
                  className="font-bold text-lg text-vgprimary"
                  style={{ fontFamily: "Manrope, sans-serif" }}
                >
                  Directorio de Sedes
                </h2>
                <button
                  onClick={() => {
                    setNewSedeName("");
                    setSedeError("");
                    setShowCreateSede(true);
                  }}
                  className="flex items-center gap-2 text-xs font-bold text-vgsecondary bg-vgsecondary-container px-3 py-1.5 rounded-lg hover:brightness-95 transition-all"
                >
                  <span className="material-symbols-outlined text-sm">add_business</span>
                  Crear Sede
                </button>
              </div>

              {loadingSedes ? (
                <div className="flex items-center justify-center py-10 text-vgoutline">
                  <span className="material-symbols-outlined animate-spin mr-2">progress_activity</span>
                  Cargando sedes...
                </div>
              ) : sedes.length === 0 ? (
                <p className="text-center py-10 text-vgoutline text-sm">No hay sedes registradas.</p>
              ) : (
                <div className="space-y-3">
                  {sedes.map((sede) => (
                    <div
                      key={sede.id}
                      className={`flex items-center justify-between p-4 bg-vgsurface-low rounded-xl group hover:bg-vgsurface-container-high transition-colors ${
                        !sede.active ? "opacity-50 grayscale-[0.5]" : ""
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            sede.active
                              ? "bg-vgprimary/5 text-vgprimary"
                              : "bg-slate-200 text-slate-400"
                          }`}
                        >
                          <span className="material-symbols-outlined">location_on</span>
                        </div>
                        <div>
                          <div
                            className={`font-bold text-sm ${
                              sede.active ? "text-vgprimary" : "text-slate-400"
                            }`}
                          >
                            {sede.name}
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                sede.active ? "bg-green-500" : "bg-slate-300"
                              }`}
                            />
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wider ${
                                sede.active ? "text-green-600" : "text-slate-400"
                              }`}
                            >
                              {sede.active ? "Activa" : "Inactiva"}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setEditSede(sede);
                            setEditSedeName(sede.name);
                          }}
                          className="p-2 text-slate-400 hover:text-vgprimary transition-colors"
                          title="Editar"
                        >
                          <span className="material-symbols-outlined text-lg">edit</span>
                        </button>
                        <button
                          onClick={() => handleToggleSede(sede)}
                          className={`p-2 transition-colors ${
                            sede.active
                              ? "text-slate-400 hover:text-vgerror"
                              : "text-slate-400 hover:text-green-600"
                          }`}
                          title={sede.active ? "Desactivar" : "Activar"}
                        >
                          <span className="material-symbols-outlined text-lg">
                            {sede.active ? "block" : "check_circle"}
                          </span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Stats card */}
            <div className="bg-vgprimary p-6 rounded-xl relative overflow-hidden">
              <div className="relative z-10">
                <h3
                  className="text-white/70 text-[10px] uppercase tracking-[0.2em] mb-1"
                  style={{ fontFamily: "Inter, sans-serif" }}
                >
                  Cobertura Global
                </h3>
                <div
                  className="text-white text-3xl font-black mb-1"
                  style={{ fontFamily: "Manrope, sans-serif" }}
                >
                  {activeSedes.length} {activeSedes.length === 1 ? "Sede Activa" : "Sedes Activas"}
                </div>
              </div>
              <div className="absolute -right-10 -bottom-10 opacity-10">
                <span className="material-symbols-outlined text-9xl">language</span>
              </div>
            </div>
          </section>

          {/* ═══ RIGHT: Users ═══ */}
          <section
            className={`col-span-12 ${
              activeTab === "sedes" ? "hidden" : "lg:col-span-7"
            } ${activeTab === "usuarios" ? "lg:col-span-12" : ""} flex flex-col gap-6`}
          >
            {/* Create User Form */}
            <div className="bg-vgsurface-highest p-6 rounded-xl border border-vgoutline-variant/20 shadow-inner">
              <h2
                className="font-bold text-lg text-vgprimary mb-6 flex items-center gap-2"
                style={{ fontFamily: "Manrope, sans-serif" }}
              >
                <span className="material-symbols-outlined">person_add</span>
                Crear Usuario
              </h2>
              <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label
                    className="text-[10px] uppercase tracking-wider text-slate-500 font-bold ml-1"
                    style={{ fontFamily: "Inter, sans-serif" }}
                  >
                    Nombre Completo
                  </label>
                  <input
                    required
                    className="bg-vgsurface-lowest border-none rounded-lg p-3 text-sm focus:ring-2 focus:ring-vgprimary"
                    placeholder="Ej: Elena Rodríguez"
                    value={userForm.name}
                    onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label
                    className="text-[10px] uppercase tracking-wider text-slate-500 font-bold ml-1"
                    style={{ fontFamily: "Inter, sans-serif" }}
                  >
                    Username
                  </label>
                  <input
                    required
                    className="bg-vgsurface-lowest border-none rounded-lg p-3 text-sm focus:ring-2 focus:ring-vgprimary"
                    placeholder="erodriguez"
                    value={userForm.username}
                    onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label
                    className="text-[10px] uppercase tracking-wider text-slate-500 font-bold ml-1"
                    style={{ fontFamily: "Inter, sans-serif" }}
                  >
                    Rol
                  </label>
                  <select
                    className="bg-vgsurface-lowest border-none rounded-lg p-3 text-sm focus:ring-2 focus:ring-vgprimary"
                    value={userForm.role}
                    onChange={(e) =>
                      setUserForm({ ...userForm, role: e.target.value as "ADMIN" | "OPERATOR" })
                    }
                  >
                    <option value="OPERATOR">Operador</option>
                    <option value="ADMIN">Administrador</option>
                  </select>
                </div>
                {userForm.role === "OPERATOR" && (
                  <div className="flex flex-col gap-1">
                    <label
                      className="text-[10px] uppercase tracking-wider text-slate-500 font-bold ml-1"
                      style={{ fontFamily: "Inter, sans-serif" }}
                    >
                      Sede Asignada
                    </label>
                    <select
                      required
                      className="bg-vgsurface-lowest border-none rounded-lg p-3 text-sm focus:ring-2 focus:ring-vgprimary"
                      value={userForm.sedeId}
                      onChange={(e) => setUserForm({ ...userForm, sedeId: e.target.value })}
                    >
                      <option value="">Seleccionar sede...</option>
                      {activeSedes.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className={`flex flex-col gap-1 ${userForm.role === "ADMIN" ? "md:col-span-2" : ""}`}>
                  <label
                    className="text-[10px] uppercase tracking-wider text-slate-500 font-bold ml-1"
                    style={{ fontFamily: "Inter, sans-serif" }}
                  >
                    Contraseña
                  </label>
                  <input
                    required
                    type="password"
                    className="bg-vgsurface-lowest border-none rounded-lg p-3 text-sm focus:ring-2 focus:ring-vgprimary"
                    placeholder="Mínimo 4 caracteres"
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2 flex items-center justify-between mt-2">
                  {userFormError && (
                    <p className="text-vgerror text-sm font-medium flex items-center gap-1">
                      <span className="material-symbols-outlined text-base">error</span>
                      {userFormError}
                    </p>
                  )}
                  {!userFormError && <span />}
                  <button
                    type="submit"
                    disabled={creatingUser}
                    className="bg-gradient-to-r from-vgprimary to-vgprimary-container text-white px-8 py-3 rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg hover:shadow-vgprimary/20 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {creatingUser ? "Creando..." : "Registrar Usuario"}
                  </button>
                </div>
              </form>
            </div>

            {/* User List */}
            <div className="bg-vgsurface-lowest rounded-xl shadow-sm border border-vgoutline-variant/15 overflow-hidden">
              <div className="p-6 border-b border-vgsurface-low flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <h3
                    className="font-bold text-vgprimary"
                    style={{ fontFamily: "Manrope, sans-serif" }}
                  >
                    Directorio de Usuarios
                  </h3>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {usersTotal} Total
                  </span>
                </div>
                <div className="flex gap-2">
                  <select
                    className="bg-vgsurface-low border-none rounded-lg px-3 py-1.5 text-xs font-bold text-vgon-surface-variant focus:ring-2 focus:ring-vgprimary"
                    value={filterRole}
                    onChange={(e) => setFilterRole(e.target.value)}
                  >
                    <option value="">Todos los roles</option>
                    <option value="ADMIN">Admin</option>
                    <option value="OPERATOR">Operador</option>
                  </select>
                  <select
                    className="bg-vgsurface-low border-none rounded-lg px-3 py-1.5 text-xs font-bold text-vgon-surface-variant focus:ring-2 focus:ring-vgprimary"
                    value={filterSede}
                    onChange={(e) => setFilterSede(e.target.value)}
                  >
                    <option value="">Todas las sedes</option>
                    {activeSedes.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                {loadingUsers ? (
                  <div className="flex items-center justify-center py-16 text-vgoutline">
                    <span className="material-symbols-outlined animate-spin mr-2">progress_activity</span>
                    Cargando usuarios...
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-vgsurface-low">
                      <tr>
                        <th className="px-6 py-3 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                          Nombre / Usuario
                        </th>
                        <th className="px-6 py-3 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                          Rol
                        </th>
                        <th className="px-6 py-3 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                          Sede
                        </th>
                        <th className="px-6 py-3 text-[10px] uppercase tracking-wider text-slate-500 font-bold text-right">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-vgsurface-low">
                      {users.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-16 text-center text-vgoutline text-sm">
                            No se encontraron usuarios.
                          </td>
                        </tr>
                      ) : (
                        users.map((u) => (
                          <tr
                            key={u.id}
                            className={
                              u.active
                                ? "hover:bg-vgsurface-low/30 transition-colors"
                                : "opacity-50 grayscale bg-slate-50/50"
                            }
                          >
                            <td className="px-6 py-4">
                              <div
                                className={`font-bold text-sm text-vgprimary ${
                                  !u.active ? "line-through" : ""
                                }`}
                              >
                                {u.name}
                              </div>
                              <div className="text-xs text-slate-400">{u.username}</div>
                            </td>
                            <td className="px-6 py-4">
                              {u.active ? (
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight ${
                                    u.role === "ADMIN"
                                      ? "bg-vgprimary-container text-vgon-primary-container"
                                      : "bg-vgsecondary-container text-vgsecondary"
                                  }`}
                                >
                                  {u.role === "ADMIN" ? "Admin" : "Operador"}
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight bg-slate-200 text-slate-500">
                                  {u.role === "ADMIN" ? "Admin" : "Operador"}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-xs font-medium text-vgon-surface-variant">
                              {u.role === "ADMIN" ? "Global" : u.sede?.name || "—"}
                            </td>
                            <td className="px-6 py-4 text-right space-x-2">
                              {u.active ? (
                                <>
                                  <button
                                    onClick={() => {
                                      setResetUser(u);
                                      setResetPassword("");
                                    }}
                                    className="p-1.5 hover:bg-white rounded-lg shadow-sm border border-transparent hover:border-vgoutline-variant/10 text-slate-400 hover:text-vgprimary transition-all"
                                    title="Resetear Contraseña"
                                  >
                                    <span className="material-symbols-outlined text-lg">lock_reset</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditUser(u);
                                      setEditUserForm({
                                        name: u.name,
                                        role: u.role,
                                        sedeId: u.sede?.id || "",
                                      });
                                      setEditUserError("");
                                    }}
                                    className="p-1.5 hover:bg-white rounded-lg shadow-sm border border-transparent hover:border-vgoutline-variant/10 text-slate-400 hover:text-vgsecondary transition-all"
                                    title="Editar"
                                  >
                                    <span className="material-symbols-outlined text-lg">edit_attributes</span>
                                  </button>
                                  <button
                                    onClick={() => handleToggleUser(u)}
                                    className="p-1.5 hover:bg-white rounded-lg shadow-sm border border-transparent hover:border-vgoutline-variant/10 text-slate-400 hover:text-vgerror transition-all"
                                    title="Desactivar"
                                  >
                                    <span
                                      className="material-symbols-outlined text-lg"
                                      style={{ fontVariationSettings: "'FILL' 1" }}
                                    >
                                      toggle_on
                                    </span>
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button className="p-1.5 text-slate-300 cursor-not-allowed" disabled>
                                    <span className="material-symbols-outlined text-lg">lock_reset</span>
                                  </button>
                                  <button className="p-1.5 text-slate-300 cursor-not-allowed" disabled>
                                    <span className="material-symbols-outlined text-lg">edit_attributes</span>
                                  </button>
                                  <button
                                    onClick={() => handleToggleUser(u)}
                                    className="p-1.5 text-slate-400 hover:text-green-600 transition-all"
                                    title="Reactivar"
                                  >
                                    <span className="material-symbols-outlined text-lg">toggle_off</span>
                                  </button>
                                </>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* ═══ MODALS ═══ */}

      {/* Create Sede */}
      <Modal
        open={showCreateSede}
        onClose={() => setShowCreateSede(false)}
        title="Crear Sede"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold ml-1">
              Nombre de la Sede
            </label>
            <input
              autoFocus
              className="bg-vgsurface-low border-none rounded-lg p-3 text-sm focus:ring-2 focus:ring-vgprimary"
              placeholder="Ej: Campus Norte"
              value={newSedeName}
              onChange={(e) => setNewSedeName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateSede()}
            />
          </div>
          {sedeError && (
            <p className="text-vgerror text-sm font-medium">{sedeError}</p>
          )}
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowCreateSede(false)}
              className="px-4 py-2 text-sm font-medium text-vgon-surface-variant hover:bg-vgsurface-low rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreateSede}
              disabled={creatingSede || !newSedeName.trim()}
              className="px-6 py-2 bg-vgprimary text-white font-bold text-sm rounded-lg disabled:opacity-50 transition-all"
            >
              {creatingSede ? "Creando..." : "Crear"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Sede */}
      <Modal
        open={!!editSede}
        onClose={() => setEditSede(null)}
        title="Editar Sede"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold ml-1">
              Nombre de la Sede
            </label>
            <input
              autoFocus
              className="bg-vgsurface-low border-none rounded-lg p-3 text-sm focus:ring-2 focus:ring-vgprimary"
              value={editSedeName}
              onChange={(e) => setEditSedeName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleEditSede()}
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setEditSede(null)}
              className="px-4 py-2 text-sm font-medium text-vgon-surface-variant hover:bg-vgsurface-low rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleEditSede}
              disabled={editingSede || !editSedeName.trim()}
              className="px-6 py-2 bg-vgprimary text-white font-bold text-sm rounded-lg disabled:opacity-50 transition-all"
            >
              {editingSede ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit User */}
      <Modal
        open={!!editUser}
        onClose={() => setEditUser(null)}
        title="Editar Usuario"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold ml-1">
              Nombre
            </label>
            <input
              autoFocus
              className="bg-vgsurface-low border-none rounded-lg p-3 text-sm focus:ring-2 focus:ring-vgprimary"
              value={editUserForm.name}
              onChange={(e) => setEditUserForm({ ...editUserForm, name: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold ml-1">
              Rol
            </label>
            <select
              className="bg-vgsurface-low border-none rounded-lg p-3 text-sm focus:ring-2 focus:ring-vgprimary"
              value={editUserForm.role}
              onChange={(e) =>
                setEditUserForm({ ...editUserForm, role: e.target.value as "ADMIN" | "OPERATOR" })
              }
            >
              <option value="OPERATOR">Operador</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </div>
          {editUserForm.role === "OPERATOR" && (
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold ml-1">
                Sede Asignada
              </label>
              <select
                className="bg-vgsurface-low border-none rounded-lg p-3 text-sm focus:ring-2 focus:ring-vgprimary"
                value={editUserForm.sedeId}
                onChange={(e) => setEditUserForm({ ...editUserForm, sedeId: e.target.value })}
              >
                <option value="">Seleccionar sede...</option>
                {activeSedes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {editUserError && (
            <p className="text-vgerror text-sm font-medium">{editUserError}</p>
          )}
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setEditUser(null)}
              className="px-4 py-2 text-sm font-medium text-vgon-surface-variant hover:bg-vgsurface-low rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleEditUser}
              disabled={editingUser || !editUserForm.name.trim()}
              className="px-6 py-2 bg-vgprimary text-white font-bold text-sm rounded-lg disabled:opacity-50 transition-all"
            >
              {editingUser ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Reset Password */}
      <Modal
        open={!!resetUser}
        onClose={() => setResetUser(null)}
        title={`Resetear Contraseña — ${resetUser?.name || ""}`}
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold ml-1">
              Nueva Contraseña
            </label>
            <input
              autoFocus
              type="password"
              className="bg-vgsurface-low border-none rounded-lg p-3 text-sm focus:ring-2 focus:ring-vgprimary"
              placeholder="Mínimo 4 caracteres"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleResetPassword()}
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setResetUser(null)}
              className="px-4 py-2 text-sm font-medium text-vgon-surface-variant hover:bg-vgsurface-low rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleResetPassword}
              disabled={resettingPassword || resetPassword.length < 4}
              className="px-6 py-2 bg-vgprimary text-white font-bold text-sm rounded-lg disabled:opacity-50 transition-all"
            >
              {resettingPassword ? "Guardando..." : "Actualizar"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
