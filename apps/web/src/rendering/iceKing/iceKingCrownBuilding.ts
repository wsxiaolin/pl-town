import * as THREE from 'three';
import type { BuildingDefinition, BuildingEntity } from '../../city/buildingEntity';
import type { MeshHelpers } from '../meshFactory';

export function buildIceKingCrownBuilding(
  cfg: BuildingDefinition,
  options: Pick<MeshHelpers, 'stdMat' | 'mk' | 'part'>,
): BuildingEntity {
  const { stdMat, mk, part } = options;
  const group = new THREE.Group();
  const bandBottom = 0.14;
  const bandHeight = 0.66;
  const bandTop = bandBottom + bandHeight;
  const outerBottomRadius = 1.48;
  const outerTopRadius = 1.72;
  const goldMat = stdMat({ color: 0xe8ad32, roughness: 0.2, metalness: 0.72 });
  const innerGoldMat = stdMat({ color: 0x9f6818, roughness: 0.28, metalness: 0.62, side: THREE.BackSide });
  const liningMat = stdMat({ color: 0xa8e1e7, roughness: 0.3, metalness: 0.12, side: THREE.DoubleSide });
  const bodyMat = stdMat({ color: 0xd99522, roughness: 0.2, metalness: 0.7, side: THREE.DoubleSide });
  bodyMat.emissive = new THREE.Color(0x7d510f);
  bodyMat.emissiveIntensity = 0;

  const body = mk(new THREE.CylinderGeometry(outerTopRadius, outerBottomRadius, bandHeight, 64, 1, true), bodyMat);
  body.position.y = bandBottom + bandHeight / 2;
  body.castShadow = body.receiveShadow = true;
  group.add(body);

  part(group, new THREE.CylinderGeometry(1.57, 1.35, bandHeight - 0.08, 64, 1, true), innerGoldMat, [0, bandBottom + bandHeight / 2, 0]);
  const lining = part(group, new THREE.CircleGeometry(1.34, 48), liningMat, [0, bandBottom + 0.015, 0], false);
  lining.rotation.x = -Math.PI / 2;
  const lowerRim = part(group, new THREE.TorusGeometry(outerBottomRadius, 0.11, 10, 64), goldMat, [0, bandBottom, 0]);
  lowerRim.rotation.x = Math.PI / 2;
  const middleRim = part(group, new THREE.TorusGeometry(1.59, 0.045, 8, 64), goldMat, [0, bandBottom + bandHeight * 0.48, 0]);
  middleRim.rotation.x = Math.PI / 2;
  const upperRim = part(group, new THREE.TorusGeometry(outerTopRadius, 0.1, 10, 64), goldMat, [0, bandTop, 0]);
  upperRim.rotation.x = Math.PI / 2;

  const crownPointGeometry = (width: number, height: number): THREE.ExtrudeGeometry => {
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, 0);
    shape.lineTo(-width * 0.43, height * 0.3);
    shape.quadraticCurveTo(-width * 0.2, height * 0.68, 0, height);
    shape.quadraticCurveTo(width * 0.2, height * 0.68, width * 0.43, height * 0.3);
    shape.lineTo(width / 2, 0);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.14,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.035,
      bevelThickness: 0.025,
      curveSegments: 6,
    });
    geometry.translate(0, 0, -0.07);
    return geometry;
  };

  const tallPoint = crownPointGeometry(0.9, 1.68);
  const shortPoint = crownPointGeometry(0.76, 1.18);
  const pointRadius = 1.57;
  const jewelColors = [0x8de5ef, 0x4caec8, 0xcdf8fa, 0x62c8d8, 0x9eeff2, 0x3f9ebd, 0xd8ffff, 0x68cad7];
  for (let index = 0; index < 8; index += 1) {
    const angle = (index / 8) * Math.PI * 2 - Math.PI / 2;
    const tall = index % 2 === 0;
    const pointHeight = tall ? 1.68 : 1.18;
    const x = Math.cos(angle) * pointRadius;
    const z = Math.sin(angle) * pointRadius;
    const point = part(group, tall ? tallPoint : shortPoint, goldMat, [x, bandTop - 0.04, z]);
    point.rotation.y = Math.PI / 2 - angle;
    part(group, new THREE.SphereGeometry(tall ? 0.12 : 0.09, 14, 10), goldMat, [x, bandTop - 0.04 + pointHeight + (tall ? 0.08 : 0.06), z]);

    const settingRadius = 1.64;
    const setting = part(group, new THREE.SphereGeometry(0.21, 16, 12), goldMat, [Math.cos(angle) * settingRadius, bandBottom + bandHeight * 0.48, Math.sin(angle) * settingRadius]);
    setting.scale.set(1, 1, 0.34);
    setting.rotation.y = Math.PI / 2 - angle;
    const jewelRadius = 1.76;
    const jewelColor = jewelColors[index]!;
    const jewel = part(group, new THREE.OctahedronGeometry(0.15, 0), {
      color: jewelColor,
      roughness: 0.08,
      metalness: 0.25,
      emissive: jewelColor,
      emissiveIntensity: 0.24,
    }, [Math.cos(angle) * jewelRadius, bandBottom + bandHeight * 0.48, Math.sin(angle) * jewelRadius], false);
    jewel.scale.set(0.82, 1.18, 0.48);
    jewel.rotation.y = Math.PI / 2 - angle;
  }

  group.position.set(cfg.x, 0, cfg.z);
  group.traverse((object) => {
    if ('isMesh' in object && object.isMesh) object.userData.buildingId = cfg.id;
  });
  return { ...cfg, group, body, bodyMat, labelEl: null, labelY: bandTop + 1.68 + 0.45 };
}
