#!/usr/bin/env python3
import base64
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
RESPONSE_DIR = ROOT / '.texture-responses'
OUTPUT_DIR = ROOT / 'apps/web/src/assets/textures'

ATLASES = {
    'residence_clear': [
        'residence_cream', 'residence_bluepanel', 'residence_beigeplaster', 'residence_whitebrick',
        'residence_redbrick', 'residence_darktimber', 'residence_mossplaster', 'residence_palestone',
        'residence_terracotta_roof', 'residence_slate_roof', 'residence_green_roof', 'residence_darkwood_shingles',
        'residence_cedar_porch', 'residence_clapboard', 'residence_concrete_balcony', 'residence_blueglass',
    ],
    'residence_rain': [
        'residence_cream_wet', 'residence_bluepanel_wet', 'residence_beigeplaster_wet', 'residence_whitebrick_wet',
        'residence_redbrick_wet', 'residence_darktimber_wet', 'residence_mossplaster_wet', 'residence_palestone_wet',
        'residence_terracotta_roof_wet', 'residence_slate_roof_wet', 'residence_green_roof_wet', 'residence_darkwood_shingles_wet',
        'residence_cedar_porch_wet', 'residence_clapboard_wet', 'residence_concrete_balcony_wet', 'residence_blueglass_wet',
    ],
    'residence_snow': [
        'residence_cream_snow', 'residence_bluepanel_snow', 'residence_beigeplaster_snow', 'residence_whitebrick_snow',
        'residence_redbrick_snow', 'residence_darktimber_snow', 'residence_mossplaster_snow', 'residence_palestone_snow',
        'residence_terracotta_roof_snow', 'residence_slate_roof_snow', 'residence_green_roof_snow', 'residence_darkwood_shingles_snow',
        'residence_cedar_porch_snow', 'residence_clapboard_snow', 'residence_concrete_balcony_snow', 'residence_blueglass_snow',
    ],
    'roads_weather': [
        'road_asphalt_charcoal', 'road_asphalt_fine', 'road_asphalt_aggregate', 'road_asphalt_worn',
        'road_concrete_paver', 'road_sidewalk_gray', 'road_cobblestone_light', 'road_cobblestone_dark',
        'road_brick_red', 'road_stone_beige', 'road_moss_paving', 'road_plaza_tile',
        'road_asphalt_wet', 'road_concrete_wet', 'road_snow_fresh', 'road_snow_compact',
    ],
}


def decode_atlas(name: str) -> Image.Image:
    payload = json.loads((RESPONSE_DIR / f'{name}.json').read_text())
    return Image.open(__import__('io').BytesIO(base64.b64decode(payload['data'][0]['b64_json']))).convert('RGB')


for atlas_name, names in ATLASES.items():
    image = decode_atlas(atlas_name)
    width, height = image.size
    for index, texture_name in enumerate(names):
        row, column = divmod(index, 4)
        left = column * width // 4
        top = row * height // 4
        right = (column + 1) * width // 4
        bottom = (row + 1) * height // 4
        cell = image.crop((left, top, right, bottom)).resize((1024, 1024), Image.Resampling.LANCZOS)
        cell.save(OUTPUT_DIR / f'{texture_name}_color.png', optimize=True)
    print(f'{atlas_name}: {image.size[0]}x{image.size[1]} -> {len(names)} textures')
