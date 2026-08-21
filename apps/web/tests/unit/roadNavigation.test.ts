import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { footprintOverlapsMainRoad } from '../../src/city/data/cityConfig';
import { createRoadNavigationSystem } from '../../src/city/navigation/roadNavigation';

function navigationWithBuilding() {
  const group = new THREE.Group();
  group.position.set(10, 0, -6);
  group.add(new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4)));
  const navigation = createRoadNavigationSystem({
    roadCoords: [-6, 0, 6, 12],
    echoObservatoryArea: { roadNodes: [], roadSegments: [] },
    westBeach: { deepWaterX: -44.5, safeReturnX: -42.2, minZ: -34, maxZ: 54 },
    cityLimit: 42,
    getBuildings: () => [{ group }],
  });
  navigation.cacheBuildingBoxes();
  return navigation;
}

test('main-road clearance rejects road furniture and overlapping foundations only inside the city', () => {
  assert.equal(footprintOverlapsMainRoad(38, 0, 0.13), true);
  assert.equal(footprintOverlapsMainRoad(1.65, 9, 1.1), true);
  assert.equal(footprintOverlapsMainRoad(2.4, 2.8, 0.13), false);
  assert.equal(footprintOverlapsMainRoad(44, 1.3, 0.13), false);
});

test('manual movement cannot cross a building and can slide beside it', () => {
  const navigation = navigationWithBuilding();
  const start = new THREE.Vector3(5, 0, -6);
  assert.deepEqual(navigation.resolveMovement(start, new THREE.Vector3(15, 0, -6)).toArray(), start.toArray());
  const slide = navigation.resolveMovement(start, new THREE.Vector3(9, 0, -4));
  assert.equal(slide.x, 5);
  assert.equal(slide.z, -4);
});

test('click path keeps its waypoints outside building clearance', () => {
  const navigation = navigationWithBuilding();
  const path = navigation.buildRoadPath(new THREE.Vector3(0, 0, -6), new THREE.Vector3(10, 0, -6));
  assert.ok(path.length > 0);
  assert.ok(path.every(point => !navigation.pointInAnyBuilding(point.x, point.z)));
});

test('deep water returns the player to the beach', () => {
  const navigation = navigationWithBuilding();
  const returned = navigation.resolveMovement(new THREE.Vector3(-44, 0, 10), new THREE.Vector3(-46, 0, 10));
  assert.deepEqual(returned.toArray(), [-42.2, 0, 10]);
});

test('building clearance leaves nearby walking space available', () => {
  const navigation = navigationWithBuilding();
  assert.equal(navigation.pointInAnyBuilding(12.15, -6), true);
  assert.equal(navigation.pointInAnyBuilding(12.25, -6), false);
});

test('runtime obstacles are added incrementally across negative grid cells', () => {
  const navigation = createRoadNavigationSystem({
    roadCoords: [-12, -6, 0, 6, 12],
    echoObservatoryArea: { roadNodes: [], roadSegments: [] },
    cityLimit: 42,
    getBuildings: () => [],
  });
  navigation.cacheBuildingBoxes();
  const obstacle = new THREE.Group();
  obstacle.position.set(-6, 0, -6);
  obstacle.add(new THREE.Mesh(new THREE.BoxGeometry(3, 3, 3)));
  navigation.registerObstacleGroup(obstacle);

  assert.equal(navigation.pointInAnyBuilding(-6, -6), true);
  assert.equal(navigation.pointInAnyBuilding(-3.9, -6), false);
  const start = new THREE.Vector3(-10, 0, -6);
  assert.deepEqual(navigation.resolveMovement(start, new THREE.Vector3(-2, 0, -6)).toArray(), start.toArray());
});

test('manual movement can reuse a caller-owned result vector', () => {
  const navigation = navigationWithBuilding();
  const output = new THREE.Vector3();
  const result = navigation.resolveMovement(
    new THREE.Vector3(5, 0, -10),
    new THREE.Vector3(5.5, 0, -9.5),
    output,
  );
  assert.equal(result, output);
  assert.deepEqual(output.toArray(), [5.5, 0, -9.5]);
});

test('manual movement result may alias the source vector', () => {
  const navigation = navigationWithBuilding();
  const position = new THREE.Vector3(5, 0, -10);
  const result = navigation.resolveMovement(position, new THREE.Vector3(5.5, 0, -9.5), position);
  assert.equal(result, position);
  assert.deepEqual(position.toArray(), [5.5, 0, -9.5]);
});
