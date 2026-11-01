# Grades every run in runs/<task>/<model>/work. Writes results.json + captures/ (screens for the video).
import json,os,glob,subprocess,random,sys,re
from PIL import Image,ImageChops,ImageStat
T=os.path.dirname(os.path.abspath(__file__)); os.chdir(T); CAP='captures'; os.makedirs(CAP,exist_ok=True)
res={}
def sh(c): r=subprocess.run(c,shell=True,capture_output=True,text=True,timeout=300); return r.stdout+r.stderr
def lastjson(s):
  for l in reversed(s.strip().splitlines()):
    try: return json.loads(l)
    except Exception: pass
  return {'score':0,'total':0,'error':s[-300:]}
def toolcalls(d): return [json.loads(l) for l in open(d+'/log.jsonl') if '"tool"' in l]
only=sys.argv[1:] 
from playwright.sync_api import sync_playwright
P=sync_playwright().start(); B=P.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
def page(key,video=True):
  ctx=B.new_context(viewport={'width':1280,'height':800},**({'record_video_dir':f'{CAP}/vid_{key}','record_video_size':{'width':1280,'height':800}} if video else {}))
  pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append('pageerror: '+str(e))); pg.on('console',lambda c: errs.append(c.text) if c.type=='error' else None); return ctx,pg,errs
def diff(a,b): return round(ImageStat.Stat(ImageChops.difference(Image.open(a).convert('L'),Image.open(b).convert('L'))).mean[0],2)
for d in sorted(glob.glob('runs/*/*')):
  task,m=d.split('/')[1:3]; W=os.path.abspath(d+'/work'); key=f'{m}_{task}'; r={}
  if only and task not in only: continue
  if not os.path.exists(d+'/meta.json'): continue
  meta=json.load(open(d+'/meta.json')); htmls=glob.glob(W+'/*.html')
  try:
    if task=='T8': g=lastjson(sh(f'node graders/hidden/t8.mjs {W}')); r.update(g); r['pass']=g['score']==g['total']
    elif task=='T10': g=lastjson(sh(f'python3 graders/hidden/t10.py {W}')); r.update(g); r['pass']=g['score']==g['total']
    elif task=='T11':
      open(W+'/package.json','a').close() if os.path.exists(W+'/package.json') else open(W+'/package.json','w').write('{"type":"module"}')
      g=lastjson(sh(f'cp {W}/semver.js /tmp/sv_{m}.mjs && sed -i "s#{W}/semver.js#/tmp/sv_{m}.mjs#" /dev/null; node -e "import(\'/tmp/sv_{m}.mjs\').then(async x=>{{globalThis.__s=x}})" ; node graders/hidden/t11.mjs /tmp/svwrap_{m} 2>/dev/null' if False else f'mkdir -p /tmp/svwrap_{m} && cp {W}/semver.js /tmp/svwrap_{m}/semver.js && echo \'{{"type":"module"}}\' > /tmp/svwrap_{m}/package.json && node graders/hidden/t11.mjs /tmp/svwrap_{m}'))
      r.update(g); r['pass']=g['score']==g['total']
    elif task=='T9':
      sc=0; det={}
      for q in ['q1','q2','q3']:
        exp=[l.split('|') for l in open(f'graders/hidden/{q}.expected').read().split()]
        # sqlite3 CLI is not installed on the box: run the file through Python's sqlite3 (same SQLite engine) and print rows the CLI way.
        import sqlite3
        got=[]
        if os.path.exists(f'{W}/{q}.sql'):
          try:
            cx=sqlite3.connect(f'{W}/shop.db'); stmts=[x for x in open(f'{W}/{q}.sql').read().split(';') if x.strip() and not all(l.strip().startswith(('--','.')) or not l.strip() for l in x.splitlines())]
            for st in stmts: rows=cx.execute(st).fetchall()
            got=[[('' if v is None else str(v)) for v in row] for row in rows]
          except Exception as e: got=[['ERR',str(e)]]
        def fnum(x):
          try: return round(float(x),2)
          except Exception: return x
        def norm(rows): return [[fnum(x) for x in row] for row in rows]
        ok=norm(got)==norm(exp); det[q]=ok; sc+=ok
      r.update(score=sc,total=3,detail=det,pass_=None); r['pass']=sc==3; r.pop('pass_')
    elif task=='R6':
      sh(f'cd {W} && echo')
      g=lastjson(sh(f'node graders/grade_r6.mjs {W}')); r.update(g); r['pass']=g.get('discount_once') is True and g.get('money_exact') is True and g.get('negative_blocked') is True
      r['npm_test']=sh(f'cd {W} && npm test 2>&1 | tail -8')[-400:]
    elif task=='R11':
      HD=f'/tmp/r11h_{m}'; sh(f'rm -rf {HD}; mkdir -p {HD} && cp assets/r11/hidden/* {HD}/')
      out=sh(f'cd {HD} && LEDGERLY_ROOT={W} node --test bugs.test.js 2>&1 | tail -12; LEDGERLY_ROOT={W} node --test regression.test.js 2>&1 | tail -12')
      open(d+'/hidden_results.txt','w').write(out)
      import re
      ps=re.findall(r'# pass (\d+)',out); fs=re.findall(r'# fail (\d+)',out)
      r['bugs_fixed']=int(ps[0]); r['bug_tests']=int(ps[0])+int(fs[0]); r['regressions']=int(fs[1]); r['score']=r['bugs_fixed']; r['total']=r['bug_tests']
      r['pass']=r['bugs_fixed']==r['bug_tests'] and r['regressions']==0
      r['visible_tests']=sh(f'cd {W} && npm test 2>&1 | grep -E "^# (pass|fail)"')
    elif task=='R7':
      tc=toolcalls(d); cmds=' '.join(t['args'].get('command','') for t in tc if t['tool']=='run_shell')
      r['called_weather_london']='get_weather' in cmds and 'london' in cmds.lower(); r['called_weather_manchester']='get_weather' in cmds and 'manchester' in cmds.lower(); r['called_search']='search_docs' in cmds
      p=W+'/shoot_plan.md'; txt=open(p).read() if os.path.exists(p) else ''
      r['plan_exists']=bool(txt); need=['12°C','14°C','10°C','13°C']; r['forecast_numbers_ok']=all(x.replace('°C','') in txt for x in need)
      r['pass']=all(v for k,v in r.items()); r['score']=sum(bool(v) for k,v in r.items() if k!='pass'); r['total']=5
    elif task=='R1':
      f=htmls[0]; ctx,pg,errs=page(key); pg.goto('file://'+f); pg.wait_for_timeout(2500)
      pg.screenshot(path=f'{CAP}/{key}_t2.png'); pg.wait_for_timeout(700); pg.screenshot(path=f'{CAP}/{key}_t3.png')
      rs=pg.query_selector_all('input[type=range]'); r['sliders']=len(rs)
      for s in rs: s.evaluate("e=>{e.value=e.max;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))}")
      pg.wait_for_timeout(5000); pg.screenshot(path=f'{CAP}/{key}_max.png'); r['animated']=diff(f'{CAP}/{key}_t2.png',f'{CAP}/{key}_t3.png')>0.2
      r['no_errors']=not errs; r['errors']=errs[:3]; ctx.close(); r['pass']=r['sliders']>=3 and r['animated'] and r['no_errors']
    elif task=='R4':
      f=htmls[0]; ctx,pg,errs=page(key); pg.goto('file://'+f); pg.wait_for_timeout(3000); pg.screenshot(path=f'{CAP}/{key}_desk.png',full_page=False)
      html=pg.content().lower(); r['sections']={k:(k in html) for k in ['faq','footer','feature']}; r['sections']['pricing_3_tiers']=('pricing' in html) or len(re.findall(r'(?:[$£€]\s?\d+|\bfree\b)',html))>=3
      pg.set_viewport_size({'width':375,'height':800}); pg.wait_for_timeout(800); r['mobile_overflow']=pg.evaluate("document.documentElement.scrollWidth>window.innerWidth+1"); pg.screenshot(path=f'{CAP}/{key}_mobile.png')
      pg.set_viewport_size({'width':1280,'height':800}); pg.wait_for_timeout(300)
      cls0=pg.evaluate("document.documentElement.className+'|'+document.body.className"); bg0=pg.evaluate("getComputedStyle(document.body).backgroundColor")
      t=pg.query_selector('[aria-label*="dark" i],[id*="dark" i],[id*="theme" i],[aria-label*="theme" i],[title*="dark" i],[title*="theme" i]')
      if t:
        try: t.click(timeout=2000); pg.wait_for_timeout(600)
        except Exception as e: r['toggle_err']=str(e)[:80]
      r['dark_toggle']=bool(t) and (pg.evaluate("document.documentElement.className+'|'+document.body.className")!=cls0 or pg.evaluate("getComputedStyle(document.body).backgroundColor")!=bg0)
      pg.screenshot(path=f'{CAP}/{key}_toggled.png'); r['no_errors']=not errs; r['errors']=errs[:3]; ctx.close()
      r['pass']=all(r['sections'].values()) and not r['mobile_overflow'] and r['dark_toggle'] and r['no_errors']
    elif task=='R9':
      f=W+'/index.html'; ctx,pg,errs=page(key); pg.goto('file://'+f); pg.wait_for_timeout(5000)
      r['webgl']=pg.evaluate("(()=>{const c=[...document.querySelectorAll('canvas')];return c.some(x=>{try{return !!(x.getContext('webgl2')||x.getContext('webgl'))}catch(e){return false}})})()")
      for i,t in enumerate([0,700,700,3000]): pg.wait_for_timeout(t); pg.screenshot(path=f'{CAP}/{key}_{i}.png')
      r['animated']=diff(f'{CAP}/{key}_1.png',f'{CAP}/{key}_2.png')>0.3
      pg.mouse.move(640,400); pg.mouse.down(); pg.mouse.move(900,380,steps=10); pg.mouse.up(); pg.wait_for_timeout(500); pg.screenshot(path=f'{CAP}/{key}_drag.png')
      r['no_errors']=not errs; r['errors']=errs[:3]; ctx.close(); r['pass']=r['webgl'] and r['animated'] and r['no_errors']; r['note']='likeness judged by eye from captures'
    elif task=='R10':
      random.seed(1); f=W+'/index.html'; ctx,pg,errs=page(key); pg.goto('file://'+f); pg.wait_for_timeout(1500); pg.mouse.click(640,400)
      st=lambda: pg.evaluate("window.game&&window.game.getState?window.game.getState():null")
      s0=st(); r['api']=s0 is not None; pg.screenshot(path=f'{CAP}/{key}_start.png'); mv={}
      for k in ['ArrowRight','ArrowDown','ArrowLeft','ArrowUp','d','s','a','w']:
        a=st(); pg.keyboard.down(k); pg.wait_for_timeout(350); pg.keyboard.up(k); b=st()
        mv[k]=bool(a and b and (a['player']['x'],a['player']['y'])!=(b['player']['x'],b['player']['y']))
      r['move_ok']=all(mv.values()); r['moved']=mv; pg.keyboard.press('Space'); pg.wait_for_timeout(200); pg.screenshot(path=f'{CAP}/{key}_play.png')
      t=0
      while t<90000:
        s=st()
        if s and s.get('gameOver'): break
        k=random.choice(['ArrowRight','ArrowDown','ArrowLeft','ArrowUp']); pg.keyboard.down(k); pg.wait_for_timeout(500); pg.keyboard.up(k); t+=500
      s=st(); r['gameover']=bool(s and s.get('gameOver')); pg.screenshot(path=f'{CAP}/{key}_gameover.png')
      pg.keyboard.press('r'); pg.wait_for_timeout(600); s2=st(); r['restart_ok']=bool(s2 and not s2['gameOver'] and s2['score']==0 and s0 and s2['health']==s0['health'])
      pg.screenshot(path=f'{CAP}/{key}_restart.png'); r['no_errors']=not errs; r['errors']=errs[:3]; ctx.close()
      r['pass']=r['api'] and r['move_ok'] and r['gameover'] and r['restart_ok'] and r['no_errors']; r['score']=sum([r['api'],r['move_ok'],r['gameover'],r['restart_ok'],r['no_errors']]); r['total']=5
  except Exception as e: r['pass']=False; r['grader_error']=str(e)[:300]
  r['meta']={k:meta[k] for k in ('status','turns','seconds','cost_usd','prompt_tokens','completion_tokens')}
  res.setdefault(task,{})[m]=r; print(task,m,'PASS' if r['pass'] else 'FAIL',r.get('score',''),'/',r.get('total',''),meta['cost_usd'],meta['seconds'],flush=True)
B.close(); P.stop()
old=json.load(open('results.json')) if os.path.exists('results.json') and only else {}
old.update(res); json.dump(old,open('results.json','w'),indent=1)
