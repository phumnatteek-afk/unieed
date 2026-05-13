// src/config/meilisearch.js — Meilisearch client (local Docker)
import { Meilisearch } from "meilisearch";

export const meili = new Meilisearch({
  host:   process.env.MEILI_HOST   || "http://localhost:7700",
  apiKey: process.env.MEILI_API_KEY || "",  // leave empty for dev, set masterKey in prod
});
