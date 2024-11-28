import { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';

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

    setClient(client: WebSocket) {
        if (this.client) {
            throw new Error('Client already set');
        }

        if (this.messenger === client) {
            throw new Error('Client and Messenger cannot be the same');
        }

        this.client = client;
    }

    setMessenger(messenger: WebSocket) {
        if (this.messenger) {
            throw new Error('Messenger already set');
        }

        if (this.client === messenger) {
            throw new Error('Client and Messenger cannot be the same');
        }

        this.messenger = messenger;
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

server.on('connection', (ws: WebSocket, req) => {
    let url = req.url;

    if (!url) {
        ws.close(1008, 'Invalid URL');
        return;
    }

    if (!url.startsWith('/channel')) {
        ws.close(1008, 'Invalid URL');
        return;
    }

    let clientChannel = url.replace('/channel/', '');
    if (!clientChannel || clientChannel.length < 16) {
        ws.close(1008, 'Invalid URL. Channel must be at least 16 characters long');
        return;
    }

    let logprefix = `${clientChannel} -> `;
    console.log(logprefix, 'WSClient connected');

    let channel = getChannel(clientChannel, ws);
    
    ws.on('message', (message: string) => {
        if (!message) {
            return;
        }

        try {
            let messageStr = message.toString();
            console.log(logprefix, 'Message received', messageStr);

            let messageObj = JSON.parse(messageStr);
            
            switch (messageObj.type) {
                case 'hello-client':
                    channel.setClient(ws);
                    ws.send(JSON.stringify({ type: "ack" }));
                    break;
                case 'hello-messenger':
                    channel.setMessenger(ws);
                    ws.send(JSON.stringify({ type: "ack" }));
                    break;
                case 'message':
                    channel.send(messageStr, ws);
                    ws.send(JSON.stringify({ type: "ack" }));
                    break;
            }

        } catch (error: Error | any) {
            console.error(logprefix, "Error processing message", error);
            ws.send(JSON.stringify({ type: "error", data: error.message }));
        }
    });

    ws.on("close", () => {
        console.log(logprefix, "Client disconnected");
        
        channel?.dispose();
        channels.delete(clientChannel);
    });
});

console.log(`WebSocket server is running on ws://localhost:${port}`);
