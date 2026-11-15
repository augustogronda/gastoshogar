"use client";

import React, { useState, useEffect } from "react";
import { X, ArrowUpDown, ChevronUp, ChevronDown, Check, Sparkles } from "lucide-react";
import { InvestmentPocket, POCKET_COLOR_MAP } from "@/lib/investment-pockets";
import { triggerHaptic } from "@/lib/haptics";

interface PocketPriorityModalProps {
  isOpen: boolean;
  onClose: () => void;
  pockets: InvestmentPocket[];
  onSaveOrder: (orderedPockets: InvestmentPocket[]) => void;
}

export function PocketPriorityModal({
  isOpen,
  onClose,
  pockets,
  onSaveOrder,
}: PocketPriorityModalProps) {
  const [ordered, setOrdered] = useState<InvestmentPocket[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    // Clonar lista y ordenar según prioridad actual
    const sorted = [...pockets].sort((a, b) => {
      const pA = typeof a.priority === "number" ? a.priority : 999;
      const pB = typeof b.priority === "number" ? b.priority : 999;
      if (pA !== pB) return pA - pB;
      return a.name.localeCompare(b.name, "es");
    });
    setOrdered(sorted);
  }, [isOpen, pockets]);

  if (!isOpen) return null;

  const handleMove = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= ordered.length) return;

    triggerHaptic(6);

    const next = [...ordered];
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);

    // Reasignar prioridades secuenciales 1, 2, 3...
    const updated = next.map((pocket, idx) => ({
      ...pocket,
      priority: idx + 1,
    }));

    setOrdered(updated);
    onSaveOrder(updated);
  };

  const handleSetPriorityDirectly = (index: number, newPriority: number) => {
    if (newPriority < 1) newPriority = 1;
    triggerHaptic(6);

    const next = [...ordered];
    next[index] = { ...next[index], priority: newPriority };

    // Reordenar por el nuevo valor numérico
    const sorted = next.sort((a, b) => {
      const pA = typeof a.priority === "number" ? a.priority : 999;
      const pB = typeof b.priority === "number" ? b.priority : 999;
      return pA - pB;
    });

    // Normalizar a 1, 2, 3...
    const normalized = sorted.map((p, idx) => ({
      ...p,
      priority: idx + 1,
    }));

    setOrdered(normalized);
    onSaveOrder(normalized);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        className="w-full max-w-md super-card rounded-3xl p-5 border border-white/[0.12] shadow-2xl relative animate-scale-up space-y-4 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center border border-indigo-500/30">
              <ArrowUpDown className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-white tracking-tight">
                Prioridad de Bolsas de Dinero
              </h2>
              <span className="text-[11px] text-zinc-400 block">
                Tocá ▲ o ▼ para ordenar tus fondos sin arrastrar
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

        {/* Tip explicativo */}
        <div className="p-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-300 flex items-center gap-2 shrink-0">
          <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>
            La bolsa en <strong>#1</strong> será la primera visible en las pestañas del portafolio y en el resumen.
          </span>
        </div>

        {/* Lista de Bolsas con botones de subir/bajar */}
        <div className="space-y-2 overflow-y-auto flex-1 pr-0.5">
          {ordered.map((pocket, idx) => {
            const pColor = POCKET_COLOR_MAP[pocket.color] || POCKET_COLOR_MAP.indigo;
            const isFirst = idx === 0;
            const isLast = idx === ordered.length - 1;

            return (
              <div
                key={pocket.id}
                className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                  isFirst
                    ? "bg-white/[0.06] border-indigo-500/40 shadow-sm"
                    : "bg-white/[0.03] border-white/[0.08] hover:border-white/[0.15]"
                }`}
              >
                {/* Posición & Info */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`w-7 h-7 rounded-xl flex items-center justify-center font-mono font-black text-xs shrink-0 ${
                      isFirst
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                        : "bg-zinc-800 text-zinc-300 border border-white/[0.08]"
                    }`}
                  >
                    #{idx + 1}
                  </span>
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center text-base ${pColor.badgeBg} border ${pColor.badgeBorder} shrink-0`}
                  >
                    {pocket.icon}
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-xs text-white block truncate">
                      {pocket.name}
                    </span>
                    <span className="text-[10px] text-zinc-400 block truncate">
                      {isFirst ? (
                        <span className="text-indigo-300 font-semibold">★ Primero en pantalla</span>
                      ) : (
                        `Prioridad ${idx + 1}`
                      )}
                      {pocket.targetAmountArs
                        ? ` · Meta $${pocket.targetAmountArs.toLocaleString("es-AR")}`
                        : ""}
                    </span>
                  </div>
                </div>

                {/* Acciones de Orden: ▲ y ▼ */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={isFirst}
                    onClick={() => handleMove(idx, "up")}
                    className="w-8 h-8 rounded-xl bg-white/[0.05] hover:bg-white/[0.12] disabled:opacity-20 text-zinc-300 hover:text-white flex items-center justify-center transition active:scale-90 border border-white/[0.06]"
                    title="Subir de prioridad"
                  >
                    <ChevronUp className="w-4 h-4 stroke-[2.5]" />
                  </button>
                  <button
                    type="button"
                    disabled={isLast}
                    onClick={() => handleMove(idx, "down")}
                    className="w-8 h-8 rounded-xl bg-white/[0.05] hover:bg-white/[0.12] disabled:opacity-20 text-zinc-300 hover:text-white flex items-center justify-center transition active:scale-90 border border-white/[0.06]"
                    title="Bajar de prioridad"
                  >
                    <ChevronDown className="w-4 h-4 stroke-[2.5]" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Botón de cierre */}
        <div className="pt-2 border-t border-white/[0.08] shrink-0">
          <button
            type="button"
            onClick={() => {
              triggerHaptic(8);
              onClose();
            }}
            className="w-full py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 active:scale-98 transition"
          >
            <Check className="w-4 h-4" />
            <span>Listo, Guardar Orden</span>
          </button>
        </div>
      </div>
    </div>
  );
}
