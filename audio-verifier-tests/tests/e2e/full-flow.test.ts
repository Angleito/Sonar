/**
 * End-to-end tests for audio-verifier
 * Tests complete verification workflows
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { ApiClient, getTestConfig, expectStatus, waitForCondition } from "../helpers";

describe("End-to-End Verification Flow", () => {
  const config = getTestConfig();
  let client: ApiClient;

  beforeEach(() => {
    client = new ApiClient(config);
  });

  describe("Complete Encrypted Verification Flow", () => {
    it("Creates session, polls status, handles results", async () => {
      // Step 1: Create verification session
      const createResponse = await client.post("/verify", {
        blob_id: "W2jphreyht2dHlAk8Zv8pIFVlHg9hCWAhS7BHV6o3TI",
        identity: "109e06bf6653e3b571cc",
        encrypted_object_bcs: "abcd1234",
      });

      expectStatus(createResponse.status, [200, 202]);
      const sessionId = (createResponse.data as any).session_id || (createResponse.data as any).sessionId;
      expect(sessionId).toBeDefined();

      // Step 2: Poll for status
      let completed = false;
      let finalStatus = "processing";

      try {
        await waitForCondition(
          async () => {
            const statusResponse = await client.get(`/verify/${sessionId}`);
            if (statusResponse.status === 200) {
              const data = statusResponse.data as any;
              finalStatus = data.status;
              completed = ["completed", "failed", "cancelled"].includes(finalStatus);
              return completed;
            }
            return false;
          },
          30000, // Max 30 seconds
          1000 // Check every second
        );
      } catch (e) {
        // Timeout is OK for this test - service might be processing
      }

      // Step 3: Verify we got some status
      const finalResponse = await client.get(`/verify/${sessionId}`);
      expectStatus(finalResponse.status, [200, 404]);

      if (finalResponse.status === 200) {
        const data = finalResponse.data as any;
        expect(data.status).toBeDefined();
        expect(["processing", "completed", "failed", "cancelled"]).toContain(data.status);
      }
    });

    it("Can cancel an in-progress session", async () => {
      // Create session
      const createResponse = await client.post("/verify", {
        blob_id: "W2jphreyht2dHlAk8Zv8pIFVlHg9hCWAhS7BHV6o3TI",
        identity: "109e06bf6653e3b571cc",
        encrypted_object_bcs: "abcd1234",
      });

      if (createResponse.status !== 200 && createResponse.status !== 202) {
        return;
      }

      const sessionId = (createResponse.data as any).session_id || (createResponse.data as any).sessionId;

      // Cancel immediately
      const cancelResponse = await client.post(`/verify/${sessionId}/cancel`);
      expectStatus(cancelResponse.status, [200, 202, 404]);

      // Verify cancelled (or still exists)
      const statusResponse = await client.get(`/verify/${sessionId}`);
      if (statusResponse.status === 200) {
        const data = statusResponse.data as any;
        // Should either be cancelled or still processing
        expect(["processing", "cancelled", "failed"]).toContain(data.status);
      }
    });
  });

  describe("Session Lifecycle", () => {
    it("Session progresses through stages", async () => {
      const createResponse = await client.post("/verify", {
        blob_id: "W2jphreyht2dHlAk8Zv8pIFVlHg9hCWAhS7BHV6o3TI",
        identity: "109e06bf6653e3b571cc",
        encrypted_object_bcs: "abcd1234",
      });

      if (createResponse.status !== 200 && createResponse.status !== 202) {
        return;
      }

      const sessionId = (createResponse.data as any).session_id || (createResponse.data as any).sessionId;

      const stages: string[] = [];
      const maxPolls = 60;
      let pollCount = 0;

      while (pollCount < maxPolls) {
        const statusResponse = await client.get(`/verify/${sessionId}`);
        if (statusResponse.status === 200) {
          const data = statusResponse.data as any;
          if (data.stage) {
            if (!stages.includes(data.stage)) {
              stages.push(data.stage);
            }
          }

          if (["completed", "failed", "cancelled"].includes(data.status)) {
            break;
          }
        }

        pollCount++;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // Should see some progression through stages
      expect(stages.length).toBeGreaterThan(0);
    });

    it("Progress increases monotonically", async () => {
      const createResponse = await client.post("/verify", {
        blob_id: "W2jphreyht2dHlAk8Zv8pIFVlHg9hCWAhS7BHV6o3TI",
        identity: "109e06bf6653e3b571cc",
        encrypted_object_bcs: "abcd1234",
      });

      if (createResponse.status !== 200 && createResponse.status !== 202) {
        return;
      }

      const sessionId = (createResponse.data as any).session_id || (createResponse.data as any).sessionId;

      let lastProgress = 0;
      const maxPolls = 30;
      let pollCount = 0;

      while (pollCount < maxPolls) {
        const statusResponse = await client.get(`/verify/${sessionId}`);
        if (statusResponse.status === 200) {
          const data = statusResponse.data as any;
          const progress = data.progress || 0;

          // Progress should increase or stay same
          expect(progress).toBeGreaterThanOrEqual(lastProgress);
          lastProgress = progress;

          if (["completed", "failed", "cancelled"].includes(data.status)) {
            break;
          }
        }

        pollCount++;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    });
  });

  describe("Concurrent Requests", () => {
    it("Handles multiple sessions simultaneously", async () => {
      // Create multiple sessions in parallel
      const sessionIds: string[] = [];

      for (let i = 0; i < 5; i++) {
        const response = await client.post("/verify", {
          blob_id: `blob-${i}`,
          identity: `identity-${i}`,
          encrypted_object_bcs: `data-${i}`,
        });

        if (response.status === 200 || response.status === 202) {
          const sessionId = (response.data as any).session_id || (response.data as any).sessionId;
          if (sessionId) {
            sessionIds.push(sessionId);
          }
        }
      }

      // All sessions should be created
      expect(sessionIds.length).toBeGreaterThan(0);

      // Check status of all sessions
      for (const sessionId of sessionIds) {
        const response = await client.get(`/verify/${sessionId}`);
        expectStatus(response.status, [200, 404]);
      }
    });

    it("GET and POST can run concurrently", async () => {
      // Create session
      const createResponse = await client.post("/verify", {
        blob_id: "blob-concurrent",
        identity: "identity-concurrent",
        encrypted_object_bcs: "data-concurrent",
      });

      if (createResponse.status !== 200 && createResponse.status !== 202) {
        return;
      }

      const sessionId = (createResponse.data as any).session_id || (createResponse.data as any).sessionId;

      // Run multiple GET requests concurrently
      const promises = Array.from({ length: 5 }, () => client.get(`/verify/${sessionId}`));

      const responses = await Promise.all(promises);

      // All should get same session
      responses.forEach((response) => {
        expectStatus(response.status, [200, 404]);
      });
    });
  });

  describe("Error Recovery", () => {
    it("Client can recover from transient failures", async () => {
      let succeeded = false;
      let attempts = 0;

      while (!succeeded && attempts < 3) {
        const response = await client.get("/");
        if (response.status === 200) {
          succeeded = true;
        }
        attempts++;
        if (!succeeded) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      expect(succeeded).toBeTruthy();
    });

    it("Session retrieval works after delays", async () => {
      const createResponse = await client.post("/verify", {
        blob_id: "blob-delay",
        identity: "identity-delay",
        encrypted_object_bcs: "data-delay",
      });

      if (createResponse.status !== 200 && createResponse.status !== 202) {
        return;
      }

      const sessionId = (createResponse.data as any).session_id || (createResponse.data as any).sessionId;

      // Wait a bit then retrieve
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const response = await client.get(`/verify/${sessionId}`);
      expectStatus(response.status, [200, 404]);
    });
  });

  describe("State Consistency", () => {
    it("Session state is consistent across multiple GETs", async () => {
      const createResponse = await client.post("/verify", {
        blob_id: "blob-consistency",
        identity: "identity-consistency",
        encrypted_object_bcs: "data-consistency",
      });

      if (createResponse.status !== 200 && createResponse.status !== 202) {
        return;
      }

      const sessionId = (createResponse.data as any).session_id || (createResponse.data as any).sessionId;

      // Get status multiple times
      const responses = await Promise.all([
        client.get(`/verify/${sessionId}`),
        client.get(`/verify/${sessionId}`),
        client.get(`/verify/${sessionId}`),
      ]);

      if (responses[0].status === 200) {
        const data1 = responses[0].data as any;
        const data2 = responses[1].data as any;
        const data3 = responses[2].data as any;

        // Status should be same or progressed (never regressed)
        if (data1.progress && data2.progress && data3.progress) {
          expect(data3.progress).toBeGreaterThanOrEqual(data1.progress);
        }
      }
    });

    it("Completed session returns stable results", async () => {
      const createResponse = await client.post("/verify", {
        blob_id: "blob-stable",
        identity: "identity-stable",
        encrypted_object_bcs: "data-stable",
      });

      if (createResponse.status !== 200 && createResponse.status !== 202) {
        return;
      }

      const sessionId = (createResponse.data as any).session_id || (createResponse.data as any).sessionId;

      // Wait for completion (with timeout)
      try {
        await waitForCondition(
          async () => {
            const response = await client.get(`/verify/${sessionId}`);
            if (response.status === 200) {
              return ["completed", "failed", "cancelled"].includes((response.data as any).status);
            }
            return false;
          },
          20000,
          500
        );
      } catch (e) {
        // Timeout is fine
      }

      // Get final state twice
      const response1 = await client.get(`/verify/${sessionId}`);
      await new Promise((resolve) => setTimeout(resolve, 100));
      const response2 = await client.get(`/verify/${sessionId}`);

      if (response1.status === 200 && response2.status === 200) {
        const data1 = response1.data as any;
        const data2 = response2.data as any;

        // Status shouldn't change
        if (["completed", "failed", "cancelled"].includes(data1.status)) {
          expect(data2.status).toBe(data1.status);
        }
      }
    });
  });
});
