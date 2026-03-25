"use client";

import { ChangeEvent, FormEvent, PointerEvent, useMemo, useRef, useState } from "react";
import { Camera, CheckCircle2, Image as ImageIcon, Loader2, Smile } from "lucide-react";

type Props = {
  locale: "en" | "ko";
  initialMode?: "emoji" | "image";
  initialEmoji?: string;
  initialImageUrl?: string;
};

const PREVIEW_SIZE = 176;
const MAX_FILE_BYTES = 2 * 1024 * 1024;

type ImgMeta = {
  width: number;
  height: number;
};

function copyByLocale(locale: Props["locale"]) {
  if (locale === "ko") {
    return {
      sectionTitle: "프로필 이미지 편집",
      sectionDesc: "이모지 또는 사진으로 프로필을 설정할 수 있어요.",
      emojiMode: "이모지",
      photoMode: "사진",
      emojiLabel: "이모지",
      emojiPlaceholder: "😺",
      photoLabel: "사진 업로드",
      photoHint: "앨범에서 사진 선택 후 줌/위치 조절",
      zoom: "줌",
      save: "저장하기",
      saving: "저장 중...",
      success: "프로필 이미지가 저장되었어요.",
      failed: "저장에 실패했어요.",
      fileTooLarge: "2MB 이하 이미지 파일만 업로드할 수 있어요.",
      fileType: "이미지 파일만 업로드할 수 있어요.",
      noImage: "먼저 사진을 선택해 주세요.",
      moveHint: "원 안에서 드래그하여 위치를 조절하세요.",
      clearPhoto: "사진 제거"
    };
  }

  return {
    sectionTitle: "Edit profile image",
    sectionDesc: "Set your profile with emoji or photo.",
    emojiMode: "Emoji",
    photoMode: "Photo",
    emojiLabel: "Emoji",
    emojiPlaceholder: "😺",
    photoLabel: "Upload photo",
    photoHint: "Pick from album, then zoom and position.",
    zoom: "Zoom",
    save: "Save profile image",
    saving: "Saving...",
    success: "Profile image saved.",
    failed: "Failed to save profile image.",
    fileTooLarge: "Please upload an image under 2MB.",
    fileType: "Please upload an image file.",
    noImage: "Please choose an image first.",
    moveHint: "Drag inside the circle to position your photo.",
    clearPhoto: "Remove photo"
  };
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("File read failed."));
    reader.readAsDataURL(file);
  });
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image load failed."));
    img.src = src;
  });
}

async function renderCroppedAvatar(params: {
  src: string;
  zoom: number;
  offsetX: number;
  offsetY: number;
  meta: ImgMeta;
}): Promise<string> {
  const { src, zoom, offsetX, offsetY, meta } = params;
  const source = await loadImage(src);
  const canvas = document.createElement("canvas");
  const size = 512;
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported.");

  const baseScale = Math.max(PREVIEW_SIZE / meta.width, PREVIEW_SIZE / meta.height);
  const drawW = meta.width * baseScale * zoom * (size / PREVIEW_SIZE);
  const drawH = meta.height * baseScale * zoom * (size / PREVIEW_SIZE);
  const drawX = size / 2 + (offsetX / PREVIEW_SIZE) * size - drawW / 2;
  const drawY = size / 2 + (offsetY / PREVIEW_SIZE) * size - drawH / 2;

  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(source, drawX, drawY, drawW, drawH);
  return canvas.toDataURL("image/jpeg", 0.92);
}

export function ProfileAvatarEditor({
  locale,
  initialMode = "emoji",
  initialEmoji = "😺",
  initialImageUrl = ""
}: Props) {
  const copy = useMemo(() => copyByLocale(locale), [locale]);
  const [mode, setMode] = useState<"emoji" | "image">(initialMode);
  const [emoji, setEmoji] = useState(initialEmoji || "😺");
  const [imageSrc, setImageSrc] = useState(initialImageUrl || "");
  const [imgMeta, setImgMeta] = useState<ImgMeta | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const dragStartRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const baseSize = useMemo(() => {
    if (!imgMeta) return { width: PREVIEW_SIZE, height: PREVIEW_SIZE };
    const scale = Math.max(PREVIEW_SIZE / imgMeta.width, PREVIEW_SIZE / imgMeta.height);
    return {
      width: imgMeta.width * scale,
      height: imgMeta.height * scale
    };
  }, [imgMeta]);

  function clampOffset(nextX: number, nextY: number) {
    const limitX = Math.max(0, ((baseSize.width * zoom) - PREVIEW_SIZE) / 2);
    const limitY = Math.max(0, ((baseSize.height * zoom) - PREVIEW_SIZE) / 2);
    return {
      x: Math.min(limitX, Math.max(-limitX, nextX)),
      y: Math.min(limitY, Math.max(-limitY, nextY))
    };
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (mode !== "image" || !imageSrc) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      ox: offsetX,
      oy: offsetY
    };
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!isDragging || !dragStartRef.current) return;
    const dx = event.clientX - dragStartRef.current.x;
    const dy = event.clientY - dragStartRef.current.y;
    const clamped = clampOffset(dragStartRef.current.ox + dx, dragStartRef.current.oy + dy);
    setOffsetX(clamped.x);
    setOffsetY(clamped.y);
  }

  function stopDrag() {
    setIsDragging(false);
    dragStartRef.current = null;
  }

  function onZoomChange(nextZoom: number) {
    const clampedZoom = Math.min(3, Math.max(1, nextZoom));
    setZoom(clampedZoom);
    const clamped = clampOffset(offsetX, offsetY);
    setOffsetX(clamped.x);
    setOffsetY(clamped.y);
  }

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessage({ type: "error", text: copy.fileType });
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setMessage({ type: "error", text: copy.fileTooLarge });
      return;
    }

    const url = await readFileAsDataURL(file);
    const temp = await loadImage(url);
    setImageSrc(url);
    setImgMeta({ width: temp.naturalWidth || temp.width, height: temp.naturalHeight || temp.height });
    setMode("image");
    setZoom(1);
    setOffsetX(0);
    setOffsetY(0);
    setMessage(null);
  }

  async function saveAvatar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);

    try {
      const body = new FormData();
      body.set("avatar_mode", mode);
      body.set("avatar_emoji", emoji.trim() || "😺");

      if (mode === "image") {
        if (!imageSrc || !imgMeta) throw new Error(copy.noImage);
        const cropped = await renderCroppedAvatar({
          src: imageSrc,
          zoom,
          offsetX,
          offsetY,
          meta: imgMeta
        });
        body.set("avatar_url", cropped);
      } else {
        body.set("avatar_url", "");
      }

      const response = await fetch("/api/account/avatar", {
        method: "POST",
        body
      });

      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || copy.failed);
      }

      setMessage({ type: "success", text: copy.success });
      window.setTimeout(() => {
        window.location.reload();
      }, 650);
    } catch (error) {
      const text = error instanceof Error ? error.message : copy.failed;
      setMessage({ type: "error", text });
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mt-3 rounded-2xl bg-slate-50 p-3">
      <p className="text-sm font-bold text-indigo-700">{copy.sectionTitle}</p>
      <p className="mt-1 text-xs text-slate-600">{copy.sectionDesc}</p>

      <form className="mt-3 space-y-3" onSubmit={saveAvatar}>
        <div className="grid grid-cols-2 rounded-2xl bg-slate-100 p-1">
          <button
            className={`rounded-xl px-3 py-2 text-sm font-bold ${mode === "emoji" ? "bg-white text-indigo-900" : "text-slate-600"}`}
            onClick={() => setMode("emoji")}
            type="button"
          >
            <span className="inline-flex items-center gap-1">
              <Smile size={15} />
              {copy.emojiMode}
            </span>
          </button>
          <button
            className={`rounded-xl px-3 py-2 text-sm font-bold ${mode === "image" ? "bg-white text-indigo-900" : "text-slate-600"}`}
            onClick={() => setMode("image")}
            type="button"
          >
            <span className="inline-flex items-center gap-1">
              <ImageIcon size={15} />
              {copy.photoMode}
            </span>
          </button>
        </div>

        {mode === "emoji" ? (
          <label className="block">
            <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-500">{copy.emojiLabel}</span>
            <input
              className="input"
              maxLength={2}
              onChange={(event) => setEmoji(event.target.value)}
              placeholder={copy.emojiPlaceholder}
              type="text"
              value={emoji}
            />
          </label>
        ) : (
          <>
            <label className="block">
              <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-500">{copy.photoLabel}</span>
              <input className="input cursor-pointer" accept="image/*" onChange={onFileChange} type="file" />
              <p className="mt-2 text-xs text-slate-500">{copy.photoHint}</p>
            </label>

            <div className="rounded-2xl bg-slate-100 p-3">
              <div
                className="mx-auto flex h-52 w-52 items-center justify-center rounded-2xl bg-slate-200"
                onPointerCancel={stopDrag}
                onPointerDown={onPointerDown}
                onPointerLeave={stopDrag}
                onPointerMove={onPointerMove}
                onPointerUp={stopDrag}
                role="presentation"
              >
                <div className="relative h-44 w-44 overflow-hidden rounded-full border-4 border-white shadow-lg">
                  {imageSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt="Avatar preview"
                      className={`${isDragging ? "cursor-grabbing" : "cursor-grab"} select-none`}
                      draggable={false}
                      src={imageSrc}
                      style={{
                        width: `${baseSize.width}px`,
                        height: `${baseSize.height}px`,
                        left: "50%",
                        top: "50%",
                        position: "absolute",
                        transform: `translate(-50%, -50%) translate(${offsetX}px, ${offsetY}px) scale(${zoom})`,
                        transformOrigin: "center center",
                        userSelect: "none"
                      }}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-slate-300 text-slate-500">
                      <Camera size={26} />
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-0 border border-white/70" />
                </div>
              </div>
              <p className="mt-2 text-center text-xs text-slate-500">{copy.moveHint}</p>
            </div>

            <label className="block">
              <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-500">{copy.zoom}</span>
              <input
                className="w-full accent-indigo-600"
                max={3}
                min={1}
                onChange={(event) => onZoomChange(Number(event.target.value))}
                step={0.01}
                type="range"
                value={zoom}
              />
            </label>

            {imageSrc && (
              <button
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                onClick={() => {
                  setImageSrc("");
                  setImgMeta(null);
                  setZoom(1);
                  setOffsetX(0);
                  setOffsetY(0);
                }}
                type="button"
              >
                {copy.clearPhoto}
              </button>
            )}
          </>
        )}

        <button className="btn btn-primary w-full" disabled={pending} type="submit">
          {pending ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="animate-spin" size={16} />
              {copy.saving}
            </span>
          ) : (
            copy.save
          )}
        </button>
      </form>

      {message && (
        <div className="fixed inset-x-0 bottom-24 z-[90] mx-auto w-[min(100%,24rem)] px-4">
          <div
            className={`anim-pop rounded-2xl border px-4 py-3 shadow-lg ${
              message.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-rose-200 bg-rose-50 text-rose-900"
            }`}
          >
            <p className="flex items-center gap-2 text-sm font-semibold">
              {message.type === "success" ? <CheckCircle2 size={16} /> : "⚠️"}
              {message.text}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
