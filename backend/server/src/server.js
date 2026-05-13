import { createServer } from "http";
import app from "./app.js";
import { runMigrations } from "./config/migrate.js";
import { initSocket } from "./config/socket.js";
import { seedIndexes } from "./modules/search/search.service.js";

async function start() {
  await runMigrations();

  // Wrap Express with http.Server so Socket.io shares the same port
  const httpServer = createServer(app);
  initSocket(httpServer);

  httpServer.listen(3000, () => {
    console.log("API + Socket.io running on :3000");
  });

  // Seed Meilisearch in background (won't crash server if Docker isn't running)
  seedIndexes().catch(err =>
    console.warn("[meilisearch] seed skipped (is Docker running?):", err.message)
  );
}

start().catch((err) => {
  console.error("Server failed to start:", err);
  process.exit(1);
});

