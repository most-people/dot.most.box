import WebSocket from 'ws'
import fs from 'fs'
import path from 'path'
import { Server } from 'http'
import { isAddress, verifyMessage } from 'ethers'

export interface DotData {
    value: any
    sig: string
    timestamp: number
}

export interface Message {
    type: 'put' | 'get' | 'sync' | 'get_response' | 'ack' | 'error'
    key: string
    value?: any
    sig?: string
    timestamp?: number
    message?: string
}

export class DotServer {
    private peers: Set<WebSocket>
    private data: Map<string, DotData>
    private dataFile: string
    private server: WebSocket.Server
    private hasChanges: boolean = false

    constructor(httpServer: Server) {
        this.peers = new Set()
        this.data = new Map()
        this.dataFile = path.join(process.cwd(), 'dot-data.json')
        this.loadData()

        // 定期保存数据
        setInterval(() => {
            if (this.hasChanges) {
                this.saveData()
                this.hasChanges = false
            }
        }, 60 * 1000)

        this.server = new WebSocket.Server({ server: httpServer })

        this.server.on('connection', (socket: WebSocket) => {
            console.log('dot: 新客户端已连接')
            this.peers.add(socket)

            socket.on('message', (message: WebSocket.Data) => {
                try {
                    const msg = JSON.parse(message.toString()) as Message
                    this.handleMessage(msg, socket)
                } catch (err) {
                    console.error('dot: 处理消息时出错:', err)
                }
            })

            socket.on('close', () => {
                console.log('dot: 客户端断开连接')
                this.peers.delete(socket)
            })

            socket.on('error', (error: Error) => {
                console.error('dot: WebSocket 错误:', error)
            })
        })

        process.on('SIGINT', () => {
            console.log('dot: 正在保存数据并关闭服务器...')
            if (this.hasChanges) {
                this.saveData()
            }
            process.exit(0)
        })
    }

    private checkDotKey(key: string): boolean {
        const parts = key.split('/')
        if (parts.length < 2) return false
        const address = parts[0]
        return isAddress(address.toLowerCase())
    }

    private handleMessage(msg: Message, sender: WebSocket): void {
        switch (msg.type) {
            case 'put':
                try {
                    if (msg.key && msg.value !== undefined && msg.sig && msg.timestamp) {
                        if (this.checkDotKey(msg.key)) {
                            const success = this.putData(msg.key, msg.value, msg.sig, msg.timestamp)

                            if (success) {
                                // 发送确认消息给发送者
                                sender.send(
                                    JSON.stringify({
                                        type: 'ack',
                                        key: msg.key,
                                    } as Message),
                                )

                                // 广播同步消息给所有客户端
                                this.broadcast(
                                    {
                                        type: 'sync',
                                        key: msg.key,
                                        value: msg.value,
                                        sig: msg.sig,
                                        timestamp: msg.timestamp,
                                    },
                                    null,
                                )
                            } else {
                                sender.send(
                                    JSON.stringify({
                                        type: 'error',
                                        message: '签名验证失败',
                                    } as Message),
                                )
                            }
                        } else {
                            sender.send(
                                JSON.stringify({
                                    type: 'error',
                                    message: '无效的用户数据格式',
                                } as Message),
                            )
                        }
                    }
                } catch (err) {
                    console.error('dot: put 操作出错:', err)
                    sender.send(
                        JSON.stringify({
                            type: 'error',
                            message: '数据保存失败',
                        } as Message),
                    )
                }
                break

            case 'get':
                try {
                    if (msg.key) {
                        const value = this.getData(msg.key)
                        sender.send(
                            JSON.stringify({
                                type: 'get_response',
                                key: msg.key,
                                value,
                            } as Message),
                        )
                    }
                } catch (err) {
                    console.error('dot: get 操作出错:', err)
                    sender.send(
                        JSON.stringify({
                            type: 'error',
                            message: '获取数据失败',
                        } as Message),
                    )
                }
                break

            case 'sync':
                try {
                    if (msg.key && msg.value !== undefined && msg.sig && msg.timestamp) {
                        const currentData = this.data.get(msg.key)
                        if (!currentData || currentData.timestamp < msg.timestamp) {
                            const success = this.putData(msg.key, msg.value, msg.sig, msg.timestamp)
                            if (success) {
                                this.broadcast(msg, sender)
                            }
                        }
                    }
                } catch (err) {
                    console.error('dot: sync 操作出错:', err)
                }
                break
        }
    }

    private putData(key: string, value: any, sig: string, timestamp: number): boolean {
        try {
            // 获取地址(key的第一部分)
            const address = key.split('/')[0]

            // 重建完整的消息对象
            const messageObject = {
                key,
                value,
                timestamp,
            }

            // 将完整消息对象转换为 JSON 字符串
            const message = JSON.stringify(messageObject)

            // 验证签名
            const recoveredAddress = verifyMessage(message, sig)

            // 检查恢复的地址是否匹配 key 中的地址
            if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
                console.error('dot: 签名验证失败 - 地址不匹配')
                return false
            }

            // 验证时间戳
            const currentTime = Date.now()
            if (Math.abs(currentTime - timestamp) > 5 * 60 * 1000) {
                // 5分钟有效期
                console.error('dot: 签名验证失败 - 时间戳过期')
                return false
            }

            // 存储数据
            const entry: DotData = {
                value,
                sig,
                timestamp,
            }
            this.data.set(key, entry)
            this.hasChanges = true
            // this.saveData()
            return true
        } catch (err) {
            console.error('dot: 签名验证失败:', err)
            return false
        }
    }

    private getData(key: string): any | null {
        const entry = this.data.get(key)
        return entry ? entry.value : null
    }

    private saveData(): void {
        try {
            const data: Record<string, DotData> = {}
            for (const [key, entry] of this.data.entries()) {
                data[key] = entry
            }
            fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2))
            console.log('dot: 用户数据已保存到文件')
        } catch (err) {
            console.error('dot: 保存数据出错:', err)
            this.hasChanges = true
        }
    }

    private loadData(): void {
        try {
            if (fs.existsSync(this.dataFile)) {
                const fileData = fs.readFileSync(this.dataFile, 'utf8')
                const data = JSON.parse(fileData) as Record<string, DotData>
                for (const [key, entry] of Object.entries(data)) {
                    if (this.checkDotKey(key)) {
                        this.data.set(key, entry)
                    }
                }
                console.log('dot: 已从文件加载用户数据')
            }
        } catch (err) {
            console.error('dot: 加载数据出错:', err)
        }
    }

    private broadcast(message: Message, exclude: WebSocket | null): void {
        const msg = JSON.stringify(message)
        this.peers.forEach((peer) => {
            if ((!exclude || peer !== exclude) && peer.readyState === WebSocket.OPEN) {
                try {
                    peer.send(msg)
                } catch (err) {
                    console.error('dot: 广播消息出错:', err)
                }
            }
        })
    }
}
