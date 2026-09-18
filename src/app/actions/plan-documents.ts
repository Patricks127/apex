"use server";

/**
 * PT anexa um plano em PDF ao aluno (migração 020, plan_documents).
 *
 * O upload NÃO passa pelo browser diretamente para o storage (padrão do
 * chat, uploadComProgresso) — aqui o ficheiro vai dentro do FormData da
 * própria Server Action e é o SERVIDOR quem fala com o storage. Duas
 * razões: (1) um plano em PDF de um PT é tipicamente pequeno (não precisa
 * de barra de progresso como um vídeo de 50MB); (2) o nome/caminho do
 * ficheiro tem de ser gerado no servidor, nunca aceite do cliente — path
 * traversal (`..`) não é um bypass de RLS aqui (storage.foldername só
 * faz split por "/", não resolve ".." como sistema de ficheiros), mas
 * nunca é higiénico confiar num nome vindo do browser quando o servidor
 * pode simplesmente não o aceitar.
 *
 * Defesa em profundidade, mesmo padrão do registarMedia (actions/chat.ts):
 * o bucket já valida tipo/tamanho, o código valida outra vez.
 */
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "plan-documents";
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB — mesmo limite do bucket

export type EstadoAnexo = { erro?: string; ok?: boolean };

export async function anexarPlanoDocumento(
  _anterior: EstadoAnexo,
  formData: FormData,
): Promise<EstadoAnexo> {
  const alunoId = String(formData.get("aluno_id") ?? "");
  const ficheiro = formData.get("ficheiro");

  if (!alunoId) return { erro: "Aluno inválido." };
  if (!(ficheiro instanceof File) || ficheiro.size === 0) {
    return { erro: "Escolhe um ficheiro PDF." };
  }
  if (ficheiro.type !== "application/pdf") return { erro: "Só ficheiros PDF." };
  if (ficheiro.size > MAX_BYTES) return { erro: "Ficheiro demasiado grande (máx. 20 MB)." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Sessão inválida." };

  // Confirma a ligação/scope ANTES de gastar um upload — a RLS bloquearia
  // de qualquer forma, mas não vale a pena enviar bytes só para falhar a seguir.
  const { data: link } = await supabase
    .from("pt_links")
    .select("id")
    .eq("pt_id", user.id)
    .eq("student_id", alunoId)
    .eq("status", "ativo")
    .eq("scope_treinos", true)
    .maybeSingle();
  if (!link) return { erro: "Não tens uma ligação ativa com permissão de treinos para este aluno." };

  // Nome/caminho gerados aqui, nunca a partir do cliente.
  const docId = randomUUID();
  const storagePath = `${alunoId}/${docId}.pdf`;
  const nomeOriginal = (ficheiro.name || "plano.pdf").slice(0, 200);

  const bytes = new Uint8Array(await ficheiro.arrayBuffer());
  const { error: erroUpload } = await supabase.storage.from(BUCKET).upload(storagePath, bytes, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (erroUpload) return { erro: "Falha ao enviar o ficheiro." };

  const { error: erroInsert } = await supabase.from("plan_documents").insert({
    id: docId,
    pt_id: user.id,
    student_id: alunoId,
    storage_path: storagePath,
    file_name: nomeOriginal,
    size_bytes: ficheiro.size,
  });
  if (erroInsert) {
    // upload teve sucesso mas a linha de metadados falhou (não devia
    // acontecer, a RLS já foi confirmada acima) — remove o ficheiro
    // órfão para não ficar lixo sem dono no storage.
    await supabase.storage.from(BUCKET).remove([storagePath]);
    return { erro: "Falha ao guardar o anexo." };
  }

  revalidatePath(`/pt/aluno/${alunoId}`);
  revalidatePath("/plano");
  return { ok: true };
}

/**
 * Apaga um documento — a RLS já restringe a quem o criou (`pt_id =
 * auth.uid()`) e só enquanto tiver scope 'treinos' ativo; aqui só se
 * confirma que a linha foi mesmo apagada (0 linhas devolvidas = RLS
 * bloqueou, silenciosamente, como o resto dos "remover" desta app) antes
 * de tocar no storage — nunca apagar bytes sem confirmar que a base de
 * dados os deixou de referenciar.
 */
export async function apagarPlanoDocumento(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const alunoId = String(formData.get("aluno_id") ?? "");
  if (!id || !alunoId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: apagados } = await supabase
    .from("plan_documents")
    .delete()
    .eq("id", id)
    .select("storage_path");

  const path = apagados?.[0]?.storage_path as string | undefined;
  if (path) {
    await supabase.storage.from(BUCKET).remove([path]);
  }
  revalidatePath(`/pt/aluno/${alunoId}`);
  revalidatePath("/plano");
}
