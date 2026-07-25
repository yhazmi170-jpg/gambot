#!/bin/bash
git pull origin master
kill $(lsof -t -i:3000) 2>/dev/null
sleep 2
node index.js