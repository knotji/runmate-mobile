export function isHealthConnectPermissionError(message: string | null | undefined): boolean {
  if (!message) return false;
  return /health connect.*permission|permission.*health connect|authorization.*denied|read access.*required/i.test(message);
}

export function healthDataErrorCopy(message: string | null | undefined, fallbackTitle: string) {
  if (isHealthConnectPermissionError(message)) {
    return {
      title: 'Health Connect Access Is Required',
      detail: 'RunMate could not read the health records needed for this page. Review Health Connect permissions, then try again.',
      actionLabel: 'Check Health Connect',
    };
  }
  return {
    title: fallbackTitle,
    detail: message ?? undefined,
    actionLabel: 'Try Again',
  };
}
