"use client";

import React, { useState } from "react";
import { useDevice, DevicePreference } from "@/lib/use-device";
import { Smartphone, Tablet, Monitor, Sparkles, Check, ChevronDown } from "./ui/icons";
import { triggerHaptic } from "@/lib/haptics";

interface DeviceModeSelectorProps {
  compact?: boolean;
  className?: string;
}

export function DeviceModeSelector({ compact = false, className = "" }: DeviceModeSelectorProps) {
  const { device, preference, detectedDevice, setPreference } = useDevice();
  const [isOpen, setIsOpen] = useState(false);

  const options: Array<{
    id: DevicePreference;
    label: string;
    sublabel: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      id: "auto",
      label: "Automático",
      sublabel: `Detectado: ${detectedDevice === "mobile" ? "Móvil" : detectedDevice === "ipad" ? "iPad" : "Escritorio"}`,
      icon: Sparkles,
    },
    {
      id: "mobile",
      label: "Móvil",
      sublabel: "Optimizado teléfono",
      icon: Smartphone,
    },
    {
      id: "ipad",
      label: "iPad / Tablet",
      sublabel: "Pantalla completa iPadOS",
      icon: Tablet,
    },
    {
      id: "desktop",
      label: "Escritorio PC",
      sublabel: "Barra lateral y multicolumna",
      icon: Monitor,
    },
  ];

  const currentOption = options.find((o) => o.id === preference) || options[0];
  const CurrentIcon =
    device === "desktop"
      ? Monitor
      : device === "ipad"
      ? Tablet
      : Smartphone;

  if (compact) {
    return (
      <div className={`relative ${className}`}>
        <button
          type="button"
          onClick={() => {
            triggerHaptic(6);
            setIsOpen(!isOpen);
          }}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900/90 hover:bg-zinc-800 border border-white/[0.08] text-zinc-300 hover:text-white transition active:scale-95 text-xs font-medium"
          title={`Vista actual: ${device.toUpperCase()} (${preference === "auto" ? "Automático" : "Manual"})`}
        >
          <CurrentIcon className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span className="capitalize tracking-tight">
            {preference === "auto" ? `${device === "desktop" ? "Escritorio" : device === "ipad" ? "iPad" : "Móvil"} (Auto)` : currentOption.label}
          </span>
          <ChevronDown className="w-3 h-3 text-zinc-500 shrink-0" />
        </button>

        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute right-0 top-full mt-2 w-56 apple-glass-sheet border border-white/[0.14] rounded-2xl p-2 shadow-2xl z-50 animate-fade-in space-y-1">
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Dispositivo de visualización
              </div>
              {options.map((opt) => {
                const isSelected = preference === opt.id;
                const IconComponent = opt.icon;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      triggerHaptic(8);
                      setPreference(opt.id);
                      setIsOpen(false);
                    }}
                    className={`w-full px-2.5 py-1.5 rounded-xl text-left flex items-center justify-between transition ${
                      isSelected
                        ? "bg-blue-600/20 text-blue-300 border border-blue-500/30 font-semibold"
                        : "text-zinc-300 hover:bg-white/[0.05]"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <IconComponent
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isSelected ? "text-blue-400" : "text-zinc-400"
                        }`}
                      />
                      <div className="min-w-0">
                        <span className="text-xs block leading-tight">{opt.label}</span>
                        <span className="text-[10px] text-zinc-400 block truncate">
                          {opt.sublabel}
                        </span>
                      </div>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
          Adaptación de pantalla
        </span>
        <span className="text-[10px] text-blue-400 font-mono font-medium">
          {preference === "auto" ? "Detección Auto" : "Modo Manual"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-zinc-900/80 border border-white/[0.08]">
        {options.map((opt) => {
          const isSelected = preference === opt.id;
          const IconComponent = opt.icon;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                triggerHaptic(8);
                setPreference(opt.id);
              }}
              className={`p-2 rounded-xl text-left transition flex items-center gap-2 ${
                isSelected
                  ? "bg-blue-600 text-white font-bold shadow-sm"
                  : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
              }`}
            >
              <IconComponent className="w-4 h-4 shrink-0" />
              <div className="min-w-0">
                <span className="text-xs block leading-none">{opt.label}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
