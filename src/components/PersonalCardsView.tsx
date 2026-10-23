"use client";

import React, { useState, useEffect } from "react";
import { CreditCard, Check, Sparkles, Calendar, Plus, ArrowRight, X, Repeat } from "./ui/icons";
import { Upload } from "lucide-react";
import { CreditCardVisual } from "./CreditCardVisual";
import { CardStatementModal } from "./CardStatementModal";
import { ImportStatementModal } from "./ImportStatementModal";
import { CardShoppingAdvisorBanner } from "./CardShoppingAdvisorBanner";
import { computeCardShoppingStrategy } from "@/lib/card-recommendation";
import { toggleCardPaidAction, advanceCardToNextSummaryAction } from "@/app/actions";
import { triggerHaptic } from "@/lib/haptics";

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
  categories?: Array<{ id: string; name: string }>;
  users?: Array<{ id: string; name: string }>;
  onOpenNewRecurring?: () => void;
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
  userId,
  userName,
  year,
  month,
  categories,
  users,
  onOpenNewRecurring,
  cardsData,
}: PersonalCardsViewProps) {
  const [localCards, setLocalCards] = useState(cardsData?.cards || []);
  const [selectedCardForEdit, setSelectedCardForEdit] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [cardForNextSummary, setCardForNextSummary] = useState<any | null>(null);
  const [processingCardId, setProcessingCardId] = useState<string | null>(null);
  const [highlightedCardId, setHighlightedCardId] = useState<string | null>(null);
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

    // 1. Impacto visual inmediato (0ms)
    triggerHaptic(15);
    setHighlightedCardId(cardItem.id);
    setTimeout(() => setHighlightedCardId(null), 1200);

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
        ? `✓ ${cardItem.bank} ${cardItem.brand} pagada (impactado en ${currentCalendarMonthName})`
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
      showToast("Error al actualizar estado de pago");
    } finally {
      setProcessingCardId(null);
    }
  };

  // Confirmar y ejecutar el paso al siguiente resumen
  const confirmAdvanceNextSummary = async () => {
    if (!cardForNextSummary) return;
    triggerHaptic("success");
    const cardItem = cardForNextSummary;
    setCardForNextSummary(null);
    setProcessingCardId(cardItem.id);
    setHighlightedCardId(cardItem.id);
    setTimeout(() => setHighlightedCardId(null), 1200);

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
      showToast(err instanceof Error ? err.message : "Error al abrir el siguiente resumen");
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
    setHighlightedCardId(cardId);
    setTimeout(() => setHighlightedCardId(null), 1200);

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

      {/* Banner superior de Importación Rápida de Resúmenes */}
      <div className="flex items-center justify-between p-3.5 bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-purple-900/40 border border-blue-500/30 rounded-2xl shadow-lg">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
            <Upload className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-bold text-white block truncate">Importar Resumen de Tarjeta</span>
            <span className="text-[11px] text-zinc-400 truncate block">PDF Santander, BBVA, Galicia o texto MP</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            triggerHaptic("medium");
            setIsImportModalOpen(true);
          }}
          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/30 flex items-center gap-1.5 transition active:scale-95 shrink-0 cursor-pointer ml-2"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Importar</span>
        </button>
      </div>

      {/* Tarjeta Resumen de Resúmenes Activos (Independientes del mes calendario) */}
      <section className="super-card rounded-3xl p-5 relative overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
            <CreditCard className="w-4 h-4 text-purple-400" />
            Resúmenes Activos de Tarjetas
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                setIsImportModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-blue-600/30 to-indigo-600/30 hover:from-blue-600/50 hover:to-indigo-600/50 text-blue-300 border border-blue-500/30 text-[11px] font-semibold shadow-sm transition-all cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Importar Resumen</span>
            </button>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.08] text-zinc-300 font-bold border border-white/[0.1]">
              {paidCount}/{localCards.length} Pagadas
            </span>
          </div>
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

        {/* Aviso informativo + Acceso directo para asociar nueva compra en cuotas */}
        <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex items-center justify-between gap-2">
          <div className="flex items-start gap-2 text-[11px] text-zinc-400 leading-snug">
            <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
            <span>
              Al tocar <strong className="text-emerald-300">Pagar</strong> impacta en tu cuenta del mes de pago.
            </span>
          </div>
          {onOpenNewRecurring && (
            <button
              type="button"
              onClick={onOpenNewRecurring}
              className="shrink-0 px-3 py-1.5 rounded-xl bg-purple-600/25 hover:bg-purple-600/40 text-purple-200 border border-purple-500/30 text-[11px] font-bold flex items-center gap-1 active:scale-95 transition"
            >
              <Plus className="w-3 h-3" />
              <span>Asociar Cuota</span>
            </button>
          )}
        </div>
      </section>

      {/* Consejo Inteligente de Compras Hoy (Cuál tarjeta usar para maximizar días de pago) */}
      {localCards.length > 0 && (
        <CardShoppingAdvisorBanner
          cards={localCards}
          onSelectCard={(cardId) => {
            setHighlightedCardId(cardId);
            setTimeout(() => setHighlightedCardId(null), 1800);
            const el = document.getElementById(`card-${cardId}`);
            if (el) {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
            }
          }}
        />
      )}

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
          (() => {
            const cardStrategy = computeCardShoppingStrategy(localCards);
            return (
              <div className="space-y-4">
                {localCards.map((card) => {
                  const isBest = cardStrategy.bestCard?.cardId === card.id;
                  const isClosingSoon =
                    cardStrategy.worstCard?.cardId === card.id &&
                    cardStrategy.worstCard?.status === "CLOSING_SOON";
                  const advice = cardStrategy.ranking.find((r) => r.cardId === card.id);

                  return (
                    <div key={card.id} id={`card-${card.id}`}>
                      <CreditCardVisual
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
                        onNextSummary={() => setCardForNextSummary(card)}
                        isProcessing={processingCardId === card.id}
                        isHighlighted={highlightedCardId === card.id}
                        isBestForShopping={isBest}
                        shoppingDays={advice?.daysUntilPayment}
                        isClosingSoon={isClosingSoon}
                        daysUntilClose={advice?.daysUntilClose}
                      />
                    </div>
                  );
                })}
              </div>
            );
          })()
        )}
      </section>

      {/* Modal nativo oscuro para confirmar el paso al Siguiente Resumen */}
      {cardForNextSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-sm super-card rounded-3xl p-6 shadow-2xl border border-white/[0.12] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300">
                  <ArrowRight className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Abrir Siguiente Resumen
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {cardForNextSummary.bank} {cardForNextSummary.brand}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCardForNextSummary(null)}
                className="p-1.5 rounded-full text-zinc-400 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-zinc-300 leading-relaxed">
              <p>
                Se cerrará el ciclo actual y se abrirá un <strong className="text-white">nuevo resumen</strong> avanzando las fechas de cierre y vencimiento en <strong className="text-purple-300">+1 mes</strong>.
              </p>

              {cardForNextSummary.linkedInstallments &&
              cardForNextSummary.linkedInstallments.length > 0 ? (
                <div className="p-3 rounded-2xl bg-purple-500/15 border border-purple-500/30 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-purple-200 font-bold text-[11px]">
                    <Repeat className="w-3.5 h-3.5" />
                    <span>
                      Se incluirán automáticamente {cardForNextSummary.linkedInstallments.length} cuota(s)/fijo(s) vigentes:
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-200">
                    El nuevo resumen iniciará con las cuotas activas del próximo ciclo ya sumadas.
                  </p>
                </div>
              ) : (
                <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-[11px] text-zinc-300">
                  El nuevo resumen iniciará limpio en <strong className="text-white font-mono">$0</strong> listo para el próximo período.
                </div>
              )}
            </div>

            <div className="pt-1 space-y-2">
              <button
                type="button"
                onClick={confirmAdvanceNextSummary}
                className="w-full py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-600/30 flex items-center justify-center gap-1.5 active:scale-[0.98] transition"
              >
                <span>Confirmar e Ir al Siguiente Resumen</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setCardForNextSummary(null)}
                className="w-full py-2.5 rounded-2xl bg-white/[0.05] hover:bg-white/[0.08] text-zinc-300 font-medium text-xs transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Modal para importar resumen bancario (0 tokens IA) */}
      <ImportStatementModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        users={users && users.length > 0 ? users : [{ id: userId, name: userName }]}
        cards={localCards}
        categories={
          categories && categories.length > 0
            ? categories
            : [
                { id: "1", name: "Supermercado" },
                { id: "2", name: "Salidas & Delivery" },
                { id: "3", name: "Transporte & Combustible" },
                { id: "4", name: "Farmacia & Salud" },
                { id: "5", name: "Hogar & Arreglos" },
                { id: "6", name: "Servicios (Luz, Gas, Wifi)" },
                { id: "7", name: "Tarjetas" },
                { id: "8", name: "Varios" },
              ]
        }
        currentYear={year}
        currentMonth={month}
        onSuccess={() => {
          showToast("✓ Consumos importados con éxito");
        }}
      />
    </div>
  );
}
