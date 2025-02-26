import { Message } from './DotServer'
import { mostEncode, mostDecode } from './MostWallet'

// 定义 WebSocket 接口
interface WebSocketLike {
    onopen: ((this: WebSocket, ev: Event) => any) | null
    onclose: ((this: WebSocket, ev: CloseEvent) => any) | null
    onmessage: ((this: WebSocket, ev: MessageEvent) => any) | null
    onerror: ((this: WebSocket, ev: Event) => any) | null
    send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void
    close(code?: number, reason?: string): void
}

// 定义监听器接口
interface Listener {
    callback: (value: any) => void
    once: boolean
    decrypt: boolean // 新增是否解密的标志
}

// 定义 DotClient 的方法接口
export interface DotMethods {
    get: (key: string) => Promise<any>
    put: (key: string, value: any, encrypt?: boolean) => Promise<void>
    on: (
        key: string,
        callback: (value: any) => void,
        options?: { once?: boolean; decrypt?: boolean },
    ) => DotClient
    once: (key: string, callback: (value: any) => void, decrypt?: boolean) => DotClient
    off: (key: string, callback?: (value: any) => void) => DotClient
    setSigner: (signer: any) => void // 设置签名器
    setPubKey: (publicKey: string) => void // 设置公钥
    setPrivKey: (privateKey: string) => void // 设置私钥
}

export class DotClient {
    private url: string
    private ws!: WebSocketLike
    private listeners: Map<string, Set<Listener>>
    private messageQueue: Message[]
    private isConnected: boolean
    private WebSocketImpl: typeof WebSocket
    // 使用 Map 存储每个地址对应的签名器
    private signers: Map<string, any> = new Map()
    // 使用 Map 存储每个地址对应的公钥和私钥
    private publicKeys: Map<string, string> = new Map()
    private privateKeys: Map<string, string> = new Map()

    constructor(url: string) {
        this.url = url
        this.listeners = new Map()
        this.messageQueue = []
        this.isConnected = false

        // 根据环境选择 WebSocket 实现
        if (typeof window !== 'undefined' && window.WebSocket) {
            this.WebSocketImpl = window.WebSocket
        } else {
            try {
                // 动态导入 ws 模块，避免在浏览器环境中报错
                this.WebSocketImpl = require('ws')
            } catch (e) {
                throw new Error('在 Node.js 环境中需要安装 ws 模块: npm install ws')
            }
        }

        this.connect()
    }

    // 为指定地址设置签名器
    setAddressSigner(address: string, signer: any) {
        this.signers.set(address.toLowerCase(), signer)
    }

    // 为指定地址设置公钥
    setAddressPublicKey(address: string, publicKey: string) {
        this.publicKeys.set(address.toLowerCase(), publicKey)
    }

    // 为指定地址设置私钥
    setAddressPrivateKey(address: string, privateKey: string) {
        this.privateKeys.set(address.toLowerCase(), privateKey)
    }

    // 获取地址对应的签名器
    private getSignerForAddress(address: string): any {
        return this.signers.get(address.toLowerCase())
    }

    // 获取地址对应的公钥
    private getPublicKeyForAddress(address: string): string | undefined {
        return this.publicKeys.get(address.toLowerCase())
    }

    // 获取地址对应的私钥
    private getPrivateKeyForAddress(address: string): string | undefined {
        return this.privateKeys.get(address.toLowerCase())
    }

    // 修改 dot 方法，返回增强的 DotMethods
    dot(address: string): DotMethods {
        return {
            get: (key: string) => this.get(`${address}/${key}`),
            put: (key: string, value: any, encrypt: boolean = false) =>
                this.put(`${address}/${key}`, value, encrypt),
            on: (
                key: string,
                callback: (value: any) => void,
                options?: { once?: boolean; decrypt?: boolean },
            ) => this.on(`${address}/${key}`, callback, options),
            once: (key: string, callback: (value: any) => void, decrypt: boolean = false) =>
                this.once(`${address}/${key}`, callback, decrypt),
            off: (key: string, callback?: (value: any) => void) =>
                this.off(`${address}/${key}`, callback),
            // 添加为该地址设置专属签名器的方法
            setSigner: (signer: any) => this.setAddressSigner(address, signer),
            // 添加设置公钥和私钥的方法
            setPubKey: (publicKey: string) => this.setAddressPublicKey(address, publicKey),
            setPrivKey: (privateKey: string) => this.setAddressPrivateKey(address, privateKey),
        }
    }

    private connect(): void {
        try {
            // 使用选择的 WebSocket 实现创建连接
            this.ws = new this.WebSocketImpl(this.url.replace(/^http/, 'ws')) as WebSocketLike

            this.ws.onopen = () => {
                console.log('已连接到服务器')
                this.isConnected = true
                this.flushMessageQueue()
            }

            this.ws.onmessage = (event: MessageEvent) => {
                try {
                    const msg = JSON.parse(event.data) as Message
                    this.handleMessage(msg)
                } catch (err) {
                    console.error('处理消息时出错:', err)
                }
            }

            this.ws.onclose = () => {
                console.log('与服务器断开连接')
                this.isConnected = false
                setTimeout(() => this.connect(), 1000)
            }

            this.ws.onerror = (error: Event) => {
                console.error('WebSocket 错误:', error)
            }
        } catch (err) {
            console.error('连接错误:', err)
        }
    }

    private handleMessage(msg: Message): void {
        switch (msg.type) {
            case 'get_response':
            case 'sync':
                const listeners = this.listeners.get(msg.key)
                if (listeners) {
                    const listenersArray = Array.from(listeners)
                    for (const { callback, once, decrypt } of listenersArray) {
                        let value = msg.value

                        // 如果需要解密数据
                        if (
                            decrypt &&
                            value &&
                            typeof value === 'string' &&
                            value.startsWith('mp://2')
                        ) {
                            try {
                                // 从 key 中提取地址
                                const address = msg.key.split('/')[0]
                                const publicKey = this.getPublicKeyForAddress(address)
                                const privateKey = this.getPrivateKeyForAddress(address)

                                if (publicKey && privateKey) {
                                    const decryptedStr = mostDecode(value, publicKey, privateKey)
                                    if (decryptedStr) {
                                        try {
                                            value = JSON.parse(decryptedStr)
                                        } catch (e) {
                                            value = decryptedStr
                                        }
                                    }
                                }
                            } catch (err) {
                                console.error('解密消息时出错:', err)
                            }
                        }

                        callback(value)
                        if (once) {
                            this.off(msg.key, callback)
                        }
                    }
                }
                break

            case 'ack':
                console.log(`数据已保存，键名: ${msg.key}`)
                break

            case 'error':
                console.error(`错误: ${msg.message}`)
                break
        }
    }

    private sendMessage(message: Message): void {
        if (this.isConnected) {
            try {
                this.ws.send(JSON.stringify(message))
            } catch (err) {
                console.error('发送消息时出错:', err)
                this.messageQueue.push(message)
            }
        } else {
            this.messageQueue.push(message)
        }
    }

    private flushMessageQueue(): void {
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift()
            if (message) {
                this.sendMessage(message)
            }
        }
    }

    get(key: string): Promise<any> {
        return new Promise((resolve, reject) => {
            try {
                // 自动解密的情况下，使用 decrypt 标志
                const address = key.split('/')[0]
                const hasKeys = Boolean(
                    this.getPublicKeyForAddress(address) && this.getPrivateKeyForAddress(address),
                )

                this.once(key, resolve, hasKeys)
                this.sendMessage({
                    type: 'get',
                    key,
                })
            } catch (err) {
                reject(err)
            }
        })
    }

    async put(key: string, value: any, encrypt: boolean = false): Promise<void> {
        // 从 key 中提取地址
        const address = key.split('/')[0]
        // 获取对应地址的 signer
        const signer = this.getSignerForAddress(address)

        if (!signer) {
            throw new Error(`没有为地址 ${address} 设置签名器，无法执行 put 操作`)
        }

        try {
            // 如果需要加密数据
            let finalValue = value
            if (encrypt) {
                const publicKey = this.getPublicKeyForAddress(address)
                const privateKey = this.getPrivateKeyForAddress(address)

                if (!publicKey || !privateKey) {
                    throw new Error(`没有为地址 ${address} 设置公钥或私钥，无法执行加密操作`)
                }

                // 如果值是对象，先序列化
                const valueToEncrypt =
                    typeof value === 'object' ? JSON.stringify(value) : String(value)
                finalValue = mostEncode(valueToEncrypt, publicKey, privateKey)
            }

            // 创建包含完整信息的消息对象
            const timestamp = Date.now()
            const messageObject = {
                key,
                value: finalValue,
                timestamp,
            }

            // 对完整消息进行签名
            const message = JSON.stringify(messageObject)
            const sig = await signer.signMessage(message)

            this.sendMessage({
                type: 'put',
                key,
                value: finalValue,
                sig,
                timestamp, // 添加时间戳到发送的消息中
            })
        } catch (err) {
            throw err
        }
    }

    on(
        key: string,
        callback: (value: any) => void,
        { once = false, decrypt = false }: { once?: boolean; decrypt?: boolean } = {},
    ): DotClient {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, new Set())
        }

        const listeners = this.listeners.get(key)
        if (listeners) {
            listeners.add({ callback, once, decrypt })
        }

        this.sendMessage({
            type: 'get',
            key,
        })

        return this
    }

    once(key: string, callback: (value: any) => void, decrypt: boolean = false): DotClient {
        return this.on(key, callback, { once: true, decrypt })
    }

    off(key: string, callback?: (value: any) => void): DotClient {
        if (!callback) {
            this.listeners.delete(key)
            return this
        }

        const listeners = this.listeners.get(key)
        if (listeners) {
            for (const listener of listeners) {
                if (listener.callback === callback) {
                    listeners.delete(listener)
                    break
                }
            }
            if (listeners.size === 0) {
                this.listeners.delete(key)
            }
        }

        return this
    }
}
