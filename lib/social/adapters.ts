type SocialArticlePayload = {
  title: string;
  excerpt?: string | null;
  articleUrl: string;
  instagramImageUrl?: string | null;
};

const REQUEST_TIMEOUT_MS = 20_000;

function buildPostText(title: string, url: string, excerpt?: string | null) {
  const summary = typeof excerpt === "string" ? excerpt.trim() : "";
  if (!summary) {
    return `${title}\n\n${url}`;
  }
  return `${title}\n\n${summary}\n\n${url}`;
}

async function postWithTimeout(url: string, init: Omit<RequestInit, "signal">) {
  return fetch(url, {
    ...init,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });
}

export async function postToFacebookPage(
  article: SocialArticlePayload,
  credentials: { pageId: string; pageAccessToken: string }
) {
  const endpoint = `https://graph.facebook.com/v22.0/${encodeURIComponent(credentials.pageId)}/feed`;
  const body = new URLSearchParams({
    message: buildPostText(article.title, article.articleUrl, article.excerpt),
    link: article.articleUrl,
    access_token: credentials.pageAccessToken,
  });

  const response = await postWithTimeout(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Facebook API ${response.status}: ${text.slice(0, 240)}`);
  }
}

export async function postToInstagram(
  article: SocialArticlePayload,
  credentials: { igUserId: string; pageAccessToken: string }
) {
  if (!article.instagramImageUrl) {
    throw new Error("Artikel tidak punya gambar untuk Instagram");
  }

  const caption = buildPostText(article.title, article.articleUrl, article.excerpt).slice(0, 2200);
  const mediaEndpoint = `https://graph.facebook.com/v22.0/${encodeURIComponent(credentials.igUserId)}/media`;
  const mediaBody = new URLSearchParams({
    image_url: article.instagramImageUrl,
    caption,
    access_token: credentials.pageAccessToken,
  });

  const mediaResponse = await postWithTimeout(mediaEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: mediaBody.toString(),
  });

  if (!mediaResponse.ok) {
    const text = await mediaResponse.text();
    throw new Error(`Instagram media ${mediaResponse.status}: ${text.slice(0, 240)}`);
  }

  const mediaJson = (await mediaResponse.json().catch(() => null)) as { id?: string } | null;
  const creationId = mediaJson?.id;
  if (!creationId) {
    throw new Error("Instagram media container gagal dibuat");
  }

  const publishEndpoint = `https://graph.facebook.com/v22.0/${encodeURIComponent(credentials.igUserId)}/media_publish`;
  const publishBody = new URLSearchParams({
    creation_id: creationId,
    access_token: credentials.pageAccessToken,
  });

  const publishResponse = await postWithTimeout(publishEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: publishBody.toString(),
  });

  if (!publishResponse.ok) {
    const text = await publishResponse.text();
    throw new Error(`Instagram publish ${publishResponse.status}: ${text.slice(0, 240)}`);
  }
}

export async function postToX(article: SocialArticlePayload, credentials: { accessToken: string }) {
  const response = await postWithTimeout("https://api.x.com/2/tweets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${credentials.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: buildPostText(article.title, article.articleUrl, article.excerpt).slice(0, 280),
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`X API ${response.status}: ${text.slice(0, 240)}`);
  }
}
