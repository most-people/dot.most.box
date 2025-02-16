import WebSocket from 'ws'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { Server } from 'http'
import { ethers } from 'ethers'

interface DataEntry {
    value: any
    hash: string
    timestamp: number
}

interface Message {
    type: 'put' | 'get' | 'sync' | 'get_response' | 'ack' | 'error'
    key?: string
    value?: any
    hash?: string
    message?: string
}

export class DotServer {
    private peers: Set<WebSocket>
    private data: Map<string, DataEntry>
    private dataFile: string
    private server: WebSocket.Server
    private hasChanges: boolean = false

    constructor(httpServer: Server) {
        this.peers = new Set()
        this.data = new Map()
        this.dataFile = path.join(__dirname, 'dot-data.json')
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
            console.log('dot.js: 新客户端已连接')
            this.peers.add(socket)

            socket.on('message', (message: WebSocket.Data) => {
                try {
                    const msg = JSON.parse(message.toString()) as Message
                    this.handleMessage(msg, socket)
                } catch (err) {
                    console.error('dot.js: 处理消息时出错:', err)
                }
            })

            socket.on('close', () => {
                console.log('dot.js: 客户端断开连接')
                this.peers.delete(socket)
            })

            socket.on('error', (error: Error) => {
                console.error('dot.js: WebSocket 错误:', error)
            })
        })

        process.on('SIGINT', () => {
            console.log('dot.js: 正在保存数据并关闭服务器...')
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
        return ethers.isAddress(address)
    }

    private handleMessage(msg: Message, sender: WebSocket): void {
        switch (msg.type) {
            case 'put':
                try {
                    if (msg.key && msg.value !== undefined) {
                        if (this.checkDotKey(msg.key)) {
                            const hash = this.putData(msg.key, msg.value)

                            // 发送确认消息给发送者
                            sender.send(
                                JSON.stringify({
                                    type: 'ack',
                                    key: msg.key,
                                    hash,
                                } as Message),
                            )

                            // 广播同步消息给所有客户端
                            this.broadcast(
                                {
                                    type: 'sync',
                                    key: msg.key,
                                    value: msg.value,
                                    hash,
                                },
                                null,
                            )
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
                    console.error('dot.js: put 操作出错:', err)
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
                    console.error('dot.js: get 操作出错:', err)
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
                    if (msg.key && msg.value !== undefined && msg.hash) {
                        const currentData = this.data.get(msg.key)
                        if (!currentData || currentData.hash !== msg.hash) {
                            this.putData(msg.key, msg.value)
                            this.broadcast(msg, sender)
                        }
                    }
                } catch (err) {
                    console.error('dot.js: sync 操作出错:', err)
                }
                break
        }
    }

    private putData(key: string, value: any): string {
        const hash = crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
        const entry = { value, hash, timestamp: Date.now() }
        this.data.set(key, entry)
        this.hasChanges = true
        this.saveData()
        return hash
    }

    private getData(key: string): any | null {
        const entry = this.data.get(key)
        return entry ? entry.value : null
    }

    private saveData(): void {
        try {
            const data: Record<string, DataEntry> = {}
            for (const [key, entry] of this.data.entries()) {
                data[key] = entry
            }
            fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2))
            console.log('dot.js: 用户数据已保存到文件')
        } catch (err) {
            console.error('dot.js: 保存数据出错:', err)
            this.hasChanges = true
        }
    }

    private loadData(): void {
        try {
            if (fs.existsSync(this.dataFile)) {
                const fileData = fs.readFileSync(this.dataFile, 'utf8')
                const data = JSON.parse(fileData) as Record<string, DataEntry>
                for (const [key, entry] of Object.entries(data)) {
                    if (this.checkDotKey(key)) {
                        this.data.set(key, entry)
                    }
                }
                console.log('dot.js: 已从文件加载用户数据')
            }
        } catch (err) {
            console.error('dot.js: 加载数据出错:', err)
        }
    }

    private broadcast(message: Message, exclude: WebSocket | null): void {
        const msg = JSON.stringify(message)
        this.peers.forEach((peer) => {
            if ((!exclude || peer !== exclude) && peer.readyState === WebSocket.OPEN) {
                try {
                    peer.send(msg)
                } catch (err) {
                    console.error('dot.js: 广播消息出错:', err)
                }
            }
        })
    }
}
