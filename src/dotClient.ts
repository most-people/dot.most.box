// 为了确保在浏览器环境中可以正常使用，保留 IIFE 包装
// ;(function (global) {

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
}

// 定义消息接口
interface Message {
    type: 'put' | 'get' | 'get_response' | 'sync' | 'ack' | 'error'
    key: string
    value?: any
    sig?: string
    timestamp?: number // 添加时间戳字段
    message?: string
}

// 定义 DotClient 的方法接口
interface DotMethods {
    get: (key: string) => Promise<any>
    put: (key: string, value: any) => Promise<void>
    on: (key: string, callback: (value: any) => void, options?: { once?: boolean }) => DotClient
    once: (key: string, callback: (value: any) => void) => DotClient
    off: (key: string, callback?: (value: any) => void) => DotClient
}

export class DotClient {
    private url: string
    private ws!: WebSocketLike
    private listeners: Map<string, Set<Listener>>
    private messageQueue: Message[]
    private isConnected: boolean
    private WebSocketImpl: typeof WebSocket
    private signer: any | null = null

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

    // 设置签名器
    setSigner(signer: any) {
        this.signer = signer
    }

    // 简化的用户方法，不做地址校验
    dot(address: string): DotMethods {
        return {
            get: (key: string) => this.get(`${address}/${key}`),
            put: (key: string, value: any) => this.put(`${address}/${key}`, value),
            on: (key: string, callback: (value: any) => void, options?: { once?: boolean }) =>
                this.on(`${address}/${key}`, callback, options),
            once: (key: string, callback: (value: any) => void) =>
                this.once(`${address}/${key}`, callback),
            off: (key: string, callback?: (value: any) => void) =>
                this.off(`${address}/${key}`, callback),
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
                    listeners.forEach(({ callback, once }) => {
                        if (
                            (msg.type === 'get_response' && once) ||
                            (msg.type === 'sync' && !once)
                        ) {
                            callback(msg.value)
                            if (once) {
                                this.off(msg.key, callback)
                            }
                        }
                    })
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
                this.once(key, resolve)
                this.sendMessage({
                    type: 'get',
                    key,
                })
            } catch (err) {
                reject(err)
            }
        })
    }

    async put(key: string, value: any): Promise<void> {
        if (!this.signer) {
            throw new Error('需要设置签名器才能执行 put 操作')
        }

        try {
            // 创建包含完整信息的消息对象
            const timestamp = Date.now()
            const messageObject = {
                key,
                value,
                timestamp,
            }

            // 对完整消息进行签名
            const message = JSON.stringify(messageObject)
            const sig = await this.signer.signMessage(message)

            this.sendMessage({
                type: 'put',
                key,
                value,
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
        { once = false }: { once?: boolean } = {},
    ): DotClient {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, new Set())
        }

        const listeners = this.listeners.get(key)
        if (listeners) {
            listeners.add({ callback, once })
        }

        this.sendMessage({
            type: 'get',
            key,
        })

        return this
    }

    once(key: string, callback: (value: any) => void): DotClient {
        return this.on(key, callback, { once: true })
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

// 检查环境并导出
if (typeof global !== 'undefined') {
    ;(global as any).DotClient = DotClient
}

// 兼容 CommonJS 和 ES Module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DotClient
}

// })(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this)
