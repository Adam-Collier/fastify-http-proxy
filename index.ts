import fastify, { FastifyRequest } from "fastify";
import { fastifyPostgres } from "@fastify/postgres";
import dotenv from "dotenv";
dotenv.config();

const server = fastify({
  logger: {
    transport: {
      target: "pino-pretty",
    },
  },
});

server.register(fastifyPostgres, {
  connectionString: process.env.DATABASE_URL,
});

server.get("/ping", async (request, reply) => {
  return "pong\n";
});

server.get("/", async (request, reply) => {
  request.log.debug("request to /");
  return "Hello World\n";
});

interface QueryBody {
  sql: string;
  params: any[];
  method: string;
}

server.post(
  "/query",
  async (request: FastifyRequest<{ Body: QueryBody }>, reply) => {
    const db = await server.pg.connect();

    try {
      const { sql, params, method } = request.body;

      request.log.debug({ sql, params, method }, "request to /query");

      // prevent multiple queries
      const sqlBody = sql?.replace(/;/g, "");

      if (method === "all") {
        try {
          const result = await db.query({
            text: sqlBody,
            values: params,
            rowMode: "array",
          });
          // reply.send(result.rows);
          return result.rows;
        } catch (e) {
          console.log("error from all query", e);
          reply.status(500).send({ error: e });
        }
      } else if (method === "execute") {
        try {
          const result = await db.query({
            text: sqlBody,
            values: params,
          });

          console.log({ result }, "execute");

          reply.send(result.rows);
        } catch (e) {
          console.log("error from execute query", e);
          reply.status(500).send({ error: e });
        }
      } else {
        reply.status(500).send({ error: "Unknown method value" });
      }
    } catch (e) {
      console.log("error from /query", e);
      reply.status(500).send({ error: e });
    } finally {
      db.release();
    }
  }
);

server.listen({ port: 8080, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Server listening at ${address}`);
});
