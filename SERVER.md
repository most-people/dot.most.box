## 其他后端框架示例

#### 挂载到 Express

```js
import express from 'express'
import http from 'http'
import DotServer from 'dot.most.box/server'

const app = express()
const server = http.createServer(app)
new DotServer(server)
server.listen(1976, () => console.log('Express server running on port 1976'))
```

#### 挂载到 Fastify

```js
import fastify from 'fastify'
import http from 'http'
import DotServer from 'dot.most.box/server'

const app = fastify({
    serverFactory: (handler) => {
        const server = http.createServer(handler)
        new DotServer(server)
        return server
    },
})

app.listen({ port: 1976 }, (err) => {
    err ? (console.error(err), process.exit(1)) : console.log('Fastify server running on port 1976')
})
```

#### 挂载到 Koa

```js
import Koa from 'koa'
import http from 'http'
import DotServer from 'dot.most.box/server'

const app = new Koa()
const server = http.createServer(app.callback())
new DotServer(server)
server.listen(1976, () => console.log('Koa server running on port 1976'))
```

#### 挂载到 NestJS

```js
import { NestFactory } from '@nestjs/core'
import { ExpressAdapter } from '@nestjs/platform-express'
import http from 'http'
import DotServer from 'dot.most.box/server'
import { AppModule } from './app.module'

const server = http.createServer()
const app = await NestFactory.create(AppModule, new ExpressAdapter(server))

new DotServer(server)
await app.init()
server.listen(1976, () => console.log('NestJS server running on port 1976'))
```
