import { createCommunityPanelController } from '../adapters/ui/communityPanelController';
import { createWriterCatalogController } from '../adapters/ui/writerCatalogController';
import { createNewsstandController } from '../adapters/ui/newsstandController';
import { createAcademyController } from '../adapters/ui/academyController';
import { showUnlockToast } from './toast';

export function createCityHudPanels(document: Document, signal: AbortSignal, setPhoneOpen: (open: boolean) => void) {
  return {
    communityPanels: createCommunityPanelController({ setPhoneOpen, showUnlockToast }),
    writerCatalog: createWriterCatalogController({ document }),
    newsstand: createNewsstandController({ document, signal }),
    academy: createAcademyController(document),
  };
}

export type CityHudPanels = ReturnType<typeof createCityHudPanels>;
