// rollup.config.js
import typescript from '@rollup/plugin-typescript'
import dts from 'rollup-plugin-dts'

// 客户端配置
const clientConfig = {
    input: 'src/index.ts',
    output: [
        {
            file: 'dist/index.js',
            format: 'umd',
            name: 'Dot', // UMD 全局变量名
            exports: 'default', // 关键配置：处理默认导出
        },
    ],
    plugins: [
        typescript({
            compilerOptions: {
                declaration: false, // 关闭 tsc 自带的声明生成
            },
        }),
    ],
}

// 服务端配置
const serverConfig = {
    input: 'src/server.ts',
    output: [
        {
            file: 'dist/server.js',
            format: 'cjs', // 对于服务器端，使用 CommonJS 格式
            exports: 'auto', // 修改为 'auto'，让 Rollup 自动确定导出模式
        },
    ],
    plugins: [
        typescript({
            compilerOptions: {
                declaration: false,
            },
        }),
    ],
    external: ['ws', 'fs', 'path', 'http', 'ethers'], // 添加 ethers 作为外部依赖
}

// 客户端声明文件配置
const clientDtsConfig = {
    input: 'src/index.ts',
    output: [{ file: 'dist/index.d.ts', format: 'es' }],
    plugins: [dts()],
}

// 服务端声明文件配置
const serverDtsConfig = {
    input: 'src/server.ts',
    output: [{ file: 'dist/server.d.ts', format: 'es' }],
    plugins: [dts()],
}

export default [clientConfig, clientDtsConfig, serverConfig, serverDtsConfig]
