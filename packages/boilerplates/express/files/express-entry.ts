import { renderPage } from "vite-plugin-ssr/server";
import { telefunc } from "telefunc";
import { VikeAuth } from "vike-authjs";
import CredentialsProvider from "@auth/core/providers/credentials";
import express from "express";
import { createMiddleware } from "@hattip/adapter-node";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path/posix";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const isProduction = process.env.NODE_ENV === "production";
const root = __dirname;

startServer();

async function startServer() {
  const app = express();

  if (isProduction) {
    app.use(express.static(`${root}/dist/client`));
  } else {
    // Instantiate Vite's development server and integrate its middleware to our server.
    // ⚠️ We should instantiate it *only* in development. (It isn't needed in production
    // and would unnecessarily bloat our server in production.)
    const vite = await import("vite");
    const viteDevMiddleware = (
      await vite.createServer({
        root,
        server: { middlewareMode: true },
      })
    ).middlewares;
    app.use(viteDevMiddleware);
  }

  if (import.meta.BATI_MODULES?.includes("auth:authjs")) {
    /**
     * AuthJS
     *
     * TODO: Replace secret {@see https://authjs.dev/reference/core#secret}
     * TODO: Choose and implement providers
     *
     * @link {@see https://authjs.dev/guides/providers/custom-provider}
     **/
    const Auth = VikeAuth({
      secret: "MY_SECRET",
      providers: [
        CredentialsProvider({
          name: "Credentials",
          credentials: {
            username: { label: "Username", type: "text", placeholder: "jsmith" },
            password: { label: "Password", type: "password" },
          },
          async authorize(credentials, req) {
            // Add logic here to look up the user from the credentials supplied
            const user = { id: "1", name: "J Smith", email: "jsmith@example.com" };

            // Any object returned will be saved in `user` property of the JWT
            // If you return null then an error will be displayed advising the user to check their details.
            // You can also Reject this callback with an Error thus the user will be sent to the error page with the error message as a query parameter
            return user ?? null;
          },
        }),
      ],
    });

    app.all(
      "/api/auth/*",
      createMiddleware(Auth, {
        alwaysCallNext: false,
      })
    );
  }

  if (import.meta.BATI_MODULES?.includes("rpc:telefunc")) {
    /**
     * Telefunc route
     *
     * @link {@see https://telefunc.com}
     **/
    app.post(
      "/_telefunc",
      createMiddleware(
        async (context) => {
          const httpResponse = await telefunc({
            url: context.request.url.toString(),
            method: context.request.method,
            body: await context.request.text(),
            context,
          });
          const { body, statusCode, contentType } = httpResponse;
          return new Response(body, {
            status: statusCode,
            headers: {
              "content-type": contentType,
            },
          });
        },
        {
          alwaysCallNext: false,
        }
      )
    );
  }

  /**
   * Vike route
   *
   * @link {@see https://vite-plugin-ssr.com}
   **/
  app.all("*", async (req, res, next) => {
    const pageContextInit = { urlOriginal: req.originalUrl };
    const pageContext = await renderPage(pageContextInit);
    if (pageContext.httpResponse === null) return next();

    if ((pageContext as Record<string, unknown>)._isStream) {
      pageContext.httpResponse.pipe(res);
    } else {
      const { body, statusCode, contentType } = pageContext.httpResponse;
      res.status(statusCode).type(contentType).send(body);
    }
  });

  app.listen(process.env.PORT ? parseInt(process.env.PORT) : 3000, "localhost", () => {
    console.log("Server listening on http://localhost:3000");
  });
}