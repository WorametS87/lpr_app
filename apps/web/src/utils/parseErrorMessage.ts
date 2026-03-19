export function parseErrorMessage(error: unknown, defaultMessage: string): string {
  const err = error as {
    response?: { data?: { message?: string | string[] } };
    message?: string;
  };

  const responseMessage = err.response?.data?.message;
  if (typeof responseMessage === 'string') {
    return responseMessage;
  }

  if (Array.isArray(responseMessage) && responseMessage.length > 0) {
    return responseMessage.join(', ');
  }

  if (typeof err.message === 'string' && err.message.trim().length > 0) {
    return err.message;
  }

  return defaultMessage;
}
