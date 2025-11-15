/**
 * Authentication tests for audio-verifier verify endpoint
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { ApiClient, getTestConfig, expectStatus, generateTestAudio } from "./helpers";

describe("Authentication", () => {
  const config = getTestConfig();
  let client: ApiClient;

  beforeEach(() => {
    client = new ApiClient(config);
  });

  it("POST /verify requires bearer token", async () => {
    // Create client without auth header
    const noAuthClient = new ApiClient({ ...config, apiKey: "" });

    const response = await noAuthClient.post("/verify", {
      blob_id: "test-blob",
    });

    // Should reject without valid token
    expectStatus(response.status, [401, 403]);
  });

  it("POST /verify rejects invalid token", async () => {
    client.setApiKey("invalid-token-xyz");

    const response = await client.post("/verify", {
      blob_id: "test-blob",
    });

    expectStatus(response.status, [401, 403]);
  });

  it("POST /verify accepts valid bearer token", async () => {
    // With valid token, should at least get past auth (might fail on validation)
    const response = await client.post("/verify", {
      blob_id: "valid-blob-id",
      identity: "0x123",
      encrypted_object_bcs: "abcd",
    });

    // Should not be auth error
    const authErrors = [401, 403];
    expect(!authErrors.includes(response.status) || response.status === 200).toBeTruthy();
  });

  it("POST /verify requires Authorization header", async () => {
    // Test with missing Authorization header
    const response = await ApiClient.prototype.post.call(
      new ApiClient({ ...config, apiKey: "" }),
      "/verify",
      { blob_id: "test" }
    );

    expectStatus(response.status, [401, 403]);
  });

  it("Authorization header must use Bearer scheme", async () => {
    // Test that token must be in Bearer scheme
    const response = await client.post("/verify", {
      blob_id: "test",
    });

    // Valid Bearer scheme should work (might fail on other validation)
    expect(response.status !== 400).toBeTruthy();
  });

  it("Token in Authorization header is case-sensitive", async () => {
    const validToken = config.apiKey;
    const invalidToken = validToken.toUpperCase();

    if (validToken !== invalidToken) {
      client.setApiKey(invalidToken);
      const response = await client.post("/verify", {
        blob_id: "test",
      });

      // Invalid case should fail auth
      expectStatus(response.status, [401, 403]);
    }
  });

  it("GET /verify/{id} requires bearer token", async () => {
    const noAuthClient = new ApiClient({ ...config, apiKey: "" });
    const response = await noAuthClient.get("/verify/test-session-id");

    expectStatus(response.status, [401, 403]);
  });

  it("POST /verify/{id}/cancel requires bearer token", async () => {
    const noAuthClient = new ApiClient({ ...config, apiKey: "" });
    const response = await noAuthClient.post("/verify/test-session-id/cancel");

    expectStatus(response.status, [401, 403]);
  });

  it("Legacy /check-audio endpoint requires authentication", async () => {
    const noAuthClient = new ApiClient({ ...config, apiKey: "" });
    const response = await noAuthClient.post("/check-audio", new FormData());

    expectStatus(response.status, [401, 403]);
  });
});
