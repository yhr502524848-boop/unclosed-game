const fs=require('node:fs'),path=require('node:path');
const file=path.join(__dirname,'index.html');
const bundle=['data.js','model.js','ui.js'].map(name=>fs.readFileSync(path.join(__dirname,name),'utf8')).join('\n');
const html=fs.readFileSync(file,'utf8');
if(!/<script>[\s\S]*<\/script>/.test(html))throw new Error('Missing game script');
fs.writeFileSync(file,html.replace(/<script>[\s\S]*<\/script>/,()=>'<script>'+bundle.replace(/<\/script/gi,'<\\/script')+'</script>'));
console.log('Built index.html');
