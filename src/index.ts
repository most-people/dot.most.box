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
  const address = (request.params as { address: string }).address;
  if (!isAddress(address)) {
    return reply.code(400).send("Invalid ETH address");
  }
  try {
    const res = await api({
      method: "post",
      url: "/files/ls",
      params: { long: true, arg: "/" + address.toLowerCase() },
    });
    return res.data?.Entries || [];
  } catch (error: any) {
    const message = error?.response?.data?.Message || "/files/ls failed";
    return reply.code(400).send(message);
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
