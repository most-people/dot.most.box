// rollup.config.js
import typescript from '@rollup/plugin-typescript'
import dts from 'rollup-plugin-dts'

// 主配置
const config = {
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

// 声明文件生成配置
const dtsConfig = {
    input: 'src/index.ts',
    output: [{ file: 'dist/index.d.ts', format: 'es' }],
    plugins: [dts()],
}

export default [config, dtsConfig]
