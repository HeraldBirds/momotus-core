"""Genera derivados web de portadas e iconos; conserva originales y recursos DTF."""
from pathlib import Path
import re,json
from PIL import Image,ImageChops,ImageStat
root=Path(__file__).resolve().parents[1]
report=[]
for source in sorted((root/'img/heroes').glob('*.webp')):
    target=source.parent/'web'/source.name
    target.parent.mkdir(exist_ok=True)
    with Image.open(source) as image:
        kwargs={'icc_profile':image.info['icc_profile']} if image.info.get('icc_profile') else {}
        image.save(target,'WEBP',quality=95,method=6,**kwargs)
        with Image.open(target) as result:
            assert result.size==image.size
            difference=ImageStat.Stat(ImageChops.difference(image.convert('RGB'),result.convert('RGB')))
            report.append({'file':source.name,'original':source.stat().st_size,'web':target.stat().st_size,'dimensions':image.size,'mean_rgb_difference':round(sum(difference.mean)/3,3)})
# Conserva todas las reglas generales, fuentes, animaciones y aliases de los iconos usados.
used=set()
for ext in ['*.html','*.js','*.css']:
    for p in root.rglob(ext):
        if any(part in p.parts for part in ['vendor','node_modules','.git','tests','scripts']):continue
        used.update(re.findall(r'\bfa-[a-z0-9-]+',p.read_text()))
source=root/'vendor/fontawesome/css/all.min.css';css=source.read_text()
def subset(match):
    selectors=match.group(1)
    icons=set(re.findall(r'\.((?:fa-)[a-z0-9-]+):before',selectors))
    return match.group(0) if not icons or icons&used else ''
css=re.sub(r'([^{}]+)\{content:"[^"{}]*"\}',subset,css)
(root/'vendor/fontawesome/css/site.min.css').write_text(css)
print(json.dumps({'heroes':report,'icon_css_before':source.stat().st_size,'icon_css_after':len(css.encode()),'icon_classes':len(used)},indent=2))
