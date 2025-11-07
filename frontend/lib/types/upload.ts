/**
 * Upload Wizard Types
 * Type definitions for the dataset upload flow
 */

export type UploadStep =
  | 'file-upload'
  | 'metadata'
  | 'encryption'
  | 'verification'
  | 'publish'
  | 'success';

export interface AudioFile {
  file: File;
  duration: number;
  waveform?: number[];
  preview?: string;
}

export interface DatasetMetadata {
  title: string;
  description: string;
  languages: string[];
  tags: string[];
  consent: boolean;
}

export interface EncryptionResult {
  encryptedBlob: Blob;
  seal_policy_id: string; // Seal identity (hex string) for decryption
  backupKey: Uint8Array; // Emergency backup key (should be stored securely)
  previewBlob?: Blob;
  metadata: {
    threshold: number;
    packageId: string;
    accessPolicy: string;
    demType: string;
    timestamp: number;
    originalSize: number;
    encryptedSize: number;
    isEnvelope: boolean;
  };
}

export interface WalrusUploadResult {
  blobId: string;
  previewBlobId?: string;
  seal_policy_id: string; // Seal identity for decryption
  backupKey: Uint8Array; // Backup key (should be stored securely)
}

export interface VerificationStage {
  name: 'transcription' | 'analysis' | 'safety';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress: number; // 0-100
  message?: string;
}

export interface VerificationResult {
  id: string;
  state: 'pending' | 'processing' | 'completed' | 'failed';
  currentStage: VerificationStage['name'];
  stages: VerificationStage[];
  transcript?: string;
  qualityScore?: number;
  safetyPassed?: boolean;
  insights?: string[];
  error?: string;
  updatedAt: number;
}

export interface PublishResult {
  txDigest: string;
  datasetId: string;
  confirmed: boolean;
}

export interface UploadWizardState {
  step: UploadStep;
  audioFile: AudioFile | null;
  metadata: DatasetMetadata | null;
  encryption: EncryptionResult | null;
  walrusUpload: WalrusUploadResult | null;
  verification: VerificationResult | null;
  publish: PublishResult | null;
  error: string | null;
}
