"use client";

import React, { useState, useEffect } from "react";
import { X, Target, Check, Trash2, Sparkles } from "lucide-react";
import { InvestmentPocket, POCKET_COLOR_MAP } from "@/lib/investment-pockets";
import { triggerHaptic } from "@/lib/haptics";

interface SetTargetModalProps {
  isOpen: boolean;
  onClose: () => void;
  pocket: InvestmentPocket | null;
  currentAmountArs: number;
  onSaveTarget: (pocketId: string, targetAmountArs?: number) => void;
}

const QUICK_SUGGESTIONS = [
  { label: "$500 mil", value: 500000 },
  { label: "$1 Millón", value: 1000000 },
  { label: "$3 Millones", value: 3000000 },
  { label: "$5 Millones", value: 5000000 },
  { label: "$10 Millones", value: 10000000 },
];

export function SetTargetModal({
  isOpen,
  onClose,
  pocket,
  currentAmountArs,
  onSaveTarget,
}: SetTargetModalProps) {
  const [targetStr, setTargetStr] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !pocket) return;
    setTargetStr(
      pocket.targetAmountArs ? String(pocket.targetAmountArs) : ""
    );
    setErrorMsg(null);
  }, [isOpen, pocket]);

  if (!isOpen || !pocket) return null;

  const colorStyle =
    POCKET_COLOR_MAP[pocket.color] || POCKET_COLOR_MAP.indigo;

  const parsedTarget = parseFloat(
    targetStr.replace(/\./g, "").replace(",", ".").trim()
  );
  const isValidTarget = !isNaN(parsedTarget) && parsedTarget > 0;

  const progressPct =
    isValidTarget && parsedTarget > 0
      ? Math.min(100, (currentAmountArs / parsedTarget) * 100)
      : null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidTarget) {
      setErrorMsg("Ingresá un monto meta válido en pesos.");
      return;
    }

    triggerHaptic("success");
    onSaveTarget(pocket.id, parsedTarget);
    onClose();
  };

  const handleRemove = () => {
    triggerHaptic(8);
    onSaveTarget(pocket.id, undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        className="w-full max-w-sm super-card rounded-3xl p-5 border border-white/[0.12] shadow-2xl relative animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.08]">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`w-9 h-9 rounded-2xl flex items-center justify-center text-lg ${colorStyle.badgeBg} border ${colorStyle.badgeBorder} shrink-0`}
            >
              {pocket.icon}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-extrabold text-white tracking-tight truncate">
                Objetivo para {pocket.name}
              </h2>
              <span className="text-[11px] text-zinc-400 block truncate">
                Meta de ahorro o inversión en pareja
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-zinc-400 hover:text-white flex items-center justify-center transition active:scale-90 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4 pt-3.5">
          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
              {errorMsg}
            </div>
          )}

          {/* Monto actual acumulado de referencia */}
          <div className="flex items-center justify-between p-2.5 rounded-2xl bg-zinc-900/60 border border-white/[0.06] text-xs">
            <span className="text-zinc-400">Acumulado actual:</span>
            <span className="font-extrabold text-white font-mono">
              ${Math.round(currentAmountArs).toLocaleString("es-AR")}
            </span>
          </div>

          {/* Input de Meta */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider flex items-center justify-between">
              <span>Monto Meta ($ ARS)</span>
              {progressPct !== null && (
                <span className="text-emerald-400 font-extrabold font-mono">
                  {progressPct.toFixed(0)}% actual
                </span>
              )}
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-zinc-400 font-extrabold text-base">
                $
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={targetStr}
                onChange={(e) => setTargetStr(e.target.value)}
                placeholder="ej: 3.000.000"
                className="w-full py-2.5 pl-8 pr-3 rounded-2xl bg-zinc-900/90 border border-white/[0.12] text-white font-mono text-base font-extrabold focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-zinc-600"
                autoFocus
              />
            </div>
          </div>

          {/* Atajos rápidos sugeridos */}
          <div className="space-y-1">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block">
              Atajos sugeridos
            </span>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_SUGGESTIONS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => {
                    triggerHaptic(6);
                    setTargetStr(String(s.value));
                  }}
                  className="py-1 px-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 hover:text-white text-xs font-semibold border border-white/[0.06] active:scale-95 transition"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Vista previa de la barra si el monto es válido */}
          {isValidTarget && (
            <div className="p-3 rounded-2xl bg-zinc-900/60 border border-white/[0.06] space-y-1.5 animate-fade-in">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400 font-medium">Avance proyectado:</span>
                <span className="font-mono font-extrabold text-white">
                  {progressPct?.toFixed(1)}%
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  style={{ width: `${Math.min(100, Math.max(3, progressPct || 0))}%` }}
                  className={`h-full ${colorStyle.progressBg} rounded-full`}
                />
              </div>
              <div className="text-[10px] text-zinc-400 text-right">
                {currentAmountArs >= parsedTarget ? (
                  <span className="text-emerald-400 font-bold">¡Meta superada! 🎉</span>
                ) : (
                  <span>
                    Faltarían $
                    {Math.round(parsedTarget - currentAmountArs).toLocaleString(
                      "es-AR"
                    )}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Botones de acción */}
          <div className="pt-2 flex items-center gap-2">
            {pocket.targetAmountArs && (
              <button
                type="button"
                onClick={handleRemove}
                className="py-3 px-3.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-bold transition active:scale-95 flex items-center justify-center gap-1"
                title="Quitar objetivo"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Quitar</span>
              </button>
            )}

            <button
              type="submit"
              className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 active:scale-98 transition"
            >
              <Check className="w-4 h-4" />
              <span>Guardar Objetivo</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
