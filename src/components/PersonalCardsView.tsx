"use client";

import React, { useState, useEffect } from "react";
import { CreditCard, Check, Sparkles, Calendar } from "./ui/icons";
import { CreditCardVisual } from "./CreditCardVisual";
import { CardStatementModal } from "./CardStatementModal";
import { toggleCardPaidAction, advanceCardToNextSummaryAction } from "@/app/actions";

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

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
      linkedInstallments?: Array<{
        id: string;
        title: string;
        installmentAmount?: number;
        amount?: number;
        installmentNumber: number;
        totalInstallments?: number | null;
      }>;
      linkedInstallmentsTotal?: number;
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
  userName,
  cardsData,
}: PersonalCardsViewProps) {
  const [localCards, setLocalCards] = useState(cardsData?.cards || []);
  const [selectedCardForEdit, setSelectedCardForEdit] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [processingCardId, setProcessingCardId] = useState<string | null>(null);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  // Sincronizar estado local cuando llegan datos nuevos del servidor
  useEffect(() => {
    if (cardsData?.cards) {
      setLocalCards(cardsData.cards);
    }
  }, [cardsData]);

  const showToast = (msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => {
      setFeedbackToast((prev) => (prev === msg ? null : prev));
    }, 3000);
  };

  const now = new Date();
  const currentCalendarMonth = now.getMonth() + 1;
  const currentCalendarMonthName = MONTH_NAMES[currentCalendarMonth - 1];
  const nextCalendarMonth = currentCalendarMonth === 12 ? 1 : currentCalendarMonth + 1;
  const nextCalendarMonthName = MONTH_NAMES[nextCalendarMonth - 1];

  let totalStatementArs = 0;
  let totalPaidArs = 0;
  let totalPendingArs = 0;
  let dueThisMonthArs = 0;
  let dueNextMonthArs = 0;
  let paidCount = 0;

  for (const c of localCards) {
    const amt = c.period.statementAmount || 0;
    totalStatementArs += amt;

    if (c.period.isPaid) {
      totalPaidArs += amt;
      paidCount++;
    } else {
      totalPendingArs += amt;
    }

    // Separar según el mes en que vence cada resumen activo
    if (c.period.dueDate) {
      const dueDateObj = new Date(c.period.dueDate);
      const dueM = !isNaN(dueDateObj.getTime())
        ? dueDateObj.getUTCMonth() + 1
        : currentCalendarMonth;
      if (dueM !== currentCalendarMonth) {
        dueNextMonthArs += amt;
      } else {
        dueThisMonthArs += amt;
      }
    } else {
      dueThisMonthArs += amt;
    }
  }

  // Actualización optimista al marcar Pagada / Pendiente (0ms de demora visual)
  const handleTogglePaid = async (cardItem: any) => {
    const nextIsPaid = !cardItem.period.isPaid;
    const previousCards = [...localCards];

    // 1. Impacto visual inmediato
    setLocalCards((prev) =>
      prev.map((c) =>
        c.id === cardItem.id
          ? {
              ...c,
              period: {
                ...c.period,
                isPaid: nextIsPaid,
                paidAt: nextIsPaid ? new Date().toISOString() : null,
              },
            }
          : c
      )
    );

    showToast(
      nextIsPaid
        ? `✓ ${cardItem.bank} ${cardItem.brand} pagada (impactado en cuenta de ${currentCalendarMonthName})`
        : `✓ ${cardItem.bank} ${cardItem.brand} desmarcada como pagada`
    );

    // 2. Sincronización en servidor en segundo plano
    setProcessingCardId(cardItem.id);
    try {
      await toggleCardPaidAction({
        cardMonthlyPeriodId: cardItem.period.id,
        isPaid: nextIsPaid,
      });
    } catch (err: unknown) {
      // Revertir en caso de error
      setLocalCards(previousCards);
      alert(err instanceof Error ? err.message : "Error al actualizar estado de pago");
    } finally {
      setProcessingCardId(null);
    }
  };

  // Cerrar el resumen actual y abrir el siguiente resumen desde $0 (o con cuotas asociadas)
  const handleAdvanceNextSummary = async (cardItem: any) => {
    const linkedCount = cardItem.linkedInstallments?.length || 0;
    const confirmMsg =
      linkedCount > 0
        ? `¿Cerrar el resumen actual de ${cardItem.bank} ${cardItem.brand} y abrir el siguiente resumen?\n\nSe avanzarán las fechas de cierre/vencimiento 1 mes y se incluirán automáticamente las ${linkedCount} cuota(s)/fijo(s) asociados.`
        : `¿Cerrar el resumen actual de ${cardItem.bank} ${cardItem.brand} y abrir el siguiente resumen en $0?\n\nSe avanzarán las fechas de cierre y vencimiento al próximo ciclo.`;

    if (!confirm(confirmMsg)) return;

    setProcessingCardId(cardItem.id);
    try {
      const res = await advanceCardToNextSummaryAction({
        cardId: cardItem.id,
        currentPeriodId: cardItem.period.id,
      });

      if (res.success && res.newPeriod) {
        setLocalCards((prev) =>
          prev.map((c) =>
            c.id === cardItem.id
              ? {
                  ...c,
                  linkedInstallments: res.linkedInstallments,
                  linkedInstallmentsTotal: res.linkedInstallmentsTotal,
                  period: {
                    ...res.newPeriod,
                  },
                }
              : c
          )
        );

        const nextAmt = Math.round(res.newPeriod.statementAmount || 0).toLocaleString("es-AR");
        showToast(
          res.linkedInstallments.length > 0
            ? `✓ Nuevo resumen abierto con ${res.linkedInstallments.length} cuota(s) ($${nextAmt})`
            : `✓ Nuevo resumen de ${cardItem.bank} ${cardItem.brand} abierto en $0`
        );
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error al abrir el siguiente resumen");
    } finally {
      setProcessingCardId(null);
    }
  };

  // Actualización optimista al guardar edición del resumen (0ms de demora visual)
  const handleOptimisticSave = (
    cardId: string,
    updatedFields: {
      statementAmount: number;
      statementAmountUsd: number;
      closingDate: string | null;
      dueDate: string | null;
      notes: string | null;
    }
  ) => {
    setLocalCards((prev) =>
      prev.map((c) =>
        c.id === cardId
          ? {
              ...c,
              period: {
                ...c.period,
                statementAmount: updatedFields.statementAmount,
                statementAmountUsd: updatedFields.statementAmountUsd,
                closingDate: updatedFields.closingDate ?? c.period.closingDate,
                dueDate: updatedFields.dueDate ?? c.period.dueDate,
                notes: updatedFields.notes,
              },
            }
          : c
      )
    );
    showToast("✓ Resumen y fechas actualizados al instante");
  };

  return (
    <div className="space-y-4 animate-fade-in relative">
      {/* Toast flotante de confirmación instantánea */}
      {feedbackToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-emerald-600/95 text-white text-xs font-bold shadow-xl shadow-emerald-950/50 border border-emerald-400/40 backdrop-blur-md flex items-center gap-2 animate-fade-in whitespace-nowrap">
          <Check className="w-3.5 h-3.5 stroke-[3]" />
          <span>{feedbackToast}</span>
        </div>
      )}

      {/* Tarjeta Resumen de Resúmenes Activos (Independientes del mes calendario) */}
      <section className="super-card rounded-3xl p-5 relative overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
            <CreditCard className="w-4 h-4 text-purple-400" />
            Resúmenes Activos de Tarjetas
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.08] text-zinc-300 font-bold border border-white/[0.1]">
            {paidCount}/{localCards.length} Pagadas
          </span>
        </div>

        <div className="flex items-baseline justify-between mb-3">
          <div>
            <span className="text-[11px] font-medium text-zinc-400 block mb-0.5">
              Total Resúmenes en Curso:
            </span>
            <span className="text-3xl font-black text-white tracking-tight font-mono tabular-nums">
              ${Math.round(totalStatementArs).toLocaleString("es-AR")}
            </span>
          </div>
          <div className="text-right">
            <span className="text-[11px] font-medium text-zinc-400 block mb-0.5">
              Pendiente de Pago:
            </span>
            <span className="text-base font-bold text-amber-300 font-mono tabular-nums">
              ${Math.round(totalPendingArs).toLocaleString("es-AR")}
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
              ${Math.round(totalPaidArs).toLocaleString("es-AR")}
            </span>
          </div>

          <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20">
            <span className="text-[10px] uppercase font-bold text-amber-300 block">
              Por Pagar
            </span>
            <span className="text-base font-bold text-white font-mono tabular-nums mt-0.5 block">
              ${Math.round(totalPendingArs).toLocaleString("es-AR")}
            </span>
          </div>
        </div>

        {/* Separación Clara por mes de vencimiento */}
        <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-2">
          <div className="flex items-center justify-between text-xs px-1">
            <span className="text-zinc-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              Vencen en {currentCalendarMonthName}:
            </span>
            <span className="font-mono font-bold text-zinc-200 tabular-nums">
              ${Math.round(dueThisMonthArs).toLocaleString("es-AR")}
            </span>
          </div>

          {dueNextMonthArs > 0 && (
            <div className="flex items-center justify-between text-xs bg-purple-500/15 border border-purple-500/30 px-3 py-2 rounded-2xl">
              <span className="text-purple-200 flex items-center gap-1.5 font-medium">
                <Calendar className="w-3.5 h-3.5 text-purple-300" />
                <span>Vencen en {nextCalendarMonthName} / otro mes:</span>
              </span>
              <span className="font-mono font-extrabold text-purple-100 tabular-nums">
                ${Math.round(dueNextMonthArs).toLocaleString("es-AR")}
              </span>
            </div>
          )}
        </div>

        {/* Aviso informativo de independencia y pago */}
        <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex items-start gap-2 text-[11px] text-zinc-400 leading-relaxed">
          <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
          <span>
            Cada tarjeta mantiene su <strong className="text-zinc-200">resumen actual independiente</strong>. Al tocar <strong className="text-emerald-300">Pagar</strong> se descuenta en el mes de la fecha de pago, y con <strong className="text-purple-300">Siguiente Resumen</strong> cerrás el ciclo actual y abrís uno nuevo con sus cuotas asociadas.
          </span>
        </div>
      </section>

      {/* Lista de Tarjetas */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
            Tus Tarjetas ({localCards.length}) • Visa Principal Primero
          </h2>
          <span className="text-[10px] text-zinc-500">
            Ciclo propio por tarjeta
          </span>
        </div>

        {localCards.length === 0 ? (
          <div className="super-card rounded-2xl p-8 text-center">
            <CreditCard className="w-8 h-8 text-zinc-600 mx-auto mb-2 opacity-60" />
            <p className="text-sm font-medium text-zinc-300">Sin tarjetas configuradas</p>
          </div>
        ) : (
          <div className="space-y-4">
            {localCards.map((card) => (
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
                periodMonth={card.period.month}
                periodYear={card.period.year}
                isPaid={card.period.isPaid}
                linkedInstallments={card.linkedInstallments}
                linkedInstallmentsTotal={card.linkedInstallmentsTotal}
                onEdit={() => {
                  setSelectedCardForEdit(card);
                  setIsModalOpen(true);
                }}
                onTogglePaid={() => handleTogglePaid(card)}
                onNextSummary={() => handleAdvanceNextSummary(card)}
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
        onOptimisticSave={handleOptimisticSave}
      />
    </div>
  );
}
