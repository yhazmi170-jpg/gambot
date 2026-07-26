#!/bin/bash
export PATH="$HOME/.nix-profile/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
git pull origin master
echo "killing old gambot instances..."
pkill -f "node index.js" 2>/dev/null || killall -9 node 2>/dev/null
sleep 3
echo "starting gambot..."
node index.js