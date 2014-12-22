#!/bin/bash

mkdir -p tmp
mkdir -p public/paged
./asciidoctor book/html.ad -o public/index.html
./asciidoctor book/pdf.ad -o public/love2D-book.pdf -b pdf

#for f in book/*/*.ad; do
#    ./asciidoctor $f -o "public/paged/$( echo $f | sed -e 's/book\/world//' -e 's/\.ad/.html/' -e 's/\//-/g')"
#done
