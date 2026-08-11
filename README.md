# Agiled nodes for n8n

Official [Agiled](https://agiled.app) community nodes for automating CRM,
projects, finance, appointments, documents, and other business operations in
[n8n](https://n8n.io).

## Nodes

- **Agiled** performs list, get, create, update, delete, and supported special
  actions across 21 Agiled resources.
- **Agiled Trigger** starts a workflow from signed Agiled webhook events and
  manages the webhook subscription when the workflow is activated or removed.

Supported resources include accounts, appointments, booking pages, contacts,
deals, documents, document templates, estimates, event types, expenses, files,
forms, invoices, payments, pipelines, products, projects, tasks, tickets, time
entries, and users.

## Installation

### n8n Cloud and verified community-node installations

After n8n verifies the package, search for **Agiled** in the nodes panel and
install it there.

### Self-hosted n8n

In **Settings > Community Nodes**, install:

```text
@agiled/n8n-nodes-agiled
```

Restart n8n if the nodes do not appear immediately. Community nodes execute
inside your n8n instance, so review the package and keep it updated.

## Credentials

The nodes use OAuth 2.0 authorization code flow. Create one OAuth client for
each n8n instance:

1. Add an **Agiled OAuth2 API** credential in n8n.
2. Copy the OAuth Redirect URL displayed by n8n.
3. From a checkout of this repository, register that exact URL:

   ```bash
   N8N_REDIRECT_URI="https://your-n8n.example.com/rest/oauth2-credential/callback" \
     bun run register-client
   ```

4. Copy the returned client ID and client secret into the n8n credential.
5. Select **Connect my account**, authorize Agiled, and run the credential test.

Treat the client secret like a password. Do not commit it or paste it into a
workflow export.

## Usage examples

### List recently updated contacts

1. Add a Manual Trigger.
2. Add **Agiled** and select **Contact > List Contacts**.
3. Set the limit and optional email or full-name filters.
4. Run the workflow. Each contact is returned as a separate n8n item.

### Start a workflow when an invoice is paid

1. Add **Agiled Trigger**.
2. Select the invoice-paid event.
3. Activate the workflow. The node creates the signed webhook subscription.
4. Use the returned `record_id` to fetch or process the invoice.

Deactivating or deleting the workflow removes the webhook subscription.
Invalid, stale, unsigned, or body-altered webhook requests are rejected before
workflow data is emitted.

## Compatibility

- n8n 2.x
- Node.js 20 or later for local development
- Agiled public API at `https://api.agiled.ai/public/v1`

## Development

```bash
npm ci
npm test
npm run lint
npm run build
```

Use `npm run dev` to load the package in the local n8n development environment.
Publishing is performed only by the repository's GitHub Actions release
workflow so npm includes a provenance statement.

## Support

- Package issues: [GitHub Issues](https://github.com/iambilalazhar/n8n-nodes-agiled/issues)
- Agiled help: [Agiled Knowledge Base](https://help.agiled.app)

## License

[MIT](LICENSE.md)
