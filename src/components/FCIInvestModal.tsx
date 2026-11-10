"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  TrendingUp,
  PiggyBank,
  Check,
  ArrowUpRight,
  ArrowDownLeft,
  Sparkles,
  Trash2,
  Wallet,
  Tag,
  AlertCircle,
  Search,
  RefreshCw,
} from "./ui/icons";
import {
  transferSurplusToFCIAction,
  updateFCIValueAction,
  createFCIWithdrawalAction,
  deleteFCIWithdrawalAction,
  searchFciFundsAction,
  fetchFciQuoteAction,
} from "@/app/actions";
import {
  POPULAR_ARGENTINA_FCIS,
  CafciFundQuote,
} from "@/lib/investments-service";
import { triggerHaptic } from "@/lib/haptics";

export interface FCIWithdrawalItem {
  id: string;
  amount: number;
  destination: string;
  purpose?: string | null;
  withdrawnAt: Date | string;
}

interface FCIInvestModalProps {
  isOpen: boolean;
  onClose: () => void;
  periodId: string;
  fundId?: string;
  fundName?: string;
  currentFundValue: number;
  surplusAmount: number;
  isAlreadyTransferred: boolean;
  userABalance: { name: string; quotaPct: number };
  userBBalance: { name: string; quotaPct: number };
  withdrawals?: FCIWithdrawalItem[];
}

export function FCIInvestModal({
  isOpen,
  onClose,
  periodId,
  fundId,
  fundName = "FCI Ahorro Pareja",
  currentFundValue,
  surplusAmount,
  isAlreadyTransferred,
  userABalance,
  userBBalance,
  withdrawals = [],
}: FCIInvestModalProps) {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"INVEST" | "WITHDRAW">("INVEST");
  const [isUpdatingValue, setIsUpdatingValue] = useState<boolean>(false);
  const [newValueInput, setNewValueInput] = useState<string>(
    currentFundValue ? currentFundValue.toString() : ""
  );
  const [fundNameInput, setFundNameInput] = useState<string>(
    fundName || "FCI Ahorro Pareja"
  );
  const [fciSearchQuery, setFciSearchQuery] = useState<string>("");
  const [fciSearchResults, setFciSearchResults] = useState<CafciFundQuote[]>([]);
  const [isSearchingFci, setIsSearchingFci] = useState<boolean>(false);
  const [cuotapartesInput, setCuotapartesInput] = useState<string>("");
  const [vcpInput, setVcpInput] = useState<string>("");
  const [isLoadingVcp, setIsLoadingVcp] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Estados del Formulario de Retiro
  const [withdrawAmount, setWithdrawAmount] = useState<string>("");
  const [withdrawDestination, setWithdrawDestination] = useState<"POOL_FUND" | "CUSTOM_USE">("POOL_FUND");
  const [withdrawPurpose, setWithdrawPurpose] = useState<string>("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setNewValueInput(currentFundValue ? currentFundValue.toString() : "0");
      setFundNameInput(fundName || "FCI Ahorro Pareja");
      setFciSearchQuery("");
      setFciSearchResults([]);
      setErrorMsg(null);
    }
  }, [isOpen, currentFundValue, fundName]);

  useEffect(() => {
    if (!isUpdatingValue || !fciSearchQuery.trim()) {
      setFciSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingFci(true);
      try {
        const res = await searchFciFundsAction(fciSearchQuery.trim());
        setFciSearchResults(res);
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearchingFci(false);
      }
    }, 280);
    return () => clearTimeout(timer);
  }, [fciSearchQuery, isUpdatingValue]);

  if (!isOpen || !mounted) return null;

  const quotaA = Math.round(surplusAmount * (userABalance.quotaPct / 100));
  const quotaB = Math.round(surplusAmount * (userBBalance.quotaPct / 100));

  const handleTransfer = async () => {
    if (!fundId || surplusAmount <= 0) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await transferSurplusToFCIAction(periodId, fundId);
      triggerHaptic("success");
      onClose();
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : "Error al transferir al FCI");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveValue = async () => {
    const val = parseFloat(newValueInput.replace(",", ".")) || 0;
    const cleanName = fundNameInput.trim() || "FCI Ahorro Pareja";
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await updateFCIValueAction(fundId || "", val, cleanName);
      triggerHaptic(15);
      setIsUpdatingValue(false);
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : "Error al actualizar datos del FCI");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fundId) return;

    const amountNum = parseFloat(withdrawAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setErrorMsg("Ingresá un monto válido mayor a 0.");
      return;
    }

    if (amountNum > currentFundValue) {
      setErrorMsg(
        `El monto ($${Math.round(amountNum).toLocaleString("es-AR")}) supera el saldo actual del FCI ($${Math.round(currentFundValue).toLocaleString("es-AR")}).`
      );
      return;
    }

    if (withdrawDestination === "CUSTOM_USE" && !withdrawPurpose.trim()) {
      setErrorMsg("Por favor, indicá para qué se usó el dinero retirado.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await createFCIWithdrawalAction({
        fundId,
        periodId,
        amount: amountNum,
        destination: withdrawDestination,
        purpose: withdrawPurpose,
      });

      setWithdrawAmount("");
      setWithdrawPurpose("");
      setWithdrawDestination("POOL_FUND");
      triggerHaptic("success");
      onClose();
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : "Error al registrar el retiro");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteWithdrawal = async (withdrawalId: string) => {
    if (!confirm("¿Querés anular este retiro y reintegrar el monto al saldo del FCI?")) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await deleteFCIWithdrawalAction(withdrawalId);
      triggerHaptic(12);
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : "Error al anular el retiro");
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          triggerHaptic(6);
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-md super-card rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[88dvh] sm:max-h-[90vh] overflow-hidden border border-white/[0.12]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera Fija */}
        <div className="shrink-0 px-4 pt-4 pb-3 border-b border-white/[0.08] bg-zinc-950/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <PiggyBank className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight truncate">
                {fundName || "Fondo Común de Remanentes"}
              </h2>
              <p className="text-[11px] text-zinc-400">
                Ahorro de excedentes mensuales de la pareja
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              triggerHaptic(6);
              onClose();
            }}
            className="p-2 rounded-full text-zinc-400 hover:text-white bg-white/[0.06] hover:bg-white/[0.12] active:scale-95 transition shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cuerpo Scrolleable */}
        <div
          className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
          style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom, 20px))" }}
        >
          {/* Tarjeta de Saldo Total Actual y Configuración del Fondo Común */}
          <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-2xl p-3.5 relative overflow-hidden">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-emerald-400/90 tracking-wider uppercase truncate pr-2">
                {fundName || "FCI Ahorro Pareja"}
              </span>
              <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
            </div>
            <div className="flex items-center justify-between gap-2 mt-1">
              <span className="text-2xl sm:text-3xl font-extrabold text-white font-mono tabular-nums">
                ${Math.round(currentFundValue).toLocaleString("es-AR")}
              </span>
              <button
                type="button"
                onClick={() => setIsUpdatingValue(!isUpdatingValue)}
                className="text-xs font-semibold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 rounded-xl transition active:scale-95 shrink-0"
              >
                {isUpdatingValue ? "Cerrar" : "Editar Saldo / FCI"}
              </button>
            </div>

            {isUpdatingValue && (
              <div className="mt-3.5 pt-3 border-t border-emerald-500/20 space-y-3 animate-fade-in">
                <div>
                  <label className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider block mb-1">
                    Buscador Oficial de Fondo Común (CAFCI)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Buscar FCI o Banco (ej: Fima, Balanz, Galicia, Santander)..."
                      value={fciSearchQuery}
                      onChange={(e) => setFciSearchQuery(e.target.value)}
                      className="w-full bg-black/60 border border-emerald-500/35 rounded-xl pl-8 pr-3 py-2 text-white text-xs placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <Search className="w-3.5 h-3.5 text-emerald-400 absolute left-2.5 top-2.5" />
                    {isSearchingFci && (
                      <span className="text-[10px] text-emerald-300 absolute right-3 top-2.5 animate-pulse">
                        Buscando...
                      </span>
                    )}
                  </div>

                  {fciSearchResults.length > 0 && (
                    <div className="mt-1.5 bg-zinc-950 border border-emerald-500/30 rounded-xl p-1 max-h-40 overflow-y-auto space-y-1 shadow-xl">
                      {fciSearchResults.map((f) => (
                        <button
                          key={`${f.name}_${f.ticker}`}
                          type="button"
                          onClick={() => {
                            triggerHaptic(6);
                            setFundNameInput(`${f.name} (${f.broker})`);
                            if (f.vcpUnit > 0) {
                              setVcpInput(String(f.vcpUnit));
                              const qty = parseFloat(cuotapartesInput.replace(",", "."));
                              if (qty > 0) {
                                setNewValueInput(String(Math.round(qty * f.vcpUnit)));
                              }
                            }
                            setFciSearchQuery("");
                            setFciSearchResults([]);
                          }}
                          className="w-full text-left p-2 rounded-lg hover:bg-emerald-500/15 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <span className="font-bold text-white block truncate">
                              {f.name}
                            </span>
                            <span className="text-[10px] text-emerald-300">
                              {f.broker} • {f.category}
                            </span>
                          </div>
                          {f.vcpUnit > 0 && (
                            <span className="text-[11px] font-mono font-bold text-emerald-400 shrink-0">
                              VCP ${f.vcpUnit}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mt-2 mb-1">
                    Nombre seleccionado
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Fima Premium - Clase A (Banco Galicia)"
                    value={fundNameInput}
                    onChange={(e) => setFundNameInput(e.target.value)}
                    className="w-full bg-black/50 border border-white/[0.14] rounded-xl px-3 py-2 text-white text-xs placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />

                  {/* Tira horizontal deslizable de FCIs */}
                  <div className="flex gap-1.5 overflow-x-auto no-scrollbar mt-2 pb-1">
                    {POPULAR_ARGENTINA_FCIS.map((fci) => {
                      const label = `${fci.name.split(" (")[0]} (${fci.broker})`;
                      const isSelected = fundNameInput === label;
                      return (
                        <button
                          key={fci.ticker}
                          type="button"
                          onClick={async () => {
                            triggerHaptic(6);
                            setFundNameInput(label);
                            const q = await fetchFciQuoteAction(fci.name);
                            if (q && q.vcpUnit > 0) {
                              setVcpInput(String(q.vcpUnit));
                            }
                          }}
                          className={`text-[11px] px-2.5 py-1 rounded-lg border shrink-0 transition active:scale-95 ${
                            isSelected
                              ? "bg-emerald-500/30 border-emerald-400 text-white font-bold"
                              : "bg-black/40 border-white/[0.08] text-zinc-300"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Calculadora opcional por Cuotapartes x Valor de Cuotaparte */}
                <div className="p-2.5 rounded-xl bg-black/35 border border-emerald-500/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
                      Calcular por Cuotapartes (Opcional)
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        triggerHaptic(6);
                        setIsLoadingVcp(true);
                        try {
                          const q = await fetchFciQuoteAction(fundNameInput);
                          if (q && q.vcpUnit > 0) {
                            setVcpInput(String(q.vcpUnit));
                            const qty = parseFloat(cuotapartesInput.replace(",", "."));
                            if (qty > 0) {
                              setNewValueInput(String(Math.round(qty * q.vcpUnit)));
                            }
                          }
                        } finally {
                          setIsLoadingVcp(false);
                        }
                      }}
                      disabled={isLoadingVcp}
                      className="text-[10px] font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2 py-1 rounded-lg flex items-center gap-1 active:scale-95"
                    >
                      <RefreshCw
                        className={`w-3 h-3 ${isLoadingVcp ? "animate-spin" : ""}`}
                      />
                      <span>Traer VCP Oficial</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-zinc-400 block mb-0.5">
                        Cant. Cuotapartes
                      </label>
                      <input
                        type="number"
                        step="any"
                        placeholder="Ej: 15420"
                        value={cuotapartesInput}
                        onChange={(e) => {
                          setCuotapartesInput(e.target.value);
                          const qty = parseFloat(e.target.value.replace(",", "."));
                          const vcp = parseFloat(vcpInput.replace(",", "."));
                          if (qty > 0 && vcp > 0) {
                            setNewValueInput(String(Math.round(qty * vcp)));
                          }
                        }}
                        className="w-full bg-black/50 border border-white/[0.12] rounded-lg px-2.5 py-1.5 text-xs font-mono text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-400 block mb-0.5">
                        Valor Cuotaparte ($)
                      </label>
                      <input
                        type="number"
                        step="any"
                        placeholder="VCP ($)"
                        value={vcpInput}
                        onChange={(e) => {
                          setVcpInput(e.target.value);
                          const qty = parseFloat(cuotapartesInput.replace(",", "."));
                          const vcp = parseFloat(e.target.value.replace(",", "."));
                          if (qty > 0 && vcp > 0) {
                            setNewValueInput(String(Math.round(qty * vcp)));
                          }
                        }}
                        className="w-full bg-black/50 border border-emerald-500/30 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-emerald-300"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider block mb-1">
                    Saldo Total Actualizado ($)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="any"
                      placeholder="Nuevo valor actual ($)"
                      value={newValueInput}
                      onChange={(e) => setNewValueInput(e.target.value)}
                      className="w-full bg-black/50 border border-white/[0.14] rounded-xl px-3 py-2 text-white text-sm font-mono tabular-nums focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={handleSaveValue}
                      disabled={isSubmitting}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md active:scale-95 transition whitespace-nowrap disabled:opacity-50"
                    >
                      {isSubmitting ? "..." : "Guardar"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Pestañas: Invertir / Retirar */}
          <div className="flex bg-zinc-900/90 p-1 rounded-2xl border border-white/[0.08]">
            <button
              type="button"
              onClick={() => {
                triggerHaptic(8);
                setActiveTab("INVEST");
                setErrorMsg(null);
              }}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeTab === "INVEST"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>Pasar Remanente</span>
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic(8);
                setActiveTab("WITHDRAW");
                setErrorMsg(null);
              }}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeTab === "WITHDRAW"
                  ? "bg-amber-600 text-white shadow-md shadow-amber-600/30"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              <span>Retirar Dinero</span>
            </button>
          </div>

          {errorMsg && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 px-3.5 py-2.5 rounded-2xl text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* PESTAÑA 1: PASAR REMANENTE */}
          {activeTab === "INVEST" ? (
            <div className="space-y-3.5">
              <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-3.5">
                <div className="flex justify-between items-center mb-2.5">
                  <span className="text-xs font-medium text-zinc-200">Remanente del mes:</span>
                  <span className="text-lg font-bold text-emerald-400 font-mono tabular-nums">
                    ${Math.round(surplusAmount).toLocaleString("es-AR")}
                  </span>
                </div>

                {surplusAmount > 0 ? (
                  <div className="space-y-1.5 border-t border-white/[0.06] pt-2.5">
                    <div className="text-[11px] text-zinc-300 flex items-center gap-1.5 mb-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Proporción según aportes al Fondo Común:</span>
                    </div>
                    <div className="flex justify-between text-xs text-zinc-200 font-mono tabular-nums">
                      <span className="font-sans">{userABalance.name} ({Math.round(userABalance.quotaPct)}%):</span>
                      <span className="font-bold text-white">
                        ${quotaA.toLocaleString("es-AR")}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-zinc-200 font-mono tabular-nums">
                      <span className="font-sans">{userBBalance.name} ({Math.round(userBBalance.quotaPct)}%):</span>
                      <span className="font-bold text-white">
                        ${quotaB.toLocaleString("es-AR")}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400 italic">
                    Aún no hay remanente libre este mes para transferir.
                  </p>
                )}
              </div>

              {isAlreadyTransferred ? (
                <div className="bg-emerald-950/25 border border-emerald-500/25 rounded-2xl p-3.5 flex items-center gap-2.5 text-emerald-300 text-xs">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>El excedente de este mes ya fue transferido al FCI.</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleTransfer}
                  disabled={surplusAmount <= 0 || isSubmitting}
                  className="w-full min-h-[46px] py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-semibold text-xs sm:text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 active:scale-[0.98] transition"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  <span>Pasar Remanente (${Math.round(surplusAmount).toLocaleString("es-AR")})</span>
                </button>
              )}
            </div>
          ) : (
            /* PESTAÑA 2: RETIRAR DINERO */
            <div className="space-y-4">
              <form onSubmit={handleCreateWithdrawal} className="space-y-3.5">
                <div>
                  <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block mb-1 px-1">
                    Monto a Retirar ($)
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="ej. 50000"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="w-full bg-white/[0.05] border border-white/[0.12] rounded-2xl px-3.5 py-2.5 text-white text-base font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-500/60"
                  />

                  {currentFundValue > 0 && (
                    <div className="flex gap-1.5 mt-2">
                      {[
                        { label: "25%", val: Math.round(currentFundValue * 0.25) },
                        { label: "50%", val: Math.round(currentFundValue * 0.5) },
                        { label: "100%", val: Math.round(currentFundValue) },
                      ].map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => setWithdrawAmount(item.val.toString())}
                          className="flex-1 py-1.5 px-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-[11px] font-mono text-zinc-300 border border-white/[0.06] active:scale-95"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block mb-1.5 px-1">
                    Destino del dinero
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    <label
                      onClick={() => setWithdrawDestination("POOL_FUND")}
                      className={`p-3 rounded-2xl border cursor-pointer block transition ${
                        withdrawDestination === "POOL_FUND"
                          ? "bg-blue-600/15 border-blue-500/50"
                          : "bg-white/[0.03] border-white/[0.08]"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="destination"
                          checked={withdrawDestination === "POOL_FUND"}
                          onChange={() => setWithdrawDestination("POOL_FUND")}
                        />
                        <Wallet className="w-3.5 h-3.5 text-blue-400" />
                        <span className="text-xs font-bold text-white">
                          Sumar al Fondo Común del Mes
                        </span>
                      </div>
                    </label>

                    <label
                      onClick={() => setWithdrawDestination("CUSTOM_USE")}
                      className={`p-3 rounded-2xl border cursor-pointer block transition ${
                        withdrawDestination === "CUSTOM_USE"
                          ? "bg-purple-600/15 border-purple-500/50"
                          : "bg-white/[0.03] border-white/[0.08]"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="destination"
                          checked={withdrawDestination === "CUSTOM_USE"}
                          onChange={() => setWithdrawDestination("CUSTOM_USE")}
                        />
                        <Tag className="w-3.5 h-3.5 text-purple-400" />
                        <span className="text-xs font-bold text-white">
                          Gasto o Uso Específico
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                {withdrawDestination === "CUSTOM_USE" && (
                  <div>
                    <label className="text-[11px] font-bold text-purple-300 uppercase tracking-wider block mb-1 px-1">
                      ¿Para qué se usó? *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="ej. Arreglo auto, viaje, mueble..."
                      value={withdrawPurpose}
                      onChange={(e) => setWithdrawPurpose(e.target.value)}
                      className="w-full bg-white/[0.05] border border-purple-500/30 rounded-2xl px-3.5 py-2.5 text-white text-xs focus:outline-none"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting || currentFundValue <= 0}
                  className="w-full min-h-[46px] py-3 rounded-2xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-bold text-xs shadow-lg shadow-amber-600/30 flex items-center justify-center gap-2 active:scale-[0.98] transition"
                >
                  <ArrowDownLeft className="w-4 h-4" />
                  <span>{isSubmitting ? "Registrando..." : "Confirmar Retiro"}</span>
                </button>
              </form>

              {withdrawals.length > 0 && (
                <div className="pt-2 border-t border-white/[0.08]">
                  <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2 px-1">
                    Historial de Retiros ({withdrawals.length})
                  </h4>
                  <div className="space-y-2 max-h-36 overflow-y-auto no-scrollbar">
                    {withdrawals.map((w) => (
                      <div
                        key={w.id}
                        className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-amber-300 font-mono">
                              -${Math.round(w.amount).toLocaleString("es-AR")}
                            </span>
                            <span className="text-[10px] text-zinc-400">
                              {w.destination === "POOL_FUND" ? "Al Fondo" : "Uso Específico"}
                            </span>
                          </div>
                          {w.purpose && (
                            <p className="text-[11px] text-zinc-300 italic truncate max-w-[200px]">
                              &quot;{w.purpose}&quot;
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteWithdrawal(w.id)}
                          disabled={isSubmitting}
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
