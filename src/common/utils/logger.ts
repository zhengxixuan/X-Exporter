export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const shouldLog = (level: LogLevel): boolean => {
  if (level === 'error' || level === 'warn') {
    return true;
  }

  return import.meta.env.DEV;
};

export const log = (level: LogLevel, ...args: unknown[]): void => {
  if (!shouldLog(level)) {
    return;
  }

  const prefix = `[X-Exporter:${level.toUpperCase()}]`;
  // eslint-disable-next-line no-console
  console[level === 'debug' ? 'info' : level](prefix, ...args);
};

export const logger = {
  debug: (...args: unknown[]) => log('debug', ...args),
  info: (...args: unknown[]) => log('info', ...args),
  warn: (...args: unknown[]) => log('warn', ...args),
  error: (...args: unknown[]) => log('error', ...args)
};
