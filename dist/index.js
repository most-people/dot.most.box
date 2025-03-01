(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('ethers'), require('tweetnacl')) :
    typeof define === 'function' && define.amd ? define(['ethers', 'tweetnacl'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.Dot = factory(global.ethers, global.nacl));
})(this, (function (ethers, nacl) { 'use strict';

    /******************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */
    /* global Reflect, Promise, SuppressedError, Symbol, Iterator */


    function __awaiter(thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    }

    typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
        var e = new Error(message);
        return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
    };

    const mostWallet = (username, password, danger) => {
        const isDanger = danger === 'I know loss mnemonic will lose my wallet.';
        const p = ethers.toUtf8Bytes(password);
        const salt = ethers.toUtf8Bytes('/most.box/' + username);
        const kdf = ethers.pbkdf2(p, salt, 3, 32, 'sha512');
        const bytes = ethers.getBytes(ethers.sha256(kdf));
        // x25519 key pair
        const seed = bytes.slice(0, 32);
        const keyPair = nacl.box.keyPair.fromSecretKey(seed);
        const public_key = ethers.hexlify(keyPair.publicKey);
        const private_key = ethers.hexlify(keyPair.secretKey);
        // wallet all in one
        const mnemonic = ethers.Mnemonic.entropyToPhrase(bytes);
        const wallet = ethers.HDNodeWallet.fromPhrase(mnemonic);
        const address = wallet.address;
        const mostWallet = {
            username,
            address,
            public_key,
            private_key,
            mnemonic: isDanger ? mnemonic : '',
        };
        return mostWallet;
    };
    const mostEncode = (text, public_key, private_key) => {
        const bytes = new TextEncoder().encode(text);
        const nonce = nacl.randomBytes(nacl.box.nonceLength);
        const encrypted = nacl.box(bytes, nonce, new Uint8Array(ethers.getBytes(public_key)), new Uint8Array(ethers.getBytes(private_key)));
        if (!encrypted) {
            console.error('加密失败');
            return '';
        }
        return ['mp://2', ethers.encodeBase64(nonce), ethers.encodeBase64(encrypted)].join('.');
    };
    const mostDecode = (data, public_key, private_key) => {
        const [prefix, nonce64, encrypted64] = data.split('.');
        if (prefix !== 'mp://2') {
            console.error('无效的密文');
            return '';
        }
        const decrypted = nacl.box.open(ethers.decodeBase64(encrypted64), ethers.decodeBase64(nonce64), new Uint8Array(ethers.getBytes(public_key)), new Uint8Array(ethers.getBytes(private_key)));
        if (!decrypted) {
            console.error('解密失败');
            return '';
        }
        return new TextDecoder().decode(decrypted);
    };

    class DotClient {
        constructor(urls) {
            this.nodes = [];
            // 使用 Map 存储每个地址对应的签名器
            this.signers = new Map();
            // 使用 Map 存储每个地址对应的公钥和私钥
            this.publicKeys = new Map();
            this.privateKeys = new Map();
            this.listeners = new Map();
            // 根据环境选择 WebSocket 实现
            if (typeof window !== 'undefined' && window.WebSocket) {
                this.WebSocketImpl = window.WebSocket;
            }
            else {
                try {
                    // 动态导入 ws 模块，避免在浏览器环境中报错
                    this.WebSocketImpl = require('ws');
                }
                catch (e) {
                    throw new Error('在 Node.js 环境中需要安装 ws 模块: npm install ws');
                }
            }
            // 初始化所有节点
            for (const url of urls) {
                this.addNode(url);
            }
        }
        // 添加新节点
        addNode(url) {
            const node = {
                url,
                ws: null,
                isConnected: false,
                messageQueue: [],
            };
            this.nodes.push(node);
            this.connectNode(node);
        }
        // 为指定地址设置签名器
        setAddressSigner(address, signer) {
            this.signers.set(address.toLowerCase(), signer);
        }
        // 为指定地址设置公钥
        setAddressPublicKey(address, publicKey) {
            this.publicKeys.set(address.toLowerCase(), publicKey);
        }
        // 为指定地址设置私钥
        setAddressPrivateKey(address, privateKey) {
            this.privateKeys.set(address.toLowerCase(), privateKey);
        }
        // 获取地址对应的签名器
        getSigner(address) {
            return this.signers.get(address.toLowerCase());
        }
        // 获取地址对应的公钥
        getPublicKey(address) {
            return this.publicKeys.get(address.toLowerCase());
        }
        // 获取地址对应的私钥
        getPrivateKey(address) {
            return this.privateKeys.get(address.toLowerCase());
        }
        // 修改 dot 方法，返回增强的 DotMethods
        dot(address) {
            return {
                put: (key, value, encrypt = false) => this.put(`${address}/${key}`, value, encrypt),
                on: (key, callback, options) => this.on(`${address}/${key}`, callback, options),
                once: (key, callback, decrypt = false) => this.once(`${address}/${key}`, callback, decrypt),
                off: (key, callback) => this.off(`${address}/${key}`, callback),
                // 添加为该地址设置专属签名器的方法
                setSigner: (signer) => this.setAddressSigner(address, signer),
                // 添加设置公钥和私钥的方法
                setPubKey: (publicKey) => this.setAddressPublicKey(address, publicKey),
                setPrivKey: (privateKey) => this.setAddressPrivateKey(address, privateKey),
            };
        }
        connectNode(node) {
            try {
                // 使用选择的 WebSocket 实现创建连接
                node.ws = new this.WebSocketImpl(node.url.replace(/^http/, 'ws'));
                node.ws.onopen = () => {
                    console.log(`已连接到节点: ${node.url}`);
                    node.isConnected = true;
                    this.flushNodeMessageQueue(node);
                };
                node.ws.onmessage = (event) => {
                    try {
                        const msg = JSON.parse(event.data);
                        this.handleMessage(msg);
                    }
                    catch (err) {
                        console.error('处理消息时出错:', err);
                    }
                };
                node.ws.onclose = () => {
                    console.log(`与节点断开连接: ${node.url}`);
                    node.isConnected = false;
                    // setTimeout(() => this.connectNode(node), 1000)
                };
                node.ws.onerror = (error) => {
                    console.error(`WebSocket 错误 (${node.url}):`, error);
                };
            }
            catch (err) {
                console.error(`连接错误 (${node.url}):`, err);
            }
        }
        handleMessage(msg) {
            switch (msg.type) {
                case 'get_response':
                case 'sync':
                    const listeners = this.listeners.get(msg.key);
                    if (listeners) {
                        const listenersArray = Array.from(listeners);
                        for (const { callback, once, decrypt } of listenersArray) {
                            let value = msg.value;
                            // 如果需要解密数据
                            if (decrypt &&
                                value &&
                                typeof value === 'string' &&
                                value.startsWith('mp://2')) {
                                try {
                                    // 从 key 中提取地址
                                    const address = msg.key.split('/')[0];
                                    const publicKey = this.getPublicKey(address);
                                    const privateKey = this.getPrivateKey(address);
                                    if (publicKey && privateKey) {
                                        const decryptedStr = mostDecode(value, publicKey, privateKey);
                                        if (decryptedStr) {
                                            try {
                                                value = JSON.parse(decryptedStr);
                                            }
                                            catch (e) {
                                                value = decryptedStr;
                                            }
                                        }
                                    }
                                }
                                catch (err) {
                                    console.error('解密消息时出错:', err);
                                }
                            }
                            callback(value, msg.timestamp || 0);
                            if (once) {
                                this.off(msg.key, callback);
                            }
                        }
                    }
                    break;
                case 'ack':
                    console.log(`数据已保存，键名: ${msg.key}`);
                    break;
                case 'error':
                    console.error(`错误: ${msg.message}`);
                    break;
            }
        }
        sendMessage(message) {
            // 尝试向所有已连接的节点发送消息
            for (const node of this.nodes) {
                if (node.isConnected && node.ws) {
                    try {
                        node.ws.send(JSON.stringify(message));
                    }
                    catch (err) {
                        console.error(`发送消息到节点 ${node.url} 时出错:`, err);
                        node.messageQueue.push(message);
                    }
                }
                else {
                    node.messageQueue.push(message);
                }
            }
        }
        flushNodeMessageQueue(node) {
            while (node.messageQueue.length > 0) {
                const message = node.messageQueue.shift();
                if (message && node.ws && node.isConnected) {
                    try {
                        node.ws.send(JSON.stringify(message));
                    }
                    catch (err) {
                        console.error(`发送排队消息到节点 ${node.url} 时出错:`, err);
                        // 放回队列前面
                        node.messageQueue.unshift(message);
                        break;
                    }
                }
            }
        }
        put(key_1, value_1) {
            return __awaiter(this, arguments, void 0, function* (key, value, encrypt = false) {
                // 从 key 中提取地址
                const address = key.split('/')[0];
                // 获取对应地址的 signer
                const signer = this.getSigner(address);
                if (!signer) {
                    throw new Error(`没有为地址 ${address} 设置签名器，无法执行 put 操作`);
                }
                try {
                    // 如果需要加密数据
                    let finalValue = value;
                    if (encrypt) {
                        const publicKey = this.getPublicKey(address);
                        const privateKey = this.getPrivateKey(address);
                        if (!publicKey || !privateKey) {
                            throw new Error(`没有为地址 ${address} 设置公钥或私钥，无法执行加密操作`);
                        }
                        // 如果值是对象，先序列化
                        const valueToEncrypt = typeof value === 'object' ? JSON.stringify(value) : String(value);
                        finalValue = mostEncode(valueToEncrypt, publicKey, privateKey);
                    }
                    // 创建包含完整信息的消息对象
                    const timestamp = Date.now();
                    const messageObject = {
                        key,
                        value: finalValue,
                        timestamp,
                    };
                    // 对完整消息进行签名
                    const message = JSON.stringify(messageObject);
                    const sig = yield signer.signMessage(message);
                    this.sendMessage({
                        type: 'put',
                        key,
                        value: finalValue,
                        sig,
                        timestamp, // 添加时间戳到发送的消息中
                    });
                }
                catch (err) {
                    throw err;
                }
            });
        }
        on(key, callback, { once = false, decrypt = false } = {}) {
            if (!this.listeners.has(key)) {
                this.listeners.set(key, new Set());
            }
            const listeners = this.listeners.get(key);
            if (listeners) {
                listeners.add({ callback, once, decrypt });
            }
            this.sendMessage({
                type: 'get',
                key,
            });
            return this;
        }
        once(key, callback, decrypt = false) {
            return this.on(key, callback, { once: true, decrypt });
        }
        off(key, callback) {
            if (!callback) {
                this.listeners.delete(key);
                return this;
            }
            const listeners = this.listeners.get(key);
            if (listeners) {
                for (const listener of listeners) {
                    if (listener.callback === callback) {
                        listeners.delete(listener);
                        break;
                    }
                }
                if (listeners.size === 0) {
                    this.listeners.delete(key);
                }
            }
            return this;
        }
    }

    const Dot = {
        DotClient,
        mostWallet,
        mostEncode,
        mostDecode,
    };

    return Dot;

}));
