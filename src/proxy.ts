import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { withPasswordProtect } from "@tommyvez/passfort/next";

// Rotas que não exigem sessão iniciada
const PUBLIC_ROUTES = ["/", "/entrar", "/registar", "/auth", "/termos", "/privacidade", "/estilo"];

// passfort — a fechadura do site inteiro (teste privado, com dados de
// saúde: o URL nunca pode ficar acessível sem password, mesmo antes de
// se chegar à sessão do Supabase). Corre PRIMEIRO — sem sessão válida do
// passfort, devolve logo o formulário/redirect dele, sem sequer tocar
// na lógica de autenticação da app. Configuração vem só de env vars
// (PASSFORT_SECRET/PASSWORD/HASH no painel da Vercel, nunca no repo) —
// se PASSFORT_SECRET não estiver definido, a própria biblioteca desliga-
// se sozinha (devolve sempre "deixa passar"), nunca bloqueia por engano
// só por faltar configuração.
const protegerComPassfort = withPasswordProtect({ protectAll: true });

export async function proxy(request: NextRequest) {
  const respostaPassfort = await protegerComPassfort(request);
  // NextResponse.next() marca-se com este header — é a forma correta de
  // distinguir "o passfort deixou passar" de "o passfort bloqueou" sem
  // adivinhar por código de estado (401 no formulário, 302 no login/
  // logout, 429 no rate limit, 503 em modo de manutenção — nunca um só
  // código fixo). Só quando isto é mesmo um "deixa passar" é que a
  // lógica de sessão do Supabase chega a correr — nunca as duas em
  // simultâneo, nunca a sessão do Supabase decide antes do passfort.
  if (respostaPassfort.headers.get("x-middleware-next") !== "1") {
    return respostaPassfort;
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANTE: getUser() valida o token no servidor.
  // Nunca usar getSession() para decidir acessos — pode ser falsificado no cliente.
  const { data: { user } } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_ROUTES.some((r) => path === r || path.startsWith(r + "/"));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
