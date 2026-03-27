import { type NextRequest, NextResponse } from "next/server";
import { handlers } from "@/lib/auth";
import { handleCorsPreFlight, withCors } from "@/lib/cors";

export async function OPTIONS(req: NextRequest) {
  return handleCorsPreFlight(req);
}

export async function GET(req: NextRequest) {
  const response = await handlers.GET(req);
  return withCors(response as NextResponse, req);
}

export async function POST(req: NextRequest) {
  const response = await handlers.POST(req);
  return withCors(response as NextResponse, req);
}
