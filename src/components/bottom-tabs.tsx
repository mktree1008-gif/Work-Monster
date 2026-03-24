import Link from "next/link";
import { LucideIcon, ChartColumn, Gift, HelpCircle, ShieldAlert, Star } from "lucide-react";

type Tab = {
  href: string;
  label: string;
  icon: LucideIcon;
  key: "questions" | "record" | "rewards" | "score" | "rules";
};

type BottomTabsProps = {
  active: Tab["key"];
  labels: {
    questions: string;
    record: string;
    rewards: string;
    score: string;
    rules: string;
  };
};

export function BottomTabs({ active, labels }: BottomTabsProps) {
  const tabs: Tab[] = [
    { key: "questions", href: "/app/questions", label: labels.questions, icon: HelpCircle },
    { key: "record", href: "/app/record", label: labels.record, icon: ChartColumn },
    { key: "rewards", href: "/app/rewards", label: labels.rewards, icon: Gift },
    { key: "score", href: "/app/score", label: labels.score, icon: Star },
    { key: "rules", href: "/app/rules", label: labels.rules, icon: ShieldAlert }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/50 glass">
      <div className="container-mobile pb-[calc(0.9rem+var(--safe-bottom))] pt-3">
        <ul className="grid grid-cols-5 gap-2">
          {tabs.map((tab) => {
            const isActive = tab.key === active;
            const Icon = tab.icon;
            return (
              <li key={tab.key}>
                <Link
                  href={tab.href}
                  className={`flex flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[10px] font-semibold tracking-wide transition ${
                    isActive ? "bg-indigo-100 text-indigo-900" : "text-slate-400"
                  }`}
                >
                  <Icon size={18} />
                  <span>{tab.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
