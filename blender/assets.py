# Downloads the scanned materials and props the zones use, from Poly Haven
# (https://polyhaven.com, every asset CC0 / public domain), into blender/cache/.
# lib.py calls fetch_texture() / fetch_model() on demand, so a build only
# downloads what it uses; the cache is not committed.

import json
import os
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, 'cache')
UA = {'User-Agent': 'dhr-vn-warehouse-build/1.0 (+https://dhr.vn)'}
API = 'https://api.polyhaven.com'


def _get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
        return r.read()


def _save(url, path):
    if os.path.exists(path):
        return path
    os.makedirs(os.path.dirname(path), exist_ok=True)
    data = _get(url)
    with open(path + '.part', 'wb') as f:
        f.write(data)
    os.replace(path + '.part', path)
    return path


def _files(asset):
    path = os.path.join(CACHE, asset, 'files.json')
    if not os.path.exists(path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'wb') as f:
            f.write(_get(f'{API}/files/{asset}'))
    with open(path) as f:
        return json.load(f)


def fetch_texture(asset, res='1k'):
    """→ {'diff': path, 'nor': path, 'rough': path} (missing maps are left out)."""
    files = _files(asset)
    out = {}
    # some sets ship colour variants (col_1, col_2 ...) instead of one Diffuse
    colour = 'Diffuse' if 'Diffuse' in files else sorted(k for k in files if k.startswith('col'))[0]
    for key, name in ((colour, 'diff'), ('nor_gl', 'nor'), ('Rough', 'rough'), ('Metal', 'metal')):
        if key in files and res in files[key]:
            fmt = 'jpg' if 'jpg' in files[key][res] else 'png'
            url = files[key][res][fmt]['url']
            out[name] = _save(url, os.path.join(CACHE, asset, os.path.basename(url)))
    return out


def fetch_model(asset, res='1k'):
    """→ path of the model's .gltf (its .bin and textures beside it)."""
    g = _files(asset)['gltf'][res]['gltf']
    base = os.path.join(CACHE, asset, res)
    path = _save(g['url'], os.path.join(base, os.path.basename(g['url'])))
    for rel, inc in g['include'].items():
        _save(inc['url'], os.path.join(base, rel))
    return path


if __name__ == '__main__':
    import sys
    for a in sys.argv[1:]:
        print(a, fetch_texture(a) if '--model' not in sys.argv else fetch_model(a))
