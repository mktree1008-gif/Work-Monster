import { QuestionsFlow } from "@/components/questions-flow";
import { toISODate } from "@/lib/utils";
import { getViewerContext } from "@/lib/view-model";

export default async function CheckInPage() {
  const { bundle } = await getViewerContext();
  const managerPreview = bundle.user.role === "manager";
  const today = toISODate(new Date());
  const initialSubmission = bundle.submissions.find((item) => item.date === today) ?? bundle.submissions[0] ?? null;

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
