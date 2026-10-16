"use client";

import React from "react";

interface AppSplashScreenProps {
  message?: string;
}

export function AppSplashScreen({ message = "Iniciando tu espacio financiero..." }: AppSplashScreenProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-[#090c12] text-zinc-100 select-none overflow-hidden px-6 pt-safe pb-safe">
      {/* Luces ambientales de fondo */}
      <div className="absolute top-1/4 -translate-y-1/2 w-80 h-80 bg-purple-600/15 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/3 w-72 h-72 bg-blue-600/10 rounded-full blur-[90px] pointer-events-none" />

      {/* Espaciador superior */}
      <div className="w-full pt-12" />

      {/* Núcleo central de marca y animación */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-xs -mt-10">
        {/* Contenedor del icono con halo luminoso */}
        <div className="relative mb-6">
          <div className="absolute -inset-3 bg-gradient-to-tr from-purple-600/30 via-indigo-500/20 to-blue-500/30 rounded-[32px] blur-xl opacity-75 animate-pulse" />
          
          <div className="relative w-24 h-24 rounded-3xl p-1 bg-gradient-to-b from-white/20 to-white/5 shadow-2xl shadow-purple-950/60 ring-1 ring-white/20 flex items-center justify-center overflow-hidden">
            <img
              src="/icon-192.png"
              alt="Finanzas Hogar"
              className="w-full h-full object-cover rounded-[22px] shadow-inner"
            />
          </div>

          {/* Anillo orbital de brillo */}
          <div className="absolute -inset-1 rounded-[28px] border border-purple-400/30 animate-spin [animation-duration:8s] pointer-events-none" />
        </div>

        {/* Título y Badge */}
        <h1 className="text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white via-zinc-100 to-zinc-400">
          Finanzas Hogar
        </h1>
        <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.1] shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-[11px] font-medium text-zinc-300 tracking-wide uppercase">
            Fondo 60% & Pareja
          </span>
        </div>

        {/* Barra de progreso shimmer */}
        <div className="w-48 h-1.5 bg-white/[0.08] rounded-full overflow-hidden mt-8 relative border border-white/[0.06]">
          <div className="absolute inset-y-0 w-24 bg-gradient-to-r from-transparent via-purple-400 to-transparent animate-[shimmer_1.4s_infinite_linear]" />
        </div>

        {/* Texto de estado */}
        <p className="mt-3.5 text-xs text-zinc-400 font-medium tracking-wide">
          {message}
        </p>
      </div>

      {/* Mini Esqueleto / Silueta inferior representativa del Dashboard */}
      <div className="w-full max-w-sm space-y-2.5 opacity-40 pb-6 pointer-events-none">
        <div className="h-16 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-between px-4 animate-pulse">
          <div className="space-y-1.5">
            <div className="w-20 h-2.5 rounded-full bg-white/10" />
            <div className="w-32 h-4 rounded-full bg-white/15" />
          </div>
          <div className="w-10 h-10 rounded-xl bg-white/10" />
        </div>
      </div>
    </div>
  );
}
