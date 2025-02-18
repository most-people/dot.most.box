# dot.most.box

## 安装

```bash
npm install dot.most.box
```

## 快速开始

服务端

```js
import { DotServer } from 'dot.most.box'
import http from 'http'

const server = http.createServer()
new DotServer(server)
server.listen(3000)
```

客户端

```js
import { DotClient } from 'dot.most.box'

const client = new DotClient('http://localhost:3000')
```
