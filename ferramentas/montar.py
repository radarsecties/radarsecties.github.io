"""Monta o Radar SECTIES a partir do modelo e das edições em /edicoes.

Uso (na raiz do repositório):  python3 ferramentas/montar.py

Gera:
- index.html   página com as 14 edições mais recentes
- capa.png     imagem de prévia do link (WhatsApp), refeita a cada edição com a manchete do dia
- whatsapp.txt texto institucional pronto para colar no WhatsApp (edição mais recente)
"""
import json, glob, os, html, re, datetime

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
SITE = "https://radarsecties.github.io/"
DIAS = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"]
MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]
RANK = {"alta": 0, "media": 1, "radar": 2}
ESFERA = {"Paraíba": "Paraíba", "Nacional": "Brasil", "Global": "Mundo"}


def data_longa(s):
    d = datetime.date.fromisoformat(s)
    return f"{DIAS[d.weekday()]}, {d.day} de {MESES[d.month - 1]} de {d.year}"


def primeira_frase(t, maximo=230):
    t = (t or "").strip()
    m = re.search(r"^(.+?[.!?])(\s|$)", t)
    if m and len(m.group(1)) <= maximo:
        return m.group(1)
    return t if len(t) <= maximo else t[: maximo - 1].rsplit(" ", 1)[0] + "…"


def curiosidade_do_dia(data, banco):
    if not banco:
        return None
    d = datetime.date.fromisoformat(data)
    return banco[(d.timetuple().tm_yday + d.year) % len(banco)]


def texto_whatsapp(ed):
    """Mensagem institucional: sóbria, sem propostas, sem avaliações internas, sem emojis, até 1.300 caracteres."""
    its = sorted(ed.get("itens") or [], key=lambda i: RANK.get(i.get("relevancia"), 3))
    altas = [i for i in its if i.get("relevancia") == "alta"]
    atos = (ed.get("doe") or {}).get("atos") or []
    cur = ed.get("curiosidade") or {}
    n_pautas = len(ed.get("secom") or [])

    def montar(n_prior, com_tambem, com_lide, com_fisica):
        L = ["*RADAR SECTIES*  |  Edição nº " + str(ed.get("numero", "")),
             "_" + data_longa(ed["data"]) + "_",
             "Clipping diário da Secretaria de Estado da Ciência, Tecnologia, Inovação e Ensino Superior da Paraíba",
             "",
             "*" + (ed.get("destaque") or "").upper() + "*"]
        if com_lide and ed.get("leitura"):
            L.append(primeira_frase(ed["leitura"]))
        prior = (altas or its)[:n_prior]
        if prior:
            L += ["", "*PRIORIDADES DO DIA*"]
            L += [f"{k}. {i['titulo']} — _{i.get('fonte', '')}_" for k, i in enumerate(prior, 1)]
        if com_tambem:
            usados = {i["id"] for i in prior}
            extra = []
            for esc in ("Paraíba", "Nacional", "Global"):
                c = next((i for i in its if i.get("escopo") == esc and i["id"] not in usados), None)
                if c:
                    extra.append(f"• {ESFERA[esc]}: {c['titulo']}")
            if extra:
                L += ["", "*TAMBÉM NESTA EDIÇÃO*"] + extra
        if atos:
            L += ["", "*DIÁRIO OFICIAL DO ESTADO*"]
            L += [f"• {a.get('tipo', 'Ato')} — {primeira_frase(a.get('resumo'), 110)}" for a in atos[:2]]
        if com_fisica and cur.get("texto"):
            L += ["", "*FÍSICA DE BOLSO*", "_" + cur["texto"] + "_"]
        partes = [f"{len(its)} notícias"]
        if atos:
            partes.append("Diário Oficial")
        if n_pautas:
            partes.append("pautas da SECTIES e da FAPESQ")
        L += ["", "Leia a edição completa, com " + ", ".join(partes[:-1]) + (" e " if len(partes) > 1 else "") + partes[-1] + ":", SITE]
        return "\n".join(L)

    for args in [(4, True, True, True), (4, False, True, True), (3, False, True, True), (3, False, False, True),
                 (3, False, False, False), (2, False, False, False)]:
        t = montar(*args)
        if len(t) <= 1300:
            return t
    return t


def gerar_capa(ed, destino):
    """Imagem 1200x630 da prévia do link, com a manchete do dia."""
    try:
        from PIL import Image, ImageDraw, ImageFont, ImageFilter
    except Exception as e:
        print("Pillow indisponível; capa.png mantida:", e)
        return False
    F = lambda w, s: ImageFont.truetype(os.path.join(AQUI, "fontes", f"Arimo-{w}.ttf"), s)
    W, H = 1200, 630
    PRETO, VERM, CINZA, LINHA = (20, 20, 24), (179, 36, 45), (105, 105, 110), (226, 226, 222)
    img = Image.new("RGB", (W, H), (255, 255, 255))
    d = ImageDraw.Draw(img)

    # filete da bandeira
    d.rectangle([0, 0, W // 3, 9], fill=PRETO)
    d.rectangle([W // 3, 0, W, 9], fill=VERM)

    # marcas: SECTIES | FAPESQ
    x0, y0 = 64, 46
    sec = Image.open(os.path.join(AQUI, "marca-secties.png")).convert("RGBA")
    sec = sec.resize((round(sec.width * 50 / sec.height), 50), Image.LANCZOS)
    img.paste(sec, (x0, y0), sec)
    fap = Image.open(os.path.join(RAIZ, "fapesq.png")).convert("RGBA")
    fap = fap.resize((round(fap.width * 42 / fap.height), 42), Image.LANCZOS)
    xd = x0 + sec.width + 26
    d.line([(xd, y0 + 2), (xd, y0 + 48)], fill=LINHA, width=2)
    img.paste(fap, (xd + 26, y0 + 4), fap)

    # painel da direita: átomo com o secretário (Física de bolso)
    cx, cy, R = 985, 330, 112
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([cx - 210, cy - 210, cx + 210, cy + 210], fill=(179, 36, 45, 70))
    glow = glow.filter(ImageFilter.GaussianBlur(70))
    img.paste(glow, (0, 0), glow)
    d = ImageDraw.Draw(img)
    orb = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(orb)
    for ang in (0, 60, 120):
        e = Image.new("RGBA", (1320, 1320), (0, 0, 0, 0))
        ImageDraw.Draw(e).ellipse([30, 480, 1290, 840], outline=(70, 70, 76, 170), width=5)
        e = e.rotate(ang, resample=Image.BICUBIC).resize((440, 440), Image.LANCZOS)
        orb.paste(e, (cx - 220, cy - 220), e)
    import math
    for ang, t, cor, r in ((0, 0.3, VERM, 9), (60, 2.2, PRETO, 7), (120, 4.0, VERM, 7)):
        ex, ey = 210 * math.cos(t), 60 * math.sin(t)
        a = math.radians(-ang)
        px, py = cx + ex * math.cos(a) - ey * math.sin(a), cy + ex * math.sin(a) + ey * math.cos(a)
        od.ellipse([px - r, py - r, px + r, py + r], fill=cor + (255,))
    img.paste(orb, (0, 0), orb)
    d = ImageDraw.Draw(img)
    foto = Image.open(os.path.join(AQUI, "secretario.jpg")).convert("RGB").resize((2 * R, 2 * R), Image.LANCZOS)
    mask = Image.new("L", (2 * R * 4, 2 * R * 4), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, 2 * R * 4 - 1, 2 * R * 4 - 1], fill=255)
    mask = mask.resize((2 * R, 2 * R), Image.LANCZOS)
    d.ellipse([cx - R - 6, cy - R - 6, cx + R + 6, cy + R + 6], fill=(255, 255, 255))
    d.ellipse([cx - R - 7, cy - R - 7, cx + R + 7, cy + R + 7], outline=LINHA, width=1)
    img.paste(foto, (cx - R, cy - R), mask)
    lab = "FÍSICA DE BOLSO"
    f_lab = F(700, 19)
    lw = d.textlength(lab, font=f_lab) + 4 * len(lab)
    xx = cx - lw / 2
    for ch in lab:
        d.text((xx, cy + R + 52), ch, font=f_lab, fill=VERM)
        xx += d.textlength(ch, font=f_lab) + 4
    sub = "a curiosidade do dia"
    f_sub = F(400, 19)
    d.text((cx - d.textlength(sub, font=f_sub) / 2, cy + R + 80), sub, font=f_sub, fill=CINZA)

    # texto principal
    tx, larg = 64, 690
    def espaçado(x, y, txt, fonte, cor, esp):
        for ch in txt:
            d.text((x, y), ch, font=fonte, fill=cor)
            x += d.textlength(ch, font=fonte) + esp
        return x
    f_k = F(700, 22)
    xe = espaçado(tx, 150, "RADAR SECTIES", f_k, VERM, 4)
    espaçado(xe + 14, 150, "·  EDIÇÃO Nº " + str(ed.get("numero", "")) + "  ·  " + datetime.date.fromisoformat(ed["data"]).strftime("%d/%m/%Y"), F(400, 22), CINZA, 2)

    manchete = ed.get("destaque") or "Clipping diário de ciência, tecnologia, inovação e ensino superior"
    for tam in (66, 62, 58, 54, 50, 46):
        fm = F(700, tam)
        linhas, atual = [], ""
        for p in manchete.split():
            prova = (atual + " " + p).strip()
            if d.textlength(prova, font=fm) <= larg:
                atual = prova
            else:
                linhas.append(atual)
                atual = p
        linhas.append(atual)
        if len(linhas) <= 3:
            break
    y = 196
    for ln in linhas:
        d.text((tx, y), ln, font=fm, fill=PRETO)
        y += int(tam * 1.13)
    y += 18
    d.rectangle([tx, y, tx + 90, y + 6], fill=VERM)
    y += 26
    its = ed.get("itens") or []
    altas = sum(1 for i in its if i.get("relevancia") == "alta")
    atos = len((ed.get("doe") or {}).get("atos") or [])
    resumo = f"{len(its)} notícias  ·  {altas} prioridades  ·  {atos} {'ato' if atos == 1 else 'atos'} no Diário Oficial"
    d.text((tx, y), resumo, font=F(400, 25), fill=CINZA)

    # faixa inferior
    d.rectangle([0, H - 66, W, H], fill=PRETO)
    d.text((tx, H - 48), "radarsecties.github.io", font=F(700, 26), fill=(255, 255, 255))
    rod = "Leia a edição completa"
    fr = F(700, 22)
    xr = W - 64 - 34 - d.textlength(rod, font=fr)
    d.text((xr, H - 45), rod, font=fr, fill=(255, 140, 146))
    ax, ay = W - 64 - 20, H - 33
    d.line([(ax - 8, ay), (ax + 12, ay)], fill=(255, 140, 146), width=3)
    d.line([(ax + 4, ay - 7), (ax + 12, ay), (ax + 4, ay + 7)], fill=(255, 140, 146), width=3, joint="curve")

    img.save(destino, optimize=True)
    return True


def main():
    eds = []
    for f in glob.glob(os.path.join(RAIZ, "edicoes", "*.json")):
        with open(f, encoding="utf-8") as fh:
            e = json.load(fh)
        if isinstance(e, dict) and isinstance(e.get("data"), str):
            eds.append(e)
    eds = sorted(eds, key=lambda e: e["data"], reverse=True)[:14]
    assert eds, "nenhuma edição em /edicoes"

    banco_p = os.path.join(AQUI, "curiosidades.json")
    banco = json.load(open(banco_p, encoding="utf-8")) if os.path.exists(banco_p) else []
    for e in eds:
        if not (isinstance(e.get("curiosidade"), dict) and e["curiosidade"].get("texto")):
            c = curiosidade_do_dia(e["data"], banco)
            if c:
                e["curiosidade"] = c
        e["whatsapp"] = texto_whatsapp(e)

    modelo = open(os.path.join(AQUI, "modelo.html"), encoding="utf-8").read()
    assert "<!--DADOS-->" in modelo
    js = lambda o: json.dumps(o, ensure_ascii=False).replace("</", "<\\/")
    inj = "<script>window.__RADAR_DADOS__=" + js(eds) + ";window.__RADAR_CURIOSIDADES__=" + js(banco) + ";</script>"
    corpo = modelo.replace("<!--DADOS-->", inj, 1)
    corpo = re.sub(r"<title>.*?</title>", "", corpo, count=1, flags=re.S)

    d = eds[0]
    y, m, dd = d["data"].split("-")
    titulo = "Radar SECTIES — " + dd + "/" + m + "/" + y
    desc = html.escape(d.get("destaque") or "Clipping diário de ciência, tecnologia, inovação e ensino superior da SECTIES-PB", quote=True)
    versao = y + m + dd
    head = ('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
            '<title>Radar SECTIES</title>'
            '<meta name="description" content="' + desc + '">'
            '<meta name="theme-color" content="#FFFFFF">'
            '<meta property="og:type" content="website">'
            '<meta property="og:site_name" content="Radar SECTIES">'
            '<meta property="og:title" content="' + html.escape(titulo, quote=True) + '">'
            '<meta property="og:description" content="' + desc + '">'
            '<meta property="og:url" content="' + SITE + '">'
            '<meta property="og:image" content="' + SITE + 'capa.png?v=' + versao + '">'
            '<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">'
            '<meta name="twitter:card" content="summary_large_image">'
            '<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}'
            'body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>'
            '</head><body>')
    with open(os.path.join(RAIZ, "index.html"), "w", encoding="utf-8") as fh:
        fh.write(head + corpo + "</body></html>")
    capa = gerar_capa(d, os.path.join(RAIZ, "capa.png"))
    with open(os.path.join(RAIZ, "whatsapp.txt"), "w", encoding="utf-8") as fh:
        fh.write(d["whatsapp"] + "\n")
    print("index.html montado com", len(eds), "edição(ões); mais recente:", d["data"])
    print("capa.png", "gerada" if capa else "mantida", "| whatsapp.txt com", len(d["whatsapp"]), "caracteres")


if __name__ == "__main__":
    main()
