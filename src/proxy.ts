import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  const authUserId = request.cookies.get("auth_user_id")?.value;

  // Si el usuario tiene una sesión activa, renovar el tiempo de vida de la cookie (Long Session: 400 días)
  // 400 días es el máximo permitido por la especificación de navegadores modernos (Chrome/Safari ITP)
  if (authUserId) {
    const sessionLifetimeSeconds = 60 * 60 * 24 * 400; // 400 días
    response.cookies.set("auth_user_id", authUserId, {
      path: "/",
      maxAge: sessionLifetimeSeconds,
      expires: new Date(Date.now() + sessionLifetimeSeconds * 1000),
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Interceptar todas las rutas excepto archivos estáticos de Next.js, imágenes y favicons
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
