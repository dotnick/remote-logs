const express = require('express')
const https = require('https')
const bodyParser = require("body-parser");
const mysql = require('mysql');
const moment = require('moment');
const fs = require('fs');
const pug = require('pug');

// Database pool
var pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: "logs"
})

// SSL certificate and key
var options = {
    key: fs.readFileSync('./server.key'),
    cert: fs.readFileSync('./server.crt')
};

var app = express()
app.set('view engine', 'pug')

app.use(bodyParser.urlencoded({
    extended: false
}));
app.use(bodyParser.json());

app.get('/test', function(req, res) {
    res.json({
        status: "Running!"
    })
});


// Logging API call
app.post('/log', function(req, res) {
    var message = req.body.message;
    var type = req.body.type;
    var user = req.body.user;
    var device = req.body.device;
    var created = moment(Date.now()).format('YYYY-MM-DD HH:mm:ss');
    var log = {
        user: user,
        created: created,
        message: message,
        type: type,
        device: device
    };

    pool.getConnection(function(err, connection) {
        if (err) throw err
        connection.query('INSERT INTO logs SET ?', log, function(err, resp) {
            if (err) throw err
            res.status(200).send("Saved new log entry from user: " + user);
            connection.release();
        })
    })
});

app.get('/logs', function(req, res) {
    // Rows per page
    const pageLimit = 20;

    // Page offset for pagination reasons
    const page = req.query.page;
    var offset = 0;
    if (page != undefined) {
        offset = (page-1) * pageLimit;
    }

    pool.getConnection(function(err, connection) {
        if (err) throw err

        // Get the total logs count.
        var count = 0;
        var countQuery = "SELECT count(*) AS logsCount FROM logs";
        connection.query(countQuery, function(err, rows, fields) {
            if (err) throw err
            count = rows[0].logsCount

            var queryString;

            // Pagination stuff
            var pages = 1;
            if (count > pageLimit) {
                queryString = 'SELECT * FROM logs ORDER BY created DESC LIMIT ' + pageLimit;
                if (offset > 0) {
                    queryString += " OFFSET " + offset
                }
                pages = count / pageLimit;
            } else {
                queryString = 'SELECT * FROM logs ORDER BY created DESC';
            }
            console.log(queryString)
            connection.query(queryString, function(err, rows, fields) {
                if (err) throw err
                res.status(200).send(pug.renderFile('views/logs.pug', {
                    logs: rows,
                    pages: pages,
                    page: page,
                    url: '/logs'
                }));
                connection.release();
            })
        })
    })
});

https.createServer(options, app).listen(3000);
