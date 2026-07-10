import "server-only";

import { createSign } from "node:crypto";

type GoogleDocDraftInput = {
  title: string;
  content: string;
};

type GoogleDocDraftResult =
  | { configured: true; ok: true; docId: string; docUrl: string }
  | { configured: true; ok: false; error: string }
  | { configured: false; ok: false; error: string };

const googleDocsScope = "https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/drive.file";
const googleTokenUrl = "https://oauth2.googleapis.com/token";
const googleDocMimeType = "application/vnd.google-apps.document";

export function isGoogleDocsConfigured() {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY);
}

export async function createGoogleDocDraft(input: GoogleDocDraftInput): Promise<GoogleDocDraftResult> {
  if (!isGoogleDocsConfigured()) {
    return {
      configured: false,
      ok: false,
      error: "Google Docs is not configured. Add GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY.",
    };
  }

  try {
    const accessToken = await getGoogleAccessToken();
    const doc = await createDriveDocument(accessToken, input.title);
    await insertDocumentText(accessToken, doc.id, input.content);
    await shareDocumentIfNeeded(accessToken, doc.id);

    return { configured: true, ok: true, docId: doc.id, docUrl: doc.webViewLink ?? `https://docs.google.com/document/d/${doc.id}/edit` };
  } catch (error) {
    return { configured: true, ok: false, error: error instanceof Error ? error.message : "Google Docs draft creation failed." };
  }
}

async function getGoogleAccessToken() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!email || !privateKey) {
    throw new Error("Google service account credentials are missing.");
  }

  const now = Math.floor(Date.now() / 1000);
  const assertion = signJwt(
    {
      alg: "RS256",
      typ: "JWT",
    },
    {
      iss: email,
      scope: googleDocsScope,
      aud: googleTokenUrl,
      iat: now,
      exp: now + 3600,
    },
    privateKey,
  );

  const response = await fetch(googleTokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  const data = (await response.json().catch(() => null)) as { access_token?: string; error?: string; error_description?: string } | null;

  if (!response.ok || !data?.access_token) {
    throw new Error(data?.error_description || data?.error || `Google token request failed with ${response.status}.`);
  }

  return data.access_token;
}

function signJwt(header: Record<string, unknown>, claimSet: Record<string, unknown>, privateKey: string) {
  const unsigned = `${base64UrlJson(header)}.${base64UrlJson(claimSet)}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(privateKey);
  return `${unsigned}.${base64Url(signature)}`;
}

function base64UrlJson(value: Record<string, unknown>) {
  return base64Url(Buffer.from(JSON.stringify(value), "utf8"));
}

function base64Url(value: Buffer) {
  return value.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function createDriveDocument(accessToken: string, title: string) {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const response = await fetch("https://www.googleapis.com/drive/v3/files?fields=id,webViewLink", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: title,
      mimeType: googleDocMimeType,
      ...(folderId ? { parents: [folderId] } : {}),
    }),
  });

  const data = (await response.json().catch(() => null)) as { id?: string; webViewLink?: string; error?: { message?: string } } | null;

  if (!response.ok || !data?.id) {
    throw new Error(data?.error?.message || `Google Drive document creation failed with ${response.status}.`);
  }

  return { id: data.id, webViewLink: data.webViewLink };
}

async function insertDocumentText(accessToken: string, docId: string, content: string) {
  const response = await fetch(`https://docs.googleapis.com/v1/documents/${encodeURIComponent(docId)}:batchUpdate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [
        {
          insertText: {
            location: { index: 1 },
            text: content,
          },
        },
      ],
    }),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(data?.error?.message || `Google Docs update failed with ${response.status}.`);
  }
}

async function shareDocumentIfNeeded(accessToken: string, docId: string) {
  const reviewerEmail = process.env.GOOGLE_DOC_REVIEWER_EMAIL;
  if (!reviewerEmail) {
    return;
  }

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(docId)}/permissions?sendNotificationEmail=false`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "user",
        role: "writer",
        emailAddress: reviewerEmail,
      }),
    },
  );

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(data?.error?.message || `Google Docs sharing failed with ${response.status}.`);
  }
}
