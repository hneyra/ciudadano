# Renderiza el paso 1 del artboard: el helmet (12-50), la barra sin sesion (59-75), la franja con
# `paso = 'buscar'` (evaluando 1065-1078), la plantilla de buscar (121-180) con las expresiones
# de 1080-1101 evaluadas y el pie (675-684). Dos estados: en reposo y con el error de vacio.
import re, json
FE='/tmp/claude-1000/-home-jorge-ws-ciudadano/ae63e912-83b6-4026-817c-169e14c25ecf/scratchpad/obra/ciudadano/frontend'
D='/tmp/claude-1000/-home-jorge-ws-ciudadano/ae63e912-83b6-4026-817c-169e14c25ecf/scratchpad/capturas5'
lineas=open(FE+'/diseno/Ciudadano.dc.html').read().split('\n')
todo='\n'.join(lineas)
L=lambda a,b: '\n'.join(lineas[a-1:b])
estilo=re.search(r'<helmet>[\s\S]*?(<style>[\s\S]*?</style>)', todo).group(1)
IN=re.search(r"const IN = '([^']*)';", todo).group(1)
ICO={k: re.findall(r"'([^']*)'", v) for k,v in re.findall(r"^  (\w+): \[([^\]]*)\]", re.search(r"const ICO = \{([\s\S]*?)\n\};", todo).group(1), re.M)}
barra=L(59,68)+'\n'+L(70,75)+'\n  </div>'
AZUL='#0D5FA8'; VERDE_BG='#DFF0D8'; VERDE_FG='#3C763D'
PASOS=[('buscar','Buscar mi deuda'),('deudas','Elegir qué pago'),('identificar','Mis datos'),('pagar','Pagar'),('listo','Comprobante')]
paso='buscar'; iPaso=0
botones=[]
for i,(k,label) in enumerate(PASOS):
    on=k==paso; hecho=i<iPaso; alcanzable=i<=iPaso
    numStyle='display:grid; place-items:center; width:24px; height:24px; border-radius:50%; flex:0 0 auto; font-size:12.5px; font-weight:700; background:'+(AZUL if on else (VERDE_BG if hecho else '#EEE'))+'; color:'+('#fff' if on else (VERDE_FG if hecho else '#999'))
    style='display:flex; align-items:center; gap:9px; min-height:48px; border:0; border-bottom:3px solid '+(AZUL if on else 'transparent')+'; background:transparent; padding:0 15px; cursor:'+('pointer' if alcanzable else 'default')+'; font-size:14px; color:'+('#333' if on else ('#555' if hecho else '#AAA'))+'; font-weight:'+('700' if on else '400')
    botones.append(f'<button aria-current="{"step" if on else "false"}" style="{style}"><span style="{numStyle}">{i+1}</span><span data-sm-hide="1" style="white-space:nowrap">{label}</span></button>')
franja=L(106,107)+'\n'+'\n'.join(botones)+'\n      </div>\n    </div>'

CAPACIDADES=[
 ['Ver lo que debe', 'Su impuesto predial, arbitrios y vehicular, con el vencimiento de cada cuota.', 'buscar'],
 ['Pagar en línea', 'Con tarjeta, Yape, pagalo.pe o un código para el banco.', 'pagar'],
 ['Descargar comprobantes', 'El del pago que acaba de hacer y los de años anteriores.', 'recibo'],
 ['Saber de dónde sale', 'El autovalúo de su predio, los metros de frontis y la tabla que se le aplica.', 'detalle']]
# Comprobado contra las lineas 1093-1096, para no capturar un texto que no es el del artboard.
for t,d,_ in CAPACIDADES: assert t in L(1093,1096) and d in L(1093,1096)

def buscar(error):
    b=L(121,180)
    b=re.sub(r'<sc-for list="\{\{ tiposBusqueda \}\}"[^>]*>\s*<option value="\{\{ o \}\}">\{\{ o \}\}</option>\s*</sc-for>',
             ''.join(f'<option value="{o}">{o}</option>' for o in ['Código de contribuyente','DNI','RUC']), b)
    tpl=re.search(r'<sc-for list="\{\{ capacidades \}\}"[^>]*>([\s\S]*?)</sc-for>\s*</div>\s*</div>\s*</div>', b)
    item=tpl.group(1)
    items=''
    for t,d,ic in CAPACIDADES:
        x=re.sub(r'<sc-for list="\{\{ c\.icon \}\}"[^>]*>\s*<path d="\{\{ p\.d \}\}"></path>\s*</sc-for>', ''.join(f'<path d="{p}"></path>' for p in ICO[ic]), item)
        x=x.replace('{{ c.style }}','padding:14px 18px 16px 0; margin-right:18px; border-top:1px solid #E4E4E4').replace('{{ c.titulo }}',t).replace('{{ c.detalle }}',d)
        items+=x
    b=b.replace(tpl.group(1), items, 1)
    b=b.replace('<sc-for list="{{ capacidades }}" as="c" hint-placeholder-count="4">','',1)
    b=b.replace('{{ inputStyle }}',IN).replace('{{ etiquetaBusqueda }}','Código de contribuyente').replace('{{ placeholderBusqueda }}','00000025673').replace(' value="{{ q }}"','').replace(' value="{{ tipoBusqueda }}"','')
    msg='Escriba su código de contribuyente o su documento para poder buscar.'
    if error:
        b=re.sub(r'<sc-if value="\{\{ errorBusqueda \}\}">([\s\S]*?)</sc-if>', lambda m: m.group(1).replace('{{ errorBusqueda }}', msg), b)
    else:
        b=re.sub(r'<sc-if value="\{\{ errorBusqueda \}\}">[\s\S]*?</sc-if>','',b)
    b=b.replace('<sc-if value="{{ esBuscar }}">','').replace('</sc-if>','')
    return b
pie=L(675,684)
for nombre,error in [('reposo',False),('error',True)]:
    html=f'<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">{estilo}</head><body>'+L(53,53)+barra+franja+L(118,119)+buscar(error)+'</div></div>'+pie+'</div></body></html>'
    html=html.replace('{{ entidad }}','Municipalidad Distrital de Catacaos').replace('src="escudo-catacaos.png"','src="file://'+FE+'/diseno/escudo-catacaos.png"')
    html=re.sub(r' onClick="\{\{ [a-zA-Z]+ \}\}"','',html)
    html=re.sub(r' onChange="\{\{ [a-zA-Z]+ \}\}"','',html)
    html=re.sub(r' style-hover="[^"]*"','',html).replace('<sc-if value="{{ anonimo }}">','').replace('</sc-if>','')
    assert '{{' not in html, re.findall(r'\{\{[^}]*\}\}',html)
    assert '<sc-' not in html, re.findall(r'<sc-[^>]*>',html)
    open(f'{D}/artboard-{nombre}.html','w').write(html)
    print('ok', nombre, len(html))
