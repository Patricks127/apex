"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { guardarPerfilAtleta, type EstadoPerfil } from "@/app/actions/perfil";
import { LIMITES_PERFIL_ATLETA as L } from "@/lib/perfil";
import { idFicheiro, redimensionarImagem, uploadComProgresso } from "@/lib/chat/media";
import { AvisoErroClaro, BotaoSubmeterClaro, CampoClaro } from "@/app/_ui/auth-claro";

const COR = {
  tinta: "var(--apex-tinta)",
  fraco: "var(--apex-cinza-texto)",
  linha: "var(--apex-cinza-linha)",
} as const;

/**
 * Editar o perfil do atleta — só o que é dele: foto, nome, objetivo, bio,
 * cidade. A foto vai para o bucket PÚBLICO `avatars`, na pasta do próprio
 * (`<id>/…`), exatamente como os avatares dos PTs (a policy do storage só
 * deixa escrever aí); é pública porque aparece no feed e no perfil público.
 */
export function FormPerfilAtleta({
  inicial,
  supabaseUrl,
  anonKey,
}: {
  inicial: { name: string; objetivo: string; bio: string; city: string; avatar_url: string };
  supabaseUrl: string;
  anonKey: string;
}) {
  const [estado, acao, pendente] = useActionState(guardarPerfilAtleta, {} as EstadoPerfil);
  const [avatarUrl, setAvatarUrl] = useState(inicial.avatar_url);
  const [avatarPct, setAvatarPct] = useState<number | null>(null);
  const [avatarErro, setAvatarErro] = useState<string | null>(null);
  const [objetivo, setObjetivo] = useState(inicial.objetivo);
  const [bio, setBio] = useState(inicial.bio);
  // tudo controlado: o React 19 repõe os campos NÃO controlados depois da
  // ação — o nome antigo voltava ao campo logo depois de gravar o novo
  const [nome, setNome] = useState(inicial.name);
  const [cidade, setCidade] = useState(inicial.city);

  async function escolherFoto(file: File | undefined) {
    setAvatarErro(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setAvatarErro("Escolhe uma imagem.");
      return;
    }
    try {
      const blob = await redimensionarImagem(file, 400, 0.85);
      const {
        data: { session },
      } = await createClient().auth.getSession();
      if (!session?.access_token) {
        setAvatarErro("Sessão expirada — volta a entrar.");
        return;
      }
      const path = `${session.user.id}/${idFicheiro()}.jpg`;
      setAvatarPct(0);
      await uploadComProgresso({
        supabaseUrl,
        anonKey,
        token: session.access_token,
        bucket: "avatars",
        path,
        blob,
        contentType: "image/jpeg",
        onProgress: setAvatarPct,
      });
      setAvatarPct(null);
      setAvatarUrl(`${supabaseUrl}/storage/v1/object/public/avatars/${path}`);
    } catch (e) {
      setAvatarPct(null);
      setAvatarErro(e instanceof Error ? e.message : "Falha ao enviar a foto.");
    }
  }

  return (
    <form action={acao} className="flex flex-col gap-5" noValidate>
      {estado.erro ? <AvisoErroClaro>{estado.erro}</AvisoErroClaro> : null}
      {estado.ok ? (
        <p className="apex-aviso apex-tipo-secundario" role="status" style={{ color: COR.tinta }}>
          Perfil guardado.{" "}
          <Link href="/perfil" className="underline underline-offset-4" style={{ fontWeight: 700 }}>
            Ver o meu perfil
          </Link>
        </p>
      ) : null}

      <div className="flex items-center gap-4">
        <div className="apex-avatar apex-avatar--grande">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" />
          ) : (
            <span className="apex-tipo-saudacao" style={{ color: COR.fraco }}>
              {(inicial.name || "?").trim().charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <label
            className="apex-tipo-secundario flex cursor-pointer items-center justify-center border px-4"
            style={{ minHeight: 44, borderColor: COR.linha, color: COR.tinta, fontWeight: 700 }}
          >
            {avatarUrl ? "Mudar foto" : "Pôr foto"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => escolherFoto(e.currentTarget.files?.[0])}
            />
          </label>
          {avatarUrl ? (
            <button
              type="button"
              onClick={() => setAvatarUrl("")}
              className="apex-tipo-etiqueta apex-link-toque self-start underline underline-offset-4"
              style={{ color: COR.fraco }}
            >
              Remover foto
            </button>
          ) : null}
          {avatarPct != null ? (
            <span className="apex-tipo-etiqueta apex-tabular" style={{ color: COR.fraco }}>
              A enviar… {avatarPct}%
            </span>
          ) : null}
          {avatarErro ? (
            <span className="apex-tipo-etiqueta" style={{ color: "var(--apex-erro)" }} role="alert">
              {avatarErro}
            </span>
          ) : null}
        </div>
      </div>
      <input type="hidden" name="avatar_url" value={avatarUrl} />
      <p className="apex-tipo-etiqueta" style={{ color: COR.fraco, fontWeight: 500, marginTop: -8 }}>
        A foto, o nome, o objetivo e a bio são visíveis a quem usa a APEX (feed e perfil público).
      </p>

      <CampoClaro
        etiqueta="Nome"
        name="name"
        value={nome}
        onChange={(e) => setNome(e.currentTarget.value)}
        maxLength={L.nome}
        autoComplete="name"
        required
      />

      <label className="apex-campo">
        <span className="apex-campo__etiqueta apex-tipo-secundario">Objetivo</span>
        <input
          name="objetivo"
          value={objetivo}
          onChange={(e) => setObjetivo(e.currentTarget.value)}
          maxLength={L.objetivo}
          placeholder="ex.: Correr a meia maratona em março"
          className="apex-campo__entrada"
        />
        <span className="apex-tipo-etiqueta apex-campo__hint apex-tabular">
          {objetivo.length}/{L.objetivo} — o objetivo do teu plano de treino muda-se no Plano, não aqui.
        </span>
      </label>

      <label className="apex-campo">
        <span className="apex-campo__etiqueta apex-tipo-secundario">Bio</span>
        <textarea
          name="bio"
          value={bio}
          onChange={(e) => setBio(e.currentTarget.value)}
          maxLength={L.bio}
          rows={4}
          placeholder="Uma ou duas frases sobre ti e o teu treino."
          className="apex-campo__entrada"
          style={{ resize: "vertical" }}
        />
        <span className="apex-tipo-etiqueta apex-campo__hint apex-tabular">
          {bio.length}/{L.bio}
        </span>
      </label>

      <CampoClaro
        etiqueta="Cidade (opcional)"
        name="city"
        value={cidade}
        onChange={(e) => setCidade(e.currentTarget.value)}
        maxLength={L.cidade}
        autoComplete="address-level2"
      />

      <BotaoSubmeterClaro pendente={pendente || avatarPct != null}>Guardar</BotaoSubmeterClaro>
    </form>
  );
}
