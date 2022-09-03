echo Shutting down...
kill $(lsof -ti tcp:9999)

cd /var/www/socket-v2

out="/var/log/socket-server/v2_out.log"
err="/var/log/socket-server/v2_err.log"

echo Starting up admin-panel-sockets...
mkdir -p /var/log/socket-server

nohup node --experimental-json-modules main.js >$out 2>$err &

echo Cleanup historic data...

find ./history/c2s1/* -type d -mtime +10 | xargs rm -rf
find ./history/c3s1/* -type d -mtime +10 | xargs rm -rf
find ./history/c4s1/* -type d -mtime +10 | xargs rm -rf
find ./history/c5s1/* -type d -mtime +10 | xargs rm -rf
find ./history/c16s1/* -type d -mtime +10 | xargs rm -rf

echo Completed