import type * as THREE from 'three';
import { ResourcePool } from '../core/ResourcePool';
import { readRenderSettings } from '../rendering/createRenderer';
import { createProceduralTextureLibrary } from '../rendering/proceduralTextureLibrary';
import { createBuildingMeshFactory } from '../rendering/buildingMeshFactory';
import { createMeshHelpers } from '../rendering/meshFactory';
import { BUILDING_PLATFORM_HEIGHT, PALETTE } from './data/cityConfig';
import { createWeatherController } from './weatherController';
import type { Weather } from './weather';

type WeatherVisual = { set: (weather: Weather) => void };

export function createCityGraphics(
  resources: ResourcePool,
  getRenderer: () => THREE.WebGLRenderer,
) {
  let weatherVisual: WeatherVisual | null = null;
  let refreshLooks = () => {};

  const weather = createWeatherController({
    apply: (next, changed) => {
      document.body.dataset.weather = next;
      weatherVisual?.set(next);
      if (!changed) return;
      refreshLooks();
    },
  });

  const textures = createProceduralTextureLibrary(
    resources,
    getRenderer,
    () => readRenderSettings().anisotropy,
    () => weather.get(),
    () => readRenderSettings().textureRendering,
  );
  const mesh = createMeshHelpers(resources, textures.repeat, () => weather.get());
  const buildingMeshes = createBuildingMeshFactory({
    palette: PALETTE,
    platformHeight: BUILDING_PLATFORM_HEIGHT,
    makeMaterial: mesh.stdMat,
    makeMesh: mesh.mk,
    addPart: mesh.part,
  });

  refreshLooks = () => {
    mesh.refreshWeather();
    textures.refreshWeather();
  };

  return {
    palette: PALETTE,
    weather,
    textures,
    mesh,
    buildingBuilders: buildingMeshes.builders,
    setWeatherVisual(visual: WeatherVisual | null) {
      weatherVisual = visual;
    },
    refreshWeatherLooks() {
      refreshLooks();
      weatherVisual?.set(weather.get());
    },
  };
}

export type CityGraphics = ReturnType<typeof createCityGraphics>;
