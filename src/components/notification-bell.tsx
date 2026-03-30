"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  ListFilter,
  Megaphone,
  Shield,
  Target,
  X
} from "lucide-react";
import { AppNotification, Locale } from "@/lib/types";
import { ChibiAvatar } from "@/components/chibi-avatar";

type Props = {
  notifications: AppNotification[];
  unreadCount: number;
  action: (formData: FormData) => Promise<void>;
  role: "user" | "manager";
  locale: Locale;
};

type NotificationTabId =
  | "all"
  | "manager_message"
  | "mission"
  | "review_points"
  | "rules"
  | "checkin"
  | "reward_claim";

type NotificationTab = {
  id: NotificationTabId;
  label: string;
};

type CategorizedNotification = {
  item: AppNotification;
  category: NotificationTabId;
};

function deriveCategory(item: AppNotification, role: "user" | "manager"): NotificationTabId {
  if (item.category && item.category !== "all") {
    return item.category as NotificationTabId;
  }

  const lowerTitle = item.title.toLowerCase();
  const lowerMessage = item.message.toLowerCase();
  const isMission =
    (item.deep_link ?? "").includes("/app/mission")
    || lowerTitle.includes("mission")
    || lowerMessage.includes("mission");
  const isRules =
    (item.deep_link ?? "").includes("/rules")
    || lowerTitle.includes("rule")
    || lowerMessage.includes("rule")
    || lowerTitle.includes("penalty")
    || lowerMessage.includes("penalty");

  if (role === "manager") {
    if (item.kind === "checkin_arrived") return "checkin";
    if (item.kind === "reward_claim_request") return "reward_claim";
    if (isMission) return "mission";
    return "manager_message";
  }

  if (isMission) return "mission";
  if (isRules) return "rules";
  if ((item.review_points ?? 0) !== 0 || (item.bonus_points ?? 0) > 0) return "review_points";
  return "manager_message";
}

function defaultCtaLabel(item: AppNotification, locale: Locale, role: "user" | "manager"): string {
  const isKo = locale === "ko";
  const category = deriveCategory(item, role);
  if (category === "rules") return isKo ? "업데이트 규칙 확인" : "Check updated rules";
  if (category === "mission") return isKo ? "미션 열기" : "Open mission";
  if (category === "review_points") return isKo ? "리뷰 보기" : "Open review";
  if (category === "checkin") return isKo ? "리뷰 열기" : "Open review";
  if (category === "reward_claim") return isKo ? "요청 보기" : "Open claim";
  return isKo ? "열기" : "Open";
}

function categoryLabel(category: NotificationTabId, locale: Locale): string {
  const isKo = locale === "ko";
  switch (category) {
    case "mission":
      return isKo ? "미션" : "Missions";
    case "review_points":
      return isKo ? "리뷰/포인트" : "Reviews & Points";
    case "rules":
      return isKo ? "룰 업데이트" : "Rule Updates";
    case "checkin":
      return isKo ? "체크인" : "Check-ins";
    case "reward_claim":
      return isKo ? "리워드 요청" : "Reward Claims";
    case "manager_message":
      return isKo ? "공지" : "Manager Msg";
    default:
      return isKo ? "전체" : "All";
  }
}

function categoryIcon(category: NotificationTabId) {
  switch (category) {
    case "mission":
      return <Target size={13} />;
    case "review_points":
      return <ClipboardCheck size={13} />;
    case "rules":
      return <Shield size={13} />;
    default:
      return <Megaphone size={13} />;
  }
}

export function NotificationBell({ notifications, unreadCount, action, role, locale }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<AppNotification | null>(null);
  const [selectedBonus, setSelectedBonus] = useState<AppNotification | null>(null);
  const [bonusStep, setBonusStep] = useState<"teaser" | "detail">("teaser");
  const [activeTab, setActiveTab] = useState<NotificationTabId>("all");
  const hasNew = unreadCount > 0;
  const isKo = locale === "ko";

  const tabs = useMemo<NotificationTab[]>(() => {
    if (role === "manager") {
      return [
        { id: "all", label: isKo ? "전체" : "All" },
        { id: "checkin", label: isKo ? "체크인" : "Check-ins" },
        { id: "reward_claim", label: isKo ? "클레임" : "Claims" },
        { id: "mission", label: isKo ? "미션" : "Missions" },
        { id: "manager_message", label: isKo ? "공지" : "Broadcasts" }
      ];
    }

    return [
      { id: "all", label: isKo ? "전체" : "All" },
      { id: "mission", label: isKo ? "미션" : "Missions" },
      { id: "review_points", label: isKo ? "리뷰/포인트" : "Reviews" },
      { id: "rules", label: isKo ? "룰" : "Rules" },
      { id: "manager_message", label: isKo ? "공지" : "Notices" }
    ];
  }, [isKo, role]);

  const categorizedNotifications = useMemo<CategorizedNotification[]>(
    () => notifications.map((item) => ({ item, category: deriveCategory(item, role) })),
    [notifications, role]
  );

  const countsByTab = useMemo(() => {
    const counts = new Map<NotificationTabId, number>();
    counts.set("all", categorizedNotifications.length);
    for (const { category } of categorizedNotifications) {
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
    return counts;
  }, [categorizedNotifications]);

  const visibleNotifications = useMemo<CategorizedNotification[]>(() => {
    if (activeTab === "all") return categorizedNotifications;
    return categorizedNotifications.filter((entry) => entry.category === activeTab);
  }, [activeTab, categorizedNotifications]);

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
      setActiveTab("all");
    }

    window.addEventListener("workmonster:open-notifications", handleOpenNotifications);
    return () => window.removeEventListener("workmonster:open-notifications", handleOpenNotifications);
  }, []);

  useEffect(() => {
    if (!open && !selected && !selectedBonus) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open, selected, selectedBonus]);

  useEffect(() => {
    if (!open && !selected && !selectedBonus) return undefined;
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      setSelected(null);
      setSelectedBonus(null);
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, selected, selectedBonus]);

  function navigateTo(link: string) {
    if (!link) return;
    const trimmed = link.trim();
    if (!trimmed) return;

    if (/^https?:\/\//i.test(trimmed)) {
      try {
        const url = new URL(trimmed);
        if (typeof window !== "undefined" && url.origin === window.location.origin) {
          router.push(`${url.pathname}${url.search}${url.hash}`);
          return;
        }
      } catch {
        // fallthrough
      }
      window.location.href = trimmed;
      return;
    }

    router.push(trimmed);
  }

  function openByLink(link?: string) {
    if (!link) return;
    setOpen(false);
    navigateTo(link);
  }

  function openBonus(item: AppNotification) {
    setOpen(false);
    setSelectedBonus(item);
    setBonusStep("teaser");
  }

  function openAnnouncementDetail(item: AppNotification) {
    setOpen(false);
    setSelected(item);
  }

  return (
    <>
      <button
        aria-label="Open notifications"
        id="global-notification-bell-trigger"
        className="relative rounded-full bg-indigo-100 p-2 text-indigo-900"
        onClick={() => {
          setOpen(true);
          setActiveTab("all");
        }}
        type="button"
      >
        <Bell size={18} />
        {hasNew && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white" />}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-start justify-center overflow-hidden bg-slate-950/62 px-2 pb-[calc(0.75rem+var(--safe-bottom))] pt-[calc(0.75rem+var(--safe-top))] backdrop-blur-[3px] sm:items-center sm:px-6 sm:py-6"
          onClick={() => setOpen(false)}
        >
          <section
            className="anim-pop flex w-full max-w-3xl max-h-[calc(100dvh-var(--safe-top)-var(--safe-bottom)-1.5rem)] flex-col overflow-hidden rounded-[1.55rem] border border-indigo-100 bg-[#f8faff] shadow-[0_36px_80px_rgba(15,23,42,0.45)] sm:h-[88dvh] sm:max-h-[760px] sm:rounded-[1.75rem]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-indigo-100 bg-white/95 px-4 pb-3 pt-4 sm:px-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xl font-black text-indigo-900">{isKo ? "알림" : "Notifications"}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {isKo ? "카테고리별로 빠르게 확인하고 바로 이동하세요." : "Scan by category and jump to action fast."}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-[11px] font-black text-indigo-700">
                    {isKo ? `읽지 않음 ${unreadCount}` : `${unreadCount} unread`}
                  </span>
                  <button
                    aria-label="Close notifications"
                    className="rounded-full bg-slate-100 p-2 text-slate-600 hover:bg-slate-200"
                    onClick={() => setOpen(false)}
                    type="button"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className="-mx-1 mt-3 flex items-center gap-2 overflow-x-auto px-1 pb-1">
                {tabs.map((tab) => {
                  const count = countsByTab.get(tab.id) ?? 0;
                  const active = tab.id === activeTab;
                  return (
                    <button
                      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                        active
                          ? "border-indigo-500 bg-indigo-600 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-700"
                      }`}
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      type="button"
                    >
                      <ListFilter size={12} />
                      {tab.label}
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                          active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 pb-24 pt-3 sm:px-4">
              {visibleNotifications.length > 0 ? (
                <ul className="space-y-2.5">
                  {visibleNotifications.map(({ item, category }) => {
                    const deepLink = item.cta_link || item.deep_link;
                    const bonusOnly = item.kind === "manager_update" && (item.bonus_points ?? 0) > 0;
                    const canOpenModal = item.kind === "announcement";
                    return (
                      <li key={item.id}>
                        <article
                          className={`rounded-2xl border p-3.5 shadow-sm ${
                            item.is_new ? "border-indigo-200 bg-white" : "border-slate-200 bg-slate-50/70"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                              {categoryIcon(category)}
                              {categoryLabel(category, locale)}
                              {item.is_new ? (
                                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-700">NEW</span>
                              ) : null}
                            </p>
                            {(item.review_points ?? 0) < 0 ? (
                              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700">
                                {item.review_points} pts
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1.5 text-[15px] font-black leading-5 text-indigo-900">{item.title}</p>
                          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{item.message}</p>

                          {(item.mission_due_date || item.mission_bonus_points) && (
                            <p className="mt-2 text-[11px] font-semibold text-slate-500">
                              {item.mission_due_date ? `Due ${item.mission_due_date}` : "Due flexible"}
                              {typeof item.mission_bonus_points === "number" && item.mission_bonus_points > 0
                                ? ` • +${item.mission_bonus_points} pts`
                                : ""}
                            </p>
                          )}

                          {(item.bonus_points ?? 0) > 0 && (
                            <p className="mt-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                              🎁 Bonus +{item.bonus_points}
                            </p>
                          )}

                          <div className="mt-3 flex items-center justify-between gap-2">
                            <p className="text-[11px] text-slate-500">{new Date(item.created_at).toLocaleString()}</p>
                            {bonusOnly ? (
                              <button
                                className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700"
                                onClick={() => openBonus(item)}
                                type="button"
                              >
                                {isKo ? "보너스 보기" : "Open bonus"}
                                <ChevronRight size={13} />
                              </button>
                            ) : deepLink ? (
                              <button
                                className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-bold text-indigo-700"
                                onClick={() => openByLink(deepLink)}
                                type="button"
                              >
                                {item.cta_label?.trim() || defaultCtaLabel(item, locale, role)}
                                <ChevronRight size={13} />
                              </button>
                            ) : canOpenModal ? (
                              <button
                                className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2.5 py-1 text-xs font-bold text-slate-700"
                                onClick={() => openAnnouncementDetail(item)}
                                type="button"
                              >
                                {isKo ? "상세 보기" : "View"}
                                <ChevronRight size={13} />
                              </button>
                            ) : null}
                          </div>
                        </article>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">{emptyLabel}</p>
              )}
            </div>

            <div className="border-t border-indigo-100 bg-white/95 p-4">
              <form action={action}>
                <button className="btn btn-primary w-full" type="submit">
                  <span className="inline-flex items-center gap-2">
                    <CheckCircle2 size={14} />
                    {isKo ? "모두 읽음 처리" : "Mark all as read"}
                  </span>
                </button>
              </form>
            </div>
          </section>
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
              <h3 className="mt-1 text-xl font-black text-indigo-900">
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
              <h3 className="mt-1 text-xl font-black text-indigo-900">
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
                    setSelectedBonus(null);
                    navigateTo(target);
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
