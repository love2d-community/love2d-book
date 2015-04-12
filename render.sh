#!/bin/bash

mkdir -p tmp
./asciidoctor book/html.adoc -o public/index.html "$@"
./asciidoctor book/pdf.adoc -o public/love2D-book.pdf -b pdf "$@"

#mkdir -p public/paged
#for f in book/world*/*.adoc; do
#    ./asciidoctor $f -o "public/paged/$( echo $f | sed -e 's/book\/world//' -e 's/\.ad/.html/' -e 's/\//-/g')"
#done
