# dot.most.box

## 安装

```bash
npm install dot.most.box
```

## 快速开始

服务端

```js
import Dot from 'dot.most.box'
import http from 'http'

const { DotServer } = Dot
const server = http.createServer()
new DotServer(server)
server.listen(1976)
```

客户端

```js
import Dot from 'dot.most.box'

const { DotClient } = Dot
const client = new DotClient('http://localhost:1976')
```
