import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe("public API endpoints", () => {
  it("cannot be redirected through runtime environment variables", async () => {
    vi.stubEnv("AGILED_API_BASE_URL", "https://example.invalid")
    vi.stubEnv("AGILED_AUTH_BASE_URL", "https://example.invalid/auth")

    const constants = await import("../shared/constants")

    expect(constants.publicApiUrl("/me")).toBe(
      "https://api.agiled.ai/public/v1/me",
    )
    expect(constants.AUTH_BASE_URL).toBe("https://my.agiled.ai/api/auth")
  })
})
