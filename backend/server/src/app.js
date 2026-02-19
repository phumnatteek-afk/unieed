import express from "express";
import cors from "cors";
import { auth } from "./middleware/auth.js";
import { errorHandler } from "./middleware/errorHandler.js";

import authRoutes from "./modules/auth/auth.routes.js";
import schoolRoutes from "./modules/school/school.routes.js";
import adminRoutes from "./modules/admin/admin.routes.js";
import uploadRoutes from "./modules/upload/upload.routes.js";
import homeRoutes from "./modules/home/home.routes.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.use("/auth", authRoutes);
app.use("/school", auth, schoolRoutes);
app.use("/admin", adminRoutes);
app.use("/upload", uploadRoutes);
app.use("/", homeRoutes);

app.use(errorHandler);
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || err.http_code || 500;
  res.status(status).json({ message: err.message || "Internal Server Error" });
});

export default app;
