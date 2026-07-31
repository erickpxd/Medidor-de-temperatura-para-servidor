const priorities = { debug: 10, info: 20, warn: 30, error: 40 };
const configuredLevel = process.env.LOG_LEVEL?.toLowerCase() || 'info';
const minimumPriority = priorities[configuredLevel] ?? priorities.info;

function serialize(details) {
  if (!details || Object.keys(details).length === 0) return '';
  return ` ${JSON.stringify(details)}`;
}

function write(level, scope, message, details = {}) {
  if (priorities[level] < minimumPriority) return;
  const line = `${new Date().toISOString()} [${scope}] ${message}${serialize(details)}`;
  const output = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  output(line);
}

export const logger = {
  debug: (scope, message, details) => write('debug', scope, message, details),
  info: (scope, message, details) => write('info', scope, message, details),
  warn: (scope, message, details) => write('warn', scope, message, details),
  error: (scope, message, details) => write('error', scope, message, details)
};
