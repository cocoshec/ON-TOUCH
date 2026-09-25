#!/usr/bin/env python3
"""
Sube los cambios al hosting por FTP, transfiriendo sólo lo que cambió.

Guarda la huella (SHA-256) de cada archivo enviado en .deploy-state.json, así
que en la segunda subida y siguientes sólo viajan los archivos modificados.
Nunca borra nada del servidor.

Configuración: añade estas líneas a tu archivo .env (no se sube nunca).

    FTP_HOST=on-touch.net
    FTP_USER=clientes@on-touch.net
    FTP_PASS=tu-contrasena
    FTP_DIR=/             # / si la cuenta FTP está anclada a la carpeta del sitio
    FTP_TLS=true          # ponlo en false sólo si tu hosting no admite FTPS

Uso:
    python tools/subir.py              # sube lo que cambió
    python tools/subir.py --simular    # muestra qué subiría, sin subir nada
    python tools/subir.py --todo       # fuerza la subida completa
"""

import ftplib
import hashlib
import io
import json
import os
import ssl
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIGEN = os.path.join(RAIZ, 'deploy')
ESTADO = os.path.join(RAIZ, '.deploy-state.json')


def leer_env():
    """Lee el .env sin depender de librerías externas."""
    cfg = {}
    ruta = os.path.join(RAIZ, '.env')
    if not os.path.exists(ruta):
        sys.exit('No encuentro .env en la raíz del proyecto.')
    for linea in io.open(ruta, encoding='utf-8'):
        linea = linea.strip()
        if not linea or linea.startswith('#') or '=' not in linea:
            continue
        clave, valor = linea.split('=', 1)
        cfg[clave.strip()] = valor.split('#')[0].strip().strip('"').strip("'")
    return cfg


def huella(ruta):
    h = hashlib.sha256()
    with open(ruta, 'rb') as f:
        for bloque in iter(lambda: f.read(65536), b''):
            h.update(bloque)
    return h.hexdigest()


def listar_local():
    """Devuelve {ruta_relativa: huella} de todo lo que hay en deploy/."""
    archivos = {}
    for base, _, ficheros in os.walk(ORIGEN):
        for f in ficheros:
            completa = os.path.join(base, f)
            rel = os.path.relpath(completa, ORIGEN).replace(os.sep, '/')
            archivos[rel] = huella(completa)
    return archivos


def conectar(cfg):
    host = cfg.get('FTP_HOST')
    user = cfg.get('FTP_USER')
    pwd = cfg.get('FTP_PASS')
    if not (host and user and pwd):
        sys.exit('Faltan FTP_HOST, FTP_USER o FTP_PASS en .env')

    usar_tls = cfg.get('FTP_TLS', 'true').lower() != 'false'

    if usar_tls:
        try:
            ctx = ssl.create_default_context()
            # Muchos hostings compartidos usan certificados que no validan
            # contra el nombre del dominio; el cifrado sigue siendo real.
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            ftp = ftplib.FTP_TLS(context=ctx, timeout=30)
            ftp.connect(host, int(cfg.get('FTP_PORT', 21)))
            ftp.login(user, pwd)
            ftp.prot_p()          # cifra también el canal de datos
            print('Conectado por FTPS (cifrado) a %s' % host)
            return ftp
        except Exception as e:
            print('FTPS no disponible (%s)' % e)
            print('AVISO: se usará FTP sin cifrar; tu contraseña viaja en claro.')
            respuesta = input('¿Continuar de todos modos? [s/N] ').strip().lower()
            if respuesta != 's':
                sys.exit('Cancelado.')

    ftp = ftplib.FTP(timeout=30)
    ftp.connect(host, int(cfg.get('FTP_PORT', 21)))
    ftp.login(user, pwd)
    print('Conectado por FTP a %s' % host)
    return ftp


def asegurar_carpeta(ftp, ruta):
    """Crea la ruta remota si no existe, nivel a nivel."""
    actual = ''
    for parte in ruta.strip('/').split('/'):
        if not parte:
            continue
        actual += '/' + parte
        try:
            ftp.mkd(actual)
        except ftplib.error_perm:
            pass  # ya existía


def main():
    simular = '--simular' in sys.argv
    todo = '--todo' in sys.argv

    if not os.path.isdir(ORIGEN):
        sys.exit('No existe deploy/. Ejecuta antes:  python tools/preparar-deploy.py')

    locales = listar_local()
    previos = {}
    if os.path.exists(ESTADO) and not todo:
        previos = json.load(io.open(ESTADO, encoding='utf-8'))

    pendientes = sorted(r for r, h in locales.items() if previos.get(r) != h)

    if not pendientes:
        print('Todo está al día: no hay nada que subir.')
        return

    print('\n%d archivo(s) por subir:' % len(pendientes))
    for r in pendientes[:25]:
        print('   %s' % r)
    if len(pendientes) > 25:
        print('   … y %d más' % (len(pendientes) - 25))

    if simular:
        print('\n(simulación: no se subió nada)')
        return

    cfg = leer_env()
    destino = cfg.get('FTP_DIR', '/').rstrip('/')
    ftp = conectar(cfg)

    # Enseña dónde aterrizó la sesión, para poder confirmar que la cuenta FTP
    # está anclada en la carpeta correcta del sitio antes de subir nada.
    try:
        print('Carpeta remota de inicio: %s' % ftp.pwd())
    except Exception:
        pass
    print('Los archivos se escribirán en: %s/<archivo>' % (destino or ''))

    creadas = set()
    subidos = 0
    try:
        for rel in pendientes:
            carpeta = os.path.dirname(rel)
            if carpeta and carpeta not in creadas:
                asegurar_carpeta(ftp, destino + '/' + carpeta)
                creadas.add(carpeta)

            local = os.path.join(ORIGEN, rel.replace('/', os.sep))
            with open(local, 'rb') as f:
                ftp.storbinary('STOR ' + destino + '/' + rel, f)

            previos[rel] = locales[rel]
            subidos += 1
            print('  subido  %s' % rel)
    finally:
        try:
            ftp.quit()
        except Exception:
            ftp.close()
        # Guardamos el avance aunque se corte a medias, para no repetir trabajo
        json.dump(previos, io.open(ESTADO, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)

    print('\n%d archivo(s) subidos correctamente.' % subidos)
    print('Comprueba el resultado en https://on-touch.net (Ctrl+Shift+R para saltarte la caché).')


if __name__ == '__main__':
    main()
