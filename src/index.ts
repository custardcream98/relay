// src/index.ts
import { createMcpServer, startMcpServer } from "./mcp";

const server = createMcpServer();
await startMcpServer(server);
