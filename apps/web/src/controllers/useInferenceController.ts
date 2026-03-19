import { useCallback, useEffect, useMemo, useState } from 'react';
import { inferenceService } from '../services/inference.service';
import {
  initialResultDialogState,
  type ResultDialogState
} from '../types/inference';
import { parseErrorMessage } from '../utils/parseErrorMessage';

export function useInferenceController() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dialogState, setDialogState] = useState<ResultDialogState>(
    initialResultDialogState
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedFile]);

  const selectedFileLabel = useMemo(
    () => selectedFile?.name ?? 'No file selected',
    [selectedFile]
  );

  const onDropFile = useCallback((file: File): void => {
    setSelectedFile(file);
    setErrorMessage(null);
  }, []);

  const onAnalyze = useCallback(async (): Promise<void> => {
    if (!selectedFile) {
      setErrorMessage('Please choose an image file before analyzing.');
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage(null);

    try {
      const data = await inferenceService.analyzeImage(selectedFile);
      const hasDetection = data.detections.length > 0;

      setDialogState({
        open: true,
        title: hasDetection ? 'Detection Result' : 'No plate detected',
        detections: data.detections,
        message: data.message,
        debugInfo: data.debugInfo ?? null
      });
    } catch (error) {
      setErrorMessage(parseErrorMessage(error, 'Failed to analyze image.'));
    } finally {
      setIsAnalyzing(false);
    }
  }, [selectedFile]);

  const closeDialog = useCallback(() => {
    setDialogState((state) => ({ ...state, open: false }));
  }, []);

  return {
    isDragging,
    isAnalyzing,
    errorMessage,
    selectedFileLabel,
    previewUrl,
    dialogState,
    onDropFile,
    onAnalyze,
    closeDialog,
    setIsDragging
  };
}
