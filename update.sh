#!/bin/bash
git pull origin master
pkill -f "node index.js" 2>/dev/null
pkill -f "node src/index.js" 2>/dev/null
sleep 2
nohup node index.js > bot.log 2>&1 &
echo "bot started"