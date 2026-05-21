import type {
  IDataObject,
  IExecuteFunctions,
  IHookFunctions,
  ILoadOptionsFunctions,
  IHttpRequestMethods,
  IHttpRequestOptions,
} from "n8n-workflow"
import { publicApiUrl } from "./constants"

type RequestContext = IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions
type JsonObject = IDataObject

function cleanValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(cleanValue).filter((item) => item !== undefined)
  }

  if (value && typeof value === "object") {
    return cleanObject(value as JsonObject)
  }

  return value === "" || value === undefined ? undefined : value
}

export function cleanObject(input: JsonObject) {
  return Object.fromEntries(
    Object.entries(input)
      .map(([key, value]) => [key, cleanValue(value)])
      .filter(([, value]) => value !== undefined),
  ) as JsonObject
}

export function unwrapData(payload: unknown) {
  return payload && typeof payload === "object" && "data" in payload
    ? (payload as { data: unknown }).data
    : payload
}

export function unwrapList(payload: unknown) {
  const data = unwrapData(payload)
  return Array.isArray(data) ? data : []
}

export async function agiledApiRequest(
  this: RequestContext,
  method: IHttpRequestMethods,
  path: string,
  body?: JsonObject,
  qs?: JsonObject,
) {
  const options: IHttpRequestOptions = {
    body,
    json: true,
    method,
    qs,
    url: publicApiUrl(path),
  }

  return this.helpers.httpRequestWithAuthentication.call(
    this,
    "agiledOAuth2Api",
    options,
  )
}
