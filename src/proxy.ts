import { NextResponse } from "next/server";
import { auth } from "@/auth";

export default auth((req) => {
  const isLoggedIn = Boolean(req.auth);
  const isPublicPage = req.nextUrl.pathname.startsWith("/login") || req.nextUrl.pathname.startsWith("/signup");

  if (!isLoggedIn && !isPublicPage) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
  if (isLoggedIn && isPublicPage) {
    return NextResponse.redirect(new URL("/today", req.nextUrl));
  }
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|manifest.json|icon.svg).*)"],
};
