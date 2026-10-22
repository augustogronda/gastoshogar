"use client";

import React, { useState } from "react";
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
} from "./ui/icons";
import {
  transferSurplusToFCIAction,
  updateFCIValueAction,
  createFCIWithdrawalAction,
  deleteFCIWithdrawalAction,
} from "@/app/actions";
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
  const [activeTab, setActiveTab] = useState<"INVEST" | "WITHDRAW">("INVEST");
  const [isUpdatingValue, setIsUpdatingValue] = useState<boolean>(false);
  const [newValueInput, setNewValueInput] = useState<string>(
    currentFundValue ? currentFundValue.toString() : ""
  );
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Estados del Formulario de Retiro
  const [withdrawAmount, setWithdrawAmount] = useState<string>("");
  const [withdrawDestination, setWithdrawDestination] = useState<"POOL_FUND" | "CUSTOM_USE">("POOL_FUND");
  const [withdrawPurpose, setWithdrawPurpose] = useState<string>("");

  if (!isOpen) return null;

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
    if (!fundId) return;
    const val = parseFloat(newValueInput) || 0;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await updateFCIValueAction(fundId, val);
      triggerHaptic(15);
      setIsUpdatingValue(false);
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : "Error al actualizar saldo");
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

      // Limpiar formulario
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md super-card rounded-3xl p-5 shadow-2xl flex flex-col max-h-[92vh] overflow-y-auto no-scrollbar">
        
        {/* Cabecera */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <PiggyBank className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white tracking-tight">Fondo Común de Inversión</h2>
          </div>
          <button
            onClick={() => {
              triggerHaptic(6);
              onClose();
            }}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] active:scale-95 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tarjeta de Saldo Total Actual */}
        <div className="mt-4 bg-emerald-950/30 border border-emerald-500/20 rounded-2xl p-4 relative overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-emerald-400/90 tracking-wider uppercase">
              Patrimonio Invertido Conjunto
            </span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-3xl font-extrabold text-white font-mono tabular-nums">
              ${Math.round(currentFundValue).toLocaleString("es-AR")}
            </span>
            <button
              onClick={() => setIsUpdatingValue(!isUpdatingValue)}
              className="text-xs text-zinc-400 hover:text-emerald-400 underline transition"
            >
              {isUpdatingValue ? "Cancelar" : "Editar Saldo"}
            </button>
          </div>

          {isUpdatingValue && (
            <div className="mt-3 flex gap-2">
              <input
                type="number"
                placeholder="Nuevo valor broker ($)"
                value={newValueInput}
                onChange={(e) => setNewValueInput(e.target.value)}
                className="w-full bg-black/50 border border-white/[0.14] rounded-xl px-3 py-2 text-white text-sm font-mono tabular-nums text-center placeholder:text-center placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-inner"
              />
              <button
                onClick={handleSaveValue}
                disabled={isSubmitting}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-md active:scale-95 transition whitespace-nowrap disabled:opacity-50"
              >
                Actualizar
              </button>
            </div>
          )}
        </div>

        {/* Pestañas: Invertir / Retirar */}
        <div className="mt-4 flex bg-zinc-900/90 p-1 rounded-2xl border border-white/[0.08] shadow-inner">
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

        {/* Mensaje de error general si ocurre */}
        {errorMsg && (
          <div className="mt-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 px-3.5 py-2.5 rounded-2xl text-xs text-left flex items-start gap-2 animate-fade-in">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* CONTENIDO PESTAÑA 1: INVERTIR / PASAR REMANENTE */}
        {activeTab === "INVEST" ? (
          <div className="mt-4 space-y-4 animate-fade-in">
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-medium text-zinc-200">Remanente de este mes:</span>
                <span className="text-xl font-bold text-emerald-400 font-mono tabular-nums">
                  ${Math.round(surplusAmount).toLocaleString("es-AR")}
                </span>
              </div>

              {surplusAmount > 0 ? (
                <div className="space-y-2 border-t border-white/[0.06] pt-3">
                  <div className="text-xs text-zinc-300 flex items-center gap-1.5 mb-2">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Distribución proporcional según aportes al Fondo Común:</span>
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
                  Aún no hay remanente libre este mes (o ya fue consumido por gastos).
                </p>
              )}
            </div>

            {/* Acción de Transferir Remanente */}
            <div>
              {isAlreadyTransferred ? (
                <div className="bg-emerald-950/25 border border-emerald-500/25 rounded-2xl p-4 flex items-center gap-3 text-emerald-300 text-xs">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>El excedente de este mes ya fue transferido al FCI.</span>
                </div>
              ) : (
                <button
                  onClick={handleTransfer}
                  disabled={surplusAmount <= 0 || isSubmitting}
                  className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 active:scale-[0.98] transition border border-emerald-400/20"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  <span>Pasar Remanente al FCI (${Math.round(surplusAmount).toLocaleString("es-AR")})</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          /* CONTENIDO PESTAÑA 2: RETIRAR DINERO */
          <div className="mt-4 space-y-4 animate-fade-in">
            <form onSubmit={handleCreateWithdrawal} className="space-y-4">
              
              {/* Campo Monto a Retirar */}
              <div>
                <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block mb-1.5 px-1">
                  Monto a Retirar ($)
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="ej. 50000"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="w-full bg-white/[0.05] border border-white/[0.12] rounded-2xl px-4 py-3 text-white text-base font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-500/60 transition shadow-inner placeholder:text-zinc-500"
                />

                {/* Accesos rápidos de porcentaje */}
                {currentFundValue > 0 && (
                  <div className="flex gap-2 mt-2">
                    {[
                      { label: "25%", val: Math.round(currentFundValue * 0.25) },
                      { label: "50%", val: Math.round(currentFundValue * 0.5) },
                      { label: "100%", val: Math.round(currentFundValue) },
                    ].map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => setWithdrawAmount(item.val.toString())}
                        className="flex-1 py-1 px-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-[11px] font-mono text-zinc-300 border border-white/[0.06] transition active:scale-95"
                      >
                        {item.label} (${item.val.toLocaleString("es-AR")})
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Selector de Destino del Dinero */}
              <div>
                <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block mb-1.5 px-1">
                  ¿A dónde va el dinero retirado?
                </label>
                <div className="space-y-2">
                  
                  {/* Opción 1: Sumar al Fondo Común del Mes Actual */}
                  <label
                    onClick={() => setWithdrawDestination("POOL_FUND")}
                    className={`p-3.5 rounded-2xl border cursor-pointer block transition ${
                      withdrawDestination === "POOL_FUND"
                        ? "bg-blue-600/15 border-blue-500/50 shadow-md shadow-blue-500/10"
                        : "bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 mb-1">
                      <input
                        type="radio"
                        name="destination"
                        checked={withdrawDestination === "POOL_FUND"}
                        onChange={() => setWithdrawDestination("POOL_FUND")}
                        className="text-blue-500 focus:ring-0"
                      />
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Wallet className="w-3.5 h-3.5 text-blue-400" />
                        Sumar al Fondo Común del Mes Actual
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 pl-6 leading-relaxed">
                      Se suma inmediatamente al presupuesto disponible de este mes para pagar los gastos compartidos.
                    </p>
                  </label>

                  {/* Opción 2: Gasto o Uso Específico */}
                  <label
                    onClick={() => setWithdrawDestination("CUSTOM_USE")}
                    className={`p-3.5 rounded-2xl border cursor-pointer block transition ${
                      withdrawDestination === "CUSTOM_USE"
                        ? "bg-purple-600/15 border-purple-500/50 shadow-md shadow-purple-500/10"
                        : "bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 mb-1">
                      <input
                        type="radio"
                        name="destination"
                        checked={withdrawDestination === "CUSTOM_USE"}
                        onChange={() => setWithdrawDestination("CUSTOM_USE")}
                        className="text-purple-500 focus:ring-0"
                      />
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-purple-400" />
                        Gasto o Uso Específico
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 pl-6 leading-relaxed">
                      No altera el fondo mensual regular. Queda asentado como un retiro extraordinario con su motivo.
                    </p>
                  </label>

                </div>
              </div>

              {/* Si seleccionó Uso Específico, pedir para qué se usó */}
              {withdrawDestination === "CUSTOM_USE" && (
                <div className="animate-fade-in">
                  <label className="text-[11px] font-bold text-purple-300 uppercase tracking-wider block mb-1.5 px-1">
                    ¿Para qué se usó el dinero? *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ej. Arreglo del auto, mueble living, viaje..."
                    value={withdrawPurpose}
                    onChange={(e) => setWithdrawPurpose(e.target.value)}
                    className="w-full bg-white/[0.05] border border-purple-500/30 rounded-2xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/60 transition shadow-inner placeholder:text-zinc-500"
                  />
                </div>
              )}

              {/* Botón Confirmar Retiro */}
              <button
                type="submit"
                disabled={isSubmitting || currentFundValue <= 0}
                className="w-full py-3.5 rounded-2xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs shadow-lg shadow-amber-600/30 flex items-center justify-center gap-2 active:scale-[0.98] transition border border-amber-400/20"
              >
                <ArrowDownLeft className="w-4 h-4" />
                <span>{isSubmitting ? "Registrando retiro..." : "Confirmar Retiro del FCI"}</span>
              </button>
            </form>

            {/* Historial de Retiros Registrados */}
            <div className="pt-2 border-t border-white/[0.08]">
              <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2.5 px-1">
                Historial de Retiros ({withdrawals.length})
              </h4>

              {withdrawals.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto no-scrollbar">
                  {withdrawals.map((w) => (
                    <div
                      key={w.id}
                      className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between text-xs transition"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-amber-300 font-mono tabular-nums">
                            -${Math.round(w.amount).toLocaleString("es-AR")}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              w.destination === "POOL_FUND"
                                ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                                : "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                            }`}
                          >
                            {w.destination === "POOL_FUND" ? "Al Fondo del Mes" : "Uso Específico"}
                          </span>
                        </div>
                        {w.purpose && (
                          <p className="text-[11px] text-zinc-300 italic">
                            &quot;{w.purpose}&quot;
                          </p>
                        )}
                        <span className="text-[10px] text-zinc-500 block">
                          {new Date(w.withdrawnAt).toLocaleDateString("es-AR", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>

                      <button
                        onClick={() => handleDeleteWithdrawal(w.id)}
                        disabled={isSubmitting}
                        title="Anular retiro y reintegrar dinero al FCI"
                        className="p-2 rounded-xl text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 active:scale-95 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-500 italic px-1">
                  Aún no se realizaron retiros en este fondo.
                </p>
              )}
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
