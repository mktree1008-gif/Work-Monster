import { CharacterCue, ManagerExpression, UserExpression } from "@/lib/character-system";

type Props = {
  role: "manager" | "user";
  cue: CharacterCue;
  glasses?: boolean;
  compact?: boolean;
  tone?: "default" | "warning" | "success";
};

function expressionEmoji(expression: ManagerExpression | UserExpression): string {
  switch (expression) {
    case "nods":
      return "🙂";
    case "wide-eyes":
      return "😲";
    case "clap":
      return "👏";
    case "wink":
      return "😉";
    case "confident":
      return "😎";
    case "nervous":
      return "😰";
    case "determined":
      return "😤";
    case "jump":
      return "🤸";
    case "sad":
      return "😢";
    default:
      return "🙂";
  }
}

function toneClass(tone: Props["tone"]): string {
  if (tone === "warning") return "bg-amber-50 border-amber-200";
  if (tone === "success") return "bg-emerald-50 border-emerald-200";
  return "bg-slate-50 border-slate-200";
}

export function CharacterAlert({ role, cue, glasses = false, compact = false, tone = "default" }: Props) {
  const baseAvatar = role === "manager" ? "👩‍💼" : "🧑";
  const characterName = role === "manager" ? "Manager Character" : "User Character";
  const expression = expressionEmoji(cue.expression);

  return (
    <div className={`rounded-2xl border p-3 ${toneClass(tone)} ${compact ? "" : "shadow-sm"}`}>
      <div className="flex items-start gap-3">
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-2xl">
          <span>{baseAvatar}</span>
          {role === "user" && glasses && (
            <span className="absolute -bottom-1 -right-1 rounded-full bg-indigo-100 px-1 text-xs text-indigo-700">👓</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{characterName}</p>
            <span className="text-sm">{cue.emoji}</span>
          </div>
          <p className="mt-0.5 font-semibold text-indigo-900">{cue.title}</p>
          <p className="text-sm text-slate-600">{cue.message}</p>
        </div>
        <div className="rounded-full bg-white px-2 py-1 text-lg leading-none">{expression}</div>
      </div>
    </div>
  );
}
