import express from "express";
import cors from "cors";
import { auth } from "./middleware/auth.js";
import { errorHandler } from "./middleware/errorHandler.js";

import authRoutes        from "./modules/auth/auth.routes.js";
import schoolRoutes      from "./modules/school/school.routes.js";
import adminRoutes       from "./modules/admin/admin.routes.js";
import uploadRoutes      from "./modules/upload/upload.routes.js";
import homeRoutes        from "./modules/home/home.routes.js";
import donationRoutes    from "./modules/donation/donation.routes.js";
import certificateRoutes from "./modules/certificate/certificate.routes.js";
import marketRoutes      from "./modules/Market/Market.routes.js";
import notificationRouter from "./modules/notification/notifications.router.js";
import cartRoutes from "./modules/cart/cart.routes.js";
import checkoutRoutes from "./modules/checkout/checkout.routes.js";

import autocheckRoutes from "./modules/autocheck/autocheck.routes.js";
import { runProjectLifecycleCron } from "./cron/projectLifecycle.js";
import { runOrderLifecycleCron }   from "./cron/orderLifecycle.js";
import orderRoutes from "./modules/orders/order.routes.js";
import sellerRoutes from "./modules/seller/seller.routes.js";
import searchRoutes from "./modules/search/search.routes.js";

const app = express();
app.use(cors());

app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "unsafe-none");
  res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");
  next();
});

app.use(express.json({ limit: "10mb" }));

app.use("/auth",         authRoutes);
app.use("/school",       schoolRoutes);

app.use("/admin/autocheck", autocheckRoutes);
app.use("/admin",        adminRoutes);
app.use("/upload",       uploadRoutes);
app.use("/",             homeRoutes);
app.use("/donations",    donationRoutes);
app.use("/certificates", certificateRoutes);
app.use("/api/market", marketRoutes);

app.use("/notifications", notificationRouter); // ← register

app.use("/api/cart", cartRoutes);
app.use("/api/checkout", checkoutRoutes);
app.use("/api/orders", orderRoutes);
app.use("/seller",     sellerRoutes);
app.use("/api/search", searchRoutes);


app.use(errorHandler);
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || err.http_code || 500;
  res.status(status).json({ message: err.message || "Internal Server Error" });
});

// รัน cron ทันทีตอน server start แล้วตั้ง interval ทุก 24 ชั่วโมง
runProjectLifecycleCron();
setInterval(runProjectLifecycleCron, 24 * 60 * 60 * 1000);

// order lifecycle: auto-cancel (3 วัน), warn seller (2 วัน), auto-confirm (7 วัน)
// รันทุก 1 ชั่วโมงเพื่อให้ timing แม่นยำ
runOrderLifecycleCron();
setInterval(runOrderLifecycleCron, 60 * 60 * 1000);

export default app;
