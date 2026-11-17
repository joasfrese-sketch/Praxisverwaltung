import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Öffnet einen Anhang über eine kurzlebige signierte URL (RLS prüft die Berechtigung). */
export async function GET(_: NextRequest, ctx: RouteContext<"/anhang/[id]">) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data } = await supabase.from("attachments").select("storage_path").eq("id", id).maybeSingle();
  if (!data) return new NextResponse("Nicht gefunden oder keine Berechtigung", { status: 404 });
  const { data: signed } = await supabase.storage.from("attachments").createSignedUrl(data.storage_path, 60);
  if (!signed) return new NextResponse("Fehler", { status: 500 });
  return NextResponse.redirect(signed.signedUrl);
}
