import { redirect } from "next/navigation";

// Das Wartezimmer ist jetzt Teil von „Heute“ (Spalten Erwartet → Wartezimmer → In Behandlung → Erledigt).
export default function WaitingRoomRedirect() {
  redirect("/");
}
