#!/bin/bash
set -ev
if [ "${TRAVIS_BRANCH}" = "master" ]; then
  eval "$(ssh-agent -s)"
  chmod 600 .travis/deploy_key.pem
  ssh-add .travis/deploy_key.pem

  cd public
  git remote add origin $REPO_URI
  git remote add io     $REPO_IO_URI

  git add .
  git commit -m "Update to ${TRAVIS_COMMIT}"

  git push origin gh-pages
  git push io gh-pages:master
fi
