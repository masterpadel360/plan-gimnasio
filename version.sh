#!/bin/sh
# Sube la versión de los archivos para que el iPhone baje la app nueva. Uso: sh version.sh
cd "$(dirname "$0")" && V=$(date +%Y%m%d%H%M)
sed -i -E "s#css/app.css(\?v=[0-9]+)?\"#css/app.css?v=$V\"#; s#js/app.js(\?v=[0-9]+)?\"#js/app.js?v=$V\"#" index.html
sed -i -E "s#'./muneco.js(\?v=[0-9]+)?'#'./muneco.js?v=$V'#" js/app.js
echo "Versión $V"
