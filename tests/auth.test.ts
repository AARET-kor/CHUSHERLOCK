import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";

const originalToken = process.env.CODEX_ACCESS_TOKEN;

afterEach(() => {
  if (originalToken === undefined) delete process.env.CODEX_ACCESS_TOKEN;
  else process.env.CODEX_ACCESS_TOKEN = originalToken;
});

describe("optional access-token middleware", () => {
  it("keeps default local mode open when no token is configured", async () => {
    delete process.env.CODEX_ACCESS_TOKEN;
    const response = await middleware(new NextRequest("http://localhost/api/entries"));
    expect(response.status).toBe(200);
  });

  it("rejects missing credentials and accepts a Bearer token", async () => {
    process.env.CODEX_ACCESS_TOKEN = "test-secret";
    const rejected = await middleware(new NextRequest("http://localhost/api/entries"));
    expect(rejected.status).toBe(401);
    expect(rejected.headers.get("www-authenticate")).toContain("Basic");

    const accepted = await middleware(
      new NextRequest("http://localhost/api/entries", {
        headers: { Authorization: "Bearer test-secret" },
      })
    );
    expect(accepted.status).toBe(200);
  });

  it("supports browser Basic authentication using the token as password", async () => {
    process.env.CODEX_ACCESS_TOKEN = "browser-secret";
    const authorization = `Basic ${Buffer.from("codex:browser-secret").toString("base64")}`;
    const response = await middleware(
      new NextRequest("http://localhost/library", {
        headers: { Authorization: authorization },
      })
    );
    expect(response.status).toBe(200);
  });
});
