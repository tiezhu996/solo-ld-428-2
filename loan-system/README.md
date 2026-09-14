# 艺术作品借展与运输交接系统

面向美术馆 / 画廊藏品部的借展全流程管理：借出作品排期、借展机构、墙到墙保单、装箱清单、四段运输交接、归还逐件核对、逾期与保单到期提醒。

## 本机直接运行（无需安装任何依赖）

要求：Python 3.8+（仅使用标准库，自带 SQLite）。

```bash
cd loan-system/server
python3 app.py            # 默认 http://127.0.0.1:8000
# 或指定端口：python3 app.py --port 9000
```

也可以在仓库根目录：

```bash
bash run.sh        # 默认 8000 端口；bash run.sh 9000 指定端口
```

浏览器打开 **http://127.0.0.1:8000** 即可。首次启动自动建库并写入演示数据
（8 件藏品、3 家机构、4 张不同状态的借展单）。删除 `server/data/loans.db` 可重置全部数据。

## 业务流程

```
新建借展单 ──► 登记保单 ──► 装箱清单 ──► 出库交接 ──► 到馆交接
 (pending)                                  (outgoing)     (active)
     │                                                        │
     └─可取消                                          还回出库 ──► 回库 + 逐件归还检查
                                                                    └─核对完整后结项 (returned)
```

- **展期冲突阻止提交**：新建/编辑借展单时，对每件作品按区间重叠规则
  （既有借展开始 ≤ 新结束 且 既有结束 ≥ 新开始）在 SQLite 事务
  （`BEGIN IMMEDIATE`）内校验，冲突返回 HTTP 409 并列出冲突单号、机构与占用时段；
  前端在勾选作品/修改日期时实时预检，冲突时无法提交。已取消的借展单不占档期。
- **归还逐件核对**：每件作品必须选择 完好 / 损伤 / 缺失 并填写状况说明，
  系统强制「借展单内全部作品核对完成」才允许结项，结项后借展单置为已归还、记录锁定。
- **交接记录**：出库 / 到馆 / 还回出库 / 回库四类，每类只能登记一次，
  每次必须逐件登记状况；状况驱动借展状态机自动推进。
- **逾期提醒**：逾期未还、7 天内到期、保单 14 天内止期、在途/归还中的损伤缺失，
  均在「逾期与提醒」页和仪表盘汇总（按当天日期动态计算，无需定时任务）。
- **保单校验提示**：保期未完整覆盖借展期时给出脱保预警。

## 目录结构

```
loan-system/
├── server/
│   ├── app.py                # 启动入口（HTTP 服务 + 静态托管）
│   ├── db.py                 # SQLite 连接
│   ├── schema.py             # 建表
│   ├── web.py                # 零依赖路由框架
│   ├── helpers.py            # 冲突校验、日期/必填校验等
│   ├── database/seed.py      # 演示数据
│   └── routes/
│       ├── artworks.py       # 藏品
│       ├── institutions.py   # 借展机构
│       ├── loans.py          # 借展单（冲突校验、状态机）
│       ├── insurance.py      # 保单
│       ├── packing.py        # 包装箱 / 装箱清单
│       ├── handovers.py      # 四段交接
│       ├── return_check.py   # 归还检查与结项
│       └── reminders.py      # 提醒 + 仪表盘统计
└── web/                      # 原生 HTML/CSS/JS 单页前端（无构建步骤）
    └── js/pages/             # dashboard / artworks / institutions /
                              # loans / loan-detail / reminders
```

## 主要 API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET/POST | `/api/artworks`、`/api/institutions` | 藏品、机构列表/新建 |
| GET/POST/PUT | `/api/loans` | 借展单 CRUD；POST/PUT 支持 `dry_run` 冲突预检 |
| POST | `/api/loans/{id}/cancel` | 取消待出库借展单 |
| PUT | `/api/loans/{id}/insurance` | 登记/编辑保单（一单一保） |
| POST/DELETE | `/api/loans/{id}/crates`、`/api/crates/{cid}/items` | 装箱 |
| POST | `/api/loans/{id}/handovers` | 登记交接（逐件状况，驱动状态机） |
| PUT/POST | `/api/loans/{id}/return-check[/finalize]` | 归还核对与结项 |
| GET | `/api/reminders`、`/api/stats` | 提醒、仪表盘 |

## 技术栈

Python 3 标准库（`http.server` + `sqlite3`）· 原生 HTML/CSS/JavaScript · 零第三方依赖 · SQLite 文件库。

## License

MIT
