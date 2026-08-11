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
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  try {
    const { path } = await req.json();
    if (!path) {
      return new Response(JSON.stringify({ error: "Missing path" }), { status: 400 });
    }

    const accessToken = await getDropboxAccessToken();

    const res = await fetch("https://api.dropboxapi.com/2/files/delete_v2", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path }),
    });

    if (!res.ok) {
      const errText = await res.text();
      // If it's already gone from Dropbox, treat as success so the app can still clean up its record.
      if (errText.includes("path_lookup/not_found")) {
        return new Response(JSON.stringify({ ok: true, alreadyGone: true }), { status: 200 });
      }
      return new Response(
        JSON.stringify({ error: "Dropbox delete failed", detail: errText }),
        { status: 502 }
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message ?? "Unknown error" }), {
      status: 500,
    });
  }
};

export const config: Config = {
  path: "/api/dropbox-delete",
};
