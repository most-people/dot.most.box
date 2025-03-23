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
    private subscriptions;
    constructor(httpServer: Server);
    private checkDotKey;
    private handleMessage;
    private putData;
    private saveData;
    private loadData;
    private broadcast;
}

export { DotServer, DotServer as default };
export type { DotData };
