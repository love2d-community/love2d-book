#!/bin/bash

./lovedoctor.rb book/html.adoc -o public/index.html
./lovedoctor.rb book/pdf.adoc -o public/love2D-book.pdf -b pdf

#mkdir -p public/paged
#for f in book/world*/*.adoc; do
#    ./lovedoctor $f -o "public/paged/$( echo $f | sed -e 's/book\/world//' -e 's/\.ad/.html/' -e 's/\//-/g')"
#done
