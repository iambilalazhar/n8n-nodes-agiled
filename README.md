# Agiled n8n Nodes

This package contains Agiled n8n community nodes backed by the Agiled public API.

It includes:

- `Agiled`: list, get, create, update, delete, and special actions for public API resources.
- `Agiled Trigger`: webhook-backed triggers for Agiled public API events.
- `Agiled OAuth2 API`: Better Auth OAuth2 credentials for `https://api.agiled.ai/public/v1`.

## OAuth Setup

Create one OAuth client for the n8n instance, not one client per Agiled user.

1. In n8n, create an Agiled credential and copy the OAuth callback URL.
2. Register that callback URL:

```bash
N8N_REDIRECT_URI="https://your-n8n.example.com/rest/oauth2-credential/callback" \
  bun run --cwd apps/n8n register-client
```

3. Add the returned `client_id` and `client_secret` to the n8n Agiled credential.

The credential uses Agiled's public API token endpoint wrapper so n8n receives a resource-bound access token for `https://api.agiled.ai/public/v1`.

## Local Validation

```bash
bun run --cwd apps/n8n typecheck
bun run --cwd apps/n8n build
```
