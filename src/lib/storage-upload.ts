import { createId, toISODate } from "@/lib/utils";
import { getAdminStorageBucket, isFirebaseServerConfigured } from "@/lib/firebase/admin";

function safeFileSegment(input: string): string {
  return input
    .trim()
    .replaceAll(/[^a-zA-Z0-9._-]+/g, "-")
    .replaceAll(/-+/g, "-")
    .replaceAll(/^-|-$/g, "")
    .slice(0, 80) || "file";
}

export async function uploadFileToStorage(params: {
  userId: string;
  source: "checkin" | "announcement";
  file: File;
  folderHint?: string;
}): Promise<{ url: string; path: string; contentType: string; size: number; fileName: string }> {
  const { file, source, userId } = params;
  const bytes = Buffer.from(await file.arrayBuffer());
  const contentType = file.type?.trim() || "application/octet-stream";
  const extensionFromName = file.name.includes(".") ? file.name.split(".").pop() ?? "" : "";
  const extensionFromType = contentType.includes("/") ? contentType.split("/").pop() ?? "" : "";
  const extension = (extensionFromName || extensionFromType || "bin").replaceAll(/[^a-zA-Z0-9]+/g, "").toLowerCase();
  const fileName = file.name.trim() || `${source}.${extension}`;
  const safeName = safeFileSegment(file.name.replace(/\.[^.]+$/, ""));
  const datedPath = `${source}/${params.folderHint?.trim() || toISODate()}`;
  const objectName = `${datedPath}/${safeFileSegment(userId)}/${createId("upload")}-${safeName}.${extension}`;

  if (!isFirebaseServerConfigured()) {
    const dataUrl = `data:${contentType};base64,${bytes.toString("base64")}`;
    return {
      url: dataUrl,
      path: objectName,
      contentType,
      size: file.size,
      fileName
    };
  }

  const bucket = getAdminStorageBucket();
  const objectRef = bucket.file(objectName);
  await objectRef.save(bytes, {
    resumable: false,
    contentType,
    metadata: {
      cacheControl: "public, max-age=31536000",
      metadata: {
        source,
        userId,
        originalName: fileName
      }
    }
  });

  const [url] = await objectRef.getSignedUrl({
    action: "read",
    expires: "2499-12-31"
  });

  return {
    url,
    path: objectName,
    contentType,
    size: file.size,
    fileName
  };
}
