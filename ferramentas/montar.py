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
    """Imagem 1200x630 da prévia do link: fundo branco, marcas, manchete do dia e o radar como símbolo."""
    try:
        from PIL import Image, ImageDraw, ImageFont
    except Exception as e:
        print("Pillow indisponível; capa.png mantida:", e)
        return False
    import math
    F = lambda w, s: ImageFont.truetype(os.path.join(AQUI, "fontes", f"Arimo-{w}.ttf"), s)
    W, H, K = 1200, 630, 2  # desenha em 2x e reduz, para bordas suaves
    PRETO, VERM, CINZA, LINHA = (22, 22, 26), (179, 36, 45), (110, 110, 114), (228, 228, 224)
    img = Image.new("RGB", (W * K, H * K), (255, 255, 255))
    d = ImageDraw.Draw(img)
    k = lambda v: int(round(v * K))

    # filete da bandeira (1/3 preto, 2/3 vermelho)
    d.rectangle([0, 0, k(W / 3), k(10)], fill=PRETO)
    d.rectangle([k(W / 3), 0, k(W), k(10)], fill=VERM)

    # radar à direita (símbolo do Radar SECTIES)
    cx, cy, R = 966, 330, 172
    for f in (1.0, .68, .36):
        d.ellipse([k(cx - R * f), k(cy - R * f), k(cx + R * f), k(cy + R * f)], outline=LINHA, width=k(1.5))
    for ang in range(0, 180, 45):
        a = math.radians(ang)
        d.line([(k(cx - R * math.cos(a)), k(cy - R * math.sin(a))), (k(cx + R * math.cos(a)), k(cy + R * math.sin(a)))], fill=LINHA, width=k(1.5))
    cunha = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(cunha).pieslice([k(cx - R), k(cy - R), k(cx + R), k(cy + R)], -42, 0, fill=VERM + (34,))
    img.paste(cunha, (0, 0), cunha)
    d = ImageDraw.Draw(img)
    d.line([(k(cx), k(cy)), (k(cx + R), k(cy))], fill=VERM, width=k(2))
    its = ed.get("itens") or []
    rnd = __import__("random").Random(ed.get("data"))
    for i in its[:14]:
        alta = i.get("relevancia") == "alta"
        r = R * (rnd.uniform(.12, .36) if alta else rnd.uniform(.42, .92))
        a = rnd.uniform(0, 2 * math.pi)
        x, y = cx + r * math.cos(a), cy + r * math.sin(a)
        rr = 9 if alta else 6
        cor = VERM if alta else ((60, 60, 64) if i.get("relevancia") == "media" else (190, 190, 186))
        d.ellipse([k(x - rr), k(y - rr), k(x + rr), k(y + rr)], fill=cor)
    d.ellipse([k(cx - 4), k(cy - 4), k(cx + 4), k(cy + 4)], fill=PRETO)

    # marcas: SECTIES | FAPESQ
    x0, y0 = 64, 48
    sec = Image.open(os.path.join(AQUI, "marca-secties.png")).convert("RGBA")
    sec = sec.resize((k(sec.width * 50 / sec.height), k(50)), Image.LANCZOS)
    img.paste(sec, (k(x0), k(y0)), sec)
    fap = Image.open(os.path.join(RAIZ, "fapesq.png")).convert("RGBA")
    fap = fap.resize((k(fap.width * 42 / fap.height), k(42)), Image.LANCZOS)
    xd = x0 + sec.width / K + 26
    d.line([(k(xd), k(y0 + 2)), (k(xd), k(y0 + 48))], fill=LINHA, width=k(1.5))
    img.paste(fap, (k(xd + 26), k(y0 + 4)), fap)

    def espacado(x, y, txt, fonte, cor, esp):
        for ch in txt:
            d.text((k(x), k(y)), ch, font=fonte, fill=cor)
            x += d.textlength(ch, font=fonte) / K + esp
        return x

    tx, larg = 64, 660
    xe = espacado(tx, 156, "RADAR SECTIES", F(700, k(22)), VERM, 4)
    data_br = datetime.date.fromisoformat(ed["data"]).strftime("%d/%m/%Y")
    espacado(xe + 14, 156, "·  EDIÇÃO Nº " + str(ed.get("numero", "")) + "  ·  " + data_br, F(400, k(22)), CINZA, 2)

    manchete = ed.get("destaque") or "Clipping diário de ciência, tecnologia, inovação e ensino superior"
    for tam in (64, 60, 56, 52, 48, 44):
        fm = F(700, k(tam))
        linhas, atual = [], ""
        for pal in manchete.split():
            prova = (atual + " " + pal).strip()
            if d.textlength(prova, font=fm) / K <= larg:
                atual = prova
            else:
                linhas.append(atual)
                atual = pal
        linhas.append(atual)
        if len(linhas) <= 3:
            break
    y = 202
    for ln in linhas:
        d.text((k(tx), k(y)), ln, font=fm, fill=PRETO)
        y += tam * 1.14
    y += 20
    d.rectangle([k(tx), k(y), k(tx + 90), k(y + 6)], fill=VERM)
    y += 28
    altas = sum(1 for i in its if i.get("relevancia") == "alta")
    atos = len((ed.get("doe") or {}).get("atos") or [])
    d.text((k(tx), k(y)), f"{len(its)} notícias  ·  {altas} prioridades  ·  {atos} {'ato' if atos == 1 else 'atos'} no Diário Oficial", font=F(400, k(24)), fill=CINZA)

    # rodapé leve, sem faixa
    d.line([(k(tx), k(H - 74)), (k(W - 64), k(H - 74))], fill=LINHA, width=k(1.5))
    xs = espacado(tx, H - 54, "radarsecties.github.io", F(700, k(24)), VERM, 0)
    d.text((k(xs + 16), k(H - 52)), "Leia a edição completa, todos os dias", font=F(400, k(22)), fill=CINZA)

    img = img.resize((W, H), Image.LANCZOS)
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
