# T4b dev 冒烟报告（c6R · run3 · 脚本 v3）

- 生成时间：2026-10-18T08:35:21.461Z
- 环境：Xvfb :77（1280×800）＋ `npm run dev`（web 5173 / server 8787）；node `/home/z/node22/bin/node` v22.14.0（ABI 127，匹配 better-sqlite3 原生构建）跑 dev 与本脚本——环境回收后 /usr/bin/node 已换 v24（ABI 137 不兼容），node22 持久化存于 /home/z/node22；脚本 `agents/6a5b5b21e5d2c86db05ee612/smoke-t4b.mjs`
- v3 修订记录：① FATAL/正常路径统一 try/finally 保证 browser.close()；② goto 前后 pgrep 单实例核查（残留即中止）；③ boot 失败整页重建重试一次（同 browser 实例）；④ run3 实证 boot 挂起根因=登录门（startAuth 无 minicityServerToken 即 showLogin 等人输入，launchBoot 永不启动；单实例即复现，run2「双实例争抢」归因证伪）→ goto 带 ?dev + token 双保险；⑤ 截图断言加 mtime 新鲜度过滤。

## 断言结果（五项口径）
- **① PASS**：跨海交通三 mesh（structures/tram/maglev）进视锥
  - `①: 跨海交通 mesh 存在并进视锥（structures/tram/maglev）` → PASS ｜ zoom=204(204) camera=[-56.6,40,184.1] box={"min":{"x":-276.8,"y":-0.8,"z":29.3},"max":{"x":115.6,"y":13.1,"z":290.8}} vis=[{"name":"year-town-transit-structures","found":true,"visible":true},{"name":"transit-tram","found":true,"visible":true},{"name":"transit-maglev","found":true,"visible":true}]
- **② FAIL**：station-stargate 站牌弹出 10 站目的地面板
  - `②: interactInterestPoint(station-stargate) 弹出 10 站目的地面板` → FAIL ｜ ok=true phase=panel panel=station-stargate open=false title=星门站 role=星门线 · 干线电车 opts=10 当前站标记=true
- **③-a SKIP**：星门→盛夏镇(2022) 乘车抵达：落点=月台且 |arrival.y−baseY|<0.01 ——运行中断于该项之前，未评估
- **③-b SKIP**：盛夏镇→启明镇(2020) 同口径乘车抵达（含 2022 站牌再开面板） ——运行中断于该项之前，未评估
- **④ PASS**：浏览器 console/pageerror 零 runtime error（过滤 favicon/net::ERR/Failed to load resource）
  - `④: 浏览器 console/pageerror 零 runtime error` → PASS ｜ pageErrors=0 runtimeConsoleErrors=0
- **⑤ PASS**：≥2 张 t4b-*.jpg 截图落盘（>10KB）
  - `⑤: ≥2 张 t4b-*.jpg 截图落盘（>10KB，本轮产出）` → PASS ｜ [{"f":"t4b-panel-stargate.jpg","size":59379,"m":1792311900299.711},{"f":"t4b-riding-tram.jpg","size":27191,"m":1792312269814.681},{"f":"t4b-transit-structures.jpg","size":124131,"m":1792311794224.7007}]

## 基础设施 check
- `boot: _mini.player + bootScreen is-ready` → PASS
- `map atlas preload settled` → PASS

## ④ 明细
- pageErrors：0
- console.error 原始：0
- console.error runtime（过滤后）：0

## 已知环境观察（非本次回归，转 T7 跟进）
- dev 日志 `Database backup failed: Cannot find module …/src/backupVerifier.js`（backupVerification.ts:7 Worker 引 .js 而 src 仅 .ts；server 照常 200 服务、浏览器侧无感、git 零改动）。

## ⚠️ 运行中断（FATAL）
```
Error: ride timeout 600s: {"phase":"riding","s":351.8196415492081,"length":356.3216532917443}
    at rideTo (file:///home/z/my-project/agents/6a5b5b21e5d2c86db05ee612/smoke-t4b.mjs:283:34)
    at async file:///home/z/my-project/agents/6a5b5b21e5d2c86db05ee612/smoke-t4b.mjs:300:14
```

## 结论
- check 5/6 通过；SKIP ③-a/③-b（中断未评估）；FATAL 中断。
