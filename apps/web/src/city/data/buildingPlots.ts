export type BuildingPlotSpec = { tex: string; size: number; color: number };

export const BUILDING_PLOT_MAP: Record<string, BuildingPlotSpec> = {
  bank:{tex:'ground5',size:4.5,color:0xE8E7E4}, board:{tex:'ground5',size:3.0,color:0xE4E3E0},
  tower:{tex:'ground5',size:4.0,color:0xD8D7D2}, darktower:{tex:'ground6',size:4.0,color:0x9A988E},
  pavilion:{tex:'ground4',size:4.5,color:0xC0D0A0}, library:{tex:'ground5',size:4.0,color:0xE8E7E4},
  ruins:{tex:'ground2',size:3.5,color:0xE0D8CC}, skyscraper:{tex:'ground5',size:3.5,color:0xD8D7D2},
  campus:{tex:'ground5',size:4.5,color:0xE8E7E4}, kiosk:{tex:'ground5',size:3.0,color:0xE4E3E0},
  screen:{tex:'ground5',size:4.0,color:0xD8D7D2}, shaft:{tex:'ground5',size:3.0,color:0xD8D7D2},
  altar:{tex:'ground5',size:3.5,color:0xE4E3E0}, observatory:{tex:'ground5',size:4.0,color:0xE8E7E4},
  pagoda:{tex:'ground4',size:4.0,color:0xC0D0A0}, market:{tex:'ground5',size:4.5,color:0xE4E3E0},
  greenhouse:{tex:'ground4',size:4.0,color:0xB8C888}, clocktower:{tex:'ground5',size:4.0,color:0xE4E3E0},
  temple:{tex:'ground5',size:4.5,color:0xF0EFEC}, factory:{tex:'ground2',size:5.0,color:0xC8C4B8},
  mall:{tex:'ground5',size:5.5,color:0xD8D7D2}, school:{tex:'ground4',size:4.5,color:0xB8C888},
  crown:{tex:'ground5',size:4.5,color:0xF0EFEC}, banana:{tex:'ground2',size:6.0,color:0xE0D8A0},
  qipai:{tex:'ground5',size:8.0,color:0xE4E3E0},
};
