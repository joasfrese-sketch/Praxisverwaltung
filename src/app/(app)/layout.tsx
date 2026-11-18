import { getContext } from "@/lib/context";
import { AppShell } from "@/components/shell/app-shell";
import { staffName } from "@/components/ui";
import { STAFF_ROLES } from "@/lib/labels";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { supabase, me, practice, practices } = await getContext();
  const [{ count: unread }, { count: openTasks }] = await Promise.all([
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("recipient_staff_id", me.id).eq("status", "neu"),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("practice_id", practice.id).is("done_at", null).eq("assignee_id", me.id),
  ]);
  return (
    <AppShell
      practiceName={practice.name}
      practiceId={practice.id}
      practices={practices}
      user={{ name: staffName(me), role: `${STAFF_ROLES[me.role]}${me.is_admin ? ", Admin" : ""}` }}
      unread={unread ?? 0}
      tasks={openTasks ?? 0}
    >
      {children}
    </AppShell>
  );
}
