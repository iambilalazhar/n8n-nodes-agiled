/* eslint-disable @n8n/community-nodes/no-restricted-imports, @typescript-eslint/no-explicit-any */

import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const packageRoot = resolve(import.meta.dirname, "..")
const packageJson = JSON.parse(
  readFileSync(resolve(packageRoot, "package.json"), "utf8"),
) as Record<string, any>

describe("community package readiness", () => {
  it("publishes a documented MIT package from the public source repository", () => {
    expect(packageJson.private).toBeUndefined()
    expect(packageJson.license).toBe("MIT")
    expect(packageJson.repository).toEqual({
      type: "git",
      url: "git+https://github.com/iambilalazhar/n8n-nodes-agiled.git",
    })
    expect(packageJson.homepage).toBe(
      "https://github.com/iambilalazhar/n8n-nodes-agiled#readme",
    )
    expect(packageJson.bugs).toEqual({
      url: "https://github.com/iambilalazhar/n8n-nodes-agiled/issues",
    })
  })

  it("uses the official n8n release checks and packages both node icons", () => {
    expect(packageJson.scripts).toMatchObject({
      build: "n8n-node build",
      lint: "n8n-node lint",
      prepublishOnly: "n8n-node prerelease",
      release: "n8n-node release",
      test: "vitest run && npm run typecheck",
    })
    expect(packageJson.n8n.strict).toBe(true)
    expect(packageJson.devDependencies["@n8n/node-cli"]).toBeDefined()

    expect(
      existsSync(resolve(packageRoot, "nodes/Agiled/agiled.svg")),
    ).toBe(true)
    expect(
      existsSync(resolve(packageRoot, "nodes/AgiledTrigger/agiled.svg")),
    ).toBe(true)
  })
})
