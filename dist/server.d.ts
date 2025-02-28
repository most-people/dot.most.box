import { Server } from 'http';

interface DotData {
    value: any;
    sig: string;
    timestamp: number;
}
declare class DotServer {
    private peers;
    private data;
    private dataFile;
    private server;
    private hasChanges;
    constructor(httpServer: Server);
    private checkDotKey;
    private handleMessage;
    private putData;
    private saveData;
    private loadData;
    private broadcast;
}

export { type DotData, DotServer, DotServer as default };
