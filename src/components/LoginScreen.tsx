"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, Check, ArrowRight, AlertCircle, Mail, Lock } from "./ui/icons";
import { requestMagicLinkAction, verifyEmailOtpAction } from "@/app/actions";
import { triggerHaptic } from "@/lib/haptics";

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [otpOrToken, setOtpOrToken] = useState("");
  const [showDirectTokenInput, setShowDirectTokenInput] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [accessResult, setAccessResult] = useState<{
    email: string;
    emailSent?: boolean;
  } | null>(null);

  // Detectar si el usuario volvió de un enlace con error de Supabase (ej: otp_expired en Safari)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlError = params.get("error");
      if (urlError) {
        if (urlError === "otp_expired" || urlError.toLowerCase().includes("expired")) {
          setErrorMsg(
            "El enlace del correo ya fue utilizado o ha expirado. Por favor solicitá un nuevo enlace o ingresá el código de 6 dígitos."
          );
        } else if (urlError === "pkce_context_missing") {
          setErrorMsg(
            "Al abrir el enlace en otra aplicación no se sincronizó la sesión de Safari. Podés ingresar escribiendo el código de 6 dígitos del mail o pegando el enlace acá."
          );
          setShowDirectTokenInput(true);
        } else {
          try {
            setErrorMsg(decodeURIComponent(urlError.replace(/\+/g, " ")));
          } catch {
            setErrorMsg(urlError);
          }
        }
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmail = email.trim().toLowerCase();

    if (!targetEmail) {
      setErrorMsg("Seleccioná o ingresá tu correo electrónico.");
      return;
    }

    triggerHaptic(12);
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await requestMagicLinkAction(targetEmail);
      if (!res.success) {
        setErrorMsg(res.error || "Error al solicitar acceso.");
        return;
      }
      setAccessResult({
        email: res.email || targetEmail,
        emailSent: res.emailSent,
      });
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Error de conexión al solicitar acceso."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtpOrLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpOrToken.trim()) {
      setErrorMsg("Ingresá el código de 6 dígitos o pegá el enlace del correo.");
      return;
    }

    triggerHaptic(15);
    setIsVerifying(true);
    setErrorMsg(null);

    try {
      const targetEmail = (accessResult?.email || email).trim().toLowerCase();
      const res = await verifyEmailOtpAction(targetEmail, otpOrToken);
      if (!res.success) {
        setErrorMsg(res.error || "Código o enlace no válido.");
        setIsVerifying(false);
        return;
      }
      window.location.href = "/";
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Error de red al verificar el acceso."
      );
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-zinc-100 flex flex-col items-center justify-center p-6 selection:bg-blue-600/30">
      <div className="w-full max-w-sm flex flex-col items-center text-center animate-fade-in">
        {/* Logo de la aplicación */}
        <div className="w-20 h-20 rounded-[24px] overflow-hidden mb-4 shadow-2xl shadow-indigo-600/30 border border-white/15 ring-2 ring-indigo-500/20">
          <img
            src="/apple-touch-icon.png"
            alt="Hogar"
            className="w-full h-full object-cover"
          />
        </div>

        <h1 className="text-2xl font-extrabold text-white tracking-tight">
          Gastos Hogar
        </h1>
        <p className="text-xs text-zinc-400 mt-1 max-w-xs">
          Acceso privado mediante código o enlace por correo
        </p>

        {/* Mensaje de confirmación + Ingreso de Código OTP / Link (Ideal para Safari / iOS PWA) */}
        {accessResult ? (
          <div className="w-full mt-6 super-card rounded-3xl p-5 border border-white/[0.1] text-center animate-fade-in space-y-4">
            <div className="w-11 h-11 mx-auto rounded-2xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center justify-center">
              <Mail className="w-5 h-5 stroke-[2]" />
            </div>

            <div>
              <h2 className="text-base font-bold text-white">
                Revisá tu correo
              </h2>
              <p className="text-xs text-zinc-400 mt-1 font-mono break-all px-2">
                {accessResult.email}
              </p>
            </div>

            {errorMsg && (
              <div className="bg-rose-500/15 border border-rose-500/30 text-rose-200 px-3.5 py-2.5 rounded-2xl text-xs text-left flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Formulario para ingresar Código OTP de 6 dígitos o pegar el link en Safari/PWA */}
            <form onSubmit={handleVerifyOtpOrLink} className="space-y-3 text-left">
              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1.5 px-1">
                  Código de 6 dígitos o enlace del mail
                </label>
                <input
                  type="text"
                  inputMode="text"
                  autoComplete="one-time-code"
                  autoFocus
                  placeholder="Ej: 123456 o pegá el link aquí"
                  value={otpOrToken}
                  onChange={(e) => setOtpOrToken(e.target.value)}
                  className="w-full bg-white/[0.06] border border-white/[0.14] rounded-2xl px-4 py-3 text-white text-center font-mono text-base tracking-wider placeholder:text-xs placeholder:tracking-normal placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#0A84FF] transition"
                />
                <p className="text-[11px] text-zinc-400 mt-1.5 px-1 leading-relaxed">
                  En Safari / iPhone podés escribir el <strong>código numérico</strong> del correo o mantener presionado el botón del mail, elegir <strong>&ldquo;Copiar enlace&rdquo;</strong> y pegarlo acá.
                </p>
              </div>

              <button
                type="submit"
                disabled={isVerifying || !otpOrToken.trim()}
                className="w-full py-3.5 rounded-2xl bg-[#0A84FF] hover:brightness-110 disabled:opacity-40 text-white font-bold text-xs shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 active:scale-[0.98] transition"
              >
                <Check className="w-4 h-4" />
                <span>
                  {isVerifying ? "Verificando..." : "Ingresar con Código / Enlace"}
                </span>
              </button>
            </form>

            <button
              type="button"
              onClick={() => {
                setAccessResult(null);
                setOtpOrToken("");
                setErrorMsg(null);
              }}
              className="w-full py-2 text-center text-xs text-zinc-400 hover:text-white transition"
            >
              ← Cambiar correo o reenviar
            </button>
          </div>
        ) : (
          /* Pantalla Inicial: Selector rápido + Correo + Opción directa de Código/Token */
          <div className="w-full mt-6 space-y-4">
            {errorMsg && (
              <div className="bg-rose-500/15 border border-rose-500/30 text-rose-200 px-3.5 py-2.5 rounded-2xl text-xs text-left flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Selector rápido para no tener que escribir en iOS */}
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(10);
                  setEmail("augustogronda@gmail.com");
                  setErrorMsg(null);
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition active:scale-95 ${
                  email === "augustogronda@gmail.com"
                    ? "bg-[#0A84FF]/25 border-[#0A84FF] text-white shadow-sm shadow-[#0A84FF]/30"
                    : "bg-white/[0.04] border-white/10 text-zinc-400 hover:text-white"
                }`}
              >
                👤 Augusto
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(10);
                  setEmail("agusaux@gmail.com");
                  setErrorMsg(null);
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition active:scale-95 ${
                  email === "agusaux@gmail.com"
                    ? "bg-pink-500/25 border-pink-500 text-white shadow-sm shadow-pink-500/30"
                    : "bg-white/[0.04] border-white/10 text-zinc-400 hover:text-white"
                }`}
              >
                👤 Agus
              </button>
            </div>

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
                  className="w-full bg-white/[0.05] border border-white/[0.12] rounded-2xl px-4 py-3.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#0A84FF] transition font-mono text-center sm:text-left placeholder:text-zinc-600"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 rounded-2xl bg-[#0A84FF] hover:brightness-110 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 active:scale-[0.98] transition"
              >
                <span>
                  {isLoading ? "Enviando al correo..." : "Enviar Código y Enlace"}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {/* Acceso directo si ya tiene un código o link copiado */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(8);
                  setShowDirectTokenInput((prev) => !prev);
                  setErrorMsg(null);
                }}
                className="text-xs font-semibold text-zinc-400 hover:text-white inline-flex items-center gap-1.5 py-1.5 px-3 rounded-full bg-white/[0.04] border border-white/[0.08] transition"
              >
                <Lock className="w-3.5 h-3.5 text-[#0A84FF]" />
                <span>
                  {showDirectTokenInput
                    ? "Ocultar ingreso manual"
                    : "¿Ya tenés un código o enlace copiado?"}
                </span>
              </button>

              {showDirectTokenInput && (
                <form
                  onSubmit={handleVerifyOtpOrLink}
                  className="mt-3 p-4 rounded-2xl super-card-subtle border border-white/[0.08] space-y-2.5 text-left animate-fade-in"
                >
                  <label className="text-[11px] font-semibold text-zinc-300 block">
                    Pegá tu código OTP (6 dígitos), token o enlace del mail
                  </label>
                  <input
                    type="text"
                    autoComplete="one-time-code"
                    placeholder="Código de 6 dígitos o link del correo..."
                    value={otpOrToken}
                    onChange={(e) => setOtpOrToken(e.target.value)}
                    className="w-full bg-white/[0.06] border border-white/[0.14] rounded-xl px-3.5 py-2.5 text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#0A84FF]"
                  />
                  <button
                    type="submit"
                    disabled={isVerifying || !otpOrToken.trim()}
                    className="w-full py-2.5 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 disabled:opacity-40 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-[0.98] transition"
                  >
                    <Check className="w-4 h-4" />
                    <span>{isVerifying ? "Verificando..." : "Validar e Ingresar"}</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        <div className="mt-8 flex items-center gap-2 text-[11px] text-zinc-500 font-medium">
          <Sparkles className="w-3.5 h-3.5 text-[#0A84FF] shrink-0" />
          <span>Acceso privado y seguro compatible con Safari y PWA iOS.</span>
        </div>
      </div>
    </div>
  );
}
