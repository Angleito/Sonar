/**
 * Health check endpoint tests for audio-verifier
 */

import { describe, it, expect } from "bun:test";
import { ApiClient, getTestConfig, expectStatus } from "./helpers";

describe("Health Endpoints", () => {
  const config = getTestConfig();
  const client = new ApiClient(config);

  it("GET / returns service info", async () => {
    const response = await client.get("/");
    expectStatus(response.status, 200);

    const data = response.data as any;
    expect(data).toBeDefined();
    expect(data.service).toBeDefined();
    expect(data.version).toBeDefined();
  });

  it("GET /health returns health status", async () => {
    const response = await client.get("/health");
    expectStatus(response.status, 200);

    const data = response.data as any;
    expect(data).toBeDefined();
    expect(data.status).toBeDefined();
    expect(["healthy", "degraded", "unhealthy"]).toContain(data.status);
  });

  it("GET /health includes configuration validation", async () => {
    const response = await client.get("/health");
    expectStatus(response.status, 200);

    const data = response.data as any;
    // Health check should validate required config
    expect(data.config).toBeDefined();
    expect(typeof data.config).toBe("object");
  });

  it("GET /health checks database connectivity", async () => {
    const response = await client.get("/health");
    expectStatus(response.status, 200);

    const data = response.data as any;
    // Health check should include database status
    if (data.database) {
      expect(["connected", "disconnected", "timeout"]).toContain(data.database);
    }
  });

  it("GET / returns correct content type", async () => {
    const response = await client.get("/");
    expect(response.headers["content-type"]).toContain("application/json");
  });

  it("GET /health returns correct content type", async () => {
    const response = await client.get("/health");
    expect(response.headers["content-type"]).toContain("application/json");
  });

  it("Handles missing endpoints with 404", async () => {
    const response = await client.get("/nonexistent");
    expectStatus(response.status, 404);
  });

  it("Service responds within reasonable time", async () => {
    const startTime = Date.now();
    await client.get("/");
    const duration = Date.now() - startTime;

    // Health check should be fast (<500ms)
    expect(duration).toBeLessThan(500);
  });
});
