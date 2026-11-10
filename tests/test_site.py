"""Run: python3 -m unittest discover -s tests -v (standard library only)."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
import importlib.util
import subprocess
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
PAGES = [ROOT / x for x in ['index.html', 'about/index.html', 'research/index.html', 'projects/index.html', 'notes/index.html', 'guide/index.html', 'README.html', '404.html']]

class Document(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.links, self.ids, self.refs, self.tags = [], [], [], []
        self.feed(source)
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        self.tags.append((tag, attrs))
        if 'id' in attrs: self.ids.append(attrs['id'])
        for attr in ['href','src']:
            if attr in attrs: self.links.append(attrs[attr])
        for attr in ['aria-labelledby','aria-describedby']:
            self.refs.extend(attrs.get(attr,'').split())

class SiteTest(unittest.TestCase):
    def test_build_is_reproducible(self):
        before = {p: p.read_bytes() for p in PAGES}
        subprocess.run([sys.executable,str(ROOT/'scripts/build.py')],check=True,capture_output=True)
        self.assertEqual(before,{p:p.read_bytes() for p in PAGES})
    def test_internal_links_and_assets_resolve(self):
        for p in PAGES:
            for link in Document(p.read_text()).links:
                url = urlsplit(link)
                if url.scheme or url.netloc: continue
                target = ROOT / unquote(url.path.lstrip('/')) if url.path.startswith('/') else p.parent / unquote(url.path)
                if target.is_dir(): target /= 'index.html'
                self.assertTrue(target.exists(), f'{p}: {link}')
                if url.fragment:
                    self.assertIn(url.fragment, Document(target.read_text()).ids, f'{p}: {link}')
    def test_accessibility_references_are_unique_and_resolve(self):
        for p in PAGES:
            d = Document(p.read_text())
            self.assertEqual(len(d.ids),len(set(d.ids)),p)
            for ref in d.refs: self.assertIn(ref,d.ids,f'{p}: {ref}')
    def test_each_section_is_available_without_javascript(self):
        home = Document((ROOT/'index.html').read_text())
        for slug in ['about','research','projects','notes','guide']:
            self.assertIn(slug+'/',home.links)
            page = (ROOT/slug/'index.html').read_text()
            self.assertIn('<article class="prose">',page)
            self.assertIn('<h1>',page)
            if slug != 'research': self.assertIn("<h2>",page)
    def test_home_contains_only_the_diagram(self):
        d=Document((ROOT/'index.html').read_text())
        self.assertNotIn('reading',d.ids)
        self.assertEqual(sum(tag=='main' for tag,_ in d.tags),1)
        self.assertEqual(sum(tag=='dialog' for tag,_ in d.tags),6)
        self.assertNotIn('site-footer',[a.get('class') for _,a in d.tags])
    def test_guide_and_research_notes_are_separate(self):
        notes=(ROOT/'notes/index.html').read_text()
        guide=(ROOT/'guide/index.html').read_text()
        self.assertNotIn('対称性と恒等射',notes)
        self.assertIn('対称性と恒等射',guide)
        self.assertIn('サイトの動かし方',guide)
        self.assertEqual((ROOT/'content/research.md').read_text().strip(),'# Research')
    def test_word_editor_and_section_order(self):
        home=(ROOT/'index.html').read_text()
        d=Document(home)
        self.assertEqual(sum('data-sigma' in attrs for _,attrs in d.tags),3)
        self.assertNotIn('shape-d',d.ids)
        self.assertIn('σ₃は3↔1',home)
        self.assertLess(home.index('data-node="guide"'),home.index('data-node="about"'))
        self.assertLess(home.index('data-node="about"'),home.index('data-node="research"'))
        self.assertIn('filterUnits="userSpaceOnUse"',home)
    def test_legacy_notes_entry(self):
        self.assertIn('notes/',Document((ROOT/'README.html').read_text()).links)
    def test_no_external_runtime_dependencies(self):
        for p in PAGES:
            for tag,attrs in Document(p.read_text()).tags:
                if tag=='script' or tag=='link' and attrs.get('rel')=='stylesheet':
                    url=attrs.get('src',attrs.get('href',''))
                    self.assertFalse(urlsplit(url).scheme,url)
    def test_transfer_budget(self):
        size=sum((ROOT/p).stat().st_size for p in ['index.html','assets/style.css','assets/site.js','assets/diagram-model.js','assets/diagram-motion.js','assets/fonts/bricolage-latin.woff2','assets/favicon.svg'])
        self.assertLess(size,250_000)
    def test_pages_needs_no_framework_build(self):
        self.assertTrue((ROOT/'.nojekyll').exists())
        self.assertFalse((ROOT/'package.json').exists())
        self.assertFalse((ROOT/'.github/workflows/deploy.yml').exists())

if __name__=='__main__': unittest.main()
