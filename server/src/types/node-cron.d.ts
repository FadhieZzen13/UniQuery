// Minimal ambient declaration: node-cron ships no bundled types and @types/node-cron
// is not installed in this environment. Pre-existing gap unrelated to the Week-12 work,
// surfaced because tsc emits nothing while any module is untyped. Covers the only API
// the codebase uses (cron.schedule).
declare module 'node-cron' {
  interface ScheduledTask {
    start(): void;
    stop(): void;
  }
  interface ScheduleOptions {
    scheduled?: boolean;
    timezone?: string;
  }
  export function schedule(
    expression: string,
    task: () => void,
    options?: ScheduleOptions
  ): ScheduledTask;
  export function validate(expression: string): boolean;
  const _default: { schedule: typeof schedule; validate: typeof validate };
  export default _default;
}
