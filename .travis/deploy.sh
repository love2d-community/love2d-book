#!/bin/bash
set -ev
if [ "${TRAVIS_BRANCH}" = "master" ]; then
  eval "$(ssh-agent -s)"
  chmod 600 .travis/deploy_key.pem
  ssh-add .travis/deploy_key.pem

  cd public
  git remote add pages $REPO_URI
  # git remote add io     $REPO_IO_URI

  git config --global user.email "travis@splashes"
  git config --global user.name "Travis Build Bot"

  git add .
  git commit -m "Update to ${TRAVIS_COMMIT}"

  git push pages HEAD:gh-pages
  # git push io gh-pages:master
fi
