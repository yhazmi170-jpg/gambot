#!/bin/bash
git pull origin master
kill -9 $(lsof -t -i:3000) 2>/dev/null
npm start