#!/bin/bash
export PATH="$HOME/.nix-profile/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
git pull origin master
killall -9 node 2>/dev/null
sleep 2
node index.js