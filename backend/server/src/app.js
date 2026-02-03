import express from "express";
import cors from "cors";
import { errorHandler } from "./middleware/errorHandler.js";

import authRoutes from "./modules/auth/auth.routes.js";
import schoolRoutes from "./modules/school/school.routes.js";
import adminRoutes from "./modules/admin/admin.routes.js";
import uploadRoutes from "./modules/upload/upload.routes.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.use("/auth", authRoutes);
app.use("/school", schoolRoutes);
app.use("/admin", adminRoutes);
app.use("/upload", uploadRoutes);

app.use(errorHandler);
export default app;
