import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { encodeStoredAttachment } from "@/lib/attachments";
import { uploadFileToStorage } from "@/lib/storage-upload";

const MAX_CHECKIN_ATTACHMENT_BYTES = 4 * 1024 * 1024; // 4MB stable limit for serverless/mobile uploads

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Session expired. Please login again." }, { status: 401 });
    }
    if (session.role === "manager") {
      return NextResponse.json({ error: "Manager preview mode cannot upload check-in files." }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size <= 0) {
      return NextResponse.json({ error: "Attachment file is required." }, { status: 400 });
    }
    if (file.size > MAX_CHECKIN_ATTACHMENT_BYTES) {
      return NextResponse.json(
        { error: "Please upload a file under 4MB." },
        { status: 413 }
      );
    }

    const uploaded = await uploadFileToStorage({
      userId: session.uid,
      source: "checkin",
      file
    });

    const kind = uploaded.contentType.startsWith("image/") ? "image" : "file";
    const attachmentToken = encodeStoredAttachment({
      name: uploaded.fileName,
      url: uploaded.url,
      kind,
      contentType: uploaded.contentType,
      size: uploaded.size
    });

    return NextResponse.json({
      ok: true,
      attachment: {
        token: attachmentToken,
        name: uploaded.fileName,
        url: uploaded.url,
        kind,
        contentType: uploaded.contentType,
        size: uploaded.size
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to upload attachment." },
      { status: 500 }
    );
  }
}
