import { OAUTH_STATE_COOKIE, encodeOAuthState } from "@shared/const";

export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// APK는 번들된 화면을 사용하므로 상대경로 API가 WebView 내부로 향하지 않게 합니다.
export const PUBLIC_APP_ORIGIN = "https://daldal-bsqjsoxw.manus.space";

export const getLoginUrl = () => {
  // Capacitor APK에서는 platform config script가 늦게 로드될 수 있어 공개 식별자 fallback을 사용합니다.
  const oauthPortalUrl = window.__MANUS_CONFIG__?.oauthPortalUrl ?? "https://manus.im";
  const appId = window.__MANUS_CONFIG__?.projectId ?? "bSqJsoxWZ7wwBW42Vmn9aC";
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const nonce = crypto.randomUUID();
  document.cookie = `${OAUTH_STATE_COOKIE}=${nonce}; Path=/; Max-Age=600; SameSite=None; Secure`;
  const state = encodeOAuthState({ redirectUri, nonce });
  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("responseType", "code");
  return url.toString();
};

export const startLogin = () => {
  window.location.assign(getLoginUrl());
};
