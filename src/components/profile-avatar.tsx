type Props = {
  name?: string;
  emoji?: string;
  imageUrl?: string;
  size?: number;
  className?: string;
};

function firstLetter(name?: string): string {
  const trimmed = (name ?? "").trim();
  return trimmed.length > 0 ? trimmed.slice(0, 1).toUpperCase() : "W";
}

export function ProfileAvatar({ name, emoji, imageUrl, size = 34, className = "" }: Props) {
  const hasImage = typeof imageUrl === "string" && imageUrl.trim().length > 0;
  const safeEmoji = (emoji ?? "").trim();

  return (
    <span
      className={`inline-flex items-center justify-center overflow-hidden rounded-full bg-indigo-100 text-indigo-900 ring-2 ring-white ${className}`}
      style={{ width: size, height: size }}
    >
      {hasImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="Profile avatar" className="h-full w-full object-cover" src={imageUrl} />
      ) : safeEmoji ? (
        <span style={{ fontSize: Math.max(16, size * 0.48), lineHeight: 1 }}>{safeEmoji}</span>
      ) : (
        <span className="text-sm font-bold">{firstLetter(name)}</span>
      )}
    </span>
  );
}
