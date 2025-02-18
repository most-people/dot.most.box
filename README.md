# dot.js

## 安装

```bash
npm install dot.js
```

## 快速开始

服务端

```js
import { DotServer } from 'dot-protocol'
import http from 'http'

const server = http.createServer()
new DotServer(server)
server.listen(3000)
```

客户端

```js
import { DotClient } from 'dot.js'

const client = new DotClient('http://localhost:3000')
```
