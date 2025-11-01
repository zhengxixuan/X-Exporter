import { logger } from './logger';

export type ToastType = 'error' | 'success' | 'info' | 'warning';

export interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number;
  persist?: boolean;
}

let toastCallback: ((options: ToastOptions) => void) | null = null;

export const registerToastHandler = (callback: (options: ToastOptions) => void): void => {
  toastCallback = callback;
};

export const showToast = (options: ToastOptions): void => {
  if (toastCallback) {
    toastCallback(options);
  } else {
    logger.warn('Toast handler not registered, using console fallback', options);
    console.log(`[${options.type || 'info'}] ${options.message}`);
  }
};

export const handleError = (error: unknown, userMessage: string, options?: { persist?: boolean }): void => {
  logger.error(userMessage, error);

  const errorMessage = error instanceof Error ? error.message : String(error);
  const fullMessage = `${userMessage}${errorMessage ? `: ${errorMessage}` : ''}`;

  showToast({
    message: fullMessage,
    type: 'error',
    persist: options?.persist,
    duration: options?.persist ? undefined : 4000
  });
};

export const handleSuccess = (message: string, options?: { persist?: boolean }): void => {
  logger.info(message);

  showToast({
    message,
    type: 'success',
    persist: options?.persist,
    duration: options?.persist ? undefined : 3000
  });
};

export const handleWarning = (message: string, options?: { persist?: boolean }): void => {
  logger.warn(message);

  showToast({
    message,
    type: 'warning',
    persist: options?.persist,
    duration: options?.persist ? undefined : 3500
  });
};

export const handleInfo = (message: string, options?: { persist?: boolean }): void => {
  logger.info(message);

  showToast({
    message,
    type: 'info',
    persist: options?.persist,
    duration: options?.persist ? undefined : 3000
  });
};
