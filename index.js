const express = require('express');

const path = require('path');

const mysql = require('mysql');

const http = require("http");

const PORT = process.env.PORT || 5000;
const dev = process.env.PORT || true;

const core = require('./src/core/app');

function setupDB() {

    let db = mysql.createConnection({
        host: process.env.DBHOST,
        user: process.env.USERNAME,
        password: process.env.PASSWORD,
        database: process.env.DBNAME
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

setupDB();

// noinspection JSUnresolvedFunction
express()
    .use(express.static(path.join(__dirname, 'src')))
    .set('views', path.join(__dirname, 'src/views'))
    .set('view engine', 'ejs')
    .get('/', (req, res) => res.render('index'))
    .listen(PORT, () => console.log(`Listening on ${ PORT }`));

core.run();

setInterval(function () {
    core.run();
}, 120000);

setInterval(function () {
    http.get("http://magicdice.herokuapp.com");
}, 240000);

setInterval(function () {
    try {
        db.query('SELECT 1');
    } catch (e) {

    }
}, 10000);