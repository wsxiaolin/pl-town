#!/usr/bin/env node

/**
 * MiniCity 城市布局可视化工具
 * 在终端中以ASCII图形方式展示城市规划
 */

const fs = require('fs');
const path = require('path');

// 读取规划配置
const redesignConfigPath = path.join(__dirname, '../.monkeycode/building-coordinates-redesign.json');
const redesignConfig = JSON.parse(fs.readFileSync(redesignConfigPath, 'utf-8'));

// 收集所有建筑的新坐标
const buildings = [];

Object.entries(redesignConfig.changes).forEach(([zoneKey, zone]) => {
  if (zone.buildings) {
    zone.buildings.forEach(building => {
      const [newX, newZ] = building.newPos;
      buildings.push({
        id: building.id,
        label: building.label,
        x: newX,
        z: newZ,
        zone: zone.description
      });
    });
  }
});

// 创建ASCII地图
function createCityMap() {
  // 地图范围：-80 到 80
  const minCoord = -80;
  const maxCoord = 80;
  const scale = 2; // 每2个单位一个字符
  
  const width = Math.floor((maxCoord - minCoord) / scale);
  const height = Math.floor((maxCoord - minCoord) / scale);
  
  // 创建空白地图
  const map = Array(height).fill(null).map(() => Array(width).fill(' '));
  
  // 绘制坐标轴
  const centerX = Math.floor((0 - minCoord) / scale);
  const centerZ = Math.floor((0 - minCoord) / scale);
  
  // 绘制X轴
  for (let i = 0; i < width; i++) {
    if (map[centerZ] && map[centerZ][i] === ' ') {
      map[centerZ][i] = '─';
    }
  }
  
  // 绘制Z轴
  for (let i = 0; i < height; i++) {
    if (map[i] && map[i][centerX] === ' ') {
      map[i][centerX] = '│';
    }
  }
  
  // 原点
  if (map[centerZ] && map[centerZ][centerX]) {
    map[centerZ][centerX] = '┼';
  }
  
  // 绘制建筑
  buildings.forEach(building => {
    const mapX = Math.floor((building.x - minCoord) / scale);
    const mapZ = Math.floor((building.z - minCoord) / scale);
    
    if (mapZ >= 0 && mapZ < height && mapX >= 0 && mapX < width) {
      map[mapZ][mapX] = '■';
    }
  });
  
  return map;
}

// 打印地图
function printCityMap() {
  console.log('\n🏙️  MiniCity 城市布局可视化\n');
  console.log('图例: ■ = 建筑, ─│┼ = 坐标轴, 中心 = (0, 0)\n');
  
  const map = createCityMap();
  
  // 打印地图（Z轴从上到下，所以要反转）
  console.log('    ' + '─'.repeat(map[0].length));
  map.reverse().forEach((row, idx) => {
    const zCoord = 80 - (idx * 2);
    const prefix = zCoord.toString().padStart(3, ' ') + '│';
    console.log(prefix + row.join(''));
  });
  console.log('    ' + '─'.repeat(map[0].length));
  
  // X轴标注
  const xLabels = '       -80        -40          0          40         80';
  console.log(xLabels);
}

// 按区域统计建筑
function printZoneStatistics() {
  console.log('\n📊 功能区建筑统计:\n');
  
  const zoneStats = {};
  
  Object.entries(redesignConfig.changes).forEach(([zoneKey, zone]) => {
    if (zone.buildings) {
      zoneStats[zone.description] = zone.buildings.length;
    }
  });
  
  Object.entries(zoneStats)
    .sort((a, b) => b[1] - a[1])
    .forEach(([zoneName, count]) => {
      const bar = '█'.repeat(Math.floor(count / 2));
      console.log(`${zoneName.padEnd(50)} ${count.toString().padStart(2)} ${bar}`);
    });
}

// 列出每个区域的建筑
function printBuildingsByZone() {
  console.log('\n🏢 各功能区建筑列表:\n');
  
  Object.entries(redesignConfig.changes).forEach(([zoneKey, zone]) => {
    if (zone.buildings && zone.buildings.length > 0) {
      console.log(`\n${zone.description}:`);
      zone.buildings.forEach(building => {
        const [x, z] = building.newPos;
        console.log(`  • ${building.label.padEnd(20)} (${x.toString().padStart(5)}, ${z.toString().padStart(5)})`);
      });
    }
  });
}

// 显示关键地标
function printLandmarks() {
  console.log('\n🗼 城市地标建筑:\n');
  
  const landmarks = [
    { label: '参议院（市政厅）', pos: [0, 0], desc: '城市中心' },
    { label: '电视塔', pos: [30, -9], desc: '东南地标' },
    { label: '奇点塔', pos: [-5.5, -49.5], desc: '北区地标' },
    { label: '布拿拉宫', pos: [-27, 27], desc: '西北地标' },
    { label: '灯塔', pos: [9, 30], desc: '东北地标' }
  ];
  
  landmarks.forEach(landmark => {
    console.log(`  🏛️  ${landmark.label.padEnd(20)} (${landmark.pos[0].toString().padStart(5)}, ${landmark.pos[1].toString().padStart(5)}) - ${landmark.desc}`);
  });
}

// 主函数
function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
MiniCity 城市布局可视化工具

用法: node scripts/visualize-city-layout.js [选项]

选项:
  --map       显示城市地图
  --zones     显示功能区统计
  --list      列出各区域建筑
  --landmarks 显示地标建筑
  --all       显示所有信息（默认）
  -h, --help  显示帮助信息
    `);
    return;
  }
  
  const showMap = args.includes('--map') || args.includes('--all') || args.length === 0;
  const showZones = args.includes('--zones') || args.includes('--all') || args.length === 0;
  const showList = args.includes('--list') || args.includes('--all') || args.length === 0;
  const showLandmarks = args.includes('--landmarks') || args.includes('--all') || args.length === 0;
  
  if (showMap) printCityMap();
  if (showLandmarks) printLandmarks();
  if (showZones) printZoneStatistics();
  if (showList) printBuildingsByZone();
  
  console.log('\n✨ 城市规划总览完成！\n');
  console.log('💡 提示: 运行 node scripts/update-building-coordinates.js 来应用这些更改\n');
}

main();
