#!/bin/bash
git pull origin master
killall -9 node 2>/dev/null
sleep 2
node index.js