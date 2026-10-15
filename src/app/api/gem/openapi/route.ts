import { NextResponse } from "next/server";
import { getGemOpenApiSpec } from "@/lib/gem-service";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `${url.protocol}//${url.host}`;
  const spec = getGemOpenApiSpec(baseUrl);

  return NextResponse.json(spec, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
