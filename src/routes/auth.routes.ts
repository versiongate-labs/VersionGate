import { FastifyInstance } from "fastify";
import {
  authLoginHandler,
  authLogoutHandler,
  authMeHandler,
  authRegisterHandler,
  authStatusHandler,
} from "../controllers/auth.controller";

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.get("/auth/status", { handler: authStatusHandler });
  app.get("/auth/me", { handler: authMeHandler });
  app.post("/auth/register", { handler: authRegisterHandler });
  app.post("/auth/login", { handler: authLoginHandler });
  app.post("/auth/logout", { handler: authLogoutHandler });
}
