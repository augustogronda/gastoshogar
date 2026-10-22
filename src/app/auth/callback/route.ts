import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { EmailOtpType } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = (searchParams.get("type") as EmailOtpType | null) || "email";
  const errorCode = searchParams.get("error_code") || searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // Si Supabase ya redirigió con error (ej: otp_expired)
  if (errorCode || errorDescription) {
    const errParam = errorCode === "otp_expired" ? "otp_expired" : (errorDescription || errorCode || "auth_error");
    return NextResponse.redirect(`${origin}/?error=${encodeURIComponent(errParam)}`);
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  let verifiedEmail: string | null = null;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user?.email) {
      verifiedEmail = data.user.email.toLowerCase().trim();
    } else if (error) {
      console.warn("Supabase exchangeCodeForSession error en /auth/callback:", error.message);
    }
  }

  // Fallback para Safari / iOS PWA cuando se abre el link en otro contexto sin cookie PKCE
  if (!verifiedEmail && tokenHash) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (!error && data.user?.email) {
      verifiedEmail = data.user.email.toLowerCase().trim();
    }
  }

  if (verifiedEmail) {
    const user = await prisma.user.findFirst({
      where: { email: { equals: verifiedEmail, mode: "insensitive" } },
    });

    if (user) {
      const response = NextResponse.redirect(`${origin}/`);
      response.cookies.set("auth_user_id", user.id, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
      return response;
    }
  }

  // Si no se pudo validar la sesión por PKCE cross-context (Safari / PWA), volver informando
  return NextResponse.redirect(`${origin}/?error=pkce_context_missing`);
}
