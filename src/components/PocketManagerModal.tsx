"use client";

import React, { useState, useEffect } from "react";
import { X, Check, Trash2, Target, Sparkles } from "lucide-react";
import { InvestmentPocket, POCKET_COLOR_MAP } from "@/lib/investment-pockets";
import { triggerHaptic } from "@/lib/haptics";

interface PocketManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  pocketToEdit?: InvestmentPocket | null;
  onSavePocket: (pocket: InvestmentPocket) => void;
  onDeletePocket?: (pocketId: string) => void;
}

const EMOJI_OPTIONS = [
  "🛡️", "📈", "🚗", "✈️", "🏠", "💍", "👶", "💻",
  "🎯", "💰", "🏖️", "🛋️", "🏥", "🚲", "📚", "🎓",
  "🐶", "⛵", "🚀", "💎", "⭐", "🛒", "🔧", "🔋"
];

const COLOR_OPTIONS: Array<{ key: string; label: string; bg: string }> = [
  { key: "emerald", label: "Esmeralda", bg: "bg-emerald-500" },
  { key: "indigo", label: "Índigo", bg: "bg-indigo-500" },
  { key: "amber", label: "Ámbar", bg: "bg-amber-500" },
  { key: "cyan", label: "Cian", bg: "bg-cyan-500" },
  { key: "purple", label: "Púrpura", bg: "bg-purple-500" },
  { key: "rose", label: "Rosa", bg: "bg-rose-500" },
  { key: "blue", label: "Azul", bg: "bg-blue-500" },
];

export function PocketManagerModal({
  isOpen,
  onClose,
  pocketToEdit,
  onSavePocket,
  onDeletePocket,
}: PocketManagerModalProps) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("💰");
  const [color, setColor] = useState("indigo");
  const [targetAmount, setTargetAmount] = useState("");
  const [priority, setPriority] = useState<number>(3);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (pocketToEdit) {
      setName(pocketToEdit.name);
      setIcon(pocketToEdit.icon || "💰");
      setColor(pocketToEdit.color || "indigo");
      setTargetAmount(
        pocketToEdit.targetAmountArs ? String(pocketToEdit.targetAmountArs) : ""
      );
      setPriority(
        typeof pocketToEdit.priority === "number" ? pocketToEdit.priority : 3
      );
    } else {
      setName("");
      setIcon("💰");
      setColor("indigo");
      setTargetAmount("");
      setPriority(3);
    }
    setErrorMsg(null);
  }, [isOpen, pocketToEdit]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setErrorMsg("Ingresá un nombre para la bolsa de dinero.");
      return;
    }

    const cleanTarget = targetAmount.trim()
      ? parseFloat(targetAmount.replace(/\./g, "").replace(",", "."))
      : undefined;

    const id =
      pocketToEdit?.id ||
      cleanName
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") ||
      `bolsa-${Date.now()}`;

    const newPocket: InvestmentPocket = {
      id,
      name: cleanName,
      icon,
      color,
      targetAmountArs: cleanTarget && cleanTarget > 0 ? cleanTarget : undefined,
      priority,
    };

    triggerHaptic("success");
    onSavePocket(newPocket);
    onClose();
  };

  const currentColorStyle = POCKET_COLOR_MAP[color] || POCKET_COLOR_MAP.indigo;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        className="w-full max-w-sm super-card rounded-3xl p-5 border border-white/[0.12] shadow-2xl relative animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <div
              className={`w-9 h-9 rounded-2xl flex items-center justify-center text-lg ${currentColorStyle.badgeBg} border ${currentColorStyle.badgeBorder}`}
            >
              {icon}
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-white tracking-tight">
                {pocketToEdit ? "Editar Bolsa de Dinero" : "Nueva Bolsa de Dinero"}
              </h2>
              <span className="text-[11px] text-zinc-400 block">
                Separar objetivos de inversión en pareja
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-zinc-400 hover:text-white flex items-center justify-center transition active:scale-90"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-3.5">
          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
              {errorMsg}
            </div>
          )}

          {/* Nombre de la Bolsa */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block">
              Nombre del Objetivo / Bolsa
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ej: Fondo para Auto, Emergencia, Vacaciones..."
              maxLength={40}
              className="w-full py-2.5 px-3 rounded-xl bg-zinc-900/90 border border-white/[0.1] text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />
          </div>

          {/* Selector de Emoji / Ícono */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block">
              Ícono
            </label>
            <div className="grid grid-cols-8 gap-1.5 p-2 rounded-2xl bg-zinc-900/60 border border-white/[0.06] max-h-28 overflow-y-auto">
              {EMOJI_OPTIONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => {
                    triggerHaptic(6);
                    setIcon(e);
                  }}
                  className={`w-8 h-8 rounded-xl flex items-center justify-center text-base transition ${
                    icon === e
                      ? "bg-white/20 ring-2 ring-indigo-400 scale-110"
                      : "hover:bg-white/10 active:scale-95"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Selector de Color */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block">
              Color Distintivo
            </label>
            <div className="flex items-center justify-between gap-1.5 p-2 rounded-2xl bg-zinc-900/60 border border-white/[0.06]">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => {
                    triggerHaptic(6);
                    setColor(c.key);
                  }}
                  className={`w-7 h-7 rounded-full ${c.bg} transition-all relative flex items-center justify-center ${
                    color === c.key
                      ? "ring-2 ring-white scale-110 shadow-lg"
                      : "opacity-60 hover:opacity-100"
                  }`}
                  title={c.label}
                >
                  {color === c.key && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                </button>
              ))}
            </div>
          </div>

          {/* Prioridad / Posición en la lista */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider flex items-center justify-between">
              <span>Prioridad / Posición</span>
              <span className="text-[10px] text-zinc-400 font-normal">
                #1 aparece primero en la app
              </span>
            </label>
            <div className="flex items-center gap-2">
              <div className="grid grid-cols-5 gap-1 flex-1 p-1 rounded-2xl bg-zinc-900/60 border border-white/[0.06]">
                {[1, 2, 3, 4, 5].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => {
                      triggerHaptic(6);
                      setPriority(val);
                    }}
                    className={`py-1.5 rounded-xl text-center transition text-xs font-mono font-bold ${
                      priority === val
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-1 ring-white/20"
                        : "text-zinc-400 hover:text-white hover:bg-white/[0.06]"
                    }`}
                  >
                    #{val}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1 shrink-0 p-1 rounded-2xl bg-zinc-900/60 border border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(6);
                    setPriority((prev) => Math.max(1, prev - 1));
                  }}
                  className="w-7 h-7 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 flex items-center justify-center font-bold text-sm active:scale-90 transition"
                  title="Subir prioridad (- número)"
                >
                  -
                </button>
                <span className="w-7 text-center font-mono font-extrabold text-xs text-white">
                  #{priority}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(6);
                    setPriority((prev) => Math.min(20, prev + 1));
                  }}
                  className="w-7 h-7 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 flex items-center justify-center font-bold text-sm active:scale-90 transition"
                  title="Bajar prioridad (+ número)"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Meta Opcional en Pesos */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider flex items-center justify-between">
              <span>Meta Opcional ($ ARS)</span>
              <span className="text-[10px] text-zinc-500 font-normal">Para ver barra de avance</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-zinc-400 font-bold text-sm">$</span>
              <input
                type="text"
                inputMode="numeric"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                placeholder="ej: 5.000.000"
                className="w-full py-2.5 pl-7 pr-3 rounded-xl bg-zinc-900/90 border border-white/[0.1] text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Botones de acción */}
          <div className="pt-2 flex items-center gap-2">
            {pocketToEdit && onDeletePocket && (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`¿Eliminar la bolsa "${pocketToEdit.name}"? Los activos seguirán existiendo en Inversiones Generales.`)) {
                    triggerHaptic(10);
                    onDeletePocket(pocketToEdit.id);
                    onClose();
                  }
                }}
                className="py-3 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-bold transition active:scale-95 flex items-center justify-center"
                title="Eliminar bolsa"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              type="submit"
              className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 active:scale-98 transition"
            >
              <Check className="w-4 h-4" />
              <span>{pocketToEdit ? "Guardar Cambios" : "Crear Bolsa de Dinero"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
