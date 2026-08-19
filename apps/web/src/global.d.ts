import type { MiniCityDebugApi } from './city/debugApi';

declare global {
  interface Window {
    __mini?: MiniCityDebugApi;
    destroyBuilding?: (buildingId: string) => boolean;
    destroyResidence?: (residenceId: string) => boolean;
    destroyAll?: () => number;
    restoreBuilding?: (buildingId: string) => boolean;
    restoreResidence?: (residenceId: string) => boolean;
    restoreAll?: () => number;
    playInvasionCG?: () => boolean;
    stopInvasionCG?: () => void;
  }
}

export {};
