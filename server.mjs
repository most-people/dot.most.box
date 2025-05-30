import os from 'os'
import fs from 'fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import { DotServer } from './dist/server.js'
import { create } from 'ipfs-http-client'
// import { HDNodeWallet } from 'ethers'
// import Dot from './dist/index.js'

const __filename = fileURLToPath(import.meta.url) // 获取当前文件路径
const __dirname = path.dirname(__filename) // 获取当前目录路径

// 解析命令行参数
const args = process.argv.slice(2)
const portArg = args.find((arg) => arg.startsWith('--port='))
const PORT = portArg ? Number(portArg.split('=')[1]) : Number(process.env.PORT) || 1976

// 获取网络接口列表
const interfaces = os.networkInterfaces()

const hasCert = ['private.key', 'certificate.crt'].every((file) =>
    fs.existsSync(path.join(__dirname, 'ssl', file)),
)

const getHttps = () => {
    if (hasCert) {
        const cert = {
            key: fs.readFileSync(path.join(__dirname, 'ssl', 'private.key')),
            cert: fs.readFileSync(path.join(__dirname, 'ssl', 'certificate.crt')),
        }
        // 动态添加 CA 证书（如果存在）
        if (fs.existsSync(path.join(__dirname, 'ssl', 'ca_bundle.crt'))) {
            cert.ca = fs.readFileSync(path.join(__dirname, 'ssl', 'ca_bundle.crt'))
        }
        return cert
    }
    return null
}

// 创建 Fastify 实例
const server = fastify({
    // logger: true,
    https: getHttps(),
})

// 配置静态文件服务
server.register(fastifyStatic, {
    root: __dirname,
    prefix: '/',
})
// 注册 multipart 插件以支持文件上传
server.register(require('@fastify/multipart'))

// API 路由
server.get('/hello', async () => {
    return { hello: 'world' }
})

// 启动服务
const start = async () => {
    try {
        await server.listen({ port: PORT, host: '::' })

        // 初始化 DotServer
        new DotServer(server.server)

        // 遍历所有网络接口
        let ipv4 = ''
        let ipv6 = ''
        for (const key in interfaces) {
            for (const iface of interfaces[key]) {
                if (!iface.internal) {
                    // 确保该地址是IPv6且不是内部地址
                    if (ipv6 === '' && 'IPv6' === iface.family) {
                        ipv6 = iface.address
                    }
                    if (ipv4 === '' && 'IPv4' === iface.family) {
                        ipv4 = iface.address
                    }
                }
            }
        }
        const protocol = hasCert ? 'https' : 'http'
        console.log(`IPv6   Server running at ${protocol}://[${ipv6}]:${PORT}`)
        console.log(`IPv4   Server running at ${protocol}://${ipv4}:${PORT}`)
        console.log(`Local  Server running at ${protocol}://localhost:${PORT}`)
    } catch (err) {
        server.log.error(err)
        process.exit(1)
    }
}

start()

// 智能合约
// const smart = () => {
//     const dotClient = new Dot.DotClient(['https://api.most.red'])
//     const wallet = Dot.mostWallet(
//         'test',
//         'dot.app.most',
//         'I know loss mnemonic will lose my wallet.',
//     )
//     // 创建用户实例
//     const dot = dotClient.dot(wallet.address)
//     // 设置加密所需的密钥
//     dot.setPubKey(wallet.public_key)
//     dot.setPrivKey(wallet.private_key)
//     // 设置签名器
//     const signer = HDNodeWallet.fromPhrase(wallet.mnemonic)
//     dot.setSigner(signer)

//     // dot.on('messages', (data, timeStamp) => {
//     //     console.log('data', data)
//     // })
// }

// smart()

// IPFS
const ipfs = create({
    url: 'http://localhost:5001/api/v0',
    timeout: '30s'
})

// 查询所有文件
server.get('/list', async (request, reply) => {
    try {
        const type = request.query.type || 'recursive'
        const result = []
        for await (const pin of ipfs.pin.ls({ type })) {
            result.push(pin.cid.toString())
        }
        return result
    } catch (error) {
        reply.code(500).send({ error: error.message, code: error.code })
    }
})

// 查询 CID 是否存在
server.get('/exists/:cid', async (request) => {
    try {
        const { cid } = request.params
        if (!cid) {
            return false
        }
        const stat = await ipfs.block.stat(cid)
        return stat.cid.toString()
    } catch (error) {
        return false
    }
})

// 添加文件
server.post('/add', async (request, reply) => {
    try {
        // 解析上传的文件（假设文件字段名为 "file"）
        const data = await request.file()
        const content = await data.toBuffer()
        // 上传到IPFS
        const result = await ipfs.add(content)
        return { cid: result.cid.toString() }
    } catch (error) {
        reply.code(500).send({ error: error.message, code: error.code })
    }
})

// 删除文件
server.post('/remove/:cid', async (request, reply) => {
    try {
        const { cid } = request.params
        if (!cid) {
            return reply.code(400).send({ error: '参数 "arg" CID 是必需的' })
        }
        await ipfs.pin.rm(cid)
        return { success: true, cid }
    } catch (error) {
        reply.code(500).send({ error: error.message, code: error.code })
    }
})

// 垃圾回收
server.post('/repo/gc', async (request, reply) => {
    try {
        const list = []
        // 执行垃圾回收并收集清理的CID
        for await (const cid of ipfs.repo.gc()) {
            list.push(cid.toString())
        }
        return list
    } catch (error) {
        reply.code(500).send({ error: error.message, code: error.code })
    }
})

