"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Plus,
  Edit3,
  Trash2,
  Check,
  Sparkles,
  CategoryIcon,
  CATEGORY_ICON_OPTIONS,
  CATEGORY_COLOR_OPTIONS,
} from "./ui/icons";
import {
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
} from "@/app/actions";
import { triggerHaptic } from "@/lib/haptics";

export interface CategoryItem {
  id: string;
  name: string;
  icon?: string | null;
  color?: string | null;
  lastUsedAt?: Date | string | null;
}

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: CategoryItem[];
  selectedCategoryId?: string;
  onSelectCategory?: (category: CategoryItem) => void;
  onCategoriesChange?: (categories: CategoryItem[]) => void;
}

// Sugerencia inteligente de ícono según el nombre ingresado (entering-data.md › Smart defaults)
const AUTO_ICON_KEYWORDS: Array<{ keywords: string[]; icon: string; color: string }> = [
  { keywords: ["super", "coto", "carrefour", "dia", "verdura", "carniceria", "almacen", "compra"], icon: "ShoppingCart", color: "#10b981" },
  { keywords: ["alquiler", "expensa", "casa", "depto", "hogar", "inmobiliaria"], icon: "Home", color: "#3b82f6" },
  { keywords: ["luz", "gas", "agua", "internet", "wifi", "edesur", "edenor", "metrogas", "servicio"], icon: "Zap", color: "#f59e0b" },
  { keywords: ["comida", "cena", "almuerzo", "restaurante", "delivery", "pedidos", "rappi", "pizza", "burger", "salida", "bar"], icon: "Utensils", color: "#f43f5e" },
  { keywords: ["cafe", "desayuno", "merienda", "starbucks", "panaderia"], icon: "Coffee", color: "#f59e0b" },
  { keywords: ["salud", "farmacia", "medico", "dentista", "obra social", "prepaga", "remedio"], icon: "HeartPulse", color: "#ec4899" },
  { keywords: ["auto", "nafta", "ypf", "shell", "axion", "uber", "cabify", "sube", "peaje", "estacionamiento", "transporte"], icon: "Car", color: "#06b6d4" },
  { keywords: ["arreglo", "plomero", "electricista", "ferreteria", "pintura", "mantenimiento"], icon: "Wrench", color: "#64748b" },
  { keywords: ["ropa", "zapatilla", "zapatos", "remera", "pantalon", "moda"], icon: "Shirt", color: "#8b5cf6" },
  { keywords: ["gym", "gimnasio", "deporte", "futbol", "padel", "tenis", "entrenamiento", "club"], icon: "Dumbbell", color: "#10b981" },
  { keywords: ["perro", "gato", "mascota", "veterinaria", "vet", "alimento"], icon: "Dog", color: "#f59e0b" },
  { keywords: ["viaje", "vacaciones", "vuelo", "hotel", "avion", "escapada"], icon: "Plane", color: "#06b6d4" },
  { keywords: ["regalo", "cumple", "fiesta", "evento"], icon: "Gift", color: "#ec4899" },
  { keywords: ["compu", "notebook", "teclado", "mouse", "tecnologia", "software"], icon: "Laptop", color: "#6366f1" },
  { keywords: ["cine", "netflix", "disney", "max", "prime", "streaming", "pelicula", "teatro"], icon: "Film", color: "#f43f5e" },
  { keywords: ["celular", "telefono", "claro", "personal", "movistar", "icloud", "app"], icon: "Smartphone", color: "#3b82f6" },
  { keywords: ["musica", "spotify", "recital", "concierto", "show"], icon: "Music", color: "#8b5cf6" },
  { keywords: ["libro", "curso", "facultad", "estudio", "educacion", "clase"], icon: "Book", color: "#14b8a6" },
  { keywords: ["bebe", "hijo", "colegio", "jardin", "pañal"], icon: "Baby", color: "#ec4899" },
  { keywords: ["peluqueria", "barberia", "estetica", "belleza", "perfume", "skincare"], icon: "Sparkles", color: "#ec4899" },
  { keywords: ["ahorro", "inversion", "fci", "dolar", "cedear"], icon: "PiggyBank", color: "#10b981" },
];

export function CategoryManagerModal({
  isOpen,
  onClose,
  categories,
  selectedCategoryId,
  onSelectCategory,
  onCategoriesChange,
}: CategoryManagerModalProps) {
  const [mounted, setMounted] = useState(false);
  const [localCategories, setLocalCategories] = useState<CategoryItem[]>(categories);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [name, setName] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("Tag");
  const [selectedColor, setSelectedColor] = useState("#6366f1");
  const [hasManualIconOrColor, setHasManualIconOrColor] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setLocalCategories(categories);
  }, [categories]);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setPendingDeleteId(null);
      // Si no hay categorías todavía, abrir directamente el creador
      if (categories.length === 0) {
        setIsComposerOpen(true);
      } else {
        setIsComposerOpen(false);
        setEditingCategory(null);
      }
    }
  }, [isOpen, categories.length]);

  if (!isOpen || !mounted) return null;

  const updateCategoriesList = (nextList: CategoryItem[]) => {
    setLocalCategories(nextList);
    onCategoriesChange?.(nextList);
  };

  const handleOpenNew = () => {
    triggerHaptic(8);
    setEditingCategory(null);
    setName("");
    setSelectedIcon("Tag");
    setSelectedColor("#6366f1");
    setHasManualIconOrColor(false);
    setErrorMsg(null);
    setIsComposerOpen(true);
  };

  const handleStartEdit = (cat: CategoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic(8);
    setEditingCategory(cat);
    setName(cat.name);
    setSelectedIcon(cat.icon || "Tag");
    setSelectedColor(cat.color || "#6366f1");
    setHasManualIconOrColor(true);
    setErrorMsg(null);
    setPendingDeleteId(null);
    setIsComposerOpen(true);
  };

  const handleCancelComposer = () => {
    triggerHaptic(6);
    setEditingCategory(null);
    setName("");
    setSelectedIcon("Tag");
    setSelectedColor("#6366f1");
    setHasManualIconOrColor(false);
    setErrorMsg(null);
    setIsComposerOpen(false);
  };

  const handleNameChange = (val: string) => {
    setName(val);
    if (!editingCategory && !hasManualIconOrColor && val.trim().length >= 2) {
      const lower = val.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const match = AUTO_ICON_KEYWORDS.find((item) =>
        item.keywords.some((kw) => lower.includes(kw))
      );
      if (match) {
        setSelectedIcon(match.icon);
        setSelectedColor(match.color);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!name.trim()) return;

    triggerHaptic(12);
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      if (editingCategory) {
        const updated = await updateCategoryAction({
          id: editingCategory.id,
          name: name.trim(),
          icon: selectedIcon,
          color: selectedColor,
        });
        if (updated) {
          const nextList = [
            updated,
            ...localCategories.filter((c) => c.id !== updated.id),
          ];
          updateCategoriesList(nextList);
          if (onSelectCategory) {
            onSelectCategory(updated);
          }
        }
      } else {
        const created = await createCategoryAction({
          name: name.trim(),
          icon: selectedIcon,
          color: selectedColor,
        });
        if (created) {
          const nextList = [
            created,
            ...localCategories.filter((c) => c.id !== created.id),
          ];
          updateCategoriesList(nextList);
          if (onSelectCategory) {
            onSelectCategory(created);
          }
        }
      }
      handleCancelComposer();
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : "No se pudo guardar la categoría"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = async (cat: CategoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic(12);

    if (pendingDeleteId !== cat.id) {
      setPendingDeleteId(cat.id);
      setErrorMsg(null);
      return;
    }

    setPendingDeleteId(null);
    setDeletingId(cat.id);
    setErrorMsg(null);
    try {
      await deleteCategoryAction(cat.id);
      const nextList = localCategories.filter((c) => c.id !== cat.id);
      updateCategoriesList(nextList);
      if (editingCategory?.id === cat.id) {
        handleCancelComposer();
      }
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : "No se pudo eliminar la categoría"
      );
    } finally {
      setDeletingId(null);
    }
  };

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Gestionar Categorías"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/45 backdrop-blur-sm animate-fade-in p-0 sm:p-4"
    >
      <div
        onClick={(e) => {
          e.stopPropagation();
          if (pendingDeleteId) setPendingDeleteId(null);
        }}
        className="w-full max-w-md apple-glass-sheet rounded-t-[30px] sm:rounded-[28px] px-5 pt-3 pb-6 flex flex-col max-h-[90vh] overflow-hidden animate-scale-up"
      >
        {/* Grabber estilo iOS Sheet (sheets.md › Mobile) */}
        <div className="w-9 h-1 rounded-full bg-white/25 mx-auto mb-2.5 shrink-0" />

        {/* Barra de Navegación Superior estilo iOS (Cerrar | Título | + Nueva / Cancelar) */}
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/[0.08] shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="min-h-[32px] px-3 rounded-full bg-white/[0.07] hover:bg-white/[0.12] text-xs font-semibold text-zinc-300 hover:text-white active:scale-95 transition flex items-center"
          >
            Cerrar
          </button>

          <div className="text-center">
            <h2 className="text-[15px] font-bold text-white tracking-tight">
              {isComposerOpen
                ? editingCategory
                  ? "Editar Categoría"
                  : "Nueva Categoría"
                : "Categorías"}
            </h2>
          </div>

          {isComposerOpen ? (
            <button
              type="button"
              onClick={handleCancelComposer}
              className="min-h-[32px] px-3 rounded-full bg-white/[0.07] hover:bg-white/[0.12] text-xs font-semibold text-zinc-300 hover:text-white active:scale-95 transition flex items-center"
            >
              Cancelar
            </button>
          ) : (
            <button
              type="button"
              onClick={handleOpenNew}
              className="min-h-[32px] px-3 rounded-full bg-[#0A84FF] hover:brightness-110 text-xs font-bold text-white shadow-sm shadow-blue-500/25 active:scale-95 transition flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nueva</span>
            </button>
          )}
        </div>

        {/* Cuerpo Scrollable con data-sheet-scroll para proteger el Pull-to-Refresh */}
        <div
          data-sheet-scroll
          className="flex-1 overflow-y-auto overscroll-contain no-scrollbar pt-3 space-y-4"
        >
          {/* Banner de Error Inline (feedback.md › Sin alerts bloqueantes) */}
          {errorMsg && (
            <div className="bg-rose-500/15 border border-rose-500/30 text-rose-200 px-3.5 py-2.5 rounded-2xl text-xs font-medium flex items-center justify-between gap-2 animate-fade-in">
              <span>{errorMsg}</span>
              <button
                type="button"
                onClick={() => setErrorMsg(null)}
                className="text-[11px] font-bold text-rose-300 hover:text-white shrink-0 px-1.5 py-0.5 rounded-lg bg-rose-500/20"
              >
                OK
              </button>
            </div>
          )}

          {/* Compositor Desplegable: Crear / Editar Categoría (Progressive Disclosure) */}
          {isComposerOpen && (
            <form
              onSubmit={handleSubmit}
              className="p-4 rounded-2xl super-card-subtle space-y-3.5 animate-fade-in border border-white/[0.1]"
            >
              {/* Vista Previa en Vivo (Craft: ver cómo queda el chip antes de guardar) */}
              <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-white/[0.06]">
                <span className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#0A84FF]" />
                  <span>Vista previa</span>
                </span>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.06] border border-white/[0.1]">
                  <span
                    className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: `${selectedColor}28`,
                      color: selectedColor,
                    }}
                  >
                    <CategoryIcon
                      name={name || "Categoría"}
                      icon={selectedIcon}
                      className="w-3.5 h-3.5"
                    />
                  </span>
                  <span className="text-xs font-semibold text-white truncate max-w-[160px]">
                    {name.trim() || "Nombre de categoría"}
                  </span>
                </div>
              </div>

              {/* Campo Nombre */}
              <div>
                <label className="text-[11px] font-semibold text-zinc-400 block mb-1.5">
                  Nombre
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Ej. Veterinaria, Gym, Café, Ropa..."
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full bg-white/[0.05] border border-white/[0.12] rounded-xl px-3.5 py-2.5 text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#0A84FF] transition"
                />
              </div>

              {/* Selector de Color (Targets táctiles accesibles) */}
              <div>
                <label className="text-[11px] font-semibold text-zinc-400 block mb-1.5">
                  Color distintivo
                </label>
                <div
                  onTouchStart={(e) => e.stopPropagation()}
                  onTouchMove={(e) => e.stopPropagation()}
                  onTouchEnd={(e) => e.stopPropagation()}
                  className="flex items-center gap-2 overflow-x-auto touch-pan-x overscroll-x-contain no-scrollbar py-1 px-0.5 scroll-smooth"
                  style={{ WebkitOverflowScrolling: "touch" }}
                >
                  {CATEGORY_COLOR_OPTIONS.map((c) => {
                    const isSelected = selectedColor === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        aria-label={`Color ${c.label}`}
                        title={c.label}
                        onClick={() => {
                          triggerHaptic(6);
                          setSelectedColor(c.id);
                          setHasManualIconOrColor(true);
                        }}
                        className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center transition active:scale-90 ${c.bg} ${
                          isSelected
                            ? "ring-2 ring-white ring-offset-2 ring-offset-[#141419] scale-105"
                            : "opacity-75 hover:opacity-100"
                        }`}
                      >
                        {isSelected && (
                          <Check className="w-4 h-4 text-white stroke-[3]" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selector de Ícono */}
              <div>
                <label className="text-[11px] font-semibold text-zinc-400 block mb-1.5">
                  Ícono
                </label>
                <div className="grid grid-cols-6 gap-1.5 max-h-36 overflow-y-auto no-scrollbar p-1.5 bg-black/25 rounded-xl border border-white/[0.06]">
                  {CATEGORY_ICON_OPTIONS.map((opt) => {
                    const isSelected = selectedIcon === opt.id;
                    const IconComp = opt.icon;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        aria-label={opt.label}
                        title={opt.label}
                        onClick={() => {
                          triggerHaptic(6);
                          setSelectedIcon(opt.id);
                          setHasManualIconOrColor(true);
                        }}
                        className={`h-10 rounded-xl flex items-center justify-center transition active:scale-90 ${
                          isSelected
                            ? "bg-white text-zinc-950 shadow-md font-bold"
                            : "bg-white/[0.04] text-zinc-300 hover:bg-white/[0.09] hover:text-white"
                        }`}
                      >
                        <IconComp className="w-4 h-4" />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Botón de Confirmación del Compositor */}
              <button
                type="submit"
                disabled={isSubmitting || !name.trim()}
                className="w-full py-3 rounded-xl bg-[#0A84FF] hover:brightness-110 disabled:opacity-40 text-white font-bold text-xs shadow-lg shadow-blue-500/25 flex items-center justify-center gap-1.5 active:scale-[0.98] transition"
              >
                <Check className="w-4 h-4" />
                <span>
                  {isSubmitting
                    ? "Guardando..."
                    : editingCategory
                    ? "Guardar Cambios"
                    : onSelectCategory
                    ? "Crear y Seleccionar"
                    : "Crear Categoría"}
                </span>
              </button>
            </form>
          )}

          {/* Lista Agrupada Estilo iOS (Inset Grouped List — lists-and-tables.md) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-semibold text-zinc-400">
                {onSelectCategory
                  ? "Tocá una categoría para asignarla"
                  : `Categorías disponibles (${localCategories.length})`}
              </span>
              <span className="text-[11px] text-zinc-500">
                Recientes primero
              </span>
            </div>

            <div className="super-card-subtle rounded-2xl divide-y divide-white/[0.07] overflow-hidden border border-white/[0.08]">
              {localCategories.map((cat, idx) => {
                const isSelected = selectedCategoryId === cat.id;
                const isMostRecent = idx === 0;
                const isPendingDelete = pendingDeleteId === cat.id;
                const catColor = cat.color || "#6366f1";

                return (
                  <div
                    key={cat.id}
                    onClick={() => {
                      if (onSelectCategory) {
                        triggerHaptic(10);
                        onSelectCategory(cat);
                        onClose();
                      }
                    }}
                    className={`px-3.5 py-2.5 flex items-center justify-between gap-2 transition ${
                      onSelectCategory
                        ? "cursor-pointer hover:bg-white/[0.05] active:bg-white/[0.08]"
                        : "hover:bg-white/[0.03]"
                    } ${isSelected ? "bg-[#0A84FF]/[0.08]" : ""}`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: `${catColor}26`,
                          color: catColor,
                        }}
                      >
                        <CategoryIcon
                          name={cat.name}
                          icon={cat.icon}
                          className="w-4 h-4"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[14px] font-semibold text-white truncate">
                            {cat.name}
                          </span>
                          {isSelected && (
                            <Check className="w-4 h-4 text-[#0A84FF] shrink-0 stroke-[2.5]" />
                          )}
                          {isMostRecent && !isSelected && (
                            <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 text-[10px] font-semibold shrink-0">
                              Reciente
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Acciones por fila con tamaño mínimo de control iOS >= 32px */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => handleStartEdit(cat, e)}
                        aria-label={`Editar ${cat.name}`}
                        title="Editar categoría"
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.08] active:scale-90 transition"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        disabled={deletingId === cat.id}
                        onClick={(e) => handleDeleteClick(cat, e)}
                        aria-label={
                          isPendingDelete
                            ? `Confirmar eliminar ${cat.name}`
                            : `Eliminar ${cat.name}`
                        }
                        title={
                          isPendingDelete
                            ? "Tocá de nuevo para eliminar"
                            : "Eliminar categoría"
                        }
                        className={`h-8 rounded-xl flex items-center justify-center gap-1 transition active:scale-90 disabled:opacity-50 ${
                          isPendingDelete
                            ? "px-2.5 bg-rose-600 text-white text-[11px] font-bold shadow-md"
                            : "w-8 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10"
                        }`}
                      >
                        <Trash2 className="w-3.5 h-3.5 shrink-0" />
                        {isPendingDelete && <span>¿Borrar?</span>}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
