import JSZip from 'jszip';

interface ProcessingResult {
  processedFiles: File[];
  excludedFiles: {
    file: string;
    reason: string;
  }[];
}

export async function processFiles(files: File[]): Promise<ProcessingResult> {
  const result: ProcessingResult = {
    processedFiles: [],
    excludedFiles: []
  };

  for (const file of files) {
    try {
      if (file.name.endsWith('.zip')) {
        const zipResult = await extractZipContents(file);
        result.processedFiles.push(...zipResult.processedFiles);
        result.excludedFiles.push(...zipResult.excludedFiles);
      } else {
        if (isNodeModulesFile(file.name)) {
          result.excludedFiles.push({
            file: file.name,
            reason: 'node_modules folder detected'
          });
        } else {
          result.processedFiles.push(file);
        }
      }
    } catch (error: any) {
      console.error(`Error processing file ${file.name}:`, error);
      result.excludedFiles.push({
        file: file.name,
        reason: `Error: ${error.message}`
      });
    }
  }

  return result;
}

function isNodeModulesFile(path: string): boolean {
  const normalizedPath = path.replace(/\\/g, '/');
  return normalizedPath.includes('node_modules/') || normalizedPath.includes('/node_modules');
}

async function extractZipContents(zipFile: File): Promise<ProcessingResult> {
  const result: ProcessingResult = {
    processedFiles: [],
    excludedFiles: []
  };

  try {
    const arrayBuffer = await zipFile.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer, { createFolders: true });

    await Promise.all(
      Object.entries(zip.files).map(async ([path, file]) => {
        if (!file.dir) {
          try {
            if (isNodeModulesFile(path)) {
              result.excludedFiles.push({
                file: path,
                reason: 'node_modules folder detected in ZIP'
              });
            } else {
              const blob = await file.async('blob');
              const extractedFile = new File([blob], path, {
                type: blob.type || 'application/octet-stream',
              });
              result.processedFiles.push(extractedFile);
            }
          } catch (error) {
            console.error(`Error extracting ${path} from ZIP:`, error);
            result.excludedFiles.push({
              file: path,
              reason: `Error extracting from ZIP: ${error}`
            });
          }
        }
      })
    );

    if (result.processedFiles.length === 0 && result.excludedFiles.length === 0) {
      throw new Error('No valid files found in the ZIP archive');
    }

    return result;
  } catch (error: any) {
    if (error.message.includes("end of central directory")) {
      throw new Error('Invalid or corrupted ZIP file');
    }
    throw new Error(`Failed to process ZIP file: ${error.message}`);
  }
}