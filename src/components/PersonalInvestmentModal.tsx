"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  TrendingUp,
  X,
  Search,
  Check,
  PiggyBank,
  AlertCircle,
  RefreshCw,
} from "./ui/icons";
import {
  savePersonalInvestmentAction,
  saveSharedInvestmentAction,
  searchMarketTickersAction,
  fetchMarketQuoteAction,
  searchFciFundsAction,
  fetchFciQuoteAction,
} from "@/app/actions";
import {
  POPULAR_ARGENTINA_ASSETS,
  POPULAR_ARGENTINA_FCIS,
  CafciFundQuote,
} from "@/lib/investments-service";
import { triggerHaptic } from "@/lib/haptics";

interface PersonalInvestmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  householdId?: string;
  defaultAssetType?: string;
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

const MANUAL_ASSET_TYPES = ["FCI", "PLAZO_FIJO", "ON", "OTRO"];

export function PersonalInvestmentModal({
  isOpen,
  onClose,
  userId,
  householdId,
  defaultAssetType,
  investmentToEdit,
  onSaved,
}: PersonalInvestmentModalProps) {
  const [mounted, setMounted] = useState(false);
  const [activeMode, setActiveMode] = useState<"search" | "manual">("search");
  const [popularFilter, setPopularFilter] = useState<
    "ALL" | "CEDEAR" | "ACCION" | "BONO" | "CRYPTO"
  >("ALL");

  // Para FCI / Plazo Fijo / Manual: permitir cargar por "Cuotapartes" o por "Saldo Total" (quantity = 1)
  const [valuationMode, setValuationMode] = useState<"total" | "units">("total");

  // Buscador de Bolsa (CEDEARs / Acciones)
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<any>>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Buscador de Fondos Comunes (CAFCI)
  const [fciSearchQuery, setFciSearchQuery] = useState("");
  const [fciSearchResults, setFciSearchResults] = useState<CafciFundQuote[]>([]);
  const [isSearchingFci, setIsSearchingFci] = useState(false);
  const [fciLiveQuote, setFciLiveQuote] = useState<
    (CafciFundQuote & { recommendedVcp?: number }) | null
  >(null);
  const [isLoadingFciQuote, setIsLoadingFciQuote] = useState(false);

  // Form state
  const [ticker, setTicker] = useState("");
  const [name, setName] = useState("");
  const [assetType, setAssetType] = useState("CEDEAR");
  const [currency, setCurrency] = useState("ARS");
  const [quantity, setQuantity] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [manualPrice, setManualPrice] = useState("");
  const [notes, setNotes] = useState("");

  const [previewPrice, setPreviewPrice] = useState<number | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Inicializar al abrir o editar
  useEffect(() => {
    if (!isOpen) return;

    if (investmentToEdit) {
      const isManualType =
        MANUAL_ASSET_TYPES.includes(investmentToEdit.assetType) ||
        Boolean(
          investmentToEdit.manualPrice &&
            investmentToEdit.manualPrice > 0 &&
            investmentToEdit.ticker.startsWith("FCI-")
        );

      setTicker(investmentToEdit.ticker);
      setName(investmentToEdit.name);
      setAssetType(investmentToEdit.assetType);
      setCurrency(investmentToEdit.currency || "ARS");
      setQuantity(String(investmentToEdit.quantity));
      setBuyPrice(investmentToEdit.buyPrice ? String(investmentToEdit.buyPrice) : "");
      setManualPrice(
        investmentToEdit.manualPrice ? String(investmentToEdit.manualPrice) : ""
      );
      setNotes(investmentToEdit.notes || "");
      setActiveMode(isManualType ? "manual" : "search");
      setValuationMode(
        isManualType && investmentToEdit.quantity === 1 ? "total" : "units"
      );
      setErrorMsg(null);
      setFciSearchQuery("");
      setFciSearchResults([]);
      setFciLiveQuote(null);

      if (investmentToEdit.manualPrice) {
        setPreviewPrice(investmentToEdit.manualPrice);
      } else if (!isManualType) {
        fetchQuoteForTicker(investmentToEdit.ticker);
      }

      if (investmentToEdit.assetType === "FCI") {
        lookupFciQuote(investmentToEdit.name, investmentToEdit.manualPrice, false);
      }
    } else {
      const initialType = defaultAssetType || "CEDEAR";
      const startInManual = MANUAL_ASSET_TYPES.includes(initialType);
      setTicker("");
      setName("");
      setAssetType(initialType);
      setCurrency("ARS");
      setQuantity(startInManual ? "1" : "");
      setBuyPrice("");
      setManualPrice("");
      setNotes("");
      setPreviewPrice(null);
      setErrorMsg(null);
      setSearchQuery("");
      setSearchResults([]);
      setFciSearchQuery("");
      setFciSearchResults([]);
      setFciLiveQuote(null);
      setActiveMode(startInManual ? "manual" : "search");
      setValuationMode(startInManual ? "total" : "units");
    }
  }, [investmentToEdit, isOpen, defaultAssetType]);

  // Debounced search de Bolsa (CEDEARs / Acciones)
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
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, activeMode]);

  // Debounced search de Fondos Comunes (CAFCI)
  useEffect(() => {
    if (activeMode !== "manual" || assetType !== "FCI" || !fciSearchQuery.trim()) {
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
  }, [fciSearchQuery, activeMode, assetType]);

  const fetchQuoteForTicker = async (sym: string) => {
    if (!sym || sym.startsWith("FCI-") || sym.startsWith("PF-")) return;
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

  const lookupFciQuote = async (
    fundNameOrTicker: string,
    refPrice?: number | null,
    applyToInput = true
  ) => {
    if (!fundNameOrTicker.trim()) return;
    setIsLoadingFciQuote(true);
    try {
      const quote = await fetchFciQuoteAction(fundNameOrTicker.trim(), refPrice);
      if (quote) {
        setFciLiveQuote(quote);
        if (applyToInput && quote.vcpUnit > 0) {
          setValuationMode("units");
          setManualPrice(String(quote.recommendedVcp || quote.vcpUnit));
        }
      }
    } catch (err) {
      console.error("Error fetching FCI quote:", err);
    } finally {
      setIsLoadingFciQuote(false);
    }
  };

  const handleSelectAsset = (item: {
    ticker: string;
    name: string;
    assetType: string;
    currency?: string;
    defaultCurrency?: string;
    exchange?: string;
    broker?: string;
  }) => {
    triggerHaptic(8);
    setTicker(item.ticker);
    setName(item.name);
    setAssetType(item.assetType);
    setCurrency(item.currency || item.defaultCurrency || "ARS");
    if (item.broker) {
      setNotes(item.broker);
    } else if (item.exchange && item.assetType === "FCI") {
      setNotes(item.exchange);
    }
    setSearchQuery("");
    setSearchResults([]);

    if (item.assetType === "FCI") {
      setActiveMode("manual");
      setPreviewPrice(null);
      lookupFciQuote(item.name, null, false);
    } else {
      setValuationMode("units");
      if (quantity === "1" && !investmentToEdit) {
        setQuantity("");
      }
      fetchQuoteForTicker(item.ticker);
    }
  };

  const handleSelectCafciFund = (fund: CafciFundQuote) => {
    triggerHaptic(8);
    setTicker(fund.ticker);
    setName(fund.name);
    setAssetType("FCI");
    setCurrency(fund.currency);
    setNotes(fund.broker);
    setFciLiveQuote(fund);
    setFciSearchQuery("");
    setFciSearchResults([]);

    // Si tiene VCP en vivo y el usuario está en modo Cuotapartes, cargamos el VCP automáticamente
    if (fund.vcpUnit > 0 && valuationMode === "units") {
      setManualPrice(String(fund.vcpUnit));
    }
  };

  const handleSelectFciPreset = (fci: (typeof POPULAR_ARGENTINA_FCIS)[number]) => {
    triggerHaptic(8);
    setTicker(fci.ticker);
    setName(fci.name);
    setAssetType("FCI");
    setCurrency(fci.defaultCurrency);
    setNotes(fci.broker);
    if (!quantity || quantity === "0") {
      setQuantity("1");
    }
    lookupFciQuote(fci.name, null, valuationMode === "units");
  };

  const generateAutoTicker = (rawName: string, type: string) => {
    const clean = rawName
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 8);
    const prefix =
      type === "FCI"
        ? "FCI"
        : type === "PLAZO_FIJO"
        ? "PF"
        : type === "ON"
        ? "ON"
        : "ACT";
    return clean ? `${prefix}-${clean}` : `${prefix}-01`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const isDirectTotalMode = activeMode === "manual" && valuationMode === "total";
    const cleanName = name.trim() || ticker.trim().toUpperCase();
    const cleanTicker =
      ticker.trim().toUpperCase() || generateAutoTicker(cleanName, assetType);

    const cleanQuantity = isDirectTotalMode
      ? 1
      : parseFloat(quantity.replace(",", "."));
    const cleanBuyPrice = buyPrice
      ? parseFloat(buyPrice.replace(",", "."))
      : null;
    const cleanManualPrice = manualPrice
      ? parseFloat(manualPrice.replace(",", "."))
      : activeMode === "search"
      ? null
      : null;

    if (!cleanName && !cleanTicker) {
      setErrorMsg("Ingresá el nombre o ticker del activo.");
      return;
    }

    if (isNaN(cleanQuantity) || cleanQuantity <= 0) {
      setErrorMsg(
        assetType === "FCI" && valuationMode === "units"
          ? "Ingresá la cantidad de cuotapartes."
          : "Ingresá una cantidad válida."
      );
      return;
    }

    if (
      activeMode === "manual" &&
      (!cleanManualPrice || cleanManualPrice <= 0) &&
      (!cleanBuyPrice || cleanBuyPrice <= 0)
    ) {
      setErrorMsg(
        valuationMode === "units"
          ? "Ingresá el valor actual de la cuotaparte."
          : "Ingresá el saldo actual de la inversión."
      );
      return;
    }

    const finalManualPrice =
      activeMode === "manual"
        ? cleanManualPrice || cleanBuyPrice || null
        : cleanManualPrice;

    setIsSubmitting(true);
    try {
      const payload = {
        id: investmentToEdit?.id,
        ticker: cleanTicker,
        name: cleanName,
        assetType,
        quantity: cleanQuantity,
        buyPrice: cleanBuyPrice,
        currency,
        manualPrice: finalManualPrice,
        notes: notes.trim() || null,
      };

      if (householdId) {
        await saveSharedInvestmentAction({
          ...payload,
          householdId,
        });
      } else if (userId) {
        await savePersonalInvestmentAction({
          ...payload,
          userId,
        });
      } else {
        throw new Error("No se especificó usuario u hogar.");
      }

      if (onSaved) onSaved();
      triggerHaptic("success");
      onClose();
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : "Error al guardar inversión."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !mounted) return null;

  const isDirectTotalMode = activeMode === "manual" && valuationMode === "total";
  const currentUnitVal =
    parseFloat(manualPrice.replace(",", ".")) ||
    previewPrice ||
    parseFloat(buyPrice.replace(",", ".")) ||
    0;
  const numQuantity = isDirectTotalMode
    ? 1
    : parseFloat(quantity.replace(",", ".")) || 0;
  const estimatedTotal = numQuantity * currentUnitVal;
  const numBuyPrice = parseFloat(buyPrice.replace(",", ".")) || 0;
  const estimatedCost = numBuyPrice > 0 ? numQuantity * numBuyPrice : 0;
  const estimatedDiff =
    estimatedCost > 0 && estimatedTotal > 0 ? estimatedTotal - estimatedCost : null;

  const filteredPopularAssets =
    popularFilter === "ALL"
      ? POPULAR_ARGENTINA_ASSETS.slice(0, 10)
      : POPULAR_ARGENTINA_ASSETS.filter((a) => a.assetType === popularFilter);

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
        {/* CABECERA FIJA */}
        <div className="shrink-0 px-4 pt-4 pb-3 border-b border-white/[0.08] bg-zinc-950/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  {investmentToEdit
                    ? "Editar Inversión"
                    : householdId
                    ? "Nueva Inversión del Hogar"
                    : "Nueva Inversión"}
                </h2>
                <p className="text-[11px] text-zinc-400">
                  CEDEARs, Acciones, Fondos Comunes (FCI) y Cripto
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                triggerHaptic(6);
                onClose();
              }}
              className="p-2 rounded-full text-zinc-400 hover:text-white bg-white/[0.06] hover:bg-white/[0.12] active:scale-95 transition"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Selector de Modo en la cabecera fija */}
          <div className="flex bg-zinc-900/90 p-1 rounded-xl border border-white/[0.08] mt-3">
            <button
              type="button"
              onClick={() => {
                triggerHaptic(8);
                setActiveMode("search");
                setValuationMode("units");
                if (MANUAL_ASSET_TYPES.includes(assetType)) {
                  setAssetType("CEDEAR");
                }
                if (quantity === "1" && !investmentToEdit) {
                  setQuantity("");
                }
              }}
              className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-semibold transition ${
                activeMode === "search"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Bolsa (CEDEAR / Acción)
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic(8);
                setActiveMode("manual");
                if (!MANUAL_ASSET_TYPES.includes(assetType)) {
                  setAssetType("FCI");
                }
                if (!quantity) {
                  setQuantity("1");
                  setValuationMode("total");
                }
              }}
              className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-semibold transition ${
                activeMode === "manual"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Fondo Común (FCI) / PF
            </button>
          </div>
        </div>

        {/* CUERPO SCROLLEABLE */}
        <form
          id="investment-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-4 py-3.5 space-y-3"
        >
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* MODO 1: BÚSQUEDA AUTOMÁTICA DE BOLSA */}
          {activeMode === "search" && (
            <div className="space-y-2">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar ticker o empresa (ej: Apple, SPY, Galicia, BTC)..."
                  className="w-full bg-zinc-900/90 border border-white/[0.12] rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition"
                />
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
                {isSearching && (
                  <span className="text-[10px] text-indigo-400 absolute right-3 top-2.5 animate-pulse">
                    Buscando...
                  </span>
                )}
              </div>

              {/* Resultados de búsqueda */}
              {searchResults.length > 0 && (
                <div className="bg-zinc-900 border border-white/[0.14] rounded-2xl p-1.5 max-h-44 overflow-y-auto space-y-1 shadow-2xl">
                  {searchResults.map((item) => (
                    <button
                      key={item.ticker}
                      type="button"
                      onClick={() => handleSelectAsset(item)}
                      className="w-full text-left p-2 rounded-xl hover:bg-white/[0.08] active:scale-[0.99] transition flex items-center justify-between"
                    >
                      <div className="truncate mr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-white font-mono">
                            {item.ticker}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/[0.08] text-zinc-300">
                            {item.assetType}
                          </span>
                        </div>
                        <span className="text-[11px] text-zinc-400 truncate block">
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

              {/* Atajos rápidos en tira horizontal deslizable */}
              {!searchQuery && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                    {[
                      { id: "ALL", label: "Populares" },
                      { id: "CEDEAR", label: "CEDEARs" },
                      { id: "ACCION", label: "Acciones AR" },
                      { id: "BONO", label: "Bonos" },
                      { id: "CRYPTO", label: "Cripto" },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() =>
                          setPopularFilter(tab.id as typeof popularFilter)
                        }
                        className={`text-[10px] px-2.5 py-1 rounded-lg font-semibold shrink-0 transition ${
                          popularFilter === tab.id
                            ? "bg-indigo-500/25 text-indigo-300 border border-indigo-500/40"
                            : "bg-white/[0.04] text-zinc-400"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
                    {filteredPopularAssets.map((asset) => {
                      const isSelected = ticker === asset.ticker;
                      return (
                        <button
                          key={asset.ticker}
                          type="button"
                          onClick={() => handleSelectAsset(asset)}
                          className={`px-2.5 py-1.5 rounded-xl border text-xs font-medium shrink-0 active:scale-95 transition flex items-center gap-1.5 ${
                            isSelected
                              ? "bg-indigo-600/30 border-indigo-400 text-white"
                              : "bg-white/[0.04] border-white/[0.08] text-zinc-200"
                          }`}
                        >
                          <span className="font-mono font-bold text-indigo-300">
                            {asset.ticker.replace(".BA", "")}
                          </span>
                          <span className="text-[11px] text-zinc-400">
                            {asset.name.split(" (")[0]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MODO 2: FCI (CON BUSCADOR OFICIAL CAFCI) / PLAZO FIJO / MANUAL */}
          {activeMode === "manual" && (
            <div className="space-y-2.5 bg-emerald-950/20 border border-emerald-500/20 rounded-2xl p-3">
              {/* Selector de instrumento en fila deslizable */}
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                {[
                  { id: "FCI", label: "Fondo Común (FCI)" },
                  { id: "PLAZO_FIJO", label: "Plazo Fijo / Caución" },
                  { id: "ON", label: "Oblig. Negociable" },
                  { id: "BONO", label: "Bono / LECAP" },
                  { id: "OTRO", label: "Otro / Liquidez" },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      triggerHaptic(6);
                      setAssetType(t.id);
                    }}
                    className={`py-1.5 px-2.5 rounded-xl text-[11px] font-semibold border shrink-0 transition active:scale-95 ${
                      assetType === t.id
                        ? "bg-emerald-600 text-white border-emerald-400"
                        : "bg-zinc-900/80 text-zinc-300 border-white/[0.08]"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* BUSCADOR OFICIAL DE FONDOS COMUNES (CAFCI) */}
              {assetType === "FCI" && (
                <div className="space-y-2">
                  <div className="relative">
                    <input
                      type="text"
                      value={fciSearchQuery}
                      onChange={(e) => setFciSearchQuery(e.target.value)}
                      placeholder="Buscar FCI o Banco (ej: Fima, Balanz, Galicia, Santander, Cocos)..."
                      className="w-full bg-zinc-950/90 border border-emerald-500/35 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-400 focus:outline-none focus:border-emerald-400 transition"
                    />
                    <Search className="w-4 h-4 text-emerald-400 absolute left-3 top-2" />
                    {isSearchingFci && (
                      <span className="text-[10px] text-emerald-300 absolute right-3 top-2.5 animate-pulse">
                        Buscando CAFCI...
                      </span>
                    )}
                  </div>

                  {/* Resultados en vivo del padrón CAFCI con Valor de Cuotaparte */}
                  {fciSearchResults.length > 0 && (
                    <div className="bg-zinc-950 border border-emerald-500/30 rounded-2xl p-1.5 max-h-48 overflow-y-auto space-y-1 shadow-2xl">
                      {fciSearchResults.map((fund) => (
                        <button
                          key={`${fund.name}_${fund.ticker}`}
                          type="button"
                          onClick={() => handleSelectCafciFund(fund)}
                          className="w-full text-left p-2 rounded-xl hover:bg-emerald-500/15 active:scale-[0.99] transition flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <span className="font-bold text-xs text-white block truncate">
                              {fund.name}
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className="text-[10px] font-semibold text-emerald-300">
                                {fund.broker}
                              </span>
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/[0.08] text-zinc-300">
                                {fund.category}
                              </span>
                            </div>
                          </div>
                          {fund.vcpUnit > 0 && (
                            <div className="text-right shrink-0">
                              <span className="text-[10px] text-zinc-400 block">
                                Cuotaparte
                              </span>
                              <span className="text-xs font-mono font-bold text-emerald-400">
                                {fund.currency === "USD" ? "u$s" : "$"}
                                {fund.vcpUnit.toLocaleString("es-AR", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 4,
                                })}
                              </span>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Tira horizontal deslizable de FCIs Populares cuando no está escribiendo */}
                  {!fciSearchQuery && (
                    <div>
                      <span className="text-[10px] font-bold text-emerald-300/90 uppercase tracking-wider block mb-1">
                        O elegí un Fondo rápido (deslizá →):
                      </span>
                      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
                        {POPULAR_ARGENTINA_FCIS.map((fci) => {
                          const isSelected =
                            ticker === fci.ticker || name === fci.name;
                          return (
                            <button
                              key={fci.ticker}
                              type="button"
                              onClick={() => handleSelectFciPreset(fci)}
                              className={`px-2.5 py-1.5 rounded-xl border shrink-0 transition active:scale-95 flex items-center gap-1.5 ${
                                isSelected
                                  ? "bg-emerald-500/30 border-emerald-400 text-white"
                                  : "bg-zinc-900/90 border-white/[0.08] text-zinc-200"
                              }`}
                            >
                              <PiggyBank className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span className="text-xs font-semibold">
                                {fci.name.split(" (")[0]}
                              </span>
                              <span className="text-[10px] text-emerald-300/80">
                                • {fci.broker}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Nombre, Ticker y Moneda */}
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-3 space-y-2.5">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                  {assetType === "FCI"
                    ? "Nombre Oficial del Fondo Común"
                    : "Nombre del Activo"}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (
                      activeMode === "manual" &&
                      (!ticker ||
                        ticker.startsWith("FCI-") ||
                        ticker.startsWith("PF-") ||
                        ticker.startsWith("ACT-"))
                    ) {
                      setTicker(generateAutoTicker(e.target.value, assetType));
                    }
                  }}
                  placeholder={
                    assetType === "FCI"
                      ? "Ej: Fima Premium - Clase A"
                      : "Ej: Apple Inc. (CEDEAR)"
                  }
                  required
                  className="w-full bg-zinc-900 border border-white/[0.1] rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="col-span-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                  Moneda
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/[0.1] rounded-xl px-2 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="ARS">ARS ($)</option>
                  <option value="USD">USD (u$s)</option>
                </select>
              </div>
            </div>

            {/* Tarjeta de Valor de Cuotaparte Oficial (CAFCI) para FCI */}
            {assetType === "FCI" && (
              <div className="p-2.5 rounded-xl bg-emerald-950/35 border border-emerald-500/25 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider block">
                      Valor de Cuotaparte Oficial (CAFCI)
                    </span>
                    {fciLiveQuote && fciLiveQuote.vcpUnit > 0 ? (
                      <span className="text-[10px] text-zinc-400 block truncate">
                        {fciLiveQuote.name} ({fciLiveQuote.date})
                      </span>
                    ) : (
                      <span className="text-[10px] text-zinc-400 block">
                        Buscá el fondo arriba o consultá su última cuotaparte
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic(6);
                      const ref =
                        parseFloat(manualPrice.replace(",", ".")) || null;
                      lookupFciQuote(name || ticker, ref, true);
                    }}
                    disabled={isLoadingFciQuote || (!name.trim() && !ticker.trim())}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-200 text-[10px] font-bold flex items-center gap-1 shrink-0 active:scale-95 transition disabled:opacity-40"
                  >
                    <RefreshCw
                      className={`w-3 h-3 ${
                        isLoadingFciQuote ? "animate-spin" : ""
                      }`}
                    />
                    <span>
                      {isLoadingFciQuote ? "Consultando..." : "Actualizar VCP"}
                    </span>
                  </button>
                </div>

                {fciLiveQuote && fciLiveQuote.vcpUnit > 0 && (
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic(6);
                        setValuationMode("units");
                        setManualPrice(String(fciLiveQuote.vcpUnit));
                      }}
                      className={`p-1.5 rounded-lg border text-left transition active:scale-95 ${
                        valuationMode === "units" &&
                        Number(manualPrice) === fciLiveQuote.vcpUnit
                          ? "bg-emerald-500/30 border-emerald-400 text-white"
                          : "bg-black/40 border-white/[0.08] text-zinc-300 hover:bg-white/[0.06]"
                      }`}
                    >
                      <span className="text-[9px] text-emerald-300 font-semibold block">
                        Usar VCP Unitario (1 cuot.)
                      </span>
                      <span className="text-xs font-mono font-bold text-white">
                        {fciLiveQuote.currency === "USD" ? "u$s " : "$"}
                        {fciLiveQuote.vcpUnit.toLocaleString("es-AR", {
                          minimumFractionDigits: 4,
                          maximumFractionDigits: 6,
                        })}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic(6);
                        setValuationMode("units");
                        setManualPrice(String(fciLiveQuote.vcpPer1000));
                      }}
                      className={`p-1.5 rounded-lg border text-left transition active:scale-95 ${
                        valuationMode === "units" &&
                        Number(manualPrice) === fciLiveQuote.vcpPer1000
                          ? "bg-emerald-500/30 border-emerald-400 text-white"
                          : "bg-black/40 border-white/[0.08] text-zinc-300 hover:bg-white/[0.06]"
                      }`}
                    >
                      <span className="text-[9px] text-emerald-300 font-semibold block">
                        Usar VCP c/1.000 cuot.
                      </span>
                      <span className="text-xs font-mono font-bold text-white">
                        {fciLiveQuote.currency === "USD" ? "u$s " : "$"}
                        {fciLiveQuote.vcpPer1000.toLocaleString("es-AR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 4,
                        })}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeMode === "search" && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                    Ticker Bursátil
                  </label>
                  <input
                    type="text"
                    value={ticker}
                    onChange={(e) => setTicker(e.target.value.toUpperCase())}
                    onBlur={() => {
                      if (ticker.trim()) fetchQuoteForTicker(ticker.trim());
                    }}
                    placeholder="AAPL.BA"
                    required
                    className="w-full bg-zinc-900 border border-white/[0.1] rounded-xl px-2.5 py-2 text-xs font-mono font-bold text-white uppercase focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                    Tipo
                  </label>
                  <select
                    value={assetType}
                    onChange={(e) => setAssetType(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/[0.1] rounded-xl px-2 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="CEDEAR">CEDEAR</option>
                    <option value="ACCION">Acción</option>
                    <option value="BONO">Bono / Título</option>
                    <option value="ON">Oblig. Negociable</option>
                    <option value="CRYPTO">Cripto</option>
                    <option value="FCI">Fondo Común (FCI)</option>
                  </select>
                </div>
              </div>
            )}

            {/* Cotización detectada */}
            {activeMode === "search" && previewPrice !== null && (
              <div className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
                <span>
                  En vivo:{" "}
                  <strong className="font-mono text-white">
                    {currency === "USD" ? "u$s" : "$"}{" "}
                    {previewPrice.toLocaleString("es-AR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 4,
                    })}
                  </strong>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(6);
                    setBuyPrice(String(previewPrice));
                  }}
                  className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-indigo-500/25 text-indigo-200 active:scale-95"
                >
                  Usar en P. Compra
                </button>
              </div>
            )}
            {isLoadingQuote && (
              <p className="text-[10px] text-zinc-400 animate-pulse text-center">
                Consultando cotización...
              </p>
            )}
          </div>

          {/* Selector de forma de carga para FCI / Manual */}
          {activeMode === "manual" && (
            <div className="flex bg-zinc-900/80 p-1 rounded-xl border border-white/[0.06]">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(6);
                  setValuationMode("units");
                  if (quantity === "1" && !investmentToEdit) {
                    setQuantity("");
                  }
                  if (fciLiveQuote && fciLiveQuote.vcpUnit > 0) {
                    setManualPrice(String(fciLiveQuote.vcpUnit));
                  }
                }}
                className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-semibold transition ${
                  valuationMode === "units"
                    ? "bg-emerald-600/30 text-emerald-200 border border-emerald-500/40"
                    : "text-zinc-400"
                }`}
              >
                Por Cuotapartes + VCP
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(6);
                  if (valuationMode === "units") {
                    const q = parseFloat(quantity.replace(",", ".")) || 1;
                    const mp = parseFloat(manualPrice.replace(",", ".")) || 0;
                    const bp = parseFloat(buyPrice.replace(",", ".")) || 0;
                    if (mp > 0 && q !== 1) {
                      setManualPrice(String(Math.round(q * mp * 100) / 100));
                    }
                    if (bp > 0 && q !== 1) {
                      setBuyPrice(String(Math.round(q * bp * 100) / 100));
                    }
                    setQuantity("1");
                  }
                  setValuationMode("total");
                }}
                className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-semibold transition ${
                  valuationMode === "total"
                    ? "bg-white/[0.12] text-white"
                    : "text-zinc-400"
                }`}
              >
                Por Saldo Total ($)
              </button>
            </div>
          )}

          {/* Campos de Monto / Cantidad */}
          {isDirectTotalMode ? (
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider block mb-1">
                  Saldo Actual ({currency === "USD" ? "u$s" : "$"})
                </label>
                <input
                  type="number"
                  step="any"
                  value={manualPrice}
                  onChange={(e) => setManualPrice(e.target.value)}
                  placeholder="Ej: 850000"
                  required
                  className="w-full bg-zinc-900 border border-emerald-500/40 rounded-xl px-3 py-2.5 text-sm font-mono font-bold text-white focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block mb-1">
                  Invertido Inicial (Opc.)
                </label>
                <input
                  type="number"
                  step="any"
                  value={buyPrice}
                  onChange={(e) => setBuyPrice(e.target.value)}
                  placeholder="Para ver ganancia"
                  className="w-full bg-zinc-900 border border-white/[0.1] rounded-xl px-3 py-2.5 text-sm font-mono text-zinc-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block mb-1">
                    {assetType === "FCI"
                      ? "Cant. Cuotapartes"
                      : "Cantidad (Nominales)"}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder={assetType === "FCI" ? "Ej: 1250.45" : "Ej: 10"}
                    required
                    className="w-full bg-zinc-900 border border-white/[0.1] rounded-xl px-3 py-2.5 text-sm font-mono font-bold text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block mb-1">
                    {assetType === "FCI"
                      ? "VCP Compra (Opc.)"
                      : "Precio Compra (Opc.)"}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={buyPrice}
                    onChange={(e) => setBuyPrice(e.target.value)}
                    placeholder="Opcional P&L"
                    className="w-full bg-zinc-900 border border-white/[0.1] rounded-xl px-3 py-2.5 text-sm font-mono text-zinc-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {(activeMode === "manual" || assetType === "FCI" || !previewPrice) && (
                <div>
                  <label className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider block mb-1">
                    {assetType === "FCI"
                      ? `Valor de la Cuotaparte Actual (${
                          currency === "USD" ? "u$s" : "$"
                        })`
                      : "Precio Unitario Actual (Manual)"}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={manualPrice}
                    onChange={(e) => setManualPrice(e.target.value)}
                    placeholder="Valor actual por unidad / cuotaparte"
                    className="w-full bg-zinc-900 border border-emerald-500/40 rounded-xl px-3 py-2 text-sm font-mono font-bold text-white focus:outline-none focus:border-emerald-400"
                  />
                </div>
              )}
            </div>
          )}

          {/* Banco / Broker */}
          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
              Banco / Broker / Entidad (Opcional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Banco Galicia, Balanz, IOL, Cocos, Santander..."
              className="w-full bg-zinc-900 border border-white/[0.1] rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </form>

        {/* PIE FIJO SIEMPRE VISIBLE EN MOBILE */}
        <div
          className="shrink-0 px-4 pt-3 pb-4 border-t border-white/[0.08] bg-zinc-950/90 space-y-2.5"
          style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom, 16px))" }}
        >
          {estimatedTotal > 0 && (
            <div className="px-3 py-2 rounded-xl bg-indigo-950/50 border border-indigo-500/30 flex items-center justify-between">
              <span className="text-[11px] font-medium text-indigo-200">
                Total estimado:
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-base font-extrabold text-white font-mono tabular-nums">
                  {currency === "USD" ? "u$s" : "$"}{" "}
                  {Math.round(estimatedTotal).toLocaleString("es-AR")}
                </span>
                {estimatedDiff !== null && (
                  <span
                    className={`text-[10px] font-mono font-bold ${
                      estimatedDiff >= 0 ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    ({estimatedDiff >= 0 ? "+" : ""}
                    {Math.round(estimatedDiff).toLocaleString("es-AR")})
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-semibold text-zinc-300 active:scale-95 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="investment-form"
              disabled={isSubmitting}
              className="flex-[1.4] min-h-[44px] py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 active:scale-95 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? "Guardando..."
                  : investmentToEdit
                  ? "Guardar Cambios"
                  : "Guardar Inversión"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
