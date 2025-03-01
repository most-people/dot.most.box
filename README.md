# dot.most.box

基于去中心化节点的实时数据同步工具

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.2.2-green.svg)](https://github.com/most-people/dot.most.box/releases)
[![GitHub stars](https://img.shields.io/github/stars/most-people/dot.most.box.svg?style=social&label=Stars)](https://github.com/most-people/dot.most.box)
[![GitHub forks](https://img.shields.io/github/forks/most-people/dot.most.box.svg?style=social&label=Fork)](https://github.com/most-people/dot.most.box)

## 什么是 dot.most.box?

dot.most.box 是一个实时数据同步工具，它让用户可以在多个设备之间实时同步数据，而无需依赖中心化服务器。每个用户都可以搭建自己的节点，形成一个强大的去中心化网络。

想象一下每个人都有无数张画板，当你每画一笔，别人的画板上会立刻出现这一笔。你可以：

-   与朋友约定好用哪张画板，就可以一起聊天
-   创建只有你能编辑、别人只能查看的画板
-   无需中央服务器，实现真正的点对点通信

## 特性

-   🔐 **加密通信**：基于公钥/私钥加密的安全通信
-   🔄 **实时同步**：数据变更实时推送到所有连接的客户端
-   🌐 **去中心化**：每个用户都可以成为节点，不依赖中央服务器
-   📱 **平台支持**：浏览器、Node.js、React Native 环境均可使用
-   💼 **钱包集成**：支持以太坊钱包认证和签名

## 在线演示

https://most.box#dot.most.box

## 安装

### NPM 安装

```bash
npm install dot.most.box
```

## 快速开始

## 服务端 Http | Express | Nest.js | Koa2 | Fastify...

```js
import DotServer from 'dot.most.box/server'
import http from 'http'

const server = http.createServer()
new DotServer(server)
server.listen(1976, () => console.log('Server running on port 1976'))
```

[其他后端框架示例](SERVER.md)

## 客户端 React | Vue | React Native...

```js
import Dot from 'dot.most.box'

const { DotClient } = Dot
const dotClient = new DotClient(['http://localhost:1976'])
```

## 浏览器直接引入

您也可以通过 CDN 或者直接在 HTML 中引入脚本文件的方式使用:

```html
<!-- 依赖库 -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/ethers/6.13.5/ethers.umd.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/tweetnacl/1.0.2/nacl-fast.min.js"></script>

<!-- 通过 CDN 引入 -->
<script src="https://cdn.jsdelivr.net/npm/dot.most.box@latest/dist/index.js"></script>

<script>
    // 全局变量 Dot 可用
    const { DotClient, mostWallet } = Dot
</script>
```

## 认证与加密

dot.most.box 提供两种用户认证方式：

### 1. 账号密码认证

```js
// 初始化钱包
const wallet = Dot.mostWallet('username', 'password', 'I know loss mnemonic will lose my wallet.')
const address = wallet.address

// 设置签名器
const signer = ethers.HDNodeWallet.fromPhrase(wallet.mnemonic)
dot.setSigner(signer)

// 设置加密所需的密钥
const dot = client.dot(address)
dot.setPubKey(wallet.public_key)
dot.setPrivKey(wallet.private_key)
```

### 2. 钱包插件认证

```js
// 连接以太坊钱包
const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
const provider = new ethers.BrowserProvider(window.ethereum)
const signer = await provider.getSigner()
const address = await signer.getAddress()
const sig = await signer.signMessage(address)
const wallet = Dot.mostWallet(address, sig)

// 设置签名器
dot.setSigner(signer)

// 设置加密所需的密钥
const dot = client.dot(address)
dot.setPubKey(wallet.public_key)
dot.setPrivKey(wallet.private_key)
```

## 数据读写

### 写入数据

```js
// 普通存储
dot.put('profile', {
    name: 'Alice',
    bio: 'Web3 Developer',
})

// 加密存储
dot.put(
    'profile',
    {
        name: 'Alice',
        bio: 'Web3 Developer',
        email: 'alice@example.com',
    },
    true,
) // 第三个参数 true 表示加密存储
```

### 读取数据

```js
// 监听用户数据变化
dot.on('profile', (profile, timestamp) => {
    console.log('收到数据:', profile)
    console.log('数据时间戳:', timestamp)
})

// 自动解密监听
dot.on(
    'profile',
    (profile, timestamp) => {
        console.log('解密后数据:', profile)
    },
    { decrypt: true },
) // 使用 decrypt 选项自动解密

// 只获取一次数据
dot.once('profile', (profile) => {
    console.log('收到一次性数据:', profile)
})
```

## 完整的去中心化应用架构

dot.most.box 是构建完全去中心化应用的关键组件。一个完整的去中心化应用架构可以包括：

-   **用户身份**：加密钱包（如 MetaMask, OKX 钱包等）
-   **域名**：去中心化域名（.box）
-   **前端**：IPFS（通过 Fleek 等服务部署）
-   **数据存储**：dot.most.box
-   **紧急恢复**：以太坊智能合约

## 部署自己的节点

通过启动 dot.most.box 节点，您可以为去中心化网络做出贡献：

```bash
# 克隆仓库
git clone https://github.com/most-people/dot.most.box.git

# 安装依赖
cd dot.most.box
npm install

# 启动节点
npm start
```

默认情况下，节点将在端口 1976 上运行。您可以通过参数更改端口：

```bash
node server.mjs --port=3000
```

## 贡献

欢迎参与项目贡献！您可以通过以下方式参与：

-   在 GitHub 上[提交问题或建议](https://github.com/most-people/dot.most.box/issues/new)
-   直接提交代码改进
-   帮助完善文档

我们欢迎任何形式的贡献和反馈！

### 问题反馈

如果您遇到任何问题或有改进建议，请[创建 Issue](https://github.com/most-people/dot.most.box/issues/new)。

## 许可证

[MIT](LICENSE) © dot.most.box

---

项目地址: [https://github.com/most-people/dot.most.box](https://github.com/most-people/dot.most.box)

研发团队: [most.box](https://most.box)
