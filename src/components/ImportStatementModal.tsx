"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Check, CreditCard, Calendar, AlertCircle } from "./ui/icons";
import { Upload, FileText, CheckSquare, Square, ArrowRight, RefreshCw } from "lucide-react";
import { parsePdfStatementAction, parseTextStatementAction, importStatementExpensesAction } from "@/app/actions";
import { ParsedStatementResult, ParsedExpenseItem } from "@/lib/statement-parser";
import { triggerHaptic } from "@/lib/haptics";

interface ImportStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: Array<{ id: string; name: string }>;
  cards: Array<{ id: string; bank: string; brand: string; lastDigits?: string | null; userId: string }>;
  categories: Array<{ id: string; name: string }>;
  currentYear: number;
  currentMonth: number;
  preselectedCardId?: string;
  onSuccess?: () => void;
}

export function ImportStatementModal({
  isOpen,
  onClose,
  users,
  cards,
  categories,
  currentYear,
  currentMonth,
  preselectedCardId,
  onSuccess,
}: ImportStatementModalProps) {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<"file" | "text">("file");
  const [step, setStep] = useState<"upload" | "preview">("upload");
  const [rawText, setRawText] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Datos parseados
  const [parsedData, setParsedData] = useState<ParsedStatementResult | null>(null);
  const [items, setItems] = useState<ParsedExpenseItem[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedCardId, setSelectedCardId] = useState<string>("");
  const [updateCardSummary, setUpdateCardSummary] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevIsOpenRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Bloquear scroll de la página cuando el modal está abierto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  // Inicializar usuario y tarjeta ÚNICAMENTE cuando el modal pasa de cerrado a abierto
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      setStep("upload");
      setErrorMsg(null);
      setParsedData(null);
      setItems([]);
      setRawText("");

      if (preselectedCardId) {
        setSelectedCardId(preselectedCardId);
        const card = cards.find((c) => c.id === preselectedCardId);
        if (card) setSelectedUserId(card.userId);
      } else if (users.length > 0) {
        setSelectedUserId(users[0].id);
      }
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, preselectedCardId, cards, users]);

  if (!isOpen || !mounted) return null;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setErrorMsg("Por favor seleccioná un archivo PDF.");
      return;
    }

    setIsParsing(true);
    setErrorMsg(null);
    triggerHaptic("selection");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await parsePdfStatementAction(formData);
      if (!res.success || !res.data) {
        throw new Error(res.error || "No se pudo interpretar el archivo.");
      }

      applyParsedData(res.data);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Error al procesar el PDF.");
      triggerHaptic("error");
    } finally {
      setIsParsing(false);
    }
  };

  const handleParseText = async () => {
    if (!rawText.trim()) {
      setErrorMsg("Pegá el texto de los movimientos antes de continuar.");
      return;
    }

    setIsParsing(true);
    setErrorMsg(null);
    triggerHaptic("selection");

    try {
      const res = await parseTextStatementAction(rawText);
      if (!res.success || !res.data) {
        throw new Error(res.error || "No se pudieron extraer consumos del texto.");
      }

      applyParsedData(res.data);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Error al procesar el texto.");
      triggerHaptic("error");
    } finally {
      setIsParsing(false);
    }
  };

  const applyParsedData = (data: ParsedStatementResult) => {
    setParsedData(data);
    setItems(data.items);

    // Auto-emparejar usuario
    let matchedUser = users[0];
    if (data.detectedUser) {
      const u = users.find((user) => user.name.toLowerCase().includes(data.detectedUser!.toLowerCase()));
      if (u) matchedUser = u;
    }
    setSelectedUserId(matchedUser?.id || users[0]?.id || "");

    // Auto-emparejar tarjeta
    if (matchedUser) {
      const userCards = cards.filter((c) => c.userId === matchedUser.id);
      let foundCard = userCards.find((c) => {
        const bankMatch = data.detectedBank !== "Otro" && c.bank.toLowerCase().includes(data.detectedBank.toLowerCase());
        const lastDigitsMatch = data.cardLastDigits && c.lastDigits === data.cardLastDigits;
        return bankMatch || lastDigitsMatch;
      });

      if (!foundCard && userCards.length > 0) {
        foundCard = userCards[0];
      }

      if (foundCard) {
        setSelectedCardId(foundCard.id);
      }
    }

    setStep("preview");
    triggerHaptic("success");
  };

  const toggleItem = (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
    triggerHaptic("light");
  };

  const toggleAll = (selected: boolean) => {
    setItems((prev) => prev.map((item) => ({ ...item, selected })));
    triggerHaptic("selection");
  };

  const updateItemCategory = (id: string, category: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, category } : item)));
  };

  const updateItemScope = (id: string, scope: "personal" | "hogar") => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              scope,
              markForReview: scope === "personal",
            }
          : item
      )
    );
    triggerHaptic("light");
  };

  const handleImport = async () => {
    const selectedItems = items.filter((i) => i.selected);
    if (selectedItems.length === 0) {
      setErrorMsg("Seleccioná al menos un consumo para importar.");
      return;
    }

    setIsImporting(true);
    setErrorMsg(null);
    triggerHaptic("medium");

    try {
      const targetCard = cards.find((c) => c.id === selectedCardId);
      const cardName = targetCard ? `${targetCard.bank} ${targetCard.brand}` : undefined;

      const res = await importStatementExpensesAction({
        userId: selectedUserId,
        cardId: selectedCardId || undefined,
        year: currentYear,
        month: currentMonth,
        cardName,
        updateCardSummary,
        statementAmount: parsedData?.statementAmount,
        statementAmountUsd: parsedData?.statementAmountUsd,
        dueDate: parsedData?.dueDate || undefined,
        closingDate: parsedData?.closingDate || undefined,
        nextClosingDate: parsedData?.nextClosingDate || undefined,
        nextDueDate: parsedData?.nextDueDate || undefined,
        items: selectedItems.map((i) => ({
          title: i.title,
          amount: i.amount,
          amountUsd: i.amountUsd,
          date: i.date,
          category: i.category,
          installmentNumber: i.installmentNumber,
          totalInstallments: i.totalInstallments,
          notes: i.notes,
          scope: i.scope,
          markForReview: i.markForReview,
        })),
      });

      if (!res.success) {
        throw new Error(res.error || "Error al guardar los consumos.");
      }

      triggerHaptic("success");
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Error al importar consumos.");
      triggerHaptic("error");
    } finally {
      setIsImporting(false);
    }
  };

  const selectedCount = items.filter((i) => i.selected).length;
  const selectedTotalPesos = items
    .filter((i) => i.selected)
    .reduce((s, i) => s + (i.amount || 0), 0);
  const selectedTotalUsd = items
    .filter((i) => i.selected)
    .reduce((s, i) => s + (i.amountUsd || 0), 0);

  const modalContent = (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl h-[94vh] sm:h-[90vh] max-h-[840px] flex flex-col bg-[#141824] border border-white/10 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden">
        
        {/* Encabezado fijo */}
        <div className="shrink-0 flex items-center justify-between px-4 py-3 sm:px-6 sm:py-3.5 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base md:text-lg font-bold text-white tracking-tight">Importar Resumen de Tarjeta</h2>
              <p className="text-[11px] sm:text-xs text-white/50">Procesamiento automático local sin IA (0 tokens)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido principal con scroll interior */}
        <div className="flex-1 min-h-0 flex flex-col p-3 sm:p-4 md:p-5 overflow-hidden">
          {errorMsg && (
            <div className="shrink-0 mb-3 flex items-start gap-2.5 p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-300 text-xs leading-relaxed">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {step === "upload" ? (
            <div className="flex-1 overflow-y-auto space-y-4 flex flex-col justify-center max-w-xl mx-auto w-full">
              {/* Selector de pestañas */}
              <div className="flex p-1 bg-white/[0.04] border border-white/5 rounded-2xl shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setTab("file");
                    setErrorMsg(null);
                  }}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    tab === "file"
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                      : "text-white/60 hover:text-white hover:bg-white/[0.02]"
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  Subir PDF (Santander, BBVA, Galicia)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTab("text");
                    setErrorMsg(null);
                  }}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    tab === "text"
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                      : "text-white/60 hover:text-white hover:bg-white/[0.02]"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Pegar Texto (Mercado Pago / Web)
                </button>
              </div>

              {tab === "file" ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="group relative flex flex-col items-center justify-center p-10 sm:p-16 border-2 border-dashed border-white/15 hover:border-blue-500/50 rounded-3xl bg-white/[0.02] hover:bg-blue-500/[0.03] transition-all cursor-pointer text-center"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept=".pdf,application/pdf"
                    className="hidden"
                  />
                  <div className="w-16 h-16 rounded-3xl bg-white/[0.05] group-hover:bg-blue-500/20 flex items-center justify-center mb-4 transition-colors shadow-inner">
                    {isParsing ? (
                      <RefreshCw className="w-7 h-7 text-blue-400 animate-spin" />
                    ) : (
                      <Upload className="w-7 h-7 text-white/60 group-hover:text-blue-400 transition-colors" />
                    )}
                  </div>
                  <p className="text-base font-bold text-white mb-1.5">
                    {isParsing ? "Analizando archivo PDF..." : "Hacé clic o arrastrá tu resumen PDF acá"}
                  </p>
                  <p className="text-xs text-white/40 max-w-sm leading-relaxed">
                    Extrae automáticamente compras, cuotas (ej: 2/9) y totales de Santander, BBVA y Galicia.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative">
                    <textarea
                      value={rawText}
                      onChange={(e) => setRawText(e.target.value)}
                      rows={10}
                      placeholder="Pegá acá el texto copiado de tu resumen bancario o de Mercado Pago (ej: 'MERPAGO*CUELLO - $ 12.500 Cuota 1 de 3')..."
                      className="w-full p-4 bg-white/[0.03] border border-white/10 rounded-2xl text-xs text-white placeholder-white/30 font-mono focus:outline-none focus:border-blue-500/50 transition-colors resize-none leading-relaxed"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleParseText}
                    disabled={isParsing || !rawText.trim()}
                    className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
                  >
                    {isParsing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Analizando movimientos...
                      </>
                    ) : (
                      <>
                        Analizar Consumos
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* PASO 2: PREVIEW */
            <div className="flex-1 min-h-0 flex flex-col space-y-3 overflow-hidden">
              {/* Barra de Configuración Compacta */}
              <div className="shrink-0 p-3 bg-white/[0.03] border border-white/10 rounded-2xl space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] text-white/50">Banco detectado:</span>
                    <span className="px-2.5 py-0.5 text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full">
                      {parsedData?.detectedBank} {parsedData?.detectedBrand}
                    </span>
                    {parsedData?.cardLastDigits && (
                      <span className="text-[11px] text-white/40 font-mono">•••• {parsedData.cardLastDigits}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep("upload")}
                    className="text-[11px] text-white/50 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Cambiar archivo
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-white/60 shrink-0 w-16">Titular:</span>
                    <select
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                      className="w-full py-1.5 px-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500/50 cursor-pointer"
                    >
                      {users.map((u) => (
                        <option key={u.id} value={u.id} className="bg-slate-900 text-white">
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-white/60 shrink-0 w-16">Tarjeta:</span>
                    <select
                      value={selectedCardId}
                      onChange={(e) => setSelectedCardId(e.target.value)}
                      className="w-full py-1.5 px-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500/50 cursor-pointer"
                    >
                      <option value="" className="bg-slate-900 text-white">
                        (Ninguna / Gasto manual)
                      </option>
                      {cards
                        .filter((c) => !selectedUserId || c.userId === selectedUserId)
                        .map((c) => (
                          <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                            {c.bank} {c.brand} {c.lastDigits ? `(•••• ${c.lastDigits})` : ""}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                {parsedData && (parsedData.statementAmount > 0 || parsedData.dueDate) && (
                  <label className="flex items-center gap-2 pt-0.5 text-xs text-white/80 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={updateCardSummary}
                      onChange={(e) => setUpdateCardSummary(e.target.checked)}
                      className="rounded border-white/20 bg-white/5 text-blue-600 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                    />
                    <div className="flex flex-wrap gap-x-2.5 text-[11px] text-white/70 font-mono items-center">
                      <span>Actualizar tarjeta:</span>
                      {parsedData.statementAmount > 0 && (
                        <span className="text-white font-bold">
                          Total ${Math.round(parsedData.statementAmount).toLocaleString("es-AR")}
                        </span>
                      )}
                      {parsedData.statementAmountUsd > 0 && (
                        <span className="text-emerald-400 font-bold">U$S {parsedData.statementAmountUsd.toFixed(2)}</span>
                      )}
                      {parsedData.dueDate && <span>• Vence: {parsedData.dueDate}</span>}
                      {parsedData.closingDate && <span>• Cierre: {parsedData.closingDate}</span>}
                      {parsedData.nextClosingDate && (
                        <span className="text-purple-300 font-semibold">• Próx. Cierre: {parsedData.nextClosingDate}</span>
                      )}
                      {parsedData.nextDueDate && (
                        <span className="text-purple-300 font-semibold">• Próx. Vto: {parsedData.nextDueDate}</span>
                      )}
                    </div>
                  </label>
                )}
              </div>

              {/* Lista compacta de consumos (estilo tabla / filas densas) */}
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <div className="shrink-0 flex items-center justify-between text-xs text-white/60 mb-2 px-1">
                  <button
                    type="button"
                    onClick={() => toggleAll(selectedCount !== items.length)}
                    className="flex items-center gap-2 font-semibold hover:text-white transition-colors cursor-pointer select-none"
                  >
                    {selectedCount === items.length ? (
                      <CheckSquare className="w-4 h-4 text-blue-400" />
                    ) : (
                      <Square className="w-4 h-4 text-white/40" />
                    )}
                    <span>
                      {selectedCount === items.length ? "Deseleccionar todos" : "Seleccionar todos"}
                    </span>
                  </button>
                  <span className="text-xs text-white/50 font-mono font-medium">
                    {selectedCount} seleccionados de {items.length} consumos
                  </span>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.01] divide-y divide-white/5 pr-0.5">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className={`px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-3 transition-colors ${
                        item.selected
                          ? "hover:bg-white/[0.04] bg-white/[0.01]"
                          : "opacity-35 hover:opacity-55 bg-transparent"
                      }`}
                    >
                      {/* Izquierda: Checkbox + Fecha (en desktop) + Título + Badges */}
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => toggleItem(item.id)}
                          className="text-white/40 hover:text-white transition-colors shrink-0 cursor-pointer p-0.5"
                          aria-label="Seleccionar consumo"
                        >
                          {item.selected ? (
                            <CheckSquare className="w-4 h-4 text-blue-400" />
                          ) : (
                            <Square className="w-4 h-4 text-white/40" />
                          )}
                        </button>

                        <span className="font-mono text-xs text-white/40 shrink-0 hidden sm:inline-block w-20">
                          {item.date}
                        </span>

                        <div className="min-w-0 flex-1 flex items-center gap-1.5 flex-wrap">
                          <span
                            onClick={() => toggleItem(item.id)}
                            className="text-xs sm:text-sm font-medium text-white truncate cursor-pointer hover:text-blue-300 transition-colors"
                            title={item.title}
                          >
                            {item.title}
                          </span>
                          {item.installmentNumber && item.totalInstallments && (
                            <span className="shrink-0 px-1.5 py-0.2 text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded">
                              Cuota {item.installmentNumber}/{item.totalInstallments}
                            </span>
                          )}
                          {item.isCancelled && (
                            <span className="shrink-0 px-1.5 py-0.2 text-[9px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded">
                              Anulado / Reembolsado
                            </span>
                          )}
                          {!item.isCancelled && item.amount < 0 && (
                            <span className="shrink-0 px-1.5 py-0.2 text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded">
                              Devolución
                            </span>
                          )}
                          {item.isTaxOrFee && !item.isCancelled && (
                            <span className="shrink-0 px-1.5 py-0.2 text-[9px] font-medium bg-white/10 text-white/60 rounded">
                              Impuesto
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Derecha: Fecha (en móvil) + Categoría + Ámbito + Monto */}
                      <div className="flex items-center justify-between sm:justify-end gap-2 pl-6 sm:pl-0 shrink-0">
                        <span className="font-mono text-[10px] text-white/40 sm:hidden">
                          {item.date}
                        </span>

                        <div className="flex items-center gap-1.5">
                          <select
                            value={item.category}
                            onChange={(e) => updateItemCategory(item.id, e.target.value)}
                            className="bg-white/5 hover:bg-white/10 text-[11px] text-blue-300 border border-white/10 rounded-md px-2 py-0.5 cursor-pointer focus:ring-0 max-w-[115px] sm:max-w-[130px] truncate"
                          >
                            {categories.map((cat) => (
                              <option key={cat.id} value={cat.name} className="bg-slate-900 text-white">
                                {cat.name}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            onClick={() => updateItemScope(item.id, item.scope === "personal" ? "hogar" : "personal")}
                            className={`text-[10px] px-2 py-0.5 rounded-md font-semibold cursor-pointer transition shrink-0 ${
                              item.scope === "hogar"
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30"
                                : "bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30"
                            }`}
                          >
                            {item.scope === "hogar" ? "Hogar 60%" : "Personal"}
                          </button>
                        </div>

                        <div className="text-right font-mono font-bold text-white shrink-0 min-w-[75px] sm:min-w-[95px]">
                          {item.amount !== 0 && (
                            <div className={`text-xs sm:text-sm ${item.amount < 0 ? "text-emerald-400" : ""}`}>
                              {item.amount < 0
                                ? `-$${Math.round(Math.abs(item.amount)).toLocaleString("es-AR")}`
                                : `$${Math.round(item.amount).toLocaleString("es-AR")}`}
                            </div>
                          )}
                          {item.amountUsd && item.amountUsd !== 0 && (
                            <div className={`text-[11px] ${item.amountUsd < 0 ? "text-rose-400" : "text-emerald-400"}`}>
                              {item.amountUsd < 0
                                ? `-U$S ${Math.abs(item.amountUsd).toFixed(2)}`
                                : `U$S ${item.amountUsd.toFixed(2)}`}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Barra de confirmación inferior SIEMPRE fija */}
        {step === "preview" && (
          <div className="shrink-0 flex items-center justify-between px-4 py-3 sm:px-6 sm:py-3.5 border-t border-white/10 bg-[#0F131D]">
            <div>
              <div className="text-[11px] sm:text-xs text-white/50 font-medium">
                {selectedCount} de {items.length} consumos seleccionados
              </div>
              <div className="text-sm sm:text-base md:text-lg font-bold text-white font-mono">
                ${Math.round(selectedTotalPesos).toLocaleString("es-AR")}
                {selectedTotalUsd > 0 && (
                  <span className="text-emerald-400 font-normal text-xs sm:text-sm ml-2">
                    (+ U$S {selectedTotalUsd.toFixed(2)})
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-semibold text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={isImporting || selectedCount === 0}
                className="px-4 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 sm:gap-2 shadow-lg shadow-blue-500/25 transition-all cursor-pointer"
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Confirmar e Importar
                  </>
                )}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
