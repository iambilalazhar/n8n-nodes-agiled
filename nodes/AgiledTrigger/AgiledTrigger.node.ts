import { createHmac, timingSafeEqual } from "node:crypto"
import type {
  IDataObject,
  IHookFunctions,
  INodeType,
  INodeTypeDescription,
  IWebhookFunctions,
  IWebhookResponseData,
} from "n8n-workflow"
import { NodeConnectionTypes, NodeOperationError } from "n8n-workflow"
import { triggerEvents } from "../../shared/catalog"
import { agiledApiRequest, unwrapData } from "../../shared/transport"

type StaticData = {
  events?: string[]
  subscriptionId?: string
  webhookSecret?: string
}

const MAX_WEBHOOK_AGE_SECONDS = 5 * 60

function formatPayload(payload: IDataObject, event: string) {
  const data =
    payload.data && typeof payload.data === "object"
      ? (payload.data as IDataObject)
      : {}

  return {
    ...data,
    event: payload.event || event,
    id: payload.id || data.id,
    occurred_at: payload.occurred_at,
    organization_id: payload.organization_id,
    record_id: data.id,
  }
}

function sameEvents(left?: string[], right?: string[]) {
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    left.every((event, index) => event === right[index])
  )
}

function headerValue(headers: IDataObject, name: string) {
  const value = headers[name] ?? headers[name.toLowerCase()]
  if (Array.isArray(value)) return value[0]
  return typeof value === "string" ? value : undefined
}

function rawRequestBody(request: { body?: unknown; rawBody?: Buffer | string }) {
  if (typeof request.rawBody === "string") return request.rawBody
  if (Buffer.isBuffer(request.rawBody)) return request.rawBody
  return null
}

function isFreshTimestamp(timestamp: string) {
  const parsed = Number(timestamp)
  return (
    Number.isFinite(parsed) &&
    Math.abs(Math.floor(Date.now() / 1000) - parsed) <= MAX_WEBHOOK_AGE_SECONDS
  )
}

function signatureMatches({
  body,
  secret,
  signature,
  timestamp,
}: {
  body: Buffer | string
  secret: string
  signature: string
  timestamp: string
}) {
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false

  const hmac = createHmac("sha256", secret)
  hmac.update(timestamp)
  hmac.update(".")
  hmac.update(body)
  const expected = hmac.digest("hex")
  const expectedBuffer = Buffer.from(expected, "hex")
  const signatureBuffer = Buffer.from(signature, "hex")

  return (
    expectedBuffer.length === signatureBuffer.length &&
    timingSafeEqual(expectedBuffer, signatureBuffer)
  )
}

export class AgiledTrigger implements INodeType {
  description: INodeTypeDescription = {
    credentials: [
      {
        name: "agiledOAuth2Api",
        required: true,
      },
    ],
    defaults: {
      name: "Agiled Trigger",
    },
    description: "Start a workflow when Agiled emits selected events",
    displayName: "Agiled Trigger",
    group: ["trigger"],
    icon: {
      dark: "file:agiled.dark.svg",
      light: "file:agiled.svg",
    },
    inputs: [],
    name: "agiledTrigger",
    outputs: [NodeConnectionTypes.Main],
    properties: [
      {
        displayName: "Events",
        default: [],
        name: "events",
        options: triggerEvents.map(([event, , , label]) => ({
          name: label,
          value: event,
        })),
        required: true,
        type: "multiOptions",
      },
    ],
    subtitle: '={{$parameter["events"].join(", ")}}',
    usableAsTool: false,
    version: 1,
    webhooks: [
      {
        httpMethod: "POST",
        name: "default",
        path: "agiled",
        responseMode: "onReceived",
      },
    ],
  }

  webhookMethods = {
    default: {
      async checkExists(this: IHookFunctions) {
        const staticData = this.getWorkflowStaticData("node") as StaticData
        const events = this.getNodeParameter("events") as string[]

        return Boolean(
          staticData.subscriptionId &&
            staticData.webhookSecret &&
            sameEvents(staticData.events, events),
        )
      },

      async create(this: IHookFunctions) {
        const staticData = this.getWorkflowStaticData("node") as StaticData
        const events = this.getNodeParameter("events") as string[]

        if (
          staticData.subscriptionId &&
          (!staticData.webhookSecret || !sameEvents(staticData.events, events))
        ) {
          await agiledApiRequest.call(
            this,
            "DELETE",
            `/webhook-subscriptions/${staticData.subscriptionId}`,
          )
          delete staticData.subscriptionId
          delete staticData.events
        }

        const response = await agiledApiRequest.call(
          this,
          "POST",
          "/webhook-subscriptions",
          {
            description: "n8n Agiled Trigger",
            events,
            target_url: this.getNodeWebhookUrl("default"),
          },
        )
        const subscription = unwrapData(response) as IDataObject
        const webhookSecret =
          typeof subscription.secret === "string" ? subscription.secret : ""
        if (!webhookSecret) {
          throw new NodeOperationError(
            this.getNode(),
            "Agiled did not return a webhook secret.",
          )
        }

        staticData.subscriptionId = String(subscription.id)
        staticData.webhookSecret = webhookSecret
        staticData.events = events

        return true
      },

      async delete(this: IHookFunctions) {
        const staticData = this.getWorkflowStaticData("node") as StaticData

        if (staticData.subscriptionId) {
          await agiledApiRequest.call(
            this,
            "DELETE",
            `/webhook-subscriptions/${staticData.subscriptionId}`,
          )
        }

        delete staticData.subscriptionId
        delete staticData.webhookSecret
        delete staticData.events

        return true
      },
    },
  }

  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    const body = this.getBodyData() as IDataObject
    const headers = this.getHeaderData()
    const request = this.getRequestObject() as {
      body?: unknown
      rawBody?: Buffer | string
    }
    const staticData = this.getWorkflowStaticData("node") as StaticData
    const timestamp = headerValue(headers, "X-Agiled-Webhook-Timestamp")
    const signature = headerValue(headers, "X-Agiled-Webhook-Signature")
    const rawBody = rawRequestBody(request)

    if (
      !staticData.webhookSecret ||
      !timestamp ||
      !signature ||
      rawBody === null ||
      !isFreshTimestamp(timestamp) ||
      !signatureMatches({
        body: rawBody,
        secret: staticData.webhookSecret,
        signature,
        timestamp,
      })
    ) {
      throw new NodeOperationError(
        this.getNode(),
        rawBody === null
          ? "Agiled webhook signature verification requires the raw request body."
          : "Invalid Agiled webhook signature.",
      )
    }

    const event = String(body.event || "agiled.event")

    return {
      workflowData: [
        this.helpers.returnJsonArray([formatPayload(body, event)]),
      ],
    }
  }
}
