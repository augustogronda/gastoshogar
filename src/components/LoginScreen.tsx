"use client";

import React, { useState } from "react";
import { Sparkles, Check, ArrowRight, AlertCircle, Mail } from "./ui/icons";
import { requestMagicLinkAction } from "@/app/actions";

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [accessResult, setAccessResult] = useState<{
    email: string;
    emailSent: boolean;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmail = email.trim().toLowerCase();

    if (!targetEmail) {
      setErrorMsg("Ingresá tu correo electrónico registrado.");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await requestMagicLinkAction(targetEmail);
      setAccessResult(res);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Error al solicitar link de acceso"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090c12] text-zinc-100 flex flex-col items-center justify-center p-6 selection:bg-blue-600/30">
      <div className="w-full max-w-sm flex flex-col items-center text-center animate-fade-in">
        
        {/* Logo de la aplicación */}
        <div className="w-20 h-20 rounded-[24px] overflow-hidden mb-4 shadow-2xl shadow-indigo-600/30 border border-white/10 ring-2 ring-indigo-500/20">
          <img src="/apple-touch-icon.png" alt="Hogar" className="w-full h-full object-cover" />
        </div>

        <h1 className="text-2xl font-extrabold text-white tracking-tight">
          Gastos Hogar
        </h1>
        <p className="text-xs text-zinc-400 mt-1 max-w-xs">
          Acceso privado mediante enlace de acceso directo
        </p>

        {/* Mensaje de confirmación de envío */}
        {accessResult ? (
          <div className="w-full mt-6 super-card rounded-3xl p-6 border border-emerald-500/30 bg-emerald-950/20 text-center animate-fade-in space-y-4">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center">
              <Mail className="w-6 h-6 stroke-[2]" />
            </div>

            <div>
              <h2 className="text-base font-bold text-white">
                ¡Enlace de acceso enviado!
              </h2>
              <p className="text-xs text-zinc-300 mt-1.5 font-mono break-all px-2">
                {accessResult.email}
              </p>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed bg-white/[0.04] p-3.5 rounded-2xl border border-white/[0.08] text-left">
              Revisá tu bandeja de entrada o la carpeta de spam. Hacé clic en el enlace del correo para ingresar automáticamente a la aplicación sin contraseña.
            </p>

            <button
              onClick={() => {
                setAccessResult(null);
                setEmail("");
              }}
              className="w-full py-2.5 text-center text-xs text-zinc-400 hover:text-white transition"
            >
              ← Probar con otro correo
            </button>
          </div>
        ) : (
          /* Formulario de Solicitud de Link */
          <div className="w-full mt-6 space-y-4">
            
            {errorMsg && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 px-3.5 py-2.5 rounded-2xl text-xs text-left flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="text-left">
                <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block mb-1.5 px-1">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  required
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/[0.05] border border-white/[0.12] rounded-2xl px-4 py-3.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/60 transition shadow-inner font-mono text-center sm:text-left placeholder:text-zinc-600"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 active:scale-[0.98] transition border border-blue-400/20"
              >
                <span>{isLoading ? "Enviando enlace..." : "Enviar Enlace de Acceso"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

          </div>
        )}

        <div className="mt-8 flex items-center gap-2 text-[11px] text-zinc-500 font-medium">
          <Sparkles className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span>Acceso privado y seguro sin contraseñas.</span>
        </div>
      </div>
    </div>
  );
}
