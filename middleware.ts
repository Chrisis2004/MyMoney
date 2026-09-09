import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/** Pagine raggiungibili senza sessione. */
const PUBLIC_PATHS = ["/accedi", "/registrazione"];

/**
 * Gira prima di ogni richiesta: rinnova il token scaduto (qui i cookie si
 * possono scrivere, nei Server Component no) e sbarra la strada a chi non ha
 * fatto l'accesso.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          for (const { name, value } of list) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of list) response.cookies.set(name, value, options);
        },
      },
    },
  );

  // getUser (e non getSession) perche' valida il token contro Supabase: il
  // cookie da solo e' un dato che arriva dal browser.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!user && !isPublic) {
    // Le chiamate dell'app si aspettano JSON: un redirect a HTML le manderebbe
    // in errore di parsing invece di dire chiaramente che manca la sessione.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Sessione scaduta. Accedi di nuovo." }, { status: 401 });
    }
    const to = request.nextUrl.clone();
    to.pathname = "/accedi";
    // Dopo l'accesso si torna dove si stava andando.
    to.search = pathname === "/" ? "" : `?vai=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(to);
  }

  if (user && isPublic) {
    const to = request.nextUrl.clone();
    to.pathname = "/";
    to.search = "";
    return NextResponse.redirect(to);
  }

  return response;
}

export const config = {
  matcher: [
    // Tutto tranne gli asset statici e le immagini, che non hanno bisogno di sessione.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
