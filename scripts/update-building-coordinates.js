#!/usr/bin/env node

/**
 * MiniCity 建筑坐标批量更新脚本
 * 根据 building-coordinates-redesign.json 中的规划，自动更新所有建筑配置文件
 */

const fs = require('fs');
const path = require('path');

// 读取规划配置
const redesignConfigPath = path.join(__dirname, '../.monkeycode/building-coordinates-redesign.json');
const redesignConfig = JSON.parse(fs.readFileSync(redesignConfigPath, 'utf-8'));

// 建筑配置文件目录
const buildingsDir = path.join(__dirname, '../apps/web/src/city/data/buildings');

// 收集所有需要更新的建筑
const buildingsToUpdate = new Map();

Object.values(redesignConfig.changes).forEach(zone => {
  if (zone.buildings) {
    zone.buildings.forEach(building => {
      const [oldX, oldZ] = building.oldPos;
      const [newX, newZ] = building.newPos;
      
      // 只更新坐标变化的建筑
      if (oldX !== newX || oldZ !== newZ) {
        buildingsToUpdate.set(building.id, {
          id: building.id,
          label: building.label,
          oldX,
          oldZ,
          newX,
          newZ,
          reason: building.reason
        });
      }
    });
  }
});

console.log(`\n🏗️  MiniCity 城市重新规划 - 建筑坐标更新\n`);
console.log(`📊 统计信息:`);
console.log(`   - 总建筑数: ${redesignConfig.summary.totalBuildings}`);
console.log(`   - 需要移动: ${buildingsToUpdate.size}`);
console.log(`   - 保持不变: ${redesignConfig.summary.unchangedBuildings}`);
console.log(`\n🔄 开始更新建筑坐标...\n`);

let successCount = 0;
let failCount = 0;
const errors = [];

// 更新每个建筑文件
buildingsToUpdate.forEach((update, buildingId) => {
  const fileName = `${buildingId}.ts`;
  const filePath = path.join(buildingsDir, fileName);
  
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`文件不存在: ${fileName}`);
    }
    
    // 读取文件内容
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // 替换 x 坐标
    const xRegex = /(\s+x:\s*)(-?\d+(?:\.\d+)?)(,?\s*)/;
    const xMatch = content.match(xRegex);
    if (xMatch) {
      const oldXInFile = parseFloat(xMatch[2]);
      if (Math.abs(oldXInFile - update.oldX) < 0.01) {
        content = content.replace(xRegex, `$1${update.newX}$3`);
      } else {
        console.warn(`⚠️  ${buildingId}: 文件中的 x 坐标 (${oldXInFile}) 与预期 (${update.oldX}) 不匹配`);
      }
    }
    
    // 替换 z 坐标
    const zRegex = /(\s+z:\s*)(-?\d+(?:\.\d+)?)(,?\s*)/;
    const zMatch = content.match(zRegex);
    if (zMatch) {
      const oldZInFile = parseFloat(zMatch[2]);
      if (Math.abs(oldZInFile - update.oldZ) < 0.01) {
        content = content.replace(zRegex, `$1${update.newZ}$3`);
      } else {
        console.warn(`⚠️  ${buildingId}: 文件中的 z 坐标 (${oldZInFile}) 与预期 (${update.oldZ}) 不匹配`);
      }
    }
    
    // 写回文件
    fs.writeFileSync(filePath, content, 'utf-8');
    
    console.log(`✅ ${buildingId.padEnd(25)} (${update.oldX}, ${update.oldZ}) → (${update.newX}, ${update.newZ})`);
    successCount++;
    
  } catch (error) {
    console.error(`❌ ${buildingId}: ${error.message}`);
    failCount++;
    errors.push({ buildingId, error: error.message });
  }
});

console.log(`\n📈 更新完成:`);
console.log(`   ✅ 成功: ${successCount}`);
console.log(`   ❌ 失败: ${failCount}`);

if (errors.length > 0) {
  console.log(`\n⚠️  错误详情:`);
  errors.forEach(({ buildingId, error }) => {
    console.log(`   - ${buildingId}: ${error}`);
  });
  process.exit(1);
}

console.log(`\n✨ 所有建筑坐标已成功更新！`);
console.log(`\n📝 下一步:`);
console.log(`   1. 运行 npm run typecheck 检查类型`);
console.log(`   2. 运行 npm run build 构建项目`);
console.log(`   3. 运行 npm run dev 启动开发服务器`);
console.log(`   4. 在浏览器中查看新的城市布局\n`);

process.exit(0);
