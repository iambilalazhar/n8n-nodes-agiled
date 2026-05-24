import { createHmac } from "node:crypto"
import { describe, expect, it, vi } from "vitest"

vi.mock("n8n-workflow", () => ({
  NodeConnectionTypes: {
    Main: "main",
  },
}))

import { AgiledTrigger } from "../nodes/AgiledTrigger/AgiledTrigger.node"

const secret = "webhook-secret"

function signWebhook(timestamp: string, body: Buffer | string) {
  const hmac = createHmac("sha256", secret)
  hmac.update(timestamp)
  hmac.update(".")
  hmac.update(body)
  return hmac.digest("hex")
}

function webhookContext({
  body,
  rawBody,
  signature,
  timestamp,
}: {
  body: Record<string, unknown>
  rawBody?: Buffer | string
  signature: string
  timestamp: string
}) {
  return {
    getBodyData: () => body,
    getHeaderData: () => ({
      "x-agiled-webhook-signature": signature,
      "x-agiled-webhook-timestamp": timestamp,
    }),
    getRequestObject: () =>
      rawBody === undefined ? { body } : { body, rawBody },
    getWorkflowStaticData: () => ({ webhookSecret: secret }),
    helpers: {
      returnJsonArray: (items: Record<string, unknown>[]) =>
        items.map((json) => ({ json })),
    },
  }
}

describe("AgiledTrigger webhook signature verification", () => {
  it("requires n8n to provide the raw request body before checking the signature", async () => {
    const timestamp = String(Math.floor(Date.now() / 1000))
    const body = { data: { id: "contact_1" }, event: "contact.created" }
    const signature = signWebhook(timestamp, JSON.stringify(body))
    const trigger = new AgiledTrigger()

    await expect(
      trigger.webhook.call(
        webhookContext({ body, signature, timestamp }) as never
      )
    ).rejects.toThrow("raw request body")
  })

  it("verifies signatures against the exact raw request body bytes", async () => {
    const timestamp = String(Math.floor(Date.now() / 1000))
    const rawBody = Buffer.from(
      '{"event":"contact.created", "data":{"id":"contact_1"}}'
    )
    const body = { data: { id: "contact_1" }, event: "contact.created" }
    const signature = signWebhook(timestamp, rawBody)
    const trigger = new AgiledTrigger()

    await expect(
      trigger.webhook.call(
        webhookContext({ body, rawBody, signature, timestamp }) as never
      )
    ).resolves.toMatchObject({
      workflowData: [[{ json: { event: "contact.created", id: "contact_1" } }]],
    })
  })
})
