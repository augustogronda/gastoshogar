"use client";

import React from "react";
import { CategoryIcon, Edit3, Copy } from "./ui/icons";
import { useLongPress } from "@/lib/use-long-press";
import { triggerHaptic } from "@/lib/haptics";

const SHORT_MONTHS = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic"
];

export interface HogarExpenseItem {
  id: string;
  title: string;
  amount: number;
  date: Date | string;
  paidBy: { id: string; name: string };
  category: { id: string; name: string; icon?: string | null; color?: string | null };
  isFromPoolFund?: boolean;
  notes?: string | null;
  installmentNumber?: number | null;
  totalInstallments?: number | null;
}

export interface HogarExpenseRowProps {
  exp: HogarExpenseItem;
  users?: unknown[];
  deletingId: string | null;
  onOpenDetail: (exp: HogarExpenseItem) => void;
  onLongPress: (exp: HogarExpenseItem) => void;
  showToast: (msg: string, type?: "success" | "error" | "info") => void;
}

export function HogarExpenseRow({
  exp,
  deletingId,
  onOpenDetail,
  onLongPress,
  showToast,
}: HogarExpenseRowProps) {
  const isPendingSync = exp.id.startsWith("temp-");
  const dateObj = new Date(exp.date);
  const dateStr = `${dateObj.getDate()} ${SHORT_MONTHS[dateObj.getMonth()] || ""}`;
  const isAugusto = exp.paidBy?.name?.toLowerCase().includes("augusto");

  const longPressHandlers = useLongPress({
    onLongPress: () => {
      if (isPendingSync) return;
      triggerHaptic(15);
      onLongPress(exp);
    },
    onClick: () => {
      if (isPendingSync) {
        showToast("Sincronizando gasto con la base de datos...", "info");
        return;
      }
      triggerHaptic(8);
      onOpenDetail(exp);
    },
  });

  return (
    <div
      {...longPressHandlers}
      className={`super-card-subtle rounded-2xl p-3.5 flex items-center justify-between hover:bg-white/[0.05] active:scale-[0.98] transition-all duration-300 cursor-pointer group select-none ${
        deletingId === exp.id
          ? "opacity-0 -translate-x-6 scale-95 pointer-events-none"
          : "opacity-100"
      }`}
      style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none" }}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-10 h-10 rounded-xl bg-zinc-800/80 border border-white/[0.08] flex items-center justify-center text-zinc-300 shadow-sm shrink-0">
          <CategoryIcon name={exp.category.name} className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-[15px] font-semibold text-white block group-hover:text-blue-300 transition-colors truncate tracking-[-0.015em]">
            {exp.title}
          </span>
          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-zinc-300 font-medium min-w-0 flex-wrap sm:flex-nowrap">
            <span className="shrink-0">{dateStr}</span>
            <span className="shrink-0">•</span>
            <span
              className={`font-bold px-2 py-0.5 rounded-full text-[10px] border shrink-0 ${
                isAugusto
                  ? "bg-blue-500/20 text-blue-200 border-blue-400/30"
                  : "bg-rose-500/20 text-rose-200 border-rose-400/30"
              }`}
            >
              Pagó {exp.paidBy.name}
            </span>
            <span className="shrink-0 text-zinc-500">•</span>
            <span className="text-zinc-400 truncate">
              {exp.category.name}
            </span>
            {isPendingSync && (
              <span className="text-[10px] text-amber-300 font-medium animate-pulse flex items-center gap-1 ml-1 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block animate-ping" />
                Sincronizando...
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2.5 shrink-0 ml-3">
        {/* Atajos directos para mouse en PC / Escritorio al hacer hover */}
        <div className="hidden lg:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              triggerHaptic(8);
              onOpenDetail(exp);
            }}
            className="p-1.5 rounded-lg hover:bg-white/[0.1] text-zinc-400 hover:text-white transition"
            title="Editar gasto"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              triggerHaptic(12);
              onLongPress(exp);
            }}
            className="p-1.5 rounded-lg hover:bg-white/[0.1] text-zinc-400 hover:text-white transition"
            title="Duplicar o eliminar gasto"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="text-right">
          <span className="text-base font-extrabold text-white font-mono tabular-nums tracking-tight">
            ${Math.round(exp.amount).toLocaleString("es-AR")}
          </span>
        </div>
      </div>
    </div>
  );
}
