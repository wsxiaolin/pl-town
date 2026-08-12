import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createRoadNavigationSystem } from '../../src/city/navigation/roadNavigation';

function navigationWithBuilding() {
  const group = new THREE.Group();
  group.position.set(10, 0, -6);
  group.add(new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4)));
  const navigation = createRoadNavigationSystem({
    roadCoords: [-6, 0, 6, 12],
    satelliteCity: { roadNodes: [], roadSegments: [] },
    echoObservatoryArea: { roadNodes: [], roadSegments: [] },
    cityLimit: 42,
    getBuildings: () => [{ group }],
  });
  navigation.cacheBuildingBoxes();
  return navigation;
}

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
