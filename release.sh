#!/bin/bash

IFS=$'\n'
git update-index -q --refresh
if ! git diff-files --quiet --ignore-submodules -- book; then
  echo "unstaged changes, please stage or stash everything"
  exit 1
fi
if ! git diff-files --quiet --ignore-submodules=untracked -- book/code; then
  echo "uncommitted changes in book/code, please stage or stash everything"
  exit 1
fi

pushd book/code > /dev/null
if ! git diff-files --quiet --ignore-submodules --; then
  echo "unstaged changes in book/code"
  if [ x"$1" != x"-f" ]; then
    echo exiting. commit changes or add -f to ignore
    exit 1
  fi
fi

if ! git diff-index --cached --quiet HEAD --ignore-submodules --; then
  echo "uncommited changes in book/code"
  if [ x"$1" != x"-f" ]; then
    echo exiting. commit changes or add -f to ignore
    exit 1
  fi
fi
popd > /dev/null

echo "rendering..."
./render.sh

git commit "$@"
commit=`git show --format=format:%B -s`

pushd public > /dev/null
git add .
echo $commit | git commit "$@" -aF -
git push origin
git push io gh-pages:master
popd > /dev/null

git add public
git commit --amend --no-edit
git push
