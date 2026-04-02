import { FastifyInstance } from "fastify";
import prisma from "../prisma/client";
import { logEmitter } from "../events/log-emitter";

export async function logsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/logs/:jobId", { websocket: true }, (socket, req) => {
    const jobId =
      (req.params as { jobId?: string }).jobId ??
      req.url.replace(/^\//, "").split("/").pop()?.split("?")[0] ??
      "";
    if (!jobId) {
      socket.close();
      return;
    }

    let lastIndex = 0;
    let closed = false;

    const sendJson = (obj: unknown): void => {
      if (closed) return;
      try {
        socket.send(JSON.stringify(obj));
      } catch {
        closed = true;
      }
    };

    void (async () => {
      const job = await prisma.job.findUnique({ where: { id: jobId } });
      if (!job) {
        sendJson({ type: "error", message: "Job not found" });
        socket.close();
        return;
      }

      const initialLogs = Array.isArray(job.logs) ? (job.logs as string[]) : [];
      for (let i = 0; i < initialLogs.length; i++) {
        sendJson({
          type: "log",
          line: initialLogs[i],
          timestamp: new Date().toISOString(),
        });
      }
      lastIndex = initialLogs.length;

      const isTerminal = (s: string) => s === "COMPLETE" || s === "FAILED" || s === "CANCELLED";

      if (isTerminal(job.status)) {
        sendJson({ type: "status", status: job.status });
        socket.close();
        return;
      }

      const onLiveLog = (line: string): void => {
        sendJson({ type: "log", line, timestamp: new Date().toISOString() });
      };
      const unsubLog = logEmitter.subscribeLog(jobId, onLiveLog);

      const poll = setInterval(async () => {
        try {
          const j = await prisma.job.findUnique({ where: { id: jobId } });
          if (!j || closed) {
            clearInterval(poll);
            return;
          }
          const logs = Array.isArray(j.logs) ? (j.logs as string[]) : [];
          while (lastIndex < logs.length) {
            sendJson({
              type: "log",
              line: logs[lastIndex],
              timestamp: new Date().toISOString(),
            });
            lastIndex++;
          }
          if (isTerminal(j.status)) {
            sendJson({ type: "status", status: j.status });
            clearInterval(poll);
            unsubLog();
            closed = true;
            socket.close();
          }
        } catch {
          clearInterval(poll);
        }
      }, 400);

      socket.on("close", () => {
        closed = true;
        clearInterval(poll);
        unsubLog();
      });
    })();
  });
}
