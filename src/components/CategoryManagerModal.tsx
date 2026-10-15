"use client";

import React, { useState } from "react";
import {
  X,
  Plus,
  Edit3,
  Trash2,
  Check,
  Sparkles,
  Tag,
  CategoryIcon,
  CATEGORY_ICON_OPTIONS,
  CATEGORY_COLOR_OPTIONS,
} from "./ui/icons";
import {
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
} from "@/app/actions";

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
  onSelectCategory?: (category: CategoryItem) => void;
}

export function CategoryManagerModal({
  isOpen,
  onClose,
  categories,
  onSelectCategory,
}: CategoryManagerModalProps) {
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [name, setName] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("Tag");
  const [selectedColor, setSelectedColor] = useState("#6366f1");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStartEdit = (cat: CategoryItem) => {
    setEditingCategory(cat);
    setName(cat.name);
    setSelectedIcon(cat.icon || "Tag");
    setSelectedColor(cat.color || "#6366f1");
    setErrorMsg(null);
  };

  const handleCancelEdit = () => {
    setEditingCategory(null);
    setName("");
    setSelectedIcon("Tag");
    setSelectedColor("#6366f1");
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

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
        if (onSelectCategory && updated) {
          onSelectCategory(updated);
        }
      } else {
        const created = await createCategoryAction({
          name: name.trim(),
          icon: selectedIcon,
          color: selectedColor,
        });
        if (onSelectCategory && created) {
          onSelectCategory(created);
        }
      }
      handleCancelEdit();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Error al guardar la categoría");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (cat: CategoryItem) => {
    if (!confirm(`¿Eliminar la categoría "${cat.name}"?`)) return;

    setDeletingId(cat.id);
    setErrorMsg(null);
    try {
      await deleteCategoryAction(cat.id);
      if (editingCategory?.id === cat.id) {
        handleCancelEdit();
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error al eliminar la categoría");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in p-0 sm:p-4">
      <div className="w-full max-w-md super-card rounded-t-[32px] sm:rounded-3xl p-5 shadow-2xl flex flex-col max-h-[92vh] overflow-y-auto no-scrollbar border-t sm:border border-white/[0.12]">
        
        {/* Cabecera */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Gestionar Categorías
              </h2>
              <span className="text-[10px] text-zinc-400 font-medium block">
                Las categorías recientes aparecen primero
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] active:scale-95 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 px-3 py-2 rounded-xl text-xs">
            {errorMsg}
          </div>
        )}

        {/* Formulario Crear / Editar */}
        <form onSubmit={handleSubmit} className="mt-4 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              {editingCategory ? "Editar Categoría" : "Nueva Categoría"}
            </span>
            {editingCategory && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="text-[11px] text-zinc-400 hover:text-zinc-200 underline"
              >
                Cancelar
              </button>
            )}
          </div>

          {/* Nombre de Categoría */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
              Nombre
            </label>
            <input
              type="text"
              required
              placeholder="Ej. Veterinaria, Gym, Ropa, Café..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.12] rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            />
          </div>

          {/* Selector de Ícono */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
              Ícono
            </label>
            <div className="grid grid-cols-7 gap-1.5 max-h-32 overflow-y-auto no-scrollbar p-1 bg-black/20 rounded-xl border border-white/[0.04]">
              {CATEGORY_ICON_OPTIONS.map((opt) => {
                const isSelected = selectedIcon === opt.id;
                const IconComp = opt.icon;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    title={opt.label}
                    onClick={() => setSelectedIcon(opt.id)}
                    className={`h-9 rounded-xl flex items-center justify-center transition active:scale-90 ${
                      isSelected
                        ? "bg-white text-black shadow-md font-bold scale-105"
                        : "bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08] hover:text-white"
                    }`}
                  >
                    <IconComp className="w-4 h-4" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selector de Color */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
              Color
            </label>
            <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
              {CATEGORY_COLOR_OPTIONS.map((c) => {
                const isSelected = selectedColor === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    title={c.label}
                    onClick={() => setSelectedColor(c.id)}
                    className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center transition active:scale-90 ${c.bg} ${
                      isSelected ? "ring-2 ring-white ring-offset-2 ring-offset-black scale-110" : "opacity-80 hover:opacity-100"
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Botón de Guardar */}
          <button
            type="submit"
            disabled={isSubmitting || !name.trim()}
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-indigo-600/30 flex items-center justify-center gap-1.5 active:scale-[0.98] transition"
          >
            {editingCategory ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>{editingCategory ? "Actualizar Categoría" : "Guardar Categoría"}</span>
          </button>
        </form>

        {/* Lista de Categorías Existentes */}
        <div className="mt-5 space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Categorías ({categories.length})
            </span>
            <span className="text-[10px] text-zinc-500">
              Ordenadas por uso reciente
            </span>
          </div>

          <div className="space-y-1.5 max-h-64 overflow-y-auto no-scrollbar">
            {categories.map((cat, idx) => {
              const isFirst = idx === 0;

              return (
                <div
                  key={cat.id}
                  className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between hover:bg-white/[0.06] transition"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0"
                      style={{ backgroundColor: cat.color ? `${cat.color}33` : "#6366f133", color: cat.color || "#818cf8" }}
                    >
                      <CategoryIcon name={cat.name} icon={cat.icon} className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-white truncate">
                          {cat.name}
                        </span>
                        {isFirst && (
                          <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-bold">
                            Reciente
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {onSelectCategory && (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectCategory(cat);
                          onClose();
                        }}
                        className="px-2 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-[10px] font-bold active:scale-95 transition"
                      >
                        Elegir
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleStartEdit(cat)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] active:scale-90 transition"
                      title="Editar categoría"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={deletingId === cat.id}
                      onClick={() => handleDelete(cat)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 active:scale-90 transition disabled:opacity-50"
                      title="Eliminar categoría"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
