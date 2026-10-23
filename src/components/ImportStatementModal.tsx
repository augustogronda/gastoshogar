"use client";

import React, { useState, useRef } from "react";
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

  // Inicializar usuario y tarjeta cuando se abre el modal
  React.useEffect(() => {
    if (isOpen) {
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
  }, [isOpen, preselectedCardId, cards, users]);

  if (!isOpen) return null;

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col bg-[#141824] border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
        
        {/* Encabezado */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <CreditCard className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Importar Resumen de Tarjeta</h2>
              <p className="text-xs text-white/50">Procesamiento automático local sin IA (0 tokens)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido scrolleable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMsg && (
            <div className="flex items-start gap-3 p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-300 text-xs leading-relaxed animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {step === "upload" ? (
            <div className="space-y-5">
              {/* Selector de pestañas: Archivo PDF vs Pegar texto */}
              <div className="flex p-1 bg-white/[0.04] border border-white/5 rounded-2xl">
                <button
                  type="button"
                  onClick={() => {
                    setTab("file");
                    setErrorMsg(null);
                  }}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
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
                  className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
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
                  className="group relative flex flex-col items-center justify-center p-8 border-2 border-dashed border-white/15 hover:border-blue-500/50 rounded-3xl bg-white/[0.02] hover:bg-blue-500/[0.03] transition-all cursor-pointer"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept=".pdf,application/pdf"
                    className="hidden"
                  />
                  <div className="w-14 h-14 rounded-2xl bg-white/[0.05] group-hover:bg-blue-500/20 flex items-center justify-center mb-3 transition-colors">
                    {isParsing ? (
                      <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
                    ) : (
                      <Upload className="w-6 h-6 text-white/60 group-hover:text-blue-400 transition-colors" />
                    )}
                  </div>
                  <p className="text-sm font-semibold text-white mb-1">
                    {isParsing ? "Analizando archivo PDF..." : "Hacé clic o arrastrá tu resumen PDF"}
                  </p>
                  <p className="text-xs text-white/40 text-center max-w-sm">
                    Reconoce automáticamente consumos, cuotas y totales de Santander, BBVA y Galicia.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative">
                    <textarea
                      value={rawText}
                      onChange={(e) => setRawText(e.target.value)}
                      rows={9}
                      placeholder="Pegá acá el texto copiado de tu resumen bancario o de Mercado Pago (ej: 'MERPAGO*CUELLO - $ 12.500 Cuota 1 de 3')..."
                      className="w-full p-4 bg-white/[0.03] border border-white/10 rounded-2xl text-xs text-white placeholder-white/30 font-mono focus:outline-none focus:border-blue-500/50 transition-colors resize-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleParseText}
                    disabled={isParsing || !rawText.trim()}
                    className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-2xl text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
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
            <div className="space-y-5">
              {/* Card de Configuración y Detección */}
              <div className="p-4 bg-white/[0.03] border border-white/10 rounded-2xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/50">Banco detectado:</span>
                    <span className="px-2.5 py-0.5 text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full">
                      {parsedData?.detectedBank} {parsedData?.detectedBrand}
                    </span>
                    {parsedData?.cardLastDigits && (
                      <span className="text-xs text-white/40">•••• {parsedData.cardLastDigits}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep("upload")}
                    className="text-xs text-white/50 hover:text-white flex items-center gap-1 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Cambiar archivo
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Selector de Usuario */}
                  <div>
                    <label className="block text-[11px] font-medium text-white/50 mb-1">
                      Titular del gasto
                    </label>
                    <select
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                      className="w-full py-2 px-3 bg-white/[0.04] border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500/50"
                    >
                      {users.map((u) => (
                        <option key={u.id} value={u.id} className="bg-slate-900 text-white">
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Selector de Tarjeta Asociada */}
                  <div>
                    <label className="block text-[11px] font-medium text-white/50 mb-1">
                      Asignar a tarjeta
                    </label>
                    <select
                      value={selectedCardId}
                      onChange={(e) => setSelectedCardId(e.target.value)}
                      className="w-full py-2 px-3 bg-white/[0.04] border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500/50"
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

                {/* Actualizar resumen de tarjeta */}
                {parsedData && (parsedData.statementAmount > 0 || parsedData.dueDate) && (
                  <label className="flex items-start gap-2.5 pt-2 text-xs text-white/80 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={updateCardSummary}
                      onChange={(e) => setUpdateCardSummary(e.target.checked)}
                      className="mt-0.5 rounded border-white/20 bg-white/5 text-blue-600 focus:ring-0"
                    />
                    <div>
                      <span>Actualizar resumen mensual de la tarjeta con los datos detectados:</span>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-0.5 text-[11px] text-white/50 font-mono">
                        {parsedData.statementAmount > 0 && (
                          <span>Total: ${Math.round(parsedData.statementAmount).toLocaleString("es-AR")}</span>
                        )}
                        {parsedData.statementAmountUsd > 0 && (
                          <span>U$S {parsedData.statementAmountUsd.toFixed(2)}</span>
                        )}
                        {parsedData.dueDate && <span>Vence: {parsedData.dueDate}</span>}
                        {parsedData.closingDate && <span>Cierre: {parsedData.closingDate}</span>}
                      </div>
                    </div>
                  </label>
                )}
              </div>

              {/* Lista de consumos */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-white/60 px-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleAll(selectedCount !== items.length)}
                      className="flex items-center gap-1.5 font-medium hover:text-white transition-colors"
                    >
                      {selectedCount === items.length ? (
                        <CheckSquare className="w-3.5 h-3.5 text-blue-400" />
                      ) : (
                        <Square className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {selectedCount === items.length ? "Deseleccionar todos" : "Seleccionar todos"}
                      </span>
                    </button>
                    <span className="text-white/30">•</span>
                    <span>{items.length} consumos detectados</span>
                  </div>
                </div>

                <div className="space-y-1.5 max-h-[38vh] overflow-y-auto pr-1">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border transition-all ${
                        item.selected
                          ? "bg-white/[0.04] border-white/15"
                          : "bg-white/[0.01] border-white/5 opacity-50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() => toggleItem(item.id)}
                          className="mt-0.5 text-white/40 hover:text-white transition-colors"
                        >
                          {item.selected ? (
                            <CheckSquare className="w-4 h-4 text-blue-400" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-white tracking-tight">
                              {item.title}
                            </span>
                            {item.installmentNumber && item.totalInstallments && (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-md">
                                Cuota {item.installmentNumber}/{item.totalInstallments}
                              </span>
                            )}
                            {item.isTaxOrFee && (
                              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-white/10 text-white/60 rounded">
                                Impuesto
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-white/40 mt-0.5">
                            <span className="font-mono">{item.date}</span>
                            <span>•</span>
                            {/* Selector de categoría in-line */}
                            <select
                              value={item.category}
                              onChange={(e) => updateItemCategory(item.id, e.target.value)}
                              className="bg-transparent border-0 p-0 text-[11px] text-blue-300 hover:text-blue-200 cursor-pointer focus:ring-0"
                            >
                              {categories.map((cat) => (
                                <option key={cat.id} value={cat.name} className="bg-slate-900 text-white">
                                  {cat.name}
                                </option>
                              ))}
                            </select>
                            <span>•</span>
                            {/* Toggle Scope: Personal vs Hogar */}
                            <button
                              type="button"
                              onClick={() => updateItemScope(item.id, item.scope === "personal" ? "hogar" : "personal")}
                              className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                                item.scope === "hogar"
                                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                  : "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                              }`}
                            >
                              {item.scope === "hogar" ? "Hogar 60%" : "Personal (Revisar)"}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="text-right mt-2 sm:mt-0 font-mono text-xs font-bold text-white pl-7 sm:pl-0">
                        {item.amount > 0 && <div>${Math.round(item.amount).toLocaleString("es-AR")}</div>}
                        {item.amountUsd && item.amountUsd > 0 && (
                          <div className="text-emerald-400 text-[11px]">U$S {item.amountUsd.toFixed(2)}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Barra de acción inferior */}
        {step === "preview" && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-white/[0.02]">
            <div>
              <div className="text-xs text-white/50 font-medium">
                {selectedCount} de {items.length} consumos
              </div>
              <div className="text-sm font-bold text-white font-mono">
                ${Math.round(selectedTotalPesos).toLocaleString("es-AR")}
                {selectedTotalUsd > 0 && (
                  <span className="text-emerald-400 font-normal text-xs ml-1.5">
                    (+ U$S {selectedTotalUsd.toFixed(2)})
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-medium text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={isImporting || selectedCount === 0}
                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
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
}
