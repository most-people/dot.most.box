import fastify from "fastify";

const server = fastify();

server.get("/", async () => {
  return { hello: "world" };
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
