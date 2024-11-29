import { WebSocket } from "ws";
import { v4 as uuidv4 } from "uuid";

const MSGT = {
    HELLO_CLIENT: "hello-client",
    HELLO_MESSENGER: "hello-messenger",

    CHANNEL_READY: "channel-ready",

    MESSAGE: "message",
    ACK: "ack",
    ERROR: "error",
}

interface Message {
    type: string;
    data?: any;
}

const DEFAULT_PORT = 8080;
const port = process.env.PORT
    ? parseInt(process.env.PORT)
    : DEFAULT_PORT;

const server = new WebSocket.Server({ port });

class MessengerAuthenticationChannel {
    client: WebSocket | undefined;
    messenger: WebSocket | undefined;
    
    createdAt: Date = new Date();
    constructor(public channelID: string) {
        this.channelID = channelID;
    }

    checkReady() {
        if (!this.client || !this.messenger) {
            return;
        }

        let msg = JSON.stringify({ type: MSGT.CHANNEL_READY });
        
        this.client.send(msg);
        this.messenger.send(msg);
        console.log(this.channelID, "->", "Channel ready");
    }

    setClient(client: WebSocket) {
        if (this.client) {
            throw new Error("Client already set");
        }

        if (this.messenger === client) {
            throw new Error("Client and Messenger cannot be the same");
        }

        this.client = client;

        this.checkReady();
    }

    setMessenger(messenger: WebSocket) {
        if (this.messenger) {
            throw new Error("Messenger already set");
        }

        if (this.client === messenger) {
            throw new Error("Client and Messenger cannot be the same");
        }

        this.messenger = messenger;

        this.checkReady();
    }

    send(message: string, exclude: WebSocket) {
        if (exclude === this.client) {
            this.messenger?.send(message);
        } else {
            this.client?.send(message);
        }
    }

    dispose() {
        this.client?.close();
        this.messenger?.close();
    }
}

const channels: Map<string, MessengerAuthenticationChannel> = new Map();

const getChannel = (channel: string, client: WebSocket): MessengerAuthenticationChannel => {
    if (!channels.has(channel)) {
        channels.set(channel, new MessengerAuthenticationChannel(channel));
    }

    let reschannel = channels.get(channel)!;

    return reschannel;
}

const sendMessage = (prefix: string, ws: WebSocket, message: Message) => {
    let msg = JSON.stringify(message);
    console.log(prefix, "Sending message", msg);
    ws.send(msg);
}

server.on("connection", (ws: WebSocket, req) => {
    let url = req.url;

    if (!url) {
        ws.close(1008, "Invalid URL");
        return;
    }

    if (!url.startsWith("/channel")) {
        ws.close(1008, "Invalid URL");
        return;
    }

    let clientChannel = url.replace("/channel/", "");
    if (!clientChannel || clientChannel.length < 16) {
        ws.close(1008, "Invalid URL. Channel must be at least 16 characters long");
        return;
    }

    let logprefix = `${clientChannel} -> `;
    console.log(logprefix, "WSClient connected");

    let channel = getChannel(clientChannel, ws);
    
    ws.on("message", (message: string) => {
        if (!message) {
            return;
        }

        try {
            let messageStr = message.toString();
            console.log(logprefix, "Message received", messageStr);

            let messageObj: Message = JSON.parse(messageStr);
            
            switch (messageObj.type) {
                case "hello-client":
                    channel.setClient(ws);
                    sendMessage(logprefix, ws, { type: MSGT.ACK});
                    break;
                case "hello-messenger":
                    channel.setMessenger(ws);
                    sendMessage(logprefix, ws, { type: MSGT.ACK });
                    break;
                case "message":
                    channel.send(messageStr, ws);
                    break;
            }

        } catch (error: Error | any) {
            console.error(logprefix, "Error processing message", error);
            sendMessage(logprefix, ws, { type: MSGT.ERROR, data: error.message });
        }
    });

    ws.on("close", () => {
        console.log(logprefix, "Client disconnected");
        
        channel?.dispose();
        channels.delete(clientChannel);
    });
});

console.log(`WebSocket server is running on ws://localhost:${port}`);
