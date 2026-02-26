import { useMemo, useState } from 'react';
import axios from 'axios';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Typography
} from '@mui/material';
import type { DetectionResult, InferenceResponse } from '@lpr/shared-types';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

type DialogState = {
  open: boolean;
  title: string;
  detections: DetectionResult[];
  message: string;
};

function App(): JSX.Element {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dialogState, setDialogState] = useState<DialogState>({
    open: false,
    title: 'Detection Result',
    detections: [],
    message: ''
  });

  const selectedFileLabel = useMemo(
    () => selectedFile?.name ?? 'No file selected',
    [selectedFile]
  );

  const onDropFile = (file: File): void => {
    setSelectedFile(file);
    setErrorMessage(null);
  };

  const onAnalyze = async (): Promise<void> => {
    if (!selectedFile) {
      setErrorMessage('Please choose an image file before analyzing.');
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);

    setIsAnalyzing(true);
    setErrorMessage(null);

    try {
      const response = await axios.post<InferenceResponse>(
        `${apiBaseUrl}/v1/infer/image`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      const hasDetection = response.data.detections.length > 0;
      setDialogState({
        open: true,
        title: hasDetection ? 'Detection Result' : 'No plate detected',
        detections: response.data.detections,
        message: response.data.message
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = (error.response?.data as { message?: string | string[] })
          ?.message;
        setErrorMessage(
          Array.isArray(message)
            ? message.join(', ')
            : (message ?? 'Failed to analyze image.')
        );
      } else {
        setErrorMessage('Failed to analyze image.');
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const firstDetection = dialogState.detections[0];

  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Thai License Plate Detection
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Upload a CCTV-captured image and run synchronous inference.
          </Typography>
        </Box>

        <Paper
          elevation={0}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            const file = event.dataTransfer.files?.[0];
            if (file) {
              onDropFile(file);
            }
          }}
          sx={{
            border: '2px dashed',
            borderColor: isDragging ? 'primary.main' : 'divider',
            borderRadius: 2,
            p: 5,
            textAlign: 'center',
            backgroundColor: isDragging ? 'rgba(30, 58, 138, 0.05)' : 'white'
          }}
        >
          <Stack spacing={2} alignItems="center">
            <Typography variant="h6">Drag and drop image here</Typography>
            <Typography variant="body2" color="text.secondary">
              JPG, JPEG, PNG, WEBP (max 5MB)
            </Typography>
            <Button variant="outlined" component="label">
              Browse file
              <input
                type="file"
                hidden
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    onDropFile(file);
                  }
                }}
              />
            </Button>
            <Typography variant="body2" color="text.secondary">
              {selectedFileLabel}
            </Typography>
          </Stack>
        </Paper>

        <Box display="flex" gap={2} alignItems="center">
          <Button
            variant="contained"
            onClick={() => void onAnalyze()}
            disabled={isAnalyzing}
          >
            Analyze
          </Button>
          {isAnalyzing ? <CircularProgress size={24} /> : null}
        </Box>

        {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
      </Stack>

      <Dialog
        open={dialogState.open}
        onClose={() => setDialogState((current) => ({ ...current, open: false }))}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{dialogState.title}</DialogTitle>
        <DialogContent dividers>
          {firstDetection ? (
            <Stack spacing={1.5}>
              <Typography>
                <strong>Plate:</strong> {firstDetection.plateNumber ?? '-'}
              </Typography>
              <Typography>
                <strong>Province:</strong> {firstDetection.province ?? '-'}
              </Typography>
              <Typography>
                <strong>OCR Confidence:</strong> {firstDetection.ocrConf.toFixed(2)}
              </Typography>
              <Typography>
                <strong>Province Confidence:</strong>{' '}
                {firstDetection.provinceConf.toFixed(2)}
              </Typography>
            </Stack>
          ) : (
            <Alert severity="warning">No plate detected</Alert>
          )}
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            {dialogState.message}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogState((current) => ({ ...current, open: false }))}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default App;
