/**
 * Test helpers and utilities for audio-verifier API tests
 */

import axios, { AxiosInstance, AxiosError } from "axios";

export interface ApiResponse<T = any> {
  status: number;
  data: T;
  headers: Record<string, any>;
}

export interface TestConfig {
  baseUrl: string;
  apiKey: string;
  timeout: number;
}

export class ApiClient {
  private client: AxiosInstance;
  private config: TestConfig;

  constructor(config: TestConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  async get<T = any>(path: string, options?: any): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.get<T>(path, {
        headers: this.getAuthHeaders(),
        ...options,
      });
      return {
        status: response.status,
        data: response.data,
        headers: response.headers,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return {
          status: error.response?.status ?? 0,
          data: error.response?.data,
          headers: error.response?.headers ?? {},
        };
      }
      throw error;
    }
  }

  async post<T = any>(path: string, data?: any, options?: any): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.post<T>(path, data, {
        headers: this.getAuthHeaders(),
        ...options,
      });
      return {
        status: response.status,
        data: response.data,
        headers: response.headers,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return {
          status: error.response?.status ?? 0,
          data: error.response?.data,
          headers: error.response?.headers ?? {},
        };
      }
      throw error;
    }
  }

  async postForm<T = any>(path: string, formData: FormData, options?: any): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.postForm<T>(path, formData, {
        headers: {
          ...this.getAuthHeaders(),
          // axios will set the correct Content-Type for FormData
        },
        ...options,
      });
      return {
        status: response.status,
        data: response.data,
        headers: response.headers,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return {
          status: error.response?.status ?? 0,
          data: error.response?.data,
          headers: error.response?.headers ?? {},
        };
      }
      throw error;
    }
  }

  async postBinary<T = any>(
    path: string,
    data: ArrayBuffer,
    contentType: string,
    options?: any
  ): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.post<T>(path, data, {
        headers: {
          ...this.getAuthHeaders(),
          "Content-Type": contentType,
        },
        ...options,
      });
      return {
        status: response.status,
        data: response.data,
        headers: response.headers,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return {
          status: error.response?.status ?? 0,
          data: error.response?.data,
          headers: error.response?.headers ?? {},
        };
      }
      throw error;
    }
  }

  private getAuthHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.apiKey}`,
    };
  }

  setApiKey(key: string) {
    this.config.apiKey = key;
  }
}

export function getTestConfig(): TestConfig {
  const baseUrl = process.env.AUDIO_VERIFIER_URL || "http://localhost:8000";
  const apiKey = process.env.AUDIO_VERIFIER_API_KEY || "test-key";
  const timeout = parseInt(process.env.TEST_TIMEOUT || "30000", 10);

  return {
    baseUrl,
    apiKey,
    timeout,
  };
}

export async function generateTestAudio(
  durationSeconds: number = 2,
  sampleRate: number = 16000
): Promise<ArrayBuffer> {
  // Generate simple sine wave test audio in WAV format
  const numSamples = durationSeconds * sampleRate;
  const frequency = 440; // A4 note

  // WAV header
  const bytesPerSample = 2; // 16-bit
  const dataSize = numSamples * bytesPerSample;
  const fileSize = 36 + dataSize;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const write = (offset: number, value: number, bytes: number) => {
    for (let i = 0; i < bytes; i++) {
      view.setUint8(offset + i, (value >> (i * 8)) & 0xff);
    }
  };

  // RIFF header
  write(0, 0x46464952, 4); // "RIFF"
  write(4, fileSize, 4);
  write(8, 0x45564157, 4); // "WAVE"

  // fmt sub-chunk
  write(12, 0x20746d66, 4); // "fmt "
  write(16, 16, 4); // Subchunk1Size
  write(20, 1, 2); // AudioFormat (PCM)
  write(22, 1, 2); // NumChannels
  write(24, sampleRate, 4); // SampleRate
  write(28, sampleRate * bytesPerSample, 4); // ByteRate
  write(32, bytesPerSample, 2); // BlockAlign
  write(34, 16, 2); // BitsPerSample

  // data sub-chunk
  write(36, 0x61746164, 4); // "data"
  write(40, dataSize, 4);

  // Generate audio samples
  const amplitude = 0.3;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * frequency * t) * amplitude * 32767;
    view.setInt16(44 + i * 2, sample, true);
  }

  return buffer;
}

export function createMockAudioFile(durationSeconds: number = 2): { data: ArrayBuffer; name: string } {
  return {
    data: Bun.readableStreamToBlob(
      Bun.readableStreamToText(new ReadableStream())
    ) as any as ArrayBuffer,
    name: `test-audio-${Date.now()}.wav`,
  };
}

export function expectStatus(actual: number, expected: number | number[], message?: string) {
  if (Array.isArray(expected)) {
    if (!expected.includes(actual)) {
      throw new Error(
        message || `Expected status to be one of ${expected.join(", ")}, got ${actual}`
      );
    }
  } else {
    if (actual !== expected) {
      throw new Error(message || `Expected status ${expected}, got ${actual}`);
    }
  }
}

export function expectJsonResponse<T>(data: any, schema?: (data: any) => boolean): T {
  if (!data) {
    throw new Error("Response data is empty");
  }
  if (typeof data !== "object") {
    throw new Error(`Expected JSON object, got ${typeof data}`);
  }
  if (schema && !schema(data)) {
    throw new Error("Response data does not match expected schema");
  }
  return data as T;
}

export async function waitForCondition(
  condition: () => Promise<boolean> | boolean,
  maxWaitMs: number = 5000,
  checkIntervalMs: number = 100
): Promise<void> {
  const startTime = Date.now();
  while (true) {
    if (await condition()) {
      return;
    }
    if (Date.now() - startTime > maxWaitMs) {
      throw new Error(`Condition not met within ${maxWaitMs}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, checkIntervalMs));
  }
}
