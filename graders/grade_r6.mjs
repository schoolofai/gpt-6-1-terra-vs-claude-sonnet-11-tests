const dir=process.argv[2];
const {Cart}=await import(dir+'/src/cart.js'); const co=await import(dir+'/src/checkout.js');
const res={};
// bug1 discount once: 100 with SAVE10 -> 90
try{const c=new Cart();c.add({id:1,price:100},1);c.applyDiscount('SAVE10');const t=co.total(c);res.discount_once=Math.abs(Number(t)-90)<0.001||Number(t)===9000;res.d=t}catch(e){res.discount_once='ERR '+e.message}
// bug2 money: 0.1+0.2 style
try{const c=new Cart();c.add({id:1,price:0.1},1);c.add({id:2,price:0.2},1);c.add({id:3,price:60},1);const t=co.total(c);res.float_t=t;const f=co.formatTotal?co.formatTotal(c):'';res.fmt=f;res.money_exact=(t===60.3||t===6030)&&(!f||/^£60\.30$/.test(f))}catch(e){res.money_exact='ERR '+e.message}
// bug3 negative qty
let neg=true;try{const c=new Cart();c.add({id:1,price:10},-2);neg=c.items.some(i=>i.qty<=0)}catch(e){neg=false}
let neg2=true;try{const c=new Cart();c.add({id:1,price:10},1);c.setQty(1,-2);neg2=c.items.some(i=>i.qty<=0)}catch(e){neg2=false}
res.negative_blocked=!neg&&!neg2;
console.log(JSON.stringify(res));
