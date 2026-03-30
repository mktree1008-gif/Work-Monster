import Link from "next/link";
import type { ComponentType } from "react";
import { Moon, Dumbbell, UserRound, Utensils } from "lucide-react";

type WellnessTab = "food" | "workout" | "sleep" | "profile";

export function WellnessBottomNav({ active }: { active: WellnessTab }) {
  const tabs: Array<{ key: WellnessTab; href: string; label: string; icon: ComponentType<{ size?: number; className?: string }> }> = [
    { key: "food", href: "/app/welcome", label: "Food", icon: Utensils },
    { key: "workout", href: "/app/workout", label: "Workout", icon: Dumbbell },
    { key: "sleep", href: "/app/sleep", label: "Sleep", icon: Moon },
    { key: "profile", href: "/account", label: "Profile", icon: UserRound }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/70 bg-white/80 backdrop-blur-2xl">
      <div className="container-mobile pb-[calc(0.8rem+var(--safe-bottom))] pt-2">
        <ul className="grid grid-cols-4 gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const selected = tab.key === active;
            return (
              <li key={tab.key}>
                <Link
                  className={`flex flex-col items-center justify-center rounded-2xl px-2 py-2 text-[11px] font-semibold transition ${
                    selected ? "bg-blue-50 text-blue-600" : "text-slate-400"
                  }`}
                  href={tab.href}
                >
                  <Icon className={selected ? "" : "opacity-80"} size={18} />
                  <span className="mt-1">{tab.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
