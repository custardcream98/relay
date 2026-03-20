// packages/server/src/cli.ts
// CLI argument parsing and validation (no external deps).
import { isValidId } from "./utils/validate.js";

export interface CliArgs {
  port?: number;
  instance?: string;
}

/**
 * Parse relay-specific CLI args from an argv slice.
 * Supports: --port <number>  --instance <id>
 */
export function parseArgs(argv: string[]): CliArgs {
  const result: CliArgs = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--port" && argv[i + 1]) {
      const p = Number(argv[i + 1]);
      if (!Number.isNaN(p)) result.port = p;
      i++;
    } else if (argv[i] === "--instance" && argv[i + 1]) {
      result.instance = argv[i + 1];
      i++;
    }
  }
  return result;
}

/**
 * Validate and apply CLI args to the process environment.
 * Exits the process on invalid values.
 */
export function applyCliArgs(args: CliArgs): void {
  // Validate --instance value: only alphanumeric, hyphen, underscore allowed
  // Prevents DB path traversal via RELAY_INSTANCE (e.g. "../../tmp/malicious")
  if (args.instance && !isValidId(args.instance)) {
    console.error("[relay] invalid --instance value; use alphanumeric, hyphen, underscore only");
    process.exit(1);
  }

  // Apply --instance CLI arg to env before any module reads RELAY_INSTANCE
  if (args.instance) {
    process.env.RELAY_INSTANCE = args.instance;
  }

  // Validate RELAY_INSTANCE env var as well (set directly without --instance flag)
  if (process.env.RELAY_INSTANCE && !isValidId(process.env.RELAY_INSTANCE)) {
    console.error(
      "[relay] invalid RELAY_INSTANCE value; use alphanumeric, hyphen, underscore only"
    );
    process.exit(1);
  }
}
