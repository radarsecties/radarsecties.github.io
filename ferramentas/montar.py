"""Monta o index.html do Radar SECTIES a partir do modelo e das edições em /edicoes.
Uso: python3 ferramentas/montar.py   (rodar na raiz do repositório)"""
import json, glob, os, html
AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
SITE = "https://radarsecties.github.io/"
eds = []
for f in glob.glob(os.path.join(RAIZ, "edicoes", "*.json")):
    with open(f, encoding="utf-8") as fh:
        e = json.load(fh)
    if isinstance(e, dict) and isinstance(e.get("data"), str):
        eds.append(e)
eds = sorted(eds, key=lambda e: e["data"], reverse=True)[:14]
assert eds, "nenhuma edição em /edicoes"
modelo = open(os.path.join(AQUI, "modelo.html"), encoding="utf-8").read()
assert "<!--DADOS-->" in modelo
inj = "<script>window.__RADAR_DADOS__=" + json.dumps(eds, ensure_ascii=False).replace("</", "<\\/") + ";</script>"
corpo = modelo.replace("<!--DADOS-->", inj, 1)
import re
corpo = re.sub(r"<title>.*?</title>", "", corpo, count=1, flags=re.S)
d = eds[0]
y, m, dd = d["data"].split("-")
titulo = "Radar SECTIES — " + dd + "/" + m + "/" + y
desc = html.escape(d.get("destaque") or "Clipping diário de ciência, tecnologia, inovação e ensino superior da SECTIES-PB", quote=True)
head = ('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        '<title>Radar SECTIES</title>'
        '<meta name="description" content="' + desc + '">'
        '<meta property="og:type" content="website">'
        '<meta property="og:site_name" content="Radar SECTIES">'
        '<meta property="og:title" content="' + html.escape(titulo, quote=True) + '">'
        '<meta property="og:description" content="' + desc + '">'
        '<meta property="og:url" content="' + SITE + '">'
        '<meta property="og:image" content="' + SITE + 'capa.png?v=2">'
        '<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">'
        '<meta name="twitter:card" content="summary_large_image">'
        '<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}'
        'body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>'
        '</head><body>')
with open(os.path.join(RAIZ, "index.html"), "w", encoding="utf-8") as fh:
    fh.write(head + corpo + "</body></html>")
print("index.html montado com", len(eds), "edição(ões); mais recente:", d["data"])
