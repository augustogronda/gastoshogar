"use client";

import React, { useState } from "react";
import {
  TrendingUp,
  Plus,
  Trash2,
  Edit3,
  PiggyBank,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  PieChart,
  Layers,
  ExternalLink,
} from "lucide-react";
import { PersonalInvestmentModal } from "./PersonalInvestmentModal";
import {
  deletePersonalInvestmentAction,
  deleteSharedInvestmentAction,
  refreshPersonalInvestmentsAction,
  refreshSharedInvestmentsAction,
} from "@/app/actions";
import {
  HydratedInvestment,
  PortfolioSummary,
} from "@/lib/investments-service";

interface PersonalInvestmentsViewProps {
  userId?: string;
  householdId?: string;
  userName?: string;
  title?: string;
  investments: HydratedInvestment[];
  summary?: PortfolioSummary | null;
}

const TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  CEDEAR: { bg: "bg-indigo-500/20", text: "text-indigo-300", border: "border-indigo-500/30" },
  ACCION: { bg: "bg-blue-500/20", text: "text-blue-300", border: "border-blue-500/30" },
  FCI: { bg: "bg-emerald-500/20", text: "text-emerald-300", border: "border-emerald-500/30" },
  CRYPTO: { bg: "bg-amber-500/20", text: "text-amber-300", border: "border-amber-500/30" },
  BONO: { bg: "bg-purple-500/20", text: "text-purple-300", border: "border-purple-500/30" },
  OTRO: { bg: "bg-zinc-500/20", text: "text-zinc-300", border: "border-zinc-500/30" },
};

export function PersonalInvestmentsView({
  userId,
  householdId,
  userName,
  title,
  investments: initialInvestments,
  summary: initialSummary,
}: PersonalInvestmentsViewProps) {
  const [investments, setInvestments] = useState<HydratedInvestment[]>(initialInvestments || []);
  const [summary, setSummary] = useState<PortfolioSummary | null>(initialSummary || null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<HydratedInvestment | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Sincronizar props cuando cambian
  React.useEffect(() => {
    setInvestments(initialInvestments || []);
    setSummary(initialSummary || null);
  }, [initialInvestments, initialSummary]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (householdId) {
        const res = await refreshSharedInvestmentsAction(householdId);
        setInvestments(res.investments);
        setSummary(res.summary);
      } else if (userId) {
        const res = await refreshPersonalInvestmentsAction(userId);
        setInvestments(res.investments);
        setSummary(res.summary);
      }
    } catch (err) {
      console.error("Error refreshing investments:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`¿Eliminar ${name} del portafolio?`)) {
      setDeletingId(id);
      try {
        if (householdId) {
          await deleteSharedInvestmentAction(id);
        } else {
          await deletePersonalInvestmentAction(id);
        }
        setInvestments((prev) => prev.filter((i) => i.id !== id));
        // Refrescar cálculo total
        handleRefresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Error al eliminar");
      } finally {
        setDeletingId(null);
      }
    }
  };

  const totalValuationArs = summary?.totalValuationArs ?? 0;
  const totalValuationUsd = summary?.totalValuationUsd ?? 0;
  const totalGainLossArs = summary?.totalGainLossArs ?? 0;
  const totalGainLossPct = summary?.totalGainLossPct ?? 0;
  const mepRate = summary?.rates?.mep ?? 1530;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Tarjeta Principal del Portafolio (Obsidian Glass) */}
      <section className="super-card rounded-3xl p-5 relative overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            {title || (householdId ? "Inversiones del Hogar" : "Portafolio de Inversiones")} ({investments.length})
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.08] text-zinc-300 font-mono font-bold border border-white/[0.1]">
              MEP: ${Math.round(mepRate).toLocaleString("es-AR")}
            </span>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 active:scale-90 transition disabled:opacity-50"
              title="Actualizar cotizaciones"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-emerald-400" : ""}`} />
            </button>
          </div>
        </div>

        {/* Valuación Total */}
        <div className="mt-1 flex items-baseline justify-between">
          <div>
            <span className="text-[11px] font-medium text-zinc-400 block mb-0.5">
              Valuación Total Estimada
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white tracking-tight font-mono tabular-nums">
                ${Math.round(totalValuationArs).toLocaleString("es-AR")}
              </span>
              <span className="text-sm font-bold text-zinc-400 font-mono tabular-nums">
                ≈ u$s {Math.round(totalValuationUsd).toLocaleString("es-AR")}
              </span>
            </div>
          </div>
        </div>

        {/* Rendimiento / P&L Global si hay costo registrado */}
        {summary && summary.totalCostArs > 0 && (
          <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs">
            <span className="text-zinc-400 font-medium">Ganancia / Rendimiento histórico:</span>
            <div
              className={`flex items-center gap-1 font-mono font-bold ${
                totalGainLossArs >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {totalGainLossArs >= 0 ? (
                <ArrowUpRight className="w-3.5 h-3.5" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5" />
              )}
              <span>
                {totalGainLossArs >= 0 ? "+" : ""}${Math.round(totalGainLossArs).toLocaleString("es-AR")}
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-white/[0.08] ml-1">
                {totalGainLossArs >= 0 ? "+" : ""}
                {totalGainLossPct.toFixed(1)}%
              </span>
            </div>
          </div>
        )}

        {/* Botón "+ Inversión" en el Card */}
        <div className="mt-4 pt-3 border-t border-white/[0.06] flex gap-2">
          <button
            onClick={() => {
              setEditingInvestment(null);
              setIsModalOpen(true);
            }}
            className="w-full py-2.5 px-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-1.5 active:scale-95 transition"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Agregar Activo / Ticker</span>
          </button>
        </div>
      </section>

      {/* Distribución por Tipo de Activo */}
      {summary && summary.assetTypeBreakdown.length > 0 && totalValuationArs > 0 && (
        <section className="super-card rounded-2xl p-3.5 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <PieChart className="w-3.5 h-3.5 text-indigo-400" />
              Distribución de Activos
            </span>
          </div>

          {/* Mini Barra Multi-Color */}
          <div className="w-full h-2 rounded-full overflow-hidden flex bg-zinc-800/80 p-0.5 border border-white/[0.08]">
            {summary.assetTypeBreakdown.map((item, idx) => {
              const bgColors = [
                "bg-indigo-500",
                "bg-emerald-500",
                "bg-purple-500",
                "bg-amber-500",
                "bg-blue-500",
                "bg-rose-500",
              ];
              const color = bgColors[idx % bgColors.length];
              return (
                <div
                  key={item.type}
                  style={{ width: `${Math.max(2, item.pct)}%` }}
                  className={`h-full ${color} first:rounded-l-full last:rounded-r-full`}
                  title={`${item.type}: ${Math.round(item.pct)}%`}
                />
              );
            })}
          </div>

          {/* Pills con desglose */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {summary.assetTypeBreakdown.map((item, idx) => {
              const badgeStyle = TYPE_COLORS[item.type] || TYPE_COLORS.OTRO;
              return (
                <span
                  key={item.type}
                  className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border} flex items-center gap-1`}
                >
                  <span className="font-bold">{item.type}</span>
                  <span className="opacity-70 tabular-nums">{Math.round(item.pct)}%</span>
                  <span className="font-mono opacity-90 tabular-nums">
                    (${Math.round(item.totalArs).toLocaleString("es-AR")})
                  </span>
                </span>
              );
            })}
          </div>
        </section>
      )}

      {/* Lista de Activos Invertidos */}
      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
            Posiciones ({investments.length})
          </h2>
          <span className="text-[10px] text-zinc-500">
            Cotizaciones Yahoo & DolarApi
          </span>
        </div>

        {investments.length === 0 ? (
          <div className="super-card rounded-2xl p-8 text-center">
            <PiggyBank className="w-8 h-8 text-zinc-600 mx-auto mb-2 opacity-60" />
            <p className="text-sm font-medium text-zinc-300">
              Sin inversiones personales registradas
            </p>
            <p className="text-xs text-zinc-500 mt-1 max-w-xs mx-auto">
              Agregá acciones, CEDEARs (ej. Apple, SPY), Fondos Comunes de Inversión (FCI) o Cripto con cotizaciones automáticas.
            </p>
            <button
              onClick={() => {
                setEditingInvestment(null);
                setIsModalOpen(true);
              }}
              className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-md active:scale-95 transition inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Agregar tu primera inversión</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {investments.map((inv) => {
              const badgeStyle = TYPE_COLORS[inv.assetType] || TYPE_COLORS.OTRO;
              const hasPnl = inv.gainLossArs !== null && inv.gainLossPct !== null;

              return (
                <div
                  key={inv.id}
                  className="super-card-subtle rounded-2xl p-3.5 hover:bg-white/[0.05] transition duration-150 border border-white/[0.08] space-y-2.5 group"
                >
                  {/* Cabecera del Activo: Ticker + Tipo + Botones */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-zinc-800/80 border border-white/[0.08] flex items-center justify-center font-bold text-xs text-white font-mono shadow-sm shrink-0">
                        {inv.ticker.slice(0, 4)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm text-white group-hover:text-indigo-300 transition-colors font-mono">
                            {inv.ticker}
                          </span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}
                          >
                            {inv.assetType}
                          </span>
                        </div>
                        <span className="text-xs text-zinc-400 block truncate max-w-[180px]">
                          {inv.name}
                        </span>
                      </div>
                    </div>

                    {/* Acciones de edición / borrado */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingInvestment(inv);
                          setIsModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-white active:scale-90 transition"
                        title="Editar posición"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(inv.id, inv.ticker)}
                        disabled={deletingId === inv.id}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 active:scale-90 transition disabled:opacity-50"
                        title="Eliminar posición"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Fila de Métricas: Cantidad, Precio Unitario, Total Valuación */}
                  <div className="grid grid-cols-2 gap-2 bg-white/[0.02] border border-white/[0.05] rounded-xl p-2.5 text-xs">
                    <div>
                      <span className="text-[10px] text-zinc-500 block uppercase font-medium">
                        Tenencia
                      </span>
                      <span className="font-bold text-zinc-200 font-mono tabular-nums">
                        {inv.quantity.toLocaleString("es-AR")}{" "}
                        <span className="text-[10px] font-normal text-zinc-400">
                          {inv.assetType === "FCI" ? "cuotapartes" : "nom."}
                        </span>
                      </span>
                      <div className="text-[10px] text-zinc-400 font-mono mt-0.5 flex items-center gap-1">
                        <span>
                          {inv.priceCurrency === "USD" ? "u$s" : "$"}{" "}
                          {inv.currentPrice.toLocaleString("es-AR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 4,
                          })}
                        </span>
                        {inv.dailyChangePct !== null && (
                          <span
                            className={`font-bold ${
                              inv.dailyChangePct >= 0 ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {inv.dailyChangePct >= 0 ? "+" : ""}
                            {inv.dailyChangePct.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-zinc-500 block uppercase font-medium">
                        Valuación Total
                      </span>
                      <span className="text-base font-extrabold text-white font-mono tabular-nums block">
                        ${Math.round(inv.totalValuationArs).toLocaleString("es-AR")}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono tabular-nums block">
                        ≈ u$s {Math.round(inv.totalValuationUsd).toLocaleString("es-AR")}
                      </span>
                    </div>
                  </div>

                  {/* P&L si hay precio de compra */}
                  {hasPnl && (
                    <div className="flex items-center justify-between text-[11px] px-1 pt-0.5">
                      <span className="text-zinc-500">
                        Costo base: ${Math.round(inv.totalCostArs || 0).toLocaleString("es-AR")}
                      </span>
                      <span
                        className={`font-mono font-bold flex items-center gap-0.5 ${
                          (inv.gainLossArs || 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {(inv.gainLossArs || 0) >= 0 ? "+" : ""}$
                        {Math.round(inv.gainLossArs || 0).toLocaleString("es-AR")} (
                        {(inv.gainLossPct || 0) >= 0 ? "+" : ""}
                        {(inv.gainLossPct || 0).toFixed(1)}%)
                      </span>
                    </div>
                  )}

                  {inv.notes && (
                    <div className="text-[10px] text-zinc-400 italic px-1 flex items-center gap-1">
                      <span>💬</span>
                      <span>{inv.notes}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Modal de Agregar / Editar Inversión */}
      <PersonalInvestmentModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingInvestment(null);
        }}
        userId={userId}
        householdId={householdId}
        investmentToEdit={editingInvestment}
        onSaved={handleRefresh}
      />
    </div>
  );
}
