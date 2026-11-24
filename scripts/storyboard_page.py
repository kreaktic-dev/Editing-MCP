# builds out/pisa/board/site/index.html + frames/ from panels.json and the rendered stills
import json, os, html
from PIL import Image
B = "out/pisa/board"; S = f"{B}/site"; os.makedirs(f"{S}/frames", exist_ok=True)
d = json.load(open(f"{B}/panels.json"))
for p in d["panels"]:
    Image.open(f"{B}/f_{p['f']}.jpg").convert("RGB").resize((360, 640), Image.LANCZOS).save(f"{S}/frames/p{p['i']:02d}.jpg", quality=80)
ERA = {"medieval": "1170s–1370s", "plan": "1173", "pit": "1173", "pause": "1178–1272", "1934": "1934", "1990": "1990–2001", "modern": "Today"}
TITLE = {1: "Hook", 2: "Setting", 3: "Foundation", 4: "First tilt", 5: "War", 6: "Tools down", 7: "The pause", 8: "They come back",
         9: "The banana", 10: "Mussolini's fix", 11: "It leans further", 12: "Why: the mattress", 13: "Closed and drilled", 14: "Swung back", 15: "Twist"}
tc = lambda f: f"{int(f // 30 // 60)}:{f / 30 % 60:05.2f}"
rows = []
for s in d["shots"]:
    ps = [p for p in d["panels"] if p["id"] == s["id"]]
    cards = "".join(f'''<figure class="panel"><img src="frames/p{p['i']:02d}.jpg" alt="Shot {s['id']} at {tc(p['f'])}: {html.escape(p['note'])}" loading="lazy" width="360" height="640"><figcaption><span class="tc">{tc(p['f'])}</span>{html.escape(p['note'])}</figcaption></figure>''' for p in ps)
    rows.append(f'''<section class="shot" id="shot-{s['id']}"><header class="sh"><div class="num">{s['id']:02d}</div><div class="meta"><h2>{TITLE[s['id']]}</h2>
<div class="chips"><span class="chip">{tc(s['a'])}–{tc(s['b'])}</span><span class="chip">{(s['b'] - s['a']) / 30:.1f} s</span><span class="chip era">{ERA[s['era']]}</span><span class="chip {s['light']}">{'Golden hour' if s['light'] == 'golden' else 'Day'}</span></div></div></header>
<p class="vo"><span class="lbl">VO</span>{html.escape(s['vo'])}</p><div class="panels">{cards}</div></section>''')
total = d["shots"][-1]["b"]
page = f'''<title>Pisa Short Storyboard</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=IBM+Plex+Sans:wght@400;500&family=IBM+Plex+Mono:wght@500&display=swap">
<style>
/* layout: a production board — one band per shot, VO line, then the shot's panels as phone-shaped frames */
:root {{ --bg:#eef1f4; --paper:#ffffff; --ink:#1b2430; --mute:#5b6676; --line:#d5dbe3; --sky:#2f6fcf; --ochre:#c9862e; --gold-bg:#fbeedd; --gold-fg:#8a4f12;
  --display:"Bricolage Grotesque", "Segoe UI", system-ui, sans-serif; --body:"IBM Plex Sans", system-ui, sans-serif; --mono:"IBM Plex Mono", ui-monospace, monospace; }}
@media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) {{ --bg:#11161d; --paper:#19202a; --ink:#e7ecf2; --mute:#9aa6b6; --line:#2a3340; --sky:#7aa8f0; --ochre:#e3a54e; --gold-bg:#3a2a16; --gold-fg:#f2c58a; color-scheme:dark; }} }}
:root[data-theme="dark"] {{ --bg:#11161d; --paper:#19202a; --ink:#e7ecf2; --mute:#9aa6b6; --line:#2a3340; --sky:#7aa8f0; --ochre:#e3a54e; --gold-bg:#3a2a16; --gold-fg:#f2c58a; color-scheme:dark; }}
body {{ background:var(--bg); color:var(--ink); font:15px/1.55 var(--body); padding-left:max(16px, env(safe-area-inset-left, 0px)); padding-right:max(16px, env(safe-area-inset-right, 0px)); }}
.wrap {{ max-width:1180px; margin:0 auto; padding-block:40px 64px; display:grid; gap:28px; }}
.top {{ display:grid; gap:10px; }}
.top h1 {{ font:800 clamp(30px, 5vw, 48px)/1.05 var(--display); letter-spacing:-0.02em; margin:0; text-wrap:balance; }}
.top p {{ margin:0; color:var(--mute); max-width:68ch; }}
.facts {{ display:flex; flex-wrap:wrap; gap:8px; }}
.review {{ background:var(--paper); border:1px solid var(--line); border-radius:10px; padding:16px 18px; display:grid; gap:6px; }}
.review h3 {{ margin:0; font:600 17px var(--display); }}
.review ul {{ margin:0; padding-left:18px; color:var(--mute); }}
.shot {{ background:var(--paper); border:1px solid var(--line); border-radius:12px; padding:18px; display:grid; gap:12px; scroll-margin-top:16px; }}
.sh {{ display:flex; gap:14px; align-items:center; }}
.num {{ font:800 34px/1 var(--display); color:var(--sky); min-width:48px; font-variant-numeric:tabular-nums; }}
.meta {{ display:grid; gap:6px; min-width:0; }}
.meta h2 {{ margin:0; font:600 21px/1.2 var(--display); }}
.chips {{ display:flex; flex-wrap:wrap; gap:6px; }}
.chip {{ font:500 12px var(--mono); padding:2px 8px; border-radius:99px; border:1px solid var(--line); color:var(--mute); font-variant-numeric:tabular-nums; }}
.chip.golden {{ background:var(--gold-bg); color:var(--gold-fg); border-color:transparent; }}
.chip.era {{ color:var(--ink); }}
.vo {{ margin:0; font-size:17px; max-width:70ch; }}
.lbl {{ font:500 11px var(--mono); letter-spacing:0.08em; color:var(--ochre); margin-right:10px; vertical-align:2px; }}
.panels {{ display:grid; grid-template-columns:repeat(auto-fill, minmax(170px, 1fr)); gap:14px; }}
.panel {{ margin:0; display:grid; gap:6px; align-content:start; min-width:0; }}
.panel img {{ width:100%; height:auto; aspect-ratio:9/16; border-radius:8px; display:block; background:var(--line); }}
.panel figcaption {{ font-size:13px; color:var(--mute); line-height:1.4; }}
.tc {{ display:block; font:500 12px var(--mono); color:var(--ink); }}
</style>
<div class="wrap">
<header class="top"><h1>The Tower That Refused to Stand Up</h1>
<p>Storyboard for review: a 60-second vertical animated short about the Leaning Tower of Pisa. Each band is one shot, with the voice-over it covers and stills from the actual 3D render at each camera beat. The camera moves in every shot: glides, push-ins, rolls, and kicks on impacts.</p>
<div class="facts"><span class="chip">1080 × 1920 · 30 fps</span><span class="chip">{total / 30:.1f} s · {len(d["shots"])} shots · {len(d["panels"])} panels</span><span class="chip">Timings estimated until the voice-over arrives</span></div></header>
<aside class="review"><h3>What to look at</h3><ul>
<li>Story beats and jokes: does every line have the right picture?</li>
<li>Characters and props: the 1934 dictator, the concrete mixer, the mattress gag, the tourists' pose.</li>
<li>Framing and camera notes under each frame.</li>
<li>Anything to cut, swap, or re-time. Reference a shot number and timecode.</li></ul></aside>
{"".join(rows)}
</div>'''
open(f"{S}/index.html", "w").write(page)
print("ok", len(d["panels"]))
