// DevAI Bridge v3.0 — ZERO npm deps. Same protocol as bridge.py but in Node.
// Website POST /send-studio {title,type,target,code} -> queues for plugin
// Plugin  GET  /poll-studio -> returns queued messages
// Plugin  POST /send-web   {kind,data,...} -> queues for website
// Website GET  /poll-web   -> returns queued messages
// Status GET /status
// Root / -> HTML landing page with link to GitHub Pages site
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 42069;
const SITE_DIR = path.join(__dirname,'..','site');
let studioQueue = [];
let webQueue = [];
let paired = false;

function sendJSON(res,code,o){
  const body=Buffer.from(JSON.stringify(o),'utf8');
  res.writeHead(code,{
    'Content-Type':'application/json',
    'Content-Length':body.length,
    'Access-Control-Allow-Origin':'*',
    'Access-Control-Allow-Methods':'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers':'Content-Type',
  });
  res.end(body);
}

const MIME = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.zip':'application/zip','.bat':'application/octet-stream','.lua':'text/plain'};

const server = http.createServer((req,res)=>{
  const u = url.parse(req.url,true);
  const p = u.pathname;
  // CORS preflight
  if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'});return res.end();}

  if(req.method==='POST'){
    let raw='';req.on('data',c=>raw+=c);req.on('end',()=>{
      let data={};try{data=raw?JSON.parse(raw):{};}catch(e){}
      if(p==='/send-studio'){studioQueue.push(data);paired=true;return sendJSON(res,200,{ok:true,queued:studioQueue.length});}
      if(p==='/send-web'){webQueue.push(data);paired=true;return sendJSON(res,200,{ok:true});}
      return sendJSON(res,404,{error:'not found'});
    });return;
  }

  // GET
  if(p==='/status'){return sendJSON(res,200,{ok:true,paired,queuedStudio:studioQueue.length,queuedWeb:webQueue.length});}
  if(p==='/poll-studio'){const m=studioQueue.slice();studioQueue.length=0;paired=true;return sendJSON(res,200,{messages:m});}
  if(p==='/poll-web'){const m=webQueue.slice();webQueue.length=0;return sendJSON(res,200,{messages:m});}

  // Serve static site files
  let fp = p==='/'?'/index.html':p;
  fp = path.join(SITE_DIR,fp);
  if(!fp.startsWith(SITE_DIR)){res.writeHead(403);return res.end('forbidden');}
  fs.readFile(fp,(err,data)=>{
    if(err){
      // fallback to landing page
      if(p==='/'){
        res.writeHead(200,{'Content-Type':'text/html'});
        return res.end(`<!doctype html><html><head><title>DevAI Bridge</title>
<style>body{font-family:Georgia,serif;background:#14100c;color:#eadfc5;padding:60px;text-align:center;}h1{color:#ebbf5b}a{color:#c99a3e}</style>
</head><body><h1>⚔ DevAI Bridge running</h1><p style="color:#a69470">Port ${PORT} — keep this window open.</p><p><a href="https://enestrupi.github.io/DevAI/?connected=local" target="_blank">Open DevAI website →</a></p></body></html>`);
      }
      res.writeHead(404);return res.end('not found');
    }
    const ext=path.extname(fp).toLowerCase();
    res.writeHead(200,{'Content-Type':MIME[ext]||'application/octet-stream'});res.end(data);
  });
});

server.listen(PORT,'127.0.0.1',()=>{
  console.log('============================================================');
  console.log('  ⚔ DevAI Bridge v3.0 running on http://127.0.0.1:'+PORT);
  console.log('  Keep this window open while using DevAI.');
  console.log('============================================================');
  // Open browser
  const start = process.platform==='win32'?'start':process.platform==='darwin'?'open':'xdg-open';
  try{require('child_process').exec(start+' http://127.0.0.1:'+PORT+'/');}catch(e){}
});
