"use client";

import React, { useState } from "react";
import { Sparkles, ArrowRight, ChevronDown, ChevronUp, AlertCircle, Check, CreditCard, Clock } from "./ui/icons";
import { computeCardShoppingStrategy, CardShoppingAdvice } from "@/lib/card-recommendation";
import { BANK_THEMES } from "@/lib/cards-service";
import { triggerHaptic } from "@/lib/haptics";

interface CardShoppingAdvisorBannerProps {
  cards: any[];
  onSelectCard?: (cardId: string) => void;
  compact?: boolean;
  onNavigateToCards?: () => void;
}

export function CardShoppingAdvisorBanner({
  cards,
  onSelectCard,
  compact = false,
  onNavigateToCards,
}: CardShoppingAdvisorBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const strategy = computeCardShoppingStrategy(cards);
  const { bestCard, worstCard, ranking } = strategy;

  if (!bestCard) return null;

  const bestTheme = BANK_THEMES[bestCard.bank] || BANK_THEMES.Otro;

  // Versión compacta para la pestaña de "Gastos"
  if (compact) {
    return (
      <div
        onClick={() => {
          triggerHaptic(8);
          onNavigateToCards?.();
        }}
        className="cursor-pointer group relative overflow-hidden rounded-2xl p-3.5 bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-zinc-900/80 border border-purple-500/30 hover:border-purple-400/50 shadow-md transition-all active:scale-[0.99]"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300 shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] uppercase font-bold text-purple-300 tracking-wider">
                  Recomendación para hoy
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                  {bestCard.daysUntilPayment} días libres
                </span>
              </div>
              <p className="text-xs font-semibold text-white truncate mt-0.5">
                Usá <strong className="text-purple-200">{bestCard.bank} {bestCard.brand}</strong> • Paga recién el {bestCard.effectiveDueDateStr}
              </p>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-1 text-xs text-purple-300 font-bold group-hover:translate-x-0.5 transition-transform">
            <span>Ver</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
    );
  }

  // Versión completa para la pestaña "Tarjetas"
  return (
    <div className="super-card rounded-3xl p-4 sm:p-5 relative overflow-hidden border border-purple-500/30 shadow-xl bg-gradient-to-b from-[#131728] to-[#0d101d]">
      {/* Luz ambiental sutil */}
      <div className="absolute top-0 right-0 w-44 h-44 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Cabecera del Consejo */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-purple-300">
            Estrategia Inteligente • ¿Cuál usar hoy?
          </span>
        </div>

        <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold flex items-center gap-1">
          <Check className="w-3 h-3 stroke-[3]" />
          <span>Máximo Plazo</span>
        </span>
      </div>

      {/* Tarjeta Ganadora */}
      <div
        onClick={() => {
          triggerHaptic(8);
          onSelectCard?.(bestCard.cardId);
        }}
        className="cursor-pointer group p-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.08] transition-all relative overflow-hidden"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-extrabold text-white group-hover:text-purple-200 transition-colors flex items-center gap-1.5">
                <span>{bestCard.bank} {bestCard.brand}</span>
                {bestCard.lastDigits && (
                  <span className="text-xs font-mono text-zinc-400">•••• {bestCard.lastDigits}</span>
                )}
              </span>

              {bestCard.status === "CLOSED_RECENTLY" && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-200 border border-purple-500/30 font-bold">
                  ¡Cerró hace poco!
                </span>
              )}
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed font-normal">
              {bestCard.recommendationReason}
            </p>
          </div>

          {/* Días de plazo destacado */}
          <div className="shrink-0 text-right pl-2">
            <span className="text-2xl font-black text-emerald-400 font-mono tabular-nums leading-none block">
              {bestCard.daysUntilPayment}
            </span>
            <span className="text-[10px] font-bold text-zinc-400 block mt-0.5 uppercase tracking-tight">
              días de plazo
            </span>
          </div>
        </div>

        {/* Resumen de ciclo */}
        <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-zinc-400">
          <span className="flex items-center gap-1 text-zinc-300">
            <Clock className="w-3 h-3 text-purple-400" />
            <span>Vencimiento: <strong className="text-white font-semibold">{bestCard.effectiveDueDateStr}</strong></span>
          </span>
          <span className="text-purple-400 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
            <span>Ver tarjeta</span>
            <ArrowRight className="w-3 h-3" />
          </span>
        </div>
      </div>

      {/* Alerta de la tarjeta que NO conviene usar hoy si cierra pronto */}
      {worstCard && worstCard.cardId !== bestCard.cardId && worstCard.status === "CLOSING_SOON" && (
        <div className="mt-2.5 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-2 text-xs text-amber-200/90">
          <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <div className="leading-snug">
            <span>
              <strong>Atención:</strong> Evitá usar tu <span className="font-bold text-white">{worstCard.bank} {worstCard.brand}</span> hoy.
              {worstCard.daysUntilClose === 0
                ? " Cierra hoy mismo"
                : ` Cierra en solo ${worstCard.daysUntilClose} día${worstCard.daysUntilClose === 1 ? "" : "s"}`}
              , por lo que pagarías en {worstCard.daysUntilPayment} días.
            </span>
          </div>
        </div>
      )}

      {/* Ranking desplegable de todas las tarjetas */}
      {ranking.length > 1 && (
        <div className="mt-3 pt-2.5 border-t border-white/[0.06]">
          <button
            type="button"
            onClick={() => {
              triggerHaptic(8);
              setIsExpanded(!isExpanded);
            }}
            className="w-full flex items-center justify-between text-xs font-semibold text-zinc-400 hover:text-white transition py-1"
          >
            <span>Comparar plazo de todas mis tarjetas ({ranking.length})</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {isExpanded && (
            <div className="mt-2 space-y-1.5 pt-1 animate-fade-in">
              {ranking.map((item, idx) => {
                const isSelected = item.cardId === bestCard.cardId;
                return (
                  <div
                    key={item.cardId}
                    onClick={() => onSelectCard?.(item.cardId)}
                    className={`p-2 rounded-xl flex items-center justify-between text-xs cursor-pointer transition ${
                      isSelected
                        ? "bg-purple-600/20 border border-purple-500/30 text-white font-semibold"
                        : "bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.04] text-zinc-300"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        isSelected ? "bg-purple-500 text-white" : "bg-white/[0.06] text-zinc-400"
                      }`}>
                        {idx + 1}
                      </span>
                      <span className="truncate">
                        {item.bank} {item.brand}
                      </span>
                      {isSelected && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold shrink-0">
                          Mejor opción
                        </span>
                      )}
                    </div>

                    <div className="text-right shrink-0 font-mono tabular-nums">
                      <span className={`font-bold ${isSelected ? "text-emerald-400" : "text-zinc-200"}`}>
                        {item.daysUntilPayment} días
                      </span>
                      <span className="text-[10px] text-zinc-500 block">
                        Vence {item.effectiveDueDateStr}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
