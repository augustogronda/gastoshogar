import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user?.email) {
      const email = data.user.email.toLowerCase().trim();
      const user = await prisma.user.findFirst({
        where: { email: { equals: email } },
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
  }

  // Si no hay código o hubo error, volver al inicio
  return NextResponse.redirect(`${origin}/`);
}
