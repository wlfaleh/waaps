# Statistiques d un modele glTF/GLB : triangles, extensions, credit (asset.extras), noms de roues.
# usage : python3 -I inspect.py fichier.glb [autres...]
import json,struct,sys,base64,os
def load(p):
    b=open(p,'rb').read()
    if p.endswith('.b64.txt'): b=base64.b64decode(b)
    if b[:4]==b'glTF':
        l=struct.unpack('<I',b[12:16])[0]; return json.loads(b[20:20+l]), len(b)
    return json.loads(b), len(b)
for p in sys.argv[1:]:
    j,n=load(p)
    tris=0
    for m in j.get('meshes',[]):
        for pr in m['primitives']:
            if 'indices' in pr: tris+=j['accessors'][pr['indices']]['count']//3
            else: tris+=j['accessors'][pr['attributes']['POSITION']]['count']//3
    names=[x.get('name','') for x in j.get('nodes',[])]
    print(p, 'bytes',n,'tris',tris,'meshes',len(j.get('meshes',[])),'mats',len(j.get('materials',[])),'imgs',len(j.get('images',[])))
    print('  ext used',j.get('extensionsUsed'),'req',j.get('extensionsRequired'))
    print('  asset',json.dumps(j.get('asset'))[:400])
    print('  wheel-ish nodes',[x for x in names if any(k in x.lower() for k in ('wheel','tire','tyre','rim'))][:12])
