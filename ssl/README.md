# 开启 HTTPS 配置 SSL 证书目录

申请地址：https://zerossl.com

必需文件：

-   `private.key`: 服务器私钥
-   `certificate.crt`: 主证书文件
-   `ca_bundle.crt`: 中间证书链

可选文件：

-   `ca_bundle.crt`: 备用中间证书（如果存在会自动加载）

当必需文件存在时，服务器会自动启用 HTTPS 协议。
