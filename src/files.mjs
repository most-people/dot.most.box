import { isAddress } from "ethers";
import { create } from "ipfs-http-client";

// 创建 IPFS 客户端
const ipfs = create({ url: "http://127.0.0.1:5001" });

/**
 * 注册文件相关的路由
 * @param {import('fastify').FastifyInstance} server - Fastify 服务器实例
 */
export const registerFiles = (server) => {
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
};
