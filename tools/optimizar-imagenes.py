#!/usr/bin/env python3
"""
Optimizador de imágenes para el sitio de On-Touch Consulting.

Convierte cualquier PNG/JPG a WebP, recorta el margen sobrante y genera los
tamaños que usa la web. Úsalo cada vez que recibas capturas de proyectos
nuevas o el logotipo de un cliente nuevo.

Requisito (una sola vez):
    python -m pip install pillow

Uso:
    # Capturas de proyectos: genera versión grande + miniatura
    python tools/optimizar-imagenes.py proyecto  C:/ruta/captura.png  nombre-del-proyecto

    # Logotipo de cliente: recorta el fondo y lo deja listo para la marquesina
    python tools/optimizar-imagenes.py cliente  C:/ruta/logo.png  nombre-del-cliente

    # Carpeta completa de logotipos de una vez
    python tools/optimizar-imagenes.py clientes-carpeta  C:/ruta/carpeta

Después de ejecutarlo, el script imprime el HTML listo para pegar.
"""

import os
import re
import sys

try:
    from PIL import Image, ImageChops
except ImportError:
    sys.exit('Falta Pillow. Instálalo con:  python -m pip install pillow')

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR_PROYECTOS = os.path.join(RAIZ, 'assets', 'img', 'proyectos')
DIR_CLIENTES = os.path.join(RAIZ, 'assets', 'img', 'clientes')


def slug(texto):
    """Convierte 'Monte Café S.A.' en 'monte-cafe-s-a'."""
    t = texto.lower()
    for a, b in (('á', 'a'), ('é', 'e'), ('í', 'i'), ('ó', 'o'), ('ú', 'u'), ('ñ', 'n')):
        t = t.replace(a, b)
    return re.sub(r'-+', '-', re.sub(r'[^a-z0-9]+', '-', t)).strip('-')


def recortar_margen(im):
    """Elimina el borde uniforme (blanco o transparente) alrededor del motivo."""
    if im.mode == 'RGBA':
        caja = im.getchannel('A').getbbox()
    else:
        fondo = Image.new('RGB', im.size, im.getpixel((0, 0)))
        caja = ImageChops.difference(im, fondo).convert('L').point(
            lambda p: 255 if p > 18 else 0).getbbox()
    if caja and (caja[2] - caja[0]) > 20 and (caja[3] - caja[1]) > 20:
        return im.crop(caja)
    return im


def kb(ruta):
    return f'{os.path.getsize(ruta) / 1024:.0f} KB'


def proyecto(origen, nombre):
    """Captura de pantalla: versión grande para el visor + miniatura para la tarjeta."""
    os.makedirs(DIR_PROYECTOS, exist_ok=True)
    nombre = slug(nombre)
    im = Image.open(origen).convert('RGB')
    original = im.size

    grande = im.copy()
    grande.thumbnail((1600, 1200), Image.LANCZOS)
    p_grande = os.path.join(DIR_PROYECTOS, f'{nombre}.webp')
    grande.save(p_grande, 'WEBP', quality=84, method=6)

    mini = im.copy()
    mini.thumbnail((800, 600), Image.LANCZOS)
    p_mini = os.path.join(DIR_PROYECTOS, f'{nombre}-thumb.webp')
    mini.save(p_mini, 'WEBP', quality=80, method=6)

    print(f'  {original[0]}x{original[1]}  ->  grande {grande.size[0]}x{grande.size[1]} ({kb(p_grande)})'
          f'  |  miniatura {mini.size[0]}x{mini.size[1]} ({kb(p_mini)})')

    print('\n--- Pega esto dentro de #projects-grid en proyectos.html ---\n')
    print(f'''<article class="project project--administracion grid-item administracion" data-reveal>
  <div class="project__media">
    <img src="assets/img/proyectos/{nombre}-thumb.webp"
         alt="DESCRIBE AQUÍ LA PANTALLA"
         width="{mini.size[0]}" height="{mini.size[1]}" loading="lazy" decoding="async">
    <div class="project__overlay">
      <button class="project__zoom" type="button"
              data-lightbox="assets/img/proyectos/{nombre}.webp"
              data-caption="TÍTULO DEL PROYECTO"
              aria-label="Ampliar imagen: TÍTULO DEL PROYECTO">
        <i class="fa-solid fa-expand" aria-hidden="true"></i>
      </button>
    </div>
  </div>
  <div class="project__body">
    <span class="project__tag">Administración</span>
    <h2 class="project__title">TÍTULO DEL PROYECTO</h2>
    <p>Una o dos frases sobre qué resuelve este sistema.</p>
  </div>
</article>''')
    print('\nAjusta la clase de color (project--administracion / --comercial /')
    print('--nominas / --distribucion / --produccion / --movil) y la de filtro.')


def cliente(origen, nombre):
    """Logotipo de cliente para la marquesina."""
    os.makedirs(DIR_CLIENTES, exist_ok=True)
    nombre_archivo = slug(nombre)
    im = Image.open(origen)
    im = im.convert('RGBA') if im.mode in ('RGBA', 'LA', 'P') else im.convert('RGB')
    im = recortar_margen(im)
    im.thumbnail((360, 200), Image.LANCZOS)

    destino = os.path.join(DIR_CLIENTES, f'{nombre_archivo}.webp')
    im.save(destino, 'WEBP', quality=86, method=6)
    print(f'  {nombre} -> {nombre_archivo}.webp  {im.size[0]}x{im.size[1]}  ({kb(destino)})')
    return f'''<div class="logo-chip"><img src="assets/img/clientes/{nombre_archivo}.webp" alt="{nombre}" width="{im.size[0]}" height="{im.size[1]}" loading="lazy" decoding="async"></div>'''


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        return 1

    modo = sys.argv[1]

    if modo == 'proyecto':
        if len(sys.argv) < 4:
            return print('Falta el nombre. Ej: python tools/optimizar-imagenes.py proyecto foto.png hoteleria') or 1
        proyecto(sys.argv[2], sys.argv[3])

    elif modo == 'cliente':
        if len(sys.argv) < 4:
            return print('Falta el nombre del cliente.') or 1
        print('\n--- Pega esto en la marquesina de #clientes en index.html ---\n')
        print(cliente(sys.argv[2], sys.argv[3]))

    elif modo == 'clientes-carpeta':
        carpeta = sys.argv[2]
        etiquetas = []
        for archivo in sorted(os.listdir(carpeta)):
            if not archivo.lower().endswith(('.png', '.jpg', '.jpeg', '.webp', '.gif')):
                continue
            base = os.path.splitext(archivo)[0]
            etiquetas.append(cliente(os.path.join(carpeta, archivo), base))
        print(f'\n{len(etiquetas)} logotipos listos.')
        print('\n--- Pega esto en la marquesina de #clientes en index.html ---\n')
        print('\n'.join('          ' + e for e in etiquetas))

    else:
        print(__doc__)
        return 1

    return 0


if __name__ == '__main__':
    sys.exit(main())
