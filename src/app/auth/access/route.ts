import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(`${origin}/?error=missing_token`);
  }

  const user = await prisma.user.findUnique({
    where: { magicToken: token },
  });

  if (!user) {
    return NextResponse.redirect(`${origin}/?error=invalid_token`);
  }

  const response = NextResponse.redirect(`${origin}/`);

  // Persistir la sesión del usuario por 400 días (Long Session permanente)
  const sessionLifetimeSeconds = 60 * 60 * 24 * 400;
  response.cookies.set("auth_user_id", user.id, {
    path: "/",
    maxAge: sessionLifetimeSeconds,
    expires: new Date(Date.now() + sessionLifetimeSeconds * 1000),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
