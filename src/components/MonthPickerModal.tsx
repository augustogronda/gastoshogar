"use client";

import React, { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, X, Calendar, Lock, Unlock } from "./ui/icons";
import { triggerHaptic } from "@/lib/haptics";
import { getYearPeriodsStatusAction } from "@/app/actions";

interface MonthPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentYear: number;
  currentMonth: number; // 1 - 12
  currentStatus?: string;
  onSelectMonth: (year: number, month: number) => void;
}

const MONTHS = [
  { num: 1, short: "Ene", full: "Enero" },
  { num: 2, short: "Feb", full: "Febrero" },
  { num: 3, short: "Mar", full: "Marzo" },
  { num: 4, short: "Abr", full: "Abril" },
  { num: 5, short: "May", full: "Mayo" },
  { num: 6, short: "Jun", full: "Junio" },
  { num: 7, short: "Jul", full: "Julio" },
  { num: 8, short: "Ago", full: "Agosto" },
  { num: 9, short: "Sep", full: "Septiembre" },
  { num: 10, short: "Oct", full: "Octubre" },
  { num: 11, short: "Nov", full: "Noviembre" },
  { num: 12, short: "Dic", full: "Diciembre" },
];

export function MonthPickerModal({
  isOpen,
  onClose,
  currentYear,
  currentMonth,
  currentStatus,
  onSelectMonth,
}: MonthPickerModalProps) {
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [yearStatuses, setYearStatuses] = useState<Record<number, "OPEN" | "CLOSED">>({});

  const now = new Date();
  const realCurrentYear = now.getFullYear();
  const realCurrentMonth = now.getMonth() + 1;

  useEffect(() => {
    if (!isOpen) return;
    setSelectedYear(currentYear);
  }, [isOpen, currentYear]);

  // Cargar estados de los meses del año seleccionado
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    getYearPeriodsStatusAction(selectedYear)
      .then((map) => {
        if (isMounted) {
          // Si el año consultado es el actual abierto, asegurar coherencia con currentStatus si vino provisto
          if (selectedYear === currentYear && currentStatus) {
            map[currentMonth] = currentStatus === "CLOSED" ? "CLOSED" : "OPEN";
          }
          setYearStatuses(map);
        }
      })
      .catch((err) => {
        console.warn("No se pudo cargar estado de meses para el año:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, selectedYear, currentYear, currentMonth, currentStatus]);

  if (!isOpen) return null;

  const handleSelect = (monthNum: number) => {
    triggerHaptic(10);
    onSelectMonth(selectedYear, monthNum);
    onClose();
  };

  const handleGoToCurrentMonth = () => {
    triggerHaptic(12);
    setSelectedYear(realCurrentYear);
    onSelectMonth(realCurrentYear, realCurrentMonth);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div
        className="w-full max-w-sm super-card rounded-3xl p-5 border border-white/[0.12] shadow-2xl relative animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado: Selector de Año y Botón Cerrar */}
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                triggerHaptic(8);
                setSelectedYear((prev) => prev - 1);
              }}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.05] hover:bg-white/[0.12] text-zinc-300 hover:text-white transition active:scale-90"
              title="Año anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-lg font-extrabold text-white tracking-tight px-1 font-mono">
              {selectedYear}
            </span>
            <button
              type="button"
              onClick={() => {
                triggerHaptic(8);
                setSelectedYear((prev) => prev + 1);
              }}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.05] hover:bg-white/[0.12] text-zinc-300 hover:text-white transition active:scale-90"
              title="Año siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              triggerHaptic(6);
              onClose();
            }}
            className="w-8 h-8 flex items-center justify-center rounded-full text-zinc-400 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] active:scale-90 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Grilla de 12 Meses */}
        <div className="grid grid-cols-3 gap-2.5 py-4">
          {MONTHS.map((m) => {
            const isSelected = selectedYear === currentYear && m.num === currentMonth;
            const isRealNow = selectedYear === realCurrentYear && m.num === realCurrentMonth;
            const status = yearStatuses[m.num]; // "OPEN" | "CLOSED" | undefined
            const isClosed = status === "CLOSED";
            const isOpenStatus = status === "OPEN";

            return (
              <button
                key={m.num}
                type="button"
                onClick={() => handleSelect(m.num)}
                className={`relative py-3 px-2 rounded-2xl flex flex-col items-center justify-center transition-all duration-150 active:scale-95 ${
                  isSelected
                    ? "bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold shadow-lg shadow-blue-500/30 ring-2 ring-blue-400/50"
                    : isClosed
                    ? "bg-amber-500/[0.06] hover:bg-amber-500/[0.12] text-zinc-300 hover:text-white border border-amber-500/25"
                    : isOpenStatus
                    ? "bg-emerald-500/[0.06] hover:bg-emerald-500/[0.12] text-zinc-200 hover:text-white border border-emerald-500/25"
                    : "bg-white/[0.04] hover:bg-white/[0.09] text-zinc-400 hover:text-zinc-200 border border-white/[0.05]"
                }`}
              >
                {/* Badge/Dot de Estado: Cerrado (Candado) o Abierto (Punto verde / candado abierto) */}
                <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
                  {isClosed ? (
                    <span
                      className={`inline-flex items-center justify-center w-4 h-4 rounded-full ${
                        isSelected
                          ? "bg-amber-400 text-zinc-950"
                          : "bg-amber-500/20 text-amber-300 border border-amber-400/30"
                      }`}
                      title="Mes cerrado"
                    >
                      <Lock className="w-2.5 h-2.5 stroke-[2.5]" />
                    </span>
                  ) : isOpenStatus ? (
                    <span
                      className={`inline-flex items-center justify-center w-4 h-4 rounded-full ${
                        isSelected
                          ? "bg-emerald-300 text-zinc-950"
                          : "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30"
                      }`}
                      title="Mes abierto en curso"
                    >
                      <Unlock className="w-2.5 h-2.5 stroke-[2.5]" />
                    </span>
                  ) : null}
                </div>

                {/* Indicador de Mes Real Actual */}
                {isRealNow && (
                  <span
                    className={`absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full ${
                      isSelected ? "bg-white" : "bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.8)]"
                    }`}
                    title="Mes calendario actual"
                  />
                )}

                <span className="text-sm font-bold tracking-tight">{m.short}</span>
                <span
                  className={`text-[10px] mt-0.5 font-medium ${
                    isSelected
                      ? "text-white/80"
                      : isClosed
                      ? "text-amber-300/80"
                      : isOpenStatus
                      ? "text-emerald-300/80"
                      : "text-zinc-500"
                  }`}
                >
                  {isClosed ? "Cerrado" : isOpenStatus ? "Abierto" : m.full}
                </span>
              </button>
            );
          })}
        </div>

        {/* Leyenda sutil de estados */}
        <div className="flex items-center justify-center gap-4 py-2 border-t border-white/[0.06] text-[10px] text-zinc-400 font-medium">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.6)]" />
            <span>Abierto</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_4px_rgba(251,191,36,0.6)]" />
            <span>Cerrado</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            <span>Mes actual</span>
          </div>
        </div>

        {/* Footer: Atajo rápido a Mes Actual */}
        <div className="pt-2 border-t border-white/[0.08]">
          <button
            type="button"
            onClick={handleGoToCurrentMonth}
            className="w-full py-2.5 px-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-xs font-semibold text-zinc-300 hover:text-white transition flex items-center justify-center gap-2 active:scale-98"
          >
            <Calendar className="w-3.5 h-3.5 text-blue-400" />
            <span>Ir al Mes Actual ({MONTHS[realCurrentMonth - 1].short} {realCurrentYear})</span>
          </button>
        </div>
      </div>
    </div>
  );
}
