#!/usr/bin/env node
const fs=require('fs'),path=require('path');const q=(process.argv.slice(2).join(' ')).toLowerCase();
const dir=path.join(__dirname,'..','docs');const hits=fs.readdirSync(dir).filter(f=>fs.readFileSync(path.join(dir,f),'utf8').toLowerCase().includes(q.split(' ')[0]||'#'));
console.log(JSON.stringify(hits.map(f=>({file:f,content:fs.readFileSync(path.join(dir,f),'utf8')}))));
