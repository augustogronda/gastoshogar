"use client";

import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  X,
  Search,
  Sparkles,
  Check,
  PiggyBank,
  AlertCircle,
} from "./ui/icons";
import {
  savePersonalInvestmentAction,
  saveSharedInvestmentAction,
  searchMarketTickersAction,
  fetchMarketQuoteAction,
} from "@/app/actions";
import { POPULAR_ARGENTINA_ASSETS } from "@/lib/investments-service";

interface PersonalInvestmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  householdId?: string;
  investmentToEdit?: {
    id: string;
    ticker: string;
    name: string;
    assetType: string;
    quantity: number;
    buyPrice?: number | null;
    currency?: string;
    manualPrice?: number | null;
    notes?: string | null;
  } | null;
  onSaved?: () => void;
}

export function PersonalInvestmentModal({
  isOpen,
  onClose,
  userId,
  householdId,
  investmentToEdit,
  onSaved,
}: PersonalInvestmentModalProps) {
  const [activeMode, setActiveMode] = useState<"search" | "manual">(
    investmentToEdit?.assetType === "FCI" ? "manual" : "search"
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<any>>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Form state
  const [ticker, setTicker] = useState(investmentToEdit?.ticker || "");
  const [name, setName] = useState(investmentToEdit?.name || "");
  const [assetType, setAssetType] = useState(investmentToEdit?.assetType || "CEDEAR");
  const [currency, setCurrency] = useState(investmentToEdit?.currency || "ARS");
  const [quantity, setQuantity] = useState(
    investmentToEdit?.quantity ? String(investmentToEdit.quantity) : ""
  );
  const [buyPrice, setBuyPrice] = useState(
    investmentToEdit?.buyPrice ? String(investmentToEdit.buyPrice) : ""
  );
  const [manualPrice, setManualPrice] = useState(
    investmentToEdit?.manualPrice ? String(investmentToEdit.manualPrice) : ""
  );
  const [notes, setNotes] = useState(investmentToEdit?.notes || "");

  const [previewPrice, setPreviewPrice] = useState<number | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Inicializar al editar
  useEffect(() => {
    if (investmentToEdit) {
      setTicker(investmentToEdit.ticker);
      setName(investmentToEdit.name);
      setAssetType(investmentToEdit.assetType);
      setCurrency(investmentToEdit.currency || "ARS");
      setQuantity(String(investmentToEdit.quantity));
      setBuyPrice(investmentToEdit.buyPrice ? String(investmentToEdit.buyPrice) : "");
      setManualPrice(investmentToEdit.manualPrice ? String(investmentToEdit.manualPrice) : "");
      setNotes(investmentToEdit.notes || "");
      setActiveMode(investmentToEdit.assetType === "FCI" ? "manual" : "search");
      if (investmentToEdit.manualPrice) {
        setPreviewPrice(investmentToEdit.manualPrice);
      } else {
        fetchQuoteForTicker(investmentToEdit.ticker);
      }
    } else {
      setTicker("");
      setName("");
      setAssetType("CEDEAR");
      setCurrency("ARS");
      setQuantity("");
      setBuyPrice("");
      setManualPrice("");
      setNotes("");
      setPreviewPrice(null);
      setErrorMsg(null);
      setSearchQuery("");
      setSearchResults([]);
      setActiveMode("search");
    }
  }, [investmentToEdit, isOpen]);

  // Debounced search
  useEffect(() => {
    if (activeMode !== "search" || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await searchMarketTickersAction(searchQuery.trim());
        setSearchResults(res);
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery, activeMode]);

  const fetchQuoteForTicker = async (sym: string) => {
    setIsLoadingQuote(true);
    try {
      const q = await fetchMarketQuoteAction(sym);
      if (q) {
        setPreviewPrice(q.price);
        setCurrency(q.currency);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingQuote(false);
    }
  };

  const handleSelectAsset = (item: {
    ticker: string;
    name: string;
    assetType: string;
    currency?: string;
    defaultCurrency?: string;
  }) => {
    setTicker(item.ticker);
    setName(item.name);
    setAssetType(item.assetType);
    setCurrency(item.currency || item.defaultCurrency || "ARS");
    setSearchQuery("");
    setSearchResults([]);
    fetchQuoteForTicker(item.ticker);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanTicker = ticker.trim().toUpperCase();
    const cleanQuantity = parseFloat(quantity.replace(",", "."));
    const cleanBuyPrice = buyPrice ? parseFloat(buyPrice.replace(",", ".")) : null;
    const cleanManualPrice = manualPrice ? parseFloat(manualPrice.replace(",", ".")) : null;

    if (!cleanTicker) {
      setErrorMsg("Ingresá el ticker o nombre del activo.");
      return;
    }

    if (isNaN(cleanQuantity) || cleanQuantity <= 0) {
      setErrorMsg("Ingresá una cantidad válida de títulos o cuotapartes.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (householdId) {
        await saveSharedInvestmentAction({
          id: investmentToEdit?.id,
          householdId,
          ticker: cleanTicker,
          name: name.trim() || cleanTicker,
          assetType,
          quantity: cleanQuantity,
          buyPrice: cleanBuyPrice,
          currency,
          manualPrice: cleanManualPrice,
          notes: notes.trim() || null,
        });
      } else if (userId) {
        await savePersonalInvestmentAction({
          id: investmentToEdit?.id,
          userId,
          ticker: cleanTicker,
          name: name.trim() || cleanTicker,
          assetType,
          quantity: cleanQuantity,
          buyPrice: cleanBuyPrice,
          currency,
          manualPrice: cleanManualPrice,
          notes: notes.trim() || null,
        });
      } else {
        throw new Error("No se especificó usuario u hogar.");
      }

      if (onSaved) onSaved();
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Error al guardar inversión.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const currentUnitVal =
    parseFloat(manualPrice.replace(",", ".")) || previewPrice || parseFloat(buyPrice.replace(",", ".")) || 0;
  const numQuantity = parseFloat(quantity.replace(",", ".")) || 0;
  const estimatedTotal = numQuantity * currentUnitVal;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md super-card rounded-3xl p-5 shadow-2xl flex flex-col max-h-[92vh] overflow-y-auto no-scrollbar">
        {/* Cabecera */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                {investmentToEdit ? "Editar Inversión" : "Nueva Inversión"}
              </h2>
              <p className="text-[11px] text-zinc-400">
                CEDEARs, Acciones, FCIs, Cripto y Bonos
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] active:scale-95 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Selector de Modo (Bolsa / Manual FCI) */}
        {!investmentToEdit && (
          <div className="flex bg-zinc-900/90 p-1 rounded-2xl border border-white/[0.08] mt-3.5 mb-1">
            <button
              type="button"
              onClick={() => setActiveMode("search")}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold transition ${
                activeMode === "search"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Cotización Automática (Bolsa)
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveMode("manual");
                setAssetType("FCI");
              }}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold transition ${
                activeMode === "manual"
                  ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              FCI / Manual
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-3.5 space-y-3.5">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* MODO BÚSQUEDA AUTOMÁTICA */}
          {activeMode === "search" && !investmentToEdit && (
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block">
                Buscar Ticker / Empresa
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ej: Apple, SPY, MELI, Galicia, Bitcoin..."
                  className="w-full bg-zinc-900/90 border border-white/[0.1] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition"
                />
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
                {isSearching && (
                  <span className="text-[10px] text-indigo-400 absolute right-3 top-2.5 animate-pulse">
                    Buscando...
                  </span>
                )}
              </div>

              {/* Resultados de búsqueda flotantes */}
              {searchResults.length > 0 && (
                <div className="bg-zinc-900/95 border border-white/[0.12] rounded-2xl p-1.5 max-h-48 overflow-y-auto space-y-1 shadow-2xl">
                  {searchResults.map((item) => (
                    <button
                      key={item.ticker}
                      type="button"
                      onClick={() => handleSelectAsset(item)}
                      className="w-full text-left p-2 rounded-xl hover:bg-white/[0.08] active:scale-[0.99] transition flex items-center justify-between group"
                    >
                      <div className="truncate mr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-white group-hover:text-indigo-300 font-mono">
                            {item.ticker}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/[0.08] text-zinc-300 font-medium">
                            {item.assetType}
                          </span>
                        </div>
                        <span className="text-[11px] text-zinc-400 truncate block mt-0.5">
                          {item.name}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-zinc-400">
                        {item.currency}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Atajos Populares en Argentina */}
              {!searchQuery && !ticker && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] text-zinc-400 font-semibold block">
                    Más populares en Argentina:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {POPULAR_ARGENTINA_ASSETS.slice(0, 8).map((asset) => (
                      <button
                        key={asset.ticker}
                        type="button"
                        onClick={() => handleSelectAsset(asset)}
                        className="px-2 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-[11px] text-zinc-200 font-medium active:scale-95 transition"
                      >
                        <span className="font-mono font-bold text-indigo-300 mr-1">
                          {asset.ticker.replace(".BA", "")}
                        </span>
                        <span className="text-[10px] text-zinc-400">{asset.assetType}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Activo Seleccionado / Datos Principales */}
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-3.5 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                  Ticker / Código
                </label>
                <input
                  type="text"
                  value={ticker}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    setTicker(val);
                  }}
                  onBlur={() => {
                    if (ticker.trim() && activeMode === "search") {
                      fetchQuoteForTicker(ticker.trim());
                    }
                  }}
                  placeholder="AAPL.BA"
                  required
                  className="w-full bg-zinc-900 border border-white/[0.1] rounded-xl px-2.5 py-2 text-xs font-mono font-bold text-white uppercase focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="col-span-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                  Nombre Activo
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Apple Inc."
                  required
                  className="w-full bg-zinc-900 border border-white/[0.1] rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                  Tipo de Activo
                </label>
                <select
                  value={assetType}
                  onChange={(e) => setAssetType(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/[0.1] rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="CEDEAR">CEDEAR</option>
                  <option value="ACCION">Acción Local</option>
                  <option value="FCI">Fondo Común (FCI)</option>
                  <option value="CRYPTO">Criptomoneda</option>
                  <option value="BONO">Bono / Título</option>
                  <option value="OTRO">Otro Activo</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                  Moneda Base
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/[0.1] rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="ARS">Pesos (ARS)</option>
                  <option value="USD">Dólares (USD)</option>
                </select>
              </div>
            </div>

            {/* Vista previa de cotización actual detectada */}
            {previewPrice !== null && (
              <div className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
                <span>Cotización en vivo:</span>
                <span className="font-bold font-mono">
                  {currency === "USD" ? "u$s" : "$"}{" "}
                  {previewPrice.toLocaleString("es-AR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 4,
                  })}
                </span>
              </div>
            )}
            {isLoadingQuote && (
              <p className="text-[10px] text-zinc-400 animate-pulse text-center">
                Consultando cotización de mercado...
              </p>
            )}
          </div>

          {/* Cantidades y Precios */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block mb-1">
                Cantidad (Nominales)
              </label>
              <input
                type="number"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Ej: 10"
                required
                className="w-full bg-zinc-900 border border-white/[0.1] rounded-xl px-3 py-2 text-sm font-mono font-bold text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block mb-1">
                Precio Compra (Promedio)
              </label>
              <input
                type="number"
                step="any"
                value={buyPrice}
                onChange={(e) => setBuyPrice(e.target.value)}
                placeholder="Opcional para P&L"
                className="w-full bg-zinc-900 border border-white/[0.1] rounded-xl px-3 py-2 text-sm font-mono text-zinc-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Si es FCI o manual: Precio unitario manual */}
          {(activeMode === "manual" || assetType === "FCI" || !previewPrice) && (
            <div>
              <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block mb-1 flex items-center justify-between">
                <span>Precio Unitario Actual (Manual)</span>
                <span className="text-[10px] font-normal text-zinc-400">Cuotaparte o valor hoy</span>
              </label>
              <input
                type="number"
                step="any"
                value={manualPrice}
                onChange={(e) => setManualPrice(e.target.value)}
                placeholder="Ej: 2500.50"
                className="w-full bg-zinc-900 border border-white/[0.1] rounded-xl px-3 py-2 text-sm font-mono font-bold text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}

          {/* Notas */}
          <div>
            <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
              Notas / Broker (Opcional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Balanz, IOL, Santander, etc."
              className="w-full bg-zinc-900 border border-white/[0.1] rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Resumen Estimado */}
          {estimatedTotal > 0 && (
            <div className="p-3 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-indigo-300 block">
                  Valuación Estimada
                </span>
                <span className="text-xs text-zinc-400">
                  {numQuantity} {assetType === "FCI" ? "cuotapartes" : "nominales"}
                </span>
              </div>
              <span className="text-lg font-extrabold text-white font-mono tabular-nums">
                {currency === "USD" ? "u$s" : "$"}{" "}
                {Math.round(estimatedTotal).toLocaleString("es-AR")}
              </span>
            </div>
          )}

          {/* Botones de acción */}
          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] text-xs font-semibold text-zinc-300 active:scale-95 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 active:scale-95 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? "Guardando..." : "Guardar Inversión"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
