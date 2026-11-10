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
import {
  POPULAR_ARGENTINA_ASSETS,
  POPULAR_ARGENTINA_FCIS,
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
  const [activeMode, setActiveMode] = useState<"search" | "manual">("search");
  const [popularFilter, setPopularFilter] = useState<
    "ALL" | "CEDEAR" | "ACCION" | "BONO" | "CRYPTO"
  >("ALL");

  // Para FCI / Plazo Fijo / Manual: permitir cargar por "Monto Total Directo" (quantity = 1) o por "Cuotapartes / Nominales"
  const [valuationMode, setValuationMode] = useState<"total" | "units">("total");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<any>>([]);
  const [isSearching, setIsSearching] = useState(false);

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

      if (investmentToEdit.manualPrice) {
        setPreviewPrice(investmentToEdit.manualPrice);
      } else if (!isManualType) {
        fetchQuoteForTicker(investmentToEdit.ticker);
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
      setActiveMode(startInManual ? "manual" : "search");
      setValuationMode(startInManual ? "total" : "units");
    }
  }, [investmentToEdit, isOpen, defaultAssetType]);

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
    }, 320);

    return () => clearTimeout(timer);
  }, [searchQuery, activeMode]);

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
      setValuationMode("total");
      setQuantity("1");
      setPreviewPrice(null);
    } else {
      setValuationMode("units");
      if (quantity === "1" && !investmentToEdit) {
        setQuantity("");
      }
      fetchQuoteForTicker(item.ticker);
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
      setErrorMsg("Ingresá una cantidad válida.");
      return;
    }

    if (
      activeMode === "manual" &&
      (!cleanManualPrice || cleanManualPrice <= 0) &&
      (!cleanBuyPrice || cleanBuyPrice <= 0)
    ) {
      setErrorMsg("Ingresá el saldo o valor actual de la inversión.");
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

  if (!isOpen) return null;

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
      ? POPULAR_ARGENTINA_ASSETS.slice(0, 12)
      : POPULAR_ARGENTINA_ASSETS.filter((a) => a.assetType === popularFilter);

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
                {investmentToEdit
                  ? "Editar / Actualizar Inversión"
                  : householdId
                  ? "Nueva Inversión del Hogar"
                  : "Nueva Inversión Personal"}
              </h2>
              <p className="text-[11px] text-zinc-400">
                FCIs, CEDEARs, Acciones, Bonos, ONs, Plazo Fijo y Cripto
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              triggerHaptic(6);
              onClose();
            }}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] active:scale-95 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Selector de Modo: Bolsa Automática vs FCI / Renta Fija Manual */}
        <div className="flex bg-zinc-900/90 p-1 rounded-2xl border border-white/[0.08] mt-3.5 mb-1">
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
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition ${
              activeMode === "search"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Acciones / CEDEARs / Cripto
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
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition ${
              activeMode === "manual"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Fondo Común (FCI) / Manual
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-3 space-y-3.5">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* ===================================================== */}
          {/* MODO 1: BÚSQUEDA AUTOMÁTICA (CEDEARS, ACCIONES, ETC.) */}
          {/* ===================================================== */}
          {activeMode === "search" && (
            <div className="space-y-2.5">
              <div>
                <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block mb-1">
                  Buscar Activo (Cotización en Vivo)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Ej: Apple, SPY, MELI, Galicia, YPF, AL30, Bitcoin..."
                    className="w-full bg-zinc-900/90 border border-white/[0.1] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition"
                  />
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
                  {isSearching && (
                    <span className="text-[10px] text-indigo-400 absolute right-3 top-2.5 animate-pulse">
                      Buscando...
                    </span>
                  )}
                </div>
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

              {/* Atajos Populares en Argentina con filtro por tipo */}
              {!searchQuery && (
                <div className="space-y-2 pt-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-zinc-400 font-semibold">
                      Elegir rápido del mercado:
                    </span>
                    <div className="flex gap-1">
                      {[
                        { id: "ALL", label: "Todos" },
                        { id: "CEDEAR", label: "CEDEARs" },
                        { id: "ACCION", label: "Acciones" },
                        { id: "BONO", label: "Bonos" },
                        { id: "CRYPTO", label: "Cripto" },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() =>
                            setPopularFilter(tab.id as typeof popularFilter)
                          }
                          className={`text-[10px] px-2 py-0.5 rounded-lg font-semibold transition ${
                            popularFilter === tab.id
                              ? "bg-indigo-500/25 text-indigo-300 border border-indigo-500/40"
                              : "bg-white/[0.04] text-zinc-400 hover:text-zinc-200"
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto no-scrollbar">
                    {filteredPopularAssets.map((asset) => {
                      const isSelected = ticker === asset.ticker;
                      return (
                        <button
                          key={asset.ticker}
                          type="button"
                          onClick={() => handleSelectAsset(asset)}
                          className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium active:scale-95 transition flex items-center gap-1 ${
                            isSelected
                              ? "bg-indigo-600/30 border-indigo-400 text-white"
                              : "bg-white/[0.04] hover:bg-white/[0.09] border-white/[0.08] text-zinc-200"
                          }`}
                        >
                          <span className="font-mono font-bold text-indigo-300">
                            {asset.ticker.replace(".BA", "")}
                          </span>
                          <span className="text-[10px] text-zinc-400 truncate max-w-[95px]">
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

          {/* ===================================================== */}
          {/* MODO 2: FCI / PLAZO FIJO / OBLIGACIÓN NEGOCIABLE      */}
          {/* ===================================================== */}
          {activeMode === "manual" && (
            <div className="space-y-3 bg-emerald-950/20 border border-emerald-500/20 rounded-2xl p-3.5">
              {/* Tipo de Instrumento */}
              <div>
                <label className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider block mb-1.5">
                  Tipo de Inversión
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: "FCI", label: "Fondo Común (FCI)" },
                    { id: "PLAZO_FIJO", label: "Plazo Fijo / Caución" },
                    { id: "ON", label: "Oblig. Negociable" },
                    { id: "BONO", label: "Bono / LECAP" },
                    { id: "CEDEAR", label: "CEDEAR / Acción" },
                    { id: "OTRO", label: "Otro / Liquidez" },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        triggerHaptic(6);
                        setAssetType(t.id);
                      }}
                      className={`py-1.5 px-2 rounded-xl text-[11px] font-semibold border transition active:scale-95 ${
                        assetType === t.id
                          ? "bg-emerald-600 text-white border-emerald-400 shadow-sm"
                          : "bg-zinc-900/80 text-zinc-300 border-white/[0.08] hover:bg-white/[0.06]"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Atajos de Fondos Comunes de Inversión (FCIs) en Argentina */}
              {assetType === "FCI" && (
                <div>
                  <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider block mb-1.5">
                    ¿En qué Fondo Común está? (Elegir o escribir abajo)
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto no-scrollbar">
                    {POPULAR_ARGENTINA_FCIS.map((fci) => {
                      const isSelected =
                        ticker === fci.ticker || name === fci.name;
                      return (
                        <button
                          key={fci.ticker}
                          type="button"
                          onClick={() => handleSelectFciPreset(fci)}
                          className={`px-2.5 py-1 rounded-xl border text-left transition active:scale-95 flex items-center gap-1.5 ${
                            isSelected
                              ? "bg-emerald-500/30 border-emerald-400 text-white"
                              : "bg-zinc-900/90 hover:bg-white/[0.08] border-white/[0.08] text-zinc-200"
                          }`}
                        >
                          <PiggyBank className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span className="text-[11px] font-semibold">
                            {fci.name.split(" (")[0]}
                          </span>
                          <span className="text-[10px] text-emerald-300/80 font-medium">
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

          {/* Datos Principales del Activo */}
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-3.5 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                  {assetType === "FCI"
                    ? "Nombre del Fondo Común"
                    : "Nombre del Activo / Empresa"}
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
                      ? "Ej: Fima Premium Clase A"
                      : assetType === "PLAZO_FIJO"
                      ? "Ej: Caución Bursátil 30 días"
                      : "Ej: Apple Inc. (CEDEAR)"
                  }
                  required
                  className="w-full bg-zinc-900 border border-white/[0.1] rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="col-span-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                  {activeMode === "manual" ? "Código" : "Ticker"}
                </label>
                <input
                  type="text"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  onBlur={() => {
                    if (ticker.trim() && activeMode === "search") {
                      fetchQuoteForTicker(ticker.trim());
                    }
                  }}
                  placeholder={assetType === "FCI" ? "FCI-FIMA" : "AAPL.BA"}
                  required={activeMode === "search"}
                  className="w-full bg-zinc-900 border border-white/[0.1] rounded-xl px-2.5 py-2 text-xs font-mono font-bold text-white uppercase focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                  Categoría
                </label>
                <select
                  value={assetType}
                  onChange={(e) => setAssetType(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/[0.1] rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="FCI">Fondo Común (FCI)</option>
                  <option value="CEDEAR">CEDEAR</option>
                  <option value="ACCION">Acción Local / Global</option>
                  <option value="BONO">Bono / Título Público</option>
                  <option value="ON">Obligación Negociable (ON)</option>
                  <option value="PLAZO_FIJO">Plazo Fijo / Caución</option>
                  <option value="CRYPTO">Criptomoneda</option>
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
            {activeMode === "search" && previewPrice !== null && (
              <div className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
                <div>
                  <span className="text-[11px] block">Cotización de mercado:</span>
                  <span className="font-bold font-mono text-sm text-white">
                    {currency === "USD" ? "u$s" : "$"}{" "}
                    {previewPrice.toLocaleString("es-AR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 4,
                    })}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(6);
                    setBuyPrice(String(previewPrice));
                  }}
                  className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/30 text-indigo-200 transition active:scale-95"
                >
                  Usar como P. Compra
                </button>
              </div>
            )}
            {isLoadingQuote && (
              <p className="text-[10px] text-zinc-400 animate-pulse text-center">
                Consultando cotización en vivo...
              </p>
            )}
          </div>

          {/* Selector de forma de carga para FCI / Manual: Por Monto Total vs Por Cuotapartes */}
          {activeMode === "manual" && (
            <div className="flex bg-zinc-900/80 p-1 rounded-xl border border-white/[0.06]">
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
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Cargar por Saldo Total ($)
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(6);
                  setValuationMode("units");
                }}
                className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-semibold transition ${
                  valuationMode === "units"
                    ? "bg-white/[0.12] text-white"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Por Cuotapartes / Nominales
              </button>
            </div>
          )}

          {/* Campos de Valuación según el modo elegido */}
          {isDirectTotalMode ? (
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider block mb-1">
                  Saldo / Valor Actual ({currency === "USD" ? "u$s" : "$"})
                </label>
                <input
                  type="number"
                  step="any"
                  value={manualPrice}
                  onChange={(e) => setManualPrice(e.target.value)}
                  placeholder="Ej: 850000"
                  required
                  className="w-full bg-zinc-900 border border-emerald-500/40 rounded-xl px-3 py-2 text-sm font-mono font-bold text-white focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block mb-1">
                  Capital Invertido (Opcional)
                </label>
                <input
                  type="number"
                  step="any"
                  value={buyPrice}
                  onChange={(e) => setBuyPrice(e.target.value)}
                  placeholder="Para ver ganancia"
                  className="w-full bg-zinc-900 border border-white/[0.1] rounded-xl px-3 py-2 text-sm font-mono text-zinc-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block mb-1">
                    {assetType === "FCI"
                      ? "Cantidad Cuotapartes"
                      : "Cantidad (Nominales)"}
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

              {(activeMode === "manual" ||
                assetType === "FCI" ||
                !previewPrice) && (
                <div>
                  <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block mb-1 flex items-center justify-between">
                    <span>Precio Unitario Actual (Manual)</span>
                    <span className="text-[10px] font-normal text-zinc-400">
                      {assetType === "FCI"
                        ? "Valor de cuotaparte hoy"
                        : "Precio actual si no cotiza en vivo"}
                    </span>
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
            </>
          )}

          {/* Notas / Broker / Banco */}
          <div>
            <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
              Entidad / Broker / Notas (Opcional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Banco Galicia, Balanz, IOL, Cocos, Santander..."
              className="w-full bg-zinc-900 border border-white/[0.1] rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Resumen Estimado */}
          {estimatedTotal > 0 && (
            <div className="p-3 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-indigo-300 block">
                  Valuación Total Estimada
                </span>
                <span className="text-xs text-zinc-400">
                  {isDirectTotalMode
                    ? "Saldo directo actualizable"
                    : `${numQuantity} ${
                        assetType === "FCI" ? "cuotapartes" : "nominales"
                      }`}
                </span>
              </div>
              <div className="text-right">
                <span className="text-lg font-extrabold text-white font-mono tabular-nums block">
                  {currency === "USD" ? "u$s" : "$"}{" "}
                  {Math.round(estimatedTotal).toLocaleString("es-AR")}
                </span>
                {estimatedDiff !== null && (
                  <span
                    className={`text-[10px] font-mono font-bold ${
                      estimatedDiff >= 0 ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {estimatedDiff >= 0 ? "+" : ""}
                    {currency === "USD" ? "u$s" : "$"}
                    {Math.round(estimatedDiff).toLocaleString("es-AR")} rend.
                  </span>
                )}
              </div>
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
              <span>
                {isSubmitting
                  ? "Guardando..."
                  : investmentToEdit
                  ? "Guardar Cambios"
                  : "Guardar Inversión"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
