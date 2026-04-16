import { Signale, type SignaleOptions } from "signale";
import { CONSOLE_LOG_COLORS, LOG_LEVEL, type LogLevel } from "../types/log";

/**
 * Custom Logger class extending Signale.
 */
class Logger extends Signale {
	constructor(scope = "Enc") {
		const options: SignaleOptions = {
			disabled: false,
			interactive: false,
			logLevel: LOG_LEVEL.INFO,
			scope: scope,
			types: Logger.buildTypes(),
		};

		super(options);
	}

	private static buildTypes(): SignaleOptions["types"] {
		const types: any = {};
		for (const level of Object.values(LOG_LEVEL)) {
			const key = level.toLowerCase();
			types[key] = {
				color: CONSOLE_LOG_COLORS[level as LogLevel],
				label: level,
			};
		}
		return types;
	}

    // satisfy TypeScript without override keyword to avoid errors if types are missing
    public info(...args: any[]): void { (this as any).info(...args); }
    public warn(...args: any[]): void { (this as any).warn(...args); }
    public error(...args: any[]): void { (this as any).error(...args); }
    public success(...args: any[]): void { (this as any).success(...args); }
    public debug(...args: any[]): void { (this as any).debug(...args); }
}

const logger = new Logger() as Logger & { 
    success: (...args: any[]) => void; 
    error: (...args: any[]) => void;
    debug: (...args: any[]) => void;
    info: (...args: any[]) => void;
    warn: (...args: any[]) => void;
};

export default logger;
