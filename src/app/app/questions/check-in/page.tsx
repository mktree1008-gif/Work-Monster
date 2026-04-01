import { QuestionsFlow } from "@/components/questions-flow";
import { headers } from "next/headers";
import { isISODateString, toISODate, toISODateInTimeZone } from "@/lib/utils";
import { getViewerContext } from "@/lib/view-model";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CheckInPage({ searchParams }: Props) {
  const { bundle } = await getViewerContext();
  const params = (searchParams ? await searchParams : {}) as Record<string, string | string[] | undefined>;
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
  const requestedDateRaw = typeof params.date === "string" ? params.date.trim() : "";
  const requestedDate = isISODateString(requestedDateRaw) ? requestedDateRaw : "";
  const selectedDate = requestedDate && requestedDate <= today ? requestedDate : today;
  const initialSubmission = bundle.submissions.find((item) => item.date === selectedDate) ?? null;

  return (
    <section className="-mx-4 -mb-2 -mt-1 sm:mx-0">
      <QuestionsFlow
        key={selectedDate}
        initialSubmission={initialSubmission}
        locale={bundle.user.locale}
        readOnly={managerPreview}
        selectedDate={selectedDate}
        maxSelectableDate={today}
      />
    </section>
  );
}
