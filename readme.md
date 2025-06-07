安装 IPFS

```bash
# 更新系统
sudo apt update

# 安装必要工具
sudo apt install wget curl tar -y

# 下载最新版本的 Kubo
wget https://dist.ipfs.tech/kubo/v0.24.0/kubo_v0.24.0_linux-amd64.tar.gz

# 解压
tar -xvzf kubo_v0.24.0_linux-amd64.tar.gz

# 进入目录并安装
cd kubo
sudo bash install.sh

# 验证安装
ipfs --version

# 初始化 IPFS 仓库
ipfs init

# 公网访问
ipfs config Addresses.Gateway /ip4/0.0.0.0/tcp/8080

# 测试启动 IPFS
ipfs daemon

# 静默启动 IPFS
nohup ipfs daemon > /home/ubuntu/ipfs.log 2>&1 &

# 检查是否运行
ps aux | grep ipfs
```
