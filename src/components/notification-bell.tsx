"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, X } from "lucide-react";
import { AppNotification, Locale } from "@/lib/types";
import { ChibiAvatar } from "@/components/chibi-avatar";

type Props = {
  notifications: AppNotification[];
  unreadCount: number;
  action: (formData: FormData) => Promise<void>;
  role: "user" | "manager";
  locale: Locale;
};

export function NotificationBell({ notifications, unreadCount, action, role, locale }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<AppNotification | null>(null);
  const [selectedBonus, setSelectedBonus] = useState<AppNotification | null>(null);
  const [bonusStep, setBonusStep] = useState<"teaser" | "detail">("teaser");
  const hasNew = unreadCount > 0;
  const isKo = locale === "ko";

  const emptyLabel = useMemo(
    () =>
      role === "manager"
        ? isKo
          ? "새로운 매니저 알림이 없습니다."
          : "No new manager notifications."
        : isKo
          ? "새로운 유저 알림이 없습니다."
          : "No new user notifications.",
    [isKo, role]
  );

  useEffect(() => {
    function handleOpenNotifications() {
      setOpen(true);
    }

    window.addEventListener("workmonster:open-notifications", handleOpenNotifications);
    return () => window.removeEventListener("workmonster:open-notifications", handleOpenNotifications);
  }, []);

  return (
    <>
      <button
        aria-label="Open notifications"
        id="global-notification-bell-trigger"
        className="relative rounded-full bg-indigo-100 p-2 text-indigo-900"
        onClick={() => setOpen(true)}
        type="button"
      >
        <Bell size={18} />
        {hasNew && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white" />}
      </button>

      {open && (
        <div className="fixed inset-0 z-[68] bg-slate-950/35" onClick={() => setOpen(false)}>
          <div
            className={`h-full w-[84%] max-w-sm bg-white p-4 shadow-2xl ${role === "manager" ? "ml-auto" : "ml-auto"}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xl font-black text-indigo-900">Notifications</p>
              <button
                aria-label="Close notifications"
                className="rounded-full bg-slate-100 p-2"
                onClick={() => setOpen(false)}
                type="button"
              >
                <X size={16} />
              </button>
            </div>

            {notifications.length > 0 ? (
              <ul className="max-h-[70dvh] space-y-2 overflow-y-auto pr-1">
                {notifications.map((item) => (
                  <li key={item.id}>
                    <button
                      className="w-full rounded-xl bg-slate-100 p-3 text-left transition hover:bg-indigo-50"
                      onClick={() => {
                        if (item.kind === "manager_update" && (item.bonus_points ?? 0) > 0) {
                          setOpen(false);
                          setSelectedBonus(item);
                          setBonusStep("teaser");
                          return;
                        }
                        if (item.deep_link) {
                          window.location.href = item.deep_link;
                          return;
                        }
                        if (item.kind === "announcement") {
                          setSelected(item);
                        }
                      }}
                      type="button"
                    >
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                        {item.kind === "announcement" ? (isKo ? "공지" : "Announcement") : isKo ? "최근 업데이트" : "Recent update"}
                        {item.is_new ? " • NEW" : ""}
                      </p>
                      <p className="mt-1 text-sm font-bold text-indigo-900">{item.title}</p>
                      <p className="text-sm text-slate-600">{item.message}</p>
                      {(item.bonus_points ?? 0) > 0 && (
                        <p className="mt-1 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                          🎁 Bonus +{item.bonus_points}
                        </p>
                      )}
                      <p className="mt-1 text-[11px] text-slate-500">{new Date(item.created_at).toLocaleString()}</p>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl bg-slate-100 p-3 text-sm text-slate-600">{emptyLabel}</p>
            )}

            <form action={action} className="mt-3">
              <button className="btn btn-primary w-full" type="submit">
                {isKo ? "모두 읽음 처리" : "Mark all as read"}
              </button>
            </form>
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-[72] flex items-center justify-center bg-slate-950/45 p-4">
          <div className="container-mobile card anim-pop p-5">
            <div className="mb-3 flex items-center gap-3">
              <ChibiAvatar className="anim-float" emotion="encouraging" role="manager" size={60} />
              <div className="rounded-2xl bg-indigo-50 px-3 py-2 text-sm text-indigo-900">
                <p className="font-bold">Manager Message</p>
                <p>{selected.title}</p>
              </div>
            </div>
            <p className="rounded-2xl bg-slate-100 p-3 text-sm text-slate-700">{selected.message}</p>
            {selected.image_url && (
              <img
                alt="Manager announcement attachment"
                className="mt-3 max-h-60 w-full rounded-xl object-cover"
                src={selected.image_url}
              />
            )}
            <button className="btn btn-primary mt-4 w-full" onClick={() => setSelected(null)} type="button">
              {isKo ? "확인" : "Close"}
            </button>
          </div>
        </div>
      )}

      {selectedBonus && (
        <div className="fixed inset-0 z-[73] flex items-center justify-center bg-slate-950/45 p-4">
          {bonusStep === "teaser" ? (
            <div className="container-mobile card anim-pop relative overflow-hidden p-5 text-center">
              <span className="anim-confetti absolute left-[16%] top-6 text-xl">🎁</span>
              <span className="anim-confetti-delay absolute left-[78%] top-8 text-lg">✨</span>
              <span className="anim-confetti absolute left-[24%] top-16 text-lg">⭐</span>
              <span className="anim-confetti-delay absolute left-[70%] top-16 text-lg">🎉</span>

              <div className="mx-auto mb-3 flex items-center justify-center gap-2">
                <ChibiAvatar className="anim-float" emotion="approval" role="manager" size={58} />
                <span className="anim-bounce-soft text-3xl">🎁</span>
                <ChibiAvatar className="anim-bounce-soft" emotion="excited" role="user" size={58} />
              </div>

              <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-600">
                {isKo ? "보너스 선물 도착" : "Bonus Surprise"}
              </p>
              <h3 className="mt-1 text-2xl font-black text-indigo-900">
                {isKo ? "보너스 포인트를 받았어요!" : "You got bonus points!"}
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                {isKo
                  ? `매니저가 +${selectedBonus.bonus_points ?? 0} 보너스를 추가했어요.`
                  : `Manager added +${selectedBonus.bonus_points ?? 0} bonus points for you.`}
              </p>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button className="btn btn-muted w-full" onClick={() => setSelectedBonus(null)} type="button">
                  {isKo ? "닫기" : "Close"}
                </button>
                <button className="btn btn-energetic w-full" onClick={() => setBonusStep("detail")} type="button">
                  {isKo ? "확인하기" : "Check it out!"}
                </button>
              </div>
            </div>
          ) : (
            <div className="container-mobile card anim-pop p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">
                {isKo ? "보너스 상세" : "Bonus Details"}
              </p>
              <h3 className="mt-1 text-2xl font-black text-indigo-900">
                {isKo ? `+${selectedBonus.bonus_points ?? 0} 보너스 포인트` : `+${selectedBonus.bonus_points ?? 0} Bonus Points`}
              </h3>
              <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                {selectedBonus.bonus_message?.trim().length
                  ? selectedBonus.bonus_message
                  : isKo
                    ? "매니저가 깜짝 보너스를 지급했어요. 계속 달려봐요!"
                    : "Manager sent a surprise bonus. Keep your momentum going!"}
              </p>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button className="btn btn-muted w-full" onClick={() => setSelectedBonus(null)} type="button">
                  {isKo ? "닫기" : "Close"}
                </button>
                <button
                  className="btn btn-primary w-full"
                  onClick={() => {
                    const target = selectedBonus.deep_link || "/app/record";
                    window.location.href = target;
                  }}
                  type="button"
                >
                  {isKo ? "점수 확인으로 이동" : "Open score review"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
