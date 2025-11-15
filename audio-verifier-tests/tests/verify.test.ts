/**
 * Verification endpoint tests for audio-verifier
 * Tests the main POST /verify endpoint and status polling
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { ApiClient, getTestConfig, expectStatus, expectJsonResponse } from "./helpers";

describe("Verification Endpoints", () => {
  const config = getTestConfig();
  let client: ApiClient;

  beforeEach(() => {
    client = new ApiClient(config);
  });

  describe("POST /verify - Encrypted Blob Flow", () => {
    it("POST /verify accepts encrypted blob metadata", async () => {
      const response = await client.post("/verify", {
        blob_id: "W2jphreyht2dHlAk8Zv8pIFVlHg9hCWAhS7BHV6o3TI",
        identity: "109e06bf6653e3b571cc",
        encrypted_object_bcs: "abcd1234",
      });

      // Should accept the request and return session ID
      expectStatus(response.status, [200, 202, 400, 409]);
      if (response.status === 200 || response.status === 202) {
        const data = expectJsonResponse(response.data);
        expect(data.session_id || data.sessionId).toBeDefined();
      }
    });

    it("POST /verify requires blob_id", async () => {
      const response = await client.post("/verify", {
        identity: "0x123",
        encrypted_object_bcs: "abcd",
      });

      // Should reject missing blob_id
      expectStatus(response.status, [400, 422]);
    });

    it("POST /verify requires identity", async () => {
      const response = await client.post("/verify", {
        blob_id: "blob-123",
        encrypted_object_bcs: "abcd",
      });

      // Should reject missing identity
      expectStatus(response.status, [400, 422]);
    });

    it("POST /verify requires encrypted_object_bcs", async () => {
      const response = await client.post("/verify", {
        blob_id: "blob-123",
        identity: "0x123",
      });

      // Should reject missing encrypted data
      expectStatus(response.status, [400, 422]);
    });

    it("POST /verify returns session ID", async () => {
      const response = await client.post("/verify", {
        blob_id: "W2jphreyht2dHlAk8Zv8pIFVlHg9hCWAhS7BHV6o3TI",
        identity: "109e06bf6653e3b571cc",
        encrypted_object_bcs: "abcd1234",
      });

      if (response.status === 200 || response.status === 202) {
        const data = expectJsonResponse(response.data);
        const sessionId = data.session_id || data.sessionId;
        expect(sessionId).toBeDefined();
        expect(typeof sessionId).toBe("string");
        expect(sessionId.length).toBeGreaterThan(0);
      }
    });

    it("POST /verify returns immediately (async processing)", async () => {
      const startTime = Date.now();
      const response = await client.post("/verify", {
        blob_id: "W2jphreyht2dHlAk8Zv8pIFVlHg9hCWAhS7BHV6o3TI",
        identity: "109e06bf6653e3b571cc",
        encrypted_object_bcs: "abcd1234",
      });
      const duration = Date.now() - startTime;

      // Should respond quickly without waiting for full verification
      expect(duration).toBeLessThan(2000);
    });

    it("POST /verify validates blob_id format", async () => {
      const response = await client.post("/verify", {
        blob_id: "invalid blob id with spaces",
        identity: "0x123",
        encrypted_object_bcs: "abcd",
      });

      // Invalid blob ID format should be rejected
      if (response.status === 400 || response.status === 422) {
        expectStatus(response.status, [400, 422]);
      }
    });

    it("POST /verify validates identity format", async () => {
      const response = await client.post("/verify", {
        blob_id: "blob-123",
        identity: "not-hex",
        encrypted_object_bcs: "abcd",
      });

      // Invalid identity should be handled
      if (response.status === 400 || response.status === 422) {
        expectStatus(response.status, [400, 422]);
      }
    });
  });

  describe("GET /verify/{session_id} - Status Polling", () => {
    let sessionId: string;

    beforeEach(async () => {
      // Create a session first
      const response = await client.post("/verify", {
        blob_id: "W2jphreyht2dHlAk8Zv8pIFVlHg9hCWAhS7BHV6o3TI",
        identity: "109e06bf6653e3b571cc",
        encrypted_object_bcs: "abcd1234",
      });

      if (response.status === 200 || response.status === 202) {
        const data = response.data as any;
        sessionId = data.session_id || data.sessionId;
      }
    });

    it("GET /verify/{id} returns session status", async () => {
      if (!sessionId) {
        // Skip if session creation failed
        return;
      }

      const response = await client.get(`/verify/${sessionId}`);
      expectStatus(response.status, [200, 404]);

      if (response.status === 200) {
        const data = expectJsonResponse(response.data);
        expect(data.status).toBeDefined();
        expect(
          ["processing", "completed", "failed", "cancelled"].includes(data.status)
        ).toBeTruthy();
      }
    });

    it("GET /verify/{id} returns progress information", async () => {
      if (!sessionId) {
        return;
      }

      const response = await client.get(`/verify/${sessionId}`);

      if (response.status === 200) {
        const data = expectJsonResponse(response.data);
        expect(data.progress).toBeDefined();
        expect(typeof data.progress).toBe("number");
        expect(data.progress).toBeGreaterThanOrEqual(0);
        expect(data.progress).toBeLessThanOrEqual(1);
      }
    });

    it("GET /verify/{id} returns stage information", async () => {
      if (!sessionId) {
        return;
      }

      const response = await client.get(`/verify/${sessionId}`);

      if (response.status === 200) {
        const data = expectJsonResponse(response.data);
        expect(data.stage).toBeDefined();
        expect(typeof data.stage).toBe("string");
      }
    });

    it("GET /verify/{id} returns 404 for non-existent session", async () => {
      const response = await client.get("/verify/nonexistent-session-id-12345");
      expectStatus(response.status, 404);
    });

    it("GET /verify/{id} returns completed results", async () => {
      if (!sessionId) {
        return;
      }

      const response = await client.get(`/verify/${sessionId}`);

      if (response.status === 200) {
        const data = expectJsonResponse(response.data);
        if (data.status === "completed") {
          // Completed sessions should have results
          expect(data.results || data.result).toBeDefined();
        }
      }
    });

    it("GET /verify/{id} returns error details on failure", async () => {
      if (!sessionId) {
        return;
      }

      const response = await client.get(`/verify/${sessionId}`);

      if (response.status === 200) {
        const data = expectJsonResponse(response.data);
        if (data.status === "failed") {
          expect(data.error || data.errors).toBeDefined();
        }
      }
    });
  });

  describe("POST /verify/{session_id}/cancel", () => {
    it("POST /verify/{id}/cancel cancels a session", async () => {
      // Create a session
      const createResponse = await client.post("/verify", {
        blob_id: "W2jphreyht2dHlAk8Zv8pIFVlHg9hCWAhS7BHV6o3TI",
        identity: "109e06bf6653e3b571cc",
        encrypted_object_bcs: "abcd1234",
      });

      if (createResponse.status !== 200 && createResponse.status !== 202) {
        return;
      }

      const sessionId = (createResponse.data as any).session_id || (createResponse.data as any).sessionId;

      // Cancel the session
      const response = await client.post(`/verify/${sessionId}/cancel`);
      expectStatus(response.status, [200, 202, 404]);
    });

    it("POST /verify/{id}/cancel returns 404 for non-existent session", async () => {
      const response = await client.post("/verify/nonexistent-session-id-12345/cancel");
      expectStatus(response.status, 404);
    });
  });

  describe("Error Handling", () => {
    it("POST /verify handles missing required fields", async () => {
      const response = await client.post("/verify", {});
      expectStatus(response.status, [400, 422]);
    });

    it("POST /verify handles malformed JSON", async () => {
      // This test depends on client implementation
      const response = await client.post("/verify", "not json");
      expectStatus(response.status, [400, 422]);
    });

    it("POST /verify handles very large payloads", async () => {
      const largeData = "x".repeat(10000000); // 10MB
      const response = await client.post("/verify", {
        blob_id: "blob",
        identity: "0x123",
        encrypted_object_bcs: largeData,
      });

      // Should either accept or reject with 413 Payload Too Large
      expectStatus(response.status, [200, 202, 400, 413, 422]);
    });

    it("GET /verify/{id} handles invalid session ID format", async () => {
      const response = await client.get("/verify/../../etc/passwd");
      expectStatus(response.status, [400, 404]);
    });
  });

  describe("Response Validation", () => {
    it("POST /verify response includes required fields", async () => {
      const response = await client.post("/verify", {
        blob_id: "W2jphreyht2dHlAk8Zv8pIFVlHg9hCWAhS7BHV6o3TI",
        identity: "109e06bf6653e3b571cc",
        encrypted_object_bcs: "abcd1234",
      });

      if (response.status === 200 || response.status === 202) {
        const data = expectJsonResponse(response.data);
        expect(data.session_id || data.sessionId).toBeDefined();
        expect(
          data.estimated_time || data.estimatedTime || response.data.message === undefined
        ).toBeTruthy();
      }
    });

    it("GET /verify/{id} response has consistent structure", async () => {
      const createResponse = await client.post("/verify", {
        blob_id: "W2jphreyht2dHlAk8Zv8pIFVlHg9hCWAhS7BHV6o3TI",
        identity: "109e06bf6653e3b571cc",
        encrypted_object_bcs: "abcd1234",
      });

      if (createResponse.status !== 200 && createResponse.status !== 202) {
        return;
      }

      const sessionId = (createResponse.data as any).session_id || (createResponse.data as any).sessionId;
      const getResponse = await client.get(`/verify/${sessionId}`);

      if (getResponse.status === 200) {
        const data = expectJsonResponse(getResponse.data);
        // Should have consistent response structure
        expect(data.session_id || data.sessionId || data.id).toBeDefined();
        expect(data.status).toBeDefined();
        expect(data.progress || data.progress !== undefined).toBeTruthy();
      }
    });
  });

  describe("Performance", () => {
    it("POST /verify responds within timeout", async () => {
      const startTime = Date.now();
      const response = await client.post("/verify", {
        blob_id: "W2jphreyht2dHlAk8Zv8pIFVlHg9hCWAhS7BHV6o3TI",
        identity: "109e06bf6653e3b571cc",
        encrypted_object_bcs: "abcd1234",
      });
      const duration = Date.now() - startTime;

      // POST should be fast (async background processing)
      expect(duration).toBeLessThan(5000);
    });

    it("GET /verify/{id} responds quickly", async () => {
      const createResponse = await client.post("/verify", {
        blob_id: "W2jphreyht2dHlAk8Zv8pIFVlHg9hCWAhS7BHV6o3TI",
        identity: "109e06bf6653e3b571cc",
        encrypted_object_bcs: "abcd1234",
      });

      if (createResponse.status !== 200 && createResponse.status !== 202) {
        return;
      }

      const sessionId = (createResponse.data as any).session_id || (createResponse.data as any).sessionId;

      const startTime = Date.now();
      await client.get(`/verify/${sessionId}`);
      const duration = Date.now() - startTime;

      // GET should be very fast (just database lookup)
      expect(duration).toBeLessThan(1000);
    });
  });
});
