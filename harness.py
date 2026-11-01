#!/usr/bin/env python3
"""Minimal agent harness over OpenRouter: same tools, same prompt, same limits for every model.
usage: harness.py <model_slug> <label> <task>   (task = R1,R4,R6,R7,R9,R10,R11,T8,T9,T10,T11)"""
import json,os,sys,subprocess,time,base64,shutil,urllib.request
T=os.path.dirname(os.path.abspath(__file__)); LEDGER=f'{T}/cost_ledger.jsonl'; CAP_TOTAL=2.85; CAP_RUN=0.40; MAX_TURNS=30
model,label,task=sys.argv[1:4]
def spent(): return sum(json.loads(l)['cost'] for l in open(LEDGER)) if os.path.exists(LEDGER) else 0.0
D=f'{T}/runs/{task}/{label}'; shutil.rmtree(D,ignore_errors=True); W=f'{D}/work'; os.makedirs(W)
seed={'R6':'shoplite','R7':'toolstubs','R9':'r9','R11':'r11/visible','T9':'t9'}.get(task)
if seed: shutil.copytree(f'{T}/assets/{seed}',W,dirs_exist_ok=True)
if task=='R9' and os.path.exists(f'{W}/SOURCE.md'): os.remove(f'{W}/SOURCE.md')
prompt=open(f'{T}/prompts/{task}.md').read()
SYS=("You are a coding agent working in a project folder. Use the tools to inspect files, write files and run shell commands "
     "(node 20, python 3, sqlite3 and npm are available; no internet from the shell). Work autonomously until the task is done, then reply with a short summary.")
tools=[{"type":"function","function":{"name":n,"description":d,"parameters":{"type":"object","properties":p,"required":list(p)}}} for n,d,p in [
 ("list_files","List files in the project folder recursively",{}),
 ("read_file","Read a text file",{"path":{"type":"string"}}),
 ("write_file","Create or overwrite a text file",{"path":{"type":"string"},"content":{"type":"string"}}),
 ("run_shell","Run a shell command in the project folder (120 s timeout)",{"command":{"type":"string"}})]]
for t in tools:
  if t['function']['name']=='list_files': t['function']['parameters']={"type":"object","properties":{}}
def safe(p):
  a=os.path.abspath(os.path.join(W,p));
  if not a.startswith(os.path.abspath(W)): raise ValueError('path outside project')
  return a
def call_tool(n,a):
  try:
    if n=='list_files': return '\n'.join(os.path.relpath(os.path.join(r,f),W) for r,ds,fs in os.walk(W) for f in fs if 'node_modules' not in r and '.git' not in r)[:20000]
    if n=='read_file': return open(safe(a['path'])).read()[:60000]
    if n=='write_file':
      p=safe(a['path']); os.makedirs(os.path.dirname(p),exist_ok=True); open(p,'w').write(a['content']); return f"wrote {len(a['content'])} chars"
    if n=='run_shell':
      r=subprocess.run(['bash','-lc',a['command']],cwd=W,capture_output=True,text=True,timeout=120,env={'PATH':os.environ.get('PATH','/usr/bin:/bin'),'LANG':'C.UTF-8','HOME':W})
      return (f"exit {r.returncode}\n"+r.stdout[-12000:]+r.stderr[-6000:])
  except Exception as e: return f'ERROR: {e}'
user=[{"type":"text","text":prompt}]
if task=='R9':
  for f in ['ref_front.jpg','ref_side.jpg']: user.append({"type":"image_url","image_url":{"url":"data:image/jpeg;base64,"+base64.b64encode(open(f'{W}/{f}','rb').read()).decode()}})
msgs=[{"role":"system","content":SYS},{"role":"user","content":user}]
log=open(f'{D}/log.jsonl','w'); cost=0; tok_in=tok_out=0; t0=time.time(); status='done'; turns=0
while turns<MAX_TURNS:
  if spent()+0.05>CAP_TOTAL: status='stopped_global_cap'; break
  if cost>CAP_RUN: status='stopped_run_cap'; break
  turns+=1
  body={"model":model,"messages":msgs,"tools":tools,"max_tokens":32000,"reasoning":{"effort":"medium"},"usage":{"include":True}}
  for attempt in range(3):
    try:
      req=urllib.request.Request('https://openrouter.ai/api/v1/chat/completions',data=json.dumps(body).encode(),headers={'Authorization':'Bearer '+os.environ['OPENROUTER_API_KEY'],'Content-Type':'application/json'})
      resp=json.load(urllib.request.urlopen(req,timeout=600)); break
    except Exception as e:
      err=str(e); time.sleep(5); resp=None
  if not resp or 'choices' not in resp: status='api_error'; log.write(json.dumps({'error':str(resp)[:500] if resp else err})+'\n'); break
  u=resp.get('usage',{}); c=float(u.get('cost') or 0); cost+=c; tok_in+=u.get('prompt_tokens',0); tok_out+=u.get('completion_tokens',0)
  open(LEDGER,'a').write(json.dumps({'run':f'{task}/{label}','turn':turns,'cost':c})+'\n')
  m=resp['choices'][0]['message']; log.write(json.dumps({'turn':turns,'msg':{k:m.get(k) for k in ('content','tool_calls')},'usage':u})+'\n'); log.flush()
  am={"role":"assistant","content":m.get('content') or ''}
  if m.get('tool_calls'): am['tool_calls']=m['tool_calls']
  if m.get('reasoning_details'): am['reasoning_details']=m['reasoning_details']
  msgs.append(am)
  if not m.get('tool_calls'): break
  for tc in m['tool_calls']:
    try: a=json.loads(tc['function']['arguments'] or '{}')
    except Exception: a={}
    out=call_tool(tc['function']['name'],a); msgs.append({"role":"tool","tool_call_id":tc['id'],"content":out})
    log.write(json.dumps({'tool':tc['function']['name'],'args':{k:(v[:300] if isinstance(v,str) else v) for k,v in a.items()},'out':out[:600]})+'\n')
else: status='max_turns'
meta={'model':model,'label':label,'task':task,'status':status,'turns':turns,'seconds':round(time.time()-t0,1),'cost_usd':round(cost,5),'prompt_tokens':tok_in,'completion_tokens':tok_out,'total_spent_so_far':round(spent(),4)}
json.dump(meta,open(f'{D}/meta.json','w'),indent=1); print(json.dumps(meta))
