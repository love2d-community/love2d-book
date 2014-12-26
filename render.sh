#!/bin/bash

mkdir -p tmp
mkdir -p public/paged
./asciidoctor book/html.adoc -o public/index.html
./asciidoctor book/pdf.adoc -o public/love2D-book.pdf -b pdf

#for f in book/*/*.adoc; do
#    ./asciidoctor $f -o "public/paged/$( echo $f | sed -e 's/book\/world//' -e 's/\.ad/.html/' -e 's/\//-/g')"
#done
