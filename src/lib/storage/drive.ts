import { Readable } from "node:stream";
import { safeId } from "./keys";

type DriveClient = {
  files: {
    list: (opts: Record<string, unknown>) => Promise<{ data: { files?: Array<{ id?: string | null }> } }>;
    create: (opts: Record<string, unknown>) => Promise<{ data: { id?: string | null } }>;
    update: (opts: Record<string, unknown>) => Promise<{ data: { id?: string | null } }>;
    get: (
      opts: Record<string, unknown>,
      extra?: Record<string, unknown>,
    ) => Promise<{ data: ArrayBuffer | Buffer | string }>;
  };
};

type ServiceAccount = {
  client_email?: string;
  private_key?: string;
};

function readServiceAccount(): ServiceAccount {
  const raw = String(process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON || "").trim();
  if (!raw) {
    throw Object.assign(
      new Error("Google Drive is not configured on the server"),
      { status: 503 },
    );
  }
  try {
    const json = raw.startsWith("{")
      ? raw
      : Buffer.from(raw, "base64").toString("utf8");
    return JSON.parse(json) as ServiceAccount;
  } catch {
    throw Object.assign(new Error("Invalid GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON"), {
      status: 503,
    });
  }
}

function invoicesRootFolderId(): string {
  const id = String(process.env.GOOGLE_DRIVE_INVOICES_FOLDER_ID || "").trim();
  if (!id) {
    throw Object.assign(
      new Error("GOOGLE_DRIVE_INVOICES_FOLDER_ID is required"),
      { status: 503 },
    );
  }
  return id;
}

export function isGoogleDriveConfigured(): boolean {
  try {
    readServiceAccount();
    invoicesRootFolderId();
    return true;
  } catch {
    return false;
  }
}

let cachedDrive: DriveClient | null = null;
const folderCache = new Map<string, string>();

async function getDrive(): Promise<DriveClient> {
  if (cachedDrive) return cachedDrive;
  const credentials = readServiceAccount();
  if (!credentials.client_email || !credentials.private_key) {
    throw Object.assign(new Error("Google Drive service account is incomplete"), {
      status: 503,
    });
  }
  const { google } = await import("googleapis");
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  cachedDrive = google.drive({ version: "v3", auth }) as unknown as DriveClient;
  return cachedDrive;
}

async function findChildFolder(parentId: string, name: string): Promise<string | null> {
  const drive = await getDrive();
  const safeName = name.replace(/'/g, "\\'");
  const result = await drive.files.list({
    q: `'${parentId}' in parents and name = '${safeName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id, name)",
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return result.data.files?.[0]?.id || null;
}

async function findOrCreateFolder(parentId: string, name: string): Promise<string> {
  const cacheKey = `${parentId}/${name}`;
  const cached = folderCache.get(cacheKey);
  if (cached) return cached;
  const existing = await findChildFolder(parentId, name);
  if (existing) {
    folderCache.set(cacheKey, existing);
    return existing;
  }
  const drive = await getDrive();
  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id",
    supportsAllDrives: true,
  });
  const id = String(created.data.id || "");
  if (!id) throw new Error("Could not create Google Drive folder");
  folderCache.set(cacheKey, id);
  return id;
}

async function findFileInFolder(parentId: string, fileName: string): Promise<string | null> {
  const drive = await getDrive();
  const safeName = fileName.replace(/'/g, "\\'");
  const result = await drive.files.list({
    q: `'${parentId}' in parents and name = '${safeName}' and trashed = false`,
    fields: "files(id, name)",
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return result.data.files?.[0]?.id || null;
}

export async function uploadInvoicePdfToDrive(options: {
  buffer: Buffer;
  fileName: string;
  year: string;
  month: string;
  overwriteFileId?: string;
}): Promise<{
  fileId: string;
  folderId: string;
  fileName: string;
  mimeType: string;
  bytes: number;
}> {
  const fileName = safeId(options.fileName.replace(/\.pdf$/i, ""), "invoice") + ".pdf";
  const drive = await getDrive();
  const invoicesRoot = invoicesRootFolderId();
  const yearFolder = await findOrCreateFolder(invoicesRoot, String(options.year));
  const monthFolder = await findOrCreateFolder(yearFolder, String(options.month));

  const media = {
    mimeType: "application/pdf",
    body: Readable.from(options.buffer),
  };

  let fileId = String(options.overwriteFileId || "").trim();
  if (!fileId) {
    fileId = (await findFileInFolder(monthFolder, fileName)) || "";
  }

  if (fileId) {
    await drive.files.update({
      fileId,
      media,
      fields: "id",
      supportsAllDrives: true,
    });
  } else {
    const created = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [monthFolder],
        mimeType: "application/pdf",
      },
      media,
      fields: "id",
      supportsAllDrives: true,
    });
    fileId = String(created.data.id || "");
  }

  if (!fileId) throw new Error("Google Drive upload returned no file id");

  return {
    fileId,
    folderId: monthFolder,
    fileName,
    mimeType: "application/pdf",
    bytes: options.buffer.length,
  };
}

export async function downloadDriveFile(fileId: string): Promise<Buffer> {
  const id = String(fileId || "").trim();
  if (!id) throw new Error("Missing Google Drive file id");
  const drive = await getDrive();
  const result = await drive.files.get(
    {
      fileId: id,
      alt: "media",
      supportsAllDrives: true,
    },
    { responseType: "arraybuffer" },
  );
  const data = result.data as ArrayBuffer | Buffer | string;
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (typeof data === "string") return Buffer.from(data);
  throw new Error("Invoice PDF is not available");
}
