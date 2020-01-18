const express = require('express');

const path = require('path');

const mysql = require('mysql');

const http = require("http");

const PORT = process.env.PORT || 5000;

function setupDB() {

    let db = mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME
    });

    db.connect((err) => {
        if (err) {
            console.log('db error', err);
            setTimeout(setupDB, 2000);
        } else {
            console.log('Connected to database');
        }
    });

    db.on('error', function (err) {
        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
            setupDB();
        } else {
            console.log('db error', err);
            throw err;
        }
    });

    global.db = db;
}

const core = require('./core/app');

setupDB();

express()
    .use(express.static(path.join(__dirname, 'src')))
    .set('views', path.join(__dirname, 'src/views'))
    .set('view engine', 'ejs')
    .get('/', (req, res) => res.render('index', {users: core.stats() }))
    .listen(PORT, () => console.log(`Listening on ${ PORT }`));

core.run();

setInterval(function () {
    http.get("http://beem-marketing.herokuapp.com");
}, 240000);
