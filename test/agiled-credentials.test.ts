/* eslint-disable @n8n/community-nodes/no-restricted-imports */

import { describe, expect, it } from "vitest"
import { readFile } from "node:fs/promises"
import { AgiledOAuth2Api } from "../credentials/AgiledOAuth2Api.credentials"

describe("Agiled OAuth credentials", () => {
  it("uses a public PKCE client without asking for a secret", () => {
    const credential = new AgiledOAuth2Api()
    const grantType = credential.properties.find(
      (property) => property.name === "grantType",
    )
    const clientSecret = credential.properties.find(
      (property) => property.name === "clientSecret",
    )

    expect(grantType).toMatchObject({ default: "pkce", type: "hidden" })
    expect(clientSecret).toMatchObject({
      default: "",
      required: false,
      type: "hidden",
    })
  })

  it("registers a public client and prints only its client ID", async () => {
    const source = await readFile(
      new URL("../scripts/register-client.ts", import.meta.url),
      "utf8",
    )

    expect(source).toContain('token_endpoint_auth_method: "none"')
    expect(source).toContain("console.log(payload.client_id)")
    expect(source).not.toContain("JSON.stringify(payload")
  })
})
