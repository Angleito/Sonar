import { invalidRequest } from './errors';

export interface ByteRange {
  start: number;
  end?: number;
}

export function assertDatasetId(datasetId: string): string {
  const normalized = datasetId?.trim();

  if (!normalized) {
    throw invalidRequest('Dataset identifier is required.');
  }

  // Allow hexadecimal Sui object IDs (0x...) as well as UUID-like strings used in tests
  const suiPattern = /^0x[a-fA-F0-9]{16,}$/;
  const genericPattern = /^[a-zA-Z0-9_-]{4,}$/;

  if (!suiPattern.test(normalized) && !genericPattern.test(normalized)) {
    throw invalidRequest('Dataset identifier format is invalid.', { datasetId });
  }

  return normalized;
}

export function parseRangeHeader(rangeHeader?: string): ByteRange | undefined {
  if (!rangeHeader) {
    return undefined;
  }

  const match = /^bytes=(\d+)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match) {
    throw invalidRequest('Invalid Range header format.', { rangeHeader });
  }

  const start = Number.parseInt(match[1]!, 10);
  const end = match[2] ? Number.parseInt(match[2], 10) : undefined;

  if (Number.isNaN(start) || start < 0) {
    throw invalidRequest('Range start must be a non-negative integer.', { rangeHeader });
  }

  if (end !== undefined && (Number.isNaN(end) || end < start)) {
    throw invalidRequest('Range end must be greater than or equal to start.', {
      rangeHeader,
    });
  }

  return { start, end };
}
