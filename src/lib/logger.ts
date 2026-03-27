/**
 * Structured logger for API routes.
 *
 * Outputs JSON lines for easy parsing in Vercel/Railway logs.
 * In development, falls back to console methods with prefixed tags.
 */

type LogLevel = "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  route?: string;
  durationMs?: number;
  userId?: string;
  [key: string]: unknown;
}

const isDev = process.env.NODE_ENV === "development";

function emit(entry: LogEntry): void {
  const timestamp = new Date().toISOString();
  const full = { timestamp, ...entry };

  if (isDev) {
    const tag = `[${entry.route ?? "app"}]`;
    const method = entry.level === "error" ? console.error : entry.level === "warn" ? console.warn : console.log;
    method(tag, entry.message, entry.durationMs != null ? `(${entry.durationMs}ms)` : "", entry.level === "error" && entry.error ? entry.error : "");
    return;
  }

  // Production: structured JSON line
  const out = entry.level === "error" ? process.stderr : process.stdout;
  out.write(JSON.stringify(full) + "\n");
}

export const log = {
  info(message: string, meta?: Omit<LogEntry, "level" | "message">) {
    emit({ level: "info", message, ...meta });
  },
  warn(message: string, meta?: Omit<LogEntry, "level" | "message">) {
    emit({ level: "warn", message, ...meta });
  },
  error(message: string, meta?: Omit<LogEntry, "level" | "message">) {
    emit({ level: "error", message, ...meta });
  },
};
