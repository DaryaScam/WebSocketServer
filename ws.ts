import { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';

const DEFAULT_PORT = 8080;
const port = process.env.PORT
    ? parseInt(process.env.PORT)
    : DEFAULT_PORT;

const server = new WebSocket.Server({ port });

class WSChannel {
    clients: WebSocket[] = [];
    constructor(public channel: string) {
        this.channel = channel;
    }

    addClient(client: WebSocket) {
        this.clients.push(client);
    }

    isClientInChannel(client: WebSocket) {
        return this.clients.includes(client);
    }

    removeClient(client: WebSocket) {
        const index = this.clients.findIndex(c => c === client);
        if (index !== -1) {
            this.clients.splice(index, 1);
        }
    }

    send(message: string, exclude: WebSocket) {
        this.clients.forEach(client => {
            if (client !== exclude) {
                client.send(message);
            }
        });
    }
}

const channels: Map<string, WSChannel> = new Map();

const getChannel = (channel: string, client: WebSocket): WSChannel => {
    if (!channels.has(channel)) {
        channels.set(channel, new WSChannel(channel));
    }

    let reschannel = channels.get(channel)!;

    if (!reschannel.isClientInChannel(client)) {
        reschannel.addClient(client);
    }

    return reschannel;
}

server.on('connection', (ws: WebSocket, req) => {
    ws.uuid = uuidv4();
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

    let logprefix = `${clientChannel}/${ws.uuid} -> `;
    console.log(logprefix, 'Client connected');

    let channel = getChannel(clientChannel, ws);
    
    ws.on('message', (message: string) => {
        if (!message) {
            return;
        }

        let messageStr = message.toString();

        console.log(logprefix, 'Message received', messageStr);

        channel.send(messageStr, ws);
    });

    ws.on('close', () => {
        console.log(logprefix, 'Client disconnected');
        channel.removeClient(ws);
    });
});

console.log(`WebSocket server is running on ws://localhost:${port}`);