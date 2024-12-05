import React, { useCallback, useState } from 'react';
import { Upload, File, AlertCircle, XCircle, CheckCircle } from 'lucide-react';
import { motion, useAnimation } from 'framer-motion';
import { useSpring, animated } from '@react-spring/web';
import { processFiles } from '../utils/fileProcessor';
import { FileUploadZone } from './FileUploadZone';
import { FileList } from './FileList';

interface FileUploaderProps {
  onFileSelect: (files: File[]) => void;
}

interface ExcludedFile {
  file: string;
  reason: string;
}

interface WebKitFileEntry extends FileSystemEntry {
  file(successCallback: (file: File) => void): void;
}

interface WebKitDirectoryEntry extends FileSystemEntry {
  createReader(): WebKitDirectoryReader;
}

interface WebKitDirectoryReader {
  readEntries(successCallback: (entries: WebKitFileEntry[]) => void): void;
}

export function FileUploader({ onFileSelect }: FileUploaderProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [excludedFiles, setExcludedFiles] = useState<ExcludedFile[]>([]);
  const [error, setError] = useState<string>('');
  const [isChecking, setIsChecking] = useState(false);
  const controls = useAnimation();
  const [isDragging, setIsDragging] = useState(false);

  const springProps = useSpring({
    scale: isDragging ? 1.02 : 1,
    config: { tension: 300, friction: 10 },
  });

  const handleFilesSelected = useCallback(async (selectedFiles: File[]) => {
    try {
      setIsChecking(true);
      const result = await processFiles(selectedFiles);
      setFiles(result.processedFiles);
      setExcludedFiles(result.excludedFiles);
      onFileSelect(result.processedFiles);
      setError('');
    } catch (error: unknown) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('An unknown error occurred');
      }
    } finally {
      setIsChecking(false);
    }
  }, [onFileSelect]);

  const handleManualCheck = useCallback(async () => {
    if (files.length === 0) return;
    
    try {
      setIsChecking(true);
      const result = await processFiles(files);
      setFiles(result.processedFiles);
      setExcludedFiles(prev => [...prev, ...result.excludedFiles]);
      onFileSelect(result.processedFiles);
    } catch (error: unknown) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('An unknown error occurred');
      }
    } finally {
      setIsChecking(false);
    }
  }, [files, onFileSelect]);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
    controls.start({ scale: 1.02 });
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    controls.start({ scale: 1 });
  };

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      controls.start({ scale: 1 });

      const items = Array.from(e.dataTransfer.items);
      const fileEntries: File[] = [];

      for (const item of items) {
        if (item.kind === 'file') {
          const entry = item.webkitGetAsEntry() as WebKitFileEntry | WebKitDirectoryEntry | null;
          if (entry) {
            if (entry.isFile) {
              const fileEntry = entry as WebKitFileEntry;
              await new Promise<void>((resolve) => {
                fileEntry.file((file: File) => {
                  fileEntries.push(file);
                  resolve();
                });
              });
            } else if (entry.isDirectory) {
              const dirEntry = entry as WebKitDirectoryEntry;
              const dirReader = dirEntry.createReader();
              const entries = await new Promise<File[]>((resolve) => {
                dirReader.readEntries((entries: WebKitFileEntry[]) => {
                  const files: File[] = [];
                  Promise.all(
                    entries.map(
                      (entry) =>
                        new Promise<void>((resolve) => {
                          entry.file((file: File) => {
                            files.push(file);
                            resolve();
                          });
                        })
                    )
                  ).then(() => resolve(files));
                });
              });
              fileEntries.push(...entries);
            }
          }
        }
      }

      handleFilesSelected(fileEntries);
    },
    [handleFilesSelected, controls]
  );

  return (
    <animated.div style={springProps} className="w-full max-w-2xl mx-auto space-y-4">
      <FileUploadZone
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        isDragging={isDragging}
        onFileSelect={handleFilesSelected}
      />

      {isChecking && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded"
        >
          <div className="flex items-center">
            <div className="animate-spin mr-2">
              <Upload className="h-5 w-5 text-blue-400" />
            </div>
            <p className="text-sm text-blue-700">Checking files for node_modules...</p>
          </div>
        </motion.div>
      )}

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border-l-4 border-red-400 p-4 rounded"
        >
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </motion.div>
      )}

      {files.length > 0 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Selected Files</h3>
            <button
              onClick={handleManualCheck}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors flex items-center gap-2"
            >
              <CheckCircle className="h-4 w-4" />
              Manual Check
            </button>
          </div>
          <FileList files={files} />
        </div>
      )}

      {excludedFiles.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 bg-orange-50 rounded-lg p-4"
        >
          <h3 className="text-lg font-semibold text-orange-700 mb-2 flex items-center gap-2">
            <XCircle className="h-5 w-5" />
            Excluded Files
          </h3>
          <ul className="space-y-2">
            {excludedFiles.map((file, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-orange-600">
                <File className="h-4 w-4 mt-1 flex-shrink-0" />
                <div>
                  <p className="font-medium">{file.file}</p>
                  <p className="text-orange-500 text-xs">{file.reason}</p>
                </div>
              </li>
            ))}
          </ul>
        </motion.div>
      )}
    </animated.div>
  );
}