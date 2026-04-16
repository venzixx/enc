declare module 'signale' {
  export class Signale {
    constructor(options?: any);
    info(...args: any[]): void;
    warn(...args: any[]): void;
    error(...args: any[]): void;
    success(...args: any[]): void;
    debug(...args: any[]): void;
    [key: string]: any;
  }
  export interface SignaleOptions {
    [key: string]: any;
  }
}
