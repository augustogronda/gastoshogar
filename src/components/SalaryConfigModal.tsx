"use client";

import React, { useState } from "react";
import { X, Check, Percent, Users } from "./ui/icons";
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
  users: HouseholdUser[];
  incomes: IncomeRecord[];
}

export function SalaryConfigModal({
  isOpen,
  onClose,
  periodId,
  users,
  incomes,
}: SalaryConfigModalProps) {
  const userA = users[0];
  const userB = users[1];

  const incA = incomes.find((i) => i.userId === userA?.id)?.amount ?? 0;
  const incB = incomes.find((i) => i.userId === userB?.id)?.amount ?? 0;

  const [nameA, setNameA] = useState<string>(userA?.name || "Persona A");
  const [nameB, setNameB] = useState<string>(userB?.name || "Persona B");

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto no-scrollbar">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">Sueldos y Aporte Común</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-zinc-400 hover:text-white bg-zinc-800/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-zinc-400 mt-3 mb-4">
          Ingresen el sueldo neto cobrado este mes. El sistema calculará el {pct}% de cada uno para financiar el hogar.
        </p>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Persona A */}
          <div className="bg-zinc-800/50 p-4 rounded-2xl border border-zinc-700/40">
            <div className="flex items-center justify-between mb-2">
              <input
                type="text"
                value={nameA}
                onChange={(e) => setNameA(e.target.value)}
                className="bg-transparent font-medium text-white border-b border-zinc-700 focus:border-blue-500 focus:outline-none text-sm px-1 py-0.5"
                placeholder="Nombre"
              />
              <span className="text-xs font-semibold text-blue-400">
                Aporte {pct}%: ${quotaA.toLocaleString("es-AR")}
              </span>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-3 text-zinc-500">$</span>
              <input
                type="number"
                placeholder="Sueldo neto mensual"
                value={salaryA}
                onChange={(e) => setSalaryA(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700/80 rounded-xl pl-8 pr-4 py-3 text-white text-base focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Persona B */}
          <div className="bg-zinc-800/50 p-4 rounded-2xl border border-zinc-700/40">
            <div className="flex items-center justify-between mb-2">
              <input
                type="text"
                value={nameB}
                onChange={(e) => setNameB(e.target.value)}
                className="bg-transparent font-medium text-white border-b border-zinc-700 focus:border-pink-500 focus:outline-none text-sm px-1 py-0.5"
                placeholder="Nombre de tu pareja"
              />
              <span className="text-xs font-semibold text-pink-400">
                Aporte {pct}%: ${quotaB.toLocaleString("es-AR")}
              </span>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-3 text-zinc-500">$</span>
              <input
                type="number"
                placeholder="Sueldo neto mensual"
                value={salaryB}
                onChange={(e) => setSalaryB(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700/80 rounded-xl pl-8 pr-4 py-3 text-white text-base focus:ring-2 focus:ring-pink-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Resumen Proyectado */}
          <div className="bg-blue-950/30 border border-blue-900/50 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-blue-300 block">FONDO COMÚN PROYECTADO</span>
              <span className="text-2xl font-bold text-white">
                ${totalPool.toLocaleString("es-AR")}
              </span>
            </div>
            <div className="flex items-center gap-1 bg-blue-900/40 px-2.5 py-1 rounded-full text-blue-300 text-xs font-semibold">
              <Percent className="w-3.5 h-3.5" />
              <span>{pct}% de c/u</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold text-base shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 active:scale-98 transition mt-2"
          >
            <Check className="w-5 h-5" />
            <span>Guardar Configuración</span>
          </button>
        </form>
      </div>
    </div>
  );
}
