'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var os = require('os');
var fs = require('fs');
var path = require('path');
var WebSocket = require('ws');
var ethers = require('ethers');

class DotServer {
    constructor(httpServer) {
        this.hasChanges = false;
        // 跟踪客户端订阅
        this.subscriptions = new Map();
        this.peers = new Set();
        this.data = new Map();
        this.dataFile = path.join(os.homedir(), 'dot-data.json'); // 文件目录 ~/dot-data.json
        this.loadData();
        // 定期保存数据
        setInterval(() => {
            if (this.hasChanges) {
                this.saveData();
                this.hasChanges = false;
            }
        }, 60 * 1000);
        this.server = new WebSocket.Server({ server: httpServer });
        this.server.on('connection', (socket) => {
            console.log('dot: 新客户端已连接');
            this.peers.add(socket);
            // 初始化该客户端的订阅集合
            this.subscriptions.set(socket, new Set());
            socket.on('message', (message) => {
                try {
                    const msg = JSON.parse(message.toString());
                    this.handleMessage(msg, socket);
                }
                catch (err) {
                    console.error('dot: 处理消息时出错:', err);
                }
            });
            socket.on('close', () => {
                console.log('dot: 客户端断开连接');
                this.peers.delete(socket);
                // 移除该客户端的订阅信息
                this.subscriptions.delete(socket);
            });
            socket.on('error', (error) => {
                console.error('dot: WebSocket 错误:', error);
            });
        });
        process.on('SIGINT', () => {
            console.log('dot: 正在保存数据并关闭服务器...');
            if (this.hasChanges) {
                this.saveData();
            }
            process.exit(0);
        });
    }
    checkDotKey(key) {
        const parts = key.split('/');
        if (parts.length < 2)
            return false;
        const address = parts[0];
        return ethers.isAddress(address.toLowerCase());
    }
    handleMessage(msg, sender) {
        switch (msg.type) {
            case 'put':
                try {
                    if (msg.key && msg.value !== undefined && msg.sig && msg.timestamp) {
                        if (this.checkDotKey(msg.key)) {
                            const success = this.putData(msg.key, msg.value, msg.sig, msg.timestamp);
                            if (success) {
                                // 广播同步消息给订阅了这个键的客户端
                                this.broadcast({
                                    type: 'sync',
                                    key: msg.key,
                                    value: msg.value,
                                    sig: msg.sig,
                                    timestamp: msg.timestamp,
                                }, sender);
                            }
                            else {
                                sender.send(JSON.stringify({
                                    type: 'error',
                                    message: '签名验证失败',
                                }));
                            }
                        }
                        else {
                            sender.send(JSON.stringify({
                                type: 'error',
                                message: '无效的用户数据格式',
                            }));
                        }
                    }
                }
                catch (err) {
                    console.error('dot: put 操作出错:', err);
                    sender.send(JSON.stringify({
                        type: 'error',
                        message: '数据保存失败',
                    }));
                }
                break;
            case 'get':
                try {
                    if (msg.key) {
                        // 当客户端请求数据时，自动订阅该键
                        const subs = this.subscriptions.get(sender);
                        if (subs) {
                            subs.add(msg.key);
                            console.log(`dot: 客户端订阅了 ${msg.key}`);
                        }
                        const data = this.data.get(msg.key);
                        sender.send(JSON.stringify({
                            type: 'get_response',
                            key: msg.key,
                            value: (data === null || data === void 0 ? void 0 : data.value) || null,
                            timestamp: (data === null || data === void 0 ? void 0 : data.timestamp) || null,
                        }));
                    }
                }
                catch (err) {
                    console.error('dot: get 操作出错:', err);
                    sender.send(JSON.stringify({
                        type: 'error',
                        message: '获取数据失败',
                    }));
                }
                break;
            case 'sync':
                try {
                    if (msg.key && msg.value !== undefined && msg.sig && msg.timestamp) {
                        const currentData = this.data.get(msg.key);
                        if (!currentData || currentData.timestamp < msg.timestamp) {
                            const success = this.putData(msg.key, msg.value, msg.sig, msg.timestamp);
                            if (success) {
                                this.broadcast(msg, sender);
                            }
                        }
                    }
                }
                catch (err) {
                    console.error('dot: sync 操作出错:', err);
                }
                break;
            case 'notify':
                try {
                    if (msg.key && msg.value && msg.sig && msg.timestamp && msg.sender) {
                        // 检查通知内容长度
                        const value = typeof msg.value === 'string' ? msg.value : JSON.stringify(msg.value);
                        if (value.length > 500) {
                            sender.send(JSON.stringify({
                                type: 'error',
                                message: '通知内容过长，最大长度为500个字符',
                            }));
                            break;
                        }
                        // 构建通知路径：接收者地址/notify
                        const receiverAddress = msg.key.split('/')[0];
                        // 验证接收者地址是否为有效的ETH地址
                        if (!ethers.isAddress(receiverAddress)) {
                            sender.send(JSON.stringify({
                                type: 'error',
                                message: '接收者地址不是有效的以太坊地址',
                            }));
                            break;
                        }
                        const notificationKey = `${receiverAddress}/notify`;
                        // 验证签名
                        const messageObject = {
                            to: receiverAddress,
                            value: msg.value,
                            timestamp: msg.timestamp,
                            sender: msg.sender,
                        };
                        const message = JSON.stringify(messageObject);
                        const recoveredAddress = ethers.verifyMessage(message, msg.sig);
                        if (recoveredAddress !== msg.sender) {
                            sender.send(JSON.stringify({
                                type: 'error',
                                message: '签名验证失败',
                            }));
                            break;
                        }
                        // 获取现有通知对象或创建新对象
                        const existingData = this.data.get(notificationKey);
                        let notifications = {};
                        if (existingData &&
                            typeof existingData.value === 'object' &&
                            existingData.value !== null) {
                            notifications = existingData.value;
                        }
                        // 更新通知
                        notifications[msg.sender] = {
                            value: msg.value,
                            timestamp: msg.timestamp,
                            sig: msg.sig,
                        };
                        // 存储更新后的通知对象
                        const notificationData = {
                            value: notifications,
                            sig: '',
                            timestamp: Date.now(),
                        };
                        this.data.set(notificationKey, notificationData);
                        this.hasChanges = true;
                        // 广播给订阅者
                        this.broadcast({
                            type: 'sync',
                            key: notificationKey,
                            value: notificationData.value,
                            timestamp: msg.timestamp,
                        }, sender);
                    }
                }
                catch (err) {
                    console.error('dot: 处理通知出错:', err);
                    sender.send(JSON.stringify({
                        type: 'error',
                        message: '通知发送失败',
                    }));
                }
                break;
            case 'off':
                if (msg.key) {
                    const subs = this.subscriptions.get(sender);
                    if (subs) {
                        subs.delete(msg.key);
                        console.log(`dot: 客户端取消订阅了 ${msg.key}`);
                    }
                }
                break;
        }
    }
    putData(key, value, sig, timestamp) {
        try {
            // 获取地址(key的第一部分)
            const address = key.split('/')[0];
            // 重建完整的消息对象
            const messageObject = {
                key,
                value,
                timestamp,
            };
            // 将完整消息对象转换为 JSON 字符串
            const message = JSON.stringify(messageObject);
            // 验证签名
            const recoveredAddress = ethers.verifyMessage(message, sig);
            // 检查恢复的地址是否匹配 key 中的地址
            if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
                console.error('dot: 签名验证失败 - 地址不匹配');
                return false;
            }
            // 验证时间戳
            const currentTime = Date.now();
            if (Math.abs(currentTime - timestamp) > 5 * 60 * 1000) {
                // 5分钟有效期
                console.error('dot: 签名验证失败 - 时间戳过期');
                return false;
            }
            // 存储数据
            const entry = {
                value,
                sig,
                timestamp,
            };
            this.data.set(key, entry);
            this.hasChanges = true;
            return true;
        }
        catch (err) {
            console.error('dot: 签名验证失败:', err);
            return false;
        }
    }
    saveData() {
        try {
            const data = {};
            for (const [key, entry] of this.data.entries()) {
                data[key] = entry;
            }
            fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2));
            console.log('dot: 用户数据已保存到文件');
        }
        catch (err) {
            console.error('dot: 保存数据出错:', err);
            this.hasChanges = true;
        }
    }
    loadData() {
        try {
            if (fs.existsSync(this.dataFile)) {
                const fileData = fs.readFileSync(this.dataFile, 'utf8');
                const data = JSON.parse(fileData);
                for (const [key, entry] of Object.entries(data)) {
                    if (this.checkDotKey(key)) {
                        this.data.set(key, entry);
                    }
                }
                console.log('dot: 已从文件加载用户数据');
            }
        }
        catch (err) {
            console.error('dot: 加载数据出错:', err);
        }
    }
    // 修改广播方法，只向订阅了指定键的客户端发送消息
    broadcast(message, exclude) {
        if (!message.key)
            return;
        const msg = JSON.stringify(message);
        this.peers.forEach((peer) => {
            if (peer !== exclude && peer.readyState === WebSocket.OPEN) {
                // 检查该客户端是否订阅了这个键
                const subs = this.subscriptions.get(peer);
                if (subs && subs.has(message.key)) {
                    try {
                        peer.send(msg);
                    }
                    catch (err) {
                        console.error('dot: 广播消息出错:', err);
                    }
                }
            }
        });
    }
}

exports.DotServer = DotServer;
exports.default = DotServer;
