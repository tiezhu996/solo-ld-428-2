# 艺术作品集与画廊管理平台

## Docker 启动

```bash
docker compose up --build
```

- 前端访问地址：http://localhost:18808/gallery
- 后端 API 地址：http://localhost:19308/api
- 健康检查：http://localhost:19308/health

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 前端 | React 18 + TypeScript + Vite |
| UI | Tailwind CSS + Headless UI |
| 图表 | ECharts |
| 懒加载 | react-lazyload |
| 状态 | Zustand |
| 后端 | NestJS + TypeScript |
| 数据库 | MongoDB 7 + Mongoose |
| 部署 | Docker Compose |

## 目录结构

```text
frontend/src/
├── api/
├── stores/
├── types/
├── components/common/
├── hooks/
├── pages/
├── router/
├── utils/
└── constants/

backend/src/
├── routes/
├── controllers/
├── services/
├── models/
├── middlewares/
├── types/
├── utils/
├── config/
└── database/seeds/
```

## 枚举位置

- 后端：`backend/src/types/enums.ts`
- 前端：`frontend/src/types/enums.ts`

## 主要页面

- `/gallery` 画廊首页
- `/artwork/:id` 作品详情
- `/exhibition/:id` 展览详情
- `/artist/:id` 艺术家主页
- `/studio` 创作工作台

## License

MIT
