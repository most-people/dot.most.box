import fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyMultipart from "@fastify/multipart";
import path from "path";
import { fileURLToPath } from "url";
import { create } from "ipfs-http-client";
import { isAddress } from "ethers";

const server = fastify();

// 创建 IPFS 客户端
const ipfs = create({ url: "http://127.0.0.1:5001" });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 注册静态文件服务
server.register(fastifyStatic, {
  root: path.join(__dirname, "..", "public"),
  prefix: "/",
});

// 注册 multipart 插件用于文件上传
server.register(fastifyMultipart);

// 文件列表 - 使用 ipfs-http-client 实现
server.get("/files/:address", async (request, reply) => {
  const address = request.params.address || "";
  if (!isAddress(address)) {
    return reply.code(400).send("以太网地址错误");
  }
  try {
    const result = ipfs.files.ls(`/${address}`, { long: true });
    const entries = [];
    for await (const file of result) {
      entries.push(file);
    }
    return entries;
  } catch (error) {
    const message = error.message || "未知错误";
    return reply.code(400).send("文件列表获取失败 " + message);
  }
});

const start = async () => {
  const port = 1976;
  try {
    await server.listen({ port });
    console.log(`http://[::1]:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
