
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession } from '@/lib/session';

// Define which routes are public and which are protected.
const publicRoutes = ['/login', '/register', '/'];
const protectedRoutes = ['/dashboard', '/settings', '/trades', '/footprint-charts', '/invest', '/admin'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Try to get the session from the request cookie.
  const session = await getSession();

  // Redirect logged-in users from auth pages to the dashboard.
  if (session && publicRoutes.some(route => pathname.startsWith(route) && (route !== '/' || pathname === '/'))) {
    if (pathname === '/') return NextResponse.next(); // Allow access to landing page
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // If the user is not logged in and trying to access a protected route, redirect to login.
  if (!session && protectedRoutes.some(route => pathname.startsWith(route))) {
    // Store the intended destination to redirect back after login.
    const url = new URL('/login', request.url);
    url.searchParams.set('redirect_to', pathname);
    return NextResponse.redirect(url);
  }

  // Special check for the admin route
  if (pathname.startsWith('/admin')) {
      if (!session || !session.isAdmin) {
          return NextResponse.redirect(new URL('/dashboard', request.url));
      }
  }

  // Allow the request to proceed if none of the above conditions are met.
  return NextResponse.next();
}

// Configure the middleware to run on specific paths.
export const config = {
  matcher: [
    // Apply middleware to all routes except for static assets and API routes.
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
