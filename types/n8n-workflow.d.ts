declare module "n8n-workflow" {
  export type GenericValue = unknown

  export interface IDataObject {
    [key: string]: unknown
  }

  export interface INodeExecutionData {
    json: IDataObject
    pairedItem?: { item: number }
  }

  export type Icon =
    | `file:${string}`
    | { dark: `file:${string}`; light: `file:${string}` }

  export class NodeOperationError extends Error {
    constructor(node: unknown, message: string)
  }

  export interface INodePropertyOptions {
    name: string
    value: string | number | boolean
  }

  export type INodeProperties = {
    [key: string]: unknown
    default?: unknown
    displayName: string
    name: string
    options?: Array<INodePropertyOptions | IDataObject>
    required?: boolean
    type: string
    typeOptions?: IDataObject
  }

  export type IHttpRequestMethods =
    | "DELETE"
    | "GET"
    | "HEAD"
    | "PATCH"
    | "POST"
    | "PUT"

  export interface IHttpRequestOptions {
    body?: unknown
    headers?: IDataObject
    json?: boolean
    method?: IHttpRequestMethods
    qs?: IDataObject
    url: string
  }

  type AuthenticatedHttpRequest = (
    credentialsType: string,
    requestOptions: IHttpRequestOptions,
  ) => Promise<unknown>

  export interface IExecuteFunctions {
    getInputData(): INodeExecutionData[]
    getNode(): unknown
    getNodeParameter(
      parameterName: string,
      itemIndex: number,
      fallbackValue?: unknown,
    ): unknown
    helpers: {
      httpRequestWithAuthentication: AuthenticatedHttpRequest
    }
  }

  export interface ILoadOptionsFunctions {
    helpers: {
      httpRequestWithAuthentication: AuthenticatedHttpRequest
    }
  }

  export interface IHookFunctions {
    getNode(): unknown
    getNodeParameter(parameterName: string): unknown
    getNodeWebhookUrl(name: string): string
    getWorkflowStaticData(type: "node"): IDataObject
    helpers: {
      httpRequestWithAuthentication: AuthenticatedHttpRequest
    }
  }

  export interface IWebhookFunctions {
    getBodyData(): IDataObject
    getHeaderData(): IDataObject
    getNode(): unknown
    getRequestObject(): {
      body?: unknown
      rawBody?: Buffer | string
    }
    getWorkflowStaticData(type: "node"): IDataObject
    helpers: {
      returnJsonArray(data: IDataObject[]): INodeExecutionData[]
    }
  }

  export interface IWebhookResponseData {
    workflowData: INodeExecutionData[][]
  }

  export interface ICredentialTestRequest {
    request: IHttpRequestOptions
  }

  export interface ICredentialType {
    displayName: string
    documentationUrl?: string
    extends?: string[]
    name: string
    properties: INodeProperties[]
    test?: ICredentialTestRequest
  }

  export interface INodeTypeDescription {
    [key: string]: unknown
    displayName: string
    name: string
    properties: INodeProperties[]
    version: number
  }

  export interface INodeType {
    description: INodeTypeDescription
  }

  export const NodeConnectionTypes: {
    Main: "main"
  }
}
