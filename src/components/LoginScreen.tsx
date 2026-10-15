"use client";

import React, { useState } from "react";
import { User, Wallet, Sparkles } from "./ui/icons";
import { loginAction } from "@/app/actions";

interface UserItem {
  id: string;
  name: string;
  email?: string;
  avatarColor: string;
}

interface LoginScreenProps {
  users: UserItem[];
}

export function LoginScreen({ users }: LoginScreenProps) {
  const [loggingInId, setLoggingInId] = useState<string | null>(null);

  const handleSelectUser = async (userId: string) => {
    setLoggingInId(userId);
    try {
      await loginAction(userId);
    } catch (err) {
      console.error(err);
      alert("Error al iniciar sesión");
      setLoggingInId(null);
    }
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col items-center justify-center p-6 selection:bg-blue-600/30">
      <div className="w-full max-w-sm flex flex-col items-center text-center animate-fade-in">
        
        {/* Logo / Badge */}
        <div className="w-16 h-16 rounded-3xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-6 shadow-xl shadow-blue-600/10">
          <Wallet className="w-8 h-8 stroke-[1.8]" />
        </div>

        <h1 className="text-2xl font-extrabold text-white tracking-tight">
          Gastos Hogar & Personal
        </h1>

        {/* Perfiles de Acceso Rápido */}
        <div className="w-full mt-8 space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-300 text-left px-1">
            ¿Quién sos?
          </p>

          {users.map((user) => {
            const isAugusto = user.name.toLowerCase().includes("augusto");
            const isSelected = loggingInId === user.id;

            return (
              <button
                key={user.id}
                onClick={() => handleSelectUser(user.id)}
                disabled={!!loggingInId}
                className={`w-full p-4 rounded-3xl border text-left flex items-center justify-between transition-all duration-200 active:scale-[0.98] ${
                  isAugusto
                    ? "bg-blue-950/30 hover:bg-blue-900/40 border-blue-500/30 text-white shadow-lg shadow-blue-950/40"
                    : "bg-rose-950/30 hover:bg-rose-900/40 border-rose-500/30 text-white shadow-lg shadow-rose-950/40"
                } ${isSelected ? "opacity-75 animate-pulse" : ""}`}
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-base font-extrabold text-white shadow-md border"
                    style={{
                      backgroundColor: user.avatarColor,
                      borderColor: "rgba(255,255,255,0.2)",
                    }}
                  >
                    {user.name.charAt(0)}
                  </div>
                  <div>
                    <span className="text-base font-bold block text-white">
                      {user.name}
                    </span>
                    <span className="text-xs text-zinc-400 font-medium block">
                      Espacio Hogar + Personal
                    </span>
                  </div>
                </div>

                <div
                  className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                    isAugusto
                      ? "bg-blue-500/20 text-blue-200 border-blue-400/30"
                      : "bg-rose-500/20 text-rose-200 border-rose-400/30"
                  }`}
                >
                  {isSelected ? "Entrando..." : "Ingresar"}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-8 flex items-center gap-2 text-[11px] text-zinc-300 font-medium">
          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          <span>Tus datos personales son privados para tu perfil.</span>
        </div>
      </div>
    </div>
  );
}
