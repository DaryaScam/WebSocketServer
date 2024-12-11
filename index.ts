import { WebSocket } from "ws";
import { v4 as uuidv4 } from "uuid";
import { processWebSessionSocket } from "./websession";
import { processHybridSocket } from "./hybrid";

const DEFAULT_PORT = 8080;
const port = process.env.PORT
    ? parseInt(process.env.PORT)
    : DEFAULT_PORT;

const server = new WebSocket.Server({ port });

server.on("connection", (ws: WebSocket, req) => {
    let url = req.url || "";

    if (url.startsWith("/channel")) {
        processWebSessionSocket(ws, req);
    } else if (url.startsWith("/cable/connect/")) {
        processHybridSocket(ws, req);
    } else {
        ws.close(1008, "Invalid URL");
        return;
    }

});

console.log(`WebSocket server is running on ws://localhost:${port}`);
