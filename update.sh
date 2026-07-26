#!/bin/bash
export PATH="$HOME/.nix-profile/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
git pull origin master
echo "killing old gambot instances..."
# kill anything on port 3000
fuser -k 3000/tcp 2>/dev/null
# kill all node processes matching index.js
kill $(pgrep -f "node.*index.js") 2>/dev/null
# nuclear option: kill all node
pkill -9 node 2>/dev/null
killall -9 node 2>/dev/null
sleep 3
echo "starting gambot..."
node index.js