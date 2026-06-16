/**
 * Server-side admin guard for dangerous preview actions.
 *
 * Keep this file server-only by importing it only from API routes.
 */

import { NextResponse } from "next/server";

export function getAdminRequestError(
  request: Request,
  disabledMessage = "Admin action is disabled.",
) {
  if (process.env.NEXT_PUBLIC_ENABLE_ADMIN_MARKET_CREATE !== "true") {
    return NextResponse.json({ error: disabledMessage }, { status: 403 });
  }

  const expectedKey = process.env.ADMIN_API_KEY?.trim();

  if (!expectedKey) {
    return NextResponse.json(
      {
        error:
          "ADMIN_API_KEY is not configured on the server. Set ADMIN_API_KEY in .env.local before enabling admin actions.",
      },
      { status: 500 },
    );
  }

  const providedKey = request.headers.get("x-admin-key")?.trim();

  if (!providedKey || providedKey !== expectedKey) {
    return NextResponse.json(
      {
        error:
          "Admin key is required or invalid. Open Admin Markets and enter the server ADMIN_API_KEY.",
      },
      { status: 401 },
    );
  }

  return null;
}
