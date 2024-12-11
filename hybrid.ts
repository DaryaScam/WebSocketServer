import { WebSocket } from "ws";
import { IncomingMessage } from "http";

const WS_HYBRID_ID_LENGTH = 3*2 + 1 + 16*2
class HybridChannel {
    wsA: WebSocket | undefined;
    wsB: WebSocket | undefined;
    
    createdAt: Date = new Date();
    constructor(public channelID: string) {
        this.channelID = channelID;
    }

    addClient(client: WebSocket) {
        if (!this.wsA) {
            this.wsA = client;
        } else if (!this.wsB) {
            this.wsB = client;
        } else {
            throw new Error("Channel is full");
        }
    }

    send(message: Buffer, exclude: WebSocket) {
        if (exclude === this.wsA) {
            this.wsB?.send(message);
        } else {
            this.wsA?.send(message);
        }
    }

    dispose() {
        this.wsA?.close();
        this.wsB?.close();
    }
}

const channels: Map<string, HybridChannel> = new Map();

const getChannel = (channel: string): HybridChannel => {
    if (!channels.has(channel)) {
        channels.set(channel, new HybridChannel(channel));
    }

    let reschannel = channels.get(channel)!;

    return reschannel;
}


export const processWebSessionSocket = (ws: WebSocket, req: IncomingMessage) => {
    let clientChannelId = req.url!.replace("/cable/connect/", "");
    if (clientChannelId.length != WS_HYBRID_ID_LENGTH) {
        ws.close(1008, "Invalid channel ID!");
        return;
    }

    let logprefix = `Hybrid-${clientChannelId} -> `;
    console.log(logprefix, "WSClient connected");

    let channel = getChannel(clientChannelId);
    try {
        channel.addClient(ws);
    } catch (error) {
        console.log(logprefix, "Error adding client", error);
        ws.close(1008, "Channel is full");
        return;
    }
    
    ws.on("message", (message: Buffer) => {
        if (!message) {
            return;
        }

        console.log(logprefix, "Message received", message.toString("hex"));
        channel.send(message, ws);
    });

    ws.on("close", () => {
        console.log(logprefix, "Client disconnected");

        if (channel.wsA === ws || channel.wsA === ws) {
            console.log(logprefix, "Disposing channel");
            channel.dispose();
            channels.delete(clientChannelId);
        }
    });
}