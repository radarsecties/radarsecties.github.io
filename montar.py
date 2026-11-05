"""
Montador do Radar SECTIES.

Lê edicoes/*.json (as 14 mais recentes), injeta no modelo e grava em site/:
  index.html    página completa (todas as edições, seletor "Ver outra edição")
  capa.png      imagem de prévia 1200x630 para o WhatsApp
  whatsapp.txt  mensagem institucional pronta para colar (até 1.300 caracteres)
  edicao.json   dados da edição mais recente (para quem quiser reaproveitar)

Uso: python3 -m radar.montar  (na raiz do repositório)
"""

import json
import math
import re
import shutil
from datetime import date, datetime
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from .classificar import PROGRAMAS, TIPOS, classificar

RAIZ = Path(__file__).resolve().parent.parent
PASTA_EDICOES = RAIZ / "edicoes"
PASTA_SITE = RAIZ   # o site é publicado pela raiz do repositório (GitHub Pages)
PASTA_FERR = RAIZ / "ferramentas"
MODELO = Path(__file__).resolve().parent / "modelo.html"
def endereco_do_site() -> str:
    """Usa o domínio próprio quando ele é ligado no GitHub Pages (arquivo CNAME); senão, o endereço padrão."""
    cname = RAIZ / "CNAME"
    if cname.exists():
        dominio = cname.read_text(encoding="utf-8").strip()
        if dominio:
            return f"https://{dominio}/"
    return "https://radarsecties.github.io/"


SITE_URL = endereco_do_site()

CANDIDATOS_FONTE = [
    PASTA_FERR / "fontes" / "Arimo-400.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]
CANDIDATOS_NEGRITO = [
    PASTA_FERR / "fontes" / "Arimo-700.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]


def fonte(tamanho: int, negrito: bool = False) -> ImageFont.FreeTypeFont:
    for c in (CANDIDATOS_NEGRITO if negrito else CANDIDATOS_FONTE):
        if Path(c).exists():
            return ImageFont.truetype(str(c), tamanho)
    return ImageFont.load_default()


# ----------------------------------------------------------------------------
# edições
# ----------------------------------------------------------------------------
def carregar_edicoes(limite: int = 14) -> list[dict]:
    arquivos = sorted(PASTA_EDICOES.glob("????-??-??.json"), reverse=True)[:limite]
    edicoes = []
    for a in arquivos:
        try:
            edicoes.append(json.loads(a.read_text(encoding="utf-8")))
        except json.JSONDecodeError as exc:
            print(f"[montar] ignorando {a.name}: JSON inválido ({exc})")
    edicoes.sort(key=lambda e: e.get("data", ""), reverse=True)
    for ed in edicoes:  # edições antigas não têm tipo de cartão: calcula aqui
        for i in ed.get("itens", []):
            if not i.get("tipo"):
                calc = classificar(i, {"escopo": i.get("escopo", "Nacional"), "peso": 2, "dicas": []})
                i["tipo"], i["urgente"] = calc["tipo"], calc["urgente"]
    return edicoes


def curiosidade_do_dia(dia: date) -> dict | None:
    arq = PASTA_FERR / "curiosidades.json"
    if not arq.exists():
        return None
    banco = json.loads(arq.read_text(encoding="utf-8"))
    if not banco:
        return None
    return banco[(dia.timetuple().tm_yday + dia.year) % len(banco)]


# ----------------------------------------------------------------------------
# capa.png
# ----------------------------------------------------------------------------
def quebrar(texto: str, f: ImageFont.FreeTypeFont, largura: int, draw: ImageDraw.ImageDraw) -> list[str]:
    linhas, atual = [], ""
    for palavra in texto.split():
        teste = (atual + " " + palavra).strip()
        if draw.textlength(teste, font=f) <= largura:
            atual = teste
        else:
            if atual:
                linhas.append(atual)
            atual = palavra
    if atual:
        linhas.append(atual)
    return linhas


def gerar_capa(ed: dict, destino: Path) -> None:
    """Capa 1200x630 com a estrutura da bandeira: faixa branca com as marcas, um terço preto, dois terços vermelho."""
    L, A, FAIXA = 1200, 630, 140
    PRETO, VERM, CLARO = "#111114", "#B3242D", "#FBEDEE"
    img = Image.new("RGB", (L, A), "#FFFFFF")
    d = ImageDraw.Draw(img)
    x, y = 60, 38
    for nome, alt in (("fapesq.png", 52), ("marca-secties.png", 58)):
        for pasta in (PASTA_FERR, RAIZ):
            arq = pasta / nome
            if arq.exists():
                try:
                    logo = Image.open(arq).convert("RGBA")
                    logo = logo.resize((int(logo.width * alt / logo.height), alt), Image.LANCZOS)
                    if x > 60:
                        d.line([(x, y + 2), (x, y + 62)], fill="#CFCFCC", width=2)
                        x += 28
                    img.paste(logo, (x, y + (64 - alt) // 2), logo)
                    x += logo.width + 28
                except Exception:
                    pass
                break
    if x == 60:
        d.text((60, y + 14), "FAPESQ-PB  |  SECTIES", font=fonte(26, True), fill=PRETO)
    # a bandeira
    COL = L // 3
    d.rectangle([0, FAIXA, COL, A], fill=PRETO)
    d.rectangle([COL, FAIXA, L, A], fill=VERM)
    dt = datetime.strptime(ed["data"], "%Y-%m-%d")
    d.text((48, FAIXA + 52), "RADAR SECTIES", font=fonte(20, True), fill="#9A9AA0")
    d.text((48, FAIXA + 92), f"Edição nº {ed['numero']}", font=fonte(40, True), fill="#FFFFFF")
    d.text((48, FAIXA + 146), dt.strftime("%d.%m.%Y"), font=fonte(26), fill="#D8D8DC")
    n_alta = sum(1 for i in ed.get("itens", []) if i.get("relevancia") == "alta")
    d.text((48, A - 118), f"{len(ed.get('itens', []))} notícias", font=fonte(24, True), fill="#FFFFFF")
    d.text((48, A - 82), f"{n_alta} prioridades", font=fonte(24, True), fill="#FFFFFF")
    # manchete no vermelho
    d.text((COL + 48, FAIXA + 52), "HOJE NO RADAR", font=fonte(20, True), fill=CLARO)
    manchete = ed.get("destaque", "Radar SECTIES")
    larg = L - COL - 96
    for tam in (60, 54, 48, 42):
        fm = fonte(tam, True)
        linhas = quebrar(manchete, fm, larg, d)
        if len(linhas) <= 4:
            break
    yy = FAIXA + 100
    for ln in linhas[:4]:
        d.text((COL + 48, yy), ln, font=fm, fill="#FFFFFF")
        yy += int(tam * 1.18)
    d.text((COL + 48, A - 60), "Leia a edição completa", font=fonte(22), fill=CLARO)
    img.save(destino, "PNG", optimize=True)


# ----------------------------------------------------------------------------
# whatsapp.txt
# ----------------------------------------------------------------------------
MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]
DIAS = ["segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado", "domingo"]


def primeira_frase(t: str) -> str:
    m = re.match(r"(.+?[.!?])(\s|$)", t or "")
    return m.group(1) if m else (t or "")


def gerar_whatsapp(ed: dict, link: str, limite: int = 1300) -> str:
    """Mensagem institucional, no mesmo formato das edições anteriores do Radar."""
    dt = datetime.strptime(ed["data"], "%Y-%m-%d")
    data_ext = f"{DIAS[dt.weekday()].capitalize()}, {dt.day} de {MESES[dt.month - 1]} de {dt.year}"
    ordem = {"alta": 0, "media": 1, "radar": 2}
    its = sorted(ed.get("itens") or [], key=lambda i: ordem.get(i.get("relevancia"), 3))
    altas = [i for i in its if i.get("relevancia") == "alta"]
    atos = (ed.get("doe") or {}).get("atos") or []
    cur = ed.get("curiosidade") or {}
    esfera = {"Paraíba": "Paraíba", "Nacional": "Brasil", "Global": "Mundo"}

    def montar(n_prior, com_tambem, com_lide, com_fisica):
        L = [f"*RADAR SECTIES*  |  Edição nº {ed.get('numero', '')}", f"_{data_ext}_",
             "Clipping diário da Secretaria de Estado da Ciência, Tecnologia, Inovação e Ensino Superior da Paraíba", "",
             "*" + (ed.get("destaque") or "").upper() + "*"]
        if com_lide and ed.get("leitura"):
            L.append(primeira_frase(ed["leitura"]))
        prior = (altas or its)[:n_prior]
        if prior:
            L += ["", "*PRIORIDADES DO DIA*"] + [f"{k}. {i['titulo']} — _{i.get('fonte', '')}_" for k, i in enumerate(prior, 1)]
        if com_tambem:
            usados = {i.get("id") for i in prior}
            extra = []
            for esc in ("Paraíba", "Nacional", "Global"):
                c = next((i for i in its if i.get("escopo") == esc and i.get("id") not in usados), None)
                if c:
                    extra.append(f"• {esfera[esc]}: {c['titulo']}")
            if extra:
                L += ["", "*TAMBÉM NESTA EDIÇÃO*"] + extra
        if atos:
            L += ["", "*DIÁRIO OFICIAL DO ESTADO*"] + [f"• {a.get('tipo', 'Ato')} — {primeira_frase(a.get('resumo', ''))[:110]}" for a in atos[:2]]
        if com_fisica and cur.get("texto"):
            L += ["", "*FÍSICA DE BOLSO*", "_" + cur["texto"] + "_"]
        partes = [f"{len(its)} notícias"]
        if atos:
            partes.append("Diário Oficial")
        if ed.get("secom"):
            partes.append("pautas da SECTIES e da FAPESQ")
        L += ["", "Leia a edição completa, com " + ", ".join(partes[:-1]) + (" e " if len(partes) > 1 else "") + partes[-1] + ":", link]
        return "\n".join(L)

    for tent in [(4, True, True, True), (4, False, True, True), (3, False, True, True), (3, False, False, True),
                 (3, False, False, False), (2, False, False, False)]:
        texto = montar(*tent)
        if len(texto) <= limite:
            return texto
    return texto


# ----------------------------------------------------------------------------
# site
# ----------------------------------------------------------------------------
def montar_site(fontes: list[dict] | None = None) -> dict:
    edicoes = carregar_edicoes()
    if not edicoes:
        raise SystemExit("Nenhuma edição em edicoes/. Rode python3 -m radar.main primeiro.")
    PASTA_SITE.mkdir(exist_ok=True)
    hoje = edicoes[0]
    dia = date.fromisoformat(hoje["data"])
    for ed in edicoes:
        if "curiosidade" not in ed:
            ed["curiosidade"] = curiosidade_do_dia(date.fromisoformat(ed["data"]))
    # foto do núcleo (opcional)
    foto = None
    for nome in ("secretario.jpg", "secretario.png"):
        if (PASTA_FERR / nome).exists():
            shutil.copy(PASTA_FERR / nome, PASTA_SITE / nome)
            foto = nome
    for ed in edicoes:
        ed["fotoNucleo"] = foto
    for nome in ("fapesq.png", "marca-secties.png"):
        for pasta in (PASTA_FERR, RAIZ):
            if (pasta / nome).exists():
                if (pasta / nome).resolve() != (PASTA_SITE / nome).resolve():
                    shutil.copy(pasta / nome, PASTA_SITE / nome)
                break
    if fontes is None:
        fontes = json.loads((RAIZ / "fontes" / "fontes.json").read_text(encoding="utf-8"))["fontes"]
    for k, ed in enumerate(edicoes):  # texto institucional de cada edição, para o botão de compartilhar
        ed["whatsapp"] = gerar_whatsapp(ed, SITE_URL if k == 0 else f"{SITE_URL}#{ed['data']}")
    banco = json.loads((PASTA_FERR / "curiosidades.json").read_text(encoding="utf-8")) if (PASTA_FERR / "curiosidades.json").exists() else []
    dados = {"tipos": TIPOS, "programas": PROGRAMAS, "edicoes": edicoes, "curiosidades": banco, "site": SITE_URL,
             "fontes": [{"id": f["id"], "nome": f["nome"], "site": f["site"], "grupo": f["grupo"]} for f in fontes]}
    bloco = '<script id="dados" type="application/json">' + json.dumps(dados, ensure_ascii=False).replace("</", "<\\/") + "</script>"
    versao = dia.strftime("%Y%m%d")
    html = MODELO.read_text(encoding="utf-8")
    html = html.replace("<!--DADOS-->", bloco)
    html = html.replace("<!--TITULO-->", f"Radar SECTIES: {hoje['destaque']}".replace('"', "&quot;"))
    html = html.replace("<!--DESCRICAO-->", primeira_frase(hoje.get("leitura", "")).replace('"', "&quot;"))
    html = html.replace("<!--CAPA-->", f"{SITE_URL}capa.png?v={versao}")
    (PASTA_SITE / "index.html").write_text(html, encoding="utf-8")
    gerar_capa(hoje, PASTA_SITE / "capa.png")
    (PASTA_SITE / "whatsapp.txt").write_text(gerar_whatsapp(hoje, SITE_URL), encoding="utf-8")
    (PASTA_SITE / "edicao.json").write_text(json.dumps(hoje, ensure_ascii=False, indent=1), encoding="utf-8")
    return hoje


if __name__ == "__main__":
    ed = montar_site()
    print(f"Site montado na raiz: edição nº {ed['numero']} de {ed['data']} ({len(ed['itens'])} notícias).")
