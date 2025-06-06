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
server.register(fastifyMultipart, {
  limits: {
    fileSize: 100 * 1024 * 1024, // 设置单个文件大小限制为100MB
    files: 1, // 限制同时上传的文件数量
  },
});

// 文件列表
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
    if (error.message.includes("file does not exist")) {
      return [];
    }
    return reply.code(400).send("文件列表获取失败 " + error.message);
  }
});

// 上传文件
server.put("/files/:address", async (request, reply) => {
  const address = request.params.address || "";
  if (!isAddress(address)) {
    return reply.code(400).send("以太网地址错误");
  }

  try {
    const data = await request.file();
    if (!data) {
      return reply.code(400).send("没有文件");
    }

    const buffer = await data.toBuffer();
    const filename = data.filename || "unnamed";

    // 将文件添加到IPFS
    const fileAdded = await ipfs.add(buffer);

    // 将文件复制到指定地址目录
    await ipfs.files.mkdir(`/${address}`, { parents: true });
    await ipfs.files.cp(`/ipfs/${fileAdded.cid}`, `/${address}/${filename}`);

    return {
      success: true,
      filename: filename,
      cid: fileAdded.cid.toString(),
      size: fileAdded.size,
    };
  } catch (error) {
    return reply.code(500).send("文件上传失败 " + error.message);
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
