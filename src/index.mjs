import fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyMultipart from "@fastify/multipart";
import path from "path";
import { fileURLToPath } from "url";
import { registerFiles } from "./files.mjs";

const server = fastify();

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

// 注册文件路由
registerFiles(server);

const start = async () => {
  const port = 1976;
  try {
    await server.listen({ port });
    console.log(`http://[::1]:${port}`);
  } catch (err) {
    console.error(err);
    server.log.error(err);
    process.exit(1);
  }
};

start();
