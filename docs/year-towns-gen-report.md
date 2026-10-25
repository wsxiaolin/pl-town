# 年份群岛纪念设施生成报告

> 生成器：`scripts/generate_town_buildings.mjs`（幂等，只覆盖明确产物，--check 逐字节复核）
> 数据基线：离线重建（无数据源；结构取自既有 gen-buildings.ts）
> 设计口径：设计 §7.1 修订——作品抽象为城市纪念设施，**作品原文/评论/热度/浏览量不进入年份群岛**。
> 设施名与纪念导语来自手写目录 `apps/web/src/city/data/year-towns/yearTownMemorials.ts`。
> 治理口径：年份群岛建筑不入治理账本（无 personalPlots/Areas，设计 §10）——服务端镜像仅作 admin 世界图登记。

## 各镇产出

| 镇 | 纪念设施 | 纪念名录 | 布局缩放 |
|---|---|---|---|
| 2019·起源村 | 2 | — | 1 |
| 2020·启明镇 | 10 | 1 | 1 |
| 2021·潮声镇 | 16 | 1 | 1 |
| 2022·盛夏镇 | 20 | 1 | 1 |
| 2023·回响镇 | 18 | 1 | 1 |
| 2024·微光镇 | 16 | 1 | 1 |
| 2025·长风镇 | 12 | 1 | 1 |
| 2026·星港 | 12 | 1 | 1 |

## 总量对账

| 项 | 数值 |
|---|---|
| 纪念设施（作品抽象） | 106/106 |
| 镇纪念名录 | 7/7（起源村除外） |
| 千作总目塔 + 起源村界碑 | 2/2 |
| 总结构 | 115/115 |
| 生成模块文件数 | 6 |

## 设施族分布

| 设施族 | 座数 |
|---|---|
| gathering | 18 |
| guild | 17 |
| press | 12 |
| memorial | 9 |
| lab | 8 |
| tavern | 8 |
| law | 7 |
| narrative | 7 |
| academy | 6 |
| observatory | 5 |
| dwelling | 5 |
| market | 4 |

## 布局语法（设计 §7.1 修订）

1. 海岸与地形先行：显式海岸线形成海湾、岬角和离岸小屿，山脊与城区阶地分开。
2. 街网先行：车站、主街、横街、巷道、站前广场和码头先定稿。
3. 逐栋手写：每座设施在纪念目录中登记世界坐标、地块尺寸和临街朝向。
4. 围合街廓：建筑沿街廓边缘形成街墙，街廓中心保留院落。
5. 交通避让：环线沿城区外围绕行，建筑、站房、道路和广场保持结构净距。

## 数据对齐说明（治理红线）

- `buildings/_registry.ts` 未改动：年份群岛建筑不逐座进主城注册表，
  合流点在 `yearTownBuildings.ts` → cityWorldAssembly 装配（与 BUILDING_DEFS 同一 buildingSceneController 管道）。
- 服务端 `buildingCatalog.ts` 未改动；独立镜像 `yearTownCatalog.ts`（115 条，storyLocked 全 false），
  已筹资项目 ID 零变更（AGENTS 治理红线）。
- `gen-buildings.ts` 与 `gen-index.ts` 是运行时静态数据，随仓库提交；生成器只覆盖明确产物。
