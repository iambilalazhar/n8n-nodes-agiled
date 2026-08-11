import { describe, expect, it, vi } from "vitest"

const { MockNodeOperationError } = vi.hoisted(() => ({
  MockNodeOperationError: class extends Error {},
}))

vi.mock("n8n-workflow", () => ({
  NodeConnectionTypes: { Main: "main" },
  NodeOperationError: MockNodeOperationError,
}))

import { Agiled } from "../nodes/Agiled/Agiled.node"

function parameterContext(
  parameters: Record<string, unknown>,
  itemCount = 1,
) {
  return {
    getInputData: () =>
      Array.from({ length: itemCount }, (_, index) => ({ json: { index } })),
    getNode: () => ({ name: "Agiled" }),
    getNodeParameter: (
      name: string,
      _itemIndex: number,
      fallback?: unknown,
    ) => (name in parameters ? parameters[name] : fallback),
    helpers: {
      httpRequestWithAuthentication: vi
        .fn()
        .mockResolvedValueOnce({ data: [{ id: "contact_1" }] })
        .mockResolvedValueOnce({ data: [{ id: "contact_2" }] }),
    },
  }
}

describe("Agiled action execution", () => {
  it("links every returned record to the input item that produced it", async () => {
    const node = new Agiled()
    const context = parameterContext(
      { limit: 50, operation: "list", resource: "contacts" },
      2,
    )

    await expect(node.execute.call(context as never)).resolves.toEqual([
      [
        { json: { id: "contact_1" }, pairedItem: { item: 0 } },
        { json: { id: "contact_2" }, pairedItem: { item: 1 } },
      ],
    ])
  })

  it("reports invalid JSON as an n8n operation error", async () => {
    const node = new Agiled()
    const context = parameterContext({
      operation: "submitForm",
      resource: "forms",
      submission_data: "{",
      submit_form_id: "form_1",
    })

    await expect(node.execute.call(context as never)).rejects.toBeInstanceOf(
      MockNodeOperationError,
    )
  })
})
