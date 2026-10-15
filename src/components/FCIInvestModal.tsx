"use client";

import React, { useState } from "react";
import { X, TrendingUp, PiggyBank, Check, ArrowUpRight, Sparkles } from "./ui/icons";
import { transferSurplusToFCIAction, updateFCIValueAction } from "@/app/actions";

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
}: FCIInvestModalProps) {
  const [isUpdatingValue, setIsUpdatingValue] = useState<boolean>(false);
  const [newValueInput, setNewValueInput] = useState<string>(
    currentFundValue ? currentFundValue.toString() : ""
  );
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const quotaA = Math.round(surplusAmount * (userABalance.quotaPct / 100));
  const quotaB = Math.round(surplusAmount * (userBBalance.quotaPct / 100));

  const handleTransfer = async () => {
    if (!fundId || surplusAmount <= 0) return;
    setIsSubmitting(true);
    try {
      await transferSurplusToFCIAction(periodId, fundId);
      alert("¡Remanente transferido con éxito al FCI de la pareja! 🚀");
      onClose();
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Error al transferir al FCI";
      alert(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveValue = async () => {
    if (!fundId) return;
    const val = parseFloat(newValueInput) || 0;
    setIsSubmitting(true);
    try {
      await updateFCIValueAction(fundId, val);
      setIsUpdatingValue(false);
    } catch (err) {
      console.error(err);
      alert("Error al actualizar saldo");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto no-scrollbar">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <PiggyBank className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">Fondo Común de Inversión (FCI)</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-zinc-400 hover:text-white bg-zinc-800/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Saldo acumulado actual en el FCI */}
        <div className="mt-4 bg-gradient-to-br from-emerald-950/40 to-zinc-900 border border-emerald-800/40 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-emerald-400 tracking-wider">
              PATRIMONIO INVERTIDO CONJUNTO
            </span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-extrabold text-white">
              ${Math.round(currentFundValue).toLocaleString("es-AR")}
            </span>
            <button
              onClick={() => setIsUpdatingValue(!isUpdatingValue)}
              className="text-xs text-zinc-400 hover:text-emerald-400 underline"
            >
              {isUpdatingValue ? "Cancelar" : "Editar Saldo"}
            </button>
          </div>

          {isUpdatingValue && (
            <div className="mt-3 flex gap-2">
              <input
                type="number"
                placeholder="Valor actual en broker"
                value={newValueInput}
                onChange={(e) => setNewValueInput(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-white text-sm"
              />
              <button
                onClick={handleSaveValue}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-xl text-xs font-semibold"
              >
                Actualizar
              </button>
            </div>
          )}
        </div>

        {/* Remanente del Mes Actual */}
        <div className="mt-5 space-y-3">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            Sobrante del Mes para Invertir
          </h3>

          <div className="bg-zinc-800/50 border border-zinc-700/40 rounded-2xl p-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm text-zinc-300">Remanente de este mes:</span>
              <span className="text-xl font-bold text-emerald-400">
                ${Math.round(surplusAmount).toLocaleString("es-AR")}
              </span>
            </div>

            {surplusAmount > 0 ? (
              <div className="space-y-2 border-t border-zinc-700/40 pt-3">
                <div className="text-xs text-zinc-400 flex items-center gap-1.5 mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
                  <span>Distribución proporcional según aportes del 60%:</span>
                </div>
                <div className="flex justify-between text-xs text-zinc-300">
                  <span>{userABalance.name} ({Math.round(userABalance.quotaPct)}%):</span>
                  <span className="font-semibold text-white">
                    ${quotaA.toLocaleString("es-AR")}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-zinc-300">
                  <span>{userBBalance.name} ({Math.round(userBBalance.quotaPct)}%):</span>
                  <span className="font-semibold text-white">
                    ${quotaB.toLocaleString("es-AR")}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-500 italic">
                Aún no hay remanente positivo este mes (o no se configuraron los sueldos).
              </p>
            )}
          </div>
        </div>

        {/* Acción de Transferir Remanente */}
        <div className="mt-6">
          {isAlreadyTransferred ? (
            <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-2xl p-4 flex items-center gap-3 text-emerald-300 text-sm">
              <Check className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>El excedente de este mes ya fue transferido al FCI.</span>
            </div>
          ) : (
            <button
              onClick={handleTransfer}
              disabled={surplusAmount <= 0 || isSubmitting}
              className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-base shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 active:scale-98 transition"
            >
              <ArrowUpRight className="w-5 h-5" />
              <span>Pasar Remanente al FCI (${Math.round(surplusAmount).toLocaleString("es-AR")})</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
