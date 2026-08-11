export const API_BASE_URL = "https://api.agiled.ai"
export const AUTH_BASE_URL = "https://my.agiled.ai/api/auth"
export const PUBLIC_API_BASE_PATH = "/public/v1"
export const OAUTH_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "api:read",
  "api:write",
].join(" ")

export function publicApiUrl(path: string) {
  return `${API_BASE_URL}${PUBLIC_API_BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`
}

export function publicApiResourceUrl() {
  return `${API_BASE_URL}${PUBLIC_API_BASE_PATH}`
}
