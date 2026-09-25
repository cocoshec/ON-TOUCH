#!/usr/bin/env python3
"""
Prepara el paquete listo para subir a cPanel.

Copia a deploy/ sólo lo que debe vivir en public_html, cambia el destino del
formulario a mail.php (cPanel no ejecuta Node) y comprime todo en un ZIP.

Uso:
    python tools/preparar-deploy.py
"""

import io
import os
import shutil
import zipfile

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SALIDA = os.path.join(RAIZ, 'deploy')
ZIP = os.path.join(RAIZ, 'on-touch-web.zip')

# Lo que sí se publica
ARCHIVOS = [
    'index.html',
    'proyectos.html',
    '404.html',
    'mail.php',
    '.htaccess',
    'favicon.ico',
    'robots.txt',
    'sitemap.xml',
    'site.webmanifest',
]
CARPETAS = ['assets']

# Lo que NUNCA se publica (se comprueba al final, por seguridad)
PROHIBIDOS = {'.env', 'package.json', 'package-lock.json', 'server.js', 'README.md'}


def main():
    if os.path.isdir(SALIDA):
        shutil.rmtree(SALIDA)
    os.makedirs(SALIDA)

    for nombre in ARCHIVOS:
        origen = os.path.join(RAIZ, nombre)
        if not os.path.exists(origen):
            print('  AVISO: falta ' + nombre)
            continue
        shutil.copy2(origen, os.path.join(SALIDA, nombre))

    for carpeta in CARPETAS:
        shutil.copytree(os.path.join(RAIZ, carpeta), os.path.join(SALIDA, carpeta))

    # El HTML no se toca: index.html ya apunta a mail.php, igual que en
    # producción. Lo comprobamos por si alguien lo cambia sin querer.
    html = io.open(os.path.join(SALIDA, 'index.html'), encoding='utf-8').read()
    if 'data-endpoint="mail.php"' not in html:
        raise SystemExit('ABORTADO: el formulario no apunta a mail.php')
    print('  formulario: mail.php  (sin reescrituras)')

    # Comprobación de seguridad
    colados = []
    for base, _, ficheros in os.walk(SALIDA):
        for f in ficheros:
            if f in PROHIBIDOS:
                colados.append(os.path.relpath(os.path.join(base, f), SALIDA))
    if colados:
        raise SystemExit('ABORTADO: archivos que no deben publicarse: ' + ', '.join(colados))

    # ZIP con las rutas relativas a la raíz del sitio
    if os.path.exists(ZIP):
        os.remove(ZIP)
    total = 0
    with zipfile.ZipFile(ZIP, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for base, _, ficheros in os.walk(SALIDA):
            for f in sorted(ficheros):
                ruta = os.path.join(base, f)
                z.write(ruta, os.path.relpath(ruta, SALIDA))
                total += 1

    print('\n%d archivos empaquetados' % total)
    print('carpeta : %s' % SALIDA)
    print('zip     : %s  (%.0f KB)' % (ZIP, os.path.getsize(ZIP) / 1024))


if __name__ == '__main__':
    main()
