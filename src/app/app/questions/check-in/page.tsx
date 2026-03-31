import { QuestionsFlow } from "@/components/questions-flow";
import { headers } from "next/headers";
import { toISODate, toISODateInTimeZone } from "@/lib/utils";
import { getViewerContext } from "@/lib/view-model";

export default async function CheckInPage() {
  const { bundle } = await getViewerContext();
  const managerPreview = bundle.user.role === "manager";
  const requestHeaders = await headers();
  const requestTimeZone = (requestHeaders.get("x-vercel-ip-timezone") ?? "").trim();
  const today = (() => {
    if (!requestTimeZone) return toISODate(new Date());
    try {
      return toISODateInTimeZone(requestTimeZone, new Date());
    } catch {
      return toISODate(new Date());
    }
  })();
  const initialSubmission = bundle.submissions.find((item) => item.date === today) ?? null;

  return (
    <section className="-mx-4 -mb-2 -mt-1 sm:mx-0">
      <QuestionsFlow
        initialSubmission={initialSubmission}
        locale={bundle.user.locale}
        readOnly={managerPreview}
      />
    </section>
  );
}
