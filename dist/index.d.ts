interface MostWallet {
    username: string;
    address: string;
    public_key: string;
    private_key: string;
    mnemonic: string;
}
declare const mostWallet: (username: string, password: string, danger?: string) => MostWallet;
declare const mostEncode: (text: string, public_key: string, private_key: string) => string;
declare const mostDecode: (data: string, public_key: string, private_key: string) => string;

interface DotMethods {
    put: (key: string, value: any, encrypt?: boolean) => Promise<void>;
    on: (key: string, callback: (value: any, timestamp: number) => void, options?: {
        decrypt?: boolean;
    }) => DotClient;
    off: (key: string, callback?: (value: any) => void) => DotClient;
    setSigner: (signer: any) => void;
    setPubKey: (publicKey: string) => void;
    setPrivKey: (privateKey: string) => void;
    notify: (receiver: string, value: any) => void;
}
declare class DotClient {
    private nodes;
    private listeners;
    private WebSocketImpl;
    private signers;
    private publicKeys;
    private privateKeys;
    constructor(urls: string[]);
    addNode(url: string): void;
    setAddressSigner(address: string, signer: any): void;
    setAddressPublicKey(address: string, publicKey: string): void;
    setAddressPrivateKey(address: string, privateKey: string): void;
    private getSigner;
    private getPublicKey;
    private getPrivateKey;
    dot(address: string): DotMethods;
    notify(sender: string, receiver: string, value: any): Promise<void>;
    private connectNode;
    private handleMessage;
    private sendMessage;
    private flushNodeMessageQueue;
    put(key: string, value: any, encrypt?: boolean): Promise<void>;
    on(key: string, callback: (value: any, timestamp: number) => void, { decrypt }?: {
        decrypt?: boolean;
    }): DotClient;
    off(key: string, callback?: (value: any, timestamp: number) => void): DotClient;
}

declare const Dot: {
    DotClient: typeof DotClient;
    mostWallet: (username: string, password: string, danger?: string) => MostWallet;
    mostEncode: (text: string, public_key: string, private_key: string) => string;
    mostDecode: (data: string, public_key: string, private_key: string) => string;
};

export { DotClient, Dot as default, mostDecode, mostEncode, mostWallet };
export type { DotMethods, MostWallet };
