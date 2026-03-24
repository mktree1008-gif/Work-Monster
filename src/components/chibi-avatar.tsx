import Image from "next/image";

type Props = {
  role: "manager" | "user";
  emotion?: "neutral" | "encouraging" | "alert" | "excited" | "approval";
  glasses?: boolean;
  size?: number;
  className?: string;
};

const emotionOverlay: Record<NonNullable<Props["emotion"]>, string> = {
  neutral: "",
  encouraging: "🌟",
  alert: "⚠️",
  excited: "🎉",
  approval: "✅"
};

function objectPosition(role: Props["role"]): string {
  return role === "manager" ? "41% 33%" : "67% 35%";
}

function emotionContainerClass(emotion: NonNullable<Props["emotion"]>): string {
  if (emotion === "alert") {
    return "ring-2 ring-amber-300 shadow-[0_6px_16px_rgba(245,158,11,0.35)]";
  }
  if (emotion === "excited") {
    return "ring-2 ring-emerald-200 shadow-[0_8px_18px_rgba(16,185,129,0.28)]";
  }
  if (emotion === "approval") {
    return "ring-2 ring-indigo-200 shadow-[0_8px_18px_rgba(79,70,229,0.24)]";
  }
  if (emotion === "encouraging") {
    return "ring-2 ring-cyan-200 shadow-[0_8px_18px_rgba(34,211,238,0.22)]";
  }
  return "ring-2 ring-white/70 shadow-sm";
}

function emotionMotionClass(emotion: NonNullable<Props["emotion"]>): string {
  if (emotion === "alert") {
    return "anim-shake-soft";
  }
  if (emotion === "excited") {
    return "anim-bounce-soft";
  }
  if (emotion === "approval") {
    return "anim-float";
  }
  if (emotion === "encouraging") {
    return "anim-pulse-soft";
  }
  return "";
}

export function ChibiAvatar({ role, emotion = "neutral", glasses = false, size = 56, className = "" }: Props) {
  const marker = emotionOverlay[emotion];

  return (
    <div
      className={`relative overflow-hidden rounded-full bg-white ${emotionContainerClass(emotion)} ${emotionMotionClass(
        emotion
      )} ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        alt={role === "manager" ? "Manager chibi" : "User chibi"}
        fill
        priority={false}
        sizes={`${size}px`}
        src="/images/login-hero.svg"
        style={{ objectFit: "cover", objectPosition: objectPosition(role), transform: role === "manager" ? "scale(2.1)" : "scale(2.0)" }}
      />
      {role === "user" && glasses && (
        <span className="absolute -bottom-1 -right-1 rounded-full bg-indigo-100 px-1 text-[10px] text-indigo-700">👓</span>
      )}
      {marker && <span className="anim-pop absolute -top-1 -left-1 text-sm">{marker}</span>}
    </div>
  );
}
