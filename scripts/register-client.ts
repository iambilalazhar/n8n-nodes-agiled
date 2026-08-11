/* eslint-disable @n8n/community-nodes/no-restricted-globals, no-console */

import { AUTH_BASE_URL, OAUTH_SCOPES } from "../shared/constants"

const redirectUri = process.env.N8N_REDIRECT_URI

if (!redirectUri) {
  throw new Error(
    "Set N8N_REDIRECT_URI to the OAuth callback URL shown by n8n.",
  )
}

const response = await fetch(`${AUTH_BASE_URL}/oauth2/register`, {
  body: JSON.stringify({
    client_name: "n8n",
    grant_types: ["authorization_code", "refresh_token"],
    redirect_uris: [redirectUri],
    response_types: ["code"],
    scope: OAUTH_SCOPES,
    token_endpoint_auth_method: "none",
  }),
  headers: {
    "content-type": "application/json",
  },
  method: "POST",
})

const payload = (await response.json()) as Record<string, unknown>

if (!response.ok) {
  throw new Error(
    typeof payload.error === "string"
      ? payload.error
      : `OAuth client registration failed with ${response.status}.`,
  )
}

if (typeof payload.client_id !== "string") {
  throw new Error("Agiled did not return an OAuth client ID.")
}

console.log(payload.client_id)
