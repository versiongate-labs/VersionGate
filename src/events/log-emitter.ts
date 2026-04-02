import { EventEmitter } from "events";

type LogHandler = (line: string) => void;
type StatusHandler = (status: "COMPLETE" | "FAILED") => void;

class LogEmitterService extends EventEmitter {
  emitLog(jobId: string, line: string): void {
    this.emit(`log:${jobId}`, line);
  }

  emitStatus(jobId: string, status: "COMPLETE" | "FAILED"): void {
    this.emit(`status:${jobId}`, status);
  }

  subscribeLog(jobId: string, handler: LogHandler): () => void {
    const channel = `log:${jobId}`;
    this.on(channel, handler);
    return () => {
      this.off(channel, handler);
    };
  }

  subscribeStatus(jobId: string, handler: StatusHandler): () => void {
    const channel = `status:${jobId}`;
    this.on(channel, handler);
    return () => {
      this.off(channel, handler);
    };
  }
}

export const logEmitter = new LogEmitterService();
