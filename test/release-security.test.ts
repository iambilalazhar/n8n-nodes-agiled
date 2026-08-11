/* eslint-disable @n8n/community-nodes/no-restricted-imports */

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("release supply-chain controls", () => {
  it("uses pinned GitHub actions and script-free dependency installs", () => {
    const workflows = [
      read(".github/workflows/ci.yml"),
      read(".github/workflows/codeql.yml"),
      read(".github/workflows/publish.yml"),
    ].join("\n");

    expect(workflows).not.toMatch(/uses:\s+[^\s]+@v\d/);
    expect(workflows).not.toMatch(/uses:\s+[^\s]+@(main|master|latest)\b/);
    expect(workflows).not.toContain("npm ci\n");
    expect(workflows).toContain("npm ci --ignore-scripts");
    expect(workflows).toContain("npm audit --audit-level=critical");
  });

  it("stages tokenless releases behind the protected environment", () => {
    const workflow = read(".github/workflows/publish.yml");

    expect(workflow).toContain("environment: npm-publish");
    expect(workflow).toContain("id-token: write");
    expect(workflow).toContain("node-version: 24.15.0");
    expect(workflow).toContain("npm@12.0.2");
    expect(workflow).toContain("npm stage publish");
    expect(workflow).not.toContain("NPM_TOKEN");
    expect(workflow).not.toContain("npm config set");
  });

  it("keeps dependency and sensitive-file ownership policies versioned", () => {
    expect(read(".github/dependabot.yml")).toContain("package-ecosystem: npm");
    expect(read(".github/CODEOWNERS")).toContain("/.github/workflows/");
    expect(read(".gitignore")).toContain(".env.*");
  });
});
