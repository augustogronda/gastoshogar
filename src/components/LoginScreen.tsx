"use client";

import React, { useState } from "react";
import { User, Wallet, Sparkles, Check, Copy, ArrowRight, AlertCircle } from "./ui/icons";
import { requestMagicLinkAction, loginAction } from "@/app/actions";

interface UserItem {
  id: string;
  name: string;
  email?: string;
  avatarColor: string;
}

interface LoginScreenProps {
  users: UserItem[];
}

const AUTHORIZED_EMAILS = [
  { name: "Augusto", email: "augustogronda@gmail.com", color: "#2563eb" },
  { name: "Agus", email: "agusaux@gmail.com", color: "#ec4899" },
];

export function LoginScreen({ users }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [accessResult, setAccessResult] = useState<{
    userName: string;
    email: string;
    accessPath: string;
    emailSent: boolean;
    userId: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e?: React.FormEvent, directEmail?: string) => {
    if (e) e.preventDefault();
    const targetEmail = (directEmail || email).trim().toLowerCase();

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

  const handleCopyLink = () => {
    if (!accessResult) return;
    const fullUrl = `${window.location.origin}${accessResult.accessPath}`;
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleDirectEnter = async () => {
    if (!accessResult) return;
    setIsLoading(true);
    try {
      await loginAction(accessResult.userId);
    } catch (err) {
      console.error(err);
      window.location.href = accessResult.accessPath;
    }
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col items-center justify-center p-6 selection:bg-blue-600/30">
      <div className="w-full max-w-sm flex flex-col items-center text-center animate-fade-in">
        
        {/* Logo / Badge */}
        <div className="w-16 h-16 rounded-3xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-5 shadow-xl shadow-blue-600/10">
          <Wallet className="w-8 h-8 stroke-[1.8]" />
        </div>

        <h1 className="text-2xl font-extrabold text-white tracking-tight">
          Gastos Hogar & Personal
        </h1>
        <p className="text-xs text-zinc-400 mt-1 max-w-xs">
          Acceso seguro sin contraseña mediante link de acceso
        </p>

        {/* Si ya se generó el acceso */}
        {accessResult ? (
          <div className="w-full mt-6 super-card rounded-3xl p-5 border border-emerald-500/30 bg-emerald-950/20 text-left animate-fade-in space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <Check className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <span className="text-sm font-bold text-white block">
                  ¡Link de acceso listo, {accessResult.userName}!
                </span>
                <span className="text-xs text-zinc-400 font-mono block">
                  {accessResult.email}
                </span>
              </div>
            </div>

            {accessResult.emailSent ? (
              <p className="text-xs text-emerald-200/90 leading-relaxed bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
                Te enviamos un correo a tu Gmail con el enlace. También podés entrar directamente con el botón de abajo.
              </p>
            ) : (
              <p className="text-xs text-zinc-300 leading-relaxed bg-white/[0.04] p-3 rounded-xl border border-white/[0.08]">
                Podés ingresar en este dispositivo ahora mismo o copiar tu link permanente para guardarlo en la pantalla de inicio de tu celular.
              </p>
            )}

            <div className="space-y-2 pt-1">
              <button
                onClick={handleDirectEnter}
                disabled={isLoading}
                className="w-full py-3.5 px-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 active:scale-[0.98] transition"
              >
                <span>{isLoading ? "Entrando..." : "Entrar a mi Cuenta"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={handleCopyLink}
                className="w-full py-3 px-4 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] text-zinc-200 font-semibold text-xs border border-white/[0.1] flex items-center justify-center gap-2 active:scale-[0.98] transition"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-300 font-bold">¡Link Copiado al portapapeles!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-zinc-400" />
                    <span>Copiar mi Link de Acceso Permanente</span>
                  </>
                )}
              </button>
            </div>

            <button
              onClick={() => setAccessResult(null)}
              className="w-full text-center text-[11px] text-zinc-500 hover:text-zinc-300 pt-1 block"
            >
              ← Usar otro correo
            </button>
          </div>
        ) : (
          /* Formulario de Login con Mails Registrados */
          <div className="w-full mt-6 space-y-4">
            
            {errorMsg && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 px-3.5 py-2.5 rounded-2xl text-xs text-left flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={(e) => handleSubmit(e)} className="space-y-3">
              <div className="text-left">
                <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block mb-1.5 px-1">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  required
                  placeholder="ej. augustogronda@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/[0.05] border border-white/[0.12] rounded-2xl px-4 py-3.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/60 transition shadow-inner font-mono text-center sm:text-left"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 active:scale-[0.98] transition border border-blue-400/20"
              >
                <span>{isLoading ? "Generando acceso..." : "Continuar con Link de Acceso"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {/* Accesos rápidos sugeridos */}
            <div className="pt-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-2">
                O seleccioná tu correo registrado:
              </p>
              <div className="grid grid-cols-2 gap-2">
                {AUTHORIZED_EMAILS.map((auth) => (
                  <button
                    key={auth.email}
                    type="button"
                    onClick={() => {
                      setEmail(auth.email);
                      handleSubmit(undefined, auth.email);
                    }}
                    disabled={isLoading}
                    className="p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-left transition active:scale-95 group"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: auth.color }}
                      />
                      <span className="text-xs font-bold text-white group-hover:text-blue-300 transition-colors">
                        {auth.name}
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-400 font-mono truncate block">
                      {auth.email}
                    </span>
                  </button>
                ))}
              </div>
            </div>

          </div>
        )}

        <div className="mt-8 flex items-center gap-2 text-[11px] text-zinc-400 font-medium">
          <Sparkles className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span>Acceso exclusivo para Augusto y Agus sin passwords.</span>
        </div>
      </div>
    </div>
  );
}
