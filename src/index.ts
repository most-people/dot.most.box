import fastify from "fastify";
import fastifyStatic from "@fastify/static";
import path from "path";
import api from "./api";
import { getAddress, isAddress } from "ethers";

const server = fastify();

// 注册静态文件服务
server.register(fastifyStatic, {
  root: path.join(__dirname, "..", "public"),
  prefix: "/",
});

// 文件列表 https://docs.ipfs.tech/reference/kubo/rpc/#api-v0-files-flush
server.get("/files/:address", async (request, reply) => {
  const params = request.params as { address?: string };
  const address = (params.address || "").toLowerCase();
  if (!isAddress(address)) {
    return reply.code(400).send("以太网地址错误");
  }
  try {
    const res = await api({
      method: "post",
      url: "/files/ls",
      params: { long: true, arg: "/" + address },
    });
    return res.data?.Entries || [];
  } catch (error: any) {
    const message = error?.response?.data?.Message || "";
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
