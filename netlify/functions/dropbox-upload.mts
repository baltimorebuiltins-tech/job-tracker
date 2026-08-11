import type { Config } from "@netlify/functions";

async function getDropboxAccessToken(): Promise<string> {
  const refreshToken = Netlify.env.get("DROPBOX_REFRESH_TOKEN");
  const appKey = Netlify.env.get("DROPBOX_APP_KEY");
  const appSecret = Netlify.env.get("DROPBOX_APP_SECRET");

  if (!refreshToken || !appKey || !appSecret) {
    throw new Error(
      "Dropbox is not configured yet (missing DROPBOX_REFRESH_TOKEN / DROPBOX_APP_KEY / DROPBOX_APP_SECRET)."
    );
  }

  const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: appKey,
      client_secret: appSecret,
    }),
  });

  if (!res.ok) {
    throw new Error("Failed to refresh Dropbox token: " + (await res.text()));
  }
  const data = await res.json();
  return data.access_token as string;
}

export default async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
    });
  }

  try {
    const { path, fileName, fileBase64 } = await req.json();
    if (!path || !fileName || !fileBase64) {
      return new Response(
        JSON.stringify({ error: "Missing path, fileName, or fileBase64" }),
        { status: 400 }
      );
    }

    const accessToken = await getDropboxAccessToken();
    const fileBuffer = Buffer.from(fileBase64, "base64");
    const dropboxPath = `${path}/${fileName}`.replace(/\/{2,}/g, "/");

    const uploadRes = await fetch("https://content.dropboxapi.com/2/files/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/octet-stream",
        "Dropbox-API-Arg": JSON.stringify({
          path: dropboxPath,
          mode: "add",
          autorename: true,
          mute: false,
        }),
      },
      body: fileBuffer,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      return new Response(
        JSON.stringify({ error: "Dropbox upload failed", detail: errText }),
        { status: 502 }
      );
    }
    const uploaded = await uploadRes.json();

    // Try to create a shared link; fall back to an existing one if it's already shared.
    let sharedLink: string | null = null;
    const linkRes = await fetch(
      "https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ path: uploaded.path_lower }),
      }
    );
    if (linkRes.ok) {
      const linkData = await linkRes.json();
      sharedLink = linkData.url ?? null;
    } else {
      const existingRes = await fetch(
        "https://api.dropboxapi.com/2/sharing/list_shared_links",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ path: uploaded.path_lower, direct_only: true }),
        }
      );
      if (existingRes.ok) {
        const existingData = await existingRes.json();
        sharedLink = existingData.links?.[0]?.url ?? null;
      }
    }

    return new Response(
      JSON.stringify({
        dropboxPath: uploaded.path_display,
        sizeBytes: uploaded.size,
        sharedLink,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message ?? "Unknown error" }), {
      status: 500,
    });
  }
};

export const config: Config = {
  path: "/api/dropbox-upload",
};
