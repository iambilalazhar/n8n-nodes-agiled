import type {
  IDataObject,
  IHookFunctions,
  INodeType,
  INodeTypeDescription,
  IWebhookFunctions,
  IWebhookResponseData,
} from "n8n-workflow"
import { NodeConnectionTypes } from "n8n-workflow"
import { triggerEvents } from "../../shared/catalog"
import { agiledApiRequest, unwrapData } from "../../shared/transport"

type StaticData = {
  events?: string[]
  subscriptionId?: string
}

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
    inputs: [],
    name: "agiledTrigger",
    outputs: [NodeConnectionTypes.Main],
    properties: [
      {
        default: [],
        displayName: "Events",
        name: "events",
        options: triggerEvents.map(([event, , , label]) => ({
          name: label,
          value: event,
        })),
        required: true,
        type: "multiOptions",
      },
    ],
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
          staticData.subscriptionId && sameEvents(staticData.events, events),
        )
      },

      async create(this: IHookFunctions) {
        const staticData = this.getWorkflowStaticData("node") as StaticData
        const events = this.getNodeParameter("events") as string[]

        if (staticData.subscriptionId && !sameEvents(staticData.events, events)) {
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
        staticData.subscriptionId = String(subscription.id)
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
        delete staticData.events

        return true
      },
    },
  }

  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    const body = this.getBodyData() as IDataObject
    const event = String(body.event || "agiled.event")

    return {
      workflowData: [
        this.helpers.returnJsonArray([formatPayload(body, event)]),
      ],
    }
  }
}
