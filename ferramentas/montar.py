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
    """Capa 1200x630 da prévia do link: composição editorial limpa.
    Branco, muito respiro, a manchete do dia como protagonista e um único acento vermelho."""
    try:
        from PIL import Image, ImageDraw, ImageFont
    except Exception as e:
        print("Pillow indisponível; capa.png mantida:", e)
        return False
    F = lambda w, s: ImageFont.truetype(os.path.join(AQUI, "fontes", f"Arimo-{w}.ttf"), s)
    W, H, K = 1200, 630, 2
    k = lambda v: int(round(v * K))
    PRETO, VERM, CINZA, LINHA, BRANCO = (17, 17, 20), (179, 36, 45), (118, 118, 122), (226, 226, 222), (255, 255, 255)
    img = Image.new("RGB", (W * K, H * K), BRANCO)
    d = ImageDraw.Draw(img)
    dt = datetime.date.fromisoformat(ed["data"])
    M = 72  # margem

    def texto(x, y, t, fonte, cor, esp=0):
        if not esp:
            d.text((k(x), k(y)), t, font=fonte, fill=cor)
            return x + d.textlength(t, font=fonte) / K
        for ch in t:
            d.text((k(x), k(y)), ch, font=fonte, fill=cor)
            x += d.textlength(ch, font=fonte) / K + esp
        return x

    # filete da bandeira
    d.rectangle([0, 0, k(W / 3), k(8)], fill=PRETO)
    d.rectangle([k(W / 3), 0, k(W), k(8)], fill=VERM)

    # marcas
    sec = Image.open(os.path.join(AQUI, "marca-secties.png")).convert("RGBA")
    sec = sec.resize((k(sec.width * 42 / sec.height), k(42)), Image.LANCZOS)
    img.paste(sec, (k(M), k(56)), sec)
    fap = Image.open(os.path.join(RAIZ, "fapesq.png")).convert("RGBA")
    fap = fap.resize((k(fap.width * 34 / fap.height), k(34)), Image.LANCZOS)
    xd = M + sec.width / K + 22
    d.line([(k(xd), k(58)), (k(xd), k(96))], fill=LINHA, width=k(1.5))
    img.paste(fap, (k(xd + 22), k(60)), fap)

    # edição e data, discretas, à direita
    f_ed = F(700, k(15))
    rot = "EDIÇÃO Nº " + str(ed.get("numero", "")) + "   ·   " + dt.strftime("%d.%m.%Y")
    larg_rot = sum(d.textlength(c, font=f_ed) / K + 2.4 for c in rot)
    texto(W - M - larg_rot, 70, rot, f_ed, CINZA, 2.4)

    # manchete: a protagonista
    manchete = ed.get("destaque") or "Ciência, tecnologia, inovação e ensino superior na Paraíba"
    larg = W - 2 * M
    for tam in (76, 72, 68, 64, 60, 56, 52):
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
    passo = tam * 1.1
    altura = passo * len(linhas)
    y = 170 + (310 - altura) / 2 + 14
    texto(M, y - 44, "HOJE NO RADAR", F(700, k(16)), VERM, 3)
    for ln in linhas:
        texto(M, y, ln, fm, PRETO)
        y += passo

    # rodapé: assinatura e chamada
    yR = H - 104
    d.line([(k(M), k(yR)), (k(W - M), k(yR))], fill=LINHA, width=k(1.5))
    yT = yR + 30
    f_m = F(700, k(30))
    x = texto(M, yT, "Radar ", f_m, PRETO)
    texto(x, yT, "SECTIES", f_m, VERM)
    f_c = F(700, k(22))
    cham = "Leia a edição completa"
    xc = W - M - 40 - d.textlength(cham, font=f_c) / K
    texto(xc, yT + 6, cham, f_c, PRETO)
    ax, ay = W - M - 26, yT + 19
    d.line([(k(ax), k(ay)), (k(ax + 26), k(ay))], fill=VERM, width=k(3))
    d.line([(k(ax + 16), k(ay - 9)), (k(ax + 26), k(ay)), (k(ax + 16), k(ay + 9))], fill=VERM, width=k(3), joint="curve")

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
