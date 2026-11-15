#!/bin/bash
# Double-click to start Huddle and open the TV screen.
cd "$(dirname "$0")"
[ -d node_modules ] || npm install
(sleep 1.5 && open "http://localhost:3000") &
node server.js
