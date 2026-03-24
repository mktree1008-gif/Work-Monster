import { ReactNode } from "react";
import { BottomTabs } from "@/components/bottom-tabs";

type Props = {
  activeTab: "questions" | "record" | "rewards" | "score" | "rules";
  title: string;
  subtitle?: string;
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
        <h1 className="display-cute text-4xl font-extrabold tracking-tight text-indigo-900">{title}</h1>
        {subtitle && <p className="mt-1 text-lg text-slate-500">{subtitle}</p>}
      </section>
      {children}
      <BottomTabs active={activeTab} labels={labels} />
    </>
  );
}
