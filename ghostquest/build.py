import base64, os, shutil, zipfile
t=open('src/index.template.html').read(); l=open('src/logic.js').read()
os.makedirs('dist',exist_ok=True)
assert '/*__LOGIC__*/' in t and '<!--__APPHEAD__-->' in t
page=t.replace('/*__LOGIC__*/',l)

def doc(page, extra_head, extra_body_end=''):
    """Full HTML document for hosting outside the Claude viewer (adds viewport, app meta, safe-area padding)."""
    cut=page.index('</style>')+len('</style>')
    head,body=page[:cut],page[cut:]
    meta='''<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="GhostQuest">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="theme-color" content="#04060d">
<style>html{box-sizing:border-box;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);background:#04060d}</style>
'''
    return meta+head.replace('<!--__APPHEAD__-->',extra_head)+'</head><body>'+body.replace('</script>\n<script>','</script>\n<script>',1)+extra_body_end+'</body></html>'

# 1) Claude artifact (assets published beside it, no map library)
open('dist/index.html','w').write(page.replace('<!--__APPHEAD__-->',''))

# 2) single-file copy with the artwork embedded
def uri(p,m): return 'data:%s;base64,%s'%(m,base64.b64encode(open(p,'rb').read()).decode())
emb={'assets/world.jpg':uri('assets/world.jpg','image/jpeg'),'assets/wordmark.png':uri('assets/wordmark.png','image/png'),'assets/logo.jpg':uri('assets/logo.jpg','image/jpeg'),'assets/icon.jpg':uri('assets/icon.jpg','image/jpeg')}
s=page
for k,v in emb.items(): s=s.replace("'%s'"%k,"'%s'"%v)
open('dist/ghostquest.html','w').write(doc(s,'<link rel="apple-touch-icon" href="%s">'%emb['assets/icon.jpg']))

# 3) installable app folder (hosted): map library, manifest, service worker, icons
out='dist/app'; shutil.rmtree(out,ignore_errors=True); os.makedirs(out+'/assets')
for f in os.listdir('assets'): shutil.copy('assets/'+f,out+'/assets/'+f)
shutil.copytree('app-extra/icons',out+'/icons'); shutil.copy('app-extra/manifest.webmanifest',out); shutil.copy('app-extra/sw.js',out)
LEAF_CSS='<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">'
LEAF_JS='<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>\n'
head='<link rel="manifest" href="manifest.webmanifest">\n<link rel="apple-touch-icon" href="icons/icon-180.png">\n'+LEAF_CSS
app=page.replace('<script>\n/*','<script>\n/*',1)
first=app.index('<script>'); app=app[:first]+LEAF_JS+app[first:]
reg="<script>if('serviceWorker' in navigator && location.protocol.indexOf('http')===0){window.addEventListener('load',function(){navigator.serviceWorker.register('sw.js').catch(function(){});});}</script>\n"
open(out+'/index.html','w').write(doc(app,head,reg))
open(out+'/README.txt','w').write(open('app-extra/README.txt').read())
shutil.rmtree('docs',ignore_errors=True); shutil.copytree(out,'docs')   # GitHub Pages can serve this folder directly
with zipfile.ZipFile('dist/ghostquest-app.zip','w',zipfile.ZIP_DEFLATED) as z:
    for root,_,files in os.walk(out):
        for f in files:
            p=os.path.join(root,f); z.write(p,os.path.relpath(p,out))
print('ok', sorted(os.path.relpath(os.path.join(r,f),out) for r,_,fs in os.walk(out) for f in fs))
print('zip KB',os.path.getsize('dist/ghostquest-app.zip')//1024)
