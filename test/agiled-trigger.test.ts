import { createHmac } from "node:crypto"
import { describe, expect, it, vi } from "vitest"

const { MockNodeOperationError } = vi.hoisted(() => ({
  MockNodeOperationError: class extends Error {},
}))

vi.mock("n8n-workflow", () => ({
  NodeConnectionTypes: {
    Main: "main",
  },
  NodeOperationError: MockNodeOperationError,
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
    getNode: () => ({ name: "Agiled Trigger" }),
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
    ).rejects.toBeInstanceOf(MockNodeOperationError)
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

describe("AgiledTrigger webhook lifecycle", () => {
  it("creates and removes a subscription with matching static data", async () => {
    const trigger = new AgiledTrigger()
    const staticData: Record<string, unknown> = {}
    const request = vi
      .fn()
      .mockResolvedValueOnce({ data: { id: "sub_1", secret: "secret_1" } })
      .mockResolvedValueOnce({})
    const context = {
      getNode: () => ({ name: "Agiled Trigger" }),
      getNodeParameter: () => ["contact.created"],
      getNodeWebhookUrl: () => "https://n8n.example/webhook/agiled",
      getWorkflowStaticData: () => staticData,
      helpers: { httpRequestWithAuthentication: request },
    }

    await expect(
      trigger.webhookMethods.default.create.call(context as never),
    ).resolves.toBe(true)
    expect(staticData).toEqual({
      events: ["contact.created"],
      subscriptionId: "sub_1",
      webhookSecret: "secret_1",
    })

    await expect(
      trigger.webhookMethods.default.delete.call(context as never),
    ).resolves.toBe(true)
    expect(request).toHaveBeenLastCalledWith(
      "agiledOAuth2Api",
      expect.objectContaining({
        method: "DELETE",
        url: "https://api.agiled.ai/public/v1/webhook-subscriptions/sub_1",
      }),
    )
    expect(staticData).toEqual({})
  })
})
