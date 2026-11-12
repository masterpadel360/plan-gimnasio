#!/bin/sh
# Sube la versión de los archivos para que el iPhone baje la app nueva. Uso: sh version.sh
cd "$(dirname "$0")" && V=$(date +%Y%m%d%H%M)
sed -i -E "s#css/app.css(\?v=[0-9]+)?\"#css/app.css?v=$V\"#; s#js/app.js(\?v=[0-9]+)?\"#js/app.js?v=$V\"#; s#js/firebase-config.js(\?v=[0-9]+)?\"#js/firebase-config.js?v=$V\"#" index.html
sed -i -E "s#'\./(muneco|nube)\.js(\?v=[0-9]+)?'#'./\1.js?v=$V'#g" js/app.js
echo "Versión $V"
