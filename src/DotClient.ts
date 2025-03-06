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
    callback: (value: any, timestamp: number) => void
    decrypt: boolean // 是否解密的标志
}

// 定义节点接口
interface Node {
    url: string
    ws: WebSocketLike | null
    isConnected: boolean
    messageQueue: Message[]
}

// 定义 DotClient 的方法接口
export interface DotMethods {
    put: (key: string, value: any, encrypt?: boolean) => Promise<void>
    on: (
        key: string,
        callback: (value: any, timestamp: number) => void,
        options?: { decrypt?: boolean },
    ) => DotClient
    off: (key: string, callback?: (value: any) => void) => DotClient
    setSigner: (signer: any) => void // 设置签名器
    setPubKey: (publicKey: string) => void // 设置公钥
    setPrivKey: (privateKey: string) => void // 设置私钥
}

export class DotClient {
    private nodes: Node[] = []
    private listeners: Map<string, Set<Listener>>
    private WebSocketImpl: typeof WebSocket
    // 使用 Map 存储每个地址对应的签名器
    private signers: Map<string, any> = new Map()
    // 使用 Map 存储每个地址对应的公钥和私钥
    private publicKeys: Map<string, string> = new Map()
    private privateKeys: Map<string, string> = new Map()

    constructor(urls: string[]) {
        this.listeners = new Map()

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

        // 初始化所有节点
        for (const url of urls) {
            this.addNode(url)
        }
    }

    // 添加新节点
    public addNode(url: string): void {
        const node: Node = {
            url,
            ws: null,
            isConnected: false,
            messageQueue: [],
        }
        this.nodes.push(node)
        this.connectNode(node)
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
    private getSigner(address: string): any {
        return this.signers.get(address.toLowerCase())
    }

    // 获取地址对应的公钥
    private getPublicKey(address: string): string | undefined {
        return this.publicKeys.get(address.toLowerCase())
    }

    // 获取地址对应的私钥
    private getPrivateKey(address: string): string | undefined {
        return this.privateKeys.get(address.toLowerCase())
    }

    // 修改 dot 方法，返回增强的 DotMethods
    dot(address: string): DotMethods {
        return {
            put: (key: string, value: any, encrypt: boolean = false) =>
                this.put(`${address}/${key}`, value, encrypt),
            on: (
                key: string,
                callback: (value: any, timestamp: number) => void,
                options?: { decrypt?: boolean },
            ) => this.on(`${address}/${key}`, callback, options),
            off: (key: string, callback?: (value: any, timestamp: number) => void) =>
                this.off(`${address}/${key}`, callback),
            // 添加为该地址设置专属签名器的方法
            setSigner: (signer: any) => this.setAddressSigner(address, signer),
            // 添加设置公钥和私钥的方法
            setPubKey: (publicKey: string) => this.setAddressPublicKey(address, publicKey),
            setPrivKey: (privateKey: string) => this.setAddressPrivateKey(address, privateKey),
        }
    }

    private connectNode(node: Node): void {
        try {
            // 使用选择的 WebSocket 实现创建连接
            node.ws = new this.WebSocketImpl(node.url.replace(/^http/, 'ws')) as WebSocketLike

            node.ws.onopen = () => {
                console.log(`已连接到节点: ${node.url}`)
                node.isConnected = true
                this.flushNodeMessageQueue(node)
            }

            node.ws.onmessage = (event: MessageEvent) => {
                try {
                    const msg = JSON.parse(event.data) as Message
                    this.handleMessage(msg)
                } catch (err) {
                    console.error('处理消息时出错:', err)
                }
            }

            node.ws.onclose = () => {
                console.log(`与节点断开连接: ${node.url}`)
                node.isConnected = false
                // 在5秒后尝试重新连接
                // setTimeout(() => this.connectNode(node), 5000)
            }

            node.ws.onerror = (error: Event) => {
                console.error(`WebSocket 错误 (${node.url}):`, error)
            }
        } catch (err) {
            console.error(`连接错误 (${node.url}):`, err)
        }
    }

    private handleMessage(msg: Message): void {
        switch (msg.type) {
            case 'get_response':
            case 'sync':
                const listeners = this.listeners.get(msg.key)
                if (listeners) {
                    for (const listener of listeners) {
                        let value = msg.value

                        // 如果需要解密数据
                        if (
                            listener.decrypt &&
                            value &&
                            typeof value === 'string' &&
                            value.startsWith('mp://2')
                        ) {
                            try {
                                // 从 key 中提取地址
                                const address = msg.key.split('/')[0]
                                const publicKey = this.getPublicKey(address)
                                const privateKey = this.getPrivateKey(address)

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

                        // 调用回调，传递解密后的值和时间戳
                        listener.callback(value, msg.timestamp || 0)
                    }
                }
                break
            case 'error':
                console.error(`错误: ${msg.message}`)
                break
        }
    }

    private sendMessage(message: Message): void {
        // 尝试向所有已连接的节点发送消息
        for (const node of this.nodes) {
            if (node.isConnected && node.ws) {
                try {
                    node.ws.send(JSON.stringify(message))
                } catch (err) {
                    console.error(`发送消息到节点 ${node.url} 时出错:`, err)
                    node.messageQueue.push(message)
                }
            } else {
                node.messageQueue.push(message)
            }
        }
    }

    private flushNodeMessageQueue(node: Node): void {
        while (node.messageQueue.length > 0) {
            const message = node.messageQueue.shift()
            if (message && node.ws && node.isConnected) {
                try {
                    node.ws.send(JSON.stringify(message))
                } catch (err) {
                    console.error(`发送排队消息到节点 ${node.url} 时出错:`, err)
                    // 放回队列前面
                    node.messageQueue.unshift(message)
                    break
                }
            }
        }
    }

    async put(key: string, value: any, encrypt: boolean = false): Promise<void> {
        // 从 key 中提取地址
        const address = key.split('/')[0]
        // 获取对应地址的 signer
        const signer = this.getSigner(address)

        if (!signer) {
            throw new Error(`没有为地址 ${address} 设置签名器，无法执行 put 操作`)
        }
        try {
            // 如果需要加密数据
            let finalValue = value
            if (encrypt) {
                const publicKey = this.getPublicKey(address)
                const privateKey = this.getPrivateKey(address)

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
        callback: (value: any, timestamp: number) => void,
        { decrypt = false }: { decrypt?: boolean } = {},
    ): DotClient {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, new Set())
        }

        const listeners = this.listeners.get(key)
        if (listeners) {
            listeners.add({ callback, decrypt })
        }

        // 发送 get 请求获取数据，同时在服务器端自动完成订阅
        this.sendMessage({
            type: 'get',
            key,
        })

        return this
    }

    off(key: string, callback?: (value: any, timestamp: number) => void): DotClient {
        if (!callback) {
            this.listeners.delete(key)

            // 取消订阅该键
            this.sendMessage({
                type: 'unsubscribe',
                key,
            })

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

                // 取消订阅该键
                this.sendMessage({
                    type: 'unsubscribe',
                    key,
                })
            }
        }

        return this
    }
}
