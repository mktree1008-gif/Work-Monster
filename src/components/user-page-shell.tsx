import { ReactNode } from "react";
import { BottomTabs } from "@/components/bottom-tabs";

type Props = {
  activeTab: "questions" | "record" | "rewards" | "score" | "rules";
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  labels: {
    questions: string;
    record: string;
    rewards: string;
    score: string;
    rules: string;
  };
};

export function UserPageShell({ activeTab, title, subtitle, children, labels }: Props) {
  return (
    <>
      <section className="mb-5">
        <h1 className="display-cute text-page-title font-extrabold tracking-tight text-indigo-900">{title}</h1>
        {subtitle && <div className="mt-1 text-body-compact font-semibold text-slate-600">{subtitle}</div>}
      </section>
      {children}
      <BottomTabs active={activeTab} labels={labels} />
    </>
  );
}
