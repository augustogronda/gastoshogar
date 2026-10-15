"use client";

import React, { useState } from "react";
import { CreditCard, Check, Clock, Plus, Sparkles, AlertCircle } from "./ui/icons";
import { CreditCardVisual } from "./CreditCardVisual";
import { CardStatementModal } from "./CardStatementModal";
import { toggleCardPaidAction } from "@/app/actions";

interface PersonalCardsViewProps {
  userId: string;
  userName: string;
  year: number;
  month: number;
  monthName: string;
  cardsData?: {
    cards: Array<{
      id: string;
      userId: string;
      bank: string;
      brand: string;
      lastDigits?: string | null;
      colorTheme?: string | null;
      defaultClosingDay?: number | null;
      defaultDueDay?: number | null;
      period: {
        id: string;
        year: number;
        month: number;
        closingDate?: Date | string | null;
        dueDate?: Date | string | null;
        statementAmount: number;
        statementAmountUsd?: number;
        isPaid: boolean;
        paidAt?: Date | string | null;
        notes?: string | null;
      };
    }>;
    summary: {
      totalStatementArs: number;
      totalPaidArs: number;
      totalPendingArs: number;
      paidCount: number;
      pendingCount: number;
      totalCards: number;
    };
  } | null;
}

export function PersonalCardsView({
  userId,
  userName,
  year,
  month,
  monthName,
  cardsData,
}: PersonalCardsViewProps) {
  const [selectedCardForEdit, setSelectedCardForEdit] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [processingCardId, setProcessingCardId] = useState<string | null>(null);

  const cards = cardsData?.cards || [];
  const summary = cardsData?.summary || {
    totalStatementArs: 0,
    totalPaidArs: 0,
    totalPendingArs: 0,
    paidCount: 0,
    pendingCount: 0,
    totalCards: 0,
  };

  const handleTogglePaid = async (cardItem: any) => {
    setProcessingCardId(cardItem.id);
    try {
      await toggleCardPaidAction({
        cardMonthlyPeriodId: cardItem.period.id,
        isPaid: !cardItem.period.isPaid,
      });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error al actualizar estado de pago");
    } finally {
      setProcessingCardId(null);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Tarjeta Resumen de Deuda y Estado del Mes */}
      <section className="super-card rounded-3xl p-5 relative overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
            <CreditCard className="w-4 h-4 text-purple-400" />
            Resumen de Tarjetas • {monthName} {year}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.08] text-zinc-300 font-bold border border-white/[0.1]">
            {summary.paidCount}/{summary.totalCards} Pagadas
          </span>
        </div>

        <div className="flex items-baseline justify-between mb-3">
          <div>
            <span className="text-[11px] font-medium text-zinc-400 block mb-0.5">
              Total a Pagar en Tarjetas:
            </span>
            <span className="text-3xl font-black text-white tracking-tight font-mono tabular-nums">
              ${Math.round(summary.totalStatementArs).toLocaleString("es-AR")}
            </span>
          </div>
          <div className="text-right">
            <span className="text-[11px] font-medium text-zinc-400 block mb-0.5">
              Pendiente:
            </span>
            <span className="text-base font-bold text-amber-300 font-mono tabular-nums">
              ${Math.round(summary.totalPendingArs).toLocaleString("es-AR")}
            </span>
          </div>
        </div>

        {/* Desglose Pagado vs Pendiente */}
        <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/[0.06] text-xs">
          <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
            <span className="text-[10px] uppercase font-bold text-emerald-300 block">
              Ya Pagado
            </span>
            <span className="text-base font-bold text-white font-mono tabular-nums mt-0.5 block">
              ${Math.round(summary.totalPaidArs).toLocaleString("es-AR")}
            </span>
          </div>

          <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20">
            <span className="text-[10px] uppercase font-bold text-amber-300 block">
              Por Pagar
            </span>
            <span className="text-base font-bold text-white font-mono tabular-nums mt-0.5 block">
              ${Math.round(summary.totalPendingArs).toLocaleString("es-AR")}
            </span>
          </div>
        </div>

        {/* Aviso informativo de gasto automático */}
        <div className="mt-3.5 pt-2.5 border-t border-white/[0.06] flex items-start gap-2 text-[11px] text-zinc-400 leading-relaxed">
          <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
          <span>
            Al marcar una tarjeta como <strong className="text-emerald-300">Pagada</strong>, se registrará automáticamente como gasto en tu presupuesto de este mes.
          </span>
        </div>
      </section>

      {/* Lista de Tarjetas */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
            Tus Tarjetas ({cards.length})
          </h2>
          <span className="text-[10px] text-zinc-500">
            Tocá Editar para cargar el resumen
          </span>
        </div>

        {cards.length === 0 ? (
          <div className="super-card rounded-2xl p-8 text-center">
            <CreditCard className="w-8 h-8 text-zinc-600 mx-auto mb-2 opacity-60" />
            <p className="text-sm font-medium text-zinc-300">Sin tarjetas configuradas</p>
          </div>
        ) : (
          <div className="space-y-4">
            {cards.map((card) => (
              <CreditCardVisual
                key={card.id}
                bank={card.bank}
                brand={card.brand}
                lastDigits={card.lastDigits}
                cardholderName={userName}
                statementAmount={card.period.statementAmount}
                statementAmountUsd={card.period.statementAmountUsd}
                closingDate={card.period.closingDate}
                dueDate={card.period.dueDate}
                isPaid={card.period.isPaid}
                onEdit={() => {
                  setSelectedCardForEdit(card);
                  setIsModalOpen(true);
                }}
                onTogglePaid={() => handleTogglePaid(card)}
                isProcessing={processingCardId === card.id}
              />
            ))}
          </div>
        )}
      </section>

      {/* Modal para editar resumen de tarjeta */}
      <CardStatementModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedCardForEdit(null);
        }}
        cardData={selectedCardForEdit}
      />
    </div>
  );
}
