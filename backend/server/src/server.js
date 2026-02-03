import "dotenv/config";
import express from "express";
import cors from "cors";

import authRoutes from "./modules/auth/auth.routes.js";
import uploadRoutes from "./modules/upload/upload.routes.js";
import adminRoutes from "./modules/admin/admin.routes.js"; // ✅ เพิ่มบรรทัดนี้

import { errorHandler } from "./middleware/errorHandler.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/upload", uploadRoutes);
app.use("/admin", adminRoutes); // ✅ ตอนนี้รู้จักแล้ว

app.use(errorHandler);

app.listen(3000, () => console.log("API running on 3000"));
