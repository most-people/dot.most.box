# dot.most.box

基于去中心化节点的实时数据同步工具

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.3.0-green.svg)](https://github.com/most-people/dot.most.box/releases)
[![GitHub stars](https://img.shields.io/github/stars/most-people/dot.most.box.svg?style=social&label=Stars)](https://github.com/most-people/dot.most.box)
[![GitHub forks](https://img.shields.io/github/forks/most-people/dot.most.box.svg?style=social&label=Fork)](https://github.com/most-people/dot.most.box)

## 在线演示

体验在线演示：[https://most.box#dot.most.box](https://most.box#dot.most.box)

## 核心特性

-   🔐 **安全加密**：基于公钥/私钥的端到端加密通信
-   🔄 **实时同步**：数据变更自动推送到所有连接的客户端
-   🌐 **去中心化**：每个用户都可以成为节点，不依赖中央服务器
-   📱 **平台支持**：兼容浏览器、Node.js、React Native 等环境
-   💼 **钱包集成**：支持以太坊钱包认证和签名

## 快速开始

### 安装

```bash
npm install dot.most.box
```

### 客户端使用

```js
import Dot from 'dot.most.box'

const { DotClient } = Dot
const dotClient = new DotClient(['http://localhost:1976'])
```

### 浏览器直接引入

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

## 用户认证

dot.most.box 提供两种用户认证方式：

### 1. 账号密码认证

适合普通用户，无需安装钱包插件：

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

### 2. 以太坊钱包认证

适合 Web3 用户，支持 MetaMask 等钱包：

```js
// 连接 MetaMask
const provider = new ethers.BrowserProvider(window.ethereum)
const signer = await provider.getSigner()
const address = await signer.getAddress()

// 设置签名器
dot.setSigner(signer)

// 使用当前地址
const dot = client.dot(address)
```

## 数据操作

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
})

// 自动解密监听
dot.on(
    'profile',
    (profile, timestamp) => {
        console.log('解密后数据:', profile)
    },
    { decrypt: true },
) // 使用 decrypt 选项自动解密

// 监听用户数据变化（多节点） ——写入时，会自动更新所有节点
let t = 0
dot.on('profile', (profile, timestamp) => {
    // 只获取最新的数据
    if (timestamp > t) {
        t = timestamp
        console.log('收到数据:', profile)
        console.log('数据时间戳:', timestamp)
    }
})

// 移除监听
dot.off('profile')
```

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

# 后台运行 pm2
pm2 start server.mjs --name dot.most.box
```

默认情况下，节点将在端口 1976 上运行。您可以通过参数更改端口：

```bash
node server.mjs --port=3000
```

## SSL 证书配置

当您需要启用 HTTPS 时，请在 `ssl` 目录中配置以下文件：

必需文件：

-   `private.key`: 服务器私钥
-   `certificate.crt`: 主证书文件
-   `ca_bundle.crt`: 中间证书链

当必需文件存在时，服务器会自动启用 HTTPS 协议。

您可以从 [ZeroSSL](https://zerossl.com) 等服务商申请免费的 SSL 证书。

## 参与贡献

我们欢迎各种形式的贡献！您可以通过以下方式参与：

-   在 GitHub 上[提交问题或建议](https://github.com/most-people/dot.most.box/issues/new)
-   提交代码改进
-   帮助完善文档

### 问题反馈

如果您遇到任何问题或有改进建议，请[创建 Issue](https://github.com/most-people/dot.most.box/issues/new)。

## 许可证

[MIT](LICENSE) © dot.most.box

---

项目地址: [https://github.com/most-people/dot.most.box](https://github.com/most-people/dot.most.box)

研发团队: [most.box](https://most.box)
