"use client";

import React, { useState, useEffect } from "react";
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
  defaultRate?: number;
}

export function SalaryConfigModal({
  isOpen,
  onClose,
  periodId,
  monthName = "Mes actual",
  year = 2026,
  users,
  incomes,
  defaultRate = 0.60,
}: SalaryConfigModalProps) {
  const userAugusto = users.find((u) => u.name.toLowerCase().includes("augusto")) || users[0];
  const userAgus = users.find((u) => !u.name.toLowerCase().includes("augusto")) || users[1];

  const recA = incomes.find((i) => i.userId === userAugusto?.id);
  const recB = incomes.find((i) => i.userId === userAgus?.id);

  const incA = recA?.amount ?? 0;
  const incB = recB?.amount ?? 0;
  const initialPct = Math.round((recA?.contributionPct ?? recB?.contributionPct ?? defaultRate ?? 0.60) * 100);

  const [nameA, setNameA] = useState<string>(userAugusto?.name || "Augusto");
  const [nameB, setNameB] = useState<string>(userAgus?.name || "Agus");

  const [salaryA, setSalaryA] = useState<string>(incA ? incA.toString() : "");
  const [salaryB, setSalaryB] = useState<string>(incB ? incB.toString() : "");
  const [pct, setPct] = useState<number>(initialPct);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setNameA(userAugusto?.name || "Augusto");
      setNameB(userAgus?.name || "Agus");
      setSalaryA(incA ? incA.toString() : "");
      setSalaryB(incB ? incB.toString() : "");
      setPct(Math.round((recA?.contributionPct ?? recB?.contributionPct ?? defaultRate ?? 0.60) * 100));
    }
  }, [isOpen, periodId, incA, incB, recA?.contributionPct, recB?.contributionPct, defaultRate, userAugusto?.name, userAgus?.name]);

  if (!isOpen) return null;

  const clampedPct = Math.min(100, Math.max(5, Math.round(pct || 60)));
  const personalPct = Math.max(0, 100 - clampedPct);
  const numA = parseFloat(salaryA) || 0;
  const numB = parseFloat(salaryB) || 0;
  const quotaA = Math.round(numA * (clampedPct / 100));
  const quotaB = Math.round(numB * (clampedPct / 100));
  const totalPool = quotaA + quotaB;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (userAugusto && userAgus) {
        await updateMemberNamesAction(userAugusto.id, nameA, userAgus.id, nameB);
        await updateSalariesAction(periodId, [
          { userId: userAugusto.id, amount: numA, pct: clampedPct / 100 },
          { userId: userAgus.id, amount: numB, pct: clampedPct / 100 },
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
              <h2 className="text-base font-bold text-white tracking-tight">Sueldos y Porcentaje</h2>
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

        <form onSubmit={handleSave} className="space-y-3.5 mt-3.5">
          {/* Selector de Porcentaje Editable (Default 60%) */}
          <div className="bg-white/[0.04] p-4 rounded-2xl border border-white/[0.1] space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                  <Percent className="w-3.5 h-3.5 text-blue-400" />
                  Aporte al Fondo Común
                </span>
                <span className="text-[11px] text-zinc-400 block mt-0.5">
                  Hogar: <strong className="text-blue-300">{clampedPct}%</strong> • Personal libre: <strong className="text-indigo-300">{personalPct}%</strong>
                </span>
              </div>
              <div className="flex items-center gap-1 bg-black/50 border border-white/[0.14] rounded-xl px-2.5 py-1">
                <input
                  type="number"
                  min={5}
                  max={100}
                  value={pct}
                  onChange={(e) => setPct(Number(e.target.value))}
                  className="w-11 bg-transparent text-right text-base font-extrabold text-white font-mono tabular-nums focus:outline-none"
                />
                <span className="text-xs font-bold text-blue-300">%</span>
              </div>
            </div>

            <input
              type="range"
              min={10}
              max={100}
              step={5}
              value={clampedPct}
              onChange={(e) => setPct(Number(e.target.value))}
              className="w-full accent-blue-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
            />

            <div className="flex items-center justify-between gap-1.5 pt-0.5">
              {[50, 60, 70, 80].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setPct(preset)}
                  className={`flex-1 py-1 rounded-lg text-[11px] font-bold transition ${
                    clampedPct === preset
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-white/[0.05] text-zinc-400 hover:text-white border border-white/[0.08]"
                  }`}
                >
                  {preset}% {preset === 60 ? "(Default)" : ""}
                </button>
              ))}
            </div>
          </div>

          {/* Persona A */}
          <div className="bg-white/[0.04] p-4 rounded-2xl border border-blue-500/30 shadow-sm">
            <div className="flex items-center justify-between mb-2.5">
              <input
                type="text"
                value={nameA}
                onChange={(e) => setNameA(e.target.value)}
                className="bg-transparent font-bold text-blue-300 border-b border-blue-400/30 focus:border-blue-400 focus:outline-none text-sm px-1 py-0.5 placeholder:text-blue-300/60"
                placeholder="Nombre (Augusto)"
              />
              <span className="text-xs font-bold text-blue-300 font-mono tabular-nums bg-blue-950/40 px-2.5 py-0.5 rounded-full border border-blue-500/20">
                Aporte {clampedPct}%: ${quotaA.toLocaleString("es-AR")}
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
                placeholder="Nombre (Agus)"
              />
              <span className="text-xs font-bold text-rose-300 font-mono tabular-nums bg-rose-950/40 px-2.5 py-0.5 rounded-full border border-rose-500/20">
                Aporte {clampedPct}%: ${quotaB.toLocaleString("es-AR")}
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
              <span>{clampedPct}% de c/u</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold text-sm shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 active:scale-[0.98] transition border border-blue-400/20 mt-2"
          >
            <Check className="w-4 h-4" />
            <span>Guardar Sueldos y Porcentaje</span>
          </button>
        </form>
      </div>
    </div>
  );
}
