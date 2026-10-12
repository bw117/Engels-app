const http=require("http"),fs=require("fs"),path=require("path");
const PORT=process.env.PORT||3000,ROOT=__dirname;
const mime={".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8",".svg":"image/svg+xml"};
function send(res,status,body,type="text/plain; charset=utf-8"){res.writeHead(status,{"Content-Type":type});res.end(body)}
http.createServer((req,res)=>{
 const url=new URL(req.url,"http://"+req.headers.host);
 if(url.pathname==="/api/health") return send(res,200,JSON.stringify({ok:true,version:"1.3.0"}),mime[".json"]);
 let pathname=decodeURIComponent(url.pathname==="/" ? "/index.html":url.pathname);
 const file=path.normalize(path.join(ROOT,pathname));
 if(!file.startsWith(ROOT)) return send(res,403,"Forbidden");
 fs.readFile(file,(err,data)=>{if(err)return send(res,404,"Not found");send(res,200,data,mime[path.extname(file)]||"application/octet-stream")});
}).listen(PORT,()=>console.log("Engels-app running at http://localhost:"+PORT));