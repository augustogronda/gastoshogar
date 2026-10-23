"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Check,
  ArrowRight,
  AlertCircle,
  Mail,
  Lock,
  ChevronLeft,
  User,
} from "./ui/icons";
import {
  requestMagicLinkAction,
  verifyEmailOtpAction,
  loginWithPinAction,
  checkUserPinStatusAction,
  autoRestoreSessionAction,
  loginWithMagicTokenAction,
} from "@/app/actions";
import { triggerHaptic } from "@/lib/haptics";

const USERS = [
  {
    name: "Augusto",
    email: "augustogronda@gmail.com",
    color: "#2563eb",
    ringClass: "ring-blue-500/30",
    bgClass: "bg-blue-600/20",
    textClass: "text-blue-400",
  },
  {
    name: "Agus",
    email: "agusaux@gmail.com",
    color: "#ec4899",
    ringClass: "ring-pink-500/30",
    bgClass: "bg-pink-600/20",
    textClass: "text-pink-400",
  },
];

export function LoginScreen() {
  const [selectedUser, setSelectedUser] = useState<(typeof USERS)[0] | null>(null);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [isSettingPin, setIsSettingPin] = useState(false);
  const [isConfirmingPin, setIsConfirmingPin] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [isPinLoading, setIsPinLoading] = useState(false);
  const [shakePin, setShakePin] = useState(false);

  // Modo alternativo: Correo / Enlace mágico
  const [showEmailMode, setShowEmailMode] = useState(false);
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
  const [isAutoRestoring, setIsAutoRestoring] = useState(false);

  // Intentar autorecuperar sesión permanente guardada en el dispositivo
  useEffect(() => {
    const tryAutoRestore = async () => {
      try {
        const savedToken = localStorage.getItem("gastoshogar_device_token");
        if (savedToken && typeof window !== "undefined" && !window.location.search.includes("error")) {
          setIsAutoRestoring(true);
          const res = await autoRestoreSessionAction(savedToken);
          if (res.success) {
            window.location.href = "/";
            return;
          } else {
            localStorage.removeItem("gastoshogar_device_token");
            setIsAutoRestoring(false);
          }
        }
      } catch {
        setIsAutoRestoring(false);
      }
    };
    tryAutoRestore();
  }, []);

  // Detectar si el usuario volvió de un enlace con error de Supabase
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlError = params.get("error");
      if (urlError) {
        if (urlError === "otp_expired" || urlError.toLowerCase().includes("expired")) {
          setErrorMsg(
            "El enlace del correo ya expiró o fue utilizado. Ingresá con tu PIN o solicitá uno nuevo."
          );
        } else if (urlError === "pkce_context_missing") {
          setErrorMsg(
            "Al abrir el enlace en otra app no se sincronizó la sesión. Podés ingresar directo con tu PIN."
          );
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

  // Al seleccionar un usuario, verificar si ya tiene PIN
  const handleSelectUser = async (user: (typeof USERS)[0]) => {
    triggerHaptic(15);
    setSelectedUser(user);
    setEmail(user.email);
    setPin("");
    setConfirmPin("");
    setPinError(null);
    setIsSettingPin(false);
    setIsConfirmingPin(false);

    try {
      const status = await checkUserPinStatusAction(user.email);
      if (status.success && !status.hasPin) {
        setIsSettingPin(true);
      }
    } catch {
      // Ignorar, se manejará en loginWithPinAction
    }
  };

  // Manejar el teclado numérico de PIN
  const handlePinDigit = async (digit: string) => {
    if (isPinLoading) return;
    triggerHaptic(10);
    setPinError(null);

    if (isSettingPin && isConfirmingPin) {
      // Confirmando nuevo PIN
      const nextPin = confirmPin + digit;
      if (nextPin.length <= 4) {
        setConfirmPin(nextPin);
      }
      if (nextPin.length === 4) {
        if (nextPin !== pin) {
          triggerHaptic(30);
          setShakePin(true);
          setTimeout(() => setShakePin(false), 500);
          setPinError("Los PINs no coinciden. Intentá de nuevo.");
          setConfirmPin("");
          setIsConfirmingPin(false);
          setPin("");
          return;
        }
        // Guardar nuevo PIN y autenticar
        await executePinLogin(selectedUser!.email, nextPin, true);
      }
    } else {
      // Ingresando PIN (o creando el primero)
      const nextPin = pin + digit;
      if (nextPin.length <= 4) {
        setPin(nextPin);
      }
      if (nextPin.length === 4) {
        if (isSettingPin) {
          // Pasar a confirmación
          setIsConfirmingPin(true);
          triggerHaptic(20);
        } else {
          // Validar PIN existente
          await executePinLogin(selectedUser!.email, nextPin, false);
        }
      }
    }
  };

  const handlePinBackspace = () => {
    triggerHaptic(8);
    setPinError(null);
    if (isSettingPin && isConfirmingPin) {
      setConfirmPin((prev) => prev.slice(0, -1));
    } else {
      setPin((prev) => prev.slice(0, -1));
    }
  };

  const executePinLogin = async (
    targetEmail: string,
    pinToVerify: string,
    isNew: boolean
  ) => {
    setIsPinLoading(true);
    try {
      const res = await loginWithPinAction(targetEmail, pinToVerify, isNew);
      if (res.success) {
        if ((res as any).deviceToken) {
          try {
            localStorage.setItem("gastoshogar_device_token", (res as any).deviceToken);
          } catch {
            // Ignore storage issues
          }
        }
        triggerHaptic(25);
        window.location.href = "/";
      } else if (res.needsSetup) {
        setIsSettingPin(true);
        setIsConfirmingPin(false);
        setPin("");
        setConfirmPin("");
        setPinError(res.error || "Elegí un PIN de 4 dígitos.");
        setIsPinLoading(false);
      } else {
        triggerHaptic(35);
        setShakePin(true);
        setTimeout(() => setShakePin(false), 500);
        setPinError(res.error || "PIN incorrecto");
        setPin("");
        setConfirmPin("");
        setIsPinLoading(false);
      }
    } catch {
      triggerHaptic(35);
      setPinError("Error al verificar PIN.");
      setPin("");
      setConfirmPin("");
      setIsPinLoading(false);
    }
  };

  const handleSubmitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmail = email.trim().toLowerCase();
    if (!targetEmail) {
      setErrorMsg("Seleccioná o ingresá tu correo registrado.");
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
        err instanceof Error ? err.message : "Error al solicitar acceso."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtpOrLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpOrToken.trim()) {
      setErrorMsg("Ingresá el código o enlace recibido.");
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
      if ((res as any).deviceToken) {
        try {
          localStorage.setItem("gastoshogar_device_token", (res as any).deviceToken);
        } catch {
          // Ignore
        }
      }
      window.location.href = "/";
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : "Error al verificar acceso."
      );
      setIsVerifying(false);
    }
  };

  const currentDisplayPin = isSettingPin && isConfirmingPin ? confirmPin : pin;

  if (isAutoRestoring) {
    return (
      <div className="min-h-screen bg-[#07090e] text-zinc-100 flex flex-col items-center justify-center p-6 selection:bg-blue-600/30">
        <div className="w-full max-w-sm flex flex-col items-center text-center animate-fade-in space-y-4">
          <div className="w-20 h-20 rounded-[24px] overflow-hidden mb-2 shadow-2xl shadow-indigo-600/30 border border-white/15 ring-2 ring-indigo-500/20">
            <img
              src="/apple-touch-icon.png"
              alt="Hogar"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-zinc-900/90 border border-white/[0.1] text-xs font-semibold text-zinc-200 shadow-xl">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping shrink-0" />
            <span>Restaurando tu sesión permanente...</span>
          </div>
        </div>
      </div>
    );
  }

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
          Acceso rápido privado para el hogar
        </p>

        {/* ============================================================ */}
        {/* PANTALLA A: MODO PIN / PASSCODE APPLE (RÁPIDO, SIN EMAILS) */}
        {/* ============================================================ */}
        {!showEmailMode && selectedUser ? (
          <div className="w-full mt-6 super-card rounded-3xl p-6 border border-white/[0.1] text-center animate-fade-in space-y-5">
            {/* Cabecera del usuario seleccionado */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(8);
                  setSelectedUser(null);
                  setPin("");
                  setConfirmPin("");
                  setPinError(null);
                }}
                className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-white py-1 px-2 rounded-lg bg-white/[0.04] transition"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Volver</span>
              </button>

              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: selectedUser.color }}
                />
                <span className="text-xs font-bold text-white">
                  {selectedUser.name}
                </span>
              </div>
            </div>

            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                {isSettingPin
                  ? isConfirmingPin
                    ? "Confirmá tu PIN de 4 dígitos"
                    : "Creá tu PIN de 4 dígitos"
                  : "Ingresá tu PIN de 4 dígitos"}
              </h2>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {isSettingPin
                  ? isConfirmingPin
                    ? "Ingresalo nuevamente para confirmar"
                    : "Para acceder al instante sin correos ni contraseñas"
                  : "Acceso instantáneo para tu cuenta"}
              </p>
            </div>

            {/* Error de PIN */}
            {pinError && (
              <div className="bg-rose-500/15 border border-rose-500/30 text-rose-200 px-3.5 py-2 rounded-2xl text-xs text-center flex items-center justify-center gap-1.5 animate-shake">
                <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>{pinError}</span>
              </div>
            )}

            {/* Indicador de 4 puntos Apple Passcode */}
            <div
              className={`flex justify-center items-center gap-4 py-2 ${
                shakePin ? "animate-shake" : ""
              }`}
            >
              {[0, 1, 2, 3].map((index) => {
                const isFilled = index < currentDisplayPin.length;
                return (
                  <div
                    key={index}
                    className={`w-4 h-4 rounded-full transition-all duration-200 ${
                      isFilled
                        ? "bg-[#0A84FF] scale-110 shadow-lg shadow-blue-500/50"
                        : "border-2 border-white/20 bg-transparent"
                    }`}
                  />
                );
              })}
            </div>

            {/* Teclado Numérico Apple Style */}
            <div className="grid grid-cols-3 gap-3 max-w-[260px] mx-auto pt-1">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                <button
                  key={num}
                  type="button"
                  disabled={isPinLoading}
                  onClick={() => handlePinDigit(num)}
                  className="w-16 h-16 rounded-full mx-auto bg-white/[0.06] hover:bg-white/[0.12] active:bg-[#0A84FF]/30 active:scale-95 border border-white/[0.08] text-white text-2xl font-semibold flex items-center justify-center transition shadow-sm"
                >
                  {num}
                </button>
              ))}
              <div />
              <button
                type="button"
                disabled={isPinLoading}
                onClick={() => handlePinDigit("0")}
                className="w-16 h-16 rounded-full mx-auto bg-white/[0.06] hover:bg-white/[0.12] active:bg-[#0A84FF]/30 active:scale-95 border border-white/[0.08] text-white text-2xl font-semibold flex items-center justify-center transition shadow-sm"
              >
                0
              </button>
              <button
                type="button"
                disabled={isPinLoading || currentDisplayPin.length === 0}
                onClick={handlePinBackspace}
                className="w-16 h-16 rounded-full mx-auto bg-white/[0.03] hover:bg-white/[0.08] active:scale-95 disabled:opacity-20 text-zinc-300 text-sm font-semibold flex items-center justify-center transition"
              >
                ⌫
              </button>
            </div>

            {/* Opción de recuperación por correo */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(8);
                  setShowEmailMode(true);
                  setErrorMsg(null);
                }}
                className="text-xs text-zinc-400 hover:text-white transition underline-offset-4 hover:underline"
              >
                ¿Olvidaste tu PIN? Ingresar por correo
              </button>
            </div>
          </div>
        ) : !showEmailMode ? (
          /* ============================================================ */
          /* PANTALLA B: SELECCIÓN DE USUARIO (AUGUSTO / AGUS) */
          /* ============================================================ */
          <div className="w-full mt-6 space-y-4 animate-fade-in">
            {errorMsg && (
              <div className="bg-rose-500/15 border border-rose-500/30 text-rose-200 px-3.5 py-2.5 rounded-2xl text-xs text-left flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="text-left px-1">
              <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                ¿Quién está ingresando?
              </p>
            </div>

            {/* Tarjetas de perfil grandes de 1 toque */}
            <div className="grid grid-cols-2 gap-3.5">
              {USERS.map((u) => (
                <button
                  key={u.email}
                  type="button"
                  onClick={() => handleSelectUser(u)}
                  className="super-card group relative rounded-3xl p-5 border border-white/[0.1] hover:border-white/20 active:scale-[0.97] transition flex flex-col items-center text-center gap-3 shadow-lg"
                >
                  <div
                    className={`w-14 h-14 rounded-2xl ${u.bgClass} flex items-center justify-center ring-2 ${u.ringClass} shadow-inner group-hover:scale-105 transition`}
                  >
                    <User className={`w-7 h-7 ${u.textClass}`} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white tracking-tight">
                      {u.name}
                    </h3>
                    <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
                      Ingreso con PIN
                    </p>
                  </div>
                </button>
              ))}
            </div>

            {/* Alternativa: Ingreso por correo */}
            <div className="pt-3">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(8);
                  setShowEmailMode(true);
                  setErrorMsg(null);
                }}
                className="text-xs font-semibold text-zinc-400 hover:text-white inline-flex items-center gap-1.5 py-2 px-3.5 rounded-full bg-white/[0.04] border border-white/[0.08] transition"
              >
                <Mail className="w-3.5 h-3.5 text-[#0A84FF]" />
                <span>Ingresar mediante correo electrónico</span>
              </button>
            </div>
          </div>
        ) : (
          /* ============================================================ */
          /* PANTALLA C: INGRESO POR CORREO O TOKEN (FALLBACK / MANUAL) */
          /* ============================================================ */
          <div className="w-full mt-6 space-y-4 animate-fade-in">
            <button
              type="button"
              onClick={() => {
                triggerHaptic(8);
                setShowEmailMode(false);
                setAccessResult(null);
                setErrorMsg(null);
              }}
              className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-white py-1 px-2.5 rounded-lg bg-white/[0.04] transition mb-2"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Volver a ingreso con PIN</span>
            </button>

            {accessResult ? (
              <div className="super-card rounded-3xl p-5 border border-white/[0.1] text-center space-y-4">
                <div className="w-11 h-11 mx-auto rounded-2xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center justify-center">
                  <Mail className="w-5 h-5 stroke-[2]" />
                </div>

                <div>
                  <h2 className="text-base font-bold text-white">Revisá tu correo</h2>
                  <p className="text-xs text-zinc-400 mt-1 font-mono break-all px-2">
                    {accessResult.email}
                  </p>
                </div>

                {errorMsg && (
                  <div className="bg-rose-500/15 border border-rose-500/30 text-rose-200 px-3.5 py-2 rounded-2xl text-xs text-left flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <form onSubmit={handleVerifyOtpOrLink} className="space-y-3 text-left">
                  <div>
                    <label className="text-[11px] font-semibold text-zinc-300 block mb-1 px-1">
                      Pegá el enlace del correo o código
                    </label>
                    <input
                      type="text"
                      autoFocus
                      placeholder="Pegá aquí el enlace recibido..."
                      value={otpOrToken}
                      onChange={(e) => setOtpOrToken(e.target.value)}
                      className="w-full bg-white/[0.06] border border-white/[0.14] rounded-2xl px-4 py-3 text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#0A84FF]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isVerifying || !otpOrToken.trim()}
                    className="w-full py-3 rounded-2xl bg-[#0A84FF] hover:brightness-110 disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center gap-2 active:scale-[0.98] transition"
                  >
                    <Check className="w-4 h-4" />
                    <span>{isVerifying ? "Verificando..." : "Validar enlace"}</span>
                  </button>
                </form>

                <button
                  type="button"
                  onClick={() => {
                    setAccessResult(null);
                    setOtpOrToken("");
                    setErrorMsg(null);
                  }}
                  className="w-full py-1.5 text-center text-xs text-zinc-400 hover:text-white transition"
                >
                  ← Reintentar o cambiar correo
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {errorMsg && (
                  <div className="bg-rose-500/15 border border-rose-500/30 text-rose-200 px-3.5 py-2.5 rounded-2xl text-xs text-left flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <form onSubmit={handleSubmitEmail} className="space-y-3 text-left">
                  <div>
                    <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block mb-1.5 px-1">
                      Correo Electrónico
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="tu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-white/[0.05] border border-white/[0.12] rounded-2xl px-4 py-3 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#0A84FF]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3.5 rounded-2xl bg-[#0A84FF] hover:brightness-110 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 active:scale-[0.98] transition"
                  >
                    <span>{isLoading ? "Enviando..." : "Enviar enlace al correo"}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>

                {/* Opción de pegar token directo */}
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
                      {showDirectTokenInput ? "Ocultar" : "¿Pegar enlace o token copiado?"}
                    </span>
                  </button>

                  {showDirectTokenInput && (
                    <form
                      onSubmit={handleVerifyOtpOrLink}
                      className="mt-3 p-4 rounded-2xl super-card-subtle border border-white/[0.08] space-y-2.5 text-left animate-fade-in"
                    >
                      <input
                        type="text"
                        placeholder="Pegá el link o token recibido..."
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
          </div>
        )}

        <div className="mt-8 flex items-center gap-2 text-[11px] text-zinc-500 font-medium">
          <Sparkles className="w-3.5 h-3.5 text-[#0A84FF] shrink-0" />
          <span>Acceso privado instantáneo compatible con Safari y PWA iOS.</span>
        </div>
      </div>
    </div>
  );
}
