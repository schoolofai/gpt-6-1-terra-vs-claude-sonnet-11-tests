#!/usr/bin/env node
const city=(process.argv[2]||'').toLowerCase();
const d={london:{day1:'Light rain, 12°C, wind 18 km/h',day2:'Cloudy, 14°C, wind 10 km/h'},manchester:{day1:'Heavy rain, 10°C, wind 25 km/h',day2:'Sunny intervals, 13°C, wind 12 km/h'}};
if(!d[city]){console.log(JSON.stringify({error:'unknown city'}));process.exit(1)}
console.log(JSON.stringify({city,forecast:d[city]}));
