"use client";

import React, { useState } from "react";
import {
  TrendingUp,
  Plus,
  Trash2,
  Edit3,
  PiggyBank,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  PieChart,
  Check,
  Building2,
} from "lucide-react";
import { PersonalInvestmentModal } from "./PersonalInvestmentModal";
import {
  deletePersonalInvestmentAction,
  deleteSharedInvestmentAction,
  refreshPersonalInvestmentsAction,
  refreshSharedInvestmentsAction,
  savePersonalInvestmentAction,
  saveSharedInvestmentAction,
  fetchFciQuoteAction,
} from "@/app/actions";
import {
  HydratedInvestment,
  PortfolioSummary,
  CafciFundQuote,
} from "@/lib/investments-service";
import { triggerHaptic } from "@/lib/haptics";

interface PersonalInvestmentsViewProps {
  userId?: string;
  householdId?: string;
  userName?: string;
  title?: string;
  investments: HydratedInvestment[];
  summary?: PortfolioSummary | null;
}

const TYPE_COLORS: Record<
  string,
  { bg: string; text: string; border: string; label: string }
> = {
  CEDEAR: {
    bg: "bg-indigo-500/20",
    text: "text-indigo-300",
    border: "border-indigo-500/30",
    label: "CEDEAR",
  },
  ACCION: {
    bg: "bg-blue-500/20",
    text: "text-blue-300",
    border: "border-blue-500/30",
    label: "Acción",
  },
  FCI: {
    bg: "bg-emerald-500/20",
    text: "text-emerald-300",
    border: "border-emerald-500/30",
    label: "FCI",
  },
  BONO: {
    bg: "bg-purple-500/20",
    text: "text-purple-300",
    border: "border-purple-500/30",
    label: "Bono",
  },
  ON: {
    bg: "bg-cyan-500/20",
    text: "text-cyan-300",
    border: "border-cyan-500/30",
    label: "ON",
  },
  PLAZO_FIJO: {
    bg: "bg-teal-500/20",
    text: "text-teal-300",
    border: "border-teal-500/30",
    label: "Plazo Fijo",
  },
  CRYPTO: {
    bg: "bg-amber-500/20",
    text: "text-amber-300",
    border: "border-amber-500/30",
    label: "Cripto",
  },
  OTRO: {
    bg: "bg-zinc-500/20",
    text: "text-zinc-300",
    border: "border-zinc-500/30",
    label: "Otro",
  },
};

export function PersonalInvestmentsView({
  userId,
  householdId,
  title,
  investments: initialInvestments,
  summary: initialSummary,
}: PersonalInvestmentsViewProps) {
  const [investments, setInvestments] = useState<HydratedInvestment[]>(
    initialInvestments || []
  );
  const [summary, setSummary] = useState<PortfolioSummary | null>(
    initialSummary || null
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [defaultModalAssetType, setDefaultModalAssetType] =
    useState<string>("CEDEAR");
  const [editingInvestment, setEditingInvestment] =
    useState<HydratedInvestment | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Estado para edición rápida inline de cualquier activo
  const [quickEditId, setQuickEditId] = useState<string | null>(null);
  const [quickValuationMode, setQuickValuationMode] = useState<"total" | "units">(
    "total"
  );
  const [quickQuantity, setQuickQuantity] = useState<string>("");
  const [quickManualPrice, setQuickManualPrice] = useState<string>("");
  const [quickBuyPrice, setQuickBuyPrice] = useState<string>("");
  const [quickNotes, setQuickNotes] = useState<string>("");
  const [quickFciQuote, setQuickFciQuote] = useState<
    (CafciFundQuote & { recommendedVcp?: number }) | null
  >(null);
  const [isLoadingQuickFci, setIsLoadingQuickFci] = useState(false);
  const [isSavingQuick, setIsSavingQuick] = useState(false);

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

  const handleOpenQuickEdit = (inv: HydratedInvestment) => {
    triggerHaptic(6);
    if (quickEditId === inv.id) {
      setQuickEditId(null);
      return;
    }
    const isDirect =
      (inv.assetType === "FCI" ||
        inv.assetType === "PLAZO_FIJO" ||
        inv.assetType === "ON" ||
        inv.assetType === "OTRO") &&
      inv.quantity === 1;

    setQuickEditId(inv.id);
    setQuickValuationMode(isDirect ? "total" : "units");
    setQuickQuantity(String(inv.quantity));
    setQuickManualPrice(
      inv.manualPrice
        ? String(inv.manualPrice)
        : String(inv.currentPrice || "")
    );
    setQuickBuyPrice(inv.buyPrice ? String(inv.buyPrice) : "");
    setQuickNotes(inv.notes || "");
    setQuickFciQuote(null);
  };

  const handleFetchQuickFciQuote = async (inv: HydratedInvestment) => {
    triggerHaptic(8);
    setIsLoadingQuickFci(true);
    try {
      const refPrice = parseFloat(quickManualPrice.replace(",", ".")) || inv.manualPrice;
      const quote = await fetchFciQuoteAction(inv.name || inv.ticker, refPrice);
      if (quote) {
        setQuickFciQuote(quote);
        setQuickValuationMode("units");
        setQuickManualPrice(String(quote.recommendedVcp || quote.vcpUnit));
      } else {
        alert(
          "No se encontró cotización automática en CAFCI para ese nombre. Podés editar el nombre del fondo con el buscador (botón lápiz)."
        );
      }
    } catch (err) {
      console.error("Error fetching quick FCI quote:", err);
    } finally {
      setIsLoadingQuickFci(false);
    }
  };

  const handleSaveQuickEdit = async (inv: HydratedInvestment) => {
    const isDirectBalance =
      (inv.assetType === "FCI" ||
        inv.assetType === "PLAZO_FIJO" ||
        inv.assetType === "ON" ||
        inv.assetType === "OTRO") &&
      quickValuationMode === "total";

    const newQty = isDirectBalance
      ? 1
      : parseFloat(quickQuantity.replace(",", ".")) || inv.quantity;
    const newManual = quickManualPrice
      ? parseFloat(quickManualPrice.replace(",", "."))
      : null;
    const newBuy = quickBuyPrice
      ? parseFloat(quickBuyPrice.replace(",", "."))
      : null;

    setIsSavingQuick(true);
    try {
      const isManualAsset =
        inv.assetType === "FCI" ||
        inv.assetType === "PLAZO_FIJO" ||
        inv.assetType === "ON" ||
        inv.assetType === "OTRO" ||
        !inv.hasLiveQuote;

      const payload = {
        id: inv.id,
        ticker: inv.ticker,
        name: inv.name,
        assetType: inv.assetType,
        quantity: newQty,
        buyPrice: newBuy,
        currency: inv.currency,
        manualPrice: isManualAsset ? newManual : inv.manualPrice,
        notes: quickNotes.trim() || null,
      };

      if (householdId) {
        await saveSharedInvestmentAction({ ...payload, householdId });
      } else if (userId) {
        await savePersonalInvestmentAction({ ...payload, userId });
      }

      triggerHaptic("success");
      setQuickEditId(null);
      await handleRefresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al actualizar");
    } finally {
      setIsSavingQuick(false);
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
    <div className="space-y-3.5 animate-fade-in">
      {/* Tarjeta Principal del Portafolio */}
      <section className="super-card rounded-3xl p-4 sm:p-5 relative overflow-hidden">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5 truncate">
            <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="truncate">
              {title || (householdId ? "Portafolio Hogar" : "Mi Portafolio")} (
              {investments.length})
            </span>
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.08] text-zinc-300 font-mono font-bold border border-white/[0.1]">
              MEP ${Math.round(mepRate).toLocaleString("es-AR")}
            </span>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 active:scale-90 transition disabled:opacity-50"
              title="Actualizar cotizaciones"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  isRefreshing ? "animate-spin text-emerald-400" : ""
                }`}
              />
            </button>
          </div>
        </div>

        {/* Valuación Total */}
        <div className="mt-1">
          <span className="text-[11px] font-medium text-zinc-400 block mb-0.5">
            Valuación Total Estimada
          </span>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-mono tabular-nums">
              ${Math.round(totalValuationArs).toLocaleString("es-AR")}
            </span>
            <span className="text-xs sm:text-sm font-bold text-zinc-400 font-mono tabular-nums">
              ≈ u$s {Math.round(totalValuationUsd).toLocaleString("es-AR")}
            </span>
          </div>
        </div>

        {/* Rendimiento / P&L Global */}
        {summary && summary.totalCostArs > 0 && (
          <div className="mt-2.5 pt-2.5 border-t border-white/[0.06] flex items-center justify-between text-xs">
            <span className="text-zinc-400 font-medium">Rendimiento:</span>
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
                {totalGainLossArs >= 0 ? "+" : ""}$
                {Math.round(totalGainLossArs).toLocaleString("es-AR")}
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-white/[0.08] ml-1">
                {totalGainLossArs >= 0 ? "+" : ""}
                {totalGainLossPct.toFixed(1)}%
              </span>
            </div>
          </div>
        )}

        {/* 2 Botones Concisos para Mobile (1 sola línea siempre visible) */}
        <div className="mt-3.5 pt-3 border-t border-white/[0.06] grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setEditingInvestment(null);
              setDefaultModalAssetType("CEDEAR");
              setIsModalOpen(true);
            }}
            className="min-h-[42px] py-2.5 px-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-1.5 active:scale-95 transition"
          >
            <Plus className="w-4 h-4 stroke-[2.5] shrink-0" />
            <span className="truncate">Acción / CEDEAR</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingInvestment(null);
              setDefaultModalAssetType("FCI");
              setIsModalOpen(true);
            }}
            className="min-h-[42px] py-2.5 px-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-1.5 active:scale-95 transition"
          >
            <PiggyBank className="w-4 h-4 shrink-0" />
            <span className="truncate">Fondo FCI / PF</span>
          </button>
        </div>
      </section>

      {/* Distribución por Tipo de Activo */}
      {summary &&
        summary.assetTypeBreakdown.length > 0 &&
        totalValuationArs > 0 && (
          <section className="super-card rounded-2xl p-3.5 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <PieChart className="w-3.5 h-3.5 text-indigo-400" />
                Distribución
              </span>
            </div>

            <div className="w-full h-2 rounded-full overflow-hidden flex bg-zinc-800/80 p-0.5 border border-white/[0.08]">
              {summary.assetTypeBreakdown.map((item, idx) => {
                const bgColors = [
                  "bg-indigo-500",
                  "bg-emerald-500",
                  "bg-purple-500",
                  "bg-amber-500",
                  "bg-blue-500",
                  "bg-cyan-500",
                  "bg-teal-500",
                ];
                const color = bgColors[idx % bgColors.length];
                return (
                  <div
                    key={item.type}
                    style={{ width: `${Math.max(2, item.pct)}%` }}
                    className={`h-full ${color} first:rounded-l-full last:rounded-r-full`}
                  />
                );
              })}
            </div>

            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {summary.assetTypeBreakdown.map((item) => {
                const badgeStyle = TYPE_COLORS[item.type] || TYPE_COLORS.OTRO;
                return (
                  <span
                    key={item.type}
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border} flex items-center gap-1`}
                  >
                    <span className="font-bold">{badgeStyle.label}</span>
                    <span className="opacity-75 tabular-nums">
                      {Math.round(item.pct)}%
                    </span>
                  </span>
                );
              })}
            </div>
          </section>
        )}

      {/* Lista de Posiciones */}
      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
            Posiciones ({investments.length})
          </h2>
          <span className="text-[10px] text-zinc-500">
            Cotizaciones en vivo & manual
          </span>
        </div>

        {investments.length === 0 ? (
          <div className="super-card rounded-2xl p-6 text-center">
            <PiggyBank className="w-8 h-8 text-zinc-600 mx-auto mb-2 opacity-60" />
            <p className="text-sm font-medium text-zinc-300">
              {householdId
                ? "Sin inversiones en el portafolio del hogar"
                : "Sin inversiones personales registradas"}
            </p>
            <p className="text-xs text-zinc-500 mt-1 max-w-xs mx-auto">
              Sumá Fondos Comunes (FCI), CEDEARs, Acciones, Bonos o Cripto con datos actualizables.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {investments.map((inv) => {
              const badgeStyle = TYPE_COLORS[inv.assetType] || TYPE_COLORS.OTRO;
              const hasPnl =
                inv.gainLossArs !== null && inv.gainLossPct !== null;
              const isQuickEditing = quickEditId === inv.id;
              const isDirectBalance =
                (inv.assetType === "FCI" ||
                  inv.assetType === "PLAZO_FIJO" ||
                  inv.assetType === "ON" ||
                  inv.assetType === "OTRO") &&
                inv.quantity === 1;

              return (
                <div
                  key={inv.id}
                  className="super-card-subtle rounded-2xl p-3.5 border border-white/[0.08] space-y-2.5"
                >
                  {/* FILA 1: Activo a la izquierda + Valuación Total a la derecha (sin botones apretados) */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-zinc-800/80 border border-white/[0.08] flex items-center justify-center font-bold text-[11px] text-white font-mono shrink-0">
                        {inv.assetType === "FCI"
                          ? "FCI"
                          : inv.assetType === "PLAZO_FIJO"
                          ? "PF"
                          : inv.ticker.replace(".BA", "").slice(0, 4)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-sm text-white truncate max-w-[160px] sm:max-w-[240px]">
                            {inv.assetType === "FCI" ||
                            inv.assetType === "PLAZO_FIJO"
                              ? inv.name
                              : inv.ticker.replace(".BA", "")}
                          </span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}
                          >
                            {badgeStyle.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {inv.assetType !== "FCI" &&
                            inv.assetType !== "PLAZO_FIJO" && (
                              <span className="text-[11px] text-zinc-400 truncate max-w-[160px]">
                                {inv.name}
                              </span>
                            )}
                          {inv.notes && (
                            <span className="text-[10px] font-medium text-indigo-300/90 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.2 rounded-md inline-flex items-center gap-1">
                              <Building2 className="w-2.5 h-2.5" />
                              {inv.notes}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Valuación a la derecha */}
                    <div className="text-right shrink-0">
                      <span className="text-base font-extrabold text-white font-mono tabular-nums block">
                        ${Math.round(inv.totalValuationArs).toLocaleString("es-AR")}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono tabular-nums block">
                        ≈ u$s {Math.round(inv.totalValuationUsd).toLocaleString("es-AR")}
                      </span>
                    </div>
                  </div>

                  {/* FILA 2: Detalle de Tenencia / P&L + Botones cómodos de Acción */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/[0.06]">
                    <div className="text-[11px] text-zinc-400 min-w-0">
                      {isDirectBalance ? (
                        <span>Saldo directo</span>
                      ) : (
                        <span className="font-mono text-zinc-300">
                          {inv.quantity.toLocaleString("es-AR")}{" "}
                          {inv.assetType === "FCI" ? "cuot." : "nom."} ×{" "}
                          {inv.priceCurrency === "USD" ? "u$s" : "$"}
                          {inv.currentPrice.toLocaleString("es-AR", {
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      )}
                      {hasPnl && (
                        <span
                          className={`ml-2 font-mono font-bold ${
                            (inv.gainLossArs || 0) >= 0
                              ? "text-emerald-400"
                              : "text-rose-400"
                          }`}
                        >
                          {(inv.gainLossPct || 0) >= 0 ? "+" : ""}
                          {(inv.gainLossPct || 0).toFixed(1)}%
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenQuickEdit(inv)}
                        className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition active:scale-95 ${
                          isQuickEditing
                            ? "bg-indigo-600 text-white border-indigo-400"
                            : "bg-white/[0.05] hover:bg-white/[0.1] text-zinc-200 border-white/[0.1]"
                        }`}
                      >
                        {isQuickEditing ? "Cerrar" : "Actualizar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingInvestment(inv);
                          setIsModalOpen(true);
                        }}
                        className="p-2 rounded-xl text-zinc-400 hover:text-white bg-white/[0.04] active:scale-90 transition"
                        title="Editar"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(inv.id, inv.name)}
                        disabled={deletingId === inv.id}
                        className="p-2 rounded-xl text-zinc-400 hover:text-rose-400 bg-white/[0.04] active:scale-90 transition disabled:opacity-50"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Panel de Actualización Rápida Inline */}
                  {isQuickEditing && (
                    <div className="p-3 rounded-xl bg-zinc-900/95 border border-indigo-500/30 space-y-2.5 animate-fade-in">
                      {/* Si es FCI, permitir alternar entre Cuotapartes + VCP y Saldo Total + botón de VCP oficial */}
                      {inv.assetType === "FCI" && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex bg-black/40 p-0.5 rounded-lg border border-white/[0.08]">
                              <button
                                type="button"
                                onClick={() => {
                                  triggerHaptic(6);
                                  setQuickValuationMode("units");
                                }}
                                className={`px-2 py-1 rounded-md text-[10px] font-bold transition ${
                                  quickValuationMode === "units"
                                    ? "bg-emerald-600 text-white"
                                    : "text-zinc-400"
                                }`}
                              >
                                Por Cuotaparte
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  triggerHaptic(6);
                                  setQuickValuationMode("total");
                                  setQuickQuantity("1");
                                }}
                                className={`px-2 py-1 rounded-md text-[10px] font-bold transition ${
                                  quickValuationMode === "total"
                                    ? "bg-emerald-600 text-white"
                                    : "text-zinc-400"
                                }`}
                              >
                                Saldo Total
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleFetchQuickFciQuote(inv)}
                              disabled={isLoadingQuickFci}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/35 text-emerald-300 text-[10px] font-bold flex items-center gap-1 active:scale-95 transition disabled:opacity-50"
                            >
                              <RefreshCw
                                className={`w-3 h-3 ${
                                  isLoadingQuickFci ? "animate-spin" : ""
                                }`}
                              />
                              <span>
                                {isLoadingQuickFci
                                  ? "Buscando..."
                                  : "VCP Oficial CAFCI"}
                              </span>
                            </button>
                          </div>

                          {quickFciQuote && quickFciQuote.vcpUnit > 0 && (
                            <div className="flex items-center justify-between gap-1.5 p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/25 text-[10px]">
                              <span className="text-emerald-300 truncate">
                                CAFCI ({quickFciQuote.date}):
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setQuickValuationMode("units");
                                    setQuickManualPrice(
                                      String(quickFciQuote.vcpUnit)
                                    );
                                  }}
                                  className="px-2 py-0.5 rounded bg-emerald-500/25 text-white font-mono font-bold hover:bg-emerald-500/40"
                                >
                                  Unit: ${quickFciQuote.vcpUnit}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setQuickValuationMode("units");
                                    setQuickManualPrice(
                                      String(quickFciQuote.vcpPer1000)
                                    );
                                  }}
                                  className="px-2 py-0.5 rounded bg-white/[0.08] text-zinc-200 font-mono font-bold hover:bg-white/[0.15]"
                                >
                                  c/1000: ${quickFciQuote.vcpPer1000}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {(inv.assetType === "FCI" ||
                        inv.assetType === "PLAZO_FIJO" ||
                        inv.assetType === "ON" ||
                        inv.assetType === "OTRO") &&
                      quickValuationMode === "total" ? (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-zinc-400 block mb-1">
                              Saldo Actual ({inv.currency === "USD" ? "u$s" : "$"})
                            </label>
                            <input
                              type="number"
                              step="any"
                              value={quickManualPrice}
                              onChange={(e) =>
                                setQuickManualPrice(e.target.value)
                              }
                              className="w-full bg-black/50 border border-white/[0.15] rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-zinc-400 block mb-1">
                              Invertido Inicial
                            </label>
                            <input
                              type="number"
                              step="any"
                              value={quickBuyPrice}
                              onChange={(e) => setQuickBuyPrice(e.target.value)}
                              placeholder="Opcional"
                              className="w-full bg-black/50 border border-white/[0.15] rounded-lg px-2.5 py-1.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-[10px] text-zinc-400 block mb-1">
                              {inv.assetType === "FCI"
                                ? "Cuotapartes"
                                : "Cantidad"}
                            </label>
                            <input
                              type="number"
                              step="any"
                              value={quickQuantity}
                              onChange={(e) => setQuickQuantity(e.target.value)}
                              className="w-full bg-black/50 border border-white/[0.15] rounded-lg px-2 py-1.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-zinc-400 block mb-1">
                              {inv.assetType === "FCI"
                                ? "VCP Compra"
                                : "P. Compra"}
                            </label>
                            <input
                              type="number"
                              step="any"
                              value={quickBuyPrice}
                              onChange={(e) => setQuickBuyPrice(e.target.value)}
                              placeholder="Opc."
                              className="w-full bg-black/50 border border-white/[0.15] rounded-lg px-2 py-1.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-emerald-300 font-semibold block mb-1">
                              {inv.assetType === "FCI"
                                ? "Valor Cuotaparte"
                                : "P. Actual"}
                            </label>
                            <input
                              type="number"
                              step="any"
                              value={quickManualPrice}
                              onChange={(e) =>
                                setQuickManualPrice(e.target.value)
                              }
                              disabled={inv.hasLiveQuote}
                              className="w-full bg-black/50 border border-emerald-500/40 rounded-lg px-2 py-1.5 text-xs font-mono font-bold text-white disabled:opacity-50 focus:outline-none focus:border-emerald-400"
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={quickNotes}
                          onChange={(e) => setQuickNotes(e.target.value)}
                          placeholder="Fondo Común / Banco / Broker..."
                          className="flex-1 bg-black/50 border border-white/[0.12] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveQuickEdit(inv)}
                          disabled={isSavingQuick}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 shrink-0 active:scale-95 transition disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{isSavingQuick ? "..." : "Guardar"}</span>
                        </button>
                      </div>
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
        defaultAssetType={defaultModalAssetType}
        investmentToEdit={editingInvestment}
        onSaved={handleRefresh}
      />
    </div>
  );
}
