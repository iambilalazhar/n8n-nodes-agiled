import type { Icon, ICredentialType, INodeProperties } from "n8n-workflow"
import {
  AUTH_BASE_URL,
  OAUTH_SCOPES,
  publicApiUrl,
  publicApiResourceUrl,
} from "../shared/constants"

export class AgiledOAuth2Api implements ICredentialType {
  name = "agiledOAuth2Api"
  extends = ["oAuth2Api"]
  displayName = "Agiled OAuth2 API"
  icon: Icon = {
    dark: "file:../icons/agiled.dark.svg",
    light: "file:../icons/agiled.svg",
  }
  documentationUrl =
    "https://github.com/iambilalazhar/n8n-nodes-agiled#credentials"
  test = {
    request: {
      method: "GET" as const,
      url: publicApiUrl("/me"),
    },
  }

  properties: INodeProperties[] = [
    {
      displayName: "Grant Type",
      name: "grantType",
      type: "hidden",
      default: "authorizationCode",
    },
    {
      displayName: "Authorization URL",
      name: "authUrl",
      type: "hidden",
      default: `${AUTH_BASE_URL}/oauth2/authorize`,
    },
    {
      displayName: "Access Token URL",
      name: "accessTokenUrl",
      type: "hidden",
      default: `${AUTH_BASE_URL}/oauth2/public-api-token`,
    },
    {
      displayName: "Scope",
      name: "scope",
      type: "hidden",
      default: OAUTH_SCOPES,
    },
    {
      displayName: "Auth URI Query Parameters",
      name: "authQueryParameters",
      type: "hidden",
      default: `resource=${encodeURIComponent(publicApiResourceUrl())}`,
    },
    {
      displayName: "Authentication",
      name: "authentication",
      type: "hidden",
      default: "body",
    },
  ]
}
