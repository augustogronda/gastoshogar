"use client";

import React, { useState } from "react";
import { X, Check, Percent, Users, Calendar } from "./ui/icons";
import { updateSalariesAction, updateMemberNamesAction } from "@/app/actions";

interface HouseholdUser {
  id: string;
  name: string;
}

interface IncomeRecord {
  userId: string;
  amount: number;
  contributionPct: number;
}

interface SalaryConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  periodId: string;
  monthName?: string;
  year?: number;
  users: HouseholdUser[];
  incomes: IncomeRecord[];
}

export function SalaryConfigModal({
  isOpen,
  onClose,
  periodId,
  monthName = "Mes actual",
  year = 2026,
  users,
  incomes,
}: SalaryConfigModalProps) {
  const userA = users[0];
  const userB = users[1];

  const incA = incomes.find((i) => i.userId === userA?.id)?.amount ?? 0;
  const incB = incomes.find((i) => i.userId === userB?.id)?.amount ?? 0;

  const [nameA, setNameA] = useState<string>(userA?.name || "Agus");
  const [nameB, setNameB] = useState<string>(userB?.name || "Pareja");

  const [salaryA, setSalaryA] = useState<string>(incA ? incA.toString() : "");
  const [salaryB, setSalaryB] = useState<string>(incB ? incB.toString() : "");
  const [pct, setPct] = useState<number>(60);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const numA = parseFloat(salaryA) || 0;
  const numB = parseFloat(salaryB) || 0;
  const quotaA = Math.round(numA * (pct / 100));
  const quotaB = Math.round(numB * (pct / 100));
  const totalPool = quotaA + quotaB;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (userA && userB) {
        await updateMemberNamesAction(userA.id, nameA, userB.id, nameB);
        await updateSalariesAction(periodId, [
          { userId: userA.id, amount: numA, pct: pct / 100 },
          { userId: userB.id, amount: numB, pct: pct / 100 },
        ]);
      }
      onClose();
    } catch (err) {
      console.error(err);
      alert("Error al actualizar sueldos");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md super-card rounded-3xl p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto no-scrollbar">
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" />
              <h2 className="text-base font-bold text-white tracking-tight">Sueldos del Mes</h2>
            </div>
            <span className="text-xs font-semibold text-blue-400 flex items-center gap-1 mt-0.5">
              <Calendar className="w-3.5 h-3.5" />
              Período: {monthName} {year}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] active:scale-95 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-zinc-400 mt-3 mb-4 leading-relaxed">
          Ingresen el sueldo neto que cobró cada uno en <strong>{monthName} {year}</strong>. El fondo común se calculará al {pct}% de cada uno.
        </p>

        <form onSubmit={handleSave} className="space-y-3.5">
          {/* Persona A */}
          <div className="bg-white/[0.04] p-4 rounded-2xl border border-blue-500/30 shadow-sm">
            <div className="flex items-center justify-between mb-2.5">
              <input
                type="text"
                value={nameA}
                onChange={(e) => setNameA(e.target.value)}
                className="bg-transparent font-bold text-blue-300 border-b border-blue-400/30 focus:border-blue-400 focus:outline-none text-sm px-1 py-0.5 placeholder:text-blue-300/60"
                placeholder="Nombre"
              />
              <span className="text-xs font-bold text-blue-300 font-mono tabular-nums bg-blue-950/40 px-2.5 py-0.5 rounded-full border border-blue-500/20">
                Aporte {pct}%: ${quotaA.toLocaleString("es-AR")}
              </span>
            </div>
            <div>
              <input
                type="number"
                placeholder="Sueldo neto mensual ($)"
                value={salaryA}
                onChange={(e) => setSalaryA(e.target.value)}
                className="w-full bg-black/50 border border-white/[0.14] rounded-xl px-4 py-2.5 text-white text-base text-center placeholder:text-center placeholder:text-zinc-400 focus:ring-2 focus:ring-blue-500/60 focus:border-blue-400 focus:outline-none font-mono tabular-nums shadow-inner"
              />
            </div>
          </div>

          {/* Persona B */}
          <div className="bg-white/[0.04] p-4 rounded-2xl border border-rose-500/30 shadow-sm">
            <div className="flex items-center justify-between mb-2.5">
              <input
                type="text"
                value={nameB}
                onChange={(e) => setNameB(e.target.value)}
                className="bg-transparent font-bold text-rose-300 border-b border-rose-400/30 focus:border-rose-400 focus:outline-none text-sm px-1 py-0.5 placeholder:text-rose-300/60"
                placeholder="Nombre de tu pareja"
              />
              <span className="text-xs font-bold text-rose-300 font-mono tabular-nums bg-rose-950/40 px-2.5 py-0.5 rounded-full border border-rose-500/20">
                Aporte {pct}%: ${quotaB.toLocaleString("es-AR")}
              </span>
            </div>
            <div>
              <input
                type="number"
                placeholder="Sueldo neto mensual ($)"
                value={salaryB}
                onChange={(e) => setSalaryB(e.target.value)}
                className="w-full bg-black/50 border border-white/[0.14] rounded-xl px-4 py-2.5 text-white text-base text-center placeholder:text-center placeholder:text-zinc-400 focus:ring-2 focus:ring-rose-500/60 focus:border-rose-400 focus:outline-none font-mono tabular-nums shadow-inner"
              />
            </div>
          </div>

          {/* Resumen Proyectado */}
          <div className="bg-blue-950/30 border border-blue-500/30 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-blue-300 font-bold tracking-wider uppercase block">
                FONDO COMÚN ({monthName})
              </span>
              <span className="text-2xl font-extrabold text-white font-mono tabular-nums">
                ${totalPool.toLocaleString("es-AR")}
              </span>
            </div>
            <div className="flex items-center gap-1 bg-blue-500/20 border border-blue-500/40 px-3 py-1 rounded-full text-blue-200 text-xs font-bold tabular-nums">
              <Percent className="w-3.5 h-3.5" />
              <span>{pct}% de c/u</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold text-sm shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 active:scale-[0.98] transition border border-blue-400/20 mt-2"
          >
            <Check className="w-4 h-4" />
            <span>Guardar Sueldos de {monthName}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
