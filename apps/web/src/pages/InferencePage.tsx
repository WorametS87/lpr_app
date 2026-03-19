import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Stack,
  Typography
} from '@mui/material';
import UploadPanel from '../components/features/UploadPanel';
import ResultDialog from '../components/features/ResultDialog';
import { useInferenceController } from '../controllers/useInferenceController';

function InferencePage(): JSX.Element {
  const {
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
  } = useInferenceController();

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

        <UploadPanel
          isDragging={isDragging}
          selectedFileLabel={selectedFileLabel}
          previewUrl={previewUrl}
          onDropFile={onDropFile}
          onDragStateChange={setIsDragging}
        />

        <Box display="flex" gap={2} alignItems="center">
          <Button variant="contained" onClick={() => void onAnalyze()} disabled={isAnalyzing}>
            Analyze
          </Button>
          {isAnalyzing ? <CircularProgress size={24} /> : null}
        </Box>

        {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
      </Stack>

      <ResultDialog state={dialogState} onClose={closeDialog} />
    </Container>
  );
}

export default InferencePage;
