import app from "./app.js";
import { runMigrations } from "./config/migrate.js";

async function start() {
  await runMigrations();
  app.listen(3000, () => {
    console.log("API running on 3000");
  });
}

start().catch((err) => {
  console.error("Server failed to start:", err);
  process.exit(1);
});

