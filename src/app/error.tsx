"use client";

import { useEffect } from "react";
import { RefreshCw } from "@/components/ui/icons";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App Error Boundary caught:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#07090e] text-zinc-100 flex flex-col items-center justify-center p-6 text-center select-none">
      <div className="w-full max-w-sm flex flex-col items-center space-y-4 animate-fade-in">
        <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-2xl border border-white/10 ring-2 ring-indigo-500/20 mb-2">
          <img src="/apple-touch-icon.png" alt="Finanzas Hogar" className="w-full h-full object-cover" />
        </div>
        <h2 className="text-xl font-bold text-white tracking-tight">Ocurrió un problema al cargar</h2>
        <p className="text-xs text-zinc-400 max-w-xs leading-relaxed">
          Las finanzas están a salvo. Puedes reintentar la conexión o recargar la página.
        </p>
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 flex items-center gap-2 transition active:scale-95"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reintentar</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.href = "/";
              }
            }}
            className="px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs border border-white/10 transition active:scale-95"
          >
            Recargar
          </button>
        </div>
      </div>
    </div>
  );
}
