'use client';

import { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Upload, File, X, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AudioFile } from '@/lib/types/upload';
import { SonarButton } from '@/components/ui/SonarButton';
import { GlassCard } from '@/components/ui/GlassCard';

interface FileUploadStepProps {
  audioFile: AudioFile | null;
  onFileSelected: (audioFile: AudioFile) => void;
  error: string | null;
}

const SUPPORTED_FORMATS = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/flac',
  'audio/ogg',
  'audio/m4a',
];

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

/**
 * FileUploadStep Component
 * Drag-and-drop file upload with validation and preview
 */
export function FileUploadStep({
  audioFile,
  onFileSelected,
  error,
}: FileUploadStepProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback((file: File): string | null => {
    if (!SUPPORTED_FORMATS.includes(file.type)) {
      return `Unsupported file format. Supported formats: MP3, WAV, FLAC, OGG, M4A`;
    }

    if (file.size > MAX_FILE_SIZE) {
      return `File too large. Maximum size is 500MB`;
    }

    return null;
  }, []);

  const getAudioDuration = (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      const url = URL.createObjectURL(file);

      audio.addEventListener('loadedmetadata', () => {
        URL.revokeObjectURL(url);
        resolve(audio.duration);
      });

      audio.addEventListener('error', () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load audio metadata'));
      });

      audio.src = url;
    });
  };

  const processFile = async (file: File) => {
    setValidationError(null);
    setIsProcessing(true);

    try {
      // Validate file
      const validationResult = validateFile(file);
      if (validationResult) {
        setValidationError(validationResult);
        setIsProcessing(false);
        return;
      }

      // Get audio duration
      const duration = await getAudioDuration(file);

      // Create preview URL
      const preview = URL.createObjectURL(file);

      const audioFile: AudioFile = {
        file,
        duration,
        preview,
      };

      onFileSelected(audioFile);
    } catch (err) {
      setValidationError(
        err instanceof Error ? err.message : 'Failed to process audio file'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        processFile(files[0]);
      }
    },
    [processFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        processFile(files[0]);
      }
    },
    [processFile]
  );

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Drop Zone */}
      {!audioFile && (
        <motion.div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            'relative border-2 border-dashed rounded-sonar p-12',
            'transition-all duration-300 cursor-pointer',
            isDragging
              ? 'border-sonar-signal bg-sonar-signal/10'
              : 'border-sonar-blue/50 hover:border-sonar-signal/50 hover:bg-sonar-signal/5',
            'focus-within:ring-2 focus-within:ring-sonar-signal focus-within:ring-offset-2 focus-within:ring-offset-sonar-abyss'
          )}
          onClick={handleBrowseClick}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={SUPPORTED_FORMATS.join(',')}
            onChange={handleFileSelect}
            className="hidden"
            aria-label="Upload audio file"
          />

          <div className="flex flex-col items-center justify-center space-y-4">
            <motion.div
              animate={
                isDragging
                  ? { scale: 1.1, rotate: 5 }
                  : { scale: 1, rotate: 0 }
              }
              className="p-6 rounded-full bg-sonar-signal/10"
            >
              <Upload className="w-12 h-12 text-sonar-signal" />
            </motion.div>

            <div className="text-center">
              <p className="text-lg font-mono text-sonar-highlight-bright mb-2">
                Drop your audio file here
              </p>
              <p className="text-sm text-sonar-highlight/70">
                or click to browse
              </p>
            </div>

            <div className="text-xs text-sonar-highlight/50 font-mono space-y-1 text-center">
              <p>Supported formats: MP3, WAV, FLAC, OGG, M4A</p>
              <p>Maximum file size: 500MB</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* File Preview */}
      {audioFile && (
        <GlassCard>
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4">
                <div className="p-3 rounded-sonar bg-sonar-signal/10">
                  <Volume2 className="w-6 h-6 text-sonar-signal" />
                </div>

                <div className="flex-1">
                  <h3 className="font-mono text-lg text-sonar-highlight-bright mb-1">
                    {audioFile.file.name}
                  </h3>
                  <div className="flex items-center space-x-4 text-sm text-sonar-highlight/70 font-mono">
                    <span>{formatFileSize(audioFile.file.size)}</span>
                    <span>•</span>
                    <span>{formatDuration(audioFile.duration)}</span>
                    <span>•</span>
                    <span className="uppercase">
                      {audioFile.file.type.split('/')[1]}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  if (audioFile.preview) {
                    URL.revokeObjectURL(audioFile.preview);
                  }
                  onFileSelected(null as any);
                }}
                className={cn(
                  'text-sonar-highlight/50 hover:text-sonar-coral',
                  'transition-colors p-2 rounded-sonar',
                  'focus:outline-none focus:ring-2 focus:ring-sonar-coral'
                )}
                aria-label="Remove file"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Audio Player */}
            {audioFile.preview && (
              <audio
                controls
                src={audioFile.preview}
                className="w-full rounded-sonar"
                style={{
                  filter: 'hue-rotate(180deg) saturate(3)',
                }}
              />
            )}
          </div>
        </GlassCard>
      )}

      {/* Validation Error */}
      {validationError && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'p-4 rounded-sonar',
            'bg-sonar-coral/10 border border-sonar-coral',
            'text-sonar-coral font-mono text-sm'
          )}
        >
          {validationError}
        </motion.div>
      )}

      {/* Processing Indicator */}
      {isProcessing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center text-sonar-highlight/70 font-mono"
        >
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-sonar-signal mb-2" />
          <p>Processing audio file...</p>
        </motion.div>
      )}

      {/* Info Box */}
      <GlassCard className="bg-sonar-blue/5">
        <div className="flex items-start space-x-3">
          <File className="w-5 h-5 text-sonar-blue mt-0.5 flex-shrink-0" />
          <div className="text-sm text-sonar-highlight/80 space-y-2">
            <p className="font-mono font-semibold text-sonar-blue">
              Privacy & Security
            </p>
            <p>
              Your audio will be encrypted client-side using Mysten Seal before
              upload. Only you and authorized buyers will have access to the
              full dataset.
            </p>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
