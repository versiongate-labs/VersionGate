import { FastifyInstance } from "fastify";
import {
  cancelJobHandler,
  getJobHandler,
  listAllJobsHandler,
  listProjectJobsHandler,
} from "../controllers/job.controller";

const jobSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    type: { type: "string" },
    status: { type: "string" },
    projectId: { type: "string" },
    deploymentId: { type: "string", nullable: true },
    payload: { type: "object" },
    result: { type: "object", nullable: true },
    logs: { type: "array" },
    error: { type: "string", nullable: true },
    startedAt: { type: "string", nullable: true },
    completedAt: { type: "string", nullable: true },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
  },
};

export async function jobRoutes(app: FastifyInstance): Promise<void> {
  app.get("/jobs", {
    handler: listAllJobsHandler,
  });

  app.get("/jobs/:id", {
    schema: {
      response: { 200: { type: "object", properties: { job: jobSchema } } },
    },
    handler: getJobHandler,
  });

  app.get("/projects/:id/jobs", {
    handler: listProjectJobsHandler,
  });

  app.delete("/jobs/:id", {
    schema: {
      response: { 200: { type: "object", properties: { cancelled: { type: "boolean" } } } },
    },
    handler: cancelJobHandler,
  });
}
