"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import QRCode from "react-qr-code";

/* ─── Types ─── */

interface Category {
  id: string;
  name: string;
  itemCount: number;
}

interface InventoryItem {
  id: string;
  internalCode: string;
  name: string;
  description: string | null;
  status: "AVAILABLE" | "LOANED" | "OUT_OF_SERVICE";
  category: { id: string; name: string };
}

interface Counts {
  total: number;
  available: number;
  loaned: number;
  outOfService: number;
}

interface Distribution {
  name: string;
  count: number;
  percentage: number;
}

/* ─── Constants ─── */

const ITEMS_PER_PAGE = 10;

const STATUS_CONFIG = {
  AVAILABLE: { label: "Disponible", dotColor: "bg-vgsecondary", textColor: "text-vgsecondary" },
  LOANED: { label: "Prestado", dotColor: "bg-vgon-tertiary-container", textColor: "text-vgon-tertiary-container" },
  OUT_OF_SERVICE: { label: "Fuera de Servicio", dotColor: "bg-vgerror", textColor: "text-vgerror" },
} as const;

const DISTRIBUTION_COLORS = [
  "bg-vgprimary",
  "bg-vgsecondary",
  "bg-vgon-tertiary-container",
  "bg-vgprimary-container",
  "bg-vgerror",
  "bg-vgon-primary-fixed-variant",
];

/* ─── Page Component ─── */

export default function InventarioPage() {
  // Data state
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [counts, setCounts] = useState<Counts>({ total: 0, available: 0, loaned: 0, outOfService: 0 });
  const [categories, setCategories] = useState<Category[]>([]);
  const [distribution, setDistribution] = useState<Distribution[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filterCategoryId, setFilterCategoryId] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // QR preview
  const [selectedQRCode, setSelectedQRCode] = useState<string | null>(null);
  const [selectedQRName, setSelectedQRName] = useState<string | null>(null);

  // Edit state
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Add form state
  const [addName, setAddName] = useState("");
  const [addCategoryId, setAddCategoryId] = useState("");
  const [addCode, setAddCode] = useState("");
  const [addDescription, setAddDescription] = useState("");
  const [addQuantity, setAddQuantity] = useState(1);
  const [addSaving, setAddSaving] = useState(false);

  // Category management
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState<string | null>(null);

  // Toggle state
  const [togglingId, setTogglingId] = useState<string | null>(null);

  /* ─── Data Fetching ─── */

  const fetchItems = useCallback(async (pageNum: number, catId: string, status: string) => {
    try {
      const params = new URLSearchParams({
        page: String(pageNum),
        limit: String(ITEMS_PER_PAGE),
      });
      if (catId) params.set("categoryId", catId);
      if (status) params.set("status", status);
      const res = await fetch(`/api/inventory/items?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.items);
      setCounts(data.counts);
      setTotalPages(data.totalPages);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    const res = await fetch("/api/inventory/categories");
    if (!res.ok) return;
    const data = await res.json();
    setCategories(data.categories);
  }, []);

  const fetchDistribution = useCallback(async () => {
    const res = await fetch("/api/inventory/distribution");
    if (!res.ok) return;
    const data = await res.json();
    setDistribution(data.distribution);
  }, []);

  useEffect(() => {
    fetchItems(page, filterCategoryId, filterStatus);
  }, [fetchItems, page, filterCategoryId, filterStatus]);

  useEffect(() => {
    fetchCategories();
    fetchDistribution();
  }, [fetchCategories, fetchDistribution]);

  /* ─── Handlers ─── */

  function refreshAll() {
    fetchItems(page, filterCategoryId, filterStatus);
    fetchCategories();
    fetchDistribution();
  }

  async function handleToggleService(item: InventoryItem) {
    setTogglingId(item.id);
    try {
      const res = await fetch(`/api/inventory/items/${item.id}/toggle-service`, { method: "PATCH" });
      if (res.ok) refreshAll();
    } finally {
      setTogglingId(null);
    }
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    setAddSaving(true);
    try {
      const res = await fetch("/api/inventory/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addName,
          categoryId: addCategoryId,
          description: addDescription || undefined,
          internalCode: addCode || undefined,
          quantity: addQuantity,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        // Set QR preview to last created item
        if (data.items?.length > 0) {
          const lastItem = data.items[data.items.length - 1];
          setSelectedQRCode(lastItem.internalCode);
          setSelectedQRName(addName);
        }
        setShowAddModal(false);
        resetAddForm();
        refreshAll();
      }
    } finally {
      setAddSaving(false);
    }
  }

  function resetAddForm() {
    setAddName("");
    setAddCategoryId("");
    setAddCode("");
    setAddDescription("");
    setAddQuantity(1);
  }

  function openEditModal(item: InventoryItem) {
    setEditingItem(item);
    setEditName(item.name);
    setEditDescription(item.description || "");
    setEditCategoryId(item.category.id);
    setShowEditModal(true);
  }

  async function handleEditItem(e: React.FormEvent) {
    e.preventDefault();
    if (!editingItem) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/inventory/items/${editingItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          description: editDescription || undefined,
          categoryId: editCategoryId,
        }),
      });
      if (res.ok) {
        setShowEditModal(false);
        setEditingItem(null);
        refreshAll();
      }
    } finally {
      setEditSaving(false);
    }
  }

  function openQRModal(item: InventoryItem) {
    setSelectedQRCode(item.internalCode);
    setSelectedQRName(item.name);
    setShowQRModal(true);
  }

  async function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    setAddingCategory(true);
    try {
      const res = await fetch("/api/inventory/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCategoryName.trim() }),
      });
      if (res.ok) {
        setNewCategoryName("");
        fetchCategories();
        fetchDistribution();
      }
    } finally {
      setAddingCategory(false);
    }
  }

  async function handleDeleteCategory(id: string) {
    setDeletingCategory(id);
    try {
      const res = await fetch(`/api/inventory/categories/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchCategories();
        fetchDistribution();
      }
    } finally {
      setDeletingCategory(null);
    }
  }

  /* ─── Render ─── */

  return (
    <>
      {/* Page Header */}
      <div className="px-8 pt-8 pb-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-vgprimary" style={{ fontFamily: "Manrope, sans-serif" }}>
              Inventario
            </h1>
            <p className="text-vgon-surface-variant font-medium mt-1" style={{ fontFamily: "Inter, sans-serif" }}>
              Estado en tiempo real de los artículos de la sede.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowCategoriesModal(true)}
              className="flex items-center gap-2 px-6 py-3 bg-vgsurface-container-high text-vgon-surface rounded-xl font-bold text-sm hover:bg-vgsurface-highest transition-all"
            >
              <span className="material-symbols-outlined">category</span>
              Gestionar Categorías
            </button>
            <button
              onClick={() => {
                if (categories.length > 0) setAddCategoryId(categories[0].id);
                setShowAddModal(true);
              }}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-vgprimary to-vgprimary-container text-vgon-primary rounded-xl font-bold text-sm shadow-xl active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined">add</span>
              Agregar Artículo
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards (clickable filters) */}
      <div className="px-8 pb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {([
            { key: "", label: "Total Artículos", value: counts.total, border: "border-vgprimary", ring: "ring-vgprimary/30", textColor: "text-vgprimary", borderDim: "border-vgprimary/10" },
            { key: "AVAILABLE", label: "Disponibles", value: counts.available, border: "border-vgsecondary", ring: "ring-vgsecondary/30", textColor: "text-vgsecondary", borderDim: "border-vgsecondary/10" },
            { key: "LOANED", label: "Prestados", value: counts.loaned, border: "border-vgon-tertiary-container", ring: "ring-vgon-tertiary-container/30", textColor: "text-vgon-tertiary-container", borderDim: "border-vgon-tertiary-container/10" },
            { key: "OUT_OF_SERVICE", label: "Fuera de Servicio", value: counts.outOfService, border: "border-vgerror", ring: "ring-vgerror/30", textColor: "text-vgerror", borderDim: "border-vgerror/10" },
          ] as const).map((card) => {
            const isActive = filterStatus === card.key;
            return (
              <button
                key={card.key}
                onClick={() => { setFilterStatus(isActive ? "" : card.key); setPage(1); }}
                className={`text-left p-6 rounded-xl border-b-2 transition-all cursor-pointer ${
                  isActive
                    ? `${card.border} bg-white shadow-lg ring-2 ring-offset-1 ${card.ring} scale-[1.02]`
                    : `${card.borderDim} bg-vgsurface-lowest hover:shadow-md hover:scale-[1.01]`
                }`}
              >
                <div className="text-[10px] font-bold text-vgoutline uppercase tracking-widest mb-2">{card.label}</div>
                <div className={`text-3xl font-black ${card.textColor}`}>{card.value}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="px-8 pb-4">
        <div className="flex flex-wrap gap-4 items-center bg-vgsurface-low p-2 rounded-full px-6">
          <span className="text-xs font-bold text-vgoutline uppercase">Filtrar por:</span>
          <button
            onClick={() => { setFilterCategoryId(""); setPage(1); }}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${
              filterCategoryId === ""
                ? "bg-white text-vgprimary shadow-sm border border-vgoutline-variant/20"
                : "text-vgoutline hover:bg-vgsurface-highest"
            }`}
          >
            Todos
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => { setFilterCategoryId(cat.id); setPage(1); }}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${
                filterCategoryId === cat.id
                  ? "bg-white text-vgprimary shadow-sm border border-vgoutline-variant/20"
                  : "text-vgoutline hover:bg-vgsurface-highest"
              }`}
            >
              {cat.name}
            </button>
          ))}
          <div className="ml-auto flex gap-2">
            <button className="p-2 text-vgoutline hover:text-vgprimary">
              <span className="material-symbols-outlined text-[20px]">sort</span>
            </button>
            <button className="p-2 text-vgoutline hover:text-vgprimary">
              <span className="material-symbols-outlined text-[20px]">filter_list</span>
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="px-8 pb-6">
        <div className="bg-vgsurface-lowest rounded-xl overflow-hidden shadow-sm border border-vgoutline-variant/10">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-vgoutline">
              <span className="material-symbols-outlined animate-spin mr-3">progress_activity</span>
              Cargando inventario...
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-vgsurface-low/50">
                  <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-vgoutline">Código</th>
                  <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-vgoutline">Nombre y Descripción</th>
                  <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-vgoutline">Categoría</th>
                  <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-vgoutline">Estado</th>
                  <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-vgoutline text-center">Servicio</th>
                  <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-vgoutline text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-vgsurface-low">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center text-vgoutline">
                      No hay artículos en el inventario.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const config = STATUS_CONFIG[item.status];
                    const isOOS = item.status === "OUT_OF_SERVICE";
                    const isLoaned = item.status === "LOANED";
                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-vgsurface-low/30 transition-colors group ${isOOS ? "bg-vgerror-container/5" : ""}`}
                      >
                        <td className="px-6 py-4 font-mono text-xs font-bold text-vgprimary">{item.internalCode}</td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-sm text-vgon-surface">{item.name}</div>
                          {item.description && (
                            <div className="text-[11px] text-vgoutline">{item.description}</div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="bg-vgsurface-container-high text-vgprimary px-3 py-1 rounded-full text-[10px] font-bold uppercase">
                            {item.category.name}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${config.dotColor}`} />
                            <span className={`text-xs font-bold ${config.textColor}`}>{config.label}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <label className="relative inline-flex items-center cursor-pointer" title={isLoaned ? "No se puede cambiar mientras está prestado" : ""}>
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={isOOS}
                              disabled={isLoaned || togglingId === item.id}
                              onChange={() => handleToggleService(item)}
                            />
                            <div className={`w-9 h-5 rounded-full peer after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full ${
                              isLoaned
                                ? "bg-vgsurface-highest opacity-40 cursor-not-allowed"
                                : "bg-vgsurface-highest peer-checked:bg-vgprimary cursor-pointer"
                            }`} />
                          </label>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => openQRModal(item)}
                              className="p-2 bg-vgsurface-container-high text-vgprimary rounded-lg hover:bg-vgprimary hover:text-white transition-all"
                              title="Generar QR"
                            >
                              <span className="material-symbols-outlined text-[18px]">qr_code_2</span>
                            </button>
                            <button
                              onClick={() => openEditModal(item)}
                              className="p-2 bg-vgsurface-container-high text-vgprimary rounded-lg hover:bg-vgsecondary hover:text-white transition-all"
                              title="Editar"
                            >
                              <span className="material-symbols-outlined text-[18px]">edit</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {/* Pagination */}
          {!loading && items.length > 0 && (
            <div className="px-6 py-4 bg-vgsurface-low flex justify-between items-center">
              <span className="text-xs font-medium text-vgoutline">
                Página {page} de {totalPages} — {counts.total} artículos
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-2 rounded-lg hover:bg-vgsurface-container-high transition-colors disabled:opacity-30"
                >
                  <span className="material-symbols-outlined text-sm">chevron_left</span>
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`p-2 rounded-lg font-bold text-xs px-3 ${
                      p === page
                        ? "bg-white shadow-sm text-vgprimary"
                        : "hover:bg-vgsurface-container-high text-vgoutline"
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-2 rounded-lg hover:bg-vgsurface-container-high transition-colors disabled:opacity-30"
                >
                  <span className="material-symbols-outlined text-sm">chevron_right</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Panels */}
      <div className="px-8 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* QR Preview Panel */}
          <div className="lg:col-span-1 bg-white p-6 rounded-xl border border-vgoutline-variant/10 shadow-xl flex flex-col items-center justify-center text-center">
            <h3 className="text-sm font-black text-vgprimary uppercase tracking-tighter mb-4" style={{ fontFamily: "Manrope, sans-serif" }}>
              Vista Previa QR
            </h3>
            {selectedQRCode ? (
              <>
                <div className="p-4 border-4 border-vgprimary rounded-xl mb-4">
                  <QRCode value={selectedQRCode} size={128} />
                </div>
                <div className="font-mono text-lg font-bold text-vgprimary mb-1">{selectedQRCode}</div>
                {selectedQRName && (
                  <p className="text-[10px] text-vgoutline uppercase font-bold tracking-widest">{selectedQRName}</p>
                )}
              </>
            ) : (
              <div className="p-4 border-4 border-vgoutline-variant/20 rounded-xl mb-4">
                <div className="w-32 h-32 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[100px] text-vgoutline-variant/30">qr_code_2</span>
                </div>
              </div>
            )}
          </div>

          {/* Distribution Panel */}
          <div className="lg:col-span-2 bg-vgsurface-low p-6 rounded-xl">
            <h3 className="text-sm font-black text-vgprimary uppercase tracking-tighter mb-6" style={{ fontFamily: "Manrope, sans-serif" }}>
              Distribución de Inventario
            </h3>
            <div className="space-y-4">
              {distribution.length === 0 ? (
                <p className="text-sm text-vgoutline">No hay datos de distribución.</p>
              ) : (
                distribution.map((d, i) => (
                  <div key={d.name} className="space-y-2">
                    <div className="flex justify-between text-xs font-bold">
                      <span>{d.name}</span>
                      <span>{d.percentage}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-vgsurface-container-high rounded-full overflow-hidden">
                      <div
                        className={`h-full ${DISTRIBUTION_COLORS[i % DISTRIBUTION_COLORS.length]} transition-all duration-500`}
                        style={{ width: `${d.percentage}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Modal: Agregar Artículo ─── */}
      {showAddModal && (
        <ModalOverlay onClose={() => setShowAddModal(false)}>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-black text-vgprimary tracking-tight" style={{ fontFamily: "Manrope, sans-serif" }}>
              Agregar Artículo
            </h2>
            <button onClick={() => setShowAddModal(false)} className="material-symbols-outlined text-vgoutline hover:text-vgerror transition-colors">
              close
            </button>
          </div>
          <form onSubmit={handleAddItem} className="space-y-6">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-vgoutline uppercase tracking-widest">Nombre del Artículo</label>
              <input
                className="w-full bg-vgsurface-highest border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-vgprimary text-sm"
                placeholder="ej. Calculadora Científica"
                type="text"
                required
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-vgoutline uppercase tracking-widest">Categoría</label>
                <select
                  className="w-full bg-vgsurface-highest border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-vgprimary text-sm font-medium"
                  required
                  value={addCategoryId}
                  onChange={(e) => setAddCategoryId(e.target.value)}
                >
                  <option value="">Seleccionar...</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-vgoutline uppercase tracking-widest">Código Interno</label>
                <input
                  className="w-full bg-vgsurface-highest border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-vgprimary text-sm"
                  placeholder="Auto si vacío"
                  type="text"
                  value={addCode}
                  onChange={(e) => setAddCode(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-vgoutline uppercase tracking-widest">Descripción</label>
              <textarea
                className="w-full bg-vgsurface-highest border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-vgprimary text-sm"
                placeholder="Detalles del artículo (opcional)"
                rows={3}
                value={addDescription}
                onChange={(e) => setAddDescription(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-vgoutline uppercase tracking-widest">Cantidad</label>
              <input
                className="w-full bg-vgsurface-highest border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-vgprimary text-sm"
                type="number"
                min={1}
                max={100}
                value={addQuantity}
                onChange={(e) => setAddQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              />
              {addQuantity > 1 && addName && (
                <p className="text-[11px] text-vgsecondary mt-1">
                  Se generarán {addQuantity} artículos con códigos secuenciales (ej. {addName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z]/g, "").substring(0, 4).toUpperCase()}-001 a {addName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z]/g, "").substring(0, 4).toUpperCase()}-{String(addQuantity).padStart(3, "0")})
                </p>
              )}
            </div>
            <div className="pt-4 flex gap-3">
              <button
                type="button"
                onClick={() => { setShowAddModal(false); resetAddForm(); }}
                className="flex-1 px-6 py-3 bg-vgsurface-container-high text-vgprimary rounded-xl font-bold text-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={addSaving}
                className="flex-1 px-6 py-3 bg-vgprimary text-vgon-primary rounded-xl font-bold text-sm shadow-lg disabled:opacity-50"
              >
                {addSaving ? "Guardando..." : "Guardar Artículo"}
              </button>
            </div>
          </form>
        </ModalOverlay>
      )}

      {/* ─── Modal: Gestionar Categorías ─── */}
      {showCategoriesModal && (
        <ModalOverlay onClose={() => setShowCategoriesModal(false)}>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-black text-vgprimary tracking-tight" style={{ fontFamily: "Manrope, sans-serif" }}>
              Gestionar Categorías
            </h2>
            <button onClick={() => setShowCategoriesModal(false)} className="material-symbols-outlined text-vgoutline hover:text-vgerror transition-colors">
              close
            </button>
          </div>

          {/* Category List */}
          <div className="space-y-2 mb-6 max-h-[300px] overflow-y-auto">
            {categories.length === 0 ? (
              <p className="text-sm text-vgoutline text-center py-4">No hay categorías creadas.</p>
            ) : (
              categories.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between p-3 bg-vgsurface-low rounded-xl">
                  <div>
                    <span className="font-bold text-sm text-vgon-surface">{cat.name}</span>
                    <span className="text-xs text-vgoutline ml-2">({cat.itemCount} artículos)</span>
                  </div>
                  <button
                    onClick={() => handleDeleteCategory(cat.id)}
                    disabled={cat.itemCount > 0 || deletingCategory === cat.id}
                    title={cat.itemCount > 0 ? "No se puede eliminar: tiene artículos asociados" : "Eliminar categoría"}
                    className="p-1.5 rounded-lg text-vgerror hover:bg-vgerror-container transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {deletingCategory === cat.id ? "progress_activity" : "delete"}
                    </span>
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Add Category */}
          <form onSubmit={handleAddCategory} className="flex gap-3">
            <input
              className="flex-1 bg-vgsurface-highest border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-vgprimary text-sm"
              placeholder="Nombre de la categoría"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              required
            />
            <button
              type="submit"
              disabled={addingCategory}
              className="px-6 py-3 bg-vgprimary text-vgon-primary rounded-xl font-bold text-sm disabled:opacity-50"
            >
              {addingCategory ? "..." : "Agregar"}
            </button>
          </form>
        </ModalOverlay>
      )}

      {/* ─── Modal: QR Code ─── */}
      {showQRModal && selectedQRCode && (
        <ModalOverlay onClose={() => setShowQRModal(false)}>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-black text-vgprimary tracking-tight" style={{ fontFamily: "Manrope, sans-serif" }}>
              Código QR
            </h2>
            <button onClick={() => setShowQRModal(false)} className="material-symbols-outlined text-vgoutline hover:text-vgerror transition-colors">
              close
            </button>
          </div>
          <div className="flex flex-col items-center">
            <div id="qr-print-area" className="p-6 border-4 border-vgprimary rounded-xl mb-4">
              <QRCode value={selectedQRCode} size={200} />
            </div>
            <div className="font-mono text-lg font-bold text-vgprimary mb-1">{selectedQRCode}</div>
            {selectedQRName && (
              <p className="text-sm text-vgoutline mb-6">{selectedQRName}</p>
            )}
            <button
              onClick={() => {
                const printWindow = window.open("", "_blank");
                if (!printWindow) return;
                printWindow.document.write(`
                  <html><head><title>QR - ${selectedQRCode}</title>
                  <style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:monospace;margin:0}
                  .code{font-size:18px;font-weight:bold;margin-top:16px}</style></head>
                  <body>
                  <div id="qr"></div>
                  <div class="code">${selectedQRCode}</div>
                  <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js"><\/script>
                  <script>
                    QRCode.toCanvas(document.createElement('canvas'),
                      '${selectedQRCode}', {width:300}, function(err,canvas){
                        if(!err) document.getElementById('qr').appendChild(canvas);
                        setTimeout(function(){window.print();window.close()},500);
                      });
                  <\/script>
                  </body></html>
                `);
                printWindow.document.close();
              }}
              className="w-full flex items-center justify-center gap-2 bg-vgsurface-highest text-vgprimary py-3 rounded-xl text-sm font-bold hover:bg-vgprimary hover:text-white transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">print</span>
              Imprimir Etiqueta
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* ─── Modal: Editar Artículo ─── */}
      {showEditModal && editingItem && (
        <ModalOverlay onClose={() => setShowEditModal(false)}>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-black text-vgprimary tracking-tight" style={{ fontFamily: "Manrope, sans-serif" }}>
              Editar Artículo
            </h2>
            <button onClick={() => setShowEditModal(false)} className="material-symbols-outlined text-vgoutline hover:text-vgerror transition-colors">
              close
            </button>
          </div>
          <form onSubmit={handleEditItem} className="space-y-6">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-vgoutline uppercase tracking-widest">Nombre del Artículo</label>
              <input
                className="w-full bg-vgsurface-highest border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-vgprimary text-sm"
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-vgoutline uppercase tracking-widest">Categoría</label>
              <select
                className="w-full bg-vgsurface-highest border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-vgprimary text-sm font-medium"
                required
                value={editCategoryId}
                onChange={(e) => setEditCategoryId(e.target.value)}
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-vgoutline uppercase tracking-widest">Descripción</label>
              <textarea
                className="w-full bg-vgsurface-highest border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-vgprimary text-sm"
                placeholder="Descripción (opcional)"
                rows={3}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </div>
            <div className="pt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="flex-1 px-6 py-3 bg-vgsurface-container-high text-vgprimary rounded-xl font-bold text-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={editSaving}
                className="flex-1 px-6 py-3 bg-vgprimary text-vgon-primary rounded-xl font-bold text-sm shadow-lg disabled:opacity-50"
              >
                {editSaving ? "Guardando..." : "Guardar Cambios"}
              </button>
            </div>
          </form>
        </ModalOverlay>
      )}
    </>
  );
}

/* ─── Modal Overlay Component ─── */

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const overlayRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 bg-vgprimary/20 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-8" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
