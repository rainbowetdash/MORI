# MORI

MORI 是一个“现实连接型”的心理支持桌宠原型。它通过长期存在的桌面生命降低使用门槛，帮助用户整理经历、表达需求，并连接朋友、家人、老师、学校支持或专业资源。

它不是心理咨询、诊断工具或紧急服务。

## 本地启动

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。

公开测试版优先使用 `https://mori-companion.pages.dev`，完整页面和聊天接口均由 Cloudflare Pages 提供；`https://mori-companion.rainbowetdash.workers.dev` 保留为备用入口。

不配置 API Key 时，页面使用本地演示回复。点击右上角“连接 Agent”，可填写通义千问或其他 OpenAI-compatible 模型的 API Key、模型名与服务地址。Key 只保存在当前浏览器标签页，不会写入项目文件。

## 已实现的演示功能

- MORI 的发呆、散步、看书、睡觉、伸懒腰与开心动作
- 多种表情、呼吸/眨眼动画与自由拖动
- 对话面板与心理支持 Agent 接口
- Help Me Say It 表达整理卡
- MORI 信箱、求助背包、心理花园与每周回顾
- 高风险表达触发的去游戏化现实支持界面
- 本地演示模式与 Qwen/OpenAI-compatible API 模式

## 正式上线前

需要由学校核验心理中心、校医院、校园保卫、学生事务和当地紧急资源卡，并完成隐私、伦理、法律、未成年人保护、危机责任人与人工接管流程审核。Cloudflare 部署时应将模型密钥迁移到 Worker Secret，不应继续由使用者在前端保存。
