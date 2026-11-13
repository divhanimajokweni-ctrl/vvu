# OpenStreetMap Footprint Export & Attribution Workflow

This document outlines the extraction workflow, Overpass queries, GeoJSON properties, and attribution compliance for importing building footprints into 3D digital twin engines.

---

## 1. Overpass Turbo Queries (Spatial Bounding Boxes)

### A. Central Port Elizabeth (Bird Street Campus Precinct)
```overpass
/* Overpass Turbo Query - Central Port Elizabeth Footprints */
[out:json][timeout:30];
(
  node["building"](-33.970, 25.610, -33.960, 25.625);
  way["building"](-33.970, 25.610, -33.960, 25.625);
  relation["building"](-33.970, 25.610, -33.960, 25.625);
);
out body;
>;
out skel qt;
```

### B. Struandale Industrial Precinct
```overpass
/* Overpass Turbo Query - Struandale Industrial Footprints */
[out:json][timeout:30];
(
  node["building"](-33.905, 25.560, -33.875, 25.595);
  way["building"](-33.905, 25.560, -33.875, 25.595);
  relation["building"](-33.905, 25.560, -33.875, 25.595);
);
out body;
>;
out skel qt;
```

---

## 2. Python Extractor & GeoJSON Converter

```python
import json

def convert_osm_to_geojson(osm_data, output_filename):
    """
    Converts raw OpenStreetMap JSON response into a 3D-ready GeoJSON FeatureCollection
    with standard height properties and ODbL attribution tags.
    """
    nodes = {elem['id']: (elem['lon'], elem['lat']) for elem in osm_data.get('elements', []) if elem['type'] == 'node'}
    
    features = []
    for elem in osm_data.get('elements', []):
        if elem['type'] == 'way' and 'building' in elem.get('tags', {}):
            way_nodes = elem.get('nodes', [])
            coords = [nodes[nid] for nid in way_nodes if nid in nodes]
            
            if len(coords) >= 3:
                if coords[0] != coords[-1]:
                    coords.append(coords[0])
                
                tags = elem.get('tags', {})
                height = float(tags.get('height', 0.0))
                levels = float(tags.get('building:levels', 1.0))
                if height == 0.0:
                    height = levels * 3.2
                
                feature = {
                    "type": "Feature",
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [coords]
                    },
                    "properties": {
                        "osm_id": elem['id'],
                        "building": tags.get('building', 'yes'),
                        "building:levels": levels,
                        "height": round(height, 2),
                        "min_height": float(tags.get('min_height', 0.0)),
                        "name": tags.get('name', '')
                    }
                }
                features.append(feature)
                
    geojson_output = {
        "type": "FeatureCollection",
        "name": "OSM 3D Building Footprints",
        "attribution": "© OpenStreetMap contributors",
        "license": "Open Database License (ODbL 1.0)",
        "features": features
    }
    
    with open(output_filename, 'w', encoding='utf-8') as f:
        json.dump(geojson_output, f, indent=2)
        
    return geojson_output
```

---

## 3. QGIS Export Steps

1. **Download OSM Data**: Use QGIS QuickOSM plugin or `Vector -> OpenStreetMap -> Download Data`.
2. **Filter Layers**: Select `building IS NOT NULL` polygons.
3. **Save as GeoJSON**: Export layer in `EPSG:4326 - WGS 84` coordinate reference system.

---

## 4. Mandatory Licensing & Attribution Notice

All OpenStreetMap exports and derivative vector features require clear attribution under the **Open Database License (ODbL)**:

* **Map & 3D Viewer Display**: Include **© OpenStreetMap contributors** on the canvas or attribution bar.
* **Metadata Tagging**: Ensure `attribution: "© OpenStreetMap contributors"` is preserved in all exported GeoJSON header properties.
