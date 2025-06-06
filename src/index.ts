import fastify from "fastify";
import fastifyStatic from "@fastify/static";
import path from "path";

const server = fastify();

// 注册静态文件服务
server.register(fastifyStatic, {
  root: path.join(__dirname, "..", "public"),
  prefix: "/",
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
