#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Dependency-free Markdown → static GitHub Pages site. Run from any directory."""
from pathlib import Path
import html
import re
import hashlib

ROOT = Path(__file__).resolve().parents[1]
SECTIONS = [
    ('guide', 'Guide', '操作と図式', 'ストリング図式とサイトの操作', 'f', 'A', 900, 262, 'vermilion'),
    ('about', 'About', '自己紹介', '自己紹介・所属・研究関心', 'g', 'A', 1530, 392, 'vermilion'),
    ('research', 'Research', '研究', '研究', 'h', 'A', 2392, 522, 'vermilion'),
    ('projects', 'Projects', '制作と実装', 'ソフトウェア・実装', 'i', 'B', 3110, 392, 'teal'),
    ('notes', 'Notes', '研究ノート', '数学・言語学の研究ノート', 'j', 'C', 3740, 262, 'violet'),
]

def inline(text):
    text = html.escape(text, quote=True)
    text = re.sub(r'`([^`]+)`', r'<code>\1</code>', text)
    def link(m):
        label, url = m.groups()
        if not re.match(r'^(https://|[\w./#-]+$)', url):
            raise ValueError('Unsupported link: ' + url)
        return f'<a href="{url}">{label}</a>'
    return re.sub(r'\[([^\]]+)\]\(([^\s)]+)\)', link, text)

def markdown(source):
    """Small, escaped Markdown subset: headings, paragraphs, lists, links, code."""
    out, paragraph, in_list = [], [], False
    def flush():
        if paragraph:
            out.append('<p>' + inline(' '.join(paragraph)) + '</p>')
            paragraph.clear()
    for line in source.splitlines() + ['']:
        if not line.strip():
            flush()
            if in_list:
                out.append('</ul>')
                in_list = False
        elif line.startswith('#'):
            flush()
            if in_list:
                out.append('</ul>')
                in_list = False
            m = re.fullmatch(r'(#{1,3}) (.+)', line)
            if not m:
                raise ValueError('Invalid heading: ' + line)
            level = len(m[1])
            out.append(f'<h{level}>{inline(m[2])}</h{level}>')
        elif line.startswith('- '):
            flush()
            if not in_list:
                out.append('<ul>')
                in_list = True
            out.append('<li>' + inline(line[2:]) + '</li>')
        else:
            paragraph.append(line)
    return '\n'.join(out)

def header(prefix, current=''):
    nav = ''.join(f'<a href="{prefix}{slug}/" {("data-panel=" + slug) if current == "diagram" else ""} {"aria-current=page" if slug == current else ""}>{title}</a>' for slug, title, *_ in SECTIONS)
    return f'''<header class="site-header"><a class="identity" href="{prefix}index.html" aria-label="Kazuhiro Kawate ホーム"><svg viewBox="0 0 38 24" aria-hidden="true"><path d="M0 6h10c8 0 10 12 18 12h10M0 18h10C18 18 20 6 28 6h10"/><path class="mark-bridge" d="M14 7c4 2 6 6 10 8"/></svg></a><nav aria-label="メインナビゲーション">{nav}</nav><a class="github-link" href="https://github.com/kazuhiro-kawate" aria-label="GitHubプロフィール"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v11m0-7h10m0 0v-4m0 4v7c0 3-2 5-5 5H7"/><circle cx="7" cy="3" r="2"/><circle cx="17" cy="3" r="2"/><circle cx="7" cy="19" r="2"/></svg></a></header>'''

def asset_version(path):
    return hashlib.sha256((ROOT / path).read_bytes()).hexdigest()[:12]

def head(title, prefix='', slug=''):
    page_title = title if title == 'Kazuhiro Kawate' else title + ' — Kazuhiro Kawate'
    return f'''<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>{page_title}</title><meta name="description" content="川手知拓の個人研究サイト。数学・言語学・計算機科学のあいだを、触れられるストリング図式で探索する。"><link rel="icon" href="{prefix}assets/favicon.svg" type="image/svg+xml"><link rel="preload" href="{prefix}assets/fonts/bricolage-latin.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="{prefix}assets/style.css?v={asset_version('assets/style.css')}"><link rel="canonical" href="https://kazuhiro-kawate.github.io/{slug}"><script src="{prefix}assets/diagram-model.js?v={asset_version('assets/diagram-model.js')}" defer></script><script src="{prefix}assets/diagram-motion.js?v={asset_version('assets/diagram-motion.js')}" defer></script><script src="{prefix}assets/site.js?v={asset_version('assets/site.js')}" defer></script></head>'''

def footer(prefix=''):
    return f'''<footer class="site-footer"><a href="{prefix}index.html">Kazuhiro Kawate</a><span>Mathematics · Linguistics · Computer Science</span><span>© 2026 Kazuhiro Kawate</span></footer>'''

def experiment():
    return '''<section class="experiment" aria-labelledby="symmetry-title"><p class="eyebrow">A SMALL EXPERIMENT / 01</p><h2 id="symmetry-title">対称性と恒等射</h2><p>二つの対称性の合成と恒等射の表示を切り替えます。</p><svg class="symmetry-diagram" viewBox="0 0 620 160" role="img" aria-label="対象AとBの2回の対称性。ボタンで恒等射の表示に切り替えられます"><g class="double-cross"><path class="a" d="M20 42H150C220 42 220 118 310 118S400 42 470 42H600"/><path class="gap" d="M20 118H150C220 118 220 42 310 42S400 118 470 118H600"/><path class="b" d="M20 118H150C220 118 220 42 310 42S400 118 470 118H600"/></g><g class="identity-wires" hidden><path class="a" d="M20 42H600"/><path class="b" d="M20 118H600"/></g><text x="4" y="25">A</text><text x="4" y="150">B</text><text x="598" y="25">A</text><text x="598" y="150">B</text></svg><p class="equation">σ<span>(B,A)</span> ∘ σ<span>(A,B)</span> = id<span>(A⊗B)</span></p><button class="text-button symmetry-toggle" type="button" hidden aria-pressed="false">恒等射に切り替える <span aria-hidden="true">↔</span></button><p class="small">対称性の公理に基づく表示切替です。一般の編み込みで交差を消せるとは限りません。</p></section>'''

contents = {slug: markdown((ROOT / 'content' / f'{slug}.md').read_text()) for slug, *_ in SECTIONS}

nodes = ''.join(f'''<div class="diagram-node {color}" data-node="{slug}" data-x="{x}" data-y="{y}" style="left:{x}px;top:{y}px"><span class="node-index">0{i+1} / {obj} → {obj}</span><a href="{slug}/" class="node-card" data-panel="{slug}" aria-label="{title}の詳細を開く"><span class="node-symbol" aria-hidden="true">{symbol}</span><span class="node-title">{title}<span>{ja}</span></span><span class="node-arrow" aria-hidden="true">↗</span></a><button class="drag-handle" type="button" aria-label="{title}の箱を移動" aria-describedby="drag-help" hidden><span aria-hidden="true">⠿</span> GRAB & SLIDE ↔</button></div>''' for i, (slug,title,ja,description,symbol,obj,x,y,color) in enumerate(SECTIONS))

guide_controls = '<p id="drag-help" class="sr-only">左右キーでワイヤーに沿って移動。Shiftで大きく移動、Enterで確定、Escapeで取り消します。</p><div class="motion-setting" hidden><label><input type="checkbox" id="static-mode"> 図式を静かに読む（動きを抑える）</label></div>'

dialogs = ''.join(f'''<dialog id="panel-{slug}" aria-labelledby="panel-title-{slug}"><div class="dialog-top"><span class="eyebrow">0{i+1} / {title.upper()}</span><button class="close-dialog" type="button" aria-label="詳細を閉じる">Close <span aria-hidden="true">×</span></button></div><div class="prose">{contents[slug].replace('<h1>', f'<h1 id="panel-title-{slug}">')}{(guide_controls + experiment()) if slug == "guide" else ""}</div><a class="text-button" href="{slug}/">通常のページで読む <span aria-hidden="true">↗</span></a></dialog>''' for i,(slug,title,*_) in enumerate(SECTIONS))

composite_dialog = '''<dialog id="panel-composite" aria-labelledby="composite-title"><div class="dialog-top"><span class="eyebrow">COMPOSITION</span><button class="close-dialog" type="button" aria-label="詳細を閉じる">Close ×</button></div><div class="prose"><h1 id="composite-title">合成</h1><p class="composite-type"></p><div class="composite-contents"></div></div></dialog>'''

index = head('Kazuhiro Kawate') + '''<body class="home"><a class="skip-link" href="#diagram-interface">図式の操作へスキップ</a>''' + header('', 'diagram') + '''
<main><section class="journey" aria-labelledby="intro-title"><div class="scene"><div class="intro"><h1 id="intro-title"><span class="headline-line">KAZUHIRO</span><span class="headline-line">KAWATE</span></h1><p class="eyebrow intro-caption">PERSONAL WEBSITE</p></div>
<div id="diagram-interface" class="diagram-viewport" tabindex="0" role="region" aria-label="ストリング図式。左右キーで探索できます"><div class="diagram-world"><svg class="strings" viewBox="0 0 3700 720" aria-hidden="true"><defs><filter id="tube-plastic" filterUnits="userSpaceOnUse" x="-10%" y="-60%" width="120%" height="220%" color-interpolation-filters="sRGB"><feGaussianBlur in="SourceAlpha" stdDeviation="3" result="bump"/><feSpecularLighting in="bump" surfaceScale="5" specularConstant="0.85" specularExponent="24" lighting-color="#ffffff" result="shine"><feDistantLight azimuth="225" elevation="55"/></feSpecularLighting><feComposite in="shine" in2="SourceAlpha" operator="in" result="clipped"/><feComposite in="SourceGraphic" in2="clipped" operator="arithmetic" k1="0" k2="1" k3="0.8" k4="0"/></filter><path id="shape-a" class="wire wire-a" d="M0 262H1046C1166 262 1166 392 1286 392H1860C1980 392 1980 522 2100 522H4386"/><path id="shape-b" class="wire wire-b" d="M0 392H1046C1166 392 1166 262 1286 262H2680C2800 262 2800 392 2920 392H4386"/><path id="shape-c" class="wire wire-c" d="M0 522H1860C1980 522 1980 392 2100 392H2680C2800 392 2800 262 2920 262H4386"/></defs><g class="wire-network"><g class="tube tube-a"><use href="#shape-a" class="tube-shadow"/><use href="#shape-a" class="tube-outline"/><use href="#shape-a" class="tube-body"/><use href="#shape-a" class="tube-sheen"/></g><path class="wire wire-gap-b" d="M0 392H1046C1166 392 1166 262 1286 262H2680C2800 262 2800 392 2920 392H4386"/><g class="tube tube-b"><use href="#shape-b" class="tube-shadow"/><use href="#shape-b" class="tube-outline"/><use href="#shape-b" class="tube-body"/><use href="#shape-b" class="tube-sheen"/></g><path class="wire wire-gap-c" d="M0 522H1860C1980 522 1980 392 2100 392H2680C2800 392 2800 262 2920 262H4386"/><g class="tube tube-c"><use href="#shape-c" class="tube-shadow"/><use href="#shape-c" class="tube-outline"/><use href="#shape-c" class="tube-body"/><use href="#shape-c" class="tube-sheen"/></g></g><g class="diagram-labels"><text data-input="A" x="72" y="242">A</text><text data-input="B" x="72" y="372">B</text><text data-input="C" x="72" y="502">C</text><text data-output="C" x="4216" y="242">C</text><text data-output="B" x="4216" y="372">B</text><text data-output="A" x="4216" y="502">A</text></g></svg>''' + nodes + '''<button type="button" class="crossing-note" aria-label="交差列を編集" hidden><span>σ₁ σ₂ σ₁</span><span>A ⊗ B ⊗ C → C ⊗ B ⊗ A</span></button><div class="pair-preview" aria-hidden="true" hidden><span>σ²</span><svg viewBox="0 0 160 90"><path d="M0 15H20C55 15 45 75 80 75S105 15 140 15H160"/><path d="M0 75H20C55 75 45 15 80 15S105 75 140 75H160"/></svg></div><div class="end-note"><span class="eyebrow">SECTIONS</span><div class="end-links"><a href="guide/" data-panel="guide">Guide ↗</a><a href="about/" data-panel="about">About ↗</a><a href="research/" data-panel="research">Research ↗</a><a href="projects/" data-panel="projects">Projects ↗</a><a href="notes/" data-panel="notes">Notes ↗</a></div><button type="button" class="text-button return-start" hidden>はじまりへ戻る ↺</button></div></div></div>
<div class="coherence-tools" role="group" aria-label="図式の変形"><button type="button" data-action="undo" aria-label="操作を戻す" hidden>Undo ↶</button><button type="button" data-action="redo" aria-label="操作をやり直す" hidden>Redo ↷</button><button type="button" data-action="word" aria-pressed="false" hidden>交差列</button><button type="button" data-action="pair" aria-pressed="false" hidden>σ² を置く</button><button type="button" data-action="compose" aria-pressed="false" hidden>合成</button></div><section class="word-dock" hidden aria-label="交差列の編集"><div class="word-heading"><strong>交差列</strong><button type="button" data-word-close aria-label="交差列を閉じる">×</button></div><p class="word-explanation">左から右へ実行。このサイトではσ₁は1↔2、σ₂は2↔3、σ₃は3↔1を交換します。列の編集では射や出力の並びが変わる場合があります。交差をドラッグして並べ替えられます。選択後は左右ボタン、Shift＋左右キーでも移動できます。</p><ol class="word-tokens" aria-label="実行する交差の順序"></ol><div class="word-target-row"><span class="word-target" aria-live="polite">末尾に追加</span><div class="word-position-tools"><button type="button" data-word-left aria-label="選択した交差を左へ移動">←</button><button type="button" data-word-right aria-label="選択した交差を右へ移動">→</button><button type="button" data-word-end>末尾へ</button></div></div><div class="word-pad" role="group" aria-label="交差の入力"><button type="button" data-sigma="0" aria-label="σ₁を入力">σ₁</button><button type="button" data-sigma="1" aria-label="σ₂を入力">σ₂</button><button type="button" data-sigma="2" aria-label="σ₃を入力">σ₃</button><button type="button" data-word-delete>削除 ⌫</button></div><div class="word-actions"><button type="button" data-word-apply>実行</button><button type="button" data-word-reload>図式から読込</button><button type="button" data-word-clear>空にする</button><button type="button" data-word-braid>編み替え ↔</button></div><p class="word-status" role="status"></p><p class="word-limit"></p></section><div class="composition-dock" hidden role="group" aria-label="箱の合成"><p class="selection-summary">2個以上の箱を選択</p><div><button type="button" data-combine="serial">直列 ∘</button><button type="button" data-combine="tensor">並列 ⊗</button><button type="button" data-combine="split">展開</button><button type="button" data-combine="done">完了</button></div><label class="identity-option"><input type="checkbox" id="include-identities" checked>並列合成に恒等射を含める</label><p class="composition-feedback" role="status"></p></div><div class="placement-hint" hidden>σ²を置く位置をクリック。上下で3組から選択。Escで中止。</div><div class="scene-bottom"><div class="diagram-tools"><button class="text-button reset-diagram" type="button" hidden>Reset ↺</button><button class="text-button help-button" type="button" data-panel="guide" hidden>Guide ?</button></div></div>
<div class="journey-controls" hidden><div class="chapter-tabs" aria-label="図式内の移動">''' + ''.join(f'<button type="button" data-travel="{slug}" aria-label="図式の{title}へ移動">0{i+1}<span>{title}</span></button>' for i,(slug,title,*_) in enumerate(SECTIONS)) + '''</div><div class="progress-track" aria-hidden="true"><span></span></div><span class="journey-count">01 — 05</span></div></div></section>
</main>''' + dialogs + composite_dialog + '<p class="sr-only" role="status" id="diagram-status"></p></body></html>'
(ROOT / 'index.html').write_text(index)

for i,(slug,title,ja,*_) in enumerate(SECTIONS):
    target = ROOT / slug
    target.mkdir(exist_ok=True)
    body = head(title, '../', slug + '/') + f'''<body class="article-page"><a class="skip-link" href="#content">本文へスキップ</a>''' + header('../', slug) + f'''<main id="content" class="article-layout"><aside class="article-aside"><a href="../index.html">← Back to the diagram</a><span class="article-number">0{i+1}</span><span class="eyebrow">{ja}</span></aside><article class="prose">{contents[slug]}{experiment() if slug == 'guide' else ''}<div class="article-next"><span class="eyebrow">NEXT CONNECTION</span><a href="../{SECTIONS[(i+1)%len(SECTIONS)][0]}/">{SECTIONS[(i+1)%len(SECTIONS)][1]} ↗</a></div></article></main>''' + footer('../') + '</body></html>'
    (target/'index.html').write_text(body)

(ROOT / 'README.html').write_text(head('Research Notes') + '<body class="article-page">' + header('') + '<main class="compatibility prose"><p class="eyebrow">RESEARCH NOTES</p><h1>Research Notes</h1><p>旧プロフィールからの「研究ノート（README）」の入口です。</p><p><a class="text-button" href="notes/">研究ノートを読む ↗</a></p></main>' + footer() + '</body></html>')
(ROOT / '404.html').write_text(head('Page not found', '/', '404.html') + '<body>' + header('/') + '<main class="compatibility prose"><p class="eyebrow">404 / PAGE NOT FOUND</p><h1>ページが見つかりません。</h1><p>お探しのページは見つかりませんでした。</p><a href="/">図式のはじまりへ戻る →</a></main>' + footer('/') + '</body></html>')
(ROOT / '.nojekyll').touch()
(ROOT / 'robots.txt').write_text('User-agent: *\nAllow: /\nSitemap: https://kazuhiro-kawate.github.io/sitemap.xml\n')
(ROOT / 'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + ''.join('<url><loc>https://kazuhiro-kawate.github.io/' + p + '</loc></url>' for p in ['', 'about/', 'research/', 'projects/', 'notes/']) + '</urlset>\n')
print('Built 8 HTML pages. No runtime dependencies.')
